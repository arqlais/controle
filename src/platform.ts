import { ARTIFACT } from './env'
import { CLOUD, supabase } from './cloud'
import { TRIAL_DAYS, type PlanId, type SubStatus } from './plans'

/* ============================================================
   Plataforma: assinaturas, chat com a dona e horários online.
   Na nuvem, tudo passa pelo Supabase (tabelas de supabase/plataforma.sql,
   protegidas por RLS). Na prévia (Artifact), os mesmos dados são simulados
   neste aparelho, com assinantes e conversas fictícios.
   ============================================================ */

export interface Subscription {
  userId: string
  email: string
  name: string
  studio: string
  plan: PlanId
  status: SubStatus
  trialEnds: string // ISO
  blocked: boolean
  testMode: boolean // assinatura em modo teste (sem cobrança real)
  createdAt: string
  lastSeen: string
  canceledAt?: string | null
  requestedPlan?: PlanId | null // pediu para assinar (a dona libera)
  requestedAt?: string | null
}

export interface ChatMessage {
  id: string
  clientId: string
  fromOwner: boolean
  body: string
  createdAt: string
  readAt?: string | null
}

export interface OnlineHours {
  days: { on: boolean; from: string; to: string }[] // 0 = domingo … 6 = sábado
  away: string // mensagem fora do horário
}

export const DEFAULT_HOURS: OnlineHours = {
  days: [
    { on: false, from: '09:00', to: '18:00' },
    { on: true, from: '09:00', to: '18:00' },
    { on: true, from: '09:00', to: '18:00' },
    { on: true, from: '09:00', to: '18:00' },
    { on: true, from: '09:00', to: '18:00' },
    { on: true, from: '09:00', to: '17:00' },
    { on: false, from: '09:00', to: '13:00' },
  ],
  away: 'agora estamos fora do horário, mas respondemos assim que possível ☺️',
}

/** Quem está usando o sistema e o que o plano libera. */
export interface AccessInfo {
  role: 'dona' | 'cliente'
  sub: Subscription | null
  legacy: boolean // plataforma ainda não instalada no Supabase: sistema igual ao de hoje
}

/* ---------------- horários (sempre no horário de Brasília) ---------------- */

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const DAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const hLabel = (hm: string) => {
  const [h, m] = hm.split(':')
  return `${Number(h)}h${m && m !== '00' ? m : ''}`
}

function brasilia(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { day: Math.max(0, WD.indexOf(get('weekday'))), min: (Number(get('hour')) % 24) * 60 + Number(get('minute')) }
}

export function isOnline(h: OnlineHours, d = new Date()) {
  const { day, min } = brasilia(d)
  const x = h.days[day]
  return !!x?.on && min >= toMin(x.from) && min < toMin(x.to)
}

/** "hoje às 14h", "amanhã às 9h", "segunda às 9h" (ou '' se nenhum dia estiver marcado). */
export function nextOnline(h: OnlineHours, d = new Date()) {
  const { day, min } = brasilia(d)
  for (let i = 0; i < 8; i++) {
    const wd = (day + i) % 7
    const x = h.days[wd]
    if (!x?.on) continue
    if (i === 0 && min >= toMin(x.from)) continue
    return `${i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DAY_NAMES[wd]} às ${hLabel(x.from)}`
  }
  return ''
}

/** Resumo: "seg a sex, 9h–18h · sáb, 9h–13h". */
export function hoursSummary(h: OnlineHours) {
  const groups: { a: number; b: number; from: string; to: string }[] = []
  // começa na segunda para "seg a sex" sair natural
  for (const wd of [1, 2, 3, 4, 5, 6, 0]) {
    const x = h.days[wd]
    if (!x?.on) continue
    const last = groups[groups.length - 1]
    if (last && last.from === x.from && last.to === x.to && (last.b + 1) % 7 === wd) last.b = wd
    else groups.push({ a: wd, b: wd, from: x.from, to: x.to })
  }
  if (!groups.length) return 'sem horário fixo'
  return groups.map((g) => `${DAY_SHORT[g.a]}${g.a !== g.b ? ` a ${DAY_SHORT[g.b]}` : ''}, ${hLabel(g.from)}–${hLabel(g.to)}`).join(' · ')
}

/* ---------------- utilidades ---------------- */

export const trialDaysLeft = (s: Subscription | null) => (s ? Math.ceil((new Date(s.trialEnds).getTime() - Date.now()) / 86_400_000) : 0)
export const trialOver = (s: Subscription | null) => !!s && s.status === 'trial' && trialDaysLeft(s) <= 0
const addDaysISO = (days: number, from = new Date()) => new Date(from.getTime() + days * 86_400_000).toISOString()

/* ============================================================
   Nuvem (Supabase)
   ============================================================ */

