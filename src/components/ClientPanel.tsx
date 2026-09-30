import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useAccess } from '../access'
import { Icon } from './Icon'
import { lockPlan } from './LockedPreview'
import { go } from '../router'
import { Field, Modal, Section } from './ui'
import { askDelete, toast } from './dialog'
import { ClientPanelPublic } from './ClientPanelPublic'
import { panelLink, panelPayload, publishPanel, removePanelFile, unpublishPanel, uploadPanelFile } from '../clientPanel'
import type { Client, ClientPanel, PanelLink } from '../types'
import { fmtDate, whatsappLink } from '../utils'

/* Painel do cliente (na ficha do cliente): o profissional escolhe o que o cliente vê e manda o link.
   Tudo o que muda aqui (etapas, pagamentos, contratos…) aparece sozinho para o cliente. */

/** Cria (ou liga de novo) o painel de um cliente e publica. Usado na ficha e na lista de painéis. */
export async function createPanel(data: ReturnType<typeof useStore>['data'], client: Client, has: (f: Parameters<ReturnType<typeof useAccess>['has']>[0]) => boolean, userId: string, upsert: ReturnType<typeof useStore>['upsert']) {
  const panel = client.panel
  const contracts = (data.contracts ?? []).filter((k) => k.clientId === client.id)
  const next: ClientPanel = {
    token: panel?.token ?? crypto.randomUUID(),
    enabled: true,
    showPayments: panel?.showPayments ?? true,
    showVisits: panel?.showVisits ?? true,
    showQuotes: panel?.showQuotes ?? false,
    showBriefings: panel?.showBriefings ?? true,
    contracts: panel?.contracts ?? contracts.filter((k) => k.status !== 'rascunho').map((k) => k.id),
    docs: panel?.docs ?? [],
    files: panel?.files ?? [],
    message: panel?.message,
    hideProjects: panel?.hideProjects,
  }
  let file = false
  try {
    file = await publishPanel(userId, next.token, panelPayload(data, client, next, has))
  } catch {
    /* publica de novo na próxima mudança */
  }
  upsert('clients', { ...client, panel: { ...next, file: file || undefined, publishedAt: new Date().toISOString() } })
  return next
}

/** Mensagem pronta para mandar o link do painel. */
export const panelMessage = (client: Client, link: string) => `Oi, ${client.name.split(' ')[0]}! Este é o seu painel do projeto: etapas, pagamentos, contratos e documentos, sempre atualizados. ${link}`

export function ClientPanelSection({ client }: { client: Client }) {
  const { data, upsert, userId } = useStore()
  const { has } = useAccess()
  const panel = client.panel
  const [peek, setPeek] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!has('portal'))
    return (
      <Section title="painel do cliente">
        <div className="pn-empty">
          <Icon name="lock" size={20} />
          <p className="muted small">Um link só de {client.name.split(' ')[0]}, sem senha: etapas, pagamentos, contratos para assinar, briefings e documentos, sempre atualizado. Faz parte do plano {lockPlan('portal')}.</p>
          <button className="btn small" onClick={() => go('assinatura')}>
            <Icon name="star" size={14} /> conhecer o {lockPlan('portal')}
          </button>
        </div>
      </Section>
    )

  const enable = async () => {
    setBusy(true)
    await createPanel(data, client, has, userId, upsert)
    setBusy(false)
    toast('Painel no ar. Agora é só mandar o link.')
  }
  if (!panel?.enabled)
    return (
      <Section title="painel do cliente">
        <div className="pn-empty">
          <Icon name="link" size={22} />
          <p className="muted small">Um link só de {client.name.split(' ')[0]}, sem senha e sem cadastro: etapas do projeto, pagamentos, contratos para assinar, briefings e os documentos que você escolher. Atualiza sozinho.</p>
          <button className="btn primary small" disabled={busy} onClick={() => void enable()}>
            <Icon name="link" size={14} /> {busy ? 'criando…' : 'criar o painel'}
          </button>
        </div>
      </Section>
    )

  const link = panelLink(userId, panel.token)
  const first = client.name.split(' ')[0]
  const msg = panelMessage(client, link)
  return (
    <Section title="painel do cliente">
      <div className="stack-s pn-owner">
        <div className="pn-link-row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link do painel" />
          <button className="icon-btn has-tip" data-tip="copiar" aria-label="Copiar link" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copiado.'), () => toast(link))}>
            <Icon name="copy" size={15} />
          </button>
        </div>
        <div className="row gap-s wrap">
          {client.phone && (
            <a className="btn primary small" href={whatsappLink(client.phone, msg)} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" size={14} /> mandar no WhatsApp
            </a>
          )}
          <button className="btn small ghost" onClick={() => setPeek(true)}>
            <Icon name="eye" size={14} /> ver como o cliente vê
          </button>
        </div>

        <PanelControls client={client} />
        <button className="btn small ghost pn-live-btn" onClick={() => go('paineis', client.id)}>
          <Icon name="edit" size={14} /> editar em tempo real
        </button>
      </div>
      {peek && (
        <Modal wide title="como o cliente vê" onClose={() => setPeek(false)}>
          <p className="muted small">É exatamente esta página que abre no celular de {first}.</p>
          <div className="bf-preview-frame">
            <ClientPanelPublic id={panel.token} data={panelPayload(data, client, panel, has)} preview />
          </div>
        </Modal>
      )}
    </Section>
  )
}


