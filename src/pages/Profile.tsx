import { useRef, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { CLOUD, supabase } from '../cloud'
import { signOut } from '../components/Auth'
import { Icon } from '../components/Icon'
import { EmailInput, Field, PhoneInput, Section } from '../components/ui'
import { toast } from '../components/dialog'
import type { Settings } from '../types'
import { atHandle, cleanSite } from '../utils'

/* Perfil do estúdio: quem você é, como aparece nas propostas e recibos, e a sua conta. */

const CHECK: [keyof Settings, string][] = [
  ['brandName', 'nome da marca'],
  ['legalName', 'nome completo'],
  ['ownerName', 'como te chamo'],
  ['phone', 'whatsapp'],
  ['email', 'e-mail'],
  ['pixKey', 'chave pix'],
  ['instagram', 'instagram'],
  ['logo', 'foto ou logo'],
]

export const profileMissing = (s: Settings) => CHECK.filter(([k]) => !String(s[k] ?? '').trim()).map(([, l]) => l)

export function initials(s: Settings) {
  const base = (s.ownerName || s.legalName || s.brandName || '?').trim()
  const parts = base.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export default function Profile() {
  const { data, setSettings, userEmail } = useStore()
  const s = data.settings
  const set = (patch: Partial<Settings>) => setSettings(patch)
  const logoRef = useRef<HTMLInputElement>(null)
  const missing = profileMissing(s)
  const done = CHECK.length - missing.length
  const pct = Math.round((done / CHECK.length) * 100)

  const onLogo = (f?: File) => {
    if (!f) return
    if (f.size > 600_000) return toast('Use uma imagem menor que 600 KB.')
    const r = new FileReader()
    r.onload = () => set({ logo: String(r.result) })
    r.readAsDataURL(f)
  }

  const contacts = [s.phone, atHandle(s.instagram), cleanSite(s.website), s.email].filter((x) => x.trim())

  return (
    <div className="page profile">
      <div className="page-head">
        <div>
          <p className="eyebrow">sua conta</p>
          <h1>
            perfil <em>do estúdio</em>
          </h1>
        </div>
      </div>

      <section className="card profile-hero">
        <div className="profile-avatar-col">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar" onClick={() => logoRef.current?.click()} title="Trocar foto">
              {s.logo ? <img src={s.logo} alt="" /> : <Icon name="user" size={38} />}
            </div>
            <button type="button" className="profile-avatar-badge" onClick={() => logoRef.current?.click()} aria-label={s.logo ? 'Trocar foto' : 'Enviar foto'} title={s.logo ? 'Trocar foto' : 'Enviar foto'}>
              <Icon name={s.logo ? 'edit' : 'plus'} size={15} />
            </button>
          </div>
          <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
          {s.logo && (
            <button className="link profile-remove" onClick={() => set({ logo: '' })}>
              remover foto
            </button>
          )}
        </div>
        <div className="grow">
          <h2 className="profile-name">
            {s.brandName.replace(/\.$/, '') || 'seu estúdio'}
            <i>.</i>
          </h2>
          {s.tagline && <p className="profile-tag">{s.tagline}</p>}
          <p className="muted small">
            {s.legalName || 'Nome completo não preenchido'}
            {s.city ? ` · ${s.city}` : ''}
            {userEmail ? ` · entra com ${userEmail}` : ''}
          </p>
        </div>
        <div className="profile-progress">
          <div className="profile-ring" style={{ ['--pct' as string]: `${pct}%` }}>
            <span>{pct}%</span>
          </div>
          <span className="small muted">{missing.length ? `falta: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}` : 'perfil completo'}</span>
        </div>
      </section>

      <div className="grid-2 is-even">
        <Section title="o estúdio">
          <div className="form-grid two">
            <Field label="Nome da marca" hint="Aparece no menu e na proposta.">
              <input value={s.brandName} onChange={(e) => set({ brandName: e.target.value })} placeholder="Ex.: laís" />
            </Field>
            <Field label="Especialidade / slogan">
              <input value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="Ex.: renderização · modelagem · detalhamento" />
            </Field>
            <Field label="Nome completo" hint="Vai no topo da proposta e no recibo.">
              <input value={s.legalName} onChange={(e) => set({ legalName: e.target.value })} />
            </Field>
            <Field label="Como te chamo" hint="Usado no “bom dia” e nas mensagens.">
              <input value={s.ownerName} onChange={(e) => set({ ownerName: e.target.value })} />
            </Field>
            <Field label="CPF / CNPJ" hint="Só aparece no recibo.">
              <input value={s.document} onChange={(e) => set({ document: e.target.value })} inputMode="numeric" />
            </Field>
            <Field label="Cidade">
              <input value={s.city} onChange={(e) => set({ city: e.target.value })} />
            </Field>
            <Field label="Foto ou logo" span={2} hint="Aparece redonda no canto do menu. JPG ou PNG, até 600 KB.">
              <div className="row gap-s">
                {s.logo ? <img src={s.logo} alt="" className="photo-preview" /> : <span className="muted small">Sem foto.</span>}
                <button className="btn small" onClick={() => logoRef.current?.click()}>
                  <Icon name="upload" size={14} /> {s.logo ? 'Trocar' : 'Enviar'}
                </button>
                {s.logo && (
                  <button className="btn small ghost" onClick={() => set({ logo: '' })}>
                    <Icon name="trash" size={14} /> Remover foto
                  </button>
                )}
              </div>
            </Field>
          </div>
        </Section>

        <div className="stack">
          <Section title="contato e recebimento">
            <p className="muted small" style={{ marginTop: 0 }}>
              WhatsApp, e-mail, Instagram e site vão <b>automaticamente para o rodapé da proposta</b>. Deixe em branco o que não quiser mostrar.
            </p>
            <div className="form-grid two">
              <Field label="WhatsApp">
                <PhoneInput id="profile-phone" value={s.phone} onChange={(v) => set({ phone: v })} placeholder="+55 11 99999-9999" />
              </Field>
              <Field label="E-mail de contato">
                <EmailInput id="profile-email" value={s.email} onChange={(v) => set({ email: v })} />
              </Field>
              <Field label="Instagram">
                <input value={s.instagram} onChange={(e) => set({ instagram: e.target.value })} onBlur={() => s.instagram.trim() && set({ instagram: atHandle(s.instagram) })} placeholder="@seuperfil" />
              </Field>
              <Field label="Site">
                <input value={s.website} onChange={(e) => set({ website: e.target.value })} placeholder="seusite.com.br" />
              </Field>
              <Field label="Chave pix" span={2} hint="Não vai no PDF; entra sozinha nas mensagens de cobrança.">
                <input value={s.pixKey} onChange={(e) => set({ pixKey: e.target.value })} />
              </Field>
            </div>
          </Section>

          <Section title="assim aparece na proposta">
            <div className="profile-preview">
              <div className="pp-bar">
                <span>{(s.legalName || s.ownerName || s.brandName || 'seu nome').toUpperCase()}</span>
                <span>{new Date().getFullYear()}</span>
              </div>
              <div className="pp-body">
                <span className="pp-title">orçamento</span>
                <div className="pp-lines">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="pp-foot">{contacts.length ? contacts.join('   ·   ') : 'preencha seus contatos para aparecerem aqui'}</div>
            </div>
          </Section>
        </div>
      </div>

      <AccountSection email={userEmail} />
    </div>
  )
}

function AccountSection({ email }: { email: string }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const change = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) return toast('Use pelo menos 8 caracteres.')
    if (pw !== pw2) return toast('As duas senhas não são iguais.')
    setBusy(true)
    const { error } = await supabase!.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return toast('Não foi possível trocar a senha agora. Tente de novo.')
    setPw('')
    setPw2('')
    toast('Senha alterada.')
  }
  return (
    <Section title="conta e segurança">
      {CLOUD ? (
        <div className="account-grid">
          <div>
            <span className="field-label">e-mail de login</span>
            <p className="account-email">{email}</p>
            <p className="muted small">Seus dados ficam guardados na nuvem, protegidos por este login, e aparecem iguais no computador e no celular.</p>
            <button className="btn ghost small" onClick={() => signOut()}>
              <Icon name="x" size={14} /> sair desta conta
            </button>
          </div>
          <form className="stack" onSubmit={change}>
            <span className="field-label">trocar senha</span>
            <input type="password" autoComplete="new-password" placeholder="nova senha (mín. 8 caracteres)" value={pw} onChange={(e) => setPw(e.target.value)} />
            <input type="password" autoComplete="new-password" placeholder="repita a nova senha" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <button className="btn small" disabled={busy || !pw}>
              {busy ? 'salvando…' : 'salvar nova senha'}
            </button>
          </form>
        </div>
      ) : (
        <p className="muted small">Nesta versão os dados ficam só neste navegador. Use o site com login para sincronizar entre aparelhos.</p>
      )}
    </Section>
  )
}
