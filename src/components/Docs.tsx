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

/** Proposta simples e funcional: cliente, data, nº, escopo com valores,
 *  pagamento, prazo e arquivos. Serve para valor único ou 2 opções. */
export function QuoteDoc({ s, client, quote }: { s: Settings; client?: Client; quote: Quote }) {
  const clientName = quote.clientLabel.trim() || client?.name || '[nome do cliente]'
  const total = quoteTotal(quote, s.urgencyFee)
  const sub = quoteSubtotal(quote)
  const urgencyValue = quote.urgency ? (sub * s.urgencyFee) / 100 : 0
  const two = quote.mode === 'opcoes'
  const options = quote.options.slice(0, 2)
  const totalDiscount = two ? 0 : quote.discount + quote.items.reduce((acc, i) => acc + itemDiscount(i), 0)
  const note =
    quote.discountNote ||
    [urgencyValue ? `inclui taxa de urgência de ${money(urgencyValue)}` : '', totalDiscount ? `com ${money(totalDiscount)} de desconto` : ''].filter(Boolean).join(' · ')
  const revisions = `${plural(quote.revisions, 'rodada', 'rodadas')} de ajuste inclusa${quote.revisions === 1 ? '' : 's'}`
  const contact = [s.pixKey && `pix ${s.pixKey}`, s.legalName || s.ownerName, s.phone, s.instagram].filter(Boolean).join(' · ')

  return (
    <Paper s={s}>
      <header className="q-top">
        {s.logo ? (
          <img src={s.logo} alt="" className="p-logo-img" />
        ) : (
          <div className="p-logo">
            <ArchIcon color={s.proposal.ink} dot={s.proposal.rose} />
            <span>
              {s.brandName.replace(/\.$/, '')}
              <i>.</i>
            </span>
          </div>
        )}
        <h1 className="q-title">{s.proposal.title}</h1>
      </header>

      <section className="q-info">
        <div>
          <span className="p-label">cliente</span>
          <b>{clientName}</b>
        </div>
        <div>
          <span className="p-label">data</span>
          <b>{fmt(quote.createdAt)}</b>
        </div>
        <div>
          <span className="p-label">orçamento nº</span>
          <b>{quoteNumber(quote)}</b>
        </div>
      </section>

      {two ? (
        <section className="q-options">
          {options.map((o, i) => (
            <div key={o.id} className="q-option">
              <span className="p-label">opção {i + 1}</span>
              <h2>{o.name || '[nome da opção]'}</h2>
              <ul>
                {o.included.filter(Boolean).map((it, k) => (
                  <li key={k}>{it}</li>
                ))}
              </ul>
              <p className="q-small">prazo: {plural(o.deadlineDays, 'dia útil', 'dias úteis')}</p>
              <div className="q-option-total">
                <span className="p-label">valor</span>
                <b>{money(o.price)}</b>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section>
          <div className="q-head">
            <span className="p-label">escopo{quote.title ? ` · ${quote.title}` : ''}</span>
            <span className="p-label">valor</span>
          </div>
          {quote.items.map((it) => (
            <div key={it.id} className="q-row">
              <div>
                <b>
                  {it.title || 'serviço'}
                  {it.detail && <span> · {it.detail}</span>}
                </b>
                {it.description && <p className="q-small">{it.description}</p>}
              </div>
              <span className="q-price">{money(it.price)}</span>
            </div>
          ))}
          <div className="q-total">
            <div>
              <span className="p-label">total</span>
              {note && <p className="q-small">{note}</p>}
            </div>
            <b>{money(total)}</b>
          </div>
        </section>
      )}

      <section className="q-terms">
        <div>
          <span className="p-label">pagamento</span>
          <p>{quote.paymentTerms}</p>
        </div>
        <div>
          <span className="p-label">prazo</span>
          <p>{two ? `conforme a opção escolhida · ${revisions}.` : `${plural(quote.deadlineDays, 'dia útil', 'dias úteis')} após o sinal · ${revisions}.`}</p>
        </div>
        <div>
          <span className="p-label">arquivos</span>
          <p>{quote.files}</p>
        </div>
      </section>
      {quote.notes && <p className="p-notes">{quote.notes}</p>}

      <footer className="q-foot">
        <span>{contact}</span>
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
      </footer>
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
