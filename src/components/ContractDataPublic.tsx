import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import { AddressFields, Block, CompanyFields, DataSummary, ExtraFields, PartnersFields, PersonFields, PropertyFields, SignFields } from './ContractDataForm'
import { emptyAddress, loadDataLink, missingFor, ruleOf, sendData, type DataPayload } from '../contractData'
import type { ContractData, ContractPerson, DataFieldKey, DataFormConfig, DataQuestion } from '../types'

/* Link que o cliente abre para mandar os dados do contrato: passo a passo, sem login, em qualquer aparelho.
   No visual do planê (bege, vidro leve, símbolos). Já vem com o que você tinha no cadastro;
   o rascunho fica guardado no aparelho do cliente até ele enviar. */

type Step = 'capa' | 'tipo' | 'empresa' | 'voce' | 'socios' | 'final' | 'revisao'
const META: Record<Exclude<Step, 'capa'>, { icon: string; title: string; short: string }> = {
  tipo: { icon: 'layers', title: 'o contrato vai em nome de', short: 'tipo' },
  empresa: { icon: 'building', title: 'dados da empresa', short: 'empresa' },
  voce: { icon: 'user', title: 'seus dados', short: 'você' },
  socios: { icon: 'users', title: 'sócios', short: 'sócios' },
  final: { icon: 'pen', title: 'assinatura', short: 'assinatura' },
  revisao: { icon: 'check', title: 'confira e envie', short: 'enviar' },
}

