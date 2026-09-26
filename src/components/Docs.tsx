import type { CSSProperties, ReactNode } from 'react'
import type { Client, Payment, Project, Quote, Settings } from '../types'
import { fmtDateLong, itemDiscount, money, quoteNumber, quoteSubtotal, quoteTotal, today } from '../utils'
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
   Documentos no design da proposta do Canva (A4):
   arco rosé, serifada nos títulos, Poppins no texto.
   Cores e textos vêm de Configurações → Modelo da proposta.
   ============================================================ */

const fmt = (s: string) => {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function ArchIcon({ size = 30, color, dot }: { size?: number; color: string; dot: string }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 26 30" fill="none" aria-hidden>
      <path d="M2 29V13a11 11 0 0 1 22 0v16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M1 29h24" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="13" cy="20" r="2" fill={dot} />
    </svg>
  )
}

function Paper({ s, children }: { s: Settings; children: ReactNode }) {
  const p = s.proposal
  const style = {
    '--p-ink': p.ink,
    '--p-rose': p.rose,
    '--p-arch': p.arch,
    '--p-paper': p.paper,
    '--p-serif': `'${p.serif}', 'Cormorant Garamond', Georgia, serif`,
  } as CSSProperties
  return (
    <article className="proposal" style={style}>
      {children}
    </article>
  )
}

function Brand({ s, right }: { s: Settings; right: string }) {
  const p = s.proposal
  return (
    <header className="p-top">
      {s.logo ? (
        <img src={s.logo} alt="" className="p-logo-img" />
      ) : (
        <div className="p-logo">
          <ArchIcon color={p.ink} dot={p.rose} />
          <span>
            {s.brandName.replace(/\.$/, '')}
            <i>.</i>
          </span>
        </div>
      )}
      <span className="p-number">{right}</span>
    </header>
  )
}

function Footer({ s, sign }: { s: Settings; sign?: ReactNode }) {
  const line1 = [s.pixKey && `pix ${s.pixKey}`, s.legalName || s.ownerName].filter(Boolean).join(' · ')
  const line2 = [s.phone, s.instagram, s.website.replace(/^https?:\/\/(www\.)?/, '')].filter(Boolean).join(' · ')
  return (
    <footer className="p-foot">
      <div className="p-contact">
        <ArchIcon size={20} color={s.proposal.rose} dot={s.proposal.ink} />
        <div>
          {line1 && <div>{line1}</div>}
          {line2 && <div>{line2}</div>}
        </div>
      </div>
      {sign}
    </footer>
  )
}

