// Supabase Edge Function "agenda" — link de assinatura da agenda para o celular.
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor → nome "agenda"
// → cole este arquivo → Deploy. Depois, nos detalhes da função, DESLIGUE "Verify JWT"
// (apps de calendário não enviam login; quem protege é a chave secreta ?token=).
import { createClient } from 'npm:@supabase/supabase-js@2'

// deno-lint-ignore no-explicit-any
type Data = any

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
const nextDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + 1))
  return dt.toISOString().slice(0, 10).replace(/-/g, '')
}
// linhas do .ics devem ser curtas: quebra a cada 60 caracteres (sem partir emojis)
const fold = (line: string) => {
  const chars = Array.from(line)
  if (chars.length <= 60) return line
  const out: string[] = []
  for (let i = 0; i < chars.length; i += 60) out.push((i ? ' ' : '') + chars.slice(i, i + 60).join(''))
  return out.join('\r\n')
}

interface Entry {
  uid: string
  date: string
  time?: string
  title: string
  description: string
  alarm?: string // gatilho do lembrete, ex.: -PT15H (9h do dia anterior num evento de dia inteiro)
}

function calendarEntries(data: Data): Entry[] {
  const out: Entry[] = []
  const client = (id: string) => data.clients.find((c) => c.id === id)
  const open = ['briefing', 'producao', 'revisao', 'aguardando', 'pausado']

  for (const p of data.projects) {
    if (p.status === 'cancelado') continue
    const c = client(p.clientId)
    if (p.dueDate && open.includes(p.status)) {
      out.push({
        uid: `entrega-${p.id}`,
        date: p.dueDate,
        title: `📐 Entrega: ${p.title}`,
        description: `${c?.name ?? ''}${p.filesLink ? `\nArquivos: ${p.filesLink}` : ''}`,
        alarm: '-PT15H',
      })
    }
    for (const pay of p.payments) {
      if (pay.paidDate) continue
      out.push({
        uid: `pagamento-${pay.id}`,
        date: pay.dueDate,
        title: `💰 Receber ${brl(pay.amount)} · ${c?.name ?? ''}`,
        description: `${pay.description} — ${p.title}`,
        alarm: '-PT15H',
      })
    }
  }
  for (const e of data.events) {
    if (e.done) continue
    out.push({
      uid: `evento-${e.id}`,
      date: e.date,
      time: e.time || undefined,
      title: e.title,
      description: [EVENT_LABEL[e.type] ?? '', e.notes].filter(Boolean).join('\n'),
      alarm: e.time ? '-PT30M' : '-PT15H',
    })
  }
  return out
}

function buildICS(data: Data, name = 'Estúdio') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//controle-lais//PT-BR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:America/Sao_Paulo', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H']
  for (const e of calendarEntries(data)) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@controle-lais`, `DTSTAMP:${stamp}`)
    if (e.time) {
      const t = e.time.replace(':', '') + '00'
      lines.push(`DTSTART;TZID=America/Sao_Paulo:${ymd(e.date)}T${t}`, 'DURATION:PT1H')
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${nextDay(e.date)}`)
    }
    lines.push(`SUMMARY:${esc(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
    if (e.alarm) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:${e.alarm}`, 'END:VALARM')
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n')
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (token.length < 24) return new Response('Link inválido', { status: 404 })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await sb.from('workspace').select('data').eq('data->settings->>calendarToken', token).maybeSingle()
  if (error || !data) return new Response('Link inválido', { status: 404 })
  const ws = data.data as Data
  const name = `${ws.settings?.brandName ?? 'estúdio'} · controle`
  return new Response(buildICS(ws, name), {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' },
  })
})
