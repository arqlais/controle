import { askGemini, type Msg } from './components/AIChat'
import { PLANS, PLATFORM, STATUS_LABEL } from './plans'
import { trialDaysLeft, type ChatMessage, type Subscription } from './platform'

/* Rascunho de resposta com IA para o chat da dona com quem usa o planê.
   Usa a chave do Gemini da própria dona (configurações → assistente); a resposta
   vem para a caixa de texto, ela lê, corrige e só então manda. */

export async function draftReply(o: { key: string; sub?: Subscription; msgs: ChatMessage[]; notes?: string }) {
  const { manualText } = await import('./pages/Manual')
  const s = o.sub
  const who = s
    ? `${s.name || 'cliente'}${s.studio ? ` (${s.studio})` : ''}, plano ${PLANS[s.plan].name}, ${STATUS_LABEL[s.status]}${s.status === 'trial' ? `, faltam ${Math.max(0, trialDaysLeft(s))} dia(s) de teste` : ''}`
    : 'uma pessoa que usa o sistema'
  const system = `Você escreve rascunhos de resposta para ${PLATFORM.owner}, criadora do ${PLATFORM.name} (${PLATFORM.tagline}), no chat de suporte com quem usa o sistema. ${PLATFORM.owner} vai ler, corrigir e mandar.

Quem está falando: ${who}.
Planos: ${Object.values(PLANS)
    .map((p) => `${p.name} R$ ${p.price.toFixed(2).replace('.', ',')}/mês (${p.pitch})`)
    .join('; ')}. Teste grátis, Pix ou cartão, sem fidelidade. Assinar: menu "minha assinatura".
Sugestões ficam no menu "sugestões"; depoimentos em "deixar depoimento"; o manual fica em "ajustes e dicas → manual".

Como o sistema funciona (manual):
${manualText()}

Regras da resposta:
- Português do Brasil, primeira pessoa, tom acolhedor e direto, como ${PLATFORM.owner} escreve: frases curtas, tudo em minúsculas (menos siglas e nomes como Pix, PDF, WhatsApp).
- Responda exatamente o que foi perguntado, em 2 a 6 frases. Se for passo a passo, use linhas "1.", "2.", "3.".
- Formatação: **negrito** para nomes de menus, abas e botões que a pessoa precisa tocar; _itálico_ para um destaque leve; __sublinhado__ só para um aviso importante (no máximo um). Não use títulos, tabelas nem outros símbolos.
- No máximo 1 ou 2 emojis, se combinar (ex.: ☺️ 💛 ✨).
- Se não souber ou for algo que o sistema não faz, diga com sinceridade e ofereça anotar como sugestão. Nunca invente função, preço ou prazo.
- Escreva só a mensagem, sem explicar o que fez.`
  // o Gemini quer a conversa alternando (pessoa, dona, pessoa…) e começando pela pessoa
  const history: Msg[] = []
  for (const m of o.msgs.slice(-20)) {
    const role = m.fromOwner ? 'model' : 'user'
    const prev = history[history.length - 1]
    if (prev?.role === role) prev.text += `\n\n${m.body}`
    else history.push({ role, text: m.body })
  }
  if (history[0]?.role === 'model') history.unshift({ role: 'user', text: '(início da conversa)' })
  // o Gemini precisa que a conversa termine com a pessoa
  const ask = `Escreva a próxima resposta de ${PLATFORM.owner} para esta conversa.${o.notes?.trim() ? ` Use estas anotações dela (o que ela quer dizer): ${o.notes.trim()}` : ''}`
  if (!history.length || history[history.length - 1].role === 'model') history.push({ role: 'user', text: ask })
  else history[history.length - 1] = { ...history[history.length - 1], text: `${history[history.length - 1].text}\n\n[${ask}]` }
  const out = await askGemini(o.key, system, history)
  return out
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-•]\s+/gm, '• ')
    .trim()
}
