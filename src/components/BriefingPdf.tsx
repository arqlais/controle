import { useStore } from '../store'
import { usePdf } from './Print'
import { Icon } from './Icon'
import { BriefingSheetDoc } from './docs/BriefingSheet'
import { PAGE } from './docs/DocPage'
import type { Briefing } from '../types'

/** Baixar o briefing respondido em PDF (no design escolhido nas configurações). */
export default function BriefingPdfButton({ b }: { b: Briefing }) {
  const { data } = useStore()
  const pdf = usePdf()
  const client = data.clients.find((c) => c.id === b.clientId)
  const doc = <BriefingSheetDoc s={data.settings} tpl={{ name: b.title, sections: b.sections ?? [], questions: b.questions }} client={client?.name} answers={b.answers ?? {}} />
  return (
    <>
      <button className="btn small" disabled={pdf.busy} onClick={() => pdf.downloadPages(doc, `Briefing - ${client?.name ?? b.title}.pdf`, PAGE.a4[0], PAGE.a4[1])}>
        <Icon name="download" size={14} /> {pdf.busy ? 'gerando…' : 'baixar em PDF'}
      </button>
      {pdf.portal}
    </>
  )
}
