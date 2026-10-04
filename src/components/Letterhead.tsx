import { useRef, useState } from 'react'
import { Icon } from './Icon'
import { toast } from './dialog'
import type { Letterhead } from '../types'

/* Papel timbrado: a pessoa anexa o desenho da folha (imagem ou PDF) e ajusta onde o texto começa e termina.
   O texto do contrato entra por cima, preenchido sozinho, e quebra de folha em folha com o mesmo desenho. */

export function LetterheadField({ value, onChange }: { value?: Letterhead; onChange: (v: Letterhead | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      const { letterheadImages } = await import('../pdfPages')
      const img = await letterheadImages(f)
      onChange({ top: 150, bottom: 110, side: 72, ...value, ...img })
      toast('Papel timbrado aplicado. Ajuste as margens para o texto não passar por cima do cabeçalho e do rodapé.')
    } catch {
      toast('Não consegui abrir esse arquivo. Use uma imagem (PNG/JPG) ou um PDF da folha.')
    } finally {
      setBusy(false)
    }
  }
  const set = (k: 'top' | 'bottom' | 'side', n: number) => value && onChange({ ...value, [k]: n })
  return (
    <div className="lhf">
      {value ? (
        <div className="lhf-row">
          <span className="lhf-thumb">
            <img src={value.first} alt="Papel timbrado" />
            <i style={{ top: `${(value.top / 1123) * 100}%`, bottom: `${(value.bottom / 1123) * 100}%`, left: `${(value.side / 794) * 100}%`, right: `${(value.side / 794) * 100}%` }} />
          </span>
          <div className="lhf-ctrl">
            {(
              [
                ['top', 'texto começa a', 60, 400],
                ['bottom', 'texto termina a', 40, 300],
                ['side', 'margem dos lados', 30, 160],
              ] as const
            ).map(([k, label, min, max]) => (
              <label key={k} className="lhf-range">
                <span className="small">
                  {label} {k === 'side' ? '' : k === 'top' ? 'do topo' : 'do pé'}: <b>{Math.round((value[k] / 1123) * 297)} mm</b>
                </span>
                <input type="range" min={min} max={max} step={2} value={value[k]} onChange={(e) => set(k, Number(e.target.value))} />
              </label>
            ))}
            <div className="row gap-s wrap">
              <button type="button" className="btn small ghost" disabled={busy} onClick={() => ref.current?.click()}>
                <Icon name="upload" size={14} /> {busy ? 'abrindo…' : 'trocar desenho'}
              </button>
              <button type="button" className="btn small ghost" onClick={() => onChange(undefined)}>
                <Icon name="trash" size={14} /> tirar
              </button>
            </div>
            <p className="muted small">A área clara no desenho é onde o texto entra. Se o arquivo tiver 2 folhas, a 2ª vale para as folhas seguintes.</p>
          </div>
        </div>
      ) : (
        <button type="button" className="lhf-empty" disabled={busy} onClick={() => ref.current?.click()}>
          <Icon name="image" size={20} />
          <b>{busy ? 'abrindo…' : 'anexar papel timbrado'}</b>
          <small>imagem ou PDF da sua folha (com logo, cabeçalho, rodapé e fundo). O texto do contrato entra por cima, preenchido sozinho.</small>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*,.pdf,application/pdf" hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
    </div>
  )
}
