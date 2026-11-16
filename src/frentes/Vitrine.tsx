import { TRIAL_DAYS } from '../plans'
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { href } from '../router'
import { Icon } from '../components/Icon'
import { depoimentos as carregarDepoimentos, loadPublico, type Ajustes } from '../ape/api'
import { APE, CARTAO_PCT, SEM_JUROS_MAX, precoCartao, maxSemJuros, conta, cupomDaFrente, frenteDe, reais, fmtPreco, wa, type Produto } from '../ape/model'
import { AvisoCookies, useCarrinho, useToast, useTravaRolagem } from '../ape/shared'
import { frente, type FrenteId } from './frentes'
import { Cabeca, Final, Rodape, Topo, rolar, useReveal, Manchas, Iphone } from './ui'
import { ESTILOS, ESTILO_PADRAO, comEstilos, estiloDoId, estilosNoCarrinho, idNoCarrinho, imgEstilo, nomeEstilo, paginasDe, noCelular, temEstilos, temPrevia, type Estilo } from './estilos'
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
    kicker: 'para profissionais da beleza e freelancers: unhas, cílios, sobrancelha, biomedicina, estética, cabelo e noivas',
    titulo: <>arquivos prontos para <em>mandar hoje</em></>,
    lead: 'Mais de 40 arquivos para imprimir e para mandar: fichas, termos, cuidados pós, stories com espaço para as suas fotos, cartões e planilhas. Troque o que está entre colchetes e use no mesmo dia.',
    chip: 'editável no Canva, no Word e no Excel',
    arte: AM('t-beleza-stories-mes.webp'),
    arteLabel: 'useplane.com.br/arquivos',
    flutua: [['download', 'baixa na hora', 'depois do Pix ou do cartão', 'good'], ['image', 'com as suas fotos', 'arraste no Canva'], ['printer', 'imprimir ou mandar', 'A4, A6, cartões e stories', 'warn']],
    catalogo: <>os <em>arquivos</em></>,
    faq: [
      ['como recebo os arquivos?', 'Pagou no Pix ou no cartão, a página do pedido mostra os botões de baixar na hora. O link também chega por e-mail e fica guardado em minha conta.'],
      ['como edito no Canva?', 'As artes vão em PowerPoint: no Canva, toque em Criar design → Importar arquivo e troque textos, cores e fotos. Quando o arquivo tem link direto, o botão "editar no Canva" aparece na página do pedido. Fichas e contratos vão em Word e PDF; planilhas, em Excel.'],
      ['preciso do Canva pago?', 'Não. Tudo abre no Canva gratuito, e as fontes usadas são gratuitas.'],
      ['o que são os estilos?', 'São 4 estilos: delicado, criativo, minimalista e elegante. Escolha o que combina com o seu espaço; cada estilo é comprado à parte.'],
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
    flutua: [['file', 'kit primeiro cliente', '4 modelos com 30% off', 'good'], ['edit', 'com a sua marca', 'logo, cores e textos'], ['sparkle', 'gestão grátis', `${TRIAL_DAYS} dias para testar`, 'warn']],
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
  { icone: 'search', t: 'escolha o estilo', s: 'Veja cada arquivo por dentro, nos 4 estilos.' },
  { icone: 'lock', t: 'pague no Pix ou no cartão', s: 'Pix pelo preço da página ou crédito sem juros. Compra segura pelo Asaas.' },
  { icone: 'edit', t: 'edite do seu jeito', s: 'Os arquivos aparecem na hora, ficam em minha conta e abrem no Canva, no Word e no Excel.' },
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
  // carrinho, checkout e pedido enxergam cada estilo como um produto ("<id>--<estilo>")
  const ajV = useMemo(() => (aj ? { ...aj, produtos: comEstilos(aj.produtos) } : null), [aj])
  const pagina: Pagina = sub === 'produtos' ? 'produtos' : sub?.startsWith('p:') ? { produto: sub.slice(2) } : sub?.startsWith('loja:') && sub !== 'loja:carrinho' ? { produto: sub.slice(5) } : 'inicio'
  useEffect(() => {
    const t = typeof pagina === 'object' ? aj?.produtos.find((p) => p.id === pagina.produto)?.nome : pagina === 'produtos' ? 'todos os produtos' : f.frase
    document.title = `${f.nome.charAt(0).toUpperCase()}${f.nome.slice(1)} · ${t || f.frase}`
    window.scrollTo(0, 0)
  }, [id, sub, aj])
  const whats = aj?.whatsapp || APE.whatsapp
  const cart = useCarrinho()
  const view = sub === 'checkout' ? 'checkout' : sub?.startsWith('pedido:') ? 'pedido' : sub?.startsWith('conta') ? 'conta' : 'loja'
  const n = cart.ids.length
  const acoes = (
    <>
      <a className="btn ghost small hide-mobile" href={href(id, 'conta')}>
        minha conta
      </a>
      <a className={`btn small fr-cart ${n ? 'primary is-cheio' : 'ghost'}`} href={href(id, 'loja:carrinho')} aria-label={`Carrinho com ${n} itens`}>
        <Icon name="bag" size={16} />
        <span className="num" key={n}>
          {n}
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
              {!ajV || !estilo ? (
                <div className="fr-skel" aria-label="carregando"><div /><div /></div>
              ) : view === 'checkout' ? (
                <Checkout ajustes={ajV} me={null} whats={whats} />
              ) : view === 'pedido' ? (
                <PedidoPage token={sub!.slice(7)} whats={whats} produtos={ajV.produtos} />
              ) : (
                <Conta sub={sub} whats={whats} />
              )}
            </Suspense>
          </div>
        </main>
        <Rodape />
      </div>
    )
  return <Loja id={id} aj={aj} ajV={ajV} whats={whats} estilo={estilo} acoes={acoes} pagina={pagina} carrinho={sub === 'loja:carrinho'} />
}

