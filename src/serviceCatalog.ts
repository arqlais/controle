import type { Pricing, ServiceDef } from './types'

/* Catálogo de serviços sugeridos (primeiro passo e "adicionar serviço"), organizado por área.
   Cada serviço já vem com uma forma de cobrar e um valor de partida: quem assina só ajusta.
   Os ids dos serviços antigos foram mantidos para quem já tem a tabela montada não ver repetidos. */

export type CatalogKind = 'final' | 'freela'
export interface CatalogGroup {
  id: string
  label: string
  icon: string
  kind: CatalogKind
  services: ServiceDef[]
}

type Extra = Partial<Omit<ServiceDef, 'id' | 'name' | 'pricing' | 'unit' | 'price'>>
const sv = (id: string, name: string, pricing: Pricing, unit: string, price: number, extra: Extra = {}): ServiceDef => ({
  id,
  name,
  unit,
  pricing,
  price,
  min: 0,
  hours: pricing === 'hora' ? 1 : pricing === 'm2' ? 0.3 : 4,
  tiers: [],
  ...(pricing === 'm2' ? { base: 0 } : {}),
  ...extra,
})

const ETAPAS_PROJETO = ['estudo preliminar', 'anteprojeto', 'projeto executivo', 'detalhamentos']

const FINAL: Omit<CatalogGroup, 'kind'>[] = [
  {
    id: 'arquitetura',
    label: 'arquitetura',
    icon: 'building',
    services: [
      sv('arq-arquitetonico', 'projeto arquitetônico', 'm2', 'm²', 60, { min: 6000, hours: 0.6, askText: 'Quais etapas do projeto arquitetônico você precisa?', checklistTitle: 'etapas incluídas', checklist: ETAPAS_PROJETO }),
      sv('arq-reforma', 'reforma e ampliação', 'm2', 'm²', 50, { min: 4000, hours: 0.5, askText: 'O que entra na reforma?', checklistTitle: 'o que inclui', checklist: ['levantamento do existente', 'layout novo', 'demolir e construir', 'projeto executivo', 'detalhamentos'] }),
      sv('arq-residencial', 'projeto residencial', 'm2', 'm²', 70, { min: 6000, hours: 0.7, askText: 'Quais etapas do projeto você precisa?', checklistTitle: 'etapas incluídas', checklist: ETAPAS_PROJETO }),
      sv('arq-comercial', 'projeto comercial', 'm2', 'm²', 60, { min: 5000, hours: 0.6, askText: 'Quais etapas do projeto você precisa?', checklistTitle: 'etapas incluídas', checklist: [...ETAPAS_PROJETO, 'comunicação visual'] }),
      sv('arq-corporativo', 'projeto corporativo', 'm2', 'm²', 55, { min: 6000, hours: 0.6, askText: 'Quais etapas do projeto você precisa?', checklistTitle: 'etapas incluídas', checklist: [...ETAPAS_PROJETO, 'layout de estações de trabalho'] }),
      sv('arq-regularizacao', 'projeto legal / regularização', 'm2', 'm²', 25, { base: 1500, min: 2500, hours: 0.2, askText: 'O que você precisa na aprovação ou regularização?', checklistTitle: 'o que inclui', checklist: ['levantamento do existente', 'projeto legal', 'protocolo na prefeitura', 'acompanhamento até o habite-se', 'averbação no cartório'] }),
      sv('arq-executivo', 'projeto executivo', 'm2', 'm²', 40, { min: 2000, hours: 0.4 }),
      sv('arq-paisagismo', 'paisagismo', 'm2', 'm²', 30, { min: 2500, hours: 0.3, askText: 'O que entra no paisagismo?', checklistTitle: 'o que inclui', checklist: ['layout do jardim', 'escolha das plantas', 'irrigação', 'iluminação do jardim', 'pisos externos'] }),
      sv('arq-viabilidade', 'estudo de viabilidade', 'unidade', 'estudo', 1800, { hours: 12 }),
    ],
  },
  {
    id: 'interiores',
    label: 'interiores',
    icon: 'sofa',
    services: [
      sv('arq-interiores', 'projeto de interiores', 'm2', 'm²', 90, { min: 4000, hours: 0.8, askText: 'Quais etapas do projeto de interiores você precisa?', checklistTitle: 'etapas incluídas', checklist: ['layout', 'marcenaria', 'iluminação', 'revestimentos', 'forro', 'detalhamentos'] }),
      sv('int-decoracao', 'projeto de decoração', 'm2', 'm²', 50, { min: 2500, hours: 0.4, askText: 'O que entra na decoração?', checklistTitle: 'o que inclui', checklist: ['layout dos móveis', 'cores e materiais', 'escolha de móveis e objetos', 'lista de compras com links'] }),
      sv('int-consultoria', 'consultoria de interiores', 'hora', 'hora', 250),
      sv('int-mobiliario', 'projeto de mobiliário', 'unidade', 'móvel', 400, { hours: 5 }),
      sv('int-iluminacao', 'projeto de iluminação', 'm2', 'm²', 20, { min: 1200, hours: 0.15 }),
      sv('int-cozinha-banho', 'projeto de cozinhas e banheiros', 'unidade', 'ambiente', 1800, { hours: 16, askText: 'Quais ambientes?', checklistTitle: 'ambientes', checklist: ['cozinha', 'banheiro social', 'banheiro da suíte', 'lavabo', 'área de serviço'] }),
    ],
  },
  {
    id: 'tecnicos',
    label: 'projetos técnicos',
    icon: 'ruler',
    services: [
      sv('tec-detalhamento', 'detalhamento executivo', 'm2', 'm²', 25, { min: 1500, hours: 0.25 }),
      sv('tec-marcenaria', 'marcenaria', 'unidade', 'móvel', 350, { hours: 4 }),
      sv('tec-marmoraria', 'marmoraria', 'unidade', 'ambiente', 400, { hours: 4 }),
      sv('tec-paginacao', 'paginação de pisos e revestimentos', 'm2', 'm²', 8, { min: 600, hours: 0.08 }),
      sv('arq-complementares', 'projetos complementares', 'm2', 'm²', 0, {
        min: 1500,
        askText: 'Quais projetos complementares você precisa?',
        checklistTitle: 'quais projetos',
        checklist: ['estrutural', 'elétrico', 'hidrossanitário', 'climatização (ar-condicionado)', 'prevenção de incêndio (PPCI)', 'gás', 'SPDA (para-raios)', 'luminotécnico'],
        checklistPrices: { estrutural: 18, elétrico: 10, hidrossanitário: 10, 'climatização (ar-condicionado)': 8, 'prevenção de incêndio (PPCI)': 12, gás: 5, 'SPDA (para-raios)': 6, luminotécnico: 8 },
      }),
      sv('tec-compat', 'compatibilização de projetos', 'm2', 'm²', 6, { min: 1200, hours: 0.06 }),
    ],
  },
  {
    id: 'obra',
    label: 'obra',
    icon: 'hardhat',
    services: [
      sv('arq-obra', 'acompanhamento de obra', 'pacote', 'visita', 350, { hours: 3, tiers: [{ qty: 8, price: 2400 }] }),
      sv('obra-gerenciamento', 'gerenciamento de obra', 'unidade', 'mês', 3500, { hours: 40 }),
      sv('obra-administracao', 'administração de obra', 'unidade', 'mês', 4000, { hours: 50 }),
      sv('obra-visita', 'visita técnica', 'unidade', 'visita', 400, { hours: 3 }),
      sv('obra-vistoria', 'vistoria', 'unidade', 'vistoria', 600, { hours: 4 }),
      sv('obra-orcamento', 'orçamento de obra', 'm2', 'm²', 8, { min: 1500, hours: 0.08 }),
    ],
  },
  {
    id: 'apresentacao-final',
    label: '3D e apresentação',
    icon: 'cube',
    services: [
      sv('fin-modelagem', 'modelagem 3D', 'm2', 'm²', 6, { min: 600, hours: 0.08 }),
      sv('arq-render', 'renderização', 'pacote', 'imagem', 180, { tiers: [{ qty: 5, price: 800 }] }),
      sv('fin-planta-hum', 'planta humanizada', 'unidade', 'planta', 350),
      sv('fin-perspectivas', 'imagens e perspectivas', 'pacote', 'imagem', 150, { tiers: [{ qty: 5, price: 650 }] }),
      sv('fin-apresentacao', 'apresentação de projeto', 'unidade', 'apresentação', 600, { hours: 6 }),
    ],
  },
  {
    id: 'consultoria',
    label: 'consultoria',
    icon: 'chat',
    services: [
      sv('cons-arquitetonica', 'consultoria arquitetônica', 'hora', 'hora', 250),
      sv('cons-decoracao', 'consultoria de decoração', 'hora', 'hora', 200),
      sv('cons-materiais', 'consultoria de materiais e acabamentos', 'hora', 'hora', 200),
      sv('cons-reforma', 'consultoria para reforma', 'hora', 'hora', 250),
      sv('cons-imovel', 'consultoria para compra de imóvel', 'unidade', 'visita', 600, { hours: 4 }),
    ],
  },
]

