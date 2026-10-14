import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { BarChart } from '../components/Charts'
import { Empty, Progress, Section, Stat } from '../components/ui'
import { DocScale, usePdf } from '../components/Print'
import type { Data, Settings } from '../types'
import { CLIENT_TYPES, MONTHS, allPayments, expensesInMonth, money, paymentFee, projectTotal, today } from '../utils'

/* Retrospectiva do ano: quanto entrou, melhores clientes, serviços que mais renderam, mês mais forte,
   horas, aprovação dos orçamentos e o limite do MEI. Com a arte pronta para postar. */

const yearOf = (iso?: string | null) => (iso ?? '').slice(0, 4)

export function retroStats(data: Data, year: string) {
  const pays = allPayments(data)
  const paid = pays.filter((x) => x.pay.paidDate && yearOf(x.pay.paidDate) === year)
  const received = paid.reduce((s, x) => s + x.pay.amount, 0)
  const months = MONTHS.map((_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const inMonth = paid.filter((x) => x.pay.paidDate!.slice(0, 7) === key)
    const got = inMonth.reduce((s, x) => s + x.pay.amount, 0)
    const fees = inMonth.reduce((s, x) => s + paymentFee(x.pay, data.settings), 0)
    const spent = expensesInMonth(data, key).reduce((s, e) => s + e.amount, 0) + fees
    return { key, got, spent }
  })
  const spent = months.reduce((s, m) => s + m.spent, 0)
  const best = months.reduce((b, m, i) => (m.got > months[b].got ? i : b), 0)
  const started = data.projects.filter((p) => yearOf(p.startDate || p.createdAt) === year && p.status !== 'cancelado')
  const delivered = data.projects.filter((p) => yearOf(p.deliveredDate) === year)
  const newClients = data.clients.filter((c) => yearOf(c.createdAt) === year)
  const served = new Set([...started.map((p) => p.clientId), ...paid.map((x) => x.project.clientId)].filter(Boolean))
  // melhores clientes: quem mais pagou no ano
  const byClient = new Map<string, number>()
  for (const x of paid) if (x.project.clientId) byClient.set(x.project.clientId, (byClient.get(x.project.clientId) ?? 0) + x.pay.amount)
  const topClients = [...byClient.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, value]) => ({ client: data.clients.find((c) => c.id === id), value }))
    .filter((x) => x.client)
  // serviços: pelos projetos que começaram no ano
  const byService = new Map<string, { name: string; count: number; value: number }>()
  for (const p of started) {
    const name = data.settings.services.find((s) => s.id === p.service)?.name || 'outros'
    const cur = byService.get(name) ?? { name, count: 0, value: 0 }
    byService.set(name, { name, count: cur.count + 1, value: cur.value + projectTotal(p) })
  }
  const topServices = [...byService.values()].sort((a, b) => b.value - a.value).slice(0, 4)
  // tipos de cliente
  const byType = new Map<string, number>()
  for (const id of served) {
    const c = data.clients.find((x) => x.id === id)
    if (c) byType.set(CLIENT_TYPES[c.type], (byType.get(CLIENT_TYPES[c.type]) ?? 0) + 1)
  }
  const quotes = data.quotes.filter((q) => yearOf(q.sentAt || q.createdAt) === year && q.status !== 'rascunho' && !q.noNumber)
  const approved = quotes.filter((q) => q.status === 'aprovado').length
  const hours = data.projects.flatMap((p) => p.timeLogs ?? []).filter((t) => yearOf(t.date) === year).reduce((s, t) => s + t.hours, 0)
  const ticket = started.length ? started.reduce((s, p) => s + projectTotal(p), 0) / started.length : 0
  return {
    received,
    spent,
    profit: received - spent,
    months,
    best: months[best].got > 0 ? best : -1,
    started: started.length,
    delivered: delivered.length,
    newClients: newClients.length,
    served: served.size,
    topClients,
    topServices,
    byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
    quotes: quotes.length,
    approved,
    rate: quotes.length ? Math.round((approved / quotes.length) * 100) : 0,
    hours,
    perHour: hours > 0 ? received / hours : 0,
    ticket,
  }
}
type Stats = ReturnType<typeof retroStats>

