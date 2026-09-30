import { MsgTools, WaPreview } from '../components/MsgTools'
import { PriceTable } from '../components/PriceTable'
import { LockedView, lockPlan } from '../components/LockedPreview'
import { ColorPicker } from '../components/ColorPicker'
import { isQuotePack, mergeQuotePack } from '../importQuotes'
import { useRef, useState } from 'react'
import { useDeviceDark } from '../theme'
import { demoData, emptyData, normalize, useStore } from '../store'
import { Icon } from '../components/Icon'
import { DesktopNote, Field, MoneyInput, Section, Segmented } from '../components/ui'
import { ask, askDelete, toast } from '../components/dialog'
import type { Complexity, Quote } from '../types'
import { COMPLEXITY, DEFAULT_CARD_FEE, MESSAGE_VARS, download, paymentMethods, nextQuoteNumber, today, uid } from '../utils'
import { DEFAULT_MESSAGES, DEFAULT_PROPOSAL } from '../store'
import { QuoteDoc } from '../components/Docs'
import { DocScale } from '../components/Print'
import { CLOUD } from '../cloud'
import { BrandKit } from '../components/BrandKit'
import { BODY_FONTS, DISPLAY_FONTS, EXCLUSIVE_FONT } from '../brand'
import { useAccess } from '../access'
import { TEMPLATES, followsBrand, resolveTemplate, sheetColors, templateAllowed } from '../proposalTemplates'
import { contractSettings } from '../contracts'
import { WORK_PROFILES } from '../clientDefaults'
import { PLANS } from '../plans'
import { PortfolioSettings, ProcessSettings } from '../components/QuoteSteps'

type TabId = 'aparencia' | 'precos' | 'propostas' | 'mensagens' | 'metas' | 'ia' | 'dados'
const TABS: { id: TabId; label: string; hint: string; icon: string; desktop?: boolean }[] = [
  { id: 'aparencia', label: 'aparência', hint: 'cores, fontes e tema', icon: 'star' },
  { id: 'precos', label: 'preços', hint: 'tabela e regras', icon: 'wallet' },
  { id: 'propostas', label: 'propostas', hint: 'modelo do PDF, contratos e padrões', icon: 'file' },
  { id: 'mensagens', label: 'mensagens', hint: 'textos para a cliente', icon: 'whatsapp', desktop: true },
  { id: 'metas', label: 'metas', hint: 'faturamento e MEI', icon: 'target', desktop: true },
  { id: 'ia', label: 'assistente', hint: 'chat com IA sobre orçamentos', icon: 'sparkle' },
  { id: 'dados', label: 'dados', hint: 'perfil e backup', icon: 'download' },
]
const TAB_KEY = 'config-aba'

