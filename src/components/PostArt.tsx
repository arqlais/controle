import { renderSheet } from './Print'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from './ui'
import { Icon } from './Icon'
import { toast } from './dialog'
import { ARTIFACT } from '../env'
import type { PostFormat, Settings } from '../types'

/* Artes prontas das postagens, na identidade da marca.
   A mesma descrição de cada slide desenha a prévia, o PNG, o PDF e o PowerPoint (.pptx)
   — o .pptx abre no Canva com os textos editáveis (Criar design → Importar arquivo). */

const C = { slate: '#4a5d6b', rose: '#d0aca3', paper: '#fafaf7', text: '#584f4a', card: '#f5f1ed', line: '#e7e2d9', white: '#ffffff' }
const SANS = 'Poppins'
const SERIF = 'The Seasons'

type Box = { x: number; y: number; w: number; h: number }
type TextEl = Box & { kind: 'text'; text: string; size: number; color: string; font?: 'sans' | 'serif'; bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right'; spacing?: number; upper?: boolean }
type RectEl = Box & { kind: 'rect'; fill?: string; line?: string; radius?: number; dashed?: boolean }
type El = TextEl | RectEl
export interface ArtSlide {
  bg: string
  els: El[]
}
export interface ArtSource {
  format: PostFormat
  title: string
  hook: string
  script: string
  cta: string
  pillar: string
}

const size = (f: PostFormat) => (f === 'story' || f === 'reels' ? { w: 1080, h: 1920 } : { w: 1080, h: 1350 })

// tira "capa:", "cena 2 (2–7s):", "tela 1:", "1." etc. do começo da linha
const clean = (l: string) =>
  l
    .replace(/^(capa|final|última|ultima|texto final|áudio|audio)\s*:\s*/i, '')
    .replace(/^(cena|tela|telas)\s*[\d\w–-]*\s*(\([^)]*\))?\s*:\s*/i, '')
    .replace(/^\d+\.\s*/, '')
    .trim()
const fit = (t: string, big: number, mid: number, small: number) => (t.length > 120 ? small : t.length > 70 ? mid : big)

