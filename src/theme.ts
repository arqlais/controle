import type { Settings } from './types'

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const mix = (a: string, b: string, t: number) => {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}

/** Aplica a identidade visual (Configurações → Identidade visual) nas variáveis CSS. */
export function applyTheme(s: Settings) {
  const root = document.documentElement
  const dark = s.dark
  const bg = dark ? '#141414' : s.background
  const surface = dark ? '#1d1d1d' : s.surface
  const text = dark ? '#ece8e2' : s.text
  // no modo escuro, se o acento for muito escuro usamos o tom secundário
  const accent = dark && luminance(s.accent) < 0.08 ? s.accentSoft : s.accent
  const vars: Record<string, string> = {
    '--bg': bg,
    '--surface': surface,
    '--surface-2': mix(surface, text, dark ? 0.06 : 0.035),
    '--text': text,
    '--muted': mix(text, bg, 0.45),
    '--border': mix(bg, text, dark ? 0.16 : 0.12),
    '--accent': accent,
    '--accent-contrast': luminance(accent) > 0.45 ? '#141414' : '#ffffff',
    '--accent-soft': s.accentSoft,
    '--accent-tint': mix(surface, accent, 0.08),
    '--radius': `${s.radius}px`,
    '--font-display': `'${s.displayFont}', Georgia, serif`,
    '--font-body': `'${s.bodyFont}', system-ui, -apple-system, sans-serif`,
    '--label-transform': s.uppercaseLabels ? 'uppercase' : 'none',
    '--label-spacing': s.uppercaseLabels ? '0.08em' : '0',
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.dataset.appTheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  document.title = `Controle · ${s.brandName}`
}
