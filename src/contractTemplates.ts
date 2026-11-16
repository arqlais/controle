import { RDL_TIMBRADO } from './rdlTimbrado'
import type { ContractTemplate } from './types'

/* ---------------- cliente final: projeto em etapas (puxa as etapas, os prazos e o pagamento do orçamento) ---------------- */

const FINAL_BODY = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PROJETO

CONTRATADA
{contratada}, {doc_contratada}, com endereço em {endereco_contratada}, e-mail {email_contratada}, telefone {telefone_contratada}.

CONTRATANTE
{contratante}, {doc_contratante}, com endereço em {endereco_contratante}, e-mail {email_contratante}, telefone {telefone_contratante}.

As partes combinam o seguinte:

1. OBJETO
1.1 Elaboração do projeto "{projeto}", conforme a proposta {orcamento}, desenvolvido nas etapas descritas abaixo.
1.2 Serviços incluídos:
{servicos}

2. ETAPAS DO PROJETO
2.1 O projeto é feito em etapas. Cada etapa começa depois da aprovação da anterior:
{etapas}
2.2 Ao final de cada etapa, a CONTRATANTE aprova o que foi entregue (por escrito, inclusive por mensagem). Voltar a uma etapa já aprovada é considerado alteração de escopo e pode ter custo adicional.

3. PRAZOS
3.1 Prazo estimado total: {prazo_total}, somando as etapas:
{cronograma}
3.2 Os prazos contam a partir do recebimento das informações necessárias (medidas, briefing, arquivos) e da aprovação de cada etapa. O tempo que a CONTRATANTE levar para responder ou aprovar não entra na contagem.

4. VALOR E PAGAMENTO
4.1 Valor total: {valor} ({valor_extenso}).
4.2 O pagamento acompanha as etapas:
{pagamento_etapas}
4.3 Forma de pagamento: {pagamento}
4.4 Atrasos no pagamento permitem à CONTRATADA pausar o projeto até a regularização, com os prazos estendidos pelo mesmo período.

5. AJUSTES
5.1 Estão incluídas até {revisoes} rodada(s) de ajustes em cada etapa.
5.2 Ajustes além disso, ou mudanças de programa, de área ou de conceito depois da aprovação, são orçados à parte.

6. O QUE NÃO ESTÁ INCLUÍDO (salvo se descrito na proposta)
6.1 Projetos complementares (estrutural, elétrico, hidráulico, ar-condicionado), aprovações em órgãos públicos e taxas.
6.2 Execução da obra, compra de materiais e contratação de fornecedores, que são de responsabilidade da CONTRATANTE.
6.3 Visitas à obra além das combinadas na proposta.

7. OBRIGAÇÕES
7.1 Da CONTRATADA: desenvolver o projeto com qualidade técnica, cumprir os prazos, manter sigilo sobre as informações recebidas e emitir o registro de responsabilidade técnica quando aplicável.
7.2 Da CONTRATANTE: fornecer as informações e o acesso ao imóvel, responder e aprovar as etapas em tempo razoável e fazer os pagamentos nas datas combinadas.

8. ENTREGA
8.1 Arquivos entregues: {arquivos}.

9. DIREITOS AUTORAIS
9.1 O projeto é obra intelectual da CONTRATADA (Lei 9.610/98). A CONTRATANTE pode usá-lo para executar a obra no endereço combinado, sem repetir em outro local.
9.2 A CONTRATADA pode usar imagens do projeto em portfólio e redes sociais, sem expor dados pessoais da CONTRATANTE, salvo se ela pedir o contrário por escrito.

10. CANCELAMENTO
10.1 Qualquer das partes pode encerrar este contrato com aviso de 7 dias.
10.2 Se o cancelamento partir da CONTRATANTE, as etapas concluídas e a etapa em andamento são devidas; o valor de entrada não é devolvido.

11. FORO
11.1 Fica eleito o foro da comarca de {foro}.

E, por estarem de acordo, as partes assinam este contrato (inclusive por assinatura eletrônica).

