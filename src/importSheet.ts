import { similarName } from './mergeClients'
import { newClient, newProject } from './components/forms'
import type { Client, ClientType, Data, Payment, Project } from './types'
import { fold, today, uid } from './utils'

/* Importar de planilha: Excel (.xlsx), Google Planilhas / Numbers / Notion (.csv), Trello (.json)
   ou células coladas. Cada coluna vira um campo (o sistema adivinha pelo título e a pessoa ajusta).
   Não apaga nada: cliente que já existe (mesmo nome, e-mail ou telefone) é reaproveitado. */

export type Sheet = { headers: string[]; rows: string[][]; source: string }

export type FieldId =
  | ''
  | 'nome'
  | 'empresa'
  | 'tipo'
  | 'email'
  | 'telefone'
  | 'instagram'
  | 'cidade'
  | 'documento'
  | 'cep'
  | 'endereco'
  | 'origem'
  | 'obs'
  | 'projeto'
  | 'descricao'
  | 'valor'
  | 'pago'
  | 'inicio'
  | 'prazo'
  | 'status'

export const FIELDS: { id: FieldId; label: string; group: 'cliente' | 'projeto' | '' }[] = [
  { id: '', label: 'não importar', group: '' },
  { id: 'nome', label: 'nome do cliente', group: 'cliente' },
  { id: 'empresa', label: 'empresa / escritório', group: 'cliente' },
  { id: 'tipo', label: 'tipo de cliente', group: 'cliente' },
  { id: 'email', label: 'e-mail', group: 'cliente' },
  { id: 'telefone', label: 'telefone / WhatsApp', group: 'cliente' },
  { id: 'instagram', label: 'instagram', group: 'cliente' },
  { id: 'cidade', label: 'cidade', group: 'cliente' },
  { id: 'documento', label: 'CPF / CNPJ', group: 'cliente' },
  { id: 'cep', label: 'CEP', group: 'cliente' },
  { id: 'endereco', label: 'endereço', group: 'cliente' },
  { id: 'origem', label: 'como chegou (origem)', group: 'cliente' },
  { id: 'obs', label: 'observações do cliente', group: 'cliente' },
  { id: 'projeto', label: 'nome do projeto', group: 'projeto' },
  { id: 'descricao', label: 'descrição do projeto', group: 'projeto' },
  { id: 'valor', label: 'valor do projeto', group: 'projeto' },
  { id: 'pago', label: 'valor já pago', group: 'projeto' },
  { id: 'inicio', label: 'data de início', group: 'projeto' },
  { id: 'prazo', label: 'prazo de entrega', group: 'projeto' },
  { id: 'status', label: 'etapa / status', group: 'projeto' },
]

/** Adivinha o campo pelo título da coluna. */
const GUESS: [FieldId, RegExp][] = [
  ['email', /e-?mail/],
  ['telefone', /(tel|cel|whats|fone|phone|contato)/],
  ['instagram', /(insta|@)/],
  ['documento', /(cpf|cnpj|document)/],
  ['cep', /\bcep\b/],
  ['endereco', /(endere|rua|logradouro|address)/],
  ['cidade', /(cidade|municipio|city)/],
  ['origem', /(origem|como (conheceu|chegou)|indica|fonte|canal)/],
  ['empresa', /(empresa|escritorio|company|razao)/],
  ['tipo', /^(tipo|categoria|perfil)/],
  ['pago', /(pago|recebido|entrada|sinal)/],
  ['valor', /(valor|preco|total|orcamento|price|r\$)/],
  ['inicio', /(inicio|comeco|fechamento|fechou|data de entrada|^data$|start)/],
  ['prazo', /(prazo|entrega|vencimento|due|deadline|fim)/],
  ['status', /(status|etapa|fase|situacao|lista|coluna)/],
  ['descricao', /(descri|escopo|servico|detalhe|desc$)/],
  ['projeto', /(projeto|demanda|trabalho|titulo|job|card)/],
  ['obs', /(obs|nota|comentario)/],
  ['nome', /(nome|cliente|name)/],
]
export function guessField(header: string): FieldId {
  const h = fold(header).trim()
  if (!h) return ''
  for (const [id, re] of GUESS) if (re.test(h)) return id
  return ''
}
export function guessMapping(headers: string[]): FieldId[] {
  const used = new Set<FieldId>()
  return headers.map((h) => {
    const g = guessField(h)
    if (!g || used.has(g)) return ''
    used.add(g)
    return g
  })
}

/* ---------- leitura ---------- */

