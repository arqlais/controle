import { TermsText } from '../components/Terms'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Badge, Empty, Field, MoneyInput, Section, Segmented, Stat } from '../components/ui'
import { ask, askDelete, toast } from '../components/dialog'
import { BarChart } from '../components/Charts'
import { useKeep } from '../keep'
import { ARTIFACT } from '../env'
import { ANNUAL_FREE_MONTHS, CARD_FEE, CARD_FEE_6, CYCLE_MONTHS, CYCLE_UNIT, PLANS, PLAN_LIST, PLAN_TOGGLES, PLATFORM, SEMESTER_DISCOUNT, STATUS_LABEL, TRIAL_DAYS, cardPrice, cyclePrice, money0, type PlanId, type SubStatus } from '../plans'
import { applyPlanConfig, type PlanConfig, type PlanOverride } from '../planConfig'
import { DAY_NAMES, SUGGESTION_CATEGORY, SUGGESTION_STATUS, hoursSummary, isOnline, platform, resetPreviewData, trialDaysLeft, type SubAdmin, type Cycle, type SubPayment, type Billing, type Feedback, type OnlineHours, type Subscription, type Suggestion, type SuggestionStatus } from '../platform'
import { timeLabel, useConversation, useHours, useInbox } from '../chat'
import { DEFAULT_TERMS, EMPTY_COMPANY, LP_SECTIONS, freshSite, TERMS_VARS, fillTerms, shrinkPhoto, type Company, type SiteContent } from '../siteContent'
import { addMonths, daysUntil, download, formatDoc, matches, money, today, uid } from '../utils'
import { DateInput } from '../components/DateInput'
import { BillingFields, billingMissing, validDoc } from './Checkout'
import { NEWS } from '../news'
import { RichInput, RichText, richPlain } from '../components/RichText'
import { useNotifyAsk } from '../notify'
import { draftReply } from '../aiReply'
import { useStore } from '../store'
import { href } from '../router'

/* Painel da plataforma: só a conta da dona vê (a nuvem confere pela tabela "admins"). */

type Tab = 'resumo' | 'assinantes' | 'conversas' | 'sugestoes' | 'depoimentos' | 'site' | 'emails' | 'termos' | 'horarios' | 'ajustes'
const STATUS_COLOR: Record<SubStatus, string> = { trial: '#7d8c99', ativa: '#4f6475', atrasada: '#b08a7e', cancelada: '#9aa3ab' }
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
  // controle de cobrança de cada assinante (pago até, pagamentos, anotações): só a dona vê
  const [ctrl, setCtrl] = useState<Record<string, SubAdmin>>({})
  const saveCtrl = async (userId: string, d: SubAdmin, msg = '') => {
    setCtrl((c) => ({ ...c, [userId]: d }))
    try {
      await platform.saveSubAdmin(userId, d)
      if (msg) toast(msg)
    } catch {
      toast('Não foi possível salvar o controle. Rode de novo o SQL da plataforma no Supabase (tem uma tabela nova).')
    }
  }
  const saveBilling = async (userId: string, b: Billing) => {
    try {
      await platform.saveBilling(userId, b)
      setBilling((m) => ({ ...m, [userId]: b }))
      toast('Dados de cobrança corrigidos.')
    } catch {
      toast('Não foi possível salvar. Rode de novo o SQL da plataforma no Supabase.')
    }
  }
  const loadExtra = useCallback(async () => {
    try {
      const [b, sg, ct] = await Promise.all([platform.allBilling(), platform.suggestions(), platform.subAdmin()])
      setBilling(b)
      setSugs(sg)
      setCtrl(ct)
    } catch {
      /* tabelas ainda não criadas ou sem conexão */
    }
  }, [])
  useEffect(() => {
    void loadExtra()
  }, [loadExtra, subs])
  // "online agora": atualiza a lista a cada minuto enquanto o painel está aberto
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === 'visible' && void reload(), 60_000)
    return () => window.clearInterval(t)
  }, [reload])
  const newSugs = sugs.filter((x) => x.status === 'recebida').length
  const [chatWith, setChatWith] = useState('')

  const update = async (s: Subscription, patch: Partial<Subscription>, msg: string) => {
    try {
      await platform.updateSubscriber(s.userId, patch)
      setSubs((list) => list.map((x) => (x.userId === s.userId ? { ...x, ...patch } : x)))
      toast(msg)
      // assinatura ativada agora: a pessoa recebe o e-mail de confirmação (se a função de avisos estiver publicada)
      if (patch.status === 'ativa' && s.status !== 'ativa') void platform.notice({ tipo: 'ativada', userId: s.userId }).catch(() => undefined)
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
            { value: 'depoimentos', label: 'depoimentos' },
            { value: 'site', label: 'página de vendas' },
            { value: 'emails', label: 'e-mails' },
            { value: 'termos', label: 'termos' },
            { value: 'horarios', label: 'horários' },
            { value: 'ajustes', label: 'planos' },
          ]}
        />
      </div>
      {tab === 'resumo' && <Summary subs={subs} update={update} openChat={openChat} billing={billing} ctrl={ctrl} saveCtrl={saveCtrl} />}
      {tab === 'assinantes' && <Subscribers subs={subs} update={update} openChat={openChat} billing={billing} saveBilling={saveBilling} ctrl={ctrl} saveCtrl={saveCtrl} unreadOf={(id) => msgs.filter((m) => m.clientId === id && !m.fromOwner && !m.readAt).length} />}
      {tab === 'conversas' && <Inbox subs={subs} msgs={msgs} current={chatWith} setCurrent={setChatWith} reload={reload} />}
      {tab === 'sugestoes' && <SuggestionsAdmin sugs={sugs} subs={subs} reload={loadExtra} />}
      {tab === 'depoimentos' && <FeedbackAdmin />}
      {tab === 'site' && (
        <>
          <p className="pf-note">
            <Icon name="eye" size={16} />
            <span>
              Aqui você muda a sua foto, o texto do “quem criou”, os contatos e o rodapé da página de vendas.{' '}
              <a className="link" href="#/vendas">
                ver a página de vendas
              </a>
            </span>
          </p>
          <SiteEditor />
        </>
      )}
      {tab === 'emails' && <EmailsAdmin subs={subs} />}
      {tab === 'termos' && <TermsEditor />}
      {tab === 'horarios' && <HoursEditor />}
      {tab === 'ajustes' && <PlansInfo />}
    </div>
  )
}

