import { useState } from 'react'
import type { Client, PartnerPrice, PartnerTable, ServiceDef } from '../types'
import { useStore } from '../store'
import { useAccess } from '../access'
import { Icon } from './Icon'
import { Field, Modal, MoneyInput, Section } from './ui'
import { toast } from './dialog'
import { AreaTiers } from './PriceTable'
import { PartnerSheet } from './Docs'
import { usePdf } from './Print'
import { money, nextQuoteNumber, sortedTiers, today, withPartner } from '../utils'

/* Valores de parceria (só a dona): preços especiais combinados com um escritório parceiro.
   Valem sozinhos nos orçamentos dele e viram a "tabela exclusiva parceria" em PDF. */

const usable = (x: ServiceDef) => x.pricing !== 'livre' && x.id !== 'personalizado'

/** Resumo de uma linha do valor combinado. */
function summary(x: ServiceDef) {
  if (x.pricing === 'm2') {
    const t = sortedTiers(x.areaTiers).filter((y) => y.price > 0)
    if (!t.length) return `${money(x.price)}/m²`
    return t.map((y, i) => `${y.upTo ? (t[i - 1]?.upTo ? `${t[i - 1].upTo! + 1}–${y.upTo}` : `até ${y.upTo}`) : `acima de ${t[i - 1]?.upTo ?? 0}`} m² ${money(y.price)}`).join(' · ')
  }
  if (x.pricing === 'pacote') return [`1 ${x.unit} ${money(x.price)}`, ...x.tiers.filter((t) => t.qty > 1).map((t) => `${t.qty} por ${money(t.price)}`)].join(' · ')
  return `${money(x.price)} por ${x.unit || 'unidade'}`
}

