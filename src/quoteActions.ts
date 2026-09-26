import type { Project, Quote } from './types'
import { DEFAULT_TASKS, cleanDetail, optionTotal, quoteNumber, quoteTotal, splitPayments, today, uid } from './utils'

/** Monta a demanda a partir de um orçamento aprovado (opção escolhida, se houver). */
/** "O que está incluso" com várias linhas vira subitens embaixo do serviço. */
const sub = (d: string) => (d.trim() ? '\n' + d.split('\n').filter((l) => l.trim()).map((l) => `   · ${l.trim()}`).join('\n') : '')

/** Prazo combinado no fechamento (vazio = sem prazo definido ainda). */
export function projectFromQuote(q: Quote, urgencyFee: number, due = ''): Project {
  const chosen = q.options.find((o) => o.id === q.chosenOption)
  const useOption = q.mode === 'opcoes' && chosen
  const firstItem = q.items[0]
  const start = today()
  const value = q.closedValue && q.closedValue > 0 ? q.closedValue : useOption ? optionTotal(chosen) : quoteTotal(q, urgencyFee)
  // vários serviços com valor → vira pacote (dá para retirar um depois e o desconto se ajusta)
  const lines = (useOption ? chosen.items : q.items).filter((i) => i.price > 0)
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
      ? [`Opção ${q.options.indexOf(chosen) + 1}${chosen.name ? ` · ${chosen.name}` : ''}`, ...chosen.items.map((i) => `— ${i.title}${i.detail ? ` · ${i.detail}` : ''}${sub(i.description)}`)].join('\n')
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
    tasks: DEFAULT_TASKS.map((t) => ({ id: uid(), text: t, done: false })),
    filesLink: '',
    timerStart: null,
    notes: `Criado a partir do orçamento Nº ${quoteNumber(q)}.`,
    createdAt: start,
  }
}
