import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { DateInput } from '../components/DateInput'
import { Badge, Empty, Field, Modal, Section, Segmented } from '../components/ui'
import { ask, toast } from '../components/dialog'
import { contaCliente, projetoId, sincronizarRdl } from '../rdlSync'
import { LaudoEditor } from './RdlLaudo'
import { abrirContratoPdf } from '../rdlContratoPdf'
import { msgConfirmacao, msgFinal, msgReforma, partesPagas, reciboPdf, reciboPng, type TipoRecibo } from '../rdlRecibo'

const baixar = (b: Blob, nome: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
const NOME_RECIBO: Record<TipoRecibo, string> = { sinal: 'Recibo RDL', vistoria: 'Recibo de quitação RDL', reforma: 'Recibo ART de reforma RDL' }
async function baixarRecibo(r: Reserva, cfg: ReservaConfig, tipo: 'pdf' | 'png', qual: TipoRecibo = 'sinal', t: Record<string, string> = {}) {
  try {
    const png = await reciboPng(r, cfg, qual, t)
    const nome = `${NOME_RECIBO[qual]} ${unidade(r.dados)}`
    if (tipo === 'png') baixar(png, `${nome}.png`)
    else baixar(await reciboPdf(png), `${nome}.pdf`)
  } catch {
    toast('Não consegui gerar o recibo. Tente de novo.')
  }
}
/** Agradece e confirma pelo WhatsApp, com o recibo em imagem (no celular abre o compartilhar direto). */
const MSG_RECIBO: Record<TipoRecibo, (r: Reserva, cfg: ReservaConfig) => string> = { sinal: msgConfirmacao, vistoria: msgFinal, reforma: msgReforma }
async function mandarRecibo(r: Reserva, cfg: ReservaConfig, set: (v: string) => void, qual: TipoRecibo = 'sinal', t: Record<string, string> = {}) {
  set(`gerando-${qual}`)
  const texto = MSG_RECIBO[qual](r, cfg)
  try {
    const png = await reciboPng(r, cfg, qual, t)
    const file = new File([png], `${NOME_RECIBO[qual]} ${unidade(r.dados)}.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.clipboard?.writeText(texto).catch(() => undefined)
      await navigator.share({ files: [file], text: texto }).catch(() => undefined)
    } else {
      baixar(png, file.name)
      window.open(whatsappLink(r.dados.tel, texto), '_blank')
      toast('Recibo baixado: é só anexar na conversa do WhatsApp.')
    }
  } catch {
    window.open(whatsappLink(r.dados.tel, texto), '_blank')
  }
  set('')
}
import { checklistHtml, laudoHtml, openRdlDoc } from '../rdlDocs'
import { PAL } from '../palette'
import { money, today, uid, whatsappLink } from '../utils'
import {
  CONFIG_PADRAO,
  atualizarReserva,
  enderecoSanLevi,
  linkEndereco,
  pedirEnderecos,
  avisarEmail,
  enviarChavePix,
  dataCurta,
  lerConfig,
  linkPainel,
  linkReserva,
  linkPainelBase,
  REFORMA_MIN,
  reformaItensTexto,
  listarConversas,
  listarEventos,
  listarLeads,
  apagarLead,
  type Lead,
  valores,
  servicosDe,
  type Evento,
  marcarLida,
  mensagensDe,
  responderChat,
  type ChatMsg,
  type Conversa,
  listarReservas,
  mensagens,
  salvarConfig,
  unidade,
  type Reserva,
  type ReservaConfig,
  type ReservaStatus,
} from '../rdlReserva'

/* Vistorias da RDL: as reservas que chegam pelo link (useplane.com.br/vistoria) aparecem aqui sozinhas,
   com os dados do morador e o contrato assinado. Daqui a RDL confirma o sinal, marca a data, manda o laudo
   e as mensagens de cada etapa. Cada reserva vira também cliente (e ART a emitir, quando o sinal entra). */

/** Texto do que a ART de reforma cobre, a partir dos serviços marcados. */
const escopoReforma = (itens: string[]) =>
  `Responsabilidade técnica pela reforma: ART registrada no CREA e plano de reforma para o condomínio (NBR 16280)${itens.length ? `, para: ${reformaItensTexto(itens).join(', ')}` : ''}. Nada que mexa nas paredes (concreto estrutural). A execução da obra (mão de obra, materiais e prestadores) é do morador.`

/* ---------- agenda: duração + respiro, conflitos e próximo horário livre ---------- */
const HORAS = Array.from({ length: 23 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const toMin = (h?: string) => (h && /^\d{1,2}:\d{2}/.test(h) ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : null)
const toHora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
type Ocupado = { ini: number; fim: number; nome: string }
/** O que já ocupa o dia: outras vistorias marcadas e outros compromissos da agenda. */
function ocupados(dia: string, todas: Reserva[], eventos: { id: string; date: string; time: string; endTime?: string; title: string }[], cfg: ReservaConfig, menos?: string): Ocupado[] {
  const dur = cfg.duracao ?? 120
  const res = todas
    .filter((r) => !r.cancelada && r.id !== menos && r.status.data === dia && toMin(r.status.hora) !== null)
    .map((r) => ({ ini: toMin(r.status.hora)!, fim: toMin(r.status.hora)! + dur, nome: `${r.dados.nome.split(' ')[0]} · ${unidade(r.dados)}` }))
  const evs = eventos
    .filter((e) => e.date === dia && !e.id.startsWith('vistoria-') && toMin(e.time) !== null)
    .map((e) => ({ ini: toMin(e.time)!, fim: toMin(e.endTime) ?? toMin(e.time)! + 60, nome: e.title }))
  return [...res, ...evs].sort((a, b) => a.ini - b.ini)
}
/** Conflitos de um horário (já contando o respiro antes e depois). */
function conflitos(ini: number, occ: Ocupado[], cfg: ReservaConfig) {
  const fim = ini + (cfg.duracao ?? 120)
  const folga = cfg.respiro ?? 30
  return occ.filter((o) => ini < o.fim + folga && o.ini < fim + folga)
}
/** Próximo horário livre do dia, de 8h às 18h, de 30 em 30 minutos. */
function livre(occ: Ocupado[], cfg: ReservaConfig, desde = 8 * 60) {
  for (let m = desde; m + (cfg.duracao ?? 120) <= 18 * 60; m += 30) if (!conflitos(m, occ, cfg).length) return toHora(m)
  return ''
}

export default function Reservas({ id }: { id?: string }) {
  const { data, upsert } = useStore()
  const [list, setList] = useState<Reserva[] | null>(null)
  const [cfg, setCfg] = useState<ReservaConfig>(CONFIG_PADRAO)
  const [aberta, setAberta] = useState<Reserva | null>(null)
  // vindo de documentos ("montar o laudo"): abre a ficha do morador já no laudo
  const [laudoDireto, setLaudoDireto] = useState('')
  useEffect(() => {
    if (!list || !id?.startsWith('laudo-')) return
    const r = list.find((x) => x.id === id.slice(6))
    if (r) {
      setLaudoDireto(r.id)
      setAberta(r)
    }
    go('reservas') // tira o pedido do endereço (não abre de novo quando a lista atualiza)
  }, [list, id])
  const [config, setConfig] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      setList(await listarReservas())
      setErro('')
    } catch {
      setErro('Não consegui buscar as reservas agora. Confira a internet e tente de novo.')
      setList((l) => l ?? [])
    }
  }, [])
  useEffect(() => {
    void carregar()
    void lerConfig().then(setCfg)
    const t = setInterval(() => void carregar(), 60_000)
    return () => clearInterval(t)
  }, [carregar])

  // cada reserva vira cliente, serviço com parcelas (financeiro), ART a emitir e compromisso na agenda
  useEffect(() => {
    if (list) sincronizarRdl(list, data, upsert, cfg)
  }, [list, cfg]) // eslint-disable-line react-hooks/exhaustive-deps

  const salvarStatus = async (r: Reserva, patch: Partial<ReservaStatus>, aviso?: string) => {
    const status = { ...r.status, ...patch }
    for (const k of Object.keys(patch) as (keyof ReservaStatus)[]) if (patch[k] === '' || patch[k] === undefined) delete status[k]
    const novo = { ...r, status }
    setList((l) => l?.map((x) => (x.id === r.id ? novo : x)) ?? null)
    setAberta((a) => (a?.id === r.id ? novo : a))
    try {
      await atualizarReserva(r.id, { status })
      if (aviso) toast(aviso)
    } catch {
      toast('Não salvou. Confira a internet e tente de novo.')
      void carregar()
    }
    return novo
  }
  const confirmarSinal = async (r: Reserva) => {
    await salvarStatus(r, { sinal: today(), contratada: new Date().toISOString() }, 'Sinal confirmado: vaga garantida, contrato assinado pelas duas partes e e-mail enviado ao morador.')
    void avisarEmail('sinal', r.id)
  }
  const marcarData = async (r: Reserva, d: string, h: string) => {
    const novo = await salvarStatus(r, { data: d, hora: h }, d ? 'Data salva no painel do morador e na agenda, e e-mail enviado.' : undefined)
    if (!d) return
    void avisarEmail('data', r.id)
    const evId = `vistoria-${r.id}`
    upsert('events', { id: evId, title: `Vistoria · ${r.dados.nome.split(' ')[0]} · ${unidade(r.dados)}`, date: d, time: h, endTime: h && toMin(h) !== null ? toHora(toMin(h)! + (cfg.duracao ?? 120)) : '', type: 'outro', customType: 'vistoria', projectId: '', clientId: novo.status.cliente, place: cfg.empreendimento, notes: `${r.dados.tel}${r.dados.revistoria ? ' · revistoria combinada' : ''}`, done: false })
  }
  const cancelarReforma = async (r: Reserva) => {
    if (!(await ask(`Cancelar a ART de reforma de ${r.dados.nome}? O valor sai do total, do financeiro e do painel do morador. Avise o morador pelo WhatsApp.`, { confirmLabel: 'Cancelar ART de reforma' }))) return
    const dados = { ...r.dados, servicos: { ...servicosDe(r.dados), reforma: false }, reformaEstimativa: undefined }
    const status = { ...r.status, reforma: { canceladaEm: new Date().toISOString() } }
    const novo = { ...r, dados, status }
    setList((l) => l?.map((x) => (x.id === r.id ? novo : x)) ?? null)
    setAberta((a) => (a?.id === r.id ? novo : a))
    try {
      await atualizarReserva(r.id, { dados, status })
      toast('ART de reforma cancelada. O valor saiu do total e do financeiro.')
    } catch {
      toast('Não salvou. Confira a internet e tente de novo.')
      void carregar()
    }
  }
  /** Corrige o endereço atual do morador (quando ele responde o e-mail com o endereço). */
  const salvarEndereco = async (r: Reserva, endereco: string) => {
    const dados = { ...r.dados, endereco: endereco.trim(), cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }
    const novo = { ...r, dados }
    setList((l) => l?.map((x) => (x.id === r.id ? novo : x)) ?? null)
    setAberta((a) => (a?.id === r.id ? novo : a))
    try {
      await atualizarReserva(r.id, { dados })
      toast('Endereço atualizado.')
    } catch {
      toast('Não salvou. Confira a internet e tente de novo.')
      void carregar()
    }
  }
  const cancelar = async (r: Reserva) => {
    if (!(await ask(`Cancelar a reserva de ${r.dados.nome} (${unidade(r.dados)})? O painel dele vai mostrar que a reserva foi cancelada.`, { confirmLabel: 'Cancelar reserva' }))) return
    try {
      await atualizarReserva(r.id, { cancelada: !r.cancelada })
      if (!r.cancelada) void avisarEmail('cancelada', r.id)
      void carregar()
      setAberta(null)
    } catch {
      toast('Não salvou. Tente de novo.')
    }
  }

  const ativas = (list ?? []).filter((r) => !r.cancelada)
  const doGrupo = ativas.filter((r) => !r.status.cortesia && r.dados.servicos?.vistoria !== false)
  const link = linkReserva()
  const textoGrupo = `Pessoal, as reservas da vistoria de entrega de chaves estão abertas! 🔑\n\n👥 ${doGrupo.length >= (cfg.minimo || 10) ? `O grupo de ${cfg.minimo || 10} já completou!` : `Já são *${doGrupo.length} de ${cfg.minimo || 10}* apartamentos.`} Com ${cfg.minimo || 10}, todo mundo paga *${money(cfg.preco)}* (em vez de ${money(cfg.individual)}).\n\n✍️ É só abrir o link, preencher os dados, escolher a planta e assinar o contrato pelo celular (uns 3 minutos).\n💳 Sinal de ${money(cfg.preco / 2)} em até 7 dias garante a vaga.\n📅 Previsão da MRV: ${cfg.periodo}. Quem reserva antes escolhe o horário antes.\n\n${link}`

  return (
    <div className="page rsv">
      <header className="page-head">
        <div>
          <h1>vistorias</h1>
          <p className="muted">Reservas que chegam pelo link: dados do morador, contrato assinado e cada etapa até o laudo.</p>
        </div>
        <div className="row gap-s wrap">
          <button className="btn ghost" onClick={() => setConfig(true)}>
            <Icon name="settings" size={15} /> valores e Pix
          </button>
          <button className="btn ghost" onClick={() => void carregar()}>
            <Icon name="undo" size={15} /> atualizar
          </button>
        </div>
      </header>

      {erro && <p className="muted">{erro}</p>}
      {list === null ? (
        <p className="muted">carregando…</p>
      ) : !list.length ? (
        <Empty icon="hardhat" title="nenhuma reserva ainda" text="Mande o link de reserva no grupo do San Levi: cada morador que assinar aparece aqui." />
      ) : (
        <PainelVistorias lista={list} cfg={cfg} eventos={data.events} onOpen={setAberta} onData={marcarData} />
      )}

      <Section title="link de reserva">
        <div className="rsv-link">
          <code>{link}</code>
          <div className="rsv-acts">
            <button className="btn small" onClick={() => void navigator.clipboard?.writeText(link).then(() => toast('Link copiado.'))}>
              <Icon name="copy" size={14} /> copiar link
            </button>
            <button className="btn small ghost" onClick={() => void navigator.clipboard?.writeText(textoGrupo).then(() => toast('Mensagem copiada. É só colar no grupo.'))}>
              <Icon name="whatsapp" size={14} /> texto para o grupo
            </button>
            <a className="btn small ghost" href={`${linkPainelBase()}#/vistoria/teste`} target="_blank" rel="noreferrer">
              <Icon name="eye" size={14} /> ver como morador
            </a>
            <button className="btn small ghost" onClick={() => void enviarChavePix().then((l) => toast(l === null ? 'Não foi. Tente de novo.' : l.length ? `Chave Pix enviada para: ${l.join(', ')}.` : 'Todo mundo que falta pagar já recebeu a chave.'))}>
              <Icon name="mail" size={14} /> chave Pix por e-mail
            </button>
          </div>
          <p className="rsv-acts-t">modelos para imprimir</p>
          <div className="rsv-acts">
            <button className="btn small ghost" onClick={() => openRdlDoc(checklistHtml())}>
              <Icon name="printer" size={14} /> checklist em branco
            </button>
            <button className="btn small ghost" onClick={() => openRdlDoc(laudoHtml())}>
              <Icon name="file" size={14} /> laudo em branco
            </button>
          </div>
          {!cfg.aberta && <p className="muted small">As reservas estão fechadas (valores e Pix).</p>}
        </div>
      </Section>

      <Conversas reservas={list ?? []} />

      <Incompletos reservas={list ?? []} />

      <Acessos reservas={list ?? []} />

      {aberta && <Detalhe r={aberta} cfg={cfg} todas={list ?? []} eventos={data.events} onClose={() => { setAberta(null); setLaudoDireto('') }} onSinal={confirmarSinal} onStatus={salvarStatus} onData={marcarData} onCancelar={cancelar} onCancelarReforma={cancelarReforma} onEndereco={salvarEndereco} laudoDireto={laudoDireto === aberta.id} />}
      {config && (
        <Config
          cfg={cfg}
          onClose={() => setConfig(false)}
          onSave={async (c) => {
            try {
              await salvarConfig(c)
              setCfg(c)
              setConfig(false)
              toast('Salvo. A página de reserva já mostra os novos dados.')
            } catch {
              toast('Não salvou. Confira a internet e tente de novo.')
            }
          }}
        />
      )}
    </div>
  )
}

/** Etapa da ficha: a atual fica aberta; as feitas viram uma linha (abre para ver as ações). */
function Passo({ n, titulo, estado, resumo, aberto, children }: { n: number; titulo: string; estado: 'done' | 'now' | 'next'; resumo?: string; aberto?: boolean; children: React.ReactNode }) {
  if (estado === 'done')
    return (
      <li className="done">
        <details open={aberto}>
          <summary>
            <span className="rsv-n ok">
              <Icon name="check" size={13} />
            </span>
            <b>{titulo}</b>
            {resumo && <span className="rsv-res">{resumo}</span>}
          </summary>
          <div className="rsv-passo-in">{children}</div>
        </details>
      </li>
    )
  return (
    <li className={estado}>
      <div className="rsv-passo-h">
        <span className="rsv-n">{n}</span>
        <b>{titulo}</b>
      </div>
      {estado === 'now' ? <div className="rsv-passo-in">{children}</div> : <details className="rsv-depois"><summary>adiantar</summary><div className="rsv-passo-in">{children}</div></details>}
    </li>
  )
}

export function Detalhe({
  r,
  cfg,
  todas,
  eventos,
  onClose,
  onSinal,
  onStatus,
  onData,
  onCancelar,
  onCancelarReforma,
  onEndereco,
  laudoDireto,
}: {
  r: Reserva
  cfg: ReservaConfig
  todas: Reserva[]
  eventos: { id: string; date: string; time: string; endTime?: string; title: string }[]
  onClose: () => void
  onSinal: (r: Reserva) => Promise<void>
  onStatus: (r: Reserva, p: Partial<ReservaStatus>, aviso?: string) => Promise<Reserva>
  onData: (r: Reserva, d: string, h: string) => Promise<void>
  onCancelar: (r: Reserva) => Promise<void>
  onCancelarReforma: (r: Reserva) => Promise<void>
  onEndereco: (r: Reserva, endereco: string) => Promise<void>
  laudoDireto?: boolean
}) {
  const s = r.status
  const { data, upsert } = useStore()
  const conta = contaCliente(r, cfg, data.projects)
  const [cDesc, setCDesc] = useState('')
  const [cVal, setCVal] = useState('')
  const addCusto = () => {
    const p = data.projects.find((x) => x.id === projetoId(r))
    const n = Number(cVal.replace(/\./g, '').replace(',', '.'))
    if (!p) return toast('O serviço deste morador ainda está sendo criado. Tente de novo em alguns segundos.')
    if (!cDesc.trim() || !(n > 0)) return
    upsert('projects', { ...p, costs: [...(p.costs ?? []), { id: uid(), date: today(), description: cDesc.trim(), category: 'outros', amount: n }] })
    setCDesc('')
    setCVal('')
    toast('Custo lançado.')
  }
  const tiraCusto = (id: string) => {
    const p = data.projects.find((x) => x.id === projetoId(r))
    if (p) upsert('projects', { ...p, costs: (p.costs ?? []).filter((c) => c.id !== id) })
  }
  const [d, setD] = useState(s.data ?? '')
  const [h, setH] = useState(s.hora ?? '')
  const [laudo, setLaudo] = useState(s.laudo ?? '')
  const [rev, setRev] = useState(s.revistoriaData ?? '')
  const [obs, setObs] = useState(s.obs ?? '')
  const vv = valores({ ...r.dados, reformaEstimativa: r.status.reforma?.valor ?? r.dados.reformaEstimativa }, cfg)
  const occ = d ? ocupados(d, todas, eventos, cfg, r.id) : []
  const choque = d && toMin(h) !== null ? conflitos(toMin(h)!, occ, cfg) : []
  const sugestao = d && choque.length ? livre(occ, cfg, Math.max(8 * 60, (toMin(h) ?? 8 * 60) - 60)) || livre(occ, cfg) : ''
  const [art, setArt] = useState(s.art ?? '')
  const [editor, setEditor] = useState(!!laudoDireto)
  const [recibo, setRecibo] = useState('')
  const rf = s.reforma ?? {}
  const [rfEscopo, setRfEscopo] = useState(rf.escopo ?? '')
  const [rfValor, setRfValor] = useState(rf.valor ? String(rf.valor) : '')
  const [rfPrazo, setRfPrazo] = useState(rf.prazo ?? '')
  const [rfArt, setRfArt] = useState(rf.art ?? '')
  const msg = mensagens({ ...r, status: { ...s, data: d || s.data, hora: h || s.hora } }, cfg)
  const zap = (t: string) => window.open(whatsappLink(r.dados.tel, t), '_blank')
  const copiarMsg = (t: string) => void navigator.clipboard?.writeText(t).then(() => toast('Mensagem copiada. É só colar no WhatsApp.'), () => toast('Não consegui copiar.'))
  const painel = linkPainel(r)
  return (
    <Modal title={`${r.dados.nome} · ${unidade(r.dados)}`} onClose={onClose} wide>
      <div className="rsv-detail">
        <div className="rsv-top">
          <div className="rsv-top-l">
            <span className={`rsv-fase f-${faseDe(r)}`}>{r.cancelada ? 'cancelada' : FASES[ORDEM.indexOf(faseDe(r))][1]}</span>
            <span className="rdp-tags">
              {servicosDe(r.dados).vistoria && <em>vistoria</em>}
              {r.dados.revistoria && <em>revistoria combinada</em>}
              {(servicosDe(r.dados).reforma || rf.aprovadoEm) && <em className="o">ART de reforma</em>}
              {s.cortesia && <em>cortesia</em>}
            </span>
          </div>
          <dl className="rsv-money">
            <div>
              <dt>total</dt>
              <dd>{s.cortesia ? '—' : money(vv.total)}</dd>
            </div>
            <div>
              <dt>pago</dt>
              <dd>{s.cortesia ? 'cortesia' : money(pagoDe(r, cfg))}</dd>
            </div>
            <div>
              <dt>falta</dt>
              <dd>{s.cortesia ? '—' : money(Math.max(0, vv.total - pagoDe(r, cfg)))}</dd>
            </div>
          </dl>
        </div>

        <div className="rsv-contato">
          <a className="btn small" href={whatsappLink(r.dados.tel, `Oi, ${r.dados.nome.split(' ')[0]}! Aqui é o Rogério, da RDL Engenharia.`)} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" size={14} /> {r.dados.tel}
          </a>
          <a className="btn small ghost" href={`mailto:${r.dados.email}`}>
            <Icon name="mail" size={14} /> e-mail
          </a>
          <button className="btn small ghost" onClick={() => void abrirContratoPdf(r).then((ok) => ok || toast('Não foi possível gerar o PDF. Tente de novo.'))}>
            <Icon name="printer" size={14} /> contrato
          </button>
          <a className="btn small ghost" href={painel} target="_blank" rel="noreferrer">
            <Icon name="eye" size={14} /> painel
          </a>
          <button className="btn small ghost" onClick={() => void navigator.clipboard?.writeText(painel).then(() => toast('Link do painel copiado.'))} title="Copiar o link do painel">
            <Icon name="copy" size={14} /> link
          </button>
        </div>

        <details className="rsv-dados">
          <summary>dados do morador</summary>
          <dl>
            <dt>CPF</dt>
            <dd>{r.dados.cpf}</dd>
            <dt>e-mail</dt>
            <dd>{r.dados.email}</dd>
            <dt>endereço atual</dt>
            <dd>
              {r.dados.endereco}
              <EnderecoFix r={r} onSalvar={(e) => onEndereco(r, e)} />
            </dd>
            <dt>planta</dt>
            <dd>{r.dados.planta || 'não escolheu'}</dd>
            <dt>revistoria</dt>
            <dd>{r.dados.revistoria ? `combinada (${money(cfg.revistoria)}, no dia)` : 'não, por enquanto'}</dd>
            <dt>reserva</dt>
            <dd>
              nº {r.id.slice(0, 8).toUpperCase()} · {new Date(r.criado).toLocaleString('pt-BR')}
            </dd>
          </dl>
        </details>

        <ol className="rsv-steps">
          <Passo n={1} titulo={s.cortesia ? 'cortesia' : `sinal de ${money(vv.agora)} (Pix)`} estado={s.sinal || s.cortesia ? 'done' : 'now'} aberto={!!s.sinal && !s.data} resumo={s.cortesia ? 'não paga' : s.sinal ? `recebido ${dataCurta(s.sinal)} · ${money(Number(s.valorPago) || vv.agora)}` : ''}>
            {s.cortesia && <span className="muted small">Cortesia (família): não paga, não conta no grupo e não recebe cobrança.</span>}
            {s.sinal && <BotoesRecibo r={r} cfg={cfg} qual="sinal" recibo={recibo} setRecibo={setRecibo} rotulo="agradecer e mandar o recibo" />}
            {s.sinal && !s.cortesia ? (
              <label className="rsv-valor">
                <span className="muted">
                  valor que caiu na conta ·{' '}
                  <button type="button" className="link small" onClick={() => void onStatus(r, { sinal: '', contratada: '' }, 'Sinal desmarcado.')}>
                    desfazer o recebido
                  </button>
                </span>
                <span>
                  R${' '}
                  <input
                    inputMode="decimal"
                    defaultValue={s.valorPago || String(vv.agora)}
                    onBlur={(e) => {
                      const n = Number(e.target.value.replace(/\./g, '').replace(',', '.'))
                      if (n >= 0 && String(n) !== (s.valorPago || String(vv.agora))) void onStatus(r, { valorPago: String(n) }, 'Valor recebido salvo.')
                    }}
                  />
                </span>
              </label>
            ) : null}
            {s.sinal ? null : (
              <div className="row gap-s wrap">
                {s.pagoInformado && <p className="rsv-pago">O morador marcou “já paguei” em {dataCurta(s.pagoInformado.slice(0, 10))}. Confira no extrato e confirme.</p>}
                <button className="btn small" onClick={() => void onSinal(r)}>
                  <Icon name="check" size={14} /> {s.pagoInformado ? 'conferi: pagamento recebido' : 'sinal recebido'}
                </button>
                <button className="btn small ghost" onClick={() => zap(msg.sinal)}>
                  <Icon name="whatsapp" size={14} /> pedir o sinal
                </button>
                <button className="btn small ghost" onClick={() => copiarMsg(msg.sinal)} title="Copiar a mensagem">
                  <Icon name="copy" size={14} /> copiar mensagem
                </button>
                <button className="btn small ghost" onClick={() => zap(msg.lembrete)}>
                  <Icon name="bell" size={14} /> lembrete
                </button>
                <button className="btn small ghost" onClick={() => copiarMsg(msg.lembrete)} title="Copiar a mensagem">
                  <Icon name="copy" size={14} /> copiar mensagem
                </button>
                <button className="btn small ghost" onClick={() => void avisarEmail('lembrete', r.id).then((ok) => toast(ok ? 'Lembrete enviado por e-mail.' : 'Lembrete por e-mail já foi hoje (ou não saiu).'))}>
                  <Icon name="mail" size={14} /> lembrete por e-mail
                </button>
                <span className="muted small">A reserva cancela sozinha se o sinal não entrar em 7 dias (no 5º dia sai um lembrete automático).</span>
              </div>
            )}
          </Passo>
          <Passo n={2} titulo="data da vistoria" estado={s.data ? 'done' : s.sinal || s.cortesia ? 'now' : 'next'} aberto={!!s.data && !s.quitado} resumo={s.data ? `${dataCurta(s.data)}${s.hora ? ` às ${s.hora}` : ''}` : ''}>
            <p className="muted small">Previsão da MRV: {cfg.periodo}. Ao salvar, a data aparece no painel do morador e na agenda.</p>
            {d && occ.length > 0 && (
              <p className="muted small">
                Neste dia: {occ.map((o) => `${toHora(o.ini)}–${toHora(o.fim)} ${o.nome}`).join(' · ')}
              </p>
            )}
            {choque.length > 0 && (
              <p className="rsv-warn">
                <Icon name="alert" size={14} /> Bate com {choque.map((o) => `${o.nome} (${toHora(o.ini)}–${toHora(o.fim)})`).join(', ')}, contando {cfg.duracao ?? 120} min de vistoria e {cfg.respiro ?? 30} min de respiro.
                {sugestao && (
                  <button className="link small" onClick={() => setH(sugestao)}>
                    usar {sugestao}
                  </button>
                )}
              </p>
            )}
            <div className="rsv-date-row">
              <DateInput value={d} onChange={(e) => setD(e.target.value)} />
              <select value={h} onChange={(e) => setH(e.target.value)} aria-label="Horário">
                <option value="">horário</option>
                {HORAS.map((x) => {
                  const bate = d ? conflitos(toMin(x)!, occ, cfg).length > 0 : false
                  return (
                    <option key={x} value={x}>
                      {x}
                      {bate ? ' · ocupado' : ''}
                    </option>
                  )
                })}
              </select>
              <button className="btn small" disabled={(d === (s.data ?? '') && h === (s.hora ?? '')) || !d} onClick={() => void onData(r, d, h)}>
                {choque.length ? 'salvar mesmo assim' : 'salvar data'}
              </button>
              {s.data && (
                <div className="row gap-s wrap">
                <button className="btn small ghost" onClick={() => zap(msg.data)}>
                  <Icon name="whatsapp" size={14} /> mandar a data
                </button>
                <button className="btn small ghost" onClick={() => copiarMsg(msg.data)} title="Copiar a mensagem">
                  <Icon name="copy" size={14} /> copiar mensagem
                </button>
                </div>
              )}
            </div>
          </Passo>
          <Passo n={3} titulo={`vistoria e saldo de ${money(vv.vistoria - vv.sinalVistoria)}`} estado={s.quitado ? 'done' : s.data ? 'now' : 'next'} resumo={s.quitado ? `feita e paga · ${dataCurta(s.quitado)}` : ''}>
            <label className="row gap-s">
              <input type="checkbox" checked={!!s.quitado} onChange={(e) => void onStatus(r, { quitado: e.target.checked ? today() : '' }, e.target.checked ? 'Quitado.' : undefined)} /> vistoria feita e saldo pago
            </label>
            {s.quitado && !s.cortesia && (
              <>
                <p className="muted small">Mande o recibo de quitação com a mensagem pronta: agradece, lembra do laudo e pede a avaliação do serviço.</p>
                <BotoesRecibo r={r} cfg={cfg} qual="vistoria" recibo={recibo} setRecibo={setRecibo} rotulo="agradecer, pedir avaliação e mandar o recibo" />
              </>
            )}
            {s.avaliacao && (
              <p className="rsv-avaliacao">
                <span aria-label={`nota ${s.avaliacao.nota} de 5`}>{'★'.repeat(s.avaliacao.nota)}<i>{'★'.repeat(5 - s.avaliacao.nota)}</i></span>
                <span>{s.avaliacao.texto ? `“${s.avaliacao.texto}”` : 'avaliou sem comentário'} · {dataCurta(s.avaliacao.em.slice(0, 10))}</span>
              </p>
            )}
          </Passo>
          <Passo n={4} titulo="laudo e ART" estado={s.laudo ? 'done' : s.quitado || (s.data && s.data < today()) ? 'now' : 'next'} resumo={s.laudo ? `laudo publicado${s.laudoEm ? ` · ${dataCurta(s.laudoEm)}` : ''}${s.art ? ' · ART no painel' : ''}` : ''}>
            <p className="muted small">Monte o laudo aqui mesmo, pelo celular, durante a vistoria: itens, fotos e testes. Ao publicar, ele aparece no painel do morador e vai o e-mail.</p>
            <div className="row gap-s wrap">
              <button className="btn small" onClick={() => setEditor(true)}>
                <Icon name="camera" size={14} /> {s.laudoDados ? 'continuar o laudo' : 'montar o laudo com fotos'}
              </button>
              {s.laudo && (
                <a className="btn small ghost" href={s.laudo} target="_blank" rel="noreferrer">
                  <Icon name="eye" size={14} /> ver o publicado
                </a>
              )}
              {s.laudo && (
                <div className="row gap-s wrap">
                <button className="btn small ghost" onClick={() => zap(msg.laudo)}>
                  <Icon name="whatsapp" size={14} /> avisar que está pronto
                </button>
                <button className="btn small ghost" onClick={() => copiarMsg(msg.laudo)} title="Copiar a mensagem">
                  <Icon name="copy" size={14} /> copiar mensagem
                </button>
                </div>
              )}
            </div>
            <div className="row gap-s wrap">
              <input className="grow" value={art} onChange={(e) => setArt(e.target.value)} placeholder="link da ART da vistoria (PDF)" />
              <button className="btn small" disabled={art === (s.art ?? '')} onClick={() => void onStatus(r, { art: art.trim() }, 'ART no painel do morador.')}>
                salvar ART
              </button>
            </div>
            <details className="rsv-more">
              <summary>prefere mandar o laudo em PDF? cole o link</summary>
              <div className="row gap-s wrap">
                <input className="grow" value={laudo} onChange={(e) => setLaudo(e.target.value)} placeholder="link do laudo" />
                <button className="btn small" disabled={laudo === (s.laudo ?? '')} onClick={() => void onStatus(r, { laudo: laudo.trim(), laudoEm: laudo.trim() ? today() : '' }, 'Laudo no painel do morador e e-mail enviado.').then(() => laudo.trim() && void avisarEmail('laudo', r.id))}>
                  salvar
                </button>
              </div>
            </details>
            {editor && (
              <LaudoEditor
                r={r}
                cfg={cfg}
                onClose={() => setEditor(false)}
                onStatus={onStatus}
                onPublicar={(link) => {
                  const primeira = !s.laudo
                  setLaudo(link)
                  void onStatus(r, { laudo: link, laudoEm: s.laudoEm || today() }, primeira ? 'Laudo publicado no painel do morador e e-mail enviado.' : 'Laudo atualizado no painel do morador.').then(() => primeira && void avisarEmail('laudo', r.id))
                  setEditor(false)
                }}
              />
            )}
          </Passo>
          {r.dados.revistoria && (
            <Passo n={5} titulo="revistoria" estado={s.revistoriaData ? 'done' : s.laudo ? 'now' : 'next'} aberto resumo={s.revistoriaData ? dataCurta(s.revistoriaData) : ''}>
              <div className="row gap-s wrap">
                <DateInput value={rev} onChange={(e) => setRev(e.target.value)} />
                <button className="btn small" disabled={rev === (s.revistoriaData ?? '')} onClick={() => void onStatus(r, { revistoriaData: rev }, 'Revistoria salva e e-mail enviado.').then(() => rev && void avisarEmail('revistoria', r.id))}>
                  salvar
                </button>
              </div>
            </Passo>
          )}
        </ol>

        <details className="rsv-custo">
          <summary>
            <b>custo e lucro</b>
            <span>
              receita {money(conta.receita)} · custos {money(conta.custo)} · <strong>lucro {money(conta.lucro)}</strong>
            </span>
          </summary>
          <ul>
            {conta.lista.map((c) => (
              <li key={c.id}>
                <span>{c.description}</span>
                <b>{money(c.amount)}</b>
                {c.id.includes('-taxa-') ? (
                  <small className="muted">automático</small>
                ) : (
                  <button className="link small" onClick={() => tiraCusto(c.id)}>
                    tirar
                  </button>
                )}
              </li>
            ))}
            {!conta.lista.length && <li className="muted small">Sem custos ainda. A taxa da ART entra sozinha quando o sinal é confirmado.</li>}
          </ul>
          <div className="rsv-custo-add">
            <input value={cDesc} onChange={(e) => setCDesc(e.target.value)} placeholder="outro custo (ex.: Uber, estacionamento, impressão)" />
            <input inputMode="decimal" value={cVal} onChange={(e) => setCVal(e.target.value)} placeholder="R$" />
            <button className="btn small" disabled={!cDesc.trim() || !cVal} onClick={addCusto}>
              lançar
            </button>
          </div>
          <small className="muted">A taxa de cada ART segue o valor do controle de ARTs (se mudar lá, muda aqui).</small>
        </details>

        <div className="rsv-reforma card">
          <b>
            <Icon name="hardhat" size={15} /> ART de reforma
          </b>
          {!rf.pedido && !rf.valor ? (
            <p className="muted small">O morador pode pedir pelo painel. Se ele pedir, aparece aqui. Você também pode mandar um orçamento direto, preenchendo abaixo.</p>
          ) : (
            rf.pedido && (
              <p className="small">
                <b>Pedido:</b> {rf.pedido}
              </p>
            )
          )}
          {rf.aprovadoEm ? (
            <>
              <p className="rsv-auto small">
                {rf.pedidoEm && Math.abs(new Date(rf.aprovadoEm).getTime() - new Date(rf.pedidoEm).getTime()) < 120000 ? 'Contratada pelo morador na reserva, com o valor da calculadora. ' : ''}
                Confira os serviços: se algum não puder entrar na ART, cancele aqui (o valor sai do total, do financeiro e do painel).{' '}
                <button className="link small" onClick={() => void onCancelarReforma(r)}>
                  cancelar a ART de reforma
                </button>
              </p>
              <p className="small">
                Aprovado em {dataCurta(rf.aprovadoEm)} · {money(Number(rf.valor ?? 0))}
                {rf.termoAceito ? ` · termo de responsabilidade aceito em ${new Date(rf.termoAceito).toLocaleString('pt-BR')}` : ''}
                {rf.prestador ? ` · prestador: ${rf.prestador}` : ' · prestador ainda não informado'}
              </p>
              <div className="row gap-s wrap">
                <input className="grow" value={rfArt} onChange={(e) => setRfArt(e.target.value)} placeholder="link da ART de reforma" />
                <button className="btn small" disabled={rfArt === (rf.art ?? '')} onClick={() => void onStatus(r, { reforma: { ...rf, art: rfArt.trim() } }, 'ART de reforma no painel do morador.')}>
                  salvar ART
                </button>
              </div>
              {partesPagas(r, cfg).saldoR > 0 && !s.cortesia && (
                <>
                  <label className="row gap-s">
                    <input type="checkbox" checked={!!s.reformaPago} onChange={(e) => void onStatus(r, { reformaPago: e.target.checked ? today() : '' }, e.target.checked ? 'ART de reforma paga.' : undefined)} /> ART de reforma paga ({money(partesPagas(r, cfg).saldoR)}
                    {partesPagas(r, cfg).sinalR ? ', o que faltava' : ''})
                  </label>
                  {s.reformaPago && <BotoesRecibo r={r} cfg={cfg} qual="reforma" recibo={recibo} setRecibo={setRecibo} rotulo="agradecer e mandar o recibo da ART" />}
                </>
              )}
            </>
          ) : (
            <>
              {rf.estimativa ? (
                <div className="row gap-s wrap">
                  <span className="small">
                    Estimativa da calculadora: <b>{money(Number(rf.estimativa))}</b>
                    {rf.itens?.length ? ` · ${reformaItensTexto(rf.itens).join(', ')}` : ''}
                  </span>
                  <button className="btn small ghost" onClick={() => (setRfEscopo(escopoReforma(rf.itens ?? [])), setRfValor(String(rf.estimativa)), setRfPrazo('até 5 dias úteis depois das informações da obra'))}>
                    usar a estimativa
                  </button>
                </div>
              ) : (
                <button className="btn small ghost rsv-fill" onClick={() => (setRfEscopo(escopoReforma([])), setRfValor(String(REFORMA_MIN)), setRfPrazo('até 5 dias úteis depois das informações da obra'))}>
                  preencher o padrão ({money(REFORMA_MIN)})
                </button>
              )}
              <div className="form-grid">
                <Field label="o que cobre" span={2}>
                  <input value={rfEscopo} onChange={(e) => setRfEscopo(e.target.value)} placeholder="Ex.: ART da reforma (piso e marcenaria) e plano de reforma para o condomínio" />
                </Field>
                <Field label="valor">
                  <input type="number" min={0} value={rfValor} onChange={(e) => setRfValor(e.target.value)} />
                </Field>
                <Field label="prazo">
                  <input value={rfPrazo} onChange={(e) => setRfPrazo(e.target.value)} placeholder="Ex.: até 5 dias úteis" />
                </Field>
              </div>
              <div className="row gap-s wrap">
                <button
                  className="btn small"
                  disabled={!rfEscopo.trim() || !(Number(rfValor) > 0)}
                  onClick={() =>
                    void onStatus(r, { reforma: { ...rf, escopo: rfEscopo.trim(), valor: Number(rfValor), prazo: rfPrazo.trim(), enviadoEm: new Date().toISOString() } }, 'Orçamento no painel do morador e e-mail enviado.').then(() => void avisarEmail('reforma-orcamento', r.id))
                  }
                >
                  <Icon name="check" size={14} /> {rf.valor ? 'atualizar orçamento' : 'enviar orçamento'}
                </button>
                {rf.valor && <span className="muted small">aguardando o morador aprovar no painel</span>}
              </div>
            </>
          )}
        </div>

        <Field label="anotações internas (o morador não vê)">
          <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} onBlur={() => obs !== (s.obs ?? '') && void onStatus(r, { obs })} />
        </Field>
        <details className="rsv-mais">
          <summary className="muted small">mais opções</summary>
          <label className="row gap-s small">
            <input
              type="checkbox"
              checked={!!s.cortesia}
              onChange={async (e) => {
                const on = e.target.checked
                if (on && !(await ask(`Marcar ${r.dados.nome} como cortesia (família)? Não paga, não conta no grupo e não recebe cobrança.`, { confirmLabel: 'Marcar cortesia' }))) return
                void onStatus(r, { cortesia: on ? 'sim' : '' }, on ? 'Cortesia: não paga e não conta no grupo.' : 'Voltou a contar no grupo.')
              }}
            />
            cortesia (família): não paga, não conta no grupo e não recebe cobrança
          </label>
        </details>
        <div className="row between wrap gap-s">
          <button className="link small" onClick={() => void onCancelar(r)}>
            {r.cancelada ? 'reativar reserva' : 'cancelar reserva'}
          </button>
          <span className="muted small">assinado em {new Date(r.contrato.em).toLocaleString('pt-BR')} · {r.contrato.aparelho}</span>
        </div>
      </div>
    </Modal>
  )
}

function Config({ cfg, onClose, onSave }: { cfg: ReservaConfig; onClose: () => void; onSave: (c: ReservaConfig) => void }) {
  const [c, setC] = useState(cfg)
  const set = <K extends keyof ReservaConfig>(k: K, v: ReservaConfig[K]) => setC((x) => ({ ...x, [k]: v }))
  return (
    <Modal
      title="valores e Pix da reserva"
      onClose={onClose}
      footer={
        <button className="btn" onClick={() => onSave(c)}>
          salvar
        </button>
      }
    >
      <div className="form-grid">
        <Field label="empreendimento" span={2}>
          <input value={c.empreendimento} onChange={(e) => set('empreendimento', e.target.value)} />
        </Field>
        <Field label="valor por apartamento (R$)" hint="Vale para as reservas novas. Quem já assinou fica com o valor do contrato dele.">
          <input type="number" min={0} value={c.preco} onChange={(e) => set('preco', Number(e.target.value) || 0)} />
        </Field>
        <Field label="valor individual (R$)" hint="Vale se o grupo não fechar: a diferença entra no restante.">
          <input type="number" min={0} value={c.individual} onChange={(e) => set('individual', Number(e.target.value) || 0)} />
        </Field>
        <Field label="mínimo para o valor de grupo">
          <input type="number" min={1} value={c.minimo} onChange={(e) => set('minimo', Math.max(1, Number(e.target.value) || 1))} />
        </Field>
        <Field label="revistoria (R$)">
          <input type="number" min={0} value={c.revistoria} onChange={(e) => set('revistoria', Number(e.target.value) || 0)} />
        </Field>
        <Field label="duração da vistoria (min)" hint="Para a agenda e os avisos de horário.">
          <input type="number" min={30} step={15} value={c.duracao ?? 120} onChange={(e) => set('duracao', Number(e.target.value) || 120)} />
        </Field>
        <Field label="respiro entre vistorias (min)" hint="Folga para deslocamento e imprevistos.">
          <input type="number" min={0} step={5} value={c.respiro ?? 30} onChange={(e) => set('respiro', Number(e.target.value) || 0)} />
        </Field>
        <Field label="previsão das vistorias" span={2}>
          <input value={c.periodo} onChange={(e) => set('periodo', e.target.value)} />
        </Field>
        <Field label="chave Pix do sinal" hint="Aparece no painel do morador, com o Pix copia e cola no valor do sinal. Vazio: pede pelo WhatsApp.">
          <input value={c.pix} onChange={(e) => set('pix', e.target.value)} placeholder="CNPJ, celular, e-mail ou chave aleatória" />
        </Field>
        <Field label="nome no Pix">
          <input value={c.pixNome} onChange={(e) => set('pixNome', e.target.value)} />
        </Field>
        <Field label="banco">
          <input value={c.pixBanco ?? ''} onChange={(e) => set('pixBanco', e.target.value)} />
        </Field>
        <Field label="link de avaliação no Google" hint="Opcional. Quem der 4 ou 5 estrelas na avaliação da RDL vê um botão para avaliar também no Google." span={2}>
          <input value={c.avaliacaoGoogle ?? ''} onChange={(e) => set('avaliacaoGoogle', e.target.value)} placeholder="https://g.page/r/…/review" />
        </Field>
        <label className="row gap-s span2">
          <input type="checkbox" checked={c.aberta} onChange={(e) => set('aberta', e.target.checked)} /> reservas abertas no link
        </label>
      </div>
    </Modal>
  )
}

type Conv = Conversa & { ultima?: ChatMsg; naoLidas: number }
/** Chat de dúvidas: as conversas que chegam pela página de reserva e pelo painel. A Laís recebe e-mail a cada mensagem. */
function Conversas({ reservas }: { reservas: Reserva[] }) {
  const [list, setList] = useState<Conv[] | null>(null)
  const [aberta, setAberta] = useState<Conv | null>(null)
  const carregar = useCallback(() => void listarConversas().then(setList).catch(() => setList((l) => l ?? [])), [])
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 30_000)
    return () => clearInterval(t)
  }, [carregar])
  if (!list) return null
  const nao = list.reduce((n, c) => n + c.naoLidas, 0)
  const nome = (c: Conv) => c.nome || reservas.find((r) => r.id === c.reserva)?.dados.nome || c.contato
  const un = (c: Conv) => {
    const r = reservas.find((x) => x.id === c.reserva)
    return r ? unidade(r.dados) : ''
  }
  return (
    <Section title={`dúvidas (chat)${nao ? ` · ${nao} nova${nao > 1 ? 's' : ''}` : ''}`}>
      {!list.length ? (
        <p className="muted small">Nenhuma dúvida ainda. Quando alguém escrever pelo botão “Dúvidas?” da página ou do painel, a conversa aparece aqui e você recebe um e-mail.</p>
      ) : (
        <div className="rsv-list">
          {list.map((c) => (
            <button key={c.id} className="rsv-row card" onClick={() => setAberta(c)}>
              <span className="rsv-n">
                <Icon name="chat" size={14} />
              </span>
              <span className="rsv-who">
                <b>
                  {nome(c)}
                  {un(c) ? ` · ${un(c)}` : ''}
                </b>
                <small>{c.ultima ? `${c.ultima.autor === 'rdl' ? 'você: ' : ''}${c.ultima.texto.slice(0, 80)}` : 'sem mensagens'}</small>
              </span>
              {c.naoLidas > 0 && <Badge color={PAL.bad}>{c.naoLidas} nova{c.naoLidas > 1 ? 's' : ''}</Badge>}
              <Icon name="chevronR" size={16} />
            </button>
          ))}
        </div>
      )}
      {aberta && (
        <ChatModal
          c={aberta}
          titulo={`${nome(aberta)}${un(aberta) ? ` · ${un(aberta)}` : ''}`}
          onClose={() => {
            setAberta(null)
            carregar()
          }}
        />
      )}
    </Section>
  )
}

