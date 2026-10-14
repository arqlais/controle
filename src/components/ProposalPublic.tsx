import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../store'
import { money, whatsappLink } from '../utils'
import { avisar } from '../avisar'
import { readShortCode } from '../linkPack'
import type { ProposalPayload } from '../proposalLink'
import type { Client, Settings } from '../types'
import { Icon } from './Icon'
import { DocScale, usePdf } from './Print'
import { QuoteDoc } from './Docs'
import { PAGE } from './docs/DocPage'

/* Proposta pelo link: a cliente vê a proposta, escolhe a opção e aprova. Sem conta. */

const fmt = (iso?: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const DONE = 'propostas-aprovadas'
const doneHere = (token: string): { at: string; label?: string } | null => {
  try {
    return (JSON.parse(localStorage.getItem(DONE) || '{}') as Record<string, { at: string; label?: string }>)[token] ?? null
  } catch {
    return null
  }
}
const markDone = (token: string, label?: string) => {
  try {
    const all = JSON.parse(localStorage.getItem(DONE) || '{}') as Record<string, { at: string; label?: string }>
    all[token] = { at: new Date().toISOString(), label }
    localStorage.setItem(DONE, JSON.stringify(all))
  } catch {
    /* navegador sem espaço: a aprovação já foi enviada */
  }
}

export function ProposalPublic({ id, data, preview }: { id: string; data?: ProposalPayload; preview?: boolean }) {
  const [d, setD] = useState<ProposalPayload | null | undefined>(data)
  const [owner, setOwner] = useState('')
  useEffect(() => {
    if (data) return setD(data)
    import('../proposalLink').then(({ loadProposal }) => loadProposal(id)).then(
      (r) => {
        setD(r?.data ?? null)
        setOwner(r?.userId ?? '')
      },
      () => setD(null),
    )
  }, [id, data])
  const wrap = (children: React.ReactNode) => (
    <div className={`bf-public pn-public pp-public ${preview ? 'is-preview' : ''}`} style={{ ['--bf-accent' as string]: d?.accent || '#a88a80' }}>
      <div className="bf-card">{children}</div>
      <p className="bf-foot">
        <a href="https://useplane.com.br" target="_blank" rel="noreferrer">
          feito com planê · useplane.com.br
        </a>
      </p>
    </div>
  )
  if (d === undefined) return wrap(<p className="muted">carregando…</p>)
  if (d === null) return wrap(<p>Esta proposta não está mais no ar. Fale com quem te enviou o link.</p>)
  return wrap(<Proposal d={d} owner={owner} preview={preview} token={id} />)
}

function Proposal({ d, owner, preview, token }: { d: ProposalPayload; owner: string; preview?: boolean; token: string }) {
  const s = { ...DEFAULT_SETTINGS, ...d.s } as Settings
  const client = { id: '', name: d.clientFull } as Client
  const pdf = usePdf()
  const key = token.includes('.') ? readShortCode(token)?.id ?? token : token
  const [choice, setChoice] = useState(d.quote.chosenOption && d.choices.some((c) => c.id === d.quote.chosenOption) ? d.quote.chosenOption : d.choices.length === 1 ? d.choices[0].id : '')
  const [name, setName] = useState(d.clientFull)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'erro'>('idle')
  const [done, setDone] = useState(() => (d.approval ? { at: d.approval.at, label: d.approval.label } : doneHere(key)))
  const who = d.owner || d.studio
  const expired = !!d.validUntil && d.validUntil < new Date().toISOString().slice(0, 10)
  const picked = d.choices.find((c) => c.id === choice)
  const doc = <QuoteDoc s={s} client={client} quote={d.quote} />
  const file = `Proposta ${d.number} - ${d.clientFull || d.studio}.pdf`

  const approve = async () => {
    if (d.choices.length && !picked) return
    if (name.trim().length < 2) return
    if (preview) {
      setDone({ at: new Date().toISOString(), label: picked?.label })
      return
    }
    setState('busy')
    const ok = await avisar({ user: owner, kind: 'aprovacao', ref: key, cliente: name.trim(), titulo: `proposta ${d.number}${d.title ? ` · ${d.title}` : ''}`, texto: [picked?.label, note.trim()].filter(Boolean).join(' · '), opcao: choice, painel: key, studio: d.studio })
    if (!ok) return setState('erro')
    markDone(key, picked?.label)
    setDone({ at: new Date().toISOString(), label: picked?.label })
    setState('idle')
  }

  return (
    <div className="pp">
      <header className="pp-head">
        {d.logo ? <img className="pp-logo" src={d.logo} alt={d.studio} /> : <b className="pp-studio">{d.studio}</b>}
        <span className="pp-kick">proposta {d.number}</span>
        <h1>
          {d.client ? `${d.client}, ` : ''}
          <em>sua proposta</em>
        </h1>
        <p className="muted">
          {d.title ? `${d.title} · ` : ''}
          {d.choices.length ? `${d.choices.length} ${d.quote.combo ? 'propostas' : 'opções'} para você escolher` : money(d.total)}
          {d.validUntil ? ` · válida até ${fmt(d.validUntil)}` : ''}
        </p>
      </header>

      <div className="pp-doc">
        <DocScale width={d.slides ? PAGE.slide[0] : PAGE.a4[0]}>{doc}</DocScale>
      </div>
      <div className="row gap-s wrap pp-tools">
        <button className="btn" disabled={pdf.busy} onClick={() => (d.slides ? pdf.downloadSlides(doc, file) : pdf.download(doc, file))}>
          <Icon name="download" size={15} /> {pdf.busy ? 'gerando…' : 'baixar PDF'}
        </button>
        {d.phone && (
          <a className="btn" href={whatsappLink(d.phone, `Oi! Estou vendo a proposta ${d.number} e tenho uma dúvida.`)} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" size={15} /> tirar uma dúvida
          </a>
        )}
      </div>

      <section className="bf-block pp-approve" id="aprovar">
        {done ? (
          <div className="pp-done">
            <span className="pp-done-ico">
              <Icon name="check" size={22} />
            </span>
            <div>
              <h2>proposta aprovada</h2>
              <p>
                {done.label ? `${done.label} · ` : ''}em {fmt(done.at)}. {who} já recebeu o aviso e vai te chamar para combinar os próximos passos.
              </p>
            </div>
          </div>
        ) : !d.open && !d.approval ? (
          <p className="muted">Esta proposta não está mais aberta para aprovação. Qualquer dúvida, fale com {who}.</p>
        ) : (
          <>
            <h2>aprovar a proposta</h2>
            {expired && <p className="pf-note is-warn">A validade desta proposta passou ({fmt(d.validUntil)}). Você ainda pode aprovar; {who} confirma os valores com você.</p>}
            {d.choices.length > 0 && (
              <div className="pp-choices" role="radiogroup" aria-label="Escolha a opção">
                {d.choices.map((c) => (
                  <label key={c.id} className={`pp-choice ${choice === c.id ? 'is-on' : ''}`}>
                    <input type="radio" name="opcao" checked={choice === c.id} onChange={() => setChoice(c.id)} />
                    <span className="grow">{c.label}</span>
                    <b>{money(c.total)}</b>
                  </label>
                ))}
              </div>
            )}
            <label className="pp-field">
              <span>seu nome</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="nome completo" />
            </label>
            <label className="pp-field">
              <span>quer dizer algo? (opcional)</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: podemos começar na semana que vem?" spellCheck lang="pt-BR" />
            </label>
            {state === 'erro' && <p className="bf-error">Não foi agora. Tente de novo ou fale pelo WhatsApp.</p>}
            <button className="btn primary block pp-go" disabled={state === 'busy' || (d.choices.length > 0 && !picked) || name.trim().length < 2} onClick={() => void approve()}>
              <Icon name="check" size={16} /> {state === 'busy' ? 'enviando…' : 'aprovar'}
              {state !== 'busy' && (picked || !d.choices.length) && <span className="pp-go-val"> · {money(picked ? picked.total : d.total)}</span>}
            </button>
            <p className="muted small">Aprovar avisa {who} na hora. Pagamento, prazo e contrato são combinados em seguida.</p>
          </>
        )}
      </section>
      {pdf.portal}
    </div>
  )
}
