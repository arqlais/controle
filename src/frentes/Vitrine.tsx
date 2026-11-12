import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { href } from '../router'
import { Icon } from '../components/Icon'
import { depoimentos as carregarDepoimentos, loadPublico, type Ajustes } from '../ape/api'
import { APE, conta, cupomDaFrente, frenteDe, reais, fmtPreco, wa, type Produto } from '../ape/model'
import { AvisoCookies, useCarrinho, useToast, useTravaRolagem } from '../ape/shared'
import { frente, type FrenteId } from './frentes'
import { Cabeca, Faixa, Final, Flutua, Rodape, Topo, rolar, useReveal, Manchas } from './ui'
import { ESTILOS, imgEstilo, temEstilos, type Estilo } from './estilos'
import './frentes.css'

// checkout, pedido, carrinho e conta só baixam quando a pessoa abre (a vitrine abre mais rápido)
const Checkout = lazy(() => import('../ape/Loja').then((m) => ({ default: m.Checkout })))
const PedidoPage = lazy(() => import('../ape/Loja').then((m) => ({ default: m.PedidoPage })))
const CarrinhoSheet = lazy(() => import('../ape/Loja').then((m) => ({ default: m.CarrinhoSheet })))
const Conta = lazy(() => import('../ape/Conta').then((m) => ({ default: m.Conta })))

/* Vitrine de uma frente da planê (#/arquivos e #/arq), no desenho da página de vendas da planê.arq.
   Mesmo catálogo, checkout, pedido e entrega da loja do apê (src/ape): cada produto diz a frente e o nicho;
   o que ainda não tem arquivo aparece em "em breve" (ativo: false no painel → produtos e preços). */

type Id = Exclude<FrenteId, 'apzinho'>
const AM = (f: string) => `ape/amostras/${f}`
const NICHOS: Record<string, string> = { beleza: 'beleza', freelancer: 'freelancers', arquitetura: 'arquitetura' }

const TEXTO: Record<Id, {
  kicker: string; titulo: ReactNode; lead: string; chip: string; arte: string; arteLabel: string
  flutua: [string, string, string, string?][]; catalogo: ReactNode; faq: [string, string][]; final: ReactNode
}> = {
  arquivos: {
    kicker: 'para profissionais da beleza: sobrancelha, cílios, unhas, cabelo, estética e noivas',
    titulo: <>arquivos prontos para <em>mandar hoje</em></>,
    lead: 'Mais de 40 arquivos para imprimir e para mandar: fichas, termos, cuidados pós, stories com espaço para as suas fotos, cartões e planilhas. Troque o que está entre colchetes e use no mesmo dia.',
    chip: 'editável no Canva, no Word e no Excel',
    arte: AM('t-beleza-stories-mes.webp'),
    arteLabel: 'useplane.com.br/arquivos',
    flutua: [['download', 'baixa na hora', 'depois do Pix ou do cartão', 'good'], ['image', 'com as suas fotos', 'arraste no Canva'], ['printer', 'imprimir ou mandar', 'A4, A6, cartões e stories', 'warn']],
    catalogo: <>os <em>arquivos</em></>,
    faq: [
      ['como recebo os arquivos?', 'Pagou no Pix ou no cartão, a página do pedido mostra os botões de baixar na hora. O link também chega por e-mail e fica guardado em minha conta.'],
      ['preciso do Canva pago?', 'Não. As artes abrem no Canva gratuito (criar design → importar arquivo), no Google Slides ou no PowerPoint. Os documentos abrem no Word ou no Google Docs, e as planilhas no Excel ou no Google Planilhas.'],
      ['posso mudar cores, fontes e textos?', 'Pode. Tudo é editável e as fontes usadas são gratuitas.'],
      ['posso usar com todas as minhas clientes?', 'Sim, no seu próprio negócio, quantas vezes quiser. Só não pode revender nem repassar os arquivos.'],
      ['e se eu não gostar?', 'Você tem 7 dias para desistir, com o dinheiro de volta, direto em minha conta.'],
    ],
    final: <>o seu atendimento, <em>mais leve</em></>,
  },
  arq: {
    kicker: 'para estudantes, recém-formados e escritórios pequenos',
    titulo: <>do primeiro cliente ao <em>primeiro escritório</em></>,
    lead: 'Os mesmos modelos que a gestão planê.arq usa, para comprar avulsos: proposta, contrato, briefing, levantamento, honorários e manual do cliente.',
    chip: 'Word, PDF, Canva e Excel',
    arte: AM('t-kit-arq-primeiro.webp'),
    arteLabel: 'useplane.com.br/arq',
    flutua: [['file', 'kit primeiro cliente', '4 modelos com 30% off', 'good'], ['edit', 'com a sua marca', 'logo, cores e textos'], ['sparkle', 'gestão grátis', '14 dias para testar', 'warn']],
    catalogo: <>os <em>modelos</em></>,
    faq: [
      ['como recebo os modelos?', 'Pagou no Pix ou no cartão, a página do pedido mostra os botões de baixar na hora. O link também chega por e-mail e fica em minha conta.'],
      ['os contratos valem juridicamente?', 'São modelos de referência, com as cláusulas que mais evitam problema. Adapte ao seu caso e, se tiver dúvida, peça para um advogado revisar.'],
      ['posso colocar a minha marca?', 'Pode. Word, Canva e Excel são editáveis: logo, cores, fontes e textos.'],
      ['qual a diferença para a gestão?', 'Os modelos são arquivos para usar como quiser. A gestão planê.arq organiza clientes, propostas, contratos com assinatura, cobranças e agenda, e preenche os documentos sozinha.'],
      ['e se eu não gostar?', 'Você tem 7 dias para desistir, com o dinheiro de volta, direto em minha conta.'],
    ],
    final: <>o seu escritório, <em>organizado</em></>,
  },
}

