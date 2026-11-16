# Artes de stories (1080 x 1920) em HTML, nos 4 estilos (viram PDF e imagens no Playwright).
# Produtos: agenda de dezembro, confirmação de agendamento e cuidados pós com as fases da cicatrização.
# Uso: python3 stories_html.py <pasta de saída>  → <saída>/html/<id>[--estilo].html
import calendar, html, os, sys
from temas_html import FONTES, TEMAS, vars_css

OUT = os.path.join(sys.argv[1] if len(sys.argv) > 1 else 'stories', 'html')
os.makedirs(OUT, exist_ok=True)
E = html.escape
ANO = 2026

CSS = """
@page { size: 1080px 1920px; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Poppins', sans-serif; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pg { width: 1080px; height: 1920px; position: relative; overflow: hidden; background: var(--bg); display: flex; flex-direction: column; align-items: center; padding: 150px 96px 120px; page-break-after: always; }
.pg:last-child { page-break-after: auto; }
.pg > * { flex-shrink: 0; }
.pg { justify-content: center; padding-top: 120px; padding-bottom: 150px; }
.pg:has(> .enfeites) { justify-content: flex-start; }
.moldura { position: absolute; inset: 44px; border: 2px solid var(--fio); border-radius: calc(var(--raio) * 4); pointer-events: none; }
.ey { font-size: 26px; letter-spacing: .42em; text-transform: uppercase; color: var(--mut); }
.etq { display: inline-block; background: var(--ink); color: var(--bg); font-size: 28px; letter-spacing: .5em; padding: 12px 22px 12px 34px; text-transform: uppercase; border-radius: calc(var(--raio) * 2); }
h1, h2 { margin: 0; font-family: var(--tit); font-weight: var(--tit-w); font-style: var(--tit-it); text-transform: var(--caixa); letter-spacing: var(--esp); color: var(--ink); line-height: 1; text-align: center; }
h1 { font-size: 150px; } h2 { font-size: 96px; }
.cur { font-family: var(--script); font-size: 92px; color: var(--ac); line-height: .9; text-transform: none; letter-spacing: 0; }
.txt { font-size: 32px; line-height: 1.6; text-align: center; color: var(--ink); }
.mut { color: var(--mut); }
.lista { width: 100%; margin: 0; padding: 0; list-style: none; display: grid; gap: 34px; }
.lista li { display: grid; grid-template-columns: 54px 1fr; gap: 22px; font-size: 32px; line-height: 1.5; align-items: start; }
.lista li::before { content: ''; width: 40px; height: 40px; margin-top: 6px; border-radius: calc(var(--raio) * 1.4); border: 2.5px solid var(--ac); background: radial-gradient(circle, var(--ac) 0 28%, transparent 30%); }
.lista b { font-weight: 600; }
.caixa { border: 2.5px solid var(--ac2); border-radius: calc(var(--raio) * 3); padding: 26px 34px; font-size: 28px; letter-spacing: .06em; text-align: center; font-weight: 600; text-transform: uppercase; }
.faixa { width: 100%; background: var(--ink); color: var(--bg); text-align: center; font-size: 25px; letter-spacing: .14em; padding: 18px; border-radius: calc(var(--raio) * 2); text-transform: uppercase; }
.foto { position: relative; background: var(--soft); border: 2.5px dashed var(--ac2); display: grid; place-items: center; color: var(--ac); overflow: hidden; }
.foto span { font-size: 24px; letter-spacing: .3em; text-transform: uppercase; text-align: center; line-height: 1.6; }
.foto svg { width: 64px; height: 64px; margin: 0 auto 14px; display: block; stroke: var(--ac); fill: none; stroke-width: 1.6; }
.rodape { position: absolute; bottom: 86px; left: 0; right: 0; text-align: center; font-size: 24px; letter-spacing: .3em; color: var(--mut); text-transform: uppercase; }
.cal { width: 100%; background: var(--soft); border-radius: calc(var(--raio) * 3); padding: 34px 40px 26px; }
.cal table { width: 100%; border-collapse: collapse; text-align: center; font-size: 40px; }
.cal th { font-family: var(--tit); font-size: 44px; padding-bottom: 18px; color: var(--ink); }
.cal td { padding: 14px 0; color: var(--ink); }
.cal td.f { color: var(--mut); opacity: .45; }
.cal td.d span { display: inline-grid; place-items: center; width: 70px; height: 70px; border-radius: 50%; background: var(--ac); color: var(--bg); }
.linha { display: flex; gap: 18px; align-items: center; font-size: 30px; }
.linha .tag { background: var(--ink); color: var(--bg); padding: 6px 16px; letter-spacing: .1em; border-radius: calc(var(--raio) * 1.2); }
.pag { width: 100%; display: grid; gap: 40px; }
.pag .it { display: grid; grid-template-columns: 96px 1fr; gap: 28px; align-items: center; }
.pag .ic { width: 96px; height: 96px; border-radius: 50%; border: 2.5px solid var(--ac); display: grid; place-items: center; color: var(--ac); }
.pag .ic svg { width: 46px; height: 46px; stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.pag b { display: block; font-family: var(--tit); font-size: 56px; font-weight: var(--tit-w); letter-spacing: var(--esp); text-transform: var(--caixa); }
.pag small { display: block; font-size: 26px; color: var(--mut); letter-spacing: .08em; text-transform: uppercase; line-height: 1.5; }
.enfeites { position: absolute; top: 0; left: 0; right: 0; height: 430px; }
.enfeites svg { width: 100%; height: 100%; }
.fases { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 34px 40px; }
.fase { display: grid; grid-template-columns: 116px 1fr; gap: 22px; align-items: center; }
.fase .dia { width: 116px; height: 116px; border-radius: 50%; background: var(--soft); border: 2.5px solid var(--ac2); display: grid; place-items: center; text-align: center; line-height: 1; }
.fase .dia b { display: block; font-family: var(--tit); font-size: 46px; color: var(--ac); font-weight: var(--tit-w); }
.fase .dia small { font-size: 18px; letter-spacing: .2em; text-transform: uppercase; color: var(--mut); }
.fase p { margin: 0; font-size: 28px; line-height: 1.45; }
.fase p em { display: block; font-style: normal; font-size: 22px; color: var(--mut); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 4px; }
.leg2 { display: flex; gap: 34px; justify-content: center; flex-wrap: wrap; font-size: 26px; color: var(--mut); }
.leg2 span { display: inline-flex; align-items: center; gap: 10px; } .leg2 i { width: 22px; height: 22px; border-radius: 50%; background: var(--ac); } .leg2 b { color: var(--ink); }
.duo { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.duo div { border: 2.5px solid var(--ac2); border-radius: calc(var(--raio) * 3); padding: 30px; text-align: center; }
.duo b { display: block; font-family: var(--tit); font-size: 66px; font-weight: var(--tit-w); color: var(--ink); line-height: 1; }
.duo small { display: block; margin-top: 10px; font-size: 24px; letter-spacing: .2em; text-transform: uppercase; color: var(--mut); }
.tab { width: 100%; display: grid; gap: 0; border-top: 2px solid var(--fio); }
.tab div { display: flex; justify-content: space-between; align-items: center; padding: 30px 8px; border-bottom: 2px solid var(--fio); font-size: 32px; }
.tab b { font-family: var(--tit); font-size: 48px; font-weight: var(--tit-w); text-transform: var(--caixa); letter-spacing: var(--esp); }
.pacotes { width: 100%; display: grid; gap: 34px; }
.pacotes > div { display: grid; grid-template-columns: 250px 1fr; gap: 34px; align-items: center; }
.pacotes b { display: block; font-family: var(--tit); font-size: 50px; font-weight: var(--tit-w); text-transform: var(--caixa); letter-spacing: var(--esp); }
.pacotes small { display: block; font-size: 26px; color: var(--mut); margin: 6px 0 10px; }
.pacotes em { font-style: normal; font-size: 34px; font-weight: 600; color: var(--ac); }
.vale { width: 100%; display: grid; gap: 40px; border: 2.5px solid var(--ac2); border-radius: calc(var(--raio) * 4); padding: 56px 56px 60px; }
.campo2 { display: flex; align-items: flex-end; gap: 18px; font-size: 28px; letter-spacing: .14em; text-transform: uppercase; color: var(--mut); }
.campo2 i { flex: 1; border-bottom: 2.5px solid var(--fio); height: 40px; }
.opcoes { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.opcoes span { background: var(--ink); color: var(--bg); text-align: center; padding: 18px; font-size: 27px; letter-spacing: .08em; border-radius: calc(var(--raio) * 2); }
"""
EXTRA = {
    'delicado': '.moldura{border-color:var(--soft);border-width:3px}',
    'criativo': '.moldura{display:none}.pg::before{content:"";position:absolute;width:520px;height:520px;border-radius:50%;background:var(--soft);top:-200px;right:-180px}.pg::after{content:"";position:absolute;width:360px;height:360px;border-radius:50%;background:var(--ac2);opacity:.35;bottom:-150px;left:-120px}.pg>*{position:relative;z-index:1}.pg>.enfeites,.pg>.rodape,.pg>.moldura{position:absolute;z-index:1}',
    'minimalista': '.moldura{border-color:var(--ink);border-width:2px;border-radius:0}',
    'elegante': '.moldura{border-color:var(--ac2);outline:1.5px solid var(--fio);outline-offset:-16px;border-radius:2px}',
}
CAM = '<svg viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/></svg>'
def foto(w, h, forma='rr', texto='arraste a sua<br>foto aqui'):
    raio = '50%' if forma == 'circ' else '999px 999px 24px 24px' if forma == 'arco' else 'calc(var(--raio) * 4)'
    return f'<div class="foto" style="width:{w}px;height:{h}px;border-radius:{raio}"><span>{CAM}{texto}</span></div>'

