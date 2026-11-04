import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { href, useRoute } from '../router'
import { cadastrar, enviar, loadPublico, meusEnvios, queroGrupo, souDona, apeCloud, type MeuEnvio, type Publico } from './api'
import { ApeIcon } from './ApeIcon'
import {
  APE, CTA_BY, CTA_COPY, NICHOS, SORTS, analyze, brl, calc, digits, dmy, firstName, fmtTel, msgAnexo, msgFornecedor, msgGrupo, msgProduto, nicho, num, pct, wa, waNum, whyTop,
  CATEGORIAS, ehSanLevi, ondeMora, type Analise, type Categoria, type Item, type Morador, type Nicho, type Orcamento, type Produto, type Sort,
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

type View = 'orcamentos' | 'enviar' | 'loja'

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
  const view: View = sub === 'enviar' ? 'enviar' : sub?.startsWith('loja') ? 'loja' : 'orcamentos'
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
    loadPublico().then(setD, () => setD(null))
    souDona().then(setOwner, () => setOwner(false))
    return () => undo.forEach((f) => f())
  }, [])
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

  return (
    <div className="ape">
      <header className="ape-top">
        <div className="wrap">
          <div className="ape-brand">
            <a className="ape-logo" href={href('ape')} aria-label={`${APE.name}: início`}>
              <span className="ape-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
              <div>
                <h1>
                  planê<span>.apê</span>
                </h1>
                <small>orçamentos lado a lado · {APE.instagram}</small>
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
            <a href={href('ape', 'loja')} aria-current={view === 'loja' ? 'page' : undefined}>
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
            <button className="ape-btn" onClick={() => loadPublico().then(setD, () => setD(null))}>tentar de novo</button>
          </div>
        ) : view === 'orcamentos' ? (
          <Orcamentos vis={vis} d={d} owner={owner} me={me} whats={whats} show={show} onCount={(id, n) => setD({ ...d, contagens: { ...d.contagens, [id]: n } })} />
        ) : view === 'enviar' ? (
          <Enviar me={me} whats={whats} />
        ) : (
          <Loja key={abrir || 'loja'} produtos={d.ajustes.produtos} me={me} whats={whats} abrir={abrir} />
        )}
      </main>
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
        <a href={href('ape', 'loja')} aria-current={view === 'loja' ? 'page' : undefined}>
          <ApeIcon name="bag" />
          loja do apê
        </a>
        {owner && (
          <a href={href('ape-admin')}>
            <ApeIcon name="gear" />
            painel
          </a>
        )}
      </nav>
      <p className="ape-foot">
        <b>{APE.name}</b> · Os orçamentos são enviados por quem está montando o apê e aparecem como foram recebidos. A página só organiza e compara: confira valores, prazos e condições direto com o fornecedor antes de fechar. Não temos vínculo com os fornecedores nem participamos das negociações.
      </p>
      {!owner && (!me || editing) && <Cadastro me={me} onDone={onCadastro} onCancel={me ? () => setEditing(false) : undefined} />}
      {toast}
    </div>
  )
}

