import { useState } from 'react'
import { ANNUAL_FREE_MONTHS, CYCLES, CYCLE_MONTHS, SEMESTER_DISCOUNT, annualBadge, cardInstallment, cyclePrice, money0 } from '../plans'
import type { Cycle } from '../platform'

/* Mensal, semestral ou anual nos cartões dos planos (página de vendas e minha assinatura).
   A escolha fica guardada e o pagamento já abre no mesmo ciclo. O anual vem escolhido (é o mais vantajoso). */

const KEY = 'ciclo-preferido'
export const preferredCycle = (): Cycle | null => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'anual' || v === 'mensal' || v === 'semestral' ? v : null
  } catch {
    return null
  }
}

export function useCycle(start: Cycle = 'anual'): [Cycle, (c: Cycle) => void] {
  const [cycle, setCycle] = useState<Cycle>(() => preferredCycle() ?? start)
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

const badge = (c: Cycle) => (c === 'anual' ? annualBadge() : c === 'semestral' && SEMESTER_DISCOUNT > 0 ? `${SEMESTER_DISCOUNT}% off` : '')

export function CycleToggle({ value, onChange }: { value: Cycle; onChange: (c: Cycle) => void }) {
  return (
    <div className="cy-toggle" role="radiogroup" aria-label="Forma de assinatura">
      {CYCLES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className={`${value === c ? 'is-on' : ''} ${c === 'anual' ? 'is-best' : ''}`} onClick={() => onChange(c)}>
          <span>{c}</span>
          {badge(c) && <b>{badge(c)}</b>}
        </button>
      ))}
    </div>
  )
}

/** Frase curta embaixo do botão mensal/semestral/anual. */
export const cycleHint = (c: Cycle) =>
  c === 'mensal' ? 'Pix todo mês ou cartão recorrente · cancela quando quiser' : c === 'semestral' ? 'à vista no Pix ou em 6x sem juros no cartão' : `${ANNUAL_FREE_MONTHS > 0 ? `pague ${12 - ANNUAL_FREE_MONTHS} meses e use 12: ` : ''}à vista no Pix ou em 12x sem juros no cartão`

/** Preço do cartão do plano. No anual: 12x sem juros em destaque, o Pix à vista e quanto economiza. */
export function PlanPrice({ price, cycle }: { price: number; cycle: Cycle }) {
  if (cycle === 'anual') {
    const pix = cyclePrice(price, 'anual')
    const saved = Math.round((price * 12 - pix) * 100) / 100
    return (
      <div className="cy-price is-annual">
        {annualBadge() && (
          <span className="cy-save">
            {annualBadge()} · economize {money0(saved)}
          </span>
        )}
        <p className="cy-was">
          de <s>{money0(price)}/mês</s> por
        </p>
        <p className="pf-price">
          <small className="cy-x">12x</small>
          {money0(cardInstallment(price))}
          <small> sem juros</small>
        </p>
        <p className="cy-pix">
          ou <b>{money0(pix)}</b> à vista no Pix
        </p>
      </div>
    )
  }
  if (cycle === 'semestral') {
    const pix = cyclePrice(price, 'semestral')
    const saved = Math.round((price * CYCLE_MONTHS.semestral - pix) * 100) / 100
    return (
      <div className="cy-price is-annual">
        {saved > 0 && (
          <span className="cy-save is-soft">
            {SEMESTER_DISCOUNT}% off · economize {money0(saved)}
          </span>
        )}
        <p className="cy-was">
          de <s>{money0(price)}/mês</s> por
        </p>
        <p className="pf-price">
          <small className="cy-x">6x</small>
          {money0(cardInstallment(price, 'semestral'))}
          <small> sem juros</small>
        </p>
        <p className="cy-pix">
          ou <b>{money0(pix)}</b> à vista no Pix
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
      <p className="cy-note">sem fidelidade{annualBadge() ? ` · no anual, ${annualBadge()}` : ''}</p>
    </div>
  )
}
