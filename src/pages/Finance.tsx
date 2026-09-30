import { useMemo, useState } from 'react'
import { useAccess } from '../access'
import { useKeep } from '../keep'
import { useStore } from '../store'
import { href } from '../router'
import { Icon } from '../components/Icon'
import { ExpenseForm } from '../components/forms'
import { BarChart, Donut, PALETTE } from '../components/Charts'
import { Badge, DesktopNote, Empty, MonthPicker, Progress, Section, Segmented, Stat, usePaged } from '../components/ui'
import { askDelete } from '../components/dialog'
import type { Expense, Project, Quote } from '../types'
import { CloseDeal } from './../components/quick'
import { BillModal } from '../components/Bill'
import { approvedWithoutProject, launchPaidQuote } from '../quoteActions'
import { toast } from '../components/dialog'
import {
  CLIENT_TYPES,
  EXPENSE_CATEGORIES,
  MONTHS,
  allPayments,
  download,
  expensesInMonth,
  fmtDate,
  fmtDateLong,
  isStudent,
  lastMonths,
  money,
  monthKey,
  monthLabel,
  monthSummary,
  paymentState,
  quoteDeal,
  quoteNumber,
  PAY_WHEN,
  payWhen,
  sum,
  today,
} from '../utils'

type Tab = 'receber' | 'despesas' | 'relatorios'
type PayFilter = 'abertos' | 'cobrar' | 'pagos' | 'todos'

