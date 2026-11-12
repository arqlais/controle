# Desenhos de linha (vetor, curvas suaves) para as fichas: rosto, olhos (mapa de cílios) e corpo (frente e costas).
import sys, os
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
INK, GUIA, AC = '#3E4B57', '#E2CFC8', '#A88A80'

def suave(pts, fechado=False, t=0.5):
    """Catmull-Rom → curvas de Bézier."""
    P = pts[:]
    if fechado: P = [pts[-1]] + pts + pts[:2]
    else: P = [pts[0]] + pts + [pts[-1]]
    d = f'M{P[1][0]:.1f},{P[1][1]:.1f}'
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        d += f' C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}'
    return d + (' Z' if fechado else '')

def esp(pts, cx): return [(2 * cx - x, y) for x, y in pts]
def svg(w, h, corpo): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="white"/>{corpo}</svg>'
def path(d, cor=INK, sw=3, fill='none'): return f'<path d="{d}" fill="{fill}" stroke="{cor}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'
def txt(x, y, t, tam=22, cor=AC): return f'<text x="{x}" y="{y}" font-family="Poppins" font-size="{tam}" fill="{cor}" text-anchor="middle" letter-spacing="2">{t}</text>'

# ---------- rosto (proporções clássicas: olhos na metade, nariz a 1/5, boca a 1/3 do queixo) ----------
cx = 350
rosto = [(350, 90), (450, 110), (520, 190), (545, 300), (540, 410), (520, 500), (480, 590), (420, 660), (350, 690)]
face = suave(rosto + esp(rosto[-2:0:-1], cx), True)
g = ''
for y in (380, 520, 600): g += path(f'M150,{y} L550,{y}', GUIA, 1.5)
g += path('M350,70 L350,710', GUIA, 1.5)
for x in (230, 470): g += path(f'M{x},250 L{x},420', GUIA, 1.5)
c = path(face, INK, 3)
for s in (1, -1):
    def X(x): return cx + s * (x - cx)
    sob = [(X(275), 330), (X(300), 318), (X(340 - 10), 314), (X(300 + 115), 312), (X(440), 318), (X(465), 330)]
    sob = [(X(262), 336), (X(300), 316), (X(370 - 40), 309), (X(400), 312), (X(440), 324), (X(470), 342)]
    sob = [(X(x if s > 0 else x), y) for x, y in []] or sob
    # sobrancelha: forma afinada (cabeça larga, cauda fina)
    topo = [(X(394), 334), (X(420), 318), (X(452), 312), (X(484), 318), (X(505), 334)]
    base = [(X(505), 336), (X(480), 327), (X(452), 324), (X(422), 331), (X(396), 344)]
    if s < 0:
        topo = [(2 * cx - x, y) for x, y in [(394, 334), (420, 318), (452, 312), (484, 318), (505, 334)]]
        base = [(2 * cx - x, y) for x, y in [(505, 336), (480, 327), (452, 324), (422, 331), (396, 344)]]
    c += path(suave(topo + base, True), INK, 1.5, INK)
    # olho amendoado
    olho_c = [(X(400), 382), (X(430), 366), (X(462), 362), (X(492), 372), (X(508), 384)]
    olho_b = [(X(508), 384), (X(486), 394), (X(456), 398), (X(424), 394), (X(400), 382)]
    c += path(suave(olho_c) + ' ' + suave(olho_b)[0:0], INK, 3)
    c += path(suave(olho_b), INK, 2)
    c += f'<circle cx="{X(455)}" cy="380" r="13" fill="none" stroke="{INK}" stroke-width="2.5"/><circle cx="{X(455)}" cy="380" r="5" fill="{INK}"/>'
# nariz
c += path(suave([(338, 400), (334, 460), (330, 505)]), INK, 2)
c += path(suave([(318, 512), (328, 525), (350, 530), (372, 525), (382, 512)]), INK, 2.5)
c += path(suave([(312, 506), (306, 518), (316, 528)]), INK, 2) + path(suave([(388, 506), (394, 518), (384, 528)]), INK, 2)
# boca
lab_sup = [(300, 600), (320, 590), (338, 584), (350, 590), (362, 584), (380, 590), (400, 600)]
lab_inf = [(400, 600), (380, 616), (350, 622), (320, 616), (300, 600)]
c += path(suave(lab_sup), INK, 2.5) + path(suave(lab_inf), INK, 2.5) + path('M302,600 Q350,606 398,600', INK, 1.5)
c += txt(230, 760, 'direito') + txt(470, 760, 'esquerdo')
open(f'{OUT}/rosto.svg', 'w').write(svg(700, 790, g + c))

