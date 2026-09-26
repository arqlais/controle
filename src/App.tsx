import { useEffect, useMemo, useRef, useState } from 'react'
import { emptyData, useStore } from './store'
import { ask } from './components/dialog'
import { signOut } from './components/Auth'
import { CLOUD } from './cloud'
import type { SyncStatus } from './store'
import { applyTheme } from './theme'
import { go, href, useRoute } from './router'
import { Icon } from './components/Icon'
import { ClientForm, EventForm, ExpenseForm, ProjectForm } from './components/forms'
import { allPayments, isLate, paymentLate, setCustomColumns } from './utils'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Finance from './pages/Finance'
import Agenda from './pages/Agenda'
import Quotes from './pages/Quotes'
import QuoteEditor from './pages/QuoteEditor'
import SettingsPage from './pages/Settings'

const NAV = [
  { page: 'inicio', label: 'início', icon: 'home' },
  { page: 'projetos', label: 'demandas', icon: 'folder' },
  { page: 'clientes', label: 'clientes', icon: 'users' },
  { page: 'financeiro', label: 'financeiro', icon: 'wallet' },
  { page: 'agenda', label: 'agenda', icon: 'calendar' },
  { page: 'orcamentos', label: 'orçamentos', icon: 'file' },
  { page: 'config', label: 'configurações', icon: 'settings' },
]

type Quick = 'projeto' | 'cliente' | 'evento' | 'despesa' | null

