import { PLANS, PLATFORM, TRIAL_DAYS } from './plans'

/* Conteúdo que a dona edita no painel (sem mexer no código):
   a seção "quem criou" da página de vendas, os contatos do rodapé e os termos de uso. */

export interface SiteContent {
  photo: string // foto da dona (data URL, já reduzida)
  name: string
  title: string // título da seção ("oi, eu sou a Laís")
  text: string // parágrafos separados por linha em branco
  facts: string[] // etiquetas curtas (ex.: "estudante de arquitetura")
  signature: string
  instagram: string // @ da plataforma (rodapé)
  whatsapp: string
  email: string
  about: string // frase do rodapé
  // página de vendas (topo, seções e dúvidas)
  banner: string // faixa de aviso no alto (ex.: promoção de lançamento); vazio = não aparece
  kicker: string // etiqueta acima do título
  heroTitle: string // começo do título ("seu estúdio,")
  heroWords: string // palavras que giram no título, separadas por vírgula
  lead: string // frase embaixo do título
  hidden: string[] // seções escondidas: jornada, telas, para, depoimentos, duvidas
  faqExtra: string // perguntas a mais: pergunta na 1ª linha, resposta embaixo; blocos separados por linha em branco
}

export const DEFAULT_SITE: SiteContent = {
  photo: '',
  name: PLATFORM.owner,
  title: `oi, eu sou a ${PLATFORM.owner}`,
  text: `Sou estudante de arquitetura e trabalho como freelancer com renderização, modelagem e detalhamento. Com os clientes chegando, tudo foi ficando espalhado: orçamento numa planilha, prazo no bloco de notas, pagamento na memória, contrato em outro arquivo e a agenda da faculdade no meio disso tudo.

Procurei um sistema pensado para o freelancer e não encontrei. Então criei o meu, do jeito que a rotina pede. Deu tão certo que resolvi abrir para outros freelancers, com uma assinatura que cabe no bolso de quem está começando.`,
  facts: ['estudante de arquitetura', 'freelancer em visualização 3D', `criadora do ${PLATFORM.name}`],
  signature: `${PLATFORM.owner} · criadora do ${PLATFORM.name}`,
  instagram: '@sou.plane',
  whatsapp: '',
  email: 'equipe.plane@gmail.com',
  about: 'o sistema de gestão para quem vive de projeto: arquitetos, designers de interiores, escritórios e freelancers de 3D.',
  banner: '',
  kicker: 'para arquitetos, designers, escritórios e freelancers de projeto',
  heroTitle: 'seu estúdio,',
  heroWords: 'organizado, mais leve, no seu ritmo, lucrativo',
  lead: 'Clientes, orçamentos, propostas, contratos, prazos e financeiro num lugar só. Do primeiro “oi” à entrega.',
  hidden: [],
  faqExtra: '',
}
/** Seções da página de vendas que a dona pode esconder. */
export const LP_SECTIONS: [string, string][] = [
  ['jornada', 'como funciona'],
  ['telas', 'telas de verdade'],
  ['para', 'feito para quem…'],
  ['depoimentos', 'depoimentos'],
  ['duvidas', 'perguntas frequentes'],
]
/** Perguntas a mais escritas pela dona (pergunta na 1ª linha, resposta nas seguintes). */
export const extraFaq = (text: string): [string, string][] =>
  (text || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim().split('\n'))
    .filter((l) => l[0]?.trim() && l.slice(1).join(' ').trim())
    .map((l) => [l[0].trim(), l.slice(1).join(' ').trim()])

