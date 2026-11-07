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
  return (
    <>
      <header className="ape-top ape-plat-top">
        <div className="wrap ape-brand">
          <a className="ape-logo" href={href('ape', 'loja')} aria-label="planê.apê">
            <span className="ape-mark" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />
            <div>
              <h1>planê<span>.apê</span></h1>
              <small>plataforma do apê{demo ? ' · demonstração' : ''}</small>
            </div>
          </a>
          <span className={`ape-salvo ${salvo}`}>{demo ? 'exemplo: nada é salvo na nuvem' : salvo === 'salvando' ? 'salvando…' : salvo === 'erro' ? 'não salvou: confira a internet' : 'tudo salvo'}</span>
        </div>
        <nav className="wrap ape-tabs" aria-label="Seções da plataforma">
          {ABAS.map(([id, l, i]) => (
            <button key={id} aria-current={aba === id ? 'page' : undefined} onClick={() => setAba(id)}><ApeIcon name={i} />{l}</button>
          ))}
        </nav>
      </header>
      <main className="wrap ape-main ape-platapp">
        {demo && <div className="ape-banner"><ApeIcon name="eye" />Você está vendo a demonstração com dados de exemplo. Mexa à vontade: fica só neste aparelho. <a className="ape-link" href={href('ape', 'loja')}>quero a minha</a></div>}
        {!acc.ativo && <div className="ape-banner warn">O seu acesso venceu em {dmy(acc.validade)}. Os dados continuam aqui para consulta. Para renovar, fale no WhatsApp.</div>}
        {aba === 'resumo' && <Resumo acc={acc} dados={dados} im={im} token={token} demo={demo} mudar={mudar} irPara={setAba} />}
        {aba === 'gastos' && <Gastos lista={dados.gastos || []} orcamento={im.orcamento} mudar={(fn) => mudar((d) => ({ ...d, gastos: fn(d.gastos || []) }))} />}
        {aba === 'parcelas' && <Parcelas lista={dados.parcelas || []} mudar={(fn) => mudar((d) => ({ ...d, parcelas: fn(d.parcelas || []) }))} />}
        {aba === 'etapas' && <Etapas lista={dados.etapas || []} mudar={(fn) => mudar((d) => ({ ...d, etapas: fn(d.etapas || []) }))} />}
        {aba === 'vistoria' && <Vistoria lista={dados.vistoria || []} nome={acc.nome} mudar={(fn) => mudar((d) => ({ ...d, vistoria: fn(d.vistoria || []) }))} />}
        {aba === 'contatos' && <Contatos lista={dados.contatos || []} mudar={(fn) => mudar((d) => ({ ...d, contatos: fn(d.contatos || []) }))} />}
        <Assinatura />
      </main>
      <nav className="ape-bnav ape-plat-bnav" aria-label="Seções da plataforma">
        {ABAS.map(([id, l, i]) => (
          <button key={id} aria-current={aba === id ? 'page' : undefined} onClick={() => { setAba(id); window.scrollTo(0, 0) }}><ApeIcon name={i} />{l}</button>
        ))}
      </nav>
    </>
  )
}

type Mudar<T> = (fn: (l: T[]) => T[]) => void

