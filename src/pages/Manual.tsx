import { isValidElement, useState, type ReactNode } from 'react'
import { useKeep } from '../keep'
import { useAccess } from '../access'
import { go } from '../router'
import { Icon } from '../components/Icon'
import { PLANS, PLAN_LIST, type Feature, type PlanId } from '../plans'

type IconName = string

/* Manual de uso: a jornada do pedido de orçamento até a entrega, com "onde fica" e atalho para cada tela. */

type Where = { path: string[]; page?: string; id?: string }

interface Step {
  n: string
  icon?: IconName
  plan?: PlanId // a partir de qual plano (sem = todos)
  title: string
  when: string
  where: Where
  todo: ReactNode[]
  tip?: ReactNode
}

const STEPS: Step[] = [
  {
    n: '01',
    icon: 'user',
    title: 'Chegou um pedido: cadastre a cliente',
    when: 'Alguém pediu orçamento pelo WhatsApp, Instagram ou indicação.',
    where: { path: ['clientes', 'novo cliente'], page: 'clientes' },
    todo: [
      <>Vá em <b>clientes</b> e clique em <b>novo cliente</b> (ou use o botão <b>+ novo</b> no topo → <b>Cliente</b>).</>,
      <>Preencha nome, telefone e o <b>tipo</b> (arquiteto, designer, escritório, construtora ou estudante). O tipo muda a cor e o desconto de estudante.</>,
      <>Digite só os números: telefone, CPF e CEP ganham a pontuação sozinhos, e o Instagram ganha o <b>@</b>. Com o <b>CEP</b>, a rua e a cidade vêm sozinhas; o <b>número</b> fica num campo à parte.</>,
      <>Cliente com empresa? <b>+ dados da empresa (CNPJ, MEI)</b>: com o CNPJ, a razão social e o endereço vêm sozinhos, e você escolhe se o recibo sai em nome da pessoa ou da empresa.</>,
      <>Se a cliente já existe, pule este passo: ela aparece na lista ao montar o orçamento.</>,
    ],
    tip: <>Dá para cadastrar a cliente direto no orçamento, no botão <b>+</b> ao lado do campo cliente. O <b>lápis</b> ao lado edita os dados dela.</>,
  },
  {
    n: '02',
    icon: 'file',
    title: 'Monte o orçamento',
    when: 'Você já entendeu o que a cliente precisa.',
    where: { path: ['orçamentos', 'novo orçamento'], page: 'orcamentos', id: 'novo' },
    todo: [
      <>Em <b>dados</b>: escolha a cliente, escreva o título do quadro (ex.: “modelagem fachada”).</>,
      <><b>Área (m²)</b> começa em 0: só preencha quando for modelagem, executivo ou detalhamento. Com 0, não aparece no PDF.</>,
      <><b>Modelo</b>: “valor único” ou “opções” (2 ou 3 propostas lado a lado para o cliente escolher) ou “propostas + juntas” (2 ou 3 projetos com desconto fechando todos).</>,
      <>Em <b>serviços</b>, adicione cada item da tabela. Para dar desconto numa imagem, use o desconto por unidade; para serviço sem preço fixo, digite o valor livre.</>,
      <>Deixe marcado <b>gerar proposta em PDF</b> só se for mandar o PDF.</>,
      <><b>Arquivo final</b> (logo abaixo do modelo): <b>aberto (editável)</b> soma a sua % no valor de todos os serviços (menos o que já vai aberto, como a modelagem), em cada opção ou proposta, e os descontos acompanham. Não aparece no PDF; só muda o texto de entrega.</>,
      <>Mais de um pavimento: use o <b>+</b> em <b>pav.</b>. O valor considera os pavimentos; desmarque o <b>check ao lado do pav.</b> se não quiser mostrar no PDF.</>,
      <><b>Nº 0</b> = o sistema escolhe o número pela data ao salvar. Enquanto for <b>rascunho</b>, a data vai para o dia de hoje sozinha (se escolher outra data, ela fica).</>,
      <>Confira <b>informações da proposta</b>: pagamento, prazos e cronograma e formatos de arquivo (já vêm preenchidos). <b>Rodadas de ajuste</b> vêm com 1.</>,
    ],
    tip: <>No PDF fica só “Prazos e cronograma: serão definidos conforme a necessidade do cliente.” O prazo de verdade você alinha com a cliente antes de fechar e registra no sistema (passo 05). A prévia do PDF fica ao lado; <b>ver maior</b> abre em tela cheia. Os orçamentos em rascunho também aparecem na primeira coluna do quadro de <b>demandas</b>.</>,
  },
  {
    n: '03',
    icon: 'whatsapp',
    title: 'Envie para a cliente',
    when: 'O orçamento está pronto.',
    where: { path: ['orçamentos', 'abrir o orçamento', 'baixar PDF / enviar'], page: 'orcamentos' },
    todo: [
      <><b>baixar PDF</b> salva “Proposta #001 - Nome do cliente.pdf”.</>,
      <><b>enviar</b> abre o WhatsApp com a sua mensagem (“te encaminhei o pdf com a proposta, é negociável ☺️…”); anexe o PDF na conversa. Sem PDF, vai o resumo com os valores. O status muda sozinho para <b>enviado</b>.</>,
      <>No botão <b>mais ⋯</b> ficam <b>mensagens</b> (textos prontos), <b>copiar resumo</b>, <b>duplicar</b> (cópia com a data de hoje e o próximo número) e <b>perguntar à IA</b>.</>,
    ],
  },
  {
    n: '04',
    icon: 'clock',
    title: 'Aguarde a resposta (e cobre, se sumir)',
    when: 'Proposta enviada, cliente ainda não respondeu.',
    where: { path: ['início', 'para fazer'], page: 'inicio' },
    todo: [
      <>Depois de 1 dia útil sem resposta, aparece em <b>início → para fazer</b> um “Pedir retorno” com botão de <b>mensagem</b>.</>,
      <>Em <b>orçamentos</b>, o filtro <b>cobrar resposta</b> mostra todos que estão esperando.</>,
      <>Se recusou: na lista de orçamentos, clique na pílula de status e escolha <b>não fechou</b>.</>,
    ],
  },
  {
    n: '05',
    icon: 'check',
    title: 'Fechou! Aprove o orçamento',
    when: 'A cliente topou (com ou sem negociação).',
    where: { path: ['orçamentos', 'pílula de status', 'Aprovado'], page: 'orcamentos' },
    todo: [
      <>Na lista de <b>orçamentos</b>, clique na pílula de status e escolha <b>Aprovado</b> (ou, dentro do orçamento, <b>aprovado → criar demanda</b>).</>,
      <>Na janela <b>Fechou por quanto?</b>: se negociou, troque o valor. O PDF continua com o valor original; o financeiro usa o fechado.</>,
      <>Se vocês alinharam um prazo, coloque em <b>prazo combinado</b>, na mesma janela: em <b>dias úteis</b> (pula fins de semana e feriados), <b>dias corridos</b> (conta todos os dias) ou uma <b>data exata</b>. Sem pressa? Deixe em branco.</>,
      <>A demanda é criada sozinha em <b>demandas</b>, na coluna <b>em alinhamento</b>, com as parcelas “sinal 50%” e “saldo 50%”.</>,
    ],
    tip: <>Orçamento com vários serviços vira um <b>pacote</b> automaticamente, para você poder retirar um projeto depois sem refazer a conta. Mais de um pavimento? Em <b>área e pavimentos</b> use o <b>+</b>: cada pavimento a mais soma a porcentagem de configurações → preços nos serviços que encarecem (executivo, detalhamento, modelagem, render). Duas propostas que o cliente pode fechar separadas ou juntas? Em <b>modelo</b>, escolha <b>propostas + juntas</b> (use <b>+ proposta 3</b> se forem três projetos) — cada proposta/opção tem a <b>própria área (m²) e pavimentos</b>, e os serviços por m² daquele quadro acompanham e dê o desconto para fechar todas: a proposta mostra o valor de cada uma e quanto fica juntas. Dois serviços com um valor só? No segundo, marque <b>cobrar junto com o serviço de cima</b>. Executivo e detalhamento: em <b>serviços → perguntar</b> mande a lista de plantas ao cliente; quando ele responder, use <b>colar resposta</b> e as plantas escolhidas entram sozinhas no orçamento (ou toque nelas para marcar). Cada planta marcada soma no valor pelo m² e pela complexidade; algo muito específico, escreva em <b>+ outro</b>. Os valores de cada planta ficam em configurações → preços. Em <b>arquivo final</b> marque se o cliente quer o arquivo <b>fechado</b> ou <b>aberto</b>: o aberto soma uma taxa interna no valor (não aparece no PDF) e o texto de entrega se ajusta sozinho.</>,
  },
  {
    n: '06',
    icon: 'wallet',
    title: 'Receba o sinal',
    when: 'Logo depois de fechar.',
    where: { path: ['demandas', 'cartão da demanda', 'botão do sinal'], page: 'projetos' },
    todo: [
      <>Enquanto o sinal não chega, aparece em <b>início → para fazer</b> como “aguardando o sinal”, com botão <b>cobrar</b>.</>,
      <>Quando pagar: clique no botão do sinal no <b>cartão da demanda</b> (ou em <b>Marcar pago</b> no financeiro / na demanda).</>,
      <>Ao marcar o sinal, a demanda passa sozinha para <b>em execução</b>.</>,
    ],
  },
  {
    n: '07',
    icon: 'layers',
    title: 'Execute o projeto',
    when: 'Durante o trabalho.',
    where: { path: ['demandas', 'abrir a demanda'], page: 'projetos' },
    todo: [
      <>Mude a fase clicando na <b>pílula de fase</b> (no quadro, na lista ou no início). Não precisa abrir nada.</>,
      <>Dentro da demanda: marque as <b>etapas</b> conforme avança, conte as <b>revisões</b> (+ / −) e anote tudo em <b>briefing e anotações</b>.</>,
      <>Reunião ou entrega parcial? <b>compromissos → +</b>. Aparece na agenda.</>,
      <>Prazo combinado depois? Clique na data do card <b>prazo combinado</b>, no topo da demanda, e escolha o dia.</>,
      <>O link da pasta (Drive, WeTransfer) fica em <b>editar → Link dos arquivos</b>.</>,
    ],
  },
  {
    n: '08',
    icon: 'flag',
    title: 'Envie para aprovação e entregue',
    when: 'Prévia pronta / arquivos finais.',
    where: { path: ['demandas', 'pílula de fase'], page: 'projetos' },
    todo: [
      <>Mandou a prévia? Mude a fase para <b>em aprovação</b>. A partir daqui o saldo vira <b>a cobrar</b>.</>,
      <>Pediu ajustes? Fase <b>em ajustes</b> e some +1 em revisões.</>,
      <>Aprovou: receba o saldo e clique em <b>Marcar pago</b>. Para enviar recibo, use o ícone de <b>impressora</b> na parcela paga.</>,
      <>Enquanto estiver <b>em ajustes</b> ou <b>em aprovação</b>, a demanda aparece no início em <b>próximos 7 dias → esperando a cliente</b>, com o botão <b>cobrar</b> (mensagem pronta no WhatsApp).</>,
      <>Por fim, <b>marcar como entregue</b> no topo da demanda. A data já vem com o prazo (ou hoje). Se a cliente cancelou o restante, marque <b>o cliente cancelou</b> na mesma janela.</>,
    ],
    tip: <>Os textos de cobrança, aprovação e entrega ficam no botão <b>mensagens</b> da demanda, já com o nome do cliente e os valores. O <b>Recibo</b>, no topo dos pagamentos, mostra o total, o que já foi pago e o que falta, em PDF ou imagem para o WhatsApp.</>,
  },
]

