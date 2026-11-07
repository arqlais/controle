import { useEffect, useRef, useState } from 'react'
import { href } from '../router'
import { sessaoLocal } from './api'
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
export function MenuConta({ nome, owner = false, morador = false, extra = [] }: { nome?: string; owner?: boolean; morador?: boolean; extra?: Extra[] }) {
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
  const links: [string, string, string, boolean?][] = [
    [`área do ${APE.condominio}`, 'list', href('ape'), !morador && !owner],
    ['enviar orçamento', 'send', href('ape', 'enviar'), !morador && !owner],
    ['minha plataforma', 'phone', plat ? href('ape', `minha:${plat}`) : href('ape', 'conta')],
    [logado ? 'minha conta e compras' : 'entrar na minha conta', 'user', href('ape', 'conta')],
    ['loja', 'bag', href('ape', 'loja')],
  ]
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
          {links.map(([l, i, h, so]) => (
            <a key={l} role="menuitem" href={h} onClick={() => setAberto(false)}>
              <ApeIcon name={i} />
              <span>{l}{so ? <small>só moradores do {APE.condominio}</small> : null}</span>
            </a>
          ))}
          {owner && <a role="menuitem" href={href('ape-admin')} onClick={() => setAberto(false)}><ApeIcon name="gear" />painel da dona</a>}
        </div>
      )}
    </div>
  )
}
