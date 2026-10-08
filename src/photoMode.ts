/* Modo foto (só a dona): para tirar print do sistema e postar, os valores em R$ ficam desfocados
   e os clientes aparecem só com o primeiro nome + inicial ("Beatriz S."). Nada é salvo: é só na tela. */

const KEY = 'modo-foto'
const MONEY = /R\$\s?-?\d/
let observer: MutationObserver | null = null
let names: [string, string][] = [] // [nome completo, nome mascarado]
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
  if (MONEY.test(v)) el.setAttribute('data-pv-blur', '')
  const had = masked.get(node)
  if (had && v === had.shown) return
  const orig = v
  for (const [full, short] of names) if (v.includes(full)) v = v.split(full).join(short)
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
export function setPhotoMode(on: boolean, clientNames: string[] = []) {
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
  names = [...new Set(clientNames.map((n) => n.trim()).filter((n) => n.split(/\s+/).length > 1))]
    .sort((a, b) => b.length - a.length)
    .map((n) => [n, maskName(n)])
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
