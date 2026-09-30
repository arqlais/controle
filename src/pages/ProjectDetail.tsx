import { useState } from 'react'
import { useAccess } from '../access'
import { BillModal } from '../components/Bill'
import { DateInput } from '../components/DateInput'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { ProjectForm, EventForm } from '../components/forms'
import { ReceiptDoc } from '../components/Docs'
import { usePdf } from '../components/Print'
import { useKeep } from '../keep'
import { KIND_LABEL, projectKind } from '../processes'
import { LockButton, LockedView, TrialFeatureNote } from '../components/LockedPreview'
import { ClienteTab, CronogramaTab, LucroTab, ObraTab, PROJECT_TABS, ProjectTabs, usePortalSync, type ProjectTab } from '../components/Studio'
import { Badge, Empty, Field, Modal, MoneyInput, Progress, Section, Segmented, Stat } from '../components/ui'
import { askDelete, toast } from '../components/dialog'
import { MessagesButton } from '../components/Messages'
import { requestStatus } from '../components/quick'
import type { Client, Extra, Payment, Priority, Project, ProjectItem, ProjectStatus } from '../types'
import {
  EVENT_TYPES,
  paymentMethods,
  isCard,
  paymentFee,
  PRIORITY,
  statusInfo,
  allStatuses,
  daysUntil,
  fmtDate,
  isLate,
  isOpen,
  money,
  paymentState,
  projectOpen,
  projectPaid,
  projectTotal,
  relativeDays,
  today,
  templateText,
  payWhen,
  uid,
  addDays,
  daysBetween,
  splitPayments,
  urgency,
  whatsappLink,
  businessDaysUntil,
  packageSummary,
  pkgActive,
  pkgFull,
  withPackage,
  lower,
} from '../utils'