/** CSV/TSV com aspas, separador detectado (; , ou tab). */
export function parseDelimited(text: string): string[][] {
  const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const firstLine = t.split('\n').find((l) => l.trim()) ?? ''
  const count = (ch: string) => firstLine.split(ch).length - 1
  const sep = ['\t', ';', ','].sort((a, b) => count(b) - count(a))[0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c))
}

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** Primeira aba de um .xlsx (Excel, Google Planilhas → baixar .xlsx, Numbers → exportar). */
export async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buf)
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml')
  const shared: string[] = []
  const ss = zip.file('xl/sharedStrings.xml')
  if (ss) for (const si of Array.from(xml(await ss.async('string')).getElementsByTagName('si'))) shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''))
  // a primeira aba, pela ordem da pasta de trabalho
  let path = 'xl/worksheets/sheet1.xml'
  const wb = zip.file('xl/workbook.xml')
  const rels = zip.file('xl/_rels/workbook.xml.rels')
  if (wb && rels) {
    const first = xml(await wb.async('string')).getElementsByTagName('sheet')[0]
    const rid = first?.getAttribute('r:id') ?? first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    const rel = Array.from(xml(await rels.async('string')).getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid)
    const target = rel?.getAttribute('Target')
    if (target) path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
  }
  const sheet = zip.file(path) ?? zip.file(/xl\/worksheets\/sheet\d+\.xml/)[0]
  if (!sheet) return []
  const doc = xml(await sheet.async('string'))
  const rows: string[][] = []
  for (const r of Array.from(doc.getElementsByTagName('row'))) {
    const out: string[] = []
    for (const c of Array.from(r.getElementsByTagName('c'))) {
      const i = colIndex(c.getAttribute('r') ?? '')
      const t = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      const val = t === 's' ? shared[Number(v)] ?? '' : t === 'inlineStr' ? Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('') : v
      out[i >= 0 ? i : out.length] = val.trim()
    }
    rows.push(Array.from(out, (x) => x ?? ''))
  }
  return rows.filter((r) => r.some((c) => c))
}

/** Quadro do Trello (menu do quadro → imprimir, exportar → JSON): cada cartão vira um projeto. */
export function parseTrello(j: unknown): Sheet | null {
  const b = j as { lists?: { id: string; name: string; closed?: boolean }[]; cards?: { name: string; desc?: string; idList: string; due?: string | null; start?: string | null; closed?: boolean; dateLastActivity?: string }[] }
  if (!b || !Array.isArray(b.cards) || !Array.isArray(b.lists)) return null
  const list = new Map(b.lists.map((l) => [l.id, l.name]))
  const rows = b.cards
    .filter((c) => !c.closed)
    .map((c) => {
      // "Cliente - Projeto" é comum nos cartões: separa em duas colunas
      const m = c.name.match(/^(.+?)\s+[-–—|]\s+(.+)$/)
      return [m ? m[1] : '', m ? m[2] : c.name, list.get(c.idList) ?? '', (c.start ?? '').slice(0, 10), (c.due ?? '').slice(0, 10), (c.desc ?? '').slice(0, 600)]
    })
  return { headers: ['cliente', 'projeto', 'lista', 'início', 'prazo', 'descrição'], rows, source: 'Trello' }
}

export async function readSheetFile(file: File): Promise<Sheet> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return toSheet(await parseXlsx(await file.arrayBuffer()), 'Excel')
  if (name.endsWith('.xls') || name.endsWith('.numbers') || name.endsWith('.ods')) throw new Error('formato')
  const text = await file.text()
  if (name.endsWith('.json') || text.trim().startsWith('{')) {
    const t = parseTrello(JSON.parse(text))
    if (t) return t
    throw new Error('formato')
  }
  return toSheet(parseDelimited(text), 'planilha')
}

export function toSheet(rows: string[][], source: string): Sheet {
  if (!rows.length) return { headers: [], rows: [], source }
  // a 1ª linha é o título das colunas (se parecer título); senão, colunas sem nome
  const first = rows[0]
  const looksHeader = first.filter(Boolean).every((c) => !/^[\d.,R$\s/-]+$/.test(c)) && first.some((c) => guessField(c))
  const width = Math.max(...rows.map((r) => r.length))
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? '')
  return looksHeader ? { headers: pad(first).map((h, i) => h || `coluna ${i + 1}`), rows: rows.slice(1).map(pad), source } : { headers: pad([]).map((_, i) => `coluna ${i + 1}`), rows: rows.map(pad), source }
}

/* ---------- valores ---------- */

export function parseMoney(v: string): number {
  const s = v.replace(/[^\d,.-]/g, '')
  if (!s) return 0
  // 1.234,56 → vírgula decimal; 1,234.56 → ponto decimal
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  // só pontos, em grupos de 3 (3.200 · 1.250.000): ponto de milhar
  const thousandsDots = lastComma < 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)
  const n = thousandsDots ? Number(s.replace(/\./g, '')) : lastComma > lastDot ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) / 100 : 0
}

export function parseDate(v: string): string {
  const s = v.trim()
  if (!s) return ''
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  // data do Excel (número de dias desde 1900)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86_400_000)
    return d.toISOString().slice(0, 10)
  }
  return ''
}

