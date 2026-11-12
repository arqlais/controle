# Cenas de mockup (HTML) com as páginas reais de cada arquivo, na linguagem da página de vendas da planê.arq:
# fundo bege liso, sombras suaves, cartões flutuantes brancos com ícone.
import os, sys, html, base64
C = sys.argv[1]          # pasta conteudo
OUT = os.path.join(C, 'mock'); os.makedirs(OUT, exist_ok=True)
PG = os.path.join(C, 'pg')
FONTS = os.path.join(C, 'fonts')
E = html.escape

def img(name):
    return 'file://' + os.path.join(PG, name)

CSS = f"""
@font-face{{font-family:Poppins;font-weight:400;src:url('{FONTS}/poppins-latin-400-normal.woff2')}}
@font-face{{font-family:Poppins;font-weight:500;src:url('{FONTS}/poppins-latin-500-normal.woff2')}}
@font-face{{font-family:Poppins;font-weight:600;src:url('{FONTS}/poppins-latin-600-normal.woff2')}}
@font-face{{font-family:Poppins;font-weight:700;src:url('{FONTS}/poppins-latin-700-normal.woff2')}}
@font-face{{font-family:Seasons;font-style:italic;src:url('{FONTS}/the-seasons-italic.woff2')}}
*{{box-sizing:border-box}} html,body{{margin:0}}
body{{width:1200px;height:900px;background:#f1eae5;font-family:Poppins,sans-serif;color:#3e4b57;position:relative;overflow:hidden}}
.chao{{position:absolute;left:0;right:0;bottom:0;height:300px;background:#ece3dd}}
.it{{position:absolute;transform-origin:center}}
.pg{{background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 2px 4px rgba(62,75,87,.06),0 30px 60px -24px rgba(62,75,87,.38),0 12px 24px -12px rgba(62,75,87,.18)}}
.pg img{{width:100%;height:100%;object-fit:cover;object-position:top;display:block}}
.fone{{background:#2f3a45;border-radius:46px;padding:11px;box-shadow:0 40px 70px -28px rgba(47,58,69,.55),0 14px 28px -14px rgba(47,58,69,.35)}}
.fone .tela{{width:100%;height:100%;border-radius:36px;overflow:hidden;position:relative;background:#f5f1ee}}
.fone .tela img{{width:100%;height:100%;object-fit:cover;object-position:top;display:block}}
.fone .tela::before{{content:'';position:absolute;top:10px;left:50%;transform:translateX(-50%);width:84px;height:24px;border-radius:14px;background:#2f3a45;z-index:2}}
.flt{{position:absolute;display:flex;align-items:center;gap:18px;padding:20px 30px 20px 20px;background:#fff;border:1px solid #ecdeda;border-radius:26px;box-shadow:0 26px 50px -24px rgba(62,75,87,.45)}}
.flt i{{width:62px;height:62px;border-radius:18px;background:#f4ebe9;display:grid;place-items:center;color:#a88a80;font-style:normal;font-weight:700;font-size:26px;flex:none}}
.flt i.az{{background:#e8ebee;color:#3e4b57}}
.flt b{{display:block;font-weight:600;font-size:30px;line-height:1.15;letter-spacing:-.01em}} .flt small{{display:block;color:#8b939a;font-size:21px;margin-top:3px}}
.jan{{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 4px rgba(62,75,87,.05),0 40px 80px -30px rgba(62,75,87,.42)}}
.jan .bar{{height:58px;background:#f0e7e3;display:flex;align-items:center;gap:7px;padding:0 16px}}
.jan .bar i{{width:11px;height:11px;border-radius:50%;background:#d9c6c0}}
.jan .bar span{{margin-left:12px;background:#fff;border-radius:10px;padding:6px 18px;font-size:19px;color:#8b939a}}
table.pl{{border-collapse:collapse;width:100%;font-size:21px}}
table.pl td,table.pl th{{border:1px solid #efe6e2;padding:9px 14px;white-space:nowrap;text-align:left;height:50px}}
table.pl th{{background:#f7f2ef;color:#8b939a;font-weight:500;font-size:11px;text-align:center}}
table.pl td.n{{background:#f7f2ef;color:#8b939a;font-size:11px;text-align:center;width:34px}}
table.pl tr.cab td:not(.n){{background:#f4e8e5;font-weight:600}}
table.pl td.v{{text-align:right;font-variant-numeric:tabular-nums}}
table.pl td.tot{{background:#efe5e1;font-weight:700;font-size:23px}}
.abas{{display:flex;gap:6px;padding:10px 14px;background:#f7f2ef;border-top:1px solid #efe6e2;font-size:19px}}
.abas span{{padding:5px 14px;border-radius:8px;color:#8b939a}} .abas span.on{{background:#fff;color:#3e4b57;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.06)}}
.chip{{position:absolute;display:flex;gap:12px}}
.chip span{{background:#fff;border:1px solid #ecdeda;border-radius:16px;padding:12px 22px;font-size:24px;font-weight:600}}
"""

