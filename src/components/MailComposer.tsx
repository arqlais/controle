import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { Field, Section } from './ui'
import { ask, toast } from './dialog'
import { askGemini } from './AIChat'
import { useStore } from '../store'
import { NEWS } from '../news'
import { PLATFORM, TRIAL_DAYS } from '../plans'
import { platform, type Subscription } from '../platform'
import { uid } from '../utils'

/* E-mails da dona para quem usa o planê: temas prontos (sem custo), texto livre e,
   se ela tiver a chave do Gemini, a IA melhora o texto. O envio passa pela função "avisos". */

type Para = 'todos' | 'teste' | 'assinantes' | 'saiu'
interface Draft {
  subject: string
  eyebrow: string
  title: string
  text: string
  button: string
  para: Para
  link?: LinkId // para onde o botão leva
}

/** Para onde o botão do e-mail leva (a IA escolhe pelo texto; dá para trocar). */
type LinkId = 'inicio' | 'avaliar' | 'sugestoes' | 'assinatura' | 'indique' | 'orcamento' | 'manual'
const LINKS: { id: LinkId; label: string; hash: string; hint: string }[] = [
  { id: 'inicio', label: 'início do planê', hash: '', hint: 'abrir o sistema, novidades, voltar a usar' },
  { id: 'avaliar', label: 'dar feedback / avaliar', hash: '#/avaliar', hint: 'opinião, avaliação, depoimento' },
  { id: 'sugestoes', label: 'sugestões', hash: '#/sugestoes', hint: 'pedir ideias, sugerir funções' },
  { id: 'assinatura', label: 'planos e assinatura', hash: '#/assinatura', hint: 'assinar, fim do teste, preço de fundador' },
  { id: 'indique', label: 'indique e ganhe', hash: '#/indique', hint: 'indicar amigas' },
  { id: 'orcamento', label: 'novo orçamento', hash: '#/orcamentos/novo', hint: 'dica de uso de orçamento' },
  { id: 'manual', label: 'manual', hash: '#/manual', hint: 'tutorial, como usar' },
]
const linkUrl = (id?: LinkId) => `${PLATFORM.url.replace(/\/$/, '')}/${LINKS.find((l) => l.id === id)?.hash ?? ''}`.replace(/\/$/, '')


const PARA: { id: Para; label: string; who: (s: Subscription) => boolean }[] = [
  { id: 'todos', label: 'todos (teste e assinantes)', who: (s) => s.status !== 'cancelada' && !s.blocked },
  { id: 'teste', label: 'só quem está testando', who: (s) => s.status === 'trial' && !s.blocked },
  { id: 'assinantes', label: 'só assinantes', who: (s) => (s.status === 'ativa' || s.status === 'atrasada') && !s.blocked },
  { id: 'saiu', label: 'quem cancelou', who: (s) => s.status === 'cancelada' },
]

