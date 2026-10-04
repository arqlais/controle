import { HAS_CLOUD, SUPA_KEY, SUPA_URL } from './supaConfig'
import { PLANS, setLaunched, setAnnualFreeMonths, setCardFee, setCardFee6, setSemesterDiscount, setTrialDays, type Feature, type PlanId } from './plans'

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
  trialV2?: boolean // já passou para o padrão de 14 dias (antes: 7)
  launched?: boolean // assinaturas abertas (fora do pré-lançamento)
  annualDiscount?: number // antigo: % de desconto no anual (hoje é em meses grátis)
  annualFreeMonths?: number // meses grátis no anual
  cardFee?: number // % da taxa do cartão em 12x, embutida no anual parcelado
  cardFee6?: number // % da taxa do cartão em 6x, embutida no semestral parcelado
  semesterDiscount?: number // % de desconto no semestral
  plans?: Partial<Record<PlanId, PlanOverride>>
}

const NEW_FEATURES: Feature[] = ['briefing', 'cronograma', 'obra', 'lucro', 'portal', 'documentos']
const CACHE = 'config-planos'
export const PREVIEW_KEY = 'previa-config-planos'

/** Depois de salvar no painel: este aparelho já guarda a versão nova (não volta para a antiga ao recarregar). */
export function rememberPlanConfig(c: PlanConfig) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(c))
  } catch {
    /* ok */
  }
}

export function applyPlanConfig(c: PlanConfig) {
  // 7 dias era o padrão antigo: vira 14 até a dona salvar outro número
  if (c.trialDays && c.trialDays > 0) setTrialDays(!c.trialV2 && c.trialDays === 7 ? 14 : Math.round(c.trialDays))
  setLaunched(c.launched === true)
  if (typeof c.annualFreeMonths === 'number' && c.annualFreeMonths >= 0 && c.annualFreeMonths <= 6) setAnnualFreeMonths(c.annualFreeMonths)
  if (typeof c.cardFee === 'number' && c.cardFee >= 0 && c.cardFee <= 40) setCardFee(c.cardFee)
  if (typeof c.cardFee6 === 'number' && c.cardFee6 >= 0 && c.cardFee6 <= 40) setCardFee6(c.cardFee6)
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
    return { trialDays: d.trialDays, trialV2: d.trialV2, launched: d.launched === true, annualFreeMonths: d.annualFreeMonths, cardFee: d.cardFee, cardFee6: d.cardFee6, semesterDiscount: d.semesterDiscount, plans: d.plans }
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
  // a cópia do aparelho abre na hora, mas a versão salva na nuvem sempre vence (lançamento, preços)
  if (cached) applyPlanConfig(cached)
  const c = await fetchConfig(cached ? 1500 : 2000)
  if (c) {
    applyPlanConfig(c)
    save(c)
  }
}
