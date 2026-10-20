import { useCallback, useEffect, useMemo } from 'react'
import { CLOUD, supabase } from './cloud'
import { deleteBriefingLink, fetchAnswers } from './briefingApi'
import { viewingAsClient } from './viewAs'
import { useStore } from './store'
import { toast } from './components/dialog'
import { notifyDevice } from './briefingSync'
import type { Client, ContractData, ContractPerson, DataFieldKey, DataFieldRule, DataFormConfig, FullAddress, Settings } from './types'
import { formatCep, formatDoc, today, uid } from './utils'

/* Dados para o contrato: um link para o cliente preencher tudo (empresa, dados pessoais, sócios,
   quem assina e o nome que vai no contrato). As respostas entram no cadastro do cliente e nas
   variáveis do contrato. O link usa a mesma tabela do briefing (lê uma vez, responde uma vez). */

export const emptyAddress = (): FullAddress => ({ cep: '', street: '', number: '', complement: '', district: '', city: '', uf: '' })
export const emptyPerson = (): ContractPerson => ({ id: uid(), name: '', cpf: '', rg: '', rgIssuer: '', nationality: '', civilState: '', profession: '', email: '', phone: '', role: '', address: emptyAddress() })

export const CIVIL_STATES = ['solteira(o)', 'casada(o)', 'união estável', 'divorciada(o)', 'separada(o)', 'viúva(o)']
export const COMPANY_KINDS = ['MEI', 'ME', 'EPP', 'LTDA', 'SLU', 'S.A.', 'EIRELI', 'outro']
export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

/** Endereço do cadastro antigo ("rua, bairro" + "nº e complemento" + "cidade - UF") em campos. */
function addressFromClient(c: Client): FullAddress {
  const [street = '', district = ''] = (c.address ?? '').split(/,\s*(?=[^,]*$)/)
  const [city = '', uf = ''] = (c.city ?? '').split(/\s*[-/]\s*(?=[A-Za-z]{2}$)/)
  const [number = '', ...rest] = (c.addressNumber ?? '').split(/\s+/)
  return { cep: formatCep(c.cep ?? ''), street: street.trim(), number, complement: rest.join(' '), district: district.trim(), city: city.trim(), uf: uf.toUpperCase() }
}

/** Ponto de partida: o que já existe no cadastro (o cliente só completa). */
export function dataFromClient(c: Client): ContractData {
  if (c.contractData) return c.contractData
  const digits = (c.document ?? '').replace(/\D/g, '')
  const company = c.billTo === 'empresa' || (!c.billTo && !!(c.companyDoc || c.companyLegal))
  const addr = addressFromClient(c)
  const person: ContractPerson = { ...emptyPerson(), id: 'titular', name: c.name, cpf: digits.length === 11 ? formatDoc(digits) : '', email: c.email, phone: c.phone, address: company ? emptyAddress() : addr }
  return {
    signAs: company ? 'empresa' : 'pessoa',
    company: { legalName: c.companyLegal ?? '', tradeName: c.company ?? '', cnpj: c.companyDoc ? formatDoc(c.companyDoc) : '', kind: c.companyKind ?? '', stateReg: '', email: company ? c.email : '', phone: company ? c.phone : '', address: company ? addr : emptyAddress() },
    person,
    partners: [],
    signers: ['titular'],
    contractName: '',
    notes: '',
    updatedAt: '',
    by: 'voce',
  }
}

