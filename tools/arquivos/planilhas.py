# Planilhas (Excel; abrem no Google Planilhas) com contas automáticas.
import os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule

OUT = sys.argv[1]
INK, ROSE, MUTED, BLUSH, SAND, BG = '3E4B57', 'A88A80', '8B939A', 'F4E8E5', 'EFE5E1', 'F5F1EE'
F = lambda **k: Font(name='Poppins', color=k.pop('color', INK), **k)
FILL = lambda c: PatternFill('solid', fgColor=c)
LINHA = Border(bottom=Side(style='thin', color='EBE1DC'))
BRL = '"R$" #,##0.00'
PCT = '0%'

def base(ws, titulo, sub, larguras):
    ws.sheet_view.showGridLines = False
    for i, w in enumerate(larguras):
        ws.column_dimensions[chr(65 + i)].width = w
    ws['A1'] = titulo; ws['A1'].font = F(size=18, bold=True)
    ws['A2'] = sub; ws['A2'].font = F(size=10, color=MUTED)
    ws.row_dimensions[1].height = 30

def cab(ws, linha, nomes):
    for i, n in enumerate(nomes):
        c = ws.cell(linha, i + 1, n); c.font = F(size=10, bold=True); c.fill = FILL(BLUSH); c.alignment = Alignment(vertical='center')
    ws.row_dimensions[linha].height = 22

def entrada(c, fmt=None):
    c.fill = FILL('FFFFFF'); c.border = Border(bottom=Side(style='thin', color=ROSE)); c.font = F(size=10)
    if fmt: c.number_format = fmt

def resultado(c, fmt=BRL, grande=False):
    c.font = F(size=14 if grande else 11, bold=True); c.fill = FILL(SAND); c.number_format = fmt

def como_usar(wb, titulo, passos):
    ws = wb.active; ws.title = 'como usar'
    base(ws, titulo, 'Campos brancos com linha rosé: você preenche. Campos bege: a conta sai sozinha.', [4, 90])
    for i, t in enumerate(passos):
        ws.cell(4 + i, 1, i + 1).font = F(bold=True, color=ROSE)
        c = ws.cell(4 + i, 2, t); c.font = F(size=10); c.alignment = Alignment(wrap_text=True, vertical='top')
        ws.row_dimensions[4 + i].height = 32
    return ws

