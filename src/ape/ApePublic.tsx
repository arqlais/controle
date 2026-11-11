import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { href, useRoute } from '../router'
import { sessaoLocal, cadastrar, conferirCadastro, marcarDona, registrarVisita, nomeLocal, codigoSL, euMorador, mesmoAp, loadPublico, moradorConta, souDona, apeCloud, type Publico } from './api'
import { ApeArt } from './ApeArt'
import { ApeIcon } from './ApeIcon'
import {
  APE, digits, firstName, fmtTel, wa,
  ehSanLevi, ondeMora, type Morador,
} from './model'
import { BotaoCarrinho, MenuConta, Voltar } from './Navega'
import { SanLeviArte } from './SanLevi'
import { ehPet, EditarFamilia, type Membro } from './Familia'
import { Assinatura, AvisoCookies, MARK_SVG, mascaraTel, read, useCarrinho, useToast, write } from './shared'
import { Checkout, Loja, PedidoPage } from './Loja'
import { Enviar } from './Enviar'
import { Plataforma } from './Plataforma'
import { Conta } from './Conta'
import { Orcamentos } from './Orcamentos'
import { Protege } from './Protege'
import { CaixaDona, FaleComigo } from './FaleComigo'
import './ape.css'

/* Página pública do planê apzinho: os moradores do San Levi se cadastram, comparam os orçamentos,
   mandam os seus e escolhem com quem fechar. A loja e a plataforma ficam em Loja.tsx e Plataforma.tsx. */

const CAD = 'ape-cadastro'

type View = 'orcamentos' | 'enviar' | 'loja' | 'pedido' | 'checkout' | 'minha' | 'entrar' | 'conta'

