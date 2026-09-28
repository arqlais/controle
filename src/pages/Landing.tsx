import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, demoData } from '../store'
import { applyTheme } from '../theme'
import { Icon } from '../components/Icon'
import { QuoteDoc } from '../components/Docs'
import { ContractDoc } from '../components/ContractDoc'
import { DocScale } from '../components/Print'
import { BarChart } from '../components/Charts'
import { COMPARE, PLAN_LIST, PLATFORM, TRIAL_DAYS, money0, type PlanId } from '../plans'
import { TEMPLATES } from '../proposalTemplates'
import { DEFAULT_CONTRACTS, contractVars, fillContract } from '../contracts'
import { STATUS, allPayments, deadlineInfo, fmtDate, isOpen, money, paymentState, quoteTotal, urgencyScore } from '../utils'
import type { Settings } from '../types'
import { go } from '../router'

/* Página de vendas (pública, sem login). As telas de exemplo usam os mesmos
   componentes do sistema, com dados fictícios. */

// estúdio fictício das telas de exemplo
const SAMPLE: Settings = {
  ...DEFAULT_SETTINGS,
  brandName: 'estúdio exemplo',
  ownerName: 'Ana',
  legalName: 'Ana Ribeiro',
  document: '12345678000190',
  city: 'Belo Horizonte - MG',
  phone: '(31) 99999-0000',
  instagram: '@estudio.exemplo',
  email: 'ana@exemplo.com',
  website: 'estudioexemplo.com.br',
}

const FEATURES: { icon: string; title: string; text: string }[] = [
  { icon: 'folder', title: 'demandas e prazos', text: 'quadro com as fases de cada projeto e urgência automática: o que vence primeiro aparece primeiro.' },
  { icon: 'file', title: 'orçamentos com a sua tabela', text: 'preço por imagem, por m² ou por pacote. o valor sai certo e a proposta fica pronta em minutos.' },
  { icon: 'pen', title: 'proposta em PDF', text: 'modelos bonitos com as suas cores e logo. prefere sem PDF? manda só o resumo no WhatsApp.' },
  { icon: 'briefcase', title: 'contratos prontos', text: 'o contrato já sai preenchido com cliente, CPF/CNPJ, serviços, valor, prazo e pagamento.' },
  { icon: 'wallet', title: 'financeiro sem planilha', text: 'parcelas, sinal e saldo, recibos em PDF, despesas fixas, lucro do mês e metas.' },
  { icon: 'whatsapp', title: 'cobrança no WhatsApp', text: 'um toque e a mensagem de cobrança sai pronta, com valor e chave pix.' },
  { icon: 'calendar', title: 'agenda', text: 'entregas, pagamentos e reuniões num calendário só, que sincroniza com o celular.' },
  { icon: 'users', title: 'clientes', text: 'histórico de conversas, quanto cada cliente já fechou, origem e atalhos de contato.' },
]

const AUDIENCE = [
  { icon: 'building', title: 'arquitetos', text: 'do estudo ao executivo, com etapas, prazos e contratos por projeto.' },
  { icon: 'layers', title: 'designers de interiores', text: 'orçamentos por ambiente, propostas caprichadas e financeiro em dia.' },
  { icon: 'camera', title: 'visualização 3D', text: 'preço por imagem e pacotes, rodadas de ajuste e prazos apertados sob controle.' },
  { icon: 'ruler', title: 'freelancers e estúdios pequenos', text: 'quem faz tudo sozinho e quer parar de se perder em planilhas e conversas.' },
]

const TESTIMONIALS = [
  { name: 'Carolina M.', role: 'arquiteta · SP', text: 'parei de esquecer de cobrar o saldo. o sistema me lembra e a mensagem já sai pronta.' },
  { name: 'Diego R.', role: 'visualização 3D · BH', text: 'meu orçamento levava uma hora. agora em dez minutos a proposta está no WhatsApp do cliente.' },
  { name: 'Lívia S.', role: 'designer de interiores · RJ', text: 'finalmente sei quanto eu lucro por mês. e as propostas ficaram muito mais bonitas.' },
]

