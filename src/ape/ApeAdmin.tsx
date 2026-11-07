import { useCallback, useEffect, useMemo, useState } from 'react'
import { askGemini, readFile, type Attachment } from '../components/AIChat'
import { ask, toast } from '../components/dialog'
import { href } from '../router'
import { useStore } from '../store'
import { admin, apeCloud, loja, painelConta, type Ajustes, type PedidoAdmin, type PlatAdmin, type Vendedor } from './api'
import { ApeIcon } from './ApeIcon'
import {
  APE, BONUS, PIX_PCT, TAXAS, comPrecos, liquido, noCarrinho, reais, type Taxas, FIELDS, LOJA_VERSAO, NICHOS, PRODUTOS, aiPrompt, blankOrcamento, brl, calc, cleanOrcamento, dmy, firstName, fmtTel, nicho, num, parseJsonReply, wa, waNum,
  CATEGORIAS, digits, ehSanLevi, ondeMora, type Categoria, type Envio, type Interesse, type Morador, type Orcamento, type Produto,
} from './model'
import './ape.css'

/* Painel do planê.apê (só a dona): orçamentos que chegaram dos moradores, leitura com IA,
   publicar/editar/ocultar, moradores cadastrados, quem quer cada compra em grupo e a loja. */

type Tab = 'recebidos' | 'novo' | 'lista' | 'moradores' | 'grupos' | 'loja' | 'pedidos' | 'clientes' | 'entregas' | 'testar' | 'opiniao'
interface Draft {
  o: Orcamento
  novo: boolean
  ia: boolean
  envio?: string // id do envio que virou este orçamento
}

