import type { CSSProperties, ReactNode } from 'react'
import { useAccess } from '../access'
import { sheetColors } from '../proposalTemplates'
import { dayLabel, stepsPercent } from '../processes'
import type { Client, ProcessStep, Quote, QuoteItem, QuoteOption, Settings } from '../types'
import { cleanDetail, money, optionArea, optionTotal, quoteFiles, quoteNumber, quoteTotal } from '../utils'
import '../slides.css'

/* ============================================================
   Proposta para cliente final em slides 16:9 (1280 × 720 cada).
   Cabe certinho na tela do computador e vira um PDF de páginas deitadas.
   Cores, fontes e logo são as da conta; as fotos são as que a pessoa escolheu.
   ============================================================ */

export const SLIDE_W = 1280
export const SLIDE_H = 720

const fmt = (s: string) => s.split('-').reverse().join('/')

function useLook(s: Settings) {
  const { has } = useAccess()
  const p = sheetColors(s.proposal, has)
  return {
    '--sl-ink': p.ink,
    '--sl-accent': p.rose,
    '--sl-soft': p.arch,
    '--sl-paper': p.paper,
    '--sl-dark': p.bar,
    '--sl-serif': `'${p.serif}', Georgia, serif`,
    '--sl-sans': `'${p.sans}', system-ui, sans-serif`,
  } as CSSProperties
}

/** Título no estilo "Etapas · do projeto": palavra reta + complemento em itálico. */
function Title({ a, b }: { a: string; b?: string }) {
  return (
    <h2 className="sl-title">
      <span>{a}</span>
      {b && (
        <>
          <i className="sl-dot" />
          <em>{b}</em>
        </>
      )}
    </h2>
  )
}

function Slide({ s, n, total, className = '', children }: { s: Settings; n: number; total: number; className?: string; children: ReactNode }) {
  return (
    <section className={`slide ${className}`}>
      {children}
      <footer className="sl-foot">
        <span>{s.brandName || s.ownerName}</span>
        <span>
          {String(n).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      </footer>
    </section>
  )
}

/** Faixa com o nome da marca repetido (fundo decorativo, sempre com a marca da própria conta). */
function Pattern({ s, rows = 5 }: { s: Settings; rows?: number }) {
  const name = (s.brandName || s.ownerName || 'estúdio').toLowerCase()
  const word = (
    <>
      <span>{name}</span>
      <i className="sl-dot" />
      <em>projetos</em>
      <i className="sl-dot" />
    </>
  )
  return (
    <div className="sl-pattern" aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ marginLeft: r % 2 ? -180 : 0 }}>
          {word}
          {word}
          {word}
        </div>
      ))}
    </div>
  )
}

const itemLine = (i: QuoteItem) => [i.title, cleanDetail(i.detail)].filter(Boolean).join(' · ')

