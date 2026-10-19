import { useEffect, useState, type FormEvent } from 'react'
import { avisar } from '../avisar'
import { loadPage, type PagePayload, type PageRequest } from '../studioPage'
import { money, uid } from '../utils'
import { Icon } from './Icon'

/* Página pública do profissional: o link da bio. Quem chega vê os serviços e pede um orçamento.
   O pedido vira aviso no planê (com rascunho de orçamento pronto) e e-mail para o profissional. */

const SENT = 'pedidos-enviados'

export function StudioPagePublic({ code }: { code: string }) {
  const [d, setD] = useState<{ data: PagePayload; userId: string } | null | undefined>(undefined)
  useEffect(() => {
    loadPage(code).then(setD, () => setD(null))
  }, [code])
  const wrap = (children: React.ReactNode, accent?: string) => (
    <div className="bf-public sp-public" style={{ ['--bf-accent' as string]: accent || '#a88a80' }}>
      <div className="bf-card">{children}</div>
      <p className="bf-foot">
        <a href="https://useplane.com.br" target="_blank" rel="noreferrer">
          feito com planê · useplane.com.br
        </a>
      </p>
    </div>
  )
  if (d === undefined) return wrap(<p className="muted">carregando…</p>)
  if (d === null) return wrap(<p>Esta página não está no ar. Fale com quem te mandou o link.</p>)
  return wrap(<Page d={d.data} owner={d.userId} />, d.data.accent)
}

function Page({ d, owner }: { d: PagePayload; owner: string }) {
  const [picked, setPicked] = useState<string[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [area, setArea] = useState('')
  const [msg, setMsg] = useState('')
  const [trap, setTrap] = useState('') // campo escondido: robôs preenchem, pessoas não
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'erro'>('idle')
  const [error, setError] = useState('')
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const wa = d.whatsapp ? (d.whatsapp.length <= 11 ? `55${d.whatsapp}` : d.whatsapp) : ''

  const send = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (trap) return setState('ok')
    if (!name.trim()) return setError('Coloque seu nome.')
    if (phone.replace(/\D/g, '').length < 10 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Deixe um WhatsApp ou e-mail para a resposta chegar.')
    if (!picked.length && !msg.trim()) return setError('Conte o que você precisa: escolha um serviço ou escreva abaixo.')
    try {
      const sent = Number(localStorage.getItem(SENT) || '0')
      if (sent >= 5) return setError('Você já mandou alguns pedidos daqui. Para falar de novo, use o WhatsApp.')
      localStorage.setItem(SENT, String(sent + 1))
    } catch {
      /* ok */
    }
    setState('busy')
    const names = d.services.filter((s) => picked.includes(s.id)).map((s) => s.name)
    const req: PageRequest = { phone: phone.trim(), services: picked, ...(Number(area) > 0 ? { area: Number(area) } : {}) }
    const ok = await avisar({ user: owner, kind: 'pedido', ref: uid(), cliente: name.trim(), titulo: names.join(', ') || 'pedido de orçamento', texto: msg.trim(), clienteEmail: email.trim(), code: JSON.stringify(req), studio: d.studio })
    setState(ok ? 'ok' : 'erro')
  }

  return (
    <>
      <header className="sp-head">
        {d.logo ? <img className="sp-logo" src={d.logo} alt="" /> : <span className="sp-logo is-empty">{(d.studio || d.owner || '·').slice(0, 1)}</span>}
        <div>
          <h1>{d.studio || d.owner}</h1>
          {d.headline && <p className="sp-headline">{d.headline}</p>}
          {d.city && (
            <p className="muted small">
              {d.city}
            </p>
          )}
        </div>
      </header>
      {d.bio && <p className="sp-bio">{d.bio}</p>}
      {d.photos.length > 0 && (
        <div className={`sp-photos n${Math.min(3, d.photos.length)}`}>
          {d.photos.map((p, i) => (
            <img key={i} src={p} alt="" loading="lazy" />
          ))}
        </div>
      )}
      <div className="row gap-s wrap">
        {wa && (
          <a className="btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(`oi! vi sua página e queria um orçamento`)}`} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" size={15} /> WhatsApp
          </a>
        )}
        {d.instagram && (
          <a className="btn ghost" href={`https://instagram.com/${d.instagram}`} target="_blank" rel="noreferrer">
            <Icon name="instagram" size={15} /> @{d.instagram}
          </a>
        )}
        {d.website && (
          <a className="btn ghost" href={/^https?:/.test(d.website) ? d.website : `https://${d.website}`} target="_blank" rel="noreferrer">
            <Icon name="link" size={15} /> site
          </a>
        )}
      </div>

      {state === 'ok' ? (
        <div className="sp-done">
          <Icon name="check" size={20} />
          <div>
            <b>Pedido enviado!</b>
            <p className="muted small">{d.owner ? d.owner.split(' ')[0] : d.studio} já recebeu e responde em breve{phone ? ' pelo WhatsApp' : ' por e-mail'}.</p>
          </div>
        </div>
      ) : (
        <form className="sp-form" onSubmit={send}>
          <h2>pedir um orçamento</h2>
          {d.services.length > 0 && (
            <div className="sp-services" role="group" aria-label="Serviços">
              {d.services.map((s) => (
                <button key={s.id} type="button" className={`sp-service ${picked.includes(s.id) ? 'is-on' : ''}`} aria-pressed={picked.includes(s.id)} onClick={() => toggle(s.id)}>
                  <span className="sp-check">{picked.includes(s.id) && <Icon name="check" size={12} />}</span>
                  <span className="grow">
                    <b>{s.name}</b>
                    {s.from ? <small>a partir de {money(s.from)}{s.free ? '' : ` por ${s.unit}`}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          )}
          <label className="sp-field">
            <span>Seu nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <div className="sp-2">
            <label className="sp-field">
              <span>WhatsApp</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" />
            </label>
            <label className="sp-field">
              <span>E-mail</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" />
            </label>
          </div>
          <label className="sp-field">
            <span>Área aproximada (m², se souber)</span>
            <input value={area} onChange={(e) => setArea(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" />
          </label>
          <label className="sp-field">
            <span>Conte um pouco do projeto</span>
            <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="o que precisa, prazo, cidade…" />
          </label>
          <input className="sp-trap" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} aria-hidden />
          {error && <p className="auth-error">{error}</p>}
          {state === 'erro' && <p className="auth-error">Não foi possível enviar agora. Tente de novo ou chame no WhatsApp.</p>}
          <button className="btn primary" disabled={state === 'busy'}>
            {state === 'busy' ? 'enviando…' : 'enviar pedido'}
          </button>
        </form>
      )}
    </>
  )
}
