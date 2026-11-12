# Gera os documentos (Word editável + HTML para o PDF) a partir de textos.py.
import html, os, sys
from docx import Document
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm
import importlib
DOCS = importlib.import_module(os.environ.get('TEXTOS', 'textos')).DOCS
MAPAS = os.environ.get('MAPAS', '')
from docx.shared import Cm as _Cm

OUT = sys.argv[1]
HTMLDIR = sys.argv[2]
FONTS = sys.argv[3]  # pasta com as fontes woff2

INK = RGBColor(0x3E, 0x4B, 0x57)
ROSE = RGBColor(0xA8, 0x8A, 0x80)
MUTED = RGBColor(0x8B, 0x93, 0x9A)
LINE = 'D9CCC6'
FILL = 'F4E8E5'
FONT = 'Poppins'

FRENTE = lambda pid: 'planê.arq' if pid.startswith('arq') else 'planê.arquivos'

# ---------------- Word ----------------
def run(p, text, size=10, bold=False, color=INK, italic=False):
    r = p.add_run(text)
    r.font.name = FONT
    r._element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    return r

def para(d, text='', size=10, bold=False, color=INK, before=0, after=4, italic=False):
    p = d.add_paragraph()
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    if text:
        run(p, text, size, bold, color, italic)
    return p

def borda(cell, lados=('bottom',), cor=LINE, sz=6):
    tcPr = cell._tc.get_or_add_tcPr()
    b = OxmlElement('w:tcBorders')
    for lado in ('top', 'left', 'bottom', 'right'):
        e = OxmlElement(f'w:{lado}')
        if lado in lados:
            e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), str(sz)); e.set(qn('w:color'), cor)
        else:
            e.set(qn('w:val'), 'nil')
        b.append(e)
    tcPr.append(b)

def fundo(cell, cor):
    tcPr = cell._tc.get_or_add_tcPr()
    s = OxmlElement('w:shd'); s.set(qn('w:val'), 'clear'); s.set(qn('w:color'), 'auto'); s.set(qn('w:fill'), cor)
    tcPr.append(s)

def celula(cell, text, size=9.5, bold=False, color=INK):
    cell.paragraphs[0].paragraph_format.space_after = Pt(2)
    if text:
        run(cell.paragraphs[0], text, size, bold, color)

