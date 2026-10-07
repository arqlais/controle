import { useState } from 'react'
import { useAccess } from '../access'
import { useStore } from '../store'
import type { Data, Quote, QuoteItem, ServiceDef } from '../types'
import { QUOTE_STATUS, hasAreaTiers, money, nextQuoteNumber, quoteDeal, quoteFiles, quoteNumber, sortedTiers, withPartner } from '../utils'
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

const itemText = (i: QuoteItem, max = 8) => `${i.title || 'serviço'}${i.detail ? ` (${i.detail})` : ''}: ${money(i.price)}${i.description.trim() && max ? ` — ${lines(i.description, max)}` : ''}`

function quoteLine(q: Quote, d: Data, names = true, max = 8) {
  const c = names ? d.clients.find((x) => x.id === q.clientId) : undefined
  const fee = d.settings.urgencyFee
  const area = q.area ? ` · ${q.areaApprox ? '≈' : ''}${q.area} m²` : ''
  const floors = (q.floors ?? 1) > 1 ? ` · ${q.floors} pavimentos` : ''
  const scope =
    q.mode === 'opcoes'
      ? q.options
          .slice(0, 3)
          .map((o, i) => `${q.combo ? 'proposta' : 'opção'} ${i + 1}${o.name ? ` "${o.name}"` : ''}${o.area ? ` (${o.areaApprox ? '≈' : ''}${o.area} m²${(o.floors ?? 1) > 1 ? `, ${o.floors} pav.` : ''})` : ''}: ${o.items.map((it) => itemText(it, max)).join(' + ')}`)
          .join(' | ') + (q.combo && q.comboDiscount ? ` | juntas com desconto de ${money(q.comboDiscount)}` : '')
      : q.items.map((it) => itemText(it, max)).join(' + ')
  const note = q.notes.trim() && max ? ` · obs: ${lines(q.notes, Math.min(3, max))}` : ''
  return `- ${quoteNumber(q)} · ${q.createdAt} · ${c?.name ?? 'cliente'} · "${q.title}"${area}${floors} · ${scope} · total ${money(quoteDeal(q, fee))} · ${QUOTE_STATUS[q.status].label.toLowerCase()}${note}`
}

/** Como o estúdio trabalha: o que a IA precisa saber para responder do seu jeito. */
export function processBriefing(d: Data) {
  const s = d.settings
  return `## Como eu trabalho (meu processo)
- Sou freelancer e atendo principalmente arquitetos(as), designers, escritórios e construtoras. Serviços: renderização (V-Ray e por IA), modelagem 3D no SketchUp, projeto executivo, detalhamento (marcenaria, marmoraria, serralheria…), e às vezes arquitetônico, interiores, levantamento e quantitativos (valor livre).
- Fluxo: o cliente pede → eu pergunto o que falta (área, quais plantas ou detalhamentos, pavimentos, arquivo aberto ou fechado, prazo, referências) → monto o orçamento com escopo em tópicos curtos + "não inclui" + formatos de entrega → envio a proposta em PDF → negociamos → ao fechar, crio a demanda.
- Pagamento: ${s.defaultPaymentTerms || '50% de sinal no aceite e 50% na entrega'}. O saldo vence quando a demanda é concluída.
- Prazo: combinado com cada cliente (dias úteis, corridos ou data), não vai na proposta.
- Rodadas de ajuste incluídas: ${s.defaultRevisions}.
- Às vezes mando 2 ou 3 opções (ex.: básica e completa) ou 2–3 propostas (projetos diferentes) com desconto se fechar todas juntas. Serviços podem ser cobrados juntos (um valor só).
- Executivo e detalhamento: valor base do projeto + soma das plantas/itens escolhidos × m² × complexidade. Os valores não crescem na proporção da área: projetos pequenos ficam perto do valor base.
- Cada pavimento a mais encarece (+${s.floorFee ?? 50}% por pavimento nos serviços marcados). Arquivo aberto (editável) soma +${s.openFileFee ?? 30}% embutido, sem citar na proposta — a proposta só diz como será entregue.
- Modelagem de áreas muito grandes (loteamentos, complexos) não segue o m²: é por escopo.
- Numeração contínua: o próximo orçamento é o #${String(nextQuoteNumber(d)).padStart(3, '0')}.
- Uma mesma cliente pode pedir várias demandas de uma vez (ex.: 3 projetos diferentes): viram UM orçamento com cada projeto como um serviço separado (título do projeto + escopo em tópicos + valor) e o total no fim; se fizer sentido, um desconto por fechar tudo junto.
- Renderização: por IA é mais barata e rápida; V-Ray é a de maior qualidade. Imagens em pacotes (5, 10, 15). Valor de imagem segue SEMPRE a minha tabela (avulso e pacotes, abaixo), nunca os orçamentos antigos; pavimentos não mudam o valor da imagem.
- O +${s.openFileFee ?? 30}% de arquivo aberto só vale para executivo e detalhamento (entregues em PDF). Modelagem já é entregue com o SketchUp aberto: não soma nada.
- Nunca invente números de orçamentos: cite apenas os que estão na lista de orçamentos anteriores abaixo.${s.services.some((x) => x.noteHints?.some((h) => h.trim())) ? `
- Observações que costumo pôr no quadro da proposta (use as que servirem): ${s.services.filter((x) => x.noteHints?.some((h) => h.trim())).map((x) => `${x.name}: ${x.noteHints!.filter((h) => h.trim()).join(' / ')}`).join(' | ')}. Em modelagem o cliente envia o dwg definido e todo o conceito é dele — eu só modelo; render precisa da modelagem completa.` : ''}${s.aiLowercase !== false ? `
- Estilo de escrita (obrigatório): escreva TUDO em letra minúscula — respostas, propostas, títulos, tópicos, mensagens para clientes e nomes de serviços —, sem nenhuma maiúscula, nem no início de frases ou em nomes. A única exceção é o símbolo de dinheiro: sempre "R$" com R maiúsculo (ex.: R$ 1.200,00).` : ''}${s.aiNotes?.trim() ? `

## Minhas regras (escritas por mim)
${s.aiNotes.trim()}` : ''}`
}

