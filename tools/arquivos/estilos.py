# Estilos minimalista e chique das peças visuais (o criativo é a colagem de layouts.py).
# Mesmo conteúdo (beleza_dados), outro desenho: serifa fina em caixa alta e espaçada, um toque cursivo,
# etiquetas, fios finos e muito respiro. Tudo é calculado de cima para baixo (cursor), então nada se sobrepõe:
# a foto fica com o espaço que sobra.
import math, os
from PIL import Image, ImageDraw, ImageFont
from pptx.util import Emu, Pt
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from lxml import etree
from peca import Peca, PX, TMP, FONTE_DIR, rgb

TEMAS = {
    'minimalista': dict(bg='FFFFFF', ink='1F1F1F', ac='1F1F1F', mut='8A8A8A', fio='1F1F1F', card='F3F3F3', eti='1F1F1F', eti_txt='FFFFFF',
                        foto='ECECEC', foto_txt='9A9A9A', mono='F2F2F2', forma='rect'),
    'chique': dict(bg='15120F', ink='EFE6D8', ac='C9A86A', mut='A79B8B', fio='B8955C', card='211D19', eti='C9A86A', eti_txt='15120F',
                   foto='2A2520', foto_txt='9C8662', mono='1C1814', forma='arco'),
}
SERIF, SCRIPT, BODY = 'Cormorant Garamond', 'Great Vibes', 'Poppins'

