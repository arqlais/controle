import { useState, type FormEvent } from 'react'
import { Icon } from './Icon'
import { EmailInput, Field } from './ui'
import { ACCESS_CFG, PLANS, PLATFORM, TRIAL_DAYS, type PlanId } from '../plans'
import { TermsModal } from './Terms'
import { signUp } from '../platform'
import { SIGNUP_KEY } from '../store'
import { go } from '../router'
import { CLOUD, supabase } from '../cloud'
import { WORK_PROFILES } from '../clientDefaults'
import type { WorkProfile } from '../types'

/** A escolha feita na página de vendas ("sou freelancer" / "atendo cliente final") já vem marcada. */
export const LANDING_PROFILE_KEY = 'vendas-perfil'
/** Estúdio escolhido na página de vendas: depois do cadastro, o pedido de acesso vai sozinho pelo chat. */
export const INVITE_KEY = 'vendas-convite'
/** Código do convite que veio no link (?convite=…): fica guardado até o cadastro. */
const INVITE_CODE_KEY = 'convite-codigo'
export const inviteFromUrl = () => {
  try {
    const c = new URLSearchParams(location.search).get('convite')
    if (c) sessionStorage.setItem(INVITE_CODE_KEY, c)
    return c || sessionStorage.getItem(INVITE_CODE_KEY) || ''
  } catch {
    return ''
  }
}

/** Entrar ou criar conta com o Google (volta para o planê já logada). */
export async function googleLogin() {
  const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } })
  if (error) throw error
}

export function GoogleButton({ onClick, label = 'continuar com Google', busy }: { onClick: () => void; label?: string; busy?: boolean }) {
  return (
    <button type="button" className="btn ghost auth-google" onClick={onClick} disabled={busy}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Zm-5.6-8a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z" />
      </svg>
      {label}
    </button>
  )
}

const landingProfile = (): WorkProfile | '' => {
  try {
    const v = localStorage.getItem(LANDING_PROFILE_KEY)
    return v === 'final' || v === 'freelancer' || v === 'ambos' ? v : ''
  } catch {
    return ''
  }
}

/* Cadastro: criar conta → entra no sistema com o teste grátis do plano Completo.
   Só continua quem aceita os termos de uso e o contrato de assinatura. */