def docx_doc(pid, d):
    doc = Document()
    for s in doc.sections:
        s.top_margin = s.bottom_margin = Cm(2); s.left_margin = s.right_margin = Cm(2.2)
    st = doc.styles['Normal']; st.font.name = FONT; st.font.size = Pt(10); st.font.color.rgb = INK
    capa = True
    para(doc, FRENTE(pid), 9, True, ROSE, after=2)
    para(doc, d['titulo'], 22, True, INK, after=10)
    for b in d['blocos']:
        k = b[0]
        if k == 'quebra':
            capa = False
            doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
        elif k == 'lead':
            para(doc, b[1], 11, color=MUTED, after=10)
        elif k == 'logo':
            pl = doc.add_paragraph(); pl.alignment = 2; pl.add_run().add_picture(os.path.join(MAPAS, 'logo.png'), width=_Cm(3.6))
        elif k == 'mapa':
            pm = doc.add_paragraph(); pm.alignment = 1; pm.add_run().add_picture(os.path.join(MAPAS, b[1] + '.png'), width=_Cm(11 if b[1] != 'olhos' else 14))
        elif k == 'passos':
            para(doc, 'como usar', 9, True, ROSE, before=6)
            for i, t in enumerate(b[1], 1):
                p = para(doc, after=3); run(p, f'{i}   ', 10, True, ROSE); run(p, t)
        elif k == 'nota':
            t = doc.add_table(rows=1, cols=1); c = t.rows[0].cells[0]; fundo(c, FILL); borda(c, ())
            celula(c, b[1], 9, color=INK)
            para(doc, after=4)
        elif k == 'h1':
            para(doc, b[1], 17, True, INK, after=2)
        elif k == 'sub':
            para(doc, b[1], 9, color=MUTED, after=10)
        elif k == 'h2':
            para(doc, b[1].lower(), 11, True, ROSE, before=12, after=4)
        elif k == 'p':
            para(doc, b[1], after=6)
        elif k == 'clausula':
            para(doc, b[1], 10, True, before=6, after=2); para(doc, b[2], after=4)
        elif k in ('lista',):
            for t in b[1]:
                p = para(doc, after=3); run(p, '–  ', 10, True, ROSE); run(p, t)
        elif k == 'check':
            for t in b[1]:
                p = para(doc, after=3); run(p, '☐  ', 11, False, ROSE); run(p, t)
        elif k == 'campos':
            t = doc.add_table(rows=0, cols=2)
            for lab in b[1]:
                r = t.add_row().cells
                celula(r[0], lab, 9, color=MUTED); borda(r[0], ()); borda(r[1], ('bottom',))
                r[0].width = Cm(5.5); r[1].width = Cm(11.5)
            para(doc, after=2)
        elif k == 'simnao':
            t = doc.add_table(rows=0, cols=3)
            for q in b[1]:
                r = t.add_row().cells
                celula(r[0], q, 9); celula(r[1], '☐ sim   ☐ não', 9, color=ROSE)
                for c in r: borda(c, ('bottom',))
                r[0].width = Cm(9); r[1].width = Cm(3); r[2].width = Cm(5)
            para(doc, after=2)
        elif k == 'perguntas':
            for q in b[1]:
                para(doc, q, 10, True, before=4, after=2)
                t = doc.add_table(rows=2, cols=1)
                for row in t.rows: borda(row.cells[0], ('bottom',)); celula(row.cells[0], ' ')
        elif k == 'tabela':
            cab, linhas = b[1], b[2]
            t = doc.add_table(rows=1, cols=len(cab))
            for i, h in enumerate(cab):
                c = t.rows[0].cells[i]; fundo(c, FILL); borda(c, ('bottom',)); celula(c, h, 8.5, True)
            for ln in linhas:
                r = t.add_row().cells
                for i, v in enumerate(ln):
                    borda(r[i], ('bottom',)); celula(r[i], v or ' ', 9)
            para(doc, after=4)
        elif k == 'assinatura':
            para(doc, after=18)
            t = doc.add_table(rows=1, cols=len(b[1]))
            for i, lab in enumerate(b[1]):
                c = t.rows[0].cells[i]; borda(c, ('top',), '3E4B57', 6); celula(c, lab, 8.5, color=MUTED)
    os.makedirs(OUT, exist_ok=True)
    doc.save(os.path.join(OUT, f'{pid}.docx'))

