/* Estilos dos arquivos da planê.arquivos: cada arquivo destes vem nos quatro estilos na mesma compra.
   As prévias ficam em public/ape/amostras/e-<id>--<estilo>.webp (geradas por tools/arquivos). */
export type Estilo = 'delicado' | 'criativo' | 'minimalista' | 'elegante'
export const ESTILOS: { id: Estilo; nome: string; cor: string; aro?: string }[] = [
  { id: 'delicado', nome: 'delicado', cor: '#e9dcd6', aro: '#a88a80' },
  { id: 'criativo', nome: 'criativo', cor: '#e8a48f', aro: '#c9785d' },
  { id: 'minimalista', nome: 'minimalista', cor: '#ffffff', aro: '#1f1f1f' },
  { id: 'elegante', nome: 'elegante', cor: '#15120f', aro: '#c9a86a' },
]
const COM_ESTILOS = new Set<string>(["beleza-fim-de-ano", "beleza-precos", "beleza-anamnese", "beleza-termo", "beleza-vale", "free-proposta", "free-contrato", "free-briefing", "arq-proposta", "arq-contrato", "arq-briefing", "arq-levantamento", "beleza-stories-mes", "beleza-antes-depois", "beleza-depoimentos", "beleza-carrossel", "beleza-destaques", "beleza-politica", "beleza-cartao-agendamento", "beleza-recibo", "beleza-mensagens", "beleza-certificado", "beleza-biosseguranca", "sob-cuidados", "sob-visagismo", "cil-mapeamento", "unha-cuidados", "unha-catalogo", "cab-anamnese", "cab-cuidados", "cab-tecnica", "est-avaliacao", "est-protocolo", "est-cuidados", "noiva-orcamento", "noiva-contrato", "noiva-ficha", "dep-ficha", "mas-ficha", "beleza-cuidados-qr", "beleza-lembranca"])
export const temEstilos = (id: string) => COM_ESTILOS.has(id)
export const imgEstilo = (id: string, e: Estilo) => `ape/amostras/e-${id}--${e}.webp`
