# Peças visuais editáveis (PowerPoint: abre no Canva, no Google Slides e no PowerPoint) + HTML para o PDF.
# Paleta: bege, azul e rosé. Fontes: Poppins e Cormorant Garamond itálico (gratuitas, existem no Canva).
import os, sys, html
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

OUT, HTMLDIR, FONTS = sys.argv[1], sys.argv[2], sys.argv[3]
BG, CARD, INK, ROSE, BLUSH, SAND, MUTED = 'F5F1EE', 'FFFFFF', '3E4B57', 'A88A80', 'F4E8E5', 'EFE5E1', '8B939A'
PX = 9525  # 1 px em EMU (96 dpi)
rgb = lambda h: RGBColor.from_string(h)

def novo(w, h):
    p = Presentation(); p.slide_width = Emu(w * PX); p.slide_height = Emu(h * PX); return p

def slide(p):
    s = p.slides.add_slide(p.slide_layouts[6])
    s.background.fill.solid(); s.background.fill.fore_color.rgb = rgb(BG)
    return s

def caixa(s, x, y, w, h, cor=CARD, raio=0.08, linha=None):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Emu(x * PX), Emu(y * PX), Emu(w * PX), Emu(h * PX))
    sh.adjustments[0] = raio
    sh.fill.solid(); sh.fill.fore_color.rgb = rgb(cor)
    if linha: sh.line.color.rgb = rgb(linha); sh.line.width = Pt(1)
    else: sh.line.fill.background()
    sh.shadow.inherit = False
    return sh

def texto(s, x, y, w, h, partes, tam=28, cor=INK, alinha='l', meio=False):
    """partes: str ou lista de (texto, {'b':bool,'i':bool,'cor':hex,'tam':n}) ; '\n' quebra parágrafo"""
    tb = s.shapes.add_textbox(Emu(x * PX), Emu(y * PX), Emu(w * PX), Emu(h * PX))
    tf = tb.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    if meio: tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    if isinstance(partes, str): partes = [(partes, {})]
    p = tf.paragraphs[0]
    for t, o in partes:
        for k, pedaco in enumerate(t.split('\n')):
            if k: p = tf.add_paragraph()
            p.alignment = {'l': PP_ALIGN.LEFT, 'c': PP_ALIGN.CENTER, 'r': PP_ALIGN.RIGHT}[alinha]
            if not pedaco: continue
            r = p.add_run(); r.text = pedaco
            f = r.font; f.size = Pt(o.get('tam', tam) * 0.75); f.bold = o.get('b', False); f.italic = o.get('i', False)
            f.name = 'Cormorant Garamond' if o.get('i') else 'Poppins'
            f.color.rgb = rgb(o.get('cor', cor))
    return tb

def listras(s, x, y, w, h, passo=24):
    # faixa listrada bege e rosé, começando e terminando no bege
    n = int(w // passo)
    for i in range(1, n, 2):
        r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu((x + i * passo) * PX), Emu(y * PX), Emu(passo * PX), Emu(h * PX))
        r.fill.solid(); r.fill.fore_color.rgb = rgb(BLUSH); r.line.fill.background(); r.shadow.inherit = False

# =============== tabela de preços (feed 1080x1350 e stories 1080x1920) ===============
SERV = [('sobrancelha', [('Design de sobrancelha', 'R$ 00,00'), ('Design com henna', 'R$ 00,00'), ('Brow lamination', 'R$ 00,00')]),
        ('cílios', [('Lash lifting', 'R$ 00,00'), ('Extensão fio a fio', 'R$ 00,00'), ('Manutenção', 'R$ 00,00')]),
        ('unhas', [('Mão', 'R$ 00,00'), ('Pé', 'R$ 00,00'), ('Alongamento em gel', 'R$ 00,00')])]

def tabela_precos(p, w, h):
    s = slide(p)
    texto(s, 80, 80, 600, 30, '[SEU ESPAÇO]', 20, ROSE)
    texto(s, 80, 120, w - 160, 160, [('tabela de ', {'b': True, 'tam': 76}), ('preços', {'i': True, 'cor': ROSE, 'tam': 92})])
    y = 300 if h < 1500 else 420
    gap = 26
    bloco = (h - y - 190 - gap * 2) / 3
    for nome, itens in SERV:
        caixa(s, 80, y, w - 160, bloco, CARD, 0.07)
        texto(s, 120, y + 30, 400, 40, [(nome, {'i': True, 'cor': ROSE, 'tam': 44})])
        ly = y + 100
        passo = (bloco - 120) / len(itens)
        for serv, preco in itens:
            texto(s, 120, ly, 600, 40, serv, 30)
            texto(s, w - 420, ly, 300, 40, [(preco, {'b': True, 'tam': 30})], alinha='r')
            ly += passo
        y += bloco + gap
    listras(s, 80, h - 150, w - 160, 30)
    texto(s, 80, h - 100, w - 160, 40, '[agende pelo WhatsApp (00) 00000-0000]  ·  [@seuperfil]', 24, MUTED, 'c')

