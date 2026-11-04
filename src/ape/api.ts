import { CLOUD, supabase } from '../cloud'
import { EXEMPLOS, LOJA_VERSAO, PRODUTOS, cleanOrcamento, type Arquivo, type Envio, type Interesse, type Morador, type Orcamento, type Produto } from './model'

/* Onde os dados do planê.apê ficam: no Supabase do planê (tabelas ape_*, ver supabase/ape.sql).
   Sem nuvem (prévia), tudo fica neste navegador, com os orçamentos de exemplo. */

export interface Ajustes {
  produtos: Produto[]
  whatsapp?: string
  lojaV?: number
}
export interface Publico {
  orcamentos: Orcamento[]
  ajustes: Ajustes
  contagens: Record<string, number>
}

const LOCAL = 'ape-previa-v1'
type Local = { orcamentos: Orcamento[]; ajustes: Ajustes; moradores: Morador[]; envios: (Omit<Envio, 'morador'> & { moradorId: string })[]; interesses: { orcamento: string; morador: string; criado: string }[] }
const readLocal = (): Local => {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL) || 'null') as Local | null
    if (v) return v
  } catch {
    /* começa do zero */
  }
  return { orcamentos: EXEMPLOS, ajustes: { produtos: PRODUTOS }, moradores: [], envios: [], interesses: [] }
}
const writeLocal = (fn: (l: Local) => void) => {
  const l = readLocal()
  fn(l)
  try {
    localStorage.setItem(LOCAL, JSON.stringify(l))
  } catch {
    /* sem espaço: segue em memória */
  }
  return l
}
const sb = () => supabase!
const fail = (error: { message?: string } | null) => {
  if (error) throw new Error(error.message || 'erro')
}
const rowToOrc = (r: { id: string; data: Record<string, unknown>; oculto: boolean; exemplo: boolean; criado: string }) =>
  cleanOrcamento(r.data, { ...(r.data as Partial<Orcamento>), id: r.id, oculto: r.oculto, exemplo: r.exemplo, criado: String((r.data as Partial<Orcamento>).criado || r.criado) })
const ajustesOf = (d: unknown): Ajustes => {
  const a = (d || {}) as Partial<Ajustes>
  // loja antiga (antes das categorias): usa a nova, mantendo só o WhatsApp
  const atual = (a.lojaV || 0) >= LOJA_VERSAO && Array.isArray(a.produtos) && a.produtos.length
  return { produtos: atual ? a.produtos! : PRODUTOS, whatsapp: a.whatsapp || '', lojaV: LOJA_VERSAO }
}
const moradorOf = (r: Record<string, unknown> | null | undefined): Morador | null =>
  r ? { id: String(r.id), nome: String(r.nome ?? ''), torre: String(r.torre ?? ''), ap: String(r.ap ?? ''), tel: String(r.tel ?? ''), criado: String(r.criado ?? '') } : null

export const apeCloud = CLOUD

/* ===== página pública ===== */
export async function loadPublico(): Promise<Publico> {
  if (!CLOUD) {
    const l = readLocal()
    const contagens: Record<string, number> = {}
    for (const i of l.interesses) contagens[i.orcamento] = (contagens[i.orcamento] || 0) + 1
    return { orcamentos: l.orcamentos, ajustes: ajustesOf(l.ajustes), contagens }
  }
  const [o, a, c] = await Promise.all([
    sb().from('ape_orcamentos').select('*'),
    sb().from('ape_ajustes').select('data').eq('id', 1).maybeSingle(),
    sb().rpc('ape_contagens'),
  ])
  fail(o.error)
  const contagens: Record<string, number> = {}
  for (const r of (c.data ?? []) as { orcamento: string; n: number }[]) contagens[r.orcamento] = r.n
  return { orcamentos: (o.data ?? []).map(rowToOrc), ajustes: ajustesOf(a.data?.data), contagens }
}

/** É a dona olhando a página (logada no planê)? */
export async function souDona(): Promise<boolean> {
  if (!CLOUD) return false
  const { data } = await sb().auth.getSession()
  if (!data.session) return false
  const r = await sb().rpc('sou_dona')
  return r.data === true
}