const PASSOS = [
  { icone: 'search', t: 'escolha', s: 'Veja por dentro: capa, páginas e o formato de cada arquivo.' },
  { icone: 'lock', t: 'pague no Pix ou no cartão', s: 'Pix com 5% de desconto. Compra segura pelo Asaas.' },
  { icone: 'download', t: 'baixe e edite', s: 'Os botões de baixar aparecem na hora e ficam em minha conta.' },
]

const GESTAO = [
  { icone: 'users', t: 'clientes e demandas', s: 'Tudo de cada cliente num lugar só, com prazos e prioridades.' },
  { icone: 'file', t: 'proposta e contrato', s: 'Saem prontos, com a sua marca, e o cliente assina pelo link.' },
  { icone: 'wallet', t: 'cobranças', s: 'Parcelas, lembretes e quanto entrou no mês.' },
  { icone: 'calendar', t: 'agenda e obra', s: 'Etapas, visitas e acompanhamento com fotos.' },
]

export function Vitrine({ id, sub }: { id: Id; sub?: string }) {
  const f = frente(id)
  const [aj, setAj] = useState<Ajustes | null>(null)
  // o estilo do checkout, do carrinho e dos avisos baixa logo depois da vitrine aparecer
  const [estilo, setEstilo] = useState(false)
  useEffect(() => {
    void import('../ape/ape.css').then(() => setEstilo(true))
  }, [])
  useEffect(() => {
    void loadPublico(null, false).then((d) => setAj(d.ajustes), () => setAj({ produtos: [] }))
    // o checkout já vai baixando enquanto a pessoa escolhe (quem economiza dados não baixa antes da hora)
    const pre = () => void import('../ape/Loja')
    const w = window as Window & { requestIdleCallback?: (f: () => void) => number }
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
    if (w.requestIdleCallback) w.requestIdleCallback(pre)
    else setTimeout(pre, 1500)
  }, [])
  useEffect(() => {
    document.title = `${f.nome} · ${f.frase}`
    window.scrollTo(0, 0)
  }, [id, sub])
  const whats = aj?.whatsapp || APE.whatsapp
  const cart = useCarrinho()
  const view = sub === 'checkout' ? 'checkout' : sub?.startsWith('pedido:') ? 'pedido' : sub?.startsWith('conta') ? 'conta' : 'loja'
  const acoes = (
    <>
      <a className="btn ghost small hide-mobile" href={href(id, 'conta')}>
        minha conta
      </a>
      <a className={`btn small fr-cart ${cart.ids.length ? 'primary' : 'ghost'}`} href={href(id, 'loja:carrinho')} aria-label={`Carrinho com ${cart.ids.length} itens`}>
        <Icon name="box" size={16} />
        <span className="num" key={cart.ids.length}>
          {cart.ids.length}
        </span>
      </a>
    </>
  )
  if (view !== 'loja')
    return (
      <div className="lp fr">
        <Topo atual={f} acoes={acoes} />
        <main className="lp-wrap fr-sub">
          <div className="ape fr-ape">
            <Suspense fallback={<div className="fr-skel" aria-label="carregando"><div /><div /></div>}>
              {!aj || !estilo ? (
                <div className="fr-skel" aria-label="carregando"><div /><div /></div>
              ) : view === 'checkout' ? (
                <Checkout ajustes={aj} me={null} whats={whats} />
              ) : view === 'pedido' ? (
                <PedidoPage token={sub!.slice(7)} whats={whats} produtos={aj.produtos} />
              ) : (
                <Conta sub={sub} whats={whats} />
              )}
            </Suspense>
          </div>
        </main>
        <Rodape />
      </div>
    )
  return <Loja id={id} aj={aj} whats={whats} estilo={estilo} acoes={acoes} abrir={sub?.startsWith('loja:') ? sub.slice(5) : undefined} />
}

