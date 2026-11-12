# Catálogo de beleza da planê.arquivos: dados de cada produto e o conteúdo das artes.
# sub: sobrancelha e cílios | unhas | cabelo | estética | maquiagem e noivas | depilação | massagem | todos
# uso: digital | imprimir | ambos      tipo: divulgação | fichas | cuidados | atendimento | gestão | contratos
from textos_beleza import CUIDADOS

def P(id, nome, preco, sub, uso, tipo, desc, itens, formato, numeros, selo=None, destaque=False):
    return dict(id=id, nome=nome, preco=preco, sub=sub, uso=uso, tipo=tipo, desc=desc, itens=itens, formato=formato, numeros=numeros, selo=selo, destaque=destaque)

PPT = 'PowerPoint (abre no Canva e no Google Slides) + PDF'
DOC = 'Word (abre no Google Docs) + PDF para imprimir'
XLS = 'Excel · abre no Google Planilhas'

PRODUTOS = [
    # ---------- divulgação (digital) ----------
    P('beleza-stories-mes', 'Kit stories do mês', 24.9, 'todos', 'digital', 'divulgação', '20 stories com espaço para as suas fotos: agenda, horário vago, promoção, antes e depois, depoimento, dicas, avisos e mais.',
      ['20 artes de stories editáveis', 'Molduras para arrastar as suas fotos', 'Agenda, promoção, avisos, dicas, bastidores e depoimento', 'Textos prontos, é só trocar o que está entre [colchetes]'], PPT, ['20 stories', 'com espaço para foto', 'Canva'], 'mais vendido', True),
    P('beleza-antes-depois', 'Kit antes e depois', 14.9, 'todos', 'digital', 'divulgação', 'Artes para mostrar o resultado: duas fotos lado a lado, o nome do procedimento e a chamada para agendar.',
      ['4 stories e 4 posts de feed', 'Duas molduras de foto em cada arte', 'Selo com o nome do procedimento'], PPT, ['8 artes', 'stories e feed', '2 fotos por arte']),
    P('beleza-depoimentos', 'Kit depoimentos', 12.9, 'todos', 'digital', 'divulgação', 'Transforme o elogio da cliente em post: card com estrelas, foto da cliente e do resultado.',
      ['3 stories e 3 posts de feed', 'Foto da cliente e do resultado', 'Estrelas e nome editáveis'], PPT, ['6 artes', 'stories e feed']),
    P('beleza-carrossel', 'Carrossel de dicas', 16.9, 'todos', 'digital', 'divulgação', 'Carrossel de 10 páginas com dicas para o resultado durar mais, para o feed. Troque as dicas pelas do seu serviço.',
      ['Capa, 8 dicas e página final', 'Tamanho do feed (1080 x 1350)', 'Textos prontos e editáveis'], PPT, ['10 páginas', 'feed']),
    P('beleza-destaques', 'Capas de destaques', 9.9, 'todos', 'digital', 'divulgação', 'Capas para os destaques do Instagram: agenda, valores, cuidados, resultados, depoimentos, local, dúvidas e cursos.',
      ['8 capas de destaques', 'Cores e palavras editáveis'], PPT, ['8 capas']),
    # ---------- atendimento ----------
    P('beleza-politica', 'Política de atendimento', 9.9, 'todos', 'ambos', 'atendimento', 'Sinal, atrasos, faltas, remarcação e pagamento numa folha bonita para a recepção e num stories para mandar.',
      ['Folha A4 para imprimir', 'Versão para WhatsApp e stories', 'Regras prontas para ajustar'], f'{DOC} + stories', ['A4', 'stories']),
    P('beleza-cartao-agendamento', 'Cartão de agendamento', 12.9, 'todos', 'ambos', 'atendimento', 'Cartão "seu próximo horário" para entregar no balcão e versão digital para mandar no WhatsApp.',
      ['Cartão frente e verso (85 x 55 mm)', 'Folha com 8 cartões para imprimir', 'Stories "seu próximo horário"'], PPT, ['frente e verso', '8 por folha', 'stories']),
    P('beleza-recibo', 'Recibo de serviço', 9.9, 'todos', 'ambos', 'atendimento', 'Recibo para entregar impresso ou mandar em PDF depois do atendimento.',
      ['Recibo com espaço para a logo', 'Word e PDF'], DOC, ['A4', 'PDF']),
    P('beleza-mensagens', 'Mensagens prontas do atendimento', 12.9, 'todos', 'digital', 'atendimento', 'Confirmação, lembrete, pós-atendimento, avaliação, aniversário e quem sumiu: as mensagens do dia a dia prontas.',
      ['7 mensagens para o WhatsApp', 'Para copiar e colar'], 'Word (abre no Google Docs) + PDF', ['7 mensagens']),
    P('beleza-certificado', 'Certificado de curso', 12.9, 'todos', 'ambos', 'atendimento', 'Certificado para cursos e workshops: imprima ou mande em PDF para as alunas.',
      ['Certificado A4 deitado', 'Espaço para a logo e a assinatura'], PPT, ['A4', 'editável']),
    P('beleza-biosseguranca', 'Checklist de biossegurança', 9.9, 'todos', 'imprimir', 'atendimento', 'Rotina de limpeza e esterilização para deixar no espaço, com o controle da autoclave.',
      ['Antes, durante e depois do atendimento', 'Controle de ciclos da autoclave'], DOC, ['A4']),
    # ---------- sobrancelha e cílios ----------
    P('sob-cuidados', 'Cuidados pós · sobrancelha e cílios', 14.9, 'sobrancelha e cílios', 'ambos', 'cuidados', 'Cuidados de design, henna, brow lamination, lash lifting e extensão de cílios, em cartão para imprimir e stories para mandar.',
      ['4 cartões A6 (4 por folha A4)', '4 stories de cuidados', 'Folha A4 com todos os cuidados'], f'{PPT} + Word', ['4 procedimentos', 'imprimir e digital'], 'essencial'),
    P('sob-visagismo', 'Ficha de visagismo de sobrancelha', 14.9, 'sobrancelha e cílios', 'imprimir', 'fichas', 'Mapeamento do rosto com medidas, formato e escolhas da cliente, para repetir o desenho certo no retorno.',
      ['Desenho do rosto para marcar', 'Tabela de medidas dos dois lados', 'Anamnese rápida'], DOC, ['A4', 'mapa do rosto']),
    P('cil-mapeamento', 'Ficha de extensão de cílios', 14.9, 'sobrancelha e cílios', 'imprimir', 'fichas', 'Anamnese, mapa dos olhos por região e registro de cada manutenção.',
      ['Mapa dos olhos por região', 'Curvatura, espessura e cola', 'Registro das manutenções'], DOC, ['A4', 'mapa dos olhos']),
    # ---------- unhas ----------
    P('unha-cuidados', 'Cuidados pós · unhas', 12.9, 'unhas', 'ambos', 'cuidados', 'Cuidados de alongamento, esmaltação em gel, pés e mãos, em cartão e stories.',
      ['3 cartões A6', '3 stories', 'Folha A4'], f'{PPT} + Word', ['3 procedimentos']),
    P('unha-catalogo', 'Catálogo de modelos de unhas', 14.9, 'unhas', 'digital', 'divulgação', 'Mostre os seus modelos: grades com 6 fotos, legenda e preço, para o feed e os stories.',
      ['4 páginas de feed e 2 stories', '6 fotos por página', 'Legenda e valor em cada modelo'], PPT, ['6 páginas', '6 fotos por página']),
    # ---------- cabelo ----------
    P('cab-anamnese', 'Anamnese capilar', 14.9, 'cabelo', 'imprimir', 'fichas', 'Histórico de química, couro cabeludo, teste de mecha e o que a cliente quer, antes de qualquer química.',
      ['Saúde e couro cabeludo', 'Histórico de química de 12 meses', 'Teste de mecha'], DOC, ['A4']),
    P('cab-cuidados', 'Cuidados pós · cabelo', 12.9, 'cabelo', 'ambos', 'cuidados', 'Cuidados de progressiva, coloração e loiros, em cartão e stories.',
      ['3 cartões A6', '3 stories', 'Folha A4'], f'{PPT} + Word', ['3 procedimentos']),
    P('cab-tecnica', 'Ficha técnica de coloração', 12.9, 'cabelo', 'imprimir', 'fichas', 'Fórmula, oxidante, pausa e resultado de cada atendimento, para repetir a cor com segurança.',
      ['Tabela de fórmulas', 'Tratamento e home care'], DOC, ['A4']),
    # ---------- estética ----------
    P('est-avaliacao', 'Avaliação facial e corporal', 17.9, 'estética', 'imprimir', 'fichas', 'Anamnese, mapa do rosto, mapa do corpo e medidas para acompanhar a evolução.',
      ['Avaliação facial com mapa', 'Avaliação corporal com medidas', 'Evolução na 5ª e na 10ª sessão'], DOC, ['2 fichas', 'mapas']),
    P('est-protocolo', 'Plano de tratamento e sessões', 12.9, 'estética', 'ambos', 'fichas', 'Objetivo, protocolo, datas das sessões, evolução e combinados do pacote em uma folha.',
      ['10 sessões com rubrica', 'Combinados do pacote'], DOC, ['A4']),
    P('est-cuidados', 'Cuidados pós · estética', 12.9, 'estética', 'ambos', 'cuidados', 'Cuidados de limpeza de pele, peeling, drenagem e massagem, em cartão e stories.',
      ['3 cartões A6', '3 stories', 'Folha A4'], f'{PPT} + Word', ['3 procedimentos']),
    # ---------- maquiagem e noivas ----------
    P('noiva-orcamento', 'Proposta para noivas', 16.9, 'maquiagem e noivas', 'digital', 'contratos', 'Pacotes da noiva e das madrinhas, teste, deslocamento, horários e reserva da data.',
      ['Tabela de pacotes', 'Como funciona o dia', 'Reserva com sinal'], 'Word (abre no Google Docs) + PDF', ['proposta pronta'], 'novidade'),
    P('noiva-contrato', 'Contrato de noivas', 19.9, 'maquiagem e noivas', 'ambos', 'contratos', 'Data, horários, teste, deslocamento, sinal, cancelamento e uso de imagem. Revise com um advogado antes de usar.',
      ['9 cláusulas', 'Sinal e cancelamento', 'Uso de imagem'], DOC, ['9 cláusulas']),
    P('noiva-ficha', 'Ficha e cronograma da noiva', 12.9, 'maquiagem e noivas', 'ambos', 'fichas', 'Pele, alergias, referências e o cronograma do grande dia, com quem mais vai se arrumar.',
      ['Ficha da noiva', 'Cronograma do dia'], DOC, ['A4']),
    # ---------- depilação e massagem ----------
    P('dep-ficha', 'Ficha e cuidados da depilação', 14.9, 'depilação', 'ambos', 'fichas', 'Anamnese para cera e laser, mapa das áreas e os cuidados antes e depois para entregar.',
      ['Anamnese com mapa do corpo', 'Cuidados antes e depois'], DOC, ['A4', 'mapa do corpo']),
    P('mas-ficha', 'Ficha de massoterapia', 12.9, 'massagem', 'imprimir', 'fichas', 'Anamnese com mapa do corpo para marcar dores e tensões, e o registro de cada sessão.',
      ['Mapa do corpo', 'Registro das sessões'], DOC, ['A4', 'mapa do corpo']),
    # ---------- gestão ----------
    P('beleza-precificacao', 'Planilha de precificação de serviços', 17.9, 'todos', 'digital', 'gestão', 'Quanto cobrar por serviço a partir do material, do tempo, das taxas e do lucro que você quer.',
      ['Custo de material por serviço', 'Custo do seu tempo', 'Taxas da maquininha', 'Preço sugerido e lucro'], XLS, ['contas automáticas']),
    P('beleza-estoque', 'Planilha de estoque', 12.9, 'todos', 'digital', 'gestão', 'Controle dos produtos: quanto tem, validade, o que acabar e a lista de compras sozinha.',
      ['Entradas e saídas', 'Alerta de estoque baixo e validade', 'Lista de compras automática'], XLS, ['contas automáticas']),
]

