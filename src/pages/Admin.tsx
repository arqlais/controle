import { TermsText } from '../components/Terms'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Badge, Empty, Field, MoneyInput, Section, Segmented, Stat } from '../components/ui'
import { ask, toast } from '../components/dialog'
import { BarChart } from '../components/Charts'
import { useKeep } from '../keep'
import { ARTIFACT } from '../env'
import { PLANS, PLAN_LIST, PLAN_TOGGLES, PLATFORM, STATUS_LABEL, TRIAL_DAYS, annualPrice, money0, type PlanId, type SubStatus } from '../plans'
import { applyPlanConfig, type PlanConfig, type PlanOverride } from '../planConfig'
import { DAY_NAMES, SUGGESTION_CATEGORY, SUGGESTION_STATUS, hoursSummary, isOnline, platform, resetPreviewData, trialDaysLeft, type Billing, type OnlineHours, type Subscription, type Suggestion, type SuggestionStatus } from '../platform'
import { timeLabel, useConversation, useHours, useInbox } from '../chat'
import { DEFAULT_TERMS, EMPTY_COMPANY, TERMS_VARS, fillTerms, shrinkPhoto, type Company, type SiteContent } from '../siteContent'
import { formatDoc, matches, money } from '../utils'

/* Painel da plataforma: só a conta da dona vê (a nuvem confere pela tabela "admins"). */

