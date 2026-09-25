import { useState } from 'react'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { ClientForm } from '../components/forms'
import { QuoteDoc } from '../components/Docs'
import { DocScale, usePdf } from '../components/Print'
import { Badge, Empty, Field, MoneyInput, Section, Segmented } from '../components/ui'
import { askDelete, toast } from '../components/dialog'
import type { Complexity, Quote, QuoteItem, QuoteOption, QuoteStatus } from '../types'
import { projectFromQuote } from '../quoteActions'
import {
  COMPLEXITY,
  QUOTE_STATUS,
  addDays,
  fmtDateLong,
  isStudent,
  itemDetail,
  money,
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
const newOption = (n: number): QuoteOption => ({ id: uid(), name: n === 1 ? 'essencial' : 'completo', summary: '', included: [''], deadlineDays: 10, price: 0 })

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
        options: [newOption(1), newOption(2)],
        chosenOption: '',
        discount: 0,
        discountNote: '',
        files: settings.proposal.files,
        urgency: false,
        deadlineDays: 10,
        validityDays: 15,
        revisions: settings.defaultRevisions,
        paymentTerms: settings.defaultPaymentTerms,
        notes: '',
        status: 'rascunho',
        sentAt: '',
        createdAt: today(),
        projectId: '',
      },
  )
  const [newClient, setNewClient] = useState(false)
  const [dirty, setDirty] = useState(!existing)
  const [view, setView] = useState<'editar' | 'ver'>('editar')
  const pdf = usePdf()

  if (id !== 'novo' && !existing) return <Empty title="Orçamento não encontrado" action={<a className="btn" href={href('orcamentos')}>Voltar</a>} />

  const client = data.clients.find((c) => c.id === q.clientId)
  const student = isStudent(client)
  const service = (sid: string) => settings.services.find((s) => s.id === sid)

  const set = (patch: Partial<Quote>) => {
    setQ((x) => ({ ...x, ...patch }))
    setDirty(true)
  }

  /** Recalcula detalhe e valor do item quando ele segue a tabela. */
  const recompute = (it: QuoteItem, stud = student): QuoteItem => {
    const s = service(it.service)
    const detail = itemDetail(s, it.quantity, it.complexity)
    return {
      ...it,
      detail: it.auto || !it.detail ? detail : it.detail,
      price: it.auto && s && s.pricing !== 'livre' ? Math.max(0, suggestPrice(s, it.quantity, it.complexity, stud, settings) - (it.unitDiscount ?? 0) * it.quantity) : it.price,
    }
  }
  const setItem = (iid: string, patch: Partial<QuoteItem>) => {
    const items = q.items.map((i) => (i.id === iid ? recompute({ ...i, ...patch }) : i))
    // a área do primeiro serviço por m² vira a área do projeto (se ainda estiver vazia)
    const m2 = items.find((i) => service(i.service)?.pricing === 'm2')
    set({ items, ...(!q.area && m2 && patch.quantity !== undefined ? { area: m2.quantity } : {}) })
  }
  const setOption = (oid: string, patch: Partial<QuoteOption>) => set({ options: q.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) })

  const sub = quoteSubtotal(q)
  const total = quoteTotal(q, settings.urgencyFee)
  const two = q.mode === 'opcoes'

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

  const text = () => {
    const first = client?.name.split(' ')[0] ?? ''
    const head = [`*Orçamento Nº ${quoteNumber(q)} — ${q.title}*`, `Olá, ${first}! Segue a proposta:`, '']
    const body = two
      ? q.options.flatMap((o, i) => [
          `*Opção ${i + 1} · ${o.name}* — ${money(o.price)}`,
          ...o.included.filter(Boolean).map((x) => `• ${x}`),
          `prazo: ${o.deadlineDays} dias úteis`,
          '',
        ])
      : [
          ...q.items.map((i) => `• ${i.title}${i.detail ? ` · ${i.detail}` : ''} — ${money(i.price)}`),
          q.urgency ? `• Taxa de urgência (${settings.urgencyFee}%) — ${money((sub * settings.urgencyFee) / 100)}` : '',
          q.discount ? `• Desconto — −${money(q.discount)}` : '',
          '',
          `*Investimento: ${money(total)}*`,
          `Prazo: ${q.deadlineDays} dias úteis após o sinal · ${q.revisions} rodada(s) de ajuste`,
        ]
    return [...head, ...body, q.paymentTerms ? `Pagamento: ${q.paymentTerms.replace(/\n/g, ' ')}` : '', `Válido até ${fmtDateLong(addDays(q.createdAt, q.validityDays))}.`]
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
            nº {quoteNumber(q)} <Badge color={QUOTE_STATUS[q.status].color}>{QUOTE_STATUS[q.status].label}</Badge>
          </p>
          <h1>{q.title || 'novo orçamento'}</h1>
        </div>
        <div className="row gap-s wrap">
          {q.pdf && (
            <button className="btn primary" disabled={pdf.busy} onClick={() => pdf.download(preview, `Orçamento ${quoteNumber(q)} - ${q.clientLabel || client?.name || 'cliente'}.pdf`)}>
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
              <Field label="Projeto" span={2}>
                <input id="q-title" value={q.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Casa Pampulha — áreas sociais" />
              </Field>
              <Field label="Cliente">
                <div className="row gap-s">
                  <select
                    id="q-client"
                    value={q.clientId}
                    onChange={(e) => {
                      const c = data.clients.find((x) => x.id === e.target.value)
                      set({ clientId: e.target.value, items: q.items.map((i) => recompute(i, isStudent(c))) })
                    }}
                  >
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
                  <button className="btn ghost small" onClick={() => setNewClient(true)} title="Novo cliente">
                    +
                  </button>
                </div>
              </Field>
              <Field label="Modelo da proposta" span={2}>
                <Segmented
                  value={q.mode}
                  onChange={(mode) => set({ mode, options: q.options.length ? q.options : [newOption(1), newOption(2)] })}
                  options={[
                    { value: 'escopo', label: 'escopo com valor único' },
                    { value: 'opcoes', label: '2 opções para escolher' },
                  ]}
                />
              </Field>
              <Field label="Nome na proposta" hint="Aparece em “para …” e na assinatura.">
                <input id="q-label" value={q.clientLabel} onChange={(e) => set({ clientLabel: e.target.value })} placeholder={client?.name ?? 'nome do cliente'} />
              </Field>
              <Field label="Área do projeto (m²)" hint="Opcional — aparece na legenda da proposta.">
                <input id="q-area" type="number" min={0} value={q.area || ''} onChange={(e) => set({ area: Number(e.target.value) || 0 })} placeholder="—" />
              </Field>
              <Field label="Proposta em PDF">
                <label className="check toggle">
                  <input id="q-pdf" type="checkbox" checked={q.pdf} onChange={(e) => set({ pdf: e.target.checked })} /> gerar PDF com o design da proposta
                </label>
              </Field>
              <Field label="Data">
                <input id="q-date" type="date" value={q.createdAt} onChange={(e) => set({ createdAt: e.target.value || today() })} />
              </Field>
            </div>
            {student && <p className="small text-warn">Cliente estudante: sugestões com {settings.studentDiscount}% de desconto.</p>}
          </Section>

          {!two ? (
            <Section
              title="escopo"
              action={
                <button className="btn small" onClick={() => set({ items: [...q.items, newItem()] })}>
                  <Icon name="plus" size={14} /> serviço
                </button>
              }
            >
              <div className="q-items">
                {q.items.map((it, n) => {
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
                        <button className="icon-btn subtle" onClick={() => set({ items: q.items.filter((x) => x.id !== it.id) })} aria-label="Remover serviço">
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                      <div className="q-item-grid">
                        <Field label="Nome na proposta">
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
                        <Field label="Detalhe (ao lado do nome)">
                          <input value={it.detail} onChange={(e) => set({ items: q.items.map((i) => (i.id === it.id ? { ...i, detail: e.target.value } : i)) })} placeholder="Ex.: 5 imagens" />
                        </Field>
                        <Field label="O que está incluso" span={2}>
                          <input value={it.description} onChange={(e) => setItem(it.id, { description: e.target.value })} placeholder="Ambientes, nível de detalhe, ajustes…" />
                        </Field>
                        {s && (s.pricing === 'pacote' || s.pricing === 'unidade') && (
                          <Field label={`Desconto por ${s.unit}`} hint={it.unitDiscount ? `fica ${money(Math.max(0, rate || s.price) - it.unitDiscount)}/${s.unit}` : 'opcional'}>
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
              </div>
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
                  <span>investimento</span>
                  <b>{money(total)}</b>
                </div>
                <Field label="Nota abaixo do valor (opcional)" hint="Em branco, o sistema escreve o desconto sozinho.">
                  <input value={q.discountNote} onChange={(e) => set({ discountNote: e.target.value })} placeholder="Ex.: valor especial para pacote fechado" />
                </Field>
              </div>
            </Section>
          ) : (
            <Section title="opções">
              <div className="q-options">
                {q.options.slice(0, 2).map((o, n) => (
                  <div key={o.id} className="q-item">
                    <div className="q-item-head">
                      <span className="q-n">opção {n + 1}</span>
                      <label className="check small">
                        <input type="radio" name="chosen" checked={q.chosenOption === o.id} onChange={() => set({ chosenOption: o.id })} /> cliente escolheu esta
                      </label>
                    </div>
                    <Field label="Nome do escopo">
                      <input value={o.name} onChange={(e) => setOption(o.id, { name: e.target.value })} />
                    </Field>
                    <Field label="Resumo">
                      <input value={o.summary} onChange={(e) => setOption(o.id, { summary: e.target.value })} placeholder="O que esta opção entrega" />
                    </Field>
                    <Field label="Itens inclusos" hint="Um por linha.">
                      <textarea rows={4} value={o.included.join('\n')} onChange={(e) => setOption(o.id, { included: e.target.value.split('\n') })} />
                    </Field>
                    <div className="form-grid two">
                      <Field label="Prazo (dias úteis)">
                        <input type="number" min={1} value={o.deadlineDays} onChange={(e) => setOption(o.id, { deadlineDays: Number(e.target.value) || 0 })} />
                      </Field>
                      <Field label="Investimento">
                        <MoneyInput value={o.price} onChange={(v) => setOption(o.id, { price: v })} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <PriceHelper />
            </Section>
          )}

          <Section title="condições">
            <div className="form-grid">
              {!two && (
                <Field label="Prazo (dias úteis)">
                  <input type="number" min={1} value={q.deadlineDays} onChange={(e) => set({ deadlineDays: Number(e.target.value) || 0 })} />
                </Field>
              )}
              <Field label="Rodadas de ajuste">
                <input type="number" min={0} value={q.revisions} onChange={(e) => set({ revisions: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Validade (dias)">
                <input type="number" min={1} value={q.validityDays} onChange={(e) => set({ validityDays: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Pagamento" span={3}>
                <textarea rows={2} value={q.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
              </Field>
              <Field label="Arquivos entregues" span={3}>
                <input value={q.files} onChange={(e) => set({ files: e.target.value })} placeholder="imagens JPG em alta, modelo .skp, pranchas em PDF" />
              </Field>
              <Field label="Observações (opcional)" span={3}>
                <textarea rows={2} value={q.notes} onChange={(e) => set({ notes: e.target.value })} />
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
              <Icon name="check" size={16} /> {q.projectId ? 'abrir projeto criado' : 'aprovado → criar projeto'}
            </button>
            <div className="row gap-s wrap">
              {existing && (
                <button
                  className="btn ghost small"
                  onClick={() => {
                    const copy: Quote = {
                      ...q,
                      id: uid(),
                      number: Math.max(0, ...data.quotes.map((x) => x.number)) + 1,
                      title: `${q.title} (cópia)`,
                      items: q.items.map((i) => ({ ...i, id: uid() })),
                      options: q.options.map((o) => ({ ...o, id: uid() })),
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
                    if (await askDelete(`o orçamento Nº ${quoteNumber(q)}`)) {
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
            Pré-visualização do PDF · textos e cores em{' '}
            <a className="link" href={href('config')}>
              configurações
            </a>
          </p>
        </aside>
        )}
      </div>

      {newClient && <ClientForm onClose={() => setNewClient(false)} onSaved={(c) => set({ clientId: c.id })} />}
      {pdf.portal}
    </div>
  )
}

/** Calculadora rápida pela tabela, para montar o valor das opções. */
function PriceHelper() {
  const { data } = useStore()
  const { settings } = data
  const priced = settings.services.filter((x) => x.pricing !== 'livre')
  const [sid, setSid] = useState(priced[0]?.id ?? '')
  const [qty, setQty] = useState(10)
  const [cx, setCx] = useState<Complexity>('media')
  const s = settings.services.find((x) => x.id === sid)
  return (
    <div className="price-helper">
      <span className="field-label">calculadora da tabela</span>
      <div className="row gap-s wrap">
        <select value={sid} onChange={(e) => setSid(e.target.value)} style={{ width: 'auto' }}>
          {priced.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <input type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} style={{ width: 90 }} aria-label="Quantidade" />
        <span className="muted small">{s?.pricing === 'm2' ? 'm²' : s?.unit}</span>
        {s?.pricing === 'm2' && (
          <select value={cx} onChange={(e) => setCx(e.target.value as Complexity)} style={{ width: 'auto' }}>
            {(Object.keys(COMPLEXITY) as Complexity[]).map((k) => (
              <option key={k} value={k}>
                {COMPLEXITY[k]}
              </option>
            ))}
          </select>
        )}
        <b>= {money(suggestPrice(s, qty, cx, false, settings))}</b>
      </div>
    </div>
  )
}
