// planê apzinho: modelos dos e-mails (HTML de e-mail: tabelas e estilos inline, para abrir bem no Gmail, Outlook e celular).
type J = Record<string, any>

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
export const brl = (v: unknown) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const primeiro = (nome: unknown) => esc(String(nome ?? '').trim().split(' ')[0])
const dataBR = (d: unknown) => {
  const x = d ? new Date(String(d)) : new Date()
  return isNaN(+x) ? '' : x.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
}
export const numPedido = (ped: J) => String(ped?.id ?? '').replace(/-/g, '').slice(0, 8).toUpperCase()

const C = { pri: '#4e6472', priSoft: '#e7ecef', sec: '#9b593f', secSoft: '#f4e7e0', bg: '#f5f1eb', ink: '#2b2826', txt: '#4a4542', mut: '#8a817a', line: '#ece5dc' }
export const WHATS = '5511969288192'
const zap = (msg: string) => `https://wa.me/${WHATS}?text=${encodeURIComponent(msg)}`

/** Botão grande (cor principal) ou secundário (contorno). */
export const botao = (texto: string, url: string, tipo: 'pri' | 'sec' = 'pri') =>
  tipo === 'pri'
    ? `<a href="${url}" style="display:inline-block;background:${C.pri};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px">${esc(texto)}</a>`
    : `<a href="${url}" style="display:inline-block;background:#ffffff;color:${C.pri};text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:999px;border:1.5px solid ${C.pri}">${esc(texto)}</a>`

/** Caixa de destaque (azul clarinho ou terracota clarinho). */
export const caixa = (html: string, tom: 'pri' | 'sec' = 'pri') =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td style="background:${tom === 'pri' ? C.priSoft : C.secSoft};border-radius:14px;padding:16px 18px;font-size:14px;line-height:1.6;color:${C.ink}">${html}</td></tr></table>`

/** Passo a passo numerado. */
export const passos = (itens: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">${itens
    .map(
      (t, i) => `<tr><td width="34" valign="top" style="padding:6px 0"><div style="width:26px;height:26px;line-height:26px;border-radius:50%;background:${C.pri};color:#fff;font-size:13px;font-weight:700;text-align:center">${i + 1}</div></td><td valign="top" style="padding:8px 0 6px 6px;font-size:14px;line-height:1.55;color:${C.txt}">${t}</td></tr>`,
    )
    .join('')}</table>`

