/* Ilustrações simples (SVG) para as opções com imagem dos briefings prontos.
   São só pontos de partida: cada pessoa troca por fotos dela no editor. */

const svg = (body: string, bg = '#f4efe9') => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="${bg}"/>${body}</svg>`)}`

/** Estilo: composição com as cores típicas (parede, piso, móvel e detalhe). */
export function styleArt(wall: string, floor: string, sofa: string, accent: string, round = false) {
  return svg(
    `<rect y="84" width="160" height="36" fill="${floor}"/>` +
      `<rect x="0" y="0" width="160" height="84" fill="${wall}"/>` +
      (round ? `<circle cx="118" cy="38" r="20" fill="${accent}" opacity=".85"/>` : `<rect x="100" y="18" width="36" height="42" fill="${accent}" opacity=".85"/>`) +
      `<rect x="22" y="58" width="78" height="30" rx="${round ? 12 : 3}" fill="${sofa}"/>` +
      `<rect x="16" y="66" width="12" height="22" rx="${round ? 6 : 2}" fill="${sofa}"/><rect x="94" y="66" width="12" height="22" rx="${round ? 6 : 2}" fill="${sofa}"/>` +
      `<rect x="118" y="70" width="4" height="18" fill="${sofa}"/><ellipse cx="120" cy="68" rx="12" ry="4" fill="${accent}"/>`,
  )
}

export const STYLE_ART: Record<string, string> = {
  aconchegante: styleArt('#efe2d3', '#c9a887', '#b98b6a', '#d9b48f', true),
  moderno: styleArt('#e9e9e6', '#8b8f93', '#3d4249', '#c46b4f'),
  minimalista: styleArt('#f7f6f2', '#e3ded6', '#dcd6cc', '#bfb8ad'),
  clássico: styleArt('#ece3d6', '#9c7a5c', '#6e5a4a', '#c9a96b', true),
  industrial: styleArt('#b9b4ad', '#5a5857', '#3a3633', '#b86a3c'),
  rústico: styleArt('#e3d2bb', '#8a6a4a', '#7a5a3c', '#a9844f'),
  contemporâneo: styleArt('#f0ece6', '#b7a898', '#6f7b72', '#d6a77a', true),
  escandinavo: styleArt('#f6f4f0', '#d9c7ae', '#c9ccc8', '#8fa3a6', true),
  boho: styleArt('#f1e4d2', '#c79b6b', '#d8b38a', '#b5643f', true),
}

/** Paleta de cores: faixas verticais. */
export const paletteArt = (...colors: string[]) => svg(colors.map((c, i) => `<rect x="${(160 / colors.length) * i}" y="0" width="${160 / colors.length + 1}" height="120" fill="${c}"/>`).join(''))

export const PALETTE_ART: Record<string, string> = {
  'tons neutros e claros': paletteArt('#f5f1ea', '#e4dccf', '#cfc4b3', '#b6a995'),
  'tons terrosos': paletteArt('#e7cdb1', '#c99a6c', '#a86d45', '#6f4a33'),
  'verdes e natureza': paletteArt('#e6ebdf', '#b9c7a8', '#7f9670', '#4f6446'),
  'azuis e frios': paletteArt('#e7eef3', '#b8cad8', '#7b9ab3', '#44617a'),
  'cores vibrantes': paletteArt('#f2c14e', '#e76f51', '#2a9d8f', '#8e5bb5'),
  'preto e branco': paletteArt('#ffffff', '#d9d9d9', '#6b6b6b', '#1f1f1f'),
  'rosados e delicados': paletteArt('#f7e6e3', '#ecc6bf', '#d69c93', '#b87168'),
}

/** Temperatura da luz: brilho no teto sobre a parede. */
const lightArt = (glow: string, wall: string) =>
  svg(
    `<defs><radialGradient id="g" cx="50%" cy="10%" r="75%"><stop offset="0" stop-color="${glow}"/><stop offset="1" stop-color="${wall}"/></radialGradient></defs><rect width="160" height="120" fill="url(#g)"/><rect x="74" y="0" width="12" height="10" fill="#555"/><circle cx="80" cy="14" r="6" fill="#fff" opacity=".9"/>`,
  )
export const LIGHT_ART: Record<string, string> = {
  'quente e aconchegante (2700K)': lightArt('#ffd9a0', '#b8865a'),
  'neutra (4000K)': lightArt('#fff6e6', '#a9a39a'),
  'fria e clara (6000K)': lightArt('#e8f2ff', '#8c9aac'),
  'uma mistura, depende do ambiente': lightArt('#ffe7c4', '#8f98a6'),
}

/** Cama vista de cima, no tamanho proporcional. */
const bedArt = (w: number, label: string) => {
  const s = 0.42 // px por cm
  const bw = w * s
  const bh = 200 * s * 0.5
  const x = (160 - bw) / 2
  return svg(
    `<rect x="${x}" y="18" width="${bw}" height="${bh * 1.6}" rx="4" fill="#fff" stroke="#b9a896" stroke-width="2"/>` +
      `<rect x="${x + 6}" y="24" width="${bw / (w > 120 ? 2 : 1) - 12}" height="16" rx="4" fill="#e9dfd3"/>` +
      (w > 120 ? `<rect x="${x + bw / 2 + 6}" y="24" width="${bw / 2 - 12}" height="16" rx="4" fill="#e9dfd3"/>` : '') +
      `<rect x="${x}" y="56" width="${bw}" height="${bh * 1.6 - 38}" rx="3" fill="#d8c7b4"/>` +
      `<text x="80" y="112" font-family="sans-serif" font-size="11" text-anchor="middle" fill="#6b5b4d">${label}</text>`,
  )
}
export const BED_ART: Record<string, string> = {
  'solteiro (88 × 188)': bedArt(88, '88 × 188 cm'),
  'viúva (128 × 188)': bedArt(128, '128 × 188 cm'),
  'casal (138 × 188)': bedArt(138, '138 × 188 cm'),
  'queen (158 × 198)': bedArt(158, '158 × 198 cm'),
  'king (193 × 203)': bedArt(193, '193 × 203 cm'),
}

/** Formato da cozinha (planta simples). */
const plan = (paths: string) => svg(`<rect x="16" y="12" width="128" height="96" fill="none" stroke="#b9a896" stroke-width="2"/>${paths}`, '#faf7f3')
const bench = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#cdb9a3"/>`
export const KITCHEN_ART: Record<string, string> = {
  linear: plan(bench(16, 12, 128, 18)),
  'em L': plan(bench(16, 12, 128, 18) + bench(16, 30, 18, 78)),
  'em U': plan(bench(16, 12, 128, 18) + bench(16, 30, 18, 78) + bench(126, 30, 18, 78)),
  'com ilha': plan(bench(16, 12, 128, 18) + bench(52, 62, 56, 22)),
  paralela: plan(bench(16, 12, 128, 18) + bench(16, 90, 128, 18)),
}

/** Tipo de closet (planta simples). */
export const CLOSET_ART: Record<string, string> = {
  linear: plan(bench(16, 12, 128, 16)),
  'em L': plan(bench(16, 12, 128, 16) + bench(16, 28, 16, 80)),
  'em U': plan(bench(16, 12, 128, 16) + bench(16, 28, 16, 80) + bench(128, 28, 16, 80)),
  'com ilha central': plan(bench(16, 12, 128, 16) + bench(16, 28, 16, 80) + bench(60, 56, 40, 24)),
}
