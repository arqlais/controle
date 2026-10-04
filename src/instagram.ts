import type { PostFormat } from './types'

/* Planejamento do instagram: estratégia + banco de conteúdos prontos.
   Foco: atrair arquitetos(as) e escritórios que precisam terceirizar a produção
   (modelagem 3d, render, executivo, detalhamento). Estudantes são público secundário. */

export const FORMATS: Record<PostFormat, { label: string; color: string; hint: string }> = {
  carrossel: { label: 'carrossel', color: '#4a5d6b', hint: 'educa e gera salvamentos: o formato que mais atrai arquiteto' },
  reels: { label: 'reels', color: '#a88a80', hint: 'alcance: leva o perfil para quem ainda não te conhece' },
  story: { label: 'story', color: '#7d8c99', hint: 'relacionamento e venda: quem já te segue decide aqui' },
  post: { label: 'post', color: '#8f6d64', hint: 'vitrine: render destaque, depoimento, apresentação' },
}

export const PILLARS = [
  { id: 'portfolio', label: 'portfólio', share: 30, text: 'renders e modelos prontos, antes × depois, da planta ao render. prova de que você entrega.' },
  { id: 'processo', label: 'processo', share: 25, text: 'como funciona trabalhar com você: o que precisa receber, etapas, prazos, revisões. tira o medo de terceirizar.' },
  { id: 'dicas', label: 'dicas para arquitetos', share: 25, text: 'conteúdo técnico útil (iluminação, materiais, apresentação ao cliente, executivo). gera autoridade e salvamentos.' },
  { id: 'bastidores', label: 'bastidores', share: 15, text: 'rotina, ferramentas, você trabalhando. cria conexão e confiança.' },
  { id: 'estudantes', label: 'estudantes', share: 5, text: 'tcc, apresentação de banca, portfólio. público secundário: só de vez em quando.' },
] as const
export type PillarId = (typeof PILLARS)[number]['id']

export const STRATEGY = {
  goal: 'ser lembrada como a parceira de produção 3d e projeto técnico dos arquitetos: “você projeta, eu cuido da produção”.',
  audience: [
    'arquitetos(as) autônomos e pequenos escritórios que não têm tempo (ou equipe) para modelar, renderizar ou detalhar',
    'designers de interiores que precisam de imagens para vender o projeto ao cliente final',
    'construtoras e incorporadoras com lançamentos (fachada, áreas comuns, decorado)',
    'secundário: estudantes de arquitetura em tcc e portfólio',
  ],
  frequency: [
    { day: 'segunda', what: 'carrossel (dica ou processo)' },
    { day: 'terça', what: 'stories: bastidores + enquete' },
    { day: 'quarta', what: 'reels (portfólio ou antes × depois)' },
    { day: 'quinta', what: 'stories: caixinha de perguntas ou agenda aberta' },
    { day: 'sexta', what: 'post ou carrossel de portfólio' },
    { day: 'fim de semana', what: 'opcional: story leve (rotina, referência)' },
  ],
  times: 'arquiteto olha o celular no almoço e à noite: poste entre 12h–13h ou 19h–21h (terça a quinta costumam render mais).',
  bio: [
    'modelagem 3d · render · executivo · detalhamento',
    'você projeta, eu cuido da produção ✦ parceira de escritórios de arquitetura',
    '↓ orçamento pelo whatsapp',
  ],
  highlights: ['portfólio', 'como funciona', 'prazos', 'depoimentos', 'antes × depois', 'orçamento'],
  profile: [
    'foto: você (rosto), fundo claro — gente contrata gente',
    'nome no perfil com a palavra-chave: “laís · render e 3d para arquitetos”',
    'link na bio direto para o whatsapp com mensagem pronta',
    'fixe 3 posts: apresentação, como funciona, melhor antes × depois',
    'grade: alterne render (imagem) com carrossel de texto na paleta (grafite + rosé)',
  ],
  metrics: [
    'salvamentos e compartilhamentos (carrossel): mostram que o conteúdo é útil',
    'alcance de não seguidores (reels): mostram que está chegando em gente nova',
    'respostas nos stories e mensagens: mostram interesse real de compra',
    'quantos orçamentos vieram do instagram no mês (anote no cliente: origem = instagram)',
  ],
  hashtags: {
    arquitetos: '#arquitetura #arquiteturadeinteriores #render3d #modelagem3d #renderizacao #vray #sketchup #projetodearquitetura #escritoriodearquitetura #arquitetosdobrasil #interiores #designdeinteriores',
    tecnico: '#projetoexecutivo #detalhamento #detalhamentodemarcenaria #marcenariaplanejada #executivodearquitetura #layout #plantabaixa',
    estudantes: '#estudantedearquitetura #tccarquitetura #arquiteturaeurbanismo #faculdadedearquitetura #portfoliodearquitetura',
  },
}

export interface Idea {
  id: string
  format: PostFormat
  pillar: PillarId
  title: string
  hook: string
  script: string // uma linha por slide / cena / tela
  caption: string
  art: string
  cta: string
  tags: keyof typeof STRATEGY.hashtags
}

