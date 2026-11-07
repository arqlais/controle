import { useEffect, useMemo, useRef, useState } from 'react'
import { href } from '../router'
import { platAbrir, platSalvar, type PlatAcesso, type PlatContato, type PlatDados, type PlatEtapa, type PlatGasto, type PlatParcela, type PlatVistoria } from './api'
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
  imovel: { tipo: 'apê', fase: 'obra', m2: 40, orcamento: 45000, entrega: '2026-12-15', nome: 'meu apê' },
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
  notas: '',
}
const novo = (): PlatDados => ({
  imovel: { tipo: 'apê', fase: 'obra', m2: null, orcamento: null, entrega: '', nome: 'meu apê' },
  gastos: [],
  parcelas: [],
  etapas: [...ETAPAS_COMPRA, ...ETAPAS_OBRA].map((nome) => ({ id: uid(), nome, feita: false, data: '', quem: '', obs: '' })),
  vistoria: VISTORIA.flatMap(([c, l]) => l.map((item) => ({ id: uid(), comodo: c, item, status: 'pendente' as const, obs: '' }))),
  contatos: [],
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

type Aba = 'resumo' | 'gastos' | 'parcelas' | 'etapas' | 'vistoria' | 'contatos'
const ABAS: [Aba, string, string][] = [
  ['resumo', 'resumo', 'home'], ['gastos', 'gastos', 'tag'], ['parcelas', 'parcelas', 'clock'], ['etapas', 'etapas', 'list'], ['vistoria', 'vistoria', 'check'], ['contatos', 'contatos', 'chat'],
]

export function Plataforma({ token, whats }: { token: string; whats: string }) {
  const demo = token === 'demo'
  const [acc, setAcc] = useState<PlatAcesso | null | undefined>(undefined)
  const [dados, setDados] = useState<PlatDados>({})
  const [aba, setAba] = useState<Aba>('resumo')
  const [salvo, setSalvo] = useState<'ok' | 'salvando' | 'erro'>('ok')
  const [editar, setEditar] = useState(false)
  const [tema, setTema] = useState<'claro' | 'escuro'>(() => read<'claro' | 'escuro'>('ape-tema') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'))
  const trocarTema = () => setTema((t) => { const n = t === 'escuro' ? 'claro' : 'escuro'; write('ape-tema', n); return n })
  const timer = useRef(0)
  const pendente = useRef<PlatDados | null>(null)
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
        write('ape-plat', token) // "minha plataforma" neste aparelho
      }
    })
  }, [token])
  const mudar = (fn: (d: PlatDados) => PlatDados) => {
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
          <span>Confira se copiou o link inteiro. Você também acha o acesso em "minhas compras", com o CPF e o e-mail da compra.</span>
          <div className="ape-acts" style={{ justifyContent: 'center' }}>
            <a className="ape-btn primary" href={href('ape', 'loja')}>ir para a loja</a>
            <a className="ape-btn" href={wa(whats, 'Oi! Não estou conseguindo abrir a minha plataforma do apê.')} target="_blank" rel="noopener noreferrer"><ApeIcon name="chat" />WhatsApp</a>
          </div>
        </div>
      </main>
    )
  const im = dados.imovel || novo().imovel!
  const nome = dados.perfil?.nome || acc.nome
  const foto = dados.perfil?.foto || ''
  const ir = (a: Aba) => {
    setAba(a)
    window.scrollTo(0, 0)
  }
  const statusSalvo = demo ? 'demonstração: nada é salvo' : salvo === 'salvando' ? 'salvando…' : salvo === 'erro' ? 'não salvou: confira a internet' : 'tudo salvo'
  const titulo = ABAS.find((x) => x[0] === aba)?.[1] || ''
  return (
    <div className="ape-pa" data-tema={tema}>
      <aside className="ape-pa-lado">
        <a className="ape-logo" href={href('ape', 'loja')} aria-label="planê.apê">
          <span className="ape-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
          <div><h1>planê<span>.apê</span></h1><small>plataforma do apê</small></div>
        </a>
        <button className="ape-pa-eu" onClick={() => setEditar(true)} title="Editar meus dados">
          <Avatar nome={nome} foto={foto} />
          <span><b>{firstName(nome) || 'meu apê'}</b><small>{im.nome || 'meu apê'} · editar</small></span>
        </button>
        <nav className="ape-pa-nav" aria-label="Seções da plataforma">
          {ABAS.map(([id, l, i]) => (
            <button key={id} aria-current={aba === id ? 'page' : undefined} onClick={() => ir(id)}><ApeIcon name={i} /><span>{l}</span></button>
          ))}
        </nav>
        <div className="ape-pa-pe">
          <button className="ape-pa-tema" onClick={trocarTema}><ApeIcon name={tema === 'escuro' ? 'sun' : 'moon'} /><span>{tema === 'escuro' ? 'modo claro' : 'modo escuro'}</span></button>
          <a className="ape-pa-tema" href={href('ape', 'conta')}><ApeIcon name="user" /><span>minha conta</span></a>
          <span className={`ape-salvo ${salvo}`}>{statusSalvo}</span>
        </div>
      </aside>
      <div className="ape-pa-main">
        <header className="ape-pa-top">
          <button className="ape-pa-eu sm" onClick={() => setEditar(true)} aria-label="Editar meus dados"><Avatar nome={nome} foto={foto} /></button>
          <div><small>planê<span>.apê</span></small><b>{titulo}</b></div>
          <button className="ape-pa-ic" onClick={trocarTema} aria-label={tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}><ApeIcon name={tema === 'escuro' ? 'sun' : 'moon'} /></button>
        </header>
        <main className="ape-pa-cont">
          {demo && <div className="ape-banner"><ApeIcon name="eye" />Demonstração com dados de exemplo: mexa à vontade, fica só neste aparelho. <a className="ape-link" href={href('ape', 'loja')}>quero a minha</a></div>}
          {!acc.ativo && <div className="ape-banner warn">O seu acesso venceu em {dmy(acc.validade)}. Os dados continuam aqui para consulta. <a className="ape-link" href={href('ape', 'loja:plataforma')}>renovar</a></div>}
          {aba === 'resumo' && <Resumo acc={acc} dados={dados} im={im} nome={nome} foto={foto} token={token} demo={demo} mudar={mudar} irPara={ir} onEditar={() => setEditar(true)} />}
          {aba === 'gastos' && <Gastos lista={dados.gastos || []} orcamento={im.orcamento} mudar={(fn) => mudar((d) => ({ ...d, gastos: fn(d.gastos || []) }))} />}
          {aba === 'parcelas' && <Parcelas lista={dados.parcelas || []} mudar={(fn) => mudar((d) => ({ ...d, parcelas: fn(d.parcelas || []) }))} />}
          {aba === 'etapas' && <Etapas lista={dados.etapas || []} mudar={(fn) => mudar((d) => ({ ...d, etapas: fn(d.etapas || []) }))} />}
          {aba === 'vistoria' && <Vistoria lista={dados.vistoria || []} nome={nome} mudar={(fn) => mudar((d) => ({ ...d, vistoria: fn(d.vistoria || []) }))} />}
          {aba === 'contatos' && <Contatos lista={dados.contatos || []} mudar={(fn) => mudar((d) => ({ ...d, contatos: fn(d.contatos || []) }))} />}
          <Assinatura />
        </main>
      </div>
      <nav className="ape-bnav ape-plat-bnav" aria-label="Seções da plataforma">
        {ABAS.map(([id, l, i]) => (
          <button key={id} aria-current={aba === id ? 'page' : undefined} onClick={() => ir(id)}><ApeIcon name={i} />{l}</button>
        ))}
      </nav>
      {editar && <EditarDados dados={dados} nomeConta={acc.nome} onClose={() => setEditar(false)} mudar={mudar} />}
    </div>
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
          <div className="ape-frow">
            <div className="ape-f"><label>Nome</label><input value={im.nome} onChange={(e) => set('nome', e.target.value)} placeholder="meu apê" /></div>
            <div className="ape-f"><label>Tipo</label><select value={im.tipo} onChange={(e) => set('tipo', e.target.value)}><option value="apê">apê</option><option value="casa">casa</option></select></div>
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
function Resumo({ acc, dados, im, nome, foto, token, demo, mudar, irPara, onEditar }: { acc: PlatAcesso; dados: PlatDados; im: NonNullable<PlatDados['imovel']>; nome: string; foto: string; token: string; demo: boolean; mudar: (fn: (d: PlatDados) => PlatDados) => void; irPara: (a: Aba) => void; onEditar: () => void }) {
  const g = dados.gastos || []
  const previsto = g.reduce((t, x) => t + (x.previsto || 0), 0)
  const pago = g.reduce((t, x) => t + (x.pago || 0), 0)
  const ms = meses(dados.parcelas || [], 3)
  const et = dados.etapas || []
  const feitas = et.filter((e) => e.feita).length
  const proximas = et.filter((e) => !e.feita).slice(0, 3)
  const vi = dados.vistoria || []
  const probl = vi.filter((v) => v.status === 'problema').length
  const [copiado, setCopiado] = useState(false)
  const link = `https://useplane.com.br/ape/#minha:${token}`
  const dias = im.entrega ? Math.round((new Date(im.entrega + 'T00:00:00').getTime() - Date.now()) / 864e5) : null
  const meta = im.orcamento || previsto
  return (
    <>
      <section className="ape-pa-ola">
        <Avatar nome={nome} foto={foto} />
        <div>
          <h2>olá{nome ? `, ${firstName(nome)}` : ''}!</h2>
          <p>{[im.nome || 'meu apê', im.tipo, im.m2 ? `${String(im.m2).replace('.', ',')} m²` : '', FASE[im.fase]].filter(Boolean).join(' · ')}{dias != null ? ` · ${dias > 0 ? `faltam ${dias} dias para as chaves` : dias === 0 ? 'chaves hoje!' : `chaves em ${dmy(im.entrega)}`}` : ''}</p>
        </div>
        <button className="ape-btn sm" onClick={onEditar}><ApeIcon name="edit" />editar</button>
      </section>
      <div className="ape-plat-kpis">
        <button className="ape-kpi" onClick={() => irPara('gastos')}>
          <span><ApeIcon name="tag" />gasto até agora</span>
          <b className="ape-keep">{brl(pago)}</b>
          {meta ? <i className="ape-kpi-bar"><em style={{ width: `${Math.min(100, (pago / meta) * 100)}%` }} /></i> : null}
          <small className="ape-keep">{meta ? `de ${brl(meta)} ${im.orcamento ? 'planejados' : 'previstos'}` : 'toque para lançar'}</small>
        </button>
        <button className="ape-kpi" onClick={() => irPara('parcelas')}><span><ApeIcon name="clock" />parcelas este mês</span><b className="ape-keep">{brl(ms[0]?.total || 0)}</b><small className="ape-keep">próximo mês: {brl(ms[1]?.total || 0)}</small></button>
        <button className="ape-kpi" onClick={() => irPara('etapas')}><span><ApeIcon name="list" />etapas</span><b>{feitas} de {et.length}</b><i className="ape-kpi-bar"><em style={{ width: `${et.length ? (feitas / et.length) * 100 : 0}%` }} /></i><small>{proximas[0]?.nome || 'tudo feito!'}</small></button>
        <button className="ape-kpi" onClick={() => irPara('vistoria')}><span><ApeIcon name="check" />vistoria</span><b>{probl ? `${probl} problema${probl > 1 ? 's' : ''}` : 'sem problemas'}</b><small>{vi.filter((v) => v.status === 'pendente').length} itens a conferir</small></button>
      </div>
      <div className="ape-pa-duas">
        <section className="ape-panel ape-pa-passos">
          <p className="ape-eyebrow">próximos passos</p>
          {proximas.length ? proximas.map((e) => (
            <label key={e.id} className="ape-pa-passo">
              <input type="checkbox" onChange={() => mudar((d) => ({ ...d, etapas: (d.etapas || []).map((x) => (x.id === e.id ? { ...x, feita: true, data: x.data || new Date().toISOString().slice(0, 10) } : x)) }))} />
              <span><b>{e.nome}</b>{e.data ? <small>{dmy(e.data)}</small> : null}</span>
            </label>
          )) : <p className="ape-note">Todas as etapas feitas.</p>}
          <button className="ape-linkish ape-link" onClick={() => irPara('etapas')}>ver todas as etapas</button>
        </section>
        <section className="ape-panel ape-pa-atalhos">
          <p className="ape-eyebrow">atalhos</p>
          <button onClick={() => irPara('gastos')}><ApeIcon name="plus" />lançar um gasto</button>
          <button onClick={() => irPara('parcelas')}><ApeIcon name="plus" />lançar uma parcela</button>
          <button onClick={() => irPara('vistoria')}><ApeIcon name="check" />fazer a vistoria</button>
          <button onClick={() => irPara('contatos')}><ApeIcon name="chat" />guardar um contato</button>
        </section>
      </div>
      <section className="ape-panel">
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
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">gastos por cômodo</p><span className="ape-note ape-keep">previsto {brl(previsto)} · pago {brl(pago)} · falta {brl(Math.max(0, previsto - pago))}{orcamento ? ` · orçamento ${brl(orcamento)}` : ''}</span></div>
        <button className="ape-btn primary sm" onClick={() => mudar((l) => [...l, { id: uid(), comodo: filtro === 'todos' ? 'geral' : filtro, item: '', previsto: null, pago: null, status: 'planejado', data: '', obs: '' }])}><ApeIcon name="plus" />gasto</button>
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
        {vis.map((g) => (
          <div key={g.id} className="ape-plat-item">
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
              <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== g.id))} aria-label="Apagar gasto"><ApeIcon name="trash" /></button>
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
  return (
    <section className="ape-panel ape-plat-sec">
      <div className="ape-plat-sec-h">
        <div><p className="ape-eyebrow">parcelas dos próximos 12 meses</p><span className="ape-note ape-keep">total no período: {brl(ms.reduce((t, m) => t + m.total, 0))}</span></div>
        <button className="ape-btn primary sm" onClick={() => mudar((l) => [...l, { id: uid(), descricao: '', valor: null, vezes: 1, inicio: hoje(), dia: null }])}><ApeIcon name="plus" />parcela</button>
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
        {lista.map((p) => (
          <div key={p.id} className="ape-plat-item">
            <div className="ape-frow">
              <div className="ape-f"><label>O que é</label><input value={p.descricao} onChange={(e) => set(p.id, 'descricao', e.target.value)} placeholder="ex.: marcenaria" /></div>
              <div className="ape-f"><label>1ª parcela</label><input type="date" value={p.inicio} onChange={(e) => set(p.id, 'inicio', e.target.value)} /></div>
            </div>
            <div className="ape-frow">
              <div className="ape-f"><label>Valor da parcela (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={p.valor ?? ''} onChange={(e) => set(p.id, 'valor', num(e.target.value))} /></div>
              <div className="ape-f"><label>Quantas vezes</label><input inputMode="numeric" value={p.vezes ?? ''} onChange={(e) => set(p.id, 'vezes', num(e.target.value))} /></div>
              <button className="ape-btn ghost sm" onClick={() => mudar((l) => l.filter((x) => x.id !== p.id))} aria-label="Apagar parcela"><ApeIcon name="trash" /></button>
            </div>
            {p.valor && p.vezes ? <span className="ape-note ape-keep">total: {brl(p.valor * p.vezes)}</span> : null}
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
