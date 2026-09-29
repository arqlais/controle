import { draftRenumber, nextSentNumber } from '../numbering'
import { useState } from 'react'
import { DateInput } from './DateInput'
import { useStore } from '../store'
import { Field, Modal, MoneyInput, Segmented } from './ui'
import type { Project, Quote, QuoteStatus } from '../types'
import { DEFAULT_CARD_FEE, QUOTE_STATUS, isCard, splitPayments, monthlyPayments, packageMonths, fmtDate, allStatuses, money, paymentState, quoteNumber, quoteTotal, statusInfo, today, addBusinessDays, addDays, fmtWeekday } from '../utils'
import { projectFromQuote } from '../quoteActions'
import { Icon } from './Icon'
import { toast } from './dialog'

/* Controles rápidos: mudar a fase e marcar pagamento sem abrir a demanda. */

/* Trocar a fase de uma demanda: quando há algo importante a confirmar (entregue, início,
   cancelar), abre uma pergunta antes; senão muda direto. Vale para todos os lugares. */
type Pending = { p: Project; status: string } | null
let pendingSet: ((v: Pending) => void) | null = null

export function requestStatus(p: Project, status: string, apply: (next: Project) => void) {
  if (p.status === status) return
  const unpaid = p.payments.filter((x) => !x.paidDate && x.amount > 0)
  const ask =
    (status === 'entregue' && p.status !== 'entregue') ||
    (status === 'producao' && p.status === 'briefing' && p.payments[0] && !p.payments[0].paidDate) ||
    (status === 'cancelado' && p.status !== 'cancelado')
  if (ask && pendingSet) {
    applyRef = apply
    pendingSet({ p, status })
    return
  }
  apply({ ...p, status, deliveredDate: status === 'entregue' ? p.deliveredDate ?? today() : null })
  toast(`“${p.title}” → ${statusInfo(status).label.toLowerCase()}`)
  void unpaid
}
let applyRef: ((next: Project) => void) | null = null

/** Janela das perguntas (fica montada uma vez no App). */
export function StatusDialogHost() {
  const [pending, setPending] = useState<Pending>(null)
  pendingSet = setPending
  if (!pending) return null
  return <StatusDialog key={pending.p.id + pending.status} p={pending.p} status={pending.status} onClose={() => setPending(null)} />
}

/** "Recebeu no Pix ou no crédito?" — no crédito, mostra a taxa que fica com a maquininha / Mercado Pago. */
export function HowPaid({ method, onChange, amount }: { method: string; onChange: (m: string) => void; amount: number }) {
  const { data } = useStore()
  const rate = data.settings.cardFee ?? DEFAULT_CARD_FEE
  const fee = Math.round(amount * rate) / 100
  return (
    <div className="how-paid">
      <span className="field-label">como o cliente pagou?</span>
      <Segmented
        value={isCard(method) ? 'Cartão de crédito' : 'Pix'}
        onChange={onChange}
        options={[
          { value: 'Pix', label: 'Pix' },
          { value: 'Cartão de crédito', label: 'cartão de crédito' },
        ]}
      />
      {isCard(method) && amount > 0 && (
        <span className="muted small">
          Taxa do cartão ({String(rate).replace('.', ',')}%): <b>{money(fee)}</b> entra como despesa no mês em que o dinheiro cair. Você recebe <b>{money(amount - fee)}</b>. A % fica em configurações → propostas.
        </span>
      )}
    </div>
  )
}

