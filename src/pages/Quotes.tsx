import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { Empty, Segmented, Stat, usePaged } from '../components/ui'
import type { Quote, QuoteStatus } from '../types'
import { QUOTE_STATUS, daysUntil, fmtDate, money, quoteDeal, quoteNumber, quoteTotal, sum, templateText, whatsappLink } from '../utils'
import { QuoteStatusSelect } from '../components/quick'
import { ask, toast } from '../components/dialog'

type Filter = QuoteStatus | 'todos' | 'cobrar'
const FOLLOW_UP_DAYS = 3

/** Dias desde o envio (orçamentos enviados e ainda sem resposta). */
export const waitingDays = (q: Quote) => (q.status === 'enviado' && q.sentAt ? -daysUntil(q.sentAt) : 0)
export const needsFollowUp = (q: Quote) => q.status === 'enviado' && waitingDays(q) >= FOLLOW_UP_DAYS

export default function Quotes() {
  const { data, upsert, remove } = useStore()
  const [picked, setPicked] = useState<Set<string>>(new Set())

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

  // seleção de vários: mudar status ou excluir de uma vez
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allVisible = visible.length > 0 && visible.every((x) => picked.has(x.id))
  const toggleAll = () => setPicked(allVisible ? new Set() : new Set(visible.map((x) => x.id)))
  const chosen = data.quotes.filter((x) => picked.has(x.id))
  const bulkStatus = (status: QuoteStatus) => {
    // enviado: conta a partir da data do orçamento (antigos não viram "cobrar resposta" de uma vez)
    for (const x of chosen) upsert('quotes', { ...x, status, sentAt: status === 'rascunho' ? x.sentAt : x.sentAt || x.createdAt })
    toast(`${chosen.length} orçamento(s) → ${QUOTE_STATUS[status].label.toLowerCase()}`)
    setPicked(new Set())
  }
  const bulkDelete = async () => {
    const linked = chosen.filter((x) => x.projectId).length
    if (!(await ask(`Excluir ${chosen.length} orçamento(s)?${linked ? ` ${linked} já viraram demanda: as demandas continuam.` : ''}`, { confirmLabel: 'Excluir', danger: true }))) return
    for (const x of chosen) remove('quotes', x.id)
    toast(`${chosen.length} orçamento(s) excluídos.`)
    setPicked(new Set())
  }

  const followText = (x: Quote) => templateText(data.settings, 'retorno', 'Oi, {cliente}! Conseguiu ver a proposta {proposta}?', client(x.clientId), undefined, x)

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
        <Stat label="Valor aprovado" value={money(sum(approved, (x) => quoteDeal(x, fee)))} sub={approved.length ? `ticket médio ${money(sum(approved, (x) => quoteDeal(x, fee)) / approved.length)}` : undefined} icon="check" tone="good" />
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
          {picked.size > 0 && (
            <div className="bulk-bar">
              <b>{picked.size} selecionado(s)</b>
              {!allVisible && (
                <button className="link small" onClick={toggleAll}>
                  selecionar todos ({visible.length})
                </button>
              )}
              <span className="muted small">mudar para</span>
              {(['rascunho', 'enviado', 'recusado'] as QuoteStatus[]).map((st) => (
                <button key={st} className="btn small ghost" onClick={() => bulkStatus(st)}>
                  {QUOTE_STATUS[st].label.toLowerCase()}
                </button>
              ))}
              <button className="btn small ghost danger" onClick={bulkDelete}>
                <Icon name="trash" size={14} /> excluir
              </button>
              <button className="link small" onClick={() => setPicked(new Set())}>
                limpar seleção
              </button>
            </div>
          )}
          <table className="table cards-mobile quote-table">
            <thead>
              <tr>
                <th className="nowrap">
                  <label className="pick" onClick={(e) => e.stopPropagation()} title="Selecionar todos">
                    <input type="checkbox" checked={allVisible} onChange={toggleAll} aria-label="Selecionar todos" />
                  </label>
                  nº
                </th>
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
                const wait = waitingDays(x)
                return (
                  <tr key={x.id} className={`clickable ${picked.has(x.id) ? 'is-picked' : ''}`} onClick={() => go('orcamentos', x.id)}>
                    <td className="muted nowrap q-num">
                      <label className="pick" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={picked.has(x.id)} onChange={() => toggle(x.id)} aria-label={`Selecionar ${quoteNumber(x)}`} />
                      </label>
                      {quoteNumber(x)}
                    </td>
                    <td className="q-main">
                      <div className="list-title">{x.title || 'Sem título'}</div>
                      <div className="list-sub">
                        {c?.name ?? '—'} · {fmtDate(x.createdAt)}
                        {x.closedAt && x.closedAt !== x.createdAt ? ` · fechou ${fmtDate(x.closedAt)}` : ''}
                      </div>
                    </td>
                    <td className="q-status">
                      <QuoteStatusSelect q={x} />
                    </td>
                    <td className="hide-mobile">
                      {x.status === 'enviado' ? (
                        <span className={wait >= FOLLOW_UP_DAYS ? 'text-warn' : 'muted'}>
                          {wait === 0 ? 'enviado hoje' : `aguardando há ${wait} dia${wait > 1 ? 's' : ''}`}
                        </span>
                      ) : x.status === 'aprovado' && x.projectId ? (
                        <span className="muted">virou projeto</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num q-total" data-label="total">
                      {money(quoteDeal(x, fee))}
                      {quoteDeal(x, fee) !== quoteTotal(x, fee) && <div className="small muted"><s>{money(quoteTotal(x, fee))}</s> negociado</div>}
                    </td>
                    <td className="actions q-act" onClick={(e) => e.stopPropagation()}>
                      <div className="quick-actions">
                        {needsFollowUp(x) && c?.phone && (
                          <a className="icon-btn" href={whatsappLink(c.phone, followText(x))} target="_blank" rel="noreferrer" title="Cobrar resposta no WhatsApp">
                            <Icon name="whatsapp" size={16} />
                          </a>
                        )}
                        {x.status === 'aprovado' && x.projectId && (
                          <button className="btn small ghost" onClick={() => go('projetos', x.projectId)}>
                            ver demanda
                          </button>
                        )}
                      </div>
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
                  <b>{money(sum(rows, (x) => quoteDeal(x, fee)))}</b>
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
