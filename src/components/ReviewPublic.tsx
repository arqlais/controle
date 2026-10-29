import { useRef, useState } from 'react'
import { avisar } from '../avisar'
import { readShortCode } from '../linkPack'
import type { PanelPayload, PanelProject } from '../clientPanel'
import type { ReviewFeedback } from '../review'
import { uid } from '../utils'
import { Icon } from './Icon'

/* Página do cliente: imagens para aprovar. Ele toca na imagem para marcar o que quer ajustar
   (cada ponto com um comentário), compara com a versão anterior e aprova ou pede ajustes. */

type Scene = NonNullable<PanelProject['review']>[number]
type Draft = { id: string; x: number; y: number; text: string }
type Sent = { ok: boolean; at: string }

const sentKey = (token: string, scene: string, n: number) => `imagens:${token}:${scene}:${n}`
const readSent = (k: string): Sent | null => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') as Sent | null
  } catch {
    return null
  }
}

/** Quantas cenas esperam a resposta do cliente (para o número no menu). */
export const scenesToReview = (d: PanelPayload) => d.projects.flatMap((p) => p.review ?? []).filter((s) => s.status === 'enviada').length

export function ReviewPublic({ d, owner, token, preview }: { d: PanelPayload; owner: string; token: string; preview?: boolean }) {
  const list = d.projects.filter((p) => p.review?.length)
  if (!list.length) return null
  const who = d.owner || d.studio
  return (
    <section id="pn-imagens" className="cp-section cpr">
      <h2 className="cp-h">
        <Icon name="image" size={18} /> imagens para aprovar
      </h2>
      <p className="cpr-help">
        Toque na imagem para marcar o que quer ajustar e escreva o comentário. Quando estiver tudo certo, toque em <b>aprovar</b>. {who} recebe na hora.
      </p>
      {list.map((p) => (
        <div key={p.id} className="cpr-project">
          {d.projects.length > 1 && <p className="cp-card-title">{p.title}</p>}
          {p.review!.map((s) => (
            <SceneBox key={s.id} s={s} projectId={p.id} d={d} owner={owner} token={token} preview={preview} />
          ))}
        </div>
      ))}
    </section>
  )
}