/** Símbolo do planê. */
export function PlaneMark({ size = 22, color = '#f3ece5' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <g transform="translate(-7 -5) scale(1.0093) translate(4 4)">
        <path d="M48.5 60.5C62 61 76 55 85 44C94 33 96 18 88 9C80 1 66 1 54 7C40 14 28 30 21 45C14 60 13 78 19 90C23 98 30 99 35 93C42 85 46 72 44 61C42 50 35 44 27 44C19 44 11 46 5 51" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function Shell({ p, children }: { p?: DataPayload; children: ReactNode }) {
  return (
    <div className="cdp" style={{ ['--bf-accent' as string]: p?.accent || '#4a5d6b' } as CSSProperties}>
      {p && (
        <header className="cdp-top">
          {p.logo ? <img src={p.logo} alt="" className="cdp-logo" /> : <span className="cdp-logo is-letter">{(p.studio || '·').slice(0, 1).toLowerCase()}</span>}
          <span>
            <b>{p.studio}</b>
            <small>dados para o contrato</small>
          </span>
        </header>
      )}
      <main className="cdp-card">{children}</main>
      <a className="cdp-made" href="https://useplane.com.br" target="_blank" rel="noreferrer">
        <span className="cdp-made-mark">
          <PlaneMark size={14} />
        </span>
        feito com <b>planê</b> · gestão para quem projeta
      </a>
    </div>
  )
}

export function ContractDataPublic({ id }: { id: string }) {
  const [link, setLink] = useState<{ payload: DataPayload; answered: boolean; cloud: boolean } | null | undefined>(undefined)
  useEffect(() => {
    loadDataLink(id).then(setLink, () => setLink(null))
  }, [id])
  if (link === undefined)
    return (
      <Shell>
        <div className="cdp-loading">
          <span />
        </div>
      </Shell>
    )
  if (link === null)
    return (
      <Shell>
        <div className="cd-done">
          <span className="cd-done-ico is-soft">
            <Icon name="lock" size={24} />
          </span>
          <h1>link fora do ar</h1>
          <p className="muted">Se você já mandou os seus dados, está tudo certo. Para mudar algo, fale com quem te enviou o link.</p>
        </div>
      </Shell>
    )
  if (link.answered)
    return (
      <Shell p={link.payload}>
        <Done p={link.payload} />
      </Shell>
    )
  return (
    <Shell p={link.payload}>
      <DataWizard id={id} payload={link.payload} cloud={link.cloud} />
    </Shell>
  )
}

function Done({ p }: { p: DataPayload }) {
  const who = p.owner ? p.owner.split(' ')[0] : p.studio
  return (
    <div className="cd-done">
      <span className="cd-done-ico">
        <Icon name="check" size={28} />
      </span>
      <h1>
        tudo <em>certo!</em>
      </h1>
      <p className="muted">{who} já recebeu os seus dados e vai preparar o contrato.</p>
      <a className="cdp-promo" href="https://useplane.com.br" target="_blank" rel="noreferrer">
        <span className="cdp-promo-mark">
          <PlaneMark size={22} />
        </span>
        <span>
          <b>esse formulário foi feito no planê</b>
          <small>propostas, contratos, prazos e financeiro para quem vive de projeto</small>
        </span>
        <Icon name="arrowRight" size={16} />
      </a>
    </div>
  )
}

/** O passo a passo. Com `preview`, é só para ver: nada é guardado nem enviado. */
export function DataWizard({ id, payload: p, cloud, preview }: { id: string; payload: DataPayload; cloud: boolean; preview?: boolean }) {
  const cfg: DataFormConfig | undefined = p.form
  const aud = p.audience ?? 'b2b'
  const r = ruleOf(cfg, aud)
  const draftKey = `dados-rascunho:${id}`
  const [d, setD] = useState<ContractData>(() => {
    if (!preview)
      try {
        const saved = localStorage.getItem(draftKey)
        if (saved) return JSON.parse(saved) as ContractData
      } catch {
        /* sem rascunho */
      }
    return { ...p.prefill, person: { ...p.prefill.person, address: p.prefill.person.address ?? emptyAddress() } }
  })
  const [step, setStep] = useState<Step>('capa')
  const [miss, setMiss] = useState<string[]>([])
  const [sugs, setSugs] = useState<{ name: string; role: string }[]>([])
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'erro'>('idle')
  const [returnTo, setReturnTo] = useState<Step | null>(null)
  const set = (patch: Partial<ContractData>) =>
    setD((cur) => {
      const next = { ...cur, ...patch }
      if (!preview)
        try {
          localStorage.setItem(draftKey, JSON.stringify(next))
        } catch {
          /* sem espaço */
        }
      return next
    })
  const setPerson = (patch: Partial<ContractPerson>) => set({ person: { ...d.person, ...patch } })
  const company = d.signAs === 'empresa'
  const extra = (s: DataQuestion['step']) => (cfg?.extra ?? []).filter((q) => (q.step === 'empresa' && !company ? 'voce' : q.step) === s)
  const steps: Exclude<Step, 'capa'>[] = ['tipo', ...(company ? (['empresa'] as const) : []), 'voce', ...((company || aud === 'final') && r('partners') !== 'oculto' ? (['socios'] as const) : []), 'final', 'revisao']
  const idx = steps.indexOf(step as Exclude<Step, 'capa'>)
  const first = (p.clientName || d.person.name || '').split(' ')[0]
  const who = p.owner ? p.owner.split(' ')[0] : p.studio
  const addrKey: DataFieldKey = company ? 'repAddress' : 'personAddress'

  const go = (s: Step) => {
    setMiss([])
    setStep(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const next = () => {
    const part = step === 'empresa' || step === 'voce' || step === 'socios' || step === 'final' ? step : undefined
    const m = part ? missingFor(d, cfg, part, aud) : []
    setMiss(m)
    if (m.length) return
    if (returnTo) {
      setReturnTo(null)
      return go(returnTo)
    }
    go(steps[Math.min(steps.length - 1, idx + 1)])
  }
  const back = () => go(idx <= 0 ? 'capa' : steps[idx - 1])
  const send = async () => {
    const m = missingFor(d, cfg, undefined, aud)
    if (m.length) return setMiss(m)
    if (preview) return setState('ok')
    setState('busy')
    const ok = await sendData(id, { ...d, contractName: d.contractName.trim(), updatedAt: new Date().toISOString(), by: 'cliente' }, cloud)
    setState(ok ? 'ok' : 'erro')
    if (ok)
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* ok */
      }
  }

  if (state === 'ok') return <Done p={p} />

  if (step === 'capa')
    return (
      <div className="cd-cover cd-anim">
        <p className="cd-eyebrow">
          <Icon name="clock" size={13} /> leva uns 3 minutos
        </p>
        <h1>
          oi{first ? ',' : ''} <em>{first || 'tudo bem?'}</em>
        </h1>
        <p className="cd-lead">{cfg?.intro?.trim() || `Para preparar o seu contrato, ${who} precisa de alguns dados. O que já tínhamos aparece preenchido: é só completar.`}</p>
        <div className="cd-tiles">
          <span>
            <i>
              <Icon name="building" size={18} />
            </i>
            CNPJ, se for empresa
          </span>
          <span>
            <i>
              <Icon name="user" size={18} />
            </i>
            RG e CPF
          </span>
          <span>
            <i>
              <Icon name="home" size={18} />
            </i>
            endereço com CEP
          </span>
        </div>
        <button className="cd-go" onClick={() => go('tipo')}>
          começar <Icon name="arrowRight" size={16} />
        </button>
        <p className="cd-safe">
          <Icon name="lock" size={13} /> seus dados vão só para {who}
        </p>
      </div>
    )

  const meta = META[step]
  return (
    <div className="cd-step">
      <ol className="cd-rail" aria-label="Passos">
        {steps.map((s, i) => (
          <li key={s} className={i < idx ? 'is-done' : i === idx ? 'is-on' : ''} title={META[s].short}>
            <span>{i < idx ? <Icon name="check" size={14} /> : <Icon name={META[s].icon} size={15} />}</span>
            <small>{s === 'socios' && !company ? 'mais alguém' : META[s].short}</small>
          </li>
        ))}
      </ol>
      <div key={step} className="cd-anim">
        <h1 className="cd-title">{step === 'voce' && company ? 'seus dados (responsável)' : step === 'socios' && !company ? 'quem mais assina' : step === 'final' && aud === 'final' ? 'imóvel e assinatura' : meta.title}</h1>
        {step === 'tipo' && (
          <div className="cd-types">
            <button type="button" className={`cd-type ${company ? 'is-on' : ''}`} onClick={() => set({ signAs: 'empresa' })}>
              <span className="cd-ico is-big">
                <Icon name="building" size={22} />
              </span>
              <b>empresa ou escritório</b>
              <small>com CNPJ</small>
              {company && <span className="cd-type-check"><Icon name="check" size={13} /></span>}
            </button>
            <button type="button" className={`cd-type ${!company ? 'is-on' : ''}`} onClick={() => set({ signAs: 'pessoa' })}>
              <span className="cd-ico is-big">
                <Icon name="user" size={22} />
              </span>
              <b>pessoa física</b>
              <small>com CPF</small>
              {!company && <span className="cd-type-check"><Icon name="check" size={13} /></span>}
            </button>
          </div>
        )}
        {step === 'empresa' && (
          <>
            <CompanyFields d={d} set={set} r={r} onPartners={setSugs} />
            {r('companyAddress') !== 'oculto' && (
              <Block icon="home" title="endereço da empresa">
                <AddressFields a={d.company.address} set={(patch) => set({ company: { ...d.company, address: { ...d.company.address, ...patch } } })} required={r('companyAddress') === 'obrigatorio'} />
              </Block>
            )}
            <ExtraFields qs={extra('empresa')} d={d} set={set} />
          </>
        )}
        {step === 'voce' && (
          <>
            <PersonFields p={d.person} set={setPerson} company={company} r={r} />
            {r(addrKey) !== 'oculto' && (
              <Block icon="home" title={company ? 'seu endereço' : 'endereço'} note={r(addrKey) === 'opcional' ? 'opcional' : undefined}>
                <AddressFields a={d.person.address ?? emptyAddress()} set={(patch) => setPerson({ address: { ...(d.person.address ?? emptyAddress()), ...patch } })} required={r(addrKey) === 'obrigatorio'} />
              </Block>
            )}
            <ExtraFields qs={extra('voce')} d={d} set={set} />
          </>
        )}
        {step === 'socios' && (
          <>
            <p className="cd-lead is-small">{company ? 'Se a empresa tem outros sócios, coloque aqui. Se não tem, é só seguir.' : 'Se mais alguém vai assinar com você (cônjuge, sócio…), coloque aqui. Se não, é só seguir.'}</p>
            <PartnersFields d={d} set={set} r={r} suggestions={sugs} />
          </>
        )}
        {step === 'final' && (
          <>
            <PropertyFields d={d} set={set} r={r} />
            <SignFields d={d} set={set} r={r} />
            <ExtraFields qs={extra('final')} d={d} set={set} />
            {r('notes') !== 'oculto' && (
              <label className="field">
                <span className="field-label">{`algo mais que devemos saber?${r('notes') === 'obrigatorio' ? ' *' : ''}`}</span>
                <textarea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={r('notes') === 'obrigatorio' ? '' : 'opcional'} />
              </label>
            )}
          </>
        )}
        {step === 'revisao' && (
          <DataSummary
            d={d}
            onEdit={(part) => {
              setReturnTo('revisao')
              go(part)
            }}
          />
        )}
        {step !== 'tipo' && step !== 'revisao' && <p className="cd-legend">* obrigatório</p>}
      </div>

      {miss.length > 0 && (
        <p className="cd-miss" role="alert">
          <Icon name="alert" size={15} /> falta: {miss.join(', ')}
        </p>
      )}
      {state === 'erro' && <p className="cd-miss">Não foi possível enviar agora. Confira a internet e tente de novo.</p>}
      <div className="cd-nav">
        <button type="button" className="cd-back" onClick={back} aria-label="Voltar" title="Voltar">
          <Icon name="chevronL" size={18} />
        </button>
        {step === 'revisao' ? (
          <button type="button" className="cd-go" disabled={state === 'busy'} onClick={() => void send()}>
            {state === 'busy' ? 'enviando…' : preview ? 'enviar (prévia)' : 'enviar dados'} <Icon name="check" size={16} />
          </button>
        ) : (
          <button type="button" className="cd-go" onClick={next}>
            {returnTo ? 'salvar e voltar' : 'continuar'} <Icon name="arrowRight" size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
