import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, demoData } from '../store'
import { applyTheme } from '../theme'
import { Icon } from '../components/Icon'
import { BarChart } from '../components/Charts'
import { compareRows, PLANS, PLAN_LIST, PLATFORM, TRIAL_DAYS, money0, type PlanId } from '../plans'
import { platform, type PublicFeedback } from '../platform'
import { DEFAULT_SITE, extraFaq, freshSite, type SiteContent } from '../siteContent'
import { TEMPLATES } from '../proposalTemplates'
import { STATUS, allPayments, deadlineInfo, fmtDate, isOpen, money, paymentState, quoteTotal, urgencyScore } from '../utils'
import type { Settings } from '../types'
import { go } from '../router'

const LandingDoc = lazy(() => import('./LandingDocs'))
import { LANDING_PROFILE_KEY } from '../components/Signup'

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

// a mesma jornada, para quem atende cliente final (arquiteto, designer, escritório)
const JOURNEY_FINAL: typeof JOURNEY = [
  {
    icon: 'whatsapp',
    step: 'o cliente chama',
    title: 'a ficha completa do cliente',
    text: 'profissão, estado civil, quem mora, pets, rotina e o imóvel: tudo o que importa para o projeto, num lugar só.',
    card: [
      { k: 'cliente', v: 'Família Souza' },
      { k: 'imóvel', v: 'apartamento · 85 m²' },
      { k: 'quem mora', v: 'casal, 2 filhos e 1 gato' },
    ],
  },
  {
    icon: 'link',
    step: 'briefing',
    title: 'o briefing responde sozinho',
    text: 'no plano Estúdio, mande um link: o cliente responde pelo celular, sem criar conta, e as respostas preenchem a ficha.',
    card: [
      { k: 'estilo', v: 'aconchegante, madeira clara' },
      { k: 'ambientes', v: 'sala, cozinha, 2 quartos' },
      { k: 'status', v: 'respondido ✓', tone: 'good' },
    ],
  },
  {
    icon: 'file',
    step: 'proposta',
    title: 'projeto, complementares e regularização',
    text: 'a tabela vem organizada por grupos: consultoria, projeto, complementares, regularização e obra. marque o que entra e o valor se calcula.',
    card: [
      { k: 'projeto de interiores · 85 m²', v: 'R$ 7.650,00' },
      { k: 'complementares: elétrico + hidro', v: 'R$ 1.700,00' },
      { k: 'total', v: 'R$ 9.350,00', tone: 'strong' },
    ],
  },
  {
    icon: 'wallet',
    step: 'obra e pagamentos',
    title: 'contrato, obra e parcelas em dia',
    text: 'contrato com os dados da proposta, visitas de obra na agenda e cada parcela no financeiro, com cobrança pronta.',
    card: [
      { k: 'contrato', v: 'assinado ✓', tone: 'good' },
      { k: 'visita de obra', v: 'amanhã, 9h', tone: 'warn' },
      { k: 'recebido no mês', v: 'R$ 12.400,00', tone: 'strong' },
    ],
  },
]
type Aud = 'freelancer' | 'final'
const PLAN_FOR: Record<PlanId, string> = {
  essencial: 'para quem está começando ou trabalha sozinho',
  completo: 'para quem manda proposta com a própria marca',
  estudio: 'para quem atende cliente final (e freelancers que querem tudo)',
}
const readAud = (): Aud => {
  try {
    return localStorage.getItem(LANDING_PROFILE_KEY) === 'freelancer' ? 'freelancer' : 'final'
  } catch {
    return 'final'
  }
}

