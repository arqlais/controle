import type { Data, Project, Quote } from './types'
import { BOTH, shownOptions, DEFAULT_TASKS, cleanDetail, comboTotal, isCombo, optionTotal, quoteDeal, quoteNumber, quoteTotal, splitPayments, today, uid, nextQuoteNumber, addDays } from './utils'

/** Monta a demanda a partir de um orçamento aprovado (opção escolhida, se houver). */
/** "O que está incluso" com várias linhas vira subitens embaixo do serviço. */
const sub = (d: string) => (d.trim() ? '\n' + d.split('\n').filter((l) => l.trim()).map((l) => `   · ${l.trim()}`).join('\n') : '')

/** Prazo combinado no fechamento (vazio = sem prazo definido ainda). */
export function projectFromQuote(q: Quote, urgencyFee: number, due = '', closedOn = '', taskList: string[] = DEFAULT_TASKS): Project {
  // propostas fechadas juntas: vira uma demanda só, com os serviços de todas (pacote com o desconto)
  const both = isCombo(q) && q.chosenOption === BOTH
  const pair = shownOptions(q)
  const chosen = both ? { ...pair[0], name: pair.map((o) => o.name).filter(Boolean).join(' + '), items: pair.flatMap((o) => o.items), discount: pair.flatMap((o) => o.items).reduce((n, i) => n + (i.price || 0), 0) - comboTotal(q) } : q.options.find((o) => o.id === q.chosenOption)
  const useOption = q.mode === 'opcoes' && chosen
  const firstItem = q.items[0]
  const start = closedOn || today() // dia em que fechou (orçamentos antigos: a data real)
  const value = q.closedValue && q.closedValue > 0 ? q.closedValue : useOption ? optionTotal(chosen) : quoteTotal(q, urgencyFee)
  // vários serviços com valor → vira pacote (dá para retirar um depois e o desconto se ajusta)
  // serviços cobrados juntos viram uma linha só, com o nome dos dois
  const merged = (useOption ? chosen.items : q.items).reduce<typeof q.items>((acc, i) => {
    const last = acc[acc.length - 1]
    if (i.joined && last) acc[acc.length - 1] = { ...last, title: `${[last.title, cleanDetail(last.detail)].filter(Boolean).join(' · ')} + ${i.title}`, detail: i.detail }
    else acc.push(i)
    return acc
  }, [])
  const lines = merged.filter((i) => i.price > 0)
  const full = lines.reduce((s, i) => s + i.price, 0)
  const asPackage = lines.length > 1 && value <= full
  return {
    ...(asPackage
      ? { items: lines.map((i) => ({ id: uid(), title: [i.title, cleanDetail(i.detail)].filter(Boolean).join(' · '), price: i.price })), pkgDiscount: Math.round((full - value) * 100) / 100 }
      : {}),
    id: uid(),
    clientId: q.clientId,
    title: q.title || 'Projeto',
    service: (useOption ? chosen.items[0] : firstItem)?.service ?? '',
    quantity: (useOption ? chosen.items[0] : firstItem)?.quantity ?? 1,
    description: useOption
      ? [both ? 'Propostas 1 e 2 (fechadas juntas)' : `${q.combo ? 'Proposta' : 'Opção'} ${q.options.indexOf(chosen) + 1}${chosen.name ? ` · ${chosen.name}` : ''}`, ...chosen.items.map((i) => `— ${i.title}${i.detail ? ` · ${i.detail}` : ''}${sub(i.description)}`)].join('\n')
      : q.items.map((i) => `${i.title}${i.detail ? ` · ${i.detail}` : ''}${sub(i.description)}`).join('\n'),
    status: 'briefing',
    priority: q.urgency ? 'urgente' : 'media',
    startDate: start,
    dueDate: due,
    deliveredDate: null,
    value: asPackage ? full : value,
    discount: asPackage ? Math.round((full - value) * 100) / 100 : 0,
    payments: splitPayments(value, '50-50', start, due),
    revisionsIncluded: q.revisions,
    revisionsUsed: 0,
    estimatedHours: 0,
    timeLogs: [],
    tasks: taskList.map((t) => ({ id: uid(), text: t, done: false })),
    filesLink: '',
    timerStart: null,
    notes: `Criado a partir do orçamento Nº ${quoteNumber(q)}.`,
    createdAt: start,
  }
}

/** Cópia do orçamento para outro cliente/projeto: data de hoje, próximo número, rascunho, sem dados do fechamento. */
export function duplicateQuote(q: Quote, d: Data, offset = 0): Quote {
  return {
    ...q,
    id: uid(),
    number: nextQuoteNumber(d) + offset,
    items: q.items.map((i) => ({ ...i, id: uid() })),
    options: q.options.map((o) => ({ ...o, id: uid(), items: o.items.map((i) => ({ ...i, id: uid() })) })),
    chosenOption: '',
    status: 'rascunho',
    sentAt: '',
    createdAt: today(),
    dateFixed: undefined,
    closedAt: undefined,
    closedValue: 0,
    projectId: '',
  }
}