export const IDEAS: Idea[] = [
  // ---------------- carrosséis ----------------
  {
    id: 'c-terceirizar',
    format: 'carrossel',
    pillar: 'processo',
    title: '5 sinais de que está na hora de terceirizar o 3d',
    hook: 'seu escritório está pedindo ajuda (e você nem percebeu)',
    script: [
      'capa: 5 sinais de que está na hora de terceirizar o 3d do seu escritório',
      '1. você passa mais tempo modelando do que projetando',
      '2. a apresentação atrasa porque o render ainda não saiu',
      '3. você recusou projeto por falta de tempo',
      '4. o cliente aprova menos porque não consegue “ver” o projeto',
      '5. você trabalha à noite para fechar imagens',
      'terceirizar não é perder o controle: você define o conceito, eu executo a produção',
      'final: se marcou 2 ou mais, me chama no direct — conto como funciona',
    ].join('\n'),
    caption:
      'terceirizar a produção não é abrir mão do seu projeto — é ganhar tempo para o que só você faz: criar, atender e vender.\n\nquantos desses sinais você reconheceu no seu escritório? me conta nos comentários 👇\n\neu cuido da modelagem, do render e do executivo a partir do seu projeto definido, no seu padrão.',
    art: 'fundo off-white, título grande em grafite com a palavra “terceirizar” em itálico rosé; slides numerados com número grande rosé e texto curto; último slide grafite com chamada.',
    cta: 'salve para lembrar e mande para aquela amiga arquiteta sobrecarregada',
    tags: 'arquitetos',
  },
  {
    id: 'c-como-funciona',
    format: 'carrossel',
    pillar: 'processo',
    title: 'do dwg ao render: como funciona a parceria comigo',
    hook: 'como funciona terceirizar o 3d comigo (sem complicação)',
    script: [
      'capa: do dwg ao render — como funciona a parceria',
      '1. você me envia a planta (dwg), referências e o conceito definido',
      '2. eu faço o orçamento com escopo claro: o que está incluso e o prazo',
      '3. sinal de 50% e começamos',
      '4. modelagem fiel à planta + prévia para você conferir',
      '5. ajustes incluídos e imagens finais em alta',
      '6. saldo na entrega — e você apresenta ao seu cliente',
      'final: simples assim. quer um orçamento? link na bio',
    ].join('\n'),
    caption:
      'muita gente tem vontade de terceirizar, mas não sabe como funciona na prática. aqui está o passo a passo, do jeito que eu trabalho.\n\nvocê continua dona do projeto: o conceito é seu, a produção é minha.\n\nficou alguma dúvida? pergunta aqui que eu respondo 💬',
    art: 'linha do tempo vertical com ícones (arquivo, orçamento, sinal, modelo, render, entrega); paleta grafite + rosé; print real do sketchup no slide 4 e render no slide 5.',
    cta: 'fixe no perfil e mande no direct “quero orçamento”',
    tags: 'arquitetos',
  },
  {
    id: 'c-o-que-enviar',
    format: 'carrossel',
    pillar: 'processo',
    title: 'o que eu preciso receber para modelar sem retrabalho',
    hook: 'checklist: o que mandar para o 3d sair certo na primeira',
    script: [
      'capa: checklist do que enviar para o 3d sair certo de primeira',
      'planta baixa em dwg com medidas reais (layout e mobiliário definidos)',
      'cortes e elevações (pé-direito, forros, alturas de marcenaria)',
      'referências de estilo e materiais (pasta ou pinterest)',
      'acabamentos: pisos, revestimentos, marcenaria, metais',
      'iluminação: pontos e o clima desejado (dia, fim de tarde, noite)',
      'ângulos das imagens que você quer apresentar',
      'final: com isso em mãos, o prazo é cumprido e as revisões diminuem',
    ].join('\n'),
    caption:
      'a maior causa de atraso no 3d não é a modelagem — é informação faltando no meio do caminho.\n\nsalve este checklist e use antes de enviar qualquer projeto para render (comigo ou com quem for 😉).',
    art: 'estilo checklist com quadradinhos marcados em rosé; ícones de arquivo dwg, régua, paleta de materiais, lâmpada e câmera.',
    cta: 'salve e use no próximo projeto',
    tags: 'arquitetos',
  },
  {
    id: 'c-ia-vray',
    format: 'carrossel',
    pillar: 'dicas',
    title: 'render por ia × v-ray: quando usar cada um',
    hook: 'render por ia ou v-ray? depende do momento do projeto',
    script: [
      'capa: render por ia × v-ray — quando usar cada um',
      'render por ia: rápido e mais barato. ótimo para estudo, conceito e primeira apresentação',
      'v-ray: máxima fidelidade de material, luz e medida. ideal para aprovação final e lançamento',
      'mesma cena, dois resultados (comparação lado a lado)',
      'dica: comece com ia para aprovar a ideia e feche com v-ray',
      'final: não sabe qual escolher? me conta o projeto que eu indico',
    ].join('\n'),
    caption:
      'não existe “o melhor” — existe o certo para cada etapa.\n\ncom ia você testa caminhos rápido; com v-ray você entrega a imagem que vende.\n\nqual você usa mais hoje?',
    art: 'slide dividido ao meio (esquerda ia, direita v-ray) com a mesma cena; etiquetas pequenas “ia” e “v-ray” em rosé.',
    cta: 'comente “ia” ou “vray”',
    tags: 'arquitetos',
  },
  {
    id: 'c-antes-depois',
    format: 'carrossel',
    pillar: 'portfolio',
    title: 'antes × depois: da planta ao render',
    hook: 'da planta baixa ao render final (arrasta →)',
    script: [
      'capa: render final + “da planta ao render”',
      'planta baixa recebida (dwg)',
      'modelagem no sketchup (vista geral)',
      'materiais aplicados',
      'iluminação e câmeras',
      'render final (imagem 1)',
      'render final (imagem 2)',
      'final: ficha técnica do projeto (tipo, área, prazo) + chamada',
    ].join('\n'),
    caption:
      'cada imagem começa numa planta — e termina num cliente encantado.\n\nprojeto: [tipo] · [área] m² · [prazo] dias\narquitetura: @[escritório]\n\nquer ver o seu projeto assim? me chama 💬',
    art: 'sequência com a mesma câmera em todas as etapas; legenda discreta no canto (“etapa 1/5”); capa com o render mais forte.',
    cta: 'marque o escritório parceiro e convide para orçamento',
    tags: 'arquitetos',
  },
  {
    id: 'c-prazos',
    format: 'carrossel',
    pillar: 'processo',
    title: 'quanto tempo leva? prazos reais',
    hook: 'quanto tempo leva um render? (prazos reais)',
    script: [
      'capa: quanto tempo leva? prazos reais de produção',
      'modelagem de um ambiente: a partir de x dias úteis',
      'renders (pacote de 5 imagens): a partir de x dias úteis',
      'executivo: depende das pranchas — em média x dias',
      'detalhamento de marcenaria: a partir de x dias',
      'o que acelera: arquivos completos e referências definidas',
      'final: tem prazo apertado? me chama que a gente vê a agenda',
    ].join('\n'),
    caption:
      'prazo é a pergunta nº 1 que recebo. aqui vai a média real (ajustada a cada projeto).\n\nprojeto urgente? tenho opção com prioridade — pergunte a disponibilidade.',
    art: 'cards com relógio/ampulheta; números grandes em rosé; fundo off-white.',
    cta: 'salve e consulte a agenda pelo direct',
    tags: 'arquitetos',
  },
  {
    id: 'c-erros-render',
    format: 'carrossel',
    pillar: 'dicas',
    title: '5 erros que atrasam a entrega de renders',
    hook: '5 erros que atrasam o seu render (e como evitar)',
    script: [
      'capa: 5 erros que atrasam a entrega de renders',
      '1. mudar o layout depois da modelagem pronta',
      '2. enviar referências vagas (“algo moderno”)',
      '3. não definir materiais antes',
      '4. pedir “todas as vistas possíveis” sem escolher os ângulos',
      '5. aprovar por partes, com muitas pessoas opinando',
      'como evitar: briefing fechado + uma pessoa que aprova',
      'final: salve e compartilhe com a sua equipe',
    ].join('\n'),
    caption:
      'render bom é render com briefing bom. quase todo atraso vem de decisão que ficou para depois.\n\nqual desses erros você já viveu? 😅',
    art: 'ícones de “x” em rosé; texto curto; último slide com “✓” e a solução.',
    cta: 'compartilhe com a equipe do escritório',
    tags: 'arquitetos',
  },
  {
    id: 'c-executivo',
    format: 'carrossel',
    pillar: 'dicas',
    title: 'executivo e detalhamento: o que entra em cada um',
    hook: 'executivo e detalhamento não são a mesma coisa',
    script: [
      'capa: executivo × detalhamento — o que entra em cada um',
      'executivo: plantas (layout, demolir/construir, forro, pontos elétricos e hidráulicos, piso)',
      'executivo: cortes, elevações e vistas',
      'detalhamento: marcenaria (vistas, cortes, medidas, ferragens)',
      'detalhamento: marmoraria e serralheria',
      'por que separar: cada fornecedor recebe só o que precisa',
      'final: quer terceirizar o executivo? orçamento pelo whatsapp',
    ].join('\n'),
    caption:
      'uma dúvida comum: “detalhamento já vem no executivo?” — depende do escopo. aqui está a diferença que eu uso nos meus orçamentos.\n\nsalve para consultar quando for montar o seu.',
    art: 'mini-pranchas ilustrativas (linha fina grafite) com destaques rosé; estilo técnico e limpo.',
    cta: 'salve e mande dúvidas no direct',
    tags: 'tecnico',
  },
  {
    id: 'c-tcc',
    format: 'carrossel',
    pillar: 'estudantes',
    title: 'como apresentar o tcc com imagens que impressionam a banca',
    hook: 'tcc: 4 imagens que não podem faltar na sua apresentação',
    script: [
      'capa: 4 imagens que não podem faltar no seu tcc',
      '1. implantação humanizada (o projeto no contexto)',
      '2. vista externa principal (a “foto de capa” do projeto)',
      '3. o espaço mais importante por dentro',
      '4. um detalhe que mostra o conceito',
      'dica: mesma luz e mesmo clima em todas as imagens',
      'final: faço renders para tcc com valor de estudante — chama no direct',
    ].join('\n'),
    caption:
      'a banca lembra do projeto que ela consegue “ver”. escolha poucas imagens, mas fortes.\n\nestudante tem condição especial comigo 💛',
    art: 'grid 2×2 com renders de exemplo; selo “tcc” em rosé.',
    cta: 'marque sua dupla de tcc',
    tags: 'estudantes',
  },

  // ---------------- reels ----------------
  {
    id: 'r-timelapse',
    format: 'reels',
    pillar: 'portfolio',
    title: 'timelapse: da planta ao render em 15 segundos',
    hook: 'de uma planta baixa a isso em 15 segundos 👀',
    script: [
      'cena 1 (0–2s): planta baixa na tela + texto do gancho',
      'cena 2 (2–7s): gravação de tela acelerada da modelagem',
      'cena 3 (7–11s): aplicação de materiais e luz',
      'cena 4 (11–15s): transição para o render final, pausa de 2s',
      'texto final: “você projeta, eu cuido da produção”',
      'áudio: trending instrumental calmo',
    ].join('\n'),
    caption: 'o processo que o cliente não vê — mas sente no resultado ✨\n\nprojeto de @[escritório]. quer o seu assim? link na bio.',
    art: 'gravação de tela do sketchup/v-ray acelerada (8×); capa com o render final e o texto “da planta ao render”.',
    cta: 'siga para ver o próximo',
    tags: 'arquitetos',
  },
  {
    id: 'r-pov',
    format: 'reels',
    pillar: 'bastidores',
    title: 'pov: você terceirizou o 3d e finalmente dormiu',
    hook: 'pov: você é arquiteta e terceirizou o 3d',
    script: [
      'cena 1: arquiteta cansada à noite na frente do computador (texto: “antes”)',
      'cena 2: mensagem chegando “imagens prontas ✅” (texto: “depois”)',
      'cena 3: arquiteta tomando café tranquila apresentando ao cliente',
      'cena 4: tela com o render final',
      'áudio: trend de alívio/humor',
    ].join('\n'),
    caption: 'o antes e depois que ninguém mostra 😴 → ☕\n\nmarca aquela amiga que precisa ver isso.',
    art: 'vídeo curto, luz natural, texto grande na tela em caixa baixa; capa com “pov” em rosé.',
    cta: 'marque uma arquiteta',
    tags: 'arquitetos',
  },
  {
    id: 'r-iluminacao',
    format: 'reels',
    pillar: 'dicas',
    title: '3 ajustes de luz que mudam um render',
    hook: 'o mesmo render, 3 ajustes de luz 💡',
    script: [
      'cena 1: render sem ajuste (texto: “antes”)',
      'cena 2: ajuste 1 — temperatura de cor mais quente',
      'cena 3: ajuste 2 — luz indireta no forro/marcenaria',
      'cena 4: ajuste 3 — horário do sol (fim de tarde)',
      'cena 5: comparação final lado a lado',
    ].join('\n'),
    caption: 'luz é o que transforma um modelo 3d em um lugar onde dá vontade de estar.\n\nqual versão você apresentaria ao cliente: 1, 2 ou 3?',
    art: 'transições com corte seco no mesmo enquadramento; número do ajuste grande no canto.',
    cta: 'comente 1, 2 ou 3',
    tags: 'arquitetos',
  },
  {
    id: 'r-rotina',
    format: 'reels',
    pillar: 'bastidores',
    title: 'um dia de produção 3d comigo',
    hook: 'um dia na rotina de quem faz o 3d dos arquitetos',
    script: [
      'cena 1: café + agenda do dia (texto: “8h”)',
      'cena 2: conferindo arquivos recebidos (dwg, referências)',
      'cena 3: modelando (tela acelerada)',
      'cena 4: enviando prévia pelo whatsapp',
      'cena 5: render final saindo + “entregue ✅”',
    ].join('\n'),
    caption: 'bastidores de um dia de produção. cada projeto aqui é tratado como se fosse meu 🤍',
    art: 'vídeo em primeira pessoa, luz natural, textos curtos com horário.',
    cta: 'siga para acompanhar os bastidores',
    tags: 'arquitetos',
  },
  {
    id: 'r-ia-30s',
    format: 'reels',
    pillar: 'dicas',
    title: 'render por ia: o que dá para fazer',
    hook: 'render por ia não é apertar um botão (olha o processo)',
    script: [
      'cena 1: modelo simples do sketchup',
      'cena 2: primeira geração da ia (texto: “sem direção”)',
      'cena 3: ajustes de referência, material e luz',
      'cena 4: resultado final (texto: “com direção”)',
      'texto final: “a ia acelera — o olhar técnico é que faz a imagem”',
    ].join('\n'),
    caption: 'ia é ferramenta, não mágica. o que faz a diferença é o modelo bem feito e o olhar de quem entende de projeto.\n\nvocê já usa ia nos seus projetos?',
    art: 'tela dividida com as versões; selo “ia” em rosé.',
    cta: 'comente se usa ia',
    tags: 'arquitetos',
  },
  {
    id: 'r-aprovado',
    format: 'reels',
    pillar: 'portfolio',
    title: 'o cliente aprovou na primeira apresentação',
    hook: '“aprovado na primeira reunião” — foi isso que ouvi',
    script: [
      'cena 1: print (sem nomes) da mensagem “o cliente aprovou tudo!”',
      'cena 2: renders do projeto em sequência (2s cada)',
      'cena 3: texto: “imagem boa encurta a venda”',
    ].join('\n'),
    caption: 'quando o cliente consegue enxergar o projeto, a decisão fica fácil. parabéns @[escritório] pela aprovação! 🥂',
    art: 'print com fundo desfocado, renders em tela cheia, texto em caixa baixa.',
    cta: 'chame no direct para o seu projeto',
    tags: 'arquitetos',
  },
  {
    id: 'r-materiais',
    format: 'reels',
    pillar: 'dicas',
    title: '3 materiais que mais pedem ajuste no render',
    hook: '3 materiais que entregam um render amador',
    script: [
      'cena 1: madeira com repetição de textura → corrigida',
      'cena 2: vidro/espelho sem reflexo real → corrigido',
      'cena 3: tecido “de plástico” → corrigido com relevo',
      'texto final: detalhe é o que faz parecer real',
    ].join('\n'),
    caption: 'realismo mora nos detalhes. salve para lembrar na próxima revisão de render.',
    art: 'antes × depois com zoom no material; setinhas rosé.',
    cta: 'salve este reels',
    tags: 'arquitetos',
  },
  {
    id: 'r-pergunta',
    format: 'reels',
    pillar: 'bastidores',
    title: 'qual etapa do projeto você mais odeia fazer?',
    hook: 'qual etapa do projeto você terceirizaria agora?',
    script: [
      'cena 1: você falando para a câmera o gancho',
      'cena 2: opções na tela: modelagem · render · executivo · detalhamento',
      'cena 3: “a minha resposta é: nenhuma — eu amo produzir 😅”',
      'cena 4: “por isso faço para você”',
    ].join('\n'),
    caption: 'responde aqui embaixo: qual etapa você passaria pra frente hoje? 👇',
    art: 'vídeo selfie simples, legenda grande, fundo do escritório.',
    cta: 'comente a etapa',
    tags: 'arquitetos',
  },

  // ---------------- stories ----------------
  {
    id: 's-caixinha',
    format: 'story',
    pillar: 'processo',
    title: 'caixinha: dúvidas sobre terceirizar o 3d',
    hook: 'pergunte qualquer coisa sobre terceirizar o 3d',
    script: [
      'tela 1: foto sua trabalhando + “sexta de perguntas 💬”',
      'tela 2: caixinha “o que você quer saber sobre terceirizar o 3d?”',
      'telas seguintes (no dia seguinte): respostas com print do projeto quando fizer sentido',
      'última: “quer orçamento? responde este story”',
    ].join('\n'),
    caption: '',
    art: 'fundo com render desfocado, caixinha em rosé.',
    cta: 'responda este story',
    tags: 'arquitetos',
  },
  {
    id: 's-enquete',
    format: 'story',
    pillar: 'processo',
    title: 'enquete: você faz o 3d ou terceiriza?',
    hook: 'enquete rápida 👀',
    script: [
      'tela 1: enquete “você faz o 3d dos seus projetos?” — faço eu / terceirizo',
      'tela 2: “e o que mais toma seu tempo?” — modelar / renderizar / executivo',
      'tela 3 (dia seguinte): resultado + “se é o seu caso, eu posso ajudar”',
    ].join('\n'),
    caption: '',
    art: 'fundo off-white, texto grafite, sticker de enquete.',
    cta: 'vote na enquete',
    tags: 'arquitetos',
  },
  {
    id: 's-bastidor',
    format: 'story',
    pillar: 'bastidores',
    title: 'bastidores: do modelo ao render do dia',
    hook: 'o que está saindo hoje por aqui',
    script: [
      'tela 1: print do sketchup “começando…”',
      'tela 2: vídeo curto do render processando',
      'tela 3: render final com slider “o que achou?”',
      'tela 4: “projeto de @[escritório] 🤍”',
    ].join('\n'),
    caption: '',
    art: 'prints reais, sticker de slider com emoji ✨.',
    cta: 'reaja com o slider',
    tags: 'arquitetos',
  },
  {
    id: 's-agenda',
    format: 'story',
    pillar: 'processo',
    title: 'agenda aberta: vagas do mês',
    hook: 'abri a agenda de [mês] 🗓',
    script: [
      'tela 1: “agenda de [mês] aberta”',
      'tela 2: “x vagas para renders e modelagem”',
      'tela 3: “prazos a partir de x dias úteis”',
      'tela 4: link do whatsapp “quero reservar”',
    ].join('\n'),
    caption: '',
    art: 'calendário minimalista em grafite com datas marcadas em rosé.',
    cta: 'toque no link e reserve',
    tags: 'arquitetos',
  },
  {
    id: 's-antes-depois',
    format: 'story',
    pillar: 'portfolio',
    title: 'antes × depois com slider',
    hook: 'arrasta pra ver a diferença →',
    script: ['tela 1: modelo sem material', 'tela 2: render final', 'tela 3: slider “quanto você deu de nota?”', 'tela 4: “quer o seu assim? me chama”'].join('\n'),
    caption: '',
    art: 'mesma câmera nas duas telas; slider com emoji 🔥.',
    cta: 'responda com a nota',
    tags: 'arquitetos',
  },
  {
    id: 's-depoimento',
    format: 'story',
    pillar: 'portfolio',
    title: 'depoimento de cliente',
    hook: 'o que dizem os escritórios parceiros 🤍',
    script: ['tela 1: print do depoimento (com autorização)', 'tela 2: render do projeto dessa cliente', 'tela 3: “obrigada pela confiança!” + link whatsapp'].join('\n'),
    caption: '',
    art: 'print com moldura arredondada sobre fundo rosé claro.',
    cta: 'salve no destaque “depoimentos”',
    tags: 'arquitetos',
  },

  // ---------------- posts ----------------
  {
    id: 'p-apresentacao',
    format: 'post',
    pillar: 'bastidores',
    title: 'prazer, sou a laís',
    hook: 'prazer, sou a laís — produção 3d para arquitetos',
    script: 'foto sua no escritório (luz natural) com texto “prazer, sou a laís”',
    caption:
      'prazer! sou a laís e ajudo arquitetos e escritórios a entregarem projetos que vendem — sem virar a noite modelando.\n\nfaço modelagem 3d, render (v-ray e ia), executivo e detalhamento a partir do seu projeto definido.\n\n✦ você projeta, eu cuido da produção.\n\nme conta: você é arquiteta, designer ou estudante?',
    art: 'retrato vertical, fundo claro, texto pequeno em grafite no canto inferior.',
    cta: 'fixe no perfil',
    tags: 'arquitetos',
  },
  {
    id: 'p-render',
    format: 'post',
    pillar: 'portfolio',
    title: 'render destaque com ficha técnica',
    hook: 'projeto [nome] · render v-ray',
    script: 'render principal em alta (4:5)',
    caption: 'projeto: [tipo] · [cidade]\narquitetura: @[escritório]\nmodelagem e render: eu 🤍\nsoftware: sketchup + v-ray\n\nqual detalhe você mais gostou?',
    art: 'imagem 4:5 sem texto por cima (deixe a imagem falar); marca d’água discreta.',
    cta: 'marque o escritório',
    tags: 'arquitetos',
  },
  {
    id: 'p-manifesto',
    format: 'post',
    pillar: 'processo',
    title: 'você projeta, eu cuido da produção',
    hook: 'você projeta, eu cuido da produção.',
    script: 'arte tipográfica com a frase',
    caption: 'meu trabalho é tirar da sua mesa o que toma tempo — para você fazer o que só você faz: criar e vender o projeto.\n\norçamento pelo link da bio 💬',
    art: 'fundo grafite, “você projeta,” em itálico rosé e “eu cuido da produção” em branco (mesma arte do login do sistema).',
    cta: 'compartilhe nos stories',
    tags: 'arquitetos',
  },
  {
    id: 'p-depoimento',
    format: 'post',
    pillar: 'portfolio',
    title: 'depoimento em arte',
    hook: '“[frase da cliente]”',
    script: 'arte com a frase do depoimento + nome/escritório',
    caption: 'nada me deixa mais feliz do que ver um projeto aprovado 🥹\n\nobrigada, @[escritório], pela parceria!',
    art: 'aspas grandes em rosé, texto grafite centralizado, render do projeto em miniatura.',
    cta: 'chame no direct para ser o próximo',
    tags: 'arquitetos',
  },
]

