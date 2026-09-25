import { ARTIFACT } from './env'
import { CLOUD, fetchRemote, pushRemote } from './cloud'
import { toast } from './components/dialog'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Data, Settings } from './types'
import { DEFAULT_TASKS, addDays, splitPayments, today, uid } from './utils'

const KEY = 'lais3d-controle-v1'

export const DEFAULT_SETTINGS: Settings = {
  brandName: 'laís',
  tagline: 'renderização · modelagem · detalhamento',
  ownerName: 'Laís',
  email: '',
  phone: '',
  instagram: '',
  website: 'www.lais3d.com.br',
  document: '',
  pixKey: '',
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
  meiLimit: 81000,
  hourlyTarget: 60,
  urgencyFee: 30,
  defaultRevisions: 2,
  defaultPaymentTerms: '50% de entrada para início + 50% na entrega das imagens finais, via Pix.',
  services: [
    { id: 'render-int', name: 'Renderização interna (V-Ray)', unit: 'imagem', price: 450, studentPrice: 250, hours: 6 },
    { id: 'render-ext', name: 'Renderização externa / fachada', unit: 'imagem', price: 550, studentPrice: 300, hours: 7 },
    { id: 'render-ia', name: 'Renderização com IA', unit: 'imagem', price: 180, studentPrice: 100, hours: 1.5 },
    { id: 'modelagem', name: 'Modelagem 3D', unit: 'projeto', price: 800, studentPrice: 400, hours: 10 },
    { id: 'detalhamento', name: 'Detalhamento', unit: 'prancha', price: 250, studentPrice: 140, hours: 4 },
    { id: 'executivo', name: 'Projeto executivo', unit: 'prancha', price: 300, studentPrice: 170, hours: 5 },
    { id: 'mapas', name: 'Mapas urbanos', unit: 'mapa', price: 150, studentPrice: 90, hours: 2.5 },
    { id: 'prancha', name: 'Pranchas e monografia', unit: 'prancha', price: 200, studentPrice: 120, hours: 3 },
    { id: 'planta-hum', name: 'Planta humanizada', unit: 'planta', price: 300, studentPrice: 160, hours: 4 },
  ],
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
    clients: (d.clients ?? []).map((c) => ({ ...c, history: c.history ?? [] })),
    projects: (d.projects ?? []).map((p) => ({
      ...p,
      timerStart: p.timerStart ?? null,
      payments: p.payments ?? [],
      tasks: p.tasks ?? [],
      timeLogs: p.timeLogs ?? [],
    })),
    expenses: d.expenses ?? [],
    events: d.events ?? [],
    quotes: (d.quotes ?? []).map((q) => ({ ...q, sentAt: q.sentAt ?? (q.status === 'rascunho' ? '' : q.createdAt) })),
    settings: migrateSettings({ ...base.settings, ...(d.settings ?? {}), services: d.settings?.services ?? base.settings.services }, d.settings),
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
}

const Ctx = createContext<Store | null>(null)

const hasContent = (d: Data) => !d.demo && (d.clients.length > 0 || d.projects.length > 0 || d.quotes.length > 0 || d.expenses.length > 0)

/** Com `userId`, os dados vivem na nuvem; o navegador guarda só uma cópia de trabalho. */
export function StoreProvider({ children, userId, userEmail = '' }: { children: ReactNode; userId?: string; userEmail?: string }) {
  const cloud = CLOUD && !!userId
  const [data, setData] = useState<Data>(() => load(userId))
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

  const upsert = useCallback(<C extends Collection>(c: C, item: Item<C>) => {
    setData((d) => {
      const list = d[c] as Item<C>[]
      const exists = list.some((x) => x.id === item.id)
      const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
      return { ...d, [c]: next }
    })
  }, [])

  const remove = useCallback((c: Collection, id: string) => {
    setData((d) => {
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
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

  const replaceAll = useCallback((d: Data) => setData(normalize(d)), [])

  const value = useMemo(
    () => ({ data, upsert, remove, setSettings, replaceAll, lastSaved, sync, userEmail }),
    [data, upsert, remove, setSettings, replaceAll, lastSaved, sync, userEmail],
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
        done: i < ({ briefing: 0, producao: 2, revisao: 4, aguardando: 4, entregue: 6, pausado: 1, cancelado: 0 } as const)[status],
      })),
      filesLink: '',
      timerStart: null,
      notes: '',
      createdAt: start,
    }
  }

  const projects = [
    mk(mari.id, 'Apartamento Savassi — living e cozinha', 'render-int', 4, 1800, 'producao', 'alta', -6, 3, '50-50', 1),
    mk(rafa.id, 'Suíte master — Casa Vila da Serra', 'render-int', 3, 1350, 'revisao', 'media', -12, 1, '50-50', 1),
    mk(horiz.id, 'Edifício Aurora — fachada e áreas comuns', 'render-ext', 6, 3300, 'briefing', 'media', 2, 20, '3x', 0),
    mk(bia.id, 'Planta humanizada — Casa Pampulha', 'planta-hum', 2, 600, 'aguardando', 'baixa', -9, -1, 'avista', 1),
    mk(mari.id, 'Loja Lourdes — fachada', 'render-ext', 2, 1100, 'entregue', 'media', -40, -25, '50-50', 2),
    mk(horiz.id, 'Decorado — apartamento 2 quartos', 'render-int', 5, 2250, 'entregue', 'alta', -70, -50, '50-50', 1),
    mk(pedro.id, 'Renders para TCC — biblioteca', 'render-ext', 2, 600, 'producao', 'baixa', -3, 9, '50-50', 1),
    mk(rafa.id, 'Home office — Buritis', 'render-int', 2, 900, 'entregue', 'media', -100, -85, 'avista', 1),
  ]

  const expenses = [
    { id: uid(), description: 'D5 Render Pro', category: 'software' as const, amount: 190, date: addDays(t, -150), recurring: true, notes: '' },
    { id: uid(), description: 'SketchUp Pro', category: 'software' as const, amount: 170, date: addDays(t, -150), recurring: true, notes: '' },
    { id: uid(), description: 'DAS MEI', category: 'impostos' as const, amount: 76, date: addDays(t, -150), recurring: true, notes: '' },
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
      items: [
        { id: uid(), service: 'render-int', description: 'Sala de estar e jantar', quantity: 2, unitPrice: 450 },
        { id: uid(), service: 'render-ext', description: 'Fachada principal', quantity: 1, unitPrice: 550 },
      ],
      discount: 50,
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
