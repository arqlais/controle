import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { Empty, Modal, Segmented } from '../components/ui'
import { ask, toast } from '../components/dialog'
import { DataEditor, DataSummary } from '../components/ContractDataForm'
import { DataWizard } from '../components/ContractDataPublic'
import { DATA_FIELDS, DEFAULT_FORM, applyToClient, cancelDataLink, completeness, dataFromClient, dataLinkUrl, dataPayload, missingOf, newLinkId, publishDataLink, qualification } from '../contractData'
import type { Client, ContractData, DataFieldRule, DataFormConfig, DataQuestion } from '../types'
import { fmtDate, today, uid, whatsappLink } from '../utils'

/* Dados para contrato (só a dona, por enquanto): pede por link os dados completos de quem contrata
   (empresa, pessoa, sócios, quem assina e o nome no contrato), acompanha quem já mandou e corrige. */

type Filter = 'todos' | 'aguardando' | 'faltando' | 'completos'

const statusOf = (c: Client, cfg?: DataFormConfig) => {
  if (c.dataLink?.status === 'enviado') return 'aguardando'
  if (c.contractData && !missingOf(c.contractData, cfg).length) return 'completo'
  return 'faltando'
}

export default function ContractDataPage({ id }: { id?: string }) {
  const { data, upsert, userId, setSettings } = useStore()
  const cfg = data.settings.dataForm
  const [formOpen, setFormOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('todos')
  const [q, setQ] = useState('')
  const [sending, setSending] = useState<string | null>(id && data.clients.some((c) => c.id === id) ? id : null)
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const clients = useMemo(() => data.clients.filter((c) => !c.archived), [data.clients])
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  // na lista: quem já tem pedido ou dados; os outros aparecem ao buscar
  const list = useMemo(() => {
    const term = norm(q.trim())
    return clients
      .filter((c) => (term ? norm(`${c.name} ${c.company}`).includes(term) : !!(c.dataLink || c.contractData)))
      .filter((c) => filter === 'todos' || (filter === 'aguardando' && statusOf(c, cfg) === 'aguardando') || (filter === 'faltando' && statusOf(c, cfg) === 'faltando') || (filter === 'completos' && statusOf(c, cfg) === 'completo'))
      .sort((a, b) => (b.dataLink?.answeredAt || b.dataLink?.sentAt || b.contractData?.updatedAt || '').localeCompare(a.dataLink?.answeredAt || a.dataLink?.sentAt || a.contractData?.updatedAt || ''))
  }, [clients, q, filter])
  const count = (f: Filter) => clients.filter((c) => (c.dataLink || c.contractData) && (f === 'aguardando' ? statusOf(c, cfg) === 'aguardando' : f === 'faltando' ? statusOf(c, cfg) === 'faltando' : statusOf(c, cfg) === 'completo')).length

  const sendClient = sending ? data.clients.find((c) => c.id === sending) : undefined
  const editClient = editing ? data.clients.find((c) => c.id === editing) : undefined

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">contratos</p>
          <h1>
            dados <em>para contrato</em>
          </h1>
        </div>
        <div className="row gap-s wrap head-acts">
          <button className="btn ghost" onClick={() => setFormOpen(true)} title="Ajustar o formulário: o que é obrigatório e perguntas a mais">
            <Icon name="settings" size={16} /> formulário
          </button>
          <button className="btn primary" onClick={() => setPicking(true)}>
            <Icon name="link" size={16} /> pedir dados
          </button>
        </div>
      </div>

      <div className="toolbar cd-toolbar">
        <div className="search inline">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar cliente…" aria-label="Buscar cliente" />
        </div>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todos', label: 'todos' },
            { value: 'aguardando', label: `aguardando${count('aguardando') ? ` (${count('aguardando')})` : ''}` },
            { value: 'faltando', label: 'faltando' },
            { value: 'completos', label: 'completos' },
          ]}
        />
      </div>

      {!list.length ? (
        <Empty
          icon="file"
          title={q ? 'nenhum cliente com esse nome' : 'nenhum pedido ainda'}
          text={q ? undefined : 'Toque em “pedir dados”, escolha o cliente e mande o link: ele preenche empresa, dados pessoais, sócios e quem assina. Tudo volta para cá e para o contrato.'}
        />
      ) : (
        <div className="cd-list">
          {list.map((c) => {
            const st = statusOf(c, cfg)
            const d = c.contractData
            const miss = d ? missingOf(d, cfg) : []
            const pct = completeness(d, cfg)
            return (
              <div key={c.id} className="cd-row card">
                <button className="cd-row-main" onClick={() => setEditing(c.id)} title="Ver e corrigir os dados">
                  <span className="cd-avatar">{c.name.slice(0, 1).toUpperCase()}</span>
                  <span className="cd-row-txt">
                    <b>{c.name}</b>
                    <small>{d ? (d.signAs === 'empresa' ? d.company.legalName || d.company.tradeName || 'empresa' : 'pessoa física') : c.company || 'sem dados ainda'}</small>
                  </span>
                  <span className={`cd-status is-${st}`}>
                    {st === 'aguardando' ? `aguardando · ${fmtDate(c.dataLink!.sentAt)}` : st === 'completo' ? 'completo' : d ? `faltam ${miss.length}` : 'sem dados'}
                  </span>
                  {d && (
                    <span className="cd-bar" title={`${pct}% preenchido`}>
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </button>
                <div className="cd-row-acts">
                  <button className="icon-btn" onClick={() => setSending(c.id)} aria-label={st === 'aguardando' ? 'Ver o link' : 'Pedir dados por link'} title={st === 'aguardando' ? 'Ver o link' : 'Pedir dados por link'}>
                    <Icon name="link" size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => setEditing(c.id)} aria-label="Corrigir dados" title="Corrigir dados">
                    <Icon name="edit" size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {formOpen && (
        <FormSettings
          value={cfg ?? DEFAULT_FORM}
          sample={clients[0]}
          onClose={() => setFormOpen(false)}
          onSave={(v) => {
            setSettings({ dataForm: v })
            toast('Formulário salvo: vale para os próximos links.')
            setFormOpen(false)
          }}
        />
      )}
      {picking && (
        <PickClient
          clients={clients}
          onClose={() => setPicking(false)}
          onPick={(cid) => {
            setPicking(false)
            setSending(cid)
          }}
        />
      )}
      {sendClient && <SendLink client={sendClient} onClose={() => setSending(null)} onEdit={() => (setSending(null), setEditing(sendClient.id))} />}
      {editClient && (
        <EditData
          client={editClient}
          onClose={() => setEditing(null)}
          onSave={(d) => {
            const next = applyToClient(editClient, { ...d, contractName: d.contractName.trim(), updatedAt: new Date().toISOString(), by: 'voce' })
            upsert('clients', next)
            toast('Dados salvos: já entram no contrato.')
            setEditing(null)
          }}
          onLink={() => (setEditing(null), setSending(editClient.id))}
          userId={userId}
        />
      )}
    </div>
  )
}

function PickClient({ clients, onClose, onPick }: { clients: Client[]; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const list = clients.filter((c) => norm(`${c.name} ${c.company}`).includes(norm(q.trim()))).slice(0, 30)
  return (
    <Modal title="pedir dados de quem?" onClose={onClose}>
      <div className="search">
        <Icon name="search" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="nome do cliente" autoFocus />
      </div>
      <div className="cd-pick">
        {list.map((c) => (
          <button key={c.id} className="cd-pick-row" onClick={() => onPick(c.id)}>
            <span className="cd-avatar">{c.name.slice(0, 1).toUpperCase()}</span>
            <span className="cd-row-txt">
              <b>{c.name}</b>
              <small>{c.company || c.email || c.phone}</small>
            </span>
            <Icon name="chevronR" size={16} />
          </button>
        ))}
        {!list.length && <p className="muted small">Nenhum cliente com esse nome. Cadastre em clientes primeiro.</p>}
        <button className="link small" onClick={() => go('clientes')}>
          <Icon name="plus" size={13} /> cadastrar cliente novo
        </button>
      </div>
    </Modal>
  )
}

function SendLink({ client, onClose, onEdit }: { client: Client; onClose: () => void; onEdit: () => void }) {
  const { data, upsert, userId } = useStore()
  const [busy, setBusy] = useState(false)
  const pending = client.dataLink?.status === 'enviado'
  const url = pending ? dataLinkUrl(client.dataLink!.id) : ''
  const first = client.name.split(' ')[0]
  const msg = (u: string) => `Oi, ${first}! Para eu preparar o seu contrato, preenche seus dados por aqui? Leva uns 3 minutos e o que eu já tinha aparece preenchido: ${u}`
  const create = async () => {
    setBusy(true)
    const linkId = newLinkId()
    try {
      if (client.dataLink?.status === 'enviado') await cancelDataLink(client.dataLink.id, userId)
      await publishDataLink(linkId, dataPayload(data.settings, client))
      upsert('clients', { ...client, dataLink: { id: linkId, sentAt: today(), status: 'enviado' }, history: [...client.history, { id: uid(), date: today(), text: 'pedido de dados para o contrato enviado por link' }] })
    } catch {
      toast('Não foi possível criar o link agora. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }
  const copy = (t: string, what: string) =>
    navigator.clipboard
      ?.writeText(t)
      .then(() => toast(`${what} copiado.`))
      .catch(() => toast('Selecione e copie.'))
  const cancel = async () => {
    if (!(await ask('Tirar o link do ar? Quem abrir não consegue mais preencher.', { confirmLabel: 'Tirar do ar' }))) return
    await cancelDataLink(client.dataLink!.id, userId)
    upsert('clients', { ...client, dataLink: undefined })
    onClose()
  }
  const missing = client.contractData ? missingOf(client.contractData, data.settings.dataForm) : []
  return (
    <Modal title={`dados de ${first}`} onClose={onClose}>
      {!pending ? (
        <div className="cd-send">
          <p className="muted">
            O link já vai com o que você tem no cadastro{client.contractData ? ' e os dados que ele mandou antes' : ''}. {first} completa o resto: empresa, dados pessoais, sócios, quem assina e o nome que vai no contrato.
          </p>
          {client.contractData && missing.length > 0 && <p className="small">Falta hoje: {missing.join(', ')}.</p>}
          <button className="btn primary" disabled={busy} onClick={() => void create()}>
            <Icon name="link" size={15} /> {busy ? 'criando…' : 'criar link'}
          </button>
        </div>
      ) : (
        <div className="cd-send">
          <p className="cd-link">
            <Icon name="link" size={15} />
            <span>{url}</span>
          </p>
          <div className="cd-send-acts">
            <a className="btn primary" href={whatsappLink(client.phone, msg(url))} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={15} /> WhatsApp
            </a>
            <button className="btn ghost" onClick={() => copy(msg(url), 'Mensagem')}>
              <Icon name="copy" size={15} /> mensagem
            </button>
            <button className="icon-btn" onClick={() => copy(url, 'Link')} aria-label="Copiar só o link" title="Copiar só o link">
              <Icon name="link" size={16} />
            </button>
            <a className="icon-btn" href={url} target="_blank" rel="noreferrer" aria-label="Abrir como o cliente vê" title="Abrir como o cliente vê">
              <Icon name="eye" size={16} />
            </a>
          </div>
          <p className="muted small">
            Enviado em {fmtDate(client.dataLink!.sentAt)}. Quando {first} terminar, você recebe um aviso e os dados entram sozinhos no cadastro e no contrato.
          </p>
          <div className="cd-send-foot">
            <button className="link small" onClick={onEdit}>
              <Icon name="edit" size={13} /> preencher eu mesma
            </button>
            <button className="link small muted-link" onClick={() => void cancel()}>
              <Icon name="x" size={13} /> tirar do ar
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function EditData({ client, onClose, onSave, onLink }: { client: Client; onClose: () => void; onSave: (d: ContractData) => void; onLink: () => void; userId: string }) {
  const { data } = useStore()
  const cfg = data.settings.dataForm
  const [d, setD] = useState<ContractData>(() => dataFromClient(client))
  const [view, setView] = useState<'ver' | 'editar'>(client.contractData ? 'ver' : 'editar')
  const set = (patch: Partial<ContractData>) => setD((cur) => ({ ...cur, ...patch }))
  const miss = missingOf(d, cfg)
  const copy = () =>
    navigator.clipboard
      ?.writeText(qualification(d))
      .then(() => toast('Qualificação copiada.'))
      .catch(() => toast('Selecione e copie.'))
  return (
    <Modal
      wide
      title={client.name}
      onClose={onClose}
      footer={
        view === 'editar' ? (
          <>
            <button className="btn ghost" onClick={onClose}>
              cancelar
            </button>
            <button className="btn primary" onClick={() => onSave(d)}>
              <Icon name="check" size={15} /> salvar
            </button>
          </>
        ) : undefined
      }
    >
      <div className="cd-edit-top">
        <Segmented<'ver' | 'editar'>
          value={view}
          onChange={setView}
          options={[
            { value: 'ver', label: 'resumo' },
            { value: 'editar', label: 'corrigir' },
          ]}
        />
        <div className="row gap-s">
          <button className="icon-btn" onClick={copy} aria-label="Copiar a qualificação para o contrato" title="Copiar a qualificação para o contrato">
            <Icon name="copy" size={16} />
          </button>
          <button className="icon-btn" onClick={onLink} aria-label="Pedir por link" title="Pedir por link">
            <Icon name="link" size={16} />
          </button>
        </div>
      </div>
      <p className={`cd-state ${miss.length ? 'is-miss' : 'is-ok'}`}>
        <Icon name={miss.length ? 'alert' : 'check'} size={15} /> {miss.length ? `falta: ${miss.join(', ')}` : 'tudo certo para o contrato'}
        {client.contractData?.by === 'cliente' && client.dataLink?.answeredAt && <small> · enviado pelo cliente em {fmtDate(client.dataLink.answeredAt.slice(0, 10))}</small>}
      </p>
      {view === 'ver' ? (
        <>
          <DataSummary d={d} />
          <div className="cd-qual">
            <p className="cd-sub">como entra no contrato</p>
            <p>{qualification(d)}</p>
          </div>
          {d.notes && (
            <p className="small">
              <b>observações:</b> {d.notes}
            </p>
          )}
        </>
      ) : (
        <DataEditor d={d} set={set} cfg={cfg} />
      )}
    </Modal>
  )
}

const RULES: { value: DataFieldRule; label: string }[] = [
  { value: 'obrigatorio', label: 'obrigatório' },
  { value: 'opcional', label: 'opcional' },
  { value: 'oculto', label: 'não pedir' },
]
const GROUPS: { key: 'empresa' | 'voce' | 'final'; icon: string; title: string }[] = [
  { key: 'empresa', icon: 'building', title: 'empresa' },
  { key: 'voce', icon: 'user', title: 'dados pessoais' },
  { key: 'final', icon: 'pen', title: 'contrato' },
]
const KINDS: { value: DataQuestion['kind']; label: string }[] = [
  { value: 'texto', label: 'texto curto' },
  { value: 'longo', label: 'texto longo' },
  { value: 'simnao', label: 'sim ou não' },
  { value: 'escolha', label: 'escolha' },
]

/** Seu formulário: o que é obrigatório, opcional ou não é pedido, texto de abertura e perguntas a mais. */
function FormSettings({ value, sample, onClose, onSave }: { value: DataFormConfig; sample?: Client; onClose: () => void; onSave: (v: DataFormConfig) => void }) {
  const { data } = useStore()
  const [v, setV] = useState<DataFormConfig>(value)
  const [tab, setTab] = useState<'campos' | 'perguntas' | 'previa'>('campos')
  const ruleOf = (k: (typeof DATA_FIELDS)[number]) => v.rules[k.key] ?? k.def
  const setRule = (key: string, r: DataFieldRule) => setV({ ...v, rules: { ...v.rules, [key]: r } })
  const setQ = (id: string, patch: Partial<DataQuestion>) => setV({ ...v, extra: v.extra.map((q) => (q.id === id ? { ...q, ...patch } : q)) })
  const addQ = () => setV({ ...v, extra: [...v.extra, { id: uid(), label: '', kind: 'texto', options: [], required: false, step: 'final' }] })
  const delQ = (id: string) => setV({ ...v, extra: v.extra.filter((q) => q.id !== id) })
  const clean: DataFormConfig = { ...v, extra: v.extra.filter((q) => q.label.trim()) }
  const previewClient: Client = sample ?? ({ id: 'x', name: 'Cliente Exemplo', company: '', type: 'arquiteto', email: '', phone: '', instagram: '', city: '', document: '', origin: '', notes: '', favorite: false, history: [], archived: false, createdAt: today() } as Client)
  return (
    <Modal
      wide
      title="seu formulário"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={() => setV(DEFAULT_FORM)} title="Voltar ao formulário padrão">
            <Icon name="undo" size={15} /> padrão
          </button>
          <button className="btn primary" onClick={() => onSave(clean)}>
            <Icon name="check" size={15} /> salvar
          </button>
        </>
      }
    >
      <Segmented<'campos' | 'perguntas' | 'previa'>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'campos', label: 'campos' },
          { value: 'perguntas', label: `perguntas${v.extra.length ? ` (${v.extra.length})` : ''}` },
          { value: 'previa', label: <><Icon name="eye" size={14} /> prévia</> },
        ]}
      />
      {tab === 'campos' && (
        <div className="cdf">
          <label className="field">
            <span className="field-label">texto de abertura</span>
            <textarea rows={2} value={v.intro} onChange={(e) => setV({ ...v, intro: e.target.value })} placeholder="Para preparar o seu contrato, preciso de alguns dados. O que já tínhamos aparece preenchido: é só completar." />
          </label>
          {GROUPS.map((g) => (
            <section key={g.key} className="cdf-group">
              <header className="cd-blk-head">
                <span className="cd-ico">
                  <Icon name={g.icon} size={15} />
                </span>
                <b>{g.title}</b>
              </header>
              {DATA_FIELDS.filter((f) => f.group === g.key).map((f) => (
                <div key={f.key} className="cdf-row">
                  <span>{f.label}</span>
                  {f.fixed ? (
                    <small className="cdf-fixed">
                      <Icon name="lock" size={12} /> sempre
                    </small>
                  ) : (
                    <div className="segmented cdf-seg">
                      {RULES.filter((r) => !(f.key === 'partners' && r.value === 'obrigatorio')).map((r) => (
                        <button key={r.value} type="button" className={ruleOf(f) === r.value ? 'active' : ''} onClick={() => setRule(f.key, r.value)}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      {tab === 'perguntas' && (
        <div className="cdf">
          <p className="muted small">Perguntas suas, além dos dados do contrato (ex.: “quem acompanha a obra?”). As respostas aparecem no resumo do cliente.</p>
          {v.extra.map((q) => (
            <div key={q.id} className="cdf-q">
              <div className="cdf-q-top">
                <input value={q.label} onChange={(e) => setQ(q.id, { label: e.target.value })} placeholder="escreva a pergunta" aria-label="Pergunta" />
                <button className="icon-btn" onClick={() => delQ(q.id)} aria-label="Apagar pergunta" title="Apagar pergunta">
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <div className="cdf-q-opts">
                <select value={q.kind} onChange={(e) => setQ(q.id, { kind: e.target.value as DataQuestion['kind'] })} aria-label="Tipo de resposta">
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <select value={q.step} onChange={(e) => setQ(q.id, { step: e.target.value as DataQuestion['step'] })} aria-label="Em qual passo">
                  <option value="empresa">no passo da empresa</option>
                  <option value="voce">no passo dos dados pessoais</option>
                  <option value="final">no fim</option>
                </select>
                <label className="check">
                  <input type="checkbox" checked={q.required} onChange={(e) => setQ(q.id, { required: e.target.checked })} />
                  <span>obrigatória</span>
                </label>
              </div>
              {q.kind === 'escolha' && <input value={q.options.join(', ')} onChange={(e) => setQ(q.id, { options: e.target.value.split(',').map((x) => x.trimStart()) })} placeholder="opções separadas por vírgula" aria-label="Opções" />}
            </div>
          ))}
          <button type="button" className="cd-add" onClick={addQ}>
            <span className="cd-ico">
              <Icon name="plus" size={16} />
            </span>
            nova pergunta
          </button>
        </div>
      )}
      {tab === 'previa' && (
        <div className="cdf-preview">
          <p className="muted small">
            <Icon name="eye" size={13} /> é assim que o cliente vê (nada é enviado)
          </p>
          <div className="cdp is-preview">
            <main className="cdp-card">
              <DataWizard key={JSON.stringify(clean)} id="previa" preview cloud={false} payload={{ ...dataPayload(data.settings, previewClient), form: clean }} />
            </main>
          </div>
        </div>
      )}
    </Modal>
  )
}
