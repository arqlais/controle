import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { Badge, Empty, Segmented, Stat, usePaged } from '../components/ui'
import type { Quote, QuoteStatus } from '../types'
import { QUOTE_STATUS, addDays, daysUntil, fmtDate, money, quoteTotal, sum, whatsappLink } from '../utils'

type Filter = QuoteStatus | 'todos' | 'cobrar'
const FOLLOW_UP_DAYS = 3

/** Dias desde o envio (orçamentos enviados e ainda sem resposta). */
export const waitingDays = (q: Quote) => (q.status === 'enviado' && q.sentAt ? -daysUntil(q.sentAt) : 0)
export const needsFollowUp = (q: Quote) => q.status === 'enviado' && waitingDays(q) >= FOLLOW_UP_DAYS

export default function Quotes() {
  const { data } = useStore()
  const [filter, setFilter] = useState<Filter>('todos')
  const [q, setQ] = useState('')
  const [clientId, setClientId] = useState('')
  const fee = data.settings.urgencyFee
  const client = (id: string) => data.clients.find((c) => c.id === id)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return [...data.quotes]
      .filter((x) => (filter === 'todos' ? true : filter === 'cobrar' ? needsFollowUp(x) : x.status === filter))
      .filter((x) => !clientId || x.clientId === clientId)
      .filter((x) => !term || `${x.number} ${x.title} ${client(x.clientId)?.name ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => b.number - a.number)
  }, [data.quotes, data.clients, filter, q, clientId])
  const { visible, more } = usePaged(rows)

  const decided = data.quotes.filter((x) => x.status === 'aprovado' || x.status === 'recusado')
  const approved = data.quotes.filter((x) => x.status === 'aprovado')
  const pending = data.quotes.filter((x) => x.status === 'enviado')
  const followUps = data.quotes.filter(needsFollowUp)

  const followText = (x: Quote) =>
    `Oi, ${client(x.clientId)?.name.split(' ')[0] ?? ''}! Tudo bem? Passando para saber se conseguiu ver a proposta #${String(x.number).padStart(3, '0')} (${x.title}). Qualquer ajuste é só me falar. 😊`

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">propostas comerciais</p>
          <h1>
            orçamentos <em>&amp; propostas</em>
          </h1>
        </div>
        <button className="btn primary" onClick={() => go('orcamentos', 'novo')}>
          <Icon name="plus" size={16} /> Novo orçamento
        </button>
      </div>

      <div className="stats">
        <Stat label="Em negociação" value={money(sum(pending, (x) => quoteTotal(x, fee)))} sub={`${pending.length} proposta(s) aguardando resposta`} icon="clock" onClick={() => setFilter('enviado')} />
        <Stat
          label="Cobrar resposta"
          value={followUps.length}
          sub={`sem retorno há ${FOLLOW_UP_DAYS}+ dias`}
          icon="alert"
          tone={followUps.length ? 'warn' : undefined}
          onClick={() => setFilter('cobrar')}
        />
        <Stat label="Taxa de aprovação" value={decided.length ? `${Math.round((approved.length / decided.length) * 100)}%` : '—'} sub={`${approved.length} de ${decided.length} respondidos`} icon="target" />
        <Stat label="Valor aprovado" value={money(sum(approved, (x) => quoteTotal(x, fee)))} sub={approved.length ? `ticket médio ${money(sum(approved, (x) => quoteTotal(x, fee)) / approved.length)}` : undefined} icon="check" tone="good" />
      </div>

      <div className="toolbar">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'cobrar', label: `Cobrar resposta${followUps.length ? ` · ${followUps.length}` : ''}` },
            ...(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((k) => ({ value: k, label: QUOTE_STATUS[k].label })),
          ]}
        />
        <div className="search inline">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nº, título ou cliente…" />
        </div>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Todos os clientes</option>
          {[...data.clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty
          icon="file"
          title={data.quotes.length ? 'Nenhum orçamento com esses filtros' : 'Nenhum orçamento'}
          text={data.quotes.length ? undefined : 'Monte propostas com sua tabela de preços, gere PDF e envie pelo WhatsApp. Quando aprovado, vira projeto com um clique.'}
          action={!data.quotes.length && <button className="btn primary" onClick={() => go('orcamentos', 'novo')}>Criar orçamento</button>}
        />
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>nº</th>
                <th>Proposta</th>
                <th>Status</th>
                <th className="hide-mobile">Resposta</th>
                <th className="num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((x) => {
                const c = client(x.clientId)
                const valid = addDays(x.createdAt, x.validityDays)
                const expired = x.status === 'enviado' && daysUntil(valid) < 0
                const wait = waitingDays(x)
                return (
                  <tr key={x.id} className="clickable" onClick={() => go('orcamentos', x.id)}>
                    <td className="muted">#{String(x.number).padStart(3, '0')}</td>
                    <td>
                      <div className="list-title">{x.title || 'Sem título'}</div>
                      <div className="list-sub">
                        {c?.name ?? '—'} · {fmtDate(x.createdAt)}
                      </div>
                    </td>
                    <td>
                      <Badge color={QUOTE_STATUS[x.status].color}>{QUOTE_STATUS[x.status].label}</Badge>
                    </td>
                    <td className="hide-mobile">
                      {x.status === 'enviado' ? (
                        <span className={expired ? 'text-bad' : wait >= FOLLOW_UP_DAYS ? 'text-warn' : 'muted'}>
                          {expired ? 'validade vencida' : wait === 0 ? 'enviado hoje' : `aguardando há ${wait} dia${wait > 1 ? 's' : ''}`}
                        </span>
                      ) : x.status === 'aprovado' && x.projectId ? (
                        <span className="muted">virou projeto</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num">{money(quoteTotal(x, fee))}</td>
                    <td className="actions" onClick={(e) => e.stopPropagation()}>
                      {needsFollowUp(x) && c?.phone && (
                        <a className="btn small ghost" href={whatsappLink(c.phone, followText(x))} target="_blank" rel="noreferrer" title="Cobrar resposta no WhatsApp">
                          <Icon name="whatsapp" size={14} /> cobrar
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="muted">
                  {rows.length} orçamento(s)
                </td>
                <td className="num">
                  <b>{money(sum(rows, (x) => quoteTotal(x, fee)))}</b>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          {more && <div className="table-more">{more}</div>}
        </div>
      )}
    </div>
  )
}