function Resumo({ acc, dados, im, token, demo, mudar, irPara }: { acc: PlatAcesso; dados: PlatDados; im: NonNullable<PlatDados['imovel']>; token: string; demo: boolean; mudar: (fn: (d: PlatDados) => PlatDados) => void; irPara: (a: Aba) => void }) {
  const g = dados.gastos || []
  const previsto = g.reduce((t, x) => t + (x.previsto || 0), 0)
  const pago = g.reduce((t, x) => t + (x.pago || 0), 0)
  const ms = meses(dados.parcelas || [], 3)
  const et = dados.etapas || []
  const feitas = et.filter((e) => e.feita).length
  const vi = dados.vistoria || []
  const probl = vi.filter((v) => v.status === 'problema').length
  const [copiado, setCopiado] = useState(false)
  const link = `https://useplane.com.br/ape/#minha:${token}`
  const setIm = (k: keyof NonNullable<PlatDados['imovel']>, v: unknown) => mudar((d) => ({ ...d, imovel: { ...im, [k]: v } }))
  return (
    <>
      <section className="ape-panel ape-plat-hello">
        <div>
          <p className="ape-eyebrow">olá{acc.nome ? `, ${firstName(acc.nome)}` : ''}</p>
          <h2 className="ape-h2">{im.nome || 'meu apê'}</h2>
          <span className="ape-note">acesso até {dmy(acc.validade)}{acc.cortesia ? ' · cortesia' : ''}</span>
        </div>
        {!demo && (
          <button className="ape-btn sm" onClick={() => { void navigator.clipboard?.writeText(link); setCopiado(true) }}>
            <ApeIcon name={copiado ? 'check' : 'copy'} />
            {copiado ? 'link copiado: guarde em lugar seguro' : 'copiar meu link de acesso'}
          </button>
        )}
      </section>
      <div className="ape-plat-kpis">
        <button className="ape-kpi" onClick={() => irPara('gastos')}><span>gasto até agora</span><b className="ape-keep">{brl(pago)}</b><small className="ape-keep">de {brl(im.orcamento || previsto)} {im.orcamento ? 'do orçamento' : 'previstos'}</small></button>
        <button className="ape-kpi" onClick={() => irPara('parcelas')}><span>parcelas este mês</span><b className="ape-keep">{brl(ms[0]?.total || 0)}</b><small className="ape-keep">próximo: {brl(ms[1]?.total || 0)}</small></button>
        <button className="ape-kpi" onClick={() => irPara('etapas')}><span>etapas</span><b>{feitas} de {et.length}</b><small>{et.find((e) => !e.feita)?.nome || 'tudo feito'}</small></button>
        <button className="ape-kpi" onClick={() => irPara('vistoria')}><span>vistoria</span><b>{probl} problema{probl === 1 ? '' : 's'}</b><small>{vi.filter((v) => v.status === 'pendente').length} itens a conferir</small></button>
      </div>
      <section className="ape-panel">
        <p className="ape-eyebrow">o imóvel</p>
        <div className="ape-frow">
          <div className="ape-f"><label>Nome</label><input value={im.nome} onChange={(e) => setIm('nome', e.target.value)} /></div>
          <div className="ape-f"><label>Tipo</label><select value={im.tipo} onChange={(e) => setIm('tipo', e.target.value)}><option value="apê">apê</option><option value="casa">casa</option></select></div>
        </div>
        <div className="ape-frow">
          <div className="ape-f"><label>Etapa</label>
            <select value={im.fase} onChange={(e) => setIm('fase', e.target.value)}>
              <option value="comprando">comprando</option><option value="planta">comprei na planta</option><option value="pronto">comprei pronto</option><option value="obra">em obra</option><option value="morando">morando</option>
            </select>
          </div>
          <div className="ape-f"><label>Área (m²)</label><input inputMode="decimal" value={im.m2 ?? ''} onChange={(e) => setIm('m2', num(e.target.value))} /></div>
        </div>
        <div className="ape-frow">
          <div className="ape-f"><label>Orçamento total da obra (<span className="ape-keep">R$</span>)</label><input inputMode="decimal" value={im.orcamento ?? ''} onChange={(e) => setIm('orcamento', num(e.target.value))} /></div>
          <div className="ape-f"><label>Entrega das chaves</label><input type="date" value={im.entrega} onChange={(e) => setIm('entrega', e.target.value)} /></div>
        </div>
        <div className="ape-f"><label>Anotações</label><textarea value={dados.notas || ''} onChange={(e) => mudar((d) => ({ ...d, notas: e.target.value }))} placeholder="Senhas do interfone, medidas, ideias…" /></div>
      </section>
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
