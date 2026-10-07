import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { href } from '../router'
import { Icon } from './Icon'
import { buildAIPrompt, claudeLink } from './AskAI'
import { toast } from './dialog'
import { lowerKeepRS, money, quoteNumber } from '../utils'
import { AI_APPLY_EVENT, AI_PREFILL_KEY, aiPrefill, aiTotal, parseAIQuote, type AIQuote } from '../aiQuote'
import { go } from '../router'
import type { Quote, QuoteAudience } from '../types'

/* Assistente de orçamentos (chat) com o Gemini do Google, usando a chave da própria usuária.
   A cada pergunta vai junto o "briefing" do estúdio: processo, regras, tabela e histórico. */

interface Attachment {
  name: string
  mime: string
  data: string // base64
  preview?: string // miniatura das imagens
}
export interface Msg {
  role: 'user' | 'model'
  text: string
  files?: Attachment[]
}

// o que o Gemini lê direto: imagens, PDF e texto
const ACCEPT = 'image/*,.heic,.heif,application/pdf,text/plain,.txt,.csv'
const MAX_BYTES = 15 * 1024 * 1024
const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
const isImage = (f: File) => f.type.startsWith('image/') || IMG_EXT.test(f.name)

const dataUrl = (f: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(f)
  })

/* fotos do celular chegam enormes (e às vezes em HEIC): viram JPEG de até 1400 px antes de ir para a IA */
const shrinkImage = (f: File) =>
  new Promise<string | null>((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(f)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const k = Math.min(1, 1400 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * k))
      c.height = Math.max(1, Math.round(img.height * k))
      const g = c.getContext('2d')!
      g.fillStyle = '#fff'
      g.fillRect(0, 0, c.width, c.height)
      g.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => (URL.revokeObjectURL(url), resolve(null))
    img.src = url
  })

const readFile = async (f: File): Promise<Attachment> => {
  if (isImage(f)) {
    const small = await shrinkImage(f)
    if (small) return { name: f.name, mime: 'image/jpeg', data: small.split(',')[1] ?? '', preview: small }
    // o navegador não abre (ex.: HEIC no Chrome): vai como está, o Gemini lê HEIC
    const heic = /\.heif$/i.test(f.name) ? 'image/heif' : 'image/heic'
    if (!/heic|heif/i.test(f.type + f.name)) throw new Error(`Não consegui abrir a imagem ${f.name}.`)
    const url = await dataUrl(f)
    return { name: f.name, mime: f.type || heic, data: url.split(',')[1] ?? '' }
  }
  const url = await dataUrl(f)
  return { name: f.name, mime: f.type || (/\.csv$/i.test(f.name) ? 'text/csv' : 'text/plain'), data: url.split(',')[1] ?? '' }
}

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']

/** Anexos antigos não vão de novo a cada pergunta (só os da última mensagem com arquivo): evita estourar o limite. */
const keepRecentFiles = (history: Msg[]) => {
  let left = 1
  return [...history].reverse().map((m) => {
    if (!m.files?.some((f) => f.data)) return m
    if (left-- > 0) return m
    return { ...m, files: m.files.map((f) => ({ ...f, data: '' })) }
  }).reverse()
}

const NET_ERROR = 'A conexão caiu antes da resposta chegar. Tente de novo, de preferência sem sair desta tela (no celular, trocar de app derruba a conexão).'
const isNetError = (e: unknown) => e instanceof TypeError || /load failed|failed to fetch|network/i.test(String((e as Error)?.message ?? e))

/** Uma chamada ao Gemini, recebendo a resposta aos pouquinhos (assim o celular não derruba a conexão enquanto a IA pensa). */
async function callGemini(model: string, key: string, body: string, onText?: (t: string) => void) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body,
  })
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({}))
    return { status: res.status, error: String((Array.isArray(json) ? json[0] : json)?.error?.message ?? ''), text: '' }
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      try {
        const parts: { text?: string; thought?: boolean }[] = JSON.parse(line.slice(5)).candidates?.[0]?.content?.parts ?? []
        text += parts.filter((x) => !x.thought).map((x) => x.text ?? '').join('')
        onText?.(text)
      } catch {
        /* pedaço incompleto: ignora */
      }
    }
  }
  return { status: 200, error: '', text }
}