export default function App() {
  const { data, setSettings, lastSaved, replaceAll, sync, userEmail } = useStore()
  const { settings } = data
  setCustomColumns(settings.customColumns) // colunas próprias do quadro ficam disponíveis para todas as telas
  const route = useRoute()
  const [quick, setQuick] = useState<Quick>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const [dragNav, setDragNav] = useState<string | null>(null)
  // ordem do menu escolhida pela usuária (itens novos entram no fim)
  const nav = useMemo(() => {
    const order = settings.navOrder
    return [...NAV].sort((a, b) => {
      const ia = order.indexOf(a.page)
      const ib = order.indexOf(b.page)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [settings.navOrder])
  const moveNav = (page: string, to: number) => {
    const pages = nav.map((n) => n.page).filter((p) => p !== page)
    pages.splice(Math.max(0, Math.min(to, pages.length)), 0, page)
    setSettings({ navOrder: pages })
  }

  useEffect(() => applyTheme(settings), [settings])
  useEffect(() => setMenuOpen(false), [route.page, route.id])

  const alerts = useMemo(
    () => ({
      projetos: data.projects.filter(isLate).length,
      financeiro: allPayments(data).filter((x) => paymentLate(x.pay)).length,
    }),
    [data],
  )

  const page = (() => {
    switch (route.page) {
      case 'clientes':
        return route.id ? <ClientDetail key={route.id} id={route.id} /> : <Clients />
      case 'projetos':
        return route.id ? <ProjectDetail key={route.id} id={route.id} /> : <Projects />
      case 'financeiro':
        return <Finance />
      case 'agenda':
        return <Agenda />
      case 'orcamentos':
        return route.id ? <QuoteEditor key={route.id} id={route.id} /> : <Quotes />
      case 'config':
        return <SettingsPage />
      default:
        return <Dashboard onQuick={setQuick} />
    }
  })()

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <a className="brand" href={href('inicio')}>
          {settings.logo ? (
            <img src={settings.logo} alt={settings.brandName} />
          ) : (<span className="brand-name">
              {settings.brandName.replace(/\.$/, '')}
              <i>.</i>
            </span>
          )}
          {settings.tagline && <span className="brand-tag">{settings.tagline}</span>}
        </a>
        <nav className={organizing ? 'organizing' : ''}>
          {nav.map((n, i) => {
            const count = alerts[n.page as keyof typeof alerts]
            return (
              <a
                key={n.page}
                href={href(n.page)}
                className={`${route.page === n.page ? 'active' : ''} ${dragNav === n.page ? 'dragging' : ''}`}
                // só dá para arrastar com "organizar menu" ligado (evita mudar sem querer)
                draggable={organizing}
                onDragStart={() => organizing && setDragNav(n.page)}
                onDragOver={(e) => {
                  if (!organizing) return
                  e.preventDefault()
                  if (dragNav && dragNav !== n.page) moveNav(dragNav, i)
                }}
                onDragEnd={() => setDragNav(null)}
                onClick={(e) => organizing && e.preventDefault()}
              >
                <Icon name={n.icon} />
                <span>{n.label}</span>
                {count && !organizing ? <em className="nav-alert" title="Itens atrasados">{count}</em> : null}
                {organizing && (
                  <span className="nav-arrows">
                    <button type="button" className="icon-btn subtle" disabled={i === 0} onClick={() => moveNav(n.page, i - 1)} aria-label="Subir">
                      <Icon name="chevronL" size={14} className="rot-up" />
                    </button>
                    <button type="button" className="icon-btn subtle" disabled={i === nav.length - 1} onClick={() => moveNav(n.page, i + 1)} aria-label="Descer">
                      <Icon name="chevronL" size={14} className="rot-down" />
                    </button>
                  </span>
                )}
              </a>
            )
          })}
          <button type="button" className="link nav-organize" onClick={() => setOrganizing((v) => !v)}>
            {organizing ? 'pronto' : 'organizar menu'}
          </button>
        </nav>
        <div className="sidebar-foot">
          <button className="icon-btn" onClick={() => setSettings({ dark: !settings.dark })} title="Alternar tema claro/escuro">
            <Icon name={settings.dark ? 'sun' : 'moon'} />
          </button>
          <SyncBadge sync={sync} lastSaved={lastSaved} />
          {CLOUD && (
            <button className="btn small ghost" onClick={() => signOut()} title={userEmail}>
              sair
            </button>
          )}
        </div>
      </aside>
      <div className="scrim" onClick={() => setMenuOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setMenuOpen(true)} aria-label="Menu">
            <Icon name="menu" />
          </button>
          <GlobalSearch />
          <div className="add-menu">
            <button className="btn primary" onClick={() => setAddOpen((v) => !v)}>
              <Icon name="plus" size={16} /> <span className="hide-mobile">Novo</span>
            </button>
            {addOpen && (
              <>
                <div className="click-away" onClick={() => setAddOpen(false)} />
                <div className="dropdown">
                  {(
                    [
                      ['projeto', 'Demanda / projeto', 'folder'],
                      ['cliente', 'Cliente', 'users'],
                      ['evento', 'Compromisso', 'calendar'],
                      ['despesa', 'Despesa', 'wallet'],
                    ] as const
                  ).map(([k, label, icon]) => (
                    <button
                      key={k}
                      onClick={() => {
                        setQuick(k)
                        setAddOpen(false)
                      }}
                    >
                      <Icon name={icon} size={16} /> {label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setAddOpen(false)
                      go('orcamentos', 'novo')
                    }}
                  >
                    <Icon name="file" size={16} /> Orçamento
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="content">
          {data.demo && (
            <div className="demo-banner">
              <span>
                <b>Dados de exemplo.</b> Clientes e valores fictícios para você explorar. Pode editar à vontade.
              </span>
              <div className="row gap-s">
                <button
                  className="btn small"
                  onClick={async () =>
                    (await ask('Apagar os dados de exemplo e começar com o sistema vazio? Suas configurações ficam.', { confirmLabel: 'Começar do zero', danger: true })) &&
                    replaceAll({ ...emptyData(), settings: data.settings })
                  }
                >
                  Começar do zero
                </button>
                <button className="btn small ghost" onClick={() => replaceAll({ ...data, demo: false })}>
                  Ocultar aviso
                </button>
              </div>
            </div>
          )}
          {page}
        </main>
      </div>

      <nav className="bottom-nav">
        {nav.slice(0, 4).map((n) => (
          <a key={n.page} href={href(n.page)} className={route.page === n.page ? 'active' : ''}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </a>
        ))}
        <button type="button" className={nav.slice(4).some((n) => n.page === route.page) ? 'active' : ''} onClick={() => setMenuOpen(true)}>
          <Icon name="menu" />
          <span>mais</span>
        </button>
      </nav>

      {quick === 'projeto' && <ProjectForm onClose={() => setQuick(null)} onSaved={(p) => go('projetos', p.id)} />}
      {quick === 'cliente' && <ClientForm onClose={() => setQuick(null)} onSaved={(c) => go('clientes', c.id)} />}
      {quick === 'evento' && <EventForm onClose={() => setQuick(null)} />}
      {quick === 'despesa' && <ExpenseForm onClose={() => setQuick(null)} />}
    </div>
  )
}

function GlobalSearch() {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return []
    const has = (...s: string[]) => s.some((x) => x?.toLowerCase().includes(term))
    return [
      ...data.clients.filter((c) => has(c.name, c.company, c.email, c.instagram, c.city)).map((c) => ({ kind: 'Cliente', label: c.name, sub: c.company, page: 'clientes', id: c.id })),
      ...data.projects
        .filter((p) => has(p.title, p.description, p.notes))
        .map((p) => ({ kind: 'Demanda', label: p.title, sub: data.clients.find((c) => c.id === p.clientId)?.name ?? '', page: 'projetos', id: p.id })),
      ...data.quotes.filter((x) => has(x.title, String(x.number))).map((x) => ({ kind: 'Orçamento', label: `#${x.number} ${x.title}`, sub: '', page: 'orcamentos', id: x.id })),
    ].slice(0, 10)
  }, [q, data])

  return (
    <div className="search">
      <Icon name="search" size={16} />
      <input
        ref={ref}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar cliente, projeto, orçamento…"
      />
      <kbd className="hide-mobile">Ctrl K</kbd>
      {open && results.length > 0 && (
        <div className="dropdown search-results">
          {results.map((r) => (
            <button
              key={r.kind + r.id}
              onMouseDown={() => {
                go(r.page, r.id)
                setQ('')
              }}
            >
              <span className="tag">{r.kind}</span>
              <span className="grow">{r.label}</span>
              <span className="muted small">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SyncBadge({ sync, lastSaved }: { sync: SyncStatus; lastSaved: Date | null }) {
  const time = lastSaved?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const label =
    sync === 'saving' ? 'salvando…' : sync === 'offline' ? 'sem conexão · salvo no aparelho' : sync === 'saved' ? `na nuvem${time ? ` · ${time}` : ''}` : time ? `salvo ${time}` : 'salvo neste navegador'
  return (
    <span className={`sync-status grow ${sync === 'saving' ? 'saving' : sync === 'offline' ? 'error' : ''}`}>
      <i /> {label}
    </span>
  )
}
