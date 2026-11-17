import { RDL_LOGO } from './rdlLogo'
import { SIGN_FONTS, drawingToDataUrl } from './components/SignaturePad'
import { RDL_INFO, type Reserva } from './rdlReserva'

/* Contrato da vistoria em PDF de verdade (A4, texto em vetor, alinhado e justificado), com o timbre da RDL em
   todas as folhas, as assinaturas e o registro completo da assinatura eletrônica. Abre bem no celular. */

const NAVY: [number, number, number] = [1, 44, 96]
const ORANGE: [number, number, number] = [255, 130, 22]
const TXT: [number, number, number] = [40, 50, 72]
const MUT: [number, number, number] = [122, 127, 146]

const WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
/** O PDF usa a Helvetica padrão: troca o que ela não tem por algo parecido. */
const san = (t: string) =>
  t
    .replace(/→/g, '->')
    .replace(/[≥]/g, '>=')
    .replace(/[≤]/g, '<=')
    .replace(/[✓✔]/g, 'v')
    .replace(/\u00a0/g, ' ')
    .replace(/./gu, (c) => (c.charCodeAt(0) < 256 || WINANSI.includes(c) ? c : ''))

const X = 20 // margem
const LARG = 170
const TOPO = 36
const FIM = 270

/** Nome escrito na letra escolhida, como imagem (o PDF não tem as letras manuscritas embutidas). */
async function nomeManuscrito(nome: string, fonteId?: string): Promise<string> {
  const f = SIGN_FONTS.find((x) => x.id === fonteId) ?? SIGN_FONTS[0]
  const px = Math.round(96 * (f.size ?? 1))
  try {
    await document.fonts.load(`${px}px ${f.family}`, nome)
  } catch {
    /* segue com a letra que tiver */
  }
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 300
  const g = c.getContext('2d')!
  g.fillStyle = '#012C60'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  let size = px
  g.font = `${size}px ${f.family}`
  while (g.measureText(nome).width > 1140 && size > 30) g.font = `${(size -= 4)}px ${f.family}`
  g.fillText(nome, 600, 160)
  return c.toDataURL('image/png')
}
async function desenhoPng(path: string): Promise<string> {
  const img = new Image()
  img.src = drawingToDataUrl(path).replace('%232f3a45', '%23012C60')
  await img.decode()
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 400
  c.getContext('2d')!.drawImage(img, 0, 0, 1200, 400)
  return c.toDataURL('image/png')
}