# enfeites de natal desenhados (bola, estrela, árvore, presente, laço, sino, meia), pendurados por fios
def enfeites():
    cor = 'var(--ac)'
    def fio(x, y): return f'<line x1="{x}" y1="0" x2="{x}" y2="{y}" stroke="{cor}" stroke-width="2.2"/>'
    itens = [
        (80, 150, f'<circle cx="0" cy="34" r="34" fill="none" stroke="{cor}" stroke-width="3"/><path d="M-10 0h20v8h-20z" fill="none" stroke="{cor}" stroke-width="3"/><path d="M-22 24c14 8 30 8 44 0M-26 44c17 9 35 9 52 0" fill="none" stroke="{cor}" stroke-width="2.2"/>'),
        (205, 95, f'<path d="M0 0 9 22l24 2-18 15 6 24L0 50l-21 13 6-24-18-15 24-2z" fill="none" stroke="{cor}" stroke-width="3" stroke-linejoin="round"/>'),
        (330, 205, f'<path d="M0 0 30 40H14l26 32H22l28 34H-50l28-34H-40l26-32H-30z" fill="none" stroke="{cor}" stroke-width="3" stroke-linejoin="round"/><path d="M-6 106h12v18h-12z" fill="none" stroke="{cor}" stroke-width="3"/>'),
        (465, 130, f'<path d="M-36 22h72v58h-72zM-42 6h84v16h-84zM0 6v74" fill="none" stroke="{cor}" stroke-width="3"/><path d="M0 6c-8-14-28-18-28-6s20 6 28 6c8 0 28 6 28-6s-20-8-28 6" fill="none" stroke="{cor}" stroke-width="3"/>'),
        (600, 225, f'<path d="M0 0c-8 0-12 6-12 14v20l-10 16h44l-10-16V14c0-8-4-14-12-14zM-6 54a6 6 0 0 0 12 0" fill="none" stroke="{cor}" stroke-width="3" stroke-linejoin="round"/>'),
        (730, 110, f'<circle cx="0" cy="34" r="34" fill="none" stroke="{cor}" stroke-width="3"/><path d="M-10 0h20v8h-20z" fill="none" stroke="{cor}" stroke-width="3"/><path d="M0 12v44M-22 34h44M-16 18l32 32M16 18l-32 32" stroke="{cor}" stroke-width="2"/>'),
        (860, 180, f'<path d="M-16 0h22v40c0 8 6 12 14 12h6v18h-12c-18 0-30-12-30-30z" fill="none" stroke="{cor}" stroke-width="3" stroke-linejoin="round"/><path d="M-20 0h30v12h-30z" fill="none" stroke="{cor}" stroke-width="3"/>'),
        (990, 120, f'<path d="M0 0 9 22l24 2-18 15 6 24L0 50l-21 13 6-24-18-15 24-2z" fill="none" stroke="{cor}" stroke-width="3" stroke-linejoin="round"/>'),
    ]
    corpo = ''.join(f'{fio(x, y)}<g transform="translate({x} {y})">{d}</g>' for x, y, d in itens)
    pontos = ''.join(f'<text x="{x}" y="{y}" font-size="26" fill="{cor}" text-anchor="middle">+</text>' for x, y in [(140, 330), (420, 300), (690, 360), (950, 300), (270, 400), (820, 410)])
    return f'<div class="enfeites"><svg viewBox="0 0 1080 430">{corpo}{pontos}</svg></div>'