const news = NEWS[0]
const THEMES: { id: string; label: string; draft: Draft }[] = [
  {
    id: 'novidade',
    label: 'novidade',
    draft: {
      subject: `Novidade no planê: ${news?.title ?? ''}`,
      eyebrow: 'novidade',
      title: news?.title ?? 'Tem novidade no planê',
      text: `Oi, {nome}!\n\n${news?.text ?? ''}\n\nQualquer dúvida, é só chamar no chat dentro do planê.`,
      button: 'ver no planê', link: 'inicio',
      para: 'todos',
    },
  },
  {
    id: 'dica',
    label: 'dica de uso',
    draft: {
      subject: 'Dica rápida: seu orçamento em 2 minutos',
      eyebrow: 'dica',
      title: 'Orçamento pronto em 2 minutos',
      text: 'Oi, {nome}!\n\nSabia que o orçamento do planê já calcula o valor pelo seu jeito de cobrar (por hora, m², unidade ou pacote)? Você escolhe o cliente e os serviços, e a proposta em PDF sai com a sua marca, pronta para enviar.\n\nDepois de aprovado, o contrato já vem preenchido com os dados do orçamento.',
      button: 'fazer um orçamento', link: 'orcamento',
      para: 'todos',
    },
  },
  {
    id: 'teste',
    label: 'teste acabando',
    draft: {
      subject: 'Seu teste do planê está acabando',
      eyebrow: 'teste grátis',
      title: 'Seu teste está chegando ao fim',
      text: `Oi, {nome}!\n\nSeu teste grátis de ${TRIAL_DAYS} dias está acabando. Tudo o que você criou continua guardado: clientes, orçamentos, contratos e financeiro.\n\nAssinando agora, você garante o **preço de fundador** por 12 meses, no Pix ou no cartão, sem fidelidade.`,
      button: 'escolher meu plano', link: 'assinatura',
      para: 'teste',
    },
  },
  {
    id: 'fundador',
    label: 'preço de fundador',
    draft: {
      subject: 'Preço de fundador: aproveite antes do reajuste',
      eyebrow: 'preço de fundador',
      title: 'Garanta o valor de lançamento',
      text: 'Oi, {nome}!\n\nQuem assina agora mantém o **preço de fundador por 12 meses**, mesmo quando a tabela mudar. É a forma de agradecer quem acreditou no planê desde o começo.\n\nSem fidelidade: dá para cancelar quando quiser.',
      button: 'assinar agora', link: 'assinatura',
      para: 'teste',
    },
  },
  {
    id: 'opiniao',
    label: 'pedir opinião',
    draft: {
      subject: 'Me conta: o que você achou do planê?',
      eyebrow: 'sua opinião',
      title: 'Posso te pedir 1 minutinho?',
      text: 'Oi, {nome}!\n\nO planê está crescendo junto com quem usa, e a sua opinião faz muita diferença. O que está funcionando bem? O que poderia ser mais fácil?\n\nÉ só responder pelo chat dentro do sistema ou deixar uma sugestão no menu **sugestões**.',
      button: 'mandar minha opinião', link: 'avaliar',
      para: 'todos',
    },
  },
  {
    id: 'depoimento',
    label: 'pedir depoimento',
    draft: {
      subject: 'Seu depoimento pode ajudar outras profissionais',
      eyebrow: 'depoimento',
      title: 'O planê te ajudou?',
      text: 'Oi, {nome}!\n\nSe o planê tem deixado a sua rotina mais leve, um depoimento seu ajuda muito outras arquitetas, designers e freelancers a conhecerem o sistema.\n\nLeva menos de 1 minuto, no menu **deixar depoimento**.',
      button: 'deixar meu depoimento', link: 'avaliar',
      para: 'assinantes',
    },
  },
  {
    id: 'volta',
    label: 'convidar de volta',
    draft: {
      subject: 'Sentimos sua falta no planê',
      eyebrow: 'volta?',
      title: 'Seus dados continuam guardados',
      text: 'Oi, {nome}!\n\nDesde que você saiu, o planê ganhou várias novidades: nome e marca novos, endereço próprio (useplane.com.br) e muitos ajustes que vocês pediram.\n\nSeus clientes, orçamentos e documentos continuam guardados. Se quiser voltar, é só entrar com o mesmo e-mail.',
      button: 'voltar para o planê', link: 'inicio',
      para: 'saiu',
    },
  },
  {
    id: 'aviso',
    label: 'aviso',
    draft: {
      subject: 'Aviso rápido do planê',
      eyebrow: 'aviso',
      title: 'Um aviso rapidinho',
      text: 'Oi, {nome}!\n\nEscreva aqui o aviso (ex.: manutenção programada, mudança de horário do atendimento).',
      button: '',
      para: 'todos',
    },
  },
  { id: 'livre', label: 'escrever do zero', draft: { subject: '', eyebrow: 'planê', title: '', text: 'Oi, {nome}!\n\n', button: 'abrir o planê', para: 'todos' } },
]

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const rich = (t: string) =>
  esc(t)
    .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, '<b>$1</b>')
    .replace(/__(?=\S)([^\n]*?\S)__/g, '<u>$1</u>')
    .replace(/\n/g, '<br>')
const fill = (t: string, nome: string) => t.replace(/\{nome\}/g, nome).replace(/,\s*!/g, '!')

