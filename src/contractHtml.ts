/* Contrato no modelo da própria pessoa: o arquivo do Word vira uma folha igual à dela (negrito, itálico,
   sublinhado, cores, tamanhos, alinhamento, recuos, listas, tabelas, imagens e símbolos), e continua editável.
   O texto puro (para a impressão digital da assinatura e para copiar) sai do mesmo HTML. */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const kids = (el: Element | null | undefined, name: string) => (el ? ([...el.children].filter((c) => c.localName === name && c.namespaceURI === W) as Element[]) : [])
const kid = (el: Element | null | undefined, name: string) => kids(el, name)[0] as Element | undefined
const attr = (el: Element | undefined, name: string) => el?.getAttributeNS(W, name) ?? el?.getAttribute(`w:${name}`) ?? null
const on = (el: Element | undefined) => !!el && !['0', 'false', 'off'].includes(attr(el, 'val') ?? '')

interface RunStyle {
  b?: boolean
  i?: boolean
  u?: boolean
  s?: boolean
  color?: string
  size?: number // pt
  font?: string
  hl?: string
  caps?: boolean
  sup?: boolean
  sub?: boolean
}

const HL: Record<string, string> = { yellow: '#fff3a3', green: '#d9f2d0', cyan: '#d3f1f5', magenta: '#f6d6ef', blue: '#d6e2f6', red: '#f8d4d4', lightGray: '#ececec', darkGray: '#bdbdbd' }

function runStyle(rPr: Element | undefined, base: RunStyle = {}): RunStyle {
  if (!rPr) return base
  const s: RunStyle = { ...base }
  const b = kid(rPr, 'b')
  if (b) s.b = on(b)
  const i = kid(rPr, 'i')
  if (i) s.i = on(i)
  const u = kid(rPr, 'u')
  if (u) s.u = attr(u, 'val') !== 'none'
  const st = kid(rPr, 'strike')
  if (st) s.s = on(st)
  const caps = kid(rPr, 'caps')
  if (caps) s.caps = on(caps)
  const c = attr(kid(rPr, 'color'), 'val')
  if (c && c !== 'auto' && /^[0-9a-f]{6}$/i.test(c)) s.color = `#${c}`
  const sz = attr(kid(rPr, 'sz'), 'val')
  if (sz) s.size = Number(sz) / 2
  const f = kid(rPr, 'rFonts')
  const font = attr(f, 'ascii') ?? attr(f, 'hAnsi')
  if (font) s.font = font
  const hl = attr(kid(rPr, 'highlight'), 'val')
  if (hl && HL[hl]) s.hl = HL[hl]
  const shd = attr(kid(rPr, 'shd'), 'fill')
  if (shd && /^[0-9a-f]{6}$/i.test(shd) && shd.toLowerCase() !== 'ffffff') s.hl = `#${shd}`
  const va = attr(kid(rPr, 'vertAlign'), 'val')
  if (va === 'superscript') s.sup = true
  if (va === 'subscript') s.sub = true
  return s
}

const css = (s: RunStyle, baseSize: number) =>
  [
    s.b && 'font-weight:700',
    s.i && 'font-style:italic',
    (s.u || s.s) && `text-decoration:${[s.u && 'underline', s.s && 'line-through'].filter(Boolean).join(' ')}`,
    s.color && `color:${s.color}`,
    s.size && Math.abs(s.size - baseSize) > 0.4 && `font-size:${(s.size / baseSize).toFixed(3)}em`,
    s.hl && `background:${s.hl}`,
    s.caps && 'text-transform:uppercase',
  ]
    .filter(Boolean)
    .join(';')

interface Ctx {
  styles: Map<string, { p?: Element; r?: Element; based?: string; name?: string }>
  rels: Map<string, string>
  media: Map<string, string> // caminho → data URL
  num: Map<string, Map<number, { fmt: string; text: string; start: number }>> // numId → níveis
  counters: Map<string, number[]>
  baseSize: number
}

