import { useStore } from '../store'
import { useAccess } from '../access'
import { go } from '../router'
import { Icon } from './Icon'
import { CLIENT_SERVICES } from '../clientDefaults'

/* Primeiros passos de quem assina: uma lista curta que se marca sozinha conforme a pessoa usa.
   Some quando tudo estiver feito (ou quando a pessoa esconder). */
export function FirstSteps() {
  const { data, setSettings, isSample, showSample } = useStore()
  const { isOwner } = useAccess()
  const s = data.settings
  if (isOwner || isSample || s.firstStepsHidden) return null
  const paid = data.projects.some((p) => p.payments.some((x) => x.paidDate))
  const steps = [
    { done: !!(s.ownerName?.trim() && s.phone?.trim()), label: 'complete seu perfil', hint: 'nome, WhatsApp e CPF/CNPJ vão sozinhos para orçamentos e contratos', page: 'perfil' },
    { done: JSON.stringify(s.services) !== JSON.stringify(CLIENT_SERVICES), label: 'ajuste sua tabela de preços', hint: 'por hora, por m², por unidade ou valor livre', page: 'config' },
    { done: data.clients.length > 0, label: 'cadastre seu primeiro cliente', hint: 'ou importe os que você já tem', page: 'clientes' },
    { done: data.quotes.length > 0, label: 'faça seu primeiro orçamento', hint: 'o valor é sugerido pela sua tabela', page: 'orcamentos/novo' },
    { done: paid, label: 'registre um pagamento recebido', hint: 'o financeiro do mês se monta sozinho', page: 'financeiro' },
  ]
  const n = steps.filter((x) => x.done).length
  if (n === steps.length) return null
  return (
    <section className="card first-steps">
      <header>
        <div>
          <b>primeiros passos</b>
          <small className="muted">
            {n} de {steps.length} feitos · leva uns 10 minutos
          </small>
        </div>
        <div className="row gap-s">
          <button className="btn small ghost" onClick={() => showSample(true)} title="Mostra tudo preenchido com dados fictícios (nada é salvo)">
            <Icon name="eye" size={14} /> ver exemplo
          </button>
          <button className="link small" onClick={() => setSettings({ firstStepsHidden: true })}>
            esconder
          </button>
        </div>
      </header>
      <div className="first-steps-bar" aria-hidden>
        <i style={{ width: `${(n / steps.length) * 100}%` }} />
      </div>
      <ol>
        {steps.map((x, i) => (
          <li key={x.label} className={x.done ? 'is-done' : ''}>
            <span className="first-steps-n">{x.done ? <Icon name="check" size={13} /> : i + 1}</span>
            <span className="grow">
              <b>{x.label}</b>
              <small className="muted">{x.hint}</small>
            </span>
            {!x.done && (
              <button className="btn small" onClick={() => go(x.page)}>
                fazer <Icon name="chevronR" size={13} />
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
