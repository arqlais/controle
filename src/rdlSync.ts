/**
 * Sistema da RDL: tudo conversa entre si.
 * Cada reserva da vistoria (e a ART de reforma junto) vira, sozinha:
 *  - cliente (com os dados no padrão),
 *  - serviço em "serviços" (a demanda), com as parcelas que alimentam o financeiro e o início,
 *  - ART "a emitir" no controle de ARTs (vistoria quando o sinal entra; reforma quando o morador aprova),
 *  - compromisso na agenda (data e horário da vistoria).
 * Roda no sistema inteiro da RDL (não só na tela de vistorias) e só grava o que mudou.
 * O que a RDL marcar à mão no financeiro (parcela paga) fica valendo.
 */
import { useEffect, useRef } from 'react'
import { useStore } from './store'
import { newClient, newProject } from './components/forms'
import { newArt } from './pages/Arts'
import { RDL_SERVICES, rdlMode } from './rdl'
import { servicesFor } from './clientDefaults'
import { addDays, today, uid } from './utils'
import { CONFIG_PADRAO, atualizarReserva, avisarEmail, dadosPadrao, lerConfig, listarReservas, servicosDe, unidade, valores, type Reserva, type ReservaConfig } from './rdlReserva'
import type { ArtRecord, CalendarEvent, Data, Payment, Project, ProjectCost } from './types'

type Upsert = ReturnType<typeof useStore>['upsert']

const dia = (s?: string) => (s ? s.slice(0, 10) : '')
const num = (s?: string) => Number(String(s ?? '').replace(',', '.')) || 0
const tag = (r: Reserva) => `reserva ${r.id.slice(0, 8).toUpperCase()}`
export const projetoId = (r: Reserva) => `rdl-${r.id}`

/** Valores com o preço da ART de reforma que a RDL mandou (quando houver). */
export const valoresDe = (r: Reserva, cfg: ReservaConfig) => valores({ ...r.dados, reformaEstimativa: r.status.reforma?.valor ?? r.dados.reformaEstimativa }, cfg)

function parcelas(r: Reserva, cfg: ReservaConfig, antigo?: Project): Payment[] {
  if (r.status.cortesia) return []
  const v = valoresDe(r, cfg)
  const sv = servicosDe(r.dados)
  const pid = projetoId(r)
  const criado = dia(r.criado) || today()
  const sinalPago = num(r.status.valorPago) || v.agora
  const out: Payment[] = [{ id: `${pid}-sinal`, description: 'sinal (Pix)', amount: sinalPago, dueDate: addDays(criado, 7), paidDate: dia(r.status.sinal) || null, method: 'pix', on: 'fechamento' }]
  const venc = r.status.data || addDays(criado, 45)
  // o sinal paga primeiro a metade da vistoria; o que passar disso abate da ART de reforma
  const pagoV = sv.vistoria ? Math.min(sinalPago, v.sinalVistoria) : 0
  const pagoR = Math.max(0, sinalPago - pagoV)
  const restV = sv.vistoria ? Math.max(0, v.vistoria - pagoV) : 0
  const restR = Math.max(0, v.reforma - pagoR)
  if (restV > 0) out.push({ id: `${pid}-saldo`, description: 'saldo da vistoria (no dia)', amount: restV, dueDate: venc, paidDate: dia(r.status.quitado) || null, method: 'pix', on: 'conclusao' })
  if (restR > 0) out.push({ id: `${pid}-art`, description: pagoR ? 'saldo da ART de reforma (na entrega)' : 'ART de reforma', amount: restR, dueDate: addDays(dia(r.status.reforma?.aprovadoEm) || criado, 30), paidDate: null, method: 'pix', on: 'conclusao' })
  // o que a RDL marcou como pago no financeiro continua pago
  return out.map((p) => {
    const old = antigo?.payments.find((x) => x.id === p.id)
    return old?.paidDate && !p.paidDate ? { ...p, paidDate: old.paidDate, method: old.method || p.method } : p
  })
}

