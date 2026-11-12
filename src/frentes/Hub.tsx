import { useEffect, useRef } from 'react'
import { Icon } from '../components/Icon'
import { BrandMark } from '../components/PlaneMark'
import { frente, type FrenteInfo } from './frentes'
import { Cabeca, Faixa, Final, Flutua, Janela, Rodape, Topo, rolar, useReveal } from './ui'
import './frentes.css'

/* Página principal da planê (useplane.com.br para quem não está logado), no desenho da página de vendas
   da planê.arq: o que é a planê e as três frentes, cada uma com os seus arquivos de verdade. */

const AM = (f: string) => `ape/amostras/${f}`

const LINHAS: { f: FrenteInfo; titulo: string; itens: string[]; imgs: [string, string, string]; precos: string }[] = [
  {
    f: frente('arquivos'),
    titulo: 'para quem atende cliente',
    itens: ['mais de 40 arquivos para a área da beleza', 'para imprimir e para mandar no WhatsApp e nos stories', 'com espaço para as suas fotos, no Canva, no Word e no Excel'],
    imgs: [AM('t-beleza-stories-mes.webp'), AM('t-sob-cuidados.webp'), AM('t-beleza-cartao-agendamento.webp')],
    precos: 'a partir de R$ 12,90',
  },
  {
    f: frente('arq'),
    titulo: 'para quem projeta',
    itens: ['proposta, contrato e briefing do jeito que o escritório usa', 'calculadora de honorários e manual do cliente', 'gestão completa com 14 dias grátis'],
    imgs: [AM('t-kit-arq-primeiro.webp'), AM('t-arq-honorarios.webp'), AM('t-arq-contrato.webp')],
    precos: 'modelos a partir de R$ 12,90',
  },
  {
    f: frente('apzinho'),
    titulo: 'para quem compra apê',
    itens: ['guias da compra, do financiamento e dos acabamentos', 'checklist de vistoria e planilhas da obra', 'plataforma para acompanhar tudo por 12 meses'],
    imgs: [AM('m-kit-completo.jpg'), AM('m-checklist.jpg'), AM('m-planilha.jpg')],
    precos: 'arquivos a partir de R$ 12,90',
  },
]

const FAIXA = ['stories do mês', 'fichas de anamnese', 'cuidados pós', 'visagismo', 'cartão de agendamento', 'contrato de noivas', 'precificação', 'propostas', 'honorários', 'vistoria do apê']

const PORQUE = [
  { icone: 'sparkle', t: 'pronto para usar', s: 'Troque o que está entre [colchetes] e mande no mesmo dia.' },
  { icone: 'edit', t: 'do seu jeito', s: 'Canva, Word, Google Docs e Excel: cores, textos e marca são seus.' },
  { icone: 'download', t: 'baixa na hora', s: 'Pagou no Pix ou no cartão, o botão de baixar aparece.' },
  { icone: 'heart', t: 'feito por quem usa', s: 'Cada arquivo nasce de uma necessidade real do dia a dia.' },
]

