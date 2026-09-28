import { useState } from 'react'
import { Icon } from './Icon'
import { go, useRoute } from '../router'
import { PLATFORM } from '../plans'

/* Passo a passo do primeiro acesso (pode pular ou deixar para depois) e a
   explicação curta de cada tela no botão "?" do topo. Textos simples, sem
   termos técnicos. */

type Step = { page: string; title: string; text: string; needs?: 'contratos' }

export const TOUR_STEPS: Step[] = [
  { page: 'inicio', title: 'boas-vindas!', text: `Em poucos passos você conhece o ${PLATFORM.name}. Aqui no início aparece o que vence hoje, o que está atrasado e quanto entrou no mês. Quer ver tudo preenchido com um exemplo? Toque em “exemplo” (o olhinho) no fim do menu.` },
  { page: 'config', title: 'comece pelas configurações', text: 'Coloque seus dados, logotipo e cores. Em “preços” fica sua tabela: por hora, por m², por unidade ou valor livre.' },
  { page: 'clientes', title: 'seus clientes', text: 'Cadastre quem contrata você. Nome, CPF/CNPJ e endereço vão sozinhos para orçamentos, recibos e contratos.' },
  { page: 'orcamentos', title: 'orçamentos', text: 'Escolha os serviços e o valor é sugerido pela sua tabela (você sempre pode mudar). No fim, gere o PDF ou copie o texto para o WhatsApp.' },
  { page: 'projetos', title: 'demandas', text: 'O quadro mostra cada trabalho: rascunhos, enviados, em execução, em revisão e entregues. Arraste ou toque para mudar a fase.' },
  { page: 'financeiro', title: 'financeiro', text: 'Parcelas a receber, recebidas e despesas. Ao marcar uma parcela como paga, escolha como o cliente pagou (pix, cartão…).' },
  { page: 'contratos', title: 'contratos', needs: 'contratos', text: 'Escolha o cliente e o orçamento: o contrato já sai preenchido. Se faltar algum dado, aparece um aviso antes.' },
  { page: 'agenda', title: 'agenda', text: 'Entregas, pagamentos e compromissos num calendário só. Dá para ver também na agenda do celular.' },
  { page: 'manual', title: 'pronto!', text: `O manual explica tudo com calma. Ficou com dúvida? Fale com ${PLATFORM.supportWith} pelo balão no canto da tela. Este passo a passo fica em “ajustes e dicas” para rever quando quiser.` },
]

/** Explicação curta de cada tela (botão "?" do topo). */
export const SCREEN_HELP: Record<string, { title: string; text: string }> = {
  inicio: { title: 'início', text: 'Resumo do seu dia: entregas próximas, parcelas para cobrar e o quanto você já recebeu no mês. Toque em qualquer item para abrir.' },
  projetos: { title: 'demandas', text: 'Cada cartão é um trabalho. As colunas são as fases; os rascunhos e os orçamentos enviados aparecem nas primeiras colunas até serem aprovados.' },
  clientes: { title: 'clientes', text: 'Todos os seus clientes. Abra um para ver os trabalhos, os pagamentos e as anotações dele.' },
  financeiro: { title: 'financeiro', text: 'O que você tem a receber e o que já recebeu, mês a mês, e as suas despesas. Marque as parcelas como pagas quando o dinheiro cair.' },
  agenda: { title: 'agenda', text: 'Seus prazos e compromissos. Toque num dia para ver ou adicionar algo.' },
  orcamentos: { title: 'orçamentos', text: 'Suas propostas. Crie uma nova em “novo orçamento”; quando o cliente aprovar, ela vira uma demanda.' },
  contratos: { title: 'contratos', text: 'Escolha o cliente e o orçamento e o contrato sai preenchido. Os modelos podem ser editados em “modelos”. Revise sempre antes de enviar.' },
  instagram: { title: 'instagram', text: 'Organize as ideias e as datas dos seus posts.' },
  config: { title: 'configurações', text: 'Seus dados, visual (cores, fontes, logotipo), tabela de preços, formas de receber e mensagens prontas.' },
  manual: { title: 'manual', text: 'Explicações de cada parte do sistema, com calma.' },
  assinatura: { title: 'minha assinatura', text: 'Seu plano, o teste grátis e os pagamentos. Cancelar é quando quiser, sem multa.' },
  sugestoes: { title: 'sugestões', text: `Sentiu falta de algo? Mande sua ideia; ${PLATFORM.supportWith} lê todas e responde por aqui.` },
  avaliar: { title: 'depoimento', text: 'Conte o que achou. Se autorizar, seu depoimento pode aparecer na página do sistema, só com nome e profissão.' },
  perfil: { title: 'perfil', text: 'Os dados do seu estúdio que aparecem nos PDFs e contratos.' },
}

export function Tour({ has, onClose }: { has: (f: 'contratos') => boolean; onClose: (how: 'feito' | 'depois') => void }) {
  const steps = TOUR_STEPS.filter((s) => !s.needs || has(s.needs))
  const [i, setI] = useState(0)
  const step = steps[i]
  const to = (n: number) => {
    setI(n)
    go(steps[n].page)
  }
  const last = i === steps.length - 1
  return (
    <div className="tour" role="dialog" aria-label="Passo a passo">
      <div className="tour-top">
        <span className="tour-count">
          {i + 1} de {steps.length}
        </span>
        <button className="icon-btn subtle" onClick={() => onClose('depois')} aria-label="Fechar e ver depois" title="Fechar e ver depois">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="tour-dots" aria-hidden>
        {steps.map((s, n) => (
          <i key={s.page} className={n <= i ? 'on' : ''} />
        ))}
      </div>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
      <div className="tour-actions">
        {i === 0 ? (
          <>
            <button className="link" id="tour-skip" onClick={() => onClose('feito')}>
              pular
            </button>
            <button className="link" id="tour-later" onClick={() => onClose('depois')}>
              ver depois
            </button>
          </>
        ) : (
          <button className="btn ghost small" onClick={() => to(i - 1)}>
            voltar
          </button>
        )}
        <button className="btn primary small" id="tour-next" onClick={() => (last ? onClose('feito') : to(i + 1))}>
          {last ? 'concluir' : i === 0 ? 'começar' : 'próximo'}
          {!last && <Icon name="chevronR" size={14} />}
        </button>
      </div>
    </div>
  )
}

/** Botão "?" do topo: explica a tela atual em duas linhas (só quando a pessoa quer). */
export function ScreenHelp() {
  const route = useRoute()
  const [open, setOpen] = useState(false)
  const help = SCREEN_HELP[route.page]
  if (!help) return null
  return (
    <div className="screen-help">
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Entender esta tela" title="Entender esta tela">
        <Icon name="help" />
      </button>
      {open && (
        <>
          <div className="click-away" onClick={() => setOpen(false)} />
          <div className="dropdown screen-help-pop">
            <b>{help.title}</b>
            <p>{help.text}</p>
          </div>
        </>
      )}
    </div>
  )
}
