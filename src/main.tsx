import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from './components/Auth'
import { DialogHost } from './components/dialog'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
    <DialogHost />
  </StrictMode>,
)
