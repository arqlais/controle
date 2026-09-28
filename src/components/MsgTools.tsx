import type { ReactNode, RefObject } from 'react'

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
      <button type="button" className="msg-tool" title="Riscado (selecione as palavras)" onClick={() => wrap('~')}>
        <s>S</s>
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

// *negrito*, _itálico_, ~riscado~ do WhatsApp (o marcador precisa encostar na palavra, como no app)
const WA_RULES: [RegExp, (s: ReactNode, k: number) => ReactNode][] = [
  [/\*(\S(?:[^*\n]*\S)?)\*/, (s, k) => <b key={k}>{s}</b>],
  [/_(\S(?:[^_\n]*\S)?)_/, (s, k) => <i key={k}>{s}</i>],
  [/~(\S(?:[^~\n]*\S)?)~/, (s, k) => <s key={k}>{s}</s>],
]
let keySeq = 0
function waNodes(text: string): ReactNode[] {
  let best: { i: number; len: number; inner: string; wrap: (typeof WA_RULES)[number][1] } | null = null
  for (const [re, wrap] of WA_RULES) {
    const m = re.exec(text)
    if (m && (!best || m.index < best.i)) best = { i: m.index, len: m[0].length, inner: m[1], wrap }
  }
  if (!best) return [text]
  return [text.slice(0, best.i), best.wrap(waNodes(best.inner), keySeq++), ...waNodes(text.slice(best.i + best.len))]
}

/** Como a mensagem vai aparecer no WhatsApp (o texto continua com os símbolos para funcionar lá). */
export function WaPreview({ text, className = '' }: { text: string; className?: string }) {
  return <div className={`wa-preview ${className}`}>{waNodes(text)}</div>
}
