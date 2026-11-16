/* Painel da dona: ver tudo como cliente (sem e-mail, sem conta) e o financeiro de todas as lojas num lugar só. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '../components/dialog'
import { Icon } from '../components/Icon'
import { href } from '../router'
import { ESTILOS, comEstilos, estiloDoId, imgEstilo, temEstilos, temPrevia, type Estilo } from '../frentes/estilos'
import { AREAS, areasDe } from '../frentes/areas'
import { admin, loja, type Ajustes, type PedidoAdmin } from './api'
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
  if (/^(beleza|free|sob|cil|unha|cab|est|noiva|dep|mas|bio|odonto|med)-/.test(id) || /^kit-(beleza|sobrancelha|unhas|cabelo|estetica|noiva|divulgacao|gestao-beleza|bio)$/.test(id) || id === 'presente-arquivos') return 'arquivos'
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

/* ===== biblioteca: todos os arquivos de todas as lojas, com prévia, download e Canva ===== */
type ArqB = { nome: string; tamanho: number; em?: string }
type AbaB = 'arquivos' | 'arq' | 'apzinho' | 'extras'
const estiloDoArquivo = (n: string): Estilo => (n.match(/--(delicado|minimalista|elegante)\./)?.[1] as Estilo) || 'criativo'
const PARTE_B: [RegExp, string][] = [[/-stories(--|\.)/, 'stories'], [/-feed(--|\.)/, 'feed'], [/-cartoes-a6(--|\.)/, 'cartões A6'], [/-(azul|rosa|roxa|verde)\./, '']]
const parteDe = (n: string) => { for (const [r, l] of PARTE_B) { const m = n.match(r); if (m) return l || m[1] } return '' }
const tipoDe = (n: string) => (/\.pdf$/i.test(n) ? 'PDF' : /\.pptx$/i.test(n) ? 'PowerPoint' : /\.docx$/i.test(n) ? 'Word' : /\.xlsx?$/i.test(n) ? 'Excel' : 'arquivo')
const tam = (t: number) => (t >= 1048576 ? `${(t / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(t / 1024))} KB`)
const EXTRAS_B = [
  { id: 'presente-arquivos', nome: 'Presente · Planner 2027 (planê.arquivos)', estilos: true },
  { id: 'presente-arq', nome: 'Presente · Planner 2027 (planê.arq)', estilos: true },
  { id: 'bonus', nome: 'Bônus do apê · calendário de manutenção', estilos: false },
]
type ItemB = { id: string; nome: string; estilos: boolean; capa?: string; grupo: string; ativo: boolean }