# ---------------- HTML (PDF) ----------------
E = html.escape
CSS = f"""
@font-face {{ font-family: Poppins; font-weight: 400; src: url('{FONTS}/poppins-latin-400-normal.woff2'); }}
@font-face {{ font-family: Poppins; font-weight: 500; src: url('{FONTS}/poppins-latin-500-normal.woff2'); }}
@font-face {{ font-family: Poppins; font-weight: 600; src: url('{FONTS}/poppins-latin-600-normal.woff2'); }}
@font-face {{ font-family: Poppins; font-weight: 700; src: url('{FONTS}/poppins-latin-700-normal.woff2'); }}
@font-face {{ font-family: Seasons; font-style: italic; src: url('{FONTS}/the-seasons-italic.woff2'); }}
@page {{ size: A4; margin: 17mm 18mm 20mm; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: Poppins, sans-serif; font-size: 9.6pt; line-height: 1.5; color: #3e4b57; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.capa {{ min-height: 255mm; display: flex; flex-direction: column; background: #f5f1ee; border-radius: 6mm; padding: 16mm 14mm; break-after: page; position: relative; overflow: hidden; }}
.capa .frente {{ font-size: 9pt; font-weight: 600; color: #a88a80; letter-spacing: .12em; }}
.capa h1 {{ font-size: 30pt; line-height: 1.08; letter-spacing: -.03em; margin: 6mm 0 5mm; font-weight: 600; max-width: 140mm; }}
.capa h1 em {{ font-family: Seasons, serif; font-weight: 400; color: #a88a80; letter-spacing: 0; }}
.capa .lead {{ font-size: 11.5pt; color: #6f7a83; max-width: 135mm; }}
.capa .faixa {{ height: 12mm; margin: 10mm 0; border-radius: 3mm; background: repeating-linear-gradient(90deg, #f5f1ee 0 5mm, #f4e8e5 5mm 10mm); }}
.passos {{ margin-top: auto; background: #fff; border-radius: 5mm; padding: 7mm 8mm; }}
.passos b.t {{ display: block; font-size: 8.5pt; color: #a88a80; letter-spacing: .12em; margin-bottom: 3mm; }}
.passos div {{ display: flex; gap: 4mm; padding: 2mm 0; border-top: 1px solid #ebe1dc; }}
.passos div:first-of-type {{ border-top: 0; }}
.passos div i {{ font-style: normal; font-weight: 700; color: #a88a80; width: 6mm; }}
.nota {{ background: #f4e8e5; border-radius: 3mm; padding: 4mm 5mm; font-size: 8.8pt; margin: 4mm 0; }}
.capa .nota {{ background: #fff; margin-top: 6mm; }}
.pg {{ break-before: page; }}
h1.doc {{ font-size: 18pt; letter-spacing: -.02em; margin: 0 0 1mm; font-weight: 600; }}
.sub {{ color: #8b939a; font-size: 8.8pt; padding-bottom: 4mm; margin-bottom: 4mm; border-bottom: 1.5px solid #3e4b57; }}
h2 {{ font-size: 10.5pt; color: #a88a80; font-weight: 600; margin: 6mm 0 2.5mm; letter-spacing: .02em; text-transform: lowercase; break-after: avoid; }}
p {{ margin: 0 0 2.5mm; }}
.cl {{ break-inside: avoid; margin: 0 0 2.5mm; }}
.cl b {{ display: block; }}
.campos {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 8mm; }}
.campo {{ display: flex; align-items: flex-end; gap: 3mm; border-bottom: 1px solid #d9ccc6; height: 9mm; font-size: 8.4pt; color: #8b939a; break-inside: avoid; }}
.campo.full {{ grid-column: 1 / -1; }}
table {{ width: 100%; border-collapse: collapse; margin: 1mm 0 2mm; break-inside: auto; }}
th {{ background: #f4e8e5; text-align: left; font-size: 8.2pt; font-weight: 600; padding: 2mm 2.5mm; }}
th:first-child {{ border-radius: 2mm 0 0 2mm; }} th:last-child {{ border-radius: 0 2mm 2mm 0; }}
td {{ border-bottom: 1px solid #ebe1dc; padding: 2.2mm 2.5mm; font-size: 8.8pt; height: 8.5mm; vertical-align: top; }}
tr {{ break-inside: avoid; }}
.sn td:nth-child(2) {{ width: 26mm; color: #a88a80; white-space: nowrap; }}
.sn td:nth-child(3) {{ width: 45mm; }}
.box {{ display: inline-block; width: 3.2mm; height: 3.2mm; border: 1.2px solid #a88a80; border-radius: .9mm; vertical-align: -.4mm; margin-right: 2.5mm; }}
.check div {{ padding: 1.4mm 0; break-inside: avoid; }}
ul {{ margin: 0 0 2mm; padding-left: 5mm; }} li {{ margin: 0 0 1.4mm; }} li::marker {{ color: #a88a80; }}
.perg {{ break-inside: avoid; margin-bottom: 2mm; }}
.perg b {{ font-weight: 500; }}
.perg span {{ display: block; border-bottom: 1px solid #d9ccc6; height: 8mm; }}
.logo {{ float: right; width: 34mm; height: 13mm; border: 1.4px dashed #d6b3ab; border-radius: 3mm; display: grid; place-items: center; color: #a88a80; font-size: 8.5pt; font-weight: 600; margin: 0 0 2mm 6mm; }}
.mapa {{ text-align: center; margin: 2mm 0 4mm; break-inside: avoid; }} .mapa img {{ max-width: 120mm; max-height: 95mm; }}
.ass {{ display: flex; gap: 10mm; margin: 14mm 0 4mm; break-inside: avoid; }}
.ass div {{ flex: 1; border-top: 1.2px solid #3e4b57; padding-top: 1.5mm; font-size: 8.2pt; color: #8b939a; }}
"""

def h_titulo(t):
    # última palavra em itálico (The Seasons): nunca número
    w = t.split(' ')
    if len(w) > 1 and not any(ch.isdigit() for ch in w[-1]):
        return E(' '.join(w[:-1])) + ' <em>' + E(w[-1]) + '</em>'
    return E(t)

