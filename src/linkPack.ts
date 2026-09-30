/* Plano B dos links públicos (briefing e página do cliente): uma cópia compacta vai dentro do
   próprio link. Se a nuvem não responder (ou o link foi criado no "ver como cliente" / na prévia,
   que não usam a nuvem), a página abre mesmo assim a partir dessa cópia. */

const toB64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64 = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}
const canZip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await res.arrayBuffer())
}

/** Objeto → texto curto para o link ("z" = comprimido, "j" = sem compressão). */
export async function pack(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  if (canZip()) {
    try {
      return 'z' + toB64(await pipe(bytes, new CompressionStream('deflate-raw')))
    } catch {
      /* segue sem compressão */
    }
  }
  return 'j' + toB64(bytes)
}

export async function unpack<T>(text: string | undefined | null): Promise<T | null> {
  if (!text) return null
  try {
    const kind = text[0]
    const raw = fromB64(decodeURIComponent(text.slice(1)))
    const bytes = kind === 'z' ? await pipe(raw, new DecompressionStream('deflate-raw')) : raw
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

/** Terceiro pedaço do endereço: #/briefing/<id>/<cópia>. */
export const hashExtra = () => {
  try {
    return window.location.hash.replace(/^#\/?/, '').split('/')[2] ?? ''
  } catch {
    return ''
  }
}

/** Código das respostas no fim da mensagem do WhatsApp (quando a nuvem não salvou). */
export const ANSWER_TAG = 'código das respostas:'
export const findAnswerCode = (msg: string) => msg.match(/c[óo]digo das respostas:\s*([zj][A-Za-z0-9_-]+)/i)?.[1] ?? ''
