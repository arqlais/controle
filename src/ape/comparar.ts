/* planê.apê: comparação de orçamentos além do preço — escopo, materiais, quantidades, prazos, pagamento,
   garantia, o que falta em cada um, divergências e custos que podem aparecer depois.
   Também tem a leitura "sem IA" (regras simples) usada quando a leitura automática não está disponível. */

import { calc, digits, num, type Nicho, type Orcamento } from './model'

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* Conceitos de escopo por serviço: o que costuma estar (ou faltar) num orçamento. Cada um tem palavras que o identificam
   e quanto pesa no bolso se ficar de fora. */
type Conceito = { id: string; l: string; k: string[]; extra?: boolean }
const GERAIS: Conceito[] = [
  { id: 'material', l: 'material', k: ['material', 'materiais', 'fornecimento'] },
  { id: 'mao', l: 'mão de obra / instalação', k: ['mao de obra', 'instalacao', 'instalar', 'montagem', 'aplicacao', 'execucao', 'servico de'] },
  { id: 'frete', l: 'frete / entrega', k: ['frete', 'entrega', 'transporte'], extra: true },
  { id: 'entulho', l: 'retirada de entulho / limpeza', k: ['entulho', 'cacamba', 'limpeza', 'descarte'], extra: true },
  { id: 'projeto', l: 'projeto / medição', k: ['projeto', 'medicao', 'medida', 'levantamento', 'render', '3d'] },
  { id: 'garantia', l: 'garantia por escrito', k: ['garantia'] },
]
const POR_NICHO: Partial<Record<Nicho, Conceito[]>> = {
  'piso-vinilico': [
    { id: 'rodape', l: 'rodapé', k: ['rodape'], extra: true },
    { id: 'contrapiso', l: 'regularização do contrapiso', k: ['contrapiso', 'regularizacao', 'autonivelante', 'nivelamento'], extra: true },
    { id: 'manta', l: 'manta / cola', k: ['manta', 'cola', 'adesivo'] },
    { id: 'perfil', l: 'perfis e acabamentos de porta', k: ['perfil', 'soleira', 'arremate', 'acabamento'] },
  ],
  'piso-laminado': [
    { id: 'rodape', l: 'rodapé', k: ['rodape'], extra: true },
    { id: 'manta', l: 'manta acústica', k: ['manta'] },
    { id: 'perfil', l: 'perfis e acabamentos', k: ['perfil', 'soleira', 'arremate', 'acabamento'] },
  ],
  'piso-ceramico': [
    { id: 'argamassa', l: 'argamassa e rejunte', k: ['argamassa', 'rejunte'] },
    { id: 'rodape', l: 'rodapé', k: ['rodape'], extra: true },
    { id: 'demolicao', l: 'retirada do piso antigo', k: ['demolicao', 'retirada', 'remocao'], extra: true },
    { id: 'nivel', l: 'nivelador / espaçador', k: ['nivelador', 'espacador', 'cunha'] },
  ],
  revestimentos: [
    { id: 'argamassa', l: 'argamassa e rejunte', k: ['argamassa', 'rejunte'] },
    { id: 'cantoneira', l: 'cantoneiras / acabamentos', k: ['cantoneira', 'perfil', 'acabamento', 'meia esquadria'] },
  ],
  marcenaria: [
    { id: 'ferragens', l: 'ferragens com amortecedor', k: ['amortecedor', 'ferragem', 'dobradica', 'corredica', 'blum', 'hafele', 'telescopica'] },
    { id: 'puxador', l: 'puxadores', k: ['puxador', 'cava', 'perfil puxador'] },
    { id: 'fundo', l: 'fundo e laterais no mesmo MDF', k: ['fundo', 'lateral'] },
    { id: 'led', l: 'iluminação de LED', k: ['led', 'fita', 'iluminacao'] },
    { id: 'tamponamento', l: 'tamponamentos / acabamento lateral', k: ['tamponamento', 'acabamento'] },
  ],
  marmoraria: [
    { id: 'cuba', l: 'cuba', k: ['cuba'], extra: true },
    { id: 'frontao', l: 'frontão / rodabanca', k: ['frontao', 'rodabanca', 'espelho'] },
    { id: 'saia', l: 'saia / acabamento de borda', k: ['saia', 'borda', 'acabamento', 'meia esquadria'] },
    { id: 'furos', l: 'furos (torneira, cooktop)', k: ['furo', 'recorte', 'cooktop', 'torneira'] },
    { id: 'instal', l: 'instalação e silicone', k: ['instalacao', 'silicone', 'colocacao'] },
  ],
  box: [
    { id: 'ferragem', l: 'ferragens / perfis', k: ['ferragem', 'perfil', 'kit', 'roldana', 'trilho'] },
    { id: 'vidro', l: 'vidro temperado (espessura)', k: ['temperado', '8mm', '8 mm', '10mm', '10 mm', 'vidro'] },
  ],
  gesso: [
    { id: 'sanca', l: 'sanca / cortineiro', k: ['sanca', 'cortineiro', 'tabica'] },
    { id: 'massa', l: 'massa e lixa (pronto para pintar)', k: ['massa', 'lixa', 'acabamento'] },
    { id: 'recortes', l: 'recortes para spots', k: ['recorte', 'spot', 'furo'] },
  ],
  eletrica: [
    { id: 'quadro', l: 'quadro / disjuntores', k: ['quadro', 'disjuntor', 'dr', 'dps'] },
    { id: 'fiacao', l: 'fiação', k: ['fio', 'fiacao', 'cabo'] },
    { id: 'pontos', l: 'pontos novos', k: ['ponto', 'tomada', 'interruptor'] },
    { id: 'art', l: 'ART / responsável técnico', k: ['art', 'responsavel tecnico', 'engenheiro'] },
  ],
  hidraulica: [
    { id: 'pontos', l: 'pontos de água / esgoto', k: ['ponto', 'agua', 'esgoto', 'registro'] },
    { id: 'teste', l: 'teste de estanqueidade', k: ['teste', 'estanqueidade', 'pressao'] },
    { id: 'quebra', l: 'quebra e fechamento de parede', k: ['quebra', 'fechamento', 'reboco', 'rasgo'], extra: true },
  ],
  impermeabilizacao: [
    { id: 'manta', l: 'manta / produto', k: ['manta', 'membrana', 'impermeabilizante'] },
    { id: 'teste', l: 'teste de lâmina d\'água', k: ['teste', 'lamina'] },
    { id: 'protecao', l: 'proteção mecânica', k: ['protecao', 'contrapiso'], extra: true },
  ],
  serralheria: [
    { id: 'pintura', l: 'pintura / tratamento anticorrosivo', k: ['pintura', 'anticorrosivo', 'zarcao', 'galvaniz', 'eletrostatica'] },
    { id: 'chumbamento', l: 'chumbamento / fixação', k: ['chumbamento', 'fixacao', 'parafuso', 'bucha'] },
  ],
  ar: [
    { id: 'infra', l: 'infraestrutura (tubulação)', k: ['infra', 'tubulacao', 'cobre', 'dreno'] },
    { id: 'suporte', l: 'suporte da condensadora', k: ['suporte', 'condensadora'] },
    { id: 'ponto', l: 'ponto elétrico exclusivo', k: ['ponto eletrico', 'disjuntor', 'tomada'], extra: true },
  ],
  pintura: [
    { id: 'massa', l: 'massa corrida / correções', k: ['massa', 'correcao', 'emassamento'] },
    { id: 'selador', l: 'selador / fundo', k: ['selador', 'fundo preparador', 'primer'] },
    { id: 'tinta', l: 'tinta (marca e linha)', k: ['tinta', 'suvinil', 'coral', 'sherwin', 'acrilica', 'premium'] },
    { id: 'demaos', l: 'número de demãos', k: ['demao', 'demaos'] },
    { id: 'protecao', l: 'proteção de pisos e esquadrias', k: ['protecao', 'lona', 'fita'] },
  ],
  cortinas: [
    { id: 'trilho', l: 'trilho / varão', k: ['trilho', 'varao', 'suporte'] },
    { id: 'instal', l: 'instalação', k: ['instalacao'] },
  ],
  telas: [{ id: 'instal', l: 'instalação', k: ['instalacao'] }],
}
const conceitos = (n: Nicho) => [...GERAIS, ...(POR_NICHO[n] || [])]

