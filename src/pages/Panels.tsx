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
import { fmtDate, whatsappLink } from '../utils'
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
    const { c, on, main, phase } = r
    const link = on && c.panel ? panelLink(userId, c.panel.token) : ''
    const info = main ? [main.title, main.deliveredDate ? 'entregue' : phase, !main.deliveredDate && main.dueDate ? `entrega ${fmtDate(main.dueDate)}` : ''].filter(Boolean).join(' · ') : 'sem demanda ainda'
    return (
      <li className={`pnl-row ${on ? 'is-on' : ''}`}>
        <span className="pnl-avatar">{(c.name || '?')[0].toUpperCase()}</span>
        <span className="pnl-main">
          <b>{c.name}</b>
          <small>{info}</small>
        </span>
        {on ? (
          <span className="pnl-acts">
            {c.phone && (
              <a className="btn small primary" href={whatsappLink(c.phone, panelMessage(c, link))} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" size={14} /> mandar link
              </a>
            )}
            <button className="icon-btn has-tip" data-tip="copiar link" aria-label="Copiar link" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copiado.'), () => toast(link))}>
              <Icon name="copy" size={15} />
            </button>
            <button className="icon-btn has-tip" data-tip="ver como o cliente vê" aria-label="Ver como o cliente vê" onClick={() => setPeek(c)}>
              <Icon name="eye" size={15} />
            </button>
            <button className="icon-btn has-tip" data-tip="o que aparece" aria-label="Escolher o que aparece" onClick={() => go('clientes', c.id)}>
              <Icon name="settings" size={15} />
            </button>
          </span>
        ) : (
          <span className="pnl-acts">
            <button className="btn small" disabled={busy === c.id} onClick={() => void create(c)}>
              <Icon name="link" size={14} /> {busy === c.id ? 'criando…' : 'criar painel'}
            </button>
          </span>
        )}
      </li>
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
              <ul className="pnl-rows card">
                {live.map((r) => (
                  <Row key={r.c.id} r={r} />
                ))}
              </ul>
            </section>
          )}
          {ready.length > 0 && (
            <section className="pnl-group">
              <p className="pnl-group-title">
                <i /> aprovaram, ainda sem painel <small>{ready.length}</small>
              </p>
              <ul className="pnl-rows card">
                {ready.map((r) => (
                  <Row key={r.c.id} r={r} />
                ))}
              </ul>
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
            <ul className="pnl-rows card">
              {rest.map((r) => (
                <Row key={r.c.id} r={r} />
              ))}
            </ul>
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
