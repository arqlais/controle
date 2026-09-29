/* Novidades da plataforma: aparecem para quem usa assim que abre o sistema depois de uma
   atualização. Cada uma pode ter um "me mostra" que leva até a tela e destaca onde tocar.
   A mais nova fica em cima. Ao lançar algo novo, é só acrescentar aqui. */

export type NewsKind = 'novo' | 'melhoria' | 'correcao'
export interface NewsStep {
  text: string
  page?: string // tela para abrir (ex.: 'orcamentos')
  id?: string // parte da tela (ex.: 'novo' em orcamentos/novo)
  target?: string // o que destacar na tela (seletor)
  configTab?: string // abre esta aba das configurações
}
export interface News {
  id: string
  date: string // AAAA-MM-DD
  kind: NewsKind
  title: string
  text: string
  steps?: NewsStep[]
}

export const NEWS_KIND: Record<NewsKind, { label: string; color: string }> = {
  novo: { label: 'novo', color: '#5e8c6a' },
  melhoria: { label: 'melhoria', color: '#6b8f94' },
  correcao: { label: 'correção', color: '#a88a80' },
}

export const NEWS: News[] = [
  {
    id: '2026-09-29-pacote-mensal',
    date: '2026-09-29',
    kind: 'novo',
    title: 'pacote ou parceria mensal',
    text: 'Cliente quer fechar vários serviços e pagar mês a mês? No orçamento, escolha em quantos meses divide. A proposta mostra o valor por mês e, ao aprovar, cada parcela entra no financeiro no mês certo.',
    steps: [
      { page: 'orcamentos', id: 'novo', target: '.q-months', text: 'Em “informações da proposta”, escolha em quantos meses o cliente vai pagar. Aparece na hora quanto fica por mês.' },
      { text: 'Dica: pacote fechado costuma ter 5% a 10% de desconto (botões ao lado do total). Ao aprovar, a demanda já nasce com uma parcela por mês, cada uma com a sua data.' },
    ],
  },
  {
    id: '2026-09-28-pix-cartao',
    date: '2026-09-28',
    kind: 'novo',
    title: 'Pix ou cartão ao receber',
    text: 'Ao marcar um pagamento como recebido, o sistema pergunta se foi Pix ou cartão. No cartão, a taxa da maquininha entra como despesa e você vê quanto recebe de verdade.',
    steps: [{ page: 'config', configTab: 'propostas', target: '.cfg-card-fee', text: 'Coloque aqui a taxa que a sua maquininha ou o Mercado Pago cobra no crédito. O financeiro usa ela para mostrar o seu lucro certinho.' }],
  },
  {
    id: '2026-09-28-orcamento-antigo',
    date: '2026-09-28',
    kind: 'novo',
    title: 'orçamento antigo, sem número',
    text: 'Tem clientes de antes do sistema? Lance como “orçamento antigo”: fica fora da numeração e o financeiro entra nas datas reais.',
    steps: [{ page: 'orcamentos', target: '#btn-orcamento-antigo', text: 'Toque aqui, preencha como um orçamento normal com a data real e depois marque como aprovado, escolhendo “tudo” em “o que já foi pago”.' }],
  },
  {
    id: '2026-09-29-excluir-topo',
    date: '2026-09-29',
    kind: 'correcao',
    title: 'excluir orçamento pelo topo',
    text: 'A lixeira agora fica também no alto do orçamento, e excluir funciona mesmo com alterações ainda não salvas.',
  },
]

/** Novidades que a pessoa ainda não viu. */
export const unseenNews = (seen?: string[]) => (seen ? NEWS.filter((n) => !seen.includes(n.id)) : [])
