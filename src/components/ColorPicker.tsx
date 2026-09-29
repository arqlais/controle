import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react'

/* Seletor de cor do próprio sistema (no lugar da janela do Windows/Mac):
   quadro de tom + barra de cor, HEX, RGB e as últimas cores usadas. */

const RECENT_KEY = 'cores-recentes'
const SUGGESTED = ['#3e4b57', '#2f4a5a', '#5b7a99', '#6b8f94', '#5e8c6a', '#a88a80', '#d6b3ab', '#c98f7e', '#b98246', '#8a6f9e', '#1f2429', '#f5f1ee']

type HSV = { h: number; s: number; v: number }
const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const toHex = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')
const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v)

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`
function rgbToHsv(r: number, g: number, b: number): HSV {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const d = max - Math.min(R, G, B)
  const h = d === 0 ? 0 : max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max }
}
function hsvToHex({ h, s, v }: HSV) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255
  }
  return rgbToHex(f(5), f(3), f(1))
}

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(v) ? v.filter(isHex).slice(0, 12) : []
  } catch {
    return []
  }
}
function saveRecent(hex: string) {
  try {
    const list = [hex.toLowerCase(), ...loadRecent().filter((x) => x.toLowerCase() !== hex.toLowerCase())].slice(0, 12)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* sem armazenamento: segue sem as recentes */
  }
}

/** Botão com a cor + o código; abre o seletor. */
export function ColorPicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(isHex(value) ? value : '#3e4b57')
  useEffect(() => {
    if (isHex(value)) setHex(value)
  }, [value])
  const close = () => {
    setOpen(false)
    if (isHex(hex)) saveRecent(hex)
  }
  return (
    <div className="cp">
      <button type="button" className="cp-swatch-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={label ? `Escolher cor: ${label}` : 'Escolher cor'}>
        <span className="cp-swatch" style={{ background: hex }} />
        <span className="cp-code">{hex.toUpperCase()}</span>
      </button>
      {open && (
        <>
          <div className="click-away" onClick={close} />
          <Panel
            hex={hex}
            onChange={(h) => {
              setHex(h)
              onChange(h)
            }}
            onDone={close}
          />
        </>
      )}
    </div>
  )
}

function Panel({ hex, onChange, onDone }: { hex: string; onChange: (hex: string) => void; onDone: () => void }) {
  const rgb = hexToRgb(hex)
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(rgb.r, rgb.g, rgb.b))
  const [text, setText] = useState(hex.toUpperCase())
  const [recent] = useState(loadRecent)
  const sv = useRef<HTMLDivElement>(null)
  const hue = useRef<HTMLDivElement>(null)
  // quando a cor muda por fora (HEX, RGB, recentes), o quadro acompanha
  const setFromHex = (h: string) => {
    const c = hexToRgb(h)
    const next = rgbToHsv(c.r, c.g, c.b)
    setHsv((old) => ({ ...next, h: next.s === 0 ? old.h : next.h }))
    setText(h.toUpperCase())
    onChange(h)
  }
  const setFromHsv = (next: HSV) => {
    setHsv(next)
    const h = hsvToHex(next)
    setText(h.toUpperCase())
    onChange(h)
  }
  const drag = (ref: RefObject<HTMLDivElement | null>, apply: (x: number, y: number) => void) => (e: RPointerEvent) => {
    const el = ref.current
    if (!el) return
    e.preventDefault()
    const move = (ev: PointerEvent | RPointerEvent) => {
      const r = el.getBoundingClientRect()
      apply(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height))
    }
    move(e)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 })
  return (
    <div className="cp-panel" role="dialog" aria-label="Escolher cor">
      <div ref={sv} className="cp-sv" style={{ background: pure }} onPointerDown={drag(sv, (x, y) => setFromHsv({ ...hsv, s: x, v: 1 - y }))}>
        <i className="cp-sv-dot" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <div ref={hue} className="cp-hue" onPointerDown={drag(hue, (x) => setFromHsv({ ...hsv, h: x * 359.9 }))}>
        <i className="cp-hue-dot" style={{ left: `${(hsv.h / 360) * 100}%`, background: pure }} />
      </div>
      <div className="cp-fields">
        <span className="cp-preview" style={{ background: hex }} />
        <label className="cp-f cp-f-hex">
          <span>HEX</span>
          <input
            value={text}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value.trim()
              const h = v.startsWith('#') ? v : `#${v}`
              setText(v.toUpperCase())
              if (isHex(h)) setFromHex(h.toLowerCase())
            }}
          />
        </label>
        {(['r', 'g', 'b'] as const).map((k) => (
          <label key={k} className="cp-f">
            <span>{k.toUpperCase()}</span>
            <input
              type="number"
              min={0}
              max={255}
              inputMode="numeric"
              value={rgb[k]}
              onChange={(e) => {
                const c = { ...rgb, [k]: clamp(Number(e.target.value) || 0, 0, 255) }
                setFromHex(rgbToHex(c.r, c.g, c.b))
              }}
            />
          </label>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="cp-row">
          <span className="cp-row-label">recentes</span>
          <div className="cp-dots">
            {recent.map((c) => (
              <button key={c} type="button" className="cp-dot" style={{ background: c }} onClick={() => setFromHex(c)} aria-label={`Usar ${c}`} title={c.toUpperCase()} />
            ))}
          </div>
        </div>
      )}
      <div className="cp-row">
        <span className="cp-row-label">sugestões</span>
        <div className="cp-dots">
          {SUGGESTED.map((c) => (
            <button key={c} type="button" className="cp-dot" style={{ background: c }} onClick={() => setFromHex(c)} aria-label={`Usar ${c}`} title={c.toUpperCase()} />
          ))}
        </div>
      </div>
      <button type="button" className="btn primary small cp-done" onClick={onDone}>
        pronto
      </button>
    </div>
  )
}
