import type { CSSProperties } from 'react'
import type { Settings } from '../types'
import { MONTHS, money } from '../utils'
import type { RetroStats } from '../pages/Retro'

/* Arte da retrospectiva para postar: quatro modelos (cupom, gigante, mês a mês e painel), cada um em feed
   (1080 × 1350) e story (1080 × 1920). Nas cores e fontes da marca de quem baixa; a Laís usa as dela. */

export type RetroModel = 'cupom' | 'gigante' | 'meses' | 'painel'
export type RetroFormat = 'feed' | 'story'
export const RETRO_MODELS: { value: RetroModel; label: string }[] = [
  { value: 'cupom', label: 'cupom do ano' },
  { value: 'gigante', label: 'número gigante' },
  { value: 'meses', label: 'mês a mês' },
  { value: 'painel', label: 'painel' },
]
export const retroSize = (f: RetroFormat) => ({ w: 1080, h: f === 'story' ? 1920 : 1350 })

const OWNER = { a: '#4a5d6b', r: '#d0aca3', i: '#584f4a' }

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
/** tamanho da fonte para o texto caber na largura */
const fit = (text: string, base: number, chars: number) => Math.round(base * Math.min(1, chars / Math.max(1, text.length)))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

function Check({ size = 30, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  )
}
/** sinal pequeno antes do nome da marca */
function Mark({ color }: { color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" aria-hidden>
      <path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function RetroArt({ s, year, st, values, model, format, exclusive }: { s: Settings; year: string; st: RetroStats; values: boolean; model: RetroModel; format: RetroFormat; exclusive: boolean }) {
  const c = exclusive ? OWNER : { a: s.accent || '#3e4b57', r: s.accentSoft || '#d6b3ab', i: s.text || '#3e4b57' }
  const serif = exclusive ? 'The Seasons' : s.displayFont && s.displayFont !== 'The Seasons' ? s.displayFont : 'Cormorant Garamond'
  const { w, h } = retroSize(format)
  const story = format === 'story'
  const brand = (s.brandName || s.ownerName || 'meu estúdio').replace(/\.$/, '')
  const first = (s.ownerName || brand).split(' ')[0]
  const handle = s.instagram ? `@${s.instagram.replace(/^@/, '')}` : brand
  const cash = values && st.received ? money(st.received).replace(',00', '') : ''
  const best = st.best >= 0 ? MONTHS[st.best].toLowerCase() : ''
  const top = st.topServices[0]?.name ?? ''
  const hours = Math.round(st.hours)
  const active = st.months.filter((m) => m.got > 0).length
  const vars = {
    width: w,
    height: h,
    '--a': c.a,
    '--r': c.r,
    '--i': c.i,
    '--a-deep': mix(c.a, '#000000', 0.4),
    '--a-soft': mix(c.a, '#ffffff', 0.86),
    '--a-mid': mix(c.a, '#ffffff', 0.62),
    '--r-soft': mix(c.r, '#ffffff', 0.42),
    '--r-deep': mix(c.r, c.a, 0.3),
    '--r-glow': mix(c.a, c.r, 0.5),
    '--serif': `'${serif}', 'Cormorant Garamond', Georgia, serif`,
  } as CSSProperties
  const cls = `ry ry-${model} ${story ? 'is-story' : ''}`

  /* ---------- cupom do ano: um cupom fiscal do ano, com carimbo ---------- */
  if (model === 'cupom') {
    const rows: [string, string][] = (
      [
        ['projetos', String(st.started)],
        ['clientes atendidos', String(st.served)],
        st.delivered ? ['entregas', String(st.delivered)] : null,
        st.quotes ? ['propostas aprovadas', `${st.rate}%`] : null,
        hours ? ['horas de projeto', `${hours}h`] : null,
        st.newClients ? ['clientes novos', String(st.newClients)] : null,
      ].filter(Boolean) as [string, string][]
    ).slice(0, story ? 6 : 5)
    const bars = Array.from(`${brand}${year}retrospectiva-do-ano`).map((ch, i) => 3 + ((ch.charCodeAt(0) * (i + 7)) % 8))
    return (
      <div className={cls} style={vars}>
        <div className="ry-c-wrap">
          <div className="ry-c-ticket">
            <div className="ry-c-in">
              <p className="ry-c-brand">
                <Mark color={c.a} /> {brand}
              </p>
              <p className="ry-c-sub">cupom do ano · {year}</p>
              <p className="ry-c-sub">emitido em 31 dez {year}</p>
              <hr />
              {rows.map(([l, v]) => (
                <p key={l} className="ry-c-row">
                  <span>{l}</span>
                  <b>{v}</b>
                </p>
              ))}
              {(best || top) && <hr />}
              {best && (
                <p className="ry-c-row">
                  <span>mês mais forte</span>
                  <b>{best}</b>
                </p>
              )}
              {top && (
                <p className="ry-c-row is-txt">
                  <span>mais feito</span>
                  <b>{top}</b>
                </p>
              )}
              <hr className="is-strong" />
              <p className="ry-c-total">
                <span>total</span>
                <b style={{ fontSize: fit(cash || `${st.started} proj.`, 92, 10) }}>{cash || `${st.started} ${plural(st.started, 'projeto', 'projetos')}`}</b>
              </p>
              <div className="ry-c-code">
                {bars.map((b, i) => (
                  <i key={i} style={{ width: b }} />
                ))}
              </div>
              <p className="ry-c-thanks">gratidão a cada cliente</p>
              <p className="ry-c-sub">{handle}</p>
            </div>
            <div className="ry-c-teeth" />
          </div>
          <div className="ry-c-stamp">
            <span>
              ano
              <br />
              fechado
            </span>
          </div>
        </div>
        <p className="ry-made is-light">feito com planê</p>
      </div>
    )
  }

  /* ---------- número gigante: um número enorme, a palavra vazada e etiquetas ---------- */
  if (model === 'gigante') {
    const word = plural(st.started, 'projeto', 'projetos')
    const boxes = [
      hours ? { n: `${hours}h`, t: 'de projeto' } : null,
      st.quotes ? { n: `${st.rate}%`, t: 'aprovação' } : null,
      st.delivered ? { n: String(st.delivered), t: plural(st.delivered, 'entrega', 'entregas') } : null,
      { n: String(st.newClients), t: plural(st.newClients, 'cliente novo', 'clientes novos') },
    ]
      .filter((x): x is { n: string; t: string } => !!x)
      .slice(0, 3)
    return (
      <div className={cls} style={vars}>
        <header className="ry-top">
          <span>
            <Mark color={c.a} /> {brand}
          </span>
          <span>{year}</span>
        </header>
        <p className="ry-g-kick">{first} fechou o ano com</p>
        <p className="ry-g-num" style={{ fontSize: fit(String(st.started), story ? 620 : 500, 2) }}>
          {st.started}
        </p>
        <p className="ry-g-word" style={{ fontSize: fit(word, story ? 160 : 150, 8) }}>
          {word}
        </p>
        <div className="ry-g-pills">
          {cash && <span className="is-solid">{cash} recebidos</span>}
          <span className={cash ? '' : 'is-solid'}>
            {st.served} {plural(st.served, 'cliente atendido', 'clientes atendidos')}
          </span>
          {best && <span>+ mês mais forte: {best}</span>}
          {story && top && <span>+ mais feito: {top}</span>}
        </div>
        <div className={`ry-g-boxes n${boxes.length}`}>
          {boxes.map((b) => (
            <div key={b.t}>
              <b>{b.n}</b>
              <span>{b.t}</span>
            </div>
          ))}
        </div>
        <footer className="ry-foot">
          <span>retrospectiva {year}</span>
          <span>{handle}</span>
        </footer>
      </div>
    )
  }

  /* ---------- mês a mês: as 12 barras do ano, com check nos meses em que entrou projeto ---------- */
  if (model === 'meses') {
    const max = Math.max(1, ...st.months.map((m) => m.got))
    const sub = [st.delivered ? `${st.delivered} ${plural(st.delivered, 'entrega', 'entregas')}` : '', hours ? `${hours}h de projeto` : '', top ? `mais feito: ${top}` : ''].filter(Boolean).join(' · ')
    return (
      <div className={cls} style={vars}>
        <header className="ry-top">
          <span>
            <Mark color={c.a} /> {brand}
          </span>
          <span className="ry-pill">{year}</span>
        </header>
        <h2 className="ry-m-title">
          {best ? (
            <>
              melhor mês:
              <br />
              {best}
            </>
          ) : (
            <>
              meu {year}
              <br />
              mês a mês
            </>
          )}
        </h2>
        <p className="ry-m-sub">
          {active} {plural(active, 'mês', 'meses')} com projeto entrando
        </p>
        <div className="ry-m-chart">
          {st.months.map((m, i) => {
            const on = m.got > 0
            const pct = on ? Math.max(16, (m.got / max) * 100) : 8
            return (
              <div key={m.key} className="ry-m-col">
                <div className={`ry-m-bar ${on ? 'is-on' : ''} ${i === st.best ? 'is-best' : ''}`} style={{ height: `${pct}%` }}>
                  {on && <Check size={story ? 34 : 28} color={i === st.best ? c.a : '#ffffff'} />}
                </div>
                <span>{MONTHS[i].slice(0, 1).toLowerCase()}</span>
              </div>
            )
          })}
        </div>
        <div className="ry-m-foot">
          <b style={{ fontSize: fit(cash || `${st.started} projetos`, 100, 11) }}>{cash || `${st.started} ${plural(st.started, 'projeto', 'projetos')}`}</b>
          <span>{cash ? `recebidos em ${year} · ${st.started} ${plural(st.started, 'projeto', 'projetos')}` : `${st.served} ${plural(st.served, 'cliente', 'clientes')}${sub ? ` · ${sub}` : ''}`}</span>
        </div>
        <footer className="ry-foot">
          <span>{handle}</span>
          <span className="ry-made">feito com planê</span>
        </footer>
      </div>
    )
  }

  /* ---------- painel: fundo escuro, ano vazado e um cartão de vidro com o medidor de aprovação ---------- */
  const R = 110
  const arc = Math.PI * R
  const rate = Math.max(0, Math.min(100, st.rate))
  return (
    <div className={cls} style={vars}>
      <header className="ry-top is-light">
        <span>
          <Mark color="#ffffff" /> {brand}
        </span>
        <span className="ry-pill is-light">retrospectiva</span>
      </header>
      <p className="ry-p-year">{year}</p>
      <div className="ry-p-card">
        <p className="ry-p-who">
          {first} · {year}
        </p>
        <div className="ry-p-main">
          <div className="ry-p-left">
            <b className="ry-p-big" style={{ fontSize: fit(cash || String(st.started), cash ? 104 : 200, cash ? 9 : 2) }}>
              {cash || st.started}
            </b>
            <span className="ry-p-unit">{cash ? 'recebidos no ano' : plural(st.started, 'projeto no ano', 'projetos no ano')}</span>
          </div>
          {st.quotes > 0 && (
            <div className="ry-p-gauge">
              <svg width="260" height="150" viewBox="0 0 260 150" aria-hidden>
                <path d={`M 20 135 A ${R} ${R} 0 0 1 240 135`} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="20" strokeLinecap="round" />
                <path d={`M 20 135 A ${R} ${R} 0 0 1 240 135`} fill="none" stroke={c.r} strokeWidth="20" strokeLinecap="round" strokeDasharray={`${(arc * rate) / 100} ${arc}`} />
              </svg>
              <b>{rate}%</b>
              <span>aprovação</span>
            </div>
          )}
        </div>
        <div className="ry-p-stats">
          {cash && (
            <p>
              <i /> projetos <b>{st.started}</b>
            </p>
          )}
          <p>
            <i /> clientes <b>{st.served}</b>
          </p>
          {st.delivered > 0 && (
            <p>
              <i /> entregas <b>{st.delivered}</b>
            </p>
          )}
          {hours > 0 && !cash && (
            <p>
              <i /> horas <b>{hours}h</b>
            </p>
          )}
        </div>
        {(best || top) && (
          <p className="ry-p-note">
            {best && <>mês mais forte: {best}</>}
            {best && top && '  ·  '}
            {top && <>mais feito: {top}</>}
          </p>
        )}
      </div>
      <footer className="ry-foot is-light">
        <span>{handle}</span>
        <span className="ry-made">feito com planê</span>
      </footer>
    </div>
  )
}
