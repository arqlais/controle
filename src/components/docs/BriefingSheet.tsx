import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'
import type { BriefingAnswers, BriefingQuestion, BriefingTemplate, Settings } from '../../types'
import { ArtImage, isArt } from '../BriefingArt'
import { useDocLook } from '../DocKit'
import { DocPage } from './DocPage'

/* Briefing em PDF (A4) a partir de qualquer modelo: para imprimir e levar na primeira reunião,
   ou mandar para o cliente preencher à mão. Mesmas perguntas do briefing online. */

// altura aproximada de cada pergunta na folha (px), para distribuir nas páginas sem cortar
const COLS = (q: BriefingQuestion) => {
  const longest = Math.max(0, ...(q.options ?? []).map((o) => o.length))
  return longest > 26 ? 2 : longest > 14 ? 3 : 4
}
const withPics = (q: BriefingQuestion) => (q.kind === 'choice' || q.kind === 'multi') && (q.options ?? []).some((o) => q.optionImages?.[o])
function height(q: BriefingQuestion) {
  const label = 26 + Math.floor(q.label.length / 80) * 18
  if (withPics(q)) return label + Math.ceil((q.options?.length ?? 0) / 4) * 150 + 24
  if (q.kind === 'choice' || q.kind === 'multi') return label + Math.ceil(((q.options?.length ?? 0) + (q.other ? 1 : 0)) / COLS(q)) * 24 + 18
  if (q.kind === 'long') return label + 76
  if (q.kind === 'photos') return label + 22 + (q.tips?.length ?? 0) * 18
  return label + 40
}

const BOX = 905 // espaço útil de cada folha A4 (sem as margens e o rodapé)

type Block = { kind: 'section'; title: string; n: number } | { kind: 'q'; q: BriefingQuestion }

function blocksOf(t: Pick<BriefingTemplate, 'sections' | 'questions'>) {
  const blocks: Block[] = []
  t.sections.forEach((s, i) => {
    const qs = t.questions.filter((q) => q.section === s.id)
    if (!qs.length) return
    blocks.push({ kind: 'section', title: s.title, n: i + 1 })
    qs.forEach((q) => blocks.push({ kind: 'q', q }))
  })
  return blocks
}

/** Distribui nas folhas pelas alturas medidas (ou estimadas, antes de medir). */
function paginate(blocks: Block[], heights: number[] | null, firstExtra: number) {
  const pages: Block[][] = [[]]
  let used = firstExtra
  blocks.forEach((b, i) => {
    const h = heights?.[i] ?? (b.kind === 'section' ? 56 : height(b.q))
    const nextH = b.kind === 'section' ? heights?.[i + 1] ?? 70 : 0 // título de parte não fica sozinho no fim da folha
    if (used + h + nextH > BOX && pages[pages.length - 1].length) {
      pages.push([])
      used = 0
    }
    pages[pages.length - 1].push(b)
    used += h
  })
  return pages
}

/** Respostas do cliente (PDF do briefing respondido); sem elas, a folha sai em branco para preencher. */
const AnswersCtx = createContext<BriefingAnswers | null>(null)

