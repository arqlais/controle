import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { href, useRoute } from '../router'
import { type Arquivo } from './model'
import { cadastrar, criarPedido, enviar, escolher, lerAnexos, mesmoAp, subirArquivos, loadPublico, meusEnvios, pedidosLocais, verPedido, queroGrupo, souDona, apeCloud, type MeuEnvio, type Publico } from './api'
import { ApeArt } from './ApeArt'
import { ApeIcon } from './ApeIcon'
import {
  APE, CTA_BY, CTA_COPY, NICHOS, SORTS, analyze, brl, calc, digits, dmy, firstName, fmtTel, msgAnexo, msgFornecedor, msgGrupo, msgProduto, nicho, num, pct, wa, waNum, whyTop,
  CATEGORIAS, DESCONTOS, conta, parcelasMax, ehSanLevi, noCarrinho, ondeMora, reais, type Analise, type Categoria, type Item, type Morador, type Nicho, type Orcamento, type Produto, type Sort,
} from './model'
import { markSvg } from '../components/PlaneMark'
import './ape.css'

// símbolo do planê nas cores do apê (conteúdo fixo)
const MARK_SVG = markSvg('quadrado', '#4e6472', '#ffffff')

/* Página pública do planê.apê: os moradores se cadastram, comparam os orçamentos,
   mandam os seus (com PDF e prints) e entram nas compras em grupo. Sem login. */

const CAD = 'ape-cadastro'
const UI = 'ape-ui'
const GRUPOS = 'ape-grupos'
const read = <T,>(k: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') as T | null
  } catch {
    return null
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* modo privado: segue sem lembrar */
  }
}

type View = 'orcamentos' | 'enviar' | 'loja' | 'pedido' | 'checkout'

let toastTimer = 0
function useToast(): [ReactNode, (m: string) => void] {
  const [msg, setMsg] = useState('')
  const show = (m: string) => {
    setMsg(m)
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => setMsg(''), 3200)
  }
  return [msg ? <div className="ape-toast" role="status">{msg}</div> : null, show]
}

export function ApePublic({ sub }: { sub?: string }) {
  const route = useRoute()
  const view: View = sub === 'enviar' ? 'enviar' : sub?.startsWith('loja') ? 'loja' : sub?.startsWith('pedido:') ? 'pedido' : sub === 'checkout' ? 'checkout' : 'orcamentos'
  const abrir = sub?.startsWith('loja:') ? sub.slice(5) : undefined
  const [d, setD] = useState<Publico | null | undefined>(undefined)
  const [owner, setOwner] = useState(false)
  const [me, setMe] = useState<Morador | null>(() => read<Morador>(CAD))
  const [editing, setEditing] = useState(false)
  const [toast, show] = useToast()

  useEffect(() => {
    document.title = `${APE.name} · orçamentos lado a lado`
    // "adicionar à tela de início" abre direto a página dos moradores, com o ícone do planê.apê
    const swap = (sel: string, attr: string, val: string) => {
      const el = document.querySelector<HTMLLinkElement | HTMLMetaElement>(sel)
      if (!el) return () => undefined
      const old = el.getAttribute(attr) || ''
      el.setAttribute(attr, val)
      return () => el.setAttribute(attr, old)
    }
    const undo = [swap('link[rel="manifest"]', 'href', 'ape/manifest.webmanifest'), swap('link[rel="apple-touch-icon"]', 'href', 'ape/icon-180.png'), swap('meta[name="apple-mobile-web-app-title"]', 'content', 'planê.apê')]
    souDona().then(setOwner, () => setOwner(false))
    return () => undo.forEach((f) => f())
  }, [])
  // os orçamentos dependem de quem é: morador do San Levi (ou a dona) vê; os outros, não
  const recarregar = () => loadPublico(me, owner).then(setD, () => setD(null))
  useEffect(() => {
    void recarregar()
  }, [me?.id, me?.condominio, owner])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.id])

  const vis = useMemo(() => (d ? d.orcamentos.filter((o) => (owner || !apeCloud ? true : !o.exemplo && !o.oculto)) : []), [d, owner])
  const whats = d?.ajustes.whatsapp || APE.whatsapp
  const first = me ? firstName(me.nome) : ''

  const onCadastro = (m: Morador) => {
    setMe(m)
    write(CAD, m)
    setEditing(false)
  }

  // loja, checkout e pedido: página de vendas aberta a todos; orçamentos e envio: só moradores do San Levi
  const publico = view === 'loja' || view === 'checkout' || view === 'pedido'
  const morador = !!me && ehSanLevi(me)
  return (
    <div className={`ape ${publico ? 'ape-publico' : ''}`}>
      {publico ? (
        <ShopNav morador={morador || owner} />
      ) : (
      <header className="ape-top">
        <div className="wrap">
          <div className="ape-brand">
            <a className="ape-logo" href={href('ape')} aria-label={`${APE.name}: início`}>
              <span className="ape-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
              <div>
                <h1>
                  planê<span>.apê</span>
                </h1>
                <small>orçamentos do {APE.condominio} · só moradores</small>
              </div>
            </a>
            {me && (
              <button className="ape-me" onClick={() => setEditing(true)} aria-label="Editar meus dados">
                <span>
                  oi, <b>{first}</b>
                  {ondeMora(me) && <span className="ape-me-ap"> · {ehSanLevi(me) && me.torre ? `T${me.torre} · ${me.ap}` : ondeMora(me)}</span>}
                </span>
                <span className="ape-av">{first.charAt(0).toUpperCase()}</span>
              </button>
            )}
          </div>
          <nav className="ape-tabs" aria-label="Seções">
            <a href={href('ape')} aria-current={view === 'orcamentos' ? 'page' : undefined}>
              <ApeIcon name="list" />
              Orçamentos <span className="cnt num">{vis.length}</span>
            </a>
            <a href={href('ape', 'enviar')} aria-current={view === 'enviar' ? 'page' : undefined}>
              <ApeIcon name="send" />
              Enviar orçamento
            </a>
            <a href={href('ape', 'loja')}>
              <ApeIcon name="bag" />
              Loja do apê
            </a>
            {owner && (
              <a href={href('ape-admin')}>
                <ApeIcon name="gear" />
                Painel
              </a>
            )}
          </nav>
        </div>
      </header>
      )}
      <main className="wrap ape-main">
        {d === undefined ? (
          <div className="ape-panel ape-empty">
            <span className="ape-thinking">
              <span className="ape-dots"><i /><i /><i /></span>carregando os orçamentos…
            </span>
          </div>
        ) : d === null ? (
          <div className="ape-panel ape-empty">
            <b>a página não abriu</b>
            <span>Confira a internet e tente de novo em instantes.</span>
            <button className="ape-btn" onClick={() => void recarregar()}>tentar de novo</button>
          </div>
        ) : view === 'orcamentos' ? (
          <Orcamentos vis={vis} d={d} owner={owner} me={me} whats={whats} show={show} onCount={(id, n) => setD({ ...d, contagens: { ...d.contagens, [id]: n } })} onEscolha={(id, nicho, ficou) => {
            // um por serviço: tira a escolha anterior do mesmo serviço
            const doServico = d.orcamentos.filter((o) => o.nicho === nicho).map((o) => o.id)
            const antes = d.minhas.filter((x) => doServico.includes(x))
            const escolhas = { ...d.escolhas }
            antes.forEach((x) => (escolhas[x] = Math.max(0, (escolhas[x] || 1) - 1)))
            if (ficou) escolhas[id] = (escolhas[id] || 0) + 1
            setD({ ...d, escolhas, minhas: [...d.minhas.filter((x) => !doServico.includes(x)), ...(ficou ? [id] : [])] })
          }} onEditar={() => setEditing(true)} />
        ) : view === 'enviar' ? (
          <Enviar me={me} whats={whats} />
        ) : view === 'checkout' ? (
          <Checkout produtos={d.ajustes.produtos} tiers={d.ajustes.descontos || DESCONTOS} me={me} whats={whats} />
        ) : view === 'pedido' ? (
          <PedidoPage token={sub!.slice(7)} whats={whats} />
        ) : (
          <Loja key={abrir || 'loja'} produtos={d.ajustes.produtos} me={me} whats={whats} abrir={abrir} tiers={d.ajustes.descontos || DESCONTOS} />
        )}
      </main>
      {(!publico || morador) && <nav className="ape-bnav" aria-label="Seções">
        <a href={href('ape')} aria-current={view === 'orcamentos' ? 'page' : undefined}>
          <ApeIcon name="list" />
          orçamentos
          {vis.length > 0 && <span className="cnt num">{vis.length}</span>}
        </a>
        <a href={href('ape', 'enviar')} aria-current={view === 'enviar' ? 'page' : undefined}>
          <ApeIcon name="send" />
          enviar
        </a>
        <a href={href('ape', 'loja')} aria-current={view === 'loja' || view === 'checkout' ? 'page' : undefined}>
          <ApeIcon name="bag" />
          loja do apê
        </a>
        {owner && (
          <a href={href('ape-admin')}>
            <ApeIcon name="gear" />
            painel
          </a>
        )}
      </nav>}
      <p className="ape-foot">
        <b>{APE.name}</b> · Os orçamentos são enviados por quem está montando o apê e aparecem como foram recebidos. A página só organiza e compara: confira valores, prazos e condições direto com o fornecedor antes de fechar. Não temos vínculo com os fornecedores nem participamos das negociações.
      </p>
      {!owner && !publico && (!me || editing) && <Cadastro me={me} onDone={onCadastro} onCancel={me ? () => setEditing(false) : undefined} />}
      {toast}
    </div>
  )
}

