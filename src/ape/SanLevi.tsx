/* Símbolo do San Levi: as duas torres com as janelas em grade e o sol atrás, nas cores do planê apzinho.
   Usado em tudo que é do condomínio (área dos moradores, orçamentos, cadastros, foto do painel). */

const janelas = (x0: number, y0: number, cols: number, rows: number, dx: number, dy: number, w: number, h: number, cor: string) => {
  let s = ''
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s += `<rect x="${x0 + c * dx}" y="${y0 + r * dy}" width="${w}" height="${h}" rx="0.9" fill="${cor}"/>`
  return s
}

/** Ilustração colorida (capa, foto do painel, área dos moradores). */
export function SanLeviArte({ size = 64, fundo = true, className = '' }: { size?: number; fundo?: boolean; className?: string }) {
  const svg = `
    ${fundo ? '<rect width="120" height="120" rx="26" fill="var(--a-pri-soft, #e7ecef)"/>' : ''}
    <circle cx="84" cy="34" r="22" fill="var(--a-sec, #9b593f)" opacity=".9"/>
    <g>
      <rect x="62" y="40" width="40" height="80" fill="#e6dccb"/>
      <rect x="62" y="40" width="5" height="80" fill="#c9bba4"/>
      <rect x="97" y="40" width="5" height="80" fill="#c9bba4"/>
      ${janelas(70, 46, 4, 11, 6.6, 6.6, 4, 3.6, 'var(--a-pri, #4e6472)')}
    </g>
    <g>
      <rect x="16" y="20" width="48" height="100" fill="#f3ecdf"/>
      <rect x="16" y="20" width="6" height="100" fill="#d4c7b2"/>
      <rect x="58" y="20" width="6" height="100" fill="#d4c7b2"/>
      ${janelas(25.5, 27, 5, 14, 6.6, 6.6, 4.2, 3.8, 'var(--a-pri, #4e6472)')}
      ${janelas(18, 27, 1, 14, 0, 6.6, 2, 3.8, 'color-mix(in srgb, var(--a-pri, #4e6472) 55%, #fff)')}
      ${janelas(60, 27, 1, 14, 0, 6.6, 2, 3.8, 'color-mix(in srgb, var(--a-pri, #4e6472) 55%, #fff)')}
    </g>
    ${fundo ? '' : ''}`
  return (
    <svg className={`ape-sanlevi ${className}`} viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" style={fundo ? { borderRadius: size * 0.22, overflow: 'hidden' } : undefined}>
      <defs><clipPath id="sl-clip"><rect width="120" height="120" rx="26" /></clipPath></defs>
      <g clipPath={fundo ? 'url(#sl-clip)' : undefined} dangerouslySetInnerHTML={{ __html: svg }} />
    </svg>
  )
}

/** Ícone de traço (menus e botões): as duas torres com janelas. */
export function SanLeviIcone({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ape-i">
      <rect x="3.5" y="3" width="9" height="18" rx="1" />
      <path d="M12.5 8.5h7a1 1 0 0 1 1 1V21h-8" />
      <path d="M6.5 7h.01M9.5 7h.01M6.5 10.5h.01M9.5 10.5h.01M6.5 14h.01M9.5 14h.01M15.5 12h.01M17.8 12h.01M15.5 15.5h.01M17.8 15.5h.01" strokeWidth="2.2" />
      <path d="M7 21v-3h3v3" />
    </svg>
  )
}