def pagina(corpo, rodape=True):
    return f'<section class="pg"><div class="moldura"></div>{corpo}{"<div class=rodape>[seu espaço] · @seuperfil</div>" if rodape else ""}</section>'

def doc(nome, paginas):
    corpo = ''.join(paginas)
    for t in TEMAS:
        n = nome if t == 'criativo' else f'{nome}--{t}'
        open(os.path.join(OUT, f'{n}.html'), 'w', encoding='utf-8').write(
            f"<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>{FONTES}<style>{vars_css(t)}{CSS}{EXTRA.get(t, '')}</style></head><body>{corpo}</body></html>")

ICO = {
    'pix': '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M8 12h8M12 8v8"/>',
    'cartao': '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    'dinheiro': '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>',
    'pin': '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    'relogio': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
}
def ic(k): return f'<svg viewBox="0 0 24 24">{ICO[k]}</svg>'

# ===== 1) agenda de fim de ano: natal e ano novo (10 stories), enfeites mínimos =====
def galho():
    # fio fino com três pingentes (estrela, bolinha, estrela) e pontinhos: discreto, sem excesso de natal
    c = 'var(--ac)'
    fios = ''.join(f'<line x1="{x}" y1="0" x2="{x}" y2="{y}" stroke="{c}" stroke-width="1.6"/>' for x, y in [(300, 150), (540, 230), (780, 150)])
    estrela = lambda x, y: f'<path transform="translate({x} {y})" d="M0 -22 5.5 -6.5 22 -6 9 4 13.5 20 0 10.5 -13.5 20 -9 4 -22 -6 -5.5 -6.5z" fill="none" stroke="{c}" stroke-width="2.2" stroke-linejoin="round"/>'
    bola = f'<circle cx="540" cy="262" r="30" fill="none" stroke="{c}" stroke-width="2.2"/><rect x="530" y="226" width="20" height="9" rx="2" fill="none" stroke="{c}" stroke-width="2"/>'
    pts = ''.join(f'<circle cx="{x}" cy="{y}" r="3.2" fill="{c}" opacity=".55"/>' for x, y in [(190, 120), (420, 90), (660, 100), (890, 130), (240, 260), (840, 270)])
    return f'<div class="enfeites"><svg viewBox="0 0 1080 430">{fios}{estrela(300, 172)}{bola}{estrela(780, 172)}{pts}</svg></div>'
