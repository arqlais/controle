import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { SanLeviArte } from './SanLevi'
import { href } from '../router'
import { platAbrir, platSalvar, type PlatAcesso, type PlatContato, type PlatDados, type PlatDoc, type PlatEtapa, type PlatGarantia, type PlatGasto, type PlatManut, type PlatParcela, type PlatVistoria, type PlatOrc, type PlatConta, type PlatMedida, type PlatCompra, type PlatTarefa } from './api'
import { ApeArt } from './ApeArt'
import { ApeIcon } from './ApeIcon'
import { APE, brl, dmy, firstName, fmtTel, num, wa, waNum } from './model'
import { Assinatura, MARK_SVG, read, write } from './shared'

/* Plataforma do apê: área de quem comprou. Abre por um link secreto (sem senha), guarda tudo na nuvem
   e funciona no celular e no computador. Tem uma demonstração com dados de exemplo (não salva nada). */

const uid = () => Math.random().toString(36).slice(2, 10)
const hoje = () => new Date().toISOString().slice(0, 10)
const COMODOS = ['sala', 'cozinha', 'área de serviço', 'banheiro', 'quarto 1', 'quarto 2', 'varanda', 'geral']
const ETAPAS_COMPRA = ['simulação e escolha do imóvel', 'aprovação do crédito', 'assinatura do contrato', 'ITBI e registro em cartório']
const ETAPAS_OBRA = ['vistoria de entrega', 'recebimento das chaves', 'projeto e medições', 'orçamentos fechados', 'elétrica e hidráulica', 'gesso e forro', 'pisos e revestimentos', 'pintura', 'marcenaria e pedras', 'limpeza fina', 'mudança']
const VISTORIA: [string, string[]][] = [
  ['entrada', ['porta abre e fecha sem raspar', 'fechadura e chaves funcionando', 'campainha / interfone']],
  ['sala', ['piso/contrapiso sem trincas e nivelado', 'paredes sem fissuras ou manchas', 'tomadas e interruptores funcionando', 'janela abre, fecha e veda']],
  ['cozinha', ['revestimento sem peças ocas ou trincadas', 'pontos de água sem vazamento', 'ralo escoando', 'tomadas e ponto do fogão']],
  ['área de serviço', ['tanque firme e sem vazamento', 'ponto da máquina (água e esgoto)', 'caimento do piso para o ralo']],
  ['banheiro', ['descarga e vaso sem vazamento', 'chuveiro (água e ponto elétrico)', 'caimento do piso do box', 'rejunte completo']],
  ['quartos', ['piso/contrapiso', 'paredes e teto', 'tomadas e interruptores', 'janelas e portas']],
  ['geral', ['quadro de luz com disjuntores identificados', 'medidores de água e luz', 'esquadrias sem riscos', 'teto sem manchas de infiltração']],
]
export const DEMO: PlatDados = {
  perfil: { nome: 'Ana (exemplo)', foto: '' },
  imovel: { tipo: 'apê', fase: 'obra', m2: 40, orcamento: 45000, entrega: '2026-12-15', nome: 'meu apê', condominio: 'Vila Jardins', torre: '1', ap: '304', moradores: 'Ana e Pedro' },
  gastos: [
    { id: 'g1', comodo: 'sala', item: 'piso vinílico', previsto: 4200, pago: 3780, status: 'pago', data: '2026-11-02', obs: 'Pix com 10%' },
    { id: 'g2', comodo: 'cozinha', item: 'marcenaria da cozinha', previsto: 14000, pago: null, status: 'comprado', data: '2026-11-20', obs: '10x sem juros' },
    { id: 'g3', comodo: 'banheiro', item: 'box', previsto: 1300, pago: null, status: 'planejado', data: '', obs: '' },
    { id: 'g4', comodo: 'geral', item: 'pintura', previsto: 3500, pago: null, status: 'planejado', data: '', obs: '' },
  ],
  parcelas: [
    { id: 'p1', descricao: 'marcenaria', valor: 1400, vezes: 10, inicio: '2026-12-10', dia: 10 },
    { id: 'p2', descricao: 'financiamento (estimado)', valor: 1250, vezes: 360, inicio: '2027-01-05', dia: 5 },
  ],
  etapas: [...ETAPAS_OBRA].map((nome, i) => ({ id: `e${i}`, nome, feita: i < 2, data: i < 2 ? '2026-11-0' + (i + 1) : '', quem: '', obs: '' })),
  vistoria: VISTORIA.flatMap(([c, l]) => l.map((item, k) => ({ id: `${c}${k}`, comodo: c, item, status: (c === 'banheiro' && k === 2 ? 'problema' : k === 0 ? 'ok' : 'pendente') as PlatVistoria['status'], obs: c === 'banheiro' && k === 2 ? 'água empoça no canto do box' : '' }))),
  contatos: [{ id: 'c1', nome: 'Marcenaria (exemplo)', servico: 'marcenaria', tel: '11900000000', obs: 'medição dia 20' }],
  garantias: [{ id: 'w1', item: 'geladeira', onde: 'loja (exemplo)', compra: '2026-11-10', meses: 12, nota: true, obs: '' }, { id: 'w2', item: 'impermeabilização', onde: 'construtora', compra: '2026-12-15', meses: 60, nota: true, obs: '' }],
  manutencao: [{ id: 'm1', oque: 'lavar os filtros do ar-condicionado', cada: 1, ultima: '2026-10-01' }, { id: 'm2', oque: 'limpar ralos e sifões', cada: 3, ultima: '' }],
  documentos: [{ id: 'd1', nome: 'contrato de compra e venda', tenho: true, onde: 'pasta azul' }, { id: 'd2', nome: 'manual do proprietário', tenho: true, onde: 'link do Drive' }, { id: 'd3', nome: 'termo de vistoria e de entrega das chaves', tenho: false, onde: '' }],
  orcamentos: [{ id: 'o1', servico: 'pedras', fornecedor: 'Marmoraria A', valor: 4540, status: 'recebido', tel: '', obs: 'quartzo, com instalação' }, { id: 'o2', servico: 'pedras', fornecedor: 'Marmoraria B', valor: 3770, status: 'recebido', tel: '', obs: 'granito' }],
  contas: [{ id: 'k1', nome: 'condomínio', valor: 420, quando: 'mensal', dia: 10 }, { id: 'k2', nome: 'luz', valor: 120, quando: 'mensal', dia: 15 }, { id: 'k3', nome: 'internet', valor: 100, quando: 'mensal', dia: 5 }, { id: 'k4', nome: 'IPTU', valor: 900, quando: 'anual', dia: null }],
  medidas: [{ id: 'md1', comodo: 'sala', larg: 3.15, comp: 4.6, alt: 2.5, obs: '' }, { id: 'md2', comodo: 'quarto 1', larg: 2.64, comp: 3.1, alt: 2.5, obs: '' }],
  compras: [{ id: 'cp1', comodo: 'cozinha', item: 'jogo de panelas', prio: 'essencial', preco: 350, comprado: true, onde: '' }, { id: 'cp2', comodo: 'quarto', item: 'cortina blackout', prio: 'logo', preco: 250, comprado: false, onde: '' }],
  mudanca: [{ id: 'mu1', fase: '30 dias antes', item: 'orçar 3 empresas de mudança', feito: true }, { id: 'mu2', fase: '30 dias antes', item: 'agendar o elevador com o condomínio', feito: false }],
  notas: 'Senha do interfone: 304. Medir a parede da TV antes do painel.',
}
const novo = (): PlatDados => ({
  imovel: { tipo: 'apê', fase: 'obra', m2: null, orcamento: null, entrega: '', nome: 'meu apê' },
  gastos: [],
  parcelas: [],
  etapas: [...ETAPAS_COMPRA, ...ETAPAS_OBRA].map((nome) => ({ id: uid(), nome, feita: false, data: '', quem: '', obs: '' })),
  vistoria: VISTORIA.flatMap(([c, l]) => l.map((item) => ({ id: uid(), comodo: c, item, status: 'pendente' as const, obs: '' }))),
  contatos: [],
  documentos: DOCS.map((nome) => ({ id: uid(), nome, tenho: false, onde: '' })),
  notas: '',
})

/** Parcelas dos próximos 12 meses, somadas por mês. */
export function meses(parcelas: PlatParcela[], n = 12, base = new Date()) {
  const out: { mes: string; total: number; itens: string[] }[] = []
  for (let k = 0; k < n; k++) {
    const d = new Date(base.getFullYear(), base.getMonth() + k, 1)
    const chave = d.toISOString().slice(0, 7)
    let total = 0
    const itens: string[] = []
    for (const p of parcelas) {
      if (!p.valor || !p.inicio) continue
      const ini = new Date(p.inicio + 'T00:00:00')
      const idx = (d.getFullYear() - ini.getFullYear()) * 12 + d.getMonth() - ini.getMonth()
      if (idx >= 0 && idx < (p.vezes || 1)) {
        total += p.valor
        itens.push(p.descricao)
      }
    }
    out.push({ mes: chave, total: Math.round(total * 100) / 100, itens })
  }
  return out
}

/** Comprime a foto da vistoria (cabe na nuvem e abre rápido). */
async function fotoLeve(f: File): Promise<string> {
  const bmp = await createImageBitmap(f)
  const k = Math.min(1, 900 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.7)
}

type Aba = 'resumo' | 'gastos' | 'parcelas' | 'orcamentos' | 'contas' | 'etapas' | 'vistoria' | 'contatos' | 'medidas' | 'compras' | 'mudanca' | 'garantias' | 'documentos' | 'calculadoras'
/** Menu em grupos, como no planê arquitetura, com símbolos que dizem o que é cada coisa. */
const GRUPOS: [string, [Aba, string, string][]][] = [
  ['', [['resumo', 'resumo', 'home']]],
  ['dinheiro', [['gastos', 'gastos', 'wallet'], ['parcelas', 'parcelas', 'calendar'], ['orcamentos', 'orçamentos', 'file'], ['contas', 'contas da casa', 'bell']]],
  ['obra', [['etapas', 'etapas da obra', 'layers'], ['vistoria', 'vistoria', 'check'], ['contatos', 'fornecedores', 'phone'], ['medidas', 'medidas do apê', 'ruler']]],
  ['casa nova', [['compras', 'compras da casa', 'sofa'], ['mudanca', 'mudança', 'box'], ['garantias', 'garantias e manutenção', 'lock'], ['documentos', 'documentos', 'folder']]],
  ['ferramentas', [['calculadoras', 'calculadoras', 'grid']]],
]
const ABAS = GRUPOS.flatMap((g) => g[1])
const BNAV: Aba[] = ['resumo', 'gastos', 'etapas', 'vistoria']