# =============== vale-presente e cartão fidelidade (85 x 55 mm → 1004 x 650 px) ===============
def vale(p):
    W, H = 1004, 650
    s = slide(p)  # frente vale
    caixa(s, 40, 40, W - 80, H - 80, CARD, 0.06)
    texto(s, 100, 110, 700, 60, '[SEU ESPAÇO]', 22, ROSE)
    texto(s, 100, 170, 800, 200, [('vale', {'b': True, 'tam': 96}), (' presente', {'i': True, 'cor': ROSE, 'tam': 110})])
    listras(s, 100, 420, W - 200, 26, 20)
    texto(s, 100, 480, W - 200, 60, 'um momento só seu, com carinho', 26, MUTED)
    s = slide(p)  # verso vale
    caixa(s, 40, 40, W - 80, H - 80, CARD, 0.06)
    for i, lab in enumerate(['para', 'de', 'serviço ou valor', 'válido até']):
        texto(s, 100, 110 + i * 105, 300, 40, lab, 22, MUTED)
        ln = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(330 * PX), Emu((140 + i * 105) * PX), Emu(560 * PX), Emu(2 * PX))
        ln.fill.solid(); ln.fill.fore_color.rgb = rgb('D9CCC6'); ln.line.fill.background(); ln.shadow.inherit = False
    texto(s, 100, 545, W - 200, 40, '[WhatsApp]  ·  [@seuperfil]  ·  agende com antecedência', 20, MUTED, 'c')
    s = slide(p)  # frente fidelidade
    caixa(s, 40, 40, W - 80, H - 80, INK, 0.06)
    texto(s, 100, 110, 700, 60, '[SEU ESPAÇO]', 22, 'D6B3AB')
    texto(s, 100, 170, 820, 200, [('cartão ', {'b': True, 'tam': 84, 'cor': 'FFFFFF'}), ('fidelidade', {'i': True, 'cor': 'D6B3AB', 'tam': 100})])
    texto(s, 100, 470, W - 200, 80, 'a cada 10 atendimentos, o 11º é presente', 26, 'E8EBEE')
    s = slide(p)  # verso fidelidade
    caixa(s, 40, 40, W - 80, H - 80, CARD, 0.06)
    texto(s, 100, 90, W - 200, 50, [('nome  ', {'tam': 22, 'cor': MUTED})])
    ln = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(190 * PX), Emu(118 * PX), Emu(700 * PX), Emu(2 * PX)); ln.fill.solid(); ln.fill.fore_color.rgb = rgb('D9CCC6'); ln.line.fill.background(); ln.shadow.inherit = False
    for i in range(10):
        cx, cy = 100 + (i % 5) * 165, 190 + (i // 5) * 165
        c = caixa(s, cx, cy, 130, 130, BLUSH if i < 9 else INK, 0.22)
        texto(s, cx, cy, 130, 130, [(str(i + 1) if i < 9 else 'presente', {'b': True, 'tam': 30 if i < 9 else 22, 'cor': ROSE if i < 9 else 'FFFFFF'})], alinha='c', meio=True)
    texto(s, 100, 555, W - 200, 40, '[WhatsApp]  ·  [@seuperfil]', 20, MUTED, 'c')

# =============== kit avisos de fim de ano (stories 1080x1920 + feed 1080x1350) ===============
AVISOS = [
    ('agenda', 'agenda de ', 'dezembro', 'aberta', 'Garanta o seu horário antes das festas. As vagas acabam rápido nesta época.', '[chame no WhatsApp]'),
    ('ultimos', 'últimos ', 'horários', 'antes do Natal', 'Restam poucas vagas entre [dia] e [dia]. Depois disso, só no ano que vem.', '[reserve o seu]'),
    ('especial', 'horários ', 'especiais', 'de fim de ano', '[seg a sex: 8h às 20h]\n[sábado: 8h às 18h]\n[24 e 31/12: até 12h]', '[agende pelo link]'),
    ('recesso', 'pausa para ', 'descansar', 'recesso', 'De [dia/mês] a [dia/mês] o espaço fica fechado. As mensagens são respondidas na volta.', '[obrigada por este ano]'),
    ('volta', 'estamos de ', 'volta', 'agenda de janeiro aberta', 'A partir de [dia/mês], com horários novos. Comece o ano se cuidando.', '[chame no WhatsApp]'),
    ('festas', 'boas ', 'festas', 'obrigada por este ano', 'Cada atendimento foi especial. Que o ano novo venha leve e cheio de cuidado.', '[seu nome]'),
]
def aviso(p, w, h, a):
    _, t1, t2, olho, corpo, cta = a
    s = slide(p)
    m = 90
    texto(s, m, 130, w - 2 * m, 40, '[SEU ESPAÇO]', 24, ROSE)
    alto = h > 1500
    texto(s, m, 200 if alto else 170, w - 2 * m, 60, olho, 30, MUTED)
    texto(s, m, 260 if alto else 220, w - 2 * m, 420, [(t1, {'b': True, 'tam': 110 if alto else 96}), ('\n' + t2, {'i': True, 'cor': ROSE, 'tam': 140 if alto else 120})])
    yc = 760 if alto else 600
    hc = 520 if alto else 420
    caixa(s, m, yc, w - 2 * m, hc, CARD, 0.08)
    texto(s, m + 60, yc + 60, w - 2 * m - 120, hc - 200, corpo, 38 if alto else 34)
    caixa(s, m + 60, yc + hc - 130, w - 2 * m - 120, 80, INK, 0.3)
    texto(s, m + 60, yc + hc - 130, w - 2 * m - 120, 80, [(cta, {'b': True, 'cor': 'FFFFFF', 'tam': 30})], alinha='c', meio=True)
    listras(s, m, h - 200, w - 2 * m, 36)

# =============== manual do cliente (A4 paisagem 1123 x 794) ===============
MANUAL = [
    ('boas-vindas', 'que bom ter você ', 'aqui', 'Este guia mostra como o seu projeto acontece, o que você recebe em cada etapa e como a gente se comunica. Guarde para consultar quando quiser.'),
    ('etapa 1', 'conhecer a ', 'casa', 'Visita para medir e fotografar tudo. Você conta a rotina da família e o que espera do projeto. Tenha em mãos a planta do imóvel e as regras do condomínio.'),
    ('etapa 2', 'estudo ', 'preliminar', 'Apresento o layout e as referências. É a hora de opinar: estão incluídas [2] rodadas de ajustes. Nada vai para a obra sem a sua aprovação.'),
    ('etapa 3', 'imagens ', '3D', 'Você vê os ambientes prontos antes de gastar com a obra: cores, materiais e iluminação. [1] rodada de ajustes incluída.'),
    ('etapa 4', 'projeto ', 'executivo', 'Os desenhos que os fornecedores usam: plantas, marcenaria, iluminação, pontos elétricos e hidráulicos e lista de materiais.'),
    ('durante a obra', 'a obra ', 'começou', 'Antes de mudar qualquer coisa na obra, me consulte. Envie fotos das etapas importantes. Visitas de acompanhamento: [x incluídas / sob consulta].'),
    ('combinados', 'como a gente ', 'conversa', 'Respondo de [segunda a sexta, das 9h às 18h], pelo [WhatsApp]. Decisões e aprovações por escrito. Reuniões marcadas com [2] dias de antecedência.'),
    ('contato', 'conte ', 'comigo', '[seu nome] · [CAU]\n[WhatsApp] · [e-mail]\n[@seuperfil] · [site]'),
]
def manual(p):
    W, H = 1123, 794
    for i, (olho, t1, t2, corpo) in enumerate(MANUAL):
        s = slide(p)
        texto(s, 70, 60, 500, 30, '[SEU ESCRITÓRIO]', 16, ROSE)
        texto(s, W - 270, 60, 200, 30, f'{i + 1:02d} / {len(MANUAL):02d}', 16, MUTED, 'r')
        texto(s, 70, 200, 470, 30, olho, 20, ROSE)
        texto(s, 70, 240, 470, 300, [(t1, {'b': True, 'tam': 54}), ('\n' + t2, {'i': True, 'cor': ROSE, 'tam': 68})])
        caixa(s, 580, 150, 473, 500, CARD, 0.07)
        texto(s, 625, 200, 383, 400, corpo, 26)
        listras(s, 70, H - 100, W - 140, 22, 20)

# ---------------- HTML espelho para o PDF ----------------
E = html.escape
def pdf_html(nome, paginas, w_mm, h_mm):
    css = f"""@font-face{{font-family:Poppins;font-weight:400;src:url('{FONTS}/poppins-latin-400-normal.woff2')}}
@font-face{{font-family:Poppins;font-weight:600;src:url('{FONTS}/poppins-latin-600-normal.woff2')}}
@font-face{{font-family:Poppins;font-weight:700;src:url('{FONTS}/poppins-latin-700-normal.woff2')}}
@font-face{{font-family:Corm;font-style:italic;src:url('{FONTS}/cormorant-garamond-latin-500-italic.woff2')}}
@page{{size:{w_mm}mm {h_mm}mm;margin:0}} body{{margin:0;font-family:Poppins;color:#3e4b57}}
.pg{{width:{w_mm}mm;height:{h_mm}mm;background:#f5f1ee;position:relative;overflow:hidden;break-after:page;padding:{w_mm*0.08}mm;box-sizing:border-box;display:flex;flex-direction:column}}
.ol{{color:#a88a80;font-size:{w_mm*0.022}mm;letter-spacing:.14em;font-weight:600}}
.t{{font-weight:700;font-size:{w_mm*0.085}mm;line-height:1;letter-spacing:-.03em;margin:{w_mm*0.03}mm 0}}
.t em{{font-family:Corm;font-weight:500;color:#a88a80;font-size:1.2em;letter-spacing:0;display:block}}
.c{{background:#fff;border-radius:{w_mm*0.03}mm;padding:{w_mm*0.05}mm;font-size:{w_mm*0.032}mm;line-height:1.45;white-space:pre-line;margin-top:auto}}
.cta{{display:block;margin-top:{w_mm*0.04}mm;background:#3e4b57;color:#fff;border-radius:{w_mm*0.02}mm;padding:{w_mm*0.025}mm;text-align:center;font-weight:600}}
.fx{{height:{w_mm*0.03}mm;margin-top:{w_mm*0.05}mm;border-radius:2mm;background:repeating-linear-gradient(90deg,#f5f1ee 0 {w_mm*0.022}mm,#f4e8e5 {w_mm*0.022}mm {w_mm*0.044}mm)}}
.m{{color:#8b939a}}
.row{{display:flex;justify-content:space-between;padding:{w_mm*0.012}mm 0;border-bottom:1px solid #ebe1dc;font-size:{w_mm*0.03}mm}} .row b{{font-weight:700}}
.bl{{background:#fff;border-radius:{w_mm*0.03}mm;padding:{w_mm*0.04}mm;margin-top:{w_mm*0.025}mm}} .bl i{{font-family:Corm;color:#a88a80;font-size:{w_mm*0.05}mm}}"""
    open(os.path.join(HTMLDIR, nome + '.html'), 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>' + ''.join(paginas) + '</body></html>')

def pg_aviso(a):
    _, t1, t2, olho, corpo, cta = a
    return f'<div class="pg"><span class="ol">[SEU ESPAÇO]</span><p class="m" style="margin:6mm 0 0;font-size:5mm">{E(olho)}</p><div class="t">{E(t1.strip())}<em>{E(t2)}</em></div><div class="c">{E(corpo)}<span class="cta">{E(cta)}</span></div><div class="fx"></div></div>'

def pg_tabela():
    bl = ''.join(f'<div class="bl"><i>{E(n)}</i>' + ''.join(f'<div class="row"><span>{E(s)}</span><b>{E(v)}</b></div>' for s, v in it) + '</div>' for n, it in SERV)
    return f'<style>.tp .t{{font-size:13mm}} .tp .bl{{padding:6mm 8mm;margin-top:4mm}} .tp .row{{font-size:4.2mm;padding:2mm 0}} .tp .bl i{{font-size:7mm}}</style><div class="pg tp"><span class="ol">[SEU ESPAÇO]</span><div class="t">tabela de<em>preços</em></div>{bl}<div class="fx"></div><p class="m" style="text-align:center;font-size:3.6mm">[agende pelo WhatsApp] · [@seuperfil]</p></div>'

def pg_manual(i, m):
    olho, t1, t2, corpo = m
    return f'<div class="pg" style="flex-direction:row;gap:12mm;align-items:center"><div style="flex:1"><span class="ol">{E(olho)}</span><div class="t" style="font-size:16mm">{E(t1.strip())}<em>{E(t2)}</em></div><span class="m">{i + 1:02d} / {len(MANUAL):02d}</span></div><div class="c" style="flex:1;margin:0;font-size:5mm">{E(corpo)}</div></div>'

os.makedirs(OUT, exist_ok=True); os.makedirs(HTMLDIR, exist_ok=True)
# tabela de preços
p = novo(1080, 1350); tabela_precos(p, 1080, 1350); tabela_precos(p, 1080, 1920) if False else None
p.save(os.path.join(OUT, 'beleza-precos-feed.pptx'))
p = novo(1080, 1920); tabela_precos(p, 1080, 1920); p.save(os.path.join(OUT, 'beleza-precos-stories.pptx'))
pdf_html('beleza-precos', [pg_tabela()], 210, 297)
# vale e fidelidade
p = novo(1004, 650); vale(p); p.save(os.path.join(OUT, 'beleza-vale.pptx'))
# fim de ano
p = novo(1080, 1920); [aviso(p, 1080, 1920, a) for a in AVISOS]; p.save(os.path.join(OUT, 'beleza-fim-de-ano-stories.pptx'))
p = novo(1080, 1350); [aviso(p, 1080, 1350, a) for a in AVISOS]; p.save(os.path.join(OUT, 'beleza-fim-de-ano-feed.pptx'))
pdf_html('beleza-fim-de-ano-previa', [pg_aviso(a) for a in AVISOS], 108, 192)
# manual
p = novo(1123, 794); manual(p); p.save(os.path.join(OUT, 'arq-manual.pptx'))
# vale-presente e fidelidade para imprimir: 8 cartões por folha A4 (85 x 55 mm), frente e verso em folhas seguidas
def cartoes(conteudo):
    return '<div class="pg" style="padding:12mm 15mm;display:grid;grid-template-columns:85mm 85mm;grid-auto-rows:55mm;gap:6mm 10mm;justify-content:center;background:#fff">' + ''.join(conteudo for _ in range(8)) + '</div>'
CV = 'style="border:1px dashed #d9ccc6;border-radius:3mm;padding:5mm 6mm;background:#f5f1ee;display:flex;flex-direction:column;box-sizing:border-box"'
vf = f'<div {CV}><span class="ol" style="font-size:2.6mm">[SEU ESPAÇO]</span><div style="font-weight:700;font-size:9mm;line-height:1;margin-top:4mm">vale<em style="font-family:Corm;font-weight:500;color:#a88a80;font-size:11mm;display:block">presente</em></div><span class="m" style="margin-top:auto;font-size:2.8mm">um momento só seu, com carinho</span></div>'
vv = f'<div {CV}>' + ''.join(f'<div style="display:flex;gap:3mm;align-items:flex-end;height:8mm;border-bottom:1px solid #d9ccc6;font-size:2.6mm;color:#8b939a">{l}</div>' for l in ['para', 'de', 'serviço ou valor', 'válido até']) + '<span class="m" style="margin-top:auto;font-size:2.4mm;text-align:center">[WhatsApp] · [@seuperfil]</span></div>'
ff = f'<div {CV.replace("#f5f1ee", "#3e4b57")}><span class="ol" style="font-size:2.6mm;color:#d6b3ab">[SEU ESPAÇO]</span><div style="font-weight:700;font-size:8mm;line-height:1;margin-top:4mm;color:#fff">cartão<em style="font-family:Corm;font-weight:500;color:#d6b3ab;font-size:10mm;display:block">fidelidade</em></div><span style="margin-top:auto;font-size:2.8mm;color:#e8ebee">a cada 10 atendimentos, o 11º é presente</span></div>'
fv = f'<div {CV}><div style="font-size:2.6mm;color:#8b939a;border-bottom:1px solid #d9ccc6;height:6mm">nome</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:2mm;margin-top:4mm">' + ''.join(f'<span style="aspect-ratio:1;border-radius:2mm;background:{"#3e4b57" if i == 9 else "#f4e8e5"};color:{"#fff" if i == 9 else "#a88a80"};display:grid;place-items:center;font-weight:700;font-size:{"2.2mm" if i == 9 else "3.4mm"}">{"presente" if i == 9 else i + 1}</span>' for i in range(10)) + '</div></div>'
pdf_html('beleza-vale', [cartoes(vf), cartoes(vv), cartoes(ff), cartoes(fv)], 210, 297)
pdf_html('arq-manual', [pg_manual(i, m) for i, m in enumerate(MANUAL)], 297, 210)
print('ok slides')
