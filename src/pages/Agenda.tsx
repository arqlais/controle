import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { href } from '../router'
import { Icon } from '../components/Icon'
import { EventForm } from '../components/forms'
import { Modal, MonthPicker, Section } from '../components/ui'
import { toast } from '../components/dialog'
import { CLOUD, SUPABASE_URL } from '../cloud'
import { buildICS } from '../ics'
import type { CalendarEvent } from '../types'
import {
  EVENT_TYPES,
  PRIORITY,
  WEEKDAYS,
  allPayments,
  download,
  fmtDateLong,
  isOpen,
  money,
  parseISO,
  toISO,
  today,
  urgency,
} from '../utils'

interface Item {
  id: string
  date: string
  time?: string
  title: string
  sub: string
  color: string
  kind: 'entrega' | 'pagamento' | 'evento'
  link?: string
  event?: CalendarEvent
  done?: boolean
}

type Layer = 'entrega' | 'pagamento' | 'evento'

export default function Agenda() {
  const { data, upsert } = useStore()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(today())
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ entrega: true, pagamento: true, evento: true })
  const [form, setForm] = useState<{ ev?: CalendarEvent; date?: string } | null>(null)

  const items = useMemo(() => {
    const list: Item[] = []
    data.projects.forEach((p) => {
      if (!p.dueDate || p.status === 'cancelado') return
      const client = data.clients.find((c) => c.id === p.clientId)
      list.push({
        id: `p-${p.id}`,
        date: p.status === 'entregue' && p.deliveredDate ? p.deliveredDate : p.dueDate,
        title: p.title,
        sub: `${p.status === 'entregue' ? 'Entregue' : 'Prazo de entrega'} · ${client?.name ?? ''}`,
        color: isOpen(p) ? PRIORITY[urgency(p).level].color : '#2f855a',
        kind: 'entrega',
        link: href('projetos', p.id),
        done: !isOpen(p),
      })
    })
    allPayments(data).forEach(({ pay, project, client }) => {
      if (!pay.paidDate && !pay.dueDate) return // cobrado na conclusão, sem prazo definido
      list.push({
        id: `pay-${pay.id}`,
        date: pay.paidDate ?? pay.dueDate,
        title: `${money(pay.amount)} · ${client?.name ?? ''}`,
        sub: `${pay.paidDate ? 'Recebido' : 'A receber'} · ${pay.description}`,
        color: '#2f855a',
        kind: 'pagamento',
        link: href('projetos', project.id),
        done: !!pay.paidDate,
      })
    })
    data.events.forEach((e) =>
      list.push({
        id: `e-${e.id}`,
        date: e.date,
        time: e.time,
        title: e.title,
        sub: EVENT_TYPES[e.type].label,
        color: EVENT_TYPES[e.type].color,
        kind: 'evento',
        event: e,
        done: e.done,
      }),
    )
    return list.filter((i) => layers[i.kind]).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
  }, [data, layers])

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>()
    items.forEach((i) => m.set(i.date, [...(m.get(i.date) ?? []), i]))
    return m
  }, [items])

  const start = new Date(cursor)
  start.setDate(1 - start.getDay())
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toISO(d)
  })
  const t = today()
  const dayItems = byDay.get(selected) ?? []
  const upcoming = items.filter((i) => i.date >= t && !i.done).slice(0, 12)

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))

  const [connect, setConnect] = useState(false)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Agenda</p>
          <div className="month-nav">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior">
              <Icon name="chevronL" />
            </button>
            <MonthPicker
              value={`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`}
              from="2026-01"
              onChange={(k) => setCursor(new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1))}
            />
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês">
              <Icon name="chevronR" />
            </button>
            <button
              className="btn small ghost"
              onClick={() => {
                const d = new Date()
                setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
                setSelected(today())
              }}
            >
              Hoje
            </button>
          </div>
        </div>
        <div className="row gap-s wrap">
          <button className="btn ghost" onClick={() => setConnect(true)}>
            <Icon name="phone" size={16} /> Conectar ao celular
          </button>
          <button className="btn primary" onClick={() => setForm({ date: selected })}>
            <Icon name="plus" size={16} /> Compromisso
          </button>
        </div>
      </div>

      <div className="toolbar">
        {(
          [
            ['entrega', 'Prazos de entrega'],
            ['pagamento', 'Pagamentos'],
            ['evento', 'Compromissos e faculdade'],
          ] as [Layer, string][]
        ).map(([k, label]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {label}
          </label>
        ))}
      </div>

      <div className="agenda">
        <div className="calendar card">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-head">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const inMonth = parseISO(d).getMonth() === cursor.getMonth()
            const list = byDay.get(d) ?? []
            return (
              <button
                key={d}
                className={`cal-day ${inMonth ? '' : 'out'} ${d === t ? 'today' : ''} ${d === selected ? 'selected' : ''}`}
                onClick={() => setSelected(d)}
                onDoubleClick={() => setForm({ date: d })}
              >
                <span className="cal-num">{Number(d.slice(8))}</span>
                <div className="cal-items">
                  {list.slice(0, 3).map((i) => (
                    <span key={i.id} className={`cal-chip ${i.done ? 'done' : ''}`} style={{ borderLeftColor: i.color }}>
                      {i.kind === 'pagamento' ? '$ ' : ''}
                      {i.title}
                    </span>
                  ))}
                  {list.length > 3 && <span className="cal-more">+{list.length - 3}</span>}
                </div>
                <div className="cal-dots">
                  {list.slice(0, 4).map((i) => (
                    <i key={i.id} style={{ background: i.color }} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        <div className="stack">
          <Section
            title={fmtDateLong(selected) + (selected === t ? ' · hoje' : '')}
            action={
              <button className="btn small ghost" onClick={() => setForm({ date: selected })}>
                <Icon name="plus" size={14} />
              </button>
            }
          >
            {dayItems.length === 0 ? (
              <p className="muted small">Nada neste dia. Clique duas vezes num dia para criar um compromisso.</p>
            ) : (
              <ul className="agenda-list">
                {dayItems.map((i) => (
                  <AgendaRow key={i.id} i={i} onEdit={(ev) => setForm({ ev })} onToggle={(ev) => upsert('events', { ...ev, done: !ev.done })} />
                ))}
              </ul>
            )}
          </Section>
          <Section title="Próximos">
            {upcoming.length === 0 ? (
              <p className="muted small">Nada pela frente.</p>
            ) : (
              <ul className="agenda-list">
                {upcoming.map((i) => (
                  <AgendaRow key={i.id} i={i} showDate onEdit={(ev) => setForm({ ev })} onToggle={(ev) => upsert('events', { ...ev, done: !ev.done })} />
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {connect && <ConnectCalendar onClose={() => setConnect(false)} />}
      {form && <EventForm initial={form.ev} date={form.date} onClose={() => setForm(null)} />}
    </div>
  )
}

function AgendaRow({ i, showDate, onEdit, onToggle }: { i: Item; showDate?: boolean; onEdit: (e: CalendarEvent) => void; onToggle: (e: CalendarEvent) => void }) {
  const body = (
    <>
      <span className="dot" style={{ background: i.color }} />
      <div className="grow">
        <div className={`list-title ${i.done ? 'strike' : ''}`}>{i.title}</div>
        <div className="list-sub">
          {showDate && `${fmtDateLong(i.date)} · `}
          {i.time && `${i.time} · `}
          {i.sub}
        </div>
      </div>
    </>
  )
  if (i.event) {
    const ev = i.event
    return (
      <li>
        <input type="checkbox" checked={ev.done} onChange={() => onToggle(ev)} aria-label="Concluído" />
        <button className="agenda-btn" onClick={() => onEdit(ev)}>
          {body}
        </button>
      </li>
    )
  }
  return (
    <li>
      <a className="agenda-btn" href={i.link}>
        {body}
      </a>
    </li>
  )
}

function ConnectCalendar({ onClose }: { onClose: () => void }) {
  const { data, setSettings } = useStore()
  const token = data.settings.calendarToken
  const url = token ? `${SUPABASE_URL}/functions/v1/agenda?token=${token}` : ''
  const webcal = url.replace(/^https:/, 'webcal:')

  const newToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    setSettings({ calendarToken: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') })
  }
  const copy = () =>
    navigator.clipboard
      ?.writeText(url)
      .then(() => toast('Link copiado.'))
      .catch(() => toast('Selecione o link e copie manualmente.'))

  return (
    <Modal title="agenda no celular" onClose={onClose} wide>
      {CLOUD ? (
        <div className="connect">
          <p>
            Assine sua agenda do estúdio no celular: <b>entregas, parcelas a receber e compromissos</b> aparecem sozinhos no calendário do iPhone ou do Google, com lembrete
            na véspera. Tudo que você mudar aqui atualiza lá automaticamente.
          </p>
          {!token ? (
            <button className="btn primary" onClick={newToken}>
              <Icon name="link" size={16} /> gerar meu link de agenda
            </button>
          ) : (
            <>
              <div className="connect-link">
                <input id="calendar-url" readOnly value={url} onFocus={(e) => e.target.select()} />
                <button className="btn small" onClick={copy}>
                  <Icon name="copy" size={14} /> copiar
                </button>
              </div>
              <div className="connect-steps">
                <section>
                  <h3>iPhone</h3>
                  <ol>
                    <li>
                      Abra este sistema no iPhone e toque em{' '}
                      <a className="link" href={webcal}>
                        adicionar ao calendário
                      </a>
                      , ou:
                    </li>
                    <li>Ajustes → Calendário → Contas → Adicionar conta → Outra → Adicionar calendário assinado.</li>
                    <li>Cole o link e salve.</li>
                  </ol>
                </section>
                <section>
                  <h3>Android / Google Agenda</h3>
                  <ol>
                    <li>No computador, abra calendar.google.com.</li>
                    <li>Em “Outras agendas”, clique em + → “Do URL”.</li>
                    <li>Cole o link e clique em “Adicionar agenda”. Ela aparece no celular sozinha.</li>
                  </ol>
                </section>
              </div>
              <p className="muted small">
                O iPhone atualiza de hora em hora; o Google Agenda pode levar algumas horas. O link é secreto: se alguém tiver acesso a ele, gere um novo.{' '}
                <button className="link" onClick={newToken}>
                  gerar novo link
                </button>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="connect">
          <p>
            A sincronização automática funciona quando o login na nuvem está ligado (veja o README). Por enquanto, você pode baixar a agenda e importar uma vez no calendário do
            celular.
          </p>
          <button className="btn" onClick={() => download(`agenda-${today()}.ics`, buildICS(data, data.settings.brandName), 'text/calendar')}>
            <Icon name="download" size={16} /> baixar agenda (.ics)
          </button>
        </div>
      )}
    </Modal>
  )
}
