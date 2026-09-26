import { useState, type ReactNode } from 'react'
import { go } from '../router'
import { Icon } from '../components/Icon'

/* Manual de uso: a jornada do pedido de orçamento até a entrega, com "onde fica" e atalho para cada tela. */

type Where = { path: string[]; page?: string; id?: string }

interface Step {
  n: string
  title: string
  when: string
  where: Where
  todo: ReactNode[]
  tip?: ReactNode
}

const STEPS: Step[] = [
  {
    n: '01',
    title: 'Chegou um pedido: cadastre a cliente',
    when: 'Alguém pediu orçamento pelo WhatsApp, Instagram ou indicação.',
    where: { path: ['clientes', 'novo cliente'], page: 'clientes' },
    todo: [
      <>Vá em <b>clientes</b> e clique em <b>novo cliente</b> (ou use o botão <b>+ novo</b> no topo → <b>Cliente</b>).</>,
      <>Preencha nome, telefone e o <b>tipo</b> (arquiteto, designer, escritório, construtora ou estudante). O tipo muda a cor e o desconto de estudante.</>,
      <>Se a cliente já existe, pule este passo: ela aparece na lista ao montar o orçamento.</>,
    ],
    tip: <>Dá para cadastrar a cliente direto no orçamento, no botão <b>+</b> ao lado do campo cliente. O <b>lápis</b> ao lado edita os dados dela.</>,
  },
  {
    n: '02',
    title: 'Monte o orçamento',
    when: 'Você já entendeu o que a cliente precisa.',
    where: { path: ['orçamentos', 'novo orçamento'], page: 'orcamentos', id: 'novo' },
    todo: [
      <>Em <b>dados</b>: escolha a cliente, escreva o título do quadro (ex.: “modelagem fachada”).</>,
      <><b>Área (m²)</b> começa em 0: só preencha quando for modelagem, executivo ou detalhamento. Com 0, não aparece no PDF.</>,
      <><b>Modelo</b>: “valor único” ou “2 opções” (quando quer oferecer duas propostas lado a lado).</>,
      <>Em <b>serviços</b>, adicione cada item da tabela. Para dar desconto numa imagem, use o desconto por unidade; para serviço sem preço fixo, digite o valor livre.</>,
      <>Deixe marcado <b>gerar proposta em PDF</b> só se for mandar o PDF.</>,
      <>Confira <b>informações da proposta</b>: pagamento, prazos e cronograma e formatos de arquivo (já vêm preenchidos). <b>Rodadas de ajuste</b> vêm com 1.</>,
    ],
    tip: <>No PDF fica só “Prazos e cronograma: serão definidos conforme a necessidade do cliente.” O prazo de verdade você alinha com a cliente antes de fechar e registra no sistema (passo 05).</>,
  },
  {
    n: '03',
    title: 'Envie para a cliente',
    when: 'O orçamento está pronto.',
    where: { path: ['orçamentos', 'abrir o orçamento', 'baixar PDF / enviar'], page: 'orcamentos' },
    todo: [
      <><b>baixar PDF</b> salva “Proposta #001 - Nome da cliente.pdf”.</>,
      <><b>enviar</b> abre o WhatsApp com o resumo pronto; anexe o PDF na conversa. O status muda sozinho para <b>enviado</b>.</>,
      <>Prefere escrever do seu jeito? <b>mensagens</b> mostra os textos padrão para copiar.</>,
    ],
  },
  {
    n: '04',
    title: 'Aguarde a resposta (e cobre, se sumir)',
    when: 'Proposta enviada, cliente ainda não respondeu.',
    where: { path: ['início', 'para fazer'], page: 'inicio' },
    todo: [
      <>Depois de 3 dias sem resposta, aparece em <b>início → para fazer</b> um “Pedir retorno” com botão de <b>mensagem</b>.</>,
      <>Em <b>orçamentos</b>, o filtro <b>cobrar resposta</b> mostra todos que estão esperando.</>,
      <>Se recusou: na lista de orçamentos, clique na pílula de status e escolha <b>Recusado</b>.</>,
    ],
  },
  {
    n: '05',
    title: 'Fechou! Aprove o orçamento',
    when: 'A cliente topou (com ou sem negociação).',
    where: { path: ['orçamentos', 'pílula de status', 'Aprovado'], page: 'orcamentos' },
    todo: [
      <>Na lista de <b>orçamentos</b>, clique na pílula de status e escolha <b>Aprovado</b> (ou, dentro do orçamento, <b>aprovado → criar demanda</b>).</>,
      <>Na janela <b>Fechou por quanto?</b>: se negociou, troque o valor. O PDF continua com o valor original; o financeiro usa o fechado.</>,
      <>Se vocês alinharam um prazo, coloque em <b>Prazo combinado · se houver</b>, na mesma janela. Sem pressa? Deixe em branco.</>,
      <>A demanda é criada sozinha em <b>demandas</b>, na coluna <b>em alinhamento</b>, com as parcelas “sinal 50%” e “saldo 50%”.</>,
    ],
    tip: <>Orçamento com vários serviços vira um <b>pacote</b> automaticamente, para você poder retirar um projeto depois sem refazer a conta.</>,
  },
  {
    n: '06',
    title: 'Receba o sinal',
    when: 'Logo depois de fechar.',
    where: { path: ['demandas', 'cartão da demanda', 'botão do sinal'], page: 'projetos' },
    todo: [
      <>Enquanto o sinal não chega, aparece em <b>início → para fazer</b> como “aguardando o sinal”, com botão <b>cobrar</b>.</>,
      <>Quando pagar: clique no botão do sinal no <b>cartão da demanda</b> (ou em <b>Marcar pago</b> no financeiro / na demanda).</>,
      <>Ao marcar o sinal, a demanda passa sozinha para <b>em execução</b>.</>,
    ],
  },
  {
    n: '07',
    title: 'Execute o projeto',
    when: 'Durante o trabalho.',
    where: { path: ['demandas', 'abrir a demanda'], page: 'projetos' },
    todo: [
      <>Mude a fase clicando na <b>pílula de fase</b> (no quadro, na lista ou no início). Não precisa abrir nada.</>,
      <>Dentro da demanda: marque as <b>etapas</b> conforme avança, conte as <b>revisões</b> (+ / −) e anote tudo em <b>briefing e anotações</b>.</>,
      <>Reunião ou entrega parcial? <b>compromissos → +</b>. Aparece na agenda.</>,
      <>Prazo combinado depois? Clique na data do card <b>prazo combinado</b>, no topo da demanda, e escolha o dia.</>,
      <>O link da pasta (Drive, WeTransfer) fica em <b>editar → Link dos arquivos</b>.</>,
    ],
  },
  {
    n: '08',
    title: 'Envie para aprovação e entregue',
    when: 'Prévia pronta / arquivos finais.',
    where: { path: ['demandas', 'pílula de fase'], page: 'projetos' },
    todo: [
      <>Mandou a prévia? Mude a fase para <b>aguardando aprovação</b>. A partir daqui o saldo vira <b>a cobrar</b>.</>,
      <>Pediu ajustes? Fase <b>em ajustes</b> e some +1 em revisões.</>,
      <>Aprovou: receba o saldo e clique em <b>Marcar pago</b>. Para enviar recibo, use o ícone de <b>impressora</b> na parcela paga.</>,
      <>Por fim, <b>marcar como entregue</b> no topo da demanda.</>,
    ],
    tip: <>Os textos de cobrança, aprovação e entrega ficam no botão <b>mensagens</b> da demanda, já com o nome da cliente e os valores.</>,
  },
]

