import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Modal } from './ui'
import { DocScale, usePdf } from './Print'
import { TermsText } from './Terms'
import { platform, type AccessEntry, type Billing, type ChatMessage, type SubAdmin, type Subscription, type Usage } from '../platform'
import { PLANS, STATUS_LABEL, effectivePlan } from '../plans'
import { fillTerms, type Company } from '../siteContent'
import { money } from '../utils'

/* Comprovante do assinante (só a dona): junta num PDF tudo o que prova a contratação e o uso,
   para anexar numa contestação de pagamento (chargeback): cadastro, aceite dos termos, pedido,
   pagamentos, acessos, uso da conta e conversas, com os termos aceitos no fim. */

const dt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const device = (ua: string) => {
  if (!ua) return '—'
  if (!/mozilla|safari|chrome|firefox|edg/i.test(ua)) return ua
  const os = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'Mac' : /linux/i.test(ua) ? 'Linux' : 'outro'
  const br = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'navegador'
  return `${os} · ${br}`
}

export function SubscriberProof({ s, b, ctrl, usage, onClose }: { s: Subscription; b?: Billing; ctrl?: SubAdmin; usage?: Usage; onClose: () => void }) {
  const pdf = usePdf()
  const [data, setData] = useState<{ access: AccessEntry[]; msgs: ChatMessage[]; terms: string; company: Company } | null>(null)
  useEffect(() => {
    void Promise.all([platform.accessLog(s.userId), platform.messages(s.userId).catch(() => []), platform.terms().catch(() => ''), platform.company().catch(() => ({}) as Company)]).then(([access, msgs, terms, company]) => setData({ access, msgs, terms, company }))
  }, [s.userId])
  const name = b?.fullName || s.name || s.email
  const file = `Comprovante - ${name}.pdf`
  const doc = data && (
    <article className="proof-doc">
      <header>
        <p className="proof-k">comprovante do assinante</p>
        <h1>{name}</h1>
        <p className="proof-muted">gerado em {dt(new Date().toISOString())} · conta {s.userId}</p>
      </header>

      <h2>1. dados do cadastro</h2>
      <dl>
        {(
          [
            ['nome completo', b?.fullName],
            ['CPF/CNPJ', b?.doc],
            ['e-mail da conta', s.email],
            ['e-mail de cobrança', b?.email],
            ['celular', b?.phone],
            ['endereço', b ? [b.address, b.number, b.complement].filter(Boolean).join(', ') + (b.city ? ` · ${b.city}` : '') + (b.cep ? ` · CEP ${b.cep}` : '') : ''],
            ['atuação', b?.profession],
            ['estúdio', s.studio],
          ] as [string, string | undefined][]
        ).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v || '—'}</dd>
          </div>
        ))}
      </dl>

      <h2>2. assinatura e pedido</h2>
      <dl>
        {(
          [
            ['conta criada em', dt(s.createdAt)],
            ['plano', PLANS[effectivePlan(s)]?.name ?? s.plan],
            ['situação', STATUS_LABEL[s.status]],
            ['teste grátis até', dt(s.trialEnds)],
            ['pedido de assinatura', s.requestedAt ? `${dt(s.requestedAt)}${s.requestedPlan ? ` · ${PLANS[s.requestedPlan]?.name}` : ''}${s.requestedCycle ? ` · ${s.requestedCycle}` : ''}` : '—'],
            ['período e forma de pagamento', b ? `${b.cycle} · ${b.payMethod === 'cartao' ? `cartão${b.installments ? ` em ${b.installments}x` : ''}` : b.payMethod}` : ctrl?.cycle ?? '—'],
            ['pago até', ctrl?.paidUntil ? ctrl.paidUntil.split('-').reverse().join('/') : '—'],
            ['cancelada em', dt(s.canceledAt)],
            ['último acesso', dt(s.lastSeen)],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <h2>3. aceite dos termos de uso e do contrato de assinatura</h2>
      <p>
        {b?.acceptedAt ? (
          <>
            A pessoa marcou “li e aceito os termos de uso e o contrato de assinatura” em <b>{dt(b.acceptedAt)}</b>, ao preencher os dados acima no pedido de assinatura. O texto dos termos vigentes está no anexo, no fim deste documento.
          </>
        ) : (
          'Sem registro de aceite nos dados de cobrança.'
        )}
      </p>

      <h2>4. pagamentos registrados</h2>
      {ctrl?.payments?.length ? (
        <table>
          <thead>
            <tr>
              <th>data</th>
              <th>valor</th>
              <th>forma</th>
              <th>observação</th>
            </tr>
          </thead>
          <tbody>
            {ctrl.payments.map((p) => (
              <tr key={p.id}>
                <td>{p.date.split('-').reverse().join('/')}</td>
                <td>{money(p.amount)}</td>
                <td>{p.method === 'cartao' ? 'cartão' : 'Pix'}</td>
                <td>{p.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="proof-muted">Nenhum pagamento registrado no painel.</p>
      )}

      <h2>5. uso da conta</h2>
      {usage ? (
        <p>
          {usage.quotes} orçamentos · {usage.clients} clientes · {usage.projects} demandas · {usage.contracts} contratos · {usage.docs} documentos · {usage.briefings} briefings
          {usage.lastQuoteAt ? ` · último orçamento em ${usage.lastQuoteAt.split('-').reverse().join('/')}` : ''} (atualizado em {dt(usage.updatedAt)}). Só contagens: o conteúdo da conta não é lido.
        </p>
      ) : (
        <p className="proof-muted">Sem dados de uso.</p>
      )}

      <h2>6. acessos à conta ({data.access.length})</h2>
      {data.access.length ? (
        <table>
          <thead>
            <tr>
              <th>data e hora</th>
              <th>aparelho</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {data.access.map((a, i) => (
              <tr key={i}>
                <td>{dt(a.at)}</td>
                <td>{device(a.ua)}</td>
                <td>{a.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="proof-muted">Sem registro de acessos ainda (o registro começa depois da atualização do Supabase de 02/10/2026). Último acesso conhecido: {dt(s.lastSeen)}.</p>
      )}

      <h2>7. conversas pelo chat ({data.msgs.length})</h2>
      {data.msgs.length ? (
        <ul className="proof-chat">
          {data.msgs.map((m) => (
            <li key={m.id}>
              <small>
                {dt(m.createdAt)} · {m.fromOwner ? 'traço (suporte)' : name}
              </small>
              <p>{m.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="proof-muted">Sem conversas.</p>
      )}

      {data.terms && (
        <section className="proof-annex">
          <h2>anexo · termos de uso e contrato de assinatura vigentes</h2>
          <TermsText text={fillTerms(data.terms, data.company, { name: b?.fullName || s.name, doc: b?.doc, email: b?.email || s.email, plan: PLANS[effectivePlan(s)]?.name })} />
        </section>
      )}
    </article>
  )
  return (
    <Modal
      wide
      title="comprovante do assinante"
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={!doc || pdf.busy} onClick={() => doc && pdf.download(doc, file)}>
          <Icon name="download" size={15} /> {pdf.busy ? 'gerando…' : 'baixar PDF'}
        </button>
      }
    >
      <p className="muted small">Para anexar numa contestação de pagamento (chargeback) ou guardar. Só você vê.</p>
      <div className="proof-view">{doc ? <DocScale width={794}>{doc}</DocScale> : <p className="muted">juntando os dados…</p>}</div>
      {pdf.portal}
    </Modal>
  )
}
