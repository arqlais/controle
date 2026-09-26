import { createClient } from '@supabase/supabase-js'
import { ARTIFACT } from './env'
import type { Data } from './types'

/* Nuvem (Supabase): login com e-mail e senha + os dados guardados numa
   única linha por usuária, protegida por RLS (só a dona lê e escreve).
   Sem as variáveis de ambiente, o sistema funciona só no navegador. */

// Projeto da Laís. A chave "publishable" é pública por natureza (vai no navegador);
// quem protege os dados é o login + as regras de acesso (RLS) do supabase/schema.sql.
// As variáveis de ambiente, se existirem, têm prioridade.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://lbggvjebkhdcybpkxzxs.supabase.co'
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_uqo6nAVMS7iZsidCPNQRhg_YA9RNaYA'

export const SUPABASE_URL = (url ?? '').replace(/\/$/, '')
export const CLOUD = !ARTIFACT && !!url && !!key
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
