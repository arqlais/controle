import { useEffect, useRef, useState } from 'react'
import { setLeaveGuard } from '../router'
import { askChoice } from './dialog'
import { Icon } from './Icon'

/** Rascunho com desfazer, descartar e salvar: nada vai para a conta até tocar em salvar. */
export function useDraft<T>(stored: T, commit: (v: T) => void) {
  const [draft, setDraftState] = useState<T>(stored)
  const [history, setHistory] = useState<T[]>([])
  const base = JSON.stringify(stored)
  const dirty = JSON.stringify(draft) !== base
  // o que está salvo mudou por fora (outro aparelho): acompanha se não há mudança pendente
  const last = useRef(base)
  useEffect(() => {
    if (last.current !== base && !dirty) setDraftState(stored)
    last.current = base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base])
  const set = (v: T) => {
    setHistory((h) => [...h.slice(-40), draft])
    setDraftState(v)
  }
  const save = () => {
    commit(draft)
    setHistory([])
  }
  const commitRef = useRef(save)
  commitRef.current = save
  // sair com mudanças: pergunta antes
  useEffect(() => {
    if (!dirty) return
    setLeaveGuard(async () => {
      const c = await askChoice('Há mudanças que não foram salvas.', { confirmLabel: 'Salvar e sair', altLabel: 'Sair sem salvar' })
      if (c === 'cancel') return false
      if (c === 'confirm') commitRef.current()
      return true
    })
    return () => setLeaveGuard(null)
  }, [dirty])
  return {
    value: draft,
    set,
    dirty,
    canUndo: history.length > 0,
    undo: () => {
      const prev = history[history.length - 1]
      if (prev === undefined) return
      setHistory((h) => h.slice(0, -1))
      setDraftState(prev)
    },
    discard: () => (setDraftState(stored), setHistory([])),
    save,
  }
}

export function SaveBar({ d }: { d: { dirty: boolean; canUndo: boolean; undo: () => void; discard: () => void; save: () => void } }) {
  return (
    <div className={`bf-ed-bar save-bar ${d.dirty ? 'is-dirty' : ''}`}>
      <span className="grow small">{d.dirty ? 'mudanças não salvas' : 'tudo salvo'}</span>
      <button className="btn small ghost" onClick={d.undo} disabled={!d.canUndo} title="Desfazer a última mudança">
        <Icon name="chevronL" size={14} /> desfazer
      </button>
      <button className="btn small ghost" onClick={d.discard} disabled={!d.dirty}>
        descartar
      </button>
      <button className="btn small primary" onClick={d.save} disabled={!d.dirty}>
        <Icon name="check" size={14} /> salvar
      </button>
    </div>
  )
}

/* Rascunho de formulário: o que foi digitado fica guardado neste aparelho enquanto a janela está aberta.
   Fechou sem querer (tocou fora, Esc, a página recarregou)? Ao abrir de novo, o rascunho volta.
   "Cancelar" e "Salvar" apagam o rascunho. */
const DRAFT_PREFIX = 'rascunho:'
export function useFormDraft<T>(key: string, initial: T) {
  const base = useRef(JSON.stringify(initial))
  const [restored, setRestored] = useState(false)
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX + key)
      if (raw && raw !== base.current) {
        setTimeout(() => setRestored(true), 0)
        return JSON.parse(raw) as T
      }
    } catch {
      /* ok */
    }
    return initial
  })
  const cleared = useRef(false)
  useEffect(() => {
    if (cleared.current) return
    try {
      const raw = JSON.stringify(value)
      if (raw === base.current) localStorage.removeItem(DRAFT_PREFIX + key)
      else localStorage.setItem(DRAFT_PREFIX + key, raw)
    } catch {
      /* sem espaço ou bloqueado: segue sem rascunho */
    }
  }, [key, value])
  const clear = () => {
    cleared.current = true
    try {
      localStorage.removeItem(DRAFT_PREFIX + key)
    } catch {
      /* ok */
    }
  }
  const restart = () => {
    setRestored(false)
    setValue(initial)
  }
  /** Salvou e continua editando: o salvo vira a nova base (sem rascunho pendente). */
  const rebase = (v: T) => {
    base.current = JSON.stringify(v)
    setRestored(false)
    try {
      localStorage.removeItem(DRAFT_PREFIX + key)
    } catch {
      /* ok */
    }
  }
  return { value, setValue, restored, clear, restart, rebase }
}

/** Aviso de rascunho recuperado, com a opção de começar de novo. */
export function DraftNote({ d }: { d: { restored: boolean; restart: () => void } }) {
  if (!d.restored) return null
  return (
    <p className="draft-note">
      <Icon name="edit" size={14} />
      <span className="grow">Rascunho recuperado: você tinha fechado sem salvar.</span>
      <button type="button" className="link small" onClick={d.restart}>
        começar de novo
      </button>
    </p>
  )
}
