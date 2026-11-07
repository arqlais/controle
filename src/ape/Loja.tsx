import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { href } from '../router'
import { baixarArquivo, criarPedido, pedidosLocais, recuperarCompras, simularPagamento, verPedido, apeCloud, type Ajustes, type Pedido, type Vendedor } from './api'
import { ApeArt } from './ApeArt'
import { ApeIcon } from './ApeIcon'
import { APE, BONUS, KIT_PLATAFORMA_MESES, brl, conta, digits, dmy, firstName, fmtTel, msgProduto, noCarrinho, reais, wa, type Morador, type Produto } from './model'
import { SITE_APE, cpfOk, emailOk, fmtCpf, useCarrinho, useToast, useTravaRolagem, type Carrinho } from './shared'

/* Loja do planê.apê: página de vendas aberta a todos, carrinho, checkout e página do pedido. */

type ById = (id: string) => Produto | undefined
let PIX = 5 // desconto do Pix da loja salva (definido ao abrir a loja)

export function Loja({ ajustes, me, whats, abrir }: { ajustes: Ajustes; me: Morador | null; whats: string; abrir?: string }) {
  const produtos = ajustes.produtos
  const pixPct = ajustes.pixPct ?? 5
  PIX = pixPct
  const ativos = produtos.filter((p) => p.ativo)
  const [cat, setCat] = useState<'todos' | 'comprando' | 'comprei'>('todos')
  const [aberto, setAberto] = useState<Produto | null>(() => ativos.find((p) => p.id === abrir) || null)
  const [verCarrinho, setVerCarrinho] = useState(abrir === 'carrinho')
  const cart = useCarrinho()
  const [toast, show] = useToast()
  const byId: ById = (id) => produtos.find((p) => p.id === id)
  const tot = conta(cart.ids, produtos, 'pix', pixPct)
  useTravaRolagem(!!aberto || verCarrinho)
  useEffect(() => {
    const abrirCarrinho = () => setVerCarrinho(true)
    window.addEventListener('ape-abrir-carrinho', abrirCarrinho)
    return () => window.removeEventListener('ape-abrir-carrinho', abrirCarrinho)
  }, [])
  const adicionar = (p: Produto) => {
    cart.add(p.id)
    const k = p.cat === 'arquivos' ? produtos.find((x) => x.ativo && x.cat === 'combos' && (x.combo || []).includes(p.id) && (x.combo || []).every((id) => id === p.id || cart.tem(id))) : undefined
    show(k ? `No carrinho. Com esses arquivos, o ${k.nome} sai mais barato: veja no carrinho.` : 'No carrinho.')
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
  const arquivos = ativos.filter((p) => (p.cat || 'arquivos') === 'arquivos')
  const kits = ativos.filter((p) => p.cat === 'combos')
  const fases: { id: 'comprando' | 'comprei'; l: string; d: string; arte: string }[] = [
    { id: 'comprando', l: 'para quem vai comprar', d: 'Na planta ou pronto: visita, simulação, financiamento, seguros e contrato.', arte: 'contrato' },
    { id: 'comprei', l: 'para quem já comprou', d: 'Vistoria, obra, orçamentos, mudança e decoração.', arte: 'vistoria' },
  ]
  return (
    <>
      <section className="ape-lp-hero">
        <div className="ape-blobs" aria-hidden="true"><i /><i /><i /></div>
        <div className="ape-lp-text">
          <p className="ape-kicker"><span className="ape-dot" />casa ou apê, de qualquer tamanho</p>
          <h2>do contrato às chaves, <em>sem susto</em></h2>
          <p className="ape-lead">Guias, checklists e planilhas para cada etapa: comprar, receber as chaves, fazer a obra, mudar e decorar.</p>
          <div className="ape-acts">
            <button className="ape-btn primary" onClick={() => ir('loja-arquivos')}><ApeIcon name="bag" />ver os arquivos</button>
            {kitTop && <button className="ape-btn" onClick={() => setAberto(kitTop)}><ApeIcon name="gift" />{kitTop.nome} · <span className="ape-keep">{kitTop.preco}</span></button>}
          </div>
          <div className="ape-trust">
            <span><ApeIcon name="tag" /><span className="ape-keep">{pixPct}% off no Pix</span></span>
            <span><ApeIcon name="download" />baixa na hora</span>
            <span><ApeIcon name="check" />7 dias para desistir</span>
          </div>
        </div>
        <div className="ape-lp-art" aria-hidden="true">
          {['m-compra.jpg', 'm-planilha.jpg', 'm-checklist.jpg'].map((f, i) => <img key={f} src={`ape/amostras/${f}`} alt="" className={`ape-lp-card c${i}`} />)}
        </div>
      </section>

      <div className="ape-marquee" aria-hidden="true">
        <div className="ape-marquee-track">
          {[0, 1].map((k) => (
            <span key={k}>
              {arquivos.map((p) => <b key={p.id}><ApeIcon name="check" />{p.nome.toLowerCase()}</b>)}
            </span>
          ))}
        </div>
      </div>

      <section className="ape-story ape-panel">
        <span className="ape-me-av">L</span>
        <div>
          <p className="ape-eyebrow">quem fez</p>
          <p>Oi! Sou a {APE.dona}, estou me formando em arquitetura e montando o meu apê de {APE.meuApe}. Juntei aqui o que eu precisei e não achei pronto: o que perguntar antes de assinar, o que conferir na vistoria, quanto custa de verdade e como organizar a obra.</p>
        </div>
      </section>

      {/* o que é cada coisa: para ninguém achar que está comprando a mesma coisa duas vezes */}
      <section className="ape-tipos" aria-label="O que tem na loja">
        <h3 className="ape-sec-t">o que você <em>precisa?</em></h3>
        <div className="ape-tipos-grid">
          <button className="ape-tipo" onClick={() => ir('loja-arquivos')}>
            <ApeArt name="planilha" size={40} />
            <b>arquivos e planilhas</b>
            <span>Cada um resolve <u>uma tarefa</u>: baixa, usa e pronto. Fica com você.</span>
            <em>a partir de <span className="ape-keep">{brl(Math.min(...arquivos.map((p) => reais(p.preco))))}</span></em>
          </button>
          <button className="ape-tipo" onClick={() => ir('loja-kits')}>
            <ApeArt name="casa" size={40} tone="sec" />
            <b>kits</b>
            <span>Os arquivos <u>da mesma etapa</u> juntos, com o desconto já no preço.</span>
            <em>até {Math.max(0, ...kits.map((k) => k.kitPct || 0))}% mais barato</em>
          </button>
          {plat && (
            <button className="ape-tipo" onClick={() => ir('loja-plataforma')}>
              <ApeArt name="celular" size={40} />
              <b>plataforma do apê</b>
              <span>Um site para <u>acompanhar a jornada inteira</u> com os seus dados: gastos, parcelas, obra, vistoria.</span>
              <em>12 meses · <span className="ape-keep">{plat.preco}</span></em>
            </button>
          )}
        </div>
        <p className="ape-note ape-tipos-nota">Os arquivos são materiais prontos para tarefas específicas. A plataforma é uma ferramenta onde você registra e acompanha o seu caso. Um não depende do outro.</p>
      </section>

      <div id="loja-arquivos" className="ape-anchor" />
      <div className="ape-chips" role="group" aria-label="Filtrar os arquivos">
        <button className="ape-chip" aria-pressed={cat === 'todos'} onClick={() => setCat('todos')}>todos</button>
        {fases.map((f) => (
          <button key={f.id} className="ape-chip" aria-pressed={cat === f.id} onClick={() => setCat(f.id)}>{f.id === 'comprando' ? 'vou comprar' : 'já comprei'}</button>
        ))}
      </div>
      {fases
        .filter((f) => cat === 'todos' || cat === f.id)
        .map((f) => {
          const lista = arquivos.filter((p) => (f.id === 'comprando' ? p.fase === 'comprando' : p.fase !== 'comprando'))
          if (!lista.length) return null
          return (
            <section key={f.id} id={`loja-${f.id}`} className="ape-nicho ape-reveal" aria-label={f.l}>
              <div className="ape-nhead ape-nhead-art">
                <ApeArt name={f.arte} size={40} />
                <div>
                  <h3>{f.l}</h3>
                  <span className="ape-note">{f.d}</span>
                </div>
              </div>
              <div className="ape-shop">
                {lista.map((p, i) => (
                  <ProdCard key={p.id} n={i + 1} p={p} byId={byId} onOpen={() => setAberto(p)} cart={cart} onAdd={adicionar} me={me} whats={whats} />
                ))}
              </div>
            </section>
          )
        })}

      {kits.length > 0 && (
        <section id="loja-kits" className="ape-nicho ape-reveal" aria-label="Kits">
          <div className="ape-nhead ape-nhead-art">
            <ApeArt name="casa" size={40} tone="sec" />
            <div>
              <h3>kits</h3>
              <span className="ape-note">O preço do kit sai sozinho: a soma dos arquivos com o desconto do kit. No Pix, ainda tem {pixPct}% off.</span>
            </div>
          </div>
          <div className="ape-shop">
            {kits.map((p) => (
              <ProdCard key={p.id} p={p} byId={byId} onOpen={() => setAberto(p)} cart={cart} onAdd={adicionar} me={me} whats={whats} />
            ))}
          </div>
        </section>
      )}

      {plat && <PlataformaSec p={plat} cart={cart} onAdd={adicionar} me={me} whats={whats} />}
      <ServicosSec whats={whats} me={me} />

      <section className="ape-panel ape-garantia">
        <ApeArt name="entregas" size={56} tone="sec" />
        <div>
          <h3 className="ape-sec-t">7 dias para <em>desistir</em></h3>
          <p className="ape-note" style={{ margin: 0 }}>Comprou e não era o que esperava? Em até 7 dias depois da compra você pede o dinheiro de volta, inteiro, pelo WhatsApp ou e-mail, sem precisar explicar (art. 49 do Código de Defesa do Consumidor). Toda compra ainda ganha um bônus no 8º dia: <b>{BONUS.nome.toLowerCase()}</b>. O bônus não muda nem atrasa o seu direito de desistir.</p>
        </div>
      </section>

      <section className="ape-faq" id="loja-duvidas">
        <h3 className="ape-sec-t">dúvidas <em>frequentes</em></h3>
        {[
          ['Qual a diferença entre os arquivos e a plataforma?', 'Os arquivos são materiais prontos para uma tarefa (um checklist, um guia, uma planilha): você baixa e usa quando quiser. A plataforma é um site onde você registra o seu caso (gastos, parcelas, etapas, vistoria com fotos) e acompanha tudo por 12 meses. Dá para comprar um sem o outro.'],
          ['Serve para casa? E para outros tamanhos?', `Serve para casa ou apê de qualquer tamanho, na planta ou pronto. Quando aparece um exemplo com medidas, é de um apê de ${APE.meuApe}; você troca pelos seus números.`],
          ['Como eu recebo?', 'Pagou, a página do pedido mostra os botões de baixar (no Pix, em segundos). Para baixar de novo em outro aparelho, use "minhas compras" com o CPF e o e-mail da compra.'],
          ['Quais formas de pagamento?', `Pix, com ${pixPct}% de desconto, ou cartão de crédito à vista. Não parcelamos.`],
          ['Tem desconto levando mais?', 'Os kits já têm o desconto no preço e saem bem mais em conta que os arquivos separados. Além disso, o Pix tem desconto em qualquer compra.'],
          ['Posso compartilhar?', 'Pode usar com quem mora com você, na sua casa. Os arquivos são de uso pessoal: não podem ser repassados, revendidos, postados ou enviados em grupos. Cada PDF sai com o nome de quem comprou.'],
          ['Substitui um profissional?', 'Não. São guias práticos para você se organizar e não errar no básico. Regras de financiamento e seguro mudam de banco para banco e de contrato para contrato: confirme sempre com o seu banco e com profissionais.'],
        ].map(([q, r]) => (
          <details key={q} className="ape-faq-i">
            <summary>{q}<ApeIcon name="chev" /></summary>
            <p>{r}</p>
          </details>
        ))}
      </section>

      {kitTop && (
        <section className="ape-final">
          <div>
            <h3>comece pelo <em>{kitTop.nome.toLowerCase()}</em></h3>
            <p>{(kitTop.combo || []).length} arquivos, da compra à decoração, por <span className="ape-keep">{kitTop.preco}</span>{kitTop.itens?.length ? ` e ${KIT_PLATAFORMA_MESES} mês de plataforma` : ''}.</p>
          </div>
          <button className="ape-btn" onClick={() => adicionar(kitTop)}>
            <ApeIcon name={cart.tem(kitTop.id) ? 'check' : 'plus'} />
            {cart.tem(kitTop.id) ? 'no carrinho' : 'adicionar ao carrinho'}
          </button>
        </section>
      )}
      <MinhasCompras />
      <Vendedor v={ajustes.vendedor} whats={whats} />
      {cart.ids.length > 0 && !verCarrinho && (
        <button className="ape-cartfab" onClick={() => setVerCarrinho(true)}>
          <ApeIcon name="bag" />
          <span>{tot.itens.length} {tot.itens.length > 1 ? 'itens' : 'item'} · <b className="ape-keep">{brl(tot.subtotal)}</b></span>
          <b className="go">ver carrinho</b>
        </button>
      )}
      {aberto && <Detalhe p={aberto} byId={byId} produtos={produtos} me={me} whats={whats} onClose={() => setAberto(null)} onOpen={setAberto} cart={cart} onAdd={(p) => { adicionar(p); setAberto(null) }} pixPct={pixPct} />}
      {verCarrinho && <CarrinhoSheet produtos={produtos} pixPct={pixPct} cart={cart} onClose={() => setVerCarrinho(false)} onOpen={(p) => { setVerCarrinho(false); setAberto(p) }} />}
      {toast}
    </>
  )
}

/* ===== serviços: separado dos produtos digitais, sempre com proposta antes ===== */
function ServicosSec({ whats, me }: { whats: string; me: Morador | null }) {
  const msg = `Oi! ${me ? `Sou ${me.nome}. ` : ''}Vi a página do planê.apê e queria uma proposta de projeto/reforma para a minha casa/apê.`
  return (
    <section className="ape-servicos ape-panel" id="loja-servicos">
      <div className="ape-servicos-h">
        <ApeArt name="projeto3d" size={44} tone="sec" />
        <div>
          <p className="ape-eyebrow">serviço à parte · não faz parte da loja</p>
          <h3 className="ape-sec-t">precisa de um <em>projeto?</em></h3>
        </div>
      </div>
      <p className="ape-servicos-eu">Sou a {APE.dona}, estou no {APE.semestre} semestre de Arquitetura e Urbanismo e trabalho junto com o meu pai, que é engenheiro civil. Fazemos projetos, serviços técnicos e reformas, inclusive para quem acabou de receber as chaves.</p>
      <div className="ape-servicos-grid">
        {[
          ['projeto de layout e interiores', 'Planta com móveis, medidas e acabamentos.'],
          ['projeto de marcenaria', 'Desenho dos planejados para pedir orçamentos iguais.'],
          ['pontos elétricos e iluminação', 'Onde vai cada tomada, ponto e luminária.'],
          ['vistoria técnica de recebimento', 'Acompanhamento na vistoria das chaves.'],
          ['acompanhamento de obra', 'Visitas e conferência do que foi combinado.'],
          ['reforma', 'Execução de reformas, com equipe e cronograma.'],
        ].map(([t, d]) => (
          <div key={t} className="ape-servico"><ApeIcon name="check" /><span><b>{t}</b>{d}</span></div>
        ))}
      </div>
      <div className="ape-servicos-regras">
        <div>
          <b>quem faz o quê</b>
          <span>Serviços que pedem responsabilidade técnica (com ART) são assinados pelo engenheiro civil. A {APE.dona} desenvolve os projetos com ele, como estudante, e não assina como arquiteta.</span>
        </div>
        <div>
          <b>como funciona</b>
          <span>1. Você conta o que precisa. 2. Recebe uma proposta por escrito com escopo, valor, prazo e pagamento. 3. Só começa depois que você aprovar. Visita técnica, quando precisar, tem valor informado antes.</span>
        </div>
      </div>
      <a className="ape-btn primary" href={wa(whats, msg)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />pedir proposta no WhatsApp</a>
    </section>
  )
}

/* ===== plataforma do apê ===== */
function PlataformaSec({ p, cart, onAdd, me, whats }: { p: Produto; cart: Carrinho; onAdd: (p: Produto) => void; me: Morador | null; whats: string }) {
  const recursos: [string, string, string][] = [
    ['planilha', 'gastos por cômodo', 'Quanto planejou, quanto já foi e quanto falta.'],
    ['calculo', 'parcelas do mês', 'Tudo somado mês a mês, sem surpresa.'],
    ['projeto3d', 'etapas da compra e da obra', 'Na ordem certa, com datas e o que já foi feito.'],
    ['vistoria', 'vistoria com fotos', 'Marque cada item e imprima o resumo.'],
    ['grupo', 'contatos', 'Fornecedores com WhatsApp a um toque.'],
    ['celular', 'celular e computador', 'É um site: nada para instalar.'],
  ]
  return (
    <section className="ape-plat" id="loja-plataforma">
      <div className="ape-plat-head">
        <p className="ape-eyebrow">plataforma do apê</p>
        <h3 className="ape-sec-t">acompanhe a sua jornada <em>num lugar só</em></h3>
        <p className="ape-lead">Diferente dos arquivos, aqui você registra o <b>seu</b> caso e acompanha do começo ao fim: gastos, parcelas, etapas, vistoria e contatos.</p>
      </div>
      <div className="ape-plat-grid">
        <img src="ape/amostras/m-plataforma.jpg" alt="Telas de exemplo da plataforma do apê" loading="lazy" />
        <div className="ape-plat-feats">
          {recursos.map(([a, t, d]) => (
            <div key={t} className="ape-plat-f">
              <ApeArt name={a} size={32} />
              <span><b>{t}</b>{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ape-plat-buy">
        <div>
          <span className="ape-note">12 meses de acesso</span>
          <div className="ape-price ape-keep">{p.preco}</div>
          <span className="ape-pill azul">pagamento único · sem mensalidade</span>
        </div>
        <ol className="ape-plat-steps">
          <li><b>1</b>Paga uma vez, no Pix ou no cartão</li>
          <li><b>2</b>O link de acesso aparece na hora, na página do pedido</li>
          <li><b>3</b>Usa por 12 meses, sem senha: o link é a sua chave</li>
        </ol>
        <div className="ape-acts" style={{ flexDirection: 'column' }}>
          <BotaoCompra p={p} cart={cart} onAdd={onAdd} me={me} whats={whats} />
          <a className="ape-btn ghost wide" href={href('ape', 'minha:demo')}><ApeIcon name="eye" />experimentar com dados de exemplo</a>
        </div>
      </div>
    </section>
  )
}

/* ===== cartões e preço ===== */
const somaAvulsos = (p: Produto, byId: ById) => (p.combo || []).reduce((t, id) => t + (reais(byId(id)?.preco) || 0), 0)

function Preco({ p, byId, pixPct }: { p: Produto; byId: ById; pixPct?: number }) {
  const soma = somaAvulsos(p, byId)
  const v = reais(p.preco)
  const eco = p.combo?.length ? Math.max(0, soma - v) : 0
  const pix = pixPct ? Math.round((v - Math.round(v * pixPct / 100 * 100) / 100) * 100) / 100 : v // mesma conta do carrinho e do servidor
  return (
    <div className="ape-precos">
      <div className="ape-precos-pix ape-keep">{brl(pix)} <small>no Pix</small></div>
      <div className="ape-precos-cartao ape-keep">{brl(v)} no cartão{p.unidade ? ` · ${p.unidade}` : ''}</div>
      {eco > 0 ? <div className="ape-precos-eco ape-keep"><s>{brl(soma)}</s> separados · economia de {Math.round((eco / soma) * 100)}%</div> : <div className="ape-precos-eco" aria-hidden="true">&nbsp;</div>}
    </div>
  )
}

function BotaoCompra({ p, cart, onAdd, me, whats, wide = true }: { p: Produto; cart: Carrinho; onAdd: (p: Produto) => void; me: Morador | null; whats: string; wide?: boolean }) {
  if (!noCarrinho(p))
    return (
      <a className={`ape-btn primary ${wide ? 'wide' : ''}`} href={wa(whats, msgProduto(p, me))} target="_blank" rel="noopener noreferrer">
        <ApeIcon name="chat" />
        quero
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

function ProdCard({ p, n, byId, onOpen, cart, onAdd, me, whats }: { p: Produto; n?: number; byId: ById; onOpen: () => void; cart: Carrinho; onAdd: (p: Produto) => void; me: Morador | null; whats: string }) {
  const img = p.amostras?.[0]
  return (
    <article className={`ape-prod ${p.destaque ? 'top' : ''}`}>
      <button className="ape-thumb" onClick={onOpen} aria-label={`Ver ${p.nome} por dentro`}>
        {p.combo?.length ? (
          <span className="ape-stack">
            {(p.amostras || []).slice(0, 3).map((a, i) => <img key={a} src={a} alt="" loading="lazy" style={{ ['--i' as string]: i }} />)}
          </span>
        ) : img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <span className="ape-thumb-ic"><ApeArt name={p.arte || 'casa'} size={56} /></span>
        )}
        <span className="ape-ver"><ApeIcon name="eye" />ver por dentro</span>
      </button>
      <div className="ape-prod-h">
        {n ? <span className="ape-prod-n">{n}</span> : null}
        <h3>{p.nome}</h3>
      </div>
      <div className="ape-tags">
        {p.tag && <span className={`ape-pill ${p.destaque ? 'azul' : 'terra'}`}>{p.tag}</span>}
        {p.combo?.length ? <span className="ape-pill">{p.combo.length} arquivos</span> : (p.numeros || []).slice(0, 1).map((x) => <span key={x} className="ape-pill ape-keep">{x}</span>)}
      </div>
      <p className="ape-prod-desc">{p.desc}</p>
      {(p.itens || []).length > 0 && p.combo?.length ? <p className="ape-note ape-prod-extra"><ApeIcon name="gift" /> {p.itens!.map((x) => x.replace(/^\+\s*/, '')).join(' · ')}</p> : null}
      <Preco p={p} byId={byId} pixPct={PIX} />
      <div className="ape-acts">
        <button className="ape-btn wide" onClick={onOpen}>detalhes</button>
        <BotaoCompra p={p} cart={cart} onAdd={onAdd} me={me} whats={whats} />
      </div>
    </article>
  )
}

function Detalhe({ p, byId, produtos, me, whats, onClose, onOpen, cart, onAdd, pixPct }: { p: Produto; byId: ById; produtos: Produto[]; me: Morador | null; whats: string; onClose: () => void; onOpen: (p: Produto) => void; cart: Carrinho; onAdd: (p: Produto) => void; pixPct: number }) {
  const [i, setI] = useState(0)
  const imgs = p.amostras || []
  useEffect(() => {
    setI(0)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [p, onClose])
  const filhos = (p.combo || []).map(byId).filter((x): x is Produto => !!x)
  const kit = p.cat === 'arquivos' ? produtos.filter((k) => k.ativo && k.cat === 'combos' && (k.combo || []).includes(p.id)).sort((a, b) => (a.combo || []).length - (b.combo || []).length)[0] : undefined
  return (
    <div className="ape-sheet" role="dialog" aria-modal="true" aria-label={p.nome} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ape-sheet-in">
        <button className="ape-x" onClick={onClose} aria-label="Fechar"><ApeIcon name="x" /></button>
        {imgs.length > 0 && (
          <div className="ape-gal" onContextMenu={(e) => e.preventDefault()}>
            <img src={imgs[i]} alt={`${p.nome}: prévia ${i + 1}`} draggable={false} />
            {imgs.length > 1 && (
              <div className="ape-dotsn">
                {imgs.map((_, j) => <button key={j} aria-label={`Prévia ${j + 1}`} aria-pressed={i === j} onClick={() => setI(j)} />)}
              </div>
            )}
          </div>
        )}
        <div className="ape-sheet-b">
          <div className="ape-tags">{p.tag && <span className="ape-pill azul">{p.tag}</span>}</div>
          <h2 className="ape-h2">{p.nome}</h2>
          <p style={{ margin: 0, color: 'var(--a-muted)' }}>{p.desc}</p>
          {(p.numeros || []).length > 0 && <div className="ape-nums">{p.numeros!.map((x) => <span key={x}>{x}</span>)}</div>}
          {filhos.length > 0 && (
            <div className="ape-rows">
              {filhos.map((x, j) => (
                <button key={x.id} className="ape-row ape-row-btn" onClick={() => onOpen(x)}>
                  <span className="t"><b>{j + 1}. {x.nome}</b><span>{(x.numeros || []).join(' · ') || x.formato}</span></span>
                  <span className="r"><s className="ape-note ape-keep">{x.preco}</s></span>
                </button>
              ))}
            </div>
          )}
          {(p.itens || []).length > 0 && (
            <>
              <p className="ape-eyebrow" style={{ marginTop: 6 }}>{filhos.length ? 'e ainda' : 'o que tem dentro'}</p>
              <ul className="ape-inc">
                {p.itens!.map((x) => <li key={x}><ApeIcon name="check" />{x.replace(/^\+\s*/, '')}</li>)}
              </ul>
            </>
          )}
          <dl className="ape-facts">
            {p.formato && (<><dt>formato</dt><dd>{p.formato}</dd></>)}
            {p.entrega && (<><dt>como recebo</dt><dd>{p.entrega}</dd></>)}
            {noCarrinho(p) && (<><dt>uso</dt><dd>Pessoal, na sua casa. Não pode repassar nem revender.</dd></>)}
            {noCarrinho(p) && (<><dt>desistência</dt><dd>7 dias para pedir o dinheiro de volta.</dd></>)}
          </dl>
          <Preco p={p} byId={byId} pixPct={pixPct} />
          <div className="ape-acts"><BotaoCompra p={p} cart={cart} onAdd={onAdd} me={me} whats={whats} /></div>
          {kit && !cart.tem(kit.id) && (
            <button className="ape-upsell" onClick={() => onOpen(kit)}>
              <ApeIcon name="gift" />
              <span>
                <b>Também vem no {kit.nome}</b>
                <span>{(kit.combo || []).length} arquivos por <span className="ape-keep">{kit.preco}</span> ({kit.kitPct}% mais barato que separados)</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Kit que vale mais a pena do que os arquivos soltos que estão no carrinho (paga menos ou leva mais por pouco). */
function kitSugerido(ids: string[], produtos: Produto[]) {
  const soltos = ids.filter((id) => produtos.find((p) => p.id === id)?.cat === 'arquivos')
  const preco = (id: string) => reais(produtos.find((p) => p.id === id)?.preco)
  let melhor: { kit: Produto; diferenca: number } | null = null
  for (const k of produtos.filter((p) => p.ativo && p.cat === 'combos' && !ids.includes(p.id))) {
    const dentro = soltos.filter((id) => (k.combo || []).includes(id))
    if (dentro.length < 2) continue
    const diferenca = reais(k.preco) - dentro.reduce((t, id) => t + preco(id), 0) // negativo: o kit sai mais barato
    if (diferenca <= 12 && (!melhor || diferenca < melhor.diferenca)) melhor = { kit: k, diferenca }
  }
  return melhor
}

function CarrinhoSheet({ produtos, pixPct, cart, onClose, onOpen }: { produtos: Produto[]; pixPct: number; cart: Carrinho; onClose: () => void; onOpen: (p: Produto) => void }) {
  const t = conta(cart.ids, produtos, 'pix', pixPct)
  useEffect(() => {
    t.repetidos.forEach((id) => cart.remove(id)) // arquivo que já está num kit do carrinho sai sozinho
  }, [t.repetidos.join()])
  const sug = kitSugerido(t.itens.map((p) => p.id), produtos)
  const trocar = (k: Produto) => {
    ;(k.combo || []).forEach((id) => cart.remove(id))
    cart.add(k.id)
  }
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
                      <span>{p.cat === 'combos' ? `kit com ${(p.combo || []).length} arquivos` : p.cat === 'plataforma' ? '12 meses de acesso' : (p.numeros || []).slice(0, 2).join(' · ')}</span>
                    </button>
                    <div className="r">
                      <b className="num ape-keep">{p.preco}</b>
                      <button className="ape-btn ghost sm" onClick={() => cart.remove(p.id)} aria-label={`Tirar ${p.nome}`}><ApeIcon name="trash" /></button>
                    </div>
                  </div>
                ))}
              </div>
              {sug && (
                <button className="ape-upsell" onClick={() => trocar(sug.kit)}>
                  <ApeIcon name="gift" />
                  <span>
                    <b>Trocar pelo {sug.kit.nome} ({sug.kit.preco})</b>
                    <span className="ape-keep">{sug.diferenca <= 0 ? `Você paga ${brl(-sug.diferenca)} a menos e leva ${(sug.kit.combo || []).length} arquivos.` : `Por ${brl(sug.diferenca)} a mais, leva ${(sug.kit.combo || []).length} arquivos.`}</span>
                  </span>
                </button>
              )}
              <dl className="ape-facts ape-totais">
                <dt>total</dt><dd className="num ape-keep">{brl(t.subtotal)}</dd>
                <dt>no Pix (−{pixPct}%)</dt><dd className="num ape-keep"><b>{brl(t.totalPix)}</b></dd>
              </dl>
              <a className="ape-btn primary" href={href('ape', 'checkout')} onClick={onClose}>
                <ApeIcon name="shield" />
                finalizar compra
              </a>
              <p className="ape-note" style={{ margin: 0, textAlign: 'center' }}>Pix ou cartão à vista · baixa na hora · 7 dias para desistir</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ===== checkout ===== */
export function Checkout({ ajustes, me, whats }: { ajustes: Ajustes; me: Morador | null; whats: string }) {
  const produtos = ajustes.produtos
  const pixPct = ajustes.pixPct ?? 5
  const cart = useCarrinho()
  const [forma, setForma] = useState<'pix' | 'cartao'>('pix')
  const t = conta(cart.ids, produtos, forma, pixPct)
  const [nome, setNome] = useState(me?.nome || '')
  const [cpf, setCpf] = useState('')
  const [tel, setTel] = useState(me?.tel ? fmtTel(me.tel) : '')
  const [email, setEmail] = useState('')
  const [aceite, setAceite] = useState(false)
  const [termos, setTermos] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [tocou, setTocou] = useState<Record<string, boolean>>({})
  useEffect(() => {
    t.repetidos.forEach((id) => cart.remove(id))
  }, [t.repetidos.join()])
  const erros: Record<string, string> = {
    nome: nome.trim().split(/\s+/).length < 2 ? 'Coloque nome e sobrenome.' : '',
    cpf: !cpfOk(cpf) ? 'CPF inválido.' : '',
    email: !emailOk(email) ? 'E-mail inválido.' : '',
    tel: digits(tel).length < 10 ? 'Telefone com DDD.' : '',
  }
  const campo = (k: string) => (tocou[k] && erros[k] ? <span className="ape-ferr">{erros[k]}</span> : null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setTocou({ nome: true, cpf: true, email: true, tel: true })
    const falta = Object.values(erros).filter(Boolean)
    if (falta.length) return setErr('Confira os seus dados.')
    if (!aceite) return setErr('Leia e aceite os termos de uso para continuar.')
    setBusy(true)
    try {
      const r = await criarPedido({ itens: t.itens.map((p) => p.id), morador: me?.id, nome: nome.trim(), cpf: digits(cpf), tel: digits(tel), email: email.trim().toLowerCase(), forma, aceite: true }, produtos, pixPct)
      cart.limpar()
      if (r.forma === 'cartao' && r.url) window.location.href = r.url
      else window.location.hash = `#/ape/pedido:${r.token}`
    } catch (x) {
      setErr(`Não deu para abrir o pagamento agora (${(x as Error).message}).`)
      setBusy(false)
    }
  }
  if (!t.itens.length)
    return (
      <section className="ape-panel ape-empty">
        <ApeIcon name="bag" size={26} />
        <b>seu carrinho está vazio</b>
        <span>Escolha arquivos ou um kit na loja.</span>
        <a className="ape-btn primary" href={href('ape', 'loja')}>ir para a loja</a>
      </section>
    )
  const msgWhats = `Oi! Sou ${nome || 'uma pessoa interessada'}. Tentei comprar e deu erro:\n${t.itens.map((p) => `• ${p.nome} (${p.preco})`).join('\n')}\nTotal: ${brl(t.total)} no ${forma === 'cartao' ? 'cartão' : 'Pix'}`
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
          <CoStep n={1} title="confira os itens">
            <div className="ape-rows">
              {t.itens.map((p) => (
                <div key={p.id} className="ape-row ape-cart-row">
                  <div className="t">
                    <b>{p.nome}</b>
                    <span>{p.cat === 'combos' ? `kit com ${(p.combo || []).length} arquivos` : p.cat === 'plataforma' ? '12 meses de acesso' : (p.numeros || []).slice(0, 2).join(' · ')}</span>
                  </div>
                  <div className="r">
                    <b className="num ape-keep">{p.preco}</b>
                    <button type="button" className="ape-btn ghost sm" onClick={() => cart.remove(p.id)} aria-label={`Tirar ${p.nome}`}><ApeIcon name="trash" /></button>
                  </div>
                </div>
              ))}
            </div>
          </CoStep>
          <CoStep n={2} title="seus dados">
            <div className="ape-frow">
              <div className="ape-f"><label htmlFor="co-nome">Nome completo</label><input id="co-nome" value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => setTocou({ ...tocou, nome: true })} autoComplete="name" />{campo('nome')}</div>
              <div className="ape-f"><label htmlFor="co-cpf"><span className="ape-keep">CPF</span></label><input id="co-cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(fmtCpf(e.target.value))} onBlur={() => setTocou({ ...tocou, cpf: true })} placeholder="000.000.000-00" autoComplete="off" />{campo('cpf')}</div>
            </div>
            <div className="ape-frow">
              <div className="ape-f"><label htmlFor="co-email">E-mail</label><input id="co-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTocou({ ...tocou, email: true })} autoComplete="email" />{campo('email')}</div>
              <div className="ape-f"><label htmlFor="co-tel">Celular (<span className="ape-keep">WhatsApp</span>)</label><input id="co-tel" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} onBlur={() => { setTel(fmtTel(tel)); setTocou({ ...tocou, tel: true }) }} autoComplete="tel" placeholder="(11) 90000-0000" />{campo('tel')}</div>
            </div>
            <span className="ape-hint">Usamos para emitir a cobrança, entregar os arquivos, identificar a sua licença e recuperar a compra em outro aparelho. Dados do cartão você digita só na página segura do Asaas.</span>
          </CoStep>
          <CoStep n={3} title="forma de pagamento">
            <div className="ape-co-pay">
              {([
                ['pix', 'Pix', `${pixPct}% de desconto · libera em segundos`, 'tag'],
                ['cartao', 'Cartão de crédito', 'à vista, na página segura do Asaas', 'shield'],
              ] as const).map(([id, l, h, i]) => (
                <button type="button" key={id} className={forma === id ? 'on' : ''} aria-pressed={forma === id} onClick={() => setForma(id)}>
                  <ApeIcon name={i} />
                  <b>{l}{id === 'pix' && <em className="ape-keep">−{pixPct}%</em>}</b>
                  <small>{h}</small>
                </button>
              ))}
            </div>
          </CoStep>
          <CoStep n={4} title="termos de uso">
            <ul className="ape-termos-curto">
              <li><ApeIcon name="check" />Uso pessoal e individual, na sua casa.</li>
              <li><ApeIcon name="check" />Os materiais são protegidos por direitos autorais: não pode copiar, compartilhar, distribuir ou revender.</li>
              <li><ApeIcon name="check" />Cada PDF sai com o seu nome e parte do CPF no rodapé.</li>
              <li><ApeIcon name="check" />7 dias para desistir, com o dinheiro de volta.</li>
            </ul>
            <label className="ape-co-agree">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
              <span>
                Li e aceito os{' '}
                <button type="button" className="ape-linkish ape-link" onClick={() => setTermos(true)}>termos de uso e a política de privacidade</button>.
              </span>
            </label>
            {err && <p className="ape-err" role="alert">{err}</p>}
            <button className="ape-btn primary ape-co-submit" type="submit" disabled={busy}>
              {busy ? 'abrindo o pagamento…' : <>pagar <span className="ape-keep">{brl(t.total)}</span> {forma === 'pix' ? 'no Pix' : 'no cartão'}</>}
            </button>
            {err && !busy && err.startsWith('Não deu') && (
              <a className="ape-btn" href={wa(whats, msgWhats)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />falar no WhatsApp</a>
            )}
          </CoStep>
        </div>
        <aside className="ape-panel ape-co-sum">
          <p className="ape-eyebrow">resumo</p>
          {t.itens.map((p) => (
            <div key={p.id} className="ape-co-line">
              <span>{p.nome}{p.cat === 'combos' ? <small> · kit</small> : null}</span>
              <span className="num ape-keep">{p.preco}</span>
            </div>
          ))}
          {t.economiaKits > 0 && <div className="ape-co-line ape-co-off"><span>já economizando nos kits</span><span className="num ape-keep">{brl(t.economiaKits)}</span></div>}
          {t.desconto > 0 && (
            <div className="ape-co-line ape-co-off">
              <span>desconto do Pix ({pixPct}%)</span>
              <span className="num ape-keep">−{brl(t.desconto)}</span>
            </div>
          )}
          <div className="ape-co-line ape-co-total">
            <span>total</span>
            <b className="num ape-keep">{brl(t.total)}</b>
          </div>
          <ul className="ape-inc">
            <li><ApeIcon name="download" />baixa assim que o pagamento confirma</li>
            <li><ApeIcon name="gift" />bônus no 8º dia: {BONUS.nome.toLowerCase()}</li>
            <li><ApeIcon name="shield" />pagamento processado pelo Asaas</li>
          </ul>
        </aside>
      </form>
      {termos && <TermosLoja v={ajustes.vendedor} pixPct={pixPct} onClose={() => setTermos(false)} onAccept={() => { setAceite(true); setTermos(false) }} />}
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

/* Termos de uso e privacidade: claros, sem cláusula abusiva (CDC), com o direito de arrependimento inteiro. */
export function TermosLoja({ v, pixPct, onClose, onAccept }: { v?: Vendedor; pixPct: number; onClose: () => void; onAccept?: () => void }) {
  useTravaRolagem(true)
  const quem = v?.nome ? `${v.nome}${v.doc ? `, ${v.doc.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF'} ${v.doc}` : ''}${v.cidade ? `, ${v.cidade}` : ''}` : APE.dona
  return (
    <div className="ape-sheet" role="dialog" aria-modal="true" aria-label="Termos de uso" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ape-sheet-in">
        <button className="ape-x" onClick={onClose} aria-label="Fechar"><ApeIcon name="x" /></button>
        <div className="ape-sheet-b">
          <h2 className="ape-h2">termos de uso e <em>privacidade</em></h2>
          <p className="ape-note" style={{ margin: 0 }}>Versão de 7/11/2026 · loja planê.apê ({SITE_APE})</p>
          <ol className="ape-termos">
            <li><b>Quem vende.</b> {quem}, responsável pela loja planê.apê. Contato: {v?.email || 'equipe.plane@gmail.com'}, WhatsApp e Instagram {APE.instagram}.</li>
            <li><b>O que você compra.</b> Uma licença de uso pessoal, individual e intransferível de conteúdos digitais (PDFs e planilhas) e, se escolher, 12 meses de acesso à plataforma do apê. A compra não transfere a propriedade dos materiais.</li>
            <li><b>O que pode.</b> Usar os materiais para a sua casa, com quem mora com você, no celular, tablet ou computador, e imprimir para uso próprio.</li>
            <li><b>O que não pode.</b> Copiar, compartilhar, enviar em grupos, publicar, distribuir, revender, alugar ou usar com clientes, no todo ou em parte, sem autorização por escrito. Os materiais são protegidos pela Lei de Direitos Autorais (Lei 9.610/98).</li>
            <li><b>Identificação da licença.</b> Cada PDF sai com o nome de quem comprou, parte do CPF e o número do pedido no rodapé, para identificar cópias não autorizadas.</li>
            <li><b>Conteúdo informativo.</b> Os materiais são guias práticos e não substituem a orientação de profissionais habilitados, do seu banco, da construtora ou do contrato. Regras de financiamento e seguro variam conforme o banco, o programa e o contrato.</li>
            <li><b>Preço e pagamento.</b> O preço aparece antes de pagar, com os descontos já aplicados: Pix com {pixPct}% de desconto ou cartão de crédito à vista, sem parcelamento. O pagamento é processado pelo Asaas; os dados do cartão não passam pela loja.</li>
            <li><b>Entrega.</b> Depois da confirmação, a página do pedido mostra os arquivos para baixar e, se for o caso, o link da plataforma. Você pode baixar de novo quando quiser pela página do pedido ou em "minhas compras".</li>
            <li><b>Bônus.</b> Toda compra paga ganha, 7 dias depois, um bônus gratuito ({BONUS.nome.toLowerCase()}). Ele é um presente: não tem custo, não muda o preço e não reduz nem condiciona o direito de desistir.</li>
            <li><b>Direito de arrependimento.</b> Você pode desistir em até 7 dias depois da compra, sem precisar explicar o motivo (art. 49 do Código de Defesa do Consumidor), pelo WhatsApp ou e-mail. Devolvemos o valor integral, pelo mesmo meio de pagamento. Com o reembolso, a licença é cancelada: os links deixam de funcionar e pedimos que você apague os arquivos baixados.</li>
            <li><b>Problemas.</b> Arquivo com defeito ou que não abre: corrigimos, trocamos ou devolvemos o valor, como prevê o Código de Defesa do Consumidor.</li>
            <li><b>Plataforma do apê.</b> O acesso dura 12 meses a partir da liberação (ou 1 mês no presente do kit completo), por um link pessoal que funciona como chave: guarde-o e não compartilhe. Os dados que você registra são seus; depois do prazo, a plataforma fica só para consulta.</li>
            <li><b>Seus dados (LGPD).</b> Usamos nome, CPF, e-mail e celular só para emitir a cobrança, entregar, identificar a licença, recuperar compras e atender você. Eles são compartilhados apenas com o Asaas (pagamento) e com o Supabase (onde o site guarda as informações). Você pode pedir acesso, correção ou exclusão pelo e-mail acima, respeitado o que a lei obriga a guardar.</li>
            <li><b>Foro.</b> Vale a lei brasileira; você pode resolver qualquer questão no foro da sua cidade.</li>
          </ol>
          {onAccept ? <button className="ape-btn primary" onClick={onAccept}>li e aceito</button> : <button className="ape-btn" onClick={onClose}>fechar</button>}
        </div>
      </div>
    </div>
  )
}

function Vendedor({ v, whats }: { v?: Vendedor; whats: string }) {
  const [termos, setTermos] = useState(false)
  return (
    <p className="ape-note ape-vendedor">
      Dúvidas: <a className="ape-link" href={wa(whats, 'Oi! Tenho uma dúvida sobre a loja do planê.apê.')} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      {v?.email && <> · <a className="ape-link" href={`mailto:${v.email}`}>{v.email}</a></>}
      {' · '}
      <button className="ape-linkish ape-link" onClick={() => setTermos(true)}>termos de uso e privacidade</button>
      {v?.nome && v.doc && <><br />Vendido por {v.nome} · {v.doc.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF'} {v.doc}{v.cidade ? ` · ${v.cidade}` : ''}</>}
      {termos && <TermosLoja v={v} pixPct={5} onClose={() => setTermos(false)} />}
    </p>
  )
}

/* ===== minhas compras: neste aparelho ou recuperadas pelo CPF + e-mail ===== */
function MinhasCompras() {
  const [l, setL] = useState(pedidosLocais())
  const [abrir, setAbrir] = useState(false)
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [plat, setPlat] = useState<{ token: string; validade: string } | null>(null)
  const buscar = async (e: FormEvent) => {
    e.preventDefault()
    if (!cpfOk(cpf) || !emailOk(email)) return setMsg('Confira o CPF e o e-mail usados na compra.')
    setMsg('buscando…')
    try {
      const r = await recuperarCompras(digits(cpf), email.trim().toLowerCase())
      setL(pedidosLocais())
      setPlat(r.plataforma)
      setMsg(r.pedidos.length ? `${r.pedidos.length} compra${r.pedidos.length > 1 ? 's' : ''} encontrada${r.pedidos.length > 1 ? 's' : ''}.` : 'Nenhuma compra com esse CPF e e-mail.')
    } catch (x) {
      setMsg(String((x as Error).message))
    }
  }
  return (
    <section className="ape-panel ape-minhas" id="loja-compras">
      <div className="ape-minhas-h">
        <p className="ape-eyebrow">minhas compras</p>
        <button className="ape-btn ghost sm" onClick={() => setAbrir(!abrir)}>{abrir ? 'fechar' : 'comprou em outro aparelho?'}</button>
      </div>
      {l.length > 0 ? (
        <div className="ape-rows">
          {l.slice(0, 6).map((p) => (
            <a key={p.token} className="ape-row" href={href('ape', `pedido:${p.token}`)}>
              <span className="t"><b>Pedido de {dmy(p.criado)}</b><span className="ape-keep">{Number(p.total) ? brl(Number(p.total)) : 'cortesia'}</span></span>
              <span className="r"><span className="ape-pill azul"><ApeIcon name="download" />abrir</span></span>
            </a>
          ))}
        </div>
      ) : (
        !abrir && <span className="ape-note">As compras feitas neste aparelho aparecem aqui.</span>
      )}
      {abrir && (
        <form className="ape-frow ape-recuperar" onSubmit={buscar} noValidate>
          <div className="ape-f"><label htmlFor="rc-cpf"><span className="ape-keep">CPF</span> da compra</label><input id="rc-cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(fmtCpf(e.target.value))} placeholder="000.000.000-00" /></div>
          <div className="ape-f"><label htmlFor="rc-email">E-mail da compra</label><input id="rc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="ape-btn primary" type="submit">buscar</button>
        </form>
      )}
      {msg && <span className="ape-note">{msg}</span>}
      {plat && <a className="ape-btn" href={href('ape', `minha:${plat.token}`)}><ApeIcon name="phone" />abrir a minha plataforma</a>}
    </section>
  )
}

/* ===== página do pedido: Pix na tela, arquivos, bônus e plataforma ===== */
export function PedidoPage({ token, whats }: { token: string; whats: string }) {
  const [p, setP] = useState<Pedido | null | undefined>(undefined)
  const [copiado, setCopiado] = useState(false)
  const [baixando, setBaixando] = useState('')
  const [err, setErr] = useState('')
  const [n, setN] = useState(0)
  useEffect(() => {
    let vivo = true
    let k = 0
    let timer = 0
    const load = () =>
      verPedido(token).then((r) => {
        if (!vivo) return
        setP(r)
        // pagamento ainda não confirmou: confere de novo por uns minutos
        if (r && r.status === 'pendente' && k++ < 120) timer = window.setTimeout(load, 5000)
      })
    void load()
    return () => {
      vivo = false
      window.clearTimeout(timer)
    }
  }, [token, n])
  const baixar = async (path: string) => {
    setErr('')
    setBaixando(path)
    try {
      const url = await baixarArquivo(token, path)
      window.location.href = url
    } catch (x) {
      setErr(String((x as Error).message))
    }
    setBaixando('')
  }
  if (p === undefined) return <section className="ape-panel ape-empty"><span className="ape-thinking"><span className="ape-dots"><i /><i /><i /></span>conferindo o pedido…</span></section>
  if (p === null)
    return (
      <section className="ape-panel ape-empty">
        <b>pedido não encontrado</b>
        <span>Confira o link ou procure em "minhas compras" com o CPF e o e-mail.</span>
        <div className="ape-acts" style={{ justifyContent: 'center' }}>
          <a className="ape-btn" href={href('ape', 'loja')}>ir para a loja</a>
          <a className="ape-btn" href={wa(whats, `Oi! Fiz uma compra na loja do planê.apê e não estou achando o meu pedido (${token.slice(0, 8)}).`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />WhatsApp</a>
        </div>
      </section>
    )
  if (p.status === 'cancelado' || p.status === 'reembolsado')
    return (
      <section className="ape-panel ape-empty">
        <b>{p.status === 'reembolsado' ? 'pedido reembolsado' : 'pedido cancelado'}</b>
        <span>{p.status === 'reembolsado' ? 'O valor foi devolvido e a licença foi cancelada.' : 'Este pedido não foi pago. Você pode fazer um novo quando quiser.'}</span>
        <a className="ape-btn primary" href={href('ape', 'loja')}>ir para a loja</a>
      </section>
    )
  if (p.status !== 'pago')
    return (
      <section className="ape-panel ape-done ape-pix">
        <h2 className="ape-h2">falta só <em>pagar</em></h2>
        <span className="ape-pill">{p.itens.map((i) => i.nome).join(' + ')}</span>
        <div className="ape-price ape-keep">{brl(Number(p.total))}{p.desconto ? <small className="ape-keep"> com {brl(Number(p.desconto))} de desconto do Pix</small> : null}</div>
        {p.pix ? (
          <>
            <ol className="ape-psteps ape-psteps-num">
              <li><b>1</b><span>Abra o app do seu banco e escolha <b>Pix</b></span></li>
              <li><b>2</b><span>Leia o QR Code ou use o <b>copia e cola</b></span></li>
              <li><b>3</b><span>Pronto: os arquivos aparecem aqui sozinhos</span></li>
            </ol>
            {p.pix.img ? <img className="ape-qr" src={`data:image/png;base64,${p.pix.img}`} alt="QR Code do Pix" /> : <span className="ape-qr ape-qr-falso" aria-hidden="true"><ApeArt name="carrinho" size={60} /></span>}
            <button className="ape-btn primary" onClick={() => { void navigator.clipboard?.writeText(p.pix!.copia); setCopiado(true) }}>
              <ApeIcon name={copiado ? 'check' : 'clip'} />
              {copiado ? 'código copiado' : 'copiar código Pix'}
            </button>
          </>
        ) : (
          <p className="ape-note" style={{ maxWidth: '46ch', margin: 0 }}>Assim que o pagamento for confirmado, os arquivos aparecem aqui. A página confere sozinha a cada poucos segundos.</p>
        )}
        <span className="ape-thinking"><span className="ape-dots"><i /><i /><i /></span>aguardando a confirmação</span>
        {!apeCloud && <button className="ape-btn ghost sm" onClick={() => { simularPagamento(token); setN(n + 1) }}>prévia: simular pagamento</button>}
      </section>
    )
  const plat = p.plataforma
  return (
    <section className="ape-panel ape-form ape-pedido">
      <div className="ape-done" style={{ padding: 0 }}>
        <ApeIcon name="check" />
        <h2 className="ape-h2">{p.cortesia ? 'acesso' : 'pagamento'} <em>liberado</em></h2>
        <p className="ape-note" style={{ margin: 0 }}>Obrigada{p.nome ? `, ${firstName(p.nome)}` : ''}! Guarde este link para baixar de novo depois.</p>
      </div>
      {plat && (
        <a className="ape-plat-acesso" href={href('ape', `minha:${plat.token}`)}>
          <ApeArt name="celular" size={40} />
          <span>
            <b>abrir a minha plataforma do apê</b>
            <span>acesso até {dmy(plat.validade)} · este link é a sua chave, não compartilhe</span>
          </span>
          <ApeIcon name="chev" />
        </a>
      )}
      {p.arquivos?.length ? (
        <>
          <p className="ape-eyebrow">seus arquivos</p>
          <div className="ape-rows">
            {p.arquivos.map((a, i) => (
              <button key={a.path} className="ape-row ape-row-btn" onClick={() => void baixar(a.path)} disabled={!!baixando}>
                <span className="t"><b>{i + 1}. {a.produto}</b><span>{a.nome}</span></span>
                <span className="r"><span className="ape-btn primary sm"><ApeIcon name="download" />{baixando === a.path ? 'preparando…' : 'baixar'}</span></span>
              </button>
            ))}
          </div>
          <span className="ape-note">Os PDFs saem com o seu nome no rodapé (licença de uso pessoal).</span>
        </>
      ) : (
        p.itens.some((i) => i.id !== 'plataforma') && (
          <div className="ape-banner warn">
            Os arquivos estão sendo preparados. Fale no WhatsApp que enviamos agora.
            <a className="ape-btn sm" href={wa(whats, `Oi! O pedido ${token.slice(0, 8)} (${p.itens.map((i) => i.nome).join(', ')}) foi pago e os arquivos não apareceram.`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
        )
      )}
      {err && <p className="ape-err" role="alert">{err}</p>}
      {p.bonus && (
        <div className={`ape-bonus ${p.bonus.liberado ? 'on' : ''}`}>
          <ApeIcon name="gift" />
          <span>
            <b>bônus: {BONUS.nome.toLowerCase()}</b>
            <span>{p.bonus.liberado ? 'Liberado: ele está na lista acima.' : `Chega aqui em ${p.bonus.em ? dmy(p.bonus.em) : '7 dias'}. Volte nesta página.`}</span>
          </span>
        </div>
      )}
      <p className="ape-note" style={{ margin: 0 }}>Precisa de ajuda ou quer desistir (até 7 dias depois da compra)? <a className="ape-link" href={wa(whats, `Oi! Sobre o pedido ${token.slice(0, 8)}:`)} target="_blank" rel="noopener noreferrer">fale no WhatsApp</a>.</p>
    </section>
  )
}
