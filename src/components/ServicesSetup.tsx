import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ServiceDef, WorkProfile } from '../types'
import { Icon } from './Icon'
import { HowPicker, OwnService, PriceFields, SuggestPicker, fromSuggestion, kindsFor, withPricing } from './PriceTable'
import { WORK_PROFILES } from '../clientDefaults'
import { uid } from '../utils'

/* Primeiro passo de quem começa: dizer o que faz e quanto cobra. É obrigatório porque é o que faz
   o orçamento sair sozinho. Três telas curtas: para quem trabalha → o que faz → quanto cobra. */

const PROFILE_ICON: Record<WorkProfile, string> = { freelancer: 'briefcase', final: 'home', ambos: 'users' }
const STEPS = ['para quem', 'o que você faz', 'quanto cobra']

export function ServicesSetup({ initialProfile, onDone, onLater }: { initialProfile?: WorkProfile; onDone: (services: ServiceDef[], profile: WorkProfile) => void; onLater?: () => void }) {
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<WorkProfile | undefined>(initialProfile)
  const [picked, setPicked] = useState<ServiceDef[]>([])
  const toggle = (x: ServiceDef) => setPicked((l) => (l.some((y) => y.id === x.id) ? l.filter((y) => y.id !== x.id) : [...l, fromSuggestion(x)]))
  const set = (id: string, patch: Partial<ServiceDef>) => setPicked((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const canNext = step === 0 ? !!profile : step === 1 ? picked.length > 0 : true
  const finish = () => {
    const p = profile ?? 'freelancer'
    // "serviço personalizado" sempre no fim: para o que não está na tabela
    const extra: ServiceDef = { id: 'personalizado', name: 'serviço personalizado', unit: 'projeto', pricing: 'livre', price: 0, min: 0, hours: 0, tiers: [], ...(p !== 'freelancer' ? { group: 'outros', audience: 'ambos' as const } : {}) }
    onDone([...picked.filter((x) => x.id !== 'personalizado'), extra], p)
  }
  return createPortal(
    <div className="ss" role="dialog" aria-modal aria-label="Seus serviços e preços">
      <div className="ss-box">
        <header className="ss-head">
          <p className="eyebrow">primeiro passo · leva 2 minutos</p>
          <h2>
            {step === 0 ? (
              <>
                para quem você <em>trabalha?</em>
              </>
            ) : step === 1 ? (
              <>
                o que você <em>faz?</em>
              </>
            ) : (
              <>
                quanto você <em>cobra?</em>
              </>
            )}
          </h2>
          <p className="muted">
            {step === 0
              ? 'Assim o sistema já sugere os serviços e o tipo de orçamento certo para você.'
              : step === 1
                ? 'Toque nos serviços que você faz. Não achou? Crie o seu logo abaixo.'
                : 'Escolha como cobra cada serviço e coloque o valor. Os valores já vêm com uma sugestão: é só ajustar.'}
          </p>
          <ol className="ss-steps" aria-label="Etapas">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? 'is-on' : i < step ? 'is-done' : ''}>
                <span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </header>

        <div className="ss-body">
          {step === 0 && (
            <div className="ss-profiles">
              {WORK_PROFILES.map((w) => (
                <button key={w.value} type="button" className={`ss-profile ${profile === w.value ? 'is-on' : ''}`} aria-pressed={profile === w.value} onClick={() => setProfile(w.value)}>
                  <span className="ss-profile-ico">
                    <Icon name={PROFILE_ICON[w.value]} size={22} />
                  </span>
                  <b>{w.label}</b>
                  <small>{w.hint}</small>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <>
              <SuggestPicker kinds={kindsFor(profile)} picked={picked} onToggle={toggle} />
              <OwnService onAdd={(list) => setPicked((l) => [...l, ...list.map((x) => ({ ...x, id: uid(), ...(profile === 'ambos' ? { audience: 'ambos' as const } : profile === 'final' ? { audience: 'final' as const } : {}) }))])} />
              {picked.length > 0 && (
                <p className="ss-count">
                  <Icon name="check" size={14} /> {picked.length} {picked.length === 1 ? 'serviço escolhido' : 'serviços escolhidos'}
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <div className="ss-prices">
              {picked.map((x) => (
                <div key={x.id} className="ss-price">
                  <input className="ss-price-name" value={x.name} onChange={(e) => set(x.id, { name: e.target.value })} aria-label="Nome do serviço" />
                  <HowPicker value={x.pricing} onChange={(p) => set(x.id, withPricing(x, p))} compact />
                  <PriceFields x={x} set={(patch) => set(x.id, patch)} />
                </div>
              ))}
              <p className="muted small ss-later">
                <Icon name="settings" size={13} /> Depois dá para mudar tudo em configurações → preços.
              </p>
            </div>
          )}
        </div>

        <footer className="ss-foot">
          {step > 0 ? (
            <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
              <Icon name="chevronL" size={15} /> voltar
            </button>
          ) : onLater ? (
            <button type="button" className="btn ghost" onClick={onLater}>
              fazer depois
            </button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <button type="button" className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
              continuar <Icon name="arrowRight" size={15} />
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={finish}>
              <Icon name="check" size={15} /> pronto, começar
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
