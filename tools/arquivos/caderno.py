# Caderno de treino de design de sobrancelha (A4, para cursos e alunas), nos 4 estilos.
# Os rostos são desenhos (sem foto de modelo, que tem direito de imagem). Uso: python3 caderno.py <saída> <pasta com rosto-frente.png>
import base64, html, math, os, sys
from temas_html import FONTES, TEMAS, vars_css

OUT = os.path.join(sys.argv[1], 'html'); os.makedirs(OUT, exist_ok=True)
ARTE = sys.argv[2]
E = html.escape
def img(n): return 'data:image/png;base64,' + base64.b64encode(open(os.path.join(ARTE, n + '.png'), 'rb').read()).decode()
ROSTO = img('rosto-frente')

CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Poppins', sans-serif; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pg { width: 210mm; height: 297mm; padding: 16mm 16mm 13mm; position: relative; background: var(--bg); display: flex; flex-direction: column; align-items: center; gap: 6mm; page-break-after: always; overflow: hidden; }
.pg:last-child { page-break-after: auto; }
.moldura { position: absolute; inset: 7mm; border: .35mm solid var(--fio); border-radius: calc(var(--raio) * 1.5); pointer-events: none; }
h1, h2 { margin: 0; font-family: var(--tit); font-weight: var(--tit-w); font-style: var(--tit-it); text-transform: var(--caixa); letter-spacing: var(--esp); line-height: 1; text-align: center; color: var(--ink); }
h1 { font-size: 46pt; } h2 { font-size: 22pt; }
.cur { font-family: var(--script); color: var(--ac); font-size: 26pt; line-height: .9; }
.etq { border: .35mm solid var(--ink); padding: 1.6mm 5mm 1.6mm 7mm; letter-spacing: .5em; font-size: 10pt; text-transform: uppercase; border-radius: var(--raio); }
.perg { border: .3mm solid var(--ac2); border-radius: var(--raio); padding: 1.6mm 4mm; font-size: 8.6pt; letter-spacing: .06em; text-transform: uppercase; text-align: center; }
.lin { width: 100%; } .lin i { display: block; border-bottom: .3mm solid var(--fio); height: 8mm; }
.campo { width: 100%; display: flex; gap: 2mm; align-items: flex-end; font-family: var(--tit); font-size: 13pt; }
.campo i { flex: 1; border-bottom: .3mm solid var(--ink); height: 6mm; }
.rodape { position: absolute; bottom: 10mm; left: 0; right: 0; text-align: center; font-size: 7pt; letter-spacing: .3em; color: var(--mut); text-transform: uppercase; }
.rosto { position: relative; width: 150mm; height: 175mm; }
.rosto img { width: 100%; height: 100%; object-fit: contain; }
.grade2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 8mm; width: 100%; }
.mini { position: relative; }
.mini img { width: 100%; display: block; }
.mini small { display: block; text-align: center; font-size: 7.5pt; letter-spacing: .2em; text-transform: uppercase; color: var(--mut); margin-top: 1mm; }
svg.tr { width: 100%; }
"""
EXTRA = {'criativo': '.moldura{border:0}.pg::before{content:"";position:absolute;width:70mm;height:70mm;border-radius:50%;background:var(--soft);top:-25mm;right:-22mm}.pg>*{position:relative}.pg>.moldura,.pg>.rodape{position:absolute}',
         'minimalista': '.moldura{border-color:var(--ink);border-radius:0}', 'elegante': '.moldura{border-color:var(--ac2);outline:.25mm solid var(--fio);outline-offset:-3mm}'}

def pg(c, rod=True): return f'<section class="pg"><div class="moldura"></div>{c}{"<div class=rodape>[nome do curso] · [seu nome]</div>" if rod else ""}</section>'
def linhas(n): return '<div class="lin">' + '<i></i>' * n + '</div>'

# traçados de coordenação motora (pontilhados de verdade, em SVG)
def tracejado(tipo, y, w=178):
    if tipo == 'laco':
        d = ''.join(f'M{x} {y + 6} C{x + 8} {y + 6} {x + 14} {y + 2} {x + 14} {y - 6} C{x + 14} {y - 14} {x + 6} {y - 14} {x + 6} {y - 6} C{x + 6} {y + 6} {x + 14} {y + 12} {x + 26} {y + 12} ' for x in range(2, w - 26, 30))
    elif tipo == 'onda':
        d = f'M2 {y}' + ''.join(f' Q{x + 7.5} {y - 9} {x + 15} {y} T{x + 30} {y}' for x in range(2, w - 30, 30))
    else:
        d = f'M2 {y}' + ''.join(f' Q{x + 15} {y - 14} {x + 30} {y} T{x + 60} {y}' for x in range(2, w - 60, 60))
    return f'<path d="{d}" fill="none" stroke="var(--ink)" stroke-width=".45" stroke-dasharray="1.6 1.4" stroke-linecap="round"/><line x1="0" x2="{w}" y1="{y + 15}" y2="{y + 15}" stroke="var(--fio)" stroke-width=".3"/>'
def coord():
    h = 0; corpo = ''
    for i, t in enumerate(['laco'] * 3 + ['onda'] * 3 + ['larga'] * 3):
        corpo += tracejado(t, 14 + i * 25)
    return f'<svg class="tr" viewBox="0 0 178 240">{corpo}</svg>'

# desenho à mão livre: pares de sobrancelhas guia (com pontos de início, arco e fim) e pontos para ligar
def guia(x, y, esp=False, so_pontos=False):
    s = -1 if esp else 1
    pts = [(x, y + 3), (x + s * 26, y - 4), (x + s * 38, y + 1)]
    out = ''.join(f'<circle cx="{px}" cy="{py}" r=".9" fill="var(--ac)"/>' for px, py in pts)
    if not so_pontos:
        out += f'<path d="M{x} {y + 3} Q{x + s * 14} {y - 6} {x + s * 26} {y - 4} Q{x + s * 33} {y - 3} {x + s * 38} {y + 1}" fill="none" stroke="var(--ink)" stroke-width=".4" stroke-dasharray="1.2 1.2"/>'
        out += f'<path d="M{x} {y + 6} Q{x + s * 14} {y - 1} {x + s * 26} {y} Q{x + s * 33} {y + 1} {x + s * 38} {y + 1}" fill="none" stroke="var(--ink)" stroke-width=".4" stroke-dasharray="1.2 1.2"/>'
    return out
def maolivre(so_pontos=False):
    corpo = ''.join(guia(80, 12 + i * 23, True, so_pontos) + guia(98, 12 + i * 23, False, so_pontos) for i in range(10))
    return f'<svg class="tr" viewBox="0 0 178 235">{corpo}</svg>'

def rosto(rotulo=''):
    return f'<div class="rosto"><img src="{ROSTO}" alt=""></div>' + (f'<span class="perg">{E(rotulo)}</span>' if rotulo else '')

PAGS = [
    pg('<div style="flex:1"></div><span class="etq">caderno de</span><h1>treinos &amp;</h1><span class="cur" style="font-size:40pt">atividades</span><div style="height:8mm"></div><p style="font-size:9pt;letter-spacing:.3em;text-transform:uppercase;color:var(--mut)">design de sobrancelhas</p><div style="flex:1"></div><div class="campo" style="width:70%">aluna <i></i></div><div style="height:12mm"></div>', False),
    pg('<h2>atividades</h2><span class="perg">qual o nome de cada ponto da sobrancelha?</span>'
       + f'<div style="position:relative;width:120mm"><img src="{ROSTO}" style="width:100%;height:78mm;object-fit:cover;object-position:50% 34%"></div>'
       + '<div class="campo">PI <i></i></div><div class="campo">PA <i></i></div><div class="campo">PF <i></i></div>'
       + '<div style="height:4mm"></div><span class="perg">qual a proporção do corpo e da cauda?</span><div class="campo">corpo <i></i></div><div class="campo">cauda <i></i></div>'),
    pg('<h2>atividades</h2><span class="perg">quantos dias de intervalo até a cliente voltar?</span>' + linhas(2) + '<span class="perg">quando é preciso fazer o teste de alergia?</span>' + linhas(9)
       + '<span class="perg">qual o tempo máximo de ação da henna?</span>' + linhas(2) + '<span class="perg">por que a higienização das sobrancelhas é importante?</span>' + linhas(6)),
    pg('<span class="cur">treine a sua</span><h2>coordenação motora</h2>' + coord()),
    pg('<span class="cur">treine o desenho</span><h2>à mão livre</h2><span class="perg">cubra o pontilhado e depois faça sozinha</span>' + maolivre()),
    pg('<span class="cur">treine o desenho</span><h2>à mão livre</h2><span class="perg">ligue os pontos: início, ponto alto e final</span>' + maolivre(True)),
    pg('<span class="cur">mapeamento</span><h2>marque os pontos</h2>' + rosto('trace as linhas e marque PI, PA e PF')),
    pg('<span class="cur">desenhe a</span><h2>sobrancelha ideal</h2>' + rosto('desenhe e deixe as duas iguais')),
    pg('<span class="cur">visagismo</span><h2>escolha o formato</h2><div class="grade2">' + ''.join(f'<div class="mini"><img src="{ROSTO}" style="height:58mm;object-fit:cover;object-position:50% 30%"><small>{t}</small></div>' for t in ['arqueada', 'reta', 'angulada', 'suave']) + '</div>'
       + '<span class="perg">por que escolheu cada formato?</span>' + linhas(4)),
    pg('<span class="cur">anotações</span><h2>do curso</h2>' + linhas(24)),
]
for t in TEMAS:
    n = 'sob-caderno' if t == 'criativo' else f'sob-caderno--{t}'
    open(os.path.join(OUT, n + '.html'), 'w', encoding='utf-8').write(f"<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>{FONTES}<style>{vars_css(t)}{CSS}{EXTRA.get(t, '')}</style></head><body>{''.join(PAGS)}</body></html>")
print('ok')
