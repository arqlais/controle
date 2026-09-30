import { useCallback, useEffect, useRef } from 'react'
import { CLOUD, supabase } from './cloud'
import { useStore } from './store'
import { toast } from './components/dialog'
import { notifyDevice } from './briefingSync'
import { checkSignMessage } from './contractSign'
import type { Notice } from './types'
import { today, uid } from './utils'

/* Avisos do cliente final para o profissional: assinatura de contrato e recado pelo painel.
   A página pública (sem login) manda para a função "avisos": ela guarda o aviso, manda o e-mail
   para o profissional e uma cópia para o cliente. O sistema aberto lê, registra e mostra na central. */

export interface ClientEvent {
  user: string // conta do profissional
  kind: 'assinatura' | 'recado'
  ref: string // o que é (token do contrato, id do recado): não repete
  cliente: string
  titulo: string
  texto?: string
  code?: string // assinatura: o código que confere com o texto do contrato
  clienteEmail?: string
  painel?: string // token do painel (recados)
  studio?: string
}

const LOCAL = 'avisos-de-clientes'
type Row = { id: string | number; kind: string; ref: string; payload: { cliente?: string; titulo?: string; texto?: string; code?: string; painel?: string; contato?: string }; created_at: string }

/** Manda o aviso (página pública). Sem nuvem (prévia), fica neste navegador. Nunca trava a página. */
export async function avisar(ev: ClientEvent): Promise<boolean> {
  if (CLOUD && ev.user) {
    try {
      const { error } = await supabase!.functions.invoke('avisos', { body: { tipo: 'cliente', ...ev } })
      return !error
    } catch {
      return false
    }
  }
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL) || '[]') as Row[]
    if (!all.some((r) => r.kind === ev.kind && r.ref === ev.ref)) {
      all.push({ id: uid(), kind: ev.kind, ref: ev.ref, payload: { cliente: ev.cliente, titulo: ev.titulo, texto: ev.texto, code: ev.code, painel: ev.painel, contato: ev.clienteEmail }, created_at: new Date().toISOString() })
      localStorage.setItem(LOCAL, JSON.stringify(all.slice(-50)))
    }
    return true
  } catch {
    return false
  }
}

async function pending(userId: string): Promise<Row[]> {
  if (CLOUD && userId) {
    const { data, error } = await supabase!.from('client_events').select('id, kind, ref, payload, created_at').eq('user_id', userId).is('seen_at', null).order('created_at').limit(50)
    return error ? [] : ((data ?? []) as Row[])
  }
  try {
    return JSON.parse(localStorage.getItem(LOCAL) || '[]') as Row[]
  } catch {
    return []
  }
}

async function markSeen(userId: string, rows: Row[]) {
  if (!rows.length) return
  if (CLOUD && userId) {
    await supabase!
      .from('client_events')
      .update({ seen_at: new Date().toISOString() })
      .in(
        'id',
        rows.map((r) => r.id),
      )
    return
  }
  const ids = new Set(rows.map((r) => r.id))
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL) || '[]') as Row[]
    localStorage.setItem(LOCAL, JSON.stringify(all.filter((r) => !ids.has(r.id))))
  } catch {
    /* nada */
  }
}

/** Cria um aviso na central (uma vez por `ref`). */
export function makeNotice(n: Omit<Notice, 'id' | 'at'>): Notice {
  return { id: uid(), at: new Date().toISOString(), ...n }
}

/** Lê os avisos que chegaram dos clientes (ao abrir, ao voltar para a aba e de tempos em tempos). */
export function useClientInbox(enabled: boolean) {
  const { data, upsert, userId } = useStore()
  const check = useCallback(async () => {
    const rows = await pending(userId).catch(() => [] as Row[])
    if (!rows.length) return
    const d = data
    const seen = new Set((d.notices ?? []).map((n) => n.ref).filter(Boolean))
    const done: Row[] = []
    for (const r of rows) {
      const key = `${r.kind}:${r.ref}`
      if (seen.has(key)) {
        done.push(r)
        continue
      }
      const p = r.payload ?? {}
      if (r.kind === 'assinatura') {
        const c = (d.contracts ?? []).find((x) => x.signToken === r.ref)
        if (!c) continue // contrato de outro aparelho ainda não sincronizado: tenta depois
        const client = d.clients.find((x) => x.id === c.clientId)
        const res = c.sign ? { sign: c.sign } : await checkSignMessage(`código da assinatura: ${p.code ?? ''}`, c.signToken, c.body)
        if (res.sign && !c.sign) upsert('contracts', { ...c, sign: res.sign, status: 'assinado' })
        const ok = !!res.sign
        upsert(
          'notices',
          makeNotice({
            kind: 'assinatura',
            ref: key,
            clientId: c.clientId,
            link: `contratos/${c.id}`,
            title: ok ? `${client?.name ?? p.cliente ?? 'Cliente'} assinou o contrato` : `Assinatura de ${p.cliente || 'cliente'} não confere`,
            text: ok ? `“${c.title}” já está como assinado, com o certificado no PDF.` : 'O texto do contrato mudou depois do envio. Mande o link de novo para assinar a versão atual.',
          }),
        )
        if (ok) {
          toast(`${client?.name.split(' ')[0] ?? 'O cliente'} assinou o contrato`)
          notifyDevice(`${client?.name ?? 'Cliente'} assinou o contrato`, `“${c.title}” está assinado.`)
        }
      } else if (r.kind === 'recado') {
        const client = d.clients.find((x) => x.panel?.token === p.painel)
        if (client) upsert('clients', { ...client, history: [...client.history, { id: uid(), date: today(), text: `recado pelo painel: ${p.texto ?? ''}` }] })
        upsert('notices', makeNotice({ kind: 'recado', ref: key, clientId: client?.id, link: client ? `clientes/${client.id}` : undefined, title: `Recado de ${client?.name ?? p.cliente ?? 'cliente'}`, text: p.texto }))
        toast(`Recado novo de ${client?.name.split(' ')[0] ?? p.cliente ?? 'cliente'}`)
        notifyDevice(`Recado de ${client?.name ?? p.cliente ?? 'cliente'}`, p.texto ?? '')
      }
      done.push(r)
    }
    await markSeen(userId, done).catch(() => undefined)
  }, [data, upsert, userId])
  const latest = useRef(check)
  latest.current = check
  useEffect(() => {
    if (!enabled) return
    const run = () => void latest.current()
    const first = setTimeout(run, 1500) // deixa os dados da nuvem chegarem antes
    const iv = setInterval(run, 3 * 60_000)
    const onVis = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(first)
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled])
  return { check: () => latest.current() }
}
