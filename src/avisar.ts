import { useCallback, useEffect, useRef } from 'react'
import { CLOUD, supabase } from './cloud'
import { useStore } from './store'
import { toast } from './components/dialog'
import { notifyDevice } from './briefingSync'
import { checkSignMessage } from './contractSign'
import type { Notice, QuoteApproval } from './types'
import { proposalChoices } from './proposalLink'
import { draftQuote } from './quoteActions'
import type { PageRequest } from './studioPage'
import type { Client, ContractData } from './types'
import { applyToClient, cancelDataLink } from './contractData'
import { BOTH, quoteNumber, today, uid } from './utils'
import { applyReview, type ReviewFeedback } from './review'

/* Avisos do cliente final para o profissional: assinatura de contrato e recado pelo painel.
   A página pública (sem login) manda para a função "avisos": ela guarda o aviso, manda o e-mail
   para o profissional e uma cópia para o cliente. O sistema aberto lê, registra e mostra na central. */

export interface ClientEvent {
  user: string // conta do profissional
  kind: 'assinatura' | 'recado' | 'aprovacao' | 'visualizou' | 'pedido' | 'dados' | 'imagens'
  ref: string // o que é (token do contrato, id do recado): não repete
  cliente: string
  titulo: string
  texto?: string
  code?: string // assinatura: o código que confere com o texto do contrato
  clienteEmail?: string
  painel?: string // token do painel (recados) ou da proposta (aprovação)
  opcao?: string // aprovação: opção escolhida
  studio?: string
  link?: string // assinatura: endereço da cópia do contrato assinado
}

const LOCAL = 'avisos-de-clientes'
type Row = { id: string | number; kind: string; ref: string; payload: { cliente?: string; titulo?: string; texto?: string; code?: string; painel?: string; contato?: string; opcao?: string }; created_at: string }

/** Manda o aviso (página pública). Sem nuvem (prévia), fica neste navegador. Nunca trava a página. */
export async function avisar(ev: ClientEvent): Promise<boolean> {
  if (CLOUD && ev.user) {
    try {
      const { error } = await supabase!.functions.invoke('avisos', { body: { tipo: 'cliente', ...ev } })
      return !error
    } catch {
      return false
    }
  }
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL) || '[]') as Row[]
    if (!all.some((r) => r.kind === ev.kind && r.ref === ev.ref)) {
      all.push({ id: uid(), kind: ev.kind, ref: ev.ref, payload: { cliente: ev.cliente, titulo: ev.titulo, texto: ev.texto, code: ev.code, painel: ev.painel, contato: ev.clienteEmail, opcao: ev.opcao }, created_at: new Date().toISOString() })
      localStorage.setItem(LOCAL, JSON.stringify(all.slice(-50)))
    }
    return true
  } catch {
    return false
  }
}

async function pending(userId: string): Promise<Row[]> {
  if (CLOUD && userId) {
    const { data, error } = await supabase!.from('client_events').select('id, kind, ref, payload, created_at').eq('user_id', userId).is('seen_at', null).order('created_at').limit(50)
    return error ? [] : ((data ?? []) as Row[])
  }
  try {
    return JSON.parse(localStorage.getItem(LOCAL) || '[]') as Row[]
  } catch {
    return []
  }
}

async function markSeen(userId: string, rows: Row[]) {
  if (!rows.length) return
  if (CLOUD && userId) {
    await supabase!
      .from('client_events')
      .update({ seen_at: new Date().toISOString() })
      .in(
        'id',
        rows.map((r) => r.id),
      )
    return
  }
  const ids = new Set(rows.map((r) => r.id))
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL) || '[]') as Row[]
    localStorage.setItem(LOCAL, JSON.stringify(all.filter((r) => !ids.has(r.id))))
  } catch {
    /* nada */
  }
}

/** Cria um aviso na central (uma vez por `ref`). */
export function makeNotice(n: Omit<Notice, 'id' | 'at'>): Notice {
  return { id: uid(), at: new Date().toISOString(), ...n }
}

