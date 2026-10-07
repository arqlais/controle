import { useKindSettings } from './DocKit'
import type { CSSProperties, ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { PAYMENT_TERMS } from '../store'
import { useAccess } from '../access'
import { resolveTemplate, sheetColors, showsLogo } from '../proposalTemplates'
import { ProposalSlides } from './Slides'
import type { Client, PartnerTable, Payment, Project, Quote, QuoteItem, QuoteOption, ServiceDef, Settings, SiteVisit } from '../types'
import { packageMonths, packageText, allLabel, atHandle, optionArea, comboSeparate, comboTotal, isCombo, quoteFiles, cleanDetail, cleanSite, itemDiscount, money, optionTotal, quoteNumber, quoteSubtotal, quoteTotal, today, docKind, showDoc, payerOf, lower, sortedTiers, withPartner } from '../utils'
/* ---------- valor por extenso (pt-BR) ---------- */

const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (c) parts.push(C[c])
  if (r) parts.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ` e ${U[r % 10]}` : ''))
  return parts.join(' e ')
}

function inteiro(n: number): string {
  if (n === 0) return 'zero'
  const mi = Math.floor(n / 1_000_000)
  const mil = Math.floor((n % 1_000_000) / 1000)
  const r = n % 1000
  const parts: string[] = []
  if (mi) parts.push(mi === 1 ? 'um milhão' : `${ate999(mi)} milhões`)
  if (mil) parts.push(mil === 1 ? 'mil' : `${ate999(mil)} mil`)
  if (r) parts.push(ate999(r))
  if (parts.length > 1 && r && (r < 100 || r % 100 === 0)) return parts.slice(0, -1).join(' ') + ' e ' + parts[parts.length - 1]
  return parts.join(' ')
}

export function porExtenso(valor: number) {
  const reais = Math.floor(valor)
  const cents = Math.round((valor - reais) * 100)
  const r = reais ? `${inteiro(reais)} ${reais === 1 ? 'real' : 'reais'}` : ''
  const c = cents ? `${inteiro(cents)} ${cents === 1 ? 'centavo' : 'centavos'}` : ''
  return [r, c].filter(Boolean).join(' e ') || 'zero reais'
}


/* ============================================================
   Proposta no modelo "Proposta #001" (Canva), em A4 (794 × 1123 px):
   faixa grafite com o nome · campos nome/data/nº · "proposta de orçamento"
   · quadro de serviços · faixa rosé do total · 3 informações com ícone
   · rodapé com contatos. Cores e textos em Configurações → Modelo da proposta.
   ============================================================ */

