import { useEffect, useState } from 'react'
import { Modal } from './ui'
import { Icon } from './Icon'
import { toast } from './dialog'
import { whatsappLink } from '../utils'

/* Entregar um arquivo gerado (PDF, PNG) para a pessoa.
   Computador/Android: baixa direto.
   iPhone/iPad: o Safari não abre o arquivo gerado na página ("WebKitBlobResource erro 1"),
   então aparece "arquivo pronto" com o botão de compartilhar do próprio iPhone
   (Salvar em Arquivos, WhatsApp, e-mail…). O toque no botão é o que o iPhone exige. */

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
/** Aberto como aplicativo (ícone na tela de início): o download comum não funciona, então vai pelo compartilhar do celular. */
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** Enviar ao cliente: o PDF vai junto com a mensagem pelo compartilhar do aparelho (WhatsApp, e-mail…). */
export type SendInfo = { text: string; phone?: string }
type Ready = { file: File; url: string; send?: SendInfo } | null
let show: (r: Ready) => void = () => undefined

export function saveFile(blob: Blob, filename: string, done = 'Arquivo baixado.') {
  if (isIOS() || (isStandalone() && /Android/i.test(navigator.userAgent))) {
    const file = new File([blob], filename, { type: blob.type })
    show({ file, url: URL.createObjectURL(file) })
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000) // revogar na hora cancelava o download em alguns navegadores
  toast(done)
}

/** PDF pronto para mandar ao cliente: abre a janela "proposta pronta" com o botão de enviar (o toque é exigido pelo celular para compartilhar). */
export function sendFile(blob: Blob, filename: string, send: SendInfo) {
  const file = new File([blob], filename, { type: blob.type || 'application/pdf' })
  show({ file, url: URL.createObjectURL(file), send })
}

/** Converte data URL (ex.: PNG do html-to-image) em arquivo. */
export async function dataUrlBlob(url: string) {
  return (await fetch(url)).blob()
}

export function FileReadyHost() {
  const [ready, setReady] = useState<Ready>(null)
  useEffect(() => {
    show = (r) =>
      setReady((old) => {
        if (old) URL.revokeObjectURL(old.url)
        return r
      })
    return () => {
      show = () => undefined
    }
  }, [])
  if (!ready) return null
  const close = () => {
    URL.revokeObjectURL(ready.url)
    setReady(null)
  }
  const send = ready.send
  const download = () => {
    const a = document.createElement('a')
    a.href = ready.url
    a.download = ready.file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  // enviar ao cliente: PDF + mensagem pelo compartilhar; sem ele (computador), baixa o PDF e abre o WhatsApp com a mensagem
  const sendNow = async () => {
    if (!send) return
    void navigator.clipboard?.writeText(send.text).catch(() => undefined) // alguns apps só levam o arquivo: a mensagem fica copiada
    try {
      if (navigator.canShare?.({ files: [ready.file] })) {
        await navigator.share({ files: [ready.file], text: send.text, title: ready.file.name })
        close()
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    download()
    if (send.phone) window.open(whatsappLink(send.phone, send.text), '_blank', 'noopener')
    toast(send.phone ? 'PDF baixado e WhatsApp aberto com a mensagem: anexe o PDF na conversa (clipe → documento).' : 'PDF baixado e mensagem copiada: anexe o PDF e cole a mensagem na conversa.')
    close()
  }
  const share = async () => {
    try {
      if (navigator.canShare?.({ files: [ready.file] })) {
        await navigator.share({ files: [ready.file], title: ready.file.name })
        close()
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // fechou o compartilhar sem escolher
    }
    // sem compartilhar: tenta baixar; no app aberto pelo ícone, abre o arquivo para salvar pelo próprio navegador
    const a = document.createElement('a')
    a.href = ready.url
    a.download = ready.file.name
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  if (send)
    return (
      <Modal
        title="proposta pronta"
        onClose={close}
        footer={
          <>
            <button className="btn ghost" onClick={() => (download(), toast('PDF baixado.'))}>
              <Icon name="download" size={16} /> só baixar
            </button>
            <button className="btn primary" onClick={sendNow}>
              <Icon name="whatsapp" size={16} /> enviar ao cliente
            </button>
          </>
        }
      >
        <p>
          <b>{ready.file.name}</b>
        </p>
        <p className="muted small">
          Toque em <b>enviar ao cliente</b> e escolha o WhatsApp (ou e-mail): o PDF vai junto com a mensagem. A mensagem também fica copiada, caso o app mande só o arquivo.
        </p>
      </Modal>
    )
  return (
    <Modal
      title="arquivo pronto"
      onClose={close}
      footer={
        <>
          <a className="btn ghost" href={ready.url} target="_blank" rel="noreferrer">
            abrir
          </a>
          <button className="btn primary" onClick={share}>
            <Icon name="download" size={16} /> salvar ou enviar
          </button>
        </>
      }
    >
      <p>
        <b>{ready.file.name}</b>
      </p>
      <p className="muted small">Toque em <b>salvar ou enviar</b>: dá para salvar em Arquivos ou mandar direto no WhatsApp.</p>
    </Modal>
  )
}
