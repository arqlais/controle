import type { ReactNode } from 'react'
import type { Settings } from '../../types'
import { useDocLook } from '../DocKit'
import { DocPage } from './DocPage'
import { FramedPhoto } from './Plaque'
import { WORK_KINDS, groupItems, has, itemTotal, workDone, workTotal, type WorkDoc, type WorkItem } from '../../workDocs'

/* Folha dos documentos de obra (A4): a mesma lista de itens em 4 layouts — tabela, lista, cartões ou fichas.
   As folhas se dividem sozinhas conforme a quantidade de itens. */

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmt = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
const shortLink = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 38)

type Block = { kind: 'group'; label: string; h: number } | { kind: 'items'; items: WorkItem[]; h: number }

// alturas aproximadas em "linhas" (cada uma ~ 38 px na folha A4)
const FIRST = 17
const OTHER = 24
function itemHeight(d: WorkDoc, i: WorkItem) {
  const desc = i.desc?.trim() ? Math.ceil(i.desc.length / 70) * 0.5 : 0
  if (d.layout === 'tabela') return 1 + desc * 0.8 + (i.photo ? 0.4 : 0)
  if (d.layout === 'lista') return 1.1 + desc + (i.photo ? 2.2 : 0)
  if (d.layout === 'fichas') return i.photo ? 8.2 : 2.6 + desc
  return 0 // cartões: medido por par
}

function blocks(d: WorkDoc): Block[] {
  const out: Block[] = []
  for (const g of groupItems(d.items)) {
    if (g.group) out.push({ kind: 'group', label: g.group, h: 1.2 })
    if (d.layout === 'cartoes') {
      for (let k = 0; k < g.items.length; k += 2) {
        const pair = g.items.slice(k, k + 2)
        const anyPhoto = pair.some((x) => x.photo)
        const text = Math.max(...pair.map((x) => (x.desc?.length ?? 0) / 40))
        out.push({ kind: 'items', items: pair, h: (anyPhoto ? 5.4 : 1.2) + 1.6 + text * 0.45 })
      }
    } else for (const i of g.items) out.push({ kind: 'items', items: [i], h: itemHeight(d, i) })
  }
  return out
}

function paginate(d: WorkDoc) {
  const list = blocks(d)
  const tail = (WORK_KINDS[d.kind].total ? 2.4 : 0) + (d.notes?.trim() ? 1.6 + Math.ceil(d.notes.length / 95) * 0.55 : 0)
  const pages: Block[][] = [[]]
  let room = FIRST - (d.intro?.trim() ? 1.4 + Math.ceil(d.intro.length / 95) * 0.55 : 0)
  for (let k = 0; k < list.length; k++) {
    const b = list[k]
    // título de grupo nunca fica sozinho no pé da folha
    const need = b.kind === 'group' && list[k + 1] ? b.h + list[k + 1].h : b.h
    if (need > room && pages[pages.length - 1].length) {
      pages.push([])
      room = OTHER
    }
    pages[pages.length - 1].push(b)
    room -= b.h
  }
  return { pages, tailFits: tail <= room }
}

