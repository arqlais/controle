import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { Field, MoneyInput, Section } from '../components/ui'
import { DateInput } from '../components/DateInput'
import { ClientPicker } from '../components/ClientPicker'
import { DocLookPanel, DocWorkbench, PhotoCrop, pickImage } from '../components/DocKit'
import { WorkDocView } from '../components/docs/WorkDocView'
import { PAGE } from '../components/docs/DocPage'
import { askChoice, askDelete, toast } from '../components/dialog'
import { useFormDraft } from '../components/SaveBar'
import { setLeaveGuard } from '../router'
import { withPanelShare } from '../clientPanel'
import { money, projectTag, today, uid } from '../utils'
import type { SavedDoc } from '../docTypes'
import { WORK_KINDS, WORK_LAYOUTS, has, newWorkDoc, workDone, workTotal, type WorkDoc, type WorkItem, type WorkKind } from '../workDocs'

/* Editor dos documentos de obra: campos à esquerda, a folha ao lado (4 layouts), PDF e painel do cliente.
   Fica salvo na ficha do cliente (e da demanda, quando escolhida). */

export function WorkDocEditor({ saved, kind, onBack, projectId }: { saved?: SavedDoc; kind: WorkKind; onBack: () => void; projectId?: string }) {
  const { data, upsert, remove } = useStore()
  const project0 = data.projects.find((p) => p.id === (saved?.work?.projectId ?? projectId))
  const initial: WorkDoc = saved?.work ?? { ...newWorkDoc(kind, today(), uid), projectId: project0?.id }
  const draft = useFormDraft<WorkDoc>(`obra:${saved?.id ?? `${kind}:${projectId ?? ''}`}`, initial)
  const doc = draft.value
  const setDoc = draft.setValue
  const [clientId, setClientId] = useState(saved?.clientId || project0?.clientId || '')
  const [html, setHtml] = useState<string | null>(saved?.html ?? null)
  const [savedId, setSavedId] = useState(saved?.id)
  const snap = (v: WorkDoc, c: string, h: string | null) => JSON.stringify([v, c, h])
  const [baseline, setBaseline] = useState(() => snap(initial, saved?.clientId || project0?.clientId || '', saved?.html ?? null))
  const dirty = snap(doc, clientId, html) !== baseline
  const k = WORK_KINDS[doc.kind]
  const client = data.clients.find((c) => c.id === clientId)
  const project = data.projects.find((p) => p.id === doc.projectId)
  const projects = data.projects.filter((p) => !clientId || p.clientId === clientId)
  const set = (patch: Partial<WorkDoc>) => setDoc((d) => ({ ...d, ...patch }))
  const setItem = (id: string, patch: Partial<WorkItem>) => setDoc((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))

  const save = () => {
    if (!clientId) return toast('Escolha o cliente: o documento fica salvo na ficha dele.')
    const now = new Date().toISOString()
    const out: SavedDoc = { id: savedId ?? uid(), clientId, kind: 'obra', title: `${k.label}${doc.title.trim() && doc.title.trim() !== k.label ? ` · ${doc.title.trim()}` : ''}`, work: doc, html: html ?? undefined, createdAt: saved?.createdAt ?? now, updatedAt: now }
    upsert('docs', out)
    if (!savedId) {
      const shared = withPanelShare(client, 'docs', out.id)
      if (shared) upsert('clients', shared)
    }
    setSavedId(out.id)
    setBaseline(snap(doc, clientId, html))
    draft.rebase(doc)
    toast(`Salvo na ficha de ${client?.name.split(' ')[0] ?? 'cliente'}${client?.panel?.enabled ? ' e no painel dele' : ''}.`)
  }
  const saveRef = useRef(save)
  saveRef.current = save
  const back = async () => {
    if (dirty) {
      const c = await askChoice('Este documento tem mudanças que não foram salvas.', { confirmLabel: 'Salvar e voltar', altLabel: 'Voltar sem salvar' })
      if (c === 'cancel') return
      if (c === 'confirm') save()
    }
    onBack()
  }
  useEffect(() => {
    if (!dirty) return
    setLeaveGuard(async () => {
      const c = await askChoice('Este documento tem mudanças que não foram salvas.', { confirmLabel: 'Salvar e sair', altLabel: 'Sair sem salvar' })
      if (c === 'cancel') return false
      if (c === 'confirm') saveRef.current()
      return true
    })
    return () => setLeaveGuard(null)
  }, [dirty])

  const addItem = (group?: string) => setDoc((d) => ({ ...d, items: [...d.items, { id: uid(), title: '', group, ...(d.kind === 'diario' ? { date: today() } : {}) }] }))
  const move = (id: string, dir: -1 | 1) =>
    setDoc((d) => {
      const i = d.items.findIndex((x) => x.id === id)
      const j = i + dir
      if (j < 0 || j >= d.items.length) return d
      const items = [...d.items]
      ;[items[i], items[j]] = [items[j], items[i]]
      return { ...d, items }
    })
  const groups = [...new Set([...k.groups, ...doc.items.map((i) => i.group?.trim() ?? '').filter(Boolean)])]

  const toolbar = (
    <div className={`dk-bar ${dirty ? 'is-dirty' : ''}`}>
      <div className="dk-bar-client">
        <span className="field-label">cliente</span>
        <ClientPicker clients={data.clients} value={clientId} onChange={(id) => (setClientId(id), project && project.clientId !== id && set({ projectId: undefined }))} placeholder="de qual cliente é?" />
      </div>
      {projects.length > 0 && (
        <label className="dk-bar-client wd-bar-project">
          <span className="field-label">demanda</span>
          <select value={doc.projectId ?? ''} onChange={(e) => set({ projectId: e.target.value || undefined })}>
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {projectTag(data, p)}
              </option>
            ))}
          </select>
        </label>
      )}
      <span className="dk-bar-state small">{draft.restored && dirty ? 'rascunho recuperado' : dirty ? 'mudanças não salvas' : savedId ? 'salvo na ficha' : 'ainda não salvo'}</span>
      {savedId && (
        <button
          className="icon-btn subtle danger-text"
          title="Apagar este documento"
          aria-label="Apagar documento"
          onClick={async () => {
            if (!(await askDelete('este documento de obra'))) return
            draft.clear()
            remove('docs', savedId)
            setBaseline(snap(doc, clientId, html))
            onBack()
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      )}
      <button className="btn ghost small" onClick={() => (setDoc(initial), setHtml(saved?.html ?? null))} disabled={!dirty}>
        descartar
      </button>
      <button className="btn primary small" onClick={save} disabled={!dirty && !!savedId}>
        <Icon name="check" size={14} /> salvar
      </button>
    </div>
  )

  const form = (
    <>
      <Section title="layout">
        <div className="wd-layouts" role="radiogroup" aria-label="Layout">
          {WORK_LAYOUTS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={doc.layout === l.id} className={`wd-layout ${doc.layout === l.id ? 'is-on' : ''}`} onClick={() => set({ layout: l.id })}>
              <span className={`wd-layout-mini is-${l.id}`} aria-hidden>
                <i />
                <i />
                <i />
                <i />
              </span>
              <b>{l.label}</b>
              <small>{l.text}</small>
            </button>
          ))}
        </div>
      </Section>
      <DocLookPanel fold />
      <Section title="dados">
        <div className="form-grid">
          <Field label="Título" span={2}>
            <input value={doc.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Data">
            <DateInput value={doc.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Local da obra" span={3}>
            <input value={doc.place ?? ''} onChange={(e) => set({ place: e.target.value })} placeholder="endereço (opcional)" />
          </Field>
          {k.people && (
            <Field label={k.people} span={3}>
              <input value={doc.people ?? ''} onChange={(e) => set({ people: e.target.value })} placeholder="nomes, separados por vírgula" />
            </Field>
          )}
          <Field label="Abertura" span={3} hint="Opcional: um texto curto antes da lista.">
            <textarea rows={2} value={doc.intro ?? ''} onChange={(e) => set({ intro: e.target.value })} spellCheck lang="pt-BR" />
          </Field>
        </div>
      </Section>
      <Section
        title={`itens (${doc.items.length})`}
        action={
          <button className="btn ghost small" onClick={() => addItem(doc.items.at(-1)?.group)}>
            <Icon name="plus" size={14} /> item
          </button>
        }
      >
        {k.total && doc.items.some((i) => i.price) && (
          <p className="wd-sum small">
            total <b>{money(workTotal(doc))}</b>
            {k.doneLabel && workDone(doc) > 0 && (
              <>
                {' '}
                · {k.doneLabel} <b>{money(workDone(doc))}</b> · falta <b>{money(workTotal(doc) - workDone(doc))}</b>
              </>
            )}
          </p>
        )}
        <datalist id="wd-units">
          {['un', 'm²', 'm', 'm³', 'kg', 'cx', 'pç', 'vb'].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <datalist id="wd-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <div className="wd-items">
          {doc.items.map((i, n) => (
            <ItemEditor key={i.id} kind={doc.kind} i={i} first={n === 0} last={n === doc.items.length - 1} onChange={(p) => setItem(i.id, p)} onMove={(d) => move(i.id, d)} onCopy={() => setDoc((d) => ({ ...d, items: [...d.items.slice(0, n + 1), { ...i, id: uid() }, ...d.items.slice(n + 1)] }))} onDelete={() => setDoc((d) => ({ ...d, items: d.items.filter((x) => x.id !== i.id) }))} />
          ))}
        </div>
        <button type="button" className="wd-add" onClick={() => addItem(doc.items.at(-1)?.group)}>
          <Icon name="plus" size={15} /> mais um item
        </button>
      </Section>
      <Section title={doc.kind === 'visita' || doc.kind === 'ata' ? 'próximos passos' : 'observações'}>
        <textarea rows={3} value={doc.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} spellCheck lang="pt-BR" placeholder="Opcional." />
      </Section>
    </>
  )

  return (
    <DocWorkbench
      title={k.label}
      eyebrow="documentos de obra"
      onBack={() => void back()}
      toolbar={toolbar}
      free={html}
      onFree={setHtml}
      filename={`${k.label} - ${client?.name ?? doc.title}.pdf`}
      pageW={PAGE.a4[0]}
      pageH={PAGE.a4[1]}
      form={form}
      doc={<WorkDocView s={data.settings} doc={doc} clientName={client?.name} projectName={project?.title} />}
    />
  )
}

function ItemEditor({ kind, i, first, last, onChange, onMove, onCopy, onDelete }: { kind: WorkKind; i: WorkItem; first: boolean; last: boolean; onChange: (p: Partial<WorkItem>) => void; onMove: (d: -1 | 1) => void; onCopy: () => void; onDelete: () => void }) {
  const k = WORK_KINDS[kind]
  const file = useRef<HTMLInputElement>(null)
  const [crop, setCrop] = useState(false)
  return (
    <div className={`wd-item ${i.done ? 'is-done' : ''}`}>
      <div className="wd-item-top">
        {has(kind, 'done') && (
          <label className="wd-item-done" title={k.doneLabel}>
            <input type="checkbox" checked={!!i.done} onChange={(e) => onChange({ done: e.target.checked })} aria-label={k.doneLabel} />
          </label>
        )}
        <input className="wd-item-title" value={i.title} onChange={(e) => onChange({ title: e.target.value })} placeholder={k.titleLabel} aria-label={k.titleLabel} autoFocus={!i.title} />
        <span className="wd-item-actions">
          <button type="button" className="icon-btn subtle" disabled={first} onClick={() => onMove(-1)} aria-label="Subir">
            <Icon name="chevronL" size={13} className="rot-up" />
          </button>
          <button type="button" className="icon-btn subtle" disabled={last} onClick={() => onMove(1)} aria-label="Descer">
            <Icon name="chevronL" size={13} className="rot-down" />
          </button>
          <button type="button" className="icon-btn subtle" onClick={onCopy} aria-label="Duplicar" title="Duplicar">
            <Icon name="copy" size={13} />
          </button>
          <button type="button" className="icon-btn subtle" onClick={onDelete} aria-label="Tirar item" title="Tirar item">
            <Icon name="trash" size={13} />
          </button>
        </span>
      </div>
      <div className="wd-item-grid">
        {has(kind, 'group') && (
          <label className="field">
            <span className="field-label">{k.groupLabel}</span>
            <input list="wd-groups" value={i.group ?? ''} onChange={(e) => onChange({ group: e.target.value })} />
          </label>
        )}
        {has(kind, 'qty') && (
          <label className="field wd-qty">
            <span className="field-label">quantidade</span>
            <span className="wd-qty-row">
              <input type="number" inputMode="decimal" min={0} value={i.qty ?? ''} onChange={(e) => onChange({ qty: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <input value={i.unit ?? ''} onChange={(e) => onChange({ unit: e.target.value })} placeholder="un, m², m" aria-label="Unidade" list="wd-units" />
            </span>
          </label>
        )}
        {has(kind, 'price') && (
          <label className="field">
            <span className="field-label">{k.priceLabel ?? 'valor'}</span>
            <MoneyInput value={i.price ?? 0} onChange={(n) => onChange({ price: n || undefined })} />
          </label>
        )}
        {has(kind, 'who') && (
          <label className="field">
            <span className="field-label">{k.whoLabel}</span>
            <input value={i.who ?? ''} onChange={(e) => onChange({ who: e.target.value })} />
          </label>
        )}
        {has(kind, 'date') && (
          <label className="field">
            <span className="field-label">{k.dateLabel}</span>
            <DateInput value={i.date ?? ''} onChange={(e) => onChange({ date: e.target.value })} />
          </label>
        )}
        {has(kind, 'link') && (
          <label className="field wd-wide">
            <span className="field-label">link</span>
            <input type="url" value={i.link ?? ''} onChange={(e) => onChange({ link: e.target.value })} placeholder="site da loja ou do produto" />
          </label>
        )}
        {has(kind, 'desc') && (
          <label className="field wd-wide">
            <span className="field-label">{k.descLabel}</span>
            <textarea rows={1} value={i.desc ?? ''} onChange={(e) => onChange({ desc: e.target.value })} spellCheck lang="pt-BR" />
          </label>
        )}
      </div>
      {has(kind, 'photo') && (
        <div className="wd-item-photo">
          {i.photo ? (
            <>
              <button type="button" className="wd-photo-thumb" onClick={() => setCrop((v) => !v)} title="Enquadrar a foto">
                <img src={i.photo} alt="" />
              </button>
              <button type="button" className="link small" onClick={() => setCrop((v) => !v)}>
                {crop ? 'fechar' : 'enquadrar'}
              </button>
              <button type="button" className="link small" onClick={() => file.current?.click()}>
                trocar
              </button>
              <button type="button" className="link small" onClick={() => onChange({ photo: undefined, photoPos: undefined })}>
                tirar
              </button>
            </>
          ) : (
            <button type="button" className="btn ghost small" onClick={() => file.current?.click()}>
              <Icon name="camera" size={14} /> foto
            </button>
          )}
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                onChange({ photo: await pickImage(f, 900), photoPos: undefined })
              } catch {
                toast('Não consegui abrir esta imagem.')
              }
            }}
          />
        </div>
      )}
      {crop && i.photo && <PhotoCrop src={i.photo} pos={i.photoPos} aspect={4 / 3} onChange={(photoPos) => onChange({ photoPos })} />}
    </div>
  )
}
