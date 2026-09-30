import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CLOUD, supabase } from '../cloud'
import { DEFAULT_SETTINGS, SIGNUP_KEY, StoreProvider, hasLocalAccount, seedPreviewAccount } from '../store'
import { AccessProvider } from '../access'
import { onViewAsClient, viewPlan, viewingAsClient, type ViewPlan } from '../viewAs'
import { TRIAL_DAYS } from '../plans'
import type { AccessInfo } from '../platform'
import { PREVIEW_CLIENT, getPreviewRole, onPreviewRole, setPreviewRole, type PreviewRole } from '../platform'
import { PLATFORM, type PlanId } from '../plans'
import { go, useRoute } from '../router'
import { Signup } from './Signup'
import { lazy, Suspense } from 'react'
// páginas públicas e de vendas: só carregam quando alguém abre (o sistema fica mais leve)
const Landing = lazy(() => import('../pages/Landing'))
const BriefingPublic = lazy(() => import('./Briefing').then((m) => ({ default: m.BriefingPublic })))
const PortalPublic = lazy(() => import('./Studio').then((m) => ({ default: m.PortalPublic })))
const ContractSignPublic = lazy(() => import('./ContractSignPublic').then((m) => ({ default: m.ContractSignPublic })))
import { applyTheme } from '../theme'
import { EmailInput, Field } from './ui'
import { toast } from './dialog'
import { Icon } from './Icon'

/** Sem nuvem configurada: prévia local. Com nuvem: exige login (e-mail + senha).
 *  Sem login, mostra a página de vendas, o cadastro ou o login. */
export function AuthGate({ children }: { children: ReactNode }) {
  // briefing do cliente final: página pública, sem login e sem nada do sistema
  const route = useRoute()
  const wait = <div className="loading-screen" />
  if (route.page === 'briefing' && route.id) return <Suspense fallback={wait}><BriefingPublic id={route.id} /></Suspense>
  if (route.page === 'b' && route.id) return <Suspense fallback={wait}><BriefingPublic id={route.id} short /></Suspense>
  // página de acompanhamento do projeto (plano Estúdio): também sem login
  if (route.page === 'acompanhar' && route.id) return <Suspense fallback={wait}><PortalPublic token={route.id} /></Suspense>
  if (route.page === 'p' && route.id) return <Suspense fallback={wait}><PortalPublic token={route.id} short /></Suspense>
  // contrato para o cliente ler e assinar
  if (route.page === 'assinar' && route.id) return <Suspense fallback={wait}><ContractSignPublic id={route.id} /></Suspense>
  return <Gate>{children}</Gate>
}

function Gate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(CLOUD ? undefined : null)
  const [recovery, setRecovery] = useState(false)
  // "ver como cliente" (só a dona usa): conta nova de cliente, só em memória
  const [asClient, setAsClient] = useState(viewingAsClient)
  const [plan, setPlan] = useState<ViewPlan>(viewPlan)
  useEffect(
    () =>
      onViewAsClient((on) => {
        setAsClient(on)
        setPlan(viewPlan())
      }),
    [],
  )
  const clientAccess = useMemo(() => clientView(plan), [plan])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!CLOUD) return <PreviewGate>{children}</PreviewGate>
  if (session === undefined) return <div className="loading-screen" />
  if (recovery && session) return <NewPassword onDone={() => setRecovery(false)} />
  if (!session) return <PublicScreens />
  if (asClient)
    return (
      <AccessProvider key="ver-como-cliente" userId={session.user.id} override={clientAccess}>
        <StoreProvider key="ver-como-cliente" preview userEmail="voce@exemplo.com">
          {children}
        </StoreProvider>
      </AccessProvider>
    )
  return (
    <AccessProvider userId={session.user.id} plan={session.user.user_metadata?.plan as string | undefined}>
      <StoreProvider key={session.user.id} userId={session.user.id} userEmail={session.user.email ?? ''}>
        {children}
      </StoreProvider>
    </AccessProvider>
  )
}