export async function askGemini(key: string, system: string, history: Msg[], onText?: (t: string) => void) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: keepRecentFiles(history).map((m) => ({
      role: m.role,
      parts: [
        ...(m.files ?? []).filter((f) => f.data).map((f) => ({ inlineData: { mimeType: f.mime, data: f.data } })),
        { text: (m.text || 'Veja o anexo.') + ((m.files ?? []).some((f) => !f.data) ? ` (anexos enviados antes: ${(m.files ?? []).map((f) => f.name).join(', ')})` : '') },
      ],
    })),
    generationConfig: { temperature: 0.6 },
  })
  for (const model of MODELS) {
    let r: Awaited<ReturnType<typeof callGemini>> | undefined
    // a conexão do celular às vezes cai: tenta mais uma vez sozinha
    for (let attempt = 0; attempt < 2 && !r; attempt++) {
      try {
        r = await callGemini(model, key, body, onText)
      } catch (e) {
        if (!isNetError(e)) throw e
        if (attempt === 1) throw new Error(NET_ERROR)
        await new Promise((ok) => setTimeout(ok, 1200))
      }
    }
    if (!r) throw new Error(NET_ERROR)
    if (r.status === 200) return r.text.trim() || 'Não consegui responder agora. Tente reformular a pergunta.'
    if (r.status === 404) continue // modelo indisponível: tenta o próximo
    const msg = r.error
    if (r.status === 400 && /api key/i.test(msg)) throw new Error('A chave do Gemini não é válida. Confira em configurações → assistente.')
    if (r.status === 400 && /image|mime|inline/i.test(msg)) throw new Error('A IA não conseguiu ler esse anexo. Tente mandar como foto (JPG) ou PDF.')
    if (r.status === 429) throw new Error('Limite de uso do Gemini atingido por agora. Tente de novo em alguns minutos.')
    if (r.status === 403) throw new Error('A chave não tem permissão para o Gemini. Crie uma nova no Google AI Studio.')
    if (r.status === 413) throw new Error('Os anexos ficaram grandes demais. Mande menos arquivos de uma vez.')
    if (r.status >= 500) throw new Error('O Gemini está instável agora. Tente de novo em instantes.')
    throw new Error(msg || `Erro ${r.status} ao falar com o Gemini.`)
  }
  throw new Error('Nenhum modelo do Gemini disponível para esta chave.')
}

/* conversas ficam salvas neste aparelho (a atual e as 15 anteriores); anexos não, só o nome */
interface Saved {
  id: string
  date: string
  title: string
  msgs: Msg[]
}
const STORE_KEY = 'assistente-conversas-v1'
const loadChats = (): { current: Msg[]; past: Saved[] } => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
    return raw && Array.isArray(raw.current) ? raw : { current: [], past: [] }
  } catch {
    return { current: [], past: [] }
  }
}
const light = (msgs: Msg[]) => msgs.map((m) => (m.files ? { ...m, files: m.files.map((f) => ({ name: f.name, mime: f.mime, data: '' })) } : m))
const saveChats = (current: Msg[], past: Saved[]) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ current: light(current), past: past.slice(0, 15) }))
  } catch {
    /* sem espaço: segue só na memória */
  }
}
const titleOf = (msgs: Msg[]) => (msgs.find((m) => m.role === 'user')?.text || msgs.find((m) => m.role === 'user')?.files?.[0]?.name || 'conversa').replace(/\s+/g, ' ').slice(0, 70)

