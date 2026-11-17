import { RDL_LOGO } from './rdlLogo'
import { ASSINATURA_RDL } from './rdlAssinatura'
import { RDL_INFO, linkPainel, servicosDe, unidade, valores, type Reserva, type ReservaConfig } from './rdlReserva'

/* Recibo do sinal da vistoria, no mesmo visual da proposta enviada aos moradores (azul-marinho, laranja, Poppins).
   Vira imagem (PNG, para mandar no WhatsApp) e PDF (A4). */

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const dBR = (iso?: string) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR') : '')

/** Valor por extenso (até milhares), para o texto do recibo. */
export function porExtenso(v: number) {
  const u = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
  const ate999 = (n: number): string => {
    if (n === 0) return ''
    if (n === 100) return 'cem'
    const p: string[] = []
    if (n >= 100) p.push(c[Math.floor(n / 100)])
    const r = n % 100
    if (r) p.push(r < 20 ? u[r] : d[Math.floor(r / 10)] + (r % 10 ? ` e ${u[r % 10]}` : ''))
    return p.join(' e ')
  }
  const reais = Math.floor(v)
  const cent = Math.round((v - reais) * 100)
  const mil = Math.floor(reais / 1000)
  const resto = reais % 1000
  let t = [mil ? (mil === 1 ? 'mil' : `${ate999(mil)} mil`) : '', ate999(resto)].filter(Boolean).join(resto && (resto < 100 || resto % 100 === 0) ? ' e ' : ' ')
  t = t ? `${t} ${reais === 1 ? 'real' : 'reais'}` : ''
  if (cent) t += `${t ? ' e ' : ''}${ate999(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`
  return t || 'zero reais'
}

/** Valores com o preço da ART de reforma que a RDL já mandou (quando houver). */
const valoresR = (r: Reserva, cfg: ReservaConfig) => valores({ ...r.dados, reformaEstimativa: r.status.reforma?.valor ?? r.dados.reformaEstimativa }, cfg)
/** O que entra na ART de reforma (os serviços que o morador informou). */
const itensReforma = (r: Reserva) => (r.status.reforma?.itens ?? r.dados.reformaItens ?? []).join(', ').toLowerCase()

