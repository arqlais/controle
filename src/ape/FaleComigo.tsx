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
