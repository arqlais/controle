import { StrictMode, Suspense, lazy, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useRoute } from '../router'
import '@fontsource/poppins/latin-300.css'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
// o mesmo desenho da página de vendas da planê.arq (botões, cartões, seções lp-*)
import '../styles.css'
import './frentes.css'

/* Entrada leve das páginas públicas (principal, planê.arquivos e planê.arq): não carrega o sistema.
   Se a pessoa vai para outra tela (entrar, vendas da gestão, planê.apê), a página recarrega pela entrada completa. */

const Hub = lazy(() => import('./Hub').then((m) => ({ default: m.Hub })))
const Vitrine = lazy(() => import('./Vitrine').then((m) => ({ default: m.Vitrine })))

// indicação de afiliada no link (?indica=codigo): guarda como o sistema faria (src/platform.ts, captureRef)
try {
  const code = new URLSearchParams(location.search).get('indica') || new URLSearchParams(location.hash.split('?')[1] ?? '').get('indica')
  if (code && /^[a-z0-9-]{3,20}$/i.test(code)) localStorage.setItem('plane-indicacao', JSON.stringify({ code: code.toLowerCase(), at: Date.now() }))
} catch {
  /* sem armazenamento */
}

const PUBLICAS = new Set(['plane', 'inicio', 'arquivos', 'arq'])

function Frentes() {
  const route = useRoute()
  const fora = !PUBLICAS.has(route.page)
  useEffect(() => {
    if (fora) location.reload()
  }, [fora])
  if (fora) return <div className="fr fr-loading-full" />
  return (
    <Suspense fallback={<div className="fr fr-loading-full" />}>
      {route.page === 'arquivos' || route.page === 'arq' ? <Vitrine id={route.page} sub={route.id} /> : <Hub />}
    </Suspense>
  )
}

export function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Frentes />
    </StrictMode>,
  )
}
