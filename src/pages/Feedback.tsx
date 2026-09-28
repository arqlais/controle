import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Field, Section } from '../components/ui'
import { toast } from '../components/dialog'
import { useStore } from '../store'
import { PLATFORM } from '../plans'
import { platform, type Feedback as FB } from '../platform'
import { timeLabel } from '../chat'

/* Depoimento de quem usa: estrelas + texto. A pessoa escolhe se autoriza aparecer
   na página de vendas (só nome e profissão); a dona decide quais publicar. */

export default function Feedback() {
  const { data } = useStore()
  const s = data.settings
  const [list, setList] = useState<FB[] | null>(null)
  const [stars, setStars] = useState(5)
  const [text, setText] = useState('')
  const [name, setName] = useState(() => (s.ownerName || '').trim())
  const [role, setRole] = useState('')
  const [allow, setAllow] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => platform.feedbacks().then(setList).catch(() => setList([])), [])
  useEffect(() => {
    void load()
  }, [load])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return toast('Escreva o que achou, nem que seja uma frase.')
    setBusy(true)
    try {
      await platform.sendFeedback({ name: name.trim().slice(0, 80), role: role.trim().slice(0, 80), text: text.trim().slice(0, 600), stars, allowPublish: allow })
      setText('')
      toast('Obrigada pelo depoimento! 💗')
      await load()
    } catch {
      toast('Não foi possível enviar agora. Tente de novo em instantes.')
    }
    setBusy(false)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">sua opinião</p>
          <h1>
            deixar um <em>depoimento</em>
          </h1>
        </div>
      </div>
      <p className="pf-note">
        <Icon name="heart" size={16} />
        <span>Conte como o {PLATFORM.name} ajuda no seu dia a dia. Se você autorizar, seu depoimento pode aparecer na página do {PLATFORM.name}, só com o seu nome e a sua profissão.</span>
      </p>
      <Section title="como está sendo usar?">
        <form className="stack" onSubmit={submit}>
          <div className="fb-stars" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} estrela${n > 1 ? 's' : ''}`} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>
                ★
              </button>
            ))}
          </div>
          <Field label="Seu depoimento">
            <textarea id="fb-text" rows={4} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: meu orçamento levava uma hora, agora sai em dez minutos." />
          </Field>
          <div className="form-grid">
            <Field label="Nome que pode aparecer">
              <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana R." />
            </Field>
            <Field label="Profissão">
              <input value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} placeholder="Ex.: arquiteta, artista 3D" />
            </Field>
          </div>
          <label className="check">
            <input id="fb-allow" type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} /> autorizo que este depoimento apareça na página do {PLATFORM.name} (só nome e profissão)
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? 'enviando…' : 'enviar depoimento'}
          </button>
        </form>
      </Section>
      {!!list?.length && (
        <Section title="seus depoimentos">
          <div className="sg-list">
            {list.map((f) => (
              <article key={f.id} className="sg-item">
                <header>
                  <b className="fb-mini-stars">{'★'.repeat(f.stars)}</b>
                  <small className="muted">{timeLabel(f.createdAt)}</small>
                </header>
                <p>{f.text}</p>
                <small className="muted">
                  {f.published ? 'está na página de vendas ✓' : f.allowPublish ? 'autorizado para a página de vendas' : 'só para a administração'}
                </small>
              </article>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