{cidade}, {data}.`

/** Contrato de cliente final em etapas, com o objeto e as cláusulas de cada tipo de serviço. */
function finalContract(id: string, name: string, objeto: string, extra: { inclui?: string[]; naoInclui?: string[]; clausula?: string } = {}): ContractTemplate {
  let b = FINAL_BODY.replace('1.1 Elaboração do projeto "{projeto}", conforme a proposta {orcamento}, desenvolvido nas etapas descritas abaixo.', `1.1 ${objeto}`)
  if (extra.inclui?.length) b = b.replace('1.2 Serviços incluídos:\n{servicos}', `1.2 Serviços incluídos:\n{servicos}\n${extra.inclui.map((x) => `• ${x}`).join('\n')}`)
  if (extra.naoInclui?.length)
    b = b.replace(/6\. O QUE NÃO ESTÁ INCLUÍDO[\s\S]*?\n\n7\./, `6. O QUE NÃO ESTÁ INCLUÍDO (salvo se descrito na proposta)\n${extra.naoInclui.map((x, k) => `6.${k + 1} ${x}`).join('\n')}\n\n7.`)
  if (extra.clausula) b = b.replace('\n9. DIREITOS AUTORAIS', `\n${extra.clausula}\n\n9. DIREITOS AUTORAIS`)
  return { id, name, body: b }
}

export const FINAL_CONTRACT: ContractTemplate = { id: 'cliente-final-etapas', name: 'projeto em etapas (cliente final)', body: FINAL_BODY }

/** Modelos de cliente final por tipo de serviço (a escolha vem do orçamento). */
export const FINAL_CONTRACTS: ContractTemplate[] = [
  FINAL_CONTRACT,
  finalContract('cf-interiores', 'projeto de interiores', 'Elaboração do projeto de interiores "{projeto}", conforme a proposta {orcamento}: layout, escolha de materiais, marcenaria, iluminação e decoração, desenvolvido nas etapas descritas abaixo.', {
    naoInclui: ['Alterações estruturais, projetos complementares (elétrico, hidráulico, ar-condicionado) e aprovações em condomínio ou prefeitura.', 'Execução da obra, compra de materiais e móveis e contratação de fornecedores, que são de responsabilidade da CONTRATANTE.', 'Visitas à obra além das combinadas na proposta.'],
    clausula: '8.2 Os valores de móveis, materiais e mão de obra indicados no projeto são referências e podem mudar conforme o fornecedor e a data da compra.',
  }),
  finalContract('cf-arquitetonico', 'projeto arquitetônico (construção ou reforma)', 'Elaboração do projeto arquitetônico "{projeto}", conforme a proposta {orcamento}, desenvolvido nas etapas descritas abaixo, com a emissão do registro de responsabilidade técnica (RRT/ART) do projeto.', {
    naoInclui: ['Projetos complementares (estrutural, elétrico, hidrossanitário, climatização), levantamento topográfico e sondagem.', 'Taxas de prefeitura, cartório e órgãos públicos, que são pagas pela CONTRATANTE.', 'Execução e administração da obra.'],
    clausula: '8.2 Os prazos de análise e aprovação da prefeitura e de outros órgãos não dependem da CONTRATADA e não entram na contagem dos prazos deste contrato.',
  }),
  finalContract('cf-consultoria', 'consultoria online', 'Consultoria online de arquitetura/interiores "{projeto}", conforme a proposta {orcamento}: orientação por videochamada e material com as soluções combinadas, para a CONTRATANTE executar.', {
    naoInclui: ['Projeto executivo, detalhamentos técnicos e registro de responsabilidade técnica.', 'Visitas presenciais e acompanhamento de obra.', 'Medições no local (as medidas e fotos são enviadas pela CONTRATANTE, que responde pela exatidão delas).'],
  }),
  finalContract('cf-obra', 'acompanhamento de obra', 'Acompanhamento da obra do projeto "{projeto}", conforme a proposta {orcamento}: visitas técnicas para conferir se a execução segue o projeto, com relatório de cada visita.', {
    inclui: ['Relatório de cada visita com fotos e pendências.', 'Canal de dúvidas com a equipe da obra.'],
    naoInclui: ['Administração, gestão de equipe e compra de materiais.', 'Responsabilidade pela execução, que é da construtora ou dos profissionais contratados pela CONTRATANTE.', 'Visitas além da quantidade combinada na proposta.'],
  }),
  finalContract('cf-regularizacao', 'regularização / projeto legal', 'Elaboração da documentação técnica para regularização / aprovação do imóvel "{projeto}", conforme a proposta {orcamento}, e o acompanhamento do processo junto aos órgãos competentes.', {
    naoInclui: ['Taxas, multas e emolumentos, que são pagos pela CONTRATANTE.', 'Obras de adequação que os órgãos venham a exigir.', 'Levantamento topográfico e documentos que só a CONTRATANTE pode obter (escritura, matrícula, IPTU).'],
    clausula: '8.2 A aprovação depende dos órgãos públicos: a CONTRATADA atende às exigências técnicas feitas por eles, mas não garante prazo nem resultado da análise.',
  }),
  finalContract('cf-complementares', 'projetos complementares', 'Elaboração dos projetos complementares de "{projeto}" (conforme a proposta {orcamento}), compatibilizados com o projeto arquitetônico fornecido.', {
    naoInclui: ['Alterações no projeto arquitetônico depois do início dos complementares.', 'Aprovação em concessionárias e órgãos públicos, salvo se descrito na proposta.'],
  }),
]

/* Modelos de contrato.
   - LAIS_CONTRACTS: o modelo da Laís (dona), exclusivo da conta dela. Mesmo texto do contrato
     que ela usa, com os espaços em branco trocados por {variáveis} preenchidas pelo orçamento.
   - CLIENT_CONTRACTS: modelos para os freelancers que assinam a plataforma (texto próprio). */

/* ---------------- modelo da Laís ---------------- */

const laisHead = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATADA
Nome: {contratada}
{doc_contratada}
Endereço: {endereco_contratada}
E-mail: {email_contratada}
Telefone: {telefone_contratada}

CONTRATANTE
Nome: {contratante}
{doc_contratante}
Endereço: {endereco_contratante}
E-mail: {email_contratante}
Telefone: {telefone_contratante}

As partes acima identificadas têm entre si justo e acordado o presente contrato:`

