import { useEffect, useState } from 'react'
import type { Settings } from './types'
import { PLATFORM } from './plans'
import { DISPLAY_FONTS, EXCLUSIVE_FONT, OWN_BODY_FONT, OWN_FONT } from './brand'

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
    // botões, etiquetas e campos arredondam junto com a régua (no máximo ficam em pílula)
    '--pill': s.radius >= 18 ? '999px' : `${Math.round(s.radius * 1.4)}px`,
    '--font-display': `'${s.displayFont}', 'Cormorant Garamond', Georgia, serif`,
    '--font-body': `'${s.bodyFont}', 'Poppins', system-ui, -apple-system, sans-serif`,
    '--label-transform': s.uppercaseLabels ? 'uppercase' : 'lowercase',
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.dataset.appTheme = dark ? 'dark' : 'light'
  // cantos em 0: deixa tudo reto, não só os cartões
  root.dataset.square = s.radius <= 0 ? '1' : ''
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  // aba do navegador: a plataforma primeiro, depois o estúdio de quem usa
  const brand = s.brandName.replace(/\.$/, '').trim()
  document.title = brand && brand !== 'meu estúdio' ? `${PLATFORM.name} · ${brand}` : PLATFORM.name
  applyCustomFont(s)
}

/** Fonte enviada pela usuária (ex.: The Seasons), registrada com o nome escolhido em "fonte dos títulos". */
function applyCustomFont(s: Settings) {
  let el = document.getElementById('custom-font') as HTMLStyleElement | null
  if (!s.customFont && !s.customBodyFont) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('style')
    el.id = 'custom-font'
    document.head.appendChild(el)
  }
  // títulos: com o nome escolhido e também com os nomes fixos (assim trocar de fonte depois não "sequestra" outra fonte da lista)
  const face = (name: string, src: string) => `@font-face{font-family:'${name}';src:url(${src});font-display:swap;}`
  const title = s.customFont ? [...new Set([EXCLUSIVE_FONT, OWN_FONT, ...([EXCLUSIVE_FONT, OWN_FONT].includes(s.displayFont) ? [] : DISPLAY_FONTS.some((f) => f.name === s.displayFont) ? [] : [s.displayFont])])].map((n) => face(n, s.customFont)).join('') : ''
  const css = title + (s.customBodyFont ? face(OWN_BODY_FONT, s.customBodyFont) : '')
  if (el.textContent !== css) el.textContent = css
}
