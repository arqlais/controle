/* Ilustrações prontas para a escolha por imagem do briefing. São desenhadas aqui (SVG),
   não pesam no link e ficam bonitas em qualquer tela. A pessoa pode trocar por fotos dela.
   "art:#2e4a63"              → amostra de cor
   "art:pal:#a,#b,#c,#d"      → paleta de um estilo (blocos e arco)
   "art:bed:88x188"           → planta da cama em escala, com a medida */

export const isArt = (src: string) => src.startsWith('art:')

/** Cores de uma ilustração de cor/paleta (para o profissional ajustar); null quando não é cor. */
export function artColors(src?: string): string[] | null {
  if (!src?.startsWith('art:')) return null
  const body = src.slice(4)
  if (body.startsWith('#')) return [body]
  if (body.startsWith('pal:')) return body.slice(4).split(',')
  return null
}
export const artFromColors = (colors: string[]) => (colors.length === 1 ? `art:${colors[0]}` : `art:pal:${colors.join(',')}`)

/** Quantas fotos por linha para nunca sobrar uma sozinha num canto (a última linha fica centralizada). */
export function balancedCols(n: number) {
  if (n <= 4) return Math.max(2, n)
  if (n === 5 || n === 6 || n === 9) return 3
  return 4
}

export function ArtImage({ src, alt = '' }: { src: string; alt?: string }) {
  if (!isArt(src)) return <img src={src} alt={alt} loading="lazy" />
  const [kind, ...rest] = src.slice(4).split(':')
  const value = rest.join(':')
  if (kind.startsWith('#')) return <Swatch color={kind} />
  if (kind === 'pal') return <Palette colors={value.split(',')} />
  if (kind === 'bed') return <Bed size={value} />
  return <span className="art-empty" />
}

function Swatch({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 100" className="art" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="100" height="100" fill={color} />
      <rect x="0" y="74" width="100" height="26" fill="#000" opacity=".06" />
    </svg>
  )
}

/** Composição de estilo: parede, arco, piso e um objeto — cada estilo com a sua paleta. */
function Palette({ colors }: { colors: string[] }) {
  const [wall = '#e8e0d6', arch = '#c9b8a6', floor = '#8c7560', accent = '#3a332d'] = colors
  return (
    <svg viewBox="0 0 120 100" className="art" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="120" height="100" fill={wall} />
      <path d="M22 78 V40 a22 22 0 0 1 44 0 V78 Z" fill={arch} />
      <rect y="78" width="120" height="22" fill={floor} />
      <rect x="74" y="52" width="30" height="26" rx="3" fill={accent} />
      <rect x="78" y="44" width="22" height="10" rx="5" fill={arch} opacity=".9" />
      <circle cx="96" cy="22" r="7" fill={accent} opacity=".85" />
      <line x1="96" y1="0" x2="96" y2="15" stroke={accent} strokeWidth="1.2" />
    </svg>
  )
}

/** Cama vista de cima, na proporção real, com a medida embaixo. */
function Bed({ size }: { size: string }) {
  const [w, l] = size.split('x').map(Number)
  const k = 70 / 200 // 2 m = 70 unidades
  const bw = Math.max(18, w * k)
  const bl = Math.max(18, l * k)
  const x = (120 - bw) / 2
  const y = 8
  return (
    <svg viewBox="0 0 120 100" className="art" style={{ background: '#f4efe9' }} aria-hidden>
      <rect width="120" height="100" fill="#f4efe9" />
      <rect x={x} y={y} width={bw} height={bl} rx="3" fill="#fff" stroke="#b9a99a" strokeWidth="1.2" />
      <rect x={x + 3} y={y + 3} width={bw - 6} height={Math.min(10, bl / 5)} rx="2" fill="#e6dccf" />
      <rect x={x} y={y + bl * 0.42} width={bw} height={bl * 0.58} rx="2" fill="#d8c6b3" opacity=".7" />
      <text x="60" y="95" textAnchor="middle" fontSize="8" fill="#6d5c4f" fontFamily="system-ui, sans-serif">
        {w} × {l} cm
      </text>
    </svg>
  )
}

/** Paletas prontas dos estilos mais pedidos (parede, arco, piso, destaque). */
export const STYLE_ART: Record<string, string> = {
  contemporâneo: 'art:pal:#ece8e3,#cfc6bb,#8f8579,#2f2f31',
  clássico: 'art:pal:#f1e9dc,#d9c7a8,#9c7b57,#5a3e2b',
  minimalista: 'art:pal:#f5f4f1,#e3e1dc,#bdb8af,#1f1f1f',
  industrial: 'art:pal:#b9b6b1,#8a8580,#4c4a48,#a2522c',
  boho: 'art:pal:#efe2d0,#d6a77a,#a8683f,#5b6b3c',
  rústico: 'art:pal:#e9dccb,#b48a61,#6f4b30,#3c3a2e',
  japandi: 'art:pal:#ede7dd,#d3c3ad,#a58b6b,#2b2b28',
  moderno: 'art:pal:#eeeeec,#c4c9cc,#6f777c,#1c2a33',
  aconchegante: 'art:pal:#f1e4d6,#dcb99a,#9d7356,#6b4a3a',
  escandinavo: 'art:pal:#f6f5f2,#dcd6cb,#c2a57f,#3a3f44',
  tropical: 'art:pal:#eef0e6,#9fb58f,#6e8a5a,#c86f4a',
  americano: 'art:pal:#f3efe8,#c9d3da,#8b6e55,#243746',
}
export const styleOptions = (names: string[]) => Object.fromEntries(names.filter((n) => STYLE_ART[n.toLowerCase()]).map((n) => [n, STYLE_ART[n.toLowerCase()]]))
