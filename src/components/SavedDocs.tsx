import { WORK_KINDS } from '../workDocs'
import { useStore } from '../store'
import { href } from '../router'
import { Icon } from './Icon'
import { Section } from './ui'
import { askDelete } from './dialog'
import { fmtDate } from '../utils'
import type { SavedDoc } from '../docTypes'

/** Documentos salvos (na tela de documentos e na ficha do cliente). */
export function SavedDocs({ list, showClient }: { list: SavedDoc[]; showClient?: boolean }) {
  const { data, remove } = useStore()
  if (!list.length) return null
  return (
    <Section title="documentos salvos">
      <ul className="list saved-docs">
        {[...list]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((d) => (
            <li key={d.id} className="list-item">
              <span className="saved-doc-icon">
                <Icon name={d.kind === 'obra' ? WORK_KINDS[d.work?.kind ?? 'memorial'].icon : d.kind === 'placa' ? 'hardhat' : d.kind === 'apresentacao' ? 'layers' : d.kind === 'briefing' ? 'clip' : 'ruler'} size={16} />
              </span>
              <a className="grow" href={href('documentos', d.id)}>
                <div className="list-title">{d.title}</div>
                <div className="list-sub">
                  {showClient ? `${data.clients.find((c) => c.id === d.clientId)?.name ?? 'cliente'} · ` : ''}salvo {fmtDate(d.updatedAt.slice(0, 10))}
                  {d.html ? ' · com edições na folha' : ''}
                </div>
              </a>
              <a className="btn small ghost" href={href('documentos', d.id)}>
                abrir
              </a>
              <button className="icon-btn subtle" aria-label="Apagar documento" onClick={async () => (await askDelete(`o documento "${d.title}"`)) && remove('docs', d.id)}>
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
      </ul>
    </Section>
  )
}

