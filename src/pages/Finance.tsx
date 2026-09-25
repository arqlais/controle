import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { href } from '../router'
import { Icon } from '../components/Icon'
import { ExpenseForm } from '../components/forms'
import { BarChart, Donut, PALETTE } from '../components/Charts'
import { Badge, Empty, Progress, Section, Segmented, Stat, confirmDelete } from '../components/ui'
import type { Expense } from '../types'
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
  relativeDays,
  sum,
  today,
} from '../utils'

type Tab = 'receber' | 'despesas' | 'relatorios'
type PayFilter = 'abertos' | 'vencidos' | 'pagos' | 'todos'

export default function Finance() {
  const { data, upsert, remove } = useStore()
  const { settings } = data
  const [month, setMonth] = useState(monthKey(today()))
  const [tab, setTab] = useState<Tab>('receber')
  const [filter, setFilter] = useState<PayFilter>('abertos')
  const [onlyMonth, setOnlyMonth] = useState(false)
  const [expForm, setExpForm] = useState<Expense | 'new' | null>(null)

  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const s = useMemo(() => monthSummary(data, month), [data, month])
  const pays = useMemo(() => allPayments(data), [data])
  const months12 = lastMonths(12, `${month}-01`)
  const series = months12.map((k) => monthSummary(data, k))

  const rows = pays
    .filter(({ pay }) => {
      const st = paymentState(pay)
      if (filter === 'abertos' && st === 'pago') return false
      if (filter === 'vencidos' && st !== 'vencido') return false
      if (filter === 'pagos' && st !== 'pago') return false
      if (onlyMonth) return monthKey(pay.paidDate ?? pay.dueDate) === month
      return true
    })
    .sort((a, b) => (filter === 'pagos' ? (b.pay.paidDate ?? '').localeCompare(a.pay.paidDate ?? '') : a.pay.dueDate.localeCompare(b.pay.dueDate)))

  const expenses = expensesInMonth(data, month).sort((a, b) => a.date.localeCompare(b.date))
  const lateTotal = sum(pays.filter((x) => paymentState(x.pay) === 'vencido'), (x) => x.pay.amount)
  const openTotal = sum(pays.filter((x) => !x.pay.paidDate), (x) => x.pay.amount)

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
            <h1>{monthLabel(month)}</h1>
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
        <Stat label="Despesas" value={money(s.expenses)} icon="wallet" sub={`${expenses.length} lançamento(s)`} />
        <Stat label="Lucro" value={money(s.profit)} icon="target" tone={s.profit < 0 ? 'bad' : 'good'} sub={s.received ? `margem de ${Math.round((s.profit / s.received) * 100)}%` : undefined} />
      </div>

      {lateTotal > 0 && (
        <div className="alert-strip">
          <Icon name="alert" />
          <div>
            Você tem <b>{money(lateTotal)}</b> em parcelas vencidas.{' '}
            <button className="link" onClick={() => { setTab('receber'); setFilter('vencidos'); setOnlyMonth(false) }}>
              Ver e cobrar →
            </button>
          </div>
        </div>
      )}

      <Section title="Últimos 12 meses">
        <BarChart
          labels={months12.map((k) => MONTHS[Number(k.slice(5)) - 1].slice(0, 3))}
          goal={settings.monthlyGoal || undefined}
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
            { value: 'receber', label: `Recebimentos · ${money(openTotal)} em aberto` },
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
                <option value="vencidos">Vencidos</option>
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
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente / projeto</th>
                    <th>Parcela</th>
                    <th>Vencimento</th>
                    <th className="num">Valor</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ pay, project, client }) => {
                    const st = paymentState(pay)
                    return (
                      <tr key={pay.id}>
                        <td>
                          <div className="list-title">{client?.name ?? '—'}</div>
                          <a className="list-sub" href={href('projetos', project.id)}>
                            {project.title}
                          </a>
                        </td>
                        <td>{pay.description}</td>
                        <td className={`nowrap ${st === 'vencido' ? 'text-bad' : ''}`}>
                          {fmtDate(pay.dueDate)}
                          {!pay.paidDate && <div className="small muted">{relativeDays(pay.dueDate)}</div>}
                        </td>
                        <td className="num">{money(pay.amount)}</td>
                        <td>
                          {pay.paidDate ? (
                            <button className="pill pill-pago" title="Clique para desfazer" onClick={() => markPaid(project.id, pay.id, false)}>
                              pago {fmtDate(pay.paidDate)}
                            </button>
                          ) : (
                            <button className={`btn small ${st === 'vencido' ? 'danger' : ''}`} onClick={() => markPaid(project.id, pay.id, true)}>
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
              <table className="table">
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
                        {e.description} {e.recurring && <Badge color="#6b7f86">mensal</Badge>}
                      </td>
                      <td className="muted">{EXPENSE_CATEGORIES[e.category]}</td>
                      <td className="muted">{e.recurring ? `desde ${fmtDateLong(e.date)}` : fmtDate(e.date)}</td>
                      <td className="num">{money(e.amount)}</td>
                      <td className="actions" onClick={(ev) => ev.stopPropagation()}>
                        <button className="icon-btn" onClick={() => confirmDelete(`a despesa "${e.description}"${e.recurring ? ' (de todos os meses)' : ''}`) && remove('expenses', e.id)}>
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
      <div className="grid-2">
        <Section title="Por tipo de serviço">
          <Donut data={toDonut(byService)} />
        </Section>
        <Section title="Por tipo de cliente">
          <Donut data={toDonut(byType)} />
        </Section>
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
        <Section title="Despesas por categoria">
          <Donut data={toDonut([...expByCat.entries()].sort((a, b) => b[1] - a[1]))} />
        </Section>
      </div>
    </div>
  )
}
