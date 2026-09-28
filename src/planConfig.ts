import { supabase } from './cloud'
import { ARTIFACT } from './env'
import { PLANS, setAnnualDiscount, setTrialDays, type Feature, type PlanId } from './plans'

/* Planos editáveis pela dona no painel (nome, preço, frase, lista e o que cada um libera)
   e os dias de teste. Carregados antes de abrir o site, para a página de vendas já
   mostrar os valores certos. Sem conexão, usa a última versão salva neste aparelho. */

export interface PlanOverride {
  name?: string
  price?: number
  pitch?: string
  highlights?: string[]
  features?: Feature[]
}
export interface PlanConfig {
  trialDays?: number
  annualDiscount?: number // % de desconto no anual
  plans?: Partial<Record<PlanId, PlanOverride>>
}

const CACHE = 'config-planos'
export const PREVIEW_KEY = 'previa-config-planos'

export function applyPlanConfig(c: PlanConfig) {
  if (c.trialDays && c.trialDays > 0) setTrialDays(Math.round(c.trialDays))
  if (typeof c.annualDiscount === 'number' && c.annualDiscount >= 0 && c.annualDiscount <= 50) setAnnualDiscount(c.annualDiscount)
  for (const id of Object.keys(PLANS) as PlanId[]) {
    const o = c.plans?.[id]
    if (!o) continue
    const p = PLANS[id]
    if (o.name?.trim()) p.name = o.name.trim()
    if (typeof o.price === 'number' && o.price > 0) p.price = o.price
    if (o.pitch !== undefined) p.pitch = o.pitch
    if (o.highlights?.length) p.highlights = o.highlights.filter((h) => h.trim())
    // o chat com a administração fica sempre ligado
    if (o.features) p.features = [...new Set<Feature>(['chatDona', ...o.features])]
  }
}

const read = (k: string): PlanConfig | null => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null')
  } catch {
    return null
  }
}

export async function loadPlanConfig() {
  if (ARTIFACT || !supabase) {
    const c = read(PREVIEW_KEY)
    if (c) applyPlanConfig(c)
    return
  }
  const cached = read(CACHE)
  try {
    const q = supabase.from('platform_settings').select('data').eq('id', 1).maybeSingle()
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 2500))
    const res = await Promise.race([q, timeout])
    if (!res) {
      if (cached) applyPlanConfig(cached)
      return
    }
    const d = (res.data?.data ?? {}) as PlanConfig
    const c: PlanConfig = { trialDays: d.trialDays, annualDiscount: d.annualDiscount, plans: d.plans }
    applyPlanConfig(c)
    try {
      localStorage.setItem(CACHE, JSON.stringify(c))
    } catch {
      /* ok */
    }
  } catch {
    if (cached) applyPlanConfig(cached)
  }
}