export function ApePublic({ sub }: { sub?: string }) {
  const route = useRoute()
  const view: View = sub === 'enviar' ? 'enviar' : sub?.startsWith('loja') ? 'loja' : sub?.startsWith('pedido:') ? 'pedido' : sub === 'checkout' ? 'checkout' : sub?.startsWith('minha:') ? 'minha' : sub?.startsWith('entrar:') ? 'entrar' : sub?.startsWith('conta') ? 'conta' : 'orcamentos'
  const abrir = sub?.startsWith('loja:') ? sub.slice(5) : undefined
  const [d, setD] = useState<Publico | null | undefined>(undefined)
  const [owner, setOwner] = useState(false)
  const [me, setMe] = useState<Morador | null>(() => read<Morador>(CAD))
  const [editing, setEditing] = useState(false)
  const [toast, show] = useToast()

  useEffect(() => {
    document.title = `Planê apzinho · ${location.pathname.includes("sanlevi") ? `orçamentos do ${APE.condominio}` : "do contrato às chaves"}`
    // "adicionar à tela de início" abre direto o planê apzinho, com o ícone dele
    const swap = (sel: string, attr: string, val: string) => {
      const el = document.querySelector<HTMLLinkElement | HTMLMetaElement>(sel)
      if (!el) return () => undefined
      const old = el.getAttribute(attr) || ''
      el.setAttribute(attr, val)
      return () => el.setAttribute(attr, old)
    }
    const undo = [swap('link[rel="manifest"]', 'href', 'ape/manifest.webmanifest'), swap('link[rel="apple-touch-icon"]', 'href', 'ape/icon-180.png'), swap('meta[name="apple-mobile-web-app-title"]', 'content', 'planê apzinho')]
    souDona().then(setOwner, () => setOwner(false))
    return () => undo.forEach((f) => f())
  }, [])
  // link "usar em outro aparelho": guarda o cadastro neste aparelho e segue para os orçamentos
  useEffect(() => {
    if (view !== 'entrar') return
    void euMorador(sub!.slice(7)).then((m) => {
      if (m) {
        setMe(m)
        write(CAD, m)
        show(`Pronto, ${firstName(m.nome)}: este aparelho já está com o seu cadastro.`)
      } else show('Link de acesso inválido. Faça o cadastro de novo.')
      location.hash = '#/ape'
    })
  }, [view])
  // o cadastro guardado neste aparelho pode ter ficado velho (cadastros repetidos apagados): acha o certo pela conta
  useEffect(() => {
    let vivo = true
    void conferirCadastro(me).then((m) => {
      if (!vivo || m === undefined) return
      if (m && (m.id !== me?.id || m.aprovado !== me?.aprovado || m.condominio !== me?.condominio)) { setMe(m); write(CAD, m) }
      else if (!m && me?.id) { setMe(null); try { localStorage.removeItem(CAD) } catch { /* ok */ } show('O cadastro deste aparelho estava desatualizado. Entre de novo com o seu e-mail para ver os orçamentos.') }
    })
    return () => { vivo = false }
  }, [me?.id])
  // os orçamentos dependem de quem é: morador do San Levi (ou a dona) vê; os outros, não
  const recarregar = () => loadPublico(me, owner).then(setD, () => setD(null))
  useEffect(() => {
    void recarregar()
  }, [me?.id, me?.condominio, owner])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.id])
  // visitas do site (a dona não conta: o aparelho dela fica marcado quando ela abre logada)
  useEffect(() => { if (owner) marcarDona() }, [owner])
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (owner) return
      const pg = location.pathname.includes('sanlevi') && view === 'orcamentos' ? 'san levi' : view === 'loja' ? (abrir?.startsWith('arquivos') ? 'arquivos' : 'loja') : view === 'minha' ? 'plataforma' : view === 'orcamentos' ? 'san levi' : view
      void registrarVisita(pg)
    }, 1500)
    return () => window.clearTimeout(t)
  }, [route.id, sub, owner])

  const vis = useMemo(() => (d ? d.orcamentos.filter((o) => (owner || !apeCloud ? true : !o.exemplo && !o.oculto)) : []), [d, owner])
  const whats = d?.ajustes.whatsapp || APE.whatsapp

  const onCadastro = (m: Morador) => {
    setMe(m)
    write(CAD, m)
    setEditing(false)
  }

  if (view === 'minha') return <div className="ape"><Protege chave={sub || ''} whats={whats}><Plataforma token={sub!.slice(6)} whats={whats} /></Protege>{!owner && <FaleComigo me={me} whats={whats} origem="cliente" />}</div>

  // loja, checkout e pedido: página de vendas aberta a todos; orçamentos e envio: só moradores do San Levi
  const publico = view === 'loja' || view === 'checkout' || view === 'pedido' || view === 'conta'
  const morador = !!me && ehSanLevi(me)
  // a dona vê os orçamentos sem cadastro; para ENVIAR, ela também precisa de um (vira moradora como os outros)
  const pedeCadastro = !publico && view !== 'entrar' && (editing || (!me && !(owner && view === 'orcamentos')))
  return (
    <div className={`ape ${publico ? 'ape-publico' : ''}`}>
      {publico ? (
        <ShopNav morador={morador || owner} owner={owner} nome={me?.nome || nomeLocal()} voltar={view !== 'loja'} />
      ) : (
        <header className="ape-top ape-shopnav">
          <div className="wrap ape-brand">
            {view !== 'orcamentos' && <Voltar para={href('ape')} />}
            <a className="ape-logo" href={href('ape')} aria-label={`${APE.name}: início`}>
              <span className="ape-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
              <div>
                <h1>planê<span> apzinho</span></h1>
                <small>{APE.condominio} · só moradores</small>
              </div>
            </a>
            {(morador || owner) && (
            <nav className="ape-shoplinks" aria-label="Seções">
              <a href={href('ape')} aria-current={view === 'orcamentos' ? 'page' : undefined}>orçamentos <span className="cnt num">{vis.length}</span></a>
              <a href={href('ape', 'enviar')} aria-current={view === 'enviar' ? 'page' : undefined}>enviar</a>
              <a href={href('ape', 'loja')}>loja</a>
            </nav>
            )}
            <MenuConta nome={me?.nome} owner={owner} morador={!!me && ehSanLevi(me)} so={['plataforma', 'conta']} extra={me ? [{ l: `meus dados${ondeMora(me) ? ` (${ehSanLevi(me) && me.torre ? `T${me.torre} · ${me.ap}` : ondeMora(me)})` : ''}`, i: 'edit', onClick: () => setEditing(true) }] : []} />
            <CarrinhoTopo />
          </div>
        </header>
      )}
      <main className="wrap ape-main">
        <Protege chave={`${view}/${sub || ''}`} whats={whats}>
        {d === undefined || view === 'entrar' ? (
          <div className="ape-panel ape-empty">
            <span className="ape-thinking">
              <span className="ape-dots"><i /><i /><i /></span>carregando…
            </span>
          </div>
        ) : d === null ? (
          <div className="ape-panel ape-empty">
            <b>a página não abriu</b>
            <span>Confira a internet e tente de novo em instantes.</span>
            <button className="ape-btn" onClick={() => void recarregar()}>tentar de novo</button>
          </div>
        ) : (view === 'orcamentos' || view === 'enviar') && d.pendente && me ? (
          <CodigoSL me={me} whats={whats} onOk={() => { const m = { ...me, aprovado: true }; setMe(m); write(CAD, m); void recarregar() }} />
        ) : (view === 'orcamentos' || view === 'enviar') && !morador && !owner ? (
          <section className="ape-panel ape-empty ape-trancado">
            <span className="ic"><ApeIcon name="lock" /></span>
            <b>área exclusiva dos moradores do {APE.condominio}</b>
            <span>Os orçamentos do grupo só aparecem para quem mora no {APE.condominio}. {me ? 'O seu cadastro não está marcado como morador daqui.' : 'Entre ou faça o seu cadastro para ver.'}</span>
            <div className="ape-acts">
              {!me && <button className="ape-btn primary" onClick={() => setEditing(true)}><ApeIcon name="user" />entrar ou cadastrar</button>}
              <a className="ape-btn" href={href('ape', 'loja')}><ApeIcon name="bag" />ver a loja do apê</a>
            </div>
          </section>
        ) : view === 'orcamentos' ? (
          <Orcamentos vis={vis} d={d} owner={owner} me={me} whats={whats} show={show} onCount={(id, n) => setD({ ...d, contagens: { ...d.contagens, [id]: n } })} onEscolha={(id, _nicho, ficou) => {
            // pode escolher mais de um no mesmo serviço: marca ou desmarca só este
            const escolhas = { ...d.escolhas, [id]: Math.max(0, (d.escolhas[id] || 0) + (ficou ? 1 : -1)) }
            setD({ ...d, escolhas, minhas: ficou ? [...d.minhas.filter((x) => x !== id), id] : d.minhas.filter((x) => x !== id) })
          }} onEditar={() => setEditing(true)} onRecarregar={() => void recarregar()} />
        ) : view === 'enviar' ? (
          <Enviar me={me} whats={whats} orcamentos={vis} meusIds={d.meus} onPublicado={() => void recarregar()} onCadastro={() => setEditing(true)} />
        ) : view === 'checkout' ? (
          <Checkout ajustes={d.ajustes} me={me} whats={whats} />
        ) : view === 'conta' ? (
          <Conta sub={sub} whats={whats} />
        ) : view === 'pedido' ? (
          <PedidoPage token={sub!.slice(7)} whats={whats} produtos={d.ajustes.produtos} />
        ) : (
          <Loja key={abrir || 'loja'} ajustes={d.ajustes} me={me} whats={whats} abrir={abrir} />
        )}
        </Protege>
        <Assinatura />
      </main>
      {owner ? <CaixaDona /> : <FaleComigo me={me} whats={whats} origem={morador ? 'sanlevi' : sessaoLocal() ? 'cliente' : 'visitante'} />}
      {(morador || owner) && (
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
          <a href={href('ape', 'loja')} aria-current={view === 'loja' || view === 'checkout' ? 'page' : undefined}>
            <ApeIcon name="bag" />
            loja
          </a>
        </nav>
      )}
      {!publico && (
        <p className="ape-foot">
          Os orçamentos são enviados por quem está montando o apê e aparecem como foram recebidos. A página só organiza e compara: confira valores, prazos e condições direto com o fornecedor antes de fechar. Não temos vínculo com os fornecedores nem participamos das negociações.
        </p>
      )}
      <AvisoCookies />
      {pedeCadastro && <Cadastro me={me} owner={owner} onDone={onCadastro} onCancel={me ? () => setEditing(false) : owner ? () => { setEditing(false); location.hash = '#/ape' } : () => { location.hash = '#/ape/loja' }} />}
      {toast}
    </div>
  )
}

