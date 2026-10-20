import type { CSSProperties, ReactNode } from 'react'
import type { Settings } from '../types'
import { MONTHS, money } from '../utils'
import type { RetroStats } from '../pages/Retro'

/* Arte da retrospectiva para postar, no visual dos posts do planê: fundo com brilho suave,
   vidro sem exagero, símbolos em quadradinhos, números em Poppins e palavras na serifada.
   Quatro modelos bem diferentes (lançamento, celular, listrado e widgets), em feed (1080 × 1350)
   e story (1080 × 1920). Nas cores da marca de quem baixa; a Laís usa as dela. */

export type RetroModel = 'lancamento' | 'celular' | 'listrado' | 'widgets'
export type RetroFormat = 'feed' | 'story'
export const RETRO_MODELS: { value: RetroModel; label: string }[] = [
  { value: 'lancamento', label: 'escuro com vidro' },
  { value: 'celular', label: 'celular' },
  { value: 'listrado', label: 'listrado' },
  { value: 'widgets', label: 'widgets' },
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
const fit = (text: string, base: number, chars: number) => Math.round(base * Math.min(1, chars / Math.max(1, text.length)))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const PATHS: Record<string, string> = {
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  check: 'M5 12.5 10 17.5 19 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0V6a2 2 0 0 1 2-2h11M16.5 13.5h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  box: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
}
function Sym({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] ?? PATHS.star} />
    </svg>
  )
}

interface Row {
  icon: string
  n: string
  t: string
}

