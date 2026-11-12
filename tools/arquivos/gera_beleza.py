# Gera os arquivos visuais do catálogo de beleza (PowerPoint editável) e as planilhas.
# Os documentos (Word + PDF) saem do render.py com TEXTOS=textos_beleza.
import os, sys
from pptx.enum.shapes import MSO_SHAPE
from peca import nova, Peca, INK, ROSE, SOFT, BLUSH, WHITE, SAND, MUTED, BG
from layouts import LAYOUTS, lista, aviso
import beleza_dados as D

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
def salva(prs, nome): prs.save(os.path.join(OUT, nome))

def kit(nome, w, h, pecas):
    p = nova(w, h)
    for lay, c in pecas: LAYOUTS[lay](Peca(p), c)
    salva(p, nome)

# ----- divulgação -----
kit('beleza-stories-mes.pptx', 1080, 1920, D.STORIES_MES)
kit('beleza-antes-depois-stories.pptx', 1080, 1920, [('antes_depois', c) for c in D.ANTES_DEPOIS])
kit('beleza-antes-depois-feed.pptx', 1080, 1350, [('antes_depois', c) for c in D.ANTES_DEPOIS])
kit('beleza-depoimentos-stories.pptx', 1080, 1920, [('depoimento', c) for c in D.DEPOIMENTOS])
kit('beleza-depoimentos-feed.pptx', 1080, 1350, [('depoimento', c) for c in D.DEPOIMENTOS])
kit('beleza-carrossel.pptx', 1080, 1350, D.CARROSSEL)
kit('beleza-destaques.pptx', 1080, 1920, [('destaque', {'palavra': w, 'forma': f, 'cor': SOFT if i % 2 == 0 else INK}) for i, (w, f) in enumerate(D.DESTAQUES)])
kit('beleza-politica-stories.pptx', 1080, 1920, [('lista', D.POLITICA_STORY)])

# ----- cuidados: cartão A6 (1240 x 1748) e stories -----
for k, v in D.CUIDADOS_STORIES.items():
    kit(f'{k}-cartoes-a6.pptx', 1240, 1748, [('lista', {**c, 'foto': False}) for c in v])
    kit(f'{k}-stories.pptx', 1080, 1920, [('lista', c) for c in v])

# ----- cartão de agendamento (85 x 55 mm = 1004 x 650) -----
p = nova(1004, 650)
f = Peca(p, WHITE)
f.ret(0, 0, 1004, 650, BG)
f.txt(70, 60, 600, 40, [('[SEU ESPAÇO]', {'tam': 24})], cor=MUTED)
f.titulo(70, 120, 800, 'seu próximo', 'horário', tam=78)
f.coracao(870, 70, 56)
for i, lab in enumerate(['dia', 'hora', 'serviço']):
    f.txt(70, 400 + i * 70, 160, 40, [(lab, {'tam': 24})], cor=MUTED)
    f.ret(230, 432 + i * 70, 690, 3, SOFT)
v = Peca(p, INK)
v.titulo(70, 90, 860, 'até', 'logo', tam=82, cor=WHITE)
v.txt(70, 330, 860, 160, [('Se precisar remarcar, me avise com 24 horas de antecedência.\n[WhatsApp] · @seuperfil', {'tam': 28, 'cor': WHITE})], esp=1.3)
v.coracao(860, 470, 80, SOFT)
salva(p, 'beleza-cartao-agendamento.pptx')
kit('beleza-cartao-agendamento-stories.pptx', 1080, 1920, [('aviso', {'forte': 'seu próximo', 'cursiva': 'horário', 'texto': 'Dia [dd/mm] às [hora]\n[serviço]\n\nSe precisar remarcar, me avise com 24 horas de antecedência.', 'cta': 'até lá'})])

# ----- certificado (A4 deitado: 1123 x 794) -----
p = nova(1123, 794)
c = Peca(p, WHITE)
c.ret(30, 30, 1063, 734, BG, 0.03)
c.ret(55, 55, 1013, 684, WHITE, 0.03, linha=SOFT, lw=2)
c.foto(880, 90, 150, 70, texto='sua logo')
c.txt(110, 120, 700, 40, [('[NOME DO SEU ESPAÇO OU ESCOLA]', {'tam': 18})], cor=MUTED)
c.titulo(110, 170, 900, 'certificado', 'de participação', tam=74)
c.txt(110, 390, 900, 40, [('Certificamos que', {'tam': 22})], cor=MUTED)
c.txt(110, 430, 900, 70, [('[Nome da aluna]', {'b': True, 'tam': 44})])
c.txt(110, 515, 900, 80, [('participou do curso [nome do curso], com carga horária de [x] horas, realizado em [data], em [cidade].', {'tam': 22})], esp=1.3)
for i, lab in enumerate(['[seu nome] · instrutora', '[cidade], [data]']):
    c.ret(110 + i * 470, 670, 380, 2, INK)
    c.txt(110 + i * 470, 680, 380, 40, [(lab, {'tam': 18})], cor=MUTED)
