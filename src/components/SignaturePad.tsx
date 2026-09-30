import { useRef, useState } from 'react'
import type { ContractSignature } from '../types'

/* Assinatura desenhada com o dedo (ou mouse): vira um traço vetorial pequeno (cabe no link e no PDF,
   nítido em qualquer tamanho). Área de 600 × 200. */

const W = 600
const H = 200

export const SIGN_FONTS: { id: string; name: string; family: string }[] = [
  { id: 'classica', name: 'clássica', family: "'Playfair Display', Georgia, serif" },
  { id: 'manuscrita', name: 'manuscrita', family: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive" },
  { id: 'simples', name: 'simples', family: "'Poppins', system-ui, sans-serif" },
]
export const signFont = (id?: string) => SIGN_FONTS.find((f) => f.id === id) ?? SIGN_FONTS[0]

export function SignaturePad({ value, onChange, label = 'assine aqui com o dedo' }: { value: string; onChange: (path: string) => void; label?: string }) {
  const box = useRef<SVGSVGElement>(null)
  const drawing = useRef(false)
  const last = useRef<[number, number] | null>(null)
  const [live, setLive] = useState(value)
  const point = (e: React.PointerEvent): [number, number] => {
    const r = box.current!.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)]
  }
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drawing.current = true
    const [x, y] = point(e)
    last.current = [x, y]
    setLive((v) => `${v}M${x} ${y}l0 0`)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return
    const [x, y] = point(e)
    const [lx, ly] = last.current
    // pula pontos muito próximos: o traço fica leve e liso
    if (Math.abs(x - lx) + Math.abs(y - ly) < 3) return
    last.current = [x, y]
    setLive((v) => `${v}L${x} ${y}`)
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    onChange(live)
  }
  return (
    <div className="sp">
      <svg
        ref={box}
        className={`sp-area ${live ? 'has-ink' : ''}`}
        viewBox={`0 0 ${W} ${H}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        role="img"
        aria-label="Área para assinar"
      >
        <line x1="40" x2={W - 40} y1={H - 44} y2={H - 44} className="sp-line" />
        {live && <path d={live} className="sp-ink" />}
        {!live && (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="sp-hint">
            {label}
          </text>
        )}
      </svg>
      <div className="sp-bar">
        <button type="button" className="link small" onClick={() => (setLive(''), onChange(''))} disabled={!live}>
          limpar e assinar de novo
        </button>
      </div>
    </div>
  )
}

/** A assinatura como aparece no contrato: o desenho, ou o nome na letra escolhida. */
export function SignatureGlyph({ sign, className = '' }: { sign: Pick<ContractSignature, 'name' | 'drawing' | 'font'>; className?: string }) {
  if (sign.drawing)
    return (
      <svg className={`sg-glyph ${className}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label={`Assinatura de ${sign.name}`}>
        <path d={sign.drawing} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  return (
    <i className={`c-sign-typed ${className}`} style={{ fontFamily: signFont(sign.font).family }}>
      {sign.name}
    </i>
  )
}

/** Desenho → imagem SVG (para salvar a assinatura da dona nas configurações). */
export const drawingToDataUrl = (path: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${path}" fill="none" stroke="#2f3a45" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`
