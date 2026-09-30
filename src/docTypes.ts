/* Documentos do estúdio (menu "documentos"): o que a pessoa escreveu fica guardado
   na conta, para abrir de novo e baixar outra vez. */

export interface GuideStep {
  title: string
  text: string
}
export interface MeasureGuideData {
  title?: string
  intro?: string
  steps?: GuideStep[]
  photos?: string[] // fotos de exemplo (até 3)
  closing?: string
  example?: boolean // mostra a página com o exemplo de medição (padrão: sim)
}

export type PlaqueLayout = 'diagonal' | 'retrato' | 'faixa' | 'moldura'
export interface PlaqueData {
  layout?: PlaqueLayout
  line1?: string
  line2?: string
  name?: string
  credential?: string // CAU / CREA / ABD
  phone?: string
  cta?: string
  link?: string // vira o QR code
  photo?: string
  size?: '60x80' | '90x120' | 'a4'
}

export interface DeckImage {
  src: string
  caption?: string
}
export interface DeckData {
  projectId?: string
  title?: string
  subtitle?: string
  client?: string
  cover?: string
  brief?: string[] // o ponto de partida (o que o cliente pediu)
  concept?: string
  mood?: string[] // imagens do moodboard (até 4)
  plan?: DeckImage // planta de layout
  planNotes?: string[]
  renders?: DeckImage[] // imagens 3D (até 6)
  materials?: { name: string; color: string }[]
  stage?: number // etapa atual (destacada na linha do tempo)
  next?: string[]
  thanks?: string
}

export interface DocsState {
  guide?: MeasureGuideData
  plaque?: PlaqueData
  deck?: DeckData
}
