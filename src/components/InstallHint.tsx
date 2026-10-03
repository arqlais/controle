import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { PLATFORM } from '../plans'

/* "Adicionar à tela de início": o planê vira um ícone no celular, com o nome da plataforma, e abre em tela cheia.
   No Android/Chrome aparece o botão instalar; no iPhone, o passo a passo do Safari. */

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: PromptEvent | null = null
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as PromptEvent
  })

const KEY = 'dica-tela-inicio'
const standalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
const isMobile = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 820px)').matches

export function InstallHint({ always }: { always?: boolean }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return !always && localStorage.getItem(KEY) === 'ok'
    } catch {
      return false
    }
  })
  const [canPrompt, setCanPrompt] = useState(!!deferred)
  const [steps, setSteps] = useState(false)
  useEffect(() => {
    const on = () => setCanPrompt(true)
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  if (hidden || standalone() || (!always && !isMobile())) return null
  const close = () => {
    try {
      localStorage.setItem(KEY, 'ok')
    } catch {
      /* ok */
    }
    setHidden(true)
  }
  const install = async () => {
    if (deferred) {
      await deferred.prompt()
      deferred = null
      setCanPrompt(false)
      close()
    } else setSteps(true)
  }
  return (
    <div className="install-hint" role="note">
      <span className="install-icon">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
      </span>
      <div className="grow">
        <b>{PLATFORM.name} na tela de início</b>
        {steps || (isIOS() && !canPrompt) ? (
          <p className="small">
            {isIOS() ? (
              <>
                No Safari, toque em <Icon name="upload" size={13} /> <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. O ícone aparece com o nome “{PLATFORM.name}”.
              </>
            ) : (
              <>
                No menu do navegador (<b>⋮</b>), toque em <b>Adicionar à tela inicial</b> ou <b>Instalar app</b>.
              </>
            )}
          </p>
        ) : (
          <p className="small">Abre como um aplicativo, em tela cheia, direto do ícone.</p>
        )}
      </div>
      {!isIOS() && !steps && (
        <button className="btn small primary" onClick={() => void install()}>
          adicionar
        </button>
      )}
      {!always && (
        <button className="icon-btn subtle" onClick={close} aria-label="Fechar">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  )
}
