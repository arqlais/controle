import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

let openModals = 0

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    openModals++
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      if (--openModals === 0) document.body.classList.remove('modal-open')
    }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint, span }: { label: string; children: ReactNode; hint?: string; span?: 1 | 2 | 3 }) {
  return (
    <label className={`field ${span ? `span-${span}` : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Badge({ color, children, solid }: { color: string; children: ReactNode; solid?: boolean }) {
  return (
    <span
      className="badge"
      style={solid ? { background: color, color: '#fff', borderColor: color } : { color, borderColor: `${color}55`, background: `${color}12` }}
    >
      {children}
    </span>
  )
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone,
  onClick,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: string
  tone?: 'good' | 'bad' | 'warn'
  onClick?: () => void
}) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <Icon name={icon} size={16} />}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Progress({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="progress">
      <div className="progress-bar" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Empty({ icon = 'box', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={32} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Section({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <h3>{title}</h3>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MoneyInput({ value, onChange, ...rest }: { value: number; onChange: (n: number) => void; placeholder?: string }) {
  return (
    <div className="money-input">
      <span>R$</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        {...rest}
      />
    </div>
  )
}


/** Mostra listas longas aos poucos (evita telas gigantes com muitos clientes). */
export function usePaged<T>(items: T[], size = 30) {
  const [limit, setLimit] = useState(size)
  const visible = items.slice(0, limit)
  const rest = items.length - visible.length
  const more =
    rest > 0 ? (
      <button className="btn ghost small show-more" onClick={() => setLimit((l) => l + size)}>
        mostrar mais {Math.min(rest, size)} de {rest}
      </button>
    ) : null
  return { visible, more }
}
