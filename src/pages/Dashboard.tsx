import { FirstSteps } from '../components/FirstSteps'
import { InstallHint } from '../components/InstallHint'
import { useMemo } from 'react'
import { useAccess } from '../access'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { Badge, DesktopNote, Empty, Progress, Section, Stat, usePaged } from '../components/ui'
import { needsFollowUp, waitingDays } from './Quotes'
import { BarChart, Donut } from '../components/Charts'
import { StatusSelect, TaskQuick } from '../components/quick'
import {
  EVENT_TYPES, eventLabel,
  MONTHS,
  PRIORITY,
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
  paymentDue,
  payWhen,
  relativeDays,
  sum,
  today,
  urgency,
  urgencyScore,
  templateText,
  STATUS,
  whatsappLink, addDays } from '../utils'

export default function Dashboard({ onQuick }: { onQuick: (k: 'projeto' | 'cliente') => void }) {
  const { data, showSample } = useStore()
  const access = useAccess()
  const { settings } = data
  const t = today()
  const key = monthKey(t)

  const m = useMemo(() => monthSummary(data, key), [data, key])
  const pays = useMemo(() => allPayments(data), [data])
  const open = data.projects.filter(isOpen)
  const late = data.projects.filter(isLate)
  const receivable = sum(pays.filter((x) => !x.pay.paidDate), (x) => x.pay.amount)

  const priorities = [...open].sort((a, b) => urgencyScore(b) - urgencyScore(a)).slice(0, 7)

  const upcoming = useMemo(() => {
    const items: { date: string; label: string; sub: string; color: string; link: string; kind: string }[] = []
    data.projects.filter(isOpen).forEach((p) => {
      if (p.dueDate && daysUntil(p.dueDate) >= 0 && daysUntil(p.dueDate) <= 7)
        items.push({ date: p.dueDate, label: p.title, sub: 'Entrega', color: PRIORITY[urgency(p).level].color, link: href('projetos', p.id), kind: 'entrega' })
    })
    pays.forEach(({ pay, project, client }) => {
      if (!pay.paidDate && pay.dueDate && daysUntil(pay.dueDate) >= 0 && daysUntil(pay.dueDate) <= 7)
        items.push({ date: pay.dueDate, label: `${money(pay.amount)} · ${client?.name ?? ''}`, sub: pay.description, color: '#4f6475', link: href('projetos', project.id), kind: 'pagamento' })
    })
    data.events.forEach((e) => {
      if (!e.done && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7)
        items.push({ date: e.date, label: e.title, sub: `${eventLabel(e)}${e.time ? ` · ${e.time}` : ''}`, color: EVENT_TYPES[e.type].color, link: href('agenda'), kind: 'evento' })
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


  const weekDeliveries = upcoming.filter((u) => u.kind === 'entrega').length
  // a bola está com a cliente (ajustes / aprovação): aparece na semana para lembrar de cobrar o retorno
  const waiting = open.filter((p) => p.status === 'revisao' || p.status === 'aguardando')
  const waitText = (p: (typeof open)[number]) =>
    templateText(
      settings,
      p.status === 'aguardando' ? 'retorno-aprovacao' : 'retorno-ajustes',
      p.status === 'aguardando'
        ? 'oii, {cliente}, tudo bem? ✨ passando para saber se conseguiu ver o projeto {projeto} e se está tudo de acordo. fico no aguardo para seguirmos ☺️'
        : 'oii, {cliente}, tudo bem? ✨ passando para saber se já conseguiu ver os ajustes do projeto {projeto}. fico no aguardo do seu retorno para seguirmos ☺️',
      data.clients.find((c) => c.id === p.clientId),
      p,
    )
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const d = new Date()

  if (!data.clients.length && !data.projects.length) {
    return (
      <div className="page">
        <FirstSteps />
        <div className="hero">
          <p className="eyebrow">{settings.tagline || settings.brandName}</p>
          <h1>
            seu estúdio, <em>organizado</em>
          </h1>
          <p className="lead">Clientes, demandas, prazos, orçamentos e financeiro num só lugar. Comece cadastrando um cliente ou explore com dados de exemplo.</p>
          <div className="row gap wrap">
            <button className="btn primary" onClick={() => onQuick('cliente')}>
              <Icon name="plus" size={16} /> Cadastrar primeiro cliente
            </button>
            <button className="btn ghost" onClick={() => showSample(true)}>
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
      <FirstSteps />
      <InstallHint />
      <section className="welcome">
        <div className="welcome-text">
          <p className="welcome-date">{d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>
            <em>{hello.toLowerCase()},</em> {(settings.ownerName || settings.brandName).toLowerCase()}
          </h1>
          <p className="welcome-sub">
            {/* uma frase só: o mais importante da semana (os valores ficam nos cards logo abaixo) */}
            {weekDeliveries > 0
              ? `${weekDeliveries} ${weekDeliveries === 1 ? 'entrega' : 'entregas'} nesta semana`
              : waiting.length
                ? `${waiting.length === 1 ? '1 demanda esperando' : `${waiting.length} demandas esperando`} retorno do cliente`
                : 'semana tranquila, sem entregas'}
          </p>
        </div>
        <div className="welcome-actions">
          <button className="btn light" onClick={() => onQuick('projeto')}>
            <Icon name="plus" size={16} /> nova demanda
          </button>
          <a className="btn outline-light" href={href('orcamentos', 'novo')}>
            novo orçamento
          </a>
        </div>
      </section>
      {!access.isOwner && (
        <a href={href('indique')} className="dash-promo only-mobile-flex">
          <span className="nav-promo-icon">
            <Icon name="gift" size={18} />
          </span>
          <span className="grow">
            <b>indique e ganhe</b>
            <small>1 mês grátis por amigo que assinar</small>
          </span>
          <Icon name="chevronR" size={16} />
        </a>
      )}

      <TodoList />

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
          sub={`despesas: ${money(m.expenses)}`}
        />
      </div>

      <div className="grid-2 is-even">
        <Section title="Prioridades agora" action={<a href={href('projetos')} className="link">Ver quadro →</a>}>
          {priorities.length === 0 ? (
            <Empty title="Nada em aberto" text="Sem demandas ativas no momento." />
          ) : (
            <ul className="list">
              {priorities.map((p) => {
                const u = urgency(p)
                const client = data.clients.find((c) => c.id === p.clientId)
                return (
                  <li key={p.id}>
                    <div className="list-item clickable" onClick={() => go('projetos', p.id)}>
                      <span className="prio-bar" style={{ background: PRIORITY[u.level].color }} />
                      <div className="grow">
                        <div className="list-title">{p.title}</div>
                        <div className="list-sub">{client?.name}</div>
                        <TaskQuick p={p} compact />
                      </div>
                      <div className="right">
                        <div className="row gap-s">
                          <StatusSelect p={p} />
                          <Badge color={PRIORITY[u.level].color}>{u.reason || PRIORITY[u.level].label}</Badge>
                        </div>
                        <div className="list-sub">{p.dueDate ? `${fmtDate(p.dueDate)} · ${relativeDays(p.dueDate)}` : 'sem prazo'}</div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section title="Próximos 7 dias" action={<a href={href('agenda')} className="link">Agenda →</a>}>
          {waiting.length > 0 && (
            <div className="waiting-list">
              <span className="field-label">esperando a cliente · cobrar retorno</span>
              <ul className="timeline">
                {waiting.map((p) => {
                  const c = data.clients.find((x) => x.id === p.clientId)
                  return (
                    <li key={p.id}>
                      <a href={href('projetos', p.id)}>
                        <span className="dot" style={{ background: STATUS[p.status].color }} />
                        <div className="grow">
                          <div className="list-title">{p.title}</div>
                          <div className="list-sub">
                            {STATUS[p.status].label.toLowerCase()} · {c?.name ?? ''}
                          </div>
                        </div>
                      </a>
                      {c?.phone && (
                        <a className="btn small ghost" href={whatsappLink(c.phone, waitText(p))} target="_blank" rel="noreferrer" title="Mensagem pedindo o retorno">
                          <Icon name="whatsapp" size={14} /> cobrar
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {upcoming.length === 0 ? (
            waiting.length ? null : <Empty icon="calendar" title="Semana livre" text="Nenhuma entrega, pagamento ou compromisso." />
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

      <DesktopNote>Os gráficos de receitas e despesas aparecem no computador.</DesktopNote>
      <div className="grid-2 is-even hide-mobile">
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

interface Todo {
  key: string
  tone: 'bad' | 'warn' | 'info'
  icon: string
  title: string
  sub: string
  link: string
  action?: { label: string; href?: string; onClick?: () => void; icon?: string }
}

/** O que precisa de atenção agora, com a ação a um clique. */
function TodoList() {
  const { data, upsert } = useStore()
  const todos = useMemo(() => {
    const out: Todo[] = []
    const client = (id: string) => data.clients.find((c) => c.id === id)

    for (const p of data.projects) {
      if (!isOpen(p)) continue
      const dd = p.dueDate ? daysUntil(p.dueDate) : 99
      if (dd <= 1)
        out.push({
          key: `e-${p.id}`,
          tone: dd < 0 ? 'bad' : 'warn',
          icon: 'flag',
          title: `${dd < 0 ? 'Atrasado' : dd === 0 ? 'Entregar hoje' : 'Entregar amanhã'}: ${p.title}`,
          sub: `${client(p.clientId)?.name ?? ''} · ${p.tasks.filter((t) => t.done).length}/${p.tasks.length} etapas`,
          link: href('projetos', p.id),
        })
      if (p.revisionsUsed > p.revisionsIncluded)
        out.push({ key: `r-${p.id}`, tone: 'warn', icon: 'edit', title: `Revisões extras em ${p.title}`, sub: `${p.revisionsUsed - p.revisionsIncluded} além das ${p.revisionsIncluded} combinadas — combine a cobrança`, link: href('projetos', p.id) })
    }
    for (const { pay, project, client: c } of allPayments(data)) {
      if (!paymentDue(pay, project)) continue
      const text = templateText(data.settings, 'cobranca', 'Oi, {cliente}! Passando para lembrar da parcela "{parcela}" de {valor_parcela}. Chave pix: {pix}.', c, project)
      out.push({
        key: `p-${pay.id}`,
        tone: 'warn',
        icon: 'wallet',
        title: `Cobrar ${money(pay.amount)} · ${c?.name ?? ''}`,
        sub: `${pay.description} · ${payWhen(pay) === 'fechamento' ? 'aguardando o sinal' : 'demanda concluída'}`,
        link: href('projetos', project.id),
        action: c?.phone
          ? { label: 'cobrar', href: whatsappLink(c.phone, text), icon: 'whatsapp' }
          : { label: 'marcar pago', onClick: () => upsert('projects', { ...project, payments: project.payments.map((x) => (x.id === pay.id ? { ...x, paidDate: today() } : x)) }) },
      })
    }
    // cliente final: etapa do cronograma perto do fim com parcela ligada → avisar o cliente antes
    for (const p of data.projects) {
      if (!isOpen(p)) continue
      for (const f of p.phases ?? []) {
        if (f.done || !f.due || !f.paymentId) continue
        const pay = p.payments.find((x) => x.id === f.paymentId)
        const d = daysUntil(f.due)
        if (!pay || pay.paidDate || d > 3 || d < -7) continue
        const c = client(p.clientId)
        const when = d < 0 ? `atrasada ${-d} dia${d === -1 ? '' : 's'}` : d === 0 ? 'termina hoje' : `termina em ${d} dia${d === 1 ? '' : 's'}`
        const pix = data.settings.pixKey ? ` A chave pix é ${data.settings.pixKey}.` : ''
        const text = `Oi, ${c?.name.split(' ')[0] ?? ''}! Passando para avisar que a etapa "${f.name}" do seu projeto fica pronta até ${fmtDate(f.due)}. Conforme combinamos, a parcela de ${money(pay.amount)} é paga na entrega dela.${pix} Qualquer dúvida, me chama!`
        out.push({
          key: `ph-${f.id}`,
          tone: d < 0 ? 'warn' : 'info',
          icon: 'layers',
          title: `Etapa ${f.name} ${when} · parcela ${money(pay.amount)}`,
          sub: `${c?.name ?? ''} · ${p.title} · avise antes da entrega`,
          link: href('projetos', p.id),
          action: c?.phone ? { label: 'avisar', href: whatsappLink(c.phone, text), icon: 'whatsapp' } : undefined,
        })
      }
    }
    // instagram: postagens de hoje (ou atrasadas) ainda não postadas
    for (const post of (data.settings.instagramOff ? [] : data.posts ?? []).filter((x) => x.date && x.date <= today() && x.date >= addDays(today(), -3) && x.status !== 'postado')) {
      out.push({
        key: `ig-${post.id}`,
        tone: post.date < today() ? 'warn' : 'info',
        icon: 'instagram',
        title: `${post.date < today() ? 'Postagem atrasada' : 'Postar hoje'}: ${post.title}`,
        sub: `${post.format}${post.time ? ` · ${post.time}` : ''} · ${post.status}`,
        link: href('instagram'),
        action: { label: 'postado', onClick: () => upsert('posts', { ...post, status: 'postado' }) },
      })
    }
    for (const q of data.quotes.filter(needsFollowUp)) {
      const c = client(q.clientId)
      const text = templateText(data.settings, 'retorno', 'Oi, {cliente}! Conseguiu ver a proposta {proposta}?', c, undefined, q)
      out.push({
        key: `q-${q.id}`,
        tone: 'info',
        icon: 'file',
        title: `Pedir retorno: orçamento #${String(q.number).padStart(3, '0')}`,
        sub: `${c?.name ?? ''} · sem resposta há ${waitingDays(q)} dias`,
        link: href('orcamentos', q.id),
        action: c?.phone ? { label: 'mensagem', href: whatsappLink(c.phone, text), icon: 'whatsapp' } : undefined,
      })
    }
    const order = { bad: 0, warn: 1, info: 2 }
    return out.sort((a, b) => order[a.tone] - order[b.tone])
  }, [data, upsert])

  const { visible, more } = usePaged(todos, 6, 'inicio-afazer')
  if (!todos.length) return null
  return (
    <Section title={`para fazer · ${todos.length}`}>
      <ul className="todo-list">
        {visible.map((t) => (
          <li key={t.key} className={`todo tone-${t.tone}`}>
            <span className="todo-icon">
              <Icon name={t.icon} size={16} />
            </span>
            <a href={t.link} className="grow">
              <div className="list-title">{t.title}</div>
              <div className="list-sub">{t.sub}</div>
            </a>
            {t.action &&
              (t.action.href ? (
                <a className="btn small" href={t.action.href} target="_blank" rel="noreferrer">
                  {t.action.icon && <Icon name={t.action.icon} size={14} />} {t.action.label}
                </a>
              ) : (
                <button className="btn small" onClick={t.action.onClick}>
                  {t.action.label}
                </button>
              ))}
          </li>
        ))}
      </ul>
      {more}
    </Section>
  )
}
