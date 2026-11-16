# Presente do 8º dia das lojas planê.arquivos e planê.arq: "Planner 2027 do seu negócio", nos 4 estilos.
# Não está à venda: é liberado 7 dias depois da compra (servidor: pasta "presente-<loja>", arquivos "presente-<loja>--<estilo>").
# Uso: python3 presente.py <pasta de saída>  → html/presente-<loja>--<estilo>.html (o pdf sai no Playwright).
import calendar, html, os, sys
from temas_html import FONTES, TEMAS, vars_css

ANO = 2027
OUT = sys.argv[1] if len(sys.argv) > 1 else 'presente'
os.makedirs(os.path.join(OUT, 'html'), exist_ok=True)
E = html.escape
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

# datas que valem post (dia, mês, nome, ideia). Datas móveis de 2027: Carnaval 9/2, Páscoa 28/3, Mães 9/5, Pais 8/8, Black Friday 26/11.
COMUNS = [
    (1, 1, 'Ano-novo', 'agenda do ano aberta'), (9, 2, 'Carnaval', 'horários antes e depois do feriado'),
    (8, 3, 'Dia da Mulher', 'homenagem às suas clientes'), (15, 3, 'Dia do Consumidor', 'condição especial da semana'),
    (28, 3, 'Páscoa', 'mimo ou sorteio'), (7, 4, 'Dia Mundial da Saúde', 'cuidado e bem-estar'),
    (1, 5, 'Dia do Trabalho', 'bastidores da sua rotina'), (9, 5, 'Dia das Mães', 'vale-presente para dar de presente'),
    (12, 6, 'Dia dos Namorados', 'pacote para casal ou vale'), (24, 6, 'São João', 'post temático junino'),
    (20, 7, 'Dia do Amigo', 'indique uma amiga'), (26, 7, 'Dia dos Avós', 'história de uma cliente'),
    (8, 8, 'Dia dos Pais', 'vale-presente'), (7, 9, 'Independência', 'horários do feriado'),
    (15, 9, 'Dia do Cliente', 'agradecimento e mimo surpresa'), (12, 10, 'Dia das Crianças', 'você criança: foto antiga'),
    (26, 11, 'Black Friday', 'a melhor condição do ano'), (25, 12, 'Natal', 'agenda de fim de ano e vale-presente'),
    (31, 12, 'Réveillon', 'retrospectiva do ano'),
]
LOJAS = {
    'arquivos': dict(sub='do seu negócio', extra=[], campanhas={10: 'Outubro Rosa: autocuidado e prevenção', 11: 'Novembro Azul: convide os homens'},
                     metas=['Faturamento do ano', 'Clientes novas por mês', 'Valor médio por atendimento', 'Um curso ou técnica nova', 'Um sonho para o espaço']),
    'arq': dict(sub='do seu escritório', extra=[(8, 11, 'Dia Mundial do Urbanismo', 'uma praça ou rua que você ama'), (15, 12, 'Dia do Arquiteto', 'por que eu escolhi a arquitetura')],
                campanhas={1: 'Janeiro: portfólio do ano que passou', 7: 'Julho: antes e depois de um projeto'},
                metas=['Faturamento do ano', 'Projetos por mês', 'Valor médio por projeto', 'Um curso ou software novo', 'Um sonho para o escritório']),
}

CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Poppins', sans-serif; color: var(--ink); font-size: 9pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pg { width: 210mm; height: 297mm; padding: 14mm 15mm 12mm; position: relative; background: var(--bg); display: flex; flex-direction: column; gap: 6mm; page-break-after: always; overflow: hidden; }
.pg:last-child { page-break-after: auto; }
h1, h2 { margin: 0; font-family: var(--tit); font-style: var(--tit-it); font-weight: var(--tit-w); text-transform: var(--caixa); letter-spacing: var(--esp); color: var(--ink); line-height: 1; }
.ey { font-size: 7pt; letter-spacing: .2em; text-transform: uppercase; color: var(--ac); }
.mut { color: var(--mut); }
.topo { display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 3mm; border-bottom: .3mm solid var(--fio); }
.topo h2 { font-size: 30pt; }
.topo .ano { font-family: var(--tit); font-size: 14pt; color: var(--ac); letter-spacing: .1em; }
.pe { margin-top: auto; display: flex; justify-content: space-between; font-size: 6.8pt; color: var(--mut); letter-spacing: .05em; padding-top: 2.4mm; border-top: .3mm solid var(--fio); }
.box { background: var(--card); border: .3mm solid var(--fio); border-radius: var(--raio); padding: 3.4mm 4mm; }
.sec { font-size: 7pt; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--ac); margin: 0 0 2mm; }
.lin i { display: block; border-bottom: .25mm solid var(--fio); height: 6.4mm; }
/* capa */
.capa { justify-content: center; align-items: center; text-align: center; gap: 5mm; }
.capa .num { font-family: var(--tit); font-size: 96pt; line-height: .9; color: var(--ac); letter-spacing: .02em; }
.capa h1 { font-size: 34pt; }
.capa .sub { font-family: var(--script); font-size: 30pt; color: var(--ac); text-transform: none; letter-spacing: 0; }
.capa .logo { width: 22mm; height: 22mm; border-radius: 50%; border: .35mm dashed var(--ac2); display: grid; place-items: center; font-size: 6.5pt; color: var(--mut); margin-top: 10mm; }
.capa .nome { font-size: 9pt; letter-spacing: .14em; text-transform: uppercase; color: var(--mut); }
.forma { position: absolute; border-radius: 50%; opacity: .55; }
/* ano em uma página */
.ano12 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm 6mm; }
.mini h3 { margin: 0 0 1.5mm; font-family: var(--tit); font-style: var(--tit-it); font-weight: var(--tit-w); text-transform: var(--caixa); letter-spacing: var(--esp); font-size: 12pt; color: var(--ac); }
.mini table { width: 100%; border-collapse: collapse; font-size: 6.6pt; text-align: center; }
.mini th { font-weight: 500; color: var(--mut); font-size: 5.6pt; padding: .6mm 0; }
.mini td { padding: .7mm 0; color: var(--ink); }
.mini td.d { color: var(--bg); background: var(--ac); border-radius: 50%; }
/* metas */
.metas { display: grid; gap: 4mm; }
.meta { display: grid; grid-template-columns: 52mm 1fr; align-items: end; gap: 4mm; }
.meta b { font-weight: 500; font-size: 9pt; }
.meta i { border-bottom: .25mm solid var(--fio); height: 7mm; }
.duas { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
/* mês */
.cal { width: 100%; border-collapse: separate; border-spacing: 1.4mm; table-layout: fixed; }
.cal th { font-size: 6.6pt; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--mut); padding-bottom: .5mm; }
.cal td { height: 24.5mm; vertical-align: top; background: var(--card); border: .25mm solid var(--fio); border-radius: calc(var(--raio) * .7); padding: 1.4mm 1.6mm; }
.cal td.v { background: transparent; border-color: transparent; }
.cal td .n { font-size: 8.4pt; font-weight: 500; }
.cal td.dt { background: var(--soft); border-color: var(--ac2); }
.cal td.dt .n { color: var(--ac); font-weight: 600; }
.cal td .ev { display: block; font-size: 5.6pt; line-height: 1.2; color: var(--ac); margin-top: .8mm; }
.baixo { display: grid; grid-template-columns: 1.15fr 1fr; gap: 5mm; }
.posts li { list-style: none; display: grid; grid-template-columns: 9mm 1fr; gap: 2mm; padding: 1.4mm 0; border-bottom: .25mm solid var(--fio); font-size: 7.8pt; }
.posts { margin: 0; padding: 0; }
.posts b { color: var(--ac); font-weight: 600; }
.posts small { display: block; color: var(--mut); font-size: 7pt; }
.camp { font-size: 7.6pt; color: var(--ink); background: var(--soft); border-radius: var(--raio); padding: 2mm 3mm; margin-top: 2mm; }
.caixa3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.4mm; margin-top: 2mm; }
.caixa3 div { border: .25mm solid var(--fio); border-radius: calc(var(--raio) * .7); padding: 2mm; font-size: 6.6pt; letter-spacing: .1em; text-transform: uppercase; color: var(--mut); height: 14mm; }
.chk li { list-style: none; display: flex; gap: 2mm; align-items: center; padding: 1.2mm 0; border-bottom: .25mm solid var(--fio); font-size: 7.8pt; color: var(--mut); }
.chk li::before { content: ''; width: 2.8mm; height: 2.8mm; border: .3mm solid var(--ac2); border-radius: calc(var(--raio) * .3); flex: none; }
.chk { margin: 0; padding: 0; }
"""
EST_CSS = {
    'criativo': ".forma.a{width:70mm;height:70mm;background:var(--ac2);top:-18mm;right:-16mm}.forma.b{width:54mm;height:54mm;background:var(--soft);bottom:-14mm;left:-12mm;opacity:1}"
                ".topo h2{position:relative;z-index:1}.topo h2::after{content:'';position:absolute;left:-2mm;right:-2mm;bottom:1mm;height:5mm;background:var(--ac2);opacity:.45;z-index:-1;border-radius:3mm}",
    'delicado': ".forma.a{width:64mm;height:64mm;background:var(--soft);top:-20mm;right:-18mm}.forma.b{width:40mm;height:40mm;background:var(--soft);bottom:-12mm;left:-10mm}",
    'minimalista': ".forma{display:none}.topo{border-bottom:.5mm solid var(--ink)}.cal td{border-radius:0}",
    'elegante': ".forma{display:none}.pg{border:.4mm solid var(--ac2);outline:.25mm solid var(--fio);outline-offset:-4mm}.capa .num{font-size:88pt}.topo{border-bottom:.5mm solid var(--ink)}.cal td.dt{background:var(--soft)}",
}

def pe(n, total):
    return f'<div class="pe"><span>[seu nome] · [@seuinstagram]</span><span>{n} / {total}</span></div>'

def mini(m, datas):
    linhas = calendar.Calendar(firstweekday=6).monthdayscalendar(ANO, m)
    corpo = ''.join('<tr>' + ''.join(f'<td class="{"d" if d and (d, m) in datas else ""}">{d or ""}</td>' for d in sem) + '</tr>' for sem in linhas)
    return f'<div class="mini"><h3>{MESES[m - 1]}</h3><table><tr>{"".join(f"<th>{s[0]}</th>" for s in SEM)}</tr>{corpo}</table></div>'

def mes(m, datas, camp):
    do_mes = sorted([x for x in datas.items() if x[0][1] == m])
    linhas = calendar.Calendar(firstweekday=6).monthdayscalendar(ANO, m)
    cel = lambda d: '<td class="v"></td>' if not d else (f'<td class="dt"><span class="n">{d}</span><span class="ev">{E(datas[(d, m)][0])}</span></td>' if (d, m) in datas else f'<td><span class="n">{d}</span></td>')
    cal = f'<table class="cal"><tr>{"".join(f"<th>{s}</th>" for s in SEM)}</tr>' + ''.join('<tr>' + ''.join(cel(d) for d in sem) + '</tr>' for sem in linhas) + '</table>'
    posts = ''.join(f'<li><b>{d:02d}/{m:02d}</b><span>{E(n)}<small>{E(i)}</small></span></li>' for (d, _), (n, i) in do_mes) or '<li><b>—</b><span>mês livre para os seus conteúdos<small>bastidores, resultados e depoimentos</small></span></li>'
    return (f'<div class="topo"><h2>{MESES[m - 1]}</h2><span class="ano">{ANO}</span></div>{cal}'
            f'<div class="baixo"><div class="box"><p class="sec">datas que valem post</p><ul class="posts">{posts}</ul>'
            + (f'<div class="camp">{E(camp)}</div>' if camp else '') +
            '</div><div class="box"><p class="sec">metas do mês</p><ul class="chk"><li></li><li></li><li></li><li></li></ul>'
            '<p class="sec" style="margin-top:3mm">caixa do mês</p><div class="caixa3"><div>entrou</div><div>saiu</div><div>sobrou</div></div></div></div>')

def gera(loja, tema):
    L = LOJAS[loja]
    datas = {(d, m): (n, i) for d, m, n, i in COMUNS + L['extra']}
    pags = []
    pags.append(('capa', f'<span class="forma a"></span><span class="forma b"></span><span class="ey">planner</span><div class="num">{ANO}</div><h1>planner</h1>'
                         f'<div class="sub">{E(L["sub"])}</div><div class="logo">seu<br>logo</div><div class="nome">[seu nome]</div>'))
    pags.append(('', f'<div class="topo"><h2>o ano</h2><span class="ano">{ANO}</span></div><div class="ano12">{"".join(mini(m, datas) for m in range(1, 13))}</div>'
                     '<p class="mut" style="margin:0;font-size:7.4pt">Os dias marcados são datas que valem post: veja as ideias em cada mês.</p>'))
    metas = ''.join(f'<div class="meta"><b>{E(t)}</b><i></i></div>' for t in L['metas'])
    pags.append(('', f'<div class="topo"><h2>metas do ano</h2><span class="ano">{ANO}</span></div><div class="box metas">{metas}</div>'
                     '<div class="duas"><div class="box"><p class="sec">o que eu quero manter</p><div class="lin">' + '<i></i>' * 7 + '</div></div>'
                     '<div class="box"><p class="sec">o que eu quero mudar</p><div class="lin">' + '<i></i>' * 7 + '</div></div></div>'
                     '<div class="box"><p class="sec">a minha palavra do ano</p><div class="lin"><i></i></div></div>'))
    for m in range(1, 13): pags.append(('', mes(m, datas, L['campanhas'].get(m, ''))))
    pags.append(('', f'<div class="topo"><h2>o meu ano</h2><span class="ano">{ANO}</span></div>'
                     '<div class="duas"><div class="box"><p class="sec">o que deu certo</p><div class="lin">' + '<i></i>' * 9 + '</div></div>'
                     '<div class="box"><p class="sec">o que eu aprendi</p><div class="lin">' + '<i></i>' * 9 + '</div></div></div>'
                     '<div class="box"><p class="sec">faturamento mês a mês</p><div class="caixa3" style="grid-template-columns:repeat(6,1fr)">'
                     + ''.join(f'<div>{MESES[i][:3]}</div>' for i in range(12)) + '</div></div>'
                     '<div class="box"><p class="sec">para o ano que vem</p><div class="lin">' + '<i></i>' * 4 + '</div></div>'))
    total = len(pags)
    corpo = ''.join(f'<section class="pg {c}">{h}{"" if c == "capa" else pe(i + 1, total)}</section>' for i, (c, h) in enumerate(pags))
    css = vars_css(tema) + CSS + EST_CSS.get(tema, '')
    nome = f'presente-{loja}--{tema}'
    open(os.path.join(OUT, 'html', f'{nome}.html'), 'w', encoding='utf-8').write(
        f"<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>{FONTES}<style>{css}</style></head><body>{corpo}</body></html>")
    return nome

if __name__ == '__main__':
    print([gera(l, t) for l in LOJAS for t in TEMAS])
