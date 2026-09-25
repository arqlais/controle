import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ARTIFACT } from '../env'
import { Modal } from './ui'

/** Mostra uma folha A4 (794px) reduzida para caber na largura disponível. */
export function DocScale({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const [height, setHeight] = useState(560)
  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return
      const sc = outer.current.clientWidth / 794
      setScale(sc)
      setHeight(inner.current.offsetHeight * sc)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (outer.current) ro.observe(outer.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="doc-scale" ref={outer} style={{ height }}>
      <div className="doc-scale-inner" ref={inner} style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

/** Imprime um documento (recibo, proposta) — no navegador, "Salvar como PDF".
 *  Onde não dá para imprimir (visualizador de Artifacts), mostra a pré-visualização. */
export function usePrint() {
  const [doc, setDoc] = useState<ReactNode>(null)
  useEffect(() => {
    if (!doc || ARTIFACT) return
    const done = () => setDoc(null)
    window.addEventListener('afterprint', done)
    // espera as fontes carregarem para o PDF sair com a tipografia certa
    const t = setTimeout(() => document.fonts.ready.then(() => window.print()), 120)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [doc])
  if (!doc) return { print: setDoc, portal: null }
  const portal = ARTIFACT ? (
    <Modal wide title="pré-visualização" onClose={() => setDoc(null)}>
      <p className="muted small">Para baixar o PDF, abra o sistema publicado (arqlais.github.io/controle) — aqui o visualizador não permite imprimir.</p>
      <div className="doc-preview">
        <DocScale>{doc}</DocScale>
      </div>
    </Modal>
  ) : (
    createPortal(<div className="print-area">{doc}</div>, document.body)
  )
  return { print: setDoc, portal }
}
