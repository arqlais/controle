import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ARTIFACT } from '../env'
import { Modal } from './ui'

/** Renderiza um documento (recibo, proposta) para impressão / "Salvar como PDF".
 *  Onde não dá para imprimir (visualizador de Artifacts), mostra uma pré-visualização. */
export function usePrint() {
  const [doc, setDoc] = useState<ReactNode>(null)
  useEffect(() => {
    if (!doc || ARTIFACT) return
    const done = () => setDoc(null)
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => window.print(), 80)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [doc])
  if (!doc) return { print: setDoc, portal: null }
  const portal = ARTIFACT ? (
    <Modal wide title="Pré-visualização" onClose={() => setDoc(null)}>
      <p className="muted small">Para salvar em PDF, abra o sistema publicado no seu site ou rode no computador — aqui o visualizador não permite imprimir.</p>
      <div className="doc-preview">{doc}</div>
    </Modal>
  ) : (
    createPortal(<div className="print-area">{doc}</div>, document.body)
  )
  return { print: setDoc, portal }
}