const laisBody = (objeto: string, escopo: string[], entrega: string[], limites: string[]) => `${laisHead}

CLÁUSULA 1 – OBJETO
1.1 ${objeto}
1.2 O escopo específico do projeto será definido conforme abaixo:
${escopo.map((x) => `• ${x}`).join('\n')}
1.3 Escopo contratado, conforme o orçamento {orcamento} aprovado pela CONTRATANTE (projeto: {projeto}):
{escopo}
1.4 Qualquer serviço que não esteja listado acima é considerado extra e será orçado à parte, antes de ser executado.
1.5 Os serviços serão desenvolvidos com base nas informações fornecidas pela CONTRATANTE, não sendo de responsabilidade do CONTRATADO a concepção autoral do projeto, quando aplicável.

CLÁUSULA 2 – DO PRAZO
2.1 O prazo para execução dos serviços será de {prazo_dias} dias úteis.
2.2 O prazo terá início a partir do envio completo de todas as informações necessárias pela CONTRATANTE e da confirmação do pagamento da entrada.
2.3 Atrasos no envio de informações, arquivos, aprovações ou pagamentos pela CONTRATANTE prorrogam o prazo pelo mesmo período.
2.4 Se o projeto ficar parado por mais de 30 dias por falta de retorno da CONTRATANTE, a retomada dependerá da agenda do CONTRATADO e poderá ter os valores restantes reajustados.

CLÁUSULA 3 – DAS OBRIGAÇÕES DA CONTRATANTE
3.1 Fornecer todas as informações, arquivos e diretrizes necessárias para execução dos serviços.
3.2 Responder dentro de prazo razoável para não comprometer o cronograma.
3.3 Efetuar os pagamentos conforme acordado neste contrato.
3.4 Arcar com custos adicionais decorrentes de alterações no escopo inicialmente definido.

CLÁUSULA 4 – DAS OBRIGAÇÕES DO CONTRATADO
4.1 Executar os serviços com qualidade técnica e profissionalismo.
4.2 Cumprir os prazos estabelecidos entre as partes.
4.3 Utilizar seus próprios equipamentos e ferramentas.
4.4 Manter sigilo sobre todas as informações recebidas.

CLÁUSULA 5 – DA ENTREGA
5.1 As entregas poderão incluir:
${entrega.join('\n')}

5.2 Cada entrega será considerada aprovada se a CONTRATANTE não apresentar pedidos de ajuste em até 5 dias úteis após o recebimento.
5.3 Os arquivos finais, em alta resolução e sem marca d'água, serão enviados após a quitação total do valor.
5.4 O CONTRATADO guarda os arquivos do projeto por 90 dias após a entrega final; depois desse período, não há obrigação de mantê-los.

CLÁUSULA 6 – DAS REVISÕES E LIMITAÇÕES DE ALTERAÇÃO
6.1 Estão incluídas até {revisoes} revisões no escopo contratado.
6.2 Após aprovação, alterações somente mediante acréscimo de valor.
6.3 As revisões contemplam apenas ajustes pontuais, não incluindo mudanças conceituais, serão consideradas alteração de escopo e orçadas à parte.
${limites.join('\n')}

CLÁUSULA 7 – DO VALOR E PAGAMENTO
7.1 Pelos serviços prestados, a CONTRATANTE pagará ao CONTRATADO o valor total de {valor}.
7.2 Forma de pagamento: {pagamento}.
7.3 Quando o pagamento for dividido em entrada e saldo: {entrada} na contratação e {saldo} na entrega.
7.4 Em caso de atraso no pagamento, incidirão multa de 2% e juros de 1% ao mês sobre o valor em atraso, e o CONTRATADO poderá suspender os serviços e a entrega dos arquivos até a regularização, com prorrogação equivalente do prazo.

CLÁUSULA 8 – DA RESCISÃO
8.1 O contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 5 dias úteis.
8.2 Em caso de desistência ou rescisão por iniciativa da CONTRATANTE, o valor pago a título de sinal (50%) não será devolvido, servindo como multa compensatória por reserva de agenda e custos operacionais.
8.3 Se a desistência ocorrer em fase de conclusão ou exportação de arquivos finais, o valor total do contrato (100%) será devido integralmente, visto que o serviço foi efetivamente prestado.

CLÁUSULA 9 – DOS DIREITOS AUTORAIS
9.1 Os materiais produzidos são de autoria do CONTRATADO.
9.2 A CONTRATANTE possui direito de uso exclusivo para o projeto contratado.
9.3 Fica vedada a reprodução, revenda ou reutilização para outros fins sem autorização prévia do CONTRATADO.
9.4 É permitido ao CONTRATADO o uso dos materiais desenvolvidos para portfólio e divulgação, preservando o sigilo de dados sensíveis, exceto se houver veto por escrito da CONTRATANTE na assinatura deste contrato.

CLÁUSULA 10 – DAS DISPOSIÇÕES GERAIS
10.1 O presente contrato não estabelece vínculo empregatício entre as partes.
10.2 Trata-se de prestação de serviço autônoma.
10.3 As comunicações feitas pelos e-mails e telefones (inclusive WhatsApp) informados neste contrato são válidas como comunicação oficial entre as partes.
10.4 As informações, medidas e arquivos fornecidos pela CONTRATANTE são de responsabilidade dela; o CONTRATADO não responde por erros decorrentes de dados incorretos ou incompletos.
10.5 Não estão incluídos neste contrato responsabilidade técnica (RRT/ART), aprovação em órgãos públicos ou acompanhamento de obra, salvo se constarem no escopo contratado.
10.6 Os dados pessoais das partes serão usados somente para a execução deste contrato, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
10.7 Nenhuma das partes responde por atrasos causados por caso fortuito ou força maior, devidamente comunicados à outra parte.
10.8 A tolerância de uma das partes quanto ao descumprimento de qualquer cláusula não significa renúncia ou alteração do que foi combinado.

CLÁUSULA 11 – DO FORO
11.1 Fica eleito o foro da comarca de {foro} para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

DAS ASSINATURAS
E, por estarem de pleno acordo, as partes assinam o presente contrato por meio de assinatura eletrônica, admitida como válida pelas partes nos termos da MP 2.200-2/2001 (art. 10, § 2º) e da Lei 14.063/2020, para que produza seus efeitos jurídicos e legais.

{cidade}, {data}.`

