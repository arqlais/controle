import type { BriefingQuestion, BriefingSection, BriefingTemplate, ClientProfile } from './types'
import { STYLE_ART } from './components/BriefingArt'

/* Biblioteca de briefings prontos por tipo de projeto. Tudo editável pela pessoa
   (vira a versão dela) e com texto próprio: perguntas curtas, no tom de conversa. */

type Extra = Partial<BriefingQuestion>
type QB = (sec: string) => BriefingQuestion

const q = (id: string, label: string, kind: BriefingQuestion['kind'], extra: Extra = {}): QB => (sec) => ({ id: `${sec}-${id}`, section: sec, label, kind, ...extra, ...(extra.showIf ? { showIf: { q: extra.showIf.q.includes('-') ? extra.showIf.q : `${sec}-${extra.showIf.q}`, is: extra.showIf.is } } : {}) })
const txt = (id: string, label: string, extra?: Extra) => q(id, label, 'text', extra)
const long = (id: string, label: string, extra?: Extra) => q(id, label, 'long', extra)
const one = (id: string, label: string, options: string[], extra?: Extra) => q(id, label, 'choice', { options, ...extra })
const many = (id: string, label: string, options: string[], extra?: Extra) => q(id, label, 'multi', { options, ...extra })
const photos = (id: string, label: string, tips: string[], extra?: Extra) => q(id, label, 'photos', { tips, ...extra })
const date = (id: string, label: string, extra?: Extra) => q(id, label, 'date', extra)
const yesNo = (id: string, label: string, extra?: Extra) => one(id, label, ['sim', 'não'], extra)
/** Sub-pergunta: aparece quando a pergunta `parent` (da mesma parte) tem a resposta `is`. */
const when = (parent: string, is: string): Extra => ({ showIf: { q: parent, is } })
const field = (f: keyof ClientProfile): Extra => ({ field: f })
const pics = (map: Record<string, string>): Extra => ({ optionImages: map })

type Sec = [id: string, title: string, description: string, questions: QB[]]
function T(id: string, name: string, description: string, icon: string, secs: Sec[]): BriefingTemplate {
  const sections: BriefingSection[] = secs.map(([sid, title, desc]) => ({ id: sid, title, description: desc || undefined }))
  const questions = secs.flatMap(([sid, , , list]) => list.map((f) => f(sid)))
  return { id, name, description, icon, sections, questions }
}

/* ---------- blocos que se repetem ---------- */

const STYLES = ['contemporâneo', 'clássico', 'minimalista', 'industrial', 'boho', 'rústico', 'japandi', 'escandinavo']
const styleQ = (label = 'Qual destes estilos tem mais a ver com você?') =>
  many('estilo', label, STYLES, { ...pics(Object.fromEntries(STYLES.map((s) => [s, STYLE_ART[s]]))), hint: 'Pode marcar mais de um. As imagens são só para inspirar.', ...field('style') })

const COLORS: Record<string, string> = {
  'off-white e areia': 'art:#ece4d8',
  'cinza claro': 'art:#d9d9d6',
  'verde sálvia': 'art:#9fb29a',
  'azul profundo': 'art:#2f4a63',
  'terracota': 'art:#b8674a',
  'madeira natural': 'art:#b08a63',
  'preto': 'art:#232323',
  'rosé': 'art:#d9b3aa',
}
const colorQ = (id = 'cores', label = 'Quais cores deixam você à vontade?') => many(id, label, Object.keys(COLORS), { ...pics(COLORS), other: true })

const LIGHT = [
  many('luz', 'Como imagina a iluminação?', ['luz geral no teto', 'luz indireta (sancas, fitas de LED)', 'luz de apoio (abajur, arandela)', 'pendente em destaque'], { hint: 'Pode marcar mais de uma.' }),
  one('temperatura', 'E a cor da luz?', ['amarelada e aconchegante (3000K)', 'neutra (4000K)', 'branca e fria (5000K ou mais)', 'não sei, confio em você']),
]

const place = (extra: QB[] = []): QB[] => [
  txt('local', 'Onde fica o imóvel? (bairro, cidade)', field('propertyAddress')),
  txt('metragem', 'Metragem aproximada do espaço (m²)', field('propertyArea')),
  one('posse', 'O imóvel é', ['próprio', 'alugado', 'ainda vou comprar'], field('propertyOwnership')),
  ...extra,
]

const spacePhotos = (label = 'Fotos do espaço como está hoje') =>
  photos('fotos', label, ['cada parede, de frente, com boa luz', 'o teto e o piso', 'janelas, portas e tomadas', 'o que vai ser mantido (móveis, eletros)'], { hint: 'Pode ser pelo celular. Se tiver a planta, mande uma foto dela também.' })
const refPhotos = () => photos('refs', 'Imagens de referência que você ama', ['prints do Pinterest ou do Instagram', 'fotos de lugares onde você se sentiu bem'])

const closing = (budget: string[]): QB[] => [
  txt('prazo', 'Para quando você gostaria de tudo pronto?', field('deadline')),
  one('investimento', 'Quanto pretende investir na execução (sem o projeto)?', [...budget, 'prefiro conversar'], field('investment')),
  long('obs', 'Mais alguma coisa que eu precise saber?'),
]
const HOME_BUDGET = ['até R$ 20 mil', 'R$ 20 a 50 mil', 'R$ 50 a 100 mil', 'acima de R$ 100 mil']
const ROOM_BUDGET = ['até R$ 10 mil', 'R$ 10 a 25 mil', 'R$ 25 a 50 mil', 'acima de R$ 50 mil']
const BIZ_BUDGET = ['até R$ 50 mil', 'R$ 50 a 150 mil', 'R$ 150 a 300 mil', 'acima de R$ 300 mil']

const BEDS: Record<string, string> = {
  'solteiro (88×188)': 'art:bed:88x188',
  'viúva (120×200)': 'art:bed:120x200',
  'casal (138×188)': 'art:bed:138x188',
  'queen (158×198)': 'art:bed:158x198',
  'king (186×198)': 'art:bed:186x198',
}

