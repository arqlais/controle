// publicado automaticamente pelo GitHub (workflow supabase.yml)
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
//   ape-criar / ape-pedido → loja do planê.apê (sem login): cria o pedido com o preço calculado aqui e, depois de pago,
//             devolve links temporários para baixar os arquivos (pasta privada ape-arquivos).
//   ape-ler → lê o orçamento anexado por um morador e devolve fornecedor e serviço (Gemini: segredo GEMINI_API_KEY
//             ou a chave que a dona colocou no planê).
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
  // compra da loja do planê.apê
  const ext = String(p.externalReference ?? '')
  if (ext.startsWith('ape|')) {
    await apeMarcarPago(ext.slice(4), p)
    return json({ ok: true })
  }
  if (p.paymentLink) {
    const { data: ap } = await db.from('ape_pedidos').select('id').eq('asaas_link', p.paymentLink).maybeSingle()
    if (ap) {
      await apeMarcarPago(ap.id, p)
      return json({ ok: true })
    }
  }
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


/* ===================== planê.apê: loja com carrinho ===================== */
// Preços e regras vêm da loja salva no painel (tabela ape_ajustes); sem loja salva, valem os de baixo
// (mesmos de src/ape/model.ts). O valor nunca vem do navegador.
const APE_SITE = `${SITE.replace(/\/$/, '')}/ape/`
const APE_DEFAULT: Record<string, { nome: string; preco: string; cat: string; combo?: string[] }> = {
  checklist: { nome: 'Checklist de vistoria MRV', preco: '19,90', cat: 'arquivos' },
  planilha: { nome: 'Planilha de obra e compras', preco: '24,90', cat: 'arquivos' },
  guia: { nome: 'Guia de orçamentos', preco: '14,90', cat: 'arquivos' },
  mudanca: { nome: 'Lista da mudança e enxoval', preco: '12,90', cat: 'arquivos' },
  medidas: { nome: 'Guia de medidas do apê', preco: '16,90', cat: 'arquivos' },
  enxoval: { nome: 'Planilha do enxoval', preco: '14,90', cat: 'arquivos' },
  entregas: { nome: 'Checklist de entregas da obra', preco: '12,90', cat: 'arquivos' },
  planner: { nome: 'Planner de decoração', preco: '17,90', cat: 'arquivos' },
  'kit-chaves': { nome: 'Kit chaves na mão', preco: '34,90', cat: 'combos', combo: ['checklist', 'entregas', 'mudanca'] },
  'kit-obra': { nome: 'Kit obra sem susto', preco: '39,90', cat: 'combos', combo: ['planilha', 'guia', 'medidas'] },
  'kit-completo': { nome: 'Kit apê novo completo', preco: '69,90', cat: 'combos', combo: ['checklist', 'planilha', 'guia', 'mudanca', 'medidas', 'enxoval', 'entregas', 'planner'] },
}
const APE_TIERS: [number, number][] = [[2, 10], [3, 15], [4, 20], [6, 25]]
const reais = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
async function apeLoja() {
  const { data } = await db.from('ape_ajustes').select('data').eq('id', 1).maybeSingle()
  const a = (data?.data ?? {}) as Record<string, any>
  const map: Record<string, { nome: string; preco: number; cat: string; combo: string[] }> = {}
  const saved = Number(a.lojaV ?? 0) >= 3 && Array.isArray(a.produtos) ? (a.produtos as Record<string, any>[]) : null
  if (saved) for (const p of saved) if (p.ativo !== false && (p.cat === 'arquivos' || p.cat === 'combos')) map[p.id] = { nome: String(p.nome), preco: reais(p.preco), cat: p.cat, combo: Array.isArray(p.combo) ? p.combo : [] }
  if (!saved) for (const [id, p] of Object.entries(APE_DEFAULT)) map[id] = { nome: p.nome, preco: reais(p.preco), cat: p.cat, combo: p.combo ?? [] }
  const tiers = Array.isArray(a.descontos) && a.descontos.length ? (a.descontos as [number, number][]) : APE_TIERS
  return { map, tiers }
}
/** Mesma conta do carrinho do site: combo fixo; arquivos avulsos ganham desconto pela quantidade. */
function apeConta(ids: string[], map: Awaited<ReturnType<typeof apeLoja>>['map'], tiers: [number, number][]) {
  let uniq = [...new Set(ids)].filter((id) => map[id])
  const noCombo = new Set(uniq.flatMap((id) => (map[id].cat === 'combos' ? map[id].combo : [])))
  uniq = uniq.filter((id) => !(map[id].cat === 'arquivos' && noCombo.has(id)))
  const itens = uniq.map((id) => ({ id, nome: map[id].nome, preco: map[id].preco, cat: map[id].cat }))
  const avulsos = itens.filter((i) => i.cat === 'arquivos')
  const pct = tiers.reduce((b, [k, v]) => (avulsos.length >= k ? Math.max(b, v) : b), 0)
  const subtotal = cents(itens.reduce((t, i) => t + i.preco, 0))
  const desconto = cents(avulsos.reduce((t, i) => t + i.preco, 0) * pct / 100)
  return { itens, subtotal, desconto, total: cents(subtotal - desconto), pct }
}
/** Parcelas sem juros no cartão (mesma regra do site): a partir de R$ 30 em 2x, de R$ 60 em 3x. */
const apeParcelas = (total: number) => (total >= 60 ? 3 : total >= 30 ? 2 : 1)
async function apeCriar(body: Record<string, any>) {
  const nome = String(body.nome ?? '').trim().slice(0, 120)
  const tel = String(body.tel ?? '').replace(/\D/g, '').slice(0, 13)
  const email = String(body.email ?? '').trim().slice(0, 160)
  if (nome.length < 3 || tel.length < 10) return json({ erro: 'Coloque nome e WhatsApp.' }, 400)
  if (body.aceite !== true) return json({ erro: 'Aceite os termos da compra.' }, 400)
  const { map, tiers } = await apeLoja()
  const c = apeConta(Array.isArray(body.itens) ? body.itens.map(String).slice(0, 30) : [], map, tiers)
  if (!c.itens.length) return json({ erro: 'O carrinho está vazio.' }, 400)
  if (c.total < 5) return json({ erro: 'Valor mínimo de R$ 5,00.' }, 400)
  const morador = /^[0-9a-f-]{36}$/i.test(String(body.morador ?? '')) ? String(body.morador) : null
  const { data: ped, error } = await db.from('ape_pedidos').insert({ morador, nome, tel, email, itens: c.itens, subtotal: c.subtotal, desconto: c.desconto, total: c.total, forma: body.forma === 'cartao' ? 'cartao' : 'pix' }).select('id, token').single()
  if (error || !ped) throw new Error(error?.message ?? 'não deu para criar o pedido')
  const forma = body.forma === 'cartao' ? 'cartao' : 'pix'
  const parcelas = apeParcelas(c.total)
  const link: Record<string, any> = {
    name: 'planê.apê · seu pedido',
    description: (c.itens.map((i) => i.nome).join(' + ') + (forma === 'cartao' && parcelas > 1 ? ` · em até ${parcelas}x sem juros` : '')).slice(0, 250),
    value: c.total,
    billingType: forma === 'cartao' ? 'CREDIT_CARD' : 'PIX',
    chargeType: forma === 'cartao' && parcelas > 1 ? 'INSTALLMENT' : 'DETACHED',
    ...(forma === 'cartao' && parcelas > 1 ? { maxInstallmentCount: parcelas } : {}),
    dueDateLimitDays: 2,
    endDate: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    externalReference: `ape|${ped.id}`,
    notificationEnabled: false,
    callback: { successUrl: `${APE_SITE}#pedido:${ped.token}`, autoRedirect: true },
  }
  let made: Record<string, any>
  try {
    made = await asaas('/paymentLinks', { method: 'POST', body: JSON.stringify(link) })
  } catch (e) {
    if (!/callback|successUrl|dom[ií]nio|domain/i.test(String(e))) throw e
    delete link.callback
    made = await asaas('/paymentLinks', { method: 'POST', body: JSON.stringify(link) })
  }
  await db.from('ape_pedidos').update({ asaas_link: made.id }).eq('id', ped.id)
  return json({ url: made.url, token: ped.token, total: c.total })
}
const PAGO = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']
async function apeMarcarPago(id: string, p: Record<string, any>) {
  await db.from('ape_pedidos').update({ status: 'pago', pago_em: new Date().toISOString(), asaas_pagamento: String(p.id ?? ''), forma: p.billingType === 'CREDIT_CARD' ? 'cartao' : 'pix' }).eq('id', id).neq('status', 'pago')
}
async function apePedido(body: Record<string, any>) {
  const token = String(body.token ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ erro: 'Pedido não encontrado.' }, 404)
  const { data: ped } = await db.from('ape_pedidos').select('*').eq('token', token).maybeSingle()
  if (!ped) return json({ erro: 'Pedido não encontrado.' }, 404)
  // o aviso do Asaas ainda não chegou? confere direto lá
  if (ped.status === 'pendente' && ped.asaas_link) {
    const r = await asaas(`/payments?paymentLink=${ped.asaas_link}&limit=10`).catch(() => ({}) as Record<string, any>)
    const ok = ((r.data ?? []) as Record<string, any>[]).find((x) => PAGO.includes(String(x.status)))
    if (ok) {
      await apeMarcarPago(ped.id, ok)
      ped.status = 'pago'
    }
  }
  const itens = (ped.itens ?? []) as { id: string; nome: string; preco: number }[]
  if (ped.status !== 'pago') return json({ status: ped.status, itens, total: ped.total })
  const { map } = await apeLoja()
  const ids = [...new Set(itens.flatMap((i) => (map[i.id]?.cat === 'combos' ? map[i.id].combo : [i.id])))]
  const arquivos: { produto: string; nome: string; url: string }[] = []
  for (const id of ids) {
    const st = db.storage.from('ape-arquivos')
    const { data: files } = await st.list(id, { limit: 20 })
    for (const f of files ?? []) {
      if (!f.name || f.name.startsWith('.')) continue
      const { data: u } = await st.createSignedUrl(`${id}/${f.name}`, 60 * 60 * 24, { download: f.name })
      if (u?.signedUrl) arquivos.push({ produto: map[id]?.nome ?? id, nome: f.name, url: u.signedUrl })
    }
  }
  await db.from('ape_pedidos').update({ baixados: Number(ped.baixados ?? 0) + 1 }).eq('id', ped.id)
  return json({ status: 'pago', itens, total: ped.total, nome: ped.nome, arquivos })
}


