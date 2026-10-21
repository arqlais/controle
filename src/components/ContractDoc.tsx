import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import type { ContractSignature, Letterhead, Settings } from '../types'
import { useAccess } from '../access'
import { sheetColors, showsLogo } from '../proposalTemplates'
import { SignatureGlyph } from './SignaturePad'
import { cleanHtml } from '../contractHtml'
import { Rich, richHtml, stripRich } from '../richText'

/* Contrato em folhas A4 (794 × 1123 px). O texto é medido parágrafo por parágrafo
   e dividido em páginas, assim nenhuma linha é cortada ao meio no PDF. */

const PAGE_H = 1123
const PAD_TOP = 76
const PAD_BOTTOM = 92 // espaço do rodapé com o número da página
const HEAD_H = 120 // cabeçalho só na primeira folha

type Block = { kind: 'title' | 'clause' | 'p' | 'gap' | 'sign'; text: string; line?: number }

function toBlocks(body: string): Block[] {
  const lines = body.replace(/\r/g, '').split('\n')
  const out: Block[] = []
  lines.forEach((raw, i) => {
    const t = raw.trim()
    const pl = stripRich(t)
    if (!t) return out.length && out[out.length - 1].kind !== 'gap' && out.push({ kind: 'gap', text: '' })
    if (i === 0 && pl === pl.toUpperCase() && pl.length < 90) return out.push({ kind: 'title', text: t, line: i })
    if (/^(CLÁUSULA|CLAUSULA|PARÁGRAFO)\b/i.test(pl) || (pl === pl.toUpperCase() && /[A-ZÁÉÍÓÚ]{4}/.test(pl) && pl.length < 80)) return out.push({ kind: 'clause', text: t, line: i })
    out.push({ kind: 'p', text: t, line: i })
  })
  out.push({ kind: 'sign', text: '' })
  return out
}

/** Desenho do contrato exclusivo da dona (o link de assinatura guarda isso, porque abre fora da conta). */
export const usesExclusiveContract = (has: (f: 'modeloExclusivo') => boolean, body: string) => has('modeloExclusivo') && /^CONTRATADA\s*$/m.test(body)

/** Edição direto na folha: cada parágrafo vira editável e devolve a linha certa do texto. */
type EditApi = { edit: (line: number, raw: string, newLine?: boolean) => void; focus: number | null }
const EditCtx = createContext<EditApi | null>(null)
function Ed({ as: Tag, line, text, className, raw = (x) => x }: { as: 'p' | 'h3'; line?: number; text: string; className?: string; raw?: (x: string) => string }) {
  const api = useContext(EditCtx)
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (api && line !== undefined && api.focus === line && ref.current) {
      const el = ref.current
      el.focus()
      const r = document.createRange()
      r.selectNodeContents(el)
      r.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(r)
    }
  }, [api, line])
  if (!api || line === undefined) return <Tag className={className}><Rich text={text} /></Tag>
  const commit = (newLine = false) => {
    const md = htmlToMarkup(ref.current?.innerHTML ?? '')
    if (md === text.replace(/\u200B/g, '') && !newLine) return
    api.edit(line, md ? raw(md) : '', newLine)
  }
  return (
    <Tag
      ref={ref as never}
      className={`${className ?? ''} ed-line`}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      lang="pt-BR"
      onBlur={() => commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commit(true)
        }
      }}
    >
      <Rich text={text.replace(/\u200B/g, '')} />
    </Tag>
  )
}

