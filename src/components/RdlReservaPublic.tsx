import { useEffect, useMemo, useState } from 'react'
import './rdlReserva.css'
import { RDL_LOGO } from '../rdlLogo'
import { VISTORIA_PROPOSTA_URL } from '../contractTemplates'
import { formatCep, formatDoc, formatPhone, lookupCep, whatsappLink } from '../utils'
import { deviceLabel } from '../contractSign'
import { SignaturePad, drawingToDataUrl } from './SignaturePad'
import {
  CONFIG_PADRAO,
  RDL_INFO,
  abrirContrato,
  contagem,
  contratoTexto,
  dataCurta,
  lerConfig,
  minhaReserva,
  pixCopiaECola,
  reservar,
  avisarEmail,
  sha256,
  unidade,
  enderecoCompleto,
  validCpf,
  type Reserva,
  type ReservaConfig,
  type ReservaDados,
} from '../rdlReserva'

/* Página pública da reserva da vistoria (useplane.com.br/vistoria), na identidade da RDL.
   Sem id: o morador preenche os dados, lê o contrato com os dados dele e assina.
   Com id (#/vistoria/<id>.<código>): o painel da reserva dele. */

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
  building: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-5h4v5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
}
const I = ({ n, s = 16 }: { n: string; s?: number }) => <svg className="rv-i" width={s} height={s} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: P[n] ?? P.doc }} />
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: n % 1 ? 2 : 0 })
const SALVO = 'rdl-minha-reserva'

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
          {RDL_INFO.company} · CNPJ {RDL_INFO.cnpj}
        </span>
      </div>
      <div className="r">
        <a href={whatsappLink(RDL_INFO.whatsapp)}>{RDL_INFO.phone}</a>
        <span>{RDL_INFO.email}</span>
      </div>
    </footer>
  )
}

export function RdlReservaPublic({ sub }: { sub?: string }) {
  useEffect(() => {
    document.title = 'Vistoria de entrega de chaves · RDL Engenharia'
    document.documentElement.classList.add('rv-root')
    return () => document.documentElement.classList.remove('rv-root')
  }, [])
  const [id, token] = (sub ?? '').split('.')
  return <div className="rv">{id && token ? <Painel id={id} token={token} /> : <Reservar />}</div>
}

/* ================= reserva ================= */

