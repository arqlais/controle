import { useEffect, type ReactNode } from 'react'
import { PlaneMark } from '../components/PlaneMark'
import { Icon } from '../components/Icon'
import { PLATFORM } from '../plans'
import { FRENTES, instaUrl, type FrenteInfo } from './frentes'
import './frentes.css'

/* Página principal (useplane.com.br para quem não está logado): o que é a planê e as três frentes.
   Quem já é assinante vai direto para o sistema; quem abriu por engano acha o caminho em um toque.
   Duas composições para a Laís escolher: "cards" (padrão) e "lista" (?v=lista). */

const layout = (): 'cards' | 'lista' => {
  try {
    return new URLSearchParams(location.search).get('v') === 'lista' || /[?&]v=lista/.test(location.hash) ? 'lista' : 'cards'
  } catch {
    return 'cards'
  }
}

export function Hub() {
  const v = layout()
  useEffect(() => {
    document.title = 'Planê · arquivos, gestão e apê'
  }, [])
  return (
    <div className={`fr fr-hub fr-hub-${v}`}>
      <FrTop />
      <main className="fr-wrap">
        <section className="fr-hero">
          <p className="fr-eyebrow">planê</p>
          <h1>
            arquivos e ferramentas para <em>organizar</em> o trabalho e a casa
          </h1>
          <p className="fr-lead">Três frentes, um jeito só: simples, bonito e pronto para usar.</p>
        </section>

        <section className={v === 'lista' ? 'fr-lista' : 'fr-cards'} aria-label="frentes da planê">
          {FRENTES.map((f, i) => (
            <FrenteCard key={f.id} f={f} n={i + 1} />
          ))}
        </section>

        <div className="fr-stripes" aria-hidden="true" />

        <section className="fr-sobre">
          <div className="fr-glass">
            <p className="fr-eyebrow">quem faz</p>
            <h2>
              feita por quem <em>usa</em>
            </h2>
            <p>
              A planê nasceu para organizar o trabalho de uma designer freelancer e estudante de arquitetura. Virou gestão para outros profissionais, loja de arquivos e
              um guia para quem está comprando o primeiro apê.
            </p>
          </div>
          <ul className="fr-facts">
            <li>
              <Icon name="check" />
              <span>arquivos editáveis, entregues na hora</span>
            </li>
            <li>
              <Icon name="lock" />
              <span>Pix ou cartão, com 7 dias para desistir</span>
            </li>
            <li>
              <Icon name="smartphone" />
              <span>tudo abre no celular e no computador</span>
            </li>
          </ul>
        </section>
      </main>
      <FrFoot />
    </div>
  )
}

function FrenteCard({ f, n }: { f: FrenteInfo; n: number }) {
  return (
    <a className={`fr-card fr-card-${f.id}`} href={f.rota}>
      <span className="fr-card-ic">
        <Icon name={f.icone} />
      </span>
      <span className="fr-card-t">
        <small>
          {String(n).padStart(2, '0')} · {f.para}
        </small>
        <b>
          planê<em>.{f.marca}</em>
        </b>
        <span className="fr-card-frase">{f.frase}</span>
        <span className="fr-card-desc">{f.desc}</span>
      </span>
      <span className="fr-card-go">
        {f.botao}
        <Icon name="arrowRight" />
      </span>
    </a>
  )
}

/** Topo das páginas da planê (principal e vitrines). */
export function FrTop({ titulo, extra }: { titulo?: FrenteInfo; extra?: ReactNode }) {
  return (
    <header className="fr-top">
      <div className="fr-wrap fr-top-in">
        <a className="fr-brand" href="#/plane" aria-label="planê: página principal">
          <PlaneMark size={30} />
          <span>
            planê{titulo && <em>.{titulo.marca}</em>}
          </span>
        </a>
        <nav className="fr-nav" aria-label="frentes">
          {FRENTES.map((f) => (
            <a key={f.id} href={f.rota} className={titulo?.id === f.id ? 'on' : ''}>
              {f.marca}
            </a>
          ))}
        </nav>
        <div className="fr-top-r">
          {extra}
          {!titulo && (
            <a className="fr-btn ghost sm" href="#/entrar">
              <Icon name="user" />
              entrar
            </a>
          )}
        </div>
      </div>
    </header>
  )
}

export function FrFoot() {
  return (
    <footer className="fr-foot">
      <div className="fr-wrap fr-foot-in">
        <a className="fr-brand" href="#/plane">
          <PlaneMark size={24} />
          <span>planê</span>
        </a>
        <nav aria-label="frentes">
          {FRENTES.map((f) => (
            <a key={f.id} href={f.rota}>
              {f.marca}
            </a>
          ))}
        </nav>
        <nav aria-label="contato">
          {FRENTES.map((f) => (
            <a key={f.id} href={instaUrl(f.instagram)} target="_blank" rel="noopener noreferrer">
              <Icon name="instagram" />
              {f.instagram}
            </a>
          ))}
          <a href={`mailto:${PLATFORM.email}`}>
            <Icon name="mail" />
            {PLATFORM.email}
          </a>
        </nav>
        <small>© {new Date().getFullYear()} planê · {PLATFORM.domain}</small>
      </div>
    </footer>
  )
}