export function Signup({ onDone }: { plan?: string; onDone?: (plan: PlanId) => void }) {
  const plan: PlanId = 'completo' // o teste é sempre do Completo; o plano é escolhido na assinatura
  const [terms, setTerms] = useState(false)
  const [name, setName] = useState('')
  const [studio, setStudio] = useState('')
  const [profile, setProfile] = useState<WorkProfile | ''>(landingProfile)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // conta nova começa vazia (o exemplo continua disponível no "ver exemplo" dos primeiros passos)
  const demo = false
  const [agree, setAgree] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState(inviteFromUrl)
  const inviteOk = !ACCESS_CFG.invite || (!!ACCESS_CFG.inviteCode && code.trim().toLowerCase() === ACCESS_CFG.inviteCode.toLowerCase())
  // o que vale para os dois jeitos de criar conta (e-mail ou Google)
  const check = () => {
    if (!inviteOk) return 'O planê está em lançamento fechado: coloque o código do seu convite.'
    if (!name.trim()) return 'Coloque seu nome.'
    if (!profile) return 'Conte como você trabalha: assim o sistema já vem pronto para você.'
    if (!agree) return 'Para continuar, leia e aceite os termos de uso e o contrato de assinatura.'
    return ''
  }
  const remember = () => {
    try {
      localStorage.setItem(SIGNUP_KEY, JSON.stringify({ name: name.trim(), studio: studio.trim(), demo, profile }))
    } catch {
      /* ok */
    }
  }
  const withGoogle = async () => {
    const msg = check()
    if (msg) return setError(msg)
    setBusy(true)
    remember()
    try {
      await googleLogin()
    } catch {
      setBusy(false)
      setError('Não foi possível entrar com o Google agora. Use e-mail e senha.')
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const msg = check() || (CLOUD && password.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : '')
    if (msg) return setError(msg)
    setBusy(true)
    remember()
    try {
      const r = await signUp({ email: email.trim(), password, name: name.trim(), studio: studio.trim(), plan })
      if (r.needsConfirm) setSent(true)
      else onDone?.(plan)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(/registered|already/i.test(msg) ? 'Esse e-mail já tem conta. Use “entrar”.' : /signups? not allowed|disabled/i.test(msg) ? 'Os cadastros ainda não estão abertos. Tente de novo em breve.' : 'Não foi possível criar a conta agora. Confira os dados e a internet.')
    }
    setBusy(false)
  }

  if (sent)
    return (
      <div className="auth-box">
        <p className="eyebrow">quase lá</p>
        <h1>
          confira seu <em>e-mail</em>
        </h1>
        <p className="muted">
          Enviamos um link para <b>{email}</b>. Abra o e-mail e toque no link para ativar sua conta; depois é só entrar. Não chegou? Veja a caixa de spam.
        </p>
        <button className="btn primary" onClick={() => go('entrar')}>
          ir para o login
        </button>
      </div>
    )

  return (
    <div className="auth-box pf-signup">
      <button type="button" className="link su-back" onClick={() => go('vendas')}>
        <Icon name="chevronL" size={14} /> voltar para a página inicial
      </button>
      <div>
        <p className="eyebrow">{TRIAL_DAYS} dias grátis · sem cartão</p>
        <h1>
          crie sua <em>conta</em>
        </h1>
      </div>
      <form onSubmit={submit}>
        <div className="su-trial">
          <Icon name="star" size={18} />
          <span>
            <b>
              {TRIAL_DAYS} dias do plano {PLANS.estudio.name} grátis
            </b>
            <small>tudo liberado, sem cartão. No fim, você escolhe o plano.</small>
          </span>
        </div>
        {ACCESS_CFG.invite && (
          <Field label="Código do convite" hint="Veio junto com o link do convite.">
            <input id="signup-invite" value={code} onChange={(e) => setCode(e.target.value.trim())} autoCapitalize="none" autoCorrect="off" />
          </Field>
        )}
        <Field label="Seu nome">
          <input id="signup-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Ribeiro" />
        </Field>
        <Field label="Nome do estúdio (opcional)">
          <input id="signup-studio" autoComplete="organization" value={studio} onChange={(e) => setStudio(e.target.value)} placeholder="Ribeiro Arquitetura" />
        </Field>
        <Field group label="Como você trabalha?">
          <div className="wp-options compact" role="radiogroup">
            {WORK_PROFILES.map((w) => (
              <button key={w.value} type="button" role="radio" aria-checked={profile === w.value} className={`wp-option ${profile === w.value ? 'is-on' : ''}`} onClick={() => setProfile(w.value)} data-profile={w.value}>
                <b>{w.label}</b>
                <small>{w.hint}</small>
              </button>
            ))}
          </div>
        </Field>
        <Field label="E-mail">
          <EmailInput id="signup-email" value={email} onChange={setEmail} />
        </Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres.">
          <div className="pw-field">
            <input id="signup-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="icon-btn subtle" onClick={() => setShow(!show)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'}>
              <Icon name={show ? 'eye-off' : 'eye'} size={17} />
            </button>
          </div>
        </Field>
        <label className="check">
          <input id="signup-terms" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            li e aceito os{' '}
            <button type="button" className="link" onClick={(e) => (e.preventDefault(), setTerms(true))}>
              termos de uso e o contrato de assinatura
            </button>
          </span>
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn primary auth-submit" disabled={busy}>
          {busy ? 'criando…' : `começar meu teste grátis`}
          {!busy && <Icon name="chevronR" size={16} />}
        </button>
        {ACCESS_CFG.google && CLOUD && (
          <>
            <p className="auth-or muted small">ou</p>
            <GoogleButton onClick={() => void withGoogle()} busy={busy} label="criar conta com o Google" />
          </>
        )}
        <button type="button" className="link" onClick={() => go('entrar')}>
          já tenho conta → entrar
        </button>
      </form>
      {terms && <TermsModal who={{ name, email }} onClose={() => setTerms(false)} onAccept={() => setAgree(true)} />}
      <p className="muted small">
        Ao criar a conta, seus dados ficam só na sua conta: ninguém mais vê seus clientes e valores. Dúvidas? Tem chat direto com {PLATFORM.supportWith} lá dentro.
      </p>
    </div>
  )
}
