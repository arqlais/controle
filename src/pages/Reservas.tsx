import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { Badge, Empty, Field, Modal, Section } from '../components/ui'
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
  dataCurta,
  lerConfig,
  linkPainel,
  linkReserva,
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
  r.cancelada ? ['cancelada', PAL.mist] : r.status.laudo ? ['laudo entregue', PAL.good] : r.status.data ? [`vistoria ${dataCurta(r.status.data)}${r.status.hora ? ` ${r.status.hora}` : ''}`, PAL.good] : r.status.sinal ? ['vaga garantida · sem data', PAL.warn] : ['aguardando sinal', PAL.bad]

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
    const novo = await salvarStatus(r, { sinal: today(), contratada: new Date().toISOString() }, 'Sinal confirmado. A vaga está garantida e o contrato fica assinado pelas duas partes.')
    // ART da vistoria entra como "a emitir" no controle de ARTs
    if (!(data.arts ?? []).some((a) => a.notes.includes(r.id.slice(0, 8))))
      upsert('arts', newArt({ clientId: novo.status.cliente, clientName: r.dados.nome, service: 'vistoria de entrega de chaves', place: `${cfg.empreendimento} · ${unidade(r.dados)}`, contractValue: cfg.preco, notes: `reserva ${r.id.slice(0, 8).toUpperCase()}` }))
  }
  const marcarData = async (r: Reserva, d: string, h: string) => {
    const novo = await salvarStatus(r, { data: d, hora: h }, d ? 'Data salva no painel do morador e na agenda.' : undefined)
    if (!d) return
    const evId = `vistoria-${r.id}`
    upsert('events', { id: evId, title: `Vistoria · ${r.dados.nome.split(' ')[0]} · ${unidade(r.dados)}`, date: d, time: h, endTime: '', type: 'outro', customType: 'vistoria', projectId: '', clientId: novo.status.cliente, place: cfg.empreendimento, notes: `${r.dados.tel}${r.dados.revistoria ? ' · revistoria combinada' : ''}`, done: false })
  }
  const cancelar = async (r: Reserva) => {
    if (!(await ask(`Cancelar a reserva de ${r.dados.nome} (${unidade(r.dados)})? O painel dele vai mostrar que a reserva foi cancelada.`, { confirmLabel: 'Cancelar reserva' }))) return
    try {
      await atualizarReserva(r.id, { cancelada: !r.cancelada })
      void carregar()
      setAberta(null)
    } catch {
      toast('Não salvou. Tente de novo.')
    }
  }

  const ativas = (list ?? []).filter((r) => !r.cancelada)
  const sinais = ativas.filter((r) => r.status.sinal)
  const faltam = Math.max(0, 10 - ativas.length)
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
  const textoGrupo = `Pessoal, as reservas da vistoria de entrega de chaves estão abertas! 🔑\n\nÉ só abrir o link, preencher os dados (torre e apto), ler e assinar o contrato pelo celular. Na hora já aparece o painel da sua reserva.\n\n• *${money(cfg.preco)}* por apartamento, com laudo e ART\n• sinal de ${money(cfg.preco / 2)} garante a vaga\n• previsão da MRV: ${cfg.periodo}\n\n${link}`

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
            <a className="btn small ghost" href={link} target="_blank" rel="noreferrer">
              <Icon name="eye" size={14} /> ver como o morador vê
            </a>
          </div>
          <p className="muted small">O morador preenche nome, CPF, contato, torre e apto, lê o contrato com os dados dele e assina. A reserva aparece aqui na hora, com o painel dele pronto. {cfg.aberta ? '' : 'As reservas estão fechadas (valores e Pix).'}</p>
        </div>
      </Section>

      <div className="art-stats">
        <div className="art-stat card">
          <small>reservas</small>
          <b>{ativas.length}</b>
          <span>{faltam ? `faltam ${faltam} para o grupo de 10` : 'grupo de 10 fechado'}</span>
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

      <div className="row gap-s wrap rsv-filters">
        <input className="rsv-search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar nome, torre, apto" />
        {FILTROS.map(([k, l]) => (
          <button key={k} className={`chip ${filtro === k ? 'active' : ''}`} onClick={() => setFiltro(k)}>
            {l}
          </button>
        ))}
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

      {aberta && <Detalhe r={aberta} cfg={cfg} onClose={() => setAberta(null)} onSinal={confirmarSinal} onStatus={salvarStatus} onData={marcarData} onCancelar={cancelar} />}
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
  onClose,
  onSinal,
  onStatus,
  onData,
  onCancelar,
}: {
  r: Reserva
  cfg: ReservaConfig
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
            <div className="row gap-s wrap">
              <input type="date" value={d} onChange={(e) => setD(e.target.value)} />
              <input type="time" value={h} onChange={(e) => setH(e.target.value)} />
              <button className="btn small" disabled={d === (s.data ?? '') && h === (s.hora ?? '')} onClick={() => void onData(r, d, h)}>
                salvar data
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
            <p className="muted small">Cole o link do PDF do laudo (Google Drive, por exemplo). Ele aparece no painel do morador.</p>
            <div className="row gap-s wrap">
              <input className="grow" value={laudo} onChange={(e) => setLaudo(e.target.value)} placeholder="https://…" />
              <button className="btn small" disabled={laudo === (s.laudo ?? '')} onClick={() => void onStatus(r, { laudo: laudo.trim(), laudoEm: laudo.trim() ? today() : '' }, 'Laudo no painel do morador.')}>
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
                <input type="date" value={rev} onChange={(e) => setRev(e.target.value)} />
                <button className="btn small" disabled={rev === (s.revistoriaData ?? '')} onClick={() => void onStatus(r, { revistoriaData: rev }, 'Revistoria salva.')}>
                  salvar
                </button>
              </div>
            </li>
          )}
        </ol>

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
        <Field label="revistoria (R$)">
          <input type="number" min={0} value={c.revistoria} onChange={(e) => set('revistoria', Number(e.target.value) || 0)} />
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