/** Orçamentos aprovados que ainda não entraram no financeiro (sem demanda ligada). */
export const approvedWithoutProject = (d: Data) => d.quotes.filter((q) => q.status === 'aprovado' && q.clientId && !q.projectRemoved && !(q.projectId && d.projects.some((p) => p.id === q.projectId)))

/** Trabalho antigo já feito e pago: vira demanda entregue, com o valor recebido na data em que fechou.
 *  Assim o financeiro (recebido no mês, gráficos, relatórios) passa a contar esse cliente. */
export function launchPaidQuote(q: Quote, urgencyFee: number): { project: Project; quote: Quote } {
  // a data do orçamento (ou a do fechamento, se marcada). Nunca a data em que foi marcado como enviado/aprovado no sistema
  const on = q.closedAt || q.createdAt || today()
  const value = quoteDeal(q, urgencyFee)
  const base = projectFromQuote(q, urgencyFee, on, on)
  const project: Project = {
    ...base,
    status: 'entregue',
    deliveredDate: on,
    tasks: base.tasks.map((t) => ({ ...t, done: true })),
    payments: [{ id: uid(), description: 'Pagamento (trabalho antigo)', amount: Math.round(value * 100) / 100, dueDate: on, paidDate: on, method: 'Pix', on: 'fechamento' }],
    notes: `${base.notes} Lançado como trabalho antigo, já pago.`,
  }
  return { project, quote: { ...q, closedAt: on, projectId: project.id } }
}

/** Trocou a data de um trabalho já lançado: parcelas, entrega e etapas que estavam na data antiga vão para a nova.
 *  Só mexe no que estava exatamente na data antiga (o que a pessoa ajustou à mão fica como está). */
export function moveProjectDate(p: Project, from: string, to: string): Project {
  if (!from || !to || from === to) return p
  const mv = (d?: string | null) => (d === from ? to : d)
  return {
    ...p,
    startDate: mv(p.startDate) ?? p.startDate,
    dueDate: mv(p.dueDate) ?? p.dueDate,
    deliveredDate: mv(p.deliveredDate) ?? p.deliveredDate,
    payments: p.payments.map((x) => ({ ...x, dueDate: mv(x.dueDate) ?? x.dueDate, paidDate: mv(x.paidDate) ?? x.paidDate })),
    phases: p.phases?.map((x) => ({ ...x, due: mv(x.due) ?? x.due, doneAt: mv(x.doneAt) ?? x.doneAt })),
  }
}

/** Orçamentos antigos (sem número) que entraram no financeiro no mês em que foram lançados, e não na data do trabalho.
 *  Sinal: pagamento recebido nos últimos 60 dias, num mês depois do mês do orçamento. A correção leva para a data
 *  do orçamento tudo o que caiu nesses dias de lançamento (pagamentos, fechamento, entrega, etapas). Nada é apagado. */
export function misdatedOldQuotes(d: Data) {
  const recent = addDays(today(), -60)
  const out: { q: Quote; p: Project; fixedQ: Quote; fixedP: Project; from: string[] }[] = []
  for (const q of d.quotes) {
    if (!q.noNumber || q.status !== 'aprovado' || !q.createdAt) continue
    const p = d.projects.find((x) => x.id === q.projectId)
    if (!p) continue
    const work = q.createdAt
    const wrong = (x?: string | null): x is string => !!x && x >= recent && x.slice(0, 7) > work.slice(0, 7)
    if (!p.payments.some((x) => wrong(x.paidDate))) continue
    const fix = (x?: string | null) => (wrong(x) ? work : x)
    const from = [...new Set([...p.payments.flatMap((x) => [x.paidDate, x.dueDate]), p.deliveredDate, q.closedAt].filter(wrong))].sort()
    const fixedP: Project = {
      ...p,
      startDate: fix(p.startDate) ?? p.startDate,
      dueDate: fix(p.dueDate) ?? p.dueDate,
      deliveredDate: fix(p.deliveredDate) ?? p.deliveredDate,
      payments: p.payments.map((x) => ({ ...x, dueDate: fix(x.dueDate) ?? x.dueDate, paidDate: fix(x.paidDate) ?? x.paidDate })),
      phases: p.phases?.map((x) => ({ ...x, due: fix(x.due) ?? x.due, doneAt: fix(x.doneAt) ?? x.doneAt })),
    }
    const fixedQ: Quote = { ...q, closedAt: fix(q.closedAt) ?? q.closedAt, sentAt: fix(q.sentAt) ?? q.sentAt }
    out.push({ q, p, fixedQ, fixedP, from })
  }
  return out
}
