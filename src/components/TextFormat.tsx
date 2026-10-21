import { useEffect, useRef, useState, type RefObject } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'

/* Barra de formatação para caixas de texto comuns: negrito, itálico, sublinhado e cor
   (as da sua marca num toque, ou qualquer cor). Marca o trecho selecionado com **, *, __ ou [cor=…]. */

export function TextFormat({ target, value, onChange }: { target: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void }) {
  const { data } = useStore()
  const s = data.settings
  const brand = [...new Set([s.text, s.accent, s.accentInk, s.accentSoft].filter(Boolean).map((c) => c.toLowerCase()))]
  const color = useRef<HTMLInputElement>(null)
  const wrap = (open: string, close = open) => {
    const el = target.current
    if (!el) return
    let a = el.selectionStart
    let b = el.selectionEnd
    // sem seleção: pega a palavra onde está o cursor
    if (a === b) {
      while (a > 0 && /\S/.test(value[a - 1])) a--
      while (b < value.length && /\S/.test(value[b])) b++
    }
    if (a === b) return
    const sel = value.slice(a, b)
    // já formatado assim: tira
    const already = value.slice(a - open.length, a) === open && value.slice(b, b + close.length) === close
    const next = already ? value.slice(0, a - open.length) + sel + value.slice(b + close.length) : value.slice(0, a) + open + sel + close + value.slice(b)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const start = already ? a - open.length : a + open.length
      el.setSelectionRange(start, start + sel.length)
    })
  }
  const paint = (c: string) => wrap(`[cor=${c}]`, '[/cor]')
  // qualquer cor: aplica quando fecha o seletor (não a cada arrastada)
  const paintRef = useRef(paint)
  paintRef.current = paint
  useEffect(() => {
    const el = color.current
    if (!el) return
    const on = () => paintRef.current(el.value)
    el.addEventListener('change', on)
    return () => el.removeEventListener('change', on)
  }, [])
  const clear = () => {
    const el = target.current
    if (!el) return
    const a = el.selectionStart
    const b = el.selectionEnd
    const strip = (t: string) => t.replace(/\[cor=#[0-9a-fA-F]{3,8}\]|\[\/cor\]|\*\*|__|(?<![*\w])\*|\*(?![*\w])/g, '')
    if (a === b) return onChange(strip(value))
    onChange(value.slice(0, a) + strip(value.slice(a, b)) + value.slice(b))
  }
  const btn = (label: React.ReactNode, title: string, fn: () => void, cls = '') => (
    <button type="button" className={`rt-btn ${cls}`} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={fn}>
      {label}
    </button>
  )
  return (
    <div className="rt-bar fmt-bar tf-bar" role="toolbar" aria-label="Formatação do texto">
      {btn('B', 'Negrito (selecione o trecho)', () => wrap('**'), 'rt-bold')}
      {btn('I', 'Itálico', () => wrap('*'), 'rt-italic')}
      {btn('U', 'Sublinhado', () => wrap('__'), 'rt-underline')}
      <span className="rt-sep" />
      {brand.map((c) => (
        <button key={c} type="button" className="fmt-swatch" style={{ background: c }} title={`Cor ${c}`} aria-label={`Cor do texto ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => paint(c)} />
      ))}
      <label className="fmt-swatch is-any" title="Escolher qualquer cor" aria-label="Escolher qualquer cor" onMouseDown={(e) => e.preventDefault()}>
        <Icon name="plus" size={12} />
        <input ref={color} type="color" />
      </label>
      <span className="rt-sep" />
      {btn(<Icon name="x" size={13} />, 'Tirar a formatação do trecho', clear)}
    </div>
  )
}

/** Caixa de texto com a barra de formatação: a barra aparece enquanto a caixa está em uso (sem poluir a tela). */
export function FmtArea({ value, onChange, ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [on, setOn] = useState(false)
  return (
    <div className={`fmt-area ${on ? 'is-on' : ''}`} onFocus={() => setOn(true)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOn(false)}>
      {on && <TextFormat target={ref} value={value} onChange={onChange} />}
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  )
}
