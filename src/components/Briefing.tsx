import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import { applyAnswers, askNotifyPermission, useBriefingSync } from '../briefingSync'
import { useStore } from '../store'
import { useAccess } from '../access'
import { Icon } from './Icon'
import { Badge, Modal, Section } from './ui'
import { askDelete, toast } from './dialog'
import { BRIEFING_SECTIONS } from '../briefingQuestions'
import { allTemplates, templateGroup } from '../briefingTemplates'
import { attachmentUrls, briefingLink, briefingShortLink, deleteBriefingLink, loadPublicBriefing, packBriefing, publishBriefing, sendPublicAnswers, uploadAttachment, type BriefingPayload, type PublicBriefing } from '../briefingApi'
import type { Briefing, BriefingAnswers, BriefingQuestion, BriefingSection as BSection, BriefingTemplate, Client, Settings } from '../types'
import { ANSWER_TAG, findAnswerCode, hashExtra, readShortCode, shortCode } from '../linkPack'
import { ArtImage, isArt } from './BriefingArt'
import { ClientPicker } from './ClientPicker'
import { fmtDate, matches, today, whatsappLink } from '../utils'
import { go } from '../router'
import { PLANS } from '../plans'

const BriefingPdfButton = lazy(() => import('./BriefingPdf'))

/* Briefing online do cliente final: o arquiteto escolhe os blocos de perguntas, manda o link
   (WhatsApp ou copiar) e as respostas voltam sozinhas para a ficha do cliente. */

/** "Família Souza" → "Família Souza"; "Maria Souza" → "Maria". */
const greetName = (name: string) => (/^fam[ií]lia\b/i.test(name.trim()) ? name.trim() : name.trim().split(' ')[0])
const answerText = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : (v ?? '')).trim()

/** Link que vai para o cliente: o curto (arquivo na nuvem) ou o que leva a cópia dentro. */
export const linkOf = (b: Briefing) => (b.short ? briefingShortLink(b.short) : briefingLink(b.id, b.pack))

/** O que vai para a página do cliente (e, compacto, dentro do link). */
export function briefingPayload(st: Settings, tpl: Pick<BriefingTemplate, 'name' | 'questions' | 'sections'>, clientName: string): BriefingPayload {
  return {
    title: tpl.name,
    clientName,
    studio: st.brandName || st.ownerName || '',
    owner: st.ownerName || '',
    accent: st.accent,
    logo: st.logo && st.logo.length < 250_000 ? st.logo : undefined,
    intro: `Oi, ${greetName(clientName)}! Estas perguntas me ajudam a entender o que vocês precisam e como vivem. Responda com calma: não existe resposta certa, e dá para pular o que não souber.`,
    questions: tpl.questions,
    sections: tpl.sections,
    phone: st.phone || undefined,
    email: st.email || undefined,
  }
}

/** Seções de um briefing (os antigos usam as seções fixas). */
const sectionsOf = (b: { sections?: BSection[]; questions: BriefingQuestion[] }): BSection[] => {
  const base = b.sections?.length ? b.sections : BRIEFING_SECTIONS.map((x) => ({ id: x.id, title: x.label, description: x.hint }))
  const extra = b.questions.some((q) => !base.some((x) => x.id === (q.section || 'extra'))) ? [{ id: 'extra', title: 'mais algumas perguntas' }] : []
  return [...base, ...extra].filter((x) => b.questions.some((q) => (base.some((y) => y.id === q.section) ? q.section : 'extra') === x.id))
}
const inSection = (b: { sections?: BSection[]; questions: BriefingQuestion[] }, id: string) => {
  const base = b.sections?.length ? b.sections : BRIEFING_SECTIONS.map((x) => ({ id: x.id }))
  return b.questions.filter((q) => (base.some((y) => y.id === q.section) ? q.section : 'extra') === id)
}

