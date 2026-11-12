# Desenhos de linha para anotar nas fichas (rosto, olhos, corpo) e o espaço da logo.
from PIL import Image, ImageDraw, ImageFont
import os, sys
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
INK = (62, 75, 87); ROSE = (168, 138, 128); SOFT = (214, 179, 171)
F = lambda s: ImageFont.truetype(os.path.expanduser('~/.fonts/poppins-latin-500-normal.ttf'), s)
def novo(w, h): im = Image.new('RGB', (w, h), 'white'); return im, ImageDraw.Draw(im)
L = 6
# rosto de frente
im, d = novo(1400, 1500)
d.ellipse([350, 200, 1050, 1250], outline=INK, width=L)
for sx in (1, -1):
    cx = 700 + sx * 170
    d.arc([cx - 120, 500, cx + 120, 620], 200 if sx > 0 else 200, 340, fill=INK, width=L)       # sobrancelha
    d.ellipse([cx - 80, 610, cx + 80, 680], outline=INK, width=L)                               # olho
    d.ellipse([cx - 22, 625, cx + 22, 665], fill=INK)
d.line([(700, 650), (680, 860), (720, 880)], fill=INK, width=L)                                    # nariz
d.arc([600, 900, 800, 1000], 20, 160, fill=INK, width=L)                                           # boca
for x in (440, 960): d.line([(x, 560), (x, 760)], fill=SOFT, width=3)                             # guias
d.line([(700, 300), (700, 1180)], fill=SOFT, width=3)
d.line([(380, 600), (1020, 600)], fill=SOFT, width=3)
d.text((560, 1320), 'direito    ·    esquerdo', fill=ROSE, font=F(40))
im.save(f'{OUT}/rosto.png')
# olhos com regiões para o mapa de cílios
im, d = novo(1600, 700)
for i, cx in enumerate((420, 1180)):
    d.arc([cx - 300, 200, cx + 300, 560], 190, 350, fill=INK, width=L)
    d.arc([cx - 300, 160, cx + 300, 520], 10, 170, fill=INK, width=L)
    for k in range(7):
        x = cx - 270 + k * 90
        d.line([(x, 290), (x - 10 + (k - 3) * 8, 160)], fill=SOFT, width=4)
        d.ellipse([x - 32, 90, x + 32, 150], outline=ROSE, width=4)
    d.text((cx - 70, 600), 'direito' if i == 0 else 'esquerdo', fill=ROSE, font=F(40))
im.save(f'{OUT}/olhos.png')
# corpo de frente e de costas (silhueta simples)
im, d = novo(1600, 1600)
def corpo(cx, rot):
    d.ellipse([cx - 90, 80, cx + 90, 280], outline=INK, width=L)                                   # cabeça
    d.line([(cx - 40, 280), (cx - 40, 330)], fill=INK, width=L); d.line([(cx + 40, 280), (cx + 40, 330)], fill=INK, width=L)
    d.polygon([(cx - 190, 340), (cx + 190, 340), (cx + 150, 780), (cx - 150, 780)], outline=INK, width=L)  # tronco
    d.line([(cx - 190, 340), (cx - 280, 760), (cx - 250, 860)], fill=INK, width=L); d.line([(cx + 190, 340), (cx + 280, 760), (cx + 250, 860)], fill=INK, width=L)  # braços
    d.polygon([(cx - 150, 780), (cx + 150, 780), (cx + 140, 900), (cx - 140, 900)], outline=INK, width=L)  # quadril
    d.line([(cx - 130, 900), (cx - 110, 1450), (cx - 30, 1450), (cx - 10, 940)], fill=INK, width=L)       # pernas
    d.line([(cx + 130, 900), (cx + 110, 1450), (cx + 30, 1450), (cx + 10, 940)], fill=INK, width=L)
    d.text((cx - 90, 1500), rot, fill=ROSE, font=F(40))
corpo(420, 'frente'); corpo(1180, 'costas')
im.save(f'{OUT}/corpo.png')
# espaço da logo
im, d = novo(520, 200)
d.rounded_rectangle([6, 6, 514, 194], radius=30, outline=SOFT, width=5)
d.text((150, 70), 'sua logo', fill=ROSE, font=F(46))
im.save(f'{OUT}/logo.png')
print('ok')
