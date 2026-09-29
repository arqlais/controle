import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_HOURS, SUGGESTION_STATUS, platform, type ChatMessage, type OnlineHours, type Subscription, type Suggestion } from './platform'
import { systemNotify } from './notify'
import { richPlain } from './components/RichText'
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
  const [sugs, setSugs] = useState<Suggestion[]>([])
  const seen = useRef<Set<string> | null>(null)
  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const [m, s, sg] = await Promise.all([platform.allMessages(), platform.subscribers(), notify ? platform.suggestions() : Promise.resolve([] as Suggestion[])])
      // mensagem ou sugestão nova (depois da primeira carga): aviso na tela e no navegador
      if (notify && seen.current) {
        const nameOf = (id: string) => s.find((x) => x.userId === id)?.name.split(' ')[0]
        const fresh = m.filter((x) => !x.fromOwner && !seen.current!.has(x.id))
        if (fresh.length) {
          const last = fresh[fresh.length - 1]
          const who = nameOf(last.clientId)
          toast(`💬 mensagem nova${who ? ` de ${who}` : ''} no chat`)
          systemNotify(`💬 ${who || 'mensagem nova'}`, richPlain(last.body).slice(0, 140), `chat-${last.clientId}`)
        }
        const freshSug = sg.filter((x) => !seen.current!.has(x.id))
        if (freshSug.length) {
          const x = freshSug[0]
          const who = nameOf(x.userId)
          toast(`💡 sugestão nova${who ? ` de ${who}` : ''}: ${x.title}`)
          systemNotify(`💡 sugestão${who ? ` de ${who}` : ''}`, x.title, `sug-${x.id}`)
        }
      }
      seen.current = new Set([...m.map((x) => x.id), ...sg.map((x) => x.id)])
      setMsgs(m)
      setSubs(s)
      setSugs(sg)
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
  const newSuggestions = sugs.filter((x) => x.status === 'recebida').length
  return { msgs, subs, unread, newSuggestions, reload: load, setSubs }
}

/** Quem usa: aviso quando a dona responde ou muda a situação de uma sugestão. */
const SUG_SEEN = 'sugestoes-vistas'
const SUG_TOLD = 'sugestoes-avisadas'
const readSeen = (): Record<string, string> | null => {
  try {
    const v = localStorage.getItem(SUG_SEEN)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
const stamp = (x: Suggestion) => `${x.status}|${x.reply}`
export function useSuggestionUpdates(enabled: boolean) {
  const [list, setList] = useState<Suggestion[]>([])
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeen() ?? {})
  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const all = await platform.suggestions()
      setList(all)
      const prev = readSeen()
      if (!prev) {
        // primeira vez neste aparelho: só guarda como está, sem avisar
        const base = Object.fromEntries(all.map((x) => [x.id, stamp(x)]))
        localStorage.setItem(SUG_SEEN, JSON.stringify(base))
        setSeen(base)
        return
      }
      // avisa uma vez por mudança (o pontinho no menu fica até abrir as sugestões)
      let told: Record<string, string> = {}
      try {
        told = JSON.parse(localStorage.getItem(SUG_TOLD) || '{}')
      } catch {
        /* vazio */
      }
      const changed = all.filter((x) => prev[x.id] !== undefined && prev[x.id] !== stamp(x) && told[x.id] !== stamp(x))
      if (changed.length) {
        for (const x of changed) told[x.id] = stamp(x)
        localStorage.setItem(SUG_TOLD, JSON.stringify(told))
        const x = changed[0]
        const msg = `💡 sua sugestão “${x.title}” agora está: ${SUGGESTION_STATUS[x.status].label}${x.reply ? ' (com resposta)' : ''}`
        toast(msg)
        systemNotify('💡 sua sugestão foi respondida', `“${x.title}”: ${SUGGESTION_STATUS[x.status].label}`, `sug-${x.id}`)
      }
      // sugestões novas desta pessoa entram como vistas
      const next = { ...prev }
      for (const x of all) if (next[x.id] === undefined) next[x.id] = stamp(x)
      localStorage.setItem(SUG_SEEN, JSON.stringify(next))
      setSeen(next)
    } catch {
      /* sem conexão */
    }
  }, [enabled])
  useEffect(() => {
    if (!enabled) return
    void load()
    const iv = setInterval(() => void load(), 3 * 60_000)
    const onFocus = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [enabled, load])
  const unseen = list.filter((x) => seen[x.id] !== undefined && seen[x.id] !== stamp(x)).map((x) => x.id)
  const markSeen = useCallback(() => {
    const next = { ...(readSeen() ?? {}), ...Object.fromEntries(list.map((x) => [x.id, stamp(x)])) }
    try {
      localStorage.setItem(SUG_SEEN, JSON.stringify(next))
    } catch {
      /* sem espaço */
    }
    setSeen(next)
  }, [list])
  return { unseen, markSeen }
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