/* Jornada de quem atende o cliente final (plano Estúdio): do briefing à obra. */
const FINAL_STEPS: Step[] = [
  {
    n: '01',
    icon: 'clip',
    title: 'Mande o briefing antes da reunião',
    when: 'Um cliente final pediu projeto (casa, apartamento, loja, consultório).',
    where: { path: ['briefings', 'escolher modelo', 'copiar link'], page: 'briefings' },
    todo: [
      <>Em <b>briefings</b>, escolha um dos mais de 20 modelos prontos (casa, interiores, infantil, clínica, loja…) ou crie o seu. Modelos que você não usa: <b>lixeira</b> no cartão (some só para você; <b>trazer de volta</b> restaura).</>,
      <>Para editar um modelo, abra e mude as perguntas: dá para <b>escolher por imagem</b>, criar <b>sub-perguntas</b> (só aparecem conforme a resposta) e dicas de foto. <b>desfazer</b>, <b>descartar</b> e <b>salvar</b> ficam na barra de cima; <b>restaurar original</b> volta ao modelo pronto.</>,
      <><b>novo briefing</b> → escolha o cliente (digite o nome; se não existir, cadastre ali mesmo) → <b>copiar link</b> ou <b>enviar no WhatsApp</b>. O link é curto.</>,
      <>O <b>olho</b> mostra exatamente como o cliente vê, no celular ou no computador.</>,
    ],
    tip: <>Quando o cliente termina, as respostas chegam sozinhas na ficha dele. Se a nuvem não salvar, ele manda as respostas pelo WhatsApp com um <b>código</b>: cole a mensagem inteira em <b>colar respostas</b>, no briefing.</>,
  },
  {
    n: '02',
    icon: 'user',
    title: 'Leia as respostas na ficha do cliente',
    when: 'O cliente respondeu o briefing.',
    where: { path: ['clientes', 'abrir o cliente', 'briefing'], page: 'clientes' },
    todo: [
      <>A ficha mostra o <b>briefing respondido</b>, com as fotos que ele mandou, os <b>projetos</b> e em que <b>etapa</b> cada um está.</>,
      <>Dá para baixar o briefing em PDF com o seu design (em <b>documentos → briefing em PDF</b>) para levar na reunião.</>,
    ],
  },
  {
    n: '03',
    icon: 'file',
    title: 'Monte a proposta para cliente final',
    when: 'Depois da conversa, com o escopo claro.',
    where: { path: ['orçamentos', 'novo orçamento', 'para quem é: cliente final'], page: 'orcamentos', id: 'novo' },
    todo: [
      <>No começo do orçamento, escolha <b>para quem é</b>: <b>cliente final</b> (proposta em slides com as etapas do seu processo) ou <b>escritório / freelancer</b> (a folha de sempre).</>,
      <>Escolha as <b>etapas de trabalho</b> (levantamento, estudo, anteprojeto, executivo…) com prazo e parcela de cada uma. Elas vêm de <b>etapas de trabalho</b>, no menu, onde você monta o seu processo.</>,
      <>Duas ou três propostas (ex.: interiores e marcenaria)? Modelo <b>propostas + juntas</b>: mostra o valor de cada uma e quanto fica fechando juntas.</>,
      <><b>editar textos</b> muda qualquer frase da proposta. O design segue o modelo escolhido em <b>configurações → propostas</b>.</>,
    ],
  },
  {
    n: '04',
    icon: 'pen',
    title: 'Gere o contrato a partir da proposta',
    when: 'O cliente aprovou.',
    where: { path: ['orçamento', 'gerar contrato'], page: 'contratos' },
    todo: [
      <>No orçamento aprovado, <b>gerar contrato</b>: o modelo já vem sugerido pelo tipo do serviço (interiores, arquitetônico, reforma, consultoria…), com etapas, prazos e forma de pagamento preenchidos.</>,
      <>Os seus modelos ficam na lateral de <b>contratos</b>; os que você não usa podem ser excluídos (e restaurados).</>,
      <>Para assinar: <b>criar link de assinatura</b> (o cliente assina no celular com nome e CPF) ou assine por um site como <b>gov.br</b> ou <b>ZapSign</b> e registre aqui.</>,
    ],
  },
  {
    n: '05',
    icon: 'calendar',
    title: 'Cronograma e página do cliente',
    when: 'O projeto começou.',
    where: { path: ['demandas', 'abrir o projeto', 'cronograma / cliente'], page: 'projetos' },
    todo: [
      <>Dentro do projeto, a aba <b>cronograma</b> tem as etapas com prazo e parcela; marque cada uma ao concluir e o financeiro acompanha.</>,
      <>Na aba <b>cliente</b>, ligue a <b>página do projeto</b> e mande o link: o cliente acompanha etapas, pagamentos, arquivos e visitas pelo celular. <b>ver como o cliente vê</b> mostra antes.</>,
    ],
    tip: <>As abas do estúdio (cronograma, obra, lucro, cliente) aparecem só em projetos de cliente final. Freelancer e estudante continuam com o checklist simples de etapas.</>,
  },
  {
    n: '06',
    icon: 'ruler',
    title: 'Documentos com a sua marca',
    when: 'Quando precisar de medição, placa ou apresentação.',
    where: { path: ['documentos'], page: 'documentos' },
    todo: [
      <><b>guia de medição</b>: passo a passo para o cliente medir o espaço e mandar fotos.</>,
      <><b>placa de obra</b>: quatro artes diferentes (diagonal, retrato, faixa, moldura) com QR code para o seu site ou Instagram.</>,
      <><b>apresentação de projeto</b>: capa, conceito, moodboard, planta, imagens, materiais e próximos passos.</>,
      <>Escolha o cliente e <b>salvar</b>: o documento fica na ficha dele para abrir, editar e baixar de novo. Saiu sem salvar? O sistema pergunta antes.</>,
    ],
    tip: <>Cores, fontes e arredondamento seguem o que você escolheu em <b>configurações → aparência / propostas</b>. Edições direto na folha (texto livre) são melhores no computador ou tablet.</>,
  },
  {
    n: '07',
    icon: 'hardhat',
    title: 'Acompanhe a obra',
    when: 'Visitas técnicas e execução.',
    where: { path: ['demandas', 'abrir o projeto', 'obra'], page: 'projetos' },
    todo: [
      <>Na aba <b>obra</b>, registre cada visita pelo celular: fotos direto da câmera, o que foi visto e o que ficou pendente.</>,
      <>O relatório sai em PDF com a sua marca e aparece na página do cliente.</>,
    ],
  },
  {
    n: '08',
    icon: 'trend',
    title: 'Entregue e veja o lucro real',
    when: 'Projeto concluído.',
    where: { path: ['demandas', 'abrir o projeto', 'lucro'], page: 'projetos' },
    todo: [
      <>Marque como <b>entregue</b>; as parcelas que faltam viram <b>a cobrar</b>.</>,
      <>Na aba <b>lucro</b>, lance custos (taxas, impressões, deslocamento) e horas: o sistema mostra quanto rendeu cada hora sua.</>,
    ],
  },
]

