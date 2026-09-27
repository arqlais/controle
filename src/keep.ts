import { useEffect, useState } from 'react'

/* Lembra filtros, abas e posição de cada tela enquanto o site está aberto:
   abrir um item e voltar traz tudo exatamente como estava. */

const read = <T,>(key: string, initial: T): T => {
  try {
    const raw = sessionStorage.getItem(`tela:${key}`)
    return raw === null ? initial : (JSON.parse(raw) as T)
  } catch {
    return initial
  }
}

export function useKeep<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => read(key, typeof initial === 'function' ? (initial as () => T)() : initial))
  useEffect(() => {
    try {
      sessionStorage.setItem(`tela:${key}`, JSON.stringify(value))
    } catch {
      /* sem armazenamento: só não lembra */
    }
  }, [key, value])
  return [value, setValue] as const
}
