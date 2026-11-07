// planê.apê: loja (pedido com CPF, Pix na página, cartão no Asaas), entrega com marca de licença, bônus de 7 dias,
// plataforma do apê, recuperação de compras, reembolso e leitura automática dos orçamentos.
// Importado pelo index.ts da função "pagamentos". O preço nunca vem do navegador.

import { PDFDocument, StandardFonts, rgb, degrees } from 'npm:pdf-lib@1.17.1'
import { unzipSync } from 'npm:fflate@0.8.2'
import { makeConta } from './conta.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

type J = Record<string, any>
export interface Deps {
  db: SupabaseClient
  asaas: (path: string, init?: RequestInit) => Promise<J>
  json: (body: unknown, status?: number) => Response
  site: string
  env: (k: string, d?: string) => string
}

/* ===== preços (mesmas regras de src/ape/model.ts) ===== */
const PIX_PCT = 5
const TERMOS_VERSAO = '2026-11-07b'
const BONUS_DIAS = 7
const KIT_PLATAFORMA_MESES = 1
const ARQ: Record<string, [string, number]> = {
  compra: ['Guia de compra do imóvel', 19.9],
  financiamento: ['Guia do financiamento e dos seguros', 16.9],
  'planilha-compra': ['Planilha de custos da compra', 19.9],
  decorado: ['Checklist da visita e documentos', 12.9],
  checklist: ['Checklist de vistoria', 19.9],
  planilha: ['Planilha de obra e compras', 24.9],
  guia: ['Guia de orçamentos', 14.9],
  medidas: ['Guia de medidas', 16.9],
  entregas: ['Checklist de entregas da obra', 12.9],
  enxoval: ['Planilha do enxoval', 14.9],
  mudanca: ['Lista da mudança', 12.9],
  planner: ['Planner de decoração', 17.9],
  pedras: ['Guia das pedras para bancada', 16.9],
  pisos: ['Guia de pisos e revestimentos', 16.9],
  marcenaria: ['Guia da marcenaria planejada', 16.9],
  banheiro: ['Guia de louças, metais e box', 14.9],
  cozinha: ['Guia da cozinha e dos eletros', 14.9],
  iluminacao: ['Guia de iluminação', 14.9],
  eletrica: ['Guia de tomadas e elétrica', 12.9],
  tintas: ['Guia de tintas e paredes', 12.9],
  gesso: ['Guia de gesso, forro e sancas', 12.9],
  ar: ['Guia do ar-condicionado', 12.9],
  cortinas: ['Guia de cortinas e persianas', 12.9],
  seguranca: ['Guia de segurança e proteção do apê', 12.9],
}
const ESCOLHAS = ['pedras', 'pisos', 'marcenaria', 'banheiro', 'cozinha', 'iluminacao', 'eletrica', 'tintas', 'gesso', 'ar', 'cortinas', 'seguranca']
const PLATAFORMA_PRECO = 89.9
const JUROS_PCT = 2.99
/** Parcelas do cartão: 1x sem juros; 2x a 12x com juros compostos (tabela Price), parcela mínima de R$ 5. Mesma conta do site. */
function parcelar(total: number, n: number, jurosPct: number) {
  if (n <= 1) return { n: 1, parcela: c2(total), total: c2(total) }
  const i = jurosPct / 100
  const parcela = i > 0 ? c2((total * i) / (1 - Math.pow(1 + i, -n))) : c2(total / n)
  return parcela < 5 ? null : { n, parcela, total: c2(parcela * n) }
}
const KITS: Record<string, [string, number, string[]]> = {
  'kit-compra': ['Kit vou comprar', 35, ['compra', 'financiamento', 'planilha-compra', 'decorado']],
  'kit-chaves': ['Kit chaves na mão', 23, ['checklist', 'entregas', 'mudanca']],
  'kit-obra': ['Kit obra sem susto', 29, ['planilha', 'guia', 'medidas']],
  'kit-completo': ['Kit completo', 63, ['compra', 'financiamento', 'planilha-compra', 'decorado', 'checklist', 'planilha', 'guia', 'medidas', 'entregas', 'enxoval', 'mudanca', 'planner', ...ESCOLHAS]],
  'kit-escolhas': ['Kit escolhas da obra', 45, ESCOLHAS],
}
const c2 = (n: number) => Math.round(n * 100) / 100
const reais = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
export const precoKit = (soma: number, pct: number) => c2(Math.max(0.9, Math.floor(soma * (1 - pct / 100) - 0.9 + 1e-9) + 0.9))
type Item = { id: string; nome: string; preco: number; cat: string; combo: string[] }