/** Texto todo do orçamento, para procurar o escopo. */
const textoDe = (o: Orcamento) => sem([o.servico, o.resumo, ...(o.inclui || []), ...(o.itens || []).map((i) => i.descricao), ...(o.materiais || []), o.garantia, o.prazo].join(' · '))
const textoFora = (o: Orcamento) => sem((o.nao_inclui || []).join(' · '))
const tem = (txt: string, c: Conceito) => c.k.some((k) => new RegExp(`(^|[^a-z])${k.replace(/ /g, '\\s*')}`, 'i').test(txt))

export type Marca = 'sim' | 'nao' | 'fora' // sim: está no orçamento · nao: não fala · fora: diz que não inclui
export interface LinhaEscopo { id: string; l: string; extra: boolean; marcas: Marca[] }
export interface Comparacao {
  orcs: Orcamento[]
  precos: { avista: number | null; parcelado: string; m2: number | null; area: number | null; total: number | null }[]
  escopo: LinhaEscopo[]
  faltas: string[][] // por orçamento: o que os outros têm e este não fala (pode virar custo extra)
  divergencias: string[]
  extras: string[][] // por orçamento: custos que podem aparecer
  destaques: { l: string; i: number; porque: string }[]
  pendentes: string[][] // por orçamento: informações que faltam pedir ao fornecedor
}