const executivoLimites = [
  '6.4 Nos serviços de executivo e detalhamento:',
  '• Não estão incluídas alterações no projeto arquitetônico, layout ou medidas estruturais após o início do detalhamento.',
  '• As revisões se limitam a ajustes de anotações técnicas, especificações de materiais de acabamento e representação gráfica.',
  '• Qualquer alteração que implique em refazer pranchas já finalizadas devido a mudanças de conceito será cobrada como novo escopo.',
]

export const LAIS_CONTRACTS: ContractTemplate[] = [
  ...FINAL_CONTRACTS,
  {
    id: 'lais-render',
    name: 'renderização (visualização 3D)',
    body: laisBody(
      'O presente contrato tem como objeto a prestação de visualização arquitetônica 3D, incluindo a configuração de materiais, iluminação e renderização fotorrealista.',
      [
        'Renderização 3D via V-Ray, com suporte opcional de Inteligência Artificial para otimização de imagem, se necessário.',
        'Configuração de texturas, materiais e iluminação fotorrealista.',
        '{quantidade} imagens renderizadas em alta resolução.',
        'Pós-produção digital e ajustes finais de imagem.',
      ],
      ['a) arquivos em PDF (pranchas técnicas);', 'b) imagens renderizadas;', 'c) arquivo editável, quando previamente acordado.'],
      executivoLimites,
    ),
  },
  {
    id: 'lais-modelagem',
    name: 'modelagem 3D',
    body: laisBody(
      'O presente contrato tem como objeto a prestação de serviços de modelagem tridimensional (3D) de arquitetura e/ou interiores, utilizando o software SketchUp.',
      [
        'Modelagem 3D volumétrica e detalhada com base em arquivos 2D (DWG/PDF).',
        'Organização do arquivo através de Tags (Layers) e Grupos/Componentes.',
        'Aplicação de materiais e texturas básicas para identificação de acabamentos.',
        'Humanização do modelo com mobiliário e objetos decorativos (blocos).',
        'Entrega do arquivo editável (.SKP) e/ou exportações em formatos compatíveis.',
      ],
      ['a) Arquivo editável em formato SKP (SketchUp) devidamente organizado;', 'b) Detalhamento de marcenaria ou detalhes específicos avançados, apenas se contratados e previamente acordados.'],
      [
        '6.4 Nos serviços de modelagem 3D:',
        '• Parte de uma planta baixa já definida; não inclui alterações estruturais ou de layout após o início da modelagem.',
        '• Itens específicos não encontrados em bibliotecas prontas devem ser fornecidos pelo CONTRATANTE.',
        '• A criação de blocos ou objetos específicos do zero não está inclusa.',
      ],
    ),
  },
  {
    id: 'lais-executivo',
    name: 'projeto executivo e detalhamento',
    body: laisBody(
      'O presente contrato tem como objeto a prestação de serviços de apoio técnico para elaboração de projeto executivo e detalhamento arquitetônico.',
      [
        'Plantas técnicas (layout, demolição/construção, elétrica e iluminação).',
        'Cortes, elevações e ampliações de áreas molhadas (cozinha/banheiros).',
        'Detalhamento de paginação de piso, forro e revestimentos.',
        'Caderno de detalhes técnicos para execução em obra.',
      ],
      ['a) Caderno técnico em PDF (pranchas e especificações);', 'b) Arquivos base (DWG) para compatibilização, se acordado;', 'c) Arquivos editáveis (SKP/DWG/VW) apenas se contratados à parte.'],
      executivoLimites,
    ),
  },
]

