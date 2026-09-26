import { useRef, useState } from 'react'
import { useDeviceDark } from '../theme'
import { DEFAULT_SETTINGS, demoData, emptyData, normalize, useStore } from '../store'
import { Icon } from '../components/Icon'
import { Field, MoneyInput, Section, Segmented } from '../components/ui'
import { ask, askDelete, toast } from '../components/dialog'
import type { Complexity, Pricing, Quote, Settings } from '../types'
import { COMPLEXITY, MESSAGE_VARS, PRICING, download, money, nextQuoteNumber, today, uid } from '../utils'
import { DEFAULT_MESSAGES, DEFAULT_PROPOSAL } from '../store'
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

type TabId = 'aparencia' | 'precos' | 'propostas' | 'mensagens' | 'metas' | 'dados'
const TABS: { id: TabId; label: string; hint: string; icon: string; desktop?: boolean }[] = [
  { id: 'aparencia', label: 'aparência', hint: 'cores, fontes e tema', icon: 'star' },
  { id: 'precos', label: 'preços', hint: 'tabela e regras', icon: 'wallet', desktop: true },
  { id: 'propostas', label: 'propostas', hint: 'modelo do PDF e padrões', icon: 'file', desktop: true },
  { id: 'mensagens', label: 'mensagens', hint: 'textos para a cliente', icon: 'whatsapp', desktop: true },
  { id: 'metas', label: 'metas', hint: 'faturamento e MEI', icon: 'target', desktop: true },
  { id: 'dados', label: 'dados', hint: 'perfil e backup', icon: 'download' },
]
const TAB_KEY = 'config-aba'