// ativar: pagamento confirmado por você (na fase 2, pelo sistema de pagamento)
/** Entrou nos últimos 5 minutos (o sistema avisa a cada 2 minutos enquanto está aberto). */
const isOnline5 = (s: Subscription) => !!s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() < 5 * 60_000
const OnlineDot = ({ s }: { s: Subscription }) => (isOnline5(s) ? <span className="pf-online" title="usando agora">online agora</span> : null)

/* Mensagens prontas para quem está testando ou assinando (dá para ajustar antes de mandar). */
const MSG_TEMPLATES: { id: string; label: string; when: (s: Subscription) => boolean; text: (s: Subscription) => string }[] = [
  { id: 'oi', label: 'boas-vindas', when: (s) => s.status === 'trial' && trialDaysLeft(s) >= TRIAL_DAYS - 1, text: (s) => `oi, ${first(s)}! aqui é a ${PLATFORM.owner}, criadora do ${PLATFORM.name} 💛 que bom ter você aqui! uma dica para começar: coloque sua tabela de preços em configurações e faça um orçamento de teste. se travar em qualquer coisa, me chama por aqui.` },
  { id: 'como', label: 'como está sendo?', when: (s) => s.status === 'trial' && trialDaysLeft(s) < TRIAL_DAYS - 1 && trialDaysLeft(s) > 3, text: (s) => `oi, ${first(s)}! passando para saber como estão sendo os primeiros dias no ${PLATFORM.name}. conseguiu cadastrar um cliente e fazer um orçamento? o que está achando até agora?` },
  { id: 'sugestao', label: 'pedir sugestão', when: () => true, text: (s) => `oi, ${first(s)}! tem alguma coisa que deixaria o ${PLATFORM.name} mais útil para o seu dia a dia? pode ser algo que faltou ou que ficou confuso. eu leio tudo e muita coisa entra nas próximas atualizações 🙏` },
  { id: 'feedback', label: 'pedir depoimento', when: (s) => s.status === 'ativa' || (s.status === 'trial' && trialDaysLeft(s) <= 4), text: (s) => `oi, ${first(s)}! se você estiver gostando do ${PLATFORM.name}, deixaria um depoimento rapidinho? fica no menu “deixar depoimento”. ajuda muito outros freelancers a conhecerem ✨` },
  { id: 'acabando', label: 'teste acabando', when: (s) => s.status === 'trial' && trialDaysLeft(s) > 0 && trialDaysLeft(s) <= 3, text: (s) => `oi, ${first(s)}! seu teste grátis acaba em ${trialDaysLeft(s)} dia(s). quer continuar? é só escolher o plano em “minha assinatura” ou eu te mando o link por aqui. Pix ou cartão, sem fidelidade ☺️` },
  { id: 'acabou', label: 'teste acabou', when: (s) => s.status === 'trial' && trialDaysLeft(s) <= 0, text: (s) => `oi, ${first(s)}! seu teste terminou, mas fica tranquila(o): tudo o que você cadastrou está guardado. se quiser continuar, te mando o link para assinar. e se algo não funcionou para você, me conta? quero melhorar 💛` },
  { id: 'pix', label: 'mandar o Pix', when: (s) => !!s.requestedPlan || s.status === 'ativa' || s.status === 'atrasada', text: (s) => `oi, ${first(s)}! segue o Pix da sua assinatura do ${PLATFORM.name} (${PLANS[s.requestedPlan ?? s.plan].name}): [cole aqui a sua chave Pix ou o link]. assim que cair, eu ativo e te aviso ☺️` },
  { id: 'obrigada', label: 'agradecer', when: (s) => s.status === 'ativa', text: (s) => `obrigada, ${first(s)}! pagamento confirmado e sua assinatura está ativa. qualquer coisa, estou por aqui 💛` },
]
const first = (s: Subscription) => (s.name || '').split(' ')[0] || 'tudo bem'

type SaveCtrl = (userId: string, d: SubAdmin, msg?: string) => Promise<void>
/* ---- cobrança de cada assinante ---- */
const cycleOf = (s: Subscription, c?: SubAdmin, b?: Billing): Cycle => c?.cycle ?? (b?.cycle === 'semestral' ? 'semestral' : s.requestedCycle) ?? b?.cycle ?? 'mensal'
const priceOf = (s: Subscription, cycle: Cycle, method?: string) => (method === 'cartao' ? cardPrice(PLANS[s.plan].price, cycle) : cyclePrice(PLANS[s.plan].price, cycle))
/** Dias até vencer (negativo = vencida). Só para quem paga e tem "pago até". */
const dueDays = (s: Subscription, c?: SubAdmin) => (paying(s) && c?.paidUntil ? daysUntil(c.paidUntil) : null)
const dueLabel = (d: number) => (d < 0 ? `venceu há ${-d} dia(s)` : d === 0 ? 'vence hoje' : `vence em ${d} dia(s)`)
const dueColor = (d: number) => (d < 0 ? '#9a5b53' : d <= 5 ? '#b08a7e' : '#4f6475')
/** Registra um pagamento e empurra o "pago até" 1 mês (6 no semestral, 12 no anual). */
function withPayment(s: Subscription, c: SubAdmin | undefined, b: Billing | undefined, p: Omit<SubPayment, 'id'>): SubAdmin {
  const cycle = cycleOf(s, c, b)
  const base = c?.paidUntil && c.paidUntil > p.date ? c.paidUntil : p.date
  return { ...c, cycle, method: p.method, paidUntil: addMonths(base, CYCLE_MONTHS[cycle]), payments: [{ ...p, id: uid() }, ...(c?.payments ?? [])] }
}
const remindText = (s: Subscription, c?: SubAdmin) =>
  `oi, ${(s.name || '').split(' ')[0] || 'tudo bem'}! passando para lembrar que a sua assinatura do ${PLATFORM.name} (${PLANS[s.plan].name}) ${c?.paidUntil ? `vence em ${c.paidUntil.split('-').reverse().join('/')}` : 'está para renovar'}. ${c?.method === 'cartao' ? 'no cartão a cobrança é automática, é só conferir se o cartão está em dia ☺️' : 'posso te mandar o Pix por aqui? ☺️'}`