const FAQ: [string, ReactNode][] = [
  ['preciso de cartão de crédito para testar?', `Não. Você usa ${TRIAL_DAYS} dias grátis, com tudo do plano que escolher, sem cadastrar cartão.`],
  ['o que acontece quando o teste termina?', 'Você escolhe um plano para continuar. Se não quiser, seus dados ficam guardados e você pode baixar tudo quando quiser.'],
  ['funciona no celular?', 'Sim. Funciona no celular, tablet e computador, e dá para instalar como aplicativo na tela inicial. Os dados aparecem iguais em todos os aparelhos.'],
  ['meus dados ficam seguros?', 'Cada conta é separada e protegida pelo seu login: ninguém mais vê seus clientes, valores ou propostas. Você também pode baixar um backup quando quiser.'],
  ['consigo usar a minha tabela de preços?', 'Sim. Você cadastra seus serviços (por imagem, por m², por pacote ou valor livre) e o orçamento calcula sozinho, com desconto para estudante e taxa de urgência se quiser.'],
  ['a proposta fica com a minha cara?', 'Sim. Você escolhe o modelo, as cores, os textos e coloca seu logo. As mudanças valem só para a sua conta.'],
  ['os contratos têm validade jurídica?', 'São modelos de referência que já saem preenchidos com os dados do orçamento. Revise o texto com um advogado antes de usar; você pode editar tudo.'],
  ['posso trocar de plano ou cancelar?', 'Pode, quando quiser, direto na sua conta. Não tem fidelidade.'],
  ['e se eu tiver dúvida?', `Tem um chat dentro do sistema direto com a ${PLATFORM.owner}, que criou o sistema e usa todos os dias no próprio estúdio.`],
]

type Screen = 'painel' | 'demandas' | 'proposta' | 'contrato' | 'financeiro'
const SCREENS: { id: Screen; label: string; icon: string }[] = [
  { id: 'painel', label: 'painel', icon: 'home' },
  { id: 'demandas', label: 'demandas', icon: 'folder' },
  { id: 'proposta', label: 'proposta em PDF', icon: 'file' },
  { id: 'contrato', label: 'contrato', icon: 'briefcase' },
  { id: 'financeiro', label: 'financeiro', icon: 'wallet' },
]

