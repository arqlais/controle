import { useEffect, useState, type ReactNode } from 'react'
import { markSvg } from '../components/PlaneMark'
import { currentRoute } from '../router'
import { APE } from './model'
import { ApeIcon } from './ApeIcon'

/* Peças usadas em várias telas do planê apzinho (página dos moradores, loja, plataforma). */

// símbolo do planê nas cores do apê (conteúdo fixo)
export const MARK_SVG = markSvg('quadrado', '#4e6472', '#ffffff')
export const SITE_APE = 'useplane.com.br/ape'

export const read = <T,>(k: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') as T | null
  } catch {
    return null
  }
}
export const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* modo privado: segue sem lembrar */
  }
}

let toastTimer = 0
export function useToast(): [ReactNode, (m: string) => void] {
  const [msg, setMsg] = useState('')
  const show = (m: string) => {
    setMsg(m)
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => setMsg(''), 3200)
  }
  return [msg ? <div className="ape-toast" role="status">{msg}</div> : null, show]
}

/* carrinho: menu, loja e checkout leem o mesmo (localStorage + evento) */
/* A mesma loja (checkout, pedido, minha conta) atende as três frentes da planê. A rota aberta diz qual:
   #/ape (planê apzinho), #/arquivos (planê arquivos) ou #/arq (planê arq). Cada uma tem o seu carrinho. */
export type RotaLoja = 'ape' | 'arquivos' | 'arq'
export const lojaRota = (): RotaLoja => {
  const p = currentRoute().page
  return p === 'arquivos' || p === 'arq' ? p : 'ape'
}
export const LOJA_NOME: Record<RotaLoja, string> = { ape: 'planê apzinho', arquivos: 'planê arquivos', arq: 'planê arq' }
export const lojaNome = () => LOJA_NOME[lojaRota()]
const chaveCarrinho = () => (lojaRota() === 'ape' ? 'ape-carrinho' : `${lojaRota()}-carrinho`)
export type Carrinho = { ids: string[]; add: (id: string) => void; remove: (id: string) => void; limpar: () => void; tem: (id: string) => boolean }
export function useCarrinho(): Carrinho {
  const CARRINHO = chaveCarrinho()
  const [ids, setIds] = useState<string[]>(() => read<string[]>(CARRINHO) || [])
  useEffect(() => {
    const sync = () => setIds(read<string[]>(CARRINHO) || [])
    window.addEventListener('ape-carrinho', sync)
    return () => window.removeEventListener('ape-carrinho', sync)
  }, [CARRINHO])
  const mudar = (fn: (l: string[]) => string[]) => {
    const next = fn(read<string[]>(CARRINHO) || [])
    write(CARRINHO, next)
    setIds(next)
    window.dispatchEvent(new Event('ape-carrinho'))
  }
  return {
    ids,
    add: (id) => mudar((l) => (l.includes(id) ? l : [...l, id])),
    remove: (id) => mudar((l) => l.filter((x) => x !== id)),
    limpar: () => mudar(() => []),
    tem: (id) => ids.includes(id),
  }
}

/** Assinatura discreta da marca, no rodapé de todas as telas. */
export function Assinatura() {
  return (
    <p className="ape-sign">
      <b>planê<span> apzinho</span></b> · <a className="ape-sign-site" href="#/ape/loja">{SITE_APE}</a> · <a href={`https://instagram.com/${APE.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">{APE.instagram}</a> · © {new Date().getFullYear()} todos os direitos reservados
    </p>
  )
}

/** Trava a rolagem da página enquanto uma folha (modal) está aberta. */
export function useTravaRolagem(on: boolean) {
  useEffect(() => {
    if (!on) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [on])
}

/* CPF: formata e confere os dígitos */
export const fmtCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}
export const cpfOk = (v: string) => {
  const d = v.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}
export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

/** Aviso de cookies e armazenamento (só o necessário: carrinho, cadastro e compras neste aparelho; nada de rastreamento). */
export function AvisoCookies() {
  const [ok, setOk] = useState(() => !!read<boolean>('ape-cookies'))
  if (ok) return null
  return (
    <div className="ape-cookies" role="region" aria-label="Aviso de cookies">
      <p>Só guardamos o necessário para o site funcionar (carrinho e cadastro). Sem cookies de propaganda.</p>
      <button className="ape-btn primary sm" onClick={() => { write('ape-cookies', true); setOk(true) }}>entendi</button>
    </div>
  )
}

/** Bloco que abre e fecha, com "recolher" no fim (para não precisar voltar lá em cima). */
export function Recolhe({ titulo, abertoInicial = false, children }: { titulo: string; abertoInicial?: boolean; children: ReactNode }) {
  const [on, setOn] = useState(abertoInicial)
  return (
    <div className={`ape-recolhe ${on ? 'on' : ''}`}>
      <button type="button" className="ape-recolhe-h" aria-expanded={on} onClick={() => setOn(!on)}>
        <ApeIcon name="chev" />{titulo}<span>{on ? 'recolher' : 'ver'}</span>
      </button>
      {on && (
        <>
          {children}
          <button type="button" className="ape-recolhe-x" onClick={() => setOn(false)}><ApeIcon name="chev" />recolher</button>
        </>
      )}
    </div>
  )
}


/** Celular com DDD enquanto digita: (11) 96912-4900 (no máximo 11 números). */
export function mascaraTel(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/* Esc fecha a janela aberta (a de cima), em qualquer tela do planê apzinho */
if (typeof window !== 'undefined' && !(window as unknown as { __apeEsc?: boolean }).__apeEsc) {
  ;(window as unknown as { __apeEsc?: boolean }).__apeEsc = true
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    const bs = [...document.querySelectorAll<HTMLElement>('.ape-sheet .ape-x, .ape-gate-x, .ape-prev .ape-icobtn[aria-label="Fechar"]')]
    bs[bs.length - 1]?.click()
  })
}
