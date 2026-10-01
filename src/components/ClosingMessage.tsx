import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'
import { Field, Modal, MoneyInput } from './ui'
import { toast } from './dialog'
import { money, whatsappLink } from '../utils'
import type { Quote, QuoteItem } from '../types'

/* Mensagem de fechamento: quando o cliente diz que vai fechar, sai pronta com o valor negociado,
   a entrada e como fica o restante. O Pix vai numa mensagem separada, para copiar fácil no WhatsApp. */

const REST = 'restante feito no momento da aprovação final'

const itemLine = (i: QuoteItem) => {
  const detail = i.detail?.trim()
  return `💰 *${i.title.trim() || 'serviço'}${detail ? ` | ${detail}` : ''}:*`
}

export function closingText(q: Quote, value: number, pct: number, rest: string) {
  const items = q.items.filter((i) => i.title.trim() && !i.joined)
  const entry = Math.round(value * pct) / 100
  return [
    ...(q.title.trim() ? [`💰 ${q.title.trim()}:`] : []),
    ...items.map(itemLine),
    `- *valor total:* ${money(value)}`,
    ...(pct > 0 && pct < 100 ? [`- *entrada (${pct}%):* ${money(entry)}`] : []),
    '',
    rest.trim(),
  ]
    .join('\n')
    .trim()
}

export function ClosingMessage({ q, total, phone, onClose }: { q: Quote; total: number; phone?: string; onClose: () => void }) {
  const { data, setSettings } = useStore()
  const st = data.settings
  const fromTerms = Number(/(\d{1,3})\s*%/.exec(q.paymentTerms || st.defaultPaymentTerms || '')?.[1] ?? 50)
  const [value, setValue] = useState(q.closedValue || total)
  const [pct, setPct] = useState(fromTerms > 0 && fromTerms <= 100 ? fromTerms : 50)
  const [rest, setRest] = useState(st.closingRest ?? REST)
  const auto = useMemo(() => closingText(q, value, pct, rest), [q, value, pct, rest])
  const [text, setText] = useState<string | null>(null)
  const msg = text ?? auto
  const copy = (t: string, ok: string) =>
    navigator.clipboard?.writeText(t).then(
      () => toast(ok),
      () => toast('Selecione o texto e copie.'),
    )
  const remember = () => rest !== (st.closingRest ?? REST) && setSettings({ closingRest: rest })
  return (
    <Modal
      title="mensagem de fechamento"
      onClose={onClose}
      footer={
        <>
          {st.pixKey && (
            <button className="btn ghost" onClick={() => copy(st.pixKey, 'Chave Pix copiada. Mande numa mensagem separada.')}>
              <Icon name="copy" size={15} /> copiar Pix
            </button>
          )}
          <button className="btn ghost" onClick={() => (remember(), copy(msg, 'Mensagem copiada.'))}>
            <Icon name="copy" size={15} /> copiar mensagem
          </button>
          {phone && (
            <a className="btn primary" href={whatsappLink(phone, msg)} target="_blank" rel="noreferrer" onClick={remember}>
              <Icon name="whatsapp" size={15} /> mandar no WhatsApp
            </a>
          )}
        </>
      }
    >
      <p className="muted small">Sai com o valor negociado. Mude o que quiser: a mensagem se refaz sozinha (ou edite direto no texto).</p>
      <div className="form-grid two">
        <Field label="Valor negociado" hint={q.closedValue ? 'Valor fechado do orçamento.' : value !== total ? `Proposta: ${money(total)}` : 'Valor da proposta.'}>
          <MoneyInput value={value} onChange={(v) => (setValue(v), setText(null))} />
        </Field>
        <Field label="Entrada (%)" hint={pct > 0 && pct < 100 ? `${money(Math.round(value * pct) / 100)} agora` : 'Sem entrada: valor inteiro.'}>
          <input type="number" min={0} max={100} value={pct} onChange={(e) => (setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0))), setText(null))} />
        </Field>
        <Field label="Como fica o restante" span={2}>
          <input value={rest} onChange={(e) => (setRest(e.target.value), setText(null))} placeholder={REST} />
        </Field>
        <Field label="Mensagem" span={2}>
          <textarea className="closing-text" rows={8} value={msg} onChange={(e) => setText(e.target.value)} spellCheck lang="pt-BR" />
        </Field>
      </div>
      {!st.pixKey && (
        <p className="muted small">
          <Icon name="wallet" size={13} /> Coloque sua chave Pix em configurações → dados para aparecer o botão “copiar Pix”.
        </p>
      )}
    </Modal>
  )
}
