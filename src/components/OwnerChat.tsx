import { useRoute } from '../router'
import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useStore } from '../store'
import { CLOUD } from '../cloud'
import { PLATFORM } from '../plans'
import { PREVIEW_CLIENT, hoursSummary, isOnline, nextOnline, platform } from '../platform'
import { timeLabel, useConversation, useHours } from '../chat'
import { RichInput, RichText, richPlain } from './RichText'
import { askDelete, toast } from './dialog'
import { systemNotify, useNotifyAsk } from '../notify'

/* Chat dos clientes com a dona (no lugar do assistente de IA).
   Mostra se ela está online agora; fora do horário: "respondo assim que possível". */

export function OwnerChat({ openSignal = 0 }: { openSignal?: number }) {
  const { userId } = useStore()
  const clientId = CLOUD ? userId : PREVIEW_CLIENT
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const { msgs, error, send, markRead, reload } = useConversation(clientId)
  const [hours] = useHours()
  const online = isOnline(hours)
  const next = nextOnline(hours)
  const unread = (msgs ?? []).filter((m) => m.fromOwner && !m.readAt).length
  const endRef = useRef<HTMLDivElement>(null)

  // outras telas podem abrir o chat (ex.: "falar com a Laís" na assinatura)
  useEffect(() => {
    if (openSignal) setOpen(true)
  }, [openSignal])
  // trocou de tela: o chat fecha (no celular ele cobre a tela toda)
  const route = useRoute()
  useEffect(() => {
    setOpen(false)
  }, [route.page, route.id])
  useEffect(() => {
    if (open && unread) void markRead()
  }, [open, unread, markRead])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs, open])
  // resposta nova com o chat fechado: aviso na tela (e no navegador, se a aba estiver no fundo)
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!msgs) return
    if (seen.current && !open) {
      const fresh = msgs.filter((m) => m.fromOwner && !seen.current!.has(m.id))
      if (fresh.length) {
        toast(`${PLATFORM.support} respondeu no chat`)
        systemNotify(`💬 ${PLATFORM.name}: resposta nova`, richPlain(fresh[fresh.length - 1].body).slice(0, 140), 'chat')
      }
    }
    seen.current = new Set(msgs.map((m) => m.id))
  }, [msgs, open])
  const notifyAsk = useNotifyAsk()

  const submit = async () => {
    if (sending || !text.trim()) return
    setSending(true)
    if (await send(text, false)) {
      // avisa a dona por e-mail (se ela não estiver com o painel aberto agora)
      void platform.notice({ tipo: 'mensagem', text }).catch(() => undefined)
      setText('')
    }
    setSending(false)
  }
  const last = msgs?.[msgs.length - 1]
  const waiting = !!last && !last.fromOwner

  return (
    <>
      <button className={`ai-fab pf-chat-fab ${open ? 'is-open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label={`Conversar com ${PLATFORM.supportWith}`} title={`Conversar com ${PLATFORM.supportWith}`}>
        <Icon name={open ? 'x' : 'chat'} size={22} />
        {!open && unread > 0 && <em className="pf-fab-badge">{unread}</em>}
        {!open && online && !unread && <i className="pf-fab-online" aria-hidden />}
      </button>
      {open && (
        <section className="ai-chat pf-chat" role="dialog" aria-label={`Conversa com ${PLATFORM.supportWith}`}>
          <header className="ai-chat-head">
            <span className="pf-chat-who">
              <span className="pf-avatar">
                <Icon name="chat" size={16} />
              </span>
              <span>
                <b>{PLATFORM.support}</b>
                <small className={online ? 'is-online' : ''}>
                  <i /> {online ? 'online agora' : 'respondemos assim que possível'}
                </small>
              </span>
            </span>
            <button className="icon-btn subtle" onClick={() => setOpen(false)} aria-label="Fechar">
              <Icon name="x" size={16} />
            </button>
          </header>
          <div className="ai-chat-body">
            <div className="pf-chat-hours">
              <Icon name="clock" size={14} />
              <span>
                horários: {hoursSummary(hours)}
                {!online && next ? ` · voltamos ${next}` : ''}
              </span>
            </div>
            {notifyAsk.canAsk && (msgs?.length ?? 0) > 0 && (
              <button type="button" className="pf-notify-ask" onClick={() => void notifyAsk.ask()}>
                <Icon name="bell" size={14} /> avisar quando eu tiver resposta
              </button>
            )}
            {msgs === null ? (
              <p className="muted small center">carregando…</p>
            ) : msgs.length === 0 ? (
              <div className="ai-empty">
                <p className="muted small">
                  oi! aqui você fala direto com {PLATFORM.supportWith} do {PLATFORM.name}: dúvidas sobre o sistema, sugestões ou qualquer problema. {online ? 'estamos online agora ☺️' : 'respondemos assim que possível ☺️'}
                </p>
                {['como faço meu primeiro orçamento?', 'como coloco meu logo na proposta?', 'como faço para assinar?'].map((st) => (
                  <button key={st} className="ai-starter" onClick={() => setText(st)}>
                    {st}
                  </button>
                ))}
              </div>
            ) : (
              msgs.map((m) => (
                <div key={m.id} className={`ai-msg ${m.fromOwner ? 'is-ai' : 'is-user'}`}>
                  {m.deletedAt ? (
                    <p className="pf-msg-deleted">
                      <Icon name="x" size={12} /> mensagem apagada
                    </p>
                  ) : (
                    <p>
                      <RichText text={m.body} />
                    </p>
                  )}
                  <small className="pf-msg-time">
                    {timeLabel(m.createdAt)}
                    {!m.fromOwner && !m.deletedAt && (
                      <>
                        <span className={`pf-ticks ${m.readAt ? 'is-read' : ''}`} aria-label={m.readAt ? 'vista' : 'enviada'} title={m.readAt ? 'vista' : 'enviada'}>
                          {m.readAt ? '✓✓' : '✓'}
                        </span>
                        <button
                          type="button"
                          className="pf-msg-del"
                          title="Apagar esta mensagem"
                          aria-label="Apagar mensagem"
                          onClick={async () => {
                            if (!(await askDelete('esta mensagem'))) return
                            try {
                              await platform.removeMessage(m.id)
                              await reload()
                            } catch {
                              toast('Não deu para apagar agora. Tente de novo daqui a pouco.')
                            }
                          }}
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </>
                    )}
                  </small>
                </div>
              ))
            )}
            {waiting && !online && (
              <p className="pf-chat-away">
                {hours.away || 'respondemos assim que possível ☺️'}
                {next ? ` (voltamos ${next})` : ''}
              </p>
            )}
            {error && <p className="auth-error small">Sem conexão com o chat agora. Tente de novo em instantes.</p>}
            <div ref={endRef} />
          </div>
          <form
            className="ai-chat-input rich-form"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <RichInput value={text} onChange={setText} onSubmit={() => void submit()} placeholder="Escreva sua mensagem…" autoFocus />
            <button className="btn primary icon-only" disabled={sending || !text.trim()} aria-label="Enviar">
              <Icon name="arrowRight" size={18} />
            </button>
          </form>
        </section>
      )}
    </>
  )
}
