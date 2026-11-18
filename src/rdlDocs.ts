import { RDL_LOGO } from './rdlLogo'
import { VISTORIA_CHECKLIST } from './vistoriaChecklist'

/* Documentos da RDL Engenharia no padrão da proposta da vistoria (azul-marinho, laranja, cartões e ícones):
   orçamento, checklist de vistoria e relatório (laudo) de vistoria. Cada função devolve uma página HTML
   pronta para imprimir ou salvar em PDF (A4). Sem dados, saem em branco, para preencher à mão. */

export const RDL = {
  name: 'Eng. Rogério Francisco Vieira',
  company: 'RDL Engenharia e Representações',
  cnpj: '48.624.017/0001-46',
  phone: '(11) 9 7520-8296',
  email: 'roger.rdl76@yahoo.com.br',
  crea: '5070438360',
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: n % 1 ? 2 : 0 })
const dateBR = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : iso ?? '')

/* ---------- ícones de traço (mesmos da proposta) ---------- */
const P: Record<string, string> = {
  key: '<circle cx="8" cy="12" r="4.2"/><path d="M12.2 12H21M17.5 12v3M20 12v2.4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.3-3 7.7-7 9.5-4-1.8-7-5.2-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 15.5h5"/>',
  plan: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 12h8V3.5M11.5 20.5V16h9"/>',
  sign: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 17c1-1.5 1.8-1.5 2.5 0s1.5 1.5 2.5 0"/>',
  redo: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  tool: '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  building: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-5h4v5"/>',
  wall: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 10h17M10 3.5v6.5M14 10v10.5"/>',
  law: '<path d="M12 4v16M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0zM8 20h8"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8.5 7l1.5-3h4l1.5 3"/><circle cx="12" cy="13.5" r="3.2"/>',
  drop: '<path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  door: '<path d="M6 21V4h12v17M4 21h16"/><path d="M14.5 12.5h.01"/>',
  sink: '<path d="M4 11h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M12 11V6a2 2 0 0 1 4 0"/>',
  sofa: '<path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 17v2M19 17v2"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3H10v1"/><circle cx="7" cy="10.5" r="1.8"/>',
  bath: '<path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M6 12V6a2 2 0 0 1 4 0"/><path d="M7 19l-1 2M17 19l1 2"/>',
  wash: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6.5h.01M11 6.5h3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  hall: '<path d="M4 21V5l8-2 8 2v16"/><path d="M9 21v-8h6v8"/>',
  car: '<path d="M5 16l1.5-5a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 16"/><rect x="3.5" y="16" width="17" height="4" rx="1.5"/><path d="M7 20v1.5M17 20v1.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  hard: '<path d="M2 18h20M4 18v-3a8 8 0 0 1 16 0v3M10 7V5a2 2 0 0 1 4 0v2M9 10v4M15 10v4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>',
}
export const ico = (name: string, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24">${P[name] ?? P.doc}</svg>`
const AMB_ICON: Record<string, string> = { Cozinha: 'sink', Lavanderia: 'wash', Sala: 'sofa', 'Sacada / Varanda': 'sun', Quarto: 'bed', Corredor: 'hall', Banheiro: 'bath', Garagem: 'car' }
const QUADRO_ICON = (q: string) => (/elétric/i.test(q) ? 'bolt' : /porta|janela/i.test(q) ? 'door' : /piso|parede/i.test(q) ? 'wall' : /bancada|tanque|vaso|churras/i.test(q) ? 'drop' : /gás/i.test(q) ? 'shield' : /guarda/i.test(q) ? 'building' : 'list')

/* ---------- ilustrações das capas: as dos modelos da Laís, nas cores da RDL (public/rdl) ---------- */
const asset = (name: string) => (typeof location === 'undefined' ? `rdl/${name}` : `${location.origin}${location.pathname.replace(/[^/]*$/, '')}rdl/${name}`)
const ART_CHECKLIST = () => `<img class="photo" src="${asset('fotos/capa-cozinha.jpg')}" alt="">`
const ART_LAUDO = () => `<img class="photo" src="${asset('fotos/capa-sala.jpg')}" alt="">`
/** Foto de referência de cada quadro do checklist (fotos reais de apartamento novo, dos modelos da Laís). */
const AMB_SLUG: Record<string, string> = { Cozinha: 'cozinha', Lavanderia: 'lavanderia', Sala: 'sala', 'Sacada / Varanda': 'sacada', Quarto: 'quarto', Corredor: 'corredor', Banheiro: 'banheiro', Garagem: 'garagem' }
const fotoQuadro = (amb: string, q: string) => {
  const a = AMB_SLUG[amb]
  const k = /bancada/i.test(q) ? 'bancada' : /piso/i.test(q) ? 'piso' : /elétric/i.test(q) ? 'eletrica' : /porta/i.test(q) ? 'portas' : /tanque/i.test(q) ? 'tanque' : /gás/i.test(q) ? 'gas' : /churras/i.test(q) ? 'churrasqueira' : /guarda/i.test(q) ? 'guarda' : /vaso/i.test(q) ? 'vaso' : /vaga/i.test(q) ? 'vaga' : ''
  return a && k ? asset(`fotos/${a}-${k}.jpg`) : ''
}
/** Itens gerais do apartamento (entrega, medidores, medidas): entram antes dos ambientes, para não passar nada. */
const GERAL = {
  ambiente: 'Geral do apartamento',
  quadros: [
    { nome: 'Documentos e chaves', itens: ['Recebeu o manual do proprietário (uso, operação e manutenção)?', 'Recebeu as plantas e o memorial descritivo?', 'A quantidade de chaves confere com a informada?', 'As chaves abrem e trancam todas as fechaduras?', 'Recebeu controles, tags ou cartões de acesso?', 'O termo da construtora está com os dados certos (nome, torre, apto)?'] },
    { nome: 'Medidores e instalações gerais', itens: ['O hidrômetro está instalado? Anote a leitura.', 'O medidor de energia está instalado? Anote a leitura.', 'O medidor de gás está instalado? Anote a leitura.', 'O quadro de luz tem disjuntor geral e DR?', 'Os circuitos do quadro estão identificados?', 'Ao desligar o disjuntor geral, tudo desliga?', 'O registro geral de água abre e fecha?', 'Com o registro geral fechado, a água para em todos os pontos?', 'A pressão da água é boa com duas torneiras abertas?', 'O ponto de aquecimento de água está conforme o memorial?', 'O interfone fala com a portaria?', 'A campainha funciona?'] },
    { nome: 'Medidas e conformidade com a planta', itens: ['As medidas dos ambientes conferem com a planta?', 'O pé-direito confere com o memorial?', 'As portas têm a largura prevista?', 'As paredes estão no prumo, sem barriga aparente?', 'Os cantos estão no esquadro?', 'Não há degrau entre ambientes que não estava previsto?', 'Os acabamentos conferem com o memorial descritivo?', 'Tomadas, pontos de luz e de água estão onde a planta mostra?'] },
    { nome: 'Entrada e hall do andar', itens: ['A porta de entrada está sem amassados, riscos ou empeno?', 'O olho mágico e a fechadura estão em perfeito estado?', 'O número do apartamento está identificado?', 'O hall do andar está sem danos perto da porta?', 'A caixa de correio está identificada?'] },
  ],
}

/* ---------- estilo comum ---------- */
export const RDL_CSS = `
@page{size:A4;margin:0}
:root{--bg:#fff;--card:#fff;--soft:#F4F6F9;--line:#E3E6EC;--navy:#012C60;--navy2:#1F4A85;--or:#FF8216;--orl:#FFF1E4;--mut:#7A7F92;--txt:#46506A}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#d9dce3}
body{font-family:Poppins,'Segoe UI',Arial,sans-serif;color:var(--navy);font-size:8pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;background:var(--bg);padding:9mm 13mm 0;display:flex;flex-direction:column;overflow:hidden;margin:0 auto 8mm;page-break-after:always;position:relative}
.page:last-child{page-break-after:auto}
@media print{html,body{background:none}.page{margin:0}}
svg.i{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none}
.top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.top img{height:12mm}
.ttl{display:flex;align-items:center;gap:10px}
.ttl .ib{width:34px;height:34px;border-radius:10px;background:var(--navy);color:#fff;display:grid;place-items:center}
.ttl .ib svg{width:18px;height:18px}
.ttl small{display:block;font-size:6pt;letter-spacing:2.4px;color:var(--or);font-weight:600}
.ttl b{display:block;font-size:17pt;font-weight:700;letter-spacing:-.4px;line-height:1.1}
.box{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:9px 12px}
.soft{background:var(--soft);border:none}
h3{font-size:6.4pt;letter-spacing:2.2px;font-weight:600;margin-bottom:2.6mm;display:flex;align-items:center;gap:7px;text-transform:uppercase}
h3 i{width:14px;height:3px;border-radius:2px;background:var(--or);display:block}
.qh{display:flex;align-items:center;gap:8px;font-weight:600;font-size:9pt}
.qh .ib{width:24px;height:24px;border-radius:7px;background:var(--orl);color:var(--or);display:grid;place-items:center}
.qh .ib svg{width:13px;height:13px}
.fld{display:flex;align-items:flex-end;gap:6px;font-size:7pt;color:var(--mut)}
.fld b{color:var(--navy);font-weight:600;white-space:nowrap}
.fld span{flex:1;border-bottom:1px solid #C9CDD8;min-height:12px;color:var(--navy);font-size:7.6pt;padding:0 2px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:3mm 6mm}
.yn{display:inline-flex;gap:4px}
.yn i{display:inline-flex;align-items:center;gap:3px;font-style:normal;font-size:6pt;font-weight:600;border-radius:5px;padding:2px 6px;letter-spacing:.5px}
.yn .s{background:#E7EEF8;color:var(--navy)}.yn .n{background:var(--orl);color:#C25F0A}
.yn i:after{content:"";width:7px;height:7px;border-radius:50%;border:1.3px solid currentColor;display:inline-block}
.yn i.on:after{background:currentColor}
.dot{width:10px;height:10px;border-radius:50%;border:1.3px solid #9AA3B6;display:inline-block}
.dot.on{background:var(--navy);border-color:var(--navy)}.dot.no.on{background:var(--or);border-color:var(--or)}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chip{display:inline-flex;align-items:center;gap:5px;background:var(--soft);border-radius:6px;padding:3px 8px;font-size:6.6pt}
.chip svg{width:11px;height:11px;color:var(--or)}
footer{margin:auto -13mm 0;background:var(--navy);color:#fff;padding:3.6mm 13mm;display:flex;justify-content:space-between;align-items:center;position:relative;font-size:6.6pt}
footer:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--or)}
footer b{font-size:7.4pt;display:block}
footer span{opacity:.75}
footer .r{text-align:right;line-height:1.55}
footer .pg{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:6px;background:var(--or);font-weight:700;margin-left:10px;font-size:7pt}
.art{width:100%;height:auto;display:block}
`
const foot = (label: string, n?: number) => `<footer><div><b>${esc(RDL.name)}</b><span>${esc(RDL.company)} · CNPJ ${RDL.cnpj}</span></div><div class="r">${esc(label)}<br><span>${RDL.phone} · ${RDL.email}</span>${n ? `<span class="pg">${String(n).padStart(2, '0')}</span>` : ''}</div></footer>`
const shell = (title: string, pages: string[]) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${RDL_CSS}${EXTRA_CSS}</style></head><body>${pages.join('')}</body></html>`
const head = (kicker: string, title: string, icon: string) => `<div class="top"><div class="ttl"><span class="ib">${ico(icon)}</span><div><small>${esc(kicker)}</small><b>${esc(title)}</b></div></div><img src="${RDL_LOGO}" alt="RDL"></div>`
const f = (label: string, value = '') => `<div class="fld"><b>${esc(label)}</b><span>${esc(value)}</span></div>`

const EXTRA_CSS = `
/* checklist */
.ck-cover{display:flex;flex-direction:column;flex:1}
.photo{width:100%;height:118mm;object-fit:cover;border-radius:18px;display:block;margin-top:7mm}
.ck-cover .logo{height:15mm;width:auto;align-self:flex-start}

.ck-cover .kick{margin-top:7mm;font-size:7pt;letter-spacing:3px;color:var(--or);font-weight:600}
.ck-cover h1{font-size:30pt;font-weight:700;letter-spacing:-1px;line-height:1.05;margin-top:2mm}
.ck-cover h1 span{color:var(--or)}
.ck-cover .sub{margin-top:3mm;color:var(--txt);font-size:8.6pt;max-width:150mm}
.ck-cover .who{margin-top:auto;margin-bottom:6mm;width:100%;text-align:left}
.q.wp{display:grid;grid-template-columns:30mm 1fr;gap:0 4mm}
.q.wp .qimg{grid-row:span 3;width:30mm;height:30mm;object-fit:cover;border-radius:9px;display:block}
.q.wp .qcol{min-width:0}
.kit{display:grid;grid-template-columns:repeat(4,1fr);gap:2.5mm}
.kit .box{padding:7px 9px}
.kit .qh{font-size:8pt}
.kit small{display:block;color:var(--mut);font-size:6.4pt;margin:2px 0 6px 32px}
.how{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}
.how .box{position:relative;padding:10px}
.how .n{position:absolute;top:8px;right:10px;color:var(--or);font-weight:700;font-size:11pt}
.how p{font-size:6.8pt;color:var(--txt);margin-top:6px;line-height:1.4}
.how p b{color:var(--navy)}
.q{margin-top:3mm}
.q table{width:100%;border-collapse:collapse;margin-top:2mm}
.q th{font-size:5.8pt;letter-spacing:1px;color:var(--mut);font-weight:600;text-align:center;width:9mm;padding-bottom:1mm}
.q td{font-size:7pt;padding:1.15mm 0;border-bottom:1px solid #EFEDE8;vertical-align:middle}
.q td.c{text-align:center}
.q td.t{color:var(--txt)}
.q td.t:before{content:"";display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--or);margin:0 6px 1px 0}
.q .ob{color:var(--mut);font-size:6.4pt;font-style:italic;display:block;margin-left:10px}
.qf{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2mm}
.qf .fld{flex:1}
.qf .ap{display:flex;align-items:center;gap:6px;font-size:7pt;font-weight:600}
.hdr{display:flex;gap:4mm;align-items:center;margin-top:4mm;background:var(--soft);border-radius:10px;padding:6px 10px}
.hdr .fld{flex:1}.hdr .pgx{font-size:6.4pt;color:var(--mut);white-space:nowrap}
.notes .ln{border-bottom:1px solid #D8DCE4;height:7mm}
.sum table{width:100%;border-collapse:collapse}
.sum th{font-size:5.8pt;letter-spacing:1.2px;color:var(--mut);text-align:left;font-weight:600;padding:0 0 2mm}
.sum td{border-bottom:1px solid #EFEDE8;padding:2mm 0;font-size:7.4pt}
.sum td.blank{height:7.2mm}
.sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm}
.sigs .box{height:24mm;display:flex;flex-direction:column;justify-content:flex-end;text-align:center}
.sigs .box b{font-size:6.2pt;letter-spacing:1.4px;border-top:1px solid #C9CDD8;padding-top:2mm;color:var(--mut)}
.sigs .box span{font-size:7pt}
/* relatório */
.rl-cover h1{font-size:28pt;font-weight:700;letter-spacing:-1px;margin-top:5mm;line-height:1.05}
.rl-cover h1 span{color:var(--or)}
.rl-cover .art{margin-top:5mm;border-radius:20px}
.res{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.res .opt{border-radius:10px;padding:8px 10px;display:flex;gap:8px;align-items:center}
.res .ok{background:#E7EEF8}.res .rp{background:var(--orl)}
.res .opt b{display:block;font-size:8.2pt}.res .opt small{font-size:6.4pt;color:var(--mut)}
.res .opt.on{outline:2px solid var(--navy)}.res .rp.on{outline-color:var(--or)}
.rep table{width:100%;border-collapse:collapse}
.rep th{font-size:5.8pt;letter-spacing:1px;color:var(--mut);text-align:left;font-weight:600;padding-bottom:2mm}
.rep td{border-bottom:1px solid #EFEDE8;padding:1.7mm 1.5mm 1.7mm 0;font-size:7pt;vertical-align:top}
.rep td.n{color:var(--or);font-weight:700;width:7mm}
.rep tr.blank td{height:8mm}
.photos{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.ph{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:6px}
.ph .img{height:58mm;border-radius:9px;background:var(--soft);display:grid;place-items:center;color:var(--mut);font-size:6.6pt;overflow:hidden}
.ph .img img{width:100%;height:100%;object-fit:cover}
.ph .cap{display:flex;gap:6px;align-items:center;margin-top:5px;font-size:6.8pt}
.ph .cap em{font-style:normal;background:var(--or);color:#fff;border-radius:5px;padding:1px 6px;font-weight:700;font-size:6.2pt}
.next{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.next .box{padding:9px}
.next p{font-size:6.6pt;color:var(--txt);margin-top:4px}
.warr{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.warr .box b{font-size:8pt;display:block;margin-bottom:2px}
.warr p{font-size:6.6pt;color:var(--txt)}
/* orçamento */
.oc-hero{text-align:center;margin-top:3mm}
.oc-hero .pill{display:inline-flex;align-items:center;gap:6px;background:var(--navy);color:#fff;border-radius:7px;padding:4px 11px;font-size:6.4pt;letter-spacing:1.2px;font-weight:500}
.oc-hero .pill i{width:5px;height:5px;border-radius:1.5px;background:var(--or);display:block}
.oc-hero h1{font-size:23pt;line-height:1.1;font-weight:700;margin-top:3mm;letter-spacing:-.8px}
.oc-hero h1 span{color:var(--or)}
.oc-who{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-top:5mm}
.oc-who .box{padding:7px 10px}
.oc-who small{display:block;font-size:5.8pt;letter-spacing:1.4px;color:var(--mut);font-weight:600}
.oc-who b{font-size:8.4pt}
.price{margin-top:5mm;background:var(--navy);color:#fff;border-radius:16px;display:grid;grid-template-columns:1.1fr 1px 1fr;align-items:center;padding:5mm 9mm;gap:8mm}
.price .k{font-size:6.6pt;letter-spacing:2.5px;opacity:.75;display:flex;align-items:center;gap:8px}
.price .kc{width:26px;height:26px;border-radius:7px;background:var(--or);display:grid;place-items:center;color:#fff}
.price .v{font-size:34pt;font-weight:700;line-height:1;margin:3mm 0 1.5mm;letter-spacing:-1.2px}
.price .v small{font-size:11pt;font-weight:500;margin-right:4px;vertical-align:17pt;letter-spacing:0}
.price .s{font-size:6.8pt;color:var(--or);font-weight:600;letter-spacing:1px}
.price .div{height:100%;background:rgba(255,255,255,.15)}
.price ul{list-style:none}
.price li{display:flex;justify-content:space-between;gap:9px;font-size:7.6pt;padding:2mm 0;border-bottom:1px solid rgba(255,255,255,.1)}
.price li:last-child{border:none}
.price li b{white-space:nowrap}
.price li.on{color:var(--or)}
.io{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:5mm}
.io .hd{display:flex;align-items:center;gap:8px;margin-bottom:7px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.io .hd .ic{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;color:#fff}
.io .yes .ic{background:var(--or)}.io .no .ic{background:#B9BCC7}
.io .hd b{font-size:9pt}
.io .it{display:flex;gap:8px;align-items:center;font-size:7.4pt;margin-bottom:5px}
.io .it .ib{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;flex:none}
.io .yes .ib{background:var(--orl);color:var(--or)}.io .no .it{color:var(--mut)}.io .no .ib{background:var(--soft);color:#9A9EAC}
.io svg{width:12px;height:12px}
.conds{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px}
.cnd{display:flex;gap:8px;font-size:7pt;color:var(--txt);align-items:flex-start;line-height:1.32}
.cnd .ib{width:22px;height:22px;border-radius:6px;background:var(--soft);display:grid;place-items:center;color:var(--navy);flex:none}
.cnd svg{width:12px;height:12px}.cnd b{color:var(--navy);display:block}
.accept{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.accept .box{height:22mm;display:flex;flex-direction:column;justify-content:flex-end}
.accept b{font-size:6.2pt;letter-spacing:1.4px;color:var(--mut);border-top:1px solid #C9CDD8;padding-top:2mm}
`

/* ================= CHECKLIST DE VISTORIA ================= */

export type Resp = 'sim' | 'nao' | undefined
export interface ChecklistData {
  owner?: string // proprietário
  unit?: string // torre e apto
  date?: string
  by?: string // feito por
  rooms?: string[] // ambientes deste apê (vazio = todos, para imprimir o kit)
  answer?: (room: string, quadro: string, item: string) => { r: Resp; obs?: string }
}

const ROW_MM = 5.15
const QUADRO_MM = 22
const PAGE_MM = 236

function quadroHtml(room: string, amb: string, q: { nome: string; itens: string[] }, d: ChecklistData) {
  let sim = 0
  let nao = 0
  const rows = q.itens
    .map((t) => {
      const a = d.answer?.(room, q.nome, t)
      if (a?.r === 'sim') sim++
      if (a?.r === 'nao') nao++
      return `<tr><td class="t">${esc(t)}${a?.obs ? `<span class="ob">${esc(a.obs)}</span>` : ''}</td><td class="c"><span class="dot ${a?.r === 'sim' ? 'on' : ''}"></span></td><td class="c"><span class="dot no ${a?.r === 'nao' ? 'on' : ''}"></span></td></tr>`
    })
    .join('')
  const answered = sim + nao === q.itens.length && q.itens.length > 0
  const ok = answered ? nao === 0 : undefined
  const ft = fotoQuadro(amb, q.nome)
  const body = `<div class="qh"><span class="ib">${ico(QUADRO_ICON(q.nome))}</span>${esc(q.nome)}<span style="margin-left:auto;font-size:6pt;color:var(--mut);font-weight:500">${q.itens.length} itens</span></div>
<table><thead><tr><th style="text-align:left;width:auto"></th><th>SIM</th><th>NÃO</th></tr></thead><tbody>${rows}</tbody></table>
<div class="qf">${f('Observações')}<span class="ap">Aprovado? <span class="yn"><i class="s ${ok === true ? 'on' : ''}">SIM</i><i class="n ${ok === false ? 'on' : ''}">NÃO</i></span></span></div>`
  return ft ? `<div class="box q wp"><img class="qimg" src="${ft}" alt=""><div class="qcol">${body}</div></div>` : `<div class="box q">${body}</div>`
}

export function checklistHtml(d: ChecklistData = {}): string {
  const all = [GERAL, ...VISTORIA_CHECKLIST]
  const rooms = [GERAL.ambiente, ...(d.rooms?.length ? d.rooms : VISTORIA_CHECKLIST.map((a) => a.ambiente))]
  const pages: string[] = []
  const blank = !d.answer
  let n = 1
  // capa
  const total = rooms.reduce((n2, r) => n2 + (all.find((x) => x.ambiente === r.replace(/\s+\d+$/, '') || r.startsWith(x.ambiente))?.quadros.reduce((m, q) => m + q.itens.length, 0) ?? 0), 0)
  pages.push(`<div class="page"><div class="ck-cover"><img class="logo" src="${RDL_LOGO}" alt="RDL">${ART_CHECKLIST()}
<div class="kick">CHECKLIST DE VISTORIA</div><h1>Vistoria de <span>entrega de chaves</span></h1>
<p class="sub">Conferência completa do apartamento novo, item por item e ambiente por ambiente, antes de assinar o recebimento com a construtora.</p>
<div class="chips" style="margin-top:4mm">${[['list', `${total} itens verificados`], ['building', `${rooms.length} ambientes e itens gerais`], ['camera', 'foto de referência em cada quadro'], ['shield', 'engenheiro com ART no CREA-SP']].map(([i, t]) => `<span class="chip">${ico(i)}${t}</span>`).join('')}</div>
<div class="who box"><div class="grid2">${f('Feito por', d.by || RDL.name)}${f('Data', dateBR(d.date))}${f('Proprietário(a)', d.owner)}${f('Unidade (torre e apto)', d.unit)}</div></div></div>${foot('Checklist de vistoria')}</div>`)
  // como usar
  if (blank)
    pages.push(`<div class="page">${head('CHECKLIST DE VISTORIA', 'Como usar', 'list')}
<div class="box" style="margin-top:5mm"><h3><i></i>Monte o seu kit</h3><p style="font-size:7pt;color:var(--txt);margin-bottom:3mm">Conte quantos ambientes de cada tipo o apartamento tem e anote em “Quantos?”. Imprima as folhas de cada tipo uma vez por ambiente. A capa, os itens gerais e o resumo vão sempre, uma vez só.</p>
<div class="kit">${VISTORIA_CHECKLIST.map((a) => `<div class="box"><div class="qh"><span class="ib">${ico(AMB_ICON[a.ambiente] ?? 'building')}</span>${esc(a.ambiente)}</div><small>${a.quadros.reduce((s, q) => s + q.itens.length, 0)} itens</small>${f('Quantos?')}</div>`).join('')}</div>
<p style="font-size:6.6pt;color:var(--mut);margin-top:3mm">Tem lavabo, closet ou escritório? Use a folha mais parecida (lavabo: banheiro; closet e escritório: quarto) e escreva o nome em “Nome do ambiente”. Item que o ambiente não tem: risque a linha.</p></div>
<div class="box" style="margin-top:4mm"><h3><i></i>Como fazer a vistoria</h3><div class="chips" style="margin-bottom:3mm"><span class="chip">${ico('drop')}Água ligada</span><span class="chip">${ico('bolt')}Energia ligada</span><span class="chip">${ico('clock')}De 45 min a 2 h</span><span class="chip">${ico('user')}Com o responsável da construtora</span></div>
<div class="how">${[
      ['plan', 'Imprima as folhas de cada ambiente que o apê tem, uma vez por ambiente. Em <b>“Nome do ambiente”</b>, dê um nome a cada um.'],
      ['check', 'Marque <b>sim</b> ou <b>não</b> em cada item. Achou um problema? Fotografe, cole um adesivo no local e anote em <b>observações</b>.'],
      ['shield', 'No fim de cada quadro, marque se aquela parte foi <b>aprovada</b>. O ambiente só é aprovado se todos os quadros foram aprovados.'],
      ['send', 'Envie as anotações, fotos e vídeos à <b>construtora</b>. Ela faz os reparos e marca uma <b>nova vistoria</b>.'],
    ]
      .map(([ic, t], i) => `<div class="box"><span class="qh"><span class="ib">${ico(ic)}</span></span><span class="n">${i + 1}</span><p>${t}</p></div>`)
      .join('')}</div></div>
<div class="box" style="margin-top:4mm"><h3><i></i>Leve com você</h3><div class="chips">${['Bolinhas de gude', 'Recipiente com água', 'Cabo de vassoura ou haste', 'Multímetro ou testador de tomadas', 'Régua com nível', 'Lâmpada', 'Espelho portátil', 'Trena', 'Adesivos', 'Celular (fotos e vídeos)', 'Prancheta e caneta', 'Memorial descritivo e plantas'].map((t) => `<span class="chip">${ico('check')}${esc(t)}</span>`).join('')}</div></div>
${foot('Checklist de vistoria · como usar', ++n)}</div>`)
  // folhas por ambiente (quebra automática de página)
  for (const room of rooms) {
    const a = all.find((x) => x.ambiente === room.replace(/\s+\d+$/, '')) ?? all.find((x) => room.startsWith(x.ambiente)) ?? all.find((x) => x.ambiente === (/lavabo/i.test(room) ? 'Banheiro' : /escrit|closet/i.test(room) ? 'Quarto' : ''))
    if (!a) continue
    const chunks: string[][] = [[]]
    let used = 0
    for (const q of a.quadros) {
      const h = QUADRO_MM + q.itens.length * ROW_MM
      if (used + h > PAGE_MM && chunks[chunks.length - 1].length) {
        chunks.push([])
        used = 0
      }
      chunks[chunks.length - 1].push(quadroHtml(room, a.ambiente, q, d))
      used += h
    }
    // anotações no espaço que sobra da última folha
    const free = PAGE_MM - used
    if (free > 40) chunks[chunks.length - 1].push(`<div class="box q notes" style="flex:1"><div class="qh"><span class="ib">${ico('edit')}</span>Anotações do ambiente</div>${Array.from({ length: Math.floor((free - 18) / 7) }, () => '<div class="ln"></div>').join('')}</div>`)
    chunks.forEach((c, i) => {
      pages.push(`<div class="page">${head('CHECKLIST DE VISTORIA', room, AMB_ICON[a.ambiente] ?? 'building')}
<div class="hdr">${f('Nome do ambiente', room !== a.ambiente ? room : '')}${f('Unidade', d.unit)}<span class="pgx">folha ${i + 1} de ${chunks.length}</span></div>
<div style="display:flex;flex-direction:column;flex:1">${c.join('')}</div>${foot(`Checklist de vistoria · ${room}`, ++n)}</div>`)
    })
  }
  // resumo
  const sumRows = d.answer
    ? rooms
        .map((room) => {
          const a = all.find((x) => room.startsWith(x.ambiente)) ?? all.find((x) => x.ambiente === (/lavabo/i.test(room) ? 'Banheiro' : /escrit|closet/i.test(room) ? 'Quarto' : ''))
          if (!a) return ''
          let nao = 0
          let total = 0
          a.quadros.forEach((q) => q.itens.forEach((t) => (total++, d.answer!(room, q.nome, t).r === 'nao' && nao++)))
          return `<tr><td>${esc(room)}</td><td><span class="yn"><i class="s ${nao === 0 ? 'on' : ''}">SIM</i><i class="n ${nao > 0 ? 'on' : ''}">NÃO</i></span></td><td>${nao} de ${total}</td></tr>`
        })
        .join('')
    : Array.from({ length: 16 }, () => '<tr><td class="blank"></td><td><span class="yn"><i class="s">SIM</i><i class="n">NÃO</i></span></td><td></td></tr>').join('')
  pages.push(`<div class="page">${head('FIM DA VISTORIA', 'Resumo da vistoria', 'list')}
<div class="hdr">${f('Unidade', d.unit)}${f('Data', dateBR(d.date))}</div>
<p style="font-size:6.8pt;color:var(--txt);margin:3mm 0">Uma linha por ambiente. O ambiente só é aprovado se todos os quadros dele foram aprovados.</p>
<div class="box sum"><table><thead><tr><th>AMBIENTE</th><th style="width:34mm">APROVADO?</th><th style="width:30mm">ITENS COM NÃO</th></tr></thead><tbody>${sumRows}</tbody></table></div>
<div class="grid2" style="margin-top:4mm">${f('Lista enviada à construtora em')}${f('Nova vistoria marcada para')}</div>
<div class="sigs" style="margin-top:5mm;grid-template-columns:1fr 1fr"><div class="box"><span>${esc(RDL.name)}</span><b>RESPONSÁVEL TÉCNICO · CREA ${esc(RDL.crea)}</b></div><div class="box"><span>${esc(d.owner)}</span><b>PROPRIETÁRIO(A)</b></div></div>
${foot('Checklist de vistoria · resumo', ++n)}</div>`)
  return shell(`Checklist de vistoria${d.unit ? ` · ${d.unit}` : ''}`, pages)
}

/* ================= RELATÓRIO (LAUDO) DE VISTORIA ================= */

export type Gravidade = 'leve' | 'media' | 'grave'
export const GRAVIDADE: Record<Gravidade, { label: string; text: string }> = {
  leve: { label: 'Leve', text: 'Acabamento ou estética. Não atrapalha o uso (ex.: risco, mancha, falha de rejunte).' },
  media: { label: 'Média', text: 'Atrapalha o uso ou o funcionamento, ou pode piorar com o tempo (ex.: porta raspando, ralo empoçando).' },
  grave: { label: 'Grave', text: 'Risco à segurança, à saúde ou às instalações (ex.: tomada invertida, vazamento, trinca).' },
}
export interface LaudoFoto {
  url: string
  w?: number
  h?: number
  legenda?: string
  ambiente?: string
}
export interface LaudoItem {
  room: string
  item: string
  found: string
  gravidade?: Gravidade
  photos?: LaudoFoto[]
  photo?: string // compatível com a versão anterior (uma foto só)
  fixed?: boolean
}
export type Teste = 'ok' | 'falha' | 'na'
export const TESTES = [
  'Tomadas (tensão e polaridade)',
  'Interruptores e pontos de luz',
  'Quadro de luz (disjuntores e DR)',
  'Ponto do chuveiro',
  'Interfone e campainha',
  'Torneiras e registros (vazão e vazamento)',
  'Ralos e caimento do piso',
  'Vaso sanitário (descarga e vedação)',
  'Sifões e flexíveis (vazamento)',
  'Portas (abertura, fechadura, batente)',
  'Janelas e esquadrias (abertura, vedação, trinco)',
  'Pisos (som cavo e desnível)',
  'Paredes e tetos (fissuras, prumo, acabamento)',
  'Revestimentos cerâmicos (som cavo, rejunte)',
  'Ponto de gás (registro e vedação)',
  'Área do box (escoamento e vedação)',
]
export const NORMAS: [string, string][] = [
  ['ABNT NBR 13752', 'Perícias de engenharia na construção civil'],
  ['ABNT NBR 15575', 'Edificações habitacionais: desempenho'],
  ['ABNT NBR 14037', 'Manual de uso, operação e manutenção das edificações'],
  ['ABNT NBR 17170', 'Edificações: garantias, prazos recomendados e diretrizes'],
  ['ABNT NBR 5674', 'Manutenção de edificações'],
  ['ABNT NBR 16747', 'Inspeção predial (referência de método)'],
  ['Lei 8.078/1990', 'Código de Defesa do Consumidor, arts. 12, 18, 26 e 27'],
  ['Lei 10.406/2002', 'Código Civil, art. 618 (solidez e segurança da obra)'],
]
export interface LaudoData {
  owner?: string
  development?: string // empreendimento
  builder?: string // construtora
  address?: string
  unit?: string
  plan?: string // planta
  date?: string
  time?: string // início e fim
  companion?: string // acompanhante da construtora
  art?: string // nº da ART
  items?: LaudoItem[]
  rooms?: { room: string; checked: number; problems: number }[]
  tests?: Record<string, Teste>
  notChecked?: string[] // itens não verificados (sem água, sem luz, sem acesso…)
  general?: LaudoFoto[] // fotos gerais dos ambientes
  revisitDate?: string
  notes?: string
  fotosLink?: string // pasta com todas as fotos do dia (Google Drive etc.)
}

const LAUDO_CSS = `
.lc-top{display:flex;justify-content:space-between;align-items:center}
.lc-top img{height:15mm}
.lc-top .tag{font-size:6.4pt;letter-spacing:2px;font-weight:600;color:var(--navy);background:var(--soft);border-radius:7px;padding:4px 10px}
.lc-art .photo{height:112mm}
.lc-k{margin-top:8mm;font-size:7pt;letter-spacing:3px;color:var(--or);font-weight:600}
.lc h1{font-size:31pt;font-weight:700;letter-spacing:-1.2px;line-height:1.02;margin-top:2mm}
.lc h1 span{color:var(--or)}
.lc .sub{margin-top:3mm;color:var(--txt);font-size:8.8pt;max-width:150mm}
.lc-feat{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:6mm}
.lc-feat p{font-size:6.8pt;color:var(--txt);margin-top:4px;line-height:1.35}
.lc footer{margin-top:0}
.lc-strip{margin-top:auto;margin-bottom:6mm;display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}
.lc-strip .box{padding:8px 10px}
.lc-strip small{display:block;font-size:5.8pt;letter-spacing:1.4px;color:var(--mut);font-weight:600}
.lc-strip b{font-size:8.6pt;display:block;min-height:12px;border-bottom:1px solid transparent}
.lc-strip .blank b{border-bottom-color:#C9CDD8}
.res3{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.res3 .opt{border-radius:10px;padding:8px 10px;display:flex;gap:8px;align-items:center;background:var(--soft)}
.res3 .opt b{display:block;font-size:8.2pt}.res3 .opt small{font-size:6.2pt;color:var(--mut);line-height:1.3;display:block}
.res3 .opt.on{background:#E7EEF8;outline:2px solid var(--navy)}
.res3 .opt.rs.on{background:var(--orl);outline-color:var(--or)}
.res3 .opt.rp.on{background:var(--orl);outline-color:#C25F0A}
.cnt{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-top:3mm}
.cnt div{background:var(--soft);border-radius:10px;padding:7px 10px}
.cnt b{font-size:15pt;display:block;line-height:1.1}
.cnt small{font-size:6.2pt;color:var(--mut)}
.cnt .g b{color:#C25F0A}
.toc{display:grid;grid-template-columns:1fr 1fr;gap:1.6mm 8mm}
.toc div{display:flex;gap:8px;align-items:center;font-size:7.4pt;border-bottom:1px dashed #E1E3EA;padding-bottom:1.4mm}
.toc em{font-style:normal;color:var(--or);font-weight:700;width:6mm}
.grav{display:inline-flex;align-items:center;gap:4px;border-radius:5px;padding:1px 6px;font-size:6pt;font-weight:700;letter-spacing:.4px;white-space:nowrap}
.grav.leve{background:#E7EEF8;color:var(--navy)}
.grav.media{background:var(--orl);color:#C25F0A}
.grav.grave{background:var(--or);color:#fff}
.legend{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.legend .box{padding:8px 10px}
.legend p{font-size:6.6pt;color:var(--txt);margin-top:4px;line-height:1.35}
.nrm{display:grid;grid-template-columns:1fr 1fr;gap:1.8mm 6mm}
.nrm div{font-size:6.8pt;color:var(--txt);display:flex;gap:6px;line-height:1.3}
.nrm b{color:var(--navy);white-space:nowrap;min-width:25mm}
.tst table{width:100%;border-collapse:collapse}
.tst th{font-size:5.8pt;letter-spacing:1px;color:var(--mut);font-weight:600;text-align:center;padding-bottom:1.5mm;width:12mm}
.tst th:first-child{text-align:left;width:auto}
.tst td{font-size:7pt;padding:1.25mm 0;border-bottom:1px solid #EFEDE8}
.tst td.c{text-align:center}
.lim{display:flex;gap:8px;align-items:flex-start;font-size:6.8pt;color:var(--txt);line-height:1.4}
.lim svg{margin-top:1px;color:var(--or)}
/* fotos: horizontais (2 por linha) e verticais (3 por linha), cada uma no seu formato */
.prow{display:grid;gap:4mm;margin-top:3.5mm}
.prow.h{grid-template-columns:1fr 1fr}
.prow.v{grid-template-columns:1fr 1fr 1fr}
.pf{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:5px;break-inside:avoid}
.pf .fr{position:relative;border-radius:9px;overflow:hidden;background:var(--soft);display:grid;place-items:center;color:var(--mut);font-size:6.6pt}
.prow.h .fr{height:57mm}
.prow.v .fr{height:71mm}
.pf .fr .bg{position:absolute;inset:-12px;background-size:cover;background-position:center;filter:blur(14px) brightness(.92);opacity:.55}
.pf .fr img{position:relative;width:100%;height:100%;object-fit:contain;display:block}
.pf .fr .ph0{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
.pf .fr .ph0 svg{width:20px;height:20px;color:#AEB6C6}
.pf .cap{height:9mm;display:flex;flex-direction:column;justify-content:center;gap:1px;padding:1.2mm 2px 0;font-size:6.6pt;line-height:1.25;overflow:hidden}
.pf .cap .l1{display:flex;gap:5px;align-items:center;white-space:nowrap;overflow:hidden}
.pf .cap em{font-style:normal;background:var(--navy);color:#fff;border-radius:5px;padding:1px 6px;font-weight:700;font-size:6pt;flex:none}
.pf .cap .l2{color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf .cap .fld{font-size:6.4pt}
.pf.empty{border-style:dashed}
.fmt{display:flex;gap:10px;align-items:center;font-size:6.6pt;color:var(--mut);margin-top:2.5mm}
.fmt i{display:inline-block;border:1.4px solid #AEB6C6;border-radius:2px;vertical-align:middle;margin-right:4px}
.fmt .ih{width:13px;height:9px}.fmt .iv{width:9px;height:13px}
.decl{font-size:7pt;color:var(--txt);line-height:1.5}
.decl b{color:var(--navy)}
`

const fotoOrient = (f: LaudoFoto) => (f.w && f.h && f.h > f.w * 1.05 ? 'v' : 'h')
const gravChip = (g?: Gravidade) => (g ? `<span class="grav ${g}">${GRAVIDADE[g].label.toUpperCase()}</span>` : '')

/** Monta as linhas de fotos: horizontais de 2 em 2, verticais de 3 em 3, na ordem em que aparecem. */
function linhasDeFotos<T extends { f: LaudoFoto }>(fotos: T[]) {
  const rows: { o: 'h' | 'v'; fs: T[] }[] = []
  const open: Record<'h' | 'v', T[] | null> = { h: null, v: null }
  for (const x of fotos) {
    const o = fotoOrient(x.f)
    if (!open[o]) {
      open[o] = []
      rows.push({ o, fs: open[o]! })
    }
    open[o]!.push(x)
    if (open[o]!.length === (o === 'h' ? 2 : 3)) open[o] = null
  }
  return rows
}
const ROW_H = { h: 71, v: 85 } // mm de cada linha (foto + legenda + espaço)
const FOTO_AREA = 240

export function laudoHtml(d: LaudoData = {}): string {
  const items = d.items ?? []
  const blank = !d.items
  const grav = { leve: 0, media: 0, grave: 0 }
  items.forEach((it) => (grav[it.gravidade ?? 'media'] += 1))
  const result = blank ? undefined : items.length === 0 ? 'ok' : grav.grave ? 'rp' : 'rs'
  const pages: string[] = []
  let n = 1

  // numeração das fotos: primeiro as dos itens (na ordem da lista), depois as gerais
  type F = { f: LaudoFoto; k: number; titulo: string; sub: string; g?: Gravidade; item?: number }
  const fotos: F[] = []
  items.forEach((it, i) => {
    const list = it.photos?.length ? it.photos : it.photo ? [{ url: it.photo }] : []
    list.forEach((f) => fotos.push({ f, k: 0, titulo: `${it.room}`, sub: f.legenda || `${it.item}: ${it.found}`, g: it.gravidade, item: i + 1 }))
  })
  ;(d.general ?? []).forEach((f) => fotos.push({ f, k: 0, titulo: f.ambiente || 'vista geral', sub: f.legenda || 'vista geral do ambiente' }))
  // as fotos são numeradas na ordem em que aparecem nas folhas (horizontais e verticais se agrupam)
  const linhas = linhasDeFotos(fotos)
  let kk = 0
  linhas.forEach((r) => r.fs.forEach((x) => (x.k = ++kk)))
  const fotosDoItem: number[][] = items.map((_, i) => fotos.filter((x) => x.item === i + 1).map((x) => x.k).sort((a, b) => a - b))

  /* 1. capa */
  pages.push(`<div class="page lc"><div class="lc-top"><img src="${RDL_LOGO}" alt="RDL"><span class="tag">ENTREGA DE CHAVES · APARTAMENTO NOVO</span></div>
<div class="lc-art">${ART_LAUDO()}</div>
<div class="lc-k">LAUDO TÉCNICO</div><h1>Relatório de <span>vistoria</span></h1>
<p class="sub">Estado de conservação, funcionamento e acabamentos do apartamento na entrega das chaves, com os vícios aparentes encontrados e o registro fotográfico.</p>
<div class="lc-feat">${[
    ['search', 'Vistoria completa', 'Ambiente por ambiente, com testes de funcionamento'],
    ['camera', 'Registro fotográfico', 'Cada item para reparo com foto numerada'],
    ['shield', 'ART no CREA-SP', 'Laudo assinado por engenheiro habilitado'],
  ]
    .map(([ic, t, p]) => `<div class="box"><div class="qh"><span class="ib">${ico(ic)}</span>${t}</div><p>${p}</p></div>`)
    .join('')}</div>
<div class="lc-strip">${[
    ['PROPRIETÁRIO(A)', d.owner],
    ['UNIDADE', d.unit],
    ['DATA DA VISTORIA', dateBR(d.date)],
    ['RESULTADO', result ? { ok: 'Aprovada', rs: 'Com ressalvas', rp: 'Reprovada' }[result] : ''],
  ]
    .map(([k, v]) => `<div class="box ${v ? '' : 'blank'}"><small>${k}</small><b>${esc(v)}</b></div>`)
    .join('')}</div>${foot('Laudo de vistoria', n)}</div>`)

  /* 2. identificação e resultado */
  const toc = ['Identificação e resultado', 'A vistoria: objetivo e método', 'Normas e referências', 'Resumo por ambiente', 'Testes de funcionamento', 'Itens para reparo', 'Registro fotográfico', 'Itens não verificados', 'Conclusão e assinaturas']
  pages.push(`<div class="page">${head('LAUDO DE VISTORIA', 'Identificação e resultado', 'doc')}
<div class="box" style="margin-top:4mm"><h3><i></i>Imóvel e proprietário</h3><div class="grid2">${f('Proprietário(a)', d.owner)}${f('Empreendimento', d.development)}${f('Construtora', d.builder)}${f('Endereço', d.address)}${f('Unidade (torre e apto)', d.unit)}${f('Planta', d.plan)}${f('Data da vistoria', dateBR(d.date))}${f('Início e fim', d.time)}${f('Acompanhante da construtora', d.companion)}${f('Nova vistoria em', dateBR(d.revisitDate))}</div></div>
<div class="box" style="margin-top:3mm"><h3><i></i>Responsável técnico</h3><div class="grid2">${f('Nome', RDL.name)}${f('Título', 'Engenheiro')}${f('CREA-SP nº', RDL.crea)}${f('ART nº', d.art)}${f('Empresa', RDL.company)}${f('CNPJ', RDL.cnpj)}</div></div>
<div class="box" style="margin-top:3mm"><h3><i></i>Resultado da vistoria</h3><div class="res3">
<div class="opt ok ${result === 'ok' ? 'on' : ''}"><span class="dot ${result === 'ok' ? 'on' : ''}"></span><span><b>Aprovada</b><small>Nenhum item para reparo</small></span></div>
<div class="opt rs ${result === 'rs' ? 'on' : ''}"><span class="dot no ${result === 'rs' ? 'on' : ''}"></span><span><b>Com ressalvas</b><small>Itens leves ou médios para a construtora reparar</small></span></div>
<div class="opt rp ${result === 'rp' ? 'on' : ''}"><span class="dot no ${result === 'rp' ? 'on' : ''}"></span><span><b>Reprovada</b><small>Há item grave: reparar antes de receber</small></span></div></div>
<div class="cnt"><div><b>${blank ? '&nbsp;' : items.length}</b><small>itens para reparo</small></div><div><b>${blank ? '&nbsp;' : grav.leve}</b><small>leves</small></div><div><b>${blank ? '&nbsp;' : grav.media}</b><small>médios</small></div><div class="g"><b>${blank ? '&nbsp;' : grav.grave}</b><small>graves</small></div></div></div>
<div class="box" style="margin-top:3mm;flex:1"><h3><i></i>O que tem neste laudo</h3><div class="toc">${toc.map((t, i) => `<div><em>${String(i + 1).padStart(2, '0')}</em>${t}</div>`).join('')}</div></div>
<div style="height:3mm"></div>${foot('Laudo de vistoria · identificação', ++n)}</div>`)

  /* 3. a vistoria + normas */
  pages.push(`<div class="page">${head('LAUDO DE VISTORIA', 'A vistoria', 'search')}
<div class="box" style="margin-top:4mm"><h3><i></i>Objetivo</h3><p style="font-size:7.2pt;color:var(--txt)">Verificar o estado de conservação, o funcionamento e os acabamentos do apartamento na entrega das chaves e apontar os <b>vícios aparentes</b>, para que a construtora faça os reparos sem custo para o proprietário, conforme o Código de Defesa do Consumidor.</p></div>
<div class="box" style="margin-top:3mm"><h3><i></i>Como foi feita</h3><p style="font-size:7.2pt;color:var(--txt)">Ambiente por ambiente, com o checklist de vistoria da RDL, testes simples de funcionamento e registro em fotos e vídeos. Os locais com problema foram marcados com adesivos. Inspeção visual e com instrumentos portáteis, sem ensaios destrutivos.</p>
<div class="grid2" style="margin-top:3mm"><div><h3 style="margin-top:1mm"><i></i>Condições</h3><div class="chips"><span class="chip">${ico('drop')}Água ligada</span><span class="chip">${ico('bolt')}Energia ligada</span><span class="chip">${ico('user')}Acompanhada pela construtora</span><span class="chip">${ico('sun')}Luz natural e artificial</span></div></div><div><h3 style="margin-top:1mm"><i></i>Documentos consultados</h3><div class="chips"><span class="chip">${ico('doc')}Memorial descritivo</span><span class="chip">${ico('doc')}Manual do proprietário</span><span class="chip">${ico('plan')}Plantas do imóvel</span><span class="chip">${ico('sign')}Contrato de compra</span></div></div></div>
<h3 style="margin-top:3mm"><i></i>Ferramentas usadas</h3><div class="chips">${['Trena', 'Régua com nível', 'Multímetro', 'Testador de tomadas', 'Bolinhas de gude', 'Recipiente com água', 'Lâmpada', 'Espelho portátil', 'Haste para som cavo', 'Adesivos', 'Celular (fotos e vídeos)'].map((t) => `<span class="chip">${ico('tool')}${esc(t)}</span>`).join('')}</div></div>
<div class="box" style="margin-top:3mm"><h3><i></i>Gravidade dos itens</h3><div class="legend">${(Object.keys(GRAVIDADE) as Gravidade[]).map((g) => `<div class="box soft">${gravChip(g)}<p>${GRAVIDADE[g].text}</p></div>`).join('')}</div></div>
<div class="box" style="margin-top:3mm"><h3><i></i>Normas e referências</h3><div class="nrm">${NORMAS.map(([a, b]) => `<div><b>${a}</b>${b}</div>`).join('')}</div></div>
<div class="box soft" style="margin-top:3mm"><div class="lim">${ico('eye')}<span><b style="color:var(--navy)">Limites desta vistoria.</b> Vistoria visual e de funcionamento, feita na data indicada, sem quebrar ou abrir pisos, paredes e forros. Vícios ocultos podem não aparecer nela e seguem as garantias da construtora. Áreas comuns do condomínio não fazem parte deste laudo.</span></div></div>
<div style="flex:1"></div>${foot('Laudo de vistoria · método e normas', ++n)}</div>`)

  /* 4. resumo por ambiente + testes */
  const roomRows = d.rooms?.length
    ? d.rooms.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.room)}</td><td>${r.checked}</td><td>${r.problems}</td><td><span class="yn"><i class="s ${r.problems === 0 ? 'on' : ''}">OK</i><i class="n ${r.problems > 0 ? 'on' : ''}">REPARAR</i></span></td></tr>`).join('')
    : Array.from({ length: 8 }, (_, i) => `<tr class="blank"><td class="n">${i + 1}</td><td></td><td></td><td></td><td><span class="yn"><i class="s">OK</i><i class="n">REPARAR</i></span></td></tr>`).join('')
  const tst = d.tests ?? {}
  const tstRows = TESTES.map((t) => {
    const v = tst[t]
    return `<tr><td>${esc(t)}</td><td class="c"><span class="dot ${v === 'ok' ? 'on' : ''}"></span></td><td class="c"><span class="dot no ${v === 'falha' ? 'on' : ''}"></span></td><td class="c"><span class="dot ${v === 'na' ? 'on' : ''}" style="${v === 'na' ? 'background:#9AA3B6;border-color:#9AA3B6' : ''}"></span></td></tr>`
  }).join('')
  pages.push(`<div class="page">${head('LAUDO DE VISTORIA', 'Ambientes e testes', 'list')}
<div class="box rep" style="margin-top:4mm"><h3><i></i>Resumo por ambiente</h3><table><thead><tr><th>Nº</th><th>AMBIENTE</th><th>ITENS VERIFICADOS</th><th>COM PROBLEMA</th><th>RESULTADO</th></tr></thead><tbody>${roomRows}</tbody></table></div>
<div class="box tst" style="margin-top:3mm;flex:1"><h3><i></i>Testes de funcionamento</h3><table><thead><tr><th>TESTE</th><th>OK</th><th>FALHA</th><th>N/A</th></tr></thead><tbody>${tstRows}</tbody></table>
<p style="font-size:6.4pt;color:var(--mut);margin-top:2mm">N/A: não se aplica a este apartamento ou não foi possível testar (ver “itens não verificados”).</p></div>
<div style="height:3mm"></div>${foot('Laudo de vistoria · ambientes e testes', ++n)}</div>`)

  /* 5. itens para reparo (20 por folha) */
  const per = 20
  const repPages = blank ? 1 : Math.max(1, Math.ceil(items.length / per))
  for (let p = 0; p < repPages; p++) {
    const slice = blank ? [] : items.slice(p * per, (p + 1) * per)
    const rows = blank
      ? Array.from({ length: per }, (_, i) => `<tr class="blank"><td class="n">${i + 1}</td><td></td><td></td><td></td><td></td><td></td><td><span class="yn"><i class="s">SIM</i><i class="n">NÃO</i></span></td></tr>`).join('')
      : slice.length
        ? slice
            .map((it, i) => {
              const idx = p * per + i
              const fs = fotosDoItem[idx] ?? []
              return `<tr><td class="n">${idx + 1}</td><td>${esc(it.room)}</td><td>${esc(it.item)}</td><td>${esc(it.found)}</td><td>${gravChip(it.gravidade ?? 'media')}</td><td>${fs.length ? fs.join(', ') : '—'}</td><td><span class="yn"><i class="s ${it.fixed ? 'on' : ''}">SIM</i><i class="n">NÃO</i></span></td></tr>`
            })
            .join('')
        : `<tr><td colspan="7" style="padding:6mm 0;text-align:center;color:var(--txt)">Nenhum vício aparente encontrado nesta vistoria.</td></tr>`
    pages.push(`<div class="page">${head('LAUDO DE VISTORIA', 'Itens para reparo', 'tool')}
<p style="font-size:6.8pt;color:var(--txt);margin-top:3mm">Cada vício aparente encontrado, com a gravidade e o número das fotos. Na nova vistoria (revistoria), marque se a construtora corrigiu.</p>
<div class="box rep" style="margin-top:3mm;flex:1"><table><thead><tr><th>Nº</th><th style="width:24mm">AMBIENTE</th><th style="width:34mm">ITEM VERIFICADO</th><th>O QUE FOI ENCONTRADO</th><th style="width:16mm">GRAVIDADE</th><th style="width:12mm">FOTOS</th><th style="width:21mm">CORRIGIDO?</th></tr></thead><tbody>${rows}</tbody></table></div>
<div style="height:3mm"></div>${foot('Laudo de vistoria · itens para reparo', ++n)}</div>`)
  }

  /* 6. registro fotográfico: horizontais 2 por linha, verticais 3 por linha */
  const vazio = (o: 'h' | 'v') => `<div class="pf empty"><div class="fr"><span class="ph0">${ico('camera')}foto na ${o === 'h' ? 'horizontal' : 'vertical'}</span></div><div class="cap"><span class="l1"><em>FOTO</em>${f('Ambiente')}</span>${f('O que mostra')}</div></div>`
  const cheia = (x: F) =>
    `<div class="pf"><div class="fr"><span class="bg" style="background-image:url('${esc(x.f.url)}')"></span><img src="${esc(x.f.url)}" alt=""></div><div class="cap"><span class="l1"><em>FOTO ${x.k}</em><b>${esc(x.titulo)}</b>${x.item ? `<span style="color:var(--mut)">· item ${x.item}</span>` : ''}${gravChip(x.g)}</span><span class="l2">${esc(x.sub)}</span></div></div>`
  const fmt = `<div class="fmt">${ico('camera')}<span><i class="ih"></i>horizontais: 2 por linha</span><span><i class="iv"></i>verticais: 3 por linha</span><span>· cada foto aparece inteira, sem cortes</span></div>`
  const fotoPage = (rowsHtml: string, intro: string) =>
    pages.push(`<div class="page">${head('LAUDO DE VISTORIA', 'Registro fotográfico', 'camera')}
<p style="font-size:6.8pt;color:var(--txt);margin-top:3mm">${intro}</p>${fmt}${rowsHtml}<div style="flex:1"></div>${foot('Laudo de vistoria · registro fotográfico', ++n)}</div>`)
  const intro = 'As fotos dos itens para reparo têm o mesmo número da lista. Vídeos podem ser enviados junto, por link.'
  if (blank) {
    // modelo: as duas linhas de cada formato, para colar fotos na horizontal ou na vertical
    fotoPage(`<div class="prow h">${vazio('h')}${vazio('h')}</div><div class="prow h">${vazio('h')}${vazio('h')}</div><div class="prow v">${vazio('v')}${vazio('v')}${vazio('v')}</div>`, intro)
    fotoPage(`<div class="prow v">${vazio('v')}${vazio('v')}${vazio('v')}</div><div class="prow v">${vazio('v')}${vazio('v')}${vazio('v')}</div>`, intro)
  } else if (fotos.length) {
    let acc = 0
    let html = ''
    for (const r of linhas) {
      if (acc + ROW_H[r.o] > FOTO_AREA && html) {
        fotoPage(html, intro)
        html = ''
        acc = 0
      }
      html += `<div class="prow ${r.o}">${r.fs.map(cheia).join('')}</div>`
      acc += ROW_H[r.o]
    }
    if (html) fotoPage(html, intro)
  }

  /* 7. itens não verificados + observações */
  const nv = d.notChecked ?? []
  pages.push(`<div class="page">${head('LAUDO DE VISTORIA', 'Não verificados e observações', 'eye')}
<div class="box" style="margin-top:4mm"><h3><i></i>Itens não verificados</h3><p style="font-size:6.8pt;color:var(--txt);margin-bottom:2mm">O que não deu para conferir no dia (sem água, sem energia, sem acesso, item ainda não instalado) e por quê. Vale conferir na revistoria.</p>
${nv.length ? `<div class="chips">${nv.map((t) => `<span class="chip">${ico('x')}${esc(t)}</span>`).join('')}</div>` : blank ? Array.from({ length: 6 }, () => '<div style="border-bottom:1px solid #D8DCE4;height:7mm"></div>').join('') : '<p style="font-size:7pt;color:var(--txt)">Todos os itens do checklist foram verificados.</p>'}</div>
<div class="box" style="margin-top:3mm;flex:1"><h3><i></i>Observações do responsável técnico</h3>${d.notes ? `<p style="font-size:7.2pt;color:var(--txt);white-space:pre-line">${esc(d.notes)}</p>` : Array.from({ length: 14 }, () => '<div style="border-bottom:1px solid #D8DCE4;height:7mm"></div>').join('')}</div>
<div style="height:3mm"></div>${foot('Laudo de vistoria · observações', ++n)}</div>`)

  /* 8. conclusão */
  const concl = blank
    ? ''
    : result === 'ok'
      ? 'Na data da vistoria, o apartamento não apresentou vícios aparentes nos itens verificados e pode ser recebido, guardando-se este laudo e o manual do proprietário.'
      : result === 'rs'
        ? `Na data da vistoria, o apartamento apresentou ${items.length} ${items.length === 1 ? 'item' : 'itens'} para reparo, sem gravidade que impeça o uso. Recomenda-se receber com ressalvas, registrando este laudo junto à construtora e acompanhando os reparos.`
        : `Na data da vistoria, o apartamento apresentou ${items.length} ${items.length === 1 ? 'item' : 'itens'} para reparo, ${grav.grave} ${grav.grave === 1 ? 'deles grave' : 'deles graves'}. Recomenda-se que os itens graves sejam reparados antes do recebimento, com nova vistoria para conferir.`
  pages.push(`<div class="page">${head('LAUDO DE VISTORIA', 'Conclusão', 'shield')}
<div class="box" style="margin-top:4mm"><h3><i></i>Parecer técnico</h3>${concl ? `<p class="decl">${concl}</p>` : Array.from({ length: 3 }, () => '<div style="border-bottom:1px solid #D8DCE4;height:7mm"></div>').join('')}</div>
<div class="box" style="margin-top:3mm"><h3><i></i>Próximos passos</h3><div class="next">${[
    ['send', 'Enviar à construtora', 'Este laudo, as fotos e os vídeos, pelo atendimento da construtora. Guarde o número do protocolo.', 'Enviado em'],
    ['tool', 'Reparos', 'A construtora corrige os vícios apontados, sem custo para o proprietário.', 'Prazo informado'],
    ['redo', 'Nova vistoria', 'Conferir se os itens corrigidos estão em ordem antes de receber as chaves (revistoria).', 'Marcada para'],
  ]
    .map(([ic, t, p, l]) => `<div class="box"><div class="qh"><span class="ib">${ico(ic)}</span>${t}</div><p>${p}</p><div style="margin-top:3mm">${f(l, l === 'Marcada para' ? dateBR(d.revisitDate) : '')}</div></div>`)
    .join('')}</div></div>
<div class="box" style="margin-top:3mm"><h3><i></i>Vícios e garantias</h3><div class="warr"><div class="box soft"><b>Vícios aparentes</b><p>Defeitos fáceis de ver, como os desta vistoria. Devem ser comunicados à construtora em até 90 dias do recebimento (Código de Defesa do Consumidor, art. 26).</p></div><div class="box soft"><b>Vícios ocultos</b><p>Defeitos que só aparecem com o uso. Seguem os prazos do manual do proprietário (NBR 17170) e do Código de Defesa do Consumidor, contados de quando o defeito aparece.</p></div></div>
<p style="font-size:6.6pt;color:var(--txt);margin-top:3mm"><b>Manual do proprietário:</b> a construtora deve entregar o manual de uso, operação e manutenção (NBR 14037); o mau uso ou a falta de manutenção podem cancelar a garantia. <b>Vai reformar?</b> A garantia não cobre o que for alterado: antes da obra, confira se os itens deste laudo já foram corrigidos e faça a ART da reforma.</p></div>
${d.fotosLink ? `<div class="box" style="margin-top:3mm"><h3><i></i>Todas as fotos da vistoria</h3><p style="font-size:7.2pt;color:var(--txt)">As fotos completas do dia, em tamanho original, estão nesta pasta: <a href="${esc(d.fotosLink)}" style="color:var(--navy);font-weight:600;word-break:break-all">${esc(d.fotosLink)}</a></p></div>` : ''}
<div class="box soft" style="margin-top:3mm"><p class="decl">Declaro que a vistoria foi feita por mim, na data e no horário indicados, e que este laudo retrata as condições aparentes do imóvel naquele momento. Este laudo acompanha a <b>ART${d.art ? ` nº ${esc(d.art)}` : ''}</b> registrada no CREA-SP.</p></div>
<div class="grid2" style="margin-top:3mm">${f('Local', 'Santo André - SP')}${f('Data', dateBR(d.date))}</div>
<div class="sigs" style="margin:auto 0 3mm"><div class="box"><span>${esc(RDL.name)}</span><b>RESPONSÁVEL TÉCNICO · CREA ${esc(RDL.crea)}</b></div><div class="box"><span>${esc(d.owner)}</span><b>PROPRIETÁRIO(A)</b></div><div class="box"><span>${esc(d.builder)}</span><b>CONSTRUTORA · CIENTE EM ___/___/___</b></div></div>
${foot('Laudo de vistoria · conclusão', ++n)}</div>`)
  return shell(`Laudo de vistoria${d.unit ? ` · ${d.unit}` : ''}`, pages).replace('</style>', `${LAUDO_CSS}</style>`)
}

/* ================= ORÇAMENTO ================= */

export type RdlService = 'vistoria' | 'art-obra'
export interface OrcamentoData {
  service: RdlService
  client?: string
  phone?: string
  unit?: string // torre e apto
  place?: string // empreendimento ou endereço
  value?: number
  group?: boolean // valor de grupo (10 ou mais aptos)
  revistoria?: boolean
  scope?: string // o que será feito (ART de obra)
  date?: string
  number?: string
}

const SERVICES: Record<RdlService, { title: [string, string]; k: string; inc: [string, string][]; exc: [string, string][]; steps: [string, string, string][]; conds: [string, string, string][] }> = {
  vistoria: {
    title: ['Vistoria de', 'entrega de chaves'],
    k: 'VISTORIA + LAUDO + ART',
    inc: [
      ['search', 'Vistoria presencial com engenheiro civil'],
      ['shield', 'ART da vistoria registrada no CREA'],
      ['doc', 'Laudo técnico com fotos, em PDF'],
      ['plan', 'Conferência com a planta e o memorial da MRV'],
      ['sign', 'Contrato de prestação de serviço'],
    ],
    exc: [
      ['redo', 'Revistoria (opcional, valor à parte)'],
      ['tool', 'Reparos (ficam por conta da MRV)'],
      ['building', 'Áreas comuns do condomínio'],
      ['wall', 'Abertura de paredes, pisos ou forros'],
      ['law', 'Perícia judicial ou assessoria jurídica'],
    ],
    steps: [
      ['cal', 'Reserva', 'Contrato digital + sinal, com antecedência'],
      ['plan', 'Análise prévia', 'Planta e memorial descritivo'],
      ['search', 'Vistoria', 'Engenheiro no local, junto com você'],
      ['doc', 'Laudo + ART', 'Em até 4 dias úteis, pronto para a MRV'],
    ],
    conds: [
      ['clock', 'Visita de até 2 horas', 'no dia e horário da vistoria da MRV'],
      ['user', 'Acompanhamento', 'você ou alguém de confiança, com água e luz ligadas'],
      ['card', 'Sinal de 50% garante a vaga', 'restante no dia; não reembolsável após confirmar a data'],
      ['cal', 'Mudança de data pela MRV', 'reagendamos conforme disponibilidade'],
      ['eye', 'Inspeção visual e com instrumentos', 'itens embutidos não fazem parte'],
      ['doc', 'Laudo em até 4 dias úteis', 'por WhatsApp e e-mail, após a quitação'],
    ],
  },
  'art-obra': {
    title: ['ART de', 'obra e reforma'],
    k: 'RESPONSABILIDADE TÉCNICA DA OBRA',
    inc: [
      ['search', 'Visita técnica ao imóvel antes da obra'],
      ['plan', 'Análise do que será executado'],
      ['shield', 'ART de execução registrada no CREA'],
      ['doc', 'Plano de reforma para o condomínio (NBR 16280)'],
      ['sign', 'Contrato de prestação de serviço'],
    ],
    exc: [
      ['tool', 'Mão de obra e materiais da reforma'],
      ['building', 'Projeto arquitetônico ou de interiores'],
      ['bolt', 'Projetos complementares (elétrico, hidráulico)'],
      ['wall', 'Alterações em estrutura ou fachada'],
      ['law', 'Taxas do condomínio ou da prefeitura'],
    ],
    steps: [
      ['user', 'Conversa', 'Você conta o que vai fazer no apê'],
      ['search', 'Visita técnica', 'Conferimos o imóvel e o escopo'],
      ['shield', 'ART + plano', 'Registro no CREA e documentos para o condomínio'],
      ['hard', 'Obra liberada', 'Com responsável técnico durante a reforma'],
    ],
    conds: [
      ['plan', 'Escopo definido antes', 'a ART vale só para o que foi descrito'],
      ['building', 'Regras do condomínio', 'a obra segue o regulamento e a NBR 16280'],
      ['card', '50% na contratação', 'e 50% na entrega da ART e do plano'],
      ['tool', 'Mudou o escopo?', 'pode ser preciso uma ART complementar'],
      ['eye', 'Visitas de acompanhamento', 'conforme combinado na proposta'],
      ['doc', 'ART em até 5 dias úteis', 'depois da visita técnica e do pagamento'],
    ],
  },
}

export function orcamentoHtml(o: OrcamentoData): string {
  const s = SERVICES[o.service]
  const v = o.value ?? (o.service === 'vistoria' ? (o.group ? 280 : 297) : 0)
  const valueTxt = v ? money(v).replace('R$', '').trim() : 'a definir'
  const tiers =
    o.service === 'vistoria'
      ? `<ul><li class="${o.group ? '' : 'on'}"><span>Individual</span><b>R$ 297</b></li><li class="${o.group ? 'on' : ''}"><span>Grupo de 10 ou mais aptos</span><b>R$ 280</b></li><li><span>Revistoria (opcional${o.revistoria ? ', já combinada' : ''})</span><b>R$ 150</b></li></ul>`
      : `<ul><li><span>Escopo</span><b>${esc(o.scope || 'conforme visita técnica')}</b></li><li><span>Taxa do CREA</span><b>inclusa</b></li><li><span>Validade</span><b>30 dias</b></li></ul>`
  const page = `<div class="page">
<div style="text-align:center"><img src="${RDL_LOGO}" alt="RDL" style="height:21mm"></div>
<div class="oc-hero"><span class="pill"><i></i>ORÇAMENTO${o.number ? ` Nº ${esc(o.number)}` : ''}${o.place ? ` · ${esc(o.place.toUpperCase())}` : ''}</span><h1>${s.title[0]} <span>${s.title[1]}</span></h1></div>
<div class="oc-who"><div class="box"><small>CLIENTE</small><b>${esc(o.client || '—')}</b></div><div class="box"><small>UNIDADE</small><b>${esc(o.unit || '—')}</b></div><div class="box"><small>WHATSAPP</small><b>${esc(o.phone || '—')}</b></div><div class="box"><small>DATA</small><b>${dateBR(o.date)}</b></div></div>
<div class="price"><div><div class="k"><span class="kc">${ico(o.service === 'vistoria' ? 'key' : 'hard')}</span>${s.k}</div><div class="v">${v ? '<small>R$</small>' : ''}${valueTxt}</div><div class="s">${o.service === 'vistoria' ? (o.group ? 'VALOR DE GRUPO · ' : '') + 'ART INCLUSA · PIX OU CARTÃO' : 'ART INCLUSA · PIX OU CARTÃO'}</div></div><div class="div"></div><div>${tiers}</div></div>
<div class="io"><div class="box yes"><div class="hd"><span class="ic">${ico('check')}</span><b>Está incluso</b></div>${s.inc.map(([i, t]) => `<div class="it"><span class="ib">${ico(i)}</span>${esc(t)}</div>`).join('')}</div>
<div class="box no"><div class="hd"><span class="ic">${ico('x')}</span><b>Não está incluso</b></div>${s.exc.map(([i, t]) => `<div class="it"><span class="ib">${ico(i)}</span>${esc(t)}</div>`).join('')}</div></div>
<div class="box" style="margin-top:4mm"><h3><i></i>Como funciona</h3><div class="next" style="grid-template-columns:repeat(4,1fr)">${s.steps.map(([i, t, p], k) => `<div class="box soft"><div class="qh"><span class="ib">${ico(i)}</span><span><em style="font-style:normal;color:var(--or)">${k + 1}</em> ${esc(t)}</span></div><p>${esc(p)}</p></div>`).join('')}</div></div>
<div class="box" style="margin-top:4mm"><h3><i></i>Bom saber</h3><div class="conds">${s.conds.map(([i, t, p]) => `<div class="cnd"><span class="ib">${ico(i)}</span><span><b>${esc(t)}</b>${esc(p)}</span></div>`).join('')}</div></div>
<div class="accept" style="margin:5mm 0 4mm"><div class="box"><b>${esc(RDL.name.toUpperCase())} · RDL ENGENHARIA</b></div><div class="box"><b>DE ACORDO · ${esc((o.client || 'CLIENTE').toUpperCase())}</b></div></div>
${foot(`Orçamento válido por 30 dias${o.date ? ` · ${dateBR(o.date)}` : ''}`)}</div>`
  return shell(`Orçamento RDL · ${s.title.join(' ')}${o.client ? ` · ${o.client}` : ''}`, [page])
}

/** Abre o documento numa aba nova, pronto para salvar em PDF ou imprimir. */
export function openRdlDoc(html: string) {
  const w = window.open('', '_blank')
  if (!w) {
    // bloqueador de janelas: baixa o arquivo para abrir e imprimir
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    a.download = 'documento-rdl.html'
    a.click()
    return
  }
  w.document.open()
  w.document.write(html.replace('</body>', '<script>setTimeout(function(){try{window.focus();window.print()}catch(e){}},700)</script></body>'))
  w.document.close()
}