/* Mapa do que existe em cada plano: um toque abre a tela. */
const TOOLS: { icon: IconName; name: string; text: string; page: string; feature?: Feature }[] = [
  { icon: 'users', name: 'clientes', text: 'ficha com histórico, projetos e documentos', page: 'clientes' },
  { icon: 'folder', name: 'demandas', text: 'quadro com prazos e urgência automática', page: 'projetos' },
  { icon: 'file', name: 'orçamentos', text: 'sua tabela de preços, texto pronto para o WhatsApp', page: 'orcamentos' },
  { icon: 'wallet', name: 'financeiro', text: 'parcelas, despesas e metas do mês', page: 'financeiro' },
  { icon: 'calendar', name: 'agenda', text: 'prazos, pagamentos e compromissos', page: 'agenda' },
  { icon: 'printer', name: 'PDF e recibos', text: 'proposta e recibo com a sua identidade', page: 'orcamentos', feature: 'propostaPdf' },
  { icon: 'pen', name: 'contratos', text: 'preenchidos com os dados do orçamento', page: 'contratos', feature: 'contratos' },
  { icon: 'instagram', name: 'instagram', text: 'calendário de posts com artes prontas', page: 'instagram', feature: 'instagram' },
  { icon: 'smartphone', name: 'agenda no celular', text: 'tudo aparece no calendário do telefone', page: 'agenda', feature: 'agendaCelular' },
  { icon: 'clip', name: 'briefing online', text: 'o cliente responde pelo link, com imagens', page: 'briefings', feature: 'briefing' },
  { icon: 'layers', name: 'etapas e cronograma', text: 'seu processo com prazo e parcela por etapa', page: 'processos', feature: 'cronograma' },
  { icon: 'link', name: 'página do cliente', text: 'o cliente acompanha o projeto pelo celular', page: 'projetos', feature: 'portal' },
  { icon: 'hardhat', name: 'obra', text: 'visitas com fotos e relatório em PDF', page: 'projetos', feature: 'obra' },
  { icon: 'trend', name: 'lucro', text: 'custos e horas de cada projeto', page: 'projetos', feature: 'lucro' },
  { icon: 'ruler', name: 'documentos', text: 'guia de medição, placa com QR, apresentação', page: 'documentos', feature: 'documentos' },
]

