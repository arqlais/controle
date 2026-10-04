import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import type { ContractSignature, Letterhead, Settings } from '../types'
import { useAccess } from '../access'
import { sheetColors, showsLogo } from '../proposalTemplates'
import { SignatureGlyph } from './SignaturePad'
import { cleanHtml } from '../contractHtml'

/* Contrato em folhas A4 (794 × 1123 px). O texto é medido parágrafo por parágrafo
   e dividido em páginas, assim nenhuma linha é cortada ao meio no PDF. */

const PAGE_H = 1123
const PAD_TOP = 76
const PAD_BOTTOM = 92 // espaço do rodapé com o número da página
const HEAD_H = 120 // cabeçalho só na primeira folha

type Block = { kind: 'title' | 'clause' | 'p' | 'gap' | 'sign'; text: string }

function toBlocks(body: string): Block[] {
  const lines = body.replace(/\r/g, '').split('\n')
  const out: Block[] = []
  lines.forEach((raw, i) => {
    const t = raw.trim()
    if (!t) return out.length && out[out.length - 1].kind !== 'gap' && out.push({ kind: 'gap', text: '' })
    if (i === 0 && t === t.toUpperCase() && t.length < 90) return out.push({ kind: 'title', text: t })
    if (/^(CLÁUSULA|CLAUSULA|PARÁGRAFO)\b/i.test(t) || (t === t.toUpperCase() && /[A-ZÁÉÍÓÚ]{4}/.test(t) && t.length < 80)) return out.push({ kind: 'clause', text: t })
    out.push({ kind: 'p', text: t })
  })
  out.push({ kind: 'sign', text: '' })
  return out
}

/** Desenho do contrato exclusivo da dona (o link de assinatura guarda isso, porque abre fora da conta). */
export const usesExclusiveContract = (has: (f: 'modeloExclusivo') => boolean, body: string) => has('modeloExclusivo') && /^CONTRATADA\s*$/m.test(body)