type Tab = 'resumo' | 'assinantes' | 'conversas' | 'sugestoes' | 'site' | 'termos' | 'horarios' | 'ajustes'
const STATUS_COLOR: Record<SubStatus, string> = { trial: '#6b8f94', ativa: '#5e8c6a', atrasada: '#b98246', cancelada: '#9aa3ab' }
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dateBR = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`
}
const paying = (s: Subscription) => (s.status === 'ativa' || s.status === 'atrasada') && !s.blocked

export default function Admin() {
  const [tab, setTab] = useKeep<Tab>('painel-aba', 'resumo')
  const { msgs, subs, unread, reload, setSubs } = useInbox(true)
  // dados de cobrança (vindos da tela de assinatura) e sugestões de melhoria
  const [billing, setBilling] = useState<Record<string, Billing>>({})
  const [sugs, setSugs] = useState<Suggestion[]>([])
  const loadExtra = useCallback(async () => {
    try {
      const [b, sg] = await Promise.all([platform.allBilling(), platform.suggestions()])
      setBilling(b)
      setSugs(sg)
    } catch {
      /* tabelas ainda não criadas ou sem conexão */
    }
  }, [])
  useEffect(() => {
    void loadExtra()
  }, [loadExtra, subs])
  const newSugs = sugs.filter((x) => x.status === 'recebida').length
  const [chatWith, setChatWith] = useState('')

  const update = async (s: Subscription, patch: Partial<Subscription>, msg: string) => {
    try {
      await platform.updateSubscriber(s.userId, patch)
      setSubs((list) => list.map((x) => (x.userId === s.userId ? { ...x, ...patch } : x)))
      toast(msg)
    } catch {
      toast('Não foi possível salvar. Confira a internet e se o SQL da plataforma foi rodado no Supabase.')
    }
  }
  const openChat = (id: string) => {
    setChatWith(id)
    setTab('conversas')
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="crown" size={14} /> só você vê
          </p>
          <h1>
            painel <em>da plataforma</em>
          </h1>
        </div>
        {PLATFORM.provisional && (
          <span className="pf-provisional">
            nome e preços provisórios · <b>{PLATFORM.name}</b>
          </span>
        )}
      </div>
      <div className="pf-tabs">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'resumo', label: 'vendas' },
            { value: 'assinantes', label: `assinantes (${subs.length})` },
            { value: 'conversas', label: <>conversas{unread ? <em className="pf-dot-count">{unread}</em> : null}</> },
            { value: 'sugestoes', label: <>sugestões{newSugs ? <em className="pf-dot-count">{newSugs}</em> : null}</> },
            { value: 'site', label: 'página de vendas' },
            { value: 'termos', label: 'termos' },
            { value: 'horarios', label: 'horários' },
            { value: 'ajustes', label: 'planos' },
          ]}
        />
      </div>
      {tab === 'resumo' && <Summary subs={subs} update={update} openChat={openChat} billing={billing} />}
      {tab === 'assinantes' && <Subscribers subs={subs} update={update} openChat={openChat} billing={billing} unreadOf={(id) => msgs.filter((m) => m.clientId === id && !m.fromOwner && !m.readAt).length} />}
      {tab === 'conversas' && <Inbox subs={subs} msgs={msgs} current={chatWith} setCurrent={setChatWith} reload={reload} />}
      {tab === 'sugestoes' && <SuggestionsAdmin sugs={sugs} subs={subs} reload={loadExtra} />}
      {tab === 'site' && <SiteEditor />}
      {tab === 'termos' && <TermsEditor />}
      {tab === 'horarios' && <HoursEditor />}
      {tab === 'ajustes' && <PlansInfo />}
    </div>
  )
}

// ativar: pagamento confirmado por você (na fase 2, pelo sistema de pagamento)
const activate = (s: Subscription): Partial<Subscription> => ({ status: 'ativa', plan: s.requestedPlan ?? s.plan, requestedPlan: null, requestedAt: null, canceledAt: null, blocked: false })

function Summary({ subs, update, openChat, billing }: { subs: Subscription[]; update: (s: Subscription, p: Partial<Subscription>, msg: string) => Promise<void>; openChat: (id: string) => void; billing: Record<string, Billing> }) {
  const requests = subs.filter((x) => x.requestedPlan)
  const now = new Date()
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`
  const thisMonth = monthKey(now)
  const active = subs.filter(paying)
  const mrr = active.reduce((s, x) => s + PLANS[x.plan].price, 0)
  const trials = subs.filter((x) => x.status === 'trial' && trialDaysLeft(x) > 0)
  const expired = subs.filter((x) => x.status === 'trial' && trialDaysLeft(x) <= 0)
  const late = subs.filter((x) => x.status === 'atrasada')
  const newOnes = subs.filter((x) => x.createdAt && monthKey(new Date(x.createdAt)) === thisMonth)
  const canceled = subs.filter((x) => x.canceledAt && monthKey(new Date(x.canceledAt)) === thisMonth)
  const everPaid = subs.filter((x) => x.status !== 'trial').length
  const conversion = subs.length ? Math.round((everPaid / Math.max(1, subs.length - trials.length)) * 100) : 0

  // receita estimada de cada mês: quem já tinha passado do teste e ainda não tinha cancelado
  const months = [...Array(6)].map((_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1))
  const revenue = months.map((m) => {
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 0)
    return subs
      .filter((x) => x.status !== 'trial' && new Date(x.createdAt).getTime() + TRIAL_DAYS * 86_400_000 <= end.getTime() && (!x.canceledAt || new Date(x.canceledAt) >= m))
      .reduce((s, x) => s + PLANS[x.plan].price, 0)
  })

  return (
    <>
      <div className="stats">
        <Stat label="Receita por mês" value={money(mrr)} sub={`${active.length} assinante(s) ativo(s)${requests.length ? ` · ${requests.length} pedido(s)` : ''}`} icon="wallet" tone="good" />
        <Stat label="Em teste grátis" value={trials.length} sub={expired.length ? `${expired.length} teste(s) já terminaram` : `${TRIAL_DAYS} dias de teste`} icon="clock" />
        <Stat label="Novos este mês" value={newOnes.length} sub={`conversão do teste: ${conversion}%`} icon="trend" />
        <Stat label="Cancelamentos no mês" value={canceled.length} sub={late.length ? `${late.length} com pagamento atrasado` : 'nenhum atraso'} icon="alert" tone={canceled.length || late.length ? 'warn' : undefined} />
      </div>
      {requests.length > 0 && (
        <Section title={`pedidos de assinatura (${requests.length})`}>
          <p className="muted small">Confirme o pagamento com a pessoa (Pix, por exemplo) e toque em “ativar”. Na fase 2 isso acontece sozinho quando o pagamento cai.</p>
          {requests.map((s) => (
            <div key={s.userId} className="pf-plan-line">
              <b>{s.name || s.email}</b>
              <span className="muted small">
                quer o {PLANS[s.requestedPlan!].name} · {s.requestedCycle === 'anual' || billing[s.userId]?.cycle === 'anual' ? `${money(annualPrice(PLANS[s.requestedPlan!].price))}/ano` : `${money0(PLANS[s.requestedPlan!].price)}/mês`}
                {billing[s.userId] ? ` · ${PAY_LABEL[billing[s.userId].payMethod]}` : ''}
              </span>
              <span className="grow" />
              <button className="btn small ghost" onClick={() => openChat(s.userId)}>
                <Icon name="chat" size={14} /> conversar
              </button>
              <button className="btn small approve" onClick={async () => (await ask(`Ativar a assinatura do ${PLANS[s.requestedPlan!].name} para ${s.name || s.email}? Faça isso depois de confirmar o pagamento.`, { confirmLabel: 'Ativar' })) && update(s, activate(s), 'Assinatura ativada.')}>
                <Icon name="check" size={14} /> ativar
              </button>
            </div>
          ))}
        </Section>
      )}
      <Section title="receita estimada (últimos 6 meses)">
        <BarChart labels={months.map((m) => MONTHS[m.getMonth()])} series={[{ label: 'receita', color: 'var(--accent)', values: revenue }]} height={200} />
        <p className="muted small">Por enquanto é uma simulação: a cobrança de verdade (Pix e cartão) entra na fase 2.</p>
      </Section>
      <div className="pf-grid-2">
        <Section title="por plano">
          {PLAN_LIST.map((p) => {
            const n = active.filter((x) => x.plan === p.id).length
            const t = trials.filter((x) => x.plan === p.id).length
            return (
              <div key={p.id} className="pf-plan-line">
                <b>{p.name}</b>
                <span className="muted">{money0(p.price)}/mês</span>
                <span className="grow" />
                <span>
                  {n} ativo(s) · {t} em teste
                </span>
              </div>
            )
          })}
        </Section>
        <Section title="últimos cadastros">
          {subs.length === 0 ? (
            <p className="muted small">Ninguém se cadastrou ainda.</p>
          ) : (
            [...subs]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 5)
              .map((s) => (
                <div key={s.userId} className="pf-plan-line">
                  <b>{s.name || s.email}</b>
                  <span className="muted small">{s.studio}</span>
                  <span className="grow" />
                  <Badge color={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                </div>
              ))
          )}
        </Section>
      </div>
    </>
  )
}

