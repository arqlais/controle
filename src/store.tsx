import { ARTIFACT } from './env'
import { CLOUD, fetchRemote, pushRemote } from './cloud'
import { toast } from './components/dialog'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Data, MessageTemplate, Project, ProposalStyle, ServiceDef, Settings } from './types'
import { DEFAULT_TASKS, addDays, payWhen, splitPayments, titleCase, today, uid } from './utils'

const KEY = 'lais3d-controle-v1'

// Preços da tabela do site (render V-Ray e IA). Os por m² são ponto de partida — ajuste em Configurações.
export const DEFAULT_SERVICES: ServiceDef[] = [
  { id: 'render-vray', name: 'renderização V-Ray', unit: 'imagem', pricing: 'pacote', price: 80, min: 0, hours: 4, tiers: [ { qty: 5, price: 370 }, { qty: 10, price: 710 }, { qty: 15, price: 975 } ] },
  { id: 'render-ia', name: 'renderização por IA', unit: 'imagem', pricing: 'pacote', price: 50, min: 0, hours: 1.5, tiers: [ { qty: 5, price: 240 }, { qty: 10, price: 460 }, { qty: 15, price: 630 } ] },
  { id: 'modelagem', name: 'modelagem 3d', unit: 'm²', pricing: 'm2', price: 6, min: 350, hours: 0.08, tiers: [] },
  { id: 'detalhamento', name: 'detalhamento', unit: 'm²', pricing: 'm2', price: 12, min: 400, hours: 0.1, tiers: [] },
  { id: 'executivo', name: 'executivo', unit: 'm²', pricing: 'm2', price: 15, min: 600, hours: 0.12, tiers: [] },
  { id: 'pranchas', name: 'prancha', unit: 'prancha', pricing: 'unidade', price: 200, min: 0, hours: 3, tiers: [] },
  { id: 'mapas', name: 'mapa urbano', unit: 'mapa', pricing: 'unidade', price: 150, min: 0, hours: 2.5, tiers: [] },
  { id: 'diagramas', name: 'diagramas', unit: 'diagrama', pricing: 'unidade', price: 80, min: 0, hours: 1, tiers: [] },
  { id: 'diagramacao', name: 'diagramação', unit: 'prancha', pricing: 'unidade', price: 120, min: 0, hours: 2, tiers: [] },
  { id: 'planta-hum', name: 'planta humanizada', unit: 'planta', pricing: 'unidade', price: 300, min: 0, hours: 4, tiers: [] },
  { id: 'personalizado', name: 'serviço personalizado', unit: 'projeto', pricing: 'livre', price: 0, min: 0, hours: 0, tiers: [] },
]

/** Nomes antigos (com maiúscula / plural) → nomes atuais, sem perder os preços já ajustados. */
function migrateServices(list: ServiceDef[]): ServiceDef[] {
  const renamed: Record<string, string> = {
    'render-vray': 'renderização V-Ray', 'render-ia': 'renderização por IA', modelagem: 'modelagem 3d', detalhamento: 'detalhamento',
    executivo: 'executivo', pranchas: 'prancha', mapas: 'mapa urbano', 'planta-hum': 'planta humanizada', personalizado: 'serviço personalizado',
  }
  const old = new Set(['Renderização V-Ray', 'Renderização I.A', 'Modelagem 3D', 'Detalhamento', 'Projeto executivo', 'Mapas urbanos', 'Pranchas e monografia', 'Planta humanizada', 'Serviço personalizado'])
  const out = list.map((x) => (renamed[x.id] && old.has(x.name) ? { ...x, name: renamed[x.id] } : x))
  for (const d of DEFAULT_SERVICES) if (!out.some((x) => x.id === d.id) && ['diagramas', 'diagramacao', 'planta-hum'].includes(d.id)) out.splice(out.length - 1, 0, d)
  return out
}

