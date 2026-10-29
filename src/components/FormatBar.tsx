import { useRef } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'

/* Barra de formatação para os textos editáveis (documentos e contrato): negrito, itálico, sublinhado
   e cor do texto — as cores da sua marca num toque, ou qualquer cor no seletor. */

let saved: Range | null = null
const keep = () => {
  const sel = window.getSelection()
  if (sel?.rangeCount) saved = sel.getRangeAt(0).cloneRange()
}
const back = () => {
  if (!saved) return
  const el = (saved.commonAncestorContainer instanceof Element ? saved.commonAncestorContainer : saved.commonAncestorContainer.parentElement)?.closest('[contenteditable="true"]') as HTMLElement | null
  el?.focus()
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(saved)
}

export function FormatBar({ onChange, className = '' }: { onChange?: () => void; className?: string }) {
  const { data } = useStore()
  const s = data.settings
  const brand = [...new Set([s.text, s.accent, s.accentInk, s.accentSoft, '#ffffff'].filter(Boolean).map((c) => c.toLowerCase()))]
  const color = useRef<HTMLInputElement>(null)
  const run = (name: string, value?: string) => {
    back()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand(name, false, value)
    keep()
    onChange?.()
  }
  const btn = (name: string, label: React.ReactNode, title: string, cls = '') => (
    <button type="button" className={`rt-btn ${cls}`} title={title} aria-label={title} onMouseDown={(e) => (e.preventDefault(), keep())} onClick={() => run(name)}>
      {label}
    </button>
  )
  return (
    <div className={`rt-bar fmt-bar ${className}`} role="toolbar" aria-label="Formatação do texto" onMouseDown={keep}>
      {btn('bold', 'B', 'Negrito', 'rt-bold')}
      {btn('italic', 'I', 'Itálico', 'rt-italic')}
      {btn('underline', 'U', 'Sublinhado', 'rt-underline')}
      <span className="rt-sep" />
      {brand.map((c) => (
        <button key={c} type="button" className="fmt-swatch" style={{ background: c }} title={`Cor ${c}`} aria-label={`Cor do texto ${c}`} onMouseDown={(e) => (e.preventDefault(), keep())} onClick={() => run('foreColor', c)} />
      ))}
      <label className="fmt-swatch is-any" title="Escolher qualquer cor" aria-label="Escolher qualquer cor" onMouseDown={keep}>
        <Icon name="plus" size={12} />
        <input ref={color} type="color" onChange={(e) => run('foreColor', e.target.value)} />
      </label>
      <span className="rt-sep" />
      {btn('removeFormat', <Icon name="x" size={13} />, 'Tirar a formatação')}
    </div>
  )
}

