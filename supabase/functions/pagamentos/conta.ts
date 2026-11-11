// planê.apê: conta do cliente (e-mail e senha), e-mails da loja (Brevo), pedido de cancelamento e depoimentos.
import type { Deps } from './ape.ts'
import { botao, brl, caixa, moldura, numPedido, passos, primeiro, resumoPedido } from './emails.ts'

type J = Record<string, any>
const mailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const tel = (t: unknown) => { const d = String(t ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : d }
const lista = (ped: J) => ((ped?.itens ?? []) as J[]).map((i) => esc(i.nome)).join(', ')
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

export function makeConta({ db, json, site, env }: Deps, reembolsarPedido: (id: string, manual?: boolean) => Promise<void>) {
  const APE = `${site.replace(/\/$/, '')}/ape/`
  const DONO = env('OWNER_EMAIL', env('REPLY_TO', 'equipe.plane@gmail.com'))

  /* ===== e-mail (Brevo, a mesma conta dos avisos do planê) ===== */
  const PAINEL = `${site.replace(/\/$/, '')}/#/ape-admin`
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

  /** E-mail da compra: resumo do pedido, passo a passo para criar o acesso e o que vem depois (uma vez por pedido). */
  async function emailCompra(ped: J) {
    if (!ped?.email || ped.email_enviado) return
    const link = `${APE}#pedido:${ped.token}`
    const itens = (ped.itens ?? []) as J[]
    const temPlat = itens.some((i) => i.id === 'plataforma')
    const temArq = itens.some((i) => i.id !== 'plataforma')
    const html = moldura({
      site,
      previa: `Pagamento confirmado. Crie o seu acesso para abrir ${temArq ? 'os arquivos' : 'a plataforma'}.`,
      kicker: 'pagamento confirmado',
      titulo: `Obrigada, ${primeiro(ped.nome)}! Está tudo liberado.`,
      corpo: `<p style="margin:0 0 6px">Recebemos o seu pagamento. Agora é só criar o seu acesso, leva menos de 1 minuto:</p>
${passos([
  'Toque em <b>criar meu acesso</b>, aqui embaixo.',
  `Crie uma senha usando <b>este e-mail</b> (${esc(ped.email)}).`,
  temArq ? 'Pronto: os seus arquivos abrem na hora para baixar. Os PDFs saem com o seu nome no rodapé.' : 'Pronto: a sua plataforma do apê abre na hora.',
])}
<div style="padding:8px 0 2px">${botao('criar meu acesso', link)}</div>
${resumoPedido(ped)}
${temPlat ? caixa('<b>Plataforma do apê</b>: vale por 12 meses a partir de hoje. Ela fica em <b>minha conta → minha plataforma</b> e funciona no celular e no computador. Dica: no celular, use "adicionar à tela de início" para abrir como um aplicativo.') : ''}
${temArq ? caixa('<b>Tem um brinde surpresa a caminho.</b> Um arquivo exclusivo, que não tem à venda na loja, chega de presente em minha conta uma semana depois da compra. A gente te avisa por e-mail.', 'sec') : ''}
<p style="margin:14px 0 0;font-size:12px;color:#8a817a">Depois do primeiro acesso, entre sempre por <b>minha conta</b>, de qualquer aparelho, com o seu e-mail e senha. Você tem 7 dias de direito de arrependimento, também em minha conta.</p>`,
      botao2: ['criar meu acesso', link],
      ajuda: `Oi! Fiz o pedido nº ${numPedido(ped)} no planê.apê e preciso de ajuda`,
    })
    const ok = await mandar(ped.email, ped.nome, `Pagamento confirmado: crie o seu acesso (pedido nº ${numPedido(ped)})`, html)
    if (ok) await db.from('ape_pedidos').update({ email_enviado: true }).eq('id', ped.id)
  }

  /** Lembrete único para quem gerou o Pix e não pagou (entre 1 hora e 3 dias depois). */
  async function emailLembretePix(ped: J) {
    const html = moldura({
      site,
      previa: 'O seu pedido ainda está esperando o pagamento.',
      kicker: 'seu pedido está guardado',
      titulo: `${primeiro(ped.nome)}, faltou só o pagamento`,
      corpo: `<p style="margin:0">O seu carrinho ficou guardado. Se ainda quiser, é só tocar no botão abaixo: lá aparece o Pix (copia e cola ou QR Code) ou dá para pagar no cartão.</p>${resumoPedido(ped, 'o que ficou no carrinho')}<p style="margin:0;font-size:12px;color:#8a817a">Se já pagou, pode ignorar este e-mail: a confirmação chega em seguida. Se desistiu, tudo bem, não vamos insistir.</p>`,
      botao: ['concluir o pagamento', `${APE}#pedido:${ped.token}`],
      ajuda: 'Oi! Tive uma dúvida para pagar o meu pedido no planê.apê',
    })
    return await mandar(ped.email, ped.nome, 'Seu pedido no planê.apê está esperando o pagamento', html)
  }

  /** Aviso do bônus liberado (8º dia depois da compra). */
  async function emailBonus(ped: J) {
    const html = moldura({
      site,
      previa: 'Chegou o seu brinde exclusivo: já está em minha conta.',
      kicker: 'bônus liberado',
      titulo: 'O seu bônus surpresa abriu!',
      corpo: `<p style="margin:0">Oi, ${primeiro(ped.nome)}! Passou uma semana desde a sua compra e o presente chegou: o <b>Calendário de manutenção e garantias do 1º ano</b>.</p>${caixa('O que revisar em cada mês do primeiro ano na casa nova e até quando vale a garantia de cada item (portas, janelas, pintura, elétrica, hidráulica, impermeabilização). Ótimo para não perder nenhum prazo com a construtora.')}<p style="margin:0">Ele já está em <b>minha conta</b>, junto com os seus arquivos, com o seu nome no rodapé.</p>`,
      botao: ['abrir o meu bônus', `${APE}#conta`],
      ajuda: 'Oi! Tenho uma dúvida sobre o bônus do planê.apê',
    })
    return await mandar(ped.email, ped.nome, 'O seu bônus surpresa do planê.apê abriu', html)
  }

  /** Boas-vindas para quem se cadastra na área dos moradores. */
  async function emailBoasVindas(email: string, nome: string, sl: boolean) {
    const html = moldura({
      site,
      previa: 'O seu cadastro está feito. Veja o que dá para fazer na área dos moradores.',
      kicker: sl ? 'área dos moradores do San Levi' : 'cadastro feito',
      titulo: `Bem-vindo(a), ${primeiro(nome)}!`,
      corpo: `<p style="margin:0 0 6px">${sl ? 'O seu cadastro na área dos moradores está pronto. Ali, os vizinhos compartilham os orçamentos que receberam para a casa nova:' : 'O seu cadastro está pronto. Veja o que dá para fazer:'}</p>
${passos(sl ? [
  '<b>Ver os orçamentos</b> dos vizinhos (marcenaria, piso, gesso, vidros, cortinas e mais), em lista ou em blocos.',
  '<b>Comparar</b> até 4 lado a lado, com cores, e marcar com quem vai fechar.',
  '<b>Enviar os seus</b> orçamentos (arquivo ou texto) para ajudar os vizinhos.',
  '<b>Fechar em grupo</b>: marque interesse e, quando juntar gente, peça desconto ao fornecedor.',
] : ['Veja a <b>loja</b> com guias, checklists e planilhas para cada fase da casa nova.', 'Tudo o que comprar fica em <b>minha conta</b>.'])}`,
      botao: [sl ? 'abrir a área dos moradores' : 'abrir a loja', sl ? APE : `${APE}#loja`],
      botao2: sl ? ['ver a loja de arquivos', `${APE}#loja`] : undefined,
    })
    return await mandar(email, nome, sl ? 'Bem-vindo(a) à área dos moradores do San Levi' : 'Bem-vindo(a) ao planê.apê', html)
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
  const moradorDe = async (id: string | null | undefined) => {
    if (!id) return null
    const { data } = await db.from('ape_moradores').select('id, nome, condominio, torre, ap, tel, mora_junto, aprovado, pessoas, criado').eq('id', id).maybeSingle()
    return data
  }

  async function conta(body: J) {
    const op = String(body.op ?? '')
    const email = String(body.email ?? '').trim().toLowerCase()

    if (op === 'entrar') {
      const { data: c } = await db.from('ape_clientes').select('id, senha, morador').eq('email', email).maybeSingle()
      if (!c?.senha || !(await confere(String(body.senha ?? ''), c.senha))) return json({ erro: 'E-mail ou senha não conferem.' }, 400)
      return json({ token: await novaSessao(c.id), morador: await moradorDe(c.morador) })
    }

    if (op === 'morador') {
      // cadastro de morador: nome, torre, apê, e-mail, celular e senha (CPF só se um dia comprar na loja)
      const nome = String(body.nome ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
      const tel = String(body.tel ?? '').replace(/\D/g, '').slice(0, 13)
      const sl = body.condominio === 'San Levi' || !body.condominio
      const torre = String(body.torre ?? '').trim().slice(0, 10)
      const ap = String(body.ap ?? '').trim().slice(0, 10)
      const senha = String(body.senha ?? '')
      if (nome.split(' ').length < 2) return json({ erro: 'Coloque o nome completo.' }, 400)
      if (!mailOk(email)) return json({ erro: 'Confira o e-mail.' }, 400)
      if (tel.length < 10) return json({ erro: 'Coloque o celular com DDD.' }, 400)
      if (sl && (!torre || !ap)) return json({ erro: 'Coloque a torre e o apê.' }, 400)
      if (!senhaOk(senha)) return json({ erro: 'A senha precisa de pelo menos 8 caracteres.' }, 400)
      const { data: ja } = await db.from('ape_clientes').select('id, senha, morador').eq('email', email).maybeSingle()
      if (ja?.senha) return json({ erro: 'Esse e-mail já tem conta. Toque em "já tenho conta" e entre.' }, 400)
      const pessoas = Math.min(20, Math.max(0, Number(body.pessoas) || 0)) || null
      const TIPOS = ['adulto', 'crianca', 'bebe', 'idoso', 'cachorro', 'gato', 'passaro', 'peixe', 'roedor', 'pet']
      const familia = (Array.isArray(body.familia) ? body.familia : []).map((x: J) => (typeof x === 'string' ? { tipo: x } : { tipo: String(x?.tipo ?? ''), nome: String(x?.nome ?? '').trim().slice(0, 40), papel: String(x?.papel ?? '').trim().slice(0, 40) })).filter((x: J) => TIPOS.includes(x.tipo)).slice(0, 12)
      const { data: m, error } = await db.from('ape_moradores').insert({ nome, tel, torre: sl ? torre : '', ap: sl ? ap : '', condominio: sl ? 'San Levi' : String(body.condominio ?? '').slice(0, 80), mora_junto: body.junto === true, aprovado: sl, pessoas, ...(familia.length ? { familia } : {}) }).select('*').single()
      if (error || !m) return json({ erro: 'Não deu para cadastrar agora.' }, 500)
      const h = await hash(senha)
      const cli = ja
        ? (await db.from('ape_clientes').update({ senha: h, morador: m.id, nome, tel }).eq('id', ja.id).select('id').single()).data
        : (await db.from('ape_clientes').insert({ email, nome, tel, senha: h, morador: m.id }).select('id').single()).data
      await emailBoasVindas(email, nome, sl).catch(() => null)
      return json({ token: await novaSessao(cli!.id), morador: await moradorDe(m.id) })
    }

    if (op === 'esqueci' || op === 'primeiro') {
      // manda um código de 6 números para criar ou trocar a senha (só para quem comprou com esse e-mail)
      if (!mailOk(email)) return json({ erro: 'Confira o e-mail.' }, 400)
      const { data: temConta } = await db.from('ape_clientes').select('id').eq('email', email).maybeSingle()
      if (!temConta && !(await temCompra(email))) return json({ ok: true }) // não diz se o e-mail existe
      const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
      await db.from('ape_codigos').upsert({ email, codigo: await sha(`${email}:${codigo}`), tentativas: 0, expira: new Date(Date.now() + 30 * 60e3).toISOString() })
      const enviado = await mandar(email, '', `Seu código do planê.apê: ${codigo}`, moldura({ site, previa: `Código: ${codigo}`, kicker: op === 'primeiro' ? 'criar senha' : 'trocar senha', titulo: 'Seu código de acesso', corpo: `<p style="margin:0">Use este código para ${op === 'primeiro' ? 'criar' : 'trocar'} a sua senha. Ele vale por 30 minutos.</p>${caixa(`<div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;color:#4e6472">${codigo}</div>`)}<p style="margin:0;font-size:12px;color:#8a817a">Se não foi você, ignore este e-mail: ninguém entra sem este código.</p>` }))
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
      return json({ token: await novaSessao(c.id), morador: await moradorDe(c.morador) })
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
      return json({ morador: await moradorDe(c.morador), perfil: { nome: c.nome, email: c.email, tel: c.tel, foto: c.foto, cpf: c.cpf ? `***.${c.cpf.slice(3, 6)}.${c.cpf.slice(6, 9)}-**` : '' }, pedidos: peds ?? [], plataformas: plats ?? [], feedback: fb ?? [] })
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
      await mandar(DONO, 'Laís', `Pedido de cancelamento: ${ped.nome} (${brl(ped.total)})`, moldura({ site, dona: true, ajuda: false, kicker: 'pedido de cancelamento', titulo: `${esc(ped.nome)} pediu para cancelar`,
        corpo: `<p style="margin:0">${esc(ped.email)}${ped.tel ? ` · ${tel(ped.tel)}` : ''} · compra de ${dias} dia(s) atrás.</p>${resumoPedido(ped)}${caixa(`<b>Motivo:</b> ${esc(motivo || 'não informado')}`, 'sec')}<p style="margin:0">${dias <= 7 ? 'Está dentro dos 7 dias do direito de arrependimento: a lei garante o reembolso (a taxa do Asaas não volta).' : 'Passou dos 7 dias: você decide se aprova.'} Para responder, abra o painel → vendas.</p>`,
        botao: ['abrir o painel', PAINEL] }))
      await mandar(ped.email, ped.nome, 'Recebemos o seu pedido de cancelamento', moldura({ site, kicker: 'pedido de cancelamento', titulo: 'Recebemos o seu pedido', corpo: `<p style="margin:0">Oi, ${primeiro(ped.nome)}! O seu pedido de cancelamento da compra nº ${numPedido(ped)} chegou. A resposta vem por e-mail, normalmente em até 2 dias úteis.</p>${resumoPedido(ped)}` }))
      return json({ ok: true })
    }
    if (op === 'feedback') {
      const tipo = body.tipo === 'depoimento' ? 'depoimento' : 'sugestao'
      const texto = String(body.texto ?? '').trim().slice(0, 1500)
      if (texto.length < 5) return json({ erro: 'Escreva um pouco mais.' }, 400)
      const nota = tipo === 'depoimento' ? Math.min(5, Math.max(1, Number(body.nota) || 5)) : null
      await db.from('ape_feedback').insert({ cliente: c.id, tipo, texto, nota, nome: String(c.nome || '').split(' ')[0] })
      await mandar(DONO, 'Laís', tipo === 'depoimento' ? `Novo depoimento de ${c.nome}` : `Nova sugestão de ${c.nome}`, moldura({ site, dona: true, ajuda: false, kicker: tipo === 'depoimento' ? `novo depoimento${nota ? ` · nota ${nota}` : ''}` : 'nova sugestão', titulo: esc(c.nome), corpo: `${caixa(esc(texto).replace(/\n/g, '<br>'))}<p style="margin:0">${esc(c.email)}</p>${tipo === 'depoimento' ? '<p>Para mostrar na loja, publique no painel → produtos → depoimentos.</p>' : ''}`, botao: ['abrir o painel', PAINEL] }))
      return json({ ok: true })
    }
    return json({ erro: 'Ação desconhecida.' }, 400)
  }

  /** Teste do e-mail (só a dona): manda um e-mail para ela e devolve o que o Brevo respondeu. */
  async function testarEmail(req: Request) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = await db.auth.getUser(jwt)
    if (!u?.user) return json({ erro: 'Entre na sua conta.' }, 401)
    const { data: adm } = await db.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle()
    if (!adm) return json({ erro: 'Só a dona.' }, 403)
    const key = env('BREVO_API_KEY')
    const remetente = env('SENDER_EMAIL', 'equipe.plane@gmail.com')
    if (!key) return json({ ok: false, para: DONO, remetente, detalhe: 'Falta o segredo BREVO_API_KEY no Supabase.' })
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { email: remetente, name: 'planê.apê' }, to: [{ email: DONO }], subject: 'Teste de e-mail do planê.apê', htmlContent: moldura({ site, dona: true, ajuda: false, kicker: 'teste', titulo: 'Os e-mails estão funcionando', corpo: '<p style="margin:0">Se você está lendo isto, os e-mails do planê.apê estão saindo: compra, venda confirmada, lembrete do Pix, bônus liberado, boas-vindas, cancelamento e reembolso.</p>' }) }),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }) as unknown as Response)
    const texto = await r.text().catch(() => '')
    return json({ ok: r.ok, status: r.status, para: DONO, remetente, detalhe: texto.slice(0, 400) })
  }

  /** Aviso para o cliente quando a dona reembolsa pela tela de vendas. */
  async function emailReembolso(ped: J) {
    if (!ped?.email || ped.cortesia) return false
    const v = `R$ ${Number(ped.total).toFixed(2).replace('.', ',')}`
    return await mandar(ped.email, ped.nome, `Reembolso feito: ${v} (pedido nº ${numPedido(ped)})`, moldura({ site, previa: `O reembolso de ${v} foi feito.`, kicker: 'reembolso', titulo: 'O seu reembolso foi feito', corpo: `<p style="margin:0">Oi, ${primeiro(ped.nome)}! Devolvemos <b>${v}</b> referente à sua compra no planê.apê.</p>${caixa(ped.forma === 'cartao' ? '<b>Cartão de crédito:</b> o valor aparece como crédito na fatura em até 2 faturas, conforme o seu banco. Se a compra foi parcelada, todas as parcelas são canceladas.' : '<b>Pix:</b> o valor volta para a conta que fez o pagamento, normalmente na hora (pode levar até 1 dia útil).')}${resumoPedido(ped, 'pedido reembolsado')}<p style="margin:0">Os links de download e o acesso à plataforma deste pedido foram desativados. Pedimos que apague os arquivos baixados. Obrigada por ter conhecido o planê.apê.</p>`, ajuda: `Oi! Tenho uma dúvida sobre o reembolso do pedido nº ${numPedido(ped)}` }))
  }

  /** Aviso para a dona a cada venda confirmada. */
  async function avisarVenda(ped: J) {
    const n = Number(ped.parcelas) || 1
    const taxa = ped.forma === 'cartao' ? Number(ped.total) * 0.0299 + 0.49 : 1.99
    await mandar(DONO, 'Laís', `Venda confirmada: ${brl(ped.total)} · ${ped.nome}`, moldura({ site, dona: true, ajuda: false, previa: `${ped.nome} pagou ${brl(ped.total)}: ${lista(ped)}`, kicker: ped.cortesia ? 'cortesia liberada' : 'pagamento recebido', titulo: `${brl(ped.total)} de ${esc(ped.nome)}`,
      corpo: `<p style="margin:0">${esc(ped.email)}${ped.tel ? ` · ${tel(ped.tel)}` : ''}</p>${resumoPedido(ped)}${ped.cortesia ? '' : caixa(`Sobra aproximada depois da taxa do Asaas: <b>${brl(Number(ped.total) - taxa)}</b>${n > 1 ? ` (parcelado em ${n}x: o Asaas repassa conforme o seu plano)` : ''}.`)}<p style="margin:0">O cliente já recebeu o e-mail para criar o acesso. Os arquivos saem com o nome dele no rodapé.</p>`,
      botao: ['abrir o painel', PAINEL] }))
  }
  /* ===== suporte ao vivo: conversa entre quem visita (pelo código da conversa) e a dona ===== */
  const ORIGENS: Record<string, string> = { sanlevi: 'morador(a) do San Levi', cliente: 'cliente da loja/plataforma', visitante: 'visitante' }
  const ASSUNTOS: Record<string, string> = { duvida: 'dúvida', problema: 'algo não funcionou' }
  const chatHist = new Map<string, number[]>()
  async function chatEnviar(req: Request, body: J) {
    const texto = String(body.texto ?? '').trim().slice(0, 2000)
    if (!texto) return json({ erro: 'Escreva a mensagem.' }, 400)
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    const agora = Date.now()
    const h = (chatHist.get(ip) ?? []).filter((t) => agora - t < 864e5)
    if (h.filter((t) => agora - t < 60e3).length >= 12 || h.length >= 300) return json({ erro: 'Muitas mensagens seguidas. Espere um pouquinho.' }, 429)
    chatHist.set(ip, [...h, agora])
    const nome = String(body.nome ?? '').trim().slice(0, 80)
    const contato = String(body.contato ?? '').trim().slice(0, 120)
    let conv: J | null = null
    const token = String(body.token ?? '')
    if (token) conv = (await db.from('ape_conversas').select('*').eq('token', token).maybeSingle()).data
    const nova = !conv
    if (!conv) {
      const tk = crypto.randomUUID() + crypto.randomUUID().slice(0, 8)
      const { data, error } = await db.from('ape_conversas').insert({ token: tk, nome, contato, origem: ORIGENS[String(body.origem)] ? String(body.origem) : 'visitante', assunto: ASSUNTOS[String(body.assunto)] ? String(body.assunto) : 'duvida', pagina: String(body.pagina ?? '').slice(0, 120) }).select('*').single()
      if (error) return json({ erro: 'Não deu para abrir a conversa agora.' }, 500)
      conv = data
    }
    const { data: ultimo } = await db.from('ape_chat').select('criado').eq('conversa', conv!.id).eq('de', 'cliente').order('criado', { ascending: false }).limit(1).maybeSingle()
    await db.from('ape_chat').insert({ conversa: conv!.id, de: 'cliente', texto })
    await db.from('ape_conversas').update({ atualizado: new Date().toISOString(), nao_lidas: (Number(conv!.nao_lidas) || 0) + 1, resolvida: false, ...(nome ? { nome } : {}), ...(contato ? { contato } : {}) }).eq('id', conv!.id)
    // e-mail para a dona: conversa nova, ou mensagem depois de 15 min de silêncio (sem encher a caixa)
    if (nova || !ultimo || agora - new Date(String(ultimo.criado)).getTime() > 15 * 60e3) {
      const quem = nome || String(conv!.nome || '') || 'visitante'
      const c = contato || String(conv!.contato || '')
      await mandar(DONO, 'Laís', `Suporte planê.apê: ${ASSUNTOS[String(conv!.assunto)] || 'mensagem'} de ${quem}`, moldura({ site, dona: true, ajuda: false, previa: texto.slice(0, 90), kicker: `suporte · ${ORIGENS[String(conv!.origem)] || 'visitante'} · ${ASSUNTOS[String(conv!.assunto)] || ''}`, titulo: esc(quem),
        corpo: `${caixa(esc(texto).replace(/\n/g, '<br>'))}<p style="margin:0">${esc(c) || 'sem contato'}${conv!.pagina ? ` · página ${esc(String(conv!.pagina))}` : ''}</p><p>Responda pela caixa de mensagens do site ou do painel: a pessoa vê a resposta na hora.</p>`,
        botao: ['responder agora', 'https://useplane.com.br/#/ape-admin'] }))
    }
    return await chatLer({ token: conv!.token })
  }
  async function chatLer(body: J) {
    const { data: conv } = await db.from('ape_conversas').select('id, token, resolvida').eq('token', String(body.token ?? '')).maybeSingle()
    if (!conv) return json({ erro: 'Conversa não encontrada.', sumiu: true }, 404)
    const { data: msgs } = await db.from('ape_chat').select('id, de, texto, criado').eq('conversa', conv.id).order('criado', { ascending: true }).limit(200)
    return json({ token: conv.token, resolvida: conv.resolvida, msgs: msgs ?? [] })
  }
  async function chatResponder(req: Request, body: J) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = await db.auth.getUser(jwt)
    if (!u?.user) return json({ erro: 'Entre na sua conta.' }, 401)
    const { data: adm } = await db.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle()
    if (!adm) return json({ erro: 'Só a dona responde.' }, 403)
    const texto = String(body.texto ?? '').trim().slice(0, 3000)
    if (!texto) return json({ erro: 'Escreva a resposta.' }, 400)
    const { data: conv } = await db.from('ape_conversas').select('*').eq('id', String(body.conversa ?? '')).maybeSingle()
    if (!conv) return json({ erro: 'Conversa não encontrada.' }, 404)
    await db.from('ape_chat').insert({ conversa: conv.id, de: 'dona', texto })
    await db.from('ape_conversas').update({ atualizado: new Date().toISOString(), nao_lidas: 0 }).eq('id', conv.id)
    // se a pessoa deixou e-mail, a resposta chega lá também (caso ela tenha saído do site)
    if (mailOk(String(conv.contato || ''))) await mandar(String(conv.contato), String(conv.nome || ''), 'A Laís respondeu a sua mensagem no planê.apê', moldura({ site, kicker: 'suporte planê.apê', titulo: `Oi${conv.nome ? `, ${primeiro(String(conv.nome))}` : ''}!`, corpo: `<p style="margin:0">Respondi a sua mensagem:</p>${caixa(esc(texto).replace(/\n/g, '<br>'))}<p style="margin:0">Para continuar a conversa, abra o site no mesmo aparelho e toque em <b>ajuda</b>, ou responda este e-mail.</p>`, botao: ['abrir o site', 'https://useplane.com.br/ape/'] }))
    return json({ ok: true })
  }

  /** Balão "fale comigo": guarda a mensagem e manda e-mail para a dona na hora (com botão para responder). */
  const ultimasMsgs = new Map<string, number[]>()
  async function mensagem(req: Request, body: J) {
    const texto = String(body.texto ?? '').trim().slice(0, 2000)
    if (texto.length < 3) return json({ erro: 'Escreva a sua mensagem.' }, 400)
    const tipos: Record<string, string> = { duvida: 'dúvida', problema: 'problema no site', depoimento: 'depoimento', sugestao: 'sugestão' }
    const tipo = tipos[String(body.tipo)] ? String(body.tipo) : 'duvida'
    const nome = String(body.nome ?? '').trim().slice(0, 80)
    const contato = String(body.contato ?? '').trim().slice(0, 120)
    const pagina = String(body.pagina ?? '').slice(0, 120)
    // contra abuso: até 3 por minuto e 20 por dia por aparelho/contato
    const chave = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() + '|' + contato.toLowerCase()
    const agora = Date.now()
    const hist = (ultimasMsgs.get(chave) ?? []).filter((t) => agora - t < 864e5)
    if (hist.filter((t) => agora - t < 60e3).length >= 3 || hist.length >= 20) return json({ erro: 'Muitas mensagens seguidas. Espere um pouquinho ou chame no WhatsApp.' }, 429)
    ultimasMsgs.set(chave, [...hist, agora])
    const nota = tipo === 'depoimento' && Number(body.nota) ? Math.min(5, Math.max(1, Number(body.nota))) : null
    const { error } = await db.from('ape_feedback').insert({ tipo, texto, nota, nome: nome || 'visitante', contato, pagina })
    const zap = contato.replace(/\D/g, '')
    const ehEmail = mailOk(contato)
    const responder: [string, string] = ehEmail ? ['responder por e-mail', `mailto:${contato}?subject=${encodeURIComponent('Re: sua mensagem no planê.apê')}`] : zap.length >= 10 ? ['responder no WhatsApp', `https://wa.me/${zap.length <= 11 ? '55' + zap : zap}?text=${encodeURIComponent(`Oi${nome ? `, ${nome.split(' ')[0]}` : ''}! Aqui é a Laís do planê.apê, recebi a sua mensagem.`)}`] : ['abrir o painel', PAINEL]
    // o e-mail sai mesmo se o banco falhar: a mensagem nunca se perde
    const foi = await mandar(DONO, 'Laís', `${tipo === 'problema' ? 'Problema no site' : 'Mensagem'} no planê.apê: ${tipos[tipo]} de ${nome || 'visitante'}`, moldura({ site, dona: true, ajuda: false, previa: texto.slice(0, 90), kicker: `fale comigo · ${tipos[tipo]}${nota ? ` · nota ${nota}` : ''}`, titulo: esc(nome || 'visitante'),
      corpo: `${caixa(esc(texto).replace(/\n/g, '<br>'))}<p style="margin:0">${esc(contato) || 'sem contato'}${pagina ? ` · página ${esc(pagina)}` : ''}</p>${tipo === 'depoimento' ? '<p>Para mostrar na loja, publique no painel → opiniões.</p>' : ''}`,
      botao: responder }))
    if (error && !foi) return json({ erro: 'Não deu para enviar agora. Chame no WhatsApp.' }, 500)
    return json({ ok: true })
  }

  /** Aviso imediato para a dona quando o pagamento dá erro na loja (com os dados para ela ajudar ou cobrar direto). */
  const ultimosErros = new Map<string, number>()
  async function erroPagamento(body: J) {
    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 160)
    const chave = email || String(body.tel ?? '') || 'anon'
    if (Date.now() - (ultimosErros.get(chave) ?? 0) < 5 * 60 * 1000) return json({ ok: true })
    ultimosErros.set(chave, Date.now())
    const itens = (Array.isArray(body.itens) ? body.itens : []).slice(0, 40).map((i: J) => `${esc(String(i.nome ?? '').slice(0, 120))} (${esc(String(i.preco ?? '').slice(0, 20))})`)
    const nome = esc(String(body.nome ?? '').slice(0, 120)) || 'sem nome'
    const total = Number(body.total) || 0
    const zap = String(body.tel ?? '').replace(/\D/g, '').slice(0, 13)
    await mandar(DONO, 'Laís', `Erro no pagamento: ${nome} · ${brl(total)}`, moldura({ site, dona: true, ajuda: false, previa: `${nome} tentou pagar ${brl(total)} e deu erro.`, kicker: 'erro no pagamento', titulo: `${nome} tentou pagar e deu erro`,
      corpo: `<p style="margin:0">${esc(email) || 'sem e-mail'}${zap ? ` · ${tel(zap)}` : ''}</p>${caixa(`<b>Itens:</b><br>${itens.join('<br>') || '—'}<br><br><b>Total:</b> ${brl(total)} no ${esc(String(body.forma ?? 'pix'))}${Number(body.parcelas) > 1 ? ` em ${Number(body.parcelas)}x` : ''}<br><b>Erro:</b> ${esc(String(body.erro ?? '').slice(0, 300))}`)}<p style="margin:0">A pessoa viu na tela a opção de falar com você no WhatsApp ou pagar pelo Pix direto. Se ela pagar direto, libere em painel → clientes → dar cortesia.</p>`,
      botao: zap ? ['chamar no WhatsApp', `https://wa.me/${zap.length <= 11 ? '55' + zap : zap}`] : ['abrir o painel', PAINEL] }))
    return json({ ok: true })
  }

  /** Guarda o contato como lead no Brevo (lista de e-mail marketing): "carrinho" ao começar a compra, "cliente" ao pagar. */
  async function lead(p: J, etapa: 'carrinho' | 'cliente') {
    const key = env('BREVO_API_KEY')
    if (!key || !mailOk(String(p.email ?? ''))) return
    const lista = Number(env(etapa === 'cliente' ? 'BREVO_LISTA_CLIENTES' : 'BREVO_LISTA_LEADS', '0')) || 0
    const nome = String(p.nome ?? '').trim()
    await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: String(p.email).toLowerCase(), updateEnabled: true, attributes: { NOME: nome.split(' ')[0], SOBRENOME: nome.split(' ').slice(1).join(' '), ETAPA: etapa, ORIGEM: 'planê.apê' }, ...(lista ? { listIds: [lista] } : {}) }),
    }).catch(() => null)
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
    if (aprovar) {
      try {
        await reembolsarPedido(ped.id, body.manual === true)
      } catch (e) {
        if (/saldo insuficiente/i.test(String(e))) return json({ erro: 'O Asaas ainda não tem saldo para devolver esse valor (o estorno usa o saldo da sua conta).', semSaldo: true }, 400)
        throw e
      }
    }
    await db.from('ape_pedidos').update({ cancelamento: { ...(ped.cancelamento ?? {}), status: aprovar ? 'aprovado' : 'negado', resposta, decidido_em: new Date().toISOString() } }).eq('id', ped.id)
    await mandar(ped.email, ped.nome, aprovar ? 'Seu cancelamento foi aprovado' : 'Sobre o seu pedido de cancelamento', moldura({ site, kicker: 'pedido de cancelamento', titulo: aprovar ? 'Cancelamento aprovado' : 'Sobre o seu pedido de cancelamento',
      corpo: aprovar
        ? `<p style="margin:0">Oi, ${primeiro(ped.nome)}! O cancelamento foi aprovado e devolvemos <b>${brl(ped.total)}</b>.</p>${caixa(ped.forma === 'cartao' ? '<b>Cartão:</b> o crédito aparece em até 2 faturas, conforme o seu banco.' : '<b>Pix:</b> o valor volta para a conta que pagou, normalmente na hora.')}${resposta ? `<p>${esc(resposta)}</p>` : ''}${resumoPedido(ped, 'pedido cancelado')}<p style="margin:0">Os links de download foram desativados e pedimos que apague os arquivos baixados.</p>`
        : `<p style="margin:0">Oi, ${primeiro(ped.nome)}!</p>${caixa(esc(resposta || 'Seu pedido de cancelamento não pôde ser aprovado.'))}<p style="margin:0">Se quiser conversar, é só responder este e-mail.</p>`,
      ajuda: `Oi! Tenho uma dúvida sobre o cancelamento do pedido nº ${numPedido(ped)}` }))
    return json({ ok: true })
  }

  /** Depoimentos publicados (aparecem na loja). */
  async function depoimentos() {
    const { data } = await db.from('ape_feedback').select('texto, nota, nome, criado').eq('tipo', 'depoimento').eq('publicado', true).order('criado', { ascending: false }).limit(12)
    return json({ depoimentos: data ?? [] })
  }

  return { conta, decidir, depoimentos, emailCompra, avisarVenda, lead, testarEmail, emailReembolso, emailLembretePix, emailBonus, erroPagamento, mensagem, chatEnviar, chatLer, chatResponder }
}
