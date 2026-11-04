import { useCallback, useEffect, useMemo, useState } from 'react'
import { askGemini, readFile, type Attachment } from '../components/AIChat'
import { ask, toast } from '../components/dialog'
import { href } from '../router'
import { useStore } from '../store'
import { admin, apeCloud, loja, type Ajustes, type PedidoAdmin } from './api'
import { ApeIcon } from './ApeIcon'
import {
  APE, DESCONTOS, FIELDS, LOJA_VERSAO, NICHOS, PRODUTOS, aiPrompt, blankOrcamento, brl, calc, cleanOrcamento, dmy, firstName, fmtTel, nicho, num, parseJsonReply, wa, waNum,
  CATEGORIAS, digits, ehSanLevi, ondeMora, type Categoria, type Envio, type Interesse, type Morador, type Orcamento, type Produto,
} from './model'
import './ape.css'

/* Painel do planê.apê (só a dona): orçamentos que chegaram dos moradores, leitura com IA,
   publicar/editar/ocultar, moradores cadastrados, quem quer cada compra em grupo e a loja. */

type Tab = 'recebidos' | 'novo' | 'lista' | 'moradores' | 'grupos' | 'loja' | 'pedidos' | 'entregas'
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
                ['recebidos', <>Recebidos{novos ? <em>{novos}</em> : null}</>],
                ['novo', draft && !draft.novo ? 'Editar' : 'Adicionar'],
                ['lista', `Orçamentos (${orcs.length})`],
                ['moradores', `Cadastros (${moradores.length})`],
                ['grupos', 'Compras em grupo'],
                ['loja', 'Loja'],
                ['pedidos', 'Vendas'],
                ['entregas', 'Arquivos para entregar'],
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
          {tab === 'pedidos' && <Vendas />}
          {tab === 'entregas' && ajustes && <Entregas produtos={ajustes.produtos} />}
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
  const [ver, setVer] = useState<'novo' | 'todos'>('novo')
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
  const [faixas, setFaixas] = useState((ajustes.descontos || DESCONTOS).map(([k, v]) => `${k}:${v}`).join(', '))
  const [busy, setBusy] = useState(false)
  const set = (i: number, patch: Partial<Produto>) => setPs((l) => l.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const save = async () => {
    setBusy(true)
    const descontos = faixas.split(/[,;\n]/).map((x) => x.split(/[:=x×]/).map((n) => parseInt(n, 10))).filter(([k, v]) => k > 1 && v > 0 && v < 90).sort((a, b) => a[0] - b[0]) as [number, number][]
    const a = { produtos: ps, whatsapp: whats.replace(/\D/g, ''), lojaV: LOJA_VERSAO, descontos: descontos.length ? descontos : DESCONTOS }
    try {
      await admin.salvarAjustes(a)
      onSaved(a)
      toast('Loja salva.')
    } catch (e) {
      toast(`Não consegui salvar (${(e as Error).message}).`)
    }
    setBusy(false)
  }
  return (
    <div className="ape-form">
      <div className="ape-f" style={{ maxWidth: 360 }}>
        <label htmlFor="l-whats">WhatsApp que recebe os pedidos</label>
        <input id="l-whats" inputMode="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder={fmtTel(APE.whatsapp)} />
        <span className="ape-hint">Vazio: usa o {fmtTel(APE.whatsapp)}.</span>
      </div>
      <div className="ape-f" style={{ maxWidth: 420 }}>
        <label htmlFor="l-faixas">Desconto por quantidade de arquivos (itens:%)</label>
        <input id="l-faixas" value={faixas} onChange={(e) => setFaixas(e.target.value)} placeholder="2:10, 3:15, 4:20, 6:25" />
        <span className="ape-hint">Ex.: "2:10, 3:15" = 2 arquivos têm 10% e 3 ou mais têm 15%. Os kits têm preço fixo.</span>
      </div>
      <div className="ape-banner">Os preços daqui valem também no pagamento: a cobrança é calculada no servidor com a loja salva. Depois de mudar preços, toque em "salvar loja".</div>
      {ps.map((p, i) => (
        <div key={p.id} className="ape-panel" style={{ display: 'grid', gap: 10, background: 'var(--a-bg)' }}>
          <div className="ape-frow">
            <div className="ape-f">
              <label htmlFor={`p-nome-${i}`}>Produto</label>
              <input id={`p-nome-${i}`} value={p.nome} onChange={(e) => set(i, { nome: e.target.value })} />
            </div>
            <div className="ape-f">
              <label htmlFor={`p-preco-${i}`}>Preço (vazio = sob consulta)</label>
              <input id={`p-preco-${i}`} value={p.preco} onChange={(e) => set(i, { preco: e.target.value })} placeholder="R$ 47" />
            </div>
            <div className="ape-f">
              <label htmlFor={`p-tag-${i}`}>Etiqueta</label>
              <input id={`p-tag-${i}`} value={p.tag} onChange={(e) => set(i, { tag: e.target.value })} />
            </div>
          </div>
          <div className="ape-frow">
            <div className="ape-f">
              <label htmlFor={`p-cat-${i}`}>Seção da loja</label>
              <select id={`p-cat-${i}`} value={p.cat || 'arquivos'} onChange={(e) => set(i, { cat: e.target.value as Categoria })}>
                {CATEGORIAS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
            </div>
            <div className="ape-f">
              <label htmlFor={`p-de-${i}`}>Preço "de" (riscado) ou outra opção</label>
              <input id={`p-de-${i}`} value={p.preco_de || ''} onChange={(e) => set(i, { preco_de: e.target.value })} placeholder="R$ 32,80" />
            </div>
            <div className="ape-f">
              <label htmlFor={`p-un-${i}`}>Depois do preço</label>
              <input id={`p-un-${i}`} value={p.unidade || ''} onChange={(e) => set(i, { unidade: e.target.value })} placeholder="por ano" />
            </div>
          </div>
          <div className="ape-f">
            <label htmlFor={`p-desc-${i}`}>Descrição</label>
            <textarea id={`p-desc-${i}`} style={{ minHeight: 60 }} value={p.desc} onChange={(e) => set(i, { desc: e.target.value })} />
          </div>
          <div className="ape-frow">
            <div className="ape-f">
              <label htmlFor={`p-fmt-${i}`}>Formato</label>
              <input id={`p-fmt-${i}`} value={p.formato || ''} onChange={(e) => set(i, { formato: e.target.value })} placeholder="PDF · 9 páginas" />
            </div>
            <div className="ape-f">
              <label htmlFor={`p-ent-${i}`}>Como a pessoa recebe</label>
              <input id={`p-ent-${i}`} value={p.entrega || ''} onChange={(e) => set(i, { entrega: e.target.value })} />
            </div>
          </div>
          <div className="ape-f">
            <label htmlFor={`p-it-${i}`}>O que vem (um por linha)</label>
            <textarea id={`p-it-${i}`} style={{ minHeight: 80 }} value={(p.itens || []).join('\n')} onChange={(e) => set(i, { itens: e.target.value.split('\n') })} onBlur={(e) => set(i, { itens: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
          </div>
          {(p.cat || 'arquivos') === 'combos' && (
            <div className="ape-f">
              <label>Produtos do combo</label>
              <div className="ape-acts">
                {ps.filter((x) => (x.cat || 'arquivos') !== 'combos').map((x) => (
                  <label key={x.id} className="ape-tog">
                    <input type="checkbox" checked={(p.combo || []).includes(x.id)} onChange={(e) => set(i, { combo: e.target.checked ? [...(p.combo || []), x.id] : (p.combo || []).filter((y) => y !== x.id) })} /> {x.nome}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="ape-f">
            <label htmlFor={`p-nu-${i}`}>O que tem dentro, em números (um por linha)</label>
            <textarea id={`p-nu-${i}`} style={{ minHeight: 50 }} value={(p.numeros || []).join('\n')} onChange={(e) => set(i, { numeros: e.target.value.split('\n') })} onBlur={(e) => set(i, { numeros: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} placeholder="9 páginas" />
          </div>
          <div className="ape-f">
            <label htmlFor={`p-am-${i}`}>Imagens de amostra (endereço, uma por linha)</label>
            <textarea id={`p-am-${i}`} style={{ minHeight: 50 }} value={(p.amostras || []).join('\n')} onChange={(e) => set(i, { amostras: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
            <span className="ape-hint">As amostras ficam na pasta do site (ape/amostras). Também dá para colar o endereço de uma imagem na internet.</span>
          </div>
          <div className="ape-acts">
            <label className="ape-tog">
              <input type="checkbox" checked={p.ativo} onChange={(e) => set(i, { ativo: e.target.checked })} /> Mostrar na loja
            </label>
            <label className="ape-tog">
              <input type="checkbox" checked={!!p.destaque} onChange={(e) => set(i, { destaque: e.target.checked })} /> Destaque
            </label>
            <button className="ape-btn ghost sm" onClick={() => setPs((l) => l.filter((_, j) => j !== i))}><ApeIcon name="trash" />Tirar</button>
          </div>
        </div>
      ))}
      <div className="ape-acts">
        <button className="ape-btn primary" disabled={busy} onClick={() => void save()}><ApeIcon name="check" />Salvar loja</button>
        <button className="ape-btn" onClick={() => setPs((l) => [...l, { id: 'p' + Date.now().toString(36), nome: 'Novo produto', desc: '', preco: '', tag: '', ativo: false, cat: 'arquivos' }])}>
          <ApeIcon name="plus" />Novo produto
        </button>
        <button className="ape-btn ghost" onClick={async () => { if (await ask('Trocar a loja pela sugerida (com preços e textos de exemplo)? O que você mudou aqui se perde.', { confirmLabel: 'trocar' })) setPs(PRODUTOS) }}>
          voltar para a loja sugerida
        </button>
      </div>
    </div>
  )
}

/* ===== vendas da loja ===== */
function Vendas() {
  const [ps, setPs] = useState<PedidoAdmin[] | null>(null)
  const [erro, setErro] = useState('')
  const [ver, setVer] = useState<'pago' | 'todos'>('pago')
  useEffect(() => {
    loja.pedidos().then(setPs, (e) => {
      setErro(String((e as Error).message))
      setPs([])
    })
  }, [])
  if (!ps) return <Thinking t="carregando as vendas…" />
  const pagos = ps.filter((p) => p.status === 'pago')
  const mes = new Date().toISOString().slice(0, 7)
  const doMes = pagos.filter((p) => (p.pago_em || p.criado).slice(0, 7) === mes)
  const list = ver === 'pago' ? pagos : ps
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {erro && <div className="ape-banner warn">Não consegui ler as vendas ({erro}). Confira se o arquivo supabase/atualizacao-2026-11-05-ape-loja.sql já rodou.</div>}
      {!apeCloud && <div className="ape-banner">Na prévia não há vendas de verdade.</div>}
      <div className="ape-stats">
        <div className="ape-stat"><b className="num">{brl(doMes.reduce((t, p) => t + p.total, 0))}</b><span>vendido no mês</span></div>
        <div className="ape-stat"><b className="num">{doMes.length}</b><span>vendas no mês</span></div>
        <div className="ape-stat"><b className="num">{brl(pagos.reduce((t, p) => t + p.total, 0))}</b><span>total vendido</span></div>
      </div>
      <div className="ape-toolbar">
        <p className="ape-note" style={{ margin: 0, flex: 1 }}>Quem pagou recebe os arquivos sozinho. Pedidos "pendentes" são carrinhos que abriram o pagamento e ainda não pagaram: dá para chamar no WhatsApp.</p>
        <select className="ape-sel" value={ver} onChange={(e) => setVer(e.target.value as 'pago' | 'todos')} aria-label="Mostrar">
          <option value="pago">só pagos</option>
          <option value="todos">todos</option>
        </select>
      </div>
      <div className="ape-rows">
        {!list.length && <div className="ape-empty"><b>nenhuma venda ainda</b><span>As compras pela loja aparecem aqui.</span></div>}
        {list.map((p) => (
          <div key={p.id} className="ape-row">
            <div className="t">
              <b>{p.nome} · {brl(p.total)}{p.desconto ? ` (−${brl(p.desconto)})` : ''}</b>
              <span>{p.itens.map((i) => i.nome).join(' + ')}</span>
              <span>{dmy(p.criado)} · {p.status === 'pago' ? `pago${p.forma ? ` no ${p.forma === 'cartao' ? 'cartão' : 'Pix'}` : ''} · baixou ${p.baixados}x` : p.status}{p.email ? ` · ${p.email}` : ''}</span>
            </div>
            <div className="r">
              {waNum(p.tel) && (
                <a className="ape-btn sm" href={wa(waNum(p.tel), p.status === 'pago' ? `Oi, ${firstName(p.nome)}! Obrigada pela compra na loja do apê 😊 Conseguiu baixar tudo certinho?` : `Oi, ${firstName(p.nome)}! Vi que você começou uma compra na loja do apê. Ficou alguma dúvida? Posso te ajudar 😊`)} target="_blank" rel="noreferrer">
                  <ApeIcon name="chat" />WhatsApp
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ===== arquivos que a loja entrega (pasta privada) ===== */
function Entregas({ produtos }: { produtos: Produto[] }) {
  const itens = produtos.filter((p) => p.cat === 'arquivos' || !p.cat)
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
  const apagar = async (id: string, nome: string) => {
    if (!(await ask(`Tirar o arquivo ${nome}? Quem comprar não recebe mais ele.`, { confirmLabel: 'tirar', danger: true }))) return
    await loja.apagarArquivo(id, nome).then(load, () => toast('Não consegui tirar.'))
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="ape-banner">Envie aqui o arquivo de verdade de cada produto (PDF ou planilha). Ele fica numa pasta privada: só quem pagou baixa, por um link que vale 24 horas e é refeito a cada visita à página do pedido. Os kits entregam os arquivos de cada item.</div>
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
