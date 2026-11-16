/* Painel da dona: ver tudo como cliente (sem e-mail, sem conta) e o financeiro de todas as lojas num lugar só. */
import { useMemo, useState } from 'react'
import { toast } from '../components/dialog'
import { Icon } from '../components/Icon'
import { href } from '../router'
import { comEstilos, estiloDoId, temEstilos } from '../frentes/estilos'
import { loja, type PedidoAdmin } from './api'
import { TAXAS, brl, frenteDe, noCarrinho, type Produto, type Taxas } from './model'

/* ===== lojas ===== */
export const LOJAS_DONA = [
  { k: 'arquivos', nome: 'planê.arquivos', rota: 'arquivos', icone: 'file' },
  { k: 'arq', nome: 'planê.arq', rota: 'arq', icone: 'ruler' },
  { k: 'apzinho', nome: 'planê.apê', rota: 'ape', icone: 'home' },
] as const
type LojaK = (typeof LOJAS_DONA)[number]['k']

/** De que loja é cada item do pedido (pelo id; os kits seguem os arquivos). */
export const lojaDoItem = (i: { id: string; frente?: string }): LojaK => {
  if (i.frente === 'arquivos' || i.frente === 'arq' || i.frente === 'apzinho') return i.frente
  const id = estiloDoId(i.id).base
  if (/^(kit-)?arq-/.test(id) || id === 'presente-arq') return 'arq'
  if (/^(beleza|free|sob|cil|unha|cab|est|noiva|dep|mas|bio)-/.test(id) || /^kit-(beleza|sobrancelha|unhas|cabelo|estetica|noiva|divulgacao|gestao-beleza|bio)$/.test(id) || id === 'presente-arquivos') return 'arquivos'
  return 'apzinho'
}

/* ===== ver como cliente ===== */
const NOME_TESTE: Record<'tudo' | 'nova', string> = { tudo: 'Laís (tudo liberado)', nova: 'Laís (acabou de comprar)' }
const chaveIds = (ids: string[]) => [...ids].sort().join(',')

/** Tudo que a loja vende, item por item (os arquivos em cada um dos 4 estilos). */
function itensDaLoja(k: LojaK, produtos: Produto[]): Produto[] {
  const daqui = produtos.filter((p) => p.ativo && frenteDe(p) === k && noCarrinho(p) && p.cat !== 'combos')
  if (k === 'apzinho') return daqui
  return comEstilos(daqui).filter((p) => (p.cat || 'arquivos') === 'arquivos' && (estiloDoId(p.id).estilo || !temEstilos(p)))
}