/* ---------------- modelos dos freelancers (clientes da plataforma) ---------------- */

const clientBody = (titulo: string, objeto: string, escopo: string[], entregas: string, extra: string[] = []) => `CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS
${titulo}

PARTES
CONTRATANTE: {contratante}, {doc_contratante}, com endereço em {endereco_contratante}, e-mail {email_contratante}, telefone {telefone_contratante}.
PRESTADOR(A): {contratada}, {doc_contratada}, com endereço em {endereco_contratada}, e-mail {email_contratada}, telefone {telefone_contratada}.

As partes combinam a prestação de serviços abaixo, conforme o orçamento {orcamento}, nas seguintes condições:

1. OBJETO
1.1 ${objeto}
1.2 Escopo contratado:
${escopo.map((x) => `• ${x}`).join('\n')}
1.3 Escopo do orçamento aprovado:
{escopo}
1.4 Qualquer item fora desta lista é considerado serviço extra e será orçado à parte, antes de ser feito.

2. PRAZO
2.1 Prazo de entrega: {prazo}, contados a partir do recebimento de todas as informações e arquivos necessários e do pagamento da entrada.
2.2 Atrasos no envio de informações, arquivos ou aprovações pelo(a) CONTRATANTE prorrogam o prazo pelo mesmo período.

3. VALOR E PAGAMENTO
3.1 Valor total: {valor} ({valor_extenso}).
3.2 Forma de pagamento: {pagamento}.
3.3 Pagamentos em atraso têm multa de 2% e juros de 1% ao mês, e permitem ao(à) PRESTADOR(A) pausar os serviços até a regularização, com ajuste proporcional do prazo.

4. AJUSTES E ALTERAÇÕES
4.1 Estão incluídas {revisoes} rodada(s) de ajuste, entendidas como correções pontuais do que foi combinado.
4.2 Mudanças de conceito, de projeto ou de escopo depois da aprovação serão orçadas à parte.
${extra.length ? extra.join('\n') + '\n' : ''}
5. ENTREGA
5.1 ${entregas}
5.2 Os arquivos finais são enviados depois da quitação total do valor.
5.3 Cada entrega é considerada aprovada se não houver pedido de ajuste em até 5 dias úteis após o recebimento.

6. RESPONSABILIDADES
6.1 O(A) CONTRATANTE fornece as informações, medidas, referências e arquivos necessários e responde às solicitações em tempo razoável.
6.2 O(A) PRESTADOR(A) executa os serviços com qualidade técnica, usa os próprios equipamentos e mantém sigilo sobre as informações recebidas.
6.3 Este contrato não cria vínculo empregatício: trata-se de prestação de serviço autônoma.
6.4 As comunicações pelos e-mails e telefones (inclusive WhatsApp) informados aqui valem como comunicação oficial.
6.5 Os dados pessoais das partes são usados só para executar este contrato, conforme a LGPD (Lei 13.709/2018).

7. DIREITOS DE USO E PORTFÓLIO
7.1 O(A) CONTRATANTE pode usar o material entregue no projeto contratado. Reproduzir, revender ou reutilizar em outros projetos depende de autorização.
7.2 O(A) PRESTADOR(A) pode divulgar o trabalho em portfólio e redes sociais, preservando dados sensíveis, salvo pedido de sigilo feito por escrito.

8. CANCELAMENTO
8.1 Qualquer uma das partes pode encerrar este contrato com aviso de 5 dias úteis.
8.2 Se o cancelamento partir do(a) CONTRATANTE, o valor da entrada não é devolvido, por cobrir a reserva de agenda e o trabalho iniciado. Etapas já concluídas são pagas integralmente.

9. FORO
9.1 Fica eleito o foro da comarca de {foro} para resolver qualquer questão sobre este contrato.

E, por estarem de acordo, as partes assinam este contrato (inclusive por assinatura eletrônica).

{cidade}, {data}.`


/* ---------------- engenharia: vistoria de recebimento de imóvel novo (entrega de chaves) ---------------- */

export const VISTORIA_PROPOSTA_URL = 'https://useplane.com.br/rdl/proposta-vistoria-san-levi.pdf'