export async function cadastrar(m: Omit<Morador, 'id'> & { id?: string }): Promise<string> {
  if (!CLOUD) {
    const id = m.id || crypto.randomUUID()
    writeLocal((l) => {
      l.moradores = [...l.moradores.filter((x) => x.id !== id), { ...m, id, criado: new Date().toISOString() }]
    })
    return id
  }
  const { data, error } = await sb().rpc('ape_cadastro', { p_id: m.id || null, p_nome: m.nome, p_torre: m.torre, p_ap: m.ap, p_tel: m.tel })
  fail(error)
  return String(data)
}

const safeName = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-80) || 'arquivo'

/** Foto ou print grande vira JPEG mais leve (sobe rápido no 4G). PDF e imagens pequenas vão como estão. */
async function leve(f: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/i.test(f.type) || f.size < 1.5 * 1024 * 1024) return f
  try {
    const bmp = await createImageBitmap(f)
    const max = 2200
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k)
    c.height = Math.round(bmp.height * k)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.85))
    if (!blob || blob.size >= f.size) return f
    return new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return f
  }
}

export interface MeuEnvio {
  id: string
  fornecedor: string
  nicho: string
  status: Envio['status']
  criado: string
}
/** Os orçamentos que este morador mandou e em que pé estão. */
export async function meusEnvios(moradorId: string): Promise<MeuEnvio[]> {
  if (!CLOUD) return readLocal().envios.filter((e) => e.moradorId === moradorId).map((e) => ({ id: e.id, fornecedor: e.fornecedor, nicho: e.nicho, status: e.status, criado: e.criado }))
  const { data, error } = await sb().rpc('ape_meus_envios', { p_morador: moradorId })
  if (error) return []
  return ((data ?? []) as MeuEnvio[]).map((r) => ({ ...r, id: String(r.id), criado: String(r.criado) }))
}

/** Quantos orçamentos dos moradores ainda não foram vistos (aviso no menu da dona). */
export async function novosEnvios(): Promise<number> {
  if (!CLOUD) return readLocal().envios.filter((e) => e.status === 'novo').length
  const { count, error } = await sb().from('ape_envios').select('id', { count: 'exact', head: true }).eq('status', 'novo')
  return error ? 0 : count ?? 0
}

export async function enviar(moradorId: string, e: { nicho: string; fornecedor: string; texto: string; files: File[] }, onStep?: (t: string) => void): Promise<void> {
  if (!CLOUD) {
    writeLocal((l) => {
      l.envios.unshift({ id: crypto.randomUUID(), moradorId, nicho: e.nicho, fornecedor: e.fornecedor, texto: e.texto, arquivos: e.files.map((f) => ({ path: '', nome: f.name, tipo: f.type })), status: 'novo', criado: new Date().toISOString() })
    })
    return
  }
  const pasta = `envios/${crypto.randomUUID()}`
  const arquivos: Arquivo[] = []
  for (const [i, f0] of e.files.entries()) {
    onStep?.(`Enviando arquivo ${i + 1} de ${e.files.length}…`)
    const f = await leve(f0)
    const path = `${pasta}/${i + 1}-${safeName(f.name)}`
    const { error } = await sb().storage.from('ape-envios').upload(path, f, { contentType: f.type || undefined, upsert: false })
    if (error) throw new Error(/size|large/i.test(error.message) ? `O arquivo ${f.name} é grande demais (máximo 15 MB).` : /mime|type/i.test(error.message) ? `O arquivo ${f.name} não é PDF nem imagem.` : error.message)
    arquivos.push({ path, nome: f.name, tipo: f.type })
  }
  onStep?.('Guardando o orçamento…')
  const { error } = await sb().rpc('ape_enviar', { p_morador: moradorId, p_nicho: e.nicho, p_fornecedor: e.fornecedor, p_texto: e.texto, p_arquivos: arquivos })
  fail(error)
}

export async function queroGrupo(orcamento: string, moradorId: string): Promise<number> {
  if (!CLOUD) {
    const l = writeLocal((l) => {
      if (!l.interesses.some((i) => i.orcamento === orcamento && i.morador === moradorId)) l.interesses.push({ orcamento, morador: moradorId, criado: new Date().toISOString() })
    })
    return l.interesses.filter((i) => i.orcamento === orcamento).length
  }
  const { data, error } = await sb().rpc('ape_quero_grupo', { p_orcamento: orcamento, p_morador: moradorId })
  fail(error)
  return Number(data) || 0
}

