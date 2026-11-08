import { useEffect, useRef, useState } from 'react'
import { href } from '../router'
import { contaApi, guardarSessao, sessaoLocal } from './api'
import { ApeIcon } from './ApeIcon'
import { APE } from './model'
import { read } from './shared'

/** Voltar: volta para a tela anterior; se a pessoa chegou direto (link), vai para a tela "mãe". */
export function Voltar({ para = href('ape', 'loja'), rotulo = 'voltar' }: { para?: string; rotulo?: string }) {
  const voltar = () => {
    if (window.history.length > 1) window.history.back()
    else window.location.hash = para.replace(/^.*#/, '#')
  }
  return (
    <button type="button" className="ape-voltar" onClick={voltar} aria-label="Voltar para a tela anterior">
      <ApeIcon name="chev" />
      <span>{rotulo}</span>
    </button>
  )
}

type Extra = { l: string; i: string; onClick: () => void }

/** Atalhos em todas as páginas: área do San Levi, minha conta, plataforma, loja e (para a dona) o painel. */
/** Sai da conta neste aparelho (conta da loja e cadastro de morador) e volta para a tela de entrar. */
function sairDaConta() {
  void contaApi('sair').catch(() => null)
  guardarSessao('')
  try { for (const k of ['ape-cadastro', 'ape-plat']) localStorage.removeItem(k) } catch { /* ok */ }
  location.hash = '#/ape/conta'
  location.reload()
}

export function MenuConta({ nome, owner = false, morador = false, extra = [], so }: { nome?: string; owner?: boolean; morador?: boolean; extra?: Extra[]; so?: string[] }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const logado = !!sessaoLocal()
  const plat = read<string>('ape-plat')
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])
  const inicial = (nome || '').trim().charAt(0).toUpperCase()
  // a área do San Levi só aparece para quem é morador (ou para a dona)
  const todos: [string, string, string, string][] = [
    ['sanlevi', `área do ${APE.condominio}`, 'users', href('ape')],
    ['plataforma', 'minha plataforma', 'phone', plat ? href('ape', `minha:${plat}`) : href('ape', 'conta')],
    ['conta', logado ? 'minha conta e compras' : 'entrar na minha conta', 'user', href('ape', 'conta')],
    // só aparece para a dona (conta do planê com acesso de dona neste aparelho)
    ['painel', 'painel da loja', 'gear', href('ape-admin')],
  ]
  const links = todos.filter(([k]) => (k === 'painel' ? owner : (k !== 'sanlevi' || morador || owner) && (!so || so.includes(k)))).map(([, l, i, h]) => [l, i, h] as const)
  return (
    <div className="ape-menuconta" ref={ref}>
      <button type="button" className={`ape-menuconta-btn ${inicial ? 'com-nome' : ''}`} aria-expanded={aberto} aria-haspopup="menu" aria-label="Abrir atalhos: minha conta, plataforma e área do San Levi" onClick={() => setAberto(!aberto)}>
        {inicial ? <span className="av">{inicial}</span> : <ApeIcon name="user" />}
        <span className="l">{nome ? nome.split(' ')[0] : logado ? 'minha conta' : 'entrar'}</span>
        <ApeIcon name="chev" />
      </button>
      {aberto && (
        <div className="ape-menuconta-pop" role="menu">
          {extra.map((x) => (
            <button key={x.l} role="menuitem" onClick={() => { setAberto(false); x.onClick() }}><ApeIcon name={x.i} />{x.l}</button>
          ))}
          {links.map(([l, i, h]) => (
            <a key={l} role="menuitem" href={h} onClick={() => setAberto(false)}>
              <ApeIcon name={i} />
              <span>{l}</span>
            </a>
          ))}
          {(logado || !!nome) && (
            <button role="menuitem" className="sair" onClick={() => { setAberto(false); sairDaConta() }}><ApeIcon name="x" />sair da conta</button>
          )}
        </div>
      )}
    </div>
  )
}

/** Carrinho em destaque em todas as páginas: número de itens e um "pulo" quando entra algo. */
export function BotaoCarrinho({ n }: { n: number }) {
  const [pula, setPula] = useState(false)
  const ant = useRef(n)
  useEffect(() => {
    if (n > ant.current) { setPula(true); const t = window.setTimeout(() => setPula(false), 700); ant.current = n; return () => window.clearTimeout(t) }
    ant.current = n
  }, [n])
  return (
    <a className={`ape-cartbtn ${n ? 'tem' : ''} ${pula ? 'pula' : ''}`} href={href('ape', 'loja:carrinho')} onClick={() => window.dispatchEvent(new Event('ape-abrir-carrinho'))} aria-label={`Carrinho com ${n} ${n === 1 ? 'item' : 'itens'}`}>
      <ApeIcon name="bag" />
      {n ? <em>{n}</em> : null}
    </a>
  )
}
