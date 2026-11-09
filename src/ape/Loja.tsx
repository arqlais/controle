import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { href } from '../router'
import { baixarArquivo, avisarErroPagamento, contaApi, guardarSessao, nomeLocal, sessaoLocal, criarPedido, depoimentos as carregarDepoimentos, pedidosLocais, recuperarCompras, simularPagamento, verPedido, apeCloud, type Ajustes, type Pedido, type Vendedor } from './api'
import { ApeArt } from './ApeArt'
import { ApeIcon } from './ApeIcon'
import { APE, BONUS, JUROS_PCT, KIT_PLATAFORMA_MESES, parcelas, brl, conta, digits, dmy, firstName, fmtTel, msgProduto, noCarrinho, reais, wa, type Morador, type Produto } from './model'
import { Recolhe, mascaraTel, SITE_APE, cpfOk, emailOk, fmtCpf, useCarrinho, useToast, useTravaRolagem, type Carrinho } from './shared'

/* Loja do planê.apê: página de vendas aberta a todos, carrinho, checkout e página do pedido. */

type ById = (id: string) => Produto | undefined
const COR: Record<string, string> = { azul: '#4e6472', rosa: '#a86b78', roxa: '#6e5f86', verde: '#5f7566' }
/** Imagem do produto pelo nome (para a página do pedido). */
const amostraDe = (nome: string) => PRODUTOS_LOJA.find((p) => p.nome === nome)?.amostras?.[0]
let PRODUTOS_LOJA: Produto[] = []
let PIX = 5 // desconto do Pix da loja salva (definido ao abrir a loja)
// cada selo ("mais vendido", "queridinho"...) aparece num produto só, para não repetir
let SELO_OK = new Set<string>()

