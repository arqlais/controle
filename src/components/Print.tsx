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
// imagem que falhar vira um pixel transparente (não derruba a geração)
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/** Desenha a folha em imagem; se algo falhar (fonte ou imagem de fora), tenta de novo de jeitos mais simples. */
export async function renderSheet<T>(el: HTMLElement, fn: (el: HTMLElement, o: Record<string, unknown>) => Promise<T>, base: Record<string, unknown>): Promise<T> {
  const tries: Record<string, unknown>[] = [
    { cacheBust: true, imagePlaceholder: BLANK },
    { cacheBust: false, imagePlaceholder: BLANK },
    { cacheBust: false, imagePlaceholder: BLANK, skipFonts: true },
  ]
  let last: unknown
  for (const t of tries) {
    try {
      return await fn(el, { ...base, ...t })
    } catch (e) {
      last = e
      console.error('PDF: nova tentativa', e)
    }
  }
  throw last
}

export const errText = (e: unknown) => (e instanceof Event ? 'uma imagem não carregou' : e instanceof Error ? e.message : String(e)).slice(0, 80)

export function usePdf() {
  const [job, setJob] = useState<{ doc: ReactNode; filename: string; png?: boolean } | null>(null)
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
        if (job.png) {
          // imagem para mandar no WhatsApp
          const { toPng } = await import('html-to-image')
          const url = await renderSheet(el, toPng, { pixelRatio: 2, backgroundColor: '#ffffff' })
          const link = document.createElement('a')
          link.href = url
          link.download = job.filename
          link.click()
          toast('Imagem baixada.')
          return
        }
        const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
        const canvas = await renderSheet(el, toCanvas, { pixelRatio: 2.5, backgroundColor: '#ffffff' })
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
      } catch (err) {
        console.error('PDF', err)
        toast(`Não foi possível gerar o ${job.png ? 'arquivo' : 'PDF'} (${errText(err)}). Tente de novo ou me mande um print desta mensagem.`)
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
  const downloadPng = (doc: ReactNode, filename: string) => {
    if (ARTIFACT) return setPreview(doc)
    toast('Gerando imagem…')
    setJob({ doc, filename: filename.replace(/[\\/:*?"<>|]+/g, '-'), png: true })
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
  return { download, downloadPng, busy: !!job, portal }
}

/** Prévia do documento em tamanho grande, por cima da tela (fecha no X, no Esc ou clicando fora). */
export function DocZoom({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', key)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return createPortal(
    <div className="doc-zoom" onClick={onClose} role="dialog" aria-label="Prévia do PDF">
      <button className="doc-zoom-close" onClick={onClose} aria-label="Fechar">
        ✕
      </button>
      <div className="doc-zoom-sheet" onClick={(e) => e.stopPropagation()}>
        <DocScale>{children}</DocScale>
      </div>
    </div>,
    document.body,
  )
}