function Subscribers({ subs, update, openChat, unreadOf, billing }: { subs: Subscription[]; update: (s: Subscription, p: Partial<Subscription>, msg: string) => Promise<void>; openChat: (id: string) => void; unreadOf: (id: string) => number; billing: Record<string, Billing> }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'todos' | SubStatus | 'bloqueados'>('todos')
  const rows = subs.filter((s) => matches(q, s.name, s.email, s.studio)).filter((s) => (filter === 'todos' ? true : filter === 'bloqueados' ? s.blocked : s.status === filter))
  if (!subs.length) return <Empty icon="users" title="nenhum assinante ainda" text="Quando alguém se cadastrar pela página de vendas, aparece aqui com o plano, o teste grátis e o último acesso." />
  return (
    <>
      <div className="pf-toolbar">
        <input type="search" className="pf-search" placeholder="buscar por nome, e-mail ou estúdio…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtrar">
          <option value="todos">todos</option>
          {(Object.keys(STATUS_LABEL) as SubStatus[]).map((k) => (
            <option key={k} value={k}>
              {STATUS_LABEL[k]}
            </option>
          ))}
          <option value="bloqueados">bloqueados</option>
        </select>
      </div>
      <div className="pf-subs">
        {rows.map((s) => {
          const left = trialDaysLeft(s)
          const unread = unreadOf(s.userId)
          return (
            <article key={s.userId} className={`card pf-sub ${s.blocked ? 'is-blocked' : ''}`}>
              <header className="pf-sub-head">
                <span className="pf-avatar">{(s.name || s.email || '?')[0].toUpperCase()}</span>
                <span className="grow">
                  <b>{s.name || 'sem nome'}</b>
                  <small className="muted">{s.studio || '—'}</small>
                  <small className="muted pf-email">{s.email}</small>
                </span>
              </header>
              <div className="pf-badges">
                <Badge color={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                <Badge color="#3e4b57">{PLANS[s.plan].name}</Badge>
                {s.blocked && <Badge color="#b5524c">bloqueado</Badge>}
                {s.requestedPlan && <Badge color="#b98246">pediu o {PLANS[s.requestedPlan].name}</Badge>}
              </div>
              <dl className="pf-facts">
                <div>
                  <dt>desde</dt>
                  <dd>{dateBR(s.createdAt)}</dd>
                </div>
                <div>
                  <dt>último acesso</dt>
                  <dd>{s.lastSeen ? ago(s.lastSeen) : '—'}</dd>
                </div>
                <div>
                  <dt>{s.status === 'trial' ? 'teste' : 'valor'}</dt>
                  <dd>{s.status === 'trial' ? (left > 0 ? `faltam ${left} dia(s)` : 'terminou') : `${money0(PLANS[s.plan].price)}/mês`}</dd>
                </div>
              </dl>
              {billing[s.userId] && <BillingDetails b={billing[s.userId]} />}
              <TrialControl s={s} update={update} />
              <div className="pf-sub-actions">
                <select value={s.plan} onChange={(e) => void update(s, { plan: e.target.value as PlanId }, `Plano de ${s.name || s.email} → ${PLANS[e.target.value as PlanId].name}.`)} aria-label="Plano">
                  {PLAN_LIST.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={s.status}
                  onChange={(e) => {
                    const status = e.target.value as SubStatus
                    void update(s, { status, canceledAt: status === 'cancelada' ? new Date().toISOString() : null }, `Situação → ${STATUS_LABEL[status]}.`)
                  }}
                  aria-label="Situação"
                >
                  {(Object.keys(STATUS_LABEL) as SubStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {STATUS_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row gap-s wrap">
                {s.requestedPlan && (
                  <button className="btn small approve" onClick={async () => (await ask(`Ativar a assinatura do ${PLANS[s.requestedPlan!].name}? Faça isso depois de confirmar o pagamento.`, { confirmLabel: 'Ativar' })) && update(s, activate(s), 'Assinatura ativada.')}>
                    <Icon name="check" size={14} /> ativar assinatura
                  </button>
                )}
                {s.blocked ? (
                  <button className="btn small approve" onClick={() => void update(s, { blocked: false }, 'Acesso liberado.')}>
                    <Icon name="check" size={14} /> liberar
                  </button>
                ) : (
                  <button
                    className="btn small ghost danger"
                    onClick={async () => (await ask(`Bloquear ${s.name || s.email}? A pessoa não consegue usar o sistema até você liberar. Os dados dela não são apagados.`, { confirmLabel: 'Bloquear', danger: true })) && update(s, { blocked: true }, 'Acesso bloqueado.')}
                  >
                    <Icon name="lock" size={14} /> bloquear
                  </button>
                )}
                <button className="btn small ghost" onClick={() => openChat(s.userId)}>
                  <Icon name="chat" size={14} /> conversar{unread ? ` (${unread})` : ''}
                </button>
              </div>
            </article>
          )
        })}
        {!rows.length && <p className="muted">Ninguém com esse filtro.</p>}
      </div>
    </>
  )
}

function Inbox({ subs, msgs, current, setCurrent, reload }: { subs: Subscription[]; msgs: ReturnType<typeof useInbox>['msgs']; current: string; setCurrent: (id: string) => void; reload: () => Promise<void> }) {
  const threads = useMemo(() => {
    const by = new Map<string, typeof msgs>()
    for (const m of msgs) by.set(m.clientId, [...(by.get(m.clientId) ?? []), m])
    return [...by.entries()]
      .map(([id, list]) => ({ id, list, last: list[list.length - 1], unread: list.filter((m) => !m.fromOwner && !m.readAt).length, sub: subs.find((s) => s.userId === id) }))
      .sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt))
  }, [msgs, subs])
  // quem ainda não conversou também pode receber mensagem (vindo de "conversar" nos assinantes)
  const currentSub = subs.find((s) => s.userId === current)
  if (!threads.length && !current) return <Empty icon="chat" title="nenhuma conversa ainda" text="Quando um cliente escrever no chat, a conversa aparece aqui e você recebe um aviso no menu." />
  return (
    <div className={`pf-inbox ${current ? 'has-open' : ''}`}>
      <div className="card pf-threads">
        {threads.map((t) => (
          <button key={t.id} className={`pf-thread ${t.id === current ? 'is-active' : ''}`} onClick={() => setCurrent(t.id)}>
            <span className="pf-avatar">{(t.sub?.name || '?')[0].toUpperCase()}</span>
            <span className="grow">
              <b>{t.sub?.name || 'cliente'}</b>
              <small className="muted">
                {t.last.fromOwner ? 'você: ' : ''}
                {t.last.body.slice(0, 60)}
              </small>
            </span>
            <span className="pf-thread-meta">
              <small className="muted">{timeLabel(t.last.createdAt)}</small>
              {t.unread > 0 && <em className="pf-dot-count">{t.unread}</em>}
            </span>
          </button>
        ))}
        {current && !threads.some((t) => t.id === current) && currentSub && (
          <button className="pf-thread is-active">
            <span className="pf-avatar">{(currentSub.name || '?')[0].toUpperCase()}</span>
            <span className="grow">
              <b>{currentSub.name}</b>
              <small className="muted">nova conversa</small>
            </span>
          </button>
        )}
      </div>
      {current ? <Thread key={current} clientId={current} sub={currentSub} onBack={() => setCurrent('')} onChange={reload} /> : <div className="card pf-thread-empty muted">escolha uma conversa</div>}
    </div>
  )
}

function Thread({ clientId, sub, onBack, onChange }: { clientId: string; sub?: Subscription; onBack: () => void; onChange: () => Promise<void> }) {
  const { msgs, send, markRead } = useConversation(clientId)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const unread = (msgs ?? []).some((m) => !m.fromOwner && !m.readAt)
  useEffect(() => {
    if (unread) void markRead().then(onChange)
  }, [unread, markRead, onChange])
  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [msgs])
  const submit = async () => {
    if (await send(text, true)) {
      setText('')
      void onChange()
    }
  }
  return (
    <section className="card pf-thread-view">
      <header className="pf-thread-head">
        <button className="icon-btn only-mobile" onClick={onBack} aria-label="Voltar para as conversas">
          <Icon name="chevronL" />
        </button>
        <span className="pf-avatar">{(sub?.name || '?')[0].toUpperCase()}</span>
        <span className="grow">
          <b>{sub?.name || 'cliente'}</b>
          <small className="muted">
            {sub ? `${sub.studio || sub.email} · ${PLANS[sub.plan].name} · ${STATUS_LABEL[sub.status]}` : ''}
          </small>
        </span>
      </header>
      <div className="pf-thread-body">
        {(msgs ?? []).map((m) => (
          <div key={m.id} className={`ai-msg ${m.fromOwner ? 'is-user' : 'is-ai'}`}>
            <p>{m.body}</p>
            <small className="pf-msg-time">
              {timeLabel(m.createdAt)}
              {m.fromOwner && m.readAt ? ' · lida' : ''}
            </small>
          </div>
        ))}
        {msgs?.length === 0 && <p className="muted small center">comece a conversa ☺️</p>}
        <div ref={endRef} />
      </div>
      <form
        className="ai-chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <textarea
          rows={Math.min(4, Math.max(1, text.split('\n').length))}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder="Responder…"
        />
        <button className="btn primary icon-only" disabled={!text.trim()} aria-label="Enviar">
          <Icon name="arrowRight" size={18} />
        </button>
      </form>
    </section>
  )
}

function HoursEditor() {
  const [hours, setHours] = useHours()
  const [draft, setDraft] = useState<OnlineHours | null>(null)
  const h = draft ?? hours
  const setDay = (i: number, patch: Partial<OnlineHours['days'][number]>) => setDraft({ ...h, days: h.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) })
  const save = async () => {
    try {
      await platform.saveHours(h)
      setHours(h)
      setDraft(null)
      toast('Horários salvos. Os clientes já veem os novos horários no chat.')
    } catch {
      toast('Não foi possível salvar os horários agora.')
    }
  }
  return (
    <Section
      title="quando você está online"
      action={
        <button className="btn primary small" disabled={!draft} onClick={() => void save()}>
          salvar
        </button>
      }
    >
      <p className="muted small">
        Os clientes veem no chat se você está <b>online agora</b>. Fora desses horários aparece “respondo assim que possível”. Sempre no horário de Brasília. Agora: <b>{isOnline(h) ? 'online' : 'fora do horário'}</b>.
      </p>
      <div className="pf-hours">
        {[1, 2, 3, 4, 5, 6, 0].map((i) => (
          <div key={i} className={`pf-hour ${h.days[i].on ? '' : 'is-off'}`}>
            <label className="check">
              <input type="checkbox" checked={h.days[i].on} onChange={(e) => setDay(i, { on: e.target.checked })} /> {DAY_NAMES[i]}
            </label>
            <input type="time" value={h.days[i].from} disabled={!h.days[i].on} onChange={(e) => setDay(i, { from: e.target.value })} aria-label={`${DAY_NAMES[i]}: das`} />
            <span className="muted">às</span>
            <input type="time" value={h.days[i].to} disabled={!h.days[i].on} onChange={(e) => setDay(i, { to: e.target.value })} aria-label={`${DAY_NAMES[i]}: até`} />
          </div>
        ))}
      </div>
      <p className="muted small">Resumo que aparece no chat: {hoursSummary(h)}</p>
      <Field label="Mensagem fora do horário" hint="Aparece para o cliente depois que ele escreve e você está fora do horário.">
        <input value={h.away} onChange={(e) => setDraft({ ...h, away: e.target.value })} />
      </Field>
    </Section>
  )
}

function PlansInfo() {
  return (
    <>
      <PlansEditor />
      {ARTIFACT && (
        <Section title="prévia">
          <p className="muted small">Os assinantes e conversas desta prévia são fictícios e ficam só neste aparelho.</p>
          <button className="btn ghost" onClick={async () => (await ask('Voltar os assinantes e conversas de exemplo para o começo?', { confirmLabel: 'Recomeçar' })) && resetPreviewData()}>
            recomeçar exemplo
          </button>
        </Section>
      )}
    </>
  )
}

const PAY_LABEL: Record<Billing['payMethod'], string> = { pix: 'Pix', cartao: 'cartão', boleto: 'boleto' }

/** Dados de cobrança que a pessoa preencheu ao pedir a assinatura. */
function BillingDetails({ b }: { b: Billing }) {
  return (
    <details className="sg-billing">
      <summary>dados de cobrança</summary>
      <dl className="pf-facts sg-facts">
        {(
          [
            ['nome', b.fullName],
            ['CPF/CNPJ', b.doc],
            ['WhatsApp', b.phone],
            ['e-mail', b.email],
            ['endereço', [b.address, b.number, b.complement].filter(Boolean).join(', ')],
            ['cidade', `${b.city}${b.cep ? ` · ${b.cep}` : ''}`],
            ['atuação', b.profession],
            ['conheceu por', b.source || '—'],
            ['pagamento', `${PAY_LABEL[b.payMethod]} · ${b.cycle}`],
            ['aceitou os termos', b.acceptedAt ? new Date(b.acceptedAt).toLocaleString('pt-BR') : '—'],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

/** Sugestões de melhoria de quem usa: mudar a situação e responder. */
function SuggestionsAdmin({ sugs, subs, reload }: { sugs: Suggestion[]; subs: Subscription[]; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState<'abertas' | 'todas' | SuggestionStatus>('abertas')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const rows = sugs.filter((x) => (filter === 'todas' ? true : filter === 'abertas' ? ['recebida', 'analisando', 'planejada'].includes(x.status) : x.status === filter))
  const who = (id: string) => subs.find((s) => s.userId === id)
  const save = async (x: Suggestion, patch: Partial<Pick<Suggestion, 'status' | 'reply'>>, msg: string) => {
    try {
      await platform.answerSuggestion(x.id, { status: patch.status ?? x.status, reply: patch.reply ?? x.reply })
      await reload()
      toast(msg)
    } catch {
      toast('Não foi possível salvar agora.')
    }
  }
  if (!sugs.length) return <Empty icon="flag" title="nenhuma sugestão ainda" text="Quando alguém mandar uma ideia em “sugestões”, ela aparece aqui para você responder e planejar as próximas atualizações." />
  return (
    <>
      <div className="sg-filters" role="tablist" aria-label="Filtrar sugestões">
        {(
          [
            ['abertas', 'abertas', sugs.filter((x) => ['recebida', 'analisando', 'planejada'].includes(x.status)).length],
            ...(Object.keys(SUGGESTION_STATUS) as SuggestionStatus[]).map((k) => [k, SUGGESTION_STATUS[k].label, sugs.filter((x) => x.status === k).length]),
            ['todas', 'todas', sugs.length],
          ] as [typeof filter, string, number][]
        ).map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={`sg-filter ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {label} <em>{n}</em>
          </button>
        ))}
      </div>
      <div className="sg-table">
        <div className="sg-row sg-row-head" aria-hidden>
          <span>situação</span>
          <span>sugestão</span>
          <span>resposta</span>
        </div>
        {rows.map((x) => {
          const draft = drafts[x.id] ?? x.reply
          return (
            <article key={x.id} className="sg-row">
              <div className="sg-col-status">
                <select style={{ borderLeft: `4px solid ${SUGGESTION_STATUS[x.status].color}` }} value={x.status} onChange={(e) => void save(x, { status: e.target.value as SuggestionStatus }, 'Situação atualizada.')} aria-label="Mudar a situação">
                  {(Object.keys(SUGGESTION_STATUS) as SuggestionStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {SUGGESTION_STATUS[k].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sg-col-body">
                <b>{x.title}</b>
                <small className="muted">
                  {SUGGESTION_CATEGORY[x.category]} · {who(x.userId)?.name || 'cliente'} · {timeLabel(x.createdAt)}
                </small>
                {x.body && <p className="small">{x.body}</p>}
              </div>
              <div className="sg-col-reply">
                <textarea rows={2} value={draft} placeholder="Resposta (quem enviou vê na tela de sugestões)" onChange={(e) => setDrafts((d) => ({ ...d, [x.id]: e.target.value }))} />
                {draft !== x.reply && (
                  <button className="btn small primary" onClick={() => void save(x, { reply: draft.trim() }, 'Resposta enviada.')}>
                    responder
                  </button>
                )}
              </div>
            </article>
          )
        })}
        {!rows.length && <p className="muted">Nada com esse filtro.</p>}
      </div>
    </>
  )
}

/** "Quem criou", redes e contatos da página de vendas: a dona edita aqui, sem mexer no código. */
function SiteEditor() {
  const [site, setSite] = useState<SiteContent | null>(null)
  const [saved, setSaved] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    platform.site().then((x) => {
      setSite(x)
      setSaved(JSON.stringify(x))
    })
  }, [])
  if (!site) return <p className="muted small">carregando…</p>
  const set = (patch: Partial<SiteContent>) => setSite({ ...site, ...patch })
  const dirty = JSON.stringify(site) !== saved
  const save = async () => {
    try {
      await platform.saveSite(site)
      setSaved(JSON.stringify(site))
      toast('Página de vendas atualizada.')
    } catch {
      toast('Não foi possível salvar agora. Confira a internet e se o SQL da plataforma foi rodado de novo.')
    }
  }
  return (
    <>
      <Section
        title="quem criou"
        action={
          <button className="btn primary small" disabled={!dirty} onClick={() => void save()}>
            {dirty ? 'salvar' : 'salvo'}
          </button>
        }
      >
        <div className="se-photo">
          {site.photo ? <img src={site.photo} alt="" /> : <span className="se-photo-empty">{site.name[0]}</span>}
          <div className="stack-s">
            <button className="btn small" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={14} /> {site.photo ? 'trocar foto' : 'enviar foto'}
            </button>
            {site.photo && (
              <button className="btn small ghost" onClick={() => set({ photo: '' })}>
                tirar foto
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) set({ photo: await shrinkPhoto(f) })
              }}
            />
            <p className="muted small">Foto vertical fica melhor. Ela é reduzida sozinha para carregar rápido.</p>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Título" span={3}>
            <input value={site.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Texto" span={3} hint="Deixe uma linha em branco para começar outro parágrafo.">
            <textarea rows={8} value={site.text} onChange={(e) => set({ text: e.target.value })} spellCheck lang="pt-BR" />
          </Field>
          {[0, 1, 2].map((i) => (
            <Field key={i} label={`Etiqueta ${i + 1}`}>
              <input value={site.facts[i] ?? ''} onChange={(e) => set({ facts: [0, 1, 2].map((j) => (j === i ? e.target.value : site.facts[j] ?? '')) })} />
            </Field>
          ))}
          <Field label="Assinatura" span={3}>
            <input value={site.signature} onChange={(e) => set({ signature: e.target.value })} />
          </Field>
        </div>
      </Section>
      <Section title="rodapé e redes da plataforma">
        <div className="form-grid">
          <Field label="Frase do rodapé" span={3}>
            <input value={site.about} onChange={(e) => set({ about: e.target.value })} />
          </Field>
          <Field label="Instagram da plataforma" hint="Ex.: @traco.app (vazio = não aparece)">
            <input value={site.instagram} onChange={(e) => set({ instagram: e.target.value.trim() })} placeholder="@" />
          </Field>
          <Field label="WhatsApp">
            <input value={site.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+55 11 90000-0000" />
          </Field>
          <Field label="E-mail">
            <input value={site.email} onChange={(e) => set({ email: e.target.value.trim() })} placeholder="contato@…" />
          </Field>
        </div>
        <button className="btn primary" disabled={!dirty} onClick={() => void save()}>
          {dirty ? 'salvar alterações' : 'salvo'}
        </button>
      </Section>
    </>
  )
}

/** Termos de uso + contrato de assinatura: aparecem no cadastro e na assinatura (aceite obrigatório). */
function TermsEditor() {
  const [text, setText] = useState<string | null>(null)
  const [saved, setSaved] = useState('')
  const [mode, setMode] = useState<'editar' | 'ver'>('editar')
  const [fill, setFill] = useState<Record<string, string>>({})
  const [company, setCompany] = useState<Company>(EMPTY_COMPANY)
  const [savedCompany, setSavedCompany] = useState(JSON.stringify(EMPTY_COMPANY))
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    platform.terms().then((t) => {
      setText(t)
      setSaved(t)
    })
    platform.company().then((c) => {
      setCompany(c)
      setSavedCompany(JSON.stringify(c))
    })
  }, [])
  if (text === null) return <p className="muted small">carregando…</p>
  const companyDirty = JSON.stringify(company) !== savedCompany
  const dirty = text !== saved || companyDirty
  const save = async () => {
    try {
      await platform.saveTerms(text)
      if (companyDirty) await platform.saveCompany(company)
      setSaved(text)
      setSavedCompany(JSON.stringify(company))
      toast('Termos salvos. Quem se cadastrar ou assinar a partir de agora aceita esta versão.')
    } catch {
      toast('Não foi possível salvar agora.')
    }
  }
  const missing = [...new Set(text.match(/\[[^\]\n]{3,40}\]/g) ?? [])]
  const lines = text.split('\n')
  const sections = lines.map((l, i) => ({ l: l.trim(), i })).filter((x) => /^\d+\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(x.l) && x.l === x.l.toUpperCase())
  const words = text.split(/\s+/).filter(Boolean).length
  // os termos falam em outro número de dias de teste?
  const trialInText = text.match(/(\d+)\s+dias grátis/)?.[1]
  const trialMismatch = trialInText && Number(trialInText) !== TRIAL_DAYS
  const applyFill = () => {
    let t = text
    for (const [k, v] of Object.entries(fill)) if (v.trim()) t = t.split(k).join(v.trim())
    setText(t)
    setFill({})
    toast('Dados colocados no texto. Confira e salve.')
  }
  const goTo = (line: number) => {
    setMode('editar')
    requestAnimationFrame(() => {
      const el = area.current
      if (!el) return
      const pos = lines.slice(0, line).join('\n').length + (line ? 1 : 0)
      el.focus()
      el.setSelectionRange(pos, pos + lines[line].length)
      el.scrollTop = Math.max(0, (line / lines.length) * el.scrollHeight - 40)
    })
  }
  return (
    <Section
      title="termos de uso e contrato de assinatura"
      action={
        <button className={`btn small ${dirty ? 'primary' : 'ghost'}`} disabled={!dirty} onClick={() => void save()}>
          {dirty ? 'salvar' : 'salvo'}
        </button>
      }
    >
      <p className="muted small">
        Aparecem no cadastro (teste grátis) e na assinatura: a pessoa só continua se aceitar. Revise com calma, de preferência com um advogado. Linhas em MAIÚSCULAS viram títulos.
      </p>
      <div className="tm-stats">
        <span>
          <b>{sections.length}</b> seções
        </span>
        <span>
          <b>{words.toLocaleString('pt-BR')}</b> palavras
        </span>
        <span className={missing.length ? 'is-warn' : 'is-ok'}>
          <b>{missing.length}</b> {missing.length === 1 ? 'dado a completar' : 'dados a completar'}
        </span>
        <span className={dirty ? 'is-warn' : 'is-ok'}>{dirty ? 'alterações não salvas' : 'tudo salvo'}</span>
      </div>
      <div className="tm-fill">
        <p className="tm-fill-title">
          <Icon name="pen" size={15} /> seus dados (preenchem os termos sozinhos)
        </p>
        <div className="tm-fill-grid">
          <Field label="Nome completo ou razão social">
            <input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
          </Field>
          <Field label="CPF ou CNPJ">
            <input value={company.doc} onChange={(e) => setCompany({ ...company, doc: formatDoc(e.target.value) })} inputMode="numeric" />
          </Field>
          <Field label="E-mail de contato">
            <input type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
          </Field>
          <Field label="Cidade/UF (foro)">
            <input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} placeholder="São Paulo/SP" />
          </Field>
        </div>
        <p className="muted small">
          Os dados de quem assina (nome, CPF/CNPJ, e-mail e plano) entram sozinhos no cadastro e na assinatura. Para usar no texto:{' '}
          {TERMS_VARS.map(([k, label]) => (
            <code key={k} title={label} className="tm-var">{`{${k}}`}</code>
          ))}
        </p>
      </div>
      {missing.length > 0 && (
        <div className="tm-fill">
          <p className="tm-fill-title">
            <Icon name="alert" size={15} /> ainda há campos entre colchetes no texto
          </p>
          <div className="tm-fill-grid">
            {missing.map((m) => (
              <Field key={m} label={m.slice(1, -1)}>
                <input value={fill[m] ?? ''} onChange={(e) => setFill({ ...fill, [m]: e.target.value })} placeholder={m} />
              </Field>
            ))}
          </div>
          <button className="btn small primary" disabled={!Object.values(fill).some((v) => v.trim())} onClick={applyFill}>
            colocar no texto
          </button>
        </div>
      )}
      {trialMismatch && (
        <p className="pf-note is-warn">
          <Icon name="alert" size={16} />
          <span>
            O texto fala em {trialInText} dias grátis, mas o teste está com {TRIAL_DAYS} dias (em “planos”).{' '}
            <button className="link" onClick={() => setText(text.replace(/(\d+)(\s+dias grátis)/g, `${TRIAL_DAYS}$2`))}>
              corrigir no texto
            </button>
          </span>
        </p>
      )}
      <div className="tm-layout">
        <nav className="tm-index" aria-label="Seções">
          <b>seções</b>
          {sections.map((x) => (
            <button key={x.i} type="button" onClick={() => goTo(x.i)}>
              {x.l.toLowerCase()}
            </button>
          ))}
        </nav>
        <div className="tm-body">
          <Segmented
            value={mode}
            options={[
              { value: 'editar', label: 'editar' },
              { value: 'ver', label: 'como o cliente vê' },
            ]}
            onChange={setMode}
          />
          {mode === 'editar' ? (
            <textarea ref={area} className="pf-contract-text" rows={26} value={text} onChange={(e) => setText(e.target.value)} spellCheck lang="pt-BR" />
          ) : (
            <div className="tm-preview">
              <TermsText text={fillTerms(text, company, { name: 'Ana Ribeiro (exemplo)', doc: '123.456.789-09', email: 'ana@exemplo.com', plan: `${PLANS.completo.name} · ${money0(PLANS.completo.price)}/mês` })} />
            </div>
          )}
        </div>
      </div>
      <div className="row gap-s wrap">
        {text !== saved && (
          <button className="link small" onClick={() => setText(saved)}>
            desfazer alterações
          </button>
        )}
        <button className="link small" onClick={async () => (await ask('Voltar para o texto padrão dos termos? O que você editou será substituído.', { confirmLabel: 'Restaurar' })) && setText(DEFAULT_TERMS)}>
          restaurar texto padrão
        </button>
      </div>
    </Section>
  )
}

/** Teste grátis de cada pessoa: aumentar, escolher a data, encerrar agora ou dar um teste novo. */
function TrialControl({ s, update }: { s: Subscription; update: (s: Subscription, p: Partial<Subscription>, msg: string) => Promise<void> }) {
  const DAY = 86_400_000
  const inTrial = s.status === 'trial'
  const left = trialDaysLeft(s)
  const from = Math.max(Date.now(), new Date(s.trialEnds).getTime())
  const extend = (days: number) =>
    void update(s, inTrial ? { trialEnds: new Date(from + days * DAY).toISOString() } : { status: 'trial', trialEnds: new Date(Date.now() + days * DAY).toISOString(), canceledAt: null }, inTrial ? `Teste aumentado em ${days} dias.` : `Teste de ${days} dias liberado.`)
  const who = s.name || s.email
  return (
    <div className="pf-trial">
      <div className="pf-trial-head">
        <b>teste grátis</b>
        <span className="muted small">{inTrial ? (left > 0 ? `termina em ${dateBR(s.trialEnds)} · faltam ${left} dia(s)` : `terminou em ${dateBR(s.trialEnds)}`) : 'sem teste agora'}</span>
      </div>
      <div className="pf-trial-actions">
        {[7, 15, 30].map((d) => (
          <button key={d} type="button" className="btn small ghost" onClick={() => extend(d)}>
            +{d} dias
          </button>
        ))}
        {inTrial && (
          <label className="pf-trial-date">
            <span className="muted small">até</span>
            <input
              type="date"
              value={s.trialEnds.slice(0, 10)}
              onChange={(e) => e.target.value && void update(s, { trialEnds: new Date(`${e.target.value}T23:59:00`).toISOString() }, `Teste vai até ${dateBR(e.target.value)}.`)}
              aria-label="Data em que o teste termina"
            />
          </label>
        )}
        {inTrial && left > 0 && (
          <button
            type="button"
            className="btn small ghost danger"
            onClick={async () => (await ask(`Encerrar agora o teste de ${who}? A conta fica pausada (os dados continuam guardados) até assinar ou você liberar de novo.`, { confirmLabel: 'Encerrar teste', danger: true })) && update(s, { trialEnds: new Date(Date.now() - 60_000).toISOString() }, 'Teste encerrado.')}
          >
            encerrar teste
          </button>
        )}
      </div>
    </div>
  )
}

/** Nome, preço, frase, lista e o que cada plano libera + dias de teste: tudo editável pela dona. */
function PlansEditor() {
  const snap = (): PlanConfig => ({
    trialDays: TRIAL_DAYS,
    plans: Object.fromEntries(PLAN_LIST.map((p) => [p.id, { name: p.name, price: p.price, pitch: p.pitch, highlights: [...p.highlights], features: [...p.features] }])) as PlanConfig['plans'],
  })
  const [cfg, setCfg] = useState<PlanConfig>(snap)
  const [saved, setSaved] = useState(() => JSON.stringify(snap()))
  const dirty = JSON.stringify(cfg) !== saved
  const setPlan = (id: PlanId, patch: PlanOverride) => setCfg((c) => ({ ...c, plans: { ...c.plans, [id]: { ...c.plans?.[id], ...patch } } }))
  const save = async () => {
    try {
      await platform.savePlanConfig(cfg)
      applyPlanConfig(cfg)
      setSaved(JSON.stringify(cfg))
      toast('Planos salvos. A página de vendas e o cadastro já usam os novos valores.')
    } catch {
      toast('Não foi possível salvar agora. Confira a conexão (e se o arquivo do Supabase foi rodado).')
    }
  }
  return (
    <>
      <Section
        title="teste grátis"
        action={
          <button className={`btn small ${dirty ? 'primary' : 'ghost'}`} disabled={!dirty} onClick={() => void save()}>
            {dirty ? 'salvar planos' : 'salvo'}
          </button>
        }
      >
        <div className="form-grid">
          <Field label="Dias de teste para quem se cadastra" hint="Vale para os próximos cadastros. Para alguém específico, aumente ou encerre o teste em “assinantes”.">
            <input type="number" min={1} max={365} value={cfg.trialDays ?? 7} onChange={(e) => setCfg({ ...cfg, trialDays: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} />
          </Field>
        </div>
      </Section>
      <div className="pf-grid-2">
        {PLAN_LIST.map((p) => {
          const o = cfg.plans?.[p.id] ?? {}
          const feats = o.features ?? p.features
          return (
            <Section key={p.id} title={`plano ${o.name || p.name}`}>
              <div className="form-grid">
                <Field label="Nome">
                  <input value={o.name ?? ''} onChange={(e) => setPlan(p.id, { name: e.target.value })} />
                </Field>
                <Field label="Preço por mês" hint={`Anual: ${money0(annualPrice(o.price ?? p.price))}`}>
                  <MoneyInput value={o.price ?? p.price} onChange={(n) => setPlan(p.id, { price: n })} />
                </Field>
                <Field label="Frase curta" span={3}>
                  <input value={o.pitch ?? ''} onChange={(e) => setPlan(p.id, { pitch: e.target.value })} />
                </Field>
                <Field label="O que aparece no cartão" span={3} hint="Uma linha para cada item.">
                  <textarea rows={6} value={(o.highlights ?? []).join('\n')} onChange={(e) => setPlan(p.id, { highlights: e.target.value.split('\n') })} />
                </Field>
              </div>
              <p className="pf-toggles-title">o que este plano libera</p>
              <div className="pf-toggles">
                {PLAN_TOGGLES.map(([f, label]) => (
                  <label key={f} className="check toggle">
                    <input type="checkbox" checked={feats.includes(f)} onChange={(e) => setPlan(p.id, { features: e.target.checked ? [...feats, f] : feats.filter((x) => x !== f) })} /> {label}
                  </label>
                ))}
                <label className="check toggle is-fixed">
                  <input type="checkbox" checked disabled /> chat com o assistente online (sempre)
                </label>
              </div>
            </Section>
          )
        })}
      </div>
      <p className="muted small">
        Você (a dona) tem tudo liberado, inclusive o assistente de IA e o seu modelo exclusivo. Mudanças de preço valem para novos pedidos; quem já assina continua no valor combinado até você mudar.
      </p>
    </>
  )
}
