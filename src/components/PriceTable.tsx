import { Fragment, useState } from 'react'
import type { AreaTier, Pricing, ServiceDef, WorkProfile } from '../types'
import { Icon } from './Icon'
import { Field, Modal, MoneyInput } from './ui'
import { askDelete, toast } from './dialog'
import { areaRate, calibrateTiers, groupServices, hasAreaTiers, money, serviceAsk, sortedTiers, uid } from '../utils'
import { useStore } from '../store'
import { serviceAudience } from '../processes'
import { ARCH_SERVICES } from '../clientDefaults'
import { CATALOG, OWNER_ONLY, type CatalogKind } from '../serviceCatalog'
import { isBeta } from '../beta'

/* Tabela de preços simples: cada serviço é uma linha com o resumo do preço. Tocando, abre o editor:
   primeiro "como você cobra" (cartões com ícone e explicação), depois só os campos daquela forma,
   com uma prévia de como fica no orçamento. O que é detalhe (grupo, entrega, observações, lista) fica em "mais opções". */

export const HOW: Record<Pricing, { icon: string; title: string; text: string }> = {
  hora: { icon: 'clock', title: 'por hora', text: 'no orçamento você diz quantas horas' },
  m2: { icon: 'ruler', title: 'por m²', text: 'valor × metragem do espaço' },
  unidade: { icon: 'grid', title: 'por unidade', text: 'cada imagem, prancha, planta…' },
  pacote: { icon: 'layers', title: 'pacotes', text: 'quanto mais, mais barato cada um' },
  livre: { icon: 'edit', title: 'valor fechado', text: 'você digita o valor em cada orçamento' },
}
const HOW_ORDER: Pricing[] = ['hora', 'm2', 'unidade', 'pacote', 'livre']

const AUD: { value: 'final' | 'parceiro' | 'ambos'; icon: string; label: string }[] = [
  { value: 'final', icon: 'home', label: 'cliente final' },
  { value: 'parceiro', icon: 'briefcase', label: 'escritório parceiro' },
  { value: 'ambos', icon: 'users', label: 'os dois' },
]

/** Resumo de uma linha: "R$ 60 por hora", "R$ 90/m² · mínimo R$ 4.000"… */
export function priceSummary(x: ServiceDef) {
  const min = x.min > 0 ? ` · mínimo ${money(x.min)}` : ''
  if (x.pricing === 'livre') return 'você digita o valor no orçamento'
  if (x.pricing === 'hora') return `${money(x.price)} por hora${min}`
  if (hasAreaTiers(x)) {
    const t = sortedTiers(x.areaTiers).filter((y) => y.price > 0)
    return `por faixa de área: ${t.map((y) => `${y.upTo ? `até ${y.upTo} m²` : 'acima'} ${money(y.price)}/m²`).join(' · ')}${min}`
  }
  if (x.pricing === 'm2' && !x.price && x.checklistPrices && Object.keys(x.checklistPrices).length) return `valor por m² de cada opção marcada${min}`
  if (x.pricing === 'm2') return `${money(x.price)}/m²${x.base ? ` + ${money(x.base)} fixo` : ''}${min}`
  if (x.pricing === 'pacote') {
    const t = [...x.tiers].filter((y) => y.qty > 0).sort((a, b) => a.qty - b.qty)[0]
    return `${money(x.price)} cada${t ? ` · ${t.qty} por ${money(t.price)}` : ''}`
  }
  return `${money(x.price)} por ${x.unit || 'unidade'}${min}`
}