const activate = (s: Subscription): Partial<Subscription> => ({ status: 'ativa', plan: s.requestedPlan ?? s.plan, requestedPlan: null, requestedAt: null, canceledAt: null, blocked: false })

function Summary({ subs, update, openChat, billing, ctrl, saveCtrl }: { subs: Subscription[]; update: (s: Subscription, p: Partial<Subscription>, msg: string) => Promise<void>; openChat: (id: string) => void; billing: Record<string, Billing>; ctrl: Record<string, SubAdmin>; saveCtrl: SaveCtrl }) {
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

  // pagamentos registrados de verdade (aba assinantes → cobrança)
  const allPays = subs.flatMap((s) => (ctrl[s.userId]?.payments ?? []).map((p) => ({ s, p })))
  const ym = (iso: string) => iso.slice(0, 7)
  const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const receivedMonth = allPays.filter((x) => ym(x.p.date) === nowYM).reduce((n, x) => n + x.p.amount, 0)
  const realRevenue = months.map((m) => allPays.filter((x) => ym(x.p.date) === `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`).reduce((n, x) => n + x.p.amount, 0))
  const hasReal = allPays.length > 0
  const upcoming = subs
    .map((s) => ({ s, d: dueDays(s, ctrl[s.userId]) }))
    .filter((x): x is { s: Subscription; d: number } => x.d !== null && x.d <= 10)
    .sort((a, b) => a.d - b.d)
  const endingTrials = subs.filter((x) => x.status === 'trial' && trialDaysLeft(x) > 0 && trialDaysLeft(x) <= 3)
  return (
    <>
      <div className="stats">
        <Stat label="Online agora" value={subs.filter(isOnline5).length} sub={subs.filter(isOnline5).map((x) => first(x)).join(', ') || 'ninguém usando neste momento'} icon="users" />
        <Stat label="Recebido este mês" value={money(receivedMonth)} sub={hasReal ? `${allPays.filter((x) => ym(x.p.date) === nowYM).length} pagamento(s) registrado(s)` : 'registre em assinantes → cobrança'} icon="check" tone="good" />
        <Stat label="Vencendo / vencidas" value={upcoming.length} sub={upcoming.length ? `${upcoming.filter((x) => x.d < 0).length} vencida(s) · ${money(upcoming.reduce((n, x) => n + priceOf(x.s, cycleOf(x.s, ctrl[x.s.userId], billing[x.s.userId])), 0))}` : 'nada nos próximos 10 dias'} icon="calendar" tone={upcoming.some((x) => x.d < 0) ? 'warn' : undefined} />
        <Stat label="Pedidos de assinatura" value={requests.length} sub={requests.length ? requests.map((x) => `${first(x)} · ${PLANS[x.requestedPlan!].name}`).join(', ') : 'nenhum pedido esperando'} icon="inbox" tone={requests.length ? 'warn' : undefined} />
      </div>
      {(upcoming.length > 0 || endingTrials.length > 0) && (
        <Section title="cobranças e testes para olhar">
          {upcoming.map(({ s, d }) => {
            const c = ctrl[s.userId]
            const cyc = cycleOf(s, c, billing[s.userId])
            return (
              <div key={s.userId} className="pf-plan-line">
                <b>{s.name || s.email}</b>
                <span className="muted small">
                  {PLANS[s.plan].name} · {money(priceOf(s, cyc, c?.method))}/{CYCLE_UNIT[cyc]} · {c?.method === 'cartao' ? 'cartão' : 'Pix'}
                </span>
                <Badge color={dueColor(d)}>{dueLabel(d)}</Badge>
                <span className="grow" />
                <button className="btn small ghost" onClick={() => void platform.send(s.userId, remindText(s, c), true).then(() => toast('Lembrete enviado na conversa.'), () => toast('Não foi possível enviar agora.'))}>
                  <Icon name="chat" size={14} /> lembrar
                </button>
                <button
                  className="btn small approve"
                  onClick={async () => {
                    const amount = priceOf(s, cyc)
                    if (!(await ask(`Registrar ${money(amount)} de ${s.name || s.email} recebido hoje (${c?.method === 'cartao' ? 'cartão' : 'Pix'})?`, { confirmLabel: 'Registrar' }))) return
                    const next = withPayment(s, c, billing[s.userId], { date: today(), amount, method: c?.method ?? 'pix', note: '' })
                    void saveCtrl(s.userId, next, `Pagamento registrado. Pago até ${next.paidUntil!.split('-').reverse().join('/')}.`)
                  }}
                >
                  <Icon name="check" size={14} /> recebi
                </button>
              </div>
            )
          })}
          {endingTrials.map((s) => (
            <div key={s.userId} className="pf-plan-line">
              <b>{s.name || s.email}</b>
              <span className="muted small">teste do {PLANS[s.plan].name}</span>
              <Badge color="#7d8c99">{`teste acaba em ${trialDaysLeft(s)} dia(s)`}</Badge>
              <span className="grow" />
              <button className="btn small ghost" onClick={() => openChat(s.userId)}>
                <Icon name="chat" size={14} /> conversar
              </button>
            </div>
          ))}
        </Section>
      )}
      <div className="stats">
        <Stat label="Receita por mês" value={money(mrr)} sub={`${active.length} assinante(s) ativo(s)`} icon="wallet" tone="good" />
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
                quer o {PLANS[s.requestedPlan!].name} · {(() => {
                  const cy: Cycle = billing[s.userId]?.cycle === 'semestral' ? 'semestral' : s.requestedCycle ?? billing[s.userId]?.cycle ?? 'mensal'
                  const pr = PLANS[s.requestedPlan!].price
                  return `${money(billing[s.userId]?.payMethod === 'cartao' ? cardPrice(pr, cy) : cyclePrice(pr, cy))}/${CYCLE_UNIT[cy]}`
                })()}
                {billing[s.userId] ? ` · ${PAY_LABEL[billing[s.userId].payMethod]}${(billing[s.userId].installments ?? 1) > 1 ? ` em ${billing[s.userId].installments}x` : ''}` : ''}
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
      <Section title="receita (últimos 6 meses)">
        <BarChart labels={months.map((m) => MONTHS[m.getMonth()])} series={[{ label: hasReal ? 'recebido' : 'estimado', color: 'var(--accent)', values: hasReal ? realRevenue : revenue }]} height={200} />
        <p className="muted small">{hasReal ? 'Soma dos pagamentos que você registrou em assinantes → cobrança.' : 'Estimativa pelos planos ativos. Registre os pagamentos em assinantes → cobrança para ver o valor real.'}</p>
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

function Subscribers({ subs, update, openChat, unreadOf, billing, saveBilling, ctrl, saveCtrl }: { subs: Subscription[]; update: (s: Subscription, p: Partial<Subscription>, msg: string) => Promise<void>; openChat: (id: string) => void; unreadOf: (id: string) => number; billing: Record<string, Billing>; saveBilling: (userId: string, b: Billing) => Promise<void>; ctrl: Record<string, SubAdmin>; saveCtrl: SaveCtrl }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useKeep<'todos' | SubStatus | 'bloqueados' | 'vencendo' | 'teste_acabando' | 'sumidos'>('painel-filtro', 'todos')
  const [order, setOrder] = useKeep<'recentes' | 'nome' | 'vencimento' | 'acesso'>('painel-ordem', 'recentes')
  const idle = (s: Subscription) => !s.lastSeen || Date.now() - new Date(s.lastSeen).getTime() > 14 * 86_400_000
  const rows = subs
    .filter((s) => matches(q, s.name, s.email, s.studio, ctrl[s.userId]?.notes))
    .filter((s) => {
      if (filter === 'todos') return true
      if (filter === 'bloqueados') return s.blocked
      if (filter === 'vencendo') return (dueDays(s, ctrl[s.userId]) ?? 99) <= 7
      if (filter === 'teste_acabando') return s.status === 'trial' && trialDaysLeft(s) > 0 && trialDaysLeft(s) <= 3
      if (filter === 'sumidos') return s.status !== 'cancelada' && idle(s)
      return s.status === filter
    })
    .sort((a, b) =>
      order === 'nome'
        ? (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR')
        : order === 'vencimento'
          ? (dueDays(a, ctrl[a.userId]) ?? 9999) - (dueDays(b, ctrl[b.userId]) ?? 9999)
          : order === 'acesso'
            ? (b.lastSeen || '').localeCompare(a.lastSeen || '')
            : b.createdAt.localeCompare(a.createdAt),
    )
  const exportCSV = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['nome', 'e-mail', 'estúdio', 'plano', 'situação', 'ciclo', 'forma', 'pago até', 'total pago', 'desde', 'último acesso', 'telefone', 'cidade', 'anotações']
    const lines = rows.map((s) => {
      const c = ctrl[s.userId]
      const b = billing[s.userId]
      return [s.name, s.email, s.studio, PLANS[s.plan].name, STATUS_LABEL[s.status], cycleOf(s, c, b), c?.method ?? b?.payMethod ?? '', c?.paidUntil ?? '', (c?.payments ?? []).reduce((n, x) => n + x.amount, 0).toFixed(2).replace('.', ','), dateBR(s.createdAt), dateBR(s.lastSeen), b?.phone ?? '', b?.city ?? '', c?.notes ?? ''].map(cell).join(';')
    })
    download(`assinantes-${today()}.csv`, '\ufeff' + [head.map(cell).join(';'), ...lines].join('\n'), 'text/csv;charset=utf-8')
  }
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
          <option value="vencendo">vencendo em 7 dias / vencidas</option>
          <option value="teste_acabando">teste acabando (3 dias)</option>
          <option value="sumidos">sem entrar há 14 dias</option>
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)} aria-label="Ordem">
          <option value="recentes">mais recentes</option>
          <option value="nome">nome (A–Z)</option>
          <option value="vencimento">vencimento</option>
          <option value="acesso">último acesso</option>
        </select>
        <button className="btn ghost small" onClick={exportCSV} title="Planilha com os assinantes deste filtro">
          <Icon name="download" size={14} /> CSV
        </button>
      </div>
      <p className="muted small">{rows.length} de {subs.length} assinante(s)</p>
      <div className="pf-subs">
        {rows.map((s) => {
          const left = trialDaysLeft(s)
          const unread = unreadOf(s.userId)
          return (
            <article key={s.userId} className={`card pf-sub ${s.blocked ? 'is-blocked' : ''}`}>
              <header className="pf-sub-head">
                <span className="pf-avatar">{(s.name || s.email || '?')[0].toUpperCase()}</span>
                <span className="grow">
                  <b>{s.name || 'sem nome'}</b> <OnlineDot s={s} />
                  <small className="muted">{s.studio || '—'}</small>
                  <small className="muted pf-email">{s.email}</small>
                </span>
              </header>
              <div className="pf-badges">
                <Badge color={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                <Badge color="#3e4b57">{PLANS[s.plan].name}</Badge>
                {s.deletedAt ? <Badge color="#9aa3ab">conta apagada em {dateBR(s.deletedAt)}</Badge> : s.blocked && <Badge color="#9a5b53">bloqueado</Badge>}
                {!s.deletedAt && s.status === 'cancelada' && s.canceledAt && <Badge color="#9aa3ab">desativou em {dateBR(s.canceledAt)}</Badge>}
                {s.requestedPlan && <Badge color="#b08a7e">pediu o {PLANS[s.requestedPlan].name}</Badge>}
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
              {billing[s.userId] && <BillingDetails s={s} b={billing[s.userId]} save={(b) => saveBilling(s.userId, b)} />}
              {!s.deletedAt && <TrialControl s={s} update={update} />}
              {!s.deletedAt && (s.status !== 'trial' || ctrl[s.userId]) && <SubControl s={s} c={ctrl[s.userId]} b={billing[s.userId]} save={saveCtrl} />}
              {s.deletedAt ? (
                <p className="muted small">A pessoa apagou a conta: os dados do sistema dela foram removidos. O cadastro fica aqui só para consulta.</p>
              ) : (
              <>
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
              </>
              )}
            </article>
          )
        })}
        {!rows.length && <p className="muted">Ninguém com esse filtro.</p>}
      </div>
    </>
  )
}

