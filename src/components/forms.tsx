import { ask, askDelete, toast } from './dialog'
import { DateInput } from './DateInput'
import { useState } from 'react'
import { useStore } from '../store'
import { HowPaid } from './quick'
import type { CalendarEvent, Client, ClientProfile, ClientType, EventType, Expense, ExpenseCategory, Priority, Project, ProjectStatus } from '../types'
import {
  clientTypeOptions,
  defaultClientType,
  projectExtras,
  projectTotal,
  DEFAULT_TASKS,
  EVENT_TYPES,
  eventTypeLabel,
  EXPENSE_CATEGORIES,
  PRIORITY,
  statusInfo,
  allStatuses,
  isStudent,
  suggestPrice,
  titleCase,
  PAY_MODES,
  type PayMode,
  money,
  splitPayments,
  today,
  addDays,
  uid,
  formatDoc,
  docKind,
  showDoc,
  lookupCnpj,
  typeHandle,
} from '../utils'
import { EmailInput, Field, Modal, MoneyInput, PhoneInput, Segmented, CepInput, ServiceOptions } from './ui'
import { Icon } from './Icon'
import { tasksFor, workKind } from '../processes'

/* ---------------- Cliente ---------------- */

export const MARITAL = ['solteira(o)', 'casada(o)', 'união estável', 'divorciada(o)', 'viúva(o)']
export const PROPERTY_TYPES = ['apartamento', 'casa', 'casa em condomínio', 'sala / loja comercial', 'escritório', 'terreno', 'outro']

