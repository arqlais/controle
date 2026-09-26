import { useState } from 'react'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { ClientForm, ProjectForm } from '../components/forms'
import { Badge, Empty, Section, Stat, usePaged } from '../components/ui'
import type { Client } from '../types'
import { askDelete } from '../components/dialog'
import { MessagesButton } from '../components/Messages'
import { PayNext, QuoteStatusSelect, StatusSelect } from '../components/quick'
import {
  CLIENT_COLORS,
  CLIENT_TYPES,
  statusInfo,
  fmtDate,
  fmtDateLong,
  instagramLink,
  isOpen,
  money,
  paymentState,
  projectOpen,
  projectPaid,
  projectTotal,
  quoteDeal,
  sum,
  today,
  uid,
  whatsappLink,
} from '../utils'

export default function ClientDetail({ id }: { id: string }) {
  const { data, upsert, remove } = useStore()
  const c = data.clients.find((x) => x.id === id)
  const [edit, setEdit] = useState(false)
  const [newProject, setNewProject] = useState(false)
  const projects = data.projects.filter((p) => p.clientId === id).sort((a, b) => b.startDate.localeCompare(a.startDate))
  const pagedProjects = usePaged(projects, 10)

  if (!c) return <Empty title="Cliente não encontrado" action={<a className="btn" href={href('clientes')}>Voltar</a>} />

  const valid = projects.filter((p) => p.status !== 'cancelado')
  const paid = sum(valid, projectPaid)
  const open = sum(valid, projectOpen)
  const ticket = valid.length ? sum(valid, projectTotal) / valid.length : 0
  const quotes = data.quotes.filter((q) => q.clientId === id)
  const payments = valid.flatMap((p) => p.payments.map((pay) => ({ pay, p }))).sort((a, b) => b.pay.dueDate.localeCompare(a.pay.dueDate))

  return (
    <div className="page">
      <a href={href('clientes')} className="back">
        <Icon name="chevronL" size={16} /> Clientes
      </a>
      <div className="page-head">
        <div className="client-cell big">
          <span className="avatar lg" style={{ background: `${CLIENT_COLORS[c.type]}1f`, color: CLIENT_COLORS[c.type] }}>{c.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <h1>
              {c.name}{' '}
              <button className={`star-btn ${c.favorite ? 'on' : ''}`} onClick={() => upsert('clients', { ...c, favorite: !c.favorite })} title="Favorito">
                ★
              </button>
            </h1>
            <div className="row gap-s wrap">
              <Badge color={CLIENT_COLORS[c.type]}>{CLIENT_TYPES[c.type]}</Badge>
              {c.company && <span className="muted">{c.company}</span>}
              {c.city && <span className="muted">· {c.city}</span>}
              {c.archived && <Badge color="#8a8f98">Arquivado</Badge>}
            </div>
          </div>
        </div>
        <div className="row gap-s wrap">
          {c.phone && (
            <a className="btn ghost" href={whatsappLink(c.phone, `Olá, ${c.name.split(' ')[0]}! `)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={16} /> WhatsApp
            </a>
          )}
          {c.email && (
            <a className="btn ghost" href={`mailto:${c.email}`}>
              <Icon name="mail" size={16} /> E-mail
            </a>
          )}
          {c.instagram && (
            <a className="btn ghost" href={instagramLink(c.instagram)} target="_blank" rel="noreferrer">
              <Icon name="instagram" size={16} />
            </a>
          )}
          <button className="btn ghost" onClick={() => setEdit(true)}>
            <Icon name="edit" size={16} /> Editar
          </button>
          <MessagesButton client={c} project={projects.find(isOpen) ?? projects[0]} quote={quotes.find((q) => q.status === 'enviado' || q.status === 'rascunho')} />
        </div>
      </div>

      <div className="stats">
        <Stat label="Total recebido" value={money(paid)} icon="wallet" />
        <Stat label="Em aberto" value={money(open)} icon="clock" tone={open > 0 ? 'warn' : undefined} />
        <Stat label="Projetos" value={valid.length} sub={`${valid.filter(isOpen).length} em andamento`} icon="folder" />
        <Stat label="Ticket médio" value={money(ticket)} sub={`cliente desde ${fmtDateLong(c.createdAt)}`} icon="trend" />
      </div>

      <div className="grid-2 wide-left">
        <div className="stack">
        <Section
          title="Projetos"
          action={
            <button className="btn small" onClick={() => setNewProject(true)}>
              <Icon name="plus" size={14} /> Nova demanda
            </button>
          }
        >
          {projects.length === 0 ? (
            <Empty title="Nenhum projeto ainda" />
          ) : (
            <ul className="list">
              {pagedProjects.visible.map((p) => (
                <li key={p.id}>
                  <a className="list-item" href={href('projetos', p.id)}>
                    <span className="prio-bar" style={{ background: statusInfo(p.status).color }} />
                    <div className="grow">
                      <div className="list-title">{p.title}</div>
                      <div className="list-sub">
                        {fmtDate(p.startDate)} → {fmtDate(p.dueDate)}
                      </div>
                    </div>
                    <div className="right">
                      <b>{money(projectTotal(p))}</b>
                      <div className="list-sub">{projectOpen(p) > 0 ? `falta ${money(projectOpen(p))}` : 'quitado'}</div>
                    </div>
                  </a>
                  <div className="quick-row">
                    <StatusSelect p={p} />
                    <PayNext p={p} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pagedProjects.more}
        </Section>
        <ClientHistory client={c} />
        </div>

        <div className="stack">
          <Section title="Contato">
            <dl className="info">
              <dt>WhatsApp</dt>
              <dd>{c.phone || '—'}</dd>
              <dt>E-mail</dt>
              <dd>{c.email || '—'}</dd>
              <dt>Instagram</dt>
              <dd>{c.instagram || '—'}</dd>
              <dt>CPF/CNPJ</dt>
              <dd>{c.document || '—'}</dd>
              <dt>Origem</dt>
              <dd>{c.origin || '—'}</dd>
            </dl>
            {c.notes && <p className="notes">{c.notes}</p>}
          </Section>

          <Section title="Pagamentos">
            {payments.length === 0 ? (
              <p className="muted small">Sem pagamentos.</p>
            ) : (
              <ul className="mini-list">
                {payments.slice(0, 10).map(({ pay, p }) => {
                  const st = paymentState(pay)
                  return (
                    <li key={pay.id}>
                      <span className={`pill pill-${st}`}>{st}</span>
                      <span className="grow">
                        {pay.description}
                        <span className="muted small"> · {p.title}</span>
                      </span>
                      <span className="nowrap">{money(pay.amount)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          {quotes.length > 0 && (
            <Section title="Orçamentos">
              <ul className="mini-list">
                {quotes.map((q) => (
                  <li key={q.id}>
                    <a href={href('orcamentos', q.id)} className="grow">
                      #{q.number} {q.title}
                    </a>
                    <QuoteStatusSelect q={q} />
                    <span className="nowrap">{money(quoteDeal(q, data.settings.urgencyFee))}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="row gap-s">
            <button className="btn ghost small" onClick={() => upsert('clients', { ...c, archived: !c.archived })}>
              {c.archived ? 'Desarquivar' : 'Arquivar cliente'}
            </button>
            <button
              className="btn ghost danger small"
              onClick={async () => {
                if (await askDelete(`o cliente "${c.name}" e todos os ${projects.length} projeto(s) dele`)) {
                  remove('clients', c.id)
                  go('clientes')
                }
              }}
            >
              Excluir
            </button>
          </div>
        </div>
      </div>

      {edit && <ClientForm initial={c} onClose={() => setEdit(false)} />}
      {newProject && <ProjectForm clientId={c.id} onClose={() => setNewProject(false)} onSaved={(p) => go('projetos', p.id)} />}
    </div>
  )
}

function ClientHistory({ client }: { client: Client }) {
  const { upsert } = useStore()
  const [text, setText] = useState('')
  const [date, setDate] = useState(today())
  const notes = [...client.history].sort((a, b) => b.date.localeCompare(a.date))
  const { visible, more } = usePaged(notes, 8)
  return (
    <Section title="histórico de conversas">
      <form
        className="history-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          upsert('clients', { ...client, history: [...client.history, { id: uid(), date, text: text.trim() }] })
          setText('')
          setDate(today())
        }}
      >
        <input id="history-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
        <input id="history-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: enviei a prévia; pediu troca do piso da sala" spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" />
        <button className="btn small">anotar</button>
      </form>
      {notes.length === 0 ? (
        <p className="muted small">Registre combinados, pedidos e preferências — tudo fica aqui com data, para não se perder no WhatsApp.</p>
      ) : (
        <ul className="history">
          {visible.map((n) => (
            <li key={n.id}>
              <span className="history-date">{fmtDate(n.date)}</span>
              <p className="grow">{n.text}</p>
              <button
                className="icon-btn subtle"
                aria-label="Apagar anotação"
                onClick={() => upsert('clients', { ...client, history: client.history.filter((x) => x.id !== n.id) })}
              >
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {more}
    </Section>
  )
}
