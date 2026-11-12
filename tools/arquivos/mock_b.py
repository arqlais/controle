# Cenas de mockup dos produtos de beleza (mesmo desenho do mock.py), com as páginas reais.
import os, sys, glob
C = sys.argv[1]
src = open(os.path.join(os.path.dirname(__file__), 'mock.py')).read()
exec(src[:src.index("doc('beleza-anamnese'")])  # helpers: cena, pg, fone, flt, chips, doc, cartao, planilha (definida depois)
exec(src[src.index('def planilha('):src.index("planilha('beleza-caixa'")])

def cartao(src, x, y, w, rot, z):
    return f'<div class="it pg" style="left:{x}px;top:{y}px;width:{w}px;height:{int(w*55/85)}px;transform:rotate({rot}deg);z-index:{z};border-radius:18px"><img src="{img(src)}"></div>'

def pag(base, n=1):
    import re
    fs = sorted([f for f in glob.glob(os.path.join(PG, f'{base}-*.png')) if re.fullmatch(re.escape(base) + r'-\d+\.png', os.path.basename(f))], key=lambda f: int(f.rsplit('-', 1)[1][:-4]))
    return os.path.basename(fs[min(n, len(fs)) - 1])

def stories(pid, base, n1, n2, f1, fmt=('Canva', 'PDF')):
    cena(pid, fone(pag(base, n1), 250, 60, 330, -7, 2) + fone(pag(base, n2), 610, 40, 330, 6, 3) + flt(60, 640, '✓', f1[0], f1[1]) + chips(760, 800, list(fmt)))

def feed(pid, base, n1, n2, f1, fmt=('Canva', 'PDF')):
    cena(pid, pg(pag(base, n2), 560, 120, 460, 7, 1.25, 1) + pg(pag(base, n1), 180, 90, 480, -5, 1.25, 2) + flt(60, 690, '✓', f1[0], f1[1]) + chips(760, 810, list(fmt)))

def cuidado(pid, base, f1):
    cena(pid, pg(pag(f'{base}-cartoes-a6', 2), 120, 130, 380, -8, 1.41, 1) + pg(pag(f'{base}-cartoes-a6', 1), 360, 90, 400, -1, 1.41, 2) + fone(pag(f'{base}-stories', 1), 780, 80, 300, 6, 3) +
         flt(60, 690, '✓', f1[0], f1[1]) + chips(700, 820, ['imprimir A6', 'stories', 'Word']))

stories('beleza-stories-mes', 'beleza-stories-mes', 1, 6, ('20 stories', 'com espaço para as suas fotos'))
stories('beleza-antes-depois', 'beleza-antes-depois-stories', 1, 2, ('antes e depois', 'stories e feed'))
stories('beleza-depoimentos', 'beleza-depoimentos-stories', 1, 2, ('depoimentos', 'foto da cliente e estrelas'))
feed('beleza-carrossel', 'beleza-carrossel', 1, 2, ('carrossel de 10', 'capa, 8 dicas e final'))
stories('beleza-destaques', 'beleza-destaques', 1, 2, ('8 capas', 'para os destaques'))
feed('unha-catalogo', 'unha-catalogo-feed', 1, 2, ('6 fotos por página', 'modelo e valor'))
cena('beleza-politica', pg(pag('beleza-politica', 2), 200, 100, 420, -4, 1.414, 1) + fone(pag('beleza-politica-stories', 1), 660, 70, 320, 6, 2) + flt(60, 690, '✓', 'política do espaço', 'A4 e stories') + chips(760, 820, ['Word', 'PDF', 'Canva']))
cena('beleza-cartao-agendamento', cartao(pag('beleza-cartao-agendamento', 1), 90, 150, 520, -7, 1) + cartao(pag('beleza-cartao-agendamento', 2), 300, 420, 500, 4, 2) + fone(pag('beleza-cartao-agendamento-stories', 1), 800, 80, 300, 6, 3) +
     flt(60, 720, '✓', 'frente e verso', '8 por folha + stories') + chips(780, 830, ['imprimir', 'Canva']))
cena('beleza-certificado', pg(pag('beleza-certificado', 1), 140, 140, 900, -3, 0.707, 1) + flt(60, 720, '✓', 'certificado', 'logo e assinatura') + chips(820, 830, ['Canva', 'PDF']))
for b, f1 in [('sob-cuidados', ('4 procedimentos', 'cartão A6 e stories')), ('unha-cuidados', ('3 procedimentos', 'cartão A6 e stories')), ('cab-cuidados', ('3 procedimentos', 'cartão A6 e stories')), ('est-cuidados', ('3 procedimentos', 'cartão A6 e stories'))]:
    cuidado(b, b, f1)