const firstPlanWith = (f?: Feature): PlanId => (f ? PLAN_LIST.find((p) => p.features.includes(f))?.id ?? 'estudio' : 'essencial')

const CASES: { q: string; a: ReactNode; page?: string; owner?: boolean; plan?: PlanId; top?: boolean }[] = [ // owner: só aparece para a dona; plan: a partir de qual plano
  {
    q: 'A cliente pediu algo a mais depois de fechar',
    top: true,
    a: <>Na demanda, em <b>pagamentos → + adicional</b>. Escolha somar na parcela em aberto (ex.: saldo) ou cobrar à parte. Vale para qualquer serviço; quando for por unidade (o mais comum: imagens), marque <b>calcular por quantidade</b> (ex.: 15 × R$ 35,00).</>,
    page: 'projetos',
  },
  {
    q: 'Quero lançar orçamentos antigos (do ano todo)',
    owner: true,
    a: <>No orçamento, em <b>nº e data</b> (em dados), coloque o número e a data reais. A contagem é contínua: o próximo novo pega o maior número já usado + 1 (dá para escolher o início em configurações → propostas). Ao aprovar, coloque em <b>fechou em</b> o dia em que a cliente aprovou (pode ser dias depois do orçamento; dá para corrigir depois no próprio orçamento) e marque <b>o sinal já foi pago</b>, se for o caso. Assim a demanda e o financeiro de cada mês ficam certos. Pagamentos seguintes: na demanda, marque pago e ajuste a data ao lado.</>,
    page: 'orcamentos',
  },
  {
    q: 'Negociamos e fechou por outro valor',
    top: true,
    a: <>Na hora de aprovar, troque o valor em <b>Fechou por quanto?</b>. A lista de orçamentos mostra o valor fechado com o proposto riscado.</>,
    page: 'orcamentos',
  },
  {
    q: 'Pacote com vários projetos e ela cancelou um',
    a: <>Na demanda, seção <b>pacote → cliente cancelou</b> no projeto cancelado e escolha a data. Nada é apagado: o projeto fica riscado com a data, o orçamento continua como foi enviado (com um aviso) e o desconto e o saldo são recalculados. <b>voltar</b> desfaz. <b>copiar resumo</b> monta a mensagem explicando a conta.</>,
    page: 'projetos',
  },
  {
    q: 'Fechei um pacote que não veio de orçamento',
    a: <>Crie a demanda (<b>+ novo → Demanda</b>), abra e clique em <b>pagamentos → pacote</b>. Liste os projetos e o desconto.</>,
    page: 'projetos',
  },
  {
    q: 'Quero mudar o texto das mensagens',
    top: true,
    a: <><b>configurações → aba mensagens</b> (no computador). As palavras entre chaves, como {'{cliente}'} e {'{valor}'}, são preenchidas sozinhas. Na barrinha em cima de cada texto: <b>N</b> (negrito), <b>I</b> (itálico), <b>S</b> (riscado) e emojis; embaixo aparece como vai ficar no WhatsApp.</>,
    page: 'config',
  },
  {
    q: 'Mudar preço da tabela, dados da proposta ou cores do PDF',
    a: <><b>configurações → aba preços</b> e <b>aba propostas</b> (modelo do PDF), só no computador. Seus dados (nome, logo, pix, contatos do rodapé) ficam no <b>perfil</b>, que abre pelo seu nome no pé do menu, também no celular.</>,
    page: 'config',
  },
  {
    q: 'Mudar a fase de uma demanda',
    top: true,
    a: <>Pelo status no cartão, na lista, dentro da demanda ou arrastando entre colunas. Nas trocas importantes o sistema pergunta antes: ao <b>entregar</b>, a data de entrega, o que já foi pago e se conclui as etapas; ao ir para <b>em execução</b>, se o sinal já foi pago; ao <b>cancelar</b>, pede confirmação. O cartão mostra o cliente, o nº da proposta e o prazo em palavras (faltam X dias, entrega hoje, atrasado X dias).</>,
  },
  {
    q: 'Conversar com a IA (chat)',
    a: <>O botão <b>✦</b> no canto da tela abre o <b>assistente</b>: um chat (dá para anexar fotos, PDF e prints que o cliente mandou, no clipe ou arrastando) que conhece sua tabela, plantas com valores, seu processo e seus orçamentos. Ele usa o Gemini com uma chave gratuita sua (<b>configurações → assistente</b>, onde também dá para escrever suas regras). A qualquer momento, <b>levar a conversa para o Claude</b> abre o Claude com tudo escrito.</>,
  },
  {
    q: 'Pedir ajuda à IA para montar um orçamento',
    a: <>Em <b>orçamentos</b> (ou dentro de um orçamento), toque em <b>perguntar à IA</b> e cole o que o cliente pediu. O sistema junta sua tabela de preços e seus orçamentos anteriores e abre o Claude com a pergunta já escrita: é só enviar. Ele sugere escopo, valor (comparando com orçamentos parecidos), perguntas para o cliente, o "não inclui" e uma mensagem pronta. Sem custo, usando a sua conta do Claude.</>,
  },
  {
    q: 'Passar orçamentos antigos para o sistema',
    owner: true,
    a: <>Em <b>configurações → dados → importar (backup ou orçamentos)</b>, escolha o arquivo de orçamentos (.json). Eles entram como <b>rascunho</b>, sem apagar nada; os clientes que faltam são criados e os que já existem são pulados. Depois é só marcar aprovado ou não fechou em cada um. Para mudar vários de uma vez (rascunho, enviado, aprovado, não fechou ou excluir), marque a caixinha ao lado do número e use a barra que aparece. Aprovado em lote só registra o resultado (não cria demanda). No topo da lista, a barra colorida mostra quantos estão em cada status e a porcentagem.</>,
  },
  {
    q: 'Ver os compromissos no calendário do celular',
    a: <>É opcional. Em <b>agenda → conectar ao celular</b>, escolha o que vai (prazos de entrega, dias de produção pintados, parcelas a receber, compromissos), toque em <b>ligar</b> e adicione no celular uma vez. No iPhone, deixe <b>“Remover alertas” desligado</b> e em Ajustes → Calendário → Contas → <b>Buscar dados</b> escolha a cada 15 minutos ou de hora em hora. Daí em diante tudo que você cria ou muda aqui aparece sozinho lá, com lembrete 2 dias antes, na véspera e no dia. Para deixar algo de fora: no compromisso, desmarque <b>mandar para a agenda do celular</b>; na demanda, toque em <b>tirar</b> embaixo do prazo.</>,
    page: 'agenda',
  },
  {
    q: 'Lançar um gasto (software, equipamento, curso…)',
    top: true,
    a: <><b>+ novo → Despesa</b>. Aparece no financeiro e entra no lucro do mês.</>,
    page: 'financeiro',
  },
  {
    q: 'Quero ver o sistema preenchido de exemplo',
    a: <>No computador, o <b>olho</b> no rodapé do menu (ao lado da lua) mostra o exemplo sem mexer nos seus dados. Clique de novo para voltar.</>,
  },
  {
    q: 'O que quer dizer “no fechamento”, “na conclusão” e “a cobrar”?',
    a: <>Não existe vencimento por data. Cada parcela diz <b>quando</b> é paga: o sinal <b>no fechamento</b> e o saldo <b>na conclusão</b> (dá para trocar na tabela de pagamentos da demanda). Ela vira <b>a cobrar</b> quando já pode ser cobrada: sinal ainda não pago, ou saldo com a demanda em “em aprovação” ou “entregue”. Aparece no início, no financeiro e no número do menu.</>,
    page: 'financeiro',
  },
  {
    q: 'O que fica só no computador?',
    a: <>Para o celular ficar enxuto, algumas coisas aparecem só no computador: os gráficos (início e financeiro), as abas <b>preços</b>, <b>propostas</b>, <b>mensagens</b> e <b>metas</b> das configurações, as cores e fontes da aba <b>aparência</b> e o <b>olho</b> do exemplo. No celular fica o dia a dia: para fazer, demandas, clientes, pagamentos e agenda, além do tema claro/escuro e do backup.</>,
  },
  {
    q: 'Não acho uma cliente, demanda ou orçamento',
    top: true,
    a: <>Use a <b>busca</b> no topo (ou Ctrl + K no computador). Procura por nome, empresa, título e número.</>,
  },
]

