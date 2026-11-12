import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { href } from '../router'
import { Icon } from '../components/Icon'
import { loadPublico, type Ajustes } from '../ape/api'
import { ApeArt } from '../ape/ApeArt'
import { APE, conta, frenteDe, reais, fmtPreco, wa, type Produto } from '../ape/model'
// checkout, pedido, carrinho e conta só baixam quando a pessoa abre (a vitrine abre mais rápido)
const Checkout = lazy(() => import('../ape/Loja').then((m) => ({ default: m.Checkout })))
const PedidoPage = lazy(() => import('../ape/Loja').then((m) => ({ default: m.PedidoPage })))
const CarrinhoSheet = lazy(() => import('../ape/Loja').then((m) => ({ default: m.CarrinhoSheet })))
const Conta = lazy(() => import('../ape/Conta').then((m) => ({ default: m.Conta })))
import { AvisoCookies, useCarrinho, useToast, useTravaRolagem } from '../ape/shared'
import { FrFoot, FrTop } from './Hub'
import { frente, type FrenteId } from './frentes'
import './frentes.css'

/* Vitrine de uma frente da planê (#/arquivos e #/arq). Mesmo catálogo, checkout, pedido e entrega
   da loja do apê (src/ape): cada produto diz a frente e o nicho; o que ainda não tem arquivo
   aparece em "em breve" (ativo: false no painel → produtos e preços). */

const NICHOS: Record<string, string> = { beleza: 'beleza', freelancer: 'freelancers', arquitetura: 'arquitetura' }

