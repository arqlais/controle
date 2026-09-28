import { useEffect, useMemo, useRef, useState } from 'react'
import { emptyData, hasDemoData, useStore } from './store'
import { ask } from './components/dialog'
import type { SyncStatus } from './store'
import { applyTheme, useDeviceDark } from './theme'
import { BRAND_KEY, signOut } from './components/Auth'
import { CLOUD } from './cloud'
import { draftRenumber } from './numbering'
import { AvatarGlyph } from './components/Avatar'
import { AIChat } from './components/AIChat'
import { StatusDialogHost } from './components/quick'
import { back, go, href, useRoute } from './router'
import { Icon } from './components/Icon'
import { ClientForm, EventForm, ExpenseForm, ProjectForm } from './components/forms'
import { allPayments, isLate, matches, paymentDue, setCustomColumns, today } from './utils'
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
import Manual from './pages/Manual'
import Instagram from './pages/Instagram'
import Profile, { profileImportant } from './pages/Profile'
import Contracts from './pages/Contracts'
import Admin from './pages/Admin'
import Checkout from './pages/Checkout'
import Suggestions from './pages/Suggestions'
import Feedback from './pages/Feedback'
import SubscriptionPage, { BlockedScreen, TrialBanner } from './pages/Subscription'
import { OwnerChat } from './components/OwnerChat'
import { useAccess } from './access'
import Landing from './pages/Landing'
import { setViewAsClient, viewingAsClient } from './viewAs'
import { PREVIEW_CLIENT, setPreviewRole } from './platform'
import { SIGNUP_KEY, hasLocalAccount, seedPreviewAccount } from './store'
import { ScreenHelp, Tour } from './components/Tour'
import { useInbox } from './chat'
import { trialOver } from './platform'
import { PLATFORM, type Feature } from './plans'
import { effectiveSettings } from './brand'

const NAV = [
  { page: 'inicio', label: 'início', icon: 'home' },
  { page: 'projetos', label: 'demandas', icon: 'folder' },
  { page: 'clientes', label: 'clientes', icon: 'users' },
  { page: 'financeiro', label: 'financeiro', icon: 'wallet' },
  { page: 'agenda', label: 'agenda', icon: 'calendar' },
  { page: 'orcamentos', label: 'orçamentos', icon: 'file' },
  { page: 'contratos', label: 'contratos', icon: 'briefcase' },
  { page: 'instagram', label: 'instagram', icon: 'instagram' },
]
// telas que dependem do plano (src/plans.ts)
const NEEDS: Record<string, Feature> = { contratos: 'contratos', instagram: 'instagram', plataforma: 'painelDona' }
// ajustes e dicas: grupo à parte, sempre no fim do menu e em outro tom
const TOOLS = [
  { page: 'manual', label: 'manual', icon: 'book' },
  { page: 'config', label: 'configurações', icon: 'settings' },
]

type Quick = 'projeto' | 'cliente' | 'evento' | 'despesa' | null

