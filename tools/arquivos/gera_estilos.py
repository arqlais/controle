# Gera as artes (PowerPoint) nos estilos minimalista, elegante e delicado, com os mesmos nomes do criativo + "--estilo".
# Também as peças novas (cartão de cuidados com QR code e cartão lembrança) nos quatro estilos.
import os, re, sys
from peca import nova
from estilos import EPeca, LAYOUTS_E, SERIF, SCRIPT, BODY, TEMAS
import beleza_dados as D

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'slides.py')).read()
_g = {}
exec(re.search(r'^SERV = .*?\]\)\]\n', _src, re.S | re.M).group(0), _g)
exec(re.search(r'^AVISOS = \[.*?\n\]\n', _src, re.S | re.M).group(0), _g)
SERV, AVISOS = _g['SERV'], _g['AVISOS']

def nome(base, tema): return os.path.join(OUT, f'{base}.pptx' if tema == 'criativo' else f'{base}--{tema}.pptx')

def kit(base, w, h, pecas, tema):
    p = nova(w, h)
    for lay, c in pecas: LAYOUTS_E[lay](EPeca(p, tema), c)
    p.save(nome(base, tema))

def verso(p, tema, titulo, texto, rodape):
    v = EPeca(p, tema); T = v.T
    escuro = {'minimalista': '1F1F1F', 'elegante': '15120F'}.get(tema, T['eti'])
    v.ret(0, 0, v.W, v.H, escuro)
    claro = T['ac'] if tema == 'elegante' else 'FFFFFF'
    if T['sans']: v.tx(0, v.H * 0.26, v.W, 120, titulo, BODY, 76, 'FFFFFF', 'c', b=True)
    else: v.tx(0, v.H * 0.26, v.W, 120, titulo.upper(), SERIF, 80, claro, 'c', spc=10)
    v.tx(60, v.H * 0.46, v.W - 120, 90, texto, BODY, 22, 'EDE6E2', 'c', esp=1.3)
    v.tx(0, v.H * 0.74, v.W, 50, rodape, BODY, 20, claro, 'c', spc=0 if T['sans'] else 7)

def campos(c, x, y, w, labs, passo=66):
    for i, lab in enumerate(labs):
        yy = y + i * passo
        c.tx(x, yy, 300, 40, lab if c.T['sans'] else lab.upper(), BODY, 18, c.T['mut'], 'l', spc=0 if c.T['sans'] else 5)
        c.fio(x + 300, yy + 30, w - 300, c.T['fio_l'] if c.T['sans'] else None, 1.2)

def cartao_frente(p, tema, forte, cursiva):
    f = EPeca(p, tema)
    if f.T['sans']: f.ret(24, 24, 956, 602, f.T['card'], 0.06)
    else: f.moldura(30, 30, 944, 590, None, 0.75)
    f.olho(70)
    f.titulo(502, 115, 800, forte, cursiva, 70)
    return f

def grade(pc, forte, cursiva):
    k = pc.k; W, H = pc.W, pc.H
    pc.rodape()
    y = 80 * k + pc.titulo(W / 2, 80 * k, W - 200 * k, forte, cursiva, 84 * k) + 50 * k
    cols, rows = (3, 2) if H / W < 1.5 else (2, 3)
    m = 90 * k; gap = 30 * k
    cw = (W - 2 * m - (cols - 1) * gap) / cols
    ch = (H - 170 * k - y - (rows - 1) * gap) / rows
    n = 0
    for r in range(rows):
        for col in range(cols):
            n += 1; x = m + col * (cw + gap); yy = y + r * (ch + gap)
            if pc.T['sans']: pc.ret(x - 10 * k, yy - 10 * k, cw + 20 * k, ch + 14 * k, pc.T['card'], 0.08)
            pc.foto(x, yy, cw, ch - 90 * k, 'rr' if pc.T['sans'] else 'rect', 'SUA FOTO', aro=False)
            pc.tx(x, yy + ch - 78 * k, cw, 36 * k, f'modelo {n:02d}' if pc.T['sans'] else f'MODELO {n:02d}', BODY, 20 * k, pc.T['ink'], 'c', spc=0 if pc.T['sans'] else 6 * k)
            pc.tx(x, yy + ch - 42 * k, cw, 40 * k, 'R$ 00,00', BODY if pc.T['sans'] else SERIF, 26 * k if pc.T['sans'] else 30 * k, pc.T['ac'], 'c', b=pc.T['sans'])

def cartao_pequeno(p, tema, titulo, cursiva, miolo, rodape='[SEU ESPAÇO] · @SEUPERFIL'):
    """Cartões 5,9 x 10 cm (697 x 1181): cuidados com QR code e lembrança."""
    c = EPeca(p, tema); k = c.k; W, H = c.W, c.H
    if c.T['sans']: c.ret(22, 22, W - 44, H - 44, c.T['card'], 0.05)
    else: c.moldura(26, 26, W - 52, H - 52, None, 0.75)
    y = 80
    y += c.olho(y) + 26
    y += c.titulo(W / 2, y, W - 120, titulo, cursiva, 70) + 30
    miolo(c, y)
    c.tx(0, H - 96, W, 30, rodape, BODY, 16, c.T['mut'], 'c', spc=0 if c.T['sans'] else 5)

