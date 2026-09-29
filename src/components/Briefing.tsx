import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { useAccess } from '../access'
import { Icon } from './Icon'
import { Badge, Modal, Section } from './ui'
import { askDelete, toast } from './dialog'
import { BRIEFING_SECTIONS } from '../briefingQuestions'
import { allTemplates } from '../briefingTemplates'
import { attachmentUrls, briefingLink, deleteBriefingLink, fetchAnswers, loadPublicBriefing, publishBriefing, sendPublicAnswers, uploadAttachment, type PublicBriefing } from '../briefingApi'
import type { Briefing, BriefingAnswers, BriefingQuestion, BriefingSection as BSection, BriefingTemplate, Client, ClientProfile, Data } from '../types'
import { fmtDate, today, uid, whatsappLink } from '../utils'
import { go } from '../router'
import { PLANS } from '../plans'

/* Briefing online do cliente final: o arquiteto escolhe os blocos de perguntas, manda o link
   (WhatsApp ou copiar) e as respostas voltam sozinhas para a ficha do cliente. */

/** "Família Souza" → "Família Souza"; "Maria Souza" → "Maria". */
const greetName = (name: string) => (/^fam[ií]lia\b/i.test(name.trim()) ? name.trim() : name.trim().split(' ')[0])
const answerText = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : (v ?? '')).trim()

/** Aplica as respostas: preenche o que estiver vazio na ficha e anota no histórico. */
function applyAnswers(client: Client, b: Briefing, answers: BriefingAnswers): Client {
  const profile: ClientProfile = { ...client.profile }
  for (const q of b.questions) {
    const v = answerText(answers[q.id])
    if (q.field && q.kind !== 'photos' && v && !(profile[q.field] ?? '').trim()) profile[q.field] = v
  }
  return { ...client, profile, history: [...client.history, { id: uid(), date: today(), text: `briefing respondido: ${b.title}` }] }
}

/** Confere se chegaram respostas (ao abrir o sistema e de tempos em tempos). */
export function useBriefingSync(enabled: boolean) {
  const { data, upsert } = useStore()
  const pending = useMemo(() => (data.briefings ?? []).filter((b) => b.status === 'enviado'), [data.briefings])
  const check = useCallback(
    async (list: Briefing[], d: Data) => {
      if (!list.length) return
      try {
        const got = await fetchAnswers(list.map((b) => b.id))
        for (const b of list) {
          const r = got[b.id]
          if (!r) continue
          upsert('briefings', { ...b, status: 'respondido', answers: r.answers, answeredAt: r.answeredAt })
          const c = d.clients.find((x) => x.id === b.clientId)
          if (c) upsert('clients', applyAnswers(c, b, r.answers))
          toast(`📋 ${c?.name.split(' ')[0] ?? 'O cliente'} respondeu o briefing`)
        }
      } catch {
        /* sem conexão: tenta depois */
      }
    },
    [upsert],
  )
  const ids = pending.map((b) => b.id).join(',')
  useEffect(() => {
    if (!enabled || !ids) return
    void check(pending, data)
    const iv = setInterval(() => void check(pending, data), 5 * 60_000)
    const onVis = () => document.visibilityState === 'visible' && void check(pending, data)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ids, check])
  return { check: () => check(pending, data) }
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
        <BriefingList list={list} />
      )}
      {creating && <NewBriefing client={client} onClose={() => setCreating(false)} />}
    </Section>
  )
}

/** Lista de briefings enviados (na ficha do cliente e na tela de briefings). */
export function BriefingList({ list, showClient }: { list: Briefing[]; showClient?: boolean }) {
  const { data, remove } = useStore()
  const [open, setOpen] = useState<string | null>(null)
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
                </>
              )}
              <button
                className="icon-btn subtle"
                aria-label="Apagar briefing"
                onClick={async () => {
                  if (!(await askDelete(`o briefing "${b.title}"`))) return
                  void deleteBriefingLink(b.id).catch(() => undefined)
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
    </ul>
  )
}

function ShareButtons({ client, b }: { client: Client; b: Briefing }) {
  const { data } = useStore()
  const link = briefingLink(b.id)
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
  )
}