/** Linha "assinado eletronicamente" embaixo do nome de quem assinou pelo link. */
function SignedMark({ sign }: { sign?: ContractSignature }) {
  if (!sign || sign.via !== 'link') return null
  return (
    <span className="c-signed">
      assinado eletronicamente · {new Date(sign.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
      {sign.doc ? ` · ${sign.doc}` : ''}
      {sign.hash ? ` · código ${sign.hash}` : ''}
    </span>
  )
}

/** Certificado de assinatura (última página): o registro de quem assinou, como, quando e de qual texto. */
function SignCertificate({ sign, lais }: { sign?: ContractSignature; lais?: boolean }) {
  if (!sign || sign.via !== 'link') return null
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' }) : '')
  const rows: [string, string | undefined][] = [
    ['nome', sign.name],
    ['CPF / CNPJ', sign.doc],
    ['contato', sign.contact],
    ['assinado em', `${when(sign.at)}${sign.tz ? ` (${sign.tz})` : ''}`],
    ['forma', sign.method === 'desenho' ? 'assinatura desenhada à mão na tela' : 'nome digitado, adotado como assinatura'],
    ['aparelho', sign.device],
    ['localização', sign.geo || 'não informada'],
    ['confirmação', sign.confirmedAt ? `recebida pelo WhatsApp e registrada em ${when(sign.confirmedAt)}` : 'aguardando'],
    ['código da assinatura', sign.hash],
  ]
  return (
    <article className={`contract-page c-cert ${lais ? 'lc-page' : ''}`}>
      <p className="c-cert-eyebrow">certificado de assinatura eletrônica</p>
      <h2 className="c-cert-title">registro da assinatura</h2>
      <p className="c-cert-text">Este documento foi assinado eletronicamente pelo link enviado pela contratada. Os dados abaixo foram registrados no momento da assinatura e ficam ligados ao texto exato do contrato pela impressão digital SHA-256: qualquer alteração no texto gera outra impressão e invalida esta assinatura.</p>
      <div className="c-cert-sign">
        <SignatureGlyph sign={sign} />
        <span>{sign.name}</span>
      </div>
      <table className="c-cert-table">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{v || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sign.docHash && (
        <p className="c-cert-hash">
          <b>impressão digital do documento (SHA-256)</b>
          <code>{sign.docHash}</code>
        </p>
      )}
      <p className="c-cert-law">Assinatura eletrônica simples, nos termos da Lei nº 14.063/2020 e da MP nº 2.200-2/2001 (art. 10, § 2º), admitida como válida pelas partes que a aceitaram. Para assinatura com certificado digital ICP-Brasil, use um serviço credenciado (ex.: assinador gov.br).</p>
    </article>
  )
}

export function ContractDoc({ s, body, html, clientName, exclusive, signed, letterhead, pdfPages }: { s: Settings; body: string; html?: string; clientName: string; exclusive?: boolean; signed?: ContractSignature; letterhead?: Letterhead; pdfPages?: string[] }) {
  const { has } = useAccess()
  // PDF pronto: as folhas exatamente como são + a folha das assinaturas no fim
  if (pdfPages?.length) return <PdfContract s={s} pages={pdfPages} clientName={clientName} signed={signed} />
  // papel timbrado: o texto entra por cima do desenho da folha da pessoa
  if (letterhead?.first) return <LetterheadContract s={s} body={body} html={html} lh={letterhead} clientName={clientName} signed={signed} />
  // contrato no modelo da própria pessoa (do Word): a folha fica igual à dela
  if (html) return <OwnContract s={s} html={html} clientName={clientName} signed={signed} />
  // o contrato da Laís (modelo exclusivo): mesmo desenho dos PDFs dela
  if (exclusive ?? usesExclusiveContract(has, body)) return <LaisContract s={s} body={body} clientName={clientName} signed={signed} />
  return <ClientContract s={s} body={body} clientName={clientName} has={has} signed={signed} />
}

function ClientContract({ s, body, clientName, has, signed }: { s: Settings; body: string; clientName: string; has: ReturnType<typeof useAccess>['has']; signed?: ContractSignature }) {
  const colors = sheetColors(s.proposal, has, s)
  const blocks = toBlocks(body)
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][] | null>(null)
  const key = body + clientName + (signed?.at ?? '')

  useLayoutEffect(() => {
    setPages(null)
  }, [key])
  useLayoutEffect(() => {
    if (pages || !measure.current) return
    const els = [...measure.current.children] as HTMLElement[]
    const heights = els.map((el, i) => (i < els.length - 1 ? els[i + 1].offsetTop - el.offsetTop : el.offsetHeight + 8))
    const out: number[][] = [[]]
    let used = HEAD_H
    heights.forEach((h, i) => {
      const room = PAGE_H - PAD_TOP - PAD_BOTTOM
      // título de cláusula não fica sozinho no fim da folha
      const need = blocks[i].kind === 'clause' ? h + (heights[i + 1] ?? 0) : h
      if (used + need > room && out[out.length - 1].length) {
        out.push([])
        used = 0
      }
      if (blocks[i].kind === 'gap' && used === 0) return // folha nova não começa com espaço em branco
      out[out.length - 1].push(i)
      used += h
    })
    setPages(out)
  })

  const style = { '--p-ink': colors.ink, '--p-rose': colors.rose, '--p-bar': colors.bar, '--p-paper': colors.paper, '--p-serif': `'${colors.serif}', 'Cormorant Garamond', Georgia, serif`, '--p-sans': `'${colors.sans}', 'Poppins', system-ui, sans-serif` } as CSSProperties
  const who = (s.legalName || s.ownerName || s.brandName).toUpperCase()
  const render = (i: number) => {
    const b = blocks[i]
    if (b.kind === 'gap') return <div key={i} className="c-gap" />
    if (b.kind === 'title') return <h2 key={i} className="c-title">{b.text.toLowerCase()}</h2>
    if (b.kind === 'clause') return <h3 key={i} className="c-clause">{b.text}</h3>
    if (b.kind === 'sign')
      return (
        <div key={i} className="c-sign">
          <div>
            {signed?.via === 'link' ? <SignatureGlyph sign={signed} className="c-sign-img" /> : <i className="c-sign-img" />}
            <span />
            <b>{clientName || 'contratante'}</b>
            <small>contratante</small>
            <SignedMark sign={signed} />
          </div>
          <div>
            {s.signature ? <img className="c-sign-img" src={s.signature} alt="" /> : <i className="c-sign-img" />}
            <span />
            <b>{s.legalName || s.ownerName || 'contratada'}</b>
            <small>contratada</small>
          </div>
        </div>
      )
    return <p key={i}>{b.text}</p>
  }

  if (!pages)
    return (
      <div className="contract-doc" style={style}>
        <article className="contract-page is-measuring">
          <div className="c-body" ref={measure}>
            {blocks.map((_, i) => render(i))}
          </div>
        </article>
      </div>
    )
  return (
    <div className="contract-doc" style={style}>
      {pages.map((idx, n) => (
        <article key={n} className="contract-page">
          <div className="c-bar">
            <span>{who}</span>
            <span>{n + 1}/{pages.length}</span>
          </div>
          {n === 0 && (
            <header className="c-head">
              {showsLogo(s) && <img className="c-logo" src={s.logo} alt="" />}
              <span className="p-eyebrow">documento</span>
              <h1 className="p-title">contrato</h1>
            </header>
          )}
          <div className="c-body">{idx.map(render)}</div>
          <footer className="c-foot">modelo de referência · revise com um advogado antes de assinar</footer>
        </article>
      ))}
      <SignCertificate sign={signed} />
    </div>
  )
}

/* ---------------- contrato da Laís: igual aos PDFs dela ---------------- */

type LBlock =
  | { kind: 'party'; label: string; rows: [string, string][] }
  | { kind: 'intro' | 'clause' | 'p' | 'bullet' | 'letter' | 'date'; text: string }
  | { kind: 'num'; n: string; text: string }
  | { kind: 'sign' }

const MONTH = /( de )([a-zç]+)( de \d{4})/
function laisBlocks(body: string): LBlock[] {
  const lines = body.replace(/\r/g, '').split('\n').map((l) => l.trim())
  const out: LBlock[] = []
  let i = 0
  if (lines[0] && lines[0] === lines[0].toUpperCase() && /CONTRATO/.test(lines[0])) i = 1 // o título vira o cabeçalho "contrato"
  let afterSign = false
  for (; i < lines.length; i++) {
    const t = lines[i]
    if (!t) continue
    if (t === 'CONTRATADA' || t === 'CONTRATANTE') {
      const rows: [string, string][] = []
      while (lines[i + 1]) {
        const l = lines[++i]
        const kv = l.match(/^([^:]{2,24}):\s*(.*)$/)
        const doc = l.match(/^(CPF|CNPJ)\s+(.+)$/)
        rows.push(kv ? [kv[1], kv[2]] : doc ? [doc[1], doc[2]] : [t === 'CONTRATADA' ? 'CPF' : 'CNPJ/CPF', l])
      }
      out.push({ kind: 'party', label: t, rows })
      continue
    }
    if (/^CLÁUSULA\b/i.test(t) || t === 'DAS ASSINATURAS') {
      afterSign = t === 'DAS ASSINATURAS'
      out.push({ kind: 'clause', text: t })
      continue
    }
    const num = t.match(/^(\d+\.\d+)\s+(.*)$/)
    if (num) {
      out.push({ kind: 'num', n: num[1], text: num[2] })
      continue
    }
    if (/^[•\-]\s+/.test(t)) {
      out.push({ kind: 'bullet', text: t.replace(/^[•\-]\s+/, '') })
      continue
    }
    if (/^[a-z]\)\s/.test(t)) {
      out.push({ kind: 'letter', text: t })
      continue
    }
    if (afterSign && /\d{4}\.?$/.test(t) && t.includes(',')) {
      // "Santo André - SP, 25 de Abril de 2026" (mês com inicial maiúscula, como no modelo)
      out.push({ kind: 'date', text: t.replace(/\.$/, '').replace(MONTH, (_m, a: string, mo: string, b: string) => a + mo[0].toUpperCase() + mo.slice(1) + b) })
      continue
    }
    out.push({ kind: /^As partes acima/.test(t) ? 'intro' : 'p', text: t })
  }
  out.push({ kind: 'sign' })
  return out
}

