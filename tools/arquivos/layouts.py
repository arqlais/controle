# Modelos de página das peças visuais. Coordenadas relativas ao tamanho (stories 1080x1920, feed 1080x1350,
# cartão A6 1240x1748), para o mesmo modelo servir em mais de um formato.
from pptx.enum.shapes import MSO_SHAPE
from peca import Peca, INK, ROSE, SOFT, BLUSH, WHITE, SAND, MUTED

def _esc(p):  # escala pela largura
    return p.W / 1080

def capa(p: Peca, c):
    k = _esc(p); W, H = p.W, p.H
    alto = H / W > 1.5
    p.txt(70 * k, 70 * k, W - 140 * k, 50 * k, [(c.get('olho', '[SEU ESPAÇO]'), {'tam': int(28 * k)})], cor=MUTED)
    p.titulo(70 * k, 140 * k, W - 140 * k, c['forte'], c['cursiva'], tam=int((130 if alto else 110) * k))
    ty = (560 if alto else 450) * k
    ph = (H - ty - (420 if alto else 260) * k)
    pw = min(W * (0.5 if c.get('texto') else 0.62), ph * 0.82)
    p.polaroid(90 * k, ty, pw, ph, rot=-4, legenda=c.get('legenda'))
    if c.get('selo'): p.selo(W - 330 * k, ty - 20 * k, 250 * k, c['selo'])
    p.coracao(W - 230 * k, ty + ph * 0.55, 70 * k)
    p.coracao(60 * k, ty - 70 * k, 44 * k, INK)
    if c.get('texto'): p.txt(90 * k + pw + 50 * k, ty + 320 * k, W - (90 * k + pw + 50 * k) - 60 * k, 520 * k, [(c['texto'], {'tam': int(34 * k)})], cor=INK, esp=1.15)
    if c.get('cta'): p.adesivo(W - (len(c['cta']) * 24 + 160) * k, ty + ph + 30 * k, c['cta'], tam=int(40 * k))
    p.rodape(c.get('rodape', '[SEU ESPAÇO] · @SEUPERFIL'))

def antes_depois(p: Peca, c):
    k = _esc(p); W, H = p.W, p.H
    p.titulo(70 * k, 80 * k, W - 140 * k, c['forte'], c['cursiva'], tam=int(120 * k))
    ty = 500 * k if H / W > 1.5 else 420 * k
    pw = (W - 200 * k) / 2; ph = pw * 1.35
    p.polaroid(60 * k, ty, pw, ph, rot=-3, legenda='antes')
    p.polaroid(W / 2 + 20 * k, ty + 50 * k, pw, ph, rot=3, legenda='depois')
    if c.get('selo'): p.selo(W / 2 - 110 * k, ty + ph - 60 * k, 220 * k, c['selo'], cor=INK)
    if c.get('texto'): p.txt(80 * k, ty + ph + 140 * k, W - 160 * k, 200 * k, [(c['texto'], {'tam': int(34 * k)})], al='c')
    if c.get('cta'): p.adesivo(W / 2 - (len(c['cta']) * 12 + 40) * k, H - 300 * k, c['cta'], tam=int(38 * k), rot=-2)
    p.rodape()

def lista(p: Peca, c):
    k = _esc(p); W, H = p.W, p.H
    p.titulo(70 * k, 80 * k, W - 140 * k, c['forte'], c['cursiva'], tam=int(115 * k))
    itens = c['itens']
    y = 420 * k; gap = 26 * k
    disp = H - y - 260 * k
    hh = min((440 if len(itens) <= 3 else 330) * k, (disp - gap * (len(itens) - 1)) / len(itens))
    com_foto = c.get('foto', True) and len(itens) <= 4
    w = W - 140 * k - (300 * k if com_foto else 0)
    for i, t in enumerate(itens):
        p.cartao(70 * k, y, w, hh, WHITE, 0.18)
        p.ret(100 * k, y + hh / 2 - 38 * k, 76 * k, 76 * k, SOFT if i % 2 else INK, 0, forma=MSO_SHAPE.OVAL)
        p.txt(100 * k, y + hh / 2 - 38 * k, 76 * k, 76 * k, [(str(i + 1), {'b': True, 'tam': int(34 * k), 'cor': WHITE})], al='c', meio=True)
        p.txt(205 * k, y + 14 * k, w - 160 * k, hh - 28 * k, [(t, {'tam': int((46 if len(itens) <= 3 else 38 if len(itens) <= 5 else 32) * k)})], meio=True, esp=1.05)
        y += hh + gap
    if com_foto: p.polaroid(W - 330 * k, 470 * k, 270 * k, 360 * k, rot=5, fita=True)
    if c.get('cta'): p.adesivo(70 * k, H - 230 * k, c['cta'], tam=int(36 * k), rot=-2)
    p.rodape()