function Question({ q }: { q: BriefingQuestion }) {
  const all = useContext(AnswersCtx)
  const answered = all ? all[q.id] : undefined
  const chosen = (o: string) => (Array.isArray(answered) ? answered.includes(o) : answered === o)
  const extra = all ? (Array.isArray(answered) ? answered : answered ? [answered] : []).filter((v) => !(q.options ?? []).includes(v)) : []
  const opts = q.options ?? []
  const mark = q.kind === 'multi' ? 'bs-box' : 'bs-dot'
  const text = typeof answered === 'string' ? answered : Array.isArray(answered) ? answered.join(', ') : ''
  if (all && (q.kind === 'text' || q.kind === 'long' || q.kind === 'date'))
    return (
      <div className={`bs-q ${q.showIf ? 'is-sub' : ''}`}>
        <p className="bs-label">{q.label}</p>
        <p className="bs-answer">{text ? (q.kind === 'date' ? text.split('-').reverse().join('/') : text) : '—'}</p>
      </div>
    )
  return (
    <div className={`bs-q ${q.showIf ? 'is-sub' : ''}`}>
      <p className="bs-label">
        {q.label}
        {q.showIf && <small> (se “{q.showIf.is ?? q.showIf.value}”)</small>}
        {q.kind === 'multi' && <small> · pode marcar mais de uma</small>}
      </p>
      {withPics(q) ? (
        <>
          <div className="bs-pics">
            {opts.map((o) => (
              <div key={o} className="bs-pic">
                <span className="bs-pic-img">{q.optionImages?.[o] ? <ArtImage src={q.optionImages[o]} /> : null}</span>
                <span>
                  <i className={`${mark} ${chosen(o) ? 'is-on' : ''}`} /> {o}
                </span>
              </div>
            ))}
          </div>
          {Object.values(q.optionImages ?? {}).some((v) => !isArt(v)) && <p className="bs-note">imagens ilustrativas</p>}
        </>
      ) : q.kind === 'choice' || q.kind === 'multi' ? (
        <div className="bs-opts" style={{ gridTemplateColumns: `repeat(${COLS(q)}, 1fr)` }}>
          {opts.map((o) => (
            <span key={o}>
              <i className={`${mark} ${chosen(o) ? 'is-on' : ''}`} /> {o}
            </span>
          ))}
          {q.other && (
            <span>
              <i className={`${mark} ${extra.length ? 'is-on' : ''}`} /> outro: {extra.length ? extra.join(', ') : '________'}
            </span>
          )}
        </div>
      ) : q.kind === 'long' ? (
        <div className="bs-lines">
          <i />
          <i />
          <i />
        </div>
      ) : q.kind === 'photos' ? (
        <p className="bs-photos">
          {answered ? (Array.isArray(answered) && answered.length ? `${answered.length} foto(s) enviada(s)` : 'sem fotos') : `mande as fotos por WhatsApp ou e-mail${q.tips?.length ? `: ${q.tips.join(' · ')}` : ''}`}
        </p>
      ) : q.kind === 'date' ? (
        <div className="bs-lines is-short">
          <span>____ / ____ / ________</span>
        </div>
      ) : (
        <div className="bs-lines is-one">
          <i />
        </div>
      )}
    </div>
  )
}

function BlockView({ b }: { b: Block }) {
  return b.kind === 'section' ? (
    <h2 className="bs-sec">
      <span>{String(b.n).padStart(2, '0')}</span> {b.title}
    </h2>
  ) : (
    <Question q={b.q} />
  )
}

function Head({ tpl, client }: { tpl: Pick<BriefingTemplate, 'name'>; client?: string }) {
  const [head, ...tail] = tpl.name.split(' ')
  return (
    <div className="bs-head">
      <header className="g-head">
        <p className="d-eyebrow">briefing</p>
        <h1 className="d-title">
          {head} <em>{tail.join(' ')}</em>
        </h1>
      </header>
      <div className="bs-client">
        <span>
          cliente: <b>{client || ''}</b>
        </span>
        <span>local:</span>
        <span>metragem:</span>
        <span>data:</span>
      </div>
    </div>
  )
}

export function BriefingSheetDoc({ s, tpl, client, answers }: { s: Settings; tpl: Pick<BriefingTemplate, 'name' | 'sections' | 'questions'>; client?: string; answers?: BriefingAnswers }) {
  const look = useDocLook(s, 'briefing')
  const blocks = blocksOf(tpl)
  const sig = JSON.stringify([tpl.name, tpl.sections, tpl.questions, look.look, answers ?? null])
  // mede cada pergunta de verdade (fora da tela) e só então distribui nas folhas
  const [measured, setMeasured] = useState<{ sig: string; head: number; hs: number[] } | null>(null)
  const probe = useRef<HTMLDivElement>(null)
  const ready = measured?.sig === sig
  useLayoutEffect(() => {
    if (ready || !probe.current) return
    const kids = [...probe.current.children] as HTMLElement[]
    const box = (el: HTMLElement) => {
      const cs = getComputedStyle(el)
      return el.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom)
    }
    setMeasured({ sig, head: box(kids[0]), hs: kids.slice(1).map(box) })
  }, [ready, sig])
  const pages = paginate(blocks, ready ? measured!.hs : null, ready ? measured!.head : 250)
  return (
    <AnswersCtx.Provider value={answers ?? null}>
    <div className={`doc-pages ${answers ? 'bs-answered' : ''}`} data-look={look.look} style={look.style}>
      {!ready && (
        <section className={`d-page d-a4 look-${look.look} bs-probe`} aria-hidden>
          <div className="d-body" ref={probe}>
            <Head tpl={tpl} client={client} />
            {blocks.map((b, i) => (
              <BlockView key={i} b={b} />
            ))}
          </div>
        </section>
      )}
      {pages.map((list, i) => (
        <DocPage key={i} s={s} n={i + 1} total={pages.length} look={look.look} kind="a4" className="bs-page">
          {i === 0 && <Head tpl={tpl} client={client} />}
          {list.map((b, k) => (
            <BlockView key={k} b={b} />
          ))}
        </DocPage>
      ))}
    </div>
    </AnswersCtx.Provider>
  )
}
