import { useState, type ReactNode } from 'react'
import { Field } from './ui'
import { Icon } from './Icon'
import { CIVIL_STATES, COMPANY_KINDS, UFS, cnpjDetails, contractantName, emptyAddress, emptyPerson, ruleOf, signersOf, validCnpj, validCpf, type Rule } from '../contractData'
import type { ContractData, ContractPerson, DataFieldKey, DataFormConfig, DataQuestion, FullAddress } from '../types'
import { formatCep, formatDoc, formatPhone, lookupCep } from '../utils'

/* Os campos dos dados do contrato: usados no link que o cliente preenche (passo a passo)
   e na sua tela (tudo aberto, para corrigir). O que aparece e o que é obrigatório vem do
   formulário que você ajusta. */

type Set<T> = (patch: Partial<T>) => void

const Warn = ({ show, children }: { show: boolean; children: ReactNode }) => (show ? <small className="cd-warn">{children}</small> : null)

/** Campo que segue a regra: some se "não pedir", ganha * se obrigatório. */
function F({ k, r, label, span, hint, children }: { k: DataFieldKey; r: Rule; label: string; span?: 1 | 2 | 3; hint?: string; children: ReactNode }) {
  const rule = r(k)
  if (rule === 'oculto') return null
  return (
    <Field label={rule === 'obrigatorio' ? `${label} *` : label} span={span} hint={hint}>
      {children}
    </Field>
  )
}

/** Título de bloco com símbolo. */
export function Block({ icon, title, children, note }: { icon: string; title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="cd-blk">
      <header className="cd-blk-head">
        <span className="cd-ico">
          <Icon name={icon} size={16} />
        </span>
        <b>{title}</b>
        {note && <small>{note}</small>}
      </header>
      {children}
    </section>
  )
}