export function WorkDocView({ s, doc, clientName, projectName }: { s: Settings; doc: WorkDoc; clientName?: string; projectName?: string }) {
  const look = useDocLook(s)
  const k = WORK_KINDS[doc.kind]
  const { pages, tailFits } = paginate(doc)
  const total = pages.length + (tailFits ? 0 : 1)
  const words = doc.title.trim().split(' ')
  const meta: [string, string][] = [
    ['cliente', clientName ?? ''],
    ['projeto', projectName ?? ''],
    ['local', doc.place ?? ''],
    ['data', fmt(doc.date)],
    [k.people ?? '', doc.people ?? ''],
  ].filter(([a, b]) => a && b.trim()) as [string, string][]
  const tail = (
    <>
      {k.total && doc.items.some((i) => i.price) && (
        <div className="wd-totals">
          <span>
            <small>total</small>
            <b>{brl(workTotal(doc))}</b>
          </span>
          {k.doneLabel && workDone(doc) > 0 && (
            <>
              <span>
                <small>{k.doneLabel}</small>
                <b>{brl(workDone(doc))}</b>
              </span>
              <span>
                <small>falta</small>
                <b>{brl(workTotal(doc) - workDone(doc))}</b>
              </span>
            </>
          )}
        </div>
      )}
      {doc.notes?.trim() && (
        <div className="wd-notes">
          <p className="d-label">{doc.kind === 'visita' || doc.kind === 'ata' ? 'próximos passos' : 'observações'}</p>
          <p>{doc.notes}</p>
        </div>
      )}
    </>
  )
  return (
    <div className="doc-pages" data-look={look.look} style={look.style}>
      {pages.map((page, n) => (
        <DocPage key={n} s={s} n={n + 1} total={total} look={look.look} kind="a4" className={`wd wd-${doc.layout}`}>
          {n === 0 && (
            <header className="wd-head">
              <p className="d-eyebrow">{doc.title.trim().toLowerCase() === k.label ? clientName || 'documento de obra' : k.label}</p>
              <h1 className="d-title wd-title">
                {words.length > 1 ? (
                  <>
                    {words.slice(0, -1).join(' ')} <em>{words[words.length - 1]}</em>
                  </>
                ) : (
                  <em>{doc.title}</em>
                )}
              </h1>
              {meta.length > 0 && (
                <dl className="wd-meta">
                  {meta.map(([a, b]) => (
                    <div key={a}>
                      <dt>{a}</dt>
                      <dd>{b}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {doc.intro?.trim() && <p className="wd-intro">{doc.intro}</p>}
            </header>
          )}
          <Page doc={doc} blocks={page} />
          {n === pages.length - 1 && tailFits && tail}
        </DocPage>
      ))}
      {!tailFits && (
        <DocPage s={s} n={total} total={total} look={look.look} kind="a4" className={`wd wd-${doc.layout}`}>
          {tail}
        </DocPage>
      )}
    </div>
  )
}

function Page({ doc, blocks }: { doc: WorkDoc; blocks: Block[] }) {
  if (doc.layout === 'tabela') return <Table doc={doc} blocks={blocks} />
  const out: ReactNode[] = []
  blocks.forEach((b, n) => {
    if (b.kind === 'group') out.push(<h3 key={`g${n}`} className="wd-group">{b.label}</h3>)
    else if (doc.layout === 'cartoes') out.push(<div key={n} className="wd-cards">{b.items.map((i) => <Card key={i.id} doc={doc} i={i} />)}</div>)
    else if (doc.layout === 'fichas') out.push(<Sheet key={n} doc={doc} i={b.items[0]} />)
    else out.push(<Row key={n} doc={doc} i={b.items[0]} />)
  })
  return <div className="wd-body">{out}</div>
}

function Mark({ on }: { on?: boolean }) {
  return (
    <span className={`wd-mark ${on ? 'is-on' : ''}`} aria-hidden>
      {on && (
        <svg viewBox="0 0 12 12">
          <path d="M2.5 6.2 5 8.6 9.6 3.6" />
        </svg>
      )}
    </span>
  )
}

/** Linha de detalhes: quantidade, valor, quem, data, link. */
function Facts({ doc, i }: { doc: WorkDoc; i: WorkItem }) {
  const k = WORK_KINDS[doc.kind]
  const parts: ReactNode[] = []
  if (has(doc.kind, 'qty') && i.qty) parts.push(`${i.qty.toLocaleString('pt-BR')} ${i.unit ?? ''}`.trim())
  if (has(doc.kind, 'price') && i.price) parts.push(has(doc.kind, 'qty') && (i.qty ?? 1) > 1 ? `${brl(i.price)} cada · ${brl(itemTotal(doc.kind, i))}` : brl(i.price))
  if (has(doc.kind, 'who') && i.who?.trim()) parts.push(`${k.whoLabel ?? ''} ${i.who}`.trim())
  if (has(doc.kind, 'date') && i.date) parts.push(`${k.dateLabel ?? ''} ${fmt(i.date)}`.trim())
  if (has(doc.kind, 'link') && i.link?.trim()) parts.push(<span className="wd-link">{shortLink(i.link)}</span>)
  if (!parts.length) return null
  return (
    <p className="wd-facts">
      {parts.map((p, n) => (
        <span key={n}>{p}</span>
      ))}
    </p>
  )
}

function Row({ doc, i }: { doc: WorkDoc; i: WorkItem }) {
  return (
    <div className={`wd-row ${i.done ? 'is-done' : ''}`}>
      {has(doc.kind, 'done') && <Mark on={i.done} />}
      <div className="wd-row-text">
        <b>{i.title}</b>
        {i.desc?.trim() && <p>{i.desc}</p>}
        <Facts doc={doc} i={i} />
        {i.photo && <FramedPhoto src={i.photo} pos={i.photoPos} className="wd-row-photo" />}
      </div>
    </div>
  )
}

function Card({ doc, i }: { doc: WorkDoc; i: WorkItem }) {
  return (
    <article className={`wd-card ${i.done ? 'is-done' : ''}`}>
      {i.photo ? <FramedPhoto src={i.photo} pos={i.photoPos} className="wd-card-photo" /> : <span className="wd-card-photo wd-nophoto" aria-hidden />}
      <div className="wd-card-text">
        <b>
          {has(doc.kind, 'done') && <Mark on={i.done} />}
          {i.title}
        </b>
        {i.desc?.trim() && <p>{i.desc}</p>}
        <Facts doc={doc} i={i} />
      </div>
    </article>
  )
}

function Sheet({ doc, i }: { doc: WorkDoc; i: WorkItem }) {
  return (
    <article className={`wd-sheet ${i.photo ? 'has-photo' : ''}`}>
      {i.photo && <FramedPhoto src={i.photo} pos={i.photoPos} className="wd-sheet-photo" />}
      <div className="wd-sheet-text">
        {has(doc.kind, 'date') && i.date && <p className="d-label">{fmt(i.date)}</p>}
        <b>
          {has(doc.kind, 'done') && <Mark on={i.done} />}
          {i.title}
        </b>
        {i.desc?.trim() && <p>{i.desc}</p>}
        <Facts doc={doc} i={{ ...i, date: undefined }} />
      </div>
    </article>
  )
}

function Table({ doc, blocks }: { doc: WorkDoc; blocks: Block[] }) {
  const k = WORK_KINDS[doc.kind]
  const cols = {
    qty: has(doc.kind, 'qty'),
    price: has(doc.kind, 'price'),
    total: has(doc.kind, 'price') && has(doc.kind, 'qty'),
    who: has(doc.kind, 'who'),
    date: has(doc.kind, 'date'),
    done: has(doc.kind, 'done'),
  }
  const span = 1 + Object.values(cols).filter(Boolean).length
  return (
    <table className="wd-table">
      <thead>
        <tr>
          <th>{k.titleLabel}</th>
          {cols.qty && <th className="num">qtd.</th>}
          {cols.price && <th className="num">{cols.total ? 'unit.' : k.priceLabel ?? 'valor'}</th>}
          {cols.total && <th className="num">total</th>}
          {cols.who && <th>{k.whoLabel}</th>}
          {cols.date && <th>{k.dateLabel}</th>}
          {cols.done && <th className="ctr">{k.doneLabel}</th>}
        </tr>
      </thead>
      <tbody>
        {blocks.map((b, n) =>
          b.kind === 'group' ? (
            <tr key={`g${n}`} className="wd-tgroup">
              <td colSpan={span}>{b.label}</td>
            </tr>
          ) : (
            b.items.map((i) => (
              <tr key={i.id} className={i.done ? 'is-done' : ''}>
                <td>
                  <div className="wd-tcell">
                    {i.photo && <FramedPhoto src={i.photo} pos={i.photoPos} className="wd-thumb" />}
                    <span>
                      <b>{i.title}</b>
                      {i.desc?.trim() && <small>{i.desc}</small>}
                      {has(doc.kind, 'link') && i.link?.trim() && <small className="wd-link">{shortLink(i.link)}</small>}
                    </span>
                  </div>
                </td>
                {cols.qty && <td className="num">{i.qty ? `${i.qty.toLocaleString('pt-BR')} ${i.unit ?? ''}` : ''}</td>}
                {cols.price && <td className="num">{i.price ? brl(i.price) : ''}</td>}
                {cols.total && <td className="num">{i.price ? brl(itemTotal(doc.kind, i)) : ''}</td>}
                {cols.who && <td>{i.who}</td>}
                {cols.date && <td>{fmt(i.date)}</td>}
                {cols.done && (
                  <td className="ctr">
                    <Mark on={i.done} />
                  </td>
                )}
              </tr>
            ))
          ),
        )}
      </tbody>
    </table>
  )
}
