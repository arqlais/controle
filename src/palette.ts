import { rdlMode } from './rdl'

/* Paleta da planê: azul (grafite) e rosa, com os tons de cada um. Toda cor da interface sai daqui
   (status, etiquetas, gráficos). As cores dos documentos de cada profissional ficam nas configurações dela. */
export const PAL = {
  // azuis
  navy: '#2f3a45',
  slate: '#3e4b57', // principal
  blue: '#566779',
  steel: '#7d8c99',
  mist: '#9aa3ab',
  // rosas
  roseDeep: '#8f6d64',
  roseDark: '#a07a70',
  rose: '#a88a80', // principal
  roseMid: '#c29b92',
  roseSoft: '#d6b3ab',
  // apoio
  sand: '#b8aca6',
  // sentidos (dentro da paleta)
  good: '#4f6475', // feito, pago, aprovado
  warn: '#b08a7e', // aguardando, enviado
  bad: '#9a5b53', // urgente, cancelado, atrasado
} as const

/* Tons complementares: entram só quando precisa de mais cores diferentes (muitas colunas, gráficos,
   avatares). São apagados, na mesma luz e saturação baixa do azul e do rosa, para conversar com eles. */
export const EXTRA = {
  sand: '#c9b8aa', // areia
  clay: '#b98a78', // terracota suave
  lilac: '#9d93a6', // lilás acinzentado
  sage: '#8e9b93', // verde acinzentado
  dusk: '#6f7f95', // azul entardecer
} as const

/** Cor da planê → cor equivalente da RDL (azul-marinho, laranja, cinzas azulados). */
export const RDL_COR: Record<string, string> = {
  '#2f3a45': '#011e42', '#3e4b57': '#012c60', '#4f6475': '#012c60', '#566779': '#2c4f80', '#7d8c99': '#6b7f9c', '#9aa3ab': '#a3b1c4',
  '#8f6d64': '#b85600', '#a07a70': '#d4650a', '#a88a80': '#e8710a', '#b08a7e': '#e8710a', '#c29b92': '#ff8216', '#d6b3ab': '#ffb26b',
  '#9a5b53': '#b85600', '#b8aca6': '#c3cfe0', '#c9b8aa': '#c3cfe0', '#b98a78': '#f0a060', '#9d93a6': '#8494ad', '#8e9b93': '#5d7391', '#6f7f95': '#3d5f8f',
}
/** No sistema da RDL, troca a cor pela equivalente da RDL (fora dela, devolve a mesma). */
export const corRdl = (hex: string) => (rdlMode() ? RDL_COR[hex.toLowerCase()] ?? hex : hex)

/* Sistema da RDL: os mesmos nomes, com as cores da RDL (azul-marinho, laranja e cinzas azulados). */
if (rdlMode()) {
  Object.assign(PAL as Record<string, string>, {
    navy: '#011e42', slate: '#012c60', blue: '#2c4f80', steel: '#6b7f9c', mist: '#a3b1c4',
    roseDeep: '#b85600', roseDark: '#d4650a', rose: '#e8710a', roseMid: '#ff8216', roseSoft: '#ffb26b',
    sand: '#c3cfe0', good: '#012c60', warn: '#e8710a', bad: '#b85600',
  })
  Object.assign(EXTRA as Record<string, string>, { sand: '#c3cfe0', clay: '#f0a060', lilac: '#8494ad', sage: '#5d7391', dusk: '#3d5f8f' })
}

/** Ordem para quando cada item precisa de uma cor (alterna azul e rosa; depois os complementares). */
export const SERIES = [PAL.slate, PAL.rose, PAL.blue, PAL.roseMid, PAL.steel, PAL.roseDeep, PAL.mist, PAL.roseSoft, EXTRA.sand, EXTRA.dusk, EXTRA.clay, EXTRA.lilac, EXTRA.sage] as const

/** Deixa qualquer cor mais perto da paleta: tira o excesso de saturação e evita claro ou escuro demais. */
export function harmonize(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l0 = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l0 > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h /= 6
  }
  s = Math.min(s, 0.28) // apagado como o azul e o rosa da paleta
  const l = Math.min(0.72, Math.max(0.24, l0))
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    t = (t + 1) % 1
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p
  }
  ;[r, g, b] = [f(h + 1 / 3), f(h), f(h - 1 / 3)]
  return `#${[r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`
}
