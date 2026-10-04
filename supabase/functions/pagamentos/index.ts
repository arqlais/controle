// Pagamentos do planê pelo Mercado Pago (roda no Supabase, nunca no site).
// Cole em: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "pagamentos".
// IMPORTANTE: nas configurações da função, DESLIGUE "Verify JWT" (o Mercado Pago avisa os pagamentos sem login;
// quem cria a cobrança é conferido aqui dentro pelo login da pessoa).
// Segredos (Edge Functions → Secrets): MP_ACCESS_TOKEN (Mercado Pago → Suas integrações → Credenciais de produção → Access Token).
// Opcional: SITE_URL (padrão https://useplane.com.br/).
//
// Ações:
//   criar   → a pessoa logada escolhe plano, ciclo e forma; devolve o link seguro do Mercado Pago
//             · mensal no cartão = assinatura recorrente (cobra todo mês sozinho)
//             · o resto = Checkout Pro (Pix, ou cartão em até 6x/12x sem juros com a taxa já embutida no preço)
//   webhook → o Mercado Pago avisa cada pagamento; se aprovado, a conta é liberada sozinha,
//             o pagamento entra no controle da dona (assinantes → cobrança) e a pessoa recebe uma mensagem no chat.

import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (k: string, d = '') => Deno.env.get(k) ?? d
const SITE = env('SITE_URL', 'https://useplane.com.br/')
const TOKEN = env('MP_ACCESS_TOKEN')
const SELF = `${env('SUPABASE_URL')}/functions/v1/pagamentos`
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

async function mp(path: string, init?: RequestInit) {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${JSON.stringify(body).slice(0, 300)}`)
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
  const title = `planê ${NAMES[plan]} · ${cycle}`
  const back = `${SITE}#/assinatura`
  // mensal no cartão: assinatura que cobra todo mês sozinha
  if (cycle === 'mensal' && method === 'cartao') {
    const pre = await mp('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: title,
        external_reference: ref,
        payer_email: u.user.email,
        back_url: back,
        notification_url: `${SELF}?acao=webhook`,
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: full, currency_id: 'BRL' },
        status: 'pending',
      }),
    })
    return json({ url: pre.init_point })
  }
  const off = cycle === 'mensal' ? await firstDiscount(u.user.id, sub) : 0
  const amount = cents(full * (1 - off / 100))
  const pref = await mp('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ id: `${plan}-${cycle}`, title, quantity: 1, unit_price: amount, currency_id: 'BRL' }],
      external_reference: ref,
      payer: { email: u.user.email },
      back_urls: { success: `${back}?pago=1`, pending: `${back}?pago=pendente`, failure: back },
      auto_return: 'approved',
      notification_url: `${SELF}?acao=webhook`,
      statement_descriptor: 'PLANE',
      payment_methods: {
        installments: method === 'cartao' ? INSTALLMENTS[cycle] : 1,
        excluded_payment_types: method === 'pix' ? [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'ticket' }, { id: 'atm' }] : [{ id: 'ticket' }, { id: 'atm' }, { id: 'bank_transfer' }],
      },
    }),
  })
  return json({ url: pref.init_point, desconto: off })
}

const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}

/** Pagamento aprovado: libera a conta, registra no controle da dona e avisa no chat (uma vez por pagamento). */
async function approve(ref: string, payId: string, amount: number, method: 'pix' | 'cartao') {
  const [userId, plan, cycle] = ref.split('|') as [string, Plan, Cycle]
  if (!userId || !NAMES[plan] || !MONTHS[cycle]) return
  const { data: ctrl } = await db.from('subscriber_admin').select('data').eq('user_id', userId).maybeSingle()
  const cur = (ctrl?.data ?? {}) as Record<string, any>
  const payments = (cur.payments ?? []) as { id: string }[]
  if (payments.some((p) => p.id === `mp-${payId}`)) return // já registrado
  const today = new Date().toISOString().slice(0, 10)
  const base = cur.paidUntil && cur.paidUntil > today ? cur.paidUntil : today
  const next = { ...cur, cycle, method, paidUntil: addMonths(base, MONTHS[cycle]), payments: [...payments, { id: `mp-${payId}`, date: today, amount, method, note: 'Mercado Pago' }] }
  await db.from('subscriber_admin').upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() })
  await db.from('subscriptions').update({ status: 'ativa', plan, requested_plan: null, requested_at: null, canceled_at: null }).eq('user_id', userId)
  await db.from('support_messages').insert({
    client_id: userId,
    from_owner: true,
    body: `pagamento confirmado! sua assinatura do plano ${NAMES[plan]} (${cycle}) está ativa até ${next.paidUntil.split('-').reverse().join('/')}. obrigada pela confiança.`,
  })
}

async function webhook(req: Request, url: URL) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const type = String(body.type ?? body.topic ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '')
  const id = String(body.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '')
  if (!id) return json({ ok: true })
  // tudo é conferido direto no Mercado Pago (um aviso falso não libera nada)
  if (type === 'payment') {
    const p = await mp(`/v1/payments/${id}`)
    if (p.status === 'approved' && p.external_reference) await approve(String(p.external_reference), String(p.id), Number(p.transaction_amount), p.payment_type_id === 'credit_card' ? 'cartao' : 'pix')
  } else if (type === 'subscription_authorized_payment') {
    const a = await mp(`/authorized_payments/${id}`)
    if (a.payment?.status === 'approved' && a.preapproval_id) {
      const pre = await mp(`/preapproval/${a.preapproval_id}`)
      if (pre.external_reference) await approve(String(pre.external_reference), String(a.payment.id ?? id), Number(a.transaction_amount), 'cartao')
    }
  }
  return json({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!TOKEN) return json({ erro: 'Falta o segredo MP_ACCESS_TOKEN no Supabase.' }, 500)
  const url = new URL(req.url)
  try {
    if (url.searchParams.get('acao') === 'webhook' || req.headers.get('user-agent')?.includes('MercadoPago')) return await webhook(req, url)
    const body = (await req.json().catch(() => ({}))) as Record<string, any>
    if (body.acao === 'criar') return await create(req, body)
    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : String(e) }, 500)
  }
})
