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
}

const MAX_IMAGES = 12

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

/** Imagens do PDF (fotos e ilustrações grandes), página por página. */
async function pdfImages(file: File): Promise<Blob[][]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: Blob[][] = []
  let count = 0
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const ops = await page.getOperatorList()
    const found: Blob[] = []
    for (let i = 0; i < ops.fnArray.length && count < MAX_IMAGES; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue
      const name = ops.argsArray[i][0] as string
      const img = await new Promise<{ width: number; height: number; data?: Uint8ClampedArray; bitmap?: ImageBitmap; kind?: number } | null>((ok) => {
        try {
          page.objs.get(name, (o: unknown) => ok(o as never))
        } catch {
          ok(null)
        }
      })
      if (!img || img.width < 160 || img.height < 120) continue
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0)
      else if (img.data) {
        // RGB (kind 2) ou RGBA (kind 3)
        const rgba = img.data.length === img.width * img.height * 4 ? img.data : (() => {
          const out = new Uint8ClampedArray(img.width * img.height * 4)
          for (let s = 0, d = 0; s < img.data!.length; s += 3, d += 4) {
            out[d] = img.data![s]
            out[d + 1] = img.data![s + 1]
            out[d + 2] = img.data![s + 2]
            out[d + 3] = 255
          }
          return out
        })()
        ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), img.width, img.height), 0, 0)
      } else continue
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8))
      if (blob) {
        found.push(blob)
        count++
      }
    }
    pages.push(found)
  }
  return pages
}

async function pdfParas(file: File): Promise<Para[]> {
  const { fromPdf } = await import('./contractImport')
  const text = await fromPdf(file)
  const paras: Para[] = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({ text: l, title: l === l.toUpperCase() && /[A-ZÁÉÍÓÚ]{4}/.test(l) && l.length < 70 && !/\?$/.test(l), list: /^(•|-|–|\*|☐|□|\[ ?\]|\( ?\)|[a-z]\))\s*/.test(l), images: [] }))
  // as imagens do PDF entram no fim de cada página não dá para saber; ficam nas primeiras perguntas de referência visual
  try {
    const imgs = (await pdfImages(file)).flat()
    if (imgs.length) paras.push({ text: '', title: false, list: false, images: imgs })
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
  if (options.length >= 2) return checkbox ? 'multi' : 'choice'
  if (/\b(foto|fotos|imagem|imagens|anexe|anexar|refer[êe]ncias visuais)\b/i.test(label)) return 'photos'
  if (/^(data|quando)\b|\bdata de\b|\bprazo\b/i.test(label) && label.length < 60) return 'date'
  if (/\b(nome|telefone|whats|e-?mail|idade|profiss[ãa]o|cidade|bairro|cep|endere[çc]o|cpf|metragem|m²|área)\b/i.test(label) && label.length < 60) return 'text'
  return 'long'
}

async function toDataUrl(b: Blob) {
  const { compressImage } = await import('./studioApi')
  const small = await compressImage(new File([b], 'img.jpg', { type: b.type || 'image/jpeg' }), 640, 0.7)
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
    } else if (t && (p.list || OPTION.test(t)) && current() && !isQuestion(t.replace(OPTION, ''))) {
      const q = current()
      const opt = t.replace(OPTION, '').trim()
      if (opt) q.options = [...(q.options ?? []), opt]
      if (CHECKBOX.test(t)) checkboxOf.set(q.id, true)
      lastOpt = opt
      if (opt && p.images.length) {
        const m = optImagesOf.get(q.id) ?? new Map<string, Blob>()
        m.set(opt, p.images[0])
        optImagesOf.set(q.id, m)
        continue
      }
    } else if (t && isQuestion(t)) {
      if (!section) newSection('perguntas')
      const q: BriefingQuestion = { id: `q-${uid()}`, section, label: t.replace(NUMBERED, '').replace(/:\s*$/, '').trim(), kind: 'long' }
      questions.push(q)
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
    name: (docTitle || file.name.replace(/\.[^.]+$/, '')).slice(0, 60),
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
