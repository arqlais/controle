import { useState, type FormEvent } from 'react'
import { Icon } from './Icon'
import { EmailInput, Field } from './ui'
import { PLAN_LIST, PLANS, PLATFORM, TRIAL_DAYS, money0, type PlanId } from '../plans'
import { signUp } from '../platform'
import { SIGNUP_KEY } from '../store'
import { go } from '../router'
import { CLOUD } from '../cloud'

/* Cadastro: escolher plano → criar conta → entra no sistema em teste grátis. */

export function Signup({ plan: initial, onDone }: { plan?: string; onDone?: (plan: PlanId) => void }) {
  const [plan, setPlan] = useState<PlanId>(initial === 'completo' || initial === 'essencial' ? initial : 'completo')
  const [name, setName] = useState('')
  const [studio, setStudio] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [demo, setDemo] = useState(true)
  const [agree, setAgree] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Coloque seu nome.')
    if (CLOUD && password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (!agree) return setError('Marque que você entendeu que esta é uma versão de teste.')
    setBusy(true)
    try {
      localStorage.setItem(SIGNUP_KEY, JSON.stringify({ name: name.trim(), studio: studio.trim(), demo }))
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
      <div>
        <p className="eyebrow">{TRIAL_DAYS} dias grátis · sem cartão</p>
        <h1>
          crie sua <em>conta</em>
        </h1>
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <span className="field-label">plano para testar</span>
          <div className="pf-plan-pick">
            {PLAN_LIST.map((p) => (
              <button type="button" key={p.id} className={`pf-plan-opt ${plan === p.id ? 'active' : ''}`} onClick={() => setPlan(p.id)} aria-pressed={plan === p.id}>
                <b>{p.name}</b>
                <span>{money0(p.price)}/mês</span>
                <small>{p.id === 'completo' ? 'com contratos' : 'o essencial'}</small>
              </button>
            ))}
          </div>
          <span className="field-hint">Durante o teste você usa tudo do {PLANS[plan].name}. Dá para trocar depois.</span>
        </div>
        <Field label="Seu nome">
          <input id="signup-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Ribeiro" />
        </Field>
        <Field label="Nome do estúdio (opcional)">
          <input id="signup-studio" autoComplete="organization" value={studio} onChange={(e) => setStudio(e.target.value)} placeholder="Ribeiro Arquitetura" />
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
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> começar com dados de exemplo para explorar (dá para apagar depois)
        </label>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> entendo que esta é uma versão de teste da plataforma, sem cobrança
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
      <p className="muted small">
        Ao criar a conta, seus dados ficam só na sua conta: ninguém mais vê seus clientes e valores. Dúvidas? Tem chat com a {PLATFORM.owner} lá dentro.
      </p>
    </div>
  )
}