// o que o plano Estúdio tem a mais (seção própria na página de vendas)
const STUDIO_FEATURES: { icon: string; title: string; text: string; points: string[] }[] = [
  { icon: 'link', title: 'página do projeto para o cliente', text: 'Um link que o cliente abre no celular e acompanha tudo, sempre atualizado.', points: ['etapas e prazos', 'o que já foi pago e o que falta', 'arquivos e visitas de obra'] },
  { icon: 'calendar', title: 'cronograma das etapas', text: 'Levantamento, estudo, anteprojeto, executivo, aprovação e obra, cada uma com prazo.', points: ['etapas prontas de arquitetura e interiores', 'parcela ligada a cada etapa', 'aviso de etapa atrasada'] },
  { icon: 'hardhat', title: 'acompanhamento de obra', text: 'Cada visita registrada pelo celular, com fotos e o que ficou para depois.', points: ['fotos direto da câmera', 'próximos passos e pendências', 'relatório em PDF com a sua marca'] },
  { icon: 'trend', title: 'custos e lucro por projeto', text: 'Saiba se o projeto deu lucro de verdade, não só quanto entrou.', points: ['taxas, impressões, deslocamento', 'horas trabalhadas', 'quanto rendeu cada hora sua'] },
  { icon: 'clip', title: 'briefing online completo', text: 'Mais de 20 modelos que o cliente responde pelo celular, tocando nas imagens.', points: ['studio, infantil, arquitetônico, clínica, loja…', 'perguntas que aparecem conforme a resposta', 'as respostas preenchem a ficha'] },
  { icon: 'ruler', title: 'documentos com a sua marca', text: 'Peças prontas no design que você escolher, com qualquer texto editável.', points: ['guia de medição para o cliente', 'placa de obra com QR code', 'apresentação de projeto e briefing em PDF'] },
]

const FEATURES = ['clientes', 'ficha do cliente final', 'orçamentos', 'propostas', 'projetos complementares', 'regularização', 'contratos', 'prazos', 'agenda', 'financeiro', 'recibos', 'cobrança no WhatsApp', 'sua identidade visual', 'celular e computador']

const AUDIENCE = [
  { icon: 'compass', title: 'arquitetos' },
  { icon: 'sofa', title: 'designers de interiores' },
  { icon: 'building', title: 'escritórios' },
  { icon: 'cube', title: 'visualização 3D' },
  { icon: 'ruler', title: 'freelancers de projeto' },
  { icon: 'cap', title: 'estudantes' },
]


// frases do que o sistema resolve, enquanto não há depoimentos reais escolhidos no painel
const BENEFITS = [
  { icon: 'wallet', title: 'cobrança', hint: 'lembrete e mensagem prontos', text: 'parar de esquecer de cobrar o saldo: a mensagem já sai pronta.' },
  { icon: 'file', title: 'orçamento', hint: 'pela sua tabela de preços', text: 'o orçamento que levava uma hora sai em dez minutos.' },
  { icon: 'trend', title: 'financeiro', hint: 'recebido, a receber e despesas', text: 'saber, de verdade, quanto você lucra por mês.' },
]

