import { useEffect, useState } from 'react'
import type { Settings } from './types'
import { PLATFORM } from './plans'
import type { TabBrand } from './platform'
import { DEFAULT_MARKS, markIconUrl, setBrandMarks } from './components/PlaneMark'
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

/* aba do navegador: "Planê · Nome Do Estúdio" (iniciais maiúsculas só aqui; no sistema o nome fica como foi escrito) */
let lastBrand = ''
const capWords = (t: string) => t.replace(/(^|\s)(\p{L})/gu, (_m, sp: string, l: string) => sp + l.toUpperCase())
export function refreshTitle() {
  const brand = lastBrand.replace(/\.$/, '').trim()
  document.title = brand && brand !== 'meu estúdio' ? `${PLATFORM.title} · ${capWords(brand)}` : `${PLATFORM.title} · ${PLATFORM.slogan}`
}
/** Nome, frase e ícone da aba definidos pela dona no painel. */
export function setTabBrand(t: TabBrand | null) {
  if (!t) return
  if (t.title.trim()) PLATFORM.title = t.title.trim()
  // frase antiga salva no painel passa para a nova (escritório)
  if (t.slogan.trim() && t.slogan.trim() !== 'Seu estúdio em ordem') PLATFORM.slogan = t.slogan.trim()
  setBrandMarks(t.marks)
  // ícone da aba: imagem antiga do painel ou o logotipo escolhido para a aba
  const img = t.marks?.icone?.image || t.icon
  const icon = img || (t.marks?.icone ? markIconUrl({ ...DEFAULT_MARKS.icone, ...t.marks.icone }) : '')
  // o iPhone não aceita SVG no atalho: só troca quando for imagem
  if (icon) document.querySelectorAll<HTMLLinkElement>(img ? 'link[rel="icon"], link[rel="apple-touch-icon"]' : 'link[rel="icon"]').forEach((l) => ((l.href = icon), l.removeAttribute('type')))
  refreshTitle()
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
    // menu lateral: o próprio fundo com um toque da cor de destaque, só para separar do conteúdo
    '--sidebar-bg': dark ? mix(bg, '#000000', 0.12) : mix(bg, s.accentSoft, 0.08),
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
  // cores finas (só a dona): sobrepõem as calculadas, no tema claro
  const UI_VARS: Record<string, string[]> = { sidebar: ['--sidebar-bg'], sidebarText: ['--sidebar-text'], active: ['--nav-active-bg'], activeText: ['--nav-active-text'], page: ['--bg'], card: ['--surface'], text: ['--text', '--slate'], button: ['--accent'], detail: ['--accent-ink'], border: ['--border'] }
  for (const v of Object.values(UI_VARS).flat()) root.style.removeProperty(v)
  if (!dark && s.uiColors) for (const [k, hex] of Object.entries(s.uiColors)) if (hex && UI_VARS[k]) for (const v of UI_VARS[k]) vars[v] = hex
  if (!dark && s.uiColors?.button) vars['--accent-contrast'] = luminance(s.uiColors.button) > 0.45 ? '#2b343c' : '#ffffff'
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.dataset.appTheme = dark ? 'dark' : 'light'
  // cantos em 0: deixa tudo reto, não só os cartões
  root.dataset.square = s.radius <= 0 ? '1' : ''
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  lastBrand = s.brandName
  refreshTitle()
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
