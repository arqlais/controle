import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

/* Página de vendas (pública, sem login): leve, animada e direta.
   As telas de exemplo usam os mesmos componentes do sistema, com dados fictícios. */

// estúdio fictício das telas de exemplo
const SAMPLE: Settings = {
  ...DEFAULT_SETTINGS,
  displayFont: 'Playfair Display',
  proposal: { ...DEFAULT_SETTINGS.proposal, ...TEMPLATES[1].colors, template: TEMPLATES[1].id },
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

// palavra que troca sozinha no título
const WORDS = ['organizada', 'mais leve', 'no seu ritmo', 'lucrativa']

// a jornada de um trabalho, do primeiro "oi" ao pagamento
const JOURNEY: { icon: string; step: string; title: string; text: string; card: { k: string; v: string; tone?: string }[] }[] = [
  {
    icon: 'whatsapp',
    step: 'o cliente chama',
    title: 'tudo começa organizado',
    text: 'cadastre o cliente em segundos e guarde cada combinado com data. nada se perde na conversa.',
    card: [
      { k: 'cliente', v: 'Mariana Costa' },
      { k: 'pedido', v: 'renders do living e da cozinha' },
      { k: 'origem', v: 'indicação' },
    ],
  },
  {
    icon: 'file',
    step: 'orçamento',
    title: 'o valor certo, em minutos',
    text: 'a sua tabela calcula por imagem, m² ou pacote. a proposta sai pronta, com a sua identidade.',
    card: [
      { k: 'renderização · 5 imagens', v: 'R$ 1.100,00' },
      { k: 'modelagem 3D', v: 'R$ 520,00' },
      { k: 'total', v: 'R$ 1.620,00', tone: 'strong' },
    ],
  },
  {
    icon: 'folder',
    step: 'produção',
    title: 'prazos sob controle',
    text: 'cada projeto numa fase, com etapas e urgência automática. o que vence primeiro aparece primeiro.',
    card: [
      { k: 'fase', v: 'em produção' },
      { k: 'etapas', v: '3 de 6 feitas' },
      { k: 'entrega', v: 'faltam 3 dias', tone: 'warn' },
    ],
  },
  {
    icon: 'wallet',
    step: 'pagamento',
    title: 'dinheiro no lugar',
    text: 'sinal e saldo no financeiro, cobrança pronta no WhatsApp e o recibo em um toque.',
    card: [
      { k: 'sinal (50%)', v: 'pago ✓', tone: 'good' },
      { k: 'saldo (50%)', v: 'cobrar hoje', tone: 'warn' },
      { k: 'recebido no mês', v: 'R$ 6.100,00', tone: 'strong' },
    ],
  },
]

const FEATURES = ['clientes', 'orçamentos', 'propostas', 'contratos', 'prazos', 'agenda', 'financeiro', 'recibos', 'cobrança no WhatsApp', 'metas', 'sua identidade visual', 'celular e computador']

const AUDIENCE = [
  { icon: 'building', title: 'arquitetos' },
  { icon: 'layers', title: 'designers de interiores' },
  { icon: 'camera', title: 'artistas 3D' },
  { icon: 'book', title: 'estudantes' },
]

const TESTIMONIALS = [
  { name: 'Carolina M.', role: 'arquiteta', text: 'parei de esquecer de cobrar o saldo. a mensagem já sai pronta.' },
  { name: 'Diego R.', role: 'artista 3D', text: 'meu orçamento levava uma hora. agora, dez minutos.' },
  { name: 'Lívia S.', role: 'designer de interiores', text: 'finalmente sei quanto eu lucro por mês.' },
]

const FAQ: [string, ReactNode][] = [
  ['preciso de cartão para testar?', `Não. São ${TRIAL_DAYS} dias grátis com tudo do plano escolhido, sem cadastrar cartão.`],
  ['serve para quem está começando?', 'Serve, e foi pensado para isso: estudantes e freelancers em começo de carreira, que precisam de organização sem pagar caro.'],
  ['funciona no celular?', 'Sim, no celular, tablet e computador, com os mesmos dados em todos os aparelhos. Dá para instalar como aplicativo na tela inicial.'],
  ['meus dados ficam seguros?', 'Cada conta é separada e protegida pelo seu login: ninguém mais vê seus clientes e valores. E você pode baixar tudo quando quiser.'],
  ['qual a diferença entre os planos?', 'No Essencial o orçamento sai como texto pronto para o WhatsApp. O Completo gera proposta, recibos e contratos em PDF com a sua identidade, e ainda tem agenda no celular e planejamento do instagram.'],
  ['posso cancelar quando quiser?', 'Pode. Não tem fidelidade nem multa.'],
]

type Screen = 'painel' | 'demandas' | 'proposta' | 'contrato' | 'financeiro'
const SCREENS: { id: Screen; label: string; icon: string }[] = [
  { id: 'painel', label: 'painel', icon: 'home' },
  { id: 'demandas', label: 'demandas', icon: 'folder' },
  { id: 'proposta', label: 'proposta', icon: 'file' },
  { id: 'contrato', label: 'contrato', icon: 'briefcase' },
  { id: 'financeiro', label: 'financeiro', icon: 'wallet' },
]

/** Elementos com data-reveal aparecem suavemente ao entrar na tela. */
function useReveal(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    el.classList.add('lp-anim')
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    el.querySelectorAll('[data-reveal]').forEach((x) => io.observe(x))
    return () => io.disconnect()
  }, [root])
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null)
  useReveal(root)
  useEffect(() => {
    applyTheme(DEFAULT_SETTINGS)
    document.title = `${PLATFORM.name} · ${PLATFORM.tagline}`
    window.scrollTo(0, 0)
  }, [])
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const signup = (plan?: PlanId) => go('cadastro', plan)
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="lp" ref={root}>
      <header className={`lp-top ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="lp-wrap lp-top-in">
          <a className="brand-name lp-logo" href="#/vendas" onClick={(e) => (e.preventDefault(), window.scrollTo({ top: 0, behavior: 'smooth' }))}>
            {PLATFORM.name}
            <i>.</i>
          </a>
          <nav className="lp-nav">
            {[
              ['jornada', 'como funciona'],
              ['telas', 'telas'],
              ['planos', 'planos'],
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
        <div className="lp-blobs" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="lp-wrap lp-hero-in">
          <div className="lp-hero-text">
            <p className="lp-kicker">
              <span className="lp-dot" /> feito para freelancers criativos
            </p>
            <h1>
              sua vida de freelancer, <RotatingWord words={WORDS} />
            </h1>
            <p className="lp-lead">Clientes, orçamentos, prazos e pagamentos num lugar só. Do primeiro “oi” ao recibo.</p>
            <div className="row gap-s wrap">
              <button className="btn primary lp-cta lp-shine" onClick={() => signup()}>
                testar grátis por {TRIAL_DAYS} dias <Icon name="arrowRight" size={16} />
              </button>
              <button className="btn ghost lp-cta" onClick={() => scrollTo('jornada')}>
                ver como funciona
              </button>
            </div>
            <p className="muted small">sem cartão · cancele quando quiser</p>
          </div>
          <div className="lp-hero-art" aria-hidden>
            <Frame>
              <PainelScreen compact />
            </Frame>
            <div className="lp-float lp-float-1">
              <span className="lp-float-icon is-good">
                <Icon name="check" size={14} />
              </span>
              <span>
                <b>orçamento aprovado</b>
                <small>Casa Pampulha · R$ 1.620</small>
              </span>
            </div>
            <div className="lp-float lp-float-2">
              <span className="lp-float-icon">
                <Icon name="wallet" size={14} />
              </span>
              <span>
                <b>sinal recebido</b>
                <small>+ R$ 810,00</small>
              </span>
            </div>
            <div className="lp-float lp-float-3">
              <span className="lp-float-icon is-warn">
                <Icon name="clock" size={14} />
              </span>
              <span>
                <b>entrega amanhã</b>
                <small>suíte master · 3 imagens</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-marquee" aria-hidden>
        <div className="lp-marquee-track">
          {[...FEATURES, ...FEATURES].map((f, i) => (
            <span key={i}>
              {f} <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      <section className="lp-section lp-story-sec">
        <div className="lp-wrap lp-story" data-reveal>
          <span className="lp-me" aria-hidden>
            {PLATFORM.owner[0]}
          </span>
          <p className="eyebrow">quem criou</p>
          <h2>
            oi, eu sou a <em>{PLATFORM.owner}</em>
          </h2>
          <p className="lp-story-text">
            Sou estudante de arquitetura e trabalho como freelancer com renderização, modelagem e detalhamento. Quando saí do estágio e comecei a atender meus próprios clientes, senti falta de um lugar que juntasse tudo: orçamentos, prazos,
            pagamentos, contratos e a agenda da faculdade. Então criei o meu próprio sistema, do jeito que a rotina de freelancer pede.
          </p>
          <p className="lp-story-text">Ele organizou tanto o meu trabalho que resolvi abrir para outros freelancers, com uma assinatura que cabe no bolso de quem está começando.</p>
          <p className="lp-sign">
            {PLATFORM.owner} · criadora do {PLATFORM.name}
          </p>
        </div>
      </section>

      <section className="lp-section lp-alt" id="jornada">
        <div className="lp-wrap">
          <SectionHead eyebrow="como funciona" title={<>do primeiro “oi” <em>ao recibo</em></>} />
          <Journey />
        </div>
      </section>

      <section className="lp-section" id="telas">
        <div className="lp-wrap">
          <SectionHead eyebrow="por dentro" title={<>telas de <em>verdade</em></>} text="Dados de exemplo, sistema real. Toque para explorar." />
          <div data-reveal>
            <Screens />
          </div>
        </div>
      </section>

      <section className="lp-section lp-for">
        <div className="lp-wrap lp-for-in" data-reveal>
          <h2>
            feito para quem <em>trabalha por conta própria</em>
          </h2>
          <div className="lp-for-list">
            {AUDIENCE.map((a, i) => (
              <span key={a.title} className="lp-chip" style={{ animationDelay: `${i * 0.08}s` }}>
                <Icon name={a.icon} size={18} /> {a.title}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-alt" id="planos">
        <div className="lp-wrap">
          <SectionHead eyebrow="planos" title={<>preço de freelancer, <em>sem fidelidade</em></>} text={`Comece com ${TRIAL_DAYS} dias grátis. Depois, escolha o que faz sentido para você.`} />
          <div className="pf-plan-cards lp-plans">
            {PLAN_LIST.map((p, i) => (
              <article key={p.id} className={`card pf-plan ${p.featured ? 'is-featured' : ''}`} data-reveal style={{ transitionDelay: `${i * 0.1}s` }}>
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
                  {(p.id === 'completo' ? p.highlights : p.highlights.slice(0, 6)).map((h) => (
                    <li key={h}>
                      <Icon name="check" size={14} /> {h}
                    </li>
                  ))}
                </ul>
                <button className={`btn ${p.featured ? 'primary' : ''} block`} onClick={() => signup(p.id)}>
                  começar grátis
                </button>
              </article>
            ))}
          </div>
          <details className="card lp-compare">
            <summary>
              comparar os planos <Icon name="plus" size={16} />
            </summary>
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
          </details>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-testimonials">
            {TESTIMONIALS.map((t, i) => (
              <figure key={t.name} className="lp-quote" data-reveal style={{ transitionDelay: `${i * 0.12}s` }}>
                <blockquote>“{t.text}”</blockquote>
                <figcaption>
                  <b>{t.name}</b> <span className="muted">· {t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="muted small center">depoimentos ilustrativos (exemplo)</p>
        </div>
      </section>

      <section className="lp-section lp-alt" id="duvidas">
        <div className="lp-wrap lp-faq-wrap">
          <SectionHead eyebrow="dúvidas" title={<>perguntas <em>frequentes</em></>} />
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
        <div className="lp-blobs is-dark" aria-hidden>
          <i />
          <i />
        </div>
        <div className="lp-wrap lp-final-in" data-reveal>
          <h2>
            sua próxima entrega, <em>mais leve</em>
          </h2>
          <p>{TRIAL_DAYS} dias grátis para experimentar com calma.</p>
          <button className="btn light lp-cta lp-shine" onClick={() => signup()}>
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
            feito por quem projeta · {new Date().getFullYear()}
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

/** Palavra do título que troca sozinha, com um deslize suave. */
function RotatingWord({ words }: { words: string[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % words.length), 2600)
    return () => clearInterval(t)
  }, [words.length])
  return (
    <em className="lp-rotate" aria-label={words[0]}>
      <span key={i} className="lp-rotate-word">
        {words[i]}
      </span>
    </em>
  )
}

/** Jornada em 4 passos: avança sozinha (pausa ao tocar) e mostra um cartão animado de cada etapa. */
function Journey() {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setStep((n) => (n + 1) % JOURNEY.length), 4200)
    return () => clearInterval(t)
  }, [paused])
  const j = JOURNEY[step]
  return (
    <div className="lp-journey" data-reveal>
      <ol className="lp-steps-nav">
        {JOURNEY.map((x, i) => (
          <li key={x.step}>
            <button
              className={i === step ? 'active' : i < step ? 'done' : ''}
              onClick={() => {
                setStep(i)
                setPaused(true)
              }}
            >
              <span className="lp-step-icon">
                <Icon name={x.icon} size={18} />
              </span>
              <span className="lp-step-label">{x.step}</span>
              {i === step && !paused && <i className="lp-step-bar" />}
            </button>
          </li>
        ))}
      </ol>
      <div className="lp-journey-body" key={step}>
        <div className="lp-journey-text">
          <span className="lp-journey-n">0{step + 1}</span>
          <h3>{j.title}</h3>
          <p className="muted">{j.text}</p>
        </div>
        <div className="lp-journey-card">
          {j.card.map((c, i) => (
            <div key={c.k} className={`lp-jc-row ${c.tone ? `is-${c.tone}` : ''}`} style={{ animationDelay: `${0.1 + i * 0.12}s` }}>
              <span>{c.k}</span>
              <b>{c.v}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: string }) {
  return (
    <div className="lp-head" data-reveal>
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
        <p className="muted small">No plano Completo: escolha um modelo e personalize com o seu logo, cores e fontes. No Essencial, o orçamento vai como texto pronto para o WhatsApp.</p>
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
