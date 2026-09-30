import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { useKeep } from '../keep'
import { Icon } from '../components/Icon'
import { DocScale } from '../components/Print'
import { Field, Section, Segmented } from '../components/ui'
import { ClientPicker } from '../components/ClientPicker'
import { DocWorkbench, ImageField, LinesField, useDocLook } from '../components/DocKit'
import { MeasureGuideDoc, guideData } from '../components/docs/MeasureGuide'
import { PLAQUE_LAYOUTS, PlaqueDoc, plaqueData } from '../components/docs/Plaque'
import { BriefingSheetDoc } from '../components/docs/BriefingSheet'
import { DECK_DEFAULTS, DeckDoc } from '../components/docs/Deck'
import { PAGE } from '../components/docs/DocPage'
import { allTemplates } from '../briefingTemplates'
import { processesOf } from '../processes'
import type { DeckData, DocsState, MeasureGuideData, PlaqueData } from '../docTypes'

import { go } from '../router'

/* Documentos do estúdio (plano Estúdio): peças prontas com a sua marca, no design escolhido
   em Configurações → propostas. Tudo editável: pelos campos ou direto na folha. */

type DocId = 'guia' | 'placa' | 'briefing' | 'apresentacao'
const LIST: { id: DocId; title: string; text: string; size: string }[] = [
  { id: 'guia', title: 'guia de medição', text: 'o cliente mede o espaço sozinho, com desenhos explicando cada medida', size: 'A4 · 2 folhas' },
  { id: 'placa', title: 'placa de obra', text: 'quem passa na rua vê quem assina o projeto; QR code para o seu site ou instagram', size: '60×80 · 90×120 · A4' },
  { id: 'briefing', title: 'briefing em PDF', text: 'qualquer modelo de briefing para imprimir e levar na primeira reunião', size: 'A4' },
  { id: 'apresentacao', title: 'apresentação de projeto', text: 'conceito, planta, imagens, materiais e em que etapa o projeto está', size: 'slides 16:9' },
]

export default function Documents() {
  const [open, setOpen] = useKeep<DocId | ''>('documento-aberto', '')
  if (open === 'guia') return <GuideEditor onBack={() => setOpen('')} />
  if (open === 'placa') return <PlaqueEditor onBack={() => setOpen('')} />
  if (open === 'briefing') return <BriefingPdfEditor onBack={() => setOpen('')} />
  if (open === 'apresentacao') return <DeckEditor onBack={() => setOpen('')} />
  return <DocsHome onOpen={setOpen} />
}

function useDocs() {
  const { data, setSettings } = useStore()
  const docs = data.settings.docs ?? {}
  const save = <K extends keyof DocsState>(k: K, patch: Partial<NonNullable<DocsState[K]>>) => setSettings({ docs: { ...docs, [k]: { ...docs[k], ...patch } } })
  return { s: data.settings, docs, save, data }
}

function DocsHome({ onOpen }: { onOpen: (id: DocId) => void }) {
  const { s, docs } = useDocs()
  const look = useDocLook(s)
  const thumbs: Record<DocId, { node: ReactNode; w: number }> = {
    guia: { node: <MeasureGuideDoc s={s} data={docs.guide} />, w: PAGE.a4[0] },
    placa: { node: <PlaqueDoc s={s} data={docs.plaque} />, w: PAGE.poster[0] },
    briefing: { node: <BriefingSheetDoc s={s} tpl={allTemplates(s.briefingTemplates).find((t) => t.id === 'infantil') ?? allTemplates(s.briefingTemplates)[0]} />, w: PAGE.a4[0] },
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
    </div>
  )
}

/* ---------------- guia de medição ---------------- */

function GuideEditor({ onBack }: { onBack: () => void }) {
  const { s, docs, save } = useDocs()
  const d = guideData(docs.guide)
  const set = (patch: Partial<MeasureGuideData>) => save('guide', patch)
  const photos = docs.guide?.photos ?? []
  return (
    <DocWorkbench
      title="guia de medição"
      eyebrow="documentos"
      onBack={onBack}
      filename={`Guia de medição - ${s.brandName || s.ownerName || 'estúdio'}.pdf`}
      pageW={PAGE.a4[0]}
      pageH={PAGE.a4[1]}
      doc={<MeasureGuideDoc s={s} data={docs.guide} />}
      form={
        <>
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
                  <input value={x.title} onChange={(e) => set({ steps: d.steps.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)) })} aria-label="Título do passo" />
                  <button className="icon-btn subtle" onClick={() => set({ steps: d.steps.filter((_, j) => j !== i) })} aria-label="Tirar passo">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <textarea rows={2} value={x.text} onChange={(e) => set({ steps: d.steps.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) })} spellCheck lang="pt-BR" aria-label="Explicação do passo" />
              </div>
            ))}
            {docs.guide?.steps?.length ? (
              <button className="link small muted-link" onClick={() => set({ steps: undefined })}>
                voltar ao texto pronto
              </button>
            ) : null}
          </Section>
          <Section title="exemplo">
            <label className="check">
              <input type="checkbox" checked={d.example} onChange={(e) => set({ example: e.target.checked })} /> mostrar a página com o exemplo de medição
            </label>
            {[0, 1, 2].map((i) => (
              <ImageField key={i} label={`foto de exemplo ${i + 1} (opcional)`} value={photos[i]} max={900} onChange={(v) => set({ photos: [0, 1, 2].map((k) => (k === i ? v ?? '' : photos[k] ?? '')).filter((x, k, arr) => x || arr.slice(k + 1).some(Boolean)) })} />
            ))}
          </Section>
        </>
      }
    />
  )
}

