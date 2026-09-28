/* "Ver como cliente": a dona abre o sistema como uma conta nova de cliente (teste grátis),
   só na memória deste aparelho. Nada é salvo e nada é enviado (pedidos, chat, depoimentos). */

const KEY = 'ver-como-cliente'
const listeners = new Set<(on: boolean) => void>()

export function viewingAsClient() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setViewAsClient(on: boolean) {
  try {
    if (on) sessionStorage.setItem(KEY, '1')
    else sessionStorage.removeItem(KEY)
  } catch {
    /* ok */
  }
  listeners.forEach((f) => f(on))
}

export function onViewAsClient(f: (on: boolean) => void) {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}