const L_PAD_TOP = 64
const L_PAD_BOTTOM = 86 // faixa rosé do rodapé + respiro
const L_HEAD_H = 150

function LaisContract({ s, body, clientName, signed }: { s: Settings; body: string; clientName: string; signed?: ContractSignature }) {
  const blocks = laisBlocks(body)
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][] | null>(null)
  const key = body + clientName + (s.signature ?? '') + (signed?.at ?? '')
  useLayoutEffect(() => {
    setPages(null)
  }, [key])
  useLayoutEffect(() => {
    if (pages || !measure.current) return
    const els = [...measure.current.children] as HTMLElement[]
    const heights = els.map((el, i) => (i < els.length - 1 ? els[i + 1].offsetTop - el.offsetTop : el.offsetHeight + 8))
    const room = PAGE_H - L_PAD_TOP - L_PAD_BOTTOM
    const out: number[][] = [[]]
    let used = L_HEAD_H
    heights.forEach((h, i) => {
      const b = blocks[i]
      // título de cláusula sempre junto do primeiro item; assinaturas juntas
      // "DAS ASSINATURAS" leva junto o texto, a data e os quadros de assinatura (como no modelo)
      const need = b.kind === 'clause' && b.text === 'DAS ASSINATURAS' ? heights.slice(i).reduce((a, x) => a + x, 0) : b.kind === 'clause' ? h + (heights[i + 1] ?? 0) : h
      if (used + need > room && out[out.length - 1].length) {
        out.push([])
        used = 0
      }
      out[out.length - 1].push(i)
      used += h
    })
    setPages(out)
  })
  const who = s.legalName || s.ownerName || ''
  const ig = (s.instagram || '').replace(/^@/, '')
  const render = (i: number): ReactNode => {
    const b = blocks[i]
    switch (b.kind) {
      case 'party':
        return (
          <fieldset key={i} className="lc-party">
            <legend>{b.label}</legend>
            {b.rows.map(([k, v], n) => (
              <p key={n}>
                <b>{k}:</b> {v}
              </p>
            ))}
          </fieldset>
        )
      case 'intro':
        return (
          <p key={i} className="lc-intro">
            {b.text}
          </p>
        )
      case 'clause':
        return (
          <h3 key={i} className="lc-clause">
            {b.text}
          </h3>
        )
      case 'num':
        return (
          <div key={i} className="lc-num">
            <b>{b.n}</b>
            <p>{b.text}</p>
          </div>
        )
      case 'bullet':
        return (
          <p key={i} className="lc-bullet">
            {b.text}
          </p>
        )
      case 'letter':
        return (
          <p key={i} className="lc-letter">
            {b.text}
          </p>
        )
      case 'date':
        return (
          <p key={i} className="lc-date">
            {b.text}
          </p>
        )
      case 'sign':
        return (
          <div key={i} className="lc-signs">
            <div className="lc-sign-box">{s.signature && <img src={s.signature} alt="" />}</div>
            <p className="lc-sign-who">
              {who.toUpperCase()}
              <b>CONTRATADO</b>
            </p>
            <div className="lc-sign-box">{signed?.via === 'link' && <SignatureGlyph sign={signed} />}</div>
            <p className="lc-sign-who">
              {(clientName || 'nome completo').toUpperCase()}
              <b>CONTRATANTE</b>
              <SignedMark sign={signed} />
            </p>
          </div>
        )
      default:
        return (
          <p key={i} className="lc-p">
            {b.text}
          </p>
        )
    }
  }
  const style = { '--lc-serif': `'${s.customFont ? 'The Seasons' : 'Cormorant Garamond'}', 'The Seasons', 'Cormorant Garamond', Georgia, serif` } as CSSProperties
  if (!pages)
    return (
      <div className="contract-doc lc" style={style}>
        <article className="contract-page lc-page is-measuring">
          <div className="lc-body" ref={measure}>
            {blocks.map((_, i) => render(i))}
          </div>
        </article>
      </div>
    )
  return (
    <div className="contract-doc lc" style={style}>
      {pages.map((idx, n) => (
        <article key={n} className="contract-page lc-page">
          {n === 0 && (
            <header className="lc-head">
              <div className="lc-title">
                <h1>contrato</h1>
                <span>prestação de serviços</span>
              </div>
              <ul className="lc-contacts">
                {s.phone && (
                  <li>
                    {s.phone} <i><Icon name="phone" size={10} /></i>
                  </li>
                )}
                {ig && (
                  <li>
                    {ig} <i><Icon name="instagram" size={10} /></i>
                  </li>
                )}
                {s.email && (
                  <li>
                    {s.email} <i><Icon name="mail" size={10} /></i>
                  </li>
                )}
              </ul>
            </header>
          )}
          <div className="lc-body">{idx.map(render)}</div>
          <footer className="lc-band" />
        </article>
      ))}
      <SignCertificate sign={signed} lais />
    </div>
  )
}