export const TAXA_ART = 108.39
/** Custos de cada cliente: a taxa de cada ART (vistoria e reforma, pelo valor do controle de ARTs) + o que a RDL lançar à mão. */
function custos(r: Reserva, antigo: Project | undefined, arts: ArtRecord[]): ProjectCost[] {
  const pid = projetoId(r)
  const manuais = (antigo?.costs ?? []).filter((c) => !c.id.startsWith(`${pid}-taxa-`))
  const out: ProjectCost[] = []
  const taxa = (tipo: 'vistoria' | 'reforma') => arts.find((a) => a.id === `art-${r.id}-${tipo}`)?.fee ?? TAXA_ART
  if (servicosDe(r.dados).vistoria && (r.status.sinal || r.status.cortesia)) out.push({ id: `${pid}-taxa-vistoria`, date: dia(r.status.sinal) || dia(r.criado), description: 'taxa da ART da vistoria (CREA)', category: 'ART', amount: taxa('vistoria') })
  if (r.status.reforma?.aprovadoEm && !r.status.reforma.canceladaEm) out.push({ id: `${pid}-taxa-reforma`, date: dia(r.status.reforma.aprovadoEm), description: 'taxa da ART de reforma (CREA)', category: 'ART', amount: taxa('reforma') })
  return [...out, ...manuais]
}
/** Receita, custos e lucro previstos de um cliente (custos já lançados no serviço dele). */
export function contaCliente(r: Reserva, cfg: ReservaConfig, projetos: Project[]) {
  const v = valoresDe(r, cfg)
  const receita = r.status.cortesia || r.cancelada ? 0 : v.total
  const lista = projetos.find((x) => x.id === projetoId(r))?.costs ?? []
  const custo = lista.reduce((t, c) => t + (c.amount || 0), 0)
  return { receita, custo, lucro: receita - custo, lista }
}

function statusDe(r: Reserva): Project['status'] {
  if (r.cancelada) return 'cancelado'
  const s = r.status
  const hoje = today()
  const sv = servicosDe(r.dados)
  if (sv.vistoria ? s.laudo : s.reforma?.art) return 'entregue'
  if (s.data && s.data < hoje) return 'aguardando' // vistoria feita: falta o laudo
  if (s.data) return 'revisao' // agendada
  if (s.sinal || s.cortesia) return sv.vistoria ? 'producao' : 'aguardando' // ART sozinha: falta emitir
  return 'briefing'
}

function projetoDe(r: Reserva, cfg: ReservaConfig, clientId: string, antigo: Project | undefined, arts: ArtRecord[]): Project {
  const sv = servicosDe(r.dados)
  const v = valoresDe(r, cfg)
  const nomes = [sv.vistoria && 'Vistoria de entrega', (sv.reforma || r.status.reforma?.aprovadoEm) && 'ART de reforma'].filter(Boolean).join(' + ')
  const base = antigo ?? { ...newProject(clientId), id: projetoId(r), createdAt: dia(r.criado) || today() }
  const itensR = (r.status.reforma?.itens ?? r.dados.reformaItens ?? []).join(', ')
  return {
    ...base,
    clientId,
    title: `${nomes || 'Vistoria'} · ${unidade(r.dados)}`,
    service: sv.vistoria ? 'eng-vistoria' : 'eng-art-reforma',
    description: [`${cfg.empreendimento} · ${unidade(r.dados)}`, sv.vistoria && r.dados.revistoria ? `revistoria combinada (${cfg.revistoria ? `R$ ${cfg.revistoria}` : ''} no dia)` : '', itensR ? `ART de reforma: ${itensR}` : '', r.status.cortesia ? 'cortesia (família)' : '', tag(r)].filter(Boolean).join('\n'),
    status: statusDe(r),
    startDate: dia(r.criado) || base.startDate,
    dueDate: r.status.data || base.dueDate,
    deliveredDate: dia(r.status.laudoEm) || (r.status.laudo ? base.deliveredDate ?? today() : null),
    value: r.status.cortesia ? 0 : v.total,
    discount: 0,
    payments: parcelas(r, cfg, antigo),
    costs: custos(r, antigo, arts),
    noPhone: true,
  }
}

