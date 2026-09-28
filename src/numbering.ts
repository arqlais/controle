import type { Quote } from './types'

/* Organizar a numeração dos orçamentos sem mexer nos números que o cliente já recebeu:
   - enviados com proposta em PDF: ficam como estão (é o número que está no PDF);
   - enviados sem PDF (mandados direto no WhatsApp): ocupam um número vago que caiba pela data;
   - rascunhos: seguem em ordem de data depois do último número enviado. */

export interface Renumber {
  id: string
  from: number
  to: number
  why: 'vago' | 'rascunho' | 'fim'
}

export function renumberPlan(quotes: Quote[]): Renumber[] {
  const fixed = quotes.filter((q) => q.status !== 'rascunho' && q.pdf && q.number > 0)
  const noPdf = quotes.filter((q) => q.status !== 'rascunho' && !q.pdf).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number)
  const drafts = quotes.filter((q) => q.status === 'rascunho' && !q.imported).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number)
  const used = new Set(fixed.map((q) => q.number))
  const byNumber = [...fixed].sort((a, b) => a.number - b.number)
  const plan: Renumber[] = []
  if (!byNumber.length) {
    // nenhum com PDF ainda: tudo em ordem de data a partir do menor número
    const start = Math.min(...quotes.map((q) => q.number || 1), 1)
    ;[...noPdf, ...drafts].forEach((q, i) => q.number !== start + i && plan.push({ id: q.id, from: q.number, to: start + i, why: q.status === 'rascunho' ? 'rascunho' : 'fim' }))
    return plan
  }
  const min = byNumber[0].number
  const max = byNumber[byNumber.length - 1].number
  // números vagos entre o primeiro e o último enviado com PDF, com a "janela" de datas em que cabem
  const gaps: { n: number; from: string; to: string }[] = []
  for (let n = min + 1; n < max; n++) {
    if (used.has(n)) continue
    // vizinhos diretos: o maior número abaixo e o menor acima (com o mesmo número, vale o intervalo de datas deles)
    const lower = byNumber.filter((q) => q.number < n)
    const upper = byNumber.filter((q) => q.number > n)
    const lowN = lower[lower.length - 1].number
    const upN = upper[0].number
    const from = lower.filter((q) => q.number === lowN).reduce((d, q) => (!d || q.createdAt < d ? q.createdAt : d), '')
    const to = upper.filter((q) => q.number === upN).reduce((d, q) => (q.createdAt > d ? q.createdAt : d), '')
    gaps.push({ n, from: from <= to ? from : to, to: from <= to ? to : from })
  }
  let last = max
  for (const q of noPdf) {
    const gap = gaps.find((g) => !used.has(g.n) && q.createdAt >= g.from && q.createdAt <= g.to)
    const to = gap ? gap.n : q.number > max && !used.has(q.number) ? q.number : ++last
    if (gap) used.add(gap.n)
    else used.add(to)
    last = Math.max(last, to)
    if (to !== q.number) plan.push({ id: q.id, from: q.number, to, why: gap ? 'vago' : 'fim' })
  }
  for (const q of drafts) {
    const to = ++last
    if (to !== q.number) plan.push({ id: q.id, from: q.number, to, why: 'rascunho' })
  }
  return plan
}

/** Rascunhos sempre depois do último número enviado/aprovado, em ordem de data (e pelo número atual no mesmo dia).
 *  Enviados e aprovados nunca mudam. Devolve só os rascunhos que mudam de número. */
export function draftRenumber(quotes: Quote[]): { id: string; number: number }[] {
  // antigos importados contam como número usado (mesmo em rascunho)
  const max = Math.max(0, ...quotes.filter((q) => q.status !== 'rascunho' || q.imported).map((q) => q.number || 0))
  const drafts = quotes.filter((q) => q.status === 'rascunho' && !q.imported).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.number || 0) - (b.number || 0))
  return drafts.map((q, i) => ({ id: q.id, number: max + 1 + i })).filter((r, i) => r.number !== drafts[i].number)
}
