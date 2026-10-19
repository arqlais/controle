// Avisos por e-mail do planê (roda no Supabase, nunca no site).
// Cole este arquivo em: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "avisos".
// Segredos (Edge Functions → Secrets): BREVO_API_KEY e CRON_SECRET. Opcionais: SENDER_EMAIL (remetente validado no Brevo), SITE_URL, REPLY_TO.
//
// Tipos de aviso:
//   boas-vindas  → quem acabou de entrar pela primeira vez (o próprio site pede, uma vez só)
//   ativada      → a dona ativou a assinatura no painel
//   novidade     → a dona manda uma novidade para todos (painel → novidades por e-mail)
//   diario       → todo dia (agendado): teste acabando em 3 dias, teste acabou, Pix vencendo em 3 dias
//   mensagem     → alguém escreveu no chat: avisa a dona (no máximo 1 e-mail a cada 30 min por pessoa)
//   sugestao     → alguém mandou uma sugestão: avisa a dona
//   resposta     → a dona respondeu no chat: avisa a pessoa (se ela não estiver usando o sistema agora)
//   sugestao-atualizada → a dona mudou a situação ou respondeu uma sugestão: avisa quem sugeriu
//   briefing     → o cliente final respondeu o briefing (página sem login): avisa quem mandou
//   cliente      → o cliente final assinou um contrato ou mandou um recado pelo painel (sem login):
//                  guarda na tabela client_events (o sistema lê e mostra na central de avisos),
//                  avisa o profissional por e-mail e, se o cliente deixou e-mail, manda uma cópia para ele
// Cada aviso vai no máximo uma vez para cada pessoa (tabela email_log).