DOCS_B = {'sob-visagismo': ('mapa do rosto', 'medidas dos dois lados'), 'cil-mapeamento': ('mapa dos olhos', 'curvatura e espessura'), 'cab-anamnese': ('histórico de química', 'teste de mecha'),
          'cab-tecnica': ('fórmulas', 'oxidante e pausa'), 'est-avaliacao': ('rosto e corpo', 'medidas e evolução'), 'est-protocolo': ('10 sessões', 'combinados do pacote'),
          'noiva-orcamento': ('pacotes da noiva', 'reserva com sinal'), 'noiva-contrato': ('9 cláusulas', 'sinal e cancelamento'), 'noiva-ficha': ('ficha da noiva', 'cronograma do dia'),
          'dep-ficha': ('cera e laser', 'cuidados antes e depois'), 'mas-ficha': ('mapa do corpo', 'registro das sessões'), 'beleza-recibo': ('recibo', 'com a sua logo'),
          'beleza-mensagens': ('7 mensagens', 'para o WhatsApp'), 'beleza-biosseguranca': ('biossegurança', 'controle da autoclave')}
for pid, f1 in DOCS_B.items():
    n = len(glob.glob(os.path.join(PG, f'{pid}-*.png')))
    doc(pid, pag(pid, 1), pag(pid, min(2, n)), pag(pid, min(3, n)), ['Word', 'PDF'], f1, f1)

planilha('beleza-precificacao', 'precificação de serviços', ['serviço', 'material', 'tempo', 'custo', 'preço sugerido', 'preço atual'],
         [['Design de sobrancelha', 'R$ 4,00', '40 min', 'R$ 19,44', 'R$ 28,25', 'R$ 45,00'], ['Design com henna', 'R$ 8,00', '50 min', 'R$ 27,10', 'R$ 39,38', 'R$ 60,00'], ['Lash lifting', 'R$ 18,00', '60 min', 'R$ 37,10', 'R$ 53,90', 'R$ 120,00'],
          ['Esmaltação em gel', 'R$ 12,00', '90 min', 'R$ 43,65', 'R$ 63,42', 'R$ 80,00'], ['Limpeza de pele', 'R$ 25,00', '75 min', 'R$ 48,88', 'R$ 71,01', 'R$ 150,00']],
         ['serviços', 'custos fixos', 'como usar'], ('preço sugerido', 'material, tempo, taxa e lucro'), ('', ''))
planilha('beleza-estoque', 'estoque de produtos', ['produto', 'categoria', 'mínimo', 'tem hoje', 'validade', 'situação'],
         [['Luvas (caixa)', 'descartáveis', '2', '3', '', 'ok'], ['Henna castanho', 'henna e tintas', '1', '1', '03/27', 'comprar'], ['Cera roll-on', 'cera', '3', '2', '', 'comprar'], ['Gel base', 'esmaltes', '1', '2', '12/26', 'vence logo'], ['Álcool 70%', 'limpeza', '2', '1', '', 'comprar']],
         ['estoque', 'lista de compras'], ('lista de compras', 'sai sozinha'), ('', ''))
print('ok cenas beleza')
# kits: as capas dos arquivos em leque
import beleza_dados as BD
def capa_de(pid):
    for base in (pid, f'{pid}-stories', f'{pid}-cartoes-a6', f'{pid}-feed'):
        try: return pag(base, 1)
        except Exception: pass
    alt = {'beleza-anamnese': 'beleza-anamnese-1.png', 'beleza-termo': 'beleza-termo-1.png', 'beleza-precos': 'beleza-precos-1.png', 'beleza-caixa': None,
           'beleza-antes-depois': pag('beleza-antes-depois-stories', 1), 'beleza-depoimentos': pag('beleza-depoimentos-stories', 1), 'unha-catalogo': pag('unha-catalogo-feed', 1)}
    return alt.get(pid)
for kid, nome, sub, pct, combo, desc in BD.KITS:
    caps = [c for c in (capa_de(x) for x in combo) if c][:4]
    pos = [(90, 170, 330, -12), (320, 100, 340, -4), (560, 140, 340, 5), (420, 200, 360, 1)]
    corpo = ''.join(pg(c, *pos[i][:3], pos[i][3], z=i + 1) for i, c in enumerate(caps))
    cena(kid, corpo + flt(60, 680, '✓', f'kit com {len(combo)} arquivos', f'{pct}% de desconto') + chips(760, 820, ['imprimir', 'digital']))
print('ok kits')
