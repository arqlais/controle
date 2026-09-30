import type { BriefingKind, BriefingQuestion, BriefingSection, BriefingTemplate, ClientProfile } from './types'
import { BRIEFING_SECTIONS, DEFAULT_BRIEFING } from './briefingQuestions'
import { BED_ART, CLOSET_ART, KITCHEN_ART, LIGHT_ART, PALETTE_ART, STYLE_ART } from './briefingArt'

/* Modelos prontos de briefing. A pessoa usa como estão, edita (vira uma cópia dela)
   ou começa do zero. Tudo editável: perguntas, tipos, opções, imagens e seções. */

type Q = [id: string, label: string, kind?: BriefingKind, extra?: Partial<BriefingQuestion>]
const sec = (id: string, title: string, description = ''): BriefingSection => ({ id, title, description })
const qs = (section: string, list: Q[]): BriefingQuestion[] => list.map(([id, label, kind = 'text', extra = {}]) => ({ id: `${section}-${id}`, section, label, kind, ...extra }))
const opts = (...o: string[]) => ({ options: o })
const field = (f: keyof ClientProfile) => ({ field: f })

/* ---------- blocos que se repetem ---------- */

const withArt = (art: Record<string, string>) => ({ options: Object.keys(art), optionImages: { ...art } })
const photos = (id: string, label: string, tips: string[], hint = 'Pode ser pelo celular, com boa luz. Não precisa ser perfeito.'): Q => [id, label, 'photos', { tips, hint }]
const refs: Q = ['refs', 'Imagens de referência que você gosta', 'photos', { hint: 'Prints do Pinterest ou do Instagram servem.', tips: ['ambientes que você salvou', 'detalhes que chamaram sua atenção (uma luminária, uma cor, um revestimento)'] }]

/** Estilo e sensação, com escolha por imagem (as imagens são trocáveis). */
const styleBlock = (section = 'estilo'): BriefingQuestion[] =>
  qs(section, [
    ['estilo', 'Com qual estilo você mais se identifica?', 'multi', { ...withArt(STYLE_ART), hint: 'Pode marcar mais de um.' }],
    ['cores', 'Que cores combinam com você?', 'multi', { ...withArt(PALETTE_ART), other: true }],
    ['luz', 'Que tipo de luz você prefere?', 'choice', withArt(LIGHT_ART)],
    ['ama', 'Materiais e acabamentos que você ama', 'long', { hint: 'Ex.: madeira clara, pedra, palhinha, cimento queimado…' }],
    ['nao', 'O que você NÃO quer de jeito nenhum?', 'long'],
    refs,
  ])

const budget = (_section: string, options: string[], label = 'Quanto pretende investir (sem contar o projeto)?'): Q => ['investimento', label, 'choice', { ...opts(...options, 'prefiro conversar'), ...field('investment') }]
const HOME_BUDGET = ['até R$ 15 mil', 'R$ 15 a 40 mil', 'R$ 40 a 80 mil', 'acima de R$ 80 mil']
const BIZ_BUDGET = ['até R$ 50 mil', 'R$ 50 a 150 mil', 'R$ 150 a 300 mil', 'acima de R$ 300 mil']

/** Briefing de um ambiente da casa. */
const room = (name: string, extra: Q[], tips: string[]): BriefingQuestion[] => [
  ...qs('uso', [
    ['quem', `Quem usa ${name}?`, 'long', { hint: 'Idades, rotina, se tem pets…' }],
    ['rotina', 'Conte como é um dia comum nesse espaço', 'long'],
    ['incomoda', 'O que mais incomoda hoje?', 'long'],
    ['manter', 'Tem algo que precisa ficar? (móveis, eletros, objetos com história)', 'long'],
  ]),
  ...qs('necessidades', extra),
  ...qs('espaco', [photos('fotos', 'Fotos do espaço como está hoje', tips), ['medidas', 'Tem as medidas ou a planta?', 'choice', opts('tenho a planta', 'tenho algumas medidas', 'não tenho, preciso de levantamento')]]),
  ...styleBlock(),
  ...qs('prazo', [
    ['prazo', 'Para quando precisa pronto?', 'text', field('deadline')],
    budget('prazo', HOME_BUDGET),
  ]),
]
const ROOM_SECTIONS = [
  sec('uso', 'como vocês usam', 'quem usa, rotina e o que incomoda hoje'),
  sec('necessidades', 'o que precisa ter'),
  sec('espaco', 'o espaço hoje', 'fotos e medidas'),
  sec('estilo', 'estilo e referências', 'toque nas imagens que têm a sua cara'),
  sec('prazo', 'prazo e investimento'),
]
const ROOM_TIPS = ['uma foto de cada parede, de frente', 'piso e teto', 'janelas, portas e tomadas', 'móveis que vão continuar']

