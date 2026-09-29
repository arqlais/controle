import { useEffect, useRef, useState, type ReactNode } from 'react'

/* Texto com formatação do chat: **negrito**, _itálico_ e __sublinhado__.
   A mensagem fica guardada com esses marcadores; na tela aparece já formatada.
   A caixa de escrever (RichInput) mostra a formatação enquanto a pessoa digita. */

type Mark = 'b' | 'i' | 'u'
type Seg = string | { t: Mark; c: Seg[] }

// no mesmo ponto, o marcador mais longo ganha (__ antes de _)
const RULES: [Mark, RegExp][] = [
  ['u', /__(?=\S)([^\n]*?\S)__/],
  ['b', /\*\*(?=\S)([^\n]*?\S)\*\*/],
  ['i', /(?<![\p{L}\p{N}_])_(?=[^\s_])([^\n_]*?[^\s_])_(?![\p{L}\p{N}_])/u],
]

function parse(text: string): Seg[] {
  let best: { i: number; len: number; inner: string; t: Mark } | null = null
  for (const [t, re] of RULES) {
    const m = re.exec(text)
    if (m && (!best || m.index < best.i)) best = { i: m.index, len: m[0].length, inner: m[1], t }
  }
  if (!best) return text ? [text] : []
  const before = text.slice(0, best.i)
  return [...(before ? [before] : []), { t: best.t, c: parse(best.inner) }, ...parse(text.slice(best.i + best.len))]
}

const TAG: Record<Mark, 'b' | 'i' | 'u'> = { b: 'b', i: 'i', u: 'u' }

function nodes(segs: Seg[], key: string): ReactNode[] {
  return segs.map((s, n) => {
    if (typeof s === 'string') return s
    const Tag = TAG[s.t]
    return <Tag key={`${key}-${n}`}>{nodes(s.c, `${key}-${n}`)}</Tag>
  })
}

/** Mensagem formatada, com as quebras de linha. */
export function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((l, n) => (
        <span key={n}>
          {n > 0 && <br />}
          {nodes(parse(l), String(n))}
        </span>
      ))}
    </>
  )
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const html = (segs: Seg[]): string => segs.map((s) => (typeof s === 'string' ? esc(s) : `<${TAG[s.t]}>${html(s.c)}</${TAG[s.t]}>`)).join('')
export const richToHtml = (text: string) => text.split('\n').map((l) => html(parse(l))).join('<br>')

/** Texto sem marcadores (para avisos e prévias). */
export const richPlain = (text: string) => text.split('\n').map((l) => plain(parse(l))).join('\n')
const plain = (segs: Seg[]): string => segs.map((s) => (typeof s === 'string' ? s : plain(s.c))).join('')

const MARK: Record<Mark, string> = { b: '**', i: '_', u: '__' }

/** Lê o que está na caixa de escrever e devolve o texto com marcadores. */
function serialize(el: Node): string {
  let out = ''
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += (n.textContent ?? '').replace(/ /g, ' ')
      return
    }
    if (!(n instanceof HTMLElement)) return
    const tag = n.tagName
    if (tag === 'BR') {
      out += '\n'
      return
    }
    let inner = serialize(n)
    const st = n.style
    const marks: Mark[] = []
    if (tag === 'U' || /underline/.test(st.textDecoration + st.textDecorationLine)) marks.push('u')
    if (tag === 'B' || tag === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) marks.push('b')
    if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') marks.push('i')
    for (const m of marks) {
      // marca linha por linha e deixa os espaços de fora (senão o marcador não "encosta" na palavra)
      inner = inner
        .split('\n')
        .map((line) => {
          const [, a, mid, z] = line.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? ['', '', line, '']
          return mid ? `${a}${MARK[m]}${mid}${MARK[m]}${z}` : line
        })
        .join('\n')
    }
    if ((tag === 'DIV' || tag === 'P') && out && !out.endsWith('\n')) out += '\n'
    out += inner
  })
  return out
}