function styleChain(ctx: Ctx, id: string | null, kind: 'p' | 'r'): Element[] {
  const out: Element[] = []
  let cur = id
  for (let n = 0; cur && n < 6; n++) {
    const st = ctx.styles.get(cur)
    if (!st) break
    const el = kind === 'r' ? st.r : st.p
    if (el) out.unshift(el)
    cur = st.based ?? null
  }
  return out
}

function roman(n: number) {
  const m: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
  let out = ''
  for (const [v, s] of m) while (n >= v) (out += s), (n -= v)
  return out
}
const fmtNum = (fmt: string, n: number) =>
  fmt === 'lowerLetter' ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : fmt === 'upperLetter' ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : fmt === 'lowerRoman' ? roman(n) : fmt === 'upperRoman' ? roman(n).toUpperCase() : String(n)

function listLabel(ctx: Ctx, numId: string, ilvl: number) {
  const levels = ctx.num.get(numId)
  const lvl = levels?.get(ilvl)
  if (!lvl) return '•'
  if (lvl.fmt === 'bullet') return /[-]/.test(lvl.text) || !lvl.text.trim() ? '•' : lvl.text
  if (lvl.fmt === 'none') return ''
  const c = ctx.counters.get(numId) ?? []
  c[ilvl] = (c[ilvl] ?? (lvl.start - 1)) + 1
  for (let k = ilvl + 1; k < 9; k++) c[k] = undefined as unknown as number
  ctx.counters.set(numId, c)
  return lvl.text.replace(/%(\d)/g, (_, d) => {
    const L = Number(d) - 1
    const l = levels?.get(L)
    return fmtNum(l?.fmt ?? 'decimal', c[L] ?? l?.start ?? 1)
  })
}

const twip = (v: string | null) => (v ? Math.round(Number(v) / 15) : 0) // 1px ≈ 15 twips

function runsHtml(ctx: Ctx, parent: Element, pBase: RunStyle): string {
  // junta trechos seguidos com o mesmo estilo (o Word quebra o texto em muitos pedaços, inclusive no meio de {etiquetas})
  const parts: { style: string; html: string }[] = []
  const push = (style: string, html: string) => {
    const last = parts[parts.length - 1]
    if (last && last.style === style) last.html += html
    else parts.push({ style, html })
  }
  const walk = (el: Element) => {
    for (const n of [...el.children]) {
      if (n.localName === 'r' && n.namespaceURI === W) {
        const rStyleId = attr(kid(kid(n, 'rPr'), 'rStyle'), 'val')
        let s = { ...pBase }
        for (const e of styleChain(ctx, rStyleId, 'r')) s = runStyle(e, s)
        s = runStyle(kid(n, 'rPr'), s)
        const style = css(s, ctx.baseSize)
        const wrap = (h: string) => (s.sup ? `<sup>${h}</sup>` : s.sub ? `<sub>${h}</sub>` : h)
        for (const c of [...n.children]) {
          const ln = c.localName
          if (ln === 't') push(style, wrap(esc(c.textContent ?? '')))
          else if (ln === 'tab') push(style, '<span class="ch-tab"></span>')
          else if (ln === 'br') push(style, attr(c, 'type') === 'page' ? '' : '<br>')
          else if (ln === 'sym') {
            const ch = parseInt(attr(c, 'char') ?? '', 16)
            const font = attr(c, 'font') ?? ''
            // símbolos do Wingdings/Symbol: os mais comuns viram o caractere equivalente
            const map: Record<number, string> = { 0xf0fc: '✓', 0xf0fb: '✗', 0xf0a7: '▪', 0xf0b7: '•', 0xf0d8: '➢', 0xf0e0: '→', 0xf0e8: '➔', 0xf06c: '●', 0xf06e: '■', 0xf0a8: '◆', 0xf076: '❖', 0xf0d2: '©', 0xf028: '☎', 0xf02a: '✉' }
            push(style, map[ch] ?? (ch >= 0xf000 ? `<span style="font-family:'${esc(font)}'">${String.fromCharCode(ch - 0xf000)}</span>` : String.fromCharCode(ch || 32)))
          } else if (ln === 'drawing' || ln === 'pict') {
            const blip = c.getElementsByTagNameNS(A, 'blip')[0]
            const rid = blip?.getAttributeNS(R, 'embed') ?? c.getElementsByTagNameNS('urn:schemas-microsoft-com:vml', 'imagedata')[0]?.getAttributeNS(R, 'id')
            const src = rid ? ctx.media.get(ctx.rels.get(rid) ?? '') : undefined
            if (src) {
              const ext = c.getElementsByTagNameNS(WP, 'extent')[0]
              const w = ext ? Math.round(Number(ext.getAttribute('cx')) / 9525) : 0
              push('', `<img src="${src}" alt="" style="${w ? `width:${Math.min(w, 640)}px;` : ''}max-width:100%;height:auto">`)
            }
          }
        }
      } else if (n.localName === 'hyperlink' || n.localName === 'smartTag' || n.localName === 'ins' || n.localName === 'sdt' || n.localName === 'sdtContent' || n.localName === 'fldSimple') walk(n)
    }
  }
  walk(parent)
  return parts.map((p) => (p.style ? `<span style="${p.style}">${p.html}</span>` : p.html)).join('')
}