export default function ApeAdmin() {
  const { data } = useStore()
  const aiKey = data.settings.aiKey || ''
  const [tab, setTab] = useState<Tab>('recebidos')
  const [orcs, setOrcs] = useState<Orcamento[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [moradores, setMoradores] = useState<Morador[]>([])
  const [interesses, setInteresses] = useState<Interesse[]>([])
  const [escolhas, setEscolhas] = useState<{ orcamento: string; nicho: string; morador: Morador | null }[]>([])
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([])
  const [ajustes, setAjustes] = useState<Ajustes | null>(null)
  const [erro, setErro] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)

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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <ApeIcon name="home" /> só você vê
          </p>
          <h1>
            {APE.name} <em>{APE.condominio}</em>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['https://useplane.com.br/ape/sanlevi/', 'link dos moradores', 'abre os orçamentos (só San Levi)'], ['https://useplane.com.br/ape/', 'link da loja', 'página de vendas aberta a todos']] as const).map(([u, l, d]) => (
            <button
              key={u}
              className="btn"
              title={d}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(u)
                  toast(`Copiado: ${u.replace('https://', '')} (${d}).`)
                } catch {
                  toast(u.replace('https://', ''))
                }
              }}
            >
              <ApeIcon name="copy" /> copiar {l}
            </button>
          ))}
          <a className="btn" href={href('ape')} target="_blank" rel="noreferrer">
            <ApeIcon name="eye" /> abrir a página dos moradores
          </a>
        </div>
      </div>
      <div className="ape ape-admin">
        <div className="ape-panel" style={{ display: 'grid', gap: 14 }}>
          {erro && (
            <div className="ape-banner warn">
              Não consegui ler os dados do {APE.name} ({erro}). Confira se o arquivo <b>supabase/ape.sql</b> já foi rodado no Supabase.
            </div>
          )}
          {!apeCloud && <div className="ape-banner">Prévia: tudo fica só neste navegador.</div>}
          <div className="ape-atabs" role="tablist">
            {(
              [
                ['recebidos', <>Enviados{novos ? <em>{novos}</em> : null}</>],
                ['novo', draft && !draft.novo ? 'Editar' : 'Adicionar'],
                ['lista', `Orçamentos (${orcs.length})`],
                ['moradores', `Cadastros (${moradores.length})`],
                ['grupos', 'Compras em grupo'],
                ['loja', 'Produtos e preços'],
                ['pedidos', 'Vendas'],
                ['clientes', 'Clientes'],
                ['entregas', 'Arquivos'],
                ['opiniao', 'Depoimentos e sugestões'],
                ['testar', 'Testar como cliente'],
              ] as [Tab, React.ReactNode][]
            ).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
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
          {tab === 'grupos' && <Grupos orcs={orcs} interesses={interesses} />}
          {tab === 'loja' && ajustes && <Loja ajustes={ajustes} onSaved={setAjustes} />}
          {tab === 'pedidos' && <Vendas pedidos={pedidos} onChange={load} />}
          {tab === 'clientes' && ajustes && <Clientes pedidos={pedidos} produtos={ajustes.produtos} onChange={load} />}
          {tab === 'entregas' && ajustes && <Entregas produtos={ajustes.produtos} />}
          {tab === 'opiniao' && <Opinioes />}
          {tab === 'testar' && ajustes && <Testar produtos={ajustes.produtos} pedidos={pedidos} onChange={load} />}
        </div>
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
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }))
  const build = (patch: Partial<Orcamento> = {}): Orcamento => {
    const o = { ...draft.o } as unknown as Record<string, unknown>
    for (const [k, , t] of FIELDS) {
      const v = (vals[k] ?? '').trim()
      o[k] = t === 'num' ? num(v) : t === 'bool' ? (v === 'sim' ? true : v === 'nao' ? false : null) : t === 'lines' ? v.split('\n').map((s) => s.trim()).filter(Boolean) : v
    }
    return { ...(o as unknown as Orcamento), ...patch }
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
      <div className="ape-frow">
        {FIELDS.map(([k, l, t]) => {
          const id = `d-${k}`
          const v = vals[k] ?? ''
          if (t === 'nicho')
            return (
              <div key={k} className="ape-f">
                <label htmlFor={id}>{l}</label>
                <select id={id} value={v} onChange={(e) => set(k, e.target.value)}>
                  {NICHOS.map((n) => <option key={n[0]} value={n[0]}>{n[1]}</option>)}
                </select>
              </div>
            )
          if (t === 'bool')
            return (
              <div key={k} className="ape-f">
                <label htmlFor={id}>{l}</label>
                <select id={id} value={v} onChange={(e) => set(k, e.target.value)}>
                  <option value="">Não informado</option>
                  <option value="nao">Sem juros</option>
                  <option value="sim">Com juros</option>
                </select>
              </div>
            )
          if (t === 'lines' || t === 'area')
            return (
              <div key={k} className="ape-f full">
                <label htmlFor={id}>{l}</label>
                <textarea id={id} style={{ minHeight: t === 'area' ? 60 : 80 }} value={v} onChange={(e) => set(k, e.target.value)} />
              </div>
            )
          return (
            <div key={k} className="ape-f">
              <label htmlFor={id}>{l}</label>
              <input id={id} type={t === 'date' ? 'date' : 'text'} inputMode={t === 'num' ? 'decimal' : undefined} value={v} onChange={(e) => set(k, e.target.value)} />
            </div>
          )
        })}
      </div>
      <div className="ape-acts">
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
      <div className="ape-rows">
        {sorted.map((o) => {
          const c = calc(o)
          const n = interesses.filter((i) => i.orcamento === o.id).length + (num(o.interessados) || 0)
          return (
            <div key={o.id} className="ape-row">
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
                <button className="ape-btn sm" onClick={() => onEdit(o)}><ApeIcon name="edit" />Editar</button>
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
        {list.map((m) => {
          const x = info(m)
          return (
            <div key={m.id} className="ape-row ape-pessoa">
              <div className="t">
                <b>
                  {m.nome}
                  {!ehSanLevi(m) && <span className="ape-pill ape-keep" style={{ marginLeft: 6 }}>{m.condominio || 'outro lugar'}</span>}
                </b>
                <span>
                  {ehSanLevi(m) ? `Torre ${m.torre || '?'} · apê ${m.ap || '?'}` : 'não é do San Levi'} · <span className="ape-tel">{fmtTel(m.tel)}</span>
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
          )
        })}
      </div>
    </div>
  )
}

function Grupos({ orcs, interesses }: { orcs: Orcamento[]; interesses: Interesse[] }) {
  const com = orcs.filter((o) => num(o.grupo_pct))
  if (!com.length)
    return (
      <div className="ape-empty">
        <b>Nenhuma compra em grupo ainda</b>
        <span>Quando um orçamento tiver desconto em grupo, os apês interessados aparecem aqui.</span>
      </div>
    )
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {com.map((o) => {
        const ppl = interesses.filter((i) => i.orcamento === o.id)
        const fora = num(o.interessados) || 0
        const total = ppl.length + fora
        const min = num(o.grupo_min)
        const tels = ppl.map((i) => i.morador).filter((m): m is Morador => !!m)
        const copiar = async () => {
          try {
            await navigator.clipboard.writeText(tels.map((m) => `${m.nome} · ${ondeMora(m)} · ${fmtTel(m.tel)}`).join('\n'))
            toast('Lista copiada.')
          } catch {
            toast('Não consegui copiar.')
          }
        }
        return (
          <div key={o.id} className="ape-envio">
            <div className="ape-row" style={{ padding: 0, border: 0 }}>
              <div className="t">
                <b>
                  {o.fornecedor} · {nicho(o.nicho).l}
                </b>
                <span>
                  {total} apê{total === 1 ? '' : 's'}
                  {min ? ` de ${min} para liberar ${o.grupo_pct}%` : ` · ${o.grupo_pct}% em grupo`}
                  {fora ? ` (${fora} por fora)` : ''}
                </span>
              </div>
              <div className="r">
                {tels.length > 0 && <button className="ape-btn sm" onClick={() => void copiar()}><ApeIcon name="copy" />Copiar contatos</button>}
              </div>
            </div>
            {tels.length > 0 && (
              <div className="ape-rows">
                {tels.map((m) => (
                  <div key={m.id} className="ape-row" style={{ padding: '6px 0' }}>
                    <div className="t">
                      <b style={{ fontSize: 13 }}>{m.nome}</b>
                      <span>{ondeMora(m) || 'sem endereço'} · {fmtTel(m.tel)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Loja({ ajustes, onSaved }: { ajustes: Ajustes; onSaved: (a: Ajustes) => void }) {
  const [ps, setPs] = useState<Produto[]>(ajustes.produtos)
  const [whats, setWhats] = useState(ajustes.whatsapp || '')
  const [pixPct, setPixPct] = useState(String(ajustes.pixPct ?? PIX_PCT))
  const [taxas, setTaxas] = useState<Taxas>(ajustes.taxas || TAXAS)
  const [vend, setVend] = useState<Vendedor>(ajustes.vendedor || { nome: '', doc: '', cidade: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [abrir, setAbrir] = useState<string | null>(null)
  const calcd = comPrecos(ps) // preço dos kits calculado sozinho
  const pix = Math.min(10, Math.max(0, num(pixPct) ?? PIX_PCT))
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
    const a: Ajustes = { produtos: ps, whatsapp: whats.replace(/\D/g, ''), lojaV: LOJA_VERSAO, pixPct: pix, taxas, vendedor: vend }
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
      <div className="ape-banner">Os preços daqui valem também no pagamento (a cobrança é calculada no servidor com a loja salva). Desconto só no Pix; cartão à vista, sem parcelas. Kits: escolha o desconto do kit e o preço sai sozinho, sempre terminando em ,90.</div>
      <div className="ape-panel ape-adm-box">
        <p className="ape-eyebrow">pagamento e margem</p>
        <div className="ape-frow">
          <div className="ape-f"><label htmlFor="l-pix">Desconto no Pix (%)</label><input id="l-pix" inputMode="decimal" value={pixPct} onChange={(e) => setPixPct(e.target.value)} /><span className="ape-hint">De 0 a 10. Sugerido: 5.</span></div>
          <div className="ape-f"><label htmlFor="l-tp">Taxa do Pix (<span className="ape-keep">R$</span> por venda)</label><input id="l-tp" inputMode="decimal" value={String(taxas.pix).replace('.', ',')} onChange={(e) => setTaxas({ ...taxas, pix: num(e.target.value) ?? 0 })} /></div>
          <div className="ape-f"><label htmlFor="l-tc">Taxa do cartão (% + <span className="ape-keep">R$</span>)</label>
            <div className="ape-frow" style={{ gap: 6 }}>
              <input id="l-tc" inputMode="decimal" value={String(taxas.cartaoPct).replace('.', ',')} onChange={(e) => setTaxas({ ...taxas, cartaoPct: num(e.target.value) ?? 0 })} aria-label="Taxa do cartão em %" />
              <input inputMode="decimal" value={String(taxas.cartaoFixo).replace('.', ',')} onChange={(e) => setTaxas({ ...taxas, cartaoFixo: num(e.target.value) ?? 0 })} aria-label="Taxa fixa do cartão em R$" />
            </div>
          </div>
        </div>
        <span className="ape-hint">Confira as taxas no seu plano do Asaas (Minha conta → Taxas). Elas só servem para mostrar quanto sobra de cada venda.</span>
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
      toast(`Não consegui (${(e as Error).message}).`)
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
      toast(`Não consegui (${(e as Error).message}).`)
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
                  <span>{p.itens.map((i) => i.nome).join(' + ')} · baixou {p.baixados}x</span>
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
                <span>{p.itens.map((i) => i.nome).join(' + ')}</span>
                <span>{dmy(p.criado)} · <span className={`ape-pill ${p.status === 'pago' ? 'azul' : p.status === 'pendente' ? '' : 'rosa'}`}>{p.status}</span>{p.status === 'pago' && !p.cortesia ? ` · ${p.forma === 'cartao' ? 'cartão' : 'Pix'} · baixou ${p.baixados}x${dias != null && dias <= 7 ? ` · dentro dos 7 dias (${dias}d)` : ''}` : ''}</span>
                <span>{[p.email, cpfMask(p.cpf), p.tel ? fmtTel(p.tel) : '', p.aceite ? `termos ${p.aceite.versao}` : ''].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="r">
                <button className="ape-btn ghost sm" onClick={() => { void navigator.clipboard?.writeText(linkPedido(p.token)); toast('Link do pedido copiado.') }}><ApeIcon name="copy" />link</button>
                {waNum(p.tel) && (
                  <a className="ape-btn sm" href={wa(waNum(p.tel), p.status === 'pago' ? `Oi, ${firstName(p.nome)}! Obrigada pela compra no planê.apê. Seus arquivos ficam aqui: ${linkPedido(p.token)}` : `Oi, ${firstName(p.nome)}! Vi que você começou uma compra no planê.apê. Ficou alguma dúvida? O pagamento fica aqui: ${linkPedido(p.token)}`)} target="_blank" rel="noreferrer"><ApeIcon name="chat" />WhatsApp</a>
                )}
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
          return (
            <div key={c.cpf || c.email || c.pedidos[0].id} className="ape-row">
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
              </div>
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
function Testar({ produtos, pedidos, onChange }: { produtos: Produto[]; pedidos: PedidoAdmin[]; onChange: () => void }) {
  const meus = pedidos.filter((p) => p.cortesia && p.obs === 'teste da dona')
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="ape-banner">Aqui você vê tudo como cliente. O <b>acesso de teste</b> é um pedido de cortesia (sem pagar) com a página do pedido, os downloads com o seu nome no rodapé, o bônus (no 8º dia) e a plataforma do apê. Para testar o pagamento de verdade, faça uma compra pequena na loja e depois reembolse em "vendas".</div>
      <div className="ape-acts">
        <a className="ape-btn" href={href('ape', 'loja')} target="_blank" rel="noreferrer"><ApeIcon name="bag" />abrir a loja</a>
        <a className="ape-btn" href={href('ape', 'checkout')} target="_blank" rel="noreferrer"><ApeIcon name="shield" />abrir o checkout</a>
        <a className="ape-btn" href={href('ape', 'minha:demo')} target="_blank" rel="noreferrer"><ApeIcon name="phone" />demonstração da plataforma</a>
      </div>
      {meus.length > 0 && (
        <div className="ape-rows">
          {meus.map((p) => (
            <div key={p.id} className="ape-row">
              <div className="t"><b>Teste de {dmy(p.criado)}</b><span>{p.itens.map((i) => i.nome).join(' + ')}</span></div>
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
function Entregas({ produtos }: { produtos: Produto[] }) {
  const itens = [...produtos.filter((p) => p.cat === 'arquivos' || !p.cat), { id: BONUS.id, nome: `Bônus (todas as compras, no 8º dia): ${BONUS.nome}`, desc: '', preco: '', tag: '', ativo: true } as Produto]
  const [arqs, setArqs] = useState<Record<string, { nome: string; tamanho: number }[]>>({})
  const [busy, setBusy] = useState('')
  const load = useCallback(async () => {
    const out: Record<string, { nome: string; tamanho: number }[]> = {}
    for (const p of itens) out[p.id] = await loja.arquivos(p.id).catch(() => [])
    setArqs(out)
  }, [produtos])
  useEffect(() => {
    void load()
  }, [load])
  const enviar = async (id: string, files: FileList | null) => {
    if (!files?.length) return
    setBusy(id)
    try {
      for (const f of Array.from(files)) await loja.enviarArquivo(id, f)
      toast('Arquivo guardado: quem comprar recebe este.')
      await load()
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
      if (!p) {
        sem.push(f.name)
        continue
      }
      await loja.enviarArquivo(p.id, f).catch(() => sem.push(f.name))
    }
    setBusy('')
    toast(sem.length ? `Enviados, menos: ${sem.join(', ')} (o nome não bate com nenhum produto).` : 'Todos os arquivos foram guardados.')
    await load()
  }
  const apagar = async (id: string, nome: string) => {
    if (!(await ask(`Tirar o arquivo ${nome}? Quem comprar não recebe mais ele.`, { confirmLabel: 'tirar', danger: true }))) return
    await loja.apagarArquivo(id, nome).then(load, () => toast('Não consegui tirar.'))
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="ape-banner">Envie aqui o arquivo de verdade de cada produto (PDF ou planilha). Ele fica numa pasta privada: só quem pagou baixa, por um link temporário. Os PDFs saem com o nome e parte do CPF de quem comprou no rodapé. Os kits entregam os arquivos de cada item.</div>
      <label className="ape-btn" style={{ cursor: 'pointer', justifySelf: 'start' }}>
        <ApeIcon name="plus" />{busy === 'varios' ? 'enviando…' : 'enviar vários de uma vez (pelo nome do arquivo)'}
        <input type="file" hidden multiple accept=".pdf,.xlsx,.xls,application/pdf" onChange={(e) => void enviarVarios(e.target.files)} />
      </label>
      <span className="ape-hint">Ex.: "checklist.pdf" vai para o Checklist de vistoria, "planilha-compra-rosa.xlsx" para a Planilha de custos da compra (as 4 cores ficam juntas), "bonus.pdf" para o bônus.</span>
      {!apeCloud && <div className="ape-banner warn">Na prévia os arquivos não ficam guardados.</div>}
      <div className="ape-rows">
        {itens.map((p) => {
          const l = arqs[p.id] || []
          return (
            <div key={p.id} className="ape-row">
              <div className="t">
                <b>{p.nome}</b>
                {l.length ? l.map((f) => (
                  <span key={f.nome}>
                    <ApeIcon name="file" /> {f.nome} · {Math.max(1, Math.round(f.tamanho / 1024))} KB{' '}
                    <button className="ape-btn ghost sm" onClick={() => void apagar(p.id, f.nome)} aria-label={`Tirar ${f.nome}`}><ApeIcon name="trash" /></button>
                  </span>
                )) : <span style={{ color: 'var(--a-ter)' }}>sem arquivo: quem comprar não vai receber nada</span>}
              </div>
              <div className="r">
                <label className="ape-btn sm primary" style={{ cursor: 'pointer' }}>
                  <ApeIcon name="plus" />{busy === p.id ? 'enviando…' : l.length ? 'trocar / somar' : 'enviar arquivo'}
                  <input type="file" hidden accept=".pdf,.xlsx,.xls,.zip,.docx,application/pdf" onChange={(e) => void enviar(p.id, e.target.files)} />
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