def placeholder(w, h, fundo, cor, texto='ARRASTE SUA FOTO AQUI'):
    nome = f'{TMP}/e-{w}x{h}-{fundo}-{abs(hash(texto)) % 9999}.png'
    if os.path.exists(nome): return nome
    k = 2
    im = Image.new('RGB', (w * k, h * k), '#' + fundo)
    d = ImageDraw.Draw(im)
    cx, cy = w * k // 2, h * k // 2
    r = int(min(w, h) * k * 0.07)
    d.rounded_rectangle([cx - r, cy - int(r * 0.72) - 16 * k, cx + r, cy + int(r * 0.72) - 16 * k], radius=int(r * 0.2), outline='#' + cor, width=2 * k)
    d.ellipse([cx - r // 2.5, cy - r // 2.5 - 16 * k, cx + r // 2.5, cy + r // 2.5 - 16 * k], outline='#' + cor, width=2 * k)
    try: f = ImageFont.truetype(f'{FONTE_DIR}/poppins-latin-500-normal.ttf', max(11, int(min(w, h) * 0.03)) * k)
    except Exception: f = ImageFont.load_default()
    sp = 3 * k
    tw = sum(d.textlength(ch, font=f) + sp for ch in texto) - sp
    x = cx - tw / 2
    for ch in texto:
        d.text((x, cy + int(r * 0.72) + 4 * k), ch, fill='#' + cor, font=f); x += d.textlength(ch, font=f) + sp
    im.save(nome)
    return nome

class EPeca(Peca):
    def __init__(self, prs, tema):
        self.T = TEMAS[tema]; self.tema = tema
        super().__init__(prs, self.T['bg'])
        self.k = self.W / 1080

    # ---------- medidas ----------
    @staticmethod
    def larg(t, tam, fonte, spc=0):
        f = {SERIF: 0.66, SCRIPT: 0.40, BODY: 0.56}[fonte]
        return max(len(l) * tam * f + max(len(l) - 1, 0) * spc for l in t.split('\n'))

    def linhas(self, t, tam, w, fonte=BODY):
        f = {SERIF: 0.5, SCRIPT: 0.40, BODY: 0.53}[fonte]
        return sum(max(1, math.ceil(len(p) * tam * f / w)) for p in t.split('\n'))

    # ---------- primitivos ----------
    def tx(self, x, y, w, h, t, fonte=BODY, tam=30, cor=None, al='c', meio=False, spc=0, it=False, b=False, esp=1.0):
        tb = self.s.shapes.add_textbox(Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(h * PX)))
        tf = tb.text_frame; tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        if meio: tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        for i, ped in enumerate(t.split('\n')):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = {'l': PP_ALIGN.LEFT, 'c': PP_ALIGN.CENTER, 'r': PP_ALIGN.RIGHT}[al]; p.line_spacing = esp
            if not ped: continue
            r = p.add_run(); r.text = ped
            fo = r.font; fo.size = Pt(tam * 0.75); fo.name = fonte; fo.italic = it; fo.bold = b
            fo.color.rgb = rgb(cor or self.T['ink'])
            if spc: r._r.get_or_add_rPr().set('spc', str(int(spc * 75)))
        return tb

    def fio(self, x, y, w, cor=None, esp=2):
        self.ret(x, y, w, max(1.5, esp * self.k), cor or self.T['fio'])

    def moldura(self, x, y, w, h, cor=None, lw=1.2):
        sh = self.s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(h * PX)))
        sh.fill.background(); sh.line.color.rgb = rgb(cor or self.T['fio']); sh.line.width = Pt(lw); sh.shadow.inherit = False
        return sh

    def aro(self, x, y, w, h, forma, cor=None, lw=1.5):
        f = {'circ': MSO_SHAPE.OVAL, 'arco': MSO_SHAPE.ROUND_2_SAME_RECTANGLE, 'rect': MSO_SHAPE.RECTANGLE}[forma]
        sh = self.s.shapes.add_shape(f, Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(h * PX)))
        if forma == 'arco': sh.adjustments[0] = 0.5
        sh.fill.background(); sh.line.color.rgb = rgb(cor or self.T['fio']); sh.line.width = Pt(lw); sh.shadow.inherit = False

    def foto(self, x, y, w, h, forma=None, texto='ARRASTE SUA FOTO AQUI', aro=None):
        forma = forma or self.T['forma']
        if forma == 'arco': w = min(w, h * 0.8)
        pic = self.s.shapes.add_picture(placeholder(int(w), int(h), self.T['foto'], self.T['foto_txt'], texto), Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(h * PX)))
        geo = pic._element.spPr.find(qn('a:prstGeom'))
        if forma in ('circ', 'arco'):
            geo.set('prst', 'ellipse' if forma == 'circ' else 'round2SameRect')
            if forma == 'arco':
                av = geo.find(qn('a:avLst'))
                if av is None: av = etree.SubElement(geo, qn('a:avLst'))
                gd = etree.SubElement(av, qn('a:gd')); gd.set('name', 'adj1'); gd.set('fmla', 'val 50000')
        if aro if aro is not None else self.tema == 'chique':
            m = 14 * self.k
            self.aro(x - m, y - m, w + 2 * m, h + 2 * m, forma)
        return w

    def etiqueta(self, cx, y, t, cheia=True, tam=None):
        k = self.k; tam = tam or 26 * k; spc = tam * 0.22
        w = self.larg(t.upper(), tam, BODY, spc) * 1.02 + 70 * k; h = tam + 34 * k
        x = cx - w / 2
        if cheia: self.ret(x, y, w, h, self.T['eti'])
        else: self.moldura(x, y, w, h, self.T['ac'])
        self.tx(x, y, w, h, t.upper(), BODY, tam, self.T['eti_txt'] if cheia else self.T['ac'], 'c', True, spc)
        return h

    def titulo(self, cx, y, w, forte, cursiva, tam=96):
        """Caixa alta espaçada + palavra cursiva logo abaixo. Devolve a altura usada."""
        k = self.k
        F = forte.upper().strip(); spc = tam * 0.12
        while self.larg(F, tam, SERIF, spc) > w and tam > 30 * k: tam *= 0.94; spc = tam * 0.12
        self.tx(cx - w / 2, y, w, tam * 1.15, F, SERIF, tam, self.T['ink'], 'c', spc=spc)
        h = tam * 1.05
        if cursiva:
            ct = tam * 1.15
            while self.larg(cursiva, ct, SCRIPT) > w and ct > 30 * k: ct *= 0.94
            self.tx(cx - w / 2, y + h - ct * 0.12, w, ct * 1.3, cursiva, SCRIPT, ct, self.T['ac'], 'c')
            h += ct * 1.15
        return h

    def olho(self, y, t='[SEU ESPAÇO]'):
        tam = 22 * self.k
        self.tx(0, y, self.W, tam * 1.4, t, BODY, tam, self.T['mut'], 'c', spc=tam * 0.45)
        return tam * 1.4

    def rodape(self, texto='[SEU ESPAÇO] · @SEUPERFIL'):
        tam = 20 * self.k
        self.tx(0, self.H - 90 * self.k, self.W, tam * 1.4, texto, BODY, tam, self.T['mut'], 'c', spc=tam * 0.35)

    def corpo(self, cx, y, w, t, tam=None):
        tam = tam or 30 * self.k
        h = self.linhas(t, tam, w) * tam * 1.4
        self.tx(cx - w / 2, y, w, h + 10, t, BODY, tam, self.T['ink'], 'c', esp=1.2)
        return h

    def mono(self, letra):
        d = self.W * 1.05
        self.tx(-0.025 * self.W, self.H / 2 - d * 0.62, d, d * 1.2, letra.upper(), SERIF, d, self.T['mono'], 'c')