/** Briefing de um negócio. */
const business = (kind: string, extra: Q[], tips: string[]): BriefingQuestion[] => [
  ...qs('empresa', [
    ['nome', `Nome do ${kind}`],
    ['historia', 'Conte a história do negócio e o que ele oferece', 'long'],
    ['equipe', 'Quantas pessoas trabalham no espaço? Em quais funções?', 'long'],
    ['horario', 'Dias e horários de funcionamento'],
  ]),
  ...qs('publico', [
    ['publico', 'Quem é o seu cliente? (idade, estilo, o que procura)', 'long'],
    ['movimento', 'Quantas pessoas passam por dia, em média?'],
    ['fluxo', 'Como é o caminho do cliente lá dentro? (chega, espera, é atendido, paga…)', 'long'],
  ]),
  ...qs('espaco', [
    ['endereco', 'Endereço do imóvel', 'text', field('propertyAddress')],
    ['metragem', 'Metragem aproximada (m²)', 'text', field('propertyArea')],
    ['posse', 'O imóvel é', 'choice', { ...opts('próprio', 'alugado', 'em negociação', 'em shopping / galeria'), ...field('propertyOwnership') }],
    ...extra,
    photos('fotos', 'Fotos do espaço hoje', tips),
  ]),
  ...qs('marca', [
    ['logo', 'Logo e identidade visual', 'photos', { hint: 'A logo e, se tiver, o manual da marca.', tips: ['logo em boa qualidade', 'cores e fontes da marca', 'embalagens, cardápio ou uniforme'] }],
    ['sensacao', 'Que sensação o cliente deve ter ao entrar?', 'multi', opts('acolhimento', 'sofisticação', 'rapidez e praticidade', 'descontração', 'confiança', 'exclusividade', 'calma')],
    ['concorrentes', 'Concorrentes ou espaços que você admira', 'long'],
  ]),
  ...styleBlock(),
  ...qs('prazo', [
    ['inauguracao', 'Data desejada para abrir (ou reabrir)', 'date'],
    ['obra', 'Pode fechar durante a obra?', 'choice', opts('sim', 'não, precisa continuar funcionando', 'só alguns dias')],
    budget('prazo', BIZ_BUDGET, 'Quanto pretende investir na obra (sem o projeto)?'),
    ['obs', 'Mais alguma coisa importante?', 'long'],
  ]),
]
const BIZ_SECTIONS = [
  sec('empresa', 'sobre o negócio'),
  sec('publico', 'clientes e funcionamento'),
  sec('espaco', 'o espaço', 'o que precisa ter e como está hoje'),
  sec('marca', 'marca e sensação'),
  sec('estilo', 'estilo e referências', 'toque nas imagens que têm a cara do negócio'),
  sec('prazo', 'prazo e investimento'),
]
const BIZ_TIPS = ['fachada, de longe e de perto', 'o interior, de cada canto', 'banheiros e copa', 'quadro de luz, piso e forro', 'o que já existe e pode ser aproveitado']

