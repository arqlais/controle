import { useEffect, useState } from 'react'

/* Confirmações e avisos dentro da página (substituem confirm()/alert(),
   que ficam bloqueados em alguns ambientes, como o visualizador de Artifacts). */

interface Ask {
  message: string
  confirmLabel: string
  danger: boolean
  resolve: (ok: boolean) => void
}

let pushAsk: ((a: Ask) => void) | null = null
let pushToast: ((msg: string) => void) | null = null

export function ask(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}) {
  return new Promise<boolean>((resolve) => {
    if (!pushAsk) return resolve(false)
    pushAsk({ message, confirmLabel: opts.confirmLabel ?? 'Confirmar', danger: opts.danger ?? false, resolve })
  })
}

export const askDelete = (what: string) => ask(`Excluir ${what}? Essa ação não pode ser desfeita.`, { confirmLabel: 'Excluir', danger: true })

export function toast(message: string) {
  pushToast?.(message)
}

export function DialogHost() {
  const [queue, setQueue] = useState<Ask[]>([])
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([])

  useEffect(() => {
    pushAsk = (a) => setQueue((q) => [...q, a])
    pushToast = (message) => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t, { id, message }])
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
    }
    return () => {
      pushAsk = null
      pushToast = null
    }
  }, [])

  const current = queue[0]
  const close = (ok: boolean) => {
    current?.resolve(ok)
    setQueue((q) => q.slice(1))
  }

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      {current && (
        <div className="modal-backdrop dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="modal dialog" role="alertdialog" aria-modal>
            <div className="modal-body">
              <p>{current.message}</p>
            </div>
            <footer className="modal-foot">
              <button className="btn ghost" onClick={() => close(false)}>
                Cancelar
              </button>
              <button autoFocus className={`btn ${current.danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>
                {current.confirmLabel}
              </button>
            </footer>
          </div>
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.message}
          </div>
        ))}
      </div>
    </>
  )
}