CASES.push(
  {
    q: 'Mandar o contrato para o cliente assinar',
    top: true,
    plan: 'completo',
    a: <>No contrato, seção <b>assinatura</b>. <b>Pelo link do traço</b>: crie o link e mande no WhatsApp; o cliente lê, digita nome e CPF e aceita, e manda a confirmação de volta. Cole essa mensagem em <b>registrar assinatura</b>: o contrato fica assinado e a assinatura aparece no PDF. Quer validade reforçada? Use <b>por um site de assinatura</b> (gov.br, ZapSign, Clicksign…): baixe o PDF, assine lá e registre aqui quando voltar.</>,
    page: 'contratos',
  },
  {
    q: 'Cadastrar um cliente antigo (trabalho que já terminou)',
    top: true,
    a: <>No orçamento, em <b>nº e data</b>, marque <b>orçamento antigo, sem número</b> e coloque a data em que o trabalho foi feito e aprove. A conclusão e os pagamentos vêm com essa mesma data, já como pagos; dá para mudar qualquer um. No <b>financeiro</b>, o aviso de trabalhos antigos lança tudo de uma vez.</>,
    page: 'financeiro',
  },
  {
    q: 'Excluí uma demanda e ela voltou',
    a: <>Isso acontecia quando outro aparelho aberto com dados antigos salvava por cima. Agora o que é excluído fica marcado e não volta. Se estiver no <b>modo exemplo</b> (olho no pé do menu), nada é salvo: saia dele antes de excluir.</>,
    page: 'projetos',
  },
  {
    q: 'O cliente respondeu o briefing e não apareceu',
    top: true,
    plan: 'estudio',
    a: <>No fim do formulário, se a nuvem não confirmar, o cliente envia pelo WhatsApp uma mensagem com o <b>código das respostas</b>. Copie a mensagem inteira e cole em <b>briefings → colar respostas</b>: tudo entra na ficha.</>,
    page: 'briefings',
  },
  {
    q: 'Onde ficam os documentos que salvei?',
    plan: 'estudio',
    a: <>Na <b>ficha do cliente</b>, em documentos (abra para editar ou baixar de novo). Documento salvo sem cliente vira o seu padrão, e aparece na próxima vez que abrir aquele tipo.</>,
    page: 'documentos',
  },
  {
    q: 'Numeração dos orçamentos (e os que mandei só pelo WhatsApp)',
    owner: true,
    a: <>Deixe o nº em <b>0</b>: ao salvar, o sistema escolhe pela data. Enviado ocupa o número vago daquela época, rascunhos se reorganizam e os já enviados nunca mudam. Para arrumar tudo de uma vez: <b>orçamentos → organizar nº</b>.</>,
    page: 'orcamentos',
  },
  {
    q: 'Ver outro mês no financeiro',
    a: <>Clique no mês no <b>gráfico dos últimos 12 meses</b> (ou use as setas ao lado do nome do mês): a página toda mostra aquele mês.</>,
    page: 'financeiro',
  },
  {
    q: 'Planejar os posts do Instagram',
    a: <>Em <b>instagram</b>: <b>planejar mês</b> monta o calendário com ideias prontas (carrossel, reels, story, post). Cada post tem a arte pronta para baixar em PNG, PDF ou .pptx (abre no Canva para editar). O que é para postar hoje aparece no início.</>,
    page: 'instagram',
  },
  {
    q: 'Baixar o PDF',
    a: <><b>baixar PDF</b> baixa direto, com as cores do modelo. Precisa do texto em vetor (selecionável)? <b>mais ⋯ → PDF em vetor</b> abre a janela do navegador: escolha <b>Salvar como PDF</b> (no iPhone: compartilhar → Salvar em Arquivos).</>,
  },
)

