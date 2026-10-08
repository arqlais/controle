/* Modo foto (só a dona): para tirar print do sistema e postar, os valores em R$ ficam desfocados
   e os clientes aparecem só com o primeiro nome + inicial ("Beatriz S."). Nada é salvo: é só na tela. */

const KEY = 'modo-foto'
const MONEY = /R\$\s?-?\d/
let observer: MutationObserver | null = null
let names: [RegExp, (m: string) => string][] = [] // nome completo (sem diferenciar maiúsculas) → só o primeiro nome + inicial
let secrets: string[] = [] // e-mail, telefone, CPF, endereço… dos clientes: o trecho fica desfocado
const masked = new Map<Text, { orig: string; shown: string }>()

const maskName = (full: string) => {
  const parts = full.trim().split(/\s+/)
  if (parts.length < 2) return full
  // "Juliana e Marcos Prado" → "Juliana e Marcos P."
  return [...parts.slice(0, -1), `${parts[parts.length - 1][0]}.`].join(' ')
}

function touch(node: Text) {
  const el = node.parentElement
  if (!el || el.closest('script, style, textarea, .no-photo-mask')) return
  let v = node.nodeValue ?? ''
  if (MONEY.test(v) || secrets.some((x) => v.includes(x))) el.setAttribute('data-pv-blur', '')
  const had = masked.get(node)
  if (had && v === had.shown) return
  const orig = v
  for (const [re, short] of names) v = v.replace(re, short)
  if (v !== orig) {
    masked.set(node, { orig, shown: v })
    node.nodeValue = v
  }
}
function scan(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return touch(root as Text)
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = w.nextNode())) touch(n as Text)
}

export const photoModeOn = () => {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Liga/desliga. `clientNames`: nomes completos dos clientes (o sobrenome vira inicial). */
export function setPhotoMode(on: boolean, clientNames: string[] = [], clientData: string[] = []) {
  try {
    if (on) sessionStorage.setItem(KEY, '1')
    else sessionStorage.removeItem(KEY)
  } catch {
    /* ok */
  }
  observer?.disconnect()
  observer = null
  if (!on) {
    document.body.classList.remove('modo-foto')
    for (const [node, m] of masked) if (node.nodeValue === m.shown) node.nodeValue = m.orig
    masked.clear()
    document.querySelectorAll('[data-pv-blur]').forEach((el) => el.removeAttribute('data-pv-blur'))
    return
  }
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  names = [...new Set(clientNames.map((n) => n.trim()).filter((n) => n.split(/\s+/).length > 1))]
    .sort((a, b) => b.length - a.length)
    .map((n) => [new RegExp(esc(n), 'gi'), (m: string) => maskName(m)])
  secrets = [...new Set(clientData.map((x) => x.trim()))]
  document.body.classList.add('modo-foto')
  scan(document.body)
  observer = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') touch(m.target as Text)
      else m.addedNodes.forEach(scan)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
}
