import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../store'
import { formatDoc, whatsappLink } from '../utils'
import { hashExtra } from '../linkPack'
import { loadSign, signMessage, signatureHash, type SignAnswer, type SignPayload } from '../contractSign'
import { ContractDoc } from './ContractDoc'
import { DocScale } from './Print'
import { Icon } from './Icon'

/* Página que o cliente abre para ler e assinar o contrato (sem login, sem nada do sistema). */
export function ContractSignPublic({ id, data, preview }: { id: string; data?: SignPayload; preview?: boolean }) {
  const [p, setP] = useState<SignPayload | null | undefined>(data)
  const [name, setName] = useState('')
  const [doc, setDoc] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ a: SignAnswer; msg: string } | null>(null)
  useEffect(() => {
    if (!data) loadSign(id, hashExtra()).then(setP, () => setP(null))
  }, [id, data])

  const wrap = (children: React.ReactNode) => (
    <div className={`bf-public cs-public ${preview ? 'is-preview' : ''}`} style={{ ['--bf-accent' as string]: p?.accent || '#a88a80' }}>
      <div className="bf-card cs-card">{children}</div>
      <p className="bf-foot">feito com traço</p>
    </div>
  )
  if (p === undefined) return wrap(<p className="muted">carregando o contrato…</p>)
  if (p === null) return wrap(<p>Este contrato não está mais disponível. Fale com quem te enviou o link.</p>)

  const digits = doc.replace(/\D/g, '')
  const sign = async () => {
    if (name.trim().split(/\s+/).length < 2) return setError('Escreva o seu nome completo.')
    if (digits.length !== 11 && digits.length !== 14) return setError('Confira o CPF (11 números) ou CNPJ (14 números).')
    if (!agree) return setError('Marque que leu e concorda com o contrato.')
    setError('')
    const at = new Date().toISOString()
    const a: SignAnswer = { t: p.token, n: name.trim(), d: formatDoc(digits), at, h: await signatureHash(p.body, name, digits, at) }
    setDone({ a, msg: await signMessage(p, a) })
  }
  const s = { ...DEFAULT_SETTINGS, ...p.s }

  return wrap(
    <>
      <header className="bf-head">
        {p.logo && <img src={p.logo} alt="" className="bf-logo" />}
        <p className="bf-eyebrow">{p.studio}</p>
        <h1>{p.title}</h1>
        <p className="muted">
          {p.clientName ? `Oi, ${p.clientName.split(' ')[0]}! ` : ''}Leia o contrato com calma. No fim da página, assine digitando o seu nome e CPF.
        </p>
      </header>
      <div className="cs-doc" tabIndex={0} aria-label="Texto do contrato">
        <DocScale>
          <ContractDoc s={s} body={p.body} clientName={p.clientName} exclusive={p.exclusive} signed={done ? { via: 'link', name: done.a.n, doc: done.a.d, at: done.a.at, hash: done.a.h } : undefined} />
        </DocScale>
      </div>
      {!done ? (
        <section className="cs-form">
          <h2>assinar</h2>
          <label>
            <span>Nome completo</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="como no documento" />
          </label>
          <label>
            <span>CPF ou CNPJ</span>
            <input value={formatDoc(doc)} onChange={(e) => setDoc(e.target.value)} inputMode="numeric" placeholder="só os números" />
          </label>
          <label className="cs-agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Li todo o contrato e concordo com os termos.</span>
          </label>
          {error && <p className="cs-error">{error}</p>}
          <button className="bf-send" onClick={() => void sign()}>
            assinar contrato
          </button>
          <p className="muted small">
            Assinatura eletrônica (Lei 14.063/2020): ficam registrados o seu nome, o documento, a data e a hora e um código ligado a este texto. Se o texto mudar, o código deixa de valer.
          </p>
        </section>
      ) : (
        <section className="cs-done">
          <span className="cs-done-icon">
            <Icon name="check" size={22} />
          </span>
          <h2>contrato assinado</h2>
          <p className="muted">
            Código de verificação <b>{done.a.h}</b>. Falta um passo: envie a confirmação para {p.owner || p.studio}.
          </p>
          {p.phone ? (
            <a className="bf-send" href={whatsappLink(p.phone, done.msg)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={16} /> enviar confirmação no WhatsApp
            </a>
          ) : null}
          <button className="btn ghost small" onClick={() => navigator.clipboard?.writeText(done.msg)}>
            <Icon name="copy" size={14} /> copiar confirmação
          </button>
        </section>
      )}
    </>,
  )
}
