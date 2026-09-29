import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { Badge, Modal } from './ui'
import { go } from '../router'
import { useStore } from '../store'
import { PLATFORM } from '../plans'
import { NEWS, NEWS_KIND, unseenNews, type News, type NewsStep } from '../news'

/* Novidades: abre sozinha quando há algo novo e fica no sininho do topo para rever.
   "me mostra" leva até a tela e destaca onde tocar, passo a passo. */

const fmt = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/')

export function useNews(enabled: boolean) {
  const { data, setSettings, sync } = useStore()
  const seen = data.settings.newsSeen
  // primeira vez com o sistema de novidades: conta novo não recebe o histórico; quem já usava vê o que saiu no último mês
  useEffect(() => {
    if (!enabled || sync === 'loading' || seen) return
    const t = data.settings.tour
    const veteran = t === 'feito' || (!!t && t < new Date().toISOString().slice(0, 10))
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
    setSettings({ newsSeen: NEWS.filter((n) => !veteran || n.date < cutoff).map((n) => n.id) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sync === 'loading', !!seen])
  const unseen = enabled ? unseenNews(seen) : []
  const markSeen = () => setSettings({ newsSeen: NEWS.map((n) => n.id) })
  return { unseen, markSeen }
}

/** Sininho do topo: ponto quando há novidade; abre a lista. */
export function NewsButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button className="icon-btn news-btn" onClick={onOpen} aria-label={count ? `${count} novidade(s)` : 'Novidades'} title="Novidades">
      <Icon name="bell" />
      {count > 0 && <span className="news-dot" />}
    </button>
  )
}

export function NewsModal({ unseen, onClose }: { unseen: News[]; onClose: () => void }) {
  const [guide, setGuide] = useState<NewsStep[] | null>(null)
  const fresh = new Set(unseen.map((n) => n.id))
  const list = unseen.length ? unseen : NEWS.slice(0, 8)
  if (guide) return <NewsGuide steps={guide} onClose={onClose} />
  return (
    <Modal
      title={unseen.length ? `novidades no ${PLATFORM.name}` : 'últimas novidades'}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          entendi
        </button>
      }
    >
      <div className="news-list">
        {list.map((n) => (
          <article key={n.id} className={`news-item ${fresh.has(n.id) ? 'is-new' : ''}`}>
            <div className="news-head">
              <Badge color={NEWS_KIND[n.kind].color}>{NEWS_KIND[n.kind].label}</Badge>
              <span className="muted small">{fmt(n.date)}</span>
            </div>
            <h3>{n.title}</h3>
            <p className="muted">{n.text}</p>
            {n.steps?.length ? (
              <button className="btn small" onClick={() => setGuide(n.steps!)}>
                <Icon name="arrowRight" size={14} /> me mostra
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </Modal>
  )
}

/** Leva até a tela de cada passo e destaca o que tocar (mesmo visual do passo a passo). */
function NewsGuide({ steps, onClose }: { steps: NewsStep[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = steps[i]
  useEffect(() => {
    if (step.configTab) {
      try {
        localStorage.setItem('config-aba', step.configTab)
      } catch {
        /* sem armazenamento */
      }
    }
    if (step.page) go(step.page, step.id)
  }, [step])
  useLayoutEffect(() => {
    setRect(null)
    if (!step.target) return
    let tries = 0
    const find = () => {
      const el = document.querySelector<HTMLElement>(step.target!)
      if (el) {
        el.scrollIntoView({ block: 'center' })
        window.setTimeout(() => setRect(el.getBoundingClientRect()), 250)
      } else if (tries++ < 20) t = window.setTimeout(find, 150)
    }
    let t = window.setTimeout(find, 200)
    const update = () => {
      const el = document.querySelector<HTMLElement>(step.target!)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step])
  const last = i === steps.length - 1
  const mobile = innerWidth <= 720
  // cartão embaixo (ou em cima) do que está destacado
  const below = rect ? rect.bottom + 16 + 220 < innerHeight : false
  const cardStyle: CSSProperties = rect
    ? mobile
      ? below
        ? { left: 16, right: 16, top: rect.bottom + 14 }
        : { left: 16, right: 16, bottom: innerHeight - rect.top + 14 }
      : { left: Math.max(16, Math.min(rect.left, innerWidth - 380)), ...(below ? { top: rect.bottom + 14 } : { bottom: innerHeight - rect.top + 14 }) }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  return (
    <div className="tour-layer" role="dialog" aria-label="Novidade: me mostra">
      {rect ? <div className="tour-spot" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} /> : <div className="tour-dim" />}
      <div className="tour" style={cardStyle}>
        <div className="tour-top">
          <span className="tour-count">
            novidade · {i + 1} de {steps.length}
          </span>
          <button className="icon-btn subtle" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>
        <p>{step.text}</p>
        <div className="tour-actions">
          {i > 0 && (
            <button className="btn ghost small" onClick={() => setI(i - 1)}>
              voltar
            </button>
          )}
          <button className="btn primary small" onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? 'entendi' : 'próximo'}
            {!last && <Icon name="chevronR" size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