/** Sugestão de mês: seg carrossel, ter/qui story, qua reels, sex post/carrossel. */
export const WEEK_PLAN: { weekday: number; format: PostFormat; time: string }[] = [
  { weekday: 1, format: 'carrossel', time: '12:00' },
  { weekday: 2, format: 'story', time: '19:00' },
  { weekday: 3, format: 'reels', time: '19:00' },
  { weekday: 4, format: 'story', time: '12:00' },
  { weekday: 5, format: 'post', time: '12:00' },
]

/* ============================================================
   Estratégia de quem assina a plataforma (diferente da da Laís):
   método "mostrar · ensinar · aproximar", pensado para qualquer
   freelancer de arquitetura, interiores e 3D.
   ============================================================ */
export const CLIENT_PILLARS = [
  { id: 'portfolio', label: 'mostrar (trabalho pronto)', share: 35, text: 'projetos finalizados, detalhes, comparação ideia × resultado. é o que faz alguém pensar “quero isso”.' },
  { id: 'dicas', label: 'ensinar (o que você sabe)', share: 30, text: 'uma dúvida que seus clientes sempre têm, respondida em poucos slides. mostra que você domina o assunto.' },
  { id: 'processo', label: 'como é contratar você', share: 20, text: 'etapas, prazos, o que você precisa receber, como é a entrega. quem entende o processo contrata sem medo.' },
  { id: 'bastidores', label: 'aproximar (quem é você)', share: 15, text: 'sua mesa, sua rotina, um projeto em andamento, o que te inspira. as pessoas contratam quem elas conhecem.' },
] as const