def cena(nome, corpo):
    open(os.path.join(OUT, nome + '.html'), 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="chao"></div>{corpo}</body></html>')

def pg(src, x, y, w, rot, ratio=1.414, z=1):
    return f'<div class="it pg" style="left:{x}px;top:{y}px;width:{w}px;height:{int(w*ratio)}px;transform:rotate({rot}deg);z-index:{z}"><img src="{img(src)}"></div>'

def fone(src, x, y, w, rot, z=2, r=1.8):
    return f'<div class="it fone" style="left:{x}px;top:{y}px;width:{w}px;height:{int(w*r)}px;transform:rotate({rot}deg);z-index:{z}"><div class="tela"><img src="{img(src)}"></div></div>'

def flt(x, y, ic, t, s, az=False, z=5):
    return f'<div class="flt" style="left:{x}px;top:{y}px;z-index:{z}"><i class="{"az" if az else ""}">{ic}</i><span><b>{E(t)}</b><small>{E(s)}</small></span></div>'

def chips(x, y, itens, z=6):
    return f'<div class="chip" style="left:{x}px;top:{y}px;z-index:{z}">' + ''.join(f'<span>{E(t)}</span>' for t in itens) + '</div>'

# ---------- documentos (Word + PDF) ----------
def doc(pid, frente, atras1, atras2, fmt, f1, f2):
    corpo = pg(atras2, 190, 120, 400, -10, z=1) + pg(atras1, 640, 110, 400, 8, z=2) + pg(frente, 380, 60, 440, -2, z=3)
    corpo += flt(60, 600, '✓', f1[0], f1[1]) + chips(690, 790, fmt)
    cena(pid, corpo)

doc('beleza-anamnese', 'beleza-anamnese-1.png', 'beleza-anamnese-2.png', 'beleza-anamnese-4.png', ['Word', 'PDF', 'imprimir ou celular'], ('3 fichas', 'sobrancelha, unhas e estética'), ('saúde sim/não', 'e registro de atendimentos'))
doc('beleza-termo', 'beleza-termo-1.png', 'beleza-termo-2.png', 'beleza-termo-3.png', ['Word', 'PDF'], ('consentimento', 'do procedimento'), ('uso de imagem', 'com ou sem rosto'))
doc('free-proposta', 'free-proposta-1.png', 'free-proposta-2.png', 'free-proposta-3.png', ['Word', 'PDF', 'Google Docs'], ('escopo claro', 'o que entra e o que não entra'), ('pronta em minutos', 'troque o que está entre [ ]'))
doc('free-contrato', 'free-contrato-1.png', 'free-contrato-2.png', 'free-contrato-3.png', ['Word', 'PDF', 'Google Docs'], ('12 cláusulas', 'revisões, prazos e pagamento'), ('direitos de uso', 'e cancelamento'))
doc('free-briefing', 'free-briefing-1.png', 'free-briefing-2.png', 'free-briefing-3.png', ['Word', 'PDF'], ('6 seções', 'perguntas prontas'), ('o cliente responde', 'sozinho, com calma'))
doc('arq-proposta', 'arq-proposta-1.png', 'arq-proposta-2.png', 'arq-proposta-3.png', ['Word', 'PDF', 'Google Docs'], ('5 etapas', 'entregas e prazos'), ('honorários', 'e forma de pagamento'))
doc('arq-contrato', 'arq-contrato-1.png', 'arq-contrato-2.png', 'arq-contrato-3.png', ['Word', 'PDF'], ('14 cláusulas', 'revisões, visitas e RRT'), ('direitos autorais', 'Lei 9.610 e 12.378'))
doc('arq-briefing', 'arq-briefing-1.png', 'arq-briefing-2.png', 'arq-briefing-3.png', ['Word', 'PDF'], ('cômodo por cômodo', 'rotina e gostos da família'), ('obra e orçamento', 'prioridades do cliente'))
doc('arq-levantamento', 'arq-levantamento-1.png', 'arq-levantamento-2.png', 'arq-levantamento-2.png', ['PDF', 'Word', 'tablet'], ('+40 itens', 'medidas, elétrica e hidráulica'), ('não precisa voltar', 'lista de fotos e condomínio'))

# ---------- artes de rede social ----------
cena('beleza-fim-de-ano',
     fone('beleza-fim-de-ano-previa-1.png', 250, 60, 330, -7, 2) + fone('beleza-fim-de-ano-previa-4.png', 610, 40, 330, 6, 3) +
     flt(60, 640, '✓', '6 artes + 7 mensagens', 'stories, feed e WhatsApp') + chips(700, 800, ['Canva', 'PDF']))
cena('beleza-precos',
     pg('beleza-precos-1.png', 200, 110, 420, -6, z=2) + fone('beleza-precos-stories.png', 620, 50, 330, 6, 3) +
     flt(60, 640, '✓', 'feed, stories e balcão', 'troque serviços e preços') + chips(830, 800, ['Canva', 'PDF']))
# ---------- cartões impressos ----------
def cartao(src, x, y, w, rot, z):
    return f'<div class="it pg" style="left:{x}px;top:{y}px;width:{w}px;height:{int(w*55/85)}px;transform:rotate({rot}deg);z-index:{z};border-radius:18px"><img src="{img(src)}"></div>'
cena('beleza-vale',
     cartao('card-vf.png', 120, 110, 520, -8, 1) + cartao('card-ff.png', 560, 70, 520, 6, 2) + cartao('card-fv.png', 520, 380, 500, -3, 3) + cartao('card-vv.png', 140, 400, 460, 4, 2) +
     flt(60, 700, '✓', 'vale + fidelidade', 'frente e verso, 8 por folha') + chips(820, 820, ['Canva', 'PDF']))
# ---------- manual (paisagem) ----------
cena('arq-manual',
     pg('arq-manual-3.png', 90, 300, 520, -7, 0.707, 1) + pg('arq-manual-2.png', 620, 330, 500, 6, 0.707, 2) + pg('arq-manual-1.png', 260, 80, 680, -1, 0.707, 3) +
     flt(60, 700, '✓', '8 páginas', 'etapas, obra e combinados') + chips(830, 820, ['Canva', 'PDF']))
# ---------- kit ----------
cena('kit-arq-primeiro',
     pg('arq-briefing-1.png', 90, 160, 330, -12, z=1) + pg('arq-contrato-1.png', 330, 90, 340, -4, z=2) + pg('arq-manual-1.png', 640, 170, 460, 7, 0.707, 3) + pg('arq-proposta-1.png', 470, 140, 360, 2, z=4) +
     flt(60, 650, '✓', 'kit com 4 modelos', '30% de desconto') + chips(760, 820, ['Word', 'PDF', 'Canva']))

# ---------- planilhas ----------
def planilha(pid, url, cols, linhas, abas, flt1, flt2):
    head = '<tr><th></th>' + ''.join(f'<th>{chr(65+i)}</th>' for i in range(len(cols))) + '</tr>'
    rows = f'<tr class="cab"><td class="n">1</td>' + ''.join(f'<td>{E(c)}</td>' for c in cols) + '</tr>'
    for i, ln in enumerate(linhas):
        cls = ' class="totrow"' if ln and ln[0] == '§' else ''
        vals = (ln[1:] if cls else ln)
        vals = (vals + [''] * len(cols))[:len(cols)]
        cells = ''
        for v in vals:
            k = 'v' if (v.startswith('R$') or v.replace(',', '').replace('.', '').isdigit() or v.endswith('%')) else ''
            if cls: k += ' tot'
            cells += f'<td class="{k}">{E(v)}</td>'
        rows += f'<tr><td class="n">{i + 2}</td>{cells}</tr>'
    tabs = ''.join(f'<span class="{"on" if j == 0 else ""}">{E(a)}</span>' for j, a in enumerate(abas))
    corpo = (f'<div class="it jan" style="left:40px;top:40px;width:1120px;z-index:2"><div class="bar"><i></i><i></i><i></i><span>{E(url)}</span></div>'
             f'<table class="pl">{head}{rows}</table><div class="abas">{tabs}</div></div>')
    corpo += flt(60, 700, '✓', flt1[0], flt1[1]) + chips(700, 800, ['Excel', 'Google Planilhas'])
    cena(pid, corpo)

planilha('beleza-caixa', 'agenda e caixa · novembro', ['data', 'cliente', 'serviço', 'valor', 'pagamento', 'pago?'],
         [['03/11', 'Ana', 'Design com henna', 'R$ 60,00', 'Pix', 'sim'], ['03/11', 'Bia', 'Lash lifting', 'R$ 120,00', 'crédito', 'sim'], ['04/11', 'Carla', 'Alongamento em gel', 'R$ 160,00', 'Pix', 'sim'],
          ['05/11', 'Duda', 'Manutenção de cílios', 'R$ 100,00', 'débito', 'não'], ['06/11', 'Eli', 'Mão', 'R$ 35,00', 'dinheiro', 'sim'], ['§', 'entrou', '', '', 'R$ 375,00', '', ''], ['§', 'a receber', '', '', 'R$ 100,00', '', '']],
         ['agenda', 'resumo', 'serviços', 'saídas'], ('contas automáticas', 'entrou, saiu e sobrou'), ('ticket médio', 'por serviço e pagamento'))
planilha('free-preco-hora', 'meu preço por hora', ['por mês', 'valor', '', 'resultado', 'valor'],
         [['quero ganhar', 'R$ 3.000,00', '', 'preciso faturar', 'R$ 4.844,68'], ['aluguel', 'R$ 300,00', '', 'horas pagas', '104'], ['internet e telefone', 'R$ 150,00', '', '', ''],
          ['programas', 'R$ 120,00', '', '', ''], ['equipamento', 'R$ 120,00', '', '', ''], ['impostos', '6%', '', '', ''],
          ['§', 'preço mínimo por hora', '', '', '', 'R$ 46,62']],
         ['meu preço', 'projeto', 'como usar'], ('preço mínimo', 'abaixo dele, você paga para trabalhar'), ('preço do projeto', 'etapa por etapa, com margem'))
planilha('arq-honorarios', 'honorários · comparar', ['método', 'base', 'valor'],
         [['por m²', '44,5 m² · por tipo de ambiente', 'R$ 4.355,00'], ['por hora', '80 h · R$ 69,79/h', 'R$ 5.582,98'], ['% da obra', '8% de R$ 60.000,00', 'R$ 4.800,00'],
          ['extras', 'RRT, deslocamento, impressão', 'R$ 250,00'], ['§', 'valor sugerido', '', 'R$ 5.162,66'], ['', 'mínimo', 'R$ 4.605,00']],
         ['comparar', 'por m²', 'por hora', 'custos', 'tipos'], ('3 métodos', 'm², hora e % da obra'), ('valor sugerido', 'a partir dos seus custos'))
print('ok cenas')
cena('kit-beleza',
     pg('beleza-precos-1.png', 80, 150, 330, -11, z=1) + pg('beleza-termo-1.png', 330, 90, 330, -4, z=2) + cartao('card-ff.png', 770, 60, 400, 8, 5) + pg('beleza-anamnese-1.png', 440, 150, 350, 2, z=4) +
     flt(60, 650, '✓', 'kit com 4 arquivos', '30% de desconto') + chips(700, 820, ['Word', 'PDF', 'Canva']))
print('ok kit beleza')
