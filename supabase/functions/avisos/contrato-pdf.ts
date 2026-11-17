// Contrato da vistoria em PDF (A4), gerado no servidor para ir anexado no e-mail.
// Mesmo desenho do PDF do site (src/rdlContratoPdf.ts): timbre da RDL, texto justificado, assinaturas das duas
// partes e o registro completo da assinatura eletrônica.
import { jsPDF } from 'npm:jspdf@2.5.2'

const NAVY: [number, number, number] = [1, 44, 96]
const ORANGE: [number, number, number] = [255, 130, 22]
const TXT: [number, number, number] = [40, 50, 72]
const MUT: [number, number, number] = [122, 127, 146]
const X = 20
const LARG = 170
const TOPO = 36
const FIM = 270

const RDL = {
  company: 'RDL Engenharia e Representações',
  cnpj: '48.624.017/0001-46',
  engineer: 'Eng. Rogério Francisco Vieira',
  crea: '5070438360',
  phone: '(11) 9 7520-8296',
  email: 'roger.rdl76@yahoo.com.br',
}
const WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const san = (t: string) =>
  t
    .replace(/→/g, '->')
    .replace(/[✓✔]/g, 'v')
    .replace(/ /g, ' ')
    .replace(/./gu, (c) => (c.charCodeAt(0) < 256 || WINANSI.includes(c) ? c : ''))

// letras manuscritas (Google Fonts, licença OFL): a da RDL é exclusiva; a do morador segue a que ele escolheu
const FONTES: Record<string, string> = {
  rdl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/herrvonmuellerhoff/HerrVonMuellerhoff-Regular.ttf',
  dancing: 'https://raw.githubusercontent.com/google/fonts/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf',
  greatvibes: 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf',
  homemade: 'https://raw.githubusercontent.com/google/fonts/apache/homemadeapple/HomemadeApple-Regular.ttf',
}
const cache: Record<string, string> = {}
const b64 = (buf: ArrayBuffer) => {
  let s = ''
  const u = new Uint8Array(buf)
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
async function baixar(url: string) {
  if (!cache[url]) {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`fonte ${r.status}`)
    cache[url] = b64(await r.arrayBuffer())
  }
  return cache[url]
}
async function usarFonte(doc: jsPDF, id: string) {
  const url = FONTES[id] ?? FONTES.dancing
  const nome = `sig-${id}`
  try {
    doc.addFileToVFS(`${nome}.ttf`, await baixar(url))
    doc.addFont(`${nome}.ttf`, nome, 'normal')
    return nome
  } catch {
    return 'times' // sem internet para a letra: usa itálico padrão
  }
}

/** Traço desenhado (SVG "M x y L x y …", caixa 600 × 200) desenhado no PDF dentro do retângulo dado. */
function desenhar(doc: jsPDF, path: string, x: number, y: number, w: number, h: number) {
  const k = Math.min(w / 600, h / 200)
  const ox = x + (w - 600 * k) / 2
  const oy = y + (h - 200 * k) / 2
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.45)
  doc.setLineCap('round')
  doc.setLineJoin('round')
  let cx = 0
  let cy = 0
  const re = /([MLl])\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(path))) {
    const a = Number(m[2])
    const b = Number(m[3])
    const nx = m[1] === 'l' ? cx + a : a
    const ny = m[1] === 'l' ? cy + b : b
    if (m[1] !== 'M') doc.line(ox + cx * k, oy + cy * k, ox + nx * k, oy + ny * k)
    cx = nx
    cy = ny
  }
}

export type ContratoDados = {
  id: string
  texto: string
  assinatura: string
  cpf: string
  em: string
  fuso?: string
  ip?: string
  aparelho?: string
  ua?: string
  tela?: string
  idioma?: string
  email?: string
  tel?: string
  desenho?: string
  fonte?: string
  codigo: string
  versao?: number
  recebido?: string
  pago?: string
}