/** HTML do parágrafo editado → texto com as marcas (**negrito**, *itálico*, __sublinhado__, [cor=…]). */
export function htmlToMarkup(html: string): string {
  const d = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild as HTMLElement
  const hex = (c: string) => {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    return m ? '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('') : c.startsWith('#') ? c : ''
  }
  const walk = (n: Node): string => {
    if (n.nodeType === 3) return (n.textContent ?? '').replace(/\u00A0/g, ' ')
    if (n.nodeType !== 1) return ''
    const el = n as HTMLElement
    if (el.tagName === 'BR') return ' '
    let inner = [...el.childNodes].map(walk).join('')
    if (!inner.trim()) return inner
    const st = el.style
    const tag = el.tagName
    const color = hex(st.color || el.getAttribute('color') || '')
    if (color && color !== '#000000') inner = `[cor=${color}]${inner}[/cor]`
    if (tag === 'U' || /underline/.test(st.textDecoration || st.textDecorationLine || '')) inner = `__${inner}__`
    if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') inner = `*${inner}*`
    if (tag === 'B' || tag === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) inner = `**${inner}**`
    return inner
  }
  return walk(d).replace(/\s+/g, ' ').replace(/\u200B/g, '').trim()
}

/** Assinatura da contratada registrada ao gerar o link (vale junto com a do cliente). */
const OwnerSignCtx = createContext<ContractSignature | undefined>(undefined)
function OwnerSign({ s, lais }: { s: Settings; lais?: boolean }) {
  const o = useContext(OwnerSignCtx)
  if (s.signature) return <img className={lais ? undefined : 'c-sign-img'} src={s.signature} alt="" />
  if (o) return <SignatureGlyph sign={{ name: o.name, font: o.font ?? s.signFont }} className={lais ? undefined : 'c-sign-img'} />
  return lais ? null : <i className="c-sign-img" />
}
function OwnerMark() {
  return <SignedMark sign={useContext(OwnerSignCtx)} />
}

/** Título de cláusula no desenho do Word: h1–h4, linha curta toda em maiúsculas ou toda em negrito. */
function isHeading(el: HTMLElement) {
  if (/^H[1-4]$/.test(el.tagName) || el.classList.contains('lh-title') || el.classList.contains('lh-clause')) return true
  const txt = (el.textContent ?? '').trim()
  if (!txt || txt.length > 90) return false
  if (txt === txt.toUpperCase() && /[A-ZÀ-Ú]{4}/.test(txt)) return true
  const bold = [...el.querySelectorAll('b, strong')].map((b) => b.textContent ?? '').join('').trim()
  return bold.length > 0 && bold.length >= txt.length - 2
}

