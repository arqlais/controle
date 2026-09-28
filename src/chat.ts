import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_HOURS, platform, type ChatMessage, type OnlineHours, type Subscription } from './platform'
import { onPlatformMode } from './platform'
import { toast } from './components/dialog'

/* Ganchos do chat com a dona: conversa de um cliente, caixa de entrada da dona e horários. */

/** Mensagens de uma conversa, atualizadas em tempo real. */
export function useConversation(clientId: string) {
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null)
  const [error, setError] = useState(false)
  const load = useCallback(async () => {
    if (!clientId) return
    try {
      setMsgs(await platform.messages(clientId))
      setError(false)
    } catch {
      setError(true)
      setMsgs((m) => m ?? [])
    }
  }, [clientId])
  useEffect(() => {
    void load()
    return platform.subscribe(() => void load())
  }, [load])
  const send = useCallback(
    async (body: string, fromOwner: boolean) => {
      const text = body.trim()
      if (!text) return false
      try {
        await platform.send(clientId, text, fromOwner)
        await load()
        return true
      } catch {
        toast('A mensagem não foi enviada. Confira sua internet e tente de novo.')
        return false
      }
    },
    [clientId, load],
  )
  const markRead = useCallback(() => platform.markRead(clientId).catch(() => undefined), [clientId])
  return { msgs, error, send, markRead, reload: load }
}

/** Todas as conversas (só a dona consegue ler todas). Avisa quando chega mensagem nova. */
export function useInbox(enabled: boolean, notify = false) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const seen = useRef<Set<string> | null>(null)
  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const [m, s] = await Promise.all([platform.allMessages(), platform.subscribers()])
      // mensagem nova de cliente (depois da primeira carga): aviso na tela
      if (notify && seen.current) {
        const fresh = m.filter((x) => !x.fromOwner && !seen.current!.has(x.id))
        if (fresh.length) {
          const who = s.find((x) => x.userId === fresh[fresh.length - 1].clientId)
          toast(`💬 mensagem nova${who ? ` de ${who.name.split(' ')[0]}` : ''} no chat`)
        }
      }
      seen.current = new Set(m.map((x) => x.id))
      setMsgs(m)
      setSubs(s)
    } catch {
      /* sem conexão: tenta de novo na próxima mudança */
    }
  }, [enabled, notify])
  useEffect(() => {
    if (!enabled) return
    void load()
    const off = platform.subscribe(() => void load())
    // exemplo ligado/desligado: recarrega sem avisar "mensagem nova"
    const offMode = onPlatformMode(() => {
      seen.current = null
      void load()
    })
    const iv = setInterval(() => void load(), 60_000)
    return () => {
      off()
      offMode()
      clearInterval(iv)
    }
  }, [enabled, load])
  const unread = msgs.filter((x) => !x.fromOwner && !x.readAt).length
  return { msgs, subs, unread, reload: load, setSubs }
}

export function useHours() {
  const [hours, setHours] = useState<OnlineHours>(DEFAULT_HOURS)
  const [, tick] = useState(0)
  useEffect(() => {
    platform.hours().then(setHours).catch(() => undefined)
    // "online agora" muda com o relógio
    const iv = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(iv)
  }, [])
  return [hours, setHours] as const
}

export const timeLabel = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString() === d.toDateString()
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? hm : yesterday ? `ontem ${hm}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${hm}`
}
