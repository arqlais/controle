import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react'
import { SandboxStore } from '../store'
import { toast } from './dialog'
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

// o que tiraria o modelo daqui (baixar, copiar, mandar, imprimir…): na prévia, só com o plano
const TAKE_AWAY = /\b(baixar|download|pdf|png|imprimir|print|copiar|enviar|mandar|whatsapp|compartilhar|link|exportar|importar|anexar|assinar|publicar|qr|salvar como)/i

/** A tela real, para explorar: dá para abrir, clicar e testar, mas nada é salvo, baixado, copiado ou enviado. */
export function LockedView({ feature, children }: { feature: Feature; children: ReactNode }) {
  const warned = useRef(false)
  useEffect(() => {
    document.body.classList.add('lk-on')
    return () => document.body.classList.remove('lk-on')
  }, [])
  const blocked = (what: string) => toast(`Na prévia dá para ver e testar, mas não para ${what}. Isso fica liberado no plano ${lockPlan(feature)}.`)
  const onClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest('button, a, [role="button"], label') as HTMLElement | null
    if (!el || el.closest('.lk-banner')) return
    const href = el.getAttribute('href') ?? ''
    if (href.includes('assinatura')) return
    const label = `${el.textContent ?? ''} ${el.getAttribute('title') ?? ''} ${el.getAttribute('aria-label') ?? ''}`
    const leaves = el.tagName === 'A' && (el.hasAttribute('download') || (el as HTMLAnchorElement).target === '_blank' || /^(https?:|blob:|data:|mailto:)/.test(href))
    if (leaves || TAKE_AWAY.test(label)) {
      e.preventDefault()
      e.stopPropagation()
      blocked('baixar, copiar ou mandar')
    }
  }
  const stop = (what: string) => (e: SyntheticEvent) => {
    e.preventDefault()
    blocked(what)
  }
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && /^[cxps]$/i.test(e.key)) {
      e.preventDefault()
      blocked(e.key.toLowerCase() === 'p' ? 'imprimir' : e.key.toLowerCase() === 's' ? 'salvar' : 'copiar')
    }
  }
  const onWrite = () => {
    if (warned.current) return
    warned.current = true
    toast('Prévia: pode testar à vontade, mas nada fica salvo.')
  }
  return (
    <div className="lk-wrap">
      <LockBanner feature={feature} />
      <SandboxStore onWrite={onWrite}>
        <div className="lk-view" onClickCapture={onClick} onCopyCapture={stop('copiar')} onCutCapture={stop('copiar')} onContextMenuCapture={(e) => e.preventDefault()} onDragStartCapture={(e) => e.preventDefault()} onKeyDownCapture={onKey}>
          {children}
        </div>
      </SandboxStore>
    </div>
  )
}

/** Botão de uma função que o plano não tem: aparece com cadeado e leva para os planos. */
export function LockButton({ feature, label, icon = 'lock', className = 'btn small ghost', iconOnly, to = 'assinatura' }: { feature: Feature; label: string; icon?: string; className?: string; iconOnly?: boolean; to?: string }) {
  return (
    <button type="button" className={`${className} lk-btn`} onClick={() => go(to)} title={`${label}: plano ${lockPlan(feature)}. Toque para ver os planos.`} aria-label={`${label} (plano ${lockPlan(feature)})`}>
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