/** Um exemplo de conta, para a pessoa ver o que o preço vira no orçamento. */
function example(x: ServiceDef) {
  const unit = x.unit || 'unidade'
  const floor = (n: number) => Math.max(n, x.min || 0)
  if (x.pricing === 'livre') return 'No orçamento aparece um campo para você digitar o valor combinado.'
  if (x.pricing === 'hora') return `Ex.: 3 horas = ${money(floor(x.price * 3))}`
  if (hasAreaTiers(x)) {
    const ex = [40, 90, 160].map((a) => `${a} m² = ${money(floor((x.base || 0) + areaRate(x, a) * a))}`).join(' · ')
    return `Ex. (complexidade média, projeto completo): ${ex}. Complexidade simples ou alta e as plantas escolhidas ajustam o valor.`
  }
  if (x.pricing === 'm2') {
    const v = (x.base || 0) + x.price * 60
    return `Ex.: 60 m² = ${money(floor(v))}${floor(v) !== v ? ' (vale o mínimo)' : ''}. A complexidade do projeto ajusta para mais ou para menos.`
  }
  if (x.pricing === 'pacote') {
    const t = [...x.tiers].filter((y) => y.qty > 1).sort((a, b) => a.qty - b.qty)[0]
    return t ? `Ex.: 1 ${unit} = ${money(x.price)} · ${t.qty} = ${money(t.price)} (${money(t.price / t.qty)} cada)` : `Ex.: 1 ${unit} = ${money(x.price)}. Crie um pacote abaixo para dar desconto na quantidade.`
  }
  return `Ex.: 3 ${unit}s = ${money(floor(x.price * 3))}`
}

/** "como você cobra?": cartões com ícone. */
export function HowPicker({ value, onChange, compact }: { value: Pricing; onChange: (p: Pricing) => void; compact?: boolean }) {
  return (
    <div className={`how-pick ${compact ? 'is-compact' : ''}`} role="radiogroup" aria-label="Como você cobra">
      {HOW_ORDER.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'is-on' : ''} onClick={() => onChange(k)} title={HOW[k].text}>
          <Icon name={HOW[k].icon} size={compact ? 15 : 18} />
          <b>{HOW[k].title}</b>
          {!compact && <small>{HOW[k].text}</small>}
        </button>
      ))}
    </div>
  )
}

/** Escolher várias formas de cobrar (para criar um serviço com mais de um jeito de cobrar). */
export function HowMulti({ value, onChange }: { value: Pricing[]; onChange: (p: Pricing[]) => void }) {
  return (
    <div className="how-pick is-compact" role="group" aria-label="Formas de cobrar (pode marcar mais de uma)">
      {HOW_ORDER.map((k) => {
        const on = value.includes(k)
        return (
          <button key={k} type="button" aria-pressed={on} className={on ? 'is-on' : ''} onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])} title={HOW[k].text}>
            <Icon name={on ? 'check' : HOW[k].icon} size={15} />
            <b>{HOW[k].title}</b>
          </button>
        )
      })}
    </div>
  )
}

/** Nome com a forma de cobrar, para quando o mesmo serviço tem mais de um jeito: "consultoria (por hora)". */
export const withWay = (name: string, p: Pricing) => `${name.replace(/\s*\((por hora|por m²|por unidade|pacotes|valor fechado)\)\s*$/, '')} (${HOW[p].title})`

/** Troca a forma de cobrar ajustando a unidade junto. */
export const withPricing = (x: ServiceDef, p: Pricing): Partial<ServiceDef> => ({
  pricing: p,
  unit: p === 'm2' ? 'm²' : p === 'hora' ? 'hora' : x.unit === 'm²' || x.unit === 'hora' ? 'unidade' : x.unit,
})

