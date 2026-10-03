import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Modal } from './ui'
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
  const [guide, setGuide] = useState(false)
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
      <button className="btn small ghost" onClick={() => setGuide(true)}>
        como fazer
      </button>
      {guide && <InstallGuide onClose={() => setGuide(false)} />}
      {!always && (
        <button className="icon-btn subtle" onClick={close} aria-label="Fechar">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  )
}

/** Passo a passo para pôr o planê na tela de início (iPhone e Android). Abre como app, em tela cheia, sem barra do navegador. */
export function InstallGuide({ onClose }: { onClose: () => void }) {
  const [os, setOs] = useState<'iphone' | 'android'>(() => (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) ? 'android' : 'iphone'))
  const [canPrompt, setCanPrompt] = useState(!!deferred)
  useEffect(() => {
    const on = () => setCanPrompt(true)
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  const steps =
    os === 'iphone'
      ? [
          { icon: 'smartphone', title: 'abra no Safari', text: 'No iPhone, o atalho só funciona pelo Safari (no Chrome do iPhone também dá, pelo mesmo botão de compartilhar).' },
          { icon: 'upload', title: 'toque em Compartilhar', text: 'É o quadrado com a seta para cima, na barra de baixo (ou no topo, no iPad).' },
          { icon: 'plus', title: '“Adicionar à Tela de Início”', text: 'Role a lista para baixo até achar. Confirme o nome “planê” e toque em Adicionar.' },
          { icon: 'check', title: 'pronto', text: 'O ícone do planê aparece junto dos seus apps. Ele abre em tela cheia, sem a barra do navegador.' },
        ]
      : [
          { icon: 'smartphone', title: 'abra no Chrome', text: 'Entre no planê pelo Chrome (ou pelo navegador da Samsung).' },
          { icon: 'menu', title: 'toque nos ⋮ três pontinhos', text: 'Fica no canto de cima, à direita.' },
          { icon: 'plus', title: '“Instalar app” ou “Adicionar à tela inicial”', text: 'Confirme em Instalar. Em alguns celulares aparece um aviso embaixo da tela: é só tocar nele.' },
          { icon: 'check', title: 'pronto', text: 'O ícone do planê aparece na tela inicial e na lista de apps, e abre em tela cheia.' },
        ]
  return (
    <Modal title={`${PLATFORM.name} como aplicativo`} onClose={onClose}>
      <div className="ig">
        <p className="muted small">Sem baixar nada da loja: o planê vira um ícone no celular e abre em tela cheia, como um app. Seus dados continuam os mesmos.</p>
        <div className="segmented ig-os">
          <button type="button" className={os === 'iphone' ? 'active' : ''} onClick={() => setOs('iphone')}>
            iPhone
          </button>
          <button type="button" className={os === 'android' ? 'active' : ''} onClick={() => setOs('android')}>
            Android
          </button>
        </div>
        <ol className="ig-steps">
          {steps.map((x, i) => (
            <li key={i}>
              <span className="ig-n">
                <Icon name={x.icon} size={16} />
              </span>
              <span>
                <b>
                  {i + 1}. {x.title}
                </b>
                <small>{x.text}</small>
              </span>
            </li>
          ))}
        </ol>
        {os === 'android' && canPrompt && (
          <button
            className="btn primary"
            onClick={async () => {
              await deferred?.prompt()
              deferred = null
              setCanPrompt(false)
            }}
          >
            <Icon name="download" size={15} /> instalar agora
          </button>
        )}
        {standalone() && <p className="pf-note small">Você já está usando o planê como aplicativo.</p>}
      </div>
    </Modal>
  )
}