function paraHtml(ctx: Ctx, p: Element): string {
  const pPr = kid(p, 'pPr')
  const styleId = attr(kid(pPr, 'pStyle'), 'val')
  let base: RunStyle = {}
  const chain: Element[] = []
  for (let cur = styleId, n = 0; cur && n < 6; n++) {
    const st = ctx.styles.get(cur)
    if (!st) break
    if (st.r) chain.unshift(st.r)
    cur = st.based ?? null
  }
  for (const e of chain) base = runStyle(e, base)
  base = runStyle(kid(pPr, 'rPr'), base) // marca de parágrafo: não muda o texto, mas costuma vir junto
  base = { ...base, b: chain.length ? base.b : undefined }
  const st: string[] = []
  const jc = attr(kid(pPr, 'jc'), 'val') ?? (styleId ? attr(kid(ctx.styles.get(styleId)?.p, 'jc'), 'val') : null)
  if (jc === 'center') st.push('text-align:center')
  else if (jc === 'right' || jc === 'end') st.push('text-align:right')
  else if (jc === 'both' || jc === 'distribute') st.push('text-align:justify')
  const ind = kid(pPr, 'ind')
  const left = twip(attr(ind, 'left') ?? attr(ind, 'start'))
  const first = twip(attr(ind, 'firstLine'))
  const hanging = twip(attr(ind, 'hanging'))
  const sp = kid(pPr, 'spacing')
  const after = attr(sp, 'after')
  const before = attr(sp, 'before')
  if (before && Number(before) > 0) st.push(`margin-top:${twip(before)}px`)
  st.push(`margin-bottom:${after !== null ? twip(after) : 8}px`)
  const shd = attr(kid(pPr, 'shd'), 'fill')
  if (shd && /^[0-9a-f]{6}$/i.test(shd) && shd.toLowerCase() !== 'ffffff') st.push(`background:#${shd};padding:4px 8px`)
  // lista: no parágrafo ou no estilo dele ("Lista numerada" do Word guarda a numeração no estilo)
  let numPr = kid(pPr, 'numPr')
  for (let cur = styleId, n = 0; !numPr && cur && n < 6; n++) {
    const st = ctx.styles.get(cur)
    numPr = kid(st?.p, 'numPr')
    cur = st?.based ?? null
  }
  let label = ''
  if (numPr) {
    const numId = attr(kid(numPr, 'numId'), 'val') ?? ''
    const ilvl = Number(attr(kid(numPr, 'ilvl'), 'val') ?? attr(kid(kid(pPr, 'numPr'), 'ilvl'), 'val') ?? 0)
    if (numId && numId !== '0') label = listLabel(ctx, numId, ilvl)
    if (!left) st.push(`padding-left:${24 + ilvl * 24}px`)
  }
  if (left) st.push(`padding-left:${left}px`)
  if (first) st.push(`text-indent:${first}px`)
  if (hanging && !numPr) st.push(`text-indent:-${hanging}px`)
  const inner = runsHtml(ctx, p, base)
  const heading = /heading\s?(\d)|t[ií]tulo\s?(\d)?/i.exec(ctx.styles.get(styleId ?? '')?.name ?? styleId ?? '')
  const pageBreak = [...p.getElementsByTagNameNS(W, 'br')].some((b) => attr(b, 'type') === 'page') || !!kid(pPr, 'pageBreakBefore')
  const lead = label ? `<span class="ch-num">${esc(label)}</span> ` : ''
  const tag = heading ? `h${Math.min(4, Number(heading[1] || heading[2] || 2) + 1)}` : 'p'
  const body = inner || (label ? '' : '<br>')
  return `${pageBreak ? '<div class="ch-break"></div>' : ''}<${tag} style="${st.join(';')}">${lead}${body}</${tag}>`
}

