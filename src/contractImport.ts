/* Importar o contrato da própria pessoa (Word, PDF ou texto) para um modelo editável.
   Títulos em negrito do Word viram MAIÚSCULAS (o desenho do contrato trata como título de cláusula);
   linhas de assinatura somem, porque o quadro de assinatura das duas partes entra sozinho no fim. */

const SIGN_LINE = /^[\s_.\-–—]{5,}$/

function tidy(text: string) {
  const lines = text
    .replace(/\r/g, '')
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trimEnd())
    .filter((l) => !SIGN_LINE.test(l))
  // no máximo uma linha em branco seguida
  const out: string[] = []
  for (const l of lines) if (l.trim() || (out.length && out[out.length - 1].trim())) out.push(l.trim() ? l : '')
  // sobras do bloco de assinatura no fim (nomes das partes, testemunhas)
  const tail = /^(contratante|contratad[ao]|testemunhas?|assinatura|nome|cpf|rg)\b[\s:0-9._-]*$/i
  while (out.length && (!out[out.length - 1].trim() || tail.test(out[out.length - 1].trim()))) out.pop()
  return out.join('\n').trim()
}

async function fromDocx(file: File) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('arquivo do Word sem texto')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const paras = [...doc.getElementsByTagNameNS(W, 'p')]
  const lines = paras.map((p) => {
    let text = ''
    let allBold = true
    let hasText = false
    for (const r of [...p.getElementsByTagNameNS(W, 'r')]) {
      let chunk = ''
      for (const n of [...r.childNodes] as Element[]) {
        if (n.localName === 't') chunk += n.textContent ?? ''
        else if (n.localName === 'tab') chunk += ' '
        else if (n.localName === 'br') chunk += '\n'
      }
      if (chunk.trim()) {
        hasText = true
        const b = r.getElementsByTagNameNS(W, 'b')[0]
        if (!b || b.getAttributeNS(W, 'val') === '0' || b.getAttributeNS(W, 'val') === 'false') allBold = false
      }
      text += chunk
    }
    const style = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') ?? ''
    const list = p.getElementsByTagNameNS(W, 'numPr').length > 0
    const t = text.trim()
    // título: estilo de título do Word, ou parágrafo curto todo em negrito
    if (t && (/heading|t[ií]tulo/i.test(style) || (hasText && allBold && t.length < 90 && !/[.;:]$/.test(t)))) return t.toUpperCase()
    return list && t ? `• ${t}` : t
  })
  return lines.join('\n')
}

export async function fromPdf(file: File) {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    let out = ''
    let lastY: number | null = null
    let lastH = 12
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform[5]
      const h = item.height || lastH
      if (lastY !== null && Math.abs(y - lastY) > 1) {
        // linha nova; espaço maior que uma linha e meia = parágrafo novo
        out = out.replace(/\n+$/, '') + (Math.abs(lastY - y) > lastH * 1.8 ? '\n\n' : '\n')
      }
      if (item.str) out += item.str
      lastY = y
      lastH = h
    }
    pages.push(out)
  }
  // junta as linhas quebradas no meio da frase (o PDF quebra por largura, não por parágrafo)
  return pages
    .join('\n\n')
    .split(/\n{2,}/)
    .map((par) =>
      par
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .reduce((acc, l) => {
          if (!acc) return l
          const isTitle = l === l.toUpperCase() && /[A-ZÁÉÍÓÚ]{4}/.test(l)
          const prevEnds = /[.;:!?]$/.test(acc) || (acc.split('\n').pop()! === acc.split('\n').pop()!.toUpperCase() && /[A-ZÁÉÍÓÚ]{4}/.test(acc))
          return acc + (isTitle || prevEnds || /^(\d+[.)]|[a-z]\)|•|-)\s/.test(l) ? '\n' : ' ') + l
        }, ''),
    )
    .join('\n\n')
}

