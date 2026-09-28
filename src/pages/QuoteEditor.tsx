import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DateInput } from '../components/DateInput'
import { GENERAL_NOTE_HINTS, useStore } from '../store'
import { duplicateQuote } from '../quoteActions'
import { renumberPlan } from '../numbering'
import { go, href, setLeaveGuard } from '../router'
import { Icon } from '../components/Icon'
import { ClientForm } from '../components/forms'
import { QuoteDoc } from '../components/Docs'
import { DocZoom, DocScale, usePdf } from '../components/Print'
import { Badge, Empty, Field, Modal, MoneyInput, MoreMenu, Section, Segmented } from '../components/ui'
import { askChoice, askDelete, toast } from '../components/dialog'
import { MessagesButton } from '../components/Messages'
import type { Complexity, Quote, QuoteItem, QuoteOption, QuoteStatus, ServiceDef, Settings } from '../types'
import { CloseDeal } from '../components/quick'
import { AskAIButton } from '../components/AskAI'
import {
  BOTH,
  optionArea,
  MAX_OPTIONS,
  allLabel,
  comboSeparate,
  comboTotal,
  isCombo,
  canOpenFile,
  alreadyOpen,
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
  fmtDate,
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
  templateText,
} from '../utils'

const newItem = (): QuoteItem => ({ id: uid(), service: '', title: '', detail: '', description: '', quantity: 1, complexity: 'media', price: 0, auto: true })
/** Rascunho: recalcula os serviços que seguem a tabela (a tabela pode ter mudado desde que o orçamento foi montado). */
function freshPrices(q: Quote, st: Settings, student: boolean): Quote {
  if (q.status !== 'rascunho') return q
  let changed = false
  const again = (items: QuoteItem[], floors: number) =>
    items.map((it) => {
      const sv = st.services.find((x) => x.id === it.service)
      if (!it.auto || it.joined || !sv || sv.pricing === 'livre') return it
      const price = Math.round(Math.max(0, suggestPrice(sv, it.quantity, it.complexity, student, st, it.description.split('\n'), !!q.openFile, floors) - (it.unitDiscount ?? 0) * it.quantity) * 100) / 100
      if (Math.abs(price - it.price) < 0.01) return it
      changed = true
      return { ...it, price }
    })
  const items = again(q.items, q.floors ?? 1)
  const options = q.options.map((o) => ({ ...o, items: again(o.items, o.floors ?? q.floors ?? 1) }))
  // ainda não foi enviado: a data acompanha o dia de hoje (a não ser que ela tenha escolhido uma data)
  const dated = !q.dateFixed && q.createdAt !== today()
  return changed || dated ? { ...q, items, options, ...(dated ? { createdAt: today() } : {}) } : q
}

const newOption = (): QuoteOption => ({ id: uid(), name: '', items: [newItem()], note: '', discount: 0, discountNote: '', deadlineDays: 10 })