export function PartnerSection({ client }: { client: Client }) {
  const { data } = useStore()
  const { isOwner } = useAccess()
  const [edit, setEdit] = useState(false)
  if (!isOwner || client.type === 'final') return null
  const pt = client.partner
  const merged = withPartner(data.settings, client).services.filter((x) => pt?.services[x.id])
  return (
    <Section
      title="valores de parceria"
      action={
        <button className="btn small ghost" onClick={() => setEdit(true)}>
          <Icon name={pt?.on ? 'pen' : 'plus'} size={14} /> {pt?.on ? 'editar' : 'combinar valores'}
        </button>
      }
    >
      {pt?.on && merged.length ? (
        <div className="stack-s">
          <p className="muted small" style={{ margin: 0 }}>
            Valem sozinhos nos orçamentos de {client.name.split(' ')[0]}. O que não estiver aqui segue a sua tabela.
          </p>
          <ul className="pp-sum">
            {merged.map((x) => (
              <li key={x.id}>
                <b>{x.name}</b> <span className="muted">{summary(x)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>
          Preços especiais para este parceiro (ex.: executivo por faixa de m², pacotes de imagens). Entram sozinhos nos orçamentos dele e viram a tabela “exclusivo parceria” em PDF.
        </p>
      )}
      {edit && <PartnerEditor client={client} onClose={() => setEdit(false)} />}
    </Section>
  )
}

function PartnerEditor({ client, onClose }: { client: Client; onClose: () => void }) {
  const { data, upsert } = useStore()
  const st = data.settings
  const [t, setT] = useState<PartnerTable>(() => client.partner ?? { on: true, services: {}, title: 'exclusivo parceria', number: nextQuoteNumber(data), date: today() })
  const pdf = usePdf()
  const list = st.services.filter(usable)
  const base = (id: string) => st.services.find((x) => x.id === id)!
  // valor efetivo (tabela + o que foi combinado)
  const merged = (id: string): ServiceDef => withPartner(st, { ...client, partner: { ...t, on: true } }).services.find((x) => x.id === id)!
  const setSvc = (id: string, patch: Partial<PartnerPrice> | null) =>
    setT((cur) => {
      const services = { ...cur.services }
      if (patch === null) delete services[id]
      else services[id] = { ...(services[id] ?? {}), ...patch }
      return { ...cur, services }
    })
  const include = (x: ServiceDef) =>
    setSvc(x.id, {
      // começa com os valores da tabela, para só ajustar
      price: x.price,
      ...(x.pricing === 'pacote' ? { tiers: x.tiers.map((y) => ({ ...y })) } : {}),
      ...(x.pricing === 'm2' ? { areaTiers: x.areaTiers?.length ? x.areaTiers.map((y) => ({ ...y })) : [{ upTo: 0, price: x.price }] } : {}),
      incluso: '',
    })
  const save = (close = true) => {
    upsert('clients', { ...client, partner: t })
    if (close) {
      toast(t.on ? 'Valores de parceria salvos. Os próximos orçamentos deste cliente já usam esses valores.' : 'Parceria desligada: os orçamentos voltam para a sua tabela.')
      onClose()
    }
  }
  const sheet = <PartnerSheet s={st} client={client} table={t} services={withPartner(st, { ...client, partner: { ...t, on: true } }).services} />
  const fileName = `Tabela de parceria - ${client.name}.pdf`
  const msg = `oii, ${client.name.split(' ')[0]}! segue a tabela com os valores exclusivos da nossa parceria ☺️ qualquer dúvida, me chama`
  const picked = Object.keys(t.services).length
  return (
    <Modal
      wide
      title={`valores de parceria · ${client.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" disabled={!picked || pdf.busy} onClick={() => (save(false), pdf.download(sheet, fileName))}>
            <Icon name="download" size={16} /> PDF
          </button>
          <button className="btn ghost" disabled={!picked || pdf.busy} onClick={() => (save(false), pdf.send(sheet, fileName, { text: msg, phone: client.phone }))}>
            <Icon name="whatsapp" size={16} /> enviar
          </button>
          <button className="btn primary" onClick={() => save()}>
            <Icon name="check" size={16} /> salvar
          </button>
        </>
      }
    >
      <label className="check toggle">
        <input type="checkbox" checked={t.on} onChange={(e) => setT({ ...t, on: e.target.checked })} /> usar estes valores nos orçamentos de {client.name.split(' ')[0]}
      </label>
      <p className="muted small">Marque os serviços da parceria e ajuste os valores. O que não for marcado segue a sua tabela normal.</p>
      <div className="pp-edit">
        {list.map((x) => {
          const on = !!t.services[x.id]
          const m = on ? merged(x.id) : x
          const o = t.services[x.id] ?? {}
          return (
            <div key={x.id} className={`pp-edit-row ${on ? 'is-on' : ''}`}>
              <label className="check">
                <input type="checkbox" checked={on} onChange={(e) => (e.target.checked ? include(x) : setSvc(x.id, null))} />
                <b>{x.name}</b>
                <span className="muted small">{on ? summary(m) : `tabela: ${summary(x)}`}</span>
              </label>
              {on && (
                <div className="pp-edit-body">
                  {x.pricing === 'm2' && <AreaTiers x={{ ...m, areaTiers: o.areaTiers?.length ? o.areaTiers : m.areaTiers?.length ? m.areaTiers : [{ upTo: 0, price: m.price }] }} set={(p) => setSvc(x.id, { areaTiers: p.areaTiers?.length ? p.areaTiers : [{ upTo: 0, price: p.price ?? m.price }] })} calibrate={false} />}
                  {x.pricing !== 'm2' && (
                    <Field label={x.pricing === 'pacote' ? `1 ${x.unit} (avulso)` : x.pricing === 'hora' ? 'valor da hora' : `cada ${x.unit || 'unidade'}`}>
                      <MoneyInput value={o.price ?? x.price} onChange={(n) => setSvc(x.id, { price: n })} />
                    </Field>
                  )}
                  {x.pricing === 'pacote' && (
                    <div className="pt-tiers">
                      <span className="field-label">pacotes</span>
                      {(o.tiers ?? x.tiers).map((y, i, arr) => (
                        <div key={i} className="pt-tier">
                          <input type="number" min={2} value={y.qty} onChange={(e) => setSvc(x.id, { tiers: arr.map((z, j) => (j === i ? { ...z, qty: Number(e.target.value) || 0 } : z)) })} aria-label="Quantidade" />
                          <span className="muted small">{x.unit}s por</span>
                          <MoneyInput value={y.price} onChange={(n) => setSvc(x.id, { tiers: arr.map((z, j) => (j === i ? { ...z, price: n } : z)) })} />
                          <span className="muted small nowrap">{y.qty ? `= ${money(y.price / y.qty)} cada` : ''}</span>
                          <button type="button" className="icon-btn subtle" onClick={() => setSvc(x.id, { tiers: arr.filter((_, j) => j !== i) })} aria-label="Tirar pacote">
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn small ghost" onClick={() => setSvc(x.id, { tiers: [...(o.tiers ?? x.tiers), { qty: ((o.tiers ?? x.tiers).at(-1)?.qty ?? 0) + 5, price: 0 }] })}>
                        <Icon name="plus" size={14} /> pacote
                      </button>
                    </div>
                  )}
                  <Field label="incluso (aparece na tabela)">
                    <textarea rows={2} value={o.incluso ?? ''} onChange={(e) => setSvc(x.id, { incluso: e.target.value })} placeholder={x.pricing === 'm2' ? 'Ex.: plantas: layout cotado; demolir e construir; hidráulica, elétrica…' : 'Ex.: uma revisão pontual por imagem.'} spellCheck lang="pt-BR" />
                  </Field>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="form-grid">
        <Field label="título da tabela">
          <input value={t.title ?? ''} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="exclusivo parceria" />
        </Field>
        <Field label="nº (opcional)">
          <input type="number" min={0} value={t.number ?? ''} onChange={(e) => setT({ ...t, number: Number(e.target.value) || undefined })} />
        </Field>
        <Field label="pagamento" span={2}>
          <input value={t.payment ?? ''} onChange={(e) => setT({ ...t, payment: e.target.value })} placeholder={st.defaultPaymentTerms} />
        </Field>
        <Field label="prazos e cronograma" span={2}>
          <input value={t.schedule ?? ''} onChange={(e) => setT({ ...t, schedule: e.target.value })} placeholder={st.proposal.schedule} />
        </Field>
        <Field label="formatos de arquivos entregues" span={2}>
          <input value={t.files ?? ''} onChange={(e) => setT({ ...t, files: e.target.value })} placeholder="Ex.: PDF final, com carimbo e legendas" />
        </Field>
      </div>
      {base('executivo') && !picked && <p className="muted small">Dica: marque o executivo e as renderizações para montar a tabela como a que você já manda.</p>}
      {pdf.portal}
    </Modal>
  )
}