export function Biblioteca({ ajustes, onSaved }: { ajustes: Ajustes; onSaved: (a: Ajustes) => void }) {
  const [aba, setAba] = useState<AbaB>('arquivos')
  const [busca, setBusca] = useState('')
  const [soFalta, setSoFalta] = useState(false)
  const [arqs, setArqs] = useState<Record<string, ArqB[]>>({})
  const [aberto, setAberto] = useState<ItemB | null>(null)
  const ps = ajustes.produtos
  const itensDe = useCallback((a: AbaB): ItemB[] => {
    if (a === 'extras') return EXTRAS_B.map((x) => ({ ...x, grupo: 'presentes e bônus', ativo: true }))
    const daqui = ps.filter((p) => frenteDe(p) === a && (p.cat || 'arquivos') === 'arquivos')
    const grupo = (p: Produto) => {
      if (a === 'arquivos') { const ar = areasDe(p, ps); return ar.length ? AREAS.find((x) => x.id === ar[0])!.nome : 'servem para todas as áreas' }
      if (a === 'arq') return 'modelos do escritório'
      return ({ comprando: 'para quem vai comprar', comprei: 'para quem já comprou', escolhas: 'escolhas da casa' } as Record<string, string>)[p.fase || 'comprei'] || 'outros'
    }
    return daqui.map((p) => ({ id: p.id, nome: p.nome, estilos: temEstilos(p), capa: temPrevia(p.id) ? imgEstilo(p.id, 'delicado') : p.amostras?.[0], grupo: grupo(p), ativo: p.ativo }))
  }, [ps])
  const itens = useMemo(() => itensDe(aba), [aba, itensDe])
  useEffect(() => {
    let vivo = true
    const faltam = itens.filter((p) => !arqs[p.id])
    if (!faltam.length) return
    void Promise.all(faltam.map(async (p) => [p.id, await loja.arquivos(p.id).catch(() => [] as ArqB[])] as const)).then((l) => { if (vivo) setArqs((a) => ({ ...a, ...Object.fromEntries(l) })) })
    return () => { vivo = false }
  }, [itens]) // eslint-disable-line react-hooks/exhaustive-deps
  const recarregar = async (id: string) => { const l = await loja.arquivos(id).catch(() => [] as ArqB[]); setArqs((a) => ({ ...a, [id]: l })) }
  const q = busca.trim().toLowerCase()
  const vis = itens.filter((p) => (!q || p.nome.toLowerCase().includes(q) || p.id.includes(q)) && (!soFalta || !(arqs[p.id] || []).length))
  const grupos = [...new Set(vis.map((p) => p.grupo))]
  if (aba === 'arquivos') grupos.sort((a, b) => (AREAS.findIndex((x) => x.nome === a) + 1 || 99) - (AREAS.findIndex((x) => x.nome === b) + 1 || 99))
  const total = (a: AbaB) => itensDe(a).length
  const comArq = itens.filter((p) => (arqs[p.id] || []).length).length
  return (
    <div className="bib">
      <div className="bib-abas" role="tablist">
        {([['arquivos', 'planê.arquivos', 'file'], ['arq', 'planê.arq', 'ruler'], ['apzinho', 'planê.apê', 'home'], ['extras', 'presentes e bônus', 'gift']] as const).map(([k, l, i]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={aba === k ? 'is-on' : ''} onClick={() => setAba(k)}><Icon name={i} size={15} />{l}<em className="num">{total(k)}</em></button>
        ))}
      </div>
      <div className="bib-ferr">
        <input type="search" placeholder="procurar arquivo" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Procurar arquivo" />
        <label className="ape-tog"><input type="checkbox" checked={soFalta} onChange={(e) => setSoFalta(e.target.checked)} /> só os sem arquivo</label>
        <span className="ape-note">{comArq} de {itens.length} com arquivo</span>
      </div>
      {grupos.map((g) => (
        <section key={g} className="bib-grupo">
          <p className="ape-eyebrow">{g} <small>{vis.filter((p) => p.grupo === g).length}</small></p>
          <div className="bib-grade">
            {vis.filter((p) => p.grupo === g).map((p) => {
              const l = arqs[p.id]
              const est = new Set((l || []).map((a) => estiloDoArquivo(a.nome)))
              return (
                <button key={p.id} className={`bib-card ${l && !l.length ? 'falta' : ''}`} onClick={() => setAberto(p)}>
                  <span className="bib-capa">{p.capa ? <img src={p.capa} alt="" loading="lazy" /> : <Icon name={p.id === 'bonus' ? 'gift' : 'file'} size={26} />}</span>
                  <b>{p.nome}</b>
                  <small>{!l ? 'carregando…' : !l.length ? 'sem arquivo' : `${l.length} arquivo(s)`}{!p.ativo ? ' · fora da loja' : ''}</small>
                  {p.estilos && l && l.length > 0 && <span className="bib-dots">{ESTILOS.map((e) => <i key={e.id} title={e.nome} style={{ background: est.has(e.id) ? e.cor : 'transparent', borderColor: e.aro }} />)}</span>}
                </button>
              )
            })}
          </div>
        </section>
      ))}
      {!vis.length && <div className="ape-panel ape-empty"><b>nada por aqui</b><span>Mude a busca.</span></div>}
      {aberto && <ProdutoArquivos item={aberto} arqs={arqs[aberto.id] || []} ajustes={ajustes} onSaved={onSaved} onMudou={() => void recarregar(aberto.id)} onClose={() => setAberto(null)} />}
    </div>
  )
}

