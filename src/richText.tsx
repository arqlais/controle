import type { ReactNode } from 'react'

/* Formatação simples dentro dos textos (contrato e caixas de texto que viram documento):
   **negrito**  *itálico*  __sublinhado__  [cor=#a88a80]texto colorido[/cor]
   Fica no próprio texto, então vale no PDF, no link de assinatura e em qualquer aparelho. */

const TOKEN = /\*\*([\s\S]+?)\*\*|__([^_\n][\s\S]*?)__|(?<![*\w])\*(?!\s)([^*\n]+?)\*(?![*\w])|\[cor=(#[0-9a-fA-F]{3,8})\]([\s\S]*?)\[\/cor\]/g

/** Texto sem as marcas (para conferir títulos, numeração e contar caracteres). */
export const stripRich = (s: string) => s.replace(/\[cor=#[0-9a-fA-F]{3,8}\]|\[\/cor\]/g, '').replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/__([^_\n][\s\S]*?)__/g, '$1').replace(/(?<![*\w])\*(?!\s)([^*\n]+?)\*(?![*\w])/g, '$1')

export const hasRich = (s: string) => /\*\*|__[^_]|\[cor=#|(?<![*\w])\*\S/.test(s)

/** Mostra o texto com negrito, itálico, sublinhado e cor. */
export function Rich({ text }: { text: string }): ReactNode {
  if (!text || !hasRich(text)) return text
  return parse(text, 0)
}

function parse(text: string, depth: number): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of text.matchAll(new RegExp(TOKEN.source, 'g'))) {
    const i = m.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    const inner = (s: string) => (depth < 4 ? parse(s, depth + 1) : s)
    if (m[1] !== undefined) out.push(<b key={k++}>{inner(m[1])}</b>)
    else if (m[2] !== undefined) out.push(<u key={k++}>{inner(m[2])}</u>)
    else if (m[3] !== undefined) out.push(<i key={k++}>{inner(m[3])}</i>)
    else if (m[4] !== undefined) out.push(<span key={k++} style={{ color: m[4] }}>{inner(m[5])}</span>)
    last = i + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** A mesma formatação em HTML (folha com papel timbrado). */
export function richHtml(text: string): string {
  return esc(text)
    .replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
    .replace(/__([^_\n][\s\S]*?)__/g, '<u>$1</u>')
    .replace(/(?<![*\w])\*(?!\s)([^*\n]+?)\*(?![*\w])/g, '<i>$1</i>')
    .replace(/\[cor=(#[0-9a-fA-F]{3,8})\]([\s\S]*?)\[\/cor\]/g, '<span style="color:$1">$2</span>')
}
