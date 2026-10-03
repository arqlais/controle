/* Leitura de PDF: muitos modelos (Canva, Illustrator) desenham o mesmo texto duas ou três vezes
   quase no mesmo lugar para fazer sombra ou contorno ("01" vira "010101"). Aqui cada pedaço de texto
   repetido no mesmo ponto conta uma vez só. */

type Item = { str: string; transform: number[]; width?: number; height?: number }

export function uniqueItems<T extends Item>(items: T[]): T[] {
  const kept: T[] = []
  for (const it of items) {
    const s = it.str.trim()
    if (!s) {
      kept.push(it)
      continue
    }
    const [, , , , x, y] = it.transform
    const size = Math.hypot(it.transform[2], it.transform[3]) || 10
    const tol = Math.max(2.5, size * 0.25)
    const dup = kept.some((k) => k.str.trim() === s && Math.abs(k.transform[4] - x) <= tol && Math.abs(k.transform[5] - y) <= tol)
    if (!dup) kept.push(it)
  }
  return kept
}

export type PdfPiece = { str: string; x: number; y: number; w: number; size: number; font?: string }
export type PdfRow = { y: number; x0: number; x1: number; size: number; items: PdfPiece[] }

const isBadge = (s: string) => /^\d{1,2}$/.test(s.trim())
const isPageNumber = (s: string) => /^\s*\d{1,3}\s*\/\s*\d{1,3}\s*$/.test(s)

/** Junta os pedaços de texto em linhas, como o olho lê:
    - colunas lado a lado não se misturam (pedaços longe na horizontal viram linhas separadas);
    - números soltos em destaque ("01", "02"…) vão para o começo do texto ao lado deles;
    - numeração de página ("01/04") sai. */
export function pdfRows(pieces: PdfPiece[]): PdfRow[] {
  const all = pieces.filter((p) => p.str && !isPageNumber(p.str)).sort((a, b) => b.y - a.y || a.x - b.x)
  // tamanho do texto corrido da página: o número só é "destaque" se for bem maior (um "03" no meio da frase não é)
  const sizes = all.map((p) => p.size).sort((a, b) => a - b)
  const body = sizes[Math.floor(sizes.length / 2)] ?? 10
  const badges = all.filter((p) => isBadge(p.str) && p.size >= body * 1.3)
  const rows: PdfRow[] = []
  for (const it of all.filter((p) => !badges.includes(p))) {
    const row = rows.find((r) => Math.abs(r.y - it.y) < Math.max(2, it.size * 0.45) && it.x <= r.x1 + it.size * 1.6 && it.x + it.w >= r.x0 - it.size * 1.6)
    if (!row) rows.push({ y: it.y, x0: it.x, x1: it.x + it.w, size: it.size, items: [it] })
    else {
      row.items.push(it)
      row.x0 = Math.min(row.x0, it.x)
      row.x1 = Math.max(row.x1, it.x + it.w)
      row.size = Math.max(row.size, it.size)
    }
  }
  // número em destaque: entra antes da primeira linha do bloco de texto ao lado dele
  for (const b of badges) {
    const near = rows.filter((r) => Math.abs(r.y - b.y) <= b.size * 1.3 && (b.x + b.w < r.x0 ? r.x0 - (b.x + b.w) : b.x > r.x1 ? b.x - r.x1 : 0) < b.size * 6)
    const target = near.sort((a, c) => c.y - a.y)[0]
    if (target) {
      target.items.unshift({ ...b, x: target.x0 - 1 })
      target.x0 = Math.min(target.x0, b.x)
    } else rows.push({ y: b.y, x0: b.x, x1: b.x + b.w, size: b.size, items: [b] })
  }
  for (const r of rows) r.items.sort((a, c) => a.x - c.x)
  return rows.sort((a, c) => c.y - a.y || a.x0 - c.x0)
}
