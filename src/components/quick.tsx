import { useStore } from '../store'
import type { Project } from '../types'
import { allStatuses, money, paymentState, statusInfo, today } from '../utils'
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