export const VISTORIA_CONTRACT: ContractTemplate = {
  id: 'rdl-vistoria',
  name: 'vistoria de entrega de chaves (RDL)',
  letterhead: { first: RDL_TIMBRADO, top: 150, bottom: 96, side: 72 },
  body: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE VISTORIA TÉCNICA DE ENTREGA DE CHAVES

CONTRATADA
{contratada}, {doc_contratada}, e-mail {email_contratada}, telefone {telefone_contratada}, neste ato pelo engenheiro civil Rogério Francisco Vieira, registrado no CREA-SP, responsável técnico pelo serviço.

CONTRATANTE
{contratante}, {doc_contratante}, com endereço em {endereco_contratante}, e-mail {email_contratante}, telefone {telefone_contratante}.

IMÓVEL VISTORIADO
{endereco_obra}

As partes combinam a prestação de serviço abaixo, de acordo com a proposta comercial da CONTRATADA (Anexo I), que faz parte deste contrato. Se houver diferença entre os dois, vale o que está escrito neste contrato.

1. OBJETO
1.1 Vistoria técnica do imóvel acima, na entrega das chaves pela construtora, feita pessoalmente por engenheiro civil, com laudo técnico e ART (Anotação de Responsabilidade Técnica) da vistoria.
1.2 Estão incluídos no valor:
• análise prévia da planta e do memorial descritivo do imóvel;
• vistoria presencial de até 2 (duas) horas, no dia e horário da vistoria de entrega marcada pela construtora;
• verificação de acabamentos, pisos, paredes, forros, esquadrias, portas, louças, metais, instalações elétricas e hidráulicas aparentes, ambiente por ambiente, com o checklist de vistoria da CONTRATADA;
• testes simples de funcionamento (tomadas, interruptores, torneiras, ralos, descargas, caimento de água) e registro em fotos;
• laudo técnico em PDF, com fotos, lista dos itens para reparo e resultado da vistoria;
• ART da vistoria, registrada no CREA-SP, com a taxa já inclusa;
• orientação para registrar os itens junto à construtora.

2. O QUE NÃO ESTÁ INCLUÍDO
2.1 Revistoria (opcional, conforme a cláusula 9).
2.2 Execução, acompanhamento ou cobrança dos reparos, que são de responsabilidade da construtora.
2.3 Vistoria das áreas comuns do condomínio.
2.4 Abertura de paredes, pisos ou forros, ensaios destrutivos ou de laboratório e análise de projetos estruturais.
2.5 ART de obra, reforma ou de qualquer serviço que não seja esta vistoria.
2.6 Perícia judicial, assistência técnica em processo, notificações ou assessoria jurídica.
2.7 Medições para móveis, marcenaria ou projetos.
Qualquer serviço fora desta lista depende de novo orçamento.

3. COMO É FEITA A VISTORIA E SEUS LIMITES
3.1 A vistoria é visual e com instrumentos portáteis (trena, nível, testador de tomadas, entre outros), sem quebrar ou abrir nada, e registra o estado do imóvel no dia e na hora em que foi feita.
3.2 Vícios ocultos, isto é, defeitos embutidos em paredes, lajes e tubulações ou que só aparecem com o uso e com o tempo, não podem ser identificados numa vistoria visual e não fazem parte deste serviço. Eles continuam cobertos pela garantia da construtora, nos termos da lei.
3.3 O que não puder ser verificado no dia (por falta de água, energia, gás, acesso ou por estar coberto) será registrado no laudo como "não verificado".
3.4 O laudo aponta os itens a reparar; não garante que a construtora vá aceitá-los ou corrigi-los, nem substitui a garantia legal da construtora.

4. VALOR
4.1 Valor do serviço: {valor} ({valor_extenso}) por apartamento de até 40 m², com ART inclusa.
4.2 Tabela da proposta: individual, R$ 297,00; grupo de 10 (dez) ou mais apartamentos do mesmo empreendimento, R$ 280,00 por apartamento; revistoria opcional, R$ 150,00.
4.3 Valor de grupo: se este contrato foi fechado pelo valor de grupo e o grupo não chegar a 10 (dez) apartamentos contratados até a construtora liberar as datas de vistoria, vale o valor individual. Nesse caso, o(a) CONTRATANTE é avisado(a) e pode escolher entre pagar a diferença no saldo ou desistir com devolução integral do sinal, em até 3 (três) dias do aviso.

5. PAGAMENTO
5.1 Sinal de 50% ({entrada}), pago em até 3 (três) dias da assinatura deste contrato. A vaga na agenda só fica garantida depois que o sinal é pago; sem o pagamento nesse prazo, a CONTRATADA pode cancelar a reserva, sem custo para nenhuma das partes.
5.2 Saldo de 50% ({saldo}) no dia da vistoria.
5.3 Forma de pagamento: {pagamento}
5.4 O laudo e a ART são entregues depois da quitação. Saldo não pago em até 5 (cinco) dias da vistoria tem multa de 2% (dois por cento) e juros de 1% (um por cento) ao mês, corrigido pelo IPCA.

6. AGENDA E RESERVA
6.1 O sinal garante uma vaga na agenda da CONTRATADA para a vistoria deste imóvel, não um horário específico. As vagas são preenchidas pela ordem de pagamento do sinal.
6.2 Assim que a construtora liberar as datas, o(a) CONTRATANTE deve avisar a CONTRATADA em até 2 (dois) dias e combinar o horário com ela antes de confirmá-lo com a construtora, para evitar dois apartamentos no mesmo horário.
6.3 Se a construtora mudar a data ou o horário, a nova data é combinada conforme a disponibilidade da CONTRATADA, sem custo adicional.
6.4 Se a CONTRATADA não tiver nenhum horário compatível com as datas oferecidas pela construtora, o sinal é devolvido integralmente em até 5 (cinco) dias úteis.
6.5 A CONTRATADA aguarda até 30 (trinta) minutos depois do horário marcado. O atraso de qualquer pessoa que não seja a CONTRATADA reduz o tempo da visita, sem ampliar o horário combinado.
6.6 Visita perdida: se a CONTRATADA comparecer e a vistoria não puder ser feita por ausência do(a) CONTRATANTE ou de quem o(a) represente, ou por falta de acesso ao imóvel, sem aviso com 24 (vinte e quatro) horas de antecedência, uma nova visita custa o valor da revistoria (R$ 150,00).
6.7 Se a vistoria de entrega não for marcada pela construtora em até 12 (doze) meses da assinatura deste contrato, qualquer uma das partes pode encerrá-lo, com devolução integral do sinal, sem multa.

7. OBRIGAÇÕES DO(A) CONTRATANTE
7.1 Enviar, quando tiver, a planta, o memorial descritivo e o manual do proprietário do imóvel.
7.2 Avisar as datas da construtora no prazo da cláusula 6.2.
7.3 Acompanhar a vistoria pessoalmente ou por pessoa de sua confiança, autorizada por ele(a) por escrito (mensagem de WhatsApp ou e-mail vale).
7.4 Pedir à construtora que o imóvel esteja com água e energia ligadas e liberado para a vistoria.
7.5 Registrar os itens do laudo junto à construtora, pelos canais dela, e guardar os protocolos.

8. OBRIGAÇÕES DA CONTRATADA
8.1 Fazer a vistoria pessoalmente, com cuidado técnico, seguindo as normas técnicas aplicáveis e as boas práticas de engenharia.
8.2 Registrar a ART da vistoria no CREA-SP e entregá-la junto com o laudo.
8.3 Entregar o laudo em até 4 (quatro) dias úteis depois da vistoria e da quitação, em PDF, por WhatsApp e e-mail.
8.4 Corrigir, sem custo, erros de digitação ou de informação no laudo apontados em até 7 (sete) dias do recebimento.
8.5 Manter em sigilo os dados e as fotos do imóvel.

9. REVISTORIA (OPCIONAL)
9.1 A pedido do(a) CONTRATANTE, em até 90 (noventa) dias da vistoria, a CONTRATADA volta ao imóvel para conferir os itens apontados no laudo e entrega um laudo atualizado, pelo valor de R$ 150,00, pago no dia da revistoria.
9.2 A revistoria é agendada conforme a disponibilidade da CONTRATADA e confere apenas os itens do laudo original.
9.3 Normalmente a construtora não exige nova ART para a revistoria. Se exigir, a taxa do CREA é cobrada à parte, pelo valor da tabela do CREA-SP vigente.

10. ART
10.1 A ART deste contrato é registrada em nome do engenheiro responsável e se refere exclusivamente à vistoria aqui descrita. Ela não vale para obra, reforma ou outros serviços, que dependem de nova contratação.

11. DESISTÊNCIA E CANCELAMENTO
11.1 O(A) CONTRATANTE pode desistir em até 7 (sete) dias da assinatura, com devolução integral do sinal, desde que a vistoria ainda não tenha sido feita (art. 49 do Código de Defesa do Consumidor).
11.2 Passado esse prazo de 7 (sete) dias, o sinal tem natureza de arras (arts. 417 a 420 do Código Civil) e não é devolvido em caso de desistência, pois garantiu a vaga na agenda, que deixou de ser oferecida a outro morador.
11.3 Se a desistência partir da CONTRATADA, ela devolve em dobro o sinal recebido (art. 418 do Código Civil), salvo nos casos da cláusula 6.4 e da cláusula 12.
11.4 Se o imóvel deixar de ser do(a) CONTRATANTE antes da vistoria (distrato com a construtora, por exemplo), o sinal pode ser usado para outro imóvel indicado por ele(a) ou para a vistoria do novo comprador, se este assumir o contrato.

12. CASO FORTUITO OU FORÇA MAIOR
12.1 Se um fato fora do controle das partes (doença, acidente, eventos climáticos, bloqueio de acesso, entre outros) impedir a vistoria na data combinada, a vistoria é feita na primeira data possível, combinada entre as partes e a construtora, ou, se isso não for possível, todo o valor pago é devolvido (art. 393 do Código Civil).

13. FOTOS, DADOS PESSOAIS E USO DO LAUDO
13.1 Os dados e as fotos do imóvel são usados só para prestar este serviço, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), e não são divulgados sem autorização do(a) CONTRATANTE. Fotos sem identificação do morador ou da unidade podem ser usadas para fins técnicos internos.
13.2 O laudo é de uso do(a) CONTRATANTE e pode ser apresentado à construtora, ao condomínio e a quem ele(a) quiser. A CONTRATADA guarda uma cópia por no mínimo 5 (cinco) anos.

