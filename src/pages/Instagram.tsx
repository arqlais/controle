import { useState } from 'react'
import { useStore } from '../store'
import { useKeep } from '../keep'
import { Icon } from '../components/Icon'
import { Empty, Field, Modal, MonthPicker, Section, Segmented } from '../components/ui'
import { ask, askDelete, toast } from '../components/dialog'
import { DateInput } from '../components/DateInput'
import { ArtModal } from '../components/PostArt'
import { FORMATS, IDEAS, PILLARS, STRATEGY, WEEK_PLAN, type Idea } from '../instagram'
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
  const [tab, setTab] = useKeep<Tab>('ig-aba', 'plano')
  const [month, setMonth] = useKeep('ig-mes', today().slice(0, 7))
  const [edit, setEdit] = useState<SocialPost | null>(null)

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
    if (!(await ask(`Planejar ${created.length} postagens em ${monthLabel(month)} com as ideias prontas? Dá para editar ou trocar cada uma depois.`, { confirmLabel: 'Planejar' }))) return
    created.forEach((p) => upsert('posts', p))
    toast(`${created.length} postagens planejadas.`)
  }

  const counts = (Object.keys(STATUS) as PostStatus[]).map((k) => ({ k, n: inMonth.filter((p) => p.status === k).length }))

  return (
    <div className="page ig">
      <div className="page-head">
        <div>
          <p className="eyebrow">conteúdo · foco em arquitetos</p>
          <h1>
            planejamento <em>instagram</em>
          </h1>
        </div>
        <div className="row gap-s wrap">
          <button className="btn ghost" onClick={() => setEdit(blank(month === today().slice(0, 7) ? today() : `${month}-01`))}>
            <Icon name="plus" size={16} /> postagem
          </button>
          <button className="btn primary" onClick={planMonth}>
            <Icon name="sparkle" size={16} /> planejar mês
          </button>
        </div>
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'plano', label: 'plano do mês' },
          { value: 'ideias', label: `ideias prontas (${IDEAS.length})` },
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
          {inMonth.length === 0 ? (
            <Empty
              icon="calendar"
              title="Nada planejado neste mês"
              text="Use “planejar mês” para montar a grade com as ideias prontas (carrossel na segunda, reels na quarta, post na sexta e stories na terça e quinta) — depois é só editar."
              action={
                <button className="btn primary" onClick={planMonth}>
                  <Icon name="sparkle" size={16} /> planejar mês
                </button>
              }
            />
          ) : (
            <MonthGrid month={month} posts={inMonth} onOpen={setEdit} onAdd={(date) => setEdit(blank(date))} />
          )}
          <p className="muted small">{STRATEGY.times}</p>
        </>
      )}

      {tab === 'ideias' && <IdeaBank used={used} onUse={(i) => setEdit(fromIdea(i, s, nextFree(posts, i.format, month), WEEK_PLAN.find((w) => w.format === i.format)?.time ?? '12:00'))} />}

      {tab === 'estrategia' && <StrategyView />}

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
            <div key={date} className={`ig-cell ${date === now ? 'is-today' : ''} ${date < now ? 'is-past' : ''}`}>
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
      {/* celular: lista por dia */}
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
                  {isOpen ? 'fechar' : 'ver conteúdo completo'}
                </button>
                {i.caption && (
                  <button className="btn small ghost" onClick={() => copy([personal(i.caption, data.settings), `→ ${i.cta}`, STRATEGY.hashtags[i.tags]].join('\n\n'), 'Legenda')}>
                    <Icon name="copy" size={13} /> legenda
                  </button>
                )}
                <button className="btn small ghost" onClick={() => setArt(i)} title="Arte pronta: PNG, PDF ou para o Canva">
                  <Icon name="sparkle" size={13} /> arte
                </button>
                <button className="btn small primary" onClick={() => onUse(i)}>
                  <Icon name="calendar" size={13} /> agendar
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
