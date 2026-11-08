import { useEffect, useState, type FormEvent } from 'react'
import { href } from '../router'
import { contaApi, guardarSessao, sessaoLocal, apeCloud, type MinhaConta } from './api'
import { ApeArt } from './ApeArt'
import { ApeIcon } from './ApeIcon'
import { APE, brl, dmy, firstName, fmtTel, wa } from './model'
import { emailOk } from './shared'

/* Minha conta (quem comprou na loja): entra com e-mail e senha e encontra as compras, os arquivos,
   a plataforma do apê, o bônus, o perfil e o espaço para sugestões e depoimentos. */

type Modo = 'entrar' | 'primeiro' | 'esqueci' | 'codigo' | 'criar'
type Aba = 'compras' | 'plataforma' | 'perfil' | 'opiniao'

export function Conta({ sub, whats }: { sub?: string; whats: string }) {
  // conta:criar:<token do pedido>:<e-mail> vem da página do pedido
  const partes = (sub || '').split(':')
  const [sessao, setSessao] = useState(sessaoLocal())
  const [conta, setConta] = useState<MinhaConta | null>(null)
  const [erro, setErro] = useState('')
  const carregar = async () => {
    if (!sessao) return
    try {
      setConta(await contaApi<MinhaConta>('eu'))
    } catch (e) {
      setErro(String((e as Error).message))
      if (/entre de novo/i.test(String((e as Error).message))) sair()
    }
  }
  useEffect(() => {
    void carregar()
  }, [sessao])
  const entrou = (t: string) => {
    guardarSessao(t)
    setSessao(t)
  }
  const sair = () => {
    void contaApi('sair').catch(() => null)
    guardarSessao('')
    setSessao('')
    setConta(null)
  }
  if (!sessao || !apeCloud) return <Entrar inicial={partes[1] === 'criar' ? 'criar' : 'entrar'} pedido={partes[2]} emailInicial={partes[3] ? decodeURIComponent(partes[3]) : ''} onEntrou={entrou} />
  if (!conta)
    return (
      <section className="ape-panel ape-empty">
        {erro ? <><b>não deu para abrir</b><span>{erro}</span><button className="ape-btn" onClick={sair}>entrar de novo</button></> : <span className="ape-thinking"><span className="ape-dots"><i /><i /><i /></span>abrindo a sua conta…</span>}
      </section>
    )
  return <Area conta={conta} whats={whats} onSair={sair} onMudou={carregar} />
}

