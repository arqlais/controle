import { isBeta } from '../beta'
import { useAccess } from '../access'
import { useState } from 'react'
import { useStore } from '../store'
import { useKeep } from '../keep'
import { Icon } from '../components/Icon'
import { Field, Modal, MonthPicker, Section, Segmented } from '../components/ui'
import { askDelete, toast } from '../components/dialog'
import { DateInput } from '../components/DateInput'
import { ArtModal } from '../components/PostArt'
import { CLIENT_PILLARS, CLIENT_STRATEGY, CLIENT_FORMAT_IDEAS, CLIENT_WEEK_PLAN, FORMATS, IDEAS, PILLARS, STRATEGY, WEEK_PLAN, type Idea } from '../instagram'
import type { PostFormat, PostStatus, Settings, SocialPost } from '../types'
import { fmtDate, today, uid } from '../utils'

/* Planejamento do instagram: plano do mês (calendário de postagens), banco de ideias prontas
   (carrossel, reels, story e post, com roteiro, legenda e ideia de arte) e a estratégia. */

type Tab = 'plano' | 'ideias' | 'estrategia'
const STATUS: Record<PostStatus, { label: string; color: string }> = {
  ideia: { label: 'ideia', color: '#9aa1a9' },
  produzindo: { label: 'produzindo', color: '#c49a5a' },
  pronto: { label: 'pronto', color: '#5b7fa6' },
  postado: { label: 'postado', color: '#6a9a74' },
}
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const pillarLabel = (id: string) => PILLARS.find((p) => p.id === id)?.label ?? id

/** Troca o nome de exemplo pelo nome de quem usa o sistema. */
const personal = (t: string, s: Settings) => {
  const name = (s.ownerName || s.brandName || '').trim().split(' ')[0].toLowerCase()
  return name ? t.replace(/\blaís\b/g, name) : t
}

const fromIdea = (i: Idea, s: Settings, date = '', time = ''): SocialPost => ({
  id: uid(),
  date,
  time,
  format: i.format,
  pillar: i.pillar,
  title: personal(i.title, s),
  hook: personal(i.hook, s),
  script: personal(i.script, s),
  caption: personal(i.caption, s),
  art: i.art,
  cta: i.cta,
  hashtags: STRATEGY.hashtags[i.tags],
  status: 'ideia',
  ideaId: i.id,
})

const blank = (date = today()): SocialPost => ({ id: uid(), date, time: '12:00', format: 'carrossel', pillar: 'portfolio', title: '', hook: '', script: '', caption: '', art: '', cta: '', hashtags: STRATEGY.hashtags.arquitetos, status: 'ideia' })

const copy = (text: string, what = 'Texto') =>
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast(`${what} copiado.`))
    .catch(() => toast('Selecione o texto e copie.'))

const fullCaption = (p: SocialPost) => [p.caption, p.cta && `→ ${p.cta}`, p.hashtags].filter(Boolean).join('\n\n')

