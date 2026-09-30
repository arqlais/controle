import type { Client, Data, Project, ProcessStep, ProjectProcess, Quote, QuoteAudience, ServiceDef, Settings } from './types'
import { DEFAULT_TASKS, isStudent, uid } from './utils'

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
  {
    id: 'regularizacao',
    name: 'regularização de imóvel',
    description: 'Da análise dos documentos à averbação no cartório.',
    steps: [
      step('levantamento e documentos', 'Entender a situação do imóvel e juntar tudo o que a prefeitura pede.', ['contrato', 'análise da matrícula, IPTU e escritura', 'levantamento métrico no local', 'consulta à legislação do município'], 10, 30),
      step('projeto de regularização', 'Os desenhos do imóvel como ele está hoje, prontos para protocolar.', ['plantas, cortes e fachada do existente', 'quadro de áreas', 'memorial descritivo', 'ART / RRT'], 20, 30),
      step('protocolo na prefeitura', 'Entrada do processo e acompanhamento até a análise.', ['protocolo do processo', 'guias e taxas', 'acompanhamento do andamento'], 15, 20),
      step('exigências e ajustes', 'Se a prefeitura pedir correções (comunique-se), a gente resolve.', ['resposta às exigências', 'ajustes no projeto'], 0, 0),
      step('aprovação e averbação', 'Imóvel regular: habite-se ou certidão e registro no cartório.', ['habite-se / certidão de regularização', 'orientação para a averbação no cartório'], 20, 20),
    ],
  },
]

// processos prontos que já existiam antes (quem mexeu nos processos antes de um novo chegar ganha o novo no fim da lista)
const OLD_DEFAULTS = ['interiores', 'arquitetonico', 'consultoria']

/** Processos da conta (os prontos, se ainda não mexeu). Processos prontos novos entram no fim, uma vez. */
export const processesOf = (s: Settings): ProjectProcess[] => {
  if (!s.processes?.length) return DEFAULT_PROCESSES()
  const known = s.processesKnown ?? OLD_DEFAULTS
  const fresh = DEFAULT_PROCESSES().filter((d) => !known.includes(d.id) && !s.processes!.some((x) => x.id === d.id))
  return fresh.length ? [...s.processes, ...fresh] : s.processes
}
/** Ids dos processos prontos (para marcar como já vistos ao salvar). */
export const defaultProcessIds = () => DEFAULT_PROCESSES().map((d) => d.id)

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

export const AUDIENCES: { id: QuoteAudience; title: string; short: string; text: string; points: string[]; example: string }[] = [
  {
    id: 'final',
    title: 'cliente final',
    short: 'arquitetura e interiores: quem vai morar, trabalhar ou usar o espaço',
    text: 'Proposta em slides (16:9): apresentação, etapas do projeto, prazos, investimento e pagamento dividido por etapa.',
    points: [
      'proposta em slides, com a sua apresentação e fotos de projetos',
      'etapas do seu jeito (briefing, layout, anteprojeto, executivo, obra…)',
      'valor por projeto ou por m², pago em parcelas por etapa',
      'ao fechar, as etapas viram o cronograma e a página do cliente',
    ],
    example: 'Ex.: a Ana quer o projeto de interiores do apartamento; o Carlos vai construir uma casa.',
  },
  {
    id: 'parceiro',
    title: 'freelancer · escritório parceiro',
    short: 'você presta serviço para outro arquiteto, escritório ou construtora (e estudantes)',
    text: 'Proposta objetiva em uma folha: serviços, valores e prazo. Pode virar parceria mensal.',
    points: [
      'proposta de uma folha: serviços, quantidades e valores da sua tabela',
      'por unidade (imagem, prancha, modelagem) e prazo curto',
      'sinal e saldo, ou parceria mensal',
      'estudante entra aqui, com o desconto das configurações',
    ],
    example: 'Ex.: um escritório pede 10 imagens 3D; uma estudante pede ajuda com o TCC.',
  },
]

/** Etapas de uma demanda de estudante: mais simples (sem briefing de obra nem cronograma). */
export const DEFAULT_STUDENT_TASKS = ['Pagamento combinado', 'Arquivos e orientações recebidos', 'Execução', 'Prévia enviada', 'Ajustes', 'Entrega final']

export type WorkKind = 'final' | 'freela' | 'estudante'
/** Que tipo de trabalho é: cliente final, freelancer (escritório parceiro) ou estudante. */
export function workKind(client: Client | undefined, audience?: QuoteAudience): WorkKind {
  if (isStudent(client)) return 'estudante'
  if (audience === 'final' || client?.type === 'final') return 'final'
  return 'freela'
}
/** Checklist da demanda conforme o tipo de trabalho (cada lista é editável em "etapas de trabalho"). */
export function tasksFor(s: Settings, kind: WorkKind, steps?: ProcessStep[]): string[] {
  if (kind === 'estudante') return s.studentTasks?.length ? s.studentTasks : DEFAULT_STUDENT_TASKS
  if (kind === 'final' && steps?.some((x) => x.name.trim())) return steps.filter((x) => x.name.trim()).map((x) => x.name)
  return s.freelaTasks?.length ? s.freelaTasks : DEFAULT_TASKS
}

/** Tipo de trabalho de uma demanda: o escolhido à mão, senão pelo orçamento e pelo cliente. */
export function projectKind(p: Project, d: Pick<Data, 'clients' | 'quotes'>): WorkKind {
  if (p.kind) return p.kind
  const client = d.clients.find((c) => c.id === p.clientId)
  const quote = d.quotes.find((q) => q.projectId === p.id)
  if (isStudent(client)) return 'estudante'
  if (quote?.audience === 'final' || client?.type === 'final' || (p.phases?.length ?? 0) > 0) return 'final'
  return 'freela'
}
export const KIND_LABEL: Record<WorkKind, string> = { final: 'cliente final', freela: 'freelancer / parceiro', estudante: 'estudante' }
