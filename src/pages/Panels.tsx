import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useAccess } from '../access'
import { Icon } from '../components/Icon'
import { Empty, Modal } from '../components/ui'
import { DateInput } from '../components/DateInput'
import { toast } from '../components/dialog'
import { ClientPanelPublic } from '../components/ClientPanelPublic'
import { PanelControls, createPanel, panelMessage } from '../components/ClientPanel'
import { panelLink, panelPayload } from '../clientPanel'
import { go } from '../router'
import { fmtDate, money, projectPaid, projectTotal, statusInfo, whatsappLink } from '../utils'
import type { Client, Project, ProjectPhase } from '../types'

/* Painel do cliente: todos os clientes num lugar só. Ver quem já tem painel no ar, copiar ou mandar o link,
   ver como o cliente vê e criar o painel de quem ainda não tem, sem precisar abrir a ficha. */

export default function Panels({ id }: { id?: string }) {
  if (id) return <PanelEditor id={id} />
  return <PanelList />
}

function PanelList() {
  const { data, upsert, userId } = useStore()
  const { has } = useAccess()
  const [q, setQ] = useState('')
  const [others, setOthers] = useState(false)
  const [peek, setPeek] = useState<Client | null>(null)
  const [busy, setBusy] = useState('')
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.clients
      .filter((c) => !c.archived && (!t || c.name.toLowerCase().includes(t)))
      .map((c) => {
        const projects = data.projects.filter((p) => p.clientId === c.id)
        const main = projects.find((p) => !p.deliveredDate) ?? projects[0]
        const phase = main?.phases?.find((x) => !x.done)?.name
        const approved = data.quotes.some((x) => x.clientId === c.id && x.status === 'aprovado') || projects.length > 0
        return { c, on: !!c.panel?.enabled, approved, main, phase }
      })
      .sort((a, b) => a.c.name.localeCompare(b.c.name))
  }, [data, q])
  const live = rows.filter((r) => r.on)
  const ready = rows.filter((r) => !r.on && r.approved)
  const rest = rows.filter((r) => !r.on && !r.approved)

  const create = async (c: Client) => {
    setBusy(c.id)
    await createPanel(data, c, has, userId, upsert)
    setBusy('')
    toast(`Painel de ${c.name.split(' ')[0]} no ar. Agora é só mandar o link.`)
  }

  const Row = ({ r }: { r: (typeof rows)[number] }) => {
    const { c, on, main } = r
    const link = on && c.panel ? panelLink(userId, c.panel.token) : ''
    const phases = main?.phases ?? []
    const done = phases.filter((x) => x.done).length
    const now = phases.find((x) => !x.done)
    const pct = main ? (phases.length ? Math.round((done / phases.length) * 100) : main.deliveredDate ? 100 : 0) : 0
    const total = main ? projectTotal(main) : 0
    const paid = main ? projectPaid(main) : 0
    const toSign = (data.contracts ?? []).filter((k) => k.clientId === c.id && k.status === 'enviado').length
    const docs = (data.docs ?? []).filter((x) => x.clientId === c.id).length
    return (
      <article className={`card pnl-card ${on ? 'is-on' : ''}`}>
        <header className="pnl-head">
          <span className="pnl-avatar">{(c.name || '?')[0].toUpperCase()}</span>
          <span className="grow">
            <b>{c.name}</b>
            <small className="muted">{main ? main.title : 'sem demanda ainda'}</small>
          </span>
          <span className={`pnl-state ${on ? 'is-on' : ''}`}>
            <i /> {on ? 'no ar' : 'sem painel'}
          </span>
        </header>
        {main && (
          <div className="pnl-facts">
            <div className="pnl-fact is-wide">
              <span>{main.deliveredDate ? 'situação' : 'etapa atual'}</span>
              <b>{main.deliveredDate ? 'entregue' : now?.name ?? statusInfo(main.status).label}</b>
              {phases.length > 0 && (
                <div className="pnl-bar" aria-label={`${pct}% concluído`}>
                  <i style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
            <div className="pnl-fact">
              <span>{main.deliveredDate ? 'entregue em' : 'entrega'}</span>
              {/* dá para mudar a data aqui mesmo: prevista, ou a da entrega quando já foi entregue */}
              <DateInput
                className={`pnl-date ${main.deliveredDate || main.dueDate ? '' : 'is-empty'}`}
                value={main.deliveredDate ?? main.dueDate ?? ''}
                onChange={(e) => e.target.value && upsert('projects', { ...main, ...(main.deliveredDate ? { deliveredDate: e.target.value } : { dueDate: e.target.value }) })}
                aria-label={main.deliveredDate ? 'Data em que foi entregue' : 'Entrega prevista'}
                title="Toque para mudar a data"
              />
            </div>
            <div className="pnl-fact">
              <span>pago</span>
              <b>{total > 0 ? `${money(paid)} de ${money(total)}` : '—'}</b>
            </div>
            <div className="pnl-fact">
              <span>documentos</span>
              <b>{toSign ? `${toSign} para assinar` : docs ? `${docs} na ficha` : '—'}</b>
            </div>
          </div>
        )}
        {on && c.panel?.publishedAt && <p className="muted small pnl-when">no ar desde {fmtDate(c.panel.publishedAt.slice(0, 10))}</p>}
        <div className="pnl-actions">
          {on ? (
            <>
              <button className="pnl-btn is-main" onClick={() => go('paineis', c.id)}>
                <Icon name="edit" size={14} /> editar ao vivo
              </button>
              <button className="pnl-btn" onClick={() => setPeek(c)}>
                <Icon name="eye" size={14} /> ver como o cliente vê
              </button>
              {c.phone && (
                <a className="pnl-btn" href={whatsappLink(c.phone, panelMessage(c, link))} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" size={14} /> mandar
                </a>
              )}
              <button className="pnl-btn" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copiado.'), () => toast(link))}>
                <Icon name="copy" size={14} /> copiar link
              </button>
            </>
          ) : (
            <button className="pnl-btn is-main" disabled={busy === c.id} onClick={() => void create(c)}>
              <Icon name="link" size={14} /> {busy === c.id ? 'criando…' : 'criar o painel'}
            </button>
          )}

        </div>
      </article>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">clientes</p>
          <h1>
            painel <em>do cliente</em>
          </h1>
          <p className="muted">Um link só de cada cliente, sem senha: etapas, prazos, pagamentos, contratos, briefings e documentos. Atualiza sozinho.</p>
        </div>
      </div>

      <div className="pnl-top">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar cliente…" aria-label="Buscar cliente" />
      </div>

      {!live.length && !ready.length ? (
        <Empty icon="link" title="nenhum cliente com orçamento aprovado" text="Quando um cliente aprovar um orçamento (ou tiver uma demanda), ele aparece aqui para você criar o painel." />
      ) : (
        <>
          {live.length > 0 && (
            <section className="pnl-group">
              <p className="pnl-group-title">
                <i className="is-on" /> no ar <small>{live.length}</small>
              </p>
              <div className="pnl-list">
                {live.map((r) => (
                  <Row key={r.c.id} r={r} />
                ))}
              </div>
            </section>
          )}
          {ready.length > 0 && (
            <section className="pnl-group">
              <p className="pnl-group-title">
                <i /> aprovaram, ainda sem painel <small>{ready.length}</small>
              </p>
              <div className="pnl-list">
                {ready.map((r) => (
                  <Row key={r.c.id} r={r} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {rest.length > 0 &&
        (others ? (
          <section className="pnl-group">
            <p className="pnl-group-title">
              <i /> outros clientes (sem orçamento aprovado) <small>{rest.length}</small>
            </p>
            <div className="pnl-list">
              {rest.map((r) => (
                <Row key={r.c.id} r={r} />
              ))}
            </div>
          </section>
        ) : (
          <button className="link small pnl-more" onClick={() => setOthers(true)}>
            mostrar os outros {rest.length} clientes (sem orçamento aprovado)
          </button>
        ))}

      {peek?.panel && (
        <Modal wide title={`painel de ${peek.name.split(' ')[0]}`} onClose={() => setPeek(null)}>
          <div className="pn-peek">
            <ClientPanelPublic id={peek.panel.token} data={panelPayload(data, peek, peek.panel, has)} preview />
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ---------------- editor do painel em tempo real ---------------- */

/** Editar o painel de um cliente vendo, ao lado, exatamente o que ele vê (computador ou celular). */
export function PanelEditor({ id }: { id: string }) {
  const { data, upsert, userId } = useStore()
  const { has } = useAccess()
  const [width, setWidth] = useState<'pc' | 'cel'>('pc')
  const [tab, setTab] = useState<'editar' | 'ver'>('editar')
  const [busy, setBusy] = useState(false)
  const c = data.clients.find((x) => x.id === id)
  if (!c) return <Empty icon="users" title="cliente não encontrado" />
  const on = !!c.panel?.enabled
  const link = on && c.panel ? panelLink(userId, c.panel.token) : ''
  const projects = data.projects.filter((p) => p.clientId === c.id && !(c.panel?.hideProjects ?? []).includes(p.id))
  const saveProject = (p: Project, patch: Partial<Project>) => upsert('projects', { ...p, ...patch })
  const setPhase = (p: Project, i: number, patch: Partial<ProjectPhase>) => saveProject(p, { phases: (p.phases ?? []).map((x, j) => (j === i ? { ...x, ...patch, ...(patch.done ? { doneAt: new Date().toISOString().slice(0, 10) } : {}) } : x)) })

  return (
    <div className="page pe-page">
      <div className="pe-top">
        <button className="btn small ghost" onClick={() => go('paineis')}>
          <Icon name="chevronL" size={14} /> painéis
        </button>
        <span className="grow pe-title">
          <b>painel de {c.name}</b>
          <small className={`pnl-state ${on ? 'is-on' : ''}`}>
            <i /> {on ? 'no ar · muda para o cliente na hora' : 'ainda não está no ar'}
          </small>
        </span>
        {on ? (
          <span className="pnl-actions">
            {c.phone && (
              <a className="pnl-btn is-main" href={whatsappLink(c.phone, panelMessage(c, link))} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" size={14} /> mandar link
              </a>
            )}
            <button className="pnl-btn" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copiado.'), () => toast(link))}>
              <Icon name="copy" size={14} /> copiar link
            </button>
          </span>
        ) : (
          <button
            className="pnl-btn is-main"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await createPanel(data, c, has, userId, upsert)
              setBusy(false)
              toast('Painel no ar.')
            }}
          >
            <Icon name="link" size={14} /> {busy ? 'criando…' : 'colocar no ar'}
          </button>
        )}
      </div>

      <div className="pe-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'editar'} className={tab === 'editar' ? 'is-on' : ''} onClick={() => setTab('editar')}>
          <Icon name="edit" size={14} /> editar
        </button>
        <button role="tab" aria-selected={tab === 'ver'} className={tab === 'ver' ? 'is-on' : ''} onClick={() => setTab('ver')}>
          <Icon name="eye" size={14} /> ver como o cliente
        </button>
      </div>

      <div className={`pe-grid is-${tab}`}>
        <div className="pe-edit">
          {!on ? (
            <div className="card pe-box">
              <p className="muted">Coloque o painel no ar para escolher o que {c.name.split(' ')[0]} vê. A prévia ao lado já mostra como vai ficar.</p>
            </div>
          ) : (
            <>
              {projects.map((p) => (
                <section key={p.id} className="card pe-box">
                  <p className="pe-box-title">
                    <Icon name="layers" size={14} /> {p.title}
                  </p>
                  <div className="pe-row">
                    <label className="field">
                      <span className="field-label">entrega prevista</span>
                      <DateInput value={p.dueDate ?? ''} onChange={(e) => saveProject(p, { dueDate: e.target.value })} />
                    </label>
                    {p.deliveredDate && (
                      <label className="field">
                        <span className="field-label">entregue em</span>
                        <DateInput value={p.deliveredDate} onChange={(e) => e.target.value && saveProject(p, { deliveredDate: e.target.value })} />
                      </label>
                    )}
                    <label className="field">
                      <span className="field-label">link da pasta do projeto</span>
                      <input value={p.filesLink ?? ''} onChange={(e) => saveProject(p, { filesLink: e.target.value })} placeholder="Drive, Dropbox, WeTransfer…" />
                    </label>
                  </div>
                  <span className="field-label">etapas</span>
                  {(p.phases ?? []).length ? (
                    <ol className="pe-phases">
                      {(p.phases ?? []).map((x, i) => (
                        <li key={x.id} className={x.done ? 'is-done' : ''}>
                          <label className="pe-phase-check" title={x.done ? 'concluída' : 'marcar como concluída'}>
                            <input type="checkbox" checked={!!x.done} onChange={(e) => setPhase(p, i, { done: e.target.checked })} />
                          </label>
                          <input className="pe-phase-name" value={x.name} onChange={(e) => setPhase(p, i, { name: e.target.value })} aria-label="Nome da etapa" />
                          <input type="date" value={x.due ?? ''} onChange={(e) => setPhase(p, i, { due: e.target.value })} aria-label="Prazo da etapa" />
                          <input className="pe-phase-note" value={x.note ?? ''} onChange={(e) => setPhase(p, i, { note: e.target.value })} placeholder="recado desta etapa (o cliente vê)" aria-label="Recado da etapa" />
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted small">Sem cronograma ainda: o cliente vê as tarefas da demanda.</p>
                  )}
                  <button className="link small" onClick={() => saveProject(p, { phases: [...(p.phases ?? []), { id: crypto.randomUUID(), name: 'nova etapa' }] })}>
                    + etapa
                  </button>
                </section>
              ))}
              <section className="card pe-box">
                <p className="pe-box-title">
                  <Icon name="settings" size={14} /> o que aparece, links, arquivos e recado
                </p>
                <PanelControls client={c} open />
              </section>
            </>
          )}
        </div>
        <div className="pe-preview">
          <div className="pe-preview-bar">
            <span className="muted small">prévia ao vivo</span>
            <div className="segmented">
              <button className={width === 'pc' ? 'active' : ''} onClick={() => setWidth('pc')} type="button">
                <Icon name="monitor" size={13} /> computador
              </button>
              <button className={width === 'cel' ? 'active' : ''} onClick={() => setWidth('cel')} type="button">
                <Icon name="smartphone" size={13} /> celular
              </button>
            </div>
          </div>
          <div className={`pe-frame is-${width}`}>
            <ClientPanelPublic id={c.panel?.token ?? 'previa'} data={panelPayload(data, c, c.panel ?? { token: 'previa', enabled: false, showPayments: true, showVisits: true, showBriefings: true }, has)} preview />
          </div>
        </div>
      </div>
    </div>
  )
}