export const BUILTIN_BRIEFINGS: BriefingTemplate[] = [
  /* ---------------- projetos completos ---------------- */
  {
    id: 'residencial',
    group: 'completo',
    name: 'Residencial completo',
    description: 'casa ou apartamento inteiro: família, rotina, ambientes, estilo e investimento',
    icon: 'home',
    sections: BRIEFING_SECTIONS.map((s) => sec(s.id, s.label, s.hint)),
    questions: [
      ...DEFAULT_BRIEFING,
      { id: 'imovel-fotos', section: 'imovel', label: 'Fotos do imóvel hoje', kind: 'photos', hint: 'De cada ambiente, com boa luz.', tips: ['cada ambiente, de dois cantos opostos', 'a planta, se tiver (foto do papel serve)', 'o que vai ficar: móveis, eletros, obras de arte'] },
      { id: 'estilo-imagens', section: 'estilo', label: 'Imagens de referência que vocês gostam', kind: 'photos', hint: 'Prints do Pinterest ou do Instagram servem.' },
    ],
  },
  {
    id: 'studio',
    group: 'completo',
    name: 'Studio / apartamento compacto',
    description: 'poucos metros, muita coisa: dormir, trabalhar, cozinhar e receber no mesmo espaço',
    icon: 'cube',
    sections: [sec('voce', 'quem mora'), sec('rotina', 'rotina no studio'), sec('necessidades', 'o que precisa caber'), sec('espaco', 'o imóvel'), sec('estilo', 'estilo e referências', 'toque nas imagens que têm a sua cara'), sec('prazo', 'prazo e investimento')],
    questions: [
      ...qs('voce', [
        ['sozinho', 'Você mora sozinho(a)?', 'choice', opts('sim', 'não')],
        ['quem', 'Quem mora com você?', 'long', { showIf: { q: 'voce-sozinho', value: 'não' }, ...field('household') }],
        ['pets', 'Tem pets?', 'text', field('pets')],
        ['profissao', 'Profissão', 'text', field('profession')],
      ]),
      ...qs('rotina', [
        ['casa', 'Quanto tempo passa em casa?', 'choice', opts('quase o dia todo (trabalho em casa)', 'só à noite e fins de semana', 'viajo bastante')],
        ['cozinha', 'Você cozinha?', 'choice', opts('todo dia', 'às vezes', 'quase nunca')],
        ['recebe', 'Recebe visitas? Quantas pessoas, em geral?'],
        ['dorme', 'Alguém dorme na sua casa às vezes (visita, família)?', 'choice', opts('sim, com frequência', 'raramente', 'nunca')],
      ]),
      ...qs('necessidades', [
        ['itens', 'O que precisa caber?', 'multi', { ...opts('cama de casal', 'sofá-cama', 'mesa de trabalho', 'mesa de jantar', 'máquina de lavar', 'bicicleta', 'guarda-roupa grande', 'área de treino', 'plantas'), other: true }],
        ['separar', 'Quer separar a cama do resto do espaço?', 'choice', opts('sim, com divisória ou cortina', 'não, gosto integrado', 'não sei')],
        ['guardar', 'O que mais precisa guardar? (roupas, livros, equipamentos…)', 'long'],
      ]),
      ...qs('espaco', [
        ['endereco', 'Endereço / condomínio', 'text', field('propertyAddress')],
        ['metragem', 'Metragem (m²)', 'text', field('propertyArea')],
        ['posse', 'O imóvel é', 'choice', { ...opts('próprio', 'alugado', 'na planta'), ...field('propertyOwnership') }],
        ['obra', 'Pode fazer obra (quebrar parede, mudar piso)?', 'choice', opts('sim', 'só pequenas mudanças', 'não, só mobiliar e decorar')],
        photos('fotos', 'Fotos do studio hoje', ['a entrada', 'cada parede', 'a cozinha e o banheiro', 'a vista da janela', 'a planta, se tiver']),
      ]),
      ...styleBlock(),
      ...qs('prazo', [['prazo', 'Para quando precisa pronto?', 'text', field('deadline')], budget('prazo', HOME_BUDGET)]),
    ],
  },
  {
    id: 'arquitetonico',
    group: 'completo',
    name: 'Arquitetônico (construção ou reforma)',
    description: 'terreno, família, programa de necessidades, técnica, áreas externas e orçamento da obra',
    icon: 'compass',
    sections: [
      sec('familia', 'quem vai morar'),
      sec('terreno', 'o terreno ou imóvel'),
      sec('programa', 'os ambientes', 'o que a casa precisa ter'),
      sec('suites', 'quartos e banheiros'),
      sec('externa', 'áreas externas e lazer'),
      sec('tecnica', 'técnica e tecnologia', 'telhado, esquadrias, energia e automação'),
      sec('estilo', 'conceito e estilo', 'toque nas imagens que têm a sua cara'),
      sec('prazo', 'prazo e investimento'),
    ],
    questions: [
      ...qs('familia', [
        ['moradores', 'Quem vai morar? (idades e profissões)', 'long', field('household')],
        ['futuro', 'A família deve crescer ou mudar nos próximos anos?', 'long'],
        ['idosos', 'Alguém precisa de acessibilidade (idoso, cadeirante, mobilidade reduzida)?', 'choice', opts('sim', 'não', 'pensando no futuro')],
        ['pets', 'Pets', 'text', field('pets')],
        ['rotina', 'Rotina: quem trabalha em casa, recebe visitas, cozinha…', 'long', field('routine')],
      ]),
      ...qs('terreno', [
        ['tipo', 'É construção nova ou reforma?', 'choice', opts('construção nova', 'reforma', 'ampliação')],
        ['endereco', 'Endereço / lote / condomínio', 'text', field('propertyAddress')],
        ['dimensoes', 'Dimensões do terreno (frente × fundo) ou área construída atual'],
        ['topografia', 'O terreno é', 'choice', opts('plano', 'em aclive (sobe)', 'em declive (desce)', 'não sei')],
        ['sol', 'Sabe para onde bate o sol da manhã?', 'text', { hint: 'Se não souber, sem problema: vemos na visita.' }],
        ['docs', 'Documentos que você já tem', 'multi', opts('escritura', 'IPTU', 'levantamento topográfico', 'sondagem do solo', 'planta antiga', 'regras do condomínio', 'nenhum ainda')],
        photos('fotos', 'Fotos do terreno ou do imóvel', ['da rua, de frente', 'os fundos e as laterais', 'os vizinhos (altura das construções)', 'árvores, postes e calçada']),
      ]),
      ...qs('programa', [
        ['pavimentos', 'Quantos pavimentos imagina?', 'choice', opts('térrea', 'sobrado (2)', '3 ou mais', 'não sei')],
        ['ambientes', 'Quais ambientes a casa precisa ter?', 'multi', { ...opts('sala de estar', 'sala de jantar', 'sala de TV', 'cozinha integrada', 'cozinha fechada', 'despensa', 'lavanderia', 'escritório', 'lavabo', 'quarto de hóspedes', 'dependência de serviço', 'adega', 'academia'), other: true }],
        ['cozinha', 'Formato de cozinha que te agrada', 'choice', withArt(KITCHEN_ART)],
        ['equipamentos', 'Equipamentos que precisam ter lugar', 'multi', { ...opts('geladeira duplex', 'cooktop', 'forno de embutir', 'lava-louças', 'adega climatizada', 'máquina de lavar e secar', 'home theater', 'freezer extra'), other: true }],
        ['garagem', 'Garagem para quantos carros? Coberta?'],
      ]),
      ...qs('suites', [
        ['quartos', 'Quantos quartos? Quantos deles são suítes?'],
        ['closet', 'Quais quartos têm closet?', 'text'],
        ['cama', 'Tamanho da cama do casal', 'choice', withArt(BED_ART)],
        ['banho', 'No banheiro principal, o que não pode faltar?', 'multi', { ...opts('box amplo', 'banheira', 'duas cubas', 'ducha higiênica', 'nicho no box', 'janela / luz natural', 'aquecimento no piso'), other: true }],
      ]),
      ...qs('externa', [
        ['lazer', 'Área externa e lazer', 'multi', { ...opts('varanda', 'área gourmet', 'churrasqueira', 'piscina', 'jardim', 'horta', 'playground', 'espaço pet', 'fire pit'), other: true }],
        ['piscina', 'Sobre a piscina: tamanho e se é aquecida', 'text', { showIf: { q: 'externa-lazer', value: 'piscina' } }],
        ['gourmet', 'Na área gourmet, o que precisa ter?', 'multi', { ...opts('churrasqueira', 'forno de pizza', 'cooktop', 'pia', 'geladeira / cervejeira', 'mesa para 8+'), showIf: { q: 'externa-lazer', value: 'área gourmet' } }],
      ]),
      ...qs('tecnica', [
        ['telhado', 'Telhado', 'choice', opts('aparente (telha à vista)', 'embutido (atrás da platibanda)', 'laje impermeabilizada', 'não sei')],
        ['esquadrias', 'Janelas e portas', 'choice', opts('alumínio', 'PVC', 'madeira', 'não sei ainda')],
        ['tecnologia', 'Tem interesse em', 'multi', opts('energia solar', 'aquecimento a gás', 'reúso de água da chuva', 'automação', 'câmeras e alarme', 'carregador de carro elétrico', 'ar-condicionado central', 'nenhum destes')],
      ]),
      ...styleBlock(),
      ...qs('prazo', [
        ['prazo', 'Quando quer começar a obra?', 'text', field('deadline')],
        budget('prazo', ['até R$ 300 mil', 'R$ 300 a 600 mil', 'R$ 600 mil a 1 milhão', 'acima de R$ 1 milhão'], 'Quanto pretende investir na obra?'),
        ['obs', 'Mais alguma coisa que eu deveria saber?', 'long'],
      ]),
    ],
  },

  /* ---------------- ambientes ---------------- */
  {
    id: 'living',
    group: 'ambiente',
    name: 'Living (estar e jantar)',
    description: 'sala de estar, TV e jantar: como a família usa e como recebe',
    icon: 'sofa',
    sections: ROOM_SECTIONS,
    questions: room('a sala', [
      ['usos', 'A sala é para', 'multi', opts('ver TV / filmes', 'receber visitas', 'jantar', 'crianças brincarem', 'trabalhar', 'ler', 'ouvir música')],
      ['pessoas', 'Quantas pessoas sentam no dia a dia? E em dia de visita?'],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('sofá grande', 'chaise', 'poltronas', 'painel de TV', 'aparador', 'bar / carrinho de bebidas', 'estante de livros', 'lareira'), other: true }],
      ['mesa', 'Mesa de jantar para quantos lugares?'],
    ], [...ROOM_TIPS, 'a vista da janela']),
  },
  {
    id: 'cozinha',
    group: 'ambiente',
    name: 'Cozinha',
    description: 'formato, eletros, bancadas, armários e como a família cozinha',
    icon: 'box',
    sections: ROOM_SECTIONS,
    questions: room('a cozinha', [
      ['uso', 'Como vocês cozinham?', 'choice', opts('todo dia, bastante', 'o básico', 'quase não cozinham')],
      ['formato', 'Formato que te agrada', 'choice', withArt(KITCHEN_ART)],
      ['eletros', 'Eletros que precisam caber', 'multi', { ...opts('geladeira duplex', 'cooktop', 'forno de embutir', 'micro-ondas', 'lava-louças', 'adega', 'air fryer', 'cafeteira', 'purificador'), other: true }],
      ['gas', 'Fogão ou cooktop a', 'choice', opts('gás', 'indução', 'não sei')],
      ['integrada', 'Cozinha integrada à sala?', 'choice', opts('sim', 'não', 'tanto faz')],
      ['refeicoes', 'Onde fazem as refeições do dia a dia?', 'choice', opts('mesa na cozinha', 'bancada / ilha', 'sala de jantar')],
    ], [...ROOM_TIPS, 'pontos de água, gás e esgoto', 'eletros que vão ficar']),
  },
  {
    id: 'gourmet',
    group: 'ambiente',
    name: 'Área gourmet',
    description: 'churrasqueira, forno, bancada e quantas pessoas recebe',
    icon: 'heart',
    sections: ROOM_SECTIONS,
    questions: room('a área gourmet', [
      ['pessoas', 'Quantas pessoas costuma receber?'],
      ['churras', 'Vai ter churrasqueira?', 'choice', opts('sim', 'não')],
      ['tipo', 'Qual churrasqueira?', 'choice', { ...opts('a carvão', 'a gás', 'elétrica', 'parrilla', 'não sei'), showIf: { q: 'necessidades-churras', value: 'sim' } }],
      ['itens', 'O que mais precisa ter?', 'multi', { ...opts('forno de pizza', 'cooktop', 'pia', 'geladeira / cervejeira', 'adega', 'TV', 'lavabo perto', 'mesa grande', 'bancada com banquetas'), other: true }],
      ['coberta', 'É coberta?', 'choice', opts('totalmente', 'em parte', 'não, é ao ar livre')],
    ], ['a área inteira, de longe', 'onde fica a churrasqueira ou onde vai ficar', 'o piso e o teto', 'pontos de água e gás']),
  },
  {
    id: 'dormitorio',
    group: 'ambiente',
    name: 'Dormitório (casal ou solteiro)',
    description: 'cama, armário, iluminação e o que acontece no quarto',
    icon: 'sofa',
    sections: ROOM_SECTIONS,
    questions: room('o quarto', [
      ['cama', 'Tamanho da cama', 'choice', withArt(BED_ART)],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('armário grande', 'closet', 'escrivaninha', 'penteadeira', 'poltrona de leitura', 'TV', 'cortina blackout', 'cabeceira estofada'), other: true }],
      ['dorme', 'Algum dos dois dorme mais cedo, lê na cama, trabalha à noite?', 'long'],
      ['guardar', 'O que precisa guardar no quarto? (roupas, malas, cobertores…)', 'long'],
    ], [...ROOM_TIPS, 'o guarda-roupa aberto']),
  },
  {
    id: 'infantil',
    group: 'ambiente',
    name: 'Dormitório infantil',
    description: 'idade, brincadeiras, estudo e um quarto que cresce com a criança',
    icon: 'star',
    sections: [sec('crianca', 'sobre a criança'), sec('necessidades', 'o que o quarto precisa ter'), sec('espaco', 'o espaço hoje', 'fotos e medidas'), sec('estilo', 'estilo e referências', 'toque nas imagens que têm a cara dela'), sec('prazo', 'prazo e investimento')],
    questions: [
      ...qs('crianca', [
        ['nome', 'Nome e idade da criança (ou previsão de nascimento)'],
        ['divide', 'Vai dividir o quarto com alguém?', 'choice', opts('não', 'sim')],
        ['quem', 'Com quem? Nomes e idades', 'text', { showIf: { q: 'crianca-divide', value: 'sim' } }],
        ['gosta', 'Do que ela gosta? (cores, personagens, esportes, bichos)', 'long'],
        ['rotina', 'Como é a rotina: dorme sozinha, brinca no quarto, estuda?', 'long'],
      ]),
      ...qs('necessidades', [
        ['cama', 'Cama', 'choice', opts('berço', 'berço que vira cama', 'cama montessoriana (no chão)', 'cama de solteiro', 'beliche / treliche', 'bicama')],
        ['itens', 'O que precisa ter?', 'multi', { ...opts('trocador', 'poltrona de amamentação', 'área de brincar', 'escrivaninha para estudo', 'estante para livros', 'baú de brinquedos', 'parede para desenhar', 'cabana / casinha'), other: true }],
        ['crescer', 'Quer um quarto que dure até a adolescência?', 'choice', opts('sim, pensado para crescer junto', 'não, para esta fase')],
        ['seguranca', 'Algum cuidado especial? (alergia, sono leve, segurança nas janelas)', 'long'],
      ]),
      ...qs('espaco', [photos('fotos', 'Fotos do quarto hoje', [...ROOM_TIPS, 'a janela (altura e tipo)']), ['medidas', 'Tem as medidas ou a planta?', 'choice', opts('tenho a planta', 'tenho algumas medidas', 'não tenho, preciso de levantamento')]]),
      ...styleBlock(),
      ...qs('prazo', [['prazo', 'Para quando precisa pronto?', 'text', field('deadline')], budget('prazo', ['até R$ 10 mil', 'R$ 10 a 25 mil', 'R$ 25 a 50 mil', 'acima de R$ 50 mil'])]),
    ],
  },
  {
    id: 'closet',
    group: 'ambiente',
    name: 'Closet',
    description: 'formato, quantidade de roupas, sapatos, acessórios e iluminação',
    icon: 'layers',
    sections: ROOM_SECTIONS,
    questions: room('o closet', [
      ['formato', 'Formato que te agrada', 'choice', withArt(CLOSET_ART)],
      ['divide', 'É dividido por duas pessoas?', 'choice', opts('sim, meio a meio', 'sim, mas um usa mais', 'não')],
      ['cabides', 'Mais roupas de pendurar ou dobradas?', 'choice', opts('mais pendurar', 'mais dobradas', 'meio a meio')],
      ['sapatos', 'Quantos pares de sapato, mais ou menos?'],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('sapateira', 'gaveteiro com divisórias para joias', 'espelho de corpo inteiro', 'penteadeira', 'maleiro', 'cabideiro para roupa longa', 'porta de vidro', 'iluminação dentro dos armários'), other: true }],
    ], ['o espaço vazio ou o armário atual aberto', 'as paredes, piso e teto', 'tomadas e janela']),
  },
  {
    id: 'banheiro',
    group: 'ambiente',
    name: 'Banheiro',
    description: 'box, bancada, nichos, metais e o que guardar',
    icon: 'layers',
    sections: ROOM_SECTIONS,
    questions: room('o banheiro', [
      ['itens', 'O que precisa ter?', 'multi', { ...opts('box amplo', 'banheira', 'nicho no box', 'bancada dupla', 'armário grande', 'espelho com luz', 'ducha higiênica', 'aquecimento no piso'), other: true }],
      ['metais', 'Cor dos metais', 'choice', opts('cromado', 'preto fosco', 'dourado', 'inox escovado', 'não sei')],
      ['guardar', 'O que precisa guardar no banheiro?', 'long'],
    ], ['o box', 'a bancada e o vaso', 'piso, paredes e teto', 'registros e ralo']),
  },
  {
    id: 'lavabo',
    group: 'ambiente',
    name: 'Lavabo',
    description: 'pequeno e marcante: o cartão de visita da casa',
    icon: 'sparkle',
    sections: ROOM_SECTIONS,
    questions: room('o lavabo', [
      ['impacto', 'Quer um lavabo', 'choice', opts('marcante, com papel de parede ou cor forte', 'elegante e discreto', 'não sei, quero sugestões')],
      ['cuba', 'Tipo de cuba', 'choice', opts('de apoio', 'esculpida na pedra', 'de embutir', 'não sei')],
    ], ['as quatro paredes', 'a bancada e o vaso', 'o teto e a iluminação atual']),
  },
  {
    id: 'lavanderia',
    group: 'ambiente',
    name: 'Lavanderia',
    description: 'máquinas, varal, produtos e onde passar roupa',
    icon: 'box',
    sections: ROOM_SECTIONS,
    questions: room('a lavanderia', [
      ['maquinas', 'Máquinas', 'multi', opts('lavadora', 'secadora', 'lava e seca', 'tanquinho')],
      ['empilhar', 'Pode empilhar lavadora e secadora?', 'choice', { ...opts('sim', 'não'), showIf: { q: 'necessidades-maquinas', value: 'secadora' } }],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('tanque', 'varal de teto', 'varal de chão', 'bancada para dobrar', 'lugar para passar roupa', 'armário para produtos', 'lugar para vassouras e aspirador', 'espaço pet'), other: true }],
      ['integrada', 'Fica aparente para a cozinha?', 'choice', opts('sim, quero esconder', 'sim, pode ficar à vista', 'não, é separada')],
    ], ['o espaço inteiro', 'pontos de água e esgoto', 'tomadas', 'a janela']),
  },
  {
    id: 'home-office',
    group: 'ambiente',
    name: 'Home office',
    description: 'rotina de trabalho, equipamentos, conforto e videochamadas',
    icon: 'briefcase',
    sections: ROOM_SECTIONS,
    questions: room('o home office', [
      ['horas', 'Quantas horas por dia você trabalha ali?'],
      ['pessoas', 'Quantas pessoas trabalham ao mesmo tempo?'],
      ['equip', 'Equipamentos', 'multi', { ...opts('1 monitor', '2 monitores', 'notebook', 'impressora', 'mesa digitalizadora', 'arquivo de papéis', 'cadeira ergonômica'), other: true }],
      ['video', 'Faz videochamadas? O que aparece atrás de você importa?', 'choice', opts('sim, muito', 'às vezes', 'não')],
      ['divide', 'O espaço também é quarto de hóspedes ou outra coisa?', 'text'],
    ], [...ROOM_TIPS, 'onde bate o sol']),
  },

  {
    id: 'adolescente',
    group: 'ambiente',
    name: 'Quarto de adolescente',
    description: 'estudo, games, amigos e personalidade, sem cara de quarto de criança',
    icon: 'cap',
    sections: ROOM_SECTIONS,
    questions: room('o quarto', [
      ['idade', 'Idade e o que curte (música, games, esportes, arte)', 'long'],
      ['cama', 'Tamanho da cama', 'choice', withArt(BED_ART)],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('mesa de estudo', 'setup de games / computador', 'cama extra para amigos', 'parede para fotos e pôsteres', 'espelho grande', 'estante', 'puffs'), other: true }],
      ['opina', 'O próprio adolescente vai participar das escolhas?', 'choice', opts('sim, vai responder junto', 'não, é surpresa')],
    ], [...ROOM_TIPS, 'o que ele(a) mais gosta no quarto hoje']),
  },
  {
    id: 'varanda',
    group: 'ambiente',
    name: 'Varanda',
    description: 'descanso, plantas, refeições ao ar livre e proteção do sol e da chuva',
    icon: 'leaf',
    sections: ROOM_SECTIONS,
    questions: room('a varanda', [
      ['uso', 'A varanda vai ser para', 'multi', opts('descansar e ler', 'fazer refeições', 'receber amigos', 'cuidar de plantas', 'as crianças / pets brincarem', 'trabalhar')],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('jardim vertical', 'rede', 'mesa', 'banco com baú', 'churrasqueira elétrica', 'cortina ou persiana', 'fechamento em vidro'), other: true }],
      ['sol', 'Bate sol forte? Em qual período?', 'choice', opts('de manhã', 'à tarde', 'o dia todo', 'quase não bate')],
      ['regras', 'O condomínio tem regras para a fachada?', 'choice', opts('sim', 'não', 'não sei')],
    ], ['a varanda inteira', 'o piso e o teto', 'a vista', 'tomadas e ponto de água']),
  },

  /* ---------------- comercial ---------------- */
  {
    id: 'comercial',
    group: 'comercial',
    name: 'Comercial (geral)',
    description: 'loja, escritório, consultório ou restaurante: marca, público, equipe e funcionamento',
    icon: 'building',
    sections: [sec('empresa', 'sobre a empresa'), sec('publico', 'clientes e funcionamento'), sec('espaco', 'o espaço'), sec('marca', 'marca e estilo'), sec('prazo', 'prazo e investimento')],
    questions: [
      ...qs('empresa', [
        ['nome', 'Nome da empresa'],
        ['ramo', 'Ramo de atuação', 'choice', { ...opts('loja', 'escritório', 'consultório / clínica', 'restaurante / café', 'salão / estética', 'outro'), other: true }],
        ['historia', 'Conte um pouco da empresa e do que ela vende ou faz', 'long'],
        ['equipe', 'Quantas pessoas trabalham no espaço? Quais funções?', 'long'],
      ]),
      ...qs('publico', [
        ['publico', 'Quem é o seu cliente? (idade, estilo, o que procura)', 'long'],
        ['horario', 'Horário de funcionamento'],
        ['movimento', 'Quantos clientes por dia, em média?'],
        ['fluxo', 'Como o cliente circula? (entra, espera, é atendido, paga…)', 'long'],
      ]),
      ...qs('espaco', [
        ['endereco', 'Endereço do imóvel', 'text', field('propertyAddress')],
        ['metragem', 'Metragem aproximada (m²)', 'text', field('propertyArea')],
        ['posse', 'O imóvel é', 'choice', { ...opts('próprio', 'alugado', 'em negociação'), ...field('propertyOwnership') }],
        ['precisa', 'O que o espaço precisa ter?', 'multi', { ...opts('recepção / espera', 'vitrine', 'caixa / balcão', 'estoque', 'copa / cozinha', 'banheiro para clientes', 'sala de reunião', 'área de atendimento reservada', 'acessibilidade'), other: true }],
        ['equipamentos', 'Equipamentos ou móveis específicos do ramo', 'long'],
        ['fotos', 'Fotos do espaço hoje', 'photos', { hint: 'Frente, interior e detalhes (piso, forro, elétrica).' }],
      ]),
      ...qs('marca', [
        ['logo', 'Logo e identidade visual', 'photos', { hint: 'Mande a logo e, se tiver, o manual da marca.' }],
        ['sensacao', 'Que sensação o cliente deve ter ao entrar?', 'multi', opts('acolhimento', 'sofisticação', 'rapidez', 'descontração', 'confiança', 'exclusividade')],
        ['refs', 'Espaços que você admira (links ou prints)', 'photos'],
        ['nao', 'O que não pode ter de jeito nenhum?', 'long'],
      ]),
      ...qs('prazo', [
        ['inauguracao', 'Data de inauguração desejada', 'date'],
        ['investimento', 'Quanto pretende investir na obra (sem o projeto)?', 'choice', { ...opts('até R$ 50 mil', 'R$ 50 a 150 mil', 'R$ 150 a 300 mil', 'acima de R$ 300 mil', 'prefiro conversar'), ...field('investment') }],
        ['obs', 'Mais alguma coisa importante?', 'long'],
      ]),
    ],
  },
  {
    id: 'escritorio',
    group: 'comercial',
    name: 'Escritório corporativo',
    description: 'estações de trabalho, salas, reuniões e cultura da empresa',
    icon: 'building',
    sections: BIZ_SECTIONS,
    questions: business('escritório', [
      ['estacoes', 'Quantas estações de trabalho? A equipe vai crescer?'],
      ['salas', 'O que precisa ter?', 'multi', { ...opts('recepção', 'sala de reunião', 'sala da diretoria', 'salas de call', 'copa', 'área de descompressão', 'arquivo', 'sala de servidor'), other: true }],
      ['modelo', 'Modelo de trabalho', 'choice', opts('presencial', 'híbrido', 'estações rotativas')],
    ], BIZ_TIPS),
  },
  {
    id: 'loja',
    group: 'comercial',
    name: 'Loja',
    description: 'vitrine, exposição de produtos, provador, caixa e estoque',
    icon: 'box',
    sections: BIZ_SECTIONS,
    questions: business('loja', [
      ['produtos', 'O que a loja vende? Quantos produtos, em média, ficam expostos?', 'long'],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('vitrine', 'provador', 'caixa', 'estoque', 'área de embrulho', 'espaço para fotos / influencers', 'banheiro para clientes'), other: true }],
      ['expor', 'Como os produtos ficam melhor expostos?', 'multi', opts('araras', 'prateleiras', 'mesas', 'nichos iluminados', 'balcão de vidro')],
    ], BIZ_TIPS),
  },
  {
    id: 'restaurante',
    group: 'comercial',
    name: 'Restaurante / café',
    description: 'salão, cozinha, bar, delivery e a experiência de quem come ali',
    icon: 'heart',
    sections: BIZ_SECTIONS,
    questions: business('restaurante', [
      ['lugares', 'Quantos lugares no salão?'],
      ['servico', 'Tipo de serviço', 'multi', opts('à la carte', 'self-service', 'balcão / fast', 'café e padaria', 'bar')],
      ['delivery', 'Trabalha com delivery?', 'choice', opts('sim', 'não')],
      ['retirada', 'Precisa de área separada para retirada dos entregadores?', 'choice', { ...opts('sim', 'não'), showIf: { q: 'espaco-delivery', value: 'sim' } }],
      ['cozinha', 'A cozinha já está definida (equipamentos, fluxo)?', 'choice', opts('sim, tenho o layout', 'em parte', 'não, preciso de ajuda')],
      ['vigilancia', 'Já tem as exigências da vigilância sanitária?', 'choice', opts('sim', 'não', 'não sei')],
    ], [...BIZ_TIPS, 'a cozinha e a área de lavagem']),
  },
  {
    id: 'salao',
    group: 'comercial',
    name: 'Salão de beleza / estética',
    description: 'cadeiras, lavatórios, macas, espera e conforto das clientes',
    icon: 'sparkle',
    sections: BIZ_SECTIONS,
    questions: business('salão', [
      ['servicos', 'Serviços oferecidos', 'multi', { ...opts('cabelo', 'unhas', 'maquiagem', 'sobrancelha e cílios', 'estética facial', 'estética corporal', 'depilação', 'barbearia'), other: true }],
      ['postos', 'Quantas cadeiras, lavatórios e macas?'],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('recepção', 'espera com café', 'sala reservada', 'lavanderia de toalhas', 'estoque de produtos', 'área para fotos (antes e depois)', 'vestiário da equipe'), other: true }],
    ], BIZ_TIPS),
  },
  {
    id: 'clinica',
    group: 'comercial',
    name: 'Clínica / consultório',
    description: 'consultórios, recepção, acessibilidade e normas da área da saúde',
    icon: 'heart',
    sections: BIZ_SECTIONS,
    questions: business('consultório', [
      ['especialidade', 'Especialidade', 'text'],
      ['salas', 'Quantos consultórios ou salas de atendimento?'],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('recepção', 'sala de espera', 'banheiro acessível', 'sala de procedimentos', 'expurgo', 'DML', 'copa da equipe', 'arquivo'), other: true }],
      ['equip', 'Equipamentos específicos (maca, cadeira odontológica, aparelhos)', 'long'],
      ['normas', 'Precisa aprovar na vigilância sanitária?', 'choice', opts('sim', 'não', 'não sei')],
    ], BIZ_TIPS),
  },
  {
    id: 'drogaria',
    group: 'comercial',
    name: 'Drogaria / farmácia',
    description: 'gôndolas, balcão, sala de aplicação, estoque e normas',
    icon: 'box',
    sections: BIZ_SECTIONS,
    questions: business('drogaria', [
      ['itens', 'O que precisa ter?', 'multi', { ...opts('balcão de atendimento', 'gôndolas', 'área de perfumaria', 'sala de aplicação / serviços farmacêuticos', 'estoque', 'área de manipulação', 'drive-thru'), other: true }],
      ['controlados', 'Trabalha com medicamentos controlados?', 'choice', opts('sim', 'não')],
      ['rede', 'Faz parte de uma rede com padrão visual?', 'choice', opts('sim, tem manual', 'não, é independente')],
    ], BIZ_TIPS),
  },
  {
    id: 'igreja',
    group: 'comercial',
    name: 'Igreja / templo',
    description: 'nave, altar, acústica, salas de apoio e acolhimento',
    icon: 'home',
    sections: [sec('empresa', 'sobre a comunidade'), sec('publico', 'celebrações e funcionamento'), sec('espaco', 'o espaço', 'o que precisa ter e como está hoje'), sec('marca', 'identidade'), sec('estilo', 'estilo e referências', 'toque nas imagens que têm a cara da comunidade'), sec('prazo', 'prazo e investimento')],
    questions: business('templo', [
      ['lugares', 'Quantas pessoas por celebração?'],
      ['itens', 'O que precisa ter?', 'multi', { ...opts('altar / palco', 'batistério', 'espaço para louvor e instrumentos', 'salas para crianças', 'salas de estudo', 'cantina', 'secretaria', 'estacionamento'), other: true }],
      ['acustica', 'Tem problema de acústica hoje (eco, barulho da rua)?', 'choice', opts('sim', 'não', 'ainda não sei')],
      ['transmissao', 'Faz transmissão ao vivo?', 'choice', opts('sim', 'não', 'quer começar')],
    ], [...BIZ_TIPS, 'o altar ou palco']),
  },

  { id: 'zero', name: 'Do zero', description: 'comece vazio e monte as suas perguntas', icon: 'plus', sections: [sec('geral', 'perguntas')], questions: [] },
]