import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (k: string, d = '') => Deno.env.get(k) ?? d
const SITE = env('SITE_URL', 'https://useplane.com.br/')
// e-mails dos segredos: limpa espaço, aspas e quebra de linha; se não for um e-mail válido, usa o padrão
const isMail = (v: string) => /^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+$/.test(v)
const mailEnv = (k: string, d: string) => {
  const v = env(k).trim().replace(/^["'<\s]+|["'>\s;,]+$/g, '').trim().toLowerCase()
  return isMail(v) ? v : d
}
// remetente: sempre "Planê" (o nome antigo que ficou salvo nos segredos é ignorado)
const SENDER = { email: mailEnv('SENDER_EMAIL', 'equipe.plane@gmail.com'), name: 'Planê' }
// quem responder o e-mail fala direto com a dona
const REPLY_TO = mailEnv('REPLY_TO', 'equipe.plane@gmail.com')
// para onde vão os avisos de mensagem e sugestão nova
const OWNER_EMAIL = mailEnv('OWNER_EMAIL', REPLY_TO)
const SUG_LABEL: Record<string, string> = { recebida: 'recebida', analisando: 'em análise', planejada: 'planejada', feita: 'feita ✓', nao_agora: 'não por agora' }
const SUG_CAT: Record<string, string> = { nova: 'função nova', melhoria: 'melhoria', problema: 'algo não funciona', outro: 'outra ideia' }
const PRICES: Record<string, { name: string; price: number }> = {
  essencial: { name: 'Essencial', price: 39.9 },
  completo: { name: 'Completo', price: 59.9 },
  estudio: { name: 'Estúdio', price: 89.9 },
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
/** Texto do chat com **negrito**, _itálico_ e __sublinhado__ em HTML de e-mail. */
const rich = (t: string) =>
  t
    .split('\n')
    .map((l) =>
      esc(l)
        .replace(/__(?=\S)([^\n]*?\S)__/g, '<u>$1</u>')
        .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, '<b>$1</b>')
        .replace(/(^|[^\p{L}\p{N}_])_(?=[^\s_])([^\n_]*?[^\s_])_(?![\p{L}\p{N}_])/gu, '$1<i>$2</i>'),
    )
    .join('<br>')
const quote = (html: string) => `<div style="margin:0 0 4px;padding:14px 16px;border-radius:14px;background:#f7f1ee;color:#3e4b57;">${html}</div>`
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
<tr><td style="padding:0 8px 18px;"><img src="${SITE}icon-192.png" width="40" height="40" alt="" style="vertical-align:middle;border-radius:10px;"><span style="font-size:22px;font-weight:600;vertical-align:middle;margin-left:10px;">Planê</span></td></tr>
<tr><td style="background:#ffffff;border-radius:22px;padding:36px 32px;">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a88a80;">${esc(o.eyebrow)}</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;font-weight:700;color:#3e4b57;">${esc(o.title)}</h1>
<div style="margin:0 0 26px;font-size:15px;line-height:1.6;color:#5b6670;">${o.text}</div>
${btn}
${o.small ? `<p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#8b939a;">${o.small}</p>` : ''}
</td></tr>
<tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#a88a80;text-align:center;">planê · gestão leve para quem vive de projeto<br><span style="color:#8b939a;">Dúvidas? Fale com a gente pelo chat dentro do planê.</span></td></tr>
</table></td></tr></table></body></html>`
}


/** E-mail para a cliente final, com o nome do escritório (não o do planê). */
function studioLayout(o: { studio: string; accent?: string; eyebrow: string; title: string; text: string; button?: string; url?: string }) {
  const accent = /^#[0-9a-f]{3,8}$/i.test(o.accent ?? '') ? o.accent! : '#a88a80'
  const btn = o.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#3e4b57;"><a href="${o.url}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(o.button)}</a></td></tr></table>`
    : ''
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f5f1ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1ee;padding:32px 12px;font-family:Poppins,Helvetica,Arial,sans-serif;color:#3e4b57;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 8px 18px;font-size:20px;font-weight:600;">${esc(o.studio)}</td></tr>
<tr><td style="background:#ffffff;border-radius:22px;padding:34px 30px;">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:${accent};">${esc(o.eyebrow)}</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700;color:#3e4b57;">${esc(o.title)}</h1>
<div style="margin:0 0 26px;font-size:15px;line-height:1.6;color:#5b6670;">${o.text}</div>
${btn}
</td></tr>
<tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#8b939a;text-align:center;">Para responder, é só responder este e-mail.<br><span style="color:${accent};">enviado por ${esc(o.studio)} · planê</span></td></tr>
</table></td></tr></table></body></html>`
}
const b64u = (u: string) => {
  const hex = u.replace(/-/g, '')
  let bin = ''
  for (let i = 0; i < 16; i++) bin += String.fromCharCode(parseInt(hex.slice(i * 2, i * 2 + 2), 16))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const brDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

type Sub = { user_id: string; email: string; name: string; plan: string; status: string; trial_ends: string; blocked: boolean; created_at?: string }
type Mail = { subject: string; html: string }

const MAILS = {
  'boas-vindas': (s: Sub): Mail => ({
    subject: 'Boas-vindas ao planê ✨',
    html: layout({
      eyebrow: 'boas-vindas',
      title: `Que bom ter você aqui${first(s.name) ? `, ${esc(first(s.name))}` : ''}!`,
      text: `<p style="margin:0 0 12px;">Seu teste grátis do plano ${PRICES[s.plan]?.name ?? ''} já começou e vai até <b>${br(s.trial_ends)}</b>.</p><p style="margin:0;">Para começar com o pé direito: faça sua primeira proposta em <b>orçamentos → novo</b>. A tabela de preços já vem pronta para o seu jeito de trabalhar, e o cliente você cadastra ali mesmo. Os primeiros passos, no início, te guiam.</p>`,
      button: 'abrir o planê',
      small: 'Ficou com dúvida? Fale com a gente pelo balão de conversa no canto da tela.',
    }),
  }),
  // sequência do teste grátis: um passo por e-mail, puxando para o que faz a pessoa ficar
  'teste-dia1': (s: Sub, quotes: number): Mail => ({
    subject: quotes ? 'Agora mande a proposta pelo link' : 'Sua primeira proposta em 5 minutos',
    html: layout({
      eyebrow: 'primeiros passos',
      title: quotes ? 'Mande a proposta pelo link' : 'Faça sua primeira proposta',
      text: quotes
        ? `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Você já montou um orçamento. O próximo passo é o que mais impressiona o cliente: no orçamento, toque em <b>link para aprovar</b>.</p><p style="margin:0;">A cliente abre no celular, escolhe a opção e aprova. Você fica sabendo na hora quando ela abrir e quando aprovar.</p>`
        : `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! A sua tabela de preços já veio pronta para o seu jeito de trabalhar. Em <b>orçamentos → novo</b>, escolha os serviços e o cliente: o valor sai sozinho.</p><p style="margin:0;">Em 5 minutos você tem uma proposta bonita, com a sua marca, pronta para mandar.</p>`,
      button: quotes ? 'abrir meus orçamentos' : 'fazer minha proposta',
      url: `${SITE}#/orcamentos${quotes ? '' : '/novo'}`,
    }),
  }),
  'teste-dia3': (s: Sub): Mail => ({
    subject: 'Deixe o planê cobrar por você',
    html: layout({
      eyebrow: 'dica',
      title: 'Lembretes que trabalham sozinhos',
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Em <b>configurações → propostas → lembretes automáticos</b>, ligue os e-mails para a cliente: quando a proposta fica sem resposta e quando a parcela vai vencer, com a sua chave Pix.</p><p style="margin:0;">Sai com o nome do seu estúdio e, se a cliente responder, cai no seu e-mail.</p>`,
      button: 'ligar os lembretes',
      url: `${SITE}#/config`,
    }),
  }),
  'teste-dia7': (s: Sub): Mail => ({
    subject: 'Um link para a bio que traz pedidos de orçamento',
    html: layout({
      eyebrow: 'dica',
      title: 'Sua página com pedido de orçamento',
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! No seu <b>perfil</b>, em “sua página”, você publica uma página simples com o que faz e um botão de pedir orçamento.</p><p style="margin:0;">Coloque o link na bio do Instagram: cada pedido chega no planê com o cliente cadastrado e o rascunho do orçamento pronto.</p>`,
      button: 'montar minha página',
      url: `${SITE}#/perfil`,
    }),
  }),
  'teste-acabando': (s: Sub): Mail => ({
    subject: 'Seu teste do planê acaba em 3 dias',
    html: layout({
      eyebrow: 'teste grátis',
      title: 'Faltam 3 dias do seu teste',
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Seu teste grátis vai até <b>${br(s.trial_ends)}</b>.</p><p style="margin:0;">Para continuar com tudo o que você já cadastrou, escolha seu plano em <b>minha assinatura</b>. Pix ou cartão, sem fidelidade.</p>`,
      button: 'escolher meu plano',
      url: `${SITE}#/assinatura`,
    }),
  }),
  'teste-acabou': (s: Sub): Mail => ({
    subject: 'Seu teste do planê terminou',
    html: layout({
      eyebrow: 'teste grátis',
      title: 'Seu teste terminou, seus dados continuam aqui',
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Os dias grátis acabaram, mas nada foi apagado: clientes, orçamentos e o financeiro estão guardados.</p><p style="margin:0;">Para voltar a usar, é só escolher um plano.</p>`,
      button: 'escolher meu plano',
      url: `${SITE}#/assinatura`,
    }),
  }),
  ativada: (s: Sub): Mail => ({
    subject: 'Sua assinatura do planê está ativa 🎉',
    html: layout({
      eyebrow: 'assinatura',
      title: 'Pagamento confirmado!',
      text: `<p style="margin:0;">Obrigada${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Sua assinatura do plano <b>${PRICES[s.plan]?.name ?? ''}</b> está ativa. Pode seguir usando tudo normalmente.</p>`,
      button: 'abrir o planê',
    }),
  }),
  'vence-em-breve': (s: Sub, until: string): Mail => ({
    subject: 'Sua assinatura do planê vence em 3 dias',
    html: layout({
      eyebrow: 'assinatura',
      title: `Vence em ${br(until)}`,
      text: `<p style="margin:0;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! A mensalidade do plano <b>${PRICES[s.plan]?.name ?? ''}</b> (${money(PRICES[s.plan]?.price ?? 0)}) vence em <b>${br(until)}</b>. Vamos te mandar o Pix pelo chat do planê.</p>`,
      button: 'abrir o planê',
    }),
  }),
  novidade: (_s: Sub, title: string, text: string): Mail => ({
    subject: `Novidade no planê: ${title}`,
    html: layout({
      eyebrow: 'novidades',
      title,
      text: text
        .split(/\n\s*\n/)
        .map((p) => `<p style="margin:0 0 12px;">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
        .join(''),
      button: 'ver no planê',
      small: 'Dentro do sistema, o botão “me mostra” leva direto até a novidade.',
    }),
  }),
}

/** E-mail escrito pela dona no painel (campanha). {nome} vira o primeiro nome de quem recebe. */
const campanha = (s: Sub, o: { subject: string; eyebrow: string; title: string; text: string; button: string; url: string }): Mail => {
  const nome = first(s.name)
  const fill = (t: string) => t.replace(/\{nome\}/g, nome).replace(/,\s*!/g, '!').replace(/\s+([,!?.])/g, '$1')
  return {
    subject: fill(o.subject),
    html: layout({
      eyebrow: o.eyebrow || 'planê',
      title: fill(o.title),
      text: fill(o.text)
        .split(/\n\s*\n/)
        .map((p) => `<p style="margin:0 0 12px;">${rich(p.trim())}</p>`)
        .join(''),
      button: o.button || undefined,
      url: o.url || SITE,
    }),
  }
}

const OWNER_MAILS = {
  mensagem: (s: Sub, text: string): Mail => ({
    subject: `💬 ${s.name || s.email} escreveu no chat do planê`,
    html: layout({
      eyebrow: 'chat',
      title: `Mensagem de ${esc(first(s.name) || s.email)}`,
      text: `<p style="margin:0 0 12px;">${esc(s.name || '')} (${esc(s.email)}) · plano ${PRICES[s.plan]?.name ?? ''}</p>${quote(rich(text.slice(0, 2000)))}`,
      button: 'responder no painel',
      url: `${SITE}#/plataforma`,
      small: 'Se chegarem mais mensagens nos próximos 30 minutos, elas ficam só no painel (sem outro e-mail).',
    }),
  }),
  sugestao: (s: Sub, title: string, text: string): Mail => ({
    subject: `💡 Sugestão nova de ${first(s.name) || s.email}: ${title}`,
    html: layout({
      eyebrow: 'sugestões',
      title: esc(title),
      text: `<p style="margin:0 0 12px;">de ${esc(s.name || '')} (${esc(s.email)})</p>${text.trim() ? quote(rich(text.slice(0, 3000))) : ''}`,
      button: 'ver no painel',
      url: `${SITE}#/plataforma`,
    }),
  }),
}