KITS = [
    ('kit-sobrancelha', 'Kit sobrancelha e cílios', 'sobrancelha e cílios', 35, ['sob-cuidados', 'sob-visagismo', 'cil-mapeamento', 'beleza-anamnese', 'beleza-termo'], 'Tudo para o atendimento de sobrancelha e cílios: fichas, termo, mapas e cuidados.'),
    ('kit-unhas', 'Kit unhas', 'unhas', 30, ['unha-cuidados', 'unha-catalogo', 'beleza-anamnese', 'beleza-precos'], 'Ficha, cuidados, catálogo de modelos e tabela de preços.'),
    ('kit-cabelo', 'Kit cabelo', 'cabelo', 30, ['cab-anamnese', 'cab-cuidados', 'cab-tecnica'], 'Anamnese capilar, ficha técnica de coloração e cuidados pós.'),
    ('kit-estetica', 'Kit estética', 'estética', 30, ['est-avaliacao', 'est-protocolo', 'est-cuidados'], 'Avaliação facial e corporal, plano de sessões e cuidados pós.'),
    ('kit-noiva', 'Kit noivas', 'maquiagem e noivas', 30, ['noiva-orcamento', 'noiva-contrato', 'noiva-ficha'], 'Proposta, contrato e ficha com o cronograma do grande dia.'),
    ('kit-divulgacao', 'Kit divulgação', 'todos', 40, ['beleza-stories-mes', 'beleza-antes-depois', 'beleza-depoimentos', 'beleza-carrossel', 'beleza-destaques'], 'Stories do mês, antes e depois, depoimentos, carrossel e capas de destaques.'),
    ('kit-gestao-beleza', 'Kit organização do espaço', 'todos', 30, ['beleza-precificacao', 'beleza-estoque', 'beleza-caixa', 'beleza-recibo', 'beleza-politica'], 'Precificação, estoque, agenda e caixa, recibo e política de atendimento.'),
]