export function buildSlides(p: ArtSource, s: Settings): ArtSlide[] {
  const { w, h } = size(p.format)
  const brand = (s.brandName || s.ownerName || '').toUpperCase()
  const handle = s.instagram ? (s.instagram.startsWith('@') ? s.instagram : `@${s.instagram}`) : ''
  const lines = p.script
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const foot = (color: string): El[] => [
    { kind: 'text', x: 90, y: h - 120, w: 450, h: 40, text: brand, size: 24, color, spacing: 6 },
    { kind: 'text', x: w - 540, y: h - 120, w: 450, h: 40, text: handle, size: 24, color, align: 'right' },
  ]
  const top = (color: string, label: string): El[] => [
    { kind: 'text', x: 90, y: 90, w: 700, h: 40, text: label, size: 24, color, spacing: 6, upper: true },
    { kind: 'rect', x: 90, y: 140, w: 70, h: 3, fill: C.rose },
  ]

  if (p.format === 'carrossel') {
    const body = lines.filter((l) => !/^(capa|final)\s*:/i.test(l)).map(clean)
    const finalLine = clean(lines.find((l) => /^final\s*:/i.test(l)) ?? '') || p.cta
    const cover: ArtSlide = {
      bg: C.paper,
      els: [
        ...top(C.slate, p.pillar),
        { kind: 'text', x: 90, y: 380, w: 900, h: 560, text: p.hook || p.title, size: fit(p.hook || p.title, 92, 78, 64), color: C.slate, bold: true },
        { kind: 'text', x: 90, y: 1010, w: 900, h: 90, text: 'arrasta →', size: 54, color: C.rose, font: 'serif', italic: true },
        ...foot(C.slate),
      ],
    }
    const content = body.map(
      (t, i): ArtSlide => ({
        bg: i % 2 ? C.card : C.paper,
        els: [
          { kind: 'text', x: 90, y: 150, w: 400, h: 230, text: String(i + 1).padStart(2, '0'), size: 190, color: C.rose, font: 'serif', italic: true },
          { kind: 'rect', x: 90, y: 440, w: 70, h: 3, fill: C.slate },
          { kind: 'text', x: 90, y: 500, w: 900, h: 600, text: t, size: fit(t, 66, 56, 46), color: C.slate, bold: t.length < 60 },
          ...foot(C.text),
        ],
      }),
    )
    const end: ArtSlide = {
      bg: C.slate,
      els: [
        { kind: 'text', x: 90, y: 380, w: 900, h: 420, text: finalLine, size: fit(finalLine, 72, 60, 50), color: C.white, bold: true },
        { kind: 'text', x: 90, y: 860, w: 900, h: 200, text: p.cta, size: 50, color: C.rose, font: 'serif', italic: true },
        ...foot(C.white),
      ],
    }
    return [cover, ...content, end]
  }

  if (p.format === 'post') {
    const portfolio = p.pillar === 'portfólio' || /render|imagem|foto/i.test(p.script)
    if (portfolio)
      return [
        {
          bg: C.paper,
          els: [
            { kind: 'rect', x: 60, y: 60, w: 960, h: 960, fill: C.line, radius: 24 },
            { kind: 'text', x: 60, y: 490, w: 960, h: 80, text: 'coloque aqui o seu render / foto', size: 34, color: C.text, align: 'center', font: 'serif', italic: true },
            { kind: 'text', x: 90, y: 1070, w: 900, h: 150, text: p.hook || p.title, size: fit(p.hook || p.title, 48, 40, 34), color: C.slate, bold: true },
            ...foot(C.slate),
          ],
        },
      ]
    return [
      {
        bg: C.slate,
        els: [
          ...top(C.white, p.pillar),
          { kind: 'text', x: 90, y: 420, w: 900, h: 560, text: p.hook || p.title, size: fit(p.hook || p.title, 96, 80, 64), color: C.white, bold: true },
          { kind: 'text', x: 90, y: 1030, w: 900, h: 90, text: p.cta, size: 46, color: C.rose, font: 'serif', italic: true },
          ...foot(C.white),
        ],
      },
    ]
  }

  if (p.format === 'story') {
    const telas = lines.map(clean).filter((l) => !/^(telas seguintes|última)/i.test(l))
    return telas.map((t, i): ArtSlide => {
      const sticker = /caixinha|enquete|slider|link|pergunta|vote|responde/i.test(t)
      return {
        bg: i === telas.length - 1 ? C.slate : C.paper,
        els: [
          { kind: 'text', x: 90, y: 150, w: 900, h: 50, text: `${i + 1}/${telas.length}`, size: 28, color: i === telas.length - 1 ? C.rose : C.rose, align: 'center', spacing: 4 },
          { kind: 'text', x: 110, y: 520, w: 860, h: 520, text: t, size: fit(t, 72, 60, 50), color: i === telas.length - 1 ? C.white : C.slate, bold: true, align: 'center' },
          ...(sticker ? [{ kind: 'rect', x: 190, y: 1130, w: 700, h: 260, line: C.rose, radius: 40, dashed: true } as El, { kind: 'text', x: 190, y: 1225, w: 700, h: 70, text: 'espaço do sticker (caixinha, enquete, link…)', size: 30, color: C.rose, align: 'center', font: 'serif', italic: true } as El] : []),
          { kind: 'text', x: 90, y: h - 160, w: 900, h: 40, text: handle || brand, size: 26, color: i === telas.length - 1 ? C.white : C.slate, align: 'center' },
        ],
      }
    })
  }

  // reels: capa + texto final
  const endText = clean(lines.find((l) => /^texto final/i.test(l)) ?? '') || 'você projeta, eu cuido da produção'
  return [
    {
      bg: C.slate,
      els: [
        { kind: 'text', x: 90, y: 260, w: 900, h: 60, text: 'reels', size: 56, color: C.rose, font: 'serif', italic: true },
        { kind: 'text', x: 90, y: 700, w: 900, h: 620, text: p.hook || p.title, size: fit(p.hook || p.title, 104, 88, 72), color: C.white, bold: true },
        { kind: 'text', x: 90, y: h - 160, w: 900, h: 40, text: handle || brand, size: 26, color: C.white },
      ],
    },
    {
      bg: C.paper,
      els: [
        { kind: 'text', x: 90, y: 760, w: 900, h: 400, text: endText, size: 80, color: C.slate, bold: true, align: 'center' },
        { kind: 'text', x: 90, y: 1250, w: 900, h: 80, text: p.cta, size: 46, color: C.rose, font: 'serif', italic: true, align: 'center' },
        { kind: 'text', x: 90, y: h - 160, w: 900, h: 40, text: handle || brand, size: 26, color: C.slate, align: 'center' },
      ],
    },
  ]
}