export function AddressFields({ a, set, required }: { a: FullAddress; set: Set<FullAddress>; required?: boolean }) {
  const [busy, setBusy] = useState(false)
  const star = required ? ' *' : ''
  const cep = async (v: string) => {
    const f = formatCep(v)
    set({ cep: f })
    if (f.replace(/\D/g, '').length !== 8) return
    setBusy(true)
    const r = await lookupCep(f)
    setBusy(false)
    if (r) set({ cep: f, street: r.street || a.street, district: r.district || a.district, city: r.city || a.city, uf: r.uf || a.uf })
  }
  return (
    <div className="form-grid cd-addr">
      <Field label={`CEP${star}`} hint={busy ? 'buscando…' : 'completa a rua sozinho'}>
        <input value={a.cep} onChange={(e) => void cep(e.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" />
      </Field>
      <Field label={`Rua / avenida${star}`} span={2}>
        <input value={a.street} onChange={(e) => set({ street: e.target.value })} autoComplete="address-line1" />
      </Field>
      <Field label={`Número${star}`}>
        <input value={a.number} onChange={(e) => set({ number: e.target.value })} />
      </Field>
      <Field label="Complemento">
        <input value={a.complement} onChange={(e) => set({ complement: e.target.value })} placeholder="sala, apto…" />
      </Field>
      <Field label="Bairro">
        <input value={a.district} onChange={(e) => set({ district: e.target.value })} />
      </Field>
      <Field label={`Cidade${star}`} span={2}>
        <input value={a.city} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" />
      </Field>
      <Field label={`UF${star}`}>
        <select value={a.uf} onChange={(e) => set({ uf: e.target.value })}>
          <option value="">—</option>
          {UFS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </Field>
    </div>
  )
}

export function PersonFields({ p, set, company, r }: { p: ContractPerson; set: Set<ContractPerson>; company?: boolean; r: Rule }) {
  const badCpf = p.cpf.replace(/\D/g, '').length === 11 && !validCpf(p.cpf)
  return (
    <div className="form-grid">
      <F k="name" r={r} label="Nome completo" span={2}>
        <input value={p.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
      </F>
      <F k="cpf" r={r} label="CPF">
        <input value={p.cpf} onChange={(e) => set({ cpf: formatDoc(e.target.value.replace(/\D/g, '').slice(0, 11)) })} inputMode="numeric" placeholder="000.000.000-00" />
        <Warn show={badCpf}>confira o CPF</Warn>
      </F>
      <F k="rg" r={r} label="RG">
        <input value={p.rg} onChange={(e) => set({ rg: e.target.value })} />
      </F>
      <F k="rgIssuer" r={r} label="Órgão emissor">
        <input value={p.rgIssuer} onChange={(e) => set({ rgIssuer: e.target.value.toUpperCase() })} placeholder="SSP/SP" />
      </F>
      <F k="nationality" r={r} label="Nacionalidade">
        <input value={p.nationality} onChange={(e) => set({ nationality: e.target.value })} list="cd-nat" placeholder="brasileira, brasileiro…" />
        <datalist id="cd-nat">
          <option value="brasileira" />
          <option value="brasileiro" />
        </datalist>
      </F>
      <F k="civilState" r={r} label="Estado civil">
        <select value={p.civilState} onChange={(e) => set({ civilState: e.target.value })}>
          <option value="">—</option>
          {CIVIL_STATES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </F>
      <F k="profession" r={r} label="Profissão">
        <input value={p.profession} onChange={(e) => set({ profession: e.target.value })} placeholder="arquiteta, engenheiro…" />
      </F>
      {company && (
        <F k="role" r={r} label="Cargo na empresa">
          <input value={p.role} onChange={(e) => set({ role: e.target.value })} placeholder="sócia administradora…" list="cd-roles" />
          <datalist id="cd-roles">
            <option value="sócia administradora" />
            <option value="sócio administrador" />
            <option value="sócia" />
            <option value="sócio" />
            <option value="representante legal" />
          </datalist>
        </F>
      )}
      <F k="email" r={r} label="E-mail">
        <input type="email" value={p.email} onChange={(e) => set({ email: e.target.value.trim() })} autoComplete="email" inputMode="email" />
      </F>
      <F k="phone" r={r} label="WhatsApp">
        <input value={p.phone} onChange={(e) => set({ phone: formatPhone(e.target.value) })} inputMode="tel" autoComplete="tel" />
      </F>
    </div>
  )
}

export function CompanyFields({ d, set, r, onPartners }: { d: ContractData; set: Set<ContractData>; r: Rule; onPartners?: (list: { name: string; role: string }[]) => void }) {
  const c = d.company
  const setC = (patch: Partial<ContractData['company']>) => set({ company: { ...c, ...patch } })
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<'' | 'ok' | 'nao'>('')
  const bad = c.cnpj.replace(/\D/g, '').length === 14 && !validCnpj(c.cnpj)
  const search = async (v: string) => {
    setBusy(true)
    const res = await cnpjDetails(v)
    setBusy(false)
    setFound(res ? 'ok' : 'nao')
    if (!res) return
    set({
      company: {
        ...c,
        cnpj: formatDoc(v),
        legalName: res.legalName || c.legalName,
        tradeName: res.tradeName || c.tradeName,
        kind: res.kind || c.kind,
        email: c.email || res.email,
        phone: c.phone || (res.phone ? formatPhone(res.phone) : ''),
        address: res.address.street ? res.address : c.address,
      },
    })
    if (res.partners.length) onPartners?.(res.partners)
  }
  const onCnpj = (v: string) => {
    const f = formatDoc(v.replace(/\D/g, '').slice(0, 14))
    setC({ cnpj: f })
    setFound('')
    if (f.replace(/\D/g, '').length === 14 && validCnpj(f)) void search(f)
  }
  return (
    <>
      {found === 'ok' && (
        <p className="cd-found">
          <Icon name="sparkle" size={14} /> achamos a empresa: confira os dados
        </p>
      )}
      <div className="form-grid">
        <F k="cnpj" r={r} label="CNPJ" hint={busy ? 'buscando a empresa…' : 'completa o resto sozinho'}>
          <input value={c.cnpj} onChange={(e) => onCnpj(e.target.value)} inputMode="numeric" placeholder="00.000.000/0000-00" />
          <Warn show={bad}>confira o CNPJ</Warn>
        </F>
        <F k="legalName" r={r} label="Razão social" span={2}>
          <input value={c.legalName} onChange={(e) => setC({ legalName: e.target.value })} />
        </F>
        <F k="tradeName" r={r} label="Nome fantasia" span={2}>
          <input value={c.tradeName} onChange={(e) => setC({ tradeName: e.target.value })} />
        </F>
        <F k="kind" r={r} label="Tipo">
          <select value={c.kind} onChange={(e) => setC({ kind: e.target.value })}>
            <option value="">—</option>
            {COMPANY_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </F>
        <F k="companyEmail" r={r} label="E-mail da empresa">
          <input type="email" value={c.email} onChange={(e) => setC({ email: e.target.value.trim() })} inputMode="email" />
        </F>
        <F k="companyPhone" r={r} label="Telefone da empresa">
          <input value={c.phone} onChange={(e) => setC({ phone: formatPhone(e.target.value) })} inputMode="tel" />
        </F>
        <F k="stateReg" r={r} label="Inscrição estadual / municipal">
          <input value={c.stateReg} onChange={(e) => setC({ stateReg: e.target.value })} />
        </F>
      </div>
    </>
  )
}

export function PartnersFields({ d, set, r, suggestions }: { d: ContractData; set: Set<ContractData>; r: Rule; suggestions?: { name: string; role: string }[] }) {
  // sócio: nome e CPF sempre; o resto segue o formulário, como opcional
  const pr: Rule = (k) => (k === 'name' || k === 'cpf' ? 'obrigatorio' : r(k) === 'oculto' || k === 'email' || k === 'phone' ? 'oculto' : 'opcional')
  const setP = (id: string, patch: Partial<ContractPerson>) => set({ partners: d.partners.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const add = (name = '', role = '') => set({ partners: [...d.partners, { ...emptyPerson(), name, role, address: emptyAddress() }] })
  const remove = (id: string) => set({ partners: d.partners.filter((x) => x.id !== id), signers: d.signers.filter((s) => s !== id) })
  const norm = (t: string) => t.trim().toLowerCase()
  const left = (suggestions ?? []).filter((s) => norm(s.name) !== norm(d.person.name) && !d.partners.some((x) => norm(x.name) === norm(s.name)))
  return (
    <div className="cd-partners">
      {d.partners.map((p, i) => (
        <div key={p.id} className="cd-partner">
          <div className="cd-partner-head">
            <span className="cd-ico is-soft">
              <Icon name="user" size={15} />
            </span>
            <b>sócio {i + 1}</b>
            <button type="button" className="icon-btn" onClick={() => remove(p.id)} aria-label="Tirar este sócio" title="Tirar este sócio">
              <Icon name="trash" size={16} />
            </button>
          </div>
          <PersonFields p={p} set={(patch) => setP(p.id, patch)} company r={pr} />
        </div>
      ))}
      {left.length > 0 && (
        <div className="cd-suggest">
          <small>no CNPJ aparecem:</small>
          {left.map((s) => (
            <button key={s.name} type="button" onClick={() => add(s.name, s.role)}>
              <Icon name="plus" size={13} /> {s.name}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="cd-add" onClick={() => add()}>
        <span className="cd-ico">
          <Icon name="plus" size={16} />
        </span>
        adicionar sócio
      </button>
    </div>
  )
}

/** Quem assina e o nome que vai no contrato. */
export function SignFields({ d, set, r }: { d: ContractData; set: Set<ContractData>; r: Rule }) {
  const people = [d.person, ...d.partners].filter((p) => p.name.trim())
  const toggle = (id: string) => set({ signers: d.signers.includes(id) ? d.signers.filter((x) => x !== id) : [...d.signers, id] })
  const options = [...(d.signAs === 'empresa' ? [d.company.legalName, d.company.tradeName] : []), d.person.name].filter((x, i, all) => x.trim() && all.indexOf(x) === i)
  const custom = !!d.contractName && !options.includes(d.contractName)
  const star = (k: DataFieldKey) => (r(k) === 'obrigatorio' ? ' *' : '')
  return (
    <>
      {r('signers') !== 'oculto' && (
        <Block icon="pen" title={`quem assina${star('signers')}`} note="toque para marcar">
          <div className="cd-choices">
            {people.map((p) => (
              <button key={p.id} type="button" className={`cd-choice ${d.signers.includes(p.id) ? 'is-on' : ''}`} aria-pressed={d.signers.includes(p.id)} onClick={() => toggle(p.id)}>
                <span className="cd-check">{d.signers.includes(p.id) && <Icon name="check" size={13} />}</span>
                <span>
                  <b>{p.name}</b>
                  {p.role && <small>{p.role}</small>}
                </span>
              </button>
            ))}
          </div>
        </Block>
      )}
      {r('contractName') !== 'oculto' && (
        <Block icon="file" title={`nome no contrato${star('contractName')}`}>
          <div className="cd-choices">
            {options.map((o) => (
              <button key={o} type="button" className={`cd-choice ${(d.contractName || options[0]) === o && !custom ? 'is-on' : ''}`} onClick={() => set({ contractName: o })}>
                <span className="cd-radio" />
                <span>
                  <b>{o}</b>
                </span>
              </button>
            ))}
            <button type="button" className={`cd-choice ${custom ? 'is-on' : ''}`} onClick={() => set({ contractName: custom ? d.contractName : ' ' })}>
              <span className="cd-radio" />
              <span>
                <b>outro nome</b>
              </span>
            </button>
          </div>
          {custom && (
            <Field label="Como deve aparecer">
              <input value={d.contractName.trimStart()} onChange={(e) => set({ contractName: e.target.value || ' ' })} autoFocus />
            </Field>
          )}
        </Block>
      )}
    </>
  )
}

/** Perguntas a mais que você criou. */
export function ExtraFields({ qs, d, set }: { qs: DataQuestion[]; d: ContractData; set: Set<ContractData> }) {
  if (!qs.length) return null
  const val = (id: string) => d.extra?.find((x) => x.id === id)?.value ?? ''
  const put = (q: DataQuestion, value: string) => set({ extra: [...(d.extra ?? []).filter((x) => x.id !== q.id), { id: q.id, label: q.label, value }] })
  return (
    <div className="form-grid cd-extra">
      {qs.map((q) => {
        const label = `${q.label}${q.required ? ' *' : ''}`
        if (q.kind === 'simnao' || q.kind === 'escolha')
          return (
            <Field key={q.id} label={label} span={3} group>
              <div className="cd-pills">
                {(q.kind === 'simnao' ? ['sim', 'não'] : q.options.filter((o) => o.trim())).map((o) => (
                  <button key={o} type="button" className={`cd-pill ${val(q.id) === o ? 'is-on' : ''}`} aria-pressed={val(q.id) === o} onClick={() => put(q, o)}>
                    {o}
                  </button>
                ))}
              </div>
            </Field>
          )
        return (
          <Field key={q.id} label={label} span={3}>
            {q.kind === 'longo' ? <textarea rows={3} value={val(q.id)} onChange={(e) => put(q, e.target.value)} /> : <input value={val(q.id)} onChange={(e) => put(q, e.target.value)} />}
          </Field>
        )
      })}
    </div>
  )
}

/** Tudo aberto, para corrigir (sua tela). */
export function DataEditor({ d, set, cfg }: { d: ContractData; set: Set<ContractData>; cfg?: DataFormConfig }) {
  const r = ruleOf(cfg)
  const [sugs, setSugs] = useState<{ name: string; role: string }[]>([])
  const setPerson = (patch: Partial<ContractPerson>) => set({ person: { ...d.person, ...patch } })
  const company = d.signAs === 'empresa'
  const extra = (step: DataQuestion['step']) => (cfg?.extra ?? []).filter((q) => (q.step === 'empresa' && !company ? 'voce' : q.step) === step)
  const addrKey: DataFieldKey = company ? 'repAddress' : 'personAddress'
  return (
    <div className="cd-editor">
      <div className="cd-types is-small">
        <button type="button" className={`cd-type ${company ? 'is-on' : ''}`} onClick={() => set({ signAs: 'empresa' })}>
          <span className="cd-ico">
            <Icon name="building" size={16} />
          </span>
          <b>empresa</b>
        </button>
        <button type="button" className={`cd-type ${!company ? 'is-on' : ''}`} onClick={() => set({ signAs: 'pessoa' })}>
          <span className="cd-ico">
            <Icon name="user" size={16} />
          </span>
          <b>pessoa</b>
        </button>
      </div>
      {company && (
        <Block icon="building" title="dados da empresa">
          <CompanyFields d={d} set={set} r={r} onPartners={setSugs} />
          {r('companyAddress') !== 'oculto' && <AddressFields a={d.company.address} set={(patch) => set({ company: { ...d.company, address: { ...d.company.address, ...patch } } })} required={r('companyAddress') === 'obrigatorio'} />}
          <ExtraFields qs={extra('empresa')} d={d} set={set} />
        </Block>
      )}
      <Block icon="user" title={company ? 'responsável' : 'dados pessoais'}>
        <PersonFields p={d.person} set={setPerson} company={company} r={r} />
        {r(addrKey) !== 'oculto' && <AddressFields a={d.person.address ?? emptyAddress()} set={(patch) => setPerson({ address: { ...(d.person.address ?? emptyAddress()), ...patch } })} required={r(addrKey) === 'obrigatorio'} />}
        <ExtraFields qs={extra('voce')} d={d} set={set} />
      </Block>
      {company && r('partners') !== 'oculto' && (
        <Block icon="users" title="sócios">
          <PartnersFields d={d} set={set} r={r} suggestions={sugs} />
        </Block>
      )}
      <SignFields d={d} set={set} r={r} />
      <ExtraFields qs={extra('final')} d={d} set={set} />
      {r('notes') !== 'oculto' && (
        <Field label={`Observações${r('notes') === 'obrigatorio' ? ' *' : ''}`}>
          <textarea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      )}
    </div>
  )
}

/** Resumo de leitura (revisão no link e sua tela). */
export function DataSummary({ d, onEdit }: { d: ContractData; onEdit?: (part: 'empresa' | 'voce' | 'socios' | 'final') => void }) {
  const addr = (a?: FullAddress) => (a ? [[a.street, a.number].filter(Boolean).join(', '), a.complement, a.district, [a.city, a.uf].filter(Boolean).join('/'), a.cep].filter((x) => x?.trim()).join(' · ') : '')
  const p = d.person
  const groups: { part: 'empresa' | 'voce' | 'socios' | 'final'; icon: string; title: string; rows: [string, string][] }[] = []
  if (d.signAs === 'empresa')
    groups.push({
      part: 'empresa',
      icon: 'building',
      title: 'empresa',
      rows: [
        ['razão social', d.company.legalName],
        ['nome fantasia', d.company.tradeName],
        ['CNPJ', [d.company.cnpj, d.company.kind].filter(Boolean).join(' · ')],
        ['sede', addr(d.company.address)],
        ['contato', [d.company.email, d.company.phone].filter(Boolean).join(' · ')],
      ],
    })
  groups.push({
    part: 'voce',
    icon: 'user',
    title: d.signAs === 'empresa' ? 'responsável' : 'dados pessoais',
    rows: [
      ['nome', [p.name, p.role].filter(Boolean).join(' · ')],
      ['documentos', [p.cpf && `CPF ${p.cpf}`, p.rg && `RG ${p.rg} ${p.rgIssuer}`].filter(Boolean).join(' · ')],
      ['dados', [p.nationality, p.civilState, p.profession].filter(Boolean).join(', ')],
      ['contato', [p.email, p.phone].filter(Boolean).join(' · ')],
      ['endereço', addr(p.address)],
    ],
  })
  if (d.partners.length) groups.push({ part: 'socios', icon: 'users', title: 'sócios', rows: d.partners.map((x, i) => [`sócio ${i + 1}`, [x.name, x.cpf && `CPF ${x.cpf}`, x.role].filter(Boolean).join(' · ')] as [string, string]) })
  groups.push({
    part: 'final',
    icon: 'pen',
    title: 'contrato',
    rows: [
      ['assina', signersOf(d).map((x) => x.name).join(', ')],
      ['no contrato', contractantName(d)],
      ...(d.extra ?? []).map((x) => [x.label, x.value] as [string, string]),
      ['observações', d.notes],
    ],
  })
  return (
    <div className="cd-sum">
      {groups.map((g) => (
        <section key={g.part} className="cd-sum-g">
          <header className="cd-blk-head">
            <span className="cd-ico">
              <Icon name={g.icon} size={15} />
            </span>
            <b>{g.title}</b>
            {onEdit && (
              <button type="button" className="icon-btn" onClick={() => onEdit(g.part)} aria-label={`Editar ${g.title}`} title={`Editar ${g.title}`}>
                <Icon name="edit" size={15} />
              </button>
            )}
          </header>
          <dl className="cd-summary">
            {g.rows
              .filter(([, v]) => (v ?? '').trim())
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