const FREELA: Omit<CatalogGroup, 'kind'>[] = [
  {
    id: 'desenho',
    label: 'projetos e desenho técnico',
    icon: 'compass',
    services: [
      sv('fr-desenvolvimento', 'desenvolvimento de projetos', 'm2', 'm²', 8, { base: 300, min: 500, hours: 0.1 }),
      sv('fr-desenho', 'desenho técnico', 'm2', 'm²', 5, { base: 200, min: 400, hours: 0.06 }),
      sv('executivo', 'projeto executivo', 'm2', 'm²', 6, { base: 400, hours: 0.12 }),
      sv('fr-detalhamento', 'detalhamento', 'unidade', 'prancha', 180, { hours: 3 }),
      sv('fr-compat', 'compatibilização', 'hora', 'hora', 70),
      sv('fr-asbuilt', 'levantamento arquitetônico', 'm2', 'm²', 4, { base: 200, min: 350, hours: 0.05 }),
      sv('fr-atualizacao', 'atualização de projetos', 'hora', 'hora', 60),
    ],
  },
  {
    id: 'visualizacao',
    label: '3D e visualização',
    icon: 'cube',
    services: [
      sv('modelagem', 'modelagem 3D', 'm2', 'm²', 3, { base: 150, min: 300, hours: 0.08 }),
      sv('render-vray', 'renderização', 'pacote', 'imagem', 120, { tiers: [{ qty: 5, price: 550 }] }),
      sv('fr-render-ia', 'renderização com IA', 'pacote', 'imagem', 50, { hours: 1, tiers: [{ qty: 10, price: 400 }] }),
      sv('planta-hum', 'planta humanizada', 'unidade', 'planta', 250),
      sv('fr-pos', 'pós-produção de imagens', 'unidade', 'imagem', 40, { hours: 1 }),
      sv('fr-tour', 'vídeos e animações', 'unidade', 'vídeo', 400, { hours: 8 }),
    ],
  },
  {
    id: 'detalhamento',
    label: 'detalhamento',
    icon: 'layers',
    services: [
      sv('fr-marcenaria', 'detalhamento de marcenaria', 'unidade', 'móvel', 180, { hours: 3 }),
      sv('fr-marmoraria', 'detalhamento de marmoraria', 'unidade', 'peça', 120, { hours: 2 }),
      sv('fr-mobiliario', 'detalhamento de mobiliário', 'unidade', 'móvel', 200, { hours: 3 }),
      sv('fr-construtivo', 'detalhamento construtivo', 'unidade', 'prancha', 220, { hours: 4 }),
      sv('fr-tabelas', 'tabelas e quantitativos', 'hora', 'hora', 60),
    ],
  },
  {
    id: 'apresentacao',
    label: 'apresentação',
    icon: 'image',
    services: [
      sv('prancha', 'diagramação de pranchas', 'unidade', 'prancha', 150, { hours: 3 }),
      sv('slides', 'apresentação de projetos', 'unidade', 'slide', 30, { min: 150, hours: 0.75 }),
      sv('fr-moodboard', 'moodboards', 'unidade', 'moodboard', 120, { hours: 2 }),
      sv('fr-portfolio', 'portfólio', 'unidade', 'página', 40, { min: 300, hours: 1 }),
      sv('fr-diagramas', 'mapas e diagramas', 'unidade', 'diagrama', 100, { hours: 2 }),
    ],
  },
  {
    id: 'planejamento',
    label: 'orçamento e planejamento',
    icon: 'list',
    services: [
      sv('fr-orcamentos', 'orçamentos', 'hora', 'hora', 70),
      sv('fr-quantitativos', 'quantitativos', 'm2', 'm²', 2, { min: 300, hours: 0.03 }),
      sv('fr-cotacoes', 'cotações', 'hora', 'hora', 60),
      sv('fr-cronogramas', 'cronogramas', 'unidade', 'cronograma', 300, { hours: 4 }),
      sv('fr-materiais', 'levantamento de materiais', 'hora', 'hora', 60),
    ],
  },
  {
    id: 'avulsos',
    label: 'avulsos',
    icon: 'clock',
    services: [sv('hora', 'hora de trabalho', 'hora', 'hora', 60), sv('fr-revisao', 'alteração / revisão extra', 'hora', 'hora', 60)],
  },
]

const build = (groups: Omit<CatalogGroup, 'kind'>[], kind: CatalogKind): CatalogGroup[] =>
  groups.map((g) => ({ ...g, kind, services: g.services.map((s) => ({ ...s, group: g.label, audience: kind === 'final' ? ('final' as const) : ('parceiro' as const) })) }))

/** Só aparecem nas sugestões da dona (para quem assina fica só "renderização"). */
export const OWNER_ONLY = ['fr-render-ia']

export const CATALOG: Record<CatalogKind, { label: string; icon: string; hint: string; groups: CatalogGroup[] }> = {
  final: { label: 'para cliente final', icon: 'home', hint: 'arquitetura, interiores, obra e consultoria para quem é dono do imóvel', groups: build(FINAL, 'final') },
  freela: { label: 'para arquitetos, designers e escritórios', icon: 'briefcase', hint: 'freelancer: desenho, 3D, detalhamento, apresentação e planejamento', groups: build(FREELA, 'freela') },
}
