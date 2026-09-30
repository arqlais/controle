import { Fragment, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { emptyData, hasDemoData, useStore } from './store'
import { ask, toast } from './components/dialog'
import { ARTIFACT } from './env'
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
import { allPayments, isLate, matches, paymentDue, quoteNumber, setCustomColumns, setEventLabels, today } from './utils'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
import Projects from './pages/Projects'
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
import Finance from './pages/Finance'
import Agenda from './pages/Agenda'
import Quotes from './pages/Quotes'
const QuoteEditor = lazy(() => import('./pages/QuoteEditor'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const Manual = lazy(() => import('./pages/Manual'))
const Instagram = lazy(() => import('./pages/Instagram'))
const Briefings = lazy(() => import('./pages/Briefings'))
const Processes = lazy(() => import('./pages/Processes'))
const Documents = lazy(() => import('./pages/Documents'))
import Profile, { profileImportant } from './pages/Profile'
const Contracts = lazy(() => import('./pages/Contracts'))
const Admin = lazy(() => import('./pages/Admin'))
const Checkout = lazy(() => import('./pages/Checkout'))
import Suggestions from './pages/Suggestions'
import Feedback from './pages/Feedback'
import SubscriptionPage, { BlockedScreen, TrialBanner } from './pages/Subscription'
import { OwnerChat } from './components/OwnerChat'
import { useBriefingSync } from './briefingSync'
import { useClientInbox } from './avisar'
import { NoticesButton } from './components/Notices'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdateBanner } from './components/UpdateBanner'
import { ServicesSetup } from './components/ServicesSetup'
import { CLIENT_SERVICES, servicesFor } from './clientDefaults'
import { LockedView, TrialFeatureNote, lockPlan } from './components/LockedPreview'
import { ClientPanelSync } from './components/ClientPanel'
import { markBetaDevice } from './beta'
import { INVITE_KEY } from './components/Signup'
import { useAccess } from './access'
const Landing = lazy(() => import('./pages/Landing'))
import { setViewAsClient, setViewPlan, viewingAsClient, type ViewPlan } from './viewAs'
import { PREVIEW_CLIENT, notifyPlatformMode, platform, setPlatformSample, setPreviewPlan, setPreviewRole } from './platform'
import { SIGNUP_KEY, demoData, hasLocalAccount, seedPreviewAccount } from './store'
import { ScreenHelp, Tour } from './components/Tour'
import { NewsButton, NewsHistory, NewsModal, WelcomeCard, useNews } from './components/News'
import { useInbox, useSuggestionUpdates } from './chat'
import { trialOver } from './platform'
import { PLANS, PLAN_LIST, PLATFORM, plansWith, type Feature, type PlanId } from './plans'
import { effectiveSettings } from './brand'

// menu em grupos: o dia a dia, clientes e vendas, e as ferramentas do estúdio
const NAV_GROUPS = [
  { key: 'dia', label: 'dia a dia' },
  { key: 'vendas', label: 'clientes e vendas' },
  { key: 'estudio', label: 'estúdio' },
] as const
const NAV: { page: string; label: string; icon: string; group: (typeof NAV_GROUPS)[number]['key'] }[] = [
  { page: 'inicio', label: 'início', icon: 'home', group: 'dia' },
  { page: 'projetos', label: 'demandas', icon: 'folder', group: 'dia' },
  { page: 'agenda', label: 'agenda', icon: 'calendar', group: 'dia' },
  { page: 'financeiro', label: 'financeiro', icon: 'wallet', group: 'dia' },
  { page: 'clientes', label: 'clientes', icon: 'users', group: 'vendas' },
  { page: 'orcamentos', label: 'orçamentos', icon: 'file', group: 'vendas' },
  { page: 'briefings', label: 'briefings', icon: 'clip', group: 'vendas' },
  { page: 'contratos', label: 'contratos', icon: 'briefcase', group: 'vendas' },
  { page: 'documentos', label: 'documentos', icon: 'ruler', group: 'estudio' },
  { page: 'processos', label: 'etapas de trabalho', icon: 'layers', group: 'estudio' },
  { page: 'instagram', label: 'instagram', icon: 'instagram', group: 'estudio' },
]
// telas que dependem do plano (src/plans.ts)
const NEEDS: Record<string, Feature> = { contratos: 'contratos', instagram: 'instagram', plataforma: 'painelDona', briefings: 'briefing', documentos: 'documentos' }
// ajustes e dicas: grupo à parte, sempre no fim do menu e em outro tom
const TOOLS = [
  { page: 'manual', label: 'manual', icon: 'book' },
  { page: 'config', label: 'configurações', icon: 'settings' },
]

type Quick = 'projeto' | 'cliente' | 'evento' | 'despesa' | null

export default function App() {
  const { data, setSettings, lastSaved, replaceAll, sync, userEmail, isSample, showSample, upsert } = useStore()
  // rascunhos de orçamento sempre depois do último número enviado/aprovado, em ordem de data
  // caixas de texto crescem com o conteúdo: nada fica escondido (o texto do contrato tem rolagem própria)
  useEffect(() => {
    const fit = (t: HTMLTextAreaElement) => {
      if (t.classList.contains('pf-contract-text') || t.dataset.fixed != null || !t.offsetParent) return
      t.style.height = 'auto'
      t.style.height = `${t.scrollHeight + 2}px`
    }
    const onInput = (e: Event) => e.target instanceof HTMLTextAreaElement && fit(e.target)
    let raf = 0
    const all = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => document.querySelectorAll('textarea').forEach((t) => fit(t as HTMLTextAreaElement)))
    }
    const mo = new MutationObserver((list) => list.some((m) => [...m.addedNodes].some((n) => n instanceof HTMLElement && (n.tagName === 'TEXTAREA' || !!n.querySelector?.('textarea')))) && all())
    mo.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('input', onInput)
    window.addEventListener('resize', all)
    all()
    return () => {
      mo.disconnect()
      document.removeEventListener('input', onInput)
      window.removeEventListener('resize', all)
      cancelAnimationFrame(raf)
    }
  }, [])
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
  // aparelho da dona: vê as novidades ainda em teste (inclusive em "ver como cliente")
  useEffect(() => {
    if (access.isOwner) markBetaDevice()
  }, [access.isOwner])
  // pediu convite do Estúdio na página de vendas: o pedido vai pelo chat assim que a conta existe
  useEffect(() => {
    if (access.isOwner || !access.sub) return
    let plan = ''
    try {
      plan = localStorage.getItem(INVITE_KEY) || ''
      localStorage.removeItem(INVITE_KEY)
    } catch {
      return
    }
    if (!plan || !(plan in PLANS)) return
    const text = `oi! quero conhecer o plano ${PLANS[plan as PlanId].name} ✨`
    void platform.send(access.sub.userId, text, false).then(() => platform.notice({ tipo: 'mensagem', text })).catch(() => undefined)
    try {
      localStorage.setItem(`convite-${plan}`, new Date().toISOString().slice(0, 10))
    } catch {
      /* ok */
    }
  }, [access.isOwner, access.sub])
  // dona: caixa de entrada do chat (aviso de mensagem nova em qualquer tela)
  const inbox = useInbox(access.isOwner && !access.legacy, true)
  const sugUpdates = useSuggestionUpdates(!access.isOwner && !access.legacy)
  // respostas de briefing que chegaram enquanto estava fora
  useBriefingSync(access.has('briefing'))
  // assinaturas e recados que os clientes mandaram pelas páginas públicas
  useClientInbox(!access.legacy)
  const [chatSignal, setChatSignal] = useState(0)
  const openChat = () => setChatSignal((n) => n + 1)
  setEventLabels(settings.eventLabels)
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
    const g = (k: string) => NAV_GROUPS.findIndex((x) => x.key === k)
    // a ordem escolhida vale dentro de cada grupo; itens novos entram no fim do grupo
    // o que o plano não tem continua no menu (com cadeado): abre como vitrine, para dar vontade
    return NAV.filter((n) => (!NEEDS[n.page] || NEEDS[n.page] !== 'painelDona' || access.has(NEEDS[n.page])) && !(n.page === 'contratos' && settings.contracts?.off) && !(n.page === 'instagram' && settings.instagramOff)).sort((a, b) => {
      const ia = order.indexOf(a.page)
      const ib = order.indexOf(b.page)
      return g(a.group) - g(b.group) || (ia < 0 ? 99 + NAV.indexOf(a) : ia) - (ib < 0 ? 99 + NAV.indexOf(b) : ib)
    })
  }, [settings.navOrder, settings.contracts?.off, settings.instagramOff, access])
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
  // olhinho da dona: o painel da plataforma também mostra o exemplo (assinantes, conversas, depoimentos…)
  // liga antes de as telas buscarem os dados (senão o painel carregaria o real, vazio)
  const platformSample = CLOUD && isSample && access.isOwner
  setPlatformSample(platformSample, true)
  useEffect(() => {
    notifyPlatformMode()
  }, [platformSample])
  const backToOwner = () => {
    setMenuOpen(false)
    setViewAsClient(false)
    go('plataforma')
  }
  // passo a passo do primeiro acesso: aparece para quem assina até concluir/pular ("ver depois" = volta no dia seguinte)
  const [tourOpen, setTourOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  useEffect(() => {
    if (sync !== 'loading' && !access.isOwner && !access.legacy && !settings.tour) {
      // conta nova: primeiro o cartão de boas-vindas; depois, o passo a passo
      if (!settings.welcomed && !settings.tour) setWelcomeOpen(true)
      else setTourOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync === 'loading', access.isOwner])
  // primeiro passo obrigatório: o que faz e quanto cobra (conta nova com a tabela de exemplo, ou quem pediu para refazer)
  const untouchedServices = JSON.stringify(settings.services) === JSON.stringify(CLIENT_SERVICES) || JSON.stringify(settings.services) === JSON.stringify(servicesFor(settings.workProfile))
  // só conta nova de verdade (sem nada feito além do exemplo); quem já usa o sistema nunca é obrigado nem perde nada
  const freshAccount = (!data.quotes.length && !data.projects.length) || (hasDemoData(data) && data.quotes.length <= demoData(settings).quotes.length && data.projects.length <= demoData(settings).projects.length)
  const needsSetup = sync !== 'loading' && !access.isOwner && !access.legacy && (settings.servicesSetup === false || (settings.servicesSetup === undefined && untouchedServices && freshAccount))
  const setupNow = needsSetup && !welcomeOpen && !tourOpen
  // novidades: abre sozinha para quem assina quando há algo novo (depois do passo a passo); o sininho do topo reabre
  const news = useNews(!access.legacy)
  const [newsOpen, setNewsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const autoNews = useRef(false)
  useEffect(() => {
    // aparece na tela para todos (a dona também), uma vez por atualização; depois fica no histórico do sininho
    if (autoNews.current || tourOpen || welcomeOpen || sync === 'loading' || !news.fresh.length) return
    autoNews.current = true
    setNewsOpen(true)
    news.markShown()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen, welcomeOpen, access.isOwner, sync, news.fresh.length])
  // e-mail de boas-vindas: o site pede uma vez; a função no Supabase garante que só vai uma vez
  useEffect(() => {
    if (!CLOUD || access.isOwner || access.legacy || sync === 'loading') return
    try {
      if (localStorage.getItem('boas-vindas-email')) return
    } catch {
      return
    }
    platform
      .notice({ tipo: 'boas-vindas' })
      .then((r) => {
        if (r?.ok !== undefined) localStorage.setItem('boas-vindas-email', '1')
      })
      .catch(() => undefined) // função ainda não publicada: tenta na próxima vez
  }, [access.isOwner, access.legacy, sync])
  const closeNews = () => {
    setNewsOpen(false)
    news.markSeen()
  }
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
      plataforma: inbox.unread + inbox.newSuggestions,
      sugestoes: sugUpdates.unseen.length,
    }),
    [data, inbox.unread, inbox.newSuggestions, sugUpdates.unseen.length],
  )
  // conta de cliente pausada, teste encerrado ou cancelada: dados guardados, só assinatura/chat/backup
  const locked = !access.isOwner && !!access.sub && (access.sub.blocked || trialOver(access.sub) || access.sub.status === 'cancelada')

  const page = (() => {
    if (locked && (route.page !== 'assinatura' || access.sub?.blocked)) return <BlockedScreen onChat={openChat} />
    const need = NEEDS[route.page]
    if (need === 'painelDona' && !access.has(need)) return <Upgrade onChat={openChat} />
    const inner = pageFor()
    if (need && !access.has(need)) return <LockedView feature={need}>{inner}</LockedView>
    return need && need !== 'painelDona' ? <TrialFeatureNote feature={need}>{inner}</TrialFeatureNote> : inner
  })()

  function pageFor() {
    switch (route.page) {
      case 'contratos':
        return <Contracts id={route.id} />
      case 'plataforma':
        return <Admin />
      case 'assinatura':
        return route.id ? <Checkout key={route.id} planId={route.id} /> : <SubscriptionPage onChat={openChat} />
      case 'briefings':
        return <Briefings id={route.id} />
      case 'processos':
        return <Processes />
      case 'documentos':
        return <Documents id={route.id} />
      case 'sugestoes':
        return <Suggestions unseen={sugUpdates.unseen} onSeen={sugUpdates.markSeen} />
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
  }

  // a dona vê a página de vendas como um visitante, com uma barra para editar ou voltar
  if (route.page === 'vendas' && access.isOwner)
    return (
      <>
        <Suspense fallback={<div className="loading-screen" />}>
          <Landing />
        </Suspense>
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
        {/* a marca da plataforma fica sempre presente, discreta, acima do estúdio de quem usa */}
        <a className="platform-mark" href={href('inicio')} aria-label={PLATFORM.name}>
          {PLATFORM.name}
          <i>.</i>
        </a>
        <a className={`brand ${(settings.brandName || '').replace(/\.$/, '').length > 9 ? 'is-long' : ''}`} href={href('inicio')}>
          <span className={`brand-photo ${settings.logo ? '' : 'is-empty'}`}><AvatarGlyph s={settings} size={24} /></span>
          <span className="brand-text">
            <span className="brand-kicker">meu estúdio</span>
            <span className="brand-name">
              {settings.brandName.replace(/\.$/, '') || 'estúdio'}
              <i>.</i>
            </span>
          </span>
        </a>
        {asClient && (
          <button type="button" className="btn small primary view-as-back" onClick={backToOwner}>
            <Icon name="chevronL" size={14} /> voltar para a minha conta
          </button>
        )}
        <nav className={organizing ? 'organizing' : ''}>
          {nav.map((n, i) => {
            const count = alerts[n.page as keyof typeof alerts]
            const label = i === 0 || nav[i - 1].group !== n.group ? NAV_GROUPS.find((x) => x.key === n.group)?.label : ''
            return (
              <Fragment key={n.page}>
              {label && <span className="nav-group-label nav-main-label">{label}</span>}
              <a
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
                {NEEDS[n.page] && !organizing ? (
                  !access.has(NEEDS[n.page]) ? (
                    <Icon name="lock" size={13} className="nav-lock" />
                  ) : access.sub?.status === 'trial' && !access.isOwner && plansWith(NEEDS[n.page]).length < PLAN_LIST.length ? (
                    <em className="nav-plan" title={`No teste está liberado. Depois do teste, só no plano ${lockPlan(NEEDS[n.page])}${plansWith(NEEDS[n.page]).length > 1 ? ' ou acima' : ''}.`}>{lockPlan(NEEDS[n.page])}</em>
                  ) : null
                ) : null}
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
              </Fragment>
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
          {!access.legacy && <NoticesButton />}
          {!access.legacy && <NewsButton count={news.unseen.length} onOpen={() => (news.unseen.length ? setNewsOpen(true) : setHistoryOpen(true))} />}
          <ScreenHelp onTour={!access.isOwner ? () => (go('inicio'), setTourOpen(true)) : undefined} />
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
        <ClientPanelSync />
        <UpdateBanner />
        {tourOpen && <Tour has={(f) => access.has(f)} onClose={closeTour} />}
        {newsOpen && !tourOpen && !welcomeOpen && !setupNow && <NewsModal unseen={news.unseen} onClose={closeNews} onLater={news.unseen.length ? () => setNewsOpen(false) : undefined} onHistory={() => (closeNews(), setHistoryOpen(true))} />}
        {historyOpen && <NewsHistory onClose={() => setHistoryOpen(false)} />}
        {setupNow && (
          <ServicesSetup
            initialProfile={settings.workProfile}
            onDone={(services, workProfile) => {
              // refazendo: o que já estava na tabela fica, e os novos entram no fim
              // conta nova com a tabela de exemplo: troca; em qualquer outro caso só acrescenta (nada do que já existe é apagado)
              const keep = untouchedServices && freshAccount ? [] : settings.services.filter((x) => !services.some((y) => y.id === x.id || y.name.trim().toLowerCase() === x.name.trim().toLowerCase()))
              setSettings({ services: [...keep, ...services], workProfile, servicesSetup: true })
              toast('Pronto! Sua tabela de preços está montada.')
            }}
          />
        )}
        {welcomeOpen && (
          <WelcomeCard
            name={access.sub?.name || settings.ownerName || ''}
            onTour={() => {
              setWelcomeOpen(false)
              setSettings({ welcomed: true })
              setTourOpen(true)
            }}
            onSkip={() => {
              setWelcomeOpen(false)
              setSettings({ welcomed: true })
              closeTour('feito')
            }}
          />
        )}
        <main className="content">
        {(asClient || (ARTIFACT && !access.isOwner && !access.legacy)) && (
          <div className="plan-peek" role="region" aria-label="Você está vendo como cliente">
            <span className="plan-peek-label">
              <Icon name="eye" size={15} /> {asClient ? 'vendo como cliente' : 'prévia'} · plano:
            </span>
            <div className="plan-peek-opts" role="radiogroup" aria-label="Ver o sistema no plano">
              {(
                [
                  ['trial', 'teste grátis'],
                  ['essencial', PLANS.essencial.name],
                  ['completo', PLANS.completo.name],
                  ['estudio', PLANS.estudio.name],
                ] as [ViewPlan, string][]
              ).map(([v, label]) => {
                const cur = access.sub ? (access.sub.status === 'trial' ? 'trial' : access.sub.plan) : 'trial'
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={cur === v}
                    className={cur === v ? 'is-on' : ''}
                    onClick={async () => {
                      if (asClient) setViewPlan(v)
                      else {
                        setPreviewPlan(v)
                        await access.refresh()
                      }
                      toast(v === 'trial' ? 'Vendo como quem está no teste grátis (tudo do Estúdio).' : `Vendo como assinante do ${PLANS[v].name}.`)
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {asClient && (
              <button className="btn small primary" onClick={backToOwner}>
                voltar para a minha conta
              </button>
            )}
          </div>
        )}
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
          <Fragment key={isSample ? 'exemplo' : 'real'}>
            {/* telas mais pesadas chegam só quando abertas */}
            <ErrorBoundary resetKey={`${route.page}/${route.id ?? ''}`}><Suspense fallback={<div className="page-loading" aria-busy="true" />}>{page}</Suspense></ErrorBoundary>
          </Fragment>
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
      ...data.quotes.filter((x) => has(x.title, String(x.number), `#${x.number}`, data.clients.find((c) => c.id === x.clientId)?.name)).map((x) => ({ kind: 'Orçamento', label: `${quoteNumber(x)} ${x.title}`, sub: data.clients.find((c) => c.id === x.clientId)?.name ?? '', page: 'orcamentos', id: x.id })),
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