const CLIENT_MAILS = {
  resposta: (s: Sub, text: string): Mail => ({
    subject: 'Você tem uma resposta no planê 💬',
    html: layout({
      eyebrow: 'chat',
      title: `Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Respondemos sua mensagem`,
      text: quote(rich(text.slice(0, 2000))),
      button: 'abrir a conversa',
      small: 'Para responder, use o balão de conversa no canto da tela do planê.',
    }),
  }),
  sugestao: (s: Sub, title: string, status: string, reply: string): Mail => ({
    subject: `Sua sugestão no planê: ${SUG_LABEL[status] ?? status}`,
    html: layout({
      eyebrow: 'sugestões',
      title: `“${esc(title)}”`,
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Sua sugestão agora está como <b>${esc(SUG_LABEL[status] ?? status)}</b>.</p>${reply.trim() ? quote(rich(reply.slice(0, 2000))) : ''}<p style="margin:12px 0 0;">Obrigada por ajudar a melhorar o planê 💛</p>`,
      button: 'ver minhas sugestões',
      url: `${SITE}#/sugestoes`,
    }),
  }),
}

const briefingMail = (s: Sub, client: string, title: string): Mail => ({
  subject: `📋 ${client || 'Seu cliente'} respondeu o briefing`,
  html: layout({
    eyebrow: 'briefing',
    title: `${esc(client || 'Seu cliente')} respondeu!`,
    text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! As respostas de <b>${esc(title)}</b> chegaram.</p><p style="margin:0;">Abra a ficha do cliente no planê: as respostas estão lá e o que era da ficha (profissão, família, imóvel…) já foi preenchido.</p>`,
    button: 'ver as respostas',
    url: `${SITE}#/clientes`,
  }),
})

