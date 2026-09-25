import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { ClientForm } from '../components/forms'
import { Badge, Empty, Segmented } from '../components/ui'
import { CLIENT_TYPES, isOpen, isStudent, money, projectOpen, projectPaid, sum, whatsappLink } from '../utils'
import type { ClientType } from '../types'

type Profile = 'todos' | 'profissionais' | 'estudantes'
type Sort = 'faturamento' | 'nome' | 'recentes' | 'aberto'

export default function Clients() {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const [profile, setProfile] = useState<Profile>('todos')
  const [type, setType] = useState<ClientType | ''>('')
  const [sort, setSort] = useState<Sort>('faturamento')
  const [archived, setArchived] = useState(false)
  const [form, setForm] = useState(false)

  const rows = useMemo(() => {
    const term = q.toLowerCase()
    return data.clients
      .filter((c) => c.archived === archived)
      .filter((c) => (profile === 'todos' ? true : profile === 'estudantes' ? isStudent(c) : !isStudent(c)))
      .filter((c) => !type || c.type === type)
      .filter((c) => !term || [c.name, c.company, c.city, c.instagram, c.email].some((s) => s.toLowerCase().includes(term)))
      .map((c) => {
        const ps = data.projects.filter((p) => p.clientId === c.id && p.status !== 'cancelado')
        const last = [...ps].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
        return {
          c,
          paid: sum(ps, projectPaid),
          open: sum(ps, projectOpen),
          active: ps.filter(isOpen).length,
          count: ps.length,
          last: last?.startDate ?? c.createdAt,
        }
      })
      .sort((a, b) => {
        if (a.c.favorite !== b.c.favorite) return a.c.favorite ? -1 : 1
        if (sort === 'nome') return a.c.name.localeCompare(b.c.name)
        if (sort === 'recentes') return b.last.localeCompare(a.last)
        if (sort === 'aberto') return b.open - a.open
        return b.paid - a.paid
      })
  }, [data, q, profile, type, sort, archived])

  const total = sum(rows, (r) => r.paid)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{data.clients.filter((c) => !c.archived).length} clientes ativos</p>
          <h1>Clientes</h1>
        </div>
        <button className="btn primary" onClick={() => setForm(true)}>
          <Icon name="plus" size={16} /> Novo cliente
        </button>
      </div>

      <div className="toolbar">
        <div className="search inline">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nome, empresa, cidade…" />
        </div>
        <Segmented<Profile>
          value={profile}
          onChange={setProfile}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'profissionais', label: 'Profissionais' },
            { value: 'estudantes', label: 'Estudantes' },
          ]}
        />
        <select value={type} onChange={(e) => setType(e.target.value as ClientType | '')}>
          <option value="">Todos os tipos</option>
          {Object.entries(CLIENT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="faturamento">Maior faturamento</option>
          <option value="aberto">Mais valor em aberto</option>
          <option value="recentes">Mais recentes</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Arquivados
        </label>
      </div>

      {rows.length === 0 ? (
        <Empty icon="users" title="Nenhum cliente encontrado" action={<button className="btn primary" onClick={() => setForm(true)}>Cadastrar cliente</button>} />
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th className="hide-mobile">Cidade</th>
                <th className="num">Projetos</th>
                <th className="num">Faturado</th>
                <th className="num">Em aberto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, paid, open, active, count }) => (
                <tr key={c.id} onClick={() => go('clientes', c.id)} className="clickable">
                  <td>
                    <div className="client-cell">
                      <span className="avatar">{c.name.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <div className="list-title">
                          {c.favorite && <span className="star">★</span>} {c.name}
                        </div>
                        <div className="list-sub">{c.company || c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge color={isStudent(c) ? '#8b5cf6' : '#4a5a78'}>{CLIENT_TYPES[c.type]}</Badge>
                  </td>
                  <td className="hide-mobile muted">{c.city}</td>
                  <td className="num">
                    {count}
                    {active > 0 && <span className="muted small"> ({active} ativos)</span>}
                  </td>
                  <td className="num">{money(paid)}</td>
                  <td className={`num ${open > 0 ? 'text-warn' : 'muted'}`}>{money(open)}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    {c.phone && (
                      <a className="icon-btn" href={whatsappLink(c.phone)} target="_blank" rel="noreferrer" title="WhatsApp">
                        <Icon name="whatsapp" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="muted">
                  {rows.length} cliente(s)
                </td>
                <td className="num">
                  <b>{money(total)}</b>
                </td>
                <td className="num">
                  <b>{money(sum(rows, (r) => r.open))}</b>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {form && <ClientForm onClose={() => setForm(false)} />}
    </div>
  )
}
