import type { Project, Quote } from './types'
import { DEFAULT_TASKS, addDays, optionTotal, quoteNumber, quoteTotal, splitPayments, today, uid } from './utils'

/** Monta a demanda a partir de um orçamento aprovado (opção escolhida, se houver). */
export function projectFromQuote(q: Quote, urgencyFee: number): Project {
  const chosen = q.options.find((o) => o.id === q.chosenOption)
  const useOption = q.mode === 'opcoes' && chosen
  const firstItem = q.items[0]
  const start = today()
  const deadline = useOption ? chosen.deadlineDays : q.deadlineDays
  const due = addDays(start, Math.round(deadline * 1.4)) // dias úteis → corridos
  const value = useOption ? optionTotal(chosen) : quoteTotal(q, urgencyFee)
  return {
    id: uid(),
    clientId: q.clientId,
    title: q.title || 'Projeto',
    service: (useOption ? chosen.items[0] : firstItem)?.service ?? '',
    quantity: (useOption ? chosen.items[0] : firstItem)?.quantity ?? 1,
    description: useOption
      ? [`Opção ${q.options.indexOf(chosen) + 1}${chosen.name ? ` · ${chosen.name}` : ''}`, ...chosen.items.map((i) => `— ${i.title}${i.detail ? ` · ${i.detail}` : ''}${i.description ? `: ${i.description}` : ''}`)].join('\n')
      : q.items.map((i) => `${i.title}${i.detail ? ` · ${i.detail}` : ''}${i.description ? ` — ${i.description}` : ''}`).join('\n'),
    status: 'briefing',
    priority: q.urgency ? 'urgente' : 'media',
    startDate: start,
    dueDate: due,
    deliveredDate: null,
    value,
    discount: 0,
    payments: splitPayments(value, '50-50', start, due),
    revisionsIncluded: q.revisions,
    revisionsUsed: 0,
    estimatedHours: 0,
    timeLogs: [],
    tasks: DEFAULT_TASKS.map((t) => ({ id: uid(), text: t, done: false })),
    filesLink: '',
    timerStart: null,
    notes: `Criado a partir do orçamento Nº ${quoteNumber(q)}.`,
    createdAt: start,
  }
}