const CASES: { q: string; a: ReactNode; page?: string }[] = [
  {
    q: 'A cliente pediu algo a mais depois de fechar',
    a: <>Na demanda, em <b>pagamentos → + adicional</b>. Escolha somar na parcela em aberto (ex.: saldo) ou cobrar à parte. Para imagens, marque <b>calcular por quantidade</b> (ex.: 15 × R$ 35,00).</>,
    page: 'projetos',
  },
  {
    q: 'Quero lançar orçamentos antigos (do ano todo)',
    a: <>No orçamento, troque a <b>data da proposta</b> (em dados) para a data real. Ao aprovar, coloque em <b>fechou em</b> o dia em que a cliente aprovou e marque <b>o sinal já foi pago</b>, se for o caso. Assim a demanda e o financeiro de cada mês ficam certos. Pagamentos seguintes: na demanda, marque pago e ajuste a data ao lado.</>,
    page: 'orcamentos',
  },
  {
    q: 'Negociamos e fechou por outro valor',
    a: <>Na hora de aprovar, troque o valor em <b>Fechou por quanto?</b>. A lista de orçamentos mostra o valor fechado com o proposto riscado.</>,
    page: 'orcamentos',
  },
  {
    q: 'Pacote com vários projetos e ela cancelou um',
    a: <>Na demanda, seção <b>pacote → retirar</b> no projeto cancelado. O desconto se ajusta proporcionalmente e o saldo é recalculado. <b>copiar resumo</b> monta a mensagem explicando a conta.</>,
    page: 'projetos',
  },
  {
    q: 'Fechei um pacote que não veio de orçamento',
    a: <>Crie a demanda (<b>+ novo → Demanda</b>), abra e clique em <b>pagamentos → pacote</b>. Liste os projetos e o desconto.</>,
    page: 'projetos',
  },
  {
    q: 'Quero mudar o texto das mensagens',
    a: <><b>configurações → aba mensagens</b> (no computador). As palavras entre chaves, como {'{cliente}'} e {'{valor}'}, são preenchidas sozinhas.</>,
    page: 'config',
  },
  {
    q: 'Mudar preço da tabela, dados da proposta ou cores do PDF',
    a: <><b>configurações → aba preços</b> e <b>aba propostas</b> (modelo do PDF), só no computador. Seus dados (nome, logo, pix, contatos do rodapé) ficam no <b>perfil</b>, que abre pelo seu nome no pé do menu, também no celular.</>,
    page: 'config',
  },
  {
    q: 'Ver os compromissos no calendário do celular',
    a: <><b>agenda → Conectar ao celular</b> e siga os passos uma vez. Entregas e compromissos passam a aparecer no calendário do celular.</>,
    page: 'agenda',
  },
  {
    q: 'Lançar um gasto (software, equipamento, curso…)',
    a: <><b>+ novo → Despesa</b>. Aparece no financeiro e entra no lucro do mês.</>,
    page: 'financeiro',
  },
  {
    q: 'Quero ver o sistema preenchido de exemplo',
    a: <>No computador, o <b>olho</b> no rodapé do menu (ao lado da lua) mostra o exemplo sem mexer nos seus dados. Clique de novo para voltar.</>,
  },
  {
    q: 'O que quer dizer “no fechamento”, “na conclusão” e “a cobrar”?',
    a: <>Não existe vencimento por data. Cada parcela diz <b>quando</b> é paga: o sinal <b>no fechamento</b> e o saldo <b>na conclusão</b> (dá para trocar na tabela de pagamentos da demanda). Ela vira <b>a cobrar</b> quando já pode ser cobrada: sinal ainda não pago, ou saldo com a demanda em “aguardando aprovação” ou “entregue”. Aparece no início, no financeiro e no número do menu.</>,
    page: 'financeiro',
  },
  {
    q: 'O que fica só no computador?',
    a: <>Para o celular ficar enxuto, algumas coisas aparecem só no computador: os gráficos (início e financeiro), as abas <b>preços</b>, <b>propostas</b>, <b>mensagens</b> e <b>metas</b> das configurações, as cores e fontes da aba <b>aparência</b> e o <b>olho</b> do exemplo. No celular fica o dia a dia: para fazer, demandas, clientes, pagamentos e agenda, além do tema claro/escuro e do backup.</>,
  },
  {
    q: 'Não acho uma cliente, demanda ou orçamento',
    a: <>Use a <b>busca</b> no topo (ou Ctrl + K no computador). Procura por nome, empresa, título e número.</>,
  },
]

