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

/** Lê o que dá (sem IA), guarda; depois pede a IA e guarda de novo. Pode rodar com a pessoa já em outra tela. */
export async function lerDepois(moradorId: string, id: string, base: Orcamento, files: File[], arquivos: Arquivo[], texto = '') {
  let o: Orcamento = { ...base, id }
  // 1) sem IA
  const local = [texto, ...(await Promise.all(files.map(async (f) => (await textoDoPdf(f)) || (await textoDaImagem(f)))))].join('\n').trim()
  if (local) {
    const r = cleanOrcamento(lerTexto(local) as Record<string, unknown>, { nicho: 'outros' })
    const n = nichoDoTexto(local + ' ' + (r.servico || ''))
    o = juntar(o, { ...r, nicho: (n || r.nicho) as Orcamento['nicho'] })
    await meuOrcamento(moradorId, id, { ...o, lendo: true }).catch(() => null)
  }
  // 2) IA do servidor (se estiver ligada): completa o que faltou
  try {
    const ia = await lerArquivo(moradorId, arquivos[0] || null, arquivos[0] ? '' : texto || local)
    if (ia.o) o = juntar(o, cleanOrcamento(ia.o, { nicho: 'outros' }))
  } catch { /* sem IA: fica o que a leitura local achou */ }
  if (!o.servico && o.nicho !== 'outros') o.servico = ''
  await meuOrcamento(moradorId, id, { ...o, lendo: false, nicho_auto: false }).catch(() => null)
  return o
}
