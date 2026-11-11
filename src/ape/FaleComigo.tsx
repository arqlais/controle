// planê.apê: balão flutuante "fale comigo". A mensagem chega para a dona por e-mail na hora e fica no painel (opiniões).
import { useEffect, useState } from 'react'
import { ApeIcon } from './ApeIcon'
import { mandarMensagem } from './api'
import { wa, type Morador } from './model'

const TIPOS: [string, string][] = [['duvida', 'dúvida'], ['problema', 'algo não funcionou'], ['depoimento', 'depoimento'], ['sugestao', 'sugestão']]

export function FaleComigo({ me, whats }: { me: Morador | null; whats: string }) {
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState('duvida')
  const [texto, setTexto] = useState('')
  const [nome, setNome] = useState(me?.nome || '')
  const [contato, setContato] = useState(me?.tel || '')
  const [nota, setNota] = useState(5)
  const [st, setSt] = useState<'' | 'enviando' | 'ok' | string>('')
  useEffect(() => { if (me) { setNome((n) => n || me.nome || ''); setContato((c) => c || me.tel || '') } }, [me?.id])
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [aberto])
  const enviar = async () => {
    if (texto.trim().length < 3) return setSt('Escreva a sua mensagem.')
    setSt('enviando')
    try {
      await mandarMensagem({ tipo, texto: texto.trim(), nome: nome.trim(), contato: contato.trim(), pagina: location.hash.replace(/^#\/?/, '') || location.pathname, nota: tipo === 'depoimento' ? nota : null })
      setSt('ok')
      setTexto('')
    } catch (e) {
      setSt(String((e as Error)?.message || 'Não deu para enviar agora.'))
    }
  }
  const zap = wa(whats, `Oi, Laís! ${texto.trim() || 'Tenho uma dúvida sobre o planê.apê.'}`)
  return (
    <>
      <button type="button" className="ape-chatfab" onClick={() => { setAberto(true); if (st === 'ok') setSt('') }} aria-label="Fale comigo: dúvida, problema ou depoimento" title="fale comigo">
        <ApeIcon name="chat" /><span>fale comigo</span>
      </button>
      {aberto && (
        <div className="ape-sheet" role="dialog" aria-modal="true" aria-label="Fale comigo" onClick={(e) => e.target === e.currentTarget && setAberto(false)}>
          <div className="ape-sheet-in ape-ficha ape-chat">
            <button className="ape-x" onClick={() => setAberto(false)} aria-label="Fechar"><ApeIcon name="x" /></button>
            {st === 'ok' ? (
              <div className="ape-chat-ok">
                <span className="ic"><ApeIcon name="check" /></span>
                <b>recebi a sua mensagem!</b>
                <p>Respondo o mais rápido possível{contato ? ', pelo contato que você deixou' : ''}. Se for urgente, chame no WhatsApp.</p>
                <div className="ape-acts">
                  <a className="ape-btn" href={zap} target="_blank" rel="noopener noreferrer"><ApeIcon name="wpp" />WhatsApp</a>
                  <button className="ape-btn ghost" onClick={() => setAberto(false)}>fechar</button>
                </div>
              </div>
            ) : (
              <>
                <p className="ape-eyebrow">fale comigo</p>
                <h2 className="ape-h2" style={{ marginTop: 0 }}>como posso <em>ajudar?</em></h2>
                <div className="ape-chat-tipos" role="radiogroup" aria-label="Assunto">
                  {TIPOS.map(([id, l]) => <button key={id} type="button" role="radio" aria-checked={tipo === id} className="ape-chip" onClick={() => setTipo(id)}>{l}</button>)}
                </div>
                {tipo === 'depoimento' && (
                  <div className="ape-chat-nota" role="radiogroup" aria-label="Nota">
                    {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={nota === n} aria-label={`${n} de 5`} className={n <= nota ? 'on' : ''} onClick={() => setNota(n)}><ApeIcon name="star" /></button>)}
                  </div>
                )}
                <div className="ape-f">
                  <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} aria-label="Sua mensagem"
                    placeholder={tipo === 'problema' ? 'Conte o que aconteceu: em qual tela, o que você tocou e o que apareceu.' : tipo === 'depoimento' ? 'Conte como o planê.apê te ajudou.' : tipo === 'sugestao' ? 'O que deixaria o site melhor para você?' : 'Escreva a sua dúvida.'} />
                </div>
                <div className="ape-frow">
                  <div className="ape-f"><label>Seu nome</label><input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></div>
                  <div className="ape-f"><label>WhatsApp ou e-mail <span className="ape-opc">para eu responder</span></label><input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(11) 90000-0000" /></div>
                </div>
                {st && st !== 'enviando' && <p className="ape-err" role="alert">{st}</p>}
                <div className="ape-acts">
                  <button type="button" className="ape-btn primary" disabled={st === 'enviando'} onClick={() => void enviar()}><ApeIcon name="send" />{st === 'enviando' ? 'enviando…' : 'enviar'}</button>
                  <a className="ape-btn ghost" href={zap} target="_blank" rel="noopener noreferrer"><ApeIcon name="wpp" />prefiro WhatsApp</a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ===== para a dona: caixa de mensagens ao vivo (atualiza sozinha e avisa no navegador quando chega) ===== */
type Msg = { id: string; tipo: string; texto: string; nota: number | null; nome: string; criado: string; contato?: string; pagina?: string; lido?: boolean }
const ROT: Record<string, string> = { duvida: 'dúvida', problema: 'algo não funcionou', depoimento: 'depoimento', sugestao: 'sugestão' }
export function CaixaDona({ painel }: { painel?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [aberto, setAberto] = useState(false)
  const [avisos, setAvisos] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted')
  useEffect(() => {
    let vivo = true
    let vistos: Set<string> | null = null
    const busca = async () => {
      try {
        const { painelConta } = await import('./api')
        const l = ((await painelConta.feedback()) as Msg[]).filter((m) => ['duvida', 'problema', 'depoimento', 'sugestao', 'mensagem'].includes(m.tipo))
        if (!vivo) return
        const novas = l.filter((m) => !m.lido && vistos && !vistos.has(m.id))
        if (novas.length && typeof Notification !== 'undefined' && Notification.permission === 'granted')
          for (const m of novas.slice(0, 3)) new Notification(`planê.apê · ${ROT[m.tipo] || 'mensagem'} de ${m.nome}`, { body: m.texto.slice(0, 140), tag: m.id })
        vistos = new Set(l.map((m) => m.id))
        setMsgs(l)
      } catch { /* sem conexão: tenta de novo na próxima */ }
    }
    void busca()
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void busca() }, 15000)
    const vis = () => document.visibilityState === 'visible' && void busca()
    document.addEventListener('visibilitychange', vis)
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [])
  const novas = msgs.filter((m) => !m.lido)
  const lido = async (m: Msg, v = true) => {
    setMsgs((l) => l.map((x) => (x.id === m.id ? { ...x, lido: v } : x)))
    try { const { painelConta } = await import('./api'); await painelConta.marcarLido(m.id, v) } catch { /* ok */ }
  }
  const responder = (m: Msg): [string, string] | null => {
    const c = (m.contato || '').trim()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)) return ['e-mail', `mailto:${c}?subject=${encodeURIComponent('Re: sua mensagem no planê.apê')}`]
    const z = c.replace(/\D/g, '')
    if (z.length >= 10) return ['WhatsApp', wa(z.length <= 11 ? '55' + z : z, `Oi${m.nome && m.nome !== 'visitante' ? `, ${m.nome.split(' ')[0]}` : ''}! Aqui é a Laís do planê.apê, recebi a sua mensagem.`)]
    return null
  }
  return (
    <>
      <button type="button" className={`ape-caixafab ${painel ? 'painel' : ''} ${novas.length ? 'tem' : ''}`} onClick={() => setAberto(true)} aria-label={`Mensagens dos clientes${novas.length ? `: ${novas.length} novas` : ''}`}>
        <ApeIcon name="inbox" /><span>mensagens</span>{novas.length > 0 && <em>{novas.length}</em>}
      </button>
      {aberto && (
        <div className="ape-sheet" role="dialog" aria-modal="true" aria-label="Mensagens" onClick={(e) => e.target === e.currentTarget && setAberto(false)}>
          <div className="ape-sheet-in ape-ficha ape-caixa">
            <button className="ape-x" onClick={() => setAberto(false)} aria-label="Fechar"><ApeIcon name="x" /></button>
            <p className="ape-eyebrow">fale comigo · ao vivo</p>
            <h2 className="ape-h2" style={{ marginTop: 0 }}>mensagens <em>{novas.length ? `${novas.length} nova${novas.length > 1 ? 's' : ''}` : 'em dia'}</em></h2>
            {typeof Notification !== 'undefined' && !avisos && (
              <button className="ape-btn sm" onClick={() => void Notification.requestPermission().then((r) => setAvisos(r === 'granted'))}><ApeIcon name="alert" />avisar neste aparelho quando chegar</button>
            )}
            <p className="ape-note" style={{ margin: 0 }}>Atualiza sozinha a cada 15 segundos com o site aberto. Toda mensagem também chega no seu e-mail.</p>
            {!msgs.length && <div className="ape-empty"><b>nenhuma mensagem ainda</b><span>Quando alguém usar o balão "fale comigo", aparece aqui.</span></div>}
            <div className="ape-caixa-lista">
              {[...novas, ...msgs.filter((m) => m.lido)].slice(0, 60).map((m) => {
                const r = responder(m)
                return (
                  <article key={m.id} className={`ape-caixa-it ${m.lido ? 'lida' : ''}`}>
                    <div className="h"><b>{m.nome || 'visitante'}</b><span className={`ape-pill ${m.tipo === 'problema' ? 'terra' : 'azul'}`}>{ROT[m.tipo] || 'mensagem'}{m.nota ? ` · ${'★'.repeat(m.nota)}` : ''}</span></div>
                    <p>{m.texto}</p>
                    <small>{new Date(m.criado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{m.contato ? ` · ${m.contato}` : ''}{m.pagina ? ` · ${m.pagina}` : ''}</small>
                    <div className="ape-acts">
                      {r && <a className="ape-btn sm primary" href={r[1]} target="_blank" rel="noopener noreferrer" onClick={() => void lido(m)}><ApeIcon name={r[0] === 'WhatsApp' ? 'wpp' : 'mail'} />responder no {r[0]}</a>}
                      <button className="ape-btn sm ghost" onClick={() => void lido(m, !m.lido)}><ApeIcon name="check" />{m.lido ? 'marcar como nova' : 'marcar como lida'}</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
