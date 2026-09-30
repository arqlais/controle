import { useState } from 'react'
import { ANNUAL_DISCOUNT, annualPrice, money0 } from '../plans'
import type { Cycle } from '../platform'

/* Mensal ou anual nos cartões dos planos (página de vendas e minha assinatura).
   A escolha fica guardada e o pagamento já abre no mesmo ciclo. */

const KEY = 'ciclo-preferido'
export const preferredCycle = (): Cycle | null => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'anual' || v === 'mensal' ? v : null
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
      <button type="button" role="radio" aria-checked={value === 'mensal'} className={value === 'mensal' ? 'is-on' : ''} onClick={() => onChange('mensal')}>
        mensal
      </button>
      <button type="button" role="radio" aria-checked={value === 'anual'} className={value === 'anual' ? 'is-on' : ''} onClick={() => onChange('anual')}>
        anual {ANNUAL_DISCOUNT > 0 && <b>{ANNUAL_DISCOUNT}% off</b>}
      </button>
    </div>
  )
}

/** Preço do cartão: no anual, o valor por mês e o total do ano. */
export function PlanPrice({ price, cycle }: { price: number; cycle: Cycle }) {
  const year = annualPrice(price)
  if (cycle === 'anual')
    return (
      <div className="cy-price">
        <p className="pf-price">
          {money0(Math.round((year / 12) * 100) / 100)}
          <small>/mês</small>
        </p>
        <p className="cy-note">
          {money0(year)} por ano, à vista{ANNUAL_DISCOUNT > 0 ? ` · economiza ${money0(Math.round((price * 12 - year) * 100) / 100)}` : ''}
        </p>
      </div>
    )
  return (
    <div className="cy-price">
      <p className="pf-price">
        {money0(price)}
        <small>/mês</small>
      </p>
      <p className="cy-note">sem fidelidade{ANNUAL_DISCOUNT > 0 ? ` · no anual sai ${money0(Math.round((year / 12) * 100) / 100)}/mês` : ''}</p>
    </div>
  )
}