// erro de "tabela/função não existe": o SQL da plataforma ainda não foi rodado
const notInstalled = (e: { code?: string; message?: string } | null) => !!e && (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(e.code ?? '') || /does not exist|could not find/i.test(e.message ?? ''))

type Row = Record<string, unknown>
const subFromRow = (r: Row): Subscription => ({
  userId: String(r.user_id),
  email: String(r.email ?? ''),
  name: String(r.name ?? ''),
  studio: String(r.studio ?? ''),
  plan: (r.plan as PlanId) ?? 'essencial',
  status: (r.status as SubStatus) ?? 'trial',
  trialEnds: String(r.trial_ends ?? addDaysISO(TRIAL_DAYS)),
  blocked: !!r.blocked,
  testMode: r.test_mode !== false,
  createdAt: String(r.created_at ?? ''),
  lastSeen: String(r.last_seen ?? r.created_at ?? ''),
  canceledAt: (r.canceled_at as string | null) ?? null,
  requestedPlan: (r.requested_plan as PlanId | null) ?? null,
  requestedAt: (r.requested_at as string | null) ?? null,
})
const msgFromRow = (r: Row): ChatMessage => ({
  id: String(r.id),
  clientId: String(r.client_id),
  fromOwner: !!r.from_owner,
  body: String(r.body ?? ''),
  createdAt: String(r.created_at),
  readAt: (r.read_at as string | null) ?? null,
})

