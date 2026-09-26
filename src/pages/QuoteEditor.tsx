import { useState } from 'react'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { ClientForm } from '../components/forms'
import { QuoteDoc } from '../components/Docs'
import { DocScale, usePdf } from '../components/Print'
import { Badge, Empty, Field, Modal, MoneyInput, Section, Segmented } from '../components/ui'
import { askDelete, toast } from '../components/dialog'
import { MessagesButton } from '../components/Messages'
import type { Complexity, Quote, QuoteItem, QuoteOption, QuoteStatus, ServiceDef, Settings } from '../types'
import { CloseDeal } from '../components/quick'
import {
  canOpenFile,
  quoteFiles,
  checklistMatch,
  checklistPrice,
  checklistRate,
  pricedByList,
  parseScopeReply,
  scopeQuestion,
  daysBetween,
  nextQuoteNumber,
  COMPLEXITY,
  QUOTE_STATUS,
  cleanDetail,
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
        number: nextQuoteNumber(data),
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
        filesAuto: true,
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
  const setOption = (oid: string, patch: Partial<QuoteOption>) => set({ options: q.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) })

  const sub = quoteSubtotal(q)
  const total = quoteTotal(q, settings.urgencyFee)

  // arquivo aberto: recalcula os serviços que seguem a tabela com (ou sem) a taxa interna
  const setOpenFile = (openFile: boolean) => {
    const reprice = (items: QuoteItem[]) =>
      items.map((it) => {
        const sv = settings.services.find((x) => x.id === it.service)
        if (!it.auto || it.joined || !sv || sv.pricing === 'livre' || !sv.deliveryOpen) return it
        const price = Math.max(0, suggestPrice(sv, it.quantity, it.complexity, student, settings, it.description.split('\n'), openFile) - (it.unitDiscount ?? 0) * it.quantity)
        return { ...it, price }
      })
    set({ openFile, items: reprice(q.items), options: q.options.map((o) => ({ ...o, items: reprice(o.items) })) })
  }
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

  const line = (i: QuoteItem) => `• ${i.title || 'serviço'}${cleanDetail(i.detail) ? ` · ${cleanDetail(i.detail)}` : ''} — ${money(i.price)}`
  const text = () => {
    const first = client?.name.split(' ')[0] ?? ''
    const head = [`*Proposta ${quoteNumber(q)}${q.title ? ` — ${q.title}` : ''}*`, `Olá, ${first}! Segue o orçamento:`, '']
    const body = two
      ? q.options.slice(0, 2).flatMap((o, i) => [`*Opção ${i + 1}${o.name ? ` · ${o.name}` : ''}*`, ...o.items.map(line), `Total: ${money(optionTotal(o))}`, ''])
      : [...q.items.map(line), q.urgency ? `• Taxa de urgência (${settings.urgencyFee}%) — ${money((sub * settings.urgencyFee) / 100)}` : '', q.discount ? `• Desconto — −${money(q.discount)}` : '', '', `*Investimento total: ${money(total)}*`]
    return [...head, ...body, q.paymentTerms ? `Pagamento: ${q.paymentTerms}` : '', q.schedule ? `Prazos: ${q.schedule}` : '']
      .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
      .join('\n')
  }

  const approve = () => {
    if (two && !q.chosenOption) return toast('Marque qual opção o cliente escolheu.')
    if (q.projectId && data.projects.some((p) => p.id === q.projectId)) return go('projetos', q.projectId)
    if (!q.clientId) return toast('Escolha o cliente.')
    setClosing(q) // a janela salva o orçamento aprovado junto com a demanda
  }
  const [closing, setClosing] = useState<Quote | null>(null)

  const dupNumber = data.quotes.some((x) => x.id !== q.id && x.number === q.number)
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
          <MessagesButton client={client} quote={q} project={data.projects.find((p) => p.id === q.projectId)} />
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
              <Field label="Cliente" span={2} hint="O nome da cliente vai no campo “nome” da proposta.">
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
              <Field
                className={dupNumber ? 'field-warn' : undefined}
                label="Nº e data"
                hint={
                  dupNumber
                    ? `⚠ já existe outro orçamento ${quoteNumber(q)}`
                    : q.createdAt === today()
                      ? 'Orçamento antigo? coloque o nº e a data reais.'
                      : 'Vão no PDF e na lista.'
                }
              >
                <div className="num-date">
                  <input
                    id="q-number"
                    type="number"
                    min={1}
                    value={q.number}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => set({ number: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                    aria-label="Número do orçamento"
                    title="Número do orçamento (ex.: 170)"
                  />
                  <input
                    id="q-date"
                    type="date"
                    value={q.createdAt}
                    max={today()}
                    onChange={(e) => {
                      const d = e.target.value || today()
                      // orçamento antigo: o "enviado em" acompanha a data, para não aparecer como "aguardando há 0 dias"
                      set({ createdAt: d, sentAt: q.status !== 'rascunho' && (!q.sentAt || q.sentAt > d || q.sentAt === q.createdAt) ? d : q.sentAt })
                    }}
                  />
                </div>
              </Field>
              <Field label="Projeto / título do quadro" span={2} hint="Aparece no topo do quadro de serviços.">
                <input id="q-title" value={q.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: renderização Casa Pampulha" />
              </Field>
              <Field label="Área (m²) · opcional" hint="Em branco = não aparece no PDF · ≈ para área média.">
                <div className="area-field">
                  <input id="q-area" type="number" min={0} inputMode="decimal" value={q.area || ''} placeholder="0" onFocus={(e) => e.target.select()} onChange={(e) => set({ area: Number(e.target.value) || 0 })} />
                  <label className={`area-approx ${q.areaApprox ? 'on' : ''}`} title="Área estimada / em média: aparece como ≈ na proposta">
                    <input type="checkbox" checked={!!q.areaApprox} onChange={(e) => set({ areaApprox: e.target.checked })} />≈ estimada
                  </label>
                </div>
              </Field>
              <Field group label="Modelo" span={2}>
                <Segmented
                  value={q.mode}
                  onChange={(mode) => set({ mode, options: q.options.length >= 2 ? q.options : [newOption(), newOption()] })}
                  options={[
                    { value: 'escopo', label: 'valor único' },
                    { value: 'opcoes', label: '2 opções' },
                  ]}
                />
              </Field>
              <div className="field field-check">
                <label className="check toggle">
                  <input id="q-pdf" type="checkbox" checked={q.pdf} onChange={(e) => set({ pdf: e.target.checked })} /> gerar proposta em PDF
                </label>
              </div>
            </div>
            {q.status === 'aprovado' && (
              <div className="closed-row">
                <label htmlFor="q-closed">
                  <Icon name="check" size={14} /> fechou em
                </label>
                <input
                  id="q-closed"
                  type="date"
                  value={q.closedAt || (q.projectId ? data.projects.find((x) => x.id === q.projectId)?.startDate : '') || ''}
                  min={q.createdAt}
                  max={today()}
                  onChange={(e) => {
                    const d = e.target.value
                    if (!d) return
                    set({ closedAt: d })
                    // a demanda começa no dia em que fechou
                    const p = q.projectId ? data.projects.find((x) => x.id === q.projectId) : undefined
                    if (p && p.startDate !== d) upsert('projects', { ...p, startDate: d })
                  }}
                />
                <span className="muted small">{q.closedAt && q.closedAt > q.createdAt ? `${daysBetween(q.createdAt, q.closedAt)} dia(s) depois do orçamento` : 'pode ser diferente da data do orçamento'}</span>
              </div>
            )}
            {student && <p className="small text-warn">Cliente estudante: sugestões com {settings.studentDiscount}% de desconto.</p>}
          </Section>

          {!two ? (
            <Section title="serviços" action={<ScopeTools q={q} settings={settings} phone={client?.phone ?? ''} student={student} onApply={(items) => set({ items })} />}>
              <ItemsEditor items={q.items} student={student} openFile={!!q.openFile} settings={settings} onChange={(items) => set({ items })} />
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
                  <input value={q.discountNote} onChange={(e) => set({ discountNote: e.target.value })} placeholder="Ex.: valor especial para pacote fechado" spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" />
                </Field>
              </div>
              <Field label="Observação (dentro do quadro)">
                <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" rows={2} value={q.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Opcional" />
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
                <ItemsEditor items={o.items} student={student} openFile={!!q.openFile} settings={settings} onChange={(items) => setOption(o.id, { items })} />
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
                <Field label="Observação (dentro do quadro)">
                  <input value={o.note} onChange={(e) => setOption(o.id, { note: e.target.value })} placeholder="Opcional" spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" />
                </Field>
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
              {canOpenFile(q, settings.services) && (
                <Field group label="Arquivo final" span={3} hint={q.openFile ? `Valor com +${settings.openFileFee ?? 30}% embutido (não aparece no PDF). A proposta só diz como será entregue.` : 'Pergunte ao cliente no início. Aberto soma uma taxa interna no valor.'}>
                  <Segmented<'fechado' | 'aberto'>
                    value={q.openFile ? 'aberto' : 'fechado'}
                    onChange={(v) => setOpenFile(v === 'aberto')}
                    options={[
                      { value: 'fechado', label: 'fechado (PDF)' },
                      { value: 'aberto', label: 'aberto (editável)' },
                    ]}
                  />
                </Field>
              )}
              <Field
                label="Formatos de arquivos entregues"
                span={3}
                hint={
                  q.filesAuto ? (
                    'Automático pelos serviços do orçamento. Pode escrever por cima.'
                  ) : (
                    <button type="button" className="link small" onClick={() => set({ filesAuto: true })}>
                      usar o texto automático pelos serviços
                    </button>
                  )
                }
              >
                <input value={quoteFiles(q, settings.services)} onChange={(e) => set({ files: e.target.value, filesAuto: false })} placeholder="Ex.: PDF fechado, pronto para execução." />
              </Field>
              <Field label="Rodadas de ajuste" hint="Controle interno.">
                <input type="number" min={0} inputMode="numeric" value={q.revisions} onFocus={(e) => e.target.select()} onChange={(e) => set({ revisions: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          </Section>

          <Section title="status">
            <Segmented<QuoteStatus>
              value={q.status}
              onChange={(s) => (existing ? save({ status: s }) : set({ status: s }))}
              options={(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((k) => ({ value: k, label: QUOTE_STATUS[k].label }))}
            />
            {q.closedValue ? (
              <p className="small muted">
                Fechado por <b>{money(q.closedValue)}</b> · proposta de <s>{money(total)}</s>
              </p>
            ) : null}
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
                      number: nextQuoteNumber(data),
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
      {closing && <CloseDeal q={closing} onClose={() => setClosing(null)} onDone={(id) => go('projetos', id)} />}
    </div>
  )
}

/** Botões das opções da lista (plantas, detalhamentos) + itens personalizados. Cada um marcado soma no valor. */
function ScopeChips({ s, text, onChange }: { s: ServiceDef; text: string; onChange: (text: string) => void }) {
  const [custom, setCustom] = useState('')
  const options = s.checklist!.filter((c) => c.trim())
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const unit = s.pricing === 'm2' ? '/m²' : ''
  const priceTag = (v: number) => (v ? `${money(v)}${unit}` : '')
  const own = lines.filter((l) => !checklistMatch(s, l))
  // remonta na ordem da lista, mantendo o jeito que você escreveu cada item
  const rebuild = (on: (c: string) => boolean, extra: string[]) =>
    onChange([...options.filter(on).map((c) => lines.find((l) => checklistMatch(s, l) === c) ?? c), ...extra].join('\n'))
  const isOn = (c: string) => lines.some((l) => checklistMatch(s, l) === c)
  const add = () => {
    const v = custom.trim()
    if (!v) return
    const match = checklistMatch(s, v)
    if (match) rebuild((c) => c === match || isOn(c), own)
    else if (!own.some((l) => l.toLowerCase() === v.toLowerCase())) rebuild(isOn, [...own, v])
    setCustom('')
  }
  return (
    <div className="scope-chips">
      {options.map((c) => {
        const on = isOn(c)
        return (
          <button
            key={c}
            type="button"
            className={`scope-chip ${on ? 'on' : ''}`}
            aria-pressed={on}
            title={priceTag(checklistPrice(s, c)) || undefined}
            onClick={() => rebuild((x) => (x === c ? !on : isOn(x)), own)}
          >
            {on && <Icon name="check" size={12} />}
            {c}
          </button>
        )
      })}
      {own.map((l) => (
        <button key={l} type="button" className="scope-chip on is-own" title={`item personalizado · ${priceTag(s.customRate ?? 0) || 'sem valor'} · toque para tirar`} onClick={() => rebuild(isOn, own.filter((x) => x !== l))}>
          {l}
          <Icon name="x" size={12} />
        </button>
      ))}
      <span className="scope-add">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
          placeholder="+ outro (escreva e Enter)"
          aria-label="Adicionar item personalizado"
        />
      </span>
    </div>
  )
}

/** Perguntar ao cliente quais plantas/detalhamentos ele quer e marcar tudo colando a resposta. */
function ScopeTools({ q, settings, phone, student, onApply }: { q: Quote; settings: Settings; phone: string; student: boolean; onApply: (items: QuoteItem[]) => void }) {
  const [open, setOpen] = useState<'' | 'perguntar' | 'resposta'>('')
  const [reply, setReply] = useState('')
  const question = scopeQuestion(settings.services)
  if (!question) return null
  const found = reply.trim() ? parseScopeReply(reply, settings.services) : {}
  const count = Object.values(found).reduce((n, l) => n + l.length, 0)

  const apply = () => {
    let items = q.items.filter((i) => i.service || i.title.trim() || i.price > 0) // tira linhas em branco
    for (const [sid, picked] of Object.entries(found)) {
      const s = settings.services.find((x) => x.id === sid)
      if (!s || !picked.length) continue
      const cur = items.find((i) => i.service === sid)
      if (cur) {
        // o que foi escrito à mão (fora da lista) continua
        const own = cur.description.split('\n').filter((l) => l.trim() && !checklistMatch(s, l) && !picked.some((x) => x.toLowerCase() === l.trim().toLowerCase()))
        const lines = [...picked, ...own]
        const price = cur.auto && s.pricing !== 'livre' ? suggestPrice(s, cur.quantity, cur.complexity, student, settings, lines, !!q.openFile) : cur.price
        items = items.map((i) => (i === cur ? { ...i, description: lines.join('\n'), price } : i))
      } else {
        const quantity = s.pricing === 'm2' ? q.area || 50 : s.pricing === 'livre' ? 1 : picked.length
        const price = s.pricing === 'livre' ? 0 : suggestPrice(s, quantity, 'media', student, settings, picked, !!q.openFile)
        items = [...items, { ...newItem(), service: sid, title: s.name, quantity, price, detail: itemDetail(s, quantity, 'media'), description: picked.join('\n') }]
      }
    }
    onApply(items.length ? items : [newItem()])
    setReply('')
    setOpen('')
    toast(`${count} ${count === 1 ? 'item marcado' : 'itens marcados'} no orçamento.`)
  }
  const copy = () =>
    navigator.clipboard
      ?.writeText(question)
      .then(() => toast('Pergunta copiada. É só colar na conversa.'))
      .catch(() => toast('Selecione o texto e copie.'))

  return (
    <div className="row gap-s">
      <button className="btn small ghost" onClick={() => setOpen('perguntar')} title="Mandar a lista de plantas para o cliente escolher">
        <Icon name="whatsapp" size={14} /> perguntar
      </button>
      <button className="btn small" onClick={() => setOpen('resposta')} title="Colar o que o cliente respondeu e marcar tudo sozinho">
        <Icon name="check" size={14} /> colar resposta
      </button>
      {open === 'perguntar' && (
        <Modal
          title="quais plantas o cliente quer?"
          onClose={() => setOpen('')}
          footer={
            <>
              <button className="btn ghost" onClick={copy}>
                <Icon name="copy" size={14} /> copiar
              </button>
              {phone && (
                <a className="btn primary" href={whatsappLink(phone, question)} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" size={14} /> abrir no WhatsApp
                </a>
              )}
            </>
          }
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            Mande esta lista. Quando o cliente responder apagando o que não quer, cole a resposta em <b>colar resposta</b> e o orçamento se monta sozinho.
          </p>
          <textarea className="scope-text" readOnly rows={Math.min(22, question.split('\n').length + 1)} value={question} onFocus={(e) => e.target.select()} />
          <p className="muted small">A lista é editável em configurações → preços, em cada serviço.</p>
        </Modal>
      )}
      {open === 'resposta' && (
        <Modal
          title="colar resposta do cliente"
          onClose={() => setOpen('')}
          footer={
            <>
              <button className="btn ghost" onClick={() => setOpen('')}>
                cancelar
              </button>
              <button className="btn primary" disabled={!count} onClick={apply}>
                marcar no orçamento
              </button>
            </>
          }
        >
          <textarea
            className="scope-text"
            autoFocus
            rows={12}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={'Cole aqui o que o cliente respondeu, ex.:\n\nplantas executivas:\n- planta de layout\n- planta elétrica\n\ndetalhamentos:\n- marcenaria'}
          />
          {count > 0 && (
            <div className="scope-found">
              {Object.entries(found).map(([sid, list]) => (
                <div key={sid}>
                  <b>{settings.services.find((x) => x.id === sid)?.name}</b> · {list.length}
                  <div className="muted small">{list.join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
          {reply.trim() && !count && <p className="small text-warn">Não reconheci nenhum item. Confira se a resposta tem os títulos (ex.: “plantas executivas:”).</p>}
        </Modal>
      )}
    </div>
  )
}

/** Lista de serviços com preço pela tabela, desconto por unidade e valor editável. */
function ItemsEditor({ items, student, openFile, settings, onChange }: { items: QuoteItem[]; student: boolean; openFile: boolean; settings: Settings; onChange: (items: QuoteItem[]) => void }) {
  const service = (sid: string) => settings.services.find((s) => s.id === sid)

  const recompute = (it: QuoteItem): QuoteItem => {
    const s = service(it.service)
    if (it.joined) return { ...it, detail: it.auto || !it.detail ? itemDetail(s, it.quantity, it.complexity) : it.detail, price: 0, unitDiscount: 0 }
    return {
      ...it,
      detail: it.auto || !it.detail ? itemDetail(s, it.quantity, it.complexity) : it.detail,
      price: it.auto && s && s.pricing !== 'livre' ? Math.max(0, suggestPrice(s, it.quantity, it.complexity, student, settings, it.description.split('\n'), openFile) - (it.unitDiscount ?? 0) * it.quantity) : it.price,
    }
  }
  const setItem = (iid: string, patch: Partial<QuoteItem>) => onChange(items.map((i) => (i.id === iid ? recompute({ ...i, ...patch }) : i)))

  return (
    <div className="q-items">
      {items.map((it, n) => {
        const s = service(it.service)
        const lines = it.description.split('\n')
        const byList = pricedByList(s, lines)
        const suggestion = suggestPrice(s, it.quantity, it.complexity, student, settings, lines, openFile)
        const openNote = openFile && s?.deliveryOpen ? ` · inclui arquivo aberto +${settings.openFileFee ?? 30}% (não aparece no PDF)` : ''
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
                <option value="">escolha o serviço…</option>
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
                <input value={it.title} onChange={(e) => setItem(it.id, { title: e.target.value })} placeholder="Ex.: renderização V-Ray" />
              </Field>
              {s && s.pricing !== 'livre' && !(byList && s.pricing !== 'm2') && (
                <Field label={s.pricing === 'm2' ? 'Área (m²)' : `Quantidade (${s.unit})`}>
                  <input type="number" min={0} inputMode="decimal" value={it.quantity || ''} placeholder="0" onFocus={(e) => e.target.select()} onChange={(e) => setItem(it.id, { quantity: Number(e.target.value) || 0 })} />
                </Field>
              )}
              {(s?.pricing === 'm2' || byList) && (
                <Field group label="Complexidade">
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
              {s?.checklist?.some((c) => c.trim()) ? (
                <Field group span={2} label={`${s.checklistTitle || 'o que o cliente quer'} · toque para marcar`}>
                  <ScopeChips s={s} text={it.description} onChange={(description) => setItem(it.id, { description })} />
                </Field>
              ) : null}
              <Field label="O que está incluso" span={2} hint={s?.checklist?.length ? 'Os marcados acima entram aqui e somam no valor. Algo específico? use “+ outro” ou escreva numa linha nova.' : 'Enter para uma nova linha: cada linha aparece embaixo da outra na proposta.'}>
                <textarea
                  className="auto-grow"
                  rows={Math.max(1, it.description.split('\n').length)}
                  value={it.description}
                  onChange={(e) => setItem(it.id, { description: e.target.value })}
                  placeholder="Ambientes, nível de detalhe…"
                  spellCheck
                  lang="pt-BR"
                  autoCapitalize="sentences"
                  autoCorrect="on"
                />
              </Field>
              {n > 0 && (
                <div className="field span-2">
                  <label className="check toggle">
                    <input type="checkbox" checked={!!it.joined} onChange={(e) => {
                        // ao juntar, o valor deste serviço passa para o de cima (dá para ajustar lá o valor combinado)
                        const joined = e.target.checked
                        const own = recompute({ ...it, joined: false, auto: true }).price
                        onChange(
                          items.map((x, j) =>
                            j === n - 1
                              ? (() => {
                                  const price = Math.max(0, Math.round((x.price + (joined ? own : -own)) * 100) / 100)
                                  // ao separar de novo, se voltou ao valor da tabela, volta a seguir a tabela
                                  const table = recompute({ ...x, auto: true }).price
                                  return { ...x, price: !joined && Math.abs(price - table) < 0.01 ? table : price, auto: !joined && Math.abs(price - table) < 0.01 }
                                })()
                              : x.id === it.id
                                ? recompute({ ...it, joined, auto: true })
                                : x,
                          ),
                        )
                      }}
                    /> cobrar junto com o serviço de cima (um valor só para os dois)
                  </label>
                </div>
              )}
              {!it.joined && !byList && s && (s.pricing === 'pacote' || s.pricing === 'unidade') && (
                <Field label={`Desconto por ${s.unit}`} hint={it.unitDiscount ? `fica ${money(Math.max(0, rate - it.unitDiscount))}/${s.unit}` : 'opcional'}>
                  <MoneyInput value={it.unitDiscount ?? 0} onChange={(v) => setItem(it.id, { unitDiscount: v, auto: true })} />
                </Field>
              )}
              {it.joined ? (
                <p className="muted small q-joined-note">Somado ao valor do serviço {String(n).padStart(2, '0')}: ajuste lá o valor combinado dos dois.</p>
              ) : (
              <Field
                label="Valor"
                hint={
                  s && byList
                    ? (() => {
                        const { rate: r, count } = checklistRate(s, lines)
                        const base = `${count} ${count === 1 ? 'item' : 'itens'} = ${money(r)}${s.pricing === 'm2' ? `/m² × ${it.quantity} m²` : ''} × ${settings.complexity[it.complexity]}`
                        return `tabela: ${money(suggestion)} · ${base}${s.min && suggestion <= s.min ? ` (valor mínimo ${money(s.min)})` : ''}${openNote}`
                      })()
                    : s && s.pricing !== 'livre'
                    ? `tabela: ${money(suggestion)}${rate ? ` · ${money(rate)}/${s.unit}` : ''}${s.pricing === 'm2' ? ` · ${money(s.price)}/m² × ${settings.complexity[it.complexity]}` : ''}${openNote}`
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
              )}
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