def qr(c, y):
    W = c.W
    if c.T['sans']: c.etiqueta(W / 2, y, '[procedimento]', tam=24)
    else: c.etiqueta(W / 2, y, 'cuidados pós', tam=20)
    y += 90
    d = 400
    c.moldura(W / 2 - d / 2, y, d, d, c.T['ink'], 1.5)
    c.tx(W / 2 - d / 2, y, d, d, 'cole aqui\no seu QR code', BODY, 22, c.T['mut'], 'c', True, esp=1.2)
    c.tx(60, y + d + 30, W - 120, 80, 'Aponte a câmera do celular e veja todos os cuidados.', BODY, 20, c.T['ink'], 'c', esp=1.25)

def lembranca(c, y):
    W = c.W
    fh = 470; fw = 470 if c.T['forma'] != 'arco' else 380
    c.foto(W / 2 - fw / 2, y + 10, fw, fh, None if c.T['forma'] != 'rect' else 'rect', 'SUA FOTO')
    c.tx(60, y + fh + 50, W - 120, 120, '[Uma mensagem curta para a cliente levar com ela.]', SERIF, 30, c.T['ink'], 'c', it=True, esp=1.15)

TEMAS_E = ('minimalista', 'elegante', 'delicado')
for tema in TEMAS_E:
    kit('beleza-stories-mes', 1080, 1920, D.STORIES_MES, tema)
    kit('beleza-antes-depois-stories', 1080, 1920, [('antes_depois', c) for c in D.ANTES_DEPOIS], tema)
    kit('beleza-antes-depois-feed', 1080, 1350, [('antes_depois', c) for c in D.ANTES_DEPOIS], tema)
    kit('beleza-depoimentos-stories', 1080, 1920, [('depoimento', c) for c in D.DEPOIMENTOS], tema)
    kit('beleza-depoimentos-feed', 1080, 1350, [('depoimento', c) for c in D.DEPOIMENTOS], tema)
    kit('beleza-carrossel', 1080, 1350, D.CARROSSEL, tema)
    cores = [TEMAS[tema]['ac'], TEMAS[tema]['ink'], TEMAS[tema]['fio']]
    kit('beleza-destaques', 1080, 1920, [('destaque', {'palavra': w, 'cor': cores[i % 3]}) for i, (w, f) in enumerate(D.DESTAQUES)], tema)
    kit('beleza-politica-stories', 1080, 1920, [('lista', D.POLITICA_STORY)], tema)
    for k, v in D.CUIDADOS_STORIES.items():
        kit(f'{k}-cartoes-a6', 1240, 1748, [('lista', {**c, 'foto': False}) for c in v], tema)
        kit(f'{k}-stories', 1080, 1920, [('lista', c) for c in v], tema)
    kit('beleza-cartao-agendamento-stories', 1080, 1920, [('aviso', {'forte': 'seu próximo', 'cursiva': 'horário', 'texto': 'Dia [dd/mm] às [hora]\n[serviço]\n\nSe precisar remarcar, me avise com 24 horas de antecedência.', 'cta': 'até lá'})], tema)
    # tabela de preços e avisos de fim de ano
    grupos = [(n, itens) for n, itens in SERV]
    kit('beleza-precos-feed', 1080, 1350, [('precos', {'forte': 'tabela de', 'cursiva': 'preços', 'grupos': grupos})], tema)
    kit('beleza-precos-stories', 1080, 1920, [('precos', {'forte': 'tabela de', 'cursiva': 'preços', 'grupos': grupos})], tema)
    av = [('aviso', {'forte': a[1].strip(), 'cursiva': a[2], 'texto': a[4], 'cta': a[5].strip('[]')}) for a in AVISOS]
    kit('beleza-fim-de-ano-stories', 1080, 1920, av, tema)
    kit('beleza-fim-de-ano-feed', 1080, 1350, av, tema)

    # cartão de agendamento 85 x 55 mm, frente e verso
    p = nova(1004, 650)
    f = cartao_frente(p, tema, 'seu próximo', 'horário')
    campos(f, 110, 380, 780, ['dia', 'hora', 'serviço'])
    verso(p, tema, 'até logo', 'Se precisar remarcar, me avise com 24 horas de antecedência.', '[WHATSAPP] · @SEUPERFIL')
    p.save(nome('beleza-cartao-agendamento', tema))

    # vale-presente e cartão fidelidade
    p = nova(1004, 650)
    f = cartao_frente(p, tema, 'vale', 'presente')
    f.tx(0, 420, 1004, 50, 'um momento só seu, com carinho', BODY, 24, f.T['mut'], 'c')
    b = cartao_frente(p, tema, '', '')
    campos(b, 110, 150, 780, ['para', 'de', 'serviço ou valor', 'válido até'], 92)
    f = cartao_frente(p, tema, 'cartão', 'fidelidade')
    f.tx(0, 420, 1004, 50, 'a cada 10 atendimentos, o 11º é presente', BODY, 24, f.T['mut'], 'c')
    b = cartao_frente(p, tema, '', '')
    campos(b, 110, 90, 780, ['nome'])
    for i in range(10):
        d = 110; x = 132 + (i % 5) * 150; yy = 200 + (i // 5) * 160
        ult = i == 9
        if ult: b.ret(x, yy, d, d, b.T['eti'], 0, forma=__import__('pptx').enum.shapes.MSO_SHAPE.OVAL)
        else: b.aro(x, yy, d, d, 'circ', b.T['fio'] if b.T['sans'] else b.T['ink'], 1)
        b.tx(x, yy, d, d, 'presente' if ult else str(i + 1), BODY, 18 if ult else 26, b.T['eti_txt'] if ult else b.T['mut'], 'c', True, b=ult)
    p.save(nome('beleza-vale', tema))

    # certificado A4 deitado
    p = nova(1123, 794)
    c = EPeca(p, tema)
    if c.T['sans']: c.ret(30, 30, 1063, 734, c.T['card'], 0.04)
    else:
        c.moldura(34, 34, 1055, 726, None, 1.5); c.moldura(48, 48, 1027, 698, None, 0.5)
        c.tx(0, 40, 1123, 700, 'C', SERIF, 640, c.T['mono'], 'c', True)
    c.foto(951, 76, 110, 56, 'rect', 'SUA LOGO', aro=False)
    c.olho(90, '[NOME DO SEU ESPAÇO OU ESCOLA]')
    if c.T['sans']: yy = 140 + c.titulo(561, 140, 900, 'certificado', 'de conclusão', 90) + 16
    else:
        c.tx(0, 150, 1123, 110, 'CERTIFICADO', SERIF, 92, c.T['ink'], 'c', spc=18); yy = 262
    c.tx(0, yy, 1123, 40, 'certificamos que' if c.T['sans'] else 'CERTIFICAMOS QUE', BODY, 18, c.T['mut'], 'c', spc=0 if c.T['sans'] else 6)
    c.tx(0, yy + 34, 1123, 110, '[Nome da aluna]', SERIF if c.T['sans'] else SCRIPT, 64 if c.T['sans'] else 80, c.T['ac'], 'c', it=c.T['sans'])
    c.fio(331, yy + 140, 460, None, 1)
    c.tx(181, yy + 160, 760, 90, 'concluiu com êxito o curso de [nome do curso], com carga horária de [x] horas, em [data], em [cidade].', BODY, 20, c.T['ink'], 'c', esp=1.3)
    for i, lab in enumerate(['instrutora', 'aluna']):
        x = 191 + i * 440
        c.fio(x, 650, 300, None, 1)
        c.tx(x, 662, 300, 30, lab if c.T['sans'] else lab.upper(), BODY, 15, c.T['mut'], 'c', spc=0 if c.T['sans'] else 5)
    p.save(nome('beleza-certificado', tema))

    p = nova(1080, 1350)
    for t, c2 in [('modelos', 'da semana'), ('nail', 'art'), ('francesinhas', 'e clássicas'), ('cores', 'do mês')]: grade(EPeca(p, tema), t, c2)
    p.save(nome('unha-catalogo-feed', tema))
    p = nova(1080, 1920)
    for t, c2 in [('modelos', 'da semana'), ('escolha o', 'seu')]: grade(EPeca(p, tema), t, c2)
    p.save(nome('unha-catalogo-stories', tema))
    print('ok', tema)

# peças novas, nos quatro estilos
def qr_de(proc):
    def f(c, y):
        W = c.W
        c.etiqueta(W / 2, y, proc, tam=22 if c.T['sans'] else 18)
        y += 100; d = 400
        if c.T['sans']: c.ret(W / 2 - d / 2, y, d, d, c.T['bg'], 0.06)
        else: c.moldura(W / 2 - d / 2, y, d, d, c.T['ink'], 1.2)
        c.tx(W / 2 - d / 2, y, d, d, 'cole aqui\no seu QR code', BODY, 22, c.T['mut'], 'c', True, esp=1.2)
        c.tx(60, y + d + 34, W - 120, 80, 'Aponte a câmera do celular e veja todos os cuidados.', BODY, 20, c.T['ink'], 'c', esp=1.25)
    return f

for tema in ('criativo',) + TEMAS_E:
    p = nova(697, 1181)
    for proc in ['design de sobrancelha', 'lash lifting', 'extensão de cílios', 'micropigmentação', '[seu procedimento]']:
        cartao_pequeno(p, tema, 'escaneie o', 'QR code', qr_de(proc))
    p.save(nome('beleza-cuidados-qr', tema))
    p = nova(697, 1181)
    for t, c2 in [('obrigada', 'pela preferência'), ('foi um prazer', 'cuidar de você'), ('volte', 'sempre')]:
        cartao_pequeno(p, tema, t, c2, lembranca)
    p.save(nome('beleza-lembranca', tema))
    print('ok novo', tema)
