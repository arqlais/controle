import { useState, type FormEvent } from 'react'
import { Icon } from './Icon'
import { EmailInput, Field } from './ui'
import { PLANS, PLATFORM, TRIAL_DAYS, type PlanId } from '../plans'
import { TermsModal } from './Terms'
import { signUp } from '../platform'
import { SIGNUP_KEY } from '../store'
import { go } from '../router'
import { CLOUD } from '../cloud'
import { WORK_PROFILES } from '../clientDefaults'
import { isBeta } from '../beta'
import type { WorkProfile } from '../types'

/** A escolha feita na página de vendas ("sou freelancer" / "atendo cliente final") já vem marcada. */
export const LANDING_PROFILE_KEY = 'vendas-perfil'
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
  const beta = isBeta() // a pergunta "como você trabalha" ainda está em teste
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // conta nova começa vazia (o exemplo continua disponível no "ver exemplo" dos primeiros passos)
  const demo = false
  const [agree, setAgree] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Coloque seu nome.')
    if (beta && !profile) return setError('Conte como você trabalha: assim o sistema já vem pronto para você.')
    if (CLOUD && password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (!agree) return setError('Para continuar, leia e aceite os termos de uso e o contrato de assinatura.')
    setBusy(true)
    try {
      localStorage.setItem(SIGNUP_KEY, JSON.stringify({ name: name.trim(), studio: studio.trim(), demo, profile: beta ? profile : '' }))
    } catch {
      /* ok */
    }
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
              {TRIAL_DAYS} dias do plano {PLANS.completo.name} grátis
            </b>
            <small>tudo liberado, sem cartão. No fim, você escolhe o plano.</small>
          </span>
        </div>
        <Field label="Seu nome">
          <input id="signup-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Ribeiro" />
        </Field>
        <Field label="Nome do estúdio (opcional)">
          <input id="signup-studio" autoComplete="organization" value={studio} onChange={(e) => setStudio(e.target.value)} placeholder="Ribeiro Arquitetura" />
        </Field>
        {beta && (
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
        )}
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