/* ===== área do San Levi fechada: código do condomínio ou aprovação da Laís ===== */
function CodigoSL({ me, whats, onOk }: { me: Morador; whats: string; onOk: () => void }) {
  const [cod, setCod] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    if (!cod.trim()) return setMsg('Digite o código.')
    setBusy(true)
    try {
      if (await codigoSL(me.id, cod)) onOk()
      else setMsg('Código não confere. Confira no grupo dos moradores.')
    } catch (x) {
      setMsg(String((x as Error).message))
    }
    setBusy(false)
  }
  return (
    <section className="ape-conta-login">
      <form className="ape-panel ape-form" onSubmit={entrar} noValidate>
        <ApeIcon name="shield" size={28} />
        <div>
          <p className="ape-eyebrow ape-eyebrow-sl"><SanLeviArte size={34} />área dos moradores do {APE.condominio}</p>
          <h2 className="ape-h2">falta o <em>código</em> do condomínio</h2>
          <p className="ape-note" style={{ margin: '4px 0 0' }}>Os orçamentos ficam só entre os vizinhos. Digite o código que a {APE.dona} passou no grupo dos moradores, ou peça para ela aprovar o seu cadastro (T{me.torre} · {me.ap}).</p>
        </div>
        <div className="ape-f"><label htmlFor="sl-cod">Código do condomínio</label><input id="sl-cod" value={cod} onChange={(e) => setCod(e.target.value)} autoComplete="off" /></div>
        {msg && <p className="ape-err" role="alert">{msg}</p>}
        <button className="ape-btn primary" type="submit" disabled={busy}>{busy ? 'conferindo…' : 'entrar'}</button>
        <a className="ape-btn" href={wa(whats, `Oi, ${APE.dona}! Sou ${me.nome}, T${me.torre} · ${me.ap} do ${APE.condominio}. Pode aprovar o meu cadastro nos orçamentos?`)} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />pedir aprovação no WhatsApp</a>
      </form>
    </section>
  )
}