function Entrar({ inicial, pedido, emailInicial, onEntrou }: { inicial: Modo; pedido?: string; emailInicial: string; onEntrou: (t: string) => void }) {
  const [modo, setModo] = useState<Modo>(inicial)
  const [email, setEmail] = useState(emailInicial)
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    if (!emailOk(email)) return setMsg('Confira o e-mail.')
    setBusy(true)
    try {
      if (modo === 'entrar') onEntrou((await contaApi<{ token: string }>('entrar', { email, senha })).token)
      else if (modo === 'criar') onEntrou((await contaApi<{ token: string }>('criar', { email, senha, pedido })).token)
      else if (modo === 'primeiro' || modo === 'esqueci') {
        const r = await contaApi<{ enviado?: boolean }>(modo, { email })
        setModo('codigo')
        setMsg(r.enviado === false ? 'Não conseguimos mandar o e-mail agora. Fale no WhatsApp.' : 'Se esse e-mail tiver compras, enviamos um código de 6 números. Confira também o spam.')
      } else if (modo === 'codigo') onEntrou((await contaApi<{ token: string }>('redefinir', { email, codigo, senha })).token)
    } catch (x) {
      setMsg(String((x as Error).message))
    }
    setBusy(false)
  }
  const titulo = { entrar: 'entrar', criar: 'crie sua senha', primeiro: 'primeiro acesso', esqueci: 'esqueci a senha', codigo: 'digite o código' }[modo]
  return (
    <section className="ape-conta-login">
      <form className="ape-panel ape-form" onSubmit={enviar} noValidate>
        <ApeArt name="celular" size={48} />
        <div>
          <p className="ape-eyebrow">minha conta</p>
          <h2 className="ape-h2">{titulo}</h2>
          <p className="ape-note" style={{ margin: '4px 0 0' }}>{modo === 'entrar' ? 'Seus arquivos, a plataforma do apê e o bônus, em qualquer aparelho.' : modo === 'criar' ? 'Use o e-mail da compra e uma senha com pelo menos 8 caracteres.' : modo === 'codigo' ? 'Digite o código que chegou no seu e-mail e escolha a senha.' : 'Digite o e-mail usado na compra: mandamos um código para você criar a senha.'}</p>
        </div>
        <div className="ape-f"><label htmlFor="c-email">E-mail da compra</label><input id="c-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={modo === 'codigo'} /></div>
        {modo === 'codigo' && <div className="ape-f"><label htmlFor="c-cod">Código de 6 números</label><input id="c-cod" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>}
        {(modo === 'entrar' || modo === 'criar' || modo === 'codigo') && (
          <div className="ape-f"><label htmlFor="c-senha">{modo === 'entrar' ? 'Senha' : 'Nova senha (8 ou mais caracteres)'}</label><input id="c-senha" type="password" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        )}
        {msg && <p className={/enviamos|código/i.test(msg) && !/não confere|vencido/i.test(msg) ? 'ape-note' : 'ape-err'} role="status">{msg}</p>}
        <button className="ape-btn primary" type="submit" disabled={busy}>{busy ? 'aguarde…' : modo === 'entrar' ? 'entrar' : modo === 'codigo' || modo === 'criar' ? 'salvar e entrar' : 'mandar código'}</button>
        <div className="ape-conta-links">
          {modo !== 'entrar' && <button type="button" className="ape-linkish ape-link" onClick={() => { setModo('entrar'); setMsg('') }}>já tenho senha</button>}
          {modo === 'entrar' && <button type="button" className="ape-linkish ape-link" onClick={() => { setModo('primeiro'); setMsg('') }}>primeiro acesso</button>}
          {modo === 'entrar' && <button type="button" className="ape-linkish ape-link" onClick={() => { setModo('esqueci'); setMsg('') }}>esqueci a senha</button>}
        </div>
      </form>
    </section>
  )
}