function SlideView({ slide, w, h }: { slide: ArtSlide; w: number; h: number }) {
  return (
    <div className="art-slide" style={{ width: w, height: h, background: slide.bg }}>
      {slide.els.map((e, i) =>
        e.kind === 'rect' ? (
          <div key={i} style={{ position: 'absolute', left: e.x, top: e.y, width: e.w, height: e.h, background: e.fill ?? 'transparent', border: e.line ? `3px ${e.dashed ? 'dashed' : 'solid'} ${e.line}` : undefined, borderRadius: e.radius ?? 0 }} />
        ) : (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: e.x,
              top: e.y,
              width: e.w,
              height: e.h,
              color: e.color,
              fontFamily: e.font === 'serif' ? `'${SERIF}', 'Cormorant Garamond', Georgia, serif` : `'${SANS}', sans-serif`,
              fontSize: e.size,
              fontWeight: e.bold ? 700 : 400,
              fontStyle: e.italic ? 'italic' : 'normal',
              textAlign: e.align ?? 'left',
              letterSpacing: e.spacing ? `${e.spacing / 10}em` : undefined,
              textTransform: e.upper ? 'uppercase' : undefined,
              lineHeight: e.font === 'serif' ? 1.05 : 1.18,
              whiteSpace: 'pre-line',
            }}
          >
            {e.text}
          </div>
        ),
      )}
    </div>
  )
}

const hex = (c: string) => c.replace('#', '').toUpperCase()
const fileBase = (t: string) => (t || 'post').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60)

