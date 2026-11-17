// publicado automaticamente pelo GitHub (workflow supabase.yml)
// Avisos por e-mail da planê (roda no Supabase, nunca no site).
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
//   rdl-chat     → chat de dúvidas da vistoria: avisa a Laís da mensagem do morador e o morador da resposta
//   rdl          → RDL Engenharia (reserva da vistoria): avisa o morador e a RDL em cada etapa
//                  (reserva, sinal, data, laudo, revistoria, cancelada), com a identidade da RDL
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
<tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#a88a80;text-align:center;">planê · gestão leve para quem vive de projeto<br><span style="color:#8b939a;">Dúvidas? Fale com a gente pelo chat dentro da planê.</span></td></tr>
</table></td></tr></table></body></html>`
}


/** E-mail para a cliente final, com o nome do escritório (não o da planê). */
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
    subject: 'Boas-vindas à planê ✨',
    html: layout({
      eyebrow: 'boas-vindas',
      title: `Que bom ter você aqui${first(s.name) ? `, ${esc(first(s.name))}` : ''}!`,
      text: `<p style="margin:0 0 12px;">Seu teste grátis do plano ${PRICES[s.plan]?.name ?? ''} já começou e vai até <b>${br(s.trial_ends)}</b>.</p><p style="margin:0;">Para começar com o pé direito: faça sua primeira proposta em <b>orçamentos → novo</b>. A tabela de preços já vem pronta para o seu jeito de trabalhar, e o cliente você cadastra ali mesmo. Os primeiros passos, no início, te guiam.</p>`,
      button: 'abrir a planê',
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
    subject: 'Deixe a planê cobrar por você',
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
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! No seu <b>perfil</b>, em “sua página”, você publica uma página simples com o que faz e um botão de pedir orçamento.</p><p style="margin:0;">Coloque o link na bio do Instagram: cada pedido chega na planê com o cliente cadastrado e o rascunho do orçamento pronto.</p>`,
      button: 'montar minha página',
      url: `${SITE}#/perfil`,
    }),
  }),
  'teste-acabando': (s: Sub): Mail => ({
    subject: 'Seu teste da planê acaba em 3 dias',
    html: layout({
      eyebrow: 'teste grátis',
      title: 'Faltam 3 dias do seu teste',
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Seu teste grátis vai até <b>${br(s.trial_ends)}</b>.</p><p style="margin:0;">Para continuar com tudo o que você já cadastrou, escolha seu plano em <b>minha assinatura</b>. Pix ou cartão, sem fidelidade.</p>`,
      button: 'escolher meu plano',
      url: `${SITE}#/assinatura`,
    }),
  }),
  'teste-acabou': (s: Sub): Mail => ({
    subject: 'Seu teste da planê terminou',
    html: layout({
      eyebrow: 'teste grátis',
      title: 'Seu teste terminou, seus dados continuam aqui',
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Os dias grátis acabaram, mas nada foi apagado: clientes, orçamentos e o financeiro estão guardados.</p><p style="margin:0;">Para voltar a usar, é só escolher um plano.</p>`,
      button: 'escolher meu plano',
      url: `${SITE}#/assinatura`,
    }),
  }),
  ativada: (s: Sub): Mail => ({
    subject: 'Sua assinatura da planê está ativa 🎉',
    html: layout({
      eyebrow: 'assinatura',
      title: 'Pagamento confirmado!',
      text: `<p style="margin:0;">Obrigada${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Sua assinatura do plano <b>${PRICES[s.plan]?.name ?? ''}</b> está ativa. Pode seguir usando tudo normalmente.</p>`,
      button: 'abrir a planê',
    }),
  }),
  'vence-em-breve': (s: Sub, until: string): Mail => ({
    subject: 'Sua assinatura da planê vence em 3 dias',
    html: layout({
      eyebrow: 'assinatura',
      title: `Vence em ${br(until)}`,
      text: `<p style="margin:0;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! A mensalidade do plano <b>${PRICES[s.plan]?.name ?? ''}</b> (${money(PRICES[s.plan]?.price ?? 0)}) vence em <b>${br(until)}</b>. Vamos te mandar o Pix pelo chat da planê.</p>`,
      button: 'abrir a planê',
    }),
  }),
  novidade: (_s: Sub, title: string, text: string): Mail => ({
    subject: `Novidade na planê: ${title}`,
    html: layout({
      eyebrow: 'novidades',
      title,
      text: text
        .split(/\n\s*\n/)
        .map((p) => `<p style="margin:0 0 12px;">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
        .join(''),
      button: 'ver na planê',
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
    subject: `💬 ${s.name || s.email} escreveu no chat da planê`,
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
    subject: 'Você tem uma resposta na planê 💬',
    html: layout({
      eyebrow: 'chat',
      title: `Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Respondemos sua mensagem`,
      text: quote(rich(text.slice(0, 2000))),
      button: 'abrir a conversa',
      small: 'Para responder, use o balão de conversa no canto da tela da planê.',
    }),
  }),
  sugestao: (s: Sub, title: string, status: string, reply: string): Mail => ({
    subject: `Sua sugestão na planê: ${SUG_LABEL[status] ?? status}`,
    html: layout({
      eyebrow: 'sugestões',
      title: `“${esc(title)}”`,
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Sua sugestão agora está como <b>${esc(SUG_LABEL[status] ?? status)}</b>.</p>${reply.trim() ? quote(rich(reply.slice(0, 2000))) : ''}<p style="margin:12px 0 0;">Obrigada por ajudar a melhorar a planê 💛</p>`,
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
    text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! As respostas de <b>${esc(title)}</b> chegaram.</p><p style="margin:0;">Abra a ficha do cliente na planê: as respostas estão lá e o que era da ficha (profissão, família, imóvel…) já foi preenchido.</p>`,
    button: 'ver as respostas',
    url: `${SITE}#/clientes`,
  }),
})

const dataMail = (s: Sub, client: string): Mail => ({
  subject: `${client || 'Seu cliente'} mandou os dados do contrato`,
  html: layout({
    eyebrow: 'dados para contrato',
    title: `${esc(client || 'Seu cliente')} mandou os dados!`,
    text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! Os dados para o contrato chegaram: empresa, dados pessoais, sócios e quem assina.</p><p style="margin:0;">Ao abrir a planê, eles entram sozinhos no cadastro e no contrato. Dá para conferir e corrigir em clientes → dados para contrato.</p>`,
    button: 'ver os dados',
    url: `${SITE}#/dados-contrato`,
  }),
})

const CLIENT_KIND: Record<string, { eyebrow: string; did: string }> = {
  assinatura: { eyebrow: 'contrato', did: 'assinou o contrato' },
  recado: { eyebrow: 'painel do cliente', did: 'mandou um recado' },
  briefing: { eyebrow: 'briefing', did: 'respondeu o briefing' },
  aprovacao: { eyebrow: 'proposta aprovada', did: 'aprovou a proposta' },
  visualizou: { eyebrow: 'proposta', did: 'abriu a sua proposta' },
  pedido: { eyebrow: 'pedido de orçamento', did: 'pediu um orçamento pela sua página' },
  dados: { eyebrow: 'dados para contrato', did: 'mandou os dados do contrato' },
  imagens: { eyebrow: 'imagens', did: 'respondeu sobre as imagens' },
}
const clientEventMail = (s: Sub, kind: string, client: string, title: string, text: string, link = ''): Mail => {
  const k = CLIENT_KIND[kind] ?? CLIENT_KIND.recado
  return {
    subject: `${client || 'Seu cliente'} ${k.did}${title ? `: ${title}` : ''}`,
    html: layout({
      eyebrow: k.eyebrow,
      title: `${esc(client || 'Seu cliente')} ${k.did}`,
      text: `<p style="margin:0 0 12px;">Oi${first(s.name) ? `, ${esc(first(s.name))}` : ''}! ${title ? `<b>${esc(title)}</b>` : ''}</p>${text.trim() ? quote(rich(text.slice(0, 2000))) : ''}<p style="margin:12px 0 0;">Abra a planê: já está na central de avisos e na ficha do cliente${kind === 'assinatura' ? ', com a assinatura registrada no contrato' : kind === 'aprovacao' ? '. No orçamento, toque em fechar para criar a demanda e lançar os pagamentos' : kind === 'visualizou' ? '. Bom momento para mandar uma mensagem: ela acabou de ver' : kind === 'pedido' ? '. O rascunho do orçamento já está pronto, com o cliente e os serviços' : kind === 'imagens' ? '. Os pontos marcados já estão na demanda, em cima da imagem' : ''}.</p>`,
      button: kind === 'assinatura' && link ? 'ver o contrato assinado' : 'abrir a planê',
      url: kind === 'assinatura' && link ? link : `${SITE}#/${kind === 'aprovacao' || kind === 'visualizou' || kind === 'pedido' ? 'orcamentos' : kind === 'imagens' ? 'projetos' : 'clientes'}`,
    }),
  }
}
const clientCopyMail = (kind: string, studio: string, title: string, link = ''): Mail => ({
  subject: kind === 'assinatura' ? `Cópia: você assinou "${title}"` : kind === 'aprovacao' ? `Você aprovou: ${title}` : `Recebemos: ${title || 'sua mensagem'}`,
  html: layout({
    eyebrow: CLIENT_KIND[kind]?.eyebrow ?? 'aviso',
    title: kind === 'assinatura' ? 'Contrato assinado' : kind === 'aprovacao' ? 'Proposta aprovada' : 'Recebido!',
    text:
      kind === 'assinatura'
        ? `<p style="margin:0 0 12px;">Sua assinatura de <b>${esc(title)}</b> foi registrada e ${esc(studio || 'o profissional')} já foi avisado(a).</p><p style="margin:0;">${link ? 'Abaixo está a sua cópia do contrato assinado pelas duas partes, com o certificado de assinatura. Dá para salvar em PDF.' : `Guarde este e-mail como comprovante. A via assinada, com o certificado de assinatura, fica disponível com ${esc(studio || 'o profissional')}.`}</p>`
        : `<p style="margin:0;">${esc(studio || 'O profissional')} recebeu ${esc(title || 'sua mensagem')} e já foi avisado(a).</p>`,
    ...(kind === 'assinatura' && link ? { button: 'ver o contrato assinado', url: link } : {}),
  }),
})


/* ---------- RDL Engenharia: e-mails da reserva da vistoria (identidade da RDL, remetente da planê) ---------- */
const RDL_EMAIL = 'roger.rdl76@yahoo.com.br'
const RDL_FROM = 'RDL Engenharia'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dBR = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : '')
type RdlRow = { id: string; token: string; criado: string; dados: Record<string, unknown>; status: Record<string, string>; cancelada: boolean; avisos?: Record<string, string> }
const rdlSub = (id: string, email: string, name: string): Sub => ({ user_id: id, email, name, plan: '', status: '', trial_ends: '', blocked: false })
// deno-lint-ignore no-explicit-any
async function rdlCfg(db: any): Promise<RdlCfg> {
  let cfg: RdlCfg = { preco: 280, individual: 297, minimo: 10, revistoria: 150, periodo: 'entre dezembro de 2026 e março de 2027', pix: '', empreendimento: 'Condomínio San Levi (MRV)' }
  try {
    const f = await db.storage.from('agenda').download('7d1e0000-0000-4000-8000-00000000d1d1/reserva-vistoria.json')
    if (f.data) cfg = { ...cfg, ...JSON.parse(await f.data.text()) }
  } catch {
    /* usa o padrão */
  }
  return cfg
}
/** Aviso diário da RDL: lembrete do sinal no 5º dia e e-mail de quem foi cancelado por falta de sinal. */
// deno-lint-ignore no-explicit-any
async function rdlDiario(db: any) {
  await db.rpc('rdl_expirar')
  const cfg = await rdlCfg(db)
  const { data } = await db.from('rdl_reservas').select('*').gte('criado', new Date(Date.now() - 30 * 864e5).toISOString())
  const rows = (data ?? []) as RdlRow[]
  const grupo = rows.filter((x) => !x.cancelada).length
  let n = 0
  for (const r of rows) {
    const st = (r.status ?? {}) as Record<string, string>
    const av = r.avisos ?? {}
    const idade = (Date.now() - new Date(r.criado).getTime()) / 864e5
    const k = r.cancelada && st.expirada ? 'expirada' : !r.cancelada && !st.sinal && idade >= 5 ? 'lembrete-auto' : ''
    if (!k || av[k]) continue
    const to = String((r.dados as Record<string, string>).email ?? '').trim()
    if (!isMail(to)) continue
    try {
      await send(rdlSub(r.id, to, String((r.dados as Record<string, string>).nome ?? '')), rdlMails(r, cfg, grupo)[k === 'expirada' ? 'expirada' : 'lembrete'], RDL_EMAIL, RDL_FROM)
      await db.from('rdl_reservas').update({ avisos: { ...av, [k]: new Date().toISOString() } }).eq('id', r.id)
      n++
    } catch (e) {
      console.error(e)
    }
  }
  return n
}
function rdlLayout(o: { eyebrow: string; title: string; text: string; button?: string; url?: string; rows?: [string, string][] }) {
  const btn = o.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr><td style="border-radius:12px;background:#FF8216;"><a href="${o.url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(o.button)}</a></td></tr></table>`
    : ''
  const rows = o.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F1F2F6;border-radius:12px;">${o.rows
        .map(([k, v]) => `<tr><td style="padding:9px 14px;font-size:11px;letter-spacing:1.4px;color:#7A7F92;font-weight:600;white-space:nowrap;vertical-align:top;">${esc(k.toUpperCase())}</td><td style="padding:9px 14px;font-size:14px;color:#012C60;font-weight:600;">${esc(v)}</td></tr>`)
        .join('')}</table>`
    : ''
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#FAF8F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:28px 12px;font-family:Poppins,Helvetica,Arial,sans-serif;color:#012C60;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
<tr><td align="center" style="padding:0 0 18px;"><img src="${SITE}rdl/logo-email.png" width="190" alt="RDL Engenharia e Representações" style="display:block;width:190px;height:auto;"></td></tr>
<tr><td style="background:#ffffff;border:1px solid #E6E4DE;border-radius:18px;padding:32px 28px;">
<p style="margin:0 0 8px;font-size:11px;letter-spacing:2.6px;color:#FF8216;font-weight:600;">${esc(o.eyebrow.toUpperCase())}</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700;color:#012C60;">${esc(o.title)}</h1>
<div style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#46506A;">${o.text}</div>
${rows}${btn}
</td></tr>
<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#012C60;border-top:4px solid #FF8216;border-radius:0 0 14px 14px;"><tr>
<td style="padding:14px 18px;font-size:12px;line-height:1.55;color:#ffffff;"><b style="font-size:13px;">Eng. Rogério Francisco Vieira</b><br><span style="color:#B8C4D6;">RDL Engenharia e Representações · CNPJ 48.624.017/0001-46</span></td>
<td style="padding:14px 18px;font-size:12px;line-height:1.55;color:#ffffff;text-align:right;white-space:nowrap;">(11) 9 7520-8296<br><span style="color:#B8C4D6;">${RDL_EMAIL}</span></td></tr></table></td></tr>
<tr><td style="padding:14px 8px 0;font-size:11.5px;line-height:1.6;color:#7A7F92;text-align:center;">Para falar com a RDL, é só responder este e-mail ou chamar no WhatsApp.</td></tr>
</table></td></tr></table></body></html>`
}
type RdlCfg = { preco: number; individual?: number; minimo?: number; revistoria: number; periodo: string; pix: string; empreendimento: string }
function rdlMails(r: RdlRow, cfg: RdlCfg, grupo = 0) {
  const d = r.dados as Record<string, string | boolean>
  const nome = String(d.nome ?? '')
  const pn = nome.split(' ')[0]
  const un = `${d.torre ? `torre ${d.torre}, ` : ''}apto ${d.apto}`
  const painel = `${SITE}#/vistoria/${r.id}.${r.token}`
  const metade = cfg.preco / 2
  const emp = cfg.empreendimento.replace(/\s*\(.*\)/, '')
  const s = (r.status ?? {}) as Record<string, string> & { reforma?: Record<string, string | number> }
  const rf = s.reforma ?? {}
  const min = cfg.minimo ?? 10
  const ind = cfg.individual ?? 297
  const planta = String(d.planta ?? '')
  const base: [string, string][] = [['morador', nome], ['unidade', `${emp} · ${un}`], ...(planta ? [['planta', planta] as [string, string]] : []), ['reserva', `nº ${r.id.slice(0, 8).toUpperCase()}`]]
  const grupoTxt = grupo >= min ? `O grupo já tem ${grupo} reservas: vale o valor de grupo (${brl(cfg.preco)}).` : `O grupo está com ${grupo} de ${min} reservas. Com ${min}, todos pagam ${brl(cfg.preco)}; se não chegar, a diferença para ${brl(ind)} entra no restante, no dia da vistoria.`
  return {
    reserva: {
      subject: `Reserva recebida: vistoria do ${un}`,
      html: rdlLayout({
        eyebrow: 'reserva da vistoria',
        title: `Recebemos a sua reserva, ${pn}!`,
        text: `<p style="margin:0 0 12px;">O contrato da vistoria de entrega de chaves foi assinado e está guardado no seu painel, junto com tudo da vistoria.</p><p style="margin:0;"><b>Para garantir a vaga</b>, falta o sinal de <b>${brl(metade)}</b>, em até 7 dias (sem o sinal, a reserva é cancelada sozinha)${cfg.pix ? `, no Pix <b>${esc(cfg.pix)}</b>` : ''}. Depois é só mandar o comprovante pelo WhatsApp ou respondendo este e-mail.</p><p style="margin:12px 0 0;">${grupoTxt}</p>`,
        rows: [...base, ['valor', `${brl(cfg.preco)} (sinal ${brl(metade)})`], ['previsão da MRV', cfg.periodo], ['grupo', `${grupo} de ${min} reservas`], ['revistoria', d.revistoria ? `combinada (${brl(cfg.revistoria)}, paga no dia)` : 'não, por enquanto']],
        button: 'Abrir o meu painel',
        url: painel,
      }),
    },
    sinal: {
      subject: `Vaga garantida: vistoria do ${un}`,
      html: rdlLayout({
        eyebrow: 'sinal recebido',
        title: 'Sua vaga está garantida',
        text: `<p style="margin:0 0 12px;">Oi, ${esc(pn)}! Recebemos o sinal e a sua vaga na agenda está garantida. O contrato agora está assinado pelas duas partes.</p><p style="margin:0;">Quando a MRV liberar as datas (${esc(cfg.periodo)}), avise o Rogério <b>antes</b> de confirmar o horário com ela, para combinarem juntos.</p>`,
        rows: [...base, ['sinal', `${brl(metade)} recebido em ${dBR(s.sinal)}`], ['restante', `${brl(cfg.preco - metade)} no dia da vistoria`]],
        button: 'Ver o painel e o contrato',
        url: painel,
      }),
    },
    data: {
      subject: `Vistoria marcada: ${dBR(s.data)}${s.hora ? ` às ${s.hora}` : ''}`,
      html: rdlLayout({
        eyebrow: 'vistoria marcada',
        title: `${dBR(s.data)}${s.hora ? ` às ${s.hora}` : ''}`,
        text: `<p style="margin:0 0 12px;">Oi, ${esc(pn)}! A sua vistoria de entrega de chaves está marcada.</p><p style="margin:0;">• água e luz ligadas pela MRV<br>• você ou alguém de confiança acompanhando<br>• restante de <b>${brl(cfg.preco - metade)}</b> no dia, por Pix ou cartão</p>`,
        rows: [...base, ['data', `${dBR(s.data)}${s.hora ? ` às ${s.hora}` : ''}`]],
        button: 'Abrir o meu painel',
        url: painel,
      }),
    },
    laudo: {
      subject: `Laudo pronto: vistoria do ${un}`,
      html: rdlLayout({
        eyebrow: 'laudo e ART',
        title: 'O seu laudo está pronto',
        text: `<p style="margin:0 0 12px;">Oi, ${esc(pn)}! O laudo da vistoria, com fotos e a ART, está pronto.</p><p style="margin:0;">Encaminhe para a MRV pelo atendimento deles e guarde o protocolo. Se quiser a revistoria depois dos reparos (${brl(cfg.revistoria)}), é só responder este e-mail.</p>`,
        rows: base,
        button: 'Abrir o laudo',
        url: /^https?:\/\//.test(s.laudo ?? '') ? s.laudo : painel,
      }),
    },
    revistoria: {
      subject: `Revistoria marcada: ${dBR(s.revistoriaData)}`,
      html: rdlLayout({
        eyebrow: 'revistoria',
        title: `Revistoria em ${dBR(s.revistoriaData)}`,
        text: `<p style="margin:0;">Oi, ${esc(pn)}! A revistoria para conferir os reparos da MRV está marcada. O valor de ${brl(cfg.revistoria)} é pago no dia.</p>`,
        rows: base,
        button: 'Abrir o meu painel',
        url: painel,
      }),
    },
    cancelada: {
      subject: `Reserva cancelada: vistoria do ${un}`,
      html: rdlLayout({ eyebrow: 'reserva', title: 'Reserva cancelada', text: `<p style="margin:0;">Oi, ${esc(pn)}. A reserva da vistoria do ${esc(un)} foi cancelada. Se tiver qualquer dúvida, é só responder este e-mail.</p>`, rows: base }),
    },
    lembrete: {
      subject: `Lembrete: sinal da vistoria do ${un}`,
      html: rdlLayout({
        eyebrow: 'lembrete',
        title: 'Falta o sinal para garantir a vaga',
        text: `<p style="margin:0 0 12px;">Oi, ${esc(pn)}! A sua reserva está feita, mas a vaga só fica garantida com o sinal de <b>${brl(metade)}</b>${cfg.pix ? ` (Pix <b>${esc(cfg.pix)}</b>)` : ''}.</p><p style="margin:0;">O prazo é de 7 dias depois da assinatura. Sem o sinal, a reserva é cancelada sozinha, sem custo. Se já pagou, é só mandar o comprovante respondendo este e-mail.</p>`,
        rows: base,
        button: 'Abrir o meu painel',
        url: painel,
      }),
    },
    expirada: {
      subject: `Reserva cancelada por falta de sinal: ${un}`,
      html: rdlLayout({
        eyebrow: 'reserva',
        title: 'Sua reserva foi cancelada',
        text: `<p style="margin:0 0 12px;">Oi, ${esc(pn)}. Como o sinal não foi pago em 7 dias, a reserva da vistoria do ${esc(un)} foi cancelada automaticamente, sem nenhum custo.</p><p style="margin:0;">Se ainda quiser a vistoria, é só reservar de novo pelo link (enquanto houver vagas) ou responder este e-mail.</p>`,
        rows: base,
        button: 'Reservar de novo',
        url: `${SITE}vistoria/`,
      }),
    },
    'reforma-pedido': {
      subject: `Pedido de ART de reforma: ${nome} · ${un}`,
      html: rdlLayout({
        eyebrow: 'ART de reforma',
        title: `${nome} pediu orçamento de ART de reforma`,
        text: `<p style="margin:0 0 12px;">O que vai fazer na reforma:</p><p style="margin:0;padding:12px 14px;background:#FFF1E4;border-radius:10px;color:#012C60;">${esc(String(rf.pedido ?? ''))}</p><p style="margin:12px 0 0;">Para responder, abra <b>vistorias</b> no sistema da RDL, coloque o escopo, o valor e o prazo e envie. O morador aprova pelo painel.</p>`,
        rows: [...base, ['WhatsApp', String(d.tel ?? '')]],
        button: 'Abrir o sistema da RDL',
        url: `${SITE}rdl/`,
      }),
    },
    'reforma-orcamento': {
      subject: `Orçamento da ART de reforma: ${un}`,
      html: rdlLayout({
        eyebrow: 'ART de reforma',
        title: 'Seu orçamento chegou',
        text: `<p style="margin:0 0 12px;">Oi, ${esc(pn)}! O Rogério analisou o seu pedido de ART de reforma.</p><p style="margin:0;">Para contratar, é só abrir o painel e tocar em <b>Aprovar orçamento</b>.</p>`,
        rows: [...base, ['o que cobre', String(rf.escopo ?? '')], ['valor', brl(Number(rf.valor ?? 0))], ...(rf.prazo ? [['prazo', String(rf.prazo)] as [string, string]] : [])],
        button: 'Ver e aprovar no painel',
        url: painel,
      }),
    },
    'reforma-aprovada': {
      subject: `ART de reforma aprovada: ${nome} · ${un}`,
      html: rdlLayout({
        eyebrow: 'ART de reforma',
        title: 'Orçamento aprovado',
        text: `<p style="margin:0;">${esc(nome)} aprovou o orçamento da ART de reforma pelo painel (${brl(Number(rf.valor ?? 0))}). O próximo passo é combinar a visita técnica e o pagamento.</p>`,
        rows: [...base, ['valor', brl(Number(rf.valor ?? 0))], ['WhatsApp', String(d.tel ?? '')]],
        button: 'Abrir o sistema da RDL',
        url: `${SITE}rdl/`,
      }),
    },
    rdl: {
      subject: `Nova reserva: ${nome} · ${un}`,
      html: rdlLayout({
        eyebrow: 'nova reserva pelo link',
        title: `${nome} reservou a vistoria`,
        text: `<p style="margin:0;">O contrato foi assinado no link. Falta o sinal de <b>${brl(metade)}</b>. Os dados completos, o contrato e as mensagens prontas estão em <b>vistorias</b>, no sistema da RDL.</p>`,
        rows: [...base, ['WhatsApp', String(d.tel ?? '')], ['e-mail', String(d.email ?? '')], ['revistoria', d.revistoria ? 'combinada' : 'não']],
        button: 'Abrir o sistema da RDL',
        url: `${SITE}rdl/`,
      }),
    },
  } as Record<string, Mail>
}

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
    const p = (b.payload ?? {}) as { clientName?: string; title?: string; kind?: string }
    if (p.kind === 'dados') return json(result(await once(s, 'dados', String(b.id), dataMail(s, String(p.clientName ?? '')))))
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



  if (tipo === 'rdl-chat') {
    // chat de dúvidas da vistoria. evento "morador": mensagem nova pelo link (avisa a Laís por e-mail, no máximo
    // 1 a cada 10 min por conversa). evento "rdl": a RDL respondeu no sistema (avisa o morador por e-mail).
    const evento = String(body.evento ?? '')
    const cid = String(body.conversa ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(cid) || !['morador', 'rdl'].includes(evento)) return json({ ok: false }, 400)
    const { data: conv } = await db.from('rdl_conversas').select('*').eq('id', cid).maybeSingle()
    const c = conv as { id: string; token: string; nome: string; contato: string; reserva: string | null; avisado: string | null } | null
    if (!c) return json({ ok: false }, 404)
    if (evento === 'morador' && String(body.token ?? '') !== c.token) return json({ ok: false }, 403)
    if (evento === 'rdl' && !isOwner && String(who?.user?.email ?? '').toLowerCase() !== RDL_EMAIL) return json({ ok: false }, 403)
    const { data: msgs } = await db.from('rdl_mensagens').select('autor, texto, criado').eq('conversa', cid).order('criado', { ascending: false }).limit(6)
    const ult = ((msgs ?? []) as { autor: string; texto: string; criado: string }[]).reverse()
    let res: RdlRow | null = null
    if (c.reserva) res = ((await db.from('rdl_reservas').select('*').eq('id', c.reserva).maybeSingle()).data as RdlRow | null) ?? null
    const rd = (res?.dados ?? {}) as Record<string, string>
    const quem = c.nome || rd.nome || 'Morador'
    const un = res ? `${rd.torre ? `torre ${rd.torre}, ` : ''}apto ${rd.apto}` : ''
    const bolhas = (meu: 'morador' | 'rdl') =>
      ult
        .map((m) => {
          const mine = m.autor === meu
          const hora = new Date(m.criado).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          return `<tr><td align="${mine ? 'right' : 'left'}" style="padding:4px 0;"><table role="presentation" cellpadding="0" cellspacing="0" style="max-width:82%;"><tr><td style="background:${mine ? '#012C60' : '#F1F2F6'};color:${mine ? '#ffffff' : '#012C60'};border-radius:${mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};padding:10px 13px;font-size:14px;line-height:1.5;">${rich(m.texto.slice(0, 1200))}<div style="font-size:10.5px;opacity:.65;margin-top:4px;text-align:right;">${m.autor === 'rdl' ? 'RDL' : esc(quem.split(' ')[0])} · ${hora}</div></td></tr></table></td></tr>`
        })
        .join('')
    const chat = (meu: 'morador' | 'rdl') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${bolhas(meu)}</table>`
    try {
      if (evento === 'morador') {
        // no máximo 1 aviso a cada 10 minutos por conversa (as outras mensagens aparecem juntas no próximo)
        if (c.avisado && Date.now() - new Date(c.avisado).getTime() < 10 * 60_000) return json({ ok: true, motivo: 'avisado há pouco' })
        const html = rdlLayout({
          eyebrow: 'chat de dúvidas · vistoria',
          title: `${quem}${un ? ` · ${un}` : ''}`,
          text: `${chat('rdl')}<p style="margin:0;font-size:13px;color:#7A7F92;">Contato: ${esc(c.contato || rd.tel || rd.email || '')}. Responda pelo chat (a resposta aparece para a pessoa na página) ${isMail(c.contato || rd.email || '') ? 'ou respondendo este e-mail (vai direto para o e-mail dela)' : 'ou pelo WhatsApp'}.</p>`,
          button: 'Responder no chat',
          url: `${SITE}rdl/#reservas`,
        })
        const replyTo = isMail(c.contato) ? c.contato : isMail(rd.email ?? '') ? rd.email : undefined
        await send(rdlSub(cid, OWNER_EMAIL, ''), { subject: `Nova mensagem no chat: ${quem}`, html }, replyTo, `Chat ${RDL_FROM}`)
        await db.from('rdl_conversas').update({ avisado: new Date().toISOString() }).eq('id', cid)
        return json({ ok: true })
      }
      const to = isMail(c.contato) ? c.contato : String(rd.email ?? '')
      if (!isMail(to)) return json({ ok: true, email: false })
      const link = res ? `${SITE}#/vistoria/${res.id}.${res.token}` : `${SITE}#/vistoria/duvida-${c.id}.${c.token}`
      const html = rdlLayout({
        eyebrow: 'resposta da RDL',
        title: `Oi, ${esc(quem.split(' ')[0])}! Respondemos a sua dúvida`,
        text: `${chat('morador')}<p style="margin:0;font-size:13px;color:#7A7F92;">Para continuar a conversa, abra o chat pelo botão abaixo ou responda este e-mail.</p>`,
        button: 'Abrir a conversa',
        url: link,
      })
      await send(rdlSub(cid, to, quem), { subject: 'Resposta da RDL Engenharia sobre a vistoria', html }, RDL_EMAIL, RDL_FROM)
      return json({ ok: true })
    } catch (e) {
      console.error(e)
      return json({ ok: false })
    }
  }

  if (tipo === 'rdl') {
    // reserva da vistoria (RDL Engenharia). "reserva": a página pública manda com o código do painel;
    // as outras etapas só a RDL (Laís ou Rogério, logados). Cada e-mail vai uma vez por etapa (coluna avisos).
    const evento = String(body.evento ?? '')
    const id = String(body.id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['reserva', 'sinal', 'data', 'laudo', 'revistoria', 'cancelada', 'lembrete', 'reforma-pedido', 'reforma-orcamento', 'reforma-aprovada'].includes(evento)) return json({ ok: false }, 400)
    const { data: row } = await db.from('rdl_reservas').select('*').eq('id', id).maybeSingle()
    const r = row as RdlRow | null
    if (!r) return json({ ok: false }, 404)
    if (evento === 'reserva' || evento === 'reforma-pedido' || evento === 'reforma-aprovada') {
      if (String(body.token ?? '') !== r.token) return json({ ok: false }, 403)
    } else {
      const mail = String(who?.user?.email ?? '').toLowerCase()
      if (!isOwner && mail !== RDL_EMAIL) return json({ ok: false }, 403)
    }
    const st = r.status ?? {}
    const rfx = ((r.status ?? {}) as { reforma?: Record<string, string> }).reforma ?? {}
    const ref = evento === 'lembrete' ? `lembrete:${new Date().toISOString().slice(0, 10)}` : evento === 'reforma-pedido' ? `rp:${rfx.pedidoEm ?? ''}` : evento === 'reforma-orcamento' ? `ro:${rfx.enviadoEm ?? ''}` : evento === 'data' ? `data:${st.data}:${st.hora ?? ''}` : evento === 'laudo' ? `laudo:${st.laudo ?? ''}` : evento === 'revistoria' ? `rev:${st.revistoriaData ?? ''}` : evento
    const avisos = r.avisos ?? {}
    if (avisos[ref]) return json({ ok: true, motivo: 'já enviado' })
    // valores da campanha (arquivo público da RDL)
    const cfg = await rdlCfg(db)
    const { count: grupo } = await db.from('rdl_reservas').select('id', { count: 'exact', head: true }).eq('cancelada', false)
    const mails = rdlMails(r, cfg, grupo ?? 0)
    const to = String((r.dados as Record<string, string>).email ?? '').trim()
    const nome = String((r.dados as Record<string, string>).nome ?? '')
    const ok: string[] = []
    try {
      const paraRdl = evento === 'reforma-pedido' || evento === 'reforma-aprovada'
      if (isMail(to) && evento !== 'reforma-pedido') {
        await send(rdlSub(id, to, nome), evento === 'reforma-aprovada' ? { subject: `Você aprovou a ART de reforma`, html: mails['reforma-aprovada'].html } : mails[evento], RDL_EMAIL, RDL_FROM)
        ok.push('morador')
      }
      if (evento === 'reserva' || paraRdl) {
        const m = evento === 'reserva' ? mails.rdl : mails[evento]
        await send(rdlSub(id, RDL_EMAIL, 'Rogério'), m, to || RDL_EMAIL, RDL_FROM)
        if (OWNER_EMAIL !== RDL_EMAIL) await send(rdlSub(id, OWNER_EMAIL, ''), m, to || RDL_EMAIL, RDL_FROM).catch((e) => console.error(e))
        ok.push('rdl')
      }
    } catch (e) {
      console.error(e)
      return json({ ok: false, erro: String(e instanceof Error ? e.message : e).slice(0, 240) })
    }
    await db.from('rdl_reservas').update({ avisos: { ...avisos, [ref]: new Date().toISOString() } }).eq('id', id)
    return json({ ok: true, enviados: ok })
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
    // cópia do contrato assinado: só endereços do próprio planê
    const link = /^https:\/\/[a-z0-9.-]+\/[^\s"'<>]*#\/assinar\/[A-Za-z0-9_.\/-]+$/.test(String(body.link ?? '')) ? String(body.link).slice(0, 20000) : ''
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
    const sent = await once(s, `cliente-${kind}`, ref, clientEventMail(s, kind, payload.cliente, payload.titulo, text, link))
    // cópia para o cliente (só se deixou um e-mail); responder cai no e-mail do profissional
    const to = payload.contato.trim()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      const studio = String(body.studio ?? '').slice(0, 80)
      const copy: Sub = { ...s, email: to, name: payload.cliente }
      const { error: dup } = await db.from('email_log').insert({ user_id: user, kind: `copia-${kind}`, ref })
      if (!dup) await send(copy, clientCopyMail(kind, studio, payload.titulo, link), s.email).catch((e) => console.error(e))
    }
    return json({ ok: true, email: sent })
  }

  if (tipo === 'diario') {
    if (!cron) return json({ erro: 'sem permissão' }, 403)
    // RDL: lembrete do sinal e reservas canceladas por falta de sinal (não trava o resto)
    await rdlDiario(db).catch((e) => console.error(e))
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
