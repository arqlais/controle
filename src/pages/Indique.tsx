import { useAccess } from '../access'
import { Icon } from '../components/Icon'
import { PLATFORM, REFERRAL, TRIAL_DAYS } from '../plans'
import { ReferralCard } from './Subscription'

/* Indique e ganhe: página própria para quem assina, com o link, as mensagens prontas e quem já veio. */
export default function Indique() {
  const { sub } = useAccess()
  const months = REFERRAL.months === 1 ? '1 mês grátis' : `${REFERRAL.months} meses grátis`
  return (
    <div className="page indique">
      <section className="ind-hero">
        <span className="ind-gift" aria-hidden>
          <Icon name="gift" size={30} />
        </span>
        <p className="eyebrow">indique e ganhe</p>
        <h1>
          ganhe <em>{months}</em> a cada amigo que assinar
        </h1>
        <p className="ind-lead">
          Conhece alguém que vive de projeto? Mande o seu link: a pessoa testa grátis por {TRIAL_DAYS} dias e ganha <b>{REFERRAL.discount}% de desconto</b> no primeiro mês. Quando ela assinar, você ganha <b>{months}</b>. Sem limite: 5 amigos, 5 meses.
        </p>
      </section>
      <ol className="ind-steps">
        <li>
          <b>1</b>
          <span>
            <strong>copie o seu link</strong>
            <small>ele é só seu e fica aqui embaixo</small>
          </span>
        </li>
        <li>
          <b>2</b>
          <span>
            <strong>mande para quem projeta</strong>
            <small>WhatsApp, grupo da faculdade, stories</small>
          </span>
        </li>
        <li>
          <b>3</b>
          <span>
            <strong>ganhe quando assinar</strong>
            <small>o mês grátis entra na sua próxima cobrança</small>
          </span>
        </li>
      </ol>
      <section className="card">
        <h3>seu link</h3>
        <ReferralCard code={sub?.refCode ?? ''} plain />
      </section>
      <p className="muted small center">Dúvidas sobre indicação: fale com o {PLATFORM.support} pelo chat.</p>
    </div>
  )
}
