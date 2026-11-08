import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { askGemini, readFile, type Attachment } from '../components/AIChat'
import { ask, toast } from '../components/dialog'
import { href } from '../router'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { BrandMark } from '../components/PlaneMark'
import { AvatarGlyph } from '../components/Avatar'
import { PLATFORM } from '../plans'
import { admin, apeCloud, loja, painelConta, type Ajustes, type PedidoAdmin, type PlatAdmin, type Vendedor } from './api'
import { ApeIcon } from './ApeIcon'
import { emailOk, Recolhe } from './shared'
import { SanLeviArte } from './SanLevi'
import {
  APE, BONUS, SELOS, GRUPO_META, ehOrcamento, PIX_PCT, JUROS_PCT, parcelas, plantaDoAp, acabamentoDe, type Planta, TAXAS, comPrecos, liquido, noCarrinho, reais, type Taxas, FIELDS, LOJA_VERSAO, NICHOS, PRODUTOS, aiPrompt, blankOrcamento, brl, calc, cleanOrcamento, dmy, firstName, fmtTel, nicho, num, parseJsonReply, wa, waNum,
  CATEGORIAS, digits, ehSanLevi, ondeMora, type Categoria, type Envio, type Interesse, type Morador, type Orcamento, type Produto,
} from './model'
import './ape.css'

/* Painel do planê.apê (só a dona): orçamentos que chegaram dos moradores, leitura com IA,
   publicar/editar/ocultar, moradores cadastrados, quem quer cada compra em grupo e a loja. */

type Tab = 'inicio' | 'recebidos' | 'novo' | 'lista' | 'moradores' | 'grupos' | 'loja' | 'pedidos' | 'leads' | 'clientes' | 'entregas' | 'testar' | 'opiniao'
interface Draft {
  o: Orcamento
  novo: boolean
  ia: boolean
  envio?: string // id do envio que virou este orçamento
}

