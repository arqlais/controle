import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './rdlReserva.css'
import { RDL_LOGO } from '../rdlLogo'
import { VISTORIA_PROPOSTA_URL } from '../contractTemplates'
import { formatCep, formatDoc, formatPhone, lookupCep, whatsappLink } from '../utils'
import { deviceLabel } from '../contractSign'
import { SignaturePad, drawingToDataUrl } from './SignaturePad'
import {
  CONFIG_PADRAO,
  PLANTA_CANTO,
  PLANTA_CORREDOR,
  RDL_INFO,
  abrirContrato,
  avisarEmail,
  contagem,
  contratoTexto,
  dataCurta,
  enderecoCompleto,
  lerConfig,
  chatAbrir,
  chatEnviar,
  chatLer,
  minhaReserva,
  moradorAcao,
  pixCopiaECola,
  plantaDoApto,
  reservaTeste,
  reservar,
  sha256,
  unidade,
  validCpf,
  type ChatMsg,
  type Reserva,
  type ReservaConfig,
  type ReservaDados,
} from '../rdlReserva'

/* Página pública da reserva da vistoria (useplane.com.br/vistoria), na identidade da RDL.
   Feita para quem não entende de vistoria e usa no celular: tudo explicado, com símbolos, um passo de cada vez.
   #/vistoria                → reservar (dados, contrato e assinatura)
   #/vistoria/<id>.<código>  → painel da reserva do morador
   #/vistoria/teste          → reservar em modo teste (nada é salvo nem enviado)
   #/vistoria/teste-painel   → painel de teste, com as etapas para simular */

const P: Record<string, string> = {
  key: '<circle cx="8" cy="12" r="4.2"/><path d="M12.2 12H21M17.5 12v3M20 12v2.4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.3-3 7.7-7 9.5-4-1.8-7-5.2-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 15.5h5"/>',
  plan: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 12h8V3.5M11.5 20.5V16h9"/>',
  sign: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/>',
  redo: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  chat: '<path d="M4 19l1.3-3.9A8 8 0 1 1 8.9 18.7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.8.2 5 2.2 5 5.4"/>',
  building: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-5h4v5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  hammer: '<path d="M14 6l4 4M3 21l9-9M12 4l8 8-2 2-8-8z"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  drop: '<path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.9z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  bag: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
}
const I = ({ n, s = 16 }: { n: string; s?: number }) => <svg className="rv-i" width={s} height={s} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: P[n] ?? P.doc }} />
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: n % 1 ? 2 : 0 })
const SALVO = 'rdl-minha-reserva'
const TESTE_DADOS = 'rdl-reserva-teste'
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) || ''
    } catch {
      return ''
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ok */
    }
  },
}
const plantaImg = (p?: string) => (p === PLANTA_CANTO ? 'rdl/planta-canto.jpg' : p === PLANTA_CORREDOR ? 'rdl/planta-corredor.jpg' : '')
const plantaCurta = (p?: string) => (p === PLANTA_CANTO ? 'Planta de canto' : p === PLANTA_CORREDOR ? 'Planta de corredor' : p || '')
const prazoSinal = (r: Reserva, dias: number) => {
  const fim = new Date(new Date(r.criado).getTime() + dias * 864e5)
  const faltam = Math.max(0, Math.ceil((fim.getTime() - Date.now()) / 864e5))
  return { fim: fim.toLocaleDateString('pt-BR'), faltam }
}

function Topo() {
  return (
    <header className="rv-top">
      <img src={RDL_LOGO} alt="RDL Engenharia" />
    </header>
  )
}
function Rodape() {
  return (
    <footer className="rv-foot">
      <div>
        <b>{RDL_INFO.engineer}</b>
        <span>
          CREA-SP {RDL_INFO.crea} · {RDL_INFO.company}
        </span>
        <span>CNPJ {RDL_INFO.cnpj}</span>
      </div>
      <div className="r">
        <a href={whatsappLink(RDL_INFO.whatsapp)}>{RDL_INFO.phone}</a>
        <span>{RDL_INFO.email}</span>
      </div>
    </footer>
  )
}
function Teste({ children }: { children?: ReactNode }) {
  return (
    <div className="rv-test">
      <b>
        <I n="eye" s={14} /> Modo teste
      </b>
      <span>Você está vendo como o morador vê. Nada é salvo nem enviado.</span>
      {children}
    </div>
  )
}

/** "X de 10 reservados": o andamento do grupo, com os quadradinhos. */
function Grupo({ n, cfg, compact }: { n: number; cfg: ReservaConfig; compact?: boolean }) {
  const min = cfg.minimo
  const ok = n >= min
  return (
    <section className={`rv-group ${ok ? 'ok' : ''} ${compact ? 'compact' : ''}`}>
      <div className="rv-group-head">
        <span className="ib">
          <I n="users" s={18} />
        </span>
        <div>
          <b>
            {Math.min(n, 999)} de {min} reservados
          </b>
          <small>{ok ? `Grupo fechado: todos pagam ${brl(cfg.preco)}` : `Faltam ${min - n} para todos pagarem ${brl(cfg.preco)}`}</small>
        </div>
      </div>
      <div className="rv-dots" aria-hidden>
        {Array.from({ length: min }, (_, i) => (
          <i key={i} className={i < n ? 'on' : ''}>
            {i < n ? <I n="home" s={13} /> : null}
          </i>
        ))}
      </div>
      {!compact && !ok && <p>Se não fechar o grupo, a diferença de {brl(cfg.individual - cfg.preco)} entra no restante, no dia da vistoria.</p>}
    </section>
  )
}

/** Escolha da planta: as duas do San Levi, com a imagem. A do número do apto vem marcada. */
function Plantas({ value, onChange, sugerida }: { value?: string; onChange: (p: string) => void; sugerida?: string }) {
  return (
    <div className="rv-plantas">
      {[PLANTA_CANTO, PLANTA_CORREDOR].map((p) => (
        <button key={p} type="button" className={`rv-planta ${value === p ? 'on' : ''}`} onClick={() => onChange(p)}>
          <img src={plantaImg(p)} alt={p} loading="lazy" />
          <span>
            <b>
              {value === p && <I n="check" s={13} />} {plantaCurta(p)}
            </b>
            <small>{p === PLANTA_CANTO ? 'Apartamentos com final 01, 02, 11 e 12' : 'Apartamentos com final 03 a 10'}</small>
            {sugerida === p && <em>pelo número do seu apto</em>}
          </span>
        </button>
      ))}
    </div>
  )
}