/** Tudo o que dá para mudar no painel (o que aparece, links, arquivos, recado). Usado na ficha e no editor em tempo real. */
export function PanelControls({ client, open }: { client: Client; open?: boolean }) {
  const { data, upsert, userId } = useStore()
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const panel = client.panel
  if (!panel) return null
  const save = (patch: Partial<ClientPanel>) => upsert('clients', { ...client, panel: { ...panel, ...patch } })
  const first = client.name.split(' ')[0]
  const projects = data.projects.filter((p) => p.clientId === client.id)
  const contracts = (data.contracts ?? []).filter((k) => k.clientId === client.id)
  const docs = (data.docs ?? []).filter((x) => x.clientId === client.id)
  const briefings = (data.briefings ?? []).filter((b) => b.clientId === client.id)
  const quotes = data.quotes.filter((q) => q.clientId === client.id && q.status !== 'rascunho')
  const toggle = (key: 'contracts' | 'docs', id: string, on: boolean) => save({ [key]: on ? [...(panel[key] ?? []), id] : (panel[key] ?? []).filter((x) => x !== id) })
  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    const added = []
    for (const f of [...list]) {
      if (f.size > 15_000_000) {
        toast(`“${f.name}” passa de 15 MB. Use um link de pasta (Drive, WeTransfer) em "links do projeto".`)
        continue
      }
      try {
        added.push(await uploadPanelFile(userId, f))
      } catch {
        toast(`Não consegui enviar “${f.name}”.`)
      }
    }
    setBusy(false)
    if (added.length) {
      save({ files: [...(panel.files ?? []), ...added] })
      toast(added.length === 1 ? 'Arquivo no painel.' : `${added.length} arquivos no painel.`)
    }
  }
  const disable = async () => {
    if (!(await askDelete('o painel do cliente (o link para de abrir)'))) return
    await unpublishPanel(userId, panel.token).catch(() => undefined)
    save({ enabled: false })
    toast('Painel tirado do ar.')
  }
  return (
    <div className="stack-s pn-controls">
        <details className="pn-share" open={open}>
          <summary>o que {first} vê</summary>
          <div className="stack-s">
            <label className="check">
              <input type="checkbox" checked disabled /> <span>demandas com etapas e prazos</span>
            </label>
            {projects.length > 1 &&
              projects.map((p) => (
                <label key={p.id} className="check pn-indent">
                  <input type="checkbox" checked={!(panel.hideProjects ?? []).includes(p.id)} onChange={(e) => save({ hideProjects: e.target.checked ? (panel.hideProjects ?? []).filter((x) => x !== p.id) : [...(panel.hideProjects ?? []), p.id] })} /> <span>{p.title}</span>
                </label>
              ))}
            <label className="check">
              <input type="checkbox" checked={panel.showPayments} onChange={(e) => save({ showPayments: e.target.checked })} /> <span>pagamentos (pago e em aberto)</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={!!panel.showVisits} onChange={(e) => save({ showVisits: e.target.checked })} /> <span>visitas de obra</span>
            </label>
            {briefings.length > 0 && (
              <label className="check">
                <input type="checkbox" checked={!!panel.showBriefings} onChange={(e) => save({ showBriefings: e.target.checked })} /> <span>briefings (responder e ver respostas)</span>
              </label>
            )}
            {panel.showBriefings &&
              briefings.map((b) => (
                <p key={b.id} className="pn-indent pn-sub-item">
                  <span>
                    {b.title} <small className="muted">· {b.status === 'respondido' ? 'respondido' : 'esperando resposta'}</small>
                  </span>
                  <button type="button" className="link small pn-edit-link" onClick={() => go('briefings')}>
                    editar
                  </button>
                </p>
              ))}
            {quotes.length > 0 && (
              <label className="check">
                <input type="checkbox" checked={!!panel.showQuotes} onChange={(e) => save({ showQuotes: e.target.checked })} /> <span>propostas enviadas</span>
              </label>
            )}
            {contracts.length > 0 && <p className="pn-group">contratos</p>}
            {contracts.map((k) => (
              <label key={k.id} className="check">
                <input type="checkbox" checked={(panel.contracts ?? []).includes(k.id)} onChange={(e) => toggle('contracts', k.id, e.target.checked)} />{' '}
                <span>
                  {k.title} <small className="muted">· {k.sign ? 'assinado' : k.signLink ? 'com link para assinar' : 'sem link de assinatura ainda'}</small>
                </span>
                <button type="button" className="link small pn-edit-link" onClick={(e) => (e.preventDefault(), go('contratos', k.id))}>
                  editar
                </button>
              </label>
            ))}
            {docs.length > 0 && <p className="pn-group">documentos salvos</p>}
            {docs.map((x) => (
              <label key={x.id} className="check">
                <input type="checkbox" checked={(panel.docs ?? []).includes(x.id)} onChange={(e) => toggle('docs', x.id, e.target.checked)} /> <span>{x.title}</span>
                <button type="button" className="link small pn-edit-link" onClick={(e) => (e.preventDefault(), go('documentos', x.id))}>
                  editar
                </button>
              </label>
            ))}
          </div>
        </details>

        <PanelLinks links={panel.links ?? []} onChange={(links) => save({ links })} />

        <div className="pn-files-owner">
          <div className="row between">
            <span className="field-label">arquivos para o cliente</span>
            <button className="btn small" disabled={busy} onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={14} /> {busy ? 'enviando…' : 'enviar arquivo'}
            </button>
            <input ref={fileInput} type="file" multiple hidden accept=".pdf,image/*,.dwg,.zip,.doc,.docx,.xls,.xlsx,.skp" onChange={(e) => (void addFiles(e.target.files), (e.target.value = ''))} />
          </div>
          {(panel.files ?? []).length > 0 ? (
            <ul className="list pn-file-list">
              {(panel.files ?? []).map((f) => (
                <li key={f.id} className="list-item">
                  <Icon name="file" size={15} />
                  <a className="grow" href={f.url} target="_blank" rel="noreferrer">
                    <div className="list-title">{f.name}</div>
                    <div className="list-sub">{fmtDate(f.at.slice(0, 10))}</div>
                  </a>
                  {projects.length > 1 && (
                    <select value={f.projectId ?? ''} onChange={(e) => save({ files: (panel.files ?? []).map((y) => (y.id === f.id ? { ...y, projectId: e.target.value || undefined } : y)) })} aria-label="Demanda do arquivo">
                      <option value="">geral</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className="icon-btn subtle"
                    aria-label="Tirar arquivo"
                    onClick={async () => {
                      if (!(await askDelete(`o arquivo "${f.name}" do painel`))) return
                      await removePanelFile(userId, f)
                      save({ files: (panel.files ?? []).filter((y) => y.id !== f.id) })
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Plantas, memorial, imagens, orçamentos de fornecedor… PDF ou imagem até 15 MB.</p>
          )}
        </div>

        <Field label="Recado no topo do painel (opcional)">
          <textarea rows={2} value={panel.message ?? ''} onChange={(e) => save({ message: e.target.value })} placeholder="Ex.: estamos no executivo; semana que vem mando as plantas para aprovar." spellCheck lang="pt-BR" />
        </Field>
        <button className="link small danger-link" onClick={() => void disable()}>
          tirar o painel do ar
        </button>
          </div>
  )
}

/** Reconhece o serviço do link para dar nome e ícone sozinho. */
export function linkKind(url: string): { name: string; icon: string } {
  const u = url.toLowerCase()
  if (/drive\.google|docs\.google/.test(u)) return { name: 'pasta no Drive', icon: 'folder' }
  if (/pinterest|pin\.it/.test(u)) return { name: 'referências no Pinterest', icon: 'heart' }
  if (/dropbox/.test(u)) return { name: 'pasta no Dropbox', icon: 'folder' }
  if (/wetransfer|we\.tl/.test(u)) return { name: 'arquivos no WeTransfer', icon: 'download' }
  if (/youtube|youtu\.be|vimeo/.test(u)) return { name: 'vídeo do projeto', icon: 'monitor' }
  if (/canva/.test(u)) return { name: 'apresentação no Canva', icon: 'layers' }
  if (/figma/.test(u)) return { name: 'projeto no Figma', icon: 'layers' }
  if (/onedrive|sharepoint|1drv/.test(u)) return { name: 'pasta no OneDrive', icon: 'folder' }
  if (/matterport|kuula|panoee|360/.test(u)) return { name: 'tour 360°', icon: 'cube' }
  return { name: 'link do projeto', icon: 'link' }
}

/** Links do projeto (Drive, Pinterest, renders, tour 360…): nome + endereço. */
function PanelLinks({ links, onChange }: { links: PanelLink[]; onChange: (l: PanelLink[]) => void }) {
  const [url, setUrl] = useState('')
  const add = () => {
    const raw = url.trim()
    if (!raw) return
    const full = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
    onChange([...links, { id: crypto.randomUUID(), label: linkKind(full).name, url: full }])
    setUrl('')
  }
  return (
    <div className="pn-links-owner">
      <span className="field-label">links do projeto</span>
      {links.map((l, i) => (
        <div key={l.id} className="pn-link-edit">
          <Icon name={linkKind(l.url).icon} size={15} />
          <input value={l.label} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Nome do link" />
          <input value={l.url} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} aria-label="Endereço" className="pn-link-url" />
          <button className="icon-btn subtle" aria-label="Tirar link" onClick={() => onChange(links.filter((_, j) => j !== i))}>
            <Icon name="trash" size={14} />
          </button>
        </div>
      ))}
      <div className="pn-link-row">
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="cole o link: Drive, Pinterest, WeTransfer, tour 360…" aria-label="Novo link" />
        <button className="btn small" onClick={add} disabled={!url.trim()}>
          <Icon name="plus" size={14} /> adicionar
        </button>
      </div>
    </div>
  )
}

/** Mantém os painéis dos clientes em dia: publica de novo quando algo que o cliente vê muda. */
export function ClientPanelSync() {
  const { data, userId, isSample } = useStore()
  const { has } = useAccess()
  const on = has('portal') && !isSample
  const list = useMemo(
    () =>
      on
        ? data.clients
            .filter((c) => c.panel?.enabled)
            .map((c) => {
              const p = panelPayload(data, c, c.panel!, has)
              return { token: c.panel!.token, sig: JSON.stringify({ ...p, updatedAt: '' }), p }
            })
        : [],
    [data, has, on],
  )
  const last = useRef<Record<string, string>>({})
  useEffect(() => {
    const changed = list.filter((x) => last.current[x.token] !== undefined && last.current[x.token] !== x.sig)
    // primeira passada: só lembra como está (não republica tudo ao abrir)
    for (const x of list) if (last.current[x.token] === undefined) last.current[x.token] = x.sig
    if (!changed.length) return
    const t = setTimeout(() => {
      for (const x of changed) {
        last.current[x.token] = x.sig
        void publishPanel(userId, x.token, { ...x.p, updatedAt: new Date().toISOString() }).catch(() => undefined)
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [list, userId])
  return null
}