export default function Finance() {
  const { data, upsert, remove } = useStore()
  const { settings } = data
  const [month, setMonth] = useKeep('fin-mes', monthKey(today()))
  const [tab, setTab] = useKeep<Tab>('fin-aba', 'receber')
  const [filter, setFilter] = useKeep<PayFilter>('fin-filtro', 'abertos')
  const [onlyMonth, setOnlyMonth] = useKeep('fin-so-mes', false)
  const [expForm, setExpForm] = useState<Expense | 'new' | null>(null)
  const [bill, setBill] = useState<Project | null>(null)
  const canPdf = useAccess().has('propostaPdf') // recibos em PDF: plano Completo

  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const s = useMemo(() => monthSummary(data, month), [data, month])
  const pays = useMemo(() => allPayments(data), [data])
  // clientes antigos: o seletor de mês começa no primeiro pagamento ou despesa lançado
  const firstMonth = useMemo(() => [...pays.map((x) => x.pay.paidDate || x.pay.dueDate), ...data.expenses.map((e) => e.date)].filter(Boolean).map((d) => monthKey(d!)).sort()[0] ?? '2026-01', [pays, data.expenses])
  // o gráfico fica parado nos 12 meses até hoje; só anda se o mês escolhido estiver fora dele
  const nowKey = monthKey(today())
  const months12 = lastMonths(12, `${month > nowKey || !lastMonths(12, `${nowKey}-01`).includes(month) ? month : nowKey}-01`)
  const series = months12.map((k) => monthSummary(data, k))

  const rows = pays
    .filter(({ pay, project }) => {
      const st = paymentState(pay, project)
      if (filter === 'abertos' && st === 'pago') return false
      if (filter === 'cobrar' && st !== 'cobrar') return false
      if (filter === 'pagos' && st !== 'pago') return false
      if (onlyMonth) return pay.paidDate ? monthKey(pay.paidDate) === month : !pay.dueDate || monthKey(pay.dueDate) === month
      return true
    })
    .sort((a, b) => (filter === 'pagos' ? (b.pay.paidDate ?? '').localeCompare(a.pay.paidDate ?? '') : (a.pay.dueDate || '9').localeCompare(b.pay.dueDate || '9')))

  const { visible, more } = usePaged(rows, 30, 'financeiro')
  const expenses = expensesInMonth(data, month).sort((a, b) => a.date.localeCompare(b.date))
  const lateTotal = sum(pays.filter((x) => paymentState(x.pay, x.project) === 'cobrar'), (x) => x.pay.amount)

  const markPaid = (projectId: string, payId: string, paid: boolean) => {
    const p = data.projects.find((x) => x.id === projectId)
    if (!p) return
    upsert('projects', { ...p, payments: p.payments.map((x) => (x.id === payId ? { ...x, paidDate: paid ? today() : null } : x)) })
  }

  const exportCSV = () => {
    const lines = [
      ['Cliente', 'Tipo', 'Projeto', 'Parcela', 'Valor', 'Vencimento', 'Pago em', 'Forma'].join(';'),
      ...pays.map(({ pay, project, client }) =>
        [client?.name ?? '', client ? CLIENT_TYPES[client.type] : '', project.title, pay.description, pay.amount.toFixed(2).replace('.', ','), pay.dueDate, pay.paidDate ?? '', pay.method]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(';'),
      ),
    ]
    download(`recebimentos-${today()}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8')
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Financeiro</p>
          <div className="month-nav">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior">
              <Icon name="chevronL" />
            </button>
            <MonthPicker value={month} onChange={setMonth} from={firstMonth} />
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês">
              <Icon name="chevronR" />
            </button>
            {month !== monthKey(today()) && (
              <button className="btn small ghost" onClick={() => setMonth(monthKey(today()))}>
                Hoje
              </button>
            )}
          </div>
        </div>
        <div className="row gap-s">
          <button className="btn ghost" onClick={exportCSV}>
            <Icon name="download" size={16} /> CSV
          </button>
          <button className="btn primary" onClick={() => setExpForm('new')}>
            <Icon name="plus" size={16} /> Despesa
          </button>
        </div>
      </div>

      <div className="stats">
        <Stat
          label="Recebido no mês"
          value={money(s.received)}
          icon="trend"
          tone="good"
          sub={
            settings.monthlyGoal ? (
              <>
                <Progress value={s.received} max={settings.monthlyGoal} />
                <span>
                  {Math.round((s.received / settings.monthlyGoal) * 100)}% da meta · faltam {money(Math.max(0, settings.monthlyGoal - s.received))}
                </span>
              </>
            ) : undefined
          }
        />
        <Stat label="Previsto a receber" value={money(s.toReceive)} icon="clock" sub="parcelas pendentes neste mês" />
        <Stat label="Despesas" value={money(s.expenses)} icon="wallet" sub={s.fees ? `${expenses.length} lançamento(s) + ${money(s.fees)} de taxa do cartão` : `${expenses.length} lançamento(s)`} />
        <Stat label="Lucro" value={money(s.profit)} icon="target" tone={s.profit < 0 ? 'bad' : 'good'} sub={s.received ? `margem de ${Math.round((s.profit / s.received) * 100)}%` : undefined} />
      </div>

      {settings.meiLimit > 0 && <MeiBar year={month.slice(0, 4)} />}

      <OldWorkNotice />

      {lateTotal > 0 && (
        <div className="alert-strip is-warn">
          <Icon name="alert" />
          <div>
            Você tem <b>{money(lateTotal)}</b> para cobrar (sinais em aberto e saldos de demandas concluídas).{' '}
            <button className="link" onClick={() => { setTab('receber'); setFilter('cobrar'); setOnlyMonth(false) }}>
              Ver e cobrar →
            </button>
          </div>
        </div>
      )}

      <DesktopNote>O gráfico dos últimos 12 meses aparece no computador.</DesktopNote>
      <Section title="Últimos 12 meses" className="hide-mobile">
        <BarChart
          labels={months12.map((k) => MONTHS[Number(k.slice(5)) - 1].slice(0, 3))}
          goal={settings.monthlyGoal || undefined}
          selected={months12.indexOf(month)}
          onSelect={(i) => setMonth(months12[i])}
          selectTitle={(i) => `ver ${monthLabel(months12[i]).toLowerCase()}`}
          series={[
            { label: 'Recebido', color: 'var(--accent)', values: series.map((x) => x.received) },
            { label: 'Despesas', color: 'var(--accent-soft)', values: series.map((x) => x.expenses) },
          ]}
        />
      </Section>

      <div className="tabs">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'receber', label: 'Recebimentos' },
            { value: 'despesas', label: 'Despesas' },
            { value: 'relatorios', label: 'Relatórios' },
          ]}
        />
      </div>

      {tab === 'receber' && (
        <Section
          title="Parcelas"
          action={
            <div className="row gap-s wrap">
              <select value={filter} onChange={(e) => setFilter(e.target.value as PayFilter)}>
                <option value="abertos">Em aberto</option>
                <option value="cobrar">A cobrar</option>
                <option value="pagos">Pagos</option>
                <option value="todos">Todos</option>
              </select>
              <label className="check">
                <input type="checkbox" checked={onlyMonth} onChange={(e) => setOnlyMonth(e.target.checked)} /> Só {MONTHS[Number(month.slice(5)) - 1].toLowerCase()}
              </label>
            </div>
          }
        >
          {rows.length === 0 ? (
            <Empty icon="wallet" title="Nenhuma parcela" text="Nada com esse filtro." />
          ) : (
            <div className="table-wrap">
              <table className="table cards-mobile parcel-table">
                <thead>
                  <tr>
                    <th>Cliente / projeto</th>
                    <th>Parcela</th>
                    <th>Quando</th>
                    <th className="num">Valor</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ pay, project, client }) => {
                    const st = paymentState(pay, project)
                    return (
                      <tr key={pay.id}>
                        <td>
                          <div className="list-title">{client?.name ?? '—'}</div>
                          <a className="list-sub" href={href('projetos', project.id)}>
                            {project.title}
                          </a>
                        </td>
                        <td data-label="parcela">{pay.description}</td>
                        <td data-label="quando" className={`nowrap ${st === 'cobrar' ? 'text-warn' : ''}`}>
                          {PAY_WHEN[payWhen(pay)]}
                          {!pay.paidDate && (
                            <div className="small muted">
                              {st === 'cobrar' ? 'já pode cobrar' : pay.dueDate ? `prazo ${fmtDate(pay.dueDate)}` : 'sem prazo definido'}
                            </div>
                          )}
                        </td>
                        <td className="num" data-label="valor">{money(pay.amount)}</td>
                        <td className="parcel-action">
                          {canPdf && (
                            <button className="icon-btn subtle" title="Recibo de cobrança (PDF ou PNG)" onClick={() => setBill(project)}>
                              <Icon name="file" size={16} />
                            </button>
                          )}
                          {pay.paidDate ? (
                            <button className="pill pill-pago" title="Clique para desfazer" onClick={() => markPaid(project.id, pay.id, false)}>
                              pago {fmtDate(pay.paidDate)}
                            </button>
                          ) : (
                            <button className={`btn small ${st === 'cobrar' ? 'warn' : ''}`} onClick={() => markPaid(project.id, pay.id, true)}>
                              Marcar pago
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="muted">
                      {rows.length} parcela(s)
                    </td>
                    <td className="num">
                      <b>{money(sum(rows, (r) => r.pay.amount))}</b>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              {more && <div className="table-more">{more}</div>}
            </div>
          )}
        </Section>
      )}

      {tab === 'despesas' && (
        <Section
          title={`Despesas de ${monthLabel(month).toLowerCase()}`}
          action={
            <button className="btn small" onClick={() => setExpForm('new')}>
              <Icon name="plus" size={14} /> Despesa
            </button>
          }
        >
          {expenses.length === 0 ? (
            <Empty icon="wallet" title="Sem despesas neste mês" text="Cadastre licenças (V-Ray, D5, Lumion, SketchUp), DAS do MEI, internet… Marque como mensal para repetir automaticamente." />
          ) : (
            <div className="table-wrap">
              <table className="table cards-mobile">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Data</th>
                    <th className="num">Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="clickable" onClick={() => setExpForm(e)}>
                      <td>
                        {e.description} {e.recurring && <Badge color="#7d8c99">mensal</Badge>}
                      </td>
                      <td className="muted">{EXPENSE_CATEGORIES[e.category]}</td>
                      <td className="muted">{e.recurring ? `desde ${fmtDateLong(e.date)}` : fmtDate(e.date)}</td>
                      <td className="num">{money(e.amount)}</td>
                      <td className="actions" onClick={(ev) => ev.stopPropagation()}>
                        <button className="icon-btn" onClick={async () => (await askDelete(`a despesa "${e.description}"${e.recurring ? ' (de todos os meses)' : ''}`)) && remove('expenses', e.id)}>
                          <Icon name="trash" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="muted">
                      Total
                    </td>
                    <td className="num">
                      <b>{money(sum(expenses, (e) => e.amount))}</b>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>
      )}

      {tab === 'relatorios' && <Reports month={month} />}

      {bill && <BillModal p={bill} onClose={() => setBill(null)} />}
      {expForm && <ExpenseForm initial={expForm === 'new' ? undefined : expForm} onClose={() => setExpForm(null)} />}
    </div>
  )
}

function Reports({ month }: { month: string }) {
  const { data } = useStore()
  const since = lastMonths(12, `${month}-01`)[0]
  const received = allPayments(data).filter((x) => x.pay.paidDate && monthKey(x.pay.paidDate) >= since && monthKey(x.pay.paidDate) <= month)

  const group = <K extends string>(keyOf: (x: (typeof received)[number]) => K) => {
    const m = new Map<K, number>()
    received.forEach((x) => m.set(keyOf(x), (m.get(keyOf(x)) ?? 0) + x.pay.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  const byService = group((x) => data.settings.services.find((s) => s.id === x.project.service)?.name ?? 'Outros')
  const byType = group((x) => (x.client ? CLIENT_TYPES[x.client.type] : 'Outro'))
  const byClient = group((x) => x.client?.name ?? '—').slice(0, 8)
  const byOrigin = group((x) => x.client?.origin || 'Não informado')
  const total = sum(received, (x) => x.pay.amount)
  const studentShare = total ? sum(received.filter((x) => isStudent(x.client)), (x) => x.pay.amount) / total : 0

  const expByCat = new Map<string, number>()
  lastMonths(12, `${month}-01`).forEach((k) =>
    expensesInMonth(data, k).forEach((e) => expByCat.set(EXPENSE_CATEGORIES[e.category], (expByCat.get(EXPENSE_CATEGORIES[e.category]) ?? 0) + e.amount)),
  )

  const toDonut = (arr: [string, number][]) => arr.slice(0, 7).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))

  if (!received.length) return <Empty icon="trend" title="Ainda sem receitas nos últimos 12 meses" />

  return (
    <div className="stack">
      <p className="muted">
        Últimos 12 meses até {monthLabel(month).toLowerCase()} · {money(total)} recebidos · {Math.round(studentShare * 100)}% vindo de estudantes
      </p>
      <div className="grid-2 is-even">
        <Section title="Por tipo de serviço">
          <Donut data={toDonut(byService)} />
        </Section>
        <Section title="Por tipo de cliente">
          <Donut data={toDonut(byType)} />
        </Section>
        <Section title="Despesas por categoria">
          <Donut data={toDonut([...expByCat.entries()].sort((a, b) => b[1] - a[1]))} />
        </Section>
        <Section title="Como os clientes chegaram">
          <ul className="bars">
            {byOrigin.map(([name, v]) => (
              <li key={name}>
                <span>{name}</span>
                <Progress value={v} max={byOrigin[0][1]} />
                <b>{money(v)}</b>
              </li>
            ))}
          </ul>
        </Section>
      </div>
      <Section title="Melhores clientes">
        <ul className="bars">
          {byClient.map(([name, v]) => (
            <li key={name}>
              <span>{name}</span>
              <Progress value={v} max={byClient[0][1]} />
              <b>{money(v)}</b>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

/** Faturamento do ano (pelo que foi recebido) comparado ao teto anual do MEI. */
function MeiBar({ year }: { year: string }) {
  const { data } = useStore()
  const limit = data.settings.meiLimit
  const received = sum(
    allPayments(data).filter((x) => x.pay.paidDate?.startsWith(year)),
    (x) => x.pay.amount,
  )
  const pct = Math.round((received / limit) * 100)
  const isCurrent = year === today().slice(0, 4)
  const monthsElapsed = isCurrent ? new Date().getMonth() + 1 : 12
  const projection = (received / monthsElapsed) * 12
  const tone = pct >= 90 ? 'text-bad' : pct >= 70 || projection > limit ? 'text-warn' : 'muted'
  return (
    <div className="mei card">
      <div className="mei-top">
        <span className="stat-label">limite do MEI em {year}</span>
        <span className={`small ${tone}`}>
          {money(received)} de {money(limit)} · {pct}%
        </span>
      </div>
      <Progress value={received} max={limit} color={pct >= 90 ? 'var(--bad)' : pct >= 70 ? 'var(--warn)' : undefined} />
      {isCurrent && received > 0 && (
        <p className={`small ${projection > limit ? 'text-warn' : 'muted'}`}>
          No ritmo atual, o ano fecha em cerca de {money(projection)}
          {projection > limit ? ' — acima do teto. Vale conversar com um contador sobre migrar para ME.' : '.'}
        </p>
      )}
    </div>
  )
}

/** Clientes antigos fora do financeiro: orçamentos aprovados sem demanda e demandas sem nenhuma parcela.
 *  Um toque lança tudo como recebido na data certa (o gráfico e o "recebido no mês" passam a contar). */
function OldWorkNotice() {
  const { data, upsert } = useStore()
  const [open, setOpen] = useState(false)
  const fee = data.settings.urgencyFee
  const quotes = approvedWithoutProject(data)
  const bare = data.projects.filter((p) => p.status !== 'cancelado' && !p.payments.length && p.value - (p.discount || 0) > 0)
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [closing, setClosing] = useState<Quote | null>(null)
  if (!quotes.length && !bare.length) return null
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? 'cliente'
  const total = sum(quotes.filter((q) => !skip.has(q.id)), (q) => quoteDeal(q, fee)) + sum(bare.filter((p) => !skip.has(p.id)), (p) => p.value - (p.discount || 0))
  const launch = () => {
    let n = 0
    for (const q of quotes) {
      if (skip.has(q.id)) continue
      const r = launchPaidQuote(q, fee)
      upsert('projects', r.project)
      upsert('quotes', r.quote)
      n++
    }
    for (const p of bare) {
      if (skip.has(p.id)) continue
      const on = p.deliveredDate || p.dueDate || p.startDate || p.createdAt.slice(0, 10)
      upsert('projects', { ...p, payments: [{ id: crypto.randomUUID(), description: 'Pagamento (trabalho antigo)', amount: Math.round((p.value - (p.discount || 0)) * 100) / 100, dueDate: on, paidDate: on, method: 'Pix' }] })
      n++
    }
    setOpen(false)
    toast(`${n} trabalho(s) antigo(s) lançados no financeiro como recebidos.`)
  }
  const toggle = (id: string) => setSkip((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })
  return (
    <div className="alert-strip is-info">
      <Icon name="inbox" />
      <div className="grow">
        <b>{quotes.length + bare.length} trabalho(s) de clientes antigos ainda fora do financeiro</b>
        <span className="muted small"> · orçamentos aprovados sem demanda{bare.length ? ' e demandas sem parcelas' : ''}. </span>
        <button className="link" onClick={() => setOpen((v) => !v)}>{open ? 'fechar' : 'ver e lançar →'}</button>
        {open && (
          <div className="stack" style={{ marginTop: 10 }}>
            <p className="small muted">Marcados entram como <b>recebidos</b> na data do orçamento (ou da entrega). Se algum ainda não foi pago, desmarque e aprove pelo orçamento para escolher as parcelas.</p>
            <ul className="old-work">
              {quotes.map((q) => (
                <li key={q.id}>
                  <label className="check">
                    <input type="checkbox" checked={!skip.has(q.id)} onChange={() => toggle(q.id)} />
                    <span className="grow">{clientName(q.clientId)} · {q.title || `orçamento ${quoteNumber(q)}`} <small className="muted">{fmtDate(q.closedAt || q.createdAt)}</small></span>
                    <b>{money(quoteDeal(q, fee))}</b>
                  </label>
                  <button className="link small" onClick={() => setClosing(q)} title="Para escolher parcelas, datas e o que já foi pago">
                    ainda não foi pago? aprovar com parcelas
                  </button>
                </li>
              ))}
              {bare.map((p) => (
                <li key={p.id}>
                  <label className="check">
                    <input type="checkbox" checked={!skip.has(p.id)} onChange={() => toggle(p.id)} />
                    <span className="grow">{clientName(p.clientId)} · {p.title} <small className="muted">demanda sem parcelas</small></span>
                    <b>{money(p.value - (p.discount || 0))}</b>
                  </label>
                </li>
              ))}
            </ul>
            <div className="row gap-s">
              <button className="btn primary small" onClick={launch} disabled={total <= 0}>lançar {money(total)} como recebido</button>
            </div>
          </div>
        )}
      </div>
      {closing && <CloseDeal q={closing} onClose={() => setClosing(null)} />}
    </div>
  )
}
