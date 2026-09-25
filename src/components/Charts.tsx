import { useEffect, useRef, useState } from 'react'
import { money } from '../utils'

export interface BarSeries {
  label: string
  color: string
  values: number[]
}

/** Barras agrupadas em SVG (sem dependências). */
export function BarChart({ labels, series, goal, height = 220 }: { labels: string[]; series: BarSeries[]; goal?: number; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const max = Math.max(1, goal ?? 0, ...series.flatMap((s) => s.values)) * 1.1
  const H = height
  const padL = 44
  const padB = 26
  const padT = 10
  const innerW = W - padL - 8
  const innerH = H - padB - padT
  const group = innerW / labels.length
  const barW = Math.min(28, (group * 0.7) / series.length)
  const y = (v: number) => padT + innerH - (v / max) * innerH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f)

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico de barras">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="axis-label">
              {t >= 1000 ? `${(t / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : Math.round(t)}
            </text>
          </g>
        ))}
        {goal ? (
          <g>
            <line x1={padL} x2={W - 8} y1={y(goal)} y2={y(goal)} className="goal-line" />
            <text x={W - 10} y={y(goal) - 4} textAnchor="end" className="axis-label goal-text">
              meta
            </text>
          </g>
        ) : null}
        {labels.map((l, i) => {
          const gx = padL + group * i + (group - barW * series.length - 4 * (series.length - 1)) / 2
          return (
            <g key={l + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + group * i} y={padT} width={group} height={innerH} fill="transparent" className={hover === i ? 'hover-col' : ''} />
              {series.map((s, si) => {
                const v = s.values[i] ?? 0
                return (
                  <rect
                    key={s.label}
                    x={gx + si * (barW + 4)}
                    y={y(v)}
                    width={barW}
                    height={Math.max(0, padT + innerH - y(v))}
                    rx={3}
                    style={{ fill: s.color }}
                  />
                )
              })}
              <text x={padL + group * i + group / 2} y={H - 8} textAnchor="middle" className="axis-label">
                {l}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
            {hover !== null && <b>{money(s.values[hover] ?? 0)}</b>}
          </span>
        ))}
        {hover !== null && <span className="muted">{labels[hover]}</span>}
      </div>
    </div>
  )
}

export function Donut({ data, size = 150, center }: { data: { label: string; value: number; color: string }[]; size?: number; center?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = 42
  const C = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Gráfico de rosca">
        <circle cx="50" cy="50" r={r} fill="none" className="donut-track" strokeWidth="12" />
        {total > 0 &&
          data.map((d) => {
            const len = (d.value / total) * C
            const el = (
              <circle
                key={d.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                style={{ stroke: d.color }}
                strokeWidth="12"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-acc}
                transform="rotate(-90 50 50)"
              >
                <title>{`${d.label}: ${money(d.value)}`}</title>
              </circle>
            )
            acc += len
            return el
          })}
        {center && (
          <text x="50" y="54" textAnchor="middle" className="donut-center">
            {center}
          </text>
        )}
      </svg>
      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.label}>
            <i style={{ background: d.color }} />
            <span>{d.label}</span>
            <b>{total ? Math.round((d.value / total) * 100) : 0}%</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const PALETTE = ['var(--accent)', 'var(--accent-soft)', '#6b7f86', '#c9b8a3', '#7d8b6a', '#a26b5a', '#4a5a78', '#d6ccc0']
