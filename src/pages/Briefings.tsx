import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { go, href, setLeaveGuard } from '../router'
import { Icon } from '../components/Icon'
import { Empty, Segmented } from '../components/ui'
import { askChoice, askDelete, toast } from '../components/dialog'
import { BriefingList, BriefingPreview, NewBriefing } from '../components/Briefing'
import { KIND_LABEL, allTemplates, findTemplate, isBuiltin, templateGroup } from '../briefingTemplates'
import { referenceImage } from '../briefingApi'
import { ArtImage, styleOptions } from '../components/BriefingArt'
import type { BriefingKind, BriefingQuestion, BriefingSection, BriefingTemplate } from '../types'
import { uid } from '../utils'

/* Briefings (plano Estúdio): modelos prontos e os seus, um editor no estilo formulário
   e a lista do que já foi enviado. */

export default function Briefings({ id }: { id?: string }) {
  if (id) return <TemplateEditor id={id} />
  return <BriefingsHome />
}

function BriefingsHome() {
  const { data, setSettings } = useStore()
  const [tab, setTab] = useState<'modelos' | 'enviados'>('modelos')
  const [send, setSend] = useState<string | null>(null)
  const mine = data.settings.briefingTemplates ?? []
  const all = allTemplates(mine, data.settings.hiddenBriefings)
  const [group, setGroup] = useState<'todos' | 'casa' | 'comercial' | 'meus'>('todos')
  const templates = all.filter((t) => group === 'todos' || templateGroup(t) === group)
  const sent = [...(data.briefings ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const waiting = sent.filter((b) => b.status === 'enviado').length
  const createBlank = () => {
    const t: BriefingTemplate = { id: `meu-${uid()}`, name: 'Novo modelo', description: 'descreva para que serve', icon: 'file', sections: [{ id: 'geral', title: 'perguntas' }], questions: [], updatedAt: new Date().toISOString() }
    setSettings({ briefingTemplates: [...mine, t] })
    go('briefings', t.id)
  }
  const duplicate = (t: BriefingTemplate) => {
    const copy: BriefingTemplate = { ...structuredClone(t), id: `meu-${uid()}`, name: `${t.name} (cópia)`, updatedAt: new Date().toISOString() }
    setSettings({ briefingTemplates: [...mine, copy] })
    toast('Cópia criada: edite à vontade.')
  }
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">plano Estúdio</p>
          <h1>
            briefings <em>para o cliente final</em>
          </h1>
        </div>
        <div className="row gap-s">
          <button className="btn primary" onClick={() => setSend('')}>
            <Icon name="whatsapp" size={16} /> mandar briefing
          </button>
        </div>
      </div>
      <p className="pf-note">
        <Icon name="clip" size={16} />
        <span>
          Escolha um modelo, ajuste as perguntas se quiser e mande o link. O cliente responde pelo celular, sem criar conta, pode anexar fotos, e as respostas voltam para a ficha dele. Você recebe um aviso quando ele terminar.
        </span>
      </p>
      <div className="bf-home-tabs">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'modelos', label: `modelos (${all.length})` },
            { value: 'enviados', label: `enviados${sent.length ? ` (${sent.length})` : ''}${waiting ? ` · ${waiting} aguardando` : ''}` },
          ]}
        />
      </div>
      {tab === 'modelos' && (
        <div className="chips bf-groups">
          {(['todos', 'casa', 'comercial', 'meus'] as const).map((g) => (
            <button key={g} type="button" className={`chip ${group === g ? 'active' : ''}`} onClick={() => setGroup(g)}>
              {g === 'casa' ? 'casa e ambientes' : g === 'meus' ? 'criados por você' : g}
            </button>
          ))}
        </div>
      )}
      {tab === 'modelos' ? (
        <div className="bf-models">
          {templates.map((t) => {
            const edited = isBuiltin(t.id) && mine.some((m) => m.id === t.id)
            const own = !isBuiltin(t.id)
            return (
              <article key={t.id} className="card bf-model is-clean">
                <a className="bf-model-main" href={href('briefings', t.id)} title="abrir e editar">
                  <span className="bf-tpl-icon">
                    <Icon name={t.icon || 'file'} size={17} />
                  </span>
                  <span className="grow">
                    <b>{t.name}</b>
                    <small>
                      {t.questions.length} perguntas · {t.sections.length} partes{edited ? ' · editado' : own ? ' · seu' : ''}
                    </small>
                  </span>
                </a>
                <p className="bf-model-desc">{t.description}</p>
                <footer>
                  <button className="btn small primary icon-only has-tip" data-tip="mandar para um cliente" aria-label="Mandar para um cliente" onClick={() => setSend(t.id)} disabled={!t.questions.length}>
                    <Icon name="whatsapp" size={16} />
                  </button>
                  <span className="grow" />
                  <a className="icon-btn subtle" href={href('briefings', t.id)} title="Editar" aria-label="Editar modelo">
                    <Icon name="edit" size={15} />
                  </a>
                  <button className="icon-btn subtle" title="Duplicar" aria-label="Duplicar modelo" onClick={() => duplicate(t)}>
                    <Icon name="copy" size={15} />
                  </button>
                  <button
                    className="icon-btn subtle"
                    title={own ? 'Apagar' : 'Tirar da minha lista'}
                    aria-label="Excluir modelo"
                    onClick={async () => {
                      if (own) return (await askDelete(`o modelo "${t.name}"`)) && setSettings({ briefingTemplates: mine.filter((m) => m.id !== t.id) })
                      if (!(await askDelete(`o modelo "${t.name}" da sua lista (só na sua conta; dá para trazer de volta)`))) return
                      setSettings({ hiddenBriefings: [...(data.settings.hiddenBriefings ?? []), t.id], briefingTemplates: mine.filter((m) => m.id !== t.id) })
                    }}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </footer>
              </article>
            )
          })}
          <button type="button" className="card bf-model bf-model-new" onClick={createBlank}>
            <Icon name="plus" size={22} />
            <b>criar modelo do zero</b>
            <small className="muted">monte as suas perguntas</small>
          </button>
          {(data.settings.hiddenBriefings ?? []).length > 0 && (
            <button type="button" className="link small bf-unhide" onClick={() => setSettings({ hiddenBriefings: [] })}>
              trazer de volta os {data.settings.hiddenBriefings!.length} modelo(s) prontos que você tirou
            </button>
          )}
        </div>
      ) : sent.length === 0 ? (
        <Empty icon="clip" title="nenhum briefing enviado ainda" text="Toque em “mandar briefing”, escolha o cliente e o modelo." />
      ) : (
        <div className="card">
          <BriefingList list={sent} showClient />
        </div>
      )}
      {send !== null && <NewBriefing templateId={send || undefined} onClose={() => setSend(null)} />}
    </div>
  )
}