# ---------------- modelos de página ----------------
G = 40  # respiro padrão (x k)

def _rodape_e_cta(p, c, y_fim):
    """Coloca a chamada (cta) acima do rodapé. Devolve o y máximo disponível para o conteúdo."""
    k = p.k
    p.rodape(c.get('rodape', '[SEU ESPAÇO] · @SEUPERFIL'))
    lim = p.H - 140 * k
    if c.get('cta'):
        tam = 24 * k; h = tam + 34 * k
        p.etiqueta(p.W / 2, lim - h, c['cta'], cheia=False, tam=tam)
        lim -= h + G * k
    return lim

def capa(p, c):
    k, W, H = p.k, p.W, p.H
    alto = H / W > 1.5
    lim = _rodape_e_cta(p, c, H)
    # bloco de texto (calculado antes para a foto ficar com o resto)
    tw = W - 200 * k
    tam = (104 if alto else 88) * k
    blocos = []
    if c.get('selo'): blocos.append(('selo', 26 * k + 34 * k))
    if c.get('texto'): blocos.append(('texto', p.linhas(c['texto'], 30 * k, tw * 0.9) * 30 * k * 1.4))
    h_tit = tam * 1.05 + (tam * 1.15 * 1.15 if c.get('cursiva') else 0)
    h_txt = h_tit + sum(h + G * k * 0.8 for _, h in blocos)
    if p.tema == 'minimalista':
        # foto sangrando no alto, texto embaixo, como capa de revista
        fy, fh = 0, lim - h_txt - 2 * G * k
        p.foto(0, fy, W, fh, 'rect')
        p.ret(W / 2 - 230 * k, fh - 30 * k, 460 * k, 60 * k, p.T['bg'])
        p.tx(W / 2 - 230 * k, fh - 30 * k, 460 * k, 60 * k, c.get('olho', '[SEU ESPAÇO]'), BODY, 20 * k, p.T['mut'], 'c', True, 20 * k * 0.45)
        y = fh + 2 * G * k
    else:
        y0 = 70 * k + p.olho(70 * k, c.get('olho', '[SEU ESPAÇO]')) + G * k
        fh = lim - h_txt - y0 - 2 * G * k
        fw = min(W - 260 * k, fh * 0.78)
        fw = p.foto(W / 2 - fw / 2, y0 + 14 * k, fw, fh - 28 * k, 'arco')
        y = y0 + fh + G * k
    y += p.titulo(W / 2, y, tw, c['forte'], c.get('cursiva', ''), tam) + G * k * 0.6
    for nome, h in blocos:
        if nome == 'selo': p.etiqueta(W / 2, y, c['selo'])
        else: p.corpo(W / 2, y, tw * 0.9, c['texto'])
        y += h + G * k * 0.8

def antes_depois(p, c):
    k, W, H = p.k, p.W, p.H
    lim = _rodape_e_cta(p, c, H)
    y = 90 * k
    y += p.titulo(W / 2, y, W - 200 * k, c['forte'], c.get('cursiva', ''), 92 * k) + G * k
    h_fim = 0
    if c.get('selo'): h_fim += 60 * k + G * k
    if c.get('texto'): h_fim += p.linhas(c['texto'], 30 * k, W - 240 * k) * 42 * k + G * k
    gap = 36 * k; m = 80 * k
    fw = (W - 2 * m - gap) / 2
    lab = 70 * k
    fh = min(fw * 1.45, lim - y - h_fim - lab - G * k)
    for i, t in enumerate(['antes', 'depois']):
        x = m + i * (fw + gap)
        w2 = p.foto(x, y + (14 * k if p.tema == 'chique' else 0), fw, fh - (28 * k if p.tema == 'chique' else 0), 'arco' if p.tema == 'chique' else 'rect')
        p.tx(x, y + fh + 18 * k, w2, 40 * k, t.upper(), BODY, 22 * k, p.T['mut'], 'c', spc=22 * k * 0.5)
    y += fh + lab + G * k * 0.5
    if c.get('selo'): y += p.etiqueta(W / 2, y, c['selo']) + G * k
    if c.get('texto'): p.corpo(W / 2, y, W - 240 * k, c['texto'])