/** Texto da IA com negrito, títulos e tópicos simples. */
function Rich({ text }: { text: string }) {
  const inline = (s: string, k: number): ReactNode =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={`${k}-${i}`}>{p.slice(2, -2)}</b> : <span key={`${k}-${i}`}>{p}</span>))
  const out: ReactNode[] = []
  let list: ReactNode[] = []
  const flush = () => {
    if (list.length) out.push(<ul key={`ul-${out.length}`}>{list}</ul>)
    list = []
  }
  text.split('\n').forEach((raw, i) => {
    const line = raw.trimEnd()
    const bullet = /^\s*([-*•]|\d+[.)])\s+/.exec(line)
    if (bullet) {
      list.push(<li key={i}>{inline(line.slice(bullet[0].length), i)}</li>)
      return
    }
    flush()
    if (!line.trim()) return
    const h = /^#{1,4}\s+(.*)/.exec(line)
    out.push(h ? <p key={i} className="ai-h">{inline(h[1], i)}</p> : <p key={i}>{inline(line, i)}</p>)
  })
  flush()
  return <>{out}</>
}

export function AIChat({ quoteId }: { quoteId?: string }) {
  const { data } = useStore()
  const s = data.settings
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>(() => loadChats().current)
  const [past, setPast] = useState<Saved[]>(() => loadChats().past)
  const [showPast, setShowPast] = useState(false)
  useEffect(() => {
    saveChats(msgs, past)
  }, [msgs, past])
  const newChat = () => {
    if (msgs.length) setPast((p) => [{ id: String(Date.now()), date: new Date().toISOString(), title: titleOf(msgs), msgs: light(msgs) }, ...p].slice(0, 15))
    setMsgs([])
    setShowPast(false)
  }
  const openPast = (c: Saved) => {
    setPast((p) => {
      const rest = p.filter((x) => x.id !== c.id)
      return msgs.length ? [{ id: String(Date.now()), date: new Date().toISOString(), title: titleOf(msgs), msgs: light(msgs) }, ...rest].slice(0, 15) : rest
    })
    setMsgs(c.msgs)
    setShowPast(false)
  }
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('') // resposta chegando aos poucos
  const [files, setFiles] = useState<Attachment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list) return
    const arr = [...list]
    const ok = arr.filter((f) => isImage(f) || /^(application\/pdf|text\/)/.test(f.type) || /\.(pdf|txt|csv)$/i.test(f.name))
    if (ok.length < arr.length) toast('Dá para anexar fotos, PDF e texto. Outros arquivos (DWG, SKP…) a IA não consegue ler.')
    if (!ok.length) return
    const read = (await Promise.all(ok.map((f) => readFile(f).catch((e: Error) => (toast(e.message), null))))).filter((f): f is Attachment => !!f)
    const total = [...files, ...read].reduce((a, f) => a + (f.data.length * 3) / 4, 0)
    if (total > MAX_BYTES) return toast('Os anexos passam de 15 MB. Mande menos arquivos ou um PDF menor.')
    setFiles((cur) => [...cur, ...read])
  }
  const current = quoteId ? data.quotes.find((q) => q.id === quoteId) : undefined

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs, busy, open, live])

  const send = async (content?: string) => {
    const q = (content ?? text).trim()
    const attached = content ? [] : files
    if ((!q && !attached.length) || busy || !s.aiKey) return
    const history: Msg[] = [...msgs, { role: 'user', text: q, files: attached.length ? attached : undefined }]
    setMsgs(history)
    setText('')
    setFiles([])
    setBusy(true)
    try {
      const answer = await askGemini(s.aiKey, buildAIPrompt(data, '', current, !!s.aiShareNames, 'chat'), history, setLive)
      setMsgs((m) => [...m, { role: 'model', text: s.aiLowercase !== false ? lowerKeepRS(answer) : answer }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'model', text: `⚠ ${e instanceof Error ? e.message : 'Não foi possível responder agora.'}` }])
    } finally {
      setBusy(false)
      setLive('')
    }
  }

  // leva a pergunta (ou a conversa) para o Claude: copia o briefing completo e abre o site
  const toClaude = () => {
    // o 1º pedido vira "o que o cliente pediu"; o resto segue como conversa
    const first = msgs.findIndex((m) => m.role === 'user')
    const request = text.trim() || (first >= 0 ? msgs[first].text : '')
    const rest = text.trim() ? msgs : msgs.slice(first + 1)
    const convo = rest.length ? `\n\n## Nossa conversa até aqui (continue a partir dela)\n${rest.map((m) => `${m.role === 'user' ? 'Eu' : 'Assistente'}: ${m.text}`).join('\n\n')}` : ''
    const full = buildAIPrompt(data, request, current, !!s.aiShareNames) + convo
    void navigator.clipboard?.writeText(full).catch(() => undefined)
    window.open(claudeLink(data, request, current, !!s.aiShareNames, convo), '_blank', 'noopener')
    const anyFiles = files.length || msgs.some((m) => m.files?.length)
    toast(anyFiles ? 'Abrindo o Claude com tudo escrito. Anexe lá os arquivos (clipe ou arraste) e envie.' : 'Abrindo o Claude com tudo escrito: é só enviar.')
  }

  const copy = (t: string) =>
    navigator.clipboard
      ?.writeText(t)
      .then(() => toast('Resposta copiada.'))
      .catch(() => toast('Selecione o texto e copie.'))

  const starters = current
    ? ['Esse orçamento está com um bom valor?', 'O que falta perguntar ao cliente?', 'Escreva o "não inclui" deste orçamento']
    : ['Quanto cobro por um executivo de 60 m² com elétrica, hidráulica e forro?', 'Como está minha taxa de aprovação?', 'Qual o valor médio dos meus detalhamentos?']

  return (
    <>
      <button className={`ai-fab ${open ? 'is-open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label="Assistente de orçamentos" title="Assistente de orçamentos (IA)">
        <Icon name={open ? 'x' : 'sparkle'} size={22} />
      </button>
      {open && (
        <section className="ai-chat" role="dialog" aria-label="Assistente de orçamentos">
          <header className="ai-chat-head">
            <span className="ai-chat-title">
              <Icon name="sparkle" size={16} /> assistente
              {current && <small>· orçamento {quoteNumber(current)}</small>}
            </span>
            <span className="row gap-s">
              {past.length > 0 && (
                <button className="link small" onClick={() => setShowPast((v) => !v)}>
                  {showPast ? 'voltar' : `conversas (${past.length})`}
                </button>
              )}
              {msgs.length > 0 && !showPast && (
                <button className="link small" onClick={newChat}>
                  nova
                </button>
              )}
              <a className="icon-btn subtle" href={href('config')} onClick={() => localStorage.setItem('config-aba', 'ia')} title="Chave e regras da IA">
                <Icon name="settings" size={16} />
              </a>
              <button className="icon-btn subtle" onClick={() => setOpen(false)} aria-label="Fechar">
                <Icon name="x" size={16} />
              </button>
            </span>
          </header>

          {!s.aiKey ? (
            <div className="ai-chat-body ai-setup">
              <p>
                <b>Conecte o Gemini (uma vez).</b> O assistente conhece sua tabela, suas plantas com valores, seu processo e seus orçamentos anteriores.
              </p>
              <ol>
                <li>
                  Abra o{' '}
                  <a className="link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                    Google AI Studio
                  </a>{' '}
                  e entre com a sua conta Google.
                </li>
                <li>Toque em “Criar chave de API” (Create API key) e copie a chave.</li>
                <li>
                  Cole em <b>configurações → assistente</b>.
                </li>
              </ol>
              <a className="btn primary" href={href('config')} onClick={() => localStorage.setItem('config-aba', 'ia')}>
                <Icon name="settings" size={16} /> abrir configurações
              </a>
              <p className="muted small">A chave é gratuita, fica guardada só na sua conta e cada pessoa que usar o sistema coloca a própria.</p>
              <div className="ai-or">
                <span>ou pergunte ao Claude, também grátis</span>
                <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva ou cole o pedido do cliente…" />
                <button className="btn" onClick={toClaude}>
                  <Icon name="sparkle" size={16} />
                  <span>
                    abrir no <span className="keep-case">Claude</span>
                  </span>
                </button>
              </div>
            </div>
          ) : showPast ? (
            <div className="ai-chat-body ai-past">
              {past.map((c) => (
                <div key={c.id} className="ai-past-item">
                  <button onClick={() => openPast(c)}>
                    <b>{c.title}</b>
                    <small>
                      {new Date(c.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {c.msgs.length} mensagens
                    </small>
                  </button>
                  <button className="icon-btn subtle" onClick={() => setPast((p) => p.filter((x) => x.id !== c.id))} aria-label="Apagar conversa" title="Apagar">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="ai-chat-body">
                {msgs.length === 0 && (
                  <div className="ai-empty">
                    <p className="muted small">Pergunte sobre valores, escopo ou clientes, ou cole o pedido de um cliente.</p>
                    {starters.map((st) => (
                      <button key={st} className="ai-starter" onClick={() => send(st)}>
                        {st}
                      </button>
                    ))}
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={`ai-msg ${m.role === 'user' ? 'is-user' : 'is-ai'}`}>
                    {m.files?.length ? (
                      <div className="ai-files">
                        {m.files.map((f, j) => (f.preview ? <img key={j} src={f.preview} alt={f.name} /> : <span key={j} className="ai-file"><Icon name="file" size={14} /> {f.name}</span>))}
                      </div>
                    ) : null}
                    {m.role === 'user' ? m.text && <p>{m.text}</p> : <Rich text={parseAIQuote(m.text).clean} />}
                    {m.role === 'model' && (() => {
                      const sug = parseAIQuote(m.text).quote
                      return sug ? <QuoteSuggestion q={sug} current={current} onClose={() => setOpen(false)} /> : null
                    })()}
                    {m.role === 'model' && !m.text.startsWith('⚠') && (
                      <button className="link small ai-copy" onClick={() => copy(parseAIQuote(m.text).clean)}>
                        <Icon name="copy" size={12} /> copiar
                      </button>
                    )}
                  </div>
                ))}
                {busy && live.split('```')[0].trim() ? (
                  <div className="ai-msg is-ai">
                    <Rich text={(s.aiLowercase !== false ? lowerKeepRS(live) : live).split('```')[0]} />
                  </div>
                ) : busy && (
                  <div className="ai-msg is-ai ai-typing" aria-label="Pensando">
                    <i />
                    <i />
                    <i />
                  </div>
                )}
                <div ref={endRef} />
              </div>
              {files.length > 0 && (
                <div className="ai-pending">
                  {files.map((f, i) => (
                    <span key={i} className="ai-chip">
                      {f.preview ? <img src={f.preview} alt="" /> : <Icon name="file" size={14} />}
                      <span>{f.name}</span>
                      <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label={`Tirar ${f.name}`}>
                        <Icon name="x" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <form
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  void addFiles(e.dataTransfer.files)
                }}
                className="ai-chat-input"
                onSubmit={(e) => {
                  e.preventDefault()
                  void send()
                }}
              >
                <button type="button" className="icon-btn ai-attach" onClick={() => fileRef.current?.click()} title="Anexar foto, PDF ou texto do cliente" aria-label="Anexar arquivo">
                  <Icon name="clip" size={18} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => {
                    void addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <textarea
                  onPaste={(e) => {
                    if (e.clipboardData.files.length) {
                      e.preventDefault()
                      void addFiles(e.clipboardData.files)
                    }
                  }}
                  rows={Math.min(5, Math.max(1, text.split('\n').length))}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send()
                    }
                  }}
                  placeholder="Escreva ou anexe foto, PDF…"
                  autoFocus
                />
                <button className="btn primary icon-only" disabled={busy || (!text.trim() && !files.length)} aria-label="Enviar">
                  <Icon name="arrowRight" size={18} />
                </button>
              </form>
              <div className="ai-chat-foot">
                <span className="muted">Gemini</span>
                <button className="link small" onClick={toClaude} title="Copia o briefing e a conversa e abre o Claude">
                  levar {msgs.length ? 'a conversa' : 'a pergunta'} para o <span className="keep-case">Claude</span> →
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </>
  )
}

