import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { DocScale } from '../components/Print'
import { toast } from '../components/dialog'
import { useStore } from '../store'
import { useAccess } from '../access'
import { go } from '../router'
import { contractSettings } from '../contracts'
import { AMBIENTES_SAN_LEVI, checklistHtml, laudoHtml, openRdlDoc, type Textos } from '../rdlDocs'
import { AMBIENTES_EXTRA, laudoDe } from '../rdlLaudo'
import { TIPOS_RECIBO, partesPagas, reciboDocHtml, type TipoRecibo } from '../rdlRecibo'
import { PLANTA_CANTO, PLANTA_CORREDOR, atualizarReserva, contratoHtml, lerConfig, listarReservas, unidade, type Reserva, type ReservaConfig } from '../rdlReserva'

/* Editor ao vivo dos documentos da RDL (igual ao painel do portfólio da Laís): campos à esquerda, a folha à direita,
   que muda enquanto digita. Salva sozinho:
   · checklist, laudo em branco e recibos → configurações da RDL (settings.rdlDocs), valem para a Laís e o Rogério;
   · laudo de um morador → na própria reserva (status.laudoDados.textos), então o laudo publicado sai igual;
   · contrato em branco → o modelo "rdl-vistoria" de contratos. O contrato assinado de um morador não muda. */

export type RdlDoc = 'checklist' | 'laudo' | 'contrato' | 'recibo'
const TITULO: Record<RdlDoc, string> = { checklist: 'checklist', laudo: 'laudo', contrato: 'contrato', recibo: 'recibo' }

type Campo = { k: string; label: string; tipo?: 'texto' | 'longo' | 'data' | 'planta' | 'ambientes' | 'contrato'; dica?: string; ph?: string }
type Grupo = { titulo: string; campos: Campo[] }

const CAPA_CHECK: Campo[] = [
  { k: 'kicker', label: 'texto pequeno acima do título', ph: 'CHECKLIST DE VISTORIA' },
  { k: 'titulo1', label: 'título (azul)', ph: 'Vistoria de' },
  { k: 'titulo2', label: 'título (laranja)', ph: 'entrega de chaves' },
  { k: 'sub', label: 'frase da capa', tipo: 'longo', ph: 'Conferência completa do apartamento novo…' },
]
const CAPA_LAUDO: Campo[] = [
  { k: 'tag', label: 'etiqueta do topo', ph: 'ENTREGA DE CHAVES · APARTAMENTO NOVO' },
  { k: 'kicker', label: 'texto pequeno acima do título', ph: 'LAUDO TÉCNICO' },
  { k: 'titulo1', label: 'título (azul)', ph: 'Relatório de' },
  { k: 'titulo2', label: 'título (laranja)', ph: 'vistoria' },
  { k: 'sub', label: 'frase da capa', tipo: 'longo', ph: 'Estado de conservação, funcionamento e acabamentos…' },
]
const DADOS: Campo[] = [
  { k: 'owner', label: 'proprietário(a)' },
  { k: 'unit', label: 'unidade (torre e apto)', ph: 'torre 2, apto 1204' },
  { k: 'date', label: 'data da vistoria', tipo: 'data' },
  { k: 'plan', label: 'planta', tipo: 'planta' },
]

function grupos(doc: RdlDoc, r?: Reserva): Grupo[] {
  if (doc === 'checklist') return [{ titulo: 'capa', campos: CAPA_CHECK }, { titulo: 'dados do apê', campos: [...DADOS, { k: 'by', label: 'feito por', ph: 'Eng. Rogério Francisco Vieira' }] }, { titulo: 'ambientes', campos: [{ k: 'rooms', label: 'folhas que entram', tipo: 'ambientes' }] }]
  if (doc === 'laudo')
    return [
      { titulo: 'capa', campos: CAPA_LAUDO },
      ...(r ? [] : [{ titulo: 'dados do apê', campos: [...DADOS, { k: 'art', label: 'nº da ART' }, { k: 'notes', label: 'observações', tipo: 'longo' as const }] }]),
    ]
  if (doc === 'recibo')
    return [
      { titulo: 'valores', campos: [{ k: 'valor', label: 'valor recebido (R$)', dica: 'vazio: o valor calculado do morador' }, { k: 'data', label: 'data do pagamento', ph: 'dd/mm/aaaa' }, { k: 'numero', label: 'nº do recibo' }] },
      { titulo: 'textos', campos: [{ k: 'titulo', label: 'título' }, { k: 'selo', label: 'selo (quadro azul)' }, { k: 'seloSub', label: 'linha do selo' }, { k: 'nota', label: 'observação', tipo: 'longo', dica: 'o trecho entre *asteriscos* sai em negrito' }] },
    ]
  return [{ titulo: 'texto do contrato', campos: [{ k: 'corpo', label: 'cláusulas', tipo: 'contrato', dica: 'as etiquetas entre chaves, como {contratante}, são preenchidas com os dados do cliente' }] }]
}

