import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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
  const colors = sheetColors(s.proposal, has)
  const blocks = toBlocks(body)
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][] | null>(null)
  const key = body + clientName

  useLayoutEffect(() => setPages(null), [key])
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
            <span />
            <b>{clientName || 'contratante'}</b>
            <small>contratante</small>
          </div>
          <div>
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