/** Sugestão de orçamento da IA: um toque e vira orçamento (para cliente final ou terceirização), editável. */
function QuoteSuggestion({ q, current, onClose }: { q: AIQuote; current?: Quote; onClose: () => void }) {
  const { data } = useStore()
  const profile = data.settings.workProfile
  const guess: QuoteAudience | '' = q.publico === 'final' ? 'final' : q.publico === 'parceiro' ? 'parceiro' : profile === 'freelancer' || !profile ? 'parceiro' : profile === 'final' ? 'final' : ''
  const [asking, setAsking] = useState(false)
  const toNew = (a: QuoteAudience) => {
    try {
      sessionStorage.setItem(AI_PREFILL_KEY, JSON.stringify(aiPrefill(q, a, data.settings.services)))
    } catch {
      /* sem espaço: abre em branco */
    }
    onClose()
    go('orcamentos', 'novo')
    toast('Orçamento montado com a sugestão da IA. Confira e edite o que quiser.')
  }
  const toCurrent = () => {
    window.dispatchEvent(new CustomEvent(AI_APPLY_EVENT, { detail: q }))
    toast('Sugestão aplicada neste orçamento. Confira e edite o que quiser.')
  }
  const both = profile === 'ambos'
  return (
    <div className="ai-quote">
      <p className="ai-quote-head">
        <Icon name="file" size={14} /> orçamento sugerido · {q.itens.length} {q.itens.length === 1 ? 'serviço' : 'serviços'}
      </p>
      <ol className="ai-quote-items">
        {q.itens.map((x, i) => (
          <SuggestedItem key={i} n={i + 1} x={x} />
        ))}
      </ol>
      <p className="ai-quote-total">
        total <b>{money(aiTotal(q))}</b>
        {q.prazoDias ? <small> · {q.prazoDias} dias</small> : null}
      </p>
      {asking || (both && !guess) ? (
        <div className="ai-quote-ask">
          <span className="muted small">Criar o orçamento para:</span>
          <button type="button" className="btn small primary" onClick={() => toNew('final')}>
            <Icon name="home" size={14} /> cliente final
          </button>
          <button type="button" className="btn small primary" onClick={() => toNew('parceiro')}>
            <Icon name="briefcase" size={14} /> terceirização
          </button>
        </div>
      ) : (
        <div className="ai-quote-ask">
          <button type="button" className="btn small primary" onClick={() => (both ? setAsking(true) : toNew(guess || 'parceiro'))}>
            <Icon name="file" size={14} /> criar orçamento com isso
          </button>
          {current && (
            <button type="button" className="btn small ghost" onClick={toCurrent}>
              usar neste orçamento
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Um serviço da sugestão: nome, quantidade e valor; o escopo aparece resumido, com "ver mais". */
function SuggestedItem({ n, x }: { n: number; x: AIQuote['itens'][number] }) {
  const [open, setOpen] = useState(false)
  const lines = (x.descricao ?? '')
    .split(/\n|;\s*/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
  const long = lines.length > 2 || lines.some((l) => l.length > 90)
  return (
    <li className={`ai-qi ${open ? 'is-open' : ''}`}>
      <span className="ai-quote-n">{n}</span>
      <div className="ai-qi-main">
        <div className="ai-qi-top">
          <b className="ai-qi-name">{x.titulo}</b>
          <b className="ai-qi-val">{money(x.valor)}</b>
        </div>
        {x.detalhe && <small className="ai-qi-detail">{x.detalhe}</small>}
        {lines.length > 0 && (
          <ul className="ai-quote-desc">
            {(open ? lines : lines.slice(0, 2)).map((l, j) => (
              <li key={j}>{l}</li>
            ))}
          </ul>
        )}
        {long && (
          <button type="button" className="link small ai-qi-more" onClick={() => setOpen((v) => !v)}>
            {open ? 'ver menos' : `ver escopo completo${lines.length > 2 ? ` (${lines.length})` : ''}`}
          </button>
        )}
      </div>
    </li>
  )
}