const CLIENT_KIND: Record<string, { eyebrow: string; did: string }> = {
  assinatura: { eyebrow: 'contrato', did: 'assinou o contrato' },
  recado: { eyebrow: 'painel do cliente', did: 'mandou um recado' },
  briefing: { eyebrow: 'briefing', did: 'respondeu o briefing' },
  aprovacao: { eyebrow: 'proposta aprovada', did: 'aprovou a proposta' },
  visualizou: { eyebrow: 'proposta', did: 'abriu a sua proposta' },
  pedido: { eyebrow: 'pedido de orçamento', did: 'pediu um orçamento pela sua página' },
}
const clientEventMail = (s: Sub, kind: string, client: string, title: string, text: string): Mail => {
  const k = CLIENT_KIND[kind] ?? CLIENT_KIND.recado
  return {
    subject: `${client || 'Seu cliente'} ${k.did}${title ? `: ${title}` : ''}`,
    html: layout({
      eyebrow: k.eyebrow,
      title: `${esc(client || 'Seu cliente')} ${k.did}`,
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! ${title ? `<b>${esc(title)}</b>` : ''}</p>${text.trim() ? quote(rich(text.slice(0, 2000))) : ''}<p style="margin:12px 0 0;">Abra o planê: já está na central de avisos e na ficha do cliente${kind === 'assinatura' ? ', com a assinatura registrada no contrato' : kind === 'aprovacao' ? '. No orçamento, toque em fechar para criar a demanda e lançar os pagamentos' : kind === 'visualizou' ? '. Bom momento para mandar uma mensagem: ela acabou de ver' : kind === 'pedido' ? '. O rascunho do orçamento já está pronto, com o cliente e os serviços' : ''}.</p>`,
      button: 'abrir o planê',
      url: `${SITE}#/${kind === 'aprovacao' || kind === 'visualizou' || kind === 'pedido' ? 'orcamentos' : 'clientes'}`,
    }),
  }
}
const clientCopyMail = (kind: string, studio: string, title: string): Mail => ({
  subject: kind === 'assinatura' ? `Cópia: você assinou "${title}"` : kind === 'aprovacao' ? `Você aprovou: ${title}` : `Recebemos: ${title || 'sua mensagem'}`,
  html: layout({
    eyebrow: CLIENT_KIND[kind]?.eyebrow ?? 'aviso',
    title: kind === 'assinatura' ? 'Contrato assinado' : kind === 'aprovacao' ? 'Proposta aprovada' : 'Recebido!',
    text:
      kind === 'assinatura'
        ? `<p style="margin:0 0 12px;">Sua assinatura de <b>${esc(title)}</b> foi registrada e ${esc(studio || 'o profissional')} já foi avisado(a).</p><p style="margin:0;">Guarde este e-mail como comprovante. A via assinada, com o certificado de assinatura, fica disponível com ${esc(studio || 'o profissional')}.</p>`
        : `<p style="margin:0;">${esc(studio || 'O profissional')} recebeu ${esc(title || 'sua mensagem')} e já foi avisado(a).</p>`,
  }),
})