export function BriefingSection({ client }: { client: Client }) {
  const { data } = useStore()
  const { has } = useAccess()
  const [creating, setCreating] = useState(false)
  const list = (data.briefings ?? []).filter((b) => b.clientId === client.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const allowed = has('briefing')
  return (
    <Section
      title="briefing"
      action={
        allowed && (
          <button className="btn small" onClick={() => setCreating(true)}>
            <Icon name="plus" size={14} /> {list.length ? 'novo' : 'mandar briefing'}
          </button>
        )
      }
    >
      {!allowed ? (
        <p className="muted small">
          O briefing online (o cliente responde pelo celular, com fotos, e tudo cai aqui) faz parte do plano {PLANS.estudio.name}.{' '}
          <button className="link" onClick={() => go('assinatura')}>
            conhecer
          </button>
        </p>
      ) : list.length === 0 ? (
        <p className="muted small">Escolha um modelo (residencial, comercial, cozinha…) e mande o link: o cliente responde pelo celular, sem criar conta, e as respostas preenchem a ficha.</p>
      ) : (
        <BriefingList list={list} openFirst />
      )}
      {creating && <NewBriefing client={client} onClose={() => setCreating(false)} />}
    </Section>
  )
}

/** Lista de briefings enviados (na ficha do cliente e na tela de briefings). */
export function BriefingList({ list, showClient, openFirst }: { list: Briefing[]; showClient?: boolean; openFirst?: boolean }) {
  const { data, remove, userId } = useStore()
  // na ficha do cliente, o briefing respondido mais recente já abre com as respostas
  const [open, setOpen] = useState<string | null>(openFirst ? list.find((b) => b.status === 'respondido')?.id ?? null : null)
  const [paste, setPaste] = useState<Briefing | null>(null)
  const [peek, setPeek] = useState<Briefing | null>(null)
  const { check } = useBriefingSync(false)
  return (
    <ul className="bf-list">
      {list.map((b) => {
        const client = data.clients.find((c) => c.id === b.clientId)
        return (
          <li key={b.id} className="bf-item">
            <div className="bf-row">
              <span className="grow">
                <b>{b.title}</b>
                <small className="muted">
                  {showClient && client ? ` · ${client.name}` : ''} · enviado {fmtDate(b.createdAt)}
                  {b.answeredAt ? ` · respondido ${fmtDate(b.answeredAt.slice(0, 10))}` : ''}
                </small>
              </span>
              <Badge color={b.status === 'respondido' ? '#5e8c6a' : '#b98246'}>{b.status === 'respondido' ? 'respondido' : 'aguardando'}</Badge>
            </div>
            <div className="row gap-s wrap">
              {b.status === 'respondido' ? (
                <button className="btn small" onClick={() => setOpen(open === b.id ? null : b.id)}>
                  <Icon name="file" size={14} /> {open === b.id ? 'fechar respostas' : 'ver respostas'}
                </button>
              ) : (
                <>
                  {client && <ShareButtons client={client} b={b} />}
                  <button className="btn small ghost" onClick={() => void check()}>
                    <Icon name="inbox" size={14} /> conferir respostas
                  </button>
                  <button className="btn small ghost" onClick={() => setPaste(b)} title="Quando o cliente manda as respostas pelo WhatsApp">
                    <Icon name="whatsapp" size={14} /> colar respostas
                  </button>
                </>
              )}
              <button className="icon-btn subtle" aria-label="Ver como o cliente" title="Ver como o cliente" onClick={() => setPeek(b)}>
                <Icon name="eye" size={15} />
              </button>
              <button
                className="icon-btn subtle"
                aria-label="Apagar briefing"
                onClick={async () => {
                  if (!(await askDelete(`o briefing "${b.title}"`))) return
                  void deleteBriefingLink(b.id, userId).catch(() => undefined)
                  remove('briefings', b.id)
                }}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
            {open === b.id && <Answers b={b} />}
          </li>
        )
      })}
      {paste && <PasteAnswers b={paste} onClose={() => setPaste(null)} />}
      {peek && <BriefingPreview tpl={{ name: peek.title.split(' · ')[0], questions: peek.questions, sections: peek.sections ?? [] }} clientName={data.clients.find((c) => c.id === peek.clientId)?.name} onClose={() => setPeek(null)} />}
    </ul>
  )
}

/** Respostas que chegaram pelo WhatsApp (plano B): cola a mensagem, o código devolve tudo para a ficha. */
function PasteAnswers({ b, onClose }: { b: Briefing; onClose: () => void }) {
  const { data, upsert } = useStore()
  const [text, setText] = useState('')
  const apply = async () => {
    const code = findAnswerCode(text)
    if (!code) return toast(`Não achei o “${ANSWER_TAG}” na mensagem. Cole a mensagem inteira que o cliente mandou.`)
    const { unpack } = await import('../linkPack')
    const got = await unpack<{ id: string; a: BriefingAnswers }>(code)
    if (!got) return toast('O código veio incompleto. Peça para o cliente copiar a mensagem inteira de novo.')
    if (got.id !== b.id && !(await import('./dialog').then((m) => m.ask('Este código é de outro briefing. Usar mesmo assim?')))) return
    upsert('briefings', { ...b, status: 'respondido', answers: got.a, answeredAt: new Date().toISOString() })
    const c = data.clients.find((x) => x.id === b.clientId)
    if (c) upsert('clients', applyAnswers(c, b, got.a))
    toast('Respostas guardadas na ficha do cliente.')
    onClose()
  }
  return (
    <Modal
      title="colar respostas do WhatsApp"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>cancelar</button>
          <button className="btn primary" onClick={() => void apply()} disabled={!text.trim()}>guardar respostas</button>
        </>
      }
    >
      <p className="muted small">Quando a internet do cliente não deixa salvar, a página monta uma mensagem com as respostas e um código no final. Cole a mensagem inteira aqui.</p>
      <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Olá! Aqui estão as minhas respostas…\n\n${ANSWER_TAG} z…`} />
    </Modal>
  )
}

function ShareButtons({ client, b }: { client: Client; b: Briefing }) {
  const { data } = useStore()
  const link = linkOf(b)
  const first = greetName(client.name)
  const msg = `Olá, ${first}! Para eu entender direitinho o que vocês precisam, preparei algumas perguntas. Dá para responder pelo celular, com calma, e mandar fotos: ${link}\n\n${data.settings.ownerName || ''}`.trim()
  return (
    <>
      {client.phone && (
        <a className="btn small primary" href={whatsappLink(client.phone, msg)} target="_blank" rel="noreferrer">
          <Icon name="whatsapp" size={14} /> mandar no WhatsApp
        </a>
      )}
      <button
        className="btn small"
        onClick={() =>
          navigator.clipboard
            ?.writeText(link)
            .then(() => toast('Link do briefing copiado.'))
            .catch(() => toast(link))
        }
      >
        <Icon name="link" size={14} /> copiar link
      </button>
    </>
  )
}

function Answers({ b }: { b: Briefing }) {
  const a = b.answers ?? {}
  const [urls, setUrls] = useState<Record<string, string>>({})
  const photos = b.questions.filter((q) => q.kind === 'photos').flatMap((q) => (Array.isArray(a[q.id]) ? (a[q.id] as string[]) : []))
  useEffect(() => {
    if (photos.length) attachmentUrls(photos).then(setUrls).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.join('|')])
  const skipped = b.questions.filter((q) => !answerText(a[q.id])).length
  const text = sectionsOf(b)
    .map((s) => {
      const list = inSection(b, s.id).filter((q) => q.kind !== 'photos' && answerText(a[q.id]))
      return list.length ? `${s.title.toUpperCase()}\n${list.map((q) => `${q.label}: ${answerText(a[q.id])}`).join('\n')}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
  return (
    <div className="bf-answers">
      {sectionsOf(b).map((s) => {
        const list = inSection(b, s.id).filter((q) => answerText(a[q.id]))
        if (!list.length) return null
        return (
          <div key={s.id}>
            <p className="bf-sec">{s.title}</p>
            <dl className="bf-qa-list">
              {list.map((q) => (
                <div key={q.id} className="bf-qa">
                  <dt>{q.label}</dt>
                  <dd>
                    {q.kind === 'photos' ? (
                      <span className="bf-thumbs">
                        {(a[q.id] as string[]).map((v) => (
                          <a key={v} href={urls[v]} target="_blank" rel="noreferrer">
                            {urls[v] ? <img src={urls[v]} alt="" /> : <span />}
                          </a>
                        ))}
                      </span>
                    ) : q.kind === 'date' ? (
                      fmtDate(answerText(a[q.id]))
                    ) : (
                      answerText(a[q.id])
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
      {skipped > 0 && <p className="muted small">{skipped} pergunta(s) ficaram sem resposta.</p>}
      <div className="row gap-s wrap">
      <Suspense fallback={null}>
        <BriefingPdfButton b={b} />
      </Suspense>
      <button
        className="btn small ghost"
        onClick={() =>
          navigator.clipboard
            ?.writeText(text)
            .then(() => toast('Respostas copiadas.'))
            .catch(() => undefined)
        }
      >
        <Icon name="copy" size={14} /> copiar respostas
      </button>
      </div>
    </div>
  )
}

/** Mandar um briefing: escolhe o modelo e o link sai pronto. */
export function NewBriefing({ client: fixed, templateId, onClose }: { client?: Client; templateId?: string; onClose: () => void }) {
  const { data, upsert, userId } = useStore()
  const st = data.settings
  const templates = allTemplates(st.briefingTemplates, st.hiddenBriefings)
  const [tplId, setTplId] = useState(templateId ?? '')
  const [find, setFind] = useState('')
  const [group, setGroup] = useState<'todos' | 'casa' | 'comercial' | 'meus'>('todos')
  const shown = templates.filter((t) => (group === 'todos' || templateGroup(t) === group) && matches(find, t.name, t.description))
  const [clientId, setClientId] = useState(fixed?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Briefing | null>(null)
  const tpl = templates.find((t) => t.id === tplId)
  const client = fixed ?? data.clients.find((c) => c.id === clientId)

  const create = async () => {
    askNotifyPermission() // para avisar no aparelho quando o cliente responder
    if (!tpl || !client) return
    if (!tpl.questions.length) return toast('Este modelo ainda não tem perguntas. Edite em “briefings”.')
    setBusy(true)
    const payload = briefingPayload(st, tpl, client.name)
    const b: Briefing = { id: crypto.randomUUID(), clientId: client.id, title: `${tpl.name} · ${client.name}`, questions: tpl.questions, sections: tpl.sections, templateId: tpl.id, status: 'enviado', createdAt: today() }
    // cópia dentro do link: abre mesmo se a nuvem falhar
    try {
      b.pack = await packBriefing(payload)
    } catch {
      /* segue só com a nuvem */
    }
    let res: { table: boolean; file: boolean } | null = null
    try {
      res = await publishBriefing(b.id, payload, userId)
    } catch {
      res = null
    }
    // link curto quando o arquivo público foi publicado; senão, o link leva a cópia (abre sempre)
    if (res?.file && userId) b.short = shortCode(userId, b.id) || undefined
    if (!res && !b.pack) {
      setBusy(false)
      return toast('Não foi possível criar o link agora. Confira a internet e tente de novo.')
    }
    upsert('briefings', b)
    setDone(b)
    setBusy(false)
  }
  const [peek, setPeek] = useState(false)

  if (done && client)
    return (
      <Modal title="briefing pronto" onClose={onClose}>
        <p>Agora é só mandar o link para {greetName(client.name)}. Quando responder, você recebe um aviso e as respostas preenchem a ficha.</p>
        <p className="bf-link">{linkOf(done)}</p>
        <div className="row gap-s wrap">
          <ShareButtons client={client} b={done} />
        </div>
      </Modal>
    )

  return (
    <Modal
      title="mandar briefing"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            cancelar
          </button>
          <button className="btn ghost" onClick={() => setPeek(true)} disabled={!tpl || !tpl.questions.length}>
            <Icon name="eye" size={14} /> pré-visualizar
          </button>
          <button className="btn primary" onClick={() => void create()} disabled={busy || !tpl || !client}>
            {busy ? 'criando…' : tpl ? `criar link (${tpl.questions.length} perguntas)` : 'escolha um modelo'}
          </button>
        </>
      }
    >
      {!fixed && (
        <div className="bf-pick-client">
          <span className="field-label">para quem</span>
          <ClientPicker clients={data.clients} value={clientId} onChange={setClientId} />
        </div>
      )}
      <span className="field-label">qual modelo</span>
      <div className="bf-tpl-filter">
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="procurar: cozinha, clínica, closet…" aria-label="Procurar modelo" />
        <div className="chips">
          {(['todos', 'casa', 'comercial', 'meus'] as const).map((g) => (
            <button key={g} type="button" className={`chip ${group === g ? 'active' : ''}`} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
      </div>
      <div className="bf-tpl-grid">
        {shown.length === 0 && <p className="muted small">Nenhum modelo com esse nome. Dá para criar o seu em “briefings”.</p>}
        {shown.map((t) => (
          <button key={t.id} type="button" className={`bf-tpl ${tplId === t.id ? 'is-on' : ''}`} onClick={() => setTplId(t.id)} aria-pressed={tplId === t.id}>
            <span className="bf-tpl-icon">
              <Icon name={t.icon || 'file'} size={18} />
            </span>
            <b>{t.name}</b>
            <small>{t.description}</small>
            <em>{t.questions.length} perguntas</em>
          </button>
        ))}
      </div>
      <p className="muted small">
        Quer mudar alguma pergunta antes? Edite o modelo em{' '}
        <button className="link" onClick={() => (onClose(), go('briefings', tplId || undefined))}>
          briefings
        </button>
        : vale para os próximos envios.
      </p>
      {peek && tpl && <BriefingPreview tpl={tpl} clientName={client?.name} onClose={() => setPeek(false)} />}
    </Modal>
  )
}

/* ---------------- página pública (o cliente final responde) ---------------- */

/** Sub-pergunta aparece só quando a pergunta de cima tem aquela resposta. */
const answerHas = (v: string | string[] | undefined, is: string) => (Array.isArray(v) ? v.includes(is) : v === is)
export const visibleQuestions = (qs: BriefingQuestion[], a: BriefingAnswers) => qs.filter((q) => !q.showIf || answerHas(a[q.showIf.q], q.showIf.is ?? q.showIf.value ?? ''))

/** Respostas em texto (WhatsApp / copiar), com o código que devolve tudo para o sistema. */
function answersMessage(p: BriefingPayload, a: BriefingAnswers, code: string) {
  const qs = visibleQuestions(p.questions, a)
  const body = sectionsOf(p)
    .map((s) => {
      const list = inSection({ ...p, questions: qs }, s.id).filter((q) => q.kind !== 'photos' && answerText(a[q.id]))
      return list.length ? `*${s.title.toUpperCase()}*\n${list.map((q) => `• ${q.label}: ${q.kind === 'date' ? fmtDate(answerText(a[q.id])) : answerText(a[q.id])}`).join('\n')}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
  const photos = qs.some((q) => q.kind === 'photos')
  return `Olá${p.owner ? `, ${p.owner.split(' ')[0]}` : ''}! Aqui estão as minhas respostas do briefing "${p.title}" (${p.clientName}):\n\n${body}${photos ? '\n\n📷 As fotos eu mando aqui na conversa.' : ''}\n\n${ANSWER_TAG} ${code}`
}

export function BriefingPublic({ id: raw, short }: { id: string; short?: boolean }) {
  // link curto (/#/b/conta.briefing) ou o de sempre (/#/briefing/id/cópia)
  const code = short ? readShortCode(raw) : null
  const id = code?.id ?? raw
  const [b, setB] = useState<PublicBriefing | null | undefined>(undefined)
  useEffect(() => {
    loadPublicBriefing(id, short ? '' : hashExtra(), code?.userId).then(setB, () => setB(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  const accent = b?.payload.accent || '#a88a80'
  if (b === undefined) return <PublicShell accent={accent}><p className="muted">carregando…</p></PublicShell>
  if (b === null) return <PublicShell accent={accent}><p>Não encontrei este briefing. Confira se o link veio inteiro (às vezes o WhatsApp corta) ou peça um novo para quem te enviou.</p></PublicShell>
  return <BriefingForm id={id} data={b} />
}

function PublicShell({ accent, children, preview }: { accent: string; children: ReactNode; preview?: boolean }) {
  return (
    <div className={`bf-public ${preview ? 'is-preview' : ''}`} style={{ ['--bf-accent' as string]: accent }}>
      {preview && <p className="bf-preview-bar"><Icon name="eye" size={14} /> pré-visualização · é assim que o cliente vê (nada é enviado)</p>}
      <div className="bf-card">{children}</div>
      <p className="bf-foot">feito com traço</p>
    </div>
  )
}

/** Formulário do cliente. Com `preview`, é só para ver: nada é salvo nem enviado. */
export function BriefingForm({ id, data: b, preview }: { id: string; data: PublicBriefing; preview?: boolean }) {
  const [answers, setAnswers] = useState<BriefingAnswers>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(0)
  const [missing, setMissing] = useState<string[]>([])
  const [sent, setSent] = useState<'ok' | 'manual' | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(-1) // -1 = capa
  const draftKey = `briefing-rascunho:${id}`
  useEffect(() => {
    if (preview) return
    try {
      setAnswers(JSON.parse(localStorage.getItem(draftKey) || '{}'))
    } catch {
      /* ok */
    }
  }, [draftKey, preview])
  const save = (next: BriefingAnswers) => {
    if (preview) return
    try {
      localStorage.setItem(draftKey, JSON.stringify(next)) // não perde o que escreveu se fechar a página
    } catch {
      /* ok */
    }
  }
  const set = (qid: string, v: string | string[]) =>
    setAnswers((a) => {
      const next = { ...a, [qid]: v }
      save(next)
      return next
    })

  const p = b.payload
  const canUpload = b.source !== 'link' // pela cópia do link não há onde guardar fotos: vão pelo WhatsApp
  if (b.answered || sent === 'ok')
    return (
      <PublicShell accent={p.accent} preview={preview}>
        <p className="bf-eyebrow">{p.studio}</p>
        <span className="bf-done-icon"><Icon name="check" size={26} /></span>
        <h1>obrigada!</h1>
        <p>Suas respostas chegaram{p.owner ? ` para ${p.owner}` : ''}. Agora é com a gente: em breve entramos em contato.</p>
        {!b.answered && Object.keys(answers).length > 0 && (
          <>
            <button className="btn ghost bf-send bf-no-print" onClick={() => window.print()}>
              <Icon name="download" size={16} /> guardar uma cópia das respostas (PDF)
            </button>
            <div className="bf-print">
              <p className="bf-eyebrow">{p.studio} · briefing</p>
              <h2>{p.title}</h2>
              {sectionsOf({ ...p, questions: visibleQuestions(p.questions, answers) }).map((s) => {
                const list = inSection({ ...p, questions: visibleQuestions(p.questions, answers) }, s.id).filter((q) => q.kind !== 'photos' && answerText(answers[q.id]))
                return list.length ? (
                  <div key={s.id}>
                    <p className="bf-sec">{s.title}</p>
                    {list.map((q) => (
                      <p key={q.id} className="bf-print-qa">
                        <b>{q.label}</b>
                        <span>{q.kind === 'date' ? fmtDate(answerText(answers[q.id])) : answerText(answers[q.id])}</span>
                      </p>
                    ))}
                  </div>
                ) : null
              })}
            </div>
          </>
        )}
      </PublicShell>
    )
  if (sent === 'manual') {
    const msg = answersMessage(p, answers, code)
    return (
      <PublicShell accent={p.accent} preview={preview}>
        <p className="bf-eyebrow">{p.studio}</p>
        <h1>falta só um toque</h1>
        <p>Suas respostas estão prontas. Toque abaixo para mandar{p.owner ? ` para ${p.owner}` : ''}{p.phone ? ' pelo WhatsApp' : ''}: a mensagem já vai escrita.</p>
        <div className="stack-s">
          {p.phone && (
            <a className="btn primary bf-send" href={whatsappLink(p.phone, msg)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={16} /> mandar pelo WhatsApp
            </a>
          )}
          {p.email && (
            <a className="btn bf-send" href={`mailto:${p.email}?subject=${encodeURIComponent(`Briefing · ${p.clientName}`)}&body=${encodeURIComponent(msg)}`}>
              <Icon name="mail" size={16} /> mandar por e-mail
            </a>
          )}
          <button className="btn ghost bf-send" onClick={() => navigator.clipboard?.writeText(msg).then(() => toast('Respostas copiadas: é só colar na conversa.')).catch(() => undefined)}>
            <Icon name="copy" size={16} /> copiar as respostas
          </button>
        </div>
        {p.questions.some((q) => q.kind === 'photos') && <p className="muted small">Tem fotos? Mande logo depois, na mesma conversa.</p>}
      </PublicShell>
    )
  }

  const qs = visibleQuestions(p.questions, answers)
  const secs = sectionsOf({ ...p, questions: qs })
  const filled = qs.filter((q) => answerText(answers[q.id])).length
  const addPhotos = async (q: BriefingQuestion, files: FileList | null) => {
    if (preview) return toast('Na pré-visualização as fotos não são enviadas.')
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/')).slice(0, 12)
    for (const f of list) {
      setUploading((n) => n + 1)
      try {
        const v = await uploadAttachment(id, f, b.source === 'cloud')
        setPreviews((m) => ({ ...m, [v]: URL.createObjectURL(f) }))
        setAnswers((a) => {
          const cur = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : []
          const next = { ...a, [q.id]: [...cur, v] }
          save(next)
          return next
        })
      } catch {
        toast('Uma foto não foi enviada. Confira a internet e tente de novo.')
      }
      setUploading((n) => n - 1)
    }
  }
  const submit = async () => {
    const need = qs.filter((q) => q.required && !answerText(answers[q.id])).map((q) => q.id)
    setMissing(need)
    if (need.length) {
      const first = qs.find((q) => q.id === need[0])
      const at = secs.findIndex((x) => inSection({ ...p, questions: qs }, x.id).some((q) => q.id === first?.id))
      if (at >= 0 && at !== step) setStep(at)
      setTimeout(() => document.getElementById(`bfq-${need[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
      return toast(`Falta responder ${need.length} pergunta(s) obrigatória(s).`)
    }
    if (!filled) return toast('Responda pelo menos uma pergunta.')
    if (preview) return toast('Pré-visualização: aqui o cliente envia as respostas.')
    setBusy(true)
    // só as perguntas que apareceram (sub-perguntas escondidas não vão)
    const clean = Object.fromEntries(Object.entries(answers).filter(([k]) => qs.some((q) => q.id === k)))
    const ok = await sendPublicAnswers(id, clean, b.source)
    if (ok) {
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* ok */
      }
      setSent('ok')
    } else {
      // plano B: as respostas vão pelo WhatsApp, com um código que devolve tudo para o sistema
      const { pack } = await import('../linkPack')
      const photoless = Object.fromEntries(Object.entries(clean).filter(([k]) => p.questions.find((q) => q.id === k)?.kind !== 'photos'))
      setCode(await pack({ id, a: photoless }))
      setSent('manual')
    }
    window.scrollTo(0, 0)
    setBusy(false)
  }
  // uma parte por vez: capa → partes → enviar (menos cansativo e dá para ver o quanto falta)
  const total = secs.length
  const cur = secs[step]
  const curQs = cur ? inSection({ ...p, questions: qs }, cur.id) : []
  const minutes = Math.max(3, Math.round(qs.reduce((n, q) => n + (q.kind === 'long' ? 1 : q.kind === 'photos' ? 1.2 : 0.35), 0)))
  const goStep = (n: number) => {
    setStep(n)
    requestAnimationFrame(() => (preview ? document.querySelector('.bf-preview-frame')?.scrollTo({ top: 0 }) : window.scrollTo({ top: 0, behavior: 'smooth' })))
  }
  const next = () => {
    const need = curQs.filter((q) => q.required && !answerText(answers[q.id])).map((q) => q.id)
    setMissing(need)
    if (need.length) {
      document.getElementById(`bfq-${need[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return toast(`Falta responder ${need.length} pergunta(s) obrigatória(s) desta parte.`)
    }
    goStep(step + 1)
  }
  if (step < 0)
    return (
      <PublicShell accent={p.accent} preview={preview}>
        <header className="bf-cover">
          {p.logo ? <img src={p.logo} alt="" className="bf-logo" /> : <p className="bf-eyebrow">{p.studio || 'briefing'}</p>}
          <h1>{p.title}</h1>
          <p className="bf-intro">{p.intro}</p>
          <ul className="bf-facts">
            <li>
              <Icon name="clock" size={16} /> uns {minutes} minutos
            </li>
            <li>
              <Icon name="list" size={16} /> {total} {total === 1 ? 'parte' : 'partes'} · {qs.length} perguntas
            </li>
            <li>
              <Icon name="check" size={16} /> dá para pular o que não souber
            </li>
          </ul>
          <ol className="bf-map">
            {secs.map((x, i) => (
              <li key={x.id}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {x.title}
              </li>
            ))}
          </ol>
          <button className="btn primary bf-send" onClick={() => goStep(0)}>
            {filled ? 'continuar de onde parei' : 'começar'} <Icon name="arrowRight" size={16} />
          </button>
          <p className="bf-note">Suas respostas ficam salvas neste aparelho até você enviar.</p>
        </header>
      </PublicShell>
    )
  return (
    <PublicShell accent={p.accent} preview={preview}>
      <div className="bf-stepper" aria-label={`parte ${step + 1} de ${total}`}>
        {secs.map((x, i) => (
          <button key={x.id} type="button" className={i < step ? 'is-done' : i === step ? 'is-now' : ''} onClick={() => i < step && goStep(i)} aria-label={x.title} disabled={i > step} />
        ))}
      </div>
      <section className="bf-block" key={cur.id}>
        <div className="bf-block-head">
          <span className="bf-block-n">{String(step + 1).padStart(2, '0')}</span>
          <div>
            <p className="bf-eyebrow">parte {step + 1} de {total}</p>
            <h2>{cur.title}</h2>
            {cur.description && <p className="bf-desc">{cur.description}</p>}
          </div>
        </div>
        {curQs.map((q) => (
          <PublicQuestion key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} missing={missing.includes(q.id)} previews={previews} uploading={uploading} onPhotos={(f) => void addPhotos(q, f)} canUpload={canUpload} />
        ))}
      </section>
      <div className="bf-nav">
        <button className="btn ghost" onClick={() => goStep(step - 1)}>
          <Icon name="chevronL" size={16} /> {step === 0 ? 'início' : 'voltar'}
        </button>
        {step < total - 1 ? (
          <button className="btn primary" onClick={next}>
            próxima parte <Icon name="chevronR" size={16} />
          </button>
        ) : (
          <button className="btn primary" onClick={() => void submit()} disabled={busy || uploading > 0}>
            {uploading ? 'enviando fotos…' : busy ? 'enviando…' : 'enviar respostas'} <Icon name="check" size={16} />
          </button>
        )}
      </div>
      <p className="bf-note">
        {filled} de {qs.length} respondidas · <span className="bf-req">*</span> obrigatória · fica salvo neste aparelho
      </p>
    </PublicShell>
  )
}

/** Pré-visualização de um modelo (ou de um briefing já montado), como o cliente vê. */
export function BriefingPreview({ tpl, clientName, onClose }: { tpl: Pick<BriefingTemplate, 'name' | 'questions' | 'sections'>; clientName?: string; onClose: () => void }) {
  const { data } = useStore()
  const payload = briefingPayload(data.settings, tpl, clientName || 'Ana')
  return (
    <Modal title={`${tpl.name} · como o cliente vê`} onClose={onClose} wide>
      <div className="bf-preview-frame">
        <BriefingForm id="previa" data={{ payload, answered: false, source: 'local' }} preview />
      </div>
    </Modal>
  )
}

export function PublicQuestion({ q, value, onChange, missing, previews, uploading, onPhotos, canUpload = true }: { q: BriefingQuestion; value?: string | string[]; onChange: (v: string | string[]) => void; missing: boolean; previews: Record<string, string>; uploading: number; onPhotos: (f: FileList | null) => void; canUpload?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const list = Array.isArray(value) ? value : []
  const text = typeof value === 'string' ? value : ''
  const opts = q.options ?? []
  const pics = q.optionImages ?? {}
  const withPics = (q.kind === 'choice' || q.kind === 'multi') && opts.some((o) => pics[o])
  // "outro": o que a pessoa escreveu e não é uma das opções
  const otherVal = q.kind === 'multi' ? list.find((v) => !opts.includes(v)) ?? '' : q.kind === 'choice' && text && !opts.includes(text) ? text : ''
  const isOn = (o: string) => (q.kind === 'multi' ? list.includes(o) : text === o)
  const toggle = (o: string) => (q.kind === 'multi' ? onChange(isOn(o) ? list.filter((x) => x !== o) : [...list, o]) : onChange(text === o ? '' : o))
  return (
    <div id={`bfq-${q.id}`} className={`bf-q ${missing ? 'is-missing' : ''} ${q.showIf ? 'bf-sub' : ''}`}>
      <label className="bf-label" htmlFor={`bf-${q.id}`}>
        {q.label}
        {q.required && <span className="bf-req"> *</span>}
      </label>
      {q.hint && <p className="bf-hint">{q.hint}</p>}
      {q.kind === 'multi' && <p className="bf-hint bf-hint-multi">pode marcar mais de uma</p>}
      {q.images && q.images.length > 0 && (
        <div className="bf-refs">
          {q.images.map((src, i) => (
            <ArtImage key={i} src={src} />
          ))}
        </div>
      )}
      {withPics ? (
        <div className={`bf-imgopts ${opts.length > 4 ? 'is-many' : ''}`} role={q.kind === 'choice' ? 'radiogroup' : undefined}>
          {opts.map((o) => (
            <button key={o} type="button" className={`bf-imgopt ${isOn(o) ? 'is-on' : ''}`} onClick={() => toggle(o)} aria-pressed={isOn(o)}>
              <span className="bf-imgopt-pic">{pics[o] ? <ArtImage src={pics[o]} alt={o} /> : <span className="bf-imgopt-none">{o.slice(0, 1)}</span>}</span>
              <span className="bf-imgopt-label">
                <i className={q.kind === 'choice' ? 'bf-radio' : 'bf-box'} aria-hidden />
                {o}
              </span>
            </button>
          ))}
          {q.other && <input className="bf-other" value={otherVal} onChange={(e) => (q.kind === 'multi' ? onChange([...list.filter((v) => opts.includes(v)), ...(e.target.value ? [e.target.value] : [])]) : onChange(e.target.value))} placeholder="outro: escreva aqui" />}
          {Object.values(pics).some((v) => !isArt(v)) && <p className="bf-hint bf-pic-note">fotos ilustrativas</p>}
        </div>
      ) : q.kind === 'long' ? (
        <textarea id={`bf-${q.id}`} rows={3} value={text} onChange={(e) => onChange(e.target.value)} spellCheck lang="pt-BR" />
      ) : q.kind === 'date' ? (
        <input id={`bf-${q.id}`} type="date" value={text} onChange={(e) => onChange(e.target.value)} />
      ) : q.kind === 'choice' ? (
        <div className="bf-chips" role="radiogroup">
          {opts.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={text === o} className={`bf-chip ${text === o ? 'is-on' : ''}`} onClick={() => onChange(text === o ? '' : o)}>
              {o}
            </button>
          ))}
          {q.other && <input className="bf-other" value={otherVal} onChange={(e) => onChange(e.target.value)} placeholder="outro: escreva aqui" />}
        </div>
      ) : q.kind === 'multi' ? (
        <div className="bf-chips">
          {opts.map((o) => {
            const on = list.includes(o)
            return (
              <button key={o} type="button" aria-pressed={on} className={`bf-chip ${on ? 'is-on' : ''}`} onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}>
                {on ? '✓ ' : ''}
                {o}
              </button>
            )
          })}
          {q.other && <input className="bf-other" value={otherVal} onChange={(e) => onChange([...list.filter((v) => opts.includes(v)), ...(e.target.value ? [e.target.value] : [])])} placeholder="outro: escreva aqui" />}
        </div>
      ) : q.kind === 'photos' ? (
        <div className="bf-upload">
          {q.tips && q.tips.length > 0 && (
            <div className="bf-tips">
              <span><Icon name="camera" size={14} /> fotos que ajudam</span>
              <ul>
                {q.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {canUpload ? (
            <>
              {list.length > 0 && (
                <div className="bf-thumbs">
                  {list.map((v) => (
                    <span key={v} className="bf-thumb">
                      {previews[v] || v.startsWith('data:') ? <img src={previews[v] || v} alt="" /> : <span className="bf-thumb-ok">✓</span>}
                      <button type="button" aria-label="Tirar foto" onClick={() => onChange(list.filter((x) => x !== v))}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <button type="button" className="btn bf-upload-btn" onClick={() => fileRef.current?.click()}>
                <Icon name="camera" size={16} /> {list.length ? 'adicionar mais fotos' : 'adicionar fotos'}
              </button>
              {uploading > 0 && <small className="muted">enviando…</small>}
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (onPhotos(e.target.files), (e.target.value = ''))} />
            </>
          ) : (
            <p className="bf-hint">Depois de enviar as respostas, mande as fotos direto na conversa do WhatsApp.</p>
          )}
        </div>
      ) : (
        <input id={`bf-${q.id}`} value={text} onChange={(e) => onChange(e.target.value)} />
      )}
      {missing && <p className="bf-missing">esta pergunta é obrigatória</p>}
    </div>
  )
}

export type { BriefingTemplate }
