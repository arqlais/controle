import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { href, useRoute } from '../router'
import { cadastrar, enviar, loadPublico, queroGrupo, souDona, apeCloud, type Publico } from './api'
import { ApeIcon } from './ApeIcon'
import {
  APE, CTA_BY, CTA_COPY, NICHOS, SORTS, analyze, brl, calc, digits, dmy, firstName, fmtTel, msgAnexo, msgFornecedor, msgGrupo, msgProduto, nicho, num, pct, wa, waNum, whyTop,
  type Analise, type Item, type Morador, type Nicho, type Orcamento, type Produto, type Sort,
} from './model'
import { markSvg } from '../components/PlaneMark'
import './ape.css'

// símbolo do planê nas cores do apê (conteúdo fixo)
const MARK_SVG = markSvg('quadrado', '#9b593f', '#ffffff')

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
  const view: View = sub === 'enviar' || sub === 'loja' ? sub : 'orcamentos'
  const [d, setD] = useState<Publico | null | undefined>(undefined)
  const [owner, setOwner] = useState(false)
  const [me, setMe] = useState<Morador | null>(() => read<Morador>(CAD))
  const [editing, setEditing] = useState(false)
  const [toast, show] = useToast()

  useEffect(() => {
    document.title = `${APE.name} · orçamentos ${APE.condominio}`
    loadPublico().then(setD, () => setD(null))
    souDona().then(setOwner, () => setOwner(false))
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
                <small>orçamentos do {APE.condominio} · {APE.instagram}</small>
              </div>
            </a>
            {me && (
              <button className="ape-me" onClick={() => setEditing(true)} aria-label="Editar meus dados">
                <span>
                  oi, <b>{first}</b>
                  <span className="ape-me-ap"> · T{me.torre} · {me.ap}</span>
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
          <Loja produtos={d.ajustes.produtos} me={me} whats={whats} />
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
        {APE.name} · feito por quem também está montando o apê no {APE.condominio} ·{' '}
        <a href="https://useplane.com.br" target="_blank" rel="noreferrer">useplane.com.br</a>
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
      <section className="ape-panel ape-empty">
        <ApeIcon name="file" size={32} />
        <b>os primeiros orçamentos chegam aqui</b>
        <span>Recebeu um orçamento de piso, marcenaria, box ou qualquer outro serviço? Mande pela aba Enviar orçamento e ele aparece organizado nesta página.</span>
        <a className="ape-btn primary" href={href('ape', 'enviar')}>
          <ApeIcon name="send" />
          enviar um orçamento
        </a>
      </section>
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
            todos os orçamentos do condomínio, <em>lado a lado</em>
          </h2>
          <p>Os moradores mandam, a gente organiza. Em cada tipo de serviço, o que mais compensa aparece primeiro, com o que está incluso e o que fica de fora.</p>
        </div>
        <div className="ape-stats">
          <div className="ape-stat"><b className="num">{vis.length}</b><span>orçamentos</span></div>
          <div className="ape-stat"><b className="num">{Object.keys(counts).length}</b><span>serviços</span></div>
          <div className="ape-stat"><b className="num">{comGrupo}</b><span>com desconto em grupo</span></div>
        </div>
      </section>
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
      {c.gp > 0 && total > 0 && (
        <div className="ape-note">
          <ApeIcon name="users" /> {total} {total > 1 ? 'apês já querem' : 'apê já quer'} fechar em grupo{falta != null ? (falta ? ` · faltam ${falta} para liberar` : ' · meta batida') : ''}
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
            <a className="ape-btn rose" href={wa(whats, msgGrupo(o, me))} target="_blank" rel="noopener noreferrer" title="Você já está na lista; fale com a Laís se quiser">
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

function Cta({ nicho: n, produtos, me, whats }: { nicho: Nicho; produtos: Produto[]; me: Morador | null; whats: string }) {
  const ativos = produtos.filter((p) => p.ativo)
  const p = ativos.find((p) => p.id === (CTA_BY[n] || 'checklist')) || ativos[0]
  if (!p) return null
  const copy = CTA_COPY[p.id] || ['Loja do apê', p.nome, p.desc]
  return (
    <aside className="ape-cta">
      <div>
        <span className="k">{copy[0]}</span>
        <h3>{copy[1]}</h3>
        <p>{copy[2]}</p>
      </div>
      <a className="ape-btn" href={wa(whats, msgProduto(p, me))} target="_blank" rel="noopener noreferrer">
        <ApeIcon name="bag" />
        {p.preco ? `${p.preco} · ` : ''}quero
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

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!me?.id) return setErr('Faça o cadastro antes de enviar.')
    if (!txt.trim() && !files.length) return setErr('Cole o texto do orçamento ou anexe o PDF ou um print.')
    if (files.length > 8) return setErr('Mande no máximo 8 arquivos por vez.')
    const big = files.find((f) => f.size > 15 * 1024 * 1024)
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

  if (done)
    return (
      <section className="ape-panel ape-done">
        <ApeIcon name="check" />
        <h2 className="ape-h2">
          recebido, <em>obrigada!</em>
        </h2>
        <p className="ape-note" style={{ maxWidth: '46ch', margin: 0 }}>A {APE.dona} confere e o orçamento aparece organizado na página, sem os seus dados. Se for de um serviço com desconto em grupo, você fica sabendo por aqui.</p>
        <div className="ape-acts" style={{ justifyContent: 'center' }}>
          <button className="ape-btn primary" onClick={() => { setDone(false); setN(''); setForn(''); setTxt(''); setFiles([]) }}>
            <ApeIcon name="plus" />
            mandar outro
          </button>
          <a className="ape-btn" href={href('ape')}>ver os orçamentos</a>
        </div>
      </section>
    )

  return (
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
        <li><b>3</b>Toque em enviar: a {APE.dona} confere e publica na página</li>
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
      <p className="ape-note" style={{ margin: 0 }}>Seu nome, torre, apê e telefone vão junto para a {APE.dona} saber quem mandou. Na página, o orçamento aparece sem os seus dados.</p>
    </form>
  )
}

/* ===== loja ===== */
function Loja({ produtos, me, whats }: { produtos: Produto[]; me: Morador | null; whats: string }) {
  const ativos = produtos.filter((p) => p.ativo)
  return (
    <>
      <section className="ape-panel ape-hero" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <div>
          <p className="ape-eyebrow"><ApeIcon name="bag" />Loja do apê</p>
          <h2>
            feito por quem também está <em>montando o apê</em> no {APE.condominio}
          </h2>
          <p>Materiais e serviços da {APE.dona} (arquitetura) e do Igor, do {APE.doApe}, pensados para os apês de {APE.apes} da {APE.construtora}. Toque em "quero" para falar no WhatsApp.</p>
        </div>
      </section>
      {ativos.length ? (
        <div className="ape-shop">
          {ativos.map((p) => (
            <article key={p.id} className="ape-prod">
              {p.tag && <span className="ape-pill terra" style={{ alignSelf: 'flex-start' }}>{p.tag}</span>}
              <h3>{p.nome}</h3>
              <p>{p.desc}</p>
              <div className="ape-price">{p.preco ? p.preco : <small>Valor sob consulta</small>}</div>
              <a className="ape-btn primary" href={wa(whats, msgProduto(p, me))} target="_blank" rel="noopener noreferrer">
                <ApeIcon name="chat" />
                quero
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="ape-panel ape-empty">
          <b>em breve</b>
          <span>Os produtos aparecem aqui assim que forem lançados.</span>
        </div>
      )}
    </>
  )
}

/* ===== cadastro ===== */
function Cadastro({ me, onDone, onCancel }: { me: Morador | null; onDone: (m: Morador) => void; onCancel?: () => void }) {
  const [nome, setNome] = useState(me?.nome || '')
  const [torre, setTorre] = useState(me?.torre || '')
  const [ap, setAp] = useState(me?.ap || '')
  const [tel, setTel] = useState(me?.tel ? fmtTel(me.tel) : '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const m = { nome: nome.trim().replace(/\s+/g, ' '), torre: torre.trim(), ap: ap.trim(), tel: digits(tel) }
    if (m.nome.split(' ').length < 2) return setErr('Coloque o nome completo.')
    if (!m.torre || !m.ap) return setErr('Coloque a torre e o apê.')
    if (m.tel.length < 10 || m.tel.length > 13) return setErr('Coloque o telefone com DDD.')
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
          quem é você no <em>{APE.condominio}</em>?
        </h2>
        <p>A página é só para os futuros moradores. Seus dados ficam com a {APE.dona} e vão junto quando você mandar um orçamento ou entrar numa compra em grupo.</p>
        <div className="ape-f">
          <label htmlFor="g-nome">Nome completo</label>
          <input id="g-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="ape-frow">
          <div className="ape-f">
            <label htmlFor="g-torre">Torre</label>
            <input id="g-torre" inputMode="numeric" value={torre} onChange={(e) => setTorre(e.target.value)} required />
          </div>
          <div className="ape-f">
            <label htmlFor="g-ap">Apê</label>
            <input id="g-ap" inputMode="numeric" value={ap} onChange={(e) => setAp(e.target.value)} required />
          </div>
        </div>
        <div className="ape-f">
          <label htmlFor="g-tel">Telefone com DDD</label>
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
