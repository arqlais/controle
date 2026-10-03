import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { ARTIFACT } from '../env'

/* Versão nova publicada com o sistema aberto (aba ou app na tela de início): confere de vez em quando
   e, quando muda, oferece atualizar. Ao atualizar, as novidades aparecem sozinhas (uma vez). */

const scriptOf = (html: string) => html.match(/assets\/index-[\w-]+\.js/)?.[0] ?? ''
const current = () => scriptOf(document.documentElement.innerHTML) || [...document.scripts].map((s) => s.src.match(/assets\/index-[\w-]+\.js/)?.[0]).find(Boolean) || ''

export function UpdateBanner() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (ARTIFACT || import.meta.env.DEV) return
    const mine = current()
    if (!mine) return
    let last = 0
    const check = async () => {
      if (Date.now() - last < 5 * 60_000) return
      last = Date.now()
      try {
        const r = await fetch(`${location.pathname}?v=${Date.now()}`, { cache: 'no-store' })
        const next = scriptOf(await r.text())
        if (next && next !== mine) setReady(true)
      } catch {
        /* sem internet: tenta depois */
      }
    }
    const onVis = () => document.visibilityState === 'visible' && void check()
    document.addEventListener('visibilitychange', onVis)
    const iv = setInterval(() => void check(), 30 * 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(iv)
    }
  }, [])
  if (!ready) return null
  return (
    <div className="upd-banner" role="status">
      <Icon name="sparkle" size={16} />
      <span>Tem uma versão nova do planê, com novidades.</span>
      <button className="btn small primary" onClick={() => location.reload()}>
        atualizar
      </button>
      <button className="icon-btn subtle" aria-label="Agora não" onClick={() => setReady(false)}>
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