export async function contratoPdf(r: Pick<Reserva, 'contrato' | 'status' | 'id'>): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const k = r.contrato
  let y = TOPO

  const timbre = () => {
    doc.addImage(RDL_LOGO, 'PNG', 105 - 21, 9, 42, 14.9)
    doc.setDrawColor(230, 228, 222)
    doc.setLineWidth(0.25)
    doc.line(X, 28, X + LARG, 28)
    doc.setFillColor(...ORANGE)
    doc.roundedRect(105 - 6, 27.4, 12, 1.2, 0.6, 0.6, 'F')
  }
  const novaFolha = () => {
    doc.addPage()
    timbre()
    y = TOPO
  }
  const cabe = (h: number) => {
    if (y + h > FIM) novaFolha()
  }
  timbre()

  const linhas = san(k.texto).split('\n')
  linhas.forEach((l, i) => {
    const t = l.trim()
    if (!t) return
    if (i === 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(...NAVY)
      const ls = doc.splitTextToSize(t, 150) as string[]
      ls.forEach((x) => (doc.text(x, 105, y, { align: 'center' }), (y += 6)))
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
      const ls = doc.splitTextToSize(t.toUpperCase(), LARG - 7) as string[]
      ls.forEach((x) => (doc.text(x, X + 6, y, { charSpace: 0.25 }), (y += 4.4)))
      y += 0.8
      return
    }
    // parágrafo: número (3.1) ou marcador (•) pendurado à esquerda, texto justificado
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

  /* assinaturas */
  cabe(52)
  y += 6
  const bw = (LARG - 8) / 2
  const caixa = async (x: number, img: string | null, titulo: string, sub: string[]) => {
    doc.setDrawColor(225, 228, 234)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, bw, 42, 3, 3, 'S')
    if (img) doc.addImage(img, 'PNG', x + 6, y + 3, bw - 12, (bw - 12) / 4)
    doc.setDrawColor(154, 163, 182)
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
  const rdlEm = r.status.contratada ? new Date(r.status.contratada).toLocaleString('pt-BR') : ''
  const quando = new Date(k.em).toLocaleString('pt-BR')
  await caixa(X, rdlEm ? await nomeManuscrito('RDL Engenharia', 'dancing') : null, 'RDL ENGENHARIA E REPRESENTAÇÕES', [`${RDL_INFO.engineer} · CREA-SP ${RDL_INFO.crea}`, rdlEm ? `CONTRATADA · aceite em ${rdlEm}` : 'CONTRATADA · aceite na confirmação do pagamento'])
  await caixa(X + bw + 8, k.desenho ? await desenhoPng(k.desenho) : await nomeManuscrito(k.assinatura, k.fonte), 'CONTRATANTE', [`${k.assinatura} · CPF ${k.cpf}`, `assinado eletronicamente em ${quando}`])
  y += 48

  /* registro da assinatura eletrônica */
  const reg: [string, string][] = [
    ['Assinante', k.assinatura],
    ['CPF', k.cpf],
    ...(k.email ? ([['E-mail', k.email]] as [string, string][]) : []),
    ...(k.tel ? ([['Telefone', k.tel]] as [string, string][]) : []),
    ['Data e hora', `${quando} (${k.fuso})`],
    ['Recebido pelo servidor', k.recebido ? new Date(k.recebido).toLocaleString('pt-BR') : '—'],
    ['IP', k.ip || 'registrado pelo servidor'],
    ['Aparelho', k.aparelho],
    ...(k.ua ? ([['Navegador', k.ua]] as [string, string][]) : []),
    ...(k.tela ? ([['Tela e idioma', `${k.tela}${k.idioma ? ` · ${k.idioma}` : ''}`]] as [string, string][]) : []),
    ['Forma de assinatura', k.desenho ? 'desenhada na tela' : 'nome digitado, em letra manuscrita'],
    ['Código do documento', `SHA-256 ${k.codigo}`],
    ['Versão do contrato', String(k.versao ?? 1)],
    ['Reserva', `nº ${r.id.slice(0, 8).toUpperCase()}`],
    ...(rdlEm ? ([['Aceite da RDL', rdlEm]] as [string, string][]) : []),
  ]
  doc.setFontSize(7)
  const altLinhas = reg.map(([, v]) => (doc.splitTextToSize(v, LARG - 44) as string[]).length)
  const h = 16 + altLinhas.reduce((a, b) => a + b * 3.3 + 0.8, 0) + 9
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
  reg.forEach(([kk, v], i) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...NAVY)
    doc.text(kk, X + 5, yy)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TXT)
    const ls = doc.splitTextToSize(v, LARG - 44) as string[]
    doc.text(ls, X + 40, yy)
    yy += altLinhas[i] * 3.3 + 0.8
  })
  doc.setFontSize(6.6)
  doc.setTextColor(...MUT)
  doc.text('Qualquer alteração no texto muda o código SHA-256 acima: é assim que se confere que este é o documento assinado.', X + 5, y + h - 4, { maxWidth: LARG - 10 })
  y += h

  /* rodapé em todas as folhas */
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
    doc.text(RDL_INFO.engineer, X, 287)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.text(`${RDL_INFO.company} · CNPJ ${RDL_INFO.cnpj}`, X, 291.5)
    doc.text(`${RDL_INFO.phone} · ${RDL_INFO.email}`, 190 - 14, 287, { align: 'right' })
    doc.text(`Reserva nº ${r.id.slice(0, 8).toUpperCase()} · código ${k.codigo.slice(0, 12)}`, 190 - 14, 291.5, { align: 'right' })
    doc.setFillColor(...ORANGE)
    doc.roundedRect(181, 284.5, 9, 7, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(String(p), 185.5, 289.2, { align: 'center' })
  }
  return doc.output('blob')
}

/** Abre o PDF do contrato (o navegador mostra; no celular dá para salvar ou compartilhar). */
export async function abrirContratoPdf(r: Pick<Reserva, 'contrato' | 'status' | 'id'>) {
  // a janela abre já no toque (senão o celular bloqueia) e recebe o PDF quando ficar pronto
  const w = window.open('', '_blank')
  w?.document.write('<p style="font-family:sans-serif;padding:24px;color:#012C60">Gerando o contrato em PDF…</p>')
  try {
    const blob = await contratoPdf(r)
    const url = URL.createObjectURL(blob)
    if (w) w.location.href = url
    else {
      const a = document.createElement('a')
      a.href = url
      a.download = `Contrato RDL ${r.id.slice(0, 8).toUpperCase()}.pdf`
      a.click()
    }
    return true
  } catch (e) {
    console.error(e)
    w?.close()
    return false
  }
}