function Area({ conta, whats, onSair, onMudou }: { conta: MinhaConta; whats: string; onSair: () => void; onMudou: () => void }) {
  const [aba, setAba] = useState<Aba>('compras')
  const p = conta.perfil
  const plat = conta.plataformas[0]
  const ativa = plat && plat.validade >= new Date().toISOString().slice(0, 10)
  return (
    <div className="ape-conta">
      <aside className="ape-panel ape-conta-lado">
        <div className="ape-conta-eu">
          {p.foto ? <img src={p.foto} alt="" /> : <span className="ape-conta-av">{firstName(p.nome).charAt(0).toUpperCase() || '?'}</span>}
          <div><b>{p.nome || 'sua conta'}</b><span>{p.email}</span></div>
        </div>
        <nav className="ape-conta-nav" aria-label="Minha conta">
          {([['compras', 'minhas compras', 'bag'], ['plataforma', 'minha plataforma', 'phone'], ['perfil', 'meus dados', 'edit'], ['opiniao', 'sugestões e depoimento', 'star']] as [Aba, string, string][]).map(([id, l, i]) => (
            <button key={id} aria-current={aba === id ? 'page' : undefined} onClick={() => setAba(id)}><ApeIcon name={i} />{l}</button>
          ))}
          <button onClick={onSair}><ApeIcon name="x" />sair</button>
        </nav>
      </aside>
      <div className="ape-conta-main">
        {aba === 'compras' && <Compras conta={conta} whats={whats} onMudou={onMudou} />}
        {aba === 'plataforma' && (
          <section className="ape-panel ape-form">
            <p className="ape-eyebrow">minha plataforma</p>
            {plat ? (
              <>
                <h2 className="ape-h2">{ativa ? <>acesso <em>ativo</em></> : <>acesso <em>vencido</em></>}</h2>
                <p className="ape-note" style={{ margin: 0 }}>{ativa ? `Seu acesso vai até ${dmy(plat.validade)}.` : `Venceu em ${dmy(plat.validade)}. Os seus dados continuam guardados para consulta.`}{plat.cortesia ? ' (cortesia)' : ''}</p>
                <div className="ape-acts">
                  <a className="ape-btn primary" href={href('ape', `minha:${plat.token}`)}><ApeIcon name="phone" />abrir a plataforma</a>
                  <a className="ape-btn" href={href('ape', 'loja:plataforma')}>{ativa ? 'renovar por mais 12 meses' : 'renovar'}</a>
                </div>
              </>
            ) : (
              <>
                <h2 className="ape-h2">você ainda não tem a <em>plataforma</em></h2>
                <p className="ape-note" style={{ margin: 0 }}>Um site para acompanhar gastos, parcelas, etapas da obra e a vistoria com fotos, por 12 meses.</p>
                <div className="ape-acts"><a className="ape-btn primary" href={href('ape', 'loja:plataforma')}>conhecer</a></div>
              </>
            )}
          </section>
        )}
        {aba === 'perfil' && <Perfil conta={conta} onMudou={onMudou} />}
        {aba === 'opiniao' && <Opiniao conta={conta} onMudou={onMudou} />}
      </div>
    </div>
  )
}