export function reciboHtml(r: Reserva, cfg: ReservaConfig) {
  const d = r.dados
  const sv = servicosDe(d)
  const v = valoresR(r, cfg)
  const pago = v.agora
  const resta = v.total - pago
  const quando = dBR(r.status.sinal) || dBR(new Date().toISOString())
  const emp = cfg.empreendimento.replace(/\s*\(.*\)/, '')
  const num = r.id.slice(0, 8).toUpperCase()
  const linhas = [
    sv.vistoria && ['Vistoria de entrega das chaves', 'engenheiro civil, laudo com fotos e ART', brl(v.vistoria)],
    sv.reforma && ['ART de reforma + plano de reforma', itensReforma(r) ? `cobre só: ${itensReforma(r)}` : 'cobre só os serviços informados', brl(v.reforma)],
    sv.vistoria && d.revistoria && ['Revistoria (combinada)', `paga no dia da revistoria`, `${brl(cfg.revistoria)} à parte`],
  ].filter(Boolean) as string[][]
  const passos: [string, string, boolean][] = [
    ['Reserva', 'contrato assinado', true],
    ['Pagamento', quando, true],
    ['Data', r.status.data ? dBR(r.status.data) : 'quando a MRV liberar', !!r.status.data],
    ['Vistoria', 'com o engenheiro', false],
    ['Laudo + ART', 'até 4 dias úteis', false],
  ]
  const campo = (k: string, val: string) => `<div class="f"><small>${k}</small><b>${esc(val)}</b></div>`
  return `<div class="rc">
<style>
.rc{width:1080px;height:1527px;background:#fff;font-family:Poppins,system-ui,sans-serif;color:#012C60;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden}
.rc *{box-sizing:border-box;margin:0}
.rc .top{display:flex;justify-content:space-between;align-items:center;padding:50px 80px 28px;border-bottom:4px solid #FF8216}
.rc .top img{height:84px}
.rc .top .r{text-align:right}
.rc .top .r small{display:block;font-size:16px;letter-spacing:4px;color:#FF8216;font-weight:700}
.rc .top .r b{display:block;font-size:44px;letter-spacing:-1px;line-height:1.1}
.rc .top .r span{font-size:17px;color:#7A7F92}
.rc .body{padding:32px 80px 0;flex:1;display:flex;flex-direction:column;gap:22px;min-height:0}
.rc .val{background:#F3F6FA;border-radius:28px;padding:28px 38px;display:flex;justify-content:space-between;align-items:center;gap:30px}
.rc .val small{display:block;font-size:16px;letter-spacing:3px;color:#7A7F92;font-weight:600}
.rc .val strong{display:block;font-size:92px;font-weight:700;letter-spacing:-3px;line-height:1.02;margin-top:6px}
.rc .val p{font-size:18px;color:#46506A;margin-top:6px}
.rc .val .ok{background:#012C60;color:#fff;border-radius:22px;padding:22px 26px;text-align:center;min-width:250px}
.rc .val .ok span{display:block;width:46px;height:46px;border-radius:50%;background:#FF8216;margin:0 auto 10px;font-size:26px;line-height:46px;font-weight:700}
.rc .val .ok b{display:block;font-size:22px}
.rc .val .ok em{font-style:normal;font-size:15px;opacity:.75}
.rc .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:22px 30px}
.rc .f small{display:block;font-size:14px;letter-spacing:2.5px;color:#FF8216;font-weight:700;text-transform:uppercase}
.rc .f b{display:block;font-size:22px;font-weight:600;margin-top:4px;line-height:1.3}
.rc .tb{border:1.5px solid #E4E8EF;border-radius:24px;overflow:hidden}
.rc .tb .h{display:flex;justify-content:space-between;background:#F7F9FC;padding:14px 28px;font-size:14px;letter-spacing:2.5px;color:#7A7F92;font-weight:700}
.rc .tb .it{display:flex;justify-content:space-between;align-items:center;padding:13px 28px;border-top:1px solid #EEF1F5;font-size:21px}
.rc .tb .it small{display:block;font-size:15px;color:#7A7F92}
.rc .tb .it b{font-size:21px;white-space:nowrap}
.rc .tb .tot{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1.5px solid #E4E8EF}
.rc .tb .tot div{padding:16px 28px;font-size:15px;color:#7A7F92;letter-spacing:1px}
.rc .tb .tot div b{display:block;font-size:26px;color:#012C60;letter-spacing:-.5px}
.rc .tb .tot div.o{background:#FFF3E8}
.rc .tb .tot div.o b{color:#E06D06}
.rc .steps{display:grid;grid-template-columns:repeat(5,1fr);position:relative}
.rc .steps:before{content:"";position:absolute;left:10%;right:10%;top:22px;border-top:2px solid #E4E8EF}
.rc .st{text-align:center;position:relative}
.rc .st span{width:44px;height:44px;border-radius:50%;background:#fff;border:2px solid #C9D3E3;color:#9AA3B6;display:grid;place-items:center;margin:0 auto;font-weight:700;font-size:18px}
.rc .st.ok span{background:#012C60;border-color:#012C60;color:#fff}
.rc .st b{display:block;margin-top:10px;font-size:18px}
.rc .st small{display:block;font-size:14px;color:#7A7F92}
.rc .note{display:flex;gap:16px;align-items:flex-start;background:#FFF7EF;border-radius:20px;padding:20px 26px;font-size:18px;line-height:1.5;color:#46506A}
.rc .note i{font-style:normal;width:34px;height:34px;flex:none;border-radius:50%;background:#FF8216;color:#fff;display:grid;place-items:center;font-weight:700}
.rc .note b{color:#012C60}
.rc .end{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:28px}
.rc .end .loc{font-size:18px;color:#46506A;line-height:1.5}
.rc .sign{text-align:center;width:420px}
.rc .sign .s{font-family:${ASSINATURA_RDL.family};font-size:84px;color:#012C60;line-height:1;height:76px;white-space:nowrap}
.rc .sign hr{border:0;border-top:1.5px solid #9AA3B6;margin:4px 0 10px}
.rc .sign b{display:block;font-size:18px}
.rc .sign small{font-size:14px;color:#7A7F92}
.rc .foot{background:#012C60;color:#fff;padding:22px 80px;display:flex;justify-content:space-between;font-size:15px}
.rc .foot span{opacity:.85}
</style>
<div class="top"><img src="${RDL_LOGO}" alt=""><div class="r"><small>RECIBO</small><b>Nº ${num}</b><span>emitido em ${esc(quando)}</span></div></div>
<div class="body">
  <div class="val">
    <div><small>VALOR RECEBIDO · PIX</small><strong>${brl(pago)}</strong><p>${esc(porExtenso(pago))}</p></div>
    <div class="ok"><span>✓</span><b>Vaga garantida</b><em>sinal de 50% · ${esc(quando)}</em></div>
  </div>
  <div class="grid">
    ${campo('Recebido de', d.nome)}${campo('CPF', d.cpf)}${campo('Telefone', d.tel)}
    ${campo('Empreendimento', emp)}${campo('Unidade', unidade(d))}${campo('Planta', (d.planta ?? '—').replace(/\s*\(.*\)/, ''))}
  </div>
  <div class="tb">
    <div class="h"><span>SERVIÇOS DO CONTRATO</span><span>VALOR</span></div>
    ${linhas.map(([t, s, val]) => `<div class="it"><span>${esc(t)}<small>${esc(s)}</small></span><b>${val}</b></div>`).join('')}
    <div class="tot"><div>TOTAL<b>${brl(v.total)}</b></div><div>PAGO AGORA<b>${brl(pago)}</b></div><div class="o">${sv.vistoria ? 'RESTANTE NO DIA' : 'RESTANTE NA ENTREGA'}<b>${brl(resta)}</b></div></div>
  </div>
  <div class="steps">${passos.map(([t, s, ok], i) => `<div class="st ${ok ? 'ok' : ''}"><span>${ok ? '✓' : i + 1}</span><b>${t}</b><small>${esc(s)}</small></div>`).join('')}</div>
  <div class="note"><i>!</i><span>Quando a MRV liberar as datas, <b>avise o Rogério antes de confirmar o horário com ela</b>, para combinarem juntos. Contrato nº ${num}, assinado pelas duas partes.</span></div>
  <div class="end">
    <div class="loc">Santo André, ${esc(quando)}<br>${esc(RDL_INFO.company)}<br>CNPJ ${RDL_INFO.cnpj}</div>
    <div class="sign"><div class="s">${ASSINATURA_RDL.nome}</div><hr><b>${esc(RDL_INFO.engineer)}</b><small>Engenheiro civil · CREA-SP ${RDL_INFO.crea}</small></div>
  </div>
</div>
<div class="foot"><span>${RDL_INFO.phone}</span><span>${RDL_INFO.email}</span><span>useplane.com.br/vistoria</span></div>
</div>`
}

