import { ARTIFACT } from './env'
import { toast } from './components/dialog'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Data, Settings } from './types'
import { addDays, splitPayments, today, uid } from './utils'

const KEY = 'lais3d-controle-v1'

export const DEFAULT_SETTINGS: Settings = {
  brandName: 'Lais 3D',
  tagline: 'Visualização arquitetônica',
  ownerName: 'Lais',
  email: '',
  phone: '',
  instagram: '',
  website: 'www.lais3d.com.br',
  document: '',
  pixKey: '',
  city: '',
  logo: '',
  accent: '#1c1c1c',
  accentSoft: '#b89b7a',
  background: '#f4f1ec',
  surface: '#ffffff',
  text: '#1c1c1c',
  displayFont: 'Cormorant Garamond',
  bodyFont: 'Inter',
  radius: 10,
  uppercaseLabels: true,
  dark: false,
  monthlyGoal: 6000,
  hourlyTarget: 60,
  urgencyFee: 30,
  defaultRevisions: 2,
  defaultPaymentTerms: '50% de entrada para início + 50% na entrega das imagens finais, via Pix.',
  services: [
    { id: 'render-int', name: 'Render interno', unit: 'imagem', price: 450, studentPrice: 250, hours: 6 },
    { id: 'render-ext', name: 'Render externo / fachada', unit: 'imagem', price: 550, studentPrice: 300, hours: 7 },
    { id: 'planta-hum', name: 'Planta humanizada', unit: 'planta', price: 300, studentPrice: 160, hours: 4 },
    { id: 'modelagem', name: 'Modelagem 3D', unit: 'projeto', price: 800, studentPrice: 400, hours: 10 },
    { id: 'animacao', name: 'Animação / vídeo', unit: 'segundo', price: 60, studentPrice: 35, hours: 0.5 },
    { id: 'tour360', name: 'Tour 360°', unit: 'panorama', price: 500, studentPrice: 280, hours: 6 },
    { id: 'pos', name: 'Pós-produção', unit: 'imagem', price: 150, studentPrice: 80, hours: 2 },
    { id: 'prancha', name: 'Prancha / diagramação', unit: 'prancha', price: 200, studentPrice: 120, hours: 3 },
  ],
}

export function emptyData(): Data {
  return { version: 1, clients: [], projects: [], expenses: [], events: [], quotes: [], settings: DEFAULT_SETTINGS }
}

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY)
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
    clients: d.clients ?? [],
    projects: (d.projects ?? []).map((p) => ({
      ...p,
      payments: p.payments ?? [],
      tasks: p.tasks ?? [],
      timeLogs: p.timeLogs ?? [],
    })),
    expenses: d.expenses ?? [],
    events: d.events ?? [],
    quotes: d.quotes ?? [],
    settings: { ...base.settings, ...(d.settings ?? {}), services: d.settings?.services ?? base.settings.services },
  }
}

type Collection = 'clients' | 'projects' | 'expenses' | 'events' | 'quotes'
type Item<C extends Collection> = Data[C][number]

interface Store {
  data: Data
  upsert: <C extends Collection>(c: C, item: Item<C>) => void
  remove: (c: Collection, id: string) => void
  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (d: Data) => void
  lastSaved: Date | null
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(load)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data))
        setLastSaved(new Date())
      } catch (e) {
        toast('Não foi possível salvar neste navegador. Faça um backup em Configurações.')
      }
    }, 250)
    return () => clearTimeout(t)
  }, [data])

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

  const value = useMemo(() => ({ data, upsert, remove, setSettings, replaceAll, lastSaved }), [data, upsert, remove, setSettings, replaceAll, lastSaved])
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
      tasks: [
        { id: uid(), text: 'Receber arquivos (DWG / SKP)', done: status !== 'briefing' },
        { id: uid(), text: 'Modelagem', done: ['revisao', 'aguardando', 'entregue'].includes(status) },
        { id: uid(), text: 'Materiais e iluminação', done: ['revisao', 'aguardando', 'entregue'].includes(status) },
        { id: uid(), text: 'Render + pós-produção', done: ['aguardando', 'entregue'].includes(status) },
        { id: uid(), text: 'Enviar prévia para aprovação', done: ['aguardando', 'entregue'].includes(status) },
      ],
      filesLink: '',
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
      createdAt: addDays(t, -2),
      projectId: '',
    },
  ]

  return { version: 1, demo: true, clients, projects, expenses, events, quotes, settings }
}