export function Plataforma({ token, whats }: { token: string; whats: string }) {
  const demo = token === 'demo'
  const [acc, setAcc] = useState<PlatAcesso | null | undefined>(undefined)
  const [dados, setDados] = useState<PlatDados>({})
  const [aba, setAba] = useState<Aba>('resumo')
  const [salvo, setSalvo] = useState<'ok' | 'salvando' | 'erro'>('ok')
  const [editar, setEditar] = useState(false)
  const [menu, setMenu] = useState(false)
  const [tema, setTema] = useState<'claro' | 'escuro'>(() => read<'claro' | 'escuro'>('ape-tema') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'))
  const trocarTema = () => setTema((t) => { const n = t === 'escuro' ? 'claro' : 'escuro'; write('ape-tema', n); return n })
  const timer = useRef(0)
  const pendente = useRef<PlatDados | null>(null)
  const historico = useRef<Aba[]>([])
  const [exemplo, setExemplo] = useState(false)
  // fechou a aba ou trocou de app antes de salvar: salva na hora
  useEffect(() => {
    if (demo) return
    const flush = () => {
      if (!pendente.current) return
      window.clearTimeout(timer.current)
      const d = pendente.current
      pendente.current = null
      void platSalvar(token, d).then(() => setSalvo('ok'), () => setSalvo('erro'))
    }
    const vis = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', vis)
      flush()
    }
  }, [token, demo])
  useEffect(() => {
    document.title = 'plataforma do apê · planê.apê'
    if (demo) {
      setAcc({ nome: 'Exemplo', validade: '2027-11-07', ativo: true, cortesia: false, dados: DEMO, atualizado: '' })
      setDados(read<PlatDados>('ape-plat-demo') || DEMO)
      return
    }
    void platAbrir(token).then((a) => {
      setAcc(a)
      if (a) {
        setDados(Object.keys(a.dados || {}).length ? a.dados : novo())
        write('ape-plat', token) // "minha plataforma" neste aparelho (atalho em todas as páginas)
      }
    })
  }, [token])
  const mudar = (fn: (d: PlatDados) => PlatDados) => {
    if (exemplo) return
    if (acc && !acc.ativo) return
    setDados((d) => {
      const next = fn(d)
      window.clearTimeout(timer.current)
      if (demo) write('ape-plat-demo', next)
      else {
        setSalvo('salvando')
        pendente.current = next
        timer.current = window.setTimeout(() => {
          pendente.current = null
          platSalvar(token, next).then(() => setSalvo('ok'), () => setSalvo('erro'))
        }, 1200)
      }
      return next
    })
  }
  if (acc === undefined) return <main className="wrap ape-main"><div className="ape-panel ape-empty"><span className="ape-thinking"><span className="ape-dots"><i /><i /><i /></span>abrindo a sua plataforma…</span></div></main>
  if (acc === null)
    return (
      <main className="wrap ape-main">
        <div className="ape-panel ape-empty">
          <b>link de acesso não encontrado</b>
          <span>Confira se copiou o link inteiro. Você também acha o acesso em "minha conta", com o e-mail da compra.</span>
          <div className="ape-acts" style={{ justifyContent: 'center' }}>
            <a className="ape-btn primary" href={href('ape', 'conta')}>minha conta</a>
            <a className="ape-btn" href={wa(whats, 'Oi! Não estou conseguindo abrir a minha plataforma do apê.')} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />WhatsApp</a>
          </div>
        </div>
      </main>
    )
  const vistos = exemplo ? DEMO : dados
  const im = vistos.imovel || novo().imovel!
  const nome = vistos.perfil?.nome || acc.nome
  const foto = vistos.perfil?.foto || ''
  const ir = (a: Aba, voltando = false) => {
    if (!voltando && a !== aba) historico.current.push(aba)
    setAba(a)
    setMenu(false)
    window.scrollTo(0, 0)
  }
  const voltar = () => {
    const ant = historico.current.pop()
    if (ant) ir(ant, true)
    else if (aba !== 'resumo') ir('resumo', true)
    else if (window.history.length > 1) window.history.back()
    else window.location.hash = '#/ape/conta'
  }
  const statusSalvo = demo ? 'demonstração: nada é salvo' : salvo === 'salvando' ? 'salvando…' : salvo === 'erro' ? 'não salvou: confira a internet' : 'tudo salvo'
  const atual = ABAS.find((x) => x[0] === aba)!
  const casa = [im.condominio, im.torre ? `torre ${im.torre}` : '', im.ap ? `apê ${im.ap}` : ''].filter(Boolean).join(' · ') || im.nome || 'meu apê'
  const dadosV = vistos
  const sub = <M,>(k: keyof PlatDados) => (fn: (l: M[]) => M[]) => mudar((d) => ({ ...d, [k]: fn(((d[k] as unknown) as M[]) || []) }))
  const navA = (id: Aba, l: string, i: string) => (
    <a key={id} href="#" className={aba === id ? 'active' : ''} onClick={(e) => { e.preventDefault(); ir(id) }} title={l}>
      <Icon name={i} />
      <span>{l}</span>
    </a>
  )
  const ehSL = /san levi/i.test(im.condominio || '')
  return (
    <div className={`ape ape-shell app ape-cli ${menu ? 'menu-open' : ''}`} data-tema={tema}>
      <aside className="sidebar">
        <a className="platform-mark" href={href('ape', 'loja')} aria-label="planê.apê">
          <span className="ape-cli-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
          <span>planê<b className="ape-cli-mark-b">.apê</b></span>
        </a>
        <a className="brand ape-adm-brand" href="#" onClick={(e) => { e.preventDefault(); setEditar(true) }} title="Minha casa: foto e dados do imóvel">
          <span className="brand-photo ape-adm-foto">
            {im.capa ? <img src={im.capa} alt="" /> : ehSL ? <SanLeviArte size={46} /> : <span className="ape-cli-casa"><Icon name="home" size={22} /></span>}
          </span>
          <span className="brand-text">
            <span className="brand-kicker">minha casa</span>
            <span className="brand-name ape-cli-casa-nome">{casa}</span>
          </span>
        </a>
        <nav>
          {GRUPOS.map(([g, itens]) => (
            <Fragment key={g || 'inicio'}>
              {g && <span className="nav-group-label nav-main-label">{g}</span>}
              {itens.map(([id, l, i]) => navA(id, l, i))}
            </Fragment>
          ))}
        </nav>
        <a href="#" className="profile-chip" onClick={(e) => { e.preventDefault(); setEditar(true) }} title="Meus dados">
          <span className="profile-chip-avatar">{foto ? <img src={foto} alt="" /> : (firstName(nome).charAt(0).toUpperCase() || '?')}</span>
          <span className="grow"><b>{firstName(nome) || 'meu perfil'}</b><small>meus dados e foto</small></span>
        </a>
        <div className="sidebar-foot">
          <button className="icon-btn" onClick={trocarTema} title="Tema claro/escuro (só neste aparelho)" aria-label="Tema claro ou escuro"><Icon name={tema === 'escuro' ? 'sun' : 'moon'} /></button>
          <button className={`icon-btn sample-toggle ${exemplo ? 'is-on' : ''}`} onClick={() => setExemplo(!exemplo)} title={exemplo ? 'Sair do exemplo' : 'Ver exemplo preenchido'} aria-label={exemplo ? 'Sair do exemplo' : 'Ver exemplo preenchido'}><Icon name={exemplo ? 'eye' : 'eye-off'} size={16} /><span>exemplo</span></button>
          <a className="icon-btn" href={href('ape', 'conta')} title="Minha conta e compras" aria-label="Minha conta"><Icon name="user" /></a>
          <span className={`ape-salvo ${salvo}`} title={statusSalvo}><i /></span>
        </div>
      </aside>
      <div className="scrim" onClick={() => setMenu(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setMenu(true)} aria-label="Menu"><Icon name="menu" /></button>
          <button className="back-btn" onClick={voltar} aria-label="Voltar" title="Voltar para a tela anterior"><Icon name="chevronL" size={18} /><span className="hide-mobile">voltar</span></button>
          <div className="ape-adm-titulo"><Icon name={atual[2]} /><b>{atual[1]}</b></div>
          <button className="icon-btn only-mobile" onClick={trocarTema} aria-label="Tema claro ou escuro"><Icon name={tema === 'escuro' ? 'sun' : 'moon'} /></button>
          <span className={`ape-salvo-top ${salvo} hide-mobile`}>{statusSalvo}</span>
        </header>
        <main className="content">
          <div className="page ape-pp-cont">
          {demo && <div className="ape-banner"><ApeIcon name="eye" />Demonstração com dados de exemplo: fica só neste aparelho.</div>}
          {exemplo && <div className="ape-banner ape-pp-exemplo"><ApeIcon name="eye" /><span>Você está vendo um <b>exemplo preenchido</b>. Pode olhar tudo: nada aqui é salvo e os seus dados continuam guardados.</span><button className="ape-btn primary sm" onClick={() => setExemplo(false)}>voltar para os meus dados</button></div>}
          {aba === 'resumo' && !exemplo && <ComoUsar onExemplo={() => setExemplo(true)} />}
          {!acc.ativo && <div className="ape-banner warn">O seu acesso venceu em {dmy(acc.validade)}. Os dados continuam aqui para consulta. <a className="ape-link" href={href('ape', 'loja:plataforma')}>renovar</a></div>}
          {aba === 'resumo' && <Resumo acc={acc} dados={dadosV} im={im} nome={nome} foto={foto} casa={casa} token={token} demo={demo} mudar={mudar} irPara={ir} onEditar={() => setEditar(true)} />}
          {aba === 'gastos' && <Gastos lista={dadosV.gastos || []} orcamento={im.orcamento} mudar={sub<PlatGasto>('gastos')} />}
          {aba === 'parcelas' && <Parcelas lista={dadosV.parcelas || []} mudar={sub<PlatParcela>('parcelas')} />}
          {aba === 'orcamentos' && <Orcs lista={dadosV.orcamentos || []} mudar={sub<PlatOrc>('orcamentos')} virarGasto={(o) => mudar((d) => ({ ...d, gastos: [{ id: uid(), comodo: 'geral', item: `${o.servico} (${o.fornecedor})`, previsto: o.valor, pago: null, status: 'comprado', data: hoje(), obs: 'fechado pelos orçamentos' }, ...(d.gastos || [])] }))} />}
          {aba === 'contas' && <Contas lista={dadosV.contas || []} mudar={sub<PlatConta>('contas')} />}
          {aba === 'etapas' && <Etapas lista={dadosV.etapas || []} mudar={sub<PlatEtapa>('etapas')} />}
          {aba === 'vistoria' && <Vistoria lista={dadosV.vistoria || []} nome={nome} mudar={sub<PlatVistoria>('vistoria')} />}
          {aba === 'contatos' && <Contatos lista={dadosV.contatos || []} mudar={sub<PlatContato>('contatos')} />}
          {aba === 'medidas' && <Medidas lista={dadosV.medidas || []} mudar={sub<PlatMedida>('medidas')} />}
          {aba === 'compras' && <Compras lista={dadosV.compras || []} mudar={sub<PlatCompra>('compras')} />}
          {aba === 'mudanca' && <Mudanca lista={dadosV.mudanca || []} entrega={im.entrega} mudar={sub<PlatTarefa>('mudanca')} />}
          {aba === 'garantias' && <Garantias lista={dadosV.garantias || []} manut={dadosV.manutencao || []} entrega={im.entrega} mudar={sub<PlatGarantia>('garantias')} mudarM={sub<PlatManut>('manutencao')} />}
          {aba === 'documentos' && <Documentos lista={dadosV.documentos || []} mudar={sub<PlatDoc>('documentos')} />}
          {aba === 'calculadoras' && <Calculadoras m2={im.m2} />}
          <Assinatura />
          </div>
        </main>
      </div>
      <nav className="bottom-nav">
        {BNAV.map((id) => { const x = ABAS.find((y) => y[0] === id)!; return <a key={id} href="#" className={aba === id ? 'active' : ''} onClick={(e) => { e.preventDefault(); ir(id) }}><Icon name={x[2]} /><span>{id === 'etapas' ? 'etapas' : x[1]}</span></a> })}
        <a href="#" onClick={(e) => { e.preventDefault(); setMenu(true) }}><Icon name="menu" /><span>mais</span></a>
      </nav>
      {editar && <EditarDados dados={dados} nomeConta={acc.nome} onClose={() => setEditar(false)} mudar={mudar} />}
    </div>
  )
}

/** Passo a passo de como usar (aparece até a pessoa tocar em "entendi"; volta pelo "como usar"). */
function ComoUsar({ onExemplo }: { onExemplo: () => void }) {
  const [aberto, setAberto] = useState(() => !read<boolean>('ape-pp-tour'))
  if (!aberto) return <button className="ape-pp-comousar-btn" onClick={() => setAberto(true)}><ApeIcon name="sparkle" />como usar a plataforma</button>
  const passos: [string, string, string][] = [
    ['edit', 'coloque os seus dados', 'Toque em "editar": foto, condomínio, torre, apê e quem vai morar.'],
    ['tag', 'lance gastos e parcelas', 'Cada compra entra em "compras e gastos"; o que é parcelado, em "parcelas". Os gráficos se montam sozinhos.'],
    ['check', 'siga as etapas e faça a vistoria', 'Marque cada etapa feita. Na vistoria, toque em ok ou problema e tire foto.'],
    ['shield', 'guarde garantias e documentos', 'O resumo avisa quando uma garantia vai vencer e o que revisar na casa.'],
  ]
  return (
    <section className="ape-panel ape-pp-comousar">
      <div className="ape-pp-card-h"><p className="ape-eyebrow">como usar, em 4 passos</p><button className="ape-linkish ape-link" onClick={() => { write('ape-pp-tour', true); setAberto(false) }}>entendi</button></div>
      <ol>{passos.map(([i, t, d], k) => <li key={t}><span className="n">{k + 1}</span><ApeIcon name={i} /><span><b>{t}</b><small>{d}</small></span></li>)}</ol>
      <div className="ape-acts"><button className="ape-btn primary sm" onClick={onExemplo}><ApeIcon name="eye" />ver tudo preenchido (exemplo)</button><button className="ape-btn ghost sm" onClick={() => { write('ape-pp-tour', true); setAberto(false) }}>começar</button></div>
    </section>
  )
}

function Avatar({ nome, foto }: { nome: string; foto: string }) {
  return foto ? <img className="ape-pa-av" src={foto} alt="" /> : <span className="ape-pa-av">{firstName(nome).charAt(0).toUpperCase() || '?'}</span>
}

/** Foto de perfil pequena (cabe na nuvem). */
async function fotoPerfil(f: File) {
  const bmp = await createImageBitmap(f)
  const k = Math.min(1, 320 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

/** Meus dados: nome, foto e o imóvel, numa janela só. */
function EditarDados({ dados, nomeConta, onClose, mudar }: { dados: PlatDados; nomeConta: string; onClose: () => void; mudar: (fn: (d: PlatDados) => PlatDados) => void }) {
  const [p, setP] = useState(dados.perfil || { nome: nomeConta, foto: '' })
  const [im, setIm] = useState(dados.imovel || novo().imovel!)
  const salvar = () => {
    mudar((d) => ({ ...d, perfil: p, imovel: im }))
    onClose()
  }
  const set = (k: keyof NonNullable<PlatDados['imovel']>, v: unknown) => setIm({ ...im, [k]: v })
  return (
    <div className="ape-sheet" role="dialog" aria-modal="true" aria-label="Meus dados" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ape-sheet-in">
        <button className="ape-x" onClick={onClose} aria-label="Fechar"><ApeIcon name="x" /></button>
        <div className="ape-sheet-b">
          <h2 className="ape-h2">meus <em>dados</em></h2>
          <div className="ape-conta-foto">
            <Avatar nome={p.nome} foto={p.foto} />
            <label className="ape-btn sm"><ApeIcon name="clip" />{p.foto ? 'trocar foto' : 'colocar foto'}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setP({ ...p, foto: await fotoPerfil(f) }) }} /></label>
            {p.foto && <button className="ape-btn ghost sm" onClick={() => setP({ ...p, foto: '' })}>tirar</button>}
          </div>
          <div className="ape-f"><label>Seu nome</label><input value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></div>
          <p className="ape-eyebrow" style={{ marginTop: 6 }}>o imóvel</p>
          <div className="ape-conta-foto">
            <span className="ape-pp-casa-foto lg">{im.capa ? <img src={im.capa} alt="" /> : <ApeIcon name="home" />}</span>
            <label className="ape-btn sm"><ApeIcon name="clip" />{im.capa ? 'trocar foto do imóvel' : 'foto do imóvel'}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('capa', await fotoLeve(f)) }} /></label>
            {im.capa && <button className="ape-btn ghost sm" onClick={() => set('capa', '')}>tirar</button>}
          </div>
          <div className="ape-frow">
            <div className="ape-f"><label>Condomínio ou nome</label><input value={im.condominio ?? ''} onChange={(e) => set('condominio', e.target.value)} placeholder="ex.: San Levi" /></div>
            <div className="ape-f"><label>Tipo</label><select value={im.tipo} onChange={(e) => set('tipo', e.target.value)}><option value="apê">apê</option><option value="casa">casa</option></select></div>
          </div>
          <div className="ape-frow ape-frow3">
            <div className="ape-f"><label>Torre / bloco</label><input value={im.torre ?? ''} onChange={(e) => set('torre', e.target.value)} /></div>
            <div className="ape-f"><label>Apê / número</label><input value={im.ap ?? ''} onChange={(e) => set('ap', e.target.value)} /></div>
            <div className="ape-f"><label>Quem vai morar</label><input value={im.moradores ?? ''} onChange={(e) => set('moradores', e.target.value)} placeholder="ex.: Laís e Igor" /></div>
          </div>
          <div className="ape-frow">
            <div className="ape-f"><label>Em que etapa você está</label>
              <select value={im.fase} onChange={(e) => set('fase', e.target.value)}>
                <option value="comprando">comprando</option><option value="planta">comprei na planta</option><option value="pronto">comprei pronto</option><option value="obra">em obra</option><option value="morando">morando</option>
              </select>
            </div>
            <div className="ape-f"><label>Área (m²)</label><input inputMode="decimal" value={im.m2 ?? ''} onChange={(e) => set('m2', num(e.target.value))} /></div>
          </div>
          <div className="ape-frow">
            <div className="ape-f"><label>Quanto quer gastar na obra (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={im.orcamento ?? ''} onChange={(e) => set('orcamento', num(e.target.value))} /></div>
            <div className="ape-f"><label>Entrega das chaves</label><input type="date" value={im.entrega} onChange={(e) => set('entrega', e.target.value)} /></div>
          </div>
          <button className="ape-btn primary" onClick={salvar}>salvar</button>
        </div>
      </div>
    </div>
  )
}

