import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useAccess } from '../access'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { CepInput, EmailInput, Field, PhoneInput, Segmented } from '../components/ui'
import { toast } from '../components/dialog'
import { TermsModal } from '../components/Terms'
import { preferredCycle } from '../components/PlanPrice'
import { CYCLES, CYCLE_INSTALLMENTS, CYCLE_MONTHS, CYCLE_UNIT, PLANS, PLAN_LIST, PLATFORM, annualBadge, cardAllowed, cardPrice, cycleDiscount, cycleMonthly, cyclePrice, money0, type PlanId } from '../plans'
import { platform, type Billing, type Cycle, type PayMethod } from '../platform'
import { go, href } from '../router'
import { formatDoc, lookupCnpj, money } from '../utils'

/* Assinatura como uma compra: plano e período, dados, endereço de cobrança,
   forma de pagamento e aceite. Vira um PEDIDO: a administração confirma o
   pagamento e libera a conta (na fase 2, o pagamento libera sozinho). */

/** Confere os dígitos do CPF (11) ou do CNPJ (14). */
export function validDoc(v: string) {
  const d = v.replace(/\D/g, '')
  const calc = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((s, n, i) => s + Number(n) * weights[i], 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false
    const w1 = [10, 9, 8, 7, 6, 5, 4, 3, 2]
    const d1 = ((d.slice(0, 9).split('').reduce((s, n, i) => s + Number(n) * w1[i], 0) * 10) % 11) % 10
    const w2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
    const d2 = ((d.slice(0, 10).split('').reduce((s, n, i) => s + Number(n) * w2[i], 0) * 10) % 11) % 10
    return d1 === Number(d[9]) && d2 === Number(d[10])
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false
    const a = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    const b = calc(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return a === Number(d[12]) && b === Number(d[13])
  }
  return false
}

const PROFESSIONS = ['arquiteto(a)', 'designer de interiores', 'artista 3D / visualização', 'estudante', 'paisagista', 'outro']
const SOURCES = ['Instagram', 'indicação de amigo(a)', 'Google', 'faculdade', 'TikTok', 'outro']
// só Pix e cartão de crédito; o que cada um significa muda com o ciclo. No mensal o cartão vem primeiro (cobra sozinho).
const PAY: { id: PayMethod; label: string; hint: Record<Cycle, string>; icon: string }[] = [
  { id: 'cartao', label: 'cartão de crédito', hint: { mensal: 'recorrente: cobra sozinho todo mês', semestral: '', anual: `em até ${CYCLE_INSTALLMENTS.anual}x sem juros` }, icon: 'file' },
  { id: 'pix', label: 'Pix', hint: { mensal: 'um Pix por mês, com lembrete antes do vencimento', semestral: 'um Pix só, à vista, pelos 6 meses', anual: 'um Pix só, à vista: o menor preço' }, icon: 'wallet' },
]
const cycleLabel = (c: Cycle) => (c === 'mensal' ? 'mensal' : c === 'semestral' ? 'semestral' : 'anual')

export default function Checkout({ planId }: { planId: string }) {
  const { sub, refresh } = useAccess()
  const { data } = useStore()
  const s = data.settings
  // o Estúdio é sob convite: só aparece aqui para quem a administração já liberou
  const choices = PLAN_LIST.filter((x) => !x.inviteOnly || sub?.plan === x.id)
  const [plan, setPlan] = useState<PlanId>(choices.find((x) => x.id === planId)?.id ?? (sub?.plan === 'estudio' ? 'estudio' : 'completo'))
  const [b, setB] = useState<Billing>({
    fullName: s.legalName || sub?.name || s.ownerName || '',
    doc: s.document ? formatDoc(s.document) : '',
    phone: s.phone || '',
    email: sub?.email || s.email || '',
    cep: s.cep || '',
    address: s.address || '',
    number: s.addressNumber || '',
    complement: '',
    city: s.city || '',
    profession: '',
    source: '',
    payMethod: (preferredCycle() ?? 'mensal') === 'mensal' ? 'cartao' : 'pix',
    cycle: preferredCycle() ?? 'mensal',
    acceptedAt: '',
  })
  const [agree, setAgree] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const set = (patch: Partial<Billing>) => setB((x) => ({ ...x, ...patch }))

  // pedido anterior: preenche com o que a pessoa já tinha informado
  useEffect(() => {
    platform
      .myBilling()
      // o ciclo escolhido agora nos planos vale mais que o do pedido anterior
      .then((prev) => prev && setB((x) => ({ ...x, ...prev, cycle: preferredCycle() ?? prev.cycle ?? x.cycle, acceptedAt: '' })))
      .catch(() => undefined)
  }, [])

  const p = PLANS[plan]
  // semestral é só no Pix
  useEffect(() => {
    if (!cardAllowed(b.cycle) && b.payMethod === 'cartao') set({ payMethod: 'pix' })
  }, [b.cycle, b.payMethod])
  const card = b.payMethod === 'cartao'
  const total = card ? cardPrice(p.price, b.cycle) : cyclePrice(p.price, b.cycle)
  const unit = CYCLE_UNIT[b.cycle]
  const maxParts = card ? CYCLE_INSTALLMENTS[b.cycle] : 1
  const payOptions = PAY.filter((x) => x.id !== 'cartao' || cardAllowed(b.cycle))
  const docOk = validDoc(b.doc)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const missing = [...billingMissing(b), !agree && 'aceite dos termos'].filter(Boolean)
    if (missing.length) return setError(`Falta: ${missing.join(', ')}.`)
    setBusy(true)
    try {
      await platform.requestPlan(plan, { ...b, installments: maxParts > 1 ? Math.min(b.installments ?? maxParts, maxParts) : undefined, fullName: b.fullName.trim(), acceptedAt: new Date().toISOString() })
      await refresh()
      setDone(true)
      window.scrollTo(0, 0)
    } catch {
      toast('Não foi possível enviar agora. Confira a internet e tente de novo.')
    }
    setBusy(false)
  }

  if (sub?.blocked) return <Blocked />
  if (done)
    return (
      <div className="page">
        <section className="card pf-blocked co-done">
          <span className="co-done-icon">
            <Icon name="check" size={28} />
          </span>
          <h1>
            pedido <em>recebido!</em>
          </h1>
          <p className="muted">
            Plano <b>{p.name}</b> · {money(total)} por {unit} · {PAY.find((x) => x.id === b.payMethod)?.label}
            {maxParts > 1 ? ` em ${Math.min(b.installments ?? maxParts, maxParts)}x sem juros` : ''}
          </p>
          <ol className="co-steps">
            <li className="is-done">
              <b>pedido enviado</b>
              <span>com os seus dados de cobrança</span>
            </li>
            <li>
              <b>pagamento</b>
              <span>o {PLATFORM.support} te manda o Pix ou o link do cartão pelo chat</span>
            </li>
            <li>
              <b>conta liberada</b>
              <span>assim que o pagamento for confirmado</span>
            </li>
          </ol>
          <div className="row gap-s wrap center">
            <a className="btn primary" href={href('inicio')}>
              voltar para o sistema
            </a>
            <a className="btn ghost" href={href('assinatura')}>
              minha assinatura
            </a>
          </div>
        </section>
      </div>
    )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="lock" size={13} /> assinatura segura
          </p>
          <h1>
            finalizar <em>assinatura</em>
          </h1>
        </div>
        <button className="btn ghost" onClick={() => go('assinatura')}>
          voltar
        </button>
      </div>
      <form className="co-layout" onSubmit={submit} noValidate>
        <div className="stack">
          <Step n={1} title="plano e período">
            <div className="co-plans">
              {choices.map((x) => (
                <button type="button" key={x.id} className={`pf-plan-opt ${plan === x.id ? 'active' : ''}`} onClick={() => setPlan(x.id)} aria-pressed={plan === x.id}>
                  <b>{x.name}</b>
                  <span>{money0(x.price)}/mês</span>
                  <small>{x.pitch}</small>
                </button>
              ))}
            </div>
            <Segmented<Cycle>
              value={b.cycle}
              onChange={(cycle) => {
                set({ cycle })
                try {
                  localStorage.setItem('ciclo-preferido', cycle)
                } catch {
                  /* sem espaço */
                }
              }}
              options={CYCLES.map((c) => ({ value: c, label: c === 'anual' && annualBadge() ? <>anual · {annualBadge()}</> : cycleDiscount(c) ? <>{cycleLabel(c)} · {cycleDiscount(c)}% off</> : cycleLabel(c) }))}
            />
          </Step>

          <Step n={2} title="seus dados">
            <BillingFields part="dados" b={b} set={set} docOk={docOk} />
          </Step>

          <Step n={3} title="endereço de cobrança">
            <BillingFields part="endereco" b={b} set={set} docOk={docOk} />
          </Step>

          <Step n={4} title="forma de pagamento">
            <div className="co-pay">
              {payOptions.map((x) => (
                <button type="button" key={x.id} className={`pf-plan-opt ${b.payMethod === x.id ? 'active' : ''}`} onClick={() => set({ payMethod: x.id })} aria-pressed={b.payMethod === x.id}>
                  <Icon name={x.icon} size={18} />
                  <b>
                    {x.label}
                    {x.id === 'cartao' && b.cycle === 'mensal' && <em className="co-rec">recomendado</em>}
                  </b>
                  <small>{x.hint[b.cycle]}</small>
                </button>
              ))}
            </div>
            {maxParts > 1 && (
              <Field label="Parcelas no cartão" hint={`Sem juros em qualquer número de parcelas. À vista no Pix sai ${money(cyclePrice(p.price, b.cycle))}.`}>
                <select value={Math.min(b.installments ?? maxParts, maxParts)} onChange={(e) => set({ installments: Number(e.target.value) })}>
                  {Array.from({ length: maxParts }, (_, i) => maxParts - i).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? `1x de ${money(total)}` : `${n}x de ${money(total / n)} sem juros`}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <p className="muted small">Nada é cobrado agora: o {PLATFORM.support} confirma o pedido e te envia o Pix ou o link seguro do cartão pelo chat. Os dados do seu cartão nunca são digitados aqui.</p>
          </Step>

          <Step n={5} title="confirmar">
            <label className="check co-agree">
              <input id="co-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                li e aceito os{' '}
                <button type="button" className="link" onClick={(e) => (e.preventDefault(), setShowTerms(true))}>
                  termos de uso e o contrato de assinatura
                </button>{' '}
                do {PLATFORM.name}.
              </span>
            </label>
            <p className="muted small co-rights">
              <Icon name="check" size={13} /> Se se arrepender, você tem 7 dias depois do pagamento para cancelar com o dinheiro de volta (art. 49 do Código de Defesa do Consumidor). Depois disso, cancela quando quiser, sem multa.
            </p>
            {showTerms && <TermsModal who={{ name: b.fullName, doc: b.doc, email: b.email, plan: `${p.name} · ${money0(total)}/${unit}` }} onClose={() => setShowTerms(false)} onAccept={() => setAgree(true)} />}
            {error && <p className="auth-error">{error}</p>}
            <button className="btn primary co-submit" disabled={busy}>
              {busy ? (
                'enviando…'
              ) : (
                <span>
                  pedir assinatura · <span className="keep-case">{money(total)}</span>/{unit}
                </span>
              )}
              {!busy && <Icon name="arrowRight" size={16} />}
            </button>
          </Step>
        </div>

        <aside className="card co-summary">
          <p className="eyebrow">resumo do pedido</p>
          <div className="co-line">
            <b>
              {PLATFORM.name} · {p.name}
            </b>
            <span>{cycleLabel(b.cycle)}</span>
          </div>
          <ul className="pf-checks">
            {p.highlights.slice(0, 5).map((h) => (
              <li key={h}>
                <Icon name="check" size={14} /> {h}
              </li>
            ))}
          </ul>
          {b.cycle !== 'mensal' && (
            <div className="co-line muted small">
              <span>
                {CYCLE_MONTHS[b.cycle]} × {money(p.price)}
              </span>
              <s>{money(p.price * CYCLE_MONTHS[b.cycle])}</s>
            </div>
          )}
          {b.cycle !== 'mensal' && p.price * CYCLE_MONTHS[b.cycle] > total && (
            <div className="co-line small text-good">
              <span>{b.cycle === 'anual' ? (card ? 'economia do anual no cartão' : annualBadge() || 'desconto do anual') : `${cycleDiscount(b.cycle)}% de desconto no ${cycleLabel(b.cycle)}`}</span>
              <span>− {money(p.price * CYCLE_MONTHS[b.cycle] - total)}</span>
            </div>
          )}
          <div className="co-line co-total">
            <span>total</span>
            <b>
              {money(total)}
              <small>/{unit}</small>
            </b>
          </div>
          {b.cycle !== 'mensal' && <p className="muted small">{card && maxParts > 1 ? `${Math.min(b.installments ?? maxParts, maxParts)}x de ${money(total / Math.min(b.installments ?? maxParts, maxParts))} sem juros · no Pix à vista sai ${money(cyclePrice(p.price, b.cycle))}` : `equivale a ${money(cycleMonthly(p.price, b.cycle))} por mês`}</p>}
          <p className="co-secure small">
            <Icon name="lock" size={14} /> sem fidelidade · cancele quando quiser
          </p>
        </aside>
      </form>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card co-step">
      <header className="co-step-head">
        <span>{n}</span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  )
}

function Blocked() {
  return (
    <div className="page">
      <section className="card pf-blocked">
        <Icon name="lock" size={28} />
        <h1>
          conta <em>pausada</em>
        </h1>
        <p className="muted">Fale com o {PLATFORM.support} pelo chat para resolver.</p>
      </section>
    </div>
  )
}

/** Campos dos dados de cobrança (usados na assinatura, em "meus dados" e no painel da dona). */
export function BillingFields({ part, b, set, docOk }: { part: 'dados' | 'endereco'; b: Billing; set: (patch: Partial<Billing>) => void; docOk: boolean }) {
  if (part === 'endereco')
    return (
      <div className="form-grid">
              <Field label="CEP *" hint="o endereço se preenche sozinho">
                <CepInput id="co-cep" value={b.cep} onChange={(cep) => set({ cep })} onFound={(a) => set({ address: a.address || b.address, city: a.city || b.city })} />
              </Field>
              <Field label="Rua e bairro *" span={2}>
                <input id="co-address" autoComplete="street-address" value={b.address} onChange={(e) => set({ address: e.target.value })} />
              </Field>
              <Field label="Número *">
                <input id="co-number" value={b.number} onChange={(e) => set({ number: e.target.value })} />
              </Field>
              <Field label="Complemento (opcional)">
                <input value={b.complement} onChange={(e) => set({ complement: e.target.value })} />
              </Field>
              <Field label="Cidade - UF *">
                <input id="co-city" value={b.city} onChange={(e) => set({ city: e.target.value })} placeholder="Belo Horizonte - MG" />
              </Field>
            </div>
    )
  return (
    <div className="form-grid">
              <Field label="Nome e sobrenome *" span={2}>
                <input id="co-name" autoComplete="name" value={b.fullName} onChange={(e) => set({ fullName: e.target.value })} />
              </Field>
              <Field label="CPF ou CNPJ *" hint={b.doc && !docOk ? <span className="text-bad">confira os números</span> : docOk ? 'conferido ✓' : 'para a nota e o recibo'}>
                <input
                  id="co-doc"
                  inputMode="numeric"
                  value={b.doc}
                  onChange={async (e) => {
                    const doc = formatDoc(e.target.value)
                    set({ doc })
                    // CNPJ completo: puxa a razão social
                    if (doc.replace(/\D/g, '').length === 14 && validDoc(doc) && !b.fullName.trim()) {
                      const r = await lookupCnpj(doc).catch(() => null)
                      if (r?.legal) set({ fullName: r.legal })
                    }
                  }}
                />
              </Field>
              <Field label="Celular (WhatsApp) *">
                <PhoneInput id="co-phone" value={b.phone} onChange={(phone) => set({ phone })} />
              </Field>
              <Field label="E-mail *" span={2}>
                <EmailInput id="co-email" value={b.email} onChange={(email) => set({ email })} />
              </Field>
              <Field label="Área de atuação *">
                <select id="co-prof" value={b.profession} onChange={(e) => set({ profession: e.target.value })}>
                  <option value="">escolha…</option>
                  {PROFESSIONS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Como conheceu (opcional)">
                <select value={b.source} onChange={(e) => set({ source: e.target.value })}>
                  <option value="">escolha…</option>
                  {SOURCES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>
  )
}

/** O que falta preencher (nome e sobrenome, CPF/CNPJ válido, celular, e-mail, endereço…). */
export function billingMissing(b: Billing) {
  return [
    b.fullName.trim().split(/\s+/).length < 2 && 'nome e sobrenome',
    !validDoc(b.doc) && 'CPF ou CNPJ válido',
    b.phone.replace(/\D/g, '').length < 10 && 'celular com DDD',
    !/^\S+@\S+\.\S+$/.test(b.email) && 'e-mail',
    b.cep.replace(/\D/g, '').length !== 8 && 'CEP',
    !b.address.trim() && 'endereço',
    !b.number.trim() && 'número',
    !b.city.trim() && 'cidade',
    !b.profession && 'área de atuação',
  ].filter(Boolean) as string[]
}