/* ===== painel da dona ===== */
export const admin = {
  async orcamentos(): Promise<Orcamento[]> {
    return (await loadPublico()).orcamentos
  },
  async salvar(o: Orcamento) {
    if (!CLOUD) {
      writeLocal((l) => {
        l.orcamentos = l.orcamentos.some((x) => x.id === o.id) ? l.orcamentos.map((x) => (x.id === o.id ? o : x)) : [o, ...l.orcamentos]
      })
      return
    }
    const { error } = await sb().from('ape_orcamentos').upsert({ id: o.id, data: o, oculto: !!o.oculto, exemplo: !!o.exemplo, atualizado: new Date().toISOString() })
    fail(error)
  },
  async remover(ids: string[]) {
    if (!ids.length) return
    if (!CLOUD) {
      writeLocal((l) => {
        l.orcamentos = l.orcamentos.filter((x) => !ids.includes(x.id))
      })
      return
    }
    const { error } = await sb().from('ape_orcamentos').delete().in('id', ids)
    fail(error)
  },
  async ajustes(): Promise<Ajustes> {
    return (await loadPublico()).ajustes
  },
  async salvarAjustes(a: Ajustes) {
    if (!CLOUD) {
      writeLocal((l) => {
        l.ajustes = a
      })
      return
    }
    const { error } = await sb().from('ape_ajustes').upsert({ id: 1, data: a })
    fail(error)
  },
  async moradores(): Promise<Morador[]> {
    if (!CLOUD) return readLocal().moradores
    const { data, error } = await sb().from('ape_moradores').select('*').order('criado', { ascending: false })
    fail(error)
    return (data ?? []).map((r) => moradorOf(r)!)
  },
  async removerMorador(id: string) {
    if (!CLOUD) {
      writeLocal((l) => {
        l.moradores = l.moradores.filter((m) => m.id !== id)
        l.interesses = l.interesses.filter((i) => i.morador !== id)
      })
      return
    }
    const { error } = await sb().from('ape_moradores').delete().eq('id', id)
    fail(error)
  },
  async envios(): Promise<Envio[]> {
    if (!CLOUD) {
      const l = readLocal()
      return l.envios.map(({ moradorId, ...e }) => ({ ...e, morador: l.moradores.find((m) => m.id === moradorId) ?? null }))
    }
    const { data, error } = await sb().from('ape_envios').select('*, pessoa:ape_moradores(*)').order('criado', { ascending: false }).limit(300)
    fail(error)
    return (data ?? []).map((r) => ({
      id: String(r.id),
      morador: moradorOf(r.pessoa as Record<string, unknown> | null),
      nicho: String(r.nicho ?? ''),
      fornecedor: String(r.fornecedor ?? ''),
      texto: String(r.texto ?? ''),
      arquivos: Array.isArray(r.arquivos) ? (r.arquivos as Arquivo[]) : [],
      status: r.status as Envio['status'],
      orcamento: r.orcamento ? String(r.orcamento) : undefined,
      criado: String(r.criado),
    }))
  },
  async marcarEnvio(id: string, status: Envio['status'], orcamento?: string) {
    if (!CLOUD) {
      writeLocal((l) => {
        l.envios = l.envios.map((e) => (e.id === id ? { ...e, status, orcamento: orcamento ?? e.orcamento } : e))
      })
      return
    }
    const { error } = await sb().from('ape_envios').update(orcamento ? { status, orcamento } : { status }).eq('id', id)
    fail(error)
  },
  /** Baixa um arquivo enviado pelo morador (a pasta é privada: só a dona abre). */
  async arquivo(a: Arquivo): Promise<Blob | null> {
    if (!CLOUD || !a.path) return null
    const { data, error } = await sb().storage.from('ape-envios').download(a.path)
    fail(error)
    return data
  },
  async interesses(): Promise<Interesse[]> {
    if (!CLOUD) {
      const l = readLocal()
      return l.interesses.map((i) => ({ orcamento: i.orcamento, criado: i.criado, morador: l.moradores.find((m) => m.id === i.morador) ?? null }))
    }
    const { data, error } = await sb().from('ape_interesses').select('*, pessoa:ape_moradores(*)').order('criado', { ascending: false })
    fail(error)
    return (data ?? []).map((r) => ({ orcamento: String(r.orcamento), criado: String(r.criado), morador: moradorOf(r.pessoa as Record<string, unknown> | null) }))
  },
}