# ================= agenda e caixa (beleza) =================
def caixa():
    wb = Workbook()
    como_usar(wb, 'Agenda e caixa do mês', [
        'Na aba "serviços", escreva os seus serviços e preços. Eles aparecem na lista da agenda.',
        'Na aba "agenda", anote cada atendimento: data, hora, cliente, serviço, forma de pagamento e se já foi pago. O valor vem sozinho (dá para mudar).',
        'Na aba "saídas", anote o que gastou: produtos, aluguel, taxas, transporte.',
        'A aba "resumo" mostra quanto entrou, quanto saiu, quanto sobrou e o ticket médio, por forma de pagamento e por serviço.',
        'Para um mês novo: duplique o arquivo (ou as abas) e apague as linhas da agenda e das saídas.'])
    sv = wb.create_sheet('serviços'); base(sv, 'Serviços e preços', 'troque pelos seus', [34, 16, 16])
    cab(sv, 4, ['serviço', 'preço', 'duração (min)'])
    exemplos = [('Design de sobrancelha', 45, 40), ('Design com henna', 60, 50), ('Lash lifting', 120, 60), ('Extensão de cílios', 180, 120), ('Manutenção de cílios', 100, 80), ('Mão', 35, 40), ('Pé', 40, 50), ('Alongamento em gel', 160, 120)]
    for i in range(30):
        r = 5 + i
        for j in range(3): entrada(sv.cell(r, j + 1), BRL if j == 1 else None)
        if i < len(exemplos):
            sv.cell(r, 1, exemplos[i][0]); sv.cell(r, 2, exemplos[i][1]); sv.cell(r, 3, exemplos[i][2])
    ag = wb.create_sheet('agenda'); base(ag, 'Agenda do mês', 'uma linha por atendimento', [12, 9, 26, 28, 13, 18, 11])
    cab(ag, 4, ['data', 'hora', 'cliente', 'serviço', 'valor', 'pagamento', 'pago?'])
    dv_s = DataValidation(type='list', formula1="='serviços'!$A$5:$A$34", allow_blank=True)
    dv_p = DataValidation(type='list', formula1='"Pix,dinheiro,débito,crédito,pacote"', allow_blank=True)
    dv_ok = DataValidation(type='list', formula1='"sim,não"', allow_blank=True)
    for d in (dv_s, dv_p, dv_ok): ag.add_data_validation(d)
    for i in range(200):
        r = 5 + i
        for j in range(7): entrada(ag.cell(r, j + 1), {0: 'dd/mm', 1: 'hh:mm', 4: BRL}.get(j))
        ag.cell(r, 5, f'=IF(D{r}="","",IFERROR(VLOOKUP(D{r},\'serviços\'!$A$5:$B$34,2,FALSE),""))')
        dv_s.add(f'D{r}'); dv_p.add(f'F{r}'); dv_ok.add(f'G{r}')
    ag.conditional_formatting.add('A5:G204', FormulaRule(formula=['$G5="não"'], fill=FILL(BLUSH)))
    sa = wb.create_sheet('saídas'); base(sa, 'Saídas do mês', 'tudo o que saiu do caixa', [12, 36, 20, 14])
    cab(sa, 4, ['data', 'descrição', 'categoria', 'valor'])
    dv_c = DataValidation(type='list', formula1='"produtos,aluguel,contas,taxas,transporte,cursos,divulgação,outros"', allow_blank=True); sa.add_data_validation(dv_c)
    for i in range(100):
        r = 5 + i
        for j in range(4): entrada(sa.cell(r, j + 1), {0: 'dd/mm', 3: BRL}.get(j))
        dv_c.add(f'C{r}')
    rs = wb.create_sheet('resumo'); base(rs, 'Resumo do mês', 'sai sozinho', [30, 18, 4, 30, 18])
    linhas = [('entrou (pago)', '=SUMIFS(agenda!E5:E204,agenda!G5:G204,"sim")', BRL),
              ('a receber', '=SUMIFS(agenda!E5:E204,agenda!G5:G204,"não")', BRL),
              ('saiu', '=SUM(\'saídas\'!D5:D104)', BRL),
              ('sobrou', '=B4-B6', BRL),
              ('atendimentos', '=COUNTA(agenda!C5:C204)', '0'),
              ('ticket médio', '=IF(B8=0,0,SUM(agenda!E5:E204)/B8)', BRL)]
    for i, (l, f, fmt) in enumerate(linhas):
        rs.cell(4 + i, 1, l).font = F(size=11); resultado(rs.cell(4 + i, 2, f), fmt, l == 'sobrou')
    rs.cell(11, 1, 'por forma de pagamento').font = F(bold=True, color=ROSE)
    for i, fp in enumerate(['Pix', 'dinheiro', 'débito', 'crédito', 'pacote']):
        rs.cell(12 + i, 1, fp).font = F(size=10); resultado(rs.cell(12 + i, 2, f'=SUMIFS(agenda!E5:E204,agenda!F5:F204,A{12 + i})'))
    rs.cell(3, 4, 'por serviço').font = F(bold=True, color=ROSE)
    for i in range(20):
        r = 4 + i
        rs.cell(r, 4, f"=IF('serviços'!A{5 + i}=\"\",\"\",'serviços'!A{5 + i})").font = F(size=10)
        resultado(rs.cell(r, 5, f'=IF(D{r}="","",SUMIFS(agenda!E5:E204,agenda!D5:D204,D{r}))'))
    wb.move_sheet('resumo', offset=-3)
    wb.save(os.path.join(OUT, 'beleza-caixa.xlsx'))