export const CLIENT_STRATEGY = {
  goal: 'fazer quem vê o seu perfil entender em 5 segundos o que você faz, para quem, e como pedir um orçamento.',
  audience: [
    'escreva aqui quem mais te contrata (ex.: escritórios pequenos, clientes finais, lojas, construtoras)',
    'pense em um cliente real: o que ele precisa ver para confiar em você?',
    'conteúdo bom responde uma pergunta que esse cliente faria',
  ],
  frequency: [
    { day: 'segunda', what: 'carrossel: ensinar (uma dúvida comum respondida)' },
    { day: 'quarta', what: 'reels: mostrar (um trabalho pronto em movimento)' },
    { day: 'quinta', what: 'stories: aproximar (bastidor + enquete ou caixinha)' },
    { day: 'sábado', what: 'post: mostrar ou como é contratar você' },
  ],
  times: 'melhor ter constância do que volume: 3 a 4 publicações por semana já funcionam. poste no horário em que seus clientes têm pausa (almoço ou início da noite) e repita o que der certo.',
  bio: ['{serviços} para {quem você atende}', 'ex.: projetos, imagens 3D e detalhamento ✦ atendo todo o Brasil', '↓ peça seu orçamento'],
  highlights: ['trabalhos', 'como funciona', 'depoimentos', 'sobre mim', 'orçamento'],
  profile: [
    'foto com o seu rosto ou um logo simples e legível',
    'nome do perfil com o que você faz (ex.: “ana · projetos de interiores”)',
    'bio em 3 linhas: o que faz, para quem, como pedir orçamento',
    'link direto para o seu WhatsApp',
    'fixe 3 posts: quem é você, um trabalho que você ama, como é contratar você',
  ],
  metrics: [
    'quantas pessoas pediram orçamento pelo instagram (marque “origem: instagram” no cliente)',
    'salvamentos: mostram qual conteúdo é útil — faça mais parecidos',
    'visitas ao perfil depois de um reels: mostram que chegou gente nova',
  ],
  hashtags: [
    ['geral', '#freelancer #arquitetura #designdeinteriores #projetos #decoracao'],
    ['imagens e 3D', '#render3d #modelagem3d #visualizacao3d #3dartist #renderizacao'],
    ['técnico', '#projetoexecutivo #detalhamento #plantabaixa #layout'],
  ] as [string, string][],
}

