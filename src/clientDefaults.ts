import type { MessageTemplate, ServiceDef } from './types'

/* Pontos de partida de quem assina a plataforma. São genéricos de propósito
   (os valores, textos e o jeito de trabalhar da Laís são só dela): cada
   freelancer ajusta tudo em Configurações. */

/** Formas de receber que já vêm na lista (editável em Configurações → pagamentos). */
export const DEFAULT_PAYMENT_METHODS = ['Pix', 'Transferência', 'Cartão de crédito', 'Boleto', 'Dinheiro']

export const CLIENT_PAYMENT_TERMS = 'Pix ou transferência — 50% na aprovação + 50% na entrega'
export const CLIENT_SCHEDULE = 'até 10 dias úteis após a aprovação e o pagamento da entrada.'

export const CLIENT_SERVICES: ServiceDef[] = [
  { id: 'hora', name: 'hora de trabalho', unit: 'hora', pricing: 'hora', price: 60, min: 0, hours: 1, tiers: [] },
  { id: 'render-vray', name: 'imagem 3d (render)', unit: 'imagem', pricing: 'pacote', price: 120, min: 0, hours: 4, tiers: [{ qty: 5, price: 550 }] },
  { id: 'modelagem', name: 'modelagem 3d', unit: 'm²', pricing: 'm2', price: 3, base: 150, min: 300, hours: 0.08, tiers: [] },
  { id: 'projeto-interiores', name: 'projeto de interiores', unit: 'm²', pricing: 'm2', price: 40, base: 0, min: 1500, hours: 0.5, tiers: [] },
  { id: 'executivo', name: 'desenho técnico / executivo', unit: 'm²', pricing: 'm2', price: 6, base: 400, min: 0, hours: 0.12, tiers: [] },
  { id: 'planta-hum', name: 'planta humanizada', unit: 'planta', pricing: 'unidade', price: 250, min: 0, hours: 4, tiers: [] },
  { id: 'prancha', name: 'prancha de apresentação', unit: 'prancha', pricing: 'unidade', price: 150, min: 0, hours: 3, tiers: [] },
  { id: 'personalizado', name: 'serviço personalizado', unit: 'projeto', pricing: 'livre', price: 0, min: 0, hours: 0, tiers: [] },
]

export const CLIENT_MESSAGES: MessageTemplate[] = [
  { id: 'primeiro-contato', name: 'primeiro contato', text: 'Olá, {cliente}! Aqui é {meu_nome}, obrigado(a) pelo contato.\n\nMe conta um pouco do projeto: o que você precisa, o tamanho (metragem ou quantidade) e para quando. Assim já preparo o orçamento.' },
  { id: 'envio-orcamento', name: 'envio do orçamento', text: 'Olá, {cliente}! Segue a proposta {proposta} do projeto {projeto}, no valor de {valor}. Fico à disposição para qualquer dúvida ou ajuste.' },
  { id: 'retorno', name: 'cobrar resposta do orçamento', text: 'Olá, {cliente}, tudo bem? Passando para saber se conseguiu ver a proposta {proposta} ({projeto}). Se quiser ajustar algo, é só me falar.' },
  { id: 'aprovado', name: 'orçamento aprovado · pedir entrada', text: 'Que ótimo, {cliente}! Para começarmos, a entrada é de {valor_parcela} (pix: {pix}). Assim que confirmar, me envie os arquivos e as referências do projeto.' },
  { id: 'sinal-recebido', name: 'entrada recebida · início', text: 'Olá, {cliente}! Entrada recebida, obrigado(a). Já comecei o projeto {projeto} e a previsão de entrega é {prazo}.' },
  { id: 'previa', name: 'envio de prévia', text: 'Olá, {cliente}! Segue a prévia do projeto {projeto}. Dê uma olhada com calma e me diga se está tudo certo ou se prefere algum ajuste.' },
  { id: 'retorno-ajustes', name: 'cobrar retorno dos ajustes', text: 'Olá, {cliente}, tudo bem? Conseguiu ver os ajustes do projeto {projeto}? Fico no aguardo para seguirmos.' },
  { id: 'cobranca', name: 'lembrete de pagamento', text: 'Olá, {cliente}! Lembrete da parcela "{parcela}" do projeto {projeto}, de {valor_parcela}, com vencimento em {vencimento}. Pix: {pix}. Obrigado(a)!' },
  { id: 'cobranca-atraso', name: 'pagamento em atraso', text: 'Olá, {cliente}, tudo bem? A parcela "{parcela}" do projeto {projeto}, de {valor_parcela}, venceu em {vencimento}. Consegue verificar? Pix: {pix}.' },
  { id: 'entrega', name: 'entrega final', text: 'Olá, {cliente}! O projeto {projeto} está finalizado. Os arquivos estão aqui: {arquivos}\n\nFoi um prazer trabalhar com você!' },
  { id: 'depoimento', name: 'pedir depoimento / indicação', text: 'Olá, {cliente}! Espero que tenha gostado do resultado. Se puder deixar um depoimento rápido ou me indicar para alguém, me ajuda muito!' },
]