# ---------- olhos: mapa de cílios (7 zonas, com caixinhas para mm e curvatura) ----------
def mapa_olho(ox, rot):
    import math
    W = 500; mid = ox + W / 2
    lid = lambda x: 300 - 95 * (1 - ((x - mid) / (W / 2)) ** 2)
    c = path(suave([(ox, 300), (ox + 90, lid(ox + 90)), (mid, lid(mid)), (ox + W - 90, lid(ox + W - 90)), (ox + W, 300)]), INK, 3.5)
    c += path(suave([(ox + W, 300), (ox + 370, 345), (mid, 358), (ox + 130, 345), (ox, 300)]), GUIA, 2.5)
    def raio(x, L):
        y = lid(x); dx, dy = x - mid, y - 520; n = math.hypot(dx, dy)
        return (x + dx / n * L, y + dy / n * L)
    xs = [ox + 40 + i * (W - 80) / 7 for i in range(8)]
    for x in xs:
        x0, y0 = raio(x, 6); x1, y1 = raio(x, 70)
        c += path(f'M{x0:.1f},{y0:.1f} L{x1:.1f},{y1:.1f}', GUIA, 1.5)
    for i in range(7):
        bx, by = raio((xs[i] + xs[i + 1]) / 2, 115)
        c += f'<rect x="{bx - 24:.1f}" y="{by - 18:.1f}" width="48" height="36" rx="9" fill="white" stroke="{AC}" stroke-width="2"/>'
    c += txt(mid, 420, rot, 24)
    return c
open(f'{OUT}/olhos.svg', 'w').write(svg(1300, 450, mapa_olho(70, 'direito') + mapa_olho(730, 'esquerdo')))

# ---------- corpo: silhueta feminina, 8 cabeças (frente e costas) ----------
def silhueta(cx, costas):
    U = 92  # altura da cabeça
    def P(pts): return [(cx + x * U / 100, 30 + y * U / 100) for x, y in pts]
    c = f'<ellipse cx="{cx}" cy="{30 + 50 * U / 100}" rx="{36 * U / 100}" ry="{50 * U / 100}" fill="none" stroke="{INK}" stroke-width="3"/>'
    lado = [(15, 96), (17, 118), (34, 132), (62, 142), (80, 156), (84, 178)]
    # tronco + perna (lado direito), do pescoço até o meio entre as pernas
    tronco = [(84, 178), (78, 214), (70, 250), (64, 290), (58, 320), (62, 352), (72, 384), (76, 412), (72, 460), (64, 520), (56, 580), (52, 612), (56, 660), (50, 720), (40, 760), (44, 786), (30, 792), (16, 788), (14, 760), (16, 720), (20, 664), (18, 612), (14, 560), (10, 500), (5, 456), (0, 440)]
    dir_ = lado + tronco
    esq = [(-x, y) for x, y in reversed(dir_)]
    c += path(suave(P(dir_[:-1] + esq[1:]), False), INK, 3)
    # braços (fora do tronco)
    for s in (1, -1):
        braco = [(80, 156), (92, 176), (96, 220), (98, 270), (100, 320), (104, 370), (108, 410), (112, 446), (106, 470), (96, 466), (94, 440), (92, 410), (86, 370), (82, 320), (80, 280)]
        c += path(suave(P([(s * x, y) for x, y in braco])), INK, 3)
    if not costas:
        c += f'<circle cx="{cx}" cy="{30 + 340 * U / 100}" r="3" fill="{INK}"/>'
    else:
        c += path(suave(P([(0, 130), (0, 260), (0, 360)])), GUIA, 2)
        for s in (1, -1): c += path(suave(P([(s * 22, 170), (s * 40, 200), (s * 30, 228)])), GUIA, 2)
        c += path(suave(P([(-40, 420), (-20, 432), (0, 428)])), GUIA, 2) + path(suave(P([(40, 420), (20, 432), (0, 428)])), GUIA, 2)
    c += txt(cx, 30 + 830 * U / 100, 'costas' if costas else 'frente', 24)
    return c
open(f'{OUT}/corpo.svg', 'w').write(svg(900, 830, silhueta(230, False) + silhueta(670, True)))
print('ok')