export default function ApeAdmin({ dark = false, setDark }: { dark?: boolean; setDark?: (d: boolean) => void } = {}) {
  const { data } = useStore()
  const aiKey = data.settings.aiKey || ''
  const [tab, setTab] = useState<Tab>('inicio')
  const [orcs, setOrcs] = useState<Orcamento[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [moradores, setMoradores] = useState<Morador[]>([])
  const [interesses, setInteresses] = useState<Interesse[]>([])
  const [escolhas, setEscolhas] = useState<{ orcamento: string; nicho: string; morador: Morador | null }[]>([])
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([])
  const [ajustes, setAjustes] = useState<Ajustes | null>(null)
  const [erro, setErro] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)

  const [menu, setMenu] = useState(false)
  const load = useCallback(async () => {
    try {
      const [o, e, m, i, a, es, pe] = await Promise.all([admin.orcamentos(), admin.envios(), admin.moradores(), admin.interesses(), admin.ajustes(), admin.escolhas(), loja.pedidos().catch(() => [] as PedidoAdmin[])])
      setEscolhas(es)
      setPedidos(pe)
      setOrcs(o)
      setEnvios(e)
      setMoradores(m)
      setInteresses(i)
      setAjustes(a)
      setErro('')
      window.dispatchEvent(new Event('ape-envios-mudou'))
    } catch (e) {
      setErro(String((e as Error).message || e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const novos = envios.filter((e) => e.status === 'novo').length
  const edit = (o: Orcamento) => {
    setDraft({ o: { ...o }, novo: false, ia: false })
    setTab('novo')
  }

  const nCancel = pedidos.filter((p) => p.cancelamento?.status === 'pedido' && p.status === 'pago').length
  const abandonados = carrinhosAbandonados(pedidos)
  // mesmos ícones do planê arquitetura
  const ITENS: Record<Tab, [string, string, number?]> = {
    inicio: ['início', 'home'], moradores: ['moradores', 'users', moradores.filter((m) => ehSanLevi(m) && !m.aprovado).length], lista: ['orçamentos', 'file', novos], recebidos: ['enviados', 'inbox', novos], novo: [draft && !draft.novo ? 'editar' : 'adicionar', 'plus'], grupos: ['fechar em grupo', 'target'],
    pedidos: ['vendas', 'wallet', nCancel], leads: ['carrinhos abandonados', 'bell', abandonados.length], clientes: ['clientes', 'user'], loja: ['produtos e preços', 'box'], entregas: ['arquivos', 'download'], opiniao: ['depoimentos', 'star'], testar: ['ver como cliente', 'eye'],
  }
  // menu enxuto: cada item abre uma tela; telas parecidas ficam juntas, em abas dentro dela
  const JUNTOS: Partial<Record<Tab, Tab[]>> = { lista: ['lista', 'recebidos', 'novo'], pedidos: ['pedidos', 'leads'] }
  const grupoDe = (k: Tab) => (Object.entries(JUNTOS).find(([, l]) => l!.includes(k))?.[0] as Tab | undefined) || k
  // do mais usado para o menos usado: vendas no dia a dia, depois o San Levi, depois a vitrine (muda pouco)
  const GRUPOS_MENU: [string, Tab[]][] = [['', ['inicio']], ['vendas', ['pedidos', 'clientes']], [APE.condominio, ['lista', 'moradores', 'grupos']], ['vitrine da loja', ['loja', 'entregas', 'opiniao']]]
  const atual = ITENS[tab]
  const ir = (k: Tab) => { setTab(k); setMenu(false); window.scrollTo(0, 0) }
  const minhaPlat = (() => { try { return JSON.parse(localStorage.getItem('ape-plat') || 'null') as string | null } catch { return null } })()
  const trocarFoto = async (f?: File) => {
    if (!f || !ajustes) return
    try {
      const url = await loja.fotoPublica('painel', f)
      const a = { ...ajustes, fotoPainel: url }
      await admin.salvarAjustes(a)
      setAjustes(a)
      toast('Foto do painel trocada.')
    } catch (e) {
      toast(`Não consegui trocar a foto (${(e as Error).message}).`)
    }
  }
  const copiar = async (u: string, d: string) => {
    try {
      await navigator.clipboard.writeText(u)
      toast(`Copiado: ${u.replace('https://', '')} (${d}).`)
    } catch {
      toast(u.replace('https://', ''))
    }
  }
  const link = (k: Tab) => (
    <a key={k} href={href('ape-admin')} className={grupoDe(tab) === k ? 'active' : ''} onClick={(e) => { e.preventDefault(); ir(k) }}>
      <Icon name={ITENS[k][1]} />
      <span>{ITENS[k][0]}</span>
      {ITENS[k][2] ? <em className="nav-alert">{ITENS[k][2]}</em> : null}
    </a>
  )
  return (
    <div className={`ape ape-shell app ape-adm-app ${menu ? "menu-open" : ""}`} data-tema={dark ? "escuro" : "claro"}>
      <aside className="sidebar">
        <a className="platform-mark" href={href('inicio')} aria-label="planê">
          <BrandMark place="menu" size={34} />
          {PLATFORM.name}
        </a>
        <div className="brand ape-adm-brand" title="planê.apê: painel">
          <label className="brand-photo ape-adm-foto" title="Trocar a foto do painel">
            {ajustes?.fotoPainel ? <img src={ajustes.fotoPainel} alt="" /> : <SanLeviArte size={46} />}
            <input type="file" accept="image/*" hidden onChange={(e) => void trocarFoto(e.target.files?.[0])} />
          </label>
          <span className="brand-text">
            <span className="brand-kicker">painel da loja</span>
            <span className="brand-name">planê.apê<i>.</i></span>
          </span>
        </div>
        <nav>
          {GRUPOS_MENU.map(([g, tabs]) => (
            <Fragment key={g || 'inicio'}>
              {g && <span className="nav-group-label nav-main-label ape-adm-gl">{g}</span>}
              {tabs.map(link)}
            </Fragment>
          ))}
          <div className="nav-group is-plataforma">
            <span className="nav-group-label">ver e testar</span>
            <a href={href('ape-admin')} className={`is-tool ${tab === 'testar' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); ir('testar') }} title="Ver tudo como cliente, com tudo liberado"><Icon name="eye" /><span>ver como cliente</span></a>
            <a className="is-tool" href={href('ape', `minha:${minhaPlat || 'demo'}`)} target="_blank" rel="noreferrer" title="Abrir a plataforma do apê que você vende"><Icon name="smartphone" /><span>plataforma do apê</span></a>
            <a className="is-tool" href={href('ape', 'loja')} target="_blank" rel="noreferrer" title="Página de vendas (como os visitantes veem)"><Icon name="link" /><span>página da loja</span></a>
            <a className="is-tool" href={href('ape')} target="_blank" rel="noreferrer" title="Página dos moradores do San Levi"><Icon name="users" /><span>página dos moradores</span></a>
          </div>
        </nav>
        <a href={href('perfil')} className="profile-chip" title="Perfil do estúdio e conta">
          <span className="profile-chip-avatar"><AvatarGlyph s={data.settings} size={18} /></span>
          <span className="grow">
            <b>{data.settings.ownerName || data.settings.brandName || 'meu perfil'}</b>
            <small>dona do planê.apê</small>
          </span>
        </a>
        <div className="sidebar-foot">
          <a className="icon-btn ape-adm-voltaico" href={href('inicio')} title="Voltar para o planê arquitetura" aria-label="Voltar para o planê arquitetura"><Icon name="chevronL" /><span>planê arq.</span></a>
          {setDark && <button className="icon-btn" onClick={() => setDark(!dark)} title="Tema claro/escuro (só neste aparelho)"><Icon name={dark ? 'sun' : 'moon'} /></button>}
          <button className="icon-btn" onClick={() => void copiar('https://useplane.com.br/ape/sanlevi/', 'link dos moradores')} title="Copiar o link dos moradores" aria-label="Copiar o link dos moradores"><Icon name="link" /></button>
          <button className="icon-btn" onClick={() => void copiar('https://useplane.com.br/ape/', 'link da loja')} title="Copiar o link da loja" aria-label="Copiar o link da loja"><Icon name="copy" /></button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setMenu(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setMenu(true)} aria-label="Menu"><Icon name="menu" /></button>
          <button className="back-btn" onClick={() => (tab !== 'inicio' ? ir('inicio') : (window.location.hash = '#/inicio'))} aria-label="Voltar" title={tab !== 'inicio' ? 'Voltar para o início do painel' : 'Voltar para o planê'}>
            <Icon name="chevronL" size={18} />
            <span className="hide-mobile">voltar</span>
          </button>
          <div className="ape-adm-titulo"><Icon name={atual[1]} /><b>{atual[0]}</b></div>
          <a className="btn hide-mobile" href={href('ape', `minha:${minhaPlat || 'demo'}`)} target="_blank" rel="noreferrer"><Icon name="smartphone" size={16} /> plataforma</a>
          <button className="btn primary" onClick={() => ir('testar')}><Icon name="eye" size={16} /> <span className="hide-mobile">ver como cliente</span></button>
        </header>
        <main className="content">
          <div className="page">
            <div className="ape ape-admin ape-adm-conteudo">
              {erro && (
                <div className="ape-banner warn">
                  Não consegui ler os dados do {APE.name} ({erro}). Confira se o arquivo <b>supabase/ape.sql</b> já foi rodado no Supabase.
                </div>
              )}
              {!apeCloud && <div className="ape-banner">Prévia: tudo fica só neste navegador.</div>}
              {JUNTOS[grupoDe(tab)] && (
                <div className="ape-atabs ape-adm-sub" role="tablist">
                  {JUNTOS[grupoDe(tab)]!.map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => ir(k)}><Icon name={ITENS[k][1]} size={15} />{ITENS[k][0]}{ITENS[k][2] ? <em>{ITENS[k][2]}</em> : null}</button>)}
                </div>
              )}
          <div className="ape-panel ape-adm-corpo">
          {tab === 'inicio' && <Inicio moradores={moradores} orcs={orcs} pedidos={pedidos} envios={envios} interesses={interesses} ir={setTab} />}
          {tab === 'recebidos' && (
            <Recebidos
              envios={envios}
              aiKey={aiKey}
              onDraft={(d) => {
                setDraft(d)
                setTab('novo')
              }}
              onChange={load}
            />
          )}
          {tab === 'novo' &&
            (draft ? (
              <Editor
                draft={draft}
                onCancel={() => setDraft(null)}
                onSaved={async () => {
                  setDraft(null)
                  await load()
                  setTab('lista')
                }}
              />
            ) : (
              <Novo aiKey={aiKey} onDraft={setDraft} />
            ))}
          {tab === 'lista' && <Lista orcs={orcs} interesses={interesses} onEdit={edit} onChange={load} />}
          {tab === 'moradores' && <Moradores moradores={moradores} envios={envios} interesses={interesses} orcs={orcs} escolhas={escolhas} pedidos={pedidos} onChange={load} />}
          {tab === 'grupos' && <Grupos orcs={orcs} interesses={interesses} onSaved={load} />}
          {tab === 'loja' && ajustes && <Loja ajustes={ajustes} onSaved={setAjustes} />}
          {tab === 'pedidos' && <Vendas pedidos={pedidos} onChange={load} />}
          {tab === 'leads' && <Leads lista={abandonados} />}
          {tab === 'clientes' && ajustes && <Clientes pedidos={pedidos} produtos={ajustes.produtos} onChange={load} />}
          {tab === 'entregas' && ajustes && <Entregas produtos={ajustes.produtos} />}
          {tab === 'opiniao' && <Opinioes />}
          {tab === 'testar' && ajustes && <Testar produtos={ajustes.produtos} pedidos={pedidos} onChange={load} />}
          </div>
            </div>
          </div>
        </main>
      </div>
      <nav className="bottom-nav">
        {(['inicio', 'pedidos', 'lista', 'moradores', 'testar'] as Tab[]).map((k) => (
          <a key={k} href={href('ape-admin')} className={grupoDe(tab) === k ? 'active' : ''} onClick={(e) => { e.preventDefault(); ir(k) }}>
            <Icon name={ITENS[k][1]} />
            <span>{k === 'testar' ? 'cliente' : ITENS[k][0].split(' ')[0]}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}

/* ===== início do painel: o que precisa da sua atenção e os números principais ===== */
function Inicio({ moradores, orcs, pedidos, envios, interesses, ir }: { moradores: Morador[]; orcs: Orcamento[]; pedidos: PedidoAdmin[]; envios: Envio[]; interesses: Interesse[]; ir: (t: Tab) => void }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const metas = orcs.filter((o) => ehOrcamento(o) && !(num(o.grupo_pct) && (!o.grupo_ate || o.grupo_ate >= hoje)) && interesses.filter((i) => i.orcamento === o.id).length + (num(o.interessados) || 0) >= (num(o.grupo_min) || GRUPO_META)).length
  const sl = moradores.filter(ehSanLevi)
  const aguardando = sl.filter((m) => !m.aprovado).length
  const cancel = pedidos.filter((p) => p.cancelamento?.status === 'pedido' && p.status === 'pago').length
  const mes = new Date().toISOString().slice(0, 7)
  const vendasMes = pedidos.filter((p) => p.status === 'pago' && !p.cortesia && (p.pago_em || p.criado).slice(0, 7) === mes)
  const semana = Date.now() - 7 * 864e5
  const novos = sl.filter((m) => m.criado && new Date(m.criado).getTime() > semana).length
  const novosOrc = envios.filter((e) => new Date(e.criado).getTime() > semana).length
  const pend: [string, string, Tab][] = [
    ...(cancel ? [[`${cancel} pedido(s) de cancelamento para decidir`, 'abrir vendas', 'pedidos'] as [string, string, Tab]] : []),
    ...(aguardando ? [[`${aguardando} cadastro(s) do ${APE.condominio} aguardando aprovação`, 'abrir cadastros', 'moradores'] as [string, string, Tab]] : []),
    ...(metas ? [[`${metas} grupo(s) bateram a meta: negocie com o fornecedor`, 'abrir grupos', 'grupos'] as [string, string, Tab]] : []),
  ]
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="ape-adm-pend">
        <p className="ape-eyebrow">precisa de você</p>
        {pend.length ? pend.map(([t, b, k]) => (
          <div key={t} className="ape-adm-pend-i"><ApeIcon name="alert" /><span>{t}</span><button className="ape-btn primary sm" onClick={() => ir(k)}>{b}</button></div>
        )) : <p className="ape-note" style={{ margin: 0 }}><ApeIcon name="check" /> Nada pendente agora.</p>}
      </div>
      <div className="ape-adm-cards">
        <button onClick={() => ir('moradores')}><span><ApeIcon name="users" />moradores</span><b className="num">{sl.length}</b><small>{novos} novo(s) nesta semana · {new Set(sl.filter((m) => m.torre && m.ap).map((m) => `${m.torre}|${m.ap}`)).size} apês</small></button>
        <button onClick={() => ir('lista')}><span><ApeIcon name="list" />orçamentos na área</span><b className="num">{orcs.filter((o) => !o.oculto && !o.exemplo).length}</b><small>{novosOrc} enviado(s) nesta semana</small></button>
        <button onClick={() => ir('pedidos')}><span><ApeIcon name="bag" />vendas no mês</span><b className="num ape-keep">{brl(vendasMes.reduce((t, p) => t + p.total, 0))}</b><small>{vendasMes.length} venda(s)</small></button>
        <button onClick={() => ir('clientes')}><span><ApeIcon name="user" />clientes da loja</span><b className="num">{new Set(pedidos.filter((p) => p.status === 'pago').map((p) => p.cpf || p.email)).size}</b><small>quem já comprou</small></button>
      </div>
      <div className="ape-adm-atalhos">
        <p className="ape-eyebrow">atalhos</p>
        <button className="ape-btn sm" onClick={() => ir('novo')}><ApeIcon name="plus" />adicionar orçamento</button>
        <button className="ape-btn sm" onClick={() => ir('loja')}><ApeIcon name="tag" />mudar preços e foto de projetos</button>
        <button className="ape-btn sm" onClick={() => ir('entregas')}><ApeIcon name="file" />arquivos da loja</button>
        <button className="ape-btn sm" onClick={() => ir('testar')}><ApeIcon name="eye" />ver como cliente</button>
      </div>
    </div>
  )
}

/* ===== leitura com IA (Gemini, com a chave da dona) ===== */
async function lerComIA(aiKey: string, texto: string, files: Attachment[]): Promise<Orcamento> {
  const reply = await askGemini(aiKey, 'Você extrai dados de orçamentos e responde só com JSON válido.', [{ role: 'user', text: aiPrompt(texto.slice(0, 40000)), files }])
  const raw = parseJsonReply(reply)
  if (!raw) throw new Error('A leitura veio incompleta. Tente de novo ou preencha à mão.')
  return cleanOrcamento(raw, { interessados: 0 })
}
const semChave = () => toast('Para ler com IA, coloque sua chave do Gemini em configurações → assistente.')

function Thinking({ t }: { t: string }) {
  return (
    <div className="ape-thinking">
      <span className="ape-dots"><i /><i /><i /></span>
      {t}
    </div>
  )
}

function Recebidos({ envios, aiKey, onDraft, onChange }: { envios: Envio[]; aiKey: string; onDraft: (d: Draft) => void; onChange: () => void }) {
  const [busy, setBusy] = useState('')
  const [ver, setVer] = useState<'novo' | 'todos'>('todos')
  const list = envios.filter((e) => ver === 'todos' || e.status === 'novo')

  const baixar = async (e: Envio) => {
    const out: File[] = []
    for (const a of e.arquivos) {
      const b = await admin.arquivo(a)
      if (b) out.push(new File([b], a.nome, { type: a.tipo || b.type }))
    }
    return out
  }
  const abrir = async (e: Envio, i: number) => {
    try {
      const b = await admin.arquivo(e.arquivos[i])
      if (!b) return toast('Na prévia os arquivos não ficam guardados.')
      const url = URL.createObjectURL(b)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast('Não consegui abrir o arquivo.')
    }
  }
  const ler = async (e: Envio) => {
    if (!aiKey) return semChave()
    setBusy(e.id)
    try {
      const files = await Promise.all((await baixar(e)).map(readFile))
      const o = await lerComIA(aiKey, [e.fornecedor && `Fornecedor: ${e.fornecedor}`, e.texto].filter(Boolean).join('\n'), files)
      if (e.nicho && NICHOS.some((n) => n[0] === e.nicho) && o.nicho === 'outros') o.nicho = e.nicho as Orcamento['nicho']
      onDraft({ o, novo: true, ia: true, envio: e.id })
    } catch (err) {
      toast(String((err as Error).message || err))
    }
    setBusy('')
  }
  const manual = (e: Envio) =>
    onDraft({ o: blankOrcamento({ fornecedor: e.fornecedor, nicho: (NICHOS.find((n) => n[0] === e.nicho)?.[0] ?? 'outros'), resumo: '' }), novo: true, ia: false, envio: e.id })
  const descartar = async (e: Envio) => {
    if (!(await ask('Marcar este envio como descartado? Ele continua guardado em "todos".', { confirmLabel: 'descartar' }))) return
    await admin.marcarEnvio(e.id, 'descartado').catch(() => toast('Não consegui salvar.'))
    onChange()
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="ape-toolbar">
        <p className="ape-note" style={{ margin: 0, flex: 1 }}>Orçamentos que os moradores mandaram pela página. Leia com IA, confira e publique.</p>
        <select className="ape-sel" value={ver} onChange={(e) => setVer(e.target.value as 'novo' | 'todos')} aria-label="Mostrar">
          <option value="novo">só os novos</option>
          <option value="todos">todos</option>
        </select>
      </div>
      {!list.length && (
        <div className="ape-empty">
          <b>Nada novo por aqui</b>
          <span>Quando um morador mandar um orçamento pela página, ele aparece nesta lista.</span>
        </div>
      )}
      {list.map((e) => (
        <article key={e.id} className={`ape-envio ${e.status !== 'novo' ? 'lido' : ''}`}>
          <div className="ape-row" style={{ padding: 0, border: 0 }}>
            <div className="t">
              <b>
                {e.fornecedor || 'Fornecedor não informado'} · {e.nicho ? nicho(e.nicho).l : 'serviço não informado'}
              </b>
              <span>
                {e.morador ? `${e.morador.nome} · ${ondeMora(e.morador) || 'sem endereço'} · ${fmtTel(e.morador.tel)}` : 'cadastro removido'} · {dmy(e.criado)}
                {e.status !== 'novo' ? ` · ${e.status}` : ''}
              </span>
            </div>
            <div className="r">
              {e.morador && waNum(e.morador.tel) && (
                <a className="ape-btn sm" href={wa(waNum(e.morador.tel), `Oi, ${firstName(e.morador.nome)}! Aqui é a ${APE.dona}, do ${APE.doApe}. Recebi seu orçamento${e.fornecedor ? ` da ${e.fornecedor}` : ''} 😊`)} target="_blank" rel="noreferrer">
                  <ApeIcon name="chat" />WhatsApp
                </a>
              )}
            </div>
          </div>
          {e.texto && <pre>{e.texto}</pre>}
          {e.arquivos.length > 0 && (
            <div className="ape-files">
              {e.arquivos.map((a, i) => (
                <button key={i} className="ape-pill" onClick={() => void abrir(e, i)} style={{ border: 0 }}>
                  <ApeIcon name="file" />{a.nome}
                </button>
              ))}
            </div>
          )}
          {busy === e.id ? (
            <Thinking t="Lendo o orçamento… isso leva uns segundos" />
          ) : (
            <div className="ape-acts">
              <button className="ape-btn primary sm" onClick={() => void ler(e)} disabled={!!busy}>
                <ApeIcon name="sparkle" />Ler com IA
              </button>
              <button className="ape-btn sm" onClick={() => manual(e)}>
                <ApeIcon name="edit" />Preencher à mão
              </button>
              {e.status === 'novo' && (
                <button className="ape-btn ghost sm" onClick={() => void descartar(e)}>
                  <ApeIcon name="x" />Descartar
                </button>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

function Novo({ aiKey, onDraft }: { aiKey: string; onDraft: (d: Draft) => void }) {
  const [txt, setTxt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ler = async () => {
    setErr('')
    if (!txt.trim() && !files.length) return setErr('Cole o texto ou anexe um arquivo.')
    if (!aiKey) return semChave()
    setBusy(true)
    try {
      onDraft({ o: await lerComIA(aiKey, txt, await Promise.all(files.slice(0, 6).map(readFile))), novo: true, ia: true })
    } catch (e) {
      setErr(String((e as Error).message || e))
    }
    setBusy(false)
  }
  return (
    <div className="ape-form">
      <div>
        <p className="ape-eyebrow"><ApeIcon name="sparkle" />Ler orçamento automaticamente</p>
        <p className="ape-note" style={{ margin: '4px 0 0' }}>Chegou por fora (WhatsApp, e-mail)? Cole o texto ou anexe o PDF e os prints. A IA lê, preenche tudo e você só confere.</p>
      </div>
      <div className="ape-f">
        <label htmlFor="a-txt">Texto do orçamento</label>
        <textarea id="a-txt" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Cole aqui a mensagem do morador ou do fornecedor" />
      </div>
      <div className="ape-drop">
        <label htmlFor="a-files" className="ape-eyebrow"><ApeIcon name="clip" />PDF ou prints</label>
        <input id="a-files" type="file" multiple accept="application/pdf,image/*" onChange={(e) => setFiles([...(e.target.files || [])])} />
        <span className="ape-note">Até 6 arquivos por orçamento.</span>
      </div>
      {err && <p className="ape-err">{err}</p>}
      {busy ? (
        <Thinking t="Organizando o orçamento… isso leva uns segundos" />
      ) : (
        <div className="ape-acts">
          <button className="ape-btn primary" onClick={() => void ler()}>
            <ApeIcon name="sparkle" />Ler e organizar
          </button>
          <button className="ape-btn" onClick={() => onDraft({ o: blankOrcamento(), novo: true, ia: false })}>
            <ApeIcon name="edit" />Preencher à mão
          </button>
        </div>
      )}
    </div>
  )
}

const asText = (v: unknown, t: string) => (v == null ? '' : t === 'lines' ? (v as string[]).join('\n') : t === 'num' ? String(v).replace('.', ',') : t === 'bool' ? (v === true ? 'sim' : v === false ? 'nao' : '') : String(v))

function Editor({ draft, onCancel, onSaved }: { draft: Draft; onCancel: () => void; onSaved: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map(([k, , t]) => [k, asText(draft.o[k], t)])))
  const [busy, setBusy] = useState(false)
  const [planta, setPlanta] = useState<Planta>(draft.o.planta || plantaDoAp(draft.o.ap))
  const [acab, setAcab] = useState(draft.o.acabamento || '')
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }))
  const build = (patch: Partial<Orcamento> = {}): Orcamento => {
    const o = { ...draft.o } as unknown as Record<string, unknown>
    for (const [k, , t] of FIELDS) {
      const v = (vals[k] ?? '').trim()
      o[k] = t === 'num' ? num(v) : t === 'bool' ? (v === 'sim' ? true : v === 'nao' ? false : null) : t === 'lines' ? v.split('\n').map((s) => s.trim()).filter(Boolean) : v
    }
    return { ...(o as unknown as Orcamento), planta, acabamento: acab.trim(), ...patch }
  }
  const save = async (patch: Partial<Orcamento> = {}, msg = draft.novo ? 'Publicado na página.' : 'Alterações salvas.') => {
    const o = build(patch)
    if (!o.fornecedor) return toast('Coloque o nome do fornecedor.')
    setBusy(true)
    try {
      await admin.salvar(o)
      if (draft.envio) await admin.marcarEnvio(draft.envio, 'publicado', o.id)
      toast(msg)
      onSaved()
    } catch (e) {
      toast(`Não consegui salvar (${(e as Error).message}).`)
    }
    setBusy(false)
  }
  const remover = async () => {
    if (!(await ask(`Remover o orçamento da ${draft.o.fornecedor} da página?`, { confirmLabel: 'remover', danger: true }))) return
    await admin.remover([draft.o.id]).then(() => {
      toast('Removido.')
      onSaved()
    }, () => toast('Não consegui remover.'))
  }

  return (
    <div className="ape-form">
      <div className="ape-banner">{draft.ia ? 'Confira o que a IA leu e corrija o que precisar antes de publicar.' : 'Preencha o que tiver e publique.'}</div>
      <fieldset className="ape-ed-bloco c3"><legend><ApeIcon name="file" />o orçamento</legend>
      <div className="ape-ed-grid">
        {(['fornecedor', 'nicho', 'servico'] as (keyof Orcamento)[]).map((k) => {
          const f = FIELDS.find((x) => x[0] === k)!
          const id = `d-${k}`
          const v = vals[k] ?? ''
          return f[2] === 'nicho'
            ? <div key={k} className="ape-f"><label htmlFor={id}>{f[1]}</label><select id={id} value={v} onChange={(e) => set(k, e.target.value)}>{NICHOS.map((n) => <option key={n[0]} value={n[0]}>{n[1]}</option>)}</select></div>
            : <div key={k} className="ape-f"><label htmlFor={id}>{f[1]}</label><input id={id} value={v} onChange={(e) => set(k, e.target.value)} /></div>
        })}
        <div className="ape-f">
          <label htmlFor="d-planta">Planta</label>
          <select id="d-planta" value={planta} onChange={(e) => setPlanta(e.target.value as Planta)}>
            <option value="">Não informada</option>
            <option value="canto">Canto (finais 01, 02, 11 e 12)</option>
            <option value="corredor">Corredor (finais 03 a 10)</option>
          </select>
        </div>
        <div className="ape-f">
          <label htmlFor="d-acab">Acabamento</label>
          <input id="d-acab" list="d-acabs" placeholder={acabamentoDe({ ...draft.o, acabamento: '' }) || 'ex.: quartzo, granito'} value={acab} onChange={(e) => setAcab(e.target.value)} />
          <datalist id="d-acabs">{['quartzo', 'granito', 'mármore', 'ultracompacto', 'porcelanato', 'cerâmica', 'vinílico', 'laminado', 'MDF', 'gesso', 'vidro temperado'].map((x) => <option key={x} value={x} />)}</datalist>
        </div>
        <div className="ape-f full"><label htmlFor="d-resumo">Resumo simples</label><textarea id="d-resumo" style={{ minHeight: 56 }} value={vals.resumo ?? ''} onChange={(e) => set('resumo', e.target.value)} /></div>
      </div>
      </fieldset>
        {(() => {
          const campo = (k: keyof Orcamento) => {
            const f = FIELDS.find((x) => x[0] === k)
            if (!f) return null
            const [, l, t] = f
            const id = `d-${k}`
            const v = vals[k] ?? ''
            if (t === 'nicho') return <div key={k} className="ape-f"><label htmlFor={id}>{l}</label><select id={id} value={v} onChange={(e) => set(k, e.target.value)}>{NICHOS.map((n) => <option key={n[0]} value={n[0]}>{n[1]}</option>)}</select></div>
            if (t === 'bool') return <div key={k} className="ape-f"><label htmlFor={id}>{l}</label><select id={id} value={v} onChange={(e) => set(k, e.target.value)}><option value="">Não informado</option><option value="nao">Sem juros</option><option value="sim">Com juros</option></select></div>
            if (t === 'lines' || t === 'area') return <div key={k} className="ape-f full"><label htmlFor={id}>{l}</label><textarea id={id} style={{ minHeight: t === 'area' ? 56 : 84 }} value={v} onChange={(e) => set(k, e.target.value)} /></div>
            return <div key={k} className="ape-f"><label htmlFor={id}>{l}</label><input id={id} type={t === 'date' ? 'date' : 'text'} inputMode={t === 'num' ? 'decimal' : undefined} value={v} onChange={(e) => set(k, e.target.value)} /></div>
          }
          const bloco = (t: string, i: string, ks: (keyof Orcamento)[], cols = 3) => (
            <fieldset className={`ape-ed-bloco c${cols}`}><legend><ApeIcon name={i} />{t}</legend><div className="ape-ed-grid">{ks.map(campo)}</div></fieldset>
          )
          return (
            <>
              {bloco('contato', 'chat', ['contato', 'whatsapp', 'instagram'])}
              {bloco('valores', 'tag', ['valor_total', 'valor_avista', 'desconto_avista_pct', 'parcelas_max', 'valor_parcela', 'juros', 'area_m2'], 4)}
              {bloco('condições', 'clock', ['validade', 'prazo', 'garantia', 'pagamento', 'completude'], 4)}
              <fieldset className="ape-ed-bloco"><legend><ApeIcon name="list" />o que inclui</legend><div className="ape-ed-grid um">{(['inclui', 'nao_inclui', 'alertas'] as (keyof Orcamento)[]).map(campo)}</div></fieldset>
              <details className="ape-ed-bloco ape-ed-det"><summary><ApeIcon name="users" />compra em grupo <small>(opcional)</small></summary><div className="ape-ed-grid">{(['grupo_pct', 'grupo_min', 'interessados', 'grupo_desc'] as (keyof Orcamento)[]).map(campo)}</div></details>
            </>
          )
        })()}
      <div className="ape-acts ape-ed-barra">
        <button className="ape-btn primary" disabled={busy} onClick={() => void save()}>
          <ApeIcon name="check" />{draft.novo ? 'Publicar na página' : 'Salvar alterações'}
        </button>
        {draft.novo && (
          <button className="ape-btn" disabled={busy} onClick={() => void save({ oculto: true }, 'Salvo como oculto: só você vê.')}>
            <ApeIcon name="eye" />Salvar oculto
          </button>
        )}
        {!draft.novo && (
          <>
            <button className="ape-btn" disabled={busy} onClick={() => void save({ oculto: !draft.o.oculto }, draft.o.oculto ? 'Agora aparece para todos.' : 'Oculto: só você vê.')}>
              <ApeIcon name="eye" />{draft.o.oculto ? 'Mostrar para todos' : 'Ocultar'}
            </button>
            <button className="ape-btn danger" disabled={busy} onClick={() => void remover()}>
              <ApeIcon name="trash" />Remover
            </button>
          </>
        )}
        <button className="ape-btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

function Lista({ orcs, interesses, onEdit, onChange }: { orcs: Orcamento[]; interesses: Interesse[]; onEdit: (o: Orcamento) => void; onChange: () => void }) {
  const ex = orcs.filter((o) => o.exemplo)
  const sorted = [...orcs].sort((a, b) => String(b.criado).localeCompare(String(a.criado)))
  const [sel, setSel] = useState<string[]>([])
  const apagar = async (ids: string[]) => {
    const nomes = orcs.filter((o) => ids.includes(o.id)).map((o) => o.fornecedor)
    if (!(await ask(ids.length === 1 ? `Apagar o orçamento da ${nomes[0]}? Some da página dos moradores.` : `Apagar ${ids.length} orçamentos (${nomes.slice(0, 3).join(', ')}${ids.length > 3 ? '…' : ''})?`, { confirmLabel: 'apagar', danger: true }))) return
    await admin.remover(ids).then(() => { toast(ids.length === 1 ? 'Apagado.' : `${ids.length} apagados.`); setSel([]); onChange() }, () => toast('Não consegui apagar.'))
  }
  const rmEx = async () => {
    if (!(await ask(`Apagar os ${ex.length} orçamentos de exemplo?`, { confirmLabel: 'apagar', danger: true }))) return
    await admin.remover(ex.map((o) => o.id)).then(onChange, () => toast('Não consegui apagar.'))
  }
  const addEx = async () => {
    const { EXEMPLOS } = await import('./model')
    for (const o of EXEMPLOS) await admin.salvar(o).catch(() => undefined)
    onChange()
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {ex.length > 0 ? (
        <div className="ape-banner warn">
          Há {ex.length} orçamentos de exemplo (só você vê).
          <button className="ape-btn sm" onClick={() => void rmEx()}><ApeIcon name="trash" />Apagar exemplos</button>
        </div>
      ) : (
        !orcs.length && (
          <div className="ape-banner">
            A página ainda não tem orçamentos.
            <button className="ape-btn sm" onClick={() => void addEx()}><ApeIcon name="plus" />Colocar 3 exemplos (só você vê)</button>
          </div>
        )
      )}
      {sel.length > 0 && (
        <div className="ape-banner ape-sel-barra">
          <span><b>{sel.length}</b> selecionado{sel.length > 1 ? 's' : ''}</span>
          <button className="ape-btn danger sm" onClick={() => void apagar(sel)}><ApeIcon name="trash" />apagar selecionados</button>
          <button className="ape-btn ghost sm" onClick={() => setSel([])}>limpar</button>
        </div>
      )}
      <div className="ape-rows">
        {sorted.map((o) => {
          const c = calc(o)
          const n = interesses.filter((i) => i.orcamento === o.id).length + (num(o.interessados) || 0)
          return (
            <div key={o.id} className={`ape-row ape-lista-row ${sel.includes(o.id) ? 'sel' : ''}`}>
              <label className="ape-lista-ck" aria-label={`Selecionar ${o.fornecedor}`}><input type="checkbox" checked={sel.includes(o.id)} onChange={(e) => setSel((l) => (e.target.checked ? [...l, o.id] : l.filter((x) => x !== o.id)))} /></label>
              <div className="t">
                <b>
                  {o.fornecedor}
                  {o.exemplo ? ' · exemplo' : ''}
                  {o.oculto ? ' · oculto' : ''}
                </b>
                <span>
                  {nicho(o.nicho).l} · {brl(c.avista)} à vista{c.st === 'vencido' ? ' · vencido' : ''}
                  {c.gp ? ` · ${n} no grupo` : ''}
                </span>
              </div>
              <div className="r">
                <button className="ape-btn sm" onClick={() => onEdit(o)}><ApeIcon name="edit" />editar</button>
                <button className="ape-btn ghost sm" onClick={() => void apagar([o.id])} aria-label={`Apagar ${o.fornecedor}`} title="apagar"><ApeIcon name="trash" /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Moradores({ moradores, envios, interesses, orcs, escolhas, pedidos, onChange }: { moradores: Morador[]; envios: Envio[]; interesses: Interesse[]; orcs: Orcamento[]; escolhas: { orcamento: string; nicho: string; morador: Morador | null }[]; pedidos: PedidoAdmin[]; onChange: () => void }) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'sanlevi' | 'outros' | 'mesmoap' | 'enviaram'>('todos')
  const forn = (id: string) => orcs.find((o) => o.id === id)?.fornecedor || 'orçamento removido'
  const chave = (m: Morador) => `${m.torre.trim().toLowerCase()}|${m.ap.trim().toLowerCase()}`
  // mesmo torre e apê com nomes diferentes: moram juntos (ou alguém errou o apê)
  const porAp = new Map<string, Morador[]>()
  for (const m of moradores) if (ehSanLevi(m) && m.torre && m.ap) porAp.set(chave(m), [...(porAp.get(chave(m)) || []), m])
  const vizinhosDeAp = (m: Morador) => (ehSanLevi(m) && m.torre && m.ap ? (porAp.get(chave(m)) || []).filter((x) => x.id !== m.id && x.nome.trim().toLowerCase() !== m.nome.trim().toLowerCase()) : [])
  const info = (m: Morador) => {
    const env = envios.filter((e) => e.morador?.id === m.id)
    const grp = interesses.filter((i) => i.morador?.id === m.id).map((i) => forn(i.orcamento))
    const esc = escolhas.filter((e) => e.morador?.id === m.id).map((e) => `${nicho(e.nicho).l}: ${forn(e.orcamento)}`)
    const ped = pedidos.filter((p) => p.status === 'pago' && digits(p.tel).slice(-9) === digits(m.tel).slice(-9))
    return { env, grp, esc, ped, junto: vizinhosDeAp(m) }
  }
  const list = useMemo(
    () =>
      moradores
        .filter((m) => !q || [m.nome, m.torre, m.ap, m.tel, m.condominio].join(' ').toLowerCase().includes(q.toLowerCase()))
        .filter((m) => filtro === 'todos' || (filtro === 'sanlevi' ? ehSanLevi(m) : filtro === 'outros' ? !ehSanLevi(m) : filtro === 'mesmoap' ? vizinhosDeAp(m).length > 0 : envios.some((e) => e.morador?.id === m.id)))
        .sort((a, b) => Number(!ehSanLevi(a)) - Number(!ehSanLevi(b)) || a.torre.localeCompare(b.torre, 'pt', { numeric: true }) || a.ap.localeCompare(b.ap, 'pt', { numeric: true }) || a.nome.localeCompare(b.nome)),
    [moradores, q, filtro, envios],
  )
  const sl = moradores.filter(ehSanLevi)
  const aps = new Set(sl.filter((m) => m.torre && m.ap).map(chave)).size
  const juntos = [...porAp.values()].filter((l) => new Set(l.map((m) => m.nome.trim().toLowerCase())).size > 1).length
  const copiar = async () => {
    const t = list.map((m) => { const x = info(m); return [m.nome, m.condominio || APE.condominio, m.torre && `Torre ${m.torre}`, m.ap && `Apê ${m.ap}`, fmtTel(m.tel), `${x.env.length} orçamentos`, x.esc.join('; '), x.ped.length ? `comprou ${brl(x.ped.reduce((t, p) => t + p.total, 0))}` : ''].join('\t') }).join('\n')
    try {
      await navigator.clipboard.writeText(t)
      toast('Lista copiada: cole numa planilha.')
    } catch {
      toast('Não consegui copiar.')
    }
  }
  const remover = async (m: Morador) => {
    if (!(await ask(`Apagar o cadastro de ${m.nome}? Os orçamentos que a pessoa mandou continuam, sem o nome.`, { confirmLabel: 'apagar', danger: true }))) return
    await admin.removerMorador(m.id).then(onChange, () => toast('Não consegui apagar.'))
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="ape-banner">Só você vê esta lista: todo mundo que se cadastrou, o que mandou, com quem escolheu fechar, os grupos e as compras na loja.</div>
      <CodigoCondominio />
      {sl.filter((m) => !m.aprovado).length > 0 && <div className="ape-banner warn">{sl.filter((m) => !m.aprovado).length} cadastro(s) do {APE.condominio} esperando aprovação: eles ainda não veem os orçamentos.</div>}
      <div className="ape-stats">
        <div className="ape-stat"><b className="num">{sl.length}</b><span>moradores do {APE.condominio}</span></div>
        <div className="ape-stat"><b className="num">{aps}</b><span>apês diferentes</span></div>
        <div className="ape-stat"><b className="num">{juntos}</b><span>apês com mais de uma pessoa</span></div>
      </div>
      <div className="ape-toolbar">
        <label className="ape-search">
          <ApeIcon name="search" />
          <input type="search" placeholder="Filtrar por nome, torre, apê, telefone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="ape-sel" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Mostrar">
          <option value="todos">todos ({moradores.length})</option>
          <option value="sanlevi">só {APE.condominio}</option>
          <option value="outros">de outros lugares</option>
          <option value="mesmoap">mesmo apê, nomes diferentes</option>
          <option value="enviaram">quem mandou orçamento</option>
        </select>
        <button className="ape-btn sm" onClick={() => void copiar()}><ApeIcon name="copy" />Copiar lista</button>
      </div>
      <div className="ape-rows">
        {!list.length && (
          <div className="ape-empty">
            <b>ninguém por aqui</b>
            <span>Quem se cadastrar na página aparece nesta lista. Só você vê.</span>
          </div>
        )}
        {list.map((m, i) => {
          const x = info(m)
          const ant = list[i - 1]
          const torreNova = ehSanLevi(m) && (!ant || !ehSanLevi(ant) || ant.torre.trim() !== m.torre.trim())
          const apNovo = ehSanLevi(m) && (torreNova || ant.ap.trim() !== m.ap.trim())
          const doAp = ehSanLevi(m) ? list.filter((y) => ehSanLevi(y) && chave(y) === chave(m)) : []
          const daTorre = ehSanLevi(m) ? list.filter((y) => ehSanLevi(y) && y.torre.trim() === m.torre.trim()) : []
          const outrosNovo = !ehSanLevi(m) && (!ant || ehSanLevi(ant))
          return (
            <Fragment key={m.id}>
            {torreNova && <h4 className="ape-torre-h">Torre {m.torre || '?'} <span>{new Set(daTorre.map(chave)).size} apê(s) · {daTorre.length} cadastro(s)</span></h4>}
            {apNovo && <p className="ape-ap-h">apê {m.ap || '?'}{doAp.length > 1 ? ` · ${doAp.length} cadastros` : ''}{doAp.some((y) => y.pessoas) ? ` · ${Math.max(...doAp.map((y) => y.pessoas || 0))} pessoa(s) vão morar` : ''}</p>}
            {outrosNovo && <h4 className="ape-torre-h">de outros lugares</h4>}
            <div className="ape-row ape-pessoa">
              <div className="t">
                <b>
                  {m.nome}
                  {!ehSanLevi(m) && <span className="ape-pill ape-keep" style={{ marginLeft: 6 }}>{m.condominio || 'outro lugar'}</span>}
                </b>
                <span>
                  {ehSanLevi(m) ? `T${m.torre || '?'} · apê ${m.ap || '?'}` : 'não é do San Levi'} · <span className="ape-tel">{fmtTel(m.tel)}</span>{m.pessoas ? ` · ${m.pessoas} pessoa(s)` : ''}{ehSanLevi(m) && !m.aprovado ? ' · aguardando aprovação' : ''}
                  {m.criado ? ` · desde ${dmy(m.criado)}` : ''}
                </span>
                {x.junto.length > 0 && (
                  <span className={`ape-pill ape-keep ${m.moraJunto ? 'azul' : 'rosa'}`} style={{ marginTop: 4 }}>
                    <ApeIcon name="users" />
                    {m.moraJunto ? `mora junto com ${x.junto.map((j) => j.nome).join(', ')}` : `mesmo apê que ${x.junto.map((j) => j.nome).join(', ')} (não confirmou que mora junto)`}
                  </span>
                )}
                <div className="ape-pessoa-tags">
                  <span className="ape-pill ape-keep"><ApeIcon name="send" />{x.env.length} orçamento{x.env.length === 1 ? '' : 's'}</span>
                  {x.esc.map((e) => <span key={e} className="ape-pill azul ape-keep"><ApeIcon name="star" />{e}</span>)}
                  {x.grp.map((g) => <span key={g} className="ape-pill rosa ape-keep"><ApeIcon name="users" />grupo: {g}</span>)}
                  {x.ped.length > 0 && <span className="ape-pill terra ape-keep"><ApeIcon name="bag" />comprou {brl(x.ped.reduce((t, p) => t + p.total, 0))}</span>}
                </div>
              </div>
              <div className="r">
                {waNum(m.tel) && (
                  <a className="ape-btn sm" href={wa(waNum(m.tel), `Oi, ${firstName(m.nome)}! Aqui é a ${APE.dona}, do ${APE.doApe} 😊`)} target="_blank" rel="noreferrer">
                    <ApeIcon name="chat" />WhatsApp
                  </a>
                )}
                {ehSanLevi(m) && (m.aprovado
                  ? <button className="ape-btn ghost sm" onClick={() => void admin.aprovarMorador(m.id, false).then(onChange)} title="Tirar o acesso aos orçamentos">tirar acesso</button>
                  : <button className="ape-btn primary sm" onClick={() => void admin.aprovarMorador(m.id, true).then(onChange)}>aprovar</button>)}
                <button className="ape-btn ghost sm" onClick={() => void remover(m)} aria-label={`Apagar ${m.nome}`}><ApeIcon name="trash" /></button>
              </div>
            </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

function Grupos({ orcs, interesses, onSaved }: { orcs: Orcamento[]; interesses: Interesse[]; onSaved: () => void }) {
  const lista = orcs
    .filter((o) => ehOrcamento(o) && (interesses.some((i) => i.orcamento === o.id) || num(o.grupo_pct) || num(o.interessados)))
    .map((o) => ({ o, ppl: interesses.filter((i) => i.orcamento === o.id) }))
    .sort((x, y) => y.ppl.length + (num(y.o.interessados) || 0) - (x.ppl.length + (num(x.o.interessados) || 0)))
  if (!lista.length)
    return (
      <div className="ape-empty">
        <b>Ninguém marcou interesse ainda</b>
        <span>Quando os vizinhos marcarem "tenho interesse em fechar em grupo" num orçamento, a lista aparece aqui, com a meta e a mensagem pronta para o fornecedor.</span>
      </div>
    )
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="ape-banner">Os próprios vizinhos puxam a negociação: quem marcou interesse pede o desconto ao fornecedor e registra a condição no orçamento. Aqui você só acompanha e, se precisar, corrige.</div>
      {lista.map(({ o, ppl }) => <GrupoItem key={o.id} o={o} ppl={ppl} onSaved={onSaved} />)}
    </div>
  )
}

function GrupoItem({ o, ppl, onSaved }: { o: Orcamento; ppl: Interesse[]; onSaved: () => void }) {
  const fora = num(o.interessados) || 0
  const total = ppl.length + fora
  const meta = num(o.grupo_min) || GRUPO_META
  const batida = total >= meta
  const pessoas = ppl.map((i) => i.morador).filter((m): m is Morador => !!m)
  const [pctTxt, setPct] = useState(o.grupo_pct != null ? String(o.grupo_pct).replace('.', ',') : '')
  const [desc, setDesc] = useState(o.grupo_desc || '')
  const [ate, setAte] = useState(o.grupo_ate || '')
  const [busy, setBusy] = useState(false)
  const acab = acabamentoDe(o)
  const msg = `Oi! Aqui é a ${APE.dona}, do grupo de moradores do ${APE.condominio}. Somos ${total} apartamentos interessados em fechar ${nicho(o.nicho).l.toLowerCase()}${acab ? ` (${acab})` : ''} com vocês, a partir do orçamento que vocês mandaram. Qual condição especial vocês fazem para o grupo (desconto e prazo para fechar)? Cada morador fecha o seu contrato direto com vocês.`
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(pessoas.map((m) => `${m.nome} · ${ondeMora(m)} · ${fmtTel(m.tel)}`).join('\n'))
      toast('Lista copiada.')
    } catch {
      toast('Não consegui copiar.')
    }
  }
  const salvar = async () => {
    setBusy(true)
    try {
      await admin.salvar({ ...o, grupo_pct: num(pctTxt), grupo_desc: desc.trim(), grupo_ate: ate || undefined })
      toast(num(pctTxt) ? 'Condição do grupo publicada no orçamento.' : 'Salvo.')
      onSaved()
    } catch (e) {
      toast(`Não consegui salvar (${(e as Error).message}).`)
    }
    setBusy(false)
  }
  const n = waNum(o.whatsapp || o.telefone)
  return (
    <div className={`ape-envio ape-adm-grupo ${batida ? 'batida' : ''}`}>
      <div className="ape-row" style={{ padding: 0, border: 0 }}>
        <div className="t">
          <b>{o.fornecedor} · {nicho(o.nicho).l}{acab ? ` · ${acab}` : ''}</b>
          <span>{total} de {meta} apês{fora ? ` (${fora} por fora)` : ''}{num(o.grupo_pct) ? ` · grupo: −${o.grupo_pct}%${o.grupo_ate ? ` até ${dmy(o.grupo_ate)}` : ''}` : ''}</span>
        </div>
        <div className="r">{batida ? <span className="ape-pill rosa"><ApeIcon name="star" />meta batida</span> : <span className="ape-pill">faltam {meta - total}</span>}</div>
      </div>
      <div className="ape-bar"><i style={{ width: `${Math.min(100, (total / meta) * 100)}%` }} /></div>
      <div className="ape-acts">
        {n ? <a className={`ape-btn sm ${batida ? 'primary' : ''}`} href={wa(n, msg)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />mensagem ao fornecedor</a> : <button className="ape-btn sm" onClick={() => void navigator.clipboard?.writeText(msg).then(() => toast('Mensagem copiada.'))}><ApeIcon name="copy" />copiar mensagem</button>}
        {pessoas.length > 0 && <button className="ape-btn sm" onClick={() => void copiar()}><ApeIcon name="copy" />copiar contatos</button>}
      </div>
      {pessoas.length > 0 && (
        <details className="ape-more">
          <summary><ApeIcon name="chev" />{pessoas.length} interessado{pessoas.length > 1 ? 's' : ''}</summary>
          <div className="ape-rows">
            {pessoas.map((m) => (
              <div key={m.id} className="ape-row" style={{ padding: '6px 0' }}>
                <div className="t"><b style={{ fontSize: 13 }}>{m.nome}</b><span>{ondeMora(m) || 'sem endereço'} · {fmtTel(m.tel)}</span></div>
                {waNum(m.tel) && <div className="r"><a className="ape-btn ghost sm" href={wa(waNum(m.tel)!, `Oi, ${firstName(m.nome)}! Aqui é a ${APE.dona}, do planê.apê. Sobre o grupo de ${nicho(o.nicho).l.toLowerCase()} com ${o.fornecedor}: `)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" /></a></div>}
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="ape-frow">
        <div className="ape-f"><label>Desconto do grupo (%)</label><input inputMode="decimal" value={pctTxt} onChange={(e) => setPct(e.target.value)} placeholder="ex.: 8" /></div>
        <div className="ape-f"><label>Condição (curta)</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="ex.: à vista, medição no mesmo dia" /></div>
        <div className="ape-f"><label>Vale até</label><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
      </div>
      <div className="ape-acts"><button className="ape-btn primary sm" disabled={busy} onClick={() => void salvar()}><ApeIcon name="check" />{busy ? 'salvando…' : 'publicar condição do grupo'}</button></div>
    </div>
  )
}

function Loja({ ajustes, onSaved }: { ajustes: Ajustes; onSaved: (a: Ajustes) => void }) {
  const [ps, setPs] = useState<Produto[]>(ajustes.produtos)
  const [whats, setWhats] = useState(ajustes.whatsapp || '')
  const [pixPct, setPixPct] = useState(String(ajustes.pixPct ?? PIX_PCT))
  const [jurosTxt, setJurosTxt] = useState(String(ajustes.jurosPct ?? JUROS_PCT).replace('.', ','))
  const [taxas, setTaxas] = useState<Taxas>(ajustes.taxas || TAXAS)
  const [vend, setVend] = useState<Vendedor>(ajustes.vendedor || { nome: '', doc: '', cidade: '', email: '' })
  const [fotoProjeto, setFotoProjeto] = useState(ajustes.fotoProjeto || '')
  const [fotoProjeto2, setFotoProjeto2] = useState(ajustes.fotoProjeto2 || '')
  const [subindo2, setSubindo2] = useState(false)
  const [subindo, setSubindo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [abrir, setAbrir] = useState<string | null>(null)
  const calcd = comPrecos(ps) // preço dos kits calculado sozinho
  const pix = Math.min(10, Math.max(0, num(pixPct) ?? PIX_PCT))
  const juros = Math.min(10, Math.max(0, num(jurosTxt) ?? JUROS_PCT))
  const exPlat = parcelas(reais(ps.find((p) => p.id === 'plataforma')?.preco) || 89.9, juros)
  const set = (i: number, patch: Partial<Produto>) => setPs((l) => l.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const margem = (p: Produto) => {
    const v = reais(p.preco)
    const lp = liquido(Math.round(v * (100 - pix)) / 100, 'pix', taxas)
    const lc = liquido(v, 'cartao', taxas)
    return { v, lp, lc, ruim: Math.min(lp, lc) < 3 }
  }
  const save = async () => {
    const ruins = calcd.filter((p) => p.ativo && noCarrinho(p) && margem(p).ruim)
    if (ruins.length && !(await ask(`Atenção: ${ruins.map((p) => p.nome).join(', ')} ${ruins.length > 1 ? 'deixam' : 'deixa'} menos de R$ 3 por venda depois da taxa. Salvar assim mesmo?`, { confirmLabel: 'salvar' }))) return
    setBusy(true)
    const a: Ajustes = { produtos: ps, whatsapp: whats.replace(/\D/g, ''), lojaV: LOJA_VERSAO, pixPct: pix, jurosPct: juros, taxas, vendedor: vend, fotoProjeto, fotoProjeto2, fotoPainel: ajustes.fotoPainel || '' }
    try {
      await admin.salvarAjustes(a)
      onSaved({ ...a, produtos: comPrecos(ps) })
      toast('Loja salva: os preços já valem no pagamento.')
    } catch (e) {
      toast(`Não consegui salvar (${(e as Error).message}).`)
    }
    setBusy(false)
  }
  return (
    <div className="ape-form">
      <div className="ape-banner">Os preços daqui valem também no pagamento (a cobrança é calculada no servidor com a loja salva). Pix com desconto; cartão à vista sem juros ou parcelado com os juros que você define abaixo. Kits: escolha o desconto do kit e o preço sai sozinho, sempre terminando em ,90.</div>
      <div className="ape-panel ape-adm-box">
        <p className="ape-eyebrow">pagamento e margem</p>
        <div className="ape-frow ape-adm-taxas">
          <div className="ape-f"><label htmlFor="l-pix">Desconto no Pix (%)</label><input id="l-pix" inputMode="decimal" value={pixPct} onChange={(e) => setPixPct(e.target.value)} /><span className="ape-hint">De 0 a 10. Sugerido: 5.</span></div>
          <div className="ape-f"><label htmlFor="l-juros">Juros do cartão parcelado (% ao mês)</label><input id="l-juros" inputMode="decimal" value={jurosTxt} onChange={(e) => setJurosTxt(e.target.value)} /><span className="ape-hint ape-keep">1x sem juros. Plataforma em {exPlat[exPlat.length - 1].n}x: {brl(exPlat[exPlat.length - 1].parcela)} (total {brl(exPlat[exPlat.length - 1].total)}). Cobre a taxa do Asaas no parcelado.</span></div>
          <div className="ape-f"><label htmlFor="l-tp">Taxa do Pix (<span className="ape-keep">R$</span> por venda)</label><input id="l-tp" inputMode="decimal" value={String(taxas.pix).replace('.', ',')} onChange={(e) => setTaxas({ ...taxas, pix: num(e.target.value) ?? 0 })} /></div>
          <div className="ape-f"><label htmlFor="l-tc">Taxa do cartão (% + <span className="ape-keep">R$</span>)</label>
            <div className="ape-par">
              <input id="l-tc" inputMode="decimal" value={String(taxas.cartaoPct).replace('.', ',')} onChange={(e) => setTaxas({ ...taxas, cartaoPct: num(e.target.value) ?? 0 })} aria-label="Taxa do cartão em %" />
              <input inputMode="decimal" value={String(taxas.cartaoFixo).replace('.', ',')} onChange={(e) => setTaxas({ ...taxas, cartaoFixo: num(e.target.value) ?? 0 })} aria-label="Taxa fixa do cartão em R$" />
            </div>
          </div>
        </div>
        <span className="ape-hint">Confira as taxas no seu plano do Asaas (Minha conta → Taxas). Elas só servem para mostrar quanto sobra de cada venda.</span>
      </div>
      <div className="ape-panel ape-adm-box">
        <p className="ape-eyebrow">foto da seção de projetos</p>
        <div className="ape-adm-fotoproj">
          <div className={`ape-adm-fotoprev ${fotoProjeto && fotoProjeto2 ? 'duas' : ''}`}>
            <img src={fotoProjeto || 'ape/amostras/projeto-3d.jpg'} alt="Foto 1 da seção de projetos" />
            {fotoProjeto && fotoProjeto2 && <img src={fotoProjeto2} alt="Foto 2 da seção de projetos" />}
          </div>
          <div>
            <div className="ape-acts">
              <label className="ape-btn primary sm" style={{ cursor: 'pointer' }}><ApeIcon name="clip" />{subindo ? 'enviando…' : fotoProjeto ? 'trocar foto 1' : 'colocar foto 1'}
                <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setSubindo(true); try { setFotoProjeto(await loja.fotoPublica('projeto', f)); toast('Foto enviada. Toque em "salvar loja" para publicar.') } catch (x) { toast(String((x as Error).message)) } setSubindo(false) }} />
              </label>
              <label className="ape-btn sm" style={{ cursor: 'pointer' }}><ApeIcon name="plus" />{subindo2 ? 'enviando…' : fotoProjeto2 ? 'trocar foto 2' : 'somar foto 2'}
                <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setSubindo2(true); try { setFotoProjeto2(await loja.fotoPublica('projeto2', f)); toast('Foto 2 enviada. Toque em "salvar loja" para publicar.') } catch (x) { toast(String((x as Error).message)) } setSubindo2(false) }} />
              </label>
              {fotoProjeto2 && <button className="ape-btn ghost sm" onClick={() => setFotoProjeto2('')}>usar só uma</button>}
              {fotoProjeto && <button className="ape-btn ghost sm" onClick={() => { setFotoProjeto(''); setFotoProjeto2('') }}>voltar para a padrão</button>}
            </div>
            <span className="ape-hint">Uma foto: aparece inteira no quadro 4:3 (deitada fica melhor). Duas fotos: aparecem lado a lado, cada uma em pé (ótimo para renders verticais). Depois toque em "salvar loja".</span>
          </div>
        </div>
      </div>
      <div className="ape-panel ape-adm-box">
        <p className="ape-eyebrow">quem vende (aparece nos termos e no rodapé da loja)</p>
        <div className="ape-frow">
          <div className="ape-f"><label htmlFor="v-nome">Nome ou razão social</label><input id="v-nome" value={vend.nome} onChange={(e) => setVend({ ...vend, nome: e.target.value })} /></div>
          <div className="ape-f"><label htmlFor="v-doc"><span className="ape-keep">CPF</span> ou <span className="ape-keep">CNPJ</span></label><input id="v-doc" value={vend.doc} onChange={(e) => setVend({ ...vend, doc: e.target.value })} /></div>
        </div>
        <div className="ape-frow">
          <div className="ape-f"><label htmlFor="v-cid">Cidade/<span className="ape-keep">UF</span></label><input id="v-cid" value={vend.cidade} onChange={(e) => setVend({ ...vend, cidade: e.target.value })} /></div>
          <div className="ape-f"><label htmlFor="v-mail">E-mail de atendimento</label><input id="v-mail" value={vend.email} onChange={(e) => setVend({ ...vend, email: e.target.value })} /></div>
          <div className="ape-f"><label htmlFor="l-whats"><span className="ape-keep">WhatsApp</span> de atendimento</label><input id="l-whats" inputMode="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder={fmtTel(APE.whatsapp)} /></div>
        </div>
        <span className="ape-hint">A lei do comércio eletrônico (Decreto 7.962/2013) pede nome e CPF/CNPJ de quem vende, visíveis na loja. Com CNPJ (MEI), use o CNPJ.</span>
      </div>
      <div className="ape-adm-prods">
        {calcd.map((p, i) => {
          const m = margem(p)
          const soma = (p.combo || []).reduce((t, id) => t + reais(calcd.find((x) => x.id === id)?.preco), 0)
          return (
            <div key={p.id} className={`ape-adm-prod ${p.ativo ? '' : 'off'}`}>
              <div className="ape-adm-prod-h">
                <div className="t">
                  <b>{p.nome}</b>
                  <span className="ape-keep">{p.cat === 'combos' ? `kit · ${(p.combo || []).length} arquivos · soma ${brl(soma)} · −${p.kitPct || 0}%` : (CATEGORIAS.find(([c]) => c === (p.cat || 'arquivos')) || [])[1]}</span>
                </div>
                <div className="r">
                  <b className="ape-keep">{p.preco || 'sob consulta'}</b>
                  {noCarrinho(p) && m.v > 0 && <span className={`ape-pill ape-keep ${m.ruim ? 'rosa' : 'azul'}`} title="Quanto sobra depois da taxa">sobra {brl(m.lp)} Pix · {brl(m.lc)} cartão</span>}
                  <button className="ape-btn ghost sm" onClick={() => setAbrir(abrir === p.id ? null : p.id)}><ApeIcon name="edit" />{abrir === p.id ? 'fechar' : 'editar'}</button>
                </div>
              </div>
              {abrir === p.id && (
                <div className="ape-adm-prod-b">
                  <div className="ape-frow">
                    <div className="ape-f"><label>Nome</label><input value={ps[i].nome} onChange={(e) => set(i, { nome: e.target.value })} /></div>
                    {p.cat === 'combos' ? (
                      <div className="ape-f"><label>Desconto do kit (%)</label><input inputMode="numeric" value={ps[i].kitPct ?? ''} onChange={(e) => set(i, { kitPct: num(e.target.value) ?? 0 })} /><span className="ape-hint ape-keep">Preço: {p.preco} (sai sozinho)</span></div>
                    ) : (
                      <div className="ape-f"><label>Preço</label><input value={ps[i].preco} onChange={(e) => set(i, { preco: e.target.value })} placeholder="R$ 19,90" /></div>
                    )}
                    <div className="ape-f"><label>Etiqueta</label><input value={ps[i].tag} onChange={(e) => set(i, { tag: e.target.value })} /></div>
                    <div className="ape-f"><label>Selo de destaque</label>
                      <select value={ps[i].selo || ''} onChange={(e) => set(i, { selo: e.target.value })}>
                        <option value="">sem selo</option>
                        {[...new Set([...SELOS, ...(ps[i].selo ? [ps[i].selo!] : [])])].map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="ape-frow">
                    <div className="ape-f"><label>Seção</label>
                      <select value={ps[i].cat || 'arquivos'} onChange={(e) => set(i, { cat: e.target.value as Categoria })}>
                        {CATEGORIAS.filter(([c]) => c !== 'projeto').map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                      </select>
                    </div>
                    {(ps[i].cat || 'arquivos') === 'arquivos' && (
                      <div className="ape-f"><label>Etapa</label>
                        <select value={ps[i].fase || 'comprei'} onChange={(e) => set(i, { fase: e.target.value as Produto['fase'] })}>
                          <option value="comprando">para quem vai comprar</option>
                          <option value="comprei">para quem já comprou</option>
                        </select>
                      </div>
                    )}
                    <div className="ape-f"><label>Formato</label><input value={ps[i].formato || ''} onChange={(e) => set(i, { formato: e.target.value })} placeholder="PDF" /></div>
                  </div>
                  <div className="ape-f"><label>Descrição</label><textarea style={{ minHeight: 60 }} value={ps[i].desc} onChange={(e) => set(i, { desc: e.target.value })} /></div>
                  <div className="ape-f"><label>O que vem (um por linha)</label><textarea style={{ minHeight: 80 }} value={(ps[i].itens || []).join('\n')} onChange={(e) => set(i, { itens: e.target.value.split('\n') })} onBlur={(e) => set(i, { itens: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></div>
                  {(ps[i].cat || 'arquivos') === 'combos' && (
                    <div className="ape-f">
                      <label>Arquivos do kit</label>
                      <div className="ape-acts">
                        {ps.filter((x) => (x.cat || 'arquivos') === 'arquivos').map((x) => (
                          <label key={x.id} className="ape-tog">
                            <input type="checkbox" checked={(ps[i].combo || []).includes(x.id)} onChange={(e) => set(i, { combo: e.target.checked ? [...(ps[i].combo || []), x.id] : (ps[i].combo || []).filter((y) => y !== x.id) })} /> {x.nome}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="ape-f"><label>Em números (um por linha)</label><textarea style={{ minHeight: 50 }} value={(ps[i].numeros || []).join('\n')} onChange={(e) => set(i, { numeros: e.target.value.split('\n') })} onBlur={(e) => set(i, { numeros: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></div>
                  <div className="ape-f"><label>Imagens de amostra (uma por linha)</label><textarea style={{ minHeight: 50 }} value={(ps[i].amostras || []).join('\n')} onChange={(e) => set(i, { amostras: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></div>
                  <div className="ape-acts">
                    <label className="ape-tog"><input type="checkbox" checked={ps[i].ativo} onChange={(e) => set(i, { ativo: e.target.checked })} /> Mostrar na loja</label>
                    <label className="ape-tog"><input type="checkbox" checked={!!ps[i].destaque} onChange={(e) => set(i, { destaque: e.target.checked })} /> Destaque</label>
                    <button className="ape-btn ghost sm" onClick={() => setPs((l) => l.filter((_, j) => j !== i))}><ApeIcon name="trash" />Tirar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="ape-acts">
        <button className="ape-btn primary" disabled={busy} onClick={() => void save()}><ApeIcon name="check" />Salvar loja</button>
        <button className="ape-btn" onClick={() => { const id = 'p' + Date.now().toString(36); setPs((l) => [...l, { id, nome: 'Novo produto', desc: '', preco: 'R$ 9,90', tag: '', ativo: false, cat: 'arquivos', fase: 'comprei' }]); setAbrir(id) }}>
          <ApeIcon name="plus" />Novo produto
        </button>
        <button className="ape-btn ghost" onClick={async () => { if (await ask('Trocar a loja pela sugerida (preços e textos sugeridos)? O que você mudou aqui se perde.', { confirmLabel: 'trocar' })) setPs(PRODUTOS) }}>
          voltar para a loja sugerida
        </button>
      </div>
    </div>
  )
}

/* ===== vendas da loja ===== */
const cpfMask = (c: string) => (c && c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : '')
const linkPedido = (t: string) => `https://useplane.com.br/ape/#pedido:${t}`
/** Itens da compra em uma linha: "Kit completo + Plataforma" ou "Guia de compra + 14 itens". */
const resumoItens = (itens: { nome: string; id?: string }[]) => {
  const kit = itens.find((i) => /^kit/i.test(i.nome))
  const base = kit ? [kit, ...itens.filter((i) => i !== kit && (i.id === 'plataforma' || /plataforma/i.test(i.nome)))] : itens.slice(0, 2)
  const resto = itens.length - base.length
  return base.map((i) => i.nome).join(' + ') + (resto > 0 ? ` + ${resto} ${resto === 1 ? 'item' : 'itens'}` : '')
}

/** Quem começou a compra (deixou nome, e-mail e celular) e não pagou: pedidos pendentes há mais de 30 min, sem outra compra paga com o mesmo e-mail. */
function carrinhosAbandonados(pedidos: PedidoAdmin[]) {
  const pagos = new Set(pedidos.filter((p) => p.status === 'pago').map((p) => p.email.toLowerCase()))
  const vistos = new Set<string>()
  return pedidos
    .filter((p) => p.status === 'pendente' && !p.cortesia && Date.now() - new Date(p.criado).getTime() > 30 * 60e3 && !pagos.has(p.email.toLowerCase()))
    .filter((p) => { const k = p.email.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true })
}
function Leads({ lista }: { lista: PedidoAdmin[] }) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(lista.map((p) => `${p.nome};${p.email};${p.tel}`).join('\n'))
      toast('Lista copiada (nome;e-mail;celular): cole no Brevo ou numa planilha.')
    } catch {
      toast('Não consegui copiar.')
    }
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="ape-banner">Quem preencheu os dados no checkout e não pagou. Uma mensagem simpática, perguntando se ficou alguma dúvida, recupera muita venda. Com o Brevo ligado, esses contatos também vão sozinhos para a sua lista de e-mail.</div>
      {lista.length > 0 && <div className="ape-acts"><button className="ape-btn sm" onClick={() => void copiar()}><ApeIcon name="copy" />copiar a lista</button></div>}
      {!lista.length && <div className="ape-empty"><b>nenhum carrinho abandonado</b><span>Quem começar uma compra e não terminar aparece aqui depois de 30 minutos.</span></div>}
      <div className="ape-rows">
        {lista.map((p) => {
          const msg = `Oi, ${firstName(p.nome)}! Aqui é a ${APE.dona}, do planê.apê. Vi que você começou a compra (${resumoItens(p.itens)}) e não finalizou. Ficou alguma dúvida? Se quiser, te ajudo por aqui. Link da loja: https://useplane.com.br/ape/`
          return (
            <div key={p.id} className="ape-row">
              <div className="t">
                <b>{p.nome}</b>
                <span title={p.itens.map((i) => i.nome).join(' + ')}>{resumoItens(p.itens)} · <span className="ape-keep">{brl(p.total)}</span></span>
                <span>{p.email}{p.tel ? ` · ${fmtTel(p.tel)}` : ''} · {dmy(p.criado)}</span>
              </div>
              <div className="r">
                {waNum(p.tel) && <a className="ape-btn primary sm" href={wa(waNum(p.tel)!, msg)} target="_blank" rel="noreferrer"><ApeIcon name="chat" />WhatsApp</a>}
                <a className="ape-btn sm" href={`mailto:${p.email}?subject=${encodeURIComponent('Sua compra no planê.apê')}&body=${encodeURIComponent(msg)}`}><ApeIcon name="send" />e-mail</a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const semSaldo = (e: unknown) => /saldo/i.test(String((e as Error)?.message ?? e))
const MSG_SEM_SALDO = (v: string, nome: string) => `O Asaas ainda não tem saldo para devolver ${v} (o estorno sai do saldo da sua conta; o valor da venda entra menos a taxa). Você pode devolver por Pix direto para ${nome} e marcar aqui como reembolsado: os downloads e a plataforma deste pedido param do mesmo jeito.`

function Vendas({ pedidos, onChange }: { pedidos: PedidoAdmin[]; onChange: () => void }) {
  const [ver, setVer] = useState<'pago' | 'pendente' | 'todos'>('pago')
  const [q, setQ] = useState('')
  const pagos = pedidos.filter((p) => p.status === 'pago' && !p.cortesia)
  const mes = new Date().toISOString().slice(0, 7)
  const doMes = pagos.filter((p) => (p.pago_em || p.criado).slice(0, 7) === mes)
  const t = q.trim().toLowerCase()
  const list = pedidos.filter((p) => (ver === 'todos' ? true : p.status === ver)).filter((p) => !t || [p.nome, p.email, p.cpf, p.tel].join(' ').toLowerCase().includes(t))
  const reembolsar = async (p: PedidoAdmin) => {
    const pago = p.status === 'pago'
    if (!(await ask(pago ? `Reembolsar ${brl(p.total)} para ${p.nome}? O valor volta pelo Asaas, os downloads e a plataforma deste pedido param de funcionar.` : `Cancelar o pedido pendente de ${p.nome}?`, { confirmLabel: pago ? 'reembolsar' : 'cancelar pedido', danger: true }))) return
    try {
      await loja.reembolsar(p.id)
      toast(pago ? 'Reembolso pedido ao Asaas.' : 'Pedido cancelado.')
      onChange()
    } catch (e) {
      if (semSaldo(e) && (await ask(MSG_SEM_SALDO(brl(p.total), p.nome), { confirmLabel: 'já devolvi por Pix: marcar' }))) {
        await loja.reembolsar(p.id, true).then(() => { toast('Marcado como reembolsado.'); onChange() }, (x) => toast(`Não consegui (${(x as Error).message}).`))
      } else if (!semSaldo(e)) toast(`Não consegui (${(e as Error).message}).`)
    }
  }
  const pendentes = pedidos.filter((p) => p.cancelamento?.status === 'pedido' && p.status === 'pago')
  const decidir = async (p: PedidoAdmin, decisao: 'aprovar' | 'negar') => {
    const dias = p.pago_em ? Math.floor((Date.now() - new Date(p.pago_em).getTime()) / 864e5) : 0
    if (decisao === 'negar' && dias <= 7 && !(await ask(`A compra foi há ${dias} dia(s): dentro dos 7 dias, a lei (art. 49 do CDC) garante o reembolso. Negar assim mesmo pode gerar reclamação no Procon. Continuar?`, { confirmLabel: 'negar mesmo assim', danger: true }))) return
    const resposta = prompt(decisao === 'aprovar' ? 'Mensagem para o cliente (opcional):' : 'Explique para o cliente por que não foi aprovado:') ?? ''
    if (decisao === 'aprovar' && !(await ask(`Aprovar e reembolsar ${brl(p.total)} para ${p.nome}? Os downloads e a plataforma deste pedido param.`, { confirmLabel: 'aprovar e reembolsar' }))) return
    try {
      await painelConta.decidir(p.id, decisao, resposta)
      toast(decisao === 'aprovar' ? 'Cancelamento aprovado e reembolso pedido ao Asaas.' : 'Resposta enviada ao cliente.')
      onChange()
    } catch (e) {
      if (semSaldo(e) && (await ask(MSG_SEM_SALDO(brl(p.total), p.nome), { confirmLabel: 'já devolvi por Pix: aprovar' }))) {
        await painelConta.decidir(p.id, decisao, resposta, true).then(() => { toast('Cancelamento aprovado e marcado como reembolsado.'); onChange() }, (x) => toast(`Não consegui (${(x as Error).message}).`))
      } else if (!semSaldo(e)) toast(`Não consegui (${(e as Error).message}).`)
    }
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {!apeCloud && <div className="ape-banner">Prévia: as vendas são as de teste deste navegador.</div>}
      {pendentes.length > 0 && (
        <div className="ape-panel ape-adm-box">
          <p className="ape-eyebrow">pedidos de cancelamento para você decidir ({pendentes.length})</p>
          {pendentes.map((p) => {
            const dias = p.pago_em ? Math.floor((Date.now() - new Date(p.pago_em).getTime()) / 864e5) : 0
            return (
              <div key={p.id} className="ape-row ape-venda">
                <div className="t">
                  <b>{p.nome} · <span className="ape-keep">{brl(p.total)}</span> · comprou há {dias} dia(s)</b>
                  <span title={p.itens.map((i) => i.nome).join(' + ')}>{resumoItens(p.itens)} · baixou {p.baixados}x</span>
                  <span>Motivo: {p.cancelamento?.motivo || 'não informado'}</span>
                  <span className={dias <= 7 ? '' : 'ape-ferr'}>{dias <= 7 ? 'Dentro dos 7 dias: o reembolso é direito do cliente (art. 49 do CDC).' : 'Passou dos 7 dias: você pode negar, explicando o motivo.'}</span>
                </div>
                <div className="r">
                  <button className="ape-btn primary sm" onClick={() => void decidir(p, 'aprovar')}>aprovar e reembolsar</button>
                  <button className="ape-btn ghost sm danger" onClick={() => void decidir(p, 'negar')}>negar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="ape-stats">
        <div className="ape-stat"><b className="num">{brl(doMes.reduce((s, p) => s + p.total, 0))}</b><span>vendido no mês</span></div>
        <div className="ape-stat"><b className="num">{doMes.length}</b><span>vendas no mês</span></div>
        <div className="ape-stat"><b className="num">{brl(pagos.reduce((s, p) => s + p.total, 0))}</b><span>total vendido</span></div>
      </div>
      <div className="ape-toolbar">
        <label className="ape-search"><ApeIcon name="search" /><input type="search" placeholder="Nome, e-mail, CPF ou telefone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></label>
        <select className="ape-sel" value={ver} onChange={(e) => setVer(e.target.value as typeof ver)} aria-label="Mostrar">
          <option value="pago">pagos</option>
          <option value="pendente">aguardando pagamento</option>
          <option value="todos">todos</option>
        </select>
      </div>
      <div className="ape-rows">
        {!list.length && <div className="ape-empty"><b>nada por aqui</b><span>As compras pela loja aparecem aqui.</span></div>}
        {list.map((p) => {
          const dias = p.pago_em ? Math.floor((Date.now() - new Date(p.pago_em).getTime()) / 864e5) : null
          return (
            <div key={p.id} className="ape-row ape-venda">
              <div className="t">
                <b>{p.nome} · <span className="ape-keep">{p.cortesia ? 'cortesia' : brl(p.total)}</span></b>
                <span title={p.itens.map((i) => i.nome).join(' + ')}>{resumoItens(p.itens)}</span>
                <span>{dmy(p.criado)} · <span className={`ape-pill ${p.status === 'pago' ? 'azul' : p.status === 'pendente' ? '' : 'rosa'}`}>{p.status}</span>{p.status === 'pago' && !p.cortesia ? ` · ${p.forma === 'cartao' ? 'cartão' : 'Pix'} · baixou ${p.baixados}x${dias != null && dias <= 7 ? ` · dentro dos 7 dias (${dias}d)` : ''}` : ''}</span>
                <span>{[p.email, cpfMask(p.cpf), p.tel ? fmtTel(p.tel) : '', p.aceite ? `termos ${p.aceite.versao}` : ''].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="r">
                <button className="ape-btn ghost sm" onClick={() => { void navigator.clipboard?.writeText(linkPedido(p.token)); toast('Link do pedido copiado.') }}><ApeIcon name="copy" />link</button>
                {waNum(p.tel) && (
                  <a className="ape-btn sm" href={wa(waNum(p.tel), p.status === 'pago' ? `Oi, ${firstName(p.nome)}! Obrigada pela compra no planê.apê. Seus arquivos ficam aqui: ${linkPedido(p.token)}` : `Oi, ${firstName(p.nome)}! Vi que você começou uma compra no planê.apê. Ficou alguma dúvida? O pagamento fica aqui: ${linkPedido(p.token)}`)} target="_blank" rel="noreferrer"><ApeIcon name="chat" />WhatsApp</a>
                )}
                {p.status === 'reembolsado' && !p.cortesia && <button className="ape-btn ghost sm" onClick={() => void painelConta.avisarReembolso(p.id).then(() => toast(`E-mail de reembolso enviado para ${p.email}.`), (e) => toast(String((e as Error).message)))}><ApeIcon name="send" />avisar o cliente</button>}
                {(p.status === 'pago' || p.status === 'pendente') && <button className="ape-btn ghost sm danger" onClick={() => void reembolsar(p)}>{p.status === 'pago' ? (p.cortesia ? 'tirar acesso' : 'reembolsar') : 'cancelar'}</button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ===== clientes: quem comprou (por CPF), acessos à plataforma e cortesias ===== */
function Clientes({ pedidos, produtos, onChange }: { pedidos: PedidoAdmin[]; produtos: Produto[]; onChange: () => void }) {
  const [plats, setPlats] = useState<PlatAdmin[]>([])
  const [q, setQ] = useState('')
  const [nova, setNova] = useState(false)
  const load = useCallback(() => void loja.plataformas().then(setPlats, () => setPlats([])), [])
  useEffect(load, [load, pedidos])
  const [editando, setEditando] = useState('')
  const [form, setForm] = useState({ nome: '', email: '', tel: '' })
  const clientes = useMemo(() => {
    const m = new Map<string, { nome: string; email: string; cpf: string; tel: string; pedidos: PedidoAdmin[] }>()
    for (const p of pedidos) {
      if (p.status === 'cancelado') continue
      const k = p.cpf || p.email || p.tel || p.id
      const c = m.get(k) || { nome: p.nome, email: p.email, cpf: p.cpf, tel: p.tel, pedidos: [] }
      c.pedidos.push(p)
      m.set(k, c)
    }
    return [...m.values()].sort((a, b) => b.pedidos[0].criado.localeCompare(a.pedidos[0].criado))
  }, [pedidos])
  const t = q.trim().toLowerCase()
  const vis = clientes.filter((c) => !t || [c.nome, c.email, c.cpf, c.tel].join(' ').toLowerCase().includes(t))
  const mais30 = async (pl: PlatAdmin) => {
    const base = pl.validade > new Date().toISOString().slice(0, 10) ? new Date(pl.validade) : new Date()
    base.setDate(base.getDate() + 30)
    await loja.validade(pl.id, base.toISOString().slice(0, 10)).then(load, (e) => toast(String(e.message)))
    toast('Acesso estendido por mais 30 dias.')
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="ape-toolbar">
        <label className="ape-search"><ApeIcon name="search" /><input type="search" placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" /></label>
        <button className="ape-btn primary sm" onClick={() => setNova(!nova)}><ApeIcon name="gift" />dar cortesia</button>
      </div>
      {nova && <Cortesia produtos={produtos} onDone={() => { setNova(false); onChange() }} />}
      <div className="ape-rows">
        {!vis.length && <div className="ape-empty"><b>nenhum cliente ainda</b><span>Quem comprar aparece aqui, com as compras e o acesso à plataforma.</span></div>}
        {vis.map((c) => {
          const pagos = c.pedidos.filter((p) => p.status === 'pago')
          const pl = plats.find((x) => (c.cpf && x.cpf === c.cpf) || c.pedidos.some((p) => p.id === x.pedido))
          const chave = c.cpf || c.email || c.pedidos[0].id
          return (
            <div key={chave} className="ape-row ape-adm-cli">
              <div className="t">
                <b>{c.nome}</b>
                <span>{[c.email, cpfMask(c.cpf), c.tel ? fmtTel(c.tel) : ''].filter(Boolean).join(' · ')}</span>
                <span className="ape-keep">{pagos.length} compra{pagos.length === 1 ? '' : 's'} · {brl(pagos.reduce((s, p) => s + p.total, 0))}{c.pedidos.some((p) => p.status === 'reembolsado') ? ' · teve reembolso' : ''}</span>
                {pl && <span>plataforma até {dmy(pl.validade)}{pl.cortesia ? ' (cortesia)' : ''}</span>}
              </div>
              <div className="r">
                {pl && <a className="ape-btn ghost sm" href={href('ape', `minha:${pl.token}`)} target="_blank" rel="noreferrer"><ApeIcon name="eye" />plataforma</a>}
                {pl && <button className="ape-btn ghost sm" onClick={() => void mais30(pl)}>+30 dias</button>}
                {waNum(c.tel) && <a className="ape-btn sm" href={wa(waNum(c.tel), `Oi, ${firstName(c.nome)}!`)} target="_blank" rel="noreferrer"><ApeIcon name="chat" /></a>}
                <button className="ape-btn ghost sm" onClick={() => { setEditando(chave); setForm({ nome: c.nome, email: c.email, tel: c.tel }) }} aria-label="Editar cliente"><ApeIcon name="edit" /></button>
                {!c.pedidos.some((p) => p.status === 'pago' && !p.cortesia) && (
                  <button className="ape-btn ghost sm" aria-label="Excluir cliente" onClick={async () => {
                    if (!(await ask(`Excluir ${c.nome} e ${c.pedidos.length === 1 ? 'a compra de teste/cortesia' : `as ${c.pedidos.length} compras de teste/cortesia`}? Tira também o acesso à plataforma.`, { confirmLabel: 'excluir', danger: true }))) return
                    await loja.excluirPedidos(c.pedidos.map((p) => p.id)).then(() => { toast('Excluído.'); onChange() }, (e) => toast(`Não consegui (${(e as Error).message}).`))
                  }}><ApeIcon name="trash" /></button>
                )}
              </div>
              {editando === chave && (
                <div className="ape-adm-editcli">
                  <div className="ape-frow ape-frow3">
                    <div className="ape-f"><label>Nome</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                    <div className="ape-f"><label>E-mail</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div className="ape-f"><label>Celular</label><input inputMode="tel" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} /></div>
                  </div>
                  <div className="ape-acts">
                    <button className="ape-btn primary sm" onClick={async () => { await loja.editarCliente(c.pedidos.map((p) => p.id), form).then(() => { toast('Cliente atualizado.'); setEditando(''); onChange() }, (e) => toast(`Não consegui (${(e as Error).message}).`)) }}><ApeIcon name="check" />salvar</button>
                    <button className="ape-btn ghost sm" onClick={() => setEditando('')}>cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {plats.filter((p) => !p.pedido).length > 0 && (
        <>
          <p className="ape-eyebrow">acessos à plataforma sem compra</p>
          <div className="ape-rows">
            {plats.filter((p) => !p.pedido).map((p) => (
              <div key={p.id} className="ape-row">
                <div className="t"><b>{p.nome}</b><span>até {dmy(p.validade)}{p.cortesia ? ' · cortesia' : ''}</span></div>
                <div className="r">
                  <a className="ape-btn ghost sm" href={href('ape', `minha:${p.token}`)} target="_blank" rel="noreferrer"><ApeIcon name="eye" />abrir</a>
                  <button className="ape-btn ghost sm" onClick={() => void mais30(p)}>+30 dias</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Pedido de cortesia: a pessoa recebe a página do pedido como se tivesse comprado (sem pagar). */
function Cortesia({ produtos, onDone, eu }: { produtos: Produto[]; onDone: (token: string) => void; eu?: { nome: string; email: string } }) {
  const vendaveis = produtos.filter((p) => p.ativo && noCarrinho(p))
  const [nome, setNome] = useState(eu?.nome || '')
  const [email, setEmail] = useState(eu?.email || '')
  const [cpf, setCpf] = useState('')
  const [tel, setTel] = useState('')
  const [ids, setIds] = useState<string[]>(eu ? vendaveis.filter((p) => p.cat !== 'arquivos').map((p) => p.id) : [])
  const [busy, setBusy] = useState(false)
  const criar = async () => {
    if (nome.trim().length < 3 || !ids.length) return toast('Coloque o nome e escolha o que liberar.')
    setBusy(true)
    try {
      const token = await loja.cortesia({ nome: nome.trim(), email, cpf, tel, itens: vendaveis.filter((p) => ids.includes(p.id)), obs: eu ? 'teste da dona' : 'cortesia' })
      toast('Cortesia criada: o link do pedido foi copiado.')
      void navigator.clipboard?.writeText(linkPedido(token)).catch(() => null)
      onDone(token)
    } catch (e) {
      toast(`Não consegui (${(e as Error).message}). Confira se a atualização do banco de 07/11 já rodou.`)
    }
    setBusy(false)
  }
  return (
    <div className="ape-panel ape-adm-box">
      <p className="ape-eyebrow">{eu ? 'seu acesso de teste' : 'cortesia'}</p>
      <div className="ape-frow">
        <div className="ape-f"><label>Nome</label><input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="ape-f"><label>E-mail</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      <div className="ape-frow">
        <div className="ape-f"><label><span className="ape-keep">CPF</span> (opcional; recupera em outro aparelho)</label><input value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
        <div className="ape-f"><label><span className="ape-keep">WhatsApp</span> (opcional)</label><input value={tel} onChange={(e) => setTel(e.target.value)} /></div>
      </div>
      <div className="ape-f">
        <label>O que liberar</label>
        <div className="ape-acts">
          {vendaveis.map((p) => (
            <label key={p.id} className="ape-tog"><input type="checkbox" checked={ids.includes(p.id)} onChange={(e) => setIds(e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id))} /> {p.nome}</label>
          ))}
        </div>
      </div>
      <div className="ape-acts">
        <button className="ape-btn primary" disabled={busy} onClick={() => void criar()}><ApeIcon name="gift" />{busy ? 'criando…' : 'criar e copiar o link'}</button>
      </div>
    </div>
  )
}

/* código do condomínio: quem digita entra nos orçamentos sem esperar aprovação */
function CodigoCondominio() {
  const [cod, setCod] = useState('')
  const [salvo, setSalvo] = useState('')
  useEffect(() => void admin.codigo().then((c) => { setCod(c); setSalvo(c) }), [])
  return (
    <div className="ape-panel ape-adm-box">
      <p className="ape-eyebrow">código do condomínio</p>
      <div className="ape-frow" style={{ alignItems: 'end' }}>
        <div className="ape-f"><label htmlFor="cod-sl">Código (passe no grupo dos moradores)</label><input id="cod-sl" value={cod} onChange={(e) => setCod(e.target.value)} placeholder="ex.: sanlevi2027" /></div>
        <button className="ape-btn primary" disabled={cod.trim() === salvo} onClick={() => void admin.salvarCodigo(cod).then(() => { setSalvo(cod.trim()); toast('Código salvo. Quem tiver o código entra nos orçamentos.') }, (e) => toast(String(e.message)))}>salvar código</button>
      </div>
      <span className="ape-hint">{salvo ? 'Quem se cadastrar como morador e digitar este código entra sozinho. Sem o código, você aprova um por um aqui embaixo. Trocou o código? Quem já entrou continua.' : 'Sem código, cada cadastro novo do San Levi espera a sua aprovação aqui embaixo.'}</span>
    </div>
  )
}

/* ===== depoimentos e sugestões de quem comprou ===== */
function Opinioes() {
  const [l, setL] = useState<Awaited<ReturnType<typeof painelConta.feedback>> | null>(null)
  const load = useCallback(() => void painelConta.feedback().then(setL), [])
  useEffect(load, [load])
  if (!l) return <Thinking t="carregando…" />
  if (!l.length) return <div className="ape-empty"><b>nada ainda</b><span>Depoimentos e sugestões de quem comprou aparecem aqui. Os depoimentos que você publicar aparecem na loja, só com o primeiro nome.</span></div>
  return (
    <div className="ape-rows">
      {l.map((f) => (
        <div key={f.id} className="ape-row">
          <div className="t"><b>{f.tipo === 'depoimento' ? `depoimento${f.nota ? ` · ${'★'.repeat(f.nota)}` : ''}` : 'sugestão'} · {f.nome} · {dmy(f.criado)}</b><span>{f.texto}</span></div>
          <div className="r">{f.tipo === 'depoimento' && <button className={`ape-btn sm ${f.publicado ? 'rose' : 'primary'}`} onClick={() => void painelConta.publicar(f.id, !f.publicado).then(load, (e) => toast(String(e.message)))}>{f.publicado ? 'tirar da loja' : 'publicar na loja'}</button>}</div>
        </div>
      ))}
    </div>
  )
}

/* ===== testar como cliente: a dona vê a compra e o pós-compra como quem compra ===== */
/** Um toque: a dona vira cliente com tudo liberado (todos os arquivos, plataforma e o bônus já aberto). */
function TudoLiberado({ produtos, onDone }: { produtos: Produto[]; onDone: () => void }) {
  const [email, setEmail] = useState(() => localStorage.getItem('ape-teste-email') || 'lala.av03@gmail.com')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const vendaveis = produtos.filter((p) => p.ativo && noCarrinho(p))
  const completo = vendaveis.find((p) => p.id === 'kit-completo')
  const itens = [...(completo ? [completo] : vendaveis.filter((p) => p.cat === 'arquivos')), ...vendaveis.filter((p) => p.cat === 'plataforma')]
  const liberar = async () => {
    if (!emailOk(email)) return toast('Coloque um e-mail válido (é com ele que você entra em minha conta).')
    setBusy(true)
    try {
      try { localStorage.setItem('ape-teste-email', email) } catch { /* sem armazenamento */ }
      const t = await loja.cortesia({ nome: 'Laís (teste)', email, cpf: '', tel: '', itens, obs: 'teste da dona', bonusJa: true })
      setToken(t)
      onDone()
      toast('Tudo liberado para você.')
    } catch (e) {
      toast(`Não consegui (${(e as Error).message}).`)
    }
    setBusy(false)
  }
  return (
    <div className="ape-panel ape-adm-box ape-tudo">
      <p className="ape-eyebrow">testar como cliente</p>
      <h3 style={{ margin: 0 }}>tudo liberado, num toque</h3>
      <p className="ape-note" style={{ margin: 0 }}>Cria uma compra de teste (sem pagar) com os {completo ? (completo.combo || []).length : itens.length} arquivos, a plataforma do apê e o bônus já aberto. Não entra nas vendas nem nos valores.</p>
      <div className="ape-frow">
        <div className="ape-f"><label htmlFor="t-email">E-mail para entrar em minha conta</label><input id="t-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      {!token ? (
        <div className="ape-acts"><button className="ape-btn primary" disabled={busy} onClick={() => void liberar()}><ApeIcon name="sparkle" />{busy ? 'liberando…' : 'liberar tudo para mim'}</button></div>
      ) : (
        <div className="ape-tudo-links">
          <a className="ape-btn primary" href={href('ape', `pedido:${token}`)} target="_blank" rel="noreferrer"><ApeIcon name="download" />arquivos, bônus e plataforma</a>
          <a className="ape-btn" href={href('ape', 'conta')} target="_blank" rel="noreferrer"><ApeIcon name="user" />minha conta</a>
          <a className="ape-btn" href={href('ape', 'loja')} target="_blank" rel="noreferrer"><ApeIcon name="bag" />loja</a>
          <a className="ape-btn" href={href('ape')} target="_blank" rel="noreferrer"><ApeIcon name="home" />área do San Levi</a>
          <span className="ape-note">Em minha conta, use "primeiro acesso" com {email} para criar a senha (o código chega nesse e-mail).</span>
        </div>
      )}
    </div>
  )
}

/** Testa os e-mails (Brevo): manda um para a dona e mostra a resposta. */
function TestarEmail() {
  const [r, setR] = useState<{ ok: boolean; status?: number; para?: string; remetente?: string; detalhe?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const testar = async () => {
    setBusy(true)
    try { setR(await painelConta.testarEmail()) } catch (e) { setR({ ok: false, detalhe: (e as Error).message }) }
    setBusy(false)
  }
  return (
    <div className="ape-panel ape-adm-box">
      <p className="ape-eyebrow">e-mails</p>
      <p className="ape-note" style={{ margin: 0 }}>Manda um e-mail de teste para você e mostra o que o Brevo respondeu. Se não chegar, olhe o spam.</p>
      <div className="ape-acts"><button className="ape-btn sm" disabled={busy} onClick={() => void testar()}><ApeIcon name="send" />{busy ? 'enviando…' : 'testar e-mail'}</button></div>
      {r && (
        <div className={`ape-banner ${r.ok ? '' : 'warn'}`}>
          {r.ok ? <>Enviado para <b>{r.para}</b> (remetente {r.remetente}). Confira a caixa de entrada e o spam.</> : <>Não foi{r.status ? ` (Brevo ${r.status})` : ''}: {r.detalhe || 'sem resposta'}{r.remetente ? ` · remetente: ${r.remetente}` : ''}</>}
        </div>
      )}
    </div>
  )
}

function Testar({ produtos, pedidos, onChange }: { produtos: Produto[]; pedidos: PedidoAdmin[]; onChange: () => void }) {
  const meus = pedidos.filter((p) => p.cortesia && p.obs === 'teste da dona')
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="ape-vercli">
        {([
          ['bag', 'loja', 'como um visitante vê', href('ape', 'loja')],
          ['building', `área do ${APE.condominio}`, 'orçamentos dos moradores', href('ape')],
          ['user', 'minha conta', 'compras, plataforma e bônus', href('ape', 'conta')],
          ['smartphone', 'minha plataforma', 'a plataforma que você vende', href('ape', `minha:${(() => { try { return JSON.parse(localStorage.getItem('ape-plat') || 'null') || 'demo' } catch { return 'demo' } })()}`)],
        ] as const).map(([i, t, d, h]) => (
          <a key={t} className="ape-vercli-i" href={h} target="_blank" rel="noreferrer"><Icon name={i} size={22} /><b>{t}</b><small>{d}</small></a>
        ))}
      </div>
      <TudoLiberado produtos={produtos} onDone={onChange} />
      <TestarEmail />
      <p className="ape-note" style={{ margin: 0 }}>O acesso de teste é uma compra de cortesia (sem pagar): página do pedido, downloads com o seu nome no rodapé, bônus já aberto e a plataforma, sem vencer até você tirar o acesso. Para testar o pagamento de verdade, faça uma compra pequena na loja e depois reembolse em "vendas".</p>
      {meus.length > 0 && (
        <div className="ape-rows">
          {meus.map((p) => (
            <div key={p.id} className="ape-row">
              <div className="t"><b>Teste de {dmy(p.criado)}</b><span title={p.itens.map((i) => i.nome).join(' + ')}>{resumoItens(p.itens)}</span></div>
              <div className="r"><a className="ape-btn primary sm" href={href('ape', `pedido:${p.token}`)} target="_blank" rel="noreferrer"><ApeIcon name="eye" />abrir como cliente</a></div>
            </div>
          ))}
        </div>
      )}
      <Cortesia produtos={produtos} eu={{ nome: 'Laís (teste)', email: '' }} onDone={(token) => { onChange(); window.open(href('ape', `pedido:${token}`), '_blank') }} />
    </div>
  )
}

/* ===== arquivos que a loja entrega (pasta privada) ===== */
type ArqLoja = { nome: string; tamanho: number; em?: string }
const ehPlanilha = (n: string) => /\.(xlsx?|csv)$/i.test(n)
const kb = (t: number) => (t >= 1024 * 1024 ? `${(t / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(t / 1024))} KB`)
const dataCurta = (d?: string) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '')

function Entregas({ produtos }: { produtos: Produto[] }) {
  const itens = useMemo(() => [...produtos.filter((p) => p.cat === 'arquivos' || !p.cat), { id: BONUS.id, nome: `Bônus: ${BONUS.nome}`, desc: '', preco: '', tag: 'chega no 8º dia', ativo: true, fase: 'bonus' } as unknown as Produto], [produtos])
  const [arqs, setArqs] = useState<Record<string, ArqLoja[]>>({})
  const [carregou, setCarregou] = useState(false)
  const [busy, setBusy] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'sem' | 'pdf' | 'planilha'>('todos')
  const [ver, setVer] = useState<{ id: string; nome: string; arq: string; url: string; v: number } | null>(null)
  const load = useCallback(async () => {
    const out: Record<string, ArqLoja[]> = {}
    await Promise.all(itens.map(async (p) => { out[p.id] = await loja.arquivos(p.id).catch(() => []) }))
    setArqs(out)
    setCarregou(true)
  }, [itens])
  useEffect(() => { void load() }, [load])

  const abrir = async (id: string, nome: string, arq: string) => {
    try {
      setVer({ id, nome, arq, url: await loja.urlArquivo(id, arq), v: Date.now() })
    } catch (e) {
      toast((e as Error).message)
    }
  }
  /** Trocar: guarda o novo e tira o antigo do mesmo tipo (se o nome mudou). Assim nunca ficam dois PDFs no mesmo produto. */
  const trocar = async (id: string, f: File | undefined, antigo?: string) => {
    if (!f) return
    setBusy(id)
    try {
      await loja.enviarArquivo(id, f)
      const novoNome = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.() -]+/g, '-')
      const velho = antigo ?? (arqs[id] || []).find((a) => ehPlanilha(a.nome) === ehPlanilha(novoNome) && !ehPlanilha(novoNome))?.nome
      if (velho && velho !== novoNome) await loja.apagarArquivo(id, velho).catch(() => null)
      toast('Arquivo trocado: quem comprar a partir de agora recebe este.')
      await load()
      if (ver?.id === id) await abrir(id, ver.nome, novoNome)
    } catch (e) {
      toast(`Não consegui enviar (${(e as Error).message}).`)
    }
    setBusy('')
  }
  const enviarVarios = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy('varios')
    const sem: string[] = []
    for (const f of Array.from(files)) {
      const base = f.name.replace(/\.[^.]+$/, '').toLowerCase()
      const p = itens.find((x) => x.id === base) || [...itens].sort((a, b) => b.id.length - a.id.length).find((x) => base.startsWith(x.id + '-') || base.startsWith(x.id + '_'))
      if (!p) { sem.push(f.name); continue }
      await loja.enviarArquivo(p.id, f).catch(() => sem.push(f.name))
    }
    setBusy('')
    toast(sem.length ? `Enviados, menos: ${sem.join(', ')} (o nome não bate com nenhum produto).` : 'Todos os arquivos foram guardados.')
    await load()
  }
  const apagar = async (id: string, nome: string) => {
    if (!(await ask(`Tirar o arquivo ${nome}? Quem comprar não recebe mais ele.`, { confirmLabel: 'tirar', danger: true }))) return
    await loja.apagarArquivo(id, nome).then(load, () => toast('Não consegui tirar.'))
    if (ver?.arq === nome) setVer(null)
  }

  const com = itens.filter((p) => (arqs[p.id] || []).length).length
  const q = busca.trim().toLowerCase()
  const visiveis = itens.filter((p) => {
    const l = arqs[p.id] || []
    if (q && !p.nome.toLowerCase().includes(q) && !p.id.includes(q)) return false
    if (filtro === 'sem') return !l.length
    if (filtro === 'pdf') return l.some((a) => !ehPlanilha(a.nome))
    if (filtro === 'planilha') return l.some((a) => ehPlanilha(a.nome))
    return true
  })
  const GRUPOS: [string, string][] = [['comprando', 'para quem vai comprar'], ['comprei', 'para quem já comprou'], ['escolhas', 'escolhas da casa'], ['bonus', 'bônus']]
  const faseDe = (p: Produto) => String((p as { fase?: string }).fase || 'comprei')

  return (
    <div className="ape-arqs">
      <div className="ape-panel ape-arqs-topo">
        <div className="ape-arqs-resumo">
          <div>
            <b>{carregou ? `${com} de ${itens.length}` : '…'}</b>
            <span>produtos com arquivo pronto para entregar</span>
          </div>
          <span className="ape-arqs-barra" aria-hidden="true"><i style={{ width: `${itens.length ? (com / itens.length) * 100 : 0}%` }} /></span>
        </div>
        <div className="ape-arqs-ferr">
          <input className="ape-arqs-busca" type="search" placeholder="procurar arquivo" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Procurar arquivo" />
          <div className="ape-seg ape-arqs-filtro" role="radiogroup">
            {([['todos', 'todos'], ['sem', 'sem arquivo'], ['pdf', 'PDFs'], ['planilha', 'planilhas']] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={filtro === k} onClick={() => setFiltro(k)}>{l}</button>
            ))}
          </div>
          <label className="ape-btn sm" style={{ cursor: 'pointer' }}>
            <ApeIcon name="plus" />{busy === 'varios' ? 'enviando…' : 'enviar vários'}
            <input type="file" hidden multiple accept=".pdf,.xlsx,.xls,application/pdf" onChange={(e) => void enviarVarios(e.target.files)} />
          </label>
        </div>
        <Recolhe titulo="como funciona">
          <p className="ape-hint">Cada produto entrega o arquivo guardado aqui (pasta privada: só quem pagou baixa, por link temporário). Os PDFs saem com o nome de quem comprou no rodapé. Para editar: abra o PDF no Canva, ajuste, baixe como PDF e toque em <b>trocar</b>. Em "enviar vários", o nome do arquivo diz o produto: "checklist.pdf", "planilha-compra-rosa.xlsx", "bonus.pdf".</p>
        </Recolhe>
        {!apeCloud && <div className="ape-banner warn">Na prévia os arquivos não ficam guardados.</div>}
      </div>

      {GRUPOS.map(([g, titulo]) => {
        const lista = visiveis.filter((p) => faseDe(p) === g)
        if (!lista.length) return null
        return (
          <section key={g} className="ape-arqs-grupo">
            <p className="ape-eyebrow">{titulo} <small>{lista.length}</small></p>
            <div className="ape-arqs-grade">
              {lista.map((p) => {
                const l = arqs[p.id] || []
                const pdf = l.find((a) => !ehPlanilha(a.nome))
                return (
                  <article key={p.id} className={`ape-arq ${l.length ? '' : 'falta'}`}>
                    <button type="button" className="ape-arq-capa" onClick={() => pdf ? void abrir(p.id, p.nome, pdf.nome) : l[0] && void abrir(p.id, p.nome, l[0].nome)} disabled={!l.length} aria-label={`Ver ${p.nome}`}>
                      <ApeIcon name={l.length ? (pdf ? 'file' : 'tag') : 'alert'} />
                      <span>{l.length ? (pdf ? 'ver PDF' : 'ver planilha') : 'sem arquivo'}</span>
                    </button>
                    <div className="ape-arq-info">
                      <b>{p.nome}</b>
                      {l.length ? (
                        <ul>
                          {l.map((f) => (
                            <li key={f.nome}>
                              <button type="button" className="ape-arq-nome" onClick={() => void abrir(p.id, p.nome, f.nome)} title="ver">{f.nome}</button>
                              <small>{kb(f.tamanho)}{f.em ? ` · ${dataCurta(f.em)}` : ''}</small>
                              <button type="button" className="ape-icobtn" onClick={() => void apagar(p.id, f.nome)} aria-label={`Tirar ${f.nome}`}><ApeIcon name="trash" /></button>
                            </li>
                          ))}
                        </ul>
                      ) : <span className="ape-arq-falta">quem comprar não recebe nada: envie o arquivo</span>}
                    </div>
                    <label className={`ape-btn sm ${l.length ? '' : 'primary'}`} style={{ cursor: 'pointer' }}>
                      <ApeIcon name={l.length ? 'share' : 'plus'} />{busy === p.id ? 'enviando…' : l.length ? 'trocar' : 'enviar'}
                      <input type="file" hidden accept=".pdf,.xlsx,.xls,.zip,.docx,application/pdf" onChange={(e) => void trocar(p.id, e.target.files?.[0])} />
                    </label>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
      {!visiveis.length && <div className="ape-panel ape-empty"><b>nada por aqui</b><span>Mude a busca ou o filtro.</span></div>}

      {ver && (
        <div className="ape-sheet ape-prev" onClick={(e) => e.target === e.currentTarget && setVer(null)}>
          <div className="ape-sheet-in ape-prev-in" role="dialog" aria-label={`Prévia: ${ver.nome}`}>
            <header className="ape-prev-top">
              <div><b>{ver.nome}</b><small>{ver.arq} · como está guardado (o nome do cliente entra no rodapé na hora do download)</small></div>
              <button type="button" className="ape-icobtn" onClick={() => setVer(null)} aria-label="Fechar"><ApeIcon name="x" /></button>
            </header>
            {ehPlanilha(ver.arq)
              ? <div className="ape-prev-vazio"><ApeIcon name="tag" /><b>Planilhas não abrem aqui</b><span>Baixe para conferir no Excel ou no Google Planilhas.</span></div>
              : <iframe key={ver.v} className="ape-prev-frame" src={`${ver.url}#view=FitH`} title={`Prévia de ${ver.nome}`} />}
            <footer className="ape-prev-acts">
              <a className="ape-btn sm" href={ver.url} target="_blank" rel="noreferrer"><ApeIcon name="eye" />abrir em tela cheia</a>
              <a className="ape-btn sm" href={ver.url} download={ver.arq}><ApeIcon name="download" />baixar</a>
              <label className="ape-btn sm primary" style={{ cursor: 'pointer' }}>
                <ApeIcon name="share" />{busy === ver.id ? 'enviando…' : 'trocar este arquivo'}
                <input type="file" hidden accept=".pdf,.xlsx,.xls,application/pdf" onChange={(e) => void trocar(ver.id, e.target.files?.[0], ver.arq)} />
              </label>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
