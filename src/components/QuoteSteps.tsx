import { useState } from 'react'
import { Icon } from './Icon'
import { SaveBar, useDraft } from './SaveBar'
import { Field, Modal, Section, Segmented } from './ui'
import { toast } from './dialog'
import { useStore } from '../store'
import { go } from '../router'
import { AUDIENCES, cloneSteps, processesOf, stepsPercent } from '../processes'
import type { ProcessStep, ProjectProcess, QuoteAudience } from '../types'
import { money, uid } from '../utils'

/** "Para quem é este orçamento?" — aparece ao criar um orçamento novo.
 *  1º passo: cliente final ou freelancer/parceiro (formatos e preços diferentes, explicados).
 *  2º passo (cliente final): o tipo de projeto, que já traz as etapas do seu jeito de trabalhar. */
export function AudienceChooser({ onPick, onClose }: { onPick: (a: QuoteAudience, processId?: string) => void; onClose: () => void }) {
  const { data } = useStore()
  const [step, setStep] = useState<'quem' | 'processo'>('quem')
  const list = processesOf(data.settings)
  if (step === 'processo')
    return (
      <Modal title="Que tipo de projeto?" onClose={onClose} wide>
        <p className="muted small">As etapas entram prontas na proposta (linha do tempo, prazos e pagamento por etapa). Você muda o que quiser neste orçamento, e o seu padrão fica em “etapas de trabalho”.</p>
        <div className="proc-pick">
          {list.map((p) => (
            <button key={p.id} type="button" className="proc-card" onClick={() => onPick('final', p.id)}>
              <b>{p.name}</b>
              {p.description && <span className="muted small">{p.description}</span>}
              <ol>
                {p.steps.filter((x) => x.name.trim()).map((x) => (
                  <li key={x.id}>
                    {x.name}
                    {x.percent > 0 && <em>{x.percent}%</em>}
                  </li>
                ))}
              </ol>
            </button>
          ))}
          <button type="button" className="proc-card is-plain" onClick={() => onPick('final', '')}>
            <b>sem etapas</b>
            <span className="muted small">só os serviços e o valor (ex.: uma consultoria avulsa)</span>
          </button>
        </div>
        <div className="row gap-s">
          <button type="button" className="btn ghost small" onClick={() => setStep('quem')}>
            <Icon name="chevronL" size={14} /> voltar
          </button>
          <button type="button" className="link small" onClick={() => (onClose(), go('processos'))}>
            editar minhas etapas de trabalho
          </button>
        </div>
      </Modal>
    )
  return (
    <Modal title="Para quem é este orçamento?" onClose={onClose} wide>
      <p className="muted small">Os dois formatos são bem diferentes: a proposta, o jeito de cobrar e as etapas mudam. Na dúvida, pense em <b>quem paga</b>: o dono do imóvel é cliente final; outro arquiteto ou escritório é parceiro.</p>
      <div className="aud-options">
        {AUDIENCES.map((a) => (
          <button key={a.id} type="button" className="aud-option" data-audience={a.id} onClick={() => (a.id === 'final' ? setStep('processo') : onPick('parceiro'))}>
            <span className="aud-icon">
              <Icon name={a.id === 'final' ? 'home' : 'briefcase'} size={20} />
            </span>
            <b>{a.title}</b>
            <span className="aud-short">{a.short}</span>
            <ul className="aud-points">
              {a.points.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <span className="aud-example">{a.example}</span>
            <span className="aud-go">{a.id === 'final' ? 'escolher o tipo de projeto →' : 'montar orçamento →'}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

/** Escolha rápida no topo do orçamento. */
export function AudienceSwitch({ value, onChange }: { value: QuoteAudience; onChange: (a: QuoteAudience) => void }) {
  const cur = AUDIENCES.find((a) => a.id === value)!
  return (
    <Field group label="Para quem é" span={2} hint={cur.text}>
      <Segmented<QuoteAudience> value={value} onChange={onChange} options={AUDIENCES.map((a) => ({ value: a.id, label: a.title }))} />
    </Field>
  )
}

const blankStep = (): ProcessStep => ({ id: uid(), name: '', description: '', items: [], days: 0, dayType: 'corridos', percent: 0 })

/** Lista de etapas editável (usada no orçamento e nas configurações). */
export function StepsList({ steps, total, onChange }: { steps: ProcessStep[]; total?: number; onChange: (s: ProcessStep[]) => void }) {
  const set = (id: string, patch: Partial<ProcessStep>) => onChange(steps.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const pct = stepsPercent(steps)
  return (
    <div className="steps-edit">
      {steps.map((x, i) => (
        <div key={x.id} className="step-card">
          <div className="step-head">
            <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
            <input className="step-name" value={x.name} placeholder="nome da etapa (ex.: anteprojeto)" onChange={(e) => set(x.id, { name: e.target.value })} aria-label="Nome da etapa" />
            <div className="step-tools">
              <button type="button" className="btn ghost small icon-only" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                <Icon name="chevronL" size={14} className="rot90" />
              </button>
              <button type="button" className="btn ghost small icon-only" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Descer">
                <Icon name="chevronL" size={14} className="rot-90" />
              </button>
              <button type="button" className="btn ghost small icon-only danger" onClick={() => onChange(steps.filter((y) => y.id !== x.id))} aria-label="Tirar etapa">
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
          <div className="step-body">
            <Field label="Explicação para o cliente">
              <textarea className="auto-grow" rows={2} value={x.description} placeholder="Em uma frase, o que acontece nesta etapa" onChange={(e) => set(x.id, { description: e.target.value.replace(/\n/g, ' ') })} spellCheck lang="pt-BR" />
            </Field>
            <Field label="O que inclui" hint="Um por linha.">
              <textarea rows={Math.min(6, Math.max(2, x.items.length))} value={x.items.join('\n')} placeholder={'levantamento métrico\nbriefing'} onChange={(e) => set(x.id, { items: e.target.value.split('\n') })} onBlur={() => set(x.id, { items: x.items.map((t) => t.trim()).filter(Boolean) })} spellCheck lang="pt-BR" />
            </Field>
            <div className="step-nums">
              <Field label="Prazo">
                <div className="row gap-s">
                  <input type="number" min={0} value={x.days || ''} placeholder="dias" onChange={(e) => set(x.id, { days: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                  <select value={x.dayType ?? 'corridos'} onChange={(e) => set(x.id, { dayType: e.target.value as 'uteis' | 'corridos' })} aria-label="Tipo de dia">
                    <option value="corridos">corridos</option>
                    <option value="uteis">úteis</option>
                  </select>
                </div>
              </Field>
              <Field label="Pagamento" hint={total && x.percent ? money(Math.round(total * x.percent) / 100) : 'nesta etapa'}>
                <div className="pct-input">
                  <input type="number" min={0} max={100} value={x.percent || ''} placeholder="0" onChange={(e) => set(x.id, { percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
                  <span>%</span>
                </div>
              </Field>
            </div>
          </div>
        </div>
      ))}
      <div className="steps-foot">
        <button type="button" className="btn ghost small" onClick={() => onChange([...steps, blankStep()])}>
          <Icon name="plus" size={14} /> etapa
        </button>
        <span className={`steps-pct ${pct === 100 || pct === 0 ? '' : 'is-warn'}`}>
          pagamento dividido: <b>{pct}%</b>
          {pct !== 100 && pct !== 0 ? ` · falta${pct > 100 ? ' tirar' : ''} ${Math.abs(100 - pct)}%` : ''}
        </span>
      </div>
    </div>
  )
}

/** Seção "etapas do projeto" do orçamento para cliente final. */
export function QuoteStepsSection({ steps, processId, total, onChange }: { steps: ProcessStep[]; processId?: string; total: number; onChange: (patch: { steps: ProcessStep[]; processId?: string }) => void }) {
  const { data, setSettings } = useStore()
  const list = processesOf(data.settings)
  const [saving, setSaving] = useState(false)
  const pick = (id: string) => {
    const p = list.find((x) => x.id === id)
    onChange({ processId: id || undefined, steps: p ? cloneSteps(p.steps) : [] })
  }
  const current = list.find((x) => x.id === processId)
  return (
    <Section
      title="etapas do projeto"
      action={
        steps.length > 0 && (
          <button type="button" className="link small" onClick={() => setSaving(true)}>
            salvar como padrão
          </button>
        )
      }
    >
      <p className="muted small">Viram a linha do tempo, os prazos e a divisão do pagamento na proposta. Ao aprovar, viram o cronograma da demanda.</p>
      <Field label="Seu jeito de trabalhar" hint="Os processos ficam em Configurações → propostas. Mexer aqui muda só este orçamento.">
        <select value={processId ?? ''} onChange={(e) => pick(e.target.value)}>
          <option value="">{steps.length ? 'etapas deste orçamento' : 'escolha um processo…'}</option>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <StepsList steps={steps} total={total} onChange={(s) => onChange({ steps: s, processId })} />
      {saving && (
        <SaveProcess
          initial={current?.name ?? ''}
          onClose={() => setSaving(false)}
          onSave={(name, replace) => {
            const base: ProjectProcess = { id: replace && current ? current.id : uid(), name, description: current?.description ?? '', steps: cloneSteps(steps) }
            const next = replace && current ? list.map((x) => (x.id === current.id ? { ...base, name } : x)) : [...list, base]
            setSettings({ processes: next })
            onChange({ steps, processId: base.id })
            setSaving(false)
            toast('Etapas salvas como padrão.')
          }}
        />
      )}
    </Section>
  )
}

function SaveProcess({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (name: string, replace: boolean) => void }) {
  const [name, setName] = useState(initial)
  return (
    <Modal
      title="Salvar como padrão"
      onClose={onClose}
      footer={
        <>
          {initial && (
            <button className="btn ghost" onClick={() => onSave(name.trim() || initial, true)}>
              atualizar “{initial}”
            </button>
          )}
          <button className="btn primary" onClick={() => name.trim() && onSave(name.trim(), false)} disabled={!name.trim()}>
            salvar como novo
          </button>
        </>
      }
    >
      <Field label="Nome do processo">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: interiores completo" autoFocus />
      </Field>
    </Modal>
  )
}

/** Configurações → propostas: processos de trabalho (cliente final). */
export function ProcessSettings() {
  const { data, setSettings } = useStore()
  const draft = useDraft(processesOf(data.settings), (v) => setSettings({ processes: v }))
  const list = draft.value
  const [open, setOpen] = useState(list[0]?.id ?? '')
  const save = (next: ProjectProcess[]) => draft.set(next)
  const cur = list.find((x) => x.id === open)
  return (
    <Section
      title="processos de trabalho"
      action={
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            const p: ProjectProcess = { id: uid(), name: 'novo processo', description: '', steps: [blankStep()] }
            save([...list, p])
            setOpen(p.id)
          }}
        >
          <Icon name="plus" size={14} /> processo
        </button>
      }
    >
      <SaveBar d={draft} />
      <p className="muted small">Para orçamentos de cliente final. Cada um trabalha de um jeito: mude nomes, o que inclui, prazos e a divisão do pagamento.</p>
      <div className="proc-tabs">
        {list.map((p) => (
          <button key={p.id} type="button" className={`chip ${open === p.id ? 'active' : ''}`} onClick={() => setOpen(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      {cur && (
        <div className="stack">
          <div className="form-grid">
            <Field label="Nome">
              <input value={cur.name} onChange={(e) => save(list.map((x) => (x.id === cur.id ? { ...x, name: e.target.value } : x)))} />
            </Field>
            <Field label="Resumo">
              <textarea className="auto-grow" rows={1} value={cur.description} onChange={(e) => save(list.map((x) => (x.id === cur.id ? { ...x, description: e.target.value.replace(/\n/g, ' ') } : x)))} />
            </Field>
          </div>
          <StepsList steps={cur.steps} onChange={(steps) => save(list.map((x) => (x.id === cur.id ? { ...x, steps } : x)))} />
          <div className="row gap-s">
            <button
              type="button"
              className="link small danger"
              onClick={() => {
                const next = list.filter((x) => x.id !== cur.id)
                save(next)
                setOpen(next[0]?.id ?? '')
              }}
            >
              apagar este processo
            </button>
            {data.settings.processes?.length ? (
              <button type="button" className="link small muted-link" onClick={() => setSettings({ processes: undefined })}>
                voltar aos processos prontos
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Section>
  )
}

const readImage = async (file: File) => {
  const { compressImage } = await import('../studioApi')
  const blob = await compressImage(file, 1400, 0.74)
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** Configurações → propostas: "sobre" e fotos de projetos (trocáveis) para a proposta em slides. */
export function PortfolioSettings() {
  const { data, setSettings } = useStore()
  const s = data.settings
  const photos = s.portfolio ?? []
  const put = async (i: number, file?: File) => {
    if (!file) return
    try {
      const url = await readImage(file)
      const next = [...photos]
      next[i] = url
      setSettings({ portfolio: next.filter(Boolean).slice(0, 3) })
    } catch {
      toast('Não deu para abrir esta imagem.')
    }
  }
  return (
    <Section title="apresentação para cliente final">
      <p className="muted small">Vão na proposta em slides (16:9). A 1ª foto é a capa; as três aparecem no slide de projetos. Clique numa foto para trocar.</p>
      <div className="port-grid">
        {[0, 1, 2].map((i) => (
          <label key={i} className={`port-slot ${photos[i] ? 'has-img' : ''}`}>
            {photos[i] ? <img src={photos[i]} alt="" /> : <span><Icon name="camera" size={20} /> {i === 0 ? 'foto da capa' : `foto ${i + 1}`}</span>}
            <input type="file" accept="image/*" hidden onChange={(e) => put(Math.min(i, photos.length), e.target.files?.[0])} />
            {photos[i] && (
              <button
                type="button"
                className="port-remove"
                aria-label="Tirar foto"
                onClick={(e) => {
                  e.preventDefault()
                  setSettings({ portfolio: photos.filter((_, k) => k !== i) })
                }}
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </label>
        ))}
      </div>
      <Field label="Sobre você / seu escritório" hint="Um parágrafo curto, no slide “O seu projeto”.">
        <textarea rows={3} value={s.about ?? ''} onChange={(e) => setSettings({ about: e.target.value })} placeholder="Ex.: Somos um estúdio de arquitetura e interiores que desenha espaços leves, funcionais e com a cara de quem vive neles." spellCheck lang="pt-BR" />
      </Field>
    </Section>
  )
}