/* ===== menu da página de vendas (loja aberta a todos) ===== */
function ShopNav({ morador }: { morador: boolean }) {
  const cart = useCarrinho()
  const n = cart.ids.length
  const ir = (id: string) => {
    if (!location.hash.startsWith('#/ape/loja')) location.hash = '#/ape/loja'
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  return (
    <header className="ape-top ape-shopnav">
      <div className="wrap ape-brand">
        <a className="ape-logo" href={href('ape', 'loja')} aria-label={`${APE.name}: loja`}>
          <span className="ape-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
          <div>
            <h1>
              planê<span>.apê</span>
            </h1>
            <small>do contrato às chaves</small>
          </div>
        </a>
        <nav className="ape-shoplinks" aria-label="Loja">
          <button onClick={() => ir('loja-arquivos')}>arquivos</button>
          <button onClick={() => ir('loja-combos')}>kits</button>
          <button onClick={() => ir('loja-plataforma')}>plataforma</button>
          <button onClick={() => ir('loja-duvidas')}>dúvidas</button>
          {morador && <a href={href('ape')}>área do {APE.condominio}</a>}
        </nav>
        <a className="ape-btn primary sm ape-cartbtn" href={href('ape', 'loja:carrinho')} onClick={() => window.dispatchEvent(new Event('ape-abrir-carrinho'))} aria-label={`Carrinho com ${n} itens`}>
          <ApeIcon name="bag" />
          carrinho{n ? <em>{n}</em> : null}
        </a>
      </div>
    </header>
  )
}

/* ===== orçamentos ===== */
function Orcamentos({ vis, d, owner, me, whats, show, onCount, onEscolha, onEditar }: { vis: Orcamento[]; d: Publico; owner: boolean; me: Morador | null; whats: string; show: (m: string) => void; onCount: (id: string, n: number) => void; onEscolha: (id: string, nicho: string, ficou: boolean) => void; onEditar: () => void }) {
  const saved = read<{ nicho?: string; sort?: Sort; validos?: boolean }>(UI) || {}
  const [filtro, setFiltro] = useState(saved.nicho || 'todos')
  const [sort, setSort] = useState<Sort>(saved.sort && SORTS[saved.sort] ? saved.sort : 'compensa')
  const [validos, setValidos] = useState(!!saved.validos)
  const [q, setQ] = useState('')
  useEffect(() => {
    write(UI, { nicho: filtro, sort, validos })
  }, [filtro, sort, validos])

  const counts: Record<string, number> = {}
  for (const o of vis) counts[o.nicho] = (counts[o.nicho] || 0) + 1
  const nf = filtro !== 'todos' && !counts[filtro] ? 'todos' : filtro
  const comGrupo = vis.filter((o) => num(o.grupo_pct)).length
  const exemplos = vis.filter((o) => o.exemplo).length

  if (d.bloqueado && !owner)
    return (
      <>
        <section className="ape-panel ape-hero">
          <div>
            <p className="ape-eyebrow">só para moradores</p>
            <h2>
              os orçamentos são dos moradores do <em>{APE.condominio}</em>
            </h2>
            <p>Aqui os futuros moradores do {APE.condominio} ({APE.construtora}) comparam os orçamentos que receberam e escolhem com quem fechar. Se você é de outro lugar, a loja do apê é para você: checklists, planilhas e guias para quem está montando o apê.</p>
            <div className="ape-acts" style={{ marginTop: 14 }}>
              <a className="ape-btn primary" href={href('ape', 'loja')}><ApeIcon name="bag" />ver a loja do apê</a>
              <button className="ape-btn" onClick={onEditar}>sou do {APE.condominio}</button>
            </div>
          </div>
          <div className="ape-lockart" aria-hidden="true"><ApeArt name="casa" size={120} /></div>
        </section>
        <Cta nicho="outros" produtos={d.ajustes.produtos} />
      </>
    )

  if (!vis.length)
    return (
      <>
        <section className="ape-panel ape-hero">
          <div>
            <p className="ape-eyebrow">começando agora</p>
            <h2>
              os orçamentos de quem está montando o apê, <em>lado a lado</em>
            </h2>
            <p>Cada pessoa que manda um orçamento ajuda todo mundo a comparar preço, o que está incluso e a negociar desconto em grupo. Quanto mais gente, melhor o desconto.</p>
          </div>
          <ol className="ape-steps" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
            <li><b>1</b>Peça orçamento de piso, marcenaria, box, gesso…</li>
            <li><b>2</b>Mande por aqui (PDF, print ou texto)</li>
            <li><b>3</b>Ele entra na página, lado a lado com os outros</li>
          </ol>
        </section>
        <div className="ape-acts">
          <a className="ape-btn primary wide" href={href('ape', 'enviar')}>
            <ApeIcon name="send" />
            enviar um orçamento
          </a>
          <Compartilhar />
        </div>
        <Cta nicho="outros" produtos={d.ajustes.produtos} me={me} whats={whats} />
      </>
    )

  const term = q.trim().toLowerCase()
  let list = vis.filter((o) => nf === 'todos' || o.nicho === nf)
  if (term) list = list.filter((o) => [o.fornecedor, o.servico, o.resumo, ...(o.inclui || [])].join(' ').toLowerCase().includes(term))
  if (validos) list = list.filter((o) => calc(o).st !== 'vencido')
  const groups = NICHOS.map((n) => n[0]).filter((id) => list.some((o) => o.nicho === id))
  let ctaDone = false

  return (
    <>
      {owner && exemplos > 0 && (
        <div className="ape-banner warn">
          Os cartões marcados como <b>exemplo</b> e os ocultos só aparecem para você.
          <a className="ape-btn sm" href={href('ape-admin')}>abrir o painel</a>
        </div>
      )}
      {!apeCloud && <div className="ape-banner">Prévia: os dados ficam só neste navegador e os orçamentos são de exemplo.</div>}
      <section className="ape-panel ape-hero">
        <div>
          <h2>
            orçamentos de quem está montando o apê, <em>lado a lado</em>
          </h2>
          <p>Quem está montando o apê manda os orçamentos que recebeu e eles ficam lado a lado, por serviço: o que está incluso, o que fica de fora, à vista e parcelado.</p>
          <div className="ape-acts" style={{ marginTop: 14 }}>
            <Compartilhar />
          </div>
        </div>
        <div className="ape-stats">
          <div className="ape-stat"><b className="num">{vis.length}</b><span>orçamentos</span></div>
          <div className="ape-stat"><b className="num">{Object.keys(counts).length}</b><span>serviços</span></div>
          <div className="ape-stat"><b className="num">{comGrupo}</b><span>com desconto em grupo</span></div>
        </div>
      </section>
      <p className="ape-aviso">
        <ApeIcon name="alert" />
        <span>Os orçamentos vêm de quem está montando o apê e aparecem como foram enviados. O "mais compensa" é um cálculo automático (preço, o que está incluso e validade), não uma indicação. Confira tudo com o fornecedor antes de fechar.</span>
      </p>
      <div className="ape-chips" role="group" aria-label="Filtrar por serviço">
        <button className="ape-chip" aria-pressed={nf === 'todos'} onClick={() => setFiltro('todos')}>
          Todos <span>{vis.length}</span>
        </button>
        {NICHOS.filter((n) => counts[n[0]]).map((n) => (
          <button key={n[0]} className="ape-chip" aria-pressed={nf === n[0]} onClick={() => setFiltro(n[0])}>
            <ApeIcon name={n[2]} />
            {n[1]} <span>{counts[n[0]]}</span>
          </button>
        ))}
      </div>
      <div className="ape-toolbar">
        <label className="ape-search">
          <ApeIcon name="search" />
          <input type="search" placeholder="Buscar fornecedor ou item…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        </label>
        <select className="ape-sel" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar por">
          {Object.entries(SORTS).map(([k, s]) => (
            <option key={k} value={k}>{s[0]}</option>
          ))}
        </select>
        <label className="ape-tog">
          <input type="checkbox" checked={validos} onChange={(e) => setValidos(e.target.checked)} /> Só dentro da validade
        </label>
      </div>
      <div style={{ display: 'grid', gap: 26 }}>
        {!list.length && (
          <div className="ape-panel ape-empty">
            <b>nada por aqui</b>
            <span>Nenhum orçamento com esse filtro. Tente limpar a busca ou mostrar os vencidos.</span>
          </div>
        )}
        {groups.map((id, gi) => {
          const a = analyze(list.filter((o) => o.nicho === id))
          const sorted = [...a.items].sort(SORTS[sort][1])
          const top = sort === 'compensa' && a.top ? a.top : null
          const rest = top ? sorted.filter((x) => x !== top) : sorted
          const n = nicho(id)
          const showCta = !ctaDone && (gi === 0 || nf !== 'todos')
          if (showCta) ctaDone = true
          const card = (x: Item, isTop: boolean) => <Card key={x.o.id} x={x} a={a} isTop={isTop} me={me} whats={whats} count={d.contagens[x.o.id] || 0} escolhas={d.escolhas[x.o.id] || 0} minha={d.minhas.includes(x.o.id)} show={show} onCount={onCount} onEscolha={onEscolha} />
          return (
            <div key={id} style={{ display: 'grid', gap: 18 }}>
              <section className="ape-nicho" aria-label={n.l}>
                <div className="ape-nhead">
                  <span className="ape-nic"><ApeIcon name={n.i} /></span>
                  <div>
                    <h3>{n.l}</h3>
                    <span className="ape-note">
                      {a.items.length} orçamento{a.items.length > 1 ? 's' : ''} · {a.basis === 'm2' ? 'comparando pelo preço por m² à vista' : 'comparando pelo preço à vista'}
                    </span>
                  </div>
                </div>
                {top && card(top, true)}
                {rest.length > 0 && <div className="ape-grid">{rest.map((x) => card(x, false))}</div>}
              </section>
              {showCta && <Cta nicho={id} produtos={d.ajustes.produtos} me={me} whats={whats} />}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Card({ x, a, isTop, me, whats, count, escolhas, minha, show, onCount, onEscolha }: { x: Item; a: Analise; isTop: boolean; me: Morador | null; whats: string; count: number; escolhas: number; minha: boolean; show: (m: string) => void; onCount: (id: string, n: number) => void; onEscolha: (id: string, nicho: string, ficou: boolean) => void }) {
  const { o, c } = x
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(() => (read<string[]>(GRUPOS) || []).includes(o.id))
  const why = isTop ? whyTop(x, a) : []
  const vendorWa = waNum(o.whatsapp)
  const total = (num(o.interessados) || 0) + count
  const falta = num(o.grupo_min) ? Math.max(0, (num(o.grupo_min) || 0) - total) : null
  const venc =
    c.st === 'vencido' ? (
      <span className="ape-pill rosa"><ApeIcon name="clock" />Vencido em {dmy(o.validade)}</span>
    ) : c.st === 'vence' ? (
      <span className="ape-pill rosa"><ApeIcon name="clock" />Vence {c.dias === 0 ? 'hoje' : `em ${c.dias} dia${(c.dias || 0) > 1 ? 's' : ''}`}</span>
    ) : c.st === 'ok' ? (
      <span className="ape-pill"><ApeIcon name="clock" />Válido até {dmy(o.validade)}</span>
    ) : null

  const [esc, setEsc] = useState(false)
  const fechar = async () => {
    if (!me?.id) return show('Faça o cadastro para escolher.')
    setEsc(true)
    try {
      const r = await escolher(o.id, me.id, o.nicho)
      onEscolha(o.id, o.nicho, !!r)
      show(r ? `Anotado: você vai fechar ${nicho(o.nicho).l.toLowerCase()} com ${o.fornecedor}.` : 'Escolha desmarcada.')
    } catch {
      show('Não deu para salvar agora. Tente de novo.')
    }
    setEsc(false)
  }
  const entrar = async () => {
    if (!me?.id) return show('Faça o cadastro para entrar no grupo.')
    setBusy(true)
    try {
      const n = await queroGrupo(o.id, me.id)
      onCount(o.id, n)
      setJoined(true)
      write(GRUPOS, [...new Set([...(read<string[]>(GRUPOS) || []), o.id])])
      show('Pronto! Seu apê entrou na lista do grupo.')
    } catch {
      // sem conexão com a nuvem: segue pelo WhatsApp
      window.open(wa(whats, msgGrupo(o, me)), '_blank', 'noopener')
    }
    setBusy(false)
  }

  return (
    <article className={`ape-oc ${isTop ? 'top' : ''} ${c.st === 'vencido' ? 'vencido' : ''} ${o.oculto ? 'oculto' : ''}`}>
      {isTop && <span className="ape-crown"><ApeIcon name="star" />Mais compensa</span>}
      <div className="ape-oc-h">
        <b>{o.fornecedor || 'Fornecedor sem nome'}</b>
        <span>{o.servico}</span>
      </div>
      {o.resumo && <p className="ape-resumo">{o.resumo}</p>}
      <div className="ape-pr">
        <div className="ape-pbox hl">
          <span className="l">À vista</span>
          <span className="v num">{brl(c.avista)}</span>
          <span className="h">{c.dp ? `${pct(c.dp)} de desconto` : c.total && c.avista === c.total ? 'sem desconto informado' : ' '}</span>
        </div>
        {(c.parcelas || 0) >= 2 && (
          <div className="ape-pbox">
            <span className="l">Parcelado</span>
            <span className="v num">{c.parcelas}x {brl(c.parcela)}</span>
            <span className="h">{o.juros === false ? 'sem juros' : o.juros ? 'com juros' : 'juros não informado'} · total {brl(c.parcTotal)}</span>
          </div>
        )}
        {c.grupo != null && (
          <div className="ape-pbox gp">
            <span className="l">Em grupo</span>
            <span className="v num">{brl(c.grupo)}</span>
            <span className="h">−{pct(c.gp)}{num(o.grupo_min) ? ` com ${num(o.grupo_min)}+ apês` : ''}</span>
          </div>
        )}
        {c.m2 != null && (
          <div className="ape-pbox">
            <span className="l">Por m²</span>
            <span className="v num">{brl(c.m2)}</span>
            <span className="h">{String(c.area).replace('.', ',')} m² orçados</span>
          </div>
        )}
      </div>
      {why.length > 0 && (
        <ul className="ape-why">
          {why.map((w) => (
            <li key={w}><ApeIcon name="check" /><span>{w}</span></li>
          ))}
        </ul>
      )}
      <div className="ape-tags">
        {o.exemplo && <span className="ape-pill rosa">Exemplo</span>}
        {o.oculto && <span className="ape-pill rosa"><ApeIcon name="eye" />Oculto</span>}
        {x.badges.map((b) => (
          <span key={b.label} className={`ape-pill ${b.tone}`}><ApeIcon name={b.icon} />{b.label}</span>
        ))}
        {venc}
        {o.nao_inclui.length > 0 && (
          <span className="ape-pill rosa"><ApeIcon name="alert" />{o.nao_inclui.length} ite{o.nao_inclui.length > 1 ? 'ns' : 'm'} fora</span>
        )}
      </div>
      {c.gp > 0 && (total > 0 || num(o.grupo_min)) && (
        <div className="ape-meta">
          <div className="ape-meta-t">
            <span>
              <ApeIcon name="users" /> {total ? `${total} ${total > 1 ? 'apês já querem' : 'apê já quer'} fechar em grupo` : 'seja o primeiro apê do grupo'}
            </span>
            {num(o.grupo_min) ? <b className="num">{falta ? `${total} de ${num(o.grupo_min)}` : 'meta batida'}</b> : null}
          </div>
          {num(o.grupo_min) ? (
            <div className="ape-bar" role="progressbar" aria-valuemin={0} aria-valuemax={num(o.grupo_min) || 0} aria-valuenow={Math.min(total, num(o.grupo_min) || 0)} aria-label="Apês no grupo">
              <i style={{ width: `${Math.min(100, (total / (num(o.grupo_min) || 1)) * 100)}%` }} />
            </div>
          ) : null}
          {falta ? <span className="ape-note">faltam {falta} para liberar −{pct(c.gp)}</span> : null}
        </div>
      )}
      {(escolhas > 0 || minha) && (
        <div className="ape-escolha">
          <ApeIcon name="check" />
          {minha ? (escolhas > 1 ? `Você e mais ${escolhas - 1} ${escolhas - 1 > 1 ? 'vizinhos vão' : 'vizinho vai'} fechar com este` : 'Você vai fechar com este') : `${escolhas} ${escolhas > 1 ? 'vizinhos vão' : 'vizinho vai'} fechar com este`}
        </div>
      )}
      <details className="ape-more">
        <summary><ApeIcon name="chev" />o que está incluso e o que não está</summary>
        <div className="ape-lists">
          {o.inclui.length > 0 && <Lista cls="y" t="Inclui" icon="check" itens={o.inclui} />}
          {o.nao_inclui.length > 0 && <Lista cls="n" t="Não inclui" icon="x" itens={o.nao_inclui} />}
          {o.alertas.length > 0 && <Lista cls="a" t="Antes de fechar, confira" icon="alert" itens={o.alertas} />}
          <dl className="ape-facts">
            {([['Pagamento', o.pagamento], ['Prazo', o.prazo], ['Garantia', o.garantia], ['Em grupo', o.grupo_desc], ['Contato', o.contato], ['WhatsApp', vendorWa ? fmtTel(o.whatsapp) : ''], ['Instagram', o.instagram || '']] as const)
              .filter((f) => f[1])
              .map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd className={k === 'WhatsApp' ? 'ape-tel' : undefined}>{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      </details>
      <div className="ape-acts">
        {vendorWa ? (
          <a className="ape-btn primary wide" href={wa(vendorWa, msgFornecedor(o, me))} target="_blank" rel="noopener noreferrer">
            <ApeIcon name="chat" />
            falar com o fornecedor
          </a>
        ) : (
          <span className="ape-note">Contato do fornecedor não informado</span>
        )}
        <button className={`ape-btn ${minha ? 'rose' : ''}`} onClick={() => void fechar()} disabled={esc} aria-pressed={minha} title={minha ? 'Tocar de novo desmarca' : 'Marca este como o que você vai contratar (um por serviço)'}>
          <ApeIcon name={minha ? 'check' : 'star'} />
          {minha ? 'minha escolha' : 'vou fechar com este'}
        </button>
        {c.gp > 0 &&
          (joined ? (
            <a className="ape-btn rose" href={wa(whats, msgGrupo(o, me))} target="_blank" rel="noopener noreferrer" title="Você já está na lista do grupo">
              <ApeIcon name="check" />
              você está no grupo
            </a>
          ) : (
            <button className="ape-btn blue" onClick={entrar} disabled={busy}>
              <ApeIcon name="users" />
              entrar no grupo
            </button>
          ))}
      </div>
    </article>
  )
}

/* convite para os vizinhos: compartilhar do celular ou mandar no WhatsApp */
// link direto para os moradores (abre a página deles, não o site do planê)
const LINK = 'https://useplane.com.br/ape/sanlevi/'
const CONVITE = `Vizinho(a) do ${APE.condominio}! Estou usando esta página para comparar os orçamentos do apê (piso, marcenaria, box…) e escolher com quem fechar. Manda os seus também 🏡`
function Compartilhar() {
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ title: `${APE.name} · ${APE.condominio}`, text: CONVITE, url: LINK })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    window.open(wa('', `${CONVITE}\n${LINK}`), '_blank', 'noopener')
  }
  return (
    <button type="button" className="ape-btn" onClick={() => void share()}>
      <ApeIcon name="share" />
      compartilhar
    </button>
  )
}

function Lista({ cls, t, icon, itens }: { cls: string; t: string; icon: string; itens: string[] }) {
  return (
    <div className={cls}>
      <h4>{t}</h4>
      <ul>
        {itens.map((s, i) => (
          <li key={i}><ApeIcon name={icon} /><span>{s}</span></li>
        ))}
      </ul>
    </div>
  )
}

function Cta({ nicho: n, produtos }: { nicho: Nicho; produtos: Produto[]; me?: Morador | null; whats?: string }) {
  const ativos = produtos.filter((p) => p.ativo)
  const p = ativos.find((p) => p.id === (CTA_BY[n] || (n === 'outros' ? 'kit-completo' : 'checklist'))) || ativos[0]
  if (!p) return null
  const copy = CTA_COPY[p.id] || ['Loja do apê', p.nome, p.desc]
  return (
    <aside className="ape-cta">
      <div>
        <span className="k">{copy[0]}</span>
        <h3>{copy[1]}</h3>
        <p>{copy[2]}</p>
      </div>
      <a className="ape-btn" href={href('ape', `loja:${p.id}`)}>
        <ApeIcon name="eye" />
        {p.preco ? `${p.preco} · ` : ''}ver como é
      </a>
    </aside>
  )
}

/* ===== enviar ===== */
function Enviar({ me, whats }: { me: Morador | null; whats: string }) {
  const [n, setN] = useState('')
  const [forn, setForn] = useState('')
  const [txt, setTxt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [err, setErr] = useState('')
  const [step, setStep] = useState('')
  const [done, setDone] = useState(false)
  const [meus, setMeus] = useState<MeuEnvio[]>([])
  const [subidos, setSubidos] = useState<Arquivo[]>([])
  const [lendo, setLendo] = useState('')
  const [auto, setAuto] = useState(false) // fornecedor e serviço vieram da leitura automática
  useEffect(() => {
    if (me?.id) meusEnvios(me.id).then(setMeus, () => setMeus([]))
  }, [me?.id, done])

  /* anexou: sobe na hora e a IA já puxa o fornecedor e o serviço */
  const anexar = async (list: File[]) => {
    setFiles(list)
    setSubidos([])
    setErr('')
    if (!list.length || !me?.id) return
    if (list.length > 8) return setErr('Mande no máximo 8 arquivos por vez.')
    try {
      setLendo('subindo o arquivo…')
      const arqs = await subirArquivos(list, setLendo)
      setSubidos(arqs)
      setLendo('lendo o orçamento…')
      const r = await lerAnexos(me.id, arqs, txt)
      if (r) {
        let algo = false
        if (r.fornecedor && !forn.trim()) (setForn(r.fornecedor), (algo = true))
        if (r.nicho && r.nicho !== 'outros' && !n) (setN(r.nicho), (algo = true))
        setAuto(algo)
      }
    } catch (x) {
      setErr(String((x as Error).message))
    }
    setLendo('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!me?.id) return setErr('Faça o cadastro antes de enviar.')
    if (lendo) return setErr('Espere terminar de ler o arquivo.')
    if (!txt.trim() && !files.length) return setErr('Cole o texto do orçamento ou anexe o PDF ou um print.')
    if (files.length > 8) return setErr('Mande no máximo 8 arquivos por vez.')
    const big = files.find((f) => f.size > 15 * 1024 * 1024 && !/^image\/(jpeg|png|webp)$/i.test(f.type))
    if (big) return setErr(`O arquivo ${big.name} passa de 15 MB. Mande um print ou um PDF menor.`)
    setStep('Enviando…')
    try {
      await enviar(me.id, { nicho: n, fornecedor: forn.trim(), texto: txt.trim(), files, arquivos: subidos.length === files.length ? subidos : undefined }, setStep)
      setDone(true)
    } catch (e) {
      setErr(`Não deu para enviar agora (${(e as Error).message}). Tente de novo ou mande pelo WhatsApp.`)
    }
    setStep('')
  }

  const lista = meus.length > 0 && (
    <section className="ape-panel">
      <p className="ape-eyebrow">seus envios</p>
      <div className="ape-rows">
        {meus.map((m) => (
          <div key={m.id} className="ape-row">
            <div className="t">
              <b>{m.fornecedor || 'Fornecedor não informado'}</b>
              <span>{m.nicho ? nicho(m.nicho).l : 'serviço não informado'} · {dmy(m.criado)}</span>
            </div>
            <div className="r">
              <span className={`ape-pill ${m.status === 'publicado' ? 'azul' : m.status === 'descartado' ? 'rosa' : ''}`}>
                <ApeIcon name={m.status === 'publicado' ? 'check' : 'clock'} />
                {m.status === 'publicado' ? 'publicado na página' : m.status === 'descartado' ? 'não publicado' : 'recebido, em análise'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )

  if (me && !ehSanLevi(me))
    return (
      <section className="ape-panel ape-empty">
        <ApeIcon name="shield" size={30} />
        <b>o envio é para os moradores do {APE.condominio}</b>
        <span>Os orçamentos ficam entre os vizinhos do {APE.condominio}. Se você é de lá, atualize o seu cadastro.</span>
        <a className="ape-btn primary" href={href('ape', 'loja')}><ApeIcon name="bag" />ver a loja do apê</a>
      </section>
    )

  if (done)
    return (
      <>
      <section className="ape-panel ape-done">
        <ApeIcon name="check" />
        <h2 className="ape-h2">
          recebido, <em>obrigada!</em>
        </h2>
        <p className="ape-note" style={{ maxWidth: '46ch', margin: 0 }}>O orçamento entra na página organizado com os outros, sem os seus dados. Você acompanha aqui embaixo, em "seus envios".</p>
        <div className="ape-acts" style={{ justifyContent: 'center' }}>
          <button className="ape-btn primary" onClick={() => { setDone(false); setN(''); setForn(''); setTxt(''); setFiles([]) }}>
            <ApeIcon name="plus" />
            mandar outro
          </button>
          <a className="ape-btn" href={href('ape')}>ver os orçamentos</a>
          <Compartilhar />
        </div>
      </section>
      {lista}
      </>
    )

  return (
    <>
    <form className="ape-panel ape-form" onSubmit={submit} noValidate>
      <div>
        <p className="ape-eyebrow"><ApeIcon name="send" />Enviar orçamento</p>
        <h2 className="ape-h2">
          anexe e pronto: <em>a página organiza</em>
        </h2>
      </div>
      <ol className="ape-steps">
        <li className="ape-step-art"><ApeArt name="anexo" size={44} /><span><b>1</b>Anexe o PDF ou os prints que o fornecedor mandou</span></li>
        <li className="ape-step-art"><ApeArt name="ia" size={44} tone="sec" /><span><b>2</b>A página já puxa o fornecedor e o serviço sozinha</span></li>
        <li className="ape-step-art"><ApeArt name="comparar" size={44} /><span><b>3</b>Confira e envie: entra na página, lado a lado com os outros, sem os seus dados</span></li>
      </ol>
      <label className="ape-drop" htmlFor="e-files">
        <ApeIcon name="clip" />
        <b>{files.length ? 'trocar os arquivos' : 'anexar PDF ou prints'}</b>
        <input id="e-files" type="file" multiple accept="application/pdf,image/*" onChange={(e) => void anexar([...(e.target.files || [])])} />
        {files.length > 0 && (
          <span className="ape-files">
            {files.map((f) => (
              <span key={f.name} className="ape-pill"><ApeIcon name="file" />{f.name}</span>
            ))}
          </span>
        )}
        {lendo ? (
          <span className="ape-thinking"><span className="ape-dots"><i /><i /><i /></span>{lendo}</span>
        ) : (
          <span className="ape-note">Toque para escolher da galeria ou dos arquivos. Até 8, de até 15 MB cada.</span>
        )}
      </label>
      {auto && <div className="ape-banner"><ApeIcon name="sparkle" />Preenchemos o fornecedor e o serviço lendo o arquivo. Confira se está certo.</div>}
      <div className="ape-frow">
        <div className="ape-f">
          <label htmlFor="e-nicho">Serviço</label>
          <select id="e-nicho" value={n} onChange={(e) => { setN(e.target.value); setAuto(false) }}>
            <option value="">{lendo ? 'lendo…' : 'Escolha…'}</option>
            {NICHOS.map((x) => (
              <option key={x[0]} value={x[0]}>{x[1]}</option>
            ))}
          </select>
        </div>
        <div className="ape-f">
          <label htmlFor="e-forn">Fornecedor</label>
          <input id="e-forn" value={forn} onChange={(e) => setForn(e.target.value)} placeholder={lendo ? 'lendo…' : 'Nome da loja ou profissional'} />
        </div>
      </div>
      <div className="ape-f">
        <label htmlFor="e-txt">Texto do orçamento (opcional)</label>
        <textarea id="e-txt" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Cole aqui o que o fornecedor mandou: valores, parcelas, o que inclui, validade…" />
      </div>
      {err && <p className="ape-err" role="alert">{err}</p>}
      <div className="ape-acts">
        <button className="ape-btn primary" type="submit" disabled={!!step || !!lendo}>
          <ApeIcon name="send" />
          {step || 'enviar orçamento'}
        </button>
        {err && (
          <a className="ape-btn" href={wa(whats, msgAnexo(me, forn.trim()) + (txt.trim() ? `\n\n${txt.trim()}` : ''))} target="_blank" rel="noopener noreferrer">
            <ApeIcon name="chat" />
            mandar pelo WhatsApp
          </a>
        )}
      </div>
      <p className="ape-note" style={{ margin: 0 }}>Seu nome e telefone ficam guardados só para identificar quem mandou. Na página, o orçamento aparece sem os seus dados.</p>
    </form>
    {lista}
    </>
  )
}

/* ===== loja ===== */
const CARRINHO = 'ape-carrinho'
type Carrinho = { ids: string[]; add: (id: string) => void; remove: (id: string) => void; limpar: () => void; tem: (id: string) => boolean }
function useCarrinho(): Carrinho {
  const [ids, setIds] = useState<string[]>(() => read<string[]>(CARRINHO) || [])
  // vários pedaços da página usam o carrinho (menu, loja, checkout): todos ficam iguais
  useEffect(() => {
    const sync = () => setIds(read<string[]>(CARRINHO) || [])
    window.addEventListener('ape-carrinho', sync)
    return () => window.removeEventListener('ape-carrinho', sync)
  }, [])
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
const faixas = (t: [number, number][]) => t.map(([k, v]) => `${k}${k === t[t.length - 1][0] ? '+' : ''} itens: −${v}%`)

function Loja({ produtos, me, whats, abrir, tiers }: { produtos: Produto[]; me: Morador | null; whats: string; abrir?: string; tiers: [number, number][] }) {
  const ativos = produtos.filter((p) => p.ativo)
  const [cat, setCat] = useState<string>('todos')
  const [aberto, setAberto] = useState<Produto | null>(() => ativos.find((p) => p.id === abrir) || null)
  const [verCarrinho, setVerCarrinho] = useState(abrir === 'carrinho')
  const cart = useCarrinho()
  const [toast, show] = useToast()
  const byId = (id: string) => produtos.find((p) => p.id === id)
  // vitrine em etapas: quem vai comprar o apê, quem já comprou, kits, plataforma e projeto
  const secoes: { id: string; l: string; arte: string; d: string; f: (p: Produto) => boolean }[] = [
    { id: 'comprando', l: 'vai comprar um apê?', arte: 'contrato', d: 'Para a visita ao stand, a simulação e o contrato: o que olhar, quanto custa de verdade e o que perguntar.', f: (p: Produto) => (p.cat || 'arquivos') === 'arquivos' && p.fase === 'comprando' },
    { id: 'comprei', l: 'já comprou? vistoria, obra e mudança', arte: 'vistoria', d: 'Da vistoria das chaves à decoração: checklists, planilhas e guias para cada etapa.', f: (p: Produto) => (p.cat || 'arquivos') === 'arquivos' && p.fase !== 'comprando' },
    ...CATEGORIAS.filter(([c]) => c !== 'arquivos').map(([c, l, , d]) => ({ id: c, l, arte: c === 'combos' ? 'casa' : c === 'plataforma' ? 'celular' : 'projeto3d', d, f: (p: Produto) => p.cat === c })),
  ].filter((x) => ativos.some(x.f))
  const tot = conta(cart.ids, produtos, tiers)
  useEffect(() => {
    const abrirCarrinho = () => setVerCarrinho(true)
    window.addEventListener('ape-abrir-carrinho', abrirCarrinho)
    return () => window.removeEventListener('ape-abrir-carrinho', abrirCarrinho)
  }, [])
  useEffect(() => {
    document.body.style.overflow = aberto || verCarrinho ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [aberto, verCarrinho])
  const adicionar = (p: Produto) => {
    cart.add(p.id)
    const depois = conta([...cart.ids, p.id], produtos, tiers)
    show(depois.prox ? `No carrinho! Com mais ${depois.prox[0] - depois.avulsos} arquivo${depois.prox[0] - depois.avulsos > 1 ? 's' : ''}, o desconto vai para ${depois.prox[1]}%.` : depois.pct ? `No carrinho, com ${depois.pct}% de desconto.` : 'No carrinho!')
  }
  if (!ativos.length)
    return (
      <div className="ape-panel ape-empty">
        <b>em breve</b>
        <span>Os produtos aparecem aqui assim que forem lançados.</span>
      </div>
    )
  const ir = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const kitTop = ativos.find((p) => p.cat === 'combos' && p.destaque)
  const plat = ativos.find((p) => p.cat === 'plataforma')
  const secoesLoja = secoes.filter((x) => x.id !== 'plataforma')
  const vitrine = ['m-compra.jpg', 'm-planilha.jpg', 'm-checklist.jpg'].map((f) => `ape/amostras/${f}`)
  return (
    <>
      {/* capa: como a página de vendas do planê */}
      <section className="ape-lp-hero">
        <div className="ape-blobs" aria-hidden="true"><i /><i /><i /></div>
        <div className="ape-lp-text">
          <p className="ape-kicker"><span className="ape-dot" />para quem vai comprar ou já comprou casa ou apê</p>
          <h2>
            do contrato às chaves, <em>sem susto</em>
          </h2>
          <p className="ape-lead">Guias, checklists e planilhas prontos para cada etapa: comprar, receber as chaves, fazer a obra, mudar e decorar. Para casa ou apê de qualquer tamanho.</p>
          <div className="ape-acts">
            <button className="ape-btn primary" onClick={() => ir('loja-arquivos')}><ApeIcon name="bag" />ver os arquivos</button>
            {kitTop && <button className="ape-btn" onClick={() => setAberto(kitTop)}><ApeIcon name="gift" />{kitTop.nome} · {kitTop.preco}</button>}
          </div>
          <div className="ape-trust">
            <span><ApeIcon name="shield" />Pix ou cartão</span>
            <span><ApeIcon name="download" />baixa na hora</span>
            <span><ApeIcon name="check" />7 dias de garantia</span>
          </div>
        </div>
        <div className="ape-lp-art" aria-hidden="true">
          {vitrine.map((src, i) => <img key={src} src={src} alt="" className={`ape-lp-card c${i}`} />)}
          <span className="ape-float f0"><ApeArt name="vistoria" size={54} /></span>
          <span className="ape-float f1"><ApeArt name="calculo" size={50} tone="sec" /></span>
          <span className="ape-float f2"><ApeArt name="mudanca" size={48} /></span>
        </div>
      </section>

      <div className="ape-marquee" aria-hidden="true">
        <div className="ape-marquee-track">
          {[0, 1].map((k) => (
            <span key={k}>
              {['checklist de vistoria', 'planilha de custos da compra', 'guia de medidas', 'planilha de obra', 'guia de orçamentos', 'lista da mudança', 'planner de decoração', 'checklist do decorado', 'planilha do enxoval'].map((t) => <b key={t}><ApeIcon name="check" />{t}</b>)}
            </span>
          ))}
        </div>
      </div>

      {/* quem fez */}
      <section className="ape-story ape-panel">
        <span className="ape-me-av">L</span>
        <div>
          <p className="ape-eyebrow">quem fez</p>
          <p>Oi! Sou a Laís, estou me formando em arquitetura e montando o meu apê de {APE.meuApe}. Juntei aqui tudo o que eu precisei (e não achei pronto): o que perguntar antes de assinar, o que conferir na vistoria, quanto vai custar de verdade e como organizar a obra sem perder o controle.</p>
          <p className="ape-note" style={{ margin: 0 }}>{APE.instagram}</p>
        </div>
      </section>

      {/* as etapas */}
      <section className="ape-journey">
        <h3 className="ape-sec-t">em que etapa <em>você está?</em></h3>
        <div className="ape-journey-grid">
          {[
            ['contrato', 'vou comprar', 'Visita ao decorado, simulação, contrato e custos que ninguém conta.', 'comprando'],
            ['vistoria', 'recebi as chaves', 'Vistoria cômodo por cômodo e o que fazer com cada problema.', 'comprei'],
            ['planilha', 'vou fazer a obra', 'Orçamentos, medidas, gastos, parcelas e entregas dos fornecedores.', 'comprei'],
            ['decoracao', 'mudança e decoração', 'Enxoval, mudança semana a semana e a cara do seu apê.', 'comprei'],
          ].map(([arte, t, d, alvo], i) => (
            <button key={t} className="ape-journey-i" onClick={() => { setCat(alvo); ir('loja-arquivos') }} style={{ animationDelay: `${i * 0.08}s` }}>
              <span className="ape-journey-n">{i + 1}</span>
              <ApeArt name={arte} size={60} tone={i % 2 ? 'sec' : 'pri'} />
              <b>{t}</b>
              <span>{d}</span>
            </button>
          ))}
        </div>
      </section>

      {/* desconto por quantidade */}
      <section className="ape-panel ape-hero ape-shop-hero">
        <div>
          <h3 className="ape-sec-t">monte o seu kit: <em>quanto mais, menor o preço</em></h3>
          <ol className="ape-how">
            <li><ApeArt name="carrinho" size={46} /><span><b>1. escolha</b>arquivos avulsos ou um kit pronto</span></li>
            <li><ApeArt name="grupo" size={46} tone="sec" /><span><b>2. junte mais</b>o desconto sobe sozinho no carrinho</span></li>
            <li><ApeArt name="download" size={46} /><span><b>3. pague e baixe</b>Pix ou cartão, e já baixa</span></li>
          </ol>
        </div>
        <div className="ape-ladder" aria-label="Desconto por quantidade">
          <b>desconto nos arquivos</b>
          {tiers.map(([k, v]) => (
            <div key={k} className={tot.avulsos >= k ? 'on' : ''}>
              <span>{k}{k === tiers[tiers.length - 1][0] ? '+' : ''} arquivos</span>
              <em>−{v}%</em>
            </div>
          ))}
          <span className="ape-note">{tot.prox ? `Você tem ${tot.avulsos} no carrinho. Falta${tot.prox[0] - tot.avulsos > 1 ? 'm' : ''} ${tot.prox[0] - tot.avulsos} para −${tot.prox[1]}%.` : `Desconto máximo de ${tot.pct}% liberado!`}</span>
        </div>
      </section>

      <div id="loja-arquivos" className="ape-anchor" />
      <div className="ape-chips" role="group" aria-label="Filtrar a loja">
        <button className="ape-chip" aria-pressed={cat === 'todos'} onClick={() => setCat('todos')}>tudo</button>
        {secoesLoja.map((x) => (
          <button key={x.id} className="ape-chip" aria-pressed={cat === x.id} onClick={() => setCat(x.id)}>
            {x.id === 'comprando' ? 'vou comprar' : x.id === 'comprei' ? 'já comprei' : x.l}
          </button>
        ))}
      </div>
      {secoesLoja
        .filter((x) => cat === 'todos' || cat === x.id)
        .map((x) => (
          <section key={x.id} id={`loja-${x.id}`} className="ape-nicho ape-reveal" aria-label={x.l}>
            <div className="ape-nhead ape-nhead-art">
              <ApeArt name={x.arte} size={52} />
              <div>
                <h3>{x.l}</h3>
                <span className="ape-note">{x.d}</span>
              </div>
            </div>
            {x.id === 'projeto' ? <Vitrine cat="projeto" /> : null}
            <div className="ape-shop">
              {ativos.filter(x.f).map((p) => (
                <ProdCard key={p.id} p={p} byId={byId} onOpen={() => setAberto(p)} me={me} whats={whats} cart={cart} onAdd={adicionar} produtos={produtos} />
              ))}
            </div>
          </section>
        ))}

      {plat && <PlataformaSec p={plat} cart={cart} onAdd={adicionar} me={me} whats={whats} />}

      {/* garantia e dúvidas */}
      <section className="ape-panel ape-garantia">
        <ApeArt name="entregas" size={72} tone="sec" />
        <div>
          <h3 className="ape-sec-t">7 dias de <em>garantia</em></h3>
          <p className="ape-note" style={{ margin: 0 }}>Comprou e não era o que esperava? Em até 7 dias depois do pagamento você pede o dinheiro de volta pelo WhatsApp (art. 49 do Código de Defesa do Consumidor).</p>
        </div>
      </section>
      <section className="ape-faq" id="loja-duvidas">
        <h3 className="ape-sec-t">dúvidas <em>frequentes</em></h3>
        {[
          ['Serve para casa? E para apê de outro tamanho?', 'Serve. Os materiais foram pensados para casa ou apê de qualquer tamanho; quando aparece um exemplo com medidas, é de um apê de 40 m², e você troca pelos seus números.'],
          ['Como eu recebo os arquivos?', 'Assim que o Pix ou o cartão é confirmado, a página do pedido mostra os botões de baixar. O link fica guardado para baixar de novo depois.'],
          ['Abre no celular?', 'Sim. Os PDFs abrem no celular, no tablet e no computador (e dá para imprimir). As planilhas abrem no Excel e no Google Planilhas, também pelo celular.'],
          ['Posso pagar no cartão?', 'Pode: Pix ou cartão de crédito, em até 3x sem juros a partir de R$ 60.'],
          ['Como funciona o desconto?', 'Ele é automático: com 2 arquivos avulsos no carrinho você ganha 10%, com 3 ganha 15%, com 4 ganha 20% e com 6 ou mais, 25%. Os kits já têm preço fechado, ainda menor.'],
          ['Posso compartilhar com quem mora comigo?', 'Pode usar com a sua família, na sua casa. O que não pode é repassar, revender ou postar os arquivos.'],
          ['Substitui um profissional?', 'Não. São guias práticos para você se organizar e não errar no básico. Para obra, contrato e financiamento, conte com profissionais e com o seu banco.'],
        ].map(([q, r]) => (
          <details key={q} className="ape-faq-i">
            <summary>{q}<ApeIcon name="chev" /></summary>
            <p>{r}</p>
          </details>
        ))}
      </section>

      <section className="ape-final">
        <div>
          <h3>comece pelo <em>kit completo</em></h3>
          <p>{kitTop ? `${(kitTop.combo || []).length} arquivos, da compra à decoração, por ${kitTop.preco}.` : 'Todos os arquivos, da compra à decoração.'}</p>
        </div>
        {kitTop && (
          <button className="ape-btn" onClick={() => adicionar(kitTop)}>
            <ApeIcon name="plus" />
            {cart.tem(kitTop.id) ? 'no carrinho' : 'adicionar ao carrinho'}
          </button>
        )}
      </section>
      <MeusPedidos />
      <p className="ape-note" style={{ textAlign: 'center', margin: 0 }}>
        dúvida? <a href={wa(whats, `Oi! Tenho uma dúvida sobre a loja do planê.apê.`)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--a-pri)', fontWeight: 600 }}>fale no WhatsApp</a>
      </p>
      {cart.ids.length > 0 && !verCarrinho && (
        <button className="ape-cartfab" onClick={() => setVerCarrinho(true)}>
          <ApeIcon name="bag" />
          <span>
            {tot.itens.length} {tot.itens.length > 1 ? 'itens' : 'item'} · <b>{brl(tot.total)}</b>
            {tot.pct ? <em> −{tot.pct}%</em> : null}
          </span>
          <b className="go">ver carrinho</b>
        </button>
      )}
      {aberto && <Detalhe p={aberto} byId={byId} me={me} whats={whats} onClose={() => setAberto(null)} onOpen={setAberto} cart={cart} onAdd={(p) => { adicionar(p); setAberto(null) }} tiers={tiers} produtos={produtos} />}
      {verCarrinho && <CarrinhoSheet produtos={produtos} tiers={tiers} cart={cart} me={me} whats={whats} onClose={() => setVerCarrinho(false)} onAdd={adicionar} onOpen={(p) => { setVerCarrinho(false); setAberto(p) }} />}
      {toast}
    </>
  )
}

/* plataforma do apê: uma seção grande, que explica tudo */
function PlataformaSec({ p, cart, onAdd, me, whats }: { p: Produto; cart: Carrinho; onAdd: (p: Produto) => void; me: Morador | null; whats: string }) {
  const recursos: [string, string, string][] = [
    ['planilha', 'gastos por cômodo', 'Quanto planejou, quanto já gastou e quanto falta, com as notas de cada compra.'],
    ['calculo', 'parcelas do mês', 'Todas as parcelas somadas mês a mês, para não ter surpresa no cartão.'],
    ['projeto3d', 'obra passo a passo', 'As etapas na ordem certa, com datas, fornecedor e o que já foi feito.'],
    ['vistoria', 'vistoria com fotos', 'Marque cada item, tire fotos dos problemas e gere o resumo para a construtora.'],
    ['grupo', 'contatos da obra', 'Fornecedores e prestadores com WhatsApp a um toque.'],
    ['celular', 'celular e computador', 'É um site: abre em qualquer aparelho, sem instalar nada.'],
  ]
  return (
    <section className="ape-plat" id="loja-plataforma">
      <div className="ape-plat-head">
        <p className="ape-eyebrow">plataforma do apê</p>
        <h3 className="ape-sec-t">a sua casa toda organizada <em>num lugar só</em></h3>
        <p className="ape-lead">Um site para acompanhar a compra, a obra e a mudança da sua casa ou apê: gastos, parcelas, obra, vistoria e contatos, no celular e no computador.</p>
      </div>
      <div className="ape-plat-grid">
        <img src="ape/amostras/m-plataforma.jpg" alt="Telas de exemplo da plataforma do apê: gastos, obra passo a passo e vistoria com fotos" loading="lazy" />
        <div className="ape-plat-feats">
          {recursos.map(([a, t, d]) => (
            <div key={t} className="ape-plat-f">
              <ApeArt name={a} size={40} />
              <span><b>{t}</b>{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ape-plat-buy">
        <div>
          <span className="ape-note">acesso por 12 meses</span>
          <div className="ape-price">{p.preco}<small> por ano</small></div>
          <span className="ape-pill azul ape-keep">pagamento único · sem mensalidade</span>
        </div>
        <ol className="ape-plat-steps">
          <li><b>1</b>Você paga uma vez (Pix ou cartão)</li>
          <li><b>2</b>Recebe o acesso no WhatsApp em até 24 h</li>
          <li><b>3</b>Usa no celular e no computador por 1 ano</li>
        </ol>
        <BotaoCompra p={p} cart={cart} onAdd={onAdd} me={me} whats={whats} />
      </div>
      <span className="ape-note">Telas ilustrativas.</span>
    </section>
  )
}

const somaAvulsos = (p: Produto, byId: (id: string) => Produto | undefined) => (p.combo || []).reduce((t, id) => t + (reais(byId(id)?.preco) || 0), 0)

function Preco({ p, byId }: { p: Produto; byId: (id: string) => Produto | undefined }) {
  const soma = somaAvulsos(p, byId)
  const eco = p.combo?.length ? Math.max(0, soma - reais(p.preco)) : 0
  const de = p.combo?.length && soma ? brl(soma) : p.preco_de && /^R\$/.test(p.preco_de) && /^R\$/.test(p.preco) && !p.unidade ? p.preco_de : ''
  return (
    <div className="ape-price">
      {de && <s className="ape-de">{de}{p.combo?.length ? " separados" : ""}</s>}
      {p.preco ? (
        <>
          {p.preco}
          {p.unidade && <small> {p.unidade}</small>}
        </>
      ) : (
        <small>valor sob consulta</small>
      )}
      {p.preco_de && p.unidade && <span className="ape-note" style={{ display: 'block' }}>ou {p.preco_de}</span>}
      {eco > 0 && <span className="ape-pill rosa ape-keep" style={{ display: 'table', marginTop: 6 }}>economize {brl(eco)} ({Math.round((eco / soma) * 100)}%)</span>}
    </div>
  )
}

function BotaoCompra({ p, cart, onAdd, me, whats, wide = true }: { p: Produto; cart: Carrinho; onAdd: (p: Produto) => void; me: Morador | null; whats: string; wide?: boolean }) {
  if (!noCarrinho(p))
    return (
      <a className={`ape-btn primary ${wide ? 'wide' : ''}`} href={wa(whats, msgProduto(p, me))} target="_blank" rel="noopener noreferrer">
        <ApeIcon name="chat" />
        {p.cat === 'projeto' ? 'quero conversar' : 'quero'}
      </a>
    )
  return cart.tem(p.id) ? (
    <button className={`ape-btn rose ${wide ? 'wide' : ''}`} onClick={() => cart.remove(p.id)}>
      <ApeIcon name="check" />
      no carrinho
    </button>
  ) : (
    <button className={`ape-btn primary ${wide ? 'wide' : ''}`} onClick={() => onAdd(p)}>
      <ApeIcon name="plus" />
      adicionar
    </button>
  )
}

function ProdCard({ p, byId, onOpen, me, whats, cart, onAdd }: { p: Produto; byId: (id: string) => Produto | undefined; onOpen: () => void; me: Morador | null; whats: string; cart: Carrinho; onAdd: (p: Produto) => void; produtos: Produto[] }) {
  const img = p.amostras?.[0]
  return (
    <article className={`ape-prod ${p.destaque ? 'top' : ''}`}>
      <button className="ape-thumb" onClick={onOpen} aria-label={`Ver ${p.nome} por dentro`}>
        {p.combo?.length ? (
          <span className="ape-stack">
            {(p.amostras || []).slice(0, 3).map((a, i) => (
              <img key={a} src={a} alt="" loading="lazy" style={{ ['--i' as string]: i }} />
            ))}
          </span>
        ) : img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <span className="ape-thumb-ic"><ApeIcon name="chat" size={34} /></span>
        )}
        <span className="ape-ver"><ApeIcon name="eye" />ver por dentro</span>
      </button>
      <div className="ape-prod-h">
        {p.arte && <ApeArt name={p.arte} size={40} tone={p.cat === 'combos' ? 'sec' : 'pri'} />}
        <h3>{p.nome}</h3>
      </div>
      <div className="ape-tags">
        {p.tag && <span className={`ape-pill ${p.destaque ? 'azul' : 'terra'}`}>{p.tag}</span>}
        {(p.numeros || []).slice(0, 2).map((n) => <span key={n} className="ape-pill ape-keep">{n}</span>)}
        {!p.numeros?.length && p.formato && <span className="ape-pill ape-keep">{p.formato.split(' · ')[0]}</span>}
      </div>
      <p>{p.desc}</p>
      {p.combo?.length ? (
        <ul className="ape-inc">
          {p.combo.map((id) => byId(id)).filter(Boolean).map((x) => (
            <li key={x!.id}><ApeIcon name="check" />{x!.nome}</li>
          ))}
          {(p.itens || []).map((x) => (
            <li key={x}><ApeIcon name="plus" />{x.replace(/^\+\s*/, '')}</li>
          ))}
        </ul>
      ) : null}
      <Preco p={p} byId={byId} />
      <div className="ape-acts">
        <button className="ape-btn wide" onClick={onOpen}>ver detalhes</button>
        <BotaoCompra p={p} cart={cart} onAdd={onAdd} me={me} whats={whats} />
      </div>
    </article>
  )
}

/* explicação visual de cada área (com as imagens de exemplo) */
function Vitrine({ cat }: { cat: Categoria }) {
  if (cat === 'plataforma')
    return (
      <div className="ape-vit">
        <img src="ape/amostras/m-plataforma.jpg" alt="Telas de exemplo da plataforma do apê: gastos, obra passo a passo e vistoria com fotos" loading="lazy" />
        <div className="ape-vit-t">
          <b>como funciona</b>
          <ul className="ape-inc">
            <li><ApeIcon name="check" />Você anota cada compra e a plataforma soma tudo por cômodo</li>
            <li><ApeIcon name="check" />As parcelas aparecem mês a mês, sem surpresa no cartão</li>
            <li><ApeIcon name="check" />A obra fica em etapas, com data e o que já foi feito</li>
            <li><ApeIcon name="check" />Na vistoria, você marca os itens, tira fotos e gera o resumo</li>
          </ul>
          <span className="ape-note">Telas ilustrativas.</span>
        </div>
      </div>
    )
  return (
    <div className="ape-vit">
      <img src="ape/amostras/m-projeto.jpg" alt="Imagem 3D de um projeto de apê compacto: cozinha azul, parede terracota e mesa de jantar" loading="lazy" />
      <div className="ape-vit-t">
        <b>exemplo real: um apê de {APE.meuApe}</b>
        <ul className="ape-inc">
          <li><ApeIcon name="check" />Marcenaria azul na cozinha, parede terracota e piso em espinha de peixe</li>
          <li><ApeIcon name="check" />Mesa de jantar no lugar certo, sem atrapalhar a passagem</li>
          <li><ApeIcon name="check" />Tudo nas medidas do apê</li>
        </ul>
        <span className="ape-note">Projeto feito para um apê do {APE.condominio}.</span>
      </div>
    </div>
  )
}

function Detalhe({ p, byId, me, whats, onClose, onOpen, cart, onAdd, tiers, produtos }: { p: Produto; byId: (id: string) => Produto | undefined; me: Morador | null; whats: string; onClose: () => void; onOpen: (p: Produto) => void; cart: Carrinho; onAdd: (p: Produto) => void; tiers: [number, number][]; produtos: Produto[] }) {
  const [i, setI] = useState(0)
  const imgs = p.amostras || []
  useEffect(() => {
    setI(0)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [p, onClose])
  const filhos = (p.combo || []).map(byId).filter((x): x is Produto => !!x)
  const kit = p.cat !== 'combos' && noCarrinho(p) ? produtos.find((k) => k.ativo && k.cat === 'combos' && (k.combo || []).includes(p.id) && k.destaque) : undefined
  return (
    <div className="ape-sheet" role="dialog" aria-modal="true" aria-label={p.nome} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ape-sheet-in">
        <button className="ape-x" onClick={onClose} aria-label="Fechar"><ApeIcon name="x" /></button>
        {imgs.length > 0 && (
          <div className="ape-gal" onContextMenu={(e) => e.preventDefault()}>
            <img src={imgs[i]} alt={`${p.nome}: prévia ${i + 1}`} draggable={false} />
            {imgs.length > 1 && (
              <div className="ape-dotsn">
                {imgs.map((_, j) => (
                  <button key={j} aria-label={`Prévia ${j + 1}`} aria-pressed={i === j} onClick={() => setI(j)} />
                ))}
              </div>
            )}
          </div>
        )}
        <div className="ape-sheet-b">
          <div className="ape-tags">{p.tag && <span className="ape-pill azul">{p.tag}</span>}</div>
          <h2 className="ape-h2">{p.nome}</h2>
          <p style={{ margin: 0, color: 'var(--a-muted)' }}>{p.desc}</p>
          {(p.numeros || []).length > 0 && (
            <div className="ape-nums">
              {p.numeros!.map((n) => <span key={n}>{n}</span>)}
            </div>
          )}
          {filhos.length > 0 && (
            <div className="ape-rows">
              {filhos.map((x) => (
                <button key={x.id} className="ape-row ape-row-btn" onClick={() => onOpen(x)}>
                  <span className="t"><b>{x.nome}</b><span>{(x.numeros || []).join(' · ') || x.formato}</span></span>
                  <span className="r"><s className="ape-note">{x.preco}</s></span>
                </button>
              ))}
            </div>
          )}
          {(p.itens || []).length > 0 && (
            <>
              <p className="ape-eyebrow" style={{ marginTop: 6 }}>{filhos.length ? 'e ainda' : 'o que tem dentro'}</p>
              <ul className="ape-inc">
                {p.itens!.map((x) => (
                  <li key={x}><ApeIcon name="check" />{x.replace(/^\+\s*/, '')}</li>
                ))}
              </ul>
            </>
          )}
          <dl className="ape-facts">
            {p.formato && (<><dt>formato</dt><dd>{p.formato}</dd></>)}
            {p.entrega && (<><dt>como recebo</dt><dd>{p.entrega}</dd></>)}
            {noCarrinho(p) && (<><dt>garantia</dt><dd>7 dias: se não gostar, devolvemos o valor.</dd></>)}
          </dl>
          <Preco p={p} byId={byId} />
          {p.cat === 'arquivos' && <span className="ape-note">Leve junto com outros arquivos: {faixas(tiers).join(' · ')}.</span>}
          <div className="ape-acts">
            <BotaoCompra p={p} cart={cart} onAdd={onAdd} me={me} whats={whats} />
          </div>
          {kit && !cart.tem(kit.id) && (
            <button className="ape-upsell" onClick={() => onOpen(kit)}>
              <ApeIcon name="gift" />
              <span>
                <b>Este arquivo também vem no {kit.nome}</b>
                <span>{(kit.combo || []).length} arquivos por {kit.preco}: ver o kit</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CarrinhoSheet({ produtos, tiers, cart, onClose, onAdd, onOpen }: { produtos: Produto[]; tiers: [number, number][]; cart: Carrinho; me?: Morador | null; whats?: string; onClose: () => void; onAdd: (p: Produto) => void; onOpen: (p: Produto) => void }) {
  const t = conta(cart.ids, produtos, tiers)
  useEffect(() => {
    // arquivo que já está num kit do carrinho sai sozinho
    t.repetidos.forEach((id) => cart.remove(id))
  }, [t.repetidos.join()])
  const noKit = new Set(t.itens.flatMap((p) => p.combo || []))
  const sugestoes = produtos.filter((p) => p.ativo && p.cat === 'arquivos' && !cart.tem(p.id) && !noKit.has(p.id)).sort((a, b) => reais(a.preco) - reais(b.preco)).slice(0, 3)
  const kit = produtos.find((p) => p.ativo && p.cat === 'combos' && p.destaque)
  const kitVale = kit && !cart.tem(kit.id) && t.total >= reais(kit.preco) * 0.8
  return (
    <div className="ape-sheet" role="dialog" aria-modal="true" aria-label="Carrinho" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ape-sheet-in">
        <button className="ape-x" onClick={onClose} aria-label="Fechar"><ApeIcon name="x" /></button>
        <div className="ape-sheet-b">
          <p className="ape-eyebrow">seu carrinho</p>
          {!t.itens.length ? (
            <div className="ape-empty"><b>carrinho vazio</b><span>Adicione arquivos ou um kit.</span></div>
          ) : (
            <>
              <div className="ape-rows">
                {t.itens.map((p) => (
                  <div key={p.id} className="ape-row ape-cart-row">
                    <button className="t ape-linkish" onClick={() => onOpen(p)}>
                      <b>{p.nome}</b>
                      <span>{p.cat === 'combos' ? `kit com ${(p.combo || []).length} arquivos` : (p.numeros || []).slice(0, 2).join(' · ')}</span>
                    </button>
                    <div className="r">
                      <b className="num">{p.preco}</b>
                      <button className="ape-btn ghost sm" onClick={() => cart.remove(p.id)} aria-label={`Tirar ${p.nome}`}><ApeIcon name="trash" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="ape-meta">
                <div className="ape-meta-t">
                  <span><ApeIcon name="tag" /> {t.pct ? `${t.pct}% de desconto nos arquivos` : 'leve 2 ou mais arquivos e ganhe desconto'}</span>
                  {t.prox && <b>falta{t.prox[0] - t.avulsos > 1 ? 'm' : ''} {t.prox[0] - t.avulsos} para −{t.prox[1]}%</b>}
                </div>
                <div className="ape-bar"><i style={{ width: `${Math.min(100, (t.avulsos / tiers[tiers.length - 1][0]) * 100)}%` }} /></div>
              </div>
              {sugestoes.length > 0 && t.prox && (
                <div className="ape-sug">
                  <span className="ape-note">aproveite e leve também:</span>
                  {sugestoes.map((p) => (
                    <button key={p.id} className="ape-sug-i" onClick={() => onAdd(p)}>
                      <img src={p.amostras?.[0]} alt="" />
                      <span><b>{p.nome}</b><span>{p.preco}</span></span>
                      <ApeIcon name="plus" />
                    </button>
                  ))}
                </div>
              )}
              {kitVale && kit && (
                <button className="ape-upsell" onClick={() => { (kit.combo || []).forEach((id) => cart.remove(id)); onAdd(kit) }}>
                  <ApeIcon name="gift" />
                  <span>
                    <b>Troque pelo {kit.nome} por {kit.preco}</b>
                    <span>Leva os {(kit.combo || []).length} arquivos da loja{t.total < reais(kit.preco) ? ` por só ${brl(reais(kit.preco) - t.total)} a mais` : ` e paga ${brl(t.total - reais(kit.preco))} a menos`}</span>
                  </span>
                </button>
              )}
              <dl className="ape-facts ape-totais">
                <dt>subtotal</dt><dd className="num">{brl(t.subtotal)}</dd>
                {t.desconto > 0 && (<><dt>desconto ({t.pct}%)</dt><dd className="num">−{brl(t.desconto)}</dd></>)}
                <dt><b>total</b></dt><dd className="num"><b>{brl(t.total)}</b></dd>
              </dl>
              <a className="ape-btn primary" href={href('ape', 'checkout')} onClick={onClose}>
                <ApeIcon name="shield" />
                finalizar compra · {brl(t.total)}
              </a>
              <p className="ape-note" style={{ margin: 0, textAlign: 'center' }}>Pix ou cartão{parcelasMax(t.total) > 1 ? ` em até ${parcelasMax(t.total)}x sem juros` : ''} · baixa na hora · 7 dias de garantia</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ===== checkout: igual ao do planê (passos à esquerda, resumo à direita), adaptado à loja ===== */
function Checkout({ produtos, tiers, me, whats }: { produtos: Produto[]; tiers: [number, number][]; me: Morador | null; whats: string }) {
  const cart = useCarrinho()
  const t = conta(cart.ids, produtos, tiers)
  const [nome, setNome] = useState(me?.nome || '')
  const [tel, setTel] = useState(me?.tel ? fmtTel(me.tel) : '')
  const [email, setEmail] = useState('')
  const [forma, setForma] = useState<'pix' | 'cartao'>('pix')
  const [aceite, setAceite] = useState(false)
  const [termos, setTermos] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const parc = parcelasMax(t.total)
  useEffect(() => {
    t.repetidos.forEach((id) => cart.remove(id))
  }, [t.repetidos.join()])
  const kit = produtos.find((p) => p.ativo && p.cat === 'combos' && p.destaque)
  const kitVale = kit && !cart.tem(kit.id) && t.itens.length > 0 && t.total >= reais(kit.preco) * 0.8
  const msgWhats = `Oi! Sou ${nome || me?.nome || 'uma pessoa que está montando o apê'}. Quero comprar:\n${t.itens.map((p) => `• ${p.nome} (${p.preco})`).join('\n')}${t.desconto ? `\nDesconto de ${t.pct}%: −${brl(t.desconto)}` : ''}\nTotal: ${brl(t.total)} no ${forma === 'cartao' ? 'cartão' : 'Pix'}`
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    const falta = [nome.trim().split(/\s+/).length < 2 && 'nome completo', digits(tel).length < 10 && 'WhatsApp com DDD', email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && 'e-mail válido', !aceite && 'aceite dos termos'].filter(Boolean)
    if (falta.length) return setErr(`Falta: ${falta.join(', ')}.`)
    setBusy(true)
    try {
      const r = await criarPedido({ itens: t.itens.map((p) => p.id), morador: me?.id, nome: nome.trim(), tel: digits(tel), email: email.trim(), forma, aceite: true })
      cart.limpar()
      window.location.href = r.url
    } catch (x) {
      setErr(`Não deu para abrir o pagamento agora (${(x as Error).message}). Você pode finalizar pelo WhatsApp.`)
      setBusy(false)
    }
  }
  if (!t.itens.length)
    return (
      <section className="ape-panel ape-empty">
        <ApeIcon name="bag" size={30} />
        <b>seu carrinho está vazio</b>
        <span>Escolha arquivos ou um kit na loja.</span>
        <a className="ape-btn primary" href={href('ape', 'loja')}>ir para a loja</a>
      </section>
    )
  return (
    <>
      <div className="ape-co-head">
        <div>
          <p className="ape-eyebrow"><ApeIcon name="shield" /> compra segura</p>
          <h2 className="ape-h2">finalizar <em>compra</em></h2>
        </div>
        <a className="ape-btn ghost" href={href('ape', 'loja')}>voltar para a loja</a>
      </div>
      <form className="ape-co" onSubmit={submit} noValidate>
        <div className="ape-co-steps">
          <CoStep n={1} title="seus itens">
            <div className="ape-rows">
              {t.itens.map((p) => (
                <div key={p.id} className="ape-row ape-cart-row">
                  <div className="t">
                    <b>{p.nome}</b>
                    <span>{p.cat === 'combos' ? `kit com ${(p.combo || []).length} arquivos` : (p.numeros || []).slice(0, 2).join(' · ')}</span>
                  </div>
                  <div className="r">
                    <b className="num">{p.preco}</b>
                    <button type="button" className="ape-btn ghost sm" onClick={() => cart.remove(p.id)} aria-label={`Tirar ${p.nome}`}><ApeIcon name="trash" /></button>
                  </div>
                </div>
              ))}
            </div>
            {t.prox && <p className="ape-note" style={{ margin: 0 }}>Com mais {t.prox[0] - t.avulsos} arquivo{t.prox[0] - t.avulsos > 1 ? 's' : ''}, o desconto vai para {t.prox[1]}%. <a href={href('ape', 'loja')} style={{ color: 'var(--a-pri)', fontWeight: 600 }}>escolher mais</a></p>}
            {kitVale && kit && (
              <button type="button" className="ape-upsell" onClick={() => { (kit.combo || []).forEach((id) => cart.remove(id)); cart.add(kit.id) }}>
                <ApeIcon name="gift" />
                <span>
                  <b>Troque pelo {kit.nome} por {kit.preco}</b>
                  <span>Leva os {(kit.combo || []).length} arquivos da loja{t.total < reais(kit.preco) ? ` por só ${brl(reais(kit.preco) - t.total)} a mais` : ` e paga ${brl(t.total - reais(kit.preco))} a menos`}</span>
                </span>
              </button>
            )}
          </CoStep>
          <CoStep n={2} title="seus dados">
            <div className="ape-frow">
              <div className="ape-f"><label htmlFor="co-nome">Nome completo *</label><input id="co-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></div>
              <div className="ape-f"><label htmlFor="co-tel">WhatsApp *</label><input id="co-tel" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} onBlur={() => setTel(fmtTel(tel))} autoComplete="tel" placeholder="(11) 90000-0000" /></div>
            </div>
            <div className="ape-f"><label htmlFor="co-email">E-mail</label><input id="co-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /><span className="ape-hint">Opcional. CPF e dados do cartão você coloca na página segura do Asaas, nunca aqui.</span></div>
          </CoStep>
          <CoStep n={3} title="forma de pagamento">
            <div className="ape-co-pay">
              {([
                ['pix', 'Pix', 'QR Code na hora; libera os arquivos em segundos', 'tag'],
                ['cartao', 'Cartão de crédito', parc > 1 ? `em até ${parc}x de ${brl(t.total / parc)} sem juros` : 'à vista no crédito', 'shield'],
              ] as const).map(([id, l, h, i]) => (
                <button type="button" key={id} className={forma === id ? 'on' : ''} aria-pressed={forma === id} onClick={() => setForma(id)}>
                  <ApeIcon name={i} />
                  <b>{l}{id === 'pix' && <em>mais rápido</em>}</b>
                  <small>{h}</small>
                </button>
              ))}
            </div>
          </CoStep>
          <CoStep n={4} title="confirmar">
            <label className="ape-co-agree">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
              <span>
                li e aceito os{' '}
                <button type="button" className="ape-linkish" style={{ color: 'var(--a-pri)', fontWeight: 600, display: 'inline' }} onClick={() => setTermos(true)}>termos da compra</button>{' '}
                (uso pessoal, não repassar os arquivos).
              </span>
            </label>
            <p className="ape-note" style={{ margin: 0 }}><ApeIcon name="check" /> Se se arrepender, você tem 7 dias depois do pagamento para pedir o dinheiro de volta (art. 49 do Código de Defesa do Consumidor).</p>
            {err && <p className="ape-err" role="alert">{err}</p>}
            <button className="ape-btn primary ape-co-submit" type="submit" disabled={busy}>
              {busy ? 'abrindo o pagamento…' : <>pagar <span className="ape-keep">{brl(t.total)}</span> {forma === 'pix' ? 'no Pix' : parc > 1 ? `em até ${parc}x no cartão` : 'no cartão'}</>}
            </button>
            {err && (
              <a className="ape-btn" href={wa(whats, msgWhats)} target="_blank" rel="noopener noreferrer">
                <ApeIcon name="chat" />
                finalizar pelo WhatsApp
              </a>
            )}
          </CoStep>
        </div>
        <aside className="ape-panel ape-co-sum">
          <p className="ape-eyebrow">resumo do pedido</p>
          {t.itens.map((p) => (
            <div key={p.id} className="ape-co-line">
              <span>{p.nome}{p.cat === 'combos' ? <small> · kit</small> : null}</span>
              <span className="num">{p.preco}</span>
            </div>
          ))}
          {t.desconto > 0 && (
            <div className="ape-co-line ape-co-off">
              <span>desconto de {t.pct}% ({t.avulsos} arquivos)</span>
              <span className="num">−{brl(t.desconto)}</span>
            </div>
          )}
          <div className="ape-co-line ape-co-total">
            <span>total</span>
            <b className="num">{brl(t.total)}</b>
          </div>
          {forma === 'cartao' && parc > 1 && <p className="ape-note" style={{ margin: 0 }}>ou {parc}x de {brl(t.total / parc)} sem juros</p>}
          <ul className="ape-inc">
            <li><ApeIcon name="download" />baixa na hora, depois do pagamento</li>
            <li><ApeIcon name="check" />link guardado para baixar de novo</li>
            <li><ApeIcon name="shield" />pagamento processado pelo Asaas</li>
          </ul>
          <p className="ape-co-secure"><ApeIcon name="shield" /> compra segura · 7 dias de garantia</p>
        </aside>
      </form>
      {termos && <TermosLoja onClose={() => setTermos(false)} onAccept={() => { setAceite(true); setTermos(false) }} />}
    </>
  )
}

function CoStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="ape-panel ape-co-step">
      <header>
        <span>{n}</span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  )
}

function TermosLoja({ onClose, onAccept }: { onClose: () => void; onAccept: () => void }) {
  return (
    <div className="ape-sheet" role="dialog" aria-modal="true" aria-label="Termos da compra" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ape-sheet-in">
        <button className="ape-x" onClick={onClose} aria-label="Fechar"><ApeIcon name="x" /></button>
        <div className="ape-sheet-b">
          <h2 className="ape-h2">termos da <em>compra</em></h2>
          <ol className="ape-termos">
            <li><b>O que você compra.</b> Arquivos digitais (PDF e planilhas) para uso pessoal, no seu apê. A entrega é pelo botão de baixar que aparece depois que o pagamento é confirmado.</li>
            <li><b>Uso pessoal.</b> Os arquivos não podem ser revendidos, repassados, publicados ou compartilhados em grupos. Indique a página para quem quiser também.</li>
            <li><b>Conteúdo informativo.</b> Os materiais são guias práticos. Não substituem a avaliação de um profissional habilitado (arquiteto ou engenheiro) nem as orientações da construtora e do manual do proprietário.</li>
            <li><b>Pagamento.</b> Pix ou cartão, processado pelo Asaas. Os dados do cartão são digitados só na página segura do Asaas.</li>
            <li><b>Arrependimento.</b> Você pode pedir o dinheiro de volta em até 7 dias depois do pagamento (art. 49 do Código de Defesa do Consumidor), pelo WhatsApp.</li>
            <li><b>Problemas para baixar.</b> Fale no WhatsApp: enviamos os arquivos por lá.</li>
          </ol>
          <button className="ape-btn primary" onClick={onAccept}>li e aceito</button>
        </div>
      </div>
    </div>
  )
}

function MeusPedidos() {
  const l = pedidosLocais()
  if (!l.length) return null
  return (
    <section className="ape-panel">
      <p className="ape-eyebrow">suas compras</p>
      <div className="ape-rows">
        {l.slice(0, 5).map((p) => (
          <a key={p.token} className="ape-row" href={href('ape', `pedido:${p.token}`)}>
            <span className="t"><b>Pedido de {dmy(p.criado)}</b><span>{brl(p.total)}</span></span>
            <span className="r"><span className="ape-pill azul"><ApeIcon name="download" />baixar</span></span>
          </a>
        ))}
      </div>
    </section>
  )
}

function PedidoPage({ token, whats }: { token: string; whats: string }) {
  const [p, setP] = useState<Awaited<ReturnType<typeof verPedido>> | undefined>(undefined)
  useEffect(() => {
    let vivo = true
    let n = 0
    const load = () =>
      verPedido(token).then((r) => {
        if (!vivo) return
        setP(r)
        // pagamento ainda não confirmou: confere de novo por uns minutos
        if (r && r.status === 'pendente' && n++ < 36) window.setTimeout(load, 5000)
      })
    void load()
    return () => {
      vivo = false
    }
  }, [token])
  if (p === undefined) return <section className="ape-panel ape-empty"><span className="ape-thinking"><span className="ape-dots"><i /><i /><i /></span>conferindo o pagamento…</span></section>
  if (p === null)
    return (
      <section className="ape-panel ape-empty">
        <b>pedido não encontrado</b>
        <span>Confira o link ou fale no WhatsApp.</span>
        <a className="ape-btn" href={wa(whats, `Oi! Fiz uma compra na loja do apê e não estou achando meu pedido (${token.slice(0, 8)}).`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />falar no WhatsApp</a>
      </section>
    )
  if (p.status !== 'pago')
    return (
      <section className="ape-panel ape-done">
        <ApeIcon name="clock" />
        <h2 className="ape-h2">aguardando o <em>pagamento</em></h2>
        <p className="ape-note" style={{ maxWidth: '46ch', margin: 0 }}>Assim que o Pix ou o cartão for confirmado, os arquivos aparecem aqui. Esta página confere sozinha a cada poucos segundos. Pode deixar aberta.</p>
        <ol className="ape-psteps">
          <li className="ok"><i /><span><b>pedido enviado</b>com os seus dados</span></li>
          <li><i /><span><b>pagamento</b>Pix ou cartão, na página segura do Asaas</span></li>
          <li><i /><span><b>arquivos liberados</b>os botões de baixar aparecem aqui</span></li>
        </ol>
        <span className="ape-pill">{p.itens.map((i) => i.nome).join(' + ')} · {brl(Number(p.total))}</span>
      </section>
    )
  return (
    <section className="ape-panel ape-form">
      <div className="ape-done" style={{ padding: 0 }}>
        <ApeIcon name="check" />
        <h2 className="ape-h2">pagamento <em>confirmado!</em></h2>
        <p className="ape-note" style={{ margin: 0 }}>Obrigada{p.nome ? `, ${firstName(p.nome)}` : ''}! Baixe os seus arquivos. Guarde este link para baixar de novo depois.</p>
      </div>
      {p.arquivos?.length ? (
        <div className="ape-rows">
          {p.arquivos.map((a) => (
            <a key={a.url} className="ape-row" href={a.url} target="_blank" rel="noopener noreferrer">
              <span className="t"><b>{a.produto}</b><span>{a.nome}</span></span>
              <span className="r"><span className="ape-btn primary sm"><ApeIcon name="download" />baixar</span></span>
            </a>
          ))}
        </div>
      ) : (
        <div className="ape-banner warn">
          Os arquivos estão sendo preparados. Fale no WhatsApp que enviamos agora.
          <a className="ape-btn sm" href={wa(whats, `Oi! Paguei o pedido ${token.slice(0, 8)} (${p.itens.map((i) => i.nome).join(', ')}) e os arquivos não apareceram.`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      )}
    </section>
  )
}

/* ===== cadastro ===== */
function Cadastro({ me, onDone, onCancel }: { me: Morador | null; onDone: (m: Morador) => void; onCancel?: () => void }) {
  const [nome, setNome] = useState(me?.nome || '')
  const [sl, setSl] = useState(me ? ehSanLevi(me) : true)
  const [cond, setCond] = useState(me && !ehSanLevi(me) ? me.condominio || '' : '')
  const [torre, setTorre] = useState(me?.torre || '')
  const [ap, setAp] = useState(me?.ap || '')
  const [tel, setTel] = useState(me?.tel ? fmtTel(me.tel) : '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // mesmo apê com outro nome: pergunta se mora junto (mostra só o primeiro nome e a inicial)
  const [outros, setOutros] = useState<string[]>([])
  const [junto, setJunto] = useState<boolean | null>(me?.moraJunto ? true : null)
  useEffect(() => {
    if (!sl || !torre.trim() || !ap.trim()) return setOutros([])
    const t = window.setTimeout(() => {
      mesmoAp(torre, ap, me?.id).then((l) => {
        setOutros(l)
        if (!l.length) setJunto(null)
      }, () => setOutros([]))
    }, 500)
    return () => window.clearTimeout(t)
  }, [sl, torre, ap])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const m = { nome: nome.trim().replace(/\s+/g, ' '), condominio: sl ? APE.condominio : cond.trim(), torre: sl ? torre.trim() : '', ap: sl ? ap.trim() : '', tel: digits(tel), moraJunto: !!(outros.length && junto) }
    if (m.nome.split(' ').length < 2) return setErr('Coloque o nome completo.')
    if (sl && (!m.torre || !m.ap)) return setErr('Coloque a torre e o apê.')
    if (sl && outros.length && junto !== true) return setErr(junto === false ? 'Confira a torre e o apê.' : `Este apê já tem cadastro (${outros.join(', ')}). Confirme se você mora junto.`)
    if (m.tel.length < 10 || m.tel.length > 13) return setErr('Coloque o WhatsApp com DDD.')
    setErr('')
    setBusy(true)
    try {
      const id = await cadastrar({ ...m, id: me?.id })
      onDone({ ...m, id })
    } catch (e) {
      setErr(`Não deu para entrar agora (${(e as Error).message}). Confira a internet e tente de novo.`)
    }
    setBusy(false)
  }

  return (
    <div className="ape-gate" role="dialog" aria-modal="true" aria-labelledby="g-t">
      <form onSubmit={submit} noValidate>
        <h2 id="g-t">
          boas-vindas ao <em>planê.apê</em>
        </h2>
        <p>Os orçamentos são exclusivos dos moradores do {APE.condominio}. A loja do apê é aberta para todo mundo. Conte rapidinho quem é você: seus dados não aparecem na página.</p>
        <div className="ape-f">
          <label htmlFor="g-nome">Nome completo</label>
          <input id="g-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="ape-f">
          <label>Onde é o seu apê?</label>
          <div className="ape-seg" role="radiogroup">
            <button type="button" role="radio" aria-checked={sl} onClick={() => setSl(true)}>{APE.condominio} ({APE.construtora})</button>
            <button type="button" role="radio" aria-checked={!sl} onClick={() => setSl(false)}>outro lugar</button>
          </div>
        </div>
        {sl ? (
          <div className="ape-frow">
            <div className="ape-f">
              <label htmlFor="g-torre">Torre</label>
              <input id="g-torre" inputMode="numeric" value={torre} onChange={(e) => setTorre(e.target.value)} />
            </div>
            <div className="ape-f">
              <label htmlFor="g-ap">Apê</label>
              <input id="g-ap" inputMode="numeric" value={ap} onChange={(e) => setAp(e.target.value)} />
            </div>
          </div>
        ) : null}
        {sl && outros.length > 0 && (
          <div className="ape-junto" role="group" aria-label="Mesmo apê">
            <ApeArt name="grupo" size={40} tone="sec" />
            <div>
              <b>Este apê já tem cadastro: {outros.join(', ')}</b>
              <span>Você mora junto{outros.length > 1 ? ' com essas pessoas' : ''}?</span>
              <div className="ape-acts">
                <button type="button" className={`ape-btn sm ${junto === true ? 'primary' : ''}`} onClick={() => setJunto(true)}>sim, moro junto</button>
                <button type="button" className={`ape-btn sm ${junto === false ? 'rose' : ''}`} onClick={() => { setJunto(false); setAp('') }}>não, errei o apê</button>
              </div>
            </div>
          </div>
        )}
        {sl ? null : (
          <div className="ape-f">
            <label htmlFor="g-cond">Condomínio ou bairro (opcional)</label>
            <input id="g-cond" value={cond} onChange={(e) => setCond(e.target.value)} placeholder="Ex.: Residencial Jardim, Mooca" />
          </div>
        )}
        <div className="ape-f">
          <label htmlFor="g-tel">WhatsApp com DDD</label>
          <input id="g-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={tel} onChange={(e) => setTel(e.target.value)} onBlur={() => setTel(fmtTel(tel))} required />
        </div>
        {err && <p className="ape-err" role="alert">{err}</p>}
        <div className="ape-acts">
          <button className="ape-btn primary wide" type="submit" disabled={busy}>
            {busy ? 'entrando…' : 'entrar'}
          </button>
          {onCancel && (
            <button className="ape-btn ghost" type="button" onClick={onCancel}>cancelar</button>
          )}
        </div>
      </form>
    </div>
  )
}
