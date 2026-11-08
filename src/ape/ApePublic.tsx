import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { href, useRoute } from '../router'
import { cadastrar, nomeLocal, codigoSL, escolher, euMorador, mesmoAp, loadPublico, moradorConta, queroGrupo, sairGrupo, condicaoGrupo, souDona, apeCloud, type Publico } from './api'
import { ApeArt } from './ApeArt'
import { ApeIcon } from './ApeIcon'
import {
  APE, GRUPO_META, CTA_BY, CTA_COPY, NICHOS, SORTS, analyze, brl, calc, digits, dmy, firstName, fmtTel, msgFornecedor, msgGrupo, nicho, num, pct, wa, waNum, whyTop,
  ehSanLevi, ehOrcamento, ondeMora, plantaDoAp, plantaDe, acabamentoDe, PLANTA_ROT, type Analise, type Item, type Morador, type Nicho, type Orcamento, type Produto, type Sort,
} from './model'
import { BotaoCarrinho, MenuConta, Voltar } from './Navega'
import { SanLeviArte } from './SanLevi'
import { ehPet, MembroIcone, rotuloMembro, type TipoMembro } from './Familia'
import { Assinatura, AvisoCookies, MARK_SVG, mascaraTel, read, useCarrinho, useToast, write } from './shared'
import { Checkout, Loja, PedidoPage } from './Loja'
import { Enviar } from './Enviar'
import { Plataforma } from './Plataforma'
import { Comparar, Original } from './Comparar'
import { Conta } from './Conta'
import './ape.css'

/* Página pública do planê.apê: os moradores do San Levi se cadastram, comparam os orçamentos,
   mandam os seus e escolhem com quem fechar. A loja e a plataforma ficam em Loja.tsx e Plataforma.tsx. */

const CAD = 'ape-cadastro'
const UI = 'ape-ui'
const GRUPOS = 'ape-grupos'

type View = 'orcamentos' | 'enviar' | 'loja' | 'pedido' | 'checkout' | 'minha' | 'entrar' | 'conta'

