/* As três frentes da planê, todas dentro de useplane.com.br (sem domínio novo).
   Um lugar só para nome, endereço, Instagram e texto de cada uma: a página principal,
   as vitrines e os rodapés leem daqui. Plano completo em docs/FRENTES.md. */

export type FrenteId = 'arquivos' | 'arq' | 'apzinho'

export interface FrenteInfo {
  id: FrenteId
  nome: string // "planê.arquivos"
  marca: string // a palavra que vai em itálico depois de "planê"
  para: string // público, em poucas palavras
  frase: string // a promessa
  desc: string
  rota: string // dentro do site
  caminho: string // endereço curto para divulgar
  instagram: string
  icone: string // nome do ícone (components/Icon)
  botao: string
}

export const FRENTES: FrenteInfo[] = [
  {
    id: 'arquivos',
    nome: 'planê.arquivos',
    marca: 'arquivos',
    para: 'para quem atende cliente',
    frase: 'arquivos prontos para mandar hoje',
    desc: 'Avisos, fichas, tabelas e planilhas editáveis para profissionais da beleza, freelancers e pequenos negócios.',
    rota: '#/arquivos',
    caminho: 'useplane.com.br/arquivos',
    instagram: '@plane.arquivos',
    icone: 'file',
    botao: 'ver os arquivos',
  },
  {
    id: 'arq',
    nome: 'planê.arq',
    marca: 'arq',
    para: 'para quem projeta',
    frase: 'do primeiro cliente ao primeiro escritório',
    desc: 'Gestão de propostas, contratos e cobranças, e os modelos que ela usa, para estudantes e escritórios pequenos.',
    rota: '#/arq',
    caminho: 'useplane.com.br/arq',
    instagram: '@sou.plane',
    icone: 'ruler',
    botao: 'conhecer',
  },
  {
    id: 'apzinho',
    nome: 'planê.apê',
    marca: 'apê',
    para: 'para quem compra apê',
    frase: 'do contrato às chaves',
    desc: 'Guias, checklists e planilhas para comprar na planta ou pronto, e uma plataforma para acompanhar a obra.',
    rota: '#/ape/loja',
    caminho: 'useplane.com.br/ape',
    instagram: '@apzinho_1204',
    icone: 'home',
    botao: 'ver a loja do apê',
  },
]

export const frente = (id: FrenteId) => FRENTES.find((f) => f.id === id)!
export const instaUrl = (at: string) => `https://instagram.com/${at.replace('@', '')}`