export function guessStatus(v: string): Project['status'] {
  const s = fold(v)
  if (!s) return 'briefing'
  if (/(cancel|desist)/.test(s)) return 'cancelado'
  if (/(entreg|conclu|finaliz|feito|pronto|done)/.test(s)) return 'entregue'
  if (/(paus|parad|espera)/.test(s)) return 'pausado'
  if (/(revis|ajuste|altera)/.test(s)) return 'revisao'
  if (/(aguard|aprova|cliente)/.test(s)) return 'aguardando'
  if (/(produ|andamento|fazendo|execu|doing|desenv)/.test(s)) return 'producao'
  return 'briefing'
}

const TYPE_GUESS: [ClientType, RegExp][] = [
  ['final', /(final|pessoa|residen|morador|dono)/],
  ['arquiteto', /arquitet/],
  ['designer', /design/],
  ['escritorio', /(escritorio|studio|estudio)/],
  ['construtora', /(constru|incorpora|obra)/],
  ['estudante', /(estudante|aluno|faculdade)/],
]
const guessType = (v: string, fallback: ClientType): ClientType => {
  const s = fold(v)
  for (const [t, re] of TYPE_GUESS) if (re.test(s)) return t
  return fallback
}

const digits = (s: string) => s.replace(/\D/g, '')

/* ---------- montar ---------- */

export interface ImportPlan {
  newClients: Client[]
  reused: number // clientes que já existiam
  projects: Project[]
  skipped: number // linhas sem nome de cliente nem projeto
}

export function buildImport(sheet: Sheet, map: FieldId[], data: Data, defaultType: ClientType, withProjects: boolean): ImportPlan {
  const col = (id: FieldId) => map.indexOf(id)
  const get = (row: string[], id: FieldId) => (col(id) >= 0 ? (row[col(id)] ?? '').trim() : '')
  const known: Client[] = [...data.clients]
  const newClients: Client[] = []
  const projects: Project[] = []
  let reused = 0
  let skipped = 0
  const counted = new Set<string>()
  const findClient = (name: string, email: string, phone: string) =>
    known.find((c) => (email && c.email && fold(c.email) === fold(email)) || (phone.length >= 10 && digits(c.phone).endsWith(phone.slice(-9))) || (name && (fold(c.name) === fold(name) || similarName(c.name, name))))
  for (const row of sheet.rows) {
    const name = get(row, 'nome')
    const email = get(row, 'email')
    const phone = digits(get(row, 'telefone'))
    const title = get(row, 'projeto')
    if (!name && !title) {
      skipped++
      continue
    }
    let client = name || email || phone ? findClient(name, email, phone) : undefined
    if (client && !newClients.includes(client) && !counted.has(client.id)) {
      reused++
      counted.add(client.id)
    }
    if (!client && name) {
      const insta = get(row, 'instagram').replace(/^@/, '')
      client = {
        ...newClient(guessType(get(row, 'tipo'), defaultType)),
        name,
        company: get(row, 'empresa'),
        email,
        phone: get(row, 'telefone'),
        instagram: insta,
        city: get(row, 'cidade'),
        document: get(row, 'documento'),
        ...(get(row, 'cep') ? { cep: get(row, 'cep') } : {}),
        ...(get(row, 'endereco') ? { address: get(row, 'endereco') } : {}),
        origin: get(row, 'origem'),
        notes: get(row, 'obs'),
        history: [{ id: uid(), date: today(), text: `importado de ${sheet.source}` }],
      }
      known.push(client)
      newClients.push(client)
    }
    if (!withProjects || !title) continue
    const value = parseMoney(get(row, 'valor'))
    const paid = Math.min(value || Infinity, parseMoney(get(row, 'pago')))
    const start = parseDate(get(row, 'inicio')) || today()
    const due = parseDate(get(row, 'prazo'))
    const status = guessStatus(get(row, 'status'))
    const payments: Payment[] = []
    const pay = (description: string, amount: number, dueDate: string, paidDate: string | null): Payment => ({ id: uid(), description, amount: Math.round(amount * 100) / 100, dueDate, paidDate, method: 'Pix' })
    if (value > 0) {
      if (paid >= value) payments.push(pay('Pagamento', value, start, start))
      else if (paid > 0) payments.push(pay('Já pago', paid, start, start), pay('Saldo', value - paid, due || start, null))
      else payments.push(pay('Pagamento', value, due || start, null))
    }
    projects.push({
      ...newProject(client?.id ?? ''),
      title,
      description: get(row, 'descricao'),
      status,
      startDate: start,
      dueDate: due,
      deliveredDate: status === 'entregue' ? due || start : null,
      value,
      payments,
      notes: `Importado de ${sheet.source}.`,
      createdAt: start,
    })
  }
  return { newClients, reused, projects, skipped }
}