export function AcessoDona({ produtos, pedidos, minhaPlat, onChange }: { produtos: Produto[]; pedidos: PedidoAdmin[]; minhaPlat: string | null; onChange: () => void }) {
  const [busy, setBusy] = useState('')
  const testes = pedidos.filter((p) => p.cortesia && p.obs === 'teste da dona' && p.status === 'pago')
  const abrir = async (k: LojaK, rota: string, modo: 'tudo' | 'nova') => {
    const todos = itensDaLoja(k, produtos)
    // "acabou de comprar": um arquivo só, com o presente ainda trancado
    const itens = modo === 'tudo' ? todos : todos.filter((p) => !estiloDoId(p.id).estilo || estiloDoId(p.id).estilo === 'delicado').slice(0, 1)
    if (!itens.length) return toast('Esta loja ainda não tem produtos ativos.')
    const w = window.open('', '_blank')
    setBusy(`${k}-${modo}`)
    try {
      const ids = chaveIds(itens.map((p) => p.id))
      const novo = (p: PedidoAdmin) => modo === 'tudo' || Date.now() - new Date(p.pago_em || p.criado).getTime() < 5 * 864e5
      const ja = testes.find((p) => p.nome === NOME_TESTE[modo] && chaveIds(p.itens.map((i) => i.id)) === ids && novo(p))
      const token = ja?.token || (await loja.cortesia({ nome: NOME_TESTE[modo], email: '', cpf: '', tel: '', itens, obs: 'teste da dona', bonusJa: modo === 'tudo' }))
      if (!ja) onChange()
      const url = href(rota, `pedido:${token}`)
      if (w) w.location.href = url
      else location.hash = url
    } catch (e) {
      w?.close()
      toast(`Não consegui (${(e as Error).message}).`)
    }
    setBusy('')
  }
  const plataforma = async () => {
    const w = window.open('', '_blank')
    setBusy('plat')
    try {
      const t = minhaPlat || (await loja.garantirMinhaPlataforma())
      const url = href('ape', `minha:${t}`)
      if (w) w.location.href = url
      else location.hash = url
    } catch (e) {
      w?.close()
      toast(`Não consegui abrir a plataforma (${(e as Error).message}).`)
    }
    setBusy('')
  }
  return (
    <div className="dona">
      <div className="ape-panel ape-adm-box dona-topo">
        <p className="ape-eyebrow">ver tudo como cliente</p>
        <p className="ape-note" style={{ margin: 0 }}>Sem e-mail e sem conta: um toque abre a página do pedido como a cliente vê. Não entra nas vendas nem no financeiro.</p>
      </div>
      <div className="dona-lojas">
        {LOJAS_DONA.map((l) => {
          const n = itensDaLoja(l.k, produtos).length
          return (
            <article key={l.k} className="ape-panel dona-loja">
              <header>
                <span className="dona-ic"><Icon name={l.icone} size={18} /></span>
                <b>{l.nome}</b>
                <small className="num">{n} {l.k === 'apzinho' ? 'itens' : 'arquivos (com os 4 estilos)'}</small>
              </header>
              <button className="ape-btn primary" disabled={!!busy} onClick={() => void abrir(l.k, l.rota, 'tudo')}>
                <Icon name="download" size={16} />{busy === `${l.k}-tudo` ? 'abrindo…' : 'tudo liberado'}
              </button>
              <div className="dona-mais">
                <button className="ape-btn sm" disabled={!!busy} onClick={() => void abrir(l.k, l.rota, 'nova')} title="Uma compra de um arquivo, com o presente ainda trancado">
                  <Icon name="lock" size={14} />{busy === `${l.k}-nova` ? 'abrindo…' : 'acabou de comprar'}
                </button>
                <a className="ape-btn sm" href={l.k === 'apzinho' ? href('ape', 'loja') : href(l.rota)} target="_blank" rel="noreferrer" title="A loja como quem ainda não comprou">
                  <Icon name="eye" size={14} />como visitante
                </a>
              </div>
            </article>
          )
        })}
        <article className="ape-panel dona-loja">
          <header>
            <span className="dona-ic"><Icon name="smartphone" size={18} /></span>
            <b>plataforma do apê</b>
            <small>a sua, sem vencer e sem e-mail</small>
          </header>
          <button className="ape-btn primary" disabled={!!busy} onClick={() => void plataforma()}>
            <Icon name="smartphone" size={16} />{busy === 'plat' ? 'abrindo…' : 'abrir a minha plataforma'}
          </button>
          <div className="dona-mais">
            <a className="ape-btn sm" href={href('ape', 'minha:demo')} target="_blank" rel="noreferrer"><Icon name="eye" size={14} />exemplo da venda</a>
            <a className="ape-btn sm" href={href('ape')} target="_blank" rel="noreferrer"><Icon name="users" size={14} />página dos moradores</a>
          </div>
        </article>
      </div>
      <p className="ape-note" style={{ margin: 0 }}>
        <b>tudo liberado</b>: todos os arquivos e o presente já aberto. <b>acabou de comprar</b>: uma compra com o presente trancado, para ver a espera. <b>como visitante</b>: a loja trancada, como quem ainda não comprou.
      </p>
    </div>
  )
}

/* ===== financeiro ===== */
type Per = 'mes' | 'passado' | '90' | '12m' | 'tudo'
const PERS: [Per, string][] = [['mes', 'este mês'], ['passado', 'mês passado'], ['90', '90 dias'], ['12m', '12 meses'], ['tudo', 'tudo']]
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const dataDe = (p: PedidoAdmin) => new Date(p.pago_em || p.criado)

function noPeriodo(d: Date, per: Per) {
  const hoje = new Date()
  if (per === 'mes') return ym(d) === ym(hoje)
  if (per === 'passado') return ym(d) === ym(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))
  if (per === '90') return Date.now() - d.getTime() <= 90 * 864e5
  if (per === '12m') return d >= new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1)
  return true
}
/** Taxa do Asaas (estimada pelo que está no painel → produtos e preços). */
const taxaDe = (p: PedidoAdmin, t: Taxas) => (p.forma === 'cartao' ? (p.total * t.cartaoPct) / 100 + t.cartaoFixo : p.total > 0 ? t.pix : 0)
/** Parte do pedido que é de cada loja (proporcional ao preço dos itens). */
function partes(p: PedidoAdmin): Record<LojaK, number> {
  const out: Record<LojaK, number> = { arquivos: 0, arq: 0, apzinho: 0 }
  const soma = (p.itens || []).reduce((s, i) => s + (Number(i.preco) || 0), 0)
  for (const i of p.itens || []) out[lojaDoItem(i as { id: string; frente?: string })] += soma ? (Number(i.preco) || 0) / soma : 1 / (p.itens.length || 1)
  return out
}

