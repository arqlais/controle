import { useState } from 'react'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { ClientForm } from '../components/forms'
import { QuoteDoc } from '../components/Docs'
import { usePrint } from '../components/Print'
import { Badge, Empty, Field, MoneyInput, Section, Segmented } from '../components/ui'
import { askDelete, toast } from '../components/dialog'
import type { Project, Quote, QuoteStatus } from '../types'
import { DEFAULT_TASKS, QUOTE_STATUS, addDays, fmtDateLong, isStudent, money, quoteSubtotal, quoteTotal, splitPayments, today, uid, whatsappLink } from '../utils'

export default function QuoteEditor({ id }: { id: string }) {
  const { data, upsert, remove } = useStore()
  const { settings } = data
  const existing = data.quotes.find((q) => q.id === id)
  const [q, setQ] = useState<Quote>(
    () =>
      existing ?? {
        id: uid(),
        number: Math.max(0, ...data.quotes.map((x) => x.number)) + 1,
        clientId: '',
        title: '',
        items: [{ id: uid(), service: '', description: '', quantity: 1, unitPrice: 0 }],
        discount: 0,
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
  const { print, portal } = usePrint()

  if (id !== 'novo' && !existing) return <Empty title="Orçamento não encontrado" action={<a className="btn" href={href('orcamentos')}>Voltar</a>} />

  const client = data.clients.find((c) => c.id === q.clientId)
  const student = isStudent(client)
  const set = (patch: Partial<Quote>) => {
    setQ((x) => ({ ...x, ...patch }))
    setDirty(true)
  }
  const setItem = (iid: string, patch: Partial<Quote['items'][number]>) => set({ items: q.items.map((i) => (i.id === iid ? { ...i, ...patch } : i)) })
  const priceFor = (serviceId: string, stud = student) => {
    const s = settings.services.find((x) => x.id === serviceId)
    return s ? (stud ? s.studentPrice : s.price) : 0
  }

  const sub = quoteSubtotal(q)
  const total = quoteTotal(q, settings.urgencyFee)
  const serviceName = (sid: string) => settings.services.find((s) => s.id === sid)?.name ?? ''

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

  const text = () =>
    [
      `*Orçamento #${String(q.number).padStart(3, '0')} — ${q.title}*`,
      `Olá, ${client?.name.split(' ')[0] ?? ''}! Segue a proposta:`,
      '',
      ...q.items.map((i) => `• ${i.quantity}x ${serviceName(i.service) || i.description}${serviceName(i.service) && i.description ? ` (${i.description})` : ''} — ${money(i.quantity * i.unitPrice)}`),
      q.urgency ? `• Taxa de urgência (${settings.urgencyFee}%) — ${money((sub * settings.urgencyFee) / 100)}` : '',
      q.discount ? `• Desconto — −${money(q.discount)}` : '',
      '',
      `*Total: ${money(total)}*`,
      `Prazo: ${q.deadlineDays} dias após aprovação · ${q.revisions} revisões inclusas`,
      q.paymentTerms ? `Pagamento: ${q.paymentTerms}` : '',
      `Válido até ${fmtDateLong(addDays(q.createdAt, q.validityDays))}.`,
    ]
      .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
      .join('\n')

  const approve = () => {
    const saved = save({ status: 'aprovado' })
    if (!saved) return
    if (saved.projectId && data.projects.some((p) => p.id === saved.projectId)) return go('projetos', saved.projectId)
    const first = saved.items[0]
    const start = today()
    const due = addDays(start, saved.deadlineDays)
    const service = settings.services.find((s) => s.id === first?.service)
    const project: Project = {
      id: uid(),
      clientId: saved.clientId,
      title: saved.title || 'Projeto',
      service: first?.service ?? '',
      quantity: saved.items.reduce((s, i) => s + i.quantity, 0),
      description: saved.items.map((i) => `${i.quantity}x ${serviceName(i.service) || i.description}${i.description && serviceName(i.service) ? ` — ${i.description}` : ''}`).join('\n'),
      status: 'briefing',
      priority: saved.urgency ? 'urgente' : 'media',
      startDate: start,
      dueDate: due,
      deliveredDate: null,
      value: quoteSubtotal(saved) * (saved.urgency ? 1 + settings.urgencyFee / 100 : 1),
      discount: saved.discount,
      payments: splitPayments(total, '50-50', start, due),
      revisionsIncluded: saved.revisions,
      revisionsUsed: 0,
      estimatedHours: saved.items.reduce((s, i) => s + (settings.services.find((x) => x.id === i.service)?.hours ?? 0) * i.quantity, 0) || (service?.hours ?? 0),
      timeLogs: [],
      tasks: DEFAULT_TASKS.map((text) => ({ id: uid(), text, done: false })),
      filesLink: '',
      timerStart: null,
      notes: `Criado a partir do orçamento #${saved.number}.`,
      createdAt: start,
    }
    upsert('projects', project)
    upsert('quotes', { ...saved, projectId: project.id })
    go('projetos', project.id)
  }

  return (
    <div className="page">
      <a href={href('orcamentos')} className="back">
        <Icon name="chevronL" size={16} /> Orçamentos
      </a>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            Orçamento #{String(q.number).padStart(3, '0')} · <Badge color={QUOTE_STATUS[q.status].color}>{QUOTE_STATUS[q.status].label}</Badge>
          </p>
          <h1>{q.title || 'Novo orçamento'}</h1>
        </div>
        <div className="row gap-s wrap">
          <button className="btn ghost" onClick={() => print(<QuoteDoc s={settings} client={client} quote={q} />)}>
            <Icon name="printer" size={16} /> PDF
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              navigator.clipboard
                ?.writeText(text())
                .then(() => toast('Texto copiado. Cole no WhatsApp ou e-mail.'))
                .catch(() => toast('Não deu para copiar aqui — selecione o texto da pré-visualização.'))
            }}
          >
            <Icon name="copy" size={16} /> Copiar texto
          </button>
          {client?.phone && (
            <a
              className="btn ghost"
              href={whatsappLink(client.phone, text())}
              target="_blank"
              rel="noreferrer"
              onClick={() => q.status === 'rascunho' && save({ status: 'enviado' })}
            >
              <Icon name="whatsapp" size={16} /> Enviar
            </a>
          )}
          <button className="btn primary" onClick={() => save()} disabled={!dirty}>
            {dirty ? 'Salvar' : 'Salvo'}
          </button>
        </div>
      </div>

      <div className="grid-2 wide-left">
        <div className="stack">
          <Section title="Dados">
            <div className="form-grid">
              <Field label="Título / projeto" span={2}>
                <input value={q.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Renders — Casa Pampulha" />
              </Field>
              <Field label="Cliente">
                <div className="row gap-s">
                  <select
                    value={q.clientId}
                    onChange={(e) => {
                      const c = data.clients.find((x) => x.id === e.target.value)
                      const stud = isStudent(c)
                      // reajusta preços de tabela quando muda entre estudante/profissional
                      set({
                        clientId: e.target.value,
                        items: q.items.map((i) => (i.service && i.unitPrice === priceFor(i.service) ? { ...i, unitPrice: priceFor(i.service, stud) } : i)),
                      })
                    }}
                  >
                    <option value="">Selecione…</option>
                    {[...data.clients].filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn ghost small" onClick={() => setNewClient(true)} title="Novo cliente">
                    +
                  </button>
                </div>
              </Field>
            </div>
            {student && <p className="small text-warn">Cliente estudante: usando a tabela de preços para estudantes.</p>}
          </Section>

          <Section
            title="Itens"
            action={
              <button className="btn small" onClick={() => set({ items: [...q.items, { id: uid(), service: '', description: '', quantity: 1, unitPrice: 0 }] })}>
                <Icon name="plus" size={14} /> Item
              </button>
            }
          >
            <div className="quote-items">
              {q.items.map((i) => (
                <div key={i.id} className="quote-item">
                  <select value={i.service} onChange={(e) => setItem(i.id, { service: e.target.value, unitPrice: priceFor(e.target.value) || i.unitPrice })}>
                    <option value="">Personalizado</option>
                    {settings.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input value={i.description} onChange={(e) => setItem(i.id, { description: e.target.value })} placeholder="Detalhe (ambiente, vista…)" />
                  <input type="number" min={0} value={i.quantity} onChange={(e) => setItem(i.id, { quantity: Number(e.target.value) || 0 })} aria-label="Quantidade" />
                  <MoneyInput value={i.unitPrice} onChange={(n) => setItem(i.id, { unitPrice: n })} />
                  <b className="num">{money(i.quantity * i.unitPrice)}</b>
                  <button className="icon-btn subtle" onClick={() => set({ items: q.items.filter((x) => x.id !== i.id) })} aria-label="Remover item">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="quote-totals">
              <div>
                <span>Subtotal</span>
                <b>{money(sub)}</b>
              </div>
              <label className="check">
                <input type="checkbox" checked={q.urgency} onChange={(e) => set({ urgency: e.target.checked })} /> Taxa de urgência (+{settings.urgencyFee}%)
                {q.urgency && <b>{money((sub * settings.urgencyFee) / 100)}</b>}
              </label>
              <div>
                <span>Desconto</span>
                <MoneyInput value={q.discount} onChange={(n) => set({ discount: n })} />
              </div>
              <div className="grand">
                <span>Total</span>
                <b>{money(total)}</b>
              </div>
            </div>
          </Section>

          <Section title="Condições">
            <div className="form-grid">
              <Field label="Prazo (dias)">
                <input type="number" min={1} value={q.deadlineDays} onChange={(e) => set({ deadlineDays: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Revisões inclusas">
                <input type="number" min={0} value={q.revisions} onChange={(e) => set({ revisions: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Validade (dias)">
                <input type="number" min={1} value={q.validityDays} onChange={(e) => set({ validityDays: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Pagamento" span={3}>
                <textarea rows={2} value={q.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
              </Field>
              <Field label="Observações" span={3} hint="Ex.: não inclui modelagem de mobiliário personalizado; arquivos entregues em 4K…">
                <textarea rows={3} value={q.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
            </div>
          </Section>
        </div>

        <div className="stack">
          <Section title="Status">
            <Segmented<QuoteStatus>
              value={q.status}
              onChange={(s) => (existing ? save({ status: s }) : set({ status: s }))}
              options={(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((k) => ({ value: k, label: QUOTE_STATUS[k].label }))}
            />
            <button className="btn primary block" onClick={approve}>
              <Icon name="check" size={16} /> {q.projectId ? 'Abrir projeto criado' : 'Aprovado → criar projeto'}
            </button>
            <p className="muted small">Cria a demanda com prazo, etapas e parcelas 50% + 50% já calculados.</p>
          </Section>
          <Section title="Pré-visualização da mensagem">
            <pre className="preview">{text()}</pre>
          </Section>
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
              <Icon name="copy" size={14} /> Duplicar orçamento
            </button>
          )}
          {existing && (
            <button
              className="btn ghost danger small"
              onClick={async () => {
                if (await askDelete(`o orçamento #${q.number}`)) {
                  remove('quotes', q.id)
                  go('orcamentos')
                }
              }}
            >
              <Icon name="trash" size={14} /> Excluir orçamento
            </button>
          )}
        </div>
      </div>

      {newClient && <ClientForm onClose={() => setNewClient(false)} onSaved={(c) => set({ clientId: c.id })} />}
      {portal}
    </div>
  )
}