/** Mensagens padrão — editáveis em Configurações. {variáveis} são preenchidas com os dados do caso. */
export const DEFAULT_MESSAGES: MessageTemplate[] = [
  { id: 'primeiro-contato', name: 'primeiro contato', text: 'Oi, {cliente}! Tudo bem? Aqui é a {meu_nome}. Obrigada pelo contato! Me conta um pouquinho do projeto: o que você precisa (renders, modelagem, detalhamento…), quantas imagens ou a metragem, e para quando você precisa? Assim já te passo um orçamento certinho.' },
  { id: 'envio-orcamento', name: 'envio do orçamento', text: 'Oi, {cliente}! Segue a proposta {proposta} do projeto {projeto}, no valor de {valor}. Qualquer dúvida ou ajuste é só me chamar!' },
  { id: 'retorno', name: 'cobrar resposta do orçamento', text: 'Oi, {cliente}! Tudo bem? Passando para saber se conseguiu ver a proposta {proposta} ({projeto}). Qualquer ajuste é só me falar. 😊' },
  { id: 'aprovado', name: 'orçamento aprovado · pedir sinal', text: 'Que ótimo, {cliente}! Fico muito feliz 🤍 Para darmos início, o sinal é de {valor_parcela} via pix (chave: {pix}). Assim que confirmar, me envia por favor os arquivos do projeto (DWG/SKP) e as referências.' },
  { id: 'sinal-recebido', name: 'sinal recebido · início', text: 'Oi, {cliente}! Sinal recebido, obrigada! Já comecei o projeto {projeto} e a previsão de entrega é {prazo}. Qualquer novidade te aviso por aqui.' },
  { id: 'previa', name: 'envio de prévia para aprovação', text: 'Oi, {cliente}! Segue a prévia do projeto {projeto}. Dá uma olhada com calma e me diz se está tudo de acordo ou se prefere algum ajuste. 😊' },
  { id: 'cobranca', name: 'lembrete de pagamento', text: 'Oi, {cliente}! Tudo bem? Passando para lembrar da parcela "{parcela}" do projeto {projeto}, de {valor_parcela}, com vencimento em {vencimento}. Chave pix: {pix}. Obrigada!' },
  { id: 'cobranca-atraso', name: 'pagamento em atraso', text: 'Oi, {cliente}! Tudo bem? A parcela "{parcela}" do projeto {projeto}, de {valor_parcela}, venceu em {vencimento}. Consegue verificar para mim? Chave pix: {pix}. Obrigada!' },
  { id: 'entrega', name: 'entrega final', text: 'Oi, {cliente}! Projeto {projeto} finalizado 🎉 Os arquivos finais estão aqui: {arquivos}. Foi um prazer trabalhar com você! Se puder, me conta o que achou do resultado.' },
  { id: 'depoimento', name: 'pedir depoimento / indicação', text: 'Oi, {cliente}! Espero que o projeto tenha ficado do jeitinho que você queria. Se puder deixar um depoimento rápido ou me indicar para alguém, me ajuda muito! 🤍' },
]

export const PAYMENT_TERMS = 'Pix — 50% de entrada + 50% na aprovação final | Crédito — 100%'

/** Sinal pago em demanda "aguardando sinal" → passa para "em execução". */
function autoStatus(raw: Project): Project {
  // parcelas "na conclusão" acompanham o prazo combinado da demanda (sem prazo = sem data)
  const p = { ...raw, payments: raw.payments.map((x) => (!x.paidDate && payWhen(x) === 'conclusao' ? { ...x, on: 'conclusao' as const, dueDate: raw.dueDate || '' } : x)) }
  if (p.status !== 'briefing' || !p.payments[0]?.paidDate) return p
  return { ...p, status: 'producao', tasks: p.tasks.map((t) => (/sinal/i.test(t.text) ? { ...t, done: true } : t)) }
}

// Modelo "Proposta #001" (Canva): faixa grafite, The Seasons no título, quadro de serviços e faixa rosé do total.
export const DEFAULT_PROPOSAL: ProposalStyle = {
  version: 2,
  eyebrow: 'proposta de',
  title: 'orçamento',
  serif: 'The Seasons',
  ink: '#2a4352',
  rose: '#af8c86',
  arch: '#e7d5cf',
  paper: '#f7f5f1',
  bar: '#4a5d6b',
  files: 'PDF e arquivo editável do layout.',
  schedule: 'serão definidos conforme a necessidade do cliente.',
  showArch: true,
}

