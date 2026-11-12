# Motor das peças visuais (PowerPoint editável: abre no Canva, Google Slides e PowerPoint).
# Estilo "colagem" da planê: polaroid, fita, adesivos com borda branca, coração, cursiva + título forte.
# As fotos são IMAGENS de "arraste sua foto aqui": no Canva, arrastar uma foto por cima troca a imagem.
import os
from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from lxml import etree

PX = 9525
INK, ROSE, SOFT, BLUSH, BG, WHITE, SAND, MUTED = '45394A', 'C9785D', 'EDB5A8', 'F6E1DA', 'FBF2EC', 'FFFFFF', 'F3E3C7', '9A8C93'
LILAS = 'CBBFE0'
SCRIPT = 'Cormorant Garamond'
FONTE_DIR = os.path.expanduser('~/.fonts')
TMP = os.path.join(os.environ.get('CONTEUDO', os.path.expanduser('~/conteudo')), 'ph')
os.makedirs(TMP, exist_ok=True)
rgb = RGBColor.from_string

# ---------- imagem "arraste sua foto aqui" ----------
def placeholder(w, h, texto='arraste sua foto aqui'):
    nome = f'{TMP}/ph3-{w}x{h}-{abs(hash(texto)) % 9999}.png'
    if os.path.exists(nome): return nome
    k = 2
    im = Image.new('RGB', (w * k, h * k), '#F3DCD3')
    d = ImageDraw.Draw(im)
    cx, cy = w * k // 2, h * k // 2
    r = int(min(w, h) * k * 0.12)
    d.rounded_rectangle([cx - r, cy - int(r * 0.75) - 20 * k, cx + r, cy + int(r * 0.75) - 20 * k], radius=int(r * 0.25), outline='#C9785D', width=5 * k)
    d.ellipse([cx - r // 2.6, cy - r // 2.6 - 20 * k, cx + r // 2.6, cy + r // 2.6 - 20 * k], outline='#C9785D', width=5 * k)
    try:
        f = ImageFont.truetype(f'{FONTE_DIR}/poppins-latin-600-normal.ttf', max(18, int(min(w, h) * 0.055)) * k)
    except Exception:
        f = ImageFont.load_default()
    tw = d.textlength(texto, font=f)
    d.text((cx - tw / 2, cy + int(r * 0.75)), texto, fill='#C9785D', font=f)
    im.save(nome)
    return nome

def nova(w, h):
    p = Presentation(); p.slide_width = Emu(w * PX); p.slide_height = Emu(h * PX); return p

class Peca:
    def __init__(self, prs, fundo=BG):
        self.s = prs.slides.add_slide(prs.slide_layouts[6])
        self.s.background.fill.solid(); self.s.background.fill.fore_color.rgb = rgb(fundo)
        self.W = prs.slide_width // PX; self.H = prs.slide_height // PX

    def _alpha(self, shape, a):
        sf = shape.fill._xPr.find(qn('a:solidFill'))
        if sf is not None and len(sf):
            el = etree.SubElement(sf[0], qn('a:alpha')); el.set('val', str(int(a * 100000)))

    def ret(self, x, y, w, h, cor=WHITE, raio=0.0, rot=0, linha=None, lw=0, alpha=None, forma=None):
        f = forma or (MSO_SHAPE.ROUNDED_RECTANGLE if raio else MSO_SHAPE.RECTANGLE)
        sh = self.s.shapes.add_shape(f, Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(h * PX)))
        if raio and f == MSO_SHAPE.ROUNDED_RECTANGLE: sh.adjustments[0] = raio
        sh.fill.solid(); sh.fill.fore_color.rgb = rgb(cor)
        if alpha is not None: self._alpha(sh, alpha)
        if linha: sh.line.color.rgb = rgb(linha); sh.line.width = Pt(lw)
        else: sh.line.fill.background()
        sh.shadow.inherit = False
        sh.rotation = rot
        sh.text_frame.text = ''
        return sh

    def txt(self, x, y, w, h, partes, tam=40, cor=INK, al='l', meio=False, rot=0, esp=1.0):
        tb = self.s.shapes.add_textbox(Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(h * PX)))
        tf = tb.text_frame; tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        if meio: tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        if isinstance(partes, str): partes = [(partes, {})]
        p = tf.paragraphs[0]
        for t, o in partes:
            for k, ped in enumerate(t.split('\n')):
                if k: p = tf.add_paragraph()
                p.alignment = {'l': PP_ALIGN.LEFT, 'c': PP_ALIGN.CENTER, 'r': PP_ALIGN.RIGHT}[al]
                p.line_spacing = esp
                if not ped: continue
                r = p.add_run(); r.text = ped
                fo = r.font; fo.size = Pt(o.get('tam', tam) * 0.75); fo.bold = o.get('b', False); fo.italic = o.get('i', False)
                fo.name = SCRIPT if o.get('i') else 'Poppins'
                fo.color.rgb = rgb(o.get('cor', cor))
        tb.rotation = rot
        return tb

    def foto(self, x, y, w, h, rot=0, texto='arraste sua foto aqui'):
        pic = self.s.shapes.add_picture(placeholder(int(w), int(h), texto), Emu(int(x * PX)), Emu(int(y * PX)), Emu(int(w * PX)), Emu(int(h * PX)))
        pic.rotation = rot
        return pic

    # ----- peças da colagem -----
    def polaroid(self, x, y, w, h, rot=0, legenda=None, fita=True):
        self.ret(x, y, w, h, WHITE, 0.02, rot)
        m = w * 0.06
        self.foto(x + m, y + m, w - 2 * m, h - m - h * 0.16, rot)
        if legenda: self.txt(x + m, y + h - h * 0.14, w - 2 * m, h * 0.12, [(legenda, {'i': True, 'tam': max(34, int(w * 0.075))})], al='c', meio=True, rot=rot)
        if fita: self.ret(x + w * 0.32, y - 26, w * 0.36, 58, LILAS, 0, rot - 6, alpha=0.85)

    def titulo(self, x, y, w, forte, cursiva, tam=150, cor=INK, al='l'):
        self.txt(x, y, w, tam * 1.1, [(forte, {'b': True, 'tam': tam})], cor=cor, al=al)
        self.txt(x + (tam * 0.35 if al == 'l' else 0), y + tam * 0.86, w, tam * 1.3, [(cursiva, {'i': True, 'tam': int(tam * 1.18), 'cor': ROSE})], al=al)

    def adesivo(self, x, y, texto, escuro=True, rot=-4, tam=40):
        w = len(texto) * tam * 0.58 + 80
        self.ret(x, y, w, tam + 50, INK if escuro else WHITE, 0.5, rot, linha=WHITE if escuro else SOFT, lw=7)
        self.txt(x, y, w, tam + 50, [(texto, {'b': True, 'tam': tam, 'cor': WHITE if escuro else INK})], al='c', meio=True, rot=rot)
        return w

    def selo(self, x, y, d, texto, rot=10, cor=SOFT):
        self.ret(x, y, d, d, cor, 0, rot, linha=WHITE, lw=8, forma=MSO_SHAPE.OVAL)
        self.txt(x + d * 0.1, y, d * 0.8, d, [(texto, {'b': True, 'tam': int(d * 0.14), 'cor': WHITE})], al='c', meio=True, rot=rot)

    def coracao(self, x, y, d, cor=SOFT, rot=-8):
        self.ret(x, y, d, d * 0.9, cor, 0, rot, forma=MSO_SHAPE.HEART)

    def estrela(self, x, y, d, cor=SOFT, rot=0):
        self.ret(x, y, d, d, cor, 0, rot, forma=MSO_SHAPE.STAR_5_POINT)

    def rodape(self, texto='[SEU ESPAÇO] · @SEUPERFIL'):
        self.txt(60, self.H - 120, self.W - 120, 60, [(texto, {'tam': 30, 'b': False})], cor=INK, al='c')

    def cartao(self, x, y, w, h, cor=WHITE, raio=0.08, rot=0):
        return self.ret(x, y, w, h, cor, raio, rot)
