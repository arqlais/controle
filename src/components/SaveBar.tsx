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
