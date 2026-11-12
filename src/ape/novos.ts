import { useEffect, useState } from 'react'
import { novosEnvios } from './api'

/** Quantos orçamentos de moradores chegaram e a dona ainda não viu (aviso no menu "planê.apê"). */
export function useApeNovos(enabled: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let live = true
    const load = () => void novosEnvios().then((x) => live && setN(x), () => undefined)
    load()
    const t = window.setInterval(load, 3 * 60_000)
    const onFocus = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('ape-envios-mudou', load)
    return () => {
      live = false
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('ape-envios-mudou', load)
    }
  }, [enabled])
  return n
}
