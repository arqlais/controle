import { useState } from 'react'
import { useStore } from '../store'
import { Field, Modal, MoneyInput } from './ui'
import { Icon } from './Icon'
import { toast } from './dialog'
import { DocScale, usePdf } from './Print'
import { BillDoc, type BillCard, type BillInfo } from './Docs'
import { DocLookPanel } from './DocKit'
import type { Data, Project } from '../types'
import { money, projectPaid, projectTotal, quoteFiles, today, whatsappLink, lower } from '../utils'

/* Recibo de cobrança no modelo do estúdio ("recibo serviço"), igual para qualquer serviço:
   mostra o total, o que já foi pago e o que falta, com as condições de entrega.
   Sai em PDF ou PNG (para mandar direto no WhatsApp). */

// formatos de arquivo ganham destaque rosé: "arquivo final em **PNG**"
const highlight = (t: string) => t.replace(/\b(PNG|JPG|JPEG|PDF|DWG|SKP|SketchUp|sketchup)\b/g, '**$1**').replace(/\*\*\*\*/g, '')

/** "Arquivo em PDF…" → "arquivo em PDF…"; sem "arquivo" no começo, ganha "arquivo final: ". */
const deliveryLine = (files: string) => {
  const t = files.trim()
  if (!t) return 'arquivo final conforme combinado no orçamento'
  return /^arquivo/i.test(t) ? t[0].toLowerCase() + t.slice(1) : `arquivo final: ${t[0].toLowerCase()}${t.slice(1)}`
}

/** Monta o recibo a partir da demanda e do orçamento dela: serviços, forma de entrega e arquivo aberto. */
export function defaultBill(p: Project, d: Data): BillInfo {
  const quote = d.quotes.find((q) => q.projectId === p.id)
  const chosen = quote?.mode === 'opcoes' ? quote.options.find((o) => o.id === quote.chosenOption) : undefined
  const items = quote ? (chosen ? chosen.items : quote.mode === 'opcoes' ? quote.options.flatMap((o) => o.items) : quote.items) : []
  const ids = [...new Set([...items.map((i) => i.service), p.service].filter(Boolean))]
  const svc = (id: string) => d.settings.services.find((x) => x.id === id)
  const isRender = (id: string) => id.startsWith('render')
  const onlyModel = ids.length > 0 && ids.every((id) => id === 'modelagem')

  // entrega final: o que o orçamento diz (já considera arquivo aberto), senão o padrão de cada serviço
  const files = (quote ? quoteFiles(quote, d.settings.services) : '') || ids.map((id) => (quote?.openFile && svc(id)?.deliveryOpen) || svc(id)?.delivery).filter(Boolean).join(' · ')
  const cards: BillCard[] = [{ icon: 'folder', title: 'entrega final', text: highlight(deliveryLine(files)), on: true }]
  cards.push({ icon: 'edit', title: 'alterações futuras', text: 'não inclusas após a aprovação, feitas mediante **valor de reajuste.**', on: true })
  cards.push(
    onlyModel
      ? { icon: 'laptop', title: 'arquivo editável', text: 'incluso: modelo entregue em **arquivo aberto** (SketchUp).', on: true }
      : quote?.openFile
        ? { icon: 'laptop', title: 'arquivo editável', text: 'incluso: **arquivo aberto (editável)**, conforme combinado.', on: true }
        : { icon: 'laptop', title: 'arquivo editável', text: 'não incluso. somente se combinado previamente, mediante **valor de acréscimo.**', on: true },
  )
  // um quadro para cada tipo de serviço prestado
  if (ids.some(isRender)) cards.push({ icon: 'sparkle', title: 'pós-produção', text: 'arquivos finais já com tratamento e ajustes definitivos de cor, brilho e contraste.', on: true })
  if (ids.includes('modelagem')) cards.push({ icon: 'check', title: 'modelagem', text: 'modelo desenvolvido **fielmente** a partir da planta, do conceito e das referências enviadas.', on: true })
  if (ids.some((id) => id === 'executivo' || id === 'detalhamento')) cards.push({ icon: 'ruler', title: 'execução', text: 'as medidas devem ser **conferidas no local** pelo fornecedor responsável.', on: true })
  if (ids.some((id) => ['pranchas', 'diagramacao', 'mapas', 'diagramas', 'planta-hum'].includes(id)))
    cards.push({ icon: 'sparkle', title: 'finalização', text: 'arquivos finais em **alta resolução**, prontos para apresentação e impressão.', on: true })

  // título do quadro de valores: serviços do orçamento (ou o nome da demanda)
  const names = [...new Set(items.filter((i) => !i.joined).map((i) => [i.title || svc(i.service)?.name, i.detail].filter(Boolean).join(' · ')))].filter(Boolean)
  const single = ids.length === 1 && isRender(ids[0]) && p.quantity > 0 ? `${p.quantity} ${p.quantity === 1 ? 'imagem' : 'imagens'} · ${svc(ids[0])?.name ?? ''}` : ''
  const label = single || (names.length && names.length <= 2 ? names.join(' + ') : p.title) || svc(p.service)?.name || 'serviço'
  return { kind: 'servico', label, total: projectTotal(p), paid: projectPaid(p), cards }
}

export function BillModal({ p, onClose }: { p: Project; onClose: () => void }) {
  const { data } = useStore()
  const s = data.settings
  const client = data.clients.find((c) => c.id === p.clientId)
  const [info, setInfo] = useState<BillInfo>(() => defaultBill(p, data))
  const pdf = usePdf()
  const set = (patch: Partial<BillInfo>) => setInfo((x) => ({ ...x, ...patch }))
  const setCard = (i: number, patch: Partial<BillCard>) => set({ cards: info.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const rest = Math.max(0, info.total - info.paid)
  const doc = <BillDoc s={s} info={info} year={today().slice(0, 4)} />
  const file = `Recibo - ${p.title}`
  const first = client?.name.split(' ')[0] ?? ''
  const message = `Oi${first ? `, ${first}` : ''}! Segue o recibo de ${lower(p.title)}. ${rest > 0 ? `Fica em aberto ${money(rest)}.` : 'Tudo certo, pagamento concluído.'} Qualquer dúvida estou à disposição!`

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
          <DocLookPanel fold kind="recibo" />
        </div>
        <div className="bill-preview">
          <DocScale>{doc}</DocScale>
        </div>
      </div>
      {pdf.portal}
    </Modal>
  )
}