function tableHtml(ctx: Ctx, tbl: Element): string {
  const rows = kids(tbl, 'tr')
    .map((tr) => {
      const cells = kids(tr, 'tc')
        .map((tc) => {
          const tcPr = kid(tc, 'tcPr')
          const span = Number(attr(kid(tcPr, 'gridSpan'), 'val') ?? 1)
          const fill = attr(kid(tcPr, 'shd'), 'fill')
          const vm = kid(tcPr, 'vMerge')
          if (vm && attr(vm, 'val') !== 'restart') return '' // célula mesclada (continuação)
          const w = attr(kid(tcPr, 'tcW'), 'w')
          const style = [fill && /^[0-9a-f]{6}$/i.test(fill) && fill.toLowerCase() !== 'ffffff' && `background:#${fill}`, w && attr(kid(tcPr, 'tcW'), 'type') === 'dxa' && `width:${twip(w)}px`].filter(Boolean).join(';')
          return `<td${span > 1 ? ` colspan="${span}"` : ''}${style ? ` style="${style}"` : ''}>${blocksHtml(ctx, tc)}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')
  const borders = kid(kid(tbl, 'tblPr'), 'tblBorders')
  const none = borders && ['top', 'bottom', 'insideH'].every((k) => attr(kid(borders, k), 'val') === 'none' || attr(kid(borders, k), 'val') === 'nil')
  return `<table class="${none ? 'ch-noborder' : ''}"><tbody>${rows}</tbody></table>`
}

function blocksHtml(ctx: Ctx, parent: Element): string {
  let out = ''
  for (const el of [...parent.children]) {
    if (el.namespaceURI !== W) continue
    if (el.localName === 'p') out += paraHtml(ctx, el)
    else if (el.localName === 'tbl') out += tableHtml(ctx, el)
    else if (el.localName === 'sdt') out += blocksHtml(ctx, kid(el, 'sdtContent') ?? el)
  }
  return out
}

async function shrink(blob: Blob, type: string): Promise<string> {
  // imagens grandes (logos, carimbos) diminuem para não pesar a conta
  try {
    if (blob.size > 160_000 && /png|jpe?g|webp/.test(type)) {
      const { compressImage } = await import('./studioApi')
      blob = await compressImage(new File([blob], 'img', { type }), 1100, 0.82)
    }
  } catch {
    /* fica como veio */
  }
  return new Promise((ok, bad) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => bad(r.error)
    r.readAsDataURL(blob)
  })
}

/** Word (.docx) → HTML com o desenho do arquivo. */
export async function docxToHtml(file: File): Promise<string> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const parse = async (path: string) => {
    const t = await zip.file(path)?.async('string')
    return t ? new DOMParser().parseFromString(t, 'application/xml') : null
  }
  const doc = await parse('word/document.xml')
  if (!doc) throw new Error('vazio')
  const ctx: Ctx = { styles: new Map(), rels: new Map(), media: new Map(), num: new Map(), counters: new Map(), baseSize: 11 }
  const styles = await parse('word/styles.xml')
  if (styles) {
    const def = styles.getElementsByTagNameNS(W, 'rPrDefault')[0]
    const sz = attr(def?.getElementsByTagNameNS(W, 'sz')[0], 'val')
    if (sz) ctx.baseSize = Number(sz) / 2
    for (const s of [...styles.getElementsByTagNameNS(W, 'style')]) {
      const id = attr(s, 'styleId')
      if (!id) continue
      ctx.styles.set(id, { p: kid(s, 'pPr'), r: kid(s, 'rPr'), based: attr(kid(s, 'basedOn'), 'val') ?? undefined, name: attr(kid(s, 'name'), 'val') ?? undefined })
    }
  }
  const rels = await parse('word/_rels/document.xml.rels')
  if (rels) for (const r of [...rels.getElementsByTagName('Relationship')]) ctx.rels.set(r.getAttribute('Id') ?? '', `word/${(r.getAttribute('Target') ?? '').replace(/^\/?word\//, '').replace(/^\.\.\//, '')}`)
  for (const target of new Set(ctx.rels.values())) {
    const f = zip.file(target)
    if (!f || !/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(target)) continue
    const ext = target.split('.').pop()!.toLowerCase()
    const type = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
    const blob = new Blob([await f.async('arraybuffer')], { type })
    ctx.media.set(target, await shrink(blob, type))
  }
  const numbering = await parse('word/numbering.xml')
  if (numbering) {
    const abs = new Map<string, Map<number, { fmt: string; text: string; start: number }>>()
    for (const a of [...numbering.getElementsByTagNameNS(W, 'abstractNum')]) {
      const lv = new Map<number, { fmt: string; text: string; start: number }>()
      for (const l of kids(a, 'lvl')) lv.set(Number(attr(l, 'ilvl') ?? 0), { fmt: attr(kid(l, 'numFmt'), 'val') ?? 'decimal', text: attr(kid(l, 'lvlText'), 'val') ?? '%1.', start: Number(attr(kid(l, 'start'), 'val') ?? 1) })
      abs.set(attr(a, 'abstractNumId') ?? '', lv)
    }
    for (const n of [...numbering.getElementsByTagNameNS(W, 'num')]) {
      const lv = abs.get(attr(kid(n, 'abstractNumId'), 'val') ?? '')
      if (lv) ctx.num.set(attr(n, 'numId') ?? '', lv)
    }
  }
  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  const html = blocksHtml(ctx, body)
  return `<div class="ch-doc" style="font-size:${ctx.baseSize}pt">${html}</div>`
}

/** Preenche as {etiquetas} no HTML (os valores entram como texto). */
export const fillHtml = (html: string, vars: Record<string, string>) => html.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? esc(vars[k]).replace(/\n/g, '<br>') : m))

/** Texto puro do contrato (um parágrafo por linha). */
export function htmlToText(html: string): string {
  const d = new DOMParser().parseFromString(html, 'text/html')
  d.querySelectorAll('br').forEach((b) => b.replaceWith('\n'))
  d.querySelectorAll('td').forEach((td) => td.append(' '))
  const out: string[] = []
  d.body.querySelectorAll('p, h1, h2, h3, h4, li, tr').forEach((el) => {
    if (el.closest('td') && el.tagName !== 'TR') return
    const t = (el.textContent ?? '').replace(/[ \t]+/g, ' ').trim()
    out.push(t)
  })
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Tira o que não pode ir para a folha (scripts, eventos, links javascript:). */
export function cleanHtml(html: string): string {
  const d = new DOMParser().parseFromString(html, 'text/html')
  d.querySelectorAll('script, style, iframe, object, embed, link, meta, form, input, button').forEach((x) => x.remove())
  d.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase()
      if (n.startsWith('on') || ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(a.value)) || (n === 'src' && !/^(data:image\/|https?:)/i.test(a.value.trim()))) el.removeAttribute(a.name)
    }
  })
  return d.body.innerHTML
}