export function RetroArt({ s, year, st, values, model, format, exclusive }: { s: Settings; year: string; st: RetroStats; values: boolean; model: RetroModel; format: RetroFormat; exclusive: boolean }) {
  const c = exclusive ? OWNER : { a: s.accent || '#3e4b57', r: s.accentSoft || '#d6b3ab', i: s.text || '#3e4b57', b: s.background || '#f5f1ee' }
  const serif = exclusive ? 'The Seasons' : s.displayFont && s.displayFont !== 'The Seasons' ? s.displayFont : 'Cormorant Garamond'
  const { w, h } = retroSize(format)
  const story = format === 'story'
  const brand = (s.brandName || s.ownerName || 'meu estúdio').replace(/\.$/, '')
  const initial = brand.slice(0, 1).toLowerCase()
  const handle = s.instagram ? `@${s.instagram.replace(/^@/, '')}` : brand
  const cash = values && st.received ? money(st.received).replace(',00', '') : ''
  const best = st.best >= 0 ? MONTHS[st.best].toLowerCase() : ''
  const top = st.topServices[0]?.name ?? ''
  const hours = Math.round(st.hours)
  const maxMonth = Math.max(1, ...st.months.map((m) => m.got))
  const rows: Row[] = [
    { icon: 'layers', n: String(st.started), t: plural(st.started, 'projeto', 'projetos') },
    { icon: 'users', n: String(st.served), t: plural(st.served, 'cliente atendido', 'clientes atendidos') },
    ...(cash ? [{ icon: 'wallet', n: cash, t: 'recebidos' }] : []),
    ...(st.quotes ? [{ icon: 'check', n: `${st.rate}%`, t: 'das propostas aprovadas' }] : []),
    ...(st.delivered ? [{ icon: 'box', n: String(st.delivered), t: plural(st.delivered, 'entrega', 'entregas') }] : []),
    ...(hours ? [{ icon: 'clock', n: `${hours}h`, t: 'de projeto' }] : []),
  ]
  const vars = {
    width: w,
    height: h,
    '--a': c.a,
    '--r': c.r,
    '--i': c.i,
    '--bg': c.b,
    '--a-deep': mix(c.a, '#000000', 0.22),
    '--a-lift': mix(c.a, '#ffffff', 0.12),
    '--a-soft': rgba(c.a, 0.1),
    '--a-line': rgba(c.a, 0.14),
    '--r-deep': mix(c.r, c.a, 0.3),
    '--r-glow': rgba(c.r, 0.55),
    '--a-glow': rgba(c.a, 0.16),
    '--stripe': mix(c.b, c.r, 0.36),
    '--serif': `'${serif}', 'Cormorant Garamond', Georgia, serif`,
  } as CSSProperties
  const cls = `rz rz-${model} ${story ? 'is-story' : ''}`
  const logo = (light = false) => (
    <span className={`rz-brand ${light ? 'is-light' : ''}`}>
      <i>{initial}</i>
      {brand}
    </span>
  )
  const bars = (
    <div className="rz-bars">
      {st.months.map((m, i) => (
        <div key={m.key} className="rz-bar-col">
          <div className={`rz-bar ${m.got > 0 ? 'is-on' : ''} ${i === st.best ? 'is-best' : ''}`} style={{ height: `${m.got > 0 ? Math.max(14, (m.got / maxMonth) * 100) : 7}%` }} />
          <span>{MONTHS[i].slice(0, 1).toLowerCase()}</span>
        </div>
      ))}
    </div>
  )
  const Item = ({ r, light }: { r: Row; light?: boolean }): ReactNode => (
    <li className={light ? 'is-light' : ''}>
      <span className="rz-ico">
        <Sym name={r.icon} size={story ? 30 : 26} />
      </span>
      <b style={{ fontSize: r.n.length > 6 ? fit(r.n, 56, 9) : undefined }}>{r.n}</b>
      <span className="rz-t">{r.t}</span>
    </li>
  )

  /* ---------- escuro com vidro: no clima do post de lançamento ---------- */
  if (model === 'lancamento') {
    const list = rows.slice(0, story ? 6 : 4)
    return (
      <div className={cls} style={vars}>
        <header className="rz-head">
          {logo(true)}
          <span className="rz-kick">retrospectiva</span>
        </header>
        <h2 className="rz-l-title">
          meu ano
          <br />
          em <em>projetos</em>
        </h2>
        <p className="rz-l-year">{year}</p>
        <div className="rz-glass is-dark">
          <p className="rz-cap">o que rolou</p>
          <ul className="rz-list">
            {list.map((r) => (
              <Item key={r.t} r={r} light />
            ))}
          </ul>
        </div>
        <footer className="rz-l-foot">
          <p>
            {best ? (
              <>
                mês mais forte: <em>{best}</em>
              </>
            ) : (
              <>
                gratidão a cada <em>cliente</em>
              </>
            )}
          </p>
          <span className="rz-pill">{handle}</span>
        </footer>
      </div>
    )
  }

  /* ---------- celular: o ano na tela de um celular, com avisos de vidro em volta ---------- */
  if (model === 'celular') {
    const notes: Row[] = [
      ...(best ? [{ icon: 'chart', n: best, t: 'foi o mês mais forte' }] : []),
      ...(st.quotes ? [{ icon: 'check', n: `${st.rate}%`, t: 'das propostas aprovadas' }] : []),
      ...(top ? [{ icon: 'star', n: 'mais feito', t: top }] : []),
    ].slice(0, story ? 3 : 2)
    const big = cash || String(st.started)
    return (
      <div className={cls} style={vars}>
        <header className="rz-head">
          {logo()}
          <span className="rz-kick is-dark">{year}</span>
        </header>
        <h2 className="rz-c-title">
          <em>meu</em> {year}
        </h2>
        <div className="rz-phone">
          <div className="rz-screen">
            <div className="rz-status">
              <span>9:41</span>
              <i />
            </div>
            <div className="rz-hero">
              <small>retrospectiva {year}</small>
              <p>
                <em>que ano,</em> {brand.split(' ')[0]}
              </p>
            </div>
            <div className="rz-mini">
              <div>
                <b style={{ fontSize: fit(big, 64, 6) }}>{big}</b>
                <span>{cash ? 'recebidos' : plural(st.started, 'projeto', 'projetos')}</span>
              </div>
              <div>
                <b>{st.served}</b>
                <span>{plural(st.served, 'cliente', 'clientes')}</span>
              </div>
            </div>
            <div className="rz-mini-chart">
              <span>mês a mês</span>
              {bars}
            </div>
          </div>
        </div>
        {notes.map((n, i) => (
          <div key={n.t} className={`rz-glass rz-note n${i}`}>
            <span className="rz-ico">
              <Sym name={n.icon} size={26} />
            </span>
            <span>
              <b>{n.n}</b>
              <small>{n.t}</small>
            </span>
          </div>
        ))}
        <footer className="rz-foot">
          <span>{handle}</span>
          <span className="rz-made">feito com planê</span>
        </footer>
      </div>
    )
  }

  /* ---------- listrado: listras bege e rosé e um cartão de vidro com os números ---------- */
  if (model === 'listrado') {
    const grid = rows.slice(0, story ? 6 : 4)
    return (
      <div className={cls} style={vars}>
        <header className="rz-head">
          {logo()}
          <span className="rz-kick is-dark">retrospectiva</span>
        </header>
        <div className="rz-glass rz-sheet">
          <h2 className="rz-s-title">
            <b>{year}</b>
            <em>em números</em>
          </h2>
          <div className={`rz-grid n${grid.length}`}>
            {grid.map((r) => (
              <div key={r.t}>
                <span className="rz-ico">
                  <Sym name={r.icon} size={24} />
                </span>
                <b style={{ fontSize: r.n.length > 5 ? fit(r.n, 76, 8) : undefined }}>{r.n}</b>
                <span className="rz-t">{r.t}</span>
              </div>
            ))}
          </div>
          {best && (
            <p className="rz-s-note">
              <span className="rz-ico is-rose">
                <Sym name="heart" size={20} />
              </span>
              mês mais forte: <b>{best}</b>
            </p>
          )}
        </div>
        <footer className="rz-foot">
          <span>{handle}</span>
          <span className="rz-made">feito com planê</span>
        </footer>
      </div>
    )
  }

  /* ---------- widgets: a tela inicial do celular em blocos ---------- */
  return (
    <div className={cls} style={vars}>
      <header className="rz-head">
        {logo()}
        <span className="rz-kick is-dark">retrospectiva</span>
      </header>
      <h2 className="rz-w-title">
        {year} <em>em resumo</em>
      </h2>
      <div className="rz-wgrid">
        <div className="rz-w rz-w-dark rz-w-tall">
          <span className="rz-ico is-light">
            <Sym name="layers" size={26} />
          </span>
          <div>
            <b style={{ fontSize: fit(String(st.started), story ? 250 : 220, 2) }}>{st.started}</b>
            <span className="rz-t">{plural(st.started, 'projeto no ano', 'projetos no ano')}</span>
          </div>
        </div>
        <div className="rz-w rz-glass">
          <span className="rz-ico">
            <Sym name="users" size={24} />
          </span>
          <div>
            <b>{st.served}</b>
            <span className="rz-t">{plural(st.served, 'cliente', 'clientes')}</span>
          </div>
        </div>
        <div className="rz-w rz-w-rose">
          <span className="rz-ico">
            <Sym name={st.quotes ? 'check' : 'box'} size={24} />
          </span>
          <div>
            <b>{st.quotes ? `${st.rate}%` : st.delivered}</b>
            <span className="rz-t">{st.quotes ? 'aprovação' : plural(st.delivered, 'entrega', 'entregas')}</span>
          </div>
        </div>
        <div className="rz-w rz-glass rz-w-wide">
          <div className="rz-w-head">
            <b>{cash ? `${cash} recebidos` : best ? `melhor mês: ${best}` : 'mês a mês'}</b>
            {cash && best && <span>melhor mês: {best}</span>}
          </div>
          {bars}
        </div>
        {story && (
          <>
            <div className="rz-w rz-glass">
              <span className="rz-ico">
                <Sym name="clock" size={24} />
              </span>
              <div>
                <b>{hours ? `${hours}h` : st.delivered}</b>
                <span className="rz-t">{hours ? 'de projeto' : plural(st.delivered, 'entrega', 'entregas')}</span>
              </div>
            </div>
            <div className="rz-w rz-w-dark">
              <span className="rz-ico is-light">
                <Sym name="star" size={24} />
              </span>
              <div>
                <span className="rz-t">mais feito</span>
                <em className="rz-word">{top || '—'}</em>
              </div>
            </div>
          </>
        )}
      </div>
      <footer className="rz-foot">
        <span>{handle}</span>
        <span className="rz-made">feito com planê</span>
      </footer>
    </div>
  )
}