export default function SettingsPage() {
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches
  const { has } = useAccess()
  // assistente de IA: só no plano da dona (clientes conversam com ela pelo chat)
  const tabs = TABS.filter((t) => t.id !== 'ia' || has('assistenteIA'))
  const [tab, setTab] = useState<TabId>(() => {
    let saved: TabId | null = null
    try {
      saved = localStorage.getItem(TAB_KEY) as TabId | null
    } catch {
      /* sem armazenamento */
    }
    const ok = tabs.find((t) => t.id === saved && (!narrow || !t.desktop))
    return ok ? ok.id : 'aparencia'
  })
  const [showKey, setShowKey] = useState(false)
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

  const onImport = (f?: File) => {
    if (!f) return
    const r = new FileReader()
    r.onload = async () => {
      try {
        const parsed = JSON.parse(String(r.result))
        // arquivo de orçamentos antigos: adiciona, sem apagar nada
        if (isQuotePack(parsed)) {
          if (!(await ask(`Adicionar ${parsed.quotes.length} orçamentos como rascunho? Nada do que já existe é apagado; os clientes que faltam são criados.`, { confirmLabel: 'Adicionar' }))) return
          const res = mergeQuotePack(data, parsed, s.urgencyFee)
          replaceAll(res.data)
          toast(
            `${res.added.length} orçamento(s) adicionados${res.newClients ? ` e ${res.newClients} cliente(s) novos` : ''}.${res.skipped.length ? ` ${res.skipped.length} já existia(m)${res.skipped.length <= 3 ? `: ${res.skipped.join(', ')}` : ''}.` : ''}`,
          )
          return
        }
        if (!parsed.clients || !parsed.projects) throw new Error()
        if (await ask(`Importar backup com ${parsed.clients.length} clientes e ${parsed.projects.length} projetos? Os dados atuais serão substituídos.`, { confirmLabel: 'Importar' })) replaceAll(normalize(parsed))
      } catch {
        toast('Arquivo inválido: escolha um backup ou um arquivo de orçamentos (.json).')
      }
    }
    r.readAsText(f)
  }


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
          {tabs.map((t) => (
            <button key={t.id} className={`settings-tab ${tab === t.id ? 'active' : ''} ${t.desktop ? 'desktop-only' : ''}`} onClick={() => pickTab(t.id)}>
              <Icon name={t.icon} size={17} />
              <span>
                <b>{t.label}</b>
                <small>{t.hint}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-panel">
          <DesktopNote>Regras de preço, modelo da proposta, mensagens, metas e cores ficam no computador ou tablet.</DesktopNote>
          {tab === 'aparencia' && (
            <>
              {has('identidade') ? (
                <BrandKit />
              ) : (
                <LockedView feature="identidade">
                  <BrandKit />
                </LockedView>
              )}
              <Section title="tema deste aparelho">
                <div className="form-grid">
                  <Field group label="Claro ou escuro" hint="Cada aparelho guarda o seu: o celular pode ficar claro e o computador escuro.">
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
            <Section title="tabela de preços">
              <PriceTable services={s.services} profile={s.workProfile} onChange={(services) => setSettings({ services })} onRestart={() => setSettings({ servicesSetup: false })} />
            </Section>
              <Section title="regras de preço" className="desktop-only">
                <div className="form-grid">
                  <Field label="Taxa de urgência (%)">
                    <input type="number" min={0} value={s.urgencyFee} onChange={(e) => setSettings({ urgencyFee: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Por pavimento a mais (%)" hint="Ex.: 50% → 2 pavimentos = +50%, 3 = +100%. Só nos serviços marcados “encarece por pavimento”.">
                    <input type="number" min={0} value={s.floorFee ?? 50} onFocus={(e) => e.target.select()} onChange={(e) => setSettings({ floorFee: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Arquivo aberto (%)" hint="Interno: somado ao valor quando o cliente quer o arquivo editável. Não aparece no PDF.">
                    <input type="number" min={0} value={s.openFileFee ?? 30} onFocus={(e) => e.target.select()} onChange={(e) => setSettings({ openFileFee: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field label="Desconto para estudantes (%)" hint="Aplicado nas sugestões de valor.">
                    <input type="number" min={0} max={90} value={s.studentDiscount} onChange={(e) => setSettings({ studentDiscount: Number(e.target.value) || 0 })} />
                  </Field>
                  <Field group label="Complexidade (multiplica o m²)" span={3}>
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
              <ProposalChooser />
              {has('propostaPdf') ? <ProposalSettings /> : <LockedView feature="propostaPdf"><ProposalSettings /></LockedView>}
              {s.workProfile !== 'freelancer' && (
                <>
                  <ProcessSettings />
                  {has('propostaPdf') ? <PortfolioSettings /> : <LockedView feature="propostaPdf"><PortfolioSettings /></LockedView>}
                </>
              )}
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

          {tab === 'ia' && has('assistenteIA') && (
            <>
              <Section title="assistente de orçamentos">
                <p className="muted small" style={{ marginTop: 0 }}>
                  O botão <b>✦</b> no canto da tela abre um chat que conhece sua tabela de preços, as plantas com valores, seu processo e seus orçamentos anteriores. Ele usa o
                  Gemini, do Google, com uma chave gratuita sua. Sem chave, o chat leva a pergunta para o Claude (também grátis, copiando e colando).
                </p>
                <div className="form-grid">
                  <Field
                    label="Chave do Gemini"
                    span={3}
                    hint={
                      <>
                        Crie em{' '}
                        <a className="link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                          aistudio.google.com/apikey
                        </a>{' '}
                        (entre com sua conta Google → “Create API key”) e cole aqui. Fica guardada só na sua conta.
                      </>
                    }
                  >
                    <span className="pw-field">
                    <input
                      type="text"
                      className={showKey ? '' : 'secret-input'}
                      name="gemini-api-key"
                      data-lpignore="true"
                      data-1p-ignore
                      autoComplete="off"
                      spellCheck={false}
                      value={s.aiKey ?? ''}
                      onChange={(e) => setSettings({ aiKey: e.target.value.trim() })}
                      placeholder="AIza…"
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        setShowKey((v) => !v)
                      }}
                      aria-label={showKey ? 'Esconder chave' : 'Ver chave'}
                      title={showKey ? 'Esconder chave' : 'Ver chave'}
                    >
                      <Icon name={showKey ? 'eye-off' : 'eye'} size={17} />
                    </button>
                    </span>
                  </Field>
                  <Field
                    label="Minhas regras para a IA"
                    span={3}
                    hint="Escreva como você trabalha e cobra, do seu jeito: a IA segue isso em todas as respostas. Ex.: “detalhamento de marcenaria cobro por quantidade de móveis”, “para arquitetos dou 10% de desconto”."
                  >
                    <textarea rows={6} value={s.aiNotes ?? ''} onChange={(e) => setSettings({ aiNotes: e.target.value })} spellCheck lang="pt-BR" />
                  </Field>
                </div>
                <label className="check toggle">
                  <input type="checkbox" checked={s.aiLowercase !== false} onChange={(e) => setSettings({ aiLowercase: e.target.checked })} /> escrever tudo em letra minúscula (R$ sempre maiúsculo)
                </label>
                <p className="muted small">Vale para o Gemini aqui no chat e para o que for levado ao Claude.</p>
                <label className="check toggle">
                  <input type="checkbox" checked={!!s.aiShareNames} onChange={(e) => setSettings({ aiShareNames: e.target.checked })} /> enviar os nomes dos clientes para a IA
                </label>
                <p className="muted small">Desligado, a IA vê escopos e valores dos orçamentos, mas não os nomes dos clientes.</p>
              </Section>
            </>
          )}

          {tab === 'dados' && (
            <>
              <Section title="seus dados">
                <p className="muted small">Nome, foto, contatos, pix e CPF/CNPJ ficam no <b>perfil do estúdio</b>, junto com a sua conta.</p>
                <a className="btn small" href="#/perfil">
                  <Icon name="user" size={14} /> abrir perfil
                </a>
              </Section>
          <WorkProfileSection />
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
                <Icon name="upload" size={16} /> Importar (backup ou orçamentos)
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
                  onImport(e.target.files?.[0])
                  e.target.value = '' // permite escolher o mesmo arquivo de novo
                }}
              />
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
  const { has } = useAccess()
  const s = data.settings
  const tpl = resolveTemplate(s.proposal, has)
  // cores que a folha usa de verdade; ao editar, o modelo fica fixado nesta conta
  const p = sheetColors(s.proposal, has, s)
  const follow = followsBrand(s.proposal, has, s)
  const setP = (patch: Partial<typeof p>) => setSettings({ proposal: { ...p, ...patch, template: tpl.id } })
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
    <Section title="cores e textos da proposta" className={`desktop-only ${s.proposal.pdfOff ? 'is-dimmed' : ''}`}>
      <div className="proposal-settings">
        <div className="stack">
          <div className="form-grid">
            <Field label="Texto acima do título">
              <input value={p.eyebrow} onChange={(e) => setP({ eyebrow: e.target.value })} />
            </Field>
            <Field label="Título">
              <input value={p.title} onChange={(e) => setP({ title: e.target.value })} />
            </Field>
            {tpl.id !== 'lais' && has('identidade') && (
              <div className="span-3 follow-brand">
                <label className="check toggle">
                  <input type="checkbox" checked={follow} onChange={(e) => setSettings({ proposal: { ...s.proposal, ...(e.target.checked ? {} : { ink: p.ink, rose: p.rose, arch: p.arch, bar: p.bar, paper: p.paper, serif: p.serif, sans: p.sans }), followBrand: e.target.checked, template: tpl.id } })} /> usar as cores e fontes da minha identidade
                </label>
                <p className="muted small">
                  {follow ? (
                    <>
                      Proposta, contrato, documentos e slides seguem o que você escolheu em <b>aparência</b>. Mudou lá, muda aqui.
                    </>
                  ) : (
                    'Desligado: os modelos usam as cores e fontes abaixo, só deles.'
                  )}
                </p>
              </div>
            )}
            {!follow && (
            <>
            <Field label="Fonte dos títulos">
              <select value={p.serif} onChange={(e) => setP({ serif: e.target.value })}>
                {[...(has('fonteExclusiva') ? [EXCLUSIVE_FONT] : []), ...DISPLAY_FONTS.map((f) => f.name)].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Fonte dos textos">
              <select value={p.sans} onChange={(e) => setP({ sans: e.target.value })}>
                {BODY_FONTS.map((f) => (
                  <option key={f.name}>{f.name}</option>
                ))}
              </select>
            </Field>
            </>
            )}
            <Field label="Prazos e cronograma (padrão)" span={3}>
              <textarea className="auto-grow" rows={1} value={p.schedule} onChange={(e) => setP({ schedule: e.target.value.replace(/\n/g, ' ') })} />
            </Field>
            <Field label="Formatos de arquivos entregues (padrão)" span={3}>
              <textarea className="auto-grow" rows={1} value={p.files} onChange={(e) => setP({ files: e.target.value.replace(/\n/g, ' ') })} />
            </Field>
            <Field label="Pagamento (padrão)" span={3} hint="Usado em todo orçamento novo; dá para mudar em cada um.">
              <textarea spellCheck lang="pt-BR" autoCapitalize="sentences" autoCorrect="on" rows={2} value={s.defaultPaymentTerms} onChange={(e) => setSettings({ defaultPaymentTerms: e.target.value })} />
            </Field>
            <Field label="Formas de receber" span={3} hint="Aparecem ao marcar como o cliente pagou cada parcela. Toque no × para tirar uma.">
              <PayMethods list={paymentMethods(s)} onChange={(paymentMethods) => setSettings({ paymentMethods })} />
            </Field>
            <Field className="cfg-card-fee" label="Taxa do cartão de crédito (%)" hint="Quanto a maquininha / Mercado Pago desconta para você receber na hora. Entra como despesa quando o cliente paga no crédito. Confira o valor na sua conta.">
              <input type="number" min={0} max={20} step={0.01} value={s.cardFee ?? DEFAULT_CARD_FEE} onChange={(e) => setSettings({ cardFee: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} />
            </Field>
            {!follow && (
              [
                ['ink', 'Textos'],
                ['rose', 'Rótulos e detalhes'],
                ['arch', 'Faixa do total'],
                ['bar', 'Faixa do topo e ícones'],
                ['paper', 'Fundo'],
              ] as ['ink' | 'rose' | 'arch' | 'paper' | 'bar', string][]
            ).map(([k, label]) => (
              <Field group key={k} label={label}>
                <ColorPicker label={label} value={p[k]} onChange={(hex) => setP({ [k]: hex })} />
              </Field>
            ))}
          </div>
          <p className="muted small">
            A faixa do topo usa seu nome completo; o rodapé usa WhatsApp, Instagram, site e e-mail (em Seus dados).{' '}
            <button className="link" onClick={() => setSettings({ proposal: { ...DEFAULT_PROPOSAL, ...tpl.colors, template: tpl.id, pdfOff: s.proposal.pdfOff, schedule: s.proposal.schedule, files: s.proposal.files } })}>
              restaurar cores e textos do modelo
            </button>
          </p>
        </div>
        <div className="stack-s">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'escopo', label: 'escopo' },
              { value: 'opcoes', label: 'opções' },
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
        Aparecem no botão <b>mensagens</b> do cliente, da demanda e do orçamento, já com os dados preenchidos. No WhatsApp, *palavra* fica em <b>negrito</b> e _palavra_ em <i>itálico</i>: selecione e toque em N ou I. Use as variáveis:{' '}
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
            <MsgEditor value={m.text} onChange={(text) => update(m.id, { text })} />
          </div>
        ))}
      </div>
      <button className="link" onClick={async () => (await ask('Voltar às mensagens padrão originais? As suas edições nas mensagens serão perdidas.', { confirmLabel: 'Restaurar' })) && setSettings({ messages: DEFAULT_MESSAGES })}>
        restaurar mensagens originais
      </button>
    </Section>
  )
}

function MsgEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  return (
    <>
      <MsgTools taRef={ref} value={value} onChange={onChange} />
      <textarea ref={ref} rows={Math.min(12, Math.max(3, value.split('\n').length + 1))} value={value} onChange={(e) => onChange(e.target.value)} spellCheck lang="pt-BR" autoCapitalize="none" autoCorrect="on" />
      <WaPreview text={value} />
    </>
  )
}

/** Escolha do modelo da proposta, PDF ligado/desligado e contratos (vale em qualquer aparelho). */
function ProposalChooser() {
  const { data, setSettings } = useStore()
  const { has } = useAccess()
  const s = data.settings
  const current = resolveTemplate(s.proposal, has)
  const cs = contractSettings(s, has('modeloExclusivo'))
  const pick = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!
    // cada modelo vem com as cores dele; textos e padrões da conta continuam
    setSettings({ proposal: { ...s.proposal, ...t.colors, template: id } })
    toast(`Modelo “${t.name}” aplicado.`)
  }
  const visible = TEMPLATES.filter((t) => t.id !== 'lais' || has('modeloExclusivo'))
  return (
    <Section title="design dos documentos">
      {!has('propostaPdf') && (
        <p className="pf-note">
          <Icon name="lock" size={16} />
          <span>
            No plano {PLANS.essencial.name} o orçamento sai como <b>texto pronto</b> para colar no WhatsApp. Proposta e recibos em PDF, com modelos e a sua identidade, fazem parte do plano{' '}
            <a className="link" href="#/assinatura">
              {PLANS.completo.name}
            </a>
            .
          </span>
        </p>
      )}
      {has('propostaPdf') && (
        <label className="check toggle">
          <input type="checkbox" checked={!s.proposal.pdfOff} onChange={(e) => setSettings({ proposal: { ...s.proposal, pdfOff: !e.target.checked } })} /> usar proposta em PDF
        </label>
      )}
      {has('propostaPdf') && <p className="muted small" style={{ marginTop: 4 }}>
        {s.proposal.pdfOff ? 'Desligado: o orçamento vai só como resumo no WhatsApp (com os valores de cada serviço).' : 'O design escolhido abaixo vale para todos os PDFs: proposta, proposta em slides, guia de medição, placa de obra, briefing em PDF e apresentação de projeto.'}
      </p>}
      {(!has('propostaPdf') || !s.proposal.pdfOff) && (
        <div className={`pf-tpl-grid ${has('propostaPdf') ? '' : 'lk-dim'}`} inert={!has('propostaPdf')}>
          {visible.map((t) => {
            const allowed = templateAllowed(t, has)
            return (
              <button key={t.id} className={`pf-tpl ${current.id === t.id ? 'active' : ''} ${allowed ? '' : 'is-locked'}`} disabled={!allowed} onClick={() => pick(t.id)} title={t.description}>
                <span className={`pf-tpl-thumb tpl-thumb-${t.id}`} style={{ '--t-bar': t.colors.bar, '--t-arch': t.colors.arch, '--t-paper': t.colors.paper, '--t-ink': t.colors.ink } as React.CSSProperties}>
                  <i />
                  <b />
                  <u />
                  <s />
                </span>
                <span className="pf-tpl-name">
                  <b>{t.name}</b>
                  <small className="muted">{allowed ? t.description : 'exclusivo'}</small>
                </span>
                {current.id === t.id && <Icon name="check" size={16} className="pf-tpl-check" />}
                {!allowed && <Icon name="lock" size={14} className="pf-tpl-check" />}
              </button>
            )
          })}
        </div>
      )}
      {!has('contratos') && <p className="pf-note"><Icon name="lock" size={16} /><span>Contratos a partir do orçamento: plano <a className="link" href="#/assinatura">{lockPlan('contratos')}</a>.</span></p>}
      {has('contratos') && (
        <>
          <label className="check toggle">
            <input type="checkbox" checked={!cs.off} onChange={(e) => setSettings({ contracts: { ...cs, off: !e.target.checked } })} /> usar contratos
          </label>
          <p className="muted small" style={{ marginTop: 4 }}>
            {cs.off ? 'Desligado: os contratos somem do menu (nada é apagado).' : 'Contratos a partir do orçamento, com modelos editáveis, no menu “contratos”.'}
          </p>
        </>
      )}
      {!has('instagram') && <p className="pf-note"><Icon name="lock" size={16} /><span>Planejamento do instagram: plano <a className="link" href="#/assinatura">{lockPlan('instagram')}</a>.</span></p>}
      {has('instagram') && (
        <>
          <label className="check toggle">
            <input type="checkbox" checked={!data.settings.instagramOff} onChange={(e) => setSettings({ instagramOff: !e.target.checked })} /> usar o planejamento do instagram
          </label>
          <p className="muted small" style={{ marginTop: 4 }}>
            {data.settings.instagramOff ? 'Desligado: o instagram some do menu e do início (nada é apagado).' : 'Calendário de postagens com artes prontas, no menu “instagram”.'}
          </p>
        </>
      )}
    </Section>
  )
}

/** Lista editável das formas de receber (Pix, transferência…). */
function PayMethods({ list, onChange }: { list: string[]; onChange: (l: string[]) => void }) {
  const [add, setAdd] = useState('')
  const push = () => {
    const v = add.trim()
    if (v && !list.some((m) => m.toLowerCase() === v.toLowerCase())) onChange([...list, v])
    setAdd('')
  }
  return (
    <div className="pay-methods">
      {list.map((m) => (
        <span key={m} className="chip">
          {m}
          {list.length > 1 && (
            <button type="button" className="chip-x" onClick={() => onChange(list.filter((x) => x !== m))} aria-label={`Tirar ${m}`}>
              ×
            </button>
          )}
        </span>
      ))}
      <input id="pay-method-add" value={add} placeholder="+ outra forma (ex.: boleto)" onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), push())} onBlur={push} />
    </div>
  )
}

/** Como a conta trabalha: muda o tipo de cliente que já vem marcado, a ficha e os serviços sugeridos. */
function WorkProfileSection() {
  const { data, setSettings } = useStore()
  const cur = data.settings.workProfile ?? 'freelancer'
  return (
    <Section title="como você trabalha">
      <p className="muted small">Muda o que já vem pronto: o tipo de cliente, a ficha do cliente final (com briefing) e os serviços sugeridos. Nada do que você já cadastrou é apagado.</p>
      <div className="wp-options">
        {WORK_PROFILES.map((w) => (
          <button key={w.value} type="button" className={`wp-option ${cur === w.value ? 'is-on' : ''}`} onClick={() => setSettings({ workProfile: w.value })} aria-pressed={cur === w.value}>
            <b>{w.label}</b>
            <small>{w.hint}</small>
          </button>
        ))}
      </div>
    </Section>
  )
}

