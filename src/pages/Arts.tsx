import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { Badge, Empty, Field, KeepRS, Modal, MoneyInput, Section, Segmented } from '../components/ui'
import { DateInput } from '../components/DateInput'
import { askDelete, toast } from '../components/dialog'
import { DraftNote, useFormDraft } from '../components/SaveBar'
import { PAL } from '../palette'
import { money, today, uid } from '../utils'
import type { ArtRecord, ArtStatus } from '../types'

/* ARTs e RRTs: cada registro de responsabilidade técnica, com cliente, imóvel, taxa e situação.
   Serve para saber o que falta emitir, o que falta pagar no CREA/CAU e quanto foi gasto em taxas. */

const STATUS: ArtStatus[] = ['a emitir', 'emitida', 'paga', 'baixada']
const STATUS_TEXT: Record<ArtStatus, string> = {
  'a emitir': 'serviço fechado, registro ainda não feito',
  emitida: 'registrada, boleto em aberto',
  paga: 'taxa paga, serviço em andamento',
  baixada: 'serviço concluído e registro baixado',
}
const STATUS_COLOR: Record<ArtStatus, string> = { 'a emitir': PAL.bad, emitida: PAL.warn, paga: PAL.good, baixada: PAL.mist }
const SERVICES = ['vistoria de entrega de chaves', 'revistoria', 'reforma', 'execução de obra', 'projeto', 'laudo técnico']
// taxa da ART de obra/serviço no CREA-SP em 2026 (contrato até R$ 15 mil): ponto de partida, editável
const DEFAULT_FEE = 108.39

export function newArt(p: Partial<ArtRecord> = {}): ArtRecord {
  return { id: uid(), kind: 'ART', number: '', service: SERVICES[0], place: '', contractValue: 0, fee: DEFAULT_FEE, status: 'a emitir', issuedAt: today(), notes: '', createdAt: new Date().toISOString(), ...p }
}

