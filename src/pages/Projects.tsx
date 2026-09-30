import { useEffect, useMemo, useRef, useState } from 'react'
import { useKeep } from '../keep'
import { useStore } from '../store'
import { go, href } from '../router'
import { askDelete } from '../components/dialog'
import { waitingDays } from './Quotes'
import { PayNext, QuoteStatusSelect, StatusSelect, requestStatus, TaskQuick } from '../components/quick'
import { Icon } from '../components/Icon'
import { ProjectForm } from '../components/forms'
import { Badge, Empty, Segmented, usePaged } from '../components/ui'
import type { Priority, Project, ProjectStatus } from '../types'
import {
  boardColumns,
  PRIORITY,
  statusInfo,
  COLUMN_COLORS,
  uid,
  daysUntil,
  deadlineInfo,
  quoteNumber,
  fmtDate,
  isLate,
  isOpen,
  money,
  projectOpen,
  projectTotal,
  relativeDays,
  sum,
  urgency,
  urgencyScore,
 matches, quoteTotal, fmtDateLong } from '../utils'

type View = 'quadro' | 'lista'
type Scope = 'ativos' | 'todos' | 'atrasados' | 'arquivo'

export default function Projects() {
  const { data, upsert, setSettings, replaceAll } = useStore()
  const custom = data.settings.customColumns
  const panHandlers = useDragScroll()
  const board = useBoardFit()
  const [newCol, setNewCol] = useState('')
  const removeColumn = async (col: string) => {
    const count = data.projects.filter((p) => p.status === col).length
    if (!(await askDelete(`a coluna "${statusInfo(col).label}"${count ? ` (as ${count} demanda(s) dela voltam para "em alinhamento")` : ''}`))) return
    replaceAll({
      ...data,
      projects: data.projects.map((p) => (p.status === col ? { ...p, status: 'briefing' } : p)),
      settings: { ...data.settings, customColumns: custom.filter((c) => c.id !== col) },
    })
  }
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem('proj-view') as View) || 'quadro'
    } catch {
      return 'quadro'
    }
  })
  const [q, setQ] = useKeep('dem-busca', '')
  const [clientId, setClientId] = useKeep('dem-cliente', '')
  const [prio, setPrio] = useKeep<Priority | ''>('dem-prio', '')
  const [scope, setScope] = useKeep<Scope>('dem-escopo', 'ativos')
  const [form, setForm] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ProjectStatus | null>(null)

  const changeView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem('proj-view', v)
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  }

  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    const term = q.toLowerCase()
    return data.projects
      .filter((p) => !clientId || p.clientId === clientId)
      .filter((p) => !prio || urgency(p).level === prio)
      .filter((p) => matches(term, p.title, clientName(p.clientId), ...data.quotes.filter((x) => x.projectId === p.id).map((x) => `#${x.number}`)))
  }, [data, q, clientId, prio])

  // orçamentos antes de virar demanda: rascunhos e enviados (esperando a resposta do cliente)
  const quotesIn = useMemo(() => {
    const term = q.toLowerCase()
    const of = (status: 'rascunho' | 'enviado') =>
      data.quotes
        .filter((x) => x.status === status && !x.projectId)
        .filter((x) => !clientId || x.clientId === clientId)
        .filter((x) => matches(term, x.title, clientName(x.clientId), `#${x.number}`))
        .sort((a, b) => ((status === 'enviado' ? b.sentAt : b.createdAt) ?? '').localeCompare((status === 'enviado' ? a.sentAt : a.createdAt) ?? ''))
    return { rascunho: of('rascunho'), enviado: of('enviado') }
  }, [data, q, clientId])

  const move = (p: Project, status: ProjectStatus) => requestStatus(p, status, (next) => upsert('projects', next))
  // resumo dos orçamentos: o que ainda está em negociação e o que virou demanda neste mês
  const month = new Date().toISOString().slice(0, 7)
  const approvedMonth = data.quotes.filter((x) => x.status === 'aprovado' && (x.closedAt ?? x.createdAt).startsWith(month))
  const sentOpen = data.quotes.filter((x) => x.status === 'enviado' && !x.projectId)

  return (
    <div className={`page ${view === 'quadro' ? 'page-board' : ''}`}>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {data.projects.filter(isOpen).length} ativas · <span className="money">{money(sum(data.projects.filter(isOpen), projectTotal))}</span> em produção
          </p>
          <h1>
            minhas <em>demandas</em>
          </h1>
        </div>
        <button className="btn primary" onClick={() => setForm(true)}>
          <Icon name="plus" size={16} /> Nova demanda
        </button>
      </div>

      <div className="toolbar">
        <Segmented<View>
          value={view}
          onChange={changeView}
          options={[
            { value: 'quadro', label: <><Icon name="grid" size={14} /> Quadro</> },
            { value: 'lista', label: <><Icon name="list" size={14} /> Lista</> },
          ]}
        />
        <div className="search inline">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" />
        </div>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Todos os clientes</option>
          {[...data.clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={prio} onChange={(e) => setPrio(e.target.value as Priority | '')}>
          <option value="">Qualquer urgência</option>
          {(Object.keys(PRIORITY) as Priority[]).map((k) => (
            <option key={k} value={k}>
              {PRIORITY[k].label}
            </option>
          ))}
        </select>
        {view === 'lista' && (
          <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            <option value="ativos">Em andamento</option>
            <option value="atrasados">Atrasados</option>
            <option value="arquivo">Entregues / cancelados</option>
            <option value="todos">Todos</option>
          </select>
        )}
        {view === 'quadro' && (board.edges.left || board.edges.right) && (
          <div className="board-nav">
            <button className="icon-btn" disabled={!board.edges.left} onClick={() => board.step(-1)} aria-label="Colunas anteriores">
              <Icon name="chevronL" size={16} />
            </button>
            <button className="icon-btn" disabled={!board.edges.right} onClick={() => board.step(1)} aria-label="Mais colunas">
              <Icon name="chevronR" size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="quote-strip">
        <a href={href('orcamentos')} className="qs-item">
          <b>{data.quotes.filter((x) => x.status === 'rascunho').length}</b>
          <span>rascunhos</span>
        </a>
        <a href={href('orcamentos')} className="qs-item">
          <b>{sentOpen.length}</b>
          <span>enviados · {money(sum(sentOpen, (x) => quoteTotal(x, data.settings.urgencyFee)))} em negociação</span>
        </a>
        <Icon name="arrowRight" size={16} className="qs-arrow" />
        <a href={href('orcamentos')} className="qs-item is-good">
          <b>{approvedMonth.length}</b>
          <span>fechados neste mês · viraram demanda</span>
        </a>
      </div>

      {data.projects.length === 0 ? (
        <Empty icon="folder" title="Nenhuma demanda ainda" text="Cadastre seu primeiro projeto para acompanhar prazos e pagamentos." action={<button className="btn primary" onClick={() => setForm(true)}>Nova demanda</button>} />
      ) : view === 'quadro' ? (
        <div className="board" ref={board.ref} {...panHandlers}>
          {!prio &&
            (
              [
                ['rascunho', 'rascunhos', '#b9aba6', 'Nenhum rascunho de orçamento.'],
                ['enviado', 'enviados', '#c29a55', 'Nenhum orçamento esperando resposta.'],
              ] as const
            ).map(([st, label, color, empty]) => {
              const list = quotesIn[st]
              return (
                <div key={st} className="column column-drafts">
                  <header>
                    <span className="dot" style={{ background: color }} />
                    <h4>{label}</h4>
                    <span className="count">{list.length}</span>
                  </header>
                  <p className="column-kind">orçamento · {st === 'rascunho' ? 'ainda não enviado' : 'esperando o cliente'}</p>
                  <div className="column-body">
                    {list.slice(0, 8).map((x) => (
                      <div key={x.id} className="kcard kcard-draft" role="link" tabIndex={0} onClick={() => go('orcamentos', x.id)} onKeyDown={(e) => e.key === 'Enter' && go('orcamentos', x.id)}>
                        <div className="kcard-top">
                          <span className="kcard-client">{x.clientId ? clientName(x.clientId) : 'sem cliente'}</span>
                          {x.number ? <span className="kcard-num">{quoteNumber(x)}</span> : null}
                        </div>
                        <div className="kcard-title">{x.title || 'orçamento sem título'}</div>
                        <div className="kcard-foot">
                          <span className="small">{money(quoteTotal(x, data.settings.urgencyFee))}</span>
                          <span className="muted small">
                            {st === 'enviado' && x.sentAt ? (waitingDays(x) > 0 ? `aguardando há ${waitingDays(x)} dia(s)` : 'enviado hoje') : fmtDateLong(x.createdAt)}
                          </span>
                        </div>
                        <div className="kcard-status" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <QuoteStatusSelect q={x} />
                        </div>
                      </div>
                    ))}
                    {!list.length && <p className="muted small center">{empty}</p>}
                    {list.length > 8 && (
                      <a className="muted small center" href={href('orcamentos')}>
                        +{list.length - 8} {label} · ver todos em orçamentos
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          {boardColumns().map((col, ci) => {
            let items = filtered.filter((p) => p.status === col)
            if (col === 'entregue') items = items.sort((a, b) => (b.deliveredDate ?? '').localeCompare(a.deliveredDate ?? '')).slice(0, 8)
            else items = items.sort((a, b) => urgencyScore(b) - urgencyScore(a))
            return (
              <div
                key={col}
                className={`column ${overCol === col ? 'drop' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverCol(col)
                }}
                onDragLeave={() => setOverCol(null)}
                onDrop={() => {
                  const p = data.projects.find((x) => x.id === dragId)
                  if (p) move(p, col)
                  setDragId(null)
                  setOverCol(null)
                }}
              >
                <header>
                  <span className="dot" style={{ background: statusInfo(col).color }} />
                  {custom.some((c) => c.id === col) ? (
                    <input
                      className="column-title-input"
                      value={statusInfo(col).label}
                      onChange={(e) => setSettings({ customColumns: custom.map((c) => (c.id === col ? { ...c, label: e.target.value } : c)) })}
                      aria-label="Nome da coluna"
                    />
                  ) : (
                    <h4>{statusInfo(col).label}</h4>
                  )}
                  <span className="count">{items.length}</span>
                  {custom.some((c) => c.id === col) && (
                    <button className="icon-btn subtle" title="Excluir coluna" onClick={() => removeColumn(col)}>
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </header>
                {!prio && <p className={`column-kind ${ci === 0 ? 'is-closed' : 'is-blank'}`}>{ci === 0 ? 'cliente fechou · demanda' : 'demanda'}</p>}
                <div className="column-body">
                  {items.map((p) => (
                    <ProjectCard key={p.id} p={p} client={clientName(p.clientId)} onDragStart={() => setDragId(p.id)} />
                  ))}
                  {col === 'entregue' && <p className="muted small center">Últimas entregas · veja todas na lista</p>}
                </div>
              </div>
            )
          })}
          <div className="column add-column">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const label = newCol.trim()
                if (!label) return
                setSettings({ customColumns: [...custom, { id: `col-${uid()}`, label, color: COLUMN_COLORS[custom.length % COLUMN_COLORS.length] }] })
                setNewCol('')
              }}
            >
              <input value={newCol} onChange={(e) => setNewCol(e.target.value)} placeholder="nova coluna…" aria-label="Nome da nova coluna" />
              <button className="btn small" disabled={!newCol.trim()}>
                <Icon name="plus" size={14} /> adicionar
              </button>
            </form>
            <p className="muted small">Ex.: “aguardando arquivos”, “pós-produção”. Aparece antes de “entregue”.</p>
          </div>
        </div>
      ) : (
        <ProjectTable
          projects={filtered.filter((p) =>
            scope === 'ativos' ? isOpen(p) : scope === 'atrasados' ? isLate(p) : scope === 'arquivo' ? !isOpen(p) : true,
          )}
          clientName={clientName}
        />
      )}

      {form && <ProjectForm onClose={() => setForm(false)} onSaved={(p) => go('projetos', p.id)} />}
    </div>
  )
}

function ProjectCard({ p, client, onDragStart }: { p: Project; client: string; onDragStart: () => void }) {
  const { data } = useStore()
  const quote = data.quotes.find((q) => q.projectId === p.id)
  const dl = deadlineInfo(p)
  return (
    <div className="kcard" draggable onDragStart={onDragStart} onClick={() => go('projetos', p.id)}>
      <div className="kcard-top">
        <span className="kcard-client">{client || 'sem cliente'}</span>
        {quote && <span className="kcard-num">{quoteNumber(quote)}</span>}
      </div>
      <div className="kcard-title">{p.title}</div>
      <div className="kcard-deadline">
        {p.priority === 'urgente' && isOpen(p) && <span className="dl-chip tone-bad solid">urgente</span>}
        <span className={`dl-chip tone-${dl.tone}`} title={p.dueDate ? `prazo: ${fmtDate(p.dueDate)}` : undefined}>
          {dl.text}
        </span>
      </div>
      <TaskQuick p={p} compact />
      <div className="kcard-foot">
        <span className="small">{money(projectTotal(p))}</span>
        <PayNext p={p} compact />
      </div>
      <div className="kcard-status" onClick={(e) => e.stopPropagation()}>
        <StatusSelect p={p} />
      </div>
    </div>
  )
}

type SortKey = 'prazo' | 'valor' | 'urgencia' | 'cliente' | 'nome' | 'data'
const SORT_LABEL: Record<SortKey, string> = { urgencia: 'urgência', prazo: 'prazo (mais perto)', data: 'início (mais recente)', nome: 'nome (A–Z)', cliente: 'cliente (A–Z)', valor: 'valor (maior)' }

function ProjectTable({ projects, clientName }: { projects: Project[]; clientName: (id: string) => string }) {
  const [sort, setSort] = useKeep<SortKey>('dem-ordem', 'urgencia')
  const rows = [...projects].sort((a, b) => {
    if (sort === 'prazo') return (a.dueDate || '9').localeCompare(b.dueDate || '9')
    if (sort === 'valor') return projectTotal(b) - projectTotal(a)
    if (sort === 'cliente') return clientName(a.clientId).localeCompare(clientName(b.clientId), 'pt-BR', { sensitivity: 'base' })
    if (sort === 'nome') return a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' })
    if (sort === 'data') return (b.startDate || '').localeCompare(a.startDate || '')
    return urgencyScore(b) - urgencyScore(a)
  })
  const th = (k: SortKey, label: string, cls = '') => (
    <th className={`sortable ${cls} ${sort === k ? 'sorted' : ''}`} onClick={() => setSort(k)}>
      {label}
    </th>
  )
  const { visible, more } = usePaged(rows, 30, 'demandas')
  if (!rows.length) return <Empty title="Nada por aqui" text="Nenhuma demanda com esses filtros." />
  return (
    <>
    <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar por">
      {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
        <option key={k} value={k}>
          ordenar: {SORT_LABEL[k]}
        </option>
      ))}
    </select>
    <div className="table-wrap card">
      <table className="table cards-mobile">
        <thead>
          <tr>
            <th>Projeto</th>
            {th('cliente', 'Cliente', 'hide-mobile')}
            <th>Status</th>
            {th('urgencia', 'Urgência')}
            {th('prazo', 'Prazo')}
            {th('valor', 'Valor', 'num')}
            <th className="num">Em aberto</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => {
            const u = urgency(p)
            return (
              <tr key={p.id} className="clickable" onClick={() => go('projetos', p.id)}>
                <td>
                  <a href={href('projetos', p.id)} className="list-title">
                    {p.title}
                  </a>
                  <div className="list-sub mobile-only">{clientName(p.clientId)}</div>
                </td>
                <td className="hide-mobile">{clientName(p.clientId)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <StatusSelect p={p} />
                </td>
                <td>
                  <Badge color={PRIORITY[u.level].color}>{PRIORITY[u.level].label}</Badge>
                </td>
                <td className={`nowrap ${isLate(p) ? 'text-bad' : ''}`} data-label="prazo">
                  {fmtDate(p.dueDate)}
                  {isOpen(p) && p.dueDate && <div className="small muted">{daysUntil(p.dueDate) === 0 ? 'hoje' : relativeDays(p.dueDate)}</div>}
                </td>
                <td className="num" data-label="valor">{money(projectTotal(p))}</td>
                <td className={`num ${projectOpen(p) > 0 ? 'text-warn' : 'muted'}`} data-label="em aberto">{money(projectOpen(p))}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="muted">
              {rows.length} projeto(s)
            </td>
            <td className="num">
              <b>{money(sum(rows, projectTotal))}</b>
            </td>
            <td className="num">
              <b>{money(sum(rows, projectOpen))}</b>
            </td>
          </tr>
        </tfoot>
      </table>
      {more && <div className="table-more">{more}</div>}
    </div>
    </>
  )
}

/** Arrastar o quadro para os lados com o mouse (no celular o dedo já desliza). */
/** Quadro na largura da página: mostra só colunas inteiras; as demais ficam ao lado para arrastar. */
function useBoardFit() {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const gap = 14
      const fit = Math.max(1, Math.floor((el.clientWidth + gap) / (230 + gap)))
      el.style.setProperty('--cols', String(fit))
      const left = el.scrollLeft > 4
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    // rodinha do mouse anda pelas colunas (sem precisar da seta); dentro de uma coluna comprida, rola a coluna primeiro
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      const body = (e.target as HTMLElement).closest<HTMLElement>('.column-body')
      if (body && body.scrollHeight > body.clientHeight + 2) {
        const canDown = body.scrollTop + body.clientHeight < body.scrollHeight - 1
        const canUp = body.scrollTop > 0
        if ((e.deltaY > 0 && canDown) || (e.deltaY < 0 && canUp)) return
      }
      const max = el.scrollWidth - el.clientWidth
      if (max <= 2) return
      if ((e.deltaY > 0 && el.scrollLeft >= max - 1) || (e.deltaY < 0 && el.scrollLeft <= 0)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', wheel, { passive: false })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      el.removeEventListener('wheel', wheel)
      ro.disconnect()
    }
  })
  const step = (dir: 1 | -1) => {
    const el = ref.current
    const col = el?.querySelector<HTMLElement>('.column')
    if (el && col) el.scrollBy({ left: dir * (col.offsetWidth + 14), behavior: 'smooth' })
  }
  return { ref, edges, step }
}

/** Depois de arrastar, encaixa na coluna mais próxima (nunca fica coluna cortada). */
function snapToColumn(el: HTMLElement) {
  const col = el.querySelector<HTMLElement>('.column')
  if (!col) return
  const w = col.offsetWidth + 14
  el.scrollTo({ left: Math.round(el.scrollLeft / w) * w, behavior: 'smooth' })
}

function useDragScroll() {
  const state = useRef<{ x: number; left: number; el: HTMLElement } | null>(null)
  return {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      // cards, campos e botões mantêm o comportamento normal
      if ((e.target as HTMLElement).closest('.kcard, input, select, button, form, a')) return
      state.current = { x: e.clientX, left: e.currentTarget.scrollLeft, el: e.currentTarget }
      e.currentTarget.classList.add('is-panning')
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = state.current
      if (!s) return
      s.el.scrollLeft = s.left - (e.clientX - s.x)
    },
    onPointerUp: () => {
      const s = state.current
      if (!s) return
      s.el.classList.remove('is-panning')
      snapToColumn(s.el)
      state.current = null
    },
    onPointerLeave: () => {
      const s = state.current
      if (!s) return
      s.el.classList.remove('is-panning')
      snapToColumn(s.el)
      state.current = null
    },
  }
}