type Pagina = 'inicio' | 'produtos' | { produto: string }
const rotaProduto = (id: Id, pid: string) => href(id, `p:${pid}`)

function Loja({ id, aj, ajV, whats, estilo, acoes, pagina, carrinho }: { id: Id; aj: Ajustes | null; ajV: Ajustes | null; whats: string; estilo: boolean; acoes: ReactNode; pagina: Pagina; carrinho: boolean }) {
  const f = frente(id)
  const root = useRef<HTMLDivElement>(null)
  const pixPct = aj?.pixPct ?? 0
  const cartaoPct = aj?.cartaoPct ?? CARTAO_PCT
  const semJ = aj?.semJurosMax ?? SEM_JUROS_MAX
  const daqui = useMemo(() => (aj?.produtos || []).filter((p) => frenteDe(p) === id), [aj, id])
  const cart = useCarrinho()
  const [toast, show] = useToast()
  const [verCarrinho, setVerCarrinho] = useState(carrinho)
  useEffect(() => setVerCarrinho(carrinho), [carrinho])
  useTravaRolagem(verCarrinho)
  const cupom = aj ? cupomDaFrente(aj.cupons, id) : null
  const [usou, setUsou] = useState(() => {
    try { return !!cupom && localStorage.getItem('plane-cupom') === cupom.codigo } catch { return false }
  })
  const usarCupom = () => {
    if (!cupom) return
    try { localStorage.setItem('plane-cupom', cupom.codigo) } catch { /* ok */ }
    setUsou(true)
    show(`Cupom ${cupom.codigo} guardado: o desconto aparece no checkout.`)
  }
  const add = (p: Produto, e: Estilo = ESTILO_PADRAO) => {
    const cid = idNoCarrinho(p, e)
    cart.add(cid)
    show(temEstilos(p) ? `${p.nome} · ${nomeEstilo(e)} no carrinho.` : `${p.nome} no carrinho.`)
  }
  const comprar = (p: Produto, e: Estilo) => {
    cart.add(idNoCarrinho(p, e))
    if (cupom && !usou) usarCupom()
    location.hash = href(id, 'checkout')
  }
  const tot = conta(cart.ids, ajV?.produtos || [], 'pix', pixPct, null, cartaoPct)
  const pagProduto = typeof pagina === 'object' ? daqui.find((p) => p.id === pagina.produto) || null : null
  useReveal(root, `${typeof pagina === 'object' ? pagina.produto : pagina}-${daqui.length}`)
  // a vitrine mostra sempre o preço redondo da tabela (ex.: R$ 19,90 no Pix); o cupom só entra no checkout
  const ctx: Ctx = { id, daqui, pixPct, cartaoPct, semJ, cupomPct: 0, cartIds: cart.ids, add }

  return (
    <div className={`lp fr ${cupom ? 'tem-oferta' : ''}`} ref={root}>
      {cupom && <Oferta codigo={cupom.codigo} pct={cupom.pct} ate={cupom.ate} usou={usou} onUsar={usarCupom} />}
      <Topo atual={f} acoes={acoes} />

      {pagina === 'inicio' && <Inicio ctx={ctx} aj={aj} whats={whats} />}
      {pagina === 'produtos' && <Produtos ctx={ctx} aj={aj} whats={whats} />}
      {typeof pagina === 'object' &&
        (pagProduto ? (
          <PaginaProduto key={pagProduto.id} ctx={ctx} p={pagProduto} onComprar={comprar} />
        ) : (
          <main className="lp-wrap fr-sub">
            <div className="card fr-vazio">
              <b>{aj ? 'produto não encontrado' : 'carregando…'}</b>
              {aj && <a className="btn primary" href={href(id, 'produtos')}>ver todos os produtos</a>}
            </div>
          </main>
        ))}

      <Rodape />

      {cart.ids.length > 0 && !verCarrinho && typeof pagina !== 'object' && (
        <a className="fr-cartbar" href={href(id, 'loja:carrinho')}>
          <span>
            <b className="num">{tot.itens.length}</b> {tot.itens.length === 1 ? 'item' : 'itens'} · <span className="num">{fmtPreco(tot.totalPix)}</span> no Pix
          </span>
          <span>
            finalizar <Icon name="arrowRight" size={16} />
          </span>
        </a>
      )}

      <div className="ape fr-ape">
        {verCarrinho && estilo && ajV && (
          <Suspense fallback={null}>
            <CarrinhoSheet
              cupons={ajV.cupons}
              produtos={ajV.produtos}
              pixPct={pixPct}
              cartaoPct={cartaoPct}
              semJ={semJ}
              cart={cart}
              onClose={() => {
                setVerCarrinho(false)
                history.replaceState(null, '', location.hash.replace('/loja:carrinho', '') || href(id))
              }}
              onOpen={(p) => {
                setVerCarrinho(false)
                location.hash = rotaProduto(id, estiloDoId(p.id).base)
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

interface Ctx { id: Id; daqui: Produto[]; pixPct: number; cartaoPct: number; semJ: number; cupomPct: number; cartIds: string[]; add: (p: Produto, e?: Estilo) => void }

/** Faixa do topo com a oferta: gira devagar, o presente balança e conta os dias que faltam. */
function Oferta({ codigo, pct, ate, usou, onUsar }: { codigo: string; pct: number; ate?: string; usou: boolean; onUsar: () => void }) {
  const dias = ate ? Math.ceil((new Date(`${ate}T23:59:59-03:00`).getTime() - Date.now()) / 864e5) : null
  return (
    <button className="fr-oferta" onClick={onUsar}>
      <span className="fr-oferta-in">
        <Icon name={usou ? 'check' : 'gift'} size={15} />
        <span>
          <b>{pct}% off</b> em tudo com o cupom <b>{codigo}</b>
          {dias != null && dias > 0 && dias <= 45 ? <> · faltam <span className="num">{dias}</span> {dias === 1 ? 'dia' : 'dias'}</> : ate ? <> · até {ate.slice(8, 10)}/{ate.slice(5, 7)}</> : null}
        </span>
        <span className="fr-oferta-b">{usou ? 'cupom guardado' : 'usar cupom'}</span>
      </span>
    </button>
  )
}

const ordenar = (ps: Produto[]) => [...ps].sort((a, b) => Number(!!b.selo) - Number(!!a.selo))

/** Página de vendas: chama para os mais procurados, os kits e os estilos; o catálogo inteiro fica em "produtos". */
function Inicio({ ctx, aj, whats }: { ctx: Ctx; aj: Ajustes | null; whats: string }) {
  const { id, daqui } = ctx
  const T = TEXTO[id]
  const ativos = daqui.filter((p) => p.ativo)
  const arqs = ordenar(ativos.filter((p) => p.cat !== 'combos'))
  const kits = ativos.filter((p) => p.cat === 'combos')
  const breve = daqui.filter((p) => !p.ativo)
  const [depos, setDepos] = useState<Awaited<ReturnType<typeof carregarDepoimentos>>>([])
  useEffect(() => void carregarDepoimentos(id).then(setDepos), [id])
  const vitrine = arqs.find((p) => p.id === 'beleza-stories-mes') || arqs.find((p) => temPrevia(p.id))
  return (
    <>
      <section className="lp-hero">
        <Manchas />
        <div className="lp-wrap lp-hero-in">
          <div className="lp-hero-text">
            <p className="lp-kicker">
              <span className="lp-dot" /> {T.kicker}
            </p>
            <h1>{T.titulo}</h1>
            <p className="lp-lead">{T.lead}</p>
            <div className="row gap-s wrap">
              <a className="btn primary lp-cta lp-shine fr-pulsa" href={href(id, 'produtos')}>
                ver todos os {id === 'arq' ? 'modelos' : 'arquivos'} <Icon name="arrowRight" size={16} />
              </a>
              {id === 'arq' ? (
                <a className="btn ghost lp-cta" href="#/vendas">
                  conhecer a gestão
                </a>
              ) : (
                <button className="btn ghost lp-cta" onClick={() => rolar('estilos')}>
                  ver os estilos
                </button>
              )}
            </div>
            <p className="muted small">{T.chip} · até {ctx.semJ}x sem juros · baixa na hora · 7 dias para desistir</p>
          </div>
          <div className="lp-hero-art" aria-hidden>
            {(() => {
              // topo da beleza: dois iPhones com stories de verdade e uma página impressa atrás
              if (id !== 'arq')
                return (
                  <span className="fr-hero-cel">
                    <img className="pag" src={paginasDe('beleza-anamnese')[0] || imgEstilo('beleza-anamnese', 'delicado')} alt="" decoding="async" />
                    <Iphone className="a" src={imgEstilo('beleza-stories-mes', 'delicado')} />
                    <Iphone className="b" src={imgEstilo('beleza-fim-de-ano', 'delicado')} />
                  </span>
                )
              // topo do arq: três páginas de verdade no estilo delicado, em leque
              const ids = id === 'arq' ? ['arq-proposta', 'arq-contrato', 'arq-briefing'] : ['beleza-precos', 'beleza-anamnese', 'beleza-stories-mes']
              const imgs = [imgEstilo(ids[0], 'delicado'), paginasDe(ids[1])[0] || imgEstilo(ids[1], 'delicado'), imgEstilo(ids[2], 'delicado')]
              return (
                <span className="fr-hero-leque">
                  {imgs.map((src, i) => <img key={src} className={`h${i}`} src={src} alt="" decoding="async" />)}
                </span>
              )
            })()}
          </div>
        </div>
      </section>


      <section className="lp-section" id="destaques">
        <div className="lp-wrap">
          <Cabeca eyebrow="os mais procurados" title={<>comece por <em>estes</em></>} />
          {!aj ? (
            <Esqueleto />
          ) : (
            <>
              <div className="fr-grid">
                {arqs.slice(0, 6).map((p, i) => (
                  <Cartao key={p.id} p={p} i={i} ctx={ctx} />
                ))}
              </div>
              <div className="fr-mais">
                <a className="btn primary lp-cta lp-shine" href={href(id, 'produtos')}>
                  ver todos os <span className="num">{arqs.length + kits.length}</span> produtos <Icon name="arrowRight" size={16} />
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {kits.length > 0 && (
        <section className="lp-section lp-alt">
          <div className="lp-wrap">
            <Cabeca eyebrow="kits com desconto" title={<>leve junto, <em>pague menos</em></>} />
            <div className="fr-kits-trilho">
              {kits.map((p, i) => (
                <Cartao key={p.id} p={p} i={i} ctx={ctx} kit />
              ))}
            </div>
          </div>
        </section>
      )}

      {vitrine && temPrevia(vitrine.id) && (
        <section className="lp-section fr-com-manchas" id="estilos">
          <Manchas v="b" />
          <div className="lp-wrap">
            <Cabeca eyebrow="4 estilos" title={<>o arquivo com <em>a sua cara</em></>} text="Quatro estilos para escolher o que combina com o seu espaço." centro />
            <div className="fr-estilos-vitrine">
              {ESTILOS.map((e, i) => (
                <a key={e.id} className="fr-estilo-card" href={href(id, 'produtos')} data-reveal style={{ transitionDelay: `${i * 0.08}s` }}>
                  <span className="fr-estilo-img">
                    <img src={imgEstilo(vitrine.id, e.id)} alt={`${vitrine.nome} no estilo ${e.nome}`} loading="lazy" decoding="async" />
                  </span>
                  <b>
                    <i style={{ background: e.cor, boxShadow: `0 0 0 2px ${e.aro}` }} /> {e.nome}
                  </b>
                  <small>{e.frase}</small>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="lp-section lp-alt" id="como">
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

      {id === 'arq' && (
        <section className="lp-section">
          <div className="lp-wrap">
            <Cabeca eyebrow="quando o escritório crescer" title={<>a gestão planê<em>.arq</em></>} text={`Os mesmos modelos, preenchidos sozinhos com os dados de cada cliente. ${TRIAL_DAYS} dias grátis, sem cartão.`} />
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

      {breve.length > 0 && (
        <section className="lp-section">
          <div className="lp-wrap">
            <div className="fr-breve" data-reveal>
              <p className="eyebrow">em breve</p>
              <div className="fr-breve-l">
                {breve.map((p) => (
                  <a key={p.id} className="fr-breve-i" href={wa(whats, `Oi! Quero saber quando sair: ${p.nome} (${frente(id).nome}).`)} target="_blank" rel="noopener noreferrer">
                    <b>{p.nome}</b>
                    <span>
                      <Icon name="bell" size={14} /> me avise
                    </span>
                  </a>
                ))}
              </div>
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

      <Final titulo={T.final} texto="Baixa na hora, edita do seu jeito e usa no mesmo dia." botao={id === 'arq' ? 'ver todos os modelos' : 'ver todos os arquivos'} href={href(id, 'produtos')} />
    </>
  )
}

function Esqueleto() {
  return <div className="fr-skel" aria-label="carregando"><div /><div /><div /></div>
}

/** Página com todos os produtos, organizados por área, uso e tipo, com busca. */
function Produtos({ ctx, aj }: { ctx: Ctx; aj: Ajustes | null; whats: string }) {
  const { id, daqui } = ctx
  const f = frente(id)
  const nichos = [...new Set(daqui.filter((p) => p.ativo).map((p) => p.nicho || 'outros'))]
  const [nicho, setNicho] = useState('')
  const [sub, setSub] = useState('')
  const [uso, setUso] = useState<'' | 'imprimir' | 'digital'>('')
  const [tipo, setTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [todos, setTodos] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const doNicho = daqui.filter((p) => p.ativo && (!nicho || p.nicho === nicho))
  // nichos mais procurados primeiro: unhas, cílios e sobrancelha, biomedicina...
  const ORDEM_SUB = ['unhas', 'sobrancelha e cílios', 'biomedicina', 'estética', 'cabelo', 'maquiagem e noivas', 'depilação', 'massagem']
  const pos = (x: string) => (ORDEM_SUB.indexOf(x) + 1 || 99)
  const subs = [...new Set(doNicho.map((p) => p.sub).filter((x): x is string => !!x && x !== 'todos' && x !== nicho))].sort((a, b) => pos(a) - pos(b))
  const tipos = [...new Set(doNicho.map((p) => p.tipo).filter((x): x is string => !!x && x !== 'kits'))]
  const filtrados = doNicho.filter((p) => (!sub || p.sub === sub || p.sub === 'todos') && (!uso || p.uso === uso || p.uso === 'ambos') && (!tipo || p.tipo === tipo) && (!busca.trim() || norm(`${p.nome} ${p.desc} ${p.sub || ''} ${p.tipo || ''} ${p.tag}`).includes(norm(busca.trim()))))
  // com um nicho escolhido, os dele vêm antes dos que servem para todos
  const doSub = <T extends Produto>(l: T[]) => (sub ? [...l].sort((a, b) => Number(b.sub === sub) - Number(a.sub === sub)) : l)
  const kitsF = doSub(filtrados.filter((p) => p.cat === 'combos'))
  const arqsF = doSub(ordenar(filtrados.filter((p) => p.cat !== 'combos')))
  const LIM = 12
  const algumFiltro = !!(sub || uso || tipo || busca.trim())
  const nFiltros = [sub, uso, tipo].filter(Boolean).length
  const limpar = () => { setSub(''); setUso(''); setTipo(''); setBusca('') }
  useEffect(() => setTodos(false), [nicho, sub, uso, tipo, busca])
  const visiveis = todos ? arqsF : arqsF.slice(0, LIM)
  return (
    <main className="fr-produtos">
      <section className="lp-section fr-produtos-topo">
        <div className="lp-wrap">
          <nav className="fr-trilha" aria-label="você está em">
            <a href={href(id)}>{f.nome}</a>
            <Icon name="chevronR" size={14} />
            <span>produtos</span>
          </nav>
          <h1 className="fr-produtos-h1">
            todos os <em>{id === 'arq' ? 'modelos' : 'arquivos'}</em> <span className="num fr-qtd">{daqui.filter((p) => p.ativo).length}</span>
          </h1>
          {nichos.length > 1 && (
            <div className="lp-aud fr-tabs" role="tablist" aria-label="áreas">
              <button role="tab" aria-selected={!nicho} className={!nicho ? 'is-on' : ''} onClick={() => setNicho('')}>
                todos
              </button>
              {nichos.map((x) => (
                <button key={x} role="tab" aria-selected={nicho === x} className={nicho === x ? 'is-on' : ''} onClick={() => setNicho(x)}>
                  {NICHOS[x] || x}
                </button>
              ))}
            </div>
          )}
          <div className="fr-filtros">
            <label className="fr-busca">
              <Icon name="search" size={16} />
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar: anamnese, cuidados, stories…" aria-label="Buscar arquivos" />
            </label>
            <button className={`fr-filtrar ${filtrosAbertos ? 'is-on' : ''}`} onClick={() => setFiltrosAbertos((v) => !v)} aria-expanded={filtrosAbertos}>
              <Icon name="list" size={16} /> filtrar{nFiltros > 0 && <span className="num">{nFiltros}</span>}
            </button>
            <div className={`fr-filtros-mais ${filtrosAbertos ? 'is-open' : ''}`}>
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
            </div>
            <p className="fr-conta muted small">
              <span className="num">{arqsF.length}</span> {arqsF.length === 1 ? 'arquivo' : 'arquivos'}
              {kitsF.length > 0 && <> e <span className="num">{kitsF.length}</span> {kitsF.length === 1 ? 'kit' : 'kits'}</>}
              {algumFiltro && <button className="link" onClick={limpar}>limpar filtros</button>}
            </p>
          </div>
        </div>
      </section>
      <section className="lp-section fr-produtos-lista">
        <div className="lp-wrap">
          {!aj ? (
            <Esqueleto />
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
                    {kitsF.map((p) => <Cartao key={p.id} p={p} ctx={ctx} kit />)}
                  </div>
                </div>
              )}
              <div className="fr-grid">
                {visiveis.map((p, i) => (
                  <Cartao key={p.id} p={p} i={i} ctx={ctx} />
                ))}
              </div>
              {arqsF.length > LIM && !todos && (
                <div className="fr-mais">
                  <button className="btn primary lp-cta" onClick={() => setTodos(true)}>
                    ver todos <span className="fr-mais-n num">+{arqsF.length - LIM}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

const USO: Record<string, [string, string]> = { imprimir: ['printer', 'imprimir'], digital: ['smartphone', 'digital'], ambos: ['layers', 'imprimir e digital'] }
const comCupom = (p: Produto, pct: number) => fmtPreco(Math.round(reais(p.preco) * (100 - pct)) / 100)

/** Capa do produto: as páginas de verdade (a capa no estilo e uma página de dentro), nunca vários mockups.
 *  Kit: as capas dos arquivos do kit em leque, com o selo do kit. */
function Capa({ p, est, fallback, todos }: { p: Produto; est: Estilo; fallback?: string; todos: Produto[] }) {
  if (p.cat === 'combos') {
    const itens = (p.combo || []).map((id) => todos.find((x) => x.id === id)).filter((x): x is Produto => !!x && temPrevia(x.id)).slice(0, 3)
    if (itens.length >= 2)
      return (
        <span className="fr-capa fr-capa-kit">
          {itens.map((x, i) => <img key={x.id} className={`k${i}`} src={imgEstilo(x.id, est)} alt="" loading="lazy" decoding="async" />)}
          <span className="fr-capa-selo"><b className="num">{(p.combo || []).length}</b> arquivos<em className="num">−{p.kitPct || 0}%</em></span>
        </span>
      )
  }
  if (!temPrevia(p.id)) return fallback ? <img src={fallback} alt="" loading="lazy" decoding="async" width={1200} height={900} /> : null
  const dentro = paginasDe(p.id)[0]
  if (noCelular(p.id))
    return (
      <span className={`fr-capa fr-capa-cel ${dentro ? 'duas' : ''}`}>
        <Iphone key={est} className="a" src={imgEstilo(p.id, est)} />
        {dentro && <Iphone className="b" src={dentro} />}
      </span>
    )
  return (
    <span className={`fr-capa ${dentro ? 'tem-dentro' : ''}`}>
      <img key={est} className="frente" src={imgEstilo(p.id, est)} alt="" loading="lazy" decoding="async" />
      {dentro && <img className="dentro" src={dentro} alt="" loading="lazy" decoding="async" />}
    </span>
  )
}

/** Cartão de produto: abre a página do produto; as bolinhas mostram cada estilo; o "+" põe o estilo escolhido no carrinho. */
function Cartao({ p, i = 0, kit, ctx }: { p: Produto; i?: number; kit?: boolean; ctx: Ctx }) {
  const u = p.uso ? USO[p.uso] : null
  const [est, setEst] = useState<Estilo | null>(null)
  const estilos = temEstilos(p)
  const previa = temPrevia(p.id)
  const capa = est && previa ? imgEstilo(p.id, est) : p.amostras?.[0]
  const noCarrinho = estilosNoCarrinho(ctx.cartIds, p.id)
  const escolhido = est || ESTILO_PADRAO
  const ja = estilos ? noCarrinho.includes(escolhido) : noCarrinho.length > 0 || ctx.cartIds.includes(p.id)
  const link = rotaProduto(ctx.id, p.id)
  return (
    <article className={`fr-card ${p.cat === 'combos' ? 'is-kit' : ''} ${kit ? 'is-trilho' : ''}`} data-reveal style={{ transitionDelay: `${Math.min(i, 5) * 0.06}s` }}>
      <a className="fr-card-img" href={link} aria-label={`Ver ${p.nome}`}>
        <Capa p={p} est={est || ESTILO_PADRAO} fallback={capa} todos={ctx.daqui} />
        {p.selo && <span className="fr-selo">{p.selo}</span>}
      </a>
      <div className="fr-card-b">
        <small className="fr-tag">
          {p.cat === 'combos' ? `kit · ${(p.combo || []).length} arquivos · ${p.kitPct || 0}% off` : p.sub && p.sub !== 'todos' ? p.sub : NICHOS[p.nicho || ''] || p.tag}{u && p.cat !== 'combos' ? ` · ${u[1]}` : ''}
        </small>
        <a className="fr-card-nome" href={link}>{p.nome}</a>
        <p>{p.desc}</p>
        {estilos && <Estilos est={est} onEst={setEst} />}
        {estilos && (
          <span className="fr-estilos-mini" aria-label={`${ESTILOS.length} estilos`}>
            {ESTILOS.map((e) => <i key={e.id} style={{ background: e.cor }} />)} <span className="num">{ESTILOS.length}</span> estilos
          </span>
        )}
        <div className="fr-preco">
          {ctx.cupomPct > 0 ? (
            <>
              <span className="num">{comCupom(p, ctx.cupomPct)}</span>
              <s className="num">{p.preco}</s>
            </>
          ) : (
            <span className="num">{p.preco}</span>
          )}
          <small className="fr-preco-pix">no Pix · ou até {maxSemJuros(precoCartao(reais(p.preco) * (100 - ctx.cupomPct) / 100, ctx.cartaoPct), ctx.semJ)}x sem juros</small>
        </div>
        <div className="row gap-s fr-card-acoes">
          <button className={`btn small ${ja ? 'ghost' : 'primary'}`} onClick={() => ctx.add(p, escolhido)} disabled={ja} aria-label={ja ? 'no carrinho' : `adicionar ${p.nome}${estilos ? ` no estilo ${escolhido}` : ''}`}>
            <Icon name={ja ? 'check' : 'plus'} size={14} /> <span className="fr-add-t">{ja ? 'no carrinho' : 'adicionar'}</span>
          </button>
          <a className="btn ghost small fr-det" href={link}>
            detalhes
          </a>
        </div>
      </div>
    </article>
  )
}

/** Bolinhas para ver cada estilo + o nome do escolhido. */
function Estilos({ est, onEst }: { est: Estilo | null; onEst: (e: Estilo) => void }) {
  return (
    <div className="fr-estilos" role="radiogroup" aria-label="Estilo">
      {ESTILOS.map((e) => (
        <button key={e.id} role="radio" aria-checked={est === e.id} aria-label={e.nome} title={e.nome} className={est === e.id ? 'is-on' : ''} onClick={() => onEst(e.id)} style={{ ['--c' as string]: e.cor, ['--a' as string]: e.aro }}>
          <i />
        </button>
      ))}
      <span className="fr-estilos-nome">{est ?? `${ESTILOS.length} estilos`}</span>
    </div>
  )
}

/** Página do produto: galeria, escolha do estilo, preço com cupom, comprar agora e relacionados. */
function PaginaProduto({ ctx, p, onComprar }: { ctx: Ctx; p: Produto; onComprar: (p: Produto, e: Estilo) => void }) {
  const { id, pixPct, cupomPct, cartaoPct, semJ } = ctx
  const f = frente(id)
  const estilos = temEstilos(p)
  const previa = temPrevia(p.id)
  const [est, setEst] = useState<Estilo>(ESTILO_PADRAO)
  const fotos = useMemo(() => {
    const a = p.amostras || []
    // com estilos: a página no estilo escolhido e a cena do produto (as páginas de dentro são do criativo)
    return previa ? [imgEstilo(p.id, est), ...paginasDe(p.id)] : a
  }, [p, est, previa])
  const [foto, setFoto] = useState(0)
  useEffect(() => setFoto(0), [est])
  const noCarrinho = estilosNoCarrinho(ctx.cartIds, p.id)
  const ja = estilos ? noCarrinho.includes(est) : ctx.cartIds.includes(p.id)
  const base = reais(p.preco)
  const comCup = Math.round(base * (100 - cupomPct)) / 100
  const pixV = Math.round(comCup * (100 - pixPct)) / 100
  const cartV = precoCartao(pixV, cartaoPct)
  const nSJ = maxSemJuros(cartV, semJ)
  // "você também vai gostar": sempre 4 (ou 2) cartões, completando com outros da loja; nunca número ímpar
  const parecidos = ordenar(ctx.daqui.filter((x) => x.ativo && x.id !== p.id && x.cat !== 'combos' && (x.sub === p.sub || x.tipo === p.tipo)))
  const outros = ordenar(ctx.daqui.filter((x) => x.ativo && x.id !== p.id && x.cat !== 'combos' && !parecidos.includes(x)))
  const relTodos = [...parecidos, ...outros].slice(0, 4)
  const rel = relTodos.slice(0, relTodos.length - (relTodos.length % 2))
  const u = p.uso ? USO[p.uso] : null
  return (
    <main className="fr-pp">
      <div className="lp-wrap">
        <nav className="fr-trilha" aria-label="você está em">
          <a href={href(id)}>{f.nome}</a>
          <Icon name="chevronR" size={14} />
          <a href={href(id, 'produtos')}>produtos</a>
          <Icon name="chevronR" size={14} />
          <span>{p.nome}</span>
        </nav>
        <div className="fr-pp-grid">
          <div className="fr-pp-gal">
            <div className={`fr-pp-foto ${previa && noCelular(p.id) ? 'is-cel' : foto === 0 && previa ? 'is-pagina' : ''}`}>
              {fotos[foto] && (previa && noCelular(p.id) ? <Iphone key={fotos[foto]} className="fr-pp-iph" src={fotos[foto]} /> : <img key={fotos[foto]} src={fotos[foto]} alt={p.nome} decoding="async" />)}
              {p.selo && <span className="fr-selo">{p.selo}</span>}
            </div>
            {fotos.length > 1 && (
              <div className="fr-pp-mini">
                {fotos.map((src, k) => (
                  <button key={src} className={k === foto ? 'is-on' : ''} onClick={() => setFoto(k)} aria-label={`Imagem ${k + 1}`}>
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="fr-pp-info">
            <p className="eyebrow">{p.cat === 'combos' ? `kit · ${(p.combo || []).length} arquivos` : p.sub && p.sub !== 'todos' ? p.sub : p.tag}</p>
            <h1>{p.nome}</h1>
            <p className="fr-pp-desc">{p.desc}</p>
            {estilos && (
              <div className="fr-pp-estilos">
                <b>escolha o estilo</b>
                <div className="fr-pp-estilos-l" role="radiogroup" aria-label="estilo">
                  {ESTILOS.map((e) => (
                    <button key={e.id} role="radio" aria-checked={est === e.id} className={est === e.id ? 'is-on' : ''} onClick={() => setEst(e.id)} style={{ ['--c' as string]: e.cor, ['--a' as string]: e.aro }}>
                      <i />
                      <span>{e.nome}</span>
                    </button>
                  ))}
                </div>
                <small className="muted">{ESTILOS.find((e) => e.id === est)?.frase}. Cada estilo é uma compra.</small>
              </div>
            )}
            <div className="fr-pp-preco">
              <span className="num fr-pp-valor">{fmtPreco(pixV)}</span>
              <span className="fr-pp-pix">no Pix</span>
              {cupomPct > 0 && <s className="num">{p.preco}</s>}
              {cupomPct > 0 && <span className="fr-pp-tag">com o cupom de {cupomPct}%</span>}
              <small className="muted fr-pp-cartao">
                ou <b className="num">{fmtPreco(cartV)}</b> {nSJ > 1 ? <>em até <b className="num">{nSJ}x</b> sem juros no crédito</> : 'no crédito'}
              </small>
            </div>
            {p.ativo ? (
              <div className="fr-pp-botoes">
                <button className="btn primary lp-cta lp-shine fr-pulsa" onClick={() => onComprar(p, est)}>
                  comprar agora <Icon name="arrowRight" size={16} />
                </button>
                <button className="btn ghost lp-cta" onClick={() => ctx.add(p, est)} disabled={ja}>
                  <Icon name={ja ? 'check' : 'plus'} size={16} /> {ja ? 'no carrinho' : 'adicionar ao carrinho'}
                </button>
              </div>
            ) : (
              <p className="muted">Em breve.</p>
            )}
            <ul className="fr-pp-confia">
              <li><Icon name="download" size={16} /> baixa na hora</li>
              <li><Icon name="edit" size={16} /> {/Canva/.test(p.formato || '') ? 'editável no Canva' : /Excel/.test(p.formato || '') ? 'editável no Excel' : /Word/.test(p.formato || '') ? 'editável no Word' : 'editável'}</li>
              <li><Icon name="lock" size={16} /> 7 dias para desistir</li>
              {estilos && <li><Icon name="gift" size={16} /> presente no 8º dia: os outros 3 estilos</li>}
            </ul>
          </div>
        </div>

        <div className="fr-pp-mais">
          {!!p.itens?.length && (
            <section>
              <h2>o que vem</h2>
              <ul className="fr-checks">
                {p.itens.map((t) => (
                  <li key={t}>
                    <Icon name="check" size={16} /> {t}
                  </li>
                ))}
              </ul>
              {!!p.numeros?.length && (
                <div className="fr-nums">
                  {p.numeros.map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                  {u && <span>{u[1]}</span>}
                </div>
              )}
            </section>
          )}
          <section>
            <h2>como usar</h2>
            <ol className="fr-pp-passos">
              <li><b>compre</b><span>Pix ou cartão. A página do pedido abre na hora.</span></li>
              <li><b>abra o arquivo</b><span>Baixe e abra no Canva (PowerPoint), no Word ou no Excel, conforme o formato.</span></li>
              <li><b>troque o que está entre [colchetes]</b><span>Seu nome, logo, fotos e valores. Pronto para imprimir ou mandar.</span></li>
            </ol>
            <dl className="fr-ficha">
              <dt>formato</dt>
              <dd>{p.formato}</dd>
              <dt>entrega</dt>
              <dd>{p.entrega}</dd>
            </dl>
          </section>
        </div>

        {rel.length > 0 && (
          <section className="fr-pp-rel">
            <h2>você também vai <em>gostar</em></h2>
            <div className="fr-grid">
              {rel.map((x, i) => (
                <Cartao key={x.id} p={x} i={i} ctx={ctx} />
              ))}
            </div>
          </section>
        )}
      </div>

      {p.ativo && (
        <div className="fr-pp-barra">
          <span>
            <b className="num">{fmtPreco(comCup)}</b>
            {estilos && <small>{est}</small>}
          </span>
          <button className="btn primary fr-pulsa" onClick={() => onComprar(p, est)}>
            comprar agora
          </button>
        </div>
      )}
    </main>
  )
}
