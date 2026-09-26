import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CLOUD, supabase } from '../cloud'
import { DEFAULT_SETTINGS, StoreProvider } from '../store'
import { applyTheme } from '../theme'
import { Field } from './ui'
import { toast } from './dialog'
import { Icon } from './Icon'

/** Sem nuvem configurada: sistema local. Com nuvem: exige login (e-mail + senha). */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(CLOUD ? undefined : null)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!CLOUD) return <StoreProvider>{children}</StoreProvider>
  if (session === undefined) return <div className="loading-screen" />
  if (recovery && session) return <NewPassword onDone={() => setRecovery(false)} />
  if (!session) return <Login />
  return (
    <StoreProvider key={session.user.id} userId={session.user.id} userEmail={session.user.email ?? ''}>
      {children}
    </StoreProvider>
  )
}

export const signOut = () => supabase?.auth.signOut()

/** Marca exibida no login (antes de saber quem está entrando). Troque aqui ao comercializar. */
const PRODUCT = { name: 'laís', line1: 'você projeta,', line2: 'a gente cuida da produção' }

const hello = () => {
  const h = new Date().getHours()
  return h < 12 ? 'bom dia' : h < 18 ? 'boa tarde' : 'boa noite'
}

function AuthLayout({ children }: { children: ReactNode }) {
  useEffect(() => applyTheme(DEFAULT_SETTINGS), [])
  return (
    <div className="auth">
      <aside className="auth-art" aria-hidden>
        <div className="auth-grid" />
        <svg className="auth-house" viewBox="0 0 400 300" fill="none">
          <path d="M40 250 L40 140 L200 60 L360 140 L360 250 Z" />
          <path d="M40 140 L200 220 L360 140 M200 220 L200 300" />
          <path d="M110 176 L110 236 L160 260 L160 200 Z M240 200 L240 260 L300 232 L300 172 Z" />
          <path d="M200 60 L200 20" strokeDasharray="4 6" />
        </svg>
        <span className="auth-brand">
          {PRODUCT.name}
          <i>.</i>
        </span>
        <div className="auth-cards">
          <div className="auth-card c1">
            <small>proposta #014</small>
            <b>aprovada · R$ 2.400,00</b>
          </div>
          <div className="auth-card c2">
            <small>sinal recebido</small>
            <b>
              <span className="ok">✓</span> R$ 1.200,00
            </b>
          </div>
          <div className="auth-card c3">
            <small>entrega amanhã</small>
            <b>suíte master — casa vila</b>
          </div>
        </div>
        <div className="auth-copy">
          <h2>
            <em>{PRODUCT.line1}</em>
            <br />
            {PRODUCT.line2}
          </h2>
          <p>clientes · demandas · orçamentos · financeiro · agenda</p>
        </div>
      </aside>
      <main className="auth-form">
        <div className="auth-box">{children}</div>
        <p className="auth-foot">
          <Icon name="check" size={13} /> acesso protegido · seus dados ficam na nuvem e aparecem em qualquer aparelho
        </p>
      </main>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [show, setShow] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    if (forgot) {
      const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname })
      setBusy(false)
      if (error) return setError('Não foi possível enviar agora. Confira o e-mail e tente de novo.')
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
        <p className="eyebrow">{hello()}</p>
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
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {!forgot && (
          <Field label="Senha">
            <div className="pw-field">
              <input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
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
