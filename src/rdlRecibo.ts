import { RDL_LOGO } from './rdlLogo'
import { SIGN_FONTS } from './components/SignaturePad'
import { RDL_INFO, servicosDe, unidade, valores, type Reserva, type ReservaConfig } from './rdlReserva'

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

export function reciboHtml(r: Reserva, cfg: ReservaConfig) {
  const d = r.dados
  const sv = servicosDe(d)
  const v = valores(d, cfg)
  const pago = v.agora
  const resta = v.total - pago
  const quando = dBR(r.status.sinal) || dBR(new Date().toISOString())
  const servicos = [
    sv.vistoria && ['Vistoria de entrega das chaves', 'engenheiro civil + laudo com fotos + ART', brl(v.vistoria)],
    sv.vistoria && d.revistoria && ['Revistoria (combinada)', `${brl(cfg.revistoria)}, paga à parte no dia da revistoria`, 'à parte'],
    sv.reforma && ['ART de reforma + plano de reforma', 'para o condomínio liberar a obra', brl(v.reforma)],
  ].filter(Boolean) as string[][]
  const passos: [string, string, boolean][] = [
    ['Reserva', 'contrato assinado', true],
    ['Sinal', `pago em ${quando}`, true],
    ['Data', 'quando a MRV liberar', !!r.status.data],
    ['Vistoria', r.status.data ? `${dBR(r.status.data)}${r.status.hora ? ` · ${r.status.hora}` : ''}` : 'engenheiro com você', false],
    ['Laudo + ART', 'em até 4 dias úteis', false],
  ]
  const sig = SIGN_FONTS.find((f) => f.id === 'allura')!.family
  return `<div class="rc">
<style>
.rc{width:1080px;height:1527px;background:#fff;font-family:Poppins,system-ui,sans-serif;color:#012C60;display:flex;flex-direction:column;box-sizing:border-box;position:relative;overflow:hidden}
.rc *{box-sizing:border-box;margin:0}
.rc .in{padding:50px 84px 0;flex:1;display:flex;flex-direction:column}
.rc .logo{display:block;margin:0 auto;height:92px}
.rc .pill{align-self:center;margin-top:20px;background:#012C60;color:#fff;border-radius:999px;padding:9px 22px;font-size:17px;letter-spacing:3px;font-weight:600}
.rc .pill i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#FF8216;margin-right:12px;vertical-align:2px}
.rc h1{text-align:center;font-size:56px;font-weight:700;letter-spacing:-1.5px;margin-top:14px;line-height:1.05}
.rc h1 span{color:#FF8216}
.rc .hero{margin-top:26px;background:#012C60;border-radius:30px;padding:30px 40px;color:#fff;display:grid;grid-template-columns:1.1fr 1fr;gap:36px;align-items:center}
.rc .hero small{display:block;font-size:17px;letter-spacing:2.5px;opacity:.75;font-weight:600}
.rc .hero strong{display:block;font-size:84px;font-weight:700;letter-spacing:-2px;line-height:1;margin-top:10px}
.rc .hero em{font-style:normal;display:block;margin-top:12px;color:#FF9A45;font-weight:600;font-size:18px;letter-spacing:1.5px}
.rc .hero .side{border-left:1px solid rgba(255,255,255,.18);padding-left:36px;display:grid;gap:14px}
.rc .hero .row{display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.08);border-radius:14px;padding:14px 18px;font-size:19px}
.rc .hero .row b{font-size:22px}
.rc .hero .row.or{background:#FF8216}
.rc .cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
.rc .card{border:1.5px solid #E6E9EF;border-radius:24px;padding:20px 26px}
.rc .card h3{font-size:15px;letter-spacing:2.5px;color:#FF8216;font-weight:700;margin-bottom:12px}
.rc .card p{font-size:20px;line-height:1.45;color:#46506A}
.rc .card p b{color:#012C60;font-weight:600}
.rc .serv{margin-top:18px;border:1.5px solid #E6E9EF;border-radius:24px;padding:18px 26px}
.rc .serv h3{font-size:15px;letter-spacing:2.5px;color:#FF8216;font-weight:700;margin-bottom:8px}
.rc .serv .it{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-top:1px solid #EEF0F4;font-size:21px}
.rc .serv .it:first-of-type{border-top:0}
.rc .serv .it small{display:block;font-size:16px;color:#7A7F92}
.rc .serv .it b{font-size:22px}
.rc .steps{margin-top:22px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;position:relative}
.rc .steps:before{content:"";position:absolute;left:10%;right:10%;top:27px;border-top:2px dashed #C9D3E3}
.rc .st{text-align:center;position:relative}
.rc .st span{width:54px;height:54px;border-radius:16px;background:#EAF0F8;color:#012C60;display:grid;place-items:center;margin:0 auto;font-weight:700;font-size:22px}
.rc .st.ok span{background:#012C60;color:#fff}
.rc .st b{display:block;margin-top:10px;font-size:19px}
.rc .st small{display:block;font-size:15px;color:#7A7F92;line-height:1.3}
.rc .decl{margin-top:20px;font-size:18px;line-height:1.55;color:#46506A;text-align:center;padding:0 20px}
.rc .decl b{color:#012C60}
.rc .sign{margin:auto auto 26px;text-align:center;width:460px}
.rc .sign .s{font-family:${sig};font-size:64px;color:#012C60;line-height:1;height:66px}
.rc .sign hr{border:0;border-top:1.5px solid #9AA3B6;margin:6px 0 10px}
.rc .sign b{display:block;font-size:19px}
.rc .sign small{font-size:15px;color:#7A7F92}
.rc .foot{background:#012C60;color:#fff;padding:30px 84px;display:flex;justify-content:space-between;align-items:center;border-top:6px solid #FF8216}
.rc .foot b{font-size:21px}
.rc .foot small{display:block;font-size:15px;opacity:.75;margin-top:4px}
.rc .foot .r{text-align:right;font-size:17px;line-height:1.5}
</style>
<div class="in">
<img class="logo" src="${RDL_LOGO}" alt="">
<div class="pill"><i></i>RECIBO · ${esc(cfg.empreendimento.replace(/\s*\(.*\)/, '').toUpperCase())}</div>
<h1>Pagamento <span>recebido</span></h1>
<div class="hero">
  <div><small>SINAL · PIX · ${esc(quando)}</small><strong>${brl(pago)}</strong><em>VAGA GARANTIDA NA AGENDA</em></div>
  <div class="side">
    <div class="row"><span>Total contratado</span><b>${brl(v.total)}</b></div>
    <div class="row or"><span>${sv.vistoria ? 'Restante no dia' : 'Restante na entrega'}</span><b>${brl(resta)}</b></div>
  </div>
</div>
<div class="cards">
  <div class="card"><h3>CONTRATANTE</h3><p><b>${esc(d.nome)}</b><br>CPF ${esc(d.cpf)}<br>${esc(d.tel)}</p></div>
  <div class="card"><h3>IMÓVEL</h3><p><b>${esc(cfg.empreendimento.replace(/\s*\(.*\)/, ''))}</b><br>${esc(unidade(d))}${d.planta ? `<br>${esc(d.planta.replace(/\s*\(.*\)/, ''))}` : ''}</p></div>
</div>
<div class="serv"><h3>SERVIÇOS CONTRATADOS</h3>${servicos.map(([t, s, val]) => `<div class="it"><span>${esc(t)}<small>${esc(s)}</small></span><b>${val}</b></div>`).join('')}</div>
<div class="steps">${passos.map(([t, s, ok], i) => `<div class="st ${ok ? 'ok' : ''}"><span>${ok ? '✓' : i + 1}</span><b>${t}</b><small>${esc(s)}</small></div>`).join('')}</div>
<p class="decl">Recebemos de <b>${esc(d.nome)}</b> a importância de <b>${brl(pago)}</b> (${porExtenso(pago)}), referente ao sinal do contrato nº <b>${r.id.slice(0, 8).toUpperCase()}</b>. Quando a MRV liberar as datas, combine o horário com o Rogério antes de confirmar com ela.</p>
<div class="sign"><div class="s">Rogério F. Vieira</div><hr><b>${esc(RDL_INFO.engineer)}</b><small>CREA-SP ${RDL_INFO.crea} · Santo André, ${esc(quando)}</small></div>
</div>
<div class="foot"><div><b>${esc(RDL_INFO.engineer)}</b><small>${esc(RDL_INFO.company)} · CNPJ ${RDL_INFO.cnpj}</small></div><div class="r">${RDL_INFO.phone}<br>${RDL_INFO.email}</div></div>
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
    const sig = SIGN_FONTS.find((f) => f.id === 'allura')!.family
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

/** Mensagem padrão de agradecimento e confirmação (WhatsApp). */
export function msgConfirmacao(r: Reserva, cfg: ReservaConfig) {
  const d = r.dados
  const sv = servicosDe(d)
  const v = valores(d, cfg)
  const nome = d.nome.split(' ')[0]
  const serv = [sv.vistoria && 'vistoria de entrega das chaves', sv.reforma && 'ART de reforma'].filter(Boolean).join(' e ')
  return `Oi, ${nome}! Tudo bem? Aqui é o Rogério, da RDL Engenharia. 😊\n\nRecebi o seu pagamento de *${brl(v.agora)}*, muito obrigado! Está confirmado:\n\n✅ ${serv}\n🏢 ${cfg.empreendimento.replace(/\s*\(.*\)/, '')} · ${unidade(d)}\n📝 Contrato nº ${r.id.slice(0, 8).toUpperCase()}, assinado por nós dois\n💳 Restante: ${brl(v.total - v.agora)}${sv.vistoria ? ' no dia da vistoria' : ''}\n\n📅 Quando a MRV liberar as datas, me avise *antes* de confirmar o horário com ela, para combinarmos juntos.\n\nSegue o recibo. Qualquer dúvida, é só chamar por aqui!`
}
