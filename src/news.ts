import { isBeta } from './beta'
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
  beta?: boolean // ainda em teste: só a dona (e a prévia) veem; quem assina vê quando sair o "beta"
}

export const NEWS_KIND: Record<NewsKind, { label: string; color: string }> = {
  novo: { label: 'novo', color: '#5e8c6a' },
  melhoria: { label: 'melhoria', color: '#6b8f94' },
  correcao: { label: 'correção', color: '#a88a80' },
}

export const NEWS: News[] = [
  {
    id: '2026-09-30-painel-cliente',
    date: '2026-09-30',
    kind: 'novo',
    title: 'painel do cliente',
    text: 'Cada cliente pode ter um painel só dele, aberto pelo link que você manda: etapas, pagamentos, contratos para assinar, briefings, documentos e arquivos que você escolher. Atualiza sozinho e o cliente pode te mandar recados por ali.',
    steps: [{ page: 'clientes', text: 'Abra um cliente e toque em “criar o painel”.' }],
  },
  {
    id: '2026-09-30-central-avisos',
    date: '2026-09-30',
    kind: 'novo',
    title: 'avisos quando o cliente preenche algo',
    text: 'Briefing respondido, contrato assinado ou recado pelo painel: chega aviso no topo do sistema (ícone da caixa) e no seu e-mail. A assinatura pelo link entra sozinha no contrato, sem precisar colar a confirmação.',
  },
  {
    id: '2026-09-30-tela-inicio',
    date: '2026-09-30',
    kind: 'novo',
    title: 'traço na tela de início do celular',
    text: 'Dá para adicionar o traço como um ícone no celular, que abre em tela cheia como um aplicativo. O passo a passo aparece no início (no celular) e no perfil.',
    steps: [{ page: 'perfil', text: 'No perfil, veja “no celular”.' }],
  },
  {
    id: '2026-09-30-briefing-contrato-mais',
    date: '2026-09-30',
    kind: 'melhoria',
    title: 'briefing, assinatura e documentos mais completos',
    text: 'Briefing respondido pode ser baixado em PDF e você recebe um aviso no aparelho quando o cliente termina; o cliente pode guardar uma cópia das respostas. Na assinatura, 7 letras que parecem escritas à mão e localização no registro. No guia de medição, fotos com legenda e ajuste, e a planta de exemplo com opção separada. Etapas de trabalho agora têm salvar e desfazer. A ficha do cliente mostra também os contratos.',
    steps: [{ page: 'briefings', text: 'Abra um briefing respondido para baixar o PDF.' }],
  },
  {
    id: '2026-09-30-assinatura',
    date: '2026-09-30',
    kind: 'novo',
    title: 'contrato assinado pelo celular',
    text: 'No contrato, a nova seção "assinatura": mande um link e o cliente lê e assina desenhando com o dedo (ou com o nome digitado). O PDF ganha um certificado de assinatura com nome, CPF, contato, data e hora, aparelho e a impressão digital do texto. Prefere validade reforçada? Tem atalho para gov.br, ZapSign, Clicksign, D4Sign, Autentique e DocuSign.',
    steps: [{ page: 'contratos', text: 'Abra um contrato e veja a seção assinatura.' }],
  },
  {
    id: '2026-09-30-funil-etapas',
    date: '2026-09-30',
    kind: 'melhoria',
    title: 'funil do mês e aviso de parcela por etapa',
    text: 'Em orçamentos, o funil mostra quantos briefings viraram proposta e quantas fecharam. No início, quando uma etapa do cronograma está para terminar, aparece o lembrete com a mensagem pronta avisando a parcela. E dá para esconder o instagram do menu se não usar.',
    steps: [{ page: 'orcamentos', text: 'Veja o funil do mês.' }],
  },
  {
    id: '2026-09-30-demandas-contratos',
    date: '2026-09-30',
    kind: 'melhoria',
    title: 'demandas, contratos e manual mais claros',
    text: 'No quadro de demandas, rascunhos e enviados aparecem como orçamentos ainda não fechados, com um resumo do que está em negociação e do que fechou no mês. O contrato já sugere o modelo pelo tipo de serviço do orçamento (interiores, arquitetônico, consultoria…). E o manual mostra o que cada plano tem, com a jornada do cliente final.',
    steps: [{ page: 'projetos', text: 'Veja o resumo no topo das demandas.' }, { page: 'manual', text: 'Abra o manual e escolha o seu plano.' }],
  },
  {
    id: '2026-09-30-celular',
    date: '2026-09-30',
    kind: 'melhoria',
    title: 'mais confortável no celular',
    text: 'A busca abre por cima da barra ao tocar, os botões ficam organizados em grade e, onde uma opção avançada fica só no computador, aparece um aviso curto dizendo isso.',
  },
  {
    id: '2026-09-30-estudio-para-todos',
    date: '2026-09-30',
    kind: 'novo',
    title: 'agora também para quem atende cliente final',
    text: 'O traço nasceu para freelancers e, a pedido de várias arquitetas, agora também é para quem projeta direto para o cliente final: briefing online com imagens, cronograma das etapas, obra, página do projeto para o cliente, proposta em slides e documentos com a sua marca. Presente: a sua conta passou para o plano Estúdio, o mais completo.',
    steps: [{ page: 'briefings', text: 'Comece mandando um briefing para um cliente.' }, { page: 'documentos', text: 'Veja os documentos: guia de medição, placa de obra e apresentação.' }],
  },
  {
    id: '2026-09-30-documentos-v2',
    date: '2026-09-30',
    kind: 'novo',
    title: 'documentos do estúdio',
    text: 'Guia de medição com desenhos explicando cada medida, placa de obra com QR code (4 layouts), briefing em PDF para imprimir e apresentação de projeto em slides. Tudo sai no design escolhido em configurações, qualquer texto pode ser mudado antes de baixar e o documento fica salvo na ficha do cliente. Na placa, a foto pode ser arrastada e aproximada para enquadrar.',
    steps: [{ page: 'documentos', text: 'Abra “documentos” no menu e escolha um.' }],
  },
  {
    id: '2026-09-30-briefing-imagens-v2',
    date: '2026-09-30',
    kind: 'novo',
    title: 'briefing com imagens e sub-perguntas',
    text: '21 modelos prontos (studio, dormitório infantil, arquitetônico, clínica, área gourmet, closet, salão, restaurante, loja, igreja…). O cliente escolhe tocando nas imagens, perguntas extras aparecem conforme a resposta e cada pergunta de fotos diz quais fotos mandar. Dá para ver como o cliente vê antes de mandar, editar com desfazer e salvar, tirar da lista os modelos que não usa, e o link ficou curto.',
    steps: [{ page: 'briefings', text: 'Em “briefings”, toque em “editar” num modelo ou em “mandar”.' }],
  },
  {
    id: '2026-09-30-orcamento-para-quem',
    date: '2026-09-30',
    kind: 'melhoria',
    title: 'orçamento: para quem é, explicado',
    text: 'Ao criar um orçamento você escolhe cliente final (proposta em slides, com o tipo de projeto e as etapas) ou freelancer / escritório parceiro. O cliente aparece enquanto você digita o nome. A proposta em slides ganhou design novo e mostra o valor das propostas fechadas juntas. E dá para gerar o contrato já com as etapas, os prazos e o pagamento.',
    steps: [{ page: 'orcamentos', id: 'novo', text: 'Toque em “novo orçamento”.' }, { page: 'processos', text: 'Suas etapas de trabalho (cliente final, freelancer e estudante) ficam em “etapas de trabalho”.' }],
  },
  {
    id: '2026-09-30-correcoes',
    date: '2026-09-30',
    kind: 'correcao',
    title: 'correções',
    text: 'O link do briefing e a página do projeto para o cliente agora abrem sempre. Clientes antigos entram no financeiro, com pagamento e conclusão na data do orçamento (dá para mudar). Demanda excluída não volta mais sozinha, e o R$ aparece sempre com R maiúsculo.',
  },
  {
    id: '2026-09-29-orcamento-cliente-final',
    date: '2026-09-29',
    kind: 'novo',
    title: 'orçamento para cliente final, em slides',
    text: 'Ao criar um orçamento, você escolhe para quem é: cliente final ou escritório parceiro. Para cliente final, a proposta sai em slides 16:9 (cabem certinho na tela do computador), com linha do tempo das etapas, prazos, investimento e pagamento dividido por etapa. As etapas seguem o seu jeito de trabalhar e dá para editar tudo. Ao aprovar, elas viram o cronograma da demanda.',
    steps: [
      { page: 'orcamentos', text: 'Clique em “novo” e escolha “cliente final”.' },
      { page: 'config', text: 'Em configurações → propostas, edite seus processos (interiores, arquitetônico, consultoria online) e coloque as fotos dos seus projetos.' },
    ],
  },
  {
    id: '2026-09-29-estudio-abas',
    date: '2026-09-29',
    kind: 'novo',
    title: 'demandas com abas',
    text: 'Cada demanda agora tem abas: visão geral, cronograma, obra, custos e lucro e página do cliente. As quatro últimas são do plano Estúdio: cronograma com prazo e parcela de cada etapa, visitas de obra com fotos e relatório em PDF, lucro de cada projeto e um link para o cliente acompanhar tudo.',
    steps: [{ page: 'projetos', text: 'Abra uma demanda: as abas ficam logo abaixo dos cartões do topo.' }],
  },
  {
    id: '2026-09-29-tres-planos',
    date: '2026-09-29',
    kind: 'novo',
    title: 'agora são três planos',
    text: 'Além do Essencial e do Completo, chegou o Estúdio: tudo do Completo e os recursos para quem atende cliente final.',
    steps: [{ page: 'assinatura', text: 'Em minha assinatura, veja o que cada plano tem.' }],
  },
  {
    id: '2026-09-29-cliente-final',
    date: '2026-09-29',
    kind: 'novo',
    title: 'para quem atende cliente final',
    text: 'Agora o sistema se adapta a como você trabalha: freelancer, quem atende cliente final ou os dois. O cliente final ganha uma ficha completa (profissão, estado civil, família, pets, rotina e o imóvel).',
    steps: [
      { page: 'config', configTab: 'dados', target: '.wp-options', text: 'Em configurações → dados, escolha “como você trabalha”.' },
      { page: 'clientes', text: 'Ao cadastrar um cliente, escolha o tipo “cliente final”: aparecem os campos da família e do imóvel.' },
    ],
  },
  {
    id: '2026-09-29-briefing',
    date: '2026-09-29',
    kind: 'novo',
    title: 'briefing online completo',
    text: 'No plano Estúdio, o menu “briefings” tem modelos prontos (residencial, comercial, arquitetônico, cozinha, banheiro, quarto, sala, home office) que você edita como um formulário: perguntas de texto, de marcar, datas e fotos. O cliente responde pelo celular, anexa fotos, e você recebe um aviso.',
    steps: [{ page: 'briefings', text: 'Em briefings, escolha um modelo e toque em “mandar”.' }],
  },
  {
    id: '2026-09-29-tabela-grupos',
    date: '2026-09-29',
    kind: 'melhoria',
    title: 'tabela de preços organizada em grupos',
    text: 'Os serviços podem ter grupo (ex.: projeto, projetos complementares, regularização, obra). A tabela e a lista do orçamento aparecem separadas por grupo. Quem atende cliente final ganha uma tabela pronta de arquitetura: complementares (estrutural, elétrico, hidrossanitário…) com valor por item, regularização, projeto completo e acompanhamento de obra.',
    steps: [{ page: 'config', configTab: 'precos', text: 'Em configurações → preços, cada serviço tem o campo “grupo”.' }],
  },
  {
    id: '2026-09-29-instagram-formatos',
    date: '2026-09-29',
    kind: 'melhoria',
    title: 'instagram: escolha story, reels ou post',
    text: 'Ao tocar num dia do calendário, escolha o formato primeiro: story, reels ou post. Aí aparecem as ideias daquele formato.',
    steps: [{ page: 'instagram', text: 'Toque num dia do calendário e escolha um dos três cartões.' }],
  },
  {
    id: '2026-09-29-chat-formatacao',
    date: '2026-09-29',
    kind: 'novo',
    title: 'chat com negrito, itálico, sublinhado e emojis',
    text: 'Na conversa com o assistente online agora dá para destacar palavras e colocar emojis. Selecione o texto e toque em N, I ou S; o 😊 abre os emojis.',
    steps: [{ text: 'Toque no balão de conversa, no canto da tela: a barrinha de formatação fica em cima da caixa de escrever.' }],
  },
  {
    id: '2026-09-29-avisos-resposta',
    date: '2026-09-29',
    kind: 'novo',
    title: 'aviso quando respondemos você',
    text: 'Quando respondermos sua mensagem ou sua sugestão mudar de situação (em análise, planejada, feita…), você recebe um aviso na tela e por e-mail. No chat, dá para ativar os avisos do navegador.',
    steps: [{ page: 'sugestoes', text: 'Em sugestões, as que tiveram resposta nova aparecem destacadas.' }],
  },
  {
    id: '2026-09-29-instagram-calendario',
    date: '2026-09-29',
    kind: 'melhoria',
    title: 'instagram: toque no dia para planejar',
    text: 'O calendário do instagram aparece sempre. Toque em qualquer dia para ver sugestões de postagem para ele e escolher uma, ou começar em branco.',
    steps: [{ page: 'instagram', target: '.ig-cell, .ig-mini-day', text: 'Toque em um dia do calendário: aparecem as sugestões para aquele dia.' }],
  },
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
/** As novidades que esta pessoa pode ver (as em teste só aparecem para a dona e na prévia). */
export const visibleNews = () => NEWS.filter((n) => !n.beta || isBeta())
export const unseenNews = (seen?: string[]) => (seen ? visibleNews().filter((n) => !seen.includes(n.id)) : [])
