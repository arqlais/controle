import type { ProcessStep, ProjectProcess, Quote, QuoteAudience, ServiceDef, Settings } from './types'
import { uid } from './utils'

/* Processos de trabalho para cliente final. São só pontos de partida:
   cada pessoa muda nomes, o que inclui, prazos e a divisão do pagamento (Configurações → propostas). */

const step = (name: string, description: string, items: string[], days: number, percent: number, dayType: 'uteis' | 'corridos' = 'corridos'): ProcessStep => ({ id: uid(), name, description, items, days, dayType, percent })

export const DEFAULT_PROCESSES = (): ProjectProcess[] => [
  {
    id: 'interiores',
    name: 'projeto de interiores',
    description: 'Do briefing ao acompanhamento, ambiente por ambiente.',
    steps: [
      step('levantamento e briefing', 'Conhecer o espaço, a rotina e o que você espera do projeto.', ['contrato', 'levantamento métrico e fotográfico', 'briefing', 'reunião de alinhamento'], 7, 30),
      step('estudo preliminar', 'Primeiras ideias: a distribuição dos ambientes e o conceito.', ['estudo de layout', 'revisão de layout', 'moodboard'], 20, 20),
      step('anteprojeto', 'O projeto ganha forma para você ver como tudo vai ficar.', ['desenvolvimento criativo', 'modelo 3D', 'imagens renderizadas', 'reunião de apresentação'], 30, 25),
      step('projeto executivo', 'Todos os desenhos e detalhes para a obra sair igual ao projeto.', ['planta demolir × construir', 'planta de layout', 'paginação de piso', 'planta de forro', 'luminotécnico e elétrica', 'detalhamento de marcenaria', 'cortes e vistas', 'memorial descritivo'], 25, 25),
      step('acompanhamento', 'Apoio com fornecedores e visitas durante a obra.', ['visitas à obra', 'apoio com fornecedores', 'planilha de compras'], 0, 0),
    ],
  },
  {
    id: 'arquitetonico',
    name: 'projeto arquitetônico',
    description: 'Da ideia à aprovação na prefeitura e à obra.',
    steps: [
      step('levantamento e briefing', 'Terreno, legislação, programa de necessidades e orçamento da obra.', ['contrato', 'levantamento do terreno', 'consulta à legislação', 'briefing'], 10, 20),
      step('estudo preliminar', 'Implantação, volumetria e distribuição dos ambientes.', ['implantação', 'plantas de estudo', 'volumetria 3D'], 30, 20),
      step('anteprojeto', 'Soluções definidas: plantas, cortes, fachadas e imagens.', ['plantas, cortes e fachadas', 'modelo 3D', 'imagens renderizadas'], 30, 20),
      step('projeto legal', 'Documentação para aprovar na prefeitura.', ['projeto para aprovação', 'ART / RRT', 'protocolo e acompanhamento'], 20, 15),
      step('projeto executivo', 'Detalhes para construir sem improviso.', ['plantas executivas', 'detalhamentos', 'compatibilização com os complementares', 'memorial descritivo'], 40, 25),
      step('acompanhamento de obra', 'Visitas para garantir que a obra siga o projeto.', ['visitas à obra', 'relatórios de visita'], 0, 0),
    ],
  },
  {
    id: 'consultoria',
    name: 'consultoria online',
    description: 'Orientação por videochamada, sem projeto completo.',
    steps: [
      step('briefing online', 'Você manda fotos, medidas e o que deseja.', ['formulário de briefing', 'fotos e medidas do espaço'], 3, 50),
      step('videochamada', 'Conversamos sobre as soluções para o seu espaço.', ['reunião de 1h30', 'sugestões de layout, cores e materiais'], 7, 0),
      step('material final', 'Um guia com tudo o que combinamos, para você executar.', ['layout simplificado', 'referências e lista de compras'], 7, 50),
    ],
  },
]

/** Processos da conta (os prontos, se ainda não mexeu). */
export const processesOf = (s: Settings): ProjectProcess[] => (s.processes?.length ? s.processes : DEFAULT_PROCESSES())

/** Copia as etapas (com ids novos) para usar num orçamento. */
export const cloneSteps = (steps: ProcessStep[]) => steps.map((x) => ({ ...x, id: uid(), items: [...x.items] }))

/** Para quem o orçamento é (antigos, sem escolha: escritório parceiro). */
export const quoteAudience = (q: Quote): QuoteAudience => q.audience ?? 'parceiro'

/** Para quem o serviço aparece: o que a pessoa marcou, senão pelo tipo (serviços de arquitetura = cliente final). */
export function serviceAudience(sv: ServiceDef): 'final' | 'parceiro' | 'ambos' {
  if (sv.audience) return sv.audience
  if (sv.id === 'personalizado') return 'ambos'
  return sv.id.startsWith('arq-') ? 'final' : 'parceiro'
}

/** Serviços que fazem sentido para este público (se nenhum servir, mostra todos). */
export function servicesForAudience(services: ServiceDef[], audience: QuoteAudience) {
  const list = services.filter((sv) => serviceAudience(sv) === 'ambos' || serviceAudience(sv) === audience)
  return list.some((sv) => sv.id !== 'personalizado') ? list : services
}

export const stepsPercent = (steps: ProcessStep[] = []) => Math.round(steps.reduce((n, x) => n + (x.percent || 0), 0) * 100) / 100

export const dayLabel = (x: ProcessStep) => (x.days > 0 ? `${x.days} dias ${x.dayType === 'uteis' ? 'úteis' : 'corridos'}` : '')

export const AUDIENCES: { id: QuoteAudience; title: string; short: string; text: string; example: string }[] = [
  {
    id: 'final',
    title: 'cliente final',
    short: 'quem vai morar ou usar o espaço',
    text: 'Proposta completa em slides (16:9): apresentação, etapas do projeto, prazos, investimento e pagamento dividido por etapa.',
    example: 'Ex.: a Ana quer o projeto de interiores do apartamento dela.',
  },
  {
    id: 'parceiro',
    title: 'escritório parceiro',
    short: 'prestação de serviço freelancer',
    text: 'Proposta objetiva em uma folha: serviços, valores e prazo. Pode virar parceria mensal.',
    example: 'Ex.: um escritório pede 10 imagens 3D ou o detalhamento de um projeto.',
  },
]