const confirmados = new Set<string>()
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Liga cada reserva ao resto do sistema. Seguro de chamar várias vezes: só grava diferenças. */
export function sincronizarRdl(list: Reserva[], data: Data, upsert: Upsert, cfg: ReservaConfig) {
  for (const r of list) {
    // 1. cliente
    let clienteId = r.status.cliente
    const ligado = clienteId ? data.clients.find((c) => c.id === clienteId) : undefined
    const p = dadosPadrao(r.dados)
    if (ligado && ligado.origin === 'reserva pelo link' && (ligado.name !== p.nome || ligado.email !== p.email || ligado.phone !== p.tel || ligado.document !== p.cpf)) upsert('clients', { ...ligado, name: p.nome, email: p.email, phone: p.tel, document: p.cpf })
    if (!ligado && !r.cancelada) {
      const cpf = r.dados.cpf.replace(/\D/g, '')
      const existente = cpf ? data.clients.find((c) => c.document.replace(/\D/g, '') === cpf) : undefined
      clienteId = existente?.id ?? uid()
      if (!existente)
        upsert('clients', {
          ...newClient('final'),
          id: clienteId,
          name: p.nome,
          email: p.email,
          phone: p.tel,
          document: p.cpf,
          cep: r.dados.cep ?? '',
          address: r.dados.rua ? `${r.dados.rua}, ${r.dados.bairro}` : r.dados.endereco,
          addressNumber: [r.dados.numero, r.dados.complemento].filter(Boolean).join(' '),
          city: r.dados.cidade ? `${r.dados.cidade} - ${r.dados.uf}` : '',
          origin: 'reserva pelo link',
          notes: `${cfg.empreendimento} · ${unidade(r.dados)}${r.dados.revistoria ? ' · revistoria combinada' : ''}`,
          createdAt: r.criado,
        })
      r.status = { ...r.status, cliente: clienteId }
      void atualizarReserva(r.id, { status: r.status }).catch(() => undefined)
    }
    if (!clienteId) continue

    // 2. serviço + parcelas (financeiro): nasce quando a reserva está ativa; acompanha até cancelar
    const antigo = data.projects.find((x) => x.id === projetoId(r))
    // sinal marcado como pago no financeiro: confirma a reserva (vaga garantida, contrato assinado pela RDL e e-mail ao morador)
    const sinalPago = antigo?.payments.find((x) => x.id === `${projetoId(r)}-sinal`)?.paidDate
    if (sinalPago && !r.status.sinal && !r.cancelada && !r.status.cortesia && !confirmados.has(r.id)) {
      confirmados.add(r.id)
      r.status = { ...r.status, sinal: sinalPago, contratada: new Date().toISOString() }
      void atualizarReserva(r.id, { status: r.status })
        .then(() => avisarEmail('sinal', r.id))
        .catch(() => confirmados.delete(r.id))
    }
    // saldo da vistoria marcado como pago no financeiro: a reserva também fica "vistoria feita e saldo pago"
    const saldoPago = antigo?.payments.find((x) => x.id === `${projetoId(r)}-saldo`)?.paidDate
    if (saldoPago && !r.status.quitado && !r.cancelada) {
      r.status = { ...r.status, quitado: saldoPago }
      void atualizarReserva(r.id, { status: r.status }).catch(() => undefined)
    }
    if (antigo || !r.cancelada) {
      const novo = projetoDe(r, cfg, clienteId, antigo, data.arts ?? [])
      if (!antigo || !igual(novo, antigo)) upsert('projects', novo)
    }
    if (r.cancelada) continue

    // 3. ARTs a emitir
    const v = valoresDe(r, cfg)
    const arts = data.arts ?? []
    const temArt = (servico: RegExp) => arts.some((a) => (a.id.startsWith(`art-${r.id}`) || a.notes.includes(tag(r))) && servico.test(a.service))
    const lugar = `${cfg.empreendimento.replace(/\s*\(.*\)/, '')} · ${unidade(r.dados)}`
    if (servicosDe(r.dados).vistoria && (r.status.sinal || r.status.cortesia) && !temArt(/vistoria/i) && !arts.some((a) => a.notes.includes(r.id.slice(0, 8).toUpperCase()) && !/reforma/i.test(a.service)))
      upsert('arts', newArt({ id: `art-${r.id}-vistoria`, clientId: clienteId, clientName: p.nome, service: 'vistoria de entrega de chaves', place: lugar, contractValue: r.status.cortesia ? 0 : v.vistoria, notes: tag(r) }))
    // ART de reforma cancelada pela RDL: a ART fica "baixada" no controle
    if (r.status.reforma?.canceladaEm)
      for (const a of arts.filter((x) => (x.id === `art-${r.id}-reforma` || x.notes.includes(tag(r))) && /reforma/i.test(x.service) && x.status !== 'baixada'))
        upsert('arts', { ...a, status: 'baixada', notes: a.notes.includes('cancelada') ? a.notes : `${a.notes} · ART de reforma cancelada` })
    if (r.status.reforma?.aprovadoEm && !temArt(/reforma/i))
      upsert('arts', newArt({ id: `art-${r.id}-reforma`, clientId: clienteId, clientName: p.nome, service: 'ART de reforma + plano de reforma', place: lugar, contractValue: v.reforma, notes: `${tag(r)}${r.status.reforma.escopo ? ` · ${r.status.reforma.escopo}` : ''}` }))

    // 4. agenda
    if (r.status.data) {
      const id = `vistoria-${r.id}`
      const ev = data.events.find((e) => e.id === id)
      const fim = (h?: string) => {
        const m = /^(\d{1,2}):(\d{2})/.exec(h ?? '')
        if (!m) return ''
        const t = Number(m[1]) * 60 + Number(m[2]) + (cfg.duracao ?? 120)
        return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
      }
      if (!ev || ev.date !== r.status.data || ev.time !== (r.status.hora ?? '')) {
        const novo: CalendarEvent = {
          ...(ev ?? { id, type: 'outro', customType: 'vistoria', notes: '', done: false }),
          id,
          title: `Vistoria · ${p.nome.split(' ')[0]} · ${unidade(r.dados)}`,
          date: r.status.data,
          time: r.status.hora ?? '',
          endTime: fim(r.status.hora),
          projectId: projetoId(r),
          clientId: clienteId,
          place: cfg.empreendimento,
          notes: `${p.tel}${r.dados.revistoria ? ' · revistoria combinada' : ''}`,
        } as CalendarEvent
        upsert('events', novo)
      }
    }
  }
}

