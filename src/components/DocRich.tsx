import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Icon } from './Icon'

/* Editor do contrato no modelo da pessoa: edita direto na folha (negrito, itálico, sublinhado, alinhamento)
   e insere as {etiquetas} onde o cursor está. */

export interface DocRichHandle {
  insert: (text: string) => void
}

export const DocRich = forwardRef<DocRichHandle, { html: string; onChange: (html: string) => void; className?: string }>(function DocRich({ html, onChange, className = '' }, ref) {
  const box = useRef<HTMLDivElement>(null)
  const range = useRef<Range | null>(null)
  // só reescreve a folha quando o HTML mudou por fora (assim o cursor não pula enquanto digita)
  useEffect(() => {
    if (box.current && box.current.innerHTML !== html) box.current.innerHTML = html
  }, [html])
  const remember = () => {
    const sel = window.getSelection()
    if (sel?.rangeCount && box.current?.contains(sel.anchorNode)) range.current = sel.getRangeAt(0).cloneRange()
  }
  const emit = () => box.current && onChange(box.current.innerHTML)
  const restore = () => {
    box.current?.focus()
    if (range.current) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range.current)
    }
  }
  const cmd = (name: string) => {
    restore()
    document.execCommand(name)
    emit()
  }
  useImperativeHandle(ref, () => ({
    insert: (text: string) => {
      restore()
      if (!range.current) {
        // sem cursor na folha: vai para o fim
        const r = document.createRange()
        r.selectNodeContents(box.current!)
        r.collapse(false)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(r)
      }
      document.execCommand('insertText', false, text)
      remember()
      emit()
    },
  }))
  const tools: [string, string, string][] = [
    ['bold', 'B', 'Negrito'],
    ['italic', 'I', 'Itálico'],
    ['underline', 'U', 'Sublinhado'],
  ]
  return (
    <div className={`rt ${className}`}>
      <div className="rt-bar" role="toolbar" aria-label="Formatação">
        {tools.map(([c, label, title]) => (
          <button key={c} type="button" className={`rt-btn rt-${c}`} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd(c)}>
            {label}
          </button>
        ))}
        <span className="rt-sep" />
        {(
          [
            ['justifyLeft', 'à esquerda'],
            ['justifyCenter', 'centralizado'],
            ['justifyFull', 'justificado'],
          ] as const
        ).map(([c, t]) => (
          <button key={c} type="button" className="rt-btn" title={`Alinhar ${t}`} aria-label={`Alinhar ${t}`} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd(c)}>
            <Icon name={c === 'justifyCenter' ? 'menu' : 'list'} size={14} />
          </button>
        ))}
        <span className="rt-sep" />
        <button type="button" className="rt-btn" title="Desfazer" aria-label="Desfazer" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('undo')}>
          <Icon name="chevronL" size={14} />
        </button>
        <button type="button" className="rt-btn" title="Refazer" aria-label="Refazer" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('redo')}>
          <Icon name="chevronR" size={14} />
        </button>
      </div>
      <div ref={box} className="rt-page ch-doc-edit" contentEditable suppressContentEditableWarning spellCheck lang="pt-BR" onInput={() => (remember(), emit())} onKeyUp={remember} onMouseUp={remember} onBlur={remember} />
    </div>
  )
})
