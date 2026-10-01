import type { Settings } from '../../types'
import type { PhotoPos, PlaqueData, PlaqueLayout } from '../../docTypes'
import { photoStyle } from '../DocKit'
import { QR, linkFrom, useDocLook } from '../DocKit'
import { DocPage } from './DocPage'
import { showsLogo } from '../../proposalTemplates'

/* Placa de obra (proporção 3:4 — 60×80 cm, 90×120 cm ou A4): quem passa na rua vê quem assina
   o projeto e aponta a câmera no QR code para conhecer o trabalho. */

export const PLAQUE_LAYOUTS: { id: PlaqueLayout; name: string; text: string }[] = [
  { id: 'diagonal', name: 'diagonal', text: 'bloco de cor cortado na diagonal sobre a foto, com uma faixa de destaque' },
  { id: 'retrato', name: 'retrato', text: 'fundo de cor e a foto (sua ou do projeto) no canto, com curva' },
  { id: 'faixa', name: 'faixa', text: 'foto no alto e as informações numa faixa' },
  { id: 'moldura', name: 'moldura', text: 'só tipografia, centralizada, com moldura dupla (sem foto)' },
]

/** Layouts que usam foto (a moldura é só tipografia). */
export const plaqueHasPhoto = (layout: PlaqueLayout) => layout !== 'moldura'

/** Foto recortada no molde: arrastar muda o centro, aproximar corta as bordas. */
export function FramedPhoto({ src, pos, className = '' }: { src: string; pos?: PhotoPos; className?: string }) {
  const p = pos ?? { x: 50, y: 50, zoom: 1 }
  return (
    <span className={`pq-ph ${className}`}>
      <img src={src} alt="" style={photoStyle(p)} />
    </span>
  )
}

export function plaqueData(s: Settings, d?: PlaqueData): Required<Omit<PlaqueData, 'photo' | 'photoPos'>> & { photo?: string; photoPos?: PhotoPos } {
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
    photoPos: d?.photoPos,
    size: d?.size ?? '60x80',
  }
}

export function PlaqueDoc({ s, data }: { s: Settings; data?: PlaqueData }) {
  const look = useDocLook(s)
  const d = plaqueData(s, data)
  const brand = (s.brandName || s.ownerName || 'estúdio').toLowerCase()
  const url = linkFrom(d.link)
  const photo = d.photo ? <FramedPhoto className="pq-photo" src={d.photo} pos={d.photoPos} /> : <span className="pq-photo pq-nophoto" aria-hidden><i /><i /><i /></span>
  // retrato e faixa: o desenho de antes (foto de fundo recortada, textos em coluna, marca grande no pé)
  const classic = d.layout === 'retrato' || d.layout === 'faixa'
  const classicText = (
    <div className="pq-text">
      <h1 className="pq-head">
        <span>{d.line1}</span>
        <em>
          <i className="pq-dot" /> {d.line2}
        </em>
      </h1>
      <div className="pq-who">
        <b>{d.name}</b>
        {d.credential && <small>{d.credential}</small>}
      </div>
      <div className="pq-qr">
        {url && <p>{d.cta}</p>}
        {url && <QR text={url} color="currentColor" className="pq-code" />}
        {d.phone && <span className="pq-phone">{d.phone}</span>}
      </div>
    </div>
  )
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
  // com logotipo anexado, a marca da placa é o logo; sem ele, o nome do estúdio
  const logo = showsLogo(s) ? <img className="pq-logo" src={s.logo} alt="" /> : null
  const mark = logo ? (
    <span className="pq-mark pq-mark-logo">{logo}</span>
  ) : (
    <span className="pq-mark" aria-hidden>
      {brand}
      <i>.</i>
    </span>
  )
  return (
    <div className="doc-pages" data-look={look.look} style={look.style}>
      <DocPage s={s} n={1} total={1} look={look.look} kind="poster" bare className={`pq pq-${d.layout} ${classic ? 'pq-old' : ''} ${d.photo ? 'has-photo' : 'no-photo'}`}>
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
        {classic && (
          <>
            {d.photo && <FramedPhoto className="pq-photo" src={d.photo} pos={d.photoPos} />}
            {classicText}
            {logo ? (
              <span className="pq-mark pq-mark-big pq-mark-logo">{logo}</span>
            ) : (
              <span className="pq-mark pq-mark-big" aria-hidden>
                {brand}
                <i>.</i>
              </span>
            )}
          </>
        )}
        {d.layout === 'moldura' && (
          <>
            <span className="pq-m-frame" aria-hidden />
            {logo ? <p className="pq-m-brand pq-mark-logo">{logo}</p> : <p className="pq-m-brand">{brand}<i>.</i></p>}
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
