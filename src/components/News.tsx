import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { Badge } from './ui'
import { go } from '../router'
import { useStore } from '../store'
import { PLATFORM } from '../plans'
import { NEWS, NEWS_KIND, unseenNews, type News, type NewsStep } from '../news'

/* Novidades: abre sozinha quando há algo novo e fica no sininho do topo para rever.
   "me mostra" leva até a tela e destaca onde tocar, passo a passo. */


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

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const longDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]}`
}
// frase de abertura: muda a cada atualização (pela data), sempre curta
const IMPACT = [
  `o ${PLATFORM.name} ficou mais leve de novo`,
  'menos planilha, mais projeto',
  'novidades fresquinhas para a sua rotina',
  'pequenos ajustes, grandes horas economizadas',
  'feito ouvindo quem usa todo dia',
]

/** Card das novidades: desfoca a tela, mostra o resumo e depois passa por cada novidade. */
export function NewsModal({ unseen, onClose, onLater }: { unseen: News[]; onClose: () => void; onLater?: () => void }) {
  const all = unseen.length ? unseen : NEWS.slice(0, 6)
  // resumo enxuto: novidades e melhorias uma a uma; correções viram um item só
  const fixes = all.filter((x) => x.kind === 'correcao')
  const list: News[] = [
    ...all.filter((x) => x.kind !== 'correcao'),
    ...(fixes.length
      ? [{ id: 'correcoes', date: fixes.reduce((d, x) => (x.date > d ? x.date : d), ''), kind: 'correcao' as const, title: 'correções e pequenos ajustes', text: fixes.map((x) => x.title.charAt(0).toUpperCase() + x.title.slice(1)).join(' · ') + '.' }]
      : []),
  ]
  const [i, setI] = useState(-1) // -1 = resumo; 0..n = uma novidade por vez
  const [guide, setGuide] = useState<NewsStep[] | null>(null)
  if (guide) return <NewsGuide steps={guide} onClose={onClose} />
  const date = all.reduce((d, n) => (n.date > d ? n.date : d), '')
  const impact = IMPACT[Number(date.replace(/-/g, '')) % IMPACT.length]
  const n = i >= 0 ? list[i] : null
  return (
    <div className="nw-layer" role="dialog" aria-modal="true" aria-label="Novidades">
      <div className="nw-card">
        <button className="icon-btn subtle nw-x" onClick={onClose} aria-label="Fechar">
          <Icon name="x" size={16} />
        </button>
        {!n ? (
          <>
            <p className="nw-eyebrow">
              <span className="nw-pulse" /> atualização · {longDate(date)}
            </p>
            <h2 className="nw-title">{impact}</h2>
            <p className="nw-lead">Estamos sempre melhorando o {PLATFORM.name} para a sua gestão ficar mais simples. Veja o que mudou:</p>
            <ol className="nw-summary">
              {list.map((x, k) => (
                <li key={x.id}>
                  <button type="button" onClick={() => setI(k)}>
                    <Badge color={NEWS_KIND[x.kind].color}>{NEWS_KIND[x.kind].label}</Badge>
                    <span>{x.title}</span>
                    <Icon name="chevronR" size={14} />
                  </button>
                </li>
              ))}
            </ol>
            <div className="nw-actions">
              {onLater && (
                <button className="link" onClick={onLater}>
                  ver depois
                </button>
              )}
              <button className="btn primary" onClick={() => setI(0)}>
                ver as novidades <Icon name="arrowRight" size={15} />
              </button>
            </div>
          </>
        ) : (
          <div key={n.id} className="nw-item">
            <p className="nw-eyebrow">
              <Badge color={NEWS_KIND[n.kind].color}>{NEWS_KIND[n.kind].label}</Badge>
              <span>
                novidade {i + 1} de {list.length}
              </span>
            </p>
            <h2 className="nw-title is-item">{n.title}</h2>
            <p className="nw-lead">{n.text}</p>
            {n.steps?.length ? (
              <button className="btn nw-show" onClick={() => setGuide(n.steps!)}>
                <Icon name="eye" size={15} /> me mostra onde fica
              </button>
            ) : null}
            <div className="nw-dots" aria-hidden>
              {list.map((x, k) => (
                <i key={x.id} className={k === i ? 'on' : k < i ? 'done' : ''} />
              ))}
            </div>
            <div className="nw-actions">
              <button className="btn ghost" onClick={() => setI(i - 1)}>
                voltar
              </button>
              <button className="btn primary" onClick={() => (i + 1 < list.length ? setI(i + 1) : onClose())}>
                {i + 1 < list.length ? (
                  <>
                    próxima <Icon name="chevronR" size={14} />
                  </>
                ) : (
                  'entendi, obrigada!'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Boas-vindas para quem acabou de se cadastrar (aparece uma vez, antes do passo a passo). */
export function WelcomeCard({ name, onTour, onSkip }: { name: string; onTour: () => void; onSkip: () => void }) {
  const first = (name || '').trim().split(' ')[0]
  return (
    <div className="nw-layer" role="dialog" aria-modal="true" aria-label="Boas-vindas">
      <div className="nw-card nw-welcome">
        <p className="nw-eyebrow">
          <span className="nw-pulse" /> boas-vindas
        </p>
        <h2 className="nw-title">
          que bom ter você aqui{first ? `, ${first}` : ''}!
        </h2>
        <p className="nw-lead">
          Obrigada por escolher o {PLATFORM.name} 💛 Ele nasceu da rotina de uma freelancer que precisava organizar clientes, orçamentos, prazos e dinheiro num lugar só, e agora é seu também.
        </p>
        <ul className="nw-welcome-list">
          <li>
            <Icon name="check" size={15} /> seus dias grátis já começaram, com tudo liberado
          </li>
          <li>
            <Icon name="check" size={15} /> em 2 minutos o passo a passo mostra onde fica cada coisa
          </li>
          <li>
            <Icon name="check" size={15} /> dúvida ou ideia? o balão de conversa no canto fala direto com a gente
          </li>
        </ul>
        <div className="nw-actions">
          <button className="link" onClick={onSkip}>
            explorar sozinha(o)
          </button>
          <button className="btn primary" onClick={onTour}>
            começar o passo a passo <Icon name="arrowRight" size={15} />
          </button>
        </div>
        <p className="nw-sign">— {PLATFORM.owner}, criadora do {PLATFORM.name}</p>
      </div>
    </div>
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