export default function Instagram() {
  const { data, upsert } = useStore()
  const s = data.settings
  const posts = data.posts ?? []
  // ideias prontas e estratégia são do conteúdo da Laís: quem assina monta o próprio plano
  const mine = useAccess().has('modeloExclusivo')
  const [savedTab, setTab] = useKeep<Tab>('ig-aba', 'plano')
  const tab: Tab = mine || savedTab !== 'ideias' ? savedTab : 'plano'
  const [month, setMonth] = useKeep('ig-mes', today().slice(0, 7))
  const [edit, setEdit] = useState<SocialPost | null>(null)
  // sugestão do mês: abre para escolher e ajustar cada postagem antes de entrar no calendário
  const [review, setReview] = useState<SocialPost[] | null>(null)
  // dia escolhido no calendário: abre o planejamento do dia com sugestões
  const [day, setDay] = useState<string | null>(null)

  const inMonth = posts.filter((p) => p.date.startsWith(month)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const used = new Set(posts.map((p) => p.ideaId).filter(Boolean))

  // planejar o mês: segue a semana sugerida e usa as ideias que ainda não foram usadas
  const planMonth = async () => {
    const [y, m] = month.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const queue: Record<PostFormat, Idea[]> = { carrossel: [], reels: [], story: [], post: [] }
    for (const i of IDEAS) if (!used.has(i.id)) queue[i.format].push(i)
    // estudantes aparecem pouco: ficam no fim da fila
    for (const f of Object.keys(queue) as PostFormat[]) queue[f].sort((a, b) => Number(a.pillar === 'estudantes') - Number(b.pillar === 'estudantes'))
    const created: SocialPost[] = []
    const turn: Partial<Record<PostFormat, number>> = {}
    for (let d = 1; d <= days; d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`
      if (date < today()) continue
      const slot = WEEK_PLAN.find((w) => w.weekday === new Date(y, m - 1, d).getDay())
      if (!slot) continue
      if (posts.some((p) => p.date === date && p.format === slot.format)) continue
      // sexta alterna post e carrossel de portfólio para variar a grade
      const format: PostFormat = slot.format === 'post' && d % 2 === 0 && queue.carrossel.length ? 'carrossel' : slot.format
      // acabaram as ideias novas desse formato: repete em rodízio (nunca a mesma seguida)
      const all = IDEAS.filter((i) => i.format === format && i.pillar !== 'estudantes')
      const idea = queue[format].shift() ?? all[(turn[format] = (turn[format] ?? -1) + 1) % all.length]
      if (idea) created.push(fromIdea(idea, s, date, slot.time))
    }
    if (!created.length) return toast('O mês já está planejado (ou já passou).')
    setReview(created)
  }

  // quem assina: a grade segue a estratégia própria, com o tema de cada dia (sem textos prontos)
  const planClientMonth = async () => {
    const [y, m] = month.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const created: SocialPost[] = []
    for (let d = 1; d <= days; d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`
      if (date < today()) continue
      const slot = CLIENT_WEEK_PLAN.find((w) => w.weekday === new Date(y, m - 1, d).getDay())
      if (!slot || posts.some((p) => p.date === date && p.format === slot.format)) continue
      created.push({ ...blank(date), time: slot.time, format: slot.format, pillar: slot.pillar, title: slot.title, hashtags: CLIENT_STRATEGY.hashtags[0][1] })
    }
    if (!created.length) return toast('O mês já está planejado (ou já passou).')
    setReview(created)
  }

  const counts = (Object.keys(STATUS) as PostStatus[]).map((k) => ({ k, n: inMonth.filter((p) => p.status === k).length }))

  return (
    <div className="page ig">
      <div className="page-head">
        <div>
          <p className="eyebrow">{mine ? 'conteúdo · foco em arquitetos' : 'conteúdo'}</p>
          <h1>
            planejamento <em>instagram</em>
          </h1>
        </div>
        <div className="row gap-s wrap">
          <button className="btn ghost" onClick={() => setEdit(blank(month === today().slice(0, 7) ? today() : `${month}-01`))}>
            <Icon name="plus" size={16} /> postagem
          </button>
          <button className="btn primary" onClick={mine ? planMonth : planClientMonth}>
            <Icon name="sparkle" size={16} /> planejar mês
          </button>
        </div>
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'plano', label: 'plano do mês' },
          ...(mine ? [{ value: 'ideias' as Tab, label: `ideias prontas (${IDEAS.length})` }] : []),
          { value: 'estrategia', label: 'estratégia' },
        ]}
      />

      {tab === 'plano' && (
        <>
          <div className="ig-month">
            <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior">
              <Icon name="chevronL" />
            </button>
            <MonthPicker value={month} onChange={setMonth} />
            <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês">
              <Icon name="chevronR" />
            </button>
            <div className="ig-counts">
              {counts.map(({ k, n }) => (
                <span key={k} className="ig-count">
                  <i style={{ background: STATUS[k].color }} /> {n} {STATUS[k].label}
                </span>
              ))}
            </div>
          </div>
          {inMonth.length === 0 && (
            <p className="ig-hint">
              <Icon name="sparkle" size={14} /> Toque num dia para planejar, com sugestões para ele. Quer o mês todo de uma vez? Use “planejar mês”.
            </p>
          )}
          <MonthGrid month={month} posts={inMonth} onOpen={setEdit} onAdd={setDay} />
          <p className="muted small">{mine ? STRATEGY.times : CLIENT_STRATEGY.times}</p>
        </>
      )}

      {tab === 'ideias' && <IdeaBank used={used} onUse={(i) => setEdit(fromIdea(i, s, nextFree(posts, i.format, month), WEEK_PLAN.find((w) => w.format === i.format)?.time ?? '12:00'))} />}

      {tab === 'estrategia' && (mine ? <StrategyView /> : <ClientStrategyView />)}

      {review && (
        <PlanReview
          month={monthLabel(month)}
          items={review}
          ideas={mine ? IDEAS : []}
          settings={s}
          onClose={() => setReview(null)}
          onSave={(list) => {
            list.forEach((p) => upsert('posts', p))
            toast(`${list.length} postagem(ns) no calendário.`)
            setReview(null)
          }}
        />
      )}
      {day && (
        <DayPlanner
          date={day}
          mine={mine}
          used={used}
          settings={s}
          existing={posts.filter((p) => p.date === day)}
          onClose={() => setDay(null)}
          onPick={(p) => {
            setDay(null)
            setEdit(p)
          }}
        />
      )}
      {edit && <PostEditor post={edit} exists={posts.some((p) => p.id === edit.id)} onClose={() => setEdit(null)} />}
    </div>
  )
}