/** Os campos do preço, só os daquela forma de cobrar. */
export function PriceFields({ x, set }: { x: ServiceDef; set: (patch: Partial<ServiceDef>) => void }) {
  const unit = x.unit || 'unidade'
  return (
    <div className="pt-fields">
      {x.pricing === 'hora' && (
        <Field label="Quanto vale a sua hora?">
          <MoneyInput value={x.price} onChange={(n) => set({ price: n })} />
        </Field>
      )}
      {x.pricing === 'm2' && <AreaTiers x={x} set={set} />}
      {x.pricing === 'm2' && (
        <>
          {!hasAreaTiers(x) && (
            <Field label="Valor por m²">
              <MoneyInput value={x.price} onChange={(n) => set({ price: n })} />
            </Field>
          )}
          <Field label="Valor fixo somado" hint="Opcional. Ex.: deslocamento ou taxa de abertura.">
            <MoneyInput value={x.base ?? 0} onChange={(n) => set({ base: n })} />
          </Field>
        </>
      )}
      {(x.pricing === 'unidade' || x.pricing === 'pacote') && (
        <>
          <Field label="O que você entrega?" hint="Ex.: imagem, prancha, planta, visita.">
            <input value={x.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="imagem" />
          </Field>
          <Field label={x.pricing === 'pacote' ? `Valor de 1 ${unit} (avulso)` : `Valor de cada ${unit}`}>
            <MoneyInput value={x.price} onChange={(n) => set({ price: n })} />
          </Field>
        </>
      )}
      {x.pricing !== 'livre' && x.pricing !== 'pacote' && (
        <Field label="Valor mínimo" hint="Opcional. O orçamento nunca fica abaixo disso.">
          <MoneyInput value={x.min} onChange={(n) => set({ min: n })} />
        </Field>
      )}
      {x.pricing === 'pacote' && (
        <div className="pt-tiers span-all">
          <span className="field-label">pacotes com desconto</span>
          {x.tiers.map((t, i) => (
            <div key={i} className="pt-tier">
              <input type="number" min={2} value={t.qty} onChange={(e) => set({ tiers: x.tiers.map((y, j) => (j === i ? { ...y, qty: Number(e.target.value) || 0 } : y)) })} aria-label="Quantidade do pacote" />
              <span className="muted small">{unit}s por</span>
              <MoneyInput value={t.price} onChange={(n) => set({ tiers: x.tiers.map((y, j) => (j === i ? { ...y, price: n } : y)) })} />
              <span className="muted small nowrap">{t.qty ? `= ${money(t.price / t.qty)} cada` : ''}</span>
              <button type="button" className="icon-btn subtle" onClick={() => set({ tiers: x.tiers.filter((_, j) => j !== i) })} aria-label="Tirar pacote">
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn small ghost" onClick={() => set({ tiers: [...x.tiers, { qty: (x.tiers.at(-1)?.qty ?? 0) + 5, price: 0 }] })}>
            <Icon name="plus" size={14} /> pacote
          </button>
        </div>
      )}
      <p className="pt-example span-all">
        <Icon name="sparkle" size={14} /> {example(x)}
      </p>
    </div>
  )
}

/** Um serviço: linha resumida; tocando, abre o editor. */
function ServiceCard({ x, open, onToggle, set, onRemove, audience, onAddWay }: { x: ServiceDef; open: boolean; onToggle: () => void; set: (patch: Partial<ServiceDef>) => void; onRemove: () => void; audience: boolean; onAddWay?: (p: Pricing) => void }) {
  const [way, setWay] = useState(false)
  const [more, setMore] = useState(false)
  const aud = AUD.find((a) => a.value === serviceAudience(x))
  return (
    <div className={`pt-card ${open ? 'is-open' : ''}`}>
      <button type="button" className="pt-head" onClick={onToggle} aria-expanded={open}>
        <span className="pt-ico">
          <Icon name={HOW[x.pricing].icon} size={17} />
        </span>
        <span className="pt-title">
          <b>{x.name || 'serviço sem nome'}</b>
          <small>{priceSummary(x)}</small>
        </span>
        {audience && aud && (
          <span className="pt-aud" title={`aparece no orçamento para ${aud.label}`}>
            <Icon name={aud.icon} size={12} /> {aud.label}
          </span>
        )}
        <Icon name="chevronR" size={16} className={`pt-chev ${open ? 'is-open' : ''}`} />
      </button>
      {open && (
        <div className="pt-body">
          <Field label="Nome do serviço">
            <input value={x.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: imagem 3d, projeto de interiores" />
          </Field>
          <div>
            <span className="field-label">como você cobra?</span>
            <HowPicker value={x.pricing} onChange={(p) => set(withPricing(x, p))} />
          </div>
          <PriceFields x={x} set={set} />
          {onAddWay &&
            (way ? (
              <div className="pt-way">
                <span className="field-label">cobrar também de outro jeito: qual?</span>
                <div className="how-pick is-compact">
                  {HOW_ORDER.filter((k) => k !== x.pricing).map((k) => (
                    <button key={k} type="button" onClick={() => (onAddWay(k), setWay(false))} title={HOW[k].text}>
                      <Icon name={HOW[k].icon} size={15} />
                      <b>{HOW[k].title}</b>
                    </button>
                  ))}
                </div>
                <small className="muted">Vira outro item, com a forma no nome. No orçamento você escolhe qual usar.</small>
              </div>
            ) : (
              <button type="button" className="link small pt-more-btn" onClick={() => setWay(true)}>
                <Icon name="plus" size={13} /> cobrar também de outro jeito
              </button>
            ))}
          {audience && (
            <div>
              <span className="field-label">aparece no orçamento para</span>
              <div className="pt-aud-pick" role="radiogroup">
                {AUD.map((a) => (
                  <button key={a.value} type="button" role="radio" aria-checked={serviceAudience(x) === a.value} className={serviceAudience(x) === a.value ? 'is-on' : ''} onClick={() => set({ audience: a.value })}>
                    <Icon name={a.icon} size={14} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="link small pt-more-btn" onClick={() => setMore(!more)} aria-expanded={more}>
            <Icon name="chevronR" size={13} className={`pt-chev ${more ? 'is-open' : ''}`} /> mais opções <span className="muted">(grupo, entrega, observações, lista para o cliente escolher)</span>
          </button>
          {more && <MoreOptions x={x} set={set} />}
          <div className="pt-foot">
            <button type="button" className="btn small ghost danger-text" onClick={onRemove}>
              <Icon name="trash" size={14} /> tirar este serviço
            </button>
            <button type="button" className="btn small primary" onClick={onToggle}>
              <Icon name="check" size={14} /> pronto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Faixas de área: quanto maior o espaço, menor o R$/m². Dá para calcular pelos orçamentos recentes. */
const DEFAULT_TIERS: AreaTier[] = [
  { upTo: 50, price: 0 },
  { upTo: 120, price: 0 },
  { upTo: 0, price: 0 },
]
export function AreaTiers({ x, set, calibrate = true }: { x: ServiceDef; set: (patch: Partial<ServiceDef>) => void; calibrate?: boolean }) {
  const { data } = useStore()
  const on = !!x.areaTiers?.length
  const tiers = sortedTiers(x.areaTiers)
  const put = (list: AreaTier[]) => set({ areaTiers: list })
  if (!on)
    return (
      <button type="button" className="link small span-all" onClick={() => put(DEFAULT_TIERS.map((t, i) => ({ ...t, price: Math.max(0, Math.round((x.price || 0) * [1.2, 1, 0.8][i] * 2) / 2) })))}>
        + preço por faixa de área (quanto maior o espaço, menor o valor do m²)
      </button>
    )
  const fromQuotes = () => {
    const r = calibrateTiers(x, data.quotes, data.settings)
    if (!r.used.some(Boolean)) return toast('Não achei orçamentos enviados deste serviço com área nos últimos 6 meses.')
    put(r.tiers)
    toast(`Faixas calculadas por ${r.used.reduce((a, b) => a + b, 0)} orçamento(s) dos últimos 6 meses. Confira e ajuste.`)
  }
  return (
    <div className="pt-tiers span-all">
      <span className="field-label">valor do m² por faixa de área (complexidade média)</span>
      {tiers.map((t, i) => {
        const last = !t.upTo
        const prev = tiers[i - 1]?.upTo
        return (
          <div key={i} className="pt-tier pt-area-tier">
            {last ? (
              <span className="muted small pt-area-label">acima de {prev || 0} m²</span>
            ) : (
              <span className="row gap-s pt-area-label">
                <span className="muted small nowrap">{prev ? `${prev + 1} a` : 'até'}</span>
                <input type="number" min={1} value={t.upTo} onChange={(e) => put(tiers.map((y, j) => (j === i ? { ...y, upTo: Math.max(1, Number(e.target.value) || 1) } : y)))} aria-label="Até quantos m²" />
                <span className="muted small">m²</span>
              </span>
            )}
            <MoneyInput value={t.price} onChange={(n) => put(tiers.map((y, j) => (j === i ? { ...y, price: n } : y)))} />
            <span className="muted small nowrap">/m²</span>
            {!last && tiers.length > 2 ? (
              <button type="button" className="icon-btn subtle" onClick={() => put(tiers.filter((_, j) => j !== i))} aria-label="Tirar faixa">
                <Icon name="x" size={14} />
              </button>
            ) : (
              <span />
            )}
          </div>
        )
      })}
      <div className="row gap-s wrap">
        <button type="button" className="btn small ghost" onClick={() => put([...tiers.filter((t) => t.upTo), { upTo: (tiers.filter((t) => t.upTo).at(-1)?.upTo ?? 0) + 50, price: tiers.at(-1)?.price ?? 0 }, ...tiers.filter((t) => !t.upTo)])}>
          <Icon name="plus" size={14} /> faixa
        </button>
        {calibrate && (
          <button type="button" className="btn small ghost" onClick={fromQuotes} title="Usa a mediana do valor do m² dos seus orçamentos enviados nos últimos 6 meses">
            <Icon name="sparkle" size={14} /> calcular pelos meus orçamentos
          </button>
        )}
        <button type="button" className="link small" onClick={() => set({ areaTiers: undefined, price: x.price || tiers[1]?.price || tiers[0]?.price || 0 })}>
          voltar a um valor só
        </button>
      </div>
      <small className="muted">Simples e alta complexidade ajustam a partir da média (configurações → complexidade). Se o serviço tem lista de plantas, cada uma tem um peso: marcando menos plantas, o valor cai na mesma proporção.</small>
    </div>
  )
}

/** Detalhes que quase ninguém precisa mexer no começo. */
function MoreOptions({ x, set }: { x: ServiceDef; set: (patch: Partial<ServiceDef>) => void }) {
  return (
    <div className="pt-more">
      <Field label="Grupo" hint="Só organiza a tabela e a lista do orçamento (ex.: projetos complementares).">
        <input list="service-groups" value={x.group ?? ''} onChange={(e) => set({ group: e.target.value })} placeholder="sem grupo" />
      </Field>
      <label className="check toggle">
        <input type="checkbox" checked={!!x.perFloor} onChange={(e) => set({ perFloor: e.target.checked })} /> fica mais caro a cada pavimento a mais
      </label>
      <Field label="Como é entregue" hint="Vai na proposta em “formatos de arquivos entregues”.">
        <input value={x.delivery ?? ''} onChange={(e) => set({ delivery: e.target.value })} placeholder="Ex.: PDF fechado, pronto para execução" />
      </Field>
      <Field label="Se o cliente quiser o arquivo aberto" hint="Em branco: a entrega normal + “arquivo aberto (editável)”.">
        <input value={x.deliveryOpen ?? ''} onChange={(e) => set({ deliveryOpen: e.target.value })} placeholder="Ex.: PDF + arquivo aberto do layout" />
      </Field>
      <Field label="Observações prontas" hint="Uma por linha. No orçamento, um toque coloca ou tira.">
        <textarea rows={3} value={(x.noteHints ?? []).join('\n')} onChange={(e) => set({ noteHints: e.target.value.split('\n') })} placeholder="Ex.: necessário planta baixa em dwg com medidas reais." spellCheck lang="pt-BR" />
      </Field>
      <Checklist x={x} set={set} />
    </div>
  )
}

/** Lista para o cliente escolher (ex.: quais plantas), com valor por item. */
function Checklist({ x, set }: { x: ServiceDef; set: (patch: Partial<ServiceDef>) => void }) {
  if (!x.checklist?.length)
    return (
      <button type="button" className="link small" onClick={() => set({ checklist: [''], checklistTitle: x.name, checklistPrices: {} })}>
        + lista para o cliente escolher (ex.: quais plantas), com valor por item
      </button>
    )
  return (
    <div className="service-checklist">
      <Field label="Título da lista">
        <input value={x.checklistTitle ?? ''} onChange={(e) => set({ checklistTitle: e.target.value })} placeholder="Ex.: plantas executivas" />
      </Field>
      <Field label="Pergunta ao cliente">
        <input value={x.askText ?? ''} onChange={(e) => set({ askText: e.target.value })} placeholder={serviceAsk({ ...x, askText: '' })} />
      </Field>
      <div className="checklist-rows">
        <span className="field-label">{hasAreaTiers(x) ? 'opções e o peso de cada uma (%) — o conjunto completo soma 100' : `opções e valor de cada uma ${x.pricing === 'm2' ? '(por m²)' : '(cada)'}`}</span>
        {x.checklist.map((c, i) => (
          <div key={i} className="checklist-row">
            <input
              value={c}
              onChange={(e) => {
                const name = e.target.value
                const prices = { ...(x.checklistPrices ?? {}) }
                prices[name] = prices[c] ?? x.customRate ?? 0
                if (!x.checklist!.some((y, j) => j !== i && y === c)) delete prices[c]
                set({ checklist: x.checklist!.map((y, j) => (j === i ? name : y)), checklistPrices: prices })
              }}
              placeholder="Ex.: planta de forro"
              aria-label="Nome da opção"
            />
            <MoneyInput value={x.checklistPrices?.[c] ?? 0} onChange={(n) => set({ checklistPrices: { ...(x.checklistPrices ?? {}), [c]: n } })} />
            <button type="button" className="icon-btn subtle" onClick={() => set({ checklist: x.checklist!.filter((_, j) => j !== i) })} aria-label="Tirar opção">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
        <div className="checklist-row">
          <span className="muted small">item escrito à mão no orçamento</span>
          <MoneyInput value={x.customRate ?? 0} onChange={(n) => set({ customRate: n })} />
          <span />
        </div>
        <div className="row gap-s">
          <button type="button" className="btn small ghost" onClick={() => set({ checklist: [...x.checklist!, ''] })}>
            <Icon name="plus" size={14} /> opção
          </button>
          <button type="button" className="link small" onClick={() => set({ checklist: [], checklistTitle: '' })}>
            tirar a lista
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- sugestões ---------------- */

export type SuggestKind = CatalogKind
export const SUGGEST = CATALOG
export const kindsFor = (p?: WorkProfile): SuggestKind[] => (p === 'final' ? ['final'] : p === 'ambos' ? ['final', 'freela'] : ['freela'])
const norm = (t: string) => t.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
// mesmo nome vale como repetido, a não ser que seja um para cliente final e outro para escritório
const sameService = (a: ServiceDef, b: ServiceDef) =>
  a.id === b.id || (norm(a.name) === norm(b.name) && (!a.audience || !b.audience || a.audience === b.audience || a.audience === 'ambos' || b.audience === 'ambos'))
/** Cópia de uma sugestão pronta para entrar na tabela da pessoa. */
export const fromSuggestion = (x: ServiceDef): ServiceDef => ({ ...x, tiers: x.tiers.map((t) => ({ ...t })), checklist: x.checklist ? [...x.checklist] : undefined, checklistPrices: x.checklistPrices ? { ...x.checklistPrices } : undefined })
export const blankService = (name: string, pricing: Pricing = 'unidade'): ServiceDef => ({ id: uid(), name, unit: pricing === 'm2' ? 'm²' : pricing === 'hora' ? 'hora' : 'unidade', pricing, price: 0, tiers: [], min: 0, hours: 1 })

/** Escolher serviços sugeridos por área (marca e desmarca), com busca. */
export function SuggestPicker({ kinds, picked, onToggle, existing = [] }: { kinds: SuggestKind[]; picked: ServiceDef[]; onToggle: (x: ServiceDef) => void; existing?: ServiceDef[] }) {
  const [q, setQ] = useState('')
  // a primeira área de cada lista já vem aberta
  const [open, setOpen] = useState<string[]>(() => kinds.map((k) => SUGGEST[k].groups[0]?.id ?? ''))
  const term = norm(q)
  const toggleGroup = (id: string) => setOpen((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  let found = 0
  const blocks = kinds.map((k) => {
    const groups = SUGGEST[k].groups
      .map((g) => ({ ...g, list: g.services.filter((x) => (isBeta() || !OWNER_ONLY.includes(x.id)) && !existing.some((y) => sameService(x, y)) && (!term || norm(x.name).includes(term) || norm(g.label).includes(term))) }))
      .filter((g) => g.list.length)
    groups.forEach((g) => (found += g.list.length))
    return { k, groups }
  })
  return (
    <div className="pt-suggest">
      <label className="pt-search">
        <Icon name="search" size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar serviço (ex.: render, reforma, marcenaria)" aria-label="Buscar serviço" />
        {q && (
          <button type="button" className="icon-btn subtle" onClick={() => setQ('')} aria-label="Limpar busca">
            <Icon name="x" size={14} />
          </button>
        )}
      </label>
      {term && !found && <p className="muted small">Nenhum serviço com esse nome. Crie o seu logo abaixo.</p>}
      {blocks.map(({ k, groups }) =>
        groups.length ? (
          <div key={k} className="pt-suggest-kind">
            {kinds.length > 1 && (
              <p className="pt-suggest-title">
                <Icon name={SUGGEST[k].icon} size={14} /> {SUGGEST[k].label}
              </p>
            )}
            <div className="pt-groups">
              {groups.map((g) => {
                const on = g.list.filter((x) => picked.some((y) => sameService(x, y))).length
                const isOpen = !!term || open.includes(g.id)
                return (
                  <div key={g.id} className={`pt-group-card ${isOpen ? 'is-open' : ''}`}>
                    <button type="button" className="pt-group-head" onClick={() => toggleGroup(g.id)} aria-expanded={isOpen}>
                      <span className="pt-group-ico">
                        <Icon name={g.icon} size={17} />
                      </span>
                      <b>{g.label}</b>
                      <small>{on ? `${on} de ${g.list.length}` : g.list.length}</small>
                      <Icon name="chevronR" size={15} />
                    </button>
                    {isOpen && (
                      <div className="pt-chips">
                        {g.list.map((x) => {
                          const sel = picked.some((y) => sameService(x, y))
                          return (
                            <button key={x.id} type="button" className={`pt-chip ${sel ? 'is-on' : ''}`} aria-pressed={sel} onClick={() => onToggle(x)} title={priceSummary(x)}>
                              <Icon name={sel ? 'check' : 'plus'} size={13} /> {x.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null,
      )}
    </div>
  )
}

/** Campo para criar um serviço seu, com a forma de cobrar. */
export function OwnService({ onAdd }: { onAdd: (list: ServiceDef[]) => void }) {
  const [name, setName] = useState('')
  const [how, setHow] = useState<Pricing[]>([])
  const add = () => {
    if (!name.trim() || !how.length) return
    // mais de uma forma: um item para cada, com a forma no nome (no orçamento você escolhe qual usar)
    onAdd(how.map((p) => blankService(how.length > 1 ? withWay(name.trim(), p) : name.trim(), p)))
    setName('')
  }
  return (
    <div className="pt-own">
      <p className="pt-suggest-title">
        <Icon name="pen" size={14} /> criar um serviço seu
      </p>
      <div className="pt-own-row">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Ex.: maquete física, consultoria de cores" aria-label="Nome do serviço" />
        <button type="button" className="btn primary" onClick={add} disabled={!name.trim() || !how.length}>
          <Icon name="plus" size={15} /> criar
        </button>
      </div>
      <span className="muted small">como você cobra? pode marcar mais de uma forma</span>
      <HowMulti value={how} onChange={setHow} />
    </div>
  )
}

/** Janela "adicionar serviço". */
function AddServices({ profile, existing, onAdd, onClose }: { profile?: WorkProfile; existing: ServiceDef[]; onAdd: (list: ServiceDef[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<ServiceDef[]>([])
  const [all, setAll] = useState(false)
  const kinds: SuggestKind[] = all ? ['final', 'freela'] : kindsFor(profile)
  const toggle = (x: ServiceDef) => setPicked((l) => (l.some((y) => sameService(x, y)) ? l.filter((y) => !sameService(x, y)) : [...l, fromSuggestion(x)]))
  return (
    <Modal
      title="adicionar serviço"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            cancelar
          </button>
          <button className="btn primary" disabled={!picked.length} onClick={() => onAdd(picked)}>
            <Icon name="check" size={15} /> adicionar {picked.length || ''}
          </button>
        </>
      }
    >
      <p className="muted small">Toque nos que você faz. Eles entram com um valor de partida, e você ajusta depois.</p>
      <SuggestPicker kinds={kinds} picked={picked} onToggle={toggle} existing={existing} />
      {!all && kindsFor(profile).length < 2 && (
        <button type="button" className="link small" onClick={() => setAll(true)}>
          ver também as sugestões {kindsFor(profile)[0] === 'final' ? 'para escritórios' : 'para cliente final'}
        </button>
      )}
      <OwnService onAdd={(list) => onAdd([...picked, ...list])} />
    </Modal>
  )
}

/** Configurações → preços: a tabela. */
export function PriceTable({ services, profile, onChange, onRestart }: { services: ServiceDef[]; profile?: WorkProfile; onChange: (list: ServiceDef[]) => void; onRestart?: () => void }) {
  const [open, setOpen] = useState('')
  const [adding, setAdding] = useState(false)
  const set = (id: string, patch: Partial<ServiceDef>) => onChange(services.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const audience = profile !== 'freelancer'
  return (
    <div className="pt">
      <div className="pt-intro">
        <span className="pt-intro-ico">
          <Icon name="wallet" size={18} />
        </span>
        <p>
          <b>Os serviços que você faz e como cobra cada um.</b> Toque num serviço para mudar o valor. No orçamento, o valor sai sozinho, e você ainda pode trocar na hora.
        </p>
      </div>
      <div className="pt-list">
        {groupServices(services).map(([g, list], _i, all) => (
          <Fragment key={g || '-'}>
            {(g || all.length > 1) && (
              <p className="pt-group">
                {g || 'seus serviços'} <small>{list.length}</small>
              </p>
            )}
            {list.map((x) => (
              <ServiceCard
                key={x.id}
                x={x}
                open={open === x.id}
                onToggle={() => setOpen(open === x.id ? '' : x.id)}
                set={(patch) => set(x.id, patch)}
                audience={audience}
                onAddWay={(p) => {
                  const twin: ServiceDef = { ...x, ...withPricing(x, p), id: uid(), name: withWay(x.name, p), price: 0, min: 0, base: 0, tiers: [] }
                  const i = services.findIndex((y) => y.id === x.id)
                  const next = [...services]
                  next.splice(i, 1, { ...x, name: withWay(x.name, x.pricing) }, twin)
                  onChange(next)
                  setOpen(twin.id)
                }}
                onRemove={async () => (await askDelete(`o serviço "${x.name}"`)) && onChange(services.filter((y) => y.id !== x.id))}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="pt-actions">
        <button type="button" className="btn primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={15} /> adicionar serviço
        </button>
        {onRestart && (
          <button type="button" className="link small" onClick={onRestart}>
            refazer o passo a passo
          </button>
        )}
      </div>
      <datalist id="service-groups">
        {[...new Set([...services.map((x) => x.group ?? ''), ...ARCH_SERVICES.map((x) => x.group ?? ''), ...Object.values(CATALOG).flatMap((c) => c.groups.map((g) => g.label))].filter(Boolean))].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      {adding && (
        <AddServices
          profile={profile}
          existing={services}
          onClose={() => setAdding(false)}
          onAdd={(list) => {
            // ids novos quando já existe um igual (ex.: criar dois "serviço personalizado")
            const fresh = list.map((x) => (services.some((y) => y.id === x.id) ? { ...x, id: uid() } : x))
            onChange([...services, ...fresh])
            setAdding(false)
            if (fresh.length === 1) setOpen(fresh[0].id)
          }}
        />
      )}
    </div>
  )
}