# ================= preço por hora (freelancer) =================
def preco_hora():
    wb = Workbook()
    como_usar(wb, 'Calculadora de preço por hora', [
        'Na aba "meu preço", preencha quanto quer ganhar por mês, os seus custos e quantas horas trabalha.',
        'O preço mínimo por hora aparece sozinho: abaixo dele, você está pagando para trabalhar.',
        'Na aba "projeto", estime as horas de cada etapa. A planilha mostra o preço do projeto com a sua margem.',
        'Revise a cada seis meses ou quando os seus custos mudarem.'])
    ws = wb.create_sheet('meu preço'); base(ws, 'Meu preço por hora', 'preencha os campos brancos', [44, 18])
    itens = [('quanto quero ganhar por mês (salário)', 3000, BRL), ('aluguel ou parte da casa', 300, BRL), ('internet e telefone', 150, BRL), ('programas e assinaturas', 120, BRL),
             ('equipamento (computador ÷ 36 meses)', 120, BRL), ('cursos e livros', 80, BRL), ('contador, MEI e taxas', 90, BRL), ('outros custos', 100, BRL)]
    ws['A4'] = 'por mês'; ws['A4'].font = F(bold=True, color=ROSE)
    for i, (l, v, fmt) in enumerate(itens):
        ws.cell(5 + i, 1, l).font = F(size=10); c = ws.cell(5 + i, 2, v); entrada(c, fmt)
    r = 5 + len(itens)
    ws.cell(r + 1, 1, 'impostos sobre o que recebo').font = F(size=10); entrada(ws.cell(r + 1, 2, 0.06), PCT)
    ws.cell(r + 2, 1, 'reserva para férias, 13º e imprevistos').font = F(size=10); entrada(ws.cell(r + 2, 2, 0.15), PCT)
    ws.cell(r + 3, 1, 'horas de trabalho por semana').font = F(size=10); entrada(ws.cell(r + 3, 2, 40), '0')
    ws.cell(r + 4, 1, 'parte das horas que vira trabalho pago').font = F(size=10); entrada(ws.cell(r + 4, 2, 0.6), PCT)
    ws.cell(r + 6, 1, 'resultado').font = F(bold=True, color=ROSE)
    tot = f'SUM(B5:B{r - 1})'
    ws.cell(r + 7, 1, 'preciso faturar por mês').font = F(size=11); resultado(ws.cell(r + 7, 2, f'={tot}*(1+B{r + 2})/(1-B{r + 1})'))
    ws.cell(r + 8, 1, 'horas pagas por mês').font = F(size=11); resultado(ws.cell(r + 8, 2, f'=B{r + 3}*4.33*B{r + 4}'), '0')
    ws.cell(r + 9, 1, 'preço mínimo por hora').font = F(size=12, bold=True); resultado(ws.cell(r + 9, 2, f'=B{r + 7}/B{r + 8}'), BRL, True)
    hora = f"'meu preço'!B{r + 9}"
    pj = wb.create_sheet('projeto'); base(pj, 'Preço de um projeto', 'estime as horas de cada etapa', [36, 14, 18])
    cab(pj, 4, ['etapa', 'horas', 'valor'])
    for i, (e, h) in enumerate([('reunião e briefing', 2), ('pesquisa e referências', 3), ('criação', 10), ('ajustes', 4), ('entrega e arquivos finais', 2), ('', None), ('', None), ('', None)]):
        rr = 5 + i
        entrada(pj.cell(rr, 1, e or None)); entrada(pj.cell(rr, 2, h), '0.0')
        resultado(pj.cell(rr, 3, f'=IF(B{rr}="","",B{rr}*{hora})'))
    pj['A14'] = 'custos do projeto (impressão, fontes, imagens)'; pj['A14'].font = F(size=10); entrada(pj.cell(14, 2, 0), BRL)
    pj['A15'] = 'margem (lucro e negociação)'; pj['A15'].font = F(size=10); entrada(pj.cell(15, 2, 0.2), PCT)
    pj['A17'] = 'preço do projeto'; pj['A17'].font = F(size=12, bold=True)
    resultado(pj.cell(17, 3, '=(SUM(C5:C12)+B14)*(1+B15)'), BRL, True)
    pj['A18'] = 'total de horas'; pj['A18'].font = F(size=10); resultado(pj.cell(18, 3, '=SUM(B5:B12)'), '0.0')
    wb.save(os.path.join(OUT, 'free-preco-hora.xlsx'))