def brilho(x, y, t=1):
    return f'<path transform="translate({x} {y}) scale({t})" d="M0 -26 C3 -8 8 -3 26 0 C8 3 3 8 0 26 C-3 8 -8 3 -26 0 C-8 -3 -3 -8 0 -26z" fill="var(--ac)"/>'
def brilhos():
    return f'<div class="enfeites"><svg viewBox="0 0 1080 430">{brilho(250, 170, 1.4)}{brilho(330, 110, .6)}{brilho(820, 150, 1.1)}{brilho(760, 230, .5)}{brilho(540, 90, .8)}</svg></div>'
def cal_mes(ano, mes, marcas):
    linhas = calendar.Calendar(firstweekday=6).monthdayscalendar(ano, mes)
    corpo = ''.join('<tr>' + ''.join(f'<td class="{"d" if d in marcas else "f" if d == 0 else ""}">{"<span>" + str(d) + "</span>" if d in marcas else (d or "")}</td>' for d in sem) + '</tr>' for sem in linhas)
    return f'<div class="cal"><table><tr>{"".join(f"<th>{d}</th>" for d in "DSTQQSS")}</tr>{corpo}</table></div>'
LEG = lambda pares: '<div class="leg2">' + ''.join(f'<span><i></i><b>{d}</b> {t}</span>' for d, t in pares) + '</div>'
HOR = [('seg a sex', '[das 8h às 20h]'), ('sábados', '[das 8h às 16h]'), ('24/12', '[das 8h às 14h]'), ('25/12', 'fechado'), ('31/12', '[das 8h às 13h]'), ('01/01', 'fechado')]
doc('beleza-agenda-dezembro', [
    pagina(galho() + '<div style="height:330px"></div><span class="etq">agenda de</span><h1 style="margin-top:22px;font-size:132px">fim de ano</h1>'
           + '<span class="cur" style="margin-top:6px">natal &amp; ano novo</span><div style="height:56px"></div>' + foto(460, 460, 'arco') + '<div style="height:56px"></div>'
           + '<p class="txt mut" style="font-size:26px;letter-spacing:.24em;text-transform:uppercase">horários · valores · como agendar</p>'),
    pagina('<span class="cur">um recado</span><h2>para você</h2><div style="height:80px"></div>'
           + '<p class="txt" style="text-align:left">Oi, tudo bem?</p><div style="height:24px"></div>'
           + '<p class="txt" style="text-align:left">O fim de ano chegou e a agenda enche rápido! Separei aqui tudo o que você precisa para garantir o seu horário: datas, horários especiais, formas de pagamento e como agendar.</p><div style="height:24px"></div>'
           + '<p class="txt" style="text-align:left">Leia até o final e, qualquer dúvida, é só me chamar.</p><div style="height:60px"></div>'
           + '<p class="txt" style="text-align:left;width:100%">Com carinho,</p><p class="cur" style="font-size:84px;align-self:flex-start">[seu nome]</p><div style="height:60px"></div>'
           + foto(888, 330, 'rr', 'a sua foto ou do seu espaço')),
    pagina('<span class="cur">como</span><h2>agendar</h2><div style="height:70px"></div>'
           + '<p class="txt mut" style="font-size:25px;letter-spacing:.14em;text-transform:uppercase">mande a mensagem assim:</p><div style="height:18px"></div>'
           + '<div class="faixa">nome · procedimento · dia e horário</div><div style="height:80px"></div>'
           + '<ul class="lista"><li><span>Os horários são confirmados com o <b>sinal de [50%]</b>.</span></li>'
           + '<li><span>Sem o sinal em até <b>[24 horas]</b>, o horário volta para a agenda.</span></li>'
           + '<li><span>Tolerância de atraso de <b>[10 minutos]</b>.</span></li>'
           + '<li><span>Imprevisto? Avise com pelo menos <b>[24 horas]</b>.</span></li></ul>'
           + '<div style="height:80px"></div><div class="caixa">o sinal não é devolvido em caso de falta</div>'),
    pagina('<span class="cur">abertura da</span><h2>agenda</h2><div style="height:60px"></div>'
           + '<div class="duo"><div><b>[01/11]</b><small>clientes fixas</small></div><div><b>[10/11]</b><small>clientes novas</small></div></div><div style="height:70px"></div>'
           + f'<span class="cur" style="font-size:80px">dezembro</span><div style="height:20px"></div>{cal_mes(ANO, 12, (24, 25, 31))}<div style="height:30px"></div>'
           + LEG([('24', 'véspera de natal'), ('25', 'natal'), ('31', 'réveillon')])),
    pagina('<span class="cur">horários</span><h2>especiais</h2><div style="height:80px"></div>'
           + '<div class="tab">' + ''.join(f'<div><b>{d}</b><span>{h}</span></div>' for d, h in HOR) + '</div>'
           + f'<div style="height:80px"></div><div class="caixa">recesso: [02/01] a [10/01/{ANO + 1}]</div>'),
    pagina('<span class="cur">especial de</span><h2>fim de ano</h2><div style="height:70px"></div>'
           + '<div class="pacotes">' + ''.join(f'<div>{foto(250, 250, "circ", "foto")}<span><b>{n}</b><small>{t}</small><em>R$ [000,00]</em></span></div>' for n, t in [('[pacote 1]', '[o que inclui]'), ('[pacote 2]', '[o que inclui]'), ('[pacote 3]', '[o que inclui]')]) + '</div>'
           + '<div style="height:50px"></div><p class="txt mut" style="font-size:26px">Válido de [01/12] a [31/12]. Vagas limitadas.</p>'),
    pagina(galho() + '<div style="height:360px"></div><span class="cur">vale</span><h1 style="font-size:150px">presente</h1><div style="height:50px"></div>'
           + '<div class="vale"><div class="campo2"><span>para</span><i></i></div><div class="campo2"><span>de</span><i></i></div><div class="campo2"><span>serviço ou valor</span><i></i></div><div class="campo2"><span>válido até</span><i></i></div></div>'
           + '<div style="height:60px"></div><p class="txt">O presente mais bonito do natal: um momento de cuidado. <b>Peça o seu!</b></p>'),
    pagina('<span class="cur">formas de</span><h2>pagamento</h2><div style="height:120px"></div><div class="pag">'
           + f'<div class="it"><span class="ic">{ic("pix")}</span><span><b>pix</b><small>chave: [sua chave pix]<br>banco: [seu banco]</small></span></div>'
           + f'<div class="it"><span class="ic">{ic("cartao")}</span><span><b>cartão</b><small>peça o link de pagamento</small></span></div>'
           + f'<div class="it"><span class="ic">{ic("dinheiro")}</span><span><b>dinheiro</b><small>no dia do atendimento</small></span></div></div>'
           + '<div style="height:120px"></div><div class="caixa" style="font-size:25px">pague o sinal só depois da confirmação.<br>respondo por ordem de chegada.</div>'),
    pagina('<h2>endereço</h2><div style="height:50px"></div>'
           + f'<div class="linha" style="font-size:30px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">{ic("pin").replace("<svg", "<svg style=\"width:56px;height:56px;stroke:var(--ac);fill:none;stroke-width:1.7\"")}<span>[rua, número · bairro]<br>[cidade · estado]</span></div><div style="height:60px"></div>'
           + foto(620, 620, 'circ', 'foto da fachada<br>ou do seu espaço') + '<div style="height:60px"></div>'
           + '<div class="caixa" style="font-size:24px;letter-spacing:.3em">ponto de referência</div><div style="height:22px"></div>'
           + '<p class="txt" style="text-transform:uppercase;letter-spacing:.14em;font-size:27px;font-weight:600">[em frente a tal lugar]<br>[portão, sala ou andar]</p>'),
    pagina(brilhos() + '<div style="height:360px"></div><p class="txt" style="font-weight:600;letter-spacing:.24em;text-transform:uppercase;font-size:26px">obrigada por este ano!</p>'
           + f'<div style="display:flex;align-items:baseline;gap:22px;margin:14px 0"><span class="cur" style="font-size:96px">feliz</span><h1 style="font-size:190px">{ANO + 1}</h1></div>'
           + '<p class="txt">Que o novo ano venha leve, cheio de cuidado e de encontros bonitos. Conto com você!</p><div style="height:50px"></div>'
           + '<span class="cur" style="font-size:96px">boas festas!</span><div style="height:50px"></div>' + foto(400, 400, 'arco', 'a sua foto<br>ou da equipe')),
])

