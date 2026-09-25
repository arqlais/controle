import { useMemo } from 'react'
import { demoData, useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { Badge, Empty, Progress, Section, Stat } from '../components/ui'
import { BarChart, Donut } from '../components/Charts'
import {
  EVENT_TYPES,
  MONTHS,
  PRIORITY,
  STATUS,
  allPayments,
  daysUntil,
  fmtDate,
  isLate,
  isOpen,
  isStudent,
  lastMonths,
  money,
  monthKey,
  monthSummary,
  paymentLate,
  projectHours,
  projectTotal,
  relativeDays,
  sum,
  today,
  urgency,
  urgencyScore,
} from '../utils'

export default function Dashboard({ onQuick }: { onQuick: (k: 'projeto' | 'cliente') => void }) {
  const { data, replaceAll } = useStore()
  const { settings } = data
  const t = today()
  const key = monthKey(t)

  const m = useMemo(() => monthSummary(data, key), [data, key])
  const pays = useMemo(() => allPayments(data), [data])
  const open = data.projects.filter(isOpen)
  const late = data.projects.filter(isLate)
  const latePays = pays.filter((x) => paymentLate(x.pay))
  const receivable = sum(pays.filter((x) => !x.pay.paidDate), (x) => x.pay.amount)

  const priorities = [...open].sort((a, b) => urgencyScore(b) - urgencyScore(a)).slice(0, 7)

  const upcoming = useMemo(() => {
    const items: { date: string; label: string; sub: string; color: string; link: string; kind: string }[] = []
    data.projects.filter(isOpen).forEach((p) => {
      if (p.dueDate && daysUntil(p.dueDate) >= 0 && daysUntil(p.dueDate) <= 7)
        items.push({ date: p.dueDate, label: p.title, sub: 'Entrega', color: PRIORITY[urgency(p).level].color, link: href('projetos', p.id), kind: 'entrega' })
    })
    pays.forEach(({ pay, project, client }) => {
      if (!pay.paidDate && daysUntil(pay.dueDate) >= 0 && daysUntil(pay.dueDate) <= 7)
        items.push({ date: pay.dueDate, label: `${money(pay.amount)} · ${client?.name ?? ''}`, sub: pay.description, color: '#2f855a', link: href('projetos', project.id), kind: 'pagamento' })
    })
    data.events.forEach((e) => {
      if (!e.done && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7)
        items.push({ date: e.date, label: e.title, sub: `${EVENT_TYPES[e.type].label}${e.time ? ` · ${e.time}` : ''}`, color: EVENT_TYPES[e.type].color, link: href('agenda'), kind: 'evento' })
    })
    return items.sort((a, b) => a.date.localeCompare(b.date))
  }, [data, pays])

  const months = lastMonths(6)
  const summaries = months.map((k) => monthSummary(data, k))

  const byProfile = useMemo(() => {
    const since = lastMonths(12)[0]
    const received = pays.filter((x) => x.pay.paidDate && monthKey(x.pay.paidDate) >= since)
    const prof = sum(received.filter((x) => !isStudent(x.client)), (x) => x.pay.amount)
    const stud = sum(received.filter((x) => isStudent(x.client)), (x) => x.pay.amount)
    return { prof, stud }
  }, [pays])

  // valor/hora do mês: recebido em projetos com horas lançadas
  const hourly = useMemo(() => {
    const worked = data.projects.filter((p) => p.status === 'entregue' && projectHours(p) > 0)
    const h = sum(worked, projectHours)
    return h ? sum(worked, projectTotal) / h : 0
  }, [data.projects])

  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const d = new Date()

  if (!data.clients.length && !data.projects.length) {
    return (
      <div className="page">
        <div className="hero">
          <p className="eyebrow">{settings.brandName}</p>
          <h1>Seu estúdio, organizado.</h1>
          <p className="lead">Clientes, demandas, prazos, orçamentos e financeiro num só lugar. Comece cadastrando um cliente ou explore com dados de exemplo.</p>
          <div className="row gap">
            <button className="btn primary" onClick={() => onQuick('cliente')}>
              <Icon name="plus" size={16} /> Cadastrar primeiro cliente
            </button>
            <button className="btn ghost" onClick={() => replaceAll(demoData(settings))}>
              Ver com dados de exemplo
            </button>
          </div>
          <p className="muted small">Dica: personalize logo, cores e sua tabela de preços em Configurações.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1>
            {hello}, {settings.ownerName || settings.brandName}
          </h1>
        </div>
        <button className="btn ghost" onClick={() => onQuick('projeto')}>
          <Icon name="plus" size={16} /> Nova demanda
        </button>
      </div>

      {(late.length > 0 || latePays.length > 0) && (
        <div className="alert-strip">
          <Icon name="alert" />
          <div>
            {late.length > 0 && (
              <a href={href('projetos')}>
                <b>{late.length}</b> {late.length === 1 ? 'projeto atrasado' : 'projetos atrasados'}
              </a>
            )}
            {late.length > 0 && latePays.length > 0 && ' · '}
            {latePays.length > 0 && (
              <a href={href('financeiro')}>
                <b>{latePays.length}</b> {latePays.length === 1 ? 'pagamento vencido' : 'pagamentos vencidos'} ({money(sum(latePays, (x) => x.pay.amount))})
              </a>
            )}
          </div>
        </div>
      )}

      <div className="stats">
        <Stat
          label={`Recebido em ${MONTHS[d.getMonth()].toLowerCase()}`}
          value={money(m.received)}
          icon="trend"
          sub={
            settings.monthlyGoal ? (
              <>
                <Progress value={m.received} max={settings.monthlyGoal} />
                <span>
                  {Math.round((m.received / settings.monthlyGoal) * 100)}% da meta de {money(settings.monthlyGoal)}
                </span>
              </>
            ) : undefined
          }
        />
        <Stat label="A receber (total)" value={money(receivable)} icon="wallet" sub={`${money(m.toReceive)} previstos este mês`} onClick={() => go('financeiro')} />
        <Stat
          label="Demandas ativas"
          value={open.length}
          icon="folder"
          tone={late.length ? 'bad' : undefined}
          sub={late.length ? `${late.length} atrasada(s)` : 'nenhuma atrasada'}
          onClick={() => go('projetos')}
        />
        <Stat
          label="Lucro do mês"
          value={money(m.profit)}
          icon="target"
          tone={m.profit < 0 ? 'bad' : 'good'}
          sub={hourly ? `valor/hora médio: ${money(hourly)}` : `despesas: ${money(m.expenses)}`}
        />
      </div>

      <div className="grid-2">
        <Section title="Prioridades agora" action={<a href={href('projetos')} className="link">Ver quadro →</a>}>
          {priorities.length === 0 ? (
            <Empty title="Nada em aberto" text="Sem demandas ativas no momento." />
          ) : (
            <ul className="list">
              {priorities.map((p) => {
                const u = urgency(p)
                const client = data.clients.find((c) => c.id === p.clientId)
                const done = p.tasks.filter((x) => x.done).length
                return (
                  <li key={p.id}>
                    <a href={href('projetos', p.id)} className="list-item">
                      <span className="prio-bar" style={{ background: PRIORITY[u.level].color }} />
                      <div className="grow">
                        <div className="list-title">{p.title}</div>
                        <div className="list-sub">
                          {client?.name} · {STATUS[p.status].label}
                          {p.tasks.length > 0 && ` · ${done}/${p.tasks.length} etapas`}
                        </div>
                      </div>
                      <div className="right">
                        <Badge color={PRIORITY[u.level].color}>{u.reason || PRIORITY[u.level].label}</Badge>
                        <div className="list-sub">{p.dueDate ? `${fmtDate(p.dueDate)} · ${relativeDays(p.dueDate)}` : 'sem prazo'}</div>
                      </div>
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section title="Próximos 7 dias" action={<a href={href('agenda')} className="link">Agenda →</a>}>
          {upcoming.length === 0 ? (
            <Empty icon="calendar" title="Semana livre" text="Nenhuma entrega, pagamento ou compromisso." />
          ) : (
            <ul className="timeline">
              {upcoming.map((u, i) => (
                <li key={i}>
                  <a href={u.link}>
                    <div className="tl-date">
                      <b>{u.date.slice(8)}</b>
                      <span>{daysUntil(u.date) === 0 ? 'hoje' : new Date(u.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                    </div>
                    <span className="dot" style={{ background: u.color }} />
                    <div className="grow">
                      <div className="list-title">{u.label}</div>
                      <div className="list-sub">{u.sub}</div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid-2 wide-left">
        <Section title="Receitas × despesas · 6 meses" action={<a href={href('financeiro')} className="link">Financeiro →</a>}>
          <BarChart
            labels={months.map((k) => MONTHS[Number(k.slice(5)) - 1].slice(0, 3))}
            goal={settings.monthlyGoal || undefined}
            series={[
              { label: 'Recebido', color: 'var(--accent)', values: summaries.map((s) => s.received) },
              { label: 'Despesas', color: 'var(--accent-soft)', values: summaries.map((s) => s.expenses) },
            ]}
          />
        </Section>
        <Section title="Receita por perfil · 12 meses">
          <Donut
            center={money(byProfile.prof + byProfile.stud).replace(',00', '')}
            data={[
              { label: 'Profissionais', value: byProfile.prof, color: 'var(--accent)' },
              { label: 'Estudantes', value: byProfile.stud, color: 'var(--accent-soft)' },
            ]}
          />
          <p className="muted small">Seu foco são profissionais — acompanhe aqui se os estudantes estão ocupando espaço demais na agenda.</p>
        </Section>
      </div>
    </div>
  )
}
