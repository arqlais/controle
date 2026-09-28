import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { Badge, Empty, Field, Modal, Section, Segmented } from '../components/ui'
import { ask, askDelete, toast } from '../components/dialog'
import { ContractDoc } from '../components/ContractDoc'
import { DocScale, DocZoom, usePdf } from '../components/Print'
import { CONTRACT_VARS, contractSettings, contractVars, defaultTemplates, fillContract, suggestTemplate } from '../contracts'
import { useAccess } from '../access'
import type { Contract, ContractStatus, ContractTemplate } from '../types'
import { fmtDateLong, matches, quoteNumber, today, uid, whatsappLink } from '../utils'

/* Contratos: escolhe um orçamento + um modelo → o texto sai preenchido
   (cliente, CPF/CNPJ, serviços, valor, prazo, pagamento…) e pode ser editado à vontade. */

const STATUS: Record<ContractStatus, { label: string; color: string }> = {
  rascunho: { label: 'rascunho', color: '#9aa3ab' },
  enviado: { label: 'enviado', color: '#c29a55' },
  assinado: { label: 'assinado', color: '#5e8c6a' },
}

export default function Contracts({ id }: { id?: string }) {
  const { data, setSettings } = useStore()
  const { isOwner } = useAccess()
  const cs = contractSettings(data.settings, isOwner)
  if (cs.off)
    return (
      <div className="page">
        <Head />
        <Section title="contratos desligados">
          <p className="muted">Você marcou que não usa contratos. Ligando de novo, os modelos e os contratos que você já fez continuam aqui.</p>
          <button className="btn primary" onClick={() => setSettings({ contracts: { ...cs, off: false } })}>
            <Icon name="check" size={16} /> usar contratos
          </button>
        </Section>
      </div>
    )
  if (id && id !== 'modelos') return <ContractEditor key={id} id={id} />
  return <ContractList startTab={id === 'modelos' ? 'modelos' : 'lista'} />
}

function Head({ children }: { children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">documentos</p>
        <h1>
          contratos <em>&amp; modelos</em>
        </h1>
      </div>
      {children}
    </div>
  )
}

function Disclaimer() {
  return (
    <p className="pf-note">
      <Icon name="alert" size={16} />
      <span>
        <b>São modelos de referência.</b> Cada profissional deve revisar o texto com um advogado antes de usar, de acordo com o próprio trabalho.
      </span>
    </p>
  )
}

function ContractList({ startTab }: { startTab: 'lista' | 'modelos' }) {
  const { data, setSettings } = useStore()
  const { isOwner } = useAccess()
  const cs = contractSettings(data.settings, isOwner)
  const [tab, setTab] = useState<'lista' | 'modelos'>(startTab)
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const client = (id: string) => data.clients.find((c) => c.id === id)
  const rows = useMemo(
    () => [...(data.contracts ?? [])].filter((c) => matches(q, c.title, client(c.clientId)?.name)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.contracts, data.clients, q],
  )

  return (
    <div className="page">
      <Head>
        <div className="row gap-s wrap">
          <button
            className="btn ghost"
            onClick={async () => (await ask('Esconder os contratos do menu? Nada é apagado; dá para ligar de novo em configurações → propostas.', { confirmLabel: 'Não uso contratos' })) && setSettings({ contracts: { ...cs, off: true } })}
          >
            não uso contratos
          </button>
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> novo contrato
          </button>
        </div>
      </Head>
      <Disclaimer />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'lista', label: `meus contratos (${rows.length})` },
          { value: 'modelos', label: `modelos (${cs.templates.length})` },
        ]}
      />
      {tab === 'lista' ? (
        rows.length || q ? (
          <Section title="contratos" action={<input className="pf-search" type="search" placeholder="buscar…" value={q} onChange={(e) => setQ(e.target.value)} />}>
            <div className="pf-list">
              {rows.map((c) => (
                <a key={c.id} className="pf-row" href={href('contratos', c.id)}>
                  <Icon name="file" size={18} />
                  <span className="grow">
                    <b>{c.title}</b>
                    <small className="muted">
                      {client(c.clientId)?.name ?? 'sem cliente'} · {fmtDateLong(c.createdAt)}
                    </small>
                  </span>
                  <Badge color={STATUS[c.status].color}>{STATUS[c.status].label}</Badge>
                </a>
              ))}
            </div>
          </Section>
        ) : (
          <Empty icon="file" title="nenhum contrato ainda" text="Escolha um orçamento e um modelo: o contrato já sai preenchido com cliente, serviços, valor, prazo e pagamento." action={<button className="btn primary" onClick={() => setCreating(true)}>criar o primeiro contrato</button>} />
        )
      ) : (
        <TemplatesEditor />
      )}
      {creating && <NewContract onClose={() => setCreating(false)} />}
    </div>
  )
}

