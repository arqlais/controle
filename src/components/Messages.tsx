import { useState } from 'react'
import { useStore } from '../store'
import type { Client, Project, Quote } from '../types'
import { fillMessage, messageVars, whatsappLink } from '../utils'
import { href } from '../router'
import { Icon } from './Icon'
import { Modal } from './ui'
import { toast } from './dialog'

/** Botão "mensagens": escolhe uma mensagem padrão já preenchida com os dados do caso. */
export function MessagesButton({ client, project, quote, small }: { client?: Client; project?: Project; quote?: Quote; small?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={`btn ghost ${small ? 'small' : ''}`} onClick={() => setOpen(true)}>
        <Icon name="mail" size={small ? 14 : 16} /> mensagens
      </button>
      {open && <MessagesModal client={client} project={project} quote={quote} onClose={() => setOpen(false)} />}
    </>
  )
}

function MessagesModal({ client, project, quote, onClose }: { client?: Client; project?: Project; quote?: Quote; onClose: () => void }) {
  const { data } = useStore()
  const vars = messageVars(data.settings, client, project, quote)
  const [pick, setPick] = useState<string | null>(null)
  const [text, setText] = useState('')
  const choose = (id: string) => {
    const t = data.settings.messages.find((m) => m.id === id)
    setPick(id)
    setText(fillMessage(t?.text ?? '', vars))
  }
  const copy = () =>
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast('Mensagem copiada.'))
      .catch(() => toast('Selecione o texto e copie.'))

  return (
    <Modal title={pick ? 'mensagem' : 'mensagens padrão'} onClose={onClose}>
      {!pick ? (
        <div className="msg-list">
          {data.settings.messages.map((m) => (
            <button key={m.id} className="msg-item" onClick={() => choose(m.id)}>
              <b>{m.name}</b>
              <span>{fillMessage(m.text, vars)}</span>
            </button>
          ))}
          <a className="link" href={href('config')} onClick={onClose}>
            editar mensagens padrão
          </a>
        </div>
      ) : (
        <div className="stack-s">
          <textarea id="msg-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" />
          <p className="muted small">Ajuste o texto se quiser — a mudança vale só para este envio.</p>
          <div className="row gap-s wrap">
            <button className="btn ghost small" onClick={() => setPick(null)}>
              <Icon name="chevronL" size={14} /> voltar
            </button>
            <span className="spacer" />
            <button className="btn small" onClick={copy}>
              <Icon name="copy" size={14} /> copiar
            </button>
            {client?.phone && (
              <a className="btn primary small" href={whatsappLink(client.phone, text)} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" size={14} /> enviar no WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
