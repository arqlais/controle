import type { ReactNode } from 'react'
import { dayLabel, stepsPercent } from '../processes'
import type { Client, ProcessStep, Quote, QuoteItem, QuoteOption, Settings } from '../types'
import { allLabel, cleanDetail, comboSeparate, comboTotal, isCombo, money, optionArea, optionTotal, quoteFiles, quoteNumber, quoteTotal } from '../utils'
import { useDocLook } from './DocKit'
import { DocPage } from './docs/DocPage'

/* ============================================================
   Proposta para cliente final em slides 16:9 (1280 × 720 cada).
   Design próprio, no "jeito" do modelo escolhido em Configurações → propostas
   (o mesmo de todos os PDFs), com as cores, fontes, logo e fotos da conta.
   ============================================================ */

export const SLIDE_W = 1280
export const SLIDE_H = 720

const fmt = (s: string) => s.split('-').reverse().join('/')
const itemLine = (i: QuoteItem) => [i.title, cleanDetail(i.detail)].filter(Boolean).join(' · ')
const two = (n: number) => String(n).padStart(2, '0')

function Heading({ kicker, a, b }: { kicker?: string; a: string; b?: string }) {
  return (
    <header className="sp-heading">
      {kicker && <p className="d-eyebrow">{kicker}</p>}
      <h2>
        {a} {b && <em>{b}</em>}
      </h2>
    </header>
  )
}