export async function contratoPdf(c: ContratoDados, logoPng: string | null): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let y = TOPO
  const timbre = () => {
    if (logoPng) doc.addImage(logoPng, 'PNG', 105 - 21, 9, 42, 14.9)
    doc.setDrawColor(230, 228, 222)
    doc.setLineWidth(0.25)
    doc.line(X, 28, X + LARG, 28)
    doc.setFillColor(...ORANGE)
    doc.roundedRect(105 - 6, 27.4, 12, 1.2, 0.6, 0.6, 'F')
  }
  const cabe = (h: number) => {
    if (y + h > FIM) {
      doc.addPage()
      timbre()
      y = TOPO
    }
  }
  timbre()
  san(c.texto)
    .split('\n')
    .forEach((l, i) => {
      const t = l.trim()
      if (!t) return
      if (i === 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(...NAVY)
        ;(doc.splitTextToSize(t, 150) as string[]).forEach((x) => (doc.text(x, 105, y, { align: 'center' }), (y += 6)))
        y += 3
        return
      }
      if (/^(\d+\. |A\d+\. |CONTRATADA$|CONTRATANTE$|IMÓVEL( VISTORIADO)?$|ANEXO)/.test(t)) {
        cabe(14)
        y += 3
        doc.setFillColor(...ORANGE)
        doc.roundedRect(X, y - 2.6, 4, 1, 0.5, 0.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.6)
        doc.setTextColor(...NAVY)
        ;(doc.splitTextToSize(t.toUpperCase(), LARG - 7) as string[]).forEach((x) => (doc.text(x, X + 6, y, { charSpace: 0.25 }), (y += 4.4)))
        y += 0.8
        return
      }
      const m = t.match(/^((?:A?\d+\.\d+)|•)\s+(.*)$/)
      const pre = m?.[1]
      const corpo = m ? m[2] : t
      const xi = pre ? X + (pre === '•' ? 5 : 10) : X
      const w = X + LARG - xi
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.2)
      const ls = doc.splitTextToSize(corpo, w) as string[]
      ls.forEach((x, j) => {
        cabe(4.4)
        if (j === 0 && pre) {
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(...(pre === '•' ? ORANGE : NAVY))
          doc.text(pre, pre === '•' ? X + 1 : X, y)
          doc.setFont('helvetica', 'normal')
        }
        doc.setTextColor(...TXT)
        if (j < ls.length - 1) doc.text(x, xi, y, { align: 'justify', maxWidth: w })
        else doc.text(x, xi, y)
        y += 4.4
      })
      y += 1.4
    })

  // assinaturas
  cabe(52)
  y += 6
  const bw = (LARG - 8) / 2
  const quando = new Date(c.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const caixa = async (x: number, titulo: string, sub: string[], assinar: () => Promise<void>) => {
    doc.setDrawColor(225, 228, 234)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, bw, 42, 3, 3, 'S')
    await assinar()
    doc.setDrawColor(154, 163, 182)
    doc.setLineWidth(0.3)
    doc.line(x + 8, y + 26, x + bw - 8, y + 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.6)
    doc.setTextColor(...NAVY)
    doc.text(titulo, x + bw / 2, y + 30.5, { align: 'center', charSpace: 0.2 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...MUT)
    sub.forEach((s, i) => doc.text(s, x + bw / 2, y + 34.5 + i * 3.3, { align: 'center', maxWidth: bw - 6 }))
  }
  const escrever = async (fid: string, nome: string, x: number) => {
    const f = await usarFonte(doc, fid)
    doc.setFont(f, f === 'times' ? 'italic' : 'normal')
    doc.setTextColor(...NAVY)
    let sz = fid === 'rdl' ? 34 : 26
    doc.setFontSize(sz)
    while (doc.getTextWidth(nome) > bw - 14 && sz > 12) doc.setFontSize((sz -= 1))
    doc.text(nome, x + bw / 2, y + 21, { align: 'center' })
  }
  await caixa(X, 'RDL ENGENHARIA E REPRESENTAÇÕES', [`${RDL.engineer} · CREA-SP ${RDL.crea}`, `CONTRATADA · assinado eletronicamente em ${quando}`], () => escrever('rdl', 'Rogério F. Vieira', X))
  const x2 = X + bw + 8
  await caixa(x2, 'CONTRATANTE', [`${c.assinatura} · CPF ${c.cpf}`, `assinado eletronicamente em ${quando}`], async () => {
    if (c.desenho) desenhar(doc, c.desenho, x2 + 6, y + 3, bw - 12, 22)
    else await escrever(c.fonte || 'dancing', c.assinatura, x2)
  })
  y += 48

  // registro da assinatura
  const reg: [string, string][] = [
    ['Assinante', c.assinatura],
    ['CPF', c.cpf],
    ...(c.email ? ([['E-mail', c.email]] as [string, string][]) : []),
    ...(c.tel ? ([['Telefone', c.tel]] as [string, string][]) : []),
    ['Data e hora', `${quando} (${c.fuso || 'America/Sao_Paulo'})`],
    ['Recebido pelo servidor', c.recebido ? new Date(c.recebido).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'],
    ['IP', c.ip || 'registrado pelo servidor'],
    ['Aparelho', c.aparelho || '—'],
    ...(c.ua ? ([['Navegador', c.ua]] as [string, string][]) : []),
    ...(c.tela ? ([['Tela e idioma', `${c.tela}${c.idioma ? ` · ${c.idioma}` : ''}`]] as [string, string][]) : []),
    ['Forma de assinatura', c.desenho ? 'desenhada na tela' : 'nome digitado, em letra manuscrita'],
    ['Contratada', `${RDL.engineer} (${RDL.company}), assinatura eletrônica na mesma data`],
    ['Código do documento', `SHA-256 ${c.codigo}`],
    ['Versão do contrato', String(c.versao ?? 1)],
    ['Reserva', `nº ${c.id.slice(0, 8).toUpperCase()}`],
    ...(c.pago ? ([['Pagamento confirmado', new Date(c.pago).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })]] as [string, string][]) : []),
  ].map(([a, b]) => [a, san(b)])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const alt = reg.map(([, v]) => (doc.splitTextToSize(v, LARG - 44) as string[]).length)
  const h = 16 + alt.reduce((a, b) => a + b * 3.3 + 0.8, 0) + 9
  cabe(h)
  doc.setFillColor(244, 246, 249)
  doc.roundedRect(X, y, LARG, h, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.4)
  doc.setTextColor(...NAVY)
  doc.text('Registro da assinatura eletrônica', X + 5, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...MUT)
  doc.text('MP 2.200-2/2001, art. 10, § 2º, e Lei 14.063/2020 (assinatura eletrônica simples)', X + 5, y + 11)
  let yy = y + 17
  reg.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...NAVY)
    doc.text(k, X + 5, yy)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TXT)
    doc.text(doc.splitTextToSize(v, LARG - 44) as string[], X + 40, yy)
    yy += alt[i] * 3.3 + 0.8
  })
  doc.setFontSize(6.6)
  doc.setTextColor(...MUT)
  doc.text('Qualquer alteração no texto muda o código SHA-256 acima: é assim que se confere que este é o documento assinado.', X + 5, y + h - 4, { maxWidth: LARG - 10 })

  const n = doc.getNumberOfPages()
  for (let p = 1; p <= n; p++) {
    doc.setPage(p)
    doc.setFillColor(...NAVY)
    doc.rect(0, 280, 210, 17, 'F')
    doc.setFillColor(...ORANGE)
    doc.rect(0, 280, 210, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(RDL.engineer, X, 287)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.text(`${RDL.company} · CNPJ ${RDL.cnpj}`, X, 291.5)
    doc.text(`${RDL.phone} · ${RDL.email}`, 176, 287, { align: 'right' })
    doc.text(`Reserva nº ${c.id.slice(0, 8).toUpperCase()} · código ${c.codigo.slice(0, 12)}`, 176, 291.5, { align: 'right' })
    doc.setFillColor(...ORANGE)
    doc.roundedRect(181, 284.5, 9, 7, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(String(p), 185.5, 289.2, { align: 'center' })
  }
  return doc.output('datauristring').split(',')[1]
}
