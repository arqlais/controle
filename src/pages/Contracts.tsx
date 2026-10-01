import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { go, href } from '../router'
import { Icon } from '../components/Icon'
import { Badge, Empty, Field, Modal, MoreMenu, Section, Segmented } from '../components/ui'
import { ask, askDelete, toast } from '../components/dialog'
import { useFormDraft } from '../components/SaveBar'
import { ContractDoc, usesExclusiveContract } from '../components/ContractDoc'
import { DocLookPanel } from '../components/DocKit'
import { DocScale, DocZoom, usePdf } from '../components/Print'
import { CONTRACT_VARS, contractSettings, contractVars, defaultTemplates, fillContract, suggestTemplate } from '../contracts'
import { useAccess } from '../access'
import type { Client, Contract, ContractStatus, ContractTemplate } from '../types'
import { IMPORT_ACCEPT, findFields, importContract, importError, swapAll } from '../contractImport'
import { fillHtml, htmlToText } from '../contractHtml'
import { DocRich, type DocRichHandle } from '../components/DocRich'
import { SIGN_SITES, checkSignMessage, publishSign, type SignPayload } from '../contractSign'
import { SignatureGlyph, SignaturePad, drawingToDataUrl } from '../components/SignaturePad'
import { fmtDateLong, matches, quoteNumber, today, uid, whatsappLink } from '../utils'

/* Contratos: escolhe um orçamento + um modelo → o texto sai preenchido
   (cliente, CPF/CNPJ, serviços, valor, prazo, pagamento…) e pode ser editado à vontade. */