/** Chat de dúvidas (botão no canto da tela). A Laís recebe um e-mail avisando e responde pelo sistema. */
const CHAT_KEY = 'rdl-chat'
function Duvidas({ teste, nome = '', contato = '', reserva, abrirCom }: { teste?: boolean; nome?: string; contato?: string; reserva?: { id: string; token: string }; abrirCom?: { id: string; token: string } }) {
  const [open, setOpen] = useState(!!abrirCom)
  const [conv, setConv] = useState<{ id: string; token: string } | null>(() => {
    if (abrirCom) {
      ls.set(CHAT_KEY, JSON.stringify(abrirCom))
      return abrirCom
    }
    try {
      return reserva ? null : (JSON.parse(ls.get(CHAT_KEY) || 'null') as { id: string; token: string } | null)
    } catch {
      return null
    }
  })
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [f, setF] = useState({ nome, contato })
  const [texto, setTexto] = useState('')
  const [st, setSt] = useState<'' | 'enviando' | 'erro'>('')
  const fim = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const abrir = () => setOpen(true)
    window.addEventListener('rv-duvida', abrir)
    return () => window.removeEventListener('rv-duvida', abrir)
  }, [])
  // painel: a conversa é a da reserva (abre sozinha na primeira mensagem)
  useEffect(() => {
    if (!open || conv || !reserva || teste) return
    void chatAbrir(nome, contato, reserva).then((c) => c && setConv(c))
  }, [open, conv, reserva, teste, nome, contato])
  // lê as mensagens enquanto o chat está aberto
  useEffect(() => {
    if (!open || !conv || teste) return
    let vivo = true
    const ler = () => void chatLer(conv).then((m) => vivo && m && setMsgs(m))
    ler()
    const t = setInterval(ler, 12_000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [open, conv, teste])
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [msgs, open])
  const enviar = async () => {
    const t = texto.trim()
    if (!t || st === 'enviando') return
    setSt('enviando')
    if (teste) {
      setMsgs((m) => [...m, { id: Date.now(), autor: 'morador', texto: t, criado: new Date().toISOString() }])
      setTexto('')
      setSt('')
      setTimeout(() => setMsgs((m) => [...m, { id: Date.now() + 1, autor: 'rdl', texto: 'Oi! Aqui é a RDL. No modo teste, esta resposta é só um exemplo.', criado: new Date().toISOString() }]), 900)
      return
    }
    let c = conv
    if (!c) {
      c = await chatAbrir(f.nome, f.contato, reserva)
      if (!c) return setSt('erro')
      setConv(c)
      if (!reserva) ls.set(CHAT_KEY, JSON.stringify(c))
    }
    const ok = await chatEnviar(c, t)
    if (!ok) return setSt('erro')
    setTexto('')
    setSt('')
    const m = await chatLer(c)
    if (m) setMsgs(m)
  }
  const precisaContato = !conv && !reserva && !teste
  const podeEnviar = !!texto.trim() && (!precisaContato || (f.nome.trim().length > 1 && f.contato.trim().length >= 5))
  return (
    <>
      <button className="rv-fab" onClick={() => setOpen(true)} aria-label="Tirar uma dúvida">
        <I n="chat" s={18} /> Dúvidas?
      </button>
      {open && (
        <div className="rv-modal" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="rv-sheet rv-chat">
            <div className="rv-chat-head">
              <img src={RDL_LOGO} alt="" />
              <div>
                <b>Dúvidas sobre a vistoria</b>
                <small>Respondemos o quanto antes, aqui e no seu {reserva ? 'e-mail' : 'contato'}</small>
              </div>
              <button className="rv-close" onClick={() => setOpen(false)} aria-label="Fechar">
                <I n="x" s={18} />
              </button>
            </div>
            <div className="rv-chat-body">
              <div className="rv-bub rdl">Oi! Pode perguntar o que quiser sobre a vistoria, sem compromisso.</div>
              {msgs.map((m) => (
                <div key={m.id} className={`rv-bub ${m.autor === 'rdl' ? 'rdl' : 'me'}`}>
                  {m.texto}
                  <small>{new Date(m.criado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
                </div>
              ))}
              {msgs.length > 0 && msgs[msgs.length - 1].autor === 'morador' && <p className="rv-chat-note">Mensagem enviada. Você pode fechar: a resposta aparece aqui e chega no seu contato.</p>}
              <div ref={fim} />
            </div>
            {precisaContato && (
              <div className="rv-chat-who">
                <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Seu nome" autoComplete="name" />
                <input value={f.contato} onChange={(e) => setF({ ...f, contato: e.target.value })} placeholder="WhatsApp ou e-mail (para a resposta)" />
              </div>
            )}
            {st === 'erro' && <p className="rv-warn">Não consegui enviar. Tente de novo ou chame no WhatsApp.</p>}
            <div className="rv-chat-send">
              <textarea rows={1} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva a sua dúvida" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void enviar())} />
              <button className="rv-btn" disabled={!podeEnviar || st === 'enviando'} onClick={() => void enviar()} aria-label="Enviar">
                <I n="send" s={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Convite discreto para a loja da planê.apê (guias e planilhas para depois das chaves). */
function Loja() {
  return (
    <a className="rv-shop" href="ape/" target="_blank" rel="noreferrer">
      <span className="ib">
        <I n="bag" s={18} />
      </span>
      <span>
        <small>DEPOIS DAS CHAVES VEM A OBRA</small>
        <b>Guias e planilhas para o seu apê</b>
        <span>Planilha de obra, guia de medidas, marcenaria, pisos e mais. A partir de R$ 12,90.</span>
        <em>
          Conhecer a loja da planê.apê <I n="arrow" s={13} />
        </em>
      </span>
    </a>
  )
}

export function RdlReservaPublic({ sub }: { sub?: string }) {
  useEffect(() => {
    document.title = 'Vistoria de entrega de chaves · RDL Engenharia'
    document.documentElement.classList.add('rv-root')
    return () => document.documentElement.classList.remove('rv-root')
  }, [])
  if (sub === 'teste') return <div className="rv"><Reservar teste /></div>
  if (sub === 'teste-painel') return <div className="rv"><Painel id="" token="" teste /></div>
  if (sub?.startsWith('duvida-')) {
    const [cid, ctk] = sub.slice(7).split('.')
    return <div className="rv"><Reservar abrirChat={cid && ctk ? { id: cid, token: ctk } : undefined} /></div>
  }
  const [id, token] = (sub ?? '').split('.')
  return <div className="rv">{id && token ? <Painel id={id} token={token} /> : <Reservar />}</div>
}

/* ================= reserva ================= */

const vazio: ReservaDados = { nome: '', cpf: '', email: '', tel: '', endereco: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', torre: '', apto: '', planta: '', revistoria: false, reforma: '' }

function Reservar({ teste, abrirChat }: { teste?: boolean; abrirChat?: { id: string; token: string } }) {
  const [cfg, setCfg] = useState<ReservaConfig>(CONFIG_PADRAO)
  const [n, setN] = useState(0)
  const [step, setStep] = useState<1 | 2>(1)
  const [d, setD] = useState<ReservaDados>(() => {
    try {
      return { ...vazio, ...JSON.parse(sessionStorage.getItem('rdl-reserva-rascunho') || '{}') }
    } catch {
      return vazio
    }
  })
  const [querReforma, setQuerReforma] = useState(!!d.reforma)
  const [tried, setTried] = useState(false)
  const [ok, setOk] = useState(false)
  const [nomeAss, setNomeAss] = useState('')
  const [desenho, setDesenho] = useState('')
  const [modo, setModo] = useState<'digitado' | 'desenho'>('digitado')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [cepMsg, setCepMsg] = useState('')
  const salvo = useMemo(() => (teste ? '' : ls.get(SALVO)), [teste])
  useEffect(() => {
    void lerConfig().then(setCfg)
    void contagem().then(setN)
  }, [])
  useEffect(() => {
    try {
      sessionStorage.setItem('rdl-reserva-rascunho', JSON.stringify(d))
    } catch {
      /* ok */
    }
  }, [d])
  const set = <K extends keyof ReservaDados>(k: K, v: ReservaDados[K]) => setD((x) => ({ ...x, [k]: v }))
  const sugerida = plantaDoApto(d.apto)
  // planta: vem marcada pelo número do apto (dá para trocar)
  useEffect(() => {
    if (sugerida && !d.planta) set('planta', sugerida)
  }, [sugerida]) // eslint-disable-line react-hooks/exhaustive-deps
  const buscarCep = async (v: string) => {
    set('cep', formatCep(v))
    if (v.replace(/\D/g, '').length !== 8) return setCepMsg('')
    setCepMsg('Buscando o endereço…')
    const a = await lookupCep(v)
    if (!a) return setCepMsg('Não achei esse CEP. Preencha o endereço abaixo.')
    setCepMsg('')
    setD((x) => ({ ...x, rua: a.street || x.rua, bairro: a.district || x.bairro, cidade: a.city, uf: a.uf }))
    setTimeout(() => document.getElementById('rv-numero')?.focus(), 50)
  }
  const faltando = {
    nome: d.nome.trim().split(/\s+/).length < 2,
    cpf: !validCpf(d.cpf),
    email: !/^\S+@\S+\.\S+$/.test(d.email.trim()),
    tel: d.tel.replace(/\D/g, '').length < 10,
    cep: (d.cep ?? '').replace(/\D/g, '').length !== 8,
    rua: !(d.rua ?? '').trim(),
    numero: !(d.numero ?? '').trim(),
    bairro: !(d.bairro ?? '').trim(),
    cidade: !(d.cidade ?? '').trim() || !(d.uf ?? '').trim(),
    torre: !d.torre.trim(),
    apto: !d.apto.trim(),
    planta: !d.planta,
    reforma: querReforma && (d.reforma ?? '').trim().length < 3,
  }
  const okDados = !Object.values(faltando).some(Boolean)
  const dc = useMemo(() => ({ ...d, endereco: enderecoCompleto(d), reforma: querReforma ? (d.reforma ?? '').trim() : '' }), [d, querReforma])
  const texto = useMemo(() => contratoTexto(dc, cfg), [dc, cfg])
  const metade = cfg.preco / 2
  const assinou = ok && (modo === 'digitado' ? nomeAss.trim().toLowerCase() === d.nome.trim().toLowerCase() : desenho.length > 30)

  const enviar = async () => {
    if (!assinou || busy) return
    setBusy(true)
    setErro('')
    try {
      if (teste) {
        sessionStorage.setItem(TESTE_DADOS, JSON.stringify(dc))
        location.hash = '#/vistoria/teste-painel'
        window.scrollTo(0, 0)
        return
      }
      const em = new Date().toISOString()
      const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone
      const aparelho = deviceLabel()
      const codigo = await sha256([texto, d.nome.trim(), d.cpf.replace(/\D/g, ''), em, aparelho].join('|'))
      const r = await reservar({ ...dc, nome: d.nome.trim(), email: d.email.trim().toLowerCase() }, { texto, assinatura: d.nome.trim(), desenho: modo === 'desenho' ? desenho : undefined, cpf: d.cpf, em, codigo, aparelho, fuso })
      void avisarEmail('reserva', r.id, r.token)
      if (dc.reforma) void moradorAcao(r.id, r.token, 'reforma-pedido', dc.reforma).then((x) => x && void avisarEmail('reforma-pedido', r.id, r.token))
      const link = `#/vistoria/${r.id}.${r.token}`
      ls.set(SALVO, link)
      try {
        sessionStorage.removeItem('rdl-reserva-rascunho')
        sessionStorage.setItem('rdl-reserva-nova', '1')
      } catch {
        /* ok */
      }
      location.hash = link
      window.scrollTo(0, 0)
    } catch {
      setErro('Não consegui enviar agora. Confira a internet e tente de novo. Se continuar, chame o Rogério no WhatsApp.')
    } finally {
      setBusy(false)
    }
  }
  const irPara = () => document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' })
  const campo = (k: keyof typeof faltando) => (tried && faltando[k] ? 'bad' : '')

  return (
    <>
      <Topo />
      {teste && <Teste />}
      <main className="rv-main">
        <section className="rv-hero">
          <span className="rv-pill">
            <i /> MORADORES · {cfg.empreendimento.replace(/\s*\(.*\)/, '').toUpperCase()}
          </span>
          <h1>
            Reserve a <span>vistoria</span> do seu apê
          </h1>
          <p>Um engenheiro civil confere o seu apê com você na entrega das chaves. Laudo com fotos e ART, para a MRV consertar o que estiver errado.</p>
          <button className="rv-btn" onClick={irPara}>
            <I n="key" /> Quero reservar
          </button>
        </section>

        {salvo && (
          <a className="rv-saved" href={salvo}>
            <I n="check" /> Você já tem uma reserva neste celular. <b>Abrir o meu painel</b> <I n="arrow" />
          </a>
        )}

        <Grupo n={n} cfg={cfg} />

        <section className="rv-price">
          <div>
            <small>
              <span className="kc">
                <I n="key" s={15} />
              </span>
              VISTORIA + LAUDO + ART
            </small>
            <strong>
              <em>R$</em>
              {brl(cfg.preco).replace('R$', '').trim()}
            </strong>
            <span>valor de grupo, por apartamento</span>
          </div>
          <ul>
            <li>
              <I n="card" /> Sinal de {brl(metade)} em até 7 dias
            </li>
            <li>
              <I n="cal" /> Previsão da MRV: dez/2026 a mar/2027
            </li>
            <li>
              <I n="redo" /> Revistoria opcional: {brl(cfg.revistoria)}
            </li>
          </ul>
        </section>

        <section className="rv-card">
          <h2 className="rv-h2">
            <I n="clock" s={18} /> Por que reservar agora?
          </h2>
          <div className="rv-why">
            {[
              ['cal', 'Vagas limitadas', 'A MRV entrega todos na mesma época.'],
              ['star', 'Escolha o horário antes', 'A agenda segue a ordem do sinal.'],
              ['users', 'Ajuda o grupo', `Com ${cfg.minimo}, todos pagam ${brl(cfg.preco)}.`],
              ['shield', 'Sem risco', '7 dias para desistir, com o sinal de volta.'],
            ].map(([i, t, p]) => (
              <div key={t}>
                <span className="ib">
                  <I n={i} s={17} />
                </span>
                <p>
                  <b>{t}</b>
                  {p}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rv-card">
          <h2 className="rv-h2">
            <I n="list" s={18} /> Como funciona
          </h2>
          <ol className="rv-how">
            {[
              ['sign', 'Reserve aqui', 'Dados e contrato pelo celular, em 3 minutos.'],
              ['card', 'Pague o sinal', `${brl(metade)} por Pix, em até 7 dias.`],
              ['cal', 'Combine o horário', 'Quando a MRV liberar, fale com o Rogério.'],
              ['search', 'Dia da vistoria', 'O engenheiro confere tudo com você.'],
              ['doc', 'Laudo + ART', 'Em até 4 dias úteis, no painel e no e-mail.'],
            ].map(([i, t, p], k) => (
              <li key={t}>
                <span className="n">{k + 1}</span>
                <span className="ib">
                  <I n={i} s={16} />
                </span>
                <p>
                  <b>{t}</b>
                  {p}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="rv-io">
          <div className="rv-card yes">
            <h3>
              <span className="ic">
                <I n="check" s={13} />
              </span>
              Está incluso
            </h3>
            {[
              ['search', 'Vistoria com engenheiro civil, de até 2 horas'],
              ['shield', 'ART da vistoria registrada no CREA'],
              ['doc', 'Laudo técnico com fotos'],
              ['plan', 'Conferência com a planta e o memorial'],
            ].map(([i, t]) => (
              <p key={t}>
                <span className="ib">
                  <I n={i} s={13} />
                </span>
                {t}
              </p>
            ))}
          </div>
          <div className="rv-card no">
            <h3>
              <span className="ic">
                <I n="x" s={13} />
              </span>
              Não está incluso
            </h3>
            {['Os consertos (são por conta da MRV)', 'Áreas comuns do condomínio', 'Quebrar parede, piso ou forro', 'ART de reforma (dá para pedir à parte)'].map((t) => (
              <p key={t}>
                <span className="ib">
                  <I n="x" s={12} />
                </span>
                {t}
              </p>
            ))}
          </div>
        </section>
        <a className="rv-link" href={VISTORIA_PROPOSTA_URL} target="_blank" rel="noreferrer">
          <I n="doc" /> Ver a proposta completa (PDF)
        </a>

        {!cfg.aberta && !teste ? (
          <section className="rv-card rv-closed">
            <h2>Reservas encerradas</h2>
            <p>As vagas desta campanha foram preenchidas. Fale com o Rogério para saber se ainda há horário.</p>
            <a className="rv-btn" href={whatsappLink(RDL_INFO.whatsapp, 'Oi, Rogério! Vi que as reservas da vistoria encerraram. Ainda tem horário?')}>
              <I n="chat" /> Falar no WhatsApp
            </a>
          </section>
        ) : (
          <section className="rv-card rv-form" id="reservar">
            <ol className="rv-steps">
              <li className={step === 1 ? 'on' : 'done'}>
                <b>{step > 1 ? <I n="check" s={12} /> : 1}</b> Seus dados
              </li>
              <li className={step === 2 ? 'on' : ''}>
                <b>2</b> Contrato
              </li>
            </ol>

            {step === 1 ? (
              <>
                <div className="rv-sub">
                  <I n="user" s={14} /> Quem está comprando o apê
                </div>
                <div className="rv-grid">
                  <label className={`span2 ${campo('nome')}`}>
                    <span>Nome completo</span>
                    <input value={d.nome} onChange={(e) => set('nome', e.target.value)} autoComplete="name" placeholder="Nome e sobrenome" />
                  </label>
                  <label className={campo('cpf')}>
                    <span>CPF</span>
                    <input value={d.cpf} onChange={(e) => set('cpf', formatDoc(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
                    {tried && faltando.cpf && d.cpf && <em>Confira o CPF</em>}
                  </label>
                  <label className={campo('tel')}>
                    <span>WhatsApp</span>
                    <input value={d.tel} onChange={(e) => set('tel', formatPhone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(11) 9 0000-0000" />
                  </label>
                  <label className={`span2 ${campo('email')}`}>
                    <span>E-mail (você recebe tudo por aqui também)</span>
                    <input value={d.email} onChange={(e) => set('email', e.target.value)} inputMode="email" autoComplete="email" placeholder="voce@email.com" />
                  </label>
                </div>

                <div className="rv-sub">
                  <I n="home" s={14} /> Onde você mora hoje
                </div>
                <div className="rv-grid">
                  <label className={campo('cep')}>
                    <span>CEP</span>
                    <input value={d.cep} onChange={(e) => void buscarCep(e.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" />
                    {cepMsg ? <em>{cepMsg}</em> : <small>O endereço aparece sozinho</small>}
                  </label>
                  <label className={campo('numero')}>
                    <span>Número</span>
                    <input id="rv-numero" value={d.numero} onChange={(e) => set('numero', e.target.value)} placeholder="Ex.: 120" />
                  </label>
                  <label className={`span2 ${campo('rua')}`}>
                    <span>Rua</span>
                    <input value={d.rua} onChange={(e) => set('rua', e.target.value)} autoComplete="address-line1" />
                  </label>
                  <label>
                    <span>Complemento (se tiver)</span>
                    <input value={d.complemento} onChange={(e) => set('complemento', e.target.value)} placeholder="Apto, bloco, casa" />
                  </label>
                  <label className={campo('bairro')}>
                    <span>Bairro</span>
                    <input value={d.bairro} onChange={(e) => set('bairro', e.target.value)} />
                  </label>
                  <label className={campo('cidade')}>
                    <span>Cidade</span>
                    <input value={d.cidade} onChange={(e) => set('cidade', e.target.value)} />
                  </label>
                  <label className={campo('cidade')}>
                    <span>Estado</span>
                    <input value={d.uf} onChange={(e) => set('uf', e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" />
                  </label>
                </div>

                <div className="rv-sub">
                  <I n="building" s={14} /> Seu apê no San Levi
                </div>
                <div className="rv-grid">
                  <label className={campo('torre')}>
                    <span>Torre</span>
                    <input value={d.torre} onChange={(e) => set('torre', e.target.value)} inputMode="numeric" placeholder="Ex.: 2" />
                  </label>
                  <label className={campo('apto')}>
                    <span>Apartamento</span>
                    <input
                      value={d.apto}
                      onChange={(e) => {
                        const v = e.target.value
                        const p = plantaDoApto(v)
                        setD((x) => ({ ...x, apto: v, planta: p || x.planta }))
                      }}
                      inputMode="numeric"
                      placeholder="Ex.: 1204"
                    />
                  </label>
                </div>
                <p className={`rv-label ${campo('planta')}`}>
                  Qual é a sua planta? <small>{sugerida ? 'Já marcamos pelo número do apto. Se não for, toque na outra.' : 'Toque na sua.'}</small>
                </p>
                <Plantas value={d.planta} onChange={(p) => set('planta', p)} sugerida={sugerida} />

                <div className="rv-sub">
                  <I n="star" s={14} /> Extras (se quiser)
                </div>
                <label className={`rv-check ${d.revistoria ? 'on' : ''}`}>
                  <input type="checkbox" checked={d.revistoria} onChange={(e) => set('revistoria', e.target.checked)} />
                  <span>
                    <b>
                      <I n="redo" s={14} /> Revistoria: {brl(cfg.revistoria)}
                    </b>
                    <small>Depois que a MRV consertar, o engenheiro volta para conferir. Paga só no dia. Dá para decidir depois.</small>
                  </span>
                </label>
                <label className={`rv-check ${querReforma ? 'on' : ''}`}>
                  <input type="checkbox" checked={querReforma} onChange={(e) => setQuerReforma(e.target.checked)} />
                  <span>
                    <b>
                      <I n="hammer" s={14} /> Vou reformar: quero orçamento de ART de reforma
                    </b>
                    <small>O condomínio pede um responsável técnico para obras no apê. O Rogério analisa e manda o valor no seu painel. Você só paga se aprovar.</small>
                  </span>
                </label>
                {querReforma && (
                  <label className={`rv-area ${campo('reforma')}`}>
                    <span>O que você pretende fazer?</span>
                    <textarea rows={3} value={d.reforma} onChange={(e) => set('reforma', e.target.value)} placeholder="Ex.: trocar o piso da sala, fazer armários na cozinha, mudar uma tomada de lugar" />
                  </label>
                )}
                {tried && !okDados && <p className="rv-warn">Falta preencher ou conferir os campos marcados em laranja.</p>}
                <button
                  className="rv-btn"
                  onClick={() => {
                    setTried(true)
                    if (!okDados) return
                    setNomeAss('')
                    setStep(2)
                    setTimeout(irPara, 30)
                  }}
                >
                  Continuar para o contrato <I n="arrow" />
                </button>
              </>
            ) : (
              <>
                <div className="rv-sum">
                  <div>
                    <small>QUEM CONTRATA</small>
                    <b>{d.nome}</b>
                  </div>
                  <div>
                    <small>APÊ</small>
                    <b>
                      {unidade(d)} · {plantaCurta(d.planta)}
                    </b>
                  </div>
                  <div>
                    <small>VALOR</small>
                    <b>{brl(cfg.preco)}</b>
                  </div>
                  <div>
                    <small>SINAL (ATÉ 7 DIAS)</small>
                    <b>{brl(metade)}</b>
                  </div>
                </div>
                <div className="rv-keys">
                  <p>
                    <I n="card" /> <span>O sinal de <b>{brl(metade)}</b> garante a vaga. Sem o sinal em 7 dias, a reserva é cancelada sozinha, sem custo.</span>
                  </p>
                  <p>
                    <I n="users" /> <span>Com {cfg.minimo} reservas, vale <b>{brl(cfg.preco)}</b>. Se não fechar, a diferença de {brl(cfg.individual - cfg.preco)} entra no restante.</span>
                  </p>
                  <p>
                    <I n="shield" /> <span>Mudou de ideia? Até 7 dias depois de assinar, o sinal volta inteiro.</span>
                  </p>
                </div>
                <p className="rv-hint">Este é o contrato, já com os seus dados. Role para ler tudo.</p>
                <div className="rv-contract" tabIndex={0}>
                  {texto.split('\n').map((l: string, i: number) =>
                    i === 0 ? (
                      <h4 key={i}>{l}</h4>
                    ) : /^(\d+\. |CONTRATADA$|CONTRATANTE$|IMÓVEL VISTORIADO$|ANEXO I)/.test(l) ? (
                      <h5 key={i}>{l}</h5>
                    ) : l.trim() ? (
                      <p key={i}>{l}</p>
                    ) : null,
                  )}
                </div>
                <label className={`rv-check ${ok ? 'on' : ''}`}>
                  <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
                  <span>
                    <b>Li e concordo com o contrato</b>
                    <small>Inclusive com o sinal de {brl(metade)}, pago em até 7 dias, que não é devolvido depois de 7 dias da assinatura.</small>
                  </span>
                </label>
                <div className="rv-signbox">
                  <p className="rv-label">Sua assinatura</p>
                  <div className="rv-tabs">
                    <button className={modo === 'digitado' ? 'on' : ''} onClick={() => setModo('digitado')}>
                      <I n="sign" s={14} /> Digitar o nome
                    </button>
                    <button className={modo === 'desenho' ? 'on' : ''} onClick={() => setModo('desenho')}>
                      <I n="sign" s={14} /> Com o dedo
                    </button>
                  </div>
                  {modo === 'digitado' ? (
                    <label>
                      <span>Digite o seu nome completo, igual ao de cima</span>
                      <input value={nomeAss} onChange={(e) => setNomeAss(e.target.value)} placeholder={d.nome} />
                      {nomeAss && nomeAss.trim().toLowerCase() !== d.nome.trim().toLowerCase() && <em>Precisa ser igual: {d.nome}</em>}
                    </label>
                  ) : (
                    <SignaturePad value={desenho} onChange={setDesenho} />
                  )}
                </div>
                {erro && <p className="rv-warn">{erro}</p>}
                <div className="rv-row">
                  <button className="rv-btn ghost" onClick={() => setStep(1)}>
                    <I n="back" /> Voltar
                  </button>
                  <button className="rv-btn" disabled={!assinou || busy} onClick={() => void enviar()}>
                    <I n="sign" /> {busy ? 'Enviando…' : 'Assinar e reservar'}
                  </button>
                </div>
                {!assinou && <p className="rv-fine center">{!ok ? 'Marque “Li e concordo” e assine para continuar.' : 'Falta a sua assinatura.'}</p>}
                <p className="rv-fine">Assinatura eletrônica com registro de data, hora, aparelho e código do documento (MP 2.200-2/2001, art. 10, § 2º). Você recebe uma cópia no painel e no e-mail.</p>
              </>
            )}
          </section>
        )}

        <section className="rv-card rv-faq">
          <h2 className="rv-h2">
            <I n="info" s={18} /> Dúvidas comuns
          </h2>
          {[
            ['Por que fazer a vistoria antes de receber as chaves?', 'Para a MRV, você recebe o apê ao assinar o termo de recebimento. Com o laudo em mãos antes disso, tudo o que estiver errado fica registrado para ela consertar, dentro da garantia.'],
            ['Quando a MRV entrega?', 'O contrato da MRV prevê a entrega para 31/10/2026, com prazo máximo em 30/04/2027. Ela avisa por e-mail quando o apê estiver pronto para a vistoria.'],
            ['A MRV ainda não marcou a minha data. Posso reservar?', `Pode, e é o ideal. A reserva guarda a sua vaga na agenda. Quando a MRV liberar a data (previsão: ${cfg.periodo}), você combina o horário com o Rogério.`],
            ['Quando eu pago?', `O sinal de ${brl(metade)} em até 7 dias depois de reservar, por Pix. O restante no dia da vistoria, por Pix ou cartão.`],
            ['E se eu desistir?', 'Até 7 dias depois de assinar, o sinal volta inteiro. Depois disso, o sinal fica com a RDL, porque a vaga deixou de ser oferecida a outro morador.'],
            ['Preciso estar lá no dia?', 'Sim, você ou alguém de confiança. A MRV precisa deixar água e luz ligadas.'],
            ['E se a MRV mudar a data?', 'Sem problema e sem custo: combinamos a nova data conforme a agenda.'],
            ['O que é a ART?', 'É o registro no CREA de que um engenheiro é responsável pela vistoria. Dá mais força ao laudo com a MRV.'],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q} <I n="arrow" s={14} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
          <button className="rv-btn ghost wide3" onClick={() => window.dispatchEvent(new Event('rv-duvida'))}>
            <I n="help" /> Não achou a resposta? Pergunte aqui
          </button>
        </section>
        <Loja />
      </main>
      <Rodape />
      <Duvidas teste={teste} abrirCom={abrirChat} />
    </>
  )
}

/* ================= painel da reserva ================= */

type Etapa = 'reserva' | 'sinal' | 'data' | 'laudo'

function Painel({ id, token, teste }: { id: string; token: string; teste?: boolean }) {
  const [r, setR] = useState<Reserva | null | undefined>(undefined)
  const [grupo, setGrupo] = useState(0)
  const [cfg, setCfg] = useState<ReservaConfig>(CONFIG_PADRAO)
  const [copiado, setCopiado] = useState('')
  const [etapa, setEtapa] = useState<Etapa>('reserva')
  const [trocaPlanta, setTrocaPlanta] = useState(false)
  const [pedido, setPedido] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')
  const [nova] = useState(() => {
    try {
      const v = sessionStorage.getItem('rdl-reserva-nova') === '1'
      sessionStorage.removeItem('rdl-reserva-nova')
      return v
    } catch {
      return false
    }
  })
  useEffect(() => {
    void lerConfig().then(setCfg)
  }, [])
  useEffect(() => {
    if (teste) {
      const base = reservaTeste(etapa, cfg)
      try {
        const own = JSON.parse(sessionStorage.getItem(TESTE_DADOS) || 'null') as ReservaDados | null
        if (own) {
          base.dados = { ...base.dados, ...own }
          if (own.reforma && !base.status.reforma) base.status.reforma = { pedido: own.reforma, pedidoEm: base.criado }
        }
      } catch {
        /* ok */
      }
      setR(base)
      setGrupo(7)
      return
    }
    void minhaReserva(id, token).then((x) => {
      setR(x)
      if (x) {
        setGrupo((x as Reserva & { grupo?: number }).grupo ?? 0)
        ls.set(SALVO, `#/vistoria/${id}.${token}`)
      }
    })
  }, [id, token, teste, etapa, cfg])

  if (r === undefined)
    return (
      <>
        <Topo />
        <main className="rv-main">
          <p className="rv-hint center">Abrindo a sua reserva…</p>
        </main>
      </>
    )
  if (!r)
    return (
      <>
        <Topo />
        <main className="rv-main">
          <section className="rv-card rv-closed">
            <h2>Reserva não encontrada</h2>
            <p>Confira se o link está completo, ou fale com o Rogério no WhatsApp.</p>
            <a className="rv-btn" href={whatsappLink(RDL_INFO.whatsapp, 'Oi, Rogério! Não consegui abrir o painel da minha reserva da vistoria.')}>
              <I n="chat" /> Falar no WhatsApp
            </a>
          </section>
        </main>
        <Rodape />
      </>
    )

  const s = r.status ?? {}
  const rf = s.reforma ?? {}
  const metade = cfg.preco / 2
  const restante = cfg.preco - metade
  const pix = pixCopiaECola(cfg, metade, r)
  const prazo = prazoSinal(r, cfg.prazoSinal || 7)
  const zap = (t: string) => whatsappLink(RDL_INFO.whatsapp, t)
  const copiar = (t: string, k: string) =>
    navigator.clipboard
      ?.writeText(t)
      .then(() => {
        setCopiado(k)
        setTimeout(() => setCopiado(''), 2000)
      })
      .catch(() => undefined)
  const recarregar = async () => {
    if (teste) return
    const x = await minhaReserva(id, token)
    if (x) setR(x)
  }
  const mudarPlanta = async (p: string) => {
    setTrocaPlanta(false)
    if (teste) return setR({ ...r, dados: { ...r.dados, planta: p } })
    if (await moradorAcao(id, token, 'planta', p)) void recarregar()
  }
  const pedirReforma = async () => {
    if (pedido.trim().length < 3 || enviando) return
    setEnviando(true)
    if (teste) {
      setR({ ...r, status: { ...s, reforma: { pedido: pedido.trim(), pedidoEm: new Date().toISOString() } } })
      setEnviando(false)
      return
    }
    const ok = await moradorAcao(id, token, 'reforma-pedido', pedido.trim())
    setEnviando(false)
    if (!ok) return setMsg('Não consegui enviar agora. Tente de novo ou chame o Rogério no WhatsApp.')
    void avisarEmail('reforma-pedido', id, token)
    setPedido('')
    void recarregar()
  }
  const aprovarReforma = async () => {
    if (enviando) return
    setEnviando(true)
    if (teste) {
      setR({ ...r, status: { ...s, reforma: { ...rf, aprovadoEm: new Date().toISOString() } } })
      setEnviando(false)
      return
    }
    const ok = await moradorAcao(id, token, 'reforma-aprovar')
    setEnviando(false)
    if (!ok) return setMsg('Não consegui aprovar agora. Tente de novo ou chame o Rogério no WhatsApp.')
    void avisarEmail('reforma-aprovada', id, token)
    void recarregar()
  }

  // o que fazer agora (um passo de cada vez)
  const agora: { icon: string; tom: string; t: string; body: ReactNode } = r.cancelada
    ? {
        icon: 'x',
        tom: 'off',
        t: s.expirada ? 'Reserva cancelada por falta de sinal' : 'Reserva cancelada',
        body: (
          <>
            <p>{s.expirada ? 'O sinal não foi pago em 7 dias, então a reserva foi cancelada sozinha, sem custo.' : 'Se tiver alguma dúvida, fale com o Rogério.'}</p>
            <a className="rv-btn small" href="#/vistoria">
              <I n="key" /> Reservar de novo
            </a>
          </>
        ),
      }
    : !s.sinal
      ? {
          icon: 'card',
          tom: 'now',
          t: `Pague o sinal de ${brl(metade)} para garantir a vaga`,
          body: (
            <>
              <p className="rv-deadline">
                <I n="clock" s={15} /> Até <b>{prazo.fim}</b> {prazo.faltam > 0 ? `(faltam ${prazo.faltam} ${prazo.faltam === 1 ? 'dia' : 'dias'})` : '(último dia)'}. Sem o sinal, a reserva é cancelada sozinha.
              </p>
              {cfg.pix ? (
                <div className="rv-pix">
                  <small>CHAVE PIX · {cfg.pixNome}</small>
                  <b>{cfg.pix}</b>
                  <div className="rv-row">
                    <button className="rv-btn small" onClick={() => void copiar(cfg.pix, 'chave')}>
                      <I n="copy" /> {copiado === 'chave' ? 'Copiado!' : 'Copiar a chave'}
                    </button>
                    {pix && (
                      <button className="rv-btn small ghost" onClick={() => void copiar(pix, 'pix')}>
                        <I n="copy" /> {copiado === 'pix' ? 'Copiado!' : 'Pix copia e cola'}
                      </button>
                    )}
                  </div>
                  <small className="rv-tip">No app do banco: Pix → Pagar → cole a chave e digite {brl(metade)}. Ou use o “copia e cola”, que já vem com o valor.</small>
                </div>
              ) : (
                <p>A chave Pix vai pelo WhatsApp do Rogério.</p>
              )}
              <a className="rv-btn small wide2" href={zap(`Oi, Rogério! Segue o comprovante do sinal da vistoria do ${unidade(r.dados)} (${r.dados.nome}).`)}>
                <I n="chat" /> {cfg.pix ? 'Já paguei: enviar o comprovante' : 'Pedir a chave Pix'}
              </a>
            </>
          ),
        }
      : !s.data
        ? {
            icon: 'check',
            tom: 'ok',
            t: 'Vaga garantida! Agora é esperar a MRV',
            body: (
              <>
                <p>
                  A MRV ainda não liberou as datas (previsão: <b>{cfg.periodo}</b>).
                </p>
                <p className="rv-alert">
                  <I n="info" s={15} /> <span>Quando a MRV te chamar para marcar, <b>fale com o Rogério antes de confirmar o horário</b>. Assim ele garante que vai estar lá com você.</span>
                </p>
                <a className="rv-btn small" href={zap(`Oi, Rogério! A MRV liberou a minha data da vistoria (${unidade(r.dados)}). Podemos combinar o horário?`)}>
                  <I n="chat" /> A MRV liberou: combinar o horário
                </a>
              </>
            ),
          }
        : !s.laudo
          ? {
              icon: 'cal',
              tom: 'now',
              t: `Sua vistoria: ${dataCurta(s.data)}${s.hora ? ` às ${s.hora}` : ''}`,
              body: (
                <ul className="rv-list">
                  <li>
                    <I n="drop" s={15} /> A MRV precisa deixar <b>água e luz ligadas</b>
                  </li>
                  <li>
                    <I n="user" s={15} /> Você ou alguém de confiança <b>acompanha</b> a vistoria
                  </li>
                  <li>
                    <I n="card" s={15} /> Restante de <b>{brl(restante)}</b> no dia{grupo < cfg.minimo ? ` (ou ${brl(restante + cfg.individual - cfg.preco)}, se o grupo não fechar)` : ''}, por Pix ou cartão
                  </li>
                  <li>
                    <I n="clock" s={15} /> Leva até 2 horas
                  </li>
                </ul>
              ),
            }
          : {
              icon: 'doc',
              tom: 'ok',
              t: 'Seu laudo está pronto',
              body: (
                <>
                  <p>Mande o laudo para a MRV pelo atendimento dela e guarde o número do protocolo.</p>
                  <a className="rv-btn small" href={s.laudo} target="_blank" rel="noreferrer">
                    <I n="doc" /> Abrir o laudo
                  </a>
                </>
              ),
            }

  const passos: [string, boolean][] = [
    ['Reserva', true],
    ['Sinal', !!s.sinal],
    ['Data', !!s.data],
    ['Vistoria', !!s.quitado || !!s.laudo],
    ['Laudo', !!s.laudo],
  ]
  const docs: { icon: string; t: string; ok: boolean; sub: string; act?: () => void; href?: string }[] = [
    { icon: 'sign', t: 'Contrato', ok: true, sub: s.contratada ? 'Assinado pelas duas partes' : 'Assinado por você', act: () => void abrirContrato(r, r.contrato.desenho ? drawingToDataUrl(r.contrato.desenho) : undefined, false) },
    { icon: 'shield', t: 'ART da vistoria', ok: !!s.art, sub: s.art ? 'Registrada no CREA' : 'Aparece aqui depois da vistoria', href: s.art },
    { icon: 'doc', t: 'Laudo técnico', ok: !!s.laudo, sub: s.laudo ? 'Com fotos e itens para a MRV' : 'Até 4 dias úteis após a vistoria', href: s.laudo },
    ...(rf.aprovadoEm ? [{ icon: 'hammer', t: 'ART de reforma', ok: !!rf.art, sub: rf.art ? 'Registrada no CREA' : 'Aparece aqui depois da visita técnica', href: rf.art }] : []),
  ]

  return (
    <>
      <Topo />
      {teste && (
        <Teste>
          <div className="rv-test-tabs">
            {(['reserva', 'sinal', 'data', 'laudo'] as Etapa[]).map((e) => (
              <button key={e} className={etapa === e ? 'on' : ''} onClick={() => setEtapa(e)}>
                {e === 'reserva' ? 'Acabou de reservar' : e === 'sinal' ? 'Pagou o sinal' : e === 'data' ? 'Data marcada' : 'Laudo pronto'}
              </button>
            ))}
          </div>
          <a href="#/vistoria/teste">Testar a reserva do começo</a>
        </Teste>
      )}
      <main className="rv-main">
        {nova && (
          <div className="rv-done">
            <I n="check" s={18} /> <span><b>Reserva feita!</b> O contrato está aqui e uma cópia foi para o seu e-mail.</span>
          </div>
        )}
        <section className="rv-hero small">
          <span className="rv-pill">
            <i /> PAINEL DA SUA VISTORIA
          </span>
          <h1>
            Olá, <span>{r.dados.nome.split(' ')[0]}</span>
          </h1>
          <p>
            {unidade(r.dados)} · {cfg.empreendimento.replace(/\s*\(.*\)/, '')}
          </p>
        </section>

        <ol className="rv-track" aria-label="Etapas">
          {passos.map(([t, done], i) => (
            <li key={t} className={done ? 'done' : passos.findIndex((x) => !x[1]) === i ? 'now' : ''}>
              <i>{done ? <I n="check" s={12} /> : i + 1}</i>
              <span>{t}</span>
            </li>
          ))}
        </ol>

        <section className={`rv-now ${agora.tom}`}>
          <div className="rv-now-head">
            <span className="ib">
              <I n={agora.icon} s={20} />
            </span>
            <div>
              <small>{r.cancelada ? 'SITUAÇÃO' : 'O QUE FAZER AGORA'}</small>
              <h2>{agora.t}</h2>
            </div>
          </div>
          {agora.body}
        </section>

        {!r.cancelada && <Grupo n={grupo} cfg={cfg} compact />}

        <section className="rv-card">
          <h2 className="rv-h2">
            <I n="doc" s={18} /> Seus documentos
          </h2>
          <div className="rv-docs">
            {docs.map((x) =>
              x.ok ? (
                x.href ? (
                  <a key={x.t} className="rv-doc ok" href={x.href} target="_blank" rel="noreferrer">
                    <span className="ib">
                      <I n={x.icon} s={18} />
                    </span>
                    <b>{x.t}</b>
                    <small>{x.sub}</small>
                    <em>
                      Abrir <I n="arrow" s={12} />
                    </em>
                  </a>
                ) : (
                  <button key={x.t} className="rv-doc ok" onClick={x.act}>
                    <span className="ib">
                      <I n={x.icon} s={18} />
                    </span>
                    <b>{x.t}</b>
                    <small>{x.sub}</small>
                    <em>
                      Abrir <I n="arrow" s={12} />
                    </em>
                  </button>
                )
              ) : (
                <div key={x.t} className="rv-doc">
                  <span className="ib">
                    <I n="lock" s={16} />
                  </span>
                  <b>{x.t}</b>
                  <small>{x.sub}</small>
                  <em>Em breve</em>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="rv-card">
          <h2 className="rv-h2">
            <I n="plan" s={18} /> Sua planta
          </h2>
          {r.dados.planta && !trocaPlanta ? (
            <div className="rv-myplan">
              {plantaImg(r.dados.planta) && <img src={plantaImg(r.dados.planta)} alt={r.dados.planta} loading="lazy" />}
              <div className="rv-row between">
                <span>
                  <b>{plantaCurta(r.dados.planta)}</b>
                  <small>{r.dados.planta === PLANTA_CANTO ? 'Finais 01, 02, 11 e 12' : 'Finais 03 a 10'}</small>
                </span>
                {!r.cancelada && (
                  <button className="rv-btn small ghost" onClick={() => setTrocaPlanta(true)}>
                    Não é essa
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="rv-hint">Toque na planta do seu apartamento. Ajuda o engenheiro a se preparar.</p>
              <Plantas value={r.dados.planta} onChange={(p) => void mudarPlanta(p)} sugerida={plantaDoApto(r.dados.apto)} />
            </>
          )}
        </section>

        {!r.cancelada && (
          <section className="rv-card">
            <h2 className="rv-h2">
              <I n="hammer" s={18} /> ART de reforma
            </h2>
            {rf.aprovadoEm ? (
              <div className="rv-state ok">
                <I n="check" s={16} />
                <span>
                  <b>Orçamento aprovado ({brl(Number(rf.valor ?? 0))})</b>O Rogério vai falar com você para combinar a visita técnica e o pagamento.
                </span>
              </div>
            ) : rf.valor ? (
              <div className="rv-quote">
                <p>O Rogério analisou o seu pedido:</p>
                <dl>
                  <dt>O que cobre</dt>
                  <dd>{rf.escopo}</dd>
                  <dt>Valor</dt>
                  <dd>
                    <b>{brl(Number(rf.valor))}</b>
                  </dd>
                  {rf.prazo && (
                    <>
                      <dt>Prazo</dt>
                      <dd>{rf.prazo}</dd>
                    </>
                  )}
                </dl>
                <button className="rv-btn" disabled={enviando} onClick={() => void aprovarReforma()}>
                  <I n="check" /> Aprovar orçamento
                </button>
                <p className="rv-fine">Ao aprovar, você contrata a ART de reforma nessas condições (cláusula 10.2 do contrato). Dúvidas? Chame o Rogério antes.</p>
              </div>
            ) : rf.pedido ? (
              <div className="rv-state">
                <I n="clock" s={16} />
                <span>
                  <b>Pedido enviado</b>“{rf.pedido}”. O Rogério vai analisar e o valor aparece aqui (e no seu e-mail).
                </span>
              </div>
            ) : (
              <>
                <p className="rv-hint">Vai fazer obra no apê (piso, armários, forro, iluminação)? O condomínio pede um responsável técnico com ART. Conte o que vai fazer e o Rogério manda o valor aqui. Você só paga se aprovar.</p>
                <p className="rv-alert">
                  <I n="info" s={15} /> <span>No San Levi as paredes são de concreto e <b>estruturais</b>: não dá para derrubar nem rasgar parede para passar cano ou fio. O Rogério confere o que pode ser feito.</span>
                </p>
                <label className="rv-area">
                  <span>O que você pretende fazer?</span>
                  <textarea rows={3} value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Ex.: trocar o piso da sala e fazer armários na cozinha" />
                </label>
                <button className="rv-btn" disabled={pedido.trim().length < 3 || enviando} onClick={() => void pedirReforma()}>
                  <I n="arrow" /> Pedir orçamento
                </button>
              </>
            )}
            {msg && <p className="rv-warn">{msg}</p>}
          </section>
        )}

        {r.dados.revistoria && !r.cancelada && (
          <section className="rv-card">
            <h2 className="rv-h2">
              <I n="redo" s={18} /> Revistoria combinada
            </h2>
            <p className="rv-hint">{s.revistoriaData ? `Marcada para ${dataCurta(s.revistoriaData)}.` : 'Depois que a MRV consertar o que estiver no laudo (em até 90 dias), o engenheiro volta para conferir.'} Valor: {brl(cfg.revistoria)}, pago no dia.</p>
          </section>
        )}

        <Loja />

        <section className="rv-card rv-help">
          <h2 className="rv-h2">
            <I n="chat" s={18} /> Precisa de ajuda?
          </h2>
          <div className="rv-row">
            <a className="rv-btn small" href={zap(`Oi, Rogério! Sou ${r.dados.nome}, da vistoria do ${unidade(r.dados)}.`)}>
              <I n="chat" /> WhatsApp
            </a>
            <button className="rv-btn small ghost" onClick={() => window.dispatchEvent(new Event('rv-duvida'))}>
              <I n="help" /> Mandar dúvida
            </button>
          </div>
          <p className="rv-fine">Guarde este link (ou adicione à tela inicial): é o seu acesso ao contrato, à data e ao laudo. Reserva nº {r.id.slice(0, 8).toUpperCase()}.</p>
        </section>
      </main>
      <Rodape />
      <Duvidas teste={teste} nome={r.dados.nome} contato={r.dados.email || r.dados.tel} reserva={teste ? undefined : { id, token }} />
    </>
  )
}
