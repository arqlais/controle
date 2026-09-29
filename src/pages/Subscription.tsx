import { useEffect, useState } from 'react'
import { signOut } from '../components/Auth'
import { BillingFields, billingMissing, validDoc } from './Checkout'
import type { Billing } from '../platform'
import { useAccess } from '../access'
import { Icon } from '../components/Icon'
import { Badge, Section } from '../components/ui'
import { ask, toast } from '../components/dialog'
import { PLANS, PLAN_LIST, PLATFORM, STATUS_LABEL, TRIAL_DAYS, money0, type PlanId } from '../plans'
import { platform, trialDaysLeft, trialOver } from '../platform'
import { go, href } from '../router'
import { download, today } from '../utils'
import { useStore } from '../store'

/* "Minha assinatura": plano, teste grátis e troca de plano (em modo teste, sem cobrança). */

export default function SubscriptionPage({ onChat }: { onChat: () => void }) {
  const access = useAccess()
  const sub = access.sub
  const [busy, setBusy] = useState(false)
  const { userId } = useStore()
  if (access.isOwner)
    return (
      <div className="page">
        <Section title="sua conta">
          <p className="muted">Você é a dona da plataforma: tem tudo liberado e não paga assinatura. Os assinantes ficam no painel da plataforma.</p>
          <a className="btn primary" href={href('plataforma')}>
            <Icon name="crown" size={16} /> abrir painel
          </a>
        </Section>
      </div>
    )
  const left = trialDaysLeft(sub)
  // teste: troca o plano testado · assinar: vira um pedido, e quem libera é a administração
  const tryPlan = async (plan: PlanId) => {
    if (!(await ask(`Testar o plano ${PLANS[plan].name}? Você continua no teste grátis até o fim do prazo.`, { confirmLabel: 'Trocar plano' }))) return
    setBusy(true)
    try {
      await platform.choosePlan(plan)
      await access.refresh()
      toast(`Agora você está testando o plano ${PLANS[plan].name}.`)
    } catch {
      toast('Não foi possível trocar agora. Tente de novo ou fale com a gente no chat.')
    }
    setBusy(false)
  }
  // assinar: tela de compra (dados, endereço, pagamento) → vira pedido que a administração libera
  const request = (plan: PlanId) => go('assinatura', plan)
  // Estúdio: sob convite. O pedido vai pelo chat e a administração libera no painel.
  const askInvite = async (plan: PlanId) => {
    setBusy(true)
    const text = `oi! quero conhecer o plano ${PLANS[plan].name} ✨`
    try {
      await platform.send(userId || '', text, false)
      void platform.notice({ tipo: 'mensagem', text }).catch(() => undefined)
      localStorage.setItem(`convite-${plan}`, today())
      toast(`Pedido enviado! O ${PLATFORM.support} responde pelo chat e libera o ${PLANS[plan].name} para você.`)
    } catch {
      toast('Não foi possível enviar agora. Fale com a gente pelo chat.')
    }
    setBusy(false)
  }
  const invited = (plan: PlanId) => {
    try {
      return !!localStorage.getItem(`convite-${plan}`)
    } catch {
      return false
    }
  }
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">sua conta</p>
          <h1>
            minha <em>assinatura</em>
          </h1>
        </div>
      </div>
      <p className="pf-note">
        <Icon name="alert" size={16} />
        <span>
          <b>Como assinar:</b> toque em “assinar”, preencha seus dados e a forma de pagamento. O {PLATFORM.support} confirma o pagamento com você e libera a sua conta. Nada é cobrado automaticamente.
        </span>
      </p>
      {sub && (
        <Section title="seu plano">
          <div className="pf-current">
            <div>
              <span className="pf-current-name">{PLANS[sub.plan].name}</span>
              <span className="muted"> · {money0(PLANS[sub.plan].price)}/mês</span>
            </div>
            <Badge color={sub.status === 'ativa' ? '#5e8c6a' : sub.status === 'trial' ? '#6b8f94' : '#b98246'}>{STATUS_LABEL[sub.status]}</Badge>
          </div>
          {sub.requestedPlan && (
            <p className="pf-note is-warn">
              <Icon name="clock" size={16} />
              <span>
                Pedido de assinatura do plano <b>{PLANS[sub.requestedPlan].name}</b> enviado{sub.requestedAt ? ` em ${new Date(sub.requestedAt).toLocaleDateString('pt-BR')}` : ''}. Aguardando a liberação do {PLATFORM.support}.
              </span>
            </p>
          )}
          {sub.status === 'trial' && (
            <>
              <div className="pf-trial-bar" aria-label={`${Math.max(0, left)} de ${TRIAL_DAYS} dias`}>
                <i style={{ width: `${Math.min(100, Math.max(0, ((TRIAL_DAYS - left) / TRIAL_DAYS) * 100))}%` }} />
              </div>
              <p className="muted small">{trialOver(sub) ? 'Seu teste grátis terminou. Assine um plano para continuar usando.' : `Faltam ${left} dia(s) do teste grátis (até ${new Date(sub.trialEnds).toLocaleDateString('pt-BR')}).`}</p>
            </>
          )}
        </Section>
      )}
      <div className="pf-plan-cards">
        {PLAN_LIST.map((p) => {
          const current = sub?.plan === p.id
          return (
            <article key={p.id} className={`card pf-plan ${current ? 'is-current' : ''} ${p.featured ? 'is-featured' : ''}`}>
              <header>
                <h3>{p.name}</h3>
                {current ? <Badge color="#3e4b57">seu plano</Badge> : p.inviteOnly && <Badge color="#a88a80">sob convite</Badge>}
              </header>
              <p className="pf-price">
                {money0(p.price)}
                <small>/mês</small>
              </p>
              <p className="muted small">{p.pitch}</p>
              <ul className="pf-checks">
                {p.highlights.map((h) => (
                  <li key={h}>
                    <Icon name="check" size={14} /> {h}
                  </li>
                ))}
              </ul>
              <div className="stack-s">
                {sub?.status === 'ativa' && current ? (
                  <p className="muted small center">plano ativo ✓</p>
                ) : sub?.requestedPlan === p.id ? (
                  <p className="muted small center">pedido enviado · aguardando liberação</p>
                ) : p.inviteOnly && !current ? (
                  invited(p.id) ? (
                    <p className="muted small center">pedido enviado · a gente responde pelo chat</p>
                  ) : (
                    <button className="btn block" disabled={busy || sub?.blocked} onClick={() => void askInvite(p.id)}>
                      <Icon name="star" size={15} /> pedir acesso
                    </button>
                  )
                ) : (
                  <button className="btn primary block" disabled={busy || sub?.blocked} onClick={() => request(p.id)}>
                    {sub?.status === 'ativa' ? `trocar para o ${p.name}` : `assinar o ${p.name}`}
                  </button>
                )}
                {!current && !p.inviteOnly && sub?.status === 'trial' && !trialOver(sub) && (
                  <button className="btn ghost block" disabled={busy} onClick={() => void tryPlan(p.id)}>
                    testar este plano
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <MyBilling />
      <CloseAccount />
      <Section title="precisa de ajuda?">
        <p className="muted small">Dúvidas sobre o sistema, sugestões ou problemas: fale direto com a gente pelo chat.</p>
        <button className="btn" onClick={onChat}>
          <Icon name="chat" size={16} /> conversar com {PLATFORM.supportWith}
        </button>
      </Section>
    </div>
  )
}

/** Aviso no topo durante o teste grátis (e quando ele termina). */
export function TrialBanner() {
  const { sub, isOwner } = useAccess()
  if (isOwner || !sub || sub.status !== 'trial') return null
  const left = trialDaysLeft(sub)
  return (
    <div className={`demo-banner pf-trial-banner ${left <= 3 ? 'is-urgent' : ''}`}>
      <span>
        {left > 0 ? (
          <>
            <b>Teste grátis:</b> faltam {left} dia(s) · plano {PLANS[sub.plan].name}
          </>
        ) : (
          <>
            <b>Seu teste grátis terminou.</b> Peça a assinatura para continuar.
          </>
        )}
      </span>
      <a className="btn small" href={href('assinatura')}>
        ver planos
      </a>
    </div>
  )
}

/** Conta bloqueada pela dona (ou teste encerrado): dados preservados, só a leitura do aviso + chat + backup. */
export function BlockedScreen({ onChat }: { onChat: () => void }) {
  const { data } = useStore()
  const { sub } = useAccess()
  const expired = trialOver(sub)
  if (sub?.deletedAt)
    return (
      <div className="page">
        <section className="card pf-blocked">
          <Icon name="lock" size={30} />
          <h1>
            conta <em>apagada</em>
          </h1>
          <p className="muted">Você apagou esta conta e os dados do sistema foram removidos. Se quiser voltar, crie uma conta nova com outro e-mail ou fale com a gente.</p>
          <div className="row gap-s wrap center">
            <button className="btn" onClick={onChat}>
              <Icon name="chat" size={16} /> conversar com {PLATFORM.supportWith}
            </button>
            <button className="btn ghost" onClick={() => signOut()}>
              sair
            </button>
          </div>
        </section>
      </div>
    )
  return (
    <div className="page">
      <section className="card pf-blocked">
        <Icon name="lock" size={30} />
        <h1>
          {expired ? (
            <>
              seu teste <em>terminou</em>
            </>
          ) : (
            <>
              conta <em>pausada</em>
            </>
          )}
        </h1>
        <p className="muted">
          {expired
            ? 'Para continuar usando, peça a assinatura de um plano. Seus dados estão guardados e nada foi apagado.'
            : `Seu acesso está pausado no momento. Seus dados estão guardados e nada foi apagado. Fale com ${PLATFORM.supportWith} pelo chat para resolver.`}
        </p>
        <div className="row gap-s wrap center">
          {expired && (
            <a className="btn primary" href={href('assinatura')}>
              pedir assinatura
            </a>
          )}
          <button className="btn" onClick={onChat}>
            <Icon name="chat" size={16} /> conversar com {PLATFORM.supportWith}
          </button>
          <button className="btn ghost" onClick={() => download(`backup-${today()}.json`, JSON.stringify(data, null, 2))}>
            <Icon name="download" size={16} /> baixar meus dados
          </button>
        </div>
      </section>
    </div>
  )
}

/** Meus dados de cobrança: a pessoa confere e corrige (os mesmos que a dona vê no painel). */
function MyBilling() {
  const [b, setB] = useState<Billing | null>(null)
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    platform.myBilling().then(setB).catch(() => undefined)
  }, [])
  if (!b) return null
  const set = (patch: Partial<Billing>) => setB((x) => (x ? { ...x, ...patch } : x))
  const missing = billingMissing(b)
  return (
    <Section
      title="meus dados"
      action={
        !edit && (
          <button className="btn small" onClick={() => setEdit(true)}>
            <Icon name="edit" size={14} /> corrigir
          </button>
        )
      }
    >
      {edit ? (
        <>
          <BillingFields part="dados" b={b} set={set} docOk={validDoc(b.doc)} />
          <BillingFields part="endereco" b={b} set={set} docOk={validDoc(b.doc)} />
          {missing.length > 0 && <p className="text-bad small">Falta: {missing.join(', ')}.</p>}
          <div className="row gap-s">
            <button
              className="btn primary"
              disabled={busy || missing.length > 0}
              onClick={async () => {
                setBusy(true)
                try {
                  await platform.saveBilling(null, b)
                  toast('Dados atualizados.')
                  setEdit(false)
                } catch {
                  toast('Não foi possível salvar agora. Tente de novo.')
                }
                setBusy(false)
              }}
            >
              salvar
            </button>
            <button className="btn ghost" onClick={() => (setEdit(false), void platform.myBilling().then(setB))}>
              cancelar
            </button>
          </div>
        </>
      ) : (
        <p className="muted small">
          {b.fullName} · {b.doc} · {b.phone} · {b.email}
          <br />
          {[b.address, b.number, b.complement].filter(Boolean).join(', ')} · {b.city}
        </p>
      )}
    </Section>
  )
}

/** Encerrar a conta: desativar (tudo guardado, dá para voltar) ou apagar de vez. */
function CloseAccount() {
  const access = useAccess()
  const { data } = useStore()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (apagar: boolean) => {
    setBusy(true)
    try {
      await platform.closeAccount(apagar)
      if (apagar) {
        toast('Conta apagada.')
        await signOut()
      } else {
        toast('Conta desativada. Seus dados continuam guardados.')
        await access.refresh()
      }
    } catch {
      toast('Não foi possível agora. Tente de novo ou fale com a gente no chat.')
    }
    setBusy(false)
  }
  return (
    <Section title="encerrar conta">
      {!open ? (
        <>
          <p className="muted small">Quer dar uma pausa ou sair do {PLATFORM.name}? Você pode desativar (tudo fica guardado) ou apagar a conta.</p>
          <button className="btn ghost small" onClick={() => setOpen(true)}>
            ver opções
          </button>
        </>
      ) : (
        <div className="close-account">
          <div className="close-opt">
            <b>desativar minha conta</b>
            <p className="muted small">A assinatura para e ninguém cobra nada. Seus clientes, orçamentos e o financeiro ficam guardados: é só pedir para voltar quando quiser.</p>
            <button className="btn small" disabled={busy} onClick={async () => (await ask('Desativar sua conta? Seus dados continuam guardados e dá para voltar quando quiser.', { confirmLabel: 'Desativar' })) && run(false)}>
              desativar
            </button>
          </div>
          <div className="close-opt is-danger">
            <b>apagar minha conta</b>
            <p className="muted small">Apaga de vez os dados do sistema (clientes, orçamentos, demandas, financeiro). Não dá para desfazer. Antes, se quiser, baixe uma cópia.</p>
            <button className="btn ghost small" onClick={() => download(`backup-${today()}.json`, JSON.stringify(data, null, 2))}>
              <Icon name="download" size={14} /> baixar meus dados
            </button>
            <label className="field">
              <span className="field-label">para confirmar, escreva APAGAR</span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="APAGAR" autoCapitalize="characters" />
            </label>
            <button className="btn danger small" disabled={busy || typed.trim().toUpperCase() !== 'APAGAR'} onClick={() => void run(true)}>
              apagar minha conta
            </button>
          </div>
          <button className="link small" onClick={() => (setOpen(false), setTyped(''))}>
            deixa para lá
          </button>
        </div>
      )}
    </Section>
  )
}