const WHERE: [string, string, string][] = [
  ['o que fazer hoje', 'início → para fazer', 'inicio'],
  ['definir ou mudar o prazo', 'demanda → card “prazo combinado” (clique na data)', 'projetos'],
  ['mudar a fase de uma demanda', 'pílula de fase (quadro, lista ou início)', 'projetos'],
  ['aprovar / recusar orçamento', 'orçamentos → pílula de status', 'orcamentos'],
  ['marcar pagamento', 'botão no cartão da demanda ou financeiro → Marcar pago', 'financeiro'],
  ['quanto tenho para receber', 'financeiro → recebimentos (filtro “A cobrar”)', 'financeiro'],
  ['recibo em PDF', 'demanda → pagamentos → ícone de impressora', 'projetos'],
  ['recibo de cobrança (o que falta pagar)', 'demanda → pagamentos → Recibo', 'projetos'],
  ['duplicar / mensagens / copiar resumo', 'orçamento → mais ⋯', 'orcamentos'],
  ['rascunhos de orçamento', 'demandas → quadro → primeira coluna', 'projetos'],
  ['dados da empresa (CNPJ) do cliente', 'cliente → editar → + dados da empresa', 'clientes'],
  ['histórico de uma cliente', 'clientes → abrir a cliente', 'clientes'],
  ['criar coluna no quadro', 'demandas → quadro → nova coluna (no fim)', 'projetos'],
  ['mudar ordem do menu', 'organizar menu (abaixo do menu)', ''],
  ['manual e configurações', 'grupo “ajustes e dicas”, no fim do menu', ''],
  ['seus dados, logo, pix e senha', 'perfil (seu nome no pé do menu)', 'perfil'],
  ['menu completo no celular', 'ícone ☰ no canto superior esquerdo', ''],
  ['modo escuro', 'lua no pé do menu (vale só para o aparelho em que você ligar)', ''],
  ['sair da conta', 'ícone de sair no pé do menu, à direita (ou perfil → conta e segurança)', ''],
  ['backup dos dados', 'configurações → aba dados', 'config'],
  ['meta mensal e cores do sistema', 'configurações → abas metas e aparência (no computador)', 'config'],
]

