import { useStore } from '../store'
import type { Project, Quote, QuoteStatus } from '../types'
import { QUOTE_STATUS, allStatuses, money, paymentState, quoteNumber, statusInfo, today } from '../utils'
import { projectFromQuote } from '../quoteActions'
import { Icon } from './Icon'
import { toast } from './dialog'

/* Controles rápidos: mudar a fase e marcar pagamento sem abrir a demanda. */

export function StatusSelect({ p }: { p: Project }) {
  const { upsert } = useStore()
  const info = statusInfo(p.status)
  return (
    <select
      className="status-select"
      value={p.status}
      style={{ color: info.color, borderColor: `${info.color}66`, background: `${info.color}14` }}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const status = e.target.value
        upsert('projects', { ...p, status, deliveredDate: status === 'entregue' ? p.deliveredDate ?? today() : null })
        toast(`“${p.title}” → ${statusInfo(status).label.toLowerCase()}`)
      }}
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
  const late = paymentState(next) === 'vencido'
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

/** Status do orçamento direto na lista. Aprovar cria a demanda (uma única vez). */
export function QuoteStatusSelect({ q }: { q: Quote }) {
  const { data, upsert } = useStore()
  const info = QUOTE_STATUS[q.status]
  const multi = q.mode === 'opcoes' && q.options.length > 1
  const value = q.status === 'aprovado' && multi && q.chosenOption ? `aprovado:${q.chosenOption}` : q.status
  const change = (v: string) => {
    const [status, optionId] = v.split(':') as [QuoteStatus, string | undefined]
    const next: Quote = { ...q, status, chosenOption: optionId ?? q.chosenOption, sentAt: status === 'rascunho' ? q.sentAt : q.sentAt || today() }
    if (status === 'aprovado' && !q.projectId) {
      const project = projectFromQuote(next, data.settings.urgencyFee)
      upsert('projects', project)
      upsert('quotes', { ...next, projectId: project.id })
      toast(`Aprovado! Demanda “${project.title}” criada, aguardando sinal.`)
      return
    }
    upsert('quotes', next)
    toast(`Orçamento ${quoteNumber(q)} → ${QUOTE_STATUS[status].label.toLowerCase()}`)
  }
  return (
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
          ? q.options.slice(0, 2).map((o, i) => (
              <option key={o.id} value={`aprovado:${o.id}`}>
                Aprovado · opção {i + 1}
              </option>
            ))
          : [
              <option key={k} value={k}>
                {QUOTE_STATUS[k].label}
              </option>,
            ],
      )}
    </select>
  )
}
