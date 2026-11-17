import { CLOUD, publishPublicFile, readPublicFile, supabase } from './cloud'
import { VISTORIA_CONTRACT, VISTORIA_PROPOSTA_URL } from './contractTemplates'

const fillContract = (body: string, vars: Record<string, string>) => body.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
import { RDL_ID } from './rdl'
import { RDL_LOGO } from './rdlLogo'
import { pixPayload } from './pix'

/* Reserva da vistoria pelo link (useplane.com.br/vistoria): o morador preenche os dados, lê o contrato
   já com os dados dele, assina e cai no painel da reserva. Tudo entra sozinho no sistema da RDL
   (tabela rdl_reservas), onde a Laís e o Rogério confirmam o sinal, marcam a data e mandam o laudo. */

export const RDL_INFO = {
  company: 'RDL Engenharia e Representações',
  cnpj: '48.624.017/0001-46',
  engineer: 'Eng. Rogério Francisco Vieira',
  crea: '5070438360',
  phone: '(11) 9 7520-8296',
  whatsapp: '11975208296',
  email: 'roger.rdl76@yahoo.com.br',
}

export const PLANTA_CANTO = 'Planta de canto (finais 01, 02, 11 e 12)'
export const PLANTA_CORREDOR = 'Planta de corredor (finais 03 a 10)'

/** O que a RDL ajusta no sistema (vai num arquivo público que a página de reserva lê). */
export interface ReservaConfig {
  empreendimento: string
  preco: number // valor por apartamento nesta campanha (grupo)
  revistoria: number
  periodo: string // previsão das vistorias pela construtora
  pix: string // chave Pix para o sinal (vazio = combinado no WhatsApp)
  pixNome: string
  aberta: boolean
  individual: number // valor se o grupo não fechar
  minimo: number // apartamentos para valer o valor de grupo
  prazoSinal: number // dias para pagar o sinal (depois cancela sozinho)
  plantas: string[] // opções de planta que o morador escolhe
  duracao?: number // minutos de vistoria (agenda)
  respiro?: number // minutos de folga entre uma vistoria e outra (deslocamento, imprevistos)
}
export const CONFIG_PADRAO: ReservaConfig = {
  empreendimento: 'Condomínio San Levi (MRV)',
  preco: 280,
  revistoria: 150,
  periodo: 'entre dezembro de 2026 e março de 2027',
  pix: '',
  pixNome: 'RDL Engenharia',
  aberta: true,
  individual: 297,
  minimo: 10,
  prazoSinal: 7,
  plantas: [PLANTA_CANTO, PLANTA_CORREDOR],
  duracao: 120,
  respiro: 30,
}
const CONFIG_FILE = 'reserva-vistoria.json'
/** San Levi: 12 apês por andar; finais 01, 02, 11 e 12 são a planta de canto, 03 a 10 a de corredor. */
export function plantaDoApto(apto: string): string {
  const d = String(apto ?? '').replace(/\D/g, '')
  if (d.length < 3) return ''
  const f = Number(d.slice(-2))
  if (!f || f > 12) return ''
  return [1, 2, 11, 12].includes(f) ? PLANTA_CANTO : PLANTA_CORREDOR
}
export async function lerConfig(): Promise<ReservaConfig> {
  const c = CLOUD ? await readPublicFile<Partial<ReservaConfig>>(RDL_ID, CONFIG_FILE) : null
  return { ...CONFIG_PADRAO, ...(c ?? {}) }
}
export const salvarConfig = (c: ReservaConfig) => publishPublicFile(RDL_ID, CONFIG_FILE, c)

