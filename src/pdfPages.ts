/* Folhas de um PDF como imagens (para o papel timbrado e para assinar um PDF pronto, exatamente como ele é). */

export async function pdfPageImages(file: File, max = 15, width = 1240): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const out: string[] = []
  for (let n = 1; n <= Math.min(pdf.numPages, max); n++) {
    const page = await pdf.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: width / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise
    out.push(canvas.toDataURL('image/jpeg', 0.82))
  }
  return out
}

/** Imagem de fundo (papel timbrado) a partir de imagem ou PDF: devolve a 1ª folha e, se houver, a 2ª (folhas seguintes). */
export async function letterheadImages(file: File): Promise<{ first: string; rest?: string }> {
  if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
    const [first, rest] = await pdfPageImages(file, 2)
    if (!first) throw new Error('vazio')
    return { first, rest }
  }
  const { pickImage } = await import('./components/DocKit')
  return { first: await pickImage(file, 1600) }
}