export function Financeiro({ pedidos, taxas = TAXAS }: { pedidos: PedidoAdmin[]; taxas?: Taxas }) {
  const [per, setPer] = useState<Per>('mes')
  const [lojaF, setLojaF] = useState<'' | LojaK>('')
  const reais = useMemo(() => pedidos.filter((p) => !p.cortesia && (p.status === 'pago' || p.status === 'reembolsado')), [pedidos])
  const fat = (p: PedidoAdmin) => (lojaF ? partes(p)[lojaF] : 1)
  const doPer = reais.filter((p) => noPeriodo(dataDe(p), per) && fat(p) > 0)
  const pagos = doPer.filter((p) => p.status === 'pago')
  const reemb = doPer.filter((p) => p.status === 'reembolsado')
  const bruto = pagos.reduce((s, p) => s + p.total * fat(p), 0)
  const taxa = pagos.reduce((s, p) => s + taxaDe(p, taxas) * fat(p), 0)
  const devolvido = reemb.reduce((s, p) => s + p.total * fat(p), 0)
  const liquido = bruto - taxa
  const porLoja = LOJAS_DONA.map((l) => {
    const v = pagos.reduce((s, p) => s + p.total * partes(p)[l.k], 0)
    const tx = pagos.reduce((s, p) => s + taxaDe(p, taxas) * partes(p)[l.k], 0)
    return { ...l, n: pagos.filter((p) => partes(p)[l.k] > 0).length, v, liq: v - tx }
  })
  const pix = pagos.filter((p) => p.forma !== 'cartao').reduce((s, p) => s + p.total * fat(p), 0)
  // mês a mês (últimos 12, sempre)
  const hoje = new Date()
  const meses = Array.from({ length: 12 }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth() - 11 + i, 1)).map((d) => {
    const ps = reais.filter((p) => p.status === 'pago' && ym(dataDe(p)) === ym(d))
    return { k: ym(d), l: MESES[d.getMonth()], v: ps.reduce((s, p) => s + p.total * fat(p), 0), n: ps.filter((p) => fat(p) > 0).length }
  })
  const maxM = Math.max(1, ...meses.map((m) => m.v))
  const top = useMemo(() => {
    const m = new Map<string, { nome: string; n: number; v: number }>()
    for (const p of pagos)
      for (const i of p.itens || []) {
        if (lojaF && lojaDoItem(i as { id: string; frente?: string }) !== lojaF) continue
        const base = estiloDoId(i.id).base
        const c = m.get(base) || { nome: String(i.nome).replace(/ · (delicado|criativo|minimalista|elegante)$/, ''), n: 0, v: 0 }
        c.n += 1
        c.v += Number(i.preco) || 0
        m.set(base, c)
      }
    return [...m.values()].sort((a, b) => b.v - a.v).slice(0, 8)
  }, [pagos, lojaF])
  const csv = () => {
    const linhas = [['data', 'loja', 'cliente', 'e-mail', 'itens', 'forma', 'status', 'total', 'taxa estimada', 'líquido']]
    for (const p of doPer) {
      const lojas = [...new Set((p.itens || []).map((i) => LOJAS_DONA.find((l) => l.k === lojaDoItem(i as { id: string; frente?: string }))!.nome))].join(' + ')
      const tx = p.status === 'pago' ? taxaDe(p, taxas) : 0
      linhas.push([dataDe(p).toLocaleDateString('pt-BR'), lojas, p.nome, p.email, (p.itens || []).map((i) => i.nome).join(' + '), p.forma === 'cartao' ? 'cartão' : 'Pix', p.status, p.total.toFixed(2).replace('.', ','), tx.toFixed(2).replace('.', ','), (p.status === 'pago' ? p.total - tx : 0).toFixed(2).replace('.', ',')])
    }
    const txt = '﻿' + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }))
    a.download = `planê-vendas-${per}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  return (
    <div className="dona fin">
      <div className="fin-filtros">
        <div className="ape-vista" role="group" aria-label="Período">
          {PERS.map(([k, l]) => <button key={k} aria-pressed={per === k} onClick={() => setPer(k)}>{l}</button>)}
        </div>
        <div className="ape-vista" role="group" aria-label="Loja">
          <button aria-pressed={!lojaF} onClick={() => setLojaF('')}>todas</button>
          {LOJAS_DONA.map((l) => <button key={l.k} aria-pressed={lojaF === l.k} onClick={() => setLojaF(l.k)}>{l.nome.replace('planê.', '')}</button>)}
        </div>
      </div>

      <div className="fin-kpis">
        <div className="ape-panel fin-kpi destaque"><small>entrou (bruto)</small><b className="num ape-keep">{brl(bruto)}</b><span>{pagos.length} venda(s){pagos.length ? ` · ticket ${brl(bruto / pagos.length)}` : ''}</span></div>
        <div className="ape-panel fin-kpi"><small>fica com você</small><b className="num ape-keep">{brl(liquido)}</b><span>depois das taxas do Asaas</span></div>
        <div className="ape-panel fin-kpi"><small>taxas (estimadas)</small><b className="num ape-keep">{brl(taxa)}</b><span>Pix {brl(taxas.pix)} · cartão {String(taxas.cartaoPct).replace('.', ',')}% + {brl(taxas.cartaoFixo)}</span></div>
        <div className="ape-panel fin-kpi"><small>devolvido</small><b className="num ape-keep">{brl(devolvido)}</b><span>{reemb.length} reembolso(s)</span></div>
      </div>

      <div className="fin-duas">
        <div className="ape-panel ape-adm-box">
          <p className="ape-eyebrow">mês a mês</p>
          <div className="fin-barras" role="img" aria-label="Faturamento dos últimos 12 meses">
            {meses.map((m) => (
              <div key={m.k} className={`fin-bar ${m.k === ym(hoje) ? 'is-hoje' : ''}`} title={`${m.l}: ${brl(m.v)} (${m.n} venda(s))`}>
                <i style={{ height: `${Math.max(2, (m.v / maxM) * 100)}%` }} />
                <small>{m.l}</small>
              </div>
            ))}
          </div>
          <p className="ape-note" style={{ margin: 0 }}>Melhor mês: {(() => { const b = [...meses].sort((a, c) => c.v - a.v)[0]; return b && b.v ? `${b.l} (${brl(b.v)})` : 'ainda sem vendas' })()}</p>
        </div>
        <div className="ape-panel ape-adm-box">
          <p className="ape-eyebrow">por loja</p>
          <div className="fin-lojas">
            {porLoja.map((l) => (
              <button key={l.k} className={lojaF === l.k ? 'is-on' : ''} onClick={() => setLojaF(lojaF === l.k ? '' : l.k)}>
                <span><Icon name={l.icone} size={15} />{l.nome}</span>
                <b className="num ape-keep">{brl(l.v)}</b>
                <small>{l.n} venda(s) · líquido {brl(l.liq)}</small>
                <i><em style={{ width: `${bruto || porLoja.some((x) => x.v) ? (l.v / Math.max(1, ...porLoja.map((x) => x.v))) * 100 : 0}%` }} /></i>
              </button>
            ))}
          </div>
          <p className="ape-eyebrow" style={{ marginTop: 6 }}>como pagaram</p>
          <div className="fin-forma">
            <span><b className="num ape-keep">{brl(pix)}</b><small>Pix</small></span>
            <span><b className="num ape-keep">{brl(bruto - pix)}</b><small>cartão</small></span>
          </div>
        </div>
      </div>

      <div className="ape-panel ape-adm-box">
        <div className="fin-h"><p className="ape-eyebrow">o que mais vendeu</p><button className="ape-btn sm" onClick={csv} disabled={!doPer.length}><Icon name="download" size={14} />baixar planilha (CSV)</button></div>
        {top.length ? (
          <ol className="fin-top">
            {top.map((x) => (
              <li key={x.nome}><span>{x.nome}</span><small className="num">{x.n}x</small><b className="num ape-keep">{brl(x.v)}</b></li>
            ))}
          </ol>
        ) : <p className="ape-note" style={{ margin: 0 }}>Nenhuma venda paga neste período. Cortesias e testes não entram na conta.</p>}
      </div>

      <a className="ape-panel fin-link" href={href('plataforma')}>
        <Icon name="crown" size={18} />
        <span><b>assinaturas da planê</b><small>a gestão (planê.arq) tem o painel próprio: assinantes, planos e afiliados</small></span>
        <Icon name="arrowRight" size={16} />
      </a>
    </div>
  )
}