export interface ReservaDados {
  nome: string
  cpf: string
  email: string
  tel: string
  endereco: string // endereço atual do morador
  cep?: string
  rua?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  torre: string
  apto: string
  revistoria: boolean
  planta?: string
  reforma?: string // já pediu orçamento de ART de reforma na reserva (o que vai fazer)
  reformaItens?: string[]
  reformaEstimativa?: number
  obs?: string
}
/** ART de reforma: o morador pede pelo painel, a RDL manda o valor e ele aprova ali mesmo. */
export interface ReformaPedido {
  pedido?: string // o que vai fazer na reforma
  itens?: string[] // serviços marcados na calculadora
  estimativa?: number // valor que a calculadora mostrou
  pedidoEm?: string
  escopo?: string // o que a RDL vai cobrir
  valor?: number
  prazo?: string
  enviadoEm?: string
  aprovadoEm?: string
  art?: string // link da ART de reforma
  prestador?: string // quem vai executar a obra (informado pelo morador)
  termoAceito?: string // quando aceitou o termo da ART de reforma
}
export interface ReservaContrato {
  texto: string
  assinatura: string // nome digitado
  desenho?: string // traço desenhado
  cpf: string
  em: string
  codigo: string // SHA-256 do texto + quem assinou
  aparelho: string
  fuso: string
  recebido?: string
  ip?: string // gravado pelo banco
}
export interface ReservaStatus {
  sinal?: string // data em que a RDL confirmou o sinal
  quitado?: string
  data?: string // data da vistoria (AAAA-MM-DD)
  hora?: string
  laudo?: string // link do laudo
  laudoEm?: string
  revistoriaData?: string
  contratada?: string // quando a RDL assinou (ao confirmar o sinal)
  obs?: string
  cliente?: string // id do cliente no sistema
  art?: string // link da ART da vistoria
  reforma?: ReformaPedido
  expirada?: string // cancelada sozinha por falta de sinal
}
export interface Reserva {
  id: string
  token: string
  criado: string
  dados: ReservaDados
  contrato: ReservaContrato
  status: ReservaStatus
  cancelada: boolean
  ordem?: number
}