export default function SettingsPage() {
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches
  const [tab, setTab] = useState<TabId>(() => {
    let saved: TabId | null = null
    try {
      saved = localStorage.getItem(TAB_KEY) as TabId | null
    } catch {
      /* sem armazenamento */
    }
    const ok = TABS.find((t) => t.id === saved && (!narrow || !t.desktop))
    return ok ? ok.id : 'aparencia'
  })
  const pickTab = (id: TabId) => {
    setTab(id)
    try {
      localStorage.setItem(TAB_KEY, id)
    } catch {
      /* sem armazenamento */
    }
  }
  const { data, setSettings, replaceAll } = useStore()
  const s = data.settings
  const [dark, setDark] = useDeviceDark()
  const fileRef = useRef<HTMLInputElement>(null)
  const fontRef = useRef<HTMLInputElement>(null)

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

      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Seções das configurações">
          {TABS.map((t) => (
            <button key={t.id} className={`settings-tab ${tab === t.id ? 'active' : ''} ${t.desktop ? 'desktop-only' : ''}`} onClick={() => pickTab(t.id)}>
              <Icon name={t.icon} size={17} />
              <span>
                <b>{t.label}</b>
                <small>{t.hint}</small>
              </span>
            </button>
          ))}
          <p className="settings-note mobile-only">Preços, propostas, mensagens e metas são editados no computador.</p>
        </nav>

        <div className="settings-panel">
          {tab === 'aparencia' && (
            <>
              <Section title="identidade visual" className="desktop-only">
                <p className="muted small">Cores e fontes iguais às do seu site. Logo, nome e contatos ficam no <a href="#/perfil" className="link">perfil</a>.</p>
                <div className="form-grid">
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
              <Section title="tema deste aparelho">
                <div className="form-grid">
                  <Field label="Claro ou escuro" hint="Cada aparelho guarda o seu: o celular pode ficar claro e o computador escuro.">
                    <Segmented
                      value={dark ? 'd' : 'l'}
                      options={[
                        { value: 'l', label: 'Claro' },
                        { value: 'd', label: 'Escuro' },
                      ]}
                      onChange={(v) => setDark(v === 'd')}
                    />
                  </Field>
                </div>
              </Section>
            </>
          )}

          {tab === 'precos' && (
            <>
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
              <Section title="regras de preço" className="desktop-only">
                <div className="form-grid">
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
                </div>
              </Section>
            </>
          )}

          {tab === 'propostas' && (
            <>
              <ProposalSettings />
              <Section title="numeração e padrões" className="desktop-only">
                <div className="form-grid">
                  <Field label="Começar a contagem em" hint={`Os orçamentos seguem em ordem a partir daqui. Próximo: #${String(nextQuoteNumber(data)).padStart(3, '0')}.`}>
                    <input type="number" min={1} value={s.quoteStart ?? 1} onChange={(e) => setSettings({ quoteStart: Math.max(1, Number(e.target.value) || 1) })} />
                  </Field>
                  <Field label="Rodadas de ajuste incluídas">
                    <input type="number" min={0} value={s.defaultRevisions} onChange={(e) => setSettings({ defaultRevisions: Number(e.target.value) || 0 })} />
                  </Field>
                </div>
              </Section>
            </>
          )}

          {tab === 'mensagens' && <MessagesSettings />}

          {tab === 'metas' && (
            <Section title="metas do mês e do ano" className="desktop-only">
              <div className="form-grid">
                <Field label="Meta mensal de faturamento">
                  <MoneyInput value={s.monthlyGoal} onChange={(n) => setSettings({ monthlyGoal: n })} />
                </Field>
                <Field label="Teto anual do MEI" hint="Só se você abrir um MEI: mostra no Financeiro quanto do teto já usou. Com 0, fica escondido.">
                  <MoneyInput value={s.meiLimit} onChange={(n) => setSettings({ meiLimit: n })} />
                </Field>
              </div>
            </Section>
          )}

          {tab === 'dados' && (
            <>
              <Section title="seus dados">
                <p className="muted small">Nome, foto, contatos, pix e CPF/CNPJ ficam no <b>perfil do estúdio</b>, junto com a sua conta.</p>
                <a className="btn small" href="#/perfil">
                  <Icon name="user" size={14} /> abrir perfil
                </a>
              </Section>
          <Section title="backup e dados">
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
            </>
          )}
        </div>
      </div>
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

/** Mensagens prontas para cada situação com a cliente, com {variáveis} preenchidas na hora de enviar. */
function MessagesSettings() {
  const { data, setSettings } = useStore()
  const list = data.settings.messages
  const update = (id: string, patch: Partial<(typeof list)[number]>) => setSettings({ messages: list.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  return (
    <Section
      className="desktop-only"
      title="mensagens padrão"
      action={
        <button className="btn small" onClick={() => setSettings({ messages: [...list, { id: uid(), name: 'nova mensagem', text: 'Oi, {cliente}! ' }] })}>
          <Icon name="plus" size={14} /> mensagem
        </button>
      }
    >
      <p className="muted small">
        Aparecem no botão <b>mensagens</b> da cliente, da demanda e do orçamento, já com os dados preenchidos. Use as variáveis:{' '}
        {MESSAGE_VARS.map(([k, d]) => (
          <code key={k} className="var-chip" title={d}>
            {`{${k}}`}
          </code>
        ))}
      </p>
      <div className="msg-edit-list">
        {list.map((m) => (
          <div key={m.id} className="msg-edit">
            <div className="row gap-s">
              <input className="service-name" value={m.name} onChange={(e) => update(m.id, { name: e.target.value })} aria-label="Quando usar" />
              <button className="icon-btn" onClick={async () => (await askDelete(`a mensagem "${m.name}"`)) && setSettings({ messages: list.filter((x) => x.id !== m.id) })} aria-label="Excluir mensagem">
                <Icon name="trash" size={16} />
              </button>
            </div>
            <textarea rows={3} value={m.text} onChange={(e) => update(m.id, { text: e.target.value })} spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" />
          </div>
        ))}
      </div>
      <button className="link" onClick={async () => (await ask('Voltar às mensagens padrão originais? As suas edições nas mensagens serão perdidas.', { confirmLabel: 'Restaurar' })) && setSettings({ messages: DEFAULT_MESSAGES })}>
        restaurar mensagens originais
      </button>
    </Section>
  )
}