type Mudar<T> = (fn: (l: T[]) => T[]) => void

const FASE: Record<string, string> = { comprando: 'comprando', planta: 'comprei na planta', pronto: 'comprei pronto', obra: 'em obra', morando: 'morando' }

/* ---------- gráficos simples (SVG, nas cores do planê.apê) ---------- */
function Rosca({ partes, centro, sub }: { partes: { v: number; c: string; l: string }[]; centro: string; sub: string }) {
  const tot = partes.reduce((t, p) => t + p.v, 0) || 1
  const R = 42, C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="ape-rosca">
      <svg viewBox="0 0 100 100" role="img" aria-label={partes.map((p) => `${p.l}: ${Math.round((p.v / tot) * 100)}%`).join(', ')}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--a-sand)" strokeWidth="12" />
        {partes.filter((p) => p.v > 0).map((p) => {
          const len = (p.v / tot) * C
          const el = <circle key={p.l} cx="50" cy="50" r={R} fill="none" stroke={p.c} strokeWidth="12" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" strokeLinecap="butt" />
          acc += len
          return el
        })}
      </svg>
      <div className="ape-rosca-c"><b className="ape-keep">{centro}</b><small>{sub}</small></div>
    </div>
  )
}
function Barras({ dados, destaque = 0 }: { dados: { l: string; v: number; t?: string }[]; destaque?: number }) {
  const max = Math.max(1, ...dados.map((d) => d.v))
  return (
    <div className="ape-barras" role="img" aria-label={dados.map((d) => `${d.l}: ${brl(d.v)}`).join(', ')}>
      {dados.map((d, i) => (
        <div key={d.l + i} className={`ape-barra ${i === destaque ? 'on' : ''}`} title={d.t || brl(d.v)}>
          <span className="v ape-keep">{d.v ? (d.v >= 1000 ? `${(d.v / 1000).toFixed(1).replace('.', ',')} mil` : Math.round(d.v)) : ''}</span>
          <i style={{ height: `${Math.max(d.v ? 4 : 0, (d.v / max) * 100)}%` }} />
          <span className="l">{d.l}</span>
        </div>
      ))}
    </div>
  )
}