function NewContract({ onClose }: { onClose: () => void }) {
  const { data, upsert } = useStore()
  const { isOwner } = useAccess()
  const cs = contractSettings(data.settings, isOwner)
  // 1) cliente → 2) orçamento dele (o aprovado mais recente já vem escolhido) → 3) modelo sugerido pelo serviço
  const withQuotes = [...data.clients].filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name))
  const lastApproved = [...data.quotes].filter((x) => x.status === 'aprovado').sort((a, b) => (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt))[0]
  const [clientId, setClientId] = useState(lastApproved?.clientId ?? '')
  const quotesOf = (id: string) => data.quotes.filter((x) => x.clientId === id).sort((a, b) => (a.status === 'aprovado' ? 0 : 1) - (b.status === 'aprovado' ? 0 : 1) || b.number - a.number)
  const [quoteId, setQuoteId] = useState(lastApproved?.id ?? '')
  const quote = data.quotes.find((x) => x.id === quoteId)
  const [tplId, setTplId] = useState(suggestTemplate(cs.templates, lastApproved)?.id ?? '')
  const client = data.clients.find((c) => c.id === clientId)
  const pickClient = (id: string) => {
    setClientId(id)
    const q = quotesOf(id)[0]
    setQuoteId(q?.id ?? '')
    setTplId(suggestTemplate(cs.templates, q)?.id ?? tplId)
  }
  const pickQuote = (id: string) => {
    setQuoteId(id)
    setTplId(suggestTemplate(cs.templates, data.quotes.find((x) => x.id === id))?.id ?? tplId)
  }
  // o que falta preencher (aparece antes de criar)
  const vars = contractVars(data.settings, quote, client)
  const tpl = cs.templates.find((t) => t.id === tplId) ?? cs.templates[0]
  const missing = tpl ? [...new Set((fillContract(tpl.body, vars).match(/\[[^\]\n]{3,40}\]/g) ?? []).map((x) => x.slice(1, -1)))] : []
  const create = () => {
    if (!tpl) return toast('Crie um modelo primeiro.')
    const c: Contract = {
      id: uid(),
      title: `contrato · ${quote?.title || client?.name || 'sem título'}`,
      quoteId,
      clientId,
      templateId: tpl.id,
      body: fillContract(tpl.body, vars),
      status: 'rascunho',
      createdAt: today(),
    }
    upsert('contracts', c)
    onClose()
    go('contratos', c.id)
  }
  return (
    <Modal
      title="novo contrato"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            cancelar
          </button>
          <button className="btn primary" onClick={create} disabled={!clientId}>
            criar contrato
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label="1. Cliente">
          <select id="nc-client" value={clientId} onChange={(e) => pickClient(e.target.value)}>
            <option value="">escolha o cliente…</option>
            {withQuotes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` · ${c.company}` : ''}
              </option>
            ))}
          </select>
        </Field>
        {clientId && (
          <Field label="2. Orçamento" hint={quotesOf(clientId).length ? 'O número, os serviços, o valor e o prazo vêm dele.' : 'Este cliente ainda não tem orçamento: o contrato sai com os dados dele e o resto [entre colchetes].'}>
            <select value={quoteId} onChange={(e) => pickQuote(e.target.value)}>
              <option value="">sem orçamento</option>
              {quotesOf(clientId).map((x) => (
                <option key={x.id} value={x.id}>
                  {quoteNumber(x)} · {x.title || 'sem título'}
                  {x.status === 'aprovado' ? ' ✓ aprovado' : ` · ${x.status}`}
                </option>
              ))}
            </select>
          </Field>
        )}
        {clientId && (
          <Field label="3. Modelo" hint="Sugerido pelo serviço do orçamento; dá para trocar.">
            <select value={tplId} onChange={(e) => setTplId(e.target.value)}>
              {cs.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {clientId && missing.length > 0 && (
          <p className="pf-note is-warn">
            <Icon name="alert" size={16} />
            <span>
              Falta: <b>{missing.join(', ')}</b>. Dá para completar no texto do contrato, ou no cadastro do{' '}
              <a className="link" href={href('clientes', clientId)} onClick={onClose}>
                cliente
              </a>{' '}
              e no seu{' '}
              <a className="link" href={href('perfil')} onClick={onClose}>
                perfil
              </a>
              .
            </span>
          </p>
        )}
      </div>
    </Modal>
  )
}

function ContractEditor({ id }: { id: string }) {
  const { data, upsert, remove } = useStore()
  const { isOwner } = useAccess()
  const found = data.contracts?.find((c) => c.id === id)
  const [c, setC] = useState<Contract | undefined>(found)
  const [zoom, setZoom] = useState(false)
  const pdf = usePdf()
  if (!c) return <Empty icon="file" title="contrato não encontrado" action={<a className="btn" href={href('contratos')}>ver contratos</a>} />
  const client = data.clients.find((x) => x.id === c.clientId)
  const quote = data.quotes.find((x) => x.id === c.quoteId)
  const cs = contractSettings(data.settings, isOwner)
  const dirty = JSON.stringify(c) !== JSON.stringify(found)
  const set = (patch: Partial<Contract>) => setC({ ...c, ...patch })
  const save = (patch: Partial<Contract> = {}) => {
    const next = { ...c, ...patch }
    setC(next)
    upsert('contracts', next)
    toast('Contrato salvo.')
  }
  const refill = async (templateId = c.templateId) => {
    const tpl = cs.templates.find((t) => t.id === templateId)
    if (!tpl) return
    if (c.body.trim() && !(await ask('Preencher de novo a partir do modelo? O que você editou à mão neste contrato será substituído.', { confirmLabel: 'Preencher de novo' }))) return
    set({ templateId, body: fillContract(tpl.body, contractVars(data.settings, quote, client)) })
  }
  const missing = [...new Set(c.body.match(/\[[^\]\n]{3,40}\]/g) ?? [])]
  const doc = <ContractDoc s={data.settings} body={c.body} clientName={client ? client.name : ''} />
  const file = `Contrato - ${client?.name ?? c.title}.pdf`

  return (
    <div className="page">
      <div className="page-head sticky-head">
        <div className="sticky-title">
          <p className="eyebrow">
            contrato · {fmtDateLong(c.createdAt)} <Badge color={STATUS[c.status].color}>{STATUS[c.status].label}</Badge>
          </p>
          <h1>{c.title}</h1>
        </div>
        <div className="row gap-s wrap">
          <button className="btn primary" disabled={pdf.busy} onClick={() => pdf.download(doc, file)}>
            <Icon name="download" size={16} /> {pdf.busy ? 'gerando…' : 'baixar PDF'}
          </button>
          {client?.phone && (
            <a className="btn ghost" href={whatsappLink(client.phone, `oii, ${client.name.split(' ')[0]}! te encaminhei o contrato do projeto para você ler com calma ☺️ qualquer dúvida é só me chamar`)} target="_blank" rel="noreferrer" onClick={() => c.status === 'rascunho' && save({ status: 'enviado' })}>
              <Icon name="whatsapp" size={16} /> enviar
            </a>
          )}
          <button className="btn ghost" onClick={() => setZoom(true)} title="Ver o contrato em tamanho grande">
            <Icon name="eye" size={16} /> ver maior
          </button>
          <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(c.body).then(() => toast('Texto copiado.')).catch(() => toast('Selecione o texto e copie.'))}>
            <Icon name="copy" size={16} /> copiar texto
          </button>
          <button className={`btn ${dirty ? 'primary' : 'ghost is-saved'}`} disabled={!dirty} onClick={() => save()}>
            {dirty ? 'salvar' : 'salvo'}
          </button>
        </div>
      </div>
      <Disclaimer />
      <div className="pf-contract-layout">
        <div className="stack">
          <Section title="dados">
            <div className="form-grid">
              <Field label="Título" span={2}>
                <input value={c.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field group label="Situação">
                <Segmented<ContractStatus> value={c.status} onChange={(status) => set({ status })} options={(Object.keys(STATUS) as ContractStatus[]).map((k) => ({ value: k, label: STATUS[k].label }))} />
              </Field>
              <Field label="Modelo" span={2}>
                <div className="row gap-s">
                  <select value={c.templateId} onChange={(e) => void refill(e.target.value)}>
                    {cs.templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn ghost small" onClick={() => void refill()} title="Puxa de novo os dados do orçamento e do cliente">
                    preencher de novo
                  </button>
                </div>
              </Field>
              <Field label="Orçamento">
                <div className="muted small pf-field-text">{quote ? `${quoteNumber(quote)} · ${quote.title}` : 'nenhum'}</div>
              </Field>
            </div>
            {missing.length > 0 && (
              <p className="pf-note is-warn">
                <Icon name="alert" size={16} />
                <span>
                  Falta completar: {missing.join(', ')}. Preencha no texto, ou complete o cadastro do{' '}
                  {client ? (
                    <a className="link" href={href('clientes', client.id)}>
                      cliente
                    </a>
                  ) : (
                    'cliente'
                  )}{' '}
                  e o seu{' '}
                  <a className="link" href={href('perfil')}>
                    perfil
                  </a>{' '}
                  e clique em “preencher de novo”.
                </span>
              </p>
            )}
          </Section>
          <Section title="texto do contrato">
            <textarea className="pf-contract-text" rows={24} value={c.body} onChange={(e) => set({ body: e.target.value })} spellCheck lang="pt-BR" />
            <p className="muted small">Linhas em MAIÚSCULAS viram títulos (ex.: CLÁUSULA 1 — DO OBJETO). A assinatura das duas partes entra sozinha no fim.</p>
          </Section>
          <button
            className="btn ghost danger"
            onClick={async () => {
              if (!(await askDelete('este contrato'))) return
              remove('contracts', c.id)
              go('contratos')
            }}
          >
            <Icon name="trash" size={14} /> excluir contrato
          </button>
        </div>
        <aside className="quote-preview">
          <div className="doc-zoomable" onClick={() => setZoom(true)} title="Ver maior">
            <DocScale>{doc}</DocScale>
            <span className="doc-zoom-btn">
              <Icon name="eye" size={14} /> ver maior
            </span>
          </div>
          {zoom && <DocZoom onClose={() => setZoom(false)}>{doc}</DocZoom>}
        </aside>
      </div>
      {pdf.portal}
    </div>
  )
}

function TemplatesEditor() {
  const { data, setSettings } = useStore()
  const { isOwner } = useAccess()
  const cs = contractSettings(data.settings, isOwner)
  const [openId, setOpenId] = useState(cs.templates[0]?.id ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)
  const setTemplates = (templates: ContractTemplate[]) => setSettings({ contracts: { ...cs, templates } })
  const cur = cs.templates.find((t) => t.id === openId)
  const patch = (p: Partial<ContractTemplate>) => cur && setTemplates(cs.templates.map((t) => (t.id === cur.id ? { ...t, ...p } : t)))
  const insert = (v: string) => {
    if (!cur) return
    const el = ref.current
    const at = el?.selectionStart ?? cur.body.length
    const body = cur.body.slice(0, at) + `{${v}}` + cur.body.slice(el?.selectionEnd ?? at)
    patch({ body })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + v.length + 2, at + v.length + 2)
    })
  }
  return (
    <div className="pf-templates">
      <Section
        title="seus modelos"
        action={
          <button
            className="btn small"
            onClick={() => {
              const t = { id: uid(), name: 'novo modelo', body: 'CONTRATO\n\n{contratante} e {contratada} combinam…\n\n{cidade}, {data}.' }
              setTemplates([...cs.templates, t])
              setOpenId(t.id)
            }}
          >
            <Icon name="plus" size={14} /> novo
          </button>
        }
      >
        <div className="pf-list">
          {cs.templates.map((t) => (
            <button key={t.id} className={`pf-row ${t.id === openId ? 'is-active' : ''}`} onClick={() => setOpenId(t.id)}>
              <Icon name="file" size={16} />
              <span className="grow">{t.name}</span>
            </button>
          ))}
        </div>
        <button className="link small" onClick={async () => (await ask('Voltar os modelos para os originais? Os modelos que você criou ou editou serão substituídos.', { confirmLabel: 'Restaurar' })) && setTemplates(defaultTemplates(isOwner))}>
          restaurar modelos originais
        </button>
      </Section>
      {cur && (
        <Section
          title="editar modelo"
          action={
            <div className="row gap-s">
              <button className="btn ghost small" onClick={() => {
                const t = { ...cur, id: uid(), name: `${cur.name} (cópia)` }
                setTemplates([...cs.templates, t])
                setOpenId(t.id)
              }}>
                <Icon name="copy" size={14} /> duplicar
              </button>
              <button
                className="btn ghost small danger"
                disabled={cs.templates.length <= 1}
                onClick={async () => {
                  if (!(await askDelete(`o modelo “${cur.name}”`))) return
                  const rest = cs.templates.filter((t) => t.id !== cur.id)
                  setTemplates(rest)
                  setOpenId(rest[0]?.id ?? '')
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          }
        >
          <Field label="Nome do modelo">
            <input value={cur.name} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <div>
            <span className="field-label">Toque para inserir no texto</span>
            <div className="pf-vars">
              {CONTRACT_VARS.map(([k, d]) => (
                <button key={k} type="button" className="var-chip" title={d} onClick={() => insert(k)}>
                  {`{${k}}`}
                </button>
              ))}
            </div>
          </div>
          <textarea ref={ref} className="pf-contract-text" rows={22} value={cur.body} onChange={(e) => patch({ body: e.target.value })} spellCheck lang="pt-BR" />
          <p className="muted small">As mudanças valem para os próximos contratos. Os que você já criou não mudam.</p>
        </Section>
      )}
    </div>
  )
}
