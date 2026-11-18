import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './rdlReserva.css'
import { RDL_LOGO } from '../rdlLogo'
import { setRdlFavicon } from '../rdl'
import { formatCep, formatDoc, formatPhone, lookupCep, whatsappLink } from '../utils'
import { deviceLabel } from '../contractSign'
import { SIGN_FONTS } from './SignaturePad'
import { htmlDoLaudo } from '../rdlLaudo'
import { abrirContratoPdf, contratoPdf } from '../rdlContratoPdf'
import { openRdlDoc } from '../rdlDocs'
import {
  CONFIG_PADRAO,
  PLANTA_CANTO,
  PLANTA_CORREDOR,
  RDL_INFO,
  avisarEmail,
  dadosPadrao,
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
  CONTRATO_VERSAO,
  servicosDe,
  valores,
  rastrear,
  guardarLead,
  origem,
  reassinar,
  REFORMA_ITENS,
  REFORMA_MIN,
  calcReforma,
  cupomRdl,
  REFORMA_DESC_VISTORIA,
  reformaItensTexto,
  TERMO_REFORMA,
  termoReformaTexto,
  type ChatMsg,
  type Reserva,
  type ReservaConfig,
  type ReservaDados,
} from '../rdlReserva'

/* Página pública da reserva da vistoria (useplane.com.br/vistoria), na identidade da RDL.
   Feita para quem não entende de vistoria e usa no celular: tudo explicado, com símbolos, um passo de cada vez.
   #/vistoria                → boas-vindas: por que fazer a vistoria, valores do San Levi (vistoria, ART de reforma, guias)
   #/vistoria/reservar       → reservar (dados, contrato e assinatura); reservar-reforma já abre a calculadora da reforma
   #/vistoria/<id>.<código>  → painel da reserva do morador
   #/vistoria/teste          → boas-vindas em modo teste (nada é salvo nem enviado); teste-reservar = reserva de teste
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
  whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20z"/><path d="M9.2 8.6c.2-.4.5-.5.8-.5h.4c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .5-.1.6l-.4.5c.5 1 1.3 1.8 2.3 2.3l.5-.4c.2-.1.4-.2.6-.1l1.4.6c.3.1.4.3.4.5v.4c0 .3-.1.6-.5.8-.6.3-1.4.4-2.2.1a7.6 7.6 0 0 1-4.3-4.3c-.3-.8-.2-1.6.1-2.2z"/>',
  chat: '<path d="M4 19l1.3-3.9A8 8 0 1 1 8.9 18.7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.8.2 5 2.2 5 5.4"/>',
  building: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-5h4v5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5h.01"/>',
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
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9"/><path d="M12 8H7.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8zM12 8h4.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8z"/>',
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
const plantaImg = (p?: string) => (p === PLANTA_CANTO ? 'rdl/planta-canto.png' : p === PLANTA_CORREDOR ? 'rdl/planta-corredor.png' : '')
const plantaCurta = (p?: string) => (p === PLANTA_CANTO ? 'Planta de canto' : p === PLANTA_CORREDOR ? 'Planta de corredor' : p || '')
const prazoSinal = (r: Reserva, dias: number) => {
  const fim = new Date(new Date(r.criado).getTime() + dias * 864e5)
  const faltam = Math.max(0, Math.ceil((fim.getTime() - Date.now()) / 864e5))
  return { fim: fim.toLocaleDateString('pt-BR'), faltam }
}

function Topo({ voltar }: { voltar?: { label: string; acao: () => void } }) {
  return (
    <header className={`rv-top ${voltar ? 'has-back' : ''}`}>
      {voltar && (
        <button type="button" className="rv-topback" onClick={voltar.acao}>
          <I n="back" s={16} /> <span>{voltar.label}</span>
        </button>
      )}
      <img src={RDL_LOGO} alt="RDL Engenharia" />
    </header>
  )
}
const irInicio = (teste?: boolean) => {
  location.hash = teste ? '#/vistoria/teste' : '#/vistoria'
  window.scrollTo(0, 0)
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
  // o botão some enquanto estiver por cima de outro botão (Assinar, Voltar, Pagar…)
  const fab = useRef<HTMLButtonElement>(null)
  const [escondido, setEscondido] = useState(false)
  useEffect(() => {
    let raf = 0
    const ver = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const f = fab.current?.getBoundingClientRect()
        if (!f) return
        const em = [...document.querySelectorAll<HTMLElement>('.rv .rv-btn, .rv .rv-check, .rv input, .rv textarea')].some((el) => {
          if (el === fab.current) return false
          const b = el.getBoundingClientRect()
          return b.width > 0 && b.left < f.right + 6 && b.right > f.left - 6 && b.top < f.bottom + 6 && b.bottom > f.top - 6
        })
        setEscondido(em)
      })
    }
    ver()
    addEventListener('scroll', ver, { passive: true })
    addEventListener('resize', ver)
    const t = setInterval(ver, 800)
    return () => {
      removeEventListener('scroll', ver)
      removeEventListener('resize', ver)
      clearInterval(t)
      cancelAnimationFrame(raf)
    }
  }, [])
  const precisaContato = !conv && !reserva && !teste
  const podeEnviar = !!texto.trim() && (!precisaContato || (f.nome.trim().length > 1 && f.contato.trim().length >= 5))
  return (
    <>
      <button ref={fab} className={`rv-fab ${escondido ? 'is-hidden' : ''}`} onClick={() => setOpen(true)} aria-label="Tirar uma dúvida">
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



/** Explicação da ART de reforma (opcional): quando precisa, o que recebe, como funciona e o que não inclui. */
function ReformaInfo({ recolhido }: { recolhido?: boolean } = {}) {
  const corpo = (
    <div className="rv-rinfo">
      <p className="rv-rinfo-lead">
        É opcional: só para quem vai fazer obra no apê. A vistoria não depende dela.
      </p>
      <div className="rv-rinfo-grid">
        <div>
          <b>
            <I n="info" s={14} /> Quando precisa
          </b>
          <p>Antes de qualquer obra, o condomínio pede a ART e o plano de reforma (norma NBR 16280), com um engenheiro como responsável técnico. Sem eles, o síndico pode não liberar a entrada de material e de pedreiro. A obra continua sendo feita por quem você contratar.</p>
        </div>
        <div>
          <b>
            <I n="check" s={14} /> O que você recebe
          </b>
          <ul>
            <li>O Rogério como responsável técnico, com a ART registrada no CREA (taxa inclusa)</li>
            <li>Plano de reforma pronto para entregar ao síndico</li>
            <li>Orientação do que pode e do que não pode no San Levi</li>
          </ul>
        </div>
        <div>
          <b>
            <I n="list" s={14} /> Como funciona
          </b>
          <ol>
            <li>Você marca o que vai fazer e vê o valor</li>
            <li>O Rogério confere e confirma no seu painel</li>
            <li>Você aprova e manda as informações da obra</li>
            <li>ART e plano entregues antes da obra começar</li>
          </ol>
        </div>
        <div>
          <b>
            <I n="x" s={14} /> Não inclui
          </b>
          <ul>
            <li>A obra em si: quem executa é o pedreiro ou a empresa que você escolher</li>
            <li>Mão de obra e materiais</li>
            <li>Projeto de arquitetura ou de interiores</li>
            <li>Visitas técnicas e acompanhamento da obra</li>
            <li>Taxas do condomínio</li>
          </ul>
        </div>
      </div>
    </div>
  )
  return recolhido ? (
    <details className="rv-what rv-rwrap">
      <summary>
        <I n="info" s={14} /> Entender a ART de reforma: o que inclui e o que não inclui
      </summary>
      {corpo}
    </details>
  ) : (
    corpo
  )
}

/** Calculadora da ART de reforma: base + cada serviço; com a vistoria junto, desconto. */
function ReformaCalc({ itens, onItens, detalhe, onDetalhe, bad, comVistoria = false }: { itens: string[]; onItens: (v: string[]) => void; detalhe: string; onDetalhe: (v: string) => void; bad?: boolean; comVistoria?: boolean }) {
  const total = calcReforma(itens, comVistoria)
  const toggle = (id: string) => onItens(itens.includes(id) ? itens.filter((x) => x !== id) : [...itens, id])
  return (
    <div className={`rv-calc ${bad ? 'bad' : ''}`}>
      <p className="rv-label">
        O que você vai fazer? <small>Marque tudo o que pretende. O valor muda na hora.</small>
      </p>
      <div className="rv-nivel-leg">
        <span>
          <em className="nivel n1"><i /><i /><i /></em> simples
        </span>
        <span>
          <em className="nivel n2"><i /><i /><i /></em> média
        </span>
        <span>
          <em className="nivel n3"><i /><i /><i /></em> complexa
        </span>
      </div>
      <p className="rv-nivel-txt">A base cobre a taxa da ART no CREA e o plano de reforma. Quanto mais complexo o serviço, mais análise e responsabilidade técnica: por isso o valor varia.</p>
      <p className="rv-alert rv-honesto">
        <I n="shield" s={15} />
        <span>
          <b>Marque tudo o que vai fazer.</b> A ART cobre só o que estiver marcado: o que ficar de fora não tem responsável técnico.</span>
      </p>
      <div className="rv-calc-list">
        {REFORMA_ITENS.map((i) => {
          const on = itens.includes(i.id)
          return (
            <button key={i.id} type="button" className={`rv-calc-item ${on ? 'on' : ''}`} onClick={() => toggle(i.id)}>
              <span className="box">{on && <I n="check" s={13} />}</span>
              <span className="txt">
                <b>{i.nome}</b>
                <small>{i.desc}</small>
              </span>
              <em className={`nivel n${i.mais >= 40 ? 3 : i.mais >= 25 ? 2 : 1}`} title={i.mais >= 40 ? 'complexa' : i.mais >= 25 ? 'média' : 'simples'}>
                <i />
                <i />
                <i />
              </em>
            </button>
          )
        })}
      </div>
      <label className="rv-area">
        <span>Quer contar mais? (opcional)</span>
        <textarea rows={2} value={detalhe} onChange={(e) => onDetalhe(e.target.value)} placeholder="Ex.: piso vinílico na sala e nos dois quartos" />
      </label>
      <div className="rv-calc-total">
        <div>
          <small>VALOR ESTIMADO</small>
          <b>{brl(total)}</b>
        </div>
        <span>{comVistoria ? `Já com ${brl(REFORMA_DESC_VISTORIA)} off por fechar com a vistoria.` : 'Taxa do CREA e plano de reforma inclusos.'}</span>
      </div>
      <details className="rv-what">
        <summary>
          <I n="info" s={14} /> O que é o plano de reforma?
        </summary>
        <p>É o documento que o condomínio pede antes de qualquer obra no apê (norma NBR 16280). Diz o que vai ser feito, quem faz, quanto tempo leva e confirma que nada mexe na estrutura. O síndico só libera a obra com ele e com a ART.</p>
      </details>
      <p className="rv-fine">O Rogério confere o que você marcou. Se algum serviço não couber na ART, ela pode ser ajustada ou cancelada, e o valor sai do total.</p>
    </div>
  )
}


