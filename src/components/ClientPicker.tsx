import { useEffect, useMemo, useRef, useState } from 'react'
import type { Client } from '../types'
import { CLIENT_TYPES, fold, matches } from '../utils'

/* Escolher cliente digitando: vai aparecendo quem já está cadastrado (sem acento, em qualquer ordem),
   com a inicial colorida. Setas + Enter funcionam; no fim da lista, "cadastrar" com o nome digitado. */

const TONES = ['#b7837a', '#7d9a87', '#8a8fb5', '#c29a5b', '#6f9bb0', '#a98bb0', '#b0876f', '#7a9e9a']
export const clientTone = (name: string) => TONES[[...fold(name)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % TONES.length]
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÀ-Ú]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?'

export function ClientAvatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span className="cp-avatar" style={{ background: clientTone(name), width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
      {initials(name)}
    </span>
  )
}

export function ClientPicker({ id, clients, value, onChange, onCreate, placeholder = 'digite o nome do cliente…' }: { id?: string; clients: Client[]; value: string; onChange: (id: string) => void; onCreate?: (name: string) => void; placeholder?: string }) {
  const chosen = clients.find((c) => c.id === value)
  const [text, setText] = useState(chosen?.name ?? '')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) setText(chosen?.name ?? '')
  }, [chosen?.name, open])
  useEffect(() => {
    const out = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [])
  const typing = open && text !== (chosen?.name ?? '')
  const list = useMemo(
    () =>
      clients
        .filter((c) => !c.archived)
        .filter((c) => !typing || matches(text, c.name, c.company, c.email, c.phone))
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name))
        .slice(0, 40),
    [clients, text, typing],
  )
  const canCreate = !!onCreate && typing && text.trim().length > 1 && !clients.some((c) => fold(c.name) === fold(text.trim()))
  const total = list.length + (canCreate ? 1 : 0)
  const pick = (c: Client) => {
    onChange(c.id)
    setText(c.name)
    setOpen(false)
  }
  const create = () => {
    onCreate?.(text.trim())
    setOpen(false)
  }
  return (
    <div className="cpk" ref={box}>
      <div className={`cp-field ${chosen ? 'has-client' : ''}`}>
        {chosen && !typing && <ClientAvatar name={chosen.name} size={24} />}
        <input
          id={id}
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={(e) => (setOpen(true), setHi(0), e.target.select())}
          onChange={(e) => (setText(e.target.value), setOpen(true), setHi(0))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setOpen(true), setHi((h) => Math.min(total - 1, h + 1)))
            else if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(0, h - 1)))
            else if (e.key === 'Enter' && open) {
              e.preventDefault()
              if (hi < list.length && list[hi]) pick(list[hi])
              else if (canCreate) create()
            } else if (e.key === 'Escape') setOpen(false)
          }}
        />
        {chosen && !typing && <span className="cp-type">{CLIENT_TYPES[chosen.type]}</span>}
      </div>
      {open && total > 0 && (
        <ul className="cp-list" role="listbox">
          {list.map((c, i) => (
            <li key={c.id} role="option" aria-selected={c.id === value} className={`${i === hi ? 'is-hi' : ''} ${c.id === value ? 'is-on' : ''}`} onMouseDown={(e) => (e.preventDefault(), pick(c))} onMouseEnter={() => setHi(i)}>
              <ClientAvatar name={c.name} />
              <span className="cp-name">
                <b>{c.name}</b>
                <small>{[CLIENT_TYPES[c.type], c.company].filter(Boolean).join(' · ')}</small>
              </span>
              {c.favorite && <span className="cp-star">★</span>}
            </li>
          ))}
          {canCreate && (
            <li role="option" aria-selected={false} className={`cp-new ${hi === list.length ? 'is-hi' : ''}`} onMouseDown={(e) => (e.preventDefault(), create())} onMouseEnter={() => setHi(list.length)}>
              <span className="cp-avatar cp-plus">+</span>
              <span className="cp-name">
                <b>cadastrar “{text.trim()}”</b>
                <small>novo cliente</small>
              </span>
            </li>
          )}
        </ul>
      )}
      {open && total === 0 && <p className="cp-empty">Nenhum cliente com esse nome.</p>}
    </div>
  )
}