export function ApePublic({ sub }: { sub?: string }) {
  const route = useRoute()
  const view: View = sub === 'enviar' ? 'enviar' : sub?.startsWith('loja') ? 'loja' : sub?.startsWith('pedido:') ? 'pedido' : sub === 'checkout' ? 'checkout' : sub?.startsWith('minha:') ? 'minha' : sub?.startsWith('entrar:') ? 'entrar' : sub?.startsWith('conta') ? 'conta' : 'orcamentos'
  const abrir = sub?.startsWith('loja:') ? sub.slice(5) : undefined
  const [d, setD] = useState<Publico | null | undefined>(undefined)
  const [owner, setOwner] = useState(false)
  const [me, setMe] = useState<Morador | null>(() => read<Morador>(CAD))
  const [editing, setEditing] = useState(false)
  const [toast, show] = useToast()

  useEffect(() => {
    document.title = `${APE.name} · do contrato às chaves`
    // "adicionar à tela de início" abre direto o planê.apê, com o ícone dele
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
  // link "usar em outro aparelho": guarda o cadastro neste aparelho e segue para os orçamentos
  useEffect(() => {
    if (view !== 'entrar') return
    void euMorador(sub!.slice(7)).then((m) => {
      if (m) {
        setMe(m)
        write(CAD, m)
        show(`Pronto, ${firstName(m.nome)}: este aparelho já está com o seu cadastro.`)
      } else show('Link de acesso inválido. Faça o cadastro de novo.')
      location.hash = '#/ape'
    })
  }, [view])
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

  const onCadastro = (m: Morador) => {
    setMe(m)
    write(CAD, m)
    setEditing(false)
  }

  if (view === 'minha') return <div className="ape"><Plataforma token={sub!.slice(6)} whats={whats} /></div>

  // loja, checkout e pedido: página de vendas aberta a todos; orçamentos e envio: só moradores do San Levi
  const publico = view === 'loja' || view === 'checkout' || view === 'pedido' || view === 'conta'
  const morador = !!me && ehSanLevi(me)
  // a dona vê os orçamentos sem cadastro; para ENVIAR, ela também precisa de um (vira moradora como os outros)
  const pedeCadastro = !publico && view !== 'entrar' && (editing || (!me && !(owner && view === 'orcamentos')))
  return (
    <div className={`ape ${publico ? 'ape-publico' : ''}`}>
      {publico ? (
        <ShopNav morador={morador || owner} owner={owner} nome={me?.nome || nomeLocal()} voltar={view !== 'loja'} />
      ) : (
        <header className="ape-top">
          <div className="wrap">
            <div className="ape-brand">
              <a className="ape-logo" href={href('ape')} aria-label={`${APE.name}: início`}>
                <span className="ape-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
                <div>
                  <h1>planê<span>.apê</span></h1>
                  <small>orçamentos do {APE.condominio} · só moradores</small>
                </div>
              </a>
              <div className="ape-top-r">
                {view !== 'orcamentos' && <Voltar para={href('ape')} />}
                <CarrinhoTopo />
                <MenuConta nome={me?.nome} owner={owner} morador={!!me && ehSanLevi(me)} so={['plataforma', 'conta']} extra={me ? [{ l: `meus dados${ondeMora(me) ? ` (${ehSanLevi(me) && me.torre ? `T${me.torre} · ${me.ap}` : ondeMora(me)})` : ''}`, i: 'edit', onClick: () => setEditing(true) }] : []} />
              </div>
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
            </nav>
          </div>
        </header>
      )}
      <main className="wrap ape-main">
        {d === undefined || view === 'entrar' ? (
          <div className="ape-panel ape-empty">
            <span className="ape-thinking">
              <span className="ape-dots"><i /><i /><i /></span>carregando…
            </span>
          </div>
        ) : d === null ? (
          <div className="ape-panel ape-empty">
            <b>a página não abriu</b>
            <span>Confira a internet e tente de novo em instantes.</span>
            <button className="ape-btn" onClick={() => void recarregar()}>tentar de novo</button>
          </div>
        ) : (view === 'orcamentos' || view === 'enviar') && d.pendente && me ? (
          <CodigoSL me={me} whats={whats} onOk={() => { const m = { ...me, aprovado: true }; setMe(m); write(CAD, m); void recarregar() }} />
        ) : view === 'orcamentos' ? (
          <Orcamentos vis={vis} d={d} owner={owner} me={me} whats={whats} show={show} onCount={(id, n) => setD({ ...d, contagens: { ...d.contagens, [id]: n } })} onEscolha={(id, _nicho, ficou) => {
            // pode escolher mais de um no mesmo serviço: marca ou desmarca só este
            const escolhas = { ...d.escolhas, [id]: Math.max(0, (d.escolhas[id] || 0) + (ficou ? 1 : -1)) }
            setD({ ...d, escolhas, minhas: ficou ? [...d.minhas.filter((x) => x !== id), id] : d.minhas.filter((x) => x !== id) })
          }} onEditar={() => setEditing(true)} onRecarregar={() => void recarregar()} />
        ) : view === 'enviar' ? (
          <Enviar me={me} whats={whats} orcamentos={vis} meusIds={d.meus} onPublicado={() => void recarregar()} onCadastro={() => setEditing(true)} />
        ) : view === 'checkout' ? (
          <Checkout ajustes={d.ajustes} me={me} whats={whats} />
        ) : view === 'conta' ? (
          <Conta sub={sub} whats={whats} />
        ) : view === 'pedido' ? (
          <PedidoPage token={sub!.slice(7)} whats={whats} produtos={d.ajustes.produtos} />
        ) : (
          <Loja key={abrir || 'loja'} ajustes={d.ajustes} me={me} whats={whats} abrir={abrir} />
        )}
        <Assinatura />
      </main>
      {(!publico || morador) && (
        <nav className="ape-bnav" aria-label="Seções">
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
            loja
          </a>
        </nav>
      )}
      {!publico && (
        <p className="ape-foot">
          Os orçamentos são enviados por quem está montando o apê e aparecem como foram recebidos. A página só organiza e compara: confira valores, prazos e condições direto com o fornecedor antes de fechar. Não temos vínculo com os fornecedores nem participamos das negociações.
        </p>
      )}
      <AvisoCookies />
      {pedeCadastro && <Cadastro me={me} owner={owner} onDone={onCadastro} onCancel={me ? () => setEditing(false) : owner ? () => { setEditing(false); location.hash = '#/ape' } : () => { location.hash = '#/ape/loja' }} />}
      {toast}
    </div>
  )
}

/* ===== área do San Levi fechada: código do condomínio ou aprovação da Laís ===== */
function CodigoSL({ me, whats, onOk }: { me: Morador; whats: string; onOk: () => void }) {
  const [cod, setCod] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    if (!cod.trim()) return setMsg('Digite o código.')
    setBusy(true)
    try {
      if (await codigoSL(me.id, cod)) onOk()
      else setMsg('Código não confere. Confira no grupo dos moradores.')
    } catch (x) {
      setMsg(String((x as Error).message))
    }
    setBusy(false)
  }
  return (
    <section className="ape-conta-login">
      <form className="ape-panel ape-form" onSubmit={entrar} noValidate>
        <ApeIcon name="shield" size={28} />
        <div>
          <p className="ape-eyebrow ape-eyebrow-sl"><SanLeviArte size={34} />área dos moradores do {APE.condominio}</p>
          <h2 className="ape-h2">falta o <em>código</em> do condomínio</h2>
          <p className="ape-note" style={{ margin: '4px 0 0' }}>Os orçamentos ficam só entre os vizinhos. Digite o código que a {APE.dona} passou no grupo dos moradores, ou peça para ela aprovar o seu cadastro (T{me.torre} · {me.ap}).</p>
        </div>
        <div className="ape-f"><label htmlFor="sl-cod">Código do condomínio</label><input id="sl-cod" value={cod} onChange={(e) => setCod(e.target.value)} autoComplete="off" /></div>
        {msg && <p className="ape-err" role="alert">{msg}</p>}
        <button className="ape-btn primary" type="submit" disabled={busy}>{busy ? 'conferindo…' : 'entrar'}</button>
        <a className="ape-btn" href={wa(whats, `Oi, ${APE.dona}! Sou ${me.nome}, T${me.torre} · ${me.ap} do ${APE.condominio}. Pode aprovar o meu cadastro nos orçamentos?`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />pedir aprovação no WhatsApp</a>
      </form>
    </section>
  )
}

/* ===== menu da página de vendas (loja aberta a todos) ===== */
function CarrinhoTopo() {
  const cart = useCarrinho()
  return <BotaoCarrinho n={cart.ids.length} />
}

function ShopNav({ morador, owner = false, nome, voltar }: { morador: boolean; owner?: boolean; nome?: string; voltar?: boolean }) {
  const cart = useCarrinho()
  const n = cart.ids.length
  const ir = (id: string) => {
    if (!location.hash.startsWith('#/ape/loja')) location.hash = '#/ape/loja'
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  return (
    <header className="ape-top ape-shopnav">
      <div className="wrap ape-brand">
        {voltar && <Voltar para={href('ape', 'loja')} />}
        <a className="ape-logo" href={href('ape', 'loja')} aria-label={`${APE.name}: loja`}>
          <span className="ape-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
          <div>
            <h1>planê<span>.apê</span></h1>
            <small>do contrato às chaves</small>
          </div>
        </a>
        <nav className="ape-shoplinks" aria-label="Loja">
          <button onClick={() => ir('loja-arquivos')}>arquivos</button>
          <button onClick={() => ir('loja-kits')}>kits</button>
          <button onClick={() => ir('loja-plataforma')}>plataforma</button>
          <button onClick={() => ir('loja-servicos')}>projetos</button>
        </nav>
        <MenuConta nome={nome} owner={owner} morador={morador} so={['sanlevi', 'plataforma', 'conta']} />
        <BotaoCarrinho n={n} />
      </div>
    </header>
  )
}

/* ===== orçamentos ===== */
function Orcamentos({ vis, d, owner, me, whats, show, onCount, onEscolha, onEditar }: { vis: Orcamento[]; d: Publico; owner: boolean; me: Morador | null; whats: string; show: (m: string) => void; onCount: (id: string, n: number) => void; onEscolha: (id: string, nicho: string, ficou: boolean) => void; onEditar: () => void; onRecarregar?: () => void }) {
  const saved = read<{ nicho?: string; sort?: Sort; validos?: boolean; vista?: 'blocos' | 'lista' }>(UI) || {}
  const [filtro, setFiltro] = useState(saved.nicho || 'todos')
  const [sort, setSort] = useState<Sort>(saved.sort && SORTS[saved.sort] ? saved.sort : 'compensa')
  const [validos, setValidos] = useState(!!saved.validos)
  const minhaPlanta = plantaDoAp(me?.ap)
  const [pl, setPl] = useState<'todas' | 'canto' | 'corredor'>('todas')
  const [q, setQ] = useState('')
  const [vista, setVista] = useState<'blocos' | 'lista'>(saved.vista === 'blocos' ? 'blocos' : 'lista')
  const [filtros, setFiltros] = useState(false)
  useEffect(() => {
    write(UI, { nicho: filtro, sort, validos, vista })
  }, [filtro, sort, validos, vista])

  const counts: Record<string, number> = {}
  for (const o of vis) counts[o.nicho] = (counts[o.nicho] || 0) + 1
  const nf = filtro !== 'todos' && !counts[filtro] ? 'todos' : filtro
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
            <p>Aqui os futuros moradores do {APE.condominio} comparam os orçamentos que receberam e escolhem com quem fechar. Se você é de outro lugar, a loja do apê é para você: checklists, planilhas e guias para quem está montando o apê.</p>
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
            <h2>todos os orçamentos do grupo, <em>organizados</em></h2>
            <p>Os orçamentos ficavam espalhados no grupo. Aqui eles ficam em pastas por serviço, do jeito que foram recebidos, e todo mundo compara lado a lado. Comece mandando o seu.</p>
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
  if (pl !== 'todas') list = list.filter((o) => { const x = plantaDe(o).p; return !x || x === pl })
  const groups = NICHOS.map((n) => n[0]).filter((id) => list.some((o) => o.nicho === id))
  let ctaDone = false

  return (
    <>
      {owner && exemplos > 0 && (
        <div className="ape-banner warn">
          Os cartões marcados como <b>exemplo</b> e os ocultos só aparecem para você.
        </div>
      )}
      {!apeCloud && <div className="ape-banner">Prévia: os dados ficam só neste navegador e os orçamentos são de exemplo.</div>}
      <section className="ape-orc-hero">
        <div>
          <p className="ape-eyebrow">área dos moradores do {APE.condominio}</p>
          <h2>todos os orçamentos do grupo, <em>organizados</em></h2>
          <p>Os orçamentos do grupo em pastas por serviço, como foram recebidos, para comparar e escolher com quem fechar.</p>
          <div className="ape-acts">
            <a className="ape-btn primary" href={href('ape', 'enviar')}><ApeIcon name="send" />mandar orçamento</a>
            <Compartilhar />
          </div>
        </div>
        <div className="ape-stats">
          <div className="ape-stat"><b className="num">{vis.filter(ehOrcamento).length}</b><span>orçamentos</span></div>
          <div className="ape-stat"><b className="num">{Object.keys(counts).length}</b><span>pastas</span></div>
          <div className="ape-stat"><b className="num">{vis.length - vis.filter(ehOrcamento).length}</b><span>contatos e tabelas</span></div>
        </div>
      </section>
      <div className="ape-pastas" role="group" aria-label="Pastas por serviço">
        <button className={`ape-pasta ${nf === 'todos' ? 'on' : ''}`} onClick={() => setFiltro('todos')}>
          <span className="ape-pasta-ic"><ApeIcon name="list" /></span>
          <b>todas</b>
          <small>{vis.length} {vis.length === 1 ? 'item' : 'itens'}</small>
        </button>
        {NICHOS.filter((n) => counts[n[0]]).map((n) => {
          const doN = vis.filter((o) => o.nicho === n[0] && ehOrcamento(o))
          const menor = Math.min(...doN.map((o) => calc(o).avista ?? Infinity))
          return (
            <button key={n[0]} className={`ape-pasta ${nf === n[0] ? 'on' : ''}`} onClick={() => setFiltro(n[0])}>
              <span className="ape-pasta-ic"><ApeIcon name={n[2]} /></span>
              <b>{n[1]}</b>
              <small>{counts[n[0]]} {counts[n[0]] === 1 ? 'item' : 'itens'}{Number.isFinite(menor) ? <> · desde <span className="ape-keep">{brl(menor)}</span></> : null}</small>
            </button>
          )
        })}
      </div>
      <div className="ape-toolbar ape-toolbar2">
        <label className="ape-search">
          <ApeIcon name="search" />
          <input type="search" placeholder="Buscar fornecedor ou item…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        </label>
        <button type="button" className={`ape-btn sm ape-filtros-btn ${filtros ? 'on' : ''}`} aria-expanded={filtros} onClick={() => setFiltros(!filtros)}><ApeIcon name="gear" />filtros{(pl !== 'todas' ? 1 : 0) + (validos ? 1 : 0) + (sort !== 'compensa' ? 1 : 0) ? <em>{(pl !== 'todas' ? 1 : 0) + (validos ? 1 : 0) + (sort !== 'compensa' ? 1 : 0)}</em> : null}</button>
        <div className="ape-vista" role="group" aria-label="Ver como">
          <button aria-pressed={vista === 'lista'} onClick={() => setVista('lista')} title="ver em lista" aria-label="ver em lista"><ApeIcon name="list" /></button>
          <button aria-pressed={vista === 'blocos'} onClick={() => setVista('blocos')} title="ver em blocos" aria-label="ver em blocos"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg></button>
        </div>
      </div>
      {filtros && (
        <div className="ape-panel ape-filtros">
          <div className="ape-filtros-l"><span>planta</span>
            <div className="ape-chips-l">{(['todas', 'canto', 'corredor'] as const).map((x) => <button key={x} className="ape-chip" aria-pressed={pl === x} onClick={() => setPl(x)}>{x}{x === minhaPlanta ? ' · a sua' : ''}</button>)}</div>
          </div>
          <div className="ape-filtros-l"><span>ordem</span>
            <select className="ape-sel" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar por">{Object.entries(SORTS).map(([k, x]) => <option key={k} value={k}>{x[0]}</option>)}</select>
          </div>
          <label className="ape-tog"><input type="checkbox" checked={validos} onChange={(e) => setValidos(e.target.checked)} /> só dentro da validade</label>
          <button type="button" className="ape-btn ghost sm" onClick={() => setFiltros(false)}>fechar</button>
        </div>
      )}
      <Entenda />
      <div className="ape-orc-lista" style={{ display: 'grid', gap: 26 }}>
        {!list.length && (
          <div className="ape-panel ape-empty">
            <b>nada por aqui</b>
            <span>Nenhum orçamento com esse filtro. Tente limpar a busca ou mostrar os vencidos.</span>
          </div>
        )}
        {groups.map((id, gi) => {
          const doServico = list.filter((o) => o.nicho === id)
          const extras = doServico.filter((o) => !ehOrcamento(o))
          const orcs = doServico.filter(ehOrcamento)
          const n = nicho(id)
          const showCta = !ctaDone && (gi === 0 || nf !== 'todos')
          if (showCta) ctaDone = true
          const fecharCom = async (o: Orcamento) => {
            if (!me?.id) return
            try {
              const r = await escolher(o.id, me.id, o.nicho)
              onEscolha(o.id, o.nicho, !!r)
              show(r ? `Anotado: você vai fechar com ${o.fornecedor}.` : 'Escolha desmarcada.')
            } catch {
              show('Não deu para salvar agora. Tente de novo.')
            }
          }
          const acabs = [...new Set(orcs.map(acabamentoDe))].sort((x, y) => (x ? 0 : 1) - (y ? 0 : 1) || x.localeCompare(y))
          const bloco = (lista: Orcamento[], titulo?: string) => {
            const a = analyze(lista)
            const sorted = [...a.items].sort(SORTS[sort][1])
            const top = sort === 'compensa' && a.top ? a.top : null
            const rest = top ? sorted.filter((x) => x !== top) : sorted
            const card = (x: Item, isTop: boolean) => <Card key={x.o.id} x={x} a={a} isTop={isTop} me={me} whats={whats} count={d.contagens[x.o.id] || 0} escolhas={d.escolhas[x.o.id] || 0} minha={d.minhas.includes(x.o.id)} show={show} onCount={onCount} onEscolha={onEscolha} />
            return (
              <div key={titulo || 'geral'} className="ape-acab">
                {titulo !== undefined && <h4 className="ape-acab-h"><ApeIcon name="tag" />{titulo || 'outros acabamentos'} <span>{lista.length} orçamento{lista.length > 1 ? 's' : ''}</span></h4>}
                <Comparar orcs={lista} me={me} minhas={d.minhas} onFechar={me?.id ? fecharCom : undefined} />
                {vista === 'lista' ? (
                  <div className="ape-linhas">{[...(top ? [top] : []), ...rest].map((x) => <Linha key={x.o.id} x={x} isTop={x === top} me={me}>{card(x, x === top)}</Linha>)}</div>
                ) : (
                  <div className="ape-grid">{[...(top ? [top] : []), ...rest].map((x) => card(x, x === top))}</div>
                )}
              </div>
            )
          }
          return (
            <div key={id} className="ape-orc-grupo" style={{ display: 'grid', gap: 18 }}>
              <section className="ape-nicho" aria-label={n.l}>
                <div className="ape-nhead">
                  <span className="ape-nic"><ApeIcon name={n.i} /></span>
                  <div>
                    <h3>{n.l}</h3>
                    <span className="ape-note">
                      {orcs.length ? `${orcs.length} orçamento${orcs.length > 1 ? 's' : ''}${acabs.length > 1 ? ` · ${acabs.length} acabamentos` : ''}` : 'ainda sem orçamento'}
                      {extras.length ? ` · ${extras.length} ${extras.length > 1 ? 'contatos e tabelas' : extras[0].tipo === 'tabela' ? 'tabela' : 'contato'}` : ''}
                    </span>
                  </div>
                </div>
                {acabs.length > 1 ? acabs.map((ac) => bloco(orcs.filter((o) => acabamentoDe(o) === ac), ac)) : orcs.length ? bloco(orcs) : null}
                {extras.length > 0 && <Contatos lista={extras} me={me} />}
              </section>
              {showCta && <Cta nicho={id} produtos={d.ajustes.produtos} me={me} whats={whats} />}
            </div>
          )
        })}
      </div>
    </>
  )
}

/* contatos de fornecedor e tabelas de preço: não entram no "mais compensa", ficam à mão para pedir orçamento */
function Contatos({ lista, me }: { lista: Orcamento[]; me: Morador | null }) {
  return (
    <div className="ape-contatos">
      <p className="ape-eyebrow">contatos e tabelas</p>
      <div className="ape-contatos-grid">
        {lista.map((o) => {
          const n = waNum(o.whatsapp || o.telefone)
          const ig = (o.instagram || '').replace(/^@/, '')
          return (
            <article key={o.id} className="ape-contato">
              <div className="t">
                <b>{o.fornecedor}</b>
                <span className={`ape-pill ${o.tipo === 'tabela' ? 'terra' : 'azul'}`}>{o.tipo === 'tabela' ? 'tabela de preços' : 'contato'}</span>
              </div>
              {o.resumo && <p>{o.resumo}</p>}
              {o.tipo === 'tabela' && (o.itens || []).length > 0 && (
                <ul className="ape-tabela">
                  {o.itens!.slice(0, 8).map((i, k) => <li key={k}><span>{i.descricao}{i.unidade ? ` (${i.unidade})` : ''}</span><b className="num">{i.valor != null ? brl(i.valor) : '—'}</b></li>)}
                </ul>
              )}
              <div className="ape-acts">
                {n && <a className="ape-btn sm primary" href={wa(n, `Oi! ${me ? `Sou ${me.nome}, ` : ''}vi o seu contato com os vizinhos do ${APE.condominio}. Pode me passar um orçamento de ${nicho(o.nicho).l.toLowerCase()}?`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />chamar no WhatsApp</a>}
                {ig && !/\s/.test(ig) && <a className="ape-btn sm" href={/^https?:/.test(o.instagram || '') ? o.instagram : `https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer">{/^https?:/.test(o.instagram || '') ? 'site' : `@${ig}`}</a>}
                {!n && !ig && <span className="ape-note">{o.email || 'sem contato informado'}</span>}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

/* como funciona: passo a passo ilustrado (aberto na primeira visita) */
/** Tudo o que explica a área num lugar só, fechado por padrão: como funciona, planta e acabamento, fechar em grupo. */
function Entenda() {
  return (
    <details className="ape-entenda">
      <summary><ApeIcon name="sparkle" /><span><b>como funciona</b><small>passo a passo, planta e acabamento, fechar em grupo</small></span><ApeIcon name="chev" /></summary>
      <div className="ape-entenda-b">
        <ol className="ape-entenda-passos">
          <li><ApeArt name="grupo" size={36} /><span><b>peça o orçamento</b>ao fornecedor, como sempre</span></li>
          <li><ApeArt name="anexo" size={36} tone="sec" /><span><b>mande aqui</b>PDF, print, texto ou só o contato</span></li>
          <li><ApeArt name="comparar" size={36} /><span><b>compare</b>preço, o que inclui, prazo, garantia e o original</span></li>
          <li><ApeArt name="carrinho" size={36} tone="sec" /><span><b>escolha</b>"vou fechar com este" e, se der, feche em grupo</span></li>
        </ol>
        <p className="ape-entenda-t"><b>planta e acabamento.</b> Canto (finais 01, 02, 11 e 12) e corredor (03 a 10) têm medidas diferentes, e cada vizinho escolhe o seu acabamento. Por isso os orçamentos ficam separados por acabamento e mostram a planta; quando não dizem, o site descobre pelas medidas. O "mais compensa" é um cálculo automático, não uma indicação.</p>
        <p className="ape-entenda-t"><b>fechar em grupo.</b> Marque "tenho interesse" no orçamento (não é compromisso). Juntou {GRUPO_META} apês? Qualquer vizinho toca em "pedir desconto de grupo": a mensagem já vem pronta. Conseguiu, registre o desconto no orçamento. Cada um fecha direto com o fornecedor, dizendo "grupo {APE.condominio}". O planê.apê não cobra nada.</p>
        <RecolherDetalhes />
      </div>
    </details>
  )
}

/** Botão "recolher" no fim de um <details> aberto (fecha e volta para o começo dele). */
export function RecolherDetalhes() {
  return (
    <button type="button" className="ape-more-x" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) { d.open = false; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) } }}>
      <ApeIcon name="chev" />recolher
    </button>
  )
}

/** Modo lista: uma linha por orçamento; toca para abrir o cartão completo ali mesmo. */
function Linha({ x, isTop, me, children }: { x: Item; isTop: boolean; me: Morador | null; children: ReactNode }) {
  const [on, setOn] = useState(false)
  const { o, c } = x
  const minha = !!plantaDe(o).p && plantaDe(o).p === plantaDoAp(me?.ap)
  return (
    <div className={`ape-linha ${on ? 'on' : ''} ${isTop ? 'top' : ''}`}>
      <button className="ape-linha-h" aria-expanded={on} onClick={() => setOn(!on)}>
        <span className="t">
          <b>{isTop && <ApeIcon name="star" />}{o.fornecedor || 'Fornecedor sem nome'}</b>
          <small>{o.servico}{plantaDe(o).p ? ` · ${plantaDe(o).p}${minha ? ' (a sua)' : ''}` : ''}</small>
        </span>
        <span className="v num">{brl(c.avista)}<small>à vista</small></span>
        <ApeIcon name="chev" />
      </button>
      {on && (
        <div className="ape-linha-b">
          {children}
          <button type="button" className="ape-more-x" onClick={() => setOn(false)}><ApeIcon name="chev" />recolher</button>
        </div>
      )}
    </div>
  )
}

function Card({ x, a, isTop, me, whats, count, escolhas, minha, show, onCount, onEscolha }: { x: Item; a: Analise; isTop: boolean; me: Morador | null; whats: string; count: number; escolhas: number; minha: boolean; show: (m: string) => void; onCount: (id: string, n: number) => void; onEscolha: (id: string, nicho: string, ficou: boolean) => void }) {
  const { o, c } = x
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(() => (read<string[]>(GRUPOS) || []).includes(o.id))
  const why = isTop ? whyTop(x, a) : []
  const vendorWa = waNum(o.whatsapp)
  const total = (num(o.interessados) || 0) + count
  const meta = num(o.grupo_min) || GRUPO_META
  const falta = Math.max(0, meta - total)
  const condicao = c.gp > 0 && (!o.grupo_ate || o.grupo_ate >= new Date().toISOString().slice(0, 10))
  const venc =
    c.st === 'vencido' ? (
      <span className="ape-pill rosa"><ApeIcon name="clock" />Vencido em {dmy(o.validade)}</span>
    ) : c.st === 'vence' ? (
      <span className="ape-pill rosa"><ApeIcon name="clock" />Vence {c.dias === 0 ? 'hoje' : `em ${c.dias} dia${(c.dias || 0) > 1 ? 's' : ''}`}</span>
    ) : c.st === 'ok' ? (
      <span className="ape-pill"><ApeIcon name="clock" />Válido até {dmy(o.validade)}</span>
    ) : null

  const [esc, setEsc] = useState(false)
  const [original, setOriginal] = useState(false)
  const fechar = async () => {
    if (!me?.id) return show('Faça o cadastro para escolher.')
    setEsc(true)
    try {
      const r = await escolher(o.id, me.id, o.nicho)
      onEscolha(o.id, o.nicho, !!r)
      show(r ? `Anotado: você vai fechar com ${o.fornecedor}.` : 'Escolha desmarcada.')
    } catch {
      show('Não deu para salvar agora. Tente de novo.')
    }
    setEsc(false)
  }
  const [registrar, setRegistrar] = useState(false)
  const [gf, setGf] = useState({ pct: o.grupo_pct != null ? String(o.grupo_pct).replace('.', ',') : '', desc: o.grupo_desc || '', ate: o.grupo_ate || '' })
  const salvarGrupo = async () => {
    if (!me?.id) return
    setBusy(true)
    try {
      await condicaoGrupo(me.id, o.id, { pct: num(gf.pct), desc: gf.desc.trim(), ate: gf.ate })
      show('Desconto do grupo publicado. Recarregue para ver no orçamento.')
      setRegistrar(false)
    } catch (e) {
      show(`Não deu para salvar (${(e as Error).message}).`)
    }
    setBusy(false)
  }
  const sair = async () => {
    if (!me?.id) return
    setBusy(true)
    try {
      const n = await sairGrupo(o.id, me.id)
      onCount(o.id, n)
      setJoined(false)
      write(GRUPOS, (read<string[]>(GRUPOS) || []).filter((x) => x !== o.id))
      show('Interesse desmarcado.')
    } catch {
      show('Não deu para desmarcar agora. Tente de novo.')
    }
    setBusy(false)
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
      {isTop && <span className="ape-crown" title={why.join(' · ')}><ApeIcon name="star" />Mais compensa</span>}
      <div className="ape-oc-h">
        <b>{o.fornecedor || 'Fornecedor sem nome'}</b>
        <span>{o.servico}</span>
      </div>
      {o.resumo && <p className="ape-resumo">{o.resumo}</p>}
      <div className={`ape-pr n${1 + ((c.parcelas || 0) >= 2 ? 1 : 0) + (c.grupo != null ? 1 : 0) + (c.m2 != null ? 1 : 0)}`}>
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
      <div className="ape-tags">
        {o.exemplo && <span className="ape-pill rosa">Exemplo</span>}
        {(() => { const { p, provavel } = plantaDe(o); const sua = !!p && p === plantaDoAp(me?.ap); return p ? <span className={`ape-pill ${sua ? 'azul' : ''}`} title={provavel ? 'Identificada pelas medidas do orçamento' : undefined}><ApeIcon name="home" />{provavel ? 'provável ' : ''}{PLANTA_ROT[p]}{sua ? ' (a sua)' : ''}</span> : null })()}
        {o.oculto && <span className="ape-pill rosa"><ApeIcon name="eye" />Oculto</span>}
        {x.badges.map((b) => (
          <span key={b.label} className={`ape-pill ${b.tone}`}><ApeIcon name={b.icon} />{b.label}</span>
        ))}
        {venc}
        {o.nao_inclui.length > 0 && (
          <span className="ape-pill rosa"><ApeIcon name="alert" />{o.nao_inclui.length} ite{o.nao_inclui.length > 1 ? 'ns' : 'm'} fora</span>
        )}
      </div>
      <div className={`ape-grupo ${joined ? 'on' : ''} ${condicao ? 'cond' : ''}`}>
        <div className="ape-grupo-top">
          <button type="button" className="ape-grupo-check" aria-pressed={joined} disabled={busy} onClick={() => void (joined ? sair() : entrar())}>
            <span className="box" aria-hidden="true">{joined && <ApeIcon name="check" />}</span>
            <span className="t"><b>{joined ? 'quero fechar em grupo' : 'fechar em grupo'}</b><small>{joined ? 'toque para desmarcar' : 'sem compromisso'}</small></span>
          </button>
          <span className="ape-grupo-n" title={`${total} ${total === 1 ? 'apê interessado' : 'apês interessados'}`}><ApeIcon name="users" /><b className="num">{falta ? `${total} de ${meta}` : 'meta batida'}</b></span>
        </div>
        <div className="ape-bar" role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={Math.min(total, meta)} aria-label="Apês no grupo">
          <i style={{ width: `${Math.min(100, (total / meta) * 100)}%` }} />
        </div>
        {(joined || condicao || !falta) && <span className="ape-note">
          {condicao
            ? <>Condição do grupo: <b>−{pct(c.gp)}</b>{o.grupo_desc ? ` (${o.grupo_desc})` : ''}{o.grupo_ate ? `, até ${dmy(o.grupo_ate)}` : ''}{o.grupo_por ? ` · registrada por ${o.grupo_por}` : ''}. Para fechar, fale com o fornecedor e diga "grupo {APE.condominio}".</>
            : falta
              ? `Faltam ${falta}. Com ${meta} apês, quem quiser puxa a conversa com o fornecedor e pede um desconto para todos.`
              : 'Meta batida! Quem quiser (de preferência quem mandou o orçamento) já pode pedir o desconto de grupo ao fornecedor.'}
        </span>}
        {joined && (
          <div className="ape-acts ape-grupo-acts">
            {vendorWa && total >= 2 && <a className={`ape-btn sm ${falta ? '' : 'primary'}`} href={wa(vendorWa, `Oi! Somos ${total} apartamentos do ${APE.condominio} interessados em fechar ${nicho(o.nicho).l.toLowerCase()} com vocês, a partir do orçamento que vocês mandaram. Qual condição especial vocês fazem para o grupo (desconto e prazo para fechar)? Cada morador fecha o seu contrato direto com vocês.`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />pedir desconto de grupo</a>}
            <button type="button" className="ape-btn ghost sm" onClick={() => setRegistrar(!registrar)}><ApeIcon name="edit" />{condicao ? 'corrigir o desconto' : 'registrar o desconto do grupo'}</button>
          </div>
        )}
        {joined && registrar && (
          <div className="ape-grupo-form">
            <div className="ape-frow ape-frow3">
              <div className="ape-f"><label>Desconto (%)</label><input inputMode="decimal" value={gf.pct} onChange={(e) => setGf({ ...gf, pct: e.target.value })} placeholder="ex.: 8" /></div>
              <div className="ape-f"><label>Condição</label><input value={gf.desc} onChange={(e) => setGf({ ...gf, desc: e.target.value })} placeholder="ex.: à vista" /></div>
              <div className="ape-f"><label>Vale até</label><input type="date" value={gf.ate} onChange={(e) => setGf({ ...gf, ate: e.target.value })} /></div>
            </div>
            <button type="button" className="ape-btn primary sm" disabled={busy} onClick={() => void salvarGrupo()}><ApeIcon name="check" />publicar para o grupo</button>
          </div>
        )}
      </div>
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
            {([['Pagamento', o.pagamento], ['Prazo', o.prazo], ['Garantia', o.garantia], ['Validade', o.validade ? dmy(o.validade) : ''], ['Em grupo', o.grupo_desc], ['Contato', o.contato], ['WhatsApp', vendorWa ? fmtTel(o.whatsapp) : ''], ['Instagram', o.instagram || '']] as const)
              .map(([k, v]) => [k, v || (['Pagamento', 'Prazo', 'Garantia', 'Validade'].includes(k) ? '— não informado' : '')] as const)
              .filter((f) => f[1])
              .map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd className={k === 'WhatsApp' ? 'ape-tel' : undefined}>{v}</dd>
                </div>
              ))}
          </dl>
          <RecolherDetalhes />
        </div>
      </details>
      <div className="ape-acts">
        {vendorWa ? (
          <a className="ape-btn primary wide" href={wa(vendorWa, msgFornecedor(o, me))} target="_blank" rel="noopener noreferrer">
            <ApeIcon name="chat" />
            falar com o fornecedor
          </a>
        ) : null}
        <button className={`ape-btn sm ${minha ? 'rose' : ''}`} onClick={() => void fechar()} disabled={esc} aria-pressed={minha} title={minha ? 'Tocar de novo desmarca' : 'Marca este como o que você vai contratar (um por serviço)'}>
          <ApeIcon name={minha ? 'check' : 'star'} />
          {minha ? 'minha escolha' : 'vou fechar com este'}
        </button>
        {(o.arquivos?.length || o.enviado) && (
          <button className="ape-btn ghost sm" onClick={() => setOriginal(true)}><ApeIcon name="file" />ver o original</button>
        )}
      </div>
      {original && <Original o={o} me={me} onClose={() => setOriginal(false)} />}
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

/* ===== cadastro ===== */
function Cadastro({ me, owner, onDone, onCancel }: { me: Morador | null; owner?: boolean; onDone: (m: Morador) => void; onCancel?: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const [modo, setModo] = useState<'novo' | 'entrar'>('novo')
  const [familia, setFamilia] = useState<TipoMembro[]>(['adulto'])
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const m = await moradorConta('entrar', { email: email.trim().toLowerCase(), senha })
      if (m) onDone(m)
      else setErr('Essa conta ainda não tem cadastro de morador. Toque em "criar conta".')
    } catch (x) {
      setErr(String((x as Error).message))
    }
    setBusy(false)
  }
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
    if (!me && apeCloud) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr('Coloque um e-mail válido.')
      if (senha.length < 8) return setErr('A senha precisa de pelo menos 8 caracteres.')
    }
    setErr('')
    setBusy(true)
    try {
      if (!me && apeCloud) {
        const novo = await moradorConta('morador', { ...m, junto: m.moraJunto, email: email.trim().toLowerCase(), senha, pessoas: familia.filter((t) => !ehPet(t)).length || null, familia })
        if (novo) onDone(novo)
      } else {
        const id = await cadastrar({ ...m, id: me?.id })
        onDone({ ...m, id, aprovado: me?.aprovado ?? true })
      }
    } catch (e) {
      setErr(`Não deu para entrar agora (${(e as Error).message}). Confira a internet e tente de novo.`)
    }
    setBusy(false)
  }

  return (
    <div className="ape-gate" role="dialog" aria-modal="true" aria-labelledby="g-t" onClick={(e) => e.target === e.currentTarget && onCancel?.()} onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}>
      {onCancel && <button type="button" className="ape-gate-x" onClick={onCancel} aria-label="Fechar"><ApeIcon name="x" /></button>}
      {modo === 'entrar' && !me ? (
        <form onSubmit={entrar} noValidate>
          <SanLeviArte size={52} className="ape-gate-sl" />
          <h2 id="g-t">entrar na <em>sua conta</em></h2>
          <p>Use o e-mail e a senha do seu cadastro.</p>
          <div className="ape-f"><label htmlFor="g-email2">E-mail</label><input id="g-email2" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="ape-f"><label htmlFor="g-senha2">Senha</label><input id="g-senha2" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
          {err && <p className="ape-err" role="alert">{err}</p>}
          <button className="ape-btn primary wide" type="submit" disabled={busy}>{busy ? 'entrando…' : 'entrar'}</button>
          <div className="ape-conta-links">
            <button type="button" className="ape-linkish ape-link" onClick={() => { setModo('novo'); setErr('') }}>criar conta</button>
            <a className="ape-link" href={href('ape', 'conta')}>esqueci a senha</a>
          </div>
        </form>
      ) : (
      <form onSubmit={submit} noValidate>
        <SanLeviArte size={52} className="ape-gate-sl" />
        <h2 id="g-t">
          {me ? <>seus <em>dados</em></> : <>boas-vindas ao <em>planê.apê</em></>}
        </h2>
        {owner && !me ? (
          <p>Você está logada como dona e já vê todos os orçamentos. Para <b>enviar</b> orçamentos como moradora, faça o seu cadastro aqui (fica guardado neste aparelho).</p>
        ) : !me ? (
          <p>Os orçamentos são só dos moradores do {APE.condominio}. Crie a sua conta em 1 minuto: seus dados não aparecem para os vizinhos. O <span className="ape-keep">CPF</span> só é pedido se um dia você comprar algo na loja.</p>
        ) : null}
        <div className="ape-f">
          <label htmlFor="g-nome">Nome completo</label>
          <input id="g-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="ape-f">
          <label>Onde é o seu apê?</label>
          <div className="ape-seg" role="radiogroup">
            <button type="button" role="radio" aria-checked={sl} onClick={() => setSl(true)}>{APE.condominio}</button>
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
          <label htmlFor="g-tel">Celular (<span className="ape-keep">WhatsApp</span>)</label>
          <input id="g-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={tel} onChange={(e) => setTel(mascaraTel(e.target.value))} required />
        </div>
        {!me && (
          <div className="ape-f ape-gfam">
            <label>Quem vai morar com você? <span className="ape-opc">opcional</span></label>
            <div className="ape-gfam-linha" aria-live="polite">
              {familia.map((t, i) => (
                <button key={i} type="button" className={`ape-gfam-m ${ehPet(t) ? 'pet' : ''}`} onClick={() => i > 0 && setFamilia(familia.filter((_, k) => k !== i))} title={i === 0 ? 'você' : `tirar ${rotuloMembro(t)}`} aria-label={i === 0 ? 'você' : `Tirar ${rotuloMembro(t)}`}>
                  <MembroIcone tipo={t} size={20} />
                  <small>{i === 0 ? 'você' : rotuloMembro(t)}</small>
                  {i > 0 && <i aria-hidden="true">×</i>}
                </button>
              ))}
            </div>
            <div className="ape-gfam-add" role="group" aria-label="Adicionar quem vai morar">
              {([['adulto', 'adulto'], ['crianca', 'criança'], ['bebe', 'bebê'], ['cachorro', 'cachorro'], ['gato', 'gato'], ['pet', 'outro pet']] as [TipoMembro, string][]).map(([t, l]) => (
                <button key={t} type="button" className={ehPet(t) ? 'pet' : ''} onClick={() => familia.length < 12 && setFamilia([...familia, t])} aria-label={`Adicionar ${l}`}><MembroIcone tipo={t} size={18} /><span>+ {l}</span></button>
              ))}
            </div>
          </div>
        )}
        {!me && apeCloud && (
          <>
            <div className="ape-f"><label htmlFor="g-email">E-mail</label><input id="g-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="ape-f"><label htmlFor="g-senha">Crie uma senha</label><input id="g-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="8 ou mais caracteres" /></div>
          </>
        )}
        {err && <p className="ape-err" role="alert">{err}</p>}
        <div className="ape-acts">
          <button className="ape-btn primary wide" type="submit" disabled={busy}>
            {busy ? 'aguarde…' : me ? 'salvar' : apeCloud ? 'criar conta' : 'entrar'}
          </button>
          {onCancel && (
            <button className="ape-btn ghost" type="button" onClick={onCancel}>cancelar</button>
          )}
        </div>
        {!me && apeCloud && (
          <div className="ape-conta-links" style={{ justifyContent: 'center' }}>
            <span className="ape-note">Já tem conta?</span>
            <button type="button" className="ape-linkish ape-link" onClick={() => { setModo('entrar'); setErr('') }}>entrar</button>
          </div>
        )}
        {me && (
          <button type="button" className="ape-btn ghost sm ape-outro" onClick={() => { void navigator.clipboard?.writeText(`https://useplane.com.br/ape/sanlevi/#entrar:${me.id}`); setCopiado(true) }}>
            <ApeIcon name={copiado ? 'check' : 'phone'} />
            {copiado ? 'link copiado: abra no outro aparelho (não compartilhe)' : 'usar em outro aparelho: copiar meu link'}
          </button>
        )}
      </form>
      )}
    </div>
  )
}