/** No sistema da RDL: busca as reservas de tempos em tempos e mantém tudo ligado (qualquer tela). */
export function useRdlSync() {
  const { data, upsert, sync, isSample, setSettings } = useStore()
  // tabela de serviços da RDL: só engenharia (sai a tabela de design de interiores que veio junto no começo)
  useEffect(() => {
    if (!rdlMode() || isSample || sync === 'loading' || data.settings.rdlServicosV2) return
    const design = new Set(servicesFor('final').map((x) => x.id))
    const proprios = data.settings.services.filter((x) => !design.has(x.id) && !RDL_SERVICES.some((r) => r.id === x.id))
    setSettings({ services: [...RDL_SERVICES.map((r) => data.settings.services.find((x) => x.id === r.id) ?? r), ...proprios], rdlServicosV2: true })
  }, [sync, isSample, data.settings.rdlServicosV2]) // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef({ data, upsert })
  ref.current = { data, upsert }
  const pronto = rdlMode() && !isSample && sync !== 'loading'
  useEffect(() => {
    if (!pronto) return
    let vivo = true
    let cfg: ReservaConfig = CONFIG_PADRAO
    const rodar = async () => {
      try {
        cfg = await lerConfig()
        const list = await listarReservas()
        if (vivo) sincronizarRdl(list, ref.current.data, ref.current.upsert, cfg)
      } catch {
        /* sem internet: tenta de novo depois */
      }
    }
    void rodar()
    const t = setInterval(() => void rodar(), 5 * 60_000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [pronto])
}