/** Resumo do pedido: itens, valores, forma de pagamento, número e data. */
export function resumoPedido(ped: J, titulo = 'resumo do pedido') {
  const itens = (ped?.itens ?? []) as J[]
  const linhas = itens
    .map((i) => `<tr><td style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink}">${esc(i.nome)}</td><td align="right" style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.txt};white-space:nowrap">${i.preco != null ? brl(i.preco) : ''}</td></tr>`)
    .join('')
  const n = Number(ped?.parcelas) || 1
  const forma = ped?.cortesia ? 'cortesia' : ped?.forma === 'cartao' ? (n > 1 ? `cartão em ${n}x de ${brl(Number(ped.total) / n)}` : 'cartão à vista') : 'Pix'
  const extra = (rot: string, val: string, forte = false) =>
    `<tr><td style="padding:5px 0;font-size:${forte ? 15 : 13}px;color:${forte ? C.ink : C.mut};font-weight:${forte ? 700 : 400}">${rot}</td><td align="right" style="padding:5px 0;font-size:${forte ? 15 : 13}px;color:${forte ? C.ink : C.mut};font-weight:${forte ? 700 : 400};white-space:nowrap">${val}</td></tr>`
  const desconto = Number(ped?.desconto) || 0
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid ${C.line};border-radius:14px"><tr><td style="padding:16px 18px">
<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${C.sec};font-weight:700;padding-bottom:6px">${esc(titulo)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}
${desconto > 0 ? extra('subtotal', brl(ped.subtotal)) + extra('desconto no Pix', `− ${brl(desconto)}`) : ''}
${extra('total', brl(ped?.total), true)}
${extra('pagamento', esc(forma))}
${extra('pedido', `nº ${numPedido(ped)} · ${dataBR(ped?.pago_em || ped?.criado)}`)}
</table></td></tr></table>`
}

const ajuda = (assunto: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:1px solid ${C.line}"><tr><td style="padding-top:16px;font-size:13px;line-height:1.6;color:${C.txt}">
<b style="color:${C.ink}">Precisa de ajuda?</b> Responda este e-mail ou chame no <a href="${zap(assunto)}" style="color:${C.pri};font-weight:600">WhatsApp (11) 96928-8192</a>.</td></tr></table>`

/* As três frentes da planê usam a mesma loja. O pedido diz qual: cada item guarda a frente
   (ou ela sai do começo do id: beleza-/free- = arquivos, arq-/kit-arq- = arq; o resto é do apê). */
export type Marca = { id: 'apzinho' | 'arquivos' | 'arq'; nome: string; sufixo: string; path: string; slogan: string }
export const frenteDoId = (id: string) => (/^(beleza|free)-/.test(id) ? 'arquivos' : /^(kit-)?arq-/.test(id) ? 'arq' : 'apzinho')
export function marcaDe(itens: { id?: unknown; frente?: string }[] = []): Marca {
  const fs = new Set(itens.map((i) => i.frente || frenteDoId(String(i.id))))
  const f = fs.size === 1 ? [...fs][0] : 'apzinho'
  if (f === 'arquivos') return { id: 'arquivos', nome: 'planê arquivos', sufixo: 'arquivos', path: 'arquivos', slogan: 'arquivos prontos para mandar' }
  if (f === 'arq') return { id: 'arq', nome: 'planê arq', sufixo: 'arq', path: 'arq', slogan: 'para quem projeta' }
  return { id: 'apzinho', nome: 'planê apzinho', sufixo: 'apzinho', path: 'ape', slogan: 'organize o seu apê' }
}
export const APZINHO = marcaDe([])

/** Moldura de todos os e-mails: faixa com a marca, título, texto, botão, ajuda e rodapé. */
export function moldura(o: { previa?: string; kicker?: string; titulo: string; corpo: string; botao?: [string, string]; botao2?: [string, string]; ajuda?: string | false; site: string; dona?: boolean; marca?: Marca }) {
  const m = o.marca || APZINHO
  const ape = `${o.site.replace(/\/$/, '')}/${m.path}/`
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.titulo)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Poppins,'Segoe UI',Arial,sans-serif;color:${C.ink};-webkit-text-size-adjust:100%">
${o.previa ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.previa)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:26px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:${C.pri};border-radius:20px 20px 0 0;padding:20px 26px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:19px;font-weight:700;color:#ffffff">planê<span style="color:#f1c9b6"> ${m.sufixo}</span></td>
    <td align="right" style="font-size:12px;color:#dfe6ea">${o.dona ? 'aviso da loja' : m.slogan}</td>
  </tr></table>
</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 20px 20px;padding:28px 26px 24px">
  ${o.kicker ? `<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${C.sec};font-weight:700;padding-bottom:8px">${esc(o.kicker)}</div>` : ''}
  <div style="font-size:23px;line-height:1.25;font-weight:700;color:${C.ink};padding-bottom:12px">${o.titulo}</div>
  <div style="font-size:14px;line-height:1.65;color:${C.txt}">${o.corpo}</div>
  ${o.botao ? `<div style="padding-top:20px">${botao(o.botao[0], o.botao[1])}</div>` : ''}
  ${o.botao2 ? `<div style="padding-top:10px">${botao(o.botao2[0], o.botao2[1], 'sec')}</div>` : ''}
  ${o.ajuda === false ? '' : ajuda(o.ajuda || `Oi! Preciso de ajuda com o ${m.nome}`)}
</td></tr>
<tr><td align="center" style="padding:18px 10px 6px;font-size:12px;color:${C.mut};line-height:1.7">
  <a href="${ape}#conta" style="color:${C.pri};text-decoration:none;font-weight:600">minha conta</a> &nbsp;·&nbsp;
  <a href="${ape}#loja" style="color:${C.pri};text-decoration:none;font-weight:600">loja</a> &nbsp;·&nbsp;
  <a href="https://wa.me/${WHATS}" style="color:${C.pri};text-decoration:none;font-weight:600">WhatsApp</a><br>
  ${m.nome} · useplane.com.br/${m.path === 'ape' ? 'apzinho' : m.path}<br>
  <span style="font-size:11px">Materiais de uso pessoal e intransferível: proibida a reprodução, distribuição ou revenda.</span>
</td></tr>
</table></td></tr></table></body></html>`
}