/** Gera o recibo como imagem PNG (1080 × 1527, proporção A4). */
export async function reciboPng(r: Reserva, cfg: ReservaConfig): Promise<Blob> {
  const { toBlob } = await import('html-to-image')
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;left:-20000px;top:0;z-index:-1'
  box.innerHTML = reciboHtml(r, cfg)
  document.body.appendChild(box)
  try {
    await document.fonts.ready
    const sig = ASSINATURA_RDL.family
    await Promise.all([document.fonts.load(`72px ${sig}`), document.fonts.load('700 62px Poppins'), document.fonts.load('600 20px Poppins')]).catch(() => undefined)
    const el = box.firstElementChild as HTMLElement
    const blob = await toBlob(el, { width: 1080, height: 1527, pixelRatio: 1.5, cacheBust: true })
    if (!blob) throw new Error('recibo')
    return blob
  } finally {
    box.remove()
  }
}

/** PDF A4 com a imagem do recibo. */
export async function reciboPdf(png: Blob): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const url = await new Promise<string>((ok) => {
    const fr = new FileReader()
    fr.onload = () => ok(String(fr.result))
    fr.readAsDataURL(png)
  })
  doc.addImage(url, 'PNG', 0, 0, 210, 297)
  return doc.output('blob')
}

/** Mensagem única de agradecimento + vaga garantida, enviada junto com o recibo (WhatsApp). */
export function msgConfirmacao(r: Reserva, cfg: ReservaConfig) {
  const d = r.dados
  const sv = servicosDe(d)
  const v = valoresR(r, cfg)
  const nome = d.nome.split(' ')[0]
  const itens = itensReforma(r)
  const serv = [sv.vistoria && `vistoria de entrega das chaves${d.revistoria ? ` (revistoria ${brl(cfg.revistoria)} no dia, se precisar)` : ''}`, sv.reforma && `ART de reforma${itens ? ` (${itens})` : ''}`].filter(Boolean).join(' + ')
  const restV = v.vistoria - v.sinalVistoria
  const restR = v.reforma - v.sinalReforma
  const resto = [restV && `${brl(restV)} no dia da vistoria`, restR && `${brl(restR)} na entrega da ART`].filter(Boolean).join(' e ')
  const linhas = [
    `Oi, ${nome}! Aqui é o Rogério, da RDL Engenharia. Recebi seu Pix de *${brl(v.agora)}*, obrigado! Sua reserva está confirmada 😊`,
    '',
    `✅ ${serv}`,
    `🏢 ${cfg.empreendimento.replace(/\s*\(.*\)/, '')} · ${unidade(d)}`,
    `📝 Contrato nº ${r.id.slice(0, 8).toUpperCase()}, assinado por nós dois`,
    resto && `💳 Restante: ${resto}`,
    '',
    sv.vistoria && '📅 Quando a MRV liberar as datas, me avise *antes* de confirmar o horário com eles.',
    sv.reforma && '📐 A ART cobre só os serviços informados. Se mudar algo na obra, me avise antes.',
    `Seu painel: ${linkPainel(r)}`,
    '',
    'Segue o recibo 👇',
  ]
  return linhas.filter((l) => typeof l === 'string').join('\n').replace(/\n{3,}/g, '\n\n')
}
