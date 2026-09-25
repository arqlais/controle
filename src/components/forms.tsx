import { ask, askDelete, toast } from './dialog'
import { useState } from 'react'
import { useStore } from '../store'
import type { CalendarEvent, Client, ClientType, EventType, Expense, ExpenseCategory, Priority, Project, ProjectStatus } from '../types'
import {
  CLIENT_TYPES,
  DEFAULT_TASKS,
  EVENT_TYPES,
  EXPENSE_CATEGORIES,
  PRIORITY,
  STATUS,
  isStudent,
  suggestPrice,
  PAY_MODES,
  type PayMode,
  money,
  splitPayments,
  today,
  addDays,
  uid,
} from '../utils'
import { Field, Modal, MoneyInput, Segmented } from './ui'

/* ---------------- Cliente ---------------- */

export function newClient(): Client {
  return {
    id: uid(),
    name: '',
    company: '',
    type: 'arquiteto',
    email: '',
    phone: '',
    instagram: '',
    city: '',
    document: '',
    origin: '',
    notes: '',
    favorite: false,
    archived: false,
    history: [],
    createdAt: today(),
  }
}

export function ClientForm({ initial, onClose, onSaved }: { initial?: Client; onClose: () => void; onSaved?: (c: Client) => void }) {
  const { upsert } = useStore()
  const [c, setC] = useState<Client>(initial ?? newClient())
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setC((x) => ({ ...x, [k]: v }))
  const save = () => {
    if (!c.name.trim()) return toast('Informe o nome do cliente.')
    upsert('clients', c)
    onSaved?.(c)
    onClose()
  }
  return (
    <Modal
      title={initial ? 'Editar cliente' : 'Novo cliente'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save}>
            Salvar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome *" span={2}>
          <input autoFocus value={c.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome do contato" />
        </Field>
        <Field label="Tipo">
          <select value={c.type} onChange={(e) => set('type', e.target.value as ClientType)}>
            {Object.entries(CLIENT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Empresa / escritório / faculdade" span={2}>
          <input value={c.company} onChange={(e) => set('company', e.target.value)} />
        </Field>
        <Field label="CPF / CNPJ" hint="Usado nos recibos">
          <input value={c.document} onChange={(e) => set('document', e.target.value)} />
        </Field>
        <Field label="WhatsApp">
          <input value={c.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(31) 99999-0000" inputMode="tel" />
        </Field>
        <Field label="E-mail">
          <input type="email" value={c.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Instagram">
          <input value={c.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@perfil" />
        </Field>
        <Field label="Cidade">
          <input value={c.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="Como chegou até você">
          <input list="origins" value={c.origin} onChange={(e) => set('origin', e.target.value)} />
          <datalist id="origins">
            {['Indicação', 'Instagram', 'Site', 'Faculdade', 'LinkedIn', 'Behance', 'Cliente recorrente'].map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
        <Field label="Favorito">
          <Segmented
            value={c.favorite ? 's' : 'n'}
            options={[
              { value: 'n', label: 'Não' },
              { value: 's', label: '★ Sim' },
            ]}
            onChange={(v) => set('favorite', v === 's')}
          />
        </Field>
        <Field label="Observações" span={3} hint="Preferências de estilo, softwares que usa, forma de enviar arquivos...">
          <textarea rows={3} value={c.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------- Projeto / demanda ---------------- */

export function newProject(clientId = ''): Project {
  const t = today()
  return {
    id: uid(),
    clientId,
    title: '',
    service: '',
    quantity: 1,
    description: '',
    status: 'briefing',
    priority: 'media',
    startDate: t,
    dueDate: addDays(t, 10),
    deliveredDate: null,
    value: 0,
    discount: 0,
    payments: [],
    revisionsIncluded: 2,
    revisionsUsed: 0,
    estimatedHours: 0,
    timeLogs: [],
    tasks: [],
    filesLink: '',
    timerStart: null,
    notes: '',
    createdAt: t,
  }
}

type PayChoice = PayMode | 'manter'

export function ProjectForm({ initial, clientId, onClose, onSaved }: { initial?: Project; clientId?: string; onClose: () => void; onSaved?: (p: Project) => void }) {
  const { data, upsert } = useStore()
  const { settings } = data
  const [p, setP] = useState<Project>(() => initial ?? { ...newProject(clientId), revisionsIncluded: settings.defaultRevisions })
  const [payMode, setPayMode] = useState<PayChoice>(initial?.payments.length ? 'manter' : '50-50')
  const [showNewClient, setShowNewClient] = useState(false)
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP((x) => ({ ...x, [k]: v }))
  const client = data.clients.find((c) => c.id === p.clientId)
  const service = settings.services.find((s) => s.id === p.service)
  const suggested = suggestPrice(service, p.quantity, 'media', isStudent(client), settings)
  const total = Math.max(0, p.value - p.discount)

  const applyService = (id: string, qty = p.quantity) => {
    const s = settings.services.find((x) => x.id === id)
    setP((x) => ({
      ...x,
      service: id,
      quantity: qty,
      value: s && s.pricing !== 'livre' && (!x.value || x.value === suggested) ? suggestPrice(s, qty, 'media', isStudent(client), settings) : x.value,
    }))
  }

  const save = async () => {
    if (!p.title.trim()) return toast('Dê um nome para o projeto.')
    if (!p.clientId) return toast('Escolha o cliente.')
    let final = p
    if (payMode !== 'manter') {
      const paidSum = p.payments.filter((x) => x.paidDate).reduce((s, x) => s + x.amount, 0)
      if (paidSum > 0 && !(await ask('Recriar as parcelas vai apagar os pagamentos já registrados deste projeto. Continuar?', { confirmLabel: 'Recriar parcelas', danger: true }))) return
      final = { ...p, payments: total > 0 ? splitPayments(total, payMode, p.startDate, p.dueDate) : [] }
    }
    if (final.status === 'entregue' && !final.deliveredDate) final = { ...final, deliveredDate: today() }
    if (!final.tasks.length && !initial) {
      final = {
        ...final,
        tasks: DEFAULT_TASKS.map((text) => ({
          id: uid(),
          text,
          done: false,
        })),
      }
    }
    upsert('projects', final)
    onSaved?.(final)
    onClose()
  }

  const activeClients = data.clients.filter((c) => !c.archived || c.id === p.clientId).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Modal
      wide
      title={initial ? 'Editar projeto' : 'Nova demanda'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save}>
            Salvar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome do projeto *" span={2}>
          <input autoFocus value={p.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Apartamento Savassi — living" />
        </Field>
        <Field label="Cliente *">
          <div className="row gap-s">
            <select value={p.clientId} onChange={(e) => set('clientId', e.target.value)}>
              <option value="">Selecione…</option>
              {activeClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` · ${c.company}` : ''}
                </option>
              ))}
            </select>
            <button type="button" className="btn ghost small" onClick={() => setShowNewClient(true)} title="Novo cliente">
              +
            </button>
          </div>
        </Field>

        <Field label="Serviço">
          <select value={p.service} onChange={(e) => applyService(e.target.value)}>
            <option value="">—</option>
            {settings.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Quantidade${service ? ` (${service.unit}s)` : ''}`}>
          <input type="number" min={0} value={p.quantity} onChange={(e) => applyService(p.service, Number(e.target.value) || 0)} />
        </Field>
        <Field label="Status">
          <select value={p.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Início">
          <input type="date" value={p.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Prazo de entrega">
          <input type="date" value={p.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Prioridade">
          <Segmented
            value={p.priority}
            options={(Object.keys(PRIORITY) as Priority[]).map((k) => ({ value: k, label: PRIORITY[k].label }))}
            onChange={(v) => set('priority', v)}
          />
        </Field>

        <Field label="Valor" hint={suggested ? `Tabela ${isStudent(client) ? 'estudante' : 'profissional'}: ${money(suggested)}` : undefined}>
          <MoneyInput value={p.value} onChange={(n) => set('value', n)} />
        </Field>
        <Field label="Desconto">
          <MoneyInput value={p.discount} onChange={(n) => set('discount', n)} />
        </Field>
        <Field label="Total">
          <div className="readonly">{money(total)}</div>
        </Field>

        <Field label="Forma de pagamento" span={3} hint="Gera as parcelas automaticamente. Você pode ajustar cada uma depois, na página do projeto.">
          <Segmented<PayChoice>
            value={payMode}
            options={[
              ...(initial?.payments.length ? [{ value: 'manter' as PayChoice, label: 'manter parcelas atuais' }] : []),
              ...(Object.keys(PAY_MODES) as PayMode[]).map((k) => ({ value: k as PayChoice, label: PAY_MODES[k] })),
            ]}
            onChange={setPayMode}
          />
        </Field>

        <Field label="Revisões incluídas">
          <input type="number" min={0} value={p.revisionsIncluded} onChange={(e) => set('revisionsIncluded', Number(e.target.value) || 0)} />
        </Field>
        <Field label="Link dos arquivos" span={2} hint="Drive, WeTransfer, Dropbox…">
          <input value={p.filesLink} onChange={(e) => set('filesLink', e.target.value)} placeholder="https://" />
        </Field>

        <Field label="Briefing / descrição" span={3}>
          <textarea rows={3} value={p.description} onChange={(e) => set('description', e.target.value)} placeholder="Ambientes, referências, estilo, câmeras, formato de entrega…" />
        </Field>
      </div>
      {showNewClient && (
        <ClientForm
          onClose={() => setShowNewClient(false)}
          onSaved={(c) => setP((x) => ({ ...x, clientId: c.id }))}
        />
      )}
    </Modal>
  )
}

/* ---------------- Despesa ---------------- */

export function ExpenseForm({ initial, onClose }: { initial?: Expense; onClose: () => void }) {
  const { upsert } = useStore()
  const [e, setE] = useState<Expense>(
    initial ?? { id: uid(), description: '', category: 'software', amount: 0, date: today(), recurring: false, notes: '' },
  )
  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setE((x) => ({ ...x, [k]: v }))
  const save = () => {
    if (!e.description.trim()) return toast('Descreva a despesa.')
    upsert('expenses', e)
    onClose()
  }
  return (
    <Modal
      title={initial ? 'Editar despesa' : 'Nova despesa'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save}>
            Salvar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Descrição *" span={2}>
          <input autoFocus value={e.description} onChange={(ev) => set('description', ev.target.value)} placeholder="Ex.: Licença D5 Render" />
        </Field>
        <Field label="Valor">
          <MoneyInput value={e.amount} onChange={(n) => set('amount', n)} />
        </Field>
        <Field label="Categoria">
          <select value={e.category} onChange={(ev) => set('category', ev.target.value as ExpenseCategory)}>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={e.recurring ? 'Início da cobrança' : 'Data'}>
          <input type="date" value={e.date} onChange={(ev) => set('date', ev.target.value)} />
        </Field>
        <Field label="Recorrência">
          <Segmented
            value={e.recurring ? 'm' : 'u'}
            options={[
              { value: 'u', label: 'Única' },
              { value: 'm', label: 'Mensal' },
            ]}
            onChange={(v) => set('recurring', v === 'm')}
          />
        </Field>
        <Field label="Observações" span={3}>
          <input value={e.notes} onChange={(ev) => set('notes', ev.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------- Evento ---------------- */

export function EventForm({ initial, date, isNew, onClose }: { initial?: CalendarEvent; date?: string; isNew?: boolean; onClose: () => void }) {
  const editing = !!initial && !isNew
  const { data, upsert, remove } = useStore()
  const [ev, setEv] = useState<CalendarEvent>(
    initial ?? { id: uid(), title: '', date: date ?? today(), time: '', type: 'reuniao', projectId: '', notes: '', done: false },
  )
  const [repeat, setRepeat] = useState(0)
  const set = <K extends keyof CalendarEvent>(k: K, v: CalendarEvent[K]) => setEv((x) => ({ ...x, [k]: v }))
  const save = () => {
    if (!ev.title.trim()) return toast('Dê um título ao compromisso.')
    upsert('events', ev)
    // repetição semanal: cria as próximas ocorrências como compromissos independentes
    for (let i = 1; i <= repeat; i++) upsert('events', { ...ev, id: uid(), date: addDays(ev.date, 7 * i), done: false })
    if (repeat) toast(`${repeat + 1} compromissos criados, um por semana.`)
    onClose()
  }
  return (
    <Modal
      title={editing ? 'Editar compromisso' : 'Novo compromisso'}
      onClose={onClose}
      footer={
        <>
          {editing && (
            <button
              className="btn danger ghost"
              onClick={async () => {
                if (await askDelete('este compromisso')) {
                  remove('events', ev.id)
                  onClose()
                }
              }}
            >
              Excluir
            </button>
          )}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save}>
            Salvar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Título *" span={3}>
          <input autoFocus value={ev.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Reunião de briefing, prova, orientação do TCC" />
        </Field>
        <Field label="Data">
          <input type="date" value={ev.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Horário">
          <input type="time" value={ev.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
        <Field label="Tipo">
          <select value={ev.type} onChange={(e) => set('type', e.target.value as EventType)}>
            {Object.entries(EVENT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        {!editing && (
          <Field label="Repetir toda semana" span={3} hint="Útil para aulas, orientação do TCC ou reuniões fixas.">
            <select id="event-repeat" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
              <option value={0}>Não repetir</option>
              {[4, 8, 12, 16, 20].map((n) => (
                <option key={n} value={n}>
                  Por mais {n} semanas
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Projeto relacionado" span={3}>
          <select value={ev.projectId} onChange={(e) => set('projectId', e.target.value)}>
            <option value="">—</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notas" span={3}>
          <textarea rows={2} value={ev.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
