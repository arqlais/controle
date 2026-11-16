# Os 4 estilos das artes em HTML (viram PDF A4 no Playwright): delicado, criativo, minimalista e elegante.
# Usado pelo presente (presente.py) e pelas fichas novas. Cada tema vira variáveis CSS; o desenho é o mesmo.
FONTES = ("<link href='https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&"
          "family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Pinyon+Script&display=swap' rel='stylesheet'>")

TEMAS = {
    # bege e rosé, cantos redondos
    'delicado': dict(bg='#fffdfc', ink='#3e4b57', mut='#8d8682', ac='#a88a80', ac2='#c9b1a8', soft='#f4e8e3', fio='#ead9d3', card='#ffffff',
                     tit="'Cormorant Garamond', serif", tit_it='italic', tit_w='500', caixa='none', esp='.01em', raio='3.2mm', script="'Pinyon Script', cursive"),
    # lilás e pêssego, formas soltas (paleta nova do criativo)
    'criativo': dict(bg='#fbf8f4', ink='#3b3452', mut='#8a8399', ac='#8a79b6', ac2='#eaa98f', soft='#efeaf6', fio='#ddd4ec', card='#ffffff',
                     tit="'Poppins', sans-serif", tit_it='normal', tit_w='600', caixa='none', esp='-.01em', raio='5mm', script="'Pinyon Script', cursive"),
    # preto e branco, limpo
    'minimalista': dict(bg='#ffffff', ink='#1f1f1f', mut='#8a8a8a', ac='#1f1f1f', ac2='#bdbdbd', soft='#f3f3f3', fio='#dedede', card='#ffffff',
                        tit="'Poppins', sans-serif", tit_it='normal', tit_w='500', caixa='uppercase', esp='.22em', raio='0', script="'Poppins', sans-serif"),
    # preto e dourado
    'elegante': dict(bg='#16130f', ink='#efe7da', mut='#a99c88', ac='#c9a86a', ac2='#8c7447', soft='#211c17', fio='#3d342a', card='#1c1813',
                     tit="'Cormorant Garamond', serif", tit_it='normal', tit_w='500', caixa='uppercase', esp='.16em', raio='1mm', script="'Pinyon Script', cursive"),
}

def vars_css(t):
    T = TEMAS[t]
    return ':root{' + ';'.join(f'--{k.replace("_", "-")}:{v}' for k, v in T.items()) + '}'
