import type { ServiceDef } from './types'

/* Tabela da dona, versão 2 (outubro/2026): executivo e modelagem por faixa de área (quanto maior o espaço,
   menor o m²), × complexidade, × peso das plantas escolhidas; detalhamento por peça ou por ambiente.
   Valores tirados das tabelas e orçamentos dela; tudo editável em configurações → preços
   (e "calcular pelos meus orçamentos" recalcula as faixas pelos últimos 6 meses). Roda uma vez só. */

/** Peso (%) de cada planta do executivo de interiores: o conjunto completo soma 100. */
const INTERIORES: [string, number][] = [
  ['planta de layout (mobiliário)', 14],
  ['planta de demolição', 8],
  ['planta de construção', 8],
  ['paginação de piso/revestimentos', 10],
  ['planta de forro', 10],
  ['planta de iluminação', 6],
  ['planta elétrica', 10],
  ['planta hidráulica', 10],
  ['planta de ar-condicionado', 5],
  ['elevações', 14],
  ['memorial descritivo', 5],
  // a mais, quando o projeto pede
  ['planta de acabamentos', 5],
  ['cortes', 8],
  ['planta de cobertura', 6],
  ['planta de situação/implantação', 4],
  ['fachadas', 6],
  ['quadro de esquadrias', 4],
]
/** Executivo arquitetônico: o conjunto completo soma 100. */
const ARQUITETONICO: [string, number][] = [
  ['plantas baixas cotadas (todos os pavimentos)', 25],
  ['cortes longitudinal e transversal', 15],
  ['fachadas', 15],
  ['planta de cobertura', 10],
  ['planta de implantação + topografia', 10],
  ['detalhes construtivos (escadas, janelas, estrutura)', 10],
  ['quadro de esquadrias e especificações', 7],
  ['memorial descritivo', 8],
]

const weights = (list: [string, number][]) => ({ checklist: list.map(([n]) => n), checklistPrices: Object.fromEntries(list), customRate: 5 })

export function upgradeOwnerServices(list: ServiceDef[]): ServiceDef[] {
  const out = list.map((x): ServiceDef => {
    if (x.id === 'executivo' && !x.areaTiers?.length) {
      // mantém o nome das plantas que ela já usa; as que não estão na tabela nova ganham peso 5
      const known = new Map(INTERIORES)
      const extra = (x.checklist ?? []).filter((c) => c.trim() && !known.has(c))
      const w = weights([...INTERIORES, ...extra.map((c): [string, number] => [c, 5])])
      return {
        ...x,
        name: x.name === 'executivo' ? 'executivo de interiores' : x.name,
        areaTiers: [
          { upTo: 50, price: 18 },
          { upTo: 120, price: 14 },
          { upTo: 0, price: 10 },
        ],
        base: 0,
        min: 0,
        checklistTitle: x.checklistTitle || 'plantas executivas',
        ...w,
      }
    }
    if (x.id === 'modelagem' && !x.areaTiers?.length)
      return {
        ...x,
        areaTiers: [
          { upTo: 50, price: 12 },
          { upTo: 120, price: 10 },
          { upTo: 0, price: 8 },
        ],
        base: 0,
      }
    // detalhamento: por m² (este), por peça e por ambiente — escolhe no orçamento
    if (x.id === 'detalhamento' && x.pricing === 'm2' && x.name === 'detalhamento') return { ...x, name: 'detalhamento (por m²)' }
    return x
  })
  const add: ServiceDef[] = []
  const group = list.find((x) => x.id === 'executivo')?.group
  if (!out.some((x) => x.id === 'executivo-arq'))
    add.push({
      id: 'executivo-arq',
      name: 'executivo arquitetônico',
      unit: 'm²',
      group,
      pricing: 'm2',
      price: 19,
      areaTiers: [{ upTo: 0, price: 19 }],
      base: 0,
      min: 0,
      hours: 0.12,
      tiers: [],
      perFloor: true,
      checklistTitle: 'plantas do executivo arquitetônico',
      ...weights(ARQUITETONICO),
      delivery: 'PDF + DWG organizados por prancha',
      deliveryOpen: '',
    })
  if (!out.some((x) => x.id === 'detalhamento-itens'))
    add.push({
      id: 'detalhamento-itens',
      name: 'detalhamento (por peça)',
      unit: 'peça',
      group,
      pricing: 'unidade',
      price: 70,
      min: 0,
      hours: 1.5,
      tiers: [],
      checklistTitle: 'itens',
      checklist: ['marcenaria', 'marmoraria', 'serralheria', 'vidraçaria'],
      delivery: 'PDF + DWG (AutoCAD)',
      deliveryOpen: '',
      noteHints: ['inclui planta e elevações de cada peça cotadas, cortes, especificação de materiais, puxadores e ferragens, legenda e tabela de peças.'],
    })
  if (!out.some((x) => x.id === 'detalhamento-amb'))
    add.push({
      id: 'detalhamento-amb',
      name: 'detalhamento (por ambiente)',
      unit: 'ambiente',
      group,
      pricing: 'unidade',
      price: 110,
      min: 0,
      hours: 2.5,
      tiers: [],
      checklistTitle: 'ambientes',
      checklist: ['banheiro', 'lavabo', 'cozinha', 'lavanderia', 'sala', 'dormitório', 'área gourmet'],
      delivery: 'PDF + DWG (AutoCAD)',
      deliveryOpen: '',
      noteHints: ['inclui planta baixa cotada, elevações de todas as paredes, revestimentos, posição de louças e pontos elétricos e hidráulicos.'],
    })
  // entram logo depois do executivo (ou antes do "personalizado")
  const at = out.findIndex((x) => x.id === 'executivo')
  const pos = at >= 0 ? at + 1 : Math.max(0, out.findIndex((x) => x.id === 'personalizado'))
  return [...out.slice(0, pos), ...add, ...out.slice(pos)]
}
