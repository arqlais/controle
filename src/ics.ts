import type { Data } from './types'

/* Calendário no formato iCalendar (.ics). O sistema publica este arquivo no
   Storage do Supabase (ver publishAgenda em cloud.ts) e o celular assina o link. */

const EVENT_LABEL: Record<string, string> = {
  reuniao: 'Reunião',
  faculdade: 'Faculdade',
  entrega: 'Entrega parcial',
  pessoal: 'Pessoal',
  outro: 'Compromisso',
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n')
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ymd = (s: string) => s.replace(/-/g, '')
const shift = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const nextDay = (s: string) => ymd(shift(s, 1))
const prevDay = (s: string) => shift(s, -1)
// linhas do .ics: no máximo 75 bytes (acentos e emojis ocupam mais de 1), sem partir caracteres
const enc = new TextEncoder()
const fold = (line: string) => {
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of Array.from(line)) {
    const n = enc.encode(ch).length
    if (size + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

interface Entry {
  uid: string
  date: string
  time?: string
  title: string
  description: string
  end?: string // último dia (inclusive) de um evento de vários dias
  endTime?: string // horário de término (compromissos)
  location?: string // endereço ou link
  alarms?: string[] // gatilhos dos lembretes, ex.: -PT15H (9h do dia anterior num evento de dia inteiro)
}

export function calendarEntries(data: Data): Entry[] {
  const out: Entry[] = []
  const client = (id: string) => data.clients.find((c) => c.id === id)
  const open = ['briefing', 'producao', 'revisao', 'aguardando', 'pausado']
  // o que vai para o celular (configurado em agenda → celular) e o que foi tirado item por item
  const sync = { entregas: true, pagamentos: true, compromissos: true, periodos: true, ...(data.settings?.calendarSync ?? {}) }

  for (const p of data.projects) {
    if (p.status === 'cancelado' || p.noPhone) continue
    const c = client(p.clientId)
    if (sync.entregas && p.dueDate && open.includes(p.status)) {
      out.push({
        uid: `entrega-${p.id}`,
        date: p.dueDate,
        title: `📐 Entrega: ${p.title}`,
        description: `${c?.name ?? ''}${p.filesLink ? `\nArquivos: ${p.filesLink}` : ''}`,
        alarms: ['-P1DT15H', '-PT15H', 'PT8H'], // 2 dias antes às 9h, véspera às 9h e no dia às 8h
      })
    }
    // período da demanda pintado no calendário (do início até a véspera da entrega)
    if (sync.entregas && sync.periodos && p.startDate && p.dueDate && p.startDate < p.dueDate && open.includes(p.status)) {
      out.push({
        uid: `periodo-${p.id}`,
        date: p.startDate,
        end: prevDay(p.dueDate),
        title: `🎨 ${p.title}`,
        description: `${c?.name ?? ''} · entrega ${p.dueDate.split('-').reverse().join('/')}`,
      })
    }
    for (const pay of p.payments) {
      if (!sync.pagamentos || pay.paidDate || !pay.dueDate) continue // saldo sem prazo definido não vira evento
      out.push({
        uid: `pagamento-${pay.id}`,
        date: pay.dueDate,
        title: `💰 Receber ${brl(pay.amount)} · ${c?.name ?? ''}`,
        description: `${pay.description} — ${p.title}`,
        alarms: ['-PT15H', 'PT8H'],
      })
    }
  }
  for (const e of data.events) {
    if (!sync.compromissos || e.done || e.noPhone) continue
    out.push({
      uid: `evento-${e.id}`,
      date: e.date,
      time: e.time || undefined,
      title: e.title,
      endTime: e.time && e.endTime && e.endTime > e.time ? e.endTime : undefined,
      location: e.place?.trim() || undefined,
      description: [(e.type === 'outro' && e.customType?.trim()) || EVENT_LABEL[e.type] || '', e.notes].filter(Boolean).join('\n'),
      alarms: e.time ? ['-PT1H', '-PT15M'] : ['-PT15H', 'PT8H'],
    })
  }
  return out
}

// fuso de Brasília (sem horário de verão desde 2019): o iPhone precisa dele para pôr os horários certos
const TIMEZONE = ['BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE']

export function buildICS(data: Data, name = 'Estúdio') {
  // cor da agenda no calendário do celular: a cor principal da identidade visual (rosé)
  const color = /^#[0-9a-f]{6}$/i.test(data.settings?.accentSoft ?? '') ? data.settings.accentSoft : ''
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//controle-lais//PT-BR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:America/Sao_Paulo', ...(color ? [`X-APPLE-CALENDAR-COLOR:${color.toUpperCase()}`] : []), 'METHOD:PUBLISH', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H', ...TIMEZONE]
  for (const e of calendarEntries(data)) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@controle-lais`, `DTSTAMP:${stamp}`)
    if (e.time) {
      const t = e.time.replace(':', '') + '00'
      lines.push(`DTSTART;TZID=America/Sao_Paulo:${ymd(e.date)}T${t}`, e.endTime ? `DTEND;TZID=America/Sao_Paulo:${ymd(e.date)}T${e.endTime.replace(':', '')}00` : 'DURATION:PT1H')
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${nextDay(e.end ?? e.date)}`, 'TRANSP:TRANSPARENT')
    }
    lines.push(`SUMMARY:${esc(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
    for (const a of e.alarms ?? []) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:${a}`, 'END:VALARM')
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n')
}