/** Etapas em cartões sobre um trilho: número, o que inclui, prazo e parte do pagamento. */
function Rail({ steps }: { steps: ProcessStep[] }) {
  const dense = steps.length > 4
  return (
    <ol className={`sp-rail ${dense ? 'is-dense' : ''}`} style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((x, i) => {
        const max = dense ? 7 : 9
        return (
          <li key={x.id}>
            <span className="sp-rail-n">{two(i + 1)}</span>
            <b>{x.name}</b>
            {x.description && <p>{x.description}</p>}
            {x.items.length > 0 && (
              <ul>
                {x.items.slice(0, max).map((it, k) => (
                  <li key={k}>{it}</li>
                ))}
                {x.items.length > max && <li className="sp-more">+ {x.items.length - max}</li>}
              </ul>
            )}
            <span className="sp-chips">
              {x.days > 0 && <i>{dayLabel(x)}</i>}
              {x.percent > 0 && <i className="is-pay">{x.percent}%</i>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Prazos como barras no tempo: cada etapa começa quando a anterior termina. */
function Timeline({ steps }: { steps: ProcessStep[] }) {
  const total = steps.reduce((n, x) => n + x.days, 0) || 1
  let start = 0
  return (
    <div className="sp-gantt">
      {steps.map((x) => {
        const left = (start / total) * 100
        const width = Math.max(4, (x.days / total) * 100)
        start += x.days
        return (
          <div key={x.id} className="sp-gantt-row">
            <span className="sp-gantt-name">{x.name}</span>
            <span className="sp-gantt-track">
              <i style={{ left: `${left}%`, width: `${width}%` }}>{dayLabel(x)}</i>
            </span>
          </div>
        )
      })}
      <div className="sp-gantt-total">
        <span />
        <b>≈ {total} dias no total</b>
      </div>
    </div>
  )
}

export function ProposalSlides({ s, client, quote: q }: { s: Settings; client?: Client; quote: Quote }) {
  const look = useDocLook(s)
  const clientName = client?.name || '[nome do cliente]'
  const steps = (q.steps ?? []).filter((x) => x.name.trim())
  const timed = steps.filter((x) => x.days > 0)
  const paid = steps.filter((x) => x.percent > 0)
  const multi = q.mode === 'opcoes'
  const combo = isCombo(q)
  const options: (QuoteOption | null)[] = multi ? q.options.slice(0, 3) : [null]
  const total = multi ? 0 : quoteTotal(q, s.urgencyFee)
  const payBase = combo ? comboTotal(q) : total
  const [word, ...rest] = (q.title || 'proposta de projeto').split(' ')
  const area = optionArea(q).area
  const pr = client?.profile
  const facts = [
    ['cliente', clientName],
    ['imóvel', pr?.propertyType || ''],
    ['área', area > 0 ? `${optionArea(q).approx ? '≈ ' : ''}${area.toLocaleString('pt-BR')} m²` : pr?.propertyArea || ''],
    ['local', pr?.propertyAddress || ''],
    ['prazo estimado', timed.length ? `${timed.reduce((n, x) => n + x.days, 0)} dias` : q.deadlineDays > 0 ? `${q.deadlineDays} dias` : ''],
    ['etapas', steps.length ? String(steps.length) : ''],
  ].filter(([, v]) => v) as [string, string][]
  const intro =
    q.intro?.trim() ||
    'Esta proposta reúne as etapas, os prazos e o investimento do seu projeto. Tudo foi pensado a partir da nossa conversa, para que você saiba exatamente o que recebe em cada fase.'
  const notes = [
    ...q.notes.split('\n').map((x) => x.replace(/^[-•—]\s*/, '').trim()).filter(Boolean),
    q.revisions > 0 ? `${q.revisions === 1 ? 'Inclui 1 rodada' : `Inclui até ${q.revisions} rodadas`} de ajustes em cada etapa; ajustes além disso são combinados à parte.` : '',
    steps.length > 1 ? 'Cada etapa é aprovada antes de seguir para a próxima. Voltar a uma etapa já aprovada pode ter custo adicional.' : '',
    quoteFiles(q, s.services) ? `Entrega: ${quoteFiles(q, s.services)}` : '',
    q.validityDays > 0 ? `Proposta válida por ${q.validityDays} dias a partir de ${fmt(q.createdAt)}.` : '',
  ].filter(Boolean)
  const photos = (s.portfolio ?? []).filter(Boolean)
  const contacts = [s.phone, s.email, s.instagram && `@${s.instagram.replace(/^@/, '')}`, s.website].filter(Boolean) as string[]

  const slides: ((n: number, t: number) => ReactNode)[] = []
  const page = (key: string, cls: string, body: ReactNode) => (n: number, t: number) => (
    <DocPage key={key} s={s} n={n} total={t} look={look.look} kind="slide" className={`sp ${cls}`}>
      {body}
    </DocPage>
  )

  // capa
  slides.push(
    page(
      'capa',
      `sp-cover ${photos[0] ? 'has-photo' : ''}`,
      <>
        <div className="sp-cover-text">
          <p className="d-eyebrow">proposta {quoteNumber(q)}</p>
          <h1 className={rest.join(' ').length > 30 ? 'is-long' : ''}>
            {word} <em>{rest.join(' ')}</em>
          </h1>
          <p className="sp-for">
            preparada para <b>{clientName}</b>
          </p>
          <p className="sp-date">{fmt(q.createdAt)}</p>
        </div>
        <div className="sp-cover-art">
          {photos[0] ? <img src={photos[0]} alt="" /> : <span className="sp-cover-lines" aria-hidden><i /><i /><i /></span>}
        </div>
      </>,
    ),
  )
  // o projeto
  slides.push(
    page(
      'projeto',
      'sp-intro',
      <>
        <div className="sp-intro-text">
          <Heading kicker="a proposta" a="o seu" b="projeto" />
          <p className="sp-lead">{intro}</p>
          {s.about?.trim() && (
            <p className="sp-about">
              <span>sobre {s.brandName || 'mim'}</span>
              {s.about}
            </p>
          )}
        </div>
        <dl className="sp-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </>,
    ),
  )
  if (steps.length)
    slides.push(
      page(
        'etapas',
        'sp-steps',
        <>
          <Heading kicker="como vamos trabalhar" a="etapas" b="do projeto" />
          <Rail steps={steps.slice(0, 6)} />
        </>,
      ),
    )
  if (timed.length > 1)
    slides.push(
      page(
        'prazos',
        'sp-time',
        <>
          <Heading kicker="quanto tempo leva" a="prazos" b="e etapas" />
          <Timeline steps={timed} />
          <p className="sp-small">Cada prazo conta a partir da aprovação da etapa anterior e é o máximo: se ficar pronto antes, já entregamos. Mudanças pedidas durante as etapas podem estender o processo.</p>
        </>,
      ),
    )
  options.forEach((o, k) => {
    const items = (o ? o.items : q.items).filter((i) => i.title.trim() || i.price > 0)
    const value = o ? optionTotal(o) : total
    const oa = optionArea(q, o ?? undefined)
    const desc = [o?.name || q.title, oa.area > 0 ? `${oa.approx ? '≈ ' : ''}${oa.area.toLocaleString('pt-BR')} m²` : ''].filter(Boolean).join(' · ')
    slides.push(
      page(
        `inv${k}`,
        'sp-invest',
        <>
          <div className="sp-invest-card">
            <p className="d-eyebrow">{multi ? `${combo ? 'proposta' : 'opção'} ${k + 1}` : 'investimento'}</p>
            {desc && <p className="sp-desc">{desc}</p>}
            <p className="sp-value">{money(value)}</p>
            {!o && q.discountNote && <p className="sp-desc-small">{q.discountNote}</p>}
            {o?.discountNote && <p className="sp-desc-small">{o.discountNote}</p>}
            {o?.note && <p className="sp-desc-small">{o.note}</p>}
            {multi && <span className="sp-big-n">{two(k + 1)}</span>}
          </div>
          <div className="sp-invest-list">
            <Heading a="o que" b="está incluído" />
            <ul>
              {items.slice(0, 10).map((i) => (
                <li key={i.id}>
                  <b>{itemLine(i)}</b>
                  {i.description?.trim() && <small>{i.description.split('\n').filter(Boolean).join(' · ')}</small>}
                </li>
              ))}
              {steps.length > 0 && items.length < 3 && steps.map((x) => <li key={x.id}>{x.name}</li>)}
            </ul>
          </div>
        </>,
      ),
    )
  })
  // propostas fechadas juntas: o valor com desconto
  if (combo)
    slides.push(
      page(
        'juntas',
        'sp-combo',
        <>
          <Heading kicker={`${allLabel(q)} propostas`} a="fechando" b="juntas" />
          <div className="sp-combo-row">
            {q.options.slice(0, 3).map((o, i) => (
              <div key={o.id} className="sp-combo-item">
                <span>{two(i + 1)}</span>
                <b>{o.name || `proposta ${i + 1}`}</b>
                <ul>
                  {o.items.filter((it) => it.title.trim()).slice(0, 5).map((it) => (
                    <li key={it.id}>{itemLine(it)}</li>
                  ))}
                </ul>
                <i>{money(optionTotal(o))}</i>
              </div>
            ))}
            <div className="sp-combo-total">
              <span>{allLabel(q)} juntas</span>
              <b>{money(comboTotal(q))}</b>
              {(q.comboDiscount ?? 0) > 0 && (
                <small>
                  em vez de {money(comboSeparate(q))} · economia de {money(comboSeparate(q) - comboTotal(q))}
                </small>
              )}
            </div>
          </div>
        </>,
      ),
    )
  if (paid.length || q.paymentTerms.trim())
    slides.push(
      page(
        'pagamento',
        'sp-pay',
        <>
          <Heading kicker="investimento em partes" a="forma de" b="pagamento" />
          {paid.length > 0 && (
            <>
              <div className="sp-paybar">
                {paid.slice(0, 6).map((x) => (
                  <i key={x.id} style={{ flex: x.percent }}>
                    {x.percent}%
                  </i>
                ))}
              </div>
              <div className="sp-paylist">
                {paid.slice(0, 6).map((x, i) => (
                  <div key={x.id} style={{ flex: x.percent }}>
                    <span>{i === 0 ? 'na assinatura' : 'ao entregar'}</span>
                    <b>{x.name}</b>
                    {payBase > 0 && <em>{money(Math.round(payBase * x.percent) / 100)}</em>}
                  </div>
                ))}
              </div>
              {stepsPercent(steps) !== 100 && <p className="sp-small">A divisão soma {stepsPercent(steps)}% do valor.</p>}
              {multi && !combo && <p className="sp-small">Os valores de cada parte seguem a opção escolhida.</p>}
            </>
          )}
          {q.paymentTerms.trim() && <p className="sp-lead sp-terms">{q.paymentTerms}</p>}
        </>,
      ),
    )
  if (notes.length)
    slides.push(
      page(
        'obs',
        'sp-notes',
        <>
          <Heading kicker="bom saber" a="observações" />
          <ol className={notes.length > 4 ? 'is-two' : ''}>
            {notes.slice(0, 8).map((x, i) => (
              <li key={i}>
                <span>{two(i + 1)}</span>
                {x}
              </li>
            ))}
          </ol>
        </>,
      ),
    )
  if (photos.length)
    slides.push(
      page(
        'portfolio',
        `sp-portfolio n${Math.min(3, photos.length)}`,
        <>
          <Heading kicker="alguns projetos" a="feito" b="por nós" />
          <div className="sp-photos">
            {photos.slice(0, 3).map((src, i) => (
              <img key={i} src={src} alt="" />
            ))}
          </div>
        </>,
      ),
    )
  slides.push(
    page(
      'fim',
      'sp-end',
      <>
        <div className="sp-end-text">
          <Heading kicker="próximos passos" a="vamos" b="começar?" />
          <ol>
            <li>
              <b>aprovação</b>
              <span>você confirma a proposta{multi ? (combo ? ' (uma ou todas juntas)' : ' e a opção escolhida') : ''}</span>
            </li>
            <li>
              <b>contrato e {paid[0] ? `${paid[0].percent}%` : 'sinal'}</b>
              <span>assinamos e reservamos a sua data na agenda</span>
            </li>
            <li>
              <b>{steps[0]?.name || 'início'}</b>
              <span>{steps[0]?.description || 'começamos o projeto'}</span>
            </li>
          </ol>
        </div>
        <div className="sp-end-card">
          {s.logo ? <img src={s.logo} alt="" /> : <b className="sp-end-brand">{s.brandName || s.ownerName}</b>}
          <p>{s.legalName || s.ownerName}</p>
          {contacts.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </>,
    ),
  )

  return (
    <div className="doc-pages slides" data-look={look.look} style={look.style}>
      {slides.map((f, i) => f(i + 1, slides.length))}
    </div>
  )
}
