import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'
import { useAccess } from '../access'
import { resolveTemplate, sheetColors } from '../proposalTemplates'
import type { Settings } from '../types'
import { DocScale, usePdf } from './Print'
import { Icon } from './Icon'
import { toast } from './dialog'
import '../docs.css'

/* Peças comuns dos documentos (guia de medição, placa de obra, briefing em PDF, apresentação):
   - o design escolhido em Configurações → propostas vale para todos (cores, fontes e o "jeito" do modelo)
   - qualquer texto pode ser editado direto no documento antes de baixar
   - o PDF sai folha por folha, do tamanho certo */

/** Design da conta: cores, fontes e o modelo (coluna, faixa, planilha, editorial…). */
export function useDocLook(s: Settings) {
  const { has } = useAccess()
  const tpl = resolveTemplate(s.proposal, has)
  const p = sheetColors(s.proposal, has)
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

export function ImageField({ label, value, onChange, hint, max }: { label: string; value?: string; onChange: (v: string | undefined) => void; hint?: string; max?: number }) {
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
export function DocWorkbench({ title, eyebrow, onBack, form, doc, pageW, pageH, filename, note }: { title: string; eyebrow: string; onBack: () => void; form: ReactNode; doc: ReactNode; pageW: number; pageH: number; filename: string; note?: ReactNode }) {
  const pdf = usePdf()
  const live = useRef<HTMLDivElement>(null)
  const edited = useRef<HTMLDivElement>(null)
  const [free, setFree] = useState<string | null>(null)
  // sai da edição livre se trocar de documento
  useEffect(() => setFree(null), [filename])
  const startFree = () => {
    if (!live.current) return
    setFree(live.current.innerHTML)
    toast('Toque em qualquer texto da folha para mudar. Os campos ao lado ficam pausados enquanto isso.')
  }
  const download = () => {
    const html = free !== null ? edited.current?.innerHTML ?? free : null
    const node = html !== null ? <div className="dk-frozen" dangerouslySetInnerHTML={{ __html: html }} /> : doc
    pdf.downloadPages(node, filename, pageW, pageH)
  }
  return (
    <div className="page dk-page">
      <button className="back" onClick={onBack}>
        <Icon name="chevronL" size={16} /> documentos
      </button>
      <div className="page-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="row gap-s wrap">
          {free === null ? (
            <button className="btn ghost" onClick={startFree}>
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
      <div className="dk-layout">
        <div className={`dk-form stack ${free !== null ? 'is-paused' : ''}`}>
          {free !== null && <p className="pf-note"><Icon name="pen" size={16} /><span>Editando direto na folha. Para voltar aos campos, toque em “descartar edições da folha”.</span></p>}
          {form}
        </div>
        <div className="dk-preview">
          {note}
          <DocScale width={pageW}>
            {free === null ? (
              <div ref={live}>{doc}</div>
            ) : (
              <div ref={edited} className="dk-editable" contentEditable suppressContentEditableWarning spellCheck lang="pt-BR" dangerouslySetInnerHTML={{ __html: free }} />
            )}
          </DocScale>
        </div>
      </div>
      {pdf.portal}
    </div>
  )
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