export function Loja({ ajustes, me, whats, abrir }: { ajustes: Ajustes; me: Morador | null; whats: string; abrir?: string }) {
  const produtos = ajustes.produtos
  const pixPct = ajustes.pixPct ?? 5
  PIX = pixPct
  PRODUTOS_LOJA = produtos
  { const vistos = new Set<string>(); SELO_OK = new Set(produtos.filter((p) => p.ativo && p.selo).filter((p) => { const k = (p.selo || '').trim().toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true }).map((p) => p.id)) }
  const ativos = produtos.filter((p) => p.ativo)
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
  const fases: Fase[] = [
    { id: 'comprando', l: 'para quem vai comprar', d: 'Na planta ou pronto: visita, simulação, financiamento, seguros e contrato.', arte: 'contrato', chip: 'vou comprar' },
    { id: 'comprei', l: 'para quem já comprou', d: 'Vistoria, obra, orçamentos, mudança e decoração.', arte: 'vistoria', chip: 'já comprei' },
    { id: 'escolhas', l: 'para escolher acabamentos e materiais', d: 'Pedras, pisos, marcenaria, banheiro, cozinha, luz, tomadas, tintas, gesso, ar, cortinas e segurança: prós, contras e preços de cada opção.', arte: 'orcamento', chip: 'acabamentos' },
  ]
  const modais = (
    <>
      {cart.ids.length > 0 && !verCarrinho && (
        <button key={cart.ids.length} className="ape-cartfab" onClick={() => setVerCarrinho(true)}>
          <ApeIcon name="bag" />
          <span>{tot.itens.length} {tot.itens.length > 1 ? 'itens' : 'item'} · <b className="ape-keep">{brl(tot.subtotal)}</b></span>
          <b className="go">finalizar<ApeIcon name="chev" /></b>
        </button>
      )}
      {aberto && <Detalhe p={aberto} byId={byId} produtos={produtos} me={me} whats={whats} onClose={() => setAberto(null)} onOpen={setAberto} cart={cart} onAdd={(p) => { adicionar(p); setAberto(null) }} pixPct={pixPct} />}
      {verCarrinho && <CarrinhoSheet produtos={produtos} pixPct={pixPct} cart={cart} onClose={() => setVerCarrinho(false)} onOpen={(p) => { setVerCarrinho(false); setAberto(p) }} />}
      {toast}
    </>
  )
  if (abrir?.startsWith('arquivos'))
    return (
      <>
        <Catalogo fases={fases} arquivos={arquivos} kits={kits} ini={abrir.split('-')[1]} byId={byId} onOpen={setAberto} cart={cart} onAdd={adicionar} me={me} whats={whats} />
        {modais}
      </>
    )
  return (
    <>
      <section className="ape-lp-hero">
        <div className="ape-blobs" aria-hidden="true"><i /><i /><i /></div>
        <div className="ape-lp-text">
          <p className="ape-kicker"><span className="ape-dot" />casa ou apê, de qualquer tamanho</p>
          <h2>do contrato às chaves, <em>sem susto</em></h2>
          <p className="ape-lead">Guias, checklists e planilhas para cada etapa: comprar, receber as chaves, fazer a obra, mudar e decorar.</p>
          <div className="ape-acts">
            <a className="ape-btn primary" href={href('ape', 'loja:arquivos')}><ApeIcon name="bag" />ver os arquivos</a>
          </div>
          <div className="ape-trust">
            <span><ApeIcon name="tag" /><span className="ape-keep">{pixPct}% off no Pix</span></span>
            <span><ApeIcon name="download" />baixa na hora</span>
            <span><ApeIcon name="check" />7 dias para desistir</span>
          </div>
        </div>
        <HeroArt pix={pixPct} />
      </section>


      <MinhasCompras nome={me?.nome} />

      <div className="ape-marquee" aria-hidden="true">
        <div className="ape-marquee-track">
          {[0, 1].map((k) => (
            <span key={k}>
              {arquivos.map((p) => <b key={p.id}><ApeIcon name="check" />{p.nome.toLowerCase()}</b>)}
            </span>
          ))}
        </div>
      </div>


      {/* o que tem na loja, num bloco só: arquivos por etapa, kits e plataforma */}
      <section className="ape-oque" aria-label="O que tem na loja">
        <h3 className="ape-sec-t">o que você <em>precisa?</em></h3>
        <div className="ape-oque-grid">
          <div className="ape-esc arq">
            <div className="ape-esc-h">
              <ApeArt name="planilha" size={44} />
              <span><b>arquivos e planilhas</b><small>baixa, usa e fica com você</small></span>
            </div>
            <div className="ape-esc-l">
              {fases.map((f) => {
                const lista = arquivos.filter((p) => (p.fase || 'comprei') === f.id)
                if (!lista.length) return null
                return (
                  <a key={f.id} href={href('ape', `loja:arquivos-${f.id}`)}>
                    <ApeArt name={f.arte} size={30} />
                    <span><b>{f.chip}</b><small>{lista.length} arquivos</small></span>
                    <ApeIcon name="chev" />
                  </a>
                )
              })}
              {kits.length > 0 && (
                <a className="kit" href={href('ape', 'loja:arquivos-kits')}>
                  <ApeArt name="casa" size={30} tone="sec" />
                  <span><b>kits</b><small>até {Math.max(0, ...kits.map((k) => k.kitPct || 0))}% off</small></span>
                  <ApeIcon name="chev" />
                </a>
              )}
            </div>
            <a className="ape-esc-todos" href={href('ape', 'loja:arquivos')}>ver todos os {arquivos.length} arquivos e kits<ApeIcon name="chev" /></a>
          </div>
          {plat && (
            <button type="button" className="ape-esc plat" onClick={() => ir('loja-plataforma')}>
              <ApeArt name="celular" size={44} />
              <b>plataforma do apê</b>
              <small>Um site para <u>acompanhar a jornada inteira</u> com os seus dados: gastos, parcelas, obra, vistoria.</small>
              <em>12 meses · <span className="ape-keep">{plat.preco}</span></em>
              <span className="ape-esc-todos">conhecer<ApeIcon name="chev" /></span>
            </button>
          )}
        </div>
      </section>

      {/* os que mais chamam atenção, misturados (arquivos e kits), numa fileira que rola */}
      {(() => {
        const nota = (p: Produto) => (p.destaque ? 4 : 0) + (p.selo ? 3 : 0) + ((p.amostras || []).length ? 1 : 0)
        const arqTop = [...arquivos].sort((x, y) => nota(y) - nota(x)).slice(0, 5)
        const kitTop2 = [...kits].sort((x, y) => nota(y) - nota(x)).slice(0, 2)
        const mix = arqTop.flatMap((p, i) => (i === 2 && kitTop2[0] ? [kitTop2[0], p] : [p]))
        if (!mix.length) return null
        return (
          <section className="ape-nicho ape-destaques" aria-label="Os mais procurados">
            <h3 className="ape-sec-t">os mais <em>queridos</em></h3>
            <Fileira n={mix.length} rotulo="arquivos" todos={{ href: href('ape', 'loja:arquivos'), l: `ver todos os ${arquivos.length} arquivos e kits` }}>
              {mix.map((p) => <ProdCard key={p.id} p={p} byId={byId} onOpen={() => setAberto(p)} cart={cart} onAdd={adicionar} me={me} whats={whats} />)}
            </Fileira>
          </section>
        )
      })()}

      {plat && <PlataformaSec p={plat} cart={cart} onAdd={adicionar} me={me} whats={whats} juros={ajustes.jurosPct ?? JUROS_PCT} pix={pixPct} />}
      <ServicosSec whats={whats} me={me} foto={ajustes.fotoProjeto} foto2={ajustes.fotoProjeto2} />

      <div className="ape-garantias">
      <Surpresa />

      <section className="ape-panel ape-garantia">
        <ApeArt name="entregas" size={56} tone="sec" />
        <div>
          <h3 className="ape-sec-t">7 dias para <em>desistir</em></h3>
          <p className="ape-note" style={{ margin: 0 }}>Não era o que esperava? Em até 7 dias você pede o dinheiro de volta, inteiro, sem precisar explicar (art. 49 do Código de Defesa do Consumidor).</p>
        </div>
      </section>
      </div>

      <Depoimentos />
      <section className="ape-story ape-panel">
        <span className="ape-me-av">L</span>
        <div>
          <p className="ape-eyebrow">quem fez</p>
          <p>Oi! Sou a {APE.dona}, estou me formando em arquitetura e montando o meu apê de {APE.meuApe}. Juntei aqui o que eu precisei e não achei pronto: o que perguntar antes de assinar, o que conferir na vistoria, quanto custa de verdade e como organizar a obra.</p>
        </div>
      </section>
      <section className="ape-faq" id="loja-duvidas">
        <h3 className="ape-sec-t">dúvidas <em>frequentes</em></h3>
        {[
          ['Qual a diferença entre os arquivos e a plataforma?', 'Os arquivos são materiais prontos para uma tarefa (um checklist, um guia, uma planilha): você baixa e usa quando quiser. A plataforma é um site onde você registra o seu caso (gastos, parcelas, etapas, vistoria com fotos) e acompanha tudo por 12 meses. Dá para comprar um sem o outro.'],
          ['Serve para casa? E para outros tamanhos?', `Serve para casa ou apê de qualquer tamanho, na planta ou pronto. Quando aparece um exemplo com medidas, é de um apê de ${APE.meuApe}; você troca pelos seus números.`],
          ['Como eu recebo?', 'Pagou, a página do pedido mostra os botões de baixar (no Pix, em segundos). Para baixar de novo em outro aparelho, use "minhas compras" com o CPF e o e-mail da compra.'],
          ['Quais formas de pagamento?', `Pix, com ${pixPct}% de desconto, ou cartão de crédito: à vista sem juros ou em até 12x com juros (parcela mínima de R$ 5).`],
          ['Tem desconto levando mais?', 'Os kits já têm o desconto no preço e saem bem mais em conta que os arquivos separados. Além disso, o Pix tem desconto em qualquer compra.'],
          ['Posso compartilhar?', 'Pode usar com quem mora com você, na sua casa. Os arquivos são de uso pessoal: não podem ser repassados, revendidos, postados ou enviados em grupos. Cada PDF sai com o nome de quem comprou.'],
          ['Funciona no celular?', 'Sim. Os PDFs abrem em qualquer celular, tablet ou computador, e as planilhas funcionam no Excel, no Google Planilhas e no Numbers. A plataforma do apê é feita para usar no celular.'],
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
      <Vendedor v={ajustes.vendedor} whats={whats} />
      {modais}
    </>
  )
}

/* capa da loja: as capas dos arquivos soltas, um celular com a plataforma e avisos flutuando (mexe com o mouse) */
function HeroArt({ pix }: { pix: number }) {
  const [feitos, setFeitos] = useState(2)
  useEffect(() => {
    const i = window.setInterval(() => setFeitos((n) => (n >= 5 ? 2 : n + 1)), 1800)
    return () => window.clearInterval(i)
  }, [])
  const etapas = ['vistoria', 'chaves', 'piso', 'marcenaria', 'mudança']
  return (
    <div
      className="ape-hero-art"
      aria-hidden="true"
    >
      <img className="ape-hp p1" src="ape/amostras/c-compra.jpg" alt="" />
      <img className="ape-hp p2" src="ape/amostras/c-checklist.jpg" alt="" />
      <img className="ape-hp p3" src="ape/amostras/c-planner.jpg" alt="" />
      <div className="ape-hero-cel">
        <div className="ape-hc-top"><b>meu apê</b><span>40 m²</span></div>
        <div className="ape-hc-card">
          <span>gasto até agora</span>
          <b className="ape-keep">R$ 18.420</b>
          <i><em style={{ width: '46%' }} /></i>
          <small className="ape-keep">de R$ 40.000 planejados</small>
        </div>
        <div className="ape-hc-card">
          <span>obra, passo a passo</span>
          {etapas.map((e, k) => (
            <p key={e} className={`${k < feitos ? 'ok' : ''} ${k === feitos - 1 ? 'agora' : ''}`}><u>{k < feitos ? <ApeIcon name="check" /> : null}</u>{e}</p>
          ))}
        </div>
      </div>
      <div className="ape-hf f1"><span className="ic"><ApeIcon name="check" /></span><span><b>vistoria feita</b><small>2 problemas anotados</small></span></div>
      <div className="ape-hf f2"><span className="ic sec"><ApeIcon name="tag" /></span><span><b className="ape-keep">{pix}% off no Pix</b><small>baixa na hora</small></span></div>
      <div className="ape-hf f3"><span className="ic"><ApeIcon name="lock" /></span><span><b>bônus surpresa</b><small>abre no 8º dia</small></span></div>
    </div>
  )
}

/* depoimentos publicados pela dona (só aparecem se houver) */
function Depoimentos() {
  const [l, setL] = useState<Awaited<ReturnType<typeof carregarDepoimentos>>>([])
  useEffect(() => void carregarDepoimentos().then(setL), [])
  if (!l.length) return null
  const cores = ['azul', 'terra', 'madeira']
  const cartao = (d: (typeof l)[number], i: number, k: string) => {
    const [nome, onde] = String(d.nome || '').split(/\s+[-–·]\s+/)
    return (
      <figure key={k} className={`ape-depo2 ${cores[i % 3]}`}>
                <blockquote>{d.texto}</blockquote>
        <figcaption>
          <span className="av">{(nome || '?').trim().charAt(0).toUpperCase()}</span>
          <span><b>{nome}</b>{onde ? <small>{onde}</small> : null}</span>
          {d.nota ? <span className="nota" aria-label={`${d.nota} de 5`}>{'★'.repeat(d.nota)}</span> : null}
        </figcaption>
      </figure>
    )
  }
  const rola = l.length >= 3
  return (
    <section className="ape-depos2" aria-label="Depoimentos">
      <h3 className="ape-sec-t">quem comprou <em>conta</em></h3>
      <div className={`ape-depos2-vp ${rola ? 'rola' : ''}`}>
        <div className="ape-depos2-track" style={{ ['--n' as string]: l.length }}>
          {l.map((d, i) => cartao(d, i, 'a' + i))}
        </div>
      </div>
    </section>
  )
}

/* ===== serviços: separado dos produtos digitais, sempre com proposta antes ===== */
function ServicosSec({ whats, me, foto, foto2 }: { whats: string; me: Morador | null; foto?: string; foto2?: string }) {
  const msg = `Oi! ${me ? `Sou ${me.nome}. ` : ''}Vi a página do planê.apê e queria uma proposta de projeto/reforma para a minha casa/apê.`
  const servicos: [string, string][] = [
    ['projeto de interiores', 'sofa'],
    ['marcenaria planejada', 'tool'],
    ['elétrica e iluminação', 'bolt'],
    ['vistoria das chaves', 'check'],
    ['reforma', 'brush'],
    ['acompanhar a obra', 'home'],
  ]
  return (
    <section className="ape-proj" id="loja-servicos">
      <div className="ape-proj-txt">
        <span className="ape-proj-tag">serviço à parte · sob orçamento</span>
        <h3>precisa de um <em>projeto?</em></h3>
        <p className="ape-proj-eu">Sou a {APE.dona}, estou no {APE.semestre} semestre de Arquitetura e Urbanismo e trabalho com o meu pai, engenheiro civil, em projetos e reformas.</p>
        <ul className="ape-proj-serv">{servicos.map(([t, i]) => <li key={t}><span className="ic"><ApeIcon name={i} /></span>{t}</li>)}</ul>
        <p className="ape-proj-local"><ApeIcon name="home" />vistoria de entrega das chaves em Santo André, ABC e região (SP)</p>
        <a className="ape-btn ape-proj-btn" href={wa(whats, msg)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />orçamento no WhatsApp</a>
      </div>
      <div className={`ape-proj-img ${foto && foto2 ? 'duas' : ''}`}>
        <img src={foto || 'ape/amostras/projeto-3d.jpg'} alt="Projeto de interiores" loading="lazy" />
        {foto && foto2 && <img src={foto2} alt="Projeto de interiores, outro ambiente" loading="lazy" />}
      </div>
    </section>
  )
}

/* ===== plataforma do apê ===== */
function PlataformaSec({ p, cart, onAdd, me, whats, juros, pix }: { p: Produto; cart: Carrinho; onAdd: (p: Produto) => void; me: Morador | null; whats: string; juros: number; pix: number }) {
  const v = reais(p.preco)
  const ops = parcelas(v, juros)
  const ult = ops[ops.length - 1]
  const mes = v / 12
  const recursos: [string, string, string][] = [
    ['calculo', 'compra e financiamento', 'Entrada, juros de obra, financiamento e ITBI, para quem acabou de comprar.'],
    ['planilha', 'gastos, parcelas e contas', 'O dinheiro da casa mês a mês, com gráficos.'],
    ['comparar', 'orçamentos', 'Anote, compare e, quando fechar, vira gasto.'],
    ['vistoria', 'vistoria das chaves', 'Ok ou problema em cada item, com foto e resumo.'],
    ['projeto3d', 'etapas da obra', 'O próximo passo sempre à vista.'],
    ['medidas', 'medidas do apê', 'Para piso, tinta, cortinas e móveis.'],
    ['enxoval', 'enxoval e mudança', 'Com prioridade e passo a passo.'],
    ['contrato', 'garantias e documentos', 'Avisa antes de vencer e guarda cada papel.'],
  ]
  const [mais, setMais] = useState(false)
  return (
    <section className="ape-plat" id="loja-plataforma">
      <div className="ape-plat-head">
        <p className="ape-eyebrow">plataforma do apê{p.selo ? <span className="ape-pill rosa" style={{ marginLeft: 8 }}><ApeIcon name="star" />{p.selo}</span> : null}</p>
        <h3 className="ape-sec-t">acompanhe a sua jornada <em>num lugar só</em></h3>
        <p className="ape-lead">Para quem acabou de comprar ou vai receber as chaves: registre o <b>seu</b> caso e acompanhe do começo ao fim.</p>
      </div>
      <div className="ape-plat-grid">
        <PlatCelulares />
        <div className="ape-plat-feats">
          {(mais ? recursos : recursos.slice(0, 4)).map(([a, t, d]) => (
            <div key={t} className="ape-plat-f">
              <ApeArt name={a} size={32} />
              <span><b>{t}</b>{d}</span>
            </div>
          ))}
          <button type="button" className="ape-plat-mais" aria-expanded={mais} onClick={() => setMais(!mais)}>{mais ? 'mostrar menos' : `e mais ${recursos.length - 4} recursos`}<ApeIcon name="chev" /></button>
        </div>
      </div>
      <div className="ape-plat-buy">
        <div className="ape-plat-preco">
          <span className="ape-note">12 meses de acesso · pagamento único</span>
          <div className="ape-price ape-keep">{p.preco} <small>à vista</small></div>
          {ult.n > 1 && <div className="ape-plat-parc ape-keep">ou {ult.n}x de {brl(ult.parcela)} no cartão</div>}
          <div className="ape-plat-mes"><ApeIcon name="sparkle" /><span>preço de cafezinho: <b className="ape-keep">menos de R$ {Math.ceil(ult.n > 1 ? ult.parcela : mes)} por mês</b>{ult.n > 1 ? ` em ${ult.n}x` : ''} para a casa nova toda organizada</span></div>
          <span className="ape-pill azul">sem mensalidade · <span className="ape-keep">{pix}% off no Pix</span></span>
        </div>
        <ol className={`ape-plat-steps ${mais ? '' : 'curto'}`}>
          <li><b>1</b>Paga uma vez: Pix, cartão à vista ou parcelado</li>
          <li><b>2</b>Cria o seu acesso com e-mail e senha, na hora</li>
          <li><b>3</b>Usa por 12 meses no celular ou no computador, em minha conta</li>
        </ol>
        <div className="ape-acts" style={{ flexDirection: 'column' }}>
          <BotaoCompra p={p} cart={cart} onAdd={onAdd} me={me} whats={whats} />
        </div>
      </div>
    </section>
  )
}

/* três celulares (proporção de iPhone) com telas de verdade da plataforma: resumo, gastos e vistoria */
function PlatCelulares() {
  return (
    <div className="ape-iphs" aria-label="Telas da plataforma do apê no celular" role="img">
      <div className="ape-iph lado l">
        <div className="tela">
          <div className="iph-top"><b>compras e gastos</b></div>
          {[['piso vinílico', 'sala · pago', 'R$ 3.780'], ['marcenaria', 'cozinha · comprado', 'R$ 14.000'], ['box', 'banheiro · planejado', 'R$ 1.300'], ['pintura', 'geral · planejado', 'R$ 3.500']].map(([a, b, c]) => (
            <div key={a} className="iph-linha"><i /><span><b>{a}</b><small>{b}</small></span><em>{c}</em></div>
          ))}
        </div>
      </div>
      <div className="ape-iph meio">
        <div className="tela">
          <div className="iph-ola"><span className="av">A</span><span><b>olá, Ana!</b><small>Vila Jardins · torre 1 · apê 304</small></span></div>
          <div className="iph-kpis"><div><small>gasto até agora</small><b>R$ 18.420</b></div><div><small>parcelas do mês</small><b>R$ 1.400</b></div></div>
          <div className="iph-card">
            <small>orçamento da obra</small>
            <div className="iph-rosca"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="16" fill="none" stroke="var(--a-pri-soft)" strokeWidth="6" /><circle cx="21" cy="21" r="16" fill="none" stroke="var(--a-pri)" strokeWidth="6" strokeDasharray="46 100" transform="rotate(-90 21 21)" /><circle cx="21" cy="21" r="16" fill="none" stroke="var(--a-sec)" strokeWidth="6" strokeDasharray="22 100" strokeDashoffset="-46" transform="rotate(-90 21 21)" /></svg><span><b>46%</b><small>pago</small></span></div>
          </div>
          <div className="iph-card"><small>próximos passos</small>{['medição da marcenaria', 'gesso e forro', 'pintura'].map((t, i) => <div key={t} className="iph-ck"><i className={i === 0 ? 'ok' : ''} />{t}</div>)}</div>
        </div>
      </div>
      <div className="ape-iph lado r">
        <div className="tela">
          <div className="iph-top"><b>vistoria</b></div>
          {[['porta abre sem raspar', 'ok'], ['tomadas funcionando', 'ok'], ['caimento do box', 'pr'], ['rejunte completo', 'ok'], ['janela veda', '']].map(([a, b]) => (
            <div key={a} className={`iph-vist ${b}`}><span>{a}</span><em>{b === 'ok' ? 'ok' : b === 'pr' ? 'problema' : 'conferir'}</em></div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Uma linha só de cartões: rola para o lado (setas no computador) e "ver tudo" abre em grade. */
export function Fileira({ n, rotulo, children, cls = '', todos }: { n: number; rotulo: string; children: ReactNode; cls?: string; todos?: { href: string; l: string } }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tudo, setTudo] = useState(false)
  const [sobra, setSobra] = useState(false)
  const [pos, setPos] = useState<'ini' | 'meio' | 'fim'>('ini')
  const quadro = useRef(0)
  const medir = useCallback(() => {
    if (quadro.current) return
    // no máximo uma medida por quadro: rolar não re-desenha os cartões à toa
    quadro.current = requestAnimationFrame(() => {
      quadro.current = 0
      const el = ref.current
      if (!el) return
      const s = el.scrollWidth > el.clientWidth + 4
      const p = el.scrollLeft < 8 ? 'ini' : el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 ? 'fim' : 'meio'
      setSobra((v) => (v === s ? v : s))
      setPos((v) => (v === p ? v : p))
    })
  }, [])
  const rolar = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.9, behavior: 'smooth' })
  useEffect(() => {
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [medir, n, tudo])
  useEffect(() => {
    const el = ref.current
    if (!el || tudo) return
    // arrastar com o mouse (no dedo já é nativo)
    let x0 = 0, s0 = 0, arrastando = false, moveu = false
    const desce = (e: PointerEvent) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; arrastando = true; moveu = false; x0 = e.clientX; s0 = el.scrollLeft }
    const move = (e: PointerEvent) => { if (!arrastando) return; const d = e.clientX - x0; if (Math.abs(d) > 5) { moveu = true; el.classList.add('arrastando') } el.scrollLeft = s0 - d }
    const sobe = () => { arrastando = false; el.classList.remove('arrastando') }
    const clique = (e: MouseEvent) => { if (moveu) { e.preventDefault(); e.stopPropagation(); moveu = false } }
    el.addEventListener('pointerdown', desce)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', sobe)
    el.addEventListener('click', clique, true)
    return () => { el.removeEventListener('pointerdown', desce); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', sobe); el.removeEventListener('click', clique, true) }
  }, [tudo])
  return (
    <div className={`ape-fileira ${cls} ${tudo ? 'tudo' : ''} ${sobra && !tudo ? `sobra ${pos}` : ''}`}>
      <div className="ape-fileira-vp">
        {!tudo && sobra && pos !== 'ini' && <button type="button" className="ape-fileira-seta e" onClick={() => rolar(-1)} aria-label="Ver os anteriores"><ApeIcon name="chev" /></button>}
        <div ref={ref} className="ape-shop ape-fileira-l" onScroll={medir}>{children}</div>
        {!tudo && sobra && pos !== 'fim' && <button type="button" className="ape-fileira-seta d" onClick={() => rolar(1)} aria-label="Ver os próximos"><ApeIcon name="chev" /></button>}
      </div>
      {todos ? (
        <a className="ape-vermais" href={todos.href}>{todos.l}<ApeIcon name="chev" /></a>
      ) : (sobra || tudo) && (
        <button type="button" className="ape-vermais" aria-expanded={tudo} onClick={() => { setTudo(!tudo); if (tudo) ref.current?.closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
          {tudo ? 'mostrar em uma linha' : `ver todos os ${n} ${rotulo}`}<ApeIcon name="chev" />
        </button>
      )}
    </div>
  )
}

/* ===== cartões e preço ===== */
const somaAvulsos = (p: Produto, byId: ById) => (p.combo || []).reduce((t, id) => t + (reais(byId(id)?.preco) || 0), 0)

type Fase = { id: 'comprando' | 'comprei' | 'escolhas'; l: string; d: string; arte: string; chip: string }
/** O brinde surpresa (cadeado com "?"): inteiro na página dos arquivos, numa faixa fina na loja. */
function Surpresa() {
  return (
    <section className="ape-surpresa" aria-label="Bônus surpresa">
    <div className="ape-surpresa-box" aria-hidden="true">
      <ApeIcon name="lock" />
      <span className="q">?</span>
    </div>
    <div>
      <p className="ape-eyebrow">em toda compra</p>
      <h3 className="ape-sec-t">um <em>brinde surpresa</em> depois de 7 dias</h3>
      <p className="ape-note" style={{ margin: 0 }}>{BONUS.pista}</p>
      <ul className="ape-surpresa-l">
        <li><ApeIcon name="gift" />brinde em toda compra</li>
        <li><ApeIcon name="sparkle" />exclusivo, não tem à venda</li>
      </ul>
    </div>
  </section>
  )
}

/** Página só dos arquivos: tudo separado por etapa, como uma loja de verdade (com explicação e jeito de conversa). */
function Catalogo({ fases, arquivos, kits, ini, byId, onOpen, cart, onAdd, me, whats }: { fases: Fase[]; arquivos: Produto[]; kits: Produto[]; ini?: string; byId: ById; onOpen: (p: Produto) => void; cart: Carrinho; onAdd: (p: Produto) => void; me: Morador | null; whats: string }) {
  const cats = fases.map((f) => ({ f, lista: arquivos.filter((p) => (p.fase || 'comprei') === f.id) })).filter((c) => c.lista.length)
  // kit da etapa: o que só tem arquivos daquela etapa (aparece junto, no começo da etapa)
  const kitDe = (id: string) => kits.find((k) => (k.combo || []).length > 0 && (k.combo || []).every((c) => (arquivos.find((a) => a.id === c)?.fase || 'comprei') === id))
  const [ativa, setAtiva] = useState<string>(ini || 'todos')
  useEffect(() => {
    if (ini) window.setTimeout(() => document.getElementById(`cat-${ini}`)?.scrollIntoView({ block: 'start' }), 80)
    else window.scrollTo(0, 0)
  }, [ini])
  const ir = (id: string) => {
    setAtiva(id)
    if (id === 'todos') window.scrollTo({ top: 0, behavior: 'smooth' })
    else document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const maxKit = Math.max(0, ...kits.map((k) => k.kitPct || 0))
  return (
    <div className="ape-catalogo">
      <section className="ape-cat-hero">
        <a className="ape-cat-voltar" href={href('ape', 'loja')}><ApeIcon name="chev" />loja do apê</a>
        <h2>todos os <em>arquivos</em></h2>
        <p>Guias, checklists e planilhas que eu fiz montando o meu apê. Escolha a sua etapa, espie as páginas em "ver por dentro" e leve só o que fizer sentido para você.</p>
      </section>
      <Surpresa />
      <nav className="ape-cat-nav" aria-label="Etapas">
        <button aria-pressed={ativa === 'todos'} onClick={() => ir('todos')}>todos <small>{arquivos.length}</small></button>
        {cats.map(({ f, lista }) => <button key={f.id} aria-pressed={ativa === f.id} onClick={() => ir(f.id)}><ApeArt name={f.arte} size={18} />{f.chip} <small>{lista.length}</small></button>)}
        {kits.length > 0 && <button aria-pressed={ativa === 'kits'} onClick={() => ir('kits')}><ApeArt name="casa" size={18} tone="sec" />kits <small>{kits.length}</small></button>}
      </nav>
      {cats.map(({ f, lista }) => (
        <section key={f.id} id={`cat-${f.id}`} className="ape-cat-sec" aria-label={f.l}>
          <div className="ape-cat-sec-h">
            <ApeArt name={f.arte} size={40} />
            <span><h3>{f.l}</h3><p>{f.d}</p></span>
          </div>
          <div className="ape-cat-grid">
            {(() => { const k = kitDe(f.id); return k ? <ProdCard key={k.id} p={k} byId={byId} onOpen={() => onOpen(k)} cart={cart} onAdd={onAdd} me={me} whats={whats} /> : null })()}
            {lista.map((p) => <ProdCard key={p.id} p={p} byId={byId} onOpen={() => onOpen(p)} cart={cart} onAdd={onAdd} me={me} whats={whats} />)}
          </div>
        </section>
      ))}
      {kits.length > 0 && (
        <section id="cat-kits" className="ape-cat-sec" aria-label="Kits">
          <div className="ape-cat-sec-h">
            <ApeArt name="casa" size={40} tone="sec" />
            <span><h3>kits</h3><p>Os arquivos da mesma etapa juntos{maxKit ? `, até ${maxKit}% mais barato` : ''}. O preço sai sozinho: a soma dos arquivos com o desconto do kit.</p></span>
          </div>
          <div className="ape-cat-grid">
            {kits.map((p) => <ProdCard key={p.id} p={p} byId={byId} onOpen={() => onOpen(p)} cart={cart} onAdd={onAdd} me={me} whats={whats} />)}
          </div>
        </section>
      )}
      <Surpresa />
    </div>
  )
}

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
      eu quero
    </button>
  )
}

function ProdCard({ p, n, byId, onOpen, cart, onAdd, me, whats }: { p: Produto; n?: number; byId: ById; onOpen: () => void; cart: Carrinho; onAdd: (p: Produto) => void; me: Morador | null; whats: string }) {
  const img = p.amostras?.[0]
  return (
    <article className={`ape-prod ${p.destaque ? 'top' : ''} ${p.selo && SELO_OK.has(p.id) ? 'com-selo' : ''} ${p.cat === 'combos' ? 'kit' : `f-${p.fase || 'comprei'}`}`}>
      {p.selo && SELO_OK.has(p.id) && <span className="ape-selo"><ApeIcon name="star" />{p.selo}</span>}
      <button className="ape-thumb" onClick={onOpen} aria-label={`Ver ${p.nome} por dentro`}>
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <span className="ape-thumb-ic"><ApeArt name={p.arte || 'casa'} size={56} /></span>
        )}
        <span className="ape-ver"><ApeIcon name="eye" />ver por dentro</span>
      </button>
      <div className="ape-prod-h" onClick={onOpen}>
        {n ? <span className="ape-prod-n">{n}</span> : null}
        <h3>{p.nome}</h3>
      </div>
      <div className="ape-tags">
        {p.combo?.length && somaAvulsos(p, byId) > reais(p.preco) ? <span className="ape-pill terra">{Math.round((1 - reais(p.preco) / somaAvulsos(p, byId)) * 100)}% off · {p.combo.length} arquivos</span> : p.tag && <span className={`ape-pill ${p.destaque ? 'azul' : 'terra'}`}>{p.tag}</span>}
        {p.combo?.length ? <span className="ape-pill">{p.combo.length} arquivos</span> : (p.numeros || []).slice(0, 1).map((x) => <span key={x} className="ape-pill ape-keep">{x}</span>)}
      </div>
      <p className="ape-prod-desc so-detalhe">{p.desc}</p>
      {(p.itens || []).length > 0 && p.combo?.length ? <p className="ape-note ape-prod-extra"><ApeIcon name="gift" /> {p.itens!.map((x) => x.replace(/^\+\s*/, '')).join(' · ')}</p> : null}
      <Preco p={p} byId={byId} pixPct={PIX} />
      <div className="ape-acts ape-prod-acts">
        <button className="ape-btn ghost" onClick={onOpen}>detalhes</button>
        <BotaoCompra p={p} cart={cart} onAdd={onAdd} me={me} whats={whats} wide={false} />
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
          <div className="ape-tags">
            {p.selo && <span className="ape-pill rosa"><ApeIcon name="star" />{p.selo}</span>}
            {p.tag && <span className="ape-pill azul">{p.tag}</span>}
          </div>
          <h2 className="ape-h2">{p.nome}</h2>
          <p style={{ margin: 0, color: 'var(--a-muted)' }}>{p.desc}</p>
          {(p.numeros || []).length > 0 && (
            <div className="ape-dnums">
              {p.numeros!.map((x) => <span key={x}><ApeIcon name={iconeNumero(x)} />{x}</span>)}
            </div>
          )}
          {filhos.length > 0 && (
            <Recolhe titulo={`o que vem no kit (${filhos.length})`} abertoInicial={filhos.length <= 4}>
              <div className="ape-rows">
                {filhos.map((x, j) => (
                  <button key={x.id} className="ape-row ape-row-btn" onClick={() => onOpen(x)}>
                    <span className="t"><b>{j + 1}. {x.nome}</b></span>
                    <span className="r"><s className="ape-note ape-keep">{x.preco}</s></span>
                  </button>
                ))}
              </div>
            </Recolhe>
          )}
          {(p.itens || []).length > 0 && (
            <Recolhe titulo={filhos.length ? 'e ainda' : `o que tem dentro (${p.itens!.length})`} abertoInicial={filhos.length > 0}>
              <ul className="ape-inc">
                {p.itens!.map((x) => <li key={x}><ApeIcon name="check" />{x.replace(/^\+\s*/, '')}</li>)}
              </ul>
            </Recolhe>
          )}
          <div className="ape-dfacts">
            {p.formato && <span><ApeIcon name={p.cat === 'plataforma' ? 'phone' : 'file'} />{p.formato.split(' · ')[0]}</span>}
            {noCarrinho(p) && <span><ApeIcon name="download" />{p.cat === 'plataforma' ? 'acesso na hora' : 'baixa na hora'}</span>}
            {noCarrinho(p) && <span><ApeIcon name="user" />uso pessoal</span>}
            {noCarrinho(p) && <span><ApeIcon name="shield" />7 dias para desistir</span>}
            {noCarrinho(p) && <span><ApeIcon name="lock" />bônus surpresa</span>}
          </div>
          <div className="ape-dbuy">
            <Preco p={p} byId={byId} pixPct={pixPct} />
            <BotaoCompra p={p} cart={cart} onAdd={onAdd} me={me} whats={whats} />
          </div>
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

const iconeNumero = (x: string) => (/p[aá]gina/i.test(x) ? 'file' : /cor/i.test(x) ? 'brush' : /aba|planilha/i.test(x) ? 'list' : /mensag|pergunt/i.test(x) ? 'chat' : /c[oô]modo|m[oó]ve/i.test(x) ? 'home' : /m[eê]s|seman|dia/i.test(x) ? 'clock' : 'check')

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
  const opcoes = parcelas(t.subtotal, ajustes.jurosPct ?? JUROS_PCT)
  const [nParc, setNParc] = useState(1)
  const parc = forma === 'cartao' ? opcoes.find((o) => o.n === nParc) || opcoes[0] : null
  const totalFinal = parc ? parc.total : t.total
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
      const r = await criarPedido({ itens: t.itens.map((p) => p.id), morador: me?.id, nome: nome.trim(), cpf: digits(cpf), tel: digits(tel), email: email.trim().toLowerCase(), forma, parcelas: parc?.n || 1, aceite: true }, produtos, pixPct)
      cart.limpar()
      if (r.forma === 'cartao' && r.url) window.location.href = r.url
      else window.location.hash = `#/ape/pedido:${r.token}`
    } catch (x) {
      setErr(`Não deu para abrir o pagamento agora (${(x as Error).message}).`)
      setBusy(false)
      void avisarErroPagamento({ nome: nome.trim(), email: email.trim().toLowerCase(), tel: digits(tel), itens: t.itens.map((p) => ({ nome: p.nome, preco: p.preco })), total: totalFinal, forma, parcelas: parc?.n || 1, erro: (x as Error).message })
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
  const msgWhats = `Oi! Sou ${nome || 'uma pessoa interessada'}. Tentei comprar e deu erro:\n${t.itens.map((p) => `• ${p.nome} (${p.preco})`).join('\n')}\nTotal: ${brl(totalFinal)} no ${forma === 'cartao' ? (parc && parc.n > 1 ? `cartão em ${parc.n}x` : 'cartão') : 'Pix'}`
  return (
    <>
      <div className="ape-co-head">
        <div>
          <p className="ape-eyebrow"><ApeIcon name="shield" /> compra segura</p>
          <h2 className="ape-h2">finalizar <em>compra</em></h2>
        </div>
        <a className="ape-btn ghost so-pc-ape" href={href('ape', 'loja')}>voltar para a loja</a>
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
              <div className="ape-f"><label htmlFor="co-tel">Celular (<span className="ape-keep">WhatsApp</span>)</label><input id="co-tel" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(mascaraTel(e.target.value))} onBlur={() => setTocou({ ...tocou, tel: true })} autoComplete="tel" placeholder="(11) 90000-0000" />{campo('tel')}</div>
            </div>
            <span className="ape-hint">Usamos para emitir a cobrança, entregar os arquivos, identificar a sua licença e recuperar a compra em outro aparelho. Dados do cartão você digita só na página segura do Asaas.</span>
          </CoStep>
          <CoStep n={3} title="forma de pagamento">
            <div className="ape-co-pay">
              {([
                ['pix', 'Pix', `${pixPct}% de desconto · libera em segundos`, 'tag'],
                ['cartao', 'Cartão de crédito', opcoes.length > 1 ? `à vista ou em até ${opcoes[opcoes.length - 1].n}x, na página segura do Asaas` : 'à vista, na página segura do Asaas', 'shield'],
              ] as const).map(([id, l, h, i]) => (
                <button type="button" key={id} className={forma === id ? 'on' : ''} aria-pressed={forma === id} onClick={() => setForma(id)}>
                  <ApeIcon name={i} />
                  <b>{l}{id === 'pix' && <em className="ape-keep">−{pixPct}%</em>}</b>
                  <small>{h}</small>
                </button>
              ))}
            </div>
            {forma === 'cartao' && opcoes.length > 1 && (
              <div className="ape-f" style={{ marginTop: 10 }}>
                <label htmlFor="co-parc">Parcelas</label>
                <select id="co-parc" value={parc?.n || 1} onChange={(e) => setNParc(Number(e.target.value))}>
                  {opcoes.map((o) => <option key={o.n} value={o.n}>{o.n === 1 ? `1x de ${brl(o.parcela)} (sem juros)` : `${o.n}x de ${brl(o.parcela)} (total ${brl(o.total)}, com juros)`}</option>)}
                </select>
                <span className="ape-hint">À vista não tem juros. Parcelado tem juros de {String(ajustes.jurosPct ?? JUROS_PCT).replace('.', ',')}% ao mês.</span>
              </div>
            )}
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
              {busy ? 'abrindo o pagamento…' : forma === 'pix' ? <>pagar <span className="ape-keep">{brl(t.total)}</span> no Pix</> : parc && parc.n > 1 ? <>pagar <span className="ape-keep">{parc.n}x de {brl(parc.parcela)}</span> no cartão</> : <>pagar <span className="ape-keep">{brl(t.total)}</span> no cartão</>}
            </button>
            {err && !busy && err.startsWith('Não deu') && (
              <div className="ape-co-falhou" role="status">
                <b>a Laís já foi avisada do erro</b>
                <span>Você pode tentar de novo em instantes ou resolver agora por um destes caminhos:</span>
                <div className="ape-acts">
                  <a className="ape-btn primary" href={wa(whats, `${msgWhats}\n\nPosso pagar pelo Pix direto com você?`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="tag" />pagar pelo Pix direto</a>
                  <a className="ape-btn" href={wa(whats, msgWhats)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />avisar no WhatsApp</a>
                </div>
                <small>Pagando direto, os arquivos são liberados no seu e-mail assim que o Pix cair.</small>
              </div>
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
          {parc && parc.n > 1 && (
            <div className="ape-co-line">
              <span>juros do parcelamento ({parc.n}x)</span>
              <span className="num ape-keep">+{brl(parc.total - t.subtotal)}</span>
            </div>
          )}
          <div className="ape-co-line ape-co-total">
            <span>total{parc && parc.n > 1 ? ` · ${parc.n}x de ${brl(parc.parcela)}` : ''}</span>
            <b className="num ape-keep">{brl(totalFinal)}</b>
          </div>
          <ul className="ape-inc">
            <li><ApeIcon name="download" />baixa assim que o pagamento confirma</li>
            <li><ApeIcon name="lock" />bônus surpresa no 8º dia</li>
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
            <li><b>Preço e pagamento.</b> O preço aparece antes de pagar, com os descontos já aplicados: Pix com {pixPct}% de desconto ou cartão de crédito à vista (sem juros) ou parcelado em até 12x com juros informados antes de pagar. O pagamento é processado pelo Asaas; os dados do cartão não passam pela loja.</li>
            <li><b>Entrega e conta.</b> Depois da confirmação, a página do pedido mostra os arquivos para baixar e, se for o caso, o link da plataforma; você também recebe o link por e-mail. Com o e-mail da compra você cria uma senha em minha conta e acessa tudo de qualquer aparelho. Guarde a senha e não a compartilhe.</li>
            <li><b>Bônus.</b> Toda compra paga ganha, 7 dias depois, um bônus surpresa gratuito (um arquivo extra, revelado quando é liberado). Ele é um presente: não tem custo, não muda o preço e não reduz nem condiciona o direito de desistir.</li>
            <li><b>Direito de arrependimento e cancelamento.</b> Você pode desistir em até 7 dias depois da compra, sem precisar explicar o motivo (art. 49 do Código de Defesa do Consumidor). Peça em minha conta → minhas compras (ou pelo WhatsApp ou e-mail). Dentro dos 7 dias o pedido é sempre aprovado e devolvemos o valor integral, pelo mesmo meio de pagamento. Depois desse prazo, o pedido é analisado caso a caso. Com o reembolso, a licença é cancelada: os links deixam de funcionar e pedimos que você apague os arquivos baixados.</li>
            <li><b>Problemas.</b> Arquivo com defeito ou que não abre: corrigimos, trocamos ou devolvemos o valor, como prevê o Código de Defesa do Consumidor.</li>
            <li><b>Plataforma do apê.</b> O acesso dura 12 meses a partir da liberação (ou 1 mês no presente do kit completo), por um link pessoal que funciona como chave: guarde-o e não compartilhe. Os dados que você registra são seus; depois do prazo, a plataforma fica só para consulta.</li>
            <li><b>Seus dados (LGPD).</b> Usamos nome, CPF, e-mail e celular só para emitir a cobrança, entregar, identificar a licença, recuperar compras e atender você. Eles são compartilhados apenas com o Asaas (pagamento) e com o Supabase (onde o site guarda as informações). Você pode pedir acesso, correção ou exclusão pelo e-mail acima, respeitado o que a lei obriga a guardar.</li>
            <li><b>Cookies e armazenamento.</b> O site guarda no seu aparelho só o necessário para funcionar (carrinho, cadastro e compras). Não usamos cookies de propaganda nem de rastreamento.</li>
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
function MinhasCompras({ nome }: { nome?: string }) {
  const logado = !!sessaoLocal()
  const primeiro = (nome || '').trim().split(' ')[0] || nomeLocal()
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
  const ultimo = l[0]
  return (
    <section className="ape-minhas2" id="loja-compras">
      <div className="ape-minhas2-l">
        <span className="ic"><ApeIcon name={l.length ? 'bag' : 'user'} /></span>
        <span className="t">
          <b>{logado && primeiro ? `oie, ${primeiro}!` : l.length ? 'suas compras' : 'já comprou?'}</b>
          <small>{l.length ? `${l.length} ${l.length > 1 ? 'compras' : 'compra'} neste aparelho` : logado ? 'tudo o que você comprou fica na sua conta' : 'entre para baixar de novo os seus arquivos'}</small>
        </span>
        <span className="a">
          {ultimo && <a className="ape-btn sm" href={href('ape', `pedido:${ultimo.token}`)}><ApeIcon name="download" />última compra</a>}
          <a className="ape-btn primary sm" href={href('ape', 'conta')}>{logado ? 'minha conta' : 'entrar'}</a>
          {!logado && <button className="ape-btn ghost sm" onClick={() => setAbrir(!abrir)}>{abrir ? 'fechar' : 'buscar pelo CPF'}</button>}
        </span>
      </div>
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
/** Depois de pagar: cria o acesso (senha) e já entra na área com os arquivos. */
function CriarAcesso({ p, token, onPronto }: { p: Pedido; token: string; onPronto: () => void }) {
  const [modo, setModo] = useState<'criar' | 'entrar'>('criar')
  const [senha, setSenha] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (senha.length < 8) return setErr('A senha precisa de pelo menos 8 caracteres.')
    setBusy(true)
    try {
      const r = await contaApi<{ token: string }>(modo, { email: p.email, senha, pedido: token })
      guardarSessao(r.token)
      onPronto()
    } catch (x) {
      const m = (x as Error).message
      if (/já tem senha/i.test(m)) { setModo('entrar'); setErr('Esse e-mail já tem conta: digite a sua senha para entrar.') } else setErr(m)
    }
    setBusy(false)
  }
  return (
    <section className="ape-panel ape-form ape-pedido ape-acesso">
      <div className="ape-done" style={{ padding: 0 }}>
        <ApeIcon name="check" />
        <h2 className="ape-h2">{p.cortesia ? 'acesso' : 'pagamento'} <em>confirmado</em></h2>
        <p className="ape-note" style={{ margin: 0 }}>Obrigada{p.nome ? `, ${firstName(p.nome)}` : ''}! Agora {modo === 'criar' ? 'crie a sua senha' : 'entre com a sua senha'} para abrir a sua área com os arquivos{p.plataforma ? ', a plataforma' : ''} e o bônus.</p>
      </div>
      <form className="ape-acesso-f" onSubmit={enviar} noValidate>
        <div className="ape-f"><label>E-mail da compra</label><input value={p.email || ''} readOnly /></div>
        <div className="ape-f"><label htmlFor="ac-senha">{modo === 'criar' ? 'Crie uma senha (8 ou mais caracteres)' : 'Sua senha'}</label><input id="ac-senha" type="password" autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus /></div>
        {err && <p className="ape-err" role="alert">{err}</p>}
        <button className="ape-btn primary" type="submit" disabled={busy}>{busy ? 'abrindo…' : modo === 'criar' ? 'criar acesso e ver meus arquivos' : 'entrar e ver meus arquivos'}</button>
        <button type="button" className="ape-linkish ape-link" onClick={() => { setModo(modo === 'criar' ? 'entrar' : 'criar'); setErr('') }}>{modo === 'criar' ? 'já tenho senha: entrar' : 'ainda não tenho senha: criar'}</button>
      </form>
      <ul className="ape-acesso-l">
        <li><ApeIcon name="download" />seus arquivos, com o seu nome no rodapé</li>
        {p.plataforma && <li><ApeIcon name="phone" />a plataforma do apê, por 12 meses</li>}
        <li><ApeIcon name="lock" />o bônus surpresa, que abre no 8º dia</li>
        <li><ApeIcon name="user" />tudo em um lugar, de qualquer aparelho</li>
      </ul>
    </section>
  )
}

export function PedidoPage({ token, whats, produtos }: { token: string; whats: string; produtos?: Produto[] }) {
  if (produtos) PRODUTOS_LOJA = produtos
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
  // como na Hotmart e na Kiwify: primeiro a pessoa cria o acesso (e-mail e senha), depois vê os arquivos
  if (apeCloud && !sessaoLocal()) return <CriarAcesso p={p} token={token} onPronto={() => setN(n + 1)} />
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
          <details className="ape-comousar-arq">
            <summary><ApeIcon name="sparkle" /><b>como usar os seus arquivos</b><ApeIcon name="chev" /></summary>
            <ol>
              <li><b>PDFs</b><span>Toque em baixar. Dá para imprimir ou usar no celular e no tablet (marque com o dedo ou a caneta num app de PDF).</span></li>
              <li><b>Planilhas</b><span>Escolha a cor e baixe. Abre no Excel, no Numbers ou no Google Planilhas (Arquivo, Importar). Digite só nas células azuis: o resto se calcula sozinho.</span></li>
              <li><b>Plataforma</b><span>Toque em "abrir a minha plataforma do apê". No celular, use "adicionar à tela de início" para abrir como um app.</span></li>
              <li><b>Sempre à mão</b><span>Crie a sua senha em "minha conta" com o e-mail da compra e baixe de novo quando quiser, de qualquer aparelho.</span></li>
            </ol>
          </details>
          <p className="ape-eyebrow">seus arquivos</p>
          <div className="ape-entregas">
            {[...new Set(p.arquivos.map((a) => a.produto))].map((produto, i) => {
              const fs = p.arquivos!.filter((a) => a.produto === produto)
              const img = amostraDe(produto)
              const cores = fs.filter((a) => a.cor)
              return (
                <article key={produto} className={`ape-entrega ${/^b[oô]nus/i.test(produto) ? 'bonus' : ''}`}>
                  {img ? <img src={img} alt="" loading="lazy" /> : <span className="ape-entrega-ic"><ApeIcon name="file" /></span>}
                  <div className="ape-entrega-b">
                    <b>{i + 1}. {produto}</b>
                    <span className="ape-note">{fs[0].tipo === 'planilha' ? `planilha Excel · ${cores.length > 1 ? `${cores.length} cores: escolha a sua` : 'abre no Google Planilhas'}` : 'PDF com a sua licença no rodapé'}</span>
                    {cores.length > 1 ? (
                      <div className="ape-cores">
                        {cores.map((a) => (
                          <button key={a.path} className="ape-cor" onClick={() => void baixar(a.path)} disabled={!!baixando} title={`Baixar na cor ${a.cor}`}>
                            <i style={{ background: COR[a.cor!] }} />{baixando === a.path ? 'baixando…' : a.cor}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button className="ape-btn primary sm" onClick={() => void baixar(fs[0].path)} disabled={!!baixando}><ApeIcon name="download" />{baixando === fs[0].path ? 'preparando…' : 'baixar'}</button>
                    )}
                  </div>
                </article>
              )
            })}
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
      {p.bonus && (p.bonus.liberado ? (
        <div className="ape-bonus2 on">
          <span className="ic"><ApeIcon name="unlock" /></span>
          <span className="t"><small>bônus liberado</small><b>{BONUS.nome}</b><span>Ele está na lista de arquivos acima. Aproveite!</span></span>
        </div>
      ) : (
        <div className="ape-bonus2">
          <span className="ic"><ApeIcon name="lock" /><i>?</i></span>
          <span className="t"><small>bônus surpresa · trancado</small><b>abre em {p.bonus.em ? Math.max(1, Math.ceil((new Date(p.bonus.em).getTime() - Date.now()) / 864e5)) : 7} dia(s)</b><span>Um arquivo que não está à venda, pensado para quem acabou de pegar as chaves. Volte aqui {p.bonus.em ? `em ${dmy(p.bonus.em)}` : 'no 8º dia'} para abrir.</span></span>
        </div>
      ))}
      <p className="ape-note" style={{ margin: 0 }}>Tudo também fica em <a className="ape-link" href={href('ape', 'conta')}>minha conta</a>, de qualquer aparelho. Precisa de ajuda? <a className="ape-link" href={wa(whats, `Oi! Sobre o pedido ${token.slice(0, 8)}:`)} target="_blank" rel="noopener noreferrer">fale no WhatsApp</a>.</p>
    </section>
  )
}
