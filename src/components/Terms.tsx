import { useEffect, useState } from 'react'
import { Modal } from './ui'
import { platform } from '../platform'
import { DEFAULT_TERMS, EMPTY_COMPANY, fillTerms, type Company } from '../siteContent'

/* Termos de uso + contrato de assinatura (texto que a dona edita no painel).
   Mostrados por inteiro antes do aceite, no cadastro e na assinatura, já preenchidos
   com os dados da plataforma e de quem está assinando. */

export type TermsWho = { name?: string; doc?: string; email?: string; plan?: string }

export function useTerms(who: TermsWho = {}) {
  const [terms, setTerms] = useState(DEFAULT_TERMS)
  const [company, setCompany] = useState<Company>(EMPTY_COMPANY)
  useEffect(() => {
    platform.terms().then(setTerms).catch(() => undefined)
    platform.company().then(setCompany).catch(() => undefined)
  }, [])
  return fillTerms(terms, company, who)
}

export function TermsText({ text }: { text: string }) {
  return (
    <div className="terms-text">
      {text.split('\n').map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} className="terms-gap" />
        if (t === t.toUpperCase() && /[A-ZÁÉÍÓÚÇ]{3}/.test(t)) return <h4 key={i}>{t.toLowerCase()}</h4>
        return <p key={i}>{t}</p>
      })}
    </div>
  )
}

export function TermsModal({ onClose, onAccept, who }: { onClose: () => void; onAccept?: () => void; who?: TermsWho }) {
  const terms = useTerms(who)
  return (
    <Modal
      wide
      title="termos de uso e contrato de assinatura"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            fechar
          </button>
          {onAccept && (
            <button
              className="btn primary"
              onClick={() => {
                onAccept()
                onClose()
              }}
            >
              li e aceito
            </button>
          )}
        </>
      }
    >
      <TermsText text={terms} />
    </Modal>
  )
}
