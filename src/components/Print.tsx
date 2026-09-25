import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Renderiza um documento (recibo, proposta) só para impressão / "Salvar como PDF". */
export function usePrint() {
  const [doc, setDoc] = useState<ReactNode>(null)
  useEffect(() => {
    if (!doc) return
    const done = () => setDoc(null)
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => window.print(), 80)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [doc])
  const portal = doc ? createPortal(<div className="print-area">{doc}</div>, document.body) : null
  return { print: setDoc, portal }
}