export default function ProjectDetail({ id }: { id: string }) {
  const { data, upsert, remove } = useStore()
  const p = data.projects.find((x) => x.id === id)
  const [edit, setEdit] = useState(false)
  const [newEvent, setNewEvent] = useState(false)
  const [newExtra, setNewExtra] = useState(false)
  const [bill, setBill] = useState(false)
  const hasPackage = (p?.items ?? []).length > 0
  const [task, setTask] = useState('')
  const pdf = usePdf()
  const { has } = useAccess()
  const canPdf = has('propostaPdf') // recibos em PDF: plano Completo
  // abas (visão geral + recursos do Estúdio); a última aberta fica guardada
  const [tab, setTab] = useKeep<ProjectTab>('demanda-aba', 'geral')
  usePortalSync(p, p ? data.clients.find((c) => c.id === p.clientId) : undefined)

  const duplicate = () => {
    if (!p) return
    const span = p.startDate && p.dueDate ? daysBetween(p.startDate, p.dueDate) : 10
    const total = projectTotal(p)
    const copy: Project = {
      ...p,
      id: uid(),
      title: `${p.title} (cópia)`,
      status: 'briefing',
      startDate: today(),
      dueDate: addDays(today(), Math.max(1, span)),
      deliveredDate: null,
      payments: total > 0 ? splitPayments(total, '50-50', today(), addDays(today(), Math.max(1, span))) : [],
      revisionsUsed: 0,
      timeLogs: [],
      timerStart: null,
      tasks: p.tasks.map((t) => ({ ...t, id: uid(), done: false })),
      notes: '',
      createdAt: today(),
    }
    upsert('projects', copy)
    go('projetos', copy.id)
    toast('Demanda duplicada. Ajuste nome, prazo e valor.')
  }

  if (!p) return <Empty title="Projeto não encontrado" action={<a className="btn" href={href('projetos')}>Voltar</a>} />

  const client = data.clients.find((c) => c.id === p.clientId)
  const service = data.settings.services.find((s) => s.id === p.service)
  const save = (patch: Partial<Project>) => upsert('projects', { ...p, ...patch })
  // cliente final: cronograma, obra, custos e página do cliente; freelancer e estudante: checklist simples
  const kind = projectKind(p, data)
  const setPayment = (pid: string, patch: Partial<Payment>) => save({ payments: p.payments.map((x) => (x.id === pid ? { ...x, ...patch } : x)) })

  const total = projectTotal(p)
  const paid = projectPaid(p)
  const u = urgency(p)
  const scheduled = p.payments.reduce((s, x) => s + x.amount, 0)
  const diff = Math.round((total - scheduled) * 100) / 100
  const done = p.tasks.filter((t) => t.done).length
  const events = data.events.filter((e) => e.projectId === p.id).sort((a, b) => a.date.localeCompare(b.date))
  const pending = p.payments.filter((x) => !x.paidDate)

  // usa a mensagem padrão de cobrança (Configurações → mensagens padrão)
  const chargeMsg = () =>
    templateText(data.settings, 'cobranca', 'Oi, {cliente}! Passando para lembrar da parcela "{parcela}" de {valor_parcela}. Chave pix: {pix}.', client, p)

  return (
    <div className="page">
      <a href={client ? href('clientes', client.id) : href('projetos')} className="back">
        <Icon name="chevronL" size={16} /> {client?.name ?? 'Demandas'}
      </a>
      <div className="page-head sticky-head">
        <div>
          <p className="eyebrow">
            {service?.name ?? 'Projeto'}
            {p.quantity > 0 && service ? ` · ${p.quantity} ${service.unit}${p.quantity > 1 ? 's' : ''}` : ''}
          </p>
          <h1>{p.title}</h1>
          <div className="row gap-s wrap detail-pills">
            <select className="pill-select" value={p.status} onChange={(e) => requestStatus(p, e.target.value as ProjectStatus, (next) => save(next))} style={{ color: statusInfo(p.status).color }}>
              {allStatuses().map((k) => (
              <option key={k} value={k}>
                {statusInfo(k).label}
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
        <div className="row gap-s wrap detail-actions">
          {isOpen(p) && (
            <button className="btn primary" onClick={() => requestStatus(p, 'entregue', (next) => save(next))}>
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
          <MessagesButton client={client} project={p} quote={data.quotes.find((q) => q.projectId === p.id)} />
          <button className="btn ghost hide-mobile" onClick={duplicate} title="Nova demanda igual a esta, para o mesmo cliente">
            <Icon name="copy" size={16} /> Duplicar
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
              <Progress value={paid} max={total} color="#4f6475" />
              <span>{projectOpen(p) > 0 ? `faltam ${money(projectOpen(p))}` : 'quitado'}</span>
            </>
          }
        />
        <Stat
          label="Prazo combinado"
          value={
            <DateInput
             
              className={`stat-date ${p.dueDate ? '' : 'is-empty'}`}
              value={p.dueDate}
              onChange={(e) => save({ dueDate: e.target.value })}
              aria-label="Prazo combinado com a cliente"
              title="Clique para definir ou mudar o prazo"
            />
          }
          icon="clock"
          tone={isLate(p) ? 'bad' : isOpen(p) && p.dueDate && daysUntil(p.dueDate) <= 2 ? 'warn' : undefined}
          sub={
            <>
              <span className={p.status === 'entregue' ? 'delivered-edit' : undefined}>
                {p.status === 'entregue' ? (
                  <>
                    entregue em{' '}
                    <DateInput className="stat-date-small" value={p.deliveredDate ?? ''} max={today()} onChange={(e) => e.target.value && save({ deliveredDate: e.target.value })} aria-label="Data em que foi entregue" title="Clique para corrigir a data de entrega" />
                  </>
                ) : p.dueDate
                    ? `${relativeDays(p.dueDate)}${p.dueDate > today() ? ` · ${businessDaysUntil(p.dueDate)} dias úteis` : ''}`
                    : 'sem prazo · clique na data para definir, se houver'}
              </span>
              {data.settings.calendarToken && isOpen(p) && (
                <button
                  type="button"
                  className={`phone-toggle ${p.noPhone ? 'off' : ''}`}
                  onClick={() => save({ noPhone: !p.noPhone })}
                  title={p.noPhone ? 'Mandar prazo e parcelas desta demanda para a agenda do celular' : 'Tirar esta demanda da agenda do celular'}
                >
                  <Icon name="smartphone" size={12} /> {p.noPhone ? 'fora da agenda do celular · incluir' : 'na agenda do celular · tirar'}
                </button>
              )}
            </>
          }
        />
        {p.phases?.length ? (
          // com cronograma (Estúdio), o cartão mostra as etapas do projeto
          <Stat
            label="Cronograma"
            value={`${p.phases.filter((x) => x.done).length}/${p.phases.length}`}
            icon="calendar"
            sub={
              <>
                <Progress value={p.phases.filter((x) => x.done).length} max={p.phases.length} />
                <span>{p.phases.find((x) => !x.done)?.name ?? 'tudo concluído'}</span>
              </>
            }
          />
        ) : (
          <Stat
            label="Etapas"
            value={`${done}/${p.tasks.length}`}
            icon="check"
            sub={
              <>
                <Progress value={done} max={p.tasks.length} />
                <span>{p.tasks.find((t) => !t.done)?.text ?? 'tudo concluído'}</span>
              </>
            }
          />
        )}
      </div>

      {kind === 'final' ? (
        <ProjectTabs tab={tab} onTab={setTab} p={p} />
      ) : (
        <p className="kind-note">
          <Icon name="layers" size={14} />
          <span>
            Demanda de <b>{KIND_LABEL[kind]}</b>: checklist simples, sem cronograma de obra.{' '}
            <button className="link" onClick={() => save({ kind: 'final' })}>
              é cliente final? usar cronograma, obra e página do cliente
            </button>
          </span>
        </p>
      )}
      {p.kind === 'final' && projectKind({ ...p, kind: undefined }, data) !== 'final' && (
        <button className="link small muted-link kind-undo" onClick={() => save({ kind: undefined })}>
          voltar para {KIND_LABEL[projectKind({ ...p, kind: undefined }, data)]} (esconder as abas)
        </button>
      )}
      {tab !== 'geral' && kind === 'final' && (() => {
        const t = PROJECT_TABS.find((x) => x.id === tab)
        const body = tab === 'cronograma' ? <CronogramaTab p={p} save={save} /> : tab === 'obra' ? <ObraTab p={p} save={save} client={client} /> : tab === 'lucro' ? <LucroTab p={p} save={save} /> : <ClienteTab p={p} save={save} client={client} />
        // do Estúdio e o plano não tem: mostra a aba de verdade, só para olhar
        if (t?.feature && !has(t.feature)) return <LockedView feature={t.feature}>{body}</LockedView>
        return t?.feature ? <TrialFeatureNote feature={t.feature}>{body}</TrialFeatureNote> : body
      })()}
      {(tab === 'geral' || kind !== 'final') && (
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
                {!canPdf && <LockButton feature="propostaPdf" label="Recibo" />}
                {canPdf && (
                  <button className="btn small ghost" onClick={() => setBill(true)} title="Recibo com o total, o que já foi pago e o que falta (PDF ou PNG)">
                    <Icon name="file" size={14} /> Recibo
                  </button>
                )}
                {!hasPackage && (
                  <button
                    className="btn small ghost"
                    title="Vários projetos fechados juntos, com desconto"
                    onClick={() => save(withPackage(p, [{ id: uid(), title: p.title, price: p.value }], p.discount))}
                  >
                    <Icon name="layers" size={14} /> Pacote
                  </button>
                )}
                <button className="btn small ghost" onClick={() => setNewExtra(true)} title="Cliente pediu algo a mais depois de fechar">
                  <Icon name="plus" size={14} /> Adicional
                </button>
                <button
                  className="btn small"
                  onClick={() =>
                    save({
                      payments: [
                        ...p.payments,
                        { id: uid(), description: `Parcela ${p.payments.length + 1}`, amount: Math.max(0, diff), dueDate: p.dueDate || '', paidDate: null, method: 'Pix', on: 'conclusao' },
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
                <table className="table compact pay-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th>Quando</th>
                      <th>Forma</th>
                      <th>Situação</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {p.payments.map((x) => {
                      const st = paymentState(x, p)
                      return (
                        <tr key={x.id}>
                          <td>
                            <input className="cell-input" value={x.description} onChange={(e) => setPayment(x.id, { description: e.target.value })} />
                          </td>
                          <td data-label="valor">
                            <MoneyInput value={x.amount} onChange={(n) => setPayment(x.id, { amount: n })} />
                          </td>
                          <td data-label={x.monthly ? 'vence em' : 'quando'}>
                            {x.monthly ? (
                              <DateInput className="cell-input" value={x.dueDate} onChange={(e) => setPayment(x.id, { dueDate: e.target.value || x.dueDate })} />
                            ) : (
                            <select className="cell-input" value={payWhen(x)} onChange={(e) => setPayment(x.id, { on: e.target.value as Payment['on'], dueDate: e.target.value === 'conclusao' ? p.dueDate || '' : x.dueDate || today() })}>
                              <option value="fechamento">fechamento</option>
                              <option value="conclusao">conclusão</option>
                            </select>
                            )}
                          </td>
                          <td data-label="forma">
                            <select className="cell-input" value={x.method} onChange={(e) => setPayment(x.id, { method: e.target.value })}>
                              {[...paymentMethods(data.settings), ...(paymentMethods(data.settings).includes(x.method) || !x.method ? [] : [x.method])].map((m) => (
                                <option key={m}>{m}</option>
                              ))}
                            </select>
                            {isCard(x.method) && x.amount > 0 && (
                              <small className="muted pay-fee" title="Taxa do cartão (Mercado Pago / maquininha): entra como despesa no mês em que o dinheiro cai">
                                taxa {money(paymentFee(x, data.settings))} · recebe {money(x.amount - paymentFee(x, data.settings))}
                              </small>
                            )}
                          </td>
                          <td data-label={x.paidDate ? 'pago em' : st === 'cobrar' ? 'já pode cobrar' : 'situação'} className={x.paidDate ? 'is-paid' : st === 'cobrar' ? 'is-due' : ''}>
                            {x.paidDate ? (
                              <DateInput className="cell-input small" value={x.paidDate} onChange={(e) => setPayment(x.id, { paidDate: e.target.value || null })} />
                            ) : (
                              <button className={`btn small ${st === 'cobrar' ? 'warn' : ''}`} title={st === 'cobrar' ? 'Já pode cobrar' : undefined} onClick={() => setPayment(x.id, { paidDate: today() })}>
                                Marcar pago
                              </button>
                            )}
                          </td>
                          <td className="actions nowrap">
                            {x.paidDate && canPdf && (
                              <button className="icon-btn" title="Gerar recibo" onClick={() => pdf.download(<ReceiptDoc s={data.settings} client={client} project={p} payment={x} />, `Recibo - ${p.title} - ${x.description}.pdf`)}>
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

          {hasPackage && <PackageSection p={p} client={client} save={(next) => upsert('projects', next)} />}

          {(p.extras ?? []).length > 0 && (
            <Section title="Serviços adicionais">
              <ul className="mini-list">
                {(p.extras ?? []).map((x) => {
                  const pay = p.payments.find((y) => y.id === x.paymentId)
                  return (
                    <li key={x.id}>
                      <div className="grow">
                        <div>
                          {x.title}
                          {x.quantity && x.unitPrice ? <span className="muted"> · {x.quantity} × {money(x.unitPrice)}</span> : null}
                        </div>
                        <div className="small muted">
                          {fmtDate(x.date)} · {x.mode === 'saldo' ? `somado a “${pay?.description ?? 'parcela'}”` : 'cobrado à parte'}
                          {pay?.paidDate ? ' · pago' : ''}
                        </div>
                      </div>
                      <b className="nowrap">+ {money(x.value)}</b>
                      <button className="icon-btn" title="Remover adicional" onClick={async () => (await askDelete(`o adicional "${x.title}" (o valor sai do total e da parcela)`)) && save(removeExtra(p, x))}>
                        <Icon name="trash" size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

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
            <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on"
              rows={4}
              value={p.description}
              onChange={(e) => save({ description: e.target.value })}
              placeholder="Ambientes, referências, câmeras, formato de entrega…"
            />
            <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on"
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
              if (await askDelete(`o projeto "${p.title}" (com pagamentos e etapas)`)) {
                remove('projects', p.id)
                go('projetos')
              }
            }}
          >
            <Icon name="trash" size={14} /> Excluir projeto
          </button>
        </div>
      </div>
      )}

      {bill && <BillModal p={p} onClose={() => setBill(false)} />}
      {edit && <ProjectForm initial={p} onClose={() => setEdit(false)} />}
      {newEvent && <EventFormForProject projectId={p.id} onClose={() => setNewEvent(false)} />}
      {newExtra && <ExtraForm p={p} onClose={() => setNewExtra(false)} onSave={(patch) => save(patch)} />}
      {pdf.portal}
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

/** Tira o adicional e desfaz o valor na parcela (remove a parcela se ela era só dele). */
function removeExtra(p: Project, x: Extra): Partial<Project> {
  const payments =
    x.mode === 'separado'
      ? p.payments.filter((y) => y.id !== x.paymentId || !!y.paidDate)
      : p.payments.map((y) => (y.id === x.paymentId && !y.paidDate ? { ...y, amount: Math.max(0, Math.round((y.amount - x.value) * 100) / 100) } : y))
  return { extras: (p.extras ?? []).filter((y) => y.id !== x.id), payments }
}

function ExtraForm({ p, onClose, onSave }: { p: Project; onClose: () => void; onSave: (patch: Partial<Project>) => void }) {
  const open = p.payments.find((y) => !y.paidDate)
  const [title, setTitle] = useState('')
  const [amount, setValue] = useState(0)
  const [byUnit, setByUnit] = useState(false)
  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState(0)
  const [mode, setMode] = useState<Extra['mode']>(open ? 'saldo' : 'separado')

  const submit = () => {
    const value = byUnit ? Math.round(qty * unit * 100) / 100 : amount
    if (!title.trim()) return toast('Descreva o que foi pedido a mais.')
    if (value <= 0) return toast('Informe o valor do adicional.')
    let payments = p.payments
    let paymentId: string
    if (mode === 'saldo' && open) {
      paymentId = open.id
      payments = p.payments.map((y) => (y.id === open.id ? { ...y, amount: Math.round((y.amount + value) * 100) / 100 } : y))
    } else {
      paymentId = uid()
      payments = [...p.payments, { id: paymentId, description: `Adicional · ${title.trim()}`, amount: value, dueDate: p.dueDate || '', paidDate: null, method: 'Pix', on: 'conclusao' }]
    }
    const extra: Extra = { id: uid(), date: today(), title: title.trim(), value, mode: mode === 'saldo' && open ? 'saldo' : 'separado', paymentId, ...(byUnit ? { quantity: qty, unitPrice: unit } : {}) }
    onSave({ extras: [...(p.extras ?? []), extra], payments })
    toast(`Adicional de ${money(value)} incluído${extra.mode === 'saldo' ? ` em “${open?.description}”` : ' como nova parcela'}.`)
    onClose()
  }

  return (
    <Modal
      title="Serviço adicional"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={submit}>Incluir adicional</button>
        </>
      }
    >
      <p className="small muted" style={{ marginBottom: 12 }}>Para quando o cliente pede algo a mais depois de fechado. O valor entra no total da demanda e no financeiro.</p>
      <div className="form-grid two">
        <Field label="O que foi pedido" span={2}>
          <input autoFocus spellCheck lang="pt-BR" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: +2 imagens da varanda" />
        </Field>
        {byUnit ? (
          <>
            <Field label="Quantidade">
              <input type="number" min={1} value={qty} onFocus={(e) => e.target.select()} onChange={(e) => setQty(Number(e.target.value) || 0)} />
            </Field>
            <Field label="Valor por unidade" hint={`${qty} × ${money(unit)} = ${money(qty * unit)}`}>
              <MoneyInput value={unit} onChange={setUnit} />
            </Field>
          </>
        ) : (
          <Field label="Valor">
            <MoneyInput value={amount} onChange={setValue} />
          </Field>
        )}
        <label className="check" style={{ gridColumn: '1 / -1' }}>
          <input type="checkbox" checked={byUnit} onChange={(e) => setByUnit(e.target.checked)} /> calcular por quantidade (ex.: 15 imagens × R$ 35,00)
        </label>
        <Field group label="Como cobrar" span={2} hint={mode === 'saldo' && open ? `“${open.description}” passa de ${money(open.amount)} para ${money(open.amount + (byUnit ? qty * unit : amount))}.` : 'Vira uma parcela nova, cobrada na conclusão.'}>
          <Segmented<Extra['mode']>
            value={open ? mode : 'separado'}
            onChange={setMode}
            options={[
              ...(open ? [{ value: 'saldo' as const, label: `Somar em ${lower(open.description)}` }] : []),
              { value: 'separado' as const, label: 'Cobrar à parte' },
            ]}
          />
        </Field>
      </div>
    </Modal>
  )
}

/** Pacote: vários projetos com um desconto. Retirar um item redistribui o desconto e recalcula o saldo. */
function PackageSection({ p, client, save }: { p: Project; client?: Client; save: (next: Project) => void }) {
  const items = p.items ?? []
  const disc = p.pkgDiscount ?? 0
  const full = pkgFull(p)
  const active = pkgActive(p)
  const apply = (next: ProjectItem[], d = disc) => save(withPackage(p, next, d))
  const setItem = (id: string, patch: Partial<ProjectItem>) => apply(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  // "cliente cancelou": pergunta a data (padrão hoje; ao corrigir, a data já registrada)
  const [cancel, setCancel] = useState<{ id: string; date: string; edit?: boolean } | null>(null)
  const cancelItem = cancel && items.find((i) => i.id === cancel.id)
  const pkgTotal = Math.max(0, p.value - p.discount)
  const paid = projectPaid(p)
  const summary = packageSummary(p)
  return (
    <Section
      title="Pacote"
      action={
        <div className="row gap-s">
          <button className="btn small ghost" onClick={() => navigator.clipboard?.writeText(summary).then(() => toast('Resumo copiado. É só colar no WhatsApp.'), () => toast('Não consegui copiar.'))} title="Copiar resumo para enviar ao cliente">
            <Icon name="copy" size={14} /> Copiar resumo
          </button>
          {client?.phone && (
            <a className="btn small ghost" href={whatsappLink(client.phone, summary)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={14} /> Enviar
            </a>
          )}
        </div>
      }
    >
      <div className="pkg-list">
        {items.map((i) => (
          <div key={i.id} className={`pkg-row ${i.removed ? 'is-removed' : ''}`}>
            <div className="pkg-title">
              <input className="cell-input" value={i.title} onChange={(e) => setItem(i.id, { title: e.target.value })} placeholder="Projeto" disabled={i.removed} />
              {i.removed && (
                <button className="pkg-cancel link" title="Cancelado pelo cliente: continua no histórico e no orçamento. Toque para mudar a data." onClick={() => setCancel({ id: i.id, date: i.removedAt || today(), edit: true })}>
                  cancelado{i.removedAt ? ` em ${fmtDate(i.removedAt)}` : ''}
                </button>
              )}
            </div>
            <div style={{ width: 140 }}>
              <MoneyInput value={i.price} onChange={(n) => setItem(i.id, { price: n })} />
            </div>
            <button className={`btn small ${i.removed ? '' : 'ghost'}`} onClick={() => (i.removed ? setItem(i.id, { removed: false, removedAt: undefined }) : setCancel({ id: i.id, date: today() }))} title={i.removed ? 'Voltar para o pacote (desfaz o cancelamento)' : 'Cliente cancelou este projeto: sai do valor, mas fica registrado'}>
              {i.removed ? 'voltar' : 'cliente cancelou'}
            </button>
            <button className="icon-btn" title="Apagar item (lançado por engano)" onClick={async () => (await askDelete(`o item "${i.title || 'sem nome'}"`)) && apply(items.filter((x) => x.id !== i.id))}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => apply([...items, { id: uid(), title: '', price: 0 }])}>
          <Icon name="plus" size={14} /> Projeto no pacote
        </button>
      </div>
      <div className="pkg-sum">
        <div>
          <span>soma dos projetos</span>
          <span>
            {active !== full && <s className="muted">{money(full)}</s>} {money(active)}
          </span>
        </div>
        <div>
          <span>desconto do pacote</span>
          <span className="row gap-s">
            <div style={{ width: 130 }}>
              <MoneyInput value={disc} onChange={(n) => apply(items, n)} />
            </div>
          </span>
        </div>
        {active !== full && (
          <div className="small muted">
            <span>desconto ajustado proporcionalmente</span>
            <span>− {money(p.discount)}</span>
          </div>
        )}
        <div className="pkg-total">
          <span>total do pacote</span>
          <b>{money(pkgTotal)}</b>
        </div>
        {paid > 0 && (
          <div className="small">
            <span>já pago {money(paid)} · saldo dos projetos</span>
            <b>{money(Math.max(0, pkgTotal - paid))}</b>
          </div>
        )}
      </div>
      {cancelItem && cancel && (
        <Modal
          title={cancel.edit ? 'data do cancelamento' : 'cliente cancelou'}
          onClose={() => setCancel(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setCancel(null)}>Voltar</button>
              <button
                className="btn primary"
                onClick={() => {
                  setItem(cancelItem.id, { removed: true, removedAt: cancel.date || today() })
                  setCancel(null)
                }}
              >
                {cancel.edit ? 'Salvar data' : 'Confirmar cancelamento'}
              </button>
            </>
          }
        >
          {!cancel.edit && (
            <p className="small muted" style={{ marginBottom: 12 }}>
              <b>{cancelItem.title || 'Este projeto'}</b> sai do valor do pacote, mas continua registrado no histórico e no orçamento. Dá para desfazer em “voltar”.
            </p>
          )}
          <Field label="Quando foi cancelado?">
            <DateInput value={cancel.date} max={today()} onChange={(e) => setCancel({ ...cancel, date: e.target.value })} />
          </Field>
        </Modal>
      )}
    </Section>
  )
}
