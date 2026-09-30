import { useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { SaveBar, useDraft } from '../components/SaveBar'
import { Section, Segmented } from '../components/ui'
import { ProcessSettings } from '../components/QuoteSteps'
import { DEFAULT_STUDENT_TASKS } from '../processes'
import { DEFAULT_TASKS } from '../utils'

/* Etapas de trabalho: cada tipo de cliente tem o seu jeito.
   - cliente final: etapas do projeto (vão na proposta em slides, viram cronograma e parcelas)
   - freelancer / escritório parceiro: checklist da demanda
   - estudante: checklist mais curto, sem etapas de obra */

type Tab = 'final' | 'freela' | 'estudante'

const INTRO: Record<Tab, { title: string; text: string }> = {
  final: {
    title: 'cliente final · arquitetura e interiores',
    text: 'As etapas do projeto (briefing, layout, anteprojeto, executivo, obra…). Entram na proposta em slides com prazo e % do pagamento e, ao fechar, viram o cronograma da demanda e a página do cliente.',
  },
  freela: {
    title: 'freelancer · escritório parceiro',
    text: 'O checklist de cada demanda que você faz para outro arquiteto ou escritório (renders, detalhamentos, modelagens). Aparece no card da demanda para marcar o que já foi feito.',
  },
  estudante: {
    title: 'estudante',
    text: 'Um checklist mais curto para trabalhos de estudantes (TCC, maquete eletrônica, pranchas). Sem cronograma de obra nem página do cliente.',
  },
}

export default function Processes() {
  const [tab, setTab] = useState<Tab>('final')
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">como você trabalha</p>
          <h1>
            etapas <em>de trabalho</em>
          </h1>
        </div>
      </div>
      <p className="pf-note">
        <Icon name="layers" size={16} />
        <span>Cada tipo de cliente tem um jeito de trabalhar. Ajuste aqui uma vez e vale para os próximos orçamentos e demandas (os que já existem não mudam).</span>
      </p>
      <div className="bf-home-tabs">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'final', label: 'cliente final' },
            { value: 'freela', label: 'freelancer / parceiro' },
            { value: 'estudante', label: 'estudante' },
          ]}
        />
      </div>
      <div className="proc-intro card">
        <b>{INTRO[tab].title}</b>
        <p className="muted small">{INTRO[tab].text}</p>
      </div>
      {tab === 'final' ? <ProcessSettings /> : <TaskList kind={tab} />}
    </div>
  )
}

function TaskList({ kind }: { kind: 'freela' | 'estudante' }) {
  const { data, setSettings } = useStore()
  const key = kind === 'freela' ? 'freelaTasks' : 'studentTasks'
  const base = kind === 'freela' ? DEFAULT_TASKS : DEFAULT_STUDENT_TASKS
  const draft = useDraft(data.settings[key]?.length ? data.settings[key]! : base, (v) => setSettings({ [key]: v.filter((x) => x.trim()) }))
  const list = draft.value
  const save = (next: string[]) => draft.set(next)
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    save(next)
  }
  return (
    <Section
      title="checklist da demanda"
      action={
        <button type="button" className="btn ghost small" onClick={() => save([...list, ''])}>
          <Icon name="plus" size={14} /> etapa
        </button>
      }
    >
      <SaveBar d={draft} />
      <ol className="task-edit">
        {list.map((t, i) => (
          <li key={i}>
            <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
            <input value={t} onChange={(e) => save(list.map((x, j) => (j === i ? e.target.value : x)))} onBlur={() => save(list.filter((x) => x.trim()))} placeholder="nome da etapa" aria-label={`Etapa ${i + 1}`} autoFocus={!t} />
            <button type="button" className="icon-btn subtle" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
              <Icon name="chevronL" size={14} className="rot-90" />
            </button>
            <button type="button" className="icon-btn subtle" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Descer">
              <Icon name="chevronR" size={14} className="rot-90" />
            </button>
            <button type="button" className="icon-btn subtle" onClick={() => save(list.filter((_, j) => j !== i))} aria-label="Tirar etapa">
              <Icon name="trash" size={14} />
            </button>
          </li>
        ))}
      </ol>
      {data.settings[key]?.length ? (
        <button type="button" className="link small muted-link" onClick={() => setSettings({ [key]: undefined })}>
          voltar às etapas prontas
        </button>
      ) : null}
    </Section>
  )
}
