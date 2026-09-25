import { useEffect, useState } from 'react'

export interface Route {
  page: string
  id?: string
}

const parse = (): Route => {
  const [page = 'inicio', id] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { page: page || 'inicio', id }
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (page: string, id?: string) => {
  window.location.hash = `/${page}${id ? `/${id}` : ''}`
}

export const href = (page: string, id?: string) => `#/${page}${id ? `/${id}` : ''}`
