import { useState } from 'react'
import { CYCLES, CYCLE_INSTALLMENTS, CYCLE_MONTHS, CYCLE_UNIT, cycleDiscount, cycleMonthly, cyclePrice, money0 } from '../plans'
import type { Cycle } from '../platform'

/* Mensal ou anual nos cartões dos planos (página de vendas e minha assinatura).
   A escolha fica guardada e o pagamento já abre no mesmo ciclo. */

const KEY = 'ciclo-preferido'
export const preferredCycle = (): Cycle | null => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'anual' || v === 'mensal' || v === 'semestral' ? v : null
  } catch {
    return null
  }
}

export function useCycle(): [Cycle, (c: Cycle) => void] {
  const [cycle, setCycle] = useState<Cycle>(() => preferredCycle() ?? 'mensal')
  const set = (c: Cycle) => {
    setCycle(c)
    try {
      localStorage.setItem(KEY, c)
    } catch {
      /* sem espaço */
    }
  }
  return [cycle, set]
}

export function CycleToggle({ value, onChange }: { value: Cycle; onChange: (c: Cycle) => void }) {
  return (
    <div className="cy-toggle" role="radiogroup" aria-label="Forma de assinatura">
      {CYCLES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className={value === c ? 'is-on' : ''} onClick={() => onChange(c)}>
          {c} {cycleDiscount(c) > 0 && <b>{cycleDiscount(c)}% off</b>}
        </button>
      ))}
    </div>
  )
}

/** Frase curta embaixo do botão mensal/semestral/anual. */
export const cycleHint = (c: Cycle) => (c === 'mensal' ? 'paga mês a mês, cancela quando quiser' : `Pix à vista ou em até ${CYCLE_INSTALLMENTS[c]}x no cartão`)

/** Preço do cartão: no semestral e no anual, o valor por mês e o total do período. */
export function PlanPrice({ price, cycle }: { price: number; cycle: Cycle }) {
  if (cycle !== 'mensal') {
    const total = cyclePrice(price, cycle)
    const saved = Math.round((price * CYCLE_MONTHS[cycle] - total) * 100) / 100
    return (
      <div className="cy-price">
        <p className="pf-price">
          {money0(cycleMonthly(price, cycle))}
          <small>/mês</small>
        </p>
        <p className="cy-note">
          {money0(total)} por {CYCLE_UNIT[cycle]}
          {saved > 0 ? ` · economiza ${money0(saved)}` : ''}
        </p>
      </div>
    )
  }
  return (
    <div className="cy-price">
      <p className="pf-price">
        {money0(price)}
        <small>/mês</small>
      </p>
      <p className="cy-note">sem fidelidade{cycleDiscount('anual') > 0 ? ` · no anual sai ${money0(cycleMonthly(price, 'anual'))}/mês` : ''}</p>
    </div>
  )
}