export function buildAIPrompt(d: Data, request: string, current?: Quote, names = true, mode: 'copiar' | 'chat' = 'copiar', limit = 80, max = 8) {
  // orçamento de um parceiro com tabela de parceria: a tabela que vale é a combinada com ele
  const curClient = current ? d.clients.find((c) => c.id === current.clientId) : undefined
  const s = withPartner(d.settings, curClient)
  const r2 = (n: number) => Math.round(n * 100) / 100
  const describe = (x: ServiceDef) => {
      const price =
        x.pricing === 'livre'
          ? 'valor livre'
          : hasAreaTiers(x)
            ? `por faixa de área (R$/m² para complexidade média): ${sortedTiers(x.areaTiers).filter((t) => t.price > 0).map((t, i, all) => `${t.upTo ? `até ${t.upTo} m²` : `acima de ${all[i - 1]?.upTo ?? 0} m²`} ${money(t.price)}`).join('; ')}${x.base ? ` + base ${money(x.base)}` : ''} × complexidade (simples ${r2((s.complexity.simples ?? 1) / (s.complexity.media || 1))}, média 1, alta ${r2((s.complexity.alta ?? 1) / (s.complexity.media || 1))})${x.checklistPrices && Object.keys(x.checklistPrices).length ? ' × soma dos pesos das plantas escolhidas ÷ 100' : ''}`
          : x.pricing === 'm2'
            ? `${x.base ? `base ${money(x.base)} + ` : ''}${money(x.price)}/m² × complexidade`
            : x.pricing === 'pacote'
              ? `${money(x.price)}/${x.unit}; pacotes ${x.tiers.map((t) => `${t.qty} por ${money(t.price)}`).join(', ')}`
              : `${money(x.price)}/${x.unit}`
      const list = x.checklist?.filter((c) => c.trim()).length
        ? hasAreaTiers(x)
          ? `\n    ${x.checklistTitle || 'plantas'} (peso %, o conjunto completo soma 100): ${x.checklist.filter((c) => c.trim()).map((c) => `${c} ${x.checklistPrices?.[c] ?? x.customRate ?? 0}%`).join(', ')}`
          : `\n    ${x.checklistTitle || 'itens'} (valor ${x.pricing === 'm2' ? 'por m²' : 'cada'}): ${x.checklist
            .filter((c) => c.trim())
            .map((c) => `${c} ${money(x.checklistPrices?.[c] ?? x.customRate ?? 0)}`)
            .join(', ')}`
        : ''
      return `- ${x.name} [id: ${x.id}]: ${price}${x.min ? `, mínimo ${money(x.min)}` : ''}${x.delivery ? `; entrega: ${x.delivery}` : ''}${list}`
  }
  const services = s.services.map(describe).join('\n')
  // tabelas de parceria combinadas com escritórios parceiros (valores especiais só para eles)
  const partners = d.clients
    .filter((c) => c.partner?.on && Object.keys(c.partner.services).length && c.id !== curClient?.id)
    .map((c, i) => `### ${names ? c.name : `parceiro ${i + 1}`}\n${withPartner(d.settings, c).services.filter((x) => c.partner!.services[x.id]).map(describe).join('\n')}`)
    .join('\n')
  const cx = Object.entries(s.complexity)
    .map(([k, v]) => `${k} ×${v}`)
    .join(', ')
  const history = [...d.quotes]
    .filter((q) => !current || q.id !== current.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((q) => quoteLine(q, d, names, max))
    .join('\n')

  const intro = `Você é minha assistente de orçamentos. Sou ${s.ownerName || s.legalName || 'freelancer'}, do estúdio "${s.brandName}" (${s.tagline || 'arquitetura: renderização, modelagem, executivo e detalhamento'}). Responda em português, de forma direta e organizada.`
  const studio = `${current ? `## Orçamento que estou montando agora\n${quoteLine(current, d, names)}\nformatos de entrega: ${quoteFiles(current, s.services) || '—'}\n\n` : ''}${processBriefing(d)}

## Minha tabela de preços (configurada no meu sistema)${curClient?.partner?.on ? ` — valores de PARCERIA combinados com ${names ? curClient.name : 'este cliente'}` : ''}
${services}${partners ? `\n\n## Tabelas de parceria (valores especiais combinados com escritórios parceiros: use a do parceiro quando o pedido for dele)\n${partners}` : ''}

## Como calcular executivo, modelagem e detalhamento
- Serviços por faixa de área: pegue o R$/m² da faixa em que a área cai × a área × a complexidade × (soma dos pesos das plantas pedidas ÷ 100). Projeto completo = 100%.
- Complexidade: simples (poucos ambientes, planta retangular, pouco detalhe), média (o comum), alta (muitos ambientes, curvas, muita marcenaria, vários pavimentos, prazo curto).
- Detalhamento: por peça (marcenaria, marmoraria, serralheria…) ou por ambiente (banheiro, cozinha, sala…): conte quantas peças/ambientes.
- Se eu mandar a planta ou o PDF do cliente: leia a planta, estime a área (cotas ou escala), conte ambientes e peças a detalhar, diga quais plantas serão necessárias e o nível de detalhe, e mostre a conta. Se não der para ler alguma medida, diga o que assumiu.
Complexidade: ${cx}. Pavimento a mais: +${s.floorFee ?? 50}% por pavimento. Arquivo aberto (editável): +${s.openFileFee ?? 30}% embutido no valor (não aparece na proposta). Urgência: +${s.urgencyFee}%. Estudante: -${s.studentDiscount}%.

## Meus orçamentos anteriores (mais recentes primeiro — os de julho em diante refletem meus preços atuais)${names ? '' : ' (nomes de clientes omitidos)'}
${history || '(nenhum ainda)'}`
  const wants = `1. Escopo sugerido: quais serviços e itens/plantas incluir, em tópicos curtos como eu escrevo nas propostas.
2. Valor sugerido, comparando com meus orçamentos parecidos (cite os números) e com a tabela; se fizer sentido, dê uma faixa e/ou 2 opções (básica e completa).
3. Perguntas que faltam fazer ao cliente antes de fechar o valor (área, pavimentos, arquivo aberto ou fechado, prazo, referências…).
4. Texto do "não inclui" no meu estilo.
5. Uma mensagem curta e simpática para eu mandar ao cliente no WhatsApp.
Se algo estiver ambíguo, diga o que você assumiu.${s.aiLowercase !== false ? '\nLembrete de estilo: escreva tudo em letra minúscula (inclusive títulos e a mensagem para o cliente); só o "R$" fica com R maiúsculo.' : ''}`
  const block = `\n\n## Sugestão pronta para o sistema (obrigatório quando houver valor ou escopo)
Sempre que você sugerir valor e/ou escopo de um orçamento, termine a resposta com UM bloco assim (eu toco num botão e ele vira um orçamento no meu sistema, onde eu edito tudo). Use os ids da minha tabela em "servico" (ou "" para serviço personalizado), valores em número (sem R$), e "publico" = "final" (cliente final, dono do imóvel) ou "parceiro" (terceirização para outro escritório), ou "" se não souber:
\`\`\`orcamento
{"titulo": "renderização casa pampulha", "publico": "parceiro", "area": 0, "itens": [{"servico": "render-vray", "titulo": "renderização V-Ray", "detalhe": "5 imagens", "descricao": "living e jantar\\nfachada", "quantidade": 5, "valor": 1850}], "prazoDias": 10, "pagamento": "50% no aceite e 50% na entrega", "observacoes": "não inclui modelagem do terreno"}
\`\`\`
Organização: cada serviço é um item separado (ex.: modelagem, renderização e planta humanizada = 3 itens), nunca junte serviços diferentes num item só. Em "detalhe" vai a quantidade curta (ex.: "5 imagens", "80 m²"); em "descricao", o que está incluso, um tópico por linha (separe com \\n). "valor" é o total daquele item. Na resposta em texto, também liste cada serviço separado, com o valor de cada um e o total no fim.
Se sugerir duas opções (básica e completa), mande o bloco da opção que você recomenda. Não comente o bloco no texto.`
  if (mode === 'chat')
    return `${intro}\n\n${studio}\n\n## Como responder no chat\nConverse comigo sobre orçamentos, preços, escopo e clientes usando as informações acima. Seja breve e prático; use tópicos curtos. Quando eu colar o pedido de um cliente, responda com:\n${wants}${block}`
  return `${intro}

## O que o cliente pediu
${request.trim() || '(ainda não colei a mensagem — me pergunte o que precisa)'}

${studio}

## O que eu quero de você
${wants}`
}

/** Link que abre o Claude já com a pergunta escrita (o histórico é resumido para caber no link). */
export function claudeLink(d: Data, request: string, current?: Quote, names = true, extra = '') {
  // o link tem limite de tamanho: os orçamentos anteriores nunca saem (no mínimo 20 resumidos);
  // se a conversa for longa, vão só as mensagens mais recentes (o texto completo fica copiado)
  const LIMIT = 14000
  const enc = (t: string) => encodeURIComponent(t).length
  for (const [limit, max] of [[80, 8], [60, 4], [40, 2], [30, 0], [20, 0]] as const) {
    const base = buildAIPrompt(d, request, current, names, 'copiar', limit, max)
    if (enc(base + extra) <= LIMIT) return `https://claude.ai/new?q=${encodeURIComponent(base + extra)}`
    if (limit === 20) {
      let convo = extra
      while (convo && enc(base + convo) > LIMIT) convo = convo.slice(Math.ceil(convo.length * 0.2))
      const cut = convo && convo !== extra ? `\n\n## Nossa conversa (só o final; o resto eu colo se precisar)\n…${convo}` : convo
      return `https://claude.ai/new?q=${encodeURIComponent(base + cut)}`
    }
  }
  return 'https://claude.ai/new'
}

/** Só aparece para quem tem o assistente de IA no plano (a dona); clientes usam o chat com ela. */
export function AskAIButton(props: { quote?: Quote; compact?: boolean }) {
  const { has } = useAccess()
  return has('assistenteIA') ? <AskAIButtonInner {...props} /> : null
}

function AskAIButtonInner({ quote, compact }: { quote?: Quote; compact?: boolean }) {
  const { data } = useStore()
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState('')
  const prompt = buildAIPrompt(data, request, quote, !!data.settings.aiShareNames)

  const send = async () => {
    // cópia completa por garantia; a pergunta já vai escrita no Claude
    await navigator.clipboard?.writeText(prompt).catch(() => undefined)
    window.open(claudeLink(data, request, quote, !!data.settings.aiShareNames), '_blank', 'noopener')
    toast('Abrindo o Claude com a pergunta escrita: é só enviar. Se aparecer vazio, cole (Ctrl+V).')
  }

  return (
    <>
      <button className={`btn ${compact ? 'small ' : ''}ghost`} onClick={() => setOpen(true)} title="Sugestões de escopo e valor com base no seu histórico">
        <Icon name="sparkle" size={compact ? 14 : 16} />
        <span>
          perguntar à <span className="keep-case">IA</span>
        </span>
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
                <Icon name="sparkle" size={16} />
                <span>
                  abrir no <span className="keep-case">Claude</span>
                </span>
              </button>
            </>
          }
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            Cole o que o cliente pediu. O sistema junta sua tabela de preços, as plantas com valores e seus {data.quotes.length} orçamentos anteriores
            {quote ? ' (e o orçamento que você está montando)' : ''}, e abre o Claude com a pergunta já escrita: é só enviar. Sem custo, usando a sua conta do Claude.
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
