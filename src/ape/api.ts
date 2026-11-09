import { CLOUD, supabase } from '../cloud'
import { APE, EXEMPLOS, JUROS_PCT, LOJA_VERSAO, MIGRA_LOJA, PIX_PCT, PRODUTOS, TAXAS, comPrecos, conta, ehSanLevi, cleanOrcamento, type Arquivo, type Envio, type Interesse, type Morador, type Orcamento, type Produto, type Taxas } from './model'

/* Onde os dados do planê.apê ficam: no Supabase do planê (tabelas ape_*, ver supabase/ape.sql).
   Sem nuvem (prévia), tudo fica neste navegador, com os orçamentos de exemplo. */

export interface Ajustes {
  produtos: Produto[]
  whatsapp?: string
  lojaV?: number
  pixPct?: number // desconto no Pix (padrão 5%)
  jurosPct?: number // juros ao mês do cartão parcelado (padrão 2,99%)
  taxas?: Taxas // taxas do Asaas, só para conferir a margem no painel
  fotoPainel?: string // foto do painel da dona (o símbolo do San Levi se vazio)
  fotoProjeto?: string // foto da seção de projetos (o painel troca; pasta pública ape-publico)
  fotoProjeto2?: string // segunda foto (opcional): com duas, aparecem lado a lado
  vendedor?: Vendedor // quem vende (aparece nos termos e no rodapé da loja: exigência do comércio eletrônico)
}
export interface Vendedor { nome: string; doc: string; cidade: string; email: string }
export interface Publico {
  orcamentos: Orcamento[]
  ajustes: Ajustes
  contagens: Record<string, number> // quantos entraram no grupo
  escolhas: Record<string, number> // quantos vão fechar com este
  minhas: string[] // orçamentos que este morador escolheu
  bloqueado: boolean // não é morador do San Levi: não vê os orçamentos
  meus: string[] // orçamentos que este morador mandou (pode corrigir ou apagar)
  pendente: boolean // é do San Levi mas ainda não entrou com o código nem foi aprovado
}

const LOCAL = 'ape-previa-v1'
type Local = { pedidos?: PedidoLocal[]; plataforma?: Record<string, { nome: string; validade: string; cortesia: boolean; dados: PlatDados; atualizado: string }>; escolhas?: { morador: string; nicho: string; orcamento: string }[]; orcamentos: Orcamento[]; ajustes: Ajustes; moradores: Morador[]; envios: (Omit<Envio, 'morador'> & { moradorId: string })[]; interesses: { orcamento: string; morador: string; criado: string }[] }
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
const rowToOrc = (r: { id: string; data: Record<string, unknown>; oculto: boolean; exemplo: boolean; criado: string; morador?: string | null }) =>
  cleanOrcamento(r.data, { ...(r.data as Partial<Orcamento>), id: r.id, oculto: r.oculto, exemplo: r.exemplo, criado: String((r.data as Partial<Orcamento>).criado || r.criado) })
const ajustesOf = (d: unknown): Ajustes => {
  const a = (d || {}) as Partial<Ajustes>
  // loja antiga (antes das categorias, v7): usa a nova, mantendo só o WhatsApp
  const atual = (a.lojaV || 0) >= 7 && Array.isArray(a.produtos) && a.produtos.length
  const pixPct = typeof a.pixPct === 'number' && a.pixPct >= 0 && a.pixPct <= 10 ? a.pixPct : PIX_PCT
  const jurosPct = typeof a.jurosPct === 'number' && a.jurosPct >= 0 && a.jurosPct <= 10 ? a.jurosPct : JUROS_PCT
  let base: Produto[] = PRODUTOS
  if (atual) {
    // imagens de amostra vêm sempre do site (são refeitas junto com os arquivos)
    base = a.produtos!.map((p) => { const d = PRODUTOS.find((x) => x.id === p.id); return { ...p, ...(d?.amostras ? { amostras: d.amostras } : {}), ...(p.selo === undefined && d?.selo ? { selo: d.selo } : {}) } })
    // versões novas da loja: entram os produtos novos e trocam só os campos que a versão mudou
    for (const [v, m] of Object.entries(MIGRA_LOJA)) {
      if ((a.lojaV || 0) >= Number(v)) continue
      for (const [id, campos] of Object.entries(m.troca)) {
        const d = PRODUTOS.find((x) => x.id === id)
        base = base.map((p) => (p.id === id && d ? { ...p, ...Object.fromEntries(campos.map((c) => [c, d[c]])) } : p))
      }
      for (const id of m.novos) if (!base.some((p) => p.id === id)) { const d = PRODUTOS.find((x) => x.id === id); if (d) base.push(d) }
    }
  }
  return { produtos: comPrecos(base), whatsapp: a.whatsapp || '', lojaV: LOJA_VERSAO, pixPct, jurosPct, taxas: { ...TAXAS, ...(a.taxas || {}) }, vendedor: { nome: 'Laís', doc: '', cidade: '', email: 'equipe.plane@gmail.com', ...(a.vendedor || {}) }, fotoProjeto: a.fotoProjeto || '', fotoProjeto2: a.fotoProjeto2 || '', fotoPainel: a.fotoPainel || '' }
}
const moradorOf = (r: Record<string, unknown> | null | undefined): Morador | null =>
  r ? { id: String(r.id), nome: String(r.nome ?? ''), condominio: String(r.condominio ?? APE.condominio), moraJunto: r.mora_junto === true, aprovado: r.aprovado === true, pessoas: r.pessoas == null ? null : Number(r.pessoas), familia: Array.isArray(r.familia) ? (r.familia as string[]) : undefined, torre: String(r.torre ?? ''), ap: String(r.ap ?? ''), tel: String(r.tel ?? ''), criado: String(r.criado ?? '') } : null

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
    const meus = l.orcamentos.filter((o) => (o as Orcamento & { morador?: string }).morador === morador && morador).map((o) => o.id)
    return { orcamentos: sl || dona ? l.orcamentos : [], ajustes: ajustesOf(l.ajustes), contagens, escolhas, minhas, bloqueado: !sl && !dona, meus, pendente: false }
  }
  const eu = sl && !dona ? await euMorador(morador) : null
  const pendente = sl && !dona && eu?.aprovado === false
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
  const rows = (o.data ?? []) as (Parameters<typeof rowToOrc>[0] & { meu?: boolean })[]
  const meus = rows.filter((r) => r.meu || (dona && r.morador && r.morador === morador)).map((r) => r.id)
  return { orcamentos: rows.map(rowToOrc), ajustes: ajustesOf(a.data?.data), contagens, escolhas, minhas, bloqueado: !sl && !dona, meus, pendente }
}

