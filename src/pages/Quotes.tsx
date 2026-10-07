import { useMemo, useState } from 'react'
import { afterDeleteDrafts, draftRenumber, nextSentNumber } from '../numbering'
import { duplicateQuote, launchPaidQuote } from '../quoteActions'
import { useKeep } from '../keep'
import { useStore } from '../store'
import { useAccess } from '../access'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { Empty, Modal, Segmented, Stat, usePaged } from '../components/ui'
import type { Quote, QuoteStatus } from '../types'
import { QUOTE_STATUS, daysUntil, fmtDate, money, quoteDeal, quoteNumber, quoteTotal, sum, templateText, whatsappLink, matches, businessDaysUntil, today } from '../utils'
import { QuoteStatusSelect } from '../components/quick'
import { AskAIButton } from '../components/AskAI'
import { PartnerQuotes } from '../components/PartnerTable'
import { ask, askChoice, toast } from '../components/dialog'

type Filter = QuoteStatus | 'todos' | 'cobrar'

// ordem da lista (fica guardada ao voltar para a página)
type QuoteOrder = 'numero' | 'numero-asc' | 'data' | 'data-asc' | 'cliente' | 'valor'
// orçamento antigo sem número: entra na ordem pela data, entre os numerados da mesma época
type Num = (q: Quote) => number
const QUOTE_ORDERS: Record<QuoteOrder, { label: string; fn: (name: (id: string) => string, fee: number, num: Num) => (a: Quote, b: Quote) => number }> = {
  numero: { label: 'nº (mais recente)', fn: (_n, _f, num) => (a, b) => num(b) - num(a) },
  'numero-asc': { label: 'nº (mais antigo)', fn: (_n, _f, num) => (a, b) => num(a) - num(b) },
  data: { label: 'data (mais recente)', fn: (_n, _f, num) => (a, b) => b.createdAt.localeCompare(a.createdAt) || num(b) - num(a) },
  'data-asc': { label: 'data (mais antiga)', fn: (_n, _f, num) => (a, b) => a.createdAt.localeCompare(b.createdAt) || num(a) - num(b) },
  cliente: { label: 'cliente (A–Z)', fn: (name, _f, num) => (a, b) => name(a.clientId).localeCompare(name(b.clientId), 'pt-BR', { sensitivity: 'base' }) || num(b) - num(a) },
  valor: { label: 'valor (maior)', fn: (_n, fee, num) => (a, b) => quoteTotal(b, fee) - quoteTotal(a, fee) || num(b) - num(a) },
}
/** Posição de cada orçamento na ordem por nº; os sem número ficam logo depois do último numerado até a data deles. */
export function numberKey(quotes: Quote[]): Num {
  const numbered = quotes.filter((x) => !x.noNumber && x.number > 0)
  const pos = new Map(quotes.filter((x) => x.noNumber).map((q) => [q.id, Math.max(0, ...numbered.filter((x) => x.createdAt <= q.createdAt).map((x) => x.number)) + 0.5]))
  return (q) => pos.get(q.id) ?? q.number
}

/** Dias desde o envio (orçamentos enviados e ainda sem resposta). */
export const waitingDays = (q: Quote) => (q.status === 'enviado' && q.sentAt ? -daysUntil(q.sentAt) : 0)
/** Cobrar resposta: já passou 1 dia útil desde o envio (fim de semana e feriado não contam). */
export const needsFollowUp = (q: Quote) => q.status === 'enviado' && !!q.sentAt && businessDaysUntil(today(), q.sentAt) >= 1

