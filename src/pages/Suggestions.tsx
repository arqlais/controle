import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Badge, Empty, Field, Section, Segmented } from '../components/ui'
import { toast } from '../components/dialog'
import { PLATFORM } from '../plans'
import { SUGGESTION_CATEGORY, SUGGESTION_STATUS, platform, type Suggestion, type SuggestionCategory } from '../platform'
import { timeLabel } from '../chat'
import { RichText } from '../components/RichText'

/* Sugestões de melhoria: quem usa conta o que gostaria de ter nas próximas atualizações
   e acompanha a situação (recebida → em análise → planejada → feita) e a resposta. */

export default function Suggestions({ unseen = [], onSeen }: { unseen?: string[]; onSeen?: () => void }) {
  const [list, setList] = useState<Suggestion[] | null>(null)
  const [category, setCategory] = useState<SuggestionCategory>('nova')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => platform.suggestions().then(setList).catch(() => setList([])), [])
  useEffect(() => {
    void load()
  }, [load])
  // abriu a tela: as respostas novas deixam de contar no menu (o destaque fica até sair)
  const [fresh] = useState(unseen)
  useEffect(() => {
    if (unseen.length) onSeen?.()
  }, [unseen.length, onSeen])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return toast('Escreva a sua ideia em uma frase.')
    setBusy(true)
    try {
      await platform.suggest({ category, title: title.trim().slice(0, 140), body: body.trim().slice(0, 4000) })
      // avisa a dona por e-mail
      void platform.notice({ tipo: 'sugestao', title: title.trim().slice(0, 140), text: `${SUGGESTION_CATEGORY[category]}\n\n${body.trim().slice(0, 4000)}` }).catch(() => undefined)
      setTitle('')
      setBody('')
      toast('Valeu pela sugestão! Você acompanha a resposta aqui.')
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
          <p className="eyebrow">próximas atualizações</p>
          <h1>
            sugestões <em>de melhoria</em>
          </h1>
        </div>
      </div>
      <p className="pf-note">
        <Icon name="flag" size={16} />
        <span>
          O {PLATFORM.name} é feito por quem também vive de projeto e melhora com as ideias de quem usa. Conte o que faria diferença no seu dia a dia: toda sugestão é lida pelo {PLATFORM.support}.
        </span>
      </p>
      <Section title="nova sugestão">
        <form className="stack" onSubmit={submit}>
          <Field group label="Tipo">
            <Segmented<SuggestionCategory> value={category} onChange={setCategory} options={(Object.keys(SUGGESTION_CATEGORY) as SuggestionCategory[]).map((k) => ({ value: k, label: SUGGESTION_CATEGORY[k] }))} />
          </Field>
          <Field label="Sua ideia em uma frase">
            <input id="sug-title" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={category === 'problema' ? 'Ex.: o prazo some no celular quando…' : 'Ex.: orçamento separado por ambiente'} />
          </Field>
          <Field label="Conte mais (opcional)" hint="Como você usaria, em que momento faria falta, um exemplo…">
            <textarea id="sug-body" rows={4} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} spellCheck lang="pt-BR" />
          </Field>
          <div>
            <button className="btn primary" disabled={busy}>
              <Icon name="arrowRight" size={16} /> {busy ? 'enviando…' : 'enviar sugestão'}
            </button>
          </div>
        </form>
      </Section>
      <Section title="minhas sugestões">
        {list === null ? (
          <p className="muted small">carregando…</p>
        ) : list.length === 0 ? (
          <Empty icon="flag" title="nenhuma sugestão ainda" text="Sua primeira ideia pode virar a próxima atualização ☺️" />
        ) : (
          <div className="sg-list">
            {list.map((x) => (
              <article key={x.id} className={`sg-item ${fresh.includes(x.id) ? 'is-new' : ''}`}>
                <header>
                  <b>{x.title}</b>
                  {fresh.includes(x.id) && <Badge color="#5e8c6a">novidade</Badge>}
                  <Badge color={SUGGESTION_STATUS[x.status].color}>{SUGGESTION_STATUS[x.status].label}</Badge>
                </header>
                <small className="muted">
                  {SUGGESTION_CATEGORY[x.category]} · {timeLabel(x.createdAt)}
                </small>
                {x.body && <p>{x.body}</p>}
                {x.reply && (
                  <p className="sg-reply">
                    <Icon name="chat" size={14} />{' '}
                    <span>
                      <RichText text={x.reply} />
                    </span>
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
