import type { ReactNode } from 'react'
import type { Settings } from '../../types'
import type { DeckData, DeckImage } from '../../docTypes'
import { useDocLook } from '../DocKit'
import { DocPage } from './DocPage'

/* Apresentação de projeto (slides 16:9): para mostrar o anteprojeto ao cliente —
   o ponto de partida, o conceito, a planta, as imagens, os materiais e onde estamos no processo. */

export const DECK_DEFAULTS = {
  title: 'apresentação do projeto',
  subtitle: 'anteprojeto',
  brief: ['mais espaço para receber a família', 'cozinha integrada à sala', 'um canto de leitura com luz natural'],
  concept: 'Um lar leve e acolhedor, com materiais naturais, luz suave e cada canto pensado para a rotina de vocês.',
  planNotes: ['sala e cozinha integradas', 'ilha com banquetas', 'armários até o teto'],
  materials: [
    { name: 'madeira natural', color: '#b08a63' },
    { name: 'off-white', color: '#ece6dc' },
    { name: 'verde sálvia', color: '#9fb29a' },
    { name: 'pedra clara', color: '#d8d2c6' },
  ],
  next: ['ajustes desta apresentação', 'aprovação do anteprojeto', 'início do projeto executivo'],
  thanks: 'obrigada pela confiança!',
}

const Img = ({ src, className }: { src?: string; className?: string }) => (src ? <img className={className} src={src} alt="" /> : <span className={`dk-ph ${className ?? ''}`}>imagem</span>)

const Title = ({ a, b }: { a: string; b?: string }) => (
  <h2 className="dk-title">
    {a} {b && <em>{b}</em>}
  </h2>
)

function renderSlides(list: DeckImage[]) {
  const out: DeckImage[][] = []
  for (let i = 0; i < list.length; i += 3) out.push(list.slice(i, i + 3))
  return out
}

export function DeckDoc({ s, data, stages }: { s: Settings; data?: DeckData; stages: string[] }) {
  const look = useDocLook(s)
  const d = { ...DECK_DEFAULTS, ...data }
  const renders = (data?.renders ?? []).filter((x) => x.src)
  const mood = (data?.mood ?? []).filter(Boolean)
  const slides: ((n: number, t: number) => ReactNode)[] = []
  const [w1, ...wr] = d.title.split(' ')
  const stage = Math.min(Math.max(0, d.stage ?? 2), Math.max(0, stages.length - 1))

  slides.push((n, t) => (
    <DocPage key="capa" s={s} n={n} total={t} look={look.look} kind="slide" className="dk-cover">
      <div className="dk-cover-text">
        <p className="d-eyebrow">{d.subtitle}</p>
        <h1 className="dk-big">
          {w1} <em>{wr.join(' ')}</em>
        </h1>
        {d.client && <p className="dk-for">para {d.client}</p>}
      </div>
      <Img src={d.cover} className="dk-cover-img" />
    </DocPage>
  ))
  if (d.brief.length)
    slides.push((n, t) => (
      <DocPage key="brief" s={s} n={n} total={t} look={look.look} kind="slide" className="dk-brief">
        <Title a="o ponto" b="de partida" />
        <p className="dk-lead">O que vocês nos pediram, e que guiou cada decisão deste projeto:</p>
        <ol className="dk-list">
          {d.brief.map((x, i) => (
            <li key={i}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {x}
            </li>
          ))}
        </ol>
      </DocPage>
    ))
  slides.push((n, t) => (
    <DocPage key="conceito" s={s} n={n} total={t} look={look.look} kind="slide" className="dk-concept">
      <div className="dk-concept-text">
        <Title a="o" b="conceito" />
        <p className="dk-quote">{d.concept}</p>
      </div>
      <div className={`dk-mood n${mood.length ? Math.min(4, mood.length) : 4}`}>
        {(mood.length ? mood : [undefined, undefined, undefined, undefined]).slice(0, 4).map((src, i) => (
          <Img key={i} src={src} />
        ))}
      </div>
    </DocPage>
  ))
  if (d.plan?.src || d.planNotes.length)
    slides.push((n, t) => (
      <DocPage key="planta" s={s} n={n} total={t} look={look.look} kind="slide" className="dk-plan">
        <div className="dk-plan-img">
          <Img src={d.plan?.src} />
        </div>
        <div className="dk-plan-text">
          <Title a="a" b="planta" />
          {d.plan?.caption && <p className="dk-lead">{d.plan.caption}</p>}
          <ul className="dk-notes">
            {d.planNotes.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      </DocPage>
    ))
  renderSlides(renders).forEach((group, k) =>
    slides.push((n, t) => (
      <DocPage key={`img${k}`} s={s} n={n} total={t} look={look.look} kind="slide" className={`dk-renders n${group.length}`}>
        {group.map((x, i) => (
          <figure key={i}>
            <img src={x.src} alt="" />
            {x.caption && <figcaption>{x.caption}</figcaption>}
          </figure>
        ))}
      </DocPage>
    )),
  )
  if (d.materials.length)
    slides.push((n, t) => (
      <DocPage key="materiais" s={s} n={n} total={t} look={look.look} kind="slide" className="dk-materials">
        <Title a="materiais" b="e paleta" />
        <div className="dk-swatches" style={{ gridTemplateColumns: `repeat(${Math.min(6, d.materials.length)}, 1fr)` }}>
          {d.materials.slice(0, 6).map((m, i) => (
            <div key={i}>
              <span style={{ background: m.color }} />
              <b>{m.name}</b>
              <small>{m.color.toUpperCase()}</small>
            </div>
          ))}
        </div>
      </DocPage>
    ))
  if (stages.length)
    slides.push((n, t) => (
      <DocPage key="etapas" s={s} n={n} total={t} look={look.look} kind="slide" className="dk-stages">
        <Title a="onde" b="estamos" />
        <ol className="dk-track" style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}>
          {stages.map((x, i) => (
            <li key={i} className={i < stage ? 'is-done' : i === stage ? 'is-now' : ''}>
              <span className="dk-node">{i < stage ? '✓' : String(i + 1).padStart(2, '0')}</span>
              <b>{x}</b>
              {i === stage && <small>estamos aqui</small>}
            </li>
          ))}
        </ol>
      </DocPage>
    ))
  slides.push((n, t) => (
    <DocPage key="fim" s={s} n={n} total={t} look={look.look} kind="slide" className="dk-end">
      <div>
        <Title a="próximos" b="passos" />
        <ol className="dk-list is-small">
          {d.next.map((x, i) => (
            <li key={i}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {x}
            </li>
          ))}
        </ol>
      </div>
      <div className="dk-thanks">
        <p className="dk-big-thanks">{d.thanks}</p>
        <p>{s.legalName || s.ownerName}</p>
        <small>{[s.phone, s.email, s.instagram && `@${s.instagram.replace(/^@/, '')}`].filter(Boolean).join(' · ')}</small>
      </div>
    </DocPage>
  ))
  return (
    <div className="doc-pages" data-look={look.look} style={look.style}>
      {slides.map((f, i) => f(i + 1, slides.length))}
    </div>
  )
}
