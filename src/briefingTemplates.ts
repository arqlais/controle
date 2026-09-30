import type { BriefingKind, BriefingQuestion, BriefingSection, BriefingTemplate, ClientProfile } from './types'
import { BRIEFING_SECTIONS, DEFAULT_BRIEFING } from './briefingQuestions'
import { LIBRARY } from './briefingLibrary'

/* Modelos prontos de briefing. A pessoa usa como estão, edita (vira uma cópia dela)
   ou começa do zero. Tudo editável: perguntas, tipos, opções, imagens e seções. */

type Q = [id: string, label: string, kind?: BriefingKind, extra?: Partial<BriefingQuestion>]
const sec = (id: string, title: string, description = ''): BriefingSection => ({ id, title, description })
const qs = (section: string, list: Q[]): BriefingQuestion[] => list.map(([id, label, kind = 'text', extra = {}]) => ({ id: `${section}-${id}`, section, label, kind, ...extra }))
const opts = (...o: string[]) => ({ options: o })
const field = (f: keyof ClientProfile) => ({ field: f })

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
  ...LIBRARY,
  { id: 'zero', name: 'Do zero', description: 'comece vazio e monte as suas perguntas', icon: 'plus', sections: [sec('geral', 'perguntas')], questions: [] },
]

/** Modelo pelo id: os da pessoa têm prioridade sobre os prontos (quando ela edita um pronto). */
export const findTemplate = (mine: BriefingTemplate[] | undefined, id: string) => mine?.find((t) => t.id === id) ?? BUILTIN_BRIEFINGS.find((t) => t.id === id)
/** Todos os modelos para escolher: os editados substituem os prontos do mesmo id. */
export const allTemplates = (mine: BriefingTemplate[] = [], hidden: string[] = []) => [...BUILTIN_BRIEFINGS.filter((b) => !hidden.includes(b.id)).map((b) => mine.find((m) => m.id === b.id) ?? b), ...mine.filter((m) => !BUILTIN_BRIEFINGS.some((b) => b.id === m.id))]
export const isBuiltin = (id: string) => BUILTIN_BRIEFINGS.some((b) => b.id === id)
export const KIND_LABEL: Record<BriefingKind, string> = { text: 'resposta curta', long: 'parágrafo', choice: 'uma opção', multi: 'várias opções (check)', photos: 'anexar fotos', date: 'data' }

const BIZ = new Set(['comercial', 'escritorio', 'clinica', 'salao', 'restaurante', 'loja', 'drogaria', 'igreja'])
/** Para organizar a lista: casa, comercial ou criado pela pessoa. */
export const templateGroup = (t: BriefingTemplate): 'casa' | 'comercial' | 'meus' => (!isBuiltin(t.id) ? 'meus' : BIZ.has(t.id) ? 'comercial' : 'casa')
