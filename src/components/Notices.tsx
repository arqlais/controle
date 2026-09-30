import { useState } from 'react'
import { useStore } from '../store'
import { go } from '../router'
import { Icon } from './Icon'
import { useNotifyAsk } from '../notify'
import type { Notice } from '../types'

/* Central de avisos: o que os clientes preencheram, assinaram ou mandaram (fica no topo, ícone de caixa). */

const ICON: Record<Notice['kind'], 'clip' | 'pen' | 'chat' | 'bell'> = { briefing: 'clip', assinatura: 'pen', recado: 'chat', aviso: 'bell' }

const when = (iso: string) => {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days < 1 && new Date().toDateString() === d.toDateString()) return `hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (days < 2) return 'ontem'
  return d.toLocaleDateString('pt-BR')
}

export function NoticesButton() {
  const { data, upsert, remove } = useStore()
  const [open, setOpen] = useState(false)
  const notify = useNotifyAsk()
  const list = [...(data.notices ?? [])].sort((a, b) => b.at.localeCompare(a.at))
  const unread = list.filter((n) => !n.read)
  const markAll = () => unread.forEach((n) => upsert('notices', { ...n, read: true }))
  const openOne = (n: Notice) => {
    if (!n.read) upsert('notices', { ...n, read: true })
    setOpen(false)
    if (n.link) {
      const [page, id] = n.link.split('/')
      go(page as Parameters<typeof go>[0], id)
    }
  }
  return (
    <div className="nt-wrap">
      <button className="icon-btn news-btn" onClick={() => setOpen((v) => !v)} aria-label={unread.length ? `${unread.length} aviso(s) de clientes` : 'Avisos de clientes'} title="Avisos de clientes">
        <Icon name="inbox" />
        {unread.length > 0 && <span className="nt-count">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <>
          <div className="click-away" onClick={() => setOpen(false)} />
          <div className="nt-panel" role="dialog" aria-label="Avisos de clientes">
            <div className="nt-head">
              <b>avisos</b>
              {unread.length > 0 && (
                <button className="link small" onClick={markAll}>
                  marcar tudo como lido
                </button>
              )}
            </div>
            {list.length === 0 ? (
              <p className="muted small nt-empty">Quando um cliente responder um briefing, assinar um contrato ou mandar um recado pelo painel, aparece aqui (e chega no seu e-mail).</p>
            ) : (
              <ul className="nt-list">
                {list.slice(0, 30).map((n) => (
                  <li key={n.id} className={n.read ? '' : 'is-new'}>
                    <button className="nt-item" onClick={() => openOne(n)}>
                      <span className="nt-ico">
                        <Icon name={ICON[n.kind]} size={15} />
                      </span>
                      <span className="grow">
                        <b>{n.title}</b>
                        {n.text && <small>{n.text}</small>}
                        <small className="nt-when">{when(n.at)}</small>
                      </span>
                    </button>
                    <button className="icon-btn subtle nt-del" aria-label="Apagar aviso" onClick={() => remove('notices', n.id)}>
                      <Icon name="x" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {notify.canAsk && (
              <button className="btn small ghost nt-ask" onClick={() => void notify.ask()}>
                <Icon name="bell" size={14} /> avisar também na tela do aparelho
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
