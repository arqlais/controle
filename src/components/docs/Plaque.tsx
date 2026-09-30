import type { Settings } from '../../types'
import type { PlaqueData, PlaqueLayout } from '../../docTypes'
import { QR, linkFrom, useDocLook } from '../DocKit'
import { DocPage } from './DocPage'

/* Placa de obra (proporção 3:4 — 60×80 cm, 90×120 cm ou A4): quem passa na rua vê quem assina
   o projeto e aponta a câmera no QR code para conhecer o trabalho. */

export const PLAQUE_LAYOUTS: { id: PlaqueLayout; name: string; text: string }[] = [
  { id: 'diagonal', name: 'diagonal', text: 'bloco de cor cortado na diagonal sobre a foto, com uma faixa de destaque' },
  { id: 'retrato', name: 'retrato', text: 'fundo colorido, foto dentro de um arco e cartão com os dados' },
  { id: 'faixa', name: 'faixa', text: 'foto em cima, faixa larga com a chamada e os dados embaixo' },
  { id: 'moldura', name: 'moldura', text: 'só tipografia, centralizada, com moldura dupla (sem foto)' },
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
  const photo = d.photo ? <img className="pq-photo" src={d.photo} alt="" /> : <span className="pq-photo pq-nophoto" aria-hidden><i /><i /><i /></span>
  const head = (
    <h1 className="pq-head">
      <span>{d.line1}</span>
      <em>{d.line2}</em>
    </h1>
  )
  const who = (
    <div className="pq-who">
      <b>{d.name}</b>
      {d.credential && <small>{d.credential}</small>}
      {d.phone && <span className="pq-phone">{d.phone}</span>}
    </div>
  )
  const qr = url ? (
    <div className="pq-qr">
      <QR text={url} color="currentColor" className="pq-code" />
      <p>{d.cta}</p>
    </div>
  ) : null
  const mark = (
    <span className="pq-mark" aria-hidden>
      {brand}
      <i>.</i>
    </span>
  )
  return (
    <div className="doc-pages" data-look={look.look} style={look.style}>
      <DocPage s={s} n={1} total={1} look={look.look} kind="poster" bare className={`pq pq-${d.layout} ${d.photo ? 'has-photo' : 'no-photo'}`}>
        {d.layout === 'diagonal' && (
          <>
            <div className="pq-d-photo">{photo}</div>
            <div className="pq-d-block">
              {head}
              {who}
            </div>
            <span className="pq-d-stripe" aria-hidden />
            <div className="pq-d-foot">
              {qr}
              {mark}
            </div>
          </>
        )}
        {d.layout === 'retrato' && (
          <>
            <div className="pq-r-top">{head}</div>
            <div className="pq-r-arch">{photo}</div>
            <div className="pq-r-card">
              {who}
              {qr}
            </div>
          </>
        )}
        {d.layout === 'faixa' && (
          <>
            <div className="pq-f-photo">{photo}</div>
            <div className="pq-f-band">{head}</div>
            <div className="pq-f-info">
              {who}
              {qr}
            </div>
            {mark}
          </>
        )}
        {d.layout === 'moldura' && (
          <>
            <span className="pq-m-frame" aria-hidden />
            <p className="pq-m-brand">{brand}<i>.</i></p>
            {head}
            <span className="pq-m-rule" aria-hidden />
            {who}
            {qr}
          </>
        )}
      </DocPage>
    </div>
  )
}
