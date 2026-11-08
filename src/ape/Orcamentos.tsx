// planê.apê: área dos orçamentos do San Levi (pastas, lista, blocos, cartões, grupo e dica da loja).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { href } from '../router'
import { escolher, queroGrupo, sairGrupo, condicaoGrupo, apeCloud, verOriginal, type Publico } from './api'
import { ApeArt } from './ApeArt'
import { ApeIcon } from './ApeIcon'
import {
  APE, GRUPO_META, CTA_BY, CTA_COPY, NICHOS, SORTS, analyze, brl, calc, dmy, fmtTel, msgFornecedor, msgGrupo, nicho, num, pct, wa, waNum, whyTop, ehOrcamento, plantaDoAp, plantaDe, acabamentoDe, PLANTA_ROT, type Analise, type Item, type Morador, type Nicho, type Orcamento, type Produto, type Sort,
} from './model'
import { read, write } from './shared'
import { Fileira } from './Loja'
import { Comparar, Original } from './Comparar'

const UI = 'ape-ui'
const GRUPOS = 'ape-grupos'

/* ===== orçamentos ===== */
export function Orcamentos({ vis, d, owner, me, whats, show, onCount, onEscolha, onEditar }: { vis: Orcamento[]; d: Publico; owner: boolean; me: Morador | null; whats: string; show: (m: string) => void; onCount: (id: string, n: number) => void; onEscolha: (id: string, nicho: string, ficou: boolean) => void; onEditar: () => void; onRecarregar?: () => void }) {
  const saved = read<{ nicho?: string; sort?: Sort; validos?: boolean; vista?: Vista }>(UI) || {}
  const [filtro, setFiltro] = useState(saved.nicho || 'todos')
  const [sort, setSort] = useState<Sort>(saved.sort && SORTS[saved.sort] ? saved.sort : 'compensa')
  const [validos, setValidos] = useState(!!saved.validos)
  const minhaPlanta = plantaDoAp(me?.ap)
  const [pl, setPl] = useState<'todas' | 'canto' | 'corredor'>('todas')
  const [q, setQ] = useState('')
  const [vista, setVista] = useState<Vista>(saved.vista === 'blocos' || saved.vista === 'pastas' ? saved.vista : 'lista')
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
          <div className="ape-stat"><b className="num">{vis.length - vis.filter(ehOrcamento).length}</b><span>contatos</span></div>
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
        <label className={`ape-search ${q ? 'tem' : ''}`}>
          <ApeIcon name="search" />
          <input type="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        </label>
        <button type="button" className={`ape-btn sm ape-filtros-btn ${filtros ? 'on' : ''}`} aria-expanded={filtros} onClick={() => setFiltros(!filtros)}><ApeIcon name="gear" /><span className="l">filtros</span>{(pl !== 'todas' ? 1 : 0) + (validos ? 1 : 0) + (sort !== 'compensa' ? 1 : 0) ? <em>{(pl !== 'todas' ? 1 : 0) + (validos ? 1 : 0) + (sort !== 'compensa' ? 1 : 0)}</em> : null}</button>
        <div className="ape-vista" role="group" aria-label="Ver como">
          <button aria-pressed={vista === 'lista'} onClick={() => setVista('lista')} title="ver em lista" aria-label="ver em lista"><ApeIcon name="list" /><span>lista</span></button>
          <button aria-pressed={vista === 'blocos'} onClick={() => setVista('blocos')} title="ver em cartões, lado a lado" aria-label="ver em cartões"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg><span>cartões</span></button>
          <button aria-pressed={vista === 'pastas'} onClick={() => setVista('pastas')} title="ver os arquivos (prints e PDFs)" aria-label="ver os anexos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></svg><span>anexos</span></button>
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
      <DicaLoja nicho={(groups[0] || 'outros') as Nicho} produtos={d.ajustes.produtos} />
      <div className="ape-orc-lista" style={{ display: 'grid', gap: 26 }}>
        {!list.length && (
          <div className="ape-panel ape-empty">
            <b>nada por aqui</b>
            <span>Nenhum orçamento com esse filtro. Tente limpar a busca ou mostrar os vencidos.</span>
          </div>
        )}
        {groups.map((id) => {
          const doServico = list.filter((o) => o.nicho === id)
          const extras = doServico.filter((o) => !ehOrcamento(o))
          const orcs = doServico.filter(ehOrcamento)
          const n = nicho(id)
          const fecharCom = async (o: Orcamento) => {
            if (!me?.id) return
            try {
              const r = await escolher(o.id, me.id, o.nicho)
              onEscolha(o.id, o.nicho, !!r)
              show(r ? `Marcado como sua escolha: ${o.fornecedor}.` : 'Escolha desmarcada.')
            } catch {
              show('Não deu para salvar agora. Tente de novo.')
            }
          }
          const acabs = [...new Set(orcs.map(acabamentoDe))].sort((x, y) => (x ? 0 : 1) - (y ? 0 : 1) || x.localeCompare(y))
          const card = (x: Item, a: Analise, isTop: boolean, acab = '') => <Card key={x.o.id} x={x} a={a} isTop={isTop} acab={acab} me={me} whats={whats} count={d.contagens[x.o.id] || 0} escolhas={d.escolhas[x.o.id] || 0} minha={d.minhas.includes(x.o.id)} show={show} onCount={onCount} onEscolha={onEscolha} />
          // blocos: tudo do serviço numa fileira só, lado a lado (cada cartão diz o acabamento); "mais compensa" é por acabamento
          const fileira = () => {
            const itens = acabs.flatMap((ac) => {
              const a = analyze(orcs.filter((o) => acabamentoDe(o) === ac))
              const sorted = [...a.items].sort(SORTS[sort][1])
              const top = sort === 'compensa' && a.top ? a.top : null
              return [...(top ? [top] : []), ...sorted.filter((x) => x !== top)].map((x) => ({ x, a, top: x === top, ac }))
            })
            return (
              <div className="ape-acab">
                <Comparar orcs={orcs} me={me} minhas={d.minhas} onFechar={me?.id ? fecharCom : undefined} />
                <Fileira n={itens.length} rotulo="orçamentos" cls="ape-fileira-orc">{itens.map((i) => card(i.x, i.a, i.top, acabs.length > 1 ? i.ac || 'outros acabamentos' : ''))}</Fileira>
              </div>
            )
          }
          // lista: como foi recebido (do mais novo para o mais antigo), sem ranking
          const recebidos = () => {
            const a = analyze(orcs)
            const lista = [...a.items].sort((p, q) => String(q.o.criado || '').localeCompare(String(p.o.criado || '')))
            return (
              <div className="ape-acab">
                <Comparar orcs={orcs} me={me} minhas={d.minhas} onFechar={me?.id ? fecharCom : undefined} />
                <div className="ape-linhas">{lista.map((x) => <Linha key={x.o.id} x={x} isTop={false} me={me}>{card(x, a, false, acabs.length > 1 ? acabamentoDe(x.o) || 'outros acabamentos' : '')}</Linha>)}</div>
              </div>
            )
          }
          // pastas: cada orçamento como chegou (print, PDF ou digitado), só para ver e achar o fornecedor
          const pastas = () => (
            <div className="ape-docs">
              {[...doServico].sort((p, q) => String(q.criado || '').localeCompare(String(p.criado || ''))).map((o) => <Doc key={o.id} o={o} me={me} />)}
            </div>
          )
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
                {vista === 'pastas' ? pastas() : orcs.length ? (vista === 'lista' ? recebidos() : fileira()) : null}
                {vista !== 'pastas' && extras.length > 0 && <Contatos lista={extras} me={me} />}
              </section>
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
          <li><ApeArt name="carrinho" size={36} tone="sec" /><span><b>escolha</b>marque a sua escolha e, se der, feche em grupo</span></li>
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

type Vista = 'blocos' | 'lista' | 'pastas'
const capi = (t: string) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t
/** O que foi orçado (a pedra, o piso, o móvel...) para vir em destaque; e o serviço sem o material. */
function produtoDe(o: Orcamento): string {
  const m = (o.materiais?.[0] || '').trim()
  const s = o.servico.split(' · ').slice(1).join(' · ').trim()
  return capi(m || s)
}
const servicoBase = (o: Orcamento) => o.servico.split(' · ')[0].trim()
const recebidoEm = (o: Orcamento) => (o.criado ? dmy(String(o.criado).slice(0, 10)) : '')

/** Miniatura do anexo (1ª página do PDF ou o print), carregada só quando aparece na tela. */
const MINIS = new Map<string, Promise<string>>()
async function miniDe(me: Morador | null, o: Orcamento): Promise<string> {
  const l = await verOriginal(me?.id, o.id)
  const a = l[0]
  if (!a) return ''
  if (!(/pdf/i.test(a.tipo) || /\.pdf$/i.test(a.nome))) return a.url
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const pdf = await pdfjs.getDocument({ url: a.url }).promise
  const pg = await pdf.getPage(1)
  const v0 = pg.getViewport({ scale: 1 })
  const vp = pg.getViewport({ scale: 360 / v0.width })
  const cv = document.createElement('canvas')
  cv.width = vp.width; cv.height = vp.height
  await pg.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise
  return cv.toDataURL('image/jpeg', 0.8)
}
function Miniatura({ o, me, icone }: { o: Orcamento; me: Morador | null; icone: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [src, setSrc] = useState('')
  useEffect(() => {
    const el = ref.current
    if (!el || !o.arquivos?.length) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      if (!MINIS.has(o.id)) MINIS.set(o.id, miniDe(me, o).catch(() => ''))
      void MINIS.get(o.id)!.then(setSrc)
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [o.id])
  return <span ref={ref} className={`mini ${src ? 'ok' : ''}`}>{src ? <img src={src} alt="" loading="lazy" /> : <ApeIcon name={icone} />}</span>
}

/** Modo pastas: os anexos num lugar só, com a prévia; toca e abre o original. */
function Doc({ o, me }: { o: Orcamento; me: Morador | null }) {
  const [ver, setVer] = useState(false)
  const c = calc(o)
  const arq = o.arquivos || []
  const pdf = arq.some((a) => /pdf/i.test(a.tipo || '') || /\.pdf$/i.test(a.nome || ''))
  const tipo = !arq.length ? 'digitado' : pdf ? 'PDF' : arq.length > 1 ? `${arq.length} prints` : 'print'
  const extra = !ehOrcamento(o)
  return (
    <>
      <button type="button" className="ape-doc" onClick={() => setVer(true)} title={`${o.fornecedor} · ${o.servico}`}>
        <Miniatura o={o} me={me} icone={!arq.length ? 'edit' : pdf ? 'file' : 'clip'} />
        <span className="tipo">{tipo}</span>
        {c.st === 'vencido' && <span className="venc">venceu</span>}
        <span className="t">
          <b>{o.fornecedor || 'Fornecedor sem nome'}</b>
          <small>{extra ? (o.tipo === 'tabela' ? 'tabela de preços' : 'contato') : produtoDe(o) || servicoBase(o)}</small>
        </span>
      </button>
      {ver && <Original o={o} me={me} onClose={() => setVer(false)} />}
    </>
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
          <b>{isTop && <ApeIcon name="star" />}{produtoDe(o) || o.fornecedor || 'Fornecedor sem nome'}</b>
          <small>{[produtoDe(o) ? o.fornecedor : '', servicoBase(o), plantaDe(o).p ? `${plantaDe(o).p}${minha ? ' (a sua)' : ''}` : ''].filter(Boolean).join(' · ')}</small>
        </span>
        <span className="d">{c.st === 'vencido' ? <span className="ape-pill rosa"><ApeIcon name="clock" />venceu</span> : recebidoEm(o) ? <small>recebido<br />{recebidoEm(o)}</small> : null}</span>
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

function Card({ x, a, isTop, acab = '', me, whats, count, escolhas, minha, show, onCount, onEscolha }: { x: Item; a: Analise; isTop: boolean; acab?: string; me: Morador | null; whats: string; count: number; escolhas: number; minha: boolean; show: (m: string) => void; onCount: (id: string, n: number) => void; onEscolha: (id: string, nicho: string, ficou: boolean) => void }) {
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
    c.st === 'vencido' ? null : c.st === 'vence' ? (
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
      show(r ? `Marcado como sua escolha: ${o.fornecedor}.` : 'Escolha desmarcada.')
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
      <div className="ape-oc-top">
        {acab && <span className="ape-oc-acab"><ApeIcon name="tag" />{acab}</span>}
        {isTop && <span className="ape-crown" title={why.join(' · ')}><ApeIcon name="star" />Mais compensa</span>}
        {c.st === 'vencido' && <span className="ape-pill rosa"><ApeIcon name="clock" />venceu{o.validade ? ` em ${dmy(o.validade)}` : ''}</span>}
      </div>
      <div className="ape-oc-h">
        <b title={produtoDe(o) || o.fornecedor}>{produtoDe(o) || o.fornecedor || 'Fornecedor sem nome'}</b>
        <span>{produtoDe(o) ? `${o.fornecedor || 'Fornecedor sem nome'} · ${servicoBase(o)}` : o.servico}</span>
      </div>
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
            <span className="t" title={joined ? 'toque para desmarcar' : 'sem compromisso: só mostra que você tem interesse'}><b>{joined ? 'no grupo' : 'fechar em grupo'}</b>{joined && <small>toque para sair</small>}</span>
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
          {o.resumo && <p className="ape-resumo">{o.resumo}</p>}
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
      <div className="ape-acts ape-oc-acts">
        {vendorWa && c.st === 'vencido' ? (
          <a className="ape-btn sm" href={wa(vendorWa, `Oi! ${me ? `Sou ${me.nome}, ` : ''}do ${APE.condominio}. Vi o orçamento de ${nicho(o.nicho).l.toLowerCase()} que vocês mandaram${o.validade ? ` (validade ${dmy(o.validade)})` : ''}. Ele ainda vale? Se mudou, pode me mandar o valor atualizado?`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />perguntar se ainda vale</a>
        ) : vendorWa ? (
          <a className="ape-btn primary wide" href={wa(vendorWa, msgFornecedor(o, me))} target="_blank" rel="noopener noreferrer">
            <ApeIcon name="chat" />
            falar com o fornecedor
          </a>
        ) : null}
        <button className={`ape-btn sm ${minha ? 'rose' : ''}`} onClick={() => void fechar()} disabled={esc} aria-pressed={minha} title={minha ? 'Tocar de novo desmarca' : 'Marca este como o que você pretende contratar (um por serviço); os vizinhos veem quantos escolheram'}>
          <ApeIcon name={minha ? 'check' : 'star'} />
          {minha ? 'minha escolha' : 'marcar como escolha'}
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

/** Dica discreta da loja na área dos orçamentos: aparece de vez em quando (depois de rolar um pouco), fecha num toque e some por uns dias. */
const DICA = 'ape-dica-orc'
function DicaLoja({ nicho: n, produtos }: { nicho: Nicho; produtos: Produto[] }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const ate = read<number>(DICA) || 0
    if (Date.now() < ate) return
    let feito = false
    const abre = () => { if (!feito) { feito = true; setOn(true) } }
    const t = window.setTimeout(abre, 40000)
    const rola = () => { if (window.scrollY > window.innerHeight * 1.2) abre() }
    window.addEventListener('scroll', rola, { passive: true })
    return () => { window.clearTimeout(t); window.removeEventListener('scroll', rola) }
  }, [])
  const ativos = produtos.filter((p) => p.ativo)
  const p = ativos.find((x) => x.id === (CTA_BY[n] || 'guia')) || ativos.find((x) => x.id === 'guia') || ativos[0]
  if (!on || !p) return null
  const fechar = () => { write(DICA, Date.now() + 5 * 864e5); setOn(false) }
  return (
    <aside className="ape-dica" role="complementary" aria-label="Dica">
      <span className="ic"><ApeIcon name="sparkle" /></span>
      <a href={href('ape', `loja:${p.id}`)} onClick={fechar}><small>dica</small><b>{p.nome}</b></a>
      <button type="button" className="ape-icobtn" onClick={fechar} aria-label="Fechar a dica"><ApeIcon name="x" /></button>
    </aside>
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

