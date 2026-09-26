import { useState } from 'react'
import { useStore } from '../store'
import type { Data, Quote, QuoteItem } from '../types'
import { QUOTE_STATUS, money, quoteDeal, quoteFiles, quoteNumber } from '../utils'
import { Icon } from './Icon'
import { Modal } from './ui'
import { toast } from './dialog'

/* "Perguntar à IA" sem custo: monta um resumo com a tabela de preços, o histórico de
   orçamentos e o pedido do cliente, copia e abre o Claude para colar. */

const lines = (d: string, max = 8) =>
  d
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max)
    .join('; ')

const itemText = (i: QuoteItem) => `${i.title || 'serviço'}${i.detail ? ` (${i.detail})` : ''}: ${money(i.price)}${i.description.trim() ? ` — ${lines(i.description)}` : ''}`

function quoteLine(q: Quote, d: Data) {
  const c = d.clients.find((x) => x.id === q.clientId)
  const fee = d.settings.urgencyFee
  const area = q.area ? ` · ${q.areaApprox ? '≈' : ''}${q.area} m²` : ''
  const floors = (q.floors ?? 1) > 1 ? ` · ${q.floors} pavimentos` : ''
  const scope =
    q.mode === 'opcoes'
      ? q.options
          .slice(0, 2)
          .map((o, i) => `${q.combo ? 'proposta' : 'opção'} ${i + 1}${o.name ? ` "${o.name}"` : ''}: ${o.items.map(itemText).join(' + ')}`)
          .join(' | ') + (q.combo && q.comboDiscount ? ` | juntas com desconto de ${money(q.comboDiscount)}` : '')
      : q.items.map(itemText).join(' + ')
  const note = q.notes.trim() ? ` · obs: ${lines(q.notes, 3)}` : ''
  return `- ${quoteNumber(q)} · ${q.createdAt} · ${c?.name ?? 'cliente'} · "${q.title}"${area}${floors} · ${scope} · total ${money(quoteDeal(q, fee))} · ${QUOTE_STATUS[q.status].label.toLowerCase()}${note}`
}

export function buildAIPrompt(d: Data, request: string, current?: Quote) {
  const s = d.settings
  const services = s.services
    .map((x) => {
      const price =
        x.pricing === 'livre'
          ? 'valor livre'
          : x.pricing === 'm2'
            ? `${x.base ? `base ${money(x.base)} + ` : ''}${money(x.price)}/m² × complexidade`
            : x.pricing === 'pacote'
              ? `${money(x.price)}/${x.unit}; pacotes ${x.tiers.map((t) => `${t.qty} por ${money(t.price)}`).join(', ')}`
              : `${money(x.price)}/${x.unit}`
      const list = x.checklist?.filter((c) => c.trim()).length
        ? `\n    ${x.checklistTitle || 'itens'} (valor ${x.pricing === 'm2' ? 'por m²' : 'cada'}): ${x.checklist
            .filter((c) => c.trim())
            .map((c) => `${c} ${money(x.checklistPrices?.[c] ?? x.customRate ?? 0)}`)
            .join(', ')}`
        : ''
      return `- ${x.name}: ${price}${x.min ? `, mínimo ${money(x.min)}` : ''}${x.delivery ? `; entrega: ${x.delivery}` : ''}${list}`
    })
    .join('\n')
  const cx = Object.entries(s.complexity)
    .map(([k, v]) => `${k} ×${v}`)
    .join(', ')
  const history = [...d.quotes]
    .filter((q) => !current || q.id !== current.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 80)
    .map((q) => quoteLine(q, d))
    .join('\n')

  return `Você é minha assistente de orçamentos. Sou ${s.ownerName || s.legalName || 'freelancer'}, do estúdio "${s.brandName}" (${s.tagline || 'arquitetura: renderização, modelagem, executivo e detalhamento'}). Responda em português, de forma direta e organizada.

## O que o cliente pediu
${request.trim() || '(ainda não colei a mensagem — me pergunte o que precisa)'}
${current ? `\n## Orçamento que estou montando agora\n${quoteLine(current, d)}\nformatos de entrega: ${quoteFiles(current, s.services) || '—'}\n` : ''}
## Minha tabela de preços (configurada no meu sistema)
${services}
Complexidade: ${cx}. Pavimento a mais: +${s.floorFee ?? 50}% por pavimento. Arquivo aberto (editável): +${s.openFileFee ?? 30}% embutido no valor (não aparece na proposta). Urgência: +${s.urgencyFee}%. Estudante: -${s.studentDiscount}%.
Pagamento padrão: ${s.defaultPaymentTerms || '50% no aceite e 50% na entrega'}.

## Meus orçamentos anteriores (mais recentes primeiro — os de julho em diante refletem meus preços atuais)
${history || '(nenhum ainda)'}

## O que eu quero de você
1. Escopo sugerido: quais serviços e itens/plantas incluir, em tópicos curtos como eu escrevo nas propostas.
2. Valor sugerido, comparando com meus orçamentos parecidos (cite os números) e com a tabela; se fizer sentido, dê uma faixa e/ou 2 opções (básica e completa).
3. Perguntas que faltam fazer ao cliente antes de fechar o valor (área, pavimentos, arquivo aberto ou fechado, prazo, referências…).
4. Texto do "não inclui" no meu estilo.
5. Uma mensagem curta e simpática para eu mandar ao cliente no WhatsApp.
Se algo estiver ambíguo, diga o que você assumiu.`
}

export function AskAIButton({ quote, compact }: { quote?: Quote; compact?: boolean }) {
  const { data } = useStore()
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState('')
  const prompt = buildAIPrompt(data, request, quote)

  const send = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast('Copiado. No Claude, cole com Ctrl+V (ou segure e “colar” no celular) e envie.')
    } catch {
      toast('Não consegui copiar sozinho: selecione o texto do resumo e copie.')
      return
    }
    window.open('https://claude.ai/new', '_blank', 'noopener')
  }

  return (
    <>
      <button className={`btn ${compact ? 'small ' : ''}ghost`} onClick={() => setOpen(true)} title="Sugestões de escopo e valor com base no seu histórico">
        <Icon name="sparkle" size={compact ? 14 : 16} /> perguntar à <span className="keep-case">IA</span>
      </button>
      {open && (
        <Modal
          title="perguntar à IA"
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                fechar
              </button>
              <button className="btn primary" onClick={send}>
                <Icon name="copy" size={16} /> copiar e abrir o Claude
              </button>
            </>
          }
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            Cole o que o cliente pediu. O sistema junta sua tabela de preços, as plantas com valores e seus {data.quotes.length} orçamentos anteriores
            {quote ? ' (e o orçamento que você está montando)' : ''}, copia tudo e abre o Claude. Lá é só colar e enviar: sem custo, usando a sua conta do Claude.
          </p>
          <textarea
            className="ai-request"
            rows={7}
            autoFocus
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={'Ex.: "Oi! Preciso do executivo de um apartamento de 80 m², com elétrica, hidráulica, forro e marcenaria da cozinha. Quanto fica?"'}
          />
          <details className="ai-preview">
            <summary>ver o resumo que vai ser enviado ({Math.round(prompt.length / 1000)} mil caracteres)</summary>
            <pre>{prompt}</pre>
          </details>
        </Modal>
      )}
    </>
  )
}