/* ===== menu da página de vendas (loja aberta a todos) ===== */
function CarrinhoTopo() {
  const cart = useCarrinho()
  return <BotaoCarrinho n={cart.ids.length} />
}

function ShopNav({ morador, owner = false, nome, voltar }: { morador: boolean; owner?: boolean; nome?: string; voltar?: boolean }) {
  const cart = useCarrinho()
  const n = cart.ids.length
  const ir = (id: string) => {
    if (!location.hash.startsWith('#/ape/loja') || location.hash.startsWith('#/ape/loja:arquivos')) location.hash = '#/ape/loja'
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 160)
  }
  return (
    <header className="ape-top ape-shopnav">
      <div className="wrap ape-brand">
        {voltar && <Voltar para={href('ape', 'loja')} />}
        <a className="ape-logo" href={href('ape', 'loja')} aria-label={`${APE.name}: loja`}>
          <span className="ape-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
          <div>
            <h1>planê<span> apzinho</span></h1>
            <small>do contrato às chaves</small>
          </div>
        </a>
        <nav className="ape-shoplinks" aria-label="Loja">
          <button onClick={() => { location.hash = '#/ape/loja:arquivos' }}>arquivos</button>
          <button onClick={() => { location.hash = '#/ape/loja:arquivos-kits' }}>kits</button>
          <button onClick={() => ir('loja-plataforma')}>plataforma</button>
          <button onClick={() => ir('loja-servicos')}>projetos</button>
        </nav>
        <MenuConta nome={nome} owner={owner} morador={morador} so={['sanlevi', 'plataforma', 'conta']} />
        <BotaoCarrinho n={n} />
      </div>
    </header>
  )
}