function StatusDialog({ p, status, onClose }: { p: Project; status: string; onClose: () => void }) {
  const unpaid = p.payments.filter((x) => !x.paidDate && x.amount > 0)
  // entregue: já vem com a data do prazo (se já passou); sem prazo, hoje — dá para corrigir
  const [date, setDate] = useState(() => (status === 'entregue' && p.dueDate && p.dueDate <= today() ? p.dueDate : today()))
  const [paid, setPaid] = useState<Record<string, boolean>>({})
  const [method, setMethod] = useState(() => unpaid[0]?.method || 'Pix')
  const [tasks, setTasks] = useState(true)
  const [waive, setWaive] = useState(false) // cliente cancelou: o restante não vai ser pago
  const openTasks = p.tasks.filter((t) => !t.done).length
  const label = statusInfo(status).label.toLowerCase()
  const confirm = () => {
    let next: Project = { ...p, status, deliveredDate: status === 'entregue' ? date : null }
    next = { ...next, payments: next.payments.map((x) => (paid[x.id] ? { ...x, paidDate: date, method } : x)) }
    if (waive) {
      // o que não foi pago sai das parcelas e vira desconto (a demanda fecha com o valor recebido)
      const left = next.payments.filter((x) => !x.paidDate && x.amount > 0)
      const lost = left.reduce((n, x) => n + x.amount, 0)
      if (lost > 0)
        next = {
          ...next,
          payments: next.payments.filter((x) => x.paidDate || x.amount <= 0),
          discount: (next.discount || 0) + lost,
          notes: [`Cliente cancelou: ${money(lost)} não será pago (${fmtDate(date)}).`, next.notes].filter(Boolean).join('\n\n'),
        }
    }
    if (status === 'entregue' && tasks) next = { ...next, tasks: next.tasks.map((t) => ({ ...t, done: true })) }
    applyRef?.(next)
    const n = Object.values(paid).filter(Boolean).length
    toast(`“${p.title}” → ${label}${n ? ` · ${n} pagamento(s) marcado(s)` : ''}`)
    onClose()
  }
  const title = status === 'entregue' ? 'marcar como entregue' : status === 'cancelado' ? 'cancelar demanda' : `mudar para ${label}`
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            voltar
          </button>
          <button className={`btn ${status === 'cancelado' ? 'danger' : 'primary'}`} onClick={confirm}>
            {status === 'cancelado' ? 'cancelar demanda' : `confirmar: ${label}`}
          </button>
        </>
      }
    >
      <p className="muted small" style={{ margin: '0 0 14px' }}>
        <b>{p.title}</b>
      </p>
      {status === 'entregue' && (
        <Field label="Entregue em">
          <DateInput value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} />
        </Field>
      )}
      {status === 'cancelado' && (
        <p className="small">
          A demanda sai do quadro e das cobranças. {unpaid.length ? 'As parcelas em aberto ficam registradas, mas não serão cobradas.' : ''}
        </p>
      )}
      {unpaid.length > 0 && status !== 'cancelado' && (
        <div className="status-q">
          <span className="field-label">{status === 'producao' ? 'o sinal já foi pago?' : 'o que já foi pago?'}</span>
          {(status === 'producao' ? unpaid.slice(0, 1) : unpaid).map((x) => (
            <label key={x.id} className="check toggle">
              <input type="checkbox" checked={!!paid[x.id]} onChange={(e) => setPaid((v) => ({ ...v, [x.id]: e.target.checked }))} />
              <span>
                {x.description || 'parcela'} · <b className="money">{money(x.amount)}</b>
              </span>
            </label>
          ))}
          <span className="muted small">
            {status === 'producao'
              ? 'Se marcar, entra como recebido hoje.'
              : waive
                ? 'Os marcados entram como recebidos; o que ficar desmarcado deixa de ser cobrado.'
                : `Os marcados entram como recebidos em ${date.split('-').reverse().join('/')}. Os outros continuam em “a receber”.`}
          </span>
          {unpaid.some((x) => paid[x.id]) && <HowPaid method={method} onChange={setMethod} amount={unpaid.filter((x) => paid[x.id]).reduce((n, x) => n + x.amount, 0)} />}
          {status === 'entregue' && (
            <label className="check toggle waive">
              <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} /> o cliente cancelou — o restante não vai ser pago
            </label>
          )}
        </div>
      )}
      {status === 'entregue' && openTasks > 0 && (
        <label className="check toggle">
          <input type="checkbox" checked={tasks} onChange={(e) => setTasks(e.target.checked)} /> concluir as {openTasks} etapa(s) que faltam
        </label>
      )}
    </Modal>
  )
}

export function StatusSelect({ p }: { p: Project }) {
  const { upsert } = useStore()
  const info = statusInfo(p.status)
  return (
    <select
      className="status-select"
      value={p.status}
      style={{ color: info.color, borderColor: `${info.color}66`, background: `${info.color}14` }}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => requestStatus(p, e.target.value, (next) => upsert('projects', next))}
      aria-label="Fase da demanda"
    >
      {allStatuses().map((k) => (
        <option key={k} value={k}>
          {statusInfo(k).label}
        </option>
      ))}
    </select>
  )
}