function Resumo({ acc, dados, im, nome, foto, casa, token, demo, mudar, irPara, onEditar }: { acc: PlatAcesso; dados: PlatDados; im: NonNullable<PlatDados['imovel']>; nome: string; foto: string; casa: string; token: string; demo: boolean; mudar: (fn: (d: PlatDados) => PlatDados) => void; irPara: (a: Aba) => void; onEditar: () => void }) {
  const g = dados.gastos || []
  const previsto = g.reduce((t, x) => t + (x.previsto || 0), 0)
  const pago = g.reduce((t, x) => t + (x.pago || 0), 0)
  const comprado = g.filter((x) => x.status === 'comprado').reduce((t, x) => t + (x.previsto || 0), 0)
  const ms = meses(dados.parcelas || [], 6)
  const et = dados.etapas || []
  const feitas = et.filter((e) => e.feita).length
  const proximas = et.filter((e) => !e.feita).slice(0, 4)
  const vi = dados.vistoria || []
  const probl = vi.filter((v) => v.status === 'problema').length
  const okV = vi.filter((v) => v.status === 'ok').length
  const [copiado, setCopiado] = useState(false)
  const link = `https://useplane.com.br/ape/#minha:${token}`
  const dias = im.entrega ? Math.round((new Date(im.entrega + 'T00:00:00').getTime() - Date.now()) / 864e5) : null
  const meta = im.orcamento || previsto
  const hojeS = hoje()
  const vencendo = (dados.garantias || []).map((x) => ({ x, v: venceEm(x) })).filter((y) => y.v && y.v >= hojeS && diasAte(y.v) <= 90)
  const manut = (dados.manutencao || []).filter((m) => proxima(m) && proxima(m)! <= somaDias(hojeS, 15))
  const docs = dados.documentos || []
  const porComodo = [...g.reduce((m, x) => m.set(x.comodo, (m.get(x.comodo) || 0) + (x.pago || x.previsto || 0)), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const avisos: [string, string, Aba][] = [
    ...(probl ? [[`${probl} problema${probl > 1 ? 's' : ''} na vistoria para a construtora corrigir`, 'alert', 'vistoria'] as [string, string, Aba]] : []),
    ...vencendo.map((y) => [`garantia de ${y.x.item || 'item'} vence em ${dmy(y.v!)}`, 'shield', 'garantias'] as [string, string, Aba]),
    ...manut.map((m) => [`manutenção: ${m.oque} (${proxima(m)! < hojeS ? 'atrasada' : `até ${dmy(proxima(m)!)}`})`, 'clock', 'garantias'] as [string, string, Aba]),
  ]
  return (
    <>
      <section className="ape-pp-ola" style={im.capa ? { backgroundImage: `linear-gradient(90deg, color-mix(in srgb, var(--a-pri) 92%, transparent), color-mix(in srgb, var(--a-pri) 45%, transparent)), url(${im.capa})` } : undefined}>
        <Avatar nome={nome} foto={foto} />
        <div className="t">
          <h2>olá{nome ? `, ${firstName(nome)}` : ''}!</h2>
          <p>{[casa, im.m2 ? `${String(im.m2).replace('.', ',')} m²` : '', FASE[im.fase], im.moradores ? `${im.moradores}` : ''].filter(Boolean).join(' · ')}</p>
          {dias != null && <span className="ape-pp-chaves"><ApeIcon name="clock" />{dias > 0 ? `faltam ${dias} dias para as chaves` : dias === 0 ? 'chaves hoje!' : `chaves recebidas em ${dmy(im.entrega)}`}</span>}
        </div>
        <button className="ape-btn sm" onClick={onEditar}><ApeIcon name="edit" />editar</button>
      </section>
      {avisos.length > 0 && (
        <section className="ape-pp-avisos">
          {avisos.slice(0, 4).map(([t, i, a]) => <button key={t} onClick={() => irPara(a)}><ApeIcon name={i} /><span>{t}</span><ApeIcon name="chev" /></button>)}
        </section>
      )}
      <div className="ape-pp-kpis">
        <button className="ape-pp-kpi" onClick={() => irPara('gastos')}>
          <span className="h"><ApeIcon name="tag" />gasto até agora</span>
          <b className="ape-keep">{brl(pago)}</b>
          <small className="ape-keep">{meta ? `${Math.round((pago / meta) * 100)}% de ${brl(meta)}` : 'toque para lançar'}</small>
        </button>
        <button className="ape-pp-kpi" onClick={() => irPara('parcelas')}><span className="h"><ApeIcon name="clock" />parcelas do mês</span><b className="ape-keep">{brl(ms[0]?.total || 0)}</b><small className="ape-keep">próximo: {brl(ms[1]?.total || 0)}</small></button>
        <button className="ape-pp-kpi" onClick={() => irPara('etapas')}><span className="h"><ApeIcon name="list" />etapas</span><b>{feitas}<small> de {et.length}</small></b><i className="ape-kpi-bar"><em style={{ width: `${et.length ? (feitas / et.length) * 100 : 0}%` }} /></i></button>
        <button className="ape-pp-kpi" onClick={() => irPara('documentos')}><span className="h"><ApeIcon name="file" />documentos</span><b>{docs.filter((d) => d.tenho).length}<small> de {docs.length || DOCS.length}</small></b><small>guardados</small></button>
      </div>
      <div className="ape-pp-duas">
        <section className="ape-panel ape-pp-card">
          <div className="ape-pp-card-h"><p className="ape-eyebrow">orçamento da obra</p><button className="ape-linkish ape-link" onClick={() => irPara('gastos')}>ver gastos</button></div>
          {previsto || pago || meta ? (
            <div className="ape-pp-rosca-l">
              <Rosca partes={[{ v: pago, c: 'var(--a-pri)', l: 'pago' }, { v: comprado, c: 'var(--a-sec)', l: 'comprado' }, { v: Math.max(0, (meta || 0) - pago - comprado), c: 'var(--a-pri-soft)', l: 'falta' }]} centro={meta ? `${Math.round((pago / meta) * 100)}%` : '0%'} sub="pago" />
              <ul className="ape-legenda">
                <li><i style={{ background: 'var(--a-pri)' }} />pago<b className="ape-keep">{brl(pago)}</b></li>
                <li><i style={{ background: 'var(--a-sec)' }} />comprado, a pagar<b className="ape-keep">{brl(comprado)}</b></li>
                <li><i style={{ background: 'var(--a-pri-soft)' }} />ainda falta<b className="ape-keep">{brl(Math.max(0, (meta || 0) - pago - comprado))}</b></li>
              </ul>
            </div>
          ) : <EmptyCard t="Coloque quanto quer gastar e lance os gastos para ver o gráfico." b="lançar gasto" onClick={() => irPara('gastos')} />}
        </section>
        <section className="ape-panel ape-pp-card">
          <div className="ape-pp-card-h"><p className="ape-eyebrow">parcelas dos próximos 6 meses</p><button className="ape-linkish ape-link" onClick={() => irPara('parcelas')}>ver parcelas</button></div>
          {ms.some((m) => m.total) ? <Barras dados={ms.map((m) => ({ l: new Date(m.mes + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), v: m.total, t: m.itens.join(', ') }))} /> : <EmptyCard t="Cadastre o que é parcelado e veja quanto sai em cada mês." b="lançar parcela" onClick={() => irPara('parcelas')} />}
        </section>
      </div>
      <div className="ape-pp-duas">
        <section className="ape-panel ape-pp-card">
          <div className="ape-pp-card-h"><p className="ape-eyebrow">próximos passos</p><button className="ape-linkish ape-link" onClick={() => irPara('etapas')}>todas as etapas</button></div>
          <div className="ape-pp-check">
            {proximas.length ? proximas.map((e) => (
              <label key={e.id}>
                <input type="checkbox" onChange={() => mudar((d) => ({ ...d, etapas: (d.etapas || []).map((x) => (x.id === e.id ? { ...x, feita: true, data: x.data || hoje() } : x)) }))} />
                <span className="box"><ApeIcon name="check" /></span>
                <span className="t"><b>{e.nome}</b>{e.data ? <small>{dmy(e.data)}</small> : null}</span>
              </label>
            )) : <p className="ape-note">Todas as etapas feitas. Parabéns!</p>}
          </div>
        </section>
        <section className="ape-panel ape-pp-card">
          <div className="ape-pp-card-h"><p className="ape-eyebrow">{porComodo.length ? 'onde o dinheiro vai' : 'vistoria'}</p><button className="ape-linkish ape-link" onClick={() => irPara(porComodo.length ? 'gastos' : 'vistoria')}>abrir</button></div>
          {porComodo.length ? (
            <div className="ape-hbarras">
              {porComodo.map(([c, v]) => <div key={c}><span>{c}</span><i><em style={{ width: `${(v / porComodo[0][1]) * 100}%` }} /></i><b className="ape-keep">{brl(v)}</b></div>)}
            </div>
          ) : (
            <div className="ape-pp-rosca-l">
              <Rosca partes={[{ v: okV, c: 'var(--a-pri)', l: 'ok' }, { v: probl, c: 'var(--a-sec)', l: 'problema' }, { v: vi.length - okV - probl, c: 'var(--a-sand)', l: 'a conferir' }]} centro={`${okV + probl}/${vi.length}`} sub="conferidos" />
              <ul className="ape-legenda"><li><i style={{ background: 'var(--a-pri)' }} />ok<b>{okV}</b></li><li><i style={{ background: 'var(--a-sec)' }} />problema<b>{probl}</b></li><li><i style={{ background: 'var(--a-sand)' }} />a conferir<b>{vi.length - okV - probl}</b></li></ul>
            </div>
          )}
        </section>
      </div>
      <section className="ape-panel ape-pp-card">
        <p className="ape-eyebrow">anotações</p>
        <div className="ape-f"><textarea value={dados.notas || ''} onChange={(e) => mudar((d) => ({ ...d, notas: e.target.value }))} placeholder="Senha do interfone, medidas, ideias…" aria-label="Anotações" /></div>
      </section>
      {!demo && (
        <p className="ape-note" style={{ margin: 0, textAlign: 'center' }}>
          acesso até {dmy(acc.validade)}{acc.cortesia ? ' (cortesia)' : ''} ·{' '}
          <button className="ape-linkish ape-link" onClick={() => { void navigator.clipboard?.writeText(link); setCopiado(true) }}>{copiado ? 'link copiado' : 'copiar meu link de acesso'}</button>
        </p>
      )}
    </>
  )
}
function EmptyCard({ t, b, onClick }: { t: string; b: string; onClick: () => void }) {
  return <div className="ape-pp-vazio"><span>{t}</span><button className="ape-btn sm" onClick={onClick}><ApeIcon name="plus" />{b}</button></div>
}

function Gastos({ lista, orcamento, mudar }: { lista: PlatGasto[]; orcamento: number | null; mudar: Mudar<PlatGasto> }) {
  const [filtro, setFiltro] = useState('todos')
  const por = useMemo(() => {
    const m = new Map<string, { previsto: number; pago: number }>()
    for (const g of lista) {
      const x = m.get(g.comodo) || { previsto: 0, pago: 0 }
      m.set(g.comodo, { previsto: x.previsto + (g.previsto || 0), pago: x.pago + (g.pago || 0) })
    }
    return [...m.entries()]
  }, [lista])
  const previsto = lista.reduce((t, x) => t + (x.previsto || 0), 0)
  const pago = lista.reduce((t, x) => t + (x.pago || 0), 0)
  const set = (id: string, k: keyof PlatGasto, v: unknown) => mudar((l) => l.map((g) => (g.id === id ? { ...g, [k]: v } : g)))
  const vis = lista.filter((g) => filtro === 'todos' || g.comodo === filtro)
  const [aberto, setAberto] = useState('')
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">gastos por cômodo</p><span className="ape-note ape-keep">previsto {brl(previsto)} · pago {brl(pago)} · falta {brl(Math.max(0, previsto - pago))}{orcamento ? ` · orçamento ${brl(orcamento)}` : ''}</span></div>
        <button className="ape-btn primary sm" onClick={() => { const id = uid(); setAberto(id); mudar((l) => [{ id, comodo: filtro === 'todos' ? 'geral' : filtro, item: '', previsto: null, pago: null, status: 'planejado', data: '', obs: '' }, ...l]) }}><ApeIcon name="plus" />gasto</button>
      </div>
      {orcamento ? <div className="ape-bar" aria-label="Quanto do orçamento já foi"><i style={{ width: `${Math.min(100, (pago / orcamento) * 100)}%` }} /></div> : null}
      {por.length > 0 && (
        <div className="ape-chips" role="group" aria-label="Filtrar por cômodo">
          <button className="ape-chip" aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>todos</button>
          {por.map(([c, v]) => <button key={c} className="ape-chip" aria-pressed={filtro === c} onClick={() => setFiltro(c)}>{c} <span className="ape-keep">{brl(v.pago || v.previsto)}</span></button>)}
        </div>
      )}
      {!vis.length && <div className="ape-empty"><span>Nenhum gasto ainda. Toque em "+ gasto".</span></div>}
      <div className="ape-plat-list">
        {vis.map((g) => aberto !== g.id ? (
          <button key={g.id} className="ape-pp-linha" onClick={() => setAberto(g.id)}>
            <span className={`st ${g.status}`} aria-hidden="true"><ApeIcon name={g.status === 'planejado' ? 'clock' : 'check'} /></span>
            <span className="t"><b>{g.item || 'gasto sem nome'}</b><small>{g.comodo} · {g.status}</small></span>
            <span className="v ape-keep">{brl(g.pago ?? g.previsto ?? 0)}</span>
            <ApeIcon name="chev" />
          </button>
        ) : (
          <div key={g.id} className="ape-plat-item aberto">
            <div className="ape-frow">
              <div className="ape-f"><label>Item</label><input value={g.item} onChange={(e) => set(g.id, 'item', e.target.value)} placeholder="ex.: piso da sala" /></div>
              <div className="ape-f"><label>Cômodo</label><select value={g.comodo} onChange={(e) => set(g.id, 'comodo', e.target.value)}>{COMODOS.map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div className="ape-frow ape-frow3">
              <div className="ape-f"><label>Previsto (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={g.previsto ?? ''} onChange={(e) => set(g.id, 'previsto', num(e.target.value))} /></div>
              <div className="ape-f"><label>Pago (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={g.pago ?? ''} onChange={(e) => set(g.id, 'pago', num(e.target.value))} /></div>
              <div className="ape-f"><label>Situação</label><select value={g.status} onChange={(e) => set(g.id, 'status', e.target.value)}><option value="planejado">planejado</option><option value="comprado">comprado</option><option value="pago">pago</option></select></div>
            </div>
            <div className="ape-frow">
              <div className="ape-f"><label>Obs.</label><input value={g.obs} onChange={(e) => set(g.id, 'obs', e.target.value)} placeholder="loja, forma de pagamento…" /></div>
            </div>
            <div className="ape-acts ape-pp-item-acts">
              <button className="ape-btn primary sm" onClick={() => setAberto('')}><ApeIcon name="check" />pronto</button>
              <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== g.id))} aria-label="Apagar gasto"><ApeIcon name="trash" />apagar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Parcelas({ lista, mudar }: { lista: PlatParcela[]; mudar: Mudar<PlatParcela> }) {
  const ms = meses(lista, 12)
  const max = Math.max(1, ...ms.map((m) => m.total))
  const set = (id: string, k: keyof PlatParcela, v: unknown) => mudar((l) => l.map((p) => (p.id === id ? { ...p, [k]: v } : p)))
  const [aberto, setAberto] = useState('')
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">parcelas dos próximos 12 meses</p><span className="ape-note ape-keep">total no período: {brl(ms.reduce((t, m) => t + m.total, 0))}</span></div>
        <button className="ape-btn primary sm" onClick={() => { const id = uid(); setAberto(id); mudar((l) => [{ id, descricao: '', valor: null, vezes: 1, inicio: hoje(), dia: null }, ...l]) }}><ApeIcon name="plus" />parcela</button>
      </div>
      <div className="ape-meses" aria-label="Parcelas por mês">
        {ms.map((m) => (
          <div key={m.mes} className="ape-mes" title={m.itens.join(', ')}>
            <i style={{ height: `${(m.total / max) * 100}%` }} />
            <b className="ape-keep">{m.total ? brl(m.total) : '—'}</b>
            <span>{new Date(m.mes + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
          </div>
        ))}
      </div>
      {!lista.length && <div className="ape-empty"><span>Cadastre as parcelas (marcenaria, móveis, financiamento…) e veja o mês a mês.</span></div>}
      <div className="ape-plat-list">
        {lista.map((p) => aberto !== p.id ? (
          <button key={p.id} className="ape-pp-linha" onClick={() => setAberto(p.id)}>
            <span className="st" aria-hidden="true"><ApeIcon name="clock" /></span>
            <span className="t"><b>{p.descricao || 'parcela sem nome'}</b><small>{p.vezes || 1}x · a partir de {p.inicio ? dmy(p.inicio) : '—'}</small></span>
            <span className="v ape-keep">{brl(p.valor || 0)}</span>
            <ApeIcon name="chev" />
          </button>
        ) : (
          <div key={p.id} className="ape-plat-item aberto">
            <div className="ape-frow">
              <div className="ape-f"><label>O que é</label><input value={p.descricao} onChange={(e) => set(p.id, 'descricao', e.target.value)} placeholder="ex.: marcenaria" /></div>
              <div className="ape-f"><label>1ª parcela</label><input type="date" value={p.inicio} onChange={(e) => set(p.id, 'inicio', e.target.value)} /></div>
            </div>
            <div className="ape-frow">
              <div className="ape-f"><label>Valor da parcela (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={p.valor ?? ''} onChange={(e) => set(p.id, 'valor', num(e.target.value))} /></div>
              <div className="ape-f"><label>Quantas vezes</label><input inputMode="numeric" value={p.vezes ?? ''} onChange={(e) => set(p.id, 'vezes', num(e.target.value))} /></div>
            </div>
            {p.valor && p.vezes ? <span className="ape-note ape-keep">total: {brl(p.valor * p.vezes)}</span> : null}
            <div className="ape-acts ape-pp-item-acts">
              <button className="ape-btn primary sm" onClick={() => setAberto('')}><ApeIcon name="check" />pronto</button>
              <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== p.id))} aria-label="Apagar parcela"><ApeIcon name="trash" />apagar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Etapas({ lista, mudar }: { lista: PlatEtapa[]; mudar: Mudar<PlatEtapa> }) {
  const set = (id: string, k: keyof PlatEtapa, v: unknown) => mudar((l) => l.map((e) => (e.id === id ? { ...e, [k]: v } : e)))
  const feitas = lista.filter((e) => e.feita).length
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">etapas da compra e da obra</p><span className="ape-note">{feitas} de {lista.length} feitas</span></div>
        <button className="ape-btn primary sm" onClick={() => mudar((l) => [...l, { id: uid(), nome: '', feita: false, data: '', quem: '', obs: '' }])}><ApeIcon name="plus" />etapa</button>
      </div>
      <div className="ape-bar"><i style={{ width: `${lista.length ? (feitas / lista.length) * 100 : 0}%` }} /></div>
      <ol className="ape-etapas">
        {lista.map((e, i) => (
          <li key={e.id} className={e.feita ? 'ok' : ''}>
            <button className="ape-etapa-ck" onClick={() => set(e.id, 'feita', !e.feita)} aria-pressed={e.feita} aria-label={e.feita ? 'Desmarcar' : 'Marcar como feita'}>{e.feita ? <ApeIcon name="check" /> : i + 1}</button>
            <div className="ape-etapa-b">
              <input className="ape-etapa-n" value={e.nome} onChange={(x) => set(e.id, 'nome', x.target.value)} aria-label="Etapa" placeholder="nome da etapa" />
              <div className="ape-frow">
                <div className="ape-f"><label>Data</label><input type="date" value={e.data} onChange={(x) => set(e.id, 'data', x.target.value)} /></div>
                <div className="ape-f"><label>Quem faz</label><input value={e.quem} onChange={(x) => set(e.id, 'quem', x.target.value)} /></div>
              </div>
            </div>
            <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== e.id))} aria-label="Apagar etapa"><ApeIcon name="trash" /></button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Vistoria({ lista, nome, mudar }: { lista: PlatVistoria[]; nome: string; mudar: Mudar<PlatVistoria> }) {
  const set = (id: string, k: keyof PlatVistoria, v: unknown) => mudar((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const comodos = [...new Set(lista.map((v) => v.comodo))]
  const probl = lista.filter((v) => v.status === 'problema')
  const [err, setErr] = useState('')
  const foto = async (id: string, f?: File) => {
    if (!f) return
    try {
      set(id, 'foto', await fotoLeve(f))
    } catch {
      setErr('Não deu para abrir essa foto.')
    }
  }
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">vistoria</p><span className="ape-note">Toque em <b>ok</b> ou <b>problema</b> em cada item. {lista.filter((v) => v.status === 'ok').length} ok · {probl.length} com problema · {lista.filter((v) => v.status === 'pendente').length} a conferir</span></div>
        <button className="ape-btn primary sm" onClick={() => window.print()}><ApeIcon name="file" />imprimir resumo</button>
      </div>
      {err && <p className="ape-err">{err}</p>}
      {comodos.map((c) => (
        <div key={c} className="ape-vist-c">
          <h4>{c} <span>{lista.filter((v) => v.comodo === c && v.status !== 'pendente').length}/{lista.filter((v) => v.comodo === c).length}</span></h4>
          {lista.filter((v) => v.comodo === c).map((v) => (
            <div key={v.id} className={`ape-vist ${v.status}`}>
              <input className="ape-vist-i" value={v.item} onChange={(e) => set(v.id, 'item', e.target.value)} aria-label="Item" placeholder="o que conferir" autoFocus={!v.item} />
              <div className="ape-vist-btns" role="group" aria-label={`Situação de ${v.item || 'item'}`}>
                <button className="ok" aria-pressed={v.status === 'ok'} onClick={() => set(v.id, 'status', v.status === 'ok' ? 'pendente' : 'ok')}><ApeIcon name="check" />ok</button>
                <button className="pr" aria-pressed={v.status === 'problema'} onClick={() => set(v.id, 'status', v.status === 'problema' ? 'pendente' : 'problema')}><ApeIcon name="alert" />problema</button>
                <button className="del" onClick={() => { if (!v.item || confirm(`Excluir "${v.item}"?`)) mudar((l) => l.filter((x) => x.id !== v.id)) }} aria-label={`Excluir ${v.item || 'item'}`} title="Excluir item"><ApeIcon name="trash" /></button>
              </div>
              {v.status === 'problema' && (
                <div className="ape-vist-p">
                  <input value={v.obs} onChange={(e) => set(v.id, 'obs', e.target.value)} placeholder="o que está errado?" aria-label="Problema" />
                  <label className="ape-btn sm"><ApeIcon name="clip" />{v.foto ? 'trocar foto' : 'tirar foto'}<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void foto(v.id, e.target.files?.[0])} /></label>
                  {v.foto && <img src={v.foto} alt={`Foto: ${v.item}`} />}
                </div>
              )}
            </div>
          ))}
          <button className="ape-vist-add" onClick={() => mudar((l) => { const i = l.map((x) => x.comodo).lastIndexOf(c); const novo = { id: uid(), comodo: c, item: '', status: 'pendente' as const, obs: '' }; return i < 0 ? [...l, novo] : [...l.slice(0, i + 1), novo, ...l.slice(i + 1)] })}><ApeIcon name="plus" />adicionar item em {c}</button>
        </div>
      ))}
      <button className="ape-btn sm" style={{ justifySelf: 'start' }} onClick={() => { const nome = prompt('Nome do cômodo (ex.: varanda, quarto 3):')?.trim(); if (nome) mudar((l) => [...l, { id: uid(), comodo: nome.toLowerCase(), item: '', status: 'pendente', obs: '' }]) }}><ApeIcon name="plus" />novo cômodo</button>
      {/* só aparece na impressão */}
      <div className="ape-print">
        <h2>resumo da vistoria · {nome}</h2>
        <p>{new Date().toLocaleDateString('pt-BR')} · {probl.length} problema(s) encontrado(s)</p>
        <ol>
          {probl.map((v) => (
            <li key={v.id}><b>{v.comodo}: {v.item}</b>{v.obs ? ` · ${v.obs}` : ''}{v.foto && <img src={v.foto} alt="" />}</li>
          ))}
        </ol>
        <p>Peço a correção dos itens acima antes do recebimento definitivo do imóvel.</p>
        <p>Assinatura: ______________________________</p>
        <p className="ape-print-sign">planê.apê · useplane.com.br/ape · {APE.instagram}</p>
      </div>
    </section>
  )
}

function Contatos({ lista, mudar }: { lista: PlatContato[]; mudar: Mudar<PlatContato> }) {
  const set = (id: string, k: keyof PlatContato, v: unknown) => mudar((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">contatos</p><span className="ape-note">fornecedores e prestadores</span></div>
        <button className="ape-btn primary sm" onClick={() => mudar((l) => [...l, { id: uid(), nome: '', servico: '', tel: '', obs: '' }])}><ApeIcon name="plus" />contato</button>
      </div>
      {!lista.length && <div className="ape-empty"><ApeArt name="grupo" size={44} /><span>Guarde aqui o contato de cada fornecedor.</span></div>}
      <div className="ape-plat-list">
        {lista.map((c) => (
          <div key={c.id} className="ape-plat-item">
            <div className="ape-frow">
              <div className="ape-f"><label>Nome</label><input value={c.nome} onChange={(e) => set(c.id, 'nome', e.target.value)} /></div>
              <div className="ape-f"><label>Serviço</label><input value={c.servico} onChange={(e) => set(c.id, 'servico', e.target.value)} /></div>
            </div>
            <div className="ape-frow">
              <div className="ape-f"><label><span className="ape-keep">WhatsApp</span></label><input inputMode="tel" value={c.tel} onChange={(e) => set(c.id, 'tel', e.target.value)} onBlur={() => set(c.id, 'tel', fmtTel(c.tel))} /></div>
              <div className="ape-f"><label>Obs.</label><input value={c.obs} onChange={(e) => set(c.id, 'obs', e.target.value)} /></div>
            </div>
            <div className="ape-acts">
              {waNum(c.tel) && <a className="ape-btn sm" href={wa(waNum(c.tel), `Oi, ${firstName(c.nome)}!`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />WhatsApp</a>}
              <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== c.id))} aria-label="Apagar contato"><ApeIcon name="trash" /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- garantias, manutenção e documentos ---------- */
const somaDias = (d: string, n: number) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
const somaMeses = (d: string, n: number) => { const x = new Date(d + 'T00:00:00'); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10) }
const diasAte = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - new Date(hoje() + 'T00:00:00').getTime()) / 864e5)
const venceEm = (g: PlatGarantia) => (g.compra && g.meses ? somaMeses(g.compra, g.meses) : '')
const proxima = (m: PlatManut) => (m.cada ? (m.ultima ? somaMeses(m.ultima, m.cada) : hoje()) : '')
/** Prazos comuns de garantia do imóvel novo (o que vale é o manual do proprietário). */
const GARANTIAS_IMOVEL: [string, number][] = [['instalações elétricas e hidráulicas', 36], ['revestimentos e rejuntes', 24], ['impermeabilização', 60], ['esquadrias (janelas e portas)', 12], ['pintura', 24], ['estrutura e segurança', 60]]
const MANUT: [string, number][] = [['lavar os filtros do ar-condicionado', 1], ['limpar ralos e sifões', 3], ['higienizar o ar-condicionado (técnico)', 6], ['revisar o silicone da pia, do tanque e do box', 6], ['testar o DR no quadro de luz', 6], ['trocar o filtro de água', 6], ['conferir rejuntes e manchas no teto', 12], ['conferir a validade da mangueira de gás', 12]]
export const DOCS = ['contrato de compra e venda', 'contrato do financiamento', 'matrícula atualizada do imóvel', 'comprovante do ITBI', 'escritura / registro em cartório', 'manual do proprietário', 'termo de vistoria e de entrega das chaves', 'planta do apê', 'notas fiscais de móveis e serviços', 'apólice do seguro residencial', 'regulamento e convenção do condomínio']

function Garantias({ lista, manut, entrega, mudar, mudarM }: { lista: PlatGarantia[]; manut: PlatManut[]; entrega: string; mudar: Mudar<PlatGarantia>; mudarM: Mudar<PlatManut> }) {
  const set = (id: string, k: keyof PlatGarantia, v: unknown) => mudar((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const setM = (id: string, k: keyof PlatManut, v: unknown) => mudarM((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const h = hoje()
  const ordem = [...lista].sort((a, b) => (venceEm(a) || '9') .localeCompare(venceEm(b) || '9'))
  return (
    <>
      <section className="ape-panel ape-plat-sec">
        <div className="ape-plat-sec-h">
          <div><p className="ape-eyebrow">garantias</p><span className="ape-note">Anote o que comprou e até quando vale a garantia. O resumo avisa 90 dias antes de vencer.</span></div>
          <button className="ape-btn primary sm" onClick={() => mudar((l) => [{ id: uid(), item: '', onde: '', compra: h, meses: 12, nota: false, obs: '' }, ...l])}><ApeIcon name="plus" />garantia</button>
        </div>
        {!lista.some((x) => x.onde === 'construtora') && (
          <button className="ape-pp-sugestao" onClick={() => mudar((l) => [...GARANTIAS_IMOVEL.map(([item, meses]) => ({ id: uid(), item, onde: 'construtora', compra: entrega || h, meses, nota: true, obs: '' })), ...l])}>
            <ApeIcon name="sparkle" /><span><b>colocar as garantias do imóvel</b><small>prazos comuns da construtora{entrega ? `, contando da entrega (${dmy(entrega)})` : ''}; confira no seu manual</small></span>
          </button>
        )}
        {!lista.length && <div className="ape-empty"><ApeArt name="contrato" size={44} /><span>Eletros, móveis planejados, box, ar-condicionado: cada um tem uma garantia.</span></div>}
        <div className="ape-plat-list">
          {ordem.map((g) => {
            const v = venceEm(g)
            const d = v ? diasAte(v) : null
            return (
              <div key={g.id} className="ape-plat-item">
                <div className="ape-pp-item-h">
                  <input className="ape-etapa-n" value={g.item} onChange={(e) => set(g.id, 'item', e.target.value)} placeholder="o que é (ex.: geladeira)" aria-label="Item" />
                  {v ? <span className={`ape-pill ${d! < 0 ? 'rosa' : d! <= 90 ? 'terra' : 'azul'}`}>{d! < 0 ? `venceu em ${dmy(v)}` : d! <= 90 ? `vence em ${d} dias` : `até ${dmy(v)}`}</span> : null}
                </div>
                <div className="ape-frow ape-frow3">
                  <div className="ape-f"><label>Onde comprou</label><input value={g.onde} onChange={(e) => set(g.id, 'onde', e.target.value)} /></div>
                  <div className="ape-f"><label>Data da compra</label><input type="date" value={g.compra} onChange={(e) => set(g.id, 'compra', e.target.value)} /></div>
                  <div className="ape-f"><label>Garantia (meses)</label><input inputMode="numeric" value={g.meses ?? ''} onChange={(e) => set(g.id, 'meses', num(e.target.value))} /></div>
                </div>
                <div className="ape-acts">
                  <label className="ape-tog"><input type="checkbox" checked={g.nota} onChange={(e) => set(g.id, 'nota', e.target.checked)} />nota fiscal guardada</label>
                  <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== g.id))} aria-label="Apagar"><ApeIcon name="trash" /></button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <section className="ape-panel ape-plat-sec">
        <div className="ape-plat-sec-h">
          <div><p className="ape-eyebrow">manutenção da casa</p><span className="ape-note">O que revisar e de quanto em quanto tempo. Toque em "fiz hoje" e a próxima data se ajusta sozinha.</span></div>
          <button className="ape-btn primary sm" onClick={() => mudarM((l) => [...l, { id: uid(), oque: '', cada: 6, ultima: '' }])}><ApeIcon name="plus" />tarefa</button>
        </div>
        {!manut.length && (
          <button className="ape-pp-sugestao" onClick={() => mudarM(() => MANUT.map(([oque, cada]) => ({ id: uid(), oque, cada, ultima: '' })))}>
            <ApeIcon name="sparkle" /><span><b>usar a lista pronta</b><small>{MANUT.length} cuidados que evitam dor de cabeça no primeiro ano</small></span>
          </button>
        )}
        <div className="ape-pp-manut">
          {manut.map((m) => {
            const p = proxima(m)
            const atras = !!p && p < h
            return (
              <div key={m.id} className={`ape-pp-manut-i ${atras ? 'atras' : ''}`}>
                <div className="t">
                  <input value={m.oque} onChange={(e) => setM(m.id, 'oque', e.target.value)} aria-label="Tarefa" placeholder="o que fazer" />
                  <small>a cada <input inputMode="numeric" value={m.cada ?? ''} onChange={(e) => setM(m.id, 'cada', num(e.target.value))} aria-label="Meses" /> {m.cada === 1 ? 'mês' : 'meses'} · {m.ultima ? `feito em ${dmy(m.ultima)} · próxima ${dmy(p)}` : 'ainda não feito'}</small>
                </div>
                <button className={`ape-btn sm ${atras || !m.ultima ? 'primary' : ''}`} onClick={() => setM(m.id, 'ultima', h)}><ApeIcon name="check" />fiz hoje</button>
                <button className="ape-btn ghost sm" onClick={() => mudarM((l) => l.filter((x) => x.id !== m.id))} aria-label="Apagar"><ApeIcon name="trash" /></button>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

function Documentos({ lista, mudar }: { lista: PlatDoc[]; mudar: Mudar<PlatDoc> }) {
  const docs = lista.length ? lista : DOCS.map((nome) => ({ id: nome, nome, tenho: false, onde: '' }))
  const set = (id: string, k: keyof PlatDoc, v: unknown) => mudar((l) => (l.length ? l : docs).map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const ok = docs.filter((d) => d.tenho).length
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">documentos do imóvel</p><span className="ape-note">{ok} de {docs.length} guardados. Anote onde está cada um (pasta, gaveta ou link do Drive).</span></div>
        <button className="ape-btn primary sm" onClick={() => mudar((l) => [...(l.length ? l : docs), { id: uid(), nome: '', tenho: false, onde: '' }])}><ApeIcon name="plus" />documento</button>
      </div>
      <div className="ape-bar"><i style={{ width: `${docs.length ? (ok / docs.length) * 100 : 0}%` }} /></div>
      <div className="ape-pp-check ape-pp-docs">
        {docs.map((d) => (
          <div key={d.id} className={`ape-pp-doc ${d.tenho ? 'ok' : ''}`}>
            <label className="ck"><input type="checkbox" checked={d.tenho} onChange={(e) => set(d.id, 'tenho', e.target.checked)} /><span className="box"><ApeIcon name="check" /></span></label>
            <div className="t">
              <input value={d.nome} onChange={(e) => set(d.id, 'nome', e.target.value)} aria-label="Documento" placeholder="nome do documento" />
              <input className="onde" value={d.onde} onChange={(e) => set(d.id, 'onde', e.target.value)} placeholder="onde está? (pasta azul, link do Drive…)" aria-label="Onde está" />
            </div>
            {/^https?:\/\//.test(d.onde) && <a className="ape-btn ghost sm" href={d.onde} target="_blank" rel="noopener noreferrer" aria-label="Abrir link"><ApeIcon name="share" /></a>}
          </div>
        ))}
      </div>
      <p className="ape-note" style={{ margin: 0 }}><ApeIcon name="shield" /> Dica: guarde cópias digitais numa pasta só (Drive, iCloud) e cole o link aqui. Não salve documentos com senha à vista.</p>
    </section>
  )
}

/* ---------- calculadoras ---------- */
function Calculadoras({ m2 }: { m2: number | null }) {
  const [pa, setPa] = useState({ larg: '', comp: '', sobra: '10', caixa: '2,2' })
  const area = (num(pa.larg) || 0) * (num(pa.comp) || 0)
  const comSobra = area * (1 + (num(pa.sobra) || 0) / 100)
  const caixas = num(pa.caixa) ? Math.ceil(comSobra / num(pa.caixa)!) : 0
  const [ti, setTi] = useState({ larg: '', comp: '', alt: '2,50', portas: '1', janelas: '1', demaos: '2', rende: '12', teto: true })
  const per = 2 * ((num(ti.larg) || 0) + (num(ti.comp) || 0))
  const parede = Math.max(0, per * (num(ti.alt) || 0) - (num(ti.portas) || 0) * 1.6 - (num(ti.janelas) || 0) * 2)
  const teto = ti.teto ? (num(ti.larg) || 0) * (num(ti.comp) || 0) : 0
  const litros = num(ti.rende) ? ((parede + teto) * (num(ti.demaos) || 1)) / num(ti.rende)! : 0
  const [ar, setAr] = useState({ m2: m2 ? String(m2).replace('.', ',') : '', pessoas: '2', sol: false, eletros: '1' })
  const btu = (num(ar.m2) || 0) * 600 + Math.max(0, (num(ar.pessoas) || 0) - 2) * 600 + (num(ar.eletros) || 0) * 600
  const btuFinal = btu * (ar.sol ? 1.15 : 1)
  const padrao = [7000, 9000, 12000, 18000, 24000, 30000].find((x) => x >= btuFinal) || 30000
  const [lu, setLu] = useState({ m2: '', tipo: '150' })
  const lumens = (num(lu.m2) || 0) * Number(lu.tipo)
  const f = (n: number, d = 1) => n.toFixed(d).replace('.', ',')
  return (
    <div className="ape-pp-calcs">
      <section className="ape-panel ape-pp-calc">
        <h3><ApeIcon name="tile" />piso e revestimento</h3>
        <div className="ape-frow ape-frow3">
          <div className="ape-f"><label>Largura (m)</label><input inputMode="decimal" value={pa.larg} onChange={(e) => setPa({ ...pa, larg: e.target.value })} /></div>
          <div className="ape-f"><label>Comprimento (m)</label><input inputMode="decimal" value={pa.comp} onChange={(e) => setPa({ ...pa, comp: e.target.value })} /></div>
          <div className="ape-f"><label>Sobra (%)</label><select value={pa.sobra} onChange={(e) => setPa({ ...pa, sobra: e.target.value })}><option value="10">10% reto</option><option value="15">15% diagonal</option><option value="20">20% espinha</option></select></div>
        </div>
        <div className="ape-f"><label>m² por caixa</label><input inputMode="decimal" value={pa.caixa} onChange={(e) => setPa({ ...pa, caixa: e.target.value })} /></div>
        <div className="ape-pp-res"><b>{area ? `${f(comSobra, 2)} m²` : '—'}</b><span>{area ? `${f(area, 2)} m² + sobra · ${caixas} caixa${caixas === 1 ? '' : 's'}` : 'preencha as medidas'}</span></div>
      </section>
      <section className="ape-panel ape-pp-calc">
        <h3><ApeIcon name="brush" />tinta</h3>
        <div className="ape-frow ape-frow3">
          <div className="ape-f"><label>Largura (m)</label><input inputMode="decimal" value={ti.larg} onChange={(e) => setTi({ ...ti, larg: e.target.value })} /></div>
          <div className="ape-f"><label>Comprimento (m)</label><input inputMode="decimal" value={ti.comp} onChange={(e) => setTi({ ...ti, comp: e.target.value })} /></div>
          <div className="ape-f"><label>Pé-direito (m)</label><input inputMode="decimal" value={ti.alt} onChange={(e) => setTi({ ...ti, alt: e.target.value })} /></div>
        </div>
        <div className="ape-frow ape-frow3">
          <div className="ape-f"><label>Portas</label><input inputMode="numeric" value={ti.portas} onChange={(e) => setTi({ ...ti, portas: e.target.value })} /></div>
          <div className="ape-f"><label>Janelas</label><input inputMode="numeric" value={ti.janelas} onChange={(e) => setTi({ ...ti, janelas: e.target.value })} /></div>
          <div className="ape-f"><label>Demãos</label><input inputMode="numeric" value={ti.demaos} onChange={(e) => setTi({ ...ti, demaos: e.target.value })} /></div>
        </div>
        <div className="ape-acts"><div className="ape-f" style={{ flex: 1 }}><label>Rende (m² por litro, vem na lata)</label><input inputMode="decimal" value={ti.rende} onChange={(e) => setTi({ ...ti, rende: e.target.value })} /></div><label className="ape-tog"><input type="checkbox" checked={ti.teto} onChange={(e) => setTi({ ...ti, teto: e.target.checked })} />pintar o teto</label></div>
        <div className="ape-pp-res"><b>{litros ? `${f(litros)} litros` : '—'}</b><span>{litros ? `${f(parede + teto)} m² · ${litros <= 3.6 ? '1 galão (3,6 L)' : litros <= 18 ? `${Math.ceil(litros / 3.6)} galões ou 1 lata de 18 L` : `${Math.ceil(litros / 18)} latas de 18 L`}` : 'preencha as medidas'}</span></div>
      </section>
      <section className="ape-panel ape-pp-calc">
        <h3><ApeIcon name="snow" />ar-condicionado (BTUs)</h3>
        <div className="ape-frow ape-frow3">
          <div className="ape-f"><label>Área (m²)</label><input inputMode="decimal" value={ar.m2} onChange={(e) => setAr({ ...ar, m2: e.target.value })} /></div>
          <div className="ape-f"><label>Pessoas</label><input inputMode="numeric" value={ar.pessoas} onChange={(e) => setAr({ ...ar, pessoas: e.target.value })} /></div>
          <div className="ape-f"><label>Eletrônicos</label><input inputMode="numeric" value={ar.eletros} onChange={(e) => setAr({ ...ar, eletros: e.target.value })} /></div>
        </div>
        <label className="ape-tog"><input type="checkbox" checked={ar.sol} onChange={(e) => setAr({ ...ar, sol: e.target.checked })} />bate sol da tarde</label>
        <div className="ape-pp-res"><b>{btu ? `${padrao.toLocaleString('pt-BR')} BTUs` : '—'}</b><span>{btu ? `cálculo: ${Math.round(btuFinal).toLocaleString('pt-BR')} BTUs · prefira inverter` : 'preencha a área'}</span></div>
      </section>
      <section className="ape-panel ape-pp-calc">
        <h3><ApeIcon name="bolt" />iluminação</h3>
        <div className="ape-frow">
          <div className="ape-f"><label>Área (m²)</label><input inputMode="decimal" value={lu.m2} onChange={(e) => setLu({ ...lu, m2: e.target.value })} /></div>
          <div className="ape-f"><label>Cômodo</label><select value={lu.tipo} onChange={(e) => setLu({ ...lu, tipo: e.target.value })}><option value="125">quarto</option><option value="175">sala e jantar</option><option value="275">cozinha</option><option value="225">banheiro</option><option value="200">área de serviço</option><option value="400">escritório</option></select></div>
        </div>
        <div className="ape-pp-res"><b>{lumens ? `${Math.round(lumens).toLocaleString('pt-BR')} lúmens` : '—'}</b><span>{lumens ? `≈ ${Math.ceil(lumens / 850)} lâmpadas LED de 9 W (850 lm) · ${lu.tipo === '275' || lu.tipo === '225' || lu.tipo === '200' || lu.tipo === '400' ? '4.000 K (neutra)' : '2.700 a 3.000 K (quente)'}` : 'preencha a área'}</span></div>
      </section>
      <p className="ape-note" style={{ margin: 0 }}>Contas práticas de referência. Para compra grande, confirme com o fornecedor.</p>
    </div>
  )
}

/* ---------- orçamentos que a pessoa recebeu (compara e, quando fecha, vira gasto) ---------- */
function Orcs({ lista, mudar, virarGasto }: { lista: PlatOrc[]; mudar: Mudar<PlatOrc>; virarGasto: (o: PlatOrc) => void }) {
  const [aberto, setAberto] = useState('')
  const set = (id: string, k: keyof PlatOrc, v: unknown) => mudar((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const servicos = [...new Set(lista.map((o) => o.servico.trim().toLowerCase() || 'sem serviço'))]
  const ST: Record<PlatOrc['status'], string> = { pedido: 'pedi', recebido: 'recebi', fechado: 'fechei', descartado: 'descartei' }
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">orçamentos</p><span className="ape-note">Anote cada orçamento que pediu e recebeu. O mais barato de cada serviço aparece marcado; quando fechar, ele vira gasto.</span></div>
        <button className="ape-btn primary sm" onClick={() => { const id = uid(); setAberto(id); mudar((l) => [{ id, servico: '', fornecedor: '', valor: null, status: 'pedido', tel: '', obs: '' }, ...l]) }}><ApeIcon name="plus" />orçamento</button>
      </div>
      {!lista.length && <div className="ape-empty"><ApeArt name="comparar" size={44} /><span>Piso, marcenaria, pedras… guarde os orçamentos aqui e veja qual sai mais em conta.</span></div>}
      {servicos.map((sv) => {
        const doSv = lista.filter((o) => (o.servico.trim().toLowerCase() || 'sem serviço') === sv)
        const validos = doSv.filter((o) => o.valor && o.status !== 'descartado')
        const menor = validos.length > 1 ? Math.min(...validos.map((o) => o.valor!)) : null
        return (
          <div key={sv} className="ape-plat-list">
            <h4 className="ape-acab-h"><ApeIcon name="tag" />{sv}<span>{doSv.length} orçamento{doSv.length > 1 ? 's' : ''}</span></h4>
            {doSv.map((o) => aberto !== o.id ? (
              <button key={o.id} className={`ape-pp-linha ${o.status === 'descartado' ? 'apagado' : ''}`} onClick={() => setAberto(o.id)}>
                <span className={`st ${o.status === 'fechado' ? 'pago' : ''}`} aria-hidden="true"><ApeIcon name={o.status === 'fechado' ? 'check' : 'file'} /></span>
                <span className="t"><b>{o.fornecedor || 'fornecedor sem nome'}{menor != null && o.valor === menor ? <em className="ape-pp-menor">mais barato</em> : null}</b><small>{ST[o.status]}{o.obs ? ` · ${o.obs}` : ''}</small></span>
                <span className="v ape-keep">{o.valor ? brl(o.valor) : '—'}</span>
                <ApeIcon name="chev" />
              </button>
            ) : (
              <div key={o.id} className="ape-plat-item aberto">
                <div className="ape-frow">
                  <div className="ape-f"><label>Serviço</label><input value={o.servico} onChange={(e) => set(o.id, 'servico', e.target.value)} placeholder="ex.: piso, pedras" /></div>
                  <div className="ape-f"><label>Fornecedor</label><input value={o.fornecedor} onChange={(e) => set(o.id, 'fornecedor', e.target.value)} /></div>
                </div>
                <div className="ape-frow ape-frow3">
                  <div className="ape-f"><label>Valor (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={o.valor ?? ''} onChange={(e) => set(o.id, 'valor', num(e.target.value))} /></div>
                  <div className="ape-f"><label>Situação</label><select value={o.status} onChange={(e) => set(o.id, 'status', e.target.value)}><option value="pedido">pedi</option><option value="recebido">recebi</option><option value="fechado">fechei</option><option value="descartado">descartei</option></select></div>
                  <div className="ape-f"><label><span className="ape-keep">WhatsApp</span></label><input inputMode="tel" value={o.tel} onChange={(e) => set(o.id, 'tel', e.target.value)} /></div>
                </div>
                <div className="ape-f"><label>Obs.</label><input value={o.obs} onChange={(e) => set(o.id, 'obs', e.target.value)} placeholder="o que inclui, prazo, garantia…" /></div>
                <div className="ape-acts ape-pp-item-acts">
                  <button className="ape-btn primary sm" onClick={() => setAberto('')}><ApeIcon name="check" />pronto</button>
                  {o.status !== 'fechado' && o.valor ? <button className="ape-btn sm" onClick={() => { set(o.id, 'status', 'fechado'); virarGasto(o); setAberto('') }}><ApeIcon name="star" />fechei com este</button> : null}
                  {waNum(o.tel) && <a className="ape-btn ghost sm" href={wa(waNum(o.tel), `Oi! Sobre o orçamento de ${o.servico}:`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" /></a>}
                  <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== o.id))} aria-label="Apagar"><ApeIcon name="trash" />apagar</button>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </section>
  )
}

/* ---------- contas da casa (quanto vai custar morar por mês) ---------- */
const CONTAS: [string, PlatConta['quando']][] = [['condomínio', 'mensal'], ['luz', 'mensal'], ['água', 'mensal'], ['gás', 'mensal'], ['internet', 'mensal'], ['IPTU', 'anual'], ['seguro residencial', 'anual']]
function Contas({ lista, mudar }: { lista: PlatConta[]; mudar: Mudar<PlatConta> }) {
  const set = (id: string, k: keyof PlatConta, v: unknown) => mudar((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const mes = lista.reduce((t, c) => t + (c.valor || 0) / (c.quando === 'anual' ? 12 : 1), 0)
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">contas da casa</p><span className="ape-note">Quanto vai custar morar, todo mês. As anuais (IPTU, seguro) entram divididas por 12.</span></div>
        <button className="ape-btn primary sm" onClick={() => mudar((l) => [...l, { id: uid(), nome: '', valor: null, quando: 'mensal', dia: null }])}><ApeIcon name="plus" />conta</button>
      </div>
      <div className="ape-pp-res"><b className="ape-keep">{brl(mes)} por mês</b><span className="ape-keep">{brl(mes * 12)} por ano</span></div>
      {!lista.length && <button className="ape-pp-sugestao" onClick={() => mudar(() => CONTAS.map(([nome, quando]) => ({ id: uid(), nome, valor: null, quando, dia: null })))}><ApeIcon name="sparkle" /><span><b>usar a lista das contas comuns</b><small>condomínio, luz, água, gás, internet, IPTU e seguro</small></span></button>}
      <div className="ape-pp-manut">
        {lista.map((c) => (
          <div key={c.id} className="ape-pp-conta">
            <input className="n" value={c.nome} onChange={(e) => set(c.id, 'nome', e.target.value)} placeholder="nome da conta" aria-label="Conta" />
            <input className="v" inputMode="decimal" value={c.valor ?? ''} onChange={(e) => set(c.id, 'valor', num(e.target.value))} placeholder="R$" aria-label="Valor" />
            <select value={c.quando} onChange={(e) => set(c.id, 'quando', e.target.value)} aria-label="Frequência"><option value="mensal">por mês</option><option value="anual">por ano</option></select>
            <input className="d" inputMode="numeric" value={c.dia ?? ''} onChange={(e) => set(c.id, 'dia', num(e.target.value))} placeholder="dia" aria-label="Dia do vencimento" />
            <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== c.id))} aria-label="Apagar"><ApeIcon name="trash" /></button>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- medidas do apê (piso, cortinas, móveis) ---------- */
const COMODOS_M = ['sala', 'cozinha', 'área de serviço', 'banheiro', 'quarto 1', 'quarto 2', 'varanda']
function Medidas({ lista, mudar }: { lista: PlatMedida[]; mudar: Mudar<PlatMedida> }) {
  const set = (id: string, k: keyof PlatMedida, v: unknown) => mudar((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const area = (m: PlatMedida) => (m.larg && m.comp ? m.larg * m.comp : 0)
  const total = lista.reduce((t, m) => t + area(m), 0)
  const f = (n: number) => n.toFixed(2).replace('.', ',')
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">medidas do apê</p><span className="ape-note">Meça uma vez e use em tudo: piso, rodapé, tinta, cortinas e móveis. Em metros (ex.: 3,15).</span></div>
        <button className="ape-btn primary sm" onClick={() => mudar((l) => [...l, { id: uid(), comodo: '', larg: null, comp: null, alt: 2.5, obs: '' }])}><ApeIcon name="plus" />cômodo</button>
      </div>
      {!lista.length && <button className="ape-pp-sugestao" onClick={() => mudar(() => COMODOS_M.map((comodo) => ({ id: uid(), comodo, larg: null, comp: null, alt: 2.5, obs: '' })))}><ApeIcon name="sparkle" /><span><b>começar com os cômodos de um apê</b><small>sala, cozinha, área de serviço, banheiro, 2 quartos e varanda</small></span></button>}
      {total > 0 && <div className="ape-pp-res"><b>{f(total)} m²</b><span>somando os cômodos medidos</span></div>}
      <div className="ape-pp-medidas">
        {lista.map((m) => (
          <div key={m.id} className="ape-pp-medida">
            <input className="n" value={m.comodo} onChange={(e) => set(m.id, 'comodo', e.target.value)} placeholder="cômodo" aria-label="Cômodo" />
            <label><small>largura</small><input inputMode="decimal" defaultValue={m.larg != null ? String(m.larg).replace('.', ',') : ''} onBlur={(e) => set(m.id, 'larg', num(e.target.value))} /></label>
            <label><small>comprimento</small><input inputMode="decimal" defaultValue={m.comp != null ? String(m.comp).replace('.', ',') : ''} onBlur={(e) => set(m.id, 'comp', num(e.target.value))} /></label>
            <label><small>pé-direito</small><input inputMode="decimal" defaultValue={m.alt != null ? String(m.alt).replace('.', ',') : ''} onBlur={(e) => set(m.id, 'alt', num(e.target.value))} /></label>
            <span className="r">{area(m) ? <><b>{f(area(m))} m²</b><small>perímetro {f(2 * ((m.larg || 0) + (m.comp || 0)))} m</small></> : <small>—</small>}</span>
            <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== m.id))} aria-label="Apagar"><ApeIcon name="trash" /></button>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- compras da casa (enxoval e itens para morar) ---------- */
const COMPRAS: [string, string, PlatCompra['prio']][] = [
  ['cozinha', 'jogo de panelas', 'essencial'], ['cozinha', 'pratos, copos e talheres', 'essencial'], ['cozinha', 'micro-ondas', 'logo'], ['cozinha', 'liquidificador', 'pode esperar'],
  ['área de serviço', 'vassoura, rodo e balde', 'essencial'], ['área de serviço', 'varal', 'essencial'], ['área de serviço', 'ferro de passar', 'logo'],
  ['banheiro', 'toalhas', 'essencial'], ['banheiro', 'tapete e lixeira', 'essencial'], ['banheiro', 'organizadores', 'pode esperar'],
  ['quarto', 'colchão e travesseiros', 'essencial'], ['quarto', 'jogo de cama', 'essencial'], ['quarto', 'cortina blackout', 'logo'],
  ['sala', 'roteador de internet', 'essencial'], ['sala', 'cortina', 'logo'], ['sala', 'tapete', 'pode esperar'], ['geral', 'kit de ferramentas', 'logo'], ['geral', 'lâmpadas', 'essencial'],
]
function Compras({ lista, mudar }: { lista: PlatCompra[]; mudar: Mudar<PlatCompra> }) {
  const set = (id: string, k: keyof PlatCompra, v: unknown) => mudar((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const [filtro, setFiltro] = useState<'todas' | PlatCompra['prio']>('todas')
  const feitas = lista.filter((c) => c.comprado).length
  const falta = lista.filter((c) => !c.comprado).reduce((t, c) => t + (c.preco || 0), 0)
  const vis = lista.filter((c) => filtro === 'todas' || c.prio === filtro)
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">compras da casa</p><span className="ape-note ape-keep">{feitas} de {lista.length} comprados · faltam {brl(falta)}</span></div>
        <button className="ape-btn primary sm" onClick={() => mudar((l) => [{ id: uid(), comodo: 'geral', item: '', prio: 'logo', preco: null, comprado: false, onde: '' }, ...l])}><ApeIcon name="plus" />item</button>
      </div>
      <div className="ape-bar"><i style={{ width: `${lista.length ? (feitas / lista.length) * 100 : 0}%` }} /></div>
      {!lista.length && <button className="ape-pp-sugestao" onClick={() => mudar(() => COMPRAS.map(([comodo, item, prio]) => ({ id: uid(), comodo, item, prio, preco: null, comprado: false, onde: '' })))}><ApeIcon name="sparkle" /><span><b>usar a lista pronta do enxoval</b><small>{COMPRAS.length} itens com prioridade: essencial, logo e pode esperar</small></span></button>}
      {lista.length > 0 && (
        <div className="ape-chips" role="group" aria-label="Prioridade">
          {(['todas', 'essencial', 'logo', 'pode esperar'] as const).map((x) => <button key={x} className="ape-chip" aria-pressed={filtro === x} onClick={() => setFiltro(x)}>{x}</button>)}
        </div>
      )}
      <div className="ape-pp-check">
        {vis.map((c) => (
          <div key={c.id} className={`ape-pp-doc ${c.comprado ? 'ok' : ''}`}>
            <label className="ck"><input type="checkbox" checked={c.comprado} onChange={(e) => set(c.id, 'comprado', e.target.checked)} /><span className="box"><ApeIcon name="check" /></span></label>
            <div className="t">
              <input value={c.item} onChange={(e) => set(c.id, 'item', e.target.value)} placeholder="item" aria-label="Item" />
              <span className="ape-pp-sub"><span className={`ape-pp-prio p-${c.prio.replace(' ', '-')}`}>{c.prio}</span>{c.comodo}</span>
            </div>
            <input className="ape-pp-preco" inputMode="decimal" value={c.preco ?? ''} onChange={(e) => set(c.id, 'preco', num(e.target.value))} placeholder="R$" aria-label="Preço" />
            <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== c.id))} aria-label="Apagar"><ApeIcon name="trash" /></button>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- mudança, semana a semana ---------- */
const MUDANCA: [string, string[]][] = [
  ['30 dias antes', ['orçar 3 empresas de mudança', 'agendar o elevador e o horário com o condomínio', 'pedir a ligação de luz, água, gás e internet', 'separar o que vai doar ou vender']],
  ['15 dias antes', ['comprar caixas, fita e plástico bolha', 'começar a embalar o que não usa no dia a dia', 'trocar o endereço no banco e nas compras online']],
  ['7 dias antes', ['confirmar a empresa e o horário', 'descongelar a geladeira (um dia antes)', 'separar a caixa do primeiro dia']],
  ['no dia', ['conferir a lista de volumes', 'anotar a leitura dos medidores', 'proteger piso e portas do apê novo']],
  ['depois', ['montar a cama e organizar a cozinha primeiro', 'conferir se não faltou nada', 'trocar o endereço nos documentos']],
]
function Mudanca({ lista, entrega, mudar }: { lista: PlatTarefa[]; entrega: string; mudar: Mudar<PlatTarefa> }) {
  const set = (id: string, v: boolean) => mudar((l) => l.map((x) => (x.id === id ? { ...x, feito: v } : x)))
  const feitas = lista.filter((t) => t.feito).length
  const fases = [...new Set(lista.map((t) => t.fase))]
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">mudança</p><span className="ape-note">{lista.length ? `${feitas} de ${lista.length} feitas` : 'O passo a passo da mudança, para nada ficar para trás.'}{entrega ? ` · chaves em ${dmy(entrega)}` : ''}</span></div>
        {lista.length > 0 && <button className="ape-btn primary sm" onClick={() => { const item = prompt('O que fazer?')?.trim(); if (item) mudar((l) => [...l, { id: uid(), fase: 'depois', item, feito: false }]) }}><ApeIcon name="plus" />tarefa</button>}
      </div>
      {!lista.length && <button className="ape-pp-sugestao" onClick={() => mudar(() => MUDANCA.flatMap(([fase, itens]) => itens.map((item) => ({ id: uid(), fase, item, feito: false }))))}><ApeIcon name="sparkle" /><span><b>usar o passo a passo da mudança</b><small>do mês antes até depois de morar, em {MUDANCA.reduce((t, m) => t + m[1].length, 0)} tarefas</small></span></button>}
      {lista.length > 0 && <div className="ape-bar"><i style={{ width: `${(feitas / lista.length) * 100}%` }} /></div>}
      {fases.map((f) => (
        <div key={f} className="ape-pp-check">
          <h4 className="ape-acab-h"><ApeIcon name="clock" />{f}</h4>
          {lista.filter((t) => t.fase === f).map((t) => (
            <label key={t.id}>
              <input type="checkbox" checked={t.feito} onChange={(e) => set(t.id, e.target.checked)} />
              <span className="box"><ApeIcon name="check" /></span>
              <span className="t"><b style={t.feito ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{t.item}</b></span>
            </label>
          ))}
        </div>
      ))}
    </section>
  )
}
