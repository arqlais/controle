import type { Client, Quote, Settings } from '../types'
import { QuoteDoc } from '../components/Docs'
import { ContractDoc } from '../components/ContractDoc'
import { DocScale } from '../components/Print'
import { DEFAULT_CONTRACTS, contractVars, fillContract } from '../contracts'

/* Proposta e contrato de verdade na vitrine da página de vendas (carrega só quando a aba abre).
   A folha fica numa janela de altura fixa, com rolagem, para a vitrine não mudar de tamanho. */
export default function LandingDoc({ kind, s, quote, client }: { kind: 'proposta' | 'contrato'; s: Settings; quote: Quote; client?: Client }) {
  return (
    <div className="lp-doc lp-doc-window">
      <DocScale>{kind === 'proposta' ? <QuoteDoc s={s} quote={quote} client={client} /> : <ContractDoc s={s} body={fillContract(DEFAULT_CONTRACTS[2].body, contractVars(s, quote, client))} clientName={client?.name ?? ''} />}</DocScale>
    </div>
  )
}