/** Próxima parcela em aberto com botão "pago" (ou "quitado" quando não falta nada). */
export function PayNext({ p, compact }: { p: Project; compact?: boolean }) {
  const { upsert } = useStore()
  const next = p.payments.find((x) => !x.paidDate)
  if (!p.payments.length) return null
  if (!next) return <span className="pay-chip is-done">quitado</span>
  const late = paymentState(next, p) === 'cobrar'
  return (
    <button
      className={`pay-chip ${late ? 'is-late' : ''}`}
      title={`Marcar "${next.description}" como pago hoje`}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        upsert('projects', { ...p, payments: p.payments.map((x) => (x.id === next.id ? { ...x, paidDate: today() } : x)) })
        toast(`${next.description} de ${money(next.amount)} marcado como pago.`)
      }}
    >
      <Icon name="check" size={13} />
      {compact ? money(next.amount) : `${next.description.toLowerCase()} · ${money(next.amount)}`}
    </button>
  )
}

/** Status do orçamento direto na lista. Aprovar pergunta o valor fechado e cria a demanda (uma única vez). */
export function QuoteStatusSelect({ q }: { q: Quote }) {
  const { data, upsert } = useStore()
  const [closing, setClosing] = useState<string | null>(null) // opção escolhida ('' = sem opções)
  const info = QUOTE_STATUS[q.status]
  const multi = q.mode === 'opcoes' && q.options.length > 1
  const value = q.status === 'aprovado' && multi && q.chosenOption ? `aprovado:${q.chosenOption}` : q.status
  const change = (v: string) => {
    const [status, optionId] = v.split(':') as [QuoteStatus, string | undefined]
    if (status === 'aprovado' && !q.projectId) return setClosing(optionId ?? '')
    const next = { ...q, status, chosenOption: optionId ?? q.chosenOption, sentAt: status === 'rascunho' ? q.sentAt : q.sentAt || today() }
    if (status !== 'rascunho' && q.status === 'rascunho' && !q.noNumber) next.number = nextSentNumber(data.quotes, next) // sem número vago
    if (status === 'rascunho' && q.status !== 'rascunho' && !q.noNumber) {
      // voltou para rascunho: vai para depois do último número (os rascunhos se reorganizam pela data)
      const moves = new Map(draftRenumber([...data.quotes.filter((x) => x.id !== q.id), next]).map((r) => [r.id, r.number]))
      if (moves.has(q.id)) next.number = moves.get(q.id)!
      for (const x of data.quotes) if (x.id !== q.id && moves.has(x.id)) upsert('quotes', { ...x, number: moves.get(x.id)! })
    }
    upsert('quotes', next)
    toast(`Orçamento ${quoteNumber(q)} → ${QUOTE_STATUS[status].label.toLowerCase()}${next.number !== q.number ? ` (agora ${quoteNumber(next)})` : ''}`)
  }
  return (
    <>
      <select
        className="status-select"
        value={value}
        style={{ color: info.color, borderColor: `${info.color}66`, background: `${info.color}14` }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => change(e.target.value)}
        aria-label="Status do orçamento"
      >
        {(Object.keys(QUOTE_STATUS) as QuoteStatus[]).flatMap((k) =>
          k === 'aprovado' && multi
            ? [
                ...q.options.slice(0, 3).map((o, i) => (
                  <option key={o.id} value={`aprovado:${o.id}`}>
                    Aprovado · {i + 1}
                  </option>
                )),
                ...(q.combo
                  ? [
                      <option key="ambas" value="aprovado:ambas">
                        Aprovado · juntas
                      </option>,
                    ]
                  : []),
              ]
            : [
                <option key={k} value={k}>
                  {QUOTE_STATUS[k].label}
                </option>,
              ],
        )}
      </select>
      {closing !== null && (
        // a janela fica dentro da linha da tabela: o clique não pode abrir o orçamento
        <span onClick={(e) => e.stopPropagation()}>
          <CloseDeal q={{ ...q, chosenOption: closing || q.chosenOption }} onClose={() => setClosing(null)} />
        </span>
      )}
    </>
  )
}