/** Linha "assinado eletronicamente" embaixo do nome de quem assinou pelo link. */
function SignedMark({ sign }: { sign?: ContractSignature }) {
  if (!sign || sign.via !== 'link') return null
  return (
    <span className="c-signed">
      assinado eletronicamente · {new Date(sign.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
      {sign.doc ? ` · ${sign.doc}` : ''}
      {sign.hash ? ` · código ${sign.hash}` : ''}
    </span>
  )
}

/** Certificado de assinatura (última página): o registro de quem assinou, como, quando e de qual texto. */
function SignCertificate({ sign, lais }: { sign?: ContractSignature; lais?: boolean }) {
  const owner = useContext(OwnerSignCtx)
  if (!sign || sign.via !== 'link') return null
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' }) : '')
  const rows: [string, string | undefined][] = [
    ['nome', sign.name],
    ['CPF / CNPJ', sign.doc],
    ['contato', sign.contact],
    ['assinado em', `${when(sign.at)}${sign.tz ? ` (${sign.tz})` : ''}`],
    ['forma', sign.method === 'desenho' ? 'assinatura desenhada à mão na tela' : 'nome digitado, adotado como assinatura'],
    ['aparelho', sign.device],
    ['localização', sign.geo || 'não informada'],
    ['confirmação', sign.confirmedAt ? `recebida e registrada em ${when(sign.confirmedAt)}` : 'aguardando'],
    ['código da assinatura', sign.hash],
  ]
  const ownerRows: [string, string | undefined][] = owner
    ? [
        ['nome', owner.name],
        ['CPF / CNPJ', owner.doc],
        ['contato', owner.contact],
        ['assinado em', `${when(owner.at)}${owner.tz ? ` (${owner.tz})` : ''}`],
        ['forma', 'assinatura adotada pela contratada ao enviar o contrato'],
        ['aparelho', owner.device],
        ['código da assinatura', owner.hash],
      ]
    : []
  const table = (r: [string, string | undefined][]) => (
    <table className="c-cert-table">
      <tbody>
        {r.map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{v || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return (
    <article className={`contract-page c-cert ${lais ? 'lc-page' : ''}`}>
      <p className="c-cert-eyebrow">certificado de assinatura eletrônica</p>
      <h2 className="c-cert-title">registro das assinaturas</h2>
      <p className="c-cert-text">Este documento foi assinado eletronicamente pelas partes. Os dados abaixo foram registrados no momento de cada assinatura e ficam ligados ao texto exato do contrato pela impressão digital SHA-256: qualquer alteração no texto gera outra impressão e invalida as assinaturas.</p>
      <p className="c-cert-who">contratante</p>
      <div className="c-cert-sign">
        <SignatureGlyph sign={sign} />
        <span>{sign.name}</span>
      </div>
      {table(rows)}
      {owner && (
        <>
          <p className="c-cert-who">contratada</p>
          {table(ownerRows)}
        </>
      )}
      {sign.docHash && (
        <p className="c-cert-hash">
          <b>impressão digital do documento (SHA-256)</b>
          <code>{sign.docHash}</code>
        </p>
      )}
      <p className="c-cert-law">Assinaturas eletrônicas simples, nos termos da Lei nº 14.063/2020 e da MP nº 2.200-2/2001 (art. 10, § 2º), admitidas como válidas pelas partes que as aceitaram. Para assinatura com certificado digital ICP-Brasil, use um serviço credenciado (ex.: assinador gov.br).</p>
    </article>
  )
}

export function ContractDoc(props: { s: Settings; body: string; html?: string; clientName: string; exclusive?: boolean; signed?: ContractSignature; ownerSigned?: ContractSignature; letterhead?: Letterhead; pdfPages?: string[]; onBody?: (body: string) => void }) {
  const [focus, setFocus] = useState<number | null>(null)
  const { onBody, body } = props
  const api = useMemo<EditApi | null>(
    () =>
      onBody
        ? {
            focus,
            edit: (line, raw, newLine) => {
              const lines = body.split('\n')
              if (!raw.trim() && !newLine) lines.splice(line, 1) // parágrafo apagado: some a linha
              else lines.splice(line, 1, ...(newLine ? [raw, '\u200B'] : [raw]))
              setFocus(newLine ? line + 1 : null)
              onBody(lines.join('\n'))
            },
          }
        : null,
    [onBody, body, focus],
  )
  return (
    <OwnerSignCtx.Provider value={props.ownerSigned}>
      <EditCtx.Provider value={api}>
        <ContractSheets {...props} />
      </EditCtx.Provider>
    </OwnerSignCtx.Provider>
  )
}

function ContractSheets({ s, body, html, clientName, exclusive, signed, letterhead, pdfPages }: { s: Settings; body: string; html?: string; clientName: string; exclusive?: boolean; signed?: ContractSignature; letterhead?: Letterhead; pdfPages?: string[] }) {
  const { has } = useAccess()
  // PDF pronto: as folhas exatamente como são + a folha das assinaturas no fim
  if (pdfPages?.length) return <PdfContract s={s} pages={pdfPages} clientName={clientName} signed={signed} />
  // papel timbrado: o texto entra por cima do desenho da folha da pessoa
  if (letterhead?.first) return <LetterheadContract s={s} body={body} html={html} lh={letterhead} clientName={clientName} signed={signed} />
  // contrato no modelo da própria pessoa (do Word): a folha fica igual à dela
  if (html) return <OwnContract s={s} html={html} clientName={clientName} signed={signed} />
  // o contrato da Laís (modelo exclusivo): mesmo desenho dos PDFs dela
  if (exclusive ?? usesExclusiveContract(has, body)) return <LaisContract s={s} body={body} clientName={clientName} signed={signed} />
  return <ClientContract s={s} body={body} clientName={clientName} has={has} signed={signed} />
}

function ClientContract({ s, body, clientName, has, signed }: { s: Settings; body: string; clientName: string; has: ReturnType<typeof useAccess>['has']; signed?: ContractSignature }) {
  const colors = sheetColors(s.proposal, has, s)
  const blocks = toBlocks(body)
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][] | null>(null)
  const key = body + clientName + (signed?.at ?? '')

  useLayoutEffect(() => {
    setPages(null)
  }, [key])
  useLayoutEffect(() => {
    if (pages || !measure.current) return
    const els = [...measure.current.children] as HTMLElement[]
    const heights = els.map((el, i) => (i < els.length - 1 ? els[i + 1].offsetTop - el.offsetTop : el.offsetHeight + 8))
    const out: number[][] = [[]]
    let used = HEAD_H
    heights.forEach((h, i) => {
      const room = PAGE_H - PAD_TOP - PAD_BOTTOM
      // título de cláusula não fica sozinho no fim da folha
      if (!blocks[i]) return // o texto mudou no meio da medição
      const need = blocks[i].kind === 'clause' ? h + (heights[i + 1] ?? 0) : h
      if (used + need > room && out[out.length - 1].length) {
        out.push([])
        used = 0
      }
      if (blocks[i].kind === 'gap' && used === 0) return // folha nova não começa com espaço em branco
      out[out.length - 1].push(i)
      used += h
    })
    setPages(out)
  })

  const style = { '--p-ink': colors.ink, '--p-rose': colors.rose, '--p-bar': colors.bar, '--p-paper': colors.paper, '--p-serif': `'${colors.serif}', 'Cormorant Garamond', Georgia, serif`, '--p-sans': `'${colors.sans}', 'Poppins', system-ui, sans-serif` } as CSSProperties
  const who = (s.legalName || s.ownerName || s.brandName).toUpperCase()
  const render = (i: number) => {
    const b = blocks[i]
    if (!b) return null
    if (b.kind === 'gap') return <div key={i} className="c-gap" />
    if (b.kind === 'title') return <h2 key={i} className="c-title"><Rich text={b.text.toLowerCase()} /></h2>
    if (b.kind === 'clause') return <Ed key={i} as="h3" className="c-clause" line={b.line} text={b.text} />
    if (b.kind === 'sign')
      return (
        <div key={i} className="c-sign">
          <div>
            {signed?.via === 'link' ? <SignatureGlyph sign={signed} className="c-sign-img" /> : <i className="c-sign-img" />}
            <span />
            <b>{clientName || 'contratante'}</b>
            <small>contratante</small>
            <SignedMark sign={signed} />
          </div>
          <div>
            <OwnerSign s={s} />
            <span />
            <b>{s.legalName || s.ownerName || 'contratada'}</b>
            <small>contratada</small>
            <OwnerMark />
          </div>
        </div>
      )
    return <Ed key={i} as="p" line={b.line} text={b.text} />
  }

  if (!pages)
    return (
      <div className="contract-doc" style={style}>
        <article className="contract-page is-measuring">
          <div className="c-body" ref={measure}>
            {blocks.map((_, i) => render(i))}
          </div>
        </article>
      </div>
    )
  return (
    <div className="contract-doc" style={style}>
      {pages.map((idx, n) => (
        <article key={n} className="contract-page">
          <div className="c-bar">
            <span>{who}</span>
            <span>{n + 1}/{pages.length}</span>
          </div>
          {n === 0 && (
            <header className="c-head">
              {showsLogo(s) && <img className="c-logo" src={s.logo} alt="" />}
              <span className="p-eyebrow">documento</span>
              <h1 className="p-title">contrato</h1>
            </header>
          )}
          <div className="c-body">{idx.map(render)}</div>
          <footer className="c-foot">modelo de referência · revise com um advogado antes de assinar</footer>
        </article>
      ))}
      <SignCertificate sign={signed} />
    </div>
  )
}

/* ---------------- contrato da Laís: igual aos PDFs dela ---------------- */

type LBlock =
  | { kind: 'party'; label: string; rows: [string, string][] }
  | { kind: 'intro' | 'clause' | 'p' | 'bullet' | 'letter' | 'date'; text: string; line?: number }
  | { kind: 'num'; n: string; text: string; line?: number }
  | { kind: 'sign' }

const MONTH = /( de )([a-zç]+)( de \d{4})/
function laisBlocks(body: string): LBlock[] {
  const lines = body.replace(/\r/g, '').split('\n').map((l) => l.trim())
  const out: LBlock[] = []
  let i = 0
  if (lines[0] && lines[0] === lines[0].toUpperCase() && /CONTRATO/.test(lines[0])) i = 1 // o título vira o cabeçalho "contrato"
  let afterSign = false
  for (; i < lines.length; i++) {
    const t = lines[i]
    if (!t) continue
    if (stripRich(t) === 'CONTRATADA' || stripRich(t) === 'CONTRATANTE') {
      const rows: [string, string][] = []
      while (lines[i + 1]) {
        const l = lines[++i]
        const kv = l.match(/^([^:]{2,24}):\s*(.*)$/)
        const doc = l.match(/^(CPF|CNPJ)\s+(.+)$/)
        rows.push(kv ? [kv[1], kv[2]] : doc ? [doc[1], doc[2]] : [t === 'CONTRATADA' ? 'CPF' : 'CNPJ/CPF', l])
      }
      out.push({ kind: 'party', label: t, rows })
      continue
    }
    const pl = stripRich(t)
    if (/^CLÁUSULA\b/i.test(pl) || pl === 'DAS ASSINATURAS') {
      afterSign = pl === 'DAS ASSINATURAS'
      out.push({ kind: 'clause', text: t, line: i })
      continue
    }
    const num = t.match(/^((?:\*\*|\*|__|\[cor=#[0-9a-fA-F]{3,8}\])*)(\d+\.\d+)\s+(.*)$/)
    if (num) {
      out.push({ kind: 'num', n: num[2], text: num[1] + num[3], line: i })
      continue
    }
    if (/^[•\-]\s+/.test(pl)) {
      out.push({ kind: 'bullet', text: t.replace(/^[•\-]\s+/, ''), line: i })
      continue
    }
    if (/^[a-z]\)\s/.test(t)) {
      out.push({ kind: 'letter', text: t, line: i })
      continue
    }
    if (afterSign && /\d{4}\.?$/.test(t) && t.includes(',')) {
      // "Santo André - SP, 25 de Abril de 2026" (mês com inicial maiúscula, como no modelo)
      out.push({ kind: 'date', line: i, text: t.replace(/\.$/, '').replace(MONTH, (_m, a: string, mo: string, b: string) => a + mo[0].toUpperCase() + mo.slice(1) + b) })
      continue
    }
    out.push({ kind: /^As partes acima/.test(t) ? 'intro' : 'p', text: t, line: i })
  }
  out.push({ kind: 'sign' })
  return out
}

const L_PAD_TOP = 64
const L_PAD_BOTTOM = 86 // faixa rosé do rodapé + respiro
const L_HEAD_H = 150

function LaisContract({ s, body, clientName, signed }: { s: Settings; body: string; clientName: string; signed?: ContractSignature }) {
  const blocks = laisBlocks(body)
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][] | null>(null)
  const key = body + clientName + (s.signature ?? '') + (signed?.at ?? '')
  useLayoutEffect(() => {
    setPages(null)
  }, [key])
  useLayoutEffect(() => {
    if (pages || !measure.current) return
    const els = [...measure.current.children] as HTMLElement[]
    const heights = els.map((el, i) => (i < els.length - 1 ? els[i + 1].offsetTop - el.offsetTop : el.offsetHeight + 8))
    const room = PAGE_H - L_PAD_TOP - L_PAD_BOTTOM
    const out: number[][] = [[]]
    let used = L_HEAD_H
    heights.forEach((h, i) => {
      const b = blocks[i]
      if (!b) return // o texto mudou no meio da medição
      // título de cláusula sempre junto do primeiro item; assinaturas juntas
      // "DAS ASSINATURAS" leva junto o texto, a data e os quadros de assinatura (como no modelo)
      const need = b.kind === 'clause' && b.text === 'DAS ASSINATURAS' ? heights.slice(i).reduce((a, x) => a + x, 0) : b.kind === 'clause' ? h + (heights[i + 1] ?? 0) : h
      if (used + need > room && out[out.length - 1].length) {
        out.push([])
        used = 0
      }
      out[out.length - 1].push(i)
      used += h
    })
    setPages(out)
  })
  const who = s.legalName || s.ownerName || ''
  const ig = (s.instagram || '').replace(/^@/, '')
  const render = (i: number): ReactNode => {
    const b = blocks[i]
    if (!b) return null
    switch (b.kind) {
      case 'party':
        return (
          <fieldset key={i} className="lc-party">
            <legend>{b.label}</legend>
            {b.rows.map(([k, v], n) => (
              <p key={n}>
                <b>{k}:</b> <Rich text={v} />
              </p>
            ))}
          </fieldset>
        )
      case 'intro':
        return (
          <Ed key={i} as="p" className="lc-intro" line={b.line} text={b.text} />
        )
      case 'clause':
        return (
          <Ed key={i} as="h3" className="lc-clause" line={b.line} text={b.text} />
        )
      case 'num':
        return (
          <div key={i} className="lc-num">
            <b>{b.n}</b>
            <Ed as="p" line={b.line} text={b.text} raw={(x) => `${b.n} ${x}`} />
          </div>
        )
      case 'bullet':
        return (
          <Ed key={i} as="p" className="lc-bullet" line={b.line} text={b.text} raw={(x) => `• ${x}`} />
        )
      case 'letter':
        return (
          <Ed key={i} as="p" className="lc-letter" line={b.line} text={b.text} />
        )
      case 'date':
        return (
          <Ed key={i} as="p" className="lc-date" line={b.line} text={b.text} />
        )
      case 'sign':
        return (
          <div key={i} className="lc-signs">
            <div className="lc-sign-box"><OwnerSign s={s} lais /></div>
            <p className="lc-sign-who">
              {who.toUpperCase()}
              <b>CONTRATADO</b>
              <OwnerMark />
            </p>
            <div className="lc-sign-box">{signed?.via === 'link' && <SignatureGlyph sign={signed} />}</div>
            <p className="lc-sign-who">
              {(clientName || 'nome completo').toUpperCase()}
              <b>CONTRATANTE</b>
              <SignedMark sign={signed} />
            </p>
          </div>
        )
      default:
        return (
          <Ed key={i} as="p" className="lc-p" line={b.line} text={b.text} />
        )
    }
  }
  const style = { '--lc-serif': `'${s.customFont ? 'The Seasons' : 'Cormorant Garamond'}', 'The Seasons', 'Cormorant Garamond', Georgia, serif` } as CSSProperties
  if (!pages)
    return (
      <div className="contract-doc lc" style={style}>
        <article className="contract-page lc-page is-measuring">
          <div className="lc-body" ref={measure}>
            {blocks.map((_, i) => render(i))}
          </div>
        </article>
      </div>
    )
  return (
    <div className="contract-doc lc" style={style}>
      {pages.map((idx, n) => (
        <article key={n} className="contract-page lc-page">
          {n === 0 && (
            <header className="lc-head">
              <div className="lc-title">
                <h1>contrato</h1>
                <span>prestação de serviços</span>
              </div>
              <ul className="lc-contacts">
                {s.phone && (
                  <li>
                    {s.phone} <i><Icon name="phone" size={10} /></i>
                  </li>
                )}
                {ig && (
                  <li>
                    {ig} <i><Icon name="instagram" size={10} /></i>
                  </li>
                )}
                {s.email && (
                  <li>
                    {s.email} <i><Icon name="mail" size={10} /></i>
                  </li>
                )}
              </ul>
            </header>
          )}
          <div className="lc-body">{idx.map(render)}</div>
          <footer className="lc-band" />
        </article>
      ))}
      <SignCertificate sign={signed} lais />
    </div>
  )
}

/* ---------------- contrato no modelo da pessoa (Word) ---------------- */

const OWN_PAD = 72
function OwnContract({ s, html, clientName, signed }: { s: Settings; html: string; clientName: string; signed?: ContractSignature }) {
  const clean = cleanHtml(html)
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<string[][] | null>(null)
  const key = clean + clientName + (signed?.at ?? '')
  const root = /^<div class="ch-doc" style="([^"]*)">/.exec(clean)
  const rootStyle = root?.[1] ?? ''
  useLayoutEffect(() => {
    setPages(null)
  }, [key])
  useLayoutEffect(() => {
    if (pages || !measure.current) return
    const doc = measure.current.querySelector('.ch-doc') ?? measure.current
    const els = [...doc.children] as HTMLElement[]
    const room = PAGE_H - OWN_PAD * 2 - 24
    const out: string[][] = [[]]
    let used = 0
    els.forEach((el, i) => {
      if (el.classList.contains('ch-break')) {
        if (out[out.length - 1].length) out.push([])
        used = 0
        return
      }
      const h = i < els.length - 1 ? els[i + 1].offsetTop - el.offsetTop : el.offsetHeight + 8
      // título não fica sozinho no fim da folha: vai junto com o primeiro parágrafo
      const next = els[i + 1] ? (i + 1 < els.length - 1 ? els[i + 2].offsetTop - els[i + 1].offsetTop : els[i + 1].offsetHeight + 8) : 0
      const need = isHeading(el) ? h + next : h
      if (used + need > room && out[out.length - 1].length) {
        out.push([])
        used = 0
      }
      out[out.length - 1].push(el.outerHTML)
      used += h
    })
    // o quadro de assinatura precisa de ~230px: se não couber, vai para uma folha nova
    if (used + 230 > room) out.push([])
    setPages(out)
  })
  const signBox = (
    <div className="c-sign ch-sign">
      <div>
        {signed?.via === 'link' ? <SignatureGlyph sign={signed} className="c-sign-img" /> : <i className="c-sign-img" />}
        <span />
        <b>{clientName || 'contratante'}</b>
        <small>contratante</small>
        <SignedMark sign={signed} />
      </div>
      <div>
        <OwnerSign s={s} />
        <span />
        <b>{s.legalName || s.ownerName || 'contratada'}</b>
        <small>contratada</small>
            <OwnerMark />
      </div>
    </div>
  )
  if (!pages)
    return (
      <div className="contract-doc ch-own">
        <article className="contract-page ch-page is-measuring">
          <div ref={measure} dangerouslySetInnerHTML={{ __html: clean }} />
        </article>
      </div>
    )
  return (
    <div className="contract-doc ch-own">
      {pages.map((chunk, n) => (
        <article key={n} className="contract-page ch-page">
          <div className="ch-doc" style={Object.fromEntries(rootStyle.split(';').filter(Boolean).map((x) => { const [k, v] = x.split(':'); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()] }))} dangerouslySetInnerHTML={{ __html: chunk.join('') }} />
          {n === pages.length - 1 && signBox}
          <span className="ch-pnum">{n + 1}/{pages.length}</span>
        </article>
      ))}
      <SignCertificate sign={signed} />
    </div>
  )
}

/* ---------------- quadro de assinaturas (usado pelos desenhos da própria pessoa) ---------------- */

function SignBox({ s, clientName, signed }: { s: Settings; clientName: string; signed?: ContractSignature }) {
  return (
    <div className="c-sign ch-sign">
      <div>
        {signed?.via === 'link' ? <SignatureGlyph sign={signed} className="c-sign-img" /> : <i className="c-sign-img" />}
        <span />
        <b>{clientName || 'contratante'}</b>
        <small>contratante</small>
        <SignedMark sign={signed} />
      </div>
      <div>
        <OwnerSign s={s} />
        <span />
        <b>{s.legalName || s.ownerName || 'contratada'}</b>
        <small>contratada</small>
            <OwnerMark />
      </div>
    </div>
  )
}

/* ---------------- PDF pronto: as folhas do arquivo, sem mudar nada ---------------- */

function PdfContract({ s, pages, clientName, signed }: { s: Settings; pages: string[]; clientName: string; signed?: ContractSignature }) {
  return (
    <div className="contract-doc ch-own">
      {pages.map((src, n) => (
        <article key={n} className="contract-page lh-page lh-pdf">
          <img className="lh-bg" src={src} alt={`Folha ${n + 1} do contrato`} />
        </article>
      ))}
      <article className="contract-page lh-signpage">
        <p className="lh-sign-title">assinaturas</p>
        <p className="lh-sign-text">As partes declaram que leram e concordam com as {pages.length} {pages.length === 1 ? 'folha anterior' : 'folhas anteriores'} deste contrato.</p>
        <SignBox s={s} clientName={clientName} signed={signed} />
        <span className="ch-pnum">{pages.length + 1}/{pages.length + 1}</span>
      </article>
      <SignCertificate sign={signed} />
    </div>
  )
}

/* ---------------- papel timbrado: o texto do contrato por cima do desenho da folha ---------------- */

function LetterheadContract({ s, body, html, lh, clientName, signed }: { s: Settings; body: string; html?: string; lh: Letterhead; clientName: string; signed?: ContractSignature }) {
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<string[][] | null>(null)
  // o texto vira parágrafos (do desenho do Word, quando tem; senão, do texto com títulos em maiúsculas)
  const source = html
    ? cleanHtml(html)
    : toBlocks(body)
        .filter((b) => b.kind !== 'sign')
        .map((b) => (b.kind === 'gap' ? '<div class="c-gap"></div>' : b.kind === 'title' ? `<h2 class="lh-title">${richHtml(b.text)}</h2>` : b.kind === 'clause' ? `<h3 class="lh-clause">${richHtml(b.text)}</h3>` : `<p>${richHtml(b.text)}</p>`))
        .join('')
  const key = source + clientName + (signed?.at ?? '') + lh.top + lh.bottom + lh.side
  useLayoutEffect(() => {
    setPages(null)
  }, [key])
  useLayoutEffect(() => {
    if (pages || !measure.current) return
    const root = measure.current.querySelector('.ch-doc') ?? measure.current
    const els = [...root.children] as HTMLElement[]
    const room = PAGE_H - lh.top - lh.bottom
    const out: string[][] = [[]]
    let used = 0
    els.forEach((el, i) => {
      const h = i < els.length - 1 ? els[i + 1].offsetTop - el.offsetTop : el.offsetHeight + 8
      const next = els[i + 1] ? (i + 1 < els.length - 1 ? els[i + 2].offsetTop - els[i + 1].offsetTop : els[i + 1].offsetHeight + 8) : 0
      if (used + (isHeading(el) ? h + next : h) > room && out[out.length - 1].length) {
        out.push([])
        used = 0
      }
      if (el.classList.contains('c-gap') && used === 0) return
      out[out.length - 1].push(el.outerHTML)
      used += h
    })
    if (used + 230 > room) out.push([])
    setPages(out)
  })
  const pad = { paddingTop: lh.top, paddingBottom: lh.bottom, paddingLeft: lh.side, paddingRight: lh.side } as CSSProperties
  if (!pages)
    return (
      <div className="contract-doc ch-own">
        <article className="contract-page lh-page is-measuring" style={pad}>
          <div ref={measure} className="lh-text" dangerouslySetInnerHTML={{ __html: source }} />
        </article>
      </div>
    )
  return (
    <div className="contract-doc ch-own">
      {pages.map((chunk, n) => (
        <article key={n} className="contract-page lh-page" style={pad}>
          <img className="lh-bg" src={n === 0 ? lh.first : lh.rest || lh.first} alt="" />
          <div className="lh-text" dangerouslySetInnerHTML={{ __html: chunk.join('') }} />
          {n === pages.length - 1 && <SignBox s={s} clientName={clientName} signed={signed} />}
        </article>
      ))}
      <SignCertificate sign={signed} />
    </div>
  )
}

