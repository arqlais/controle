import { ARTIFACT } from './env'

// Projeto da Laís. A chave "publishable" é pública por natureza (vai no navegador);
// quem protege os dados é o login + as regras de acesso (RLS) do supabase/schema.sql.
// As variáveis de ambiente, se existirem, têm prioridade.
export const SUPA_URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://lbggvjebkhdcybpkxzxs.supabase.co').replace(/\/$/, '')
export const SUPA_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_uqo6nAVMS7iZsidCPNQRhg_YA9RNaYA'
export const HAS_CLOUD = !ARTIFACT && !!SUPA_URL && !!SUPA_KEY