/** "Veja o que você recebe": mockups em abas (laudo com fotos, painel no celular e ART). */
function Mockups() {
  const [tab, setTab] = useState<'laudo' | 'painel' | 'art'>('laudo')
  const itens: [string, string, string][] = [
    ['Banheiro', 'Ralo sem caimento: água empoça perto do box', 'banheiro-piso'],
    ['Sala', 'Piso com desnível de 6 mm perto da janela', 'sala-piso'],
    ['Cozinha', 'Tomada da bancada sem energia', 'cozinha-bancada'],
  ]
  return (
    <section className="rv-card rv-mock">
      <h2 className="rv-h2">
        <I n="eye" s={18} /> Veja o que você recebe
      </h2>
      <div className="rv-mock-tabs" role="tablist">
        {(
          [
            ['laudo', 'doc', 'Laudo'],
            ['painel', 'home', 'Painel'],
            ['art', 'shield', 'ART'],
          ] as const
        ).map(([k, i, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            <I n={i} s={14} /> {t}
          </button>
        ))}
      </div>
      {tab === 'laudo' && (
        <div className="rv-mock-stage">
          <div className="rv-paper">
            <div className="rv-paper-top">
              <img src={RDL_LOGO} alt="" />
              <span>LAUDO DE VISTORIA</span>
            </div>
            <div className="rv-paper-res">
              <span className="tag">COM RESSALVAS</span> 3 itens para a MRV consertar
            </div>
            {itens.map(([amb, txt, ic], k) => (
              <div key={k} className="rv-paper-item">
                <span className="ph">
                  <img src={`rdl/fotos/${ic}.jpg`} alt="" loading="lazy" />
                  <em>{k + 1}</em>
                </span>
                <span>
                  <b>
                    {String(k + 1).padStart(2, '0')} · {amb}
                  </b>
                  <small>{txt}</small>
                </span>
              </div>
            ))}
            <div className="rv-paper-foot">
              <span>Eng. Rogério F. Vieira · CREA-SP</span>
              <span className="sig">assinatura</span>
            </div>
          </div>
          <p className="rv-mock-cap">Cada problema com foto, número e lugar. É só mandar para a MRV pelo atendimento dela.</p>
        </div>
      )}
      {tab === 'painel' && (
        <div className="rv-mock-stage">
          <div className="rv-phone">
            <div className="rv-phone-notch" />
            <div className="rv-phone-screen">
              <small className="k">PAINEL DA SUA VISTORIA</small>
              <b className="h">Olá, Ana</b>
              <div className="rv-phone-track">
                {['Reserva', 'Sinal', 'Data', 'Vistoria', 'Laudo'].map((t, i) => (
                  <span key={t} className={i < 2 ? 'done' : i === 2 ? 'now' : ''}>
                    <i>{i < 2 ? <I n="check" s={9} /> : i + 1}</i>
                    {t}
                  </span>
                ))}
              </div>
              <div className="rv-phone-card ok">
                <I n="check" s={13} /> <span><b>Vaga garantida!</b> Agora é esperar a MRV liberar as datas.</span>
              </div>
              <div className="rv-phone-docs">
                <span className="ok">
                  <I n="sign" s={12} /> Contrato
                </span>
                <span>
                  <I n="lock" s={12} /> ART
                </span>
                <span>
                  <I n="lock" s={12} /> Laudo
                </span>
              </div>
            </div>
          </div>
          <p className="rv-mock-cap">Tudo num link só: contrato, pagamento, data, laudo e ART. Você acompanha cada etapa pelo celular.</p>
        </div>
      )}
      {tab === 'art' && (
        <div className="rv-mock-stage">
          <div className="rv-paper art">
            <div className="rv-paper-top">
              <span className="crea">CREA-SP</span>
              <span>ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA</span>
            </div>
            {[
              ['Profissional', 'Eng. Rogério Francisco Vieira'],
              ['Serviço', 'Vistoria de entrega de imóvel'],
              ['Local', 'Condomínio San Levi · seu apê'],
              ['Situação', 'Registrada'],
            ].map(([k, v]) => (
              <div key={k} className="rv-paper-row">
                <small>{k}</small>
                <b>{v}</b>
              </div>
            ))}
            <div className="rv-stamp">
              <I n="shield" s={16} /> REGISTRADA
            </div>
          </div>
          <p className="rv-mock-cap">A ART é o registro no CREA de que um engenheiro responde pela vistoria. Dá peso ao laudo junto à MRV.</p>
        </div>
      )}
    </section>
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

/** Assim que o sinal é confirmado: o cupom aparece flutuando uma vez (depois fica no cartão do painel). */
function CupomFlutuante({ id }: { id: string }) {
  const codigo = cupomRdl(id)
  const chave = `rv-cupom-visto-${id}`
  const [ver, setVer] = useState(() => {
    try {
      return !localStorage.getItem(chave)
    } catch {
      return false
    }
  })
  const fechar = () => {
    setVer(false)
    try {
      localStorage.setItem(chave, '1')
    } catch {
      /* ok */
    }
  }
  if (!ver) return null
  return (
    <div className="rv-float-bg" onClick={(e) => e.target === e.currentTarget && fechar()}>
    <div className="rv-combo-float rv-cupom-float" role="dialog" aria-modal="true" aria-label="Presente: cupom de desconto">
      <button className="rv-combo-x" onClick={fechar} aria-label="Fechar">
        <I n="x" s={16} />
      </button>
      <div className="rv-combo-eq" aria-hidden="true">
        <span>
          <I n="gift" s={20} />
        </span>
        <b>10% OFF</b>
      </div>
      <p>
        <b>Presente por garantir a vistoria:</b> desconto na loja planê.apê, já ativado.
      </p>
      <span className="rv-cupom-chip">{codigo}</span>
      <a className="rv-btn wide" href={`ape/?cupom=${codigo}`} target="_blank" rel="noreferrer" onClick={fechar}>
        Usar agora <I n="arrow" />
      </a>
    </div>
    </div>
  )
}

/** Presente de quem garantiu a vistoria: cupom exclusivo de 10% na loja planê.apê. */
function CupomLoja({ id }: { id: string }) {
  const codigo = cupomRdl(id)
  const [ok, setOk] = useState(false)
  // já deixa o cupom ativo neste aparelho: na loja ele entra sozinho no checkout
  useEffect(() => {
    try {
      localStorage.setItem('plane-cupom', codigo)
    } catch {
      /* ok */
    }
  }, [codigo])
  return (
    <section className="rv-cupom">
      <span className="rv-cupom-tag">
        <I n="gift" s={14} /> PRESENTE EXCLUSIVO
      </span>
      <b className="rv-cupom-t">10% OFF na loja planê.apê</b>
      <p>Para quem garantiu a vistoria: planilha de obra, guia de medidas, marcenaria, pisos e mais.</p>
      <button
        type="button"
        className="rv-cupom-cod"
        onClick={() => {
          void navigator.clipboard?.writeText(codigo).then(() => setOk(true))
        }}
      >
        <span>{codigo}</span>
        <em>{ok ? 'copiado' : 'copiar'}</em>
      </button>
      <a className="rv-btn wide" href={`ape/?cupom=${codigo}`} target="_blank" rel="noreferrer">
        Usar na loja <I n="arrow" s={14} />
      </a>
      <small>Já ativado neste celular. Vale uma compra, em todos os arquivos.</small>
    </section>
  )
}

export function RdlReservaPublic({ sub }: { sub?: string }) {
  useEffect(() => {
    setRdlFavicon('Vistoria de entrega de chaves · RDL Engenharia')
    document.documentElement.classList.add('rv-root')
    return () => document.documentElement.classList.remove('rv-root')
  }, [])
  if (sub === 'teste') return <div className="rv"><Boas teste /></div>
  if (sub === 'teste-reservar') return <div className="rv"><Reservar teste /></div>
  if (sub === 'reservar' || sub === 'reservar-reforma' || sub === 'so-reforma') return <div className="rv"><Reservar comReforma={sub === 'reservar-reforma'} soReforma={sub === 'so-reforma'} /></div>
  if (sub === 'teste-painel') return <div className="rv"><Painel id="" token="" teste /></div>
  if (sub?.startsWith('contrato-')) {
    const [cid2, ctk2] = sub.slice(9).split('.')
    return <ContratoPublico id={cid2} token={ctk2} />
  }
  if (sub?.startsWith('laudo-')) {
    const [lid, ltk] = sub.slice(6).split('.')
    return <LaudoPublico id={lid} token={ltk} />
  }
  if (sub?.startsWith('duvida-')) {
    const [cid, ctk] = sub.slice(7).split('.')
    return <div className="rv"><Boas abrirChat={cid && ctk ? { id: cid, token: ctk } : undefined} /></div>
  }
  const [id, token] = (sub ?? '').split('.')
  return <div className="rv">{id && token ? <Painel id={id} token={token} /> : <Boas />}</div>
}


/* ================= cópia do contrato assinado (link do e-mail) ================= */

function ContratoPublico({ id, token }: { id: string; token: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  const [nome, setNome] = useState('')
  useEffect(() => {
    void minhaReserva(id, token)
      .then(async (r) => {
        if (!r) return setUrl(null)
        setNome(`Contrato RDL ${unidade(r.dados)}.pdf`)
        setUrl(URL.createObjectURL(await contratoPdf(r)))
      })
      .catch(() => setUrl(null))
  }, [id, token])
  return (
    <div className="rv">
      <Topo voltar={{ label: 'Meu painel', acao: () => (location.hash = `#/vistoria/${id}.${token}`) }} />
      <main className="rv-main">
        <section className="rv-card rv-contrato-pub">
          <span className="ib">
            <I n="sign" s={20} />
          </span>
          <h1>Seu contrato assinado</h1>
          {url === undefined ? (
            <p>Gerando o PDF…</p>
          ) : url === null ? (
            <p>Não encontrei este contrato. Confira o link do e-mail ou fale com o Rogério.</p>
          ) : (
            <>
              <p>Assinado por você e pela RDL Engenharia, com o registro da assinatura eletrônica (data, hora, IP, aparelho e código do documento).</p>
              <a className="rv-btn wide2" href={url} target="_blank" rel="noreferrer">
                <I n="doc" /> <span>Abrir o contrato (PDF)</span>
              </a>
              <a className="rv-btn ghost wide2" href={url} download={nome}>
                <I n="copy" /> <span>Baixar uma cópia</span>
              </a>
            </>
          )}
        </section>
      </main>
      <Rodape />
    </div>
  )
}

/* ================= laudo publicado (link do painel e do e-mail) ================= */

function LaudoPublico({ id, token }: { id: string; token: string }) {
  const [html, setHtml] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    void Promise.all([minhaReserva(id, token), lerConfig()]).then(([r, cfg]) => setHtml(r?.status.laudoDados ? htmlDoLaudo(r, cfg) : null))
  }, [id, token])
  // no celular, a folha A4 encolhe para caber na largura da tela (o iframe herda a política da página: sem script dentro dele)
  const ajustar = (fr: HTMLIFrameElement | null) => {
    const doc = fr?.contentDocument
    if (!fr || !doc?.body) return
    doc.body.style.setProperty('zoom', String(Math.min(1, (fr.clientWidth - 8) / 810)))
  }
  useEffect(() => {
    const on = () => ajustar(document.querySelector<HTMLIFrameElement>('.rv-laudo-doc'))
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return (
    <div className="rv rv-laudo">
      <div className="rv-laudo-bar">
        <a href={`#/vistoria/${id}.${token}`} className="rv-laudo-back">
          <I n="back" /> meu painel
        </a>
        <b>Laudo de vistoria</b>
        {html && (
          <button className="rv-btn small" onClick={() => openRdlDoc(html)}>
            <I n="doc" /> salvar em PDF
          </button>
        )}
      </div>
      {html === undefined ? (
        <p className="rv-laudo-msg">Abrindo o laudo…</p>
      ) : html === null ? (
        <p className="rv-laudo-msg">O laudo ainda não está pronto. Assim que o engenheiro publicar, ele aparece aqui e no seu painel.</p>
      ) : (
        <iframe className="rv-laudo-doc" title="Laudo de vistoria" srcDoc={html} onLoad={(e) => ajustar(e.currentTarget)} />
      )}
    </div>
  )
}

/* ================= boas-vindas (acolhimento) ================= */

function Boas({ teste, abrirChat }: { teste?: boolean; abrirChat?: { id: string; token: string } }) {
  const [cfg, setCfg] = useState<ReservaConfig>(CONFIG_PADRAO)
  const [n, setN] = useState(0)
  useEffect(() => {
    void lerConfig().then(setCfg)
    void contagem().then(setN)
    try {
      if (teste) sessionStorage.setItem('rdl-teste', '1')
      else sessionStorage.removeItem('rdl-teste')
    } catch {
      /* ok */
    }
    rastrear('abriu', { pagina: 'boas-vindas', origem: origem() })
    // até onde a pessoa lê: registra cada parte da página que aparece na tela (uma vez)
    const vistas = new Set<string>()
    const obs = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          const k = (e.target as HTMLElement).dataset.sec
          if (e.isIntersecting && k && !vistas.has(k)) {
            vistas.add(k)
            rastrear('viu', { secao: k })
          }
        }),
      { threshold: 0.35 },
    )
    setTimeout(() => document.querySelectorAll('[data-sec]').forEach((el) => obs.observe(el)), 300)
    return () => obs.disconnect()
  }, [teste])
  const salvo = teste ? '' : ls.get(SALVO)
  const largo = typeof window !== 'undefined' && window.matchMedia('(min-width: 820px)').matches
  const metade = cfg.preco / 2
  const reservar = teste ? '#/vistoria/teste-reservar' : '#/vistoria/reservar'
  return (
    <>
      <Topo />
      {teste && <Teste />}
      <main className="rv-main rv-wide">
        <section className="rv-welcome">
          <span className="rv-pill or">
            <i /> EXCLUSIVO · MORADORES SAN LEVI
          </span>
          <h1>
            Seu apê novo merece ser <span>recebido do jeito certo</span>
          </h1>
          <p>Antes de assinar com a MRV, um engenheiro confere tudo com você. O que estiver errado fica no laudo, com fotos e ART.</p>
          <div className="rv-importa">
            <I n="alert" s={16} />
            <span>
              <b>Não é obrigatória, mas faz toda a diferença:</b> depois de assinar o recebimento da MRV, fica difícil provar que o defeito já estava lá.
            </span>
          </div>
          <div className="rv-row center-row">
            <a className="rv-btn" href={reservar} onClick={() => rastrear('clicou', { alvo: 'reservar (topo)' })}>
              <I n="key" /> Reservar minha vistoria
            </a>
            <a className="rv-link rv-hero-link" href="#valores" onClick={(e) => (e.preventDefault(), document.getElementById('valores')?.scrollIntoView({ behavior: 'smooth' }))}>
              Ver valores e serviços <I n="arrow" s={14} />
            </a>
          </div>
          <div className="rv-trust">
            <span>
              <I n="shield" s={15} /> <span>Engenheiro civil · CREA-SP</span>
            </span>
            <span>
              <I n="doc" s={15} /> <span>Laudo com fotos em 4 dias úteis</span>
            </span>
            <span>
              <I n="users" s={15} /> <span>{n} de {cfg.minimo} vagas do grupo</span>
            </span>
          </div>
        </section>

        {salvo && (
          <a className="rv-saved" href={salvo}>
            <I n="check" /> <span>Você já tem uma reserva neste celular. <b>Abrir o meu painel</b> <I n="arrow" /></span>
          </a>
        )}

        <section className="rv-offers" id="valores" data-sec="valores">
          <div className="rv-sec-head">
            <small>CONDIÇÃO ESPECIAL SAN LEVI</small>
            <h2>Escolha o que você precisa</h2>
            <p>Contrate um, o outro ou os dois.</p>
          </div>
          <p className="rv-condicao">
            <I n="clock" s={15} />
            <span>
              <b>Não precisa fechar agora.</b> Mas são valores do San Levi e podem mudar com o tempo: quem fecha antes garante o preço e o horário.
            </span>
          </p>
          <div className="rv-offer hi">
            <div className="rv-offer-head">
              <span className="ib">
                <I n="key" s={20} />
              </span>
              <div>
                <em className="quando">ANTES DE RECEBER AS CHAVES</em>
                <b>Vistoria de entrega das chaves</b>
                <small>Engenheiro confere tudo com você. Laudo com fotos e ART.</small>
              </div>
            </div>
            <div className="rv-offer-price">
              <strong>{brl(cfg.preco)}</strong>
              <span>no grupo de {cfg.minimo} · individual {brl(cfg.individual)}</span>
            </div>
            <a className="rv-btn light" href={reservar} onClick={() => rastrear('clicou', { alvo: 'reservar (valores)' })}>
              Reservar minha vistoria <I n="arrow" />
            </a>
          </div>
          <div className="rv-offer navy">
            <div className="rv-offer-head">
              <span className="ib">
                <I n="hammer" s={20} />
              </span>
              <div>
                <em className="quando">ANTES DE FAZER OBRA NO APÊ</em>
                <b>ART de reforma</b>
                <small>Exigida pelo condomínio para liberar a obra. O pedreiro é você quem escolhe.</small>
              </div>
            </div>
            <div className="rv-offer-price">
              <strong>
                <em>a partir de</em> {brl(REFORMA_MIN)}
              </strong>
              <span>conforme os serviços · {brl(REFORMA_DESC_VISTORIA)} off com a vistoria</span>
            </div>
            <a className="rv-btn" href={teste ? '#/vistoria/teste-reservar' : '#/vistoria/so-reforma'} onClick={() => rastrear('clicou', { alvo: 'ART de reforma' })}>
              Simular e contratar <I n="arrow" />
            </a>
          </div>
        </section>

        <Grupo n={n} cfg={cfg} />


        <section className="rv-card" id="por-que" data-sec="por que fazer">
          <h2 className="rv-h2">
            <I n="shield" s={18} /> Por que fazer a vistoria
          </h2>
          <div className="rv-reasons">
            {[
              ['doc', 'Fica registrado', 'O que não é anotado é mais difícil cobrar.'],
              ['search', 'Olho técnico', 'Prumo, nível, água, luz, portas.'],
              ['shield', 'Laudo com ART', 'Assinado por engenheiro do CREA.'],
              ['key', 'Sem susto', 'Você sabe o que a MRV deve arrumar.'],
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
          <p className="rv-label">O que costuma aparecer em apê novo</p>
          <div className="rv-chips">
            {['Piso desnivelado', 'Azulejo oco ou trincado', 'Ralo sem caimento', 'Tomada sem energia', 'Porta que não fecha', 'Janela com folga', 'Mancha de infiltração', 'Parede fora de prumo'].map((t) => (
              <span key={t}>
                <I n="x" s={11} /> <span>{t}</span>
              </span>
            ))}
          </div>
        </section>

        <div data-sec="o que recebe">
          <Mockups />
        </div>


        <section className="rv-card" data-sec="como funciona">
          <h2 className="rv-h2">
            <I n="list" s={18} /> Como funciona a vistoria
          </h2>
          <ol className="rv-how">
            {[
              ['sign', 'Reserve pelo celular', 'Dados e contrato em 3 minutos.'],
              ['card', 'Pague o sinal', `${brl(metade)} por Pix, em até 7 dias.`],
              ['cal', 'Combine o horário', 'Quando a MRV liberar, fale com o Rogério.'],
              ['search', 'Dia da vistoria', 'O engenheiro confere tudo com você.'],
              ['doc', 'Laudo + ART', 'Em até 4 dias úteis, pronto para a MRV.'],
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

        <details className="rv-iodet" open={largo}>
          <summary>
            <I n="list" s={16} /> O que está incluso e o que não está
          </summary>
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
        </details>
        <section className="rv-who">
          <img src={RDL_LOGO} alt="RDL Engenharia" />
          <div>
            <small>QUEM FAZ</small>
            <b>{RDL_INFO.engineer}</b>
            <span>Engenheiro civil · CREA-SP {RDL_INFO.crea}</span>
            <span>RDL Engenharia e Representações · Santo André</span>
          </div>
        </section>

        <section className="rv-card rv-faq" data-sec="dúvidas comuns">
          <h2 className="rv-h2">
            <I n="info" s={18} /> Dúvidas comuns
          </h2>
          <div className="rv-faq-list">
          {[
            ['A vistoria é obrigatória?', 'Não é obrigatória. Mas é muito recomendada: depois que você assina o termo de recebimento da MRV, fica bem mais difícil provar que um defeito (piso oco, ralo sem caimento, tomada sem energia, infiltração) já estava lá. Com o laudo e a ART, fica tudo registrado para a MRV consertar na garantia.'],
            ['Preciso fechar agora?', 'Não tem data limite: dá para reservar enquanto houver horário. Mas estes valores são do San Levi e podem mudar com o tempo, e a agenda segue a ordem das reservas (a MRV deve liberar as chaves por andar). Fechar antes garante o valor de hoje e o seu horário.'],
            ['Preciso fechar a ART de reforma agora?', `Não. Pode contratar só quando for fazer a obra. Fechar agora garante o valor de hoje (e ${brl(REFORMA_DESC_VISTORIA)} de desconto com a vistoria). A ART mesmo só é gerada perto da reforma, com as datas e os serviços certos.`],
            ['Quando a MRV entrega?', 'O contrato da MRV prevê a entrega para 31/10/2026, com prazo máximo em 30/04/2027. Ela avisa por e-mail quando o apê estiver pronto para a vistoria.'],
            ['A MRV ainda não marcou a minha data. Posso reservar?', `Pode, e é o ideal. A reserva guarda a sua vaga na agenda. Quando a MRV liberar a data (previsão: ${cfg.periodo}), você combina o horário com o Rogério.`],
            ['Quando eu pago?', `O sinal de ${brl(metade)} em até 7 dias depois de reservar, por Pix. O restante no dia da vistoria, por Pix.`],
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
          </div>
          <button className="rv-btn ghost wide3" onClick={() => window.dispatchEvent(new Event('rv-duvida'))}>
            <I n="help" /> Não achou? Pergunte aqui
          </button>

        </section>

        <section className="rv-after" data-sec="loja">
          <p className="rv-after-t">
            <I n="bag" s={15} /> <span>Depois das chaves</span>
          </p>
          <a className="rv-offer plain mini" href="ape/" target="_blank" rel="noreferrer" onClick={() => rastrear('clicou', { alvo: 'loja' })}>
            <div className="rv-offer-head">
              <span className="ib">
                <I n="bag" s={20} />
              </span>
              <div>
                <b>Guias e planilhas para o apê</b>
                <small>Da planê.apê: planilha de obra, medidas dos móveis, marcenaria, pisos e mais</small>
              </div>
            </div>
            <p className="rv-loja-preco">
              A partir de <b>R$ 12,90</b> · baixa na hora
            </p>
            <em className="go">
              Conhecer a loja <I n="arrow" s={13} />
            </em>
          </a>
        </section>

        <a className="rv-btn wide3 big" href={reservar} data-sec="fim da página" onClick={() => rastrear('clicou', { alvo: 'reservar (fim)' })}>
          <I n="key" /> Reservar minha vistoria
        </a>
      </main>
      <Rodape />
      <Duvidas teste={teste} abrirCom={abrirChat} />
    </>
  )
}

/* ================= reserva ================= */

const TESTE_EXEMPLO: Partial<ReservaDados> = { nome: 'Morador Teste', cpf: '529.982.247-25', email: 'teste@exemplo.com', tel: '(11) 9 0000-0000', cep: '09170-000', rua: 'Rua Exemplo', numero: '100', bairro: 'Vila João Ramalho', cidade: 'Santo André', uf: 'SP', torre: '2', apto: '1204', planta: PLANTA_CORREDOR }
const vazio: ReservaDados = { nome: '', cpf: '', email: '', tel: '', endereco: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', torre: '', apto: '', planta: '', revistoria: false, reforma: '' }

function Reservar({ teste, comReforma, soReforma }: { teste?: boolean; comReforma?: boolean; soReforma?: boolean }) {
  const [cfg, setCfg] = useState<ReservaConfig>(CONFIG_PADRAO)
  const [, setN] = useState(0)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [d, setD] = useState<ReservaDados>(() => {
    let base = vazio
    try {
      base = { ...vazio, ...JSON.parse(sessionStorage.getItem('rdl-reserva-rascunho') || '{}') }
    } catch {
      /* ok */
    }
    if (soReforma) return { ...base, servicos: { vistoria: false, reforma: true } }
    if (comReforma) return { ...base, servicos: { vistoria: base.servicos?.vistoria ?? false, reforma: true } }
    // nada vem marcado: a pessoa escolhe o que quer
    return { ...base, servicos: base.servicos ?? { vistoria: false, reforma: false } }
  })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [cepMsg, setCepMsg] = useState('')
  const salvo = useMemo(() => (teste ? '' : ls.get(SALVO)), [teste])
  useEffect(() => {
    void lerConfig().then(setCfg)
    void contagem().then(setN)
    if (teste)
      try {
        sessionStorage.setItem('rdl-teste', '1')
      } catch {
        /* ok */
      }
    rastrear('abriu', { pagina: 'reservar', origem: origem() })
  }, [teste])
  useEffect(() => {
    rastrear('etapa', { nome: step === 1 ? 'servicos' : step === 2 ? 'dados' : 'contrato' })
  }, [step])
  useEffect(() => {
    try {
      sessionStorage.setItem('rdl-reserva-rascunho', JSON.stringify(d))
    } catch {
      /* ok */
    }
  }, [d])
  const set = <K extends keyof ReservaDados>(k: K, v: ReservaDados[K]) => setD((x) => ({ ...x, [k]: v }))
  const sv = servicosDe(d)
  const setSv = (k: 'vistoria' | 'reforma', v: boolean) => setD((x) => ({ ...x, servicos: { ...servicosDe(x), [k]: v } }))
  const sugerida = plantaDoApto(d.apto)
  // fechou só um serviço: oferece o combo uma vez (desconto na ART + cupom da loja depois do sinal)
  const [combo, setCombo] = useState<'' | 'aberto' | 'visto'>('')
  useEffect(() => {
    if (step !== 1 || combo || sv.vistoria === sv.reforma) return
    const t = setTimeout(() => setCombo('aberto'), 700)
    return () => clearTimeout(t)
  }, [step, combo, sv.vistoria, sv.reforma])
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
  const faltaServico = !sv.vistoria && !sv.reforma
  const faltaReforma = sv.reforma && !(d.reformaItens ?? []).length
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
  }
  const okDados = !Object.values(faltando).some(Boolean)
  const dc = useMemo(() => {
    const s2 = servicosDe(d)
    const itens = s2.reforma ? d.reformaItens ?? [] : []
    const txt = s2.reforma ? [reformaItensTexto(itens).join(', '), (d.reforma ?? '').trim()].filter(Boolean).join('. ') : ''
    const dp = dadosPadrao(d)
    return { ...dp, endereco: enderecoCompleto(dp), revistoria: s2.vistoria ? d.revistoria : false, reforma: txt, reformaItens: itens, reformaEstimativa: s2.reforma ? calcReforma(itens, s2.vistoria) : undefined, precoVistoria: s2.vistoria ? cfg.preco : undefined }
  }, [d])
  const texto = useMemo(() => contratoTexto(dc, cfg), [dc, cfg])
  const v = valores(dc, cfg)
  const irPara = () => document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' })
  const campo = (k: keyof typeof faltando) => (tried && faltando[k] ? 'bad' : '')

  const enviar = async (a: Assinatura) => {
    if (busy) return
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
      const ap = deviceLabel()
      const codigo = await sha256([texto, d.nome.trim(), d.cpf.replace(/\D/g, ''), em, ap].join('|'))
      const r = await reservar({ ...dc }, { texto, assinatura: dc.nome, desenho: a.modo === 'desenho' ? a.desenho : undefined, cpf: dc.cpf, em, codigo, aparelho: ap, fuso, versao: CONTRATO_VERSAO, email: dc.email, tel: dc.tel, fonte: a.modo === 'digitado' ? a.fonte : undefined, ua: navigator.userAgent.slice(0, 300), tela: `${screen.width}×${screen.height}`, idioma: navigator.language })
      rastrear('assinou', { vistoria: sv.vistoria, reforma: sv.reforma })
      void avisarEmail('reserva', r.id, r.token)
      if (sv.reforma) void avisarEmail('reforma-aprovada', r.id, r.token)
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
  // cada etapa entra no histórico: o voltar do site e o do celular voltam uma etapa
  const ir = (k: 1 | 2 | 3) => {
    if (k < step && (history.state as { rvStep?: number } | null)?.rvStep === step) return history.go(k - step)
    if (k > step) history.pushState({ ...(history.state ?? {}), rvStep: k }, '')
    setStep(k)
    setTimeout(irPara, 30)
  }
  useEffect(() => {
    const pop = (e: PopStateEvent) => {
      setStep(((e.state as { rvStep?: number } | null)?.rvStep ?? 1) as 1 | 2 | 3)
      setTimeout(irPara, 30)
    }
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Topo voltar={step > 1 ? { label: 'Voltar', acao: () => ir((step - 1) as 1 | 2) } : { label: 'Início', acao: () => irInicio(teste) }} />
      {teste && <Teste />}
      <main className="rv-main rv-wide">
        {combo === 'aberto' && (
          <div className="rv-float-bg" onClick={(e) => e.target === e.currentTarget && setCombo('visto')}>
          <div className="rv-combo-float" role="dialog" aria-modal="true" aria-label="Desconto fechando os dois">
            <button className="rv-combo-x" onClick={() => setCombo('visto')} aria-label="Fechar">
              <I n="x" s={16} />
            </button>
            <div className="rv-combo-eq" aria-hidden="true">
              <span>
                <I n="key" s={20} />
              </span>
              <i>+</i>
              <span>
                <I n="hammer" s={20} />
              </span>
              <i>=</i>
              <b>−{brl(REFORMA_DESC_VISTORIA)}</b>
            </div>
            <p>
              <b>Vistoria + ART de reforma</b> juntas: {brl(REFORMA_DESC_VISTORIA)} off na ART.
            </p>
            <button
              className="rv-btn wide"
              onClick={() => {
                setSv(sv.vistoria ? 'reforma' : 'vistoria', true)
                setCombo('visto')
              }}
            >
              Quero os dois <I n="arrow" />
            </button>
          </div>
          </div>
        )}
        {step === 1 && (
          <section className="rv-hero">
            <span className="rv-pill">
              <i /> MORADORES · {cfg.empreendimento.replace(/\s*\(.*\)/, '').toUpperCase()}
            </span>
            <h1>
              Contrate <span>pelo celular</span>
            </h1>
            <p>Escolha, preencha e assine. Leva uns 3 minutos.</p>
          </section>
        )}

        {salvo && (
          <a className="rv-saved" href={salvo}>
            <I n="check" /> <span>Você já tem uma reserva neste celular. <b>Abrir o meu painel</b> <I n="arrow" /></span>
          </a>
        )}

        {!cfg.aberta && !teste ? (
          <section className="rv-card rv-closed">
            <h2>Reservas encerradas</h2>
            <p>As vagas desta campanha foram preenchidas. Fale com o Rogério para saber se ainda há horário.</p>
            <a className="rv-btn" href={whatsappLink(RDL_INFO.whatsapp, 'Oi, Rogério! Vi que as reservas encerraram. Ainda tem horário?')}>
              <I n="chat" /> Falar no WhatsApp
            </a>
          </section>
        ) : (
          <section className="rv-card rv-form" id="reservar">
            <ol className="rv-steps three">
              {['O que você quer', 'Seus dados', 'Contrato e total'].map((t, k) => (
                <li key={t} className={step === k + 1 ? 'on' : step > k + 1 ? 'done' : ''}>
                  <b>{step > k + 1 ? <I n="check" s={12} /> : k + 1}</b> {t}
                </li>
              ))}
            </ol>

            {step === 1 && (
              <>
                <p className="rv-label">
                  O que você quer contratar? <small>Um, o outro ou os dois.</small>
                </p>
                <div className={`rv-pick ${sv.vistoria ? 'on' : ''}`}>
                  <button type="button" className="rv-pick-head" onClick={() => setSv('vistoria', !sv.vistoria)}>
                    <span className="box">{sv.vistoria && <I n="check" s={14} />}</span>
                    <span className="ib">
                      <I n="key" s={18} />
                    </span>
                    <span className="txt">
                      <b>Vistoria de entrega das chaves</b>
                      <small>Antes de receber as chaves. Laudo com fotos e ART.</small>
                    </span>
                    <strong>{brl(cfg.preco)}</strong>
                  </button>
                  {sv.vistoria && (
                    <button type="button" className={`rv-pick-sub ${d.revistoria ? 'on' : ''}`} onClick={() => set('revistoria', !d.revistoria)}>
                      <span className="box">{d.revistoria && <I n="check" s={13} />}</span>
                      <span className="txt">
                        <b>
                          <I n="redo" s={14} /> Revistoria <span className="rv-opt">OPCIONAL</span>
                        </b>
                        <small>O engenheiro volta para conferir os consertos. Paga no dia.</small>
                      </span>
                      <strong>+ {brl(cfg.revistoria)}</strong>
                    </button>
                  )}

                </div>

                <div className={`rv-pick ${sv.reforma ? 'on' : ''}`}>
                  <button type="button" className="rv-pick-head" onClick={() => setSv('reforma', !sv.reforma)}>
                    <span className="box">{sv.reforma && <I n="check" s={14} />}</span>
                    <span className="ib navy">
                      <I n="hammer" s={18} />
                    </span>
                    <span className="txt">
                      <b>ART de reforma</b>
                      <small>Para o condomínio liberar a sua obra. ART e plano de reforma.</small>
                    </span>
                    <strong>
                      <em>a partir de</em>
                      {brl(REFORMA_MIN)}
                    </strong>
                  </button>
                  {sv.reforma && (
                    <div className="rv-pick-body">
                      <ReformaInfo recolhido />
                      <ReformaCalc itens={d.reformaItens ?? []} onItens={(x) => set('reformaItens', x)} detalhe={d.reforma ?? ''} onDetalhe={(x) => set('reforma', x)} bad={tried && faltaReforma} comVistoria={sv.vistoria} />
                    </div>
                  )}
                </div>
                <a className="rv-pick files" href="ape/" target="_blank" rel="noreferrer" onClick={() => rastrear('clicou', { alvo: 'loja' })}>
                  <span className="ib soft">
                    <I n="bag" s={18} />
                  </span>
                  <span className="txt">
                    <b>Guias e planilhas para o apê</b>
                    <small>A partir de R$ 12,90 na loja planê.apê</small>
                  </span>
                  <I n="arrow" s={16} />
                </a>
                <Total v={v} sv={sv} cfg={cfg} revistoria={d.revistoria} />
                {tried && faltaServico && <p className="rv-warn">Escolha pelo menos um serviço.</p>}
                {tried && faltaReforma && <p className="rv-warn">Marque pelo menos um serviço da reforma para continuar.</p>}
                <button
                  className="rv-btn wide3"
                  onClick={() => {
                    if (teste) {
                      if (faltaServico) setSv('vistoria', true)
                      setTried(false)
                      return ir(2)
                    }
                    setTried(true)
                    if (faltaServico || faltaReforma) return
                    setTried(false)
                    ir(2)
                  }}
                >
                  Continuar <I n="arrow" />
                </button>
              </>
            )}

            {step === 2 && (
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
                  {(d.rua || d.cidade || (d.cep ?? '').replace(/\D/g, '').length === 8 || cepMsg) && (
                  <>
                  <label className={`span2 ${campo('rua')}`}>
                    <span>Rua</span>
                    <input value={d.rua} onChange={(e) => set('rua', e.target.value)} autoComplete="address-line1" />
                  </label>
                  <label>
                    <span>Complemento</span>
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
                  </>
                  )}
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
                        const x = e.target.value
                        const pl = plantaDoApto(x)
                        setD((y) => ({ ...y, apto: x, planta: pl || y.planta }))
                      }}
                      inputMode="numeric"
                      placeholder="Ex.: 1204"
                    />
                  </label>
                </div>
                <p className={`rv-label ${campo('planta')}`}>
                  Qual é a sua planta? <small>{sugerida ? 'Já marcamos pelo número do apto. Se não for, toque na outra.' : 'Toque na sua.'}</small>
                </p>
                <Plantas value={d.planta} onChange={(x) => set('planta', x)} sugerida={sugerida} />
                {sv.reforma && (
                  <label className="rv-area">
                    <span>Quem vai fazer a obra? (pode informar depois)</span>
                    <input value={d.prestador ?? ''} onChange={(e) => set('prestador', e.target.value)} placeholder="Nome do pedreiro ou da empresa e telefone" />
                  </label>
                )}
                {tried && !okDados && <p className="rv-warn">Falta preencher ou conferir os campos marcados em laranja.</p>}
                <p className="rv-fine">Se precisar parar no meio, mandamos um lembrete para o seu e-mail para você terminar depois.</p>
                <div className="rv-row">
                  <button className="rv-btn ghost" onClick={() => ir(1)}>
                    <I n="back" /> Voltar
                  </button>
                  <button
                    className="rv-btn"
                    onClick={() => {
                      if (teste) {
                        // modo teste: o que ficou vazio vira dado de exemplo
                        setD((x) => ({ ...TESTE_EXEMPLO, ...Object.fromEntries(Object.entries(x).filter(([, val]) => val !== '' && val !== undefined)) }) as ReservaDados)
                        setTried(false)
                        return ir(3)
                      }
                      setTried(true)
                      if (!okDados) return
                      setTried(false)
                      guardarLead(dc)
                      ir(3)
                    }}
                  >
                    Continuar <I n="arrow" />
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <Total v={v} sv={sv} cfg={cfg} titulo revistoria={d.revistoria} />
                <Assinar texto={texto} nome={dc.nome} reforma={sv.reforma} agora={v.agora} busy={busy} erro={erro} onVoltar={() => ir(2)} onAssinar={(a) => void enviar(a)} livre={teste} />
              </>
            )}
          </section>
        )}
      </main>
      <Rodape />
      <Duvidas teste={teste} />
    </>
  )
}

/** Resumo dos valores: o que foi escolhido, o total e o que paga agora no Pix. */
function Total({ v, sv, cfg, titulo, revistoria }: { v: ReturnType<typeof valores>; sv: { vistoria: boolean; reforma: boolean }; cfg: ReservaConfig; titulo?: boolean; revistoria?: boolean }) {
  if (!sv.vistoria && !sv.reforma) return null
  // descontos que já estão no preço: valor de grupo na vistoria e combo na ART de reforma
  const descGrupo = sv.vistoria ? Math.max(0, cfg.individual - v.vistoria) : 0
  const descCombo = sv.vistoria && sv.reforma ? REFORMA_DESC_VISTORIA : 0
  const economia = descGrupo + descCombo
  return (
    <div className="rv-total">
      {titulo && <small className="k">RESUMO</small>}
      {sv.vistoria && (
        <div className="row">
          <span>
            <I n="key" s={14} /> Vistoria de entrega
          </span>
          <b>
            {descGrupo > 0 && <s>{brl(cfg.individual)}</s>} {brl(v.vistoria)}
          </b>
        </div>
      )}
      {sv.vistoria && revistoria && (
        <div className="row">
          <span>
            <I n="redo" s={14} /> Revistoria (paga no dia)
          </span>
          <b>{brl(cfg.revistoria)}</b>
        </div>
      )}
      {sv.reforma && (
        <div className="row">
          <span>
            <I n="hammer" s={14} /> ART de reforma
          </span>
          <b>
            {descCombo > 0 && <s>{brl(v.reforma + descCombo)}</s>} {brl(v.reforma)}
          </b>
        </div>
      )}
      {economia > 0 && (
        <div className="row desc">
          <span>
            <I n="gift" s={14} /> Descontos aplicados
          </span>
          <b>−{brl(economia)}</b>
        </div>
      )}
      {economia > 0 && (
        <div className="rv-desc-chips">
          {descGrupo > 0 && <em>grupo San Levi −{brl(descGrupo)}</em>}
          {descCombo > 0 && <em>vistoria + ART −{brl(descCombo)}</em>}
        </div>
      )}
      <div className="row sum">
        <span>Total</span>
        <b>{brl(v.total + (sv.vistoria && revistoria ? cfg.revistoria : 0))}</b>
      </div>
      <div className="row now">
        <span>
          <I n="card" s={14} /> Agora, no Pix
        </span>
        <b>{brl(v.agora)}</b>
      </div>
      <p>
        Restante: {[sv.vistoria ? `${brl(v.vistoria - v.sinalVistoria)} no dia da vistoria` : '', sv.reforma ? `${brl(v.reforma - v.sinalReforma)} na entrega da ART` : ''].filter(Boolean).join(' e ')}. Sinal em até 7 dias.
        {descGrupo > 0 && ` O desconto de grupo vale com ${cfg.minimo} reservas; se não fechar, os ${brl(descGrupo)} entram no restante.`}
      </p>
    </div>
  )
}

/** Leitura do contrato, aceite e assinatura (na reserva e quando o painel pede para assinar de novo). */
/** Área grande para assinar com o dedo (600 × 360). Ao terminar, o traço é encaixado na proporção da assinatura do contrato (600 × 200). */
function RvPad({ onChange }: { onChange: (path: string) => void }) {
  const W = 600
  const H = 360
  const box = useRef<SVGSVGElement>(null)
  const drawing = useRef(false)
  const last = useRef<[number, number] | null>(null)
  const [live, setLive] = useState('')
  const pt = (e: React.PointerEvent): [number, number] => {
    const r = box.current!.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)]
  }
  const encaixar = (d: string) => {
    const k = 200 / H
    const dx = (600 - W * k) / 2
    let i = 0
    return d.replace(/-?\d+(\.\d+)?/g, (n) => {
      const v = Number(n)
      const out = i % 2 === 0 ? v * k + dx : v * k
      i++
      return String(Math.round(out * 10) / 10)
    })
  }
  const fim = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    onChange(live ? encaixar(live) : '')
  }
  return (
    <div className="rv-pad">
      <svg
        ref={box}
        viewBox={`0 0 ${W} ${H}`}
        className="rv-pad-area"
        onPointerDown={(e) => {
          e.preventDefault()
          // captura no próprio quadro (o texto de dica some no primeiro traço e não pode levar o toque junto)
          e.currentTarget.setPointerCapture?.(e.pointerId)
          drawing.current = true
          const [x, y] = pt(e)
          last.current = [x, y]
          setLive((v) => `${v}M${x} ${y}L${x + 1} ${y}`)
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return
          const [x, y] = pt(e)
          if (Math.abs(x - last.current[0]) + Math.abs(y - last.current[1]) < 3) return
          last.current = [x, y]
          setLive((v) => `${v}L${x} ${y}`)
        }}
        onPointerUp={fim}
        onPointerCancel={fim}
        onTouchMove={(e) => e.preventDefault()}
      >
        <line x1="50" x2={W - 50} y1={H - 80} y2={H - 80} stroke="#b8c4d6" strokeWidth={2} strokeDasharray="6 6" pointerEvents="none" />
        <path d={live || 'M0 0'} fill="none" stroke={live ? '#012C60' : 'none'} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        {!live && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fill="#9aa3b6" fontSize="26" pointerEvents="none">
            assine aqui com o dedo
          </text>
        )}
      </svg>
      <button type="button" className="rv-link small" disabled={!live} onClick={() => (setLive(''), onChange(''))}>
        Limpar
      </button>
    </div>
  )
}

type Assinatura = { modo: 'digitado' | 'desenho'; desenho: string; fonte: string }
const FONTES_ASS = SIGN_FONTS.filter((f) => ['dancing', 'greatvibes', 'homemade'].includes(f.id))

function Assinar({ texto, nome, reforma, agora, busy, erro, onVoltar, onAssinar, botao = 'Assinar e reservar', livre }: { texto: string; nome: string; reforma: boolean; agora: number; busy: boolean; erro: string; onVoltar?: () => void; onAssinar: (a: Assinatura) => void; botao?: string; livre?: boolean }) {
  const [ok, setOk] = useState(false)
  const [okTermo, setOkTermo] = useState(false)
  const [nomeAss, setNomeAss] = useState('')
  const [fonte, setFonte] = useState(FONTES_ASS[0].id)
  const [desenho, setDesenho] = useState('')
  const [tela, setTela] = useState(false)
  const [modo, setModo] = useState<'digitado' | 'desenho'>('desenho')
  const nomeOk = nomeAss.trim().toLowerCase() === nome.trim().toLowerCase()
  const assinou = !!livre || (ok && (!reforma || okTermo) && (modo === 'digitado' ? nomeOk : desenho.length > 30))
  return (
    <>
      <div className="rv-keys">
        <p>
          <I n="card" /> <span>Pague <b>{brl(agora)}</b> por Pix em até 7 dias. Sem o pagamento, a reserva é cancelada sozinha, sem custo.</span>
        </p>
        <p>
          <I n="shield" /> <span>Mudou de ideia? Até 7 dias depois de assinar, o valor volta inteiro{reforma ? ' (na ART de reforma, desde que ela ainda não tenha sido registrada)' : ''}.</span>
        </p>
      </div>
      <p className="rv-hint">Este é o seu contrato, já com os seus dados e com o que você escolheu. Role para ler tudo.</p>
      <div className="rv-contract" tabIndex={0}>
        {texto.split('\n').map((l: string, i: number) =>
          i === 0 ? (
            <h4 key={i}>{l}</h4>
          ) : /^(\d+\. |A\d+\. |CONTRATADA$|CONTRATANTE$|IMÓVEL( VISTORIADO)?$|ANEXO)/.test(l) ? (
            <h5 key={i}>{l}</h5>
          ) : l.trim() ? (
            <p key={i}>{l}</p>
          ) : null,
        )}
      </div>
      {reforma && (
        <label className={`rv-check ${okTermo ? 'on' : ''}`}>
          <input type="checkbox" checked={okTermo} onChange={(e) => setOkTermo(e.target.checked)} />
          <span>
            <b>Entendi como funciona a ART de reforma</b>
            <small>O Rogério faz o plano de reforma e assina a ART, mas não executa a obra. Quem faz a obra (o seu pedreiro ou empresa) responde por ela, pelos materiais e pela segurança. Vou passar o plano para ele seguir.</small>
          </span>
        </label>
      )}
      <label className={`rv-check ${ok ? 'on' : ''}`}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>
          <b>Li e concordo com o contrato</b>
          <small>Pago {brl(agora)} em até 7 dias. Se desistir até 7 dias depois de assinar, recebo tudo de volta.</small>
        </span>
      </label>
      <div className="rv-signbox">
        <p className="rv-label">Sua assinatura</p>
        <div className="rv-tabs">
          <button className={modo === 'desenho' ? 'on' : ''} onClick={() => setModo('desenho')}>
            <I n="sign" s={14} /> Desenhar
          </button>
          <button className={modo === 'digitado' ? 'on' : ''} onClick={() => setModo('digitado')}>
            <span className="rv-aa">Aa</span> Digitar o nome
          </button>
        </div>
        {modo === 'digitado' ? (
          <>
            <label className="rv-signname">
              <span>Digite o seu nome completo</span>
              <input value={nomeAss} onChange={(e) => setNomeAss(e.target.value)} placeholder={nome} autoComplete="name" />
              {nomeAss && !nomeOk && <em>Precisa ser igual ao do contrato: {nome}</em>}
            </label>
            <div className="rv-fontes" role="radiogroup" aria-label="Letra da assinatura">
              {FONTES_ASS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={fonte === f.id} className={fonte === f.id ? 'on' : ''} onClick={() => setFonte(f.id)}>
                  <span style={{ fontFamily: f.family, fontSize: `${(f.size ?? 1) * 26}px` }}>{nomeAss.trim() || nome}</span>
                </button>
              ))}
            </div>
          </>
        ) : desenho ? (
          <div className="rv-signprev">
            <svg viewBox="0 0 600 200" aria-label="Sua assinatura">
              <path d={desenho} fill="none" stroke="#012C60" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <button type="button" className="rv-link small" onClick={() => setTela(true)}>
              Assinar de novo
            </button>
          </div>
        ) : (
          <button type="button" className="rv-btn ghost wide2" onClick={() => setTela(true)}>
            <I n="edit" /> Abrir a área para assinar
          </button>
        )}
      </div>
      {tela && (
        <div className="rv-signfull" role="dialog" aria-label="Assine com o dedo">
          <div className="rv-signfull-in">
            <p>
              <b>Assine com o dedo</b>
              <small>Dica: deite o celular para ter mais espaço.</small>
            </p>
            <RvPad onChange={setDesenho} />
            <div className="rv-row">
              <button className="rv-btn ghost" onClick={() => setTela(false)}>
                Cancelar
              </button>
              <button className="rv-btn" disabled={desenho.length < 30} onClick={() => setTela(false)}>
                <I n="check" /> Pronto
              </button>
            </div>
          </div>
        </div>
      )}
      {erro && <p className="rv-warn">{erro}</p>}
      <div className="rv-row rv-signgo">
        {onVoltar && (
          <button className="rv-btn ghost" onClick={onVoltar} aria-label="Voltar">
            <I n="back" /> <span className="rv-voltar-t">Voltar</span>
          </button>
        )}
        <button className="rv-btn" disabled={!assinou || busy} onClick={() => onAssinar({ modo, desenho, fonte })}>
          <I n="sign" /> <span>{busy ? 'Enviando…' : botao}</span>
        </button>
      </div>
      {!assinou && <p className="rv-fine center">{!ok || (reforma && !okTermo) ? 'Marque as caixas acima e assine para continuar.' : 'Falta a sua assinatura.'}</p>}
      <p className="rv-fine">
        <I n="shield" s={13} /> Assinatura eletrônica com validade jurídica (MP 2.200-2/2001, art. 10, § 2º). Ficam registrados data e hora, IP, aparelho, navegador e o código do documento. Você recebe o contrato em PDF no painel e no e-mail.
      </p>
    </>
  )
}

/* ================= painel da reserva ================= */

type Etapa = 'reserva' | 'sinal' | 'data' | 'laudo'


/** Contrato assinado numa versão anterior: mostra o contrato atualizado (com a opção de incluir a ART de reforma) para assinar de novo. */
function Reassinar({ r, cfg, id, token, onFeito }: { r: Reserva; cfg: ReservaConfig; id: string; token: string; onFeito: () => void }) {
  const [abrir, setAbrir] = useState(false)
  const [reforma, setReforma] = useState(!!r.status?.reforma?.aprovadoEm)
  const [itens, setItens] = useState<string[]>(r.dados.reformaItens ?? r.status?.reforma?.itens ?? [])
  const [detalhe, setDetalhe] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const d: ReservaDados = useMemo(() => {
    const txt = reforma ? [reformaItensTexto(itens).join(', '), detalhe.trim()].filter(Boolean).join('. ') : ''
    return { ...r.dados, servicos: { vistoria: servicosDe(r.dados).vistoria, reforma }, reforma: txt, reformaItens: reforma ? itens : [], reformaEstimativa: reforma ? calcReforma(itens, servicosDe(r.dados).vistoria) : undefined }
  }, [r.dados, reforma, itens, detalhe])
  const texto = useMemo(() => contratoTexto(d, cfg), [d, cfg])
  const v = valores(d, cfg)
  const assinar = async (a: Assinatura) => {
    if (reforma && !itens.length) return setErro('Marque pelo menos um serviço da reforma.')
    setBusy(true)
    setErro('')
    const em = new Date().toISOString()
    const ap = deviceLabel()
    const codigo = await sha256([texto, r.dados.nome.trim(), r.dados.cpf.replace(/\D/g, ''), em, ap].join('|'))
    const ok = await reassinar(id, token, { servicos: d.servicos, reforma: d.reforma, reformaItens: d.reformaItens, reformaEstimativa: d.reformaEstimativa }, { texto, assinatura: r.dados.nome.trim(), desenho: a.modo === 'desenho' ? a.desenho : undefined, cpf: r.dados.cpf, em, codigo, aparelho: ap, fuso: Intl.DateTimeFormat().resolvedOptions().timeZone, versao: CONTRATO_VERSAO, email: r.dados.email, tel: r.dados.tel, fonte: a.modo === 'digitado' ? a.fonte : undefined, ua: navigator.userAgent.slice(0, 300), tela: `${screen.width}×${screen.height}`, idioma: navigator.language })
    setBusy(false)
    if (!ok) return setErro('Não consegui salvar agora. Tente de novo ou chame o Rogério no WhatsApp.')
    rastrear('reassinou', { reforma })
    if (reforma && !r.status?.reforma?.aprovadoEm) void avisarEmail('reforma-aprovada', id, token)
    onFeito()
  }
  return (
    <section className="rv-card rv-update">
      <div className="rv-now-head">
        <span className="ib">
          <I n="doc" s={20} />
        </span>
        <div>
          <small>CONTRATO ATUALIZADO</small>
          <h2>Atualizamos o seu contrato</h2>
        </div>
      </div>
      <p className="rv-hint">Melhoramos as condições e deixamos tudo mais claro (prazo do sinal, grupo de 10, revistoria e ART de reforma). Leia e assine a nova versão. Se quiser, já inclua a ART de reforma.</p>
      {!abrir ? (
        <button className="rv-btn wide3" onClick={() => setAbrir(true)}>
          <I n="sign" /> Ver e assinar o contrato atualizado
        </button>
      ) : (
        <>
          <div className={`rv-pick ${reforma ? 'on' : ''}`}>
            <button type="button" className="rv-pick-head" onClick={() => setReforma(!reforma)}>
              <span className="box">{reforma && <I n="check" s={14} />}</span>
              <span className="ib navy">
                <I n="hammer" s={18} />
              </span>
              <span className="txt">
                <b>Incluir a ART de reforma (opcional)</b>
                <small>Para o condomínio liberar a sua obra. A obra é feita pelo seu pedreiro.</small>
              </span>
              <strong>
                <em>a partir de</em>
                {brl(REFORMA_MIN)}
              </strong>
            </button>
            {reforma && (
              <div className="rv-pick-body">
                <ReformaInfo recolhido />
                <ReformaCalc itens={itens} onItens={setItens} detalhe={detalhe} onDetalhe={setDetalhe} comVistoria={servicosDe(r.dados).vistoria} />
              </div>
            )}
          </div>
          <a className="rv-pick files" href="ape/" target="_blank" rel="noreferrer">
            <span className="ib soft">
              <I n="bag" s={18} />
            </span>
            <span className="txt">
              <b>Quer também guias e planilhas para o apê?</b>
              <small>A partir de R$ 12,90 na loja da planê.apê (abre em outra aba).</small>
            </span>
            <I n="arrow" s={16} />
          </a>
          <Total v={v} sv={d.servicos!} cfg={cfg} titulo />
          <Assinar texto={texto} nome={r.dados.nome} reforma={reforma} agora={v.agora} busy={busy} erro={erro} onAssinar={(a) => void assinar(a)} botao="Assinar o contrato atualizado" />
        </>
      )}
    </section>
  )
}

function Painel({ id, token, teste }: { id: string; token: string; teste?: boolean }) {
  const [r, setR] = useState<Reserva | null | undefined>(undefined)
  const [grupo, setGrupo] = useState(0)
  const [cfg, setCfg] = useState<ReservaConfig>(CONFIG_PADRAO)
  const [copiado, setCopiado] = useState('')
  const [etapa, setEtapa] = useState<Etapa>('reserva')
  const [trocaPlanta, setTrocaPlanta] = useState(false)
  const [pedido, setPedido] = useState('')
  const [rfItens, setRfItens] = useState<string[]>([])
  const [abreRef, setAbreRef] = useState(false)
  const [termoOk, setTermoOk] = useState(false)
  const [prestador, setPrestador] = useState('')
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
        rastrear('abriu', { pagina: 'painel', origem: origem() })
        void contagem().then(setGrupo)
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
  const vv = valores({ ...r.dados, reformaEstimativa: r.dados.servicos?.reforma ? Number(rf.valor ?? r.dados.reformaEstimativa ?? REFORMA_MIN) : undefined }, cfg)
  const svr = servicosDe(r.dados)
  const metade = vv.agora
  const restante = vv.vistoria - vv.sinalVistoria
  const pix = pixCopiaECola(cfg, metade, r)
  const desatualizado = !teste && !r.cancelada && (r.contrato.versao ?? 1) < CONTRATO_VERSAO
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
  const jaPaguei = async () => {
    if (teste) {
      setR((x) => (x ? { ...x, status: { ...x.status, pagoInformado: new Date().toISOString() } } : x))
      return
    }
    setEnviando(true)
    const ok = await moradorAcao(id, token, 'pago')
    if (ok) void avisarEmail('pago', id, token)
    await recarregar()
    setEnviando(false)
    if (!ok) setMsg('Não foi. Confira a internet e tente de novo.')
  }

  const pedirReforma = async () => {
    if (!rfItens.length || enviando) return
    setEnviando(true)
    if (teste) {
      setR({ ...r, status: { ...s, reforma: { pedido: [reformaItensTexto(rfItens).join(', '), pedido.trim()].filter(Boolean).join('. '), itens: rfItens, estimativa: calcReforma(rfItens, servicosDe(r.dados).vistoria), pedidoEm: new Date().toISOString() } } })
      setEnviando(false)
      return
    }
    const txt = [reformaItensTexto(rfItens).join(', '), pedido.trim()].filter(Boolean).join('. ')
    const ok = await moradorAcao(id, token, 'reforma-pedido', { pedido: txt, itens: rfItens, estimativa: calcReforma(rfItens, servicosDe(r.dados).vistoria) })
    setEnviando(false)
    if (!ok) return setMsg('Não consegui enviar agora. Tente de novo ou chame o Rogério no WhatsApp.')
    void avisarEmail('reforma-pedido', id, token)
    setPedido('')
    void recarregar()
  }
  const aprovarReforma = async () => {
    if (enviando || !termoOk) return
    setEnviando(true)
    if (teste) {
      setR({ ...r, status: { ...s, reforma: { ...rf, aprovadoEm: new Date().toISOString(), termoAceito: new Date().toISOString(), prestador: prestador.trim() } } })
      setEnviando(false)
      return
    }
    const ok = await moradorAcao(id, token, 'reforma-aprovar', { prestador: prestador.trim(), termo: termoReformaTexto() })
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
            <a className="rv-btn small" href="#/vistoria/reservar">
              <I n="key" /> Reservar de novo
            </a>
          </>
        ),
      }
    : !s.sinal
      ? {
          icon: 'card',
          tom: 'now',
          t: `Pague ${brl(metade)} por Pix para garantir ${svr.vistoria ? 'a vaga' : 'a sua ART'}`,
          body: (
            <>
              <p className="rv-deadline">
                <I n="clock" s={15} /> <span>Até <b>{prazo.fim}</b> {prazo.faltam > 0 ? `(faltam ${prazo.faltam} ${prazo.faltam === 1 ? 'dia' : 'dias'})` : '(último dia)'}. Sem o sinal, a reserva é cancelada sozinha.</span>
              </p>
              {cfg.pix ? (
                <div className="rv-pix">
                  <dl className="rv-pix-conta">
                    <div>
                      <dt>Chave Pix (aleatória)</dt>
                      <dd className="k">{cfg.pix}</dd>
                    </div>
                    <div>
                      <dt>Nome</dt>
                      <dd>{cfg.pixNome}</dd>
                    </div>
                    <div>
                      <dt>Banco</dt>
                      <dd>{cfg.pixBanco}</dd>
                    </div>
                    <div>
                      <dt>Valor</dt>
                      <dd>{brl(metade)}</dd>
                    </div>
                  </dl>
                  {pix && (
                    <button className="rv-btn small wide2" onClick={() => void copiar(pix, 'pix')}>
                      <I n="copy" /> <span>{copiado === 'pix' ? 'Copiado! Cole no app do banco' : 'Copiar Pix copia e cola'}</span>
                    </button>
                  )}
                  <button className="rv-link small rv-center" onClick={() => void copiar(cfg.pix, 'chave')}>
                    {copiado === 'chave' ? 'Chave copiada!' : 'ou copiar só a chave'}
                  </button>
                  <small className="rv-tip">
                    No app do banco: Pix → Pix copia e cola → cole. Já vem com o valor e o nome.
                  </small>
                </div>
              ) : (
                <p className="rv-alert">
                  <I n="info" s={15} /> <span>A chave Pix aparece aqui em instantes. Se preferir, peça pelo WhatsApp.</span>
                </p>
              )}
              {s.pagoInformado ? (
                <p className="rv-alert ok">
                  <I n="check" s={15} /> <span>Você marcou como pago em {dataCurta(s.pagoInformado.slice(0, 10))}. O Rogério confere no banco e confirma aqui (em até 1 dia útil).</span>
                </p>
              ) : null}
              {s.pagoInformado ? (
                <a className="rv-btn small wide2 ghost" href={zap(`Oi, Rogério! Fiz o Pix de ${brl(metade)} do sinal da vistoria do ${unidade(r.dados)} (${r.dados.nome}). Segue o comprovante:`)} target="_blank" rel="noreferrer">
                  <I n="whatsapp" /> <span>Enviar o comprovante pelo WhatsApp</span>
                </a>
              ) : (
                <button className="rv-btn small wide2" disabled={enviando} onClick={() => void jaPaguei()}>
                  <I n="check" /> <span>{enviando ? 'Enviando…' : 'Já paguei'}</span>
                </button>
              )}
              {!cfg.pix && (
                <a className="rv-link small rv-center" href={zap(`Oi, Rogério! Pode me mandar a chave Pix do sinal da vistoria do ${unidade(r.dados)} (${r.dados.nome})?`)}>
                  Pedir a chave pelo WhatsApp
                </a>
              )}
            </>
          ),
        }
      : !svr.vistoria
        ? rf.art
          ? {
              icon: 'doc',
              tom: 'ok',
              t: 'Sua ART de reforma está pronta',
              body: (
                <>
                  <p>Entregue a ART e o plano de reforma ao síndico e passe o plano para o seu prestador antes de começar a obra.</p>
                  <a className="rv-btn small" href={rf.art} target="_blank" rel="noreferrer">
                    <I n="doc" /> Abrir a ART
                  </a>
                </>
              ),
            }
          : {
              icon: 'check',
              tom: 'ok',
              t: 'Pagamento recebido! Agora mande as informações da obra',
              body: (
                <>
                  <ul className="rv-list">
                    <li>
                      <I n="list" s={15} /> <span>O que vai ser feito, cômodo por cômodo</span>
                    </li>
                    <li>
                      <I n="user" s={15} /> <span>Quem vai executar (nome e telefone do prestador)</span>
                    </li>
                    <li>
                      <I n="cal" s={15} /> <span>Quando a obra deve começar e terminar</span>
                    </li>
                    <li>
                      <I n="doc" s={15} /> <span>As regras de obra do condomínio, se tiver</span>
                    </li>
                  </ul>
                  <a className="rv-btn small" href={zap(`Oi, Rogério! Seguem as informações da reforma do ${unidade(r.dados)}:`)}>
                    <I n="chat" /> Mandar no WhatsApp
                  </a>
                  <p className="rv-fine">A ART e o plano ficam prontos em até 5 dias úteis depois disso.</p>
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
                    <I n="drop" s={15} /> <span>A MRV precisa deixar <b>água e luz ligadas</b></span>
                  </li>
                  <li>
                    <I n="user" s={15} /> <span>Você ou alguém de confiança <b>acompanha</b> a vistoria</span>
                  </li>
                  <li>
                    <I n="card" s={15} /> <span>Restante de <b>{brl(restante)}</b> no dia{grupo < cfg.minimo ? ` (ou ${brl(restante + cfg.individual - cfg.preco)}, se o grupo não fechar)` : ''}, por Pix</span>
                  </li>
                  <li>
                    <I n="clock" s={15} /> <span>Leva até 2 horas</span>
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

  const passos: [string, boolean][] = svr.vistoria
    ? [
        ['Reserva', true],
        ['Sinal', !!s.sinal],
        ['Data', !!s.data],
        ['Vistoria', !!s.quitado || !!s.laudo],
        ['Laudo', !!s.laudo],
      ]
    : [
        ['Contrato', true],
        ['Pagamento', !!s.sinal],
        ['Informações', !!rf.art],
        ['ART pronta', !!rf.art],
      ]
  const docs: { icon: string; t: string; ok: boolean; sub: string; act?: () => void; href?: string }[] = [
    { icon: 'sign', t: 'Contrato', ok: true, sub: 'Assinado por você e pela RDL', act: () => void abrirContratoPdf(r) },
    ...(svr.vistoria
      ? [
          { icon: 'shield', t: 'ART da vistoria', ok: !!s.art, sub: s.art ? 'Registrada no CREA' : 'Aparece aqui depois da vistoria', href: s.art },
          { icon: 'doc', t: 'Laudo técnico', ok: !!s.laudo, sub: s.laudo ? 'Com fotos e itens para a MRV' : 'Até 4 dias úteis após a vistoria', href: s.laudo },
        ]
      : []),
    ...(rf.aprovadoEm ? [{ icon: 'hammer', t: 'ART de reforma', ok: !!rf.art, sub: rf.art ? 'Registrada no CREA' : 'Pronta em até 5 dias úteis depois das informações da obra', href: rf.art }] : []),
    ...(rf.aprovadoEm ? [{ icon: 'plan', t: 'Plano de reforma', ok: !!rf.art, sub: rf.art ? 'Para entregar ao síndico' : 'Vem junto com a ART', href: rf.art }] : []),
  ]

  return (
    <>
      <Topo voltar={{ label: 'Início', acao: () => irInicio(teste) }} />
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

        {desatualizado && <Reassinar r={r} cfg={cfg} id={id} token={token} onFeito={() => void recarregar()} />}
        <div className="rv-dash">
          <div className="rv-col">
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

        {!r.cancelada && (
          <section className="rv-card">
            <h2 className="rv-h2">
              <I n="hammer" s={18} /> ART de reforma <span className="rv-opt">OPCIONAL</span>
            </h2>
            {rf.canceladaEm && !rf.aprovadoEm && !rf.valor && (
              <div className="rv-state">
                <I n="info" s={16} />
                <span>
                  <b>ART de reforma cancelada</b>O valor saiu do total. Se precisar, é só pedir de novo aqui embaixo.
                </span>
              </div>
            )}
            {rf.aprovadoEm ? (
              <div className="rv-state ok">
                <I n="check" s={16} />
                <span>
                  <b>ART de reforma contratada ({brl(Number(rf.valor ?? 0))})</b>O Rogério confere os serviços que você informou e fala com você para receber as informações da obra. Se algum serviço não puder entrar na ART, ela pode ser ajustada ou cancelada, e o valor sai do total. Lembre de passar o plano de reforma e as regras para {rf.prestador ? rf.prestador : 'o seu prestador'} antes de começar.
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
                <div className="rv-termo">
                  <b>
                    <I n="shield" s={15} /> Antes de aprovar
                  </b>
                  <p className="rv-termo-res">O Rogério faz o plano e assina a ART, mas não executa a obra. A ART cobre só o que você informou. A obra, os materiais e a segurança ficam com você e com o seu prestador.</p>
                  <details>
                    <summary>Ler as regras completas ({TERMO_REFORMA.length})</summary>
                    <ol>
                      {TERMO_REFORMA.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ol>
                  </details>
                  <a className="rv-btn small ghost" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Regras da reforma do meu apê no San Levi (para a gente alinhar antes de começar):\n\n${termoReformaTexto()}\n\nO plano de reforma vai seguir junto.`)}`} target="_blank" rel="noreferrer">
                    <I n="chat" /> Mandar estas regras para o meu prestador
                  </a>
                </div>
                <label className="rv-area">
                  <span>Quem vai fazer a obra? (pode informar depois)</span>
                  <input value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Nome do pedreiro ou da empresa e telefone" />
                </label>
                <label className={`rv-check ${termoOk ? 'on' : ''}`}>
                  <input type="checkbox" checked={termoOk} onChange={(e) => setTermoOk(e.target.checked)} />
                  <span>
                    <b>Li, concordo e vou alinhar tudo com o meu prestador</b>
                    <small>O Rogério é o responsável técnico (ART e plano). A obra, os materiais e a segurança são do meu prestador e meus.</small>
                  </span>
                </label>
                <button className="rv-btn" disabled={enviando || !termoOk} onClick={() => void aprovarReforma()}>
                  <I n="check" /> Aprovar orçamento
                </button>
                <p className="rv-fine">Ao aprovar, você contrata a ART de reforma nessas condições (cláusulas 10.2 e 10.3 do contrato). O termo fica guardado com data e hora. Dúvidas? Chame o Rogério antes.</p>
              </div>
            ) : rf.pedido ? (
              <div className="rv-state">
                <I n="clock" s={16} />
                <span>
                  <b>Pedido enviado{rf.estimativa ? `: ${brl(Number(rf.estimativa))} estimado` : ''}</b>“{rf.pedido}”. O Rogério confere e o valor confirmado aparece aqui (e no seu e-mail).
                </span>
              </div>
            ) : (
              <>
                {!abreRef ? (
                  <>
                    <p className="rv-hint">Vai fazer obra? O condomínio exige ART e plano de reforma. A partir de {brl(servicosDe(r.dados).vistoria ? REFORMA_MIN - REFORMA_DESC_VISTORIA : REFORMA_MIN)}{servicosDe(r.dados).vistoria ? ', já com o desconto de quem fechou a vistoria' : ''}.</p>
                    <button className="rv-btn ghost wide3" onClick={() => setAbreRef(true)}>
                      <I n="hammer" /> Quero a ART de reforma
                    </button>
                  </>
                ) : (
                  <>
                    <ReformaInfo recolhido />
                    <p className="rv-alert">
                      <I n="info" s={15} /> <span>No San Levi as paredes são de concreto e <b>estruturais</b>: não dá para derrubar nem rasgar parede para passar cano ou fio.</span>
                    </p>
                    <ReformaCalc itens={rfItens} onItens={setRfItens} detalhe={pedido} onDetalhe={setPedido} comVistoria={servicosDe(r.dados).vistoria} />
                    <button className="rv-btn wide3" disabled={!rfItens.length || enviando} onClick={() => void pedirReforma()}>
                      <I n="arrow" /> <span>Pedir por {brl(calcReforma(rfItens, servicosDe(r.dados).vistoria))}</span>
                    </button>
                  </>
                )}
              </>
            )}
            {msg && <p className="rv-warn">{msg}</p>}
          </section>
        )}

          </div>
          <div className="rv-col">
        {!r.cancelada && svr.vistoria && !s.data && <Grupo n={grupo} cfg={cfg} compact />}

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

        {r.dados.revistoria && svr.vistoria && !r.cancelada && (
          <section className="rv-card">
            <h2 className="rv-h2">
              <I n="redo" s={18} /> Revistoria combinada
            </h2>
            <p className="rv-hint">{s.revistoriaData ? `Marcada para ${dataCurta(s.revistoriaData)}.` : 'Depois que a MRV consertar o que estiver no laudo (em até 90 dias), o engenheiro volta para conferir.'} Valor: {brl(cfg.revistoria)}, pago no dia.</p>
          </section>
        )}

        {(s.sinal || s.cortesia) && !r.cancelada && <CupomLoja id={r.id} />}
        {(s.sinal || s.cortesia) && !r.cancelada && <CupomFlutuante id={r.id} />}
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
          <p className="rv-fine">Guarde este link: é o seu acesso a tudo. Reserva nº {r.id.slice(0, 8).toUpperCase()}.</p>
        </section>
        {!(s.sinal || s.cortesia) && <Loja />}

          </div>
        </div>
      </main>
      <Rodape />
      <Duvidas teste={teste} nome={r.dados.nome} contato={r.dados.email || r.dados.tel} reserva={teste ? undefined : { id, token }} />
    </>
  )
}
