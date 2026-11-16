import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { BrandMark } from '../components/PlaneMark'
import { Icon } from '../components/Icon'
import { PLATFORM } from '../plans'
import { FRENTES, instaUrl, type FrenteId, type FrenteInfo } from './frentes'
import './barra.css'

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
    const ver = () => {
      el.querySelectorAll('[data-reveal]:not(.is-in), [data-stagger]:not(.is-in)').forEach((x) => io.observe(x))
      el.querySelectorAll<HTMLElement>('[data-stagger]').forEach((g) => Array.from(g.children).forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i))))
    }
    ver()
    // o que entra depois (filtro, área, "ver mais") também aparece: nada fica invisível
    let t = 0
    const mo = new MutationObserver(() => { window.clearTimeout(t); t = window.setTimeout(ver, 30) })
    mo.observe(el, { childList: true, subtree: true })
    // garantia: o que já está na tela e não animou em 1,2 s aparece de qualquer jeito
    const seguro = window.setTimeout(() => el.querySelectorAll('[data-reveal]:not(.is-in)').forEach((x) => { const r = x.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) x.classList.add('is-in') }), 1200)
    return () => { io.disconnect(); mo.disconnect(); window.clearTimeout(t); window.clearTimeout(seguro) }
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
/** Barra das plataformas (a mesma em todas): planê, arquivos, arq e apê. Fica no alto da página e rola junto. */
export function BarraPlataformas({ atual }: { atual: FrenteId | 'plane' }) {
  return (
    <nav className="plat-barra" aria-label="plataformas da planê">
      <div className="plat-barra-in">
        <a href="#/plane" aria-current={atual === 'plane' ? 'page' : undefined}>planê</a>
        {FRENTES.map((f) => (
          <a key={f.id} href={f.rota} aria-current={atual === f.id ? 'page' : undefined}>planê.<em>{f.marca}</em></a>
        ))}
        <span className="plat-sep" />
        <a className="plat-conta" href="#/entrar">entrar na gestão</a>
      </div>
    </nav>
  )
}

