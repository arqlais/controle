import type { Feature } from './plans'
import { proposalSerif } from './brand'
import type { ProposalStyle } from './types'

/* Modelos de proposta em PDF. O "Proposta #001" é exclusivo da Laís (dona);
   os clientes escolhem entre os outros e personalizam cores e textos só na conta deles.
   O visual de cada modelo fica em src/platform.css (classes .tpl-…). */

export interface ProposalTemplate {
  id: string
  name: string
  description: string
  needs?: Feature // plano/permissão necessária (sem nada = todos os planos)
  colors: Pick<ProposalStyle, 'ink' | 'rose' | 'arch' | 'paper' | 'bar' | 'serif'>
}

export const TEMPLATES: ProposalTemplate[] = [
  {
    id: 'lais',
    name: 'Proposta #001',
    description: 'o modelo da Laís · exclusivo',
    needs: 'modeloExclusivo',
    colors: { ink: '#2a4352', rose: '#af8c86', arch: '#e7d5cf', paper: '#f7f5f1', bar: '#4a5d6b', serif: 'The Seasons' },
  },
  {
    id: 'coluna',
    name: 'coluna',
    description: 'coluna lateral de cor com seus dados',
    colors: { ink: '#26303a', rose: '#8c6f5a', arch: '#efe8df', paper: '#ffffff', bar: '#26303a', serif: 'Playfair Display' },
  },
  {
    id: 'faixa',
    name: 'faixa',
    description: 'cabeçalho em faixa larga, moderno',
    colors: { ink: '#1f2a24', rose: '#5f7563', arch: '#e3ebe2', paper: '#fbfcfa', bar: '#3f5446', serif: 'DM Serif Display' },
  },
  {
    id: 'planilha',
    name: 'planilha',
    description: 'limpo, em linhas retas, direto ao ponto',
    colors: { ink: '#111111', rose: '#6f6f6f', arch: '#f1f1f1', paper: '#ffffff', bar: '#111111', serif: 'Libre Baskerville' },
  },
  {
    id: 'editorial',
    name: 'editorial',
    description: 'número grande e título de revista',
    colors: { ink: '#3a2e28', rose: '#a4553a', arch: '#f3e6da', paper: '#fbf7f2', bar: '#a4553a', serif: 'Bodoni Moda' },
  },
]

type Has = (f: Feature) => boolean

export const templateAllowed = (t: ProposalTemplate, has: Has) => !t.needs || has(t.needs)

/** Modelo que vale para esta conta: o escolhido (se o plano permite) ou o padrão do plano. */
export function resolveTemplate(p: ProposalStyle, has: Has): ProposalTemplate {
  const chosen = TEMPLATES.find((t) => t.id === p.template)
  if (chosen && templateAllowed(chosen, has)) return chosen
  return TEMPLATES.find((t) => t.id === (has('modeloExclusivo') ? 'lais' : 'coluna'))!
}

/** Cores e fontes que a folha usa: as da conta; quem nunca escolheu modelo usa as do modelo padrão do plano.
 *  A fonte exclusiva da dona (The Seasons) nunca aparece no PDF dos clientes. */
export function sheetColors(p: ProposalStyle, has: Has) {
  const t = resolveTemplate(p, has)
  const base = !p.template && t.id !== 'lais' ? { ...p, ...t.colors } : p
  return { ...base, serif: proposalSerif(base.serif, has), sans: base.sans || 'Poppins' }
}
