import { CLOUD, supabase } from '../cloud'
import { APE, DESCONTOS, EXEMPLOS, LOJA_VERSAO, PRODUTOS, ehSanLevi, cleanOrcamento, type Arquivo, type Envio, type Interesse, type Morador, type Orcamento, type Produto } from './model'

/* Onde os dados do planê.apê ficam: no Supabase do planê (tabelas ape_*, ver supabase/ape.sql).
   Sem nuvem (prévia), tudo fica neste navegador, com os orçamentos de exemplo. */

export interface Ajustes {
  produtos: Produto[]
  whatsapp?: string
  lojaV?: number
  descontos?: [number, number][]
}
export interface Publico {
  orcamentos: Orcamento[]
  ajustes: Ajustes
  contagens: Record<string, number> // quantos entraram no grupo
  escolhas: Record<string, number> // quantos vão fechar com este
  minhas: string[] // orçamentos que este morador escolheu
  bloqueado: boolean // não é morador do San Levi: não vê os orçamentos
}

const LOCAL = 'ape-previa-v1'
type Local = { escolhas?: { morador: string; nicho: string; orcamento: string }[]; orcamentos: Orcamento[]; ajustes: Ajustes; moradores: Morador[]; envios: (Omit<Envio, 'morador'> & { moradorId: string })[]; interesses: { orcamento: string; morador: string; criado: string }[] }
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
  return { produtos: atual ? a.produtos! : PRODUTOS, whatsapp: a.whatsapp || '', lojaV: LOJA_VERSAO, descontos: Array.isArray(a.descontos) && a.descontos.length ? a.descontos : DESCONTOS }
}
const moradorOf = (r: Record<string, unknown> | null | undefined): Morador | null =>
  r ? { id: String(r.id), nome: String(r.nome ?? ''), condominio: String(r.condominio ?? APE.condominio), moraJunto: r.mora_junto === true, torre: String(r.torre ?? ''), ap: String(r.ap ?? ''), tel: String(r.tel ?? ''), criado: String(r.criado ?? '') } : null

export const apeCloud = CLOUD

/* ===== página pública ===== */
export async function loadPublico(me?: Morador | null, dona = false): Promise<Publico> {
  const morador = me?.id || ''
  const sl = !!me && ehSanLevi(me)
  if (!CLOUD) {
    const l = readLocal()
    const contagens: Record<string, number> = {}
    for (const i of l.interesses) contagens[i.orcamento] = (contagens[i.orcamento] || 0) + 1
    const escolhas: Record<string, number> = {}
    for (const e of l.escolhas || []) escolhas[e.orcamento] = (escolhas[e.orcamento] || 0) + 1
    const minhas = (l.escolhas || []).filter((e) => e.morador === morador).map((e) => e.orcamento)
    return { orcamentos: sl || dona ? l.orcamentos : [], ajustes: ajustesOf(l.ajustes), contagens, escolhas, minhas, bloqueado: !sl && !dona }
  }
  const [o, a, c] = await Promise.all([
    dona ? sb().from('ape_orcamentos').select('*') : sl ? sb().rpc('ape_orcamentos_morador', { p_morador: morador }) : Promise.resolve({ data: [], error: null }),
    sb().from('ape_ajustes').select('data').eq('id', 1).maybeSingle(),
    sb().rpc('ape_contagens2', { p_morador: morador || null }),
  ])
  fail(o.error as { message?: string } | null)
  const contagens: Record<string, number> = {}
  const escolhas: Record<string, number> = {}
  const minhas: string[] = []
  for (const r of (c.data ?? []) as { orcamento: string; grupo: number; escolhas: number; minha: boolean }[]) {
    contagens[r.orcamento] = r.grupo
    escolhas[r.orcamento] = r.escolhas
    if (r.minha) minhas.push(r.orcamento)
  }
  return { orcamentos: ((o.data ?? []) as Parameters<typeof rowToOrc>[0][]).map(rowToOrc), ajustes: ajustesOf(a.data?.data), contagens, escolhas, minhas, bloqueado: !sl && !dona }
}

/** "Vou fechar com este" (um por serviço; tocar de novo desmarca). Devolve o orçamento escolhido ou ''. */
export async function escolher(orcamento: string, moradorId: string, nicho: string): Promise<string> {
  if (!CLOUD) {
    let out = ''
    writeLocal((l) => {
      l.escolhas = l.escolhas || []
      const ja = l.escolhas.find((e) => e.morador === moradorId && e.nicho === nicho)
      l.escolhas = l.escolhas.filter((e) => !(e.morador === moradorId && e.nicho === nicho))
      if (ja?.orcamento !== orcamento) {
        l.escolhas.push({ morador: moradorId, nicho, orcamento })
        out = orcamento
      }
    })
    return out
  }
  const { data, error } = await sb().rpc('ape_escolher', { p_orcamento: orcamento, p_morador: moradorId })
  fail(error)
  return String(data ?? '')
}