/** Lê os avisos que chegaram dos clientes (ao abrir, ao voltar para a aba e de tempos em tempos). */
export function useClientInbox(enabled: boolean) {
  const { data, upsert, userId } = useStore()
  const check = useCallback(async () => {
    const rows = await pending(userId).catch(() => [] as Row[])
    if (!rows.length) return
    const d = data
    const seen = new Set((d.notices ?? []).map((n) => n.ref).filter(Boolean))
    const done: Row[] = []
    for (const r of rows) {
      const key = `${r.kind}:${r.ref}`
      if (seen.has(key)) {
        done.push(r)
        continue
      }
      const p = r.payload ?? {}
      if (r.kind === 'assinatura') {
        const c = (d.contracts ?? []).find((x) => x.signToken === r.ref)
        if (!c) continue // contrato de outro aparelho ainda não sincronizado: tenta depois
        const client = d.clients.find((x) => x.id === c.clientId)
        const res = c.sign ? { sign: c.sign } : await checkSignMessage(`código da assinatura: ${p.code ?? ''}`, c.signToken, c.body)
        if (res.sign && !c.sign) upsert('contracts', { ...c, sign: res.sign, status: 'assinado' })
        const ok = !!res.sign
        upsert(
          'notices',
          makeNotice({
            kind: 'assinatura',
            ref: key,
            clientId: c.clientId,
            link: `contratos/${c.id}`,
            title: ok ? `${client?.name ?? p.cliente ?? 'Cliente'} assinou o contrato` : `Assinatura de ${p.cliente || 'cliente'} não confere`,
            text: ok ? `“${c.title}” já está como assinado, com o certificado no PDF.` : 'O texto do contrato mudou depois do envio. Mande o link de novo para assinar a versão atual.',
          }),
        )
        if (ok) {
          toast(`${client?.name.split(' ')[0] ?? 'O cliente'} assinou o contrato`)
          notifyDevice(`${client?.name ?? 'Cliente'} assinou o contrato`, `“${c.title}” está assinado.`)
        }
      } else if (r.kind === 'aprovacao') {
        const q = d.quotes.find((x) => x.shareToken && x.shareToken === p.painel)
        if (!q) continue // orçamento de outro aparelho ainda não sincronizado: tenta depois
        const client = d.clients.find((x) => x.id === q.clientId)
        const opt = p.opcao ?? ''
        const valid = !opt || opt === BOTH || q.options.some((o) => o.id === opt)
        const label = proposalChoices(q).find((c) => c.id === opt)?.label
        const note = label && p.texto?.startsWith(label) ? p.texto.slice(label.length).replace(/^\s*·\s*/, '') : p.texto
        if (!q.clientApproval && q.status !== 'aprovado') {
          const approval: QuoteApproval = { at: r.created_at, option: valid ? opt : '', ...(label ? { label } : {}), ...(p.cliente ? { name: p.cliente } : {}), ...(note ? { note } : {}) }
          upsert('quotes', { ...q, clientApproval: approval, ...(valid && opt ? { chosenOption: opt } : {}) })
          if (client) upsert('clients', { ...client, history: [...client.history, { id: uid(), date: today(), text: `aprovou a proposta ${quoteNumber(q)} pelo link${label ? ` (${label})` : ''}${note ? `: ${note}` : ''}` }] })
        }
        const who = client?.name ?? p.cliente ?? 'A cliente'
        upsert('notices', makeNotice({ kind: 'aprovacao', ref: key, clientId: q.clientId, link: `orcamentos/${q.id}`, title: `${who} aprovou a proposta ${quoteNumber(q)}`, text: [label, note].filter(Boolean).join(' · ') || 'Abra o orçamento para fechar: cria a demanda e lança os pagamentos.' }))
        toast(`${who.split(' ')[0]} aprovou a proposta ${quoteNumber(q)}`)
        notifyDevice(`${who} aprovou a proposta`, label ?? quoteNumber(q))
      } else if (r.kind === 'visualizou') {
        const q = d.quotes.find((x) => x.shareToken && x.shareToken === p.painel)
        if (!q) continue // orçamento de outro aparelho ainda não sincronizado: tenta depois
        const views = (q.views ?? 0) + 1
        upsert('quotes', { ...q, viewedAt: q.viewedAt || r.created_at, lastViewedAt: r.created_at, views })
        if (!q.clientApproval && q.status !== 'aprovado') {
          const client = d.clients.find((x) => x.id === q.clientId)
          const who = client?.name ?? p.cliente ?? 'A cliente'
          const title = views === 1 ? `${who} abriu a proposta ${quoteNumber(q)}` : `${who} abriu de novo a proposta ${quoteNumber(q)} (${views}ª vez)`
          upsert('notices', makeNotice({ kind: 'visualizou', ref: key, clientId: q.clientId, link: `orcamentos/${q.id}`, title, text: views === 1 ? 'Bom momento para uma mensagem: ela acabou de ver.' : 'Voltar à proposta é sinal de interesse. Que tal perguntar se ficou alguma dúvida?' }))
          toast(title)
          notifyDevice(title, q.title || '')
        }
      } else if (r.kind === 'pedido') {
        // pedido pela página do profissional: cliente novo (ou o mesmo, pelo WhatsApp/e-mail) + rascunho de orçamento
        let req: PageRequest = { phone: '', services: [] }
        try {
          req = { ...req, ...(JSON.parse(p.code || '{}') as PageRequest) }
        } catch {
          /* pedido sem detalhes */
        }
        const digits = (v: string) => v.replace(/\D/g, '').slice(-9)
        const mail = (p.contato ?? '').trim().toLowerCase()
        const same = d.clients.find((c) => (req.phone && digits(c.phone) && digits(c.phone) === digits(req.phone)) || (mail && c.email.trim().toLowerCase() === mail))
        const client: Client = same ?? {
          id: uid(),
          name: p.cliente || 'Contato da página',
          company: '',
          type: d.settings.workProfile === 'final' ? 'final' : 'outro',
          email: mail,
          phone: req.phone,
          instagram: '',
          city: req.city ?? '',
          document: '',
          origin: 'página (link da bio)',
          notes: '',
          favorite: false,
          history: [],
          archived: false,
          createdAt: today(),
        }
        const what = p.titulo || 'pedido de orçamento'
        upsert('clients', { ...client, history: [...client.history, { id: uid(), date: today(), text: `pediu orçamento pela página: ${what}${req.area ? ` · ${req.area} m²` : ''}${p.texto ? ` · “${p.texto}”` : ''}` }] })
        const q = draftQuote(d, client.id, what === 'pedido de orçamento' ? '' : what, req.services ?? [], req.area ?? 0)
        upsert('quotes', q)
        const who = client.name
        upsert('notices', makeNotice({ kind: 'pedido', ref: key, clientId: client.id, link: `orcamentos/${q.id}`, title: `${who} pediu um orçamento`, text: [what, req.area ? `${req.area} m²` : '', p.texto].filter(Boolean).join(' · ') + ' · o rascunho já está pronto.' }))
        toast(`${who.split(' ')[0]} pediu um orçamento pela sua página`)
        notifyDevice(`${who} pediu um orçamento`, what)
      } else if (r.kind === 'dados') {
        // dados para o contrato que vieram pelo plano B do link (arquivo público): entram no cadastro
        const c = d.clients.find((x) => x.dataLink?.id === r.ref)
        if (!c) continue // cliente de outro aparelho ainda não sincronizado: tenta depois
        let got: ContractData | null = null
        try {
          got = JSON.parse(p.code || 'null') as ContractData
        } catch {
          got = null
        }
        if (got?.person) {
          const next = applyToClient(c, { ...got, by: 'cliente', updatedAt: r.created_at })
          upsert('clients', { ...next, dataLink: { ...c.dataLink!, status: 'respondido', answeredAt: r.created_at }, history: [...next.history, { id: uid(), date: today(), text: 'mandou os dados para o contrato pelo link' }] })
          upsert('notices', makeNotice({ kind: 'briefing', ref: key, clientId: c.id, link: 'dados-contrato', title: `${c.name} mandou os dados do contrato`, text: 'Já estão no cadastro e entram sozinhos no contrato.' }))
          toast(`${c.name.split(' ')[0]} mandou os dados do contrato`)
          notifyDevice(`${c.name} mandou os dados do contrato`, 'Já estão no cadastro.')
          void cancelDataLink(r.ref, userId)
        }
      } else if (r.kind === 'imagens') {
        // resposta do cliente às imagens da demanda: aprovou ou marcou pontos para ajustar
        let fb: ReviewFeedback | null = null
        try {
          fb = JSON.parse(p.code || 'null') as ReviewFeedback
        } catch {
          fb = null
        }
        const proj = fb ? d.projects.find((x) => x.id === fb!.p) : undefined
        if (!fb || !proj) {
          if (fb && !d.projects.length) continue // dados ainda chegando: tenta depois
          done.push(r)
          continue
        }
        const { next, scene } = applyReview(proj, fb, r.created_at, p.cliente || undefined)
        if (!scene) continue // cena de outro aparelho ainda não sincronizada: tenta depois
        upsert('projects', next)
        const client = d.clients.find((x) => x.id === proj.clientId)
        const who = client?.name ?? p.cliente ?? 'O cliente'
        const pins = fb.pins.filter((x) => x.text.trim()).length
        const title = fb.ok ? `${who} aprovou “${scene.name}”` : `${who} pediu ajustes em “${scene.name}”`
        const text = fb.ok ? `Versão ${fb.v} aprovada.` : [pins ? `${pins} ponto${pins > 1 ? 's' : ''} marcado${pins > 1 ? 's' : ''} na imagem` : '', fb.note?.trim()].filter(Boolean).join(' · ') || `Versão ${fb.v}.`
        if (client) upsert('clients', { ...client, history: [...client.history, { id: uid(), date: today(), text: `${fb.ok ? 'aprovou' : 'pediu ajustes em'} “${scene.name}” (v${fb.v}) pela página` }] })
        upsert('notices', makeNotice({ kind: 'imagens', ref: key, clientId: proj.clientId, link: `projetos/${proj.id}`, title, text }))
        toast(title)
        notifyDevice(title, text)
      } else if (r.kind === 'recado') {
        const client = d.clients.find((x) => x.panel?.token === p.painel)
        if (client) upsert('clients', { ...client, history: [...client.history, { id: uid(), date: today(), text: `recado pelo painel: ${p.texto ?? ''}` }] })
        upsert('notices', makeNotice({ kind: 'recado', ref: key, clientId: client?.id, link: client ? `clientes/${client.id}` : undefined, title: `Recado de ${client?.name ?? p.cliente ?? 'cliente'}`, text: p.texto }))
        toast(`Recado novo de ${client?.name.split(' ')[0] ?? p.cliente ?? 'cliente'}`)
        notifyDevice(`Recado de ${client?.name ?? p.cliente ?? 'cliente'}`, p.texto ?? '')
      }
      done.push(r)
    }
    await markSeen(userId, done).catch(() => undefined)
  }, [data, upsert, userId])
  const latest = useRef(check)
  latest.current = check
  useEffect(() => {
    if (!enabled) return
    const run = () => void latest.current()
    const first = setTimeout(run, 1500) // deixa os dados da nuvem chegarem antes
    const iv = setInterval(run, 3 * 60_000)
    const onVis = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(first)
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled])
  return { check: () => latest.current() }
}