function ChatModal({ c, titulo, onClose }: { c: Conv; titulo: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let vivo = true
    const ler = () => void mensagensDe(c.id).then((m) => vivo && setMsgs(m))
    ler()
    void marcarLida(c.id)
    const t = setInterval(ler, 10_000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [c.id])
  useEffect(() => fim.current?.scrollIntoView({ block: 'end' }), [msgs])
  const enviar = async () => {
    if (!texto.trim() || busy) return
    setBusy(true)
    const ok = await responderChat(c.id, texto.trim())
    setBusy(false)
    if (!ok) return toast('Não enviou. Confira a internet e tente de novo.')
    setTexto('')
    setMsgs(await mensagensDe(c.id))
    toast('Resposta enviada. A pessoa vê na página e recebe por e-mail.')
  }
  return (
    <Modal title={titulo} onClose={onClose}>
      <div className="rsv-chat">
        <p className="muted small">Contato: {c.contato || '—'}</p>
        <div className="rsv-chat-body">
          {msgs.map((m) => (
            <div key={m.id} className={`rsv-bub ${m.autor === 'rdl' ? 'me' : ''}`}>
              {m.texto}
              <small>{new Date(m.criado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
            </div>
          ))}
          <div ref={fim} />
        </div>
        <div className="row gap-s">
          <textarea className="grow" rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva a resposta" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void enviar())} />
          <button className="btn" disabled={!texto.trim() || busy} onClick={() => void enviar()}>
            enviar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Acessos({ reservas }: { reservas: Reserva[] }) {
  const [ev, setEv] = useState<Evento[] | null>(null)
  const [dias, setDias] = useState<'7' | '30'>('30')
  useEffect(() => {
    void listarEventos(Number(dias)).then(setEv).catch(() => setEv([]))
  }, [dias])
  if (!ev) return null
  const porSessao = new Map<string, Evento[]>()
  ev.forEach((e) => porSessao.set(e.sessao, [...(porSessao.get(e.sessao) ?? []), e]))
  const sessoes = [...porSessao.values()]
  const tem = (es: Evento[], f: (e: Evento) => boolean) => es.some(f)
  const visitantes = sessoes.filter((es) => tem(es, (e) => e.evento === 'abriu')).length
  const funil: [string, number][] = [
    ['abriram a página', visitantes],
    ['viram os valores', sessoes.filter((es) => tem(es, (e) => e.evento === 'viu' && e.dados.secao === 'valores')).length],
    ['tocaram em reservar', sessoes.filter((es) => tem(es, (e) => e.evento === 'clicou' && String(e.dados.alvo).startsWith('reservar')) || tem(es, (e) => e.evento === 'etapa')).length],
    ['escolheram o serviço', sessoes.filter((es) => tem(es, (e) => e.evento === 'etapa' && e.dados.nome === 'dados')).length],
    ['chegaram ao contrato', sessoes.filter((es) => tem(es, (e) => e.evento === 'etapa' && e.dados.nome === 'contrato')).length],
    // assinaturas: conta as reservas de verdade do período (a medição de acessos começou depois das primeiras reservas)
    ['assinaram', Math.max(sessoes.filter((es) => tem(es, (e) => e.evento === 'assinou')).length, reservas.filter((r) => Date.now() - new Date(r.criado).getTime() <= Number(dias) * 864e5).length)],
  ]
  const conta = (lista: string[]) => [...lista.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
  const origens = conta(sessoes.map((es) => String(es.find((e) => e.evento === 'abriu' && e.dados.origem)?.dados.origem ?? 'sem informação')))
  const aparelhos = conta(sessoes.map((es) => String(es[0]?.dados.aparelho ?? '—')))
  // onde param: a última parte vista ou o último passo de quem não assinou
  const ondeParam = conta(
    sessoes
      .filter((es) => !tem(es, (e) => e.evento === 'assinou'))
      .map((es) => {
        const ult = [...es].reverse().find((e) => e.evento === 'etapa' || e.evento === 'viu')
        return ult ? (ult.evento === 'etapa' ? `formulário: ${ult.dados.nome}` : `leu até: ${ult.dados.secao}`) : 'só abriu'
      }),
  )
  const hoje = new Date()
  const porDia = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(hoje.getTime() - (13 - i) * 864e5).toISOString().slice(0, 10)
    return [d, new Set(ev.filter((e) => e.evento === 'abriu' && e.criado.slice(0, 10) === d).map((e) => e.sessao)).size] as [string, number]
  })
  const max = Math.max(1, ...porDia.map((x) => x[1]))
  const painel = new Set(ev.filter((e) => e.evento === 'abriu' && e.dados.pagina === 'painel').map((e) => e.sessao)).size
  return (
    <Section title="acessos" hint="Quem abre a página de reserva e o painel (sem dado pessoal: cada aparelho conta uma vez)." action={<Segmented<'7' | '30'> value={dias} onChange={setDias} options={[{ value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }]} />}>
      <div className="art-stats">
        <div className="art-stat card">
          <small>pessoas que abriram</small>
          <b>{visitantes}</b>
          <span>em {dias} dias</span>
        </div>
        <div className="art-stat card">
          <small>assinaram</small>
          <b>{funil[5][1]}</b>
          <span>{visitantes ? Math.round((funil[5][1] / visitantes) * 100) : 0}% de quem abriu</span>
        </div>
        <div className="art-stat card">
          <small>abriram o painel</small>
          <b>{painel}</b>
          <span>moradores com reserva</span>
        </div>
        <div className="art-stat card">
          <small>reservas ativas</small>
          <b>{reservas.filter((r) => !r.cancelada).length}</b>
          <span>no total</span>
        </div>
      </div>
      <details className="acs-mais">
        <summary>ver o caminho até assinar, de onde vêm e aparelhos</summary>
      <div className="acs-grid">
        <div className="card acs-box">
          <b>Caminho até assinar</b>
          <p className="muted small">Ninguém reserva sem assinar: “assinaram” conta todas as reservas do período. Os passos antes disso só aparecem para quem entrou depois que a medição de acessos começou (17/11).</p>
          {funil.map(([t, n]) => (
            <div key={t} className="acs-bar">
              <span>{t}</span>
              <i style={{ width: `${visitantes ? Math.max(4, (n / visitantes) * 100) : 0}%` }} />
              <em>{n}</em>
            </div>
          ))}
        </div>
        <div className="card acs-box">
          <b>Onde as pessoas param</b>
          {ondeParam.length ? (
            ondeParam.slice(0, 8).map(([t, n]) => (
              <div key={t} className="acs-row">
                <span>{t}</span>
                <em>{n}</em>
              </div>
            ))
          ) : (
            <p className="muted small">Ainda sem dados.</p>
          )}
        </div>
        <div className="card acs-box">
          <b>De onde vêm</b>
          {origens.slice(0, 8).map(([t, n]) => (
            <div key={t} className="acs-row">
              <span>{t}</span>
              <em>{n}</em>
            </div>
          ))}
          <p className="muted small">Dica: mande o link com ?o= no fim para saber de onde veio, por exemplo useplane.com.br/vistoria/?o=grupo-sanlevi</p>
        </div>
        <div className="card acs-box">
          <b>Aparelho</b>
          {aparelhos.map(([t, n]) => (
            <div key={t} className="acs-row">
              <span>{t}</span>
              <em>{n}</em>
            </div>
          ))}
          <b className="mt">Por dia (últimos 14)</b>
          <div className="acs-days">
            {porDia.map(([d, n]) => (
              <i key={d} title={`${d.split('-').reverse().join('/')}: ${n}`} style={{ height: `${(n / max) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
      </details>
    </Section>
  )
}

/** Quem preencheu os dados e não assinou: recebe um lembrete por e-mail (aviso diário) e a RDL pode chamar no WhatsApp. */
function Incompletos({ reservas }: { reservas: Reserva[] }) {
  const [leads, setLeads] = useState<Lead[] | null>(null)
  useEffect(() => {
    void listarLeads().then(setLeads).catch(() => setLeads([]))
  }, [])
  if (!leads) return null
  const emails = new Set(reservas.map((r) => r.dados.email.toLowerCase()))
  const abertos = leads.filter((l) => l.dados.email && !emails.has(String(l.dados.email).toLowerCase()))
  if (!abertos.length) return null
  return (
    <Section title={`começaram e não assinaram · ${abertos.length}`} hint="Preencheram os dados e pararam antes de assinar. Cada um recebe um lembrete por e-mail; aqui você pode chamar no WhatsApp.">
      <div className="rsv-list">
        {abertos.map((l) => (
          <div key={l.sessao} className="rsv-row card">
            <span className="rsv-n">
              <Icon name="user" size={14} />
            </span>
            <span className="rsv-who">
              <b>{l.dados.nome || 'sem nome'}</b>
              <small>
                {l.dados.torre ? `torre ${l.dados.torre}, ` : ''}apto {l.dados.apto} · {l.dados.tel} · {new Date(l.atualizado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {l.avisado ? ' · lembrete enviado' : ''}
              </small>
            </span>
            {l.dados.tel && (
              <a
                className="btn small ghost"
                href={whatsappLink(String(l.dados.tel), `Oi, ${String(l.dados.nome ?? '').split(' ')[0]}! Tudo bem? Vi que você começou a reserva da vistoria do San Levi e não chegou a assinar. Ficou com alguma dúvida? Posso te ajudar 😊\n${linkReserva()}`)}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="whatsapp" size={14} /> chamar
              </a>
            )}
            <button className="link small" onClick={() => void apagarLead(l.sessao).then(() => setLeads((x) => x?.filter((y) => y.sessao !== l.sessao) ?? null))}>
              tirar
            </button>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ================= painel das vistorias (dashboard: etapas, tabela e agenda do dia) ================= */

type Fase = 'sinal' | 'conferir' | 'semdata' | 'agendada' | 'laudo' | 'pronto'
const FASES: [Fase, string, string][] = [
  ['sinal', 'aguardando o sinal', 'reservou e ainda não pagou'],
  ['conferir', 'conferir pagamento', 'marcou “já paguei”'],
  ['semdata', 'vaga garantida', 'esperando a data da MRV'],
  ['agendada', 'agendada', 'data e horário marcados'],
  ['laudo', 'fazer o laudo', 'vistoria feita, falta o laudo'],
  ['pronto', 'laudo entregue', 'tudo pronto'],
]
const faseDe = (r: Reserva): Fase => {
  const s = r.status
  const hoje = new Date().toISOString().slice(0, 10)
  if (s.laudo) return 'pronto'
  if (s.data && s.data < hoje) return 'laudo'
  if (s.data) return 'agendada'
  if (s.sinal || s.cortesia) return 'semdata'
  if (s.pagoInformado) return 'conferir'
  return 'sinal'
}
/** O que entrou de fato: o valor conferido no extrato (ou o Pix pedido), mais o saldo da vistoria quando quitada. Cortesia não conta. */
const pagoDe = (r: Reserva, cfg: ReservaConfig) => {
  if (r.status.cortesia || r.cancelada) return 0
  const v = valores({ ...r.dados, reformaEstimativa: r.status.reforma?.valor ?? r.dados.reformaEstimativa }, cfg)
  const sinal = r.status.sinal ? (Number(String(r.status.valorPago ?? '').replace(',', '.')) || v.agora) : 0
  const pp = partesPagas(r, cfg)
  return sinal + (r.status.quitado ? pp.saldoV : 0) + (r.status.reformaPago ? pp.saldoR : 0)
}
const ORDEM: Fase[] = ['sinal', 'conferir', 'semdata', 'agendada', 'laudo', 'pronto']
const diasSinal = (r: Reserva) => Math.max(0, 7 - Math.floor((Date.now() - new Date(r.criado).getTime()) / 864e5))

function Progresso({ r }: { r: Reserva }) {
  const i = ORDEM.indexOf(faseDe(r))
  const passos = ['reserva', 'sinal', 'data', 'vistoria', 'laudo']
  const feitos = [true, i >= 2, i >= 3, i >= 4, i >= 5]
  return (
    <span className="rdp-prog" title={FASES[i][1]}>
      {passos.map((p, k) => (
        <i key={p} className={feitos[k] ? 'on' : ''} title={p} />
      ))}
    </span>
  )
}

export function PainelVistorias({ lista, cfg, eventos, onOpen, onData }: { lista: Reserva[]; cfg: ReservaConfig; eventos: { id: string; date: string; time: string; endTime?: string; title: string }[]; onOpen: (r: Reserva) => void; onData: (r: Reserva, d: string, h: string) => Promise<void> }) {
  const [vista, setVista] = useState<'etapas' | 'tabela' | 'agenda'>('etapas')
  const [busca, setBusca] = useState('')
  const [canceladas, setCanceladas] = useState(false)
  const ativas = lista.filter((r) => !r.cancelada)
  const projetos = useStore().data.projects
  const somaConta = ativas.reduce((t, r) => {
    const c = contaCliente(r, cfg, projetos)
    return { receita: t.receita + c.receita, custo: t.custo + c.custo, lucro: t.lucro + c.lucro }
  }, { receita: 0, custo: 0, lucro: 0 })
  const t = busca.trim().toLowerCase()
  const filtra = (l: Reserva[]) => (t ? l.filter((r) => `${r.dados.nome} ${unidade(r.dados)} ${r.dados.tel}`.toLowerCase().includes(t)) : l)
  const doGrupo = ativas.filter((r) => !r.status.cortesia && servicosDe(r.dados).vistoria)
  const recebido = ativas.reduce((n, r) => n + pagoDe(r, cfg), 0)
  const aReceber = ativas.filter((r) => !r.status.cortesia).reduce((n, r) => n + valores(r.dados, cfg).total, 0) - recebido
  const por = (f: Fase) => ativas.filter((r) => faseDe(r) === f)
  const kpis: [string, string, string, Fase | null][] = [
    ['no grupo', `${doGrupo.length}/${cfg.minimo || 10}`, (() => {
      const min = cfg.minimo || 10
      const pagos = doGrupo.filter((r) => !!r.status.sinal).length
      return pagos >= min ? `grupo fechado · ${money(cfg.preco)}` : doGrupo.length >= min ? `${pagos} de ${min} com sinal · falta${min - pagos === 1 ? '' : 'm'} ${min - pagos}` : `falta${min - doGrupo.length === 1 ? '' : 'm'} ${min - doGrupo.length} para fechar`
    })(), null],
    ['aguardando sinal', String(por('sinal').length + por('conferir').length), por('conferir').length ? `${por('conferir').length} para conferir` : 'prazo de 7 dias', 'sinal'],
    ['sem data', String(por('semdata').length), 'esperando a MRV', 'semdata'],
    ['agendadas', String(por('agendada').length), por('agendada').length ? `próxima ${dataCurta([...por('agendada')].sort((a, b) => (a.status.data! > b.status.data! ? 1 : -1))[0].status.data!)}` : 'nenhuma ainda', 'agendada'],
    ['laudos a fazer', String(por('laudo').length), 'prazo de 4 dias úteis', 'laudo'],
    ['recebido', money(recebido), `a receber ${money(aReceber)}`, null],
  ]

  const Card = ({ r }: { r: Reserva }) => {
    const sv = servicosDe(r.dados)
    const f = faseDe(r)
    return (
      <button className="rdp-card" onClick={() => onOpen(r)}>
        <b>{r.dados.nome}</b>
        <small>{unidade(r.dados)}</small>
        <small className="rdp-tel">{r.dados.tel}</small>
        <span className="rdp-tags">
          {sv.vistoria && <em>vistoria</em>}
          {r.dados.revistoria && <em>revistoria</em>}
          {(sv.reforma || r.status.reforma?.pedido) && <em className="o">ART reforma</em>}
          {r.status.cortesia && <em>cortesia</em>}
          {f === 'sinal' && <em className={diasSinal(r) <= 2 ? 'o' : ''}>sinal em {diasSinal(r)}d</em>}
          {f === 'agendada' && <em className="n">{r.status.data!.slice(8, 10)}/{r.status.data!.slice(5, 7)} {r.status.hora}</em>}
        </span>
      </button>
    )
  }

  return (
    <Section
      title="painel das vistorias"
      hint="Cada morador numa etapa. Toque para abrir, confirmar o pagamento, marcar a data ou fazer o laudo."
      action={<Segmented<'etapas' | 'tabela' | 'agenda'> value={vista} onChange={setVista} options={[{ value: 'etapas', label: 'etapas' }, { value: 'tabela', label: 'tabela' }, { value: 'agenda', label: 'agenda' }]} />}
    >
      <div className="rdp">
      <div className="rdp-kpis">
        {kpis.map(([k, v, s, f]) => (
          <div key={k} className={`rdp-kpi ${f && por(f).length && (f === 'laudo' || (f === 'sinal' && por('conferir').length)) ? 'alerta' : ''}`}>
            <small>{k}</small>
            <b>{v}</b>
            <span>{s}</span>
          </div>
        ))}
      </div>

      {vista !== 'agenda' && <input className="rsv-search rdp-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar nome, torre, apto, telefone" />}

      {vista === 'etapas' && (
        <div className="rdp-kanban">
          {FASES.map(([f, nome, sub]) => {
            const l = filtra(por(f))
            return (
              <div key={f} className={`rdp-col f-${f} ${l.length ? '' : 'vazia'}`}>
                <header>
                  <b>{nome}</b>
                  <span>{l.length}</span>
                </header>
                <small className="rdp-sub">{sub}</small>
                {l.length ? <ColunaRola>{l.map((r) => <Card key={r.id} r={r} />)}</ColunaRola> : <p className="rdp-vazio">ninguém aqui</p>}
              </div>
            )
          })}
        </div>
      )}

      {vista === 'tabela' && (
        <div className="rdp-table-wrap">
          <table className="rdp-table">
            <thead>
              <tr>
                <th>#</th>
                <th>morador</th>
                <th>serviços</th>
                <th>etapa</th>
                <th>data</th>
                <th className="r">pago</th>
                <th className="r">falta</th>
                <th className="r">lucro</th>
              </tr>
            </thead>
            <tbody>
              {filtra(canceladas ? lista : ativas).map((r, i) => {
                const v = valores(r.dados, cfg)
                const sv = servicosDe(r.dados)
                const pago = pagoDe(r, cfg)
                return (
                  <tr key={r.id} onClick={() => onOpen(r)} className={r.cancelada ? 'x' : ''}>
                    <td>{i + 1}</td>
                    <td>
                      <b>{r.dados.nome}</b>
                      <small>
                        {unidade(r.dados)} · {r.dados.tel}
                      </small>
                    </td>
                    <td>{[sv.vistoria && 'vistoria', r.dados.revistoria && 'revistoria', sv.reforma && 'ART reforma'].filter(Boolean).join(' + ')}</td>
                    <td>
                      <Progresso r={r} />
                      <small>{r.cancelada ? 'cancelada' : FASES[ORDEM.indexOf(faseDe(r))][1]}</small>
                    </td>
                    <td>{r.status.data ? `${dataCurta(r.status.data)} ${r.status.hora ?? ''}` : '—'}</td>
                    <td className="r">{r.status.cortesia ? 'cortesia' : money(pago)}</td>
                    <td className="r">{r.status.cortesia ? '—' : money(v.total - pago)}</td>
                    <td className="r">{money(contaCliente(r, cfg, projetos).lucro)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="rdp-resumo">
            receita prevista <b>{money(somaConta.receita)}</b> · custos (ARTs e outros) <b>{money(somaConta.custo)}</b> · lucro previsto <b>{money(somaConta.lucro)}</b>
          </p>
          <label className="row gap-s small muted rdp-canc">
            <input type="checkbox" checked={canceladas} onChange={(e) => setCanceladas(e.target.checked)} /> mostrar canceladas
          </label>
        </div>
      )}

      {vista === 'agenda' && <AgendaDia ativas={ativas} cfg={cfg} eventos={eventos} onOpen={onOpen} onData={onData} />}
      </div>
    </Section>
  )
}

/** Agenda do dia: horários ocupados e livres (vistoria + respiro); toque num livre para marcar quem está sem data. */
function AgendaDia({ ativas, cfg, eventos, onOpen, onData }: { ativas: Reserva[]; cfg: ReservaConfig; eventos: { id: string; date: string; time: string; endTime?: string; title: string }[]; onOpen: (r: Reserva) => void; onData: (r: Reserva, d: string, h: string) => Promise<void> }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const marcadas = ativas.filter((r) => r.status.data).sort((a, b) => `${a.status.data}${a.status.hora}`.localeCompare(`${b.status.data}${b.status.hora}`))
  const proxima = marcadas.find((r) => r.status.data! >= hoje)?.status.data ?? hoje
  const [dia, setDia] = useState(proxima)
  const [escolher, setEscolher] = useState<string | null>(null)
  const dur = cfg.duracao ?? 120
  const folga = cfg.respiro ?? 30
  const occ = ocupados(dia, ativas, eventos, cfg)
  const semData = ativas.filter((r) => !r.status.data && (r.status.sinal || r.status.cortesia) && servicosDe(r.dados).vistoria)
  const slots: { m: number; quem?: Ocupado }[] = []
  for (let m = 8 * 60; m + dur <= 18 * 60; m += 30) {
    const em = occ.find((o) => m >= o.ini && m < o.fim)
    if (em) {
      if (em.ini === m || !slots.some((x) => x.quem === em)) slots.push({ m: em.ini, quem: em })
    } else if (!conflitos(m, occ, cfg).length) slots.push({ m })
  }
  const dias = [...new Set(marcadas.filter((r) => r.status.data! >= hoje).map((r) => r.status.data!))]
  return (
    <div className="rdp-agenda">
      <div className="rdp-ag-top">
        <DateInput value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
        <span className="muted small">
          {dur} min de vistoria + {folga} min de respiro · de 8h às 18h
        </span>
      </div>
      {dias.length > 0 && (
        <div className="rdp-dias">
          {dias.map((d) => (
            <button key={d} className={d === dia ? 'on' : ''} onClick={() => setDia(d)}>
              {new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
              <em>{marcadas.filter((r) => r.status.data === d).length}</em>
            </button>
          ))}
        </div>
      )}
      <p className="rdp-leg">toque num horário livre para marcar quem já tem vaga garantida</p>
      <div className="rdp-slots">
        {slots.map((s) =>
          s.quem ? (
            <button
              key={`o${s.m}`}
              className="rdp-slot busy"
              onClick={() => {
                const r = ativas.find((x) => x.status.data === dia && toMin(x.status.hora) === s.quem!.ini)
                if (r) onOpen(r)
              }}
            >
              <span>
                {toHora(s.quem.ini)}–{toHora(s.quem.fim)}
              </span>
              <b>{s.quem.nome}</b>
            </button>
          ) : (
            <button key={`l${s.m}`} className="rdp-slot free" onClick={() => setEscolher(toHora(s.m))}>
              <span>{toHora(s.m)}</span>
            </button>
          ),
        )}
        {!slots.length && <p className="muted small">Dia cheio.</p>}
      </div>
      <p className="muted small">
        {semData.length ? `${semData.length} com vaga garantida esperando data.` : 'Ninguém esperando data agora.'} A data marcada vai para o painel do morador, para a agenda do sistema e por e-mail.
      </p>
      {escolher && (
        <Modal title={`marcar ${new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR')} às ${escolher}`} onClose={() => setEscolher(null)}>
          {semData.length ? (
            <div className="rsv-list">
              {semData.map((r) => (
                <button
                  key={r.id}
                  className="rsv-row card"
                  onClick={async () => {
                    await onData(r, dia, escolher)
                    setEscolher(null)
                  }}
                >
                  <span className="rsv-who">
                    <b>{r.dados.nome}</b>
                    <small>
                      {unidade(r.dados)} · {r.dados.tel}
                    </small>
                  </span>
                  <Icon name="chevronR" size={16} />
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Ninguém com vaga garantida esperando data. Quem ainda não pagou o sinal não aparece aqui.</p>
          )}
        </Modal>
      )}
    </div>
  )
}

/** Coluna do painel com altura limite: rola por dentro e mostra um degradê desfocado embaixo enquanto tiver mais. */
function ColunaRola({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [mais, setMais] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ver = () => setMais(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
    ver()
    el.addEventListener('scroll', ver, { passive: true })
    const ro = new ResizeObserver(ver)
    ro.observe(el)
    return () => (el.removeEventListener('scroll', ver), ro.disconnect())
  }, [children])
  return (
    <div className={`rdp-col-rola ${mais ? 'tem-mais' : ''}`}>
      <div ref={ref} className="rdp-col-lista">
        {children}
      </div>
      <span className="rdp-col-fade" aria-hidden>
        <Icon name="chevronD" size={14} />
      </span>
    </div>
  )
}

/** Botões de um recibo: mandar pelo WhatsApp (com a mensagem pronta), copiar a mensagem, PDF e imagem. */
function BotoesRecibo({ r, cfg, qual, recibo, setRecibo, rotulo }: { r: Reserva; cfg: ReservaConfig; qual: TipoRecibo; recibo: string; setRecibo: (v: string) => void; rotulo: string }) {
  const { data } = useStore()
  // o que foi mudado no editor ao vivo (documentos → recibo) vale também na imagem e no PDF
  const t = data.settings.rdlDocs?.[`recibo-${qual}:${r.id}`] ?? {}
  return (
    <div className="row gap-s wrap">
      <button className="btn small" disabled={recibo === `gerando-${qual}`} onClick={() => void mandarRecibo(r, cfg, setRecibo, qual, t)}>
        <Icon name="whatsapp" size={14} /> {recibo === `gerando-${qual}` ? 'gerando o recibo…' : rotulo}
      </button>
      <button className="btn small ghost" onClick={() => void navigator.clipboard?.writeText(MSG_RECIBO[qual](r, cfg)).then(() => toast('Mensagem copiada. É só colar no WhatsApp.'), () => toast('Não consegui copiar.'))}>
        <Icon name="copy" size={14} /> copiar mensagem
      </button>
      <button className="btn small ghost" onClick={() => void baixarRecibo(r, cfg, 'pdf', qual, t)}>
        <Icon name="file" size={14} /> recibo em PDF
      </button>
      <button className="btn small ghost" onClick={() => void baixarRecibo(r, cfg, 'png', qual, t)}>
        <Icon name="image" size={14} /> recibo em imagem
      </button>
      <button className="btn small ghost" onClick={() => go('documentos', `rdl-recibo~${r.id}~${qual}`)}>
        <Icon name="edit" size={14} /> editar ao vivo
      </button>
    </div>
  )
}

/** Endereço atual igual ao do San Levi: pede o certo por e-mail (com link para o morador corrigir) ou corrige aqui. */
function EnderecoFix({ r, onSalvar }: { r: Reserva; onSalvar: (e: string) => Promise<void> }) {
  const [editando, setEditando] = useState(false)
  const [txt, setTxt] = useState('')
  const [enviando, setEnviando] = useState(false)
  const errado = enderecoSanLevi(r.dados)
  if (!errado && !editando)
    return (
      <button className="link small" style={{ marginLeft: 8 }} onClick={() => (setTxt(r.dados.endereco), setEditando(true))}>
        corrigir
      </button>
    )
  return (
    <span className="rsv-end-fix">
      {errado && (
        <span className="rsv-end-alerta">
          <Icon name="alert" size={13} /> é o endereço do San Levi
        </span>
      )}
      {editando ? (
        <span className="row gap-s wrap">
          <input className="grow" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Rua, número, complemento - bairro, cidade - UF, CEP" autoFocus />
          <button className="btn small" disabled={txt.trim().length < 10 || enderecoSanLevi({ endereco: txt })} onClick={() => void onSalvar(txt).then(() => setEditando(false))}>
            salvar
          </button>
          <button className="btn small ghost" onClick={() => setEditando(false)}>
            cancelar
          </button>
        </span>
      ) : (
        <span className="row gap-s wrap">
          <button
            className="btn small"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true)
              const ok = await pedirEnderecos()
              setEnviando(false)
              toast(ok === null ? 'Não consegui mandar. Tente de novo.' : ok.length ? 'E-mail enviado pedindo o endereço certo, com cópia para você.' : 'Já tinha sido pedido antes (ou não tem e-mail).')
            }}
          >
            <Icon name="mail" size={14} /> {enviando ? 'mandando…' : 'pedir por e-mail'}
          </button>
          <button className="btn small ghost" onClick={() => void navigator.clipboard?.writeText(linkEndereco(r)).then(() => toast('Link para ela corrigir copiado.'))}>
            <Icon name="copy" size={14} /> link para corrigir
          </button>
          <button className="btn small ghost" onClick={() => (setTxt(''), setEditando(true))}>
            <Icon name="edit" size={14} /> corrigir aqui
          </button>
        </span>
      )}
    </span>
  )
}