function SceneBox({ s, projectId, d, owner, token, preview }: { s: Scene; projectId: string; d: PanelPayload; owner: string; token: string; preview?: boolean }) {
  const last = s.versions[s.versions.length - 1]
  const [n, setN] = useState(last.n)
  const v = s.versions.find((x) => x.n === n) ?? last
  const prev = s.versions.find((x) => x.n === v.n - 1)
  const isLast = v.n === last.n
  const key = sentKey(token, s.id, v.n)
  const [sent, setSent] = useState<Sent | null>(() => readSent(key))
  const approved = s.status === 'aprovada' && s.approvedVersion === v.n
  const canMark = isLast && !approved && !sent
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [compare, setCompare] = useState(false)
  const [cut, setCut] = useState(50)
  const [state, setState] = useState<'idle' | 'busy' | 'erro'>('idle')
  const box = useRef<HTMLDivElement>(null)

  const place = (e: React.MouseEvent) => {
    if (!canMark || compare) return
    const r = box.current!.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    const id = uid()
    setDrafts((ds) => [...ds, { id, x, y, text: '' }])
    setEditing(id)
  }
  const send = async (ok: boolean) => {
    const pins = drafts.filter((x) => x.text.trim()).map(({ x, y, text }) => ({ x, y, text: text.trim() }))
    if (!ok && !pins.length && !note.trim()) return
    const done: Sent = { ok, at: new Date().toISOString() }
    if (preview) {
      setSent(done)
      return
    }
    setState('busy')
    const fb: ReviewFeedback = { p: projectId, s: s.id, v: v.n, ok, pins, ...(note.trim() ? { note: note.trim() } : {}) }
    const panel = token.includes('.') ? readShortCode(token)?.id ?? token : token
    const sum = ok ? `aprovou a versão ${v.n}` : [pins.length ? `${pins.length} ponto(s) para ajustar: ${pins.map((x, i) => `${i + 1}. ${x.text}`).join(' · ')}` : '', note.trim()].filter(Boolean).join(' · ')
    const res = await avisar({ user: owner, kind: 'imagens', ref: uid(), cliente: d.clientFull, titulo: s.name, texto: sum, code: JSON.stringify(fb), painel: panel, studio: d.studio })
    if (!res) return setState('erro')
    try {
      localStorage.setItem(key, JSON.stringify(done))
    } catch {
      /* sem espaço: só não lembra depois */
    }
    setSent(done)
    setDrafts([])
    setNote('')
    setState('idle')
  }

  const old = v.pins ?? []
  const status = approved ? 'aprovada' : sent ? (sent.ok ? 'aprovada' : 'ajustes enviados') : s.status === 'ajustes' && isLast ? 'ajustes em andamento' : isLast ? 'esperando você' : `versão anterior`
  return (
    <article className="cp-card cpr-scene">
      <header className="cpr-head">
        <b>{s.name}</b>
        <span className={`cpr-status ${approved || sent?.ok ? 'is-ok' : sent || s.status === 'ajustes' ? 'is-adj' : ''}`}>
          {approved || sent?.ok ? <Icon name="check" size={12} /> : null} {status}
        </span>
      </header>

      <div ref={box} className={`cpr-shot ${canMark && !compare ? 'can-mark' : ''}`} onClick={place} style={v.w && v.h ? { aspectRatio: `${v.w} / ${v.h}` } : undefined}>
        <img src={v.url} alt={`${s.name}, versão ${v.n}`} draggable={false} />
        {compare && prev && (
          <>
            <img className="cpr-before" src={prev.url} alt={`versão ${prev.n}`} draggable={false} style={{ clipPath: `inset(0 ${100 - cut}% 0 0)` }} />
            <span className="cpr-cut" style={{ left: `${cut}%` }} />
            <span className="cpr-tag is-l">v{prev.n}</span>
            <span className="cpr-tag is-r">v{v.n}</span>
          </>
        )}
        {!compare &&
          old.map((x, i) => (
            <span key={`o${i}`} className={`cpr-pin is-old ${x.done ? 'is-done' : ''}`} style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%` }} title={x.text}>
              {x.done ? <Icon name="check" size={10} /> : i + 1}
            </span>
          ))}
        {!compare &&
          drafts.map((x, i) => (
            <span key={x.id} className="cpr-pin" style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%` }} onClick={(e) => (e.stopPropagation(), setEditing(x.id))}>
              {old.length + i + 1}
            </span>
          ))}
      </div>
      {compare && prev && <input className="cpr-range" type="range" min={0} max={100} value={cut} onChange={(e) => setCut(+e.target.value)} aria-label="Comparar versões" />}

      <div className="cpr-bar">
        {s.versions.length > 1 &&
          s.versions.map((x) => (
            <button key={x.n} className={`cpr-v ${x.n === v.n ? 'is-on' : ''}`} onClick={() => (setN(x.n), setCompare(false), setSent(readSent(sentKey(token, s.id, x.n))))}>
              v{x.n}
            </button>
          ))}
        <span className="cpr-grow" />
        {prev && (
          <button className={`cpr-v ${compare ? 'is-on' : ''}`} onClick={() => setCompare((c) => !c)}>
            <Icon name="layers" size={12} /> comparar com v{prev.n}
          </button>
        )}
      </div>

      {old.length > 0 && !compare && (
        <ol className="cpr-list is-old">
          {old.map((x, i) => (
            <li key={i} className={x.done ? 'is-done' : ''}>
              <b>{x.done ? <Icon name="check" size={11} /> : i + 1}</b> {x.text} {x.done && <em>resolvido</em>}
            </li>
          ))}
        </ol>
      )}

      {canMark && (
        <>
          {drafts.length > 0 && (
            <ol className="cpr-list" start={old.length + 1}>
              {drafts.map((x, i) => (
                <li key={x.id}>
                  <b>{old.length + i + 1}</b>
                  <input
                    autoFocus={editing === x.id}
                    value={x.text}
                    onChange={(e) => setDrafts((ds) => ds.map((y) => (y.id === x.id ? { ...y, text: e.target.value } : y)))}
                    placeholder="O que ajustar aqui? (ex.: madeira mais clara)"
                  />
                  <button className="cpr-x" onClick={() => setDrafts((ds) => ds.filter((y) => y.id !== x.id))} aria-label="Tirar ponto">
                    <Icon name="x" size={13} />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentário geral (opcional)" spellCheck lang="pt-BR" />
          {state === 'erro' && <p className="bf-error">Não foi agora. Tente de novo em instantes.</p>}
          <div className="cpr-actions">
            <button className="btn primary" disabled={state === 'busy'} onClick={() => void send(true)}>
              <Icon name="check" size={15} /> aprovar esta imagem
            </button>
            <button className="btn" disabled={state === 'busy' || (!drafts.some((x) => x.text.trim()) && !note.trim())} onClick={() => void send(false)}>
              <Icon name="pen" size={15} /> pedir ajustes{drafts.filter((x) => x.text.trim()).length ? ` (${drafts.filter((x) => x.text.trim()).length})` : ''}
            </button>
          </div>
          {drafts.length === 0 && <p className="cpr-tip">Dica: toque no ponto da imagem que quer mudar.</p>}
        </>
      )}
      {sent && isLast && !approved && (
        <p className="pn-sent">
          <Icon name="check" size={16} /> {sent.ok ? 'Imagem aprovada. Obrigada!' : `Ajustes enviados. ${d.owner || d.studio} vai preparar a próxima versão.`}
        </p>
      )}
    </article>
  )
}
