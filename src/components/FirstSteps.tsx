import { useStore } from '../store'
import { useAccess } from '../access'
import { go } from '../router'
import { Icon } from './Icon'
import { CLIENT_SERVICES, servicesFor } from '../clientDefaults'

/* Primeiros passos de quem assina: uma lista curta que se marca sozinha conforme a pessoa usa.
   Some quando tudo estiver feito (ou quando a pessoa esconder). */
export function FirstSteps() {
  const { data, setSettings, isSample, showSample } = useStore()
  const { isOwner } = useAccess()
  const s = data.settings
  if (isOwner || isSample || s.firstStepsHidden) return null
  const paid = data.projects.some((p) => p.payments.some((x) => x.paidDate))
  // começa pelo que encanta: a primeira proposta pronta (a tabela já vem montada para o jeito de trabalhar escolhido no cadastro)
  const sent = data.quotes.some((q) => q.status !== 'rascunho' || !!q.shareToken || !!q.pdfAt)
  const steps = [
    { done: data.quotes.length > 0, label: 'faça sua primeira proposta', hint: 'a tabela de preços já vem pronta; o cliente você cadastra ali mesmo', page: 'orcamentos/novo' },
    { done: sent, label: 'mande pelo link ou em PDF', hint: 'a cliente vê, escolhe a opção e aprova pelo celular', page: data.quotes[0] ? `orcamentos/${data.quotes[0].id}` : 'orcamentos' },
    { done: !!(s.ownerName?.trim() && s.phone?.trim() && s.pixKey?.trim()), label: 'complete seu perfil e o Pix', hint: 'nome, WhatsApp e Pix vão sozinhos para propostas, contratos e cobranças', page: 'perfil' },
    { done: ![JSON.stringify(CLIENT_SERVICES), JSON.stringify(servicesFor(s.workProfile))].includes(JSON.stringify(s.services)), label: 'ajuste os valores da sua tabela', hint: 'por hora, por m², por unidade ou valor livre', page: 'config' },
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
            {n} de {steps.length} feitos · a primeira proposta sai em 5 minutos
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