export function comparar(orcs: Orcamento[]): Comparacao {
  const n = orcs[0]?.nicho || 'outros'
  const cs = conceitos(n)
  const txts = orcs.map(textoDe)
  const foras = orcs.map(textoFora)
  const escopo: LinhaEscopo[] = cs
    .map((c) => ({ id: c.id, l: c.l, extra: !!c.extra, marcas: orcs.map((_, i): Marca => (tem(foras[i], c) ? 'fora' : tem(txts[i], c) ? 'sim' : 'nao')) }))
    .filter((l) => l.marcas.some((m) => m !== 'nao'))
  const cc = orcs.map(calc)
  const precos = orcs.map((o, i) => ({
    avista: cc[i].avista,
    parcelado: cc[i].parcelas && cc[i].parcela ? `${cc[i].parcelas}x de ${Math.round(cc[i].parcela!).toLocaleString('pt-BR')}${o.juros === false ? ' sem juros' : o.juros ? ' com juros' : ''}` : '',
    m2: cc[i].m2,
    area: cc[i].area,
    total: cc[i].total,
  }))
  // o que os outros têm e este não fala
  const faltas = orcs.map((_, i) => escopo.filter((l) => l.marcas[i] !== 'sim' && l.marcas.some((m, j) => j !== i && m === 'sim')).map((l) => (l.marcas[i] === 'fora' ? `${l.l} (não inclui)` : l.l)))
  // custos que podem aparecer: o que fica de fora + conceitos "extra" que não aparecem + alertas do próprio orçamento
  const extras = orcs.map((o, i) => {
    const out = new Set<string>()
    ;(o.nao_inclui || []).forEach((x) => out.add(x))
    escopo.filter((l) => l.extra && l.marcas[i] !== 'sim').forEach((l) => out.add(`${l.l}: confirme se está incluso`))
    ;(o.alertas || []).forEach((x) => out.add(x))
    if (/(so|somente|apenas)\s+(o\s+)?material/.test(txts[i]) || (escopo.find((l) => l.id === 'mao')?.marcas[i] === 'fora')) out.add('Só material: some a mão de obra antes de comparar')
    return [...out].slice(0, 8)
  })
  // divergências entre os orçamentos
  const divergencias: string[] = []
  const areas = precos.map((p) => p.area).filter((a): a is number => !!a)
  if (areas.length >= 2 && Math.max(...areas) / Math.min(...areas) > 1.08)
    divergencias.push(`As áreas orçadas são diferentes (${[...new Set(areas)].map((a) => `${String(a).replace('.', ',')} m²`).join(' x ')}). Compare pelo preço por m² ou peça para todos medirem igual.`)
  const esp = orcs.map((o) => (sem([...(o.materiais || []), o.servico, ...(o.itens || []).map((i) => i.descricao)].join(' ')).match(/(\d+(?:[.,]\d+)?)\s?mm/) || [])[1]).filter(Boolean)
  if (new Set(esp).size > 1) divergencias.push(`As espessuras citadas não são iguais (${[...new Set(esp)].map((e) => `${e} mm`).join(', ')}): material mais fino costuma ser mais barato.`)
  const soMat = orcs.filter((_, i) => /(so|somente|apenas)\s+(o\s+)?material/.test(txts[i]) || escopo.find((l) => l.id === 'mao')?.marcas[i] === 'fora')
  if (soMat.length && soMat.length < orcs.length) divergencias.push(`${soMat.map((o) => o.fornecedor).join(', ')} ${soMat.length > 1 ? 'são' : 'é'} só material; os outros incluem a instalação.`)
  // mesmos itens com quantidades diferentes
  const qtds = new Map<string, { q: number; u: string; f: string }[]>()
  orcs.forEach((o) => (o.itens || []).forEach((it) => {
    if (it.qtd == null) return
    const k = sem(it.descricao).replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 2).join(' ')
    if (!k) return
    qtds.set(k, [...(qtds.get(k) || []), { q: it.qtd, u: it.unidade, f: o.fornecedor }])
  }))
  for (const [k, l] of qtds) {
    const fs = new Set(l.map((x) => x.f))
    if (fs.size < 2) continue
    const qs = l.map((x) => x.q)
    if (Math.max(...qs) / Math.max(0.01, Math.min(...qs)) > 1.1) divergencias.push(`Quantidades diferentes para "${k}": ${l.map((x) => `${x.f} ${String(x.q).replace('.', ',')}${x.u ? ` ${x.u}` : ''}`).join(' · ')}.`)
  }
  const prazos = orcs.map((o) => o.prazo).filter(Boolean)
  const garantias = orcs.map((o) => o.garantia)
  const semGar = [...new Set(orcs.filter((o) => !o.garantia).map((o) => o.fornecedor))]
  if (garantias.some(Boolean) && semGar.length) divergencias.push(`Nem todos informam garantia: ${semGar.join(', ')} não ${semGar.length > 1 ? 'falam' : 'fala'} nada.`)
  const mats = [...new Set(orcs.map((o) => (o.materiais || [])[0]).filter(Boolean))]
  if (mats.length > 1) divergencias.push(`Os materiais são diferentes (${mats.join(', ')}): o menor preço pode ser só por causa do material. Compare o mesmo material entre os fornecedores.`)
  // informações que faltam pedir
  const pendentes = orcs.map((o, i) => {
    const p: string[] = []
    if (cc[i].avista == null) p.push('valor')
    if (!o.prazo) p.push('prazo')
    if (!o.garantia) p.push('garantia')
    if (!o.validade) p.push('validade do orçamento')
    if (!o.pagamento && !cc[i].parcelas) p.push('forma de pagamento')
    if (!(o.materiais || []).length && !['mao-de-obra', 'outros'].includes(o.nicho)) p.push('marca e especificação do material')
    if (!o.whatsapp && !o.telefone && !o.email) p.push('contato')
    return p
  })
  // destaques: cada um tem o seu ponto forte
  const destaques: Comparacao['destaques'] = []
  const minIdx = (vals: (number | null)[]) => {
    let b = -1
    vals.forEach((v, i) => v != null && (b < 0 || v < (vals[b] as number)) && (b = i))
    return b
  }
  const usarM2 = precos.filter((p) => p.m2 != null).length === orcs.length && areas.length >= 2
  const bi = minIdx(usarM2 ? precos.map((p) => p.m2) : precos.map((p) => p.avista))
  if (bi >= 0) destaques.push({ l: 'menor preço', i: bi, porque: usarM2 ? 'por m², à vista' : 'à vista' })
  const scope = orcs.map((_, i) => escopo.filter((l) => l.marcas[i] === 'sim').length)
  const si = scope.indexOf(Math.max(...scope))
  if (si >= 0 && scope.filter((x) => x === scope[si]).length === 1) destaques.push({ l: 'mais completo', i: si, porque: `${scope[si]} itens de escopo` })
  const anos = garantias.map((g) => {
    const t = sem(g || '')
    const m = t.match(/(\d+)\s*(ano|mes)/)
    return m ? Number(m[1]) * (m[2] === 'ano' ? 12 : 1) : null
  })
  const gi = anos.reduce<number>((b, v, i) => (v != null && (b < 0 || v > (anos[b] as number)) ? i : b), -1)
  if (gi >= 0 && anos.filter((x) => x === anos[gi]).length === 1) destaques.push({ l: 'maior garantia', i: gi, porque: garantias[gi] })
  const dias = orcs.map((o) => {
    const t = sem(o.prazo || '')
    const m = t.match(/(\d+)\s*(dia|semana|mes)/)
    return m ? Number(m[1]) * (m[2] === 'semana' ? 7 : m[2] === 'mes' ? 30 : 1) : null
  })
  const pi = minIdx(dias)
  if (prazos.length >= 2 && pi >= 0 && dias.filter((x) => x === dias[pi]).length === 1) destaques.push({ l: 'menor prazo', i: pi, porque: orcs[pi].prazo })
  return { orcs, precos, escopo, faltas, divergencias, extras, destaques, pendentes }
}

