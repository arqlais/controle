// planê.apê: conta do cliente (e-mail e senha), e-mails da loja (Brevo), pedido de cancelamento e depoimentos.
import type { Deps } from './ape.ts'

type J = Record<string, any>
const mailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function hash(senha: string, salB64?: string, iter = 120000) {
  const sal = salB64 ? unb64(salB64) : crypto.getRandomValues(new Uint8Array(16))
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter }, k, 256))
  return `${iter}$${b64(sal)}$${b64(bits)}`
}
async function confere(senha: string, guardada: string) {
  const [iter, sal, h] = guardada.split('$')
  if (!iter || !sal || !h) return false
  const novo = await hash(senha, sal, Number(iter))
  // comparação em tempo constante
  const a = novo.split('$')[2], b = h
  let d = a.length ^ b.length
  for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
const sha = async (s: string) => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))

export function makeConta({ db, json, site, env }: Deps, reembolsarPedido: (id: string) => Promise<void>) {
  const APE = `${site.replace(/\/$/, '')}/ape/`
  const DONO = env('OWNER_EMAIL', env('REPLY_TO', 'equipe.plane@gmail.com'))

  /* ===== e-mail (Brevo, a mesma conta dos avisos do planê) ===== */
  const layout = (titulo: string, texto: string, botao?: string, url?: string) => `<!doctype html><html><body style="margin:0;background:#f5f1eb;font-family:Poppins,Arial,sans-serif;color:#2b2826">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;padding:28px">
<tr><td style="font-size:18px;font-weight:700;padding-bottom:18px">planê<span style="color:#9b593f">.apê</span></td></tr>
<tr><td style="font-size:22px;font-weight:700;padding-bottom:10px">${titulo}</td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#4a4542">${texto}</td></tr>
${botao && url ? `<tr><td style="padding-top:20px"><a href="${url}" style="display:inline-block;background:#4e6472;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:999px">${esc(botao)}</a></td></tr>` : ''}
<tr><td style="font-size:11px;color:#8a817a;padding-top:24px">planê.apê · useplane.com.br/ape · @apzinho_1204 · uso pessoal: proibida a reprodução, distribuição ou revenda dos materiais.</td></tr>
</table></td></tr></table></body></html>`
  async function mandar(para: string, nome: string, assunto: string, html: string) {
    const key = env('BREVO_API_KEY')
    if (!key || !mailOk(para)) return false
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { email: env('SENDER_EMAIL', 'equipe.plane@gmail.com'), name: 'planê.apê' }, replyTo: { email: DONO, name: 'planê.apê' }, to: [{ email: para, name: nome || undefined }], subject: assunto, htmlContent: html }),
    }).catch(() => null)
    return !!r?.ok
  }

  /** E-mail da compra: link dos arquivos e convite para criar a senha (uma vez por pedido). */
  async function emailCompra(ped: J) {
    if (!ped?.email || ped.email_enviado) return
    const link = `${APE}#pedido:${ped.token}`
    const itens = ((ped.itens ?? []) as J[]).map((i) => `<li>${esc(i.nome)}</li>`).join('')
    const ok = await mandar(ped.email, ped.nome, 'Sua compra no planê.apê: arquivos liberados', layout(
      `Obrigada, ${esc(String(ped.nome || '').split(' ')[0])}!`,
      `<p>Seu pagamento foi confirmado. Seus arquivos já estão liberados:</p><ul>${itens}</ul><p>Para acessar quando quiser, de qualquer aparelho, crie a sua senha em <b>minha conta</b> com este e-mail. Lá ficam os arquivos, a plataforma (se comprou) e o bônus, que chega 7 dias depois da compra.</p><p style="font-size:12px;color:#8a817a">Os PDFs saem com o seu nome no rodapé (licença de uso pessoal). Para desistir, você tem 7 dias: peça em minha conta → minhas compras.</p>`,
      'ver meus arquivos', link))
    if (ok) await db.from('ape_pedidos').update({ email_enviado: true }).eq('id', ped.id)
  }

  /* ===== sessão ===== */
  async function sessao(token: unknown) {
    if (!/^[0-9a-f-]{36}$/i.test(String(token ?? ''))) return null
    const { data } = await db.from('ape_sessoes').select('cliente, expira').eq('token', String(token)).maybeSingle()
    if (!data || new Date(data.expira) < new Date()) return null
    const { data: c } = await db.from('ape_clientes').select('*').eq('id', data.cliente).maybeSingle()
    return c as J | null
  }
  const novaSessao = async (cliente: string) => (await db.from('ape_sessoes').insert({ cliente }).select('token').single()).data?.token as string
  const temCompra = async (email: string) => {
    const { count } = await db.from('ape_pedidos').select('id', { count: 'exact', head: true }).eq('email', email).in('status', ['pago', 'reembolsado'])
    return (count ?? 0) > 0
  }
  /** Cria (ou completa) o cliente a partir dos pedidos com aquele e-mail. */
  async function garanteCliente(email: string) {
    const { data: ja } = await db.from('ape_clientes').select('*').eq('email', email).maybeSingle()
    if (ja) return ja as J
    const { data: p } = await db.from('ape_pedidos').select('nome, cpf, tel').eq('email', email).order('criado', { ascending: false }).limit(1).maybeSingle()
    const { data: novo } = await db.from('ape_clientes').insert({ email, nome: p?.nome ?? '', cpf: p?.cpf ?? '', tel: p?.tel ?? '' }).select('*').single()
    return novo as J
  }
  const senhaOk = (s: string) => s.length >= 8

  async function conta(body: J) {
    const op = String(body.op ?? '')
    const email = String(body.email ?? '').trim().toLowerCase()

    if (op === 'entrar') {
      const { data: c } = await db.from('ape_clientes').select('id, senha').eq('email', email).maybeSingle()
      if (!c?.senha || !(await confere(String(body.senha ?? ''), c.senha))) return json({ erro: 'E-mail ou senha não conferem.' }, 400)
      return json({ token: await novaSessao(c.id) })
    }

    if (op === 'esqueci' || op === 'primeiro') {
      // manda um código de 6 números para criar ou trocar a senha (só para quem comprou com esse e-mail)
      if (!mailOk(email)) return json({ erro: 'Confira o e-mail.' }, 400)
      if (!(await temCompra(email))) return json({ ok: true }) // não diz se o e-mail existe
      const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
      await db.from('ape_codigos').upsert({ email, codigo: await sha(`${email}:${codigo}`), tentativas: 0, expira: new Date(Date.now() + 30 * 60e3).toISOString() })
      const enviado = await mandar(email, '', `Seu código do planê.apê: ${codigo}`, layout('Seu código', `<p>Use este código para ${op === 'primeiro' ? 'criar' : 'trocar'} a sua senha. Ele vale por 30 minutos.</p><p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#4e6472">${codigo}</p><p style="font-size:12px;color:#8a817a">Se não foi você, ignore este e-mail.</p>`))
      return json({ ok: true, enviado })
    }

    if (op === 'redefinir') {
      const { data: k } = await db.from('ape_codigos').select('*').eq('email', email).maybeSingle()
      if (!k || new Date(k.expira) < new Date() || k.tentativas >= 5) return json({ erro: 'Código vencido. Peça outro.' }, 400)
      if (k.codigo !== (await sha(`${email}:${String(body.codigo ?? '').replace(/\D/g, '')}`))) {
        await db.from('ape_codigos').update({ tentativas: k.tentativas + 1 }).eq('email', email)
        return json({ erro: 'Código não confere.' }, 400)
      }
      if (!senhaOk(String(body.senha ?? ''))) return json({ erro: 'A senha precisa de pelo menos 8 caracteres.' }, 400)
      const c = await garanteCliente(email)
      await db.from('ape_clientes').update({ senha: await hash(String(body.senha)), atualizado: new Date().toISOString() }).eq('id', c.id)
      await db.from('ape_codigos').delete().eq('email', email)
      return json({ token: await novaSessao(c.id) })
    }

    if (op === 'criar') {
      // logo depois da compra, pela página do pedido: o token do pedido prova que a pessoa comprou com esse e-mail
      const { data: ped } = await db.from('ape_pedidos').select('email').eq('token', String(body.pedido ?? '')).eq('status', 'pago').maybeSingle()
      if (!ped || ped.email !== email) return json({ erro: 'Use o e-mail da compra.' }, 400)
      if (!senhaOk(String(body.senha ?? ''))) return json({ erro: 'A senha precisa de pelo menos 8 caracteres.' }, 400)
      const c = await garanteCliente(email)
      if (c.senha) return json({ erro: 'Esse e-mail já tem senha. Entre ou use "esqueci a senha".' }, 400)
      await db.from('ape_clientes').update({ senha: await hash(String(body.senha)) }).eq('id', c.id)
      return json({ token: await novaSessao(c.id) })
    }

    // daqui para baixo precisa estar logado
    const c = await sessao(body.sessao)
    if (!c) return json({ erro: 'Entre de novo.', sair: true }, 401)

    if (op === 'eu') {
      const { data: peds } = await db.from('ape_pedidos').select('id, token, itens, total, status, forma, criado, pago_em, cortesia, cancelamento').eq('email', c.email).neq('status', 'pendente').order('criado', { ascending: false })
      const { data: plats } = await db.from('ape_plataforma').select('token, validade, cortesia').or(`email.eq.${c.email}${c.cpf ? `,cpf.eq.${c.cpf}` : ''}`).order('validade', { ascending: false })
      const { data: fb } = await db.from('ape_feedback').select('tipo, texto, nota, publicado, criado').eq('cliente', c.id).order('criado', { ascending: false })
      return json({ perfil: { nome: c.nome, email: c.email, tel: c.tel, foto: c.foto, cpf: c.cpf ? `***.${c.cpf.slice(3, 6)}.${c.cpf.slice(6, 9)}-**` : '' }, pedidos: peds ?? [], plataformas: plats ?? [], feedback: fb ?? [] })
    }
    if (op === 'perfil') {
      const foto = String(body.foto ?? c.foto)
      if (foto && (!foto.startsWith('data:image/') || foto.length > 300000)) return json({ erro: 'Foto grande demais.' }, 400)
      await db.from('ape_clientes').update({ nome: String(body.nome ?? c.nome).slice(0, 120), tel: String(body.tel ?? c.tel).replace(/\D/g, '').slice(0, 13), foto, atualizado: new Date().toISOString() }).eq('id', c.id)
      return json({ ok: true })
    }
    if (op === 'senha') {
      if (!c.senha || !(await confere(String(body.atual ?? ''), c.senha))) return json({ erro: 'A senha atual não confere.' }, 400)
      if (!senhaOk(String(body.nova ?? ''))) return json({ erro: 'A nova senha precisa de pelo menos 8 caracteres.' }, 400)
      await db.from('ape_clientes').update({ senha: await hash(String(body.nova)) }).eq('id', c.id)
      await db.from('ape_sessoes').delete().eq('cliente', c.id).neq('token', String(body.sessao))
      return json({ ok: true })
    }
    if (op === 'sair') {
      await db.from('ape_sessoes').delete().eq('token', String(body.sessao))
      return json({ ok: true })
    }
    if (op === 'cancelar') {
      const { data: ped } = await db.from('ape_pedidos').select('*').eq('id', String(body.pedido ?? '')).eq('email', c.email).maybeSingle()
      if (!ped || ped.status !== 'pago') return json({ erro: 'Pedido não encontrado.' }, 404)
      if (ped.cancelamento?.status === 'pedido') return json({ ok: true })
      const motivo = String(body.motivo ?? '').slice(0, 800)
      await db.from('ape_pedidos').update({ cancelamento: { status: 'pedido', motivo, em: new Date().toISOString() } }).eq('id', ped.id)
      const dias = ped.pago_em ? Math.floor((Date.now() - new Date(ped.pago_em).getTime()) / 864e5) : 0
      await mandar(DONO, 'Laís', `Pedido de cancelamento: ${ped.nome}`, layout('Pedido de cancelamento', `<p><b>${esc(ped.nome)}</b> (${esc(ped.email)}) pediu para cancelar a compra de ${dias} dia(s) atrás:</p><ul>${((ped.itens ?? []) as J[]).map((i) => `<li>${esc(i.nome)}</li>`).join('')}</ul><p>Motivo: ${esc(motivo || 'não informado')}</p><p>${dias <= 7 ? 'Está dentro dos 7 dias do direito de arrependimento: a lei garante o reembolso.' : 'Passou dos 7 dias: você decide.'}</p>`, 'abrir o painel', `${site.replace(/\/$/, '')}/#/ape-admin`))
      return json({ ok: true })
    }
    if (op === 'feedback') {
      const tipo = body.tipo === 'depoimento' ? 'depoimento' : 'sugestao'
      const texto = String(body.texto ?? '').trim().slice(0, 1500)
      if (texto.length < 5) return json({ erro: 'Escreva um pouco mais.' }, 400)
      const nota = tipo === 'depoimento' ? Math.min(5, Math.max(1, Number(body.nota) || 5)) : null
      await db.from('ape_feedback').insert({ cliente: c.id, tipo, texto, nota, nome: String(c.nome || '').split(' ')[0] })
      await mandar(DONO, 'Laís', tipo === 'depoimento' ? `Novo depoimento de ${c.nome}` : `Nova sugestão de ${c.nome}`, layout(tipo === 'depoimento' ? 'Novo depoimento' : 'Nova sugestão', `<p>${esc(texto)}</p><p>${esc(c.nome)} · ${esc(c.email)}</p>${tipo === 'depoimento' ? '<p>Para mostrar na loja, publique no painel → depoimentos.</p>' : ''}`))
      return json({ ok: true })
    }
    return json({ erro: 'Ação desconhecida.' }, 400)
  }

  /** A dona decide o pedido de cancelamento (aprovar = reembolsa pelo Asaas e fecha o acesso). */
  async function decidir(req: Request, body: J) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = await db.auth.getUser(jwt)
    if (!u?.user) return json({ erro: 'Entre na sua conta.' }, 401)
    const { data: adm } = await db.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle()
    if (!adm) return json({ erro: 'Só a dona decide.' }, 403)
    const { data: ped } = await db.from('ape_pedidos').select('*').eq('id', String(body.id ?? '')).maybeSingle()
    if (!ped) return json({ erro: 'Pedido não encontrado.' }, 404)
    const aprovar = body.decisao === 'aprovar'
    const resposta = String(body.resposta ?? '').slice(0, 800)
    if (aprovar) await reembolsarPedido(ped.id)
    await db.from('ape_pedidos').update({ cancelamento: { ...(ped.cancelamento ?? {}), status: aprovar ? 'aprovado' : 'negado', resposta, decidido_em: new Date().toISOString() } }).eq('id', ped.id)
    await mandar(ped.email, ped.nome, aprovar ? 'Seu cancelamento foi aprovado' : 'Sobre o seu pedido de cancelamento', layout(aprovar ? 'Cancelamento aprovado' : 'Pedido de cancelamento', aprovar ? `<p>O valor de R$ ${Number(ped.total).toFixed(2).replace('.', ',')} volta pelo mesmo meio de pagamento (no cartão, pode levar até 2 faturas). Os links de download foram desativados e pedimos que apague os arquivos baixados.</p>${resposta ? `<p>${esc(resposta)}</p>` : ''}` : `<p>${esc(resposta || 'Seu pedido de cancelamento não pôde ser aprovado. Responda este e-mail se quiser conversar.')}</p>`))
    return json({ ok: true })
  }

  /** Depoimentos publicados (aparecem na loja). */
  async function depoimentos() {
    const { data } = await db.from('ape_feedback').select('texto, nota, nome, criado').eq('tipo', 'depoimento').eq('publicado', true).order('criado', { ascending: false }).limit(12)
    return json({ depoimentos: data ?? [] })
  }

  return { conta, decidir, depoimentos, emailCompra }
}
