import type { ContractTemplate } from './types'

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
1.3 Os serviços serão desenvolvidos com base nas informações fornecidas pela CONTRATANTE, não sendo de responsabilidade do CONTRATADO a concepção autoral do projeto, quando aplicável.

CLÁUSULA 2 – DO PRAZO
2.1 O prazo para execução dos serviços será de {prazo_dias} dias úteis.
2.2 O prazo terá início a partir do envio completo de todas as informações necessárias pela CONTRATANTE.

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

CLÁUSULA 6 – DAS REVISÕES E LIMITAÇÕES DE ALTERAÇÃO
6.1 Estão incluídas até {revisoes} revisões no escopo contratado.
6.2 Após aprovação, alterações somente mediante acréscimo de valor.
6.3 As revisões contemplam apenas ajustes pontuais, não incluindo mudanças conceituais, serão consideradas alteração de escopo e orçadas à parte.
${limites.join('\n')}

CLÁUSULA 7 – DO VALOR E PAGAMENTO
7.1 Pelos serviços prestados, a CONTRATANTE pagará ao CONTRATADO o valor total de {valor}.
7.2 O pagamento será realizado da seguinte forma:
• 50% na contratação - {entrada}
• 50% na entrega - {saldo}
7.3 Em caso de atraso no pagamento, o CONTRATADO poderá suspender os serviços até a regularização.

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

CLÁUSULA 11 – DO FORO
11.1 Fica eleito o foro da comarca de {foro} para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

DAS ASSINATURAS
E, por estarem de pleno acordo, as partes assinam o presente contrato por meio de plataforma de assinatura eletrônica, para que produza seus efeitos jurídicos e legais.

{cidade}, {data}.`

const executivoLimites = [
  '6.4 Nos serviços de executivo e detalhamento:',
  '• Não estão incluídas alterações no projeto arquitetônico, layout ou medidas estruturais após o início do detalhamento.',
  '• As revisões se limitam a ajustes de anotações técnicas, especificações de materiais de acabamento e representação gráfica.',
  '• Qualquer alteração que implique em refazer pranchas já finalizadas devido a mudanças de conceito será cobrada como novo escopo.',
]

export const LAIS_CONTRACTS: ContractTemplate[] = [
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
1.3 Serviços do orçamento:
{servicos}
1.4 Qualquer item fora desta lista é considerado serviço extra e será orçado à parte, antes de ser feito.

2. PRAZO
2.1 Prazo de entrega: {prazo}, contados a partir do recebimento de todas as informações e arquivos necessários e do pagamento da entrada.
2.2 Atrasos no envio de informações, arquivos ou aprovações pelo(a) CONTRATANTE prorrogam o prazo pelo mesmo período.

3. VALOR E PAGAMENTO
3.1 Valor total: {valor} ({valor_extenso}).
3.2 Forma de pagamento: {pagamento}.
3.3 Pagamentos em atraso permitem ao(à) PRESTADOR(A) pausar os serviços até a regularização, com ajuste proporcional do prazo.

4. AJUSTES E ALTERAÇÕES
4.1 Estão incluídas {revisoes} rodada(s) de ajuste, entendidas como correções pontuais do que foi combinado.
4.2 Mudanças de conceito, de projeto ou de escopo depois da aprovação serão orçadas à parte.
${extra.length ? extra.join('\n') + '\n' : ''}
5. ENTREGA
5.1 ${entregas}
5.2 Os arquivos finais são enviados depois da quitação total do valor.

6. RESPONSABILIDADES
6.1 O(A) CONTRATANTE fornece as informações, medidas, referências e arquivos necessários e responde às solicitações em tempo razoável.
6.2 O(A) PRESTADOR(A) executa os serviços com qualidade técnica, usa os próprios equipamentos e mantém sigilo sobre as informações recebidas.
6.3 Este contrato não cria vínculo empregatício: trata-se de prestação de serviço autônoma.

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

export const CLIENT_CONTRACTS: ContractTemplate[] = [
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