/** Lê o arquivo e devolve o texto pronto para o modelo. */
export async function importContractFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  let text = ''
  if (name.endsWith('.docx')) text = await fromDocx(file)
  else if (name.endsWith('.pdf')) text = await fromPdf(file)
  else if (name.endsWith('.doc')) throw new Error('doc')
  else text = await file.text()
  const out = tidy(text)
  if (out.length < 40) throw new Error(name.endsWith('.pdf') ? 'pdf-imagem' : 'vazio')
  return out
}

export const IMPORT_ACCEPT = '.docx,.pdf,.txt,.md,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

export function importError(e: unknown) {
  const m = e instanceof Error ? e.message : ''
  if (m === 'doc') return 'Arquivo .doc antigo: no Word, use “Salvar como” → .docx (ou PDF) e anexe de novo.'
  if (m === 'pdf-imagem') return 'Esse PDF parece ser uma imagem escaneada, sem texto para copiar. Anexe o arquivo do Word ou cole o texto.'
  if (m === 'vazio') return 'Não achei texto nesse arquivo. Tente o arquivo do Word, um PDF com texto, ou cole o texto.'
  return 'Não consegui ler esse arquivo. Tente salvar como .docx ou PDF, ou cole o texto.'
}

/* ---------- trocar dados fixos por etiquetas ---------- */

export interface FieldHint {
  text: string
  label: string // o que parece ser
  tag: string // etiqueta sugerida
}

const MONTHS = 'janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro'

/** Encontra no texto o que costuma mudar de um contrato para outro (CPF, valores, datas…) e sugere a etiqueta. */
export function findFields(body: string): FieldHint[] {
  const out: FieldHint[] = []
  const seen = new Set<string>()
  const add = (re: RegExp, label: string, tag: string) => {
    for (const m of body.matchAll(re)) {
      const t = m[0].trim()
      if (t && !seen.has(t)) {
        seen.add(t)
        out.push({ text: t, label, tag })
      }
    }
  }
  add(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, 'CNPJ', 'doc_contratada')
  add(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, 'CPF', 'doc_contratante')
  add(/R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g, 'valor', 'valor')
  add(new RegExp(`\\b\\d{1,2}\\s+de\\s+(?:${MONTHS})\\s+de\\s+\\d{4}\\b`, 'gi'), 'data', 'data')
  add(/\b\d{2}\/\d{2}\/\d{4}\b/g, 'data', 'data')
  add(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'e-mail', 'email_contratante')
  add(/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, 'telefone', 'telefone_contratante')
  add(/\b\d{5}-\d{3}\b/g, 'CEP', 'endereco_contratante')
  add(/_{3,}|\[[^\]\n]{2,40}\]|\.{5,}/g, 'espaço para preencher', 'contratante')
  return out.slice(0, 24)
}

/** Troca todas as ocorrências de um texto por uma etiqueta. */
export const swapAll = (body: string, text: string, tag: string) => body.split(text).join(`{${tag}}`)

/** Lê o arquivo: do Word sai também o desenho (HTML), para o contrato ficar igual ao da pessoa. */
export async function importContract(file: File): Promise<{ body: string; html?: string }> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) {
    const { docxToHtml, htmlToText } = await import('./contractHtml')
    const html = dropSignLines(await docxToHtml(file))
    const body = tidy(htmlToText(html))
    if (body.length < 40) throw new Error('vazio')
    return { body, html }
  }
  return { body: await importContractFile(file) }
}

/** No desenho do Word: tira as linhas de assinatura (o quadro de assinatura das duas partes entra sozinho no fim). */
function dropSignLines(html: string) {
  const d = new DOMParser().parseFromString(html, 'text/html')
  const root = d.body.querySelector('.ch-doc') ?? d.body
  const text = (el: Element) => (el.textContent ?? '').replace(/\u00a0/g, ' ').trim()
  root.querySelectorAll(':scope > p').forEach((p) => SIGN_LINE.test(text(p)) && text(p) && p.remove())
  const tail = /^(contratante|contratad[ao]|testemunhas?|assinatura|nome|cpf|rg)\b[\s:0-9._-]*$/i
  for (let last = root.lastElementChild; last && last.tagName === 'P' && (!text(last) || tail.test(text(last))); last = root.lastElementChild) last.remove()
  return d.body.innerHTML
}
