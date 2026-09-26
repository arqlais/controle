import type { CSSProperties, ReactNode } from 'react'
import { PAYMENT_TERMS } from '../store'
import type { Client, Payment, Project, Quote, QuoteItem, Settings } from '../types'
import { atHandle, cleanDetail, cleanSite, itemDiscount, money, optionTotal, quoteNumber, quoteSubtotal, quoteTotal, today } from '../utils'
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

function Sheet({ s, year, children }: { s: Settings; year: string; children: ReactNode }) {
  const p = s.proposal
  const style = {
    '--p-ink': p.ink,
    '--p-rose': p.rose,
    '--p-total': p.arch,
    '--p-paper': p.paper,
    '--p-bar': p.bar,
    '--p-serif': `'${p.serif}', 'Cormorant Garamond', Georgia, serif`,
  } as CSSProperties
  return (
    <article className="proposal" style={style}>
      <div className="p-bar">
        <span>{(s.legalName || s.ownerName || s.brandName).toUpperCase()}</span>
        <span>{year}</span>
      </div>
      <div className="p-body">{children}</div>
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
            <circle cx="12" cy="12" r="12" fill={color} />
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
  const items = all.filter((it) => it.title.trim() || it.price > 0)
  return (
    <div className="p-rows">
      {items.map((it, i) => (
        <div key={it.id} className={`p-row ${priceFirst ? 'is-price-first' : ''}`}>
          {priceFirst ? <b className="p-row-price">{money(it.price)}</b> : <b className="p-row-n">{items.length === 1 ? '—' : String(i + 1).padStart(2, '0')}</b>}
          <div className="p-row-main">
            <span className="p-row-title">
              {it.title || 'serviço'}
              {cleanDetail(it.detail) ? ` · ${cleanDetail(it.detail)}` : ''}
            </span>
            <Desc text={it.description} />
          </div>
          {!priceFirst && <span className="p-row-price">{money(it.price)}</span>}
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

export function QuoteDoc({ s, client, quote }: { s: Settings; client?: Client; quote: Quote }) {
  const clientName = client?.name || '[nome do cliente]'
  const heading = (name: string) => [name || quote.title || 'serviços', quote.area > 0 ? `${quote.areaApprox ? '≈ ' : ''}${quote.area.toLocaleString('pt-BR')} m²` : ''].filter(Boolean).join(' • ')
  const infos = [
    { icon: 'pay' as const, label: 'Pagamento', text: quote.paymentTerms.trim() || PAYMENT_TERMS },
    { icon: 'calendar' as const, label: 'Prazos e cronograma', text: quote.schedule },
    { icon: 'folder' as const, label: 'Formatos de arquivos entregues', text: quote.files },
  ].filter((x) => x.text?.trim())

  const sub = quoteSubtotal(quote)
  const urgencyValue = quote.urgency ? (sub * s.urgencyFee) / 100 : 0
  const scopeDiscount = quote.discount + quote.items.reduce((acc, i) => acc + itemDiscount(i), 0)
  const scopeNote = quote.discountNote || [urgencyValue ? `inclui urgência de ${money(urgencyValue)}` : '', discountText(scopeDiscount)].filter(Boolean).join(' · ')

  return (
    <Sheet s={s} year={quote.createdAt.slice(0, 4)}>
      <Fields name={clientName} date={quote.createdAt} label="orçamento nº" value={quoteNumber(quote)} />
      <Title s={s} />
      {quote.mode === 'opcoes' ? (
        <section className="p-options">
          {quote.options.slice(0, 2).map((o, n) => {
            const disc = (o.discount || 0) + o.items.reduce((acc, i) => acc + itemDiscount(i), 0)
            return (
              <div key={o.id} className="p-option">
                <span className="p-option-label">opção {n + 1}</span>
                <div className="p-card">
                  <h3 className="p-card-title">{heading(o.name)}</h3>
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
            <Rows items={quote.items} />
            {quote.notes && <p className="p-note">{quote.notes}</p>}
          </div>
          <TotalBar label="investimento total" value={quoteTotal(quote, s.urgencyFee)} note={scopeNote} />
        </>
      )}
      {quote.mode === 'opcoes' && quote.notes && <p className="p-note is-outside">{quote.notes}</p>}
      {infos.length > 0 && <InfoRow items={infos} color={s.proposal.bar} />}
      <Contacts s={s} />
    </Sheet>
  )
}

export function ReceiptDoc({ s, client, project, payment }: { s: Settings; client?: Client; project: Project; payment: Payment }) {
  const payer = client?.company || client?.name || '—'
  const date = payment.paidDate ?? today()
  return (
    <Sheet s={s} year={date.slice(0, 4)}>
      <Fields name={payer} date={date} label="forma" value={payment.method || '—'} />
      <Title s={s} eyebrow="comprovante de" title="recibo" />
      <div className="p-card">
        <h3 className="p-card-title">{project.title}</h3>
        <p className="p-receipt">
          Recebi de <b>{payer}</b>
          {client?.document && <>, CPF/CNPJ {client.document}</>}, a importância de <b>{money(payment.amount)}</b> ({porExtenso(payment.amount)}), referente a{' '}
          {payment.description.toLowerCase()} do projeto <b>{project.title}</b>, dando plena quitação deste valor.
        </p>
        <p className="p-note">
          {s.city ? `${s.city}, ` : ''}
          {fmt(date)} · {s.legalName || s.ownerName}
          {s.document ? ` · CPF ${s.document}` : ''}
        </p>
      </div>
      <TotalBar label="valor recebido" value={payment.amount} />
      <Contacts s={s} />
    </Sheet>
  )
}