const fridge = [
  many('eletros', 'Quais equipamentos precisam caber?', ['geladeira', 'fogão com forno', 'cooktop', 'forno de embutir', 'micro-ondas', 'lava-louças', 'coifa ou depurador', 'adega', 'cervejeira', 'filtro de água', 'air fryer', 'cafeteira'], { other: true }),
  one('geladeira', 'Que tipo de geladeira?', ['uma porta', 'duplex (freezer em cima)', 'inverse (freezer embaixo)', 'lado a lado (side by side)', 'french door (4 portas)'], when('eletros', 'geladeira')),
  one('cooktop', 'O cooktop é', ['a gás', 'elétrico', 'de indução'], when('eletros', 'cooktop')),
  one('bocas', 'Quantas bocas?', ['2', '4', '5 ou mais'], when('eletros', 'cooktop')),
  one('lava', 'Lava-louças de quantos serviços?', ['6', '8', '12', '14'], when('eletros', 'lava-louças')),
  one('coifa', 'Coifa ou depurador', ['coifa de parede', 'coifa de ilha', 'depurador', 'não sei'], when('eletros', 'coifa ou depurador')),
  one('adega', 'Adega para quantas garrafas?', ['até 12', '12 a 30', 'mais de 30'], when('eletros', 'adega')),
  one('filtro', 'Filtro de água', ['bombona', 'filtro de parede', 'torneira com filtro'], when('eletros', 'filtro de água')),
]

/* ---------- modelos ---------- */

