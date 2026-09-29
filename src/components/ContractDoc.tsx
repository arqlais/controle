import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import type { Settings } from '../types'
import { useAccess } from '../access'
import { sheetColors } from '../proposalTemplates'

/* Contrato em folhas A4 (794 × 1123 px). O texto é medido parágrafo por parágrafo
   e dividido em páginas, assim nenhuma linha é cortada ao meio no PDF. */

const PAGE_H = 1123
const PAD_TOP = 76
const PAD_BOTTOM = 92 // espaço do rodapé com o número da página
const HEAD_H = 120 // cabeçalho só na primeira folha

type Block = { kind: 'title' | 'clause' | 'p' | 'gap' | 'sign'; text: string }

function toBlocks(body: string): Block[] {
  const lines = body.replace(/\r/g, '').split('\n')
  const out: Block[] = []
  lines.forEach((raw, i) => {
    const t = raw.trim()
    if (!t) return out.length && out[out.length - 1].kind !== 'gap' && out.push({ kind: 'gap', text: '' })
    if (i === 0 && t === t.toUpperCase() && t.length < 90) return out.push({ kind: 'title', text: t })
    if (/^(CLÁUSULA|CLAUSULA|PARÁGRAFO)\b/i.test(t) || (t === t.toUpperCase() && /[A-ZÁÉÍÓÚ]{4}/.test(t) && t.length < 80)) return out.push({ kind: 'clause', text: t })
    out.push({ kind: 'p', text: t })
  })
  out.push({ kind: 'sign', text: '' })
  return out
}

export function ContractDoc({ s, body, clientName }: { s: Settings; body: string; clientName: string }) {
  const { has } = useAccess()
  // o contrato da Laís (modelo exclusivo): mesmo desenho dos PDFs dela
  if (has('modeloExclusivo') && /^CONTRATADA\s*$/m.test(body)) return <LaisContract s={s} body={body} clientName={clientName} />
  return <ClientContract s={s} body={body} clientName={clientName} has={has} />
}

function ClientContract({ s, body, clientName, has }: { s: Settings; body: string; clientName: string; has: ReturnType<typeof useAccess>['has'] }) {
  const colors = sheetColors(s.proposal, has)
  const blocks = toBlocks(body)
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][] | null>(null)
  const key = body + clientName

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
    if (b.kind === 'gap') return <div key={i} className="c-gap" />
    if (b.kind === 'title') return <h2 key={i} className="c-title">{b.text.toLowerCase()}</h2>
    if (b.kind === 'clause') return <h3 key={i} className="c-clause">{b.text}</h3>
    if (b.kind === 'sign')
      return (
        <div key={i} className="c-sign">
          <div>
            <i className="c-sign-img" />
            <span />
            <b>{clientName || 'contratante'}</b>
            <small>contratante</small>
          </div>
          <div>
            <i className="c-sign-img" />
            <span />
            <b>{s.legalName || s.ownerName || 'contratada'}</b>
            <small>contratada</small>
          </div>
        </div>
      )
    return <p key={i}>{b.text}</p>
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
              {s.proposal.showLogo && s.logo && <img className="c-logo" src={s.logo} alt="" />}
              <span className="p-eyebrow">documento</span>
              <h1 className="p-title">contrato</h1>
            </header>
          )}
          <div className="c-body">{idx.map(render)}</div>
          <footer className="c-foot">modelo de referência · revise com um advogado antes de assinar</footer>
        </article>
      ))}
    </div>
  )
}

/* ---------------- contrato da Laís: igual aos PDFs dela ---------------- */

type LBlock =
  | { kind: 'party'; label: string; rows: [string, string][] }
  | { kind: 'intro' | 'clause' | 'p' | 'bullet' | 'letter' | 'date'; text: string }
  | { kind: 'num'; n: string; text: string }
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
    if (t === 'CONTRATADA' || t === 'CONTRATANTE') {
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
    if (/^CLÁUSULA\b/i.test(t) || t === 'DAS ASSINATURAS') {
      afterSign = t === 'DAS ASSINATURAS'
      out.push({ kind: 'clause', text: t })
      continue
    }
    const num = t.match(/^(\d+\.\d+)\s+(.*)$/)
    if (num) {
      out.push({ kind: 'num', n: num[1], text: num[2] })
      continue
    }
    if (/^[•\-]\s+/.test(t)) {
      out.push({ kind: 'bullet', text: t.replace(/^[•\-]\s+/, '') })
      continue
    }
    if (/^[a-z]\)\s/.test(t)) {
      out.push({ kind: 'letter', text: t })
      continue
    }
    if (afterSign && /\d{4}\.?$/.test(t) && t.includes(',')) {
      // "Santo André - SP, 25 de Abril de 2026" (mês com inicial maiúscula, como no modelo)
      out.push({ kind: 'date', text: t.replace(/\.$/, '').replace(MONTH, (_m, a: string, mo: string, b: string) => a + mo[0].toUpperCase() + mo.slice(1) + b) })
      continue
    }
    out.push({ kind: /^As partes acima/.test(t) ? 'intro' : 'p', text: t })
  }
  out.push({ kind: 'sign' })
  return out
}

const L_PAD_TOP = 64
const L_PAD_BOTTOM = 86 // faixa rosé do rodapé + respiro
const L_HEAD_H = 150

function LaisContract({ s, body, clientName }: { s: Settings; body: string; clientName: string }) {
  const blocks = laisBlocks(body)
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][] | null>(null)
  const key = body + clientName + (s.signature ?? '')
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
    switch (b.kind) {
      case 'party':
        return (
          <fieldset key={i} className="lc-party">
            <legend>{b.label}</legend>
            {b.rows.map(([k, v], n) => (
              <p key={n}>
                <b>{k}:</b> {v}
              </p>
            ))}
          </fieldset>
        )
      case 'intro':
        return (
          <p key={i} className="lc-intro">
            {b.text}
          </p>
        )
      case 'clause':
        return (
          <h3 key={i} className="lc-clause">
            {b.text}
          </h3>
        )
      case 'num':
        return (
          <div key={i} className="lc-num">
            <b>{b.n}</b>
            <p>{b.text}</p>
          </div>
        )
      case 'bullet':
        return (
          <p key={i} className="lc-bullet">
            {b.text}
          </p>
        )
      case 'letter':
        return (
          <p key={i} className="lc-letter">
            {b.text}
          </p>
        )
      case 'date':
        return (
          <p key={i} className="lc-date">
            {b.text}
          </p>
        )
      case 'sign':
        return (
          <div key={i} className="lc-signs">
            <div className="lc-sign-box" />
            <p className="lc-sign-who">
              {who.toUpperCase()}
              <b>CONTRATADO</b>
            </p>
            <div className="lc-sign-box" />
            <p className="lc-sign-who">
              {(clientName || 'nome completo').toUpperCase()}
              <b>CONTRATANTE</b>
            </p>
          </div>
        )
      default:
        return (
          <p key={i} className="lc-p">
            {b.text}
          </p>
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
    </div>
  )
}
