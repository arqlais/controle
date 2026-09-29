import { useState } from 'react'

/* Avisos do próprio navegador (aparecem no canto do computador ou na tela do celular)
   quando o sistema está aberto numa aba de fundo. Com a aba na frente, o aviso fica só na tela. */

const supported = () => typeof window !== 'undefined' && 'Notification' in window

export function systemNotify(title: string, body: string, tag?: string) {
  if (!supported() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
  try {
    const n = new Notification(title, { body, tag, icon: 'icon-192.png' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* alguns celulares só deixam avisar pelo app instalado */
  }
}

/** Botão "ativar avisos": some depois que a pessoa responde. */
export function useNotifyAsk() {
  const [perm, setPerm] = useState(() => (supported() ? Notification.permission : 'denied'))
  const ask = async () => {
    if (!supported()) return
    try {
      setPerm(await Notification.requestPermission())
    } catch {
      /* navegador antigo */
    }
  }
  return { canAsk: perm === 'default', ask }
}