def depoimento(p: Peca, c):
    k = _esc(p); W, H = p.W, p.H
    p.titulo(70 * k, 80 * k, W - 140 * k, c['forte'], c['cursiva'], tam=int(120 * k))
    y = 520 * k if H / W > 1.5 else 430 * k
    ch = min(H - y - 330 * k, 820 * k)
    p.cartao(70 * k, y, W - 140 * k, ch, WHITE, 0.06)
    if H - (y + ch) > 480 * k: p.polaroid(W - 420 * k, y + ch + 40 * k, 330 * k, 400 * k, rot=4, legenda=c.get('legenda'))
    av = p.foto(120 * k, y + 60 * k, 150 * k, 150 * k, texto='foto')
    try: av.auto_shape_type = MSO_SHAPE.OVAL
    except Exception: pass
    p.txt(300 * k, y + 70 * k, W - 470 * k, 60 * k, [('[nome da cliente]', {'b': True, 'tam': int(36 * k)})])
    p.txt(300 * k, y + 130 * k, W - 470 * k, 50 * k, [('[serviço]', {'tam': int(28 * k), 'cor': MUTED})])
    for i in range(5): p.estrela(120 * k + i * 62 * k, y + 250 * k, 50 * k, ROSE)
    p.txt(120 * k, y + 340 * k, W - 240 * k, ch - 420 * k, [('“' + c['texto'] + '”', {'tam': int(44 * k)})], esp=1.15)
    p.ret(W - 260 * k, y - 30 * k, 200 * k, 56 * k, SOFT, 0, 8, alpha=0.8)
    p.coracao(W - 190 * k, y + ch - 60 * k, 80 * k)
    if c.get('cta'): p.adesivo(70 * k, H - 250 * k, c['cta'], tam=int(36 * k), rot=-2)
    p.rodape()

