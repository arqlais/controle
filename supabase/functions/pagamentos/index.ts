// Pagamentos do planê pelo Asaas (roda no Supabase, nunca no site).
// Cole em: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "pagamentos".
// IMPORTANTE: nas configurações da função, DESLIGUE "Verify JWT" (o Asaas avisa os pagamentos sem login;
// quem cria a cobrança é conferido aqui dentro pelo login da pessoa).
// Segredos (Edge Functions → Secrets):
//   ASAAS_API_KEY        → Asaas → Integrações → Chave de API (começa com $aact_)
//   ASAAS_WEBHOOK_TOKEN  → uma senha inventada por você; a mesma vai no webhook do Asaas (campo "Token de autenticação")
// Opcionais: SITE_URL (padrão https://useplane.com.br/); ASAAS_SANDBOX=1 para testar na conta de testes do Asaas.
// Webhook (Asaas → Integrações → Webhooks → Adicionar): URL https://<seu-projeto>.supabase.co/functions/v1/pagamentos?acao=webhook,
//   eventos "Cobrança confirmada" e "Cobrança recebida", com o mesmo token do segredo ASAAS_WEBHOOK_TOKEN.
//
// Ações:
//   criar   → a pessoa logada escolhe plano, ciclo e forma; devolve o link seguro do Asaas (a pessoa preenche os dados lá)
//             · mensal no cartão = assinatura recorrente (cobra todo mês sozinho)
//             · cartão no semestral/anual = parcelado em até 6x/12x sem juros (taxa já embutida no preço)
//             · Pix = QR Code na hora
//   webhook → o Asaas avisa cada pagamento; tudo é conferido de novo direto no Asaas. Confirmado, a conta é liberada sozinha,
//             o pagamento entra no controle da dona (assinantes → cobrança) e a pessoa recebe uma mensagem no chat.

import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (k: string, d = '') => Deno.env.get(k) ?? d
const SITE = env('SITE_URL', 'https://useplane.com.br/')
const TOKEN = env('ASAAS_API_KEY')
const HOOK_TOKEN = env('ASAAS_WEBHOOK_TOKEN')
const API = env('ASAAS_SANDBOX') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Plan = 'essencial' | 'completo' | 'estudio'
type Cycle = 'mensal' | 'semestral' | 'anual'
const NAMES: Record<Plan, string> = { essencial: 'Essencial', completo: 'Completo', estudio: 'Estúdio' }
const DEFAULT_PRICE: Record<Plan, number> = { essencial: 39.9, completo: 59.9, estudio: 89.9 }
const MONTHS: Record<Cycle, number> = { mensal: 1, semestral: 6, anual: 12 }
const INSTALLMENTS: Record<Cycle, number> = { mensal: 1, semestral: 6, anual: 12 }
const cents = (n: number) => Math.round(n * 100) / 100

/** Mesmas contas da página de vendas (preço do painel → planos). O valor nunca vem do navegador. */
async function priceOf(plan: Plan, cycle: Cycle, method: 'pix' | 'cartao') {
  const { data } = await db.from('platform_settings').select('data').eq('id', 1).maybeSingle()
  const cfg = (data?.data ?? {}) as Record<string, any>
  const monthly = Number(cfg.plans?.[plan]?.price ?? DEFAULT_PRICE[plan])
  const free = Number(cfg.annualFreeMonths ?? 2)
  const sem = Number(cfg.semesterDiscount ?? 10)
  const pix = cycle === 'anual' ? cents(monthly * (12 - free)) : cycle === 'semestral' ? cents(monthly * 6 * (1 - sem / 100)) : monthly
  const fee = cycle === 'anual' ? Number(cfg.cardFee ?? 12) : cycle === 'semestral' ? Number(cfg.cardFee6 ?? 8) : 0
  return { amount: method === 'cartao' ? cents(pix * (1 + fee / 100)) : pix, launched: cfg.launched === true, cfg }
}

