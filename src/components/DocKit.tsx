import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'
import { useAccess } from '../access'
import { resolveTemplate, sheetColors } from '../proposalTemplates'
import type { Settings } from '../types'
import type { PhotoPos } from '../docTypes'
import { DocScale, usePdf } from './Print'
import { Icon } from './Icon'
import { toast } from './dialog'
import { DesktopNote } from './ui'
import '../docs.css'

/* Peças comuns dos documentos (guia de medição, placa de obra, briefing em PDF, apresentação):
   - o design escolhido em Configurações → propostas vale para todos (cores, fontes e o "jeito" do modelo)
   - qualquer texto pode ser editado direto no documento antes de baixar
   - o PDF sai folha por folha, do tamanho certo */

/** Design da conta: cores, fontes e o modelo (coluna, faixa, planilha, editorial…). */
export function useDocLook(s: Settings) {
  const { has } = useAccess()
  const tpl = resolveTemplate(s.proposal, has)
  const p = sheetColors(s.proposal, has, s)
  const style = {
    '--d-ink': p.ink,
    '--d-accent': p.rose,
    '--d-soft': p.arch,
    '--d-paper': p.paper,
    '--d-dark': p.bar,
    '--d-serif': `'${p.serif}', 'Cormorant Garamond', Georgia, serif`,
    '--d-sans': `'${p.sans}', 'Poppins', system-ui, sans-serif`,
  } as CSSProperties
  return { look: tpl.id, name: tpl.name, style, colors: p, brand: s.brandName || s.ownerName || 'estúdio' }
}

/** QR code em SVG (nítido no PDF e na impressão grande). */
export function QR({ text, color = '#1d1d1b', bg = 'transparent', className }: { text: string; color?: string; bg?: string; className?: string }) {
  if (!text.trim()) return <span className={`qr-empty ${className ?? ''}`}>QR</span>
  const qr = qrcode(0, 'M')
  qr.addData(unescape(encodeURIComponent(text.trim())))
  qr.make()
  const n = qr.getModuleCount()
  let d = ''
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`
  return (
    <svg className={className} viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges" aria-label="QR code">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill={bg} />
      <path d={d} fill={color} />
    </svg>
  )
}

/** Endereço completo a partir do que a pessoa digitou (site, @instagram ou telefone). */
export function linkFrom(v: string) {
  const t = v.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('@')) return `https://instagram.com/${t.slice(1)}`
  const digits = t.replace(/\D/g, '')
  if (/^[\d\s()+-]+$/.test(t) && digits.length >= 10) return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`
  return `https://${t}`
}

/** Foto enviada pela pessoa (diminuída para não pesar). */
export async function pickImage(file: File, max = 1400): Promise<string> {
  const { compressImage } = await import('../studioApi')
  const blob = await compressImage(file, max, 0.78)
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export function ImageField({ label, value, onChange, hint, max, aspect, pos, onPos, defaultFit }: { label: string; value?: string; onChange: (v: string | undefined) => void; hint?: string; max?: number; aspect?: number; pos?: PhotoPos; onPos?: (p: PhotoPos) => void; defaultFit?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="dk-img">
      <span className="field-label">{label}</span>
      <div className="dk-img-row">
        <button type="button" className={`dk-img-slot ${value ? 'has-img' : ''}`} onClick={() => ref.current?.click()}>
          {value ? <img src={value} alt="" /> : <Icon name="camera" size={18} />}
        </button>
        <div className="stack-s">
          <button type="button" className="btn small" onClick={() => ref.current?.click()}>
            {value ? 'trocar' : 'escolher foto'}
          </button>
          {value && (
            <button type="button" className="link small" onClick={() => onChange(undefined)}>
              tirar
            </button>
          )}
        </div>
      </div>
      {hint && <p className="muted small">{hint}</p>}
      {value && aspect && onPos && <PhotoCrop src={value} pos={pos} aspect={aspect} onChange={onPos} defaultFit={defaultFit} />}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            onChange(await pickImage(f, max))
          } catch {
            toast('Não consegui abrir esta imagem.')
          }
        }}
      />
    </div>
  )
}

/** Mesa de trabalho de um documento: campos à esquerda, a folha à direita.
 *  "Editar direto no documento" deixa mexer em qualquer texto da folha; o PDF sai com as mudanças. */