# ================= honorários (arquitetura) =================
def honorarios():
    wb = Workbook()
    como_usar(wb, 'Calculadora de honorários', [
        'Na aba "custos", calcule o valor da sua hora a partir dos seus custos e de quanto quer ganhar.',
        'Na aba "por m²", liste os ambientes e a área. Escolha o valor por m² de cada tipo de ambiente.',
        'Na aba "por hora", estime as horas de cada etapa do projeto.',
        'Na aba "comparar", veja os três métodos lado a lado (m², hora e % da obra) e o valor sugerido.',
        'Valores de referência: consulte também as tabelas do CAU e do sindicato do seu estado.'])
    cu = wb.create_sheet('custos'); base(cu, 'Valor da minha hora', 'preencha os campos brancos', [44, 18])
    itens = [('quanto quero ganhar por mês', 5000), ('escritório (aluguel ou parte da casa)', 500), ('programas (CAD, render, BIM)', 400), ('anuidade CAU ÷ 12', 60),
             ('equipamento ÷ 36 meses', 200), ('contador e impostos fixos', 150), ('transporte e outros', 250)]
    for i, (l, v) in enumerate(itens):
        cu.cell(4 + i, 1, l).font = F(size=10); entrada(cu.cell(4 + i, 2, v), BRL)
    cu['A12'] = 'impostos sobre o que recebo'; cu['A12'].font = F(size=10); entrada(cu.cell(12, 2, 0.06), PCT)
    cu['A13'] = 'horas pagas por mês'; cu['A13'].font = F(size=10); entrada(cu.cell(13, 2, 100), '0')
    cu['A15'] = 'valor da hora'; cu['A15'].font = F(size=12, bold=True); resultado(cu.cell(15, 2, '=SUM(B4:B10)/(1-B12)/B13'), BRL, True)
    m2 = wb.create_sheet('por m²'); base(m2, 'Por metro quadrado', 'um ambiente por linha', [28, 22, 12, 16, 16])
    tipos = wb.create_sheet('tipos'); base(tipos, 'Valor por m² de cada tipo', 'troque pelos seus valores', [36, 16])
    cab(tipos, 4, ['tipo de ambiente', 'R$ por m²'])
    for i, (t, v) in enumerate([('social (sala, jantar, varanda)', 90), ('molhado (cozinha, banheiro, área)', 130), ('íntimo (quartos)', 80), ('circulação', 40), ('comercial', 110)]):
        entrada(tipos.cell(5 + i, 1, t)); entrada(tipos.cell(5 + i, 2, v), BRL)
    cab(m2, 4, ['ambiente', 'tipo', 'área (m²)', 'R$ por m²', 'valor'])
    dv = DataValidation(type='list', formula1='=tipos!$A$5:$A$14', allow_blank=True); m2.add_data_validation(dv)
    for i, (a, t, ar) in enumerate([('sala e jantar', 'social (sala, jantar, varanda)', 22), ('cozinha', 'molhado (cozinha, banheiro, área)', 8), ('quarto casal', 'íntimo (quartos)', 11), ('banheiro', 'molhado (cozinha, banheiro, área)', 3.5)] + [('', '', None)] * 11):
        r = 5 + i
        entrada(m2.cell(r, 1, a or None)); entrada(m2.cell(r, 2, t or None)); entrada(m2.cell(r, 3, ar), '0.0'); dv.add(f'B{r}')
        resultado(m2.cell(r, 4, f'=IF(B{r}="","",VLOOKUP(B{r},tipos!$A$5:$B$14,2,FALSE))'))
        resultado(m2.cell(r, 5, f'=IF(D{r}="","",C{r}*D{r})'))
    m2['A21'] = 'total por m²'; m2['A21'].font = F(size=12, bold=True); resultado(m2.cell(21, 5, '=SUM(E5:E19)'), BRL, True)
    m2['A22'] = 'área total'; m2['A22'].font = F(size=10); resultado(m2.cell(22, 5, '=SUM(C5:C19)'), '0.0')
    ph = wb.create_sheet('por hora'); base(ph, 'Por hora', 'horas estimadas por etapa', [34, 12, 16])
    cab(ph, 4, ['etapa', 'horas', 'valor'])
    for i, (e, h) in enumerate([('levantamento', 4), ('estudo preliminar', 12), ('anteprojeto e 3D', 20), ('projeto executivo', 24), ('detalhamento de marcenaria', 12), ('reuniões e revisões', 8)]):
        r = 5 + i
        entrada(ph.cell(r, 1, e)); entrada(ph.cell(r, 2, h), '0')
        resultado(ph.cell(r, 3, f'=B{r}*custos!$B$15'))
    ph['A12'] = 'total por hora'; ph['A12'].font = F(size=12, bold=True); resultado(ph.cell(12, 3, '=SUM(C5:C10)'), BRL, True)
    cp = wb.create_sheet('comparar'); base(cp, 'Comparar os métodos', 'use o sugerido como ponto de partida', [40, 18])
    cp['A4'] = 'custo estimado da obra'; cp['A4'].font = F(size=10); entrada(cp.cell(4, 2, 60000), BRL)
    cp['A5'] = '% do projeto sobre a obra'; cp['A5'].font = F(size=10); entrada(cp.cell(5, 2, 0.08), PCT)
    cp['A6'] = 'custos extras (RRT, deslocamento, impressão)'; cp['A6'].font = F(size=10); entrada(cp.cell(6, 2, 250), BRL)
    for i, (l, f) in enumerate([('por m²', "='por m²'!E21"), ('por hora', "='por hora'!C12"), ('% da obra', '=B4*B5')]):
        cp.cell(8 + i, 1, l).font = F(size=11); resultado(cp.cell(8 + i, 2, f))
    cp['A12'] = 'valor sugerido (média + extras)'; cp['A12'].font = F(size=12, bold=True); resultado(cp.cell(12, 2, '=AVERAGE(B8:B10)+B6'), BRL, True)
    cp['A13'] = 'mínimo (o menor dos três + extras)'; cp['A13'].font = F(size=10); resultado(cp.cell(13, 2, '=MIN(B8:B10)+B6'))
    cp['A14'] = 'por m² do valor sugerido'; cp['A14'].font = F(size=10); resultado(cp.cell(14, 2, "=IF('por m²'!E22=0,0,B12/'por m²'!E22)"))
    wb.move_sheet('comparar', offset=-4)
    wb.save(os.path.join(OUT, 'arq-honorarios.xlsx'))

caixa(); preco_hora(); honorarios(); print('ok planilhas')