function Timeline({ steps }: { steps: ProcessStep[] }) {
  const n = steps.length
  const pad = 96
  const col = (SLIDE_W - pad * 2) / Math.max(n, 1)
  const width = Math.min(col * 2 - 36, 460)
  return (
    <div className={`sl-timeline ${n > 5 ? 'is-dense' : ''}`}>
      <span className="sl-line" />
      {steps.map((x, i) => {
        const up = i % 2 === 0
        const left = pad + col * i + 8
        // cabe o que dá sem passar da linha do tempo nem do rodapé (em 2 colunas quando há espaço)
        const max = n > 4 ? 4 : 10
        return (
          <div key={x.id} className={`sl-step ${up ? 'is-up' : 'is-down'}`} style={{ left }}>
            <span className="sl-node" />
            <span className="sl-stem" />
            <div className="sl-step-text" style={{ width: i === n - 1 ? Math.min(width, SLIDE_W - left - 60) : width }}>
              <h3>
                {String(i + 1).padStart(2, '0')}. {x.name}
              </h3>
              {x.description && <p>{x.description}</p>}
              {x.items.length > 0 && (
                <ul className={x.items.length > 5 && n <= 4 ? 'is-two' : ''}>
                  {x.items.slice(0, max).map((it, k) => (
                    <li key={k}>{it}</li>
                  ))}
                  {x.items.length > max && <li className="sl-more">+ {x.items.length - max} itens</li>}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ProposalSlides({ s, client, quote: q }: { s: Settings; client?: Client; quote: Quote }) {
  const style = useLook(s)
  const clientName = client?.name || '[nome do cliente]'
  const steps = (q.steps ?? []).filter((x) => x.name.trim())
  const timed = steps.filter((x) => x.days > 0)
  const paid = steps.filter((x) => x.percent > 0)
  const two = q.mode === 'opcoes'
  const options: (QuoteOption | null)[] = two ? q.options.slice(0, 3) : [null]
  const total = two ? 0 : quoteTotal(q, s.urgencyFee)
  const [word, ...rest] = (q.title || 'proposta de projeto').split(' ')
  const area = optionArea(q).area
  const pr = client?.profile
  const facts = [
    ['cliente', clientName],
    ['imóvel', pr?.propertyType || ''],
    ['área', area > 0 ? `${optionArea(q).approx ? '≈ ' : ''}${area.toLocaleString('pt-BR')} m²` : pr?.propertyArea || ''],
    ['local', pr?.propertyAddress || ''],
    ['prazo estimado', timed.length ? `${timed.reduce((n, x) => n + x.days, 0)} dias` : q.deadlineDays > 0 ? `${q.deadlineDays} dias` : ''],
  ].filter(([, v]) => v) as [string, string][]
  const intro =
    q.intro?.trim() ||
    `Esta proposta reúne as etapas, os prazos e o investimento do seu projeto. Tudo foi pensado a partir da nossa conversa, para que você saiba exatamente o que vai receber em cada fase.`
  const notes = [
    ...q.notes.split('\n').map((x) => x.replace(/^[-•—]\s*/, '').trim()).filter(Boolean),
    q.revisions > 0 ? `${q.revisions === 1 ? 'Está incluída 1 rodada' : `Estão incluídas até ${q.revisions} rodadas`} de ajustes em cada etapa. Ajustes além disso são combinados à parte.` : '',
    steps.length > 1 ? 'Ao final de cada etapa, a aprovação é registrada antes de seguir para a próxima. Voltar a uma etapa já aprovada pode ter custo adicional.' : '',
    quoteFiles(q, s.services) ? `Entrega: ${quoteFiles(q, s.services)}` : '',
    q.validityDays > 0 ? `Proposta válida por ${q.validityDays} dias a partir de ${fmt(q.createdAt)}.` : '',
  ].filter(Boolean)
  const photos = (s.portfolio ?? []).filter(Boolean)
  const contacts = [s.phone, s.email, s.instagram && `@${s.instagram.replace(/^@/, '')}`, s.website].filter(Boolean) as string[]

  const slides: ((n: number, t: number) => ReactNode)[] = []
  // capa
  slides.push((n, t) => (
    <Slide key="capa" s={s} n={n} total={t} className="sl-cover">
      <div className="sl-cover-text">
        {s.logo ? <img className="sl-logo" src={s.logo} alt="" /> : <b className="sl-brand">{s.brandName || s.ownerName}</b>}
        <p className="sl-eyebrow">proposta {quoteNumber(q)}</p>
        <h1 className={rest.join(' ').length > 34 ? 'is-long' : rest.join(' ').length > 18 ? 'is-mid' : ''}>
          <span>{word}</span> <em>{rest.join(' ')}</em>
        </h1>
        <p className="sl-for">para {clientName}</p>
        <p className="sl-meta">{fmt(q.createdAt)}</p>
      </div>
      <div className="sl-cover-art">{photos[0] ? <img src={photos[0]} alt="" /> : <Pattern s={s} rows={9} />}</div>
    </Slide>
  ))
  // o projeto
  slides.push((n, t) => (
    <Slide key="projeto" s={s} n={n} total={t} className="sl-intro">
      <div className="sl-intro-left">
        <Title a="O seu" b="projeto" />
        <p className="sl-lead">{intro}</p>
        {s.about?.trim() && (
          <div className="sl-about">
            <span className="sl-label">sobre {s.brandName ? `o ${s.brandName}` : 'mim'}</span>
            <p>{s.about}</p>
          </div>
        )}
      </div>
      <dl className="sl-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Slide>
  ))
  if (steps.length)
    slides.push((n, t) => (
      <Slide key="etapas" s={s} n={n} total={t} className="sl-steps">
        <Title a="Etapas" b="do projeto" />
        <Timeline steps={steps.slice(0, 7)} />
      </Slide>
    ))
  if (timed.length)
    slides.push((n, t) => (
      <Slide key="prazos" s={s} n={n} total={t} className="sl-time">
        <Title a="Prazos" b="e etapas" />
        <div className="sl-arrows" style={{ gridTemplateColumns: `repeat(${timed.length}, 1fr)` }}>
          {timed.map((x) => (
            <div key={x.id}>
              <h3>{x.name}</h3>
              <div className="sl-arrow">
                <svg viewBox="0 0 24 40" aria-hidden>
                  <path d="M4 4 L20 20 L4 36" />
                </svg>
                <span />
              </div>
              <p>{dayLabel(x)}</p>
            </div>
          ))}
        </div>
        <div className="sl-box">
          <b>Observações</b>
          <p>Cada prazo conta a partir da aprovação da etapa anterior e é o prazo máximo: se ficar pronto antes, já entregamos. Alterações pedidas durante as etapas podem estender o processo.</p>
        </div>
      </Slide>
    ))
  options.forEach((o, k) => {
    const items = (o ? o.items : q.items).filter((i) => i.title.trim() || i.price > 0)
    const value = o ? optionTotal(o) : total
    const oa = optionArea(q, o ?? undefined)
    const desc = [o?.name || q.title, oa.area > 0 ? `${oa.approx ? '≈ ' : ''}${oa.area.toLocaleString('pt-BR')} m²` : ''].filter(Boolean).join(' · ')
    slides.push((n, t) => (
      <Slide key={`inv${k}`} s={s} n={n} total={t} className="sl-invest">
        <div className="sl-invest-left">
          {two && <span className="sl-big-num">{String(k + 1).padStart(2, '0')}</span>}
          <p className="sl-eyebrow">{two ? `opção ${k + 1}` : 'investimento'}</p>
          <h2>
            Proposta de <em>investimento</em>
          </h2>
          {desc && <p className="sl-desc">{desc}</p>}
          {o?.note && <p className="sl-desc">{o.note}</p>}
          <p className="sl-value">{money(value)}</p>
          {!o && q.discountNote && <p className="sl-desc">{q.discountNote}</p>}
          {o?.discountNote && <p className="sl-desc">{o.discountNote}</p>}
        </div>
        <div className="sl-invest-right">
          <span className="sl-label">o que está incluído</span>
          <ul className="sl-table">
            {items.slice(0, 11).map((i) => (
              <li key={i.id}>
                <span>{itemLine(i)}</span>
                {i.description?.trim() && <small>{i.description.split('\n').filter(Boolean).join(' · ')}</small>}
              </li>
            ))}
            {steps.length > 0 && items.length < 4 && steps.map((x) => <li key={x.id}>{x.name}</li>)}
          </ul>
          {q.validityDays > 0 && <p className="sl-valid">Proposta válida por {q.validityDays} dias.</p>}
        </div>
      </Slide>
    ))
  })
  if (paid.length || q.paymentTerms.trim())
    slides.push((n, t) => (
      <Slide key="pagamento" s={s} n={n} total={t} className="sl-pay">
        <Title a="Forma de" b="pagamento" />
        {paid.length > 0 && (
          <div className="sl-pay-grid" style={{ gridTemplateColumns: `repeat(${Math.min(paid.length, 5)}, 1fr)` }}>
            {paid.slice(0, 5).map((x, i) => (
              <div key={x.id}>
                <span className="sl-pct">{x.percent}%</span>
                <b>{i === 0 ? 'na assinatura · ' : 'ao entregar · '}{x.name}</b>
                {!two && total > 0 && <span>{money(Math.round(total * x.percent) / 100)}</span>}
              </div>
            ))}
          </div>
        )}
        {paid.length > 0 && stepsPercent(steps) !== 100 && <p className="sl-small">A divisão soma {stepsPercent(steps)}% do valor.</p>}
        {q.paymentTerms.trim() && <p className="sl-lead sl-terms">{q.paymentTerms}</p>}
      </Slide>
    ))
  if (notes.length)
    slides.push((n, t) => (
      <Slide key="obs" s={s} n={n} total={t} className="sl-notes">
        <div className="sl-notes-band">
          <Pattern s={s} rows={2} />
        </div>
        <div className="sl-notes-body">
          <h2 className="sl-title sl-title-solo">Observações</h2>
          <ul>
            {notes.slice(0, 7).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      </Slide>
    ))
  if (photos.length)
    slides.push((n, t) => (
      <Slide key="portfolio" s={s} n={n} total={t} className="sl-portfolio">
        <Pattern s={s} rows={6} />
        <div className="sl-photos" style={{ gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, 1fr)` }}>
          {photos.slice(0, 3).map((src, i) => (
            <img key={i} src={src} alt="" />
          ))}
        </div>
      </Slide>
    ))
  slides.push((n, t) => (
    <Slide key="fim" s={s} n={n} total={t} className="sl-end">
      <div>
        <Title a="Vamos" b="começar?" />
        <ol className="sl-next">
          <li>
            <b>Aprovação</b>
            <span>você confirma a proposta{two ? ' e a opção escolhida' : ''}</span>
          </li>
          <li>
            <b>Contrato e {paid[0] ? `${paid[0].percent}%` : 'sinal'}</b>
            <span>assinamos o contrato e reservamos a sua data</span>
          </li>
          <li>
            <b>{steps[0]?.name || 'Início'}</b>
            <span>{steps[0]?.description || 'começamos o projeto'}</span>
          </li>
        </ol>
      </div>
      <div className="sl-end-card">
        {s.logo ? <img className="sl-logo" src={s.logo} alt="" /> : <b className="sl-brand">{s.brandName || s.ownerName}</b>}
        <p>{s.legalName || s.ownerName}</p>
        {contacts.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
    </Slide>
  ))

  return (
    <div className="slides" style={style}>
      {slides.map((f, i) => f(i + 1, slides.length))}
    </div>
  )
}