export default function Quotes() {
  const { data, upsert, remove } = useStore()
  const { isOwner } = useAccess()
  const [partnerOpen, setPartnerOpen] = useState(false)
  const [numbering, setNumbering] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const [filter, setFilter] = useKeep<Filter>('orc-filtro', 'todos')
  const [q, setQ] = useKeep('orc-busca', '')
  const [clientId, setClientId] = useKeep('orc-cliente', '')
  const [order, setOrder] = useKeep<QuoteOrder>('orc-ordem', 'numero')
  const fee = data.settings.urgencyFee
  const client = (id: string) => data.clients.find((c) => c.id === id)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return [...data.quotes]
      .filter((x) => (filter === 'todos' ? true : filter === 'cobrar' ? needsFollowUp(x) : x.status === filter))
      .filter((x) => !clientId || x.clientId === clientId)
      .filter((x) => matches(term, x.number, `#${x.number}`, quoteNumber(x), x.title, client(x.clientId)?.name, client(x.clientId)?.company))
      .sort(QUOTE_ORDERS[order].fn((id) => client(id)?.name ?? '', fee, numberKey(data.quotes)))
  }, [data.quotes, data.clients, filter, q, clientId, order])
  const { visible, more } = usePaged(rows, 30, 'orcamentos')

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
  // "todos" = todos os do filtro atual, inclusive os que ainda não apareceram na tela
  const allVisible = rows.length > 0 && rows.every((x) => picked.has(x.id))
  const bulkDuplicate = () => {
    const list = data.quotes.filter((x) => picked.has(x.id)).sort((a, b) => a.number - b.number)
    const copies = list.map((x, i) => duplicateQuote(x, data, i))
    copies.forEach((c) => upsert('quotes', c))
    setPicked(new Set())
    if (copies.length === 1) go('orcamentos', copies[0].id)
    toast(copies.length === 1 ? `Duplicado como ${quoteNumber(copies[0])} (rascunho).` : `${copies.length} orçamentos duplicados como rascunho (${copies.map(quoteNumber).join(', ')}).`)
  }
  const toggleAll = () => setPicked(allVisible ? new Set() : new Set(rows.map((x) => x.id)))
  const chosen = data.quotes.filter((x) => picked.has(x.id))
  const bulkStatus = async (status: QuoteStatus) => {
    // os que já viraram demanda continuam aprovados (a demanda depende deles)
    const locked = chosen.filter((x) => x.projectId && x.status === 'aprovado')
    const list = chosen.filter((x) => !locked.includes(x))
    let launch = false
    if (status === 'aprovado') {
      const choice = await askChoice(
        `Aprovar ${list.length} orçamento(s)? Se são trabalhos antigos, já feitos e pagos, lance no financeiro: cada um vira uma demanda entregue e o valor entra como recebido na data do orçamento.`,
        { confirmLabel: 'Aprovar e lançar como pagos', altLabel: 'Só marcar aprovados' },
      )
      if (choice === 'cancel') return
      launch = choice === 'confirm'
    }
    // enviado: conta a partir da data do orçamento (antigos não viram "cobrar resposta" de uma vez)
    const updated = list.map((x) => ({
      ...x,
      status,
      sentAt: status === 'rascunho' ? x.sentAt : x.sentAt || x.createdAt,
      closedAt: status === 'aprovado' ? x.closedAt || x.createdAt : x.closedAt,
    }))
    // rascunhos que saem agora: um depois do outro, logo após o último enviado (em ordem de data)
    if (status !== 'rascunho') {
      let pool = [...data.quotes]
      for (const x of [...updated].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
        if (list.find((o) => o.id === x.id)?.status !== 'rascunho') continue
        x.number = nextSentNumber(pool, x)
        pool = [...pool.filter((o) => o.id !== x.id), x]
      }
    }
    // voltaram para rascunho: vão para depois do último número (os rascunhos se reorganizam pela data)
    const ids = new Set(updated.map((x) => x.id))
    const moves = status === 'rascunho' ? new Map(draftRenumber([...data.quotes.filter((x) => !ids.has(x.id)), ...updated]).map((r) => [r.id, r.number])) : new Map<string, number>()
    for (const x of updated) {
      const q = moves.has(x.id) ? { ...x, number: moves.get(x.id)! } : x
      if (launch && q.clientId && !q.projectId) {
        const r = launchPaidQuote(q, data.settings.urgencyFee)
        upsert('projects', r.project)
        upsert('quotes', r.quote)
      } else upsert('quotes', q)
    }
    for (const x of data.quotes) if (!ids.has(x.id) && moves.has(x.id)) upsert('quotes', { ...x, number: moves.get(x.id)! })
    toast(`${list.length} orçamento(s) → ${QUOTE_STATUS[status].label.toLowerCase()}${launch ? " e lançados no financeiro como pagos" : ""}${locked.length ? ` · ${locked.length} já com demanda continuam aprovados` : ""}`)
    setPicked(new Set())
  }
  const bulkDelete = async () => {
    const linked = chosen.filter((x) => x.projectId).length
    if (!(await ask(`Excluir ${chosen.length} orçamento(s)?${linked ? ` ${linked} já viraram demanda: as demandas continuam.` : ''}`, { confirmLabel: 'Excluir', danger: true }))) return
    // rascunhos seguintes descem para ocupar os números que ficaram vagos
    const moves = afterDeleteDrafts(data.quotes, new Set(chosen.map((x) => x.id)))
    for (const x of chosen) remove('quotes', x.id)
    for (const m of moves) {
      const x = data.quotes.find((o) => o.id === m.id)
      if (x) upsert('quotes', { ...x, number: m.number })
    }
    toast(`${chosen.length} orçamento(s) excluídos.${moves.length ? ` ${moves.length} rascunho(s) renumerado(s).` : ''}`)
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
<div className="row gap-s wrap qt-actions">
          <AskAIButton />
          {/* organizar nº e orçamento antigo: ferramentas só da dona */}
          {isOwner && (
            <>
              <button className="btn ghost" onClick={() => setNumbering(true)} title="Coloca os rascunhos em sequência depois do último número (enviados não mudam)">
                <Icon name="list" size={16} /> organizar nº
              </button>
              <button className="btn ghost" onClick={() => setPartnerOpen(true)} title="Tabela com valores especiais para um escritório parceiro (PDF no seu modelo)">
                <Icon name="briefcase" size={16} /> orçamento parceria
              </button>
              <button id="btn-orcamento-antigo" className="btn ghost" onClick={() => go('orcamentos', 'antigo')} title="Trabalho feito antes do sistema: orçamento completo, sem número, na data real">
                <Icon name="clock" size={16} /> Orçamento antigo
              </button>
            </>
          )}
                  <button className="btn primary" onClick={() => go('orcamentos', 'novo')}>
          <Icon name="plus" size={16} /> Novo orçamento
        </button>
        </div>
      </div>

      <div className="stats">
        <Stat label="Em negociação" value={money(sum(pending, (x) => quoteTotal(x, fee)))} sub={`${pending.length} proposta(s) aguardando resposta`} icon="clock" onClick={() => setFilter('enviado')} />
        <Stat
          label="Cobrar resposta"
          value={followUps.length}
          sub="sem retorno há 1+ dia útil"
          icon="alert"
          tone={followUps.length ? 'warn' : undefined}
          onClick={() => setFilter('cobrar')}
        />
        <Stat label="Taxa de aprovação" value={decided.length ? `${Math.round((approved.length / decided.length) * 100)}%` : '—'} sub={`${approved.length} de ${decided.length} encerrados`} icon="target" />
        <Stat label="Valor aprovado" value={money(sum(approved, (x) => quoteDeal(x, fee)))} sub={approved.length ? `ticket médio ${money(sum(approved, (x) => quoteDeal(x, fee)) / approved.length)}` : undefined} icon="check" tone="good" />
      </div>

      <Funnel />

      <PartnerQuotes open={partnerOpen} onOpen={setPartnerOpen} />

      {data.quotes.length > 0 && (
        <section className="card status-mix" aria-label="Orçamentos por status">
          <div className="mix-bar">
            {(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((k) => {
              const n = data.quotes.filter((x) => x.status === k).length
              return n ? <span key={k} style={{ flexGrow: n, background: QUOTE_STATUS[k].color }} title={`${QUOTE_STATUS[k].label}: ${n}`} /> : null
            })}
          </div>
          <div className="mix-legend">
            {(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((k) => {
              const n = data.quotes.filter((x) => x.status === k).length
              return (
                <button key={k} className={`mix-item ${filter === k ? 'on' : ''}`} onClick={() => setFilter(filter === k ? 'todos' : k)}>
                  <i style={{ background: QUOTE_STATUS[k].color }} />
                  <b>{n}</b> {QUOTE_STATUS[k].label.toLowerCase()}
                  <span className="muted">{Math.round((n / data.quotes.length) * 100)}%</span>
                </button>
              )
            })}
            <span className="mix-total muted small">
              {data.quotes.length} no total{decided.length ? ` · dos encerrados, ${Math.round((approved.length / decided.length) * 100)}% aprovados` : ''}
            </span>
          </div>
        </section>
      )}

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
        <select value={order} onChange={(e) => setOrder(e.target.value as QuoteOrder)} aria-label="Ordenar por" title="Ordenar por">
          {(Object.keys(QUOTE_ORDERS) as QuoteOrder[]).map((k) => (
            <option key={k} value={k}>
              ordenar: {QUOTE_ORDERS[k].label}
            </option>
          ))}
        </select>
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
                  selecionar todos ({rows.length})
                </button>
              )}
              <span className="muted small">mudar para</span>
              {(['rascunho', 'enviado', 'aprovado', 'recusado'] as QuoteStatus[]).map((st) => (
                <button key={st} className="btn small ghost" onClick={() => bulkStatus(st)}>
                  {QUOTE_STATUS[st].label.toLowerCase()}
                </button>
              ))}
              <button className="btn small ghost" onClick={bulkDuplicate} title="Cópias com a data de hoje e os próximos números">
                <Icon name="copy" size={14} /> duplicar
              </button>
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
                      <div className="list-title">
                        {x.title || 'Sem título'}
                        {x.mode === 'opcoes' && <span className="mini-tag">{`${Math.min(3, x.options.length)} ${x.combo ? 'propostas' : 'opções'}`}</span>}
                      </div>
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
                        <span className={needsFollowUp(x) ? 'text-warn' : 'muted'}>
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
      {numbering && <NumberingModal onClose={() => setNumbering(false)} />}
    </div>
  )
}

