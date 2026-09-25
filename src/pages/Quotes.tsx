import { useState } from 'react'
import { useStore } from '../store'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { Badge, Empty, Segmented, Stat } from '../components/ui'
import type { QuoteStatus } from '../types'
import { QUOTE_STATUS, addDays, daysUntil, fmtDate, money, quoteTotal, sum } from '../utils'

export default function Quotes() {
  const { data } = useStore()
  const [status, setStatus] = useState<QuoteStatus | 'todos'>('todos')
  const fee = data.settings.urgencyFee
  const quotes = [...data.quotes].sort((a, b) => b.number - a.number).filter((q) => status === 'todos' || q.status === status)
  const decided = data.quotes.filter((q) => q.status === 'aprovado' || q.status === 'recusado')
  const approved = data.quotes.filter((q) => q.status === 'aprovado')
  const pending = data.quotes.filter((q) => q.status === 'enviado')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Propostas comerciais</p>
          <h1>
            orçamentos <em>&amp; propostas</em>
          </h1>
        </div>
        <button className="btn primary" onClick={() => go('orcamentos', 'novo')}>
          <Icon name="plus" size={16} /> Novo orçamento
        </button>
      </div>

      <div className="stats">
        <Stat label="Aguardando resposta" value={pending.length} sub={money(sum(pending, (q) => quoteTotal(q, fee)))} icon="clock" />
        <Stat label="Taxa de aprovação" value={decided.length ? `${Math.round((approved.length / decided.length) * 100)}%` : '—'} sub={`${approved.length} de ${decided.length} respondidos`} icon="target" />
        <Stat label="Valor aprovado" value={money(sum(approved, (q) => quoteTotal(q, fee)))} icon="check" tone="good" />
      </div>

      <div className="toolbar">
        <Segmented<QuoteStatus | 'todos'>
          value={status}
          onChange={setStatus}
          options={[{ value: 'todos', label: 'Todos' }, ...(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((k) => ({ value: k, label: QUOTE_STATUS[k].label }))]}
        />
      </div>

      {quotes.length === 0 ? (
        <Empty
          icon="file"
          title="Nenhum orçamento"
          text="Monte propostas com sua tabela de preços, gere PDF e envie pelo WhatsApp. Quando aprovado, vira projeto com um clique."
          action={<button className="btn primary" onClick={() => go('orcamentos', 'novo')}>Criar orçamento</button>}
        />
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Proposta</th>
                <th>Status</th>
                <th>Validade</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const client = data.clients.find((c) => c.id === q.clientId)
                const valid = addDays(q.createdAt, q.validityDays)
                const expired = q.status === 'enviado' && daysUntil(valid) < 0
                return (
                  <tr key={q.id} className="clickable" onClick={() => go('orcamentos', q.id)}>
                    <td className="muted">#{String(q.number).padStart(3, '0')}</td>
                    <td>
                      <div className="list-title">{q.title || 'Sem título'}</div>
                      <div className="list-sub">
                        {client?.name ?? '—'} · {fmtDate(q.createdAt)}
                      </div>
                    </td>
                    <td>
                      <Badge color={QUOTE_STATUS[q.status].color}>{QUOTE_STATUS[q.status].label}</Badge>
                    </td>
                    <td className={expired ? 'text-bad' : 'muted'}>{expired ? 'expirado' : fmtDate(valid)}</td>
                    <td className="num">{money(quoteTotal(q, fee))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
