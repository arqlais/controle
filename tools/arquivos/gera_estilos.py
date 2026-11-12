# Gera as artes (PowerPoint) nos estilos minimalista e chique, com os mesmos nomes do criativo + "--estilo".
import os, sys
from peca import nova
from estilos import EPeca, LAYOUTS_E, SERIF, SCRIPT, BODY
import beleza_dados as D

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)

def kit(nome, w, h, pecas, tema):
    p = nova(w, h)
    for lay, c in pecas: LAYOUTS_E[lay](EPeca(p, tema), c)
    p.save(os.path.join(OUT, f'{nome}--{tema}.pptx'))

for tema in ('minimalista', 'chique'):
    kit('beleza-stories-mes', 1080, 1920, D.STORIES_MES, tema)
    kit('beleza-antes-depois-stories', 1080, 1920, [('antes_depois', c) for c in D.ANTES_DEPOIS], tema)
    kit('beleza-antes-depois-feed', 1080, 1350, [('antes_depois', c) for c in D.ANTES_DEPOIS], tema)
    kit('beleza-depoimentos-stories', 1080, 1920, [('depoimento', c) for c in D.DEPOIMENTOS], tema)
    kit('beleza-depoimentos-feed', 1080, 1350, [('depoimento', c) for c in D.DEPOIMENTOS], tema)
    kit('beleza-carrossel', 1080, 1350, D.CARROSSEL, tema)
    kit('beleza-destaques', 1080, 1920, [('destaque', {'palavra': w}) for w, f in D.DESTAQUES], tema)
    kit('beleza-politica-stories', 1080, 1920, [('lista', D.POLITICA_STORY)], tema)
    for k, v in D.CUIDADOS_STORIES.items():
        kit(f'{k}-cartoes-a6', 1240, 1748, [('lista', {**c, 'foto': False}) for c in v], tema)
        kit(f'{k}-stories', 1080, 1920, [('lista', c) for c in v], tema)
    kit('beleza-cartao-agendamento-stories', 1080, 1920, [('aviso', {'forte': 'seu próximo', 'cursiva': 'horário', 'texto': 'Dia [dd/mm] às [hora]\n[serviço]\n\nSe precisar remarcar, me avise com 24 horas de antecedência.', 'cta': 'até lá'})], tema)

    # cartão de agendamento 85 x 55 mm, frente e verso
    p = nova(1004, 650)
    f = EPeca(p, tema); k = f.k
    f.moldura(30, 30, 944, 590, None, 0.75)
    f.olho(70)
    f.titulo(502, 120, 800, 'seu próximo', 'horário', 70)
    for i, lab in enumerate(['DIA', 'HORA', 'SERVIÇO']):
        y = 380 + i * 66
        f.tx(110, y, 180, 40, lab, BODY, 20, f.T['mut'], 'l', spc=7)
        f.fio(290, y + 30, 600, None, 1.2)
    v = EPeca(p, 'chique' if tema == 'chique' else 'minimalista')
    v.ret(0, 0, 1004, 650, '1F1F1F' if tema == 'minimalista' else '15120F')
    v.tx(0, 170, 1004, 110, 'ATÉ LOGO', SERIF, 80, 'FFFFFF' if tema == 'minimalista' else 'EFE6D8', 'c', spc=10)
    v.tx(0, 290, 1004, 60, 'Se precisar remarcar, me avise com 24 horas de antecedência.', BODY, 22, 'BDBDBD' if tema == 'minimalista' else 'A79B8B', 'c')
    v.tx(0, 470, 1004, 50, '[WHATSAPP] · @SEUPERFIL', BODY, 20, 'FFFFFF' if tema == 'minimalista' else 'C9A86A', 'c', spc=7)
    p.save(os.path.join(OUT, f'beleza-cartao-agendamento--{tema}.pptx'))

    # certificado A4 deitado
    p = nova(1123, 794)
    c = EPeca(p, tema)
    c.moldura(34, 34, 1055, 726, None, 1.5); c.moldura(48, 48, 1027, 698, None, 0.5)
    c.tx(0, 40, 1123, 700, 'C', SERIF, 640, c.T['mono'], 'c', True)
    c.foto(951, 76, 110, 56, 'rect', 'SUA LOGO', aro=False)
    c.olho(90, '[NOME DO SEU ESPAÇO OU ESCOLA]')
    c.tx(0, 150, 1123, 110, 'CERTIFICADO', SERIF, 92, c.T['ink'], 'c', spc=18)
    c.tx(0, 262, 1123, 40, 'CERTIFICAMOS QUE', BODY, 18, c.T['mut'], 'c', spc=6)
    c.tx(0, 300, 1123, 110, '[Nome da aluna]', SCRIPT, 80, c.T['ac'], 'c')
    c.fio(331, 410, 460, None, 1)
    c.tx(181, 432, 760, 90, 'concluiu com êxito o curso de [nome do curso], com carga horária de [x] horas, em [data], em [cidade].', BODY, 20, c.T['ink'], 'c', esp=1.3)
    for i, lab in enumerate(['INSTRUTORA', 'ALUNA']):
        x = 191 + i * 440
        c.fio(x, 640, 300, None, 1)
        c.tx(x, 652, 300, 30, lab, BODY, 15, c.T['mut'], 'c', spc=5)
    p.save(os.path.join(OUT, f'beleza-certificado--{tema}.pptx'))

    # catálogo de unhas: grade de fotos com nome e valor
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
                pc.foto(x, yy, cw, ch - 90 * k, 'rect', 'SUA FOTO', aro=False)
                pc.tx(x, yy + ch - 78 * k, cw, 36 * k, f'MODELO {n:02d}', BODY, 20 * k, pc.T['ink'], 'c', spc=6 * k)
                pc.tx(x, yy + ch - 42 * k, cw, 40 * k, 'R$ 00,00', SERIF, 30 * k, pc.T['ac'], 'c')
    p = nova(1080, 1350)
    for t, c2 in [('modelos', 'da semana'), ('nail', 'art'), ('francesinhas', 'e clássicas'), ('cores', 'do mês')]: grade(EPeca(p, tema), t, c2)
    p.save(os.path.join(OUT, f'unha-catalogo-feed--{tema}.pptx'))
    p = nova(1080, 1920)
    for t, c2 in [('modelos', 'da semana'), ('escolha o', 'seu')]: grade(EPeca(p, tema), t, c2)
    p.save(os.path.join(OUT, f'unha-catalogo-stories--{tema}.pptx'))
    print('ok', tema)