export function Hub() {
  const root = useRef<HTMLDivElement>(null)
  useReveal(root)
  useEffect(() => {
    document.title = 'Planê · arquivos, gestão e apê'
    window.scrollTo(0, 0)
    // a vitrine já vai baixando enquanto a pessoa lê (o toque no card abre na hora)
    const pre = () => void import('./Vitrine')
    const w = window as Window & { requestIdleCallback?: (f: () => void) => number }
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
    if (w.requestIdleCallback) w.requestIdleCallback(pre)
    else setTimeout(pre, 1500)
  }, [])
  return (
    <div className="lp fr" ref={root}>
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

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-in">
          <div className="lp-hero-text">
            <p className="lp-kicker">
              <span className="lp-dot" /> arquivos, gestão e apê, num lugar só
            </p>
            <h1>
              o seu trabalho e a sua casa, <em>organizados</em>
            </h1>
            <p className="lp-lead">Arquivos prontos para mandar hoje, gestão para quem projeta e guias para quem compra apê. Simples, bonito e do seu jeito.</p>
            <p className="lp-auto-chip">
              <Icon name="sparkle" size={14} /> baixa na hora ou testa grátis por 14 dias
            </p>
            <div className="row gap-s wrap">
              <a className="btn primary lp-cta lp-shine" href="#/arquivos">
                ver os arquivos <Icon name="arrowRight" size={16} />
              </a>
              <button className="btn ghost lp-cta" onClick={() => rolar('frentes')}>
                conhecer a planê
              </button>
            </div>
            <p className="muted small">Pix ou cartão · 7 dias para desistir</p>
          </div>
          <div className="lp-hero-art" aria-hidden>
            <Janela label="useplane.com.br/arquivos">
              <div className="fr-mini">
                {[
                  ['m2-beleza-stories-mes.webp', 'Kit stories do mês', 'R$ 24,90'],
                  ['m2-sob-cuidados.webp', 'Cuidados pós', 'R$ 14,90'],
                  ['m2-beleza-cartao-agendamento.webp', 'Cartão de agendamento', 'R$ 12,90'],
                  ['m2-beleza-precificacao.webp', 'Precificação', 'R$ 17,90'],
                ].map(([img, n, p]) => (
                  <span key={img} className="fr-mini-i">
                    <img src={AM(img)} alt="" width={240} height={180} />
                    <b>{n}</b>
                    <small className="num">{p}</small>
                  </span>
                ))}
              </div>
            </Janela>
            <Flutua n={1} icone="download" titulo="baixa na hora" sub="depois do Pix ou do cartão" tom="good" />
            <Flutua n={2} icone="edit" titulo="editável" sub="Canva, Word e Excel" />
            <Flutua n={3} icone="sparkle" titulo="14 dias grátis" sub="gestão planê.arq" tom="warn" />
          </div>
        </div>
      </section>

      <Faixa itens={FAIXA} />

      <div id="frentes">
        {LINHAS.map((l, i) => (
          <section key={l.f.id} className={`lp-section ${i % 2 === 0 ? 'lp-alt' : ''}`}>
            <div className={`lp-wrap fr-row ${i % 2 ? 'is-inv' : ''}`}>
              <div className="fr-row-t" data-reveal>
                <p className="eyebrow">
                  {String(i + 1).padStart(2, '0')} · {l.titulo}
                </p>
                <h2>
                  planê<em>.{l.f.marca}</em>
                </h2>
                <p className="fr-row-frase">{l.f.frase}</p>
                <ul className="fr-checks">
                  {l.itens.map((t) => (
                    <li key={t}>
                      <Icon name="check" size={16} /> {t}
                    </li>
                  ))}
                </ul>
                <div className="row gap-s wrap">
                  <a className="btn primary lp-cta" href={l.f.rota}>
                    {l.f.botao} <Icon name="arrowRight" size={16} />
                  </a>
                  <span className="muted small">{l.precos}</span>
                </div>
              </div>
              <a className="fr-colagem" href={l.f.rota} aria-label={l.f.botao} data-reveal>
                <img className="a" src={l.imgs[0]} alt="" loading="lazy" decoding="async" width={1200} height={900} />
                <img className="b" src={l.imgs[1]} alt="" loading="lazy" decoding="async" width={1200} height={900} />
                <img className="c" src={l.imgs[2]} alt="" loading="lazy" decoding="async" width={1200} height={900} />
              </a>
            </div>
          </section>
        ))}
      </div>

      <section className="lp-section lp-diffs">
        <div className="lp-wrap">
          <Cabeca eyebrow="por que a planê" title={<>simples por fora, <em>caprichado</em> por dentro</>} />
          <div className="lp-diffs-grid">
            {PORQUE.map((d, i) => (
              <article key={d.t} className="lp-diff" data-reveal style={{ transitionDelay: `${i * 0.08}s` }}>
                <span className="lp-diff-ico">
                  <Icon name={d.icone} size={20} />
                </span>
                <b>{d.t}</b>
                <small>{d.s}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-story-sec lp-alt">
        <div className="lp-wrap lp-story lp-me-story" data-reveal>
          <span className="lp-me-wrap">
            <span className="lp-me fr-me">
              <BrandMark place="rodape" size={46} />
            </span>
          </span>
          <p className="eyebrow">quem faz</p>
          <h2>
            feita por quem <em>usa</em>
          </h2>
          <p className="lp-story-text">
            A planê nasceu para organizar o trabalho de uma designer e estudante de arquitetura. Virou gestão para outros profissionais, loja de arquivos e um guia para quem está
            comprando o primeiro apê. Cada arquivo é usado na prática antes de ir para a loja.
          </p>
        </div>
      </section>

      <Final titulo={<>comece pelo que você <em>precisa hoje</em></>} texto="Arquivos que baixam na hora e gestão com 14 dias grátis." botao="ver os arquivos" href="#/arquivos" />
      <Rodape />
    </div>
  )
}
