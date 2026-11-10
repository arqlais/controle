// planê.apê: leitura do orçamento DEPOIS de enviado. Primeiro sem IA (texto do PDF e texto da imagem, no próprio
// aparelho), depois a IA do servidor completa o que faltar. Só preenche o que está vazio: nada que a pessoa escreveu muda.
import { lerArquivo, meuOrcamento } from './api'
import { lerTexto, nichoDoTexto } from './comparar'
import { cleanOrcamento, type Arquivo, type Orcamento } from './model'

export async function textoDoPdf(f: File): Promise<string> {
  if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return ''
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise
    const out: string[] = []
    for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
      const c = await (await pdf.getPage(i)).getTextContent()
      // mantém as quebras de linha do PDF: as regras de fornecedor/CNPJ leem linha a linha
      let s = '', y: number | null = null
      for (const it of c.items) {
        if (!('str' in it)) continue
        const ny = it.transform?.[5] ?? null
        if (y != null && ny != null && Math.abs(ny - y) > 2 && !s.endsWith('\n')) s += '\n'
        s += it.str + (it.hasEOL ? '\n' : ' ')
        y = ny
      }
      out.push(s.replace(/[ \t]+\n/g, '\n'))
    }
    return out.join('\n')
  } catch {
    return ''
  }
}

/** Texto de um print ou foto, lido no aparelho (sem IA, sem custo). */
export async function textoDaImagem(f: File): Promise<string> {
  if (!/^image\//i.test(f.type)) return ''
  try {
    const { createWorker } = await import('tesseract.js')
    const w = await createWorker('por')
    const r = await w.recognize(f)
    await w.terminate()
    return r.data.text || ''
  } catch {
    return ''
  }
}

const vazio = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length)
/** Junta: o que já tem fica; o novo só entra onde estava vazio. A pasta muda se ela foi deduzida. */
export function juntar(a: Orcamento, b: Partial<Orcamento>): Orcamento {
  const out = { ...a } as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(b)) if (!vazio(v) && vazio(out[k]) && k !== 'id') out[k] = v
  if (b.nicho && b.nicho !== 'outros' && (a.nicho === 'outros' || a.nicho_auto)) out.nicho = b.nicho
  return out as unknown as Orcamento
}

/** Lê o que dá (sem IA), guarda; depois pede a IA e guarda de novo. Pode rodar com a pessoa já em outra tela.
 *  Prioridade: o que a pessoa escreveu > IA > leitura local > palpite feito na hora de anexar. Nada aqui pode travar o envio. */
export async function lerDepois(moradorId: string, id: string, base: Orcamento, files: File[], arquivos: Arquivo[], texto = '') {
  const palpiteForn = base.forn_auto ? base.fornecedor : ''
  const pessoa: Orcamento = { ...base, id, fornecedor: base.forn_auto ? '' : base.fornecedor }
  const trocaPasta = !!base.nicho_auto || base.nicho === 'outros'
  const montar = (ia: Partial<Orcamento> | null, local: Partial<Orcamento> | null): Orcamento => {
    let o = pessoa
    if (ia) o = juntar(o, { ...ia, nicho: undefined })
    if (local) o = juntar(o, { ...local, nicho: undefined })
    if (!o.fornecedor && palpiteForn) o = { ...o, fornecedor: palpiteForn }
    const pasta = [ia?.nicho, local?.nicho].find((n) => n && n !== 'outros')
    if (trocaPasta && pasta) o = { ...o, nicho: pasta }
    // continua "palpite" (a rotina do servidor ainda pode trocar) se não veio da pessoa nem da IA
    return { ...o, forn_auto: !!o.fornecedor && !pessoa.fornecedor && !ia?.fornecedor }
  }
  let local: Partial<Orcamento> | null = null
  // 1) sem IA (texto do PDF / da imagem, no aparelho)
  try {
    const txt = [texto, ...(await Promise.all(files.map(async (f) => (await textoDoPdf(f)) || (await textoDaImagem(f)))))].join('\n').trim()
    if (txt) {
      const r = cleanOrcamento(lerTexto(txt) as Record<string, unknown>, { nicho: 'outros' })
      const n = nichoDoTexto(txt + ' ' + (r.servico || ''))
      local = { ...r, nicho: (n || r.nicho) as Orcamento['nicho'] }
      await meuOrcamento(moradorId, id, { ...montar(null, local), lendo: true }).catch(() => null)
    }
  } catch { /* segue para a IA */ }
  // 2) IA do servidor (se estiver ligada): completa e corrige palpites
  let ia: Partial<Orcamento> | null = null
  try {
    const r = await lerArquivo(moradorId, arquivos[0] || null, arquivos[0] ? '' : texto)
    if (r.o) ia = cleanOrcamento(r.o, { nicho: 'outros' })
  } catch { /* sem IA: fica o que a leitura local achou; a rotina do servidor tenta de novo se ficar "lendo" */ }
  const o = montar(ia, local)
  // se a IA não respondeu, deixa "lendo" para a rotina do servidor terminar depois
  const fim = { ...o, lendo: !ia && !!arquivos[0], nicho_auto: !ia && trocaPasta }
  await meuOrcamento(moradorId, id, fim).catch(() => null)
  return fim
}