async function asaas(path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { access_token: TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'plane', ...(init?.headers ?? {}) },
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Asaas ${r.status}: ${JSON.stringify(body?.errors ?? body).slice(0, 300)}`)
  return body as Record<string, any>
}

/** Desconto do 1º pagamento (indicação de assinante ou link de afiliado), só se ainda não pagou nada. */
async function firstDiscount(userId: string, sub: Record<string, any>) {
  const { data: ctrl } = await db.from('subscriber_admin').select('data').eq('user_id', userId).maybeSingle()
  if ((ctrl?.data?.payments ?? []).length) return 0
  if (sub.ref_used) {
    const { data: aff } = await db.from('affiliates').select('data, active').eq('code', sub.ref_used).maybeSingle()
    if (aff?.active) return Number(aff.data?.discount ?? 0)
  }
  return sub.referred_by ? 20 : 0
}

async function create(req: Request, body: Record<string, any>) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: u } = await db.auth.getUser(jwt)
  if (!u?.user) return json({ erro: 'Entre na sua conta para assinar.' }, 401)
  const plan = body.plano as Plan
  const cycle = body.ciclo as Cycle
  const method = body.forma === 'cartao' ? 'cartao' : 'pix'
  if (!NAMES[plan] || !MONTHS[cycle]) return json({ erro: 'Plano inválido.' }, 400)
  const { amount: full, launched } = await priceOf(plan, cycle, method)
  if (!launched) return json({ erro: 'As assinaturas ainda não foram abertas.' }, 400)
  const { data: sub } = await db.from('subscriptions').select('*').eq('user_id', u.user.id).maybeSingle()
  if (!sub) return json({ erro: 'Conta não encontrada.' }, 404)
  const ref = `${u.user.id}|${plan}|${cycle}|${method}`
  const recurring = cycle === 'mensal' && method === 'cartao' // assinatura: cobra todo mês sozinha
  const off = cycle === 'mensal' && !recurring ? await firstDiscount(u.user.id, sub) : 0
  const amount = cents(full * (1 - off / 100))
  const end = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) // link vale 7 dias
  const link: Record<string, any> = {
    name: `planê ${NAMES[plan]} · ${cycle}`,
    description: recurring ? 'Cobrança automática todo mês. Cancele quando quiser.' : method === 'cartao' ? `Em até ${INSTALLMENTS[cycle]}x sem juros.` : 'Pix com QR Code na hora.',
    value: amount,
    billingType: method === 'cartao' ? 'CREDIT_CARD' : 'PIX',
    chargeType: recurring ? 'RECURRENT' : method === 'cartao' && INSTALLMENTS[cycle] > 1 ? 'INSTALLMENT' : 'DETACHED',
    dueDateLimitDays: 3,
    endDate: end,
    externalReference: ref,
    notificationEnabled: false,
    callback: { successUrl: `${SITE}#/assinatura?pago=1`, autoRedirect: true },
  }
  if (recurring) link.subscriptionCycle = 'MONTHLY'
  if (link.chargeType === 'INSTALLMENT') link.maxInstallmentCount = INSTALLMENTS[cycle]
  let made: Record<string, any>
  try {
    made = await asaas('/paymentLinks', { method: 'POST', body: JSON.stringify(link) })
  } catch (e) {
    // o Asaas só aceita voltar para o site cadastrado em "Minha conta → Informações comerciais"; sem isso, cria sem voltar
    if (!/callback|successUrl|dom[ií]nio|domain/i.test(String(e))) throw e
    delete link.callback
    made = await asaas('/paymentLinks', { method: 'POST', body: JSON.stringify(link) })
  }
  // guarda de quem é o link: o aviso de pagamento traz o link, e assim a conta certa é liberada
  const { data: ctrl } = await db.from('subscriber_admin').select('data').eq('user_id', u.user.id).maybeSingle()
  const cur = (ctrl?.data ?? {}) as Record<string, any>
  await db.from('subscriber_admin').upsert({ user_id: u.user.id, data: { ...cur, asaasLinks: { ...(cur.asaasLinks ?? {}), [made.id]: ref } }, updated_at: new Date().toISOString() })
  return json({ url: made.url, desconto: off })
}

const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}