export const LIBRARY: BriefingTemplate[] = [
  T('studio', 'Studio / apartamento compacto', 'cada metro contando: cozinha, estar e quarto no mesmo espaço', 'cube', [
    ['basico', 'o seu studio', 'para quem é e como vai ser usado', [
      ...place(),
      one('uso', 'Para que vai ser o studio?', ['morar', 'estudante / universitário', 'Airbnb / temporada', 'alugar']),
      txt('pessoas', 'Quantas pessoas vão usar?', field('household')),
      one('hospedes', 'Que tipo de hóspede você quer atrair?', ['casal', 'viagem a trabalho', 'famílias pequenas', 'qualquer um'], when('uso', 'Airbnb / temporada')),
    ]],
    ['cozinha', 'cozinha', 'o que precisa caber', [...fridge, long('mais', 'Faltou algum equipamento? Alguma observação?')]],
    ['estar', 'estar e quarto', '', [
      one('sofa', 'Que sofá faz mais sentido?', ['sofá comum', 'sofá-cama', 'sofá retrátil', 'poltronas em vez de sofá']),
      yesNo('bancada', 'Precisa de bancada para estudar ou trabalhar?'),
      one('refeicoes', 'Onde vão fazer as refeições?', ['mesa pequena', 'bancada / península', 'mesa dobrável', 'no balcão da cozinha']),
      one('cama', 'Tamanho da cama', Object.keys(BEDS), pics(BEDS)),
      many('camaextra', 'A cama precisa ter', ['baú', 'gavetas', 'cama auxiliar', 'cabeceira com nicho'], { hint: 'Opcional.' }),
      one('armario', 'Armário do quarto', ['fechado, com portas', 'aberto (arara e nichos)', 'misto']),
    ]],
    ['banho', 'banheiro', '', [
      many('banheiro', 'O que gostaria no banheiro?', ['nicho no box', 'box até o teto', 'armário com espelho', 'toalheiro aquecido']),
      one('revest', 'O revestimento que já existe', ['manter', 'trocar', 'ainda não sei']),
    ]],
    ['estilo', 'estilo e cores', 'o que você ama e o que não quer', [
      styleQ(),
      colorQ(),
      one('clima', 'Você prefere', ['tudo neutro', 'neutro com pontos de cor', 'bem colorido']),
      yesNo('madeira', 'Gosta de madeira, mesmo em detalhes?'),
      yesNo('tapete', 'Quer tapete?'),
      long('naogosta', 'Alguma cor ou material que você não quer de jeito nenhum?'),
      long('alergia', 'Alguém tem alergia a algum tecido ou material?'),
      spacePhotos(),
      refPhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', closing(ROOM_BUDGET)],
  ]),

  T('regularizacao', 'Regularização de imóvel', 'situação do imóvel, o que precisa regularizar e os documentos que já existem', 'file', [
    ['imovel', 'o imóvel', 'onde fica e como ele é hoje', [
      txt('local', 'Endereço do imóvel (rua, número, bairro, cidade)', field('propertyAddress')),
      one('tipo', 'Que tipo de imóvel é?', ['casa', 'sobrado', 'apartamento', 'comercial', 'galpão', 'rural'], { other: true }),
      txt('terreno', 'Área do terreno (m²), se souber'),
      txt('construida', 'Área construída aproximada (m²)', field('propertyArea')),
      one('posse', 'O imóvel está no seu nome?', ['sim, escritura registrada', 'tenho só contrato de compra e venda', 'é de herança / inventário', 'não sei'], field('propertyOwnership')),
      txt('ano', 'Em que ano, mais ou menos, foi construído?'),
    ]],
    ['situacao', 'o que precisa regularizar', 'conte o que aconteceu e para que você precisa', [
      many('precisa', 'O que você precisa?', ['averbar a construção na matrícula', 'habite-se', 'aprovar o projeto na prefeitura', 'regularizar ampliação ou reforma', 'desmembrar ou unificar lote', 'AVCB (bombeiros)', 'alvará de funcionamento', 'não sei, quero orientação'], { hint: 'Pode marcar mais de uma.' }),
      many('motivo', 'Para que você precisa regularizar?', ['vender o imóvel', 'financiar ou usar de garantia', 'inventário / partilha', 'abrir empresa no local', 'recebi notificação da prefeitura', 'ficar tranquilo(a) com a documentação'], { other: true }),
      yesNo('notificacao', 'Recebeu alguma notificação ou multa da prefeitura?'),
      long('notifqual', 'Conte o que diz a notificação (e mande foto dela abaixo)', when('notificacao', 'sim')),
      yesNo('ampliou', 'O imóvel teve ampliação ou reforma depois da última planta aprovada?'),
      long('ampliouqual', 'O que foi feito? (ex.: cobriu a garagem, subiu um andar, fechou a varanda)', when('ampliou', 'sim')),
      long('obs', 'Mais alguma coisa que eu precise saber?'),
    ]],
    ['docs', 'documentos', 'o que você já tem em mãos', [
      many('tem', 'Quais destes documentos você tem?', ['matrícula atualizada do cartório', 'escritura', 'carnê do IPTU', 'planta aprovada antiga', 'habite-se antigo', 'contrato de compra e venda', 'ART / RRT de obra anterior', 'nenhum / não sei'], { hint: 'Não tem tudo? Sem problema, a gente vê juntos o que falta.' }),
      photos('fotosdocs', 'Fotos ou PDF dos documentos', ['matrícula (todas as páginas)', 'capa do carnê do IPTU', 'plantas antigas, se tiver', 'notificação da prefeitura, se tiver']),
    ]],
    ['fotos', 'fotos do imóvel', '', [
      photos('fotos', 'Fotos do imóvel como está hoje', ['a fachada, de frente para a rua', 'as laterais e os fundos', 'cada cômodo', 'a parte ampliada ou reformada, se tiver'], { hint: 'Pode ser pelo celular.' }),
    ]],
    ['prazo', 'prazo', '', [
      txt('prazo', 'Tem alguma data limite? (venda, financiamento, prazo da notificação)', field('deadline')),
    ]],
  ]),

  T('arquitetonico', 'Arquitetônico (construção ou reforma)', 'família, terreno, programa de necessidades, lazer, técnica e conceito', 'compass', [
    ['familia', 'quem vai viver aqui', '', [
      txt('local', 'Onde é o terreno ou imóvel?', field('propertyAddress')),
      txt('metragem', 'Área do terreno ou da construção (m²)', field('propertyArea')),
      long('moradores', 'Quem vai morar? Idade e profissão de cada um', field('household')),
      yesNo('acess', 'Alguém precisa de acessibilidade (cadeira de rodas, mobilidade reduzida)?'),
      long('acessqual', 'Conte um pouco: o que precisa ser pensado?', when('acess', 'sim')),
      yesNo('ajudante', 'Vai ter funcionária(o) na casa?'),
      yesNo('pets', 'Tem ou pretende ter pets?'),
      txt('petsquais', 'Quais e quantos?', { ...when('pets', 'sim'), ...field('pets') }),
      long('hobby', 'Hobbies e esportes da família'),
      long('exigencia', 'Qual é a coisa mais importante deste projeto para você?'),
      long('naogosta', 'O que você não gosta na casa onde mora hoje?'),
    ]],
    ['sonho', 'a casa dos sonhos', 'sensações e momentos', [
      many('sensacao', 'Que sensação você quer sentir em casa?', ['aconchego', 'privacidade', 'frescor', 'modernidade', 'elegância', 'liberdade']),
      many('momentos', 'Que momentos você quer viver nela?', ['jantares em família', 'churrasco com os amigos', 'tempo ao ar livre', 'silêncio e descanso', 'trabalhar de casa', 'receber muita gente']),
    ]],
    ['programa', 'ambientes', 'o programa de necessidades', [
      many('ambientes', 'Quais ambientes a casa precisa ter?', ['hall de entrada', 'sala de estar', 'sala de jantar', 'cozinha', 'despensa', 'lavanderia', 'lavabo', 'home office', 'área gourmet', 'closet', 'academia', 'sala de cinema', 'brinquedoteca', 'depósito', 'garagem'], { other: true }),
      one('suites', 'Quantas suítes?', ['1', '2', '3', '4', '5 ou mais']),
      one('pavimentos', 'Quantos pavimentos imagina?', ['térrea', '2 pavimentos', '3 ou mais', 'com subsolo', 'com terraço']),
      one('garagem', 'Garagem para quantos carros?', ['1', '2', '3 ou mais'], when('ambientes', 'garagem')),
      many('garagemextra', 'Na garagem', ['portão fechado', 'portão aberto / vazado', 'tomada para carro elétrico'], when('ambientes', 'garagem')),
      yesNo('integrados', 'Gosta de ambientes integrados?'),
      many('banho', 'Nos banheiros', ['nicho para shampoo', 'toalheiro aquecido', 'banheira', 'chuveiro de teto', 'ducha higiênica', 'lavabo externo (área da piscina)']),
    ]],
    ['cozinha', 'cozinha e gourmet', '', [
      ...fridge,
      many('gourmet', 'Na área gourmet', ['churrasqueira', 'parrilla', 'forno de pizza', 'forno a lenha', 'fogão a lenha'], when('programa-ambientes', 'área gourmet')),
      one('mesa', 'Mesa de jantar para quantos lugares?', ['4', '6', '8', '10', '12 ou mais']),
      one('mesaforma', 'Formato da mesa', ['redonda', 'oval', 'quadrada', 'retangular']),
    ]],
    ['lazer', 'lazer e técnica', '', [
      many('lazer', 'O que não pode faltar?', ['piscina', 'sauna', 'ofurô / hidro', 'lareira', 'churrasqueira externa', 'quadra', 'chuveiro externo', 'espaço para elevador no futuro']),
      one('piscina', 'Piscina de', ['concreto', 'fibra', 'vinil', 'não sei'], when('lazer', 'piscina')),
      many('piscinaextra', 'Na piscina', ['aquecida', 'com prainha', 'borda infinita', 'raia para nadar'], when('lazer', 'piscina')),
      many('tecnologia', 'Tecnologias', ['energia solar', 'aquecimento solar', 'automação', 'câmeras', 'alarme', 'som embutido', 'aspirador central', 'reúso de água']),
      many('conforto', 'Conforto', ['tratamento acústico', 'pé-direito duplo', 'jardim de inverno', 'tela mosquiteira']),
    ]],
    ['conceito', 'conceito e fachada', '', [
      many('conceito', 'Conceito da arquitetura', ['contemporâneo', 'clássico', 'rústico', 'moderno', 'americano', 'minimalista'], pics({ contemporâneo: STYLE_ART['contemporâneo'], clássico: STYLE_ART['clássico'], rústico: STYLE_ART['rústico'], moderno: STYLE_ART['moderno'], americano: STYLE_ART['americano'], minimalista: STYLE_ART['minimalista'] })),
      one('telhado', 'Telhado', ['platibanda (telhado escondido)', 'telhado aparente', 'laje / terraço']),
      many('fachada', 'Detalhes de fachada que você gosta', ['brises', 'cobogós', 'madeira', 'pedra', 'concreto aparente', 'vidro']),
      one('esquadrias', 'Esquadrias', ['alumínio preto', 'alumínio branco', 'madeira', 'tanto faz']),
      one('tons', 'A casa por fora', ['clara', 'escura', 'mista']),
      long('naomaterial', 'Algum material ou revestimento que você não gosta?'),
      photos('terreno', 'Fotos do terreno ou imóvel', ['da rua, de frente', 'dos fundos e das laterais', 'dos vizinhos', 'se tiver: planta, levantamento, escritura']),
      refPhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', [
      txt('prazo', 'Quando quer começar a obra?', field('deadline')),
      one('investimento', 'Quanto pretende investir na obra?', ['até R$ 300 mil', 'R$ 300 a 600 mil', 'R$ 600 mil a 1 milhão', 'acima de R$ 1 milhão', 'prefiro conversar'], field('investment')),
      long('obs', 'Mais alguma coisa importante?'),
    ]],
  ]),

  T('infantil', 'Dormitório infantil', 'bebê ou criança: cama, segurança, estudo, brincar e cores', 'heart', [
    ['crianca', 'quem vai dormir aqui', '', [
      txt('nome', 'Nome e idade da criança (ou previsão, se ainda vai nascer)'),
      txt('metragem', 'Metragem do quarto (m²)', field('propertyArea')),
      long('alergia', 'A criança tem alguma alergia?'),
      long('gosta', 'Do que ela gosta? (personagem, filme, livro, cor, bicho)', { hint: 'Ajuda a criar um tema sem ficar datado.' }),
      yesNo('tema', 'Quer decoração com tema?'),
      long('temaqual', 'Qual tema?', when('tema', 'sim')),
    ]],
    ['cama', 'cama e móveis', '', [
      one('cama', 'Tamanho da cama', ['mini berço (90×45)', 'berço (130×60)', ...Object.keys(BEDS)], pics({ 'mini berço (90×45)': 'art:bed:45x90', 'berço (130×60)': 'art:bed:60x130', ...BEDS })),
      many('tipo', 'A cama é', ['berço 3 em 1 (vira mini cama)', 'berço acoplado à cama dos pais', 'cama montessoriana', 'cama com baú', 'bicama', 'beliche'], { hint: 'Pode marcar mais de uma.' }),
      long('reaproveitar', 'Algum móvel que vai ficar?'),
      yesNo('tv', 'Vai ter TV no quarto?'),
      one('pol', 'De quantas polegadas?', ['32"', '40"', '43"', '50"', '55" ou mais'], when('tv', 'sim')),
      long('ar', 'Vai ter ar-condicionado? Prefere em que lugar em relação à cama?'),
    ]],
    ['rotina', 'rotina e brincar', '', [
      many('precisa', 'O que o quarto precisa ter?', ['trocador', 'poltrona de amamentação', 'baú de brinquedos', 'espaço para livros', 'mesa de estudos', 'penteadeira', 'muitos armários'], { other: true }),
      yesNo('regulavel', 'A mesa precisa ser regulável (cresce com a criança)?', when('precisa', 'mesa de estudos')),
      one('portas', 'Portas do armário', ['MDF', 'palhinha / telinha', 'vidro', 'espelho', 'tecido'], when('precisa', 'muitos armários')),
    ]],
    ['estilo', 'cores e estilo', '', [
      one('paleta', 'Que tipo de cor mais agrada?', ['tons vibrantes', 'neutros claros', 'tons pastel'], pics({ 'tons vibrantes': 'art:pal:#f4d35e,#ee964b,#f95738,#0d3b66', 'neutros claros': 'art:pal:#f3eee7,#e3d8ca,#c9b7a2,#8a7967', 'tons pastel': 'art:pal:#f8e1e7,#cde7e3,#e9dcf2,#f3d9b1' })),
      many('cores', 'Cores de destaque', ['azul', 'verde', 'nude', 'cinza', 'rosa', 'amarelo'], pics({ azul: 'art:#3b5a78', verde: 'art:#8fb39b', nude: 'art:#d8c7b3', cinza: 'art:#cfcfcf', rosa: 'art:#e3b5b8', amarelo: 'art:#f0d27a' })),
      long('naocor', 'Alguma cor que não pode?'),
      one('janela', 'Na janela', ['cortina', 'persiana', 'blackout', 'os dois']),
      one('cabeceira', 'Cabeceira', ['estofada', 'de madeira / MDF', 'sem cabeceira']),
      ...LIGHT,
      styleQ(),
      spacePhotos('Fotos do quarto hoje'),
      refPhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', closing(ROOM_BUDGET)],
  ]),

  T('casal', 'Dormitório de casal / suíte', 'cama, armários, closet, iluminação e descanso', 'sofa', [
    ['uso', 'o quarto de vocês', '', [
      txt('metragem', 'Metragem do quarto (m²)', field('propertyArea')),
      long('rotina', 'Como é a rotina? (quem acorda cedo, quem lê antes de dormir, quem trabalha no quarto)', field('routine')),
      long('incomoda', 'O que mais incomoda no quarto hoje?'),
    ]],
    ['moveis', 'cama e móveis', '', [
      one('cama', 'Tamanho da cama', Object.keys(BEDS), pics(BEDS)),
      one('cabeceira', 'Cabeceira', ['estofada', 'madeira / ripado', 'painel até o teto', 'sem cabeceira']),
      many('precisa', 'O que precisa ter?', ['criados-mudos', 'poltrona de leitura', 'penteadeira', 'bancada de trabalho', 'TV', 'closet', 'armário com portas'], { other: true }),
      one('pol', 'TV de quantas polegadas?', ['43"', '50"', '55"', '65" ou mais'], when('precisa', 'TV')),
      one('closet', 'Closet', ['aberto', 'com portas de vidro', 'fechado'], when('precisa', 'closet')),
      one('janela', 'Na janela', ['cortina de tecido', 'persiana', 'blackout', 'cortina + blackout']),
    ]],
    ['estilo', 'estilo, cores e luz', '', [styleQ(), colorQ(), ...LIGHT, spacePhotos('Fotos do quarto hoje'), refPhotos()]],
    ['prazo', 'prazo e investimento', '', closing(ROOM_BUDGET)],
  ]),

  T('adolescente', 'Quarto de adolescente', 'estudo, games, amigos, armário e um quarto que acompanha a idade', 'star', [
    ['quem', 'quem vai usar', '', [
      txt('idade', 'Idade e o que a pessoa curte (música, esporte, séries, games)'),
      txt('metragem', 'Metragem do quarto (m²)', field('propertyArea')),
      long('opiniao', 'O que o próprio adolescente pediu? (vale colar a lista dele)'),
    ]],
    ['usos', 'como o quarto é usado', '', [
      one('cama', 'Tamanho da cama', Object.keys(BEDS), pics(BEDS)),
      many('precisa', 'O que precisa ter?', ['mesa de estudos', 'setup de games', 'espaço para instrumento', 'cama auxiliar para amigos', 'penteadeira', 'estante / prateleiras', 'TV', 'puff ou poltrona'], { other: true }),
      one('monitores', 'Quantos monitores no setup?', ['1', '2', '3 ou mais'], when('precisa', 'setup de games')),
      one('pol', 'TV de quantas polegadas?', ['32"', '43"', '50"', '55" ou mais'], when('precisa', 'TV')),
      one('luz', 'Iluminação', ['clara para estudar', 'fita de LED colorida', 'as duas']),
    ]],
    ['estilo', 'estilo e cores', '', [styleQ(), colorQ(), spacePhotos('Fotos do quarto hoje'), refPhotos()]],
    ['prazo', 'prazo e investimento', '', closing(ROOM_BUDGET)],
  ]),

  T('varanda', 'Varanda', 'estar, gourmet, plantas, sol e chuva', 'leaf', [
    ['uso', 'como a varanda é usada', '', [
      txt('metragem', 'Metragem da varanda (m²)', field('propertyArea')),
      many('usos', 'A varanda vai ser para', ['descansar e ler', 'receber amigos', 'refeições', 'churrasco', 'crianças e pets', 'home office', 'plantas e horta']),
      one('fechada', 'A varanda é', ['aberta', 'fechada com vidro', 'quero fechar']),
      one('sol', 'Bate sol?', ['a manhã toda', 'a tarde toda', 'o dia inteiro', 'quase não bate']),
    ]],
    ['itens', 'o que precisa ter', '', [
      many('itens', 'Gostaria de', ['churrasqueira', 'bancada com pia', 'mesa de jantar', 'sofá / lounge', 'rede ou balanço', 'jardim vertical', 'deck de madeira', 'cortina ou persiana'], { other: true }),
      one('churras', 'Churrasqueira', ['a carvão', 'elétrica', 'a gás', 'já existe'], when('itens', 'churrasqueira')),
      one('lugares', 'Mesa para quantos lugares?', ['2', '4', '6', '8 ou mais'], when('itens', 'mesa de jantar')),
      one('plantas', 'Com plantas?', ['muitas', 'algumas, fáceis de cuidar', 'nenhuma']),
    ]],
    ['estilo', 'estilo', '', [styleQ(), colorQ(), spacePhotos('Fotos da varanda hoje'), refPhotos()]],
    ['prazo', 'prazo e investimento', '', closing(ROOM_BUDGET)],
  ]),

  T('cozinha', 'Cozinha', 'como vocês cozinham, eletros, bancadas e armários', 'box', [
    ['uso', 'como a cozinha é usada', '', [
      one('frequencia', 'Com que frequência cozinham?', ['todo dia, de verdade', 'o básico do dia a dia', 'quase nunca']),
      txt('quem', 'Quem cozinha? Quantas pessoas usam ao mesmo tempo?'),
      one('integrada', 'A cozinha é ou vai ser integrada à sala?', ['sim', 'não', 'quero integrar']),
      one('formato', 'Formato que imagina', ['linear', 'em L', 'em U', 'com ilha', 'com península', 'não sei']),
    ]],
    ['eletros', 'eletros e equipamentos', '', [...fridge, long('mais', 'Faltou algum equipamento?')]],
    ['armarios', 'bancadas e armários', '', [
      one('bancada', 'Bancada', ['quartzo', 'granito', 'porcelanato', 'mármore', 'não sei, quero sugestões']),
      one('cuba', 'Cuba', ['simples', 'dupla', 'cuba esculpida', 'gourmet com misturador']),
      many('guardar', 'O que precisa guardar?', ['panelas grandes', 'mantimentos (despensa)', 'louças de festa', 'eletroportáteis', 'garrafas e taças']),
      many('extras', 'Gostaria de', ['torre quente (forno + micro)', 'lixeira embutida', 'cantinho do café', 'nicho para temperos', 'iluminação sob os armários']),
    ]],
    ['estilo', 'estilo e cores', '', [styleQ(), colorQ(), spacePhotos('Fotos da cozinha hoje'), refPhotos()]],
    ['prazo', 'prazo e investimento', '', closing(ROOM_BUDGET)],
  ]),

  T('gourmet', 'Área gourmet', 'churrasqueira, bancada, mesa e receber os amigos', 'users', [
    ['uso', 'como vocês recebem', '', [
      txt('metragem', 'Metragem do espaço (m²)', field('propertyArea')),
      one('pessoas', 'Quantas pessoas recebem, em média?', ['até 8', '8 a 15', '15 a 30', 'mais de 30']),
      one('coberta', 'O espaço é', ['coberto', 'descoberto', 'parte coberto']),
      one('integracao', 'Fica ligado a', ['cozinha', 'sala', 'piscina / jardim', 'isolado']),
    ]],
    ['equip', 'equipamentos', '', [
      many('equip', 'O que precisa ter?', ['churrasqueira', 'parrilla', 'forno de pizza', 'forno a lenha', 'fogão a lenha', 'cooktop', 'cervejeira', 'adega', 'frigobar', 'geladeira', 'lava-louças', 'pia com cuba grande', 'TV'], { other: true }),
      one('churras', 'Churrasqueira', ['a carvão', 'a gás', 'elétrica', 'pré-moldada', 'em alvenaria'], when('equip', 'churrasqueira')),
      one('revest', 'Revestimento da churrasqueira', ['tijolinho', 'pedra natural', 'porcelanato', 'mármore', 'cimento queimado', 'madeira'], when('equip', 'churrasqueira')),
      one('cerv', 'Cervejeira', ['compacta', 'vertical (200 L ou mais)'], when('equip', 'cervejeira')),
    ]],
    ['mesa', 'mesa e conforto', '', [
      one('lugares', 'Mesa para quantos lugares?', ['6', '8', '10', '12', '14 ou mais']),
      one('forma', 'Formato', ['retangular', 'redonda', 'oval', 'quadrada']),
      many('conforto', 'Conforto', ['banquetas na bancada', 'sofá / lounge', 'ventilador de teto', 'aquecedor externo', 'som ambiente']),
    ]],
    ['estilo', 'estilo', '', [styleQ(), colorQ(), spacePhotos(), refPhotos()]],
    ['prazo', 'prazo e investimento', '', closing(ROOM_BUDGET)],
  ]),

  T('living', 'Living (estar e jantar)', 'sofá, TV, jantar, receber visitas e circulação', 'sofa', [
    ['uso', 'como a sala é usada', '', [
      txt('metragem', 'Metragem da sala (m²)', field('propertyArea')),
      many('usos', 'A sala é para', ['ver filmes e séries', 'receber visitas', 'jantar', 'crianças brincarem', 'trabalhar', 'ler']),
      txt('pessoas', 'Quantas pessoas sentam no dia a dia? E em dia de visita?'),
      long('incomoda', 'O que mais incomoda na sala hoje?'),
    ]],
    ['moveis', 'móveis', '', [
      one('sofa', 'Sofá', ['reto', 'em L / com chaise', 'retrátil', 'modular', 'dois sofás']),
      many('itens', 'O que precisa ter?', ['painel de TV', 'rack', 'aparador', 'bar / carrinho de bebidas', 'estante de livros', 'poltronas', 'mesa lateral', 'tapete'], { other: true }),
      one('pol', 'TV de quantas polegadas?', ['50"', '55"', '65"', '75" ou mais'], when('itens', 'painel de TV')),
      one('mesa', 'Mesa de jantar para', ['4 lugares', '6 lugares', '8 lugares', '10 ou mais']),
      one('forma', 'Formato da mesa', ['redonda', 'retangular', 'oval', 'quadrada']),
    ]],
    ['estilo', 'estilo, cores e luz', '', [styleQ(), colorQ(), ...LIGHT, spacePhotos('Fotos da sala hoje'), refPhotos()]],
    ['prazo', 'prazo e investimento', '', closing(HOME_BUDGET)],
  ]),

  T('closet', 'Closet', 'o que guardar, portas, espelho e iluminação', 'layers', [
    ['uso', 'quem usa', '', [
      txt('metragem', 'Metragem do espaço (m²)', field('propertyArea')),
      one('quem', 'O closet é', ['de uma pessoa', 'do casal', 'da família']),
      one('divisao', 'Divisão entre o casal', ['lados separados', 'tudo junto'], when('quem', 'do casal')),
    ]],
    ['guardar', 'o que guardar', 'para dimensionar cabideiros, gavetas e prateleiras', [
      many('roupas', 'O que mais tem?', ['vestidos longos', 'ternos e camisas', 'muitos sapatos', 'bolsas', 'acessórios e joias', 'roupas de cama', 'malas'], { other: true }),
      txt('sapatos', 'Quantos pares de sapato, mais ou menos?', when('roupas', 'muitos sapatos')),
      many('precisa', 'Precisa ter', ['espelho de corpo inteiro', 'penteadeira', 'ilha com gavetas', 'banco / puff', 'gaveta com chave', 'cofre', 'passadeira embutida']),
    ]],
    ['acabamento', 'acabamento', '', [
      one('portas', 'Portas', ['sem portas (aberto)', 'vidro fumê', 'vidro reflecta', 'espelho', 'MDF', 'palhinha'], pics({ 'sem portas (aberto)': STYLE_ART['minimalista'], 'vidro fumê': 'art:#5b5a58', 'vidro reflecta': 'art:#9a8f84', espelho: 'art:#cfd6da', MDF: 'art:#e6ddd1', palhinha: 'art:#c9a978' })),
      one('luz', 'Iluminação', ['fita de LED nas prateleiras', 'luz geral', 'os dois']),
      styleQ(),
      spacePhotos(),
      refPhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', closing(ROOM_BUDGET)],
  ]),

  T('banheiro', 'Banheiro', 'box, bancada, nichos, louças e metais', 'layers', [
    ['uso', 'quem usa', '', [
      one('tipo', 'É o banheiro', ['da suíte do casal', 'das crianças', 'social', 'de hóspedes']),
      long('incomoda', 'O que mais incomoda nele hoje?'),
      one('revest', 'Revestimento que já existe', ['manter', 'trocar tudo', 'trocar parte']),
    ]],
    ['itens', 'o que precisa ter', '', [
      many('itens', 'Gostaria de', ['box até o teto', 'nicho no box', 'banheira', 'chuveiro de teto', 'ducha higiênica', 'cuba dupla', 'armário com espelho', 'espelho com luz', 'toalheiro aquecido', 'piso aquecido'], { other: true }),
      one('bacia', 'Vaso sanitário', ['caixa acoplada', 'válvula (descarga na parede)', 'suspenso', 'não sei']),
      one('metais', 'Metais', ['cromado', 'preto fosco', 'dourado / latão', 'grafite', 'inox escovado']),
      long('guardar', 'O que precisa guardar no banheiro?'),
    ]],
    ['estilo', 'estilo', '', [styleQ(), colorQ(), spacePhotos('Fotos do banheiro hoje'), refPhotos()]],
    ['prazo', 'prazo e investimento', '', closing(ROOM_BUDGET)],
  ]),

  T('lavabo', 'Lavabo', 'o cartão de visita da casa: impacto em pouco espaço', 'sparkle', [
    ['basico', 'o lavabo', '', [
      txt('medidas', 'Medidas aproximadas (largura × comprimento)'),
      one('ousadia', 'Quanto de ousadia você topa?', ['discreto e elegante', 'um ponto de impacto', 'surpreendente, sem medo']),
      many('itens', 'Gostaria de', ['papel de parede', 'cuba esculpida', 'bancada em pedra', 'espelho com moldura', 'iluminação cênica', 'nicho decorativo', 'torneira de parede']),
      one('metais', 'Metais', ['cromado', 'preto fosco', 'dourado / latão', 'grafite']),
      styleQ(),
      colorQ(),
      spacePhotos('Fotos do lavabo hoje'),
      refPhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', closing(['até R$ 5 mil', 'R$ 5 a 15 mil', 'R$ 15 a 30 mil', 'acima de R$ 30 mil'])],
  ]),

  T('lavanderia', 'Lavanderia', 'máquinas, varal, passar, guardar produtos', 'leaf', [
    ['basico', 'a lavanderia', '', [
      txt('metragem', 'Metragem do espaço (m²)', field('propertyArea')),
      many('maquinas', 'Máquinas', ['lavadora', 'secadora', 'lava e seca', 'tanquinho']),
      one('empilhar', 'Lavadora e secadora', ['lado a lado', 'empilhadas'], when('maquinas', 'secadora')),
      many('precisa', 'Precisa ter', ['tanque', 'varal de teto', 'varal de chão', 'espaço para passar', 'armário para produtos', 'lugar para vassouras e aspirador', 'cesto de roupa suja embutido', 'espaço para pet'], { other: true }),
      one('integrada', 'Fica', ['fechada', 'integrada à cozinha', 'na área externa']),
      styleQ(),
      spacePhotos('Fotos da lavanderia hoje'),
    ]],
    ['prazo', 'prazo e investimento', '', closing(['até R$ 5 mil', 'R$ 5 a 15 mil', 'acima de R$ 15 mil'])],
  ]),

  T('home-office', 'Home office', 'rotina de trabalho, equipamentos, videochamadas e conforto', 'briefcase', [
    ['rotina', 'a sua rotina', '', [
      txt('profissao', 'O que você faz?', field('profession')),
      one('horas', 'Quantas horas por dia trabalha ali?', ['até 2 h', '2 a 6 h', 'o dia inteiro']),
      one('pessoas', 'Quantas pessoas trabalham no espaço?', ['só eu', '2 pessoas', '3 ou mais']),
      one('video', 'Faz videochamadas?', ['sim, muitas', 'às vezes', 'não']),
      one('fundo', 'O que aparece atrás de você importa?', ['muito', 'um pouco', 'não'], when('video', 'sim, muitas')),
    ]],
    ['equip', 'equipamentos', '', [
      many('equip', 'Equipamentos', ['notebook', '1 monitor', '2 monitores', 'impressora', 'mesa digitalizadora', 'microfone / câmera', 'arquivo de papéis'], { other: true }),
      one('mesa', 'Mesa', ['fixa', 'regulável (em pé e sentado)', 'em L']),
      many('conforto', 'Conforto', ['cadeira ergonômica', 'isolamento acústico', 'blackout', 'poltrona para pausa', 'estante / livros']),
    ]],
    ['estilo', 'estilo', '', [styleQ(), colorQ(), ...LIGHT, spacePhotos(), refPhotos()]],
    ['prazo', 'prazo e investimento', '', closing(['até R$ 8 mil', 'R$ 8 a 20 mil', 'acima de R$ 20 mil'])],
  ]),

  T('escritorio', 'Escritório corporativo', 'equipe, estações, salas, marca e fluxo de trabalho', 'building', [
    ['empresa', 'a empresa', '', [
      txt('nome', 'Nome da empresa e o que ela faz'),
      txt('equipe', 'Quantas pessoas trabalham hoje? E daqui a 2 anos?'),
      one('regime', 'O trabalho é', ['presencial', 'híbrido', 'rotativo (sem lugar fixo)']),
      ...place(),
    ]],
    ['espacos', 'espaços', '', [
      many('espacos', 'O que o escritório precisa ter?', ['recepção', 'estações de trabalho', 'salas privativas', 'sala de reunião', 'cabines para call', 'copa / café', 'área de descompressão', 'sala de servidor', 'arquivo / depósito', 'banheiros'], { other: true }),
      txt('reuniao', 'Sala de reunião para quantas pessoas?', when('espacos', 'sala de reunião')),
      txt('privativas', 'Quantas salas privativas? Para quem?', when('espacos', 'salas privativas')),
      long('fluxo', 'Como as equipes trabalham juntas? Quem precisa ficar perto de quem?'),
    ]],
    ['marca', 'marca e sensação', '', [
      photos('logo', 'Logo e identidade visual', ['logo em boa qualidade', 'manual da marca, se tiver']),
      many('sensacao', 'O que o cliente deve sentir ao entrar?', ['confiança', 'inovação', 'acolhimento', 'sofisticação', 'descontração']),
      styleQ('Qual estilo combina com a empresa?'),
      spacePhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', [date('mudanca', 'Data desejada para mudar'), ...closing(BIZ_BUDGET).slice(1)]],
  ]),

  T('clinica', 'Clínica / consultório', 'atendimento, normas sanitárias, espera e privacidade', 'heart', [
    ['clinica', 'a clínica', '', [
      one('especialidade', 'Especialidade', ['odontologia', 'estética', 'dermatologia', 'fisioterapia', 'psicologia', 'nutrição', 'medicina', 'veterinária'], { other: true }),
      txt('profissionais', 'Quantos profissionais atendem ao mesmo tempo?'),
      txt('atendimentos', 'Quantos atendimentos por dia, em média?'),
      ...place(),
    ]],
    ['espacos', 'ambientes', '', [
      many('espacos', 'O que a clínica precisa ter?', ['recepção', 'sala de espera', 'consultórios', 'sala de procedimentos', 'expurgo / esterilização', 'DML', 'copa da equipe', 'banheiro acessível', 'depósito'], { other: true }),
      txt('consultorios', 'Quantos consultórios?', when('espacos', 'consultórios')),
      long('equipamentos', 'Equipamentos específicos (cadeira odontológica, maca, autoclave, raio-x…)'),
      yesNo('vigilancia', 'Já sabe as exigências da vigilância sanitária para o seu tipo de clínica?'),
    ]],
    ['sensacao', 'sensação e marca', '', [
      many('sensacao', 'Como o paciente deve se sentir?', ['calmo', 'acolhido', 'seguro', 'em um lugar sofisticado', 'em um lugar leve e alegre']),
      photos('logo', 'Logo e identidade visual', ['logo', 'cores da marca']),
      styleQ(),
      spacePhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', [date('inauguracao', 'Data desejada de inauguração'), ...closing(BIZ_BUDGET).slice(1)]],
  ]),

  T('salao', 'Salão de beleza / estética', 'estações, lavatórios, espera, estoque e marca', 'sparkle', [
    ['negocio', 'o negócio', '', [
      many('servicos', 'Serviços oferecidos', ['cabelo', 'unhas', 'maquiagem', 'sobrancelha e cílios', 'estética facial', 'depilação', 'barbearia', 'massagem'], { other: true }),
      txt('estacoes', 'Quantas estações de corte / atendimento?'),
      txt('lavatorios', 'Quantos lavatórios?', when('servicos', 'cabelo')),
      txt('manicure', 'Quantas estações de manicure?', when('servicos', 'unhas')),
      ...place(),
    ]],
    ['espacos', 'ambientes', '', [
      many('espacos', 'Precisa ter', ['recepção com vitrine de produtos', 'espera com café', 'salas reservadas', 'estoque', 'copa da equipe', 'área de lavagem de toalhas', 'espaço instagramável'], { other: true }),
      many('sensacao', 'A cliente deve sentir', ['luxo', 'aconchego', 'modernidade', 'descontração', 'bem-estar']),
      styleQ(),
      colorQ('cores', 'Cores da marca ou que você gostaria'),
      spacePhotos(),
      refPhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', [date('inauguracao', 'Data desejada de inauguração'), ...closing(BIZ_BUDGET).slice(1)]],
  ]),

  T('restaurante', 'Restaurante / café', 'cozinha, salão, fluxo de atendimento e experiência', 'users', [
    ['negocio', 'o negócio', '', [
      one('tipo', 'O que é?', ['restaurante', 'café / padaria', 'bar', 'hamburgueria', 'pizzaria', 'doceria', 'delivery / dark kitchen'], { other: true }),
      txt('lugares', 'Quantos lugares no salão?'),
      one('servico', 'Serviço', ['à la carte', 'buffet', 'balcão', 'autoatendimento']),
      txt('horario', 'Horário de funcionamento'),
      ...place(),
    ]],
    ['cozinha', 'cozinha e apoio', '', [
      long('cardapio', 'O cardápio tem o quê? (ajuda a dimensionar a cozinha)'),
      many('equip', 'Equipamentos principais', ['fogão industrial', 'forno combinado', 'forno a lenha', 'chapa', 'fritadeira', 'câmara fria', 'máquina de café', 'coifa industrial'], { other: true }),
      many('apoio', 'Áreas de apoio', ['vestiário da equipe', 'estoque seco', 'área de lixo', 'recebimento de mercadoria', 'escritório']),
    ]],
    ['salao', 'salão e experiência', '', [
      many('areas', 'No salão', ['balcão / bar', 'mesas altas', 'sofás / booths', 'área externa', 'área kids', 'palco / música ao vivo']),
      many('sensacao', 'Que experiência o cliente deve ter?', ['aconchegante', 'rápida e prática', 'sofisticada', 'descontraída', 'instagramável']),
      photos('logo', 'Logo e identidade visual', ['logo', 'cardápio atual']),
      styleQ(),
      spacePhotos(),
      refPhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', [date('inauguracao', 'Data desejada de inauguração'), ...closing(BIZ_BUDGET).slice(1)]],
  ]),

  T('loja', 'Loja', 'vitrine, exposição, caixa, provador e estoque', 'box', [
    ['negocio', 'a loja', '', [
      txt('produto', 'O que a loja vende?'),
      long('publico', 'Quem é o seu cliente? (idade, estilo, o que procura)'),
      ...place(),
    ]],
    ['espacos', 'o espaço', '', [
      many('precisa', 'Precisa ter', ['vitrine', 'caixa / balcão', 'provadores', 'estoque', 'área de embalagem', 'espaço para eventos', 'copa', 'banheiro de clientes'], { other: true }),
      txt('provadores', 'Quantos provadores?', when('precisa', 'provadores')),
      long('expor', 'Como os produtos precisam ser expostos? (araras, prateleiras, ilhas, vitrines fechadas)'),
      many('sensacao', 'O cliente deve sentir', ['exclusividade', 'praticidade', 'descoberta', 'aconchego', 'energia']),
      photos('logo', 'Logo e identidade visual', ['logo', 'manual da marca, se tiver']),
      styleQ(),
      spacePhotos('Fotos do ponto (frente e interior)'),
      refPhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', [date('inauguracao', 'Data desejada de inauguração'), ...closing(BIZ_BUDGET).slice(1)]],
  ]),

  T('drogaria', 'Farmácia / drogaria', 'gôndolas, balcão, medicamentos controlados e normas', 'plus', [
    ['negocio', 'a farmácia', '', [
      one('tipo', 'Tipo', ['drogaria', 'farmácia de manipulação', 'rede / franquia', 'farmácia de bairro']),
      ...place(),
      txt('equipe', 'Quantas pessoas trabalham?'),
    ]],
    ['espacos', 'o espaço', '', [
      many('precisa', 'Precisa ter', ['balcão de atendimento', 'caixas', 'área de medicamentos controlados', 'sala de aplicação / serviços farmacêuticos', 'laboratório de manipulação', 'estoque', 'área de perfumaria', 'drive-thru'], { other: true }),
      txt('caixas', 'Quantos caixas?', when('precisa', 'caixas')),
      yesNo('franquia', 'Existe manual da rede / franquia a seguir?'),
      photos('manual', 'Manual ou referências da rede', ['páginas do manual de layout'], when('franquia', 'sim')),
      spacePhotos('Fotos do ponto (frente e interior)'),
    ]],
    ['prazo', 'prazo e investimento', '', [date('inauguracao', 'Data desejada de inauguração'), ...closing(BIZ_BUDGET).slice(1)]],
  ]),

  T('igreja', 'Igreja / templo', 'nave, altar, acústica, apoio e acessibilidade', 'star', [
    ['comunidade', 'a comunidade', '', [
      txt('nome', 'Nome da igreja / comunidade'),
      txt('pessoas', 'Quantas pessoas por celebração? E em datas especiais?'),
      ...place(),
    ]],
    ['espacos', 'espaços', '', [
      many('espacos', 'O que precisa ter?', ['nave / auditório', 'altar / palco', 'sala para crianças', 'salas de estudo', 'secretaria', 'cantina / cozinha', 'batistério', 'estacionamento', 'banheiros acessíveis'], { other: true }),
      many('tecnica', 'Técnica', ['tratamento acústico', 'som e projeção', 'transmissão ao vivo', 'climatização', 'iluminação cênica']),
      many('sensacao', 'Que sensação o espaço deve passar?', ['acolhimento', 'recolhimento e silêncio', 'alegria', 'grandiosidade', 'simplicidade']),
      styleQ(),
      spacePhotos(),
    ]],
    ['prazo', 'prazo e investimento', '', closing(BIZ_BUDGET)],
  ]),
]

/** Modelos que a biblioteca atualizou (os antigos com o mesmo id ficam no lugar). */
export const LIBRARY_IDS = new Set(LIBRARY.map((t) => t.id))
