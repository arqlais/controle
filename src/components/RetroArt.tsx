import type { CSSProperties } from 'react'
import type { Settings } from '../types'
import { MONTHS, money } from '../utils'
import type { RetroStats } from '../pages/Retro'

/* Arte da retrospectiva para postar: três modelos (editorial, noite e mosaico), cada um em feed (1080 × 1350)
   e story (1080 × 1920). Nas cores e fontes da marca de quem baixa; a Laís usa as dela. */

export type RetroModel = 'editorial' | 'noite' | 'mosaico'
export type RetroFormat = 'feed' | 'story'
export const RETRO_MODELS: { value: RetroModel; label: string }[] = [
  { value: 'editorial', label: 'editorial' },
  { value: 'noite', label: 'noite' },
  { value: 'mosaico', label: 'mosaico' },
]
export const retroSize = (f: RetroFormat) => ({ w: 1080, h: f === 'story' ? 1920 : 1350 })

const OWNER = { a: '#4a5d6b', r: '#d0aca3', i: '#584f4a', p: '#fafaf7', c: '#f5f1ed' }

function hexRgb(h: string): [number, number, number] | null {
  const m = h.trim().replace('#', '')
  const x = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-f]{6}$/i.test(x)) return null
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) as [number, number, number]
}
/** mistura duas cores (t = quanto da segunda) — feito aqui para o PNG sair igual em qualquer navegador */
function mix(a: string, b: string, t: number) {
  const x = hexRgb(a)
  const y = hexRgb(b)
  if (!x || !y) return a
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

interface Item {
  n: string
  t: string
}
function itemsOf(st: RetroStats): Item[] {
  return [
    { n: String(st.started), t: st.started === 1 ? 'projeto' : 'projetos' },
    { n: String(st.served), t: st.served === 1 ? 'cliente atendido' : 'clientes atendidos' },
    ...(st.delivered ? [{ n: String(st.delivered), t: st.delivered === 1 ? 'entrega' : 'entregas' }] : []),
    ...(st.quotes ? [{ n: `${st.rate}%`, t: 'das propostas aprovadas' }] : []),
    ...(st.hours ? [{ n: `${Math.round(st.hours)}h`, t: 'de projeto' }] : []),
  ]
}
/** tamanho da fonte para o texto caber na largura (números longos diminuem) */
const fitSize = (text: string, base: number, chars: number) => Math.round(base * Math.min(1, chars / Math.max(1, text.length)))

export function RetroArt({ s, year, st, values, model, format, exclusive }: { s: Settings; year: string; st: RetroStats; values: boolean; model: RetroModel; format: RetroFormat; exclusive: boolean }) {
  const c = exclusive ? OWNER : { a: s.accent || '#3e4b57', r: s.accentSoft || '#d6b3ab', i: s.text || '#3e4b57', p: '#fafaf8', c: s.background || '#f5f1ee' }
  const serif = exclusive ? 'The Seasons' : s.displayFont && s.displayFont !== 'The Seasons' ? s.displayFont : 'Cormorant Garamond'
  const { w, h } = retroSize(format)
  const brand = (s.brandName || s.ownerName || 'meu estúdio').replace(/\.$/, '')
  const handle = s.instagram ? `@${s.instagram.replace(/^@/, '')}` : brand
  const story = format === 'story'
  const items = itemsOf(st)
  const cash = values && st.received ? money(st.received).replace(',00', '') : ''
  const best = st.best >= 0 ? MONTHS[st.best].toLowerCase() : ''
  const top = st.topServices[0]?.name ?? ''
  const vars = {
    width: w,
    height: h,
    '--a': c.a,
    '--r': c.r,
    '--r2': mix(c.r, c.a, 0.28), // rosé mais firme para números grandes no fundo claro
    '--i': c.i,
    '--p': c.p,
    '--c': c.c,
    '--line': mix(c.p, c.a, 0.16),
    '--soft-on-dark': mix(c.a, '#ffffff', 0.62),
    '--serif': `'${serif}', 'Cormorant Garamond', Georgia, serif`,
  } as CSSProperties
  const foot = (
    <footer className="rx-foot">
      <span>{handle}</span>
      <span className="rx-made">feito com planê</span>
    </footer>
  )

  if (model === 'noite') {
    const [hero, ...rest] = items
    const small = rest.slice(0, story ? 4 : 3)
    return (
      <div className={`rx rx-noite ${story ? 'is-story' : ''}`} style={vars}>
        <i className="rx-ring" />
        <p className="rx-kick">
          retrospectiva <b>{year}</b>
        </p>
        <div className="rx-hero">
          <span className="rx-hero-n">{hero?.n ?? '0'}</span>
          <span className="rx-hero-t">{hero?.t ?? 'projetos'} em {year}</span>
        </div>
        {cash && (
          <p className="rx-cash" style={{ fontSize: fitSize(cash, story ? 96 : 84, 12) }}>
            {cash} <small>recebidos</small>
          </p>
        )}
        <div className={`rx-row n${small.length}`}>
          {small.map((x) => (
            <div key={x.t}>
              <b>{x.n}</b>
              <span>{x.t}</span>
            </div>
          ))}
        </div>
        {(best || top) && (
          <p className="rx-facts">
            {best && (
              <span>
                mês mais forte <b>{best}</b>
              </span>
            )}
            {top && (
              <span>
                o que mais fiz <b>{top}</b>
              </span>
            )}
          </p>
        )}
        <p className="rx-thanks">gratidão a cada cliente que confiou no meu trabalho.</p>
        {foot}
      </div>
    )
  }

  if (model === 'mosaico') {
    const tiles = items.slice(0, (story ? 5 : 4) - (values && st.received ? 1 : 0))
    return (
      <div className={`rx rx-mosaico ${story ? 'is-story' : ''}`} style={vars}>
        <header className="rx-mhead">
          <h2>
            {year} <em>em números</em>
          </h2>
          <span>{brand}</span>
        </header>
        <div className={`rx-bento n${tiles.length}${cash ? ' has-cash' : ''}`}>
          {tiles.map((x, i) => (
            <div key={x.t} className={`rx-tile t${i}`}>
              <b style={{ fontSize: fitSize(x.n, i === 0 ? 230 : 120, i === 0 ? 3 : 4) }}>{x.n}</b>
              <span>{x.t}</span>
            </div>
          ))}
          {(best || top) && (
            <div className="rx-tile is-facts" style={{ gridColumn: (tiles.length + 1) % 2 ? 'auto' : 'span 2' }}>
              {best && (
                <p>
                  <small>mês mais forte</small>
                  <b>{best}</b>
                </p>
              )}
              {top && (
                <p>
                  <small>o que mais fiz</small>
                  <b>{top}</b>
                </p>
              )}
            </div>
          )}
          {cash && (
            <div className="rx-tile is-cash">
              <b style={{ fontSize: fitSize(cash, 104, 13) }}>{cash}</b>
              <span>recebidos no ano</span>
            </div>
          )}
        </div>
        {foot}
      </div>
    )
  }

  // editorial
  const rows = items.slice(0, (story ? 5 : 4) - (cash && !story ? 1 : 0))
  return (
    <div className={`rx rx-editorial ${story ? 'is-story' : ''} ${cash ? 'has-cash' : ''}`} style={vars}>
      <p className="rx-kick">
        <i /> retrospectiva
      </p>
      <h2 className="rx-title">
        <span>meu</span>
        <em>{year}</em>
      </h2>
      {cash && (
        <p className="rx-cash">
          <b style={{ fontSize: fitSize(cash, story ? 104 : 92, 11) }}>{cash}</b> <span>recebidos no ano</span>
        </p>
      )}
      <ul className="rx-list">
        {rows.map((x) => (
          <li key={x.t}>
            <b>{x.n}</b>
            <span>{x.t}</span>
          </li>
        ))}
      </ul>
      {(best || top) && (
        <p className="rx-facts">
          {best && (
            <span>
              mês mais forte <b>{best}</b>
            </span>
          )}
          {top && (
            <span>
              o que mais fiz <b>{top}</b>
            </span>
          )}
        </p>
      )}
      {foot}
    </div>
  )
}