/** "Fechou por quanto?" — já vem com o valor da proposta; muda só se negociou. */
export function CloseDeal({ q, onClose, onDone }: { q: Quote; onClose: () => void; onDone?: (projectId: string) => void }) {
  const { data, upsert } = useStore()
  const fee = data.settings.urgencyFee
  const proposed = quoteTotal({ ...q, closedValue: 0 }, fee)
  const [value, setValue] = useState(q.closedValue && q.closedValue > 0 ? q.closedValue : proposed)
  const [workDays, setWorkDays] = useState(0) // quantidade de dias (0 = sem prazo)
  const [dayMode, setDayMode] = useState<'uteis' | 'corridos' | 'data'>('uteis')
  const [exactDate, setExactDate] = useState('')
  const [closedOn, setClosedOn] = useState(today())
  // o que já foi pago (orçamento antigo: tudo). No cartão é sempre 100% no início
  const [paidPart, setPaidPart] = useState<'nada' | 'sinal' | 'tudo'>(q.noNumber ? 'tudo' : 'nada')
  const [cardPaid, setCardPaid] = useState(true)
  const [method, setMethod] = useState('Pix')
  const card = isCard(method)
  const pkg = packageMonths(q)
  const [note, setNote] = useState(q.closedNote ?? '')
  const due = dayMode === 'data' ? exactDate : workDays > 0 ? (dayMode === 'uteis' ? addBusinessDays(closedOn, workDays) : addDays(closedOn, workDays)) : ''
  const diff = Math.round((proposed - value) * 100) / 100
  const confirm = () => {
    if (value <= 0) return toast('Informe o valor fechado.')
    const approved: Quote = { ...q, status: 'aprovado', closedValue: value !== proposed ? value : 0, closedNote: note.trim(), sentAt: q.sentAt || closedOn, closedAt: closedOn }
    const built = projectFromQuote(approved, fee, due, closedOn)
    // o que mudou no fechamento fica anotado na demanda
    const change = note.trim()
    const base = change ? { ...built, notes: [`Fechado com mudança: ${change}${value !== proposed ? ` (proposta ${money(proposed)} → fechado ${money(value)})` : ''}`, built.notes].filter(Boolean).join('\n\n') } : built
    // lançando orçamentos antigos: o sinal já entra pago na data do fechamento
    const project = card
      ? { ...base, payments: splitPayments(value, 'cartao', closedOn, due).map((x) => ({ ...x, paidDate: cardPaid ? closedOn : null })) }
      : {
          ...base,
          // pacote: uma parcela por mês a partir do fechamento
          payments: (pkg ? monthlyPayments(value, pkg, closedOn, method) : base.payments).map((x, i) => ({
            ...x,
            method,
            paidDate: paidPart === 'tudo' || (paidPart === 'sinal' && i === 0) ? (i === 0 ? closedOn : pkg ? x.dueDate : x.dueDate || closedOn) : x.paidDate,
          })),
        }
    // orçamento antigo, tudo pago: a demanda já entra entregue
    const allPaid = project.payments.every((x) => x.paidDate)
    const done = q.noNumber && allPaid ? { ...project, status: 'entregue' as const, deliveredDate: due || closedOn, tasks: project.tasks.map((t) => ({ ...t, done: true })) } : project
    upsert('projects', done)
    upsert('quotes', { ...approved, projectId: done.id })
    toast(`Aprovado por ${money(value)}! Demanda “${done.title}” criada${done.status === 'entregue' ? ', já entregue e paga' : allPaid ? ', já paga' : ', aguardando pagamento'}.`)
    onClose()
    onDone?.(done.id)
  }
  return (
    <Modal
      title="Orçamento aprovado"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={confirm}>
            <Icon name="check" size={15} /> Aprovar e criar demanda
          </button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          confirm()
        }}
      >
        <Field label="Fechou por quanto?" hint={diff > 0 ? `Negociado: ${money(diff)} a menos que a proposta (${money(proposed)}).` : diff < 0 ? `${money(-diff)} a mais que a proposta (${money(proposed)}).` : `Mesmo valor da proposta. Se negociou, é só mudar aqui.`}>
          <MoneyInput value={value} onChange={setValue} />
        </Field>
        <Field label="Mudou algo? (opcional)" hint="Ex.: tirou a planta de forro; incluiu 2 imagens. Fica anotado no orçamento e na demanda.">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={value !== proposed ? 'O que mudou no escopo ou no valor?' : 'Opcional'} spellCheck lang="pt-BR" />
        </Field>
        <Field label="Fechou em" hint="Hoje por padrão. Para orçamento antigo, coloque a data em que a cliente aprovou.">
          <DateInput value={closedOn} min={q.createdAt} max={today()} onChange={(e) => setClosedOn(e.target.value || today())} />
        </Field>
        <HowPaid method={method} onChange={setMethod} amount={value} />
        {card ? (
          <label className="check">
            <input type="checkbox" checked={cardPaid} onChange={(e) => setCardPaid(e.target.checked)} /> já foi pago: 100% no cartão, no início (entra como recebido em {closedOn.split('-').reverse().join('/')})
          </label>
        ) : (
          <Field group label="O que já foi pago?" hint={pkg ? `Pacote: ${pkg} parcelas mensais de ${money(Math.round((value / pkg) * 100) / 100)}, a partir de ${closedOn.split('-').reverse().join('/')}. ${paidPart === 'tudo' ? 'Todas entram como recebidas, cada uma no seu mês.' : paidPart === 'sinal' ? 'A 1ª parcela entra como recebida.' : 'Cada parcela aparece para cobrar perto do vencimento.'}` : paidPart === 'tudo' ? `Sinal em ${closedOn.split('-').reverse().join('/')} e saldo no prazo de entrega${due ? ` (${due.split('-').reverse().join('/')})` : ' (ou na data do fechamento, sem prazo)'}. Dá para ajustar cada data na demanda.` : paidPart === 'sinal' ? `O sinal entra como recebido em ${closedOn.split('-').reverse().join('/')}.` : 'As parcelas ficam a receber.'}>
            <Segmented
              value={paidPart}
              onChange={setPaidPart}
              options={[
                { value: 'nada', label: 'nada ainda' },
                { value: 'sinal', label: pkg ? 'só a 1ª parcela' : 'só o sinal' },
                { value: 'tudo', label: 'tudo (trabalho antigo)' },
              ]}
            />
          </Field>
        )}
        <Field
          group
          label="Prazo combinado · se houver"
          hint={
            due
              ? `Entrega em ${fmtWeekday(due)}, ${due.split('-').reverse().join('/')}${dayMode === 'uteis' ? ' · sem contar fins de semana e feriados' : dayMode === 'corridos' ? ' · contando todos os dias' : ''}.`
              : 'Sem prazo? Deixe em branco. Dá para definir depois, no card “prazo combinado” da demanda.'
          }
        >
          <div className="deadline-field">
            <Segmented<'uteis' | 'corridos' | 'data'>
              value={dayMode}
              onChange={setDayMode}
              options={[
                { value: 'uteis', label: 'dias úteis' },
                { value: 'corridos', label: 'dias corridos' },
                { value: 'data', label: 'data exata' },
              ]}
            />
            {dayMode === 'data' ? (
              <DateInput value={exactDate} min={closedOn} onChange={(e) => setExactDate(e.target.value)} />
            ) : (
              <input type="number" min={0} value={workDays || ''} placeholder="nº de dias" onFocus={(e) => e.target.select()} onChange={(e) => setWorkDays(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
            )}
          </div>
        </Field>
        <p className="small muted">A proposta em PDF continua com o valor original. A demanda, as parcelas e o financeiro usam o valor fechado.</p>
      </form>
    </Modal>
  )
}

