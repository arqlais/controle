import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Modal } from './ui'
import { Icon } from './Icon'

/* Ajuste da foto antes de salvar: arrastar para posicionar, aproximar com o controle,
   prévia sempre redonda. Salva um quadrado (512px) que o sistema mostra recortado em círculo. */

const BOX = 260
const OUT = 512

export function PhotoCrop({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [src, setSrc] = useState('')
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // escala em que a imagem cobre o círculo inteiro
  const base = img ? BOX / Math.min(img.width, img.height) : 1
  const w = img ? img.width * base * zoom : BOX
  const h = img ? img.height * base * zoom : BOX
  const clamp = (p: { x: number; y: number }, z = zoom) => {
    if (!img) return p
    const mx = Math.max(0, (img.width * base * z - BOX) / 2)
    const my = Math.max(0, (img.height * base * z - BOX) / 2)
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) }
  }

  const down = (e: RPointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
  }
  const move = (e: RPointerEvent) => {
    const d = drag.current
    if (!d) return
    setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }))
  }
  const up = () => (drag.current = null)
  const setZ = (z: number) => {
    setZoom(z)
    setPos((p) => clamp(p, z))
  }

  const save = () => {
    if (!img) return
    const c = document.createElement('canvas')
    c.width = c.height = OUT
    const k = OUT / BOX
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUT, OUT)
    ctx.drawImage(img, (BOX / 2 - w / 2 + pos.x) * k, (BOX / 2 - h / 2 + pos.y) * k, w * k, h * k)
    onDone(c.toDataURL('image/jpeg', 0.88))
  }

  return (
    <Modal
      title="ajustar foto"
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>cancelar</button>
          <button className="btn primary" onClick={save} disabled={!img}>
            <Icon name="check" size={15} /> salvar foto
          </button>
        </>
      }
    >
      <div className="pc">
        <div
          className="pc-stage"
          style={{ width: BOX, height: BOX }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={(e) => setZ(Math.max(1, Math.min(4, zoom - e.deltaY / 600)))}
        >
          {src && (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{ width: w, height: h, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
            />
          )}
          <span className="pc-ring" />
        </div>
        <label className="pc-zoom">
          <Icon name="image" size={13} />
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZ(Number(e.target.value))} aria-label="aproximar" />
          <Icon name="image" size={19} />
        </label>
        <p className="pc-hint">arraste para posicionar</p>
      </div>
    </Modal>
  )
}
