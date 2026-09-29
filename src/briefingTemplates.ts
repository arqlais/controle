import type { BriefingKind, BriefingQuestion, BriefingSection, BriefingTemplate, ClientProfile } from './types'
import { BRIEFING_SECTIONS, DEFAULT_BRIEFING } from './briefingQuestions'

/* Modelos prontos de briefing. A pessoa usa como estão, edita (vira uma cópia dela)
   ou começa do zero. Tudo editável: perguntas, tipos, opções, imagens e seções. */

type Q = [id: string, label: string, kind?: BriefingKind, extra?: Partial<BriefingQuestion>]
const sec = (id: string, title: string, description = ''): BriefingSection => ({ id, title, description })
const qs = (section: string, list: Q[]): BriefingQuestion[] => list.map(([id, label, kind = 'text', extra = {}]) => ({ id: `${section}-${id}`, section, label, kind, ...extra }))
const opts = (...o: string[]) => ({ options: o })
const field = (f: keyof ClientProfile) => ({ field: f })

/** Perguntas que se repetem nos briefings por ambiente. */
const room = (name: string, extra: Q[]): BriefingTemplate['questions'] =>
  qs('uso', [
    ['quem', `Quem usa ${name}?`, 'long'],
    ['rotina', `Como é o dia a dia n${name.startsWith('a ') ? 'a' : 'o'} ${name.replace(/^(a|o) /, '')}?`, 'long'],
    ['incomoda', 'O que mais incomoda hoje?', 'long'],
    ['manter', 'Tem algo que precisa ficar (móveis, eletros, objetos)?', 'long'],
  ]).concat(
    qs('necessidades', extra),
    qs('estilo', [
      ['estilo', 'Com qual estilo você se identifica?', 'multi', opts('aconchegante', 'moderno', 'minimalista', 'clássico', 'industrial', 'rústico', 'contemporâneo', 'ainda não sei')],
      ['cores', 'Cores e materiais que você ama', 'long'],
      ['nao', 'O que você NÃO quer de jeito nenhum?', 'long'],
      ['fotos', 'Fotos do espaço hoje (se tiver)', 'photos', { hint: 'Pode tirar pelo celular: de cada canto, com boa luz.' }],
      ['refs', 'Imagens de referência que você gosta', 'photos', { hint: 'Prints do Pinterest ou Instagram servem.' }],
    ]),
    qs('prazo', [
      ['prazo', 'Para quando precisa pronto?', 'text', field('deadline')],
      ['investimento', 'Quanto pretende investir (sem o projeto)?', 'choice', { ...opts('até R$ 10 mil', 'R$ 10 a 30 mil', 'R$ 30 a 60 mil', 'acima de R$ 60 mil', 'prefiro conversar'), ...field('investment') }],
    ]),
  )
const ROOM_SECTIONS = [sec('uso', 'como vocês usam', 'quem usa, rotina e o que incomoda hoje'), sec('necessidades', 'o que precisa ter'), sec('estilo', 'estilo e referências', 'o que você ama e o que não quer'), sec('prazo', 'prazo e investimento')]