def lista(p, c):
    k, W, H = p.k, p.W, p.H
    lim = _rodape_e_cta(p, c, H)
    y = 90 * k
    y += p.olho(y) + G * k * 0.6
    y += p.titulo(W / 2, y, W - 200 * k, c['forte'], c.get('cursiva', ''), 92 * k) + G * k
    itens = c['itens']
    if c.get('foto', True) and len(itens) <= 3 and lim - y > 1000 * k:
        d = 300 * k
        p.foto(W / 2 - d / 2, y, d, d, 'circ'); y += d + G * k * 1.2
    m = 110 * k; w = W - 2 * m
    disp = lim - y
    tam = (34 if len(itens) <= 4 else 30 if len(itens) <= 6 else 27) * k
    alturas = [p.linhas(t, tam, w - 120 * k) * tam * 1.35 + 44 * k for t in itens]
    while sum(alturas) > disp and tam > 20 * k:
        tam *= 0.93; alturas = [p.linhas(t, tam, w - 120 * k) * tam * 1.35 + 40 * k for t in itens]
    folga = disp - sum(alturas)
    extra = max(0, min(56 * k, folga / max(1, len(itens)) / 2))
    y += max(0, (folga - 2 * extra * len(itens)) / 2)
    for i, (t, h) in enumerate(zip(itens, alturas)):
        h += 2 * extra
        p.fio(m, y, w, p.T['fio'] if p.tema == 'chique' else 'D6D6D6', 1.5)
        p.tx(m, y, 100 * k, h, f'{i + 1:02d}', SERIF, tam * 1.5, p.T['ac'], 'l', True)
        p.tx(m + 120 * k, y, w - 120 * k, h, t, BODY, tam, p.T['ink'], 'l', True, esp=1.15)
        y += h
    p.fio(m, y, w, p.T['fio'] if p.tema == 'chique' else 'D6D6D6', 1.5)

def depoimento(p, c):
    k, W, H = p.k, p.W, p.H
    lim = _rodape_e_cta(p, c, H)
    y = 90 * k
    y += p.titulo(W / 2, y, W - 200 * k, c['forte'], c.get('cursiva', ''), 92 * k) + G * k
    d = (300 if H / W > 1.5 else 200) * k
    tw = W - 240 * k; tam = 44 * k
    h_q = p.linhas(c['texto'], tam, tw, SERIF) * tam * 1.3
    bloco = d + G * k * 0.8 + 30 * k + G * k + 100 * k + h_q + G * k + 84 * k
    y += max(0, (lim - y - bloco) / 2)
    p.foto(W / 2 - d / 2, y, d, d, 'circ', 'FOTO'); y += d + G * k * 0.8
    for i in range(5):
        s = 30 * k
        p.ret(W / 2 - 2.5 * s - 2 * 14 * k + i * (s + 14 * k), y, s, s, p.T['ac'], 0, forma=MSO_SHAPE.STAR_5_POINT)
    y += 30 * k + G * k
    p.tx(0, y - 40 * k, W, 160 * k, '“', SERIF, 200 * k, p.T['ac'], 'c'); y += 100 * k
    disp = lim - y - 130 * k
    while p.linhas(c['texto'], tam, tw, SERIF) * tam * 1.3 > disp and tam > 24 * k: tam *= 0.93
    h = p.linhas(c['texto'], tam, tw, SERIF) * tam * 1.3
    p.tx(W / 2 - tw / 2, y, tw, h + 10, c['texto'], SERIF, tam, p.T['ink'], 'c', it=True, esp=1.15); y += h + G * k
    p.tx(0, y, W, 40 * k, '[NOME DA CLIENTE]', BODY, 24 * k, p.T['ink'], 'c', spc=24 * k * 0.35); y += 44 * k
    p.tx(0, y, W, 36 * k, '[serviço]', BODY, 22 * k, p.T['mut'], 'c')

