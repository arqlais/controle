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
  const [peek, setPeek] = useState<Client | null>(null)
  const [busy, setBusy] = useState('')
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.clients
      .filter((c) => !c.archived && (!t || c.name.toLowerCase().includes(t)))
      .map((c) => {
        const projects = data.projects.filter((p) => p.clientId === c.id)
        const open = projects.filter((p) => !p.deliveredDate)
        return { c, on: !!c.panel?.enabled, projects: projects.length, open: open.length, contracts: (data.contracts ?? []).filter((k) => k.clientId === c.id).length, final: c.type === 'final' }
      })
      // no ar primeiro; depois cliente final com demanda em andamento; depois o resto
      .sort((a, b) => Number(b.on) - Number(a.on) || Number(b.final && b.open > 0) - Number(a.final && a.open > 0) || a.c.name.localeCompare(b.c.name))
  }, [data, q])
  const onCount = rows.filter((r) => r.on).length

  const create = async (c: Client) => {
    setBusy(c.id)
    await createPanel(data, c, has, userId, upsert)
    setBusy('')
    toast(`Painel de ${c.name.split(' ')[0]} no ar. Agora é só mandar o link.`)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">clientes</p>
          <h1>
            painel <em>do cliente</em>
          </h1>
          <p className="muted">Um link só de cada cliente, sem senha: etapas, prazos, pagamentos, contratos para assinar, briefings e documentos. Atualiza sozinho quando você muda algo.</p>
        </div>
      </div>

      <div className="pnl-top">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar cliente…" aria-label="Buscar cliente" />
        <span className="muted small">
          {onCount} {onCount === 1 ? 'painel no ar' : 'painéis no ar'} · {rows.length} {rows.length === 1 ? 'cliente' : 'clientes'}
        </span>
      </div>

      {!rows.length ? (
        <Empty icon="users" title="nenhum cliente ainda" text="Cadastre um cliente para criar o painel dele." />
      ) : (
        <div className="pnl-list">
          {rows.map(({ c, on, projects, open, contracts }) => {
            const link = on && c.panel ? panelLink(userId, c.panel.token) : ''
            return (
              <article key={c.id} className={`card pnl-card ${on ? 'is-on' : ''}`}>
                <header className="pnl-head">
                  <span className="pnl-avatar">{(c.name || '?')[0].toUpperCase()}</span>
                  <span className="grow">
                    <b>{c.name}</b>
                    <small className="muted">
                      {projects} {projects === 1 ? 'demanda' : 'demandas'}
                      {open ? ` · ${open} em andamento` : ''}
                      {contracts ? ` · ${contracts} ${contracts === 1 ? 'contrato' : 'contratos'}` : ''}
                    </small>
                  </span>
                  <span className={`pnl-state ${on ? 'is-on' : ''}`}>
                    <i /> {on ? 'no ar' : 'sem painel'}
                  </span>
                </header>
                {on && c.panel?.publishedAt && <p className="muted small pnl-when">no ar desde {fmtDate(c.panel.publishedAt.slice(0, 10))}</p>}
                <div className="pnl-actions">
                  {on ? (
                    <>
                      <button className="btn small" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copiado.'), () => toast(link))}>
                        <Icon name="copy" size={14} /> copiar link
                      </button>
                      {c.phone && (
                        <a className="btn small primary" href={whatsappLink(c.phone, panelMessage(c, link))} target="_blank" rel="noreferrer">
                          <Icon name="whatsapp" size={14} /> mandar
                        </a>
                      )}
                      <button className="btn small ghost" onClick={() => setPeek(c)}>
                        <Icon name="eye" size={14} /> ver como o cliente vê
                      </button>
                    </>
                  ) : (
                    <button className="btn small primary" disabled={busy === c.id} onClick={() => void create(c)}>
                      <Icon name="link" size={14} /> {busy === c.id ? 'criando…' : 'criar o painel'}
                    </button>
                  )}
                  <button className="btn small ghost" onClick={() => go('clientes', c.id)} title="Escolher o que o cliente vê, enviar arquivos e o recado">
                    <Icon name="settings" size={14} /> o que aparece
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

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