/* ===== planê.apê: leitura automática do orçamento anexado (fornecedor e serviço) ===== */
const APE_NICHOS = 'piso-vinilico, piso-ceramico, piso-laminado, marcenaria, marmoraria, box, gesso, eletrica, ar, pintura, cortinas, telas, vidros, moveis, eletros, mao-de-obra, outros'
const b64 = (buf: ArrayBuffer) => {
  const u = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
/** Chave do Gemini: o segredo GEMINI_API_KEY ou a chave que a dona colocou no planê (configurações → assistente). */
async function geminiKey() {
  const k = env('GEMINI_API_KEY')
  if (k) return k
  const { data: adm } = await db.from('admins').select('user_id').limit(1).maybeSingle()
  if (!adm) return ''
  const { data: ws } = await db.from('workspace').select('data').eq('user_id', adm.user_id).maybeSingle()
  return String((ws?.data as Record<string, any> | undefined)?.settings?.aiKey ?? '')
}
async function apeLer(body: Record<string, any>) {
  const morador = String(body.morador ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(morador)) return json({ erro: 'faça o cadastro' }, 400)
  const { data: m } = await db.from('ape_moradores').select('id').eq('id', morador).maybeSingle()
  if (!m) return json({ erro: 'faça o cadastro' }, 400)
  const desde = new Date(Date.now() - 864e5).toISOString()
  const { count } = await db.from('ape_leituras').select('id', { count: 'exact', head: true }).eq('morador', morador).gte('criado', desde)
  if ((count ?? 0) >= 25) return json({ erro: 'limite de leituras por hoje' }, 429)
  const key = await geminiKey()
  if (!key) return json({ erro: 'leitura automática desligada' }, 503)
  const paths = (Array.isArray(body.arquivos) ? body.arquivos : []).map(String).filter((x: string) => x.startsWith('envios/')).slice(0, 4)
  const parts: Record<string, unknown>[] = []
  let total = 0
  for (const path of paths) {
    const { data: f } = await db.storage.from('ape-envios').download(path)
    if (!f || total + f.size > 12 * 1024 * 1024) continue
    total += f.size
    parts.push({ inlineData: { mimeType: f.type || (path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'), data: b64(await f.arrayBuffer()) } })
  }
  const texto = String(body.texto ?? '').slice(0, 8000)
  if (!parts.length && !texto.trim()) return json({ erro: 'nada para ler' }, 400)
  await db.from('ape_leituras').insert({ morador })
  const prompt = `Este é um orçamento de reforma ou móveis para um apê. Responda só com JSON: {"fornecedor": "nome da empresa ou profissional que fez o orçamento (não o cliente)", "nicho": um destes ids: ${APE_NICHOS}, "servico": "o que está sendo orçado, em até 8 palavras"}. Se não souber um campo, deixe "".${texto ? `\nTexto enviado:\n"""${texto}"""` : ''}`
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [...parts, { text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } }),
  })
  const out = (await r.json().catch(() => ({}))) as Record<string, any>
  if (!r.ok) return json({ erro: 'não deu para ler agora' }, 502)
  const txt = String(out.candidates?.[0]?.content?.parts?.map((x: Record<string, any>) => x.text ?? '').join('') ?? '')
  let v: Record<string, any> = {}
  try {
    v = JSON.parse(txt.replace(/```(json)?/g, '').trim())
  } catch {
    /* resposta fora do formato: devolve vazio */
  }
  const nicho = APE_NICHOS.split(', ').includes(String(v.nicho)) ? String(v.nicho) : ''
  return json({ fornecedor: String(v.fornecedor ?? '').slice(0, 120), nicho, servico: String(v.servico ?? '').slice(0, 120) })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  try {
    if (!TOKEN) {
      // a leitura automática não depende do Asaas
      const b = (await req.clone().json().catch(() => ({}))) as Record<string, any>
      if (b.acao === 'ape-ler') return await apeLer(b)
      return json({ erro: 'Falta o segredo ASAAS_API_KEY no Supabase.' }, 500)
    }
    if (url.searchParams.get('acao') === 'webhook' || req.headers.has('asaas-access-token')) return await webhook(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, any>
    if (body.acao === 'criar') return await create(req, body)
    if (body.acao === 'ape-criar') return await apeCriar(body)
    if (body.acao === 'ape-pedido') return await apePedido(body)
    if (body.acao === 'ape-ler') return await apeLer(body)
    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : String(e) }, 500)
  }
})