function NumberingModal({ onClose }: { onClose: () => void }) {
  const { data, replaceAll } = useStore()
  // só os rascunhos mudam de número; enviados, aprovados e antigos (com ou sem número) ficam como estão
  const plan = draftRenumber(data.quotes).map((r) => ({ id: r.id, from: data.quotes.find((q) => q.id === r.id)?.number ?? 0, to: r.number, why: 'rascunho' as const }))
  const q = (id: string) => data.quotes.find((x) => x.id === id)!
  const WHY = { vago: 'sem PDF → número vago pela data', rascunho: 'rascunho → em sequência', fim: 'sem PDF → depois do último' }
  const apply = () => {
    const to = new Map(plan.map((r) => [r.id, r.to]))
    replaceAll({ ...data, quotes: data.quotes.map((x) => (to.has(x.id) ? { ...x, number: to.get(x.id)! } : x)) })
    toast(`${plan.length} orçamento(s) renumerado(s).`)
    onClose()
  }
  return (
    <Modal
      wide
      title="organizar numeração"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            {plan.length ? 'Cancelar' : 'Fechar'}
          </button>
          {plan.length > 0 && (
            <button className="btn primary" onClick={apply}>
              <Icon name="check" size={15} /> Aplicar ({plan.length})
            </button>
          )}
        </>
      }
    >
      <div className="stack">
        <p className="muted small">
          Orçamentos <b>enviados, aprovados e antigos nunca mudam de número</b>. Só os <b>rascunhos</b> se organizam, em ordem de data, logo depois do último número usado. Orçamentos antigos lançados sem número continuam sem número.
        </p>
        {plan.length === 0 ? (
          <p className="numbering-ok">
            <Icon name="check" size={16} /> A numeração já está em ordem.
          </p>
        ) : (
          <ul className="numbering-list">
            {plan
              .slice()
              .sort((a, b) => a.to - b.to)
              .map((r) => {
                const x = q(r.id)
                return (
                  <li key={r.id}>
                    <span className="numbering-from">#{String(r.from).padStart(3, '0')}</span>
                    <Icon name="arrowRight" size={14} />
                    <b className="numbering-to">#{String(r.to).padStart(3, '0')}</b>
                    <span className="grow">
                      {x.title || 'sem título'} · {data.clients.find((c) => c.id === x.clientId)?.name ?? 'sem cliente'} · {fmtDate(x.createdAt)}
                    </span>
                    <span className="muted small">{WHY[r.why]}</span>
                  </li>
                )
              })}
          </ul>
        )}
      </div>
    </Modal>
  )
}

