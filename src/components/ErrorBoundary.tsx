import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'

/* Se uma tela der erro, só ela mostra o aviso (o menu e o resto do sistema continuam).
   Versão nova publicada com o sistema aberto: a tela pede um arquivo que não existe mais;
   aí recarrega sozinho uma vez para pegar a versão nova. */

const RELOAD_KEY = 'recarregou-versao'
const isStaleChunk = (e: unknown) => /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically|ChunkLoadError/i.test(String((e as Error)?.message ?? e))

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string; full?: boolean }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
    try {
      localStorage.setItem('ultimo-erro', JSON.stringify({ at: new Date().toISOString(), page: location.hash, message: String(error?.message ?? error).slice(0, 300) }))
    } catch {
      /* sem espaço */
    }
    if (isStaleChunk(error)) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
          location.reload()
        }
      } catch {
        location.reload()
      }
    }
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // mudou de tela: tenta de novo
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const stale = isStaleChunk(error)
    return (
      <div className={`card err-box ${this.props.full ? 'is-full' : ''}`} role="alert">
        <Icon name="alert" size={24} />
        <h2>{stale ? 'o planê foi atualizado' : 'esta tela não abriu direito'}</h2>
        <p className="muted">{stale ? 'Tem uma versão nova no ar. Recarregue para continuar: nada do que você salvou se perde.' : 'Seus dados estão guardados. Tente de novo ou volte para o início; se continuar, fale com a gente pelo balão de conversa.'}</p>
        <div className="row gap-s wrap">
          <button className="btn primary" onClick={() => (stale ? location.reload() : this.setState({ error: null }))}>
            {stale ? 'recarregar' : 'tentar de novo'}
          </button>
          {!stale && (
            <button
              className="btn ghost"
              onClick={() => {
                location.hash = '#/inicio'
                this.setState({ error: null })
              }}
            >
              voltar ao início
            </button>
          )}
        </div>
        {!stale && <small className="muted err-detail">{String(error.message ?? error).slice(0, 160)}</small>}
      </div>
    )
  }
}
