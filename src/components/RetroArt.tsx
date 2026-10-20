import type { CSSProperties } from 'react'
import type { Settings } from '../types'
import { MONTHS, money } from '../utils'
import type { RetroStats } from '../pages/Retro'

/* Arte da retrospectiva para postar: quatro modelos bem diferentes entre si, todos limpos
   (papel, vidro, listrado e blocos), em feed (1080 × 1350) e story (1080 × 1920).
   Números em Poppins, palavras de destaque na serifada. Nas cores da marca de quem baixa; a Laís usa as dela. */

export type RetroModel = 'papel' | 'vidro' | 'listrado' | 'blocos'
export type RetroFormat = 'feed' | 'story'
export const RETRO_MODELS: { value: RetroModel; label: string }[] = [
  { value: 'papel', label: 'papel' },
  { value: 'vidro', label: 'vidro' },
  { value: 'listrado', label: 'listrado' },
  { value: 'blocos', label: 'blocos' },
]
export const retroSize = (f: RetroFormat) => ({ w: 1080, h: f === 'story' ? 1920 : 1350 })

const OWNER = { a: '#4a5d6b', r: '#d0aca3', i: '#584f4a', b: '#f3ece5' }

function hexRgb(h: string): [number, number, number] | null {
  const m = h.trim().replace('#', '')
  const x = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-f]{6}$/i.test(x)) return null
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) as [number, number, number]
}
/** mistura duas cores (t = quanto da segunda) — calculado aqui para o PNG sair igual em qualquer navegador */
function mix(a: string, b: string, t: number) {
  const x = hexRgb(a)
  const y = hexRgb(b)
  if (!x || !y) return a
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}
const rgba = (hex: string, alpha: number) => {
  const x = hexRgb(hex)
  return x ? `rgba(${x.join(',')},${alpha})` : hex
}
/** tamanho da fonte para o texto caber na largura */
const fit = (text: string, base: number, chars: number) => Math.round(base * Math.min(1, chars / Math.max(1, text.length)))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

interface Item {
  n: string
  t: string
}

