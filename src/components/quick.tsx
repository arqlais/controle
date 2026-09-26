import { useState } from 'react'
import { useStore } from '../store'
import { Field, Modal, MoneyInput } from './ui'
import type { Project, Quote, QuoteStatus } from '../types'
import { QUOTE_STATUS, allStatuses, money, paymentState, quoteNumber, quoteTotal, statusInfo, today } from '../utils'
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
  const { upsert } = useStore()
  const [closing, setClosing] = useState<string | null>(null) // opção escolhida ('' = sem opções)
  const info = QUOTE_STATUS[q.status]
  const multi = q.mode === 'opcoes' && q.options.length > 1
  const value = q.status === 'aprovado' && multi && q.chosenOption ? `aprovado:${q.chosenOption}` : q.status
  const change = (v: string) => {
    const [status, optionId] = v.split(':') as [QuoteStatus, string | undefined]
    if (status === 'aprovado' && !q.projectId) return setClosing(optionId ?? '')
    upsert('quotes', { ...q, status, chosenOption: optionId ?? q.chosenOption, sentAt: status === 'rascunho' ? q.sentAt : q.sentAt || today() })
    toast(`Orçamento ${quoteNumber(q)} → ${QUOTE_STATUS[status].label.toLowerCase()}`)
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
  const [due, setDue] = useState('')
  const diff = Math.round((proposed - value) * 100) / 100
  const confirm = () => {
    if (value <= 0) return toast('Informe o valor fechado.')
    const approved: Quote = { ...q, status: 'aprovado', closedValue: value !== proposed ? value : 0, sentAt: q.sentAt || today() }
    const project = projectFromQuote(approved, fee, due)
    upsert('projects', project)
    upsert('quotes', { ...approved, projectId: project.id })
    toast(`Aprovado por ${money(value)}! Demanda “${project.title}” criada, aguardando sinal.`)
    onClose()
    onDone?.(project.id)
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
        <Field label="Prazo combinado · se houver" hint="Só se vocês alinharam um prazo. Dá para definir ou mudar depois, no card “prazo combinado” da demanda.">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <p className="small muted">A proposta em PDF continua com o valor original. A demanda, as parcelas e o financeiro usam o valor fechado.</p>
      </form>
    </Modal>
  )
}
