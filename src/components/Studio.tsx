import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { useAccess } from '../access'
import { go } from '../router'
import { Icon } from './Icon'
import { DateInput } from './DateInput'
import { Field, Modal, MoneyInput, Progress, Section } from './ui'
import { askDelete, toast } from './dialog'
import { PLANS, type Feature } from '../plans'
import type { Client, Project, ProjectCost, ProjectPhase, ProjectPortal, SiteVisit, VisitPhoto } from '../types'
import { daysUntil, fmtDate, money, payWhen, projectPaid, projectTotal, statusInfo, today, uid, whatsappLink, lower } from '../utils'
import { deletePhoto, packPortal, photoUrls, portalLink, portalShortLink, publishPortal, savePhoto, unpublishPortal, type PortalPayload } from '../studioApi'
import { hashExtra, readShortCode, shortCode } from '../linkPack'
import { usePdf } from './Print'
import { VisitReportDoc } from './Docs'
import { WORK_KINDS, WORK_ORDER } from '../workDocs'

/* Plano Estúdio, dentro de cada demanda: abas para o cronograma das etapas, a obra,
   os custos e o lucro, e a página que o cliente acompanha pelo link. */

export type ProjectTab = 'geral' | 'cronograma' | 'obra' | 'lucro' | 'cliente'
export const PROJECT_TABS: { id: ProjectTab; label: string; icon: string; feature?: Feature; hint: string }[] = [
  { id: 'geral', label: 'visão geral', icon: 'home', hint: 'pagamentos, etapas e anotações' },
  { id: 'cronograma', label: 'cronograma', icon: 'calendar', feature: 'cronograma', hint: 'etapas do projeto com prazo e parcela' },
  { id: 'obra', label: 'obra', icon: 'hardhat', feature: 'obra', hint: 'visitas, fotos e relatório' },
  { id: 'lucro', label: 'custos e lucro', icon: 'trend', feature: 'lucro', hint: 'horas, custos e quanto sobrou' },
  { id: 'cliente', label: 'página do cliente', icon: 'link', feature: 'portal', hint: 'link para o cliente acompanhar' },
]

export function ProjectTabs({ tab, onTab, p }: { tab: ProjectTab; onTab: (t: ProjectTab) => void; p: Project }) {
  const { has } = useAccess()
  const badge = (t: ProjectTab) => {
    if (t === 'cronograma' && p.phases?.length) return `${p.phases.filter((x) => x.done).length}/${p.phases.length}`
    if (t === 'obra' && p.visits?.length) return String(p.visits.length)
    if (t === 'cliente' && p.portal?.enabled) return 'no ar'
    return ''
  }
  return (
    <nav className="st-tabs" role="tablist" aria-label="Partes da demanda">
      {PROJECT_TABS.map((t) => {
        const locked = !!t.feature && !has(t.feature)
        return (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`st-tab ${tab === t.id ? 'is-on' : ''} ${locked ? 'is-locked' : ''}`} onClick={() => onTab(t.id)} title={t.hint}>
            <Icon name={locked ? 'lock' : t.icon} size={15} />
            <span>{t.label}</span>
            {!locked && badge(t.id) && <em>{badge(t.id)}</em>}
          </button>
        )
      })}
    </nav>
  )
}

/** Aba de um recurso do Estúdio para quem não tem o plano: explica e mostra como pedir. */
export function StudioLocked({ tab }: { tab: ProjectTab }) {
  const t = PROJECT_TABS.find((x) => x.id === tab)!
  const text: Record<string, string> = {
    cronograma: 'Organize o projeto em etapas (levantamento, estudo preliminar, anteprojeto, executivo, aprovação, obra), cada uma com prazo e a parcela que é cobrada quando ela termina.',
    obra: 'Registre cada visita de obra com data, fotos, o que foi visto e os próximos passos. Gere um relatório em PDF com a sua marca para mandar ao cliente.',
    lucro: 'Anote as horas e os custos do projeto (taxas, impressões, deslocamento) e veja quanto sobrou de verdade e quanto rendeu cada hora sua.',
    cliente: 'Um link para o cliente acompanhar o projeto: etapas, prazos, pagamentos e arquivos, sempre atualizado. Menos “e aí, como está?” no WhatsApp.',
  }
  return (
    <div className="card st-locked">
      <span className="st-locked-icon">
        <Icon name={t.icon} size={26} />
      </span>
      <p className="eyebrow">plano {PLANS.estudio.name}</p>
      <h2>{t.label}</h2>
      <p className="muted">{text[tab]}</p>
      <button className="btn primary" onClick={() => go('assinatura')}>
        <Icon name="star" size={15} /> conhecer o {PLANS.estudio.name}
      </button>
    </div>
  )
}

