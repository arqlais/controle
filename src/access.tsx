import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { OWNER_FEATURES, PLANS, type Feature, type Plan } from './plans'
import { onPreviewRole, platform, type AccessInfo } from './platform'
import { ARTIFACT } from './env'

/* O que a conta logada pode usar: a dona tem tudo; cada cliente, o do plano dela.
   Quem decide é a nuvem (tabelas admins/subscriptions), nunca algo que o cliente edite. */

export interface Access extends AccessInfo {
  isOwner: boolean
  plan: Plan | null
  has: (f: Feature) => boolean
  refresh: () => Promise<void>
}

const featuresOf = (i: AccessInfo): Set<Feature> => new Set(i.role === 'dona' ? OWNER_FEATURES : PLANS[i.sub?.plan ?? 'essencial'].features)

const build = (i: AccessInfo, refresh: () => Promise<void>): Access => {
  const f = featuresOf(i)
  return { ...i, isOwner: i.role === 'dona', plan: i.role === 'dona' ? null : PLANS[i.sub?.plan ?? 'essencial'], has: (x) => f.has(x), refresh }
}

// fora do provedor (ex.: telas de teste): comporta-se como hoje, com tudo liberado
const FULL = build({ role: 'dona', sub: null, legacy: true }, async () => undefined)
const Ctx = createContext<Access>(FULL)
export const useAccess = () => useContext(Ctx)

const cacheKey = (userId: string) => `acesso:${userId}`

export function AccessProvider({ userId, plan, children, override }: { userId: string; plan?: string; children: ReactNode; override?: AccessInfo }) {
  const [info, setInfo] = useState<AccessInfo | null>(override ?? null)
  const load = useCallback(async () => {
    if (override) return setInfo(override)
    try {
      const i = await platform.access(plan)
      setInfo(i)
      try {
        localStorage.setItem(cacheKey(userId), JSON.stringify(i))
      } catch {
        /* ok */
      }
    } catch {
      // sem conexão: usa o último acesso conhecido neste aparelho (senão, o plano mais simples)
      let cached: AccessInfo | null = null
      try {
        cached = JSON.parse(localStorage.getItem(cacheKey(userId)) || 'null')
      } catch {
        /* ok */
      }
      if (cached) return setInfo(cached)
      // primeira vez neste aparelho e sem resposta: tenta de novo antes de abrir com o plano mais simples
      await new Promise((r) => setTimeout(r, 2500))
      try {
        const i = await platform.access(plan)
        setInfo(i)
        localStorage.setItem(cacheKey(userId), JSON.stringify(i))
      } catch {
        setInfo({ role: 'cliente', sub: null, legacy: false })
      }
    }
  }, [plan, userId, override])

  useEffect(() => {
    void load()
    platform.touch().catch(() => undefined)
    // volta para a aba: pega mudanças feitas pela dona (plano, bloqueio…)
    const onVisible = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])
  // prévia: "ver como" dona/cliente
  useEffect(() => (ARTIFACT ? onPreviewRole(() => void load()) : undefined), [load])

  const value = useMemo(() => (info ? build(info, load) : null), [info, load])
  if (!value) return <div className="loading-screen" />
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
