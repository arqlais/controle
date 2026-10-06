import { useId } from 'react'

/* Símbolo do Planê: o P em laço, desenhado num traço só.
   Versões: solto (só o traço), quadrado e círculo cortados (o traço passa da borda)
   e círculo com o laço inteiro dentro. As cores seguem a paleta azul e rosa do planê. */

export const LACO = 'M48.5 60.5C62 61 76 55 85 44C94 33 96 18 88 9C80 1 66 1 54 7C40 14 28 30 21 45C14 60 13 78 19 90C23 98 30 99 35 93C42 85 46 72 44 61C42 50 35 44 27 44C19 44 11 46 5 51'

export const MARK = { noite: '#2f3a45', azul: '#3e4b57', rose: '#a88a80', rosa: '#d6b3ab', blush: '#f4e8e5', papel: '#f5f1ee' }

export type MarkVariant = 'solto' | 'quadrado' | 'circulo' | 'blush'

/* posição do traço em cada versão (o desenho original ocupa -4..104) */
const FIT: Record<MarkVariant, string> = {
  solto: 'translate(4 4) scale(0.926)',
  quadrado: 'translate(-7 -5) scale(1.0093) translate(4 4)',
  circulo: 'translate(-7 -5) scale(1.0093) translate(4 4)',
  blush: 'translate(14.5 14.5) scale(0.657) translate(4 4)',
}

/** O símbolo em SVG puro (favicon, ícones, e-mail). */
export function markSvg(v: MarkVariant, bg: string, line: string, stroke = 6) {
  const shape = v === 'quadrado' ? `<rect width="100" height="100" rx="24" fill="${bg}"/>` : v === 'solto' ? '' : `<circle cx="50" cy="50" r="50" fill="${bg}"/>`
  const clip = v === 'quadrado' ? '<rect x="0.6" y="0.6" width="98.8" height="98.8" rx="23.4"/>' : '<circle cx="50" cy="50" r="49.4"/>'
  const path = `<path d="${LACO}" fill="none" stroke="${line}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  const cut = v === 'quadrado' || v === 'circulo'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${cut ? `<defs><clipPath id="c">${clip}</clipPath></defs>` : ''}${shape}<g${cut ? ' clip-path="url(#c)"' : ''}><g transform="${FIT[v]}">${path}</g></g></svg>`
}

/** Símbolo para a interface. Sem cores, o traço usa a cor do texto em volta. */
export function PlaneMark({ variant = 'solto', size = 28, bg = MARK.azul, line, stroke = 6, className = '' }: { variant?: MarkVariant; size?: number; bg?: string; line?: string; stroke?: number; className?: string }) {
  const id = `pm${useId().replace(/:/g, '')}`
  const cut = variant === 'quadrado' || variant === 'circulo'
  const color = line ?? (variant === 'solto' ? 'currentColor' : variant === 'blush' ? MARK.azul : MARK.papel)
  return (
    <svg className={`plane-mark ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {cut && (
        <defs>
          <clipPath id={id}>{variant === 'quadrado' ? <rect x="0.6" y="0.6" width="98.8" height="98.8" rx="23.4" /> : <circle cx="50" cy="50" r="49.4" />}</clipPath>
        </defs>
      )}
      {variant === 'quadrado' && <rect width="100" height="100" rx="24" fill={bg} />}
      {(variant === 'circulo' || variant === 'blush') && <circle cx="50" cy="50" r="50" fill={variant === 'blush' && bg === MARK.azul ? MARK.blush : bg} />}
      <g clipPath={cut ? `url(#${id})` : undefined}>
        <g transform={FIT[variant]}>
          <path className="plane-mark-line" d={LACO} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
        </g>
      </g>
    </svg>
  )
}
