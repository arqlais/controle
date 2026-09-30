import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useAccess } from '../access'
import { Icon } from '../components/Icon'
import { Empty, Modal } from '../components/ui'
import { toast } from '../components/dialog'
import { ClientPanelPublic } from '../components/ClientPanelPublic'
import { createPanel, panelMessage } from '../components/ClientPanel'
import { panelLink, panelPayload } from '../clientPanel'
import { go } from '../router'
import { fmtDate, money, projectPaid, projectTotal, statusInfo, whatsappLink } from '../utils'
import type { Client } from '../types'

/* Painel do cliente: todos os clientes num lugar só. Ver quem já tem painel no ar, copiar ou mandar o link,
   ver como o cliente vê e criar o painel de quem ainda não tem, sem precisar abrir a ficha. */

export default function Panels() {
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
              <span>entrega</span>
              <b>{main.deliveredDate ? fmtDate(main.deliveredDate) : main.dueDate ? fmtDate(main.dueDate) : 'a combinar'}</b>
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
              <button className="pnl-btn is-main" onClick={() => setPeek(c)}>
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
          <button className="pnl-btn" onClick={() => go('clientes', c.id)} title="Escolher o que o cliente vê, enviar arquivos e o recado">
            <Icon name="settings" size={14} /> o que aparece
          </button>
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