export function DocWorkbench({ title, eyebrow, onBack, form, doc, pageW, pageH, filename, note, toolbar, free: freeProp, onFree }: { title: string; eyebrow: string; onBack: () => void; form: ReactNode; doc: ReactNode; pageW: number; pageH: number; filename: string; note?: ReactNode; toolbar?: ReactNode; free?: string | null; onFree?: (html: string | null) => void }) {
  const pdf = usePdf()
  const live = useRef<HTMLDivElement>(null)
  const edited = useRef<HTMLDivElement>(null)
  const [own, setOwn] = useState<string | null>(null)
  // edição livre controlada por fora (documento salvo guarda o que foi mudado na folha) ou aqui mesmo
  const free = freeProp !== undefined ? freeProp : own
  const setFree = (v: string | null) => (onFree ? onFree(v) : setOwn(v))
  // a folha editável só é montada uma vez por edição (digitar não recarrega o texto)
  const [mountKey, setMountKey] = useState(0)
  const startFree = () => {
    if (!live.current) return
    setFree(live.current.innerHTML)
    setMountKey((k) => k + 1)
    toast('Toque em qualquer texto da folha para mudar. Os campos ao lado ficam pausados enquanto isso.')
  }
  const download = () => {
    const html = free !== null ? edited.current?.innerHTML ?? free : null
    const node = html !== null ? <div className="dk-frozen" dangerouslySetInnerHTML={{ __html: html }} /> : doc
    pdf.downloadPages(node, filename, pageW, pageH)
  }
  return (
    <div className="page dk-page">
      <button type="button" className="back" onClick={onBack}>
        <Icon name="chevronL" size={16} /> documentos
      </button>
      <div className="page-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="row gap-s wrap dk-actions">
          {free === null ? (
            <button className="btn ghost dk-free-btn" onClick={startFree}>
              <Icon name="pen" size={15} /> editar direto no documento
            </button>
          ) : (
            <button className="btn ghost" onClick={() => setFree(null)}>
              <Icon name="x" size={15} /> descartar edições da folha
            </button>
          )}
          <button className="btn primary" onClick={download} disabled={pdf.busy}>
            <Icon name="download" size={15} /> {pdf.busy ? 'gerando…' : 'baixar PDF'}
          </button>
        </div>
      </div>
      {toolbar}
      {onFree && <DesktopNote>Editar os textos direto na folha fica no computador ou tablet. Aqui você preenche os campos e baixa o PDF normalmente.</DesktopNote>}
      <div className="dk-layout">
        <div className={`dk-form stack ${free !== null ? 'is-paused' : ''}`}>
          {free !== null && (
            <p className="pf-note">
              <Icon name="pen" size={16} />
              <span>Editando direto na folha. Para voltar aos campos, toque em “descartar edições da folha”.</span>
            </p>
          )}
          {form}
        </div>
        <div className="dk-preview">
          {note}
          <DocScale width={pageW}>
            {free === null ? (
              <div ref={live}>{doc}</div>
            ) : (
              <FreeSheet key={mountKey} html={free} innerRef={edited} onInput={(h) => onFree?.(h)} />
            )}
          </DocScale>
        </div>
      </div>
      {pdf.portal}
    </div>
  )
}

/** Folha editável: o HTML entra uma vez; o que a pessoa digita volta pelo onInput. */
function FreeSheet({ html, innerRef, onInput }: { html: string; innerRef: React.RefObject<HTMLDivElement | null>; onInput: (h: string) => void }) {
  const [initial] = useState(html)
  return <div ref={innerRef} className="dk-editable" contentEditable suppressContentEditableWarning spellCheck lang="pt-BR" onInput={(e) => onInput((e.target as HTMLDivElement).closest('.dk-editable')?.innerHTML ?? '')} dangerouslySetInnerHTML={{ __html: initial }} />
}

/** Lista editável de textos (um por linha), com botões para subir/descer e tirar. */
export function LinesField({ label, value, onChange, hint, rows = 4 }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string; rows?: number }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea rows={Math.max(rows, value.length + 1)} value={value.join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} onBlur={() => onChange(value.map((x) => x.trim()).filter(Boolean))} spellCheck lang="pt-BR" />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/** Editar os textos de um documento já montado (proposta, slides): toque em qualquer texto e mude.
 *  O PDF sai com as mudanças; o orçamento em si não muda. */