def agenda(p: Peca, c):
    k = _esc(p); W, H = p.W, p.H
    p.txt(70 * k, 70 * k, W - 140 * k, 50 * k, [('[SEU ESPAÇO]', {'tam': int(28 * k)})], cor=MUTED)
    p.titulo(70 * k, 140 * k, W - 140 * k, c['forte'], c['cursiva'], tam=int(130 * k))
    dias = c['dias']
    y = 560 * k; cw = (W - 140 * k - 3 * 20 * k) / 4
    for i, (d, hrs) in enumerate(dias[:8]):
        x = 70 * k + (i % 4) * (cw + 20 * k); yy = y + (i // 4) * 210 * k
        escuro = i == c.get('destaque', 1)
        p.cartao(x, yy, cw, 190 * k, INK if escuro else WHITE, 0.2)
        p.txt(x, yy + 30 * k, cw, 60 * k, [(d, {'b': True, 'tam': int(38 * k), 'cor': WHITE if escuro else INK})], al='c')
        p.txt(x, yy + 95 * k, cw, 80 * k, [(hrs, {'tam': int(26 * k), 'cor': SOFT if escuro else MUTED})], al='c')
    fy = y + ((len(dias[:8]) + 3) // 4) * 210 * k + 40 * k
    ph = H - fy - 330 * k
    if ph > 300 * k: p.polaroid(80 * k, fy, ph * 0.8, ph, rot=-4)
    if c.get('selo'): p.selo(W - 340 * k, fy + 40 * k, 250 * k, c['selo'])
    if c.get('cta'): p.adesivo(W - (len(c['cta']) * 23 + 150) * k, H - 300 * k, c['cta'], tam=int(38 * k))
    p.rodape()

def aviso(p: Peca, c):
    k = _esc(p); W, H = p.W, p.H
    p.txt(70 * k, 70 * k, W - 140 * k, 50 * k, [('[SEU ESPAÇO]', {'tam': int(28 * k)})], cor=MUTED, al='c')
    y = 260 * k if H / W > 1.5 else 200 * k
    ch = min(H - y - 360 * k, 1150 * k)
    p.cartao(90 * k, y, W - 180 * k, ch, WHITE, 0.06, rot=-1.5)
    p.ret(W / 2 - 120 * k, y - 30 * k, 240 * k, 60 * k, SOFT, 0, -4, alpha=0.8)
    p.titulo(150 * k, y + 120 * k, W - 300 * k, c['forte'], c['cursiva'], tam=int(115 * k), al='c')
    p.txt(150 * k, y + 480 * k, W - 300 * k, ch - 560 * k, [(c['texto'], {'tam': int(46 * k)})], al='c', esp=1.2)
    p.coracao(W - 210 * k, y + ch - 90 * k, 90 * k)
    p.estrela(130 * k, y + ch - 110 * k, 60 * k, INK)
    if c.get('cta'): p.adesivo(W / 2 - (len(c['cta']) * 12 + 40) * k, y + ch + 40 * k, c['cta'], tam=int(38 * k), rot=-2)
    p.rodape()

def precos(p: Peca, c):
    k = _esc(p); W, H = p.W, p.H
    p.titulo(70 * k, 80 * k, W - 140 * k, c['forte'], c['cursiva'], tam=int(120 * k))
    y = 450 * k
    for grupo, itens in c['grupos']:
        gh = 110 * k + len(itens) * 92 * k
        p.cartao(70 * k, y, W - 140 * k, gh, WHITE, 0.08)
        p.txt(110 * k, y + 20 * k, W - 220 * k, 80 * k, [(grupo, {'i': True, 'tam': int(64 * k), 'cor': ROSE})])
        yy = y + 110 * k
        for s, v in itens:
            p.txt(110 * k, yy, W * 0.55, 70 * k, [(s, {'tam': int(38 * k)})])
            p.txt(W - 420 * k, yy, 310 * k, 70 * k, [(v, {'b': True, 'tam': int(38 * k)})], al='r')
            yy += 92 * k
        y += gh + 26 * k
    p.coracao(W - 170 * k, 130 * k, 70 * k)
    p.rodape('[agende pelo WhatsApp] · @SEUPERFIL')

def destaque(p: Peca, c):
    k = _esc(p); W, H = p.W, p.H
    d = 620 * k
    p.ret(W / 2 - d / 2, H / 2 - d / 2 - 60 * k, d, d, c.get('cor', SOFT), 0, forma=MSO_SHAPE.OVAL)
    forma = c.get('forma', 'coracao')
    s = 220 * k; x = W / 2 - s / 2; y = H / 2 - s / 2 - 120 * k
    if forma == 'coracao': p.coracao(x, y, s, WHITE, 0)
    elif forma == 'estrela': p.estrela(x, y, s, WHITE)
    else: p.ret(x, y, s, s, WHITE, 0.25)
    p.txt(W / 2 - d / 2, H / 2 + 60 * k, d, 120 * k, [(c['palavra'], {'b': True, 'tam': int(70 * k), 'cor': WHITE})], al='c')

def cuidados(p: Peca, c):
    """Cartão de cuidados (A6 para imprimir) ou stories: título, lista curta, foto pequena e contato."""
    lista(p, {**c, 'foto': c.get('foto', True)})

LAYOUTS = {'capa': capa, 'antes_depois': antes_depois, 'lista': lista, 'depoimento': depoimento, 'agenda': agenda, 'aviso': aviso, 'precos': precos, 'destaque': destaque, 'cuidados': cuidados}
