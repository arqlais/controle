import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { DocScale } from '../components/Print'
import { Field, Section, Segmented } from '../components/ui'
import { ClientPicker } from '../components/ClientPicker'
import { ColorPicker } from '../components/ColorPicker'
import { DocLookPanel, DocWorkbench, ImageField, LinesField, PhotoCrop, useDocLook } from '../components/DocKit'
import { GUIDE_SHOTS, MeasureGuideDoc, guideData } from '../components/docs/MeasureGuide'
import { PLAQUE_LAYOUTS, PlaqueDoc, plaqueData, plaqueHasPhoto } from '../components/docs/Plaque'
import { BriefingSheetDoc } from '../components/docs/BriefingSheet'
import { DECK_DEFAULTS, DeckDoc } from '../components/docs/Deck'
import { PAGE } from '../components/docs/DocPage'
import { allTemplates } from '../briefingTemplates'
import { processesOf } from '../processes'
import type { DeckData, DocKind, DocsState, MeasureGuideData, PlaqueData, SavedDoc } from '../docTypes'

import { go, setLeaveGuard } from '../router'
import { SavedDocs } from '../components/SavedDocs'
import { askChoice, askDelete, toast } from '../components/dialog'
import { useFormDraft } from '../components/SaveBar'
import { uid } from '../utils'

/* Documentos do estúdio (plano Estúdio): peças prontas com a sua marca, no design escolhido
   em Configurações → propostas. Tudo editável: pelos campos ou direto na folha. */

type DocId = DocKind
const DOC_IDS: DocId[] = ['guia', 'placa', 'briefing', 'apresentacao']
const LIST: { id: DocId; title: string; text: string; size: string }[] = [
  { id: 'guia', title: 'guia de medição', text: 'o cliente mede o espaço sozinho, com desenhos explicando cada medida', size: 'A4 · 2 folhas' },
  { id: 'placa', title: 'placa de obra', text: 'quem passa na rua vê quem assina o projeto; QR code para o seu site ou instagram', size: '60×80 · 90×120 · A4' },
  { id: 'briefing', title: 'briefing em PDF', text: 'qualquer modelo de briefing para imprimir e levar na primeira reunião', size: 'A4' },
  { id: 'apresentacao', title: 'apresentação de projeto', text: 'conceito, planta, imagens, materiais e em que etapa o projeto está', size: 'slides 16:9' },
]
const titleOf = (k: DocKind) => LIST.find((x) => x.id === k)!.title
type DocValue = MeasureGuideData & PlaqueData & DeckData & { briefingTpl?: string }
const KEY: Record<DocKind, keyof DocsState | 'briefingTpl'> = { guia: 'guide', placa: 'plaque', apresentacao: 'deck', briefing: 'briefingTpl' }

export default function Documents({ id }: { id?: string }) {
  const { data } = useStore()
  // o documento aberto fica no endereço (#/documentos/placa): o menu "documentos" e o voltar do navegador levam à lista
  const saved = id ? (data.docs ?? []).find((x) => x.id === id) : undefined
  if (id && saved) return <DocSession key={saved.id} kind={saved.kind} saved={saved} onBack={() => go('documentos')} />
  if (id && (DOC_IDS as string[]).includes(id)) return <DocSession key={id} kind={id as DocId} onBack={() => go('documentos')} />
  return <DocsHome onOpen={(k) => go('documentos', k)} />
}

function useDocs() {
  const { data, setSettings } = useStore()
  const docs = data.settings.docs ?? {}
  return { s: data.settings, docs, data, setSettings }
}

/** Props de cada editor: o valor do rascunho, como mudar e o que a mesa de trabalho precisa (voltar, salvar, cliente). */
interface EdProps<T> {
  value: T | undefined
  set: (patch: Partial<T>) => void
  w: { onBack: () => void; toolbar: ReactNode; free: string | null; onFree: (h: string | null) => void }
  clientName?: string
}