export const BUILTIN_BRIEFINGS: BriefingTemplate[] = [
  {
    id: 'residencial',
    name: 'Residencial completo',
    description: 'casa ou apartamento inteiro: família, rotina, ambientes, estilo e investimento',
    icon: 'home',
    sections: BRIEFING_SECTIONS.map((s) => sec(s.id, s.label, s.hint)),
    questions: [
      ...DEFAULT_BRIEFING,
      { id: 'imovel-fotos', section: 'imovel', label: 'Fotos do imóvel hoje', kind: 'photos', hint: 'De cada ambiente, com boa luz. Se tiver planta, pode mandar foto dela também.' },
      { id: 'estilo-imagens', section: 'estilo', label: 'Imagens de referência que vocês gostam', kind: 'photos', hint: 'Prints do Pinterest ou do Instagram servem.' },
    ],
  },
  {
    id: 'comercial',
    name: 'Comercial',
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
    id: 'arquitetonico',
    name: 'Arquitetônico (construção ou reforma)',
    description: 'terreno, programa de necessidades, pavimentos, áreas externas e orçamento da obra',
    icon: 'compass',
    sections: [sec('familia', 'quem vai morar'), sec('terreno', 'o terreno ou imóvel'), sec('programa', 'programa de necessidades', 'os ambientes e o tamanho de cada um'), sec('externa', 'áreas externas e lazer'), sec('tecnica', 'técnica e sustentabilidade'), sec('prazo', 'prazo e investimento')],
    questions: [
      ...qs('familia', [
        ['moradores', 'Quem vai morar? (idades, profissões)', 'long', field('household')],
        ['futuro', 'A família deve crescer ou mudar nos próximos anos?', 'long'],
        ['pets', 'Pets', 'text', field('pets')],
        ['rotina', 'Rotina: quem trabalha em casa, recebe visitas, cozinha…', 'long', field('routine')],
      ]),
      ...qs('terreno', [
        ['tipo', 'É construção nova ou reforma?', 'choice', opts('construção nova', 'reforma', 'ampliação')],
        ['endereco', 'Endereço / lote / condomínio', 'text', field('propertyAddress')],
        ['dimensoes', 'Dimensões do terreno (frente × fundo) ou área construída atual'],
        ['topografia', 'O terreno é', 'choice', opts('plano', 'em aclive (sobe)', 'em declive (desce)', 'não sei')],
        ['docs', 'Documentos que você já tem', 'multi', opts('escritura', 'IPTU', 'levantamento topográfico', 'planta antiga', 'regras do condomínio', 'nenhum ainda')],
        ['fotos', 'Fotos do terreno ou do imóvel', 'photos', { hint: 'Da rua, dos fundos e dos vizinhos.' }],
      ]),
      ...qs('programa', [
        ['pavimentos', 'Quantos pavimentos imagina?', 'choice', opts('térrea', 'sobrado (2)', '3 ou mais', 'não sei')],
        ['quartos', 'Quantos quartos? Quantas suítes?'],
        ['ambientes', 'Quais ambientes a casa precisa ter?', 'multi', { ...opts('sala de estar', 'sala de jantar', 'cozinha integrada', 'cozinha fechada', 'despensa', 'lavanderia', 'escritório', 'sala de TV', 'lavabo', 'closet', 'quarto de hóspedes', 'dependência de serviço'), other: true }],
        ['garagem', 'Garagem para quantos carros?'],
      ]),
      ...qs('externa', [
        ['lazer', 'Área externa e lazer', 'multi', { ...opts('varanda', 'área gourmet', 'churrasqueira', 'piscina', 'jardim', 'horta', 'playground', 'espaço pet'), other: true }],
        ['refs', 'Fachadas e casas que você gosta', 'photos'],
      ]),
      ...qs('tecnica', [
        ['sustentavel', 'Tem interesse em', 'multi', opts('energia solar', 'reúso de água', 'ventilação e luz natural', 'automação', 'nenhum destes')],
        ['estilo', 'Estilo da arquitetura', 'multi', { ...opts('contemporâneo', 'moderno', 'clássico', 'rústico', 'minimalista', 'não sei'), ...field('style') }],
      ]),
      ...qs('prazo', [
        ['prazo', 'Quando quer começar a obra?', 'text', field('deadline')],
        ['investimento', 'Quanto pretende investir na obra?', 'choice', { ...opts('até R$ 300 mil', 'R$ 300 a 600 mil', 'R$ 600 mil a 1 milhão', 'acima de R$ 1 milhão', 'prefiro conversar'), ...field('investment') }],
        ['obs', 'Mais alguma coisa que eu deveria saber?', 'long'],
      ]),
    ],
  },
  { id: 'cozinha', name: 'Cozinha', description: 'eletros, bancadas, armários e como a família cozinha', icon: 'box', sections: ROOM_SECTIONS, questions: room('a cozinha', [['uso', 'Como vocês cozinham?', 'choice', opts('todo dia, bastante', 'o básico', 'quase não cozinham')], ['eletros', 'Eletros que precisam caber', 'multi', { ...opts('geladeira duplex', 'cooktop', 'forno de embutir', 'micro-ondas', 'lava-louças', 'adega', 'air fryer', 'cafeteira'), other: true }], ['integrada', 'Cozinha integrada à sala?', 'choice', opts('sim', 'não', 'tanto faz')], ['refeicoes', 'Onde fazem as refeições do dia a dia?', 'choice', opts('mesa na cozinha', 'bancada / ilha', 'sala de jantar')]]) },
  { id: 'banheiro', name: 'Banheiro', description: 'box, bancada, nichos e o que guardar', icon: 'layers', sections: ROOM_SECTIONS, questions: room('o banheiro', [['itens', 'O que precisa ter?', 'multi', { ...opts('box amplo', 'banheira', 'nicho no box', 'bancada dupla', 'armário grande', 'espelho com luz', 'aquecimento no piso'), other: true }], ['guardar', 'O que precisa guardar no banheiro?', 'long']]) },
  { id: 'quarto', name: 'Quarto', description: 'cama, armário, estudo ou trabalho e iluminação', icon: 'sofa', sections: ROOM_SECTIONS, questions: room('o quarto', [['cama', 'Tamanho da cama', 'choice', opts('solteiro', 'casal', 'queen', 'king', 'ainda não sei')], ['itens', 'O que precisa ter?', 'multi', { ...opts('armário grande', 'closet', 'escrivaninha', 'penteadeira', 'poltrona de leitura', 'TV', 'blackout'), other: true }], ['crianca', 'É quarto de criança? Idade e o que ela gosta', 'long']]) },
  { id: 'sala', name: 'Sala', description: 'estar, TV, jantar e como recebem as visitas', icon: 'home', sections: ROOM_SECTIONS, questions: room('a sala', [['usos', 'A sala é para', 'multi', opts('ver TV / filmes', 'receber visitas', 'jantar', 'crianças brincarem', 'trabalhar', 'ler')], ['pessoas', 'Quantas pessoas sentam no dia a dia? E em dia de visita?'], ['itens', 'O que precisa ter?', 'multi', { ...opts('sofá grande', 'poltronas', 'painel de TV', 'aparador', 'bar', 'estante de livros'), other: true }]]) },
  { id: 'home-office', name: 'Home office', description: 'rotina de trabalho, equipamentos e videochamadas', icon: 'briefcase', sections: ROOM_SECTIONS, questions: room('o home office', [['horas', 'Quantas horas por dia você trabalha ali?'], ['equip', 'Equipamentos', 'multi', { ...opts('1 monitor', '2 monitores', 'notebook', 'impressora', 'mesa digitalizadora', 'arquivo de papéis'), other: true }], ['video', 'Faz videochamadas? O que aparece atrás de você importa?', 'choice', opts('sim, muito', 'às vezes', 'não')]]) },
  { id: 'zero', name: 'Do zero', description: 'comece vazio e monte as suas perguntas', icon: 'plus', sections: [sec('geral', 'perguntas')], questions: [] },
]

/** Modelo pelo id: os da pessoa têm prioridade sobre os prontos (quando ela edita um pronto). */
export const findTemplate = (mine: BriefingTemplate[] | undefined, id: string) => mine?.find((t) => t.id === id) ?? BUILTIN_BRIEFINGS.find((t) => t.id === id)
/** Todos os modelos para escolher: os editados substituem os prontos do mesmo id. */
export const allTemplates = (mine: BriefingTemplate[] = []) => [...BUILTIN_BRIEFINGS.map((b) => mine.find((m) => m.id === b.id) ?? b), ...mine.filter((m) => !BUILTIN_BRIEFINGS.some((b) => b.id === m.id))]
export const isBuiltin = (id: string) => BUILTIN_BRIEFINGS.some((b) => b.id === id)
export const KIND_LABEL: Record<BriefingKind, string> = { text: 'resposta curta', long: 'parágrafo', choice: 'uma opção', multi: 'várias opções (check)', photos: 'anexar fotos', date: 'data' }
