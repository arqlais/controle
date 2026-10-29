import { useRef, useState } from 'react'
import { useStore } from '../store'
import { useAccess } from '../access'
import { go } from '../router'
import { panelLink } from '../clientPanel'
import { lastVersion, removeReviewVersion, REVIEW_STATUS, uploadReviewVersion } from '../review'
import { PAL } from '../palette'
import { Icon } from './Icon'
import { Badge, Section } from './ui'
import { askDelete, toast } from './dialog'
import type { Client, Project, ReviewScene } from '../types'
import { fmtDate, uid, whatsappLink } from '../utils'

/* Imagens para aprovação, dentro da demanda: cada cena com as versões enviadas.
   O cliente vê na página dele, marca pontos com comentário e aprova; a resposta volta sozinha para cá. */

const COLOR: Record<ReviewScene['status'], string> = { enviada: PAL.warn, ajustes: PAL.bad, aprovada: PAL.good }

export function ReviewSection({ p, client, save }: { p: Project; client?: Client; save: (patch: Partial<Project>) => void }) {
  const { userId } = useStore()
  const { has } = useAccess()
  const scenes = p.review ?? []
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const panelOn = !!client?.panel?.enabled
  const link = panelOn ? `${panelLink(userId, client!.panel!.token)}` : ''
  const approved = scenes.filter((s) => s.status === 'aprovada').length

  const setScenes = (next: ReviewScene[]) => save({ review: next })
  const addScene = () => {
    const n = name.trim() || `Cena ${scenes.length + 1}`
    setScenes([...scenes, { id: uid(), name: n, versions: [], status: 'enviada' }])
    setName('')
    setAdding(false)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copiado')
    } catch {
      toast('Não deu para copiar agora')
    }
  }
  const msg = `Oi${client ? `, ${client.name.split(' ')[0]}` : ''}! As imagens de “${p.title}” estão prontas para você ver. Toque na imagem para marcar o que quer ajustar, ou aprove por lá: ${link}`

  if (!has('portal')) return null
  return (
    <Section
      title={`Imagens para aprovação${scenes.length ? ` · ${approved}/${scenes.length}` : ''}`}
      hint="Envie as versões de cada cena. O cliente abre a página dele, toca na imagem para marcar o que quer ajustar e aprova. Pedir ajustes conta uma revisão, uma vez por versão."
      action={
        <button className="btn small ghost" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} /> Cena
        </button>
      }
    >
      {!panelOn ? (
        <p className="small muted rv-note">
          <Icon name="link" size={14} /> As imagens aparecem na página do cliente.{' '}
          {client && (
            <button className="link" onClick={() => go(`clientes/${client.id}`)}>
              ativar a página de {client.name.split(' ')[0]}
            </button>
          )}
        </p>
      ) : (
        scenes.some((s) => s.versions.length) && (
          <div className="row gap-s wrap rv-share">
            <button className="btn small ghost" onClick={() => void copy()}>
              <Icon name="copy" size={14} /> Copiar link
            </button>
            {client?.phone && (
              <a className="btn small ghost" href={whatsappLink(client.phone, msg)} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" size={14} /> Mandar no WhatsApp
              </a>
            )}
          </div>
        )
      )}

      {adding && (
        <div className="row gap-s rv-add">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addScene()} placeholder={`Nome da cena (ex.: sala · vista 1)`} />
          <button className="btn small primary" onClick={addScene}>
            Criar
          </button>
          <button className="btn small ghost" onClick={() => setAdding(false)}>
            Cancelar
          </button>
        </div>
      )}

      {scenes.length === 0 && !adding ? (
        <p className="muted small">Nenhuma cena ainda. Crie uma cena (ex.: “sala · vista 1”) e envie a primeira versão do render.</p>
      ) : (
        <div className="rv-list">
          {scenes.map((s) => (
            <SceneCard
              key={s.id}
              s={s}
              userId={userId}
              onChange={(next) => setScenes(scenes.map((x) => (x.id === s.id ? next : x)))}
              onDelete={async () => {
                if (!(await askDelete(`a cena “${s.name}”${s.versions.length ? ` e as ${s.versions.length} versões` : ''}`))) return
                for (const v of s.versions) await removeReviewVersion(userId, v)
                setScenes(scenes.filter((x) => x.id !== s.id))
              }}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

function SceneCard({ s, userId, onChange, onDelete }: { s: ReviewScene; userId: string; onChange: (s: ReviewScene) => void; onDelete: () => void }) {
  const last = s.versions.length ? lastVersion(s) : undefined
  const [shown, setShown] = useState<number | null>(null)
  const v = s.versions.find((x) => x.n === shown) ?? last
  const [busy, setBusy] = useState(false)
  const [rename, setRename] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const open = (v?.pins ?? []).filter((x) => !x.done).length

  const upload = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      const n = (last?.n ?? 0) + 1
      const nv = await uploadReviewVersion(userId, f, n)
      onChange({ ...s, versions: [...s.versions, nv], status: 'enviada', approvedAt: undefined, approvedVersion: undefined })
      setShown(null)
      toast(`Versão ${n} enviada · já aparece para o cliente`)
    } catch {
      toast('Não deu para enviar a imagem. Tente de novo.')
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }
  const togglePin = (pid: string) => v && onChange({ ...s, versions: s.versions.map((x) => (x.id === v.id ? { ...x, pins: (x.pins ?? []).map((y) => (y.id === pid ? { ...y, done: !y.done } : y)) } : x)) })
  const dropVersion = async () => {
    if (!v || !(await askDelete(`a versão ${v.n} de “${s.name}”`))) return
    await removeReviewVersion(userId, v)
    const versions = s.versions.filter((x) => x.id !== v.id)
    onChange({ ...s, versions, ...(s.approvedVersion === v.n ? { status: 'enviada' as const, approvedAt: undefined, approvedVersion: undefined } : {}) })
    setShown(null)
  }

  return (
    <article className="rv-card">
      <header className="rv-head">
        {rename ? (
          <input autoFocus defaultValue={s.name} onBlur={(e) => (onChange({ ...s, name: e.target.value.trim() || s.name }), setRename(false))} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        ) : (
          <button className="rv-name" onClick={() => setRename(true)} title="Renomear">
            {s.name}
          </button>
        )}
        {s.versions.length > 0 && <Badge color={COLOR[s.status]}>{s.status === 'aprovada' && s.approvedVersion ? `aprovada · v${s.approvedVersion}` : REVIEW_STATUS[s.status]}</Badge>}
        <button className="icon-btn" onClick={onDelete} aria-label="Apagar cena" title="Apagar cena">
          <Icon name="trash" size={14} />
        </button>
      </header>

      {v ? (
        <>
          <figure className="rv-shot">
            <img src={v.url} alt={`${s.name} · versão ${v.n}`} loading="lazy" />
            {(v.pins ?? []).map((x, i) => (
              <span key={x.id} className={`rv-pin ${x.done ? 'is-done' : ''}`} style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%` }} title={x.text}>
                {i + 1}
              </span>
            ))}
          </figure>
          <div className="rv-versions" role="tablist" aria-label="Versões">
            {s.versions.map((x) => (
              <button key={x.id} role="tab" aria-selected={x.id === v.id} className={`rv-v ${x.id === v.id ? 'is-on' : ''}`} onClick={() => setShown(x.n)} title={fmtDate(x.at.slice(0, 10))}>
                v{x.n}
                {(x.pins ?? []).some((y) => !y.done) && <i />}
              </button>
            ))}
            <span className="grow" />
            <button className="link small muted-link" onClick={() => void dropVersion()}>
              apagar v{v.n}
            </button>
          </div>
          {(v.note || (v.pins ?? []).length > 0) && (
            <ol className="rv-pins">
              {v.note && <li className="rv-general">“{v.note}”</li>}
              {(v.pins ?? []).map((x, i) => (
                <li key={x.id} className={x.done ? 'is-done' : ''}>
                  <label>
                    <input type="checkbox" checked={!!x.done} onChange={() => togglePin(x.id)} />
                    <b>{i + 1}</b> {x.text}
                  </label>
                </li>
              ))}
            </ol>
          )}
          {open > 0 && <p className="small muted">{open} ajuste{open > 1 ? 's' : ''} para fazer. Marque conforme resolver e envie a próxima versão.</p>}
        </>
      ) : (
        <p className="muted small">Envie a primeira versão desta cena.</p>
      )}

      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      <button className="btn small rv-up" disabled={busy} onClick={() => file.current?.click()}>
        <Icon name="upload" size={14} /> {busy ? 'enviando…' : last ? `Enviar versão ${last.n + 1}` : 'Enviar versão 1'}
      </button>
    </article>
  )
}