/** Um documento aberto: rascunho próprio, "salvar" (na ficha do cliente ou como seu padrão) e "voltar". */
function DocSession({ kind, saved, onBack }: { kind: DocKind; saved?: SavedDoc; onBack: () => void }) {
  const { data, upsert, remove, setSettings } = useStore()
  const defaults = (): DocValue => {
    const d = data.settings.docs ?? {}
    return (kind === 'guia' ? d.guide : kind === 'placa' ? d.plaque : kind === 'apresentacao' ? d.deck : {}) ?? {}
  }
  const initial: DocValue = saved ? ((kind === 'guia' ? saved.guide : kind === 'placa' ? saved.plaque : kind === 'apresentacao' ? saved.deck : { briefingTpl: saved.briefingTpl }) ?? {}) : defaults()
  // rascunho: se a página fechar sem querer, o que foi feito volta ao abrir de novo
  const draft = useFormDraft<DocValue>(`doc:${saved?.id ?? kind}`, initial)
  const value = draft.value
  const setValue = draft.setValue
  const [clientId, setClientId] = useState(saved?.clientId ?? '')
  const [html, setHtml] = useState<string | null>(saved?.html ?? null)
  const [savedId, setSavedId] = useState(saved?.id)
  const snap = (v: DocValue, c: string, h: string | null) => JSON.stringify([v, c, h])
  const [baseline, setBaseline] = useState(() => snap(initial, saved?.clientId ?? '', saved?.html ?? null))
  const dirty = snap(value, clientId, html) !== baseline
  const client = data.clients.find((c) => c.id === clientId)
  const set = (patch: Partial<DocValue>) => setValue((v) => ({ ...v, ...patch }))
  const save = () => {
    if (clientId) {
      const now = new Date().toISOString()
      const doc: SavedDoc = {
        id: savedId ?? uid(),
        clientId,
        kind,
        title: `${titleOf(kind)}${kind === 'apresentacao' && value.title ? ` · ${value.title}` : ''}`,
        ...(kind === 'guia' ? { guide: value } : kind === 'placa' ? { plaque: value } : kind === 'apresentacao' ? { deck: value } : { briefingTpl: value.briefingTpl }),
        html: html ?? undefined,
        createdAt: saved?.createdAt ?? now,
        updatedAt: now,
      }
      upsert('docs', doc)
      setSavedId(doc.id)
      toast(`Salvo na ficha de ${client?.name.split(' ')[0] ?? 'cliente'}.`)
    } else {
      const k = KEY[kind]
      if (k !== 'briefingTpl') setSettings({ docs: { ...(data.settings.docs ?? {}), [k]: value } })
      toast('Salvo como o seu modelo padrão. Para guardar na ficha de um cliente, escolha o cliente acima.')
    }
    setBaseline(snap(value, clientId, html))
    draft.rebase(value)
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
  // sair pelo menu com mudanças: pergunta antes
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
  const pickClient = (id: string) => {
    setClientId(id)
    const c = data.clients.find((x) => x.id === id)
    if (kind === 'apresentacao' && c && !value.client) set({ client: c.name.split(' ')[0] })
  }
  const toolbar = (
    <div className={`dk-bar ${dirty ? 'is-dirty' : ''}`}>
      <div className="dk-bar-client">
        <span className="field-label">ficha do cliente</span>
        <ClientPicker clients={data.clients} value={clientId} onChange={pickClient} placeholder="salvar na ficha de qual cliente? (opcional)" />
      </div>
      <span className="dk-bar-state small">{draft.restored && dirty ? 'rascunho recuperado' : dirty ? 'mudanças não salvas' : savedId ? 'salvo na ficha' : 'tudo salvo'}</span>
      {savedId && (
        <button
          className="icon-btn subtle danger-text"
          title="Apagar este documento da ficha"
          aria-label="Apagar documento"
          onClick={async () => {
            if (!(await askDelete('este documento da ficha do cliente'))) return
            draft.clear()
            remove('docs', savedId)
            setBaseline(snap(value, clientId, html))
            onBack()
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      )}
      <button className="btn ghost small" onClick={() => (setValue(initial), setHtml(saved?.html ?? null), setClientId(saved?.clientId ?? ''))} disabled={!dirty}>
        descartar
      </button>
      <button className="btn primary small" onClick={save} disabled={!dirty && !!savedId}>
        <Icon name="check" size={14} /> salvar
      </button>
    </div>
  )
  const w = { onBack: () => void back(), toolbar, free: html, onFree: setHtml }
  const props = { value, set, w, clientName: client?.name }
  if (kind === 'guia') return <GuideEditor {...props} />
  if (kind === 'placa') return <PlaqueEditor {...props} />
  if (kind === 'briefing') return <BriefingPdfEditor {...props} />
  return <DeckEditor {...props} />
}

function DocsHome({ onOpen }: { onOpen: (id: DocId) => void }) {
  const { s, docs, data } = useDocs()
  const look = useDocLook(s)
  const thumbs: Record<DocId, { node: ReactNode; w: number }> = {
    guia: { node: <MeasureGuideDoc s={s} data={docs.guide} />, w: PAGE.a4[0] },
    placa: { node: <PlaqueDoc s={s} data={docs.plaque} />, w: PAGE.poster[0] },
    briefing: { node: <BriefingSheetDoc s={s} tpl={allTemplates(s.briefingTemplates, s.hiddenBriefings).find((t) => t.id === 'infantil') ?? allTemplates(s.briefingTemplates, s.hiddenBriefings)[0]} />, w: PAGE.a4[0] },
    apresentacao: { node: <DeckDoc s={s} data={docs.deck} stages={processesOf(s)[0]?.steps.map((x) => x.name) ?? []} />, w: PAGE.slide[0] },
  }
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">plano Estúdio</p>
          <h1>
            documentos <em>do estúdio</em>
          </h1>
        </div>
      </div>
      <p className="pf-note">
        <Icon name="sparkle" size={16} />
        <span>
          Tudo sai no design <b>“{look.name}”</b>, com as suas cores, fontes e logo. Para trocar o design de todos os PDFs de uma vez (propostas, slides e estes documentos), vá em{' '}
          <button className="link" onClick={() => go('config')}>
            configurações → propostas
          </button>
          .
        </span>
      </p>
      <div className="docs-home">
        {LIST.map((d) => (
          <button key={d.id} type="button" className="docs-card" onClick={() => onOpen(d.id)}>
            <span className="docs-thumb" aria-hidden>
              <DocScale width={thumbs[d.id].w}>{thumbs[d.id].node}</DocScale>
            </span>
            <b>{d.title}</b>
            <small>{d.text}</small>
            <small className="muted">{d.size}</small>
          </button>
        ))}
      </div>
      <SavedDocs list={data.docs ?? []} showClient />
    </div>
  )
}

/* ---------------- guia de medição ---------------- */

function GuideEditor({ value, set, w }: EdProps<MeasureGuideData>) {
  const { s } = useDocs()
  const d = guideData(value)
  const photos = value?.photos ?? []
  return (
    <DocWorkbench
      title="guia de medição"
      eyebrow="documentos"
      {...w}
      filename={`Guia de medição - ${s.brandName || s.ownerName || 'estúdio'}.pdf`}
      pageW={PAGE.a4[0]}
      pageH={PAGE.a4[1]}
      doc={<MeasureGuideDoc s={s} data={value} />}
      form={
        <>
          <DocLookPanel />
          <Section title="textos">
            <Field label="Título">
              <input value={d.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Abertura">
              <textarea rows={3} value={d.intro} onChange={(e) => set({ intro: e.target.value })} spellCheck lang="pt-BR" />
            </Field>
            <Field label="Fechamento">
              <textarea rows={2} value={d.closing} onChange={(e) => set({ closing: e.target.value })} spellCheck lang="pt-BR" />
            </Field>
          </Section>
          <Section title="passo a passo" action={<button className="btn ghost small" onClick={() => set({ steps: [...d.steps, { title: 'novo passo', text: '' }] })}><Icon name="plus" size={14} /> passo</button>}>
            {d.steps.map((x, i) => (
              <div key={i} className="stack-s dk-step-edit">
                <div className="row gap-s">
                  <b className="step-num">{String(i + 1).padStart(2, '0')}</b>
                  <textarea className="auto-grow" rows={1} value={x.title} onChange={(e) => set({ steps: d.steps.map((y, j) => (j === i ? { ...y, title: e.target.value.replace(/\n/g, ' ') } : y)) })} aria-label="Título do passo" />
                  <button className="icon-btn subtle" onClick={() => set({ steps: d.steps.filter((_, j) => j !== i) })} aria-label="Tirar passo">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <textarea rows={2} value={x.text} onChange={(e) => set({ steps: d.steps.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) })} spellCheck lang="pt-BR" aria-label="Explicação do passo" />
              </div>
            ))}
            {value?.steps?.length ? (
              <button className="link small muted-link" onClick={() => set({ steps: undefined })}>
                voltar ao texto pronto
              </button>
            ) : null}
          </Section>
          <Section title="exemplo de medição">
            <label className="check toggle">
              <input type="checkbox" checked={d.example} onChange={(e) => set({ example: e.target.checked })} /> mostrar o desenho com o exemplo de medição
            </label>
          </Section>
          <Section title="fotos que ajudam">
            <label className="check toggle">
              <input type="checkbox" checked={value?.photosOn !== false && photos.some(Boolean)} disabled={!photos.some(Boolean)} onChange={(e) => set({ photosOn: e.target.checked })} /> mostrar as fotos no guia
            </label>
            {!photos.some(Boolean) && <p className="muted small">Coloque pelo menos uma foto: sem fotos, essa parte não aparece no guia.</p>}
            <div className="dk-photo-edit">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="dk-photo-slot">
                  <ImageField
                    label={`foto ${i + 1}`}
                    value={photos[i] || undefined}
                    max={1200}
                    onChange={(v) => {
                      const next = [0, 1, 2, 3].map((k) => (k === i ? v ?? '' : photos[k] ?? ''))
                      const frames = [0, 1, 2, 3].map((k) => (k === i ? undefined : value?.photoFrames?.[k]))
                      set({ photos: next, photoFrames: frames, ...(v ? { photosOn: true } : {}) })
                    }}
                  />
                  {photos[i] && (
                    <>
                      <input
                        value={value?.shots?.[i] ?? GUIDE_SHOTS[i] ?? ''}
                        onChange={(e) => set({ shots: [0, 1, 2, 3].map((k) => (k === i ? e.target.value : value?.shots?.[k] ?? GUIDE_SHOTS[k] ?? '')) })}
                        placeholder="legenda (ex.: cada parede, de frente)"
                        aria-label={`Legenda da foto ${i + 1}`}
                      />
                      <PhotoCrop src={photos[i]} pos={value?.photoFrames?.[i]} aspect={4 / 3} onChange={(pos) => set({ photoFrames: [0, 1, 2, 3].map((k) => (k === i ? pos : value?.photoFrames?.[k])) })} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </>
      }
    />
  )
}

/* ---------------- placa de obra ---------------- */

// proporção (largura ÷ altura) do espaço da foto em cada layout, para o ajuste mostrar o mesmo recorte
const PHOTO_ASPECT: Record<string, number> = { diagonal: 3 / (0.68 * 4), retrato: (0.62 * 3) / (0.54 * 4), faixa: 3 / (0.5 * 4), moldura: 1 }

const SIZES: Record<string, string> = { '60x80': '60 × 80 cm', '90x120': '90 × 120 cm', a4: 'A4 (para testar)' }

function PlaqueEditor({ value, set, w }: EdProps<PlaqueData>) {
  const { s } = useDocs()
  const d = plaqueData(s, value)
  return (
    <DocWorkbench
      title="placa de obra"
      eyebrow="documentos"
      {...w}
      filename={`Placa de obra ${SIZES[d.size]} - ${s.brandName || s.ownerName || 'estúdio'}.pdf`}
      pageW={PAGE.poster[0]}
      pageH={PAGE.poster[1]}
      doc={<PlaqueDoc s={s} data={value} />}
      note={<p className="muted small">O PDF sai na proporção 3:4, em alta resolução. Na gráfica, peça a impressão em {SIZES[d.size]} (lona ou PVC).</p>}
      form={
        <>
          <DocLookPanel />
          <Section title="layout">
            <div className="proc-pick">
              {PLAQUE_LAYOUTS.map((l) => (
                <button key={l.id} type="button" className={`proc-card ${d.layout === l.id ? 'is-on' : ''}`} onClick={() => set({ layout: l.id })} aria-pressed={d.layout === l.id}>
                  <b>{l.name}</b>
                  <span className="muted small">{l.text}</span>
                </button>
              ))}
            </div>
            <Field group label="Tamanho da placa">
              <Segmented value={d.size} onChange={(size) => set({ size })} options={Object.entries(SIZES).map(([value, label]) => ({ value: value as PlaqueData['size'] & string, label }))} />
            </Field>
          </Section>
          <Section title="textos">
            <Field label="Chamada (1ª linha)">
              <input value={d.line1} onChange={(e) => set({ line1: e.target.value })} />
            </Field>
            <Field label="Chamada em itálico (2ª linha)">
              <input value={d.line2} onChange={(e) => set({ line2: e.target.value })} />
            </Field>
            <Field label="Nome do escritório ou arquiteta(o)">
              <input value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Registro profissional" hint="CAU, CREA ou ABD. Na obra, o registro na placa é obrigatório.">
              <input value={d.credential} onChange={(e) => set({ credential: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <input value={d.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
          </Section>
          <Section title="QR code">
            <Field label="Para onde o QR code leva" hint="Site, @instagram ou um link qualquer (portfólio, WhatsApp). O código é gerado sozinho.">
              <input value={d.link} onChange={(e) => set({ link: e.target.value })} placeholder="www.seusite.com.br ou @seuinstagram" />
            </Field>
            <Field label="Frase acima do QR code">
              <textarea className="auto-grow" rows={1} value={d.cta} onChange={(e) => set({ cta: e.target.value.replace(/\n/g, ' ') })} />
            </Field>
          </Section>
          {plaqueHasPhoto(d.layout) ? (
            <Section title="foto">
              <ImageField label="Foto do projeto ou sua" value={d.photo} onChange={(photo) => set({ photo, photoPos: undefined })} max={1800} hint="Uma imagem 3D do projeto funciona muito bem." />
              {d.photo && <PhotoCrop src={d.photo} pos={d.photoPos} aspect={PHOTO_ASPECT[d.layout]} onChange={(photoPos) => set({ photoPos })} />}
            </Section>
          ) : (
            <p className="muted small">O layout “moldura” é só tipografia, sem foto.</p>
          )}
        </>
      }
    />
  )
}

/* ---------------- briefing em PDF ---------------- */

function BriefingPdfEditor({ value, set, w, clientName }: EdProps<{ briefingTpl?: string }>) {
  const { s } = useDocs()
  const templates = allTemplates(s.briefingTemplates, s.hiddenBriefings).filter((t) => t.questions.length)
  const tpl = templates.find((t) => t.id === value?.briefingTpl) ?? templates[0]
  const setTplId = (briefingTpl: string) => set({ briefingTpl })
  if (!tpl) return null
  return (
    <DocWorkbench
      title="briefing em PDF"
      eyebrow="documentos"
      {...w}
      filename={`Briefing ${tpl.name}${clientName ? ` - ${clientName}` : ''}.pdf`}
      pageW={PAGE.a4[0]}
      pageH={PAGE.a4[1]}
      doc={<BriefingSheetDoc s={s} tpl={tpl} client={clientName} />}
      form={
        <>
          <DocLookPanel />
          <Section title="modelo">
            <Field label="Qual briefing">
              <select value={tpl.id} onChange={(e) => setTplId(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.questions.length} perguntas)
                  </option>
                ))}
              </select>
            </Field>
            <p className="muted small">
              As perguntas são as mesmas do briefing online. Para mudar alguma, edite o modelo em{' '}
              <button className="link" onClick={() => go('briefings', tpl.id)}>
                briefings
              </button>
              .
            </p>
          </Section>
          <p className="muted small">Com um cliente escolhido acima, o nome dele já sai preenchido na folha.</p>
        </>
      }
    />
  )
}

/* ---------------- apresentação de projeto ---------------- */

function DeckEditor({ value, set, w }: EdProps<DeckData>) {
  const { s, data } = useDocs()
  const deck = value ?? {}
  const d = { ...DECK_DEFAULTS, ...deck }
  const project = data.projects.find((p) => p.id === deck.projectId)
  const stages = project?.phases?.length ? project.phases.map((x) => x.name) : processesOf(s)[0]?.steps.map((x) => x.name) ?? []
  const current = deck.stage ?? (project?.phases?.length ? Math.max(0, project.phases.findIndex((x) => !x.done)) : 2)
  const renders = deck.renders ?? []
  const mood = deck.mood ?? []
  const pickProject = (id: string) => {
    const p = data.projects.find((x) => x.id === id)
    const c = data.clients.find((x) => x.id === p?.clientId)
    set({ projectId: id || undefined, ...(p ? { title: p.title, client: c?.name.split(' ')[0] ?? '', stage: undefined } : {}) })
  }
  return (
    <DocWorkbench
      title="apresentação de projeto"
      eyebrow="documentos"
      {...w}
      filename={`Apresentação ${d.title}${d.client ? ` - ${d.client}` : ''}.pdf`}
      pageW={PAGE.slide[0]}
      pageH={PAGE.slide[1]}
      doc={<DeckDoc s={s} data={{ ...deck, stage: current }} stages={stages} />}
      form={
        <>
          <DocLookPanel />
          <Section title="projeto">
            <Field label="Demanda (opcional)" hint="Puxa o nome do projeto, o cliente e as etapas do cronograma.">
              <select value={deck.projectId ?? ''} onChange={(e) => pickProject(e.target.value)}>
                <option value="">nenhuma</option>
                {data.projects
                  .filter((p) => p.status !== 'cancelado')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · {data.clients.find((c) => c.id === p.clientId)?.name ?? ''}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Título">
              <input value={d.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label="Fase">
                <input value={d.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
              </Field>
              <Field label="Para (cliente)">
                <input value={d.client ?? ''} onChange={(e) => set({ client: e.target.value })} />
              </Field>
            </div>
            <ImageField label="Imagem da capa" value={deck.cover} onChange={(cover) => set({ cover, coverPos: undefined })} max={1400} aspect={1.1} pos={deck.coverPos} onPos={(coverPos) => set({ coverPos })} />
          </Section>
          <Section title="ponto de partida e conceito">
            <LinesField label="O que o cliente pediu (um por linha)" value={d.brief} onChange={(brief) => set({ brief })} />
            <Field label="Conceito">
              <textarea rows={3} value={d.concept} onChange={(e) => set({ concept: e.target.value })} spellCheck lang="pt-BR" />
            </Field>
            {[0, 1, 2, 3].map((i) => (
              <ImageField
                key={i}
                label={`moodboard ${i + 1}`}
                value={mood[i] || undefined}
                max={900}
                aspect={4 / 3}
                pos={deck.moodPos?.[i]}
                onPos={(p) => set({ moodPos: [0, 1, 2, 3].map((k) => (k === i ? p : deck.moodPos?.[k])) })}
                onChange={(v) => set({ mood: [0, 1, 2, 3].map((k) => (k === i ? v ?? '' : mood[k] ?? '')), moodPos: [0, 1, 2, 3].map((k) => (k === i ? undefined : deck.moodPos?.[k])) })}
              />
            ))}
          </Section>
          <Section title="planta">
            <ImageField label="Planta de layout" value={deck.plan?.src} max={1600} onChange={(src) => set({ plan: src ? { ...deck.plan, src, pos: undefined } : undefined })} aspect={16 / 10} defaultFit pos={deck.plan?.pos} onPos={(pos) => deck.plan && set({ plan: { ...deck.plan, pos } })} />
            <LinesField label="Destaques da planta (um por linha)" value={d.planNotes} onChange={(planNotes) => set({ planNotes })} />
          </Section>
          <Section title="imagens do projeto">
            {renders.map((r, i) => (
              <div key={i} className="dk-render-row">
                <PhotoCrop src={r.src} pos={r.pos} aspect={16 / 10} onChange={(pos) => set({ renders: renders.map((x, j) => (j === i ? { ...x, pos } : x)) })} />
                <input value={r.caption ?? ''} placeholder="legenda (ex.: sala de estar)" onChange={(e) => set({ renders: renders.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })} />
                <button className="icon-btn subtle" onClick={() => set({ renders: renders.filter((_, j) => j !== i) })} aria-label="Tirar imagem">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
            {renders.length < 6 && <ImageField label={renders.length ? 'mais uma imagem' : 'imagens 3D ou fotos (até 6)'} max={1400} onChange={(src) => src && set({ renders: [...renders, { src }] })} />}
          </Section>
          <Section title="materiais e paleta">
            {d.materials.map((m, i) => (
              <div key={i} className="dk-mat-row">
                <ColorPicker value={m.color} onChange={(color) => set({ materials: d.materials.map((x, j) => (j === i ? { ...x, color } : x)) })} />
                <input value={m.name} onChange={(e) => set({ materials: d.materials.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="Nome do material" />
                <button className="icon-btn subtle" onClick={() => set({ materials: d.materials.filter((_, j) => j !== i) })} aria-label="Tirar">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
            {d.materials.length < 6 && (
              <button className="btn ghost small" onClick={() => set({ materials: [...d.materials, { name: 'novo material', color: '#cccccc' }] })}>
                <Icon name="plus" size={14} /> material
              </button>
            )}
          </Section>
          <Section title="onde estamos e próximos passos">
            <Field label="Etapa atual" hint={project?.phases?.length ? 'As etapas vêm do cronograma da demanda.' : 'As etapas vêm do seu primeiro processo (etapas de trabalho).'}>
              <select value={current} onChange={(e) => set({ stage: Number(e.target.value) })}>
                {stages.map((x, i) => (
                  <option key={i} value={i}>
                    {String(i + 1).padStart(2, '0')} · {x}
                  </option>
                ))}
              </select>
            </Field>
            <LinesField label="Próximos passos (um por linha)" value={d.next} onChange={(next) => set({ next })} />
            <Field label="Agradecimento">
              <input value={d.thanks} onChange={(e) => set({ thanks: e.target.value })} />
            </Field>
          </Section>
          <p className="muted small">As imagens ficam guardadas na sua conta (diminuídas) para abrir de novo depois.</p>
        </>
      }
    />
  )
}