/* ---------- conferências ---------- */
export function validCpf(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}
export function validCnpj(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const calc = (n: number) => {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = w.reduce((acc, x, i) => acc + x * Number(d[i]), 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}
const filled = (v?: string) => !!(v ?? '').trim()
const addrOk = (a?: FullAddress) => !!a && filled(a.cep) && filled(a.street) && filled(a.number) && filled(a.city) && filled(a.uf)

/* ---------- o formulário: o que é obrigatório, opcional ou não é pedido ---------- */
export type Audience = 'b2b' | 'final'
export const AUDIENCES: { value: Audience; label: string; text: string }[] = [
  { value: 'b2b', label: 'escritórios e profissionais', text: 'prestação de serviço para escritório, arquiteto, designer ou construtora: o essencial da empresa e de quem assina' },
  { value: 'final', label: 'cliente final', text: 'projeto para a casa ou o negócio do cliente: dados pessoais completos e o endereço do imóvel' },
]
export const audienceOf = (c?: Client): Audience => (c?.type === 'final' ? 'final' : 'b2b')
type Def = { b2b: DataFieldRule; final: DataFieldRule }
const o = 'obrigatorio' as const
const p = 'opcional' as const
const x = 'oculto' as const
/** Só o que o contrato precisa, conforme para quem é o serviço. */
export const DATA_FIELDS: { key: DataFieldKey; label: string; group: 'empresa' | 'voce' | 'final'; def: Def; fixed?: boolean }[] = [
  { key: 'cnpj', label: 'CNPJ', group: 'empresa', def: { b2b: o, final: o }, fixed: true },
  { key: 'legalName', label: 'razão social', group: 'empresa', def: { b2b: o, final: o } },
  { key: 'tradeName', label: 'nome fantasia', group: 'empresa', def: { b2b: p, final: x } },
  { key: 'kind', label: 'tipo (MEI, LTDA…)', group: 'empresa', def: { b2b: x, final: x } },
  { key: 'companyEmail', label: 'e-mail da empresa', group: 'empresa', def: { b2b: p, final: x } },
  { key: 'companyPhone', label: 'telefone da empresa', group: 'empresa', def: { b2b: x, final: x } },
  { key: 'stateReg', label: 'inscrição estadual / municipal', group: 'empresa', def: { b2b: x, final: x } },
  { key: 'companyAddress', label: 'endereço da empresa', group: 'empresa', def: { b2b: o, final: o } },
  { key: 'name', label: 'nome completo', group: 'voce', def: { b2b: o, final: o }, fixed: true },
  { key: 'cpf', label: 'CPF', group: 'voce', def: { b2b: o, final: o } },
  { key: 'rg', label: 'RG', group: 'voce', def: { b2b: x, final: o } },
  { key: 'rgIssuer', label: 'órgão emissor do RG', group: 'voce', def: { b2b: x, final: p } },
  { key: 'nationality', label: 'nacionalidade', group: 'voce', def: { b2b: x, final: o } },
  { key: 'civilState', label: 'estado civil', group: 'voce', def: { b2b: x, final: o } },
  { key: 'profession', label: 'profissão', group: 'voce', def: { b2b: x, final: p } },
  { key: 'role', label: 'cargo na empresa', group: 'voce', def: { b2b: p, final: x } },
  { key: 'email', label: 'e-mail', group: 'voce', def: { b2b: o, final: o } },
  { key: 'phone', label: 'WhatsApp', group: 'voce', def: { b2b: p, final: o } },
  { key: 'personAddress', label: 'endereço (quando é pessoa física)', group: 'voce', def: { b2b: o, final: o } },
  { key: 'repAddress', label: 'endereço de quem representa a empresa', group: 'voce', def: { b2b: x, final: x } },
  { key: 'propertyAddress', label: 'endereço do imóvel do projeto', group: 'final', def: { b2b: x, final: o } },
  { key: 'partners', label: 'sócios / outras pessoas que assinam', group: 'final', def: { b2b: p, final: p } },
  { key: 'signers', label: 'quem assina', group: 'final', def: { b2b: o, final: o } },
  { key: 'contractName', label: 'nome que vai no contrato', group: 'final', def: { b2b: p, final: x } },
  { key: 'notes', label: 'observações', group: 'final', def: { b2b: x, final: x } },
]
export const DEFAULT_FORM: DataFormConfig = { intro: '', rules: {}, extra: [] }
export type Rule = (k: DataFieldKey) => DataFieldRule
export const ruleOf =
  (cfg?: DataFormConfig, aud: Audience = 'b2b'): Rule =>
  (k) => {
    const f = DATA_FIELDS.find((y) => y.key === k)
    if (f?.fixed) return 'obrigatorio'
    return cfg?.rules[k] ?? f?.def[aud] ?? 'opcional'
  }
const label = (k: DataFieldKey) => DATA_FIELDS.find((y) => y.key === k)?.label ?? k

/** O que falta, por passo (o link confere passo a passo) ou tudo (a sua tela). */
export function missingFor(d: ContractData, cfg?: DataFormConfig, step?: 'empresa' | 'voce' | 'socios' | 'final', aud: Audience = 'b2b'): string[] {
  const r = ruleOf(cfg, aud)
  const need = (k: DataFieldKey) => r(k) === 'obrigatorio'
  const out: string[] = []
  const p = d.person
  const company = d.signAs === 'empresa'
  const val: Partial<Record<DataFieldKey, string>> = {
    legalName: d.company.legalName, tradeName: d.company.tradeName, kind: d.company.kind, companyEmail: d.company.email, companyPhone: d.company.phone, stateReg: d.company.stateReg,
    name: p.name, rg: p.rg, rgIssuer: p.rgIssuer, nationality: p.nationality, civilState: p.civilState, profession: p.profession, role: p.role, email: p.email, phone: p.phone, notes: d.notes,
  }
  if (company && (!step || step === 'empresa')) {
    if (!validCnpj(d.company.cnpj)) out.push('CNPJ')
    for (const k of ['legalName', 'tradeName', 'kind', 'companyEmail', 'companyPhone', 'stateReg'] as DataFieldKey[]) if (need(k) && !filled(val[k])) out.push(label(k))
    if (need('companyAddress') && !addrOk(d.company.address)) out.push(label('companyAddress'))
  }
  if (!step || step === 'voce') {
    for (const k of ['name', 'rg', 'rgIssuer', 'nationality', 'civilState', 'profession', 'email', 'phone'] as DataFieldKey[]) if (need(k) && !filled(val[k])) out.push(label(k))
    if (need('cpf') && !validCpf(p.cpf)) out.push('CPF')
    if (company && need('role') && !filled(p.role)) out.push(label('role'))
    if (!company && need('personAddress') && !addrOk(p.address)) out.push('endereço')
    if (company && need('repAddress') && !addrOk(p.address)) out.push('seu endereço')
  }
  if (!step || step === 'socios') d.partners.forEach((x, i) => (!filled(x.name) || !validCpf(x.cpf)) && out.push(company ? `nome e CPF do sócio ${i + 1}` : `nome e CPF da pessoa ${i + 2}`))
  if (!step || step === 'final') {
    if (need('propertyAddress') && !addrOk(d.property)) out.push(label('propertyAddress'))
    if (need('signers') && !d.signers.length) out.push('quem assina')
    if (need('contractName') && !filled(d.contractName)) out.push(label('contractName'))
    if (need('notes') && !filled(d.notes)) out.push(label('notes'))
  }
  for (const q of cfg?.extra ?? []) {
    const where = q.step === 'empresa' && !company ? 'voce' : q.step
    if (q.required && (!step || step === where) && !filled(d.extra?.find((x) => x.id === q.id)?.value)) out.push(q.label)
  }
  return out
}
/** O que ainda falta para o contrato sair completo (tela de quem gerencia). */
export const missingOf = (d?: ContractData, cfg?: DataFormConfig, aud: Audience = 'b2b') => (d ? missingFor(d, cfg, undefined, aud) : ['tudo'])
/** De 0 a 100: quanto do contrato já tem dados. */
export function completeness(d?: ContractData, cfg?: DataFormConfig, aud: Audience = 'b2b') {
  if (!d) return 0
  const r = ruleOf(cfg, aud)
  const total = DATA_FIELDS.filter((f) => r(f.key) === 'obrigatorio' && !f.fixed && f.key !== 'partners' && (d.signAs === 'empresa' ? f.key !== 'personAddress' : f.group !== 'empresa' && f.key !== 'role' && f.key !== 'repAddress')).length + d.partners.length + (cfg?.extra ?? []).filter((q) => q.required).length
  return Math.max(0, Math.min(100, Math.round(((total - missingOf(d, cfg, aud).length) / Math.max(1, total)) * 100)))
}

/* ---------- textos para o contrato ---------- */
export const addressText = (a?: FullAddress) => {
  if (!a) return ''
  const street = [a.street, a.number].filter(filled).join(', ')
  const parts = [street + (filled(a.complement) ? ` ${a.complement}` : ''), a.district, [a.city, a.uf].filter(filled).join('/'), filled(a.cep) ? `CEP ${a.cep}` : ''].filter((x) => filled(x))
  return parts.join(', ')
}
const gender = (p: ContractPerson) => (/a$/i.test(p.nationality.trim()) ? 'a' : 'o')

/** "Fulana, brasileira, casada, arquiteta, portadora do RG nº … e inscrita no CPF sob o nº …, residente em …" */
export function personText(p: ContractPerson, withAddress = true, withRole = false) {
  const g = gender(p)
  const civil = p.civilState.replace(/a\(o\)$/, g === 'a' ? 'a' : 'o')
  const docs = [filled(p.rg) ? `portador${g === 'a' ? 'a' : ''} do RG nº ${p.rg}${filled(p.rgIssuer) ? ` ${p.rgIssuer}` : ''}` : '', filled(p.cpf) ? `inscrit${g} no CPF sob o nº ${p.cpf}` : ''].filter(Boolean).join(' e ')
  const addr = withAddress && addrOk(p.address) ? `residente e domiciliad${g} em ${addressText(p.address)}` : ''
  return [p.name, withRole ? p.role : '', p.nationality, civil, p.profession, docs, addr].filter((x) => filled(x)).join(', ')
}

/** Nome que aparece como contratante. */
export function contractantName(d: ContractData) {
  if (filled(d.contractName)) return d.contractName.trim()
  return d.signAs === 'empresa' ? d.company.legalName || d.company.tradeName : d.person.name
}
const peopleOf = (d: ContractData) => [d.person, ...d.partners]
export const signersOf = (d: ContractData) => peopleOf(d).filter((p) => d.signers.includes(p.id) && filled(p.name))

/** Qualificação completa de quem contrata (o parágrafo do "CONTRATANTE: …"). */
export function qualification(d: ContractData) {
  if (d.signAs === 'pessoa') {
    const who = signersOf(d)
    return (who.length ? who : [d.person]).map((x) => personText(x)).join('; e ')
  }
  const c = d.company
  const reps = signersOf(d)
  const repText = reps.map((p) => personText(p, false, true)).join('; e por ')
  return [
    `${contractantName(d)}${filled(c.tradeName) && c.tradeName !== contractantName(d) ? ` (${c.tradeName})` : ''}, pessoa jurídica de direito privado`,
    filled(c.cnpj) ? `inscrita no CNPJ sob o nº ${c.cnpj}` : '',
    filled(c.stateReg) ? `inscrição ${c.stateReg}` : '',
    addrOk(c.address) ? `com sede em ${addressText(c.address)}` : '',
    reps.length ? `neste ato representada por ${repText}` : '',
  ]
    .filter(Boolean)
    .join(', ')
}

/** Passa os dados para o cadastro do cliente (recibos, propostas e contrato usam daí). */
export function applyToClient(c: Client, d: ContractData): Client {
  const addr = d.signAs === 'empresa' ? d.company.address : d.person.address ?? emptyAddress()
  const has = addrOk(addr)
  const email = d.signAs === 'empresa' ? d.company.email || d.person.email : d.person.email
  const phone = d.signAs === 'empresa' ? d.company.phone || d.person.phone : d.person.phone
  return {
    ...c,
    contractData: d,
    billTo: d.signAs,
    name: c.name.trim() || d.person.name,
    email: c.email.trim() || email,
    phone: c.phone.trim() || phone,
    document: d.person.cpf || c.document,
    ...(d.signAs === 'empresa'
      ? { companyLegal: d.company.legalName || c.companyLegal, company: c.company.trim() || d.company.tradeName || d.company.legalName, companyDoc: d.company.cnpj || c.companyDoc, companyKind: d.company.kind || c.companyKind }
      : {}),
    ...(has ? { cep: addr.cep, address: [addr.street, addr.district].filter(filled).join(', '), addressNumber: [addr.number, addr.complement].filter(filled).join(' '), city: [addr.city, addr.uf].filter(filled).join(' - ') } : {}),
  }
}

/** Empresa pelo CNPJ (BrasilAPI, gratuito), com o endereço em campos e os sócios. */
export async function cnpjDetails(cnpj: string): Promise<{ legalName: string; tradeName: string; kind: string; email: string; phone: string; address: FullAddress; partners: { name: string; role: string }[] } | null> {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return null
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`)
    if (!r.ok) return null
    const j = await r.json()
    const cap = (t: string) => (t || '').toLowerCase().replace(/(^|\s)(\S+)/g, (_m: string, sp: string, w: string) => sp + (/^(da|das|de|do|dos|e)$/.test(w) && sp ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    const kind = j.opcao_pelo_mei ? 'MEI' : /limitada|ltda/i.test(j.natureza_juridica ?? '') ? 'LTDA' : /micro/i.test(j.porte ?? '') ? 'ME' : /pequeno/i.test(j.porte ?? '') ? 'EPP' : ''
    const phone = String(j.ddd_telefone_1 ?? '').replace(/\D/g, '')
    return {
      legalName: j.razao_social ?? '',
      tradeName: cap(j.nome_fantasia ?? ''),
      kind,
      email: String(j.email ?? '').toLowerCase(),
      phone: phone.length >= 10 ? phone : '',
      address: {
        cep: formatCep(String(j.cep ?? '')),
        street: cap(j.descricao_tipo_de_logradouro ? `${j.descricao_tipo_de_logradouro} ${j.logradouro}` : (j.logradouro ?? '')),
        number: String(j.numero ?? ''),
        complement: cap(j.complemento ?? ''),
        district: cap(j.bairro ?? ''),
        city: cap(j.municipio ?? ''),
        uf: String(j.uf ?? ''),
      },
      partners: ((j.qsa ?? []) as { nome_socio?: string; qualificacao_socio?: string }[]).filter((x) => x.nome_socio).map((x) => ({ name: cap(x.nome_socio!), role: (x.qualificacao_socio ?? '').replace(/^\d+-/, '').toLowerCase() })),
    }
  } catch {
    return null
  }
}

/* ---------- o link ---------- */
export interface DataPayload {
  kind: 'dados'
  title: string
  clientName: string
  studio: string
  owner: string
  accent: string
  logo?: string
  phone?: string
  email?: string
  prefill: ContractData
  form?: DataFormConfig
  audience?: Audience
}
const LOCAL = 'briefings-publicos' // mesma gaveta da prévia do briefing (as respostas voltam pelo mesmo caminho)
type LocalRow = { payload: DataPayload; answers?: ContractData; answeredAt?: string }
const readLocal = (): Record<string, LocalRow> => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) || '{}')
  } catch {
    return {}
  }
}
const writeLocal = (v: Record<string, LocalRow>) => {
  try {
    localStorage.setItem(LOCAL, JSON.stringify(v))
  } catch {
    /* sem espaço */
  }
}
const useCloud = () => CLOUD && !viewingAsClient()

export const dataLinkUrl = (id: string) => `${location.origin}${location.pathname}#/dados/${id}`
export const newLinkId = () => (crypto.randomUUID ? crypto.randomUUID() : `${uid()}-${uid()}`)

export const formOf = (s: Settings, aud: Audience) => (aud === 'final' ? s.dataFormFinal : s.dataForm) ?? DEFAULT_FORM

export function dataPayload(s: Settings, c: Client): DataPayload {
  const aud = audienceOf(c)
  const prefill = dataFromClient(c)
  return {
    kind: 'dados',
    title: 'dados para o contrato',
    clientName: c.name,
    studio: (s.brandName || s.ownerName || '').replace(/\.$/, ''),
    owner: s.ownerName || '',
    accent: s.accent || '#4a5d6b',
    logo: s.logo && s.logo.length < 200_000 ? s.logo : undefined,
    phone: (s.phone || '').replace(/\D/g, ''),
    email: s.email,
    prefill: c.contractData ? prefill : { ...prefill, signAs: c.companyDoc ? 'empresa' : c.billTo === 'pessoa' || aud === 'final' ? 'pessoa' : 'empresa' },
    form: formOf(s, aud),
    audience: aud,
  }
}

export async function publishDataLink(id: string, payload: DataPayload) {
  if (!useCloud()) {
    const all = readLocal()
    all[id] = { payload }
    writeLocal(all)
    return
  }
  const { error } = await supabase!.from('briefing_links').upsert({ id, payload })
  if (error) throw error
}

export async function loadDataLink(id: string): Promise<{ payload: DataPayload; answered: boolean; cloud: boolean } | null> {
  if (CLOUD) {
    try {
      const { data, error } = await supabase!.rpc('briefing_publico', { p_id: id })
      if (!error && data) {
        const d = data as { payload: DataPayload; respondido: boolean }
        if (d.payload?.kind === 'dados') return { payload: d.payload, answered: d.respondido, cloud: true }
      }
    } catch {
      /* tenta neste navegador */
    }
  }
  const row = readLocal()[id]
  return row?.payload?.kind === 'dados' ? { payload: row.payload, answered: !!row.answeredAt, cloud: false } : null
}

export async function sendData(id: string, data: ContractData, cloud: boolean) {
  if (!cloud) {
    const all = readLocal()
    if (!all[id] || all[id].answeredAt) return false
    all[id] = { ...all[id], answers: data, answeredAt: new Date().toISOString() }
    writeLocal(all)
    return true
  }
  try {
    const { data: ok, error } = await supabase!.rpc('responder_briefing', { p_id: id, p_answers: data })
    if (error || !ok) return false
  } catch {
    return false
  }
  void supabase!.functions.invoke('avisos', { body: { tipo: 'briefing', id } }).catch(() => undefined)
  return true
}

export const cancelDataLink = (id: string, userId?: string) => deleteBriefingLink(id, userId).catch(() => undefined)

/** Confere se algum cliente mandou os dados (ao abrir e de tempos em tempos). */
export function useContractDataSync(enabled: boolean) {
  const { data, upsert, userId } = useStore()
  const pending = useMemo(() => data.clients.filter((c) => c.dataLink?.status === 'enviado'), [data.clients])
  const ids = pending.map((c) => c.dataLink!.id).join(',')
  const check = useCallback(async () => {
    if (!pending.length) return
    try {
      const got = await fetchAnswers(pending.map((c) => c.dataLink!.id))
      for (const c of pending) {
        const r = got[c.dataLink!.id]
        if (!r) continue
        const d = { ...(r.answers as unknown as ContractData), by: 'cliente' as const, updatedAt: r.answeredAt }
        const next = applyToClient(c, d)
        upsert('clients', { ...next, dataLink: { ...c.dataLink!, status: 'respondido', answeredAt: r.answeredAt }, history: [...next.history, { id: uid(), date: today(), text: 'mandou os dados para o contrato pelo link' }] })
        upsert('notices', { id: uid(), at: new Date().toISOString(), kind: 'briefing', ref: `dados:${c.dataLink!.id}`, clientId: c.id, link: 'dados-contrato', title: `${c.name} mandou os dados do contrato`, text: 'Já estão no cadastro e entram sozinhos no contrato. Confira em clientes → dados para contrato.' })
        toast(`${c.name.split(' ')[0]} mandou os dados do contrato`)
        notifyDevice(`${c.name} mandou os dados do contrato`, 'Já estão no cadastro.')
        // os dados ficam guardados na conta; o link sai do ar (nada pessoal fica público)
        void cancelDataLink(c.dataLink!.id, userId)
      }
    } catch {
      /* sem conexão: tenta depois */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, upsert, userId])
  useEffect(() => {
    if (!enabled || !ids) return
    void check()
    const iv = setInterval(() => void check(), 4 * 60_000)
    const onVis = () => document.visibilityState === 'visible' && void check()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled, ids, check])
  return { check }
}
