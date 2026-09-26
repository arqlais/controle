/* PDF editável: o fundo da folha vira imagem (sem os textos marcados com
   data-edit) e cada texto marcado vira um campo de formulário em Poppins,
   na mesma posição, que dá para alterar em qualquer leitor de PDF. */
import { PDFDocument, TextAlignment, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import poppins400 from './fonts/poppins-400.ttf?url'
import poppins500 from './fonts/poppins-500.ttf?url'
import poppins600 from './fonts/poppins-600.ttf?url'

const PAGE_W = 595.28
const PAGE_H = 841.89

interface Field {
  text: string
  x: number
  y: number
  w: number
  h: number
  size: number
  weight: number
  color: [number, number, number]
  right: boolean
  multi: boolean
}

function parseColor(c: string): [number, number, number] {
  const n = (c.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number)
  // "rgb(31, 58, 77)" vem em 0–255; "color(srgb 0.12 0.23 0.3)" vem em 0–1
  const scale = c.startsWith('color(') ? 1 : 255
  return [n[0] / scale, n[1] / scale, n[2] / scale]
}

function collect(root: HTMLElement): Field[] {
  const base = root.getBoundingClientRect()
  return [...root.querySelectorAll<HTMLElement>('[data-edit]')]
    .map((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const size = parseFloat(cs.fontSize)
      const lh = parseFloat(cs.lineHeight) || size * 1.5
      return {
        text: el.innerText.trim(),
        x: r.left - base.left,
        y: r.top - base.top,
        w: r.width,
        h: r.height,
        size,
        weight: parseInt(cs.fontWeight) || 400,
        color: parseColor(cs.color),
        right: cs.textAlign === 'right' || cs.textAlign === 'end',
        multi: el.dataset.edit === 'multi' || r.height > lh * 1.4,
      }
    })
    .filter((f) => f.w > 0 && f.h > 0)
}

export async function editablePdf(root: HTMLElement, render: (el: HTMLElement) => Promise<HTMLCanvasElement>) {
  const fields = collect(root)
  root.classList.add('pdf-hide-edit')
  let canvas: HTMLCanvasElement
  try {
    canvas = await render(root)
  } finally {
    root.classList.remove('pdf-hide-edit')
  }

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const load = (u: string) => fetch(u).then((r) => r.arrayBuffer())
  const [f400, f500, f600] = await Promise.all([poppins400, poppins500, poppins600].map(async (u) => doc.embedFont(await load(u), { subset: false })))
  const fontFor = (w: number): PDFFont => (w >= 600 ? f600 : w >= 500 ? f500 : f400)
  const form = doc.getForm()

  const k = PAGE_W / root.offsetWidth // px → pt
  const pxPerPage = PAGE_H / k
  const pages = Math.max(1, Math.ceil(root.offsetHeight / pxPerPage - 0.02))
  const ratio = canvas.width / root.offsetWidth

  for (let i = 0; i < pages; i++) {
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = Math.min(Math.round(pxPerPage * ratio), canvas.height - Math.round(i * pxPerPage * ratio))
    slice.getContext('2d')!.drawImage(canvas, 0, -Math.round(i * pxPerPage * ratio))
    const jpg = await doc.embedJpg(await (await fetch(slice.toDataURL('image/jpeg', 0.92))).arrayBuffer())
    const page = doc.addPage([PAGE_W, PAGE_H])
    const h = (slice.height / ratio) * k
    page.drawImage(jpg, { x: 0, y: PAGE_H - h, width: PAGE_W, height: h })

    fields
      .filter((f) => f.y >= i * pxPerPage && f.y < (i + 1) * pxPerPage)
      .forEach((f, n) => {
        const font = fontFor(f.weight)
        const tf = form.createTextField(`p${i + 1}.campo${n + 1}`)
        if (f.multi) tf.enableMultiline()
        tf.setText(f.text)
        const pad = 2 // o campo tem 2pt de margem interna
        tf.addToPage(page, {
          x: f.x * k - pad,
          y: PAGE_H - (f.y - i * pxPerPage + (f.multi ? f.h * 1.35 : f.h)) * k - pad,
          width: f.w * k + pad * 2,
          // o leitor de PDF usa entrelinha maior que a da página: sobra espaço para não cortar a última linha
          height: (f.multi ? f.h * 1.35 : f.h) * k + pad * 2,
          font,
          textColor: rgb(...f.color),
          borderWidth: 0,
          backgroundColor: undefined, // sem fundo branco nem borda: o campo fica "invisível" sobre a folha
          borderColor: undefined,
        })
        if (f.right) tf.setAlignment(TextAlignment.Right)
        tf.setFontSize(f.size * k)
        tf.updateAppearances(font)
      })
  }
  return doc.save()
}
