import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ARTIFACT } from '../env'
import { Modal } from './ui'
import { toast } from './dialog'

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

/** Gera e baixa o PDF direto (sem a janela de impressão).
 *  A folha é desenhada fora da tela, convertida em imagem de alta resolução
 *  e colocada em páginas A4. */
export function usePdf() {
  const [job, setJob] = useState<{ doc: ReactNode; filename: string } | null>(null)
  const [preview, setPreview] = useState<ReactNode>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!job) return
    let cancelled = false
    ;(async () => {
      try {
        await document.fonts.ready
        await new Promise((r) => setTimeout(r, 150))
        const el = ref.current?.firstElementChild as HTMLElement | null
        if (!el || cancelled) return
        const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
        const canvas = await toCanvas(el, { pixelRatio: 2.5, cacheBust: true, backgroundColor: '#ffffff' })
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
        const pageW = 210
        const pageH = 297
        const pxPerPage = (canvas.width * pageH) / pageW
        const pages = Math.max(1, Math.ceil(canvas.height / pxPerPage - 0.02))
        for (let i = 0; i < pages; i++) {
          const slice = document.createElement('canvas')
          slice.width = canvas.width
          slice.height = Math.min(pxPerPage, canvas.height - i * pxPerPage)
          slice.getContext('2d')!.drawImage(canvas, 0, -i * pxPerPage)
          if (i) pdf.addPage()
          pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (slice.height * pageW) / canvas.width)
        }
        pdf.save(job.filename)
        toast('PDF baixado.')
      } catch {
        toast('Não foi possível gerar o PDF. Tente de novo.')
      } finally {
        if (!cancelled) setJob(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job])

  const download = (doc: ReactNode, filename: string) => {
    if (ARTIFACT) return setPreview(doc) // o visualizador do Claude bloqueia downloads
    toast('Gerando PDF…')
    setJob({ doc, filename: filename.replace(/[\\/:*?"<>|]+/g, '-') })
  }

  const portal = (
    <>
      {job &&
        createPortal(
          <div ref={ref} className="pdf-stage" aria-hidden>
            {job.doc}
          </div>,
          document.body,
        )}
      {preview && (
        <Modal wide title="pré-visualização" onClose={() => setPreview(null)}>
          <p className="muted small">Para baixar o PDF, use o sistema publicado (arqlais.github.io/controle) — aqui o visualizador do Claude não permite downloads.</p>
          <div className="doc-preview">
            <DocScale>{preview}</DocScale>
          </div>
        </Modal>
      )}
    </>
  )
  return { download, busy: !!job, portal }
}
