import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { href } from '../router'
import { Icon } from './Icon'
import { buildAIPrompt, claudeLink } from './AskAI'
import { toast } from './dialog'

/* Assistente de orçamentos (chat) com o Gemini do Google, usando a chave da própria usuária.
   A cada pergunta vai junto o "briefing" do estúdio: processo, regras, tabela e histórico. */

interface Attachment {
  name: string
  mime: string
  data: string // base64
  preview?: string // miniatura das imagens
}
interface Msg {
  role: 'user' | 'model'
  text: string
  files?: Attachment[]
}

// o que o Gemini lê direto: imagens, PDF e texto
const ACCEPT = 'image/*,application/pdf,text/plain,.txt,.csv'
const MAX_BYTES = 15 * 1024 * 1024

const readFile = (f: File) =>
  new Promise<Attachment>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const url = String(r.result)
      resolve({ name: f.name, mime: f.type || 'application/octet-stream', data: url.split(',')[1] ?? '', preview: f.type.startsWith('image/') ? url : undefined })
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(f)
  })

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']

async function askGemini(key: string, system: string, history: Msg[]) {
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({
          role: m.role,
          parts: [...(m.files ?? []).map((f) => ({ inlineData: { mimeType: f.mime, data: f.data } })), { text: m.text || 'Veja o anexo.' }],
        })),
        generationConfig: { temperature: 0.6 },
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      const parts: { text?: string }[] = json.candidates?.[0]?.content?.parts ?? []
      return parts.map((p) => p.text ?? '').join('').trim() || 'Não consegui responder agora. Tente reformular a pergunta.'
    }
    if (res.status === 404) continue // modelo indisponível: tenta o próximo
    const msg = String(json.error?.message ?? '')
    if (res.status === 400 && /api key/i.test(msg)) throw new Error('A chave do Gemini não é válida. Confira em configurações → assistente.')
    if (res.status === 429) throw new Error('Limite de uso do Gemini atingido por agora. Tente de novo em alguns minutos.')
    if (res.status === 403) throw new Error('A chave não tem permissão para o Gemini. Crie uma nova no Google AI Studio.')
    throw new Error(msg || `Erro ${res.status} ao falar com o Gemini.`)
  }
  throw new Error('Nenhum modelo do Gemini disponível para esta chave.')
}

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
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<Attachment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list) return
    const arr = [...list]
    const ok = arr.filter((f) => /^(image\/|application\/pdf|text\/)/.test(f.type) || /\.(txt|csv)$/i.test(f.name))
    if (ok.length < arr.length) toast('Dá para anexar fotos, PDF e texto. Outros arquivos (DWG, SKP…) a IA não consegue ler.')
    const total = [...files.map((f) => (f.data.length * 3) / 4), ...ok.map((f) => f.size)].reduce((a, b) => a + b, 0)
    if (total > MAX_BYTES) return toast('Os anexos passam de 15 MB. Mande menos arquivos ou imagens menores.')
    const read = await Promise.all(ok.map(readFile))
    setFiles((cur) => [...cur, ...read])
  }
  const current = quoteId ? data.quotes.find((q) => q.id === quoteId) : undefined

  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [msgs, busy, open])

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
      const answer = await askGemini(s.aiKey, buildAIPrompt(data, '', current, !!s.aiShareNames, 'chat'), history)
      setMsgs((m) => [...m, { role: 'model', text: answer }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'model', text: `⚠ ${e instanceof Error ? e.message : 'Não foi possível responder agora.'}` }])
    } finally {
      setBusy(false)
    }
  }

  // leva a pergunta (ou a conversa) para o Claude: copia o briefing completo e abre o site
  const toClaude = () => {
    const convo = msgs.length ? `\n\n## Nossa conversa até aqui\n${msgs.map((m) => `${m.role === 'user' ? 'Eu' : 'Assistente'}: ${m.text}`).join('\n\n')}` : ''
    window.open(claudeLink(data, text.trim() || (convo ? 'Continue a conversa abaixo.' : ''), current, !!s.aiShareNames, convo), '_blank', 'noopener')
    const anyFiles = files.length || msgs.some((m) => m.files?.length)
    toast(anyFiles ? 'Abrindo o Claude com a pergunta escrita. Anexe lá os arquivos (clipe ou arraste) e envie.' : 'Abrindo o Claude com a pergunta escrita: é só enviar.')
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
              {current && <small>· orçamento {`#${String(current.number).padStart(3, '0')}`}</small>}
            </span>
            <span className="row gap-s">
              {msgs.length > 0 && (
                <button className="link small" onClick={() => setMsgs([])}>
                  nova conversa
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
                  <Icon name="sparkle" size={16} /> abrir no <span className="keep-case">Claude</span>
                </button>
              </div>
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
                    {m.role === 'user' ? m.text && <p>{m.text}</p> : <Rich text={m.text} />}
                    {m.role === 'model' && !m.text.startsWith('⚠') && (
                      <button className="link small ai-copy" onClick={() => copy(m.text)}>
                        <Icon name="copy" size={12} /> copiar
                      </button>
                    )}
                  </div>
                ))}
                {busy && (
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
