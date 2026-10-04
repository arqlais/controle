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
import { WorkDocView } from './docs/WorkDocView'
import { WORK_KINDS } from '../workDocs'
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
      <p className="bf-foot"><a href="https://useplane.com.br" target="_blank" rel="noreferrer">feito com planê</a></p>
    </div>
  )
  if (d === undefined) return wrap(<p className="muted">carregando…</p>)
  if (d === null) return wrap(<p>Este painel não está mais no ar. Fale com quem te enviou o link.</p>)
  return wrap(<Panel d={d} owner={owner} preview={preview} token={id} />)
}

const DAY = 86_400_000
const daysTo = (iso?: string | null) => (iso ? Math.ceil((Date.parse(iso.slice(0, 10) + 'T12:00:00') - Date.now()) / DAY) : null)
const inDays = (n: number) => (n > 1 ? `faltam ${n} dias` : n === 1 ? 'é amanhã' : n === 0 ? 'é hoje' : 'prazo em ajuste')

function Panel({ d, owner, preview, token }: { d: PanelPayload; owner: string; preview?: boolean; token: string }) {
  const s = { ...DEFAULT_SETTINGS, ...(d.s as Partial<Settings>) } as Settings
  const pdf = usePdf()
  const [view, setView] = useState<Viewer | null>(null)
  const [copied, setCopied] = useState(false)
  const docsCount = d.docs.length + d.files.length
  const unpaid = d.projects.flatMap((p) => (p.payments ?? []).filter((x) => !x.paid).map((x) => ({ ...x, project: p.title })))
  const toSign = d.contracts.filter((c) => !c.sign && c.signLink)
  const toAnswer = d.briefings.filter((b) => !b.answered && b.link)
  const hidden = new Set(d.hide ?? [])
  const nav: { id: string; label: string; icon: IconName; n?: number; show: boolean }[] = [
    { id: 'pn-projetos', label: d.projects.length > 1 ? 'projetos' : 'etapas', icon: 'layers', show: d.projects.length > 0 && !hidden.has('etapas') },
    { id: 'pn-pagamentos', label: 'pagamentos', icon: 'wallet', n: unpaid.length || undefined, show: d.projects.some((p) => p.payments?.length) && !hidden.has('pagamentos') },
    { id: 'pn-documentos', label: 'documentos', icon: 'file', n: docsCount || undefined, show: (docsCount > 0 || d.contracts.length > 0 || d.briefings.length > 0 || d.quotes.length > 0) && !hidden.has('documentos') },
    { id: 'pn-links', label: 'links', icon: 'link', show: (d.links ?? []).length > 0 && !hidden.has('links') },
    { id: 'pn-recado', label: 'falar', icon: 'chat', show: !hidden.has('recado') },
  ]
  const open = (v: Viewer) => setView(v)
  const openDoc = (x: PanelDoc) => {
    const w = x.kind === 'placa' ? PAGE.poster : x.kind === 'apresentacao' ? PAGE.slide : PAGE.a4
    const node = x.html ? (
      <div className="dk-frozen" dangerouslySetInnerHTML={{ __html: x.html }} />
    ) : x.kind === 'obra' && x.work ? (
      <WorkDocView s={s} doc={x.work} clientName={d.clientFull} projectName={d.projects.find((p) => p.id === x.work?.projectId)?.title} />
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
  const copyPix = () => {
    if (!d.pix) return
    void navigator.clipboard?.writeText(d.pix)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  // resumo: a demanda em andamento (ou a mais recente)
  const main = d.projects.find((p) => !p.deliveredDate) ?? d.projects[0]
  const mDone = main ? main.phases.filter((x) => x.done).length : 0
  const mNow = main?.phases.find((x) => !x.done)
  const mPct = main ? (main.phases.length ? Math.round((mDone / main.phases.length) * 100) : main.deliveredDate ? 100 : 0) : 0
  const days = main && !main.deliveredDate ? daysTo(main.dueDate) : null
  const payTotal = d.projects.reduce((n, p) => n + (p.total ?? 0), 0)
  const payPaid = d.projects.reduce((n, p) => n + (p.paid ?? 0), 0)
  const nextPay = [...unpaid].sort((x, y) => (x.due || '9999').localeCompare(y.due || '9999'))[0]
  const showPay = d.projects.some((p) => p.payments?.length)
  const c = d.colors
  const vars = {
    ['--bf-accent' as string]: c?.accent || d.accent || '#a88a80',
    ['--cp-accent' as string]: c?.accent || d.accent || '#a88a80',
    ['--cp-soft' as string]: c?.soft || `color-mix(in srgb, ${d.accent || '#a88a80'} 35%, #fff)`,
    ['--cp-ink' as string]: c?.ink || d.accent || '#a88a80',
    ['--cp-bg' as string]: c?.bg || '#f7f4f1',
    ['--cp-text' as string]: c?.text || '#33383d',
  }
  const hide = new Set(d.hide ?? [])
  const look = d.look ?? 'suave'
  const nextDays = d.next?.date ? daysTo(d.next.date) : null
  const todos = hide.has('fazer') ? 0 : toSign.length + toAnswer.length + (nextPay ? 1 : 0)

  return (
    <div className={`cp is-${look}`} style={vars}>
      <header className={`cp-hero ${d.cover ? 'has-cover' : ''}`}>
        {d.cover && (
          <div className="cp-cover">
            {d.coverPos?.fit && <img className="ph-backdrop" src={d.cover} alt="" aria-hidden />}
            <img src={d.cover} alt="Capa do projeto" style={coverStyle(d.coverPos)} />
          </div>
        )}
        <div className="cp-hero-text">
          <div className="cp-brand">
            {d.logo ? <img src={d.logo} alt="" className="cp-logo" /> : <span className="cp-mark">{(d.studio || '?')[0]}</span>}
            <span>
              <b>{d.studio}</b>
              <small>atualizado em {new Date(d.updatedAt).toLocaleDateString('pt-BR')}</small>
            </span>
          </div>
          <h1>{d.client ? `Oi, ${d.client}!` : 'Seu painel'}</h1>
          <p>{d.greeting || 'Aqui você acompanha o seu projeto: em que etapa está, quando fica pronto, os pagamentos e os documentos. Sempre atualizado.'}</p>
          {d.next && (
            <p className="cp-next">
              <span className="cp-next-ico">
                <Icon name="calendar" size={15} />
              </span>
              <span>
                <small>próximo encontro{d.next.date ? ` · ${fmt(d.next.date)}${nextDays !== null && nextDays >= 0 && nextDays <= 7 ? ` (${nextDays === 0 ? 'hoje' : nextDays === 1 ? 'amanhã' : `em ${nextDays} dias`})` : ''}` : ''}</small>
                <b>{d.next.text || 'a combinar'}</b>
              </span>
            </p>
          )}
          {d.message && (
            <p className="cp-message">
              <Icon name="chat" size={15} /> {d.message}
            </p>
          )}
        </div>
        {main && (
          <div className="cp-ring" style={{ ['--p' as string]: mPct }} aria-label={`${mPct}% do projeto concluído`}>
            <div>
              <b>{mPct}%</b>
              <small>{main.deliveredDate ? 'entregue' : 'concluído'}</small>
            </div>
          </div>
        )}
      </header>

      {main && !hide.has('resumo') && (
        <div className="cp-glance">
          <div className="cp-tile">
            <span className="cp-tile-ico">
              <Icon name="layers" size={18} />
            </span>
            <small>{main.deliveredDate ? 'situação' : 'etapa de agora'}</small>
            <b>{main.deliveredDate ? 'projeto entregue' : mNow?.name ?? main.status}</b>
            {main.phases.length > 0 && <em>{mDone} de {main.phases.length} etapas prontas</em>}
          </div>
          <div className="cp-tile">
            <span className="cp-tile-ico">
              <Icon name="calendar" size={18} />
            </span>
            <small>{main.deliveredDate ? 'entregue em' : 'fica pronto em'}</small>
            <b>{main.deliveredDate ? fmt(main.deliveredDate) : main.dueDate ? fmt(main.dueDate) : 'a combinar'}</b>
            {days !== null && <em>{inDays(days)}</em>}
          </div>
          {showPay && (
            <div className="cp-tile">
              <span className="cp-tile-ico">
                <Icon name="wallet" size={18} />
              </span>
              <small>{d.projects.filter((p) => p.payments?.length).length > 1 ? 'pagamentos · todos os projetos' : 'pagamentos'}</small>
              <b>
                {money(payPaid)} <span>de {money(payTotal)}</span>
              </b>
              {payTotal > 0 && (
                <div className="cp-bar" aria-hidden>
                  <i style={{ width: `${Math.min(100, Math.round((payPaid / payTotal) * 100))}%` }} />
                </div>
              )}
              <em>{nextPay ? `próximo: ${money(nextPay.amount)}${nextPay.due ? ` em ${fmt(nextPay.due)}` : ` ${nextPay.when}`}` : 'tudo pago'}</em>
            </div>
          )}
          <div className="cp-tile">
            <span className="cp-tile-ico">
              <Icon name="file" size={18} />
            </span>
            <small>documentos</small>
            <b>{docsCount + d.contracts.length + d.briefings.length}</b>
            <em>{toSign.length ? `${toSign.length} para assinar` : 'tudo em dia'}</em>
          </div>
        </div>
      )}

      {todos > 0 && (
        <section className="cp-todo" aria-label="Para você fazer">
          <h2>
            <Icon name="flag" size={16} /> para você fazer
          </h2>
          <div className="cp-todo-list">
            {toSign.map((k) => (
              <div key={k.id} className="cp-action">
                <span className="cp-action-ico">
                  <Icon name="pen" size={20} />
                </span>
                <span className="cp-action-text">
                  <b>assinar o contrato</b>
                  <small>Leia com calma e assine pelo celular. Leva uns 2 minutos.</small>
                </span>
                <a className="btn primary" href={k.signLink}>
                  ler e assinar
                </a>
              </div>
            ))}
            {toAnswer.map((b) => (
              <div key={b.id} className="cp-action">
                <span className="cp-action-ico">
                  <Icon name="clip" size={20} />
                </span>
                <span className="cp-action-text">
                  <b>responder o briefing</b>
                  <small>São perguntas sobre como você vive e o que gosta. Dá para pular o que não souber.</small>
                </span>
                <a className="btn primary" href={b.link}>
                  responder
                </a>
              </div>
            ))}
            {nextPay && (
              <div className="cp-action">
                <span className="cp-action-ico">
                  <Icon name="wallet" size={20} />
                </span>
                <span className="cp-action-text">
                  <b>
                    {nextPay.description} · {money(nextPay.amount)}
                  </b>
                  <small>{nextPay.due ? (daysTo(nextPay.due)! < 0 ? `venceu em ${fmt(nextPay.due)}` : `vence em ${fmt(nextPay.due)}`) : `pagamento ${nextPay.when}`}{d.pix ? ` · Pix: ${d.pix}` : ''}</small>
                </span>
                {d.pix ? (
                  <button type="button" className="btn primary" onClick={copyPix}>
                    <Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Pix copiado' : 'copiar Pix'}
                  </button>
                ) : (
                  <a className="btn" href="#pn-pagamentos" onClick={(e) => jump(e, 'pn-pagamentos')}>
                    ver
                  </a>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <nav className="cp-nav" aria-label="Seções do painel">
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

      <div className={`cp-grid ${hide.has('contato') ? 'no-side' : ''}`}>
        <div className="cp-main">
          {d.projects.length > 0 && !hide.has('etapas') && (
            <section id="pn-projetos" className="cp-section">
              {d.projects.map((p) => (
                <Journey key={p.id} p={p} />
              ))}
              <p className="cp-legend" aria-hidden>
                <span>
                  <i className="is-done">
                    <Icon name="check" size={10} />
                  </i>{' '}
                  pronta
                </span>
                <span>
                  <i className="is-now" /> acontecendo agora
                </span>
                <span>
                  <i /> próximas
                </span>
              </p>
            </section>
          )}

          {showPay && !hide.has('pagamentos') && (
            <section id="pn-pagamentos" className="cp-section">
              <h2 className="cp-h">
                <Icon name="wallet" size={17} /> pagamentos
              </h2>
              {d.projects
                .filter((p) => p.payments?.length)
                .map((p) => (
                  <div key={p.id} className="cp-card">
                    {d.projects.length > 1 && <p className="cp-card-title">{p.title}</p>}
                    {typeof p.total === 'number' && p.total > 0 && (
                      <div className="cp-paysum">
                        <div className="cp-bar is-big">
                          <i style={{ width: `${Math.min(100, Math.round(((p.paid ?? 0) / p.total) * 100))}%` }} />
                        </div>
                        <p>
                          <b>{money(p.paid ?? 0)}</b> pagos de {money(p.total)}
                        </p>
                      </div>
                    )}
                    <ul className="cp-pays">
                      {(p.payments ?? []).map((x, i) => {
                        const late = !x.paid && x.due && daysTo(x.due)! < 0
                        return (
                          <li key={i} className={x.paid ? 'is-paid' : late ? 'is-late' : ''}>
                            <span className="cp-pay-ico">
                              <Icon name={x.paid ? 'check' : late ? 'alert' : 'clock'} size={14} />
                            </span>
                            <span className="grow">
                              <b>{x.description}</b>
                              <small>{x.paid ? `pago${x.paidDate ? ` em ${fmt(x.paidDate)}` : ''}` : x.due ? `${late ? 'venceu' : 'vence'} em ${fmt(x.due)}` : x.when}</small>
                            </span>
                            <span className="cp-pay-val">{money(x.amount)}</span>
                          </li>
                        )
                      })}
                    </ul>
                    {d.pix && (p.payments ?? []).some((x) => !x.paid) && (
                      <p className="cp-pix">
                        <Icon name="wallet" size={14} /> Pix: <b>{d.pix}</b>
                        <button type="button" className="link small" onClick={copyPix}>
                          {copied ? 'copiado' : 'copiar'}
                        </button>
                      </p>
                    )}
                  </div>
                ))}
            </section>
          )}

          {(docsCount > 0 || d.contracts.length > 0 || d.briefings.length > 0 || d.quotes.length > 0) && !hide.has('documentos') && (
            <section id="pn-documentos" className="cp-section">
              <h2 className="cp-h">
                <Icon name="file" size={17} /> documentos
              </h2>
              <div className="cp-docs">
                {d.contracts.map((k) => (
                  <div key={k.id} className={`cp-doc ${k.sign ? 'is-ok' : 'is-todo'}`}>
                    <span className="cp-doc-ico">
                      <Icon name={k.sign ? 'check' : 'pen'} size={18} />
                    </span>
                    <b>{k.title}</b>
                    <small>{k.sign ? `assinado em ${fmt(k.sign.at)}` : 'contrato para assinar'}</small>
                    {!k.sign && k.signLink ? (
                      <a className="btn small primary" href={k.signLink}>
                        ler e assinar
                      </a>
                    ) : (
                      <button className="btn small" onClick={() => open({ title: k.title, node: <ContractDoc s={s} body={k.body} html={k.html} letterhead={k.letterhead} pdfPages={k.pdfPages} clientName={d.clientFull} exclusive={k.exclusive} signed={k.sign} />, w: PAGE.a4[0], h: PAGE.a4[1], file: `Contrato - ${k.title}.pdf`, flow: true })}>
                        <Icon name="eye" size={14} /> ver
                      </button>
                    )}
                  </div>
                ))}
                {d.briefings.map((b) => (
                  <div key={b.id} className={`cp-doc ${b.answered ? 'is-ok' : 'is-todo'}`}>
                    <span className="cp-doc-ico">
                      <Icon name={b.answered ? 'check' : 'clip'} size={18} />
                    </span>
                    <b>{b.title}</b>
                    <small>{b.answered ? `briefing respondido em ${fmt(b.answeredAt)}` : 'briefing esperando as suas respostas'}</small>
                    {b.answered ? (
                      <button className="btn small" onClick={() => open({ title: b.title, node: <BriefingSheetDoc s={s} tpl={{ name: b.title, sections: b.sections ?? [], questions: b.questions ?? [] }} client={d.clientFull} answers={b.answers ?? {}} />, w: PAGE.a4[0], h: PAGE.a4[1], file: `Briefing - ${b.title}.pdf` })}>
                        <Icon name="eye" size={14} /> ver
                      </button>
                    ) : (
                      b.link && (
                        <a className="btn small primary" href={b.link}>
                          responder
                        </a>
                      )
                    )}
                  </div>
                ))}
                {d.docs.map((x) => (
                  <div key={x.id} className="cp-doc">
                    <span className="cp-doc-ico">
                      <Icon name={x.kind === 'obra' ? WORK_KINDS[x.work?.kind ?? 'memorial'].icon : x.kind === 'placa' ? 'hardhat' : x.kind === 'apresentacao' ? 'layers' : x.kind === 'briefing' ? 'clip' : 'ruler'} size={18} />
                    </span>
                    <b>{x.title}</b>
                    <small>atualizado em {fmt(x.updatedAt)}</small>
                    <button className="btn small" onClick={() => openDoc(x)}>
                      <Icon name="eye" size={14} /> ver
                    </button>
                  </div>
                ))}
                {d.files.map((f) => (
                  <div key={f.id} className="cp-doc">
                    <span className="cp-doc-ico">
                      <Icon name={f.type?.startsWith('image/') ? 'image' : 'file'} size={18} />
                    </span>
                    <b>{f.name}</b>
                    <small>
                      {fmt(f.at)}
                      {f.size ? ` · ${size(f.size)}` : ''}
                    </small>
                    <a className="btn small" href={f.url} target="_blank" rel="noreferrer" download={f.url.startsWith('data:') ? f.name : undefined}>
                      <Icon name="download" size={14} /> abrir
                    </a>
                  </div>
                ))}
                {d.quotes.map((q) => (
                  <div key={q.id} className="cp-doc">
                    <span className="cp-doc-ico">
                      <Icon name="wallet" size={18} />
                    </span>
                    <b>{q.title || 'proposta'}</b>
                    <small>
                      proposta {q.number ? `nº ${q.number} · ` : ''}
                      {q.status}
                    </small>
                    <span className="cp-doc-val">{money(q.total)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(d.links ?? []).length > 0 && !hide.has('links') && (
            <section id="pn-links" className="cp-section">
              <h2 className="cp-h">
                <Icon name="link" size={17} /> links do projeto
              </h2>
              <div className="pn-link-cards">
                {(d.links ?? []).map((l, i) => (
                  <a key={i} className="pn-link-card" href={l.url} target="_blank" rel="noreferrer">
                    <span className="pn-ico">
                      <Icon name={linkIcon(l.url)} size={16} />
                    </span>
                    <span className="grow">
                      <b>{l.label}</b>
                      <small>{l.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</small>
                    </span>
                    <Icon name="arrowRight" size={15} />
                  </a>
                ))}
              </div>
            </section>
          )}

          {!hide.has('recado') && <Talk d={d} owner={owner} preview={preview} token={token} />}
        </div>
        {!hide.has('contato') && (
          <aside className="cp-side">
            <Contact d={d} />
          </aside>
        )}
      </div>
      {d.phone && (
        <a className="pn-fab" href={whatsappLink(d.phone, 'Oi! Estou vendo o meu painel do projeto.')} target="_blank" rel="noreferrer" aria-label={`Falar com ${d.owner || d.studio} no WhatsApp`}>
          <Icon name="whatsapp" size={22} />
        </a>
      )}

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
    </div>
  )
}

function jump(e: React.MouseEvent, id: string) {
  e.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Caminho do projeto: cada etapa com o seu símbolo (pronta, agora, próxima), prazos e recados. */
function Journey({ p: raw }: { p: PanelProject }) {
  // entregue: todas as etapas aparecem como prontas
  const p = raw.deliveredDate ? { ...raw, phases: raw.phases.map((x) => ({ ...x, done: true })) } : raw
  const done = p.phases.filter((x) => x.done).length
  const now = p.phases.find((x) => !x.done)
  const pct = p.phases.length ? Math.round((done / p.phases.length) * 100) : p.deliveredDate ? 100 : 0
  return (
    <article className="cp-card cp-journey">
      <header className="cp-journey-head">
        <span>
          <b>{p.title}</b>
          <small>{p.deliveredDate ? `entregue em ${fmt(p.deliveredDate)}` : now ? `agora: ${now.name}` : p.status}</small>
        </span>
        <span className={`cp-chip ${p.deliveredDate ? 'is-ok' : ''}`}>{p.deliveredDate ? 'entregue' : `${pct}%`}</span>
      </header>
      {p.phases.length > 0 && raw.deliveredDate ? (
        <details className="cp-done-steps">
          <summary>ver as {p.phases.length} etapas</summary>
          <ol className="cp-steps">
            {p.phases.map((x, i) => (
              <li key={i} className="is-done">
                <span className="cp-dot">
                  <Icon name="check" size={13} />
                </span>
                <span className="cp-step-text">
                  <b>{x.name}</b>
                  <small>pronta</small>
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : p.phases.length > 0 && (
        <ol className="cp-steps">
          {p.phases.map((x, i) => (
            <li key={i} className={x.done ? 'is-done' : x === now ? 'is-now' : ''}>
              <span className="cp-dot">{x.done ? <Icon name="check" size={13} /> : i + 1}</span>
              <span className="cp-step-text">
                <b>{x.name}</b>
                <small>{x.done ? 'pronta' : x === now ? `acontecendo agora${x.due ? ` · até ${fmt(x.due)}` : ''}` : x.due ? `até ${fmt(x.due)}` : 'depois'}</small>
                {x.note && <small className="cp-note">{x.note}</small>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {p.visits && p.visits.length > 0 && (
        <div className="cp-visits">
          <p className="cp-card-title">
            <Icon name="hardhat" size={14} /> visitas de obra
          </p>
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
        </div>
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

/** Contato do escritório: sempre à mão (ao lado no computador, no fim no celular). */
function Contact({ d }: { d: PanelPayload }) {
  const ig = d.instagram?.replace(/^@/, '')
  const site = d.website ? (/^https?:/.test(d.website) ? d.website : `https://${d.website}`) : ''
  return (
    <div className="pn-contact">
      <p className="pn-contact-title">seu contato</p>
      <b>{d.owner || d.studio}</b>
      {d.owner && d.studio && d.owner !== d.studio && <small className="muted">{d.studio}</small>}
      <div className="pn-contact-links">
        {d.phone && (
          <a href={whatsappLink(d.phone, 'Oi! Estou vendo o meu painel do projeto.')} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" size={15} /> WhatsApp
          </a>
        )}
        {d.email && (
          <a href={`mailto:${d.email}`}>
            <Icon name="mail" size={15} /> e-mail
          </a>
        )}
        {ig && (
          <a href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">
            <Icon name="instagram" size={15} /> @{ig}
          </a>
        )}
        {site && (
          <a href={site} target="_blank" rel="noreferrer">
            <Icon name="link" size={15} /> site
          </a>
        )}
      </div>
    </div>
  )
}

const linkIcon = (url: string): IconName => {
  const u = url.toLowerCase()
  if (/drive\.google|docs\.google|dropbox|onedrive|sharepoint|1drv/.test(u)) return 'folder'
  if (/pinterest|pin\.it/.test(u)) return 'heart'
  if (/wetransfer|we\.tl/.test(u)) return 'download'
  if (/youtube|youtu\.be|vimeo/.test(u)) return 'monitor'
  if (/canva|figma/.test(u)) return 'layers'
  if (/matterport|kuula|panoee|360/.test(u)) return 'cube'
  return 'link'
}

/** Enquadramento da capa escolhido pela profissional (ponto central + aproximação, ou a foto inteira). */
function coverStyle(p?: PanelPayload['coverPos']) {
  if (!p) return undefined
  if (p.fit) return { objectFit: 'contain' as const }
  return { objectPosition: `${p.x}% ${p.y}%`, transform: p.zoom > 1 ? `scale(${p.zoom})` : undefined, transformOrigin: `${p.x}% ${p.y}%` }
}
