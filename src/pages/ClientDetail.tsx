import { Fragment, useState } from 'react'
import { DateInput } from '../components/DateInput'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { ClientForm, ProjectForm } from '../components/forms'
import { Badge, Empty, Section, Stat, usePaged } from '../components/ui'
import type { Client, ClientProfile } from '../types'
import { BriefingSection } from '../components/Briefing'
import { SavedDocs } from '../components/SavedDocs'
import { askDelete } from '../components/dialog'
import { MessagesButton } from '../components/Messages'
import { MergeClients } from '../components/MergeClients'
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
  formatPhone,
  showDoc,
} from '../utils'

export default function ClientDetail({ id }: { id: string }) {
  const { data, upsert, remove } = useStore()
  const c = data.clients.find((x) => x.id === id)
  const [edit, setEdit] = useState(false)
  const [merge, setMerge] = useState(false)
  const [newProject, setNewProject] = useState(false)
  const projects = data.projects.filter((p) => p.clientId === id).sort((a, b) => b.startDate.localeCompare(a.startDate))
  const pagedProjects = usePaged(projects, 10, 'cliente-projetos')

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
      <div className="page-head sticky-head">
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
                      {/* etapas: o cronograma (cliente final) ou o checklist da demanda */}
                      {p.phases?.length ? (
                        <div className="cd-phases" aria-label="etapas do projeto">
                          {p.phases.map((x) => (
                            <span key={x.id} className={x.done ? 'is-done' : x === p.phases!.find((y) => !y.done) ? 'is-now' : ''} title={x.name}>
                              {x.name}
                            </span>
                          ))}
                        </div>
                      ) : p.tasks.length ? (
                        <div className="list-sub">
                          etapas {p.tasks.filter((t) => t.done).length}/{p.tasks.length}
                          {p.tasks.find((t) => !t.done) ? ` · agora: ${p.tasks.find((t) => !t.done)!.text}` : ' · tudo feito'}
                        </div>
                      ) : null}
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
              <dd>{c.phone ? formatPhone(c.phone) : '—'}</dd>
              <dt>E-mail</dt>
              <dd>{c.email || '—'}</dd>
              <dt>Instagram</dt>
              <dd>{c.instagram || '—'}</dd>
              <dt>CPF</dt>
              <dd>{c.document ? showDoc(c.document) : '—'}</dd>
              {(c.companyDoc || c.companyLegal) && (
                <>
                  <dt>Empresa</dt>
                  <dd>{[c.companyLegal, c.companyKind && c.companyKind !== 'outra' ? c.companyKind : '', c.companyDoc ? `CNPJ ${showDoc(c.companyDoc)}` : ''].filter(Boolean).join(' · ')}</dd>
                </>
              )}
              {(c.address || c.cep || c.city) && (
                <>
                  <dt>Endereço</dt>
                  <dd>{[[c.address, c.addressNumber].filter(Boolean).join(', '), c.city, c.cep].filter(Boolean).join(' · ')}</dd>
                </>
              )}
              <dt>Origem</dt>
              <dd>{c.origin || '—'}</dd>
            </dl>
            {c.notes && <p className="notes">{c.notes}</p>}
          </Section>

          {c.type === 'final' && <FinalProfileCard client={c} onEdit={() => setEdit(true)} />}
          {(c.type === 'final' || (data.briefings ?? []).some((b) => b.clientId === c.id)) && <BriefingSection client={c} />}
          <SavedDocs list={(data.docs ?? []).filter((d) => d.clientId === c.id)} />

          <Section title="Pagamentos">
            {payments.length === 0 ? (
              <p className="muted small">Sem pagamentos.</p>
            ) : (
              <ul className="mini-list">
                {payments.slice(0, 10).map(({ pay, p }) => {
                  const st = paymentState(pay, p)
                  return (
                    <li key={pay.id}>
                      <span className={`pill pill-${st}`}>{st === 'cobrar' ? 'a cobrar' : st}</span>
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

          <div className="row gap-s wrap">
            <button className="btn ghost small" onClick={() => upsert('clients', { ...c, archived: !c.archived })}>
              {c.archived ? 'Desarquivar' : 'Arquivar cliente'}
            </button>
            <button className="btn ghost small" onClick={() => setMerge(true)}>
              Juntar com outro cadastro
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
      {merge && <MergeClients keep={c} onClose={() => setMerge(false)} />}
      {newProject && <ProjectForm clientId={c.id} onClose={() => setNewProject(false)} onSaved={(p) => go('projetos', p.id)} />}
    </div>
  )
}

function ClientHistory({ client }: { client: Client }) {
  const { upsert } = useStore()
  const [text, setText] = useState('')
  const [date, setDate] = useState(today())
  const notes = [...client.history].sort((a, b) => b.date.localeCompare(a.date))
  const { visible, more } = usePaged(notes, 8, 'cliente-notas')
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
        <DateInput id="history-date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
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

const PROFILE_ROWS: [keyof ClientProfile, string][] = [
  ['profession', 'Profissão'],
  ['marital', 'Estado civil'],
  ['birthDate', 'Nascimento'],
  ['household', 'Quem mora'],
  ['kids', 'Filhos'],
  ['pets', 'Pets'],
  ['routine', 'Rotina'],
  ['style', 'Estilo'],
  ['propertyType', 'Imóvel'],
  ['propertyOwnership', 'Posse'],
  ['propertyArea', 'Metragem'],
  ['propertyAddress', 'Endereço da obra'],
  ['investment', 'Investimento'],
  ['deadline', 'Prazo desejado'],
]

/** Ficha do cliente final: só o que já foi preenchido (na mão ou pelo briefing). */
function FinalProfileCard({ client, onEdit }: { client: Client; onEdit: () => void }) {
  const p = client.profile ?? {}
  const rows = PROFILE_ROWS.filter(([k]) => (p[k] ?? '').trim())
  const show = (k: keyof ClientProfile, v: string) => (k === 'birthDate' ? fmtDate(v) : k === 'propertyArea' && /^\d+([.,]\d+)?$/.test(v) ? `${v} m²` : v)
  return (
    <Section
      title="sobre o cliente"
      action={
        <button className="btn small ghost" onClick={onEdit}>
          <Icon name="edit" size={14} /> completar
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="muted small">Profissão, família, rotina, imóvel e investimento: preencha em “completar” ou mande o briefing para o cliente responder.</p>
      ) : (
        <dl className="info">
          {rows.map(([k, label]) => (
            <Fragment key={k}>
              <dt>{label}</dt>
              <dd>{show(k, p[k] ?? '')}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </Section>
  )
}