/** Semana da estratégia de quem assina: tema sugerido em cada dia (vira rascunho de postagem). */
export const CLIENT_WEEK_PLAN: { weekday: number; format: PostFormat; time: string; pillar: 'portfolio' | 'dicas' | 'processo' | 'bastidores'; title: string }[] = [
  { weekday: 1, format: 'carrossel', time: '12:00', pillar: 'dicas', title: 'ensinar: responda uma dúvida que seus clientes sempre têm' },
  { weekday: 3, format: 'reels', time: '19:00', pillar: 'portfolio', title: 'mostrar: um trabalho pronto em movimento' },
  { weekday: 4, format: 'story', time: '12:00', pillar: 'bastidores', title: 'aproximar: bastidor do dia + enquete' },
  { weekday: 6, format: 'post', time: '11:00', pillar: 'processo', title: 'como é contratar você: etapas, prazo e entrega' },
]

/** Ideias por formato para quem assina (a tela do dia mostra as do formato escolhido). */
export const CLIENT_FORMAT_IDEAS: Record<'story' | 'reels' | 'post', { title: string; pillar: 'portfolio' | 'dicas' | 'processo' | 'bastidores' }[]> = {
  story: [
    { title: 'bastidor do dia + enquete', pillar: 'bastidores' },
    { title: 'caixinha de perguntas: tire dúvidas dos seus clientes', pillar: 'dicas' },
    { title: 'antes × depois com o controle deslizante', pillar: 'portfolio' },
    { title: 'agenda aberta: vagas do mês', pillar: 'processo' },
    { title: 'um dia de trabalho em 5 stories', pillar: 'bastidores' },
    { title: 'depoimento de cliente (print da conversa, com autorização)', pillar: 'portfolio' },
  ],
  reels: [
    { title: 'um trabalho pronto em movimento', pillar: 'portfolio' },
    { title: 'do rascunho ao resultado em 15 segundos', pillar: 'processo' },
    { title: '3 erros comuns e como evitar', pillar: 'dicas' },
    { title: 'tour pelo projeto com música em alta', pillar: 'portfolio' },
    { title: 'responda uma dúvida em vídeo curto', pillar: 'dicas' },
  ],
  post: [
    { title: 'como é contratar você: etapas, prazo e entrega', pillar: 'processo' },
    { title: 'carrossel: responda uma dúvida que seus clientes sempre têm', pillar: 'dicas' },
    { title: 'projeto destaque com ficha técnica', pillar: 'portfolio' },
    { title: 'apresente-se: quem é você e como trabalha', pillar: 'bastidores' },
    { title: 'carrossel: antes e depois de um projeto', pillar: 'portfolio' },
    { title: 'depoimento de cliente em arte', pillar: 'portfolio' },
  ],
}

