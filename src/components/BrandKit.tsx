import { useRef } from 'react'
import { ColorPicker } from './ColorPicker'
import { useStore, DEFAULT_SETTINGS } from '../store'
import { useAccess } from '../access'
import { Icon } from './Icon'
import { Field, Section } from './ui'
import { toast } from './dialog'
import { AvatarGlyph } from './Avatar'
import { BODY_FONTS, CLIENT_DISPLAY, DISPLAY_FONTS, EXCLUSIVE_FONT, FONT_PAIRS, OWN_FONT, PALETTES, effectiveSettings, paletteToProposal, type Palette } from '../brand'
import { resolveTemplate, followsBrand } from '../proposalTemplates'
import type { Settings } from '../types'

/* Identidade visual do estúdio: paletas prontas, combinações de fontes, cartela de fontes,
   logo e cores personalizadas. Vale para o sistema e (no plano Completo) para os PDFs.
   A The Seasons e a paleta "laís" são exclusivas da dona. */

const COLOR_FIELDS: [keyof Settings, string][] = [
  ['accent', 'Cor principal'],
  ['accentSoft', 'Cor de apoio'],
  ['accentInk', 'Cor dos itálicos'],
  ['background', 'Fundo'],
  ['surface', 'Cartões'],
  ['text', 'Texto'],
]

