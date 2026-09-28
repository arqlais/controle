import type { Feature } from './plans'
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
    id: 'classico',
    name: 'clássico',
    description: 'moldura fina e título centralizado',
    colors: { ink: '#2d2a26', rose: '#9c7b5b', arch: '#efe6da', paper: '#ffffff', bar: '#2d2a26', serif: 'Cormorant Garamond' },
  },
  {
    id: 'linha',
    name: 'linha',
    description: 'minimalista: só linhas finas e respiro',
    colors: { ink: '#1f1f1f', rose: '#8a8a8a', arch: '#f2f2f2', paper: '#ffffff', bar: '#1f1f1f', serif: 'Cormorant Garamond' },
  },
  {
    id: 'bloco',
    name: 'bloco',
    description: 'cabeçalho em bloco de cor e total em destaque',
    needs: 'modelosExtras',
    colors: { ink: '#23313f', rose: '#6f8aa3', arch: '#23313f', paper: '#f7f8fa', bar: '#23313f', serif: 'Cormorant Garamond' },
  },
  {
    id: 'editorial',
    name: 'editorial',
    description: 'título grande, com cara de revista',
    needs: 'modelosExtras',
    colors: { ink: '#3a2e28', rose: '#a4553a', arch: '#f1e4d8', paper: '#fbf7f2', bar: '#a4553a', serif: 'Cormorant Garamond' },
  },
]

type Has = (f: Feature) => boolean

export const templateAllowed = (t: ProposalTemplate, has: Has) => !t.needs || has(t.needs)

/** Modelo que vale para esta conta: o escolhido (se o plano permite) ou o padrão do plano. */
export function resolveTemplate(p: ProposalStyle, has: Has): ProposalTemplate {
  const chosen = TEMPLATES.find((t) => t.id === p.template)
  if (chosen && templateAllowed(chosen, has)) return chosen
  return TEMPLATES.find((t) => t.id === (has('modeloExclusivo') ? 'lais' : 'classico'))!
}

/** Cores que a folha usa: as da conta; quem nunca escolheu modelo usa as do modelo padrão do plano. */
export function sheetColors(p: ProposalStyle, has: Has) {
  const t = resolveTemplate(p, has)
  return !p.template && t.id !== 'lais' ? { ...p, ...t.colors } : p
}