/** Pagamento aprovado: libera a conta, registra no controle da dona e avisa no chat (uma vez por pagamento). */
async function approve(ref: string, payId: string, amount: number, method: 'pix' | 'cartao', subscription?: string) {
  const [userId, plan, cycle] = ref.split('|') as [string, Plan, Cycle]
  if (!userId || !NAMES[plan] || !MONTHS[cycle]) return
  const { data: ctrl } = await db.from('subscriber_admin').select('data').eq('user_id', userId).maybeSingle()
  const cur = (ctrl?.data ?? {}) as Record<string, any>
  const payments = (cur.payments ?? []) as { id: string }[]
  if (payments.some((p) => p.id === payId)) return // já registrado
  const today = new Date().toISOString().slice(0, 10)
  const base = cur.paidUntil && cur.paidUntil > today ? cur.paidUntil : today
  const next = { ...cur, cycle, method, paidUntil: addMonths(base, MONTHS[cycle]), payments: [...payments, { id: payId, date: today, amount, method, note: 'Asaas' }], ...(subscription ? { asaasSubscription: subscription } : {}) }
  await db.from('subscriber_admin').upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() })
  await db.from('subscriptions').update({ status: 'ativa', plan, requested_plan: null, requested_at: null, canceled_at: null }).eq('user_id', userId)
  await db.from('support_messages').insert({
    client_id: userId,
    from_owner: true,
    body: `pagamento confirmado! sua assinatura do plano ${NAMES[plan]} (${cycle}) está ativa até ${next.paidUntil.split('-').reverse().join('/')}. obrigada pela confiança.`,
  })
}

/** De quem é o pagamento: pela referência, pelo link de pagamento ou pela assinatura (meses seguintes). */
async function refOf(p: Record<string, any>) {
  if (String(p.externalReference ?? '').includes('|')) return String(p.externalReference)
  if (p.paymentLink) {
    const { data } = await db.from('subscriber_admin').select('data').not(`data->asaasLinks->>${p.paymentLink}`, 'is', null).limit(1).maybeSingle()
    const ref = data?.data?.asaasLinks?.[p.paymentLink]
    if (ref) return String(ref)
  }
  if (p.subscription) {
    const s = await asaas(`/subscriptions/${p.subscription}`).catch(() => ({}) as Record<string, any>)
    if (String(s.externalReference ?? '').includes('|')) return String(s.externalReference)
    const { data } = await db.from('subscriber_admin').select('user_id, data').eq('data->>asaasSubscription', p.subscription).limit(1).maybeSingle()
    const c = data?.data as Record<string, any> | undefined
    if (data && c?.cycle) return `${data.user_id}|${(await db.from('subscriptions').select('plan').eq('user_id', data.user_id).maybeSingle()).data?.plan}|${c.cycle}|cartao`
  }
  return ''
}

async function webhook(req: Request) {
  // só aceita aviso com o token combinado; e mesmo assim tudo é conferido direto no Asaas (um aviso falso não libera nada)
  if (!HOOK_TOKEN || req.headers.get('asaas-access-token') !== HOOK_TOKEN) return json({ erro: 'não autorizado' }, 401)
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const id = String(body.payment?.id ?? '')
  if (!id || !/^PAYMENT_(CONFIRMED|RECEIVED)$/.test(String(body.event ?? ''))) return json({ ok: true })
  const p = await asaas(`/payments/${id}`)
  if (!['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(String(p.status))) return json({ ok: true })
  const ref = await refOf(p)
  if (!ref) return json({ ok: true })
  const method = p.billingType === 'CREDIT_CARD' ? 'cartao' : 'pix'
  if (p.installment) {
    // parcelado: o Asaas avisa cada parcela; conta uma vez só, pelo valor total
    const inst = await asaas(`/installments/${p.installment}`).catch(() => ({}) as Record<string, any>)
    const total = Number(inst.value ?? 0) || Number(inst.paymentValue ?? p.value) * Number(inst.installmentCount ?? 1)
    await approve(ref, `asaas-parc-${p.installment}`, total, method)
  } else await approve(ref, `asaas-${p.id}`, Number(p.value), method, p.subscription ? String(p.subscription) : undefined)
  return json({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!TOKEN) return json({ erro: 'Falta o segredo ASAAS_API_KEY no Supabase.' }, 500)
  const url = new URL(req.url)
  try {
    if (url.searchParams.get('acao') === 'webhook' || req.headers.has('asaas-access-token')) return await webhook(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, any>
    if (body.acao === 'criar') return await create(req, body)
    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : String(e) }, 500)
  }
})
