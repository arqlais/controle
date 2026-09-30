import type { Settings } from '../../types'
import type { PlaqueData, PlaqueLayout } from '../../docTypes'
import { QR, linkFrom, useDocLook } from '../DocKit'
import { DocPage } from './DocPage'

/* Placa de obra (proporção 3:4 — 60×80 cm, 90×120 cm ou A4): quem passa na rua vê quem assina
   o projeto e aponta a câmera no QR code para conhecer o trabalho. */

export const PLAQUE_LAYOUTS: { id: PlaqueLayout; name: string; text: string }[] = [
  { id: 'diagonal', name: 'diagonal', text: 'foto do projeto cortada por um bloco de cor' },
  { id: 'retrato', name: 'retrato', text: 'fundo de cor e a sua foto (ou do projeto) embaixo' },
  { id: 'faixa', name: 'faixa', text: 'foto no alto e as informações numa faixa' },
  { id: 'moldura', name: 'moldura', text: 'sem foto: tipografia grande e moldura fina' },
]

export function plaqueData(s: Settings, d?: PlaqueData): Required<Omit<PlaqueData, 'photo'>> & { photo?: string } {
  return {
    layout: d?.layout ?? 'diagonal',
    line1: d?.line1 ?? 'esta obra tem',
    line2: d?.line2 ?? 'a nossa assinatura',
    name: d?.name ?? (s.legalName || s.brandName || s.ownerName || ''),
    credential: d?.credential ?? 'CAU A000000-0',
    phone: d?.phone ?? s.phone ?? '',
    cta: d?.cta ?? 'aponte a câmera e conheça outros projetos',
    link: d?.link ?? (s.website || (s.instagram ? `@${s.instagram.replace(/^@/, '')}` : '')),
    photo: d?.photo,
    size: d?.size ?? '60x80',
  }
}

export function PlaqueDoc({ s, data }: { s: Settings; data?: PlaqueData }) {
  const look = useDocLook(s)
  const d = plaqueData(s, data)
  const brand = (s.brandName || s.ownerName || 'estúdio').toLowerCase()
  const url = linkFrom(d.link)
  const words = d.name.trim().split(/\s+/)
  return (
    <div className="doc-pages" data-look={look.look} style={look.style}>
      <DocPage s={s} n={1} total={1} look={look.look} kind="poster" bare className={`pq pq-${d.layout} ${d.photo ? 'has-photo' : 'no-photo'}`}>
        {d.photo && d.layout !== 'moldura' && <img className="pq-photo" src={d.photo} alt="" />}
        {d.layout === 'diagonal' && <span className="pq-cut" aria-hidden />}
        <div className="pq-text">
          <h1 className="pq-head">
            <span>{d.line1}</span>
            <em>
              <i className="pq-dot" /> {d.line2}
            </em>
          </h1>
          <div className="pq-who">
            <b>{d.layout === 'diagonal' ? words.map((w, i) => <span key={i}>{w}</span>) : d.name}</b>
            {d.credential && <small>{d.credential}</small>}
          </div>
          <div className="pq-qr">
            {url && <p>{d.cta}</p>}
            {url && <QR text={url} color="currentColor" className="pq-code" />}
            {d.phone && <span className="pq-phone">{d.phone}</span>}
          </div>
        </div>
        <span className="pq-mark" aria-hidden>
          {brand}
          <i>.</i>
        </span>
      </DocPage>
    </div>
  )
}
