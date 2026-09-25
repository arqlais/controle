import { useRef } from 'react'
import { DEFAULT_SETTINGS, demoData, emptyData, normalize, useStore } from '../store'
import { Icon } from '../components/Icon'
import { Badge, Field, MoneyInput, Section, Segmented } from '../components/ui'
import type { Settings } from '../types'
import { download, money, today, uid } from '../utils'

const PRESETS: { name: string; s: Partial<Settings> }[] = [
  { name: 'Preto & areia', s: { accent: '#1c1c1c', accentSoft: '#b89b7a', background: '#f4f1ec', surface: '#ffffff', text: '#1c1c1c' } },
  { name: 'Branco galeria', s: { accent: '#111111', accentSoft: '#9a9a9a', background: '#fafafa', surface: '#ffffff', text: '#111111' } },
  { name: 'Terracota', s: { accent: '#a4553a', accentSoft: '#d9b99b', background: '#f6f0ea', surface: '#fffdfb', text: '#2b211c' } },
  { name: 'Oliva', s: { accent: '#4f5b3a', accentSoft: '#c2b79a', background: '#f2f1ea', surface: '#ffffff', text: '#1f2419' } },
  { name: 'Azul concreto', s: { accent: '#2f4a6b', accentSoft: '#a9b4bf', background: '#eef0f2', surface: '#ffffff', text: '#1a2230' } },
  { name: 'Rosé', s: { accent: '#8a4b5a', accentSoft: '#e0bfc3', background: '#f8f1f0', surface: '#ffffff', text: '#2a1d20' } },
]

const DISPLAY_FONTS = ['Cormorant Garamond', 'Playfair Display', 'Montserrat', 'Inter', 'DM Sans']
const BODY_FONTS = ['Inter', 'DM Sans', 'Montserrat']