const ROUTINE: [string, string[]][] = [
  ['todo dia', ['Abrir o início e resolver o “para fazer”', 'Mudar a fase das demandas que andaram', 'Marcar pagamentos que caíram']],
  ['toda semana', ['Olhar orçamentos em “cobrar resposta”', 'Conferir “próximos 7 dias” no início', 'Lançar despesas da semana']],
  ['todo mês', ['Ver o financeiro: recebido, a receber e lucro', 'Baixar um backup em configurações']],
]

const PHASES = ['em alinhamento', 'em execução', 'em ajustes', 'em aprovação', 'entregue']

/** O manual em texto corrido: a IA lê para responder dúvidas de quem usa. */
const plain = (n: ReactNode): string =>
  n == null || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(plain).join('') : isValidElement(n) ? plain((n.props as { children?: ReactNode }).children) : ''
export function manualText() {
  return [
    ...STEPS.map((s) => `${s.title} (onde: ${s.where.path.join(' → ')})\n${s.todo.map((t) => `- ${plain(t)}`).join('\n')}${s.tip ? `\ndica: ${plain(s.tip)}` : ''}`),
    'Cliente final (plano Estúdio):',
    ...FINAL_STEPS.map((s) => `${s.title} (onde: ${s.where.path.join(' → ')})\n${s.todo.map((t) => `- ${plain(t)}`).join('\n')}${s.tip ? `\ndica: ${plain(s.tip)}` : ''}`),
    'Casos comuns:',
    ...CASES.map((c) => `- ${c.q}: ${plain(c.a)}`),
    'Onde fica cada coisa:',
    ...WHERE.map(([what, where]) => `- ${what}: ${where}`),
  ].join('\n')
}

const PLAN_ICON: Record<PlanId, IconName> = { essencial: 'leaf', completo: 'star', estudio: 'crown' }
const rank = (p: PlanId) => PLAN_LIST.findIndex((x) => x.id === p)

