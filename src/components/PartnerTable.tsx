import { useState } from 'react'
import type { Client, Complexity, PartnerPrice, PartnerTable, Quote, ServiceDef, Settings } from '../types'
import { useAccess } from '../access'
import { useStore } from '../store'
import { Icon } from './Icon'
import { Field, MoneyInput, Section } from './ui'
import { AreaTiers } from './PriceTable'
import { money, quoteNumber, sortedTiers, tableServices } from '../utils'
import { serviceAudience } from '../processes'

/* Tabela de valores dentro do orçamento de terceirização (só a dona): tabelinha de m² por faixa,
   valores de render em pacotes, detalhamento… O PDF do orçamento sai como a tabela "exclusivo parceria". */

// só serviços que você usa com escritórios parceiros (configurações → serviços → "aparece no orçamento para")
const usable = (x: ServiceDef) => x.pricing !== 'livre' && x.id !== 'personalizado' && serviceAudience(x) !== 'final'


import { askAI } from '../aiQuote'
import { askGemini, readFile, type Attachment } from './AIChat'
import { toast } from './dialog'

/** Resumo de uma linha do valor. */
function summary(x: ServiceDef) {
  if (x.pricing === 'm2') {
    const t = sortedTiers(x.areaTiers).filter((y) => y.price > 0)
    if (!t.length) return `${money(x.price)}/m²`
    if (t.length === 1) return `${money(t[0].price)}/m²`
    return t.map((y, i) => `${y.upTo ? (t[i - 1]?.upTo ? `${t[i - 1].upTo! + 1}–${y.upTo}` : `até ${y.upTo}`) : `acima de ${t[i - 1]?.upTo ?? 0}`} m² ${money(y.price)}`).join(' · ')
  }
  if (x.pricing === 'pacote') return [`1 ${x.unit} ${money(x.price)}`, ...x.tiers.filter((t) => t.qty > 1).map((t) => `${t.qty} por ${money(t.price)}`)].join(' · ')
  return `${money(x.price)} por ${x.unit || 'unidade'}`
}