/* ===== orçamentos ===== */
function Orcamentos({ vis, d, owner, me, whats, show, onCount }: { vis: Orcamento[]; d: Publico; owner: boolean; me: Morador | null; whats: string; show: (m: string) => void; onCount: (id: string, n: number) => void }) {
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
          const card = (x: Item, isTop: boolean) => <Card key={x.o.id} x={x} a={a} isTop={isTop} me={me} whats={whats} count={d.contagens[x.o.id] || 0} show={show} onCount={onCount} />
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

function Card({ x, a, isTop, me, whats, count, show, onCount }: { x: Item; a: Analise; isTop: boolean; me: Morador | null; whats: string; count: number; show: (m: string) => void; onCount: (id: string, n: number) => void }) {
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
const LINK = 'https://useplane.com.br/ape/'
const CONVITE = `Olha que legal: uma página com orçamentos de quem está montando o apê (piso, marcenaria, box…), lado a lado, e compras em grupo com desconto. Manda os seus também 🏡`
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
  useEffect(() => {
    if (me?.id) meusEnvios(me.id).then(setMeus, () => setMeus([]))
  }, [me?.id, done])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!me?.id) return setErr('Faça o cadastro antes de enviar.')
    if (!txt.trim() && !files.length) return setErr('Cole o texto do orçamento ou anexe o PDF ou um print.')
    if (files.length > 8) return setErr('Mande no máximo 8 arquivos por vez.')
    const big = files.find((f) => f.size > 15 * 1024 * 1024 && !/^image\/(jpeg|png|webp)$/i.test(f.type))
    if (big) return setErr(`O arquivo ${big.name} passa de 15 MB. Mande um print ou um PDF menor.`)
    setStep('Enviando…')
    try {
      await enviar(me.id, { nicho: n, fornecedor: forn.trim(), texto: txt.trim(), files }, setStep)
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
          mande o seu e a gente <em>organiza</em>
        </h2>
      </div>
      <ol className="ape-steps">
        <li><b>1</b>Escolha o serviço e diga de quem é o orçamento</li>
        <li><b>2</b>Anexe o PDF ou os prints, ou cole o texto que o fornecedor mandou</li>
        <li><b>3</b>Toque em enviar: ele entra na página, sem os seus dados</li>
      </ol>
      <div className="ape-frow">
        <div className="ape-f">
          <label htmlFor="e-nicho">Serviço</label>
          <select id="e-nicho" value={n} onChange={(e) => setN(e.target.value)}>
            <option value="">Escolha…</option>
            {NICHOS.map((x) => (
              <option key={x[0]} value={x[0]}>{x[1]}</option>
            ))}
          </select>
        </div>
        <div className="ape-f">
          <label htmlFor="e-forn">Fornecedor</label>
          <input id="e-forn" value={forn} onChange={(e) => setForn(e.target.value)} placeholder="Nome da loja ou profissional" />
        </div>
      </div>
      <label className="ape-drop" htmlFor="e-files">
        <ApeIcon name="clip" />
        <b>{files.length ? 'trocar os arquivos' : 'anexar PDF ou prints'}</b>
        <input id="e-files" type="file" multiple accept="application/pdf,image/*" onChange={(e) => setFiles([...(e.target.files || [])])} />
        {files.length > 0 && (
          <span className="ape-files">
            {files.map((f) => (
              <span key={f.name} className="ape-pill"><ApeIcon name="file" />{f.name}</span>
            ))}
          </span>
        )}
        <span className="ape-note">Toque para escolher da galeria ou dos arquivos. Até 8, de até 15 MB cada.</span>
      </label>
      <div className="ape-f">
        <label htmlFor="e-txt">Texto do orçamento (opcional)</label>
        <textarea id="e-txt" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Cole aqui o que o fornecedor mandou: valores, parcelas, o que inclui, validade…" />
      </div>
      {err && <p className="ape-err" role="alert">{err}</p>}
      <div className="ape-acts">
        <button className="ape-btn primary" type="submit" disabled={!!step}>
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
function Loja({ produtos, me, whats, abrir }: { produtos: Produto[]; me: Morador | null; whats: string; abrir?: string }) {
  const ativos = produtos.filter((p) => p.ativo)
  const [cat, setCat] = useState<Categoria | 'todos'>('todos')
  const [aberto, setAberto] = useState<Produto | null>(() => ativos.find((p) => p.id === abrir) || null)
  const byId = (id: string) => produtos.find((p) => p.id === id)
  const cats = CATEGORIAS.filter(([c]) => ativos.some((p) => (p.cat || 'arquivos') === c))
  useEffect(() => {
    document.body.style.overflow = aberto ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [aberto])
  if (!ativos.length)
    return (
      <div className="ape-panel ape-empty">
        <b>em breve</b>
        <span>Os produtos aparecem aqui assim que forem lançados.</span>
      </div>
    )
  return (
    <>
      <section className="ape-panel ape-hero">
        <div>
          <p className="ape-eyebrow">loja do apê</p>
          <h2>
            feito por quem também está <em>montando o apê</em> no {APE.condominio}
          </h2>
          <p>Materiais e projetos feitos por uma arquiteta que também está montando o apê, pensados para apês compactos como os de {APE.apes} da {APE.construtora}. Toque num item para ver como ele é por dentro.</p>
        </div>
        <ol className="ape-steps" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
          <li><b>1</b>Escolha o arquivo, combo ou projeto</li>
          <li><b>2</b>Toque em "quero": abre o WhatsApp</li>
          <li><b>3</b>Pague no Pix e receba na hora</li>
        </ol>
      </section>
      <div className="ape-chips" role="group" aria-label="Filtrar a loja">
        <button className="ape-chip" aria-pressed={cat === 'todos'} onClick={() => setCat('todos')}>tudo</button>
        {cats.map(([c, l, i]) => (
          <button key={c} className="ape-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            <ApeIcon name={i} />
            {l}
          </button>
        ))}
      </div>
      {cats
        .filter(([c]) => cat === 'todos' || cat === c)
        .map(([c, l, i, d]) => (
          <section key={c} className="ape-nicho" aria-label={l}>
            <div className="ape-nhead">
              <span className="ape-nic"><ApeIcon name={i} /></span>
              <div>
                <h3>{l}</h3>
                <span className="ape-note">{d}</span>
              </div>
            </div>
            {c === 'plataforma' || c === 'projeto' ? <Vitrine cat={c} /> : null}
            <div className="ape-shop">
              {ativos
                .filter((p) => (p.cat || 'arquivos') === c)
                .map((p) => (
                  <ProdCard key={p.id} p={p} byId={byId} onOpen={() => setAberto(p)} me={me} whats={whats} />
                ))}
            </div>
          </section>
        ))}
      <aside className="ape-cta">
        <div>
          <span className="k">dúvida?</span>
          <h3>Me chama no WhatsApp</h3>
          <p>Conto o que vem em cada arquivo, monto um combo do seu jeito ou explico como funciona o projeto.</p>
        </div>
        <a className="ape-btn" href={wa(whats, `Oi! Sou ${me ? me.nome : 'uma pessoa que está montando o apê'}. Tenho uma dúvida sobre a loja do apê.`)} target="_blank" rel="noopener noreferrer">
          <ApeIcon name="chat" />
          chamar no WhatsApp
        </a>
      </aside>
      {aberto && <Detalhe p={aberto} byId={byId} me={me} whats={whats} onClose={() => setAberto(null)} onOpen={setAberto} />}
    </>
  )
}

const precoDe = (p: Produto) => (p.preco_de && /^R\$/.test(p.preco_de) && /^R\$/.test(p.preco) ? p.preco_de : '')
const economia = (p: Produto, byId: (id: string) => Produto | undefined) => {
  if (!p.combo?.length) return 0
  const soma = p.combo.reduce((t, id) => t + (num(byId(id)?.preco) || 0), 0)
  return Math.max(0, soma - (num(p.preco) || 0))
}

function Preco({ p, byId }: { p: Produto; byId: (id: string) => Produto | undefined }) {
  const eco = economia(p, byId)
  const de = precoDe(p)
  return (
    <div className="ape-price">
      {de && <s className="ape-de">{de}</s>}
      {p.preco ? (
        <>
          {p.preco}
          {p.unidade && <small> {p.unidade}</small>}
        </>
      ) : (
        <small>valor sob consulta</small>
      )}
      {p.preco_de && !de && <span className="ape-note" style={{ display: 'block' }}>ou {p.preco_de}</span>}
      {eco > 0 && <span className="ape-pill rosa ape-keep" style={{ display: 'table', marginTop: 6 }}>economize {brl(eco)}</span>}
    </div>
  )
}

function ProdCard({ p, byId, onOpen, me, whats }: { p: Produto; byId: (id: string) => Produto | undefined; onOpen: () => void; me: Morador | null; whats: string }) {
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
      <div className="ape-tags">
        {p.tag && <span className={`ape-pill ${p.destaque ? 'azul' : 'terra'}`}>{p.tag}</span>}
        {p.formato && <span className="ape-pill ape-keep">{p.formato.split(' · ')[0]}</span>}
      </div>
      <h3>{p.nome}</h3>
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
        <a className="ape-btn primary wide" href={wa(whats, msgProduto(p, me))} target="_blank" rel="noopener noreferrer">
          <ApeIcon name="bag" />
          quero
        </a>
      </div>
    </article>
  )
}

/* explicação visual de cada área (com as imagens de exemplo) */
function Vitrine({ cat }: { cat: Categoria }) {
  if (cat === 'plataforma')
    return (
      <div className="ape-vit">
        <img src="ape/amostras/plataforma.jpg" alt="Telas de exemplo da plataforma do apê: gastos, obra passo a passo e vistoria com fotos" loading="lazy" />
        <div className="ape-vit-t">
          <b>como funciona</b>
          <ul className="ape-inc">
            <li><ApeIcon name="check" />Você anota cada compra e a plataforma soma tudo por cômodo</li>
            <li><ApeIcon name="check" />As parcelas aparecem mês a mês, sem surpresa no cartão</li>
            <li><ApeIcon name="check" />A obra fica em etapas, com data e o que já foi feito</li>
            <li><ApeIcon name="check" />Na vistoria, você marca os itens, tira fotos e gera o resumo para a MRV</li>
          </ul>
          <span className="ape-note">Telas ilustrativas.</span>
        </div>
      </div>
    )
  return (
    <div className="ape-vit">
      <img src="ape/amostras/projeto-3d.jpg" alt="Imagem 3D do projeto do apê 1204: cozinha azul, parede terracota e mesa de jantar" loading="lazy" />
      <div className="ape-vit-t">
        <b>exemplo real: o {APE.doApe}</b>
        <ul className="ape-inc">
          <li><ApeIcon name="check" />Marcenaria azul da cozinha, parede terracota e piso em espinha de peixe</li>
          <li><ApeIcon name="check" />Mesa de jantar no lugar certo, sem atrapalhar a passagem</li>
          <li><ApeIcon name="check" />Tudo nas medidas do apê MRV de {APE.apes}</li>
        </ul>
        <span className="ape-note">Projeto da {APE.dona}, arquiteta, para o próprio apê.</span>
      </div>
    </div>
  )
}

function Detalhe({ p, byId, me, whats, onClose, onOpen }: { p: Produto; byId: (id: string) => Produto | undefined; me: Morador | null; whats: string; onClose: () => void; onOpen: (p: Produto) => void }) {
  const [i, setI] = useState(0)
  const imgs = p.amostras || []
  useEffect(() => {
    setI(0)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [p, onClose])
  const filhos = (p.combo || []).map(byId).filter((x): x is Produto => !!x)
  return (
    <div className="ape-sheet" role="dialog" aria-modal="true" aria-label={p.nome} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ape-sheet-in">
        <button className="ape-x" onClick={onClose} aria-label="Fechar"><ApeIcon name="x" /></button>
        {imgs.length > 0 && (
          <div className="ape-gal">
            <img src={imgs[i]} alt={`${p.nome}: amostra ${i + 1}`} />
            {imgs.length > 1 && (
              <div className="ape-dotsn">
                {imgs.map((_, j) => (
                  <button key={j} aria-label={`Amostra ${j + 1}`} aria-pressed={i === j} onClick={() => setI(j)} />
                ))}
              </div>
            )}
          </div>
        )}
        <div className="ape-sheet-b">
          <div className="ape-tags">
            {p.tag && <span className="ape-pill azul">{p.tag}</span>}
            {imgs.length > 0 && p.cat !== 'projeto' && p.cat !== 'plataforma' && <span className="ape-pill">amostra com marca d'água</span>}
          </div>
          <h2 className="ape-h2">{p.nome}</h2>
          <p style={{ margin: 0, color: 'var(--a-muted)' }}>{p.desc}</p>
          {filhos.length > 0 && (
            <div className="ape-rows">
              {filhos.map((x) => (
                <button key={x.id} className="ape-row ape-row-btn" onClick={() => onOpen(x)}>
                  <span className="t"><b>{x.nome}</b><span>{x.formato}</span></span>
                  <span className="r"><s className="ape-note">{x.preco}</s></span>
                </button>
              ))}
            </div>
          )}
          {(p.itens || []).length > 0 && (
            <>
              <p className="ape-eyebrow" style={{ marginTop: 6 }}>{filhos.length ? 'e ainda' : 'o que vem'}</p>
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
          </dl>
          <Preco p={p} byId={byId} />
          <a className="ape-btn primary" href={wa(whats, msgProduto(p, me))} target="_blank" rel="noopener noreferrer">
            <ApeIcon name="bag" />
            quero {p.cat === 'projeto' ? 'conversar sobre o projeto' : 'esse'}
          </a>
        </div>
      </div>
    </div>
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

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const m = { nome: nome.trim().replace(/\s+/g, ' '), condominio: sl ? APE.condominio : cond.trim(), torre: sl ? torre.trim() : '', ap: sl ? ap.trim() : '', tel: digits(tel) }
    if (m.nome.split(' ').length < 2) return setErr('Coloque o nome completo.')
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
        <p>Orçamentos de quem está montando o apê, lado a lado. Para ver e mandar orçamentos, conte rapidinho quem é você. Seus dados não aparecem na página.</p>
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
              <label htmlFor="g-torre">Torre (opcional)</label>
              <input id="g-torre" inputMode="numeric" value={torre} onChange={(e) => setTorre(e.target.value)} />
            </div>
            <div className="ape-f">
              <label htmlFor="g-ap">Apê (opcional)</label>
              <input id="g-ap" inputMode="numeric" value={ap} onChange={(e) => setAp(e.target.value)} />
            </div>
          </div>
        ) : (
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