export function Topo({ atual, acoes }: { atual?: FrenteInfo; acoes?: ReactNode }) {
  const scrolled = useScrolled()
  return (
    <header className={`lp-top ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="lp-wrap lp-top-in">
        <a className="brand-name lp-logo fr-logo" href={atual ? atual.rota : '#/plane'} aria-label={atual ? `${atual.nome}: início` : 'planê: página principal'}>
          <BrandMark place="topo" size={36} />
          <span>
            {PLATFORM.name}
            {atual && <em>.{atual.marca}</em>}
          </span>
        </a>
        <nav className="lp-nav" aria-label="plataformas da planê">
          {FRENTES.map((f) => (
            <a key={f.id} className={`link ${atual?.id === f.id ? 'fr-on' : ''}`} href={f.rota}>
              {f.marca}
            </a>
          ))}
        </nav>
        <div className="row gap-s fr-top-acoes">{acoes}</div>
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

/** Duas manchas desfocadas (azul e rosé) atrás de uma seção. Só no topo e em mais uma seção, para não repetir. */
export function Manchas({ v = 'a' }: { v?: 'a' | 'b' }) {
  return (
    <div className={`fr-manchas fr-manchas-${v}`} aria-hidden>
      <i />
      <i />
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

export function Rodape({ frente }: { frente?: FrenteId } = {}) {
  const insta = FRENTES.find((f) => f.id === frente)?.instagram || PLATFORM.instagram
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
              <a href={instaUrl(insta)} target="_blank" rel="noreferrer" aria-label={`Instagram ${insta}`}>
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
            <a className="lp-foot-link" href={instaUrl(insta)} target="_blank" rel="noreferrer">
              <Icon name="instagram" size={16} /> {insta}
            </a>
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

/** iPhone 15 Pro (70,6 × 146,6 mm): moldura de titânio, borda preta fina, Dynamic Island, botões.
 *  A tela imita o Instagram: story (9:16, fundo preto, hora, bateria e campo de mensagem) ou post do feed (4:5).
 *  O tipo sai da proporção da própria arte. */
export function Iphone({ src, className = '' }: { src: string; className?: string }) {
  const [post, setPost] = useState(false)
  const ver = (e: React.SyntheticEvent<HTMLImageElement>) => { const im = e.currentTarget; if (im.naturalWidth) setPost(im.naturalHeight / im.naturalWidth < 1.5) }
  const status = (
    <span className="iph-status">
      <b>9:41</b>
      <span className="iph-ico">
        <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx=".8" /><rect x="5" y="5.5" width="3" height="6.5" rx=".8" /><rect x="10" y="3" width="3" height="9" rx=".8" /><rect x="15" y="0" width="3" height="12" rx=".8" /></svg>
        <svg viewBox="0 0 16 12"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.3-1.4A10.4 10.4 0 0 0 8 .6 10.4 10.4 0 0 0 .7 3.6L2 5c1.6-1.5 3.7-2.4 6-2.4Zm0 3.8c1.3 0 2.5.5 3.4 1.3l1.3-1.4A6.8 6.8 0 0 0 8 4.4c-1.8 0-3.5.7-4.7 1.9l1.3 1.4c.9-.8 2.1-1.3 3.4-1.3Zm0 3.7c.5 0 .9.2 1.2.5L8 12 6.8 10.6c.3-.3.7-.5 1.2-.5Z" /></svg>
        <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="20" height="8" rx="2" /><path d="M25 4v4c.8-.3 1.3-1.1 1.3-2S25.8 4.3 25 4Z" opacity=".45" /></svg>
      </span>
    </span>
  )
  return (
    <span className={`iph ${post ? 'is-post' : 'is-story'} ${className}`} aria-hidden>
      <span className="iph-borda">
        <span className="iph-tela">
          <span className="iph-ilha" />
          {status}
          {post ? (
            <>
              <span className="iph-topo"><i className="av" /><span className="nm" /><span className="pts">•••</span></span>
              <span className="iph-arte"><img src={src} alt="" loading="lazy" decoding="async" onLoad={ver} /></span>
              <span className="iph-acoes">
                <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>
                <svg viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z" /></svg>
                <svg viewBox="0 0 24 24"><path d="M21 4 10 14M21 4l-7 17-4-7-7-4Z" /></svg>
                <svg className="sv" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21Z" /></svg>
              </span>
              <span className="iph-leg"><i /><i /></span>
            </>
          ) : (
            /* story: a arte ocupa a tela inteira (o fundo dela continua por trás, sem faixa preta) */
            <span className="iph-cheia">
              <img className="fundo" src={src} alt="" loading="lazy" decoding="async" />
              <span className="arte-box"><img className="arte" src={src} alt="" loading="lazy" decoding="async" onLoad={ver} /></span>
              <span className="iph-barra"><i /><i /><i /></span>
            </span>
          )}
          <span className="iph-home" />
        </span>
      </span>
    </span>
  )
}

/** Onde o conteúdo de uma arte começa e termina (fração da altura), para o desfoque da prévia cair
 *  sempre na metade de baixo do que está escrito, e não no espaço vazio da página. */
export function medirConteudo(src: string): Promise<number> {
  return new Promise((ok) => {
    const im = new Image()
    im.onload = () => {
      try {
        const w = 80, h = Math.max(1, Math.round((im.naturalHeight / im.naturalWidth) * w))
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const g = c.getContext('2d', { willReadFrequently: true })!
        g.drawImage(im, 0, 0, w, h)
        const d = g.getImageData(0, 0, w, h).data
        const bg = [d[(2 * w + 2) * 4], d[(2 * w + 2) * 4 + 1], d[(2 * w + 2) * 4 + 2]]
        const tem = (y: number) => { for (let x = 3; x < w - 3; x++) { const i = (y * w + x) * 4; if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 40) return true } return false }
        let ini = Math.round(h * 0.03), fim = Math.round(h * 0.97)
        while (ini < fim && !tem(ini)) ini++
        while (fim > ini && !tem(fim)) fim--
        ok(Math.min(0.85, Math.max(0.3, (ini + (fim - ini) * 0.55) / h)))
      } catch { ok(0.62) }
    }
    im.onerror = () => ok(0.62)
    im.src = src
  })
}