/* ---------------- cronograma ---------------- */

const ARCH_PHASES = ['levantamento e medição', 'estudo preliminar', 'anteprojeto', 'projeto executivo', 'aprovação na prefeitura', 'acompanhamento de obra', 'entrega final']
const REG_PHASES = ['levantamento e documentos', 'projeto de regularização', 'protocolo na prefeitura', 'exigências e ajustes', 'aprovação / habite-se', 'averbação no cartório']
const INTERIOR_PHASES = ['briefing e levantamento', 'estudo preliminar (layout)', 'projeto de interiores', 'detalhamento de marcenaria', 'acompanhamento de obra', 'entrega final']
const phaseState = (x: ProjectPhase) => (x.done ? 'done' : x.due && x.due < today() ? 'late' : x.start && x.start <= today() ? 'now' : 'next')
const STATE_LABEL = { done: 'concluída', late: 'atrasada', now: 'em andamento', next: 'a fazer' }

export function CronogramaTab({ p, save }: { p: Project; save: (patch: Partial<Project>) => void }) {
  const phases = p.phases ?? []
  const setPhases = (list: ProjectPhase[]) => save({ phases: list })
  const setOne = (id: string, patch: Partial<ProjectPhase>) => setPhases(phases.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= phases.length) return
    const next = [...phases]
    ;[next[i], next[j]] = [next[j], next[i]]
    setPhases(next)
  }
  // começa com etapas prontas: prazos distribuídos entre o início e a entrega da demanda
  const start = (names: string[]) => {
    const a = p.startDate || today()
    const b = p.dueDate && p.dueDate > a ? p.dueDate : ''
    const span = b ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)) : names.length * 10
    const step = span / names.length
    const at = (k: number) => new Date(Date.parse(a) + Math.round(k * step) * 86_400_000).toISOString().slice(0, 10)
    setPhases(names.map((name, k) => ({ id: uid(), name, start: at(k), due: at(k + 1) })))
  }
  const done = phases.filter((x) => x.done).length
  const current = phases.find((x) => !x.done)

  if (!phases.length)
    return (
      <div className="card st-empty">
        <Icon name="calendar" size={26} />
        <h3>monte o cronograma do projeto</h3>
        <p className="muted">Cada etapa tem prazo e, se quiser, a parcela que é cobrada quando ela termina. O cliente vê tudo na página de acompanhamento.</p>
        <div className="st-empty-actions">
          <button className="btn primary" onClick={() => start(ARCH_PHASES)}>
            <Icon name="building" size={15} /> etapas de arquitetura
          </button>
          <button className="btn" onClick={() => start(INTERIOR_PHASES)}>
            <Icon name="sofa" size={15} /> etapas de interiores
          </button>
          <button className="btn" onClick={() => start(REG_PHASES)}>
            <Icon name="file" size={15} /> etapas de regularização
          </button>
          <button className="btn ghost" onClick={() => setPhases([{ id: uid(), name: 'nova etapa', start: p.startDate || today() }])}>
            <Icon name="plus" size={15} /> do zero
          </button>
        </div>
      </div>
    )

  return (
    <div className="stack">
      <div className="card st-summary">
        <div>
          <p className="st-kicker">andamento</p>
          <p className="st-big">
            {done} de {phases.length} etapas
          </p>
          <Progress value={done} max={phases.length} />
        </div>
        <div>
          <p className="st-kicker">agora</p>
          <p className="st-mid">{current ? current.name : 'tudo concluído ✓'}</p>
          {current?.due && <p className="muted small">prazo {fmtDate(current.due)} · {daysUntil(current.due) >= 0 ? `faltam ${daysUntil(current.due)} dia(s)` : `atrasada ${-daysUntil(current.due)} dia(s)`}</p>}
        </div>
      </div>

      <ol className="st-timeline">
        {phases.map((x, i) => {
          const st = phaseState(x)
          const pay = p.payments.find((y) => y.id === x.paymentId)
          return (
            <li key={x.id} className={`st-phase is-${st}`}>
              <button type="button" className="st-dot" onClick={() => setOne(x.id, { done: !x.done, doneAt: !x.done ? today() : undefined })} aria-label={x.done ? 'Marcar como não concluída' : 'Marcar como concluída'} title={x.done ? 'concluída · tocar desfaz' : 'marcar como concluída'}>
                {x.done ? <Icon name="check" size={14} /> : i + 1}
              </button>
              <div className="st-phase-body">
                <div className="st-phase-head">
                  <input className="st-phase-name" value={x.name} onChange={(e) => setOne(x.id, { name: e.target.value })} aria-label="Nome da etapa" />
                  <span className={`st-state is-${st}`}>{STATE_LABEL[st]}</span>
                </div>
                <div className="st-phase-fields">
                  <label>
                    <span>início</span>
                    <DateInput value={x.start ?? ''} onChange={(e) => setOne(x.id, { start: e.target.value })} aria-label="Início da etapa" />
                  </label>
                  <label>
                    <span>prazo</span>
                    <DateInput value={x.due ?? ''} onChange={(e) => setOne(x.id, { due: e.target.value })} aria-label="Prazo da etapa" />
                  </label>
                  <label className="st-grow">
                    <span>parcela desta etapa</span>
                    <select value={x.paymentId ?? ''} onChange={(e) => setOne(x.id, { paymentId: e.target.value || undefined })}>
                      <option value="">nenhuma</option>
                      {p.payments.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.description} · {money(y.amount)}
                          {y.paidDate ? ' (paga)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <input className="st-phase-note" value={x.note ?? ''} onChange={(e) => setOne(x.id, { note: e.target.value })} placeholder="observação (opcional, o cliente também vê)" />
                {x.done && pay && !pay.paidDate && <p className="st-hint warn">Etapa concluída: hora de cobrar {lower(pay.description)} ({money(pay.amount)}).</p>}
              </div>
              <div className="st-phase-tools">
                <button className="icon-btn subtle" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                  <Icon name="chevronL" size={14} className="rot-90" />
                </button>
                <button className="icon-btn subtle" onClick={() => move(i, 1)} disabled={i === phases.length - 1} aria-label="Descer">
                  <Icon name="chevronR" size={14} className="rot-90" />
                </button>
                <button className="icon-btn subtle" onClick={async () => (await askDelete(`a etapa "${x.name}"`)) && setPhases(phases.filter((y) => y.id !== x.id))} aria-label="Apagar etapa">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      <button className="btn ghost st-add" onClick={() => setPhases([...phases, { id: uid(), name: 'nova etapa', start: phases.at(-1)?.due || today() }])}>
        <Icon name="plus" size={15} /> etapa
      </button>
    </div>
  )
}

/* ---------------- obra ---------------- */

export function ObraTab({ p, save, client }: { p: Project; save: (patch: Partial<Project>) => void; client?: Client }) {
  const { data, userId } = useStore()
  const visits = [...(p.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const [edit, setEdit] = useState<SiteVisit | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const pdf = usePdf()
  const allPhotos = useMemo(() => (p.visits ?? []).flatMap((v) => v.photos), [p.visits])
  useEffect(() => {
    photoUrls(allPhotos).then(setUrls).catch(() => undefined)
  }, [allPhotos])
  const upsertVisit = (v: SiteVisit) => {
    const list = p.visits ?? []
    save({ visits: list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v] })
  }
  const report = async (v: SiteVisit) => {
    const u = await photoUrls(v.photos).catch(() => ({}) as Record<string, string>)
    pdf.download(<VisitReportDoc s={data.settings} client={client} project={p} visit={v} urls={u} />, `Relatório de obra - ${p.title} - ${fmtDate(v.date)}.pdf`)
  }
  const workDocs = (data.docs ?? []).filter((x) => x.kind === 'obra' && x.work?.projectId === p.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <div className="stack">
      <section className="card wd-in-project">
        <header>
          <h3>documentos de obra</h3>
          <p className="muted small">Memorial, compras, custos, diário, relatório de visita, ata e ordem de serviço. Cada um em 4 layouts, com PDF e no painel do cliente.</p>
        </header>
        <div className="wd-new">
          {WORK_ORDER.map((w) => (
            <button key={w} type="button" className="wd-new-btn" onClick={() => go('documentos', `obra-${w}~${p.id}`)}>
              <Icon name={WORK_KINDS[w].icon} size={15} /> {WORK_KINDS[w].label}
            </button>
          ))}
        </div>
        {workDocs.length > 0 && (
          <ul className="wd-saved">
            {workDocs.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => go('documentos', x.id)}>
                  <Icon name={WORK_KINDS[x.work!.kind].icon} size={15} />
                  <span className="grow">
                    <b>{x.title}</b>
                    <small className="muted">
                      {x.work!.items.length} item(ns) · salvo {fmtDate(x.updatedAt.slice(0, 10))}
                    </small>
                  </span>
                  <Icon name="chevronR" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="st-bar">
        <p className="muted small">Cada visita: o que foi visto, fotos e o que fica para depois. O relatório em PDF sai com a sua marca, pronto para mandar.</p>
        <button className="btn primary" onClick={() => setEdit({ id: uid(), date: today(), title: 'visita de obra', notes: '', next: '', photos: [] })}>
          <Icon name="plus" size={15} /> nova visita
        </button>
      </div>
      {visits.length === 0 ? (
        <div className="card st-empty">
          <Icon name="hardhat" size={26} />
          <h3>nenhuma visita ainda</h3>
          <p className="muted">Na próxima ida à obra, anote aqui pelo celular e tire as fotos direto da câmera.</p>
        </div>
      ) : (
        <div className="st-visits">
          {visits.map((v) => (
            <article key={v.id} className="card st-visit">
              <header>
                <span className="st-visit-date">
                  <b>{v.date.slice(8, 10)}</b>
                  <small>{new Date(v.date + 'T12:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small>
                </span>
                <div className="grow">
                  <h3>{v.title || 'visita de obra'}</h3>
                  <p className="muted small">
                    {fmtDate(v.date)} · {v.photos.length} foto(s)
                  </p>
                </div>
              </header>
              {v.notes && <p className="st-visit-notes">{v.notes}</p>}
              {v.next && (
                <p className="st-visit-next">
                  <b>próximos passos:</b> {v.next}
                </p>
              )}
              {v.photos.length > 0 && (
                <div className="st-photos">
                  {v.photos.slice(0, 8).map((ph) => (
                    <a key={ph.id} href={urls[ph.id]} target="_blank" rel="noreferrer" className="st-photo">
                      {urls[ph.id] ? <img src={urls[ph.id]} alt={ph.caption || 'foto da obra'} loading="lazy" /> : <span />}
                    </a>
                  ))}
                  {v.photos.length > 8 && <span className="st-photo st-photo-more">+{v.photos.length - 8}</span>}
                </div>
              )}
              <footer>
                <button className="btn small" onClick={() => void report(v)}>
                  <Icon name="file" size={14} /> relatório em PDF
                </button>
                <button className="btn small ghost" onClick={() => setEdit(v)}>
                  <Icon name="edit" size={14} /> editar
                </button>
                <button
                  className="icon-btn subtle"
                  aria-label="Apagar visita"
                  onClick={async () => {
                    if (!(await askDelete(`a visita de ${fmtDate(v.date)} e as fotos dela`))) return
                    v.photos.forEach((ph) => void deletePhoto(ph).catch(() => undefined))
                    save({ visits: (p.visits ?? []).filter((x) => x.id !== v.id) })
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
      {edit && <VisitForm initial={edit} projectId={p.id} userId={userId || 'previa'} urls={urls} onClose={() => setEdit(null)} onSave={(v) => (upsertVisit(v), setEdit(null))} />}
      {pdf.portal}
    </div>
  )
}

function VisitForm({ initial, projectId, userId, urls, onClose, onSave }: { initial: SiteVisit; projectId: string; userId: string; urls: Record<string, string>; onClose: () => void; onSave: (v: SiteVisit) => void }) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(0)
  const [local, setLocal] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const add = async (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    setBusy((n) => n + list.length)
    for (const f of list) {
      try {
        const ph = await savePhoto(userId, projectId, f)
        setLocal((m) => ({ ...m, [ph.id]: URL.createObjectURL(f) }))
        setV((x) => ({ ...x, photos: [...x.photos, ph] }))
      } catch {
        toast(`Não foi possível enviar ${f.name}. Confira a internet e tente de novo.`)
      }
      setBusy((n) => n - 1)
    }
  }
  const src = (ph: VisitPhoto) => local[ph.id] || urls[ph.id] || ph.data
  return (
    <Modal
      title={initial.notes || initial.photos.length ? 'editar visita' : 'nova visita de obra'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            cancelar
          </button>
          <button className="btn primary" disabled={busy > 0} onClick={() => onSave(v)}>
            {busy ? `enviando ${busy} foto(s)…` : 'salvar visita'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Data">
          <DateInput value={v.date} onChange={(e) => setV({ ...v, date: e.target.value || today() })} />
        </Field>
        <Field label="Título" span={2}>
          <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Ex.: conferência da marcenaria" />
        </Field>
        <Field label="O que foi visto" span={3}>
          <textarea rows={4} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Ex.: alvenaria da cozinha concluída; ponto de água da ilha no lugar errado, pedido para mover 20 cm." spellCheck lang="pt-BR" />
        </Field>
        <Field label="Próximos passos / pendências" span={3}>
          <textarea rows={2} value={v.next ?? ''} onChange={(e) => setV({ ...v, next: e.target.value })} placeholder="Ex.: marceneiro mede na sexta; cliente escolhe o porcelanato até dia 10." spellCheck lang="pt-BR" />
        </Field>
      </div>
      <div className="st-photo-edit">
        <div className="st-bar">
          <span className="field-label">fotos ({v.photos.length})</span>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            <Icon name="camera" size={14} /> adicionar fotos
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (void add(e.target.files), (e.target.value = ''))} />
        </div>
        {v.photos.length > 0 && (
          <div className="st-photos is-edit">
            {v.photos.map((ph) => (
              <figure key={ph.id} className="st-photo">
                {src(ph) ? <img src={src(ph)} alt="" /> : <span />}
                <input value={ph.caption ?? ''} onChange={(e) => setV({ ...v, photos: v.photos.map((x) => (x.id === ph.id ? { ...x, caption: e.target.value } : x)) })} placeholder="legenda" aria-label="Legenda da foto" />
                <button
                  className="st-photo-x"
                  aria-label="Tirar foto"
                  onClick={() => {
                    void deletePhoto(ph).catch(() => undefined)
                    setV({ ...v, photos: v.photos.filter((x) => x.id !== ph.id) })
                  }}
                >
                  <Icon name="x" size={12} />
                </button>
              </figure>
            ))}
          </div>
        )}
        {busy > 0 && <p className="muted small">diminuindo e guardando as fotos…</p>}
      </div>
    </Modal>
  )
}

/* ---------------- custos e lucro ---------------- */

const COST_CATS = ['taxas (RRT/ART, prefeitura)', 'impressão e plotagem', 'deslocamento', 'terceirizados', 'material', 'outros']

export function LucroTab({ p, save }: { p: Project; save: (patch: Partial<Project>) => void }) {
  const { data, setSettings } = useStore()
  const costs = [...(p.costs ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const [draft, setDraft] = useState<ProjectCost>({ id: uid(), date: today(), description: '', category: COST_CATS[0], amount: 0 })
  const [hours, setHours] = useState('')
  const total = projectTotal(p)
  const received = projectPaid(p)
  const spent = costs.reduce((s, x) => s + (x.amount || 0), 0)
  const worked = p.timeLogs.reduce((s, x) => s + (x.hours || 0), 0)
  const rate = data.settings.hourlyCost ?? 0
  const profit = total - spent
  const perHour = worked > 0 ? profit / worked : 0
  const afterTime = profit - worked * rate
  const margin = total > 0 ? Math.round((profit / total) * 100) : 0
  const addCost = () => {
    if (!draft.description.trim() || !draft.amount) return toast('Escreva o que foi e o valor.')
    save({ costs: [...(p.costs ?? []), { ...draft, description: draft.description.trim() }] })
    setDraft({ id: uid(), date: today(), description: '', category: draft.category, amount: 0 })
  }
  const addHours = () => {
    const h = Number(hours.replace(',', '.'))
    if (!h || h <= 0) return
    save({ timeLogs: [...p.timeLogs, { id: uid(), date: today(), hours: h, note: 'lançado à mão' }] })
    setHours('')
  }
  return (
    <div className="stack">
      <div className="st-kpis">
        <div className="card st-kpi">
          <span>valor do projeto</span>
          <b>{money(total)}</b>
          <small>recebido {money(received)}</small>
        </div>
        <div className="card st-kpi">
          <span>custos</span>
          <b>{money(spent)}</b>
          <small>{costs.length} lançamento(s)</small>
        </div>
        <div className={`card st-kpi ${profit >= 0 ? 'is-good' : 'is-bad'}`}>
          <span>lucro</span>
          <b>{money(profit)}</b>
          <small>{margin}% do valor</small>
        </div>
        <div className="card st-kpi">
          <span>cada hora rendeu</span>
          <b>{worked ? money(perHour) : '—'}</b>
          <small>{worked ? `${worked.toLocaleString('pt-BR')} h trabalhadas` : 'lance as horas abaixo'}</small>
        </div>
      </div>

      <div className="grid-2">
        <Section title="custos do projeto">
          <div className="st-cost-form">
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="O que foi (ex.: RRT, plotagem A1)" onKeyDown={(e) => e.key === 'Enter' && addCost()} />
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} aria-label="Tipo de custo">
              {COST_CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <MoneyInput value={draft.amount} onChange={(n) => setDraft({ ...draft, amount: n })} />
            <button className="btn primary" onClick={addCost}>
              <Icon name="plus" size={15} /> lançar
            </button>
          </div>
          {costs.length === 0 ? (
            <p className="muted small">Nenhum custo ainda. Taxas, impressões, deslocamento e terceirizados entram aqui e saem do lucro.</p>
          ) : (
            <ul className="st-rows">
              {costs.map((c) => (
                <li key={c.id}>
                  <span className="grow">
                    <b>{c.description}</b>
                    <small className="muted">
                      {c.category} · {fmtDate(c.date)}
                    </small>
                  </span>
                  <span className="nowrap">{money(c.amount)}</span>
                  <button className="icon-btn subtle" aria-label="Apagar custo" onClick={() => save({ costs: (p.costs ?? []).filter((x) => x.id !== c.id) })}>
                    <Icon name="x" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="horas e o valor do seu tempo">
          <div className="st-cost-form is-hours">
            <input value={hours} inputMode="decimal" onChange={(e) => setHours(e.target.value)} placeholder="horas de hoje (ex.: 2,5)" onKeyDown={(e) => e.key === 'Enter' && addHours()} />
            <button className="btn" onClick={addHours}>
              <Icon name="clock" size={15} /> lançar horas
            </button>
          </div>
          <p className="muted small">O cronômetro da visão geral também soma aqui.</p>
          <Field label="Quanto vale uma hora sua" hint="Serve para ver o lucro depois de pagar o seu tempo. Vale para todos os projetos.">
            <MoneyInput value={rate} onChange={(n) => setSettings({ hourlyCost: n })} />
          </Field>
          <dl className="st-lines">
            <div>
              <dt>lucro</dt>
              <dd>{money(profit)}</dd>
            </div>
            <div>
              <dt>seu tempo ({worked.toLocaleString('pt-BR')} h × {money(rate)})</dt>
              <dd>− {money(worked * rate)}</dd>
            </div>
            <div className={afterTime >= 0 ? 'is-good' : 'is-bad'}>
              <dt>sobrou depois de pagar o seu tempo</dt>
              <dd>{money(afterTime)}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </div>
  )
}

/* ---------------- página do cliente ---------------- */

export function portalPayload(p: Project, client: Client | undefined, st: ReturnType<typeof useStore>['data']['settings'], portal: ProjectPortal): PortalPayload {
  return {
    studio: st.brandName || st.ownerName || '',
    owner: st.ownerName || '',
    accent: st.accent,
    logo: st.logo && st.logo.length < 250_000 ? st.logo : undefined,
    phone: st.phone || undefined,
    client: client?.name.split(' ')[0] ?? '',
    title: p.title,
    status: statusInfo(p.status).label,
    startDate: p.startDate,
    dueDate: p.dueDate,
    deliveredDate: p.deliveredDate,
    message: portal.message?.trim() || undefined,
    phases: (p.phases ?? []).map((x) => ({ name: x.name, start: x.start, due: x.due, done: x.done })),
    ...(portal.showPayments
      ? {
          payments: p.payments.map((x) => ({ description: x.description, amount: x.amount, when: payWhen(x) === 'conclusao' ? 'na conclusão' : 'no fechamento', paid: !!x.paidDate, paidDate: x.paidDate })),
          total: projectTotal(p),
          paid: projectPaid(p),
        }
      : {}),
    ...(portal.showFiles && p.filesLink ? { filesLink: p.filesLink } : {}),
    ...(portal.showVisits ? { visits: (p.visits ?? []).map((v) => ({ date: v.date, title: v.title, notes: v.notes, next: v.next, photos: v.photos.length })).sort((a, b) => b.date.localeCompare(a.date)) } : {}),
    updatedAt: new Date().toISOString(),
  }
}

/** Mantém a página do cliente em dia: publica de novo quando algo muda na demanda. */
export function usePortalSync(p: Project | undefined, client: Client | undefined) {
  const { data, userId } = useStore()
  const payload = p?.portal?.enabled ? JSON.stringify({ ...portalPayload(p, client, data.settings, p.portal), updatedAt: '' }) : ''
  const last = useRef('')
  useEffect(() => {
    if (!payload || !p?.portal || payload === last.current) return
    const t = setTimeout(() => {
      last.current = payload
      void publishPortal(p.portal!.token, { ...JSON.parse(payload), updatedAt: new Date().toISOString() }, userId).catch(() => undefined)
    }, 1500)
    return () => clearTimeout(t)
  }, [payload, p?.portal])
}

export function ClienteTab({ p, save, client }: { p: Project; save: (patch: Partial<Project>) => void; client?: Client }) {
  const { data, userId } = useStore()
  const portal = p.portal
  // cópia dentro do link (abre mesmo se a nuvem falhar); acompanha o que muda na demanda
  const snapshot = portal?.enabled ? JSON.stringify({ ...portalPayload(p, client, data.settings, portal), updatedAt: '' }) : ''
  const [packed, setPacked] = useState('')
  useEffect(() => {
    if (!snapshot) return
    let off = false
    void packPortal({ ...JSON.parse(snapshot), updatedAt: new Date().toISOString() }).then((v) => !off && setPacked(v))
    return () => {
      off = true
    }
  }, [snapshot])
  const code = portal?.file && userId ? shortCode(userId, portal.token) : ''
  const link = portal ? (code ? portalShortLink(code) : portalLink(portal.token, packed)) : ''
  const enable = async () => {
    const next: ProjectPortal = { token: portal?.token ?? crypto.randomUUID(), enabled: true, showPayments: portal?.showPayments ?? true, showFiles: portal?.showFiles ?? true, showVisits: portal?.showVisits ?? true, message: portal?.message }
    let online = true
    let file = false
    try {
      file = (await publishPortal(next.token, portalPayload(p, client, data.settings, next), userId)).file
    } catch {
      online = false
    }
    save({ portal: { ...next, file: file || undefined, publishedAt: new Date().toISOString() } })
    toast(online ? 'Página no ar. Agora é só mandar o link.' : 'Página criada. A nuvem não respondeu agora: o link leva uma cópia do projeto e abre mesmo assim. Quando mudar algo, mande o link de novo.')
  }
  const disable = async () => {
    if (!portal) return
    await unpublishPortal(portal.token, userId).catch(() => undefined)
    save({ portal: { ...portal, enabled: false } })
    toast('Página tirada do ar. O link não abre mais.')
  }
  const set = (patch: Partial<ProjectPortal>) => portal && save({ portal: { ...portal, ...patch } })
  const [peek, setPeek] = useState(false)
  const first = client?.name.split(' ')[0] ?? ''
  const msg = `Oi${first ? `, ${first}` : ''}! Por este link você acompanha o projeto ${p.title}: etapas, prazos e pagamentos, sempre atualizados. ${link}`

  if (!portal?.enabled)
    return (
      <div className="card st-empty">
        <Icon name="link" size={26} />
        <h3>página do projeto para o cliente</h3>
        <p className="muted">Um link que o cliente abre no celular, sem conta, e vê as etapas, os prazos, os pagamentos e os arquivos. Ela se atualiza sozinha quando você muda algo aqui.</p>
        <div className="st-empty-actions">
          <button className="btn primary" onClick={() => void enable()}>
            <Icon name="link" size={15} /> criar a página
          </button>
        </div>
        {!p.phases?.length && <p className="muted small">Dica: monte o cronograma antes, é a parte que o cliente mais olha.</p>}
      </div>
    )

  return (
    <div className="grid-2">
      <Section title="o link">
        <p className="st-link">{link}</p>
        <div className="row gap-s wrap">
          {client?.phone && (
            <a className="btn primary small" href={whatsappLink(client.phone, msg)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={14} /> mandar no WhatsApp
            </a>
          )}
          <button
            className="btn small"
            onClick={() =>
              navigator.clipboard
                ?.writeText(link)
                .then(() => toast('Link copiado.'))
                .catch(() => toast(link))
            }
          >
            <Icon name="copy" size={14} /> copiar
          </button>
          <button className="btn small ghost" onClick={() => setPeek(true)}>
            <Icon name="eye" size={14} /> ver como o cliente vê
          </button>
        </div>
        {peek && (
          <Modal wide title="como o cliente vê" onClose={() => setPeek(false)}>
            <p className="muted small">É exatamente esta página que abre no celular do cliente.</p>
            <div className="bf-preview-frame">
              <PortalPublic token={portal.token} data={{ ...portalPayload(p, client, data.settings, portal), updatedAt: new Date().toISOString() }} preview />
            </div>
          </Modal>
        )}
        <p className="muted small">Atualiza sozinha quando você muda etapas, pagamentos ou visitas.</p>
        <button className="link small danger-link" onClick={() => void disable()}>
          tirar a página do ar
        </button>
      </Section>
      <Section title="o que o cliente vê">
        <div className="stack-s">
          <label className="check">
            <input type="checkbox" checked disabled /> <span>etapas e prazos do cronograma</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={portal.showPayments} onChange={(e) => set({ showPayments: e.target.checked })} /> <span>pagamentos (o que já foi pago e o que falta)</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={portal.showVisits} onChange={(e) => set({ showVisits: e.target.checked })} /> <span>visitas de obra (sem as fotos)</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={portal.showFiles} onChange={(e) => set({ showFiles: e.target.checked })} /> <span>link dos arquivos {p.filesLink ? '' : '(coloque em “editar” da demanda)'}</span>
          </label>
          <Field label="Recado para o cliente (opcional)">
            <textarea rows={3} value={portal.message ?? ''} onChange={(e) => set({ message: e.target.value })} placeholder="Ex.: estamos na fase do executivo; semana que vem te mando as plantas para aprovar ☺️" spellCheck lang="pt-BR" />
          </Field>
        </div>
      </Section>
    </div>
  )
}

/* ---------------- página pública (o cliente abre pelo link) ---------------- */

export function PortalPublic({ token: raw, data, preview, short }: { token: string; data?: PortalPayload; preview?: boolean; short?: boolean }) {
  const code = short ? readShortCode(raw) : null
  const token = code?.id ?? raw
  const [d, setD] = useState<PortalPayload | null | undefined>(data)
  useEffect(() => {
    if (!data) import('../studioApi').then(({ loadPortal }) => loadPortal(token, short ? '' : hashExtra(), code?.userId)).then(setD, () => setD(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, data])
  const wrap = (children: ReactNode) => (
    <div className={`bf-public pt-public ${preview ? 'is-preview' : ''}`} style={{ ['--bf-accent' as string]: d?.accent || '#a88a80' }}>
      <div className="bf-card">{children}</div>
      <p className="bf-foot"><a href="https://useplane.com.br" target="_blank" rel="noreferrer">feito com planê · useplane.com.br</a></p>
    </div>
  )
  if (d === undefined) return wrap(<p className="muted">carregando…</p>)
  if (d === null) return wrap(<p>Esta página não está mais no ar. Fale com quem te enviou o link.</p>)
  const done = d.phases.filter((x) => x.done).length
  const now = d.phases.find((x) => !x.done)
  const fmt = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
  return wrap(
    <>
      <header className="bf-head">
        {d.logo && <img src={d.logo} alt="" className="bf-logo" />}
        <p className="bf-eyebrow">{d.studio}</p>
        <h1>{d.title}</h1>
        <p className="muted">
          {d.client ? `Oi, ${d.client}! ` : ''}Aqui você acompanha o seu projeto. Atualizado em {new Date(d.updatedAt).toLocaleDateString('pt-BR')}.
        </p>
      </header>
      {d.message && <p className="pt-message">{d.message}</p>}
      <section className="pt-now">
        <div>
          <span>situação</span>
          <b>{d.deliveredDate ? 'entregue ✓' : now ? now.name : d.status}</b>
        </div>
        {d.dueDate && !d.deliveredDate && (
          <div>
            <span>entrega prevista</span>
            <b>{fmt(d.dueDate)}</b>
          </div>
        )}
        {d.phases.length > 0 && (
          <div>
            <span>etapas</span>
            <b>
              {done} de {d.phases.length}
            </b>
          </div>
        )}
      </section>
      {d.phases.length > 0 && (
        <section className="bf-block">
          <h2>etapas</h2>
          <ol className="pt-steps">
            {d.phases.map((x, i) => (
              <li key={i} className={x.done ? 'is-done' : x === now ? 'is-now' : ''}>
                <span className="pt-dot">{x.done ? '✓' : i + 1}</span>
                <span className="grow">
                  <b>{x.name}</b>
                  <small>{x.done ? 'concluída' : x.due ? `prazo ${fmt(x.due)}` : ''}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {d.payments && d.payments.length > 0 && (
        <section className="bf-block">
          <h2>pagamentos</h2>
          <ul className="pt-pays">
            {d.payments.map((x, i) => (
              <li key={i}>
                <span className="grow">
                  <b>{x.description}</b>
                  <small>{x.paid ? `pago${x.paidDate ? ` em ${fmt(x.paidDate)}` : ''}` : x.when}</small>
                </span>
                <span className={x.paid ? 'pt-paid' : ''}>{money(x.amount)}</span>
              </li>
            ))}
          </ul>
          {typeof d.total === 'number' && (
            <p className="pt-total">
              pago {money(d.paid ?? 0)} de {money(d.total)}
            </p>
          )}
        </section>
      )}
      {d.visits && d.visits.length > 0 && (
        <section className="bf-block">
          <h2>visitas de obra</h2>
          {d.visits.map((v, i) => (
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
        </section>
      )}
      {d.filesLink && (
        <a className="btn primary bf-send" href={d.filesLink} target="_blank" rel="noreferrer">
          abrir os arquivos do projeto
        </a>
      )}
      {d.phone && (
        <a className="btn bf-send pt-talk" href={whatsappLink(d.phone, `Oi! Estou vendo o andamento do projeto ${d.title}.`)} target="_blank" rel="noreferrer">
          falar com {d.owner || d.studio} no WhatsApp
        </a>
      )}
    </>,
  )
}
