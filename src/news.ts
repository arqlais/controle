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
    id: '2026-09-29-instagram-sugestao',
    date: '2026-09-29',
    kind: 'melhoria',
    title: 'planejar o mês do instagram do seu jeito',
    text: 'O “planejar mês” agora mostra a sugestão antes: você escolhe quais postagens quer e ajusta dia, formato e tema de cada uma. Só entra no calendário o que você confirmar.',
    steps: [{ page: 'instagram', text: 'Toque em “planejar mês”, marque as postagens que quer, ajuste o que precisar e toque em “adicionar ao calendário”.' }],
  },
  {
    id: '2026-09-29-cantos',
    date: '2026-09-29',
    kind: 'melhoria',
    title: 'cantos arredondados do seu jeito',
    text: 'A régua de cantos arredondados agora vale para tudo, aos poucos: botões, etiquetas e campos acompanham, do reto ao bem redondo.',
    steps: [{ page: 'config', configTab: 'aparencia', text: 'Em aparência, arraste “cantos arredondados” e veja tudo mudando junto.' }],
  },
  {
    id: '2026-09-29-encerrar-conta',
    date: '2026-09-29',
    kind: 'novo',
    title: 'desativar ou apagar a conta',
    text: 'Em minha assinatura, agora dá para desativar a conta (tudo fica guardado) ou apagar de vez, com a opção de baixar uma cópia antes.',
  },
  {
    id: '2026-09-29-seletor-cores',
    date: '2026-09-29',
    kind: 'melhoria',
    title: 'escolher cores ficou mais fácil',
    text: 'Nas cores do seu estúdio e da proposta, agora abre um seletor próprio: arraste para achar o tom, digite o código (HEX ou RGB) e reaproveite as cores que você usou por último.',
    steps: [{ page: 'config', configTab: 'aparencia', target: '.cp-swatch-btn', text: 'Toque na cor para abrir o seletor. As últimas cores escolhidas ficam guardadas em “recentes”.' }],
  },
  {
    id: '2026-09-29-status-no-quadro',
    date: '2026-09-29',
    kind: 'melhoria',
    title: 'aprovado ou recusado direto nas demandas',
    text: 'Nos cartões de orçamento (rascunhos e enviados) do quadro de demandas, agora dá para mudar a situação ali mesmo: enviado, aprovado, não fechou…',
    steps: [{ page: 'projetos', target: '.kcard-status', text: 'Escolha a situação aqui. Se for “aprovado”, abre a janela para criar a demanda com o valor fechado.' }],
  },
  {
    id: '2026-09-29-agenda-tipos',
    date: '2026-09-29',
    kind: 'melhoria',
    title: 'tipos da agenda com os seus nomes',
    text: 'Os tipos de compromisso agora são seus: troque “Estudos / faculdade”, “Reunião” e os outros pelos nomes que fazem sentido na sua rotina.',
    steps: [{ page: 'agenda', text: 'Toque em “+ Compromisso” e, no campo Tipo, em “renomear os tipos”. O nome novo vale para a agenda toda.' }],
  },
  {
    id: '2026-09-29-contrato-assinatura',
    date: '2026-09-29',
    kind: 'correcao',
    title: 'contrato com espaço de assinatura em branco',
    text: 'O contrato sai sem assinatura pronta: as duas partes assinam depois, no papel ou numa plataforma de assinatura digital (como gov.br, Clicksign ou DocuSign).',
  },
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