# ===== 2) confirmação de agendamento (2 stories) =====
doc('beleza-confirmacao', [
    pagina('<span class="cur">seu horário</span><h2>foi agendado!</h2><div style="height:60px"></div>'
           + '<div class="faixa">todas as informações chegam no seu e-mail · leia até o final</div><div style="height:90px"></div>'
           + '<ul class="lista"><li><span>Tolerância de atraso de até <b>[10 minutos]</b>.</span></li>'
           + '<li><span>Venha sem acompanhantes, para o atendimento ser só seu.</span></li>'
           + '<li><span>Em caso de falta sem aviso, é cobrada uma taxa de <b>[50%]</b> do procedimento para remarcar.</span></li>'
           + '<li><span>Está de acordo? Responda <b>"ok"</b> para confirmar.</span></li></ul><div style="height:80px"></div>'
           + f'<div class="linha" style="font-size:27px;letter-spacing:.08em;text-transform:uppercase">{ic("pin").replace("<svg", "<svg style=\"width:52px;height:52px;stroke:var(--ac);fill:none;stroke-width:1.7\"")}<span>[rua, número · sala]<br>[bairro · cidade]</span></div>'),
    pagina('<span class="cur">até</span><h2>logo!</h2><div style="height:60px"></div>' + foto(760, 760, 'arco', 'a sua foto<br>ou do seu espaço') + '<div style="height:70px"></div>'
           + '<div class="caixa" style="width:100%">dia [dd/mm] · às [00h00]</div><div style="height:22px"></div>'
           + '<p class="txt">[procedimento]</p><p class="txt mut" style="font-size:27px">Precisa remarcar? Me avise com [24 horas] de antecedência.</p>'),
])

