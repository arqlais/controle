import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { go } from '../router'
import { plansWith, type Feature } from '../plans'

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