/** Termos de uso + contrato de assinatura (a dona revisa e edita no painel). */
export const DEFAULT_TERMS = `TERMOS DE USO E CONTRATO DE ASSINATURA — ${PLATFORM.name.toUpperCase()}

Ao criar uma conta ou assinar um plano, você (USUÁRIO) concorda com estes termos. Leia com atenção.

PARTES
PLATAFORMA: {empresa_nome}, {empresa_doc}, e-mail {empresa_email}, {empresa_cidade}.
USUÁRIO: {assinante_nome}, {assinante_doc}, e-mail {assinante_email}.
Plano: {plano}. Data: {data}.

1. QUEM SOMOS
O ${PLATFORM.name} é uma plataforma on-line de gestão para profissionais de projeto (arquitetura, design de interiores e visualização 3D), oferecida por {empresa_nome}, {empresa_doc}, contato: {empresa_email} (PLATAFORMA).

2. O QUE A PLATAFORMA OFERECE
2.1 Ferramentas para organizar clientes, demandas, prazos, orçamentos, propostas, contratos, recibos, agenda e financeiro, conforme o plano escolhido.
2.2 Os modelos de contrato, proposta e mensagens são referências. O USUÁRIO é responsável por revisar o conteúdo, inclusive com apoio jurídico, antes de usar com os próprios clientes.

3. CADASTRO
3.1 O USUÁRIO informa dados verdadeiros e mantém o cadastro atualizado.
3.2 Login e senha são pessoais. O USUÁRIO é responsável pelo uso da própria conta.
3.3 Cada conta é de uma pessoa (uso individual do assinante).

4. TESTE GRÁTIS
4.1 Todo cadastro novo recebe {dias_teste} dias grátis com o plano escolhido, sem cartão e sem cobrança.
4.2 Ao fim do teste, para continuar usando, o USUÁRIO escolhe e assina um plano. Sem assinatura, a conta fica pausada: os dados continuam guardados e podem ser baixados.

5. PLANOS, VALORES E PAGAMENTO
5.1 Os valores e o que cada plano inclui estão na página de planos no momento da assinatura.
5.2 Formas de assinatura, sempre pagas antecipadamente:
a) Mensal: Pix todo mês ou cartão de crédito cobrado automaticamente todo mês (recorrente).
b) Semestral: 6 meses com desconto, pagos à vista no Pix ou no cartão de crédito em até 6 parcelas sem juros. O valor no cartão inclui a taxa do parcelamento e é mostrado antes da confirmação.
c) Anual: 12 meses com meses grátis (desconto), pagos à vista no Pix ou no cartão de crédito em até 12 parcelas sem juros. O valor no cartão inclui a taxa do parcelamento e é mostrado antes da confirmação.
5.3 O desconto e os meses grátis do semestral e do anual são uma condição do período completo contratado: não são um período de uso gratuito separado, não viram crédito e não são devolvidos em dinheiro.
5.4 No semestral e no anual parcelados no cartão, a compra é única (o plano de 6 ou 12 meses) e é dividida pela operadora do cartão. Cancelar a assinatura não interrompe as parcelas já contratadas; eventual devolução segue as regras dos itens 6 e 7.
5.5 Contestação de pagamento junto ao banco ou à operadora do cartão (chargeback) por serviço efetivamente disponibilizado pausa a conta até a regularização, sem prejuízo da cobrança do valor devido.
5.6 Mudanças de preço são avisadas com antecedência mínima de 30 dias e valem a partir do período seguinte. O período já pago não muda de preço.
5.7 Preço de fundador: os primeiros assinantes, enquanto a oferta estiver aberta na página de planos, mantêm o valor contratado mesmo com reajustes futuros da tabela, desde que a assinatura continue ativa sem interrupção e no mesmo plano. Se a assinatura for cancelada ou trocada de plano, vale o preço vigente na nova contratação.

6. DIREITO DE ARREPENDIMENTO (7 DIAS)
6.1 Conforme o art. 49 do Código de Defesa do Consumidor, o USUÁRIO pode desistir da assinatura em até 7 (sete) dias contados do primeiro pagamento, com devolução integral do valor pago, pelo mesmo meio de pagamento (no cartão, com o estorno da compra inteira).
6.2 O período de teste grátis não reduz esse prazo. Renovações e novas assinaturas depois de uma desistência não geram um novo prazo de 7 dias para o mesmo plano dentro de 12 meses.

7. CANCELAMENTO (DEPOIS DOS 7 DIAS)
7.1 Mensal: o USUÁRIO cancela quando quiser, sem multa. O acesso continua até o fim do mês já pago, sem devolução do mês em andamento.
7.2 Semestral e anual: o USUÁRIO pode cancelar a qualquer momento. O acesso continua até o fim do período contratado e a assinatura não é renovada.
7.3 Se, no semestral ou no anual, o USUÁRIO pedir o encerramento antecipado com devolução, o valor devolvido é: o valor pago, menos os meses já usados (contando o mês em andamento) pelo preço do plano mensal vigente na contratação, menos as taxas de pagamento e parcelamento já cobradas pela operadora. Se o resultado for zero ou negativo, não há devolução nem cobrança adicional. Assim, quem sai antes do fim paga os meses usados pelo preço do mensal, sem o desconto do período completo.
7.4 Exemplo: plano anual pago à vista por R$ 599 (mensal de R$ 59,90). Pedido de encerramento no 4º mês: 599 − 4 × 59,90 = R$ 359,40 devolvidos (menos taxas da operadora, se houver).
7.5 Em caso de atraso no pagamento, a conta pode ser pausada para edição até a regularização. Os dados não são apagados.
7.6 O uso em desacordo com estes termos (revenda, compartilhamento de acesso, fraude) permite o encerramento da conta sem devolução, após aviso.

8. DADOS E PRIVACIDADE (LGPD)
8.1 Coletamos os dados do cadastro e da assinatura (nome, e-mail, telefone, CPF/CNPJ, endereço) para criar a conta, cobrar e dar suporte.
8.2 Os dados que o USUÁRIO cadastra na plataforma (clientes, orçamentos, valores) pertencem ao USUÁRIO. A PLATAFORMA não vende nem compartilha esses dados, a não ser com os serviços necessários para funcionar (hospedagem e banco de dados) ou por obrigação legal.
8.3 Cada conta é isolada: nenhum outro usuário tem acesso aos dados do USUÁRIO.
8.4 O USUÁRIO pode pedir a qualquer momento acesso, correção, cópia ou exclusão dos seus dados pelo e-mail de contato.
8.5 Depois do cancelamento, os dados ficam guardados por até 90 dias para eventual retorno e depois são excluídos, salvo o que a lei obrigar a manter.

9. RESPONSABILIDADES
9.1 A PLATAFORMA se esforça para manter o serviço disponível e seguro, mas pode haver interrupções para manutenção ou por falhas de terceiros.
9.2 O USUÁRIO deve manter cópias de segurança (backup) dos seus dados. A plataforma oferece a exportação a qualquer momento.
9.3 A PLATAFORMA não se responsabiliza pelo conteúdo que o USUÁRIO cria nem pela relação dele com os próprios clientes.

10. PROPRIEDADE INTELECTUAL E PROIBIÇÃO DE CÓPIA
10.1 O sistema, o nome e a marca ${PLATFORM.name}, o símbolo, o visual das telas, os textos, os modelos de documentos, as funcionalidades, a organização das informações e o código pertencem à PLATAFORMA e são protegidos pela Lei de Direitos Autorais (Lei 9.610/98), pela Lei de Software (Lei 9.609/98) e pela Lei de Propriedade Industrial (Lei 9.279/96).
10.2 A assinatura dá ao USUÁRIO apenas o direito de usar a plataforma, de forma pessoal e não exclusiva, enquanto estiver ativa. Nenhum direito de propriedade é transferido.
10.3 É proibido, sem autorização por escrito: copiar, reproduzir, imitar ou adaptar o sistema, as telas, os fluxos, os modelos ou os textos, no todo ou em parte; usar a plataforma como referência para criar produto concorrente; fazer engenharia reversa, extrair dados de forma automatizada ou tentar acessar o código; revender, sublicenciar, alugar ou compartilhar o acesso.
10.4 O descumprimento permite o encerramento imediato da conta, sem devolução, além das medidas legais cabíveis, inclusive indenização por perdas e danos.
10.5 Os documentos que o USUÁRIO cria para os próprios clientes (propostas, contratos, recibos) podem ser usados livremente por ele; o crédito discreto “feito com ${PLATFORM.name}” faz parte do serviço.

11. ALTERAÇÕES DESTES TERMOS
Mudanças importantes são avisadas dentro da plataforma. Continuar usando depois do aviso significa concordar com a nova versão.

12. FORO
Fica eleito o foro da comarca de {empresa_cidade} para resolver qualquer questão sobre estes termos, ressalvado o direito do consumidor de propor a ação no próprio domicílio, quando a lei assim garantir.`