function Info({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="p-info">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function QuoteDoc({ s, client, quote }: { s: Settings; client?: Client; quote: Quote }) {
  const p = s.proposal
  const clientName = quote.clientLabel.trim() || client?.name || '[nome do cliente]'
  const total = quoteTotal(quote, s.urgencyFee)
  const sub = quoteSubtotal(quote)
  const urgencyValue = quote.urgency ? (sub * s.urgencyFee) / 100 : 0
  const totalDiscount = quote.mode === 'opcoes' ? 0 : quote.discount + quote.items.reduce((acc, i) => acc + itemDiscount(i), 0)
  const discountLine =
    quote.discountNote ||
    [urgencyValue ? `inclui taxa de urgência de ${money(urgencyValue)}` : '', totalDiscount ? `com ${money(totalDiscount)} de desconto` : ''].filter(Boolean).join(' · ')
  const two = quote.mode === 'opcoes'
  const options = quote.options.slice(0, 2)
  const rows: [string, string][] = [
    ['projeto', quote.title || '[nome do projeto]'],
    ...(quote.area > 0 ? [['área', `${quote.area.toLocaleString('pt-BR')} m²`] as [string, string]] : []),
    ['data', fmt(quote.createdAt)],
    ['validade', plural(quote.validityDays, 'dia', 'dias')],
  ]

  return (
    <Paper s={s}>
      <Brand s={s} right={`Nº ${quoteNumber(quote)}`} />

      <section className={`p-hero ${two ? 'is-options' : ''}`}>
        <div className="p-hero-text">
          <p className="p-eyebrow">{p.eyebrow}</p>
          <h1 className="p-title">{p.title}</h1>
          <p className="p-for">para {clientName}</p>
          <Info rows={rows} />
        </div>
        {p.showArch && (
          <div className="p-arch">
            <span className="p-dot" />
            {two ? (
              <>
                <b className="p-arch-num">{options.length || 2}</b>
                <em>
                  opções para
                  <br />
                  você escolher
                </em>
              </>
            ) : (
              <>
                <span className="p-label">investimento total</span>
                <b className="p-arch-price">{money(total)}</b>
                {discountLine && <span className="p-arch-note">{discountLine}</span>}
              </>
            )}
          </div>
        )}
      </section>

      {two ? (
        <section className="p-options">
          {options.map((o, i) => (
            <div key={o.id} className="p-option">
              <div className="p-option-head">
                <span className={`p-badge ${i ? 'is-light' : ''}`}>{i + 1}</span>
                <div>
                  <span className="p-label">opção {i + 1}</span>
                  <h3>{o.name || '[nome do escopo]'}</h3>
                </div>
              </div>
              {o.summary && <p className="p-muted">{o.summary}</p>}
              <ul className="p-list">
                {o.included.filter(Boolean).map((it, k) => (
                  <li key={k}>{it}</li>
                ))}
              </ul>
              <p className="p-muted">prazo: {plural(o.deadlineDays, 'dia útil', 'dias úteis')}</p>
              <span className="p-label p-label-dot">investimento</span>
              <b className="p-option-price">{money(o.price)}</b>
            </div>
          ))}
        </section>
      ) : (
        <section className="p-scope">
          <div className="p-scope-head">
            <span className="p-label">escopo</span>
            <span className="p-label is-muted">valor</span>
          </div>
          {quote.items.map((it, i) => (
            <div key={it.id} className="p-scope-row">
              <span className="p-scope-n">{String(i + 1).padStart(2, '0')}</span>
              <div className="p-scope-main">
                <b>
                  {it.title || 'serviço'}
                  {it.detail && <span> · {it.detail}</span>}
                </b>
                {it.description && <p className="p-muted">{it.description}</p>}
              </div>
              <span className="p-scope-price">{money(it.price)}</span>
            </div>
          ))}
          {p.showArch === false && (
            <div className="p-scope-total">
              <span className="p-label">investimento</span>
              <b>{money(total)}</b>
              {discountLine && <span className="p-muted">{discountLine}</span>}
            </div>
          )}
        </section>
      )}

      <section className="p-terms">
        <div>
          <span className="p-label">pagamento</span>
          <p>{quote.paymentTerms}</p>
        </div>
        <div>
          <span className="p-label">arquivos entregues</span>
          <p>{quote.files}</p>
        </div>
        <div>
          <span className="p-label">{two ? 'ajustes' : 'prazo'}</span>
          <p>
            {two
              ? `${plural(quote.revisions, 'rodada', 'rodadas')} de ajuste inclusa${quote.revisions === 1 ? '' : 's'} em qualquer uma das opções.`
              : `${plural(quote.deadlineDays, 'dia útil', 'dias úteis')} após o sinal, com ${plural(quote.revisions, 'rodada', 'rodadas')} de ajuste inclusa${quote.revisions === 1 ? '' : 's'}.`}
          </p>
        </div>
      </section>
      {quote.notes && <p className="p-notes">{quote.notes}</p>}

      <Footer
        s={s}
        sign={
          <div className="p-sign">
            {two && (
              <div className="p-choice">
                opção escolhida:
                {options.map((o, i) => (
                  <span key={o.id}>
                    <i className={quote.chosenOption === o.id ? 'on' : ''} /> {i + 1}
                  </span>
                ))}
              </div>
            )}
            <span className="p-sign-line" />
            <span>de acordo · {clientName}</span>
          </div>
        }
      />
    </Paper>
  )
}

export function ReceiptDoc({ s, client, project, payment }: { s: Settings; client?: Client; project: Project; payment: Payment }) {
  const payer = client?.company || client?.name || '—'
  return (
    <Paper s={s}>
      <Brand s={s} right={fmt(payment.paidDate ?? today())} />
      <section className="p-hero">
        <div className="p-hero-text">
          <p className="p-eyebrow">comprovante de pagamento</p>
          <h1 className="p-title">recibo</h1>
          <p className="p-for">de {payer}</p>
          <Info
            rows={[
              ['projeto', project.title],
              ['referente a', payment.description.toLowerCase()],
              ['forma', payment.method || '—'],
            ]}
          />
        </div>
        {s.proposal.showArch && (
          <div className="p-arch">
            <span className="p-dot" />
            <span className="p-label">valor recebido</span>
            <b className="p-arch-price">{money(payment.amount)}</b>
          </div>
        )}
      </section>
      <section className="p-receipt">
        <p>
          Recebi de <b>{payer}</b>
          {client?.document && <>, CPF/CNPJ {client.document}</>}, a importância de <b>{money(payment.amount)}</b> ({porExtenso(payment.amount)}), referente a{' '}
          {payment.description.toLowerCase()} do projeto <b>{project.title}</b>, dando plena quitação deste valor.
        </p>
        <p className="p-muted">
          {s.city ? `${s.city}, ` : ''}
          {fmtDateLong(payment.paidDate ?? today())}
        </p>
      </section>
      <Footer
        s={s}
        sign={
          <div className="p-sign">
            <span className="p-sign-line" />
            <span>
              {s.legalName || s.ownerName}
              {s.document ? ` · CPF ${s.document}` : ''}
            </span>
          </div>
        }
      />
    </Paper>
  )
}
