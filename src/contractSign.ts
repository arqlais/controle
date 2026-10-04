import { CLOUD, publishPublicFile, readPublicFile, removePublicFile } from './cloud'
import { pack, readShortCode, shortCode, unpack } from './linkPack'
import type { ContractSignature, Settings } from './types'

/* Assinatura do contrato pelo link: o cliente abre o contrato no celular, confere, digita nome e CPF
   e aceita. A confirmação volta pelo WhatsApp com um código; colado no contrato, ele confere se o
   texto assinado é exatamente este (qualquer mudança depois muda o código). */

export interface SignPayload {
  token: string
  title: string
  body: string
  html?: string // contrato no modelo da pessoa (Word)
  letterhead?: import('./types').Letterhead // papel timbrado
  pdfPages?: string[] // PDF pronto, folha por folha
  clientName: string
  studio: string
  owner: string
  phone: string
  accent: string
  logo?: string
  s: Partial<Settings> // só o que o desenho do contrato usa
  exclusive: boolean // desenho exclusivo da dona
}

/** Resposta do cliente (vai no código da mensagem). */
export interface SignAnswer {
  t: string // token do link
  n: string // nome
  d: string // CPF / CNPJ
  at: string
  h: string // código da assinatura
  m?: 'desenho' | 'digitado'
  p?: string // traço desenhado
  f?: string // letra do nome digitado
  c?: string // e-mail ou WhatsApp de quem assinou
  ua?: string // aparelho e navegador
  tz?: string // fuso horário
  g?: string // localização (se permitida)
  dh?: string // SHA-256 do texto
}

const base = () => `${location.origin}${location.pathname}`
const fileName = (token: string) => `contrato-${token}.json`

/** Código de 16 letras que liga nome, documento, data e o texto exato do contrato. */
/** SHA-256 completo do texto do contrato (aparece no certificado de assinatura). */
export async function docHash(body: string) {
  const bytes = new TextEncoder().encode(body.trim())
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Resumo do aparelho para o registro (sistema e navegador, sem nada pessoal). */
export function deviceLabel(ua = navigator.userAgent) {
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'outro'
  const br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador'
  return `${os} · ${br}`
}

export async function signatureHash(body: string, name: string, doc: string, at: string, extra = '') {
  const bytes = new TextEncoder().encode([body.trim(), name.trim().toLowerCase(), doc.replace(/\D/g, ''), at, extra].join('|'))
  const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex.slice(0, 16).toUpperCase().match(/.{4}/g)!.join('-')
}

/** Publica o contrato para assinar e devolve o link (curto na nuvem; com a cópia dentro, sem nuvem). */
export async function publishSign(payload: SignPayload, userId?: string): Promise<string> {
  if (CLOUD && userId) {
    try {
      await publishPublicFile(userId, fileName(payload.token), payload)
      const code = shortCode(userId, payload.token)
      if (code) return `${base()}#/assinar/${code}`
    } catch {
      /* segue com a cópia no link */
    }
  }
  return `${base()}#/assinar/${payload.token}/${await pack({ ...payload, html: undefined, letterhead: undefined, pdfPages: undefined })}`
}

export async function unpublishSign(token: string, userId?: string) {
  if (CLOUD && userId) await removePublicFile(userId, fileName(token)).catch(() => undefined)
}

export async function loadSign(raw: string, extra: string): Promise<SignPayload | null> {
  const code = raw.includes('.') ? readShortCode(raw) : null
  if (code) return readPublicFile<SignPayload>(code.userId, fileName(code.id))
  return unpack<SignPayload>(extra)
}

export const SIGN_TAG = 'código da assinatura:'
export const signMessage = async (p: SignPayload, a: SignAnswer) =>
  [
    `Oi! Li e assinei o contrato "${p.title}".`,
    '',
    `nome: ${a.n}`,
    `CPF/CNPJ: ${a.d}`,
    `data: ${new Date(a.at).toLocaleString('pt-BR')}`,
    `forma: ${a.m === 'desenho' ? 'assinatura desenhada à mão' : 'nome digitado'}`,
    ...(a.c ? [`contato: ${a.c}`] : []),
    ...(a.g ? [`localização: ${a.g}`] : []),
    `código de verificação: ${a.h}`,
    '',
    `${SIGN_TAG} ${await pack(a)}`,
  ].join('\n')

/** O que entra no código além do texto: a forma de assinar e os dados de autenticação. */
export const signExtra = (a: Pick<SignAnswer, 'm' | 'p' | 'f' | 'c' | 'ua' | 'tz' | 'g'>) => [a.m, a.p, a.f, a.c, a.ua, a.tz, a.g].map((x) => x ?? '').join('|')

/** Lê a mensagem colada e confere com o contrato: devolve a assinatura ou o motivo de não valer. */
export async function checkSignMessage(msg: string, token: string | undefined, body: string): Promise<{ sign?: ContractSignature; error?: string }> {
  const code = msg.match(/c[óo]digo da assinatura:\s*([zj][A-Za-z0-9_-]+)/i)?.[1]
  const a = code ? await unpack<SignAnswer>(code) : null
  if (!a) return { error: 'Não achei o código da assinatura. Cole a mensagem inteira que o cliente mandou.' }
  if (token && a.t !== token) return { error: 'Esse código é de outro contrato.' }
  if ((await signatureHash(body, a.n, a.d, a.at, signExtra(a))) !== a.h) return { error: 'O texto do contrato mudou depois que o cliente assinou (ou a mensagem foi alterada). Mande o link de novo para ele assinar a versão atual.' }
  return {
    sign: { via: 'link', name: a.n, doc: a.d, at: a.at, hash: a.h, method: a.m ?? 'digitado', drawing: a.p, font: a.f, contact: a.c, device: a.ua, tz: a.tz, geo: a.g, docHash: a.dh ?? (await docHash(body)), confirmedAt: new Date().toISOString() },
  }
}

/** Sites de assinatura eletrônica com validade jurídica (o PDF baixado daqui vai para lá). */
export const SIGN_SITES: { id: string; name: string; url: string; text: string; free?: boolean }[] = [
  { id: 'govbr', name: 'gov.br', url: 'https://assinador.iti.br', text: 'assinatura oficial do governo, com a conta gov.br (prata ou ouro) das duas partes', free: true },
  { id: 'zapsign', name: 'ZapSign', url: 'https://zapsign.com.br', text: 'envia pelo WhatsApp, o cliente assina no celular com selfie e documento' },
  { id: 'clicksign', name: 'Clicksign', url: 'https://www.clicksign.com', text: 'muito usada por escritórios, com registro de IP, e-mail e selfie' },
  { id: 'd4sign', name: 'D4Sign', url: 'https://d4sign.com.br', text: 'assinatura com validade jurídica e cofre de documentos' },
  { id: 'autentique', name: 'Autentique', url: 'https://www.autentique.com.br', text: 'plano gratuito com alguns documentos por mês', free: true },
  { id: 'docusign', name: 'DocuSign', url: 'https://www.docusign.com/pt-br', text: 'internacional, aceita certificado digital ICP-Brasil' },
]
