import { useRef, useState } from 'react'
import { DEFAULT_SETTINGS, demoData, emptyData, normalize, useStore } from '../store'
import { Icon } from '../components/Icon'
import { EmailInput, Field, MoneyInput, PhoneInput, Section, Segmented } from '../components/ui'
import { ask, askDelete, toast } from '../components/dialog'
import type { Complexity, Pricing, Quote, Settings } from '../types'
import { COMPLEXITY, PRICING, download, money, today, uid } from '../utils'
import { DEFAULT_PROPOSAL } from '../store'
import { QuoteDoc } from '../components/Docs'
import { DocScale } from '../components/Print'
import { CLOUD } from '../cloud'

const PRESETS: { name: string; s: Partial<Settings> }[] = [
  { name: 'laís (site)', s: { accent: '#3e4b57', accentSoft: '#d6b3ab', accentInk: '#a88a80', background: '#f5f1ee', surface: '#ffffff', text: '#3e4b57' } },
  { name: 'Preto & areia', s: { accent: '#1c1c1c', accentSoft: '#b89b7a', accentInk: '#8f7458', background: '#f4f1ec', surface: '#ffffff', text: '#1c1c1c' } },
  { name: 'Branco galeria', s: { accent: '#111111', accentSoft: '#9a9a9a', background: '#fafafa', surface: '#ffffff', text: '#111111' } },
  { name: 'Terracota', s: { accent: '#a4553a', accentSoft: '#d9b99b', background: '#f6f0ea', surface: '#fffdfb', text: '#2b211c' } },
  { name: 'Oliva', s: { accent: '#4f5b3a', accentSoft: '#c2b79a', background: '#f2f1ea', surface: '#ffffff', text: '#1f2419' } },
  { name: 'Azul concreto', s: { accent: '#2f4a6b', accentSoft: '#a9b4bf', background: '#eef0f2', surface: '#ffffff', text: '#1a2230' } },
  { name: 'Rosé', s: { accent: '#8a4b5a', accentSoft: '#e0bfc3', background: '#f8f1f0', surface: '#ffffff', text: '#2a1d20' } },
]

const DISPLAY_FONTS = ['The Seasons', 'Cormorant Garamond']
const BODY_FONTS = ['Poppins']