export function validCpf(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (n: number) => {
    let t = 0
    for (let i = 0; i < n; i++) t += Number(d[i]) * (n + 1 - i)
    const r = (t * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

/* ---------- contrato preenchido ---------- */
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const UN = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
function ate999(n: number): string {
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const r = n % 100
  const d = r < 20 ? UN[r] : [DZ[Math.floor(r / 10)], UN[r % 10]].filter(Boolean).join(' e ')
  return [CT[c], d].filter(Boolean).join(' e ')
}
export function extenso(v: number) {
  const reais = Math.floor(v)
  const cent = Math.round((v - reais) * 100)
  const r = reais >= 1000 ? `${Math.floor(reais / 1000) === 1 ? 'mil' : `${ate999(Math.floor(reais / 1000))} mil`}${reais % 1000 ? ` e ${ate999(reais % 1000)}` : ''}` : ate999(reais)
  return [reais ? `${r} ${reais === 1 ? 'real' : 'reais'}` : '', cent ? `${ate999(cent)} centavo${cent > 1 ? 's' : ''}` : ''].filter(Boolean).join(' e ')
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const dataLonga = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
export const dataCurta = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : '')
/** Endereço completo em uma linha (para o contrato e o cadastro). */
export const enderecoCompleto = (d: Partial<ReservaDados>) =>
  d.rua ? `${d.rua}, ${d.numero}${d.complemento ? `, ${d.complemento}` : ''} - ${d.bairro}, ${d.cidade} - ${d.uf}, CEP ${d.cep}` : (d.endereco ?? '')
export const unidade = (d: Pick<ReservaDados, 'torre' | 'apto'>) => `${d.torre ? `torre ${d.torre}, ` : ''}apto ${d.apto}`

export function contratoTexto(d: ReservaDados, c: ReservaConfig, quando = new Date()) {
  const metade = Math.round((c.preco / 2) * 100) / 100
  const corpo = VISTORIA_CONTRACT.body
    .replace('IMÓVEL VISTORIADO\n{endereco_obra}', `IMÓVEL VISTORIADO\n{endereco_obra}${d.planta ? `\nPlanta: ${d.planta}.` : ''}\nPrevisão das vistorias informada pela construtora: ${c.periodo}. A data e o horário são combinados quando a construtora liberar a agenda (cláusula 6).\nRevistoria (cláusula 9): ${d.revistoria ? `o(a) CONTRATANTE já deixa a revistoria combinada, pelo valor de ${brl(c.revistoria)}, pago no dia da revistoria.` : 'não contratada agora; pode ser pedida depois, conforme a cláusula 9.'}${d.reforma ? `\nART de reforma (cláusula 10.2): o(a) CONTRATANTE pediu orçamento à parte para: ${d.reforma.trim().slice(0, 300)}. Só passa a valer se o(a) CONTRATANTE aprovar o orçamento no painel.` : ''}`)
  return fillContract(corpo, {
    contratada: RDL_INFO.company,
    doc_contratada: `CNPJ ${RDL_INFO.cnpj}`,
    email_contratada: RDL_INFO.email,
    telefone_contratada: RDL_INFO.phone,
    contratante: d.nome.trim(),
    doc_contratante: `CPF ${d.cpf}`,
    endereco_contratante: d.endereco.trim(),
    email_contratante: d.email.trim(),
    telefone_contratante: d.tel.trim(),
    endereco_obra: `${c.empreendimento}, ${unidade(d)}, Santo André - SP`,
    valor: brl(c.preco),
    valor_individual: brl(c.individual),
    minimo: String(c.minimo),
    prazo_sinal: String(c.prazoSinal),
    valor_extenso: extenso(c.preco),
    entrada: brl(metade),
    saldo: brl(c.preco - metade),
    pagamento: 'sinal por Pix na reserva; saldo por Pix ou cartão no dia da vistoria.',
    foro: 'Santo André/SP',
    cidade: 'Santo André',
    data: dataLonga(quando),
  })
}

export async function sha256(t: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/* ---------- banco ---------- */
export async function reservar(dados: ReservaDados, contrato: ReservaContrato): Promise<{ id: string; token: string }> {
  if (!supabase) throw new Error('sem nuvem')
  const { data, error } = await supabase.rpc('rdl_reservar', { p_dados: dados, p_contrato: contrato })
  if (error) throw error
  return data as { id: string; token: string }
}
export async function minhaReserva(id: string, token: string): Promise<Reserva | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('rdl_minha_reserva', { p_id: id, p_token: token })
  if (error || !data) return null
  return { ...(data as Reserva), token }
}
export async function contagem(): Promise<number> {
  if (!supabase) return 0
  const { data } = await supabase.rpc('rdl_contagem')
  return Number(data) || 0
}
export async function listarReservas(): Promise<Reserva[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('rdl_reservas').select('*').order('criado', { ascending: true })
  if (error) throw error
  return (data ?? []) as Reserva[]
}
export async function atualizarReserva(id: string, patch: Partial<Pick<Reserva, 'status' | 'cancelada' | 'dados'>>) {
  if (!supabase) return
  const { error } = await supabase.from('rdl_reservas').update(patch).eq('id', id)
  if (error) throw error
}
export async function apagarReserva(id: string) {
  if (!supabase) return
  const { error } = await supabase.from('rdl_reservas').delete().eq('id', id)
  if (error) throw error
}

/** O que o morador pode mudar pelo painel (planta, pedido e aprovação da ART de reforma). */
export async function moradorAcao(id: string, token: string, acao: 'planta' | 'reforma-pedido' | 'reforma-aprovar', valor: string | { pedido: string; itens: string[]; estimativa: number } | { prestador: string; termo: string } = ''): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('rdl_morador', { p_id: id, p_token: token, p_acao: acao, p_valor: typeof valor === 'string' ? valor : JSON.stringify(valor) })
  return !error && !!data
}

/** Morador de teste (só nesta tela, nada é salvo nem enviado). */
export function reservaTeste(etapa: 'reserva' | 'sinal' | 'data' | 'laudo', c: ReservaConfig): Reserva {
  const hoje = new Date().toISOString()
  const dados: ReservaDados = { nome: 'Morador Teste', cpf: '529.982.247-25', email: 'teste@exemplo.com', tel: '(11) 9 0000-0000', endereco: 'Rua Exemplo, 100 - Centro, Santo André - SP, CEP 09000-000', torre: '2', apto: '1204', planta: PLANTA_CORREDOR, revistoria: true }
  const status: ReservaStatus = {}
  if (etapa !== 'reserva') Object.assign(status, { sinal: hoje.slice(0, 10), contratada: hoje })
  if (etapa === 'data' || etapa === 'laudo') Object.assign(status, { data: '2027-01-20', hora: '10:30' })
  if (etapa === 'laudo') Object.assign(status, { quitado: hoje.slice(0, 10), laudo: 'https://useplane.com.br/rdl/proposta-vistoria-san-levi.pdf', art: 'https://useplane.com.br/rdl/proposta-vistoria-san-levi.pdf', reforma: { pedido: 'Trocar o piso da sala e fazer um armário na cozinha', pedidoEm: hoje, escopo: 'ART de execução da reforma (piso e marcenaria) e plano de reforma para o condomínio', valor: 350, prazo: 'até 5 dias úteis', enviadoEm: hoje } })
  const texto = contratoTexto(dados, c)
  return { id: 'teste000-0000-4000-8000-000000000000', token: 'teste', criado: hoje, dados, contrato: { texto, assinatura: dados.nome, cpf: dados.cpf, em: hoje, codigo: 'teste', aparelho: 'teste', fuso: 'America/Sao_Paulo' }, status, cancelada: false, ordem: 3 }
}

/** E-mail da etapa para o morador (e, na reserva, para a RDL), pelo remetente da planê com a identidade da RDL. Nunca trava a tela. */
export async function avisarEmail(evento: 'reserva' | 'sinal' | 'data' | 'laudo' | 'revistoria' | 'cancelada' | 'lembrete' | 'reforma-pedido' | 'reforma-orcamento' | 'reforma-aprovada', id: string, token?: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { data, error } = await supabase.functions.invoke('avisos', { body: { tipo: 'rdl', evento, id, token } })
    return !error && !!(data as { ok?: boolean })?.ok
  } catch {
    return false
  }
}

/* ---------- ART de reforma: o morador marca o que vai fazer e vê o valor na hora ---------- */
/** Mínimo de R$ 250 (ART da reforma como responsável técnico + plano de reforma para o condomínio + visita técnica, com 1 serviço).
 *  Cada serviço a mais soma o valor dele. Nada que mexa nas paredes (concreto estrutural). */
export const REFORMA_MIN = 250
export const REFORMA_ITENS: { id: string; nome: string; desc: string; mais: number }[] = [
  { id: 'piso', nome: 'Piso na sala e nos quartos', desc: 'Vêm no contrapiso: vinílico, laminado ou porcelanato', mais: 30 },
  { id: 'revest', nome: 'Trocar piso ou azulejo da cozinha ou banheiro', desc: 'Retirar a cerâmica da MRV e colocar outra', mais: 40 },
  { id: 'armarios', nome: 'Armários e marcenaria', desc: 'Cozinha, quartos e banheiro, com fixação segura', mais: 30 },
  { id: 'bancada', nome: 'Bancada de pedra', desc: 'Cozinha, banheiro ou área de serviço', mais: 30 },
  { id: 'gesso', nome: 'Forro de gesso ou sanca', desc: 'Rebaixar o teto, sanca ou cortineiro', mais: 40 },
  { id: 'luz', nome: 'Iluminação e tomadas', desc: 'Pelo forro ou por canaleta, sem rasgar parede', mais: 40 },
  { id: 'ar', nome: 'Ar-condicionado', desc: 'Instalação conforme as regras do condomínio', mais: 40 },
  { id: 'loucas', nome: 'Louças, metais e box', desc: 'Vaso, cuba, torneiras, chuveiro e box', mais: 20 },
  { id: 'pintura', nome: 'Pintura', desc: 'Cor nova nas paredes e no teto', mais: 0 },
]
/** Valor estimado: o primeiro serviço está no mínimo; os outros somam o valor de cada um. */
export function calcReforma(ids: string[]): number {
  const itens = REFORMA_ITENS.filter((i) => ids.includes(i.id)).sort((a, b) => b.mais - a.mais)
  if (!itens.length) return REFORMA_MIN
  return REFORMA_MIN + itens.slice(1).reduce((t, i) => t + i.mais, 0)
}
/** Termo da ART de reforma: o morador aceita no painel antes de aprovar o orçamento (protege o responsável técnico). */
export const TERMO_REFORMA = [
  'O Rogério (RDL Engenharia) é o responsável técnico da reforma: faz a visita técnica, o plano de reforma e registra a ART. Ele não executa a obra e não acompanha o dia a dia dela.',
  'A obra é feita pelo prestador que eu contratar (pedreiro, marceneiro, empresa), que responde pela qualidade do serviço, pelos materiais, pela segurança dos trabalhadores e por danos ao meu apê, aos vizinhos e às áreas comuns.',
  'Vou passar o plano de reforma ao meu prestador e garantir que ele siga o plano, o manual do proprietário da MRV e as regras do condomínio (horários, entrada de material, retirada de entulho).',
  'Sei que as paredes do San Levi são de concreto e estruturais: não vou derrubar, cortar, rasgar ou fazer furos fora do que o plano e o manual permitem, nem mexer em colunas de água, esgoto, gás ou na fachada.',
  'Qualquer serviço que não esteja no plano precisa ser combinado antes com a RDL. Mudou o que vai ser feito, pode ser preciso uma ART nova.',
  'Vou avisar a RDL quando a obra começar e terminar, e deixar o engenheiro entrar para conferir quando ele pedir.',
  'Se a obra for feita diferente do plano, sem aviso, a RDL pode dar baixa na ART e avisar o condomínio, e não responde pelo que foi feito fora do plano.',
  'A garantia da MRV pode ser perdida nos itens reformados. Isso é responsabilidade minha e do meu prestador.',
]
export const termoReformaTexto = () => TERMO_REFORMA.map((t, i) => `${i + 1}. ${t}`).join('\n')

export const reformaItensTexto = (ids: string[]) => REFORMA_ITENS.filter((i) => ids.includes(i.id)).map((i) => i.nome.toLowerCase())

/* ---------- chat de dúvidas ---------- */
export interface ChatMsg {
  id: number
  autor: 'morador' | 'rdl'
  texto: string
  criado: string
}
export interface Conversa {
  id: string
  token: string
  nome: string
  contato: string
  reserva: string | null
  criado: string
  atualizado: string
  lida_rdl: string | null
}
export async function chatAbrir(nome: string, contato: string, reserva?: { id: string; token: string }): Promise<{ id: string; token: string } | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('rdl_chat_abrir', { p_nome: nome, p_contato: contato, p_reserva: reserva?.id ?? null, p_token_reserva: reserva?.token ?? null })
  return error ? null : (data as { id: string; token: string })
}
export async function chatEnviar(c: { id: string; token: string }, texto: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('rdl_chat_enviar', { p_conversa: c.id, p_token: c.token, p_texto: texto })
  if (error || !data) return false
  void supabase.functions.invoke('avisos', { body: { tipo: 'rdl-chat', evento: 'morador', conversa: c.id, token: c.token } }).catch(() => undefined)
  return true
}
export async function chatLer(c: { id: string; token: string }): Promise<ChatMsg[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('rdl_chat_ler', { p_conversa: c.id, p_token: c.token })
  return error || !data ? null : (data as ChatMsg[])
}
/* lado da RDL (logada) */
export async function listarConversas(): Promise<(Conversa & { ultima?: ChatMsg; naoLidas: number })[]> {
  if (!supabase) return []
  const [{ data: cs }, { data: ms }] = await Promise.all([supabase.from('rdl_conversas').select('*').order('atualizado', { ascending: false }), supabase.from('rdl_mensagens').select('*').order('criado', { ascending: true })])
  const msgs = (ms ?? []) as (ChatMsg & { conversa: string })[]
  return ((cs ?? []) as Conversa[]).map((c) => {
    const mine = msgs.filter((m) => m.conversa === c.id)
    return { ...c, ultima: mine[mine.length - 1], naoLidas: mine.filter((m) => m.autor === 'morador' && (!c.lida_rdl || m.criado > c.lida_rdl)).length }
  })
}
export async function mensagensDe(conversa: string): Promise<ChatMsg[]> {
  if (!supabase) return []
  const { data } = await supabase.from('rdl_mensagens').select('*').eq('conversa', conversa).order('criado', { ascending: true })
  return (data ?? []) as ChatMsg[]
}
export async function responderChat(conversa: string, texto: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('rdl_mensagens').insert({ conversa, autor: 'rdl', texto })
  if (error) return false
  await supabase.from('rdl_conversas').update({ atualizado: new Date().toISOString(), lida_rdl: new Date().toISOString() }).eq('id', conversa)
  void supabase.functions.invoke('avisos', { body: { tipo: 'rdl-chat', evento: 'rdl', conversa } }).catch(() => undefined)
  return true
}
export async function marcarLida(conversa: string) {
  if (!supabase) return
  await supabase.from('rdl_conversas').update({ lida_rdl: new Date().toISOString() }).eq('id', conversa)
}