/** Cobrança de um assinante: ciclo, forma, pago até, pagamentos e anotações (só a dona vê). */
function SubControl({ s, c, b, save }: { s: Subscription; c?: SubAdmin; b?: Billing; save: SaveCtrl }) {
  const cycle = cycleOf(s, c, b)
  const [adding, setAdding] = useState(false)
  const [pay, setPay] = useState({ date: today(), amount: priceOf(s, cycle), method: (c?.method ?? (b?.payMethod === 'cartao' ? 'cartao' : 'pix')) as SubPayment['method'] })
  const [notes, setNotes] = useState(c?.notes ?? '')
  useEffect(() => {
    setNotes(c?.notes ?? '')
  }, [c?.notes])
  const d = dueDays(s, c)
  const paid = (c?.payments ?? []).reduce((n, x) => n + x.amount, 0)
  const set = (patch: Partial<SubAdmin>, msg = '') => save(s.userId, { ...c, cycle, ...patch }, msg)
  return (
    <details className="pf-fold pf-ctrl">
      <summary className="pf-ctrl-head">
        <b>cobrança</b>
        {d !== null && <Badge color={dueColor(d)}>{dueLabel(d)}</Badge>}
        {paid > 0 && <span className="muted small">total pago {money(paid)}</span>}
        {d === null && !paid && <span className="muted small">registrar pagamentos e vencimento</span>}
      </summary>
      <div className="pf-ctrl-grid">
        <Segmented value={cycle} onChange={(v) => set({ cycle: v }, 'Ciclo atualizado.')} options={[{ value: 'mensal', label: 'mensal' }, { value: 'semestral', label: 'semestral' }, { value: 'anual', label: 'anual' }]} />
        <Segmented value={c?.method ?? 'pix'} onChange={(v) => set({ method: v }, 'Forma de pagamento atualizada.')} options={[{ value: 'pix', label: 'Pix' }, { value: 'cartao', label: 'cartão' }]} />
        <label className="pf-ctrl-date">
          <span className="muted small">pago até</span>
          <DateInput value={c?.paidUntil ?? ''} onChange={(e) => set({ paidUntil: e.target.value || undefined }, 'Vencimento atualizado.')} />
        </label>
      </div>
      {adding ? (
        <div className="pf-ctrl-add">
          <MoneyInput value={pay.amount} onChange={(amount) => setPay({ ...pay, amount })} />
          <DateInput value={pay.date} max={today()} onChange={(e) => setPay({ ...pay, date: e.target.value || today() })} />
          <Segmented value={pay.method} onChange={(method) => setPay({ ...pay, method })} options={[{ value: 'pix', label: 'Pix' }, { value: 'cartao', label: 'cartão' }]} />
          <button
            className="btn small approve"
            onClick={() => {
              if (pay.amount <= 0) return toast('Coloque o valor recebido.')
              const next = withPayment(s, c, b, { ...pay, note: '' })
              void save(s.userId, next, `Pagamento registrado. Pago até ${next.paidUntil!.split('-').reverse().join('/')}.`)
              setAdding(false)
            }}
          >
            <Icon name="check" size={14} /> registrar
          </button>
          <button className="btn small ghost" onClick={() => setAdding(false)}>
            cancelar
          </button>
        </div>
      ) : (
        <div className="row gap-s wrap">
          <button className="btn small" onClick={() => (setPay((x) => ({ ...x, amount: priceOf(s, cycle), date: today() })), setAdding(true))}>
            <Icon name="plus" size={14} /> registrar pagamento
          </button>
          {s.status !== 'cancelada' && (
            <button
              className="btn small ghost"
              onClick={async () => {
                try {
                  await platform.send(s.userId, remindText(s, c), true)
                  toast('Lembrete enviado na conversa.')
                } catch {
                  toast('Não foi possível enviar agora.')
                }
              }}
            >
              <Icon name="chat" size={14} /> lembrar no chat
            </button>
          )}
        </div>
      )}
      {(c?.payments?.length ?? 0) > 0 && (
        <details className="pf-ctrl-hist">
          <summary>pagamentos ({c!.payments!.length})</summary>
          {c!.payments!.map((x) => (
            <div key={x.id} className="pf-plan-line">
              <span>{x.date.split('-').reverse().join('/')}</span>
              <b>{money(x.amount)}</b>
              <span className="muted small">{x.method === 'cartao' ? 'cartão' : 'Pix'}</span>
              <span className="grow" />
              <button className="icon-btn" aria-label="Apagar pagamento" onClick={async () => (await askDelete('este pagamento')) && set({ payments: c!.payments!.filter((y) => y.id !== x.id) }, 'Pagamento apagado.')}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </details>
      )}
      <textarea className="pf-ctrl-notes" rows={2} placeholder="anotações só suas (ex.: prefere pagar dia 15, indicou fulana…)" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (c?.notes ?? '') && void set({ notes }, 'Anotação salva.')} spellCheck lang="pt-BR" />
    </details>
  )
}

const MAIL_KIND: Record<string, string> = { 'boas-vindas': 'boas-vindas', 'teste-acabando': 'teste acabando', 'teste-acabou': 'teste acabou', ativada: 'assinatura ativada', 'vence-em-breve': 'Pix vencendo', novidade: 'novidade', 'dona-mensagem': 'mensagem nova (para você)', 'dona-sugestao': 'sugestão nova (para você)', resposta: 'resposta no chat', sugestao: 'sugestão respondida', briefing: 'briefing respondido' }
/** E-mails automáticos: o que sai sozinho, o histórico e o envio de novidades para todos. */
function EmailsAdmin({ subs }: { subs: Subscription[] }) {
  const [log, setLog] = useState<Awaited<ReturnType<typeof platform.emailLog>>>([])
  const [title, setTitle] = useState(NEWS[0]?.title ?? '')
  const [text, setText] = useState(NEWS[0]?.text ?? '')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void platform.emailLog().then(setLog)
  }, [])
  const who = (id: string) => subs.find((s) => s.userId === id)
  const reach = subs.filter((s) => s.status !== 'cancelada' && !s.blocked).length
  return (
    <>
      <Section title="o que sai sozinho">
        <ul className="pf-mail-list">
          <li><b>boas-vindas</b> · quando a pessoa entra pela primeira vez</li>
          <li><b>teste acabando</b> · 3 dias antes do fim do teste grátis</li>
          <li><b>teste acabou</b> · no dia em que o teste termina (os dados continuam guardados)</li>
          <li><b>assinatura ativada</b> · quando você toca em “ativar” aqui no painel</li>
          <li><b>Pix vencendo</b> · 3 dias antes do “pago até” de quem paga no Pix (cartão cobra sozinho)</li>
          <li><b>confirmar e-mail, nova senha e troca de e-mail</b> · pelo próprio Supabase (modelos em Authentication → Emails)</li>
        </ul>
        <p className="muted small">Cada aviso vai uma vez só para cada pessoa. Para funcionar, a função “avisos” precisa estar publicada no Supabase (passo a passo no chat com o Claude).</p>
      </Section>
      <Section title="mandar uma novidade por e-mail">
        <p className="muted small">Vai para quem está em teste ou com assinatura ativa ({reach} pessoa(s)). Use pouco: só para novidades que valem a pena. Dentro do sistema, as novidades já aparecem sozinhas.</p>
        <div className="form-grid">
          <Field label="Título" span={3}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Texto" span={3} hint="Linha em branco = novo parágrafo.">
            <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} spellCheck lang="pt-BR" />
          </Field>
        </div>
        <button
          className="btn primary"
          disabled={busy || !title.trim() || !text.trim()}
          onClick={async () => {
            if (!(await ask(`Mandar “${title}” por e-mail para ${reach} pessoa(s)?`, { confirmLabel: 'Mandar' }))) return
            setBusy(true)
            try {
              const r = await platform.notice({ tipo: 'novidade', title: title.trim(), text: text.trim() })
              toast(r.erro ? `Não foi: ${r.erro}` : `Enviado para ${r.enviados ?? 0} pessoa(s).`)
              setLog(await platform.emailLog())
            } catch {
              toast('Não foi possível mandar. Confira se a função “avisos” está publicada no Supabase.')
            }
            setBusy(false)
          }}
        >
          <Icon name="mail" size={16} /> mandar para todos
        </button>
      </Section>
      <Section title="últimos e-mails enviados">
        {log.length === 0 ? (
          <p className="muted small">Nenhum aviso enviado ainda.</p>
        ) : (
          log.map((x) => (
            <div key={`${x.userId}-${x.kind}-${x.ref}`} className="pf-plan-line">
              <b>{who(x.userId)?.name || who(x.userId)?.email || 'alguém'}</b>
              <span className="muted small">{MAIL_KIND[x.kind] ?? x.kind}{x.kind === 'novidade' ? ` · ${x.ref}` : ''}</span>
              <span className="grow" />
              <span className="muted small">{ago(x.sentAt)}</span>
            </div>
          ))
        )}
      </Section>
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
  const notifyAsk = useNotifyAsk()
  if (!threads.length && !current) return <Empty icon="chat" title="nenhuma conversa ainda" text="Quando um cliente escrever no chat, a conversa aparece aqui e você recebe um aviso no menu." />
  return (
    <div className={`pf-inbox ${current ? 'has-open' : ''}`}>
      <div className="card pf-threads">
        {notifyAsk.canAsk && (
          <button type="button" className="pf-notify-ask" onClick={() => void notifyAsk.ask()} title="Mensagens e sugestões novas aparecem no canto da tela, mesmo com o sistema numa aba de fundo">
            <Icon name="bell" size={14} /> ativar avisos neste aparelho
          </button>
        )}
        {threads.map((t) => (
          <button key={t.id} className={`pf-thread ${t.id === current ? 'is-active' : ''}`} onClick={() => setCurrent(t.id)}>
            <span className="pf-avatar">{(t.sub?.name || '?')[0].toUpperCase()}</span>
            <span className="grow">
              <b>{t.sub?.name || 'cliente'}</b> {t.sub && <OnlineDot s={t.sub} />}
              <small className="muted">
                {t.last.fromOwner ? 'você: ' : ''}
                {richPlain(t.last.body).slice(0, 60)}
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
  const { data } = useStore()
  const aiKey = data.settings.aiKey
  const [text, setText] = useState('')
  const [drafting, setDrafting] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const unread = (msgs ?? []).some((m) => !m.fromOwner && !m.readAt)
  useEffect(() => {
    if (unread) void markRead().then(onChange)
  }, [unread, markRead, onChange])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs])
  const submit = async () => {
    if (!text.trim()) return
    if (await send(text, true)) {
      setText('')
      void onChange()
      void platform.notice({ tipo: 'resposta', userId: clientId, text }).catch(() => undefined)
    }
  }
  // rascunho com IA: o que já estiver escrito na caixa vira "anotações" do que ela quer dizer
  const draft = async () => {
    if (!aiKey) {
      toast('Para a IA escrever, coloque sua chave do Gemini em configurações → assistente.')
      return
    }
    if (!msgs?.length) return
    setDrafting(true)
    try {
      setText(await draftReply({ key: aiKey, sub, msgs, notes: text }))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'A IA não respondeu agora. Tente de novo.')
    } finally {
      setDrafting(false)
    }
  }
  const lastFromClient = !!msgs?.length && !msgs[msgs.length - 1].fromOwner
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
            <p>
              <RichText text={m.body} />
            </p>
            <small className="pf-msg-time">
              {timeLabel(m.createdAt)}
              {m.fromOwner && m.readAt ? ' · lida' : ''}
            </small>
          </div>
        ))}
        {msgs?.length === 0 && <p className="muted small center">comece a conversa ☺️</p>}
        <div ref={endRef} />
      </div>
      {sub && (
        <div className="pf-templates" aria-label="Mensagens prontas">
          <span className="muted small">prontas:</span>
          {[...MSG_TEMPLATES].sort((x, y) => Number(y.when(sub)) - Number(x.when(sub))).map((t) => (
            <button key={t.id} type="button" className={`chip ${t.when(sub) ? 'is-suggested' : ''}`} onClick={() => setText(t.text(sub))} title="Coloca a mensagem na caixa para você ajustar e mandar">
              {t.label}
            </button>
          ))}
        </div>
      )}
      <form
        className="ai-chat-input rich-form"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <RichInput
          value={text}
          onChange={setText}
          onSubmit={() => void submit()}
          placeholder={drafting ? 'a IA está escrevendo…' : 'Responder…'}
          tools={
            !!msgs?.length && (
              <>
                <span className="grow" />
                <button
                  type="button"
                  className={`chip rich-ai ${lastFromClient && !text ? 'is-suggested' : ''}`}
                  onClick={() => void draft()}
                  disabled={drafting}
                  title={aiKey ? 'A IA escreve um rascunho com base na conversa. Se você escrever uma ideia antes, ela usa como guia.' : 'Coloque sua chave do Gemini em configurações → assistente'}
                >
                  <Icon name="sparkle" size={13} /> {drafting ? 'escrevendo…' : text.trim() ? 'IA usando minha ideia' : 'responder com IA'}
                </button>
                {!aiKey && (
                  <a className="small muted" href={href('config')} onClick={() => localStorage.setItem('config-aba', 'ia')}>
                    colocar chave
                  </a>
                )}
              </>
            )
          }
        />
        <button className="btn primary icon-only" disabled={!text.trim() || drafting} aria-label="Enviar">
          <Icon name="arrowRight" size={18} />
        </button>
      </form>
      {text && !drafting && <p className="rich-hint muted">confira o texto antes de mandar: selecione palavras para tirar ou pôr negrito, itálico e sublinhado</p>}
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
function BillingDetails({ s, b, save }: { s: Subscription; b: Billing; save: (b: Billing) => Promise<void> }) {
  const [edit, setEdit] = useState<Billing | null>(null)
  const missing = billingMissing(b)
  const setE = (patch: Partial<Billing>) => setEdit((x) => (x ? { ...x, ...patch } : x))
  return (
    <details className="sg-billing" open={!!edit}>
      <summary>
        dados de cobrança{missing.length ? <em className="text-bad"> · falta {missing.join(', ')}</em> : ''}
      </summary>
      {edit ? (
        <div className="stack-s">
          <BillingFields part="dados" b={edit} set={setE} docOk={validDoc(edit.doc)} />
          <BillingFields part="endereco" b={edit} set={setE} docOk={validDoc(edit.doc)} />
          <div className="row gap-s">
            <button className="btn small primary" onClick={async () => (await save(edit), setEdit(null))}>
              salvar correção
            </button>
            <button className="btn small ghost" onClick={() => setEdit(null)}>
              cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="pf-facts sg-facts">
            {(
              [
                ['nome', b.fullName],
                ['CPF/CNPJ', b.doc],
                ['celular', b.phone],
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
          <div className="row gap-s wrap">
            <button className="btn small" onClick={() => setEdit(b)}>
              <Icon name="edit" size={14} /> corrigir eu mesma
            </button>
            <button
              className="btn small ghost"
              onClick={async () => {
                try {
                  await platform.send(s.userId, `oi, ${(s.name || '').split(' ')[0] || 'tudo bem'}! pode conferir seus dados em “minha assinatura” → “meus dados”?${missing.length ? ` está faltando: ${missing.join(', ')}.` : ' acho que algum dado ficou errado (CPF, celular ou endereço).'} é só tocar em “corrigir” ☺️`, true)
                  toast('Pedido de correção enviado no chat.')
                } catch {
                  toast('Não foi possível enviar agora.')
                }
              }}
            >
              <Icon name="chat" size={14} /> pedir para corrigir
            </button>
          </div>
        </>
      )}
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
      // quem sugeriu recebe o aviso por e-mail (e na tela, quando abrir o sistema)
      void platform.notice({ tipo: 'sugestao-atualizada', id: x.id }).catch(() => undefined)
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
      // textos antigos (só freelancer) já aparecem atualizados: é só salvar
      setSite(freshSite(x))
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
        title="topo da página"
        action={
          <button className="btn primary small" disabled={!dirty} onClick={() => void save()}>
            {dirty ? 'salvar' : 'salvo'}
          </button>
        }
      >
        <div className="form-grid">
          <Field label="Faixa de aviso no alto" span={3} hint="Ex.: “lançamento: 20% de desconto no plano anual até 31/10”. Em branco, a faixa some.">
            <input value={site.banner} onChange={(e) => set({ banner: e.target.value })} placeholder="em branco = sem faixa" />
          </Field>
          <Field label="Etiqueta acima do título" span={3}>
            <input value={site.kicker} onChange={(e) => set({ kicker: e.target.value })} />
          </Field>
          <Field label="Título" span={3} hint="A palavra que gira aparece logo depois.">
            <input value={site.heroTitle} onChange={(e) => set({ heroTitle: e.target.value })} />
          </Field>
          <Field label="Palavras que giram" span={3} hint="Separe por vírgula. Ex.: organizada, mais leve, no seu ritmo">
            <input value={site.heroWords} onChange={(e) => set({ heroWords: e.target.value })} />
          </Field>
          <Field label="Frase embaixo do título" span={3}>
            <textarea rows={2} value={site.lead} onChange={(e) => set({ lead: e.target.value })} spellCheck lang="pt-BR" />
          </Field>
        </div>
      </Section>
      <Section title="seções da página">
        <p className="muted small">Desmarque o que não quer mostrar agora. Planos e “quem criou” ficam sempre.</p>
        <div className="se-sections">
          {LP_SECTIONS.map(([id, label]) => (
            <label key={id} className="check">
              <input type="checkbox" checked={!(site.hidden ?? []).includes(id)} onChange={(e) => set({ hidden: e.target.checked ? (site.hidden ?? []).filter((x) => x !== id) : [...(site.hidden ?? []), id] })} /> {label}
            </label>
          ))}
        </div>
        <Field label="Perguntas frequentes a mais" hint="Pergunta na primeira linha e a resposta embaixo. Deixe uma linha em branco entre uma pergunta e outra. Elas aparecem depois das perguntas padrão.">
          <textarea rows={6} value={site.faqExtra} onChange={(e) => set({ faqExtra: e.target.value })} placeholder={'emite nota fiscal?\nSim, ...\n\ntem aplicativo?\nFunciona pelo navegador e dá para salvar na tela inicial.'} spellCheck lang="pt-BR" />
        </Field>
      </Section>
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
            <p className="muted small">A foto aparece no círculo do “quem criou”. Prefira uma com o rosto no centro; ela é reduzida sozinha para carregar rápido.</p>
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
    <details className="pf-fold">
      <summary>
        <b>{inTrial ? 'teste grátis' : 'liberar teste grátis'}</b>
        {inTrial && <span className="muted small">{left > 0 ? `até ${dateBR(s.trialEnds)} · faltam ${left} dia(s)` : `terminou em ${dateBR(s.trialEnds)}`}</span>}
      </summary>
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
    </details>
  )
}

/** Nome, preço, frase, lista e o que cada plano libera + dias de teste: tudo editável pela dona. */
function PlansEditor() {
  const snap = (): PlanConfig => ({
    trialDays: TRIAL_DAYS,
    annualFreeMonths: ANNUAL_FREE_MONTHS,
    cardFee: CARD_FEE,
    cardFee6: CARD_FEE_6,
    semesterDiscount: SEMESTER_DISCOUNT,
    plans: Object.fromEntries(PLAN_LIST.map((p) => [p.id, { name: p.name, price: p.price, pitch: p.pitch, highlights: [...p.highlights], features: [...p.features], decided: PLAN_TOGGLES.map(([f]) => f) }])) as PlanConfig['plans'],
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
        title="teste grátis, semestral e anual"
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
          <Field label="Desconto no semestral (%)" hint="Menor que o do anual, para o anual continuar sendo o melhor negócio.">
            <input type="number" min={0} max={50} value={cfg.semesterDiscount ?? 10} onChange={(e) => setCfg({ ...cfg, semesterDiscount: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
          </Field>
          <Field label="Meses grátis no anual" hint="No Pix à vista, a pessoa paga 12 menos estes meses. 2 meses grátis (paga 10) é o que mais chama atenção.">
            <input type="number" min={0} max={6} value={cfg.annualFreeMonths ?? 2} onChange={(e) => setCfg({ ...cfg, annualFreeMonths: Math.max(0, Math.min(6, Math.round(Number(e.target.value) || 0))) })} />
          </Field>
          <Field label="Taxa do cartão em 6x (%)" hint="A taxa para parcelar em 6x por sua conta. Ela entra no preço do semestral no cartão (6x sem juros).">
            <input type="number" min={0} max={40} step={0.1} value={cfg.cardFee6 ?? 8} onChange={(e) => setCfg({ ...cfg, cardFee6: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })} />
          </Field>
          <Field label="Taxa do cartão em 12x (%)" hint="A taxa que o seu serviço de cobrança cobra para parcelar em 12x por sua conta. Ela entra no preço do anual no cartão, que aparece como 12x sem juros: você recebe o mesmo que no Pix.">
            <input type="number" min={0} max={40} step={0.1} value={cfg.cardFee ?? 12} onChange={(e) => setCfg({ ...cfg, cardFee: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })} />
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
                <Field label="Preço por mês" hint={(() => {
                  const pr = o.price ?? p.price
                  const pix = Math.round(pr * (12 - (cfg.annualFreeMonths ?? 2)) * 100) / 100
                  const cardMonth = Math.round(((pix * (1 + (cfg.cardFee ?? 12) / 100)) / 12) * 100) / 100
                  return `Semestral: ${money0(Math.round(pr * 6 * (1 - (cfg.semesterDiscount ?? 10) / 100) * 100) / 100)} no Pix ou 6x de ${money0(Math.round(((pr * 6 * (1 - (cfg.semesterDiscount ?? 10) / 100) * (1 + (cfg.cardFee6 ?? 8) / 100)) / 6) * 100) / 100)} · anual: ${money0(pix)} no Pix ou 12x de ${money0(cardMonth)}${cardMonth >= pr ? ' (atenção: mais caro que o mensal)' : ''}`
                })()}>
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

/** Depoimentos: a dona escolhe quais vão para a página de vendas (só os autorizados pela pessoa). */
function FeedbackAdmin() {
  const [list, setList] = useState<Feedback[] | null>(null)
  const [filter, setFilter] = useState<'todos' | 'publicados' | 'autorizados'>('todos')
  const load = useCallback(() => platform.feedbacks().then(setList).catch(() => setList([])), [])
  useEffect(() => {
    void load()
  }, [load])
  if (!list) return <p className="muted small">carregando…</p>
  if (!list.length) return <Empty icon="heart" title="nenhum depoimento ainda" text="Quem usa o sistema pode deixar um depoimento em “deixar depoimento”. Eles aparecem aqui para você escolher quais vão para a página de vendas." />
  const toggle = async (f: Feedback) => {
    try {
      await platform.setFeedbackPublished(f.id, !f.published)
      toast(f.published ? 'Saiu da página de vendas.' : 'Agora aparece na página de vendas.')
      await load()
    } catch {
      toast('Não foi possível salvar agora.')
    }
  }
  const remove = async (f: Feedback) => {
    if (!(await askDelete('este depoimento'))) return
    await platform.deleteFeedback(f.id).catch(() => toast('Não foi possível apagar agora.'))
    await load()
  }
  const rows = list.filter((f) => (filter === 'publicados' ? f.published : filter === 'autorizados' ? f.allowPublish : true))
  const onPage = list.filter((f) => f.published).length
  return (
    <>
      <p className="pf-note">
        <Icon name="star" size={16} />
        <span>
          <b>{onPage}</b> na página de vendas agora. Só dá para mostrar os depoimentos que a pessoa autorizou; aparecem só o nome, a profissão, as estrelas e o texto. Sem nenhum escolhido, a seção de depoimentos some da página.{' '}
          <a className="link" href="#/vendas">
            ver a página de vendas
          </a>
        </span>
      </p>
      <div className="sg-filters">
        {(
          [
            ['todos', `todos ${list.length}`],
            ['autorizados', `autorizados ${list.filter((f) => f.allowPublish).length}`],
            ['publicados', `na página ${onPage}`],
          ] as [typeof filter, string][]
        ).map(([k, label]) => (
          <button key={k} className={`sg-filter ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="fb-admin">
        {rows.map((f) => (
          <article key={f.id} className={`card fb-card ${f.published ? 'is-on' : ''}`}>
            <header>
              <b className="fb-mini-stars">{'★'.repeat(f.stars)}<span className="muted">{'★'.repeat(5 - f.stars)}</span></b>
              <small className="muted">{timeLabel(f.createdAt)}</small>
            </header>
            <blockquote>{f.text}</blockquote>
            <footer>
              <span>
                <b>{f.name || 'sem nome'}</b>
                <small className="muted">{f.role || '—'}</small>
              </span>
              {f.allowPublish ? (
                <label className="check toggle">
                  <input type="checkbox" checked={f.published} onChange={() => void toggle(f)} /> na página de vendas
                </label>
              ) : (
                <small className="muted">não autorizou aparecer</small>
              )}
              <button className="icon-btn subtle" onClick={() => void remove(f)} aria-label="Apagar depoimento" title="Apagar">
                <Icon name="trash" size={15} />
              </button>
            </footer>
          </article>
        ))}
      </div>
    </>
  )
}