const MINUSC_NOME = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'em'])
/* ===== leitura sem IA: tira o que dá do texto do PDF (contatos, valores, fornecedor) ===== */
export function lerTexto(txt: string): Partial<Orcamento> & { itens?: Orcamento['itens'] } {
  // sem emoji e sem *negrito*/_itálico_ do WhatsApp: não atrapalham nome nem valores
  const t = txt.replace(/\r/g, '').replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3]/gu, ' ').replace(/(^|\s)[*_~]+|[*_~]+(?=\s|$)/gm, '$1')
  const linhas = t.split('\n').map((l) => l.trim()).filter(Boolean)
  const out: Partial<Orcamento> = {}
  const email = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/)
  if (email) out.email = email[0]
  const tels = [...t.matchAll(/(?:\+?55\s?)?\(?\d{2}\)?\s?(?:9\s?)?\d{4}[-\s.]?\d{4}/g)].map((m) => digits(m[0])).filter((d) => d.length >= 10 && d.length <= 13)
  const cel = tels.find((d) => d.replace(/^55/, '').length === 11)
  if (cel) out.whatsapp = cel.replace(/^55/, '')
  if (tels[0]) out.telefone = tels[0].replace(/^55/, '')
  const cnpj = t.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
  if (cnpj) out.cnpj = digits(cnpj[0])
  const ig = t.match(/@([a-z0-9_.]{3,30})(?![\w.]*\.(com|br))/i)
  if (ig && !email?.[0].includes(ig[0])) out.instagram = '@' + ig[1]
  // link do Instagram ou site da empresa
  const igUrl = t.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-z0-9_.]{2,30})/i)
  if (igUrl) out.instagram = '@' + igUrl[1].replace(/\.$/, '')
  if (!out.instagram) {
    const site = t.match(/\b(?:https?:\/\/)?(?:www\.)[a-z0-9-]+(?:\.[a-z]{2,})+(?:\/\S*)?|https?:\/\/(?!wa\.me|api\.whatsapp|maps\.)[a-z0-9-]+(?:\.[a-z]{2,})+(?:\/\S*)?/i)
    if (site) out.instagram = /^https?:/i.test(site[0]) ? site[0] : 'https://' + site[0]
  }
  // fornecedor: linha com LTDA/ME/EIRELI, o que vem depois do rótulo "Empresa", ou a primeira linha de título (sem endereço nem rótulos)
  const ruim = /\b(cep|cnpj|cpf|avenida|av\.|rua|bairro|endere[cç]o|empresa|cliente|data|telefone|assinatura|total|observa[cç][oõ]es|garantia|prazo|validade|instru[cç][oõ]es|or[cç]amento|proposta|cria[cç][aã]o|atualiza[cç][aã]o|quant|produto|material|valor|bom dia|boa tarde|boa noite|ol[aá]|oi|segue|seguem|prezad[oa]s?|lembrando|formas?|pagamento|somente|instalad[oa]|setor)\b/i
  const emp = linhas.find((l) => /\b(ltda|eireli|\bme\b|mei|s\/a|marmoraria|marcenaria|pisos|vidra[cç]aria|gesso|serralheria|superf[ií]cies|m[oó]veis|planejados|aquecedores|aquecedor a g[aá]s|instala[cç][oõ]es|com[eé]rcio|distribuidora|materiais)\b/i.test(l) && l.length < 80 && !/\d+,\d{2}/.test(l))
  const iEmp = linhas.findIndex((l) => /\bempresa\b/i.test(l))
  const depoisEmp = iEmp >= 0 ? (linhas[iEmp + 1] || '').split(/\s{2,}/).pop() : ''
  const EMPRESA = /\b(ltda|eireli|me|mei|s\/a|engenharia|arquitetura|construtora|reformas|representa[cç][oõ]es|servi[cç]os|marmoraria|m[aá]rmores?|marcenaria|pisos|vidra[cç]aria|gesso|serralheria|superf[ií]cies|m[oó]veis|planejados|aquecedores|instala[cç][aã]o|montagem|com[eé]rcio|distribuidora|materiais)\b/i
  // "Rei do Marmore Instalação e Montagem Ltda (1)   Página: 1" → só o pedaço com cara de empresa
  const limpaNome = (x: string) => { const ps = x.split(/\s{2,}/).map((p) => p.replace(/\(\d+\)\s*$/, '').trim()).filter((p) => p && !/^\d+$/.test(p) && !/^p[aá]gina\b/i.test(p)); return (ps.find((p) => EMPRESA.test(p)) || ps.filter((p) => !ruim.test(p)).pop() || '').trim() }
  // a linha do CNPJ costuma trazer o nome da empresa antes dele ("RDL Engenharia · CNPJ ...")
  // só vale se a linha tiver um CNPJ de verdade (formulário com campo vazio "CNPJ/CPF: . . / -" não conta)
  const doCnpj = (linhas.find((l) => /cnpj/i.test(l) && /\d{2}\.?\d{3}\.?\d{3}/.test(l)) || '').split(/\s*[·•|\-–]\s*cnpj|\s+cnpj/i)[0].replace(/^(raz[aã]o social|empresa)\s*:?\s*/i, '').trim()
  const assinatura = linhas.find((l) => /\b(engenharia|arquitetura|construtora|reformas|representa[cç][oõ]es|servi[cç]os|ltda|eireli)\b/i.test(l) && !/cnpj|cpf|endere[cç]o/i.test(l) && l.length < 90 && !/\d+,\d{2}/.test(l) && !/cnpj/i.test(l))
  // último recurso: linha com cara de nome (palavras com inicial maiúscula, curta, sem lista/valor/frase).
  // Em mensagem o nome costuma vir assinando no fim; em documento, no topo.
  const nomeDeLinha = () => {
    const ok = (l: string) => {
      if (l.length < 3 || l.length > 45 || !/^[A-ZÀ-Ú]/.test(l) || /\d|R\$|@|[!?:;()]|\.$/.test(l) || ruim.test(l)) return false
      if (/\b(aproveite\w*|promo\w*|valores?|inclui\w*|incluso|lembrando|pagamentos?|confira|oferta|an[aá]lise|vistoria\s+(completa|t[eé]cnica)|laudo|relat[oó]rio|contrato|emiss[aã]o|segue|obrigad[oa])\b/i.test(l)) return false
      const ws = l.split(/\s+/)
      return ws.length <= 5 && ws.every((w) => MINUSC_NOME.has(w.toLowerCase()) || /^[A-ZÀ-Ú0-9]/.test(w) || /^[A-Z]\.?$/.test(w))
    }
    const cands = linhas.filter(ok)
    return (/cnpj|proposta|or[cç]amento\s+n/i.test(t) ? cands[0] : cands[cands.length - 1]) || ''
  }
  // mensagem de WhatsApp: o nome vem na despedida ("Grato, L. S Marmoraria", "Att.\nVidraçaria Luz")
  const iDesp = linhas.findIndex((l) => /^(grat[oa]|obrigad[oa]|att\.?|atenciosamente|abra[cç]os?|at\.?te|cordialmente)\b/i.test(l))
  const desp = iDesp >= 0 ? (linhas[iDesp].replace(/^(grat[oa]|obrigad[oa]|att\.?|atenciosamente|abra[cç]os?|at\.?te|cordialmente)[\s,.:!-]*/i, '').trim() || linhas[iDesp + 1] || '') : ''
  const despOk = desp.length >= 3 && desp.length < 60 && !/\d{4}|@|R\$/.test(desp) ? desp : ''
  out.fornecedor = ((doCnpj.length >= 3 && doCnpj.length < 70 && !/\d{2}\.\d{3}/.test(doCnpj) ? doCnpj : '') || despOk || limpaNome(assinatura || '') || limpaNome(emp || '') || (depoisEmp && !ruim.test(depoisEmp) ? depoisEmp.trim() : '') || nomeDeLinha()|| '').replace(/\S+@\S+/g, ' ').replace(/@[\w.]+/g, ' ').replace(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/\S*/gi, ' ').replace(/(?:\+?55\s?)?\(?\d{2}\)?\s?9?\s?\d{4}[-\s.]?\d{4}/g, ' ').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s·•|,;:\-–]+|[\s·•|,;:\-–]+$/g, '')
  // valores: total (com R$), à vista / Pix, parcelas
  // normaliza "$16.470.00" / "16,470.00" (centavos depois do ponto) para "R$ 16.470,00"; "$" sozinho vira "R$"
  const tv = t.replace(/(\d{1,3}(?:[.,]\d{3})+)\.(\d{2})(?!\d)/g, (_, a: string, c: string) => `${a.replace(/,/g, '.')},${c}`).replace(/(^|[^R\w])\$\s*(?=\d)/g, '$1R$ ')
  const valor = (re: RegExp) => {
    const m = tv.match(re)
    // "11.500" sem vírgula é onze mil e quinhentos (ponto de milhar), não 11,5
    return m ? num(/^\d{1,3}(?:\.\d{3})+$/.test(m[1]) ? m[1].replace(/\./g, '') : m[1]) : null
  }
  // o preço aparece de muitos jeitos: "R$ 3.500,00", "R$3.500", "R $ 3500,00", "3.500,00" sem R$, "3,5 mil"
  const DIN = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{2}|\d{3,})`
  out.valor_total = valor(new RegExp(String.raw`(?:valor\s+)?total(?:\s+(?:geral|final|do\s+or[cç]amento|a\s+pagar))?[^\d\n]{0,40}?\n?[^\d\n]{0,12}?(?:R\s?\$\s*)?` + DIN, 'i'))
  // tabela de sistema: cabeçalho "Liquido  Frete  Total" e os números na linha de baixo (o último é o total)
  if (out.valor_total == null) {
    const iT = linhas.findIndex((l) => /\btotal\s*$/i.test(l) && /\s{2,}/.test(l))
    const nums = iT >= 0 ? (linhas[iT + 1] || '').match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) : null
    if (nums) out.valor_total = num(nums[nums.length - 1].replace(/\./g, ''))
  }
  // "1.800 a vista" (número antes) vale mais que "à vista ... 2.000" (que pode ser o preço do cartão)
  out.valor_avista = valor(new RegExp(String.raw`(?:R\s?\$\s*)?` + DIN + String.raw`[ \t]*(?:reais[ \t]*)?(?:[aà][ \t]+vista|no[ \t]+pix)`, 'i'))
  if (out.valor_avista == null) out.valor_avista = valor(new RegExp(String.raw`(?:[aà]\s+vista|pix|dinheiro)[^\d\n]{0,40}?(?:R\s?\$\s*)?` + DIN, 'i'))
  if (out.valor_total == null) out.valor_total = valor(new RegExp(String.raw`(?:R\s?\$\s*)?` + DIN + String.raw`[ \t]*(?:reais[ \t]*)?(?:no[ \t]+cart[aã]o|a[ \t]+prazo|parcelado)`, 'i'))
  if (out.valor_total == null) {
    const mil = t.match(/(\d+(?:,\d+)?)\s*mil\b/i)
    // sem "total" escrito: o maior valor em reais do texto costuma ser o total
    const todos = [...tv.matchAll(/R\s?\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/gi)].map((m) => num(/^\d{1,3}(?:\.\d{3})+$/.test(m[1]) ? m[1].replace(/\./g, '') : m[1]) || 0).filter((v) => v >= 50)
    if (todos.length) out.valor_total = Math.max(...todos)
    else if (mil) out.valor_total = (num(mil[1]) || 0) * 1000 || null
  }
  const parc = t.match(/(\d{1,2})\s*x\s*(?:de\s*)?R?\$?\s*([\d.]+,\d{2})/i)
  if (parc) {
    out.parcelas_max = Number(parc[1])
    out.valor_parcela = num(parc[2])
  }
  const area = t.match(/([\d.,]+)\s*m(?:2|²)/i)
  // área de verdade (piso, pintura...): 3 a 500 m²; "1 M2" de coluna de sistema não conta
  if (area) { const a = num(area[1]); if (a != null && a >= 3 && a <= 500) out.area_m2 = a }
  const prazo = t.match(/prazo[^\n]{0,40}?(\d+\s*(?:a\s*\d+\s*)?dias(?:\s*[uú]teis)?)/i)
  if (prazo) out.prazo = prazo[1].trim().toLowerCase()
  const gar = t.match(/garantia[ \t]*(?:de|:)?[ \t]*([^\n;]{3,70})/i)
  if (gar) out.garantia = gar[1].trim().toLowerCase()
  const gar2 = t.match(/(\d+\s*(?:anos?|mes(?:es)?|meses|dias))\s+de\s+garantia/i)
  if (gar2 && (!out.garantia || out.garantia.length < 3)) out.garantia = gar2[1].toLowerCase()
  const dataOrc = t.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  const dias = t.match(/(?:validade[^\d\n]{0,20}|v[áa]lid[oa]\s+por\s+)(\d{1,3})\s*dias/i)
  if (dias) {
    const d = dataOrc ? new Date(`${dataOrc[3]}-${dataOrc[2]}-${dataOrc[1]}T00:00:00`) : new Date()
    d.setDate(d.getDate() + Number(dias[1]))
    out.validade = d.toISOString().slice(0, 10)
  }
  const naoInc = [...t.matchAll(/([^\n.,;]{3,60}?)\s+n[aã]o\s+est[aã]o?\s+inclus[oa]s?/gi)].map((m) => `${m[1].trim()} (não incluso)`)
  if (naoInc.length) out.nao_inclui = naoInc
  // opções de material com total próprio: "Total em Quartzo branco R$ 5.190,00" (e o Pix de cada uma, se tiver)
  const ops = [...t.matchAll(/total\s+em\s+([^\n]+?)\s+R\$\s*([\d.]+,\d{2})/gi)].filter((m) => !/desconto|pix/i.test(m[1]))
  if (ops.length > 1) {
    ;(out as Record<string, unknown>).opcoes = ops.map((m) => {
      const nome = m[1].trim()
      const pix = t.match(new RegExp(`total\\s+em\\s+${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+com\\s+desconto[^\\n]*?R\\$\\s*([\\d.]+,\\d{2})`, 'i'))
      return { nome, valor_total: num(m[2]), valor_avista: pix ? num(pix[1]) : null }
    })
    out.valor_total = num(ops[0][2])
  }
  // condições: desconto à vista em %, parcelas e juros, o que está incluso
  const pct = t.match(/(\d{1,2})\s*%\s*(?:de\s+)?desconto|desconto[^\n%]{0,50}?(\d{1,2})\s*%/i)
  if (pct) out.desconto_avista_pct = Number(pct[1] || pct[2])
  const ate = t.match(/at[ée]\s*(\d{1,2})\s*(?:x|vezes)/i)
  if (ate && !out.parcelas_max) out.parcelas_max = Number(ate[1])
  if (/sem\s+juros/i.test(t)) out.juros = false
  const inc: string[] = []
  if (/inclu\w*[^.\n]{0,60}material|material[^.\n]{0,40}inclu/i.test(t)) inc.push('material')
  if (/m[ãa]o\s+de\s+obra/i.test(t) && /inclu/i.test(t)) inc.push('mão de obra')
  if (/instala[çc][ãa]o/i.test(t) && /inclu/i.test(t)) inc.push('instalação')
  if (inc.length) out.inclui = [...new Set([...(out.inclui || []), ...inc])]
  // várias opções numa mensagem (WhatsApp): "1ª opção: ... Preço: R$ 2.980,00" ou "Rinnai 15 litros - 2.400,00"
  if (!(out as Record<string, unknown>).opcoes) {
    const dinheiro = (x: string) => num(/^\d{1,3}(?:\.\d{3})+$/.test(x) ? x.replace(/\./g, '') : x)
    const blocos = t.split(/(?=\b\d{1,2}\s*[ªaº°]?\s*op[çc][ãa]o\b)/i).filter((b) => /^\d{1,2}\s*[ªaº°]?\s*op[çc][ãa]o/i.test(b))
    let lista: { nome: string; valor_total: number | null }[] = []
    if (blocos.length > 1) {
      lista = blocos.map((b) => {
        const marca = b.match(/marca\s+([\wÀ-ú/]+)/i)?.[1]
        const modelo = b.match(/modelo\s+([\w-]+)/i)?.[1]
        const titulo = b.replace(/^\d{1,2}\s*[ªaº°]?\s*op[çc][ãa]o\s*:?\s*/i, '').split(/[\n,.]/)[0].trim()
        const preco = b.match(/R\s?\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?)/i)?.[1]
        const nome = marca && modelo ? `${marca} ${modelo}` : marca && !titulo.toLowerCase().includes(marca.toLowerCase()) ? marca : titulo
        return { nome: nome.slice(0, 60), valor_total: preco ? dinheiro(preco) : null }
      })
    } else if (linhas.filter((l) => /\d[\d.,]*\s*(?:reais\s*)?(?:[aà]\s+vista|no\s+pix)/i.test(l)).length > 1) {
      // promoção com várias pedras: "Preto São Gabriel ) 3.900 a vista ou 4.600 no cartão"
      const NUM = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{3,}(?:,\d{2})?)`
      const re = new RegExp(String.raw`^(.{3,60}?)\s*[)\-–:=]+\s*(?:R\s?\$\s*)?` + NUM + String.raw`\s*(?:reais\s*)?(?:[aà]\s+vista|no\s+pix)(?:.*?(?:R\s?\$\s*)?` + NUM + String.raw`\s*(?:reais\s*)?(?:no\s+cart|cart[aã]o|parcelad|a\s+prazo))?`, 'i')
      const ops2 = linhas.map((l) => l.match(re)).filter((m): m is RegExpMatchArray => !!m)
      if (ops2.length > 1) {
        const o2 = ops2.map((m) => ({ nome: m[1].replace(/[()]/g, '').trim(), valor_avista: dinheiro(m[2]), valor_total: m[3] ? dinheiro(m[3]) : dinheiro(m[2]) }))
        ;(out as Record<string, unknown>).opcoes = o2
        // o card mostra a opção mais barata; as outras aparecem como materiais e no resumo
        const min = o2.reduce((a, b) => ((b.valor_avista || 1e12) < (a.valor_avista || 1e12) ? b : a))
        out.valor_avista = min.valor_avista
        out.valor_total = min.valor_total
        out.materiais = o2.map((x) => x.nome)
        out.resumo = o2.map((x) => `${x.nome}: R$ ${x.valor_avista?.toLocaleString('pt-BR')} à vista${x.valor_total && x.valor_total !== x.valor_avista ? ` ou R$ ${x.valor_total.toLocaleString('pt-BR')} no cartão` : ''}`).join(' · ')
        lista = []
      }
    } else {
      lista = linhas
        .map((l) => l.match(/^(.{3,60}?)\s*[-–:]\s*(?:R\s?\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{3,}(?:,\d{2})?)\s*$/i))
        .filter((m): m is RegExpMatchArray => !!m && !/total|parcela|entrada|sinal/i.test(m[1]))
        .map((m) => ({ nome: m[1].replace(/\s*\(.*?\)\s*/g, ' ').trim(), valor_total: dinheiro(m[2]) }))
    }
    lista = lista.filter((x) => x.valor_total && x.valor_total >= 50)
    if (lista.length > 1) {
      const d = out.desconto_avista_pct || 0
      ;(out as Record<string, unknown>).opcoes = lista.map((x) => ({ ...x, valor_avista: d ? Math.round(x.valor_total! * (1 - d / 100) * 100) / 100 : null }))
      out.valor_total = lista[0].valor_total
      out.valor_avista = d ? Math.round(lista[0].valor_total! * (1 - d / 100) * 100) / 100 : out.valor_avista
    }
  }
  // itens: linhas com valor no fim
  out.itens = linhas
    .map((l) => l.match(/^(.{4,90}?)\s+(?:(\d+(?:[.,]\d+)?)\s*(m²|m2|un|und|ml|pç|pc|vb|cx)\s+)?.*?R?\$\s*([\d.]+,\d{2})$/i))
    .filter((m): m is RegExpMatchArray => !!m && !/total|subtotal|desconto|parcela/i.test(m[1]))
    .slice(0, 40)
    .map((m) => ({ descricao: m[1].trim(), qtd: m[2] ? num(m[2]) : null, unidade: m[3] || '', valor: num(m[4]) }))
  return out
}