export default function App() {
  const { data, setSettings, lastSaved, replaceAll, sync, userEmail, isSample, showSample, upsert } = useStore()
  // rascunhos de orçamento sempre depois do último número enviado/aprovado, em ordem de data
  useEffect(() => {
    if (sync === 'loading' || isSample) return
    for (const r of draftRenumber(data.quotes)) {
      const q = data.quotes.find((x) => x.id === r.id)
      if (q) upsert('quotes', { ...q, number: r.number })
    }
  }, [data.quotes, sync, isSample, upsert])
  // olho: com dados de exemplo salvos, liga/desliga o aviso; com dados reais, mostra o exemplo só na tela
  const ownDemo = !isSample && (data.demo || hasDemoData(data))
  const exampleOn = isSample || (ownDemo && data.demo)
  const toggleExample = () => (isSample ? showSample(false) : ownDemo ? replaceAll({ ...data, demo: !data.demo }) : showSample(true))
  const { settings } = data
  const access = useAccess()
  // dona: caixa de entrada do chat (aviso de mensagem nova em qualquer tela)
  const inbox = useInbox(access.isOwner && !access.legacy, true)
  const [chatSignal, setChatSignal] = useState(0)
  const openChat = () => setChatSignal((n) => n + 1)
  setCustomColumns(settings.customColumns) // colunas próprias do quadro ficam disponíveis para todas as telas
  const route = useRoute()
  // topo das páginas de item fixo: mede a barra de busca e marca quando o topo "grudou" (fica mais compacto)
  useEffect(() => {
    const onScroll = () => {
      const bar = document.querySelector<HTMLElement>('.topbar')
      const h = bar?.offsetHeight ?? 70
      document.documentElement.style.setProperty('--topbar-h', `${h}px`)
      const head = document.querySelector<HTMLElement>('.sticky-head')
      if (head) head.classList.toggle('is-stuck', window.scrollY > 40 && head.getBoundingClientRect().top <= h + 1)
      // altura do topo fixo: a prévia do PDF para logo abaixo dele (não fica escondida atrás)
      document.documentElement.style.setProperty('--head-h', `${head?.offsetHeight ?? 0}px`)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  useEffect(() => {
    try {
      if (settings.brandName?.trim()) localStorage.setItem(BRAND_KEY, settings.brandName.trim())
    } catch {
      /* ok */
    }
  }, [settings.brandName])
  const [quick, setQuick] = useState<Quick>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const [dragNav, setDragNav] = useState<string | null>(null)
  // ordem do menu escolhida pela usuária (itens novos entram no fim)
  const nav = useMemo(() => {
    const order = settings.navOrder
    return NAV.filter((n) => (!NEEDS[n.page] || access.has(NEEDS[n.page])) && !(n.page === 'contratos' && settings.contracts?.off)).sort((a, b) => {
      const ia = order.indexOf(a.page)
      const ib = order.indexOf(b.page)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [settings.navOrder, settings.contracts?.off, access])
  // grupos à parte, no fim do menu: plataforma (só a dona), sua conta (clientes) e ajustes e dicas
  const groups = useMemo(
    () =>
      [
        { key: 'plataforma', label: 'plataforma', items: access.has('painelDona') && !access.legacy ? [{ page: 'plataforma', label: 'painel', icon: 'crown' }, { page: 'vendas', label: 'página de vendas', icon: 'eye' }] : [] },
        { key: 'conta', label: 'sua conta', items: !access.isOwner ? [{ page: 'assinatura', label: 'minha assinatura', icon: 'star' }, { page: 'sugestoes', label: 'sugestões', icon: 'flag' }, { page: 'avaliar', label: 'deixar depoimento', icon: 'heart' }] : [] },
        { key: 'ajustes', label: 'ajustes e dicas', items: TOOLS },
      ].filter((g) => g.items.length),
    [access],
  )
  // portfólio / site (do perfil): abre em outra aba
  const siteUrl = (() => {
    const w = (settings.website || (access.isOwner ? 'www.lais3d.com.br' : '')).trim()
    return w ? (/^https?:\/\//.test(w) ? w : `https://${w}`) : ''
  })()
  // dona: abrir o sistema como um cliente novo (na prévia, troca o "ver como")
  const openClientView = () => {
    setMenuOpen(false)
    if (CLOUD) setViewAsClient(true)
    else {
      // prévia: conta de cliente fictícia (nunca com o perfil da dona)
      if (!hasLocalAccount(PREVIEW_CLIENT)) {
        try {
          localStorage.setItem(SIGNUP_KEY, JSON.stringify({ name: 'Ana', studio: 'estúdio exemplo', demo: true }))
        } catch {
          /* ok */
        }
        seedPreviewAccount(PREVIEW_CLIENT)
      }
      setPreviewRole('cliente')
    }
    go('inicio')
  }
  const asClient = CLOUD && viewingAsClient()
  // passo a passo do primeiro acesso: aparece para quem assina até concluir/pular ("ver depois" = volta no dia seguinte)
  const [tourOpen, setTourOpen] = useState(false)
  useEffect(() => {
    if (sync !== 'loading' && !access.isOwner && !access.legacy && settings.tour !== 'feito' && settings.tour !== today()) setTourOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync === 'loading', access.isOwner])
  const closeTour = (how: 'feito' | 'depois') => {
    setTourOpen(false)
    setSettings({ tour: how === 'feito' ? 'feito' : today() })
    if (how === 'feito') go('inicio')
  }
  const moveNav = (page: string, to: number) => {
    const pages = nav.map((n) => n.page).filter((p) => p !== page)
    pages.splice(Math.max(0, Math.min(to, pages.length)), 0, page)
    setSettings({ navOrder: pages })
  }

  const [dark, setDark] = useDeviceDark()
  // The Seasons é só da dona: nas contas de clientes vira a fonte padrão deles
  useEffect(() => {
    applyTheme(effectiveSettings(settings, access.has), dark)
  }, [settings, dark, access, route.page === 'vendas'])
  useEffect(() => {
    setMenuOpen(false)
  }, [route.page, route.id])

  const alerts = useMemo(
    () => ({
      projetos: data.projects.filter(isLate).length,
      financeiro: allPayments(data).filter((x) => paymentDue(x.pay, x.project)).length,
      plataforma: inbox.unread,
    }),
    [data, inbox.unread],
  )
  // conta de cliente pausada, teste encerrado ou cancelada: dados guardados, só assinatura/chat/backup
  const locked = !access.isOwner && !!access.sub && (access.sub.blocked || trialOver(access.sub) || access.sub.status === 'cancelada')

  const page = (() => {
    if (locked && (route.page !== 'assinatura' || access.sub?.blocked)) return <BlockedScreen onChat={openChat} />
    const need = NEEDS[route.page]
    if (need && !access.has(need)) return <Upgrade onChat={openChat} />
    switch (route.page) {
      case 'contratos':
        return <Contracts id={route.id} />
      case 'plataforma':
        return <Admin />
      case 'assinatura':
        return route.id ? <Checkout key={route.id} planId={route.id} /> : <SubscriptionPage onChat={openChat} />
      case 'sugestoes':
        return <Suggestions />
      case 'avaliar':
        return <Feedback />
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
      case 'instagram':
        return <Instagram />
      case 'manual':
        return <Manual />
      case 'perfil':
        return <Profile />
      default:
        return <Dashboard onQuick={setQuick} />
    }
  })()

  // a dona vê a página de vendas como um visitante, com uma barra para editar ou voltar
  if (route.page === 'vendas' && access.isOwner)
    return (
      <>
        <Landing />
        <div className="owner-sales-bar" role="region" aria-label="Você está vendo a página de vendas">
          <span>
            <Icon name="eye" size={15} /> você está vendo a <b>página de vendas</b>, como os visitantes
          </span>
          <button
            className="btn small ghost"
            onClick={() => {
              try {
                sessionStorage.setItem('tela:painel-aba', JSON.stringify('site'))
              } catch {
                /* ok */
              }
              go('plataforma')
            }}
          >
            <Icon name="edit" size={14} /> editar textos e foto
          </button>
          <button className="btn small primary" onClick={() => go('inicio')}>
            voltar ao sistema
          </button>
        </div>
      </>
    )

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <a className={`brand ${(settings.brandName || '').replace(/\.$/, '').length > 11 ? 'is-long' : ''}`} href={href('inicio')}>
          <span className={`brand-photo ${settings.logo ? '' : 'is-empty'}`}><AvatarGlyph s={settings} size={24} /></span>
          <span className="brand-text">
            <span className="brand-kicker">meu estúdio</span>
            <span className="brand-name">
              {settings.brandName.replace(/\.$/, '') || 'estúdio'}
              <i>.</i>
            </span>
          </span>
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
          {groups.map((g) => (
            <div key={g.key} className={`nav-group is-${g.key}`}>
              <span className="nav-group-label">{g.label}</span>
              {g.items.map((n) => {
                const count = alerts[n.page as keyof typeof alerts]
                return (
                  <a key={n.page} href={href(n.page)} className={`is-tool ${route.page === n.page ? 'active' : ''}`} onClick={(e) => organizing && e.preventDefault()}>
                    <Icon name={n.icon} />
                    <span>{n.label}</span>
                    {count && !organizing ? <em className="nav-alert" title="Mensagens novas no chat">{count}</em> : null}
                  </a>
                )
              })}
              {g.key === 'plataforma' && (
                <button type="button" className="is-tool nav-tour" onClick={() => openClientView()} title="Abrir o sistema como um cliente novo em teste grátis (nada é salvo)">
                  <Icon name="user" />
                  <span>ver como cliente</span>
                </button>
              )}
              {g.key === 'ajustes' && siteUrl && (
                <a className="is-tool" href={siteUrl} target="_blank" rel="noreferrer" title="Abre em outra aba">
                  <Icon name="link" />
                  <span>{access.isOwner ? 'meu portfólio' : 'meu site'} ↗</span>
                </a>
              )}
              {g.key === 'ajustes' && !access.isOwner && (
                <button type="button" className="is-tool nav-tour" onClick={() => (setMenuOpen(false), go('inicio'), setTourOpen(true))}>
                  <Icon name="sparkle" />
                  <span>passo a passo</span>
                </button>
              )}
            </div>
          ))}
          <div className="nav-links">
            <button type="button" className="link" onClick={() => setOrganizing((v) => !v)}>
              {organizing ? 'pronto' : 'organizar menu'}
            </button>
          </div>
        </nav>
        <a href={href('perfil')} className={`profile-chip ${route.page === 'perfil' ? 'active' : ''}`} title="Perfil do estúdio e conta">
          <span className="profile-chip-avatar">
            <AvatarGlyph s={settings} size={18} />
          </span>
          <span className="grow">
            <b>{settings.ownerName || settings.brandName || 'meu perfil'}</b>
            <small>{userEmail || 'perfil do estúdio'}</small>
          </span>
          {profileImportant(settings).length > 0 && <em className="profile-chip-dot" title={`Falta no perfil: ${profileImportant(settings).join(', ')}`} />}
        </a>
        <div className="sidebar-foot">
          <button className="icon-btn" onClick={() => setDark(!dark)} title="Tema claro/escuro (só neste aparelho)">
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>
          <button
            className={`icon-btn sample-toggle ${exampleOn ? 'is-on' : ''}`}
            onClick={toggleExample}
            title={exampleOn ? 'Ocultar exemplo' : 'Ver exemplo preenchido'}
            aria-label={exampleOn ? 'Ocultar exemplo' : 'Ver exemplo preenchido'}
          >
            <Icon name={exampleOn ? 'eye' : 'eye-off'} size={16} />
            <span>exemplo</span>
          </button>
          <SyncBadge sync={sync} lastSaved={lastSaved} />
          {CLOUD && (
            <button
              className="icon-btn nav-logout"
              title={`Sair da conta${userEmail ? ` (${userEmail})` : ''}`}
              aria-label="Sair da conta"
              onClick={async () => (await ask('Sair da conta neste aparelho? Seus dados continuam salvos na nuvem.', { confirmLabel: 'Sair' })) && signOut()}
            >
              <Icon name="logout" />
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
          {(route.page !== 'inicio' || route.id) && (
            <button className="back-btn" onClick={() => void back()} aria-label="Voltar" title="Voltar para a tela anterior">
              <Icon name="chevronL" size={18} />
              <span className="hide-mobile">voltar</span>
            </button>
          )}
          <GlobalSearch />
          <ScreenHelp />
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
        {tourOpen && <Tour has={(f) => access.has(f)} onClose={closeTour} />}
        {asClient && (
          <div className="owner-sales-bar" role="region" aria-label="Você está vendo como cliente">
            <span>
              <Icon name="user" size={15} /> você está vendo como <b>um cliente novo</b> · nada aqui é salvo
            </span>
            <button
              className="btn small primary"
              onClick={() => {
                setViewAsClient(false)
                go('plataforma')
              }}
            >
              voltar para a minha conta
            </button>
          </div>
        )}
        <main className="content">
          {isSample && (
            <div className="demo-banner">
              <span>
                <b>Exemplo preenchido.</b> Só para visualizar: seus dados estão guardados e nada feito aqui é salvo.
              </span>
              <button className="btn small" onClick={() => showSample(false)}>
                voltar para meus dados
              </button>
            </div>
          )}
          <TrialBanner />
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
        <StatusDialogHost />
        {access.has('assistenteIA') ? (
          <AIChat quoteId={route.page === 'orcamentos' && route.id && route.id !== 'novo' ? route.id : undefined} />
        ) : access.has('chatDona') ? (
          <OwnerChat openSignal={chatSignal} />
        ) : null}
      </div>

      <nav className="bottom-nav">
        {/* 5 atalhos do dia a dia; o resto (orçamentos, manual, configurações, perfil) fica no menu do canto superior */}
        {nav.slice(0, 5).map((n) => (
          <a key={n.page} href={href(n.page)} className={route.page === n.page ? 'active' : ''}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </a>
        ))}
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
    const term = q.trim()
    if (term.length < 2) return []
    const has = (...s: (string | undefined)[]) => matches(term, ...s)
    return [
      ...data.clients.filter((c) => has(c.name, c.company, c.email, c.instagram, c.city)).map((c) => ({ kind: 'Cliente', label: c.name, sub: c.company, page: 'clientes', id: c.id })),
      ...data.projects
        .filter((p) => has(p.title, p.description, p.notes))
        .map((p) => ({ kind: 'Demanda', label: p.title, sub: data.clients.find((c) => c.id === p.clientId)?.name ?? '', page: 'projetos', id: p.id })),
      ...data.quotes.filter((x) => has(x.title, String(x.number), `#${x.number}`, data.clients.find((c) => c.id === x.clientId)?.name)).map((x) => ({ kind: 'Orçamento', label: `#${x.number} ${x.title}`, sub: data.clients.find((c) => c.id === x.clientId)?.name ?? '', page: 'orcamentos', id: x.id })),
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
        type="search"
        name="busca-sistema"
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore
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
    sync === 'saving' ? 'salvando…' : sync === 'offline' ? 'sem conexão · salvo no aparelho' : sync === 'saved' ? `salvo na nuvem${time ? ` · ${time}` : ''}` : time ? `salvo ${time}` : 'salvo neste navegador'
  return (
    <span className={`sync-status grow ${sync === 'saving' ? 'saving' : sync === 'offline' ? 'error' : ''}`}>
      <i /> {label}
    </span>
  )
}

/** Tela de um recurso que o plano atual não tem. */
function Upgrade({ onChat }: { onChat: () => void }) {
  return (
    <div className="page">
      <section className="card pf-blocked">
        <Icon name="star" size={28} />
        <h1>
          disponível no plano <em>Completo</em>
        </h1>
        <p className="muted">Este recurso faz parte do plano Completo do {PLATFORM.name}. Durante o teste grátis dá para trocar de plano quando quiser.</p>
        <div className="row gap-s wrap center">
          <a className="btn primary" href={href('assinatura')}>
            ver planos
          </a>
          <button className="btn" onClick={onChat}>
            <Icon name="chat" size={16} /> tirar dúvida
          </button>
        </div>
      </section>
    </div>
  )
}