const cloud = {
  async access(plan?: string): Promise<AccessInfo> {
    const sb = supabase!
    const admin = await sb.rpc('sou_dona')
    if (admin.error) {
      if (notInstalled(admin.error)) return { role: 'dona', sub: null, legacy: true }
      throw admin.error
    }
    if (admin.data === true) return { role: 'dona', sub: null, legacy: false }
    // cria a assinatura em teste grátis na primeira entrada (o plano vem do cadastro)
    const { data, error } = await sb.rpc('garantir_assinatura', { plano: plan === 'completo' ? 'completo' : 'essencial' })
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as Row | null
    return { role: 'cliente', sub: row ? subFromRow(row) : null, legacy: false }
  },
  async touch() {
    await supabase!.rpc('marcar_acesso')
  },
  // durante o teste: troca o plano testado (não ativa nada)
  async choosePlan(plan: PlanId) {
    const { error } = await supabase!.rpc('escolher_plano', { plano: plan })
    if (error) throw error
  },
  // pedir para assinar: quem ativa é a dona (na fase 2, o pagamento)
  async requestPlan(plan: PlanId) {
    const { error } = await supabase!.rpc('pedir_assinatura', { plano: plan })
    if (error) throw error
  },
  async messages(clientId: string) {
    const { data, error } = await supabase!.from('support_messages').select('*').eq('client_id', clientId).order('created_at').limit(500)
    if (error) throw error
    return (data ?? []).map(msgFromRow)
  },
  async allMessages() {
    const { data, error } = await supabase!.from('support_messages').select('*').order('created_at').limit(3000)
    if (error) throw error
    return (data ?? []).map(msgFromRow)
  },
  async send(clientId: string, body: string, fromOwner: boolean) {
    const { error } = await supabase!.from('support_messages').insert({ client_id: clientId, body, from_owner: fromOwner })
    if (error) throw error
  },
  async markRead(clientId: string) {
    await supabase!.rpc('marcar_lidas', { cliente: clientId })
  },
  subscribe(onChange: () => void) {
    const ch = supabase!
      .channel(`suporte-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => onChange())
      .subscribe()
    return () => void supabase!.removeChannel(ch)
  },
  async subscribers() {
    const { data, error } = await supabase!.from('subscriptions').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(subFromRow)
  },
  async updateSubscriber(userId: string, patch: Partial<Subscription>) {
    const row: Row = {}
    if (patch.plan) row.plan = patch.plan
    if (patch.status) row.status = patch.status
    if (patch.blocked !== undefined) row.blocked = patch.blocked
    if (patch.trialEnds) row.trial_ends = patch.trialEnds
    if (patch.canceledAt !== undefined) row.canceled_at = patch.canceledAt
    if (patch.requestedPlan !== undefined) row.requested_plan = patch.requestedPlan
    if (patch.requestedAt !== undefined) row.requested_at = patch.requestedAt
    const { error } = await supabase!.from('subscriptions').update(row).eq('user_id', userId)
    if (error) throw error
  },
  async hours(): Promise<OnlineHours> {
    const { data } = await supabase!.from('platform_settings').select('data').eq('id', 1).maybeSingle()
    const h = (data?.data as { hours?: OnlineHours } | undefined)?.hours
    return h?.days?.length === 7 ? h : DEFAULT_HOURS
  },
  async saveHours(h: OnlineHours) {
    const { error } = await supabase!.from('platform_settings').upsert({ id: 1, data: { hours: h } })
    if (error) throw error
  },
}

/* ============================================================
   Prévia (Artifact): mesmos dados, simulados neste aparelho
   ============================================================ */

export const PREVIEW_CLIENT = 'previa-cliente'
const LKEY = 'previa-plataforma-v1'
interface LocalDB {
  subs: Subscription[]
  messages: ChatMessage[]
  hours: OnlineHours
}
const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString()

// assinantes fictícios (só na prévia; nenhum dado real)
function seed(): LocalDB {
  const s = (userId: string, name: string, studio: string, plan: PlanId, status: SubStatus, since: number, seen: number, extra: Partial<Subscription> = {}): Subscription => ({
    userId,
    email: `${name.split(' ')[0].toLowerCase()}@exemplo.com`,
    name,
    studio,
    plan,
    status,
    trialEnds: status === 'trial' ? addDaysISO(TRIAL_DAYS - since) : addDaysISO(TRIAL_DAYS, new Date(ago(since))),
    blocked: false,
    testMode: true,
    createdAt: ago(since),
    lastSeen: ago(seen, 3),
    ...extra,
  })
  const subs = [
    s('ex-1', 'Beatriz Nogueira', 'Nogueira Interiores', 'completo', 'ativa', 58, 0),
    s('ex-2', 'Rafael Menezes', 'RM Visualização 3D', 'essencial', 'ativa', 44, 1),
    s('ex-3', 'Camila Duarte', 'Studio Duarte', 'completo', 'trial', 5, 0),
    s('ex-4', 'Júlia Prado', 'Prado Arquitetura', 'essencial', 'trial', 6, 2, { requestedPlan: 'completo', requestedAt: ago(0, 5) }),
    s('ex-5', 'Thiago Lemos', 'Lemos Arq', 'essencial', 'atrasada', 71, 9),
    s('ex-6', 'Marina Faria', 'Faria & Co.', 'completo', 'cancelada', 90, 20, { canceledAt: ago(6) }),
  ]
  const m = (clientId: string, fromOwner: boolean, body: string, daysAgo: number, hoursAgo: number, read = true): ChatMessage => ({
    id: Math.random().toString(36).slice(2),
    clientId,
    fromOwner,
    body,
    createdAt: ago(daysAgo, hoursAgo),
    readAt: read ? ago(daysAgo, hoursAgo - 1) : null,
  })
  const messages = [
    m('ex-1', false, 'oi! consigo colocar meu logo na proposta?', 3, 5),
    m('ex-1', true, 'oii, Beatriz! consegue sim: perfil do estúdio → foto/logo. ele aparece no topo do sistema e nos documentos ☺️', 3, 4),
    m('ex-1', false, 'deu certo, obrigada!!', 3, 3),
    m('ex-3', false, 'como faço para o orçamento virar demanda depois que a cliente aprova?', 0, 2, false),
    m('ex-4', false, 'o teste grátis tem todas as funções?', 1, 6),
    m('ex-4', true, 'tem sim! durante o teste você usa tudo do plano que escolheu. dá para trocar de plano quando quiser em “minha assinatura”.', 1, 5),
  ]
  return { subs, messages, hours: DEFAULT_HOURS }
}

const listeners = new Set<() => void>()
let memDB: LocalDB | null = null
function readDB(): LocalDB {
  if (memDB) return memDB
  try {
    const raw = localStorage.getItem(LKEY)
    memDB = raw ? (JSON.parse(raw) as LocalDB) : seed()
  } catch {
    memDB = seed()
  }
  return memDB
}
function writeDB(db: LocalDB) {
  memDB = db
  try {
    localStorage.setItem(LKEY, JSON.stringify(db))
  } catch {
    /* sem armazenamento: vale só enquanto a página estiver aberta */
  }
  listeners.forEach((l) => l())
}
export function resetPreviewData() {
  writeDB(seed())
}

// cliente da prévia: criado no "cadastro" (ou ao escolher ver como cliente)
export function previewSignup(name: string, studio: string, email: string, plan: PlanId) {
  const db = readDB()
  const sub: Subscription = {
    userId: PREVIEW_CLIENT,
    email: email || 'voce@exemplo.com',
    name: name || 'Você (prévia)',
    studio: studio || 'seu estúdio',
    plan,
    status: 'trial',
    trialEnds: addDaysISO(TRIAL_DAYS),
    blocked: false,
    testMode: true,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  }
  writeDB({ ...db, subs: [sub, ...db.subs.filter((x) => x.userId !== PREVIEW_CLIENT)] })
}

const local = {
  async access(plan?: string): Promise<AccessInfo> {
    const role = getPreviewRole()
    if (role !== 'cliente') return { role: 'dona', sub: null, legacy: false }
    let sub = readDB().subs.find((x) => x.userId === PREVIEW_CLIENT)
    if (!sub) {
      previewSignup('', '', '', plan === 'completo' ? 'completo' : 'essencial')
      sub = readDB().subs.find((x) => x.userId === PREVIEW_CLIENT)!
    }
    return { role: 'cliente', sub, legacy: false }
  },
  async touch() {
    const db = readDB()
    writeDB({ ...db, subs: db.subs.map((x) => (x.userId === PREVIEW_CLIENT ? { ...x, lastSeen: new Date().toISOString() } : x)) })
  },
  async choosePlan(plan: PlanId) {
    const db = readDB()
    writeDB({ ...db, subs: db.subs.map((x) => (x.userId === PREVIEW_CLIENT && x.status === 'trial' ? { ...x, plan } : x)) })
  },
  async requestPlan(plan: PlanId) {
    const db = readDB()
    const now = new Date().toISOString()
    writeDB({
      ...db,
      subs: db.subs.map((x) => (x.userId === PREVIEW_CLIENT ? { ...x, requestedPlan: plan, requestedAt: now } : x)),
      messages: [...db.messages, { id: Math.random().toString(36).slice(2), clientId: PREVIEW_CLIENT, fromOwner: false, body: `quero assinar o plano ${plan === 'completo' ? 'Completo' : 'Essencial'} ✨`, createdAt: now, readAt: null }],
    })
  },
  async messages(clientId: string) {
    return readDB().messages.filter((x) => x.clientId === clientId)
  },
  async allMessages() {
    return readDB().messages
  },
  async send(clientId: string, body: string, fromOwner: boolean) {
    const db = readDB()
    writeDB({ ...db, messages: [...db.messages, { id: Math.random().toString(36).slice(2), clientId, fromOwner, body, createdAt: new Date().toISOString(), readAt: null }] })
  },
  async markRead(clientId: string) {
    const db = readDB()
    const ownerSide = getPreviewRole() === 'dona'
    writeDB({ ...db, messages: db.messages.map((x) => (x.clientId === clientId && x.fromOwner !== ownerSide && !x.readAt ? { ...x, readAt: new Date().toISOString() } : x)) })
  },
  subscribe(onChange: () => void) {
    listeners.add(onChange)
    return () => void listeners.delete(onChange)
  },
  async subscribers() {
    return readDB().subs
  },
  async updateSubscriber(userId: string, patch: Partial<Subscription>) {
    const db = readDB()
    writeDB({ ...db, subs: db.subs.map((x) => (x.userId === userId ? { ...x, ...patch } : x)) })
  },
  async hours() {
    return readDB().hours ?? DEFAULT_HOURS
  },
  async saveHours(h: OnlineHours) {
    writeDB({ ...readDB(), hours: h })
  },
}

/** Backend em uso: nuvem de verdade ou simulação da prévia. */
export const platform = CLOUD ? cloud : local

/* ---------------- perfil da prévia ("ver como") ---------------- */

export type PreviewRole = 'visitante' | 'cliente' | 'dona'
const RKEY = 'previa-perfil'
const roleListeners = new Set<(r: PreviewRole) => void>()
let previewRole: PreviewRole = (() => {
  if (!ARTIFACT) return 'dona'
  // sem endereço de tela: a prévia abre na página de vendas
  let hash = ''
  try {
    hash = window.location.hash
  } catch {
    /* ok */
  }
  if (!hash || hash === '#/' || hash === '#/vendas') return 'visitante'
  try {
    const saved = localStorage.getItem(RKEY) as PreviewRole | null
    return saved === 'cliente' || saved === 'dona' ? saved : 'dona'
  } catch {
    return 'dona'
  }
})()
export const getPreviewRole = () => previewRole
export function setPreviewRole(r: PreviewRole) {
  previewRole = r
  try {
    if (r !== 'visitante') localStorage.setItem(RKEY, r)
  } catch {
    /* ok */
  }
  roleListeners.forEach((l) => l(r))
}
export const onPreviewRole = (l: (r: PreviewRole) => void) => {
  roleListeners.add(l)
  return () => void roleListeners.delete(l)
}

/* ---------------- cadastro ---------------- */

export async function signUp(input: { email: string; password: string; name: string; studio: string; plan: PlanId }) {
  if (!CLOUD) {
    previewSignup(input.name, input.studio, input.email, input.plan)
    return { needsConfirm: false }
  }
  const { data, error } = await supabase!.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name, studio: input.studio, plan: input.plan }, emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw error
  return { needsConfirm: !data.session }
}
