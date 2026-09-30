import { useCallback, useEffect, useMemo } from 'react'
import { useStore } from './store'
import { toast } from './components/dialog'
import { fetchAnswers } from './briefingApi'
import type { Briefing, BriefingAnswers, Client, ClientProfile, Data } from './types'
import { today, uid } from './utils'

/* Respostas de briefing que chegam enquanto o sistema está aberto (fica fora da tela de briefing
   para não pesar o carregamento). */

const answerText = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : (v ?? '')).trim()

/** Aplica as respostas: preenche o que estiver vazio na ficha e anota no histórico. */
export function applyAnswers(client: Client, b: Briefing, answers: BriefingAnswers): Client {
  const profile: ClientProfile = { ...client.profile }
  for (const q of b.questions) {
    const v = answerText(answers[q.id])
    if (q.field && q.kind !== 'photos' && v && !(profile[q.field] ?? '').trim()) profile[q.field] = v
  }
  return { ...client, profile, history: [...client.history, { id: uid(), date: today(), text: `briefing respondido: ${b.title}` }] }
}

/** Confere se chegaram respostas (ao abrir o sistema e de tempos em tempos). */
export function useBriefingSync(enabled: boolean) {
  const { data, upsert } = useStore()
  const pending = useMemo(() => (data.briefings ?? []).filter((b) => b.status === 'enviado'), [data.briefings])
  const check = useCallback(
    async (list: Briefing[], d: Data) => {
      if (!list.length) return
      try {
        const got = await fetchAnswers(list.map((b) => b.id))
        for (const b of list) {
          const r = got[b.id]
          if (!r) continue
          upsert('briefings', { ...b, status: 'respondido', answers: r.answers, answeredAt: r.answeredAt })
          const c = d.clients.find((x) => x.id === b.clientId)
          if (c) upsert('clients', applyAnswers(c, b, r.answers))
          toast(`${c?.name.split(' ')[0] ?? 'O cliente'} respondeu o briefing`)
          notifyDevice(`${c?.name ?? 'Cliente'} respondeu o briefing`, `“${b.title}” já está na ficha do cliente.`)
        }
      } catch {
        /* sem conexão: tenta depois */
      }
    },
    [upsert],
  )
  const ids = pending.map((b) => b.id).join(',')
  useEffect(() => {
    if (!enabled || !ids) return
    void check(pending, data)
    const iv = setInterval(() => void check(pending, data), 5 * 60_000)
    const onVis = () => document.visibilityState === 'visible' && void check(pending, data)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ids, check])
  return { check: () => check(pending, data) }
}


/** Aviso do aparelho (celular/computador), quando a pessoa permitiu. */
export function notifyDevice(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icon-192.png` })
  } catch {
    /* sem suporte */
  }
}

/** Pede permissão para avisar quando um cliente responder (uma vez, ao mandar o primeiro briefing). */
export function askNotifyPermission() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission()
  } catch {
    /* sem suporte */
  }
}