function Compras({ conta, whats, onMudou }: { conta: MinhaConta; whats: string; onMudou: () => void }) {
  const [cancelar, setCancelar] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [msg, setMsg] = useState('')
  const pedir = async (id: string) => {
    try {
      await contaApi('cancelar', { pedido: id, motivo })
      setCancelar(null)
      setMotivo('')
      setMsg('Pedido de cancelamento enviado. Você recebe a resposta por e-mail.')
      onMudou()
    } catch (e) {
      setMsg(String((e as Error).message))
    }
  }
  if (!conta.pedidos.length)
    return (
      <section className="ape-panel ape-empty">
        <b>nenhuma compra com este e-mail</b>
        <a className="ape-btn primary" href={href('ape', 'loja')}>ir para a loja</a>
      </section>
    )
  return (
    <section className="ape-panel ape-form">
      <p className="ape-eyebrow">minhas compras</p>
      {msg && <div className="ape-banner">{msg}</div>}
      <div className="ape-compras">
        {conta.pedidos.map((p) => {
          const dias = p.pago_em ? Math.floor((Date.now() - new Date(p.pago_em).getTime()) / 864e5) : 0
          const bonus = p.pago_em ? new Date(new Date(p.pago_em).getTime() + 7 * 864e5) : null
          const c = p.cancelamento
          return (
            <article key={p.id} className="ape-compra">
              <header>
                <div>
                  <b>{p.itens.map((i) => i.nome).join(' + ')}</b>
                  <span className="ape-note">{dmy(p.criado)} · <span className="ape-keep">{p.cortesia ? 'cortesia' : brl(Number(p.total))}</span></span>
                </div>
                <span className={`ape-pill ${p.status === 'pago' ? 'azul' : 'rosa'}`}>{p.status === 'pago' ? (c?.status === 'pedido' ? 'cancelamento em análise' : 'liberado') : p.status}</span>
              </header>
              {p.status === 'pago' && bonus && (bonus.getTime() <= Date.now()
                ? <div className="ape-bonus-mini on"><ApeIcon name="unlock" /><span><b>bônus liberado</b><small>abra os arquivos: ele está lá, separado dos outros</small></span></div>
                : <div className="ape-bonus-mini"><ApeIcon name="lock" /><span><b>bônus surpresa</b><small>trancado · abre em {Math.max(1, Math.ceil((bonus.getTime() - Date.now()) / 864e5))} dia(s), {dmy(bonus.toISOString())}</small></span></div>)}
              {c?.status === 'negado' && <p className="ape-note" style={{ margin: 0 }}>Cancelamento não aprovado{c.resposta ? `: ${c.resposta}` : ''}.</p>}
              <div className="ape-acts">
                {p.status === 'pago' && <a className="ape-btn primary sm" href={href('ape', `pedido:${p.token}`)}><ApeIcon name="download" />abrir arquivos</a>}
                {p.status === 'pago' && !p.cortesia && c?.status !== 'pedido' && cancelar !== p.id && <button className="ape-btn ghost sm" onClick={() => setCancelar(p.id)}>pedir cancelamento</button>}
              </div>
              {cancelar === p.id && (
                <div className="ape-cancelar">
                  <p className="ape-note" style={{ margin: 0 }}>{dias <= 7 ? `Você está dentro dos 7 dias do direito de arrependimento (compra de ${dias} dia${dias === 1 ? '' : 's'} atrás): o reembolso é garantido.` : `A compra foi há ${dias} dias, depois do prazo de 7 dias. O pedido será analisado.`} Com o reembolso, os downloads e o acesso deste pedido são desativados.</p>
                  <div className="ape-f"><label htmlFor={`m-${p.id}`}>Conte o motivo (ajuda a melhorar)</label><textarea id={`m-${p.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
                  <div className="ape-acts">
                    <button className="ape-btn primary sm" onClick={() => void pedir(p.id)}>enviar pedido</button>
                    <button className="ape-btn ghost sm" onClick={() => setCancelar(null)}>voltar</button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
      <p className="ape-note" style={{ margin: 0 }}>Dúvidas? <a className="ape-link" href={wa(whats, 'Oi! Tenho uma dúvida sobre a minha compra no planê.apê.')} target="_blank" rel="noopener noreferrer">fale no WhatsApp</a>.</p>
    </section>
  )
}

async function fotoPequena(f: File) {
  const bmp = await createImageBitmap(f)
  const k = Math.min(1, 320 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

function Perfil({ conta, onMudou }: { conta: MinhaConta; onMudou: () => void }) {
  const [nome, setNome] = useState(conta.perfil.nome)
  const [tel, setTel] = useState(fmtTel(conta.perfil.tel))
  const [foto, setFoto] = useState(conta.perfil.foto)
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [msg, setMsg] = useState('')
  const salvar = async () => {
    try {
      await contaApi('perfil', { nome, tel, foto })
      setMsg('Dados salvos.')
      onMudou()
    } catch (e) {
      setMsg(String((e as Error).message))
    }
  }
  const trocar = async () => {
    try {
      await contaApi('senha', { atual, nova })
      setAtual('')
      setNova('')
      setMsg('Senha trocada. Os outros aparelhos foram desconectados.')
    } catch (e) {
      setMsg(String((e as Error).message))
    }
  }
  return (
    <section className="ape-panel ape-form">
      <p className="ape-eyebrow">meus dados</p>
      <div className="ape-conta-foto">
        {foto ? <img src={foto} alt="Sua foto" /> : <span className="ape-conta-av">{firstName(nome).charAt(0).toUpperCase() || '?'}</span>}
        <label className="ape-btn sm"><ApeIcon name="clip" />{foto ? 'trocar foto' : 'colocar foto'}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFoto(await fotoPequena(f)) }} /></label>
        {foto && <button className="ape-btn ghost sm" onClick={() => setFoto('')}>tirar</button>}
      </div>
      <div className="ape-frow">
        <div className="ape-f"><label htmlFor="p-nome">Nome</label><input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="ape-f"><label htmlFor="p-tel">Celular</label><input id="p-tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} onBlur={() => setTel(fmtTel(tel))} /></div>
      </div>
      <div className="ape-frow">
        <div className="ape-f"><label>E-mail</label><input value={conta.perfil.email} disabled /></div>
        <div className="ape-f"><label><span className="ape-keep">CPF</span></label><input value={conta.perfil.cpf} disabled /></div>
      </div>
      <button className="ape-btn primary" style={{ justifySelf: 'start' }} onClick={() => void salvar()}>salvar dados</button>
      <p className="ape-eyebrow" style={{ marginTop: 10 }}>trocar a senha</p>
      <div className="ape-frow">
        <div className="ape-f"><label htmlFor="p-atual">Senha atual</label><input id="p-atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} /></div>
        <div className="ape-f"><label htmlFor="p-nova">Nova senha</label><input id="p-nova" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} /></div>
      </div>
      <button className="ape-btn" style={{ justifySelf: 'start' }} onClick={() => void trocar()}>trocar senha</button>
      {msg && <p className="ape-note" role="status" style={{ margin: 0 }}>{msg}</p>}
    </section>
  )
}

function Opiniao({ conta, onMudou }: { conta: MinhaConta; onMudou: () => void }) {
  const [tipo, setTipo] = useState<'sugestao' | 'depoimento'>('depoimento')
  const [texto, setTexto] = useState('')
  const [nota, setNota] = useState(5)
  const [msg, setMsg] = useState('')
  const enviar = async () => {
    try {
      await contaApi('feedback', { tipo, texto, nota })
      setTexto('')
      setMsg(tipo === 'depoimento' ? 'Obrigada pelo depoimento! Ele pode aparecer na loja, só com o seu primeiro nome.' : 'Obrigada pela sugestão!')
      onMudou()
    } catch (e) {
      setMsg(String((e as Error).message))
    }
  }
  return (
    <section className="ape-panel ape-form">
      <p className="ape-eyebrow">sugestões e depoimento</p>
      <div className="ape-tipos-envio" role="radiogroup">
        {([['depoimento', 'deixar um depoimento', 'conte o que achou dos materiais'], ['sugestao', 'mandar uma sugestão', 'o que poderia ter ou melhorar']] as const).map(([id, l, d]) => (
          <button key={id} type="button" role="radio" aria-checked={tipo === id} onClick={() => setTipo(id)}><b>{l}</b><span>{d}</span></button>
        ))}
      </div>
      {tipo === 'depoimento' && (
        <div className="ape-estrelas" role="radiogroup" aria-label="Nota">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={nota === n} className={n <= nota ? 'on' : ''} onClick={() => setNota(n)} aria-label={`${n} estrela${n > 1 ? 's' : ''}`}><ApeIcon name="star" /></button>)}
        </div>
      )}
      <div className="ape-f"><label htmlFor="o-txt">{tipo === 'depoimento' ? 'Seu depoimento' : 'Sua sugestão'}</label><textarea id="o-txt" value={texto} onChange={(e) => setTexto(e.target.value)} /></div>
      <button className="ape-btn primary" style={{ justifySelf: 'start' }} onClick={() => void enviar()}>enviar</button>
      {msg && <p className="ape-note" role="status" style={{ margin: 0 }}>{msg}</p>}
      {conta.feedback.length > 0 && (
        <div className="ape-rows">
          {conta.feedback.map((f, i) => (
            <div key={i} className="ape-row"><div className="t"><b>{f.tipo === 'depoimento' ? `depoimento${f.nota ? ` · ${'★'.repeat(f.nota)}` : ''}` : 'sugestão'}</b><span>{f.texto}</span></div><div className="r"><span className="ape-pill">{f.tipo === 'depoimento' ? (f.publicado ? 'na loja' : 'enviado') : 'recebida'}</span></div></div>
          ))}
        </div>
      )}
      <p className="ape-note" style={{ margin: 0 }}>{APE.instagram}</p>
    </section>
  )
}
