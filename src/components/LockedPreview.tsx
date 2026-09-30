import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { go } from '../router'
import { PLAN_LIST, plansWith, type Feature } from '../plans'
import { useAccess } from '../access'

/* Vitrine do que o plano não tem: a pessoa abre e vê a tela de verdade (para dar vontade),
   mas nada funciona até assinar o plano que libera. */

const PITCH: Partial<Record<Feature, string>> = {
  briefing: 'O cliente responde pelo link, no celular, com fotos, e as respostas já preenchem a ficha dele.',
  documentos: 'Guia de medição, placa de obra com QR code e apresentação de projeto com a sua marca, prontos em minutos.',
  contratos: 'O contrato sai preenchido com os dados do orçamento e o cliente assina pelo celular.',
  instagram: 'Planeje os posts da semana com ideias prontas para quem é de projeto.',
  cronograma: 'Etapas do projeto com prazo e a parcela que é cobrada quando cada uma termina.',
  obra: 'Visitas de obra com fotos, o que foi visto e os próximos passos, com relatório em PDF.',
  lucro: 'Horas e custos de cada projeto para saber quanto sobrou de verdade.',
  identidade: 'Logo, cores e fontes do seu estúdio em tudo o que você manda para o cliente.',
  propostaPdf: 'Proposta e recibos em PDF, com modelos prontos e a sua identidade.',
  agendaCelular: 'Prazos, pagamentos e compromissos aparecem sozinhos no calendário do celular.',
  portal: 'Um painel só do cliente, pelo link: etapas, pagamentos, contratos e documentos, sempre atualizado.',
}

export const lockPlan = (f: Feature) => plansWith(f)[0]?.name ?? 'Estúdio'

export function LockBanner({ feature }: { feature: Feature }) {
  return (
    <div className="lk-banner" role="note">
      <span className="lk-icon">
        <Icon name="lock" size={16} />
      </span>
      <span className="lk-text">
        <b>Prévia do plano {lockPlan(feature)}.</b> {PITCH[feature] ?? 'Dá para olhar à vontade; para usar, é só mudar de plano.'}
      </span>
      <button className="btn small primary" onClick={() => go('assinatura')}>
        <Icon name="star" size={14} /> quero usar
      </button>
    </div>
  )
}

/** A tela real, só para olhar: dá para rolar, mas não dá para clicar nem editar. */
export function LockedView({ feature, children }: { feature: Feature; children: ReactNode }) {
  return (
    <div className="lk-wrap">
      <LockBanner feature={feature} />
      <div className="lk-view" inert aria-hidden>
        {children}
      </div>
    </div>
  )
}

/** Botão de uma função que o plano não tem: aparece com cadeado e leva para os planos. */
export function LockButton({ feature, label, icon = 'lock', className = 'btn small ghost', iconOnly }: { feature: Feature; label: string; icon?: string; className?: string; iconOnly?: boolean }) {
  return (
    <button type="button" className={`${className} lk-btn`} onClick={() => go('assinatura')} title={`${label}: plano ${lockPlan(feature)}. Toque para ver os planos.`} aria-label={`${label} (plano ${lockPlan(feature)})`}>
      <Icon name="lock" size={14} />
      {!iconOnly && <>{icon !== 'lock' && <Icon name={icon} size={14} />} {label}</>}
    </button>
  )
}

/** No teste grátis tudo fica aberto: avisa de que plano é a função, para não ter surpresa depois. */
export function TrialFeatureNote({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { sub, isOwner } = useAccess()
  const show = !isOwner && sub?.status === 'trial' && plansWith(feature).length < PLAN_LIST.length
  return (
    <>
      {show && (
        <p className="lk-trial" role="note">
          <Icon name="lock" size={13} />
          <span>
            Função do plano <b>{lockPlan(feature)}</b>
            {plansWith(feature).length > 1 ? ' (ou acima)' : ''}: liberada no teste grátis. Depois do teste, nos outros planos, ela fica só para ver.
          </span>
        </p>
      )}
      {children}
    </>
  )
}
