import { formatDoc, formatPhone } from '../utils'
import type { PixType } from '../types'

/* Chave Pix: a pessoa escolhe o tipo (celular, CPF, CNPJ, e-mail ou aleatória)
   e a chave já sai com a pontuação certa enquanto digita. */

export const PIX_TYPES: { id: PixType; label: string; placeholder: string }[] = [
  { id: 'celular', label: 'celular', placeholder: '(11) 91234-5678' },
  { id: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
  { id: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00' },
  { id: 'email', label: 'e-mail', placeholder: 'voce@email.com' },
  { id: 'aleatoria', label: 'aleatória', placeholder: '1a2b3c4d-…' },
]

/** Descobre o tipo de uma chave já salva (contas antigas). */
export function guessPixType(key: string): PixType {
  const k = key.trim()
  if (!k) return 'celular'
  if (k.includes('@')) return 'email'
  if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(k)) return 'aleatoria'
  const d = k.replace(/\D/g, '')
  if (/[./]/.test(k) && d.length === 14) return 'cnpj'
  if (/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(k)) return 'cpf'
  if (d.length === 14) return 'cnpj'
  return 'celular'
}

export function formatPix(type: PixType, v: string) {
  if (type === 'cpf') return formatDoc(v.replace(/\D/g, '').slice(0, 11))
  if (type === 'cnpj') return formatDoc(v.replace(/\D/g, '').slice(0, 14))
  if (type === 'celular') return formatPhone(v)
  if (type === 'email') return v.trim().toLowerCase()
  // aleatória: 32 letras/números em grupos 8-4-4-4-12
  const h = v.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 32)
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].filter(Boolean).join('-')
}

export function pixValid(type: PixType, v: string) {
  const d = v.replace(/\D/g, '')
  if (type === 'cpf') return d.length === 11
  if (type === 'cnpj') return d.length === 14
  if (type === 'celular') return d.length >= 10
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
}

export function PixKeyInput({ value, type, onChange }: { value: string; type?: PixType; onChange: (v: { pixKey: string; pixType: PixType }) => void }) {
  const t = type ?? guessPixType(value)
  const cur = PIX_TYPES.find((x) => x.id === t)!
  const ok = value.trim() ? pixValid(t, value) : null
  return (
    <div className="pix-input">
      <div className="pix-types" role="radiogroup" aria-label="Tipo de chave Pix">
        {PIX_TYPES.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={t === x.id} className={`chip ${t === x.id ? 'active' : ''}`} onClick={() => onChange({ pixType: x.id, pixKey: formatPix(x.id, value) })}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="pix-field">
        <input
          value={value}
          inputMode={t === 'email' || t === 'aleatoria' ? 'text' : 'numeric'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={cur.placeholder}
          aria-label={`Chave Pix (${cur.label})`}
          onChange={(e) => onChange({ pixType: t, pixKey: formatPix(t, e.target.value) })}
        />
        {ok !== null && <span className={`pix-ok ${ok ? 'is-ok' : 'is-bad'}`}>{ok ? '✓ chave completa' : 'confira a chave'}</span>}
      </div>
    </div>
  )
}
