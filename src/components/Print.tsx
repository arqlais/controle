import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ARTIFACT } from '../env'
import { Modal } from './ui'
import { toast } from './dialog'
import { dataUrlBlob, saveFile } from './saveFile'

/** Mostra uma folha A4 (794px) reduzida para caber na largura disponível. */
export function DocScale({ children, width = 794 }: { children: ReactNode; width?: number }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const [height, setHeight] = useState(560)
  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return
      const sc = outer.current.clientWidth / width
      setScale(sc)
      setHeight(inner.current.offsetHeight * sc)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (outer.current) ro.observe(outer.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [width])
  return (
    <div className="doc-scale" ref={outer} style={{ height }}>
      <div className="doc-scale-inner" ref={inner} style={{ width, transform: `scale(${scale})` }}>
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

/** Crédito discreto do planê no pé de cada folha (PDF, imagem e impressão). */
function madeWith(el: HTMLElement) {
  const pages = [...el.querySelectorAll<HTMLElement>('.slide, .pdf-page')]
  const targets = pages.length ? pages : [el]
  for (const t of targets) {
    if (t.querySelector(':scope > .made-with')) continue
    if (getComputedStyle(t).position === 'static') t.style.position = 'relative'
    const tag = document.createElement('span')
    tag.className = 'made-with'
    tag.textContent = 'feito com planê'
    t.appendChild(tag)
  }
}

export function usePdf() {
  const [job, setJob] = useState<{ doc: ReactNode; filename: string; png?: boolean; vector?: boolean; slides?: boolean; page?: [number, number] } | null>(null)
  const [preview, setPreview] = useState<ReactNode>(null)
  const [previewW, setPreviewW] = useState(794)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!job) return
    let cancelled = false
    let keep = false
    ;(async () => {
      try {
        await document.fonts.ready
        await new Promise((r) => setTimeout(r, 150))
        const el = ref.current?.firstElementChild as HTMLElement | null
        if (!el || cancelled) return
        madeWith(el)
        if (job.vector) {
          // PDF em vetor: o próprio navegador desenha a folha (textos continuam texto, nítidos e selecionáveis).
          // O nome do arquivo sai do título da página.
          const title = document.title
          document.title = job.filename.replace(/\.pdf$/i, '')
          keep = true // no iPhone a impressão é assíncrona: a folha só sai da tela depois de imprimir
          const restore = () => {
            document.title = title
            window.removeEventListener('afterprint', restore)
            setJob(null)
          }
          window.addEventListener('afterprint', restore)
          window.print()
          return
        }
        if (job.png) {
          // imagem para mandar no WhatsApp
          const { toPng } = await import('html-to-image')
          const url = await renderSheet(el, toPng, { pixelRatio: 2 }) // sem backgroundColor: ele pintava a folha de branco por cima do fundo do modelo
          saveFile(await dataUrlBlob(url), job.filename, 'Imagem baixada.')
          return
        }
        const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
        if (job.slides || job.page) {
          // uma página do PDF por folha: slides 16:9 (1280 × 720) ou folhas desenhadas (A4, placa…)
          const [w, h] = job.page ?? [1280, 720]
          const orientation = w > h ? 'landscape' : 'portrait'
          const list = [...el.querySelectorAll<HTMLElement>('.slide, .pdf-page')]
          const pdf = new jsPDF({ unit: 'px', format: [w, h], orientation, compress: true, hotfixes: ['px_scaling'] })
          for (let i = 0; i < list.length; i++) {
            const c = await renderSheet(list[i], toCanvas, { pixelRatio: 2 })
            if (i) pdf.addPage([w, h], orientation)
            pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h, undefined, 'FAST')
          }
          saveFile(pdf.output('blob'), job.filename, 'PDF baixado.')
          return
        }
        const canvas = await renderSheet(el, toCanvas, { pixelRatio: 3 })
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
          // PNG (sem perda): o JPEG desbotava as cores chapadas do modelo
          pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, pageW, (slice.height * pageW) / canvas.width, undefined, 'FAST')
        }
        saveFile(pdf.output('blob'), job.filename, 'PDF baixado.')
      } catch (err) {
        console.error('PDF', err)
        toast(`Não foi possível gerar o ${job.png ? 'arquivo' : 'PDF'} (${errText(err)}). Tente de novo ou me mande um print desta mensagem.`)
      } finally {
        if (!cancelled && !keep) setJob(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job])

  const clean = (f: string) => f.replace(/[\\/:*?"<>|]+/g, '-')
  /** PDF baixado direto, sem janela (a folha vira imagem em alta resolução, com as cores do modelo). */
  const download = (doc: ReactNode, filename: string) => {
    setPreviewW(794)
    if (ARTIFACT) return setPreview(doc) // o visualizador do Claude bloqueia downloads
    toast('Gerando PDF…')
    setJob({ doc, filename: clean(filename) })
  }
  /** PDF em vetor: pela janela de impressão do navegador → "Salvar como PDF" (textos continuam texto). */
  const downloadVector = (doc: ReactNode, filename: string) => {
    if (ARTIFACT) return setPreview(doc)
    toast('Na janela que abrir, escolha “Salvar como PDF”.')
    setJob({ doc, filename: clean(filename), vector: true })
  }
  /** Proposta em slides 16:9 (cliente final). */
  const downloadSlides = (doc: ReactNode, filename: string) => {
    if (ARTIFACT) {
      setPreviewW(1280)
      return setPreview(doc)
    }
    toast('Gerando PDF…')
    setJob({ doc, filename: clean(filename), slides: true })
  }
  /** Folhas desenhadas página por página (guia de medição, placa de obra, briefing, apresentação). */
  const downloadPages = (doc: ReactNode, filename: string, w: number, h: number) => {
    if (ARTIFACT) {
      setPreviewW(w)
      return setPreview(doc)
    }
    toast('Gerando PDF…')
    setJob({ doc, filename: clean(filename), page: [w, h] })
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
          <div ref={ref} className={job.vector ? 'pdf-stage print-stage' : 'pdf-stage'} aria-hidden>
            {job.doc}
          </div>,
          document.body,
        )}
      {preview && (
        <Modal wide title="pré-visualização" onClose={() => setPreview(null)}>
          <p className="muted small">Para baixar o PDF, use o sistema publicado (arqlais.github.io/controle) — aqui o visualizador do Claude não permite downloads.</p>
          <div className="doc-preview">
            <DocScale width={previewW}>{preview}</DocScale>
          </div>
        </Modal>
      )}
    </>
  )
  return { download, downloadVector, downloadSlides, downloadPages, downloadPng, busy: !!job && !job.vector, portal }
}

/** Prévia do documento em tamanho grande, por cima da tela (fecha no X, no Esc ou clicando fora). */
export function DocZoom({ children, onClose, width }: { children: ReactNode; onClose: () => void; width?: number }) {
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
      <div className={`doc-zoom-sheet ${width && width > 794 ? 'is-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <DocScale width={width}>{children}</DocScale>
      </div>
    </div>,
    document.body,
  )
}