/** Montador de bio: junta as respostas em até 150 caracteres (limite do instagram). */
export const BIO_LIMIT = 150
export const CAPTION_LIMIT = 2200

/* Gerador de texto sem IA (sem custo): mistura frases-base de cada tema com os dados de quem usa
   (o que faz, para quem, cidade, serviços e projetos reais), sorteando variações a cada toque. */
export interface WriterInput {
  name: string
  what: string // o que faz
  who: string // para quem
  extra: string // cidade / diferencial
  services: string[]
  projects: string[] // títulos de projetos reais
  title: string
  format: PostFormat
  pillar: string
}
const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)]
export function writePost(i: WriterInput) {
  const what = i.what || i.services.slice(0, 2).join(' e ') || 'projetos'
  const who = i.who || 'quem quer um projeto bem feito'
  const proj = pick(i.projects.length ? i.projects : ['[nome do projeto]'])
  const svc = pick(i.services.length ? i.services : [what])
  const place = i.extra ? ` · ${i.extra}` : ''
  const theme = i.title.replace(/^[^:]+:\s*/, '') || svc
  const P: Record<string, { hook: string[]; body: string[]; caption: string[]; cta: string[]; art: string[] }> = {
    portfolio: {
      hook: [`olha como ficou: ${proj}`, `${proj}, do pedido ao resultado`, `o antes e o depois de ${proj}`, `esse é um dos meus preferidos: ${proj}`],
      body: [`o pedido: o que o cliente precisava\no desafio: o que era difícil em ${proj}\nas imagens/detalhes que mostram a solução\no resultado final\nquer algo assim? me chama`, `capa: a melhor imagem de ${proj}\n2 a 4 detalhes de perto\num antes × depois\nficha: ${svc}${place}`],
      caption: [`${proj}.\n\nfiz ${svc} pensando em ${who}. cada detalhe foi escolhido para [o que o cliente queria].`, `quando chegou o pedido de ${proj}, a ideia era [objetivo]. o resultado está aqui.\n\n${what}${place}`],
      cta: ['quer um projeto assim? me chama no direct', 'orçamento pelo link da bio', 'salva para se inspirar depois'],
      art: [`a imagem mais forte de ${proj}, com o nome pequeno no canto`, 'antes × depois lado a lado, sem texto por cima'],
    },
    dicas: {
      hook: [`3 erros comuns em ${theme} (e como evitar)`, `o que eu sempre explico sobre ${theme}`, `antes de contratar ${svc}, saiba disso`, `${theme}: o que ninguém te conta`],
      body: [`capa: a dúvida que mais escuto sobre ${theme}\npor que isso importa\ndica 1 com exemplo\ndica 2 com exemplo\ndica 3 com exemplo\nresumo em uma frase`, `a dúvida escrita na tela\na resposta em 3 pontos rápidos\num exemplo de projeto meu\n“salva e manda para quem precisa”`],
      caption: [`essa é a pergunta que mais recebo de ${who}: [dúvida].\n\na resposta curta: [resposta em 2 linhas].\n\nsalva para consultar depois.`, `trabalho com ${what} e vejo isso toda semana: [problema comum].\n\nmeu conselho: [dica principal].`],
      cta: ['salva e manda para quem está precisando', 'ficou alguma dúvida? me pergunta nos comentários'],
      art: ['fundo liso nas cores da sua marca, título grande e uma imagem de exemplo por slide'],
    },
    processo: {
      hook: [`como é trabalhar comigo, do primeiro contato à entrega`, `quanto tempo leva ${svc}? te explico`, `o que eu preciso receber para começar`, `${svc}: passo a passo`],
      body: [`capa: como funciona contratar ${svc}\no que eu preciso receber\netapas e prazo médio\nquantas revisões estão incluídas\ncomo é a entrega\npeça seu orçamento`, `1. conversa e orçamento\n2. aprovação e sinal\n3. execução e revisões\n4. entrega dos arquivos`],
      caption: [`como funciona trabalhar comigo:\n\n1. você me conta o que precisa\n2. mando o orçamento\n3. faço ${svc} com revisões incluídas\n4. entrego tudo organizado\n\natendo ${who}${place}.`, `muita gente me pergunta como é contratar ${what}. fiz este passo a passo para ficar claro desde o começo.`],
      cta: ['peça seu orçamento pelo link da bio', 'me chama no direct com a palavra “orçamento”'],
      art: ['etapas numeradas em fundo claro, uma por linha, com o seu logo'],
    },
    bastidores: {
      hook: [`um dia de trabalho por aqui`, `o que acontece antes da entrega de ${proj}`, `minha mesa hoje`, `bastidores de ${svc}`],
      body: [`foto sua trabalhando\nsua mesa e ferramentas\n${proj} em andamento\nalgo que você ama no seu trabalho`, `o começo do dia\ntelas do trabalho em andamento\no resultado do dia`],
      caption: [`por trás de cada entrega tem [o que acontece nos bastidores].\n\nhoje estou cuidando de ${proj}.`, `quem me acompanha vê o resultado; hoje mostro o caminho. ${what}${place}.`],
      cta: ['me conta nos comentários', 'quer ver mais bastidores? salva o perfil'],
      art: ['foto real com luz natural, sem montagem'],
    },
  }
  const k = P[i.pillar] ? i.pillar : i.pillar === 'estudantes' ? 'dicas' : 'portfolio'
  const b = P[k]
  return { hook: pick(b.hook), script: pick(b.body), caption: pick(b.caption), cta: pick(b.cta), art: pick(b.art) }
}
