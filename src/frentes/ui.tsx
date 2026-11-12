import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { BrandMark } from '../components/PlaneMark'
import { Icon } from '../components/Icon'
import { PLATFORM } from '../plans'
import { FRENTES, instaUrl, type FrenteInfo } from './frentes'

/* Peças das páginas públicas da planê, com o mesmo desenho da página de vendas da planê.arq
   (classes lp-* de src/platform.css): topo de vidro, título com itálico, janela de navegador,
   cartões flutuantes, faixa que corre, seções alternadas, faixa escura no fim e rodapé. */

/** Elementos com data-reveal aparecem suavemente ao entrar na tela (igual à página de vendas). */
export function useReveal(root: RefObject<HTMLDivElement | null>, key: unknown = 0) {
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
    el.querySelectorAll('[data-reveal]:not(.is-in), [data-stagger]:not(.is-in)').forEach((x) => io.observe(x))
    el.querySelectorAll<HTMLElement>('[data-stagger]').forEach((g) => Array.from(g.children).forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i))))
    return () => io.disconnect()
  }, [root, key])
}

export function useScrolled() {
  const [s, setS] = useState(false)
  useEffect(() => {
    const on = () => setS(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return s
}

export const rolar = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

/** Topo de vidro: marca, as três frentes e as ações. */
export function Topo({ atual, acoes }: { atual?: FrenteInfo; acoes?: ReactNode }) {
  const scrolled = useScrolled()
  return (
    <header className={`lp-top ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="lp-wrap lp-top-in">
        <a className="brand-name lp-logo fr-logo" href="#/plane" aria-label="planê: página principal">
          <BrandMark place="topo" size={36} />
          <span>
            {PLATFORM.name}
            {atual && <em>.{atual.marca}</em>}
          </span>
        </a>
        <nav className="lp-nav" aria-label="frentes da planê">
          {FRENTES.map((f) => (
            <a key={f.id} className={`link ${atual?.id === f.id ? 'fr-on' : ''}`} href={f.rota}>
              {f.marca}
            </a>
          ))}
        </nav>
        <div className="row gap-s">{acoes}</div>
      </div>
    </header>
  )
}

export function Cabeca({ eyebrow, title, text, centro }: { eyebrow: string; title: ReactNode; text?: string; centro?: boolean }) {
  return (
    <div className={`lp-head ${centro ? 'fr-head-c' : ''}`} data-reveal>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {text && <p className="muted">{text}</p>}
    </div>
  )
}

/** Janela de navegador (como as telas da página de vendas). */
export function Janela({ children, label = PLATFORM.domain }: { children: ReactNode; label?: string }) {
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

export function Flutua({ n, icone, titulo, sub, tom }: { n: 1 | 2 | 3; icone: string; titulo: string; sub: string; tom?: 'good' | 'warn' }) {
  return (
    <div className={`lp-float lp-float-${n}`}>
      <span className={`lp-float-icon ${tom ? `is-${tom}` : ''}`}>
        <Icon name={icone} size={14} />
      </span>
      <span>
        <b>{titulo}</b>
        <small>{sub}</small>
      </span>
    </div>
  )
}

/** Faixa rosé com palavras que correm. */
export function Faixa({ itens }: { itens: string[] }) {
  return (
    <div className="lp-marquee" aria-hidden>
      <div className="lp-marquee-track">
        {[...itens, ...itens].map((f, i) => (
          <span key={i}>
            {f} <i>✦</i>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Faixa escura do fim, com a chamada principal. */
export function Final({ titulo, texto, botao, href }: { titulo: ReactNode; texto: string; botao: string; href: string }) {
  return (
    <section className="lp-final">
      <div className="lp-wrap lp-final-in" data-reveal>
        <h2>{titulo}</h2>
        <p>{texto}</p>
        <a className="btn light lp-cta lp-shine" href={href}>
          {botao} <Icon name="arrowRight" size={16} />
        </a>
      </div>
    </section>
  )
}

export function Rodape() {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap">
        <div className="lp-foot-grid">
          <div className="lp-foot-brand">
            <span className="brand-name lp-foot-logo">
              <BrandMark place="rodape" size={46} />
              {PLATFORM.name}
            </span>
            <p className="muted">Arquivos prontos para quem atende cliente, gestão para quem projeta e guias para quem compra apê.</p>
            <div className="lp-foot-icons">
              <a href={instaUrl(PLATFORM.instagram)} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Icon name="instagram" size={18} />
              </a>
              <a href={`mailto:${PLATFORM.email}`} aria-label="E-mail">
                <Icon name="mail" size={18} />
              </a>
            </div>
          </div>
          <nav className="lp-foot-col" aria-label="Frentes">
            <b>a planê</b>
            {FRENTES.map((f) => (
              <a key={f.id} className="lp-foot-link" href={f.rota}>
                {f.nome}
              </a>
            ))}
            <a className="lp-foot-link" href="#/entrar">
              entrar na minha conta
            </a>
          </nav>
          <div className="lp-foot-col">
            <b>fale com a gente</b>
            <a className="lp-foot-link" href={`mailto:${PLATFORM.email}`}>
              <Icon name="mail" size={16} /> {PLATFORM.email}
            </a>
            {FRENTES.map((f) => (
              <a key={f.id} className="lp-foot-link" href={instaUrl(f.instagram)} target="_blank" rel="noreferrer">
                <Icon name="instagram" size={16} /> {f.instagram}
              </a>
            ))}
          </div>
        </div>
        <div className="lp-foot-bottom">
          <span>
            © {new Date().getFullYear()} {PLATFORM.name} · todos os direitos reservados
          </span>
          <span>arquivos · gestão · apê</span>
        </div>
      </div>
    </footer>
  )
}