export function FreeEditModal({ doc, width, onClose, onDownload }: { doc: ReactNode; width: number; onClose: () => void; onDownload: (frozen: ReactNode) => void }) {
  const probe = useRef<HTMLDivElement>(null)
  const edited = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    // espera as fontes e imagens desenharem antes de copiar a folha
    const t = setTimeout(() => probe.current && setHtml(probe.current.innerHTML), 120)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="dk-free" role="dialog" aria-label="Editar textos do documento">
      <div className="dk-free-bar">
        <span>
          <Icon name="pen" size={15} /> toque em qualquer texto para mudar · o orçamento não muda, só este PDF
        </span>
        <div className="row gap-s">
          <button className="btn ghost small" onClick={onClose}>
            cancelar
          </button>
          <button className="btn primary small" disabled={html === null} onClick={() => onDownload(<div className="dk-frozen" dangerouslySetInnerHTML={{ __html: edited.current?.innerHTML ?? html ?? '' }} />)}>
            <Icon name="download" size={14} /> baixar PDF com as mudanças
          </button>
        </div>
      </div>
      <div className="dk-free-sheet">
        <DocScale width={width}>
          {html === null ? (
            <div ref={probe}>{doc}</div>
          ) : (
            <div ref={edited} className="dk-editable" contentEditable suppressContentEditableWarning spellCheck lang="pt-BR" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </DocScale>
      </div>
    </div>
  )
}

/** Como a foto aparece no espaço: recortada (ponto central + aproximação) ou encaixada inteira. */
export function photoStyle(pos?: PhotoPos, defaultFit = false): CSSProperties | undefined {
  if (pos?.fit || (!pos && defaultFit)) return { objectFit: 'contain' }
  if (!pos) return undefined
  return { objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%`, transform: pos.zoom > 1 ? `scale(${pos.zoom})` : undefined, transformOrigin: `${pos.x}% ${pos.y}%` }
}

/** Ajustar a foto dentro do molde: recortar (arrastar e aproximar) ou encaixar a foto inteira. */
export function PhotoCrop({ src, pos, aspect, onChange, defaultFit = false }: { src: string; pos?: PhotoPos; aspect: number; onChange: (p: PhotoPos) => void; defaultFit?: boolean }) {
  const p: PhotoPos = pos ?? { x: 50, y: 50, zoom: 1, fit: defaultFit }
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  return (
    <div className="dk-crop">
      <div className="dk-crop-mode" role="radiogroup" aria-label="Como a foto entra no espaço">
        <button type="button" role="radio" aria-checked={!p.fit} className={!p.fit ? 'is-on' : ''} onClick={() => onChange({ ...p, fit: false })}>
          <Icon name="grid" size={13} /> recortar
        </button>
        <button type="button" role="radio" aria-checked={!!p.fit} className={p.fit ? 'is-on' : ''} onClick={() => onChange({ ...p, fit: true })}>
          <Icon name="cube" size={13} /> encaixar inteira
        </button>
      </div>
      <div
        ref={box}
        className={`dk-crop-box ${p.fit ? 'is-fit' : ''}`}
        style={{ aspectRatio: String(aspect) }}
        onPointerDown={(e) => {
          if (p.fit) return
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          const r = box.current?.getBoundingClientRect()
          if (!d || !r) return
          // arrastar a foto para a direita mostra mais do lado esquerdo dela
          const k = 100 / p.zoom
          onChange({ ...p, x: clamp(d.px - ((e.clientX - d.x) / r.width) * k), y: clamp(d.py - ((e.clientY - d.y) / r.height) * k) })
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <img src={src} alt="" draggable={false} style={photoStyle(p) ?? { objectFit: 'cover' }} />
        <span className="dk-crop-hint">
          <Icon name={p.fit ? 'check' : 'grid'} size={13} /> {p.fit ? 'a foto inteira aparece no espaço' : 'arraste para enquadrar'}
        </span>
      </div>
      {!p.fit && (
        <label className="dk-crop-zoom">
          <span className="small">aproximar</span>
          <input type="range" min={1} max={3} step={0.05} value={p.zoom} onChange={(e) => onChange({ ...p, zoom: Number(e.target.value) })} aria-label="Aproximar a foto" />
          <button type="button" className="link small" onClick={() => onChange({ x: 50, y: 50, zoom: 1 })}>
            centralizar
          </button>
        </label>
      )}
    </div>
  )
}