export function Vitrine({ id, sub }: { id: Exclude<FrenteId, 'apzinho'>; sub?: string }) {
  const f = frente(id)
  const [aj, setAj] = useState<Ajustes | null>(null)
  // o estilo do checkout, do carrinho e dos avisos baixa logo depois da vitrine aparecer
  const [estilo, setEstilo] = useState(false)
  useEffect(() => {
    void import('../ape/ape.css').then(() => setEstilo(true))
  }, [])
  useEffect(() => {
    void loadPublico(null, false).then((d) => setAj(d.ajustes), () => setAj({ produtos: [] }))
    // o checkout já vai baixando enquanto a pessoa escolhe
    const pre = () => void import('../ape/Loja')
    const w = window as Window & { requestIdleCallback?: (f: () => void) => number }
    // quem está economizando dados no celular não baixa nada antes da hora
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
  const carrinhoBtn = (
    <a className={`fr-btn sm fr-cart ${cart.ids.length ? 'tem' : ''}`} href={href(id, 'loja:carrinho')} aria-label={`Carrinho com ${cart.ids.length} itens`}>
      <Icon name="box" />
      <span className="num" key={cart.ids.length}>{cart.ids.length}</span>
    </a>
  )
  return (
    <div className={`ape fr fr-vitrine fr-v-${id}`}>
      <FrTop titulo={f} extra={carrinhoBtn} />
      <main className="fr-wrap">
        <Suspense fallback={<div className="fr-loading" aria-label="carregando" />}>
        {!aj || (view !== 'loja' && !estilo) ? (
          <div className="fr-skel" aria-label="carregando"><div /><div /><div /><div /></div>
        ) : view === 'checkout' ? (
          <div className="fr-sub"><Checkout ajustes={aj} me={null} whats={whats} /></div>
        ) : view === 'pedido' ? (
          <div className="fr-sub"><PedidoPage token={sub!.slice(7)} whats={whats} produtos={aj.produtos} /></div>
        ) : view === 'conta' ? (
          <div className="fr-sub"><Conta sub={sub} whats={whats} /></div>
        ) : (
          <Prateleira id={id} aj={aj} whats={whats} estilo={estilo} abrir={sub?.startsWith('loja:') ? sub.slice(5) : undefined} />
        )}
        </Suspense>
      </main>
      <FrFoot />
      {estilo && <AvisoCookies />}
    </div>
  )
}

function Prateleira({ id, aj, whats, abrir, estilo }: { id: Exclude<FrenteId, 'apzinho'>; aj: Ajustes; whats: string; abrir?: string; estilo: boolean }) {
  const f = frente(id)
  const pixPct = aj.pixPct ?? 5
  const daqui = useMemo(() => aj.produtos.filter((p) => frenteDe(p) === id), [aj, id])
  const nichos = [...new Set(daqui.map((p) => p.nicho || 'outros'))]
  const [nicho, setNicho] = useState<string>('')
  const ativos = daqui.filter((p) => p.ativo && (!nicho || p.nicho === nicho))
  const breve = daqui.filter((p) => !p.ativo && (!nicho || p.nicho === nicho))
  const cart = useCarrinho()
  const [aberto, setAberto] = useState<Produto | null>(() => daqui.find((p) => p.id === abrir) || null)
  const [verCarrinho, setVerCarrinho] = useState(abrir === 'carrinho')
  useEffect(() => setVerCarrinho(abrir === 'carrinho'), [abrir])
  const [toast, show] = useToast()
  useTravaRolagem(!!aberto || verCarrinho)
  const add = (p: Produto) => {
    cart.add(p.id)
    show('No carrinho.')
  }
  const pix = (p: Produto) => fmtPreco(Math.round(reais(p.preco) * (100 - pixPct)) / 100)
  const tot = conta(cart.ids, aj.produtos, 'pix', pixPct)
  return (
    <>
      <section className="fr-hero fr-hero-v">
        <p className="fr-eyebrow">{f.para}</p>
        <h1>
          {id === 'arquivos' ? (
            <>
              arquivos <em>prontos</em> para mandar hoje
            </>
          ) : (
            <>
              do primeiro cliente ao <em>primeiro escritório</em>
            </>
          )}
        </h1>
        <p className="fr-lead">
          {id === 'arquivos'
            ? 'Cada arquivo vem com o texto da mensagem e o passo a passo. Paga no Pix ou no cartão e baixa na hora.'
            : 'A gestão que organiza propostas, contratos e cobranças, e os modelos que ela usa, vendidos avulsos.'}
        </p>
      </section>

      {id === 'arq' && (
        <section className="fr-glass fr-gestao">
          <span className="fr-card-ic">
            <Icon name="layers" />
          </span>
          <div>
            <b>
              gestão planê<em>.arq</em>
            </b>
            <p>Clientes, orçamentos, propostas, contratos com assinatura, cobranças e agenda num lugar só. Teste grátis, sem cartão.</p>
          </div>
          <div className="fr-acts">
            <a className="fr-btn primary" href="#/vendas">
              conhecer a gestão
              <Icon name="arrowRight" />
            </a>
            <a className="fr-btn ghost" href="#/entrar">
              já sou assinante
            </a>
          </div>
        </section>
      )}

      {nichos.length > 1 && (
        <div className="fr-chips" role="tablist" aria-label="nichos">
          <button role="tab" aria-selected={!nicho} className={!nicho ? 'on' : ''} onClick={() => setNicho('')}>
            todos
          </button>
          {nichos.map((n) => (
            <button key={n} role="tab" aria-selected={nicho === n} className={nicho === n ? 'on' : ''} onClick={() => setNicho(n)}>
              {NICHOS[n] || n}
            </button>
          ))}
        </div>
      )}

      {ativos.length > 0 && (
        <section className="fr-grid" aria-label="à venda">
          {ativos.map((p) => (
            <article key={p.id} className="fr-prod">
              <button className="fr-mock" onClick={() => setAberto(p)} aria-label={`Ver ${p.nome}`}>
                <Mockup p={p} />
                {p.selo && <span className="fr-selo">{p.selo}</span>}
              </button>
              <div className="fr-prod-b">
                <small>{NICHOS[p.nicho || ''] || p.tag}</small>
                <b>{p.nome}</b>
                <span className="fr-prod-d">{p.desc}</span>
                <div className="fr-prod-p">
                  <span className="num">{p.preco}</span>
                  <small className="num">{pix(p)} no Pix</small>
                </div>
                <div className="fr-acts">
                  <button className="fr-btn primary" onClick={() => add(p)} disabled={cart.tem(p.id)}>
                    <Icon name={cart.tem(p.id) ? 'check' : 'plus'} />
                    {cart.tem(p.id) ? 'no carrinho' : 'adicionar'}
                  </button>
                  <button className="fr-btn ghost" onClick={() => setAberto(p)}>
                    detalhes
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {breve.length > 0 && (
        <section className="fr-breve">
          <p className="fr-eyebrow">em breve</p>
          <div className="fr-breve-l">
            {breve.map((p) => (
              <div key={p.id} className="fr-breve-i">
                <ApeArt name={p.arte || 'casa'} size={34} />
                <span>
                  <b>{p.nome}</b>
                  <small>{p.formato}</small>
                </span>
                <a className="fr-btn ghost sm" href={wa(whats, `Oi! Quero saber quando sair: ${p.nome} (${f.nome}).`)} target="_blank" rel="noopener noreferrer">
                  <Icon name="bell" />
                  me avise
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="fr-garantias">
        <div>
          <Icon name="download" />
          <span>baixa na hora, depois do pagamento</span>
        </div>
        <div>
          <Icon name="lock" />
          <span>Pix com {pixPct}% de desconto ou cartão</span>
        </div>
        <div>
          <Icon name="undo" />
          <span>7 dias para desistir</span>
        </div>
      </section>

      {cart.ids.length > 0 && !verCarrinho && (
        <a className="fr-cartbar" href={href(id, 'loja:carrinho')}>
          <span>
            <b className="num">{tot.itens.length}</b> {tot.itens.length === 1 ? 'item' : 'itens'} · <span className="num">{fmtPreco(tot.totalPix)}</span> no Pix
          </span>
          <span>
            ver carrinho
            <Icon name="arrowRight" />
          </span>
        </a>
      )}

      {aberto && estilo && <Detalhe p={aberto} pixTxt={pix(aberto)} pixPct={pixPct} noCarrinho={cart.tem(aberto.id)} onAdd={() => add(aberto)} onClose={() => setAberto(null)} />}
      {verCarrinho && estilo && (
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
    </>
  )
}

/** Mockup sem foto: a folha do arquivo com o desenho do produto, uma segunda folha atrás e o celular ao lado. */
function Mockup({ p }: { p: Produto }) {
  return (
    <span className="fr-mockup" aria-hidden="true">
      <span className="fr-sheet back" />
      {p.amostras?.[0] ? (
        <span className="fr-sheet capa">
          <img src={p.amostras[0]} alt="" loading="lazy" decoding="async" width={300} height={424} />
        </span>
      ) : (
        <span className="fr-sheet">
          <ApeArt name={p.arte || 'casa'} size={46} />
          <i />
          <i />
          <i className="short" />
          <span className="fr-sheet-t">{p.nome}</span>
        </span>
      )}
      <span className="fr-phone">
        <i />
        <i />
        <i className="short" />
      </span>
    </span>
  )
}

function Detalhe({ p, pixTxt, pixPct, noCarrinho, onAdd, onClose }: { p: Produto; pixTxt: string; pixPct: number; noCarrinho: boolean; onAdd: () => void; onClose: () => void }) {
  return (
    <div className="ape-sheet" role="dialog" aria-modal="true" aria-label={p.nome} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ape-sheet-in">
        <button className="ape-x" onClick={onClose} aria-label="Fechar">
          <Icon name="x" />
        </button>
        <div className="ape-sheet-b fr-det">
          <div className="fr-mock fr-mock-lg">
            <Mockup p={p} />
          </div>
          <p className="fr-eyebrow">{p.tag}</p>
          <h2>{p.nome}</h2>
          <p className="fr-lead">{p.desc}</p>
          {!!p.numeros?.length && (
            <div className="fr-nums">
              {p.numeros.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
          )}
          {!!p.itens?.length && (
            <ul className="fr-itens">
              {p.itens.map((i) => (
                <li key={i}>
                  <Icon name="check" />
                  {i}
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
          <div className="fr-prod-p">
            <span className="num">{p.preco}</span>
            <small className="num">
              {pixTxt} no Pix (−{pixPct}%)
            </small>
          </div>
          {p.ativo && (
            <button className="fr-btn primary wide" onClick={onAdd} disabled={noCarrinho}>
              <Icon name={noCarrinho ? 'check' : 'plus'} />
              {noCarrinho ? 'no carrinho' : 'adicionar ao carrinho'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