export const DEFAULT_SETTINGS: Settings = {
  brandName: 'laís',
  tagline: 'renderização · modelagem · detalhamento',
  ownerName: 'Laís',
  email: 'arq.laisav@gmail.com',
  phone: '+55 11 96928-8192',
  instagram: '@lais_3d',
  website: 'lais3d.com.br',
  document: '',
  pixKey: '11951233515',
  calendarToken: '',
  city: '',
  logo: '',
  customFont: '',
  themeVersion: 2,
  accent: '#3e4b57',
  accentSoft: '#d6b3ab',
  accentInk: '#a88a80',
  background: '#f5f1ee',
  surface: '#ffffff',
  text: '#3e4b57',
  displayFont: 'The Seasons',
  bodyFont: 'Poppins',
  radius: 18,
  uppercaseLabels: false,
  dark: false,
  monthlyGoal: 6000,
  studentDiscount: 40,
  complexity: { simples: 1, media: 1.3, alta: 1.6 },
  legalName: 'Laís Amaral Vieira',
  proposal: DEFAULT_PROPOSAL,
  meiLimit: 0,
  hourlyTarget: 60,
  urgencyFee: 30,
  defaultRevisions: 2,
  defaultPaymentTerms: PAYMENT_TERMS,
  services: DEFAULT_SERVICES,
  customColumns: [],
  navOrder: [],
  messages: DEFAULT_MESSAGES,
}

export function emptyData(): Data {
  return { version: 1, clients: [], projects: [], expenses: [], events: [], quotes: [], settings: DEFAULT_SETTINGS }
}

const cacheKey = (userId?: string) => (userId ? `${KEY}:${userId}` : KEY)

function load(userId?: string): Data {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return ARTIFACT ? demoData(DEFAULT_SETTINGS) : emptyData()
    return normalize(JSON.parse(raw))
  } catch {
    return ARTIFACT ? demoData(DEFAULT_SETTINGS) : emptyData()
  }
}

/** Garante que dados antigos/importados tenham todos os campos. */
export function normalize(d: Partial<Data>): Data {
  const base = emptyData()
  return {
    version: 1,
    demo: d.demo,
    clients: (d.clients ?? []).map((c) => ({ ...c, name: titleCase(c.name), type: (c.type as string) === 'incorporadora' ? 'construtora' : c.type, history: c.history ?? [] })),
    projects: (d.projects ?? []).map((p) => ({
      ...p,
      timerStart: p.timerStart ?? null,
      payments: p.payments ?? [],
      extras: p.extras ?? [],
      tasks: p.tasks ?? [],
      timeLogs: p.timeLogs ?? [],
    })),
    expenses: d.expenses ?? [],
    events: d.events ?? [],
    quotes: (d.quotes ?? []).map((q) => ({
      ...q,
      sentAt: q.sentAt ?? (q.status === 'rascunho' ? '' : q.createdAt),
      mode: q.mode ?? 'escopo',
      pdf: q.pdf ?? true,
      area: q.area ?? 0,
      clientLabel: q.clientLabel ?? '',
      schedule: q.schedule ?? DEFAULT_PROPOSAL.schedule,
      paymentTerms: !q.paymentTerms || /^50% (no aceite|de entrada|de sinal)/.test(q.paymentTerms) ? PAYMENT_TERMS : q.paymentTerms,
      options: (q.options ?? []).map((o) =>
        o.items
          ? o
          : {
              ...o,
              // opção antiga (lista de textos + valor único) vira serviços
              items: (o.included ?? []).filter(Boolean).map((t, i) => ({
                id: uid(),
                service: '',
                title: t,
                detail: '',
                description: '',
                quantity: 1,
                complexity: 'media' as const,
                price: i === 0 ? o.price ?? 0 : 0,
                auto: false,
              })),
              note: o.summary ?? '',
              discount: 0,
              discountNote: '',
            },
      ),
      chosenOption: q.chosenOption ?? '',
      discountNote: q.discountNote ?? '',
      files: q.files ?? DEFAULT_PROPOSAL.files,
      items: q.items.map((i) => {
        const old = i as typeof i & { unitPrice?: number }
        return i.price !== undefined
          ? i
          : { ...i, title: '', detail: '', complexity: 'media' as const, price: (old.quantity ?? 1) * (old.unitPrice ?? 0), auto: false }
      }),
    })),
    settings: migrateSettings(
      {
        ...base.settings,
        ...(d.settings ?? {}),
        // modelo novo da proposta substitui o anterior (version < 2)
        proposal: (d.settings?.proposal?.version ?? 0) >= 2 ? { ...DEFAULT_PROPOSAL, ...d.settings!.proposal } : DEFAULT_PROPOSAL,
        email: d.settings?.email || 'arq.laisav@gmail.com',
        // antes desta versão o teto do MEI vinha ligado por padrão; ela trabalha como pessoa física
        meiLimit: d.settings?.proposal ? (d.settings.meiLimit ?? 0) : 0,
        // pagamento padrão do modelo (textos antigos são trocados)
        defaultPaymentTerms: !d.settings?.defaultPaymentTerms || /^50% (no aceite|de entrada|de sinal)/.test(d.settings.defaultPaymentTerms) ? PAYMENT_TERMS : d.settings.defaultPaymentTerms,
        phone: d.settings?.phone || DEFAULT_SETTINGS.phone,
        instagram: d.settings?.instagram || DEFAULT_SETTINGS.instagram,
        website: d.settings?.website || DEFAULT_SETTINGS.website,
        complexity: { ...base.settings.complexity, ...(d.settings?.complexity ?? {}) },
        services: !d.settings?.services || d.settings.services.some((x) => !x.pricing) ? DEFAULT_SERVICES : migrateServices(d.settings.services.map((x) => ({ ...x, tiers: x.tiers ?? [], min: x.min ?? 0 }))),
      },
      d.settings,
    ),
  }
}

