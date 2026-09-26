import { useEffect, useState } from 'react'
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

/* Modo claro/escuro é escolha de cada aparelho (não vai para a nuvem):
   o notebook pode ficar escuro e o celular claro, ou o contrário. */
const THEME_KEY = 'controle-tema-escuro'
const themeListeners = new Set<(dark: boolean) => void>()
export function getDeviceDark(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) === '1'
  } catch {
    return false
  }
}
export function setDeviceDark(dark: boolean) {
  try {
    localStorage.setItem(THEME_KEY, dark ? '1' : '0')
  } catch {
    /* sem armazenamento: vale só enquanto a página estiver aberta */
  }
  themeListeners.forEach((l) => l(dark))
}
export function useDeviceDark(): [boolean, (dark: boolean) => void] {
  const [dark, setDark] = useState(getDeviceDark)
  useEffect(() => {
    themeListeners.add(setDark)
    return () => void themeListeners.delete(setDark)
  }, [])
  return [dark, setDeviceDark]
}

/** Aplica a identidade visual (Configurações → Identidade visual) nas variáveis CSS. */
export function applyTheme(s: Settings, dark = false) {
  const root = document.documentElement
  // modo escuro: grafite profundo, mantendo o rosé como acento
  const bg = dark ? '#1f262d' : s.background
  const surface = dark ? '#28313a' : s.surface
  const text = dark ? '#efe7e3' : s.text
  const accent = dark ? s.accentSoft : s.accent
  const ink = dark ? mix(s.accentSoft, '#ffffff', 0.15) : s.accentInk
  const vars: Record<string, string> = {
    '--bg': bg,
    '--surface': surface,
    '--surface-2': mix(bg, s.accentSoft, dark ? 0.08 : 0.16),
    '--text': text,
    '--muted': mix(text, bg, 0.42),
    '--border': mix(bg, s.accentSoft, dark ? 0.22 : 0.3),
    '--accent': accent,
    '--accent-contrast': luminance(accent) > 0.45 ? '#2b343c' : '#ffffff',
    '--accent-soft': s.accentSoft,
    '--accent-ink': ink,
    '--accent-tint': mix(surface, s.accentSoft, dark ? 0.18 : 0.26),
    '--slate': dark ? '#141a20' : s.text,
    '--radius': `${s.radius}px`,
    '--font-display': `'${s.displayFont}', 'Cormorant Garamond', Georgia, serif`,
    '--font-body': `'${s.bodyFont}', 'Poppins', system-ui, -apple-system, sans-serif`,
    '--label-transform': s.uppercaseLabels ? 'uppercase' : 'lowercase',
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.dataset.appTheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  document.title = `${s.brandName} · gestão`
  applyCustomFont(s)
}

/** Fonte enviada pela usuária (ex.: The Seasons), registrada com o nome escolhido em "fonte dos títulos". */
function applyCustomFont(s: Settings) {
  let el = document.getElementById('custom-font') as HTMLStyleElement | null
  if (!s.customFont) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('style')
    el.id = 'custom-font'
    document.head.appendChild(el)
  }
  const css = `@font-face{font-family:'${s.displayFont}';src:url(${s.customFont});font-display:swap;}`
  if (el.textContent !== css) el.textContent = css
}
