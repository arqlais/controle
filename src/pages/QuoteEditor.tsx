import { useState } from 'react'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { ClientForm } from '../components/forms'
import { QuoteDoc } from '../components/Docs'
import { DocScale, usePdf } from '../components/Print'
import { Badge, Empty, Field, MoneyInput, Section, Segmented } from '../components/ui'
import { askDelete, toast } from '../components/dialog'
import type { Complexity, Quote, QuoteItem, QuoteOption, QuoteStatus, Settings } from '../types'
import { projectFromQuote } from '../quoteActions'
import {
  COMPLEXITY,
  QUOTE_STATUS,
  addDays,
  fmtDateLong,
  isStudent,
  itemDetail,
  money,
  optionTotal,
  quoteNumber,
  quoteSubtotal,
  quoteTotal,
  suggestPrice,
  today,
  uid,
  unitRate,
  whatsappLink,
} from '../utils'

const newItem = (): QuoteItem => ({ id: uid(), service: '', title: '', detail: '', description: '', quantity: 1, complexity: 'media', price: 0, auto: true })
const newOption = (): QuoteOption => ({ id: uid(), name: '', items: [newItem()], note: '', discount: 0, discountNote: '', deadlineDays: 10 })

export default function QuoteEditor({ id }: { id: string }) {
  const { data, upsert, remove } = useStore()
  const { settings } = data
  const existing = data.quotes.find((q) => q.id === id)
  const [q, setQ] = useState<Quote>(
    () =>
      existing ?? {
        id: uid(),
        number: Math.max(0, ...data.quotes.filter((x) => x.createdAt.slice(0, 4) === today().slice(0, 4)).map((x) => x.number)) + 1,
        clientId: '',
        title: '',
        mode: 'escopo',
        pdf: false,
        area: 0,
        clientLabel: '',
        items: [newItem()],
        options: [newOption(), newOption()],
        chosenOption: '',
        discount: 0,
        discountNote: '',
        files: settings.proposal.files,
        schedule: settings.proposal.schedule,
        urgency: false,
        deadlineDays: 10,
        validityDays: 15,
        revisions: settings.defaultRevisions,
        paymentTerms: settings.defaultPaymentTerms,
        notes: '',
        status: 'rascunho',
        sentAt: '',
        createdAt: today(), // a data da proposta é o dia em que ela é montada
        projectId: '',
      },
  )
  const [newClient, setNewClient] = useState(false)
  const [editClient, setEditClient] = useState(false)
  const [dirty, setDirty] = useState(!existing)
  const [view, setView] = useState<'editar' | 'ver'>('editar')
  const pdf = usePdf()

  if (id !== 'novo' && !existing) return <Empty title="Orçamento não encontrado" action={<a className="btn" href={href('orcamentos')}>Voltar</a>} />

  const client = data.clients.find((c) => c.id === q.clientId)
  const student = isStudent(client)
  const two = q.mode === 'opcoes'
  const displayName = client?.name || 'cliente'

  const set = (patch: Partial<Quote>) => {
    setQ((x) => ({ ...x, ...patch }))
    setDirty(true)
  }
  /** Primeira metragem digitada num serviço por m² vira a área da proposta (se vazia). */
  const withArea = (items: QuoteItem[]) => {
    const m2 = items.find((i) => settings.services.find((s) => s.id === i.service)?.pricing === 'm2')
    return !q.area && m2 ? { area: m2.quantity } : {}
  }
  const setOption = (oid: string, patch: Partial<QuoteOption>) => set({ options: q.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)), ...(patch.items ? withArea(patch.items) : {}) })

  const sub = quoteSubtotal(q)
  const total = quoteTotal(q, settings.urgencyFee)

  const save = (patch: Partial<Quote> = {}) => {
    const next = { ...q, ...patch }
    if (next.status !== 'rascunho' && !next.sentAt) next.sentAt = today()
    if (!next.clientId) {
      toast('Escolha o cliente.')
      return null
    }
    upsert('quotes', next)
    setQ(next)
    setDirty(false)
    if (id === 'novo') go('orcamentos', next.id)
    return next
  }

  const line = (i: QuoteItem) => `• ${i.title || 'serviço'}${i.detail ? ` · ${i.detail}` : ''} — ${money(i.price)}`
  const text = () => {
    const first = client?.name.split(' ')[0] ?? ''
    const head = [`*Proposta ${quoteNumber(q)}${q.title ? ` — ${q.title}` : ''}*`, `Olá, ${first}! Segue o orçamento:`, '']
    const body = two
      ? q.options.slice(0, 2).flatMap((o, i) => [`*Opção ${i + 1}${o.name ? ` · ${o.name}` : ''}*`, ...o.items.map(line), `Total: ${money(optionTotal(o))}`, ''])
      : [...q.items.map(line), q.urgency ? `• Taxa de urgência (${settings.urgencyFee}%) — ${money((sub * settings.urgencyFee) / 100)}` : '', q.discount ? `• Desconto — −${money(q.discount)}` : '', '', `*Investimento total: ${money(total)}*`]
    return [...head, ...body, q.paymentTerms ? `Pagamento: ${q.paymentTerms}` : '', q.schedule ? `Prazos: ${q.schedule}` : '', `Válido até ${fmtDateLong(addDays(q.createdAt, q.validityDays))}.`]
      .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
      .join('\n')
  }

  const approve = () => {
    if (two && !q.chosenOption) return toast('Marque qual opção o cliente escolheu.')
    const saved = save({ status: 'aprovado' })
    if (!saved) return
    if (saved.projectId && data.projects.some((p) => p.id === saved.projectId)) return go('projetos', saved.projectId)
    const project = projectFromQuote(saved, settings.urgencyFee)
    upsert('projects', project)
    upsert('quotes', { ...saved, projectId: project.id })
    go('projetos', project.id)
  }

  const preview = <QuoteDoc s={settings} client={client} quote={q} />

  return (
    <div className="page">
      <a href={href('orcamentos')} className="back">
        <Icon name="chevronL" size={16} /> orçamentos
      </a>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            proposta {quoteNumber(q)} · {fmtDateLong(q.createdAt)} <Badge color={QUOTE_STATUS[q.status].color}>{QUOTE_STATUS[q.status].label}</Badge>
          </p>
          <h1>{q.title || 'novo orçamento'}</h1>
        </div>
        <div className="row gap-s wrap">
          {q.pdf && (
            <button className="btn primary" disabled={pdf.busy} onClick={() => pdf.download(preview, `Proposta ${quoteNumber(q)} - ${displayName}.pdf`)}>
              <Icon name="download" size={16} /> {pdf.busy ? 'gerando…' : 'baixar PDF'}
            </button>
          )}
          {client?.phone && (
            <a
              className="btn ghost"
              href={whatsappLink(client.phone, text())}
              target="_blank"
              rel="noreferrer"
              onClick={() => q.status === 'rascunho' && save({ status: 'enviado' })}
              title="Abre o WhatsApp com o resumo; anexe o PDF na conversa"
            >
              <Icon name="whatsapp" size={16} /> enviar
            </a>
          )}
          <button
            className="btn ghost"
            onClick={() =>
              navigator.clipboard
                ?.writeText(text())
                .then(() => toast('Resumo copiado.'))
                .catch(() => toast('Não deu para copiar aqui.'))
            }
          >
            <Icon name="copy" size={16} /> copiar resumo
          </button>
          <button className={`btn ${dirty ? 'primary' : 'ghost'}`} onClick={() => save()} disabled={!dirty}>
            {dirty ? 'salvar' : 'salvo'}
          </button>
        </div>
      </div>

      <div className={`mobile-switch ${q.pdf ? '' : 'is-hidden'}`}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'editar', label: 'editar' },
            { value: 'ver', label: 'ver proposta' },
          ]}
        />
      </div>

      <div className={`quote-layout view-${q.pdf ? view : 'editar'} ${q.pdf ? '' : 'no-preview'}`}>
        <div className="stack quote-form">
          <Section title="dados">
            <div className="form-grid">
              <Field label="Cliente" span={3} hint="O nome da cliente vai no campo “nome” da proposta.">
                <div className="row gap-s">
                  <select id="q-client" value={q.clientId} onChange={(e) => set({ clientId: e.target.value })}>
                    <option value="">Selecione…</option>
                    {[...data.clients]
                      .filter((c) => !c.archived)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.company ? ` · ${c.company}` : ''}
                        </option>
                      ))}
                  </select>
                  {client && (
                    <button className="btn ghost small" onClick={() => setEditClient(true)} title="Editar dados da cliente">
                      <Icon name="edit" size={14} />
                    </button>
                  )}
                  <button className="btn ghost small" onClick={() => setNewClient(true)} title="Novo cliente">
                    +
                  </button>
                </div>
              </Field>
              <Field label="Projeto / título do quadro" span={2} hint="Aparece no topo do quadro de serviços.">
                <input id="q-title" value={q.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: renderização Casa Pampulha" />
              </Field>
              <Field label="Área (m²) · opcional" hint="Só para modelagem, executivo, detalhamento… Vazio = não aparece no PDF.">
                <input id="q-area" type="number" min={0} value={q.area || ''} onChange={(e) => set({ area: Number(e.target.value) || 0 })} placeholder="—" />
              </Field>
              <Field label="Modelo" span={2}>
                <Segmented
                  value={q.mode}
                  onChange={(mode) => set({ mode, options: q.options.length >= 2 ? q.options : [newOption(), newOption()] })}
                  options={[
                    { value: 'escopo', label: 'valor único' },
                    { value: 'opcoes', label: '2 opções' },
                  ]}
                />
              </Field>
              <Field label="PDF">
                <label className="check toggle">
                  <input id="q-pdf" type="checkbox" checked={q.pdf} onChange={(e) => set({ pdf: e.target.checked })} /> gerar proposta em PDF
                </label>
              </Field>
            </div>
            {student && <p className="small text-warn">Cliente estudante: sugestões com {settings.studentDiscount}% de desconto.</p>}
          </Section>

          {!two ? (
            <Section title="serviços">
              <ItemsEditor items={q.items} student={student} settings={settings} onChange={(items) => set({ items, ...withArea(items) })} />
              <div className="quote-totals">
                <div>
                  <span>subtotal</span>
                  <b>{money(sub)}</b>
                </div>
                <label className="check">
                  <input type="checkbox" checked={q.urgency} onChange={(e) => set({ urgency: e.target.checked })} /> taxa de urgência (+{settings.urgencyFee}%)
                  {q.urgency && <b>{money((sub * settings.urgencyFee) / 100)}</b>}
                </label>
                <div className="discount-row">
                  <span>desconto</span>
                  {[5, 10, 15].map((pct) => (
                    <button key={pct} className="btn small ghost" onClick={() => set({ discount: Math.round(sub * (1 + (q.urgency ? settings.urgencyFee / 100 : 0)) * pct) / 100 })}>
                      {pct}%
                    </button>
                  ))}
                  <MoneyInput value={q.discount} onChange={(n) => set({ discount: n })} />
                </div>
                <div className="grand">
                  <span>investimento total</span>
                  <b>{money(total)}</b>
                </div>
                <Field label="Texto abaixo do total" hint="Em branco, o sistema escreve o desconto sozinho.">
                  <input value={q.discountNote} onChange={(e) => set({ discountNote: e.target.value })} placeholder="Ex.: valor especial para pacote fechado" />
                </Field>
              </div>
              <Field label="Observação (dentro do quadro)">
                <textarea rows={2} value={q.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Opcional" />
              </Field>
            </Section>
          ) : (
            q.options.slice(0, 2).map((o, n) => (
              <Section
                key={o.id}
                title={`opção ${n + 1}`}
                action={
                  <label className="check small">
                    <input type="radio" name="chosen" checked={q.chosenOption === o.id} onChange={() => set({ chosenOption: o.id })} /> cliente escolheu esta
                  </label>
                }
              >
                <Field label="Título do quadro" hint="Em branco, usa o título do projeto.">
                  <input value={o.name} onChange={(e) => setOption(o.id, { name: e.target.value })} placeholder={q.title || 'Ex.: renderização V-Ray'} />
                </Field>
                <ItemsEditor items={o.items} student={student} settings={settings} onChange={(items) => setOption(o.id, { items })} />
                <div className="quote-totals">
                  <div className="discount-row">
                    <span>desconto</span>
                    <MoneyInput value={o.discount} onChange={(n) => setOption(o.id, { discount: n })} />
                  </div>
                  <div className="grand">
                    <span>total</span>
                    <b>{money(optionTotal(o))}</b>
                  </div>
                  <Field label="Texto abaixo do total" hint="Em branco, o sistema escreve o desconto sozinho.">
                    <input value={o.discountNote} onChange={(e) => setOption(o.id, { discountNote: e.target.value })} />
                  </Field>
                </div>
                <div className="form-grid two">
                  <Field label="Observação (dentro do quadro)">
                    <input value={o.note} onChange={(e) => setOption(o.id, { note: e.target.value })} placeholder="Opcional" />
                  </Field>
                  <Field label="Prazo interno (dias úteis)" hint="Para o prazo da demanda; não vai no PDF.">
                    <input type="number" min={1} value={o.deadlineDays} onChange={(e) => setOption(o.id, { deadlineDays: Number(e.target.value) || 0 })} />
                  </Field>
                </div>
              </Section>
            ))
          )}

          <Section title="informações da proposta">
            <div className="form-grid">
              <Field label="Pagamento" span={3}>
                <input value={q.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
              </Field>
              <Field label="Prazos e cronograma" span={3}>
                <input value={q.schedule} onChange={(e) => set({ schedule: e.target.value })} placeholder="Ex.: 10 dias úteis após o sinal." />
              </Field>
              <Field label="Formatos de arquivos entregues" span={3}>
                <input value={q.files} onChange={(e) => set({ files: e.target.value })} placeholder="PDF e arquivo editável do layout." />
              </Field>
              {!two && (
                <Field label="Prazo interno (dias úteis)" hint="Para o prazo da demanda.">
                  <input type="number" min={1} value={q.deadlineDays} onChange={(e) => set({ deadlineDays: Number(e.target.value) || 0 })} />
                </Field>
              )}
              <Field label="Rodadas de ajuste" hint="Controle interno.">
                <input type="number" min={0} value={q.revisions} onChange={(e) => set({ revisions: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Validade (dias)" hint="Para lembrar de cobrar resposta.">
                <input type="number" min={1} value={q.validityDays} onChange={(e) => set({ validityDays: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          </Section>

          <Section title="status">
            <Segmented<QuoteStatus>
              value={q.status}
              onChange={(s) => (existing ? save({ status: s }) : set({ status: s }))}
              options={(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((k) => ({ value: k, label: QUOTE_STATUS[k].label }))}
            />
            <button className="btn primary block" onClick={approve}>
              <Icon name="check" size={16} /> {q.projectId ? 'abrir demanda criada' : 'aprovado → criar demanda'}
            </button>
            <div className="row gap-s wrap">
              {existing && (
                <button
                  className="btn ghost small"
                  onClick={() => {
                    const copy: Quote = {
                      ...q,
                      id: uid(),
                      number: Math.max(0, ...data.quotes.filter((x) => x.createdAt.slice(0, 4) === today().slice(0, 4)).map((x) => x.number)) + 1,
                      title: `${q.title} (cópia)`,
                      items: q.items.map((i) => ({ ...i, id: uid() })),
                      options: q.options.map((o) => ({ ...o, id: uid(), items: o.items.map((i) => ({ ...i, id: uid() })) })),
                      chosenOption: '',
                      status: 'rascunho',
                      sentAt: '',
                      createdAt: today(),
                      projectId: '',
                    }
                    upsert('quotes', copy)
                    go('orcamentos', copy.id)
                    toast('Orçamento duplicado como rascunho.')
                  }}
                >
                  <Icon name="copy" size={14} /> duplicar
                </button>
              )}
              {existing && (
                <button
                  className="btn ghost danger small"
                  onClick={async () => {
                    if (await askDelete(`a proposta ${quoteNumber(q)}`)) {
                      remove('quotes', q.id)
                      go('orcamentos')
                    }
                  }}
                >
                  <Icon name="trash" size={14} /> excluir
                </button>
              )}
            </div>
          </Section>
        </div>

        {q.pdf && (
          <aside className="quote-preview">
            <DocScale>{preview}</DocScale>
            <p className="muted small center">
              Pré-visualização do PDF · cores e textos padrão em{' '}
              <a className="link" href={href('config')}>
                configurações
              </a>
            </p>
          </aside>
        )}
      </div>

      {newClient && <ClientForm onClose={() => setNewClient(false)} onSaved={(c) => set({ clientId: c.id })} />}
      {editClient && client && <ClientForm initial={client} onClose={() => setEditClient(false)} />}
      {pdf.portal}
    </div>
  )
}

/** Lista de serviços com preço pela tabela, desconto por unidade e valor editável. */
function ItemsEditor({ items, student, settings, onChange }: { items: QuoteItem[]; student: boolean; settings: Settings; onChange: (items: QuoteItem[]) => void }) {
  const service = (sid: string) => settings.services.find((s) => s.id === sid)

  const recompute = (it: QuoteItem): QuoteItem => {
    const s = service(it.service)
    return {
      ...it,
      detail: it.auto || !it.detail ? itemDetail(s, it.quantity, it.complexity) : it.detail,
      price: it.auto && s && s.pricing !== 'livre' ? Math.max(0, suggestPrice(s, it.quantity, it.complexity, student, settings) - (it.unitDiscount ?? 0) * it.quantity) : it.price,
    }
  }
  const setItem = (iid: string, patch: Partial<QuoteItem>) => onChange(items.map((i) => (i.id === iid ? recompute({ ...i, ...patch }) : i)))

  return (
    <div className="q-items">
      {items.map((it, n) => {
        const s = service(it.service)
        const suggestion = suggestPrice(s, it.quantity, it.complexity, student, settings)
        const rate = s && (s.pricing === 'pacote' || s.pricing === 'unidade') ? unitRate(s, it.quantity) : 0
        return (
          <div key={it.id} className="q-item">
            <div className="q-item-head">
              <span className="q-n">{String(n + 1).padStart(2, '0')}</span>
              <select
                value={it.service}
                onChange={(e) => {
                  const ns = service(e.target.value)
                  setItem(it.id, {
                    service: e.target.value,
                    title: ns?.name ?? it.title,
                    quantity: ns?.pricing === 'm2' ? Math.max(it.quantity, 50) : ns?.pricing === 'livre' ? 1 : it.quantity > 40 ? 1 : it.quantity,
                    auto: true,
                    detail: '',
                  })
                }}
              >
                <option value="">Personalizado (valor livre)</option>
                {settings.services.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <button className="icon-btn subtle" onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label="Remover serviço">
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="q-item-grid">
              <Field label="Serviço (na proposta)">
                <input value={it.title} onChange={(e) => setItem(it.id, { title: e.target.value })} placeholder="Ex.: Renderização V-Ray" />
              </Field>
              {s && s.pricing !== 'livre' && (
                <Field label={s.pricing === 'm2' ? 'Área (m²)' : `Quantidade (${s.unit})`}>
                  <input type="number" min={0} value={it.quantity} onChange={(e) => setItem(it.id, { quantity: Number(e.target.value) || 0 })} />
                </Field>
              )}
              {s?.pricing === 'm2' && (
                <Field label="Complexidade">
                  <Segmented<Complexity>
                    value={it.complexity}
                    onChange={(c) => setItem(it.id, { complexity: c })}
                    options={(Object.keys(COMPLEXITY) as Complexity[]).map((k) => ({ value: k, label: COMPLEXITY[k] }))}
                  />
                </Field>
              )}
              <Field label="Detalhe (ao lado do serviço)">
                <input value={it.detail} onChange={(e) => onChange(items.map((i) => (i.id === it.id ? { ...i, detail: e.target.value } : i)))} placeholder="Ex.: 5 imagens" />
              </Field>
              <Field label="O que está incluso" span={2}>
                <input value={it.description} onChange={(e) => setItem(it.id, { description: e.target.value })} placeholder="Ambientes, nível de detalhe…" />
              </Field>
              {s && (s.pricing === 'pacote' || s.pricing === 'unidade') && (
                <Field label={`Desconto por ${s.unit}`} hint={it.unitDiscount ? `fica ${money(Math.max(0, rate - it.unitDiscount))}/${s.unit}` : 'opcional'}>
                  <MoneyInput value={it.unitDiscount ?? 0} onChange={(v) => setItem(it.id, { unitDiscount: v, auto: true })} />
                </Field>
              )}
              <Field
                label="Valor"
                hint={
                  s && s.pricing !== 'livre'
                    ? `tabela: ${money(suggestion)}${rate ? ` · ${money(rate)}/${s.unit}` : ''}${s.pricing === 'm2' ? ` · ${money(s.price)}/m² × ${settings.complexity[it.complexity]}` : ''}`
                    : 'digite o valor'
                }
              >
                <div className="row gap-s">
                  <MoneyInput value={it.price} onChange={(v) => setItem(it.id, { price: v, auto: false })} />
                  {!it.auto && s && s.pricing !== 'livre' && (
                    <button className="btn small ghost" onClick={() => setItem(it.id, { auto: true })} title="Voltar ao valor da tabela">
                      tabela
                    </button>
                  )}
                </div>
              </Field>
            </div>
          </div>
        )
      })}
      <button className="btn small ghost add-item" onClick={() => onChange([...items, newItem()])}>
        <Icon name="plus" size={14} /> serviço
      </button>
    </div>
  )
}
