import { createClient } from '@supabase/supabase-js'
import { HAS_CLOUD, SUPA_KEY, SUPA_URL } from './supaConfig'
import type { Data } from './types'

/* Nuvem (Supabase): login com e-mail e senha + os dados guardados numa
   única linha por usuária, protegida por RLS (só a dona lê e escreve).
   Sem as variáveis de ambiente, o sistema funciona só no navegador. */

const url = SUPA_URL
const key = SUPA_KEY

export const SUPABASE_URL = url
export const CLOUD = HAS_CLOUD
export const supabase = CLOUD ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } }) : null

const TABLE = 'workspace'

export async function fetchRemote(userId: string): Promise<{ data: Data; updatedAt: string } | null> {
  const { data, error } = await supabase!.from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data ? { data: data.data as Data, updatedAt: data.updated_at as string } : null
}

export async function pushRemote(userId: string, payload: Data): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { error } = await supabase!.from(TABLE).upsert({ user_id: userId, data: payload, updated_at: updatedAt })
  if (error) throw error
  return updatedAt
}

/* Agenda do celular: o sistema publica um arquivo .ics (formato de calendário) no
   Storage do Supabase, num endereço secreto. O iPhone, o Google Agenda e outros
   "assinam" esse endereço e buscam as novidades sozinhos. Nada de servidor extra:
   basta o bucket "agenda" criado pelo supabase/schema.sql. */
const BUCKET = 'agenda'
const agendaPath = (userId: string, token: string) => `${userId}/${token}.ics`
export const agendaUrl = (userId: string, token: string) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${agendaPath(userId, token)}`

/** Publica (ou apaga, sem token) a agenda da usuária. Remove links antigos. */
export async function publishAgenda(userId: string, token: string, ics: string) {
  const st = supabase!.storage.from(BUCKET)
  const { data: files, error: listError } = await st.list(userId)
  if (listError) throw listError
  const old = (files ?? []).filter((f) => f.name !== `${token}.ics`).map((f) => `${userId}/${f.name}`)
  if (old.length) await st.remove(old)
  if (!token) return
  const { error } = await st.upload(agendaPath(userId, token), new Blob([ics], { type: 'text/calendar' }), {
    upsert: true,
    contentType: 'text/calendar; charset=utf-8',
    cacheControl: '60',
  })
  if (error) throw error
}