/* ---------- links ---------- */
const base = () => `${location.origin}${location.pathname.replace(/\/(rdl|vistoria)\/?$/, '/')}`
export const linkReserva = () => `${base().replace(/\/$/, '')}/vistoria/`
export const linkPainelBase = () => base()
export const linkPainel = (r: Pick<Reserva, 'id' | 'token'>) => `${base()}#/vistoria/${r.id}.${r.token}`

export const pixCopiaECola = (c: ReservaConfig, valor: number, r: Pick<Reserva, 'dados'>) =>
  c.pix ? pixPayload({ key: c.pix, name: c.pixNome || 'RDL Engenharia', city: 'Santo Andre', amount: valor, message: `Vistoria ${unidade(r.dados)}`.slice(0, 40) }) : ''

/* ---------- mensagens de WhatsApp por etapa (emojis só nas mensagens) ---------- */
export function mensagens(r: Reserva, c: ReservaConfig) {
  const nome = r.dados.nome.split(' ')[0]
  const metade = c.preco / 2
  const painel = linkPainel(r)
  return {
    sinal: `Oi, ${nome}! Tudo bem? 😊\nRecebemos a sua reserva da vistoria do ${unidade(r.dados)} no ${c.empreendimento.replace(/\s*\(.*\)/, '')}.\n\nPara garantir a vaga, falta só o sinal de *${brl(metade)}*, em até 7 dias${c.pix ? ` no Pix:\n*${c.pix}*` : '.'}\nDepois é só mandar o comprovante por aqui.\n\nO seu painel com o contrato e tudo da vistoria:\n${painel}`,
    confirmado: `Oi, ${nome}! ✅ Sinal recebido, a sua vaga na agenda está garantida.\n\nAssim que a MRV liberar as datas (${c.periodo}), me avisa para a gente combinar o horário antes de você confirmar com eles.\n\nPainel da sua vistoria:\n${painel}`,
    data: `Oi, ${nome}! 📅 A sua vistoria ficou marcada para *${dataCurta(r.status.data)}${r.status.hora ? ` às ${r.status.hora}` : ''}*.\n\nLembretes:\n• água e luz ligadas pela MRV\n• você ou alguém de confiança acompanhando\n• restante de *${brl(c.preco - metade)}* no dia (Pix ou cartão)\n\nQualquer coisa, me chama por aqui.`,
    laudo: `Oi, ${nome}! 📄 O laudo da vistoria do ${unidade(r.dados)} está pronto, junto com a ART.\nEstá no seu painel:\n${painel}\n\nÉ só encaminhar para a MRV pelo atendimento deles e guardar o protocolo. Se quiser a revistoria depois dos reparos, é só chamar.`,
    lembrete: `Oi, ${nome}! Tudo bem? Passando para lembrar do sinal da reserva da vistoria (${brl(metade)}), que garante a sua vaga na agenda. Se precisar de alguma coisa, é só falar 😊\n${painel}`,
  }
}