/** Mesmo visual dos e-mails que saem da função "avisos". */
function previewHtml(d: Draft, nome: string) {
  const text = fill(d.text, nome)
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 12px;">${rich(p.trim())}</p>`)
    .join('')
  const btn = d.button ? `<a style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:999px;background:#3e4b57;">${esc(d.button)}</a>` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f3eae6;font-family:Poppins,Helvetica,Arial,sans-serif;color:#3e4b57}</style></head><body>
<div style="padding:28px 12px"><div style="max-width:520px;margin:0 auto">
<div style="padding:0 8px 18px;display:flex;align-items:center;gap:10px"><img src="${import.meta.env.BASE_URL}icon-192.png" width="40" height="40" style="border-radius:10px"><span style="font-size:22px;font-weight:600">Planê</span></div>
<div style="background:#fff;border-radius:22px;padding:32px 28px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#a88a80">${esc(d.eyebrow || 'planê')}</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#3e4b57">${esc(fill(d.title, nome))}</h1>
<div style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5b6670">${text}</div>${btn}</div>
<p style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#a88a80;text-align:center">planê · gestão leve para quem vive de projeto</p>
</div></div></body></html>`
}

/** A IA escreve ou melhora o e-mail (chave do Gemini da própria dona). */
async function improve(key: string, d: Draft, theme: string, idea: string): Promise<Partial<Draft>> {
  const system = `Você escreve e-mails de ${PLATFORM.owner}, criadora do ${PLATFORM.name} (${PLATFORM.tagline}), para quem usa o sistema: arquitetas, designers de interiores, escritórios e freelancers de projeto.
Regras:
- Português do Brasil, sempre muito amigável, gentil e carinhoso, como uma conversa com alguém querido: frases curtas, leves e diretas. Agradeça e valorize a pessoa quando couber. Nada de exageros nem promessas que o texto original não faz.
- Comece com "Oi, {nome}!" (mantenha {nome} exatamente assim, ele vira o nome da pessoa).
- 2 a 4 parágrafos curtos, separados por linha em branco. Pode usar **negrito** em 1 ou 2 trechos importantes. Sem títulos nem listas longas.
- Emojis pontuais: de 1 a 3 no e-mail inteiro, delicados e combinando com o assunto (ex.: 🤍 ✨ 💛 ☺️ 📐), nunca um em cada frase. No assunto, no máximo 1.
- Nunca invente preço, prazo ou função. Use só o que estiver no rascunho ou na ideia.
- Assunto com até 60 caracteres que desperte curiosidade e dê vontade de abrir (pergunta, novidade pela metade, benefício concreto), sem cara de spam: nada de TUDO EM MAIÚSCULAS, "urgente", "grátis!!!" nem promessa falsa.
- Legenda (eyebrow): 1 ou 2 palavras em minúsculas que resumem o tema (ex.: novidade, dica, sua opinião).
- Título com até 50 caracteres. Botão com até 3 palavras, em minúsculas, com a ação que o texto pede (ex.: "dar meu feedback", "ver a novidade").
- "link": para onde o botão leva, combinando com o que o texto pede. Use um destes: ${LINKS.map((l) => `${l.id} (${l.hint})`).join('; ')}.
Responda só com JSON: {"subject":"…","eyebrow":"…","title":"…","text":"…","button":"…","link":"…"}`
  const prompt = `Tema: ${theme}.\n${idea.trim() ? `O que eu quero dizer: ${idea.trim()}\n` : ''}Rascunho atual:\nAssunto: ${d.subject}\nTítulo: ${d.title}\nTexto:\n${d.text}\nBotão: ${d.button}\n\n${d.text.replace(/oi,?\s*\{nome\}!?/i, '').trim() ? 'Melhore este e-mail.' : 'Escreva este e-mail.'}`
  const out = await askGemini(key, system, [{ role: 'user', text: prompt }])
  const m = out.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('resposta sem JSON')
  const j = JSON.parse(m[0]) as Partial<Draft>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined)
  const link = LINKS.find((l) => l.id === str((j as { link?: string }).link))?.id
  return { subject: str(j.subject), eyebrow: str(j.eyebrow), title: str(j.title), text: str(j.text), button: str(j.button), link }
}

/* rascunhos: o que está sendo escrito fica guardado sozinho neste aparelho, e dá para salvar vários */
const NOW_KEY = 'plane-email-atual'
const DRAFTS_KEY = 'plane-email-rascunhos'
interface Saved {
  id: string
  savedAt: string
  theme: string
  idea: string
  d: Draft
}
const load = <T,>(k: string, fb: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : fb
  } catch {
    return fb
  }
}
const keep = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sem espaço ou bloqueado: segue sem guardar */
  }
}

export function MailComposer({ subs, onSent }: { subs: Subscription[]; onSent: () => void }) {
  const { data } = useStore()
  const aiKey = data.settings.aiKey
  const now = load<Omit<Saved, 'id' | 'savedAt'> | null>(NOW_KEY, null)
  const [theme, setTheme] = useState(now?.theme ?? THEMES[0].id)
  const [d, setD] = useState<Draft>(now?.d ?? THEMES[0].draft)
  const [idea, setIdea] = useState(now?.idea ?? '')
  const [drafts, setDrafts] = useState<Saved[]>(() => load<Saved[]>(DRAFTS_KEY, []))
  useEffect(() => keep(NOW_KEY, { theme, idea, d }), [theme, idea, d])
  const saveDrafts = (list: Saved[]) => (setDrafts(list), keep(DRAFTS_KEY, list))
  const saveDraft = () => {
    const same = drafts.find((x) => x.d.subject === d.subject)
    const item: Saved = { id: same?.id ?? uid(), savedAt: new Date().toISOString(), theme, idea, d }
    saveDrafts([item, ...drafts.filter((x) => x.id !== item.id)].slice(0, 30))
    toast('Rascunho salvo.')
  }
  const openDraft = (x: Saved) => (setTheme(x.theme), setD(x.d), setIdea(x.idea))
  const [busy, setBusy] = useState('')
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const reach = useMemo(() => subs.filter(PARA.find((p) => p.id === d.para)!.who).length, [subs, d.para])
  const html = useMemo(() => previewHtml(d, 'Ana'), [d])
  const ready = d.subject.trim() && d.title.trim() && d.text.trim()

  const pick = (id: string) => {
    setTheme(id)
    setD(THEMES.find((t) => t.id === id)!.draft)
  }
  // limpar texto e legendas de uma vez (a IA escreve do zero, sem misturar com o que estava escrito)
  const clear = async () => {
    if ((d.subject.trim() || d.title.trim() || d.text.replace(/oi,?\s*\{nome\}!?/i, '').trim()) && !(await ask('Limpar assunto, legenda, título, texto e botão?', { confirmLabel: 'Limpar' }))) return
    setD((x) => ({ ...x, subject: '', eyebrow: '', title: '', text: '', button: '', link: 'inicio' }))
    toast('Limpo. Escreva a ideia e toque em “escrever com IA”.')
  }
  const runAI = async () => {
    if (!aiKey) return toast('Para a IA escrever, coloque sua chave do Gemini em configurações → assistente.')
    setBusy('ia')
    try {
      const r = await improve(aiKey, d, THEMES.find((t) => t.id === theme)!.label, idea)
      setD((x) => ({ ...x, subject: r.subject || x.subject, eyebrow: r.eyebrow || x.eyebrow, title: r.title || x.title, text: r.text || x.text, button: r.button ?? x.button, link: r.link ?? x.link }))
      toast('Pronto! Confira e ajuste o que quiser.')
    } catch {
      toast('A IA não respondeu agora. Tente de novo em instantes.')
    }
    setBusy('')
  }
  const send = async (teste: boolean) => {
    if (!teste && !(await ask(`Mandar “${d.subject}” para ${reach} pessoa(s)?`, { confirmLabel: 'Mandar' }))) return
    setBusy(teste ? 'teste' : 'envio')
    try {
      const { link, ...rest } = d
      const r = await platform.notice({ tipo: 'campanha', ...rest, url: linkUrl(link), subject: d.subject.trim(), title: d.title.trim(), text: d.text.trim(), teste })
      if (r.erro) toast(`Não foi: ${r.erro}`)
      else toast(teste ? 'Teste enviado para o seu e-mail.' : `Enviado para ${r.enviados ?? 0} pessoa(s).`)
      if (!teste) onSent()
    } catch (e) {
      // o motivo de verdade (ex.: "tipo desconhecido" = a função avisos ainda é a versão antiga)
      const why = e instanceof Error ? e.message : ''
      toast(/tipo desconhecido/.test(why) ? 'A função “avisos” do Supabase ainda é a antiga: publique a versão nova (passo a passo no chat com o Claude).' : `Não foi possível mandar${why ? `: ${why}` : '.'}`)
    }
    setBusy('')
  }

  return (
    <Section title="escrever um e-mail">
      <p className="muted small">Escolha um tema pronto ou escreva do zero. {'{nome}'} vira o primeiro nome de cada pessoa. Use **negrito** para destacar.</p>
      {drafts.length > 0 && (
        <div className="mc-drafts">
          <span className="muted small">rascunhos salvos</span>
          {drafts.map((x) => (
            <span key={x.id} className="mc-draft">
              <button type="button" onClick={() => openDraft(x)} title={`salvo em ${new Date(x.savedAt).toLocaleString('pt-BR')}`}>
                <Icon name="file" size={13} /> {x.d.subject || x.d.title || 'sem assunto'}
              </button>
              <button type="button" className="mc-draft-x" aria-label="apagar rascunho" onClick={async () => (await ask(`Apagar o rascunho “${x.d.subject || 'sem assunto'}”?`, { confirmLabel: 'Apagar' })) && saveDrafts(drafts.filter((y) => y.id !== x.id))}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mc-themes">
        {THEMES.map((t) => (
          <button key={t.id} type="button" className={`mc-theme ${theme === t.id ? 'is-on' : ''}`} onClick={() => pick(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mc-grid">
        <div className="mc-form">
          <Field label="Para quem">
            <select value={d.para} onChange={(e) => set({ para: e.target.value as Para })}>
              {PARA.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {subs.filter(p.who).length}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assunto">
            <input value={d.subject} onChange={(e) => set({ subject: e.target.value })} maxLength={150} />
          </Field>
          <Field label="Legenda" hint="A palavrinha acima do título (ex.: novidade, dica).">
            <input value={d.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} maxLength={40} />
          </Field>
          <Field label="Título dentro do e-mail">
            <input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={150} />
          </Field>
          <Field label="Texto" hint="Linha em branco = novo parágrafo.">
            <textarea rows={9} value={d.text} onChange={(e) => set({ text: e.target.value })} spellCheck lang="pt-BR" />
          </Field>
          <Field label="Botão" hint="Deixe vazio para não ter botão.">
            <input value={d.button} onChange={(e) => set({ button: e.target.value })} maxLength={40} />
          </Field>
          {d.button.trim() && (
            <Field label="O botão leva para">
              <select value={d.link ?? 'inicio'} onChange={(e) => set({ link: e.target.value as LinkId })}>
                {LINKS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="mc-ai">
            <Field label="Ideia para a IA (opcional)" hint="Ex.: avisar que agora dá para assinar o contrato pelo link, tom animado.">
              <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="o que você quer dizer, do seu jeito" />
            </Field>
            <button className="btn" disabled={!!busy} onClick={() => void runAI()} title={aiKey ? 'A IA escreve ou melhora o texto. Você confere antes de mandar.' : 'Coloque sua chave do Gemini em configurações → assistente'}>
              <Icon name="sparkle" size={15} /> {busy === 'ia' ? 'escrevendo…' : d.text.replace(/oi,?\s*\{nome\}!?/i, '').trim() ? 'melhorar com IA' : 'escrever com IA'}
            </button>
            <button className="btn ghost" disabled={!!busy} onClick={() => void clear()} title="Apaga assunto, legenda, título, texto e botão para a IA escrever do zero">
              <Icon name="trash" size={15} /> limpar
            </button>
          </div>
        </div>
        <div className="mc-preview">
          <span className="muted small">prévia (com o nome “Ana”)</span>
          <iframe title="prévia do e-mail" srcDoc={html} />
        </div>
      </div>
      <div className="mc-actions">
        <button className="btn ghost" disabled={!!busy || !(d.subject.trim() || d.text.trim())} onClick={saveDraft}>
          <Icon name="file" size={15} /> salvar rascunho
        </button>
        <button className="btn" disabled={!!busy || !ready} onClick={() => void send(true)}>
          <Icon name="eye" size={15} /> {busy === 'teste' ? 'mandando…' : 'mandar teste para mim'}
        </button>
        <button className="btn primary" disabled={!!busy || !ready || !reach} onClick={() => void send(false)}>
          <Icon name="mail" size={15} /> {busy === 'envio' ? 'mandando…' : `mandar para ${reach} pessoa(s)`}
        </button>
      </div>
    </Section>
  )
}
