import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { toast } from './dialog'
import { platform, refLink, type AffiliateStats } from '../platform'
import { PLATFORM, STATUS_LABEL } from '../plans'
import { money } from '../utils'

/* Painel do afiliado: link secreto, sem login. Mostra só números e primeiros nomes. */
export function AffiliatePanel({ token }: { token: string }) {
  const [st, setSt] = useState<AffiliateStats | null | undefined>(undefined)
  useEffect(() => {
    platform
      .affiliatePanel(token)
      .then(setSt)
      .catch(() => setSt(null))
  }, [token])
  if (st === undefined) return <div className="loading-screen" />
  if (!st)
    return (
      <div className="aff-panel">
        <h1>link não encontrado</h1>
        <p className="muted">Confira o link com a equipe do {PLATFORM.name}.</p>
      </div>
    )
  const link = refLink(st.code)
  const due = Math.max(0, st.earned - st.paidOut)
  const copy = () =>
    navigator.clipboard
      ?.writeText(link)
      .then(() => toast('Link copiado.'))
      .catch(() => toast('Selecione e copie.'))
  return (
    <div className="aff-panel">
      <p className="eyebrow">parceria {PLATFORM.name}</p>
      <h1>oi, {st.name.split(' ')[0]}</h1>
      {!st.active && <p className="pf-note is-warn"><Icon name="alert" size={16} /><span>Sua parceria está pausada no momento. Fale com a equipe.</span></p>}
      <p className="muted">
        Quem se cadastra pelo seu link ganha <b>{st.discount}% no primeiro mês</b>. Você ganha <b>{st.commission}%</b> de cada pagamento dessa pessoa durante <b>{st.months} meses</b>, repassado por Pix.
      </p>
      <div className="aff-link">
        <span className="grow">{link}</span>
        <button className="btn small" onClick={copy}>
          <Icon name="copy" size={13} /> copiar
        </button>
      </div>
      <div className="aff-big">
        <div>
          <span className="muted small">cadastros</span>
          <b>{st.signups}</b>
        </div>
        <div>
          <span className="muted small">assinando</span>
          <b>{st.paying}</b>
        </div>
        <div>
          <span className="muted small">comissão gerada</span>
          <b>{money(st.earned)}</b>
        </div>
        <div>
          <span className="muted small">a receber</span>
          <b>{money(due)}</b>
        </div>
      </div>
      <p className="muted small">Já recebido: {money(st.paidOut)}. A comissão entra 30 dias depois de cada pagamento confirmado.</p>
      {st.people.length > 0 && (
        <section className="card">
          <h3>quem veio pelo seu link</h3>
          <ul className="ref-list">
            {st.people.map((p, i) => (
              <li key={i}>
                <b className="grow">{p.name}</b>
                <span className="ref-status">{STATUS_LABEL[p.status]}</span>
                <small className="muted">{new Date(p.since).toLocaleDateString('pt-BR')}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="muted small">Dúvidas: {PLATFORM.email} · {PLATFORM.instagram}</p>
    </div>
  )
}
