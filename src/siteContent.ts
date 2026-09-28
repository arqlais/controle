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
}

export const DEFAULT_SITE: SiteContent = {
  photo: '',
  name: PLATFORM.owner,
  title: `oi, eu sou a ${PLATFORM.owner}`,
  text: `Sou estudante de arquitetura e trabalho como freelancer com renderização, modelagem e detalhamento. Com os clientes chegando, tudo foi ficando espalhado: orçamento numa planilha, prazo no bloco de notas, pagamento na memória, contrato em outro arquivo e a agenda da faculdade no meio disso tudo.

Procurei um sistema pensado para o freelancer e não encontrei. Então criei o meu, do jeito que a rotina pede. Deu tão certo que resolvi abrir para outros freelancers, com uma assinatura que cabe no bolso de quem está começando.`,
  facts: ['estudante de arquitetura', 'freelancer em visualização 3D', `criadora do ${PLATFORM.name}`],
  signature: `${PLATFORM.owner} · criadora do ${PLATFORM.name}`,
  instagram: '',
  whatsapp: '',
  email: '',
  about: 'o sistema de gestão para freelancers de arquitetura, design de interiores e visualização 3D.',
}

/** Termos de uso + contrato de assinatura (a dona revisa e edita no painel). */
export const DEFAULT_TERMS = `TERMOS DE USO E CONTRATO DE ASSINATURA — ${PLATFORM.name.toUpperCase()}

Ao criar uma conta ou assinar um plano, você (USUÁRIO) concorda com estes termos. Leia com atenção.

PARTES
PLATAFORMA: {empresa_nome}, {empresa_doc}, e-mail {empresa_email}, {empresa_cidade}.
USUÁRIO: {assinante_nome}, {assinante_doc}, e-mail {assinante_email}.
Plano: {plano}. Data: {data}.

1. QUEM SOMOS
O ${PLATFORM.name} é uma plataforma on-line de gestão para freelancers, oferecida por {empresa_nome}, {empresa_doc}, contato: {empresa_email} (PLATAFORMA).

2. O QUE A PLATAFORMA OFERECE
2.1 Ferramentas para organizar clientes, demandas, prazos, orçamentos, propostas, contratos, recibos, agenda e financeiro, conforme o plano escolhido.
2.2 Os modelos de contrato, proposta e mensagens são referências. O USUÁRIO é responsável por revisar o conteúdo, inclusive com apoio jurídico, antes de usar com os próprios clientes.

3. CADASTRO
3.1 O USUÁRIO informa dados verdadeiros e mantém o cadastro atualizado.
3.2 Login e senha são pessoais. O USUÁRIO é responsável pelo uso da própria conta.
3.3 Cada conta é de uma pessoa (uso individual do freelancer).

4. TESTE GRÁTIS
4.1 Todo cadastro novo recebe {dias_teste} dias grátis com o plano Completo, sem cartão e sem cobrança.
4.2 Ao fim do teste, para continuar usando, o USUÁRIO escolhe e assina um plano. Sem assinatura, a conta fica pausada: os dados continuam guardados e podem ser baixados.

5. PLANOS, VALORES E PAGAMENTO
5.1 Os valores e o que cada plano inclui estão na página de planos no momento da assinatura.
5.2 A assinatura é mensal ou anual (o anual tem desconto), paga antecipadamente por Pix ou cartão de crédito. No mensal, o cartão é cobrado automaticamente todo mês (recorrente) e o Pix é pago mês a mês.
5.3 Mudanças de preço são avisadas com antecedência mínima de 30 dias e valem a partir do período seguinte.

6. DIREITO DE ARREPENDIMENTO (7 DIAS)
6.1 Conforme o art. 49 do Código de Defesa do Consumidor, o USUÁRIO pode desistir da assinatura em até 7 (sete) dias contados do pagamento, com devolução integral do valor pago.
6.2 O período de teste grátis não reduz esse prazo: ele começa a contar a partir do primeiro pagamento.

7. CANCELAMENTO
7.1 Depois dos 7 dias, o USUÁRIO pode cancelar quando quiser, sem multa e sem fidelidade. O acesso continua até o fim do período já pago, sem devolução proporcional.
7.2 Em caso de atraso no pagamento, a conta pode ser pausada para edição até a regularização. Os dados não são apagados.

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

10. PROPRIEDADE INTELECTUAL
O sistema, a marca e o visual da PLATAFORMA pertencem à PLATAFORMA. O USUÁRIO não pode copiar, revender ou redistribuir o sistema.

11. ALTERAÇÕES DESTES TERMOS
Mudanças importantes são avisadas dentro da plataforma. Continuar usando depois do aviso significa concordar com a nova versão.

12. FORO
Fica eleito o foro da comarca de {empresa_cidade} para resolver qualquer questão sobre estes termos.`

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