export function makeApe({ db, asaas, json, site, env }: Deps) {
  const APE_SITE = `${site.replace(/\/$/, '')}/ape/`

  async function loja() {
    const { data } = await db.from('ape_ajustes').select('data').eq('id', 1).maybeSingle()
    const a = (data?.data ?? {}) as J
    const map: Record<string, Item> = {}
    let saved = Number(a.lojaV ?? 0) >= 7 && Array.isArray(a.produtos) ? (a.produtos as J[]) : null
    if (saved && Number(a.lojaV ?? 0) < 8) {
      // loja v8 (igual ao site): plataforma a R$ 89,90, kit completo com todos os arquivos e os arquivos novos
      saved = saved.map((p) => (p.id === 'plataforma' ? { ...p, preco: PLATAFORMA_PRECO } : p.id === 'kit-completo' ? { ...p, combo: KITS['kit-completo'][2], kitPct: KITS['kit-completo'][1] } : p))
      for (const id of ESCOLHAS) if (!saved.some((p) => p.id === id)) saved.push({ id, nome: ARQ[id][0], preco: ARQ[id][1], cat: 'arquivos', ativo: true })
      if (!saved.some((p) => p.id === 'kit-escolhas')) saved.push({ id: 'kit-escolhas', nome: KITS['kit-escolhas'][0], cat: 'combos', ativo: true, combo: ESCOLHAS, kitPct: KITS['kit-escolhas'][1], preco: 0 })
    }
    if (saved) {
      for (const p of saved) if (p.ativo !== false && ['arquivos', 'combos', 'plataforma'].includes(p.cat ?? 'arquivos')) map[p.id] = { id: p.id, nome: String(p.nome), preco: reais(p.preco), cat: p.cat ?? 'arquivos', combo: Array.isArray(p.combo) ? p.combo.map(String) : [] }
      // kit com % de desconto: o preço sai da soma dos arquivos (igual ao site)
      for (const p of saved) if (map[p.id] && p.cat === 'combos' && Number(p.kitPct) > 0) map[p.id].preco = precoKit(map[p.id].combo.reduce((t, id) => t + (map[id]?.cat === 'arquivos' ? map[id].preco : reais(saved.find((x) => x.id === id)?.preco)), 0), Number(p.kitPct))
    } else {
      for (const [id, [nome, preco]] of Object.entries(ARQ)) map[id] = { id, nome, preco, cat: 'arquivos', combo: [] }
      for (const [id, [nome, pct, combo]] of Object.entries(KITS)) map[id] = { id, nome, preco: precoKit(combo.reduce((t, x) => t + ARQ[x][1], 0), pct), cat: 'combos', combo }
      map.plataforma = { id: 'plataforma', nome: 'Plataforma do apê (12 meses)', preco: PLATAFORMA_PRECO, cat: 'plataforma', combo: [] }
    }
    const pixPct = Number.isFinite(Number(a.pixPct)) ? Math.min(10, Math.max(0, Number(a.pixPct))) : PIX_PCT
    const jurosPct = a.jurosPct != null && Number.isFinite(Number(a.jurosPct)) ? Math.min(10, Math.max(0, Number(a.jurosPct))) : JUROS_PCT
    return { map, pixPct, jurosPct }
  }

  function conta(ids: string[], map: Record<string, Item>, forma: 'pix' | 'cartao', pixPct: number) {
    let uniq = [...new Set(ids)].filter((id) => map[id])
    const noKit = new Set(uniq.flatMap((id) => (map[id].cat === 'combos' ? map[id].combo : [])))
    uniq = uniq.filter((id) => !(map[id].cat === 'arquivos' && noKit.has(id)))
    const itens = uniq.map((id) => ({ id, nome: map[id].nome, preco: map[id].preco, cat: map[id].cat }))
    const subtotal = c2(itens.reduce((t, i) => t + i.preco, 0))
    const desconto = forma === 'pix' ? c2(subtotal * pixPct / 100) : 0
    return { itens, subtotal, desconto, total: c2(subtotal - desconto) }
  }

  const cpfOk = (v: string) => {
    const d = v.replace(/\D/g, '')
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
    const dv = (n: number) => {
      let s = 0
      for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
      const r = (s * 10) % 11
      return r === 10 ? 0 : r
    }
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
  }
  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
  const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)

  async function cliente(nome: string, cpf: string, email: string, tel: string) {
    const achado = await asaas(`/customers?cpfCnpj=${cpf}&limit=1`).catch(() => ({}) as J)
    const id = achado.data?.[0]?.id
    if (id) return String(id)
    const c = await asaas('/customers', { method: 'POST', body: JSON.stringify({ name: nome, cpfCnpj: cpf, email, mobilePhone: tel, notificationDisabled: true }) })
    return String(c.id)
  }

  async function criar(body: J) {
    const nome = String(body.nome ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
    const tel = String(body.tel ?? '').replace(/\D/g, '').slice(0, 13)
    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 160)
    const cpf = String(body.cpf ?? '').replace(/\D/g, '')
    const forma: 'pix' | 'cartao' = body.forma === 'cartao' ? 'cartao' : 'pix'
    const falta = [nome.split(' ').length < 2 && 'nome completo', !cpfOk(cpf) && 'CPF válido', !emailOk(email) && 'e-mail válido', tel.length < 10 && 'telefone com DDD'].filter(Boolean)
    if (falta.length) return json({ erro: `Confira: ${falta.join(', ')}.` }, 400)
    if (body.aceite !== true) return json({ erro: 'Aceite os termos de uso antes de pagar.' }, 400)
    const { map, pixPct, jurosPct } = await loja()
    const c = conta(Array.isArray(body.itens) ? body.itens.map(String).slice(0, 30) : [], map, forma, pixPct)
    if (!c.itens.length) return json({ erro: 'O carrinho está vazio.' }, 400)
    if (c.total < 5) return json({ erro: 'Valor mínimo de R$ 5,00.' }, 400)
    // cartão parcelado: o servidor refaz a conta dos juros (não confia no valor que veio do site)
    const nParc = forma === 'cartao' ? Math.min(12, Math.max(1, Math.floor(Number(body.parcelas) || 1))) : 1
    const parc = parcelar(c.total, nParc, jurosPct)
    if (!parc) return json({ erro: 'Parcela abaixo de R$ 5,00: escolha menos parcelas.' }, 400)
    if (parc.n > 1) c.total = parc.total
    const morador = /^[0-9a-f-]{36}$/i.test(String(body.morador ?? '')) ? String(body.morador) : null
    const aceite = { versao: TERMOS_VERSAO, em: new Date().toISOString() }
    const { data: ped, error } = await db.from('ape_pedidos').insert({ morador, nome, tel, email, cpf, aceite, itens: c.itens, subtotal: c.subtotal, desconto: c.desconto, total: c.total, forma }).select('id, token').single()
    if (error || !ped) throw new Error(error?.message ?? 'não deu para criar o pedido')
    const customer = await cliente(nome, cpf, email, tel)
    const pay: J = {
      customer,
      billingType: forma === 'cartao' ? 'CREDIT_CARD' : 'PIX',
      ...(parc.n > 1 ? { installmentCount: parc.n, installmentValue: parc.parcela } : { value: c.total }),
      dueDate: hojeBR(),
      description: ('planê.apê · ' + c.itens.map((i) => i.nome).join(' + ') + (parc.n > 1 ? ` · ${parc.n}x de R$ ${parc.parcela.toFixed(2).replace('.', ',')} com juros` : '')).slice(0, 480),
      externalReference: `ape|${ped.id}`,
      callback: { successUrl: `${APE_SITE}#pedido:${ped.token}`, autoRedirect: true },
    }
    let made: J
    try {
      made = await asaas('/payments', { method: 'POST', body: JSON.stringify(pay) })
    } catch (e) {
      if (!/callback|successUrl|dom[ií]nio|domain/i.test(String(e))) throw e
      delete pay.callback
      made = await asaas('/payments', { method: 'POST', body: JSON.stringify(pay) })
    }
    let pix: J | null = null
    if (forma === 'pix') {
      const q = await asaas(`/payments/${made.id}/pixQrCode`).catch(() => null)
      if (q?.payload) pix = { img: q.encodedImage, copia: q.payload, expira: q.expirationDate }
    }
    await db.from('ape_pedidos').update({ asaas_pagamento: made.id, asaas_cliente: customer, pix }).eq('id', ped.id)
    return json({ token: ped.token, total: c.total, forma, pix, url: forma === 'cartao' ? made.invoiceUrl : null })
  }

  /** Libera a plataforma do apê de quem comprou (ou ganhou 1 mês no kit completo). */
  async function liberarPlataforma(ped: J) {
    const ids = ((ped.itens ?? []) as J[]).map((i) => String(i.id))
    const dias = (ids.includes('plataforma') ? 365 : 0) + (ids.includes('kit-completo') ? 30 * KIT_PLATAFORMA_MESES : 0)
    if (!dias) return null
    const { data: ja } = await db.from('ape_plataforma').select('token, validade').eq('pedido', ped.id).maybeSingle()
    if (ja) return ja
    // a mesma pessoa já tem acesso? soma os dias no acesso dela
    if (ped.cpf) {
      const { data: outro } = await db.from('ape_plataforma').select('id, token, validade').eq('cpf', ped.cpf).order('validade', { ascending: false }).limit(1).maybeSingle()
      if (outro) {
        const base = outro.validade > hojeBR() ? new Date(outro.validade) : new Date(hojeBR())
        base.setDate(base.getDate() + dias)
        const validade = base.toISOString().slice(0, 10)
        await db.from('ape_plataforma').update({ validade }).eq('id', outro.id)
        return { token: outro.token, validade }
      }
    }
    const v = new Date(hojeBR())
    v.setDate(v.getDate() + dias)
    const { data: novo } = await db.from('ape_plataforma').insert({ nome: ped.nome, email: ped.email, cpf: ped.cpf, tel: ped.tel, pedido: ped.id, validade: v.toISOString().slice(0, 10), cortesia: !!ped.cortesia }).select('token, validade').single()
    return novo
  }

  async function marcarPago(id: string, p: J) {
    const { data: ped } = await db.from('ape_pedidos').update({ status: 'pago', pago_em: new Date().toISOString(), asaas_pagamento: String(p.id ?? ''), forma: p.billingType === 'CREDIT_CARD' ? 'cartao' : 'pix', pix: null }).eq('id', id).eq('status', 'pendente').select('*').maybeSingle()
    if (ped) {
      await liberarPlataforma(ped)
      await contaApi.emailCompra(ped).catch(() => null)
    }
  }

  const PAGO = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']
  async function porToken(token: string) {
    if (!/^[0-9a-f-]{36}$/i.test(token)) return null
    const { data } = await db.from('ape_pedidos').select('*').eq('token', token).maybeSingle()
    return data as J | null
  }
  async function conferir(ped: J) {
    if (ped.status !== 'pendente') return ped
    let ok: J | undefined
    if (ped.asaas_pagamento) {
      const p = await asaas(`/payments/${ped.asaas_pagamento}`).catch(() => ({}) as J)
      if (PAGO.includes(String(p.status))) ok = p
    } else if (ped.asaas_link) {
      const r = await asaas(`/payments?paymentLink=${ped.asaas_link}&limit=10`).catch(() => ({}) as J)
      ok = ((r.data ?? []) as J[]).find((x) => PAGO.includes(String(x.status)))
    }
    if (ok) {
      await marcarPago(ped.id, ok)
      return { ...ped, status: 'pago', pago_em: new Date().toISOString() }
    }
    return ped
  }

  /** Lista o que a pessoa pode baixar: arquivos de cada produto e, depois de 7 dias, o bônus. */
  async function entregas(ped: J) {
    const { map } = await loja()
    const itens = (ped.itens ?? []) as J[]
    const ids = [...new Set(itens.flatMap((i) => (map[i.id]?.cat === 'combos' ? map[i.id].combo : KITS[i.id]?.[2] ?? [i.id])))].filter((id) => id !== 'plataforma')
    const st = db.storage.from('ape-arquivos')
    const out: { produto: string; nome: string; path: string; tipo: string; cor: string; baixa: string }[] = []
    const pasta = async (id: string, produto: string) => {
      const { data: files } = await st.list(id, { limit: 20 })
      for (const f of files ?? []) {
        if (!f.name || f.name.startsWith('.') || !f.id) continue
        const cor = (f.name.match(/-(azul|rosa|roxa|verde)\.[^.]+$/i) || [])[1]?.toLowerCase() || ''
        const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase()
        // nome bonito no download: "Guia de compra do imóvel - planê.apê.pdf" / "Planilha do enxoval (rosa) - planê.apê.xlsx"
        const baixa = `${produto.replace(/[\\/:*?"<>|]/g, '')}${cor ? ` (${cor})` : ''} - planê.apê${ext}`
        out.push({ produto, nome: f.name, path: `${id}/${f.name}`, tipo: ext === '.pdf' ? 'pdf' : /\.xlsx?$/.test(ext) ? 'planilha' : 'arquivo', cor, baixa })
      }
    }
    for (const id of ids) await pasta(id, map[id]?.nome ?? ARQ[id]?.[0] ?? id)
    const libera = ped.pago_em ? new Date(new Date(ped.pago_em).getTime() + BONUS_DIAS * 864e5) : null
    const bonusLiberado = !!libera && libera.getTime() <= Date.now()
    if (bonusLiberado) await pasta('bonus', 'Bônus - manutenção e garantias do 1º ano')
    return { arquivos: out, bonus: { liberado: bonusLiberado, em: libera?.toISOString() ?? null } }
  }

  async function pedido(body: J) {
    let ped = await porToken(String(body.token ?? ''))
    if (!ped) return json({ erro: 'Pedido não encontrado.' }, 404)
    ped = await conferir(ped)
    const base = { status: ped.status, itens: ped.itens ?? [], subtotal: ped.subtotal, desconto: ped.desconto, total: ped.total, forma: ped.forma, nome: ped.nome, email: ped.email, criado: ped.criado, cortesia: ped.cortesia }
    if (ped.status === 'pendente') return json({ ...base, pix: ped.pix ?? null })
    if (ped.status !== 'pago') return json(base)
    const plat = await liberarPlataforma(ped)
    if (!ped.email_enviado) await contaApi.emailCompra(ped).catch(() => null)
    const e = await entregas(ped)
    return json({ ...base, pago_em: ped.pago_em, ...e, plataforma: plat ? { token: plat.token, validade: plat.validade } : null })
  }

  /** Baixa um arquivo: PDF sai com a licença de quem comprou no rodapé de cada página (feito uma vez e guardado). */
  async function baixar(body: J) {
    const ped = await porToken(String(body.token ?? ''))
    if (!ped || ped.status !== 'pago') return json({ erro: 'Pedido não liberado.' }, 403)
    const path = String(body.path ?? '')
    const e = await entregas(ped)
    const f = e.arquivos.find((a) => a.path === path)
    if (!f) return json({ erro: 'Arquivo não encontrado.' }, 404)
    const st = db.storage.from('ape-arquivos')
    let final = path
    if (f.tipo === 'pdf') {
      final = `entregas/${ped.id}/${path.replace(/\//g, '__')}`
      const { data: ja } = await st.list(`entregas/${ped.id}`, { search: path.replace(/\//g, '__') })
      if (!ja?.some((x) => x.name === path.replace(/\//g, '__'))) {
        const { data: blob } = await st.download(path)
        if (!blob) return json({ erro: 'Arquivo indisponível.' }, 404)
        try {
          const bytes = await licenciar(new Uint8Array(await blob.arrayBuffer()), ped)
          await st.upload(final, bytes, { contentType: 'application/pdf', upsert: true })
        } catch {
          final = path // PDF protegido ou fora do padrão: entrega o original
        }
      }
    }
    const { data: u } = await st.createSignedUrl(final, 60 * 30, { download: f.baixa || f.nome })
    await db.from('ape_pedidos').update({ baixados: Number(ped.baixados ?? 0) + 1 }).eq('id', ped.id)
    return u?.signedUrl ? json({ url: u.signedUrl }) : json({ erro: 'Não deu para gerar o link.' }, 500)
  }

  async function licenciar(src: Uint8Array, ped: J) {
    const pdf = await PDFDocument.load(src)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const cpf = String(ped.cpf ?? '').replace(/\D/g, '')
    const cpfM = cpf.length === 11 ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : ''
    const quem = `${ped.nome}${cpfM ? ` · CPF ${cpfM}` : ''} · pedido ${String(ped.token).slice(0, 8)}`
    // só caracteres que a fonte padrão aceita
    const limpa = (s: string) => s.normalize('NFC').replace(/[^\x20-\x7E\xA0-\xFF]/g, '') // Latin-1: acentos e "·" ficam
    const linha = limpa(`Licenciado para ${quem} · uso pessoal · proibida a reprodução, distribuição ou revenda · planê.apê · useplane.com.br/ape`)
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize()
      const size = 6.2
      const w = font.widthOfTextAtSize(linha, size)
      const s = w > width - 40 ? size * (width - 40) / w : size
      page.drawText(linha, { x: (width - font.widthOfTextAtSize(linha, s)) / 2, y: 7, size: s, font, color: rgb(0.45, 0.43, 0.41), opacity: 0.85 })
      // marca bem leve na lateral, para identificar cópias
      page.drawText(limpa(`licenciado para ${ped.nome}`), { x: width - 6, y: height * 0.3, size: 6, font, color: rgb(0.6, 0.58, 0.56), opacity: 0.35, rotate: degrees(90) })
    }
    pdf.setTitle(pdf.getTitle() ?? 'planê.apê')
    pdf.setAuthor('planê.apê · useplane.com.br/ape')
    pdf.setSubject(limpa(`Licenciado para ${quem}`))
    return await pdf.save()
  }

  /** Recupera as compras pelo CPF e e-mail (os dois precisam bater). */
  async function recuperar(body: J) {
    const cpf = String(body.cpf ?? '').replace(/\D/g, '')
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!cpfOk(cpf) || !emailOk(email)) return json({ erro: 'Confira o CPF e o e-mail.' }, 400)
    const { data } = await db.from('ape_pedidos').select('token, criado, total, status, itens').eq('cpf', cpf).eq('email', email).order('criado', { ascending: false }).limit(20)
    const { data: plat } = await db.from('ape_plataforma').select('token, validade').eq('cpf', cpf).order('validade', { ascending: false }).limit(1).maybeSingle()
    return json({ pedidos: (data ?? []).map((p) => ({ token: p.token, criado: p.criado, total: p.total, status: p.status, itens: ((p.itens ?? []) as J[]).map((i) => i.nome) })), plataforma: plat ?? null })
  }

  /** Devolve no Asaas (se pago), marca o pedido e fecha downloads e plataforma. */
  async function reembolsarPedido(id: string) {
    const { data: ped } = await db.from('ape_pedidos').select('*').eq('id', id).maybeSingle()
    if (!ped) return
    if (ped.asaas_pagamento && !ped.cortesia && ped.status === 'pago') {
      // parcelado: estorna o parcelamento inteiro (todas as parcelas), não só uma
      const pg = await asaas(`/payments/${ped.asaas_pagamento}`).catch(() => ({}) as J)
      if (pg?.installment) await asaas(`/installments/${pg.installment}/refund`, { method: 'POST', body: '{}' })
      else await asaas(`/payments/${ped.asaas_pagamento}/refund`, { method: 'POST', body: '{}' })
    }
    else if (ped.asaas_pagamento && ped.status === 'pendente') await asaas(`/payments/${ped.asaas_pagamento}`, { method: 'DELETE' }).catch(() => null)
    const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
    await db.from('ape_pedidos').update({ status: ped.status === 'pago' ? 'reembolsado' : 'cancelado', cancelado_em: new Date().toISOString(), pix: null }).eq('id', ped.id)
    await db.from('ape_plataforma').update({ validade: ontem }).eq('pedido', ped.id)
  }
  const contaApi = makeConta({ db, asaas, json, site, env }, reembolsarPedido)

  /** Reembolso (só a dona, logada): devolve no Asaas, fecha os downloads e a plataforma do pedido. */
  async function reembolsar(req: Request, body: J) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = await db.auth.getUser(jwt)
    if (!u?.user) return json({ erro: 'Entre na sua conta.' }, 401)
    const { data: adm } = await db.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle()
    if (!adm) return json({ erro: 'Só a dona pode reembolsar.' }, 403)
    const { data: ped } = await db.from('ape_pedidos').select('id').eq('id', String(body.id ?? '')).maybeSingle()
    if (!ped) return json({ erro: 'Pedido não encontrado.' }, 404)
    await reembolsarPedido(ped.id)
    return json({ ok: true })
  }

  /* ===== leitura automática do orçamento: um arquivo por vez, já no formato da comparação ===== */
  const NICHOS = 'piso-vinilico, piso-ceramico, piso-laminado, revestimentos, marcenaria, marmoraria, box, gesso, eletrica, hidraulica, impermeabilizacao, serralheria, ar, pintura, cortinas, telas, vidros, iluminacao, moveis, eletros, mao-de-obra, outros'
  const b64 = (buf: ArrayBuffer) => {
    const u = new Uint8Array(buf)
    let s = ''
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
    return btoa(s)
  }
  /** Chave do Gemini: o segredo GEMINI_API_KEY ou a chave que uma admin colocou no planê (configurações → assistente). */
  const MODELOS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash']
  async function geminiKey() {
    const k = env('GEMINI_API_KEY').trim()
    if (k) return k
    const { data: adms } = await db.from('admins').select('user_id')
    for (const a of adms ?? []) {
      const { data: ws } = await db.from('workspace').select('data').eq('user_id', a.user_id).maybeSingle()
      const key = String((ws?.data as J | undefined)?.settings?.aiKey ?? '').trim()
      if (key) return key
    }
    return ''
  }
  const PROMPT = (hoje: string, texto: string) => `Você lê UM orçamento de obra, reforma ou móveis (pode ser PDF, foto ou texto) e devolve só JSON, sem comentários. Hoje é ${hoje}.
Formato:
{"fornecedor": "empresa ou profissional que fez o orçamento (nunca o cliente)", "nicho": um destes ids: ${NICHOS},
"servico": "o que está sendo orçado, até 10 palavras", "resumo": "1 frase simples: o que é e o preço que importa",
"contato": "nome do vendedor", "whatsapp": "só dígitos com DDD", "telefone": "só dígitos", "email": "", "instagram": "", "cnpj": "só dígitos", "endereco": "",
"valor_total": número ou null (preço cheio/a prazo), "valor_avista": número ou null, "desconto_avista_pct": número ou null, "parcelas_max": número ou null, "valor_parcela": número ou null, "juros": true/false/null,
"area_m2": número ou null, "prazo": "prazo de execução ou entrega", "garantia": "", "validade": "AAAA-MM-DD ou vazio (válido por N dias: conte a partir da data do orçamento)", "pagamento": "condições de pagamento",
"itens": [{"descricao": "item como está escrito, curto", "qtd": número ou null, "unidade": "m², un, ml, vb...", "valor": número ou null (total do item)}],
"materiais": ["marca, linha, espessura, acabamento ou especificação citada"],
"inclui": ["o que o orçamento diz que inclui (mão de obra, frete, instalação...)"],
"nao_inclui": ["o que diz que NÃO inclui ou fica por conta do cliente"],
"alertas": ["o que está vago ou costuma gerar custo extra e não aparece (ex.: frete, rodapé, retirada de entulho, regularização)"],
"opcoes": [{"nome": "opção de material ou modelo, ex.: Quartzo branco", "valor_total": número, "valor_avista": número ou null}] (só se o orçamento tiver opções alternativas de material/modelo com totais diferentes; senão []),
"completude": 1 a 5}
Regras: números em reais sem R$ (1234.5). Com opções de material, valor_total é o da primeira opção e cada opção vai em \"opcoes\". Não invente: o que não estiver escrito fica null, "" ou []. Ignore dados do cliente. Português, frases curtas, sem emojis.${texto ? `\nTEXTO:\n"""${texto}"""` : ''}`

  async function ler(body: J) {
    const morador = String(body.morador ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(morador)) return json({ erro: 'faça o cadastro' }, 400)
    const { data: m } = await db.from('ape_moradores').select('id').eq('id', morador).maybeSingle()
    if (!m) return json({ erro: 'faça o cadastro' }, 400)
    const desde = new Date(Date.now() - 864e5).toISOString()
    const { count } = await db.from('ape_leituras').select('id', { count: 'exact', head: true }).eq('morador', morador).gte('criado', desde)
    if ((count ?? 0) >= 40) return json({ erro: 'limite de leituras por hoje' }, 429)
    const key = await geminiKey()
    if (!key) return json({ erro: 'leitura automática desligada' }, 503)
    const path = String(body.arquivo ?? (Array.isArray(body.arquivos) ? body.arquivos[0] : '') ?? '')
    const parts: J[] = []
    if (path.startsWith('envios/')) {
      const { data: f } = await db.storage.from('ape-envios').download(path)
      if (f && f.size <= 15 * 1024 * 1024) parts.push({ inlineData: { mimeType: f.type || (path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'), data: b64(await f.arrayBuffer()) } })
    }
    const texto = String(body.texto ?? '').slice(0, 12000)
    if (!parts.length && !texto.trim()) return json({ erro: 'nada para ler' }, 400)
    await db.from('ape_leituras').insert({ morador })
    // tenta do modelo mais novo para o mais antigo (o Google desliga modelos antigos para contas novas)
    let r: Response | null = null
    for (const model of MODELOS) {
      const cfg: J = { temperature: 0.1, responseMimeType: 'application/json', ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}) }
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts: [...parts, { text: PROMPT(hojeBR(), texto) }] }], generationConfig: cfg }) })
      if (r.status !== 404 && r.status !== 402) break
    }
    if (!r) return json({ erro: 'não deu para ler agora' }, 502)
    const out = (await r.json().catch(() => ({}))) as J
    if (!r.ok) {
      const msg = String(out.error?.message ?? '')
      console.log('ape-ler: Gemini respondeu', r.status, msg.slice(0, 300))
      return json({ erro: r.status === 400 && /api key/i.test(msg) ? 'chave do Gemini inválida' : r.status === 403 ? `chave sem permissão para o Gemini${msg ? `: ${msg.slice(0, 120)}` : ''}` : r.status === 402 ? 'créditos do Gemini acabaram' : r.status === 429 ? 'limite do Gemini atingido' : 'não deu para ler agora', status: r.status }, 502)
    }
    const txt = String(out.candidates?.[0]?.content?.parts?.map((x: J) => x.text ?? '').join('') ?? '')
    let v: J = {}
    try {
      v = JSON.parse(txt.replace(/```(json)?/g, '').trim())
    } catch {
      /* resposta fora do formato: devolve vazio */
    }
    if (!NICHOS.split(', ').includes(String(v.nicho))) v.nicho = ''
    return json({ orcamento: v })
  }

  /* ===== arquivos da loja enviados criptografados (pelo GitHub): só este servidor tem a chave para abrir ===== */
  async function chave() {
    const { data: ja } = await db.from('ape_segredos').select('dados').eq('id', 'arquivos').maybeSingle()
    if (ja) return json({ publica: (ja.dados as J).publica })
    const par = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt'])
    const publica = await crypto.subtle.exportKey('jwk', par.publicKey)
    const privada = await crypto.subtle.exportKey('jwk', par.privateKey)
    await db.from('ape_segredos').insert({ id: 'arquivos', dados: { publica, privada } })
    return json({ publica })
  }
  const FONTE = /^https:\/\/raw\.githubusercontent\.com\/arqlais\/controle\/[0-9a-f]{7,40}\/ape-import\/[\w.-]+\.bin$/
  async function importar(body: J) {
    const url = String(body.url ?? '')
    if (!FONTE.test(url)) return json({ erro: 'endereço não aceito' }, 400)
    const { data: seg } = await db.from('ape_segredos').select('dados').eq('id', 'arquivos').maybeSingle()
    if (!seg) return json({ erro: 'sem chave' }, 400)
    const r = await fetch(url)
    if (!r.ok) return json({ erro: `não baixou (${r.status})` }, 400)
    const buf = new Uint8Array(await r.arrayBuffer())
    if (buf.length > 40 * 1024 * 1024) return json({ erro: 'grande demais' }, 400)
    // formato: [2 bytes: tamanho da chave cifrada][chave AES cifrada com RSA-OAEP][12 bytes IV][zip cifrado com AES-GCM]
    const n = (buf[0] << 8) | buf[1]
    const priv = await crypto.subtle.importKey('jwk', (seg.dados as J).privada, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt'])
    const aesRaw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, buf.slice(2, 2 + n))
    const aes = await crypto.subtle.importKey('raw', aesRaw, 'AES-GCM', false, ['decrypt'])
    const iv = buf.slice(2 + n, 14 + n)
    const zip = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aes, buf.slice(14 + n)))
    const arquivos = unzipSync(zip)
    if (body.destino === 'envios') {
      // orçamentos reais mandados pela dona: vão para a pasta dos envios, com o caminho que o SQL usa
      const st2 = db.storage.from('ape-envios')
      const feitos2: string[] = []
      for (const [nome, dados] of Object.entries(arquivos)) {
        if (nome.endsWith('/')) continue
        const path = `envios/importados/${nome.split('/').pop()}`
        const { error } = await st2.upload(path, dados, { contentType: /\.pdf$/i.test(nome) ? 'application/pdf' : 'image/jpeg', upsert: true })
        if (!error) feitos2.push(path)
      }
      return json({ ok: true, guardados: feitos2 })
    }
    const { map } = await loja()
    const ids = [...Object.keys(map).filter((id) => map[id].cat === 'arquivos'), 'bonus'].sort((a, b) => b.length - a.length)
    const st = db.storage.from('ape-arquivos')
    const feitos: string[] = []
    const fora: string[] = []
    for (const [nome, dados] of Object.entries(arquivos)) {
      if (nome.endsWith('/') || nome.startsWith('__')) continue
      const base = nome.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase()
      const id = ids.find((x) => base === x || base.startsWith(x + '-'))
      if (!id) {
        fora.push(nome)
        continue
      }
      const arq = nome.split('/').pop()!
      const tipo = /\.pdf$/i.test(arq) ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const { error } = await st.upload(`${id}/${arq}`, dados, { contentType: tipo, upsert: true })
      if (error) fora.push(`${nome} (${error.message})`)
      else feitos.push(`${id}/${arq}`)
    }
    // entregas já marcadas (PDF com a licença) são refeitas com os arquivos novos
    const { data: velhos } = await st.list('entregas', { limit: 1000 })
    for (const pasta of velhos ?? []) {
      const { data: fs } = await st.list(`entregas/${pasta.name}`, { limit: 100 })
      if (fs?.length) await st.remove(fs.map((f) => `entregas/${pasta.name}/${f.name}`))
    }
    return json({ ok: true, guardados: feitos.length, arquivos: feitos, fora })
  }

  /** Teste da IA (pelo GitHub): faz uma pergunta mínima com a chave guardada e devolve só a resposta do Google. */
  async function testarIa() {
    const key = await geminiKey()
    if (!key) return json({ chave: 'nenhuma' })
    const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responda só: ok' }] }] })
    const tenta = async (url: string, h: Record<string, string>) => {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: String(e) } }) }) as unknown as Response)
      const o = (await r.json().catch(() => ({}))) as J
      return { status: r.status, msg: String(o.error?.message ?? o.candidates?.[0]?.content?.parts?.[0]?.text ?? '').slice(0, 300) }
    }
    return json({
      chave: `${key.slice(0, 3)}… (${key.length} caracteres)`,
      gemini: Object.fromEntries(await Promise.all(MODELOS.map(async (m) => [m, await tenta(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { 'x-goog-api-key': key })]))),

    })
  }

  /** O morador aprovado (ou a dona) vê os arquivos originais de um orçamento, como foram mandados. */
  async function verOriginal(req: Request, body: J) {
    const id = String(body.orcamento ?? '')
    let pode = false
    const morador = String(body.morador ?? '')
    if (/^[0-9a-f-]{36}$/i.test(morador)) {
      const { data: m } = await db.from('ape_moradores').select('aprovado, condominio').eq('id', morador).maybeSingle()
      pode = !!m?.aprovado && (m.condominio ?? 'San Levi') === 'San Levi'
    }
    if (!pode) {
      const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      const { data: u } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } }
      if (u?.user) pode = !!(await db.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle()).data
    }
    if (!pode) return json({ erro: 'só para moradores do San Levi' }, 403)
    const { data: envs } = await db.from('ape_envios').select('arquivos').eq('orcamento', id)
    const st = db.storage.from('ape-envios')
    const out: { nome: string; tipo: string; url: string }[] = []
    for (const e of envs ?? []) for (const a of (e.arquivos ?? []) as J[]) {
      if (!a.path) continue
      const { data: u } = await st.createSignedUrl(String(a.path), 60 * 30)
      if (u?.signedUrl) out.push({ nome: String(a.nome ?? 'arquivo'), tipo: String(a.tipo ?? ''), url: u.signedUrl })
    }
    return json({ arquivos: out })
  }

  return { verOriginal, criar, pedido, baixar, recuperar, reembolsar, ler, marcarPago, chave, importar, testarIa, conta: contaApi.conta, decidir: contaApi.decidir, depoimentos: contaApi.depoimentos }
}