const WHERE: [string, string, string][] = [
  ['o que fazer hoje', 'início → para fazer', 'inicio'],
  ['definir ou mudar o prazo', 'demanda → card “prazo combinado” (clique na data)', 'projetos'],
  ['mudar a fase de uma demanda', 'pílula de fase (quadro, lista ou início)', 'projetos'],
  ['aprovar / recusar orçamento', 'orçamentos → pílula de status', 'orcamentos'],
  ['marcar pagamento', 'botão no cartão da demanda ou financeiro → Marcar pago', 'financeiro'],
  ['quanto tenho para receber', 'financeiro → recebimentos (filtro “A cobrar”)', 'financeiro'],
  ['recibo em PDF', 'demanda → pagamentos → ícone de impressora', 'projetos'],
  ['histórico de uma cliente', 'clientes → abrir a cliente', 'clientes'],
  ['criar coluna no quadro', 'demandas → quadro → nova coluna (no fim)', 'projetos'],
  ['mudar ordem do menu', 'organizar menu (abaixo do menu)', ''],
  ['manual e configurações', 'grupo “ajustes e dicas”, no fim do menu', ''],
  ['seus dados, logo, pix e senha', 'perfil (seu nome no pé do menu)', 'perfil'],
  ['menu completo no celular', 'ícone ☰ no canto superior esquerdo', ''],
  ['modo escuro', 'lua no pé do menu (vale só para o aparelho em que você ligar)', ''],
  ['sair da conta', 'ícone de sair no pé do menu, à direita (ou perfil → conta e segurança)', ''],
  ['backup dos dados', 'configurações → aba dados', 'config'],
  ['meta mensal e cores do sistema', 'configurações → abas metas e aparência (no computador)', 'config'],
]

