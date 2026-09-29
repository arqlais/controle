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

export function renumberPlan(all: Quote[]): Renumber[] {
  const quotes = all.filter((q) => !q.noNumber) // antigos sem número ficam fora da numeração
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

/** Rascunhos sempre depois do último número usado, em ordem de data (e pelo número atual no mesmo dia).
 *  Não mudam: enviados/aprovados, antigos importados e rascunhos com o PDF já baixado (o número já está no PDF).
 *  Devolve só os rascunhos que mudam de número. */
const fixedNumber = (q: Quote) => q.status !== 'rascunho' || !!q.imported || !!q.noNumber || !!q.pdfAt
export function draftRenumber(quotes: Quote[]): { id: string; number: number }[] {
  const max = Math.max(0, ...quotes.filter(fixedNumber).map((q) => q.number || 0))
  const drafts = quotes.filter((q) => !fixedNumber(q)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.number || 0) - (b.number || 0))
  return drafts.map((q, i) => ({ id: q.id, number: max + 1 + i })).filter((r, i) => r.number !== drafts[i].number)
}

/** Número de um orçamento que está saindo do rascunho (enviado/aprovado) ou cujo PDF vai ser baixado:
 *  o próximo depois do último enviado — assim não sobra número vago. Número já acertado fica. */
export function nextSentNumber(quotes: Quote[], q: Quote): number {
  if (q.imported || q.noNumber) return q.number
  const others = quotes.filter((x) => x.id !== q.id && fixedNumber(x))
  const max = Math.max(0, ...others.map((x) => x.number || 0))
  const taken = new Set(others.map((x) => x.number))
  return q.number && q.number <= max + 1 && !taken.has(q.number) ? q.number : max + 1
}

/** Excluir rascunho: os rascunhos com número maior descem para ocupar o lugar dele (nenhum número fica vago).
 *  Enviados, aprovados e importados nunca mudam. */
export function afterDeleteDrafts(quotes: Quote[], removedIds: Set<string>): { id: string; number: number }[] {
  const removed = quotes.filter((q) => removedIds.has(q.id) && q.status === 'rascunho' && !q.imported && !q.noNumber && q.number > 0)
  if (!removed.length) return []
  return quotes
    .filter((q) => !removedIds.has(q.id) && q.status === 'rascunho' && !q.imported && !q.noNumber)
    .map((q) => ({ id: q.id, number: q.number - removed.filter((r) => r.number < q.number).length }))
    .filter((r) => r.number !== quotes.find((q) => q.id === r.id)!.number)
}
