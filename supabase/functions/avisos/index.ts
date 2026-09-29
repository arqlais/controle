// Avisos por e-mail do traço (roda no Supabase, nunca no site).
// Cole este arquivo em: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "avisos".
// Segredos (Edge Functions → Secrets): BREVO_API_KEY e CRON_SECRET. Opcionais: SENDER_EMAIL, SENDER_NAME, SITE_URL, REPLY_TO.
//
// Tipos de aviso:
//   boas-vindas  → quem acabou de entrar pela primeira vez (o próprio site pede, uma vez só)
//   ativada      → a dona ativou a assinatura no painel
//   novidade     → a dona manda uma novidade para todos (painel → novidades por e-mail)
//   diario       → todo dia (agendado): teste acabando em 3 dias, teste acabou, Pix vencendo em 3 dias
// Cada aviso vai no máximo uma vez para cada pessoa (tabela email_log).

import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (k: string, d = '') => Deno.env.get(k) ?? d
const SITE = env('SITE_URL', 'https://arqlais.github.io/controle/')
const SENDER = { email: env('SENDER_EMAIL', 'nao-responda@lais3d.com.br'), name: env('SENDER_NAME', 'traço') }
// quem responder o e-mail fala direto com a dona
const REPLY_TO = env('REPLY_TO', 'arq.laisav@gmail.com')
const PRICES: Record<string, { name: string; price: number }> = {
  essencial: { name: 'Essencial', price: 39.9 },
  completo: { name: 'Completo', price: 59.9 },
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const first = (name: string) => (name || '').trim().split(' ')[0]

/** Mesmo visual dos e-mails de cadastro e senha. */
function layout(o: { eyebrow: string; title: string; text: string; button?: string; url?: string; small?: string }) {
  const btn = o.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#3e4b57;"><a href="${o.url ?? SITE}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(o.button)}</a></td></tr></table>`
    : ''
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f3eae6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3eae6;padding:32px 12px;font-family:Poppins,Helvetica,Arial,sans-serif;color:#3e4b57;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 8px 18px;"><img src="${SITE}icon-192.png" width="40" height="40" alt="" style="vertical-align:middle;border-radius:10px;"><span style="font-size:22px;font-weight:600;vertical-align:middle;margin-left:10px;">traço</span></td></tr>
<tr><td style="background:#ffffff;border-radius:22px;padding:36px 32px;">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a88a80;">${esc(o.eyebrow)}</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;font-weight:700;color:#3e4b57;">${esc(o.title)}</h1>
<div style="margin:0 0 26px;font-size:15px;line-height:1.6;color:#5b6670;">${o.text}</div>
${btn}
${o.small ? `<p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#8b939a;">${o.small}</p>` : ''}
</td></tr>
<tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#a88a80;text-align:center;">traço · gestão leve para freelancers<br><span style="color:#8b939a;">Dúvidas? Fale com a gente pelo chat dentro do traço.</span></td></tr>
</table></td></tr></table></body></html>`
}

type Sub = { user_id: string; email: string; name: string; plan: string; status: string; trial_ends: string; blocked: boolean }
type Mail = { subject: string; html: string }

const MAILS = {
  'boas-vindas': (s: Sub): Mail => ({
    subject: 'Boas-vindas ao traço ✨',
    html: layout({
      eyebrow: 'boas-vindas',
      title: `Que bom ter você aqui${first(s.name) ? `, ${esc(first(s.name))}` : ''}!`,
      text: `<p style="margin:0 0 12px;">Seu teste grátis do plano ${PRICES[s.plan]?.name ?? ''} já começou e vai até <b>${br(s.trial_ends)}</b>.</p><p style="margin:0;">Para começar com o pé direito: coloque seus dados e sua tabela de preços em <b>configurações</b>, cadastre um cliente e faça o primeiro orçamento. O passo a passo dentro do sistema te guia.</p>`,
      button: 'abrir o traço',
      small: 'Ficou com dúvida? Fale com a gente pelo balão de conversa no canto da tela.',
    }),
  }),
  'teste-acabando': (s: Sub): Mail => ({
    subject: 'Seu teste do traço acaba em 3 dias',
    html: layout({
      eyebrow: 'teste grátis',
      title: 'Faltam 3 dias do seu teste',
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Seu teste grátis vai até <b>${br(s.trial_ends)}</b>.</p><p style="margin:0;">Para continuar com tudo o que você já cadastrou, escolha seu plano em <b>minha assinatura</b>. Pix ou cartão, sem fidelidade.</p>`,
      button: 'escolher meu plano',
      url: `${SITE}#/assinatura`,
    }),
  }),
  'teste-acabou': (s: Sub): Mail => ({
    subject: 'Seu teste do traço terminou',
    html: layout({
      eyebrow: 'teste grátis',
      title: 'Seu teste terminou, seus dados continuam aqui',
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Os dias grátis acabaram, mas nada foi apagado: clientes, orçamentos e o financeiro estão guardados.</p><p style="margin:0;">Para voltar a usar, é só escolher um plano.</p>`,
      button: 'escolher meu plano',
      url: `${SITE}#/assinatura`,
    }),
  }),
  ativada: (s: Sub): Mail => ({
    subject: 'Sua assinatura do traço está ativa 🎉',
    html: layout({
      eyebrow: 'assinatura',
      title: 'Pagamento confirmado!',
      text: `<p style="margin:0;">Obrigada${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Sua assinatura do plano <b>${PRICES[s.plan]?.name ?? ''}</b> está ativa. Pode seguir usando tudo normalmente.</p>`,
      button: 'abrir o traço',
    }),
  }),
  'vence-em-breve': (s: Sub, until: string): Mail => ({
    subject: 'Sua assinatura do traço vence em 3 dias',
    html: layout({
      eyebrow: 'assinatura',
      title: `Vence em ${br(until)}`,
      text: `<p style="margin:0;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! A mensalidade do plano <b>${PRICES[s.plan]?.name ?? ''}</b> (${money(PRICES[s.plan]?.price ?? 0)}) vence em <b>${br(until)}</b>. Vamos te mandar o Pix pelo chat do traço.</p>`,
      button: 'abrir o traço',
    }),
  }),
  novidade: (_s: Sub, title: string, text: string): Mail => ({
    subject: `Novidade no traço: ${title}`,
    html: layout({
      eyebrow: 'novidades',
      title,
      text: text
        .split(/\n\s*\n/)
        .map((p) => `<p style="margin:0 0 12px;">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
        .join(''),
      button: 'ver no traço',
      small: 'Dentro do sistema, o botão “me mostra” leva direto até a novidade.',
    }),
  }),
}

async function send(to: Sub, mail: Mail) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env('BREVO_API_KEY'), 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: SENDER, replyTo: { email: REPLY_TO, name: SENDER.name }, to: [{ email: to.email, name: to.name || undefined }], subject: mail.subject, htmlContent: mail.html }),
  })
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  // nomes e preços dos planos como estão no painel (planos)
  const cfg = (await db.from('platform_settings').select('data').eq('id', 1).maybeSingle()).data?.data as { plans?: Record<string, { name?: string; price?: number }> } | undefined
  for (const [id, p] of Object.entries(cfg?.plans ?? {})) if (PRICES[id]) PRICES[id] = { name: p.name || PRICES[id].name, price: p.price || PRICES[id].price }
  const body = await req.json().catch(() => ({}))
  const tipo = String(body.tipo ?? '')

  // quem está pedindo: o agendamento (senha própria) ou uma pessoa logada
  const cron = !!env('CRON_SECRET') && req.headers.get('x-cron-secret') === env('CRON_SECRET')
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: who } = token ? await db.auth.getUser(token) : { data: { user: null } }
  const uid = who?.user?.id ?? null
  const isOwner = uid ? !!(await db.from('admins').select('user_id').eq('user_id', uid).maybeSingle()).data : false

  // manda uma vez só: grava antes de enviar (se já existe, não manda de novo)
  const once = async (s: Sub, kind: string, ref: string, mail: Mail) => {
    const { error } = await db.from('email_log').insert({ user_id: s.user_id, kind, ref })
    if (error) return false // já enviado
    try {
      await send(s, mail)
      return true
    } catch (e) {
      await db.from('email_log').delete().match({ user_id: s.user_id, kind, ref }) // falhou: tenta de novo na próxima
      console.error(e)
      return false
    }
  }
  const subOf = async (id: string) => (await db.from('subscriptions').select('*').eq('user_id', id).maybeSingle()).data as Sub | null

  if (tipo === 'boas-vindas') {
    if (!uid) return json({ erro: 'entre na conta' }, 401)
    const s = await subOf(uid)
    if (!s?.email) return json({ ok: false })
    return json({ ok: await once(s, 'boas-vindas', '1', MAILS['boas-vindas'](s)) })
  }

  if (tipo === 'ativada') {
    if (!isOwner) return json({ erro: 'só a dona' }, 403)
    const s = await subOf(String(body.userId ?? ''))
    if (!s?.email) return json({ ok: false })
    return json({ ok: await once(s, 'ativada', new Date().toISOString().slice(0, 10), MAILS.ativada(s)) })
  }

  if (tipo === 'novidade') {
    if (!isOwner) return json({ erro: 'só a dona' }, 403)
    const title = String(body.title ?? '').slice(0, 120)
    const text = String(body.text ?? '').slice(0, 3000)
    if (!title || !text) return json({ erro: 'escreva o título e o texto' }, 400)
    const { data } = await db.from('subscriptions').select('*').neq('status', 'cancelada').eq('blocked', false)
    let n = 0
    for (const s of (data ?? []) as Sub[]) if (s.email && (await once(s, 'novidade', title, MAILS.novidade(s, title, text)))) n++
    return json({ ok: true, enviados: n })
  }

  if (tipo === 'diario') {
    if (!cron) return json({ erro: 'sem permissão' }, 403)
    const day = (iso: string) => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(new Date().toISOString().slice(0, 10))) / 86_400_000)
    const { data } = await db.from('subscriptions').select('*').eq('blocked', false)
    const { data: ctrl } = await db.from('subscriber_admin').select('user_id, data')
    const byId = new Map((ctrl ?? []).map((r) => [String(r.user_id), r.data as { paidUntil?: string; method?: string }]))
    let n = 0
    for (const s of (data ?? []) as Sub[]) {
      if (!s.email) continue
      if (s.status === 'trial') {
        const d = day(s.trial_ends)
        if (d === 3 && (await once(s, 'teste-acabando', s.trial_ends.slice(0, 10), MAILS['teste-acabando'](s)))) n++
        if (d <= 0 && d >= -2 && (await once(s, 'teste-acabou', s.trial_ends.slice(0, 10), MAILS['teste-acabou'](s)))) n++
      } else if (s.status === 'ativa' || s.status === 'atrasada') {
        const c = byId.get(s.user_id)
        if (c?.paidUntil && c.method !== 'cartao' && day(c.paidUntil) === 3 && (await once(s, 'vence-em-breve', c.paidUntil, MAILS['vence-em-breve'](s, c.paidUntil)))) n++
      }
    }
    return json({ ok: true, enviados: n })
  }

  return json({ erro: 'tipo desconhecido' }, 400)
})
