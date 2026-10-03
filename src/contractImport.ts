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
  // cabeçalho do papel timbrado (nome do estúdio, contatos) antes do título: o modelo já põe o da conta
  const head = out.findIndex((l, i) => i < 14 && /^\s*(instrumento particular\b|contrato\s+(de|particular)\b)/i.test(l))
  if (head > 0) out.splice(0, head)
  return out
    .join('\n')
    // letras espaçadas (A R Q U I T E T U R A) voltam a ser uma palavra
    .replace(/\b(?:\p{L} ){3,}\p{L}\b/gu, (m) => m.replace(/ /g, ''))
    .trim()
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
    const { uniqueItems, pdfRows } = await import('./pdfText')
    const rows = pdfRows(
      uniqueItems(content.items.filter((it) => 'str' in it) as { str: string; transform: number[]; width: number; height: number }[]).map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size: Math.hypot(it.transform[2], it.transform[3]) || it.height || 12 })),
    )
    let out = ''
    let lastY: number | null = null
    let lastH = 12
    for (const r of rows) {
      // linha nova; espaço maior que uma linha e meia = parágrafo novo
      if (lastY !== null) out = out.replace(/\n+$/, '') + (Math.abs(lastY - r.y) > lastH * 1.8 ? '\n\n' : '\n')
      out += r.items.reduce((acc, it, k) => {
        const prev = r.items[k - 1]
        const gap = prev ? it.x - (prev.x + prev.w) : 0
        return acc + (prev && (gap > it.size * 0.18 || /^\d{1,2}$/.test(prev.str.trim())) && !/\s$/.test(acc) && !/^\s/.test(it.str) ? ' ' : '') + it.str
      }, '')
      lastY = r.y
      lastH = r.size
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

/** Linhas do PDF, página por página, com o tamanho da letra (para achar títulos) e sem o que se repete em toda página. */
export async function pdfPageRows(file: File): Promise<{ text: string; size: number; x: number; y: number; pieces: { str: string; x: number; w: number }[] }[][]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const { uniqueItems, pdfRows } = await import('./pdfText')
  const pages: { text: string; size: number; x: number; y: number; pieces: { str: string; x: number; w: number }[] }[][] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent()
    const rows = pdfRows(
      uniqueItems(content.items.filter((it) => 'str' in it) as { str: string; transform: number[]; width: number; height: number }[]).map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size: Math.hypot(it.transform[2], it.transform[3]) || it.height || 12 })),
    )
    pages.push(
      rows
        .map((r) => ({
          text: r.items
            .reduce((acc, it, k) => {
              const prev = r.items[k - 1]
              const gap = prev ? it.x - (prev.x + prev.w) : 0
              return acc + (prev && gap > it.size * 0.18 && !/\s$/.test(acc) && !/^\s/.test(it.str) ? ' ' : '') + it.str
            }, '')
            .replace(/\s+/g, ' ')
            .trim(),
          size: r.size,
          x: r.x0,
          y: r.y,
          pieces: r.items.map((it) => ({ str: it.str, x: it.x, w: it.w })),
        }))
        .filter((r) => r.text),
    )
  }
  // cabeçalho/rodapé (marca, site, nº): o mesmo texto curto na mesma altura em várias páginas
  const seen = new Map<string, number>()
  for (const pg of pages) for (const r of new Set(pg.map((r) => `${r.text}@${Math.round(r.y / 6)}`))) seen.set(r, (seen.get(r) ?? 0) + 1)
  return pages.map((pg) => pg.filter((r) => !(pages.length > 1 && r.text.length < 40 && (seen.get(`${r.text}@${Math.round(r.y / 6)}`) ?? 0) >= 2)))
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
    const { docxToHtml, structuredText } = await import('./contractHtml')
    const html = dropSignLines(await docxToHtml(file))
    const body = tidy(structuredText(html))
    if (body.length < 40) throw new Error('vazio')
    return { body, html }
  }
  if (name.endsWith('.pdf')) {
    // PDF com texto: mesmo desenho (títulos, negrito, centralizado…); se não der, só o texto
    try {
      const { pdfToHtml, structuredText } = await import('./contractHtml')
      const html = dropSignLines(await pdfToHtml(file))
      const body = tidy(structuredText(html))
      if (body.length >= 40) return { body, html }
    } catch (e) {
      if (e instanceof Error && e.message === 'pdf-imagem') throw e
    }
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