# ===== 3) cuidados pós micropigmentação e brow lamination, com as fases da cicatrização =====
def cuidados(nome, proc, itens, fases, hidratar):
    lista = ''.join(f'<li><span>{t}</span></li>' for t in itens)
    p1 = pagina(foto(888, 440, 'rr', 'a sua foto do resultado') + '<div style="height:40px"></div>'
                + f'<span class="cur">cuidados pós</span><h2 style="font-size:{86 if len(proc) > 12 else 96}px">{E(proc)}</h2><div style="height:22px"></div>'
                + '<p class="txt mut" style="font-size:28px">Você acabou de fazer o seu procedimento: agora os cuidados de casa são com você!</p><div style="height:50px"></div>'
                + f'<ul class="lista" style="gap:24px">{lista}</ul>')
    fs = ''.join(f'<div class="fase"><span class="dia"><span><small>dia</small><b>{d}</b></span></span><p><em>{a}</em>{b}</p></div>' for d, a, b in fases)
    p2 = pagina(('<p class="txt" style="font-weight:600;letter-spacing:.1em;text-transform:uppercase">importante</p><p class="txt" style="font-size:29px">' + hidratar[0] + '</p><div style="height:20px"></div>'
                 + '<div class="opcoes">' + ''.join(f'<span>{o}</span>' for o in hidratar[1]) + '</div><div style="height:20px"></div>'
                 + f'<p class="txt mut" style="font-size:27px;font-style:italic">{hidratar[2]}</p><div style="height:70px"></div>' if hidratar else '<div style="height:120px"></div>')
                + '<span class="cur">fases da</span><h2>cicatrização</h2><div style="height:60px"></div>' + f'<div class="fases">{fs}</div>'
                + '<div style="height:70px"></div><span class="cur" style="font-size:70px">obrigada pela preferência!</span>')
    doc(nome, [p1, p2])