/** Telas sem login: vendas (padrão para quem nunca entrou neste aparelho), cadastro e login. */
function PublicScreens({ onEnter, onSignup }: { onEnter?: () => void; onSignup?: (plan: PlanId) => void }) {
  const route = useRoute()
  if (route.page === 'cadastro')
    return (
      <AuthLayout>
        <Signup plan={route.id} onDone={onSignup} />
      </AuthLayout>
    )
  if (route.page === 'entrar') return <Login onEnter={onEnter} />
  if (route.page === 'vendas' || !lastBrand() || !CLOUD) return <Suspense fallback={<div className="loading-screen" />}><Landing /></Suspense>
  return <Login onEnter={onEnter} />
}

/** Prévia (Artifact): "ver como" visitante (página de vendas), cliente ou dona. */
function PreviewGate({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PreviewRole>(getPreviewRole)
  useEffect(() => onPreviewRole(setRole), [])
  const route = useRoute()
  // abrir a página de vendas pelo menu da prévia
  const visitor = role === 'visitante' || (route.page === 'vendas' && role !== 'dona')
  return (
    <>
      {visitor ? (
        <PublicScreens
          onEnter={() => {
            setPreviewRole('dona')
            go('inicio')
          }}
          onSignup={() => {
            seedPreviewAccount(PREVIEW_CLIENT)
            setPreviewRole('cliente')
            go('inicio')
          }}
        />
      ) : (
        <AccessProvider key={role} userId={role === 'cliente' ? PREVIEW_CLIENT : 'previa-dona'}>
          {role === 'cliente' ? (
            <StoreProvider key="cliente" userId={PREVIEW_CLIENT} userEmail="voce@exemplo.com">
              {children}
            </StoreProvider>
          ) : (
            <StoreProvider key="dona">{children}</StoreProvider>
          )}
        </AccessProvider>
      )}
      <PreviewSwitcher role={visitor ? 'visitante' : role} />
    </>
  )
}

function PreviewSwitcher({ role }: { role: PreviewRole }) {
  const [open, setOpen] = useState(false)
  const pick = (r: PreviewRole) => {
    setOpen(false)
    if (r === 'visitante') {
      setPreviewRole('visitante')
      go('vendas')
      return
    }
    if (r === 'cliente' && !hasLocalAccount(PREVIEW_CLIENT)) {
      // conta de cliente fictícia, já com dados de exemplo
      try {
        localStorage.setItem(SIGNUP_KEY, JSON.stringify({ name: 'Ana', studio: 'estúdio exemplo', demo: true }))
      } catch {
        /* ok */
      }
      seedPreviewAccount(PREVIEW_CLIENT)
    }
    setPreviewRole(r)
    go('inicio')
  }
  const labels: Record<PreviewRole, string> = { visitante: 'página de vendas', cliente: 'cliente (teste grátis)', dona: 'dona (Laís)' }
  return (
    <div className={`pf-preview ${open ? 'is-open' : ''}`}>
      {open && (
        <div className="pf-preview-menu" role="menu">
          <small className="muted">prévia · ver como</small>
          {(Object.keys(labels) as PreviewRole[]).map((r) => (
            <button key={r} role="menuitemradio" aria-checked={role === r} className={role === r ? 'active' : ''} onClick={() => pick(r)}>
              <Icon name={r === 'visitante' ? 'star' : r === 'cliente' ? 'user' : 'crown'} size={15} /> {labels[r]}
            </button>
          ))}
        </div>
      )}
      <button className="pf-preview-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Trocar o que a prévia mostra">
        <Icon name="eye" size={15} /> <span>prévia · {labels[role]}</span>
      </button>
    </div>
  )
}

/** Acesso de uma conta de cliente para o "ver como cliente": teste grátis do Completo ou um plano já ativo. */
const clientView = (v: ViewPlan): AccessInfo => ({
  role: 'cliente',
  legacy: false,
  sub: {
    userId: 'ver-como-cliente',
    email: 'voce@exemplo.com',
    name: 'Ana',
    studio: 'estúdio exemplo',
    plan: v === 'trial' ? 'completo' : v,
    status: v === 'trial' ? 'trial' : 'ativa',
    trialEnds: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(),
    blocked: false,
    canceledAt: null,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    requestedPlan: null,
    requestedAt: null,
    requestedCycle: null,
    testMode: true,
  },
})

export const signOut = () => supabase?.auth.signOut()

/** Neste aparelho, guarda o nome do último estúdio que entrou (quem já entrou vai direto para o login). */
export const BRAND_KEY = 'ultima-marca'
const lastBrand = () => {
  try {
    return localStorage.getItem(BRAND_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

function AuthLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme(DEFAULT_SETTINGS)
  }, [])
  return (
    <div className="auth">
      <aside className="auth-art">
        <div className="auth-art-inner">
          <span className="brand-name">
            {PLATFORM.name}
            <i>.</i>
          </span>
          <h2>
            seu estúdio,
            <br />
            <em>mais leve</em>
          </h2>
          <p>Clientes, orçamentos, prazos, contratos e pagamentos num lugar só, no celular e no computador.</p>
        </div>
      </aside>
      <main className="auth-form">
        <div className="auth-box">{children}</div>
      </main>
    </div>
  )
}

function Login({ onEnter }: { onEnter?: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [show, setShow] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    // prévia: não há login de verdade; entra como a dona
    if (!CLOUD) return onEnter?.()
    setBusy(true)
    if (forgot) {
      const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname })
      setBusy(false)
      if (error) {
        const m = error.message.toLowerCase()
        return setError(
          m.includes('rate') || m.includes('seconds') || m.includes('security purposes')
            ? 'Você pediu há pouco. Espere 1 minuto e tente de novo.'
            : m.includes('not authorized') || m.includes('smtp') || m.includes('sending')
              ? 'O envio de e-mails ainda não foi configurado. Fale com o suporte pelo chat.'
              : 'Não foi possível enviar agora. Confira o e-mail e tente de novo.',
        )
      }
      toast('Enviamos um link para criar uma nova senha. Confira seu e-mail.')
      setForgot(false)
      return
    }
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Verifique sua conexão.')
  }

  return (
    <AuthLayout>
      <div>
        <p className="eyebrow">área restrita</p>
        <h1>
          {forgot ? (
            <>
              nova <em>senha</em>
            </>
          ) : (
            <>
              bem-vinda <em>de volta</em>
            </>
          )}
        </h1>
      </div>
      <form onSubmit={submit}>
        <Field label="E-mail">
          <EmailInput id="login-email" value={email} onChange={setEmail} />
        </Field>
        {!forgot && (
          <Field label="Senha">
            <div className="pw-field">
              <input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password" required={CLOUD} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="icon-btn subtle" onClick={() => setShow(!show)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'}>
                <Icon name={show ? 'eye-off' : 'eye'} size={17} />
              </button>
            </div>
          </Field>
        )}
        {error && <p className="auth-error">{error}</p>}
        <button className="btn primary auth-submit" disabled={busy}>
          {busy ? 'aguarde…' : forgot ? 'enviar link por e-mail' : 'entrar'}
          {!busy && <Icon name="chevronR" size={16} />}
        </button>
        <button type="button" className="link" onClick={() => (setForgot(!forgot), setError(''))}>
          {forgot ? '← voltar para o login' : 'esqueci minha senha'}
        </button>
      </form>
      <p className="muted small">Você continua conectada neste aparelho até sair pelo perfil.</p>
      {!CLOUD && <p className="pf-note">Prévia: não precisa de senha, “entrar” abre o sistema como a dona.</p>}
      <p className="small">
        ainda não tem conta?{' '}
        <button type="button" className="link" onClick={() => go('cadastro')}>
          testar grátis
        </button>{' '}
        ·{' '}
        <button type="button" className="link" onClick={() => go('vendas')}>
          conhecer o {PLATFORM.name}
        </button>
      </p>
    </AuthLayout>
  )
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use pelo menos 8 caracteres.')
    const { error } = await supabase!.auth.updateUser({ password })
    if (error) return setError('Não foi possível trocar a senha. Peça um novo link.')
    toast('Senha alterada.')
    onDone()
  }
  return (
    <AuthLayout>
      <h1>
        crie sua <em>nova senha</em>
      </h1>
      <form onSubmit={submit}>
        <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
          <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn primary">salvar senha</button>
      </form>
    </AuthLayout>
  )
}