# ---------- conteúdo das artes ----------
STORIES_MES = [
    ('capa', {'forte': 'agenda de', 'cursiva': '[mês]', 'selo': 'vagas abertas', 'cta': 'reserve o seu', 'legenda': 'horários abertos'}),
    ('agenda', {'forte': 'horários da', 'cursiva': 'semana', 'dias': [('seg', '9h · 14h'), ('ter', '10h · 16h'), ('qua', '13h'), ('qui', '9h · 15h'), ('sex', '10h'), ('sáb', '8h · 11h')], 'selo': 'chame no direct', 'cta': 'reserve'}),
    ('aviso', {'forte': 'horário', 'cursiva': 'vago hoje', 'texto': 'Abriu um horário hoje às [hora] para [serviço]. Quem chamar primeiro, leva.', 'cta': 'quero'}),
    ('capa', {'forte': 'promoção', 'cursiva': 'da semana', 'selo': '[x]% off', 'cta': 'aproveite', 'texto': '[serviço] com desconto até [dia].'}),
    ('antes_depois', {'forte': 'antes e', 'cursiva': 'depois', 'selo': '[serviço]', 'texto': 'Resultado de [procedimento].', 'cta': 'agende o seu'}),
    ('depoimento', {'forte': 'quem veio,', 'cursiva': 'amou', 'texto': '[Escreva aqui o depoimento da cliente, do jeitinho que ela mandou.]', 'cta': 'agende o seu'}),
    ('lista', {'forte': 'dicas para', 'cursiva': 'durar mais', 'itens': ['[Dica 1 sobre o seu serviço]', '[Dica 2]', '[Dica 3]']}),
    ('capa', {'forte': 'bastidores', 'cursiva': 'de hoje', 'legenda': 'um pouquinho do dia', 'cta': 'vem também'}),
    ('aviso', {'forte': 'boas-', 'cursiva': 'vindas', 'texto': 'Que alegria ter você aqui! Separei este espaço com muito carinho para cuidar de você.', 'cta': 'obrigada'}),
    ('aviso', {'forte': 'aviso de', 'cursiva': 'feriado', 'texto': 'No dia [data] o espaço fica fechado. Voltamos no dia [data] com a agenda aberta.', 'cta': 'até lá'}),
    ('aviso', {'forte': 'novos', 'cursiva': 'valores', 'texto': 'A partir de [data], os valores dos serviços serão atualizados. Horários marcados até [data] ficam com o valor atual.', 'cta': 'obrigada'}),
    ('aviso', {'forte': 'hora do', 'cursiva': 'retorno', 'texto': 'Já faz [x] dias do seu último atendimento. Bora manter o resultado em dia?', 'cta': 'agendar'}),
    ('lista', {'forte': 'sorteio', 'cursiva': 'valendo', 'itens': ['Siga @seuperfil', 'Curta o post do sorteio', 'Marque 2 amigas nos comentários', 'Resultado no dia [data]'], 'foto': False}),
    ('capa', {'forte': 'serviço', 'cursiva': 'novo', 'selo': 'novidade', 'cta': 'quero conhecer', 'texto': '[Nome do serviço]: [o que ele resolve].'}),
    ('capa', {'forte': 'prazer,', 'cursiva': 'sou [nome]', 'legenda': '[sua especialidade]', 'texto': 'Há [x] anos cuidando de [serviço] com atenção a cada detalhe.', 'cta': 'me conheça'}),
    ('lista', {'forte': 'dúvidas', 'cursiva': 'frequentes', 'itens': ['Quanto tempo dura? [resposta]', 'Dói? [resposta]', 'Preciso de algum cuidado antes? [resposta]'], 'foto': False}),
    ('lista', {'forte': 'cuidados', 'cursiva': 'depois', 'itens': ['[Cuidado 1]', '[Cuidado 2]', '[Cuidado 3]']}),
    ('capa', {'forte': 'onde', 'cursiva': 'estou', 'legenda': '[bairro · cidade]', 'texto': '[Endereço completo]\n[ponto de referência]', 'cta': 'ver no mapa'}),
    ('lista', {'forte': 'formas de', 'cursiva': 'pagamento', 'itens': ['Pix', 'Cartão de débito e crédito', 'Dinheiro', 'Pacotes em até [x] vezes'], 'foto': False}),
    ('aviso', {'forte': 'obrigada', 'cursiva': 'pela confiança', 'texto': 'Cada atendimento é especial para mim. Obrigada por escolher o meu espaço.', 'cta': 'até a próxima'}),
]
ANTES_DEPOIS = [{'forte': 'antes e', 'cursiva': 'depois', 'selo': s, 'texto': 'Resultado de [procedimento], feito em [tempo].', 'cta': 'agende o seu'} for s in ['design', 'cílios', 'unhas', 'pele']]
DEPOIMENTOS = [{'forte': f, 'cursiva': c, 'texto': '[Escreva aqui o depoimento da cliente, do jeitinho que ela mandou.]', 'cta': 'agende o seu'} for f, c in [('quem veio,', 'amou'), ('elas', 'contam'), ('feedback', 'de hoje')]]
CARROSSEL = [('capa', {'forte': 'dicas para', 'cursiva': 'durar mais', 'selo': 'salve este post', 'legenda': '[seu serviço]', 'cta': 'arraste'})] + \
    [('aviso', {'forte': f'dica {i}', 'cursiva': c, 'texto': t}) for i, (c, t) in enumerate([
        ('hidratação', '[Explique a dica em duas linhas, do jeito que você fala com as clientes.]'), ('protetor solar', '[Texto da dica.]'), ('não cutuque', '[Texto da dica.]'),
        ('produto certo', '[Texto da dica.]'), ('manutenção', '[Texto da dica.]'), ('na hora de dormir', '[Texto da dica.]'), ('água', '[Texto da dica.]'), ('paciência', '[Texto da dica.]')], 1)] + \
    [('capa', {'forte': 'gostou', 'cursiva': 'das dicas?', 'selo': 'salve e compartilhe', 'cta': 'agende o seu', 'legenda': '@seuperfil'})]
DESTAQUES = [('agenda', 'coracao'), ('valores', 'estrela'), ('cuidados', 'coracao'), ('resultados', 'estrela'), ('depoimentos', 'coracao'), ('local', 'quadrado'), ('dúvidas', 'estrela'), ('cursos', 'quadrado')]
CUIDADOS_STORIES = {k: [{'forte': 'cuidados', 'cursiva': g.lower(), 'itens': itens} for g, itens in v] for k, v in CUIDADOS.items()}
POLITICA_STORY = {'forte': 'como', 'cursiva': 'funciona', 'itens': ['Horário confirmado com sinal de [valor].', 'Tolerância de [15] minutos de atraso.', 'Remarque com [24] horas de antecedência.', 'Falta sem aviso: o sinal não volta.'], 'foto': False}