const dataBR = (iso?: string) => (iso ? iso.slice(0, 10) : '')

export function RdlDocEditor({ doc, resId, tipo: tipoIni }: { doc: RdlDoc; resId?: string; tipo?: TipoRecibo }) {
  const { data, setSettings } = useStore()
  const { isOwner } = useAccess()
  const [lista, setLista] = useState<Reserva[] | null>(null)
  const [cfg, setCfg] = useState<ReservaConfig | null>(null)
  const [sel, setSel] = useState(resId ?? '')
  const [tipo, setTipo] = useState<TipoRecibo>(tipoIni ?? 'sinal')
  const [ver, setVer] = useState<'editar' | 'folha'>('editar')
  const [salvo, setSalvo] = useState<'ok' | 'salvando' | 'erro'>('ok')
  useEffect(() => {
    void listarReservas()
      .then((l) => setLista(l.filter((x) => !x.cancelada)))
      .catch(() => setLista([]))
    void lerConfig().then(setCfg)
  }, [])
  const r = lista?.find((x) => x.id === sel)
  const cs = contractSettings(data.settings, isOwner)
  const modelo = cs.templates.find((t) => t.id === 'rdl-vistoria')

  // onde os textos ficam guardados
  const chave = doc === 'recibo' ? `recibo-${tipo}:${sel}` : `${doc}:${sel || 'branco'}`
  const guardados = useMemo<Record<string, string>>(() => {
    if (doc === 'laudo' && r) return r.status.laudoDados?.textos ?? {}
    if (doc === 'contrato') return { corpo: modelo?.body ?? '' }
    const base = doc === 'recibo' ? {} : data.settings.rdlDocs?.[doc] ?? {}
    return { ...base, ...(data.settings.rdlDocs?.[chave] ?? {}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, chave, r?.id, lista])
  const [v, setV] = useState<Record<string, string>>(guardados)
  const sujo = useRef(false)
  useEffect(() => {
    sujo.current = false
    setV(guardados)
  }, [guardados])

  // valores que vêm do morador (aparecem nos campos, dá para trocar)
  const doMorador = useMemo<Record<string, string>>(
    () => (r ? { owner: r.dados.nome, unit: unidade(r.dados), date: dataBR(r.status.data), plan: r.dados.planta ?? '', rooms: (r.status.laudoDados?.ambientes ?? AMBIENTES_SAN_LEVI).join('|') } : ({} as Record<string, string>)),
    [r],
  )
  const val = (k: string) => v[k] ?? doMorador[k] ?? ''
  const mudar = (k: string, x: string) => {
    sujo.current = true
    setV((o) => ({ ...o, [k]: x }))
  }

  // salva sozinho 0,8 s depois da última mudança
  useEffect(() => {
    if (!sujo.current) return
    setSalvo('salvando')
    const t = setTimeout(() => {
      void (async () => {
        try {
          if (doc === 'contrato') {
            if (r) return setSalvo('ok')
            setSettings({ contracts: { ...cs, templates: cs.templates.map((t2) => (t2.id === 'rdl-vistoria' ? { ...t2, body: v.corpo ?? '' } : t2)) } })
          } else if (doc === 'laudo' && r) {
            const textos = Object.fromEntries(CAPA_LAUDO.map((c) => [c.k, v[c.k] ?? '']).filter(([, x]) => x))
            const ld = { ...(r.status.laudoDados ?? { ambientes: [...AMBIENTES_SAN_LEVI], itens: [], gerais: [], testes: {}, naoVerificados: '', obs: '' }), textos }
            await atualizarReserva(r.id, { status: { ...r.status, laudoDados: ld } })
            setLista((l) => l?.map((x) => (x.id === r.id ? { ...x, status: { ...x.status, laudoDados: ld } } : x)) ?? l)
          } else {
            // capa e "feito por" valem para todos (modelo); o resto é deste morador (ou do documento em branco)
            const doModelo = new Set(['kicker', 'titulo1', 'titulo2', 'sub', 'tag', 'by'])
            const modeloV: Record<string, string> = {}
            const esteV: Record<string, string> = {}
            Object.entries(v).forEach(([k, x]) => ((doc !== 'recibo' && doModelo.has(k) ? modeloV : esteV)[k] = x))
            setSettings({ rdlDocs: { ...(data.settings.rdlDocs ?? {}), ...(doc !== 'recibo' ? { [doc]: modeloV } : {}), [chave]: esteV } })
          }
          setSalvo('ok')
        } catch {
          setSalvo('erro')
        }
      })()
    }, 800)
    return () => clearTimeout(t)
  }, [v]) // eslint-disable-line react-hooks/exhaustive-deps

  // a folha, montada de novo a cada mudança
  const html = useMemo(() => {
    const t: Textos = v
    const rooms = val('rooms') ? val('rooms').split('|').filter(Boolean) : AMBIENTES_SAN_LEVI
    if (doc === 'checklist') return checklistHtml({ owner: val('owner'), unit: val('unit'), date: val('date'), plan: val('plan'), by: val('by'), rooms, answer: undefined }, t)
    if (doc === 'laudo') {
      if (r && cfg) return laudoHtml(laudoDe(r, cfg), t)
      return laudoHtml({ owner: val('owner'), unit: val('unit'), date: val('date'), plan: val('plan'), art: val('art'), notes: val('notes') }, t)
    }
    if (doc === 'recibo') return r && cfg ? reciboDocHtml(r, cfg, tipo, t) : ''
    if (r) return contratoHtml(r)
    return contratoHtml({ id: 'modelo', status: {}, contrato: { texto: v.corpo ?? '', assinatura: '', cpf: '', em: new Date().toISOString(), codigo: '', aparelho: '', fuso: '' } }, undefined, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, v, r, cfg, tipo, doMorador])
  // a prévia acompanha a digitação sem piscar: troca o conteúdo da folha só quando para de digitar por um instante
  const [previa, setPrevia] = useState(html)
  useEffect(() => {
    const t = setTimeout(() => setPrevia(html), 180)
    return () => clearTimeout(t)
  }, [html])

  const tiposOk = (Object.keys(TIPOS_RECIBO) as TipoRecibo[]).filter((t) => !r || !cfg || t === 'sinal' || (t === 'vistoria' ? partesPagas(r, cfg).sv.vistoria : partesPagas(r, cfg).saldoR > 0))
  const largura = doc === 'recibo' ? 1128 : 794
  const restaurar = () => {
    sujo.current = true
    if (doc === 'contrato') setV({ corpo: (cs.templates === undefined ? '' : modelo?.body) ?? '' })
    else setV({})
    toast('Voltou para o texto padrão.')
  }
  const campo = (c: Campo) => {
    if (c.tipo === 'planta')
      return (
        <select value={val(c.k)} onChange={(e) => mudar(c.k, e.target.value)}>
          <option value="">as duas (em branco)</option>
          <option value={PLANTA_CANTO}>planta de canto (finais 01, 02, 11, 12)</option>
          <option value={PLANTA_CORREDOR}>planta de corredor (finais 03 a 10)</option>
        </select>
      )
    if (c.tipo === 'ambientes') {
      const atuais = val('rooms') ? val('rooms').split('|').filter(Boolean) : AMBIENTES_SAN_LEVI
      const todos = [...AMBIENTES_SAN_LEVI, ...AMBIENTES_EXTRA, ...atuais.filter((a) => !AMBIENTES_SAN_LEVI.includes(a) && !AMBIENTES_EXTRA.includes(a))]
      return (
        <div className="rde-chips">
          {todos.map((a) => {
            const on = atuais.includes(a)
            return (
              <button key={a} type="button" className={on ? 'on' : ''} onClick={() => mudar('rooms', (on ? atuais.filter((x) => x !== a) : todos.filter((x) => atuais.includes(x) || x === a)).join('|'))}>
                <Icon name={on ? 'check' : 'plus'} size={12} /> {a}
              </button>
            )
          })}
        </div>
      )
    }
    if (c.tipo === 'contrato') return <textarea className="rde-contrato" value={val(c.k)} onChange={(e) => mudar(c.k, e.target.value)} disabled={!!r} spellCheck />
    if (c.tipo === 'longo') return <textarea rows={3} value={val(c.k)} placeholder={c.ph} onChange={(e) => mudar(c.k, e.target.value)} />
    if (c.tipo === 'data') return <input type="date" value={val(c.k)} onChange={(e) => mudar(c.k, e.target.value)} />
    return <input value={val(c.k)} placeholder={c.ph} onChange={(e) => mudar(c.k, e.target.value)} />
  }

  return (
    <div className="page rde">
      <div className="rde-top">
        <button className="btn ghost small" onClick={() => go('documentos')}>
          <Icon name="chevronL" size={14} /> documentos
        </button>
        <h1>
          {TITULO[doc]} <em>ao vivo</em>
        </h1>
        <span className={`rde-salvo is-${salvo}`}>
          <i /> {salvo === 'ok' ? 'salvo' : salvo === 'salvando' ? 'salvando…' : 'não salvou: confira a internet'}
        </span>
        <div className="rde-acts">
          <button className="btn ghost small" onClick={restaurar} disabled={doc === 'contrato' && !!r}>
            <Icon name="undo" size={14} /> texto padrão
          </button>
          <button className="btn small primary" disabled={!html} onClick={() => openRdlDoc(html)}>
            <Icon name="printer" size={14} /> imprimir ou PDF
          </button>
        </div>
      </div>
      <div className="rde-seg">
        <button className={ver === 'editar' ? 'on' : ''} onClick={() => setVer('editar')}>
          <Icon name="edit" size={14} /> editar
        </button>
        <button className={ver === 'folha' ? 'on' : ''} onClick={() => setVer('folha')}>
          <Icon name="eye" size={14} /> ver a folha
        </button>
      </div>
      <div className={`rde-grid ver-${ver}`}>
        <aside className="rde-form card">
          <label className="rde-campo">
            <span>morador</span>
            <select value={sel} onChange={(e) => setSel(e.target.value)}>
              <option value="">{lista === null ? 'carregando…' : doc === 'recibo' ? 'escolha o morador' : 'em branco (sem morador)'}</option>
              {(lista ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.dados.nome.split(' ')[0]} · {unidade(x.dados)}
                </option>
              ))}
            </select>
          </label>
          {doc === 'recibo' && r && (
            <label className="rde-campo">
              <span>qual recibo</span>
              <select value={tiposOk.includes(tipo) ? tipo : 'sinal'} onChange={(e) => setTipo(e.target.value as TipoRecibo)}>
                {tiposOk.map((t) => (
                  <option key={t} value={t}>
                    recibo {TIPOS_RECIBO[t]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {doc === 'contrato' && r && <p className="rde-aviso"><Icon name="lock" size={14} /> Contrato assinado por {r.dados.nome.split(' ')[0]}: não dá para mudar o que foi assinado. Para mudar o modelo, escolha "em branco".</p>}
          {doc === 'laudo' && r && (
            <p className="rde-aviso">
              <Icon name="camera" size={14} /> Itens, fotos e testes deste laudo ficam em{' '}
              <button className="link" onClick={() => go('reservas', `laudo-${r.id}`)}>
                montar o laudo
              </button>
              . Aqui você muda a capa; o laudo publicado sai igual.
            </p>
          )}
          {doc === 'recibo' && !r ? (
            <p className="muted small">O recibo sai com os valores do morador. Escolha um acima.</p>
          ) : (
            grupos(doc, r).map((g) => (
              <section key={g.titulo} className="rde-grupo">
                <h3>{g.titulo}</h3>
                {g.campos.map((c) => (
                  <label key={c.k} className="rde-campo">
                    <span>{c.label}</span>
                    {campo(c)}
                    {c.dica && <small>{c.dica}</small>}
                  </label>
                ))}
              </section>
            ))
          )}
          <p className="muted small rde-pe">Tudo salva sozinho e vale para você e para o Rogério. A capa e o "feito por" valem para todos os documentos; nome, unidade, data e planta são deste morador.</p>
        </aside>
        <section className="rde-folha">
          {previa ? (
            <DocScale width={largura}>
              <Folha html={previa} largura={largura} />
            </DocScale>
          ) : (
            <div className="rde-vazio">
              <Icon name="wallet" size={28} />
              <span>Escolha o morador para ver o recibo</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/** A folha da prévia: o mesmo iframe o tempo todo, só o conteúdo é reescrito (não pisca nem perde a altura). */
function Folha({ html, largura }: { html: string; largura: number }) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const f = ref.current
    const d = f?.contentDocument
    if (!f || !d) return
    d.open()
    d.write(html)
    d.close()
    const ajusta = () => {
      const h = d.documentElement.scrollHeight
      if (h) f.style.height = `${h}px`
    }
    ajusta()
    const t1 = setTimeout(ajusta, 300)
    const t2 = setTimeout(ajusta, 1200) // imagens e fontes
    return () => (clearTimeout(t1), clearTimeout(t2))
  }, [html])
  return <iframe ref={ref} title="prévia" className="rde-iframe" style={{ width: largura, height: 1123 }} />
}
