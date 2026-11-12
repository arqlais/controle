// planê.apê: se uma tela der erro inesperado, mostra um aviso simples no lugar dela (nunca a página em branco).
// Versão nova no ar com a página aberta: recarrega sozinho uma vez.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ApeIcon } from './ApeIcon'
import { wa } from './model'

const velho = (e: unknown) => /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically|ChunkLoadError/i.test(String((e as Error)?.message ?? e))

export class Protege extends Component<{ children: ReactNode; chave: string; whats: string }, { erro: Error | null }> {
  state = { erro: null as Error | null }
  static getDerivedStateFromError(erro: Error) { return { erro } }
  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error(erro, info.componentStack)
    try { localStorage.setItem('ape-ultimo-erro', JSON.stringify({ em: new Date().toISOString(), pagina: location.hash, msg: String(erro?.message ?? erro).slice(0, 300) })) } catch { /* sem espaço */ }
    if (velho(erro)) {
      try {
        const ult = Number(sessionStorage.getItem('ape-recarregou') || 0)
        if (Date.now() - ult > 60_000) { sessionStorage.setItem('ape-recarregou', String(Date.now())); location.reload() }
      } catch { location.reload() }
    }
  }
  componentDidUpdate(prev: { chave: string }) { if (this.state.erro && prev.chave !== this.props.chave) this.setState({ erro: null }) }
  render() {
    const { erro } = this.state
    if (!erro) return this.props.children
    const msg = String(erro?.message ?? erro).slice(0, 160)
    return (
      <section className="ape-panel ape-empty" role="alert">
        <span className="ic"><ApeIcon name="alert" /></span>
        <b>{velho(erro) ? 'o site foi atualizado' : 'esta parte não abriu direito'}</b>
        <span>Nada do que você mandou se perde. Toque em recarregar; se continuar, avise a gente pelo WhatsApp.</span>
        <div className="ape-acts">
          <button className="ape-btn primary" onClick={() => location.reload()}><ApeIcon name="check" />recarregar</button>
          <a className="ape-btn" href={wa(this.props.whats, `Oi! O site do planê.apê deu um erro aqui (${location.hash || 'início'}): ${msg}`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />avisar no WhatsApp</a>
        </div>
      </section>
    )
  }
}
