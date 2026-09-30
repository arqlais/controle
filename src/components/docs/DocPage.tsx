import type { ReactNode } from 'react'
import type { Settings } from '../../types'

/* Uma folha de documento com o "jeito" do modelo escolhido nas configurações:
   lais (arcos suaves), coluna (faixa lateral), faixa (cabeçalho em faixa), planilha (linhas finas)
   e editorial (número grande). As cores e fontes são sempre as da conta. */

export const PAGE = { a4: [794, 1123], poster: [900, 1200], slide: [1280, 720] } as const

export function DocPage({ s, n, total, look, kind = 'a4', className = '', children, bare }: { s: Settings; n: number; total: number; look: string; kind?: keyof typeof PAGE; className?: string; children: ReactNode; bare?: boolean }) {
  const brand = s.brandName || s.ownerName || 'estúdio'
  const contact = [s.phone, s.instagram && `@${s.instagram.replace(/^@/, '')}`, s.website].filter(Boolean).join('   ·   ')
  return (
    <section className={`pdf-page d-page d-${kind} look-${look} ${className}`}>
      {!bare && (
        <>
          <span className="d-motif" aria-hidden>
            <i />
            <b>{look === 'editorial' ? String(n).padStart(2, '0') : brand}</b>
          </span>
          {s.logo && kind !== 'poster' ? <img className="d-logo" src={s.logo} alt="" /> : <span className="d-brand">{brand}</span>}
        </>
      )}
      <div className="d-body">{children}</div>
      {!bare && (
        <footer className="d-foot">
          <span>{contact || brand}</span>
          <span>
            {String(n).padStart(2, '0')}/{String(total).padStart(2, '0')}
          </span>
        </footer>
      )}
    </section>
  )
}
