import { useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { useAccess } from '../access'
import { EMPTY_PAY, platform, type PayConfig } from '../platform'
import { PLANS, PLATFORM, type BillCycle, type PlanId } from '../plans'
import { pixPayload } from '../pix'
import { money } from '../utils'
import { Icon } from './Icon'
import { toast } from './dialog'

/* Pagar agora: Pix com QR Code e "copia e cola" já com o valor, e o link do cartão do plano.
   Nada passa por servidor: o dinheiro cai direto na conta da dona. */
export function PayNow({ plan, cycle, pixAmount, cardAmount, method }: { plan: PlanId; cycle: BillCycle; pixAmount: number; cardAmount: number; method?: 'pix' | 'cartao' }) {
  const { sub } = useAccess()
  const [cfg, setCfg] = useState<PayConfig | null>(null)
  const [sent, setSent] = useState(false)
  useEffect(() => {
    platform.payConfig().then(setCfg).catch(() => setCfg(EMPTY_PAY))
  }, [])
  const code = useMemo(() => (cfg?.pixKey ? pixPayload({ key: cfg.pixKey, name: cfg.pixName || PLATFORM.name, city: cfg.pixCity || 'BRASIL', amount: pixAmount, txid: `PLANE${(sub?.userId ?? '').replace(/-/g, '').slice(0, 10)}` }) : ''), [cfg, pixAmount, sub?.userId])
  const qr = useMemo(() => {
    if (!code) return ''
    const q = qrcode(0, 'M')
    q.addData(code)
    q.make()
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
  }, [code])
  if (!cfg) return null
  const link = cfg.cardLinks[`${plan}-${cycle}`] || ''
  const showPix = !!code && method !== 'cartao'
  const showCard = !!link && method !== 'pix'
  if (!showPix && !showCard)
    return (
      <p className="pf-note">
        <Icon name="chat" size={16} />
        <span>O {PLATFORM.support} te manda o Pix ou o link do cartão pelo chat em seguida.</span>
      </p>
    )
  const copy = () =>
    navigator.clipboard
      ?.writeText(code)
      .then(() => toast('Código Pix copiado. Cole no app do seu banco.'))
      .catch(() => toast('Selecione o código e copie.'))
  const paid = async () => {
    if (!sub) return
    const how = showPix && !showCard ? 'no Pix' : showCard && !showPix ? 'no cartão' : ''
    await platform.send(sub.userId, `já paguei o plano ${PLANS[plan].name} (${cycle})${how ? ` ${how}` : ''}. pode conferir?`, false).catch(() => undefined)
    setSent(true)
    toast('Aviso enviado. Sua conta é liberada assim que o pagamento for confirmado.')
  }
  return (
    <section className="paynow">
      {cfg.note && <p className="muted small paynow-note">{cfg.note}</p>}
      <div className={`paynow-grid ${showPix && showCard ? 'is-two' : ''}`}>
        {showPix && (
          <div className="paynow-box">
            <span className="paynow-head">
              <Icon name="wallet" size={16} /> Pix · <b>{money(pixAmount)}</b>
            </span>
            <span className="paynow-qr" dangerouslySetInnerHTML={{ __html: qr }} />
            <button type="button" className="btn primary block" onClick={copy}>
              <Icon name="copy" size={15} /> copiar código Pix
            </button>
            <small className="muted">Abra o app do banco → Pix → “copia e cola” (ou leia o QR Code). O valor já vem preenchido.</small>
          </div>
        )}
        {showCard && (
          <div className="paynow-box">
            <span className="paynow-head">
              <Icon name="lock" size={16} /> cartão de crédito · <b>{money(cardAmount)}</b>
            </span>
            <p className="muted small">Pagamento em ambiente seguro do Mercado Pago. Os dados do cartão nunca passam pelo {PLATFORM.name}.</p>
            <a className="btn primary block" href={link} target="_blank" rel="noreferrer">
              pagar no cartão <Icon name="chevronR" size={14} />
            </a>
          </div>
        )}
      </div>
      <button type="button" className="btn ghost block" disabled={sent} onClick={() => void paid()}>
        <Icon name="check" size={15} /> {sent ? 'aviso enviado' : 'já paguei, avisar'}
      </button>
    </section>
  )
}