/** Nicho pelo texto (quando não deu para ler com IA). */
export function nichoDoTexto(txt: string): Nicho | '' {
  const t = sem(txt)
  // pontua cada pasta pelo número de palavras dela no texto (a 1ª linha / nome do arquivo vale o triplo);
  // assim "forros" num rodapé de vistoria não vira gesso
  const regras: [Nicho, RegExp][] = [
    ['vistoria', /vistoria|laudo|\bart\b|entrega (de|das) chaves|revistoria/g],
    ['piso-vinilico', /vinilic/g], ['piso-laminado', /laminad/g], ['piso-ceramico', /porcelanato|ceramic/g], ['revestimentos', /revestimento|pastilha|azulejo/g],
    ['marcenaria', /marcenaria|planejad|mdf|armario/g], ['marmoraria', /granito|marmore|quartzo|bancada|marmoraria/g], ['box', /\bbox\b/g],
    ['gesso', /gesso|drywall|sanca|forro/g], ['eletrica', /eletric|tomada|disjuntor/g], ['aquecedor', /aquecedor|boiler/g], ['hidraulica', /hidraulic|encanamento|esgoto|pressurizador/g],
    ['impermeabilizacao', /impermeabiliz/g], ['serralheria', /serralheri|grade|portao|corrimao/g], ['ar', /ar.condicionado|split|btu/g],
    ['pintura', /pintura|tinta|massa corrida/g], ['cortinas', /cortina|persiana/g], ['telas', /tela de protecao|rede de protecao/g],
    ['vidros', /vidro|espelho|vidracaria/g], ['iluminacao', /luminaria|spot|pendente|iluminacao/g],
  ]
  const topo = t.split('\n').slice(0, 3).join(' ')
  let melhor: Nicho | '' = '', pts = 0
  for (const [n, re] of regras) {
    const p = (t.match(re) || []).length + 2 * (topo.match(re) || []).length
    if (p > pts) { pts = p; melhor = n }
  }
  return melhor
}

/** O que ainda falta preencher para o orçamento entrar bem na comparação (a pessoa só completa isso). */
export function faltando(o: Partial<Orcamento>): ('fornecedor' | 'nicho' | 'valor' | 'contato')[] {
  const f: ('fornecedor' | 'nicho' | 'valor' | 'contato')[] = []
  if (!String(o.fornecedor || '').trim()) f.push('fornecedor')
  if (!o.nicho || o.nicho === 'outros') f.push('nicho')
  if (o.tipo === 'contato') {
    if (!digits(o.whatsapp).length && !digits(o.telefone).length && !String(o.instagram || '').trim() && !String(o.email || '').trim()) f.push('contato')
  } else if (o.tipo !== 'tabela' && num(o.valor_total) == null && num(o.valor_avista) == null) f.push('valor')
  return f
}
