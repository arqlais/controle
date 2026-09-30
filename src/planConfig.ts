import { HAS_CLOUD, SUPA_KEY, SUPA_URL } from './supaConfig'
import { PLANS, setAnnualDiscount, setSemesterDiscount, setTrialDays, type Feature, type PlanId } from './plans'

/* Planos editáveis pela dona no painel (nome, preço, frase, lista e o que cada um libera)
   e os dias de teste. Carregados antes de abrir o site, para a página de vendas já
   mostrar os valores certos. Sem conexão, usa a última versão salva neste aparelho. */

export interface PlanOverride {
  name?: string
  price?: number
  pitch?: string
  highlights?: string[]
  features?: Feature[]
  decided?: Feature[] // o que a dona já viu na lista (funções novas que ela ainda não viu seguem o padrão)
}
export interface PlanConfig {
  trialDays?: number
  annualDiscount?: number // % de desconto no anual
  semesterDiscount?: number // % de desconto no semestral
  plans?: Partial<Record<PlanId, PlanOverride>>
}

const NEW_FEATURES: Feature[] = ['briefing', 'cronograma', 'obra', 'lucro', 'portal', 'documentos']
const CACHE = 'config-planos'
export const PREVIEW_KEY = 'previa-config-planos'

export function applyPlanConfig(c: PlanConfig) {
  if (c.trialDays && c.trialDays > 0) setTrialDays(Math.round(c.trialDays))
  if (typeof c.annualDiscount === 'number' && c.annualDiscount >= 0 && c.annualDiscount <= 50) setAnnualDiscount(c.annualDiscount)
  if (typeof c.semesterDiscount === 'number' && c.semesterDiscount >= 0 && c.semesterDiscount <= 50) setSemesterDiscount(c.semesterDiscount)
  for (const id of Object.keys(PLANS) as PlanId[]) {
    const o = c.plans?.[id]
    if (!o) continue
    const p = PLANS[id]
    if (o.name?.trim()) p.name = o.name.trim()
    if (typeof o.price === 'number' && o.price > 0) p.price = o.price
    if (o.pitch !== undefined) p.pitch = o.pitch
    if (o.highlights?.length) p.highlights = o.highlights.filter((h) => h.trim())
    // o chat com a administração fica sempre ligado
    if (o.features) {
      // função lançada depois que a dona salvou os planos: segue o padrão do plano até ela decidir
      const fresh = p.features.filter((f) => !o.features!.includes(f) && !(o.decided ?? []).includes(f) && NEW_FEATURES.includes(f))
      p.features = [...new Set<Feature>(['chatDona', ...o.features, ...fresh])]
    }
  }
}

const read = (k: string): PlanConfig | null => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null')
  } catch {
    return null
  }
}

async function fetchConfig(timeoutMs: number): Promise<PlanConfig | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/platform_settings?id=eq.1&select=data`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }, signal: ctrl.signal })
    if (!r.ok) return null
    const rows = (await r.json()) as { data?: PlanConfig }[]
    const d = rows[0]?.data ?? {}
    return { trialDays: d.trialDays, annualDiscount: d.annualDiscount, semesterDiscount: d.semesterDiscount, plans: d.plans }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** Já visitou antes: abre na hora com a última versão salva e atualiza em segundo plano.
 *  Primeira visita: espera no máximo 1,5 s pelos planos (preço certo na página de vendas). */
export async function loadPlanConfig() {
  if (!HAS_CLOUD) {
    const c = read(PREVIEW_KEY)
    if (c) applyPlanConfig(c)
    return
  }
  const cached = read(CACHE)
  const save = (c: PlanConfig | null) => {
    if (!c) return
    try {
      localStorage.setItem(CACHE, JSON.stringify(c))
    } catch {
      /* ok */
    }
  }
  if (cached) {
    applyPlanConfig(cached)
    void fetchConfig(8000).then(save)
    return
  }
  const c = await fetchConfig(1500)
  if (c) {
    applyPlanConfig(c)
    save(c)
  }
}