export function ArtModal({ source, settings, onClose }: { source: ArtSource; settings: Settings; onClose: () => void }) {
  const slides = buildSlides(source, settings)
  const { w, h } = size(source.format)
  const stage = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const scale = 250 / w

  const nodes = () => [...(stage.current?.querySelectorAll<HTMLElement>('.art-slide') ?? [])]
  const guard = () => {
    if (ARTIFACT) {
      toast('Para baixar, use o sistema publicado (arqlais.github.io/controle).')
      return false
    }
    return true
  }
  const run = async (fn: () => Promise<void>) => {
    if (!guard() || busy) return
    setBusy(true)
    try {
      await document.fonts.ready
      await fn()
    } catch {
      toast('Não foi possível gerar agora. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }
  const png = () =>
    run(async () => {
      const { toPng } = await import('html-to-image')
      const list = nodes()
      for (let i = 0; i < list.length; i++) {
        const url = await renderSheet(list[i], toPng, { pixelRatio: 1, width: w, height: h })
        const a = document.createElement('a')
        a.href = url
        a.download = `${fileBase(source.title)} - ${String(i + 1).padStart(2, '0')}.png`
        a.click()
        await new Promise((r) => setTimeout(r, 250))
      }
      toast(`${list.length} imagem(ns) baixada(s).`)
    })
  const pdf = () =>
    run(async () => {
      const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
      const doc = new jsPDF({ unit: 'px', format: [w, h], orientation: 'portrait', hotfixes: ['px_scaling'] })
      const list = nodes()
      for (let i = 0; i < list.length; i++) {
        const canvas = await renderSheet(list[i], toCanvas, { pixelRatio: 1, width: w, height: h })
        if (i) doc.addPage([w, h], 'portrait')
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h, undefined, 'FAST')
      }
      doc.save(`${fileBase(source.title)}.pdf`)
      toast('PDF baixado.')
    })
  const pptx = () =>
    run(async () => {
      const { default: PptxGenJS } = await import('pptxgenjs')
      const deck = new PptxGenJS()
      deck.defineLayout({ name: 'IG', width: w / 100, height: h / 100 })
      deck.layout = 'IG'
      for (const s of slides) {
        const slide = deck.addSlide()
        slide.background = { color: hex(s.bg) }
        for (const e of s.els) {
          if (e.kind === 'rect') {
            slide.addShape(e.radius ? deck.ShapeType.roundRect : deck.ShapeType.rect, {
              x: e.x / 100,
              y: e.y / 100,
              w: e.w / 100,
              h: e.h / 100,
              fill: e.fill ? { color: hex(e.fill) } : { type: 'none' },
              line: e.line ? { color: hex(e.line), width: 2, dashType: e.dashed ? 'dash' : 'solid' } : { type: 'none' },
              rectRadius: e.radius ? Math.min(0.5, e.radius / Math.min(e.w, e.h)) : undefined,
            })
          } else {
            slide.addText(e.upper ? e.text.toUpperCase() : e.text, {
              x: e.x / 100,
              y: e.y / 100,
              w: e.w / 100,
              h: e.h / 100,
              fontFace: e.font === 'serif' ? SERIF : SANS,
              fontSize: Math.round(e.size * 0.72),
              color: hex(e.color),
              bold: !!e.bold,
              italic: !!e.italic,
              align: e.align ?? 'left',
              valign: 'top',
              margin: 0,
              charSpacing: e.spacing ? e.spacing / 2 : undefined,
              fit: 'shrink',
            })
          }
        }
      }
      await deck.writeFile({ fileName: `${fileBase(source.title)} (canva).pptx` })
      toast('Arquivo para o Canva baixado. No Canva: Criar design → Importar arquivo.')
    })

  return (
    <Modal
      wide
      title="arte pronta"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" disabled={busy} onClick={png}>
            <Icon name="download" size={15} /> PNG
          </button>
          <button className="btn ghost" disabled={busy} onClick={pdf}>
            <Icon name="download" size={15} /> PDF
          </button>
          <button className="btn primary" disabled={busy} onClick={pptx} title="PowerPoint: o Canva importa com os textos editáveis">
            <Icon name="download" size={15} /> {busy ? 'gerando…' : 'para o Canva (.pptx)'}
          </button>
        </>
      }
    >
      <p className="muted small">
        {slides.length} {source.format === 'carrossel' ? (slides.length === 1 ? 'slide' : 'slides') : source.format === 'story' ? (slides.length === 1 ? 'tela' : 'telas') : slides.length === 1 ? 'imagem' : 'imagens'} em {w}×{h}. No Canva use <b>Criar design → Importar arquivo</b> com o .pptx: os textos chegam editáveis nas fontes da marca (Poppins e The Seasons); troque o espaço do render pela sua imagem.
      </p>
      <div className="art-strip">
        {slides.map((s, i) => (
          <div key={i} className="art-thumb" style={{ width: w * scale, height: h * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <SlideView slide={s} w={w} h={h} />
            </div>
          </div>
        ))}
      </div>
      {createPortal(
        <div ref={stage} className="art-stage" aria-hidden>
          {slides.map((s, i) => (
            <SlideView key={i} slide={s} w={w} h={h} />
          ))}
        </div>,
        document.body,
      )}
    </Modal>
  )
}