def html_doc(pid, d):
    out = [f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>{CSS}</style></head><body>']
    blocos = d['blocos']
    i = 0
    # capa: tudo antes da primeira quebra
    capa = []
    while i < len(blocos) and blocos[i][0] != 'quebra':
        capa.append(blocos[i]); i += 1
    tem_capa = i < len(blocos)
    if tem_capa:
        out.append(f'<section class="capa"><span class="frente">{FRENTE(pid)}</span><h1>{h_titulo(d["titulo"])}</h1>')
        for b in capa:
            if b[0] == 'lead': out.append(f'<p class="lead">{E(b[1])}</p><div class="faixa"></div>')
            elif b[0] == 'nota': out.append(f'<div class="nota">{E(b[1])}</div>')
        passos = next((b for b in capa if b[0] == 'passos'), None)
        if passos:
            out.append('<div class="passos"><b class="t">como usar</b>' + ''.join(f'<div><i>{n}</i><span>{E(t)}</span></div>' for n, t in enumerate(passos[1], 1)) + '</div>')
        out.append('</section>')
        i += 1
        resto = blocos[i:]
    else:
        out.append(f'<h1 class="doc">{E(d["titulo"])}</h1>')
        resto = [b for b in blocos]
    primeira = True
    for b in resto:
        k = b[0]
        if k == 'quebra': out.append('<div class="pg"></div>'); continue
        if k == 'lead': out.append(f'<p class="sub" style="font-size:10pt;color:#6f7a83">{E(b[1])}</p>')
        elif k == 'logo': out.append(f'<div class="logo">sua logo</div>')
        elif k == 'mapa': out.append(f'<div class="mapa"><img src="file://{os.path.join(MAPAS, b[1] + ".png")}"></div>')
        elif k == 'h1': out.append(f'<h1 class="doc">{E(b[1])}</h1>')
        elif k == 'sub': out.append(f'<div class="sub">{E(b[1])}</div>')
        elif k == 'h2': out.append(f'<h2>{E(b[1])}</h2>')
        elif k == 'p': out.append(f'<p>{E(b[1])}</p>')
        elif k == 'nota': out.append(f'<div class="nota">{E(b[1])}</div>')
        elif k == 'clausula': out.append(f'<div class="cl"><b>{E(b[1])}</b>{E(b[2])}</div>')
        elif k == 'lista': out.append('<ul>' + ''.join(f'<li>{E(t)}</li>' for t in b[1]) + '</ul>')
        elif k == 'passos': out.append('<ul>' + ''.join(f'<li>{E(t)}</li>' for t in b[1]) + '</ul>')
        elif k == 'check': out.append('<div class="check">' + ''.join(f'<div><span class="box"></span>{E(t)}</div>' for t in b[1]) + '</div>')
        elif k == 'campos':
            out.append('<div class="campos">' + ''.join(f'<div class="campo{" full" if len(l) > 30 else ""}">{E(l)}</div>' for l in b[1]) + '</div>')
        elif k == 'simnao':
            out.append('<table class="sn"><tbody>' + ''.join(f'<tr><td>{E(q)}</td><td><span class="box"></span>sim <span class="box" style="margin-left:2mm"></span>não</td><td></td></tr>' for q in b[1]) + '</tbody></table>')
        elif k == 'perguntas': out.append(''.join(f'<div class="perg"><b>{E(q)}</b><span></span><span></span></div>' for q in b[1]))
        elif k == 'tabela':
            out.append('<table><thead><tr>' + ''.join(f'<th>{E(h)}</th>' for h in b[1]) + '</tr></thead><tbody>' +
                       ''.join('<tr>' + ''.join(f'<td>{E(v)}</td>' for v in ln) + '</tr>' for ln in b[2]) + '</tbody></table>')
        elif k == 'assinatura': out.append('<div class="ass">' + ''.join(f'<div>{E(l)}</div>' for l in b[1]) + '</div>')
    out.append('</body></html>')
    os.makedirs(HTMLDIR, exist_ok=True)
    open(os.path.join(HTMLDIR, f'{pid}.html'), 'w').write(''.join(out))

for pid, d in DOCS.items():
    docx_doc(pid, d)
    html_doc(pid, d)
    print('ok', pid)
