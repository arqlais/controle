/* Estilos dos arquivos da planê.arquivos e da planê.arq. Cada estilo é comprado à parte (mesmo preço):
   no carrinho e no pedido o item é "<id>--<estilo>" (o servidor faz igual em supabase/functions/pagamentos/ape.ts).
   As prévias de cada estilo ficam em public/ape/amostras/e-<id>--<estilo>.webp (geradas por tools/arquivos). */
import { frenteDe, type Produto } from '../ape/model'

export type Estilo = 'delicado' | 'criativo' | 'minimalista' | 'elegante'
export const ESTILOS: { id: Estilo; nome: string; cor: string; aro: string; frase: string }[] = [
  { id: 'delicado', nome: 'delicado', cor: '#e9dcd6', aro: '#a88a80', frase: 'bege e rosé, cantos redondos' },
  { id: 'criativo', nome: 'criativo', cor: '#e8a48f', aro: '#c9785d', frase: 'colagem colorida, com fita e adesivos' },
  { id: 'minimalista', nome: 'minimalista', cor: '#ffffff', aro: '#1f1f1f', frase: 'preto e branco, limpo e elegante' },
  { id: 'elegante', nome: 'elegante', cor: '#15120f', aro: '#c9a86a', frase: 'preto e dourado, ar de luxo' },
]
export const ESTILO_PADRAO: Estilo = 'delicado'
const PREVIA = new Set<string>(["beleza-fim-de-ano", "beleza-precos", "beleza-anamnese", "beleza-termo", "beleza-vale", "free-proposta", "free-contrato", "free-briefing", "arq-proposta", "arq-contrato", "arq-briefing", "arq-levantamento", "beleza-stories-mes", "beleza-antes-depois", "beleza-depoimentos", "beleza-carrossel", "beleza-destaques", "beleza-politica", "beleza-cartao-agendamento", "beleza-recibo", "beleza-mensagens", "beleza-certificado", "beleza-biosseguranca", "sob-cuidados", "sob-visagismo", "cil-mapeamento", "unha-cuidados", "unha-catalogo", "cab-anamnese", "cab-cuidados", "cab-tecnica", "est-avaliacao", "est-protocolo", "est-cuidados", "noiva-orcamento", "noiva-contrato", "noiva-ficha", "dep-ficha", "mas-ficha", "beleza-cuidados-qr", "beleza-lembranca"])
/** produtos sem versões de estilo (vão como estão) */
const SEM_ESTILO = new Set(['arq-manual'])

export const estiloDoId = (id: string) => {
  const m = id.match(/^(.*)--(delicado|criativo|minimalista|elegante)$/)
  return m ? { base: m[1], estilo: m[2] as Estilo } : { base: id, estilo: null }
}
/** Este produto é vendido por estilo? (arquivos e kits da planê.arquivos e da planê.arq) */
export const temEstilos = (p: Produto) => ['arquivos', 'arq'].includes(frenteDe(p)) && ['arquivos', 'combos'].includes(p.cat || 'arquivos') && !SEM_ESTILO.has(p.id)
/** Tem imagem de prévia de cada estilo? (planilhas não têm: vão só com a cor) */
export const temPrevia = (id: string) => PREVIA.has(id)
export const imgEstilo = (id: string, e: Estilo) => `ape/amostras/e-${id}--${e}.webp`
export const nomeEstilo = (e: string | null) => ESTILOS.find((x) => x.id === e)?.nome || ''
/** id que vai para o carrinho: com o estilo, quando o produto tem estilos */
export const idNoCarrinho = (p: Produto, e: Estilo) => (temEstilos(p) ? `${p.id}--${e}` : p.id)
/** Algum estilo deste produto já está no carrinho? */
export const estilosNoCarrinho = (ids: string[], id: string) => ids.filter((x) => x === id || estiloDoId(x).base === id).map((x) => estiloDoId(x).estilo).filter(Boolean) as Estilo[]

/** Lista de produtos + uma versão de cada estilo (para o carrinho, o checkout e o pedido). */
export function comEstilos(ps: Produto[]): Produto[] {
  const out = [...ps]
  for (const p of ps) {
    if (!temEstilos(p)) continue
    for (const e of ESTILOS)
      out.push({
        ...p,
        id: `${p.id}--${e.id}`,
        nome: `${p.nome} · ${e.nome}`,
        combo: p.combo?.map((c) => `${c}--${e.id}`),
        amostras: temPrevia(p.id) ? [imgEstilo(p.id, e.id), ...(p.amostras || [])] : p.amostras,
      })
  }
  return out
}