const monthLabel = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const shiftMonth = (m: string, n: number) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
/** Próximo dia livre do formato no mês (segue a semana sugerida). */
function nextFree(posts: SocialPost[], format: PostFormat, month: string) {
  const start = month > today().slice(0, 7) ? `${month}-01` : today()
  const d = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)))
  const days = WEEK_PLAN.filter((w) => w.format === format).map((w) => w.weekday)
  for (let i = 0; i < 60; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if ((!days.length || days.includes(d.getDay())) && !posts.some((p) => p.date === key)) return key
    d.setDate(d.getDate() + 1)
  }
  return start
}

function MonthGrid({ month, posts, onOpen, onAdd }: { month: string; posts: SocialPost[]; onOpen: (p: SocialPost) => void; onAdd: (date: string) => void }) {
  const { upsert } = useStore()
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay()
  const days = new Date(y, m, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const now = today()
  return (
    <>
      {/* computador: calendário do mês */}
      <div className="ig-grid hide-mobile">
        {WEEKDAYS.map((w) => (
          <span key={w} className="ig-wd">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} className="ig-cell is-empty" />
          const date = `${month}-${String(d).padStart(2, '0')}`
          const list = posts.filter((p) => p.date === date)
          return (
            <div key={date} className={`ig-cell ${date === now ? 'is-today' : ''} ${date < now ? 'is-past' : ''}`} onClick={(e) => e.target === e.currentTarget && onAdd(date)}>
              <div className="ig-cell-head">
                <b>{d}</b>
                <button className="ig-add" onClick={() => onAdd(date)} aria-label="Nova postagem neste dia">
                  <Icon name="plus" size={12} />
                </button>
              </div>
              {list.map((p) => (
                <button key={p.id} className={`ig-chip status-${p.status}`} style={{ borderLeftColor: FORMATS[p.format].color }} onClick={() => onOpen(p)} title={p.title}>
                  <span className="ig-chip-format">{FORMATS[p.format].label}</span>
                  <span className="ig-chip-title">{p.title || 'sem título'}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
      {/* celular: calendário pequeno (toque no dia para planejar) + lista */}
      <div className="ig-mini only-mobile-block">
        {WEEKDAYS.map((w) => (
          <span key={w} className="ig-wd">
            {w.slice(0, 1)}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`m${i}`} />
          const date = `${month}-${String(d).padStart(2, '0')}`
          const list = posts.filter((p) => p.date === date)
          return (
            <button key={date} type="button" className={`ig-mini-day ${date === now ? 'is-today' : ''} ${date < now ? 'is-past' : ''}`} onClick={() => onAdd(date)} aria-label={`Planejar dia ${d}`}>
              <b>{d}</b>
              <span className="ig-mini-dots">
                {list.slice(0, 3).map((p) => (
                  <i key={p.id} style={{ background: FORMATS[p.format].color }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <ul className="ig-list only-mobile-block">
        {posts.map((p) => {
          const dt = new Date(Number(p.date.slice(0, 4)), Number(p.date.slice(5, 7)) - 1, Number(p.date.slice(8, 10)))
          return (
            <li key={p.id} className={p.date < now ? 'is-past' : ''}>
              <button className="ig-list-day" onClick={() => onOpen(p)}>
                <b>{p.date.slice(8, 10)}</b>
                <span>{WEEKDAYS[dt.getDay()]}</span>
              </button>
              <button className="ig-list-main" onClick={() => onOpen(p)}>
                <span className="ig-format" style={{ background: FORMATS[p.format].color }}>
                  {FORMATS[p.format].label}
                </span>
                <span className="ig-list-title">{p.title || 'sem título'}</span>
                <span className="muted small">
                  {pillarLabel(p.pillar)}
                  {p.time ? ` · ${p.time}` : ''}
                </span>
              </button>
              <select className="status-select" value={p.status} style={{ color: STATUS[p.status].color, borderColor: `${STATUS[p.status].color}66` }} onChange={(e) => upsert('posts', { ...p, status: e.target.value as PostStatus })} aria-label="Situação">
                {(Object.keys(STATUS) as PostStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {STATUS[k].label}
                  </option>
                ))}
              </select>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function IdeaBank({ used, onUse }: { used: Set<string | undefined>; onUse: (i: Idea) => void }) {
  const { data } = useStore()
  const [format, setFormat] = useKeep<PostFormat | 'todos'>('ig-ideias-formato', 'todos')
  const [pillar, setPillar] = useKeep<string>('ig-ideias-pilar', '')
  const [open, setOpen] = useState<string | null>(null)
  const [art, setArt] = useState<Idea | null>(null)
  const list = IDEAS.filter((i) => (format === 'todos' || i.format === format) && (!pillar || i.pillar === pillar))
  return (
    <>
      <div className="toolbar">
        <Segmented<PostFormat | 'todos'>
          value={format}
          onChange={setFormat}
          options={[{ value: 'todos', label: 'todos' }, ...(Object.keys(FORMATS) as PostFormat[]).map((f) => ({ value: f, label: FORMATS[f].label }))]}
        />
        <select value={pillar} onChange={(e) => setPillar(e.target.value)}>
          <option value="">Todos os temas</option>
          {PILLARS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {format !== 'todos' && <p className="muted small">{FORMATS[format].hint}</p>}
      {art && (
        <ArtModal
          settings={data.settings}
          source={{ format: art.format, title: personal(art.title, data.settings), hook: personal(art.hook, data.settings), script: personal(art.script, data.settings), cta: art.cta, pillar: pillarLabel(art.pillar) }}
          onClose={() => setArt(null)}
        />
      )}
      <div className="ig-ideas">
        {list.map((i) => {
          const isOpen = open === i.id
          return (
            <article key={i.id} className={`ig-idea ${isOpen ? 'is-open' : ''}`}>
              <div className="ig-idea-top">
                <span className="ig-format" style={{ background: FORMATS[i.format].color }}>
                  {FORMATS[i.format].label}
                </span>
                <span className="muted small">{pillarLabel(i.pillar)}</span>
                {used.has(i.id) && <span className="ig-used">já no plano</span>}
              </div>
              <h3>{personal(i.title, data.settings)}</h3>
              <p className="ig-hook">“{personal(i.hook, data.settings)}”</p>
              {isOpen && (
                <div className="ig-idea-body">
                  <h4>{i.format === 'carrossel' ? 'slides' : i.format === 'reels' ? 'roteiro' : i.format === 'story' ? 'telas' : 'imagem'}</h4>
                  <ol>
                    {personal(i.script, data.settings)
                      .split('\n')
                      .map((l, k) => (
                        <li key={k}>{l}</li>
                      ))}
                  </ol>
                  {i.caption && (
                    <>
                      <h4>legenda</h4>
                      <p className="ig-pre">{personal(i.caption, data.settings)}</p>
                    </>
                  )}
                  <h4>ideia de arte</h4>
                  <p>{i.art}</p>
                  <h4>chamada</h4>
                  <p>{i.cta}</p>
                  <h4>hashtags</h4>
                  <p className="muted small">{STRATEGY.hashtags[i.tags]}</p>
                </div>
              )}
              <div className="ig-idea-actions">
                <button className="link small" onClick={() => setOpen(isOpen ? null : i.id)}>
                  {isOpen ? 'fechar' : 'ver completo'}
                </button>
                {i.caption && (
                  <button className="icon-btn ig-act" title="Copiar legenda" aria-label="Copiar legenda" onClick={() => copy([personal(i.caption, data.settings), `→ ${i.cta}`, STRATEGY.hashtags[i.tags]].join('\n\n'), 'Legenda')}>
                    <Icon name="copy" size={15} />
                  </button>
                )}
                <button className="icon-btn ig-act" title="Arte pronta (PNG, PDF ou Canva)" aria-label="Arte pronta" onClick={() => setArt(i)}>
                  <Icon name="sparkle" size={15} />
                </button>
                <button className="btn small primary" onClick={() => onUse(i)}>
                  agendar
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

function StrategyView() {
  const { data } = useStore()
  return (
    <div className="ig-strategy">
      <Section title="objetivo">
        <p className="ig-goal">{STRATEGY.goal}</p>
        <h4 className="ig-h">para quem</h4>
        <ul className="ig-bullets">
          {STRATEGY.audience.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Section>
      <Section title="temas (pilares) e quanto de cada">
        <div className="ig-pillars">
          {PILLARS.map((p) => (
            <div key={p.id} className="ig-pillar">
              <div className="ig-pillar-head">
                <b>{p.label}</b>
                <span>{p.share}%</span>
              </div>
              <div className="progress thin">
                <div className="progress-bar" style={{ width: `${p.share}%` }} />
              </div>
              <p className="muted small">{p.text}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="semana ideal">
        <ul className="ig-week">
          {STRATEGY.frequency.map((f) => (
            <li key={f.day}>
              <b>{f.day}</b>
              <span>{f.what}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">{STRATEGY.times}</p>
      </Section>
      <Section title="perfil">
        <h4 className="ig-h">bio sugerida</h4>
        <div className="ig-bio">
          {STRATEGY.bio.map((l) => (
            <div key={l}>{l}</div>
          ))}
          <button className="btn small ghost" onClick={() => copy(STRATEGY.bio.join('\n'), 'Bio')}>
            <Icon name="copy" size={13} /> copiar bio
          </button>
        </div>
        <h4 className="ig-h">destaques</h4>
        <div className="ig-highlights">
          {STRATEGY.highlights.map((h) => (
            <span key={h} className="ig-highlight">
              {h}
            </span>
          ))}
        </div>
        <h4 className="ig-h">checklist do perfil</h4>
        <ul className="ig-bullets">
          {STRATEGY.profile.map((a) => (
            <li key={a}>{personal(a, data.settings)}</li>
          ))}
        </ul>
      </Section>
      <Section title="hashtags">
        {(Object.keys(STRATEGY.hashtags) as (keyof typeof STRATEGY.hashtags)[]).map((k) => (
          <div key={k} className="ig-tags">
            <b>{k === 'arquitetos' ? 'arquitetos e interiores' : k === 'tecnico' ? 'executivo e detalhamento' : 'estudantes'}</b>
            <p className="muted small">{STRATEGY.hashtags[k]}</p>
            <button className="btn small ghost" onClick={() => copy(STRATEGY.hashtags[k], 'Hashtags')}>
              <Icon name="copy" size={13} /> copiar
            </button>
          </div>
        ))}
      </Section>
      <Section title="o que acompanhar todo mês">
        <ul className="ig-bullets">
          {STRATEGY.metrics.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function PostEditor({ post, exists, onClose }: { post: SocialPost; exists: boolean; onClose: () => void }) {
  const { upsert, remove } = useStore()
  const [p, setP] = useState(post)
  const [art, setArt] = useState(false)
  const { data } = useStore()
  const set = (patch: Partial<SocialPost>) => setP((x) => ({ ...x, ...patch }))
  const save = () => {
    if (!p.title.trim()) return toast('Dê um título para a postagem.')
    upsert('posts', p)
    toast(exists ? 'Postagem salva.' : `Agendada para ${p.date ? fmtDate(p.date) : 'sem data'}.`)
    onClose()
  }
  const label = p.format === 'carrossel' ? 'Slides (um por linha)' : p.format === 'reels' ? 'Roteiro (uma cena por linha)' : p.format === 'story' ? 'Telas (uma por linha)' : 'Imagem'
  return (
    <Modal
      wide
      title={exists ? 'postagem' : 'nova postagem'}
      onClose={onClose}
      footer={
        <>
          {exists && (
            <button
              className="btn ghost danger"
              onClick={async () => {
                if (await askDelete(`a postagem “${p.title}”`)) {
                  remove('posts', p.id)
                  onClose()
                }
              }}
            >
              <Icon name="trash" size={15} /> excluir
            </button>
          )}
          <button className="btn ghost" onClick={() => setArt(true)}>
            <Icon name="sparkle" size={15} /> arte
          </button>
          <button className="btn ghost" onClick={() => copy(fullCaption(p), 'Legenda')}>
            <Icon name="copy" size={15} /> copiar legenda
          </button>
          <button className="btn primary" onClick={save}>
            <Icon name="check" size={15} /> salvar
          </button>
        </>
      }
    >
      {art && <ArtModal settings={data.settings} source={{ format: p.format, title: p.title, hook: p.hook, script: p.script, cta: p.cta, pillar: pillarLabel(p.pillar) }} onClose={() => setArt(false)} />}
      <div className="form-grid">
        <Field label="Título" span={3}>
          <input value={p.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: antes × depois da cozinha" />
        </Field>
        <Field label="Data">
          <DateInput value={p.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Horário">
          <input type="time" value={p.time} onChange={(e) => set({ time: e.target.value })} />
        </Field>
        <Field label="Situação">
          <select value={p.status} onChange={(e) => set({ status: e.target.value as PostStatus })}>
            {(Object.keys(STATUS) as PostStatus[]).map((k) => (
              <option key={k} value={k}>
                {STATUS[k].label}
              </option>
            ))}
          </select>
        </Field>
        <Field group label="Formato" span={2}>
          <Segmented<PostFormat> value={p.format} onChange={(format) => set({ format })} options={(Object.keys(FORMATS) as PostFormat[]).map((f) => ({ value: f, label: FORMATS[f].label }))} />
        </Field>
        <Field label="Tema">
          <select value={p.pillar} onChange={(e) => set({ pillar: e.target.value })}>
            {PILLARS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Gancho (capa / primeira frase)" span={3}>
          <input value={p.hook} onChange={(e) => set({ hook: e.target.value })} />
        </Field>
        <Field label={label} span={3}>
          <textarea rows={6} value={p.script} onChange={(e) => set({ script: e.target.value })} spellCheck lang="pt-BR" />
        </Field>
        <Field label="Legenda" span={3}>
          <textarea rows={5} value={p.caption} onChange={(e) => set({ caption: e.target.value })} spellCheck lang="pt-BR" />
        </Field>
        <Field label="Ideia de arte" span={3}>
          <textarea rows={2} value={p.art} onChange={(e) => set({ art: e.target.value })} spellCheck lang="pt-BR" />
        </Field>
        <Field label="Chamada (o que a pessoa deve fazer)" span={3}>
          <input value={p.cta} onChange={(e) => set({ cta: e.target.value })} />
        </Field>
        <Field label="Hashtags" span={3}>
          <textarea rows={2} value={p.hashtags} onChange={(e) => set({ hashtags: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}

/** Estratégia de quem assina: própria, diferente da da Laís. */
function ClientStrategyView() {
  const st = CLIENT_STRATEGY
  return (
    <div className="ig-strategy">
      <Section title="objetivo">
        <p className="ig-goal">{st.goal}</p>
        <h4 className="ig-h">para quem você fala</h4>
        <ul className="ig-bullets">
          {st.audience.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Section>
      <Section title="o método: mostrar · ensinar · aproximar">
        <div className="ig-pillars">
          {CLIENT_PILLARS.map((p) => (
            <div key={p.id} className="ig-pillar">
              <div className="ig-pillar-head">
                <b>{p.label}</b>
                <span>{p.share}%</span>
              </div>
              <div className="progress thin">
                <div className="progress-bar" style={{ width: `${p.share}%` }} />
              </div>
              <p className="muted small">{p.text}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="semana (4 publicações)">
        <ul className="ig-week">
          {st.frequency.map((f) => (
            <li key={f.day}>
              <b>{f.day}</b>
              <span>{f.what}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">{st.times}</p>
      </Section>
      <Section title="perfil">
        <h4 className="ig-h">modelo de bio</h4>
        <div className="ig-bio">
          {st.bio.map((l) => (
            <div key={l}>{l}</div>
          ))}
          <button className="btn small ghost" onClick={() => copy(st.bio.join('\n'), 'Bio')}>
            <Icon name="copy" size={13} /> copiar modelo
          </button>
        </div>
        <h4 className="ig-h">destaques</h4>
        <div className="ig-highlights">
          {st.highlights.map((h) => (
            <span key={h} className="ig-highlight">
              {h}
            </span>
          ))}
        </div>
        <h4 className="ig-h">checklist do perfil</h4>
        <ul className="ig-bullets">
          {st.profile.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Section>
      <Section title="hashtags (escolha 5 a 8 por post)">
        {st.hashtags.map(([label, tags]) => (
          <div key={label} className="ig-tags">
            <b>{label}</b>
            <p className="muted small">{tags}</p>
            <button className="btn small ghost" onClick={() => copy(tags, 'Hashtags')}>
              <Icon name="copy" size={13} /> copiar
            </button>
          </div>
        ))}
      </Section>
      <Section title="o que acompanhar todo mês">
        <ul className="ig-bullets">
          {st.metrics.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

/** Sugestão do mês para escolher: marca as que quer, troca dia, formato, tema ou ideia antes de salvar. */
function PlanReview({ month, items, ideas, settings, onClose, onSave }: { month: string; items: SocialPost[]; ideas: Idea[]; settings: Settings; onClose: () => void; onSave: (list: SocialPost[]) => void }) {
  const [list, setList] = useState(items.map((p) => ({ p, on: true })))
  const set = (i: number, patch: Partial<SocialPost>) => setList((l) => l.map((x, k) => (k === i ? { ...x, p: { ...x.p, ...patch } } : x)))
  const chosen = list.filter((x) => x.on)
  return (
    <Modal
      wide
      title={`sugestão para ${month}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            cancelar
          </button>
          <button className="btn primary" disabled={!chosen.length} onClick={() => onSave(chosen.map((x) => x.p))}>
            adicionar {chosen.length} ao calendário
          </button>
        </>
      }
    >
      <p className="muted small">Escolha quais postagens você quer e ajuste o que precisar. Nada entra no calendário até você confirmar, e depois ainda dá para editar cada uma.</p>
      <div className="row gap-s">
        <button className="link small" onClick={() => setList((l) => l.map((x) => ({ ...x, on: true })))}>marcar todas</button>
        <button className="link small" onClick={() => setList((l) => l.map((x) => ({ ...x, on: false })))}>desmarcar todas</button>
      </div>
      <div className="ig-review">
        {list.map(({ p, on }, i) => (
          <div key={p.id} className={`ig-review-row ${on ? '' : 'is-off'}`}>
            <label className="check">
              <input type="checkbox" checked={on} onChange={(e) => setList((l) => l.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)))} aria-label="Incluir esta postagem" />
            </label>
            <DateInput value={p.date} onChange={(e) => e.target.value && set(i, { date: e.target.value })} />
            <select value={p.format} onChange={(e) => set(i, { format: e.target.value as PostFormat })} aria-label="Formato">
              {(Object.keys(FORMATS) as PostFormat[]).map((f) => (
                <option key={f} value={f}>
                  {FORMATS[f].label}
                </option>
              ))}
            </select>
            {ideas.length ? (
              <select
                value={p.ideaId ?? ''}
                onChange={(e) => {
                  const idea = ideas.find((x) => x.id === e.target.value)
                  if (idea) set(i, { ...fromIdea(idea, settings, p.date, p.time), id: p.id })
                }}
                aria-label="Ideia"
              >
                {!p.ideaId && <option value="">{p.title}</option>}
                {ideas
                  .filter((x) => x.format === p.format)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
              </select>
            ) : (
              <input value={p.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="tema da postagem" aria-label="Tema" />
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}

/** Planejar um dia: sugestões para ele (pela sua semana), o que já existe nele e a opção em branco. */
/** Versão de antes (lista de sugestões do dia): quem assina vê esta até os cartões saírem do teste. */
function DayPlannerList({ date, mine, used, settings, existing, onClose, onPick }: { date: string; mine: boolean; used: Set<string | undefined>; settings: Settings; existing: SocialPost[]; onClose: () => void; onPick: (p: SocialPost) => void }) {
  const dt = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
  const wd = dt.getDay()
  const [page, setPage] = useState(0)
  const slot = mine ? WEEK_PLAN.find((w) => w.weekday === wd) : CLIENT_WEEK_PLAN.find((w) => w.weekday === wd)
  const time = slot?.time ?? '12:00'
  // quem é a Laís: ideias prontas (as do formato do dia primeiro, as ainda não usadas antes)
  const ideas = mine
    ? IDEAS.filter((i) => i.pillar !== 'estudantes').sort((a, b) => Number(b.format === slot?.format) - Number(a.format === slot?.format) || Number(used.has(a.id)) - Number(used.has(b.id)))
    : []
  const shown = ideas.slice(page * 5, page * 5 + 5)
  // quem assina: os temas da própria estratégia (o do dia primeiro)
  const themes = mine ? [] : [...CLIENT_WEEK_PLAN].sort((a, b) => Number(b.weekday === wd) - Number(a.weekday === wd))
  return (
    <Modal title={dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={onClose}>
      {existing.length > 0 && (
        <div className="ig-day-block">
          <span className="field-label">já planejado neste dia</span>
          {existing.map((p) => (
            <button key={p.id} type="button" className="ig-sug" onClick={() => onPick(p)}>
              <span className="ig-format" style={{ background: FORMATS[p.format].color }}>{FORMATS[p.format].label}</span>
              <span className="grow">{p.title || 'sem título'}</span>
              <span className="muted small">abrir</span>
            </button>
          ))}
        </div>
      )}
      <div className="ig-day-block">
        <span className="field-label">{slot ? `sugestão para este dia: ${FORMATS[slot.format].label.toLowerCase()} às ${slot.time}` : 'sugestões'}</span>
        {mine
          ? shown.map((i) => (
              <button key={i.id} type="button" className={`ig-sug ${used.has(i.id) ? 'is-used' : ''}`} onClick={() => onPick(fromIdea(i, settings, date, time))}>
                <span className="ig-format" style={{ background: FORMATS[i.format].color }}>{FORMATS[i.format].label}</span>
                <span className="grow">{i.title}</span>
                {used.has(i.id) && <span className="muted small">já usada</span>}
              </button>
            ))
          : themes.map((t) => (
              <button key={t.title} type="button" className="ig-sug" onClick={() => onPick({ ...blank(date), time: t.time, format: t.format, pillar: t.pillar, title: t.title, hashtags: CLIENT_STRATEGY.hashtags[0][1] })}>
                <span className="ig-format" style={{ background: FORMATS[t.format].color }}>{FORMATS[t.format].label}</span>
                <span className="grow">{t.title}</span>
              </button>
            ))}
        {mine && ideas.length > 5 && (
          <button type="button" className="link small" onClick={() => setPage((n) => ((n + 1) * 5 >= ideas.length ? 0 : n + 1))}>
            ver outras sugestões
          </button>
        )}
      </div>
      <button type="button" className="btn block" onClick={() => onPick({ ...blank(date), time })}>
        <Icon name="plus" size={15} /> começar em branco
      </button>
    </Modal>
  )
}

type DayFormat = 'story' | 'reels' | 'post'
const DAY_CARDS: { id: DayFormat; label: string; hint: string; icon: string }[] = [
  { id: 'story', label: 'story', hint: 'bastidores, enquetes e venda para quem já te segue', icon: 'smartphone' },
  { id: 'reels', label: 'reels', hint: 'vídeo curto: leva o perfil para gente nova', icon: 'camera' },
  { id: 'post', label: 'post', hint: 'feed: imagem ou carrossel que ensina e fica salvo', icon: 'grid' },
]
const asDay = (f?: PostFormat): DayFormat | null => (!f ? null : f === 'carrossel' ? 'post' : f)

function DayPlanner(props: Parameters<typeof DayPlannerList>[0]) {
  return isBeta() ? <DayPlannerCards {...props} /> : <DayPlannerList {...props} />
}

function DayPlannerCards({ date, mine, used, settings, existing, onClose, onPick }: { date: string; mine: boolean; used: Set<string | undefined>; settings: Settings; existing: SocialPost[]; onClose: () => void; onPick: (p: SocialPost) => void }) {
  const dt = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
  const wd = dt.getDay()
  const [page, setPage] = useState(0)
  const [fmt, setFmt] = useState<DayFormat | null>(null)
  const slot = mine ? WEEK_PLAN.find((w) => w.weekday === wd) : CLIENT_WEEK_PLAN.find((w) => w.weekday === wd)
  const suggested = asDay(slot?.format)
  const time = slot && asDay(slot.format) === fmt ? slot.time : fmt === 'reels' ? '19:00' : '12:00'
  const inFmt = (f: PostFormat) => asDay(f) === fmt
  // quem é a Laís: ideias prontas do formato escolhido (as ainda não usadas primeiro)
  const ideas = mine && fmt ? IDEAS.filter((i) => i.pillar !== 'estudantes' && inFmt(i.format)).sort((a, b) => Number(used.has(a.id)) - Number(used.has(b.id))) : []
  const shown = ideas.slice(page * 5, page * 5 + 5)
  // quem assina: tema da estratégia do dia (se for deste formato) + ideias do formato
  const themes = !mine && fmt ? [...CLIENT_WEEK_PLAN.filter((t) => inFmt(t.format)).map((t) => ({ title: t.title, pillar: t.pillar, format: t.format })), ...CLIENT_FORMAT_IDEAS[fmt].map((t) => ({ ...t, format: (fmt === 'post' && /carrossel/.test(t.title) ? 'carrossel' : fmt) as PostFormat }))] : []
  const count = (f: DayFormat) => (mine ? IDEAS.filter((i) => i.pillar !== 'estudantes' && asDay(i.format) === f).length : CLIENT_FORMAT_IDEAS[f].length + CLIENT_WEEK_PLAN.filter((t) => asDay(t.format) === f).length)
  return (
    <Modal title={dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={onClose}>
      {existing.length > 0 && (
        <div className="ig-day-block">
          <span className="field-label">já planejado neste dia</span>
          {existing.map((p) => (
            <button key={p.id} type="button" className="ig-sug" onClick={() => onPick(p)}>
              <span className="ig-format" style={{ background: FORMATS[p.format].color }}>{FORMATS[p.format].label}</span>
              <span className="grow">{p.title || 'sem título'}</span>
              <span className="muted small">abrir</span>
            </button>
          ))}
        </div>
      )}
      {!fmt ? (
        <div className="ig-day-block">
          <span className="field-label">o que você quer postar?</span>
          <div className="ig-fmt-cards">
            {DAY_CARDS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`ig-fmt-card ${suggested === c.id ? 'is-suggested' : ''}`}
                style={{ ['--fmt' as string]: FORMATS[c.id].color }}
                onClick={() => {
                  setFmt(c.id)
                  setPage(0)
                }}
              >
                <span className="ig-fmt-icon">
                  <Icon name={c.icon} size={20} />
                </span>
                <b>{c.label}</b>
                <small>{c.hint}</small>
                <em>
                  {count(c.id)} ideias{suggested === c.id ? ' · sugerido hoje' : ''}
                </em>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ig-day-block">
          <button type="button" className="link small ig-back" onClick={() => setFmt(null)}>
            <Icon name="chevronL" size={13} /> outros formatos
          </button>
          <span className="field-label">
            ideias de {fmt}
            {slot && suggested === fmt ? ` · sugerido às ${slot.time}` : ''}
          </span>
          {mine
            ? shown.map((i) => (
                <button key={i.id} type="button" className={`ig-sug ${used.has(i.id) ? 'is-used' : ''}`} onClick={() => onPick(fromIdea(i, settings, date, time))}>
                  <span className="ig-format" style={{ background: FORMATS[i.format].color }}>{FORMATS[i.format].label}</span>
                  <span className="grow">{i.title}</span>
                  {used.has(i.id) && <span className="muted small">já usada</span>}
                </button>
              ))
            : themes.map((t) => (
                <button key={t.title} type="button" className="ig-sug" onClick={() => onPick({ ...blank(date), time, format: t.format, pillar: t.pillar, title: t.title, hashtags: CLIENT_STRATEGY.hashtags[0][1] })}>
                  <span className="ig-format" style={{ background: FORMATS[t.format].color }}>{FORMATS[t.format].label}</span>
                  <span className="grow">{t.title}</span>
                </button>
              ))}
          {mine && ideas.length > 5 && (
            <button type="button" className="link small" onClick={() => setPage((n) => ((n + 1) * 5 >= ideas.length ? 0 : n + 1))}>
              ver outras sugestões
            </button>
          )}
        </div>
      )}
      <button type="button" className="btn block" onClick={() => onPick({ ...blank(date), time, ...(fmt ? { format: fmt } : {}) })}>
        <Icon name="plus" size={15} /> começar em branco{fmt ? ` (${fmt})` : ''}
      </button>
    </Modal>
  )
}