/* ===== cadastro ===== */
function Cadastro({ me, owner, onDone, onCancel }: { me: Morador | null; owner?: boolean; onDone: (m: Morador) => void; onCancel?: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const [modo, setModo] = useState<'novo' | 'entrar'>('novo')
  const [familia, setFamilia] = useState<Membro[]>([{ id: 'eu', nome: '', tipo: 'adulto', papel: 'eu' }])
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const m = await moradorConta('entrar', { email: email.trim().toLowerCase(), senha })
      if (m) onDone(m)
      else setErr('Essa conta ainda não tem cadastro de morador. Toque em "criar conta".')
    } catch (x) {
      setErr(String((x as Error).message))
    }
    setBusy(false)
  }
  const [nome, setNome] = useState(me?.nome || '')
  const [sl, setSl] = useState(me ? ehSanLevi(me) : true)
  const [cond, setCond] = useState(me && !ehSanLevi(me) ? me.condominio || '' : '')
  const [torre, setTorre] = useState(me?.torre || '')
  const [ap, setAp] = useState(me?.ap || '')
  const [tel, setTel] = useState(me?.tel ? fmtTel(me.tel) : '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // mesmo apê com outro nome: pergunta se mora junto (mostra só o primeiro nome e a inicial)
  const [outros, setOutros] = useState<string[]>([])
  const [junto, setJunto] = useState<boolean | null>(me?.moraJunto ? true : null)
  useEffect(() => {
    if (!sl || !torre.trim() || !ap.trim()) return setOutros([])
    const t = window.setTimeout(() => {
      mesmoAp(torre, ap, me?.id).then((l) => {
        setOutros(l)
        if (!l.length) setJunto(null)
      }, () => setOutros([]))
    }, 500)
    return () => window.clearTimeout(t)
  }, [sl, torre, ap])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const m = { nome: nome.trim().replace(/\s+/g, ' '), condominio: sl ? APE.condominio : cond.trim(), torre: sl ? torre.trim() : '', ap: sl ? ap.trim() : '', tel: digits(tel), moraJunto: !!(outros.length && junto) }
    if (m.nome.split(' ').length < 2) return setErr('Coloque o nome completo.')
    if (sl && (!m.torre || !m.ap)) return setErr('Coloque a torre e o apê.')
    if (sl && outros.length && junto !== true) return setErr(junto === false ? 'Confira a torre e o apê.' : `Este apê já tem cadastro (${outros.join(', ')}). Confirme se você mora junto.`)
    if (m.tel.length < 10 || m.tel.length > 13) return setErr('Coloque o WhatsApp com DDD.')
    if (!me && apeCloud) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr('Coloque um e-mail válido.')
      if (senha.length < 8) return setErr('A senha precisa de pelo menos 8 caracteres.')
    }
    setErr('')
    setBusy(true)
    try {
      if (!me && apeCloud) {
        const novo = await moradorConta('morador', { ...m, junto: m.moraJunto, email: email.trim().toLowerCase(), senha, pessoas: familia.filter((x) => !ehPet(x.tipo)).length || null, familia: familia.map((x, i) => ({ tipo: x.tipo, nome: (x.nome || (i === 0 ? nome.trim().split(' ')[0] : '')).trim(), papel: (x.papel || '').trim() })) })
        if (novo) onDone(novo)
      } else {
        const id = await cadastrar({ ...m, id: me?.id })
        onDone({ ...m, id, aprovado: me?.aprovado ?? true })
      }
    } catch (e) {
      setErr(`Não deu para entrar agora (${(e as Error).message}). Confira a internet e tente de novo.`)
    }
    setBusy(false)
  }

  return (
    <div className="ape-gate" role="dialog" aria-modal="true" aria-labelledby="g-t" onClick={(e) => e.target === e.currentTarget && onCancel?.()} onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}>
      {onCancel && <button type="button" className="ape-gate-x" onClick={onCancel} aria-label="Fechar"><ApeIcon name="x" /></button>}
      {modo === 'entrar' && !me ? (
        <form onSubmit={entrar} noValidate>
          <SanLeviArte size={52} className="ape-gate-sl" />
          <h2 id="g-t">entrar na <em>sua conta</em></h2>
          <p>Use o e-mail e a senha do seu cadastro.</p>
          <div className="ape-f"><label htmlFor="g-email2">E-mail</label><input id="g-email2" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="ape-f"><label htmlFor="g-senha2">Senha</label><input id="g-senha2" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
          {err && <p className="ape-err" role="alert">{err}</p>}
          <button className="ape-btn primary wide" type="submit" disabled={busy}>{busy ? 'entrando…' : 'entrar'}</button>
          <div className="ape-conta-links">
            <button type="button" className="ape-linkish ape-link" onClick={() => { setModo('novo'); setErr('') }}>criar conta</button>
            <a className="ape-link" href={href('ape', 'conta')}>esqueci a senha</a>
          </div>
        </form>
      ) : (
      <form onSubmit={submit} noValidate>
        <SanLeviArte size={52} className="ape-gate-sl" />
        <h2 id="g-t">
          {me ? <>seus <em>dados</em></> : <>boas-vindas ao <em>planê apzinho</em></>}
        </h2>
        {owner && !me ? (
          <p>Você está logada como dona e já vê todos os orçamentos. Para <b>enviar</b> orçamentos como moradora, faça o seu cadastro aqui (fica guardado neste aparelho).</p>
        ) : !me ? (
          <p>Os orçamentos são só dos moradores do {APE.condominio}. Crie a sua conta em 1 minuto: seus dados não aparecem para os vizinhos. O <span className="ape-keep">CPF</span> só é pedido se um dia você comprar algo na loja.</p>
        ) : null}
        <div className="ape-f">
          <label htmlFor="g-nome">Nome completo</label>
          <input id="g-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="ape-f">
          <label>Onde é o seu apê?</label>
          <div className="ape-seg" role="radiogroup">
            <button type="button" role="radio" aria-checked={sl} onClick={() => setSl(true)}>{APE.condominio}</button>
            <button type="button" role="radio" aria-checked={!sl} onClick={() => setSl(false)}>outro lugar</button>
          </div>
        </div>
        {sl ? (
          <div className="ape-frow">
            <div className="ape-f">
              <label htmlFor="g-torre">Torre</label>
              <input id="g-torre" inputMode="numeric" value={torre} onChange={(e) => setTorre(e.target.value)} />
            </div>
            <div className="ape-f">
              <label htmlFor="g-ap">Apê</label>
              <input id="g-ap" inputMode="numeric" value={ap} onChange={(e) => setAp(e.target.value)} />
            </div>
          </div>
        ) : null}
        {sl && outros.length > 0 && (
          <div className="ape-junto" role="group" aria-label="Mesmo apê">
            <ApeArt name="grupo" size={40} tone="sec" />
            <div>
              <b>Este apê já tem cadastro: {outros.join(', ')}</b>
              <span>Você mora junto{outros.length > 1 ? ' com essas pessoas' : ''}?</span>
              <div className="ape-acts">
                <button type="button" className={`ape-btn sm ${junto === true ? 'primary' : ''}`} onClick={() => setJunto(true)}>sim, moro junto</button>
                <button type="button" className={`ape-btn sm ${junto === false ? 'rose' : ''}`} onClick={() => { setJunto(false); setAp('') }}>não, errei o apê</button>
              </div>
            </div>
          </div>
        )}
        {sl ? null : (
          <div className="ape-f">
            <label htmlFor="g-cond">Condomínio ou bairro (opcional)</label>
            <input id="g-cond" value={cond} onChange={(e) => setCond(e.target.value)} placeholder="Ex.: Residencial Jardim, Mooca" />
          </div>
        )}
        <div className="ape-f">
          <label htmlFor="g-tel">Celular (<span className="ape-keep">WhatsApp</span>)</label>
          <input id="g-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={tel} onChange={(e) => setTel(mascaraTel(e.target.value))} required />
        </div>
        {!me && (
          <div className="ape-f ape-gfam">
            <label>Quem vai morar com você? <span className="ape-opc">opcional</span></label>
            <EditarFamilia membros={familia} mudar={(l) => setFamilia(l.length ? l : [{ id: 'eu', nome: '', tipo: 'adulto', papel: 'eu' }])} />
          </div>
        )}
        {!me && apeCloud && (
          <>
            <div className="ape-f"><label htmlFor="g-email">E-mail</label><input id="g-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="ape-f"><label htmlFor="g-senha">Crie uma senha</label><input id="g-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="8 ou mais caracteres" /></div>
          </>
        )}
        {err && <p className="ape-err" role="alert">{err}</p>}
        <div className="ape-acts">
          <button className="ape-btn primary wide" type="submit" disabled={busy}>
            {busy ? 'aguarde…' : me ? 'salvar' : apeCloud ? 'criar conta' : 'entrar'}
          </button>
          {onCancel && (
            <button className="ape-btn ghost" type="button" onClick={onCancel}>cancelar</button>
          )}
        </div>
        {!me && apeCloud && (
          <div className="ape-conta-links" style={{ justifyContent: 'center' }}>
            <span className="ape-note">Já tem conta?</span>
            <button type="button" className="ape-linkish ape-link" onClick={() => { setModo('entrar'); setErr('') }}>entrar</button>
          </div>
        )}
        {me && (
          <button type="button" className="ape-btn ghost sm ape-outro" onClick={() => { void navigator.clipboard?.writeText(`https://useplane.com.br/ape/sanlevi/#entrar:${me.id}`); setCopiado(true) }}>
            <ApeIcon name={copiado ? 'check' : 'phone'} />
            {copiado ? 'link copiado: abra no outro aparelho (não compartilhe)' : 'usar em outro aparelho: copiar meu link'}
          </button>
        )}
      </form>
      )}
    </div>
  )
}
