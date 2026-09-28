import { useEffect, useMemo, useState } from 'react'
import { useKeep } from '../keep'
import { useStore } from '../store'
import { href } from '../router'
import { Icon } from '../components/Icon'
import { EventForm } from '../components/forms'
import { Modal, MonthPicker, Section } from '../components/ui'
import { ask, toast } from '../components/dialog'
import { CLOUD, agendaUrl } from '../cloud'
import { buildICS } from '../ics'
import type { CalendarEvent } from '../types'
import {
  EVENT_TYPES, eventLabel,
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
  urgency, holidayName, isWeekend } from '../utils'

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
  const { data, upsert, agenda } = useStore()
  const [month, setMonth] = useKeep('ag-mes', today().slice(0, 7))
  const cursor = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
  const setCursor = (d: Date) => setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  const [selected, setSelected] = useKeep('ag-dia', today())
  const [layers, setLayers] = useKeep<Record<Layer, boolean>>('ag-camadas', { entrega: true, pagamento: true, evento: true })
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
        sub: eventLabel(e),
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
            <Icon name="smartphone" size={16} /> {data.settings.calendarToken ? 'agenda no celular' : 'conectar ao celular'}
            {data.settings.calendarToken && <span className={`sync-dot${agenda.state === 'erro' ? ' is-error' : ''}`} title={agenda.state === 'erro' ? 'a agenda não está sendo publicada — toque para ver' : 'ligada'} />}
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
            const holiday = holidayName(d)
            return (
              <button
                key={d}
                title={holiday}
                className={`cal-day ${inMonth ? '' : 'out'} ${d === t ? 'today' : ''} ${d === selected ? 'selected' : ''} ${isWeekend(d) ? 'weekend' : ''} ${holiday ? 'holiday' : ''}`}
                onClick={() => setSelected(d)}
                onDoubleClick={() => setForm({ date: d })}
              >
                <span className="cal-num">{Number(d.slice(8))}</span>
                {holiday && <span className="cal-holiday">{holiday}</span>}
                <div className="cal-items">
                  {list.slice(0, 3).map((i) => (
                    <span key={i.id} className={`cal-chip ${i.done ? 'done' : ''}`} style={{ borderLeftColor: i.color }}>
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
            title={fmtDateLong(selected) + (selected === t ? ' · hoje' : '') + (holidayName(selected) ? ` · ${holidayName(selected)}` : isWeekend(selected) ? ' · fim de semana' : '')}
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
        <button className="agenda-btn" onClick={() => onEdit(ev)}>
          {body}
        </button>
        <input type="checkbox" className="agenda-done" checked={ev.done} onChange={() => onToggle(ev)} aria-label="Concluído" title="Marcar como feito" />
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

/** Ajuste único no Supabase para a agenda do celular (mesmo texto do supabase/schema.sql). */
const AGENDA_SQL = `insert into storage.buckets (id, name, public) values ('agenda', 'agenda', true) on conflict (id) do update set public = true;
drop policy if exists "agenda: dona vê" on storage.objects;
drop policy if exists "agenda: dona cria" on storage.objects;
drop policy if exists "agenda: dona altera" on storage.objects;
drop policy if exists "agenda: dona apaga" on storage.objects;
create policy "agenda: dona vê" on storage.objects for select to authenticated using (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "agenda: dona cria" on storage.objects for insert to authenticated with check (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "agenda: dona altera" on storage.objects for update to authenticated using (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "agenda: dona apaga" on storage.objects for delete to authenticated using (bucket_id = 'agenda' and (storage.foldername(name))[1] = auth.uid()::text);`

function ConnectCalendar({ onClose }: { onClose: () => void }) {
  const { data, setSettings, userId, agenda, publishAgendaNow } = useStore()
  const token = data.settings.calendarToken
  const sync = { entregas: true, pagamentos: true, compromissos: true, periodos: true, ...(data.settings.calendarSync ?? {}) }
  const url = token && userId ? agendaUrl(userId, token) : ''
  // ao abrir (e depois de ligar), publica na hora para já dar para adicionar no celular
  useEffect(() => {
    if (CLOUD && token) void publishAgendaNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  const webcal = url.replace(/^https:/, 'webcal:')
  const [device, setDevice] = useState<'iphone' | 'android' | 'outro'>(() => (/iphone|ipad|mac/i.test(navigator.userAgent) ? 'iphone' : /android/i.test(navigator.userAgent) ? 'android' : 'iphone'))

  const newToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    setSettings({ calendarToken: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') })
  }
  const copy = () =>
    navigator.clipboard
      ?.writeText(url)
      .then(() => toast('Link copiado.'))
      .catch(() => toast('Selecione o link e copie manualmente.'))
  const turnOff = async () => {
    if (!(await ask('Desligar a agenda do celular? O link para de funcionar e nada mais é enviado. Depois apague a agenda assinada no celular.', { confirmLabel: 'desligar', danger: true }))) return
    setSettings({ calendarToken: '' })
  }

  const options = (
    <div className="sync-options">
      <span className="field-label">o que vai para o celular</span>
      {(
        [
          ['entregas', 'prazos de entrega das demandas'],
          ['pagamentos', 'parcelas a receber'],
          ['periodos', 'dias de produção pintados (do início até a entrega)'],
          ['compromissos', 'compromissos da agenda'],
        ] as const
      ).map(([k, label]) => (
        <label key={k} className="check toggle">
          <input type="checkbox" checked={sync[k]} onChange={(e) => setSettings({ calendarSync: { ...sync, [k]: e.target.checked } })} /> {label}
        </label>
      ))}
      <p className="muted small">Quer deixar algo de fora? Em cada compromisso desmarque “mandar para a agenda do celular”; em cada demanda, toque em “tirar” embaixo do prazo.</p>
    </div>
  )

  if (!CLOUD)
    return (
      <Modal title="agenda no celular" onClose={onClose} wide>
        <div className="connect">
          <p>A agenda automática funciona na versão com login. Aqui dá para baixar a agenda e importar uma vez no calendário do celular.</p>
          <button className="btn" onClick={() => download(`agenda-${today()}.ics`, buildICS(data, data.settings.brandName), 'text/calendar')}>
            <Icon name="download" size={16} /> baixar agenda (.ics)
          </button>
        </div>
      </Modal>
    )

  return (
    <Modal title="agenda no celular" onClose={onClose} wide>
      <div className="connect">
        {!token ? (
          <>
            <p>
              <b>Opcional.</b> Ligando, os prazos de entrega, os dias de produção, as parcelas a receber e os compromissos aparecem <b>sozinhos</b> no calendário do celular (iPhone, Android ou
              outro), com lembrete 2 dias antes, na véspera e no dia. Tudo que você criar ou mudar aqui atualiza lá, sem precisar fazer nada.
            </p>
            {options}
            <button className="btn primary" onClick={newToken}>
              <Icon name="smartphone" size={16} /> ligar agenda no celular
            </button>
          </>
        ) : (
          <>
            {agenda.state === 'erro' ? (
              <div className="sync-error">
                <b>A agenda ainda não pode ser publicada.</b>
                <p className="small">
                  Falta um ajuste único no Supabase: SQL Editor → New query → cole o código abaixo → Run. Depois toque em <b>tentar de novo</b>.
                </p>
                <textarea readOnly rows={4} value={AGENDA_SQL} onFocus={(e) => e.target.select()} />
                <div className="row gap-s">
                  <button className="btn small" onClick={() => navigator.clipboard?.writeText(AGENDA_SQL).then(() => toast('Código copiado.'))}>
                    <Icon name="copy" size={14} /> copiar código
                  </button>
                  <button className="btn small primary" onClick={() => void publishAgendaNow()}>
                    tentar de novo
                  </button>
                </div>
                <p className="muted small">detalhe: {agenda.error}</p>
              </div>
            ) : (
              <p className="sync-on">
                <Icon name="check" size={16} />
                {agenda.state === 'ok' ? `Agenda publicada às ${agenda.at!.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. ` : 'Publicando a agenda… '}
                Falta só adicionar no seu celular (uma vez):
              </p>
            )}
            <div className="segmented sync-device">
              {(
                [
                  ['iphone', 'iPhone'],
                  ['android', 'Android / Google'],
                  ['outro', 'outro'],
                ] as const
              ).map(([k, l]) => (
                <button key={k} className={device === k ? 'active' : ''} onClick={() => setDevice(k)}>
                  {l}
                </button>
              ))}
            </div>
            {device === 'iphone' && (
              <ol className="sync-steps">
                <li>
                  Abra este sistema <b>no iPhone</b> e toque em{' '}
                  <a className="btn small primary" href={webcal}>
                    <Icon name="calendar" size={14} /> adicionar ao iPhone
                  </a>
                </li>
                <li>Toque em “Assinar”. Na tela seguinte, <b>desligue “Remover alertas”</b> (senão o iPhone apaga os lembretes) e toque em “Adicionar”.</li>
                <li>
                  Para atualizar sozinho: Ajustes → Calendário → Contas → <b>Buscar dados</b> → escolha <b>a cada 15 minutos</b> ou <b>de hora em hora</b> (em “Manual” ele nunca
                  atualiza).
                </li>
                <li className="muted small">Já tinha assinado e os lembretes não chegam? Ajustes → Calendário → Contas → Calendários assinados → toque na agenda → desligue “Remover alertas”.</li>
                <li className="muted small">A agenda vem na cor da sua marca. Se já tinha assinado antes e ficou de outra cor: Calendário → Calendários → ⓘ ao lado da agenda → Cor → Personalizada.</li>
                <li className="muted small">Se o botão não abrir: Ajustes → Calendário → Contas → Adicionar conta → Outra → Adicionar calendário assinado → cole o link abaixo.</li>
              </ol>
            )}
            {device === 'android' && (
              <ol className="sync-steps">
                <li>
                  Toque em{' '}
                  <a className="btn small primary" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer">
                    <Icon name="calendar" size={14} /> adicionar ao Google Agenda
                  </a>
                </li>
                <li>Entre com a sua conta Google e confirme “Adicionar”. A agenda aparece no app Google Agenda do celular.</li>
                <li className="muted small">O Google escolhe a cor sozinho: no computador, em calendar.google.com, passe o mouse na agenda → ⋮ → escolha a cor (o + permite a cor exata da sua marca).</li>
                <li className="muted small">Se não abrir: no computador, calendar.google.com → “Outras agendas” → + → “Do URL” → cole o link abaixo.</li>
              </ol>
            )}
            {device === 'outro' && (
              <ol className="sync-steps">
                <li>No app de calendário (Outlook, Samsung…), procure “assinar calendário” ou “adicionar por URL”.</li>
                <li>Cole o link abaixo.</li>
              </ol>
            )}
            <div className="connect-link">
              <input id="calendar-url" readOnly value={url} onFocus={(e) => e.target.select()} />
              <button className="btn small" onClick={copy}>
                <Icon name="copy" size={14} /> copiar
              </button>
            </div>
            {options}
            <p className="muted small">
              O iPhone busca novidades a cada hora (ou ao abrir o Calendário); o Google pode levar algumas horas. O link é secreto: se alguém tiver acesso a ele,{' '}
              <button className="link" onClick={newToken}>
                gere um novo
              </button>{' '}
              ·{' '}
              <button className="link" onClick={turnOff}>
                desligar
              </button>
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
