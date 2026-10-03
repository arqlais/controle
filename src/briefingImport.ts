import type { BriefingKind, BriefingQuestion, BriefingSection, BriefingTemplate } from './types'
import { uid } from './utils'

/* Importar o briefing que a pessoa já usa (Word, PDF ou texto) para um modelo editável.
   Títulos viram partes, perguntas viram perguntas (com as opções de marcar logo abaixo),
   e as imagens do Word entram como referência na pergunta mais próxima. */

interface Para {
  text: string
  title: boolean // título / negrito curto
  list: boolean // item de lista (opção)
  images: Blob[]
  ask?: boolean // linha seguida de opções: é pergunta, mesmo sem "?"
  x?: number // posição na página (PDF em colunas: a opção vai para a pergunta da mesma coluna)
  blank?: boolean // opção sem nome (só a bolinha embaixo de uma foto)
  y?: number
  page?: number
}

const MAX_IMAGES = 30

async function docxParas(file: File): Promise<Para[]> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('vazio')
  const relsXml = (await zip.file('word/_rels/document.xml.rels')?.async('string')) ?? ''
  const rels = new Map<string, string>()
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) rels.set(m[1], m[2])
  for (const m of relsXml.matchAll(/Target="([^"]+)"[^>]*Id="([^"]+)"/g)) rels.set(m[2], m[1])
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  let imgCount = 0
  const out: Para[] = []
  for (const p of [...doc.getElementsByTagNameNS(W, 'p')]) {
    let text = ''
    let allBold = true
    let hasText = false
    for (const r of [...p.getElementsByTagNameNS(W, 'r')]) {
      let chunk = ''
      for (const n of [...r.childNodes] as Element[]) {
        if (n.localName === 't') chunk += n.textContent ?? ''
        else if (n.localName === 'tab') chunk += ' '
        else if (n.localName === 'br') chunk += ' '
      }
      if (chunk.trim()) {
        hasText = true
        const b = r.getElementsByTagNameNS(W, 'b')[0]
        if (!b || b.getAttributeNS(W, 'val') === '0' || b.getAttributeNS(W, 'val') === 'false') allBold = false
      }
      text += chunk
    }
    // imagens do parágrafo (a:blip r:embed="rIdX")
    const images: Blob[] = []
    for (const el of [...p.getElementsByTagName('*')]) {
      if (el.localName !== 'blip' || imgCount >= MAX_IMAGES) continue
      const rid = el.getAttribute('r:embed') ?? [...el.attributes].find((a) => a.localName === 'embed')?.value
      const target = rid ? rels.get(rid) : undefined
      const f = target ? zip.file(`word/${target.replace(/^\/?word\//, '').replace(/^\.\//, '')}`) : null
      if (!f || !/\.(png|jpe?g|gif|webp|bmp)$/i.test(target!)) continue
      const ext = target!.split('.').pop()!.toLowerCase()
      images.push(new Blob([await f.async('arraybuffer')], { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` }))
      imgCount++
    }
    const style = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') ?? ''
    const t = text.replace(/\s+/g, ' ').trim()
    if (!t && !images.length) continue
    out.push({
      text: t,
      title: !!t && (/heading|t[ií]tulo/i.test(style) || (hasText && allBold && t.length < 70 && !/[?:]$/.test(t))),
      list: p.getElementsByTagNameNS(W, 'numPr').length > 0,
      images,
    })
  }
  return out
}

type PdfImg = { blob: Blob; x: number; y: number; w: number; h: number }

/** Imagem quase lisa (pouca variação de cor)? */
function flat(canvas: HTMLCanvasElement) {
  const c = document.createElement('canvas')
  c.width = c.height = 24
  const ctx = c.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, 24, 24)
  const d = ctx.getImageData(0, 0, 24, 24).data
  let sum = 0
  let sq = 0
  const n = d.length / 4
  for (let i = 0; i < d.length; i += 4) {
    const v = (d[i] + d[i + 1] + d[i + 2]) / 3
    sum += v
    sq += v * v
  }
  const mean = sum / n
  return Math.sqrt(Math.max(0, sq / n - mean * mean)) < 9
}

/** Imagens do PDF com a posição na página (fotos e ilustrações grandes).
    O que se repete em quase todas as páginas (fundo, logotipo, faixa do cabeçalho) fica de fora. */
async function pdfImages(file: File): Promise<PdfImg[][]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  type Raw = { name: string; page: number; x: number; y: number; w: number; h: number; iw: number; ih: number }
  const raws: Raw[] = []
  const pagesObj: Awaited<ReturnType<typeof pdf.getPage>>[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    pagesObj.push(page)
    const ops = await page.getOperatorList()
    // posição: acompanha a matriz de transformação (salvar/restaurar/transformar) até cada imagem
    let m = [1, 0, 0, 1, 0, 0]
    const stack: number[][] = []
    const mul = (a: number[], b: number[]) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]
      if (fn === pdfjs.OPS.save) stack.push(m)
      else if (fn === pdfjs.OPS.restore) m = stack.pop() ?? [1, 0, 0, 1, 0, 0]
      else if (fn === pdfjs.OPS.transform) m = mul(m, ops.argsArray[i] as number[])
      else if (fn === pdfjs.OPS.paintImageXObject) {
        const [name, iw, ih] = ops.argsArray[i] as [string, number, number]
        const w = Math.hypot(m[0], m[1])
        const h = Math.hypot(m[2], m[3])
        raws.push({ name, page: n - 1, x: m[4], y: m[5], w, h, iw: iw ?? 0, ih: ih ?? 0 })
      }
    }
  }
  // repetida em várias páginas (mesmo tamanho e posição): fundo, logotipo, cabeçalho
  const key = (r: Raw) => `${Math.round(r.x / 4)}:${Math.round(r.y / 4)}:${Math.round(r.w / 4)}:${Math.round(r.h / 4)}`
  const pagesWith = new Map<string, Set<number>>()
  for (const r of raws) pagesWith.set(key(r), (pagesWith.get(key(r)) ?? new Set()).add(r.page))
  const out: PdfImg[][] = pagesObj.map(() => [])
  let count = 0
  for (const r of raws) {
    if (count >= MAX_IMAGES) break
    if (pdf.numPages > 1 && (pagesWith.get(key(r))?.size ?? 0) >= 2) continue
    if (r.w < 40 || r.h < 40) continue
    const page = pagesObj[r.page]
    const img = await new Promise<{ width: number; height: number; data?: Uint8ClampedArray; bitmap?: ImageBitmap } | null>((ok) => {
      try {
        page.objs.get(r.name, (o: unknown) => ok(o as never))
      } catch {
        ok(null)
      }
    })
    if (!img || img.width < 120 || img.height < 90) continue
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0)
    else if (img.data) {
      // RGB (3 bytes por ponto) ou RGBA (4)
      const rgba =
        img.data.length === img.width * img.height * 4
          ? img.data
          : (() => {
              const o = new Uint8ClampedArray(img.width * img.height * 4)
              for (let s2 = 0, d = 0; s2 < img.data!.length; s2 += 3, d += 4) {
                o[d] = img.data![s2]
                o[d + 1] = img.data![s2 + 1]
                o[d + 2] = img.data![s2 + 2]
                o[d + 3] = 255
              }
              return o
            })()
      ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), img.width, img.height), 0, 0)
    } else continue
    // grande e quase de uma cor só: marca-d'água ou textura de fundo (amostras de cor pequenas continuam)
    if (r.w * r.h > 40000 && flat(canvas)) continue
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8))
    if (blob) {
      out[r.page].push({ blob, x: r.x, y: r.y, w: r.w, h: r.h })
      count++
    }
  }
  return out
}

// marcadores de opção que os PDFs de briefing usam: bolinha (às vezes a letra O), quadradinho, travessão…
const MARK = '(?:O|o|○|◯|●|◉|⚪|☐|□|■|▢|❍|•|–|-|\\*)'
const MULTI_MARK = new RegExp(`(?:^|\\s)${MARK}\\s+(?=[A-ZÀ-ÚÇ0-9(])`, 'g')
const LEFT_MARK = new RegExp(`^(${MARK}\\s+)+`)

async function pdfParas(file: File): Promise<Para[]> {
  const { pdfPageRows } = await import('./contractImport')
  const pages = await pdfPageRows(file)
  const rows = pages.flatMap((pg, page) => pg.map((r) => ({ ...r, page })))
  if (!rows.length) throw new Error('pdf-imagem')
  const sizes = rows.map((r) => r.size).sort((a, b) => a - b)
  const body = sizes[Math.floor(sizes.length / 2)] ?? 10
  const paras: Para[] = []
  let parents: { x: number; text: string; size: number }[] = []
  let lastRow: (typeof rows)[number] | null = null // opções "mãe" (Geladeira, Microondas…) da última linha de opções maior
  for (const r of rows) {
    const t = r.text
    const marks = [...t.matchAll(MULTI_MARK)]
    // só marcadores, sem texto (fotos com bolinha embaixo): uma opção por marcador, sem nome
    if (/^((O|o|○|◯|●|◉|☐|□|❍)\s*)+$/.test(t)) {
      const n = t.replace(/\s+/g, '').length
      // posição de cada bolinha: a de cada pedaço; se vierem juntas num pedaço só, espalha pela linha
      const xs = r.pieces.length === n ? r.pieces.map((pc) => pc.x) : Array.from({ length: n }, (_, k) => r.x + k * 245)
      for (let k = 0; k < n; k++) paras.push({ text: '• ', title: false, list: true, images: [], x: xs[k], y: r.y, page: r.page, blank: true })
      continue
    }
    // várias opções na mesma linha ("O Moradia  O Universitário"): uma por opção, cada uma com a sua posição
    if (marks.length && (marks[0].index ?? 0) === 0) {
      const parts = t.split(MULTI_MARK).map((x) => x.replace(LEFT_MARK, '').trim()).filter(Boolean)
      // posição de cada opção: onde a palavra começa dentro do pedaço de texto (proporcional às letras)
      const xs = parts.map((part) => {
        const pc = r.pieces.find((x) => x.str.includes(part.split(' ')[0]))
        if (!pc) return r.x
        const at = pc.str.indexOf(part.split(' ')[0])
        return pc.x + (pc.str.length ? (at / pc.str.length) * pc.w : 0)
      })
      const child = parents.length > 0 && r.size < parents[0].size * 0.9
      parts.forEach((part, k) => {
        const x = xs[k]
        // sub-opção (letra menor, logo abaixo): leva o nome da opção de cima ("Geladeira · Duplex")
        const parent = child ? [...parents].filter((pp) => pp.x <= x + 30).sort((a, c) => c.x - a.x)[0] : undefined
        const label = parent ? `${parent.text} · ${/^[a-zà-ú]/.test(part) ? part : part}` : part
        paras.push({ text: `• ${label}`, title: false, list: true, images: [], x, y: r.y, page: r.page })
      })
      if (!child) parents = parts.map((part, k) => ({ x: xs[k], text: part, size: r.size }))
      continue
    }
    parents = []
    // letra miúda (legenda de foto, "fotos ilustrativas"): não é pergunta
    if (r.size < body * 0.75) continue
    // pergunta que quebrou em duas linhas no PDF: junta com a de cima
    const prev = paras[paras.length - 1]
    const prevRow = lastRow
    lastRow = r
    if (prev && prevRow && !prev.list && !prev.title && Math.abs(prevRow.x - r.x) < 8 && prevRow.y - r.y < r.size * 1.8 && Math.abs(prevRow.size - r.size) < 0.6 && !/[?:.!]$/.test(prev.text)) {
      prev.text = `${prev.text} ${t}`
      continue
    }
    const big = r.size >= body * 1.3
    paras.push({ text: t, title: big && t.length < 70 && !/\?$/.test(t), list: OPTION.test(t), images: [], x: r.x, y: r.y, page: r.page })
  }
  // uma linha seguida de opções é a pergunta dessas opções (mesmo sem "?")
  paras.forEach((p, i) => {
    if (!p.list && !p.title && paras[i + 1]?.list) p.ask = true
  })
  // bloco de cada opção: do título da pergunta dela até o título da próxima pergunta (na mesma página)
  const blockOf = new Map<Para, [number, number]>()
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]
    if (!p.list || p.y === undefined) continue
    let top = Infinity
    for (let k = i - 1; k >= 0; k--) if (!paras[k].list && paras[k].page === p.page && paras[k].y !== undefined) ((top = paras[k].y!), (k = -1))
    let bottom = -Infinity
    for (let k = i + 1; k < paras.length; k++) if (!paras[k].list && paras[k].page === p.page && paras[k].y !== undefined) ((bottom = paras[k].y!), (k = paras.length))
    blockOf.set(p, [top, bottom])
  }
  // fotos: cada uma vai para a opção logo abaixo dela (a bolinha embaixo da foto); as que sobram, para a pergunta de cima
  try {
    const imgs = await pdfImages(file)
    imgs.forEach((list, page) => {
      const opts = paras.filter((p) => p.page === page && p.list && p.x !== undefined && p.y !== undefined)
      const freeImgs = new Set(list)
      // distância da bolinha/opção até a foto (0 se estiver em cima dela)
      const dist = (o: Para, im: PdfImg) => {
        const dx = o.x! < im.x ? im.x - o.x! : o.x! > im.x + im.w ? o.x! - (im.x + im.w) : 0
        const dy = o.y! < im.y ? im.y - o.y! : o.y! > im.y + im.h ? o.y! - (im.y + im.h) : 0
        return Math.hypot(dx, dy)
      }
      // pares opção–foto do mais perto para o mais longe (a amostra "AZUL" fica com o nome logo acima dela)
      // a bolinha fica junto da borda de cima da foto (logo acima ou no canto): pesa também a distância até essa borda
      const pairs = opts
        .flatMap((o) => list.map((im) => ({ o, im, d: dist(o, im), top: Math.abs(o.y! - (im.y + im.h)) })))
        .filter((x) => {
          if (x.d >= 90) return false
          // a foto tem que estar no bloco da pergunta da opção (a "Cortina" de cima não pega a foto da "Estofada")
          const [top, bottom] = blockOf.get(x.o) ?? [Infinity, -Infinity]
          const mid = x.im.y + x.im.h / 2
          return mid < top + 4 && mid > bottom - 4
        })
        .map((x) => ({ ...x, score: x.d + x.top * 0.5 }))
        .sort((a, c) => a.score - c.score)
      const usedOpts = new Set<Para>()
      for (const { o, im } of pairs) {
        if (usedOpts.has(o) || !freeImgs.has(im)) continue
        o.images.push(im.blob)
        usedOpts.add(o)
        freeImgs.delete(im)
      }
      // as que sobram: referência da pergunta logo acima, na mesma página
      for (const im of freeImgs) {
        const q = paras.filter((p) => p.page === page && !p.list && p.text && p.y !== undefined && p.y > im.y + im.h - 4).sort((a, c) => a.y! - c.y!)[0]
        if (q) q.images.push(im.blob)
      }
    })
  } catch {
    /* PDF sem imagens legíveis: segue só com o texto */
  }
  return paras
}

const OPTION = /^(•|-|–|\*|☐|□|○|◯|\[ ?\]|\( ?\)|[a-z]\)|[a-z]\.)\s*/
const CHECKBOX = /^(☐|□|\[ ?\])/
const NUMBERED = /^\(?\d{1,3}[.)-]\s+/
const isQuestion = (t: string) => /\?\s*$/.test(t) || NUMBERED.test(t) || (/:\s*$/.test(t) && t.length < 120)

function kindFor(label: string, options: string[], checkbox: boolean): BriefingKind {
  if (options.length >= 2 && options.every((o) => /^(sim|não|nao|talvez|não sei)$/i.test(o.trim()))) return 'choice'
  if (options.length >= 2) return checkbox || /\b(quais|marque|equipamentos?|itens|pode escolher mais|selecione|necessidades|tecnologias|detalhes|ambientes|deseja ter)\b/i.test(label) ? 'multi' : 'choice'
  if (/\b(foto|fotos|imagem|imagens|anexe|anexar|refer[êe]ncias visuais)\b/i.test(label)) return 'photos'
  if (/^(data|quando)\b|\bdata de\b|\bprazo\b/i.test(label) && label.length < 60) return 'date'
  if (label.length < 32 && !/\?$/.test(label)) return 'text'
  if (/\b(nome|telefone|whats|e-?mail|idade|profiss[ãa]o|cidade|bairro|cep|endere[çc]o|cpf|metragem|m²|área)\b/i.test(label) && label.length < 60) return 'text'
  return 'long'
}

async function toDataUrl(b: Blob) {
  const { compressImage } = await import('./studioApi')
  const small = await compressImage(new File([b], 'img.jpg', { type: b.type || 'image/jpeg' }), 560, 0.68)
  return new Promise<string>((ok, bad) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => bad(r.error)
    r.readAsDataURL(small)
  })
}

/** Lê o arquivo e monta o modelo de briefing (tudo editável depois). */
export async function importBriefingFile(file: File): Promise<BriefingTemplate> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.doc')) throw new Error('doc')
  const paras: Para[] = name.endsWith('.docx')
    ? await docxParas(file)
    : name.endsWith('.pdf')
      ? await pdfParas(file)
      : (await file.text()).split(/\n/).map((l) => ({ text: l.trim(), title: false, list: OPTION.test(l.trim()), images: [] })).filter((p) => p.text)

  const sections: BriefingSection[] = []
  const questions: BriefingQuestion[] = []
  let section = ''
  let docTitle = ''
  let pending: Blob[] = [] // imagens antes da primeira pergunta
  const newSection = (title: string) => {
    const id = `s-${uid()}`
    sections.push({ id, title: title.toLowerCase().replace(/^\d+[.)]\s*/, '').slice(0, 60) })
    section = id
  }
  const current = () => questions[questions.length - 1]
  const checkboxOf = new Map<string, boolean>()
  const xOf = new Map<string, number>() // posição da pergunta na página (PDF)
  const imagesOf = new Map<string, Blob[]>()
  const optImagesOf = new Map<string, Map<string, Blob>>() // foto de cada opção (imagem na linha da opção ou logo abaixo dela)
  let lastOpt = ''

  for (const p of paras) {
    const t = p.text
    if (t && !docTitle && p.title && !questions.length && !sections.length) {
      docTitle = t
      if (p.images.length) pending.push(...p.images)
      continue
    }
    if (t && p.title && !isQuestion(t)) {
      newSection(t)
    } else if (t && current() && /^(•\s*)?outr[oa]s?\s*[?:.]?\s*$/i.test(t)) {
      current().other = true // "Outro?" no fim das opções: o cliente escreve
    } else if (t && (p.list || OPTION.test(t)) && current() && (p.blank || !isQuestion(t.replace(OPTION, '')))) {
      // PDF em colunas: a opção vai para a pergunta da mesma coluna (a mais próxima à esquerda, entre as últimas)
      const recent = questions.slice(-4).filter((x) => x.section === section && xOf.has(x.id))
      const col = p.x === undefined ? [] : recent.filter((x) => xOf.get(x.id)! <= p.x! + 24)
      // mesma coluna = a posição mais à direita entre as que ficam à esquerda da opção (folga de 24); dentro dela, a pergunta mais recente
      const colX = col.length ? Math.max(...col.map((x) => xOf.get(x.id)!)) : 0
      const q = col.length ? col.filter((x) => xOf.get(x.id)! >= colX - 24).pop()! : current()
      const opt = p.blank ? `opção ${(q.options?.length ?? 0) + 1}` : t.replace(OPTION, '').trim()
      if (opt) q.options = [...(q.options ?? []), opt]
      if (CHECKBOX.test(t)) checkboxOf.set(q.id, true)
      lastOpt = opt
      if (opt && p.images.length) {
        const m = optImagesOf.get(q.id) ?? new Map<string, Blob>()
        m.set(opt, p.images[0])
        optImagesOf.set(q.id, m)
        continue
      }
    } else if (t && (isQuestion(t) || p.ask)) {
      if (!section) newSection('perguntas')
      const q: BriefingQuestion = { id: `q-${uid()}`, section, label: t.replace(NUMBERED, '').replace(/:\s*$/, '').trim(), kind: 'long' }
      questions.push(q)
      if (p.x !== undefined) xOf.set(q.id, p.x)
      if (pending.length) {
        imagesOf.set(q.id, pending)
        pending = []
      }
    } else if (t && current() && !current().hint && t.length < 200) {
      current().hint = t // explicação logo abaixo da pergunta
    }
    if (t && !(p.list || OPTION.test(t))) lastOpt = ''
    if (p.images.length) {
      const q = current()
      // imagem sozinha logo abaixo de uma opção que ainda não tem foto: é a foto dessa opção
      if (q && !t && lastOpt && !optImagesOf.get(q.id)?.has(lastOpt)) {
        const m = optImagesOf.get(q.id) ?? new Map<string, Blob>()
        m.set(lastOpt, p.images[0])
        optImagesOf.set(q.id, m)
        continue
      }
      if (q) imagesOf.set(q.id, [...(imagesOf.get(q.id) ?? []), ...p.images])
      else pending.push(...p.images)
    }
  }
  if (!questions.length) throw new Error('sem-perguntas')

  for (const q of questions) {
    if (q.options) q.options = [...new Set(q.options)]
    const opts = q.options ?? []
    q.kind = kindFor(q.label, opts, !!checkboxOf.get(q.id))
    if (q.kind === 'choice' || q.kind === 'multi') {
      if (opts.some((o) => /^outr[oa]s?\b/i.test(o))) {
        q.options = opts.filter((o) => !/^outr[oa]s?\b/i.test(o))
        q.other = true
      }
    } else delete q.options
    let imgs = imagesOf.get(q.id) ?? []
    const per = optImagesOf.get(q.id)
    // fotos da pergunta sem opções (ex.: "qual destas referências você gosta?"): cada foto vira uma opção para tocar
    if (imgs.length >= 2 && !(q.options ?? []).length && q.kind !== 'photos') {
      q.kind = 'multi'
      q.options = imgs.map((_, i) => `referência ${i + 1}`)
    }
    const o = q.options ?? []
    if ((q.kind === 'choice' || q.kind === 'multi') && o.length) {
      const map = new Map(per ?? [])
      // tantas fotos quanto opções, em sequência: uma para cada opção, na mesma ordem do arquivo
      if (!map.size && imgs.length === o.length) {
        o.forEach((opt, i) => map.set(opt, imgs[i]))
        imgs = []
      }
      if (map.size) {
        q.optionImages = Object.fromEntries(await Promise.all([...map].map(async ([k, b]) => [k, await toDataUrl(b)] as const)))
        q.photoCols = o.length <= 2 ? 2 : o.length === 3 ? 3 : o.length === 4 ? 4 : o.length % 3 === 0 ? 3 : 4
      }
    }
    if (imgs.length) q.images = await Promise.all(imgs.map(toDataUrl))
  }
  // imagens que sobraram sem pergunta (fim do arquivo): viram referência da primeira pergunta de estilo/referências, ou da primeira
  if (pending.length) {
    const target = questions.find((q) => /estilo|refer[êe]ncia|inspira/i.test(q.label)) ?? questions[0]
    target.images = [...(target.images ?? []), ...(await Promise.all(pending.map(toDataUrl)))]
  }
  const used = new Set(questions.map((q) => q.section))
  return {
    id: `meu-${uid()}`,
    // título genérico ("BRIEFING") + o primeiro título do arquivo ("studio") = "Briefing studio"
    name: (/^briefing$/i.test(docTitle.trim()) && sections[0] ? `Briefing ${sections[0].title}` : docTitle ? (docTitle === docTitle.toUpperCase() ? docTitle.charAt(0) + docTitle.slice(1).toLowerCase() : docTitle) : file.name.replace(/\.[^.]+$/, '')).slice(0, 60),
    description: 'importado do seu arquivo',
    icon: 'clip',
    sections: sections.filter((s) => used.has(s.id)),
    questions,
    updatedAt: new Date().toISOString(),
  }
}

export const BRIEFING_ACCEPT = '.docx,.pdf,.txt,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

export function briefingImportError(e: unknown) {
  const m = e instanceof Error ? e.message : ''
  if (m === 'doc') return 'Arquivo .doc antigo: no Word, use “Salvar como” → .docx (ou PDF) e anexe de novo.'
  if (m === 'sem-perguntas') return 'Não achei perguntas nesse arquivo. As perguntas precisam terminar com “?” ou ser numeradas (1., 2., 3.…).'
  if (m === 'pdf-imagem' || m === 'vazio') return 'Não achei texto nesse arquivo. Se for um PDF escaneado, anexe o arquivo do Word.'
  return 'Não consegui ler esse arquivo. Tente salvar como .docx ou PDF.'
}