14. COMUNICAÇÃO E ASSINATURA
14.1 Mensagens de WhatsApp e e-mails trocados pelos contatos deste contrato valem como comunicação oficial entre as partes.
14.2 Este contrato pode ser assinado eletronicamente, com a mesma validade da assinatura em papel (art. 10, § 2º, da MP 2.200-2/2001).

15. FORO
15.1 Fica eleito o foro da comarca de {foro} para resolver qualquer questão sobre este contrato, ressalvado o direito do(a) CONTRATANTE de usar o foro do seu domicílio (art. 101, I, do Código de Defesa do Consumidor).

ANEXO I — PROPOSTA COMERCIAL
Proposta da RDL Engenharia para a vistoria de entrega de chaves, com o que está e o que não está incluso, valores e condições: ${VISTORIA_PROPOSTA_URL}

E, por estarem de acordo, as partes assinam este contrato.

{cidade}, {data}.`,
}

export const CLIENT_CONTRACTS: ContractTemplate[] = [
  ...FINAL_CONTRACTS,
  {
    id: 'visualizacao',
    name: 'visualização 3D (imagens)',
    body: clientBody(
      'VISUALIZAÇÃO 3D',
      'Produção de imagens 3D (renderizações) do projeto "{projeto}".',
      ['{quantidade} imagem(ns) em alta resolução, nos ângulos combinados.', 'Configuração de materiais, iluminação e ambientação.', 'Pós-produção e ajustes finais das imagens.'],
      'Imagens em alta resolução (JPG/PNG). Arquivos de trabalho (modelo, cena) só quando combinado.',
    ),
  },
  {
    id: 'modelagem',
    name: 'modelagem 3D',
    body: clientBody(
      'MODELAGEM 3D',
      'Modelagem tridimensional do projeto "{projeto}" a partir dos arquivos 2D fornecidos.',
      ['Modelagem com base em plantas, cortes e elevações (DWG/PDF).', 'Arquivo organizado em camadas/grupos.', 'Materiais básicos e mobiliário, conforme combinado.'],
      'Arquivo 3D editável no formato combinado e exportações compatíveis.',
      ['4.3 A modelagem parte de um projeto já definido: alterações de layout ou de estrutura depois do início são orçadas à parte.'],
    ),
  },
  {
    id: 'apoio-tecnico',
    name: 'executivo e detalhamento (apoio técnico)',
    body: clientBody(
      'APOIO TÉCNICO EM PROJETO',
      'Apoio técnico na elaboração do projeto executivo e/ou detalhamento do projeto "{projeto}", desenvolvido a partir do projeto fornecido pelo(a) CONTRATANTE.',
      ['Pranchas técnicas conforme a lista do orçamento.', 'Detalhamentos combinados (marcenaria, paginação, forro etc.).', 'Representação gráfica e anotações técnicas.'],
      'Pranchas em PDF e, quando combinado, arquivos editáveis (DWG/SKP).',
      ['4.3 A autoria e a responsabilidade técnica do projeto são do(a) CONTRATANTE. Alterações de projeto depois do início do detalhamento são orçadas à parte.'],
    ),
  },
  {
    id: 'projeto-cliente-final',
    name: 'projeto para cliente final (arquitetura / interiores)',
    body: clientBody(
      'PROJETO DE ARQUITETURA / INTERIORES',
      'Elaboração do projeto "{projeto}" em etapas, cada uma dependendo da aprovação da anterior.',
      ['Levantamento e briefing.', 'Estudo preliminar.', 'Anteprojeto.', 'Projeto executivo e detalhamentos combinados.'],
      'Pranchas em PDF, imagens do projeto quando combinadas e lista de especificações.',
      ['4.3 Visitas técnicas e acompanhamento de obra não estão incluídos, salvo se descritos no orçamento.', '4.4 A execução da obra e a contratação de fornecedores são de responsabilidade do(a) CONTRATANTE.'],
    ),
  },
  {
    id: 'por-hora',
    name: 'serviço por hora',
    body: clientBody(
      'SERVIÇO POR HORA',
      'Prestação de serviços do projeto "{projeto}" cobrados por hora trabalhada.',
      ['Estimativa inicial conforme o orçamento {orcamento}.', 'Relatório das horas trabalhadas sempre que solicitado.', 'Aviso prévio antes de ultrapassar a estimativa combinada.'],
      'Arquivos combinados em cada etapa, no formato definido no orçamento.',
      ['4.3 Horas além da estimativa só são cobradas depois de avisadas e aprovadas pelo(a) CONTRATANTE.'],
    ),
  },
]
