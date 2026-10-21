import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../store'
import { formatDoc, whatsappLink } from '../utils'
import { hashExtra, readShortCode, unpack } from '../linkPack'
import { avisar } from '../avisar'
import { deviceLabel, docHash, loadSign, signExtra, signMessage, signatureHash, type SignAnswer, type SignPayload } from '../contractSign'
import { SIGN_FONTS, SignatureGlyph, SignaturePad } from './SignaturePad'
import { ContractDoc } from './ContractDoc'
import { DocScale } from './Print'
import { Icon } from './Icon'
import { PlaneMark } from './ContractDataPublic'

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
  // cópia assinada (link do e-mail): o código da assinatura vem no fim do endereço e é conferido com o texto
  const [copyOf, setCopyOf] = useState<SignAnswer | null>(null)
  useEffect(() => {
    const extra = id.includes('.') ? hashExtra() : ''
    if (!extra || !p) return
    void unpack<SignAnswer>(extra).then(async (a) => {
      if (a && a.t === p.token && (await signatureHash(p.body, a.n, a.d.replace(/\D/g, ''), a.at, signExtra(a))) === a.h) {
        setCopyOf(a)
        setDone({ a, msg: '' })
        setSent(true)
      }
    })
  }, [id, p])

  const wrap = (children: React.ReactNode) => (
    <div className={`cdp cs2 ${preview ? 'is-preview' : ''}`}>
      {p && (
        <header className="cdp-top">
          {p.logo ? <img src={p.logo} alt="" className="cdp-logo" /> : <span className="cdp-logo is-letter"><i>{(p.studio || '·').slice(0, 1).toLowerCase()}</i></span>}
          <span>
            <b>{p.studio}</b>
            <small>contrato para assinar</small>
          </span>
        </header>
      )}
      <main className="cdp-card cs2-card">{children}</main>
      <a className="cdp-made" href="https://useplane.com.br" target="_blank" rel="noreferrer">
        <span className="cdp-made-mark">
          <PlaneMark size={14} />
        </span>
        feito com <b>planê</b>
      </a>
    </div>
  )
  if (p === undefined) return wrap(<div className="cdp-loading"><span /></div>)
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
      const copia = owner && code ? `${location.origin}${location.pathname}#/assinar/${id}/${code}` : undefined
      void avisar({ user: owner, kind: 'assinatura', ref: p.token, cliente: a.n, titulo: p.title, code, clienteEmail: a.c?.includes('@') ? a.c : undefined, studio: p.studio, link: copia }).then((ok) => setSent(ok && !!owner))
    }
  }
  const s = { ...DEFAULT_SETTINGS, ...p.s }
  const signedNow = done ? { via: 'link' as const, name: done.a.n, doc: done.a.d, at: done.a.at, hash: done.a.h, method: done.a.m, drawing: done.a.p, font: done.a.f, contact: done.a.c, device: done.a.ua, tz: done.a.tz, geo: done.a.g, docHash: done.a.dh } : undefined
  const who = p.owner || p.studio

  return wrap(
    <div className="cd-anim">
      <div className="cs2-head">
        <p className="cd-eyebrow">
          <Icon name="file" size={13} /> contrato
        </p>
        <h1 className="cd-title">{p.title.replace(/^contrato\s*[·\-–—]\s*/i, '')}</h1>
        {!copyOf && !done && <p className="cd-lead is-small">{p.clientName ? `Oi, ${p.clientName.split(' ')[0]}! ` : ''}Leia com calma e assine no fim da página.</p>}
        {p.ownerSign && (
          <p className="cs2-chip">
            <Icon name="check" size={13} /> {who} já assinou
          </p>
        )}
      </div>

      <div className="cs-doc cs2-doc" tabIndex={0} aria-label="Texto do contrato">
        <DocScale>
          <ContractDoc s={s} body={p.body} html={p.html} letterhead={p.letterhead} pdfPages={p.pdfPages} clientName={p.clientName} exclusive={p.exclusive} ownerSigned={p.ownerSign} signed={signedNow} />
        </DocScale>
      </div>

      {!done ? (
        <section className="cs2-form">
          <div className="cd-blk">
            <div className="cd-blk-head">
              <span className="cd-ico"><Icon name="user" size={15} /></span>
              <b>seus dados</b>
            </div>
            <div className="cs2-fields">
              <label className="cs2-field is-wide">
                <span>nome completo</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="como no documento" />
              </label>
              <label className="cs2-field">
                <span>CPF ou CNPJ</span>
                <input value={formatDoc(doc)} onChange={(e) => setDoc(e.target.value)} inputMode="numeric" placeholder="só os números" />
              </label>
              <label className="cs2-field">
                <span>e-mail ou WhatsApp</span>
                <input value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" placeholder="para receber a cópia" />
              </label>
            </div>
          </div>

          <div className="cd-blk">
            <div className="cd-blk-head">
              <span className="cd-ico"><Icon name="pen" size={15} /></span>
              <b>assinatura</b>
              <div className="cs-tabs cs2-tabs" role="tablist">
                <button role="tab" aria-selected={method === 'desenho'} className={method === 'desenho' ? 'is-on' : ''} onClick={() => setMethod('desenho')}>
                  desenhar
                </button>
                <button role="tab" aria-selected={method === 'digitado'} className={method === 'digitado' ? 'is-on' : ''} onClick={() => setMethod('digitado')}>
                  digitar
                </button>
              </div>
            </div>
            {method === 'desenho' ? (
              <SignaturePad value={drawing} onChange={setDrawing} />
            ) : (
              <div className="cs-fonts">
                {SIGN_FONTS.map((f) => (
                  <button key={f.id} className={`cs-font ${font === f.id ? 'is-on' : ''}`} onClick={() => setFont(f.id)} aria-pressed={font === f.id}>
                    <span style={{ fontFamily: f.family, fontSize: `${f.size ?? 1}em` }}>{name.trim() || 'Seu Nome'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className={`cs2-agree ${agree ? 'is-on' : ''}`}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Li o contrato, concordo com os termos e reconheço esta assinatura eletrônica como minha.</span>
          </label>
          {error && (
            <p className="cd-miss">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}
          <button className="cd-go" disabled={busy || !agree} onClick={() => void sign()}>
            {busy ? 'assinando…' : 'assinar contrato'} <Icon name="pen" size={16} />
          </button>
          <details className="cs2-law">
            <summary>
              <Icon name="lock" size={13} /> como a assinatura vale
            </summary>
            <p>Assinatura eletrônica (Lei 14.063/2020 e MP 2.200-2/2001, art. 10, § 2º). Ao assinar, o navegador pede a sua localização. Ficam registrados nome, CPF, contato, data e hora, fuso, aparelho, localização e a impressão digital (SHA-256) deste texto. Se o texto mudar, a assinatura deixa de valer. Tudo aparece no certificado, na última página do contrato.</p>
          </details>
        </section>
      ) : (
        <section className="cd-done">
          <span className="cd-done-ico">
            <Icon name="check" size={28} />
          </span>
          <h1>
            contrato <em>assinado!</em>
          </h1>
          <div className="cs-done-sign">
            <SignatureGlyph sign={{ name: done.a.n, drawing: done.a.p, font: done.a.f }} />
          </div>
          <p className="muted">
            {copyOf
              ? `Assinado por ${done.a.n}${p.ownerSign ? ` e ${p.ownerSign.name}` : ''} em ${new Date(done.a.at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}.`
              : sent
                ? `${who} já recebeu a sua assinatura${done.a.c?.includes('@') ? ' e a cópia vai para o seu e-mail' : ''}.`
                : `Falta um passo: envie a confirmação para ${who}.`}
          </p>
          <p className="cs2-code">código {done.a.h}</p>
          <div className="cs2-done-acts">
            <button className="cd-go" onClick={() => window.print()}>
              <Icon name="download" size={16} /> salvar em PDF
            </button>
            {!copyOf && p.phone ? (
              <a className={sent ? 'cd-back cs2-round' : 'cd-go'} href={whatsappLink(p.phone, done.msg)} target="_blank" rel="noreferrer" title="Mandar a confirmação no WhatsApp" aria-label="Mandar a confirmação no WhatsApp">
                <Icon name="whatsapp" size={18} /> {sent ? '' : 'enviar confirmação'}
              </a>
            ) : null}
          </div>
        </section>
      )}
    </div>,
  )
}