def agenda(p, c):
    k, W, H = p.k, p.W, p.H
    lim = _rodape_e_cta(p, c, H)
    y = 90 * k
    y += p.olho(y) + G * k * 0.6
    y += p.titulo(W / 2, y, W - 200 * k, c['forte'], c.get('cursiva', ''), 100 * k) + G * k * 1.2
    dias = c['dias'][:8]; cols = 3 if len(dias) <= 6 else 4
    m = 100 * k; gap = 22 * k; cw = (W - 2 * m - (cols - 1) * gap) / cols; ch = 170 * k
    for i, (d, hrs) in enumerate(dias):
        x = m + (i % cols) * (cw + gap); yy = y + (i // cols) * (ch + gap)
        on = i == c.get('destaque', 1)
        if on: p.ret(x, yy, cw, ch, p.T['eti'])
        else: p.moldura(x, yy, cw, ch, p.T['fio'] if p.tema == 'chique' else 'BDBDBD', 1)
        cor = p.T['eti_txt'] if on else p.T['ink']
        p.tx(x, yy + 30 * k, cw, 50 * k, d.upper(), SERIF, 40 * k, cor, 'c', spc=40 * k * 0.12)
        p.tx(x, yy + 96 * k, cw, 40 * k, hrs, BODY, 24 * k, p.T['eti_txt'] if on else p.T['mut'], 'c')
    y += math.ceil(len(dias) / cols) * (ch + gap) + G * k
    h_selo = (60 * k + G * k) if c.get('selo') else 0
    fh = lim - y - h_selo - G * k
    if fh > 320 * k:
        fw = min(W - 2 * m, fh * (0.8 if p.tema == 'chique' else 1.6))
        fw = p.foto(W / 2 - fw / 2, y + (14 * k if p.tema == 'chique' else 0), fw, fh - (28 * k if p.tema == 'chique' else 0))
        y += fh + G * k * 0.6
    if c.get('selo'): p.etiqueta(W / 2, y, c['selo'])

def aviso(p, c):
    k, W, H = p.k, p.W, p.H
    p.mono(c['forte'].strip()[0])
    m = 70 * k
    p.moldura(m, m, W - 2 * m, H - 2 * m, p.T['fio'] if p.tema == 'chique' else p.T['ink'], 1)
    tw = W - 300 * k
    h_t = 100 * k * 1.05 + 100 * k * 1.15 * 1.15
    tam = 36 * k
    while p.linhas(c['texto'], tam, tw * 0.9) * tam * 1.45 > H * 0.32 and tam > 22 * k: tam *= 0.93
    h_c = p.linhas(c['texto'], tam, tw * 0.9) * tam * 1.45
    h_cta = (24 * k + 34 * k + G * k * 1.5) if c.get('cta') else 0
    tot = 50 * k + h_t + G * k * 1.5 + h_c + h_cta
    y = H / 2 - tot / 2
    p.olho(y); y += 50 * k
    y += p.titulo(W / 2, y, tw, c['forte'], c.get('cursiva', ''), 100 * k) + G * k * 0.7
    p.fio(W / 2 - 40 * k, y, 80 * k, p.T['ac'], 2); y += G * k * 0.8
    p.tx(W / 2 - tw * 0.45, y, tw * 0.9, h_c + 10, c['texto'], BODY, tam, p.T['ink'], 'c', esp=1.25); y += h_c + G * k * 1.5
    if c.get('cta'): p.etiqueta(W / 2, y, c['cta'])
    p.rodape()

def precos(p, c):
    k, W, H = p.k, p.W, p.H
    p.rodape('[AGENDE PELO WHATSAPP] · @SEUPERFIL')
    y = 90 * k
    y += p.olho(y) + G * k * 0.6
    y += p.titulo(W / 2, y, W - 200 * k, c['forte'], c.get('cursiva', ''), 96 * k) + G * k
    m = 110 * k
    for grupo, itens in c['grupos']:
        p.tx(m, y, W - 2 * m, 80 * k, grupo, SCRIPT, 60 * k, p.T['ac'], 'l'); y += 86 * k
        for s, v in itens:
            p.tx(m, y, W * 0.55, 56 * k, s, BODY, 30 * k, p.T['ink'], 'l', True)
            p.tx(W - m - 300 * k, y, 300 * k, 56 * k, v, SERIF, 36 * k, p.T['ink'], 'r', True)
            y += 62 * k
            p.fio(m, y, W - 2 * m, p.T['fio'] if p.tema == 'chique' else 'DADADA', 1.2); y += 14 * k
        y += G * k

def destaque(p, c):
    k, W, H = p.k, p.W, p.H
    d = 640 * k; x = W / 2 - d / 2; y = H / 2 - d / 2
    p.aro(x, y, d, d, 'circ', p.T['ac'], 1.5)
    p.aro(x + 26 * k, y + 26 * k, d - 52 * k, d - 52 * k, 'circ', p.T['ac'], 0.75)
    pal = c['palavra']
    p.tx(x, H / 2 - 120 * k, d, 140 * k, pal[0].upper(), SERIF, 130 * k, p.T['ac'], 'c', True)
    tam = 40 * k
    while p.larg(pal.upper(), tam, BODY, tam * 0.4) > d * 0.7: tam *= 0.93
    p.tx(x, H / 2 + 40 * k, d, 70 * k, pal.upper(), BODY, tam, p.T['ink'], 'c', True, tam * 0.4)

def cuidados(p, c):
    lista(p, {**c, 'foto': c.get('foto', True)})

LAYOUTS_E = {'capa': capa, 'antes_depois': antes_depois, 'lista': lista, 'depoimento': depoimento, 'agenda': agenda, 'aviso': aviso, 'precos': precos, 'destaque': destaque, 'cuidados': cuidados}
