import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../store'
import { formatDoc, whatsappLink } from '../utils'
import { hashExtra, readShortCode } from '../linkPack'
import { avisar } from '../avisar'
import { deviceLabel, docHash, loadSign, signExtra, signMessage, signatureHash, type SignAnswer, type SignPayload } from '../contractSign'
import { SIGN_FONTS, SignatureGlyph, SignaturePad } from './SignaturePad'
import { ContractDoc } from './ContractDoc'
import { DocScale } from './Print'
import { Icon } from './Icon'

/* Página que o cliente abre para ler e assinar o contrato (sem login, sem nada do sistema). */
export function ContractSignPublic({ id, data, preview }: { id: string; data?: SignPayload; preview?: boolean }) {
  const [p, setP] = useState<SignPayload | null | undefined>(data)
  const [name, setName] = useState('')
  const [doc, setDoc] = useState('')
  const [agree, setAgree] = useState(false)
  const [contact, setContact] = useState('')
  const [method, setMethod] = useState<'desenho' | 'digitado'>('desenho')
  const [drawing, setDrawing] = useState('')
  const [font, setFont] = useState(SIGN_FONTS[0].id)
  
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ a: SignAnswer; msg: string } | null>(null)
  const [sent, setSent] = useState(false) // a assinatura já chegou sozinha no sistema do profissional
  useEffect(() => {
    if (!data) loadSign(id, hashExtra()).then(setP, () => setP(null))
  }, [id, data])

  const wrap = (children: React.ReactNode) => (
    <div className={`bf-public cs-public ${preview ? 'is-preview' : ''}`} style={{ ['--bf-accent' as string]: p?.accent || '#a88a80' }}>
      <div className="bf-card cs-card">{children}</div>
      <p className="bf-foot">feito com planê</p>
    </div>
  )
  if (p === undefined) return wrap(<p className="muted">carregando o contrato…</p>)
  if (p === null) return wrap(<p>Este contrato não está mais disponível. Fale com quem te enviou o link.</p>)

  const digits = doc.replace(/\D/g, '')
  // localização obrigatória: entra no registro e reforça a autenticidade da assinatura
  const where = () =>
    new Promise<string>((resolve) => {
      if (!navigator.geolocation) return resolve('')
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} (±${Math.round(pos.coords.accuracy)} m)`),
        () => resolve(''),
        { timeout: 10000, maximumAge: 60000 },
      )
    })
  const sign = async () => {
    if (name.trim().split(/\s+/).length < 2) return setError('Escreva o seu nome completo.')
    if (digits.length !== 11 && digits.length !== 14) return setError('Confira o CPF (11 números) ou CNPJ (14 números).')
    if (contact.trim().length < 6) return setError('Informe o seu e-mail ou WhatsApp.')
    if (method === 'desenho' && drawing.length < 30) return setError('Desenhe a sua assinatura no quadro.')
    if (!agree) return setError('Marque que leu e concorda com o contrato.')
    setError('')
    setBusy(true)
    const geo = await where()
    if (!geo) {
      setBusy(false)
      return setError('Para assinar, permita a localização no seu celular ou navegador (ela entra no registro da assinatura). Depois toque em assinar de novo.')
    }
    const at = new Date().toISOString()
    const base: Omit<SignAnswer, 'h'> = {
      t: p.token,
      n: name.trim(),
      d: formatDoc(digits),
      at,
      m: method,
      p: method === 'desenho' ? drawing : undefined,
      f: method === 'digitado' ? font : undefined,
      c: contact.trim(),
      ua: deviceLabel(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      g: geo,
      dh: await docHash(p.body),
    }
    const a: SignAnswer = { ...base, h: await signatureHash(p.body, base.n, digits, at, signExtra(base)) }
    const msg = await signMessage(p, a)
    setDone({ a, msg })
    setBusy(false)
    // manda direto para o sistema do profissional (e o e-mail de aviso); o WhatsApp fica como garantia
    if (!preview) {
      const owner = id.includes('.') ? readShortCode(id)?.userId ?? '' : ''
      const code = msg.match(/c[óo]digo da assinatura:\s*(\S+)/i)?.[1] ?? ''
      void avisar({ user: owner, kind: 'assinatura', ref: p.token, cliente: a.n, titulo: p.title, code, clienteEmail: a.c?.includes('@') ? a.c : undefined, studio: p.studio }).then((ok) => setSent(ok && !!owner))
    }
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
          <ContractDoc s={s} body={p.body} html={p.html} clientName={p.clientName} exclusive={p.exclusive} signed={done ? { via: 'link', name: done.a.n, doc: done.a.d, at: done.a.at, hash: done.a.h, method: done.a.m, drawing: done.a.p, font: done.a.f, contact: done.a.c, device: done.a.ua, tz: done.a.tz, geo: done.a.g, docHash: done.a.dh } : undefined} />
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
          <label>
            <span>E-mail ou WhatsApp</span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" placeholder="para constar no registro da assinatura" />
          </label>
          <div className="cs-method">
            <span>Como quer assinar?</span>
            <div className="cs-tabs" role="tablist">
              <button role="tab" aria-selected={method === 'desenho'} className={method === 'desenho' ? 'is-on' : ''} onClick={() => setMethod('desenho')}>
                desenhar
              </button>
              <button role="tab" aria-selected={method === 'digitado'} className={method === 'digitado' ? 'is-on' : ''} onClick={() => setMethod('digitado')}>
                digitar o nome
              </button>
            </div>
            {method === 'desenho' ? (
              <SignaturePad value={drawing} onChange={setDrawing} />
            ) : (
              <div className="cs-fonts">
                {SIGN_FONTS.map((f) => (
                  <button key={f.id} className={`cs-font ${font === f.id ? 'is-on' : ''}`} onClick={() => setFont(f.id)} aria-pressed={font === f.id}>
                    <span style={{ fontFamily: f.family, fontSize: `${f.size ?? 1}em` }}>{name.trim() || 'Seu Nome'}</span>
                    <small>{f.name}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="cs-agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Li todo o contrato, concordo com os termos e reconheço esta assinatura eletrônica como minha.</span>
          </label>
          {error && <p className="cs-error">{error}</p>}
          <button className="bf-send" disabled={busy || !agree} onClick={() => void sign()} title={agree ? undefined : 'Marque que leu e concorda para assinar'}>
            {busy ? 'assinando…' : 'assinar contrato'}
          </button>
          <p className="muted small">
            Assinatura eletrônica (Lei 14.063/2020 e MP 2.200-2/2001, art. 10, § 2º). Ao assinar, o navegador pede a sua localização. Ficam registrados nome, CPF, contato, data e hora, fuso, aparelho, localização e a impressão digital (SHA-256) deste texto. Se o texto mudar, a assinatura deixa de valer. Tudo aparece no certificado de assinatura, na última página do contrato.
          </p>
        </section>
      ) : (
        <section className="cs-done">
          <span className="cs-done-icon">
            <Icon name="check" size={22} />
          </span>
          <h2>contrato assinado</h2>
          <div className="cs-done-sign">
            <SignatureGlyph sign={{ name: done.a.n, drawing: done.a.p, font: done.a.f }} />
          </div>
          {sent ? (
            <p className="muted">
              Código de verificação <b>{done.a.h}</b>. Pronto: {p.owner || p.studio} já recebeu a sua assinatura{done.a.c?.includes('@') ? ' e uma cópia vai para o seu e-mail' : ''}.
            </p>
          ) : (
            <p className="muted">
              Código de verificação <b>{done.a.h}</b>. Falta um passo: envie a confirmação para {p.owner || p.studio}.
            </p>
          )}
          {p.phone ? (
            <a className={sent ? 'btn ghost small' : 'bf-send'} href={whatsappLink(p.phone, done.msg)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={16} /> {sent ? 'mandar também no WhatsApp' : 'enviar confirmação no WhatsApp'}
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
