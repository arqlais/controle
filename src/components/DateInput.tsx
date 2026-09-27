import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { holidayName, today } from '../utils'

/* Campo de data com calendário na identidade visual (no lugar do calendário do navegador).
   Mesmo jeito de usar do <input type="date">: value em aaaa-mm-dd e onChange(e.target.value).
   Também dá para digitar direto: 26092026 vira 26/09/2026. */

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const toBR = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '')
const mask = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 8)
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/')
}
const fromBR = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  if (!m) return ''
  const [dd, mm, yy] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(yy, mm - 1, dd)
  return dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd ? iso(yy, mm - 1, dd) : ''
}

interface Props {
  value: string
  onChange: (e: { target: { value: string } }) => void
  min?: string
  max?: string
  id?: string
  className?: string
  title?: string
  'aria-label'?: string
}

export function DateInput({ value, onChange, min, max, id, className = '', title, ...rest }: Props) {
  const [text, setText] = useState(toBR(value))
  const [open, setOpen] = useState(false)
  const base = value || (max && max < today() ? max : today())
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 })
  const wrap = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false })

  useEffect(() => {
    setText(toBR(value))
    // o calendário abre sempre no mês da data escolhida
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setView({ y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1 })
  }, [value])

  const emit = (v: string) => onChange({ target: { value: v } })
  const allowed = (v: string) => (!min || v >= min) && (!max || v <= max)

  const show = () => {
    const b = value || (max && max < today() ? max : today())
    setView({ y: Number(b.slice(0, 4)), m: Number(b.slice(5, 7)) - 1 })
    setOpen(true)
  }

  // posiciona o calendário embaixo do campo (ou em cima, se não couber)
  useLayoutEffect(() => {
    if (!open || !wrap.current) return
    const place = () => {
      const r = wrap.current!.getBoundingClientRect()
      const h = pop.current?.offsetHeight ?? 360
      const w = pop.current?.offsetWidth ?? 300
      const up = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
      setPos({ top: up ? r.top - h - 6 : r.bottom + 6, left, up })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, view])

  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrap.current?.contains(t) && !pop.current?.contains(t)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('mousedown', out)
      document.removeEventListener('keydown', esc, true)
    }
  }, [open])

  const first = new Date(view.y, view.m, 1).getDay()
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const now = today()
  const move = (delta: number) => setView((v) => ({ y: v.y + Math.floor((v.m + delta) / 12), m: (((v.m + delta) % 12) + 12) % 12 }))
  const pick = (v: string) => {
    if (!allowed(v)) return
    emit(v)
    setOpen(false)
  }

  return (
    <span ref={wrap} className={`date-input ${className ? `has-${className.split(' ')[0]}` : ''}`}>
      <input
        id={id}
        className={className}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        value={text}
        title={title}
        aria-label={rest['aria-label']}
        onFocus={(e) => {
          e.target.select() // digitar por cima troca a data inteira
          show()
        }}
        onClick={show}
        onChange={(e) => {
          const t = mask(e.target.value)
          setText(t)
          const v = fromBR(t)
          if (v && allowed(v)) {
            emit(v)
            setView({ y: Number(v.slice(0, 4)), m: Number(v.slice(5, 7)) - 1 })
          } else if (!t) emit('')
        }}
        onBlur={() => setText(toBR(value))}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setOpen(false))}
      />
      <button type="button" className="date-input-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => (open ? setOpen(false) : show())} aria-label="Abrir calendário">
        <Icon name="calendar" size={16} />
      </button>
      {open &&
        createPortal(
          <div ref={pop} className={`date-pop ${pos.up ? 'is-up' : ''}`} style={{ top: pos.top, left: pos.left }} onMouseDown={(e) => e.preventDefault()}>
            <div className="date-pop-head">
              <button type="button" className="icon-btn subtle" onClick={() => move(-1)} aria-label="Mês anterior">
                <Icon name="chevronL" size={16} />
              </button>
              <span className="date-pop-title">
                {MONTHS[view.m]} <em>{view.y}</em>
              </span>
              <button type="button" className="icon-btn subtle" onClick={() => move(1)} aria-label="Próximo mês">
                <Icon name="chevronR" size={16} />
              </button>
            </div>
            <div className="date-pop-grid">
              {WEEK.map((w, i) => (
                <span key={w} className={`date-pop-wd ${i === 0 || i === 6 ? 'is-we' : ''}`}>
                  {w}
                </span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} />
                const v = iso(view.y, view.m, d)
                const dow = (first + d - 1) % 7
                const hol = holidayName(v)
                const cls = [
                  'date-pop-day',
                  v === value && 'is-sel',
                  v === now && 'is-today',
                  (dow === 0 || dow === 6) && 'is-we',
                  hol && 'is-hol',
                  !allowed(v) && 'is-off',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button key={v} type="button" className={cls} disabled={!allowed(v)} onClick={() => pick(v)} title={hol || undefined}>
                    {d}
                  </button>
                )
              })}
            </div>
            <div className="date-pop-foot">
              <button type="button" className="link small" disabled={!allowed(now)} onClick={() => pick(now)}>
                hoje
              </button>
              {value && (
                <button
                  type="button"
                  className="link small muted-link"
                  onClick={() => {
                    emit('')
                    setOpen(false)
                  }}
                >
                  limpar
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}
