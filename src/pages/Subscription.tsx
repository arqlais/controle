import { useState } from 'react'
import { useAccess } from '../access'
import { Icon } from '../components/Icon'
import { Badge, Section } from '../components/ui'
import { ask, toast } from '../components/dialog'
import { PLANS, PLAN_LIST, PLATFORM, STATUS_LABEL, TRIAL_DAYS, money0, type PlanId } from '../plans'
import { platform, trialDaysLeft, trialOver } from '../platform'
import { href } from '../router'
import { download, today } from '../utils'
import { useStore } from '../store'

/* "Minha assinatura": plano, teste grátis e troca de plano (em modo teste, sem cobrança). */

export default function SubscriptionPage({ onChat }: { onChat: () => void }) {
  const access = useAccess()
  const sub = access.sub
  const [busy, setBusy] = useState(false)
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
  const choose = async (plan: PlanId, subscribe: boolean) => {
    const p = PLANS[plan]
    const msg = subscribe
      ? `Assinar o plano ${p.name} (${money0(p.price)}/mês)? Nesta versão de teste não há cobrança: a assinatura fica ativa em modo teste.`
      : `Trocar para o plano ${p.name}? Você continua no teste grátis até o fim do prazo.`
    if (!(await ask(msg, { confirmLabel: subscribe ? 'Assinar (modo teste)' : 'Trocar plano' }))) return
    setBusy(true)
    try {
      await platform.choosePlan(plan, subscribe)
      await access.refresh()
      toast(subscribe ? `Plano ${p.name} ativo (modo teste, sem cobrança).` : `Agora você está no plano ${p.name}.`)
    } catch {
      toast('Não foi possível trocar agora. Tente de novo ou fale comigo no chat.')
    }
    setBusy(false)
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
          <b>Versão de teste da plataforma.</b> Nenhuma cobrança é feita por enquanto: escolher ou assinar um plano só muda o que fica liberado na sua conta.
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
                {current && <Badge color="#3e4b57">seu plano</Badge>}
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
                {sub?.status !== 'ativa' || !current ? (
                  <button className="btn primary block" disabled={busy} onClick={() => void choose(p.id, true)}>
                    assinar {p.name} <small>(modo teste)</small>
                  </button>
                ) : (
                  <p className="muted small center">plano ativo ✓</p>
                )}
                {!current && sub?.status === 'trial' && (
                  <button className="btn ghost block" disabled={busy} onClick={() => void choose(p.id, false)}>
                    testar este plano
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <Section title="precisa de ajuda?">
        <p className="muted small">Dúvidas sobre o sistema, sugestões ou problemas: fale direto comigo pelo chat.</p>
        <button className="btn" onClick={onChat}>
          <Icon name="chat" size={16} /> conversar com a {PLATFORM.owner}
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
            <b>Seu teste grátis terminou.</b> Assine para continuar (nesta versão, sem cobrança).
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
            ? 'Para continuar usando, escolha um plano. Seus dados estão guardados e nada foi apagado.'
            : `Seu acesso está pausado no momento. Seus dados estão guardados e nada foi apagado. Fale com a ${PLATFORM.owner} pelo chat para resolver.`}
        </p>
        <div className="row gap-s wrap center">
          {expired && (
            <a className="btn primary" href={href('assinatura')}>
              ver planos
            </a>
          )}
          <button className="btn" onClick={onChat}>
            <Icon name="chat" size={16} /> conversar com a {PLATFORM.owner}
          </button>
          <button className="btn ghost" onClick={() => download(`backup-${today()}.json`, JSON.stringify(data, null, 2))}>
            <Icon name="download" size={16} /> baixar meus dados
          </button>
        </div>
      </section>
    </div>
  )
}