export default function QuoteEditor({ id }: { id: string }) {
  const { data, upsert, remove } = useStore()
  const { settings } = data
  const found = data.quotes.find((q) => q.id === id)
  // rascunho: serviços que seguem a tabela abrem com o valor atual da tabela (enviados ficam como foram mandados)
  const [fresh] = useState(() => (found ? freshPrices(found, data.settings, isStudent(data.clients.find((c) => c.id === found.clientId))) : undefined))
  const existing = fresh ?? found
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
  // valores atualizados pela tabela já ficam salvos (a lista mostra o total certo)
  useEffect(() => {
    if (fresh && fresh !== found) upsert('quotes', fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [view, setView] = useState<'editar' | 'ver'>('editar')
  const [zoom, setZoom] = useState(false)
  const pdf = usePdf()

  // ---- não perder o que foi digitado ----
  const [touched, setTouched] = useState(false)
  const unsaved = dirty && touched
  const saveRef = useRef<() => Quote | null>(() => null)
  const draftKey = `orcamento-em-edicao:${id}`
  // cópia de segurança no aparelho enquanto edita (fechou/travou/recarregou: dá para recuperar)
  const [recover, setRecover] = useState<{ q: Quote; at: string } | null>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || 'null') as { q: Quote; at: string } | null
      return d && JSON.stringify(d.q) !== JSON.stringify(existing) ? d : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    try {
      if (unsaved) localStorage.setItem(draftKey, JSON.stringify({ q, at: new Date().toISOString() }))
      else if (!recover) localStorage.removeItem(draftKey)
    } catch {
      /* sem armazenamento: segue sem a cópia */
    }
  }, [q, unsaved, draftKey, recover])
  // recarregar / fechar a aba com alterações: o navegador pergunta antes
  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    // sair pelo menu, por um link ou pela setinha sem salvar: pergunta
    const confirmLeave = async () => {
      const choice = await askChoice('Este orçamento tem alterações que não foram salvas.', { confirmLabel: 'Salvar e sair', altLabel: 'Sair sem salvar' })
      if (choice === 'cancel') return false
      if (choice === 'confirm' && !saveRef.current()) return false // sem cliente: fica para completar
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* ok */
      }
      setTouched(false)
      return true
    }
    const leave = async (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href^="#"]') as HTMLAnchorElement | null
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
      e.preventDefault()
      e.stopPropagation()
      if (!(await confirmLeave())) return
      const r = a.getAttribute('href')!.replace(/^#\/?/, '').split('/')
      go(r[0] || 'inicio', r[1])
    }
    document.addEventListener('click', leave, true)
    setLeaveGuard(confirmLeave)
    return () => {
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', leave, true)
      setLeaveGuard(null)
    }
  }, [unsaved, draftKey])

  if (id !== 'novo' && !existing) return <Empty title="Orçamento não encontrado" action={<a className="btn" href={href('orcamentos')}>Voltar</a>} />

  const client = data.clients.find((c) => c.id === q.clientId)
  const student = isStudent(client)
  const two = q.mode === 'opcoes'
  const displayName = client?.name || 'cliente'

  const set = (patch: Partial<Quote>) => {
    setQ((x) => ({ ...x, ...patch }))
    setDirty(true)
    setTouched(true)
  }
  const oa = (o: QuoteOption) => optionArea(q, o)
  const setOption = (oid: string, patch: Partial<QuoteOption>) => set({ options: q.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) })

  const sub = quoteSubtotal(q)
  const total = quoteTotal(q, settings.urgencyFee)

  // arquivo aberto / pavimentos: recalcula os serviços que seguem a tabela
  const floors = Math.max(1, q.floors ?? 1)
  const reprice = (patch: { openFile?: boolean; floors?: number }) => {
    const openFile = patch.openFile ?? !!q.openFile
    const fl = patch.floors ?? floors
    // valores digitados à mão: a taxa de arquivo aberto entra (ou sai) uma vez só
    const fee = 1 + (settings.openFileFee ?? 30) / 100
    const manual = (items: QuoteItem[]) =>
      patch.openFile === undefined
        ? items
        : items.map((it) => {
            const sv = settings.services.find((x) => x.id === it.service)
            if ((it.auto && sv && sv.pricing !== 'livre') || it.joined || alreadyOpen(sv) || !it.price) return it
            if (openFile && !it.openFee) return { ...it, price: Math.round(it.price * fee * 100) / 100, openFee: true }
            if (!openFile && it.openFee) return { ...it, price: Math.round((it.price / fee) * 100) / 100, openFee: undefined }
            return it
          })
    // descontos em R$ acompanham a taxa: o total final sobe na mesma proporção (cada opção separada; nas propostas + juntas, o desconto de fechar juntas também)
    const toggled = patch.openFile !== undefined && patch.openFile !== !!q.openFile
    const k = !toggled ? 1 : openFile ? fee : 1 / fee
    const scale = (n?: number) => (n && k !== 1 ? Math.round(n * k * 100) / 100 : n)
    set({
      ...patch,
      items: manual(repriceItems(q.items, openFile, fl)),
      discount: scale(q.discount) ?? 0,
      comboDiscount: scale(q.comboDiscount),
      // cada quadro usa os próprios pavimentos (se tiver)
      options: q.options.map((o) => ({ ...o, discount: scale(o.discount) ?? 0, items: manual(repriceItems(o.items, openFile, o.floors ?? fl)) })),
    })
  }
  const repriceItems = (items: QuoteItem[], openFile: boolean, fl: number, area?: { from: number; to: number }) =>
    items.map((it) => {
      const sv = settings.services.find((x) => x.id === it.service)
      if (!sv) return it
      // área nova: serviços por m² que estavam com a área antiga (ou sem área) acompanham
      const follow = area && sv.pricing === 'm2' && area.to > 0 && (it.quantity === area.from || !it.quantity || (!area.from && it.quantity === 50))
      const quantity = follow ? area.to : it.quantity
      if (!it.auto || it.joined || sv.pricing === 'livre') return follow ? { ...it, quantity } : it
      const price = Math.max(0, suggestPrice(sv, quantity, it.complexity, student, settings, it.description.split('\n'), openFile, fl) - (it.unitDiscount ?? 0) * quantity)
      return { ...it, quantity, price }
    })
  const syncArea = (items: QuoteItem[], from: number, to: number, openFile: boolean, fl: number) => repriceItems(items, openFile, fl, { from, to })
  const setOpenFile = (openFile: boolean) => reprice({ openFile })
  const save = (patch: Partial<Quote> = {}) => {
    const next = { ...q, ...patch }
    if (next.status !== 'rascunho' && !next.sentAt) next.sentAt = today()
    if (!next.clientId) {
      toast('Escolha o cliente.')
      return null
    }
    if (!next.number) {
      // nº 0: escolhe pela data — enviado sem PDF ocupa o número vago; rascunhos se reorganizam em ordem de data
      const others = data.quotes.filter((x) => x.id !== next.id)
      const plan = renumberPlan([...others.map((x) => (x.status !== 'rascunho' ? { ...x, pdf: true } : x)), { ...next, pdf: next.status === 'rascunho' ? next.pdf : false }])
      const to = new Map(plan.map((r) => [r.id, r.to]))
      next.number = to.get(next.id) ?? nextQuoteNumber(data)
      for (const x of others) if (x.status === 'rascunho' && to.has(x.id) && to.get(x.id) !== x.number) upsert('quotes', { ...x, number: to.get(x.id)! })
      toast(`Número definido pela data: ${quoteNumber(next)}.`)
    }
    upsert('quotes', next)
    setQ(next)
    setDirty(false)
    setTouched(false)
    try {
      localStorage.removeItem(draftKey)
    } catch {
      /* ok */
    }
    if (id === 'novo') go('orcamentos', next.id)
    return next
  }

  saveRef.current = () => save()
  const duplicate = () => {
    if (unsaved && q.clientId) save() // guarda o que foi mexido neste antes de copiar
    const copy = duplicateQuote(q, data)
    upsert('quotes', copy)
    setTouched(false)
    go('orcamentos', copy.id)
    toast(`Duplicado como ${quoteNumber(copy)} · ${fmtDateLong(copy.createdAt)} (rascunho).`)
  }

  const line = (i: QuoteItem) => `• ${i.title || 'serviço'}${cleanDetail(i.detail) ? ` · ${cleanDetail(i.detail)}` : ''} — ${money(i.price)}`
  // enviar: com PDF vai a mensagem curta dela; copiar resumo: sempre o resumo com os valores
  const text = (short = true) => {
    // com PDF: a mensagem curta dela ("te encaminhei o pdf com a proposta…"), editável em configurações → mensagens
    if (q.pdf && short) return templateText(settings, 'envio-orcamento', 'oii, {cliente}! te encaminhei o pdf com a proposta, é negociável ☺️ fico à disposição caso queira ajustar ou conversar sobre', client, undefined, q)
    const first = client?.name.split(' ')[0] ?? ''
    const head = [`*proposta ${quoteNumber(q)}${q.title ? ` — ${q.title}` : ''}*`, `oii${first ? `, ${first}` : ''}! segue o orçamento ✨`, '']
    const body = two
      ? [
          ...q.options.slice(0, MAX_OPTIONS).flatMap((o, i) => [`*${q.combo ? 'proposta' : 'opção'} ${i + 1}${o.name ? ` · ${o.name}` : ''}*`, ...o.items.map(line), `total: ${money(optionTotal(o))}`, '']),
          ...(isCombo(q) && q.comboDiscount ? [`*fechando ${allLabel(q).toLowerCase()} juntas: ${money(comboTotal(q))}* (em vez de ${money(comboSeparate(q))})`, ''] : []),
        ]
      : [...q.items.map(line), q.urgency ? `• taxa de urgência (${settings.urgencyFee}%) — ${money((sub * settings.urgencyFee) / 100)}` : '', q.discount ? `• desconto — −${money(q.discount)}` : '', '', `*investimento total: ${money(total)}*`]
    return [...head, ...body, q.paymentTerms ? `pagamento: ${q.paymentTerms}` : '', q.schedule ? `prazos: ${q.schedule}` : '', '', 'é negociável ☺️ fico à disposição caso queira ajustar ou conversar sobre']
      .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
      .join('\n')
  }

  const approve = () => {
    if (two && !q.chosenOption) return toast(q.combo ? `Marque o que o cliente fechou: uma proposta ou ${allLabel(q)}.` : 'Marque qual opção o cliente escolheu.')
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
      {recover && (
        <div className="recover-note">
          <Icon name="alert" size={16} />
          <span className="grow">
            Há alterações deste orçamento que não foram salvas ({new Date(recover.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}).
          </span>
          <button
            className="btn small primary"
            onClick={() => {
              setQ(recover.q)
              setDirty(true)
              setTouched(true)
              setRecover(null)
              toast('Alterações recuperadas. Lembre de salvar.')
            }}
          >
            recuperar
          </button>
          <button
            className="link small muted-link"
            onClick={() => {
              try {
                localStorage.removeItem(draftKey)
              } catch {
                /* ok */
              }
              setRecover(null)
            }}
          >
            descartar
          </button>
        </div>
      )}
      <div className="page-head sticky-head">
        <div className="sticky-title">
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
          <MoreMenu>
            {q.pdf && (
              <button className="btn ghost" disabled={pdf.busy} onClick={() => pdf.downloadImage(preview, `Proposta ${quoteNumber(q)} - ${displayName}.pdf`)} title="Baixa direto, sem a janela de impressão (o texto vira imagem)">
                <Icon name="download" size={16} /> PDF em imagem
              </button>
            )}
            <MessagesButton client={client} quote={q} project={data.projects.find((p) => p.id === q.projectId)} />
            <button
              className="btn ghost"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(text(false))
                  .then(() => toast('Resumo copiado.'))
                  .catch(() => toast('Não deu para copiar aqui.'))
              }
            >
              <Icon name="copy" size={16} /> copiar resumo
            </button>
            {existing && id !== 'novo' && (
              <button className="btn ghost" onClick={duplicate} title="Cópia com a data de hoje e o próximo número">
                <Icon name="copy" size={16} /> duplicar
              </button>
            )}
            <AskAIButton quote={q} />
          </MoreMenu>
          <button className={`btn ${dirty ? 'primary' : 'ghost'}`} onClick={() => save()} disabled={!dirty}>
            {dirty ? 'salvar' : 'salvo'}
          </button>
        </div>
        {existing && (
          <div className="head-status">
            <Segmented<QuoteStatus>
              value={q.status}
              onChange={(st) => save({ status: st })}
              options={(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((k) => ({ value: k, label: QUOTE_STATUS[k].label }))}
            />
            <button className="btn small primary" onClick={approve}>
              <Icon name="check" size={14} /> {q.projectId ? 'abrir demanda' : 'aprovado → criar demanda'}
            </button>
          </div>
        )}
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
                    ? `⚠ já existe outro orçamento ${quoteNumber(q)} · coloque 0 para o sistema escolher pela data`
                    : !q.number
                      ? '0 = ao salvar, o sistema escolhe o nº pela data (rascunhos se reorganizam; enviados não mudam).'
                    : q.status === 'rascunho' && !q.dateFixed
                      ? 'Rascunho: a data vai para o dia de hoje sempre que você abrir. Escolhendo outra data, ela fica.'
                    : q.createdAt === today()
                      ? 'Orçamento antigo? coloque o nº e a data reais.'
                      : 'Vão no PDF e na lista.'
                }
              >
                <div className="num-date">
                  <input
                    id="q-number"
                    type="number"
                    min={0}
                    value={q.number || 0}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => set({ number: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    aria-label="Número do orçamento"
                    title="Número do orçamento (0 = o sistema escolhe pela data)"
                  />
                  <DateInput
                    id="q-date"
                   
                    value={q.createdAt}
                    max={today()}
                    onChange={(e) => {
                      const d = e.target.value || today()
                      // orçamento antigo: o "enviado em" acompanha a data, para não aparecer como "aguardando há 0 dias"
                      set({ createdAt: d, dateFixed: d !== today() || undefined, sentAt: q.status !== 'rascunho' && (!q.sentAt || q.sentAt > d || q.sentAt === q.createdAt) ? d : q.sentAt })
                    }}
                  />
                </div>
              </Field>
              <Field label="Projeto / título do quadro" span={2} hint="Aparece no topo do quadro de serviços.">
                <input id="q-title" value={q.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: renderização Casa Pampulha" />
              </Field>
              {!two && (
                <Field group label="Área (m²) e pavimentos" hint="Área em branco = não aparece no PDF · ≈ para área média · cada pavimento a mais encarece.">
                  <AreaFloors id="q" area={q.area} approx={!!q.areaApprox} floors={floors} fee={settings.floorFee ?? 50} hidden={!!q.floorsHidden} onHidden={(floorsHidden) => set({ floorsHidden })} onArea={(area) => set({ area, items: syncArea(q.items, q.area, area, !!q.openFile, floors) })} onApprox={(areaApprox) => set({ areaApprox })} onFloors={(f) => reprice({ floors: f })} />
                </Field>
              )}
              <Field group label="Modelo" span={2}>
                <Segmented<'escopo' | 'opcoes' | 'combo'>
                  value={isCombo(q) ? 'combo' : q.mode}
                  onChange={(m) =>
                    set({
                      mode: m === 'escopo' ? 'escopo' : 'opcoes',
                      combo: m === 'combo',
                      chosenOption: m !== 'combo' && q.chosenOption === BOTH ? '' : q.chosenOption,
                      options: q.options.length >= 2 ? q.options : [newOption(), newOption()],
                    })
                  }
                  options={[
                    { value: 'escopo', label: 'valor único' },
                    { value: 'opcoes', label: 'opções' },
                    { value: 'combo', label: 'propostas + juntas' },
                  ]}
                />
              </Field>
              <div className="field field-check">
                <label className="check toggle">
                  <input id="q-pdf" type="checkbox" checked={q.pdf} onChange={(e) => set({ pdf: e.target.checked })} /> gerar proposta em PDF
                </label>
              </div>
              <Field
                group
                label="Arquivo final"
                span={2}
                hint={
                  !canOpenFile(q, settings.services)
                    ? 'Os serviços deste orçamento já vão abertos (ex.: modelagem em SketchUp): não soma nada.'
                    : q.openFile
                      ? `+${settings.openFileFee ?? 30}% já somado no valor dos serviços (menos os que já vão abertos, como a modelagem). Não aparece no PDF; a proposta só diz como será entregue.`
                      : `Pergunte ao cliente no início. Aberto soma +${settings.openFileFee ?? 30}% no valor dos serviços (menos os que já vão abertos).`
                }
              >
                <Segmented<'fechado' | 'aberto'>
                  value={q.openFile ? 'aberto' : 'fechado'}
                  onChange={(v) => setOpenFile(v === 'aberto')}
                  options={[
                    { value: 'fechado', label: 'fechado (PDF)' },
                    { value: 'aberto', label: `aberto (editável) · +${settings.openFileFee ?? 30}%` },
                  ]}
                />
              </Field>
            </div>
            {q.status === 'aprovado' && (
              <div className="closed-row">
                <label htmlFor="q-closed">
                  <Icon name="check" size={14} /> fechou em
                </label>
                <DateInput
                  id="q-closed"
                 
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
              <ItemsEditor items={q.items} student={student} openFile={!!q.openFile} floors={floors} area={q.area} settings={settings} onChange={(items) => set({ items })} />
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
              <NoteField value={q.notes} items={q.items} settings={settings} onChange={(notes) => set({ notes })} />
            </Section>
          ) : (
            <>
            {q.options.slice(0, MAX_OPTIONS).map((o, n) => (
              <Section
                key={o.id}
                title={`${q.combo ? 'proposta' : 'opção'} ${n + 1}`}
                action={
                  <span className="option-actions">
                    <label className="check small">
                      <input type="radio" name="chosen" checked={q.chosenOption === o.id} onChange={() => set({ chosenOption: o.id })} /> {q.combo ? 'cliente fechou só esta' : 'cliente escolheu esta'}
                    </label>
                    {n >= 2 && (
                      <button type="button" className="link small muted-link" onClick={() => set({ options: q.options.filter((x) => x.id !== o.id), chosenOption: q.chosenOption === o.id ? '' : q.chosenOption })}>
                        remover
                      </button>
                    )}
                  </span>
                }
              >
                <div className="form-grid option-head">
                  <Field label="Título do quadro" span={2} hint="Em branco, usa o título do projeto.">
                    <input value={o.name} onChange={(e) => setOption(o.id, { name: e.target.value })} placeholder={q.title || 'Ex.: renderização V-Ray'} />
                  </Field>
                  <Field group label="Área (m²) e pavimentos" hint="Deste quadro · em branco = não aparece no PDF.">
                    <AreaFloors
                      id={`q-opt${n + 1}`}
                      area={oa(o).area}
                      approx={oa(o).approx}
                      floors={oa(o).floors}
                      fee={settings.floorFee ?? 50}
                      hidden={oa(o).floorsHidden}
                      onHidden={(floorsHidden) => setOption(o.id, { floorsHidden })}
                      onArea={(area) => setOption(o.id, { area, items: syncArea(o.items, oa(o).area, area, !!q.openFile, oa(o).floors) })}
                      onApprox={(areaApprox) => setOption(o.id, { areaApprox })}
                      onFloors={(f) => setOption(o.id, { floors: f, items: repriceItems(o.items, !!q.openFile, f) })}
                    />
                  </Field>
                </div>
                <ItemsEditor items={o.items} student={student} openFile={!!q.openFile} floors={oa(o).floors} area={oa(o).area} settings={settings} onChange={(items) => setOption(o.id, { items })} />
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
                <NoteField value={o.note} items={o.items} settings={settings} onChange={(note) => setOption(o.id, { note })} />
              </Section>
            ))}
            {q.options.length < MAX_OPTIONS && (
              <button type="button" id="q-add-option" className="btn ghost add-option" onClick={() => set({ options: [...q.options.slice(0, MAX_OPTIONS), newOption()] })}>
                + {q.combo ? 'proposta' : 'opção'} {q.options.length + 1}
              </button>
            )}
            </>
          )}

          {isCombo(q) && (
            <Section
              title={`fechando ${allLabel(q)} juntas`}
              action={
                <label className="check small">
                  <input type="radio" name="chosen" checked={q.chosenOption === BOTH} onChange={() => set({ chosenOption: BOTH })} /> cliente fechou {allLabel(q)}
                </label>
              }
            >
              <div className="quote-totals">
                <div>
                  <span>separadas</span>
                  <b>{money(comboSeparate(q))}</b>
                </div>
                <div className="discount-row">
                  <span>desconto</span>
                  {[5, 10, 15].map((pct) => (
                    <button key={pct} className="btn small ghost" onClick={() => set({ comboDiscount: Math.round(comboSeparate(q) * pct) / 100 })}>
                      {pct}%
                    </button>
                  ))}
                  <MoneyInput value={q.comboDiscount ?? 0} onChange={(n) => set({ comboDiscount: n })} />
                </div>
                <div className="grand">
                  <span>juntas</span>
                  <b>{money(comboTotal(q))}</b>
                </div>
              </div>
              <p className="muted small">Na proposta aparece o valor de cada uma e, embaixo, quanto fica fechando {allLabel(q)} juntas.</p>
            </Section>
          )}

          <Section title="informações da proposta">
            <div className="form-grid">
              <Field label="Pagamento" span={3}>
                <input value={q.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
              </Field>
              <Field label="Prazos e cronograma" span={3}>
                <input value={q.schedule} onChange={(e) => set({ schedule: e.target.value })} placeholder="Ex.: 10 dias úteis após o sinal." />
              </Field>
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

          <FootWrap card={!existing}>
            {!existing && (
              <Segmented<QuoteStatus>
                value={q.status}
                onChange={(s) => set({ status: s })}
                options={(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((k) => ({ value: k, label: QUOTE_STATUS[k].label }))}
              />
            )}
            {(() => {
              // projetos que a cliente cancelou depois de fechado: a proposta fica como foi enviada
              const gone = (data.projects.find((x) => x.id === q.projectId)?.items ?? []).filter((i) => i.removed)
              return gone.length ? (
                <p className="small cancel-note">
                  Depois do fechamento, a cliente cancelou: {gone.map((i) => `${i.title} (${money(i.price)}${i.removedAt ? ` · ${fmtDate(i.removedAt)}` : ''})`).join(', ')}. A proposta continua como foi enviada; o valor foi ajustado na demanda.
                </p>
              ) : null
            })()}
            {q.closedValue || q.closedNote ? (
              <p className="small muted">
                {q.closedValue ? (
                  <>
                    Fechado por <b>{money(q.closedValue)}</b> · proposta de <s>{money(total)}</s>
                  </>
                ) : null}
                {q.closedNote ? (
                  <>
                    {q.closedValue ? <br /> : null}
                    Mudou no fechamento: {q.closedNote}
                  </>
                ) : null}
              </p>
            ) : null}
            {!existing && (
              <button className="btn primary block" onClick={approve}>
                <Icon name="check" size={16} /> aprovado → criar demanda
              </button>
            )}
            <div className="row gap-s wrap">
              {existing && (
                <button
                  className="btn ghost small"
                  onClick={duplicate}
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
          </FootWrap>
        </div>

        {q.pdf && (
          <aside className="quote-preview">
            <div className="doc-zoomable" onClick={() => setZoom(true)} title="Ver maior">
              <DocScale>{preview}</DocScale>
              <span className="doc-zoom-btn">
                <Icon name="eye" size={14} /> ver maior
              </span>
            </div>
            {zoom && <DocZoom onClose={() => setZoom(false)}>{preview}</DocZoom>}
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
        const price = cur.auto && s.pricing !== 'livre' ? suggestPrice(s, cur.quantity, cur.complexity, student, settings, lines, !!q.openFile, q.floors ?? 1) : cur.price
        items = items.map((i) => (i === cur ? { ...i, description: lines.join('\n'), price } : i))
      } else {
        const quantity = s.pricing === 'm2' ? q.area || 50 : s.pricing === 'livre' ? 1 : picked.length
        const price = s.pricing === 'livre' ? 0 : suggestPrice(s, quantity, 'media', student, settings, picked, !!q.openFile, q.floors ?? 1)
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
function ItemsEditor({ items, student, openFile, floors, area = 0, settings, onChange }: { items: QuoteItem[]; student: boolean; openFile: boolean; floors: number; area?: number; settings: Settings; onChange: (items: QuoteItem[]) => void }) {
  const service = (sid: string) => settings.services.find((s) => s.id === sid)

  const recompute = (it: QuoteItem): QuoteItem => {
    const s = service(it.service)
    if (it.joined) return { ...it, detail: it.auto || !it.detail ? itemDetail(s, it.quantity, it.complexity) : it.detail, price: 0, unitDiscount: 0 }
    return {
      ...it,
      detail: it.auto || !it.detail ? itemDetail(s, it.quantity, it.complexity) : it.detail,
      price: it.auto && s && s.pricing !== 'livre' ? Math.max(0, suggestPrice(s, it.quantity, it.complexity, student, settings, it.description.split('\n'), openFile, floors) - (it.unitDiscount ?? 0) * it.quantity) : it.price,
    }
  }
  const setItem = (iid: string, patch: Partial<QuoteItem>) => onChange(items.map((i) => (i.id === iid ? recompute({ ...i, ...patch }) : i)))

  return (
    <div className="q-items">
      {items.map((it, n) => {
        const s = service(it.service)
        const lines = it.description.split('\n')
        const byList = pricedByList(s, lines)
        const suggestion = suggestPrice(s, it.quantity, it.complexity, student, settings, lines, openFile, floors)
        const openNote =
          (s?.perFloor && floors > 1 ? ` · ${floors} pavimentos +${(floors - 1) * (settings.floorFee ?? 50)}%` : '') +
          (openFile && s?.deliveryOpen ? ` · inclui arquivo aberto +${settings.openFileFee ?? 30}% (não aparece no PDF)` : '')
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
                    quantity: ns?.pricing === 'm2' ? (area > 0 ? area : Math.max(it.quantity, 50)) : ns?.pricing === 'livre' ? 1 : it.quantity > 40 ? 1 : it.quantity,
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
                        const base = `${s.base && s.pricing === 'm2' ? `base ${money(s.base)} + ` : ''}${count} ${count === 1 ? 'item' : 'itens'} = ${money(r)}${s.pricing === 'm2' ? `/m² × ${it.quantity} m²` : ''} × ${settings.complexity[it.complexity]}`
                        return `tabela: ${money(suggestion)} · ${base}${s.min && suggestion <= s.min ? ` (valor mínimo ${money(s.min)})` : ''}${openNote}`
                      })()
                    : s && s.pricing !== 'livre'
                    ? `tabela: ${money(suggestion)}${rate ? ` · ${money(rate)}/${s.unit}` : ''}${s.pricing === 'm2' ? ` · ${s.base ? `base ${money(s.base)} + ` : ''}${money(s.price)}/m² × ${settings.complexity[it.complexity]}` : ''}${openNote}`
                    : 'digite o valor'
                }
              >
                <div className="row gap-s">
                  <MoneyInput value={it.price} onChange={(v) => setItem(it.id, { price: v, auto: false })} />
                  {s && s.pricing !== 'livre' && (!it.auto || Math.abs(Math.max(0, suggestion - (it.unitDiscount ?? 0) * it.quantity) - it.price) >= 0.01) && (
                    <button className="btn small ghost" onClick={() => setItem(it.id, { auto: true })} title="Usar o valor da tabela">
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

/** Área (m²), "≈ estimada" e pavimentos: do orçamento ou de cada quadro. */
function AreaFloors({ id, area, approx, floors, fee, hidden, onArea, onApprox, onFloors, onHidden }: { id: string; area: number; approx: boolean; floors: number; fee: number; hidden: boolean; onArea: (n: number) => void; onApprox: (v: boolean) => void; onFloors: (n: number) => void; onHidden: (v: boolean) => void }) {
  return (
    <div className="area-field">
      <input id={`${id}-area`} type="number" min={0} inputMode="decimal" value={area || ''} placeholder="0" onFocus={(e) => e.target.select()} onChange={(e) => onArea(Number(e.target.value) || 0)} />
      <div className="area-extras">
        <label className={`area-approx ${approx ? 'on' : ''}`} title="Área estimada / em média: aparece como ≈ na proposta">
          <input type="checkbox" checked={approx} onChange={(e) => onApprox(e.target.checked)} />≈ estimada
        </label>
        <span className={`floors ${floors > 1 ? 'on' : ''}`} title={`Cada pavimento a mais soma ${fee}% nos serviços que encarecem (configurações → preços)`}>
          <button type="button" onClick={() => onFloors(Math.max(1, floors - 1))} disabled={floors <= 1} aria-label="Menos um pavimento">
            −
          </button>
          <b id={`${id}-floors`}>{floors}</b> pav.
          <button type="button" onClick={() => onFloors(Math.min(20, floors + 1))} aria-label="Mais um pavimento">
            +
          </button>
          {floors > 1 && (
            <input
              type="checkbox"
              className="floors-pdf"
              checked={!hidden}
              onChange={(e) => onHidden(!e.target.checked)}
              title={hidden ? 'Não aparece no PDF (marque para mostrar)' : 'Aparece no PDF (desmarque para esconder)'}
              aria-label="Mostrar pavimentos no PDF"
            />
          )}
        </span>
      </div>
    </div>
  )
}

/** Observação do quadro: texto livre + sugestões prontas dos serviços que estão nele (um toque coloca ou tira). */
function NoteField({ value, items, settings, onChange }: { value: string; items: QuoteItem[]; settings: Settings; onChange: (v: string) => void }) {
  const ids = [...new Set(items.map((i) => i.service).filter(Boolean))]
  const hints = [
    ...new Set(
      [...ids.flatMap((sid) => settings.services.find((x) => x.id === sid)?.noteHints ?? []), ...GENERAL_NOTE_HINTS].map((h) => h.trim()).filter(Boolean),
    ),
  ]
  const lines = value.split('\n').map((l) => l.trim()).filter(Boolean)
  const has = (h: string) => lines.some((l) => l.toLowerCase() === h.toLowerCase())
  const toggle = (h: string) => onChange((has(h) ? lines.filter((l) => l.toLowerCase() !== h.toLowerCase()) : [...lines, h]).join('\n'))
  const [open, setOpen] = useState(false)
  const used = hints.filter(has).length
  return (
    <Field label="Observação (dentro do quadro)" hint={open ? 'Toque para colocar ou tirar · dá para editar o texto à vontade.' : undefined}>
      <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" rows={Math.min(6, Math.max(2, lines.length + 1))} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Opcional" />
      {hints.length > 0 && (
        <button type="button" className="note-hints-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <Icon name="sparkle" size={13} /> observações prontas ({hints.length}){used ? ` · ${used} em uso` : ''}
          <Icon name="chevronR" size={13} className={open ? 'rot-down' : 'rot-up'} />
        </button>
      )}
      {open && hints.length > 0 && (
        <div className="note-hints">
          {hints.map((h) => (
            <button key={h} type="button" className={`note-hint ${has(h) ? 'is-on' : ''}`} onClick={() => toggle(h)} title={h}>
              <Icon name={has(h) ? 'check' : 'plus'} size={12} />
              <span>{h}</span>
            </button>
          ))}
        </div>
      )}
    </Field>
  )
}

/** Fim do orçamento: na proposta nova é o card "status"; depois de salva, só os avisos e os botões (duplicar/excluir), sem card. */
function FootWrap({ card, children }: { card: boolean; children: ReactNode }) {
  return card ? <Section title="status">{children}</Section> : <div className="quote-foot">{children}</div>
}