function StepList({ steps, open, setOpen, seen, plan, keyPrefix }: { steps: Step[]; open: string | null; setOpen: (v: string | null) => void; seen: string[]; plan: PlanId; keyPrefix: string }) {
  const goTo = (w?: { page?: string; id?: string }) => w?.page && go(w.page, w.id)
  return (
    <ol className="manual-steps">
      {steps.map((s) => {
        const k = keyPrefix + s.n
        const isOpen = open === k
        const locked = s.plan && rank(s.plan) > rank(plan)
        return (
          <li key={k} className={`card manual-step ${isOpen ? 'is-open' : ''} ${seen.includes(k) ? 'is-seen' : ''} ${locked ? 'is-locked' : ''}`}>
            <button className="manual-step-head" onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen}>
              <span className="manual-icon" aria-hidden>
                <Icon name={seen.includes(k) && !isOpen ? 'check' : s.icon ?? 'check'} size={18} />
              </span>
              <span className="grow">
                <span className="manual-title">
                  <span className="manual-n-small">{s.n}</span> {s.title}
                </span>
                <span className="manual-when">{s.when}</span>
              </span>
              <Icon name="chevronR" size={16} className={isOpen ? 'rot-down' : ''} />
            </button>
            {isOpen && (
              <div className="manual-body">
                <div className="manual-where">
                  <span className="muted small">onde:</span>
                  {s.where.path.map((w, i) => (
                    <span key={w} className="manual-crumb">
                      {w}
                      {i < s.where.path.length - 1 && <Icon name="chevronR" size={12} />}
                    </span>
                  ))}
                  {s.where.page && (
                    <button className="btn small" onClick={() => goTo(s.where)}>
                      ir <Icon name="chevronR" size={13} />
                    </button>
                  )}
                </div>
                <ul className="manual-todo">
                  {s.todo.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
                {s.tip && (
                  <p className="manual-tip">
                    <Icon name="sparkle" size={14} /> <span>{s.tip}</span>
                  </p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default function Manual() {
  const { isOwner, plan: myPlan } = useAccess()
  const mine: PlanId = myPlan?.id ?? 'estudio'
  const [plan, setPlan] = useKeep<PlanId>('manual-plano', mine)
  const [track, setTrack] = useKeep<'freela' | 'final'>('manual-jornada', mine === 'estudio' ? 'final' : 'freela')
  const [open, setOpen] = useKeep<string | null>('manual-aberto', null)
  const [seen, setSeen] = useKeep<string[]>('manual-visto', [])
  const toggle = (k: string | null) => {
    setOpen(k)
    if (k && !seen.includes(k)) setSeen([...seen, k])
  }
  const has = (f?: Feature) => !f || PLANS[plan].features.includes(f)
  const isFinal = track === 'final'
  const steps = isFinal ? FINAL_STEPS : STEPS
  const prefix = isFinal ? 'f' : 's'
  const done = steps.filter((s) => seen.includes(prefix + s.n)).length
  const finalLocked = isFinal && plan !== 'estudio'
  const [allCases, setAllCases] = useState(false)
  // as mais procuradas primeiro; o resto em "ver todas"
  const cases = CASES.filter((c) => (isOwner || !c.owner) && (!c.plan || rank(c.plan) <= rank(plan))).sort((a, b) => Number(!!b.top) - Number(!!a.top))

  return (
    <div className="page manual">
      <div className="page-head">
        <div>
          <p className="eyebrow">do pedido à entrega</p>
          <h1>
            manual <em>de uso</em>
          </h1>
        </div>
      </div>

      <section className="card manual-plans">
        <p className="muted small">veja o que cada plano tem {!isOwner && <>· o seu é o <b>{PLANS[mine].name}</b></>}</p>
        <div className="manual-plan-tabs" role="tablist">
          {PLAN_LIST.map((p) => (
            <button key={p.id} role="tab" aria-selected={plan === p.id} className={plan === p.id ? 'is-on' : ''} onClick={() => setPlan(p.id)}>
              <Icon name={PLAN_ICON[p.id]} size={15} />
              {p.name}
              {!isOwner && p.id === mine && <small>seu</small>}
            </button>
          ))}
        </div>
        <div className="manual-tools">
          {TOOLS.map((t) => {
            const on = has(t.feature)
            return (
              <button key={t.name} className={`manual-tool ${on ? '' : 'is-off'}`} onClick={() => on && go(t.page)} disabled={!on} title={on ? `abrir ${t.name}` : `a partir do ${PLANS[firstPlanWith(t.feature)].name}`}>
                <span className="manual-tool-icon">
                  <Icon name={on ? t.icon : 'lock'} size={16} />
                </span>
                <span className="manual-tool-text">
                  <b>{t.name}</b>
                  <small>{on ? t.text : `a partir do ${PLANS[firstPlanWith(t.feature)].name}`}</small>
                </span>
              </button>
            )
          })}
        </div>
        {TOOLS.some((t) => !has(t.feature)) && (
          <p className="manual-tools-more muted small">
            <Icon name="lock" size={13} /> mais {TOOLS.filter((t) => !has(t.feature)).length} ferramentas nos planos acima:{' '}
            {TOOLS.filter((t) => !has(t.feature))
              .map((t) => t.name)
              .join(', ')}
          </p>
        )}
      </section>

      <section className="card manual-intro">
        <div className="manual-track" role="tablist" aria-label="Jornada">
          <button role="tab" aria-selected={!isFinal} className={!isFinal ? 'is-on' : ''} onClick={() => setTrack('freela')}>
            <Icon name="briefcase" size={15} /> presto serviço para escritórios
          </button>
          <button role="tab" aria-selected={isFinal} className={isFinal ? 'is-on' : ''} onClick={() => setTrack('final')}>
            <Icon name="home" size={15} /> atendo cliente final
          </button>
        </div>
        <p>
          {isFinal ? (
            <>Do briefing à obra em <b>8 passos</b>. Tudo isso fica no plano <b>Estúdio</b>, junto com tudo dos outros planos.</>
          ) : (
            <>Cada cliente passa por <b>8 passos</b>. Siga na ordem e nada fica para trás. Toque num passo para ver o que fazer e use <b>ir</b> para abrir a tela certa.</>
          )}
        </p>
        <div className="manual-flow" aria-label="Fases da demanda">
          {(isFinal ? ['briefing', 'proposta', 'contrato', 'cronograma', 'obra', 'entregue'] : ['orçamento', ...PHASES]).map((f, i, all) => (
            <span key={f} className={`flow-step ${i === 0 ? 'flow-q' : ''}`}>
              {f}
              {i < all.length - 1 && <Icon name="chevronR" size={14} />}
            </span>
          ))}
        </div>
        <div className="manual-progress" aria-label={`${done} de ${steps.length} passos vistos`}>
          <span style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <p className="muted small manual-progress-label">
          {done === steps.length ? 'você já viu todos os passos' : `${done} de ${steps.length} passos vistos`}
          {done > 0 && (
            <button className="link" onClick={() => setSeen(seen.filter((k) => !k.startsWith(prefix)))}>
              recomeçar
            </button>
          )}
        </p>
      </section>

      {finalLocked ? (
        <section className="card manual-locked">
          <Icon name="lock" size={20} />
          <div>
            <b>Esta jornada é do plano Estúdio</b>
            <p className="muted small">Briefing online, cronograma, página do cliente, obra, lucro e documentos. {!isOwner && mine !== 'estudio' && 'Dá para mudar de plano em assinatura.'}</p>
          </div>
          <button className="btn small" onClick={() => setPlan('estudio')}>
            ver no Estúdio
          </button>
        </section>
      ) : (
        <StepList steps={steps} open={open} setOpen={toggle} seen={seen} plan={plan} keyPrefix={prefix} />
      )}

      <section className="card">
        <h3>quando acontecer…</h3>
        <div className="manual-cases">
          {cases.slice(0, allCases ? undefined : 10).map((c) => (
            <details key={c.q} className="manual-case">
              <summary>{c.q}</summary>
              <p>{c.a}</p>
              {c.page && (
                <button className="btn small ghost" onClick={() => go(c.page!)}>
                  ir <Icon name="chevronR" size={13} />
                </button>
              )}
            </details>
          ))}
        </div>
        {cases.length > 10 && (
          <button className="btn ghost small manual-more" onClick={() => setAllCases(!allCases)}>
            {allCases ? 'mostrar só as principais' : `ver todas as ${cases.length} dúvidas`}
          </button>
        )}
      </section>

      <div className="grid-2 is-even">
        <section className="card">
          <h3>onde fica cada coisa</h3>
          <ul className="manual-where-list">
            {WHERE.map(([what, where, page]) => (
              <li key={what}>
                <span>{what}</span>
                {page ? (
                  <button className="link" onClick={() => go(page)}>
                    {where}
                  </button>
                ) : (
                  <span className="muted">{where}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h3>rotina que evita esquecimento</h3>
          <div className="manual-routine">
            {ROUTINE.map(([when, items]) => (
              <div key={when}>
                <span className="eyebrow">{when}</span>
                <ul>
                  {items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
