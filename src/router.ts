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

function set(r: Route, writeHash: boolean) {
  current = r
  listeners.forEach((l) => l(r))
  window.scrollTo(0, 0)
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
window.addEventListener('popstate', () => set(parse(readHash()), false))
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