/** Dados salvos com a identidade antiga recebem as cores e fontes do site. */
function migrateSettings(s: Settings, saved?: Partial<Settings>): Settings {
  if ((saved?.themeVersion ?? 0) >= 2) return s
  const v = DEFAULT_SETTINGS
  return {
    ...s,
    themeVersion: 2,
    brandName: !saved?.brandName || saved.brandName === 'Lais 3D' ? v.brandName : s.brandName,
    tagline: !saved?.tagline || saved.tagline === 'Visualização arquitetônica' ? v.tagline : s.tagline,
    ownerName: !saved?.ownerName || saved.ownerName === 'Lais' ? v.ownerName : s.ownerName,
    accent: v.accent,
    accentSoft: v.accentSoft,
    accentInk: v.accentInk,
    background: v.background,
    surface: v.surface,
    text: v.text,
    displayFont: v.displayFont,
    bodyFont: v.bodyFont,
    radius: v.radius,
    uppercaseLabels: v.uppercaseLabels,
  }
}

type Collection = 'clients' | 'projects' | 'expenses' | 'events' | 'quotes'
type Item<C extends Collection> = Data[C][number]

export type SyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'offline'

interface Store {
  data: Data
  upsert: <C extends Collection>(c: C, item: Item<C>) => void
  remove: (c: Collection, id: string) => void
  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (d: Data) => void
  lastSaved: Date | null
  sync: SyncStatus
  userEmail: string
  isSample: boolean // mostrando o exemplo (não salva)
  showSample: (on: boolean) => void
}

const Ctx = createContext<Store | null>(null)

const hasContent = (d: Data) => !d.demo && (d.clients.length > 0 || d.projects.length > 0 || d.quotes.length > 0 || d.expenses.length > 0)