/** Quem já tem cadastro nesta torre e apê do San Levi (primeiro nome e inicial), para perguntar se mora junto. */
export async function mesmoAp(torre: string, ap: string, id?: string): Promise<string[]> {
  if (!torre.trim() || !ap.trim()) return []
  if (!CLOUD) {
    return readLocal().moradores.filter((m) => m.id !== id && ehSanLevi(m) && m.torre.trim().toLowerCase() === torre.trim().toLowerCase() && m.ap.trim().toLowerCase() === ap.trim().toLowerCase()).map((m) => {
      const p = m.nome.trim().split(/\s+/)
      return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]
    })
  }
  const { data, error } = await sb().rpc('ape_mesmo_ap', { p_torre: torre, p_ap: ap, p_id: id || null })
  return error ? [] : ((data as string[]) ?? [])
}

/** Sobe os anexos já na hora em que a pessoa escolhe (para ler e depois enviar). */
export async function subirArquivos(files: File[], onStep?: (t: string) => void): Promise<Arquivo[]> {
  if (!CLOUD) return files.map((f) => ({ path: '', nome: f.name, tipo: f.type }))
  const pasta = `envios/${crypto.randomUUID()}`
  const out: Arquivo[] = []
  for (const [i, f0] of files.entries()) {
    onStep?.(`subindo ${i + 1} de ${files.length}…`)
    const f = await leve(f0)
    const path = `${pasta}/${i + 1}-${safeName(f.name)}`
    const { error } = await sb().storage.from('ape-envios').upload(path, f, { contentType: f.type || undefined, upsert: false })
    if (error) throw new Error(/size|large/i.test(error.message) ? `O arquivo ${f.name} é grande demais (máximo 15 MB).` : /mime|type/i.test(error.message) ? `O arquivo ${f.name} não é PDF nem imagem.` : error.message)
    out.push({ path, nome: f.name, tipo: f.type })
  }
  return out
}