export const TEMPLATE_GROUPS: { id: NonNullable<BriefingTemplate['group']>; label: string }[] = [
  { id: 'completo', label: 'projeto completo' },
  { id: 'ambiente', label: 'por ambiente' },
  { id: 'comercial', label: 'comercial' },
]

/** Modelo pelo id: os da pessoa têm prioridade sobre os prontos (quando ela edita um pronto). */
export const findTemplate = (mine: BriefingTemplate[] | undefined, id: string) => mine?.find((t) => t.id === id) ?? BUILTIN_BRIEFINGS.find((t) => t.id === id)
/** Todos os modelos para escolher: os editados substituem os prontos do mesmo id. */
export const allTemplates = (mine: BriefingTemplate[] = []) => [...BUILTIN_BRIEFINGS.map((b) => mine.find((m) => m.id === b.id) ?? b), ...mine.filter((m) => !BUILTIN_BRIEFINGS.some((b) => b.id === m.id))]
export const isBuiltin = (id: string) => BUILTIN_BRIEFINGS.some((b) => b.id === id)
export const KIND_LABEL: Record<BriefingKind, string> = { text: 'resposta curta', long: 'parágrafo', choice: 'uma opção', multi: 'várias opções (check)', photos: 'anexar fotos', date: 'data' }