export function RetroArt({ s, year, st, values, model, format, exclusive }: { s: Settings; year: string; st: RetroStats; values: boolean; model: RetroModel; format: RetroFormat; exclusive: boolean }) {
  const c = exclusive ? OWNER : { a: s.accent || '#3e4b57', r: s.accentSoft || '#d6b3ab', i: s.text || '#3e4b57', b: s.background || '#f5f1ee' }
  const serif = exclusive ? 'The Seasons' : s.displayFont && s.displayFont !== 'The Seasons' ? s.displayFont : 'Cormorant Garamond'
  const { w, h } = retroSize(format)
  const story = format === 'story'
  const brand = (s.brandName || s.ownerName || 'meu estúdio').replace(/\.$/, '')
  const handle = s.instagram ? `@${s.instagram.replace(/^@/, '')}` : brand
  const cash = values && st.received ? money(st.received).replace(',00', '') : ''
  const best = st.best >= 0 ? MONTHS[st.best].toLowerCase() : ''
  const top = st.topServices[0]?.name ?? ''
  const hours = Math.round(st.hours)
  // os números do ano, na ordem de importância
  const all: Item[] = [
    { n: String(st.started), t: plural(st.started, 'projeto', 'projetos') },
    { n: String(st.served), t: plural(st.served, 'cliente', 'clientes') },
    ...(st.delivered ? [{ n: String(st.delivered), t: plural(st.delivered, 'entrega', 'entregas') }] : []),
    ...(st.quotes ? [{ n: `${st.rate}%`, t: 'de aprovação' }] : []),
    ...(hours ? [{ n: `${hours}h`, t: 'de projeto' }] : []),
  ]
  const vars = {
    width: w,
    height: h,
    '--a': c.a,
    '--r': c.r,
    '--i': c.i,
    '--bg': c.b,
    '--r-deep': mix(c.r, c.a, 0.32),
    '--r-soft': mix(c.r, '#ffffff', 0.5),
    '--stripe': mix(c.b, c.r, 0.38),
    '--line': rgba(c.a, 0.14),
    '--glow': rgba(c.r, 0.55),
    '--serif': `'${serif}', 'Cormorant Garamond', Georgia, serif`,
  } as CSSProperties
  const cls = `ry ry-${model} ${story ? 'is-story' : ''}`
  const foot = (light = false) => (
    <footer className={`ry-foot ${light ? 'is-light' : ''}`}>
      <span>{handle}</span>
      <span className="ry-made">feito com planê</span>
    </footer>
  )

  /* ---------- papel: fundo liso, muito respiro, um número enorme e uma linha com o resto ---------- */
  if (model === 'papel') {
    const hero = cash ? { n: cash, t: "recebidos no ano" } : { n: all[0].n, t: `${all[0].t} no ano` }
    const rest = (cash ? all : all.slice(1)).slice(0, 3)
    return (
      <div className={cls} style={vars}>
        <header className="ry-p-head">
          <span>retrospectiva</span>
          <span>{brand}</span>
        </header>
        <div className="ry-p-hero">
          <b style={{ fontSize: fit(hero.n, story ? 400 : 360, cash ? 4 : 2) }}>{hero.n}</b>
          <em>{hero.t}</em>
        </div>
        <div className={`ry-p-row n${rest.length}`}>
          {rest.map((x) => (
            <div key={x.t}>
              <b>{x.n}</b>
              <span>{x.t}</span>
            </div>
          ))}
        </div>
        {best && (
          <p className="ry-p-note">
            mês mais forte: <b>{best}</b>
          </p>
        )}
        {foot()}
      </div>
    )
  }

  /* ---------- vidro: fundo escuro liso, um brilho só e um cartão de vidro com a lista ---------- */
  if (model === 'vidro') {
    const rows = all.slice(0, story ? 5 : cash ? 3 : 4)
    return (
      <div className={cls} style={vars}>
        <div className="ry-v-card">
          <p className="ry-v-brand">{brand}</p>
          <h2 className="ry-v-title">
            <em>meu</em> <b>{year}</b>
          </h2>
          {cash && (
            <p className="ry-v-cash">
              <b style={{ fontSize: fit(cash, 88, 11) }}>{cash}</b> <span>recebidos</span>
            </p>
          )}
          <ul className="ry-v-rows">
            {rows.map((x) => (
              <li key={x.t}>
                <b>{x.n}</b>
                <span>{x.t}</span>
              </li>
            ))}
          </ul>
        </div>
        {foot(true)}
      </div>
    )
  }

  /* ---------- listrado: listras bege e rosé e um cartão branco com quatro números ---------- */
  if (model === 'listrado') {
    const four = (cash ? all.slice(0, 3) : all.slice(0, 4)).slice(0, 4)
    return (
      <div className={cls} style={vars}>
        <div className="ry-l-card">
          <p className="ry-l-kick">retrospectiva</p>
          <h2 className="ry-l-title">
            <b>{year}</b> <em>em números</em>
          </h2>
          {cash && (
            <p className="ry-l-cash">
              <b style={{ fontSize: fit(cash, 80, 11) }}>{cash}</b>
              <span>recebidos no ano</span>
            </p>
          )}
          <div className={`ry-l-grid n${four.length}`}>
            {four.map((x) => (
              <div key={x.t}>
                <b>{x.n}</b>
                <span>{x.t}</span>
              </div>
            ))}
          </div>
          {(best || (story && top)) && (
            <p className="ry-l-note">
              {best && (
                <span>
                  mês mais forte <b>{best}</b>
                </span>
              )}
              {story && top && (
                <span>
                  mais feito <b>{top}</b>
                </span>
              )}
            </p>
          )}
          <p className="ry-l-foot">
            <span>{handle}</span>
            <span>{brand}</span>
          </p>
        </div>
        <p className="ry-made ry-l-made">feito com planê</p>
      </div>
    )
  }

  /* ---------- blocos: fundo rosé claro e três blocos lisos de cor ---------- */
  const second = cash ? { n: cash, t: 'recebidos no ano' } : all[1]
  const third = cash ? all[1] : all[2] ?? all[1]
  return (
    <div className={cls} style={vars}>
      <h2 className="ry-b-title">
        <em>o meu</em>
        <b>{year}</b>
      </h2>
      <div className="ry-b-grid">
        <div className="ry-b-tall">
          <span>{all[0].t}</span>
          <b style={{ fontSize: fit(all[0].n, story ? 300 : 260, 2) }}>{all[0].n}</b>
        </div>
        <div className="ry-b-sm">
          <b style={{ fontSize: fit(second.n, 96, cash ? 6.5 : 4) }}>{second.n}</b>
          <span>{second.t}</span>
        </div>
        <div className="ry-b-sm is-light">
          <b>{third.n}</b>
          <span>{third.t}</span>
        </div>
      </div>
      {(best || top) && (
        <p className="ry-b-note">
          {best && <>mês mais forte: {best}</>}
          {best && top && <i />}
          {top && <>mais feito: {top}</>}
        </p>
      )}
      {foot()}
    </div>
  )
}