export default function SettingsPage() {
  const { data, setSettings, replaceAll } = useStore()
  const s = data.settings
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const fontRef = useRef<HTMLInputElement>(null)

  const onLogo = (f?: File) => {
    if (!f) return
    if (f.size > 600_000) return toast('Use uma imagem menor que 600 KB (PNG ou SVG de preferência).')
    const r = new FileReader()
    r.onload = () => setSettings({ logo: String(r.result) })
    r.readAsDataURL(f)
  }

  const onFont = (f?: File) => {
    if (!f) return
    if (f.size > 900_000) return toast('Arquivo de fonte muito grande (máx. 900 KB). Prefira .woff2 ou .woff.')
    const r = new FileReader()
    r.onload = () => {
      setSettings({ customFont: String(r.result), displayFont: 'The Seasons' })
      toast('Fonte The Seasons aplicada.')
    }
    r.readAsDataURL(f)
  }

  const onImport = (f?: File) => {
    if (!f) return
    const r = new FileReader()
    r.onload = async () => {
      try {
        const parsed = JSON.parse(String(r.result))
        if (!parsed.clients || !parsed.projects) throw new Error()
        if (await ask(`Importar backup com ${parsed.clients.length} clientes e ${parsed.projects.length} projetos? Os dados atuais serão substituídos.`, { confirmLabel: 'Importar' })) replaceAll(normalize(parsed))
      } catch {
        toast('Arquivo inválido: escolha um backup .json gerado por este sistema.')
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
          <h1>
            configurações <em>do estúdio</em>
          </h1>
        </div>
      </div>

      <div className="grid-2">
        <Section title="Identidade visual" className="desktop-only">
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
                ['accentSoft', 'Rosé'],
                ['accentInk', 'Rosé dos itálicos'],
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
            <Field
              label="Fonte dos itálicos"
              span={3}
              hint={
                s.customFont
                  ? 'Usando o arquivo enviado.'
                  : 'A The Seasons já vem embutida no sistema. Envie outro arquivo só se quiser trocar a fonte dos títulos.'
              }
            >
              <div className="row gap-s">
                <button className="btn small" onClick={() => fontRef.current?.click()}>
                  <Icon name="upload" size={14} /> {s.customFont ? 'Trocar arquivo' : 'Enviar outra fonte'}
                </button>
                {s.customFont && (
                  <button className="btn small ghost" onClick={() => setSettings({ customFont: '' })}>
                    Remover
                  </button>
                )}
                <span className="font-sample">
                  <em>você projeta</em>
                </span>
                <input ref={fontRef} type="file" accept=".otf,.ttf,.woff,.woff2,font/*" hidden onChange={(e) => onFont(e.target.files?.[0])} />
              </div>
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
                  accentInk: DEFAULT_SETTINGS.accentInk,
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
              <Field label="Nome completo" hint="Rodapé da proposta e recibo.">
                <input value={s.legalName} onChange={(e) => setSettings({ legalName: e.target.value })} />
              </Field>
              <Field label="Como te chamo">
                <input value={s.ownerName} onChange={(e) => setSettings({ ownerName: e.target.value })} />
              </Field>
              <Field label="CPF / CNPJ (MEI)">
                <input value={s.document} onChange={(e) => setSettings({ document: e.target.value })} />
              </Field>
              <Field label="Chave Pix">
                <input value={s.pixKey} onChange={(e) => setSettings({ pixKey: e.target.value })} />
              </Field>
              <Field label="WhatsApp">
                <PhoneInput id="my-phone" value={s.phone} onChange={(v) => setSettings({ phone: v })} placeholder="+55 11 99999-9999" />
              </Field>
              <Field label="E-mail">
                <EmailInput id="my-email" value={s.email} onChange={(v) => setSettings({ email: v })} />
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
              <Field label="Teto anual do MEI" hint="Só se você abrir um MEI: mostra no Financeiro quanto do teto já usou. Com 0, fica escondido.">
                <MoneyInput value={s.meiLimit} onChange={(n) => setSettings({ meiLimit: n })} />
              </Field>
              <Field label="Taxa de urgência (%)">
                <input type="number" min={0} value={s.urgencyFee} onChange={(e) => setSettings({ urgencyFee: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Desconto para estudantes (%)" hint="Aplicado nas sugestões de valor.">
                <input type="number" min={0} max={90} value={s.studentDiscount} onChange={(e) => setSettings({ studentDiscount: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Complexidade (multiplica o m²)" span={3}>
                <div className="row gap-s">
                  {(Object.keys(COMPLEXITY) as Complexity[]).map((k) => (
                    <label key={k} className="cx-field">
                      <span className="small muted">{COMPLEXITY[k]} ×</span>
                      <input type="number" step={0.05} min={0.5} value={s.complexity[k]} onChange={(e) => setSettings({ complexity: { ...s.complexity, [k]: Number(e.target.value) || 1 } })} />
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Revisões padrão">
                <input type="number" min={0} value={s.defaultRevisions} onChange={(e) => setSettings({ defaultRevisions: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Condições de pagamento padrão" span={3}>
                <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" rows={2} value={s.defaultPaymentTerms} onChange={(e) => setSettings({ defaultPaymentTerms: e.target.value })} />
              </Field>
            </div>
          </Section>
        </div>
      </div>

      <p className="mobile-only desktop-note">
        <Icon name="settings" size={16} /> Identidade visual, tabela de preços e modelo da proposta são editados no computador.
      </p>

      <Section
        className="desktop-only"
        title="tabela de preços"
        action={
          <button
            className="btn small"
            onClick={() => setSettings({ services: [...s.services, { id: uid(), name: 'Novo serviço', unit: 'unidade', pricing: 'unidade', price: 0, tiers: [], min: 0, hours: 1 }] })}
          >
            <Icon name="plus" size={14} /> serviço
          </button>
        }
      >
        <p className="muted small">
          Cada serviço tem uma forma de preço: <b>pacotes</b> (o valor por unidade cai conforme a quantidade), <b>por m² × complexidade</b>, <b>por unidade</b> ou <b>valor livre</b>{' '}
          (você digita no orçamento). Estudantes recebem {s.studentDiscount}% de desconto na sugestão. No orçamento você sempre pode digitar outro valor.
        </p>
        <div className="services">
          {s.services.map((x) => (
            <div key={x.id} className="service-row">
              <div className="service-main">
                <input className="service-name" value={x.name} onChange={(e) => setService(x.id, { name: e.target.value })} aria-label="Nome do serviço" />
                <select value={x.pricing} onChange={(e) => setService(x.id, { pricing: e.target.value as Pricing, unit: e.target.value === 'm2' ? 'm²' : x.unit === 'm²' ? 'unidade' : x.unit })} aria-label="Forma de preço">
                  {(Object.keys(PRICING) as Pricing[]).map((k) => (
                    <option key={k} value={k}>
                      {PRICING[k]}
                    </option>
                  ))}
                </select>
                <button className="icon-btn" onClick={async () => (await askDelete(`o serviço "${x.name}"`)) && setSettings({ services: s.services.filter((y) => y.id !== x.id) })} aria-label="Remover">
                  <Icon name="trash" size={16} />
                </button>
              </div>
              {x.pricing !== 'livre' && (
                <div className="service-fields">
                  {x.pricing !== 'm2' && (
                    <Field label="Unidade">
                      <input value={x.unit} onChange={(e) => setService(x.id, { unit: e.target.value })} placeholder="imagem" />
                    </Field>
                  )}
                  <Field label={x.pricing === 'm2' ? 'R$ por m²' : x.pricing === 'pacote' ? `Avulso (1 ${x.unit})` : `R$ por ${x.unit}`}>
                    <MoneyInput value={x.price} onChange={(n) => setService(x.id, { price: n })} />
                  </Field>
                  <Field label="Valor mínimo">
                    <MoneyInput value={x.min} onChange={(n) => setService(x.id, { min: n })} />
                  </Field>
                </div>
              )}
              {x.pricing === 'pacote' && (
                <div className="tiers">
                  {x.tiers.map((t, i) => (
                    <div key={i} className="tier">
                      <input type="number" min={1} value={t.qty} onChange={(e) => setService(x.id, { tiers: x.tiers.map((y, j) => (j === i ? { ...y, qty: Number(e.target.value) || 0 } : y)) })} aria-label="Quantidade do pacote" />
                      <span className="muted small">{x.unit}s por</span>
                      <MoneyInput value={t.price} onChange={(n) => setService(x.id, { tiers: x.tiers.map((y, j) => (j === i ? { ...y, price: n } : y)) })} />
                      <span className="muted small nowrap">{t.qty ? `= ${money(t.price / t.qty)}/${x.unit}` : ''}</span>
                      <button className="icon-btn subtle" onClick={() => setService(x.id, { tiers: x.tiers.filter((_, j) => j !== i) })} aria-label="Remover pacote">
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                  <button className="btn small ghost" onClick={() => setService(x.id, { tiers: [...x.tiers, { qty: (x.tiers.at(-1)?.qty ?? 0) + 5, price: 0 }] })}>
                    <Icon name="plus" size={14} /> pacote
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <ProposalSettings />


      <Section title="Backup e dados">
        <p className="muted small">
          {CLOUD ? (
            <>
              Seus dados ficam <b>na nuvem</b>, protegidos pelo seu login, e aparecem iguais no computador e no celular. O backup é uma cópia extra: baixe de vez em quando e guarde no
              Drive.
            </>
          ) : (
            <>
              Os dados ficam salvos <b>neste navegador</b>. Faça backup com frequência (ex.: toda sexta) e guarde no Drive — o arquivo também serve para passar os dados para outro
              computador ou celular.
            </>
          )}
        </p>
        <div className="row gap-s wrap">
          <button className="btn primary" onClick={() => download(`backup-controle-${today()}.json`, JSON.stringify(data, null, 2))}>
            <Icon name="download" size={16} /> Baixar backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Restaurar backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
          <button className="btn ghost" onClick={async () => (await ask('Substituir tudo por dados de exemplo?', { confirmLabel: 'Carregar exemplo', danger: true })) && replaceAll(demoData(s))}>
            Carregar exemplo
          </button>
          <button
            className="btn ghost danger"
            onClick={async () => (await ask('Apagar TODOS os clientes, projetos, orçamentos e lançamentos? As configurações ficam.', { confirmLabel: 'Apagar tudo', danger: true })) && replaceAll({ ...emptyData(), settings: s })}
          >
            Apagar dados
          </button>
        </div>
      </Section>
    </div>
  )
}

/** Textos, fontes e cores da proposta em PDF, com pré-visualização. */
function ProposalSettings() {
  const { data, setSettings } = useStore()
  const s = data.settings
  const p = s.proposal
  const setP = (patch: Partial<typeof p>) => setSettings({ proposal: { ...p, ...patch } })
  const [mode, setMode] = useState<'escopo' | 'opcoes'>('escopo')
  const sample: Quote = {
    id: 'amostra',
    number: 1,
    clientId: '',
    title: 'Casa Pampulha — áreas sociais',
    mode,
    pdf: true,
    area: mode === 'escopo' ? 140 : 0,
    clientLabel: '',
    items: [
      { id: 'a', service: 'render-vray', title: 'renderização V-Ray', detail: '5 imagens', description: 'living, jantar, cozinha e 2 vistas da fachada', quantity: 5, complexity: 'media', price: 370, auto: true },
      { id: 'b', service: 'modelagem', title: 'modelagem 3d', detail: '', description: 'a partir do DWG, com mobiliário', quantity: 140, complexity: 'media', price: 1092, auto: true },
    ],
    options: [
      {
        id: 'o1', name: 'renderização por IA', note: '', discount: 0, discountNote: '', deadlineDays: 7,
        items: [{ id: 'c', service: 'render-ia', title: 'renderização por IA', detail: '10 imagens', description: 'áreas sociais e fachada', quantity: 10, complexity: 'media', price: 460, auto: true }],
      },
      {
        id: 'o2', name: 'renderização V-Ray', note: '', discount: 0, discountNote: '', deadlineDays: 12,
        items: [{ id: 'd', service: 'render-vray', title: 'renderização V-Ray', detail: '10 imagens', description: 'áreas sociais e fachada', quantity: 10, complexity: 'media', price: 710, auto: true }],
      },
    ],
    chosenOption: '',
    discount: 0,
    discountNote: '',
    files: p.files,
    schedule: p.schedule,
    urgency: false,
    deadlineDays: 10,
    validityDays: 15,
    revisions: s.defaultRevisions,
    paymentTerms: s.defaultPaymentTerms,
    notes: '',
    status: 'rascunho',
    sentAt: '',
    createdAt: today(),
    projectId: '',
  }
  return (
    <Section title="modelo da proposta (PDF)" className="desktop-only">
      <div className="proposal-settings">
        <div className="stack">
          <div className="form-grid">
            <Field label="Texto acima do título">
              <input value={p.eyebrow} onChange={(e) => setP({ eyebrow: e.target.value })} />
            </Field>
            <Field label="Título">
              <input value={p.title} onChange={(e) => setP({ title: e.target.value })} />
            </Field>
            <Field label="Fonte dos títulos">
              <select value={p.serif} onChange={(e) => setP({ serif: e.target.value })}>
                {['Cormorant Garamond', 'The Seasons'].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Prazos e cronograma (padrão)" span={3}>
              <input value={p.schedule} onChange={(e) => setP({ schedule: e.target.value })} />
            </Field>
            <Field label="Formatos de arquivos entregues (padrão)" span={3}>
              <input value={p.files} onChange={(e) => setP({ files: e.target.value })} />
            </Field>
            <Field label="Pagamento (padrão)" span={3} hint="Usado em todo orçamento novo; dá para mudar em cada um.">
              <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" rows={2} value={s.defaultPaymentTerms} onChange={(e) => setSettings({ defaultPaymentTerms: e.target.value })} />
            </Field>
            {(
              [
                ['ink', 'Azul (textos)'],
                ['rose', 'Rosé (rótulos)'],
                ['arch', 'Faixa do total'],
                ['bar', 'Faixa do topo e ícones'],
                ['paper', 'Fundo'],
              ] as ['ink' | 'rose' | 'arch' | 'paper' | 'bar', string][]
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <div className="color-input">
                  <input type="color" value={p[k]} onChange={(e) => setP({ [k]: e.target.value })} />
                  <input value={p[k]} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && setP({ [k]: e.target.value })} maxLength={7} />
                </div>
              </Field>
            ))}
          </div>
          <p className="muted small">
            A faixa do topo usa seu nome completo; o rodapé usa WhatsApp, Instagram, site e e-mail (em Seus dados).{' '}
            <button className="link" onClick={() => setSettings({ proposal: DEFAULT_PROPOSAL })}>
              restaurar modelo original
            </button>
          </p>
        </div>
        <div className="stack-s">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'escopo', label: 'escopo' },
              { value: 'opcoes', label: '2 opções' },
            ]}
          />
          <DocScale>
            <QuoteDoc s={s} quote={sample} client={{ id: '', name: 'Mariana Costa', company: 'Costa Arquitetura', type: 'escritorio', email: '', phone: '', instagram: '', city: '', document: '', origin: '', notes: '', favorite: false, archived: false, history: [], createdAt: '' }} />
          </DocScale>
        </div>
      </div>
    </Section>
  )
}
