import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from './components/Auth'
import { DialogHost } from './components/dialog'
import { FileReadyHost } from './components/saveFile'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { captureRef, platform } from './platform'
import { setTabBrand } from './theme'
captureRef()
// nome e ícone da aba escolhidos pela dona
void platform.tabBrand().then(setTabBrand).catch(() => undefined)
// fontes embutidas (mesma origem): garantem a tipografia certa no app e no PDF
import '@fontsource/poppins/latin-300.css'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource/cormorant-garamond/latin-500-italic.css'
import './styles.css'
import './platform.css'

// versão nova publicada com o sistema aberto: um arquivo antigo some; recarrega uma vez para pegar a nova
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('recarregou-versao') || 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem('recarregou-versao', String(Date.now()))
  } catch {
    /* segue */
  }
  e.preventDefault()
  location.reload()
})

export const renderApp = () =>
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary full>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
    <DialogHost />
    <FileReadyHost />
  </StrictMode>,
)