/* ---------------- contrato no modelo da pessoa (Word) ---------------- */

const OWN_PAD = 72
function OwnContract({ s, html, clientName, signed }: { s: Settings; html: string; clientName: string; signed?: ContractSignature }) {
  const clean = cleanHtml(html)
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<string[][] | null>(null)
  const key = clean + clientName + (signed?.at ?? '')
  const root = /^<div class="ch-doc" style="([^"]*)">/.exec(clean)
  const rootStyle = root?.[1] ?? ''
  useLayoutEffect(() => {
    setPages(null)
  }, [key])
  useLayoutEffect(() => {
    if (pages || !measure.current) return
    const doc = measure.current.querySelector('.ch-doc') ?? measure.current
    const els = [...doc.children] as HTMLElement[]
    const room = PAGE_H - OWN_PAD * 2 - 24
    const out: string[][] = [[]]
    let used = 0
    els.forEach((el, i) => {
      if (el.classList.contains('ch-break')) {
        if (out[out.length - 1].length) out.push([])
        used = 0
        return
      }
      const h = i < els.length - 1 ? els[i + 1].offsetTop - el.offsetTop : el.offsetHeight + 8
      if (used + h > room && out[out.length - 1].length) {
        out.push([])
        used = 0
      }
      out[out.length - 1].push(el.outerHTML)
      used += h
    })
    // o quadro de assinatura precisa de ~230px: se não couber, vai para uma folha nova
    if (used + 230 > room) out.push([])
    setPages(out)
  })
  const signBox = (
    <div className="c-sign ch-sign">
      <div>
        {signed?.via === 'link' ? <SignatureGlyph sign={signed} className="c-sign-img" /> : <i className="c-sign-img" />}
        <span />
        <b>{clientName || 'contratante'}</b>
        <small>contratante</small>
        <SignedMark sign={signed} />
      </div>
      <div>
        {s.signature ? <img className="c-sign-img" src={s.signature} alt="" /> : <i className="c-sign-img" />}
        <span />
        <b>{s.legalName || s.ownerName || 'contratada'}</b>
        <small>contratada</small>
      </div>
    </div>
  )
  if (!pages)
    return (
      <div className="contract-doc ch-own">
        <article className="contract-page ch-page is-measuring">
          <div ref={measure} dangerouslySetInnerHTML={{ __html: clean }} />
        </article>
      </div>
    )
  return (
    <div className="contract-doc ch-own">
      {pages.map((chunk, n) => (
        <article key={n} className="contract-page ch-page">
          <div className="ch-doc" style={Object.fromEntries(rootStyle.split(';').filter(Boolean).map((x) => { const [k, v] = x.split(':'); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()] }))} dangerouslySetInnerHTML={{ __html: chunk.join('') }} />
          {n === pages.length - 1 && signBox}
          <span className="ch-pnum">{n + 1}/{pages.length}</span>
        </article>
      ))}
      <SignCertificate sign={signed} />
    </div>
  )
}

