import { useState } from 'react'
import { useStore } from '../store'
import { Modal } from './ui'
import { Icon } from './Icon'
import { toast } from './dialog'
import { mergeClients, similarName } from '../mergeClients'
import type { Client } from '../types'

/** Junta dois cadastros da mesma pessoa: orçamentos, demandas e anotações vão para um só. */
export function MergeClients({ keep, other, onClose, onDone }: { keep: Client; other?: Client; onClose: () => void; onDone?: (id: string) => void }) {
  const { data, replaceAll } = useStore()
  const [otherId, setOtherId] = useState(other?.id ?? '')
  const b = data.clients.find((c) => c.id === otherId)
  const [name, setName] = useState(keep.name)
  const count = (c: Client) => ({
    quotes: data.quotes.filter((q) => q.clientId === c.id).length,
    projects: data.projects.filter((p) => p.clientId === c.id).length,
  })
  const candidates = data.clients
    .filter((c) => c.id !== keep.id)
    .sort((x, y) => Number(similarName(y.name, keep.name)) - Number(similarName(x.name, keep.name)) || x.name.localeCompare(y.name))
  const names = b ? [...new Set([keep.name, b.name])] : [keep.name]
  const moving = b ? count(b) : { quotes: 0, projects: 0 }

  const confirm = () => {
    if (!b) return toast('Escolha o outro cadastro.')
    replaceAll(mergeClients(data, keep.id, b.id, name))
    toast(`Pronto: tudo de “${b.name}” agora está em “${name}”.`)
    onClose()
    onDone?.(keep.id)
  }

  return (
    <Modal
      title="Juntar cadastros"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={!b} onClick={confirm}>
            <Icon name="check" size={15} /> Juntar
          </button>
        </>
      }
    >
      <div className="stack">
        <p className="muted small">Para quando a mesma pessoa foi cadastrada duas vezes (ex.: com o nome escrito diferente).</p>
        {!other && (
          <label className="field">
            <span className="field-label">Juntar “{keep.name}” com</span>
            <select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
              <option value="">Escolha o outro cadastro…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` · ${c.company}` : ''}
                  {similarName(c.name, keep.name) ? ' (parecido)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {b && (
          <>
            <div className="field">
              <span className="field-label">Nome que fica</span>
              <div className="merge-names">
                {names.map((n) => (
                  <label key={n} className={`merge-name ${name === n ? 'is-on' : ''}`}>
                    <input type="radio" name="merge-name" checked={name === n} onChange={() => setName(n)} /> {n}
                  </label>
                ))}
              </div>
            </div>
            <p className="merge-summary">
              {moving.quotes} orçamento(s) e {moving.projects} demanda(s) de <b>{b.name}</b>
              {b.company ? ` (${b.company})` : ''} passam para <b>{name}</b>
              {keep.company ? ` · ${keep.company}` : b.company ? ` · ${b.company}` : ''}. Telefone, e-mail e anotações que faltarem são completados, e o cadastro repetido some.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