/** Etapas da demanda sem abrir a demanda: toque em "1/7" e marque ali mesmo. */
export function TaskQuick({ p, compact }: { p: Project; compact?: boolean }) {
  const { upsert } = useStore()
  const [open, setOpen] = useState(false)
  if (!p.tasks.length) return null
  const done = p.tasks.filter((t) => t.done).length
  const next = p.tasks.find((t) => !t.done)
  const toggle = (id: string) => upsert('projects', { ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })
  return (
    <div className={`task-quick ${compact ? 'is-compact' : ''} ${open ? 'is-open' : ''}`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <button type="button" className="task-quick-head" onClick={() => setOpen((v) => !v)} aria-expanded={open} title={open ? 'Fechar etapas' : next ? `Próxima: ${next.text} · toque para marcar` : 'Ver e marcar etapas'}>
        <div className="progress thin">
          <div className="progress-bar" style={{ width: `${(done / p.tasks.length) * 100}%` }} />
        </div>
        <span className="task-quick-count">
          {done}/{p.tasks.length}
        </span>
        <Icon name="chevronR" size={13} className={open ? 'rot-down' : 'rot-up'} />
      </button>
      {!open && next && !compact && <div className="task-quick-next">próxima: {next.text}</div>}
      {open && (
        <ul className="task-quick-list">
          {p.tasks.map((t) => (
            <li key={t.id}>
              <label className={t.done ? 'is-done' : ''}>
                <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
                <span>{t.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