/** Reduz a foto enviada para no máximo 640 px (JPEG), para guardar leve. */
export function shrinkPhoto(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = reject
    img.src = url
  })
}

/** Dados da plataforma (de quem oferece) que preenchem os termos sozinhos. */
export interface Company {
  name: string
  doc: string
  email: string
  city: string
}
export const EMPTY_COMPANY: Company = { name: '', doc: '', email: '', city: '' }

/** Variáveis dos termos: {empresa_…} vêm do painel; {assinante_…} de quem está se cadastrando/assinando. */
export const TERMS_VARS: [string, string][] = [
  ['empresa_nome', 'seu nome completo ou razão social'],
  ['empresa_doc', 'seu CPF/CNPJ'],
  ['empresa_email', 'seu e-mail de contato'],
  ['empresa_cidade', 'sua cidade/UF (foro)'],
  ['assinante_nome', 'nome de quem assina'],
  ['assinante_doc', 'CPF/CNPJ de quem assina'],
  ['assinante_email', 'e-mail de quem assina'],
  ['plano', 'plano escolhido e valor'],
  ['dias_teste', 'dias de teste grátis'],
  ['data', 'data de hoje'],
]

export function fillTerms(text: string, company: Company, who: { name?: string; doc?: string; email?: string; plan?: string } = {}) {
  const later = '(informado na assinatura)'
  const vars: Record<string, string> = {
    empresa_nome: company.name.trim() || '[seu nome ou razão social]',
    empresa_doc: company.doc.trim() ? company.doc.trim() : '[seu CPF/CNPJ]',
    empresa_email: company.email.trim() || '[seu e-mail]',
    empresa_cidade: company.city.trim() || '[sua cidade/UF]',
    assinante_nome: who.name?.trim() || later,
    assinante_doc: who.doc?.trim() || later,
    assinante_email: who.email?.trim() || later,
    plano: who.plan || `teste grátis do plano ${PLANS.completo.name}`,
    dias_teste: String(TRIAL_DAYS),
    data: new Date().toLocaleDateString('pt-BR'),
  }
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
}

/** Textos antigos da página de vendas (focados em freelancer) que viram os novos, para todos os públicos.
 *  Só troca se a dona não tiver escrito outra coisa no painel. */
const OLD_TEXTS: Partial<Record<keyof SiteContent, string>> = {
  about: 'o sistema de gestão para freelancers de arquitetura, design de interiores e visualização 3D.',
  kicker: 'feito para freelancers criativos',
  heroTitle: 'sua vida de freelancer,',
  heroWords: 'organizada, mais leve, no seu ritmo, lucrativa',
  lead: 'Clientes, orçamentos, prazos e pagamentos num lugar só. Do primeiro “oi” ao recibo.',
}
export function freshSite(c: SiteContent): SiteContent {
  const out = { ...c }
  for (const [k, v] of Object.entries(OLD_TEXTS) as [keyof SiteContent, string][]) if (out[k] === v) (out as Record<string, unknown>)[k] = DEFAULT_SITE[k]
  // contato da marca planê: entra quando ainda não foi preenchido
  if (!out.instagram?.trim() || /traco/i.test(out.instagram)) out.instagram = DEFAULT_SITE.instagram
  if (!out.email?.trim() || /arq\.laisav|traco/i.test(out.email)) out.email = DEFAULT_SITE.email
  return out
}
