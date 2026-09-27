import { useState } from 'react'
import { useStore } from '../store'
import { Field, Modal, MoneyInput, Segmented } from './ui'
import { Icon } from './Icon'
import { toast } from './dialog'
import { DocScale, usePdf } from './Print'
import { BillDoc, type BillCard, type BillInfo } from './Docs'
import type { Project } from '../types'
import { money, projectPaid, projectTotal, today, whatsappLink } from '../utils'

/* Recibo de cobrança no modelo do estúdio ("recibo serviço" / "imagens aprovadas!"):
   mostra o total, o que já foi pago e o que falta, com as condições de entrega.
   Sai em PDF ou PNG (para mandar direto no WhatsApp). */

// formatos de arquivo ganham destaque rosé: "arquivo final em **PNG**"
const highlight = (t: string) => t.replace(/\b(PNG|JPG|JPEG|PDF|DWG|SKP|SketchUp|sketchup)\b/g, '**$1**').replace(/\*\*\*\*/g, '')

export function defaultBill(p: Project, deliveryText: string, serviceName: string): BillInfo {
  const images = p.service.startsWith('render')
  const delivery = deliveryText.trim() ? `arquivo final: ${deliveryText.trim()}` : images ? 'arquivo final em PNG' : 'arquivo final em PDF, pronto para execução'
  const cards: BillCard[] = [
    { icon: 'folder', title: 'entrega final', text: highlight(delivery), on: true },
    { icon: 'edit', title: 'alterações futuras', text: 'não inclusas após a aprovação, feitas mediante **valor de reajuste.**', on: true },
    { icon: 'laptop', title: 'arquivo editável', text: 'não incluso. somente se combinado previamente, mediante **valor de acréscimo.**', on: true },
    images
      ? { icon: 'sparkle', title: 'pós-produção', text: 'arquivos finais já com tratamento e ajustes definitivos de cor, brilho e contraste.', on: true }
      : { icon: 'ruler', title: 'execução', text: 'as medidas devem ser **conferidas no local** pelo fornecedor responsável.', on: true },
  ]
  const label = images && p.quantity > 0 ? `${p.quantity} ${p.quantity === 1 ? 'imagem' : 'imagens'} · ${serviceName}` : p.title || serviceName
  return { kind: images ? 'imagens' : 'servico', label, total: projectTotal(p), paid: projectPaid(p), cards }
}

export function BillModal({ p, onClose }: { p: Project; onClose: () => void }) {
  const { data } = useStore()
  const s = data.settings
  const service = s.services.find((x) => x.id === p.service)
  const client = data.clients.find((c) => c.id === p.clientId)
  const [info, setInfo] = useState<BillInfo>(() => defaultBill(p, service?.delivery ?? '', service?.name ?? 'serviço'))
  const pdf = usePdf()
  const set = (patch: Partial<BillInfo>) => setInfo((x) => ({ ...x, ...patch }))
  const setCard = (i: number, patch: Partial<BillCard>) => set({ cards: info.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const rest = Math.max(0, info.total - info.paid)
  const doc = <BillDoc s={s} info={info} year={today().slice(0, 4)} />
  const file = `Recibo - ${p.title}`
  const first = client?.name.split(' ')[0] ?? ''
  const message = `Oi${first ? `, ${first}` : ''}! Segue o recibo de ${p.title.toLowerCase()}. ${rest > 0 ? `Fica em aberto ${money(rest)}.` : 'Tudo certo, pagamento concluído.'} Qualquer dúvida estou à disposição!`

  return (
    <Modal
      wide
      title="recibo de cobrança"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(message).then(() => toast('Mensagem copiada.'))}>
            <Icon name="copy" size={15} /> copiar mensagem
          </button>
          {client?.phone && (
            <a className="btn ghost" href={whatsappLink(client.phone, message)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={15} /> whatsapp
            </a>
          )}
          <button className="btn ghost" disabled={pdf.busy} onClick={() => pdf.downloadPng(doc, `${file}.png`)}>
            <Icon name="download" size={15} /> PNG
          </button>
          <button className="btn primary" disabled={pdf.busy} onClick={() => pdf.download(doc, `${file}.pdf`)}>
            <Icon name="download" size={15} /> PDF
          </button>
        </>
      }
    >
      <div className="bill-editor">
        <div className="bill-form">
          <Field group label="Modelo">
            <Segmented<BillInfo['kind']>
              value={info.kind}
              onChange={(kind) => set({ kind })}
              options={[
                { value: 'servico', label: 'recibo serviço' },
                { value: 'imagens', label: 'imagens aprovadas!' },
              ]}
            />
          </Field>
          <Field label="Título do quadro de valores">
            <input value={info.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <div className="form-grid">
            <Field label="Valor total">
              <MoneyInput value={info.total} onChange={(total) => set({ total })} />
            </Field>
            <Field label="Já pago" hint={`restante: ${money(rest)}`}>
              <MoneyInput value={info.paid} onChange={(paid) => set({ paid })} />
            </Field>
          </div>
          <div className="bill-form-cards">
            {info.cards.map((c, i) => (
              <div key={i} className={`bill-form-card ${c.on ? '' : 'is-off'}`}>
                <label className="check small">
                  <input type="checkbox" checked={c.on} onChange={(e) => setCard(i, { on: e.target.checked })} />
                  <input className="bill-form-title" value={c.title} onChange={(e) => setCard(i, { title: e.target.value })} aria-label="Título" />
                </label>
                <textarea rows={2} value={c.text} onChange={(e) => setCard(i, { text: e.target.value })} aria-label="Texto" />
              </div>
            ))}
            <p className="muted small">Palavras entre **asteriscos** ficam em destaque rosé.</p>
          </div>
        </div>
        <div className="bill-preview">
          <DocScale>{doc}</DocScale>
        </div>
      </div>
      {pdf.portal}
    </Modal>
  )
}
