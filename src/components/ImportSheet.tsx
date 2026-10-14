import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { CLIENT_TYPES, defaultClientType, fmtDate, money } from '../utils'
import type { ClientType } from '../types'
import { FIELDS, buildImport, guessMapping, parseDelimited, readSheetFile, toSheet, type FieldId, type Sheet } from '../importSheet'
import { Modal } from './ui'
import { Icon } from './Icon'
import { toast } from './dialog'

/* Importar clientes (e projetos) de planilha: escolher o arquivo ou colar, conferir as colunas, importar. */

const HOW: { name: string; text: string }[] = [
  { name: 'Excel', text: 'use o próprio arquivo .xlsx (a primeira aba).' },
  { name: 'Google Planilhas', text: 'Arquivo → Fazer download → .xlsx ou .csv. Ou selecione as células e cole aqui.' },
  { name: 'Notion', text: 'na tabela: ⋯ → Exportar → Markdown e CSV.' },
  { name: 'Trello', text: 'no quadro: ⋯ → Imprimir, exportar e compartilhar → Exportar como JSON. Cada cartão vira um projeto.' },
]

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { data, upsert } = useStore()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [map, setMap] = useState<FieldId[]>([])
  const [paste, setPaste] = useState('')
  const [type, setType] = useState<ClientType>(defaultClientType(data.settings.workProfile))
  const [withProjects, setWithProjects] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = (s: Sheet) => {
    if (!s.rows.length) return toast('Não encontrei linhas nesse arquivo.')
    setSheet(s)
    setMap(guessMapping(s.headers))
  }
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      load(await readSheetFile(f))
    } catch (e) {
      toast(e instanceof Error && e.message === 'formato' ? 'Esse formato não dá para ler. Salve como .xlsx ou .csv e tente de novo.' : 'Não consegui ler esse arquivo. Tente salvar como .csv.')
    } finally {
      setBusy(false)
    }
  }
  const plan = useMemo(() => (sheet ? buildImport(sheet, map, data, type, withProjects) : null), [sheet, map, data, type, withProjects])
  const hasProjectCol = map.includes('projeto')
  const hasName = map.includes('nome')

  const run = () => {
    if (!plan) return
    for (const c of plan.newClients) upsert('clients', c)
    if (withProjects) for (const p of plan.projects) upsert('projects', p)
    toast(`Importado: ${plan.newClients.length} cliente(s) novo(s)${withProjects && plan.projects.length ? ` e ${plan.projects.length} projeto(s)` : ''}.`)
    onClose()
  }

  if (!sheet)
    return (
      <Modal title="importar de planilha" onClose={onClose}>
        <div className="imp">
          <p className="muted small">Traga seus clientes e projetos de onde estão hoje. Nada é apagado: quem já existe aqui é reaproveitado.</p>
          <label className={`imp-drop ${busy ? 'is-busy' : ''}`}>
            <Icon name="download" size={22} />
            <b>{busy ? 'lendo…' : 'escolher arquivo'}</b>
            <small>.xlsx, .csv ou .json do Trello</small>
            <input type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.json,text/csv,application/json" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          <details className="imp-paste">
            <summary>ou cole as células da planilha</summary>
            <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Selecione as linhas na planilha (com o título das colunas), copie e cole aqui.'} />
            <button className="btn primary" disabled={!paste.trim()} onClick={() => load(toSheet(parseDelimited(paste), 'planilha colada'))}>
              continuar
            </button>
          </details>
          <div className="imp-how">
            {HOW.map((h) => (
              <p key={h.name}>
                <b>{h.name}:</b> {h.text}
              </p>
            ))}
          </div>
        </div>
      </Modal>
    )

  const sample = sheet.rows.slice(0, 3)
  return (
    <Modal
      wide
      title={`importar de ${sheet.source}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={() => setSheet(null)}>
            voltar
          </button>
          <button className="btn primary" disabled={!plan || (!plan.newClients.length && !(withProjects && plan.projects.length))} onClick={run}>
            <Icon name="check" size={15} /> importar
          </button>
        </>
      }
    >
      <div className="imp">
        <p className="muted small">
          {sheet.rows.length} linha(s). Confira o que é cada coluna: o sistema adivinhou pelo título, mas dá para mudar.
        </p>
        <div className="imp-cols">
          {sheet.headers.map((h, i) => (
            <div key={i} className={`imp-col ${map[i] ? 'is-on' : ''}`}>
              <span className="imp-col-h">{h}</span>
              <small className="imp-col-s">{sample.map((r) => r[i]).filter(Boolean).slice(0, 2).join(' · ') || '—'}</small>
              <select value={map[i] ?? ''} onChange={(e) => setMap((m) => m.map((x, j) => (j === i ? (e.target.value as FieldId) : x === e.target.value && e.target.value ? '' : x)))}>
                {FIELDS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.group ? `${f.group}: ${f.label}` : f.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="imp-opts">
          <label className="imp-opt">
            <span>tipo dos clientes novos</span>
            <select value={type} onChange={(e) => setType(e.target.value as ClientType)}>
              {(Object.entries(CLIENT_TYPES) as [ClientType, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {hasProjectCol && (
            <label className="check">
              <input type="checkbox" checked={withProjects} onChange={(e) => setWithProjects(e.target.checked)} />
              <span>criar também os projetos (com valor, prazo, etapa e o que já foi pago)</span>
            </label>
          )}
        </div>
        {!hasName && !hasProjectCol && <p className="pf-note is-warn">Escolha qual coluna é o nome do cliente (ou o nome do projeto).</p>}
        {plan && (
          <div className="imp-sum">
            <p>
              <b>{plan.newClients.length}</b> cliente(s) novo(s)
              {plan.reused ? (
                <>
                  {' '}
                  · <b>{plan.reused}</b> já estava(m) aqui
                </>
              ) : null}
              {withProjects && hasProjectCol ? (
                <>
                  {' '}
                  · <b>{plan.projects.length}</b> projeto(s)
                </>
              ) : null}
              {plan.skipped ? <span className="muted"> · {plan.skipped} linha(s) vazia(s) pulada(s)</span> : null}
            </p>
            <ul className="imp-list">
              {plan.newClients.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <Icon name="users" size={14} />
                  <span className="grow">
                    <b>{c.name}</b>
                    <small>{[CLIENT_TYPES[c.type], c.phone, c.email, c.city].filter(Boolean).join(' · ')}</small>
                  </span>
                </li>
              ))}
              {withProjects &&
                plan.projects.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Icon name="layers" size={14} />
                    <span className="grow">
                      <b>{p.title}</b>
                      <small>{[data.clients.find((c) => c.id === p.clientId)?.name ?? plan.newClients.find((c) => c.id === p.clientId)?.name, p.value ? money(p.value) : '', p.dueDate ? `prazo ${fmtDate(p.dueDate)}` : ''].filter(Boolean).join(' · ')}</small>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
