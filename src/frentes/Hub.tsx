import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { BrandMark } from '../components/PlaneMark'
import { frente, type FrenteInfo } from './frentes'
import { TRIAL_DAYS } from '../plans'
import { BarraPlataformas, Iphone, Final, Rodape, Topo, rolar, useReveal, Manchas } from './ui'
import './frentes.css'

const FaleComigo = lazy(() => import('../ape/FaleComigo').then((m) => ({ default: m.FaleComigo })))

/* Página principal da planê (useplane.com.br para quem não está logado), no desenho da página de vendas
   da planê.arq: o que é a planê e as três frentes, cada uma com os seus arquivos de verdade. */

const AM = (f: string) => `ape/amostras/${f}`

const LINHAS: { f: FrenteInfo; titulo: string; itens: string[]; imgs: [string, string, string]; precos: string; extra?: [string, string] }[] = [
  {
    f: frente('arquivos'),
    titulo: 'para quem atende cliente',
    itens: ['para beleza, saúde e arquitetura: nail, lash, biomedicina, dentista, médico e mais', 'para imprimir e para mandar no WhatsApp e nos stories', 'nos 4 estilos, editáveis no Canva, no Word e no Excel'],
    imgs: [AM('t-beleza-stories-mes.webp'), AM('t-sob-cuidados.webp'), AM('t-beleza-cartao-agendamento.webp')],
    precos: 'a partir de R$ 9,90',
  },
  {
    f: frente('arq'),
    titulo: 'para quem projeta',
    itens: ['clientes, orçamentos, propostas e contratos num lugar só', 'prazos, agenda e cobranças do escritório', 'proposta aprovada pelo link, direto pelo cliente'],
    imgs: [AM('t-gestao.webp'), AM('t-gestao.webp'), AM('t-gestao.webp')],
    precos: `${TRIAL_DAYS} dias grátis, sem cartão`,
    extra: ['já sou assinante', '#/entrar'],
  },
  {
    f: frente('apzinho'),
    titulo: 'para quem compra apê',
    itens: ['guias da compra, do financiamento e dos acabamentos', 'checklist de vistoria e planilhas da obra', 'plataforma para acompanhar tudo por 12 meses'],
    imgs: [AM('m-kit-completo.jpg'), AM('m-checklist.jpg'), AM('m-planilha.jpg')],
    precos: 'arquivos a partir de R$ 12,90',
  },
]


export function Hub() {
  const root = useRef<HTMLDivElement>(null)
  const [chat, setChat] = useState(false)
  useReveal(root)
  useEffect(() => {
    document.title = 'Planê · arquivos, gestão e apê'
    // o balão de ajuda carrega depois da página (com o estilo dele)
    const t = window.setTimeout(() => void import('../ape/ape.css').then(() => setChat(true)), 1800)
    window.scrollTo(0, 0)
    // a vitrine já vai baixando enquanto a pessoa lê (o toque no card abre na hora)
    const pre = () => void import('./Vitrine')
    const w = window as Window & { requestIdleCallback?: (f: () => void) => number }
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
    if (w.requestIdleCallback) w.requestIdleCallback(pre)
    else setTimeout(pre, 1500)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div className="lp fr" ref={root}>
      <BarraPlataformas atual="plane" />
      <Topo
        acoes={
          <>
            <a className="btn ghost small" href="#/entrar">
              entrar
            </a>
            <a className="btn primary small" href="#/arquivos">
              ver os arquivos
            </a>
          </>
        }
      />

      <section className="lp-hero fr-hub-hero">
        <Manchas />
        <div className="lp-wrap fr-hub-hero-in">
          <p className="lp-kicker">
            <span className="lp-dot" /> arquivos, gestão e apê, num lugar só
          </p>
          <h1>
            o seu trabalho e a sua casa, <em>organizados</em>
          </h1>
          <p className="lp-lead">Um site para cada momento: atender cliente, projetar ou comprar o seu apê.</p>
          <div className="row gap-s wrap fr-hub-ctas">
            <button className="btn primary lp-cta" onClick={() => rolar('frentes')}>
              conhecer os sites <Icon name="arrowRight" size={16} />
            </button>
            <a className="btn ghost lp-cta" href="#/arquivos">
              ver os arquivos
            </a>
          </div>
        </div>
      </section>

      <section id="frentes" className="lp-section fr-hub-sites">
        <div className="lp-wrap fr-sites">
          {LINHAS.map((l, i) => (
            <article key={l.f.id} className="fr-site" data-reveal style={{ transitionDelay: `${i * 0.08}s` }}>
              <a className="fr-site-img" href={l.f.rota} aria-label={l.f.botao}>
                {l.f.id === 'arquivos' ? (
                  <span className="fr-site-arte">
                    <img className="pg1" src={AM('p-bio-toxina-1--delicado.webp')} alt="" loading="lazy" decoding="async" />
                    <img className="pg2" src={AM('p-odonto-anamnese-1--delicado.webp')} alt="" loading="lazy" decoding="async" />
                    <Iphone className="cel" src={AM('e-beleza-agenda-dezembro--delicado.webp')} />
                  </span>
                ) : (
                  <img src={l.imgs[0]} alt="" loading="lazy" decoding="async" width={1200} height={900} />
                )}
              </a>
              <div className="fr-site-t">
                <p className="eyebrow">{l.titulo}</p>
                <h2>
                  planê<em>.{l.f.marca}</em>
                </h2>
                <p className="fr-site-frase">{l.f.frase}</p>
                <ul className="fr-checks">
                  {l.itens.map((t) => (
                    <li key={t}>
                      <Icon name="check" size={15} /> {t}
                    </li>
                  ))}
                </ul>
                <span className="muted small">{l.precos}</span>
                <div className="fr-site-acts">
                  <a className="btn primary lp-cta" href={l.f.rota}>
                    {l.f.botao} <Icon name="arrowRight" size={16} />
                  </a>
                  {l.extra && (
                    <a className="fr-site-extra" href={l.extra[1]}>
                      {l.extra[0]}
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>


      <section className="lp-section lp-story-sec lp-alt">
        <div className="lp-wrap lp-story lp-me-story" data-reveal>
          <span className="lp-me-wrap">
            <span className="lp-me fr-me">
              <BrandMark place="rodape" size={46} />
            </span>
          </span>
          <p className="eyebrow">a planê</p>
          <h2>
            pensada para o <em>dia a dia</em>
          </h2>
          <p className="lp-story-text">
            A planê cria arquivos e ferramentas para quem atende cliente: modelos prontos para a beleza e para a arquitetura, a gestão para quem projeta e um guia para quem está
            comprando o primeiro apê. Tudo é testado no uso real antes de chegar até você.
          </p>
        </div>
      </section>

      <Final titulo={<>comece pelo que você <em>precisa hoje</em></>} texto={`Arquivos que baixam na hora e gestão com ${TRIAL_DAYS} dias grátis.`} botao="ver os arquivos" href="#/arquivos" />
      <Rodape />
      {chat && <div className="ape fr-ape"><Suspense fallback={null}><FaleComigo me={null} whats="" origem="visitante" /></Suspense></div>}
    </div>
  )
}