c.coracao(1000, 640, 50)
salva(p, 'beleza-certificado.pptx')

# ----- catálogo de unhas: grade de 6 fotos -----
def grade(pc, titulo, cursiva):
    k = pc.W / 1080
    pc.titulo(70 * k, 60 * k, pc.W - 140 * k, titulo, cursiva, tam=int(100 * k))
    top = 360 * k
    rows = 3 if pc.H / pc.W < 1.5 else 3
    cw = (pc.W - 140 * k - 2 * 30 * k) / 3 if pc.H / pc.W < 1.5 else (pc.W - 140 * k - 30 * k) / 2
    cols = 3 if pc.H / pc.W < 1.5 else 2
    ch = (pc.H - top - 160 * k - (rows - 1) * 26 * k) / (2 if cols == 3 else 3)
    n = 0
    for r in range(2 if cols == 3 else 3):
        for col in range(cols):
            x = 70 * k + col * (cw + 30 * k); y = top + r * (ch + 26 * k)
            pc.ret(x, y, cw, ch, WHITE, 0.04)
            pc.foto(x + 14 * k, y + 14 * k, cw - 28 * k, ch - 90 * k, texto='sua foto')
            n += 1
            pc.txt(x + 18 * k, y + ch - 70 * k, cw - 36 * k, 60 * k, [(f'modelo {n:02d} · R$ 00,00', {'tam': int(24 * k)})])
    pc.rodape('[SEU ESPAÇO] · @SEUPERFIL')
p = nova(1080, 1350)
for t, c2 in [('modelos', 'da semana'), ('nail', 'art'), ('francesinhas', 'e clássicas'), ('cores', 'do mês')]: grade(Peca(p), t, c2)
salva(p, 'unha-catalogo-feed.pptx')
p = nova(1080, 1920)
for t, c2 in [('modelos', 'da semana'), ('escolha o', 'seu')]: grade(Peca(p), t, c2)
salva(p, 'unha-catalogo-stories.pptx')

# ----- planilhas -----
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
Fo = lambda **k: Font(name='Poppins', color=k.pop('color', INK), **k)
FILL = lambda c: PatternFill('solid', fgColor=c)
BRL = '"R$" #,##0.00'
def base(ws, t, s, larg):
    ws.sheet_view.showGridLines = False
    for i, w in enumerate(larg): ws.column_dimensions[chr(65 + i)].width = w
    ws['A1'] = t; ws['A1'].font = Fo(size=18, bold=True); ws['A2'] = s; ws['A2'].font = Fo(size=10, color=MUTED)
def cab(ws, l, nomes):
    for i, n in enumerate(nomes):
        c = ws.cell(l, i + 1, n); c.font = Fo(size=10, bold=True); c.fill = FILL(BLUSH)
def ent(c, fmt=None):
    c.border = Border(bottom=Side(style='thin', color=ROSE)); c.font = Fo(size=10)
    if fmt: c.number_format = fmt
def res(c, fmt=BRL, big=False):
    c.font = Fo(size=13 if big else 11, bold=True); c.fill = FILL(SAND); c.number_format = fmt

wb = Workbook(); ws = wb.active; ws.title = 'como usar'
base(ws, 'Precificação de serviços', 'Campos com linha rosé: você preenche. Campos bege: a conta sai sozinha.', [4, 90])
for i, t in enumerate(['Em "custos fixos", coloque as contas do mês e quantas horas você atende.', 'Em "serviços", para cada serviço: material gasto, tempo e taxa da maquininha.', 'A planilha mostra o custo real, o preço sugerido com o seu lucro e quanto sobra no preço que você cobra hoje.']):
    ws.cell(4 + i, 1, i + 1).font = Fo(bold=True, color=ROSE); ws.cell(4 + i, 2, t).font = Fo(size=10)
cf = wb.create_sheet('custos fixos'); base(cf, 'Custos fixos do mês', '', [40, 16])
for i, (l, v) in enumerate([('aluguel', 800), ('luz, água e internet', 250), ('pró-labore (seu salário)', 2500), ('MEI e contador', 90), ('divulgação', 100), ('cursos', 100), ('outros', 100)]):
    cf.cell(4 + i, 1, l).font = Fo(size=10); ent(cf.cell(4 + i, 2, v), BRL)
