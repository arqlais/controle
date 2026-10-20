import type { CSSProperties, ReactNode } from 'react'
import type { Settings } from '../types'
import { MONTHS, money } from '../utils'
import type { RetroStats } from '../pages/Retro'

/* Arte da retrospectiva para postar, no visual das artes do Instagram: fundo bege com manchas suaves
   (ou listrado bege/rosé), cartões de vidro arredondados, números em Poppins e palavras na serifada.
   Quatro modelos (widgets, notificações, listrado e mês a mês), cada um em feed (1080 × 1350) e story (1080 × 1920).
   Nas cores da marca de quem baixa; a Laís usa as dela. */

export type RetroModel = 'widgets' | 'avisos' | 'listrado' | 'meses'
export type RetroFormat = 'feed' | 'story'
export const RETRO_MODELS: { value: RetroModel; label: string }[] = [
  { value: 'widgets', label: 'widgets' },
  { value: 'avisos', label: 'notificações' },
  { value: 'listrado', label: 'listrado' },
  { value: 'meses', label: 'mês a mês' },
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

/* símbolos simples (traço), para os ícones dos cartões */
const PATHS: Record<string, string> = {
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  check: 'M5 12.5 10 17.5 19 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0V6a2 2 0 0 1 2-2h11M16.5 13.5h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  box: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
}
function Sym({ name, size = 30 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

export function RetroArt({ s, year, st, values, model, format, exclusive }: { s: Settings; year: string; st: RetroStats; values: boolean; model: RetroModel; format: RetroFormat; exclusive: boolean }) {
  const c = exclusive ? OWNER : { a: s.accent || '#3e4b57', r: s.accentSoft || '#d6b3ab', i: s.text || '#3e4b57', b: s.background || '#f5f1ee' }
  const serif = exclusive ? 'The Seasons' : s.displayFont && s.displayFont !== 'The Seasons' ? s.displayFont : 'Cormorant Garamond'
  const { w, h } = retroSize(format)
  const story = format === 'story'
  const brand = (s.brandName || s.ownerName || 'meu estúdio').replace(/\.$/, '')
  const first = (s.ownerName || brand).split(' ')[0]
  const initial = brand.slice(0, 1).toLowerCase()
  const handle = s.instagram ? `@${s.instagram.replace(/^@/, '')}` : brand
  const cash = values && st.received ? money(st.received).replace(',00', '') : ''
  const best = st.best >= 0 ? MONTHS[st.best].toLowerCase() : ''
  const top = st.topServices[0]?.name ?? ''
  const hours = Math.round(st.hours)
  const maxMonth = Math.max(1, ...st.months.map((m) => m.got))
  const vars = {
    width: w,
    height: h,
    '--a': c.a,
    '--r': c.r,
    '--i': c.i,
    '--bg': c.b,
    '--r-deep': mix(c.r, c.a, 0.32),
    '--r-blob': rgba(c.r, 0.75),
    '--a-blob': rgba(c.a, 0.18),
    '--a-shadow': rgba(c.a, 0.42),
    '--a-soft': rgba(c.a, 0.12),
    '--a-mist': mix(c.a, '#ffffff', 0.55),
    '--stripe': mix(c.b, c.r, 0.42),
    '--line': rgba(c.a, 0.14),
    '--serif': `'${serif}', 'Cormorant Garamond', Georgia, serif`,
  } as CSSProperties
  const cls = `ry ry-${model} ${story ? 'is-story' : ''}`
  const head = (
    <header className="ry-head">
      <span className="ry-brand">
        <i>{initial}</i>
        {brand}
      </span>
      <span className="ry-chip">retrospectiva {year}</span>
    </header>
  )
  const foot = (
    <footer className="ry-foot">
      <span>{handle}</span>
      <span className="ry-made">feito com planê</span>
    </footer>
  )
  const bars = (tall = false) => (
    <div className={`ry-bars ${tall ? 'is-tall' : ''}`}>
      {st.months.map((m, i) => (
        <div key={m.key} className="ry-bar-col">
          <div className={`ry-bar ${m.got > 0 ? 'is-on' : ''} ${i === st.best ? 'is-best' : ''}`} style={{ height: `${m.got > 0 ? Math.max(14, (m.got / maxMonth) * 100) : 7}%` }} />
          <span>{MONTHS[i].slice(0, 1).toLowerCase()}</span>
        </div>
      ))}
    </div>
  )

  /* ---------- widgets: a tela inicial do celular, com cartões de vidro ---------- */
  if (model === 'widgets') {
    return (
      <div className={cls} style={vars}>
        {head}
        <h2 className="ry-title">
          <b>{year}</b>
          <em>em resumo</em>
        </h2>
        <div className="ry-wgrid">
          <div className="ry-glass ry-w-tall">
            <span className="ry-ico">
              <Sym name="layers" />
            </span>
            <div>
              <b className="ry-num" style={{ fontSize: fit(String(st.started), story ? 260 : 230, 2) }}>
                {st.started}
              </b>
              <span className="ry-lbl">{plural(st.started, 'projeto no ano', 'projetos no ano')}</span>
            </div>
          </div>
          <div className="ry-glass ry-w-sm">
            <span className="ry-ico">
              <Sym name="users" />
            </span>
            <div>
              <b className="ry-num">{st.served}</b>
              <span className="ry-lbl">{plural(st.served, 'cliente', 'clientes')}</span>
            </div>
          </div>
          <div className="ry-glass ry-w-sm">
            <span className="ry-ico">
              <Sym name={st.quotes ? 'check' : 'box'} />
            </span>
            <div>
              <b className="ry-num">{st.quotes ? `${st.rate}%` : st.delivered}</b>
              <span className="ry-lbl">{st.quotes ? 'aprovação' : plural(st.delivered, 'entrega', 'entregas')}</span>
              {st.quotes > 0 && (
                <span className="ry-track">
                  <i style={{ width: `${Math.max(4, st.rate)}%` }} />
                </span>
              )}
            </div>
          </div>
          <div className="ry-glass ry-w-wide">
            <div className="ry-w-wide-head">
              <span className="ry-lbl is-strong">{cash ? `${cash} recebidos` : best ? `melhor mês: ${best}` : 'mês a mês'}</span>
              {cash && best && <span className="ry-lbl">melhor mês: {best}</span>}
            </div>
            {bars()}
          </div>
          {story && (
            <>
              <div className="ry-glass ry-w-sm">
                <span className="ry-ico">
                  <Sym name="clock" />
                </span>
                <div>
                  <b className="ry-num">{hours ? `${hours}h` : st.delivered}</b>
                  <span className="ry-lbl">{hours ? 'de projeto' : plural(st.delivered, 'entrega', 'entregas')}</span>
                </div>
              </div>
              <div className="ry-glass ry-w-sm">
                <span className="ry-ico">
                  <Sym name="star" />
                </span>
                <div>
                  <span className="ry-lbl">mais feito</span>
                  <em className="ry-word">{top || '—'}</em>
                </div>
              </div>
            </>
          )}
        </div>
        {foot}
      </div>
    )
  }

  /* ---------- notificações: a tela de bloqueio, com os números do ano chegando como avisos ---------- */
  if (model === 'avisos') {
    const list: { icon: keyof typeof PATHS; title: string; text: ReactNode; when: string }[] = [
      { icon: 'layers', title: 'projetos', text: `${st.started} ${plural(st.started, 'projeto', 'projetos')} neste ano`, when: 'agora' },
      { icon: 'users', title: 'clientes', text: `${st.served} ${plural(st.served, 'cliente confiou', 'clientes confiaram')} no meu trabalho`, when: 'agora' },
      ...(cash ? [{ icon: 'wallet' as const, title: 'financeiro', text: `${cash} recebidos no ano`, when: 'agora' }] : []),
      ...(best ? [{ icon: 'chart' as const, title: 'mês mais forte', text: `${best} foi o mês campeão`, when: MONTHS[st.best].slice(0, 3).toLowerCase() }] : []),
      ...(st.quotes ? [{ icon: 'check' as const, title: 'propostas', text: `${st.rate}% das propostas aprovadas`, when: 'ontem' }] : []),
      ...(top ? [{ icon: 'star' as const, title: 'mais feito', text: top, when: year }] : []),
      ...(hours ? [{ icon: 'clock' as const, title: 'horas', text: `${hours}h de projeto registradas`, when: year }] : []),
    ].slice(0, story ? 6 : 4)
    return (
      <div className={cls} style={vars}>
        {head}
        <div className="ry-lock">
          <p className="ry-lock-day">31 de dezembro</p>
          <p className="ry-lock-time">{year}</p>
          <p className="ry-lock-sub">
            o ano de <em>{first}</em>
          </p>
        </div>
        <div className="ry-notes">
          {list.map((n) => (
            <div key={n.title} className="ry-glass ry-note">
              <span className="ry-app">
                <Sym name={n.icon} size={story ? 34 : 30} />
              </span>
              <div className="ry-note-body">
                <p className="ry-note-top">
                  <span>{n.title}</span>
                  <small>{n.when}</small>
                </p>
                <p className="ry-note-text">{n.text}</p>
              </div>
            </div>
          ))}
        </div>
        <i className="ry-home" />
        {foot}
      </div>
    )
  }

  /* ---------- listrado: fundo listrado bege e rosé e um cartão de vidro com a lista do ano ---------- */
  if (model === 'listrado') {
    const rows = [
      { n: String(st.started), t: plural(st.started, 'projeto', 'projetos') },
      { n: String(st.served), t: plural(st.served, 'cliente atendido', 'clientes atendidos') },
      ...(st.delivered ? [{ n: String(st.delivered), t: plural(st.delivered, 'entrega', 'entregas') }] : []),
      ...(st.quotes ? [{ n: `${st.rate}%`, t: 'das propostas aprovadas' }] : []),
      ...(hours ? [{ n: `${hours}h`, t: 'de projeto' }] : []),
    ].slice(0, (story ? 5 : 4) - (cash && !story ? 1 : 0))
    return (
      <div className={cls} style={vars}>
        {head}
        <div className="ry-glass ry-sheet">
          <p className="ry-kick">retrospectiva</p>
          <h2 className="ry-sheet-title">
            <em>meu</em> <b>{year}</b>
          </h2>
          {cash && (
            <p className="ry-sheet-cash">
              <b style={{ fontSize: fit(cash, 92, 11) }}>{cash}</b>
              <em>recebidos</em>
            </p>
          )}
          <ul className="ry-rows">
            {rows.map((x) => (
              <li key={x.t}>
                <b>{x.n}</b>
                <span>{x.t}</span>
              </li>
            ))}
          </ul>
          {(best || top) && (
            <p className="ry-sheet-note">
              {best && (
                <span>
                  mês mais forte <b>{best}</b>
                </span>
              )}
              {top && (
                <span>
                  mais feito <b>{top}</b>
                </span>
              )}
            </p>
          )}
        </div>
        {foot}
      </div>
    )
  }

  /* ---------- mês a mês: o gráfico do ano num cartão de vidro ---------- */
  const big = cash || `${st.started}`
  return (
    <div className={cls} style={vars}>
      {head}
      <h2 className="ry-title">
        <b>{best ? best : year}</b>
        <em>{best ? 'foi o mês mais forte' : 'mês a mês'}</em>
      </h2>
      <div className="ry-glass ry-chart">
        <div className="ry-chart-head">
          <b className="ry-num" style={{ fontSize: fit(big, cash ? 96 : 120, cash ? 11 : 3) }}>
            {big}
          </b>
          <span className="ry-lbl">{cash ? `recebidos em ${year}` : plural(st.started, `projeto em ${year}`, `projetos em ${year}`)}</span>
        </div>
        {bars(true)}
      </div>
      <div className="ry-duo">
        <div className="ry-glass">
          <b className="ry-num">{st.served}</b>
          <span className="ry-lbl">{plural(st.served, 'cliente', 'clientes')}</span>
        </div>
        <div className="ry-glass">
          <b className="ry-num">{st.quotes ? `${st.rate}%` : hours ? `${hours}h` : st.delivered}</b>
          <span className="ry-lbl">{st.quotes ? 'aprovação' : hours ? 'de projeto' : plural(st.delivered, 'entrega', 'entregas')}</span>
        </div>
        {story && (
          <>
            <div className="ry-glass">
              <b className="ry-num">{st.delivered}</b>
              <span className="ry-lbl">{plural(st.delivered, 'entrega', 'entregas')}</span>
            </div>
            <div className="ry-glass">
              <b className="ry-num">{hours ? `${hours}h` : st.newClients}</b>
              <span className="ry-lbl">{hours ? 'de projeto' : plural(st.newClients, 'cliente novo', 'clientes novos')}</span>
            </div>
          </>
        )}
      </div>
      {foot}
    </div>
  )
}
