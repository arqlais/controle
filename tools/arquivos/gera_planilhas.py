# Planilhas nos quatro estilos (cores e cabeçalhos); as contas são as mesmas.
import os, re, sys
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
D = os.path.dirname(os.path.abspath(__file__))
PALETAS = {
    'criativo': ('45394A', 'C9785D', '9A8C93', 'F6E1DA', 'F3E3C7', 'FBF2EC', 'F0DCD3'),
    'delicado': ('3E4B57', 'A88A80', '8B939A', 'F4E8E5', 'EFE5E1', 'F5F1EE', 'EBE1DC'),
    'minimalista': ('1F1F1F', '1F1F1F', '8A8A8A', 'EFEFEF', 'F6F6F6', 'FFFFFF', 'DDDDDD'),
    'elegante': ('2B2622', 'A9844F', '8C8178', 'F3ECE1', 'EFE4D0', 'FBF8F3', 'DCCDB3'),
}
pl = open(os.path.join(D, 'planilhas.py')).read()
gb = open(os.path.join(D, 'gera_beleza.py')).read()
gb = gb[gb.index('# ----- planilhas -----'):]
for est, (INK, ROSE, MUTED, BLUSH, SAND, BG, LIN) in PALETAS.items():
    suf = '' if est == 'criativo' else f'--{est}'
    a = pl.replace("OUT = sys.argv[1]", f"OUT = {OUT!r}")
    a = re.sub(r"^INK, ROSE, MUTED, BLUSH, SAND, BG = .*$", f"INK, ROSE, MUTED, BLUSH, SAND, BG = {INK!r}, {ROSE!r}, {MUTED!r}, {BLUSH!r}, {SAND!r}, {BG!r}", a, flags=re.M)
    a = a.replace("'EBE1DC'", repr(LIN)).replace(".xlsx'", f"{suf}.xlsx'")
    exec(compile(a, 'planilhas', 'exec'), {'__name__': 'x'})
    b = gb.replace(".xlsx'", f"{suf}.xlsx'")
    exec(compile(b, 'gb', 'exec'), {'OUT': OUT, 'INK': INK, 'ROSE': ROSE, 'MUTED': MUTED, 'BLUSH': BLUSH, 'SAND': SAND, 'WHITE': 'FFFFFF', 'os': os})
    print('ok', est)