export default function Arts() {
  const { data } = useStore()
  const arts = data.arts ?? []
  const [filter, setFilter] = useState<'todas' | ArtStatus>('todas')
  const [editing, setEditing] = useState<ArtRecord | 'nova' | null>(null)
  const clientName = (a: ArtRecord) => data.clients.find((c) => c.id === a.clientId)?.name || a.clientName || 'sem cliente'

  const rows = useMemo(() => [...arts].filter((a) => filter === 'todas' || a.status === filter).sort((a, b) => STATUS.indexOf(a.status) - STATUS.indexOf(b.status) || b.issuedAt.localeCompare(a.issuedAt)), [arts, filter])
  const count = (s: ArtStatus) => arts.filter((a) => a.status === s).length
  const year = today().slice(0, 4)
  const feesYear = arts.filter((a) => a.issuedAt.startsWith(year) && a.status !== 'a emitir').reduce((n, a) => n + (a.fee || 0), 0)
  const toPay = arts.filter((a) => a.status === 'emitida').reduce((n, a) => n + (a.fee || 0), 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">RDL Engenharia · CREA-SP</p>
          <h1>
            ARTs <em>da RDL</em>
          </h1>
        </div>
        <div className="row gap-s wrap head-acts">
          <button className="btn primary" onClick={() => setEditing('nova')}>
            <Icon name="plus" size={16} /> <KeepRS text="nova ART" />
          </button>
        </div>
      </div>

      {arts.length > 0 && (
        <div className="art-stats">
          <div className="card art-stat">
            <small className="muted">a emitir</small>
            <b>{count('a emitir')}</b>
          </div>
          <div className="card art-stat">
            <small className="muted">boletos em aberto</small>
            <b>{money(toPay)}</b>
          </div>
          <div className="card art-stat">
            <small className="muted">taxas pagas em {year}</small>
            <b>{money(feesYear)}</b>
          </div>
        </div>
      )}

      {arts.length > 0 && (
        <div className="toolbar">
          <Segmented<'todas' | ArtStatus> value={filter} onChange={setFilter} options={[{ value: 'todas', label: `todas (${arts.length})` }, ...STATUS.map((s) => ({ value: s, label: `${s} (${count(s)})` }))]} />
        </div>
      )}

      {rows.length === 0 ? (
        <Empty
          icon="hardhat"
          title={arts.length ? 'nenhum registro nesta situação' : 'nenhum registro ainda'}
          text="Registre cada ART: cliente, imóvel, número, taxa e situação. Assim você sabe o que falta emitir, o que falta pagar e quanto gastou em taxas no ano."
          action={!arts.length && <button className="btn primary" onClick={() => setEditing('nova')}>registrar a primeira</button>}
        />
      ) : (
        <div className="table-wrap card">
          <table className="table cards-mobile">
            <thead>
              <tr>
                <th>cliente e imóvel</th>
                <th>serviço</th>
                <th className="hide-mobile">número</th>
                <th className="num">taxa</th>
                <th>situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="clickable" onClick={() => setEditing(a)}>
                  <td>
                    <div className="list-title">{clientName(a)}</div>
                    <div className="list-sub">{a.place || 'imóvel não informado'}</div>
                  </td>
                  <td data-label="serviço">
                    <KeepRS text={a.service} />
                  </td>
                  <td className="hide-mobile">{a.number || <span className="muted">a preencher</span>}</td>
                  <td className="num" data-label="taxa">
                    {money(a.fee)}
                  </td>
                  <td data-label="situação">
                    <Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {arts.length > 0 && (
        <Section title="o que cada situação quer dizer">
          <ul className="art-legend">
            {STATUS.map((s) => (
              <li key={s}>
                <Badge color={STATUS_COLOR[s]}>{s}</Badge> <span className="muted small">{STATUS_TEXT[s]}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {editing && <ArtForm initial={editing === 'nova' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ArtForm({ initial, onClose }: { initial?: ArtRecord; onClose: () => void }) {
  const { data, upsert, remove } = useStore()
  const draft = useFormDraft<ArtRecord>(`art:${initial?.id ?? 'nova'}`, initial ?? newArt())
  const a = draft.value
  const set = <K extends keyof ArtRecord>(k: K, v: ArtRecord[K]) => draft.setValue((x) => ({ ...x, [k]: v }))
  const clients = data.clients.filter((c) => !c.archived).sort((x, y) => x.name.localeCompare(y.name))
  const save = () => {
    if (!a.clientId && !a.clientName?.trim()) return toast('Escolha o cliente ou escreva o nome.')
    if (!a.service.trim()) return toast('Diga qual é o serviço.')
    upsert('arts', a)
    draft.clear()
    onClose()
  }
  return (
    <Modal
      title={initial ? 'editar ART' : 'nova ART'}
      onClose={draft.guardClose(onClose, () => void save())}
      footer={
        <>
          {initial && (
            <button
              className="icon-btn danger-text"
              title="Excluir ART"
              aria-label="Excluir ART"
              onClick={async () => {
                if (await askDelete('este registro')) {
                  draft.clear()
                  remove('arts', initial.id)
                  onClose()
                }
              }}
            >
              <Icon name="trash" size={16} />
            </button>
          )}
          <span className="spacer" />
          <button className="btn ghost" onClick={() => (draft.clear(), onClose())}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save}>
            Salvar
          </button>
        </>
      }
    >
      <DraftNote d={draft} />
      <div className="form-grid">
        <Field label="Situação">
          <select value={a.status} onChange={(e) => set('status', e.target.value as ArtStatus)}>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Número do registro">
          <input value={a.number} onChange={(e) => set('number', e.target.value)} placeholder="preencha quando emitir" />
        </Field>
        <Field label="Cliente *" span={2}>
          <select value={a.clientId ?? ''} onChange={(e) => set('clientId', e.target.value || undefined)}>
            <option value="">não está cadastrado (escrever o nome)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {!a.clientId && (
          <Field label="Nome do cliente">
            <input value={a.clientName ?? ''} onChange={(e) => set('clientName', e.target.value)} />
          </Field>
        )}
        <Field label="Serviço *" span={a.clientId ? 1 : 2}>
          <input list="art-servicos" value={a.service} onChange={(e) => set('service', e.target.value)} />
          <datalist id="art-servicos">
            {SERVICES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Imóvel (endereço, torre e apto)" span={2}>
          <input value={a.place} onChange={(e) => set('place', e.target.value)} placeholder="Ex.: San Levi · torre 2 · apto 1204" />
        </Field>
        <Field label="Valor do contrato">
          <MoneyInput value={a.contractValue} onChange={(n) => set('contractValue', n)} />
        </Field>
        <Field label="Taxa do CREA/CAU" hint="CREA-SP 2026: R$ 108,39 para contratos até R$ 15 mil">
          <MoneyInput value={a.fee} onChange={(n) => set('fee', n)} />
        </Field>
        <Field label="Emissão">
          <DateInput value={a.issuedAt} onChange={(e) => set('issuedAt', e.target.value)} />
        </Field>
        <Field label="Vencimento do boleto">
          <DateInput value={a.dueAt ?? ''} onChange={(e) => set('dueAt', e.target.value || undefined)} />
        </Field>
        <Field label="Observações" span={3}>
          <input value={a.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ex.: inclui até 1 revistoria dos itens do laudo" />
        </Field>
      </div>
    </Modal>
  )
}
