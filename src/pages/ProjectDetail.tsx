import { useState } from 'react'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { ProjectForm, EventForm } from '../components/forms'
import { ReceiptDoc } from '../components/Docs'
import { usePrint } from '../components/Print'
import { Badge, Empty, MoneyInput, Progress, Section, Stat } from '../components/ui'
import { askDelete } from '../components/dialog'
import type { Payment, Priority, Project, ProjectStatus } from '../types'
import {
  EVENT_TYPES,
  PAYMENT_METHODS,
  PRIORITY,
  STATUS,
  daysUntil,
  fmtDate,
  fmtDateLong,
  isLate,
  isOpen,
  money,
  paymentState,
  projectHours,
  projectOpen,
  projectPaid,
  projectTotal,
  relativeDays,
  today,
  uid,
  urgency,
  whatsappLink,
} from '../utils'

export default function ProjectDetail({ id }: { id: string }) {
  const { data, upsert, remove } = useStore()
  const p = data.projects.find((x) => x.id === id)
  const [edit, setEdit] = useState(false)
  const [newEvent, setNewEvent] = useState(false)
  const [task, setTask] = useState('')
  const [log, setLog] = useState({ date: today(), hours: 1, note: '' })
  const { print, portal } = usePrint()

  if (!p) return <Empty title="Projeto não encontrado" action={<a className="btn" href={href('projetos')}>Voltar</a>} />

  const client = data.clients.find((c) => c.id === p.clientId)
  const service = data.settings.services.find((s) => s.id === p.service)
  const save = (patch: Partial<Project>) => upsert('projects', { ...p, ...patch })
  const setPayment = (pid: string, patch: Partial<Payment>) => save({ payments: p.payments.map((x) => (x.id === pid ? { ...x, ...patch } : x)) })

  const total = projectTotal(p)
  const paid = projectPaid(p)
  const hours = projectHours(p)
  const u = urgency(p)
  const scheduled = p.payments.reduce((s, x) => s + x.amount, 0)
  const diff = Math.round((total - scheduled) * 100) / 100
  const done = p.tasks.filter((t) => t.done).length
  const events = data.events.filter((e) => e.projectId === p.id).sort((a, b) => a.date.localeCompare(b.date))
  const pending = p.payments.filter((x) => !x.paidDate)

  const chargeMsg = () => {
    const first = client?.name.split(' ')[0] ?? ''
    const next = pending[0]
    const pix = data.settings.pixKey ? ` Chave Pix: ${data.settings.pixKey}` : ''
    return `Oi, ${first}! Tudo bem? Passando pra lembrar da parcela "${next?.description}" do projeto ${p.title}, no valor de ${money(next?.amount ?? 0)}${next ? `, com vencimento em ${fmtDateLong(next.dueDate)}` : ''}.${pix} Obrigada!`
  }

  return (
    <div className="page">
      <a href={client ? href('clientes', client.id) : href('projetos')} className="back">
        <Icon name="chevronL" size={16} /> {client?.name ?? 'Demandas'}
      </a>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {service?.name ?? 'Projeto'}
            {p.quantity > 0 && service ? ` · ${p.quantity} ${service.unit}${p.quantity > 1 ? 's' : ''}` : ''}
          </p>
          <h1>{p.title}</h1>
          <div className="row gap-s wrap">
            <select className="pill-select" value={p.status} onChange={(e) => {
              const status = e.target.value as ProjectStatus
              save({ status, deliveredDate: status === 'entregue' ? p.deliveredDate ?? today() : null })
            }} style={{ color: STATUS[p.status].color }}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <select className="pill-select" value={p.priority} onChange={(e) => save({ priority: e.target.value as Priority })} style={{ color: PRIORITY[p.priority].color }}>
              {(Object.keys(PRIORITY) as Priority[]).map((k) => (
                <option key={k} value={k}>
                  Prioridade {PRIORITY[k].label.toLowerCase()}
                </option>
              ))}
            </select>
            {u.reason && <Badge color={PRIORITY[u.level].color} solid>{u.reason}</Badge>}
          </div>
        </div>
        <div className="row gap-s wrap">
          {isOpen(p) && (
            <button className="btn primary" onClick={() => save({ status: 'entregue', deliveredDate: today(), tasks: p.tasks.map((t) => ({ ...t, done: true })) })}>
              <Icon name="check" size={16} /> Marcar como entregue
            </button>
          )}
          {p.filesLink && (
            <a className="btn ghost" href={p.filesLink} target="_blank" rel="noreferrer">
              <Icon name="link" size={16} /> Arquivos
            </a>
          )}
          <button className="btn ghost" onClick={() => setEdit(true)}>
            <Icon name="edit" size={16} /> Editar
          </button>
        </div>
      </div>

      <div className="stats">
        <Stat label="Valor total" value={money(total)} sub={p.discount ? `desconto de ${money(p.discount)}` : undefined} icon="wallet" />
        <Stat
          label="Recebido"
          value={money(paid)}
          icon="check"
          tone={paid >= total && total > 0 ? 'good' : undefined}
          sub={
            <>
              <Progress value={paid} max={total} color="#2f855a" />
              <span>{projectOpen(p) > 0 ? `faltam ${money(projectOpen(p))}` : 'quitado'}</span>
            </>
          }
        />
        <Stat
          label="Prazo"
          value={fmtDate(p.dueDate)}
          icon="clock"
          tone={isLate(p) ? 'bad' : isOpen(p) && p.dueDate && daysUntil(p.dueDate) <= 2 ? 'warn' : undefined}
          sub={p.status === 'entregue' ? `entregue em ${fmtDate(p.deliveredDate)}` : p.dueDate ? relativeDays(p.dueDate) : 'sem prazo'}
        />
        <Stat
          label="Horas"
          value={`${hours}h${p.estimatedHours ? ` / ${p.estimatedHours}h` : ''}`}
          icon="target"
          tone={p.estimatedHours && hours > p.estimatedHours ? 'warn' : undefined}
          sub={hours ? `${money(total / hours)}/hora (meta ${money(data.settings.hourlyTarget)})` : 'lance suas horas abaixo'}
        />
      </div>

      <div className="grid-2 wide-left">
        <div className="stack">
          <Section
            title="Pagamentos"
            action={
              <div className="row gap-s">
                {pending.length > 0 && client?.phone && (
                  <a className="btn small ghost" href={whatsappLink(client.phone, chargeMsg())} target="_blank" rel="noreferrer">
                    <Icon name="whatsapp" size={14} /> Cobrar
                  </a>
                )}
                <button
                  className="btn small"
                  onClick={() =>
                    save({
                      payments: [
                        ...p.payments,
                        { id: uid(), description: `Parcela ${p.payments.length + 1}`, amount: Math.max(0, diff), dueDate: p.dueDate || today(), paidDate: null, method: 'Pix' },
                      ],
                    })
                  }
                >
                  <Icon name="plus" size={14} /> Parcela
                </button>
              </div>
            }
          >
            {p.payments.length === 0 ? (
              <p className="muted small">Nenhuma parcela. Adicione ou edite o projeto para gerar automaticamente.</p>
            ) : (
              <div className="table-wrap">
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th>Vencimento</th>
                      <th>Forma</th>
                      <th>Situação</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {p.payments.map((x) => {
                      const st = paymentState(x)
                      return (
                        <tr key={x.id}>
                          <td>
                            <input className="cell-input" value={x.description} onChange={(e) => setPayment(x.id, { description: e.target.value })} />
                          </td>
                          <td style={{ minWidth: 120 }}>
                            <MoneyInput value={x.amount} onChange={(n) => setPayment(x.id, { amount: n })} />
                          </td>
                          <td>
                            <input className="cell-input" type="date" value={x.dueDate} onChange={(e) => setPayment(x.id, { dueDate: e.target.value })} />
                          </td>
                          <td>
                            <select className="cell-input" value={x.method} onChange={(e) => setPayment(x.id, { method: e.target.value })}>
                              {PAYMENT_METHODS.map((m) => (
                                <option key={m}>{m}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {x.paidDate ? (
                              <div className="row gap-s nowrap">
                                <span className="pill pill-pago">pago</span>
                                <input className="cell-input small" type="date" value={x.paidDate} onChange={(e) => setPayment(x.id, { paidDate: e.target.value || null })} />
                              </div>
                            ) : (
                              <button className={`btn small ${st === 'vencido' ? 'danger' : ''}`} onClick={() => setPayment(x.id, { paidDate: today() })}>
                                {st === 'vencido' ? 'Vencido · ' : ''}Marcar pago
                              </button>
                            )}
                          </td>
                          <td className="actions nowrap">
                            {x.paidDate && (
                              <button className="icon-btn" title="Gerar recibo" onClick={() => print(<ReceiptDoc s={data.settings} client={client} project={p} payment={x} />)}>
                                <Icon name="printer" size={16} />
                              </button>
                            )}
                            {x.paidDate && (
                              <button className="icon-btn" title="Desfazer pagamento" onClick={() => setPayment(x.id, { paidDate: null })}>
                                <Icon name="x" size={16} />
                              </button>
                            )}
                            <button className="icon-btn" title="Excluir parcela" onClick={async () => (await askDelete(`a parcela "${x.description}"`)) && save({ payments: p.payments.filter((y) => y.id !== x.id) })}>
                              <Icon name="trash" size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {p.payments.length > 0 && diff !== 0 && (
              <p className="small text-warn">
                <Icon name="alert" size={14} /> As parcelas somam {money(scheduled)}, mas o total do projeto é {money(total)} ({diff > 0 ? 'faltam' : 'sobram'} {money(Math.abs(diff))}).
              </p>
            )}
          </Section>

          <Section title={`Etapas · ${done}/${p.tasks.length}`}>
            {p.tasks.length > 0 && <Progress value={done} max={p.tasks.length} />}
            <ul className="checklist">
              {p.tasks.map((t) => (
                <li key={t.id} className={t.done ? 'done' : ''}>
                  <label>
                    <input type="checkbox" checked={t.done} onChange={() => save({ tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) })} />
                    <span>{t.text}</span>
                  </label>
                  <button className="icon-btn subtle" onClick={() => save({ tasks: p.tasks.filter((x) => x.id !== t.id) })} aria-label="Remover etapa">
                    <Icon name="x" size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="row gap-s"
              onSubmit={(e) => {
                e.preventDefault()
                if (!task.trim()) return
                save({ tasks: [...p.tasks, { id: uid(), text: task.trim(), done: false }] })
                setTask('')
              }}
            >
              <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="Adicionar etapa…" />
              <button className="btn small">Adicionar</button>
            </form>
          </Section>

          <Section title="Briefing e anotações">
            <textarea
              rows={4}
              value={p.description}
              onChange={(e) => save({ description: e.target.value })}
              placeholder="Ambientes, referências, câmeras, formato de entrega…"
            />
            <textarea
              rows={3}
              value={p.notes}
              onChange={(e) => save({ notes: e.target.value })}
              placeholder="Anotações internas, feedbacks do cliente, ajustes pedidos…"
            />
          </Section>
        </div>

        <div className="stack">
          <Section title="Revisões">
            <div className="revisions">
              <button className="icon-btn" onClick={() => save({ revisionsUsed: Math.max(0, p.revisionsUsed - 1) })} aria-label="Menos">
                −
              </button>
              <div>
                <b className={p.revisionsUsed > p.revisionsIncluded ? 'text-bad' : ''}>{p.revisionsUsed}</b>
                <span className="muted"> de {p.revisionsIncluded} incluídas</span>
              </div>
              <button className="icon-btn" onClick={() => save({ revisionsUsed: p.revisionsUsed + 1 })} aria-label="Mais">
                +
              </button>
            </div>
            {p.revisionsUsed >= p.revisionsIncluded && isOpen(p) && (
              <p className="small text-warn">
                {p.revisionsUsed > p.revisionsIncluded
                  ? `${p.revisionsUsed - p.revisionsIncluded} revisão(ões) extra(s) — considere cobrar à parte.`
                  : 'Revisões inclusas esgotadas. Próximos ajustes podem ser cobrados.'}
              </p>
            )}
          </Section>

          <Section title="Horas trabalhadas">
            <form
              className="hours-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!log.hours) return
                save({ timeLogs: [...p.timeLogs, { id: uid(), ...log }] })
                setLog({ date: today(), hours: 1, note: '' })
              }}
            >
              <input type="date" value={log.date} onChange={(e) => setLog({ ...log, date: e.target.value })} />
              <input type="number" step={0.25} min={0} value={log.hours} onChange={(e) => setLog({ ...log, hours: Number(e.target.value) })} aria-label="Horas" />
              <input value={log.note} onChange={(e) => setLog({ ...log, note: e.target.value })} placeholder="O que foi feito" />
              <button className="btn small">Lançar</button>
            </form>
            <ul className="mini-list">
              {[...p.timeLogs].reverse().map((t) => (
                <li key={t.id}>
                  <span className="muted nowrap">{fmtDate(t.date)}</span>
                  <span className="grow">{t.note || '—'}</span>
                  <b className="nowrap">{t.hours}h</b>
                  <button className="icon-btn subtle" onClick={() => save({ timeLogs: p.timeLogs.filter((x) => x.id !== t.id) })} aria-label="Remover">
                    <Icon name="x" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Compromissos"
            action={
              <button className="btn small ghost" onClick={() => setNewEvent(true)}>
                <Icon name="plus" size={14} />
              </button>
            }
          >
            {events.length === 0 ? (
              <p className="muted small">Reuniões, entregas parciais… aparecem na agenda.</p>
            ) : (
              <ul className="mini-list">
                {events.map((e) => (
                  <li key={e.id}>
                    <span className="dot" style={{ background: EVENT_TYPES[e.type].color }} />
                    <span className="grow">{e.title}</span>
                    <span className="muted nowrap">
                      {fmtDate(e.date)} {e.time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Cliente">
            {client ? (
              <div className="stack-s">
                <a href={href('clientes', client.id)} className="list-title">
                  {client.name}
                </a>
                <span className="muted small">{client.company}</span>
                <div className="row gap-s">
                  {client.phone && (
                    <a className="btn small ghost" href={whatsappLink(client.phone)} target="_blank" rel="noreferrer">
                      <Icon name="whatsapp" size={14} /> WhatsApp
                    </a>
                  )}
                  {client.email && (
                    <a className="btn small ghost" href={`mailto:${client.email}?subject=${encodeURIComponent(p.title)}`}>
                      <Icon name="mail" size={14} /> E-mail
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="muted">—</p>
            )}
          </Section>

          <button
            className="btn ghost danger small"
            onClick={async () => {
              if (await askDelete(`o projeto "${p.title}" (com pagamentos e horas)`)) {
                remove('projects', p.id)
                go('projetos')
              }
            }}
          >
            <Icon name="trash" size={14} /> Excluir projeto
          </button>
        </div>
      </div>

      {edit && <ProjectForm initial={p} onClose={() => setEdit(false)} />}
      {newEvent && <EventFormForProject projectId={p.id} onClose={() => setNewEvent(false)} />}
      {portal}
    </div>
  )
}

function EventFormForProject({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  return (
    <EventForm
      initial={{ id: uid(), title: '', date: today(), time: '', type: 'reuniao', projectId, notes: '', done: false }}
      isNew
      onClose={onClose}
    />
  )
}
