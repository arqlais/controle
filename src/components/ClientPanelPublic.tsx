import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '../store'
import { money, uid, whatsappLink } from '../utils'
import { avisar } from '../avisar'
import { readShortCode } from '../linkPack'
import type { PanelDoc, PanelPayload, PanelProject } from '../clientPanel'
import type { Settings } from '../types'
import { Icon } from './Icon'
type IconName = Parameters<typeof Icon>[0]['name']
import { Modal } from './ui'
import { DocScale, usePdf } from './Print'
import { ContractDoc } from './ContractDoc'
import { BriefingSheetDoc } from './docs/BriefingSheet'
import { MeasureGuideDoc } from './docs/MeasureGuide'
import { PlaqueDoc } from './docs/Plaque'
import { DeckDoc } from './docs/Deck'
import { PAGE } from './docs/DocPage'

/* Painel do cliente final: abre pelo link, sem conta. Mostra tudo o que o profissional compartilhou. */

const fmt = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const size = (n?: number) => (!n ? '' : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1000))} KB`)

type Viewer = { title: string; node: ReactNode; w: number; h: number; file: string; slides?: boolean; flow?: boolean }

export function ClientPanelPublic({ id, data, preview }: { id: string; data?: PanelPayload; preview?: boolean }) {
  const [d, setD] = useState<PanelPayload | null | undefined>(data)
  const [owner, setOwner] = useState('')
  useEffect(() => {
    if (data) return setD(data)
    import('../clientPanel').then(({ loadPanel }) => loadPanel(id)).then(
      (r) => {
        setD(r?.data ?? null)
        setOwner(r?.userId ?? '')
      },
      () => setD(null),
    )
  }, [id, data])

  const wrap = (children: ReactNode) => (
    <div className={`bf-public pn-public ${preview ? 'is-preview' : ''}`} style={{ ['--bf-accent' as string]: d?.accent || '#a88a80' }}>
      <div className="bf-card">{children}</div>
      <p className="bf-foot">feito com traço</p>
    </div>
  )
  if (d === undefined) return wrap(<p className="muted">carregando…</p>)
  if (d === null) return wrap(<p>Este painel não está mais no ar. Fale com quem te enviou o link.</p>)
  return wrap(<Panel d={d} owner={owner} preview={preview} token={id} />)
}

function Panel({ d, owner, preview, token }: { d: PanelPayload; owner: string; preview?: boolean; token: string }) {
  const s = { ...DEFAULT_SETTINGS, ...(d.s as Partial<Settings>) } as Settings
  const pdf = usePdf()
  const [view, setView] = useState<Viewer | null>(null)
  const docsCount = d.docs.length + d.files.length
  const toPay = d.projects.reduce((n, p) => n + (p.payments ?? []).filter((x) => !x.paid).length, 0)
  const toSign = d.contracts.filter((c) => !c.sign && c.signLink).length
  const toAnswer = d.briefings.filter((b) => !b.answered && b.link).length
  const nav: { id: string; label: string; icon: IconName; n?: number; show: boolean }[] = [
    { id: 'pn-projetos', label: d.projects.length > 1 ? 'projetos' : 'projeto', icon: 'layers', show: d.projects.length > 0 },
    { id: 'pn-documentos', label: 'documentos', icon: 'file', n: docsCount, show: docsCount > 0 },
    { id: 'pn-contratos', label: 'contratos', icon: 'pen', n: toSign || undefined, show: d.contracts.length > 0 },
    { id: 'pn-briefings', label: 'briefings', icon: 'clip', n: toAnswer || undefined, show: d.briefings.length > 0 },
    { id: 'pn-propostas', label: 'propostas', icon: 'wallet', show: d.quotes.length > 0 },
    { id: 'pn-recado', label: 'falar', icon: 'chat', show: true },
  ]
  const open = (v: Viewer) => setView(v)
  const openDoc = (x: PanelDoc) => {
    const w = x.kind === 'placa' ? PAGE.poster : x.kind === 'apresentacao' ? PAGE.slide : PAGE.a4
    const node = x.html ? (
      <div className="dk-frozen" dangerouslySetInnerHTML={{ __html: x.html }} />
    ) : x.kind === 'guia' ? (
      <MeasureGuideDoc s={s} data={x.guide} />
    ) : x.kind === 'placa' ? (
      <PlaqueDoc s={s} data={x.plaque} />
    ) : x.kind === 'apresentacao' ? (
      <DeckDoc s={s} data={x.deck} stages={x.stages ?? []} />
    ) : x.tpl ? (
      <BriefingSheetDoc s={s} tpl={x.tpl} client={d.clientFull} />
    ) : null
    if (node) open({ title: x.title, node, w: w[0], h: w[1], file: `${x.title}.pdf` })
  }

  return (
    <>
      <header className="bf-head">
        {d.logo && <img src={d.logo} alt="" className="bf-logo" />}
        <p className="bf-eyebrow">{d.studio}</p>
        <h1>{d.client ? `Oi, ${d.client}!` : 'Seu painel'}</h1>
        <p className="muted">Aqui fica tudo do seu projeto: etapas, pagamentos e documentos. Atualizado em {new Date(d.updatedAt).toLocaleDateString('pt-BR')}.</p>
      </header>
      {d.message && <p className="pt-message">{d.message}</p>}
      {(toPay > 0 || toSign > 0 || toAnswer > 0) && (
        <div className="pn-todo">
          {toSign > 0 && (
            <a href="#pn-contratos" onClick={(e) => jump(e, 'pn-contratos')}>
              <Icon name="pen" size={15} /> {toSign === 1 ? '1 contrato para assinar' : `${toSign} contratos para assinar`}
            </a>
          )}
          {toAnswer > 0 && (
            <a href="#pn-briefings" onClick={(e) => jump(e, 'pn-briefings')}>
              <Icon name="clip" size={15} /> {toAnswer === 1 ? '1 briefing para responder' : `${toAnswer} briefings para responder`}
            </a>
          )}
          {toPay > 0 && (
            <a href="#pn-projetos" onClick={(e) => jump(e, 'pn-projetos')}>
              <Icon name="wallet" size={15} /> {toPay === 1 ? '1 pagamento em aberto' : `${toPay} pagamentos em aberto`}
            </a>
          )}
        </div>
      )}
      <nav className="pn-nav" aria-label="Seções do painel">
        {nav
          .filter((x) => x.show)
          .map((x) => (
            <a key={x.id} href={`#${x.id}`} onClick={(e) => jump(e, x.id)}>
              <Icon name={x.icon} size={15} />
              <span>{x.label}</span>
              {x.n ? <b>{x.n}</b> : null}
            </a>
          ))}
      </nav>

      {d.projects.length > 0 && (
        <section id="pn-projetos" className="pn-section">
          {d.projects.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </section>
      )}

      {docsCount > 0 && (
        <section id="pn-documentos" className="bf-block pn-section">
          <h2>documentos</h2>
          <ul className="pn-list">
            {d.docs.map((x) => (
              <li key={x.id}>
                <span className="pn-ico">
                  <Icon name={x.kind === 'placa' ? 'hardhat' : x.kind === 'apresentacao' ? 'layers' : x.kind === 'briefing' ? 'clip' : 'ruler'} size={16} />
                </span>
                <span className="grow">
                  <b>{x.title}</b>
                  <small>atualizado em {fmt(x.updatedAt)}</small>
                </span>
                <button className="btn small" onClick={() => openDoc(x)}>
                  <Icon name="eye" size={14} /> ver
                </button>
              </li>
            ))}
            {d.files.map((f) => (
              <li key={f.id}>
                <span className="pn-ico">
                  <Icon name={f.type?.startsWith('image/') ? 'camera' : 'file'} size={16} />
                </span>
                <span className="grow">
                  <b>{f.name}</b>
                  <small>
                    {fmt(f.at)}
                    {f.size ? ` · ${size(f.size)}` : ''}
                    {f.projectId ? ` · ${d.projects.find((p) => p.id === f.projectId)?.title ?? ''}` : ''}
                  </small>
                </span>
                <a className="btn small" href={f.url} target="_blank" rel="noreferrer" download={f.url.startsWith('data:') ? f.name : undefined}>
                  <Icon name="download" size={14} /> abrir
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.contracts.length > 0 && (
        <section id="pn-contratos" className="bf-block pn-section">
          <h2>contratos</h2>
          <ul className="pn-list">
            {d.contracts.map((c) => (
              <li key={c.id}>
                <span className={`pn-ico ${c.sign ? 'is-ok' : ''}`}>
                  <Icon name={c.sign ? 'check' : 'pen'} size={16} />
                </span>
                <span className="grow">
                  <b>{c.title}</b>
                  <small>{c.sign ? `assinado por ${c.sign.name} em ${fmt(c.sign.at)}` : c.status}</small>
                </span>
                {!c.sign && c.signLink ? (
                  <a className="btn small primary" href={c.signLink}>
                    <Icon name="pen" size={14} /> ler e assinar
                  </a>
                ) : (
                  <button className="btn small" onClick={() => open({ title: c.title, node: <ContractDoc s={s} body={c.body} clientName={d.clientFull} exclusive={c.exclusive} signed={c.sign} />, w: PAGE.a4[0], h: PAGE.a4[1], file: `Contrato - ${c.title}.pdf`, flow: true })}>
                    <Icon name="eye" size={14} /> ver
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.briefings.length > 0 && (
        <section id="pn-briefings" className="bf-block pn-section">
          <h2>briefings</h2>
          <ul className="pn-list">
            {d.briefings.map((b) => (
              <li key={b.id}>
                <span className={`pn-ico ${b.answered ? 'is-ok' : ''}`}>
                  <Icon name={b.answered ? 'check' : 'clip'} size={16} />
                </span>
                <span className="grow">
                  <b>{b.title}</b>
                  <small>{b.answered ? `respondido em ${fmt(b.answeredAt)}` : 'esperando as suas respostas'}</small>
                </span>
                {b.answered ? (
                  <button className="btn small" onClick={() => open({ title: b.title, node: <BriefingSheetDoc s={s} tpl={{ name: b.title, sections: b.sections ?? [], questions: b.questions ?? [] }} client={d.clientFull} answers={b.answers ?? {}} />, w: PAGE.a4[0], h: PAGE.a4[1], file: `Briefing - ${b.title}.pdf` })}>
                    <Icon name="eye" size={14} /> ver
                  </button>
                ) : (
                  b.link && (
                    <a className="btn small primary" href={b.link}>
                      <Icon name="pen" size={14} /> responder
                    </a>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.quotes.length > 0 && (
        <section id="pn-propostas" className="bf-block pn-section">
          <h2>propostas</h2>
          <ul className="pn-list">
            {d.quotes.map((q) => (
              <li key={q.id}>
                <span className="pn-ico">
                  <Icon name="wallet" size={16} />
                </span>
                <span className="grow">
                  <b>{q.title}</b>
                  <small>
                    {q.number ? `nº ${q.number} · ` : ''}
                    {fmt(q.date)} · {q.status}
                  </small>
                </span>
                <span className="pn-value">{money(q.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Talk d={d} owner={owner} preview={preview} token={token} />

      {view && (
        <Modal wide title={view.title} onClose={() => setView(null)}>
          <div className="pn-viewer">
            <DocScale width={view.w}>{view.node}</DocScale>
          </div>
          <div className="row gap-s wrap pn-viewer-bar">
            <button className="btn primary" disabled={pdf.busy} onClick={() => (view.flow ? pdf.download(view.node, view.file) : pdf.downloadPages(view.node, view.file, view.w, view.h))}>
              <Icon name="download" size={15} /> {pdf.busy ? 'gerando…' : 'baixar PDF'}
            </button>
          </div>
        </Modal>
      )}
      {pdf.portal}
    </>
  )
}

function jump(e: React.MouseEvent, id: string) {
  e.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function ProjectCard({ p }: { p: PanelProject }) {
  const done = p.phases.filter((x) => x.done).length
  const now = p.phases.find((x) => !x.done)
  const pct = p.phases.length ? Math.round((done / p.phases.length) * 100) : p.deliveredDate ? 100 : 0
  return (
    <article className="bf-block pn-project">
      <h2>{p.title}</h2>
      <section className="pt-now">
        <div>
          <span>situação</span>
          <b>{p.deliveredDate ? 'entregue' : now ? now.name : p.status}</b>
        </div>
        {p.dueDate && !p.deliveredDate && (
          <div>
            <span>entrega prevista</span>
            <b>{fmt(p.dueDate)}</b>
          </div>
        )}
        {p.phases.length > 0 && (
          <div>
            <span>etapas</span>
            <b>
              {done} de {p.phases.length}
            </b>
          </div>
        )}
      </section>
      {p.phases.length > 0 && (
        <>
          <div className="pn-bar" aria-label={`${pct}% concluído`}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <ol className="pt-steps">
            {p.phases.map((x, i) => (
              <li key={i} className={x.done ? 'is-done' : x === now ? 'is-now' : ''}>
                <span className="pt-dot">{x.done ? <Icon name="check" size={13} /> : i + 1}</span>
                <span className="grow">
                  <b>{x.name}</b>
                  <small>{x.done ? 'concluída' : x === now ? `em andamento${x.due ? ` · prazo ${fmt(x.due)}` : ''}` : x.due ? `prazo ${fmt(x.due)}` : ''}</small>
                  {x.note && <small className="pn-note">{x.note}</small>}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {p.payments && p.payments.length > 0 && (
        <>
          <h3 className="pn-sub">pagamentos</h3>
          {typeof p.total === 'number' && p.total > 0 && (
            <div className="pn-paybar">
              <div className="pn-bar is-pay">
                <i style={{ width: `${Math.min(100, Math.round(((p.paid ?? 0) / p.total) * 100))}%` }} />
              </div>
              <p className="pt-total">
                pago {money(p.paid ?? 0)} de {money(p.total)}
              </p>
            </div>
          )}
          <ul className="pt-pays">
            {p.payments.map((x, i) => (
              <li key={i}>
                <span className="grow">
                  <b>{x.description}</b>
                  <small>{x.paid ? `pago${x.paidDate ? ` em ${fmt(x.paidDate)}` : ''}` : x.due ? `vence ${fmt(x.due)}` : x.when}</small>
                </span>
                <span className={x.paid ? 'pt-paid' : ''}>{money(x.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {p.visits && p.visits.length > 0 && (
        <>
          <h3 className="pn-sub">visitas de obra</h3>
          {p.visits.map((v, i) => (
            <div key={i} className="pt-visit">
              <b>
                {fmt(v.date)} · {v.title}
              </b>
              {v.notes && <p>{v.notes}</p>}
              {v.next && (
                <p className="muted small">
                  <b>próximos passos:</b> {v.next}
                </p>
              )}
            </div>
          ))}
        </>
      )}
      {p.filesLink && (
        <a className="btn pn-files" href={p.filesLink} target="_blank" rel="noreferrer">
          <Icon name="folder" size={15} /> abrir a pasta de arquivos
        </a>
      )}
    </article>
  )
}

function Talk({ d, owner, preview, token }: { d: PanelPayload; owner: string; preview?: boolean; token: string }) {
  const [text, setText] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'erro'>('idle')
  const send = async () => {
    if (text.trim().length < 2) return
    if (preview) return setState('ok')
    setState('busy')
    const panel = token.includes('.') ? readShortCode(token)?.id ?? token : token
    const ok = await avisar({ user: owner, kind: 'recado', ref: uid(), cliente: d.clientFull, titulo: 'recado pelo painel', texto: text.trim(), clienteEmail: email.includes('@') ? email.trim() : undefined, painel: panel, studio: d.studio })
    setState(ok ? 'ok' : 'erro')
    if (ok) setText('')
  }
  return (
    <section id="pn-recado" className="bf-block pn-section pn-talk">
      <h2>falar com {d.owner || d.studio}</h2>
      {state === 'ok' ? (
        <p className="pn-sent">
          <Icon name="check" size={16} /> Recado enviado. {d.owner || d.studio} recebe o aviso na hora.
          <button className="link small" onClick={() => setState('idle')}>
            mandar outro
          </button>
        </p>
      ) : (
        <>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Uma dúvida, um ajuste, uma aprovação…" spellCheck lang="pt-BR" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="seu e-mail (opcional)" />
          {state === 'erro' && <p className="bf-error">Não foi agora. Tente de novo ou fale pelo WhatsApp.</p>}
          <div className="row gap-s wrap">
            <button className="btn primary" disabled={state === 'busy' || text.trim().length < 2} onClick={() => void send()}>
              <Icon name="arrowRight" size={15} /> {state === 'busy' ? 'enviando…' : 'mandar recado'}
            </button>
            {d.phone && (
              <a className="btn" href={whatsappLink(d.phone, `Oi! Estou vendo o meu painel do projeto.`)} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" size={15} /> WhatsApp
              </a>
            )}
          </div>
        </>
      )}
    </section>
  )
}