export const CHAT_EMOJIS = ['😊', '☺️', '😄', '😅', '😂', '🥹', '🥰', '😍', '🤩', '🤗', '😉', '🤔', '😬', '😢', '🙏', '👍', '👏', '🙌', '💪', '👋', '👀', '✅', '✨', '🎉', '💛', '💗', '🤍', '❤️', '💜', '💙', '💚', '🔥', '⭐', '💡', '📌', '📅', '⏰', '💬', '📎', '💰', '🏡', '📐', '🎨', '🖼️', '🌿', '🚀']

/** Caixa de escrever com negrito, itálico, sublinhado e emojis. Enter manda; Shift+Enter pula linha. */
export function RichInput({ value, onChange, onSubmit, placeholder, autoFocus, tools }: { value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string; autoFocus?: boolean; tools?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef<string | null>(null)
  const [active, setActive] = useState<Record<Mark, boolean>>({ b: false, i: false, u: false })
  const [emojis, setEmojis] = useState(false)

  // texto trocado por fora (IA, mensagem pronta, enviado): redesenha a caixa
  useEffect(() => {
    const el = ref.current
    if (!el || value === last.current) return
    el.innerHTML = richToHtml(value)
    last.current = value
    if (value && document.activeElement === el) caretToEnd(el)
  }, [value])
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  useEffect(() => {
    const upd = () => {
      if (document.activeElement !== ref.current) return
      setActive({ b: document.queryCommandState('bold'), i: document.queryCommandState('italic'), u: document.queryCommandState('underline') })
    }
    document.addEventListener('selectionchange', upd)
    return () => document.removeEventListener('selectionchange', upd)
  }, [])

  const emit = () => {
    const el = ref.current
    if (!el) return
    const v = serialize(el).replace(/\n+$/, '')
    last.current = v
    if (!v.trim() && el.innerHTML && !el.textContent) el.innerHTML = ''
    onChange(v)
  }
  const cmd = (c: string, arg?: string) => {
    ref.current?.focus()
    try {
      document.execCommand('styleWithCSS', false, 'false')
    } catch {
      /* navegador antigo */
    }
    document.execCommand(c, false, arg)
    emit()
  }
  const btn = (m: Mark, c: string, label: ReactNode, title: string) => (
    <button type="button" className={`msg-tool ${active[m] ? 'is-on' : ''}`} title={title} aria-label={title} aria-pressed={active[m]} onClick={() => cmd(c)}>
      {label}
    </button>
  )

  return (
    <div className="rich">
      <div className="msg-tools rich-tools" onMouseDown={(e) => e.preventDefault()}>
        {btn('b', 'bold', <b>N</b>, 'Negrito (selecione as palavras)')}
        {btn('i', 'italic', <i>I</i>, 'Itálico (selecione as palavras)')}
        {btn('u', 'underline', <u>S</u>, 'Sublinhado (selecione as palavras)')}
        <span className="msg-tools-sep" />
        <button type="button" className={`msg-tool emoji ${emojis ? 'is-on' : ''}`} title="Emojis" aria-label="Emojis" aria-expanded={emojis} onClick={() => setEmojis((v) => !v)}>
          😊
        </button>
        {tools}
      </div>
      {emojis && (
        <div className="rich-emojis" onMouseDown={(e) => e.preventDefault()}>
          {CHAT_EMOJIS.map((e) => (
            <button key={e} type="button" className="msg-tool emoji" title={`Inserir ${e}`} onClick={() => cmd('insertText', e)}>
              {e}
            </button>
          ))}
        </div>
      )}
      <div
        ref={ref}
        className="rich-box"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        data-empty={!value ? '1' : undefined}
        suppressContentEditableWarning
        onInput={emit}
        onPaste={(e) => {
          e.preventDefault()
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
          emit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            if (e.shiftKey) cmd('insertLineBreak')
            else onSubmit()
            return
          }
          const k = e.key.toLowerCase()
          if ((e.ctrlKey || e.metaKey) && (k === 'b' || k === 'i' || k === 'u')) {
            e.preventDefault()
            cmd(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline')
          }
        }}
      />
    </div>
  )
}

function caretToEnd(el: HTMLElement) {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.collapse(false)
  const s = getSelection()
  s?.removeAllRanges()
  s?.addRange(r)
}
