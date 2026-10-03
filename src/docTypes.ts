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
  photos?: string[] // fotos de exemplo (até 4)
  photoFrames?: (PhotoPos | undefined)[] // enquadramento de cada foto
  shots?: string[] // legenda de cada foto ("cada parede, de frente"…)
  closing?: string
  example?: boolean // mostra o desenho com o exemplo de medição (padrão: sim)
  photosOn?: boolean // mostra as fotos que ajudam (padrão: sim; sem fotos, não aparece)
}

/** Enquadramento de uma foto dentro do molde: ponto central (0–100%) e aproximação (1 = inteira). */
export interface PhotoPos {
  x: number
  y: number
  zoom: number
  fit?: boolean // encaixar a foto inteira no espaço (sem cortar)
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
  photoPos?: PhotoPos // enquadramento da foto (arrastar e aproximar)
  size?: '60x80' | '90x120' | 'a4'
}

export interface DeckImage {
  src: string
  caption?: string
  pos?: PhotoPos // recorte ou encaixe no espaço
}
export interface DeckData {
  projectId?: string
  title?: string
  subtitle?: string
  client?: string
  cover?: string
  coverPos?: PhotoPos
  brief?: string[] // o ponto de partida (o que o cliente pediu)
  concept?: string
  mood?: string[] // imagens do moodboard (até 4)
  moodPos?: (PhotoPos | undefined)[]
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

export type DocKind = 'guia' | 'placa' | 'briefing' | 'apresentacao' | 'obra'
/** Documento salvo na ficha de um cliente (abre de novo para editar ou baixar). */
export interface SavedDoc {
  id: string
  clientId: string
  kind: DocKind
  title: string
  guide?: MeasureGuideData
  plaque?: PlaqueData
  deck?: DeckData
  briefingTpl?: string // modelo de briefing (briefing em PDF)
  work?: import('./workDocs').WorkDoc // documento de obra (memorial, compras, custos, diário, visita, ata, OS)
  html?: string // edições feitas direto na folha
  createdAt: string
  updatedAt: string
}