/** Lê os anexos com IA (no servidor) e devolve fornecedor e serviço para preencher sozinho. */
export async function lerAnexos(moradorId: string, arquivos: Arquivo[], texto = ''): Promise<{ fornecedor: string; nicho: string; servico: string } | null> {
  if (!CLOUD || (!arquivos.some((a) => a.path) && !texto.trim())) return null
  try {
    const { data, error } = await sb().functions.invoke('pagamentos', { body: { acao: 'ape-ler', morador: moradorId, arquivos: arquivos.map((a) => a.path).filter(Boolean), texto } })
    if (error || !data || (data as { erro?: string }).erro) return null
    return data as { fornecedor: string; nicho: string; servico: string }
  } catch {
    return null
  }
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
  const novo = await sb().rpc('ape_cadastro3', { p_id: m.id || null, p_nome: m.nome, p_condominio: m.condominio || APE.condominio, p_torre: m.torre, p_ap: m.ap, p_tel: m.tel, p_junto: !!m.moraJunto })
  if (!novo.error) return String(novo.data)
  const { data, error } = await sb().rpc('ape_cadastro2', { p_id: m.id || null, p_nome: m.nome, p_condominio: m.condominio || APE.condominio, p_torre: m.torre, p_ap: m.ap, p_tel: m.tel })
  if (!error) return String(data)
  // banco ainda sem a atualização: cadastro antigo (só San Levi)
  if (ehSanLevi(m as Morador) && m.torre && m.ap) {
    const old = await sb().rpc('ape_cadastro', { p_id: m.id || null, p_nome: m.nome, p_torre: m.torre, p_ap: m.ap, p_tel: m.tel })
    fail(old.error)
    return String(old.data)
  }
  fail(error)
  return ''
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

export async function enviar(moradorId: string, e: { nicho: string; fornecedor: string; texto: string; files: File[]; arquivos?: Arquivo[] }, onStep?: (t: string) => void): Promise<void> {
  if (!CLOUD) {
    writeLocal((l) => {
      l.envios.unshift({ id: crypto.randomUUID(), moradorId, nicho: e.nicho, fornecedor: e.fornecedor, texto: e.texto, arquivos: e.files.map((f) => ({ path: '', nome: f.name, tipo: f.type })), status: 'novo', criado: new Date().toISOString() })
    })
    return
  }
  const arquivos = e.arquivos?.length ? e.arquivos : await subirArquivos(e.files, onStep)
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
    return (await loadPublico(null, true)).orcamentos
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
  async escolhas(): Promise<{ orcamento: string; nicho: string; morador: Morador | null }[]> {
    if (!CLOUD) {
      const l = readLocal()
      return (l.escolhas || []).map((e) => ({ orcamento: e.orcamento, nicho: e.nicho, morador: l.moradores.find((m) => m.id === e.morador) ?? null }))
    }
    const { data, error } = await sb().from('ape_escolhas').select('*, pessoa:ape_moradores(*)')
    if (error) return []
    return (data ?? []).map((r) => ({ orcamento: String(r.orcamento), nicho: String(r.nicho), morador: moradorOf(r.pessoa as Record<string, unknown> | null) }))
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

/* ===== loja: pagamento pelo Asaas (função "pagamentos" do Supabase) ===== */
export interface Pedido {
  status: 'pendente' | 'pago' | 'cancelado'
  itens: { id: string; nome: string; preco: number }[]
  total: number
  nome?: string
  arquivos?: { produto: string; nome: string; url: string }[]
}
const PED = 'ape-pedidos'
export const pedidosLocais = (): { token: string; criado: string; total: number }[] => {
  try {
    return JSON.parse(localStorage.getItem(PED) || '[]')
  } catch {
    return []
  }
}
/** Cria o pedido e devolve o link de pagamento do Asaas (o preço é calculado na função, não aqui). */
export async function criarPedido(d: { itens: string[]; morador?: string; nome: string; tel: string; email?: string; forma: 'pix' | 'cartao'; aceite: boolean }): Promise<{ url: string; token: string; total: number }> {
  if (!CLOUD) throw new Error('Na prévia não dá para pagar de verdade.')
  const { data, error } = await sb().functions.invoke('pagamentos', { body: { acao: 'ape-criar', ...d } })
  const erro = (data as { erro?: string } | null)?.erro
  if (error || erro || !data?.url) throw new Error(erro || (error?.message?.includes('non-2xx') ? 'o pagamento ainda não está ligado' : error?.message) || 'sem resposta')
  try {
    localStorage.setItem(PED, JSON.stringify([{ token: data.token, criado: new Date().toISOString(), total: data.total }, ...pedidosLocais()].slice(0, 20)))
  } catch {
    /* ok */
  }
  return data as { url: string; token: string; total: number }
}
export async function verPedido(token: string): Promise<Pedido | null> {
  if (!CLOUD) return null
  const { data, error } = await sb().functions.invoke('pagamentos', { body: { acao: 'ape-pedido', token } })
  if (error || !data || (data as { erro?: string }).erro) return null
  return data as Pedido
}

/* ===== painel: pedidos e arquivos que a loja entrega ===== */
export interface PedidoAdmin {
  id: string
  nome: string
  tel: string
  email: string
  itens: { id: string; nome: string; preco: number }[]
  total: number
  desconto: number
  status: Pedido['status']
  forma: string
  criado: string
  pago_em: string | null
  baixados: number
}
export const loja = {
  async pedidos(): Promise<PedidoAdmin[]> {
    if (!CLOUD) return []
    const { data, error } = await sb().from('ape_pedidos').select('*').order('criado', { ascending: false }).limit(300)
    fail(error)
    return (data ?? []).map((r) => ({ ...(r as PedidoAdmin), total: Number(r.total), desconto: Number(r.desconto) }))
  },
  async arquivos(produto: string): Promise<{ nome: string; tamanho: number }[]> {
    if (!CLOUD) return []
    const { data, error } = await sb().storage.from('ape-arquivos').list(produto, { limit: 20 })
    fail(error)
    return (data ?? []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => ({ nome: f.name, tamanho: Number(f.metadata?.size ?? 0) }))
  },
  async enviarArquivo(produto: string, f: File) {
    if (!CLOUD) throw new Error('Na prévia os arquivos não ficam guardados.')
    const nome = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.() -]+/g, '-')
    const { error } = await sb().storage.from('ape-arquivos').upload(`${produto}/${nome}`, f, { upsert: true, contentType: f.type || undefined })
    fail(error)
  },
  async apagarArquivo(produto: string, nome: string) {
    const { error } = await sb().storage.from('ape-arquivos').remove([`${produto}/${nome}`])
    fail(error)
  },
}
