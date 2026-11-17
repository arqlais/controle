import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { DateInput } from '../components/DateInput'
import { Badge, Empty, Field, Modal, Section, Segmented } from '../components/ui'
import { ask, toast } from '../components/dialog'
import { newClient } from '../components/forms'
import { drawingToDataUrl } from '../components/SignaturePad'
import { newArt } from './Arts'
import { PAL } from '../palette'
import { money, today, uid, whatsappLink } from '../utils'
import {
  CONFIG_PADRAO,
  abrirContrato,
  atualizarReserva,
  avisarEmail,
  dataCurta,
  lerConfig,
  linkPainel,
  linkReserva,
  linkPainelBase,
  REFORMA_MIN,
  reformaItensTexto,
  listarConversas,
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
  `Responsabilidade técnica pela reforma: visita técnica, ART registrada no CREA e plano de reforma para o condomínio (NBR 16280)${itens.length ? `, para: ${reformaItensTexto(itens).join(', ')}` : ''}. Nada que mexa nas paredes (concreto estrutural). A execução da obra (mão de obra, materiais e prestadores) é do morador.`

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

type Filtro = 'todas' | 'sinal' | 'agendar' | 'agendadas' | 'laudo' | 'canceladas'
const FILTROS: [Filtro, string][] = [
  ['todas', 'todas'],
  ['sinal', 'aguardando sinal'],
  ['agendar', 'sem data'],
  ['agendadas', 'agendadas'],
  ['laudo', 'laudo entregue'],
  ['canceladas', 'canceladas'],
]
const etapa = (r: Reserva): [string, string] =>
  r.cancelada ? [r.status.expirada ? 'cancelada · sem sinal' : 'cancelada', PAL.mist] : r.status.laudo ? ['laudo entregue', PAL.good] : r.status.data ? [`vistoria ${dataCurta(r.status.data)}${r.status.hora ? ` ${r.status.hora}` : ''}`, PAL.good] : r.status.sinal ? ['vaga garantida · sem data', PAL.warn] : [`aguardando sinal · ${Math.max(0, 7 - Math.floor((Date.now() - new Date(r.criado).getTime()) / 864e5))} dia(s)`, PAL.bad]

export default function Reservas() {
  const { data, upsert } = useStore()
  const [list, setList] = useState<Reserva[] | null>(null)
  const [cfg, setCfg] = useState<ReservaConfig>(CONFIG_PADRAO)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<Reserva | null>(null)
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

  // cada reserva nova vira cliente no sistema (com os dados que o morador preencheu)
  useEffect(() => {
    if (!list) return
    for (const r of list) {
      if (r.cancelada || (r.status.cliente && data.clients.some((c) => c.id === r.status.cliente))) continue
      const cpf = r.dados.cpf.replace(/\D/g, '')
      const existente = data.clients.find((c) => c.document.replace(/\D/g, '') === cpf && cpf)
      const id = existente?.id ?? uid()
      if (!existente)
        upsert('clients', {
          ...newClient('final'),
          id,
          name: r.dados.nome,
          email: r.dados.email,
          phone: r.dados.tel,
          document: r.dados.cpf,
          cep: r.dados.cep ?? '',
          address: r.dados.rua ? `${r.dados.rua}, ${r.dados.bairro}` : r.dados.endereco,
          addressNumber: [r.dados.numero, r.dados.complemento].filter(Boolean).join(' '),
          city: r.dados.cidade ? `${r.dados.cidade} - ${r.dados.uf}` : '',
          origin: 'reserva pelo link',
          notes: `${cfg.empreendimento} · ${unidade(r.dados)}${r.dados.revistoria ? ' · revistoria combinada' : ''}`,
          createdAt: r.criado,
        })
      r.status = { ...r.status, cliente: id }
      void atualizarReserva(r.id, { status: r.status }).catch(() => undefined)
    }
  }, [list]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const novo = await salvarStatus(r, { sinal: today(), contratada: new Date().toISOString() }, 'Sinal confirmado: vaga garantida, contrato assinado pelas duas partes e e-mail enviado ao morador.')
    void avisarEmail('sinal', r.id)
    // ART da vistoria entra como "a emitir" no controle de ARTs
    if (!(data.arts ?? []).some((a) => a.notes.includes(r.id.slice(0, 8))))
      upsert('arts', newArt({ clientId: novo.status.cliente, clientName: r.dados.nome, service: 'vistoria de entrega de chaves', place: `${cfg.empreendimento} · ${unidade(r.dados)}`, contractValue: cfg.preco, notes: `reserva ${r.id.slice(0, 8).toUpperCase()}` }))
  }
  const marcarData = async (r: Reserva, d: string, h: string) => {
    const novo = await salvarStatus(r, { data: d, hora: h }, d ? 'Data salva no painel do morador e na agenda, e e-mail enviado.' : undefined)
    if (!d) return
    void avisarEmail('data', r.id)
    const evId = `vistoria-${r.id}`
    upsert('events', { id: evId, title: `Vistoria · ${r.dados.nome.split(' ')[0]} · ${unidade(r.dados)}`, date: d, time: h, endTime: h && toMin(h) !== null ? toHora(toMin(h)! + (cfg.duracao ?? 120)) : '', type: 'outro', customType: 'vistoria', projectId: '', clientId: novo.status.cliente, place: cfg.empreendimento, notes: `${r.dados.tel}${r.dados.revistoria ? ' · revistoria combinada' : ''}`, done: false })
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
  const sinais = ativas.filter((r) => r.status.sinal)
  const faltam = Math.max(0, (cfg.minimo || 10) - ativas.length)
  const repetidas = useMemo(() => {
    const m = new Map<string, number>()
    ativas.forEach((r) => m.set(`${r.dados.torre}|${r.dados.apto}`.toLowerCase(), (m.get(`${r.dados.torre}|${r.dados.apto}`.toLowerCase()) ?? 0) + 1))
    return m
  }, [ativas])
  const rows = (list ?? []).filter((r) => {
    if (busca && !`${r.dados.nome} ${r.dados.torre} ${r.dados.apto} ${r.dados.tel}`.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtro === 'canceladas') return r.cancelada
    if (r.cancelada) return false
    if (filtro === 'sinal') return !r.status.sinal
    if (filtro === 'agendar') return !!r.status.sinal && !r.status.data
    if (filtro === 'agendadas') return !!r.status.data && !r.status.laudo
    if (filtro === 'laudo') return !!r.status.laudo
    return true
  })
  const link = linkReserva()
  const textoGrupo = `Pessoal, as reservas da vistoria de entrega de chaves estão abertas! 🔑\n\n👥 Já são *${ativas.length} de ${cfg.minimo || 10}* apartamentos. Com ${cfg.minimo || 10}, todo mundo paga *${money(cfg.preco)}* (em vez de ${money(cfg.individual)}).\n\n✍️ É só abrir o link, preencher os dados, escolher a planta e assinar o contrato pelo celular (uns 3 minutos).\n💳 Sinal de ${money(cfg.preco / 2)} em até 7 dias garante a vaga.\n📅 Previsão da MRV: ${cfg.periodo}. Quem reserva antes escolhe o horário antes.\n\n${link}`

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

      <Section title="link de reserva">
        <div className="rsv-link">
          <code>{link}</code>
          <div className="row gap-s wrap">
            <button className="btn small" onClick={() => void navigator.clipboard?.writeText(link).then(() => toast('Link copiado.'))}>
              <Icon name="copy" size={14} /> copiar link
            </button>
            <button className="btn small ghost" onClick={() => void navigator.clipboard?.writeText(textoGrupo).then(() => toast('Mensagem copiada. É só colar no grupo.'))}>
              <Icon name="whatsapp" size={14} /> mensagem para o grupo
            </button>
            <a className="btn small ghost" href={`${linkPainelBase()}#/vistoria/teste`} target="_blank" rel="noreferrer">
              <Icon name="eye" size={14} /> testar como morador
            </a>
          </div>
          <p className="muted small">O morador preenche os dados (endereço pelo CEP), torre e apto, lê o contrato com os dados dele e assina. A reserva aparece aqui na hora, com o painel dele pronto, e cada etapa vai também por e-mail para ele. {cfg.aberta ? '' : 'As reservas estão fechadas (valores e Pix).'}</p>
        </div>
      </Section>

      <Conversas reservas={list ?? []} />

      <div className="art-stats">
        <div className="art-stat card">
          <small>reservas</small>
          <b>{ativas.length}</b>
          <span>{faltam ? `faltam ${faltam} para o grupo de ${cfg.minimo || 10} (${money(cfg.preco)})` : `grupo de ${cfg.minimo || 10} fechado`}</span>
        </div>
        <div className="art-stat card">
          <small>vagas garantidas</small>
          <b>{sinais.length}</b>
          <span>{ativas.length - sinais.length} aguardando o sinal</span>
        </div>
        <div className="art-stat card">
          <small>sinais recebidos</small>
          <b>{money(sinais.length * (cfg.preco / 2))}</b>
          <span>a receber no dia: {money(ativas.length * cfg.preco - sinais.length * (cfg.preco / 2))}</span>
        </div>
        <div className="art-stat card">
          <small>revistorias combinadas</small>
          <b>{ativas.filter((r) => r.dados.revistoria).length}</b>
          <span>{money(cfg.revistoria)} cada, pagas no dia</span>
        </div>
      </div>

      <AgendaVistorias reservas={ativas} cfg={cfg} onOpen={setAberta} />

      <div className="row gap-s wrap rsv-filters">
        <input className="rsv-search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar nome, torre, apto" />
        <Segmented<Filtro> value={filtro} onChange={setFiltro} options={FILTROS.map(([k, l]) => ({ value: k, label: l }))} />
      </div>

      {erro && <p className="muted">{erro}</p>}
      {list === null ? (
        <p className="muted">carregando…</p>
      ) : !rows.length ? (
        <Empty icon="hardhat" title={list.length ? 'nada neste filtro' : 'nenhuma reserva ainda'} text={list.length ? 'Troque o filtro para ver as outras.' : 'Mande o link de reserva no grupo do San Levi: cada morador que assinar aparece aqui.'} />
      ) : (
        <div className="rsv-list">
          {rows.map((r, i) => {
            const [t, c] = etapa(r)
            const dup = (repetidas.get(`${r.dados.torre}|${r.dados.apto}`.toLowerCase()) ?? 0) > 1
            return (
              <button key={r.id} className="rsv-row card" onClick={() => setAberta(r)}>
                <span className="rsv-n">{i + 1}</span>
                <span className="rsv-who">
                  <b>{r.dados.nome}</b>
                  <small>
                    {unidade(r.dados)} · {r.dados.tel}
                    {r.dados.revistoria ? ' · revistoria' : ''}
                    {r.status.reforma?.pedido && !r.status.reforma.valor ? ' · pediu ART de reforma' : r.status.reforma?.aprovadoEm ? ' · ART de reforma aprovada' : ''}
                  </small>
                </span>
                {dup && <Badge color={PAL.warn}>apto repetido</Badge>}
                <Badge color={c}>{t}</Badge>
                <Icon name="chevronR" size={16} />
              </button>
            )
          })}
        </div>
      )}

      {aberta && <Detalhe r={aberta} cfg={cfg} todas={list ?? []} eventos={data.events} onClose={() => setAberta(null)} onSinal={confirmarSinal} onStatus={salvarStatus} onData={marcarData} onCancelar={cancelar} />}
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

function Detalhe({
  r,
  cfg,
  todas,
  eventos,
  onClose,
  onSinal,
  onStatus,
  onData,
  onCancelar,
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
}) {
  const s = r.status
  const [d, setD] = useState(s.data ?? '')
  const [h, setH] = useState(s.hora ?? '')
  const [laudo, setLaudo] = useState(s.laudo ?? '')
  const [rev, setRev] = useState(s.revistoriaData ?? '')
  const [obs, setObs] = useState(s.obs ?? '')
  const occ = d ? ocupados(d, todas, eventos, cfg, r.id) : []
  const choque = d && toMin(h) !== null ? conflitos(toMin(h)!, occ, cfg) : []
  const sugestao = d && choque.length ? livre(occ, cfg, Math.max(8 * 60, (toMin(h) ?? 8 * 60) - 60)) || livre(occ, cfg) : ''
  const [art, setArt] = useState(s.art ?? '')
  const rf = s.reforma ?? {}
  const [rfEscopo, setRfEscopo] = useState(rf.escopo ?? '')
  const [rfValor, setRfValor] = useState(rf.valor ? String(rf.valor) : '')
  const [rfPrazo, setRfPrazo] = useState(rf.prazo ?? '')
  const [rfArt, setRfArt] = useState(rf.art ?? '')
  const msg = mensagens({ ...r, status: { ...s, data: d || s.data, hora: h || s.hora } }, cfg)
  const zap = (t: string) => window.open(whatsappLink(r.dados.tel, t), '_blank')
  const painel = linkPainel(r)
  return (
    <Modal title={`${r.dados.nome} · ${unidade(r.dados)}`} onClose={onClose} wide>
      <div className="rsv-detail">
        <div className="rsv-data">
          <div>
            <small>CPF</small>
            <b>{r.dados.cpf}</b>
          </div>
          <div>
            <small>WhatsApp</small>
            <b>{r.dados.tel}</b>
          </div>
          <div>
            <small>e-mail</small>
            <b>{r.dados.email}</b>
          </div>
          <div>
            <small>endereço atual</small>
            <b>{r.dados.endereco}</b>
          </div>
          <div>
            <small>reserva</small>
            <b>
              {new Date(r.criado).toLocaleString('pt-BR')} · nº {r.id.slice(0, 8).toUpperCase()}
            </b>
          </div>
          <div>
            <small>revistoria</small>
            <b>{r.dados.revistoria ? `combinada (${money(cfg.revistoria)})` : 'não, por enquanto'}</b>
          </div>
          <div>
            <small>planta</small>
            <b>{r.dados.planta || 'não escolheu'}</b>
          </div>
        </div>

        <div className="row gap-s wrap">
          <button className="btn small ghost" onClick={() => abrirContrato(r, r.contrato.desenho ? drawingToDataUrl(r.contrato.desenho) : undefined) || toast('Libere as janelas do navegador para abrir o contrato.')}>
            <Icon name="printer" size={14} /> contrato assinado (PDF)
          </button>
          <button className="btn small ghost" onClick={() => void navigator.clipboard?.writeText(painel).then(() => toast('Link do painel copiado.'))}>
            <Icon name="copy" size={14} /> link do painel
          </button>
          <a className="btn small ghost" href={painel} target="_blank" rel="noreferrer">
            <Icon name="eye" size={14} /> abrir painel
          </a>
        </div>

        <ol className="rsv-steps">
          <li className={s.sinal ? 'done' : 'now'}>
            <b>1 · sinal de {money(cfg.preco / 2)}</b>
            {s.sinal ? (
              <p>
                Recebido em {dataCurta(s.sinal)}.{' '}
                <button className="link small" onClick={() => void onStatus(r, { sinal: '', contratada: '' }, 'Sinal desmarcado.')}>
                  desfazer
                </button>
              </p>
            ) : (
              <div className="row gap-s wrap">
                <button className="btn small" onClick={() => void onSinal(r)}>
                  <Icon name="check" size={14} /> sinal recebido
                </button>
                <button className="btn small ghost" onClick={() => zap(msg.sinal)}>
                  <Icon name="whatsapp" size={14} /> pedir o sinal
                </button>
                <button className="btn small ghost" onClick={() => zap(msg.lembrete)}>
                  <Icon name="bell" size={14} /> lembrete
                </button>
                <button className="btn small ghost" onClick={() => void avisarEmail('lembrete', r.id).then((ok) => toast(ok ? 'Lembrete enviado por e-mail.' : 'Lembrete por e-mail já foi hoje (ou não saiu).'))}>
                  <Icon name="mail" size={14} /> lembrete por e-mail
                </button>
                <span className="muted small">A reserva cancela sozinha se o sinal não entrar em 7 dias (no 5º dia sai um lembrete automático).</span>
              </div>
            )}
            {s.sinal && (
              <button className="btn small ghost" onClick={() => zap(msg.confirmado)}>
                <Icon name="whatsapp" size={14} /> avisar que a vaga está garantida
              </button>
            )}
          </li>
          <li className={s.data ? 'done' : s.sinal ? 'now' : ''}>
            <b>2 · data da vistoria</b>
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
            <div className="row gap-s wrap">
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
                <button className="btn small ghost" onClick={() => zap(msg.data)}>
                  <Icon name="whatsapp" size={14} /> mandar a data
                </button>
              )}
            </div>
          </li>
          <li className={s.quitado ? 'done' : s.data ? 'now' : ''}>
            <b>3 · vistoria e saldo de {money(cfg.preco - cfg.preco / 2)}</b>
            <label className="row gap-s">
              <input type="checkbox" checked={!!s.quitado} onChange={(e) => void onStatus(r, { quitado: e.target.checked ? today() : '' }, e.target.checked ? 'Quitado.' : undefined)} /> vistoria feita e saldo pago
            </label>
          </li>
          <li className={s.laudo ? 'done' : s.quitado ? 'now' : ''}>
            <b>4 · laudo e ART</b>
            <p className="muted small">Cole os links dos PDFs (Google Drive, por exemplo). Eles aparecem em “seus documentos”, no painel do morador.</p>
            <div className="row gap-s wrap">
              <input className="grow" value={art} onChange={(e) => setArt(e.target.value)} placeholder="link da ART da vistoria" />
              <button className="btn small" disabled={art === (s.art ?? '')} onClick={() => void onStatus(r, { art: art.trim() }, 'ART no painel do morador.')}>
                salvar ART
              </button>
            </div>
            <div className="row gap-s wrap">
              <input className="grow" value={laudo} onChange={(e) => setLaudo(e.target.value)} placeholder="link do laudo" />
              <button className="btn small" disabled={laudo === (s.laudo ?? '')} onClick={() => void onStatus(r, { laudo: laudo.trim(), laudoEm: laudo.trim() ? today() : '' }, 'Laudo no painel do morador e e-mail enviado.').then(() => laudo.trim() && void avisarEmail('laudo', r.id))}>
                salvar
              </button>
              {s.laudo && (
                <button className="btn small ghost" onClick={() => zap(msg.laudo)}>
                  <Icon name="whatsapp" size={14} /> avisar que está pronto
                </button>
              )}
            </div>
          </li>
          {r.dados.revistoria && (
            <li className={s.revistoriaData ? 'done' : ''}>
              <b>5 · revistoria</b>
              <div className="row gap-s wrap">
                <DateInput value={rev} onChange={(e) => setRev(e.target.value)} />
                <button className="btn small" disabled={rev === (s.revistoriaData ?? '')} onClick={() => void onStatus(r, { revistoriaData: rev }, 'Revistoria salva e e-mail enviado.').then(() => rev && void avisarEmail('revistoria', r.id))}>
                  salvar
                </button>
              </div>
            </li>
          )}
        </ol>

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
              <p className="small">
                Aprovado em {dataCurta(rf.aprovadoEm)} · {money(Number(rf.valor ?? 0))}
              </p>
              <div className="row gap-s wrap">
                <input className="grow" value={rfArt} onChange={(e) => setRfArt(e.target.value)} placeholder="link da ART de reforma" />
                <button className="btn small" disabled={rfArt === (rf.art ?? '')} onClick={() => void onStatus(r, { reforma: { ...rf, art: rfArt.trim() } }, 'ART de reforma no painel do morador.')}>
                  salvar ART
                </button>
              </div>
            </>
          ) : (
            <>
              {rf.estimativa ? (
                <div className="row gap-s wrap">
                  <span className="small">
                    Estimativa da calculadora: <b>{money(Number(rf.estimativa))}</b>
                    {rf.itens?.length ? ` · ${reformaItensTexto(rf.itens).join(', ')}` : ''}
                  </span>
                  <button className="btn small ghost" onClick={() => (setRfEscopo(escopoReforma(rf.itens ?? [])), setRfValor(String(rf.estimativa)), setRfPrazo('até 5 dias úteis depois da visita técnica'))}>
                    usar a estimativa
                  </button>
                </div>
              ) : (
                <button className="btn small ghost rsv-fill" onClick={() => (setRfEscopo(escopoReforma([])), setRfValor(String(REFORMA_MIN)), setRfPrazo('até 5 dias úteis depois da visita técnica'))}>
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

/** Agenda das vistorias marcadas: por dia, com o horário de término, o respiro e os horários que se encavalam. */
function AgendaVistorias({ reservas, cfg, onOpen }: { reservas: Reserva[]; cfg: ReservaConfig; onOpen: (r: Reserva) => void }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const marcadas = reservas.filter((r) => r.status.data && r.status.data >= hoje).sort((a, b) => `${a.status.data}${a.status.hora ?? ''}`.localeCompare(`${b.status.data}${b.status.hora ?? ''}`))
  if (!marcadas.length) return null
  const dias = [...new Set(marcadas.map((r) => r.status.data!))]
  const dur = cfg.duracao ?? 120
  const folga = cfg.respiro ?? 30
  return (
    <Section title="agenda das vistorias" hint={`${dur} min de vistoria + ${folga} min de respiro. Também estão na agenda do sistema.`}>
      <div className="rsv-days">
        {dias.map((dia) => {
          const doDia = marcadas.filter((r) => r.status.data === dia)
          return (
            <div key={dia} className="rsv-day">
              <b>{new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</b>
              {doDia.map((r, i) => {
                const ini = toMin(r.status.hora)
                const ant = i > 0 ? toMin(doDia[i - 1].status.hora) : null
                const bate = ini !== null && ant !== null && ini < ant + dur + folga
                return (
                  <button key={r.id} className={`rsv-slot ${bate ? 'bad' : ''}`} onClick={() => onOpen(r)}>
                    <span>{ini !== null ? `${toHora(ini)}–${toHora(ini + dur)}` : 'sem horário'}</span>
                    <em>
                      {r.dados.nome.split(' ')[0]} · {unidade(r.dados)}
                    </em>
                    {bate && <Badge color={PAL.bad}>sem respiro</Badge>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </Section>
  )
}
