import type { Client, Data } from './types'

/* Clientes duplicados (ex.: "Natasha Vieia" e "Natasha Vieira"): acha nomes quase iguais
   e junta os dois num só, levando orçamentos, demandas e anotações. */

export const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return row[b.length]
}

/** Mesmo nome com um erro de digitação (Vieia × Vieira), sem acento ou com espaço a mais. */
export function similarName(a: string, b: string) {
  const x = normName(a)
  const y = normName(b)
  if (!x || !y) return false
  if (x === y) return true
  const wa = x.split(' ')
  const wb = y.split(' ')
  // precisa ter nome e sobrenome parecidos, não só o primeiro nome
  if (wa.length < 2 || wb.length < 2 || wa[0] !== wb[0]) return false
  const min = Math.min(x.length, y.length)
  return distance(x, y) <= (min >= 12 ? 2 : 1)
}

/** Pares de clientes que parecem a mesma pessoa. */
export function duplicatePairs(clients: Client[]): [Client, Client][] {
  const list = clients.filter((c) => !c.archived)
  const pairs: [Client, Client][] = []
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) if (similarName(list[i].name, list[j].name)) pairs.push([list[i], list[j]])
  return pairs
}

/** Junta `dropId` em `keepId`: tudo do outro vem para este, e o outro é apagado. */
export function mergeClients(data: Data, keepId: string, dropId: string, name?: string): Data {
  const keep = data.clients.find((c) => c.id === keepId)
  const drop = data.clients.find((c) => c.id === dropId)
  if (!keep || !drop || keep.id === drop.id) return data
  const fill = <K extends keyof Client>(k: K) => ((keep[k] as unknown as string)?.trim?.() ? keep[k] : drop[k])
  const merged: Client = {
    ...keep,
    name: name?.trim() || keep.name,
    company: fill('company'),
    email: fill('email'),
    phone: fill('phone'),
    instagram: fill('instagram'),
    city: fill('city'),
    document: fill('document'),
    origin: fill('origin'),
    notes: [keep.notes, drop.notes].map((n) => n.trim()).filter(Boolean).filter((n, i, a) => a.indexOf(n) === i).join('\n'),
    favorite: keep.favorite || drop.favorite,
    history: [...keep.history, ...drop.history].sort((a, b) => (a.date < b.date ? 1 : -1)),
    createdAt: keep.createdAt < drop.createdAt ? keep.createdAt : drop.createdAt,
  }
  return {
    ...data,
    clients: data.clients.filter((c) => c.id !== dropId).map((c) => (c.id === keepId ? merged : c)),
    projects: data.projects.map((p) => (p.clientId === dropId ? { ...p, clientId: keepId } : p)),
    quotes: data.quotes.map((q) => (q.clientId === dropId ? { ...q, clientId: keepId } : q)),
  }
}
