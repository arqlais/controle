import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { go, href } from '../router'
import { askDelete } from '../components/dialog'
import { PayNext, StatusSelect } from '../components/quick'
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
  fmtDate,
  isLate,
  isOpen,
  money,
  projectOpen,
  projectTotal,
  relativeDays,
  sum,
  today,
  urgency,
  urgencyScore,
} from '../utils'

type View = 'quadro' | 'lista'
type Scope = 'ativos' | 'todos' | 'atrasados' | 'arquivo'

export default function Projects() {
  const { data, upsert, setSettings, replaceAll } = useStore()
  const custom = data.settings.customColumns
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
  const [q, setQ] = useState('')
  const [clientId, setClientId] = useState('')
  const [prio, setPrio] = useState<Priority | ''>('')
  const [scope, setScope] = useState<Scope>('ativos')
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
      .filter((p) => !term || p.title.toLowerCase().includes(term) || clientName(p.clientId).toLowerCase().includes(term))
  }, [data, q, clientId, prio])

  const move = (p: Project, status: ProjectStatus) => {
    if (p.status === status) return
    upsert('projects', { ...p, status, deliveredDate: status === 'entregue' ? p.deliveredDate ?? today() : null })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {data.projects.filter(isOpen).length} ativas · {money(sum(data.projects.filter(isOpen), projectTotal))} em produção
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
      </div>

      {data.projects.length === 0 ? (
        <Empty icon="folder" title="Nenhuma demanda ainda" text="Cadastre seu primeiro projeto para acompanhar prazos e pagamentos." action={<button className="btn primary" onClick={() => setForm(true)}>Nova demanda</button>} />
      ) : view === 'quadro' ? (
        <div className="board">
          {boardColumns().map((col) => {
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
  const u = urgency(p)
  const done = p.tasks.filter((t) => t.done).length
  return (
    <div className="kcard" draggable onDragStart={onDragStart} onClick={() => go('projetos', p.id)}>
      <div className="kcard-top">
        <Badge color={PRIORITY[u.level].color}>{u.reason || PRIORITY[u.level].label}</Badge>
        {p.dueDate && <span className={`small ${isLate(p) ? 'text-bad' : 'muted'}`}>{fmtDate(p.dueDate)}</span>}
      </div>
      <div className="kcard-title">{p.title}</div>
      <div className="muted small">{client}</div>
      {p.tasks.length > 0 && (
        <div className="kcard-progress">
          <div className="progress thin">
            <div className="progress-bar" style={{ width: `${(done / p.tasks.length) * 100}%` }} />
          </div>
          <span className="small muted">
            {done}/{p.tasks.length}
          </span>
        </div>
      )}
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

type SortKey = 'prazo' | 'valor' | 'urgencia' | 'cliente'

function ProjectTable({ projects, clientName }: { projects: Project[]; clientName: (id: string) => string }) {
  const [sort, setSort] = useState<SortKey>('urgencia')
  const rows = [...projects].sort((a, b) => {
    if (sort === 'prazo') return (a.dueDate || '9').localeCompare(b.dueDate || '9')
    if (sort === 'valor') return projectTotal(b) - projectTotal(a)
    if (sort === 'cliente') return clientName(a.clientId).localeCompare(clientName(b.clientId))
    return urgencyScore(b) - urgencyScore(a)
  })
  const th = (k: SortKey, label: string, cls = '') => (
    <th className={`sortable ${cls} ${sort === k ? 'sorted' : ''}`} onClick={() => setSort(k)}>
      {label}
    </th>
  )
  const { visible, more } = usePaged(rows)
  if (!rows.length) return <Empty title="Nada por aqui" text="Nenhuma demanda com esses filtros." />
  return (
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
                </td>
                <td className="hide-mobile">{clientName(p.clientId)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <StatusSelect p={p} />
                </td>
                <td>
                  <Badge color={PRIORITY[u.level].color}>{PRIORITY[u.level].label}</Badge>
                </td>
                <td className={`nowrap ${isLate(p) ? 'text-bad' : ''}`}>
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
  )
}