const ROUTINE: [string, string[]][] = [
  ['todo dia', ['Abrir o início e resolver o “para fazer”', 'Mudar a fase das demandas que andaram', 'Marcar pagamentos que caíram']],
  ['toda semana', ['Olhar orçamentos em “cobrar resposta”', 'Conferir “próximos 7 dias” no início', 'Lançar despesas da semana']],
  ['todo mês', ['Ver o financeiro: recebido, a receber e lucro', 'Baixar um backup em configurações']],
]

const PHASES = ['em alinhamento', 'em execução', 'em ajustes', 'aguardando aprovação', 'entregue']

export default function Manual() {
  const [open, setOpen] = useState<string | null>('01')
  const goTo = (w?: { page?: string; id?: string }) => w?.page && go(w.page, w.id)

  return (
    <div className="page manual">
      <div className="page-head">
        <div>
          <p className="eyebrow">do pedido à entrega</p>
          <h1>
            manual <em>de uso</em>
          </h1>
        </div>
      </div>

      <section className="card manual-intro">
        <p>
          Cada cliente passa por <b>8 passos</b>. Siga na ordem e nada fica para trás. Clique num passo para ver o que fazer e use <b>ir</b> para abrir a tela certa.
        </p>
        <div className="manual-flow" aria-label="Fases da demanda">
          <span className="flow-q">orçamento</span>
          <Icon name="chevronR" size={14} />
          {PHASES.map((f, i) => (
            <span key={f} className="flow-step">
              {f}
              {i < PHASES.length - 1 && <Icon name="chevronR" size={14} />}
            </span>
          ))}
        </div>
      </section>

      <ol className="manual-steps">
        {STEPS.map((s) => {
          const isOpen = open === s.n
          return (
            <li key={s.n} className={`card manual-step ${isOpen ? 'is-open' : ''}`}>
              <button className="manual-step-head" onClick={() => setOpen(isOpen ? null : s.n)} aria-expanded={isOpen}>
                <span className="manual-n">{s.n}</span>
                <span className="grow">
                  <span className="manual-title">{s.title}</span>
                  <span className="manual-when">{s.when}</span>
                </span>
                <Icon name="chevronR" size={16} className={isOpen ? 'rot-down' : ''} />
              </button>
              {isOpen && (
                <div className="manual-body">
                  <div className="manual-where">
                    <span className="muted small">onde:</span>
                    {s.where.path.map((w, i) => (
                      <span key={w} className="manual-crumb">
                        {w}
                        {i < s.where.path.length - 1 && <Icon name="chevronR" size={12} />}
                      </span>
                    ))}
                    {s.where.page && (
                      <button className="btn small" onClick={() => goTo(s.where)}>
                        ir <Icon name="chevronR" size={13} />
                      </button>
                    )}
                  </div>
                  <ul className="manual-todo">
                    {s.todo.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  {s.tip && <p className="manual-tip">💡 {s.tip}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <section className="card">
        <h3>quando acontecer…</h3>
        <div className="manual-cases">
          {CASES.map((c) => (
            <details key={c.q} className="manual-case">
              <summary>{c.q}</summary>
              <p>{c.a}</p>
              {c.page && (
                <button className="btn small ghost" onClick={() => go(c.page!)}>
                  ir <Icon name="chevronR" size={13} />
                </button>
              )}
            </details>
          ))}
        </div>
      </section>

      <div className="grid-2 is-even">
        <section className="card">
          <h3>onde fica cada coisa</h3>
          <ul className="manual-where-list">
            {WHERE.map(([what, where, page]) => (
              <li key={what}>
                <span>{what}</span>
                {page ? (
                  <button className="link" onClick={() => go(page)}>
                    {where}
                  </button>
                ) : (
                  <span className="muted">{where}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h3>rotina que evita esquecimento</h3>
          <div className="manual-routine">
            {ROUTINE.map(([when, items]) => (
              <div key={when}>
                <span className="eyebrow">{when}</span>
                <ul>
                  {items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