export default function Landing() {
  useEffect(() => {
    applyTheme(DEFAULT_SETTINGS)
    document.title = `${PLATFORM.name} · ${PLATFORM.tagline}`
    window.scrollTo(0, 0)
  }, [])
  const signup = (plan?: PlanId) => go('cadastro', plan)
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-wrap lp-top-in">
          <a className="brand-name lp-logo" href="#/vendas" onClick={(e) => (e.preventDefault(), window.scrollTo({ top: 0, behavior: 'smooth' }))}>
            {PLATFORM.name}
            <i>.</i>
          </a>
          <nav className="lp-nav">
            {[
              ['recursos', 'recursos'],
              ['telas', 'telas'],
              ['planos', 'planos'],
              ['duvidas', 'dúvidas'],
            ].map(([id, label]) => (
              <button key={id} className="link" onClick={() => scrollTo(id)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="row gap-s">
            <button className="btn ghost small" onClick={() => go('entrar')}>
              entrar
            </button>
            <button className="btn primary small" onClick={() => signup()}>
              testar grátis
            </button>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-in">
          <div className="lp-hero-text">
            <p className="eyebrow">para arquitetos, designers e estúdios de 3D</p>
            <h1>
              seu estúdio <em>organizado</em>, do orçamento ao recibo
            </h1>
            <p className="lp-lead">Clientes, demandas, prazos, orçamentos com a sua tabela, propostas em PDF, contratos e financeiro — num lugar só, no celular e no computador.</p>
            <div className="row gap-s wrap">
              <button className="btn primary lp-cta" onClick={() => signup()}>
                testar grátis por {TRIAL_DAYS} dias <Icon name="arrowRight" size={16} />
              </button>
              <button className="btn ghost lp-cta" onClick={() => scrollTo('telas')}>
                ver as telas
              </button>
            </div>
            <p className="muted small">sem cartão de crédito · cancele quando quiser</p>
          </div>
          <div className="lp-hero-art" aria-hidden>
            <Frame>
              <PainelScreen compact />
            </Frame>
            <div className="lp-phone">
              <div className="lp-phone-bubble">
                oii, Mariana! te encaminhei o pdf com a proposta ☺️
                <small>12:04 ✓✓</small>
              </div>
              <div className="lp-phone-card">
                <b>proposta #014</b>
                <span>renders — Casa Pampulha</span>
                <em>R$ 1.400,00</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-strip">
        <div className="lp-wrap lp-strip-in">
          <span className="pf-avatar lp-strip-avatar">{PLATFORM.owner[0]}</span>
          <p>
            <b>Feito por quem usa todos os dias.</b> O {PLATFORM.name} nasceu no estúdio da {PLATFORM.owner}, {PLATFORM.ownerRole}, para resolver a rotina de verdade: prazo apertado, cliente que some, saldo esquecido. Agora está aberto para você.
          </p>
        </div>
      </section>

      <section className="lp-section" id="recursos">
        <div className="lp-wrap">
          <SectionHead eyebrow="o que faz" title={<>tudo o que o estúdio <em>precisa</em></>} text="Sem instalar nada e sem planilha. Você abre, cadastra o primeiro cliente e já sai usando." />
          <div className="lp-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="lp-feature">
                <span className="lp-icon">
                  <Icon name={f.icon} size={20} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-alt" id="telas">
        <div className="lp-wrap">
          <SectionHead eyebrow="telas de exemplo" title={<>veja <em>por dentro</em></>} text="Dados fictícios, telas de verdade: é exatamente assim que fica no seu estúdio." />
          <Screens />
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap">
          <SectionHead eyebrow="para quem é" title={<>feito para quem <em>projeta</em></>} />
          <div className="lp-audience">
            {AUDIENCE.map((a) => (
              <article key={a.title} className="card lp-aud">
                <Icon name={a.icon} size={22} />
                <h3>{a.title}</h3>
                <p className="muted">{a.text}</p>
              </article>
            ))}
          </div>
          <ol className="lp-steps">
            {[
              ['crie sua conta', `em 1 minuto, com ${TRIAL_DAYS} dias grátis`],
              ['coloque sua tabela e seu logo', 'ou comece com dados de exemplo para explorar'],
              ['mande o primeiro orçamento', 'e acompanhe tudo até o recibo'],
            ].map(([t, d], i) => (
              <li key={t}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                <span>
                  <strong>{t}</strong>
                  <small className="muted">{d}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-section lp-alt" id="planos">
        <div className="lp-wrap">
          <SectionHead eyebrow="planos e preços" title={<>simples, <em>sem fidelidade</em></>} text={`Teste grátis por ${TRIAL_DAYS} dias com tudo do plano escolhido. Depois, é só escolher como continuar.`} />
          <div className="pf-plan-cards lp-plans">
            {PLAN_LIST.map((p) => (
              <article key={p.id} className={`card pf-plan ${p.featured ? 'is-featured' : ''}`}>
                {p.featured && <span className="lp-ribbon">mais completo</span>}
                <header>
                  <h3>{p.name}</h3>
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
                <button className={`btn ${p.featured ? 'primary' : ''} block`} onClick={() => signup(p.id)}>
                  testar o {p.name} grátis
                </button>
              </article>
            ))}
          </div>
          <div className="card lp-compare">
            <table>
              <thead>
                <tr>
                  <th />
                  {PLAN_LIST.map((p) => (
                    <th key={p.id}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([label, a, b]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {[a, b].map((v, i) => (
                      <td key={i} className="center">
                        {v === true ? <Icon name="check" size={16} className="text-good" /> : v === false ? <span className="muted">—</span> : <span className="small">{v}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small center">Valores de exemplo desta prévia. Nenhuma cobrança é feita nesta versão.</p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap">
          <SectionHead eyebrow="depoimentos" title={<>quem já <em>organizou</em> o estúdio</>} />
          <div className="lp-testimonials">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="card lp-quote">
                <span className="lp-example-tag">exemplo</span>
                <blockquote>“{t.text}”</blockquote>
                <figcaption>
                  <b>{t.name}</b> <span className="muted">· {t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="muted small center">Depoimentos ilustrativos desta prévia (serão trocados pelos de clientes reais).</p>
        </div>
      </section>

      <section className="lp-section lp-alt" id="duvidas">
        <div className="lp-wrap lp-faq-wrap">
          <SectionHead eyebrow="perguntas frequentes" title={<>ficou alguma <em>dúvida?</em></>} />
          <div className="lp-faq">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card lp-faq-item">
                <summary>
                  {q}
                  <Icon name="plus" size={16} />
                </summary>
                <p className="muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-wrap lp-final-in">
          <h2>
            comece hoje, <em>grátis</em>
          </h2>
          <p>{TRIAL_DAYS} dias para testar com calma. Sem cartão, sem compromisso.</p>
          <button className="btn light lp-cta" onClick={() => signup()}>
            criar minha conta <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <span className="brand-name">
            {PLATFORM.name}
            <i>.</i>
          </span>
          <span className="muted small">
            feito com carinho pela {PLATFORM.owner} · {new Date().getFullYear()}
            {PLATFORM.provisional ? ' · nome provisório' : ''}
          </span>
          <button className="link small" onClick={() => go('entrar')}>
            já tenho conta → entrar
          </button>
        </div>
      </footer>
    </div>
  )
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: string }) {
  return (
    <div className="lp-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {text && <p className="muted">{text}</p>}
    </div>
  )
}

function Frame({ children, label = `${PLATFORM.name}.app` }: { children: ReactNode; label?: string }) {
  return (
    <div className="lp-frame">
      <div className="lp-frame-bar">
        <i />
        <i />
        <i />
        <span>{label}</span>
      </div>
      <div className="lp-frame-body">{children}</div>
    </div>
  )
}

function useDemo() {
  return useMemo(() => demoData(SAMPLE), [])
}

function Screens() {
  const [screen, setScreen] = useState<Screen>('painel')
  return (
    <div className="lp-screens">
      <div className="lp-screen-tabs" role="tablist">
        {SCREENS.map((s) => (
          <button key={s.id} role="tab" aria-selected={screen === s.id} className={screen === s.id ? 'active' : ''} onClick={() => setScreen(s.id)}>
            <Icon name={s.icon} size={16} /> {s.label}
          </button>
        ))}
      </div>
      <Frame>
        {screen === 'painel' && <PainelScreen />}
        {screen === 'demandas' && <DemandasScreen />}
        {screen === 'proposta' && <PropostaScreen />}
        {screen === 'contrato' && <ContratoScreen />}
        {screen === 'financeiro' && <FinanceiroScreen />}
      </Frame>
    </div>
  )
}

function PainelScreen({ compact }: { compact?: boolean }) {
  const d = useDemo()
  const open = d.projects.filter(isOpen).sort((a, b) => urgencyScore(b) - urgencyScore(a))
  const toReceive = allPayments(d).filter((x) => !x.pay.paidDate).reduce((s, x) => s + x.pay.amount, 0)
  const client = (id: string) => d.clients.find((c) => c.id === id)?.name ?? ''
  return (
    <div className="lp-screen">
      <div className="lp-screen-head">
        <span className="muted small">bom dia, Ana ☀️</span>
        <b>painel do mês</b>
      </div>
      <div className="lp-mini-stats">
        <div>
          <small>recebido</small>
          <b>{money(6100)}</b>
          <span className="lp-meter">
            <i style={{ width: '76%' }} />
          </span>
        </div>
        <div>
          <small>a receber</small>
          <b>{money(toReceive)}</b>
        </div>
        {!compact && (
          <div>
            <small>lucro</small>
            <b>{money(5480)}</b>
          </div>
        )}
      </div>
      <div className="lp-mini-grid">
        <div className="lp-mini-card">
          <small className="lp-mini-title">prioridades agora</small>
          {open.slice(0, compact ? 3 : 4).map((p) => {
            const dl = deadlineInfo(p)
            return (
              <div key={p.id} className="lp-mini-row">
                <i style={{ background: STATUS[p.status]?.color }} />
                <span className="grow">
                  {p.title}
                  <small className="muted">{client(p.clientId)}</small>
                </span>
                <em className={`tone-${dl.tone}`}>{dl.text}</em>
              </div>
            )
          })}
        </div>
        {!compact && (
          <div className="lp-mini-card">
            <small className="lp-mini-title">recebido × meta (6 meses)</small>
            <BarChart labels={['abr', 'mai', 'jun', 'jul', 'ago', 'set']} series={[{ label: 'recebido', color: 'var(--accent)', values: [3200, 4100, 3650, 5200, 4800, 6100] }]} goal={6000} height={170} />
          </div>
        )}
      </div>
    </div>
  )
}

function DemandasScreen() {
  const d = useDemo()
  const cols = ['briefing', 'producao', 'revisao', 'aguardando'] as const
  const client = (id: string) => d.clients.find((c) => c.id === id)?.name ?? ''
  return (
    <div className="lp-screen">
      <div className="lp-screen-head">
        <b>demandas</b>
        <span className="muted small">arraste entre as fases · a urgência é automática</span>
      </div>
      <div className="lp-kanban">
        {cols.map((c) => (
          <div key={c} className="lp-col">
            <span className="lp-col-title">
              <i style={{ background: STATUS[c].color }} /> {STATUS[c].label.toLowerCase()}
            </span>
            {d.projects
              .filter((p) => p.status === c)
              .map((p) => {
                const dl = deadlineInfo(p)
                return (
                  <div key={p.id} className="lp-kcard">
                    <b>{p.title}</b>
                    <small className="muted">{client(p.clientId)}</small>
                    <span className="row gap-s">
                      <em className={`tone-${dl.tone}`}>{dl.text}</em>
                      <span className="grow" />
                      <small>{money(p.value)}</small>
                    </span>
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}

function PropostaScreen() {
  const d = useDemo()
  const choices = TEMPLATES.filter((t) => t.id !== 'lais')
  const [tpl, setTpl] = useState(choices[0].id)
  const t = choices.find((x) => x.id === tpl)!
  const s: Settings = { ...SAMPLE, proposal: { ...SAMPLE.proposal, ...t.colors, template: tpl } }
  const quote = d.quotes[0]
  return (
    <div className="lp-screen lp-split">
      <div className="lp-split-side">
        <b>modelos de proposta</b>
        <p className="muted small">Escolha um modelo e personalize as cores e os textos. Não usa PDF? Desligue e mande só o resumo no WhatsApp.</p>
        <div className="lp-tpl-list">
          {choices.map((x) => (
            <button key={x.id} className={`lp-tpl ${tpl === x.id ? 'active' : ''}`} onClick={() => setTpl(x.id)}>
              <span className="lp-tpl-swatch">
                <i style={{ background: x.colors.bar }} />
                <i style={{ background: x.colors.arch }} />
                <i style={{ background: x.colors.rose }} />
              </span>
              <span>
                <b>{x.name}</b>
                <small className="muted">{x.description}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="small">
          total: <b>{money(quoteTotal(quote, SAMPLE.urgencyFee))}</b>
        </p>
      </div>
      <div className="lp-doc">
        <DocScale>
          <QuoteDoc s={s} quote={quote} client={d.clients.find((c) => c.id === quote.clientId)} />
        </DocScale>
      </div>
    </div>
  )
}

function ContratoScreen() {
  const d = useDemo()
  const quote = d.quotes[0]
  const client = d.clients.find((c) => c.id === quote.clientId)
  const body = fillContract(DEFAULT_CONTRACTS[2].body, contractVars(SAMPLE, quote, client))
  return (
    <div className="lp-screen lp-split">
      <div className="lp-split-side">
        <b>contrato em 1 clique</b>
        <p className="muted small">Escolha o orçamento e o modelo: cliente, CPF/CNPJ, serviços, valor por extenso, prazo e pagamento já vêm preenchidos. Dá para editar tudo.</p>
        <ul className="pf-checks">
          <li>
            <Icon name="check" size={14} /> modelos editáveis
          </li>
          <li>
            <Icon name="check" size={14} /> PDF com assinatura das duas partes
          </li>
          <li>
            <Icon name="check" size={14} /> quem não usa, desliga
          </li>
        </ul>
        <p className="muted small">Modelos de referência: revise com um advogado.</p>
      </div>
      <div className="lp-doc">
        <DocScale>
          <ContractDoc s={SAMPLE} body={body} clientName={client?.name ?? ''} />
        </DocScale>
      </div>
    </div>
  )
}

function FinanceiroScreen() {
  const d = useDemo()
  const pays = allPayments(d)
    .filter((x) => !x.pay.paidDate)
    .slice(0, 5)
  return (
    <div className="lp-screen">
      <div className="lp-screen-head">
        <b>financeiro</b>
        <span className="muted small">parcelas, recibos e cobrança no WhatsApp</span>
      </div>
      <div className="lp-mini-stats">
        <div>
          <small>recebido no mês</small>
          <b>{money(6100)}</b>
        </div>
        <div>
          <small>despesas</small>
          <b>{money(620)}</b>
        </div>
        <div>
          <small>margem</small>
          <b>90%</b>
        </div>
      </div>
      <div className="lp-mini-card">
        <small className="lp-mini-title">próximas parcelas</small>
        {pays.map((x) => {
          const st = paymentState(x.pay, x.project)
          return (
            <div key={x.pay.id} className="lp-mini-row">
              <i style={{ background: st === 'cobrar' ? 'var(--warn)' : 'var(--accent-soft)' }} />
              <span className="grow">
                {x.pay.description} · {x.project.title}
                <small className="muted">
                  {x.client?.name} · {x.pay.dueDate ? fmtDate(x.pay.dueDate) : 'na conclusão'}
                </small>
              </span>
              <b className="small">{money(x.pay.amount)}</b>
              {st === 'cobrar' && (
                <span className="lp-pill">
                  <Icon name="whatsapp" size={12} /> cobrar
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