cf['A12'] = 'horas de atendimento por mês'; ent(cf.cell(12, 2, 120), '0')
cf['A14'] = 'custo fixo por hora'; res(cf.cell(14, 2, '=SUM(B4:B10)/B12'), BRL, True)
sv = wb.create_sheet('serviços'); base(sv, 'Preço de cada serviço', '', [26, 14, 12, 14, 12, 16, 16, 16, 14])
cab(sv, 4, ['serviço', 'material (R$)', 'tempo (min)', 'custo do tempo', 'taxa %', 'custo total', 'lucro desejado %', 'preço sugerido', 'preço atual'])
ex = [('Design de sobrancelha', 4, 40, 3.5, 40, 45), ('Design com henna', 8, 50, 3.5, 40, 60), ('Lash lifting', 18, 60, 3.5, 40, 120), ('Esmaltação em gel', 12, 90, 3.5, 40, 80), ('Limpeza de pele', 25, 75, 3.5, 40, 150)]
for i in range(20):
    r = 5 + i
    for j in (0, 1, 2, 4, 6, 8): ent(sv.cell(r, j + 1), {1: BRL, 4: '0.0', 6: '0', 8: BRL}.get(j))
    if i < len(ex):
        e = ex[i]; sv.cell(r, 1, e[0]); sv.cell(r, 2, e[1]); sv.cell(r, 3, e[2]); sv.cell(r, 5, e[3]); sv.cell(r, 7, e[4]); sv.cell(r, 9, e[5])
    res(sv.cell(r, 4, f"=IF(C{r}=\"\",\"\",C{r}/60*'custos fixos'!$B$14)"))
    res(sv.cell(r, 6, f'=IF(A{r}="","",B{r}+D{r})'))
    res(sv.cell(r, 8, f'=IF(A{r}="","",F{r}*(1+G{r}/100)/(1-E{r}/100))'))
sv.conditional_formatting.add('I5:I24', FormulaRule(formula=['AND(I5<>"",H5<>"",I5<H5)'], fill=FILL(BLUSH)))
sv['A26'] = 'linha rosada: o preço atual está abaixo do sugerido'; sv['A26'].font = Fo(size=9, color=MUTED)
wb.save(os.path.join(OUT, 'beleza-precificacao.xlsx'))

wb = Workbook(); ws = wb.active; ws.title = 'estoque'
base(ws, 'Estoque de produtos', 'Anote as entradas e saídas; a lista de compras sai sozinha.', [28, 14, 12, 12, 12, 12, 14, 14])
cab(ws, 4, ['produto', 'categoria', 'mínimo', 'entradas', 'saídas', 'tem hoje', 'validade', 'situação'])
dv = DataValidation(type='list', formula1='"descartáveis,cera,esmaltes,henna e tintas,skincare,cabelo,limpeza,outros"', allow_blank=True); ws.add_data_validation(dv)
ex = [('Luvas (caixa)', 'descartáveis', 2, 6, 3), ('Henna castanho', 'henna e tintas', 1, 2, 1), ('Cera roll-on', 'cera', 3, 10, 8), ('Gel base', 'esmaltes', 1, 3, 1), ('Álcool 70%', 'limpeza', 2, 4, 3)]
for i in range(60):
    r = 5 + i
    for j in (0, 1, 2, 3, 4, 6): ent(ws.cell(r, j + 1), {6: 'dd/mm/yy'}.get(j))
    dv.add(f'B{r}')
    if i < len(ex): ws.cell(r, 1, ex[i][0]); ws.cell(r, 2, ex[i][1]); ws.cell(r, 3, ex[i][2]); ws.cell(r, 4, ex[i][3]); ws.cell(r, 5, ex[i][4])
    res(ws.cell(r, 6, f'=IF(A{r}="","",D{r}-E{r})'), '0')
    res(ws.cell(r, 8, f'=IF(A{r}="","",IF(F{r}<=C{r},"comprar",IF(AND(G{r}<>"",G{r}<TODAY()+30),"vence logo","ok")))'), '@')
    ws.cell(r, 9, f'=IF(H{r}="comprar",COUNTIF(H$5:H{r},"comprar"),"")').font = Fo(size=8, color=WHITE)
ws.conditional_formatting.add('A5:H64', FormulaRule(formula=['$H5="comprar"'], fill=FILL(BLUSH)))
ws.conditional_formatting.add('A5:H64', FormulaRule(formula=['$H5="vence logo"'], fill=FILL(SAND)))
lc = wb.create_sheet('lista de compras'); base(lc, 'Lista de compras', 'o que está no mínimo ou abaixo', [30, 14])
cab(lc, 4, ['produto', 'tem hoje'])
for i in range(30):
    lc.cell(5 + i, 1, f'=IFERROR(INDEX(estoque!$A$5:$A$64,MATCH({i + 1},estoque!$I$5:$I$64,0)),"")').font = Fo(size=10)
    lc.cell(5 + i, 2, f'=IF(A{5 + i}="","",INDEX(estoque!$F$5:$F$64,MATCH(A{5 + i},estoque!$A$5:$A$64,0)))').font = Fo(size=10)
wb.save(os.path.join(OUT, 'beleza-estoque.xlsx'))
print('ok')