function ProdutoArquivos({ item, arqs, ajustes, onSaved, onMudou, onClose }: { item: ItemB; arqs: ArqB[]; ajustes: Ajustes; onSaved: (a: Ajustes) => void; onMudou: () => void; onClose: () => void }) {
  const [est, setEst] = useState<Estilo>('delicado')
  const lista = item.estilos ? arqs.filter((a) => estiloDoArquivo(a.nome) === est) : arqs
  const [ver, setVer] = useState<{ nome: string; url: string } | null>(null)
  const [busy, setBusy] = useState('')
  const chave = item.estilos ? `${item.id}--${est}` : item.id
  const [link, setLink] = useState(ajustes.canva?.[chave] || '')
  useEffect(() => { setLink(ajustes.canva?.[chave] || ''); setVer(null) }, [chave]) // eslint-disable-line react-hooks/exhaustive-deps
  // abre a prévia do primeiro PDF do estilo
  useEffect(() => {
    const pdf = lista.find((a) => /\.pdf$/i.test(a.nome))
    if (pdf && !ver) void loja.urlArquivo(item.id, pdf.nome).then((url) => setVer({ nome: pdf.nome, url }), () => null)
  }, [lista.map((a) => a.nome).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const url = async (n: string) => loja.urlArquivo(item.id, n)
  const baixar = async (n: string) => {
    try { const u = await url(n); const a = document.createElement('a'); a.href = `${u}${u.includes('?') ? '&' : '?'}download=${encodeURIComponent(n)}`; a.download = n; a.click() } catch (e) { toast((e as Error).message) }
  }
  const proCanva = async () => {
    if (link) return void window.open(link, '_blank')
    const f = lista.find((a) => /\.pptx$/i.test(a.nome)) || lista.find((a) => /\.pdf$/i.test(a.nome)) || lista[0]
    if (!f) return toast('Este estilo ainda não tem arquivo.')
    const w = window.open('https://www.canva.com/', '_blank')
    await baixar(f.nome)
    toast(`${f.nome} baixado. No Canva: Criar design → Importar arquivo e escolha ele.`)
    w?.focus()
  }
  const salvarLink = async () => {
    const v = link.trim()
    if (v && !/^https:\/\/(www\.)?canva\.com\//.test(v)) return toast('O link precisa começar com https://www.canva.com')
    const canva = { ...(ajustes.canva || {}) }
    if (v) canva[chave] = v
    else delete canva[chave]
    const a = { ...ajustes, canva }
    try { await admin.salvarAjustes(a); onSaved(a); toast(v ? 'Link do Canva salvo: quem comprar este estilo ganha o botão "editar no Canva".' : 'Link tirado.') } catch (e) { toast(`Não salvou (${(e as Error).message}).`) }
  }
  const enviar = async (f?: File) => {
    if (!f) return
    setBusy('enviar')
    try { await loja.enviarArquivo(item.id, f); toast('Arquivo guardado.'); onMudou() } catch (e) { toast(`Não consegui (${(e as Error).message}).`) }
    setBusy('')
  }
  const tirar = async (n: string) => {
    if (!confirm(`Tirar ${n}? Quem comprar não recebe mais este arquivo.`)) return
    await loja.apagarArquivo(item.id, n).then(onMudou, () => toast('Não consegui tirar.'))
  }
  // fora do painel (portal), para ficar por cima do menu lateral
  const tema = (document.querySelector('.ape-adm-app') as HTMLElement | null)?.dataset.tema || 'claro'
  return createPortal(
    <div className="ape ape-portal" data-tema={tema}>
    <div className="ape-sheet ape-prev" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ape-sheet-in ape-prev-in bib-sheet" role="dialog" aria-label={item.nome}>
        <header className="ape-prev-top">
          <div><b>{item.nome}</b><small>{arqs.length} arquivo(s) guardados · o nome de quem compra entra no rodapé na hora do download</small></div>
          <button type="button" className="ape-icobtn" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </header>
        <div className="bib-corpo">
          <div className="bib-prev">
            {ver ? <iframe key={ver.url} src={`${ver.url}#view=FitH`} title={`Prévia de ${ver.nome}`} />
              : item.estilos && temPrevia(item.id) ? <img src={imgEstilo(item.id, est)} alt="" />
              : <div className="ape-prev-vazio"><Icon name="file" size={30} /><span>{lista.length ? 'Escolha um PDF para ver aqui.' : 'Sem arquivo neste estilo.'}</span></div>}
          </div>
          <div className="bib-lado">
            {item.estilos && (
              <div className="bib-estilos" role="tablist" aria-label="estilo">
                {ESTILOS.map((e) => {
                  const n = arqs.filter((a) => estiloDoArquivo(a.nome) === e.id).length
                  return <button key={e.id} role="tab" aria-selected={est === e.id} className={est === e.id ? 'is-on' : ''} onClick={() => setEst(e.id)}><i style={{ background: e.cor, borderColor: e.aro }} />{e.nome}<small className="num">{n}</small></button>
                })}
              </div>
            )}
            <div className="bib-files">
              {lista.length ? lista.map((a) => (
                <div key={a.nome} className={`bib-file ${ver?.nome === a.nome ? 'is-on' : ''}`}>
                  <span className="t"><b>{tipoDe(a.nome)}{parteDe(a.nome) ? ` · ${parteDe(a.nome)}` : ''}</b><small>{a.nome} · {tam(a.tamanho)}</small></span>
                  {/\.pdf$/i.test(a.nome) && <button className="ape-icobtn" title="ver aqui" aria-label="ver" onClick={() => void url(a.nome).then((u) => setVer({ nome: a.nome, url: u }), (e) => toast((e as Error).message))}><Icon name="eye" size={16} /></button>}
                  <button className="ape-icobtn" title="baixar" aria-label="baixar" onClick={() => void baixar(a.nome)}><Icon name="download" size={16} /></button>
                  <button className="ape-icobtn" title="tirar" aria-label="tirar" onClick={() => void tirar(a.nome)}><Icon name="trash" size={16} /></button>
                </div>
              )) : <p className="ape-note" style={{ margin: 0 }}>Nenhum arquivo {item.estilos ? `no estilo ${est}` : 'guardado'}.</p>}
            </div>
            <div className="bib-canva">
              <p className="ape-eyebrow">Canva{item.estilos ? ` · ${est}` : ''}</p>
              <button className="ape-btn primary" onClick={() => void proCanva()} disabled={!link && !lista.length}><Icon name="sparkle" size={16} />{link ? 'abrir o modelo no Canva' : 'levar para o Canva'}</button>
              <div className="bib-link">
                <input type="url" inputMode="url" placeholder="cole o link de modelo do Canva" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Link de modelo do Canva" />
                <button className="ape-btn sm" onClick={() => void salvarLink()} disabled={(ajustes.canva?.[chave] || '') === link.trim()}>salvar</button>
              </div>
              <small className="ape-note">Sem link: baixa o PowerPoint (ou o PDF) e abre o Canva para importar. Com o link de modelo salvo, quem compra este estilo ganha o botão "editar no Canva".</small>
            </div>
            <label className="ape-btn sm bib-enviar" style={{ cursor: 'pointer' }}>
              <Icon name="upload" size={15} />{busy === 'enviar' ? 'enviando…' : 'enviar ou trocar arquivo'}
              <input type="file" hidden accept=".pdf,.xlsx,.xls,.docx,.pptx,.zip" onChange={(e) => void enviar(e.target.files?.[0])} />
            </label>
            <small className="ape-note">Para trocar, envie com o mesmo nome do arquivo guardado{item.estilos ? ` (ex.: ${item.id}--${est}.pdf; o criativo vai sem o final)` : ''}.</small>
          </div>
        </div>
      </div>
    </div>
    </div>,
    document.body,
  )
}