/** "Vou fechar com este" (um por serviço; tocar de novo desmarca). Devolve o orçamento escolhido ou ''. */
export async function escolher(orcamento: string, moradorId: string, nicho: string): Promise<string> {
  if (!CLOUD) {
    let out = ''
    writeLocal((l) => {
      l.escolhas = l.escolhas || []
      const ja = l.escolhas.find((e) => e.morador === moradorId && e.orcamento === orcamento)
      l.escolhas = l.escolhas.filter((e) => !(e.morador === moradorId && e.orcamento === orcamento))
      if (!ja) {
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
    const tipo = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : /\.png$/i.test(f.name) ? 'image/png' : /\.webp$/i.test(f.name) ? 'image/webp' : /\.hei[cf]$/i.test(f.name) ? 'image/heic' : /\.jpe?g$/i.test(f.name) ? 'image/jpeg' : '')
    if (!tipo || !/^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/i.test(tipo)) throw new Error(`O arquivo ${f.name} precisa ser PDF ou foto (JPG, PNG ou HEIC). Se for Word ou Excel, salve como PDF ou cole o texto.`)
    const { error } = await sb().storage.from('ape-envios').upload(path, f, { contentType: tipo, upsert: false })
    if (error) throw new Error(/size|large/i.test(error.message) ? `O arquivo ${f.name} é grande demais (máximo 15 MB).` : /mime|type/i.test(error.message) ? `O arquivo ${f.name} não é PDF nem imagem.` : error.message)
    out.push({ path, nome: f.name, tipo: f.type })
  }
  return out
}

/** Lê UM arquivo do orçamento com IA (no servidor) e devolve os campos para a comparação, ou o motivo de não ter lido. */
export async function lerArquivo(moradorId: string, arquivo: Arquivo | null, texto = ''): Promise<{ o: Record<string, unknown> | null; lista?: Record<string, unknown>[]; erro?: string }> {
  if (!CLOUD) return { o: null, erro: 'prévia sem IA' }
  if (!arquivo?.path && !texto.trim()) return { o: null }
  try {
    const { data, error } = await sb().functions.invoke('pagamentos', { body: { acao: 'ape-ler', morador: moradorId, arquivo: arquivo?.path || '', texto } })
    const o = (data as { orcamento?: Record<string, unknown> } | null)?.orcamento
    const lista = (data as { orcamentos?: Record<string, unknown>[] } | null)?.orcamentos
    if (o) return { o, lista: Array.isArray(lista) ? lista : [o] }
    let erro = (data as { erro?: string } | null)?.erro || ''
    const ctx = (error as { context?: Response } | null)?.context
    if (!erro && ctx) erro = ((await ctx.json().catch(() => null)) as { erro?: string } | null)?.erro || ''
    return { o: null, erro: erro || error?.message || 'sem resposta' }
  } catch (e) {
    return { o: null, erro: String((e as Error).message) }
  }
}

/** Morador do San Levi digita o código do condomínio (a Laís passa no grupo). */
export async function codigoSL(moradorId: string, codigo: string): Promise<boolean> {
  if (!CLOUD) return true
  const { data, error } = await sb().rpc('ape_codigo_sl', { p_morador: moradorId, p_codigo: codigo })
  fail(error)
  return data === true
}

/** Abre o próprio cadastro pelo link "usar em outro aparelho". */
export async function euMorador(id: string): Promise<Morador | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  if (!CLOUD) return readLocal().moradores.find((m) => m.id === id) || null
  const { data, error } = await sb().rpc('ape_eu', { p_id: id })
  return error ? null : moradorOf(data as Record<string, unknown> | null)
}

/**
 * Confere se o cadastro guardado neste aparelho ainda existe. Se ele foi apagado (por exemplo, cadastros
 * repetidos que a dona juntou), puxa o cadastro certo pela conta logada. Nunca apaga nada no banco.
 * Devolve: o cadastro certo, null (não há cadastro válido) ou undefined (sem internet: deixa como está).
 */
export async function conferirCadastro(local: Morador | null): Promise<Morador | null | undefined> {
  if (!CLOUD) return local
  try {
    if (local?.id) {
      const ok = await euMorador(local.id)
      if (ok) return ok
    }
    if (!sessaoLocal()) return local?.id ? null : local
    const r = await contaApi<{ morador: Record<string, unknown> | null }>('eu')
    return moradorOf(r.morador) || (local?.id ? null : local)
  } catch {
    return undefined
  }
}

/** Avisa a dona na hora quando o pagamento dá erro (e-mail com os dados da compra). Nunca falha para quem compra. */
export async function avisarErroPagamento(d: { nome: string; email: string; tel: string; itens: { nome: string; preco: string }[]; total: number; forma: string; parcelas: number; erro: string }) {
  if (!CLOUD) return
  try { await invoke({ acao: 'ape-erro-pagamento', ...d }) } catch { /* sem conexão: o cliente ainda tem o WhatsApp na tela */ }
}

/** Conta a visita (sem dado pessoal). Não conta a dona: o aparelho dela fica marcado. */
const VSESS = 'ape-visita-id', VDONA = 'ape-sou-dona'
export function marcarDona() { try { localStorage.setItem(VDONA, '1') } catch { /* ok */ } }
export async function registrarVisita(pagina: string) {
  if (!CLOUD) return
  try {
    if (localStorage.getItem(VDONA)) return
    let id = localStorage.getItem(VSESS)
    if (!id) { id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem(VSESS, id) }
    const q = new URLSearchParams(location.search)
    const ref = (document.referrer || '').toLowerCase()
    const deFora = ref && !ref.includes(location.host)
    const origem = (q.get('utm_source') || (deFora ? (/instagram/.test(ref) ? 'instagram' : /whatsapp|wa\.me|l\.wl\.co/.test(ref) ? 'whatsapp' : /tiktok/.test(ref) ? 'tiktok' : /google/.test(ref) ? 'google' : /facebook|fb\./.test(ref) ? 'facebook' : new URL(ref).host.replace(/^www\./, '')) : '') || (/instagram/i.test(navigator.userAgent) ? 'instagram' : /tiktok|musical_ly/i.test(navigator.userAgent) ? 'tiktok' : 'direto')).slice(0, 40)
    const aparelho = /ipad|tablet/i.test(navigator.userAgent) ? 'tablet' : /mobi|android|iphone/i.test(navigator.userAgent) ? 'celular' : 'computador'
    await sb().rpc('ape_visita', { p_sessao: id, p_pagina: pagina, p_origem: origem, p_aparelho: aparelho })
    VINFO = { id, origem, aparelho }
    pingar(pagina)
  } catch { /* sem armazenamento ou sem conexão: não conta */ }
}
/* "estou aqui": a cada 30 s enquanto a página está aberta e visível */
let VINFO: { id: string; origem: string; aparelho: string } | null = null
let VPAG = ''
let VTIMER = 0
function pingar(pagina: string) {
  VPAG = pagina
  const vai = () => { if (VINFO && document.visibilityState === 'visible') void sb().rpc('ape_ping', { p_sessao: VINFO.id, p_pagina: VPAG, p_origem: VINFO.origem, p_aparelho: VINFO.aparelho }).then(() => null, () => null) }
  vai()
  if (!VTIMER) { VTIMER = window.setInterval(vai, 30000); document.addEventListener('visibilitychange', vai) }
}
export interface Online { sessao: string; pagina: string; origem: string; aparelho: string; inicio: string; visto: string; paginas: number }
export interface Visita { criado: string; sessao: string; pagina: string; origem: string; aparelho: string }

/** Números de verdade para a loja (moradores do San Levi aprovados e compras pagas). */
export async function numerosLoja(): Promise<{ moradores: number; compras: number }> {
  if (!CLOUD) return { moradores: 0, compras: 0 }
  try {
    const { data } = await sb().rpc('ape_numeros')
    const d = (data || {}) as { moradores?: number; compras?: number }
    return { moradores: Number(d.moradores) || 0, compras: Number(d.compras) || 0 }
  } catch {
    return { moradores: 0, compras: 0 }
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

/** Publica o orçamento direto na comparação (o morador revisou o que foi lido do arquivo). */
export async function publicar(moradorId: string, o: Orcamento, arquivos: Arquivo[]): Promise<string> {
  const dados = { ...o, arquivos: arquivos.map((a) => ({ nome: a.nome, tipo: a.tipo })) }
  if (!CLOUD) {
    const id = 'm' + Date.now().toString(36)
    writeLocal((l) => {
      l.orcamentos.unshift({ ...dados, id, criado: new Date().toISOString(), morador: moradorId } as Orcamento)
      l.envios.unshift({ id: crypto.randomUUID(), moradorId, nicho: o.nicho, fornecedor: o.fornecedor, texto: '', arquivos, status: 'publicado', orcamento: id, criado: new Date().toISOString() })
    })
    return id
  }
  const { data, error } = await sb().rpc('ape_publicar', { p_morador: moradorId, p_dados: dados, p_arquivos: arquivos })
  fail(error)
  return String(data)
}
/** O morador corrige (dados) ou apaga (null) um orçamento que ele mesmo mandou. */
export async function meuOrcamento(moradorId: string, id: string, o: Orcamento | null) {
  if (!CLOUD) {
    writeLocal((l) => {
      l.orcamentos = o ? l.orcamentos.map((x) => (x.id === id ? { ...o, id, morador: moradorId } as Orcamento : x)) : l.orcamentos.filter((x) => x.id !== id)
    })
    return
  }
  const { error } = await sb().rpc('ape_meu_orcamento', { p_morador: moradorId, p_id: id, p_dados: o })
  fail(error)
}

/** Um vizinho do grupo registra a condição que conseguiu com o fornecedor (desconto, condição e prazo). */
export async function condicaoGrupo(moradorId: string, orcamento: string, c: { pct: number | null; desc: string; ate: string }) {
  if (!CLOUD) {
    writeLocal((l) => { l.orcamentos = l.orcamentos.map((o) => (o.id === orcamento ? { ...o, grupo_pct: c.pct, grupo_desc: c.desc, grupo_ate: c.ate || undefined } : o)) })
    return
  }
  const { error } = await sb().rpc('ape_grupo_condicao', { p_morador: moradorId, p_orcamento: orcamento, p_pct: c.pct, p_desc: c.desc, p_ate: c.ate })
  fail(error)
}
export async function sairGrupo(orcamento: string, moradorId: string): Promise<number> {
  if (!CLOUD) {
    const l = writeLocal((l) => {
      l.interesses = l.interesses.filter((i) => !(i.orcamento === orcamento && i.morador === moradorId))
    })
    return l.interesses.filter((i) => i.orcamento === orcamento).length
  }
  const { data, error } = await sb().rpc('ape_sair_grupo', { p_orcamento: orcamento, p_morador: moradorId })
  fail(error)
  return Number(data) || 0
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
  async online(): Promise<Online[]> {
    if (!CLOUD) return []
    const desde = new Date(Date.now() - 2 * 864e5).toISOString()
    const { data, error } = await sb().from('ape_online').select('*').gte('visto', desde).order('visto', { ascending: false }).limit(300)
    return error ? [] : (data as Online[])
  },
  async visitas(dias = 30): Promise<Visita[]> {
    if (!CLOUD) return []
    const desde = new Date(Date.now() - dias * 864e5).toISOString()
    const { data, error } = await sb().from('ape_visitas').select('criado, sessao, pagina, origem, aparelho').gte('criado', desde).order('criado', { ascending: false }).limit(20000)
    if (error) return []
    return data as Visita[]
  },
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
  async aprovarMorador(id: string, aprovado: boolean) {
    if (!CLOUD) return
    const { error } = await sb().from('ape_moradores').update({ aprovado }).eq('id', id)
    fail(error)
  },
  async codigo(): Promise<string> {
    if (!CLOUD) return ''
    const { data } = await sb().from('ape_segredos').select('dados').eq('id', 'codigo-sl').maybeSingle()
    return String((data?.dados as { codigo?: string } | undefined)?.codigo ?? '')
  },
  async salvarCodigo(codigo: string) {
    if (!CLOUD) return
    const { error } = await sb().from('ape_segredos').upsert({ id: 'codigo-sl', dados: { codigo: codigo.trim() } })
    fail(error)
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
export type StatusPedido = 'pendente' | 'pago' | 'cancelado' | 'reembolsado'
export interface Entrega { produto: string; nome: string; path: string; tipo: string; cor?: string; baixa?: string }
export interface Pedido {
  status: StatusPedido
  itens: { id: string; nome: string; preco: number }[]
  subtotal?: number
  desconto?: number
  total: number
  forma?: string
  nome?: string
  criado?: string
  pago_em?: string
  cortesia?: boolean
  email?: string
  pix?: { img: string; copia: string; expira?: string } | null
  arquivos?: Entrega[]
  bonus?: { liberado: boolean; em: string | null }
  plataforma?: { token: string; validade: string } | null
}
/** Na prévia (sem nuvem) o pedido fica no navegador, para testar o caminho inteiro. */
export interface PedidoLocal extends Pedido { token: string; cpf: string; email: string; tel: string }
const PED = 'ape-pedidos'
export const pedidosLocais = (): { token: string; criado: string; total: number }[] => {
  try {
    return JSON.parse(localStorage.getItem(PED) || '[]')
  } catch {
    return []
  }
}
const lembrar = (token: string, total: number) => {
  try {
    localStorage.setItem(PED, JSON.stringify([{ token, criado: new Date().toISOString(), total }, ...pedidosLocais().filter((p) => p.token !== token)].slice(0, 20)))
  } catch {
    /* ok */
  }
}
const invoke = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await sb().functions.invoke('pagamentos', { body })
  const erro = (data as { erro?: string } | null)?.erro
  if (erro) throw new Error(erro)
  if (error) {
    // a função devolve o motivo no corpo mesmo com erro
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? ((await ctx.json().catch(() => null)) as { erro?: string } | null)?.erro : ''
    throw new Error(msg || (error.message?.includes('non-2xx') ? 'o pagamento ainda não está ligado' : error.message) || 'sem resposta')
  }
  return data as T
}
export interface NovoPedido { token: string; total: number; forma: 'pix' | 'cartao'; pix: Pedido['pix']; url: string | null }
/** Cria o pedido (o preço é calculado na função, não aqui). Pix: o QR aparece na página; cartão: abre a página segura do Asaas. */
export async function criarPedido(d: { itens: string[]; morador?: string; nome: string; cpf: string; tel: string; email: string; forma: 'pix' | 'cartao'; parcelas?: number; aceite: boolean }, produtos: Produto[], pixPct: number): Promise<NovoPedido> {
  if (!CLOUD) {
    const c = conta(d.itens, produtos, d.forma, pixPct)
    const token = crypto.randomUUID()
    const ped: PedidoLocal = { token, status: 'pendente', itens: c.itens.map((p) => ({ id: p.id, nome: p.nome, preco: Number(p.preco.replace(/[^\d,]/g, '').replace(',', '.')) })), subtotal: c.subtotal, desconto: c.desconto, total: c.total, forma: d.forma, nome: d.nome, criado: new Date().toISOString(), cpf: d.cpf, email: d.email, tel: d.tel, pix: d.forma === 'pix' ? { img: '', copia: '00020126580014BR.GOV.BCB.PIX-previa-' + token.slice(0, 8) } : null }
    writeLocal((l) => {
      l.pedidos = [ped, ...(l.pedidos || [])]
    })
    lembrar(token, c.total)
    return { token, total: c.total, forma: d.forma, pix: ped.pix, url: null }
  }
  const r = await invoke<NovoPedido>({ acao: 'ape-criar', ...d })
  lembrar(r.token, r.total)
  return r
}
const KIT_DIAS: Record<string, number> = { plataforma: 365, 'kit-completo': 30 }
/** Prévia: simula o pagamento confirmado (só sem nuvem). */
export function simularPagamento(token: string) {
  writeLocal((l) => {
    const p = (l.pedidos || []).find((x) => x.token === token)
    if (!p || p.status !== 'pendente') return
    p.status = 'pago'
    p.pago_em = new Date().toISOString()
    p.pix = null
    const dias = p.itens.reduce((t, i) => t + (KIT_DIAS[i.id] || 0), 0)
    if (dias) {
      const tk = crypto.randomUUID()
      const v = new Date()
      v.setDate(v.getDate() + dias)
      l.plataforma = { ...(l.plataforma || {}), [tk]: { nome: p.nome || '', validade: v.toISOString().slice(0, 10), cortesia: false, dados: {}, atualizado: new Date().toISOString() } }
      p.plataforma = { token: tk, validade: v.toISOString().slice(0, 10) }
    }
  })
}
export async function verPedido(token: string): Promise<Pedido | null> {
  if (!CLOUD) {
    const p = (readLocal().pedidos || []).find((x) => x.token === token)
    if (!p) return null
    if (p.status !== 'pago') return p
    const ids = [...new Set(p.itens.flatMap((i) => PRODUTOS.find((x) => x.id === i.id)?.combo || [i.id]))].filter((id) => id !== 'plataforma')
    const libera = new Date(new Date(p.pago_em!).getTime() + 7 * 864e5)
    return { ...p, arquivos: ids.flatMap((id) => { const nome = PRODUTOS.find((x) => x.id === id)?.nome || id; return /planilha|enxoval/.test(id) ? ['azul', 'rosa', 'roxa', 'verde'].map((cor) => ({ produto: nome, nome: `${id}-${cor}.xlsx`, path: `${id}/${id}-${cor}.xlsx`, tipo: 'planilha', cor })) : [{ produto: nome, nome: `${id}.pdf`, path: `${id}/${id}.pdf`, tipo: 'pdf' }] }), bonus: { liberado: libera.getTime() <= Date.now(), em: libera.toISOString() } }
  }
  try {
    return await invoke<Pedido>({ acao: 'ape-pedido', token })
  } catch {
    return null
  }
}
/** Link para baixar um arquivo (o PDF sai com a licença de quem comprou no rodapé). */
export async function baixarArquivo(token: string, path: string): Promise<string> {
  if (!CLOUD) throw new Error('Na prévia os arquivos não são baixados.')
  return (await invoke<{ url: string }>({ acao: 'ape-baixar', token, path })).url
}
/** Recupera as compras em outro aparelho, com o CPF e o e-mail usados na compra. */
export async function recuperarCompras(cpf: string, email: string): Promise<{ pedidos: { token: string; criado: string; total: number; status: StatusPedido; itens: string[] }[]; plataforma: { token: string; validade: string } | null }> {
  if (!CLOUD) {
    const l = readLocal()
    const ps = (l.pedidos || []).filter((p) => p.cpf === cpf && p.email.toLowerCase() === email.toLowerCase())
    return { pedidos: ps.map((p) => ({ token: p.token, criado: p.criado || '', total: p.total, status: p.status, itens: p.itens.map((i) => i.nome) })), plataforma: ps.find((p) => p.plataforma)?.plataforma || null }
  }
  const r = await invoke<Awaited<ReturnType<typeof recuperarCompras>>>({ acao: 'ape-recuperar', cpf, email })
  r.pedidos.forEach((p) => lembrar(p.token, Number(p.total)))
  return r
}

/* ===== plataforma do apê (área de quem comprou) ===== */
export interface PlatGasto { id: string; comodo: string; item: string; previsto: number | null; pago: number | null; status: 'planejado' | 'comprado' | 'pago'; data: string; obs: string }
export interface PlatParcela { id: string; descricao: string; valor: number | null; vezes: number | null; inicio: string; dia: number | null }
export interface PlatEtapa { id: string; nome: string; feita: boolean; data: string; quem: string; obs: string }
export interface PlatVistoria { id: string; comodo: string; item: string; status: 'ok' | 'problema' | 'pendente'; obs: string; foto?: string }
export interface PlatContato { id: string; nome: string; servico: string; tel: string; obs: string }
export interface PlatGarantia { id: string; item: string; onde: string; compra: string; meses: number | null; nota: boolean; obs: string }
export interface PlatManut { id: string; oque: string; cada: number | null; ultima: string }
export interface PlatDoc { id: string; nome: string; tenho: boolean; onde: string }
export interface PlatOrc { id: string; servico: string; fornecedor: string; valor: number | null; status: 'pedido' | 'recebido' | 'fechado' | 'descartado'; tel: string; obs: string }
export interface PlatConta { id: string; nome: string; valor: number | null; quando: 'mensal' | 'anual'; dia: number | null }
export interface PlatMedida { id: string; comodo: string; larg: number | null; comp: number | null; alt: number | null; obs: string }
export interface PlatCompra { id: string; comodo: string; item: string; prio: 'essencial' | 'logo' | 'pode esperar'; preco: number | null; comprado: boolean; onde: string }
export interface PlatTarefa { id: string; fase: string; item: string; feito: boolean }
/** Compra do imóvel (jornada "acabei de comprar"): entrada, financiamento, juros de obra, ITBI e o passo a passo. */
export interface PlatCompraImovel { valor: number | null; entrada: number | null; sinal: number | null; entradaVezes: number | null; financiado: number | null; banco: string; taxaAno: number | null; prazo: number | null; sistema: 'SAC' | 'Price'; inicio: string; obraPct: number | null; itbiPct: number | null; cartorio: number | null; passos: { id: string; item: string; feito: boolean }[] }
export interface PlatDados {
  compra?: PlatCompraImovel
  orcamentos?: PlatOrc[]
  contas?: PlatConta[]
  medidas?: PlatMedida[]
  compras?: PlatCompra[]
  mudanca?: PlatTarefa[]
  perfil?: { nome: string; foto: string }
  imovel?: { tipo: 'apê' | 'casa'; fase: 'comprando' | 'planta' | 'pronto' | 'obra' | 'morando'; m2: number | null; orcamento: number | null; entrega: string; nome: string; condominio?: string; torre?: string; ap?: string; moradores?: string; capa?: string; simbolo?: string; jornada?: 'compra' | 'chaves'; familia?: { id: string; nome: string; tipo: import('./Familia').TipoMembro; papel?: string }[] }
  garantias?: PlatGarantia[]
  manutencao?: PlatManut[]
  documentos?: PlatDoc[]
  gastos?: PlatGasto[]
  parcelas?: PlatParcela[]
  etapas?: PlatEtapa[]
  vistoria?: PlatVistoria[]
  contatos?: PlatContato[]
  notas?: string
}
export interface PlatAcesso { nome: string; validade: string; ativo: boolean; cortesia: boolean; dados: PlatDados; atualizado: string }
export async function platAbrir(token: string): Promise<PlatAcesso | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null
  if (!CLOUD) {
    const a = readLocal().plataforma?.[token]
    return a ? { ...a, ativo: a.validade >= new Date().toISOString().slice(0, 10) } : null
  }
  const { data, error } = await sb().rpc('ape_plat_abrir', { p_token: token })
  if (error || !data) return null
  return data as PlatAcesso
}
export async function platSalvar(token: string, dados: PlatDados): Promise<string> {
  if (!CLOUD) {
    const quando = new Date().toISOString()
    writeLocal((l) => {
      if (l.plataforma?.[token]) l.plataforma[token] = { ...l.plataforma[token], dados, atualizado: quando }
    })
    return quando
  }
  const { data, error } = await sb().rpc('ape_plat_salvar', { p_token: token, p_dados: dados })
  fail(error)
  return String(data)
}

/* ===== painel: pedidos, clientes, cortesias, plataforma e arquivos que a loja entrega ===== */
export interface PedidoAdmin {
  id: string
  token: string
  nome: string
  tel: string
  email: string
  cpf: string
  itens: { id: string; nome: string; preco: number }[]
  subtotal: number
  total: number
  desconto: number
  status: StatusPedido
  forma: string
  criado: string
  pago_em: string | null
  baixados: number
  cortesia: boolean
  aceite: { versao: string; em: string } | null
  obs: string
  cancelamento?: { status: 'pedido' | 'aprovado' | 'negado'; motivo?: string; resposta?: string; em?: string } | null
}
export interface PlatAdmin { id: string; token: string; nome: string; email: string; cpf: string; tel: string; validade: string; cortesia: boolean; criado: string; atualizado: string; pedido: string | null }
export const loja = {
  async pedidos(): Promise<PedidoAdmin[]> {
    if (!CLOUD) return (readLocal().pedidos || []).map((p) => ({ id: p.token, token: p.token, nome: p.nome || '', tel: p.tel, email: p.email, cpf: p.cpf, itens: p.itens, subtotal: p.subtotal || p.total, total: p.total, desconto: p.desconto || 0, status: p.status, forma: p.forma || '', criado: p.criado || '', pago_em: p.pago_em || null, baixados: 0, cortesia: !!p.cortesia, aceite: null, obs: '' }))
    const { data, error } = await sb().from('ape_pedidos').select('*').order('criado', { ascending: false }).limit(500)
    fail(error)
    return (data ?? []).map((r) => ({ ...(r as PedidoAdmin), cpf: String(r.cpf ?? ''), total: Number(r.total), subtotal: Number(r.subtotal), desconto: Number(r.desconto), cortesia: !!r.cortesia, obs: String(r.obs ?? '') }))
  },
  /** Pedido de cortesia (sem pagar): para a dona testar como cliente ou dar acesso a alguém. Já sai pago. */
  async cortesia(d: { nome: string; email: string; cpf: string; tel: string; itens: Produto[]; obs?: string; bonusJa?: boolean }): Promise<string> {
    const itens = d.itens.map((p) => ({ id: p.id, nome: p.nome, preco: 0, cat: p.cat }))
    if (!CLOUD) {
      const token = crypto.randomUUID()
      writeLocal((l) => {
        l.pedidos = [{ token, status: 'pendente', itens, total: 0, subtotal: 0, desconto: 0, forma: 'cortesia', nome: d.nome, criado: new Date().toISOString(), cpf: d.cpf, email: d.email, tel: d.tel, cortesia: true }, ...(l.pedidos || [])]
      })
      simularPagamento(token)
      lembrar(token, 0)
      return token
    }
    const { data, error } = await sb().from('ape_pedidos').insert({ nome: d.nome, email: d.email.toLowerCase(), cpf: d.cpf.replace(/\D/g, ''), tel: d.tel.replace(/\D/g, ''), itens, subtotal: 0, desconto: 0, total: 0, status: 'pago', forma: 'cortesia', cortesia: true, pago_em: new Date(Date.now() - (d.bonusJa ? 8 * 864e5 : 0)).toISOString(), obs: d.obs || 'cortesia' }).select('token').single()
    fail(error)
    lembrar(String(data!.token), 0)
    return String(data!.token)
  },
  async marcar(id: string, campos: Partial<Pick<PedidoAdmin, 'status' | 'obs'>>) {
    if (!CLOUD) return
    const { error } = await sb().from('ape_pedidos').update(campos).eq('id', id)
    fail(error)
  },
  /** Reembolso pelo Asaas (e fecha downloads e plataforma do pedido). */
  async reembolsar(id: string, manual = false) {
    if (!CLOUD) {
      writeLocal((l) => {
        const p = (l.pedidos || []).find((x) => x.token === id)
        if (p) p.status = p.status === 'pago' ? 'reembolsado' : 'cancelado'
      })
      return
    }
    await invoke({ acao: 'ape-reembolsar', id, manual })
  },
  async plataformas(): Promise<PlatAdmin[]> {
    if (!CLOUD) return Object.entries(readLocal().plataforma || {}).map(([token, a]) => ({ id: token, token, nome: a.nome, email: '', cpf: '', tel: '', validade: a.validade, cortesia: a.cortesia, criado: '', atualizado: a.atualizado, pedido: null }))
    const { data, error } = await sb().from('ape_plataforma').select('id, token, nome, email, cpf, tel, validade, cortesia, criado, atualizado, pedido').order('criado', { ascending: false })
    fail(error)
    return (data ?? []) as PlatAdmin[]
  },
  async novaPlataforma(d: { nome: string; email?: string; cpf?: string; tel?: string; dias: number; cortesia: boolean }): Promise<string> {
    const v = new Date()
    v.setDate(v.getDate() + d.dias)
    const validade = v.toISOString().slice(0, 10)
    if (!CLOUD) {
      const token = crypto.randomUUID()
      writeLocal((l) => {
        l.plataforma = { ...(l.plataforma || {}), [token]: { nome: d.nome, validade, cortesia: d.cortesia, dados: {}, atualizado: new Date().toISOString() } }
      })
      return token
    }
    const { data, error } = await sb().from('ape_plataforma').insert({ nome: d.nome, email: (d.email || '').toLowerCase(), cpf: (d.cpf || '').replace(/\D/g, ''), tel: (d.tel || '').replace(/\D/g, ''), validade, cortesia: d.cortesia }).select('token').single()
    fail(error)
    return String(data!.token)
  },
  /** Corrige nome, e-mail ou telefone de um cliente (em todas as compras dele). */
  async editarCliente(ids: string[], campos: { nome: string; email: string; tel: string }) {
    if (!CLOUD) return
    const { error } = await sb().from('ape_pedidos').update({ nome: campos.nome, email: campos.email.toLowerCase(), tel: campos.tel.replace(/\D/g, '') }).in('id', ids)
    fail(error)
  },
  /** Apaga compras (usado para testes e cortesias): tira também o acesso à plataforma ligado a elas. */
  async excluirPedidos(ids: string[]) {
    if (!CLOUD) {
      writeLocal((l) => { l.pedidos = (l.pedidos || []).filter((p) => !ids.includes(p.token)) })
      return
    }
    await sb().from('ape_plataforma').delete().in('pedido', ids)
    const { error } = await sb().from('ape_pedidos').delete().in('id', ids)
    fail(error)
  },
  async validade(id: string, validade: string) {
    if (!CLOUD) {
      writeLocal((l) => {
        if (l.plataforma?.[id]) l.plataforma[id].validade = validade
      })
      return
    }
    const { error } = await sb().from('ape_plataforma').update({ validade }).eq('id', id)
    fail(error)
  },
  /** A plataforma do apê da própria dona (o acesso de teste que não vence). */
  async minhaPlataforma(): Promise<string> {
    if (!CLOUD) return ''
    const q1 = await sb().from('ape_plataforma').select('token').eq('email', 'lala.av03@gmail.com').order('validade', { ascending: false }).limit(1)
    const t1 = (q1.data?.[0] as { token?: string } | undefined)?.token
    if (t1) return t1
    const q2 = await sb().from('ape_plataforma').select('token').gte('validade', '2099-01-01').limit(1)
    return String((q2.data?.[0] as { token?: string } | undefined)?.token || '')
  },
  async arquivos(produto: string): Promise<{ nome: string; tamanho: number; em?: string }[]> {
    if (!CLOUD) return []
    const { data, error } = await sb().storage.from('ape-arquivos').list(produto, { limit: 20 })
    fail(error)
    return (data ?? []).filter((f) => f.name && !f.name.startsWith('.') && f.id).map((f) => ({ nome: f.name, tamanho: Number(f.metadata?.size ?? 0), em: f.updated_at || f.created_at || '' }))
  },
  /** Link temporário (10 min) para a dona ver o arquivo como está guardado. */
  async urlArquivo(produto: string, nome: string): Promise<string> {
    if (!CLOUD) throw new Error('Na prévia os arquivos não ficam guardados.')
    const { data, error } = await sb().storage.from('ape-arquivos').createSignedUrl(`${produto}/${nome}`, 600)
    fail(error)
    return data!.signedUrl
  },
  async enviarArquivo(produto: string, f: File) {
    if (!CLOUD) throw new Error('Na prévia os arquivos não ficam guardados.')
    const nome = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.() -]+/g, '-')
    const { error } = await sb().storage.from('ape-arquivos').upload(`${produto}/${nome}`, f, { upsert: true, contentType: f.type || undefined })
    fail(error)
  },
  /** Foto pública da loja (ex.: projetos): sobe para a pasta pública e devolve o endereço. */
  async fotoPublica(nome: string, f: File): Promise<string> {
    if (!CLOUD) throw new Error('Na prévia a foto não fica guardada.')
    const ext = (f.name.match(/\.\w+$/) || ['.jpg'])[0].toLowerCase()
    const path = `${nome}-${Date.now()}${ext}`
    const { error } = await sb().storage.from('ape-publico').upload(path, f, { upsert: true, contentType: f.type || undefined })
    fail(error)
    return sb().storage.from('ape-publico').getPublicUrl(path).data.publicUrl
  },
  async apagarArquivo(produto: string, nome: string) {
    const { error } = await sb().storage.from('ape-arquivos').remove([`${produto}/${nome}`])
    fail(error)
  },
}

/* ===== conta do cliente (e-mail e senha), cancelamento e depoimentos ===== */
const SESSAO = 'ape-sessao'
export const sessaoLocal = () => {
  try {
    return localStorage.getItem(SESSAO) || ''
  } catch {
    return ''
  }
}
export const guardarSessao = (t: string) => {
  try {
    if (t) localStorage.setItem(SESSAO, t)
    else { localStorage.removeItem(SESSAO); localStorage.removeItem('ape-nome') }
  } catch {
    /* ok */
  }
}
/** Primeiro nome de quem está logado neste aparelho (para o "oie, Fulana"). */
export const nomeLocal = () => {
  try {
    return sessaoLocal() ? localStorage.getItem('ape-nome') || '' : ''
  } catch {
    return ''
  }
}
export const guardarNome = (n: string) => {
  try {
    localStorage.setItem('ape-nome', String(n || '').trim().split(' ')[0])
  } catch {
    /* ok */
  }
}
export interface MinhaConta {
  perfil: { nome: string; email: string; tel: string; foto: string; cpf: string }
  pedidos: { id: string; token: string; itens: { id: string; nome: string }[]; total: number; status: StatusPedido; forma: string; criado: string; pago_em: string | null; cortesia: boolean; cancelamento: { status: 'pedido' | 'aprovado' | 'negado'; motivo?: string; resposta?: string; em?: string } | null }[]
  plataformas: { token: string; validade: string; cortesia: boolean }[]
  feedback: { tipo: string; texto: string; nota: number | null; publicado: boolean; criado: string }[]
}
/** Chama a conta do cliente no servidor (entrar, criar, esqueci, redefinir, eu, perfil, senha, sair, cancelar, feedback). */
export async function contaApi<T = Record<string, unknown>>(op: string, dados: Record<string, unknown> = {}): Promise<T> {
  if (!CLOUD) throw new Error('Na prévia não há contas de verdade.')
  return invoke<T>({ acao: 'ape-conta', op, sessao: sessaoLocal(), ...dados })
}
export async function depoimentos(): Promise<{ texto: string; nota: number | null; nome: string; criado: string }[]> {
  if (!CLOUD) return []
  try {
    return (await invoke<{ depoimentos: { texto: string; nota: number | null; nome: string; criado: string }[] }>({ acao: 'ape-depoimentos' })).depoimentos
  } catch {
    return []
  }
}
export const painelConta = {
  async avisarReembolso(id: string) {
    if (!CLOUD) return
    await invoke({ acao: 'ape-avisar-reembolso', id })
  },
  async testarEmail(): Promise<{ ok: boolean; status?: number; para?: string; remetente?: string; detalhe?: string }> {
    if (!CLOUD) return { ok: false, detalhe: 'Na prévia não manda e-mail.' }
    return invoke({ acao: 'ape-testar-email' })
  },
  async decidir(id: string, decisao: 'aprovar' | 'negar', resposta: string, manual = false) {
    if (!CLOUD) return
    await invoke({ acao: 'ape-decidir', id, decisao, resposta, manual })
  },
  async feedback(): Promise<{ id: string; tipo: string; texto: string; nota: number | null; nome: string; publicado: boolean; criado: string }[]> {
    if (!CLOUD) return []
    const { data, error } = await sb().from('ape_feedback').select('id, tipo, texto, nota, nome, publicado, criado').order('criado', { ascending: false }).limit(200)
    if (error) return []
    return data as never
  },
  async publicar(id: string, publicado: boolean) {
    const { error } = await sb().from('ape_feedback').update({ publicado }).eq('id', id)
    fail(error)
  },
  /** A dona adiciona um depoimento que recebeu (WhatsApp, Instagram...). Entra já publicado na loja. */
  async addDepoimento(nome: string, texto: string, nota: number | null) {
    const { error } = await sb().from('ape_feedback').insert({ tipo: 'depoimento', nome: nome.trim().slice(0, 80), texto: texto.trim().slice(0, 1200), nota, publicado: true })
    fail(error)
  },
  async apagarFeedback(id: string) {
    const { error } = await sb().from('ape_feedback').delete().eq('id', id)
    fail(error)
  },
}

/** Morador cria a conta (e-mail e senha) ou entra; devolve o cadastro para guardar no aparelho. */
export async function moradorConta(op: 'morador' | 'entrar', dados: Record<string, unknown>): Promise<Morador | null> {
  const r = await contaApi<{ token: string; morador: Record<string, unknown> | null }>(op, dados)
  guardarSessao(r.token)
  return moradorOf(r.morador)
}
/** Arquivos originais de um orçamento (PDF, foto), como foram mandados. */
export async function verOriginal(moradorId: string | undefined, orcamento: string): Promise<{ nome: string; tipo: string; url: string }[]> {
  if (!CLOUD) return []
  const r = await invoke<{ arquivos: { nome: string; tipo: string; url: string }[] }>({ acao: 'ape-original', morador: moradorId || '', orcamento })
  return r.arquivos
}