/** Mandar um briefing: escolhe o modelo e o link sai pronto. */
export function NewBriefing({ client: fixed, templateId, onClose }: { client?: Client; templateId?: string; onClose: () => void }) {
  const { data, upsert } = useStore()
  const st = data.settings
  const templates = allTemplates(st.briefingTemplates)
  const [tplId, setTplId] = useState(templateId ?? '')
  const [clientId, setClientId] = useState(fixed?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Briefing | null>(null)
  const tpl = templates.find((t) => t.id === tplId)
  const client = fixed ?? data.clients.find((c) => c.id === clientId)

  const create = async () => {
    if (!tpl || !client) return
    if (!tpl.questions.length) return toast('Este modelo ainda não tem perguntas. Edite em “briefings”.')
    setBusy(true)
    const b: Briefing = { id: crypto.randomUUID(), clientId: client.id, title: `${tpl.name} · ${client.name}`, questions: tpl.questions, sections: tpl.sections, templateId: tpl.id, status: 'enviado', createdAt: today() }
    try {
      await publishBriefing(b.id, {
        title: tpl.name,
        clientName: client.name,
        studio: st.brandName || st.ownerName || '',
        owner: st.ownerName || '',
        accent: st.accent,
        logo: st.logo && st.logo.length < 250_000 ? st.logo : undefined,
        intro: `Oi, ${greetName(client.name)}! Estas perguntas me ajudam a entender o que vocês precisam e como vivem. Responda com calma: não existe resposta certa, e dá para pular o que não souber.`,
        questions: tpl.questions,
        sections: tpl.sections,
      })
      upsert('briefings', b)
      setDone(b)
    } catch {
      toast('Não foi possível criar o link agora. Confira a internet e tente de novo.')
    }
    setBusy(false)
  }

  if (done && client)
    return (
      <Modal title="briefing pronto ✨" onClose={onClose}>
        <p>Agora é só mandar o link para {greetName(client.name)}. Quando responder, você recebe um aviso e as respostas preenchem a ficha.</p>
        <p className="bf-link">{briefingLink(done.id)}</p>
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
          <button className="btn primary" onClick={() => void create()} disabled={busy || !tpl || !client}>
            {busy ? 'criando…' : tpl ? `criar link (${tpl.questions.length} perguntas)` : 'escolha um modelo'}
          </button>
        </>
      }
    >
      {!fixed && (
        <label className="bf-pick-client">
          <span className="field-label">para quem</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">escolha o cliente…</option>
            {data.clients
              .filter((c) => !c.archived)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <span className="field-label">qual modelo</span>
      <div className="bf-tpl-grid">
        {templates.map((t) => (
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
    </Modal>
  )
}

/* ---------------- página pública (o cliente final responde) ---------------- */

export function BriefingPublic({ id }: { id: string }) {
  const [b, setB] = useState<PublicBriefing | null | undefined>(undefined)
  const [answers, setAnswers] = useState<BriefingAnswers>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(0)
  const [missing, setMissing] = useState<string[]>([])
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const draftKey = `briefing-rascunho:${id}`
  useEffect(() => {
    loadPublicBriefing(id).then(setB, () => setB(null))
    try {
      setAnswers(JSON.parse(localStorage.getItem(draftKey) || '{}'))
    } catch {
      /* ok */
    }
  }, [id, draftKey])
  const set = (qid: string, v: string | string[]) =>
    setAnswers((a) => {
      const next = { ...a, [qid]: v }
      try {
        localStorage.setItem(draftKey, JSON.stringify(next)) // não perde o que escreveu se fechar a página
      } catch {
        /* ok */
      }
      return next
    })

  const accent = b?.payload.accent || '#a88a80'
  const wrap = (children: ReactNode) => (
    <div className="bf-public" style={{ ['--bf-accent' as string]: accent }}>
      <div className="bf-card">{children}</div>
      <p className="bf-foot">feito com traço</p>
    </div>
  )
  if (b === undefined) return wrap(<p className="muted">carregando…</p>)
  if (b === null) return wrap(<p>Este link não existe mais. Peça um novo para quem te enviou.</p>)
  const p = b.payload
  if (b.answered || sent)
    return wrap(
      <>
        <p className="bf-eyebrow">{p.studio}</p>
        <h1>obrigada! 💛</h1>
        <p>Suas respostas chegaram{p.owner ? ` para ${p.owner}` : ''}. Agora é com a gente: em breve entramos em contato.</p>
      </>,
    )
  const secs = sectionsOf(p)
  const filled = p.questions.filter((q) => answerText(answers[q.id])).length
  const addPhotos = async (q: BriefingQuestion, files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/')).slice(0, 12)
    for (const f of list) {
      setUploading((n) => n + 1)
      try {
        const v = await uploadAttachment(id, f)
        setPreviews((m) => ({ ...m, [v]: URL.createObjectURL(f) }))
        setAnswers((a) => {
          const cur = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : []
          const next = { ...a, [q.id]: [...cur, v] }
          try {
            localStorage.setItem(draftKey, JSON.stringify(next))
          } catch {
            /* ok */
          }
          return next
        })
      } catch {
        toast('Uma foto não foi enviada. Confira a internet e tente de novo.')
      }
      setUploading((n) => n - 1)
    }
  }
  const submit = async () => {
    const need = p.questions.filter((q) => q.required && !answerText(answers[q.id])).map((q) => q.id)
    setMissing(need)
    if (need.length) {
      document.getElementById(`bfq-${need[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return toast(`Falta responder ${need.length} pergunta(s) obrigatória(s).`)
    }
    if (!filled) return toast('Responda pelo menos uma pergunta.')
    setBusy(true)
    try {
      await sendPublicAnswers(id, answers)
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* ok */
      }
      setSent(true)
      window.scrollTo(0, 0)
    } catch {
      toast('Não foi possível enviar agora. Confira a internet e tente de novo: suas respostas continuam aqui.')
    }
    setBusy(false)
  }
  return wrap(
    <>
      <header className="bf-head">
        {p.logo && <img src={p.logo} alt="" className="bf-logo" />}
        <p className="bf-eyebrow">{p.studio || 'briefing'}</p>
        <h1>{p.title}</h1>
        <p className="muted">{p.intro}</p>
        <div className="bf-progress" aria-label={`${filled} de ${p.questions.length} respondidas`}>
          <i style={{ width: `${(filled / Math.max(1, p.questions.length)) * 100}%` }} />
        </div>
        <p className="bf-count">
          {filled} de {p.questions.length} respondidas · <span className="bf-req">*</span> obrigatória
        </p>
      </header>
      {secs.map((s, si) => (
        <section key={s.id} className="bf-block">
          <div className="bf-block-head">
            <span className="bf-block-n">{si + 1}</span>
            <div>
              <h2>{s.title}</h2>
              {s.description && <p className="muted small">{s.description}</p>}
            </div>
          </div>
          {inSection(p, s.id).map((q) => (
            <PublicQuestion key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} missing={missing.includes(q.id)} previews={previews} uploading={uploading} onPhotos={(f) => void addPhotos(q, f)} />
          ))}
        </section>
      ))}
      <button className="btn primary bf-send" onClick={() => void submit()} disabled={busy || uploading > 0}>
        {uploading ? 'enviando fotos…' : busy ? 'enviando…' : 'enviar respostas'}
      </button>
      <p className="muted small center">Suas respostas ficam salvas neste aparelho até você enviar.</p>
    </>,
  )
}

export function PublicQuestion({ q, value, onChange, missing, previews, uploading, onPhotos }: { q: BriefingQuestion; value?: string | string[]; onChange: (v: string | string[]) => void; missing: boolean; previews: Record<string, string>; uploading: number; onPhotos: (f: FileList | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const list = Array.isArray(value) ? value : []
  const text = typeof value === 'string' ? value : ''
  const opts = q.options ?? []
  // "outro": o que a pessoa escreveu e não é uma das opções
  const otherVal = q.kind === 'multi' ? list.find((v) => !opts.includes(v)) ?? '' : q.kind === 'choice' && text && !opts.includes(text) ? text : ''
  return (
    <div id={`bfq-${q.id}`} className={`bf-q ${missing ? 'is-missing' : ''}`}>
      <label className="bf-label" htmlFor={`bf-${q.id}`}>
        {q.label}
        {q.required && <span className="bf-req"> *</span>}
      </label>
      {q.hint && <p className="bf-hint">{q.hint}</p>}
      {q.images && q.images.length > 0 && (
        <div className="bf-refs">
          {q.images.map((src, i) => (
            <img key={i} src={src} alt="" />
          ))}
        </div>
      )}
      {q.kind === 'long' ? (
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
            📷 {list.length ? 'adicionar mais fotos' : 'adicionar fotos'}
          </button>
          {uploading > 0 && <small className="muted">enviando…</small>}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (onPhotos(e.target.files), (e.target.value = ''))} />
        </div>
      ) : (
        <input id={`bf-${q.id}`} value={text} onChange={(e) => onChange(e.target.value)} />
      )}
      {missing && <p className="bf-missing">esta pergunta é obrigatória</p>}
    </div>
  )
}

export type { BriefingTemplate }
