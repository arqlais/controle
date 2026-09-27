import { useEffect, useState } from 'react'

export interface Route {
  page: string
  id?: string
}

const parse = (hash: string): Route => {
  const [page = 'inicio', id] = hash.replace(/^#\/?/, '').split('/')
  return { page: page || 'inicio', id }
}

// A rota vive em memória e é espelhada no hash quando o ambiente permite
// (no visualizador de Artifacts o hash não é confiável).
const readHash = () => {
  try {
    return window.location.hash
  } catch {
    return ''
  }
}
let current: Route = parse(readHash())
const listeners = new Set<(r: Route) => void>()

// posição da rolagem de cada tela: voltar para uma lista cai no mesmo lugar
const keyOf = (r: Route) => href(r.page, r.id)
const scrolls: Record<string, number> = (() => {
  try {
    return JSON.parse(sessionStorage.getItem('rolagem') || '{}')
  } catch {
    return {}
  }
})()
const saveScroll = () => {
  scrolls[keyOf(current)] = window.scrollY
  try {
    sessionStorage.setItem('rolagem', JSON.stringify(scrolls))
  } catch {
    /* ok */
  }
}
const restoreScroll = (r: Route) => {
  const y = scrolls[keyOf(r)] ?? 0
  let tries = 0
  // espera a tela desenhar (listas longas) antes de rolar
  const step = () => {
    window.scrollTo(0, y)
    if (Math.abs(window.scrollY - y) > 2 && tries++ < 20) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
// caminho percorrido dentro do site (para a setinha de voltar)
const trail: Route[] = []
export const canGoBack = () => trail.length > 0

function set(r: Route, writeHash: boolean, fromBack = false) {
  if (keyOf(r) === keyOf(current)) return // mesma tela (ex.: popstate + hashchange juntos)
  saveScroll()
  if (!fromBack && keyOf(r) !== keyOf(current)) trail.push(current)
  if (trail.length > 50) trail.shift()
  current = r
  listeners.forEach((l) => l(r))
  restoreScroll(r)
  if (writeHash) {
    try {
      const h = href(r.page, r.id)
      if (window.location.hash !== h) history.pushState(null, '', h)
    } catch {
      /* sem acesso ao histórico: segue só em memória */
    }
  }
}

export const go = (page: string, id?: string) => set({ page, id }, true)
/** Setinha de voltar: volta para a tela anterior (ou para a lista, se abriu direto num item). */
// tela com alterações não salvas pode pedir confirmação antes de sair pela setinha
let leaveGuard: null | (() => Promise<boolean>) = null
export const setLeaveGuard = (fn: null | (() => Promise<boolean>)) => {
  leaveGuard = fn
}
export async function back() {
  if (leaveGuard && !(await leaveGuard())) return
  const prev = trail.pop()
  const to = prev ?? { page: current.page }
  set(to, false, true)
  try {
    const h = href(to.page, to.id)
    if (window.location.hash !== h) history.replaceState(null, '', h)
  } catch {
    /* ok */
  }
}
export const href = (page: string, id?: string) => `#/${page}${id ? `/${id}` : ''}`

// intercepta links internos (<a href="#/...">) para funcionar em qualquer ambiente
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
  const a = (e.target as HTMLElement).closest?.('a')
  const h = a?.getAttribute('href')
  if (!h || !h.startsWith('#/')) return
  e.preventDefault()
  const r = parse(h)
  go(r.page, r.id)
})
window.addEventListener('popstate', () => {
  const r = parse(readHash())
  // voltar do navegador: tira do caminho em vez de somar
  if (trail.length && keyOf(trail[trail.length - 1]) === keyOf(r)) {
    trail.pop()
    set(r, false, true)
  } else set(r, false)
})
window.addEventListener('hashchange', () => set(parse(readHash()), false))

export function useRoute() {
  const [route, setRoute] = useState<Route>(current)
  useEffect(() => {
    listeners.add(setRoute)
    return () => {
      listeners.delete(setRoute)
    }
  }, [])
  return route
}
