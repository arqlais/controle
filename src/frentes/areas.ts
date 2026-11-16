/* Áreas (profissões) da planê.arquivos: a loja se organiza por quem compra, não por tipo de arquivo.
   Um arquivo de uma área aparece só nela; os de "todos" (anamnese, termo, stories...) servem para todas.
   Os kits entram na área dos arquivos que levam. */
import type { Produto } from '../ape/model'

export type Area = { id: string; nome: string; curto: string; frase: string; icone: string; subs?: string[]; ids?: string[] }

export const AREAS: Area[] = [
  { id: 'nails', icone: 'unha', nome: 'nail designer', curto: 'nails', frase: 'alongamento, gel, manicure e pedicure', subs: ['unhas'] },
  { id: 'lash', icone: 'cilios', nome: 'lash designer', curto: 'lash', frase: 'extensão de cílios e lash lifting', ids: ['cil-mapeamento', 'sob-cuidados'] },
  { id: 'sobrancelha', icone: 'sobrancelha', nome: 'designer de sobrancelha', curto: 'sobrancelha', frase: 'design, henna e brow lamination', ids: ['sob-visagismo', 'sob-cuidados', 'sob-micro-cuidados', 'sob-brow-cuidados', 'sob-caderno'] },
  { id: 'bio', icone: 'seringa', nome: 'biomedicina e harmonização', curto: 'biomedicina', frase: 'toxina, preenchimento e bioestimulador', subs: ['biomedicina'] },
  { id: 'estetica', icone: 'rosto', nome: 'esteticista', curto: 'estética', frase: 'facial, corporal, depilação e massagem', subs: ['estética', 'depilação', 'massagem'] },
  { id: 'cabelo', icone: 'tesoura', nome: 'cabeleireira', curto: 'cabelo', frase: 'química, coloração e cuidados', subs: ['cabelo'] },
  { id: 'make', icone: 'batom', nome: 'maquiadora e noivas', curto: 'make e noivas', frase: 'proposta, contrato e o dia da noiva', subs: ['maquiagem e noivas'] },
  { id: 'odonto', icone: 'dente', nome: 'dentista', curto: 'dentista', frase: 'anamnese com odontograma e termos de consentimento', subs: ['odontologia'] },
  { id: 'medico', icone: 'estetoscopio', nome: 'médico', curto: 'médico', frase: 'dermatologia, ginecologia, pediatria, clínica geral e mais', subs: ['medicina'] },
  { id: 'nutri', icone: 'maca', nome: 'nutricionista', curto: 'nutrição', frase: 'anamnese, recordatório e evolução', subs: ['nutrição'] },
  { id: 'fisio', icone: 'coluna', nome: 'fisioterapeuta', curto: 'fisioterapia', frase: 'avaliação, mapa da dor e sessões', subs: ['fisioterapia'] },
  { id: 'psico', icone: 'mente', nome: 'psicóloga', curto: 'psicologia', frase: 'acolhimento e contrato terapêutico', subs: ['psicologia'] },
  { id: 'personal', icone: 'haltere', nome: 'personal trainer', curto: 'personal', frase: 'PAR-Q, medidas e evolução', subs: ['personal'] },
  { id: 'podo', icone: 'pe', nome: 'podóloga', curto: 'podologia', frase: 'anamnese e mapa dos pés', subs: ['podologia'] },
  { id: 'vet', icone: 'pata', nome: 'veterinária', curto: 'veterinária', frase: 'ficha do pet e carteira de vacinas', subs: ['veterinária'] },
  { id: 'arq', icone: 'compasso', nome: 'arquitetura e interiores', curto: 'arquitetura', frase: 'proposta, contrato, briefing e honorários', subs: ['arquitetura'] },
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
