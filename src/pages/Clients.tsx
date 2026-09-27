import { useMemo, useState } from 'react'
import { useKeep } from '../keep'
import { useStore } from '../store'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { ClientForm } from '../components/forms'
import { Badge, Empty, Segmented, usePaged } from '../components/ui'
import { CLIENT_COLORS, CLIENT_TYPES, daysUntil, relativeDays, isOpen, isStudent, money, projectOpen, projectPaid, sum, whatsappLink, matches } from '../utils'
import type { Client, ClientType } from '../types'
import { MergeClients } from '../components/MergeClients'
import { duplicatePairs } from '../mergeClients'

type Profile = 'todos' | 'profissionais' | 'estudantes'
type Sort = 'faturamento' | 'nome' | 'recentes' | 'aberto'

export default function Clients() {
  const { data, setSettings } = useStore()
  const [q, setQ] = useKeep('cli-busca', '')
  const [profile, setProfile] = useKeep<Profile>('cli-perfil', 'todos')
  const [type, setType] = useKeep<ClientType | ''>('cli-tipo', '')
  const [sort, setSort] = useKeep<Sort>('cli-ordem', 'faturamento')
  const [archived, setArchived] = useKeep('cli-arquivados', false)
  const [form, setForm] = useState(false)
  const [merging, setMerging] = useState<[Client, Client] | null>(null)
  const pairKey = (a: Client, b: Client) => [a.id, b.id].sort().join('|')
  const dupes = useMemo(() => duplicatePairs(data.clients).filter(([a, b]) => !(data.settings.notDuplicates ?? []).includes(pairKey(a, b))), [data.clients, data.settings.notDuplicates])
  // fica o cadastro com mais histórico (orçamentos + demandas)
  const weight = (c: Client) => data.quotes.filter((x) => x.clientId === c.id).length + data.projects.filter((x) => x.clientId === c.id).length * 2 + (c.company ? 1 : 0)

  const rows = useMemo(() => {
    const term = q.toLowerCase()
    return data.clients
      .filter((c) => c.archived === archived)
      .filter((c) => (profile === 'todos' ? true : profile === 'estudantes' ? isStudent(c) : !isStudent(c)))
      .filter((c) => !type || c.type === type)
      .filter((c) => matches(term, c.name, c.company, c.city, c.instagram, c.email, c.phone))
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
  const { visible, more } = usePaged(rows, 30, 'clientes')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{data.clients.filter((c) => !c.archived).length} clientes ativos</p>
          <h1>
            meus <em>clientes</em>
          </h1>
        </div>
        <button className="btn primary" onClick={() => setForm(true)}>
          <Icon name="plus" size={16} /> Novo cliente
        </button>
      </div>

      {dupes.slice(0, 3).map(([a, b]) => (
        <div key={pairKey(a, b)} className="dupe-note">
          <Icon name="users" size={16} />
          <span>
            <b>{a.name}</b> e <b>{b.name}</b> parecem a mesma pessoa.
          </span>
          <button className="btn small primary" onClick={() => setMerging(weight(a) >= weight(b) ? [a, b] : [b, a])}>
            juntar
          </button>
          <button className="link small muted-link" onClick={() => setSettings({ notDuplicates: [...(data.settings.notDuplicates ?? []), pairKey(a, b)] })}>
            são pessoas diferentes
          </button>
        </div>
      ))}

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
          <table className="table cards-mobile">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th className="hide-mobile">Último projeto</th>
                <th className="num">Projetos</th>
                <th className="num">Faturado</th>
                <th className="num">Em aberto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ c, paid, open, active, count, last }) => (
                <tr key={c.id} onClick={() => go('clientes', c.id)} className="clickable">
                  <td>
                    <div className="client-cell">
                      <span className="avatar" style={{ background: `${CLIENT_COLORS[c.type]}1f`, color: CLIENT_COLORS[c.type] }}>{c.name.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <div className="list-title">
                          {c.favorite && <span className="star">★</span>} {c.name}
                        </div>
                        <div className="list-sub">{c.company || c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge color={CLIENT_COLORS[c.type]}>{CLIENT_TYPES[c.type]}</Badge>
                  </td>
                  <td className="hide-mobile">
                    {count ? (
                      <span className={active ? '' : -daysUntil(last) > 90 ? 'text-warn' : 'muted'}>{active ? 'em andamento' : relativeDays(last)}</span>
                    ) : (
                      <span className="muted">nenhum ainda</span>
                    )}
                  </td>
                  <td className="num" data-label="projetos">
                    <span className="proj-count" title={active ? `${active} em andamento` : undefined}>
                      {count}
                      {active > 0 && <i className="proj-active" aria-label={`${active} em andamento`} />}
                    </span>
                  </td>
                  <td className="num" data-label="faturado">{money(paid)}</td>
                  <td className={`num ${open > 0 ? 'text-warn' : 'muted'}`} data-label="em aberto">{money(open)}</td>
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
          {more && <div className="table-more">{more}</div>}
        </div>
      )}

      {merging && <MergeClients keep={merging[0]} other={merging[1]} onClose={() => setMerging(null)} />}
      {form && <ClientForm onClose={() => setForm(false)} />}
    </div>
  )
}