/* ---------------- editor de modelo (estilo formulário) ---------------- */

const KINDS: BriefingKind[] = ['text', 'long', 'choice', 'multi', 'photos', 'date']
const KIND_ICON: Record<BriefingKind, string> = { text: 'edit', long: 'list', choice: 'check', multi: 'grid', photos: 'camera', date: 'calendar' }

function TemplateEditor({ id }: { id: string }) {
  const { data, setSettings } = useStore()
  const mine = data.settings.briefingTemplates ?? []
  const stored = findTemplate(mine, id)
  const [preview, setPreview] = useState(false)
  // as mudanças ficam num rascunho: salvar, desfazer a última ou descartar tudo
  const [draft, setDraft] = useState<BriefingTemplate | undefined>(stored)
  const [history, setHistory] = useState<BriefingTemplate[]>([])
  const dirty = !!draft && !!stored && JSON.stringify({ ...draft, updatedAt: '' }) !== JSON.stringify({ ...stored, updatedAt: '' })
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    setLeaveGuard(async () => {
      const c = await askChoice('Este modelo tem mudanças que não foram salvas.', { confirmLabel: 'Salvar e sair', altLabel: 'Sair sem salvar' })
      if (c === 'cancel') return false
      if (c === 'confirm') commitRef.current()
      return true
    })
    return () => {
      window.removeEventListener('beforeunload', warn)
      setLeaveGuard(null)
    }
  }, [dirty])
  const commitRef = useRef(() => {})
  if (!stored || !draft) return <Empty title="Modelo não encontrado" action={<a className="btn" href={href('briefings')}>voltar</a>} />
  const t = draft
  const builtin = isBuiltin(t.id)
  const edited = builtin && mine.some((m) => m.id === t.id)
  const save = (patch: Partial<BriefingTemplate>) => {
    setHistory((h) => [...h.slice(-60), t])
    setDraft({ ...t, ...patch })
  }
  // salvar um modelo pronto cria a sua versão (o original continua guardado para restaurar)
  const commit = () => {
    const next = { ...t, updatedAt: new Date().toISOString() }
    setSettings({ briefingTemplates: mine.some((m) => m.id === t.id) ? mine.map((m) => (m.id === t.id ? next : m)) : [...mine, next] })
    setDraft(next)
    setHistory([])
    toast('Modelo salvo.')
  }
  commitRef.current = commit
  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setDraft(prev)
    setHistory((h) => h.slice(0, -1))
  }
  const setQ = (qid: string, patch: Partial<BriefingQuestion>) => save({ questions: t.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) })
  const setS = (sid: string, patch: Partial<BriefingSection>) => save({ sections: t.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) })
  const moveQ = (qid: string, d: number) => {
    const q = t.questions.find((x) => x.id === qid)!
    const same = t.questions.filter((x) => x.section === q.section)
    const i = same.indexOf(q)
    const other = same[i + d]
    if (!other) return
    const list = [...t.questions]
    const a = list.indexOf(q)
    const b = list.indexOf(other)
    ;[list[a], list[b]] = [list[b], list[a]]
    save({ questions: list })
  }
  const moveS = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= t.sections.length) return
    const list = [...t.sections]
    ;[list[i], list[j]] = [list[j], list[i]]
    save({ sections: list })
  }
  const addQ = (section: string, kind: BriefingKind = 'text') => save({ questions: [...t.questions, { id: `q-${uid()}`, section, label: '', kind, ...(kind === 'choice' || kind === 'multi' ? { options: ['opção 1', 'opção 2'] } : {}) }] })
  const addS = () => save({ sections: [...t.sections, { id: `s-${uid()}`, title: 'nova parte' }] })
  const delS = async (s: BriefingSection) => {
    const n = t.questions.filter((q) => q.section === s.id).length
    if (!(await askDelete(`a parte "${s.title}"${n ? ` e as ${n} perguntas dela` : ''}`))) return
    save({ sections: t.sections.filter((x) => x.id !== s.id), questions: t.questions.filter((q) => q.section !== s.id) })
  }
  return (
    <div className="page bf-editor">
      <a href={href('briefings')} className="back">
        <Icon name="chevronL" size={16} /> briefings
      </a>
      <div className="card bf-ed-head">
        <input className="bf-ed-title" value={t.name} onChange={(e) => save({ name: e.target.value })} aria-label="Nome do modelo" />
        <input className="bf-ed-desc" value={t.description} onChange={(e) => save({ description: e.target.value })} placeholder="para que serve este modelo" aria-label="Descrição" />
        <div className="bf-ed-meta">
          <span className="muted small">
            {t.questions.length} perguntas · {t.sections.length} partes
          </span>
          <div className="row gap-s wrap">
            <button className="btn small ghost" onClick={() => setPreview(true)}>
              <Icon name="eye" size={14} /> ver como o cliente
            </button>
            {edited && (
              <button
                className="btn small ghost"
                onClick={async () => {
                  if (!(await askDelete('as suas mudanças neste modelo (volta ao original)'))) return
                  setSettings({ briefingTemplates: mine.filter((m) => m.id !== t.id) })
                  const original = findTemplate([], t.id)
                  if (original) setDraft(original)
                  setHistory([])
                }}
              >
                restaurar original
              </button>
            )}
          </div>
        </div>
        {builtin && !edited && <p className="bf-ed-note">Este é um modelo pronto. Ao salvar, vira a sua versão, e dá para restaurar o original depois.</p>}
      </div>
      <div className={`bf-ed-bar ${dirty ? 'is-dirty' : ''}`}>
        <span className="grow small">{dirty ? 'mudanças não salvas' : 'tudo salvo'}</span>
        <button className="btn small ghost" onClick={undo} disabled={!history.length} title="Desfazer a última mudança">
          <Icon name="chevronL" size={14} /> desfazer
        </button>
        <button className="btn small ghost" onClick={() => (setDraft(stored), setHistory([]))} disabled={!dirty}>
          descartar
        </button>
        <button className="btn small primary" onClick={commit} disabled={!dirty}>
          <Icon name="check" size={14} /> salvar
        </button>
      </div>

      {t.sections.map((s, si) => {
        const list = t.questions.filter((q) => q.section === s.id)
        return (
          <section key={s.id} className="bf-ed-section">
            <div className="bf-ed-section-head">
              <span className="bf-block-n">{si + 1}</span>
              <div className="grow">
                <input className="bf-ed-stitle" value={s.title} onChange={(e) => setS(s.id, { title: e.target.value })} aria-label="Título da parte" />
                <input className="bf-ed-sdesc" value={s.description ?? ''} onChange={(e) => setS(s.id, { description: e.target.value })} placeholder="explicação da parte (opcional)" aria-label="Explicação da parte" />
              </div>
              <div className="bf-ed-tools">
                <button className="icon-btn subtle" onClick={() => moveS(si, -1)} disabled={si === 0} aria-label="Subir parte">
                  <Icon name="chevronL" size={14} className="rot-90" />
                </button>
                <button className="icon-btn subtle" onClick={() => moveS(si, 1)} disabled={si === t.sections.length - 1} aria-label="Descer parte">
                  <Icon name="chevronR" size={14} className="rot-90" />
                </button>
                <button className="icon-btn subtle" onClick={() => void delS(s)} aria-label="Apagar parte">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
            {list.map((q, qi) => (
              <QuestionEditor key={q.id} q={q} all={t.questions} n={qi + 1} first={qi === 0} last={qi === list.length - 1} sections={t.sections} onChange={(patch) => setQ(q.id, patch)} onMove={(d) => moveQ(q.id, d)} onDuplicate={() => save({ questions: [...t.questions.slice(0, t.questions.indexOf(q) + 1), { ...structuredClone(q), id: `q-${uid()}` }, ...t.questions.slice(t.questions.indexOf(q) + 1)] })} onDelete={() => save({ questions: t.questions.filter((x) => x.id !== q.id) })} />
            ))}
            <div className="bf-ed-add">
              <span className="muted small">+ pergunta:</span>
              {KINDS.map((k) => (
                <button key={k} type="button" className="chip" onClick={() => addQ(s.id, k)}>
                  <Icon name={KIND_ICON[k]} size={13} /> {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </section>
        )
      })}
      <button className="btn bf-ed-addsec" onClick={addS}>
        <Icon name="plus" size={15} /> nova parte
      </button>
      {preview && <BriefingPreview tpl={t} onClose={() => setPreview(false)} />}
    </div>
  )
}

function QuestionEditor({ q, all, n, first, last, sections, onChange, onMove, onDuplicate, onDelete }: { q: BriefingQuestion; all: BriefingQuestion[]; n: number; first: boolean; last: boolean; sections: BriefingSection[]; onChange: (p: Partial<BriefingQuestion>) => void; onMove: (d: number) => void; onDuplicate: () => void; onDelete: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [showHint, setShowHint] = useState(!!q.hint)
  const hasOptions = q.kind === 'choice' || q.kind === 'multi'
  const opts = q.options ?? []
  const pics = q.optionImages ?? {}
  const optFile = useRef<HTMLInputElement>(null)
  const [optTarget, setOptTarget] = useState('')
  const putOptionImage = async (file?: File) => {
    if (!file || !optTarget) return
    try {
      onChange({ optionImages: { ...pics, [optTarget]: await referenceImage(file) } })
    } catch {
      toast('Não consegui abrir esta imagem.')
    }
  }
  const styleArt = styleOptions(opts)
  // perguntas de escolha que vêm antes: podem "abrir" esta como sub-pergunta
  const parents = all.filter((x) => x.id !== q.id && (x.kind === 'choice' || x.kind === 'multi') && all.indexOf(x) < all.indexOf(q))
  const parent = parents.find((x) => x.id === q.showIf?.q)
  const addImages = async (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/')).slice(0, 6)
    const imgs: string[] = []
    for (const f of list) {
      try {
        imgs.push(await referenceImage(f))
      } catch {
        toast(`Não consegui abrir ${f.name}.`)
      }
    }
    if (imgs.length) onChange({ images: [...(q.images ?? []), ...imgs].slice(0, 8) })
  }
  return (
    <div className={`card bf-qed ${!q.label.trim() ? 'is-empty' : ''} ${q.showIf ? 'is-sub' : ''}`}>
      <div className="bf-qed-top">
        <span className="bf-qed-n">{n}</span>
        <input className="bf-qed-label" value={q.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Escreva a pergunta" aria-label="Pergunta" autoFocus={!q.label} />
        <select className="bf-qed-kind" value={q.kind} onChange={(e) => {
          const kind = e.target.value as BriefingKind
          onChange({ kind, ...((kind === 'choice' || kind === 'multi') && !q.options?.length ? { options: ['opção 1', 'opção 2'] } : {}) })
        }} aria-label="Tipo de resposta">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      {(showHint || q.hint) && <input className="bf-qed-hint" value={q.hint ?? ''} onChange={(e) => onChange({ hint: e.target.value })} placeholder="explicação curta embaixo da pergunta" aria-label="Explicação" />}

      {hasOptions && (
        <div className="bf-qed-opts">
          {opts.map((o, i) => (
            <div key={i} className="bf-qed-opt">
              <span className={q.kind === 'choice' ? 'bf-radio' : 'bf-box'} aria-hidden />
              {pics[o] && (
                <span className="bf-qed-optpic">
                  <ArtImage src={pics[o]} />
                </span>
              )}
              <input
                value={o}
                onChange={(e) => {
                  const v = e.target.value
                  const nextPics = pics[o] ? Object.fromEntries(Object.entries(pics).map(([k, img]) => [k === o ? v : k, img])) : undefined
                  onChange({ options: opts.map((x, j) => (j === i ? v : x)), ...(nextPics ? { optionImages: nextPics } : {}) })
                }}
                aria-label={`Opção ${i + 1}`}
              />
              <button className="icon-btn subtle" title={pics[o] ? 'Trocar imagem' : 'Pôr imagem nesta opção'} aria-label="Imagem da opção" onClick={() => (setOptTarget(o), optFile.current?.click())}>
                <Icon name="camera" size={13} />
              </button>
              {pics[o] && (
                <button className="icon-btn subtle" title="Tirar imagem" aria-label="Tirar imagem da opção" onClick={() => onChange({ optionImages: Object.fromEntries(Object.entries(pics).filter(([k]) => k !== o)) })}>
                  <Icon name="x" size={13} />
                </button>
              )}
              <button className="icon-btn subtle" onClick={() => onChange({ options: opts.filter((_, j) => j !== i) })} aria-label="Tirar opção">
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
          <div className="bf-qed-opt">
            <span className={q.kind === 'choice' ? 'bf-radio' : 'bf-box'} aria-hidden />
            <button className="link small" onClick={() => onChange({ options: [...opts, `opção ${opts.length + 1}`] })}>
              adicionar opção
            </button>
            {!q.other && (
              <>
                <span className="muted small">ou</span>
                <button className="link small" onClick={() => onChange({ other: true })}>
                  “outro” (o cliente escreve)
                </button>
              </>
            )}
          </div>
          <input ref={optFile} type="file" accept="image/*" hidden onChange={(e) => (void putOptionImage(e.target.files?.[0]), (e.target.value = ''))} />
          {Object.keys(styleArt).length > 0 && Object.keys(styleArt).some((k) => !pics[k]) && (
            <button className="link small bf-qed-art" onClick={() => onChange({ optionImages: { ...styleArt, ...pics } })}>
              ✨ usar as ilustrações prontas de estilo
            </button>
          )}
          {Object.keys(pics).length > 0 && <p className="bf-qed-info">O cliente escolhe tocando nas imagens. Troque pelas fotos dos seus projetos quando quiser.</p>}
          {q.other && (
            <div className="bf-qed-opt">
              <span className={q.kind === 'choice' ? 'bf-radio' : 'bf-box'} aria-hidden />
              <span className="muted small grow">outro: o cliente escreve</span>
              <button className="icon-btn subtle" onClick={() => onChange({ other: false })} aria-label="Tirar outro">
                <Icon name="x" size={13} />
              </button>
            </div>
          )}
        </div>
      )}
      {q.kind === 'photos' && (
        <>
          <p className="bf-qed-info">O cliente toca em “adicionar fotos” e escolhe da galeria ou tira na hora.</p>
          <label className="bf-qed-tips">
            <span className="muted small">fotos sugeridas (uma por linha) · aparecem como lista para o cliente</span>
            <textarea rows={Math.max(2, (q.tips ?? []).length)} value={(q.tips ?? []).join('\n')} onChange={(e) => onChange({ tips: e.target.value.split('\n') })} onBlur={() => onChange({ tips: (q.tips ?? []).map((x) => x.trim()).filter(Boolean) })} placeholder={'de cada parede, de frente\ndo teto e do piso\ntomadas e janelas'} />
          </label>
        </>
      )}
      {parents.length > 0 && (
        <div className="bf-qed-if">
          <label className="check small">
            <input type="checkbox" checked={!!q.showIf} onChange={(e) => onChange({ showIf: e.target.checked ? { q: parents[parents.length - 1].id, is: parents[parents.length - 1].options?.[0] ?? '' } : undefined })} /> sub-pergunta: só aparece se…
          </label>
          {q.showIf && (
            <div className="row gap-s wrap">
              <select value={q.showIf.q} onChange={(e) => onChange({ showIf: { q: e.target.value, is: parents.find((x) => x.id === e.target.value)?.options?.[0] ?? '' } })} aria-label="Pergunta de cima">
                {parents.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label || 'pergunta sem título'}
                  </option>
                ))}
              </select>
              <span className="muted small">tiver a resposta</span>
              <select value={q.showIf.is} onChange={(e) => onChange({ showIf: { q: q.showIf!.q, is: e.target.value } })} aria-label="Resposta">
                {(parent?.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      {(q.kind === 'text' || q.kind === 'long' || q.kind === 'date') && <p className="bf-qed-info">{q.kind === 'long' ? 'Resposta em parágrafo.' : q.kind === 'date' ? 'O cliente escolhe uma data.' : 'Resposta curta.'}</p>}

      {q.images && q.images.length > 0 && (
        <div className="bf-refs is-edit">
          {q.images.map((src, i) => (
            <span key={i}>
              <img src={src} alt="" />
              <button type="button" aria-label="Tirar imagem" onClick={() => onChange({ images: q.images!.filter((_, j) => j !== i) })}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="bf-qed-foot">
        <label className="check small">
          <input type="checkbox" checked={!!q.required} onChange={(e) => onChange({ required: e.target.checked })} /> obrigatória
        </label>
        {!showHint && !q.hint && (
          <button className="link small" onClick={() => setShowHint(true)}>
            + explicação
          </button>
        )}
        <button className="link small" onClick={() => fileRef.current?.click()}>
          + imagem de referência
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (void addImages(e.target.files), (e.target.value = ''))} />
        {sections.length > 1 && (
          <select className="bf-qed-move" value={q.section} onChange={(e) => onChange({ section: e.target.value })} aria-label="Mudar de parte">
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                parte: {s.title}
              </option>
            ))}
          </select>
        )}
        <span className="grow" />
        <button className="icon-btn subtle" onClick={() => onMove(-1)} disabled={first} aria-label="Subir">
          <Icon name="chevronL" size={14} className="rot-90" />
        </button>
        <button className="icon-btn subtle" onClick={() => onMove(1)} disabled={last} aria-label="Descer">
          <Icon name="chevronR" size={14} className="rot-90" />
        </button>
        <button className="icon-btn subtle" onClick={onDuplicate} aria-label="Duplicar pergunta" title="Duplicar">
          <Icon name="copy" size={14} />
        </button>
        <button className="icon-btn subtle" onClick={onDelete} aria-label="Apagar pergunta" title="Apagar">
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  )
}