const faq = (): [string, ReactNode][] => [
  ['preciso de cartão para testar?', `Não. São ${TRIAL_DAYS} dias grátis com tudo do plano escolhido, sem cadastrar cartão.`],
  ['para quem é o sistema?', 'Para quem vive de projeto: arquitetos, designers de interiores e escritórios que atendem o cliente final, e freelancers que prestam serviço para escritórios (3D, executivo, apresentação). No cadastro você diz como trabalha e o sistema já vem pronto para isso. Quem faz os dois usa tudo na mesma conta.'],
  ['serve para quem está começando?', 'Serve: estudantes e profissionais em começo de carreira, que precisam de organização sem pagar caro, começam bem no Essencial.'],
  ['serve para escritório que atende cliente final?', 'Serve. O cliente final ganha uma ficha completa (profissão, família, rotina e o imóvel) e a tabela de preços já vem organizada: consultoria, projeto, projetos complementares (estrutural, elétrico, hidrossanitário…), regularização e obra. No plano Estúdio ainda tem a página do projeto para o cliente, o cronograma das etapas, o acompanhamento de obra, o lucro de cada projeto e o briefing online.'],
  ['funciona no celular?', 'Sim, no celular, tablet e computador, com os mesmos dados em todos os aparelhos. Dá para instalar como aplicativo na tela inicial.'],
  ['meus dados ficam seguros?', 'Cada conta é separada e protegida pelo seu login: ninguém mais vê seus clientes e valores. E você pode baixar tudo quando quiser.'],
  ['qual a diferença entre os planos?', `No ${PLANS.essencial.name} você organiza clientes, orçamentos (em texto pronto para o WhatsApp), prazos e financeiro. O ${PLANS.completo.name} gera proposta, recibos e contratos em PDF com a sua identidade, e tem agenda no celular e planejamento do instagram. O ${PLANS.estudio.name} tem tudo do ${PLANS.completo.name} e as ferramentas de escritório: página do projeto para o cliente, cronograma das etapas, acompanhamento de obra com fotos, lucro de cada projeto e briefing online.`],
  [`o que mudou com o ${PLANS.estudio.name}?`, `Novidade: o ${PLATFORM.name} nasceu para freelancers e agora também é para quem trabalha direto com o cliente final (casas, apartamentos, lojas, obras). Foi um pedido de várias arquitetas. O ${PLANS.estudio.name} está aberto para todos e é o plano do teste grátis.`],
  ['posso cancelar quando quiser?', 'Pode, sem multa e sem fidelidade: o acesso vai até o fim do período já pago. E se você se arrepender, tem 7 dias depois do pagamento para cancelar com o dinheiro de volta (direito de arrependimento, art. 49 do Código de Defesa do Consumidor).'],
  ['o teste grátis é de qual plano?', `Do ${PLANS.estudio.name}, o mais completo, com tudo liberado por ${TRIAL_DAYS} dias. Depois você escolhe o plano que faz mais sentido.`],
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
function useReveal(root: React.RefObject<HTMLDivElement | null>, key = 0) {
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
    // key muda quando entra conteúdo novo (ex.: depoimentos): observa só o que ainda não apareceu
    el.querySelectorAll('[data-reveal]:not(.is-in)').forEach((x) => io.observe(x))
    return () => io.disconnect()
  }, [root, key])
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null)
  // "quem criou", contatos e redes: a dona edita no painel da plataforma
  const [site, setSite] = useState<SiteContent>(DEFAULT_SITE)
  const off = (id: string) => (site.hidden ?? []).includes(id)
  const siteWords = (site.heroWords || '').split(',').map((w) => w.trim()).filter(Boolean)
  // depoimentos escolhidos pela dona no painel (sem nenhum, a seção não aparece)
  const [quotes, setQuotes] = useState<PublicFeedback[]>([])
  useEffect(() => {
    platform.site().then((c) => setSite(freshSite(c))).catch(() => undefined)
    platform.publishedFeedbacks().then(setQuotes).catch(() => undefined)
  }, [])
  useReveal(root, quotes.length)
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
  // "sou freelancer" / "atendo cliente final": troca textos e exemplos, e já vem marcado no cadastro
  const [aud, setAudState] = useState<Aud>(readAud)
  const setAud = (a: Aud) => {
    setAudState(a)
    try {
      localStorage.setItem(LANDING_PROFILE_KEY, a)
    } catch {
      /* ok */
    }
  }
  const final = aud === 'final'
  const heroWords = siteWords
  const signup = (plan?: PlanId) => go('cadastro', plan)
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // no celular os planos ficam lado a lado (arrastar): a escolha rápida centraliza o cartão
  const pickPlan = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  const [storyOpen, setStoryOpen] = useState(false)

  return (
    <div className="lp" ref={root}>
      {site.banner && <div className="lp-banner">{site.banner}</div>}
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
              ['estudio', 'estúdio'],
              ['planos', 'planos'],
            ].filter(([id]) => !off(id)).map(([id, label]) => (
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
            {site.kicker && (
              <p className="lp-kicker">
                <span className="lp-dot" /> {site.kicker}
              </p>
            )}
            <h1>
              {site.heroTitle} {heroWords.length > 0 && <RotatingWord words={heroWords} />}
            </h1>
            <p className="lp-lead">{site.lead}</p>
            <div className="row gap-s wrap">
              <button className="btn primary lp-cta lp-shine" onClick={() => signup()}>
                testar grátis por {TRIAL_DAYS} dias <Icon name="arrowRight" size={16} />
              </button>
              <button className="btn ghost lp-cta" onClick={() => scrollTo(off('jornada') ? (off('telas') ? 'planos' : 'telas') : 'jornada')}>
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
                <b>projeto aprovado</b>
                <small>Família Souza · R$ 9.350</small>
              </span>
            </div>
            <div className="lp-float lp-float-2">
              <span className="lp-float-icon">
                <Icon name="wallet" size={14} />
              </span>
              <span>
                <b>sinal recebido</b>
                <small>+ R$ 4.675,00</small>
              </span>
            </div>
            <div className="lp-float lp-float-3">
              <span className="lp-float-icon is-warn">
                <Icon name="clock" size={14} />
              </span>
              <span>
                <b>entrega amanhã</b>
                <small>renders da suíte · 3 imagens</small>
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
        <div className="lp-wrap lp-story lp-me-story" data-reveal>
          <span className="lp-me-wrap" aria-hidden={!site.photo}>
            <span className="lp-me">{site.photo ? <img src={site.photo} alt={site.name} /> : site.name[0]}</span>
          </span>
          <p className="eyebrow">quem criou</p>
          <h2>{site.title}</h2>
          {site.text
            .split(/\n\s*\n/)
            .filter((t) => t.trim())
            .map((t, i) => (
              <p key={i} className={`lp-story-text ${i > 0 && !storyOpen ? 'lp-story-more' : ''}`}>
                {t.trim()}
              </p>
            ))}
          {!storyOpen && site.text.split(/\n\s*\n/).filter((t) => t.trim()).length > 1 && (
            <button className="lp-story-toggle" onClick={() => setStoryOpen(true)}>
              continuar lendo
            </button>
          )}
          {site.signature && <p className="lp-sign">— {site.signature}</p>}
        </div>
      </section>

      {!off('jornada') && (
      <section className="lp-section lp-alt" id="jornada">
        <div className="lp-wrap">
          <SectionHead eyebrow="como funciona" title={<>do primeiro “oi” <em>ao recibo</em></>} />
          <div className="lp-aud-row">
            <span className="muted small">veja como fica para quem</span>
            <div className="lp-aud" role="tablist" aria-label="Como você trabalha">
              {(
                [
                  ['final', 'atende cliente final'],
                  ['freelancer', 'presta serviço para escritórios'],
                ] as [Aud, string][]
              ).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={aud === id} className={aud === id ? 'is-on' : ''} onClick={() => setAud(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* as duas versões no mesmo lugar: trocar de aba não muda a altura da faixa */}
          <div className="lp-journey-stack">
            <div className={`lp-journey-slot ${final ? 'is-active' : ''}`} aria-hidden={!final}>
              <Journey steps={JOURNEY_FINAL} paused={!final} />
            </div>
            <div className={`lp-journey-slot ${!final ? 'is-active' : ''}`} aria-hidden={final}>
              <Journey steps={JOURNEY} paused={final} />
            </div>
          </div>
        </div>
      </section>

      )}
      {!off('telas') && (
      <section className="lp-section" id="telas">
        <div className="lp-wrap">
          <SectionHead eyebrow="por dentro" title={<>telas de <em>verdade</em></>} text="Dados de exemplo, sistema real. Toque para explorar." />
          <div data-reveal>
            <Screens />
          </div>
        </div>
      </section>

      )}
      {!off('para') && (
      <section className="lp-section lp-for">
        <div className="lp-wrap lp-for-in" data-reveal>
          <h2>
            feito para quem <em>vive de projeto</em>
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

      )}
      <section className="lp-section lp-studio" id="estudio">
        <div className="lp-wrap">
          <SectionHead eyebrow={`novidade · plano ${PLANS.estudio.name.toLowerCase()}`} title={<>para quem atende <em>o cliente final</em></>} text={`Começamos com freelancers e, a pedido de várias arquitetas, agora é também para quem projeta direto para o cliente final: do briefing à obra. Tudo do ${PLANS.completo.name} e mais seis ferramentas.`} />
          <div className="lp-studio-grid">
            {STUDIO_FEATURES.map((f, i) => (
              <article key={f.title} className="card lp-studio-card" data-reveal style={{ transitionDelay: `${i * 0.06}s` }}>
                <span className="lp-studio-icon">
                  <Icon name={f.icon} size={20} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <ul>
                  {f.points.map((x) => (
                    <li key={x}>
                      <Icon name="check" size={13} /> {x}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="lp-swipe-hint" aria-hidden>
            arraste para o lado <Icon name="arrowRight" size={13} />
          </p>
          <div className="lp-studio-cta">
            <button className="btn primary" onClick={() => signup('estudio')}>
              <Icon name="star" size={15} /> testar o {PLANS.estudio.name} grátis
            </button>
            <span className="muted small">
              {TRIAL_DAYS} dias grátis, sem cartão · depois {money0(PLANS.estudio.price)}/mês
            </span>
          </div>
        </div>
      </section>

      <section className="lp-section lp-alt" id="planos">
        <div className="lp-wrap">
          <SectionHead eyebrow="planos" title={<>um plano para cada momento, <em className="nowrap">sem fidelidade</em></>} text={`Teste o ${PLANS.estudio.name} (o mais completo) grátis por ${TRIAL_DAYS} dias, sem cartão. Depois, escolha o plano do tamanho do seu trabalho.`} />
          <div className="lp-pick" data-reveal>
            <span className="muted small">escolha rápida:</span>
            <button onClick={() => pickPlan('plano-essencial')}>
              <Icon name="user" size={14} /> começando, texto no WhatsApp <b>{PLANS.essencial.name}</b>
            </button>
            <button onClick={() => pickPlan('plano-completo')}>
              <Icon name="file" size={14} /> freelancer com PDF e contratos <b>{PLANS.completo.name}</b>
            </button>
            <button onClick={() => pickPlan('plano-estudio')}>
              <Icon name="home" size={14} /> atende cliente final <b>{PLANS.estudio.name}</b>
            </button>
          </div>
          <div className="pf-plan-cards lp-plans">
            {PLAN_LIST.map((p, i) => (
              <article key={p.id} id={`plano-${p.id}`} className={`card pf-plan ${p.featured ? 'is-featured' : ''}`} data-reveal style={{ transitionDelay: `${i * 0.1}s` }}>
                {p.featured && <span className="lp-ribbon">mais escolhido</span>}
                <header>
                  <h3>{p.name}</h3>
                </header>
                <p className="lp-plan-for">{PLAN_FOR[p.id]}</p>
                <p className="pf-price">
                  {money0(p.price)}
                  <small>/mês</small>
                </p>
                <p className="muted small">{p.pitch}</p>
                <ul className="pf-checks">
                  {(p.featured ? p.highlights : p.highlights.slice(0, 6)).map((h) => (
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
          <p className="lp-swipe-hint" aria-hidden>
            arraste para ver os 3 planos <Icon name="arrowRight" size={13} />
          </p>
          <details className="card lp-compare">
            <summary>
              comparar os planos <Icon name="plus" size={16} />
            </summary>
            <table>
              <thead>
                <tr>
                  <th />
                  {PLAN_LIST.map((p) => (
                    <th key={p.id} className={p.featured ? 'is-best' : ''}>
                      {p.featured && <span className="lp-best-tag">recomendado</span>}
                      {p.name}
                      <small>{money0(p.price)}/mês</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows().map(([label, ...vals]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`center ${PLAN_LIST[i].featured ? 'is-best' : ''}`}>
                        {v === true ? <Icon name="check" size={16} className="text-good" /> : v === false ? <span className="muted">—</span> : <span className="small">{v}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  {PLAN_LIST.map((p) => (
                    <td key={p.id} className={`center ${p.featured ? 'is-best' : ''}`}>
                      <button className={`btn small ${p.featured ? 'primary' : 'ghost'}`} onClick={() => signup(p.id)}>
                        {p.featured ? `quero o ${p.name}` : 'começar'}
                      </button>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
            <p className="lp-compare-note">
              <Icon name="star" size={14} /> no {PLANS.completo.name} você tem proposta, recibo e contrato em PDF com a sua identidade, por {money0(PLANS.completo.price - PLANS.essencial.price)} a mais por mês. O {PLANS.estudio.name} é para quem atende cliente final: briefing online, cronograma, obra, página do cliente e documentos com a sua marca.
            </p>
          </details>
        </div>
      </section>

      {!off('depoimentos') && (
      <section className="lp-section">
        <div className="lp-wrap">
          <SectionHead eyebrow={quotes.length ? 'depoimentos' : 'na prática'} title={<>estúdios mais <em>tranquilos</em></>} />
          <div className="lp-testimonials">
            {quotes.length
              ? quotes.map((t, i) => (
                  <figure key={i} className="card lp-quote" data-reveal style={{ transitionDelay: `${i * 0.12}s` }}>
                    <span className="lp-stars" aria-label={`${t.stars} estrelas`}>
                      {'★'.repeat(t.stars)}
                    </span>
                    <blockquote>{t.text}</blockquote>
                    <figcaption>
                      <span className="lp-quote-avatar">{(t.name || '?')[0]}</span>
                      <span>
                        <b>{t.name}</b>
                        <small className="muted">{t.role}</small>
                      </span>
                    </figcaption>
                  </figure>
                ))
              : // sem depoimentos reais escolhidos ainda: o que o sistema resolve (sem nomes inventados)
                BENEFITS.map((t, i) => (
                  <figure key={i} className="card lp-quote" data-reveal style={{ transitionDelay: `${i * 0.12}s` }}>
                    <blockquote>{t.text}</blockquote>
                    <figcaption>
                      <span className="lp-quote-avatar">
                        <Icon name={t.icon} size={16} />
                      </span>
                      <span>
                        <b>{t.title}</b>
                        <small className="muted">{t.hint}</small>
                      </span>
                    </figcaption>
                  </figure>
                ))}
          </div>
        </div>
      </section>

      )}
      {!off('duvidas') && (
      <section className="lp-section lp-alt" id="duvidas">
        <div className="lp-wrap lp-faq-wrap">
          <SectionHead eyebrow="dúvidas" title={<>perguntas <em>frequentes</em></>} />
          <div className="lp-faq">
            {[...faq(), ...extraFaq(site.faqExtra)].map(([q, a]) => (
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

      )}
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
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <div className="lp-foot-brand">
              <span className="brand-name">
                {PLATFORM.name}
                <i>.</i>
              </span>
              <p className="muted">{site.about}</p>
              <button className="btn primary small" onClick={() => signup()}>
                testar grátis por {TRIAL_DAYS} dias <Icon name="arrowRight" size={14} />
              </button>
            </div>
            <nav className="lp-foot-col" aria-label="Navegação">
              <b>navegação</b>
              {[
                ['jornada', 'como funciona'],
                ['telas', 'telas'],
                ['planos', 'planos'],
                ['duvidas', 'dúvidas'],
              ]
                .filter(([id]) => !off(id))
                .map(([id, label]) => (
                  <button key={id} className="lp-foot-link" onClick={() => scrollTo(id)}>
                    {label}
                  </button>
                ))}
              <button className="lp-foot-link" onClick={() => go('entrar')}>
                entrar na minha conta
              </button>
            </nav>
            {(site.email || site.instagram || site.whatsapp) && (
              <div className="lp-foot-col">
                <b>fale com a gente</b>
                {site.email && (
                  <a className="lp-foot-link" href={`mailto:${site.email}`}>
                    <Icon name="mail" size={16} /> {site.email}
                  </a>
                )}
                {site.instagram && (
                  <a className="lp-foot-link" href={`https://instagram.com/${site.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">
                    <Icon name="instagram" size={16} /> {site.instagram.startsWith('@') ? site.instagram : `@${site.instagram}`}
                  </a>
                )}
                {site.whatsapp && (
                  <a className="lp-foot-link" href={`https://wa.me/${site.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                    <Icon name="whatsapp" size={16} /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="lp-foot-bottom">
            <span>
              © {new Date().getFullYear()} {PLATFORM.name} · todos os direitos reservados
            </span>
            <span>orçamentos · prazos · contratos · financeiro</span>
          </div>
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
    // todas as palavras ocupam o mesmo lugar (largura da maior): o título não muda de linha e a página não pula
    <em className="lp-rotate" aria-label={words[0]}>
      {words.map((w, n) => (
        <span key={n} className={`lp-rotate-word ${n === i ? 'is-on' : ''}`} aria-hidden={n !== i}>
          {w}
        </span>
      ))}
    </em>
  )
}

/** Jornada em 4 passos: avança sozinha (pausa ao tocar) e mostra um cartão animado de cada etapa. */
function Journey({ steps: JOURNEY, paused: hidden }: { steps: typeof JOURNEY_FINAL; paused?: boolean }) {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || hidden) return
    const t = setInterval(() => setStep((n) => (n + 1) % JOURNEY.length), 4200)
    return () => clearInterval(t)
  }, [paused, hidden])
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
      {/* todas as etapas ocupam o mesmo lugar: a altura não muda e a página não "pula" */}
      <div className="lp-journey-stage">
        {JOURNEY.map((j, n) => (
          <div key={j.step} className={`lp-journey-body ${n === step ? 'is-active' : ''}`} aria-hidden={n !== step}>
            <div className="lp-journey-text">
              <span className="lp-journey-n">{n + 1}.</span>
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
        ))}
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
  const touch = useRef(0)
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
        {/* todas as telas no mesmo lugar: a moldura fica sempre da mesma altura; no celular, dá para arrastar para o lado */}
        <div
          className="lp-screen-stage"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touch.current
            if (Math.abs(dx) < 50) return
            const i = SCREENS.findIndex((x) => x.id === screen)
            setScreen(SCREENS[(i + (dx < 0 ? 1 : SCREENS.length - 1)) % SCREENS.length].id)
          }}
        >
          {SCREENS.map((x) => (
            <div key={x.id} className={`lp-screen-slot ${screen === x.id ? 'is-active' : ''}`} aria-hidden={screen !== x.id}>
              {x.id === 'painel' && <PainelScreen />}
              {x.id === 'demandas' && <DemandasScreen />}
              {x.id === 'proposta' && <PropostaScreen />}
              {x.id === 'contrato' && <ContratoScreen />}
              {x.id === 'financeiro' && <FinanceiroScreen />}
            </div>
          ))}
        </div>
      </Frame>
      <div className="lp-screen-dots" aria-hidden>
        {SCREENS.map((x) => (
          <i key={x.id} className={screen === x.id ? 'is-on' : ''} />
        ))}
      </div>
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
      <Suspense fallback={<QuoteMock tpl={tpl} c={t.colors} total={money(quoteTotal(quote, SAMPLE.urgencyFee))} />}>
        <LandingDoc kind="proposta" s={{ ...SAMPLE, proposal: { ...SAMPLE.proposal, ...t.colors, template: tpl } }} quote={quote} client={d.clients.find((c) => c.id === quote.clientId)} />
      </Suspense>
    </div>
  )
}

function ContratoScreen() {
  const d = useDemo()
  const quote = d.quotes[0]
  return (
    <div className="lp-screen lp-split">
      <div className="lp-split-side">
        <b>contrato em 1 clique</b>
        <p className="muted small">Escolha o cliente e o orçamento: nome, CPF/CNPJ, serviços, valor por extenso, prazo e pagamento já vêm preenchidos. Dá para editar tudo.</p>
        <ul className="pf-checks">
          <li>
            <Icon name="check" size={14} /> modelos editáveis
          </li>
          <li>
            <Icon name="check" size={14} /> folhas A4, prontas para imprimir ou mandar em PDF
          </li>
          <li>
            <Icon name="check" size={14} /> avisa se faltar algum dado
          </li>
        </ul>
        <p className="muted small">Modelos de referência: revise com um advogado.</p>
      </div>
      <Suspense fallback={<ContractMock />}>
        <LandingDoc kind="contrato" s={SAMPLE} quote={quote} client={d.clients.find((c) => c.id === quote.clientId)} />
      </Suspense>
    </div>
  )
}

/** Linhas "de mentira" no lugar do texto: mostram o desenho da folha sem expor conteúdo. */
const Lines = ({ w }: { w: number[] }) => (
  <>
    {w.map((x, i) => (
      <i key={i} className="mk-line" style={{ width: `${x}%` }} />
    ))}
  </>
)

function ContractMock() {
  return (
    <div className="mk-stage" aria-label="Prévia ilustrativa de um contrato">
      <div className="mk-sheet mk-contract">
        <div className="mk-c-bar">
          <i className="mk-line" style={{ width: '28%' }} />
          <small>1/3</small>
        </div>
        <span className="mk-c-eyebrow">documento</span>
        <span className="mk-c-title">contrato</span>
        <div className="mk-c-block">
          <b>partes</b>
          <Lines w={[94, 70, 88, 52]} />
        </div>
        {['1. objeto', '2. prazo', '3. valor e pagamento'].map((c, n) => (
          <div key={c} className="mk-c-block">
            <b>{c}</b>
            <Lines w={n === 2 ? [84, 46] : [96, 90, 62]} />
          </div>
        ))}
        <div className="mk-c-signs">
          <span />
          <span />
        </div>
      </div>
      <span className="mk-tag mk-tag-1">
        <Icon name="check" size={12} /> cliente e CPF/CNPJ
      </span>
      <span className="mk-tag mk-tag-2">
        <Icon name="check" size={12} /> serviços do orçamento
      </span>
      <span className="mk-tag mk-tag-3">
        <Icon name="check" size={12} /> valor por extenso
      </span>
    </div>
  )
}

/** Orçamento ilustrativo, com as cores e o desenho do modelo escolhido. */
function QuoteMock({ tpl, c, total }: { tpl: string; c: { ink: string; rose: string; arch: string; paper: string; bar: string; serif: string }; total: string }) {
  const style = { '--mk-ink': c.ink, '--mk-rose': c.rose, '--mk-arch': c.arch, '--mk-paper': c.paper, '--mk-bar': c.bar, '--mk-serif': `'${c.serif}', 'Playfair Display', Georgia, serif` } as CSSProperties
  return (
    <div className="mk-stage" aria-label="Prévia ilustrativa de um orçamento">
      <div className={`mk-sheet mk-quote mk-q-${tpl}`} style={style}>
        <div className="mk-q-head">
          <i className="mk-q-logo" />
          <span className="mk-q-eyebrow">proposta de</span>
          <span className="mk-q-title">orçamento</span>
          <span className="mk-q-meta">
            <Lines w={[60, 40]} />
          </span>
        </div>
        <div className="mk-q-body">
          {[0, 1, 2].map((n) => (
            <div key={n} className="mk-q-row">
              <b>0{n + 1}</b>
              <span>
                <Lines w={[[70, 48], [58, 40], [64, 30]][n]} />
              </span>
              <em />
            </div>
          ))}
          <div className="mk-q-total">
            <span>investimento total</span>
            <b>{total}</b>
          </div>
          <div className="mk-q-foot">
            <Lines w={[40, 55, 30]} />
          </div>
        </div>
      </div>
      <span className="mk-tag mk-tag-1">
        <Icon name="check" size={12} /> seu logo e suas cores
      </span>
      <span className="mk-tag mk-tag-3">
        <Icon name="check" size={12} /> valor pela sua tabela
      </span>
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