function Loja({ id, aj, whats, estilo, acoes, abrir }: { id: Id; aj: Ajustes | null; whats: string; estilo: boolean; acoes: ReactNode; abrir?: string }) {
  const f = frente(id)
  const T = TEXTO[id]
  const root = useRef<HTMLDivElement>(null)
  const pixPct = aj?.pixPct ?? 5
  const daqui = useMemo(() => (aj?.produtos || []).filter((p) => frenteDe(p) === id), [aj, id])
  // filtros: nicho, sub-nicho, uso (imprimir ou mandar), tipo e busca
  const nichos = [...new Set(daqui.filter((p) => p.ativo).map((p) => p.nicho || 'outros'))]
  const [nicho, setNicho] = useState('')
  const [sub, setSub] = useState('')
  const [uso, setUso] = useState<'' | 'imprimir' | 'digital'>('')
  const [tipo, setTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [limite, setLimite] = useState(12)
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const doNicho = daqui.filter((p) => p.ativo && (!nicho || p.nicho === nicho))
  const subs = [...new Set(doNicho.map((p) => p.sub).filter((x): x is string => !!x && x !== 'todos' && x !== nicho))]
  const tipos = [...new Set(doNicho.map((p) => p.tipo).filter((x): x is string => !!x && x !== 'kits'))]
  const filtrados = doNicho.filter((p) => (!sub || p.sub === sub || p.sub === 'todos') && (!uso || p.uso === uso || p.uso === 'ambos') && (!tipo || p.tipo === tipo) && (!busca.trim() || norm(`${p.nome} ${p.desc} ${p.sub || ''} ${p.tipo || ''} ${p.tag}`).includes(norm(busca.trim()))))
  const kitsF = filtrados.filter((p) => p.cat === 'combos')
  const arqsF = filtrados.filter((p) => p.cat !== 'combos')
  const ativos = filtrados
  const algumFiltro = !!(sub || uso || tipo || busca.trim())
  const limpar = () => { setSub(''); setUso(''); setTipo(''); setBusca(''); setLimite(12) }
  useEffect(() => setLimite(12), [nicho, sub, uso, tipo, busca])
  const breve = daqui.filter((p) => !p.ativo)
  const [depos, setDepos] = useState<Awaited<ReturnType<typeof carregarDepoimentos>>>([])
  useEffect(() => void carregarDepoimentos(id).then(setDepos), [id])
  useReveal(root, `${ativos.length}-${nicho}-${sub}-${uso}-${tipo}-${limite}-${depos.length}`)
  const cart = useCarrinho()
  const [aberto, setAberto] = useState<Produto | null>(null)
  useEffect(() => {
    if (abrir && abrir !== 'carrinho') setAberto(daqui.find((p) => p.id === abrir) || null)
  }, [abrir, daqui.length])
  const [verCarrinho, setVerCarrinho] = useState(abrir === 'carrinho')
  useEffect(() => setVerCarrinho(abrir === 'carrinho'), [abrir])
  const [toast, show] = useToast()
  useTravaRolagem(!!aberto || verCarrinho)
  const add = (p: Produto) => {
    cart.add(p.id)
    show('No carrinho.')
  }
  const pix = (p: Produto) => fmtPreco(Math.round(reais(p.preco) * (100 - pixPct)) / 100)
  const tot = conta(cart.ids, aj?.produtos || [], 'pix', pixPct)
  const nomes = daqui.filter((p) => p.ativo && p.cat !== 'combos').map((p) => p.nome.toLowerCase())
  // cupom de lançamento (painel → produtos e preços): o toque guarda e o checkout já aplica
  const cupom = aj ? cupomDaFrente(aj.cupons, id) : null
  const [usou, setUsou] = useState(false)
  const usarCupom = () => {
    if (!cupom) return
    try { localStorage.setItem('plane-cupom', cupom.codigo) } catch { /* ok */ }
    setUsou(true)
    show(`Cupom ${cupom.codigo} guardado: o desconto aparece no checkout.`)
  }

  return (
    <div className="lp fr" ref={root}>
      <Topo atual={f} acoes={acoes} />

      <section className="lp-hero">
        <Manchas />
        <div className="lp-wrap lp-hero-in">
          <div className="lp-hero-text">
            {cupom && (
              <button className="lp-ref-pill fr-cupom" onClick={usarCupom}>
                <Icon name={usou ? 'check' : 'gift'} size={14} />
                <span>
                  cupom <b>{cupom.codigo}</b>: <span className="num">{cupom.pct}%</span> off{cupom.ate ? ` até ${cupom.ate.slice(8, 10)}/${cupom.ate.slice(5, 7)}` : ''} · {usou ? 'guardado' : 'toque para usar'}
                </span>
              </button>
            )}
            <p className="lp-kicker">
              <span className="lp-dot" /> {T.kicker}
            </p>
            <h1>{T.titulo}</h1>
            <p className="lp-lead">{T.lead}</p>
            <p className="lp-auto-chip">
              <Icon name="sparkle" size={14} /> {T.chip}
            </p>
            <div className="row gap-s wrap">
              <button className="btn primary lp-cta lp-shine" onClick={() => rolar('catalogo')}>
                ver {id === 'arq' ? 'os modelos' : 'os arquivos'} <Icon name="arrowRight" size={16} />
              </button>
              {id === 'arq' ? (
                <a className="btn ghost lp-cta" href="#/vendas">
                  conhecer a gestão
                </a>
              ) : (
                <button className="btn ghost lp-cta" onClick={() => rolar('como')}>
                  como funciona
                </button>
              )}
            </div>
            <p className="muted small">Pix com {pixPct}% de desconto · baixa na hora · 7 dias para desistir</p>
          </div>
          <div className="lp-hero-art" aria-hidden>
            <img className="fr-hero-solta" src={T.arte} alt="" />
            {T.flutua.map(([ic, t, s, tom], i) => (
              <Flutua key={t} n={(i + 1) as 1 | 2 | 3} icone={ic} titulo={t} sub={s} tom={tom as 'good' | 'warn' | undefined} />
            ))}
          </div>
        </div>
      </section>

      {nomes.length > 0 && <Faixa itens={nomes} />}

      <section className="lp-section lp-alt fr-com-manchas" id="como">
        <Manchas v="b" />
        <div className="lp-wrap">
          <Cabeca eyebrow="como funciona" title={<>três passos, <em>sem complicação</em></>} />
          <div className="lp-diffs-grid fr-3">
            {PASSOS.map((d, i) => (
              <article key={d.t} className="lp-diff" data-reveal style={{ transitionDelay: `${i * 0.08}s` }}>
                <span className="lp-diff-ico">
                  <Icon name={d.icone} size={20} />
                </span>
                <b>
                  <span className="fr-n num">{i + 1}.</span> {d.t}
                </b>
                <small>{d.s}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="catalogo">
        <div className="lp-wrap">
          <Cabeca eyebrow={f.para} title={T.catalogo} text="Toque para ver por dentro." />
          {nichos.length > 1 && (
            <div className="lp-aud fr-tabs" role="tablist" aria-label="nichos" data-reveal>
              <button role="tab" aria-selected={!nicho} className={!nicho ? 'is-on' : ''} onClick={() => setNicho('')}>
                todos
              </button>
              {nichos.map((n) => (
                <button key={n} role="tab" aria-selected={nicho === n} className={nicho === n ? 'is-on' : ''} onClick={() => setNicho(n)}>
                  {NICHOS[n] || n}
                </button>
              ))}
            </div>
          )}
          {aj && (
            <div className="fr-filtros" data-reveal>
              <label className="fr-busca">
                <Icon name="search" size={16} />
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar: anamnese, cuidados, stories…" aria-label="Buscar arquivos" />
              </label>
              <div className="lp-aud fr-uso" role="tablist" aria-label="para imprimir ou para mandar">
                {([['', 'tudo'], ['imprimir', 'para imprimir'], ['digital', 'para mandar']] as const).map(([v, l]) => (
                  <button key={v} role="tab" aria-selected={uso === v} className={uso === v ? 'is-on' : ''} onClick={() => setUso(v)}>
                    {v === 'imprimir' ? <Icon name="printer" size={14} /> : v === 'digital' ? <Icon name="smartphone" size={14} /> : null} {l}
                  </button>
                ))}
              </div>
              {subs.length > 1 && (
                <div className="fr-chips" role="group" aria-label="área">
                  <button className={!sub ? 'is-on' : ''} onClick={() => setSub('')}>todas as áreas</button>
                  {subs.map((x) => (
                    <button key={x} className={sub === x ? 'is-on' : ''} onClick={() => setSub(sub === x ? '' : x)}>{x}</button>
                  ))}
                </div>
              )}
              {tipos.length > 1 && (
                <div className="fr-chips is-tipo" role="group" aria-label="tipo">
                  {tipos.map((x) => (
                    <button key={x} className={tipo === x ? 'is-on' : ''} onClick={() => setTipo(tipo === x ? '' : x)}>{x}</button>
                  ))}
                </div>
              )}
              <p className="fr-conta muted small">
                <span className="num">{arqsF.length}</span> {arqsF.length === 1 ? 'arquivo' : 'arquivos'}
                {kitsF.length > 0 && <> e <span className="num">{kitsF.length}</span> {kitsF.length === 1 ? 'kit' : 'kits'}</>}
                {algumFiltro && <button className="link" onClick={limpar}>limpar filtros</button>}
              </p>
            </div>
          )}
          {!aj ? (
            <div className="fr-skel" aria-label="carregando"><div /><div /><div /></div>
          ) : !filtrados.length ? (
            <div className="card fr-vazio">
              <b>nada encontrado com esses filtros</b>
              <button className="btn ghost small" onClick={limpar}>ver todos</button>
            </div>
          ) : (
            <>
              {kitsF.length > 0 && !tipo && (
                <div className="fr-kits">
                  <p className="eyebrow">kits com desconto</p>
                  <div className="fr-kits-trilho">
                    {kitsF.map((p) => <Cartao key={p.id} p={p} kit pix={pix(p)} noCarrinho={cart.tem(p.id)} onAdd={() => add(p)} onVer={() => setAberto(p)} />)}
                  </div>
                </div>
              )}
              <div className="fr-grid">
                {(tipo === 'kits' ? kitsF : arqsF).slice(0, limite).map((p, i) => (
                  <Cartao key={p.id} p={p} i={i} pix={pix(p)} noCarrinho={cart.tem(p.id)} onAdd={() => add(p)} onVer={() => setAberto(p)} />
                ))}
              </div>
              {arqsF.length > limite && (
                <div className="fr-mais">
                  <button className="btn ghost lp-cta" onClick={() => setLimite((l) => l + 12)}>
                    ver mais <span className="num">{arqsF.length - limite}</span>
                  </button>
                </div>
              )}
            </>
          )}
          {breve.length > 0 && (
            <div className="fr-breve" data-reveal>
              <p className="eyebrow">em breve</p>
              <div className="fr-breve-l">
                {breve.map((p) => (
                  <a key={p.id} className="fr-breve-i" href={wa(whats, `Oi! Quero saber quando sair: ${p.nome} (${f.nome}).`)} target="_blank" rel="noopener noreferrer">
                    <b>{p.nome}</b>
                    <span>
                      <Icon name="bell" size={14} /> me avise
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {id === 'arq' && (
        <section className="lp-section lp-alt">
          <div className="lp-wrap">
            <Cabeca eyebrow="quando o escritório crescer" title={<>a gestão planê<em>.arq</em></>} text="Os mesmos modelos, preenchidos sozinhos com os dados de cada cliente. 14 dias grátis, sem cartão." />
            <div className="lp-diffs-grid">
              {GESTAO.map((d, i) => (
                <article key={d.t} className="lp-diff" data-reveal style={{ transitionDelay: `${i * 0.08}s` }}>
                  <span className="lp-diff-ico">
                    <Icon name={d.icone} size={20} />
                  </span>
                  <b>{d.t}</b>
                  <small>{d.s}</small>
                </article>
              ))}
            </div>
            <div className="row gap-s wrap fr-mt" data-reveal>
              <a className="btn primary lp-cta lp-shine" href="#/vendas">
                conhecer a gestão <Icon name="arrowRight" size={16} />
              </a>
              <a className="btn ghost lp-cta" href="#/entrar">
                já sou assinante
              </a>
            </div>
          </div>
        </section>
      )}

      {depos.length > 0 && (
        <section className="lp-section">
          <div className="lp-wrap">
            <Cabeca eyebrow="quem comprou" title={<>quem usa, <em>conta</em></>} />
            <div className="fr-depos" data-stagger>
              {depos.slice(0, 6).map((d, i) => {
                const [nome, onde] = String(d.nome || '').split(/\s+[-–·]\s+/)
                return (
                  <figure key={i} className="card fr-depo">
                    <blockquote>{d.texto}</blockquote>
                    <figcaption>
                      <span className="fr-av">{(nome || '?').trim().charAt(0).toUpperCase()}</span>
                      <span>
                        <b>{nome}</b>
                        {onde && <small className="muted">{onde}</small>}
                      </span>
                      {d.nota ? <span className="fr-nota" aria-label={`${d.nota} de 5`}>{'★'.repeat(d.nota)}</span> : null}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <section className="lp-section lp-alt" id="duvidas">
        <div className="lp-wrap lp-faq-wrap">
          <Cabeca eyebrow="dúvidas" title={<>perguntas <em>frequentes</em></>} />
          <div className="lp-faq">
            {T.faq.map(([q, a]) => (
              <details key={q} className="card lp-faq-item">
                <summary>
                  {q}
                  <Icon name="plus" size={16} />
                </summary>
                <p className="muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Final titulo={T.final} texto="Baixa na hora, edita do seu jeito e usa no mesmo dia." botao={id === 'arq' ? 'ver os modelos' : 'ver os arquivos'} href={`#/${id}`} />
      <Rodape />

      {cart.ids.length > 0 && !verCarrinho && (
        <a className="fr-cartbar" href={href(id, 'loja:carrinho')}>
          <span>
            <b className="num">{tot.itens.length}</b> {tot.itens.length === 1 ? 'item' : 'itens'} · <span className="num">{fmtPreco(tot.totalPix)}</span> no Pix
          </span>
          <span>
            ver carrinho <Icon name="arrowRight" size={16} />
          </span>
        </a>
      )}

      {aberto && <Detalhe p={aberto} pixTxt={pix(aberto)} pixPct={pixPct} noCarrinho={cart.tem(aberto.id)} onAdd={() => add(aberto)} onClose={() => setAberto(null)} />}
      <div className="ape fr-ape">
        {verCarrinho && estilo && aj && (
          <Suspense fallback={null}>
            <CarrinhoSheet
              produtos={aj.produtos}
              pixPct={pixPct}
              cart={cart}
              onClose={() => {
                setVerCarrinho(false)
                history.replaceState(null, '', href(id))
              }}
              onOpen={(p) => {
                setVerCarrinho(false)
                setAberto(p)
              }}
            />
          </Suspense>
        )}
        {toast}
        {estilo && <AvisoCookies />}
      </div>
    </div>
  )
}

const USO: Record<string, [string, string]> = { imprimir: ['printer', 'imprimir'], digital: ['smartphone', 'digital'], ambos: ['layers', 'imprimir e digital'] }

/** Cartão de produto da vitrine (também na faixa de kits). */
function Cartao({ p, i = 0, kit, pix, noCarrinho, onAdd, onVer }: { p: Produto; i?: number; kit?: boolean; pix: string; noCarrinho: boolean; onAdd: () => void; onVer: () => void }) {
  const u = p.uso ? USO[p.uso] : null
  const [est, setEst] = useState<Estilo>('criativo')
  const capa = temEstilos(p.id) ? imgEstilo(p.id, est, p.amostras?.[0]) : p.amostras?.[0]
  return (
    <article className={`fr-card ${p.cat === 'combos' ? 'is-kit' : ''} ${kit ? 'is-trilho' : ''}`} data-reveal style={{ transitionDelay: `${Math.min(i, 5) * 0.06}s` }}>
      <button className="fr-card-img" onClick={onVer} aria-label={`Ver ${p.nome} por dentro`}>
        {capa && <img key={capa} className={est !== 'criativo' ? 'is-estilo' : ''} src={capa} alt="" loading="lazy" decoding="async" width={1200} height={900} />}
        {p.selo && <span className="fr-selo">{p.selo}</span>}
        <span className="fr-ver">
          <Icon name="eye" size={14} /> ver por dentro
        </span>
      </button>
      <div className="fr-card-b">
        <small className="fr-tag">
          {p.cat === 'combos' ? `kit · ${(p.combo || []).length} arquivos · ${p.kitPct || 0}% off` : p.sub && p.sub !== 'todos' ? p.sub : NICHOS[p.nicho || ''] || p.tag}
        </small>
        <b>{p.nome}</b>
        <p>{p.desc}</p>
        {temEstilos(p.id) && <Estilos est={est} onEst={setEst} />}
        {u && (
          <span className="fr-uso-tag">
            <Icon name={u[0]} size={13} /> {u[1]}
          </span>
        )}
        <div className="fr-preco">
          <span className="num">{p.preco}</span>
          <small className="num">{pix} no Pix</small>
        </div>
        <div className="row gap-s">
          <button className={`btn small ${noCarrinho ? 'ghost' : 'primary'}`} onClick={onAdd} disabled={noCarrinho}>
            <Icon name={noCarrinho ? 'check' : 'plus'} size={14} /> {noCarrinho ? 'no carrinho' : 'adicionar'}
          </button>
          <button className="btn ghost small" onClick={onVer}>
            detalhes
          </button>
        </div>
      </div>
    </article>
  )
}

/** Bolinhas para trocar o estilo (criativo, minimalista, chique). */
function Estilos({ est, onEst }: { est: Estilo; onEst: (e: Estilo) => void }) {
  return (
    <div className="fr-estilos" role="radiogroup" aria-label="Estilo">
      {ESTILOS.map((e) => (
        <button key={e.id} role="radio" aria-checked={est === e.id} className={est === e.id ? 'is-on' : ''} onClick={() => onEst(e.id)}>
          <i style={{ background: e.cor }} /> {e.nome}
        </button>
      ))}
    </div>
  )
}

/** Detalhe do produto: galeria (mockup e páginas de dentro), o que vem, formato e preço. */
function Detalhe({ p, pixTxt, pixPct, noCarrinho, onAdd, onClose }: { p: Produto; pixTxt: string; pixPct: number; noCarrinho: boolean; onAdd: () => void; onClose: () => void }) {
  const est = temEstilos(p.id)
  const fotos = est ? [(p.amostras || [])[0], imgEstilo(p.id, 'minimalista')!, imgEstilo(p.id, 'chique')!, ...(p.amostras || []).slice(1)].filter(Boolean) as string[] : p.amostras || []
  const [i, setI] = useState(0)
  const trilho = useRef<HTMLDivElement>(null)
  const ir = (n: number) => {
    const el = trilho.current
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])
  return (
    <div className="fr-modal" role="dialog" aria-modal="true" aria-label={p.nome} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fr-modal-in">
        <button className="fr-x" onClick={onClose} aria-label="Fechar">
          <Icon name="x" size={18} />
        </button>
        <div className="fr-gal">
          <div className="fr-gal-trilho" ref={trilho} onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}>
            {fotos.map((src, k) => (
              <div key={src} className={`fr-gal-i ${k === 0 ? 'is-cena' : 'is-pagina'}`}>
                <img src={src} alt={k === 0 ? p.nome : `${p.nome}: página ${k + 1}`} decoding="async" />
              </div>
            ))}
          </div>
          {fotos.length > 1 && (
            <div className="fr-gal-pontos">
              {fotos.map((_, k) => (
                <button key={k} className={k === i ? 'is-on' : ''} onClick={() => ir(k)} aria-label={`Imagem ${k + 1}`} />
              ))}
            </div>
          )}
        </div>
        <div className="fr-modal-b">
          <p className="eyebrow">{p.tag}</p>
          <h2>{p.nome}</h2>
          <p className="muted">{p.desc}</p>
          {est && (
            <div className="fr-estilos-d">
              <small>três estilos na mesma compra</small>
              <Estilos est={(['criativo', 'minimalista', 'chique'] as Estilo[])[Math.min(i, 2)]} onEst={(e) => ir(ESTILOS.findIndex((x) => x.id === e))} />
            </div>
          )}
          {!!p.numeros?.length && (
            <div className="fr-nums">
              {p.numeros.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
          )}
          {!!p.itens?.length && (
            <ul className="fr-checks">
              {p.itens.map((t) => (
                <li key={t}>
                  <Icon name="check" size={16} /> {t}
                </li>
              ))}
            </ul>
          )}
          <dl className="fr-ficha">
            <dt>formato</dt>
            <dd>{p.formato}</dd>
            <dt>entrega</dt>
            <dd>{p.entrega}</dd>
          </dl>
          <div className="fr-modal-pe">
            <div className="fr-preco">
              <span className="num">{p.preco}</span>
              <small className="num">
                {pixTxt} no Pix (−{pixPct}%)
              </small>
            </div>
            {p.ativo && (
              <button className="btn primary lp-cta" onClick={onAdd} disabled={noCarrinho}>
                <Icon name={noCarrinho ? 'check' : 'plus'} size={16} /> {noCarrinho ? 'no carrinho' : 'adicionar ao carrinho'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