const vazio: ReservaDados = { nome: '', cpf: '', email: '', tel: '', endereco: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', torre: '', apto: '', revistoria: false }

function Reservar() {
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
  const [tried, setTried] = useState(false)
  const [ok, setOk] = useState(false)
  const [nomeAss, setNomeAss] = useState('')
  const [desenho, setDesenho] = useState('')
  const [modo, setModo] = useState<'digitado' | 'desenho'>('digitado')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const salvo = useMemo(() => {
    try {
      return localStorage.getItem(SALVO) || ''
    } catch {
      return ''
    }
  }, [])
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
  }
  const okDados = !Object.values(faltando).some(Boolean)
  const dc = useMemo(() => ({ ...d, endereco: enderecoCompleto(d) }), [d])
  const texto = useMemo(() => contratoTexto(dc, cfg), [dc, cfg])
  const [cepMsg, setCepMsg] = useState('')
  const buscarCep = async (v: string) => {
    set('cep', formatCep(v))
    if (v.replace(/\D/g, '').length !== 8) return setCepMsg('')
    setCepMsg('buscando…')
    const a = await lookupCep(v)
    if (!a) return setCepMsg('CEP não encontrado. Preencha o endereço abaixo.')
    setCepMsg('')
    setD((x) => ({ ...x, rua: a.street || x.rua, bairro: a.district || x.bairro, cidade: a.city, uf: a.uf }))
    setTimeout(() => document.getElementById('rv-numero')?.focus(), 50)
  }
  const metade = cfg.preco / 2
  const assinou = ok && (modo === 'digitado' ? nomeAss.trim().toLowerCase() === d.nome.trim().toLowerCase() : desenho.length > 30)

  const enviar = async () => {
    if (!assinou || busy) return
    setBusy(true)
    setErro('')
    try {
      const em = new Date().toISOString()
      const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone
      const aparelho = deviceLabel()
      const codigo = await sha256([texto, d.nome.trim(), d.cpf.replace(/\D/g, ''), em, aparelho].join('|'))
      const r = await reservar({ ...dc, nome: d.nome.trim(), email: d.email.trim().toLowerCase() }, { texto, assinatura: d.nome.trim(), desenho: modo === 'desenho' ? desenho : undefined, cpf: d.cpf, em, codigo, aparelho, fuso })
      void avisarEmail('reserva', r.id, r.token)
      const link = `#/vistoria/${r.id}.${r.token}`
      try {
        localStorage.setItem(SALVO, link)
        sessionStorage.removeItem('rdl-reserva-rascunho')
      } catch {
        /* ok */
      }
      location.hash = link
      window.scrollTo(0, 0)
    } catch {
      setErro('Não consegui enviar agora. Confira a internet e tente de novo; se continuar, chame o Rogério no WhatsApp.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Topo />
      <main className="rv-main">
        <section className="rv-hero">
          <span className="rv-pill">
            <i /> CONDIÇÃO DE GRUPO · {cfg.empreendimento.replace(/\s*\(.*\)/, '').toUpperCase()}
          </span>
          <h1>
            Reserve a <span>vistoria</span> do seu apê
          </h1>
          <p>Vistoria de entrega de chaves com engenheiro civil, laudo com fotos e ART. Preencha os dados, assine o contrato aqui mesmo e a sua vaga fica reservada.</p>
        </section>

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
            <span>por apartamento · sinal de {brl(metade)} na reserva</span>
          </div>
          <ul>
            <li>
              <I n="cal" /> Previsão da MRV: {cfg.periodo}
            </li>
            <li>
              <I n="user" /> {n > 0 ? `${n} apartamento${n > 1 ? 's' : ''} já ${n > 1 ? 'reservaram' : 'reservou'}` : 'Seja o primeiro a reservar'}
            </li>
            <li>
              <I n="redo" /> Revistoria opcional: {brl(cfg.revistoria)}
            </li>
          </ul>
        </section>

        {salvo && (
          <a className="rv-saved" href={salvo}>
            <I n="check" /> Você já tem uma reserva neste aparelho. <b>Abrir o meu painel</b> <I n="arrow" />
          </a>
        )}

        <section className="rv-io">
          <div className="rv-card yes">
            <h3>
              <span className="ic">
                <I n="check" s={13} />
              </span>
              Está incluso
            </h3>
            {[
              ['search', 'Vistoria presencial com engenheiro civil'],
              ['shield', 'ART da vistoria registrada no CREA'],
              ['doc', 'Laudo técnico com fotos, em até 4 dias úteis'],
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
            {['Reparos (ficam por conta da MRV)', 'Áreas comuns do condomínio', 'Abertura de paredes, pisos ou forros', 'ART de obra ou reforma'].map((t) => (
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

        {!cfg.aberta ? (
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
                <b>2</b> Contrato e assinatura
              </li>
            </ol>

            {step === 1 ? (
              <>
                <div className="rv-grid">
                  <label className={`span2 ${tried && faltando.nome ? 'bad' : ''}`}>
                    <span>Nome completo (de quem compra o apê)</span>
                    <input value={d.nome} onChange={(e) => set('nome', e.target.value)} autoComplete="name" placeholder="Nome e sobrenome" />
                  </label>
                  <label className={tried && faltando.cpf ? 'bad' : ''}>
                    <span>CPF</span>
                    <input value={d.cpf} onChange={(e) => set('cpf', formatDoc(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
                    {tried && faltando.cpf && d.cpf && <em>Confira o CPF</em>}
                  </label>
                  <label className={tried && faltando.tel ? 'bad' : ''}>
                    <span>WhatsApp</span>
                    <input value={d.tel} onChange={(e) => set('tel', formatPhone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(11) 9 0000-0000" />
                  </label>
                  <label className={`span2 ${tried && faltando.email ? 'bad' : ''}`}>
                    <span>E-mail (o laudo também vai por aqui)</span>
                    <input value={d.email} onChange={(e) => set('email', e.target.value)} inputMode="email" autoComplete="email" placeholder="voce@email.com" />
                  </label>
                  <div className="span2 rv-sub">Endereço onde você mora hoje</div>
                  <label className={tried && faltando.cep ? 'bad' : ''}>
                    <span>CEP</span>
                    <input value={d.cep} onChange={(e) => void buscarCep(e.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" />
                    {cepMsg && <em>{cepMsg}</em>}
                  </label>
                  <label className={tried && faltando.numero ? 'bad' : ''}>
                    <span>Número</span>
                    <input id="rv-numero" value={d.numero} onChange={(e) => set('numero', e.target.value)} inputMode="numeric" placeholder="Ex.: 120" />
                  </label>
                  <label className={`span2 ${tried && faltando.rua ? 'bad' : ''}`}>
                    <span>Rua</span>
                    <input value={d.rua} onChange={(e) => set('rua', e.target.value)} autoComplete="address-line1" placeholder="Preenche sozinho pelo CEP" />
                  </label>
                  <label>
                    <span>Complemento (opcional)</span>
                    <input value={d.complemento} onChange={(e) => set('complemento', e.target.value)} placeholder="Apto, bloco, casa" />
                  </label>
                  <label className={tried && faltando.bairro ? 'bad' : ''}>
                    <span>Bairro</span>
                    <input value={d.bairro} onChange={(e) => set('bairro', e.target.value)} />
                  </label>
                  <label className={tried && faltando.cidade ? 'bad' : ''}>
                    <span>Cidade</span>
                    <input value={d.cidade} onChange={(e) => set('cidade', e.target.value)} />
                  </label>
                  <label className={tried && faltando.cidade ? 'bad' : ''}>
                    <span>Estado (UF)</span>
                    <input value={d.uf} onChange={(e) => set('uf', e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" />
                  </label>
                  <div className="span2 rv-sub">Seu apartamento no San Levi</div>
                  <label className={tried && faltando.torre ? 'bad' : ''}>
                    <span>Torre</span>
                    <input value={d.torre} onChange={(e) => set('torre', e.target.value)} placeholder="Ex.: 2" />
                  </label>
                  <label className={tried && faltando.apto ? 'bad' : ''}>
                    <span>Apartamento</span>
                    <input value={d.apto} onChange={(e) => set('apto', e.target.value)} inputMode="numeric" placeholder="Ex.: 1204" />
                  </label>
                </div>
                <label className={`rv-check ${d.revistoria ? 'on' : ''}`}>
                  <input type="checkbox" checked={d.revistoria} onChange={(e) => set('revistoria', e.target.checked)} />
                  <span>
                    <b>Quero deixar a revistoria combinada</b>
                    <small>Nova visita para conferir os reparos da MRV, em até 90 dias. {brl(cfg.revistoria)}, pago só no dia. Dá para decidir depois também.</small>
                  </span>
                </label>
                {tried && !okDados && <p className="rv-warn">Falta preencher ou conferir os campos marcados.</p>}
                <button
                  className="rv-btn"
                  onClick={() => {
                    setTried(true)
                    if (!okDados) return
                    setNomeAss('')
                    setStep(2)
                    document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  Continuar para o contrato <I n="arrow" />
                </button>
              </>
            ) : (
              <>
                <div className="rv-sum">
                  <div>
                    <small>CONTRATANTE</small>
                    <b>{d.nome}</b>
                  </div>
                  <div>
                    <small>UNIDADE</small>
                    <b>{unidade(d)}</b>
                  </div>
                  <div>
                    <small>VALOR</small>
                    <b>{brl(cfg.preco)}</b>
                  </div>
                  <div>
                    <small>SINAL</small>
                    <b>{brl(metade)}</b>
                  </div>
                </div>
                <p className="rv-hint">Leia o contrato com calma. Ele já está com os seus dados.</p>
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
                    <small>Inclusive com o sinal de {brl(metade)}, pago em até 3 dias, que garante a vaga e não é devolvido depois de 7 dias da assinatura.</small>
                  </span>
                </label>
                <div className="rv-signbox">
                  <div className="rv-tabs">
                    <button className={modo === 'digitado' ? 'on' : ''} onClick={() => setModo('digitado')}>
                      Digitar o nome
                    </button>
                    <button className={modo === 'desenho' ? 'on' : ''} onClick={() => setModo('desenho')}>
                      Assinar com o dedo
                    </button>
                  </div>
                  {modo === 'digitado' ? (
                    <label>
                      <span>Para assinar, digite o seu nome completo igual ao de cima</span>
                      <input value={nomeAss} onChange={(e) => setNomeAss(e.target.value)} placeholder={d.nome} />
                      {nomeAss && nomeAss.trim().toLowerCase() !== d.nome.trim().toLowerCase() && <em>O nome precisa ser igual: {d.nome}</em>}
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
                <p className="rv-fine">Assinatura eletrônica com registro de data, hora, aparelho e código do documento (MP 2.200-2/2001, art. 10, § 2º). Uma cópia fica no seu painel.</p>
              </>
            )}
          </section>
        )}
      </main>
      <Rodape />
    </>
  )
}

/* ================= painel da reserva ================= */

function Painel({ id, token }: { id: string; token: string }) {
  const [r, setR] = useState<Reserva | null | undefined>(undefined)
  const [cfg, setCfg] = useState<ReservaConfig>(CONFIG_PADRAO)
  const [copiado, setCopiado] = useState('')
  useEffect(() => {
    void lerConfig().then(setCfg)
    void minhaReserva(id, token).then((x) => {
      setR(x)
      if (x)
        try {
          localStorage.setItem(SALVO, `#/vistoria/${id}.${token}`)
        } catch {
          /* ok */
        }
    })
  }, [id, token])
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
  const metade = cfg.preco / 2
  const pix = pixCopiaECola(cfg, metade, r)
  const copiar = (t: string, k: string) =>
    navigator.clipboard
      ?.writeText(t)
      .then(() => {
        setCopiado(k)
        setTimeout(() => setCopiado(''), 2000)
      })
      .catch(() => undefined)
  const zap = (t: string) => whatsappLink(RDL_INFO.whatsapp, t)
  const etapas: { k: string; icon: string; t: string; done: boolean; now?: boolean; body: React.ReactNode }[] = [
    {
      k: 'reserva',
      icon: 'sign',
      t: 'Reserva e contrato assinado',
      done: true,
      body: (
        <>
          <p>
            Assinado em {new Date(r.contrato.em).toLocaleDateString('pt-BR')}. Reserva nº {r.id.slice(0, 8).toUpperCase()}
            {r.ordem ? ` · ${r.ordem}ª reserva` : ''}.
          </p>
          <button className="rv-btn small ghost" onClick={() => abrirContrato(r, r.contrato.desenho ? drawingToDataUrl(r.contrato.desenho) : undefined, false)}>
            <I n="doc" /> Ver o contrato
          </button>
        </>
      ),
    },
    {
      k: 'sinal',
      icon: 'card',
      t: s.sinal ? 'Sinal recebido: vaga garantida' : `Sinal de ${brl(metade)}`,
      done: !!s.sinal,
      now: !s.sinal,
      body: s.sinal ? (
        <p>Recebido em {dataCurta(s.sinal)}. A sua vaga na agenda está garantida.</p>
      ) : (
        <>
          <p>É o que garante a sua vaga. As vagas seguem a ordem de pagamento do sinal.</p>
          {cfg.pix ? (
            <div className="rv-pix">
              <small>CHAVE PIX · {cfg.pixNome}</small>
              <b>{cfg.pix}</b>
              <div className="rv-row">
                <button className="rv-btn small" onClick={() => void copiar(cfg.pix, 'chave')}>
                  <I n="copy" /> {copiado === 'chave' ? 'Copiado' : 'Copiar chave'}
                </button>
                {pix && (
                  <button className="rv-btn small ghost" onClick={() => void copiar(pix, 'pix')}>
                    <I n="copy" /> {copiado === 'pix' ? 'Copiado' : `Pix copia e cola (${brl(metade)})`}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p>A chave Pix vai pelo WhatsApp do Rogério.</p>
          )}
          <a className="rv-btn small" href={zap(`Oi, Rogério! Segue o comprovante do sinal da vistoria do ${unidade(r.dados)} (${r.dados.nome}).`)}>
            <I n="chat" /> {cfg.pix ? 'Enviar o comprovante' : 'Pedir a chave Pix'}
          </a>
        </>
      ),
    },
    {
      k: 'data',
      icon: 'cal',
      t: s.data ? `Vistoria em ${dataCurta(s.data)}${s.hora ? ` às ${s.hora}` : ''}` : 'Data da vistoria',
      done: !!s.data,
      now: !!s.sinal && !s.data,
      body: s.data ? (
        <p>Leve água e luz ligadas pela MRV e acompanhe a vistoria (ou mande alguém de confiança). O restante, {brl(cfg.preco - metade)}, é pago no dia, por Pix ou cartão.</p>
      ) : (
        <p>
          A MRV ainda não liberou as datas. A previsão é <b>{cfg.periodo}</b>. Quando ela liberar, avise o Rogério antes de confirmar o horário com a MRV, para combinarem juntos.
        </p>
      ),
    },
    {
      k: 'laudo',
      icon: 'doc',
      t: s.laudo ? 'Laudo e ART prontos' : 'Laudo e ART',
      done: !!s.laudo,
      body: s.laudo ? (
        <>
          <p>É só encaminhar para a MRV pelo atendimento deles e guardar o protocolo.</p>
          <a className="rv-btn small" href={s.laudo} target="_blank" rel="noreferrer">
            <I n="doc" /> Abrir o laudo
          </a>
        </>
      ) : (
        <p>Em até 4 dias úteis depois da vistoria e da quitação, por aqui, por WhatsApp e por e-mail.</p>
      ),
    },
    ...(r.dados.revistoria
      ? [
          {
            k: 'revistoria',
            icon: 'redo',
            t: s.revistoriaData ? `Revistoria em ${dataCurta(s.revistoriaData)}` : 'Revistoria combinada',
            done: !!s.revistoriaData,
            body: <p>Depois dos reparos da MRV, em até 90 dias da vistoria. {brl(cfg.revistoria)}, pago no dia.</p>,
          },
        ]
      : []),
  ]
  return (
    <>
      <Topo />
      <main className="rv-main">
        <section className="rv-hero">
          <span className="rv-pill">
            <i /> PAINEL DA SUA VISTORIA
          </span>
          <h1>
            Olá, <span>{r.dados.nome.split(' ')[0]}</span>
          </h1>
          <p>
            {cfg.empreendimento} · {unidade(r.dados)}
          </p>
        </section>
        {r.cancelada ? (
          <section className="rv-card rv-closed">
            <h2>Reserva cancelada</h2>
            <p>Se tiver alguma dúvida, fale com o Rogério.</p>
          </section>
        ) : (
          <ol className="rv-time">
            {etapas.map((e) => (
              <li key={e.k} className={`${e.done ? 'done' : ''} ${e.now ? 'now' : ''}`}>
                <span className="dot">{e.done ? <I n="check" s={14} /> : <I n={e.icon} s={14} />}</span>
                <div className="rv-card">
                  <h3>{e.t}</h3>
                  {e.body}
                </div>
              </li>
            ))}
          </ol>
        )}
        <a className="rv-btn wide" href={zap(`Oi, Rogério! Sou ${r.dados.nome}, da vistoria do ${unidade(r.dados)}.`)}>
          <I n="chat" /> Falar com o Rogério
        </a>
        <p className="rv-fine center">Guarde este link: é o seu acesso ao contrato, à data e ao laudo da vistoria.</p>
      </main>
      <Rodape />
    </>
  )
}