export default function Retro() {
  const { data } = useStore()
  const s0 = data.settings
  const years = useMemo(() => {
    const ys = new Set<string>([today().slice(0, 4)])
    for (const x of allPayments(data)) if (x.pay.paidDate) ys.add(yearOf(x.pay.paidDate))
    for (const p of data.projects) ys.add(yearOf(p.startDate || p.createdAt))
    return [...ys].filter((y) => /^\d{4}$/.test(y)).sort().reverse()
  }, [data])
  const [year, setYear] = useState(years[0])
  const st = useMemo(() => retroStats(data, year), [data, year])
  const [showValues, setShowValues] = useState(false)
  const pdf = usePdf()
  const art = <RetroArt s={s0} year={year} st={st} values={showValues} />
  const prev = useMemo(() => (years.includes(String(Number(year) - 1)) ? retroStats(data, String(Number(year) - 1)) : null), [data, year, years])
  const growth = prev && prev.received > 0 ? Math.round(((st.received - prev.received) / prev.received) * 100) : null
  const nothing = !st.received && !st.started && !st.quotes

  return (
    <div className="page retro">
      <div className="page-head">
        <div>
          <button className="link small muted-link" onClick={() => go('financeiro')}>
            <Icon name="chevronL" size={13} /> financeiro
          </button>
          <h1>
            seu <em>{year}</em>
          </h1>
        </div>
        {years.length > 1 && (
          <select className="retro-year" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Ano">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {nothing ? (
        <Empty icon="trend" title={`Ainda não há nada em ${year}`} text="Assim que entrarem pagamentos, projetos e orçamentos, a retrospectiva se monta sozinha." />
      ) : (
        <>
          <div className="stats">
            <Stat label="Recebido no ano" value={money(st.received)} icon="trend" tone="good" sub={growth !== null ? `${growth >= 0 ? '+' : ''}${growth}% em relação a ${Number(year) - 1}` : undefined} />
            <Stat label="Lucro" value={money(st.profit)} icon="target" tone={st.profit < 0 ? 'bad' : 'good'} sub={st.received ? `margem de ${Math.round((st.profit / st.received) * 100)}% · despesas ${money(st.spent)}` : undefined} />
            <Stat label="Projetos" value={st.started} icon="layers" sub={`${st.delivered} entregue(s) · ticket médio ${money(st.ticket)}`} />
            <Stat label="Clientes" value={st.served} icon="users" sub={`${st.newClients} novo(s) no ano`} />
          </div>

          {(s0.meiLimit > 0 || (s0.yearGoal ?? 0) > 0) && (
            <div className="grid-2 retro-bars">
              {(s0.yearGoal ?? 0) > 0 && (
                <div className="card retro-bar">
                  <b>meta do ano</b>
                  <Progress value={st.received} max={s0.yearGoal!} />
                  <small className="muted">
                    {Math.round((st.received / s0.yearGoal!) * 100)}% de {money(s0.yearGoal!)}
                  </small>
                </div>
              )}
              {s0.meiLimit > 0 && (
                <div className="card retro-bar">
                  <b>limite do MEI</b>
                  <Progress value={st.received} max={s0.meiLimit} color={st.received > s0.meiLimit * 0.85 ? '#b0675a' : undefined} />
                  <small className="muted">
                    usou {Math.round((st.received / s0.meiLimit) * 100)}% · {st.received > s0.meiLimit ? `passou ${money(st.received - s0.meiLimit)}: fale com a contadora` : `sobram ${money(s0.meiLimit - st.received)}`}
                  </small>
                </div>
              )}
            </div>
          )}

          <Section title="mês a mês">
            <BarChart
              labels={MONTHS.map((m) => m.slice(0, 3).toLowerCase())}
              series={[
                { label: 'recebido', color: 'var(--accent)', values: st.months.map((m) => m.got) },
                { label: 'despesas', color: 'var(--line-strong, #cfc5bf)', values: st.months.map((m) => m.spent) },
              ]}
              height={200}
            />
            {st.best >= 0 && (
              <p className="muted small">
                Mês mais forte: <b>{MONTHS[st.best].toLowerCase()}</b>, com {money(st.months[st.best].got)}.
              </p>
            )}
          </Section>

          <div className="grid-2 is-even">
            <Section title="melhores clientes">
              {st.topClients.length ? (
                <ol className="retro-list">
                  {st.topClients.map((x, i) => (
                    <li key={x.client!.id}>
                      <span className="retro-n">{i + 1}</span>
                      <button className="retro-client grow" onClick={() => go('clientes', x.client!.id)}>
                        {x.client!.name}
                      </button>
                      <b>{money(x.value)}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted small">Sem pagamentos recebidos no ano.</p>
              )}
            </Section>
            <Section title="serviços que mais renderam">
              {st.topServices.length ? (
                <ol className="retro-list">
                  {st.topServices.map((x, i) => (
                    <li key={x.name}>
                      <span className="retro-n">{i + 1}</span>
                      <span className="grow">
                        {x.name} <small className="muted">· {x.count} projeto(s)</small>
                      </span>
                      <b>{money(x.value)}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted small">Sem projetos no ano.</p>
              )}
            </Section>
          </div>

          <div className="stats">
            <Stat label="Orçamentos enviados" value={st.quotes} icon="file" sub={st.quotes ? `${st.approved} aprovado(s) · ${st.rate}% de aprovação` : undefined} />
            <Stat label="Horas registradas" value={st.hours ? `${Math.round(st.hours)}h` : '—'} icon="clock" sub={st.perHour ? `${money(st.perHour)} por hora recebida` : 'use o cronômetro nas demandas'} />
            {st.byType[0] && <Stat label="Quem mais te contratou" value={st.byType[0][0]} icon="users" sub={st.byType.map(([t, n]) => `${t}: ${n}`).join(' · ')} />}
          </div>

          <Section title="arte para postar">
            <p className="muted small">Pronta para o feed ou para os stories. Os valores ficam escondidos, a menos que você queira mostrar.</p>
            <label className="check">
              <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} />
              <span>mostrar quanto recebi</span>
            </label>
            <div className="retro-art-wrap">
              <DocScale width={1080}>{art}</DocScale>
            </div>
            <button className="btn primary" disabled={pdf.busy} onClick={() => pdf.downloadPng(art, `retrospectiva-${year}.png`)}>
              <Icon name="download" size={15} /> {pdf.busy ? 'gerando…' : 'baixar imagem'}
            </button>
          </Section>
        </>
      )}
      {pdf.portal}
    </div>
  )
}

/** Arte 1080 × 1350 com as cores da pessoa. */
function RetroArt({ s, year, st, values }: { s: Settings; year: string; st: Stats; values: boolean }) {
  const brand = s.brandName || s.ownerName || 'meu estúdio'
  const items = [
    { n: String(st.started), t: st.started === 1 ? 'projeto' : 'projetos' },
    { n: String(st.served), t: st.served === 1 ? 'cliente atendido' : 'clientes atendidos' },
    ...(st.delivered ? [{ n: String(st.delivered), t: st.delivered === 1 ? 'entrega' : 'entregas' }] : []),
    ...(st.quotes ? [{ n: `${st.rate}%`, t: 'dos orçamentos aprovados' }] : []),
    ...(st.hours ? [{ n: `${Math.round(st.hours)}h`, t: 'de projeto' }] : []),
    ...(values && st.received ? [{ n: money(st.received).replace(',00', ''), t: 'recebidos', money: true }] : []),
  ].slice(0, 6)
  return (
    <div className="retro-art" style={{ ['--ra-accent' as string]: s.accent, ['--ra-soft' as string]: s.accentSoft || '#d6b3ab', ['--ra-ink' as string]: s.text || '#3e4b57', ['--ra-bg' as string]: s.background || '#f5f1ee' }}>
      <div className="ra-glow" />
      <p className="ra-kick">retrospectiva</p>
      <h2 className="ra-year">{year}</h2>
      <p className="ra-brand">{brand}</p>
      <div className="ra-grid">
        {items.map((x) => (
          <div key={x.t} className={`ra-item ${'money' in x ? 'is-money' : ''}`}>
            <b>{x.n}</b>
            <span>{x.t}</span>
          </div>
        ))}
      </div>
      {st.best >= 0 && (
        <p className="ra-line">
          mês mais forte: <b>{MONTHS[st.best].toLowerCase()}</b>
        </p>
      )}
      {st.topServices[0] && (
        <p className="ra-line">
          o que mais fiz: <b>{st.topServices[0].name}</b>
        </p>
      )}
      <p className="ra-thanks">gratidão a cada cliente que confiou no meu trabalho.</p>
      <p className="ra-foot">
        {s.instagram ? `@${s.instagram.replace(/^@/, '')}` : brand}
        <span>feito com planê</span>
      </p>
    </div>
  )
}