/* ---------------- placa de obra ---------------- */

const SIZES: Record<string, string> = { '60x80': '60 × 80 cm', '90x120': '90 × 120 cm', a4: 'A4 (para testar)' }

function PlaqueEditor({ onBack }: { onBack: () => void }) {
  const { s, docs, save } = useDocs()
  const d = plaqueData(s, docs.plaque)
  const set = (patch: Partial<PlaqueData>) => save('plaque', patch)
  return (
    <DocWorkbench
      title="placa de obra"
      eyebrow="documentos"
      onBack={onBack}
      filename={`Placa de obra ${SIZES[d.size]} - ${s.brandName || s.ownerName || 'estúdio'}.pdf`}
      pageW={PAGE.poster[0]}
      pageH={PAGE.poster[1]}
      doc={<PlaqueDoc s={s} data={docs.plaque} />}
      note={<p className="muted small">O PDF sai na proporção 3:4, em alta resolução. Na gráfica, peça a impressão em {SIZES[d.size]} (lona ou PVC).</p>}
      form={
        <>
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
              <input value={d.cta} onChange={(e) => set({ cta: e.target.value })} />
            </Field>
          </Section>
          <Section title="foto">
            <ImageField label="Foto do projeto ou sua" value={d.photo} onChange={(photo) => set({ photo })} max={1800} hint="Uma imagem 3D do projeto funciona muito bem. No layout “moldura” a foto não aparece." />
          </Section>
        </>
      }
    />
  )
}

/* ---------------- briefing em PDF ---------------- */

function BriefingPdfEditor({ onBack }: { onBack: () => void }) {
  const { s, data } = useDocs()
  const templates = allTemplates(s.briefingTemplates).filter((t) => t.questions.length)
  const [tplId, setTplId] = useKeep('briefing-pdf-modelo', templates[0]?.id ?? '')
  const [clientId, setClientId] = useState('')
  const tpl = templates.find((t) => t.id === tplId) ?? templates[0]
  const client = data.clients.find((c) => c.id === clientId)
  if (!tpl) return null
  return (
    <DocWorkbench
      title="briefing em PDF"
      eyebrow="documentos"
      onBack={onBack}
      filename={`Briefing ${tpl.name}${client ? ` - ${client.name}` : ''}.pdf`}
      pageW={PAGE.a4[0]}
      pageH={PAGE.a4[1]}
      doc={<BriefingSheetDoc s={s} tpl={tpl} client={client?.name} />}
      form={
        <>
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
          <Section title="cliente (opcional)">
            <ClientPicker clients={data.clients} value={clientId} onChange={setClientId} placeholder="em branco: a pessoa escreve à mão" />
          </Section>
        </>
      }
    />
  )
}

/* ---------------- apresentação de projeto ---------------- */

function DeckEditor({ onBack }: { onBack: () => void }) {
  const { s, docs, save, data } = useDocs()
  const deck = docs.deck ?? {}
  const d = { ...DECK_DEFAULTS, ...deck }
  const set = (patch: Partial<DeckData>) => save('deck', patch)
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
      onBack={onBack}
      filename={`Apresentação ${d.title}${d.client ? ` - ${d.client}` : ''}.pdf`}
      pageW={PAGE.slide[0]}
      pageH={PAGE.slide[1]}
      doc={<DeckDoc s={s} data={{ ...deck, stage: current }} stages={stages} />}
      form={
        <>
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
            <ImageField label="Imagem da capa" value={deck.cover} onChange={(cover) => set({ cover })} max={1400} />
          </Section>
          <Section title="ponto de partida e conceito">
            <LinesField label="O que o cliente pediu (um por linha)" value={d.brief} onChange={(brief) => set({ brief })} />
            <Field label="Conceito">
              <textarea rows={3} value={d.concept} onChange={(e) => set({ concept: e.target.value })} spellCheck lang="pt-BR" />
            </Field>
            {[0, 1, 2, 3].map((i) => (
              <ImageField key={i} label={`moodboard ${i + 1}`} value={mood[i]} max={900} onChange={(v) => set({ mood: [0, 1, 2, 3].map((k) => (k === i ? v ?? '' : mood[k] ?? '')).filter(Boolean) })} />
            ))}
          </Section>
          <Section title="planta">
            <ImageField label="Planta de layout" value={deck.plan?.src} max={1600} onChange={(src) => set({ plan: src ? { ...deck.plan, src } : undefined })} />
            <LinesField label="Destaques da planta (um por linha)" value={d.planNotes} onChange={(planNotes) => set({ planNotes })} />
          </Section>
          <Section title="imagens do projeto">
            {renders.map((r, i) => (
              <div key={i} className="dk-render-row">
                <img src={r.src} alt="" />
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
                <input type="color" value={m.color} onChange={(e) => set({ materials: d.materials.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)) })} aria-label="Cor" />
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