cuidados('sob-micro-cuidados', 'micropigmentação', [
    'Não molhe a região nas primeiras <b>24 horas</b>.', 'Evite sol direto no local por <b>30 dias</b>.', 'Nada de sauna, piscina e mar nos primeiros <b>7 dias</b>.',
    'Não use cremes com ácidos na região.', 'Cuidado com calor de forno, secador e vapor.', 'Sem maquiagem na região até cicatrizar (cerca de <b>10 dias</b>).',
    'Não arranque as casquinhas: deixe cair sozinhas.', 'Retoque depois de <b>30 dias</b>.'],
    [('1', 'amei!', 'A cor está linda e marcada.'), ('2', 'muito escura?', 'É normal parecer mais escura e grossa.'), ('5', 'descascando', 'As casquinhas começam a sair; fica mais clara.'),
     ('7', 'sumiu?', 'Parece que apagou: é a pele se renovando.'), ('15', 'voltando', 'A cor volta aos poucos.'), ('30', 'perfeita!', 'Cor final: hora do retoque.')],
    ('Limpe com soro fisiológico e passe uma destas opções:', ['[pomada indicada]', 'óleo de girassol', 'óleo de coco', 'manteiga de cacau'], 'Três vezes ao dia, por 10 dias, para manter a pele hidratada.'))
cuidados('sob-brow-cuidados', 'brow lamination', [
    'Não molhe as sobrancelhas por <b>24 horas</b>.', 'Nos primeiros <b>2 a 3 dias</b>, nada de peeling, bronzeamento ou máscaras no rosto.',
    'Evite banho muito quente e sol na primeira semana.', 'Penteie as sobrancelhas todos os dias.', 'Depois da primeira semana, hidrate com óleo de coco, rícino ou argan.'],
    [('1', 'no lugar', 'Os fios ficam alinhados e com volume.'), ('3', 'liberado', 'Já pode molhar e lavar o rosto normalmente.'), ('7', 'hidratar', 'Comece a hidratação com óleo todos os dias.'),
     ('15', 'firme', 'O efeito continua bonito com os cuidados.'), ('30', 'leve', 'Os fios voltam aos poucos ao natural.'), ('45', 'de novo?', 'Hora de agendar a próxima.')],
    None)
print('ok', sorted(os.listdir(OUT)))