const STATUS: Record<ContractStatus, { label: string; color: string }> = {
  rascunho: { label: 'rascunho', color: '#9aa3ab' },
  enviado: { label: 'enviado', color: '#b08a7e' },
  assinado: { label: 'assinado', color: '#4f6475' },
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

/** Contrato novo a partir do modelo: no modelo da pessoa (Word) sai com o desenho dela; senão, o texto. */
function fromTemplate(tpl: ContractTemplate, vars: Record<string, string>): { body: string; html?: string } {
  if (tpl.html) {
    const html = fillHtml(tpl.html, vars)
    return { body: htmlToText(html), html }
  }
  return { body: fillContract(tpl.body, vars) }
}
const swapHtmlLike = (t: ContractTemplate, _body: string) => t.html ?? ''

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
  const [mineId, setMineId] = useState('')
  const [imported, setImported] = useState(false)
  // usar o próprio contrato: vira um modelo novo (anexado do Word/PDF ou em branco para colar o texto)
  const useMine = (name = 'meu contrato', body = '', html?: string) => {
    // o texto entra no modelo de contrato do traço (sempre funciona, com a marca da pessoa); o desenho do arquivo fica guardado como opção
    const t: ContractTemplate = { id: uid(), name, body, ...(html ? { fileHtml: html } : {}) }
    setSettings({ contracts: { ...cs, templates: [t, ...cs.templates] } })
    setImported(!!body)
    setMineId(t.id)
    setTab('modelos')
  }
  const upload = useContractUpload(useMine)
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
      <div className="ct-mine">
        <Icon name="pen" size={16} />
        <span>
          <b>Quer usar o seu próprio contrato?</b> Anexe o arquivo (Word ou PDF) ou cole o texto: ele vira um modelo seu, editável, que sai preenchido com os dados do cliente e do orçamento. Os exemplos podem ser apagados à vontade.
        </span>
        <div className="ct-mine-actions">
          <button className="btn small primary" disabled={upload.busy} onClick={upload.open}>
            <Icon name="upload" size={14} /> {upload.busy ? 'lendo…' : 'anexar meu contrato'}
          </button>
          <button className="btn small ghost" onClick={() => useMine()}>
            colar o texto
          </button>
        </div>
        {upload.input}
      </div>
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
        <TemplatesEditor key={mineId} startId={mineId} imported={imported} />
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
  const missing = tpl ? [...new Set((fromTemplate(tpl, vars).body.match(/\[[^\]\n]{3,40}\]/g) ?? []).map((x) => x.slice(1, -1)))] : []
  const create = () => {
    if (!tpl) return toast('Crie um modelo primeiro.')
    const c: Contract = {
      id: uid(),
      title: `contrato · ${quote?.title || client?.name || 'sem título'}`,
      quoteId,
      clientId,
      templateId: tpl.id,
      ...fromTemplate(tpl, vars),
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
              {/* separados por tipo de trabalho: cliente final e freelancer / parceiro */}
              {([['cliente final', cs.templates.filter((t) => t.id.startsWith('cf-') || t.id === 'cliente-final-etapas' || /cliente final/i.test(t.name))], ['freelancer · escritório parceiro', cs.templates.filter((t) => !(t.id.startsWith('cf-') || t.id === 'cliente-final-etapas' || /cliente final/i.test(t.name)))]] as const).map(([label, list]) =>
                list.length ? (
                  <optgroup key={label} label={label}>
                    {list.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.id === suggestTemplate(cs.templates, quote)?.id ? ' · sugerido pelo orçamento' : ''}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
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
  // rascunho: fechou a página sem salvar? O texto volta ao abrir o contrato de novo
  const draft = useFormDraft<Contract | undefined>(`contrato:${id}`, found)
  const c = draft.value
  const setC = draft.setValue
  const [zoom, setZoom] = useState(false)
  const pdf = usePdf()
  // assinatura que chegou sozinha (cliente assinou pelo link) com o contrato aberto: entra na tela também
  const arrived = found?.sign && !c?.sign ? found.sign : undefined
  useEffect(() => {
    if (arrived) setC((x) => (x ? { ...x, sign: arrived, status: 'assinado' } : x))
  }, [arrived])
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
    draft.rebase(next)
    toast('Contrato salvo.')
  }
  const refill = async (templateId = c.templateId) => {
    const tpl = cs.templates.find((t) => t.id === templateId)
    if (!tpl) return
    if (c.body.trim() && !(await ask('Preencher de novo a partir do modelo? O que você editou à mão neste contrato será substituído.', { confirmLabel: 'Preencher de novo' }))) return
    set({ templateId, html: undefined, ...fromTemplate(tpl, contractVars(data.settings, quote, client)) })
  }
  const missing = [...new Set(c.body.match(/\[[^\]\n]{3,40}\]/g) ?? [])]
  const doc = <ContractDoc s={data.settings} body={c.body} html={c.html} clientName={client ? client.name : ''} signed={c.sign} />
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
          <MoreMenu>
            <button className="btn ghost" onClick={() => pdf.downloadVector(doc, file)} title="Imprimir em folhas A4 (ou salvar como PDF pela impressão)">
              <Icon name="printer" size={16} /> imprimir
            </button>
            <button className="btn ghost" onClick={() => setZoom(true)} title="Ver o contrato em tamanho grande">
              <Icon name="eye" size={16} /> ver maior
            </button>
            <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(c.body).then(() => toast('Texto copiado.')).catch(() => toast('Selecione o texto e copie.'))}>
              <Icon name="copy" size={16} /> copiar texto
            </button>
          </MoreMenu>
          <button className={`btn head-save ${dirty ? 'primary' : 'ghost is-saved'}`} disabled={!dirty} onClick={() => save()}>
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
                <div className="row gap-s ct-model-row">
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
          <SignSection c={c} client={client} dirty={dirty} save={save} onPdf={() => pdf.download(doc, file)} />
          <DocLookPanel fold />
          <Section title="texto do contrato">
            {c.html ? (
              <>
                <DocRich html={c.html} onChange={(html) => set({ html, body: htmlToText(html) })} />
                <p className="muted small">No seu modelo: edite direto na folha. A assinatura das duas partes entra sozinha no fim.</p>
              </>
            ) : (
              <>
                <textarea className="pf-contract-text" rows={24} value={c.body} onChange={(e) => set({ body: e.target.value })} spellCheck lang="pt-BR" />
                <p className="muted small">Linhas em MAIÚSCULAS viram títulos (ex.: CLÁUSULA 1 — DO OBJETO). A assinatura das duas partes entra sozinha no fim.</p>
              </>
            )}
          </Section>
          <button
            className="btn ghost danger"
            onClick={async () => {
              if (!(await askDelete('este contrato'))) return
              draft.clear()
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

/** Anexar o contrato (Word, PDF ou texto): lê o arquivo e entrega o texto. */
function useContractUpload(onText: (name: string, body: string, html?: string) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const input = (
    <input
      ref={ref}
      type="file"
      hidden
      accept={IMPORT_ACCEPT}
      onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setBusy(true)
        try {
          const { body, html } = await importContract(f)
          onText(f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'meu contrato', body, html)
          toast('Contrato anexado: o seu texto já está no modelo de contrato, com a sua marca. Confira e troque os dados fixos pelas etiquetas.')
        } catch (err) {
          toast(importError(err))
        } finally {
          setBusy(false)
        }
      }}
    />
  )
  return { input, busy, open: () => ref.current?.click() }
}

/** Troca o que é fixo do contrato original (nome, CPF, valor, data…) pelas etiquetas que se preenchem sozinhas. */
function FieldSwap({ body, onChange, onSwap, open }: { body: string; onChange: (b: string) => void; onSwap?: (text: string, tag: string) => void; open?: boolean }) {
  const hints = useMemo(() => findFields(body), [body])
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [text, setText] = useState('')
  const [tag, setTag] = useState('contratante')
  const tagSelect = (value: string, set: (v: string) => void) => (
    <select value={value} onChange={(e) => set(e.target.value)} aria-label="Etiqueta">
      {CONTRACT_VARS.map(([k, d]) => (
        <option key={k} value={k} title={`{${k}}`}>
          {d}
        </option>
      ))}
    </select>
  )
  const swap = (t: string, k: string) => {
    if (!t.trim() || !body.includes(t)) return toast('Esse texto não está no contrato.')
    const n = body.split(t).length - 1
    if (onSwap) onSwap(t, k)
    else onChange(swapAll(body, t, k))
    toast(`${n === 1 ? '1 trecho trocado' : `${n} trechos trocados`} por {${k}}.`)
  }
  return (
    <details className="ct-swap" open={open}>
      <summary>
        <Icon name="sparkle" size={15} /> trocar dados fixos por etiquetas
      </summary>
      <p className="muted small">O que muda de um cliente para outro (nome, CPF, valor, data…) vira etiqueta: cada contrato novo já sai preenchido com os dados do cliente e do orçamento.</p>
      {hints.length > 0 && (
        <ul className="ct-swap-list">
          {hints.map((h) => (
            <li key={h.text}>
              <span className="ct-swap-text">
                <b>{h.text}</b>
                <small>{h.label}</small>
              </span>
              {tagSelect(picked[h.text] ?? h.tag, (v) => setPicked((p) => ({ ...p, [h.text]: v })))}
              <button className="btn small" onClick={() => swap(h.text, picked[h.text] ?? h.tag)}>
                trocar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="ct-swap-manual">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="outro texto, ex.: Maria da Silva" aria-label="Texto para trocar" />
        {tagSelect(tag, setTag)}
        <button className="btn small primary" onClick={() => (swap(text, tag), setText(''))}>
          trocar
        </button>
      </div>
    </details>
  )
}

function TemplatesEditor({ startId, imported }: { startId?: string; imported?: boolean }) {
  const { data, setSettings } = useStore()
  const { isOwner } = useAccess()
  const cs = contractSettings(data.settings, isOwner)
  const [openId, setOpenId] = useState(startId || (cs.templates[0]?.id ?? ''))
  const ref = useRef<HTMLTextAreaElement>(null)
  const setTemplates = (templates: ContractTemplate[]) => setSettings({ contracts: { ...cs, templates } })
  const cur = cs.templates.find((t) => t.id === openId)
  const patch = (p: Partial<ContractTemplate>) => cur && setTemplates(cs.templates.map((t) => (t.id === cur.id ? { ...t, ...p } : t)))
  const [fresh, setFresh] = useState(imported ? startId ?? '' : '')
  const upload = useContractUpload((name, body, html) => {
    const t: ContractTemplate = { id: uid(), name, body, ...(html ? { html } : {}) }
    setTemplates([t, ...cs.templates])
    setOpenId(t.id)
    setFresh(t.id)
  })
  const rich = useRef<DocRichHandle>(null)
  const [preview, setPreview] = useState(false)
  const insert = (v: string) => {
    if (!cur) return
    if (cur.html) return rich.current?.insert(`{${v}}`)
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
    <div className="ct-templates">
      <div className="ct-side">
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
        <button className="btn small ghost ct-attach" disabled={upload.busy} onClick={upload.open}>
          <Icon name="upload" size={14} /> {upload.busy ? 'lendo o arquivo…' : 'anexar meu contrato (Word ou PDF)'}
        </button>
        {upload.input}
        <div className="pf-list">
          {cs.templates.map((t) => (
            <button key={t.id} className={`pf-row ${t.id === openId ? 'is-active' : ''}`} onClick={() => setOpenId(t.id)}>
              <Icon name="file" size={16} />
              <span className="grow">{t.name}</span>
            </button>
          ))}
        </div>
        <button className="link small" onClick={async () => (await ask('Voltar os modelos para os originais? Os modelos que você criou ou editou serão substituídos.', { confirmLabel: 'Restaurar' })) && setSettings({ contracts: { ...cs, templates: defaultTemplates(isOwner), hidden: [] } })}>
          restaurar modelos originais
        </button>
      </Section>
      <SignatureField />
      </div>
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
                  setSettings({ contracts: { ...cs, templates: rest, hidden: [...(cs.hidden ?? []), cur.id] } })
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
          {cur.id === fresh && (
            <p className="pf-note">
              <Icon name="check" size={16} />
              <span>Texto do seu arquivo. Confira, ajuste o que quiser e troque os dados fixos pelas etiquetas abaixo. As linhas de assinatura saíram: o quadro de assinatura das duas partes entra sozinho no fim.</span>
            </p>
          )}
          {cur.body.trim().length > 40 && <FieldSwap key={cur.id} body={cur.body} onChange={(body) => patch(cur.html ? { body: htmlToText(swapHtmlLike(cur, body)), html: swapHtmlLike(cur, body) } : { body })} onSwap={cur.html ? (t, k) => patch({ html: swapAll(cur.html!, t, k), body: htmlToText(swapAll(cur.html!, t, k)) }) : undefined} open={cur.id === fresh} />}
          {cur.html ? (
            <>
              <DocRich key={cur.id} ref={rich} html={cur.html} onChange={(html) => patch({ html, body: htmlToText(html) })} />
              <div className="row gap-s">
                <button type="button" className="btn small ghost" onClick={() => setPreview(true)}>
                  <Icon name="eye" size={14} /> ver como fica
                </button>
                <button type="button" className="link small muted-link" onClick={async () => (await ask('Usar só o texto, sem o desenho do seu arquivo? O contrato passa a sair no modelo do traço.', { confirmLabel: 'Usar só o texto' })) && patch({ html: undefined })}>
                  usar só o texto (sem o desenho do arquivo)
                </button>
              </div>
              {preview && (
                <DocZoom onClose={() => setPreview(false)}>
                  <ContractDoc s={data.settings} body={cur.body} html={cur.html} clientName="{contratante}" />
                </DocZoom>
              )}
            </>
          ) : (
          <>
          {cur.fileHtml && (
            <p className="pf-note">
              <Icon name="file" size={16} />
              <span>
                O texto do seu arquivo está no modelo de contrato do traço, com a sua marca. Quer tentar o desenho original?{' '}
                <button type="button" className="link" onClick={() => patch({ html: cur.fileHtml })}>
                  usar o desenho do arquivo
                </button>{' '}
                <small className="muted">(funciona bem em Word simples; fundos, ícones e formas não vêm)</small>
              </span>
            </p>
          )}
          <textarea ref={ref} className="pf-contract-text" rows={22} value={cur.body} onChange={(e) => patch({ body: e.target.value })} spellCheck lang="pt-BR" autoFocus={cur.id === startId} placeholder={'Cole aqui o texto do seu contrato (do Word, PDF ou Google Docs).\n\nDepois troque o nome do cliente por {contratante}, o valor por {valor}, a data por {data}… tocando nas etiquetas acima: cada contrato novo já sai preenchido.'} />
          {cur.body.trim().length > 40 && (
            <button type="button" className="btn small ghost ct-see" onClick={() => setPreview(true)}>
              <Icon name="eye" size={14} /> ver como fica
            </button>
          )}
          {preview && (
            <DocZoom onClose={() => setPreview(false)}>
              <ContractDoc s={data.settings} body={cur.body} clientName="{contratante}" />
            </DocZoom>
          )}
          </>
          )}
          <p className="muted small">As mudanças valem para os próximos contratos. Os que você já criou não mudam.</p>
        </Section>
      )}
    </div>
  )
}

/** Assinatura (imagem) que vai no quadro do contrato. PNG com fundo transparente fica melhor. */
function SignatureField() {
  const { data, setSettings } = useStore()
  const sig = data.settings.signature
  const [drawing, setDrawing] = useState<string | null>(null)
  const pick = (f?: File) => {
    if (!f) return
    if (f.size > 1_500_000) return toast('Imagem muito grande: use uma de até 1,5 MB.')
    const r = new FileReader()
    r.onload = () => {
      setSettings({ signature: String(r.result) })
      toast('Assinatura salva. Ela aparece no quadro de assinatura dos contratos.')
    }
    r.readAsDataURL(f)
  }
  return (
    <Section title="sua assinatura">
      <p className="muted small">Desenhe a sua assinatura aqui (com o dedo ou o mouse) ou envie uma imagem (de preferência PNG com fundo transparente). Ela entra sozinha no quadro de assinatura de todos os contratos. Sem imagem, vai o seu nome.</p>
      {drawing !== null ? (
        <div className="stack-s">
          <SignaturePad value={drawing} onChange={setDrawing} label="desenhe a sua assinatura" />
          <div className="row gap-s">
            <button className="btn small primary" disabled={drawing.length < 30} onClick={() => (setSettings({ signature: drawingToDataUrl(drawing) }), setDrawing(null), toast('Assinatura salva.'))}>
              salvar assinatura
            </button>
            <button className="btn small ghost" onClick={() => setDrawing(null)}>
              cancelar
            </button>
          </div>
        </div>
      ) : null}
      <div className="row gap-s wrap">
        {sig && <img className="pf-sig-preview" src={sig} alt="Sua assinatura" />}
        {drawing === null && (
          <button className="btn small ghost" onClick={() => setDrawing('')}>
            <Icon name="pen" size={14} /> desenhar
          </button>
        )}
        <label className="btn small ghost">
          <Icon name="upload" size={14} /> {sig ? 'trocar imagem' : 'enviar imagem'}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {sig && (
          <button className="link small" onClick={() => setSettings({ signature: '' })}>
            tirar assinatura
          </button>
        )}
      </div>
    </Section>
  )
}

/* Assinatura: pelo link do traço (rápido, o cliente assina no celular) ou por um site com validade reforçada. */
function SignSection({ c, client, dirty, save, onPdf }: { c: Contract; client?: Client; dirty: boolean; save: (patch?: Partial<Contract>) => void; onPdf: () => void }) {
  const { data, userId } = useStore()
  const { has } = useAccess()
  const [busy, setBusy] = useState(false)
  const [paste, setPaste] = useState('')
  const [ext, setExt] = useState<{ site: string; name: string; at: string } | null>(null)
  const st = data.settings
  const first = client?.name.split(' ')[0] ?? ''

  const makeLink = async () => {
    if (dirty) save()
    setBusy(true)
    try {
      const token = c.signToken ?? crypto.randomUUID()
      const payload: SignPayload = {
        token,
        title: c.title,
        body: c.body,
        ...(c.html ? { html: c.html } : {}),
        clientName: client?.name ?? '',
        studio: st.brandName || st.ownerName,
        owner: st.ownerName,
        phone: st.phone,
        accent: st.accent,
        logo: st.logo || undefined,
        s: { proposal: st.proposal, legalName: st.legalName, ownerName: st.ownerName, brandName: st.brandName, email: st.email, phone: st.phone, instagram: st.instagram, logo: st.logo, signature: st.signature, customFont: st.customFont },
        exclusive: usesExclusiveContract(has, c.body),
      }
      const link = await publishSign(payload, userId)
      save({ signToken: token, signLink: link, status: c.status === 'rascunho' ? 'enviado' : c.status })
      await navigator.clipboard?.writeText(link).catch(() => undefined)
      toast('Link de assinatura criado e copiado.')
    } catch {
      toast('Não deu para criar o link agora. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }
  const confirm = async () => {
    const r = await checkSignMessage(paste, c.signToken, c.body)
    if (r.error) return toast(r.error)
    save({ sign: r.sign, status: 'assinado' })
    setPaste('')
    toast(`Assinado por ${r.sign!.name}.`)
  }

  if (c.sign)
    return (
      <Section title="assinatura">
        <div className="sg-done">
          <span className="sg-done-icon">
            <Icon name="check" size={18} />
          </span>
          <div className="grow">
            <b>
              assinado por {c.sign.name}
              {c.sign.doc ? ` · ${c.sign.doc}` : ''}
            </b>
            <p className="muted small">
              {new Date(c.sign.at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })} · {c.sign.via === 'link' ? `pelo link do traço · código ${c.sign.hash}` : `pelo ${c.sign.site}`}
            </p>
          </div>
          <button
            className="btn ghost small"
            onClick={async () => {
              if (await ask('Tirar a assinatura deste contrato? Use se registrou por engano.', { confirmLabel: 'Tirar' })) save({ sign: undefined, status: 'enviado' })
            }}
          >
            desfazer
          </button>
        </div>
        {c.sign.via === 'link' && (
          <>
            <div className="sg-evidence">
              <SignatureGlyph sign={c.sign} />
              <dl>
                <dt>forma</dt>
                <dd>{c.sign.method === 'desenho' ? 'desenhou a assinatura na tela' : 'nome digitado'}</dd>
                {c.sign.contact && (
                  <>
                    <dt>contato</dt>
                    <dd>{c.sign.contact}</dd>
                  </>
                )}
                {c.sign.device && (
                  <>
                    <dt>aparelho</dt>
                    <dd>{c.sign.device}</dd>
                  </>
                )}
                <dt>localização</dt>
                <dd>{c.sign.geo || 'não informada'}</dd>
              </dl>
            </div>
            <p className="muted small">A assinatura entra no PDF embaixo do nome do cliente, e a última página traz o certificado com todos os dados e a impressão digital do texto. Se o texto for mudado, ela deixa de valer para a nova versão.</p>
            <button className="btn small" onClick={onPdf}>
              <Icon name="download" size={14} /> baixar PDF assinado com certificado
            </button>
          </>
        )}
      </Section>
    )

  return (
    <Section title="assinatura">
      <div className="sg-ways">
        <div className="sg-way">
          <div className="sg-way-head">
            <span className="sg-way-icon">
              <Icon name="link" size={16} />
            </span>
            <div>
              <b>pelo link do traço</b>
              <small>rápido · o cliente assina no celular</small>
            </div>
          </div>
          <p className="muted small">O cliente lê o contrato, informa nome, CPF e contato e assina desenhando com o dedo ou com o nome digitado. A confirmação volta pelo WhatsApp dele, com um código ligado ao texto, e o PDF ganha um certificado de assinatura.</p>
          {c.signLink ? (
            <>
              <div className="sg-link">
                <input readOnly value={c.signLink} onFocus={(e) => e.target.select()} aria-label="Link de assinatura" />
                <button className="btn ghost small" onClick={() => navigator.clipboard?.writeText(c.signLink!).then(() => toast('Link copiado.'))}>
                  <Icon name="copy" size={14} />
                </button>
              </div>
              <div className="row gap-s wrap">
                {client?.phone && (
                  <a className="btn small" href={whatsappLink(client.phone, `oii, ${first}! segue o contrato do projeto para você ler e assinar pelo celular. no fim da página é só colocar seu nome e CPF: ${c.signLink}`)} target="_blank" rel="noreferrer">
                    <Icon name="whatsapp" size={14} /> mandar para {first || 'o cliente'}
                  </a>
                )}
                <button className="btn ghost small" disabled={busy} onClick={() => void makeLink()} title="Atualiza o link com o texto atual do contrato">
                  atualizar link
                </button>
              </div>
              <label className="sg-paste">
                <span className="small">O cliente assinou? Cole aqui a mensagem que ele mandou{client?.phone ? ` (confira se veio do WhatsApp dele: ${client.phone})` : ''}:</span>
                <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Oi! Li e assinei o contrato… código da assinatura: z…" />
              </label>
              <button className="btn primary small" disabled={!paste.trim()} onClick={() => void confirm()}>
                registrar assinatura
              </button>
            </>
          ) : (
            <button className="btn primary small" disabled={busy} onClick={() => void makeLink()}>
              <Icon name="link" size={14} /> {busy ? 'criando…' : 'criar link de assinatura'}
            </button>
          )}
          <p className="sg-law muted">Assinatura eletrônica simples (Lei 14.063/2020 e MP 2.200-2/2001, art. 10, § 2º): vale entre as partes que a aceitam. Registra nome, CPF, contato, data, hora, aparelho, localização (se permitida) e a impressão digital do texto.</p>
        </div>

        <div className="sg-way">
          <div className="sg-way-head">
            <span className="sg-way-icon">
              <Icon name="lock" size={16} />
            </span>
            <div>
              <b>por um site de assinatura</b>
              <small>validade reforçada · selfie, documento ou gov.br</small>
            </div>
          </div>
          <ol className="sg-steps small">
            <li>
              <button className="link" onClick={onPdf}>
                baixe o PDF
              </button>{' '}
              do contrato;
            </li>
            <li>envie no site escolhido e mande para o cliente assinar;</li>
            <li>quando voltar assinado, registre aqui.</li>
          </ol>
          <div className="sg-sites">
            {SIGN_SITES.map((x) => (
              <a key={x.id} className="sg-site" href={x.url} target="_blank" rel="noreferrer" title={x.text}>
                <b>{x.name}</b>
                {x.free && <em>grátis</em>}
                <small>{x.text}</small>
              </a>
            ))}
          </div>
          {ext ? (
            <div className="sg-ext form-grid">
              <Field label="Site">
                <select value={ext.site} onChange={(e) => setExt({ ...ext, site: e.target.value })}>
                  {SIGN_SITES.map((x) => (
                    <option key={x.id}>{x.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Assinado em">
                <input type="date" value={ext.at} onChange={(e) => setExt({ ...ext, at: e.target.value })} />
              </Field>
              <Field label="Quem assinou" span={2}>
                <input value={ext.name} onChange={(e) => setExt({ ...ext, name: e.target.value })} />
              </Field>
              <div className="row gap-s">
                <button className="btn primary small" disabled={!ext.name.trim()} onClick={() => (save({ sign: { via: 'externo', site: ext.site, name: ext.name.trim(), at: new Date(`${ext.at}T12:00:00`).toISOString() }, status: 'assinado' }), setExt(null))}>
                  registrar
                </button>
                <button className="btn ghost small" onClick={() => setExt(null)}>
                  cancelar
                </button>
              </div>
            </div>
          ) : (
            <button className="btn ghost small" onClick={() => setExt({ site: SIGN_SITES[0].name, name: client?.name ?? '', at: today() })}>
              <Icon name="check" size={14} /> já foi assinado no site
            </button>
          )}
        </div>
      </div>
    </Section>
  )
}
