// planê.apê: suporte. Quem visita (San Levi, cliente ou visitante) tem um ícone só, "ajuda": tira dúvida ou relata
// um problema numa conversa ao vivo com a dona, ou deixa um depoimento (esse vai para "opiniões", não é conversa).
// A dona tem a caixa de suporte: conversas separadas por origem e assunto, respondidas dali mesmo.
import { useEffect, useRef, useState } from 'react'
import { ApeIcon } from './ApeIcon'
import { chatEnviar, chatLer, mandarMensagem, suporte, type ChatMsg, type Conversa } from './api'
import { wa, type Morador } from './model'

const TOKEN = 'ape-chat-token'
const VISTAS = 'ape-chat-vistas'
const ler = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const gravar = (k: string, v: string) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k) } catch { /* ok */ } }
const hora = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const ORIGEM: Record<string, [string, string]> = { sanlevi: ['San Levi', 'azul'], cliente: ['cliente', 'terra'], visitante: ['visitante', ''] }
const ASSUNTO: Record<string, string> = { duvida: 'dúvida', problema: 'problema' }

type Tela = 'menu' | 'chat' | 'depoimento' | 'obrigada'

export function FaleComigo({ me, whats, origem }: { me: Morador | null; whats: string; origem: 'sanlevi' | 'cliente' | 'visitante' }) {
  const [aberto, setAberto] = useState(false)
  const [token, setToken] = useState(() => ler(TOKEN))
  const [tela, setTela] = useState<Tela>(() => (ler(TOKEN) ? 'chat' : 'menu'))
  const [assunto, setAssunto] = useState('duvida')
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [texto, setTexto] = useState('')
  const [nome, setNome] = useState(me?.nome || '')
  const [contato, setContato] = useState(me?.tel || '')
  const [nota, setNota] = useState(5)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  useEffect(() => { if (me) { setNome((n) => n || me.nome || ''); setContato((c) => c || me.tel || '') } }, [me?.id])

  // conversa aberta: busca respostas a cada 4 s; fechada: a cada 30 s (para mostrar o aviso de resposta nova)
  useEffect(() => {
    if (!token) return
    let vivo = true
    const busca = async () => {
      try {
        const r = await chatLer(token)
        if (!vivo) return
        if (r.sumiu) { gravar(TOKEN, ''); setToken(''); setMsgs([]); setTela('menu'); return }
        setMsgs(r.msgs)
      } catch { /* sem conexão: tenta de novo */ }
    }
    void busca()
    const t = window.setInterval(() => document.visibilityState === 'visible' && void busca(), aberto ? 4000 : 30000)
    return () => { vivo = false; clearInterval(t) }
  }, [token, aberto])
  useEffect(() => { if (aberto && tela === 'chat') { fim.current?.scrollIntoView({ block: 'end' }); gravar(VISTAS, String(msgs.filter((m) => m.de === 'dona').length)) } }, [msgs.length, aberto, tela])
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [aberto])

  const respostas = msgs.filter((m) => m.de === 'dona').length
  const novas = Math.max(0, respostas - (Number(ler(VISTAS)) || 0))
  const enviar = async () => {
    const t = texto.trim()
    if (!t) return
    setBusy(true); setErr('')
    try {
      const r = await chatEnviar({ token, texto: t, nome: nome.trim(), contato: contato.trim(), origem, assunto, pagina: location.hash.replace(/^#\/?/, '') || location.pathname })
      setMsgs(r.msgs); setTexto('')
      if (r.token && r.token !== token) { gravar(TOKEN, r.token); setToken(r.token) }
    } catch (e) { setErr(String((e as Error)?.message || 'Não deu para enviar agora.')) }
    setBusy(false)
  }
  const depoimento = async () => {
    if (texto.trim().length < 3) return setErr('Escreva o seu depoimento.')
    setBusy(true); setErr('')
    try { await mandarMensagem({ tipo: 'depoimento', texto: texto.trim(), nome: nome.trim(), contato: contato.trim(), pagina: origem, nota }); setTexto(''); setTela('obrigada') } catch (e) { setErr(String((e as Error)?.message || 'Não deu para enviar agora.')) }
    setBusy(false)
  }
  const zap = wa(whats, 'Oi, Laís! Tenho uma dúvida sobre o planê.apê.')

  return (
    <>
      <button type="button" className={`ape-chatfab ${novas ? 'tem' : ''}`} onClick={() => setAberto(true)} aria-label={`Ajuda: dúvida, problema ou depoimento${novas ? ` (${novas} resposta nova)` : ''}`}>
        <ApeIcon name="chat" /><span>ajuda</span>{novas > 0 && <em>{novas}</em>}
      </button>
      {aberto && (
        <div className="ape-sheet" role="dialog" aria-modal="true" aria-label="Ajuda" onClick={(e) => e.target === e.currentTarget && setAberto(false)}>
          <div className="ape-sheet-in ape-ficha ape-chat">
            <button className="ape-x" onClick={() => setAberto(false)} aria-label="Fechar"><ApeIcon name="x" /></button>
            {tela === 'menu' && (
              <>
                <p className="ape-eyebrow">ajuda</p>
                <h2 className="ape-h2" style={{ marginTop: 0 }}>como posso <em>ajudar?</em></h2>
                <div className="ape-chat-menu">
                  <button type="button" onClick={() => { setAssunto('duvida'); setTela('chat') }}><span className="ic"><ApeIcon name="chat" /></span><b>tirar uma dúvida</b><small>converse comigo aqui mesmo</small></button>
                  <button type="button" onClick={() => { setAssunto('problema'); setTela('chat') }}><span className="ic"><ApeIcon name="alert" /></span><b>algo não funcionou</b><small>conte o que aconteceu que eu resolvo</small></button>
                  <button type="button" onClick={() => setTela('depoimento')}><span className="ic"><ApeIcon name="star" /></span><b>deixar um depoimento</b><small>conte como o planê.apê te ajudou</small></button>
                </div>
                <a className="ape-link-btn" href={zap} target="_blank" rel="noopener noreferrer"><ApeIcon name="wpp" />prefiro falar no WhatsApp</a>
              </>
            )}
            {tela === 'chat' && (
              <>
                <div className="ape-chat-topo">
                  {!token && <button type="button" className="ape-btn ghost sm" onClick={() => setTela('menu')} aria-label="Voltar"><ApeIcon name="chev" /></button>}
                  <div><b>Laís · planê.apê</b><small>{token ? 'responde por aqui, normalmente em poucos minutos' : assunto === 'problema' ? 'conte o que aconteceu: em qual tela, o que tocou e o que apareceu' : 'escreva a sua dúvida'}</small></div>
                </div>
                <div className="ape-chat-msgs" aria-live="polite">
                  {!msgs.length && <p className="ape-chat-bolha dona">Oi! Como posso ajudar? Escreva aqui que eu respondo nesta conversa.</p>}
                  {msgs.map((m) => <p key={m.id} className={`ape-chat-bolha ${m.de}`}>{m.texto}<small>{hora(m.criado)}</small></p>)}
                  <div ref={fim} />
                </div>
                {(!token || !contato) && (
                  <div className="ape-frow">
                    <div className="ape-f"><label>Seu nome</label><input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></div>
                    <div className="ape-f"><label>WhatsApp ou e-mail</label><input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="para a resposta, se sair" /></div>
                  </div>
                )}
                {err && <p className="ape-err" role="alert">{err}</p>}
                <div className="ape-chat-envio">
                  <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Escreva a sua mensagem…" aria-label="Sua mensagem" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() } }} />
                  <button type="button" className="ape-btn primary" disabled={busy || !texto.trim()} onClick={() => void enviar()} aria-label="Enviar"><ApeIcon name="send" /></button>
                </div>
                {token && <button type="button" className="ape-link-btn" onClick={() => { gravar(TOKEN, ''); gravar(VISTAS, ''); setToken(''); setMsgs([]); setTela('menu') }}>começar outra conversa</button>}
              </>
            )}
            {tela === 'depoimento' && (
              <>
                <div className="ape-chat-topo"><button type="button" className="ape-btn ghost sm" onClick={() => setTela('menu')} aria-label="Voltar"><ApeIcon name="chev" /></button><div><b>seu depoimento</b><small>pode aparecer na loja, com o seu primeiro nome</small></div></div>
                <div className="ape-chat-nota" role="radiogroup" aria-label="Nota">
                  {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={nota === n} aria-label={`${n} de 5`} className={n <= nota ? 'on' : ''} onClick={() => setNota(n)}><ApeIcon name="star" /></button>)}
                </div>
                <div className="ape-f"><textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Conte como o planê.apê te ajudou." aria-label="Depoimento" /></div>
                <div className="ape-f"><label>Seu nome</label><input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></div>
                {err && <p className="ape-err" role="alert">{err}</p>}
                <div className="ape-acts"><button type="button" className="ape-btn primary" disabled={busy} onClick={() => void depoimento()}><ApeIcon name="send" />{busy ? 'enviando…' : 'enviar depoimento'}</button></div>
              </>
            )}
            {tela === 'obrigada' && (
              <div className="ape-chat-ok">
                <span className="ic"><ApeIcon name="check" /></span>
                <b>obrigada pelo depoimento!</b>
                <p>Ele ajuda muito outras pessoas que estão montando o apê.</p>
                <div className="ape-acts"><button className="ape-btn ghost" onClick={() => { setTela('menu'); setAberto(false) }}>fechar</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ===== para a dona: caixa de suporte (conversas ao vivo, por origem e assunto) ===== */
export function CaixaDona({ painel }: { painel?: boolean }) {
  const [convs, setConvs] = useState<Conversa[]>([])
  const [aberto, setAberto] = useState(false)
  const [sel, setSel] = useState<Conversa | null>(null)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [texto, setTexto] = useState('')
  const [fOrigem, setFOrigem] = useState('todas')
  const [fAssunto, setFAssunto] = useState('todos')
  const [verResolvidas, setVerResolvidas] = useState(false)
  const [busy, setBusy] = useState(false)
  const [avisos, setAvisos] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted')
  const fim = useRef<HTMLDivElement>(null)
  const naoLidasAntes = useRef<Map<string, number> | null>(null)

  const carregar = async () => {
    const l = await suporte.conversas()
    const antes = naoLidasAntes.current
    if (antes && typeof Notification !== 'undefined' && Notification.permission === 'granted')
      for (const c of l) if (c.nao_lidas > (antes.get(c.id) || 0)) new Notification(`planê.apê · ${c.nome || 'visitante'} (${ORIGEM[c.origem]?.[0] || 'visitante'})`, { body: `${ASSUNTO[c.assunto] || 'mensagem'}: nova mensagem no suporte`, tag: c.id })
    naoLidasAntes.current = new Map(l.map((c) => [c.id, c.nao_lidas]))
    setConvs(l)
  }
  useEffect(() => {
    void carregar()
    const t = window.setInterval(() => document.visibilityState === 'visible' && void carregar(), aberto ? 6000 : 15000)
    return () => clearInterval(t)
  }, [aberto])
  useEffect(() => {
    if (!sel) return
    let vivo = true
    const busca = async () => { try { const m = await suporte.mensagens(sel.id); if (vivo) setMsgs(m) } catch { /* ok */ } }
    void busca()
    void suporte.lida(sel.id).then(() => setConvs((l) => l.map((c) => (c.id === sel.id ? { ...c, nao_lidas: 0 } : c))))
    const t = window.setInterval(() => document.visibilityState === 'visible' && void busca(), 4000)
    return () => { vivo = false; clearInterval(t) }
  }, [sel?.id])
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [msgs.length])

  const novas = convs.reduce((n, c) => n + (c.nao_lidas > 0 ? 1 : 0), 0)
  const lista = convs.filter((c) => (fOrigem === 'todas' || c.origem === fOrigem) && (fAssunto === 'todos' || c.assunto === fAssunto) && (verResolvidas || !c.resolvida))
  const conta = (o: string) => convs.filter((c) => (o === 'todas' || c.origem === o) && !c.resolvida).length
  const responder = async () => {
    if (!sel || !texto.trim()) return
    setBusy(true)
    try { await suporte.responder(sel.id, texto.trim()); setTexto(''); setMsgs(await suporte.mensagens(sel.id)) } catch (e) { alert(`Não deu para enviar (${(e as Error).message}).`) }
    setBusy(false)
  }
  const fora = (c: Conversa): [string, string] | null => {
    const v = c.contato.trim()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return ['mail', `mailto:${v}`]
    const z = v.replace(/\D/g, '')
    return z.length >= 10 ? ['wpp', wa(z.length <= 11 ? '55' + z : z, `Oi${c.nome ? `, ${c.nome.split(' ')[0]}` : ''}! Aqui é a Laís do planê.apê.`)] : null
  }

  return (
    <>
      <button type="button" className={`ape-caixafab ${painel ? 'painel' : ''} ${novas ? 'tem' : ''}`} onClick={() => setAberto(true)} aria-label={`Suporte${novas ? `: ${novas} conversas com mensagem nova` : ''}`}>
        <ApeIcon name="inbox" /><span>suporte</span>{novas > 0 && <em>{novas}</em>}
      </button>
      {aberto && (
        <div className="ape-sheet" role="dialog" aria-modal="true" aria-label="Suporte" onClick={(e) => e.target === e.currentTarget && setAberto(false)}>
          <div className="ape-sheet-in ape-ficha largo ape-caixa">
            <button className="ape-x" onClick={() => setAberto(false)} aria-label="Fechar"><ApeIcon name="x" /></button>
            {!sel ? (
              <>
                <p className="ape-eyebrow">suporte · ao vivo</p>
                <h2 className="ape-h2" style={{ marginTop: 0 }}>conversas <em>{novas ? `${novas} nova${novas > 1 ? 's' : ''}` : 'em dia'}</em></h2>
                <div className="ape-caixa-filtros">
                  <div className="ape-chips-l" role="group" aria-label="De onde">
                    {(['todas', 'sanlevi', 'cliente', 'visitante'] as const).map((o) => <button key={o} className="ape-chip" aria-pressed={fOrigem === o} onClick={() => setFOrigem(o)}>{o === 'todas' ? 'todas' : ORIGEM[o][0]} <span className="num">{conta(o)}</span></button>)}
                  </div>
                  <div className="ape-chips-l" role="group" aria-label="Assunto">
                    {(['todos', 'duvida', 'problema'] as const).map((a) => <button key={a} className="ape-chip" aria-pressed={fAssunto === a} onClick={() => setFAssunto(a)}>{a === 'todos' ? 'todos os assuntos' : ASSUNTO[a]}</button>)}
                    <label className="ape-tog"><input type="checkbox" checked={verResolvidas} onChange={(e) => setVerResolvidas(e.target.checked)} /> ver resolvidas</label>
                  </div>
                </div>
                {typeof Notification !== 'undefined' && !avisos && <button className="ape-btn sm" onClick={() => void Notification.requestPermission().then((r) => setAvisos(r === 'granted'))}><ApeIcon name="alert" />avisar neste aparelho quando chegar</button>}
                {!lista.length && <div className="ape-empty"><b>nenhuma conversa aqui</b><span>Quando alguém tocar em "ajuda" no site e escrever, aparece aqui na hora. Depoimentos ficam no painel → opiniões.</span></div>}
                <div className="ape-caixa-lista">
                  {lista.map((c) => (
                    <button key={c.id} type="button" className={`ape-caixa-it ${c.nao_lidas ? 'nova' : ''} ${c.resolvida ? 'lida' : ''}`} onClick={() => setSel(c)}>
                      <div className="h"><b>{c.nome || 'visitante'}</b>{c.nao_lidas > 0 && <em>{c.nao_lidas}</em>}</div>
                      <div className="pills"><span className={`ape-pill ${ORIGEM[c.origem]?.[1] || ''}`}>{ORIGEM[c.origem]?.[0] || 'visitante'}</span><span className={`ape-pill ${c.assunto === 'problema' ? 'terra' : ''}`}>{ASSUNTO[c.assunto] || 'mensagem'}</span>{c.resolvida && <span className="ape-pill">resolvida</span>}</div>
                      <small>{hora(c.atualizado)}{c.contato ? ` · ${c.contato}` : ''}{c.pagina ? ` · ${c.pagina}` : ''}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="ape-chat-topo">
                  <button type="button" className="ape-btn ghost sm" onClick={() => { setSel(null); setMsgs([]) }} aria-label="Voltar"><ApeIcon name="chev" /></button>
                  <div><b>{sel.nome || 'visitante'}</b><small>{ORIGEM[sel.origem]?.[0] || 'visitante'} · {ASSUNTO[sel.assunto] || 'mensagem'}{sel.contato ? ` · ${sel.contato}` : ''}{sel.pagina ? ` · ${sel.pagina}` : ''}</small></div>
                </div>
                <div className="ape-chat-msgs">
                  {msgs.map((m) => <p key={m.id} className={`ape-chat-bolha ${m.de === 'dona' ? 'cliente' : 'dona'}`}>{m.texto}<small>{hora(m.criado)}</small></p>)}
                  <div ref={fim} />
                </div>
                <div className="ape-chat-envio">
                  <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Responder… (a pessoa vê na hora)" aria-label="Resposta" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void responder() } }} />
                  <button type="button" className="ape-btn primary" disabled={busy || !texto.trim()} onClick={() => void responder()} aria-label="Enviar"><ApeIcon name="send" /></button>
                </div>
                <div className="ape-acts">
                  {(() => { const f = fora(sel); return f ? <a className="ape-btn sm" href={f[1]} target="_blank" rel="noopener noreferrer"><ApeIcon name={f[0]} />{f[0] === 'wpp' ? 'chamar no WhatsApp' : 'mandar e-mail'}</a> : null })()}
                  <button className="ape-btn sm ghost" onClick={() => void suporte.resolver(sel.id, !sel.resolvida).then(() => { setSel({ ...sel, resolvida: !sel.resolvida }); void carregar() })}><ApeIcon name="check" />{sel.resolvida ? 'reabrir' : 'marcar como resolvida'}</button>
                  <button className="ape-btn sm ghost danger" onClick={() => { if (confirm('Apagar esta conversa?')) void suporte.apagar(sel.id).then(() => { setSel(null); void carregar() }) }}><ApeIcon name="trash" />apagar</button>
                </div>
                {sel.contato.includes('@') && <p className="ape-note" style={{ margin: 0 }}>A pessoa deixou e-mail: a sua resposta também chega lá.</p>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
