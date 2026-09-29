import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { useAccess } from '../access'
import { Icon } from './Icon'
import { Badge, Field, Modal, Section } from './ui'
import { askDelete, toast } from './dialog'
import { BRIEFING_SECTIONS, DEFAULT_BRIEFING } from '../briefingQuestions'
import { briefingLink, deleteBriefingLink, fetchAnswers, loadPublicBriefing, publishBriefing, sendPublicAnswers, type PublicBriefing } from '../briefingApi'
import type { Briefing, BriefingAnswers, BriefingKind, BriefingQuestion, Client, ClientProfile, Data } from '../types'
import { fmtDate, today, uid, whatsappLink } from '../utils'
import { go } from '../router'

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
    if (q.field && v && !(profile[q.field] ?? '').trim()) profile[q.field] = v
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

export function BriefingSection({ client }: { client: Client }) {
  const { data, remove } = useStore()
  const { has } = useAccess()
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const list = (data.briefings ?? []).filter((b) => b.clientId === client.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const { check } = useBriefingSync(false)
  const allowed = has('briefing')

  return (
    <Section
      title="briefing"
      action={
        allowed && (
          <button className="btn small" onClick={() => setCreating(true)}>
            <Icon name="plus" size={14} /> {list.length ? 'novo' : 'criar briefing'}
          </button>
        )
      }
    >
      {!allowed ? (
        <p className="muted small">
          O briefing online (o cliente responde pelo celular e tudo cai aqui) faz parte do plano Completo.{' '}
          <button className="link" onClick={() => go('assinatura')}>
            ver planos
          </button>
        </p>
      ) : list.length === 0 ? (
        <p className="muted small">Mande um link com as perguntas: o cliente responde pelo celular, sem criar conta, e as respostas preenchem a ficha dele.</p>
      ) : (
        <ul className="bf-list">
          {list.map((b) => (
            <li key={b.id} className="bf-item">
              <div className="bf-row">
                <span className="grow">
                  <b>{b.title}</b>
                  <small className="muted">
                    {' '}
                    · enviado {fmtDate(b.createdAt)}
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
                    <ShareButtons client={client} b={b} />
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
          ))}
        </ul>
      )}
      {creating && <NewBriefing client={client} onClose={() => setCreating(false)} />}
    </Section>
  )
}

function ShareButtons({ client, b }: { client: Client; b: Briefing }) {
  const { data } = useStore()
  const link = briefingLink(b.id)
  const first = greetName(client.name)
  const msg = `Olá, ${first}! Para eu entender direitinho o que vocês precisam, preparei algumas perguntas rápidas. Dá para responder pelo celular, com calma: ${link}\n\n${data.settings.ownerName || ''}`.trim()
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
  const skipped = b.questions.filter((q) => !answerText(a[q.id])).length
  const text = BRIEFING_SECTIONS.concat([{ id: 'extra', label: 'outras perguntas', hint: '' }])
    .map((s) => {
      const qs = b.questions.filter((q) => (q.section || 'extra') === s.id && answerText(a[q.id]))
      return qs.length ? `${s.label.toUpperCase()}\n${qs.map((q) => `${q.label}: ${answerText(a[q.id])}`).join('\n')}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
  return (
    <div className="bf-answers">
      {BRIEFING_SECTIONS.concat([{ id: 'extra', label: 'outras perguntas', hint: '' }]).map((s) => {
        const qs = b.questions.filter((q) => (q.section || 'extra') === s.id && answerText(a[q.id]))
        if (!qs.length) return null
        return (
          <div key={s.id}>
            <p className="bf-sec">{s.label}</p>
            <dl className="bf-qa-list">
              {qs.map((q) => (
                <div key={q.id} className="bf-qa">
                  <dt>{q.label}</dt>
                  <dd>{answerText(a[q.id])}</dd>
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

function NewBriefing({ client, onClose }: { client: Client; onClose: () => void }) {
  const { data, upsert } = useStore()
  const st = data.settings
  const [title, setTitle] = useState(`briefing · ${client.name}`)
  const [sections, setSections] = useState<string[]>(BRIEFING_SECTIONS.map((s) => s.id))
  const [skip, setSkip] = useState<string[]>([])
  const [extra, setExtra] = useState<BriefingQuestion[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Briefing | null>(null)
  const questions = [...DEFAULT_BRIEFING.filter((q) => sections.includes(q.section) && !skip.includes(q.id)), ...extra.filter((q) => q.label.trim())]

  const create = async () => {
    if (!questions.length) return toast('Escolha pelo menos uma pergunta.')
    setBusy(true)
    const b: Briefing = { id: crypto.randomUUID(), clientId: client.id, title: title.trim() || 'briefing', questions, status: 'enviado', createdAt: today() }
    try {
      await publishBriefing(b.id, {
        title: b.title,
        clientName: client.name,
        studio: st.brandName || st.ownerName || '',
        owner: st.ownerName || '',
        accent: st.accent,
        logo: st.logo && st.logo.length < 250_000 ? st.logo : undefined,
        intro: `Oi, ${greetName(client.name)}! Estas perguntas me ajudam a entender como vocês vivem e o que esperam do projeto. Responda com calma: não existe resposta certa, e dá para pular o que não souber.`,
        questions,
      })
      upsert('briefings', b)
      setDone(b)
    } catch {
      toast('Não foi possível criar o link agora. Confira a internet e tente de novo.')
    }
    setBusy(false)
  }

  if (done)
    return (
      <Modal title="briefing pronto ✨" onClose={onClose}>
        <p>Agora é só mandar o link para {client.name.split(' ')[0]}. Quando responder, as respostas aparecem aqui e preenchem a ficha.</p>
        <p className="bf-link">{briefingLink(done.id)}</p>
        <div className="row gap-s wrap">
          <ShareButtons client={client} b={done} />
        </div>
      </Modal>
    )

  return (
    <Modal
      title="novo briefing"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={() => void create()} disabled={busy}>
            {busy ? 'criando…' : `criar link (${questions.length} perguntas)`}
          </button>
        </>
      }
    >
      <Field label="Título">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <p className="muted small">Escolha os blocos e tire as perguntas que não fazem sentido para este cliente.</p>
      <div className="bf-sections">
        {BRIEFING_SECTIONS.map((s) => {
          const on = sections.includes(s.id)
          const qs = DEFAULT_BRIEFING.filter((q) => q.section === s.id)
          return (
            <div key={s.id} className={`bf-section ${on ? 'is-on' : ''}`}>
              <label className="check">
                <input type="checkbox" checked={on} onChange={(e) => setSections(e.target.checked ? [...sections, s.id] : sections.filter((x) => x !== s.id))} />
                <span>
                  <b>{s.label}</b> <small className="muted">· {s.hint}</small>
                </span>
              </label>
              {on && (
                <div className="bf-qs">
                  {qs.map((q) => (
                    <label key={q.id} className="check small">
                      <input type="checkbox" checked={!skip.includes(q.id)} onChange={(e) => setSkip(e.target.checked ? skip.filter((x) => x !== q.id) : [...skip, q.id])} />
                      <span>{q.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div className="bf-section is-on">
          <b>perguntas suas</b>
          {extra.map((q, i) => (
            <div key={q.id} className="bf-extra">
              <input value={q.label} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Escreva a pergunta" />
              <select value={q.kind} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, kind: e.target.value as BriefingKind } : x)))} aria-label="Tipo de resposta">
                <option value="text">resposta curta</option>
                <option value="long">resposta longa</option>
              </select>
              <button className="icon-btn subtle" onClick={() => setExtra(extra.filter((_, j) => j !== i))} aria-label="Remover pergunta">
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          <button className="btn small ghost" onClick={() => setExtra([...extra, { id: `extra-${uid()}`, section: 'extra', label: '', kind: 'long' }])}>
            <Icon name="plus" size={14} /> pergunta
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- página pública (o cliente final responde) ---------------- */

export function BriefingPublic({ id }: { id: string }) {
  const [b, setB] = useState<PublicBriefing | null | undefined>(undefined)
  const [answers, setAnswers] = useState<BriefingAnswers>({})
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
  const wrap = (children: React.ReactNode) => (
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
  const secs = BRIEFING_SECTIONS.concat([{ id: 'extra', label: 'mais algumas perguntas', hint: '' }]).filter((s) => p.questions.some((q) => (q.section || 'extra') === s.id))
  const filled = p.questions.filter((q) => answerText(answers[q.id])).length
  const submit = async () => {
    if (!filled) return toast('Responda pelo menos uma pergunta.')
    setBusy(true)
    try {
      const ok = await sendPublicAnswers(id, answers)
      if (ok) {
        try {
          localStorage.removeItem(draftKey)
        } catch {
          /* ok */
        }
      }
      setSent(true)
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
          <i style={{ width: `${(filled / p.questions.length) * 100}%` }} />
        </div>
      </header>
      {secs.map((s) => (
        <section key={s.id} className="bf-block">
          <h2>{s.label}</h2>
          {p.questions
            .filter((q) => (q.section || 'extra') === s.id)
            .map((q) => (
              <div key={q.id} className="bf-q">
                <label className="bf-label" htmlFor={`bf-${q.id}`}>
                  {q.label}
                </label>
                {q.kind === 'long' ? (
                  <textarea id={`bf-${q.id}`} rows={3} value={answerText(answers[q.id])} onChange={(e) => set(q.id, e.target.value)} spellCheck lang="pt-BR" />
                ) : q.kind === 'choice' ? (
                  <div className="bf-chips" role="radiogroup">
                    {(q.options ?? []).map((o) => (
                      <button key={o} type="button" role="radio" aria-checked={answers[q.id] === o} className={`bf-chip ${answers[q.id] === o ? 'is-on' : ''}`} onClick={() => set(q.id, answers[q.id] === o ? '' : o)}>
                        {o}
                      </button>
                    ))}
                  </div>
                ) : q.kind === 'multi' ? (
                  <div className="bf-chips">
                    {(q.options ?? []).map((o) => {
                      const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []
                      const on = cur.includes(o)
                      return (
                        <button key={o} type="button" aria-pressed={on} className={`bf-chip ${on ? 'is-on' : ''}`} onClick={() => set(q.id, on ? cur.filter((x) => x !== o) : [...cur, o])}>
                          {o}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <input id={`bf-${q.id}`} value={answerText(answers[q.id])} onChange={(e) => set(q.id, e.target.value)} />
                )}
              </div>
            ))}
        </section>
      ))}
      <button className="btn primary bf-send" onClick={() => void submit()} disabled={busy}>
        {busy ? 'enviando…' : 'enviar respostas'}
      </button>
      <p className="muted small center">Suas respostas ficam salvas neste aparelho até você enviar.</p>
    </>,
  )
}
