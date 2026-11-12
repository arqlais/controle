/* Estilos dos arquivos da planê.arquivos: cada arquivo destes vem nos três estilos na mesma compra.
   As prévias ficam em public/ape/amostras/e-<id>--<estilo>.webp (geradas por tools/arquivos). */
export type Estilo = 'criativo' | 'minimalista' | 'chique'
export const ESTILOS: { id: Estilo; nome: string; cor: string }[] = [
  { id: 'criativo', nome: 'criativo', cor: '#d6b3ab' },
  { id: 'minimalista', nome: 'minimalista', cor: '#ffffff' },
  { id: 'chique', nome: 'chique', cor: '#15120f' },
]
const COM_ESTILOS = new Set<string>(["beleza-antes-depois", "beleza-biosseguranca", "beleza-carrossel", "beleza-cartao-agendamento", "beleza-certificado", "beleza-depoimentos", "beleza-destaques", "beleza-mensagens", "beleza-politica", "beleza-recibo", "beleza-stories-mes", "cab-anamnese", "cab-cuidados", "cab-tecnica", "cil-mapeamento", "dep-ficha", "est-avaliacao", "est-cuidados", "est-protocolo", "mas-ficha", "noiva-contrato", "noiva-ficha", "noiva-orcamento", "sob-cuidados", "sob-visagismo", "unha-catalogo", "unha-cuidados"])
export const temEstilos = (id: string) => COM_ESTILOS.has(id)
/** imagem do arquivo no estilo; no criativo, a capa de sempre */
export const imgEstilo = (id: string, e: Estilo, capa?: string) => (e === 'criativo' ? capa : `ape/amostras/e-${id}--${e}.webp`)