/** Funil do mês: quantos briefings viraram proposta e quantas propostas fecharam. */
function Funnel() {
  const { data } = useStore()
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const inMonth = (iso?: string | null) => !!iso && iso.slice(0, 7) === month
  const briefs = (data.briefings ?? []).filter((b) => inMonth(b.createdAt))
  const answered = briefs.filter((b) => b.status === 'respondido')
  const made = data.quotes.filter((q) => inMonth(q.createdAt) && !q.imported && !q.noNumber)
  const sent = made.filter((q) => q.status !== 'rascunho')
  const closed = made.filter((q) => q.status === 'aprovado')
  if (!briefs.length && !made.length) return null
  const steps: [string, number, string][] = [
    ...(briefs.length ? ([[briefs.length === 1 ? 'briefing enviado' : 'briefings enviados', briefs.length, 'clip'], [answered.length === 1 ? 'respondido' : 'respondidos', answered.length, 'check']] as [string, number, string][]) : []),
    [made.length === 1 ? 'proposta feita' : 'propostas feitas', made.length, 'file'],
    [sent.length === 1 ? 'enviada' : 'enviadas', sent.length, 'whatsapp'],
    [closed.length === 1 ? 'fechada' : 'fechadas', closed.length, 'target'],
  ]
  const top = Math.max(...steps.map((x) => x[1]), 1)
  const shift = (n: number) => {
    const d = new Date(`${month}-15T12:00:00`)
    d.setMonth(d.getMonth() + n)
    setMonth(d.toISOString().slice(0, 7))
  }
  const label = new Date(`${month}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return (
    <section className="card funnel" aria-label="Funil do mês">
      <div className="funnel-head">
        <b>funil do mês</b>
        <div className="row gap-s">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior">
            <Icon name="chevronL" size={15} />
          </button>
          <span className="small">{label}</span>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês" disabled={month >= today().slice(0, 7)}>
            <Icon name="chevronR" size={15} />
          </button>
        </div>
      </div>
      <ol className="funnel-steps">
        {steps.map(([name, n, icon], i) => {
          const prev = i ? steps[i - 1][1] : 0
          return (
            <li key={name}>
              <span className="funnel-bar" style={{ width: `${Math.max(8, (n / top) * 100)}%` }} />
              <span className="funnel-text">
                <Icon name={icon} size={14} />
                <b>{n}</b> {name}
                {i > 0 && prev > 0 && <small>{Math.round((n / prev) * 100)}%</small>}
              </span>
            </li>
          )
        })}
      </ol>
      {made.length > 0 && <p className="muted small funnel-note">{closed.length ? `De cada 10 propostas deste mês, ${Math.round((closed.length / made.length) * 10)} fecharam.` : 'Nenhuma proposta deste mês fechou ainda.'}</p>}
    </section>
  )
}