/** Com `userId`, os dados vivem na nuvem; o navegador guarda só uma cópia de trabalho. */
export function StoreProvider({ children, userId, userEmail = '' }: { children: ReactNode; userId?: string; userEmail?: string }) {
  const cloud = CLOUD && !!userId
  const [data, setData] = useState<Data>(() => load(userId))
  // modo exemplo: dados fictícios só em memória — nada é salvo nem enviado para a nuvem
  const [sample, setSample] = useState<Data | null>(null)
  const sampleOn = useRef(false)
  sampleOn.current = !!sample
  const setActive = useCallback((fn: (d: Data) => Data) => (sampleOn.current ? setSample((d) => (d ? fn(d) : d)) : setData(fn)), [])
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [sync, setSync] = useState<SyncStatus>(cloud ? 'loading' : 'local')
  const first = useRef(true)
  const fromRemote = useRef(false) // mudança veio da nuvem: não reenviar
  const remoteAt = useRef<string>('') // updated_at da última versão conhecida da nuvem
  const pending = useRef(false)

  // 1) ao entrar: busca a versão da nuvem antes de qualquer envio
  useEffect(() => {
    if (!cloud) return
    let alive = true
    ;(async () => {
      try {
        const remote = await fetchRemote(userId!)
        if (!alive) return
        if (remote) {
          remoteAt.current = remote.updatedAt
          fromRemote.current = true
          setData(normalize(remote.data))
        } else {
          // primeira vez: sobe o que já existia neste navegador (se for real)
          const local = load(userId)
          const legacy = load()
          const start = hasContent(local) ? local : hasContent(legacy) ? legacy : { ...emptyData(), settings: local.settings }
          remoteAt.current = await pushRemote(userId!, start)
          fromRemote.current = true
          setData(start)
        }
        setSync('saved')
        setLastSaved(new Date())
      } catch {
        if (alive) setSync('offline')
      }
    })()
    return () => {
      alive = false
    }
  }, [cloud, userId])

  // 2) a cada mudança: cópia local na hora, nuvem logo em seguida
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(data))
    } catch {
      if (!cloud) toast('Não foi possível salvar neste navegador. Faça um backup em Configurações.')
    }
    if (!cloud) {
      setLastSaved(new Date())
      return
    }
    if (fromRemote.current) {
      fromRemote.current = false
      return
    }
    if (sync === 'loading') return
    pending.current = true
    setSync('saving')
    const t = setTimeout(async () => {
      try {
        remoteAt.current = await pushRemote(userId!, data)
        pending.current = false
        setSync('saved')
        setLastSaved(new Date())
      } catch {
        setSync('offline')
      }
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // 3) ao voltar para a aba / reconectar: pega alterações feitas em outro aparelho
  useEffect(() => {
    if (!cloud) return
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        if (pending.current) {
          // havia algo não enviado (ex.: sem internet): reenvia
          remoteAt.current = await pushRemote(userId!, dataRef.current)
          pending.current = false
          setSync('saved')
          setLastSaved(new Date())
          return
        }
        const remote = await fetchRemote(userId!)
        if (remote && remote.updatedAt > remoteAt.current) {
          remoteAt.current = remote.updatedAt
          fromRemote.current = true
          setData(normalize(remote.data))
        }
        setSync('saved')
      } catch {
        setSync('offline')
      }
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    const iv = setInterval(refresh, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      clearInterval(iv)
    }
  }, [cloud, userId])

  const dataRef = useRef(data)
  dataRef.current = data

  const upsert = useCallback(<C extends Collection>(c: C, raw: Item<C>) => {
    const item = (c === 'projects' ? autoStatus(raw as Project) : raw) as Item<C>
    setActive((d) => {
      const list = d[c] as Item<C>[]
      const exists = list.some((x) => x.id === item.id)
      const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
      return { ...d, [c]: next }
    })
  }, [])

  const remove = useCallback((c: Collection, id: string) => {
    setActive((d) => {
      const next: Data = { ...d, [c]: (d[c] as { id: string }[]).filter((x) => x.id !== id) }
      // limpeza em cascata
      if (c === 'clients') {
        const pids = new Set(d.projects.filter((p) => p.clientId === id).map((p) => p.id))
        next.projects = d.projects.filter((p) => p.clientId !== id)
        next.quotes = d.quotes.filter((q) => q.clientId !== id)
        next.events = d.events.map((e) => (pids.has(e.projectId) ? { ...e, projectId: '' } : e))
      }
      if (c === 'projects') {
        next.events = d.events.map((e) => (e.projectId === id ? { ...e, projectId: '' } : e))
        next.quotes = d.quotes.map((q) => (q.projectId === id ? { ...q, projectId: '' } : q))
      }
      return next
    })
  }, [])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setActive((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

  const replaceAll = useCallback((d: Data) => setActive(() => normalize(d)), [setActive])

  const view = sample ?? data
  const showSample = useCallback(
    (on: boolean) => setSample(on ? { ...demoData(data.settings), demo: false } : null),
    [data.settings],
  )
  const value = useMemo(
    () => ({ data: view, upsert, remove, setSettings, replaceAll, lastSaved, sync, userEmail, isSample: !!sample, showSample }),
    [view, upsert, remove, setSettings, replaceAll, lastSaved, sync, userEmail, sample, showSample],
  )
  if (sync === 'loading') return <div className="loading-screen"><span className="brand-name">{data.settings.brandName}<i>.</i></span><p className="muted small">carregando seus dados…</p></div>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider ausente')
  return s
}

/* ---------- dados de exemplo ---------- */

/** Os dados de exemplo ainda estão no sistema (mesmo com o aviso oculto)? */
export const hasDemoData = (d: Data) => d.clients.some((c) => c.name === 'Mariana Costa' && c.company === 'Costa Arquitetura')

export function demoData(settings: Settings): Data {
  const t = today()
  const c = (name: string, company: string, type: Data['clients'][number]['type'], city: string, origin: string) => ({
    id: uid(),
    name,
    company,
    type,
    email: `${name.split(' ')[0].toLowerCase()}@exemplo.com`,
    phone: '(31) 99999-0000',
    instagram: `@${name.split(' ')[0].toLowerCase()}.arq`,
    city,
    document: '',
    origin,
    notes: '',
    favorite: false,
    archived: false,
    history: [] as { id: string; date: string; text: string }[],
    createdAt: addDays(t, -120),
  })
  const clients = [
    c('Mariana Costa', 'Costa Arquitetura', 'escritorio', 'Belo Horizonte', 'Indicação'),
    c('Rafael Lima', 'Lima Interiores', 'designer', 'Nova Lima', 'Instagram'),
    c('Construtora Horizonte', 'Horizonte Engenharia', 'construtora', 'Contagem', 'Site'),
    c('Beatriz Souza', '', 'arquiteto', 'Belo Horizonte', 'Indicação'),
    c('Pedro Alves', 'UFMG', 'estudante', 'Belo Horizonte', 'Faculdade'),
  ]
  clients[0].favorite = true
  clients[0].history = [
    { id: uid(), date: addDays(t, -30), text: 'Prefere receber prévias em baixa resolução pelo WhatsApp antes do render final.' },
    { id: uid(), date: addDays(t, -6), text: 'Fechou o living e a cozinha do Savassi; pediu mais uma vista da bancada.' },
  ]
  const [mari, rafa, horiz, bia, pedro] = clients

  const mk = (
    client: string,
    title: string,
    service: string,
    quantity: number,
    value: number,
    status: Data['projects'][number]['status'],
    priority: Data['projects'][number]['priority'],
    startOffset: number,
    dueOffset: number,
    mode: Parameters<typeof splitPayments>[1],
    paidCount: number,
  ) => {
    const start = addDays(t, startOffset)
    const due = addDays(t, dueOffset)
    const payments = splitPayments(value, mode, start, due).map((p, i) => (i < paidCount ? { ...p, paidDate: p.dueDate } : p))
    return {
      id: uid(),
      clientId: client,
      title,
      service,
      quantity,
      description: '',
      status,
      priority,
      startDate: start,
      dueDate: due,
      deliveredDate: status === 'entregue' ? due : null,
      value,
      discount: 0,
      payments,
      revisionsIncluded: 2,
      revisionsUsed: status === 'revisao' ? 1 : 0,
      estimatedHours: quantity * 6,
      timeLogs: status === 'briefing' ? [] : [{ id: uid(), date: start, hours: quantity * 3, note: 'Modelagem e setup de luz' }],
      tasks: DEFAULT_TASKS.map((text, i) => ({
        id: uid(),
        text,
        // quantas etapas já foram feitas em cada status
        done: i < (({ briefing: 0, producao: 2, revisao: 4, aguardando: 4, entregue: 6, pausado: 1, cancelado: 0 } as Record<string, number>)[status] ?? 0),
      })),
      filesLink: '',
      timerStart: null,
      notes: '',
      createdAt: start,
    }
  }

  const projects = [
    mk(mari.id, 'Apartamento Savassi — living e cozinha', 'render-vray', 4, 1800, 'producao', 'alta', -6, 3, '50-50', 1),
    mk(rafa.id, 'Suíte master — Casa Vila da Serra', 'render-vray', 3, 1350, 'revisao', 'media', -12, 1, '50-50', 1),
    mk(horiz.id, 'Edifício Aurora — fachada e áreas comuns', 'render-vray', 6, 3300, 'briefing', 'media', 2, 20, '50-50', 0),
    mk(bia.id, 'Planta humanizada — Casa Pampulha', 'planta-hum', 2, 600, 'aguardando', 'baixa', -9, -1, 'avista', 1),
    mk(mari.id, 'Loja Lourdes — fachada', 'render-vray', 2, 1100, 'entregue', 'media', -40, -25, '50-50', 2),
    mk(horiz.id, 'Decorado — apartamento 2 quartos', 'render-vray', 5, 2250, 'entregue', 'alta', -70, -50, '50-50', 1),
    mk(pedro.id, 'Renders para TCC — biblioteca', 'render-ia', 2, 600, 'producao', 'baixa', -3, 9, '50-50', 1),
    mk(rafa.id, 'Home office — Buritis', 'render-vray', 2, 900, 'entregue', 'media', -100, -85, 'avista', 1),
  ]

  const expenses = [
    { id: uid(), description: 'D5 Render Pro', category: 'software' as const, amount: 190, date: addDays(t, -150), recurring: true, notes: '' },
    { id: uid(), description: 'SketchUp Pro', category: 'software' as const, amount: 170, date: addDays(t, -150), recurring: true, notes: '' },
    { id: uid(), description: 'Carnê-leão (IR)', category: 'impostos' as const, amount: 120, date: addDays(t, -150), recurring: true, notes: '' },
    { id: uid(), description: 'Biblioteca de modelos 3D', category: 'cursos' as const, amount: 120, date: addDays(t, -10), recurring: false, notes: '' },
    { id: uid(), description: 'Anúncio Instagram', category: 'marketing' as const, amount: 80, date: addDays(t, -4), recurring: false, notes: '' },
  ]

  const events = [
    { id: uid(), title: 'Call de briefing — Edifício Aurora', date: addDays(t, 1), time: '10:00', type: 'reuniao' as const, projectId: projects[2].id, notes: '', done: false },
    { id: uid(), title: 'Orientação TCC', date: addDays(t, 2), time: '14:00', type: 'faculdade' as const, projectId: '', notes: '', done: false },
    { id: uid(), title: 'Entrega prévia living', date: addDays(t, 1), time: '18:00', type: 'entrega' as const, projectId: projects[0].id, notes: '', done: false },
    { id: uid(), title: 'Prova — Urbanismo', date: addDays(t, 6), time: '19:00', type: 'faculdade' as const, projectId: '', notes: '', done: false },
  ]

  const quotes = [
    {
      id: uid(),
      number: 1,
      clientId: bia.id,
      title: 'Renders — Casa Pampulha',
      mode: 'escopo' as const,
      pdf: true,
      area: 0,
      clientLabel: '',
      options: [],
      chosenOption: '',
      discountNote: '',
      files: 'PDF e arquivo editável do layout.',
      schedule: DEFAULT_PROPOSAL.schedule,
      items: [
        { id: uid(), service: 'render-vray', title: 'renderização V-Ray', detail: '5 imagens', description: 'living, jantar, cozinha e 2 vistas da fachada', quantity: 5, complexity: 'media' as const, price: 370, auto: true },
        { id: uid(), service: 'modelagem', title: 'modelagem 3d', detail: '', description: 'modelagem completa a partir do DWG, com mobiliário', quantity: 140, complexity: 'media' as const, price: 1092, auto: true },
      ],
      discount: 62,
      urgency: false,
      deadlineDays: 10,
      validityDays: 15,
      revisions: 2,
      paymentTerms: settings.defaultPaymentTerms,
      notes: '',
      status: 'enviado' as const,
      sentAt: addDays(t, -5),
      createdAt: addDays(t, -5),
      projectId: '',
    },
  ]

  return { version: 1, demo: true, clients, projects, expenses, events, quotes, settings }
}
