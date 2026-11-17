import { publishPublicBlob, supabase } from './cloud'
import { RDL_ID } from './rdl'
import { laudoHtml, type Gravidade, type LaudoData, type LaudoFoto, type Teste } from './rdlDocs'
import { VISTORIA_CHECKLIST } from './vistoriaChecklist'
import { linkPainelBase, unidade, type Reserva, type ReservaConfig } from './rdlReserva'

/* Laudo de vistoria montado no sistema da RDL (no celular, durante a vistoria): itens para reparo com
   fotos, testes, não verificados e observações. Fica guardado na reserva (status.laudoDados) e vira o
   laudo no padrão da RDL, num link que o morador abre pelo painel (#/vistoria/laudo-<id>.<token>). */

export interface LaudoItemRascunho {
  id: string
  ambiente: string
  item: string
  encontrado: string
  gravidade: Gravidade
  fotos: LaudoFoto[]
  corrigido?: boolean
}
export interface LaudoRascunho {
  inicio?: string
  fim?: string
  acompanhante?: string
  artNum?: string
  ambientes: string[]
  itens: LaudoItemRascunho[]
  gerais: LaudoFoto[]
  testes: Record<string, Teste>
  naoVerificados: string
  obs: string
  atualizado?: string
}

/** Ambientes do apê do San Levi (2 quartos). Dá para tirar ou incluir no laudo. */
export const AMBIENTES_APE = ['Sala', 'Cozinha', 'Lavanderia', 'Quarto 1', 'Quarto 2', 'Banheiro', 'Corredor']
export const AMBIENTES_EXTRA = ['Sacada / Varanda', 'Garagem', 'Lavabo', 'Escritório']

export const rascunhoVazio = (): LaudoRascunho => ({ ambientes: [...AMBIENTES_APE], itens: [], gerais: [], testes: {}, naoVerificados: '', obs: '' })

/** Tipo do ambiente no checklist ("Quarto 2" → Quarto, "Lavabo" → Banheiro, "Escritório" → Quarto). */
export const tipoAmbiente = (a: string) => {
  const base = a.replace(/\s+\d+$/, '')
  if (/lavabo/i.test(base)) return 'Banheiro'
  if (/escrit|closet/i.test(base)) return 'Quarto'
  return VISTORIA_CHECKLIST.find((x) => x.ambiente === base)?.ambiente ?? 'Sala'
}
/** Sugestões de "item verificado" para o ambiente (quadros do checklist). */
export const quadrosDe = (a: string) => VISTORIA_CHECKLIST.find((x) => x.ambiente === tipoAmbiente(a))?.quadros.map((q) => q.nome) ?? []
const itensDoAmbiente = (a: string) => VISTORIA_CHECKLIST.find((x) => x.ambiente === tipoAmbiente(a))?.quadros.reduce((n, q) => n + q.itens.length, 0) ?? 0

export const linkLaudo = (r: Pick<Reserva, 'id' | 'token'>) => `${linkPainelBase()}#/vistoria/laudo-${r.id}.${r.token}`

/** Dados do laudo (padrão da RDL) a partir da reserva e do que foi preenchido. */
export function laudoDe(r: Reserva, cfg: Pick<ReservaConfig, 'empreendimento'>): LaudoData {
  const l = r.status.laudoDados ?? rascunhoVazio()
  const d = r.dados
  return {
    owner: d.nome,
    development: cfg.empreendimento,
    builder: 'MRV Engenharia',
    address: [d.rua, d.numero, d.bairro, d.cidade && `${d.cidade} - ${d.uf}`].filter(Boolean).join(', ') || undefined,
    unit: unidade(d),
    plan: d.planta,
    date: r.status.data,
    time: [l.inicio, l.fim].filter(Boolean).join(' às ') || r.status.hora,
    companion: l.acompanhante,
    art: l.artNum,
    items: l.itens.map((it) => ({ room: it.ambiente, item: it.item, found: it.encontrado, gravidade: it.gravidade, photos: it.fotos, fixed: it.corrigido })),
    rooms: l.ambientes.map((a) => ({ room: a, checked: itensDoAmbiente(a), problems: l.itens.filter((it) => it.ambiente === a).length })),
    tests: l.testes,
    notChecked: l.naoVerificados
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean),
    general: l.gerais,
    revisitDate: r.status.revistoriaData,
    notes: l.obs,
  }
}
export const htmlDoLaudo = (r: Reserva, cfg: Pick<ReservaConfig, 'empreendimento'>) => laudoHtml(laudoDe(r, cfg))

/** Reduz a foto (até 1600 px, JPEG) e guarda na pasta da RDL. Devolve o endereço e o tamanho (para saber se é horizontal ou vertical). */
export async function enviarFoto(file: File, reservaId: string): Promise<LaudoFoto> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, err) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = err
      i.src = url
    })
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * k)
    const h = Math.round(img.naturalHeight * k)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob>((ok, err) => c.toBlob((b) => (b ? ok(b) : err(new Error('foto'))), 'image/jpeg', 0.82))
    if (!supabase) return { url: c.toDataURL('image/jpeg', 0.7), w, h }
    const nome = `laudo/${reservaId}/${crypto.randomUUID()}.jpg`
    return { url: await publishPublicBlob(RDL_ID, nome, blob), w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}