async function send(to: Sub, mail: Mail, replyTo?: string, fromName?: string) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env('BREVO_API_KEY'), 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { ...SENDER, ...(fromName ? { name: fromName.slice(0, 60) } : {}) }, replyTo: { email: replyTo && isMail(replyTo.trim()) ? replyTo.trim() : REPLY_TO, name: fromName || SENDER.name }, to: [{ email: to.email, name: to.name || undefined }], subject: mail.subject, htmlContent: mail.html }),
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
  // último erro do envio (Brevo recusou, chave errada…): volta na resposta para a dona ver
  let lastError = ''
  const once = async (s: Sub, kind: string, ref: string, mail: Mail) => {
    const { error } = await db.from('email_log').insert({ user_id: s.user_id, kind, ref })
    if (error) return false // já enviado
    try {
      await send(s, mail)
      return true
    } catch (e) {
      await db.from('email_log').delete().match({ user_id: s.user_id, kind, ref }) // falhou: tenta de novo na próxima
      console.error(e)
      lastError = String(e instanceof Error ? e.message : e).slice(0, 240)
      return false
    }
  }
  const result = (ok: boolean) => (ok ? { ok: true } : lastError ? { ok: false, erro: lastError } : { ok: false })
  const subOf = async (id: string) => (await db.from('subscriptions').select('*').eq('user_id', id).maybeSingle()).data as Sub | null

  if (tipo === 'boas-vindas') {
    if (!uid) return json({ erro: 'entre na conta' }, 401)
    const s = await subOf(uid)
    if (!s?.email) return json({ ok: false })
    return json(result(await once(s, 'boas-vindas', '1', MAILS['boas-vindas'](s))))
  }

  if (tipo === 'ativada') {
    if (!isOwner) return json({ erro: 'só a dona' }, 403)
    const s = await subOf(String(body.userId ?? ''))
    if (!s?.email) return json({ ok: false })
    return json(result(await once(s, 'ativada', new Date().toISOString().slice(0, 10), MAILS.ativada(s))))
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

  if (tipo === 'campanha') {
    if (!isOwner) return json({ erro: 'só a dona' }, 403)
    const o = {
      subject: String(body.subject ?? '').slice(0, 150),
      eyebrow: String(body.eyebrow ?? '').slice(0, 40),
      title: String(body.title ?? '').slice(0, 150),
      text: String(body.text ?? '').slice(0, 5000),
      button: String(body.button ?? '').slice(0, 40),
      url: /^https:\/\//.test(String(body.url ?? '')) ? String(body.url) : SITE,
    }
    if (!o.subject || !o.title || !o.text) return json({ erro: 'escreva o assunto, o título e o texto' }, 400)
    // teste: só para a dona, quantas vezes quiser
    if (body.teste) {
      try {
        const me: Sub = { user_id: uid!, email: OWNER_EMAIL, name: 'Laís', plan: 'estudio', status: 'ativa', trial_ends: '', blocked: false }
        await send(me, campanha(me, o))
        return json({ ok: true, enviados: 1 })
      } catch (e) {
        return json({ ok: false, erro: String(e instanceof Error ? e.message : e).slice(0, 240) })
      }
    }
    const para = String(body.para ?? 'todos')
    const status = para === 'teste' ? ['trial'] : para === 'assinantes' ? ['ativa', 'atrasada'] : para === 'saiu' ? ['cancelada'] : ['trial', 'ativa', 'atrasada']
    let q = db.from('subscriptions').select('*').in('status', status)
    if (para !== 'saiu') q = q.eq('blocked', false)
    const { data } = await q
    // mesmo e-mail não vai duas vezes para a mesma pessoa no mesmo dia
    const ref = `${o.subject} · ${new Date().toISOString().slice(0, 10)}`
    let n = 0
    for (const s of (data ?? []) as Sub[]) if (s.email && (await once(s, 'campanha', ref, campanha(s, o)))) n++
    return json(lastError && !n ? { ok: false, erro: lastError } : { ok: true, enviados: n })
  }

  // janela de 30 minutos: várias mensagens seguidas viram um e-mail só
  const slot = () => String(Math.floor(Date.now() / 1_800_000))
  const owner = (s: Sub): Sub => ({ ...s, user_id: s.user_id, email: OWNER_EMAIL, name: 'Laís' })

  if (tipo === 'mensagem') {
    if (!uid) return json({ erro: 'entre na conta' }, 401)
    if (isOwner) return json({ ok: false })
    const s = await subOf(uid)
    if (!s) return json({ ok: false })
    const text = String(body.text ?? '')
    return json(result(await once(owner(s), 'dona-mensagem', slot(), OWNER_MAILS.mensagem(s, text))))
  }

  if (tipo === 'sugestao') {
    if (!uid) return json({ erro: 'entre na conta' }, 401)
    const s = await subOf(uid)
    if (!s) return json({ ok: false })
    const title = String(body.title ?? '').slice(0, 140)
    if (!title) return json({ ok: false })
    return json(result(await once(owner(s), 'dona-sugestao', title, OWNER_MAILS.sugestao(s, title, String(body.text ?? '')))))
  }

  if (tipo === 'resposta') {
    if (!isOwner) return json({ erro: 'só a dona' }, 403)
    const s = await subOf(String(body.userId ?? ''))
    if (!s?.email) return json({ ok: false })
    // usando o sistema agora (visto nos últimos 3 min): já vê a resposta na tela
    const seen = Date.parse(String((s as Sub & { last_seen?: string }).last_seen ?? ''))
    if (seen && Date.now() - seen < 3 * 60_000) return json({ ok: false, motivo: 'online' })
    return json(result(await once(s, 'resposta', slot(), CLIENT_MAILS.resposta(s, String(body.text ?? '')))))
  }

  if (tipo === 'sugestao-atualizada') {
    if (!isOwner) return json({ erro: 'só a dona' }, 403)
    const { data: sg } = await db.from('suggestions').select('*').eq('id', String(body.id ?? '')).maybeSingle()
    if (!sg) return json({ ok: false })
    const s = await subOf(String(sg.user_id))
    if (!s?.email) return json({ ok: false })
    // um e-mail por situação nova (se só editar o texto da resposta, não manda de novo)
    return json(result(await once(s, 'sugestao', `${sg.id}:${sg.status}:${String(sg.reply ?? '').length > 0}`, CLIENT_MAILS.sugestao(s, String(sg.title ?? ''), String(sg.status ?? ''), String(sg.reply ?? '')))))
  }

  if (tipo === 'briefing') {
    // chamado pela página pública (sem login): só avisa de um briefing respondido há pouco
    const { data: b } = await db.from('briefing_links').select('*').eq('id', String(body.id ?? '')).maybeSingle()
    if (!b?.answered_at || Date.now() - Date.parse(b.answered_at) > 2 * 3_600_000) return json({ ok: false })
    const s = await subOf(String(b.user_id))
    if (!s?.email) return json({ ok: false })
    const p = (b.payload ?? {}) as { clientName?: string; title?: string }
    return json(result(await once(s, 'briefing', String(b.id), briefingMail(s, String(p.clientName ?? ''), String(p.title ?? 'briefing')))))
  }

  if (tipo === 'apagar-conta') {
    // só a dona: exclui de vez a conta de um assinante (login, assinatura, dados e arquivos). Nunca a conta de uma dona.
    if (!isOwner) return json({ ok: false, erro: 'sem permissão' }, 403)
    const target = String(body.userId ?? '')
    if (!isUuid(target) || target === uid) return json({ ok: false, erro: 'conta inválida' }, 400)
    if ((await db.from('admins').select('user_id').eq('user_id', target).maybeSingle()).data) return json({ ok: false, erro: 'conta de dona' }, 400)
    // arquivos públicos da conta (agenda, links, fotos)
    const st = db.storage.from('agenda')
    for (let i = 0; i < 20; i++) {
      const { data: files } = await st.list(target, { limit: 1000 })
      if (!files?.length) break
      await st.remove(files.map((f) => `${target}/${f.name}`))
      if (files.length < 1000) break
    }
    // o resto sai junto com o login (tabelas ligadas à conta apagam em cascata); o que não tiver cascata, sai antes
    for (const t of ['workspace', 'workspace_history', 'briefing_links', 'portal_links', 'subscriber_admin', 'billing_info', 'usage_stats', 'client_events', 'access_log', 'email_log', 'support_messages', 'suggestions', 'feedbacks', 'subscriptions']) {
      await db.from(t).delete().eq(t === 'support_messages' ? 'client_id' : 'user_id', target).then(
        () => undefined,
        () => undefined,
      )
    }
    const { error } = await db.auth.admin.deleteUser(target)
    if (error) return json({ ok: false, erro: error.message }, 500)
    return json({ ok: true })
  }

  if (tipo === 'cliente') {
    // página pública (sem login): o cliente final assinou ou mandou algo. Um registro por coisa (não repete).
    const user = String(body.user ?? '')
    const kind = String(body.kind ?? '')
    const ref = String(body.ref ?? '').slice(0, 80)
    if (!/^[0-9a-f-]{36}$/i.test(user) || !CLIENT_KIND[kind] || !ref) return json({ ok: false }, 400)
    const payload = {
      cliente: String(body.cliente ?? '').slice(0, 120),
      titulo: String(body.titulo ?? '').slice(0, 160),
      texto: String(body.texto ?? '').slice(0, 2000),
      code: String(body.code ?? '').slice(0, 20000),
      contato: String(body.clienteEmail ?? '').slice(0, 160),
      painel: String(body.painel ?? '').slice(0, 80),
      opcao: String(body.opcao ?? '').slice(0, 80),
    }
    const { error } = await db.from('client_events').insert({ user_id: user, kind, ref, payload })
    if (error) return json({ ok: false, motivo: 'já recebido' })
    // e-mail para o profissional (assinante; se não tiver assinatura, o e-mail da conta)
    let s = await subOf(user)
    if (!s?.email) {
      const { data: u } = await db.auth.admin.getUserById(user)
      if (!u?.user?.email) return json({ ok: true, email: false })
      s = { user_id: user, email: u.user.email, name: '', plan: '', status: '', trial_ends: '', blocked: false }
    }
    // proposta aberta: e-mail só na primeira vez (as outras aparecem no sistema)
    if (kind === 'visualizou') return json({ ok: true, email: await once(s, 'cliente-visualizou', payload.painel || ref, clientEventMail(s, kind, payload.cliente, payload.titulo, '')) })
    // pedido pela página: o contato vai junto no e-mail (para responder sem abrir o sistema)
    let text = payload.texto
    if (kind === 'pedido') {
      let req: { phone?: string; area?: number } = {}
      try {
        req = JSON.parse(payload.code || '{}')
      } catch {
        /* sem detalhes */
      }
      text = [payload.texto, req.area ? `área: ${req.area} m²` : '', req.phone ? `WhatsApp: ${String(req.phone).slice(0, 30)}` : '', payload.contato ? `e-mail: ${payload.contato}` : ''].filter(Boolean).join('\n')
    }
    const sent = await once(s, `cliente-${kind}`, ref, clientEventMail(s, kind, payload.cliente, payload.titulo, text))
    // cópia para o cliente (só se deixou um e-mail); responder cai no e-mail do profissional
    const to = payload.contato.trim()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      const studio = String(body.studio ?? '').slice(0, 80)
      const copy: Sub = { ...s, email: to, name: payload.cliente }
      const { error: dup } = await db.from('email_log').insert({ user_id: user, kind: `copia-${kind}`, ref })
      if (!dup) await send(copy, clientCopyMail(kind, studio, payload.titulo), s.email).catch((e) => console.error(e))
    }
    return json({ ok: true, email: sent })
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
        const since = s.created_at ? -day(s.created_at) : -1
        if (since === 1) {
          const { data: u } = await db.from('usage_stats').select('quotes').eq('user_id', s.user_id).maybeSingle()
          if (await once(s, 'teste-dia1', '1', MAILS['teste-dia1'](s, Number(u?.quotes ?? 0)))) n++
        }
        if (since === 3 && d > 3 && (await once(s, 'teste-dia3', '1', MAILS['teste-dia3'](s)))) n++
        if (since === 7 && d > 3 && (await once(s, 'teste-dia7', '1', MAILS['teste-dia7'](s)))) n++
        if (d === 3 && (await once(s, 'teste-acabando', s.trial_ends.slice(0, 10), MAILS['teste-acabando'](s)))) n++
        if (d <= 0 && d >= -2 && (await once(s, 'teste-acabou', s.trial_ends.slice(0, 10), MAILS['teste-acabou'](s)))) n++
      } else if (s.status === 'ativa' || s.status === 'atrasada') {
        const c = byId.get(s.user_id)
        if (c?.paidUntil && c.method !== 'cartao' && day(c.paidUntil) === 3 && (await once(s, 'vence-em-breve', c.paidUntil, MAILS['vence-em-breve'](s, c.paidUntil)))) n++
      }
    }
    // lembrete de parcela para a cliente final (quem ligou em configurações → propostas)
    const blocked = new Set(((data ?? []) as Sub[]).filter((s) => s.blocked || s.status === 'cancelada').map((s) => s.user_id))
    const { data: all } = await db.from('subscriptions').select('user_id, blocked, status')
    for (const r of all ?? []) if (r.blocked || r.status === 'cancelada') blocked.add(String(r.user_id))
    const { data: cfgs } = await db.from('workspace').select('user_id, cfg:data->settings->clientReminders')
    let c = 0
    for (const w of (cfgs ?? []) as { user_id: string; cfg?: { on?: boolean; before?: number; late?: boolean } }[]) {
      if (!w.cfg?.on || blocked.has(w.user_id)) continue
      const before = Math.min(10, Math.max(0, Number(w.cfg.before ?? 2)))
      const { data: ws } = await db.from('workspace').select('settings:data->settings, projects:data->projects, clients:data->clients').eq('user_id', w.user_id).maybeSingle()
      if (!ws) continue
      const st = (ws.settings ?? {}) as Record<string, any>
      const studio = String(st.brandName || st.ownerName || 'seu escritório')
      const reply = String(st.email || '')
      const clients = new Map(((ws.clients ?? []) as Record<string, any>[]).map((x) => [String(x.id), x]))
      for (const p of (ws.projects ?? []) as Record<string, any>[]) {
        const cl = clients.get(String(p.clientId))
        const to = String(cl?.email ?? '').trim()
        if (!cl || cl.noReminders || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) continue
        for (const pay of (p.payments ?? []) as Record<string, any>[]) {
          if (pay.paidDate || !pay.dueDate || !(pay.amount > 0)) continue
          const d = day(String(pay.dueDate))
          const kind = d === before ? 'parcela-vence' : w.cfg.late !== false && d === -1 ? 'parcela-atrasada' : ''
          if (!kind) continue
          const panel = cl.panel?.enabled && isUuid(String(cl.panel.token ?? '')) && isUuid(w.user_id) ? `${SITE}#/cliente/${b64u(w.user_id)}.${b64u(String(cl.panel.token))}` : ''
          const pix = st.pixKey ? `<p style="margin:12px 0 0;">Pix: <b>${esc(String(st.pixKey))}</b>${panel ? ' · ou pelo QR Code com o valor certo, no seu painel' : ''}</p>` : ''
          const late = kind === 'parcela-atrasada'
          const mail: Mail = {
            subject: late ? `${studio}: a parcela de ${brDate(pay.dueDate)} ficou em aberto` : `${studio}: parcela ${d === 0 ? 'vence hoje' : `vence em ${brDate(pay.dueDate)}`}`,
            html: studioLayout({
              studio,
              accent: st.accent,
              eyebrow: late ? 'lembrete' : 'pagamento',
              title: late ? 'Ficou uma parcela em aberto' : d === 0 ? 'Sua parcela vence hoje' : `Sua parcela vence em ${brDate(pay.dueDate)}`,
              text: `<p style="margin:0 0 12px;">Oi${first(cl.name) ? `, ${esc(first(cl.name))}` : ''}! ${late ? 'Passando para lembrar, com carinho, desta parcela do seu projeto:' : 'Só um lembrete da próxima parcela do seu projeto:'}</p>${quote(`<b>${esc(String(pay.description || 'parcela'))}</b> · ${money(Number(pay.amount))}<br><span style="color:#8b939a;">${esc(String(p.title || 'projeto'))} · ${late ? 'venceu' : 'vence'} em ${brDate(pay.dueDate)}</span>`)}${pix}<p style="margin:12px 0 0;">${late ? 'Se já pagou, desconsidere e me avise para eu dar baixa.' : 'Se já pagou, pode desconsiderar.'}</p>`,
              ...(panel ? { button: late ? 'ver e pagar' : 'ver no meu painel', url: panel } : {}),
            }),
          }
          const ref = `${pay.id}|${pay.dueDate}`
          const { error } = await db.from('email_log').insert({ user_id: w.user_id, kind, ref })
          if (error) continue // já mandou
          try {
            await send({ user_id: w.user_id, email: to, name: String(cl.name || ''), plan: '', status: '', trial_ends: '', blocked: false }, mail, reply, studio)
            c++
          } catch (e) {
            await db.from('email_log').delete().match({ user_id: w.user_id, kind, ref })
            console.error(e)
          }
        }
      }
    }
    // proposta sem resposta: um lembrete educado para a cliente, X dias depois do envio (uma vez por proposta)
    const { data: qcfgs } = await db.from('workspace').select('user_id, cfg:data->settings->quoteReminders')
    let qn = 0
    for (const w of (qcfgs ?? []) as { user_id: string; cfg?: { on?: boolean; days?: number } }[]) {
      if (!w.cfg?.on || blocked.has(w.user_id) || !isUuid(w.user_id)) continue
      const wait = Math.min(15, Math.max(2, Number(w.cfg.days ?? 3)))
      const { data: ws } = await db.from('workspace').select('settings:data->settings, quotes:data->quotes, clients:data->clients').eq('user_id', w.user_id).maybeSingle()
      if (!ws) continue
      const st = (ws.settings ?? {}) as Record<string, any>
      const studio = String(st.brandName || st.ownerName || 'seu escritório').replace(/\.$/, '')
      const reply = String(st.email || '')
      const clients = new Map(((ws.clients ?? []) as Record<string, any>[]).map((x) => [String(x.id), x]))
      for (const q of (ws.quotes ?? []) as Record<string, any>[]) {
        if (q.status !== 'enviado' || q.clientApproval || !q.sentAt || !isUuid(String(q.shareToken ?? ''))) continue
        if (q.validUntil && day(String(q.validUntil)) < 0) continue
        if (-day(String(q.sentAt)) !== wait) continue
        const cl = clients.get(String(q.clientId))
        const to = String(cl?.email ?? '').trim()
        if (!cl || cl.noReminders || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) continue
        const link = `${SITE}#/proposta/${b64u(w.user_id)}.${b64u(String(q.shareToken))}`
        const num = `#${String(q.number ?? '').padStart(3, '0')}`
        const mail: Mail = {
          subject: `${studio}: conseguiu ver a proposta ${num}?`,
          html: studioLayout({
            studio,
            accent: st.accent,
            eyebrow: 'proposta',
            title: 'Conseguiu ver a proposta?',
            text: `<p style="margin:0 0 12px;">Oi${first(cl.name) ? `, ${esc(first(cl.name))}` : ''}! Passando para saber se você conseguiu ver a proposta${q.title ? ` <b>${esc(String(q.title))}</b>` : ''}.</p><p style="margin:0;">Se quiser ajustar alguma coisa, é só responder este e-mail. E se estiver tudo certo, dá para aprovar direto pelo link.</p>`,
            button: 'ver a proposta',
            url: link,
          }),
        }
        const ref = String(q.id)
        const { error } = await db.from('email_log').insert({ user_id: w.user_id, kind: 'proposta-sem-resposta', ref })
        if (error) continue // já mandou
        try {
          await send({ user_id: w.user_id, email: to, name: String(cl.name || ''), plan: '', status: '', trial_ends: '', blocked: false }, mail, reply, studio)
          qn++
        } catch (e) {
          await db.from('email_log').delete().match({ user_id: w.user_id, kind: 'proposta-sem-resposta', ref })
          console.error(e)
        }
      }
    }
    return json({ ok: true, enviados: n, lembretesClientes: c, lembretesPropostas: qn })
  }

  return json({ erro: 'tipo desconhecido' }, 400)
})