const fmt = (s: string) => {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const LEVELS = ['', 'is-long', 'is-xlong'] as const
// respiro mínimo entre as informações e o rodapé (na folha em tamanho real)
const MIN_GAP = 84

/** Folha da proposta. Com `fit`, mede o espaço de verdade: começa com o espaçamento normal e
    só aproxima o título e compacta o quadro quando o escopo não deixa respiro antes do rodapé. */
function Sheet({ s, year, children, fit, barName }: { s: Settings; year: string; children: ReactNode; fit?: string; barName?: string }) {
  // modelo e cores conforme o plano (o "Proposta #001" é só da dona)
  const { tpl, p } = useSheet(s)
  const ref = useRef<HTMLElement>(null)
  const [level, setLevel] = useState(0)
  useLayoutEffect(() => {
    setLevel(0)
  }, [fit])
  useLayoutEffect(() => {
    if (fit === undefined || !ref.current) return
    const infos = ref.current.querySelector<HTMLElement>('.p-infos, .p-total, .p-options, .p-card')
    const foot = ref.current.querySelector<HTMLElement>('.p-contacts')
    const blocks = [...ref.current.querySelectorAll<HTMLElement>('.p-body > *')].filter((el) => el !== foot)
    const last = blocks[blocks.length - 1] ?? infos
    if (!last) return
    // sem rodapé de contatos, o limite é o fim da folha A4 (1123 px)
    const box = ref.current.getBoundingClientRect()
    const k = box.width / 794 || 1 // a prévia fica em escala reduzida
    const y = (v: number) => (v - box.top) / k
    const limit = foot ? y(foot.getBoundingClientRect().top) : 1123 - 24
    const gap = limit - y(last.getBoundingClientRect().bottom)
    if (gap < MIN_GAP && level < LEVELS.length - 1) setLevel(level + 1)
  })
  const style = {
    '--p-ink': p.ink,
    '--p-rose': p.rose,
    '--p-total': p.arch,
    '--p-paper': p.paper,
    '--p-bar': p.bar,
    '--p-serif': `'${p.serif}', 'Cormorant Garamond', Georgia, serif`,
    '--p-sans': `'${p.sans}', 'Poppins', system-ui, sans-serif`,
  } as CSSProperties
  return (
    <article ref={ref} className={`proposal tpl-${tpl.id} ${LEVELS[level]}`} style={style}>
      <div className="p-bar">
        <span>{(barName || s.legalName || s.ownerName || s.brandName).toUpperCase()}</span>
        <span>{year}</span>
      </div>
      <div className="p-body">
        {/* logo do estúdio no canto (opção em configurações → aparência) */}
        {showsLogo(s) && tpl.id !== 'lais' && <img className="p-logo" src={s.logo} alt="" />}
        {children}
      </div>
    </article>
  )
}

/** Modelo e cores que valem para esta conta. */
function useSheet(s: Settings) {
  const { has } = useAccess()
  return { tpl: resolveTemplate(s.proposal, has), p: sheetColors(s.proposal, has, s) }
}

/* ============================================================
   Modelos dos clientes (coluna, faixa, planilha, editorial):
   diagramação própria, cantos retos, com as cores e fontes de cada conta.
   ============================================================ */
function ClientSheet({ s, tpl, p, eyebrow, title, number, meta, infos, children }: { s: Settings; tpl: string; p: ReturnType<typeof sheetColors>; eyebrow: string; title: string; number: string; meta: [string, string][]; infos: { label: string; text: string }[]; children: ReactNode }) {
  const style = {
    '--p-ink': p.ink,
    '--p-rose': p.rose,
    '--p-total': p.arch,
    '--p-paper': p.paper,
    '--p-bar': p.bar,
    '--p-serif': `'${p.serif}', 'Cormorant Garamond', Georgia, serif`,
    '--p-sans': `'${p.sans}', 'Poppins', system-ui, sans-serif`,
  } as CSSProperties
  const brand = (s.brandName || s.legalName || s.ownerName || '').replace(/\.$/, '')
  const contacts = [s.phone, atHandle(s.instagram), cleanSite(s.website), s.email].filter((x) => x && x.trim())
  return (
    <article className={`proposal cdoc cdoc-${tpl}`} style={style}>
      <header className="cd-head">
        <div className="cd-brand">{showsLogo(s) ? <img src={s.logo} alt="" /> : <span>{brand}</span>}</div>
        <div className="cd-kind">
          <span className="cd-eyebrow">{eyebrow}</span>
          <h1 className="cd-title">{title}</h1>
          <span className="cd-number">{number}</span>
        </div>
        <dl className="cd-meta">
          {meta.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </header>
      <div className="cd-main">{children}</div>
      {infos.length > 0 && (
        <section className="cd-infos">
          {infos.map((i) => (
            <div key={i.label}>
              <b>{i.label}</b>
              <p>{i.text}</p>
            </div>
          ))}
        </section>
      )}
      {contacts.length > 0 && <footer className="cd-foot">{contacts.join('   ·   ')}</footer>}
    </article>
  )
}

function Fields({ name, date, label, value }: { name: string; date: string; label: string; value: string }) {
  return (
    <section className="p-fields">
      <div className="p-field is-name">
        <span className="p-label">nome</span>
        <div className="p-box">{name}</div>
      </div>
      <div className="p-field">
        <span className="p-label">data</span>
        <div className="p-box">{fmt(date)}</div>
      </div>
      <div className="p-field">
        <span className="p-label">{label}</span>
        <div className="p-box">{value}</div>
      </div>
    </section>
  )
}

function Title({ s, eyebrow, title }: { s: Settings; eyebrow?: string; title?: string }) {
  return (
    <section className="p-title-block">
      <span className="p-eyebrow">{eyebrow ?? s.proposal.eyebrow}</span>
      <h1 className="p-title">{title ?? s.proposal.title}</h1>
    </section>
  )
}

const ICONS = {
  pay: (
    <>
      <rect x="5" y="8" width="14" height="9.5" rx="1.6" />
      <path d="M5 11h14" />
      <path d="M7.5 15h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="5.5" y="7" width="13" height="11.5" rx="1.6" />
      <path d="M5.5 10.5h13M9 5.5v3M15 5.5v3" />
      <path d="M9 13.3h.01M12 13.3h.01M15 13.3h.01M9 16h.01M12 16h.01" strokeWidth="2" />
    </>
  ),
  folder: <path d="M5 8.5a1.5 1.5 0 0 1 1.5-1.5h3.2l1.6 1.8h6.2A1.5 1.5 0 0 1 19 10.3v6.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16.5z" />,
}

function InfoRow({ items, color }: { items: { icon: keyof typeof ICONS; label: string; text: string }[]; color: string }) {
  return (
    <section className="p-infos">
      {items.map((it) => (
        <div key={it.label} className="p-info-item">
          <svg viewBox="0 0 24 24" className="p-info-icon" aria-hidden>
            <circle cx="12" cy="12" r="12" style={{ fill: color }} />
            <g fill="none" stroke="#e1cac4" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              {ICONS[it.icon]}
            </g>
          </svg>
          <p>
            <b>{it.label}:</b> {it.text}
          </p>
        </div>
      ))}
    </section>
  )
}

function Contacts({ s }: { s: Settings }) {
  // rodapé do modelo: contatos do perfil (campo vazio não aparece)
  const items = ([
    ['cell', s.phone],
    ['instagram', atHandle(s.instagram)],
    ['site', cleanSite(s.website)],
    ['e-mail', s.email],
  ] as [string, string][]).filter(([, v]) => v.trim())
  if (!items.length) return null
  return (
    <footer className="p-contacts">
      {items.map(([k, v]) => (
        <span key={k}>
          <i>{k}:</i> {v}
        </span>
      ))}
    </footer>
  )
}

/** "O que está incluso": uma linha vira texto; várias linhas viram tópicos discretos. */
function Desc({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return null
  if (lines.length === 1) return <span className="p-row-desc">{lines[0]}</span>
  return (
    <ul className="p-row-desc p-row-list">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  )
}

function Rows({ items: all, priceFirst }: { items: QuoteItem[]; priceFirst?: boolean }) {
  // serviço em branco (sem nome e sem valor) não vai para a proposta
  const items = all.filter((it) => it.title.trim() || it.price > 0 || it.joined)
  return (
    <div className="p-rows">
      {items.map((it, i) => (
        <div key={it.id} className={`p-row ${priceFirst ? 'is-price-first' : ''}`}>
          {priceFirst ? <b className="p-row-price">{it.joined ? '' : money(it.price)}</b> : <b className="p-row-n">{items.length === 1 ? '—' : String(i + 1).padStart(2, '0')}</b>}
          <div className="p-row-main">
            <span className="p-row-title">
              {it.title || 'serviço'}
              {cleanDetail(it.detail) ? ` · ${cleanDetail(it.detail)}` : ''}
            </span>
            <Desc text={it.description} />
          </div>
          {/* cobrado junto com o de cima: sem valor na linha, já está somado no total */}
          {!priceFirst && <span className="p-row-price">{it.joined ? '' : money(it.price)}</span>}
        </div>
      ))}
    </div>
  )
}

function TotalBar({ label, value, note, compact }: { label: string; value: number; note?: string; compact?: boolean }) {
  return (
    <div className={`p-total ${compact ? 'is-compact' : ''}`}>
      <span className="p-total-label">{label}</span>
      <div className="p-total-value">
        <b>{money(value)}</b>
        {note && <i>{note}</i>}
      </div>
    </div>
  )
}

const discountText = (value: number) => (value > 0 ? `com ${money(value)} de desconto` : '')

/** Esta proposta sai em slides? (cliente final, a menos que tenha escolhido a folha única) */
export const isSlides = (q: Quote) => q.audience === 'final' && q.layout !== 'folha'

export function QuoteDoc({ s, client, quote }: { s: Settings; client?: Client; quote: Quote }) {
  // terceirização com tabela de valores: sai a tabela "exclusivo parceria", com o nº, a data e os combinados do orçamento
  const tb = quote.table
  if (tb?.on && Object.keys(tb.services).length)
    return (
      <PartnerSheet
        s={s}
        client={client}
        table={{ ...tb, number: quote.noNumber ? undefined : quote.number, date: quote.createdAt, payment: quote.paymentTerms, schedule: quote.schedule, files: quoteFiles(quote, s.services) }}
        services={withPartner(s, { partner: { ...tb, on: true } } as Client).services}
      />
    )
  // cliente final: proposta em slides 16:9 (ou a folha única, se escolheu)
  if (isSlides(quote)) return <ProposalSlides s={s} client={client} quote={quote} />
  return <QuoteSheet s={s} client={client} quote={quote} />
}

function QuoteSheet({ s, client, quote }: { s: Settings; client?: Client; quote: Quote }) {
  const { tpl, p } = useSheet(s)
  const clientName = client?.name || '[nome do cliente]'
  // cada quadro com a própria área e pavimentos (opções/propostas de projetos diferentes)
  const heading = (name: string, o?: QuoteOption) => {
    const { area, approx, floors, floorsHidden } = optionArea(quote, o)
    return [name || quote.title || 'serviços', area > 0 ? `${approx ? '≈ ' : ''}${area.toLocaleString('pt-BR')} m²` : '', floors > 1 && !floorsHidden ? `${floors} pavimentos` : ''].filter(Boolean).join(' • ')
  }
  const infos = [
    { icon: 'pay' as const, label: 'Pagamento', text: packageMonths(quote) ? packageText(packageMonths(quote), quote.mode === 'opcoes' ? undefined : quoteTotal(quote, s.urgencyFee)) : quote.paymentTerms.trim() || PAYMENT_TERMS },
    { icon: 'calendar' as const, label: 'Prazos e cronograma', text: quote.schedule },
    { icon: 'folder' as const, label: 'Formatos de arquivos entregues', text: quoteFiles(quote, s.services) },
  ].filter((x) => x.text?.trim())

  const sub = quoteSubtotal(quote)
  const urgencyValue = quote.urgency && !quote.urgencyHidden ? (sub * s.urgencyFee) / 100 : 0
  const scopeDiscount = quote.discount + quote.items.reduce((acc, i) => acc + itemDiscount(i), 0)
  const pkg = packageMonths(quote)
  const scopeNote = [quote.discountNote || [urgencyValue ? `inclui urgência de ${money(urgencyValue)}` : '', discountText(scopeDiscount)].filter(Boolean).join(' · '), pkg ? `em ${pkg}× de ${money(Math.round((quoteTotal(quote, s.urgencyFee) / pkg) * 100) / 100)} por mês` : ''].filter(Boolean).join(' · ')

  const main = (
    <>
      {quote.mode === 'opcoes' ? (
        <section
          className={`p-options ${quote.options.length > 2 ? 'is-3' : ''} ${
            // só reserva a linha do desconto/observação quando alguma opção tem
            quote.options.slice(0, 3).some((o) => o.discountNote || (o.discount || 0) + o.items.reduce((acc, i) => acc + itemDiscount(i), 0) > 0) ? 'has-notes' : ''
          }`}
        >
          {quote.options.slice(0, 3).map((o, n) => {
            const disc = (o.discount || 0) + o.items.reduce((acc, i) => acc + itemDiscount(i), 0)
            return (
              <div key={o.id} className="p-option">
                <span className="p-option-label">{quote.combo ? 'proposta' : 'opção'} {n + 1}</span>
                <div className="p-card">
                  <h3 className="p-card-title">{heading(o.name, o)}</h3>
                  <Rows items={o.items} priceFirst />
                  {o.note && <p className="p-note">{o.note}</p>}
                </div>
                <TotalBar compact label="total" value={optionTotal(o)} note={o.discountNote || discountText(disc)} />
              </div>
            )
          })}
        </section>
      ) : (
        <>
          <div className="p-card">
            <div className="p-card-head">
              <h3 className="p-card-title">{heading(quote.title)}</h3>
              <span className="p-label">valor</span>
            </div>
            <Rows items={quote.urgency && quote.urgencyHidden ? quote.items.map((it) => ({ ...it, price: Math.round(it.price * (1 + s.urgencyFee / 100) * 100) / 100 })) : quote.items} />
            {quote.notes && <p className="p-note">{quote.notes}</p>}
          </div>
          <TotalBar label="investimento total" value={quoteTotal(quote, s.urgencyFee)} note={scopeNote} />
        </>
      )}
      {isCombo(quote) && (
        <div className="p-combo">
          <TotalBar label={`fechando ${allLabel(quote)} juntas`} value={comboTotal(quote)} note={(quote.comboDiscount ?? 0) > 0 ? `em vez de ${money(comboSeparate(quote))} · economia de ${money(comboSeparate(quote) - comboTotal(quote))}` : ''} />
        </div>
      )}
      {quote.mode === 'opcoes' && quote.notes && <p className="p-note is-outside">{quote.notes}</p>}
    </>
  )
  // modelos dos clientes: diagramação própria (o "Proposta #001" é só da dona)
  if (tpl.id !== 'lais')
    return (
      <ClientSheet
        s={s}
        tpl={tpl.id}
        p={p}
        eyebrow={s.proposal.eyebrow}
        title={s.proposal.title}
        number={quoteNumber(quote)}
        meta={[
          ['cliente', clientName],
          ['data', fmt(quote.createdAt)],
          ['orçamento nº', quoteNumber(quote)],
        ]}
        infos={infos}
      >
        {main}
      </ClientSheet>
    )
  // escopo grande (muitos serviços / tópicos): aproxima o título e o quadro para caber sem espremer
  return (
    <Sheet s={s} year={quote.createdAt.slice(0, 4)} fit={JSON.stringify([quote.items, quote.options, quote.notes, quote.mode, quote.combo, quote.comboDiscount, quote.title, quote.area, quote.floors, quote.floorsHidden, s.proposal])}>
      <Fields name={clientName} date={quote.createdAt} label="orçamento nº" value={quoteNumber(quote)} />
      <Title s={s} />
      {main}
      {infos.length > 0 && <InfoRow items={infos} color="var(--p-bar)" />}
      <Contacts s={s} />
    </Sheet>
  )
}

export function ReceiptDoc({ s: s0, client, project, payment }: { s: Settings; client?: Client; project: Project; payment: Payment }) {
  const s = useKindSettings(s0, 'recibo')
  const { tpl, p } = useSheet(s)
  const { name: payer, doc: payerDoc } = payerOf(client)
  const date = payment.paidDate ?? today()
  // adicionais cobrados nesta parcela (somados ao saldo ou cobrados à parte)
  const extras = (project.extras ?? []).filter((x) => x.paymentId === payment.id)
  const base = Math.round((payment.amount - extras.reduce((t, x) => t + x.value, 0)) * 100) / 100
  const main = (
    <>
      <div className="p-card">
        <h3 className="p-card-title">{project.title}</h3>
        <p className="p-receipt">
          Recebi de <b>{payer}</b>
          {payerDoc && <>, {docKind(payerDoc) || 'CPF/CNPJ'} {showDoc(payerDoc)}</>}, a importância de <b>{money(payment.amount)}</b> ({porExtenso(payment.amount)}), referente a{' '}
          {lower(payment.description)} do projeto <b>{project.title}</b>, dando plena quitação deste valor.
        </p>
        {extras.length > 0 && (
          <div className="p-rows">
            {base > 0 && (
              <div className="p-row">
                <div className="p-row-main">
                  <span className="p-row-title">{payment.description.replace(/^adicional · /i, '') || 'parcela'}</span>
                </div>
                <span className="p-row-price">{money(base)}</span>
              </div>
            )}
            {extras.map((x) => (
              <div key={x.id} className="p-row">
                <div className="p-row-main">
                  <span className="p-row-title">adicional · {x.title}</span>
                  {x.quantity && x.unitPrice ? <span className="p-row-desc">{x.quantity} × {money(x.unitPrice)}</span> : null}
                </div>
                <span className="p-row-price">{money(x.value)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="p-note">
          {s.city ? `${s.city}, ` : ''}
          {fmt(date)} · {s.legalName || s.ownerName}
          {s.document ? ` · ${docKind(s.document) || 'CPF/CNPJ'} ${showDoc(s.document)}` : ''}
        </p>
      </div>
      <TotalBar label="valor recebido" value={payment.amount} />
    </>
  )
  if (tpl.id !== 'lais')
    return (
      <ClientSheet s={s} tpl={tpl.id} p={p} eyebrow="comprovante de" title="recibo" number={money(payment.amount)} meta={[['recebido de', payer], ['data', fmt(date)], ['forma', payment.method || '—']]} infos={[]}>
        {main}
      </ClientSheet>
    )
  return (
    <Sheet s={s} year={date.slice(0, 4)}>
      <Fields name={payer} date={date} label="forma" value={payment.method || '—'} />
      <Title s={s} eyebrow="comprovante de" title="recibo" />
      {main}
      <Contacts s={s} />
    </Sheet>
  )
}

/* ---------- recibo de cobrança (modelo "recibo serviço" / "imagens aprovadas!") ---------- */

export interface BillCard {
  icon: 'folder' | 'edit' | 'laptop' | 'ruler' | 'sparkle' | 'check'
  title: string
  text: string // **palavra** fica em destaque rosé
  on: boolean
}
export interface BillInfo {
  kind: 'servico' | 'imagens'
  label: string // título do quadro de valores (ex.: "5 imagens renderizadas por IA")
  total: number
  paid: number
  cards: BillCard[]
}

const BILL_ICONS: Record<BillCard['icon'], ReactNode> = {
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  laptop: <path d="M5 5h14v10H5zM3 19h18" />,
  ruler: <path d="M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2" />,
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />,
  check: <path d="M5 12l5 5L20 7" />,
}

const rich = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part))

export function BillDoc({ s: s0, info, year }: { s: Settings; info: BillInfo; year: string }) {
  const s = useKindSettings(s0, 'recibo')
  const [a, b] = ['recibo', 'serviço']
  const pct = info.total > 0 ? Math.round((info.paid / info.total) * 100) : 0
  const rest = Math.max(0, info.total - info.paid)
  const { tpl, p } = useSheet(s)
  // clientes: mesmo conteúdo, na diagramação do modelo escolhido (o "recibo serviço" do Canva é só da dona)
  if (tpl.id !== 'lais')
    return (
      <ClientSheet s={s} tpl={tpl.id} p={p} eyebrow="recibo de" title="serviço" number={money(info.total)} meta={[['data', fmt(today())], ['situação', rest > 0 ? 'pagamento parcial' : 'quitado']]} infos={[]}>
        <div className="p-card">
          <h3 className="p-card-title">{info.label}</h3>
          <div className="p-rows">
            {info.cards
              .filter((c) => c.on && c.text.trim())
              .map((c, i) => (
                <div key={i} className="p-row">
                  <b className="p-row-n">{String(i + 1).padStart(2, '0')}</b>
                  <div className="p-row-main">
                    <span className="p-row-title">{c.title}</span>
                    <span className="p-row-desc">{c.text.replace(/\*\*/g, '')}</span>
                  </div>
                  <span />
                </div>
              ))}
          </div>
        </div>
        <TotalBar label="valor total" value={info.total} note={info.paid > 0 ? `já pago ${money(info.paid)}${pct ? ` (${pct}%)` : ''}` : ''} />
        {rest > 0 && <TotalBar compact label="restante a pagar" value={rest} />}
        <p className="p-note">obrigado(a) pela confiança! fico à disposição para os próximos projetos.</p>
      </ClientSheet>
    )
  return (
    <Sheet s={s} year={year} barName={s.brandName || s.legalName}>
      <div className="bill">
        <h1 className="bill-title">
          <span>{a}</span>
          <em>{b}</em>
        </h1>
        <p className="bill-sub">comprovante de aprovação e finalização do serviço, com as principais informações sobre a entrega e encerramento do serviço contratado.</p>
        <div className="bill-cards">
          {info.cards
            .filter((c) => c.on && c.text.trim())
            .map((c, i) => (
              <div key={i} className="bill-card">
                <div className="bill-card-head">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {BILL_ICONS[c.icon]}
                  </svg>
                  <span>{c.title}</span>
                </div>
                <p>{rich(c.text)}</p>
              </div>
            ))}
        </div>
        <div className="bill-money">
          <div className="bill-card-head">
            <span className="bill-coin">$</span>
            <span>{info.label}</span>
          </div>
          <div className="bill-row">
            <span>valor total</span>
            <i />
            <span>{money(info.total)}</span>
          </div>
          {info.paid > 0 && (
            <div className="bill-row">
              <span>já pago{pct ? ` (${pct}%)` : ''}</span>
              <i />
              <span>{money(info.paid)}</span>
            </div>
          )}
          <div className="bill-due">
            <span>{rest > 0 ? 'restante a pagar' : 'pago'}</span>
            <b>{money(rest > 0 ? rest : info.total)}</b>
          </div>
        </div>
        <p className="bill-thanks">
          obrigada pela confiança <span className="bill-heart">♥</span> fico à disposição para futuros projetos!
        </p>
      </div>
    </Sheet>
  )
}

/* ---------- relatório de visita de obra (plano Estúdio) ---------- */

export function VisitReportDoc({ s, client, project, visit, urls }: { s: Settings; client?: Client; project: Project; visit: SiteVisit; urls: Record<string, string> }) {
  const { tpl, p } = useSheet(s)
  const photos = visit.photos.filter((ph) => urls[ph.id])
  const main = (
    <>
      <div className="p-card">
        <h3 className="p-card-title">{visit.title || 'visita de obra'}</h3>
        {visit.notes && <p className="p-receipt vr-text">{visit.notes}</p>}
        {visit.next && (
          <p className="p-note vr-next">
            <b>próximos passos:</b> {visit.next}
          </p>
        )}
      </div>
      {photos.length > 0 && (
        <div className="vr-photos">
          {photos.map((ph) => (
            <figure key={ph.id}>
              <img src={urls[ph.id]} alt="" crossOrigin="anonymous" />
              {ph.caption && <figcaption>{ph.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </>
  )
  const who = client?.name ?? ''
  if (tpl.id !== 'lais')
    return (
      <ClientSheet s={s} tpl={tpl.id} p={p} eyebrow="relatório de" title="visita de obra" number={fmt(visit.date)} meta={[['projeto', project.title], ['cliente', who || '—'], ['fotos', String(photos.length)]]} infos={[]}>
        {main}
      </ClientSheet>
    )
  return (
    <Sheet s={s} year={visit.date.slice(0, 4)}>
      <Fields name={who} date={visit.date} label="projeto" value={project.title} />
      <Title s={s} eyebrow="relatório de" title="visita de obra" />
      {main}
      <Contacts s={s} />
    </Sheet>
  )
}

/* ============================================================
   Tabela de parceria: valores combinados com um escritório parceiro
   (pacotes por m² num quadro, imagens/unidades no outro), no modelo da proposta.
   ============================================================ */
const plural = (n: number, unit: string) => (n === 1 ? unit : unit.endsWith('m') ? `${unit.slice(0, -1)}ns` : unit.endsWith('l') ? `${unit.slice(0, -1)}is` : `${unit}s`)
const pad2 = (n: number) => String(n).padStart(2, '0')
const brl = (n: number) => money(n)

export function PartnerSheet({ s, client, table, services }: { s: Settings; client?: Client; table: PartnerTable; services: ServiceDef[] }) {
  const picked = services.filter((x) => table.services[x.id])
  const area = picked.filter((x) => x.pricing === 'm2')
  const units = picked.filter((x) => x.pricing !== 'm2' && x.pricing !== 'livre')
  const infos = [
    { icon: 'pay' as const, label: 'Pagamento', text: table.payment ?? s.defaultPaymentTerms ?? PAYMENT_TERMS },
    { icon: 'calendar' as const, label: 'Prazos e cronograma', text: table.schedule ?? s.proposal.schedule },
    { icon: 'folder' as const, label: 'Formatos de arquivos entregues', text: table.files ?? s.proposal.files },
  ].filter((x) => x.text?.trim())
  const date = table.date || today()
  const tiersOf = (x: ServiceDef) => {
    const t = sortedTiers(x.areaTiers).filter((y) => y.price > 0)
    return t.length ? t : [{ upTo: 0, price: x.price }]
  }
  return (
    <Sheet s={s} year={date.slice(0, 4)} fit={JSON.stringify([table, picked.map((x) => x.id)])}>
      <Fields name={client?.name || '[nome do cliente]'} date={date} label="orçamento" value={table.number ? `#${pad2(table.number).padStart(3, '0')}` : '—'} />
      <Title s={s} eyebrow="orçamento" title={table.title || 'exclusivo parceria'} />
      <section className={`pp-grid ${area.length && units.length ? 'is-two' : ''}`}>
        {area.length > 0 && (
          <div className="pp-dark">
            {area.map((x) => (
              <div key={x.id} className="pp-block">
                <h3 className="pp-name">{x.name}</h3>
                {tiersOf(x).map((t, i, all) => {
                  const prev = all[i - 1]?.upTo
                  const range = all.length === 1 ? '' : t.upTo ? (prev ? `de ${prev + 1} a ${t.upTo} m²` : `até ${t.upTo} m²`) : `acima de ${prev} m²`
                  return (
                    <div key={i} className="pp-tier">
                      {all.length > 1 && (
                        <p className="pp-pack">
                          <b>pacote {i + 1}</b> <span>{range}</span>
                        </p>
                      )}
                      <p className="pp-box">
                        <small>a partir de</small> <b>{brl(t.price)} / m²</b>
                      </p>
                    </div>
                  )
                })}
                {table.services[x.id]?.incluso?.trim() && (
                  <p className="pp-incl">
                    <b>incluso:</b> {table.services[x.id]!.incluso}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {units.length > 0 && (
          <div className="pp-light">
            {units.map((x) => {
              const unit = x.unit || 'unidade'
              const rows: [string, number][] =
                x.pricing === 'pacote'
                  ? [[`${pad2(1)} ${unit}`, x.price] as [string, number], ...[...x.tiers].filter((t) => t.qty > 1 && t.price > 0).sort((a, b) => a.qty - b.qty).map((t): [string, number] => [`${pad2(t.qty)} ${plural(t.qty, unit)}`, t.price])]
                  : [[`${x.pricing === 'hora' ? 'hora' : `por ${unit}`}`, x.price]]
              return (
                <div key={x.id} className="pp-block">
                  <h3 className="pp-name">{x.name}</h3>
                  {rows.map(([l, v]) => (
                    <p key={l} className="pp-row">
                      <span>{l}</span>
                      <i />
                      <b>{brl(v)}</b>
                    </p>
                  ))}
                  {table.services[x.id]?.incluso?.trim() && (
                    <p className="pp-incl">
                      <b>incluso:</b> {table.services[x.id]!.incluso}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
      {infos.length > 0 && <InfoRow items={infos} color="var(--p-bar)" />}
      <Contacts s={s} />
    </Sheet>
  )
}