/* ---------- contrato para imprimir ou salvar em PDF (papel timbrado da RDL) ---------- */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export function contratoHtml(r: Pick<Reserva, 'contrato' | 'status' | 'id'>, desenhoSrc?: string) {
  const linhas = r.contrato.texto.split('\n')
  const corpo = linhas
    .map((l, i) => {
      const t = esc(l)
      if (i === 0) return `<h1>${t}</h1>`
      if (!l.trim()) return ''
      if (/^(\d+\. |CONTRATADA$|CONTRATANTE$|IMÓVEL VISTORIADO$|ANEXO I)/.test(l)) return `<h2>${t}</h2>`
      if (l.startsWith('•')) return `<p class="b">${t}</p>`
      const m = t.match(/^(\d+\.\d+) (.*)$/)
      return m ? `<p><b>${m[1]}</b> ${m[2]}</p>` : `<p>${t.replace(VISTORIA_PROPOSTA_URL, `<a href="${VISTORIA_PROPOSTA_URL}">${VISTORIA_PROPOSTA_URL.replace('https://', '')}</a>`)}</p>`
    })
    .join('')
  const quando = new Date(r.contrato.em).toLocaleString('pt-BR')
  const rdlOk = r.status.contratada ? new Date(r.status.contratada).toLocaleString('pt-BR') : ''
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Contrato de vistoria · ${esc(r.contrato.assinatura)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"><style>
@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Poppins,Arial,sans-serif;color:#1d2a40;font-size:9.6pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
.hd{position:fixed;top:0;left:0;right:0;height:38mm;text-align:center;padding-top:8mm;background:#fff}.hd img{height:19mm}
.hd i{display:block;margin:4mm 19mm 0;height:1px;background:#E6E4DE;position:relative}.hd i:after{content:"";position:absolute;left:50%;top:-1px;width:40px;margin-left:-20px;height:3px;background:#FF8216;border-radius:2px}
.ft{position:fixed;bottom:0;left:0;right:0;height:17mm;background:#012C60;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:0 13mm;font-size:7.4pt;border-top:3px solid #FF8216}
.ft b{display:block;font-size:8.2pt}.ft span{opacity:.75}.ft .r{text-align:right;line-height:1.6}
table.pg{width:100%;border-collapse:collapse}table.pg td{padding:0 19mm}.sp-t{height:42mm}.sp-b{height:24mm}
h1{font-size:14pt;color:#012C60;text-align:center;line-height:1.3;margin:0 8mm 5mm;font-weight:700}
h2{font-size:8.6pt;letter-spacing:1.6px;color:#012C60;margin:4mm 0 1.5mm;font-weight:600;page-break-after:avoid}
h2:before{content:"";display:inline-block;width:14px;height:3px;background:#FF8216;border-radius:2px;margin:0 8px 2px 0}
p{margin:0 0 1.2mm;text-align:justify}p b{color:#012C60}p.b{padding-left:4mm}a{color:#012C60}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:9mm;page-break-inside:avoid}
.sig div{border:1px solid #E6E4DE;border-radius:10px;padding:4mm;text-align:center;min-height:36mm;display:flex;flex-direction:column;justify-content:flex-end}
.sig img{max-height:16mm;max-width:100%;margin:0 auto 1mm}.sig .typed{font-size:15pt;color:#012C60;font-style:italic;margin-bottom:1mm}
.sig b{display:block;border-top:1px solid #9aa3b6;padding-top:2mm;font-size:7.6pt;color:#012C60;letter-spacing:1px}.sig small{display:block;font-size:6.8pt;color:#7a7f92;line-height:1.45}
.cert{margin-top:5mm;border-radius:10px;background:#F1F2F6;padding:3.5mm 4mm;font-size:7pt;color:#46506A;page-break-inside:avoid}.cert b{color:#012C60}
@media screen{body{background:#d9dce3}.wrap{max-width:210mm;margin:0 auto;background:#fff;min-height:100vh}.hd,.ft{position:static}.sp-t,.sp-b{height:6mm}}
</style></head><body><div class="wrap">
<div class="hd"><img src="${RDL_LOGO}" alt="RDL"><i></i></div>
<table class="pg"><thead><tr><td><div class="sp-t"></div></td></tr></thead><tfoot><tr><td><div class="sp-b"></div></td></tr></tfoot><tbody><tr><td>
${corpo}
<div class="sig"><div>${rdlOk ? `<div class="typed">RDL Engenharia</div>` : ''}<b>RDL ENGENHARIA E REPRESENTAÇÕES</b><small>${esc(RDL_INFO.engineer)} · CREA-SP ${RDL_INFO.crea} · CONTRATADA${rdlOk ? `<br>aceite registrado em ${rdlOk}` : '<br>aceite registrado na confirmação do sinal'}</small></div>
<div>${desenhoSrc ? `<img src="${desenhoSrc}" alt="">` : `<div class="typed">${esc(r.contrato.assinatura)}</div>`}<b>CONTRATANTE</b><small>${esc(r.contrato.assinatura)} · CPF ${esc(r.contrato.cpf)}<br>assinado eletronicamente em ${quando}</small></div></div>
<div class="cert"><b>Registro da assinatura eletrônica</b> (art. 10, § 2º, da MP 2.200-2/2001): assinado por ${esc(r.contrato.assinatura)}, CPF ${esc(r.contrato.cpf)}, em ${quando} (${esc(r.contrato.fuso)}), pelo aparelho ${esc(r.contrato.aparelho)}${r.contrato.ip ? `, IP ${esc(r.contrato.ip)}` : ''}, no link de reserva da RDL Engenharia. Código do documento (SHA-256 do texto assinado): <b>${esc(r.contrato.codigo)}</b>. Reserva nº ${esc(r.id.slice(0, 8).toUpperCase())}.</div>
</td></tr></tbody></table>
<div class="ft"><div><b>${esc(RDL_INFO.engineer)}</b><span>${esc(RDL_INFO.company)} · CNPJ ${RDL_INFO.cnpj}</span></div><div class="r">${RDL_INFO.phone}<br><span>${RDL_INFO.email}</span></div></div>
</div></body></html>`
}

export function abrirContrato(r: Pick<Reserva, 'contrato' | 'status' | 'id'>, desenhoSrc?: string, imprimir = true) {
  const html = contratoHtml(r, desenhoSrc)
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(imprimir ? html.replace('</body>', '<script>setTimeout(function(){try{window.print()}catch(e){}},900)</script></body>') : html)
  w.document.close()
  return true
}
