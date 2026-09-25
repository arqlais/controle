import type { Client, Payment, Project, Quote, Settings } from '../types'
import { fmtDateLong, money, quoteSubtotal, quoteTotal, today, addDays } from '../utils'

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

function DocHeader({ s, title, sub }: { s: Settings; title: string; sub?: string }) {
  return (
    <header className="doc-head">
      <div>
        {s.logo ? <img src={s.logo} alt="" className="doc-logo" /> : <div className="doc-brand">{s.brandName}</div>}
        {s.tagline && <div className="doc-tag">{s.tagline}</div>}
      </div>
      <div className="doc-title">
        <h1>{title}</h1>
        {sub && <span>{sub}</span>}
      </div>
    </header>
  )
}

function DocFooter({ s }: { s: Settings }) {
  return (
    <footer className="doc-foot">
      {[s.ownerName, s.document && `CPF/CNPJ ${s.document}`, s.phone, s.email, s.website, s.instagram].filter(Boolean).join('  ·  ')}
    </footer>
  )
}

export function ReceiptDoc({ s, client, project, payment }: { s: Settings; client?: Client; project: Project; payment: Payment }) {
  return (
    <article className="doc">
      <DocHeader s={s} title="Recibo" sub={money(payment.amount)} />
      <p className="doc-text">
        Recebi de <b>{client?.company || client?.name || '—'}</b>
        {client?.document && <>, CPF/CNPJ {client.document}</>}, a importância de <b>{money(payment.amount)}</b> ({porExtenso(payment.amount)}), referente a{' '}
        <b>{payment.description.toLowerCase()}</b> do projeto <b>{project.title}</b>.
      </p>
      <p className="doc-text">
        Forma de pagamento: {payment.method || '—'} · Data do pagamento: {fmtDateLong(payment.paidDate ?? today())}
      </p>
      <p className="doc-text">Para maior clareza, firmo o presente recibo, dando plena quitação do valor acima.</p>
      <p className="doc-text right">
        {s.city ? `${s.city}, ` : ''}
        {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <div className="signature">
        <span />
        <div>{s.ownerName || s.brandName}</div>
        {s.document && <small>{s.document}</small>}
      </div>
      <DocFooter s={s} />
    </article>
  )
}

export function QuoteDoc({ s, client, quote }: { s: Settings; client?: Client; quote: Quote }) {
  const sub = quoteSubtotal(quote)
  const total = quoteTotal(quote, s.urgencyFee)
  const serviceName = (id: string) => s.services.find((x) => x.id === id)?.name ?? ''
  return (
    <article className="doc">
      <DocHeader s={s} title="Proposta" sub={`Nº ${String(quote.number).padStart(3, '0')} · ${fmtDateLong(quote.createdAt)}`} />
      <section className="doc-grid">
        <div>
          <small>Cliente</small>
          <b>{client?.name ?? '—'}</b>
          {client?.company && <span>{client.company}</span>}
        </div>
        <div>
          <small>Projeto</small>
          <b>{quote.title}</b>
        </div>
      </section>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Serviço</th>
            <th className="num">Qtd.</th>
            <th className="num">Unitário</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((i) => (
            <tr key={i.id}>
              <td>
                <b>{serviceName(i.service) || i.description}</b>
                {serviceName(i.service) && i.description && <div className="muted">{i.description}</div>}
              </td>
              <td className="num">{i.quantity}</td>
              <td className="num">{money(i.unitPrice)}</td>
              <td className="num">{money(i.quantity * i.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {(quote.urgency || quote.discount > 0) && (
            <tr>
              <td colSpan={3}>Subtotal</td>
              <td className="num">{money(sub)}</td>
            </tr>
          )}
          {quote.urgency && (
            <tr>
              <td colSpan={3}>Taxa de urgência ({s.urgencyFee}%)</td>
              <td className="num">{money((sub * s.urgencyFee) / 100)}</td>
            </tr>
          )}
          {quote.discount > 0 && (
            <tr>
              <td colSpan={3}>Desconto</td>
              <td className="num">− {money(quote.discount)}</td>
            </tr>
          )}
          <tr className="doc-total">
            <td colSpan={3}>Total</td>
            <td className="num">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
      <section className="doc-terms">
        <div>
          <small>Prazo de entrega</small>
          <b>{quote.deadlineDays} dias {quote.urgency ? '(urgente)' : 'úteis'}</b>
          <span>após aprovação e recebimento dos arquivos</span>
        </div>
        <div>
          <small>Revisões inclusas</small>
          <b>{quote.revisions}</b>
          <span>rodadas de ajustes</span>
        </div>
        <div>
          <small>Validade</small>
          <b>{fmtDateLong(addDays(quote.createdAt, quote.validityDays))}</b>
          <span>{quote.validityDays} dias</span>
        </div>
      </section>
      {quote.paymentTerms && (
        <p className="doc-text">
          <small>Pagamento</small>
          <br />
          {quote.paymentTerms}
          {s.pixKey && <> Chave Pix: {s.pixKey}.</>}
        </p>
      )}
      {quote.notes && <p className="doc-text pre">{quote.notes}</p>}
      <DocFooter s={s} />
    </article>
  )
}