export function BrandKit() {
  const { data, setSettings } = useStore()
  const { has } = useAccess()
  const raw = data.settings
  const s = effectiveSettings(raw, has) // o que está valendo de verdade
  const pdf = has('propostaPdf')
  const follow = followsBrand(raw.proposal, has, raw)
  const logoRef = useRef<HTMLInputElement>(null)
  const onLogo = (f?: File) => {
    if (!f) return
    if (f.size > 600_000) return toast('Use uma imagem menor que 600 KB.')
    const r = new FileReader()
    r.onload = () => {
      setSettings({ logo: String(r.result) })
      toast('Logotipo aplicado nos modelos.')
    }
    r.readAsDataURL(f)
  }
  const fontRef = useRef<HTMLInputElement>(null)
  const exclusive = has('fonteExclusiva')
  const tpl = resolveTemplate(raw.proposal, has)

  // seguindo a identidade, os modelos acompanham sozinhos; aqui só muda o sistema
  const withProposal = (patch: Partial<Settings>, _proposal: Partial<Settings['proposal']>): Partial<Settings> => patch

  const pickPalette = (p: Palette) => {
    const colors = { accent: p.accent, accentSoft: p.accentSoft, accentInk: p.accentInk, background: p.background, surface: p.surface, text: p.text }
    setSettings(withProposal(colors, paletteToProposal(p)))
    toast(`Paleta “${p.name}” aplicada${pdf && follow ? ' no sistema e nos modelos' : ''}.`)
  }
  const pickDisplay = (name: string) => setSettings(withProposal({ displayFont: name }, { serif: name }))
  const pickBody = (name: string) => setSettings(withProposal({ bodyFont: name }, { sans: name }))
  const pickPair = (d: string, b: string) => {
    setSettings(withProposal({ displayFont: d, bodyFont: b }, { serif: d, sans: b }))
    toast(`Fontes ${d} + ${b} aplicadas.`)
  }

  const onFont = (f?: File) => {
    if (!f) return
    if (f.size > 900_000) return toast('Arquivo de fonte muito grande (máx. 900 KB). Prefira .woff2 ou .woff.')
    const r = new FileReader()
    r.onload = () => {
      // a dona continua com a The Seasons; clientes registram o arquivo como "Minha fonte"
      const name = exclusive ? EXCLUSIVE_FONT : OWN_FONT
      setSettings({ customFont: String(r.result), displayFont: name })
      toast('Sua fonte foi aplicada aos títulos.')
    }
    r.readAsDataURL(f)
  }

  const palettes = PALETTES.filter((p) => !p.owner || exclusive)
  const displays = [...(exclusive ? [{ name: EXCLUSIVE_FONT, mood: 'sua fonte exclusiva' }] : []), ...(raw.customFont && !exclusive ? [{ name: OWN_FONT, mood: 'arquivo enviado por você' }] : []), ...DISPLAY_FONTS]
  const same = (p: Palette) => p.accent === s.accent && p.accentSoft === s.accentSoft && p.background === s.background

  return (
    <Section title="identidade visual">
      <p className="muted small">
        Escolha uma paleta e uma combinação de fontes prontas, ou monte a sua. Seu logo, nome e contatos ficam no{' '}
        <a href="#/perfil" className="link">
          perfil
        </a>
        . Tudo vale só para a sua conta.
      </p>
      {pdf && tpl.id !== 'lais' && (
        <label className="check toggle">
          <input type="checkbox" checked={follow} onChange={(e) => setSettings({ proposal: { ...raw.proposal, followBrand: e.target.checked, template: tpl.id } })} /> os modelos (proposta, contrato, documentos e slides) usam estas cores e fontes
        </label>
      )}

      <h4 className="bk-sub">seu logo</h4>
      <div className="bk-logo">
        {raw.logo ? <img src={raw.logo} alt="Seu logo" /> : <span className="profile-chip-avatar"><AvatarGlyph s={raw} size={22} /></span>}
        <button type="button" className="btn small" onClick={() => logoRef.current?.click()}>
          <Icon name="upload" size={14} /> {raw.logo ? 'trocar logotipo' : 'anexar logotipo'}
        </button>
        {raw.logo && (
          <button type="button" className="link small" onClick={() => setSettings({ logo: '' })}>
            tirar
          </button>
        )}
        <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => (onLogo(e.target.files?.[0]), (e.target.value = ''))} />
        {pdf && raw.logo && tpl.id !== 'lais' && (
          <label className="check">
            <input type="checkbox" checked={raw.proposal.showLogo !== false} onChange={(e) => setSettings({ proposal: { ...raw.proposal, showLogo: e.target.checked } })} /> mostrar o logotipo em todos os modelos
          </label>
        )}
      </div>

      <h4 className="bk-sub">paletas prontas</h4>
      <div className="bk-grid">
        {palettes.map((p) => (
          <button key={p.name} className={`bk-palette ${same(p) ? 'active' : ''}`} onClick={() => pickPalette(p)}>
            <span className="bk-swatch" style={{ background: p.background }}>
              <i style={{ background: p.accent }} />
              <i style={{ background: p.accentSoft }} />
              <i style={{ background: p.background }} />
            </span>
            {p.name}
          </button>
        ))}
      </div>

      <h4 className="bk-sub">combinações de fontes</h4>
      <div className="bk-fonts">
        {FONT_PAIRS.map((p) => (
          <button key={p.name} className={`bk-font ${s.displayFont === p.display && s.bodyFont === p.body ? 'active' : ''}`} onClick={() => pickPair(p.display, p.body)}>
            <span className="bk-font-sample" style={{ fontFamily: `'${p.display}'` }}>
              {p.name}
            </span>
            <span className="bk-pair-body" style={{ fontFamily: `'${p.body}'` }}>
              texto do seu estúdio
            </span>
            <small>
              {p.display} + {p.body}
            </small>
          </button>
        ))}
      </div>

      <h4 className="bk-sub">fonte dos títulos (itálicos)</h4>
      <div className="bk-fonts">
        {displays.map((f) => (
          <button key={f.name} className={`bk-font ${s.displayFont === f.name ? 'active' : ''}`} onClick={() => pickDisplay(f.name)}>
            <span className="bk-font-sample" style={{ fontFamily: `'${f.name}'` }}>
              você projeta
            </span>
            <small>
              {f.name} · {f.mood}
            </small>
          </button>
        ))}
      </div>
      <div className="row gap-s wrap">
        <button className="btn small" onClick={() => fontRef.current?.click()}>
          <Icon name="upload" size={14} /> {raw.customFont ? 'trocar arquivo de fonte' : 'usar uma fonte minha (arquivo)'}
        </button>
        {raw.customFont && (
          <button className="btn small ghost" onClick={() => setSettings({ customFont: '', displayFont: exclusive ? EXCLUSIVE_FONT : CLIENT_DISPLAY })}>
            remover arquivo
          </button>
        )}
        <input ref={fontRef} type="file" accept=".otf,.ttf,.woff,.woff2,font/*" hidden onChange={(e) => onFont(e.target.files?.[0])} />
      </div>
      <p className="muted small">Use só fontes que você tem licença para usar no seu negócio.</p>

      <h4 className="bk-sub">fonte do texto</h4>
      <div className="bk-fonts">
        {BODY_FONTS.map((f) => (
          <button key={f.name} className={`bk-font ${s.bodyFont === f.name ? 'active' : ''}`} onClick={() => pickBody(f.name)}>
            <span className="bk-font-sample is-body" style={{ fontFamily: `'${f.name}'` }}>
              Aa 123 R$
            </span>
            <small>
              {f.name} · {f.mood}
            </small>
          </button>
        ))}
      </div>

      <h4 className="bk-sub">cores personalizadas</h4>
      <div className="form-grid">
        {COLOR_FIELDS.map(([k, label]) => (
          <Field group key={k} label={label}>
            <ColorPicker label={label} value={raw[k] as string} onChange={(hex) => setSettings({ [k]: hex })} />
          </Field>
        ))}
        <Field label={`Cantos arredondados · ${raw.radius}px`}>
          <input type="range" min={0} max={20} value={raw.radius} onChange={(e) => setSettings({ radius: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="row gap-s">
        <button
          className="btn small ghost"
          onClick={() => {
            const base = exclusive ? PALETTES[0] : PALETTES.find((p) => p.name === 'areia & carvão')!
            setSettings({
              accent: base.accent,
              accentSoft: base.accentSoft,
              accentInk: base.accentInk,
              background: base.background,
              surface: base.surface,
              text: base.text,
              displayFont: exclusive ? DEFAULT_SETTINGS.displayFont : CLIENT_DISPLAY,
              bodyFont: DEFAULT_SETTINGS.bodyFont,
              radius: DEFAULT_SETTINGS.radius,
            })
          }}
        >
          restaurar padrão
        </button>
      </div>
    </Section>
  )
}
