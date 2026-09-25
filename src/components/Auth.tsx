import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CLOUD, supabase } from '../cloud'
import { DEFAULT_SETTINGS, StoreProvider } from '../store'
import { applyTheme } from '../theme'
import { Field } from './ui'
import { toast } from './dialog'

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

function AuthLayout({ children }: { children: ReactNode }) {
  useEffect(() => applyTheme(DEFAULT_SETTINGS), [])
  return (
    <div className="auth">
      <aside className="auth-art">
        <span className="brand-name">
          laís<i>.</i>
        </span>
        <h2>
          <em>você projeta,</em>
          <br />
          eu cuido da produção
        </h2>
        <p>Clientes, demandas, prazos, orçamentos e financeiro do estúdio — num só lugar, em qualquer aparelho.</p>
      </aside>
      <main className="auth-form">{children}</main>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)

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
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {!forgot && (
          <Field label="Senha">
            <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {error && <p className="auth-error">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? 'aguarde…' : forgot ? 'enviar link por e-mail' : 'entrar'}
        </button>
        <button type="button" className="link" onClick={() => (setForgot(!forgot), setError(''))}>
          {forgot ? '← voltar para o login' : 'esqueci minha senha'}
        </button>
      </form>
      <p className="muted small">Você continua conectada neste aparelho até clicar em “sair”.</p>
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
