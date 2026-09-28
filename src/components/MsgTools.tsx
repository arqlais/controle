import type { RefObject } from 'react'

// emojis que ela costuma usar nas mensagens
export const MSG_EMOJIS = ['✨', '💗', '☺️', '🤍', '😊', '🥰', '🎉', '🙏', '💕', '🌿', '🏡', '📐', '✅', '👀', '😉']

/** Barra de edição das mensagens: negrito/itálico do WhatsApp (*…* e _…_) e emojis, inseridos onde está o cursor. */
export function MsgTools({ taRef, value, onChange }: { taRef: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void }) {
  const apply = (fn: (sel: string) => string) => {
    const ta = taRef.current
    const a = ta?.selectionStart ?? value.length
    const b = ta?.selectionEnd ?? value.length
    const ins = fn(value.slice(a, b))
    onChange(value.slice(0, a) + ins + value.slice(b))
    requestAnimationFrame(() => {
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(a + ins.length, a + ins.length)
    })
  }
  const wrap = (m: string) => apply((sel) => (sel ? `${m}${sel.trim()}${m}${sel.endsWith(' ') ? ' ' : ''}` : `${m}${m}`))
  return (
    <div className="msg-tools" onMouseDown={(e) => e.preventDefault()}>
      <button type="button" className="msg-tool" title="Negrito (selecione as palavras)" onClick={() => wrap('*')}>
        <b>N</b>
      </button>
      <button type="button" className="msg-tool" title="Itálico (selecione as palavras)" onClick={() => wrap('_')}>
        <i>I</i>
      </button>
      <span className="msg-tools-sep" />
      {MSG_EMOJIS.map((e) => (
        <button key={e} type="button" className="msg-tool emoji" title={`Inserir ${e}`} onClick={() => apply(() => e)}>
          {e}
        </button>
      ))}
    </div>
  )
}
