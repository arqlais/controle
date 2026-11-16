/* Áreas (profissões) da planê.arquivos: a loja se organiza por quem compra, não por tipo de arquivo.
   Um arquivo de uma área aparece só nela; os de "todos" (anamnese, termo, stories...) servem para todas.
   Os kits entram na área dos arquivos que levam. */
import type { Produto } from '../ape/model'

export type Area = { id: string; nome: string; curto: string; frase: string; subs?: string[]; ids?: string[] }

export const AREAS: Area[] = [
  { id: 'nails', nome: 'nail designer', curto: 'nails', frase: 'alongamento, gel, manicure e pedicure', subs: ['unhas'] },
  { id: 'lash', nome: 'lash designer', curto: 'lash', frase: 'extensão de cílios e lash lifting', ids: ['cil-mapeamento', 'sob-cuidados'] },
  { id: 'sobrancelha', nome: 'designer de sobrancelha', curto: 'sobrancelha', frase: 'design, henna e brow lamination', ids: ['sob-visagismo', 'sob-cuidados'] },
  { id: 'bio', nome: 'biomedicina e harmonização', curto: 'biomedicina', frase: 'toxina, preenchimento e bioestimulador', subs: ['biomedicina'] },
  { id: 'estetica', nome: 'esteticista', curto: 'estética', frase: 'facial, corporal, depilação e massagem', subs: ['estética', 'depilação', 'massagem'] },
  { id: 'cabelo', nome: 'cabeleireira', curto: 'cabelo', frase: 'química, coloração e cuidados', subs: ['cabelo'] },
  { id: 'make', nome: 'maquiadora e noivas', curto: 'make e noivas', frase: 'proposta, contrato e o dia da noiva', subs: ['maquiagem e noivas'] },
]

const daArea = (a: Area, p: Produto) => !!(a.ids?.includes(p.id) || (p.sub && a.subs?.includes(p.sub)))

/** Áreas de um produto: [] quando serve para todas. */
export function areasDe(p: Produto, todos: Produto[]): string[] {
  if (p.cat === 'combos') {
    const itens = (p.combo || []).map((id) => todos.find((x) => x.id === id)).filter((x): x is Produto => !!x)
    return AREAS.filter((a) => daArea(a, p) || itens.some((x) => daArea(a, x))).map((a) => a.id)
  }
  return AREAS.filter((a) => daArea(a, p)).map((a) => a.id)
}

/** Nichos que não entram na loja de arquivos (ficam guardados, só não aparecem). */
export const FORA_DA_LOJA = new Set(['freelancer', 'freelancers'])
