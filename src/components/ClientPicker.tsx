import { useEffect, useMemo, useRef, useState } from 'react'
import type { Client } from '../types'

const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const initial = (name: string) => norm(name.trim()).charAt(0).toUpperCase() || '#'

/** Escolher cliente digitando: a lista vai filtrando, em ordem alfabética, com a letra inicial destacada. */
export function ClientPicker({ id, clients, value, onChange }: { id?: string; clients: Client[]; value: string; onChange: (id: string) => void }) {
  const current = clients.find((c) => c.id === value)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const list = useMemo(
    () =>
      clients
        .filter((c) => !c.archived || c.id === value)
        .filter((c) => !text.trim() || norm(`${c.name} ${c.company ?? ''}`).includes(norm(text.trim())))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [clients, text, value],
  )
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const pick = (c: Client) => {
    onChange(c.id)
    setText('')
    setOpen(false)
  }
  return (
    <div className="cp" ref={box}>
      {current && !open && <span className="cp-letter is-current">{initial(current.name)}</span>}
      <input
        id={id}
        className={`cp-input ${current && !open ? 'has-letter' : ''}`}
        value={open ? text : current ? `${current.name}${current.company ? ` · ${current.company}` : ''}` : text}
        placeholder="Digite o nome do cliente…"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-list` : undefined}
        onFocus={() => {
          setOpen(true)
          setHi(0)
        }}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setHi(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(list.length - 1, h + 1)))
          else if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(0, h - 1)))
          else if (e.key === 'Enter' && open && list[hi]) (e.preventDefault(), pick(list[hi]))
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <ul className="cp-list" id={id ? `${id}-list` : undefined} role="listbox">
          {list.length === 0 && <li className="cp-empty">Nenhum cliente com esse nome. Use o “+” para cadastrar.</li>}
          {list.map((c, i) => {
            const first = i === 0 || initial(list[i - 1].name) !== initial(c.name)
            return (
              <li key={c.id} role="option" aria-selected={c.id === value} className={`cp-item ${i === hi ? 'is-hi' : ''} ${c.id === value ? 'is-on' : ''}`} onMouseDown={(e) => (e.preventDefault(), pick(c))} onMouseEnter={() => setHi(i)}>
                <span className={`cp-letter ${first ? '' : 'is-ghost'}`}>{initial(c.name)}</span>
                <span className="cp-name">
                  {c.name}
                  {c.company && <small> · {c.company}</small>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