/* ---------------- quadro de assinaturas (usado pelos desenhos da própria pessoa) ---------------- */

function SignBox({ s, clientName, signed }: { s: Settings; clientName: string; signed?: ContractSignature }) {
  return (
    <div className="c-sign ch-sign">
      <div>
        {signed?.via === 'link' ? <SignatureGlyph sign={signed} className="c-sign-img" /> : <i className="c-sign-img" />}
        <span />
        <b>{clientName || 'contratante'}</b>
        <small>contratante</small>
        <SignedMark sign={signed} />
      </div>
      <div>
        {s.signature ? <img className="c-sign-img" src={s.signature} alt="" /> : <i className="c-sign-img" />}
        <span />
        <b>{s.legalName || s.ownerName || 'contratada'}</b>
        <small>contratada</small>
      </div>
    </div>
  )
}

/* ---------------- PDF pronto: as folhas do arquivo, sem mudar nada ---------------- */

function PdfContract({ s, pages, clientName, signed }: { s: Settings; pages: string[]; clientName: string; signed?: ContractSignature }) {
  return (
    <div className="contract-doc ch-own">
      {pages.map((src, n) => (
        <article key={n} className="contract-page lh-page lh-pdf">
          <img className="lh-bg" src={src} alt={`Folha ${n + 1} do contrato`} />
        </article>
      ))}
      <article className="contract-page lh-signpage">
        <p className="lh-sign-title">assinaturas</p>
        <p className="lh-sign-text">As partes declaram que leram e concordam com as {pages.length} {pages.length === 1 ? 'folha anterior' : 'folhas anteriores'} deste contrato.</p>
        <SignBox s={s} clientName={clientName} signed={signed} />
        <span className="ch-pnum">{pages.length + 1}/{pages.length + 1}</span>
      </article>
      <SignCertificate sign={signed} />
    </div>
  )
}