/** No orçamento de terceirização: liga a tabela de valores e edita cada serviço dela. */
export function QuoteTableSection({ q, settings, client, set }: { q: Quote; settings: Settings; client?: Client; set: (patch: Partial<Quote>) => void }) {
  const { isOwner } = useAccess()
  const { data } = useStore()
  const [adding, setAdding] = useState(false)
  if (!isOwner || q.audience === 'final') return null
  // cada parceiro guarda os seus valores: a tabela nova começa pela última dele (ou pela sua tabela base)
  const last = q.clientId
    ? data.quotes
        .filter((x) => x.id !== q.id && x.clientId === q.clientId && x.table && Object.keys(x.table.services).length)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]
    : undefined
  const t: PartnerTable = q.table ?? { on: false, services: {}, title: 'exclusivo parceria' }
  const put = (patch: Partial<PartnerTable>) => set({ table: { ...t, ...patch } })
  const list = settings.services.filter(usable)
  const merged = tableServices(settings, t)
  const setSvc = (id: string, patch: Partial<PartnerPrice> | null) => {
    const services = { ...t.services }
    if (patch === null) delete services[id]
    else services[id] = { ...(services[id] ?? {}), ...patch }
    put({ services })
  }
  const baseValues = (x: ServiceDef): PartnerPrice => ({
      price: x.price,
      ...(x.pricing === 'pacote' ? { tiers: x.tiers.map((y) => ({ ...y })) } : {}),
      ...(x.pricing === 'm2' ? { areaTiers: x.areaTiers?.length ? x.areaTiers.map((y) => ({ ...y })) : [{ upTo: 0, price: x.price }] } : {}),
    })
  const copy = (o: PartnerPrice): PartnerPrice => JSON.parse(JSON.stringify(o))
  // marcar: os valores combinados com este parceiro na última tabela; se não tiver, os da tabela base
  const include = (x: ServiceDef) => setSvc(x.id, last?.table?.services[x.id] ? copy(last.table.services[x.id]) : { ...baseValues(x), incluso: '' })
  const ask = () =>
    askAI(
      `Vou anexar o arquivo do cliente${client ? ` (${client.name})` : ''}. Analise e me diga: a área aproximada, quais plantas ele vai precisar, o nível de detalhamento e de complexidade, e quanto cobrar por m² pela minha tabela (sem cobrar a mais nem a menos), mostrando a conta. Se tiver detalhamento, conte as peças e os ambientes. No fim, monte a sugestão de orçamento.`,
    )
  return (
    <Section
      title="tabela de valores (parceria)"
      action={
        <button type="button" className="btn small ghost" onClick={ask} title="Abre o assistente com a pergunta pronta: anexe a planta ou o PDF do cliente">
          <Icon name="sparkle" size={14} /> analisar arquivo com a IA
        </button>
      }
    >
      <label className="check toggle">
        <input
          type="checkbox"
          checked={t.on}
          onChange={(e) => {
            const on = e.target.checked
            const fresh = on && !Object.keys(t.services).length && last?.table ? { services: JSON.parse(JSON.stringify(last.table.services)) as PartnerTable['services'], title: last.table.title } : {}
            set({ table: { ...t, ...fresh, on }, ...(on ? { pdf: true } : {}) })
          }}
        /> mandar este orçamento como tabela de valores (m², renders…)
      </label>
      {!t.on ? (
        <p className="muted small" style={{ margin: 0 }}>
          Ligando, o PDF sai como a tabela “orçamento exclusivo parceria”: executivo por faixa de m², detalhamento, pacotes de render, com o que está incluso. O número, o envio e o status seguem como em qualquer orçamento.
        </p>
      ) : (
        <>
          <ClientAsk
            settings={settings}
            onFill={(r) => {
              const services = { ...t.services }
              for (const it of r.servicos ?? []) {
                const x = list.find((y) => y.id === it.id)
                if (!x) continue
                const cur = services[x.id] ?? (last?.table?.services[x.id] ? copy(last.table.services[x.id]) : { ...baseValues(x), incluso: '' })
                const cx = (['simples', 'media', 'alta'] as const).find((c) => c === it.complexidade)
                services[x.id] = {
                  ...cur,
                  ...(x.pricing === 'm2' ? { plantas: (it.plantas ?? []).map((p) => p.trim()).filter(Boolean), ...(cx ? { complexity: cx } : {}) } : {}),
                  ...(it.incluso?.trim() && !cur.incluso?.trim() ? { incluso: it.incluso.trim() } : {}),
                }
              }
              put({ services })
            }}
          />
          <Field label="título">
            <input value={t.title ?? ''} onChange={(e) => put({ title: e.target.value })} placeholder="exclusivo parceria" />
          </Field>
          <p className="muted small" style={{ margin: 0 }}>
            {last ? `Os valores começam pelos combinados com ${client?.name ?? 'este parceiro'} na tabela ${quoteNumber(last)}; ` : 'Os valores começam pela sua tabela base; '}
            ajuste o que for diferente para esta parceria. Pagamento, prazos e formatos vêm dos campos do orçamento.
          </p>
          <div className="pp-edit">
            {!Object.keys(t.services).length && <p className="muted small" style={{ margin: 0 }}>Nenhum serviço na tabela ainda: inclua abaixo ou use o pedido do cliente.</p>}
            {list.filter((x) => t.services[x.id]).map((x) => {
              const on = !!t.services[x.id]
              const m = merged.find((y) => y.id === x.id) ?? x
              const o = t.services[x.id] ?? {}
              return (
                <div key={x.id} className={`pp-edit-row ${on ? 'is-on' : ''}`}>
                  <label className="check">
                    <input type="checkbox" checked={on} onChange={(e) => (e.target.checked ? include(x) : setSvc(x.id, null))} />
                    <b>{x.name}</b>
                    <span className="muted small">{on ? summary(m) : `sua tabela: ${summary(x)}`}</span>
                  </label>
                  {on && (
                    <div className="pp-edit-body">
                      {x.pricing === 'm2' && (
                        <AreaTiers
                          x={{ ...m, areaTiers: o.areaTiers?.length ? o.areaTiers : m.areaTiers?.length ? m.areaTiers : [{ upTo: 0, price: m.price }] }}
                          set={(p) => setSvc(x.id, { areaTiers: p.areaTiers?.length ? p.areaTiers : [{ upTo: 0, price: p.price ?? m.price }] })}
                          calibrate={false}
                        />
                      )}
                      {x.pricing === 'm2' && <PlantasPicker x={x} o={o} onChange={(patch) => setSvc(x.id, patch)} />}
                      {x.pricing === 'm2' && (o.plantas?.length || (o.complexity && o.complexity !== 'media')) ? (
                        <p className="pp-final small">
                          <Icon name="check" size={13} /> na tabela vai: <b>{summary(m)}</b>
                        </p>
                      ) : null}
                      {x.pricing !== 'm2' && (
                        <Field label={x.pricing === 'pacote' ? `1 ${x.unit} (avulso)` : x.pricing === 'hora' ? 'valor da hora' : `cada ${x.unit || 'unidade'}`}>
                          <MoneyInput value={o.price ?? x.price} onChange={(n) => setSvc(x.id, { price: n })} />
                        </Field>
                      )}
                      {x.pricing === 'pacote' && (
                        <div className="pt-tiers">
                          <span className="field-label">pacotes</span>
                          {(o.tiers ?? x.tiers).map((y, i, arr) => (
                            <div key={i} className="pt-tier">
                              <input type="number" min={2} value={y.qty} onChange={(e) => setSvc(x.id, { tiers: arr.map((z, j) => (j === i ? { ...z, qty: Number(e.target.value) || 0 } : z)) })} aria-label="Quantidade" />
                              <span className="muted small">{x.unit}s por</span>
                              <MoneyInput value={y.price} onChange={(n) => setSvc(x.id, { tiers: arr.map((z, j) => (j === i ? { ...z, price: n } : z)) })} />
                              <span className="muted small nowrap">{y.qty ? `= ${money(y.price / y.qty)} cada` : ''}</span>
                              <button type="button" className="icon-btn subtle" onClick={() => setSvc(x.id, { tiers: arr.filter((_, j) => j !== i) })} aria-label="Tirar pacote">
                                <Icon name="x" size={14} />
                              </button>
                            </div>
                          ))}
                          <button type="button" className="btn small ghost" onClick={() => setSvc(x.id, { tiers: [...(o.tiers ?? x.tiers), { qty: ((o.tiers ?? x.tiers).at(-1)?.qty ?? 0) + 5, price: 0 }] })}>
                            <Icon name="plus" size={14} /> pacote
                          </button>
                        </div>
                      )}
                      <button type="button" className="link small" onClick={() => setSvc(x.id, baseValues(x))} title="Volta os valores deste serviço para a sua tabela base (configurações → serviços e preços); plantas e incluso ficam">
                        voltar para a tabela base
                      </button>
                      <Field label="incluso (aparece na tabela)">
                        <textarea rows={2} value={o.incluso ?? ''} onChange={(e) => setSvc(x.id, { incluso: e.target.value })} placeholder={x.pricing === 'm2' ? 'Ex.: plantas: layout cotado; demolir e construir; hidráulica, elétrica…' : 'Ex.: uma revisão pontual por imagem.'} spellCheck lang="pt-BR" />
                      </Field>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {list.some((x) => !t.services[x.id]) && (
            <div className="pp-add">
              {adding ? (
                <>
                  <span className="field-label">incluir na tabela</span>
                  <div className="scope-chips">
                    {list
                      .filter((x) => !t.services[x.id])
                      .map((x) => (
                        <button key={x.id} type="button" className="scope-chip" onClick={() => include(x)} title={summary(x)}>
                          <Icon name="plus" size={12} /> {x.name}
                        </button>
                      ))}
                  </div>
                  <button type="button" className="link small" onClick={() => setAdding(false)}>
                    pronto
                  </button>
                </>
              ) : (
                <button type="button" className="btn small ghost" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={14} /> incluir serviço na tabela
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Section>
  )
}

const CX: { id: Complexity; label: string }[] = [
  { id: 'simples', label: 'simples' },
  { id: 'media', label: 'média' },
  { id: 'alta', label: 'alta' },
]
/** Plantas inclusas (toque para marcar, ou escreva) e complexidade: ajustam o m² da tabela. */
function PlantasPicker({ x, o, onChange }: { x: ServiceDef; o: PartnerPrice; onChange: (patch: Partial<PartnerPrice>) => void }) {
  const [custom, setCustom] = useState('')
  const picked = o.plantas ?? []
  const options = [...(x.checklist ?? []).filter((c) => c.trim()), ...picked.filter((p) => !(x.checklist ?? []).includes(p))]
  const toggle = (c: string) => onChange({ plantas: picked.includes(c) ? picked.filter((y) => y !== c) : [...picked, c] })
  const add = () => {
    const v = custom.trim()
    if (v && !picked.includes(v)) onChange({ plantas: [...picked, v] })
    setCustom('')
  }
  const weight = (c: string) => x.checklistPrices?.[c]
  return (
    <div className="pp-plantas">
      <span className="field-label">complexidade do projeto</span>
      <div className="pt-aud-pick" role="radiogroup">
        {CX.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={(o.complexity ?? 'media') === c.id} className={(o.complexity ?? 'media') === c.id ? 'is-on' : ''} onClick={() => onChange({ complexity: c.id })}>
            {c.label}
          </button>
        ))}
      </div>
      <span className="field-label">plantas inclusas {picked.length ? `(${picked.length})` : '(nenhuma marcada = projeto completo)'}</span>
      <div className="scope-chips">
        {options.map((c) => {
          const on = picked.includes(c)
          return (
            <button key={c} type="button" className={`scope-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(c)} title={weight(c) ? `peso ${weight(c)}%` : undefined}>
              {on && <Icon name="check" size={12} />}
              {c}
            </button>
          )
        })}
      </div>
      <div className="row gap-s">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="outra planta ou item (ex.: planta de pontos de tomada)" aria-label="Outra planta" />
        <button type="button" className="btn small ghost" onClick={add} disabled={!custom.trim()}>
          <Icon name="plus" size={14} /> incluir
        </button>
      </div>
    </div>
  )
}

/** "o que o cliente pediu": texto colado e/ou print/PDF → a IA marca serviços, plantas e complexidade na tabela. */
type AIFill = { servicos?: { id: string; plantas?: string[]; complexidade?: string; incluso?: string }[]; area?: number | null; resumo?: string }
function ClientAsk({ settings, onFill }: { settings: Settings; onFill: (r: AIFill) => void }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const key = settings.aiKey
  const add = async (list: FileList | null) => {
    if (!list) return
    const read = (await Promise.all([...list].map((f) => readFile(f).catch(() => null)))).filter((f): f is Attachment => !!f)
    setFiles((cur) => [...cur, ...read])
  }
  const run = async () => {
    if (!key) return toast('Coloque a chave do Gemini em configurações → assistente.')
    if (!text.trim() && !files.length) return toast('Cole o que o cliente pediu ou anexe o print/arquivo.')
    setBusy(true)
    setNote('')
    const svcs = settings.services
      .filter(usable)
      .map((x) => `- ${x.id}: ${x.name} (${x.pricing === 'm2' ? 'por m²' : x.pricing === 'pacote' ? `pacotes de ${x.unit}` : `por ${x.unit}`})${x.checklist?.filter((c) => c.trim()).length ? ` — opções: ${x.checklist!.filter((c) => c.trim()).join('; ')}` : ''}`)
      .join('\n')
    const system = `Você ajuda uma arquiteta freelancer a montar a tabela de valores de um orçamento de terceirização para um escritório parceiro.
Serviços dela (id: nome — forma de cobrar — opções):
${svcs}

Leia o pedido do cliente (texto, print ou PDF/planta) e responda SÓ com um JSON, sem nada antes ou depois:
{"servicos":[{"id":"<id da lista>","plantas":["<plantas/itens pedidos>"],"complexidade":"simples|media|alta","incluso":"<observação curta opcional>"}],"area":<m² aproximado ou null>,"resumo":"<1 ou 2 frases do que você entendeu do pedido>"}
Regras: use só ids da lista. Em "plantas", use os nomes das opções da lista quando corresponderem e escreva outros itens quando o cliente pedir algo fora da lista (ex.: "planta de pontos de tomada"). Complexidade: simples (pouco detalhe, poucos ambientes), media (o comum), alta (muitos ambientes, muito detalhe, curvas, vários pavimentos). Se o pedido não citar plantas, deixe "plantas" vazio (vale o projeto completo).`
    try {
      const out = await askGemini(key, system, [{ role: 'user', text: text.trim() || 'Veja o anexo com o pedido do cliente.', files }])
      const m = out.match(/\{[\s\S]*\}/)
      const r = m ? (JSON.parse(m[0]) as AIFill) : null
      if (!r?.servicos?.length) throw new Error('A IA não identificou serviços no pedido. Tente colar o texto com mais detalhes.')
      onFill(r)
      setNote(`${r.resumo ?? ''}${r.area ? ` · área aproximada: ${r.area} m²` : ''}`)
      toast('Tabela preenchida pelo pedido do cliente. Confira e ajuste o que quiser.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para ler o pedido agora.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pp-ask">
      <span className="field-label">o que o cliente pediu</span>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} onPaste={(e) => e.clipboardData.files.length && (e.preventDefault(), void add(e.clipboardData.files))} placeholder="Cole aqui a mensagem do cliente (ou cole/anexe o print, a planta ou o PDF)" spellCheck lang="pt-BR" />
      {files.length > 0 && (
        <div className="scope-chips">
          {files.map((f, i) => (
            <span key={i} className="scope-chip on">
              <Icon name="file" size={12} /> {f.name}
              <button type="button" className="link small" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Tirar ${f.name}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="row gap-s wrap">
        <label className="btn small ghost">
          <Icon name="clip" size={14} /> anexar print ou arquivo
          <input type="file" accept="image/*,.heic,.heif,application/pdf" multiple hidden onChange={(e) => (void add(e.target.files), (e.target.value = ''))} />
        </label>
        <button type="button" className="btn small primary" disabled={busy} onClick={run}>
          <Icon name="sparkle" size={14} /> {busy ? 'lendo o pedido…' : 'preencher a tabela com a IA'}
        </button>
      </div>
      {note && <p className="muted small" style={{ margin: 0 }}>{note}</p>}
    </div>
  )
}
