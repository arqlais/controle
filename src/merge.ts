/* Junta duas versões da conta que mudaram ao mesmo tempo (ex.: celular e notebook abertos).
   base = a última versão que os dois conheciam; mine = este aparelho; theirs = o que está na nuvem.
   Regra: o que só um lado mudou, vale o que mudou. Se os dois mudaram o mesmo item, vale este aparelho
   (é o que a pessoa está vendo na tela). Listas com id (clientes, demandas, orçamentos…) se juntam item a item. */

type Obj = Record<string, unknown>

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const hasIds = (v: unknown): v is { id: string }[] => Array.isArray(v) && v.length > 0 && v.every((x) => isObj(x) && typeof x.id === 'string')

function mergeList(base: { id: string }[], mine: { id: string }[], theirs: { id: string }[]) {
  const b = new Map(base.map((x) => [x.id, x]))
  const m = new Map(mine.map((x) => [x.id, x]))
  const out: { id: string }[] = []
  const used = new Set<string>()
  // ordem da nuvem, depois o que é novo aqui
  for (const t of theirs) {
    const old = b.get(t.id)
    const mi = m.get(t.id)
    used.add(t.id)
    if (!mi) {
      // não está aqui: apagado aqui (se existia na base e a nuvem não mexeu) ou novo de lá
      if (old && same(old, t)) continue
      out.push(t)
      continue
    }
    out.push(old && same(old, mi) ? t : mi)
  }
  for (const mi of mine) {
    if (used.has(mi.id)) continue
    const old = b.get(mi.id)
    // existia na base e sumiu da nuvem: foi apagado lá; só volta se foi mexido aqui
    if (old && same(old, mi)) continue
    out.push(mi)
  }
  return out
}

export function merge3<T>(base: T, mine: T, theirs: T): T {
  if (same(mine, theirs)) return mine
  if (same(base, mine)) return theirs
  if (same(base, theirs)) return mine
  const listLike = (v: unknown) => v === undefined || (Array.isArray(v) && (v.length === 0 || hasIds(v)))
  if (Array.isArray(mine) || Array.isArray(theirs)) {
    if (listLike(base) && listLike(mine) && listLike(theirs) && (hasIds(mine) || hasIds(theirs)))
      return mergeList((base as { id: string }[]) ?? [], (mine as { id: string }[]) ?? [], (theirs as { id: string }[]) ?? []) as T
    // lista simples (ex.: ids apagados): junta sem repetir
    if (Array.isArray(mine) && Array.isArray(theirs) && [...mine, ...theirs].every((x) => typeof x === 'string')) return [...new Set([...theirs, ...mine])] as T
    return mine
  }
  if (isObj(mine) && isObj(theirs)) {
    const b: Obj = isObj(base) ? base : {}
    const out: Obj = {}
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const v = merge3(b[k], mine[k], theirs[k])
      if (v !== undefined) out[k] = v
    }
    return out as T
  }
  return mine
}