/* ---------------- papel timbrado: o texto do contrato por cima do desenho da folha ---------------- */

function LetterheadContract({ s, body, html, lh, clientName, signed }: { s: Settings; body: string; html?: string; lh: Letterhead; clientName: string; signed?: ContractSignature }) {
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<string[][] | null>(null)
  // o texto vira parágrafos (do desenho do Word, quando tem; senão, do texto com títulos em maiúsculas)
  const source = html
    ? cleanHtml(html)
    : toBlocks(body)
        .filter((b) => b.kind !== 'sign')
        .map((b) => (b.kind === 'gap' ? '<div class="c-gap"></div>' : b.kind === 'title' ? `<h2 class="lh-title">${esc(b.text)}</h2>` : b.kind === 'clause' ? `<h3 class="lh-clause">${esc(b.text)}</h3>` : `<p>${esc(b.text)}</p>`))
        .join('')
  const key = source + clientName + (signed?.at ?? '') + lh.top + lh.bottom + lh.side
  useLayoutEffect(() => {
    setPages(null)
  }, [key])
  useLayoutEffect(() => {
    if (pages || !measure.current) return
    const root = measure.current.querySelector('.ch-doc') ?? measure.current
    const els = [...root.children] as HTMLElement[]
    const room = PAGE_H - lh.top - lh.bottom
    const out: string[][] = [[]]
    let used = 0
    els.forEach((el, i) => {
      const h = i < els.length - 1 ? els[i + 1].offsetTop - el.offsetTop : el.offsetHeight + 8
      if (used + h > room && out[out.length - 1].length) {
        out.push([])
        used = 0
      }
      if (el.classList.contains('c-gap') && used === 0) return
      out[out.length - 1].push(el.outerHTML)
      used += h
    })
    if (used + 230 > room) out.push([])
    setPages(out)
  })
  const pad = { paddingTop: lh.top, paddingBottom: lh.bottom, paddingLeft: lh.side, paddingRight: lh.side } as CSSProperties
  if (!pages)
    return (
      <div className="contract-doc ch-own">
        <article className="contract-page lh-page is-measuring" style={pad}>
          <div ref={measure} className="lh-text" dangerouslySetInnerHTML={{ __html: source }} />
        </article>
      </div>
    )
  return (
    <div className="contract-doc ch-own">
      {pages.map((chunk, n) => (
        <article key={n} className="contract-page lh-page" style={pad}>
          <img className="lh-bg" src={n === 0 ? lh.first : lh.rest || lh.first} alt="" />
          <div className="lh-text" dangerouslySetInnerHTML={{ __html: chunk.join('') }} />
          {n === pages.length - 1 && <SignBox s={s} clientName={clientName} signed={signed} />}
        </article>
      ))}
      <SignCertificate sign={signed} />
    </div>
  )
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