export function newClient(type: ClientType = 'arquiteto'): Client {
  return {
    id: uid(),
    name: '',
    company: '',
    type,
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

export function ClientForm({ initial, name, type, onClose, onSaved }: { initial?: Client; name?: string; type?: ClientType; onClose: () => void; onSaved?: (c: Client) => void }) {
  const { data, upsert } = useStore()
  const profile = data.settings.workProfile
  const [c, setC] = useState<Client>(initial ?? { ...newClient(type ?? defaultClientType(profile)), name: name ?? '' })
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setC((x) => ({ ...x, [k]: v }))
  const setP = (k: keyof ClientProfile, v: string) => setC((x) => ({ ...x, profile: { ...x.profile, [k]: v } }))
  const final = c.type === 'final'
  const pr = c.profile ?? {}
  // dados da empresa (CNPJ): fechados até precisar; abrem sozinhos se já tiver algo
  const [showCompany, setShowCompany] = useState(!!(c.companyDoc || c.companyLegal || c.companyKind || docKind(c.document) === 'CNPJ'))
  const [cnpjState, setCnpjState] = useState('')
  const [cepState, setCepState] = useState('')
  const changeCnpj = async (raw: string) => {
    const v = formatDoc(raw)
    set('companyDoc', v)
    if (v.replace(/\D/g, '').length !== 14) return setCnpjState('')
    setCnpjState('buscando a empresa…')
    const r = await lookupCnpj(v)
    if (!r) return setCnpjState('Não achei esse CNPJ · preencha à mão.')
    setCnpjState('Dados da empresa preenchidos.')
    setC((x) => ({
      ...x,
      companyLegal: r.legal || x.companyLegal,
      companyKind: r.kind || x.companyKind,
      company: x.company || r.trade || r.legal,
      cep: x.cep || r.cep,
      address: x.address || r.address.replace(/, (\d+[^,]*)(?=,)/, ''),
      addressNumber: x.addressNumber || (r.address.match(/, (\d+[^,]*)(?=,)/)?.[1] ?? ''),
      city: x.city || r.city,
    }))
  }
  const save = () => {
    if (!c.name.trim()) return toast('Informe o nome do cliente.')
    const saved = { ...c, name: titleCase(c.name) }
    upsert('clients', saved)
    onSaved?.(saved)
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
            {clientTypeOptions(profile, c.type).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={final ? 'Empresa (se for projeto comercial)' : 'Empresa / escritório / faculdade'} span={2}>
          <input value={c.company} onChange={(e) => set('company', e.target.value)} />
        </Field>
        <Field label="CPF" hint={docKind(c.document) === 'CNPJ' ? 'Isso é um CNPJ: coloque em “dados da empresa” abaixo.' : 'Da pessoa · usado nos recibos'}>
          <input value={showDoc(c.document)} inputMode="numeric" onChange={(e) => set('document', formatDoc(e.target.value))} placeholder="só os números" />
        </Field>
        <Field label="WhatsApp">
          <PhoneInput id="client-phone" value={c.phone} onChange={(v) => set('phone', v)} />
        </Field>
        <Field label="E-mail">
          <EmailInput id="client-email" value={c.email} onChange={(v) => set('email', v)} />
        </Field>
        <Field label="Instagram">
          <input value={c.instagram} onChange={(e) => set('instagram', typeHandle(e.target.value))} placeholder="@perfil" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </Field>
        <Field label="CEP" hint={cepState || undefined}>
          <CepInput id="client-cep" value={c.cep ?? ''} onChange={(v) => set('cep', v)} onState={setCepState} onFound={({ address, city }) => setC((x) => ({ ...x, address, city }))} />
        </Field>
        <Field label="Número e complemento">
          <input value={c.addressNumber ?? ''} onChange={(e) => set('addressNumber', e.target.value)} placeholder="Ex.: 120, sala 4" />
        </Field>
        <Field label="Cidade">
          <input value={c.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="Endereço" span={3}>
          <input value={c.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder="Rua, bairro" />
        </Field>
        <Field label="Como chegou até você" span={2}>
          <input list="origins" value={c.origin} onChange={(e) => set('origin', e.target.value)} />
          <datalist id="origins">
            {['Indicação', 'Instagram', 'Site', 'Faculdade', 'LinkedIn', 'Behance', 'Cliente recorrente'].map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
        <Field group label="Favorito">
          <Segmented
            value={c.favorite ? 's' : 'n'}
            options={[
              { value: 'n', label: 'Não' },
              { value: 's', label: '★ Sim' },
            ]}
            onChange={(v) => set('favorite', v === 's')}
          />
        </Field>
        <div className="company-block" style={{ gridColumn: '1 / -1' }}>
          {!showCompany ? (
            <button type="button" className="link" onClick={() => setShowCompany(true)}>
              + dados da empresa (CNPJ, MEI) · opcional
            </button>
          ) : (
            <div className="form-grid">
              <Field label="CNPJ da empresa" hint={cnpjState || 'Com o CNPJ, a razão social e o endereço vêm sozinhos.'}>
                <input value={showDoc(c.companyDoc ?? '')} inputMode="numeric" placeholder="00.000.000/0000-00" onChange={(e) => void changeCnpj(e.target.value)} />
              </Field>
              <Field label="Razão social" span={2}>
                <input value={c.companyLegal ?? ''} onChange={(e) => set('companyLegal', e.target.value)} placeholder="Nome registrado da empresa" />
              </Field>
              <Field label="Tipo de empresa">
                <select value={c.companyKind ?? ''} onChange={(e) => set('companyKind', e.target.value)}>
                  <option value="">—</option>
                  <option value="MEI">MEI</option>
                  <option value="ME">ME (microempresa)</option>
                  <option value="EPP">EPP</option>
                  <option value="LTDA">LTDA</option>
                  <option value="outra">outra</option>
                </select>
              </Field>
              <Field group label="Recibo em nome de" span={2}>
                <Segmented<'pessoa' | 'empresa'>
                  value={c.billTo ?? (c.companyDoc ? 'empresa' : 'pessoa')}
                  onChange={(v) => set('billTo', v)}
                  options={[
                    { value: 'pessoa', label: 'da pessoa (CPF)' },
                    { value: 'empresa', label: 'da empresa (CNPJ)' },
                  ]}
                />
              </Field>
            </div>
          )}
        </div>
        {final && (
          <div className="final-block" style={{ gridColumn: '1 / -1' }}>
            <p className="final-title">
              <Icon name="users" size={15} /> sobre o cliente e a família
            </p>
            <div className="form-grid">
              <Field label="Profissão">
                <input value={pr.profession ?? ''} onChange={(e) => setP('profession', e.target.value)} placeholder="Ex.: médica" />
              </Field>
              <Field label="Estado civil">
                <select value={pr.marital ?? ''} onChange={(e) => setP('marital', e.target.value)}>
                  <option value="">—</option>
                  {MARITAL.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data de nascimento">
                <DateInput value={pr.birthDate ?? ''} onChange={(e) => setP('birthDate', e.target.value)} />
              </Field>
              <Field label="Quem mora / vai usar o espaço" span={2}>
                <input value={pr.household ?? ''} onChange={(e) => setP('household', e.target.value)} placeholder="Ex.: casal, 2 filhos e a avó" />
              </Field>
              <Field label="Filhos (idades)">
                <input value={pr.kids ?? ''} onChange={(e) => setP('kids', e.target.value)} placeholder="Ex.: 4 e 9 anos" />
              </Field>
              <Field label="Pets">
                <input value={pr.pets ?? ''} onChange={(e) => setP('pets', e.target.value)} placeholder="Ex.: 1 gato" />
              </Field>
              <Field label="Rotina e hábitos" span={2}>
                <input value={pr.routine ?? ''} onChange={(e) => setP('routine', e.target.value)} placeholder="Trabalha em casa, recebe visitas, cozinha todo dia…" />
              </Field>
              <Field label="Estilo e referências" span={3}>
                <input value={pr.style ?? ''} onChange={(e) => setP('style', e.target.value)} placeholder="Ex.: aconchegante, madeira clara, não gosta de cinza" />
              </Field>
            </div>
            <p className="final-title">
              <Icon name="home" size={15} /> o imóvel
            </p>
            <div className="form-grid">
              <Field label="Tipo de imóvel">
                <select value={pr.propertyType ?? ''} onChange={(e) => setP('propertyType', e.target.value)}>
                  <option value="">—</option>
                  {PROPERTY_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Próprio ou alugado">
                <select value={pr.propertyOwnership ?? ''} onChange={(e) => setP('propertyOwnership', e.target.value)}>
                  <option value="">—</option>
                  {['próprio', 'alugado', 'na planta', 'de família'].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Metragem (m²)">
                <input value={pr.propertyArea ?? ''} inputMode="decimal" onChange={(e) => setP('propertyArea', e.target.value)} placeholder="Ex.: 85" />
              </Field>
              <Field label="Endereço da obra" span={3} hint="Se for diferente do endereço do cliente.">
                <input value={pr.propertyAddress ?? ''} onChange={(e) => setP('propertyAddress', e.target.value)} />
              </Field>
              <Field label="Investimento previsto" span={2}>
                <input value={pr.investment ?? ''} onChange={(e) => setP('investment', e.target.value)} placeholder="Ex.: até R$ 80 mil na obra" />
              </Field>
              <Field label="Prazo desejado">
                <input value={pr.deadline ?? ''} onChange={(e) => setP('deadline', e.target.value)} placeholder="Ex.: mudar em março" />
              </Field>
            </div>
          </div>
        )}
        <Field label="Observações" span={3} hint={final ? 'O que mais for importante lembrar sobre o cliente e o projeto.' : 'Preferências de estilo, softwares que usa, forma de enviar arquivos...'}>
          <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" rows={3} value={c.notes} onChange={(e) => set('notes', e.target.value)} />
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
    revisionsIncluded: 1,
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

export function ProjectForm({ initial, clientId, past: startPast, onClose, onSaved }: { initial?: Project; clientId?: string; past?: boolean; onClose: () => void; onSaved?: (p: Project) => void }) {
  const { data, upsert } = useStore()
  const { settings } = data
  const [p, setP] = useState<Project>(() => initial ?? { ...newProject(clientId), revisionsIncluded: settings.defaultRevisions })
  const [payMode, setPayMode] = useState<PayChoice>(initial?.payments.length ? 'manter' : '50-50')
  const [showNewClient, setShowNewClient] = useState(false)
  const [showEditClient, setShowEditClient] = useState(false)
  // trabalho antigo (feito antes do sistema): entra já entregue e pago, sem orçamento e sem número
  const [past, setPast] = useState(!!startPast)
  const [pastDates, setPastDates] = useState<Record<number, string>>({})
  const [pastMethod, setPastMethod] = useState('Pix')
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP((x) => ({ ...x, [k]: v }))
  const client = data.clients.find((c) => c.id === p.clientId)
  const service = settings.services.find((s) => s.id === p.service)
  const suggested = suggestPrice(service, p.quantity, 'media', isStudent(client), settings)
  const total = projectTotal(p)
  const extrasTotal = projectExtras(p)

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
    if (past && !initial) {
      const when = final.dueDate || final.startDate || today()
      final = {
        ...final,
        status: 'entregue',
        deliveredDate: when,
        payments: final.payments.map((x, i) => {
          const d = pastDates[i] || x.dueDate || when
          return { ...x, dueDate: d, paidDate: d, method: payMode === 'cartao' ? x.method : pastMethod }
        }),
        tasks: DEFAULT_TASKS.map((text) => ({ id: uid(), text, done: true })),
      }
    }
    if (final.status === 'entregue' && !final.deliveredDate) final = { ...final, deliveredDate: today() }
    if (!final.tasks.length && !initial) {
      final = {
        ...final,
        // checklist conforme o tipo de trabalho: freelancer, estudante ou cliente final
        tasks: tasksFor(data.settings, workKind(data.clients.find((c) => c.id === final.clientId))).map((text) => ({
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
      title={initial ? 'Editar projeto' : past ? 'Trabalho antigo' : 'Nova demanda'}
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
        {!initial && (
          <label className="check toggle past-job" style={{ gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} /> cliente / trabalho antigo, já entregue e pago: entra no financeiro nas datas que você escolher, sem orçamento e sem número
          </label>
        )}
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
            {client && (
              <button type="button" className="btn ghost small" onClick={() => setShowEditClient(true)} title="Editar dados do cliente">
                <Icon name="edit" size={14} />
              </button>
            )}
            <button type="button" className="btn ghost small" onClick={() => setShowNewClient(true)} title="Novo cliente">
              +
            </button>
          </div>
        </Field>

        <Field label="Serviço">
          <select value={p.service} onChange={(e) => applyService(e.target.value)}>
            <option value="">—</option>
            <ServiceOptions services={settings.services} />
          </select>
        </Field>
        <Field label={`Quantidade${service ? ` (${service.unit}s)` : ''}`}>
          <input type="number" min={0} inputMode="decimal" value={p.quantity || ''} placeholder="0" onFocus={(e) => e.target.select()} onChange={(e) => applyService(p.service, Number(e.target.value) || 0)} />
        </Field>
        <Field label="Status">
          <select value={p.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
            {allStatuses().map((k) => (
              <option key={k} value={k}>
                {statusInfo(k).label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Início">
          <DateInput value={p.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Prazo de entrega">
          <DateInput value={p.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field group label="Prioridade">
          <Segmented
            value={p.priority}
            options={(Object.keys(PRIORITY) as Priority[]).map((k) => ({ value: k, label: PRIORITY[k].label }))}
            onChange={(v) => set('priority', v)}
          />
        </Field>

        {(p.items ?? []).length > 0 ? (
          <Field label="Valor e desconto" span={2} hint="Definidos pelo pacote, na página da demanda.">
            <div className="readonly">
              {money(p.value)} − {money(p.discount)}
            </div>
          </Field>
        ) : (
          <>
            <Field label="Valor" hint={suggested ? `Tabela ${isStudent(client) ? 'estudante' : 'profissional'}: ${money(suggested)}` : undefined}>
              <MoneyInput value={p.value} onChange={(n) => set('value', n)} />
            </Field>
            <Field label="Desconto">
              <MoneyInput value={p.discount} onChange={(n) => set('discount', n)} />
            </Field>
          </>
        )}
        <Field label="Total" hint={extrasTotal ? `inclui ${money(extrasTotal)} de adicionais` : undefined}>
          <div className="readonly">{money(total)}</div>
        </Field>

        <Field group label="Forma de pagamento" span={3} hint="Gera as parcelas automaticamente. Você pode ajustar cada uma depois, na página do projeto.">
          <Segmented<PayChoice>
            value={payMode}
            options={[
              ...(initial?.payments.length ? [{ value: 'manter' as PayChoice, label: 'manter parcelas atuais' }] : []),
              ...(Object.keys(PAY_MODES) as PayMode[]).map((k) => ({ value: k as PayChoice, label: PAY_MODES[k] })),
            ]}
            onChange={setPayMode}
          />
        </Field>

        {past && !initial && total > 0 && payMode !== 'manter' && (
          <div className="past-pays" style={{ gridColumn: '1 / -1' }}>
            <span className="field-label">quando você recebeu? (o financeiro conta cada valor no mês desta data)</span>
            {splitPayments(total, payMode, p.startDate || today(), p.dueDate || p.startDate || today()).map((x, i) => (
              <div key={i} className="past-pay-row">
                <span>
                  {x.description} · <b>{money(x.amount)}</b>
                </span>
                <DateInput value={pastDates[i] || x.dueDate || today()} onChange={(e) => setPastDates((d) => ({ ...d, [i]: e.target.value }))} />
              </div>
            ))}
            {payMode !== 'cartao' && <HowPaid method={pastMethod} onChange={setPastMethod} amount={total} />}
          </div>
        )}

        <Field label="Revisões incluídas">
          <input type="number" min={0} value={p.revisionsIncluded} onChange={(e) => set('revisionsIncluded', Number(e.target.value) || 0)} />
        </Field>
        <Field label="Link dos arquivos" span={2} hint="Drive, WeTransfer, Dropbox…">
          <input value={p.filesLink} onChange={(e) => set('filesLink', e.target.value)} placeholder="https://" />
        </Field>

        <Field label="Briefing / descrição" span={3}>
          <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" rows={3} value={p.description} onChange={(e) => set('description', e.target.value)} placeholder="Ambientes, referências, estilo, câmeras, formato de entrega…" />
        </Field>
      </div>
      {showEditClient && client && <ClientForm initial={client} onClose={() => setShowEditClient(false)} />}
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
          <DateInput value={e.date} onChange={(ev) => set('date', ev.target.value)} />
        </Field>
        <Field group label="Recorrência">
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
  const { data, upsert, remove, setSettings } = useStore()
  const [rename, setRename] = useState(false)
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
          <input autoFocus value={ev.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Reunião de briefing, prova, orientação do TCC" spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" />
        </Field>
        <Field label="Data">
          <DateInput value={ev.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Horário">
          <input type="time" value={ev.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
        <Field
          group
          label="Tipo"
          hint={
            <button type="button" className="link small" onClick={() => setRename((v) => !v)}>
              {rename ? 'fechar' : 'renomear os tipos'}
            </button>
          }
        >
          <select value={ev.type} onChange={(e) => set('type', e.target.value as EventType)}>
            {(Object.keys(EVENT_TYPES) as EventType[]).map((k) => (
              <option key={k} value={k}>
                {eventTypeLabel(k)}
              </option>
            ))}
          </select>
        </Field>
        {rename && (
          <div className="event-rename" style={{ gridColumn: '1 / -1' }}>
            <p className="muted small">Os tipos são seus: troque os nomes como fizer sentido na sua rotina (ex.: “Estudos / faculdade” vira “Curso” ou “Visita de obra”).</p>
            {(Object.keys(EVENT_TYPES) as EventType[])
              .filter((k) => k !== 'outro')
              .map((k) => (
                <label key={k} className="event-rename-row">
                  <span className="dot" style={{ background: EVENT_TYPES[k].color }} />
                  <input
                    value={data.settings.eventLabels?.[k] ?? EVENT_TYPES[k].label}
                    onChange={(e) => setSettings({ eventLabels: { ...data.settings.eventLabels, [k]: e.target.value } })}
                    aria-label={`Nome do tipo ${EVENT_TYPES[k].label}`}
                  />
                </label>
              ))}
          </div>
        )}
        {ev.type === 'outro' && (
          <Field label="Qual tipo?" span={3} hint="Opcional. Ex.: curso, médico, visita de obra.">
            <input
              value={ev.customType ?? ''}
              onChange={(e) => set('customType', e.target.value)}
              list="event-custom-types"
              placeholder="Digite o tipo"
              autoCapitalize="sentences"
            />
            <datalist id="event-custom-types">
              {[...new Set(data.events.map((x) => x.customType?.trim()).filter(Boolean))].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
        )}
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
          <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" rows={2} value={ev.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {data.settings.calendarToken && data.settings.calendarSync?.compromissos !== false && (
          <div className="field span-3">
            <label className="check toggle">
              <input type="checkbox" checked={!ev.noPhone} onChange={(e) => set('noPhone', !e.target.checked)} /> mandar para a agenda do celular
            </label>
          </div>
        )}
      </div>
    </Modal>
  )
}