export default function SettingsPage() {
  const { data, setSettings, replaceAll } = useStore()
  const s = data.settings
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  const onLogo = (f?: File) => {
    if (!f) return
    if (f.size > 600_000) return alert('Use uma imagem menor que 600 KB (PNG ou SVG de preferência).')
    const r = new FileReader()
    r.onload = () => setSettings({ logo: String(r.result) })
    r.readAsDataURL(f)
  }

  const onImport = (f?: File) => {
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result))
        if (!parsed.clients || !parsed.projects) throw new Error()
        if (confirm(`Importar backup com ${parsed.clients.length} clientes e ${parsed.projects.length} projetos? Os dados atuais serão substituídos.`)) replaceAll(normalize(parsed))
      } catch {
        alert('Arquivo inválido.')
      }
    }
    r.readAsText(f)
  }

  const setService = (id: string, patch: Partial<Settings['services'][number]>) =>
    setSettings({ services: s.services.map((x) => (x.id === id ? { ...x, ...patch } : x)) })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Sistema</p>
          <h1>Configurações</h1>
        </div>
      </div>

      <div className="grid-2">
        <Section title="Identidade visual">
          <p className="muted small">Ajuste para ficar igual ao seu site: envie o logo e use as mesmas cores (código hex) e fontes.</p>
          <div className="form-grid">
            <Field label="Nome da marca">
              <input value={s.brandName} onChange={(e) => setSettings({ brandName: e.target.value })} />
            </Field>
            <Field label="Frase / especialidade" span={2}>
              <input value={s.tagline} onChange={(e) => setSettings({ tagline: e.target.value })} />
            </Field>
            <Field label="Logo" span={3} hint="Aparece no menu, nos recibos e nas propostas.">
              <div className="row gap-s">
                {s.logo ? <img src={s.logo} alt="" className="logo-preview" /> : <span className="muted small">Sem logo — usando o nome da marca.</span>}
                <button className="btn small" onClick={() => logoRef.current?.click()}>
                  <Icon name="upload" size={14} /> Enviar
                </button>
                {s.logo && (
                  <button className="btn small ghost" onClick={() => setSettings({ logo: '' })}>
                    Remover
                  </button>
                )}
                <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
              </div>
            </Field>
          </div>

          <div className="presets">
            {PRESETS.map((p) => (
              <button key={p.name} className="preset" onClick={() => setSettings(p.s)} title={p.name}>
                <span style={{ background: p.s.background }}>
                  <i style={{ background: p.s.accent }} />
                  <i style={{ background: p.s.accentSoft }} />
                </span>
                {p.name}
              </button>
            ))}
          </div>

          <div className="form-grid">
            {(
              [
                ['accent', 'Cor principal'],
                ['accentSoft', 'Cor secundária'],
                ['background', 'Fundo'],
                ['surface', 'Cartões'],
                ['text', 'Texto'],
              ] as [keyof Settings, string][]
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <div className="color-input">
                  <input type="color" value={s[k] as string} onChange={(e) => setSettings({ [k]: e.target.value })} />
                  <input value={s[k] as string} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && setSettings({ [k]: e.target.value })} maxLength={7} />
                </div>
              </Field>
            ))}
            <Field label="Fonte dos títulos">
              <select value={s.displayFont} onChange={(e) => setSettings({ displayFont: e.target.value })}>
                {DISPLAY_FONTS.map((f) => (
                  <option key={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fonte do texto">
              <select value={s.bodyFont} onChange={(e) => setSettings({ bodyFont: e.target.value })}>
                {BODY_FONTS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label={`Cantos arredondados · ${s.radius}px`}>
              <input type="range" min={0} max={20} value={s.radius} onChange={(e) => setSettings({ radius: Number(e.target.value) })} />
            </Field>
            <Field label="Rótulos">
              <Segmented
                value={s.uppercaseLabels ? 'u' : 'n'}
                options={[
                  { value: 'u', label: 'CAIXA ALTA' },
                  { value: 'n', label: 'Normal' },
                ]}
                onChange={(v) => setSettings({ uppercaseLabels: v === 'u' })}
              />
            </Field>
            <Field label="Tema">
              <Segmented
                value={s.dark ? 'd' : 'l'}
                options={[
                  { value: 'l', label: 'Claro' },
                  { value: 'd', label: 'Escuro' },
                ]}
                onChange={(v) => setSettings({ dark: v === 'd' })}
              />
            </Field>
          </div>
          <div className="row gap-s">
            <button
              className="btn small ghost"
              onClick={() =>
                setSettings({
                  accent: DEFAULT_SETTINGS.accent,
                  accentSoft: DEFAULT_SETTINGS.accentSoft,
                  background: DEFAULT_SETTINGS.background,
                  surface: DEFAULT_SETTINGS.surface,
                  text: DEFAULT_SETTINGS.text,
                  displayFont: DEFAULT_SETTINGS.displayFont,
                  bodyFont: DEFAULT_SETTINGS.bodyFont,
                  radius: DEFAULT_SETTINGS.radius,
                })
              }
            >
              Restaurar padrão
            </button>
          </div>
        </Section>

        <div className="stack">
          <Section title="Seus dados (recibos e propostas)">
            <div className="form-grid">
              <Field label="Seu nome">
                <input value={s.ownerName} onChange={(e) => setSettings({ ownerName: e.target.value })} />
              </Field>
              <Field label="CPF / CNPJ (MEI)">
                <input value={s.document} onChange={(e) => setSettings({ document: e.target.value })} />
              </Field>
              <Field label="Chave Pix">
                <input value={s.pixKey} onChange={(e) => setSettings({ pixKey: e.target.value })} />
              </Field>
              <Field label="WhatsApp">
                <input value={s.phone} onChange={(e) => setSettings({ phone: e.target.value })} />
              </Field>
              <Field label="E-mail">
                <input value={s.email} onChange={(e) => setSettings({ email: e.target.value })} />
              </Field>
              <Field label="Instagram">
                <input value={s.instagram} onChange={(e) => setSettings({ instagram: e.target.value })} />
              </Field>
              <Field label="Site">
                <input value={s.website} onChange={(e) => setSettings({ website: e.target.value })} />
              </Field>
              <Field label="Cidade">
                <input value={s.city} onChange={(e) => setSettings({ city: e.target.value })} />
              </Field>
            </div>
          </Section>

          <Section title="Metas e regras de negócio">
            <div className="form-grid">
              <Field label="Meta mensal de faturamento">
                <MoneyInput value={s.monthlyGoal} onChange={(n) => setSettings({ monthlyGoal: n })} />
              </Field>
              <Field label="Meta de valor/hora">
                <MoneyInput value={s.hourlyTarget} onChange={(n) => setSettings({ hourlyTarget: n })} />
              </Field>
              <Field label="Taxa de urgência (%)">
                <input type="number" min={0} value={s.urgencyFee} onChange={(e) => setSettings({ urgencyFee: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Revisões padrão">
                <input type="number" min={0} value={s.defaultRevisions} onChange={(e) => setSettings({ defaultRevisions: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Condições de pagamento padrão" span={3}>
                <textarea rows={2} value={s.defaultPaymentTerms} onChange={(e) => setSettings({ defaultPaymentTerms: e.target.value })} />
              </Field>
            </div>
          </Section>
        </div>
      </div>

      <Section
        title="Tabela de preços e serviços"
        action={
          <button
            className="btn small"
            onClick={() => setSettings({ services: [...s.services, { id: uid(), name: 'Novo serviço', unit: 'unidade', price: 0, studentPrice: 0, hours: 1 }] })}
          >
            <Icon name="plus" size={14} /> Serviço
          </button>
        }
      >
        <p className="muted small">
          Dois preços por serviço: <b>profissional</b> (arquitetos, designers, escritórios, construtoras) e <b>estudante</b>. O sistema escolhe sozinho conforme o tipo do cliente. As horas por
          unidade estimam seu valor/hora real.
        </p>
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Unidade</th>
                <th>Profissional</th>
                <th>Estudante</th>
                <th>Horas/un.</th>
                <th>R$/hora</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.services.map((x) => (
                <tr key={x.id}>
                  <td>
                    <input className="cell-input" value={x.name} onChange={(e) => setService(x.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <input className="cell-input" value={x.unit} onChange={(e) => setService(x.id, { unit: e.target.value })} style={{ width: 90 }} />
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <MoneyInput value={x.price} onChange={(n) => setService(x.id, { price: n })} />
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <MoneyInput value={x.studentPrice} onChange={(n) => setService(x.id, { studentPrice: n })} />
                  </td>
                  <td>
                    <input className="cell-input" type="number" step={0.5} min={0} value={x.hours} onChange={(e) => setService(x.id, { hours: Number(e.target.value) || 0 })} style={{ width: 70 }} />
                  </td>
                  <td className="nowrap">
                    {x.hours ? (
                      <Badge color={x.price / x.hours >= s.hourlyTarget ? '#2f855a' : '#c53030'}>{money(x.price / x.hours)}</Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="actions">
                    <button className="icon-btn" onClick={() => confirm(`Remover "${x.name}"?`) && setSettings({ services: s.services.filter((y) => y.id !== x.id) })}>
                      <Icon name="trash" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Backup e dados">
        <p className="muted small">
          Os dados ficam salvos <b>neste navegador</b>. Faça backup com frequência (ex.: toda sexta) e guarde no Drive — o arquivo também serve para passar os dados para outro computador ou
          celular.
        </p>
        <div className="row gap-s wrap">
          <button className="btn primary" onClick={() => download(`backup-controle-${today()}.json`, JSON.stringify(data, null, 2))}>
            <Icon name="download" size={16} /> Baixar backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Restaurar backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
          <button className="btn ghost" onClick={() => confirm('Substituir tudo por dados de exemplo?') && replaceAll(demoData(s))}>
            Carregar exemplo
          </button>
          <button
            className="btn ghost danger"
            onClick={() => confirm('Apagar TODOS os clientes, projetos, orçamentos e lançamentos? (as configurações ficam)') && replaceAll({ ...emptyData(), settings: s })}
          >
            Apagar dados
          </button>
        </div>
      </Section>
    </div>
  )
}
