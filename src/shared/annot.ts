import type { Annotation } from './types/db'

export interface FracRect {
  x: number
  y: number
  w: number
  h: number
}

export type AnnotationInput = Pick<Annotation, 'id' | 'page_index' | 'kind' | 'rects_json' | 'color' | 'text' | 'comment' | 'label' | 'hidden'>

const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4

// Client rects to 0-1 fractions of the page box, one merged rect per line (data model, annotations).
type RectLike = Pick<DOMRectReadOnly, 'x' | 'y' | 'width' | 'height'>

export function toFractions(rects: RectLike[], box: RectLike): FracRect[] {
  const out: FracRect[] = []
  for (const r of rects) {
    const x1 = clamp((r.x - box.x) / box.width)
    const y1 = clamp((r.y - box.y) / box.height)
    const x2 = clamp((r.x + r.width - box.x) / box.width)
    const y2 = clamp((r.y + r.height - box.y) / box.height)
    if (x2 <= x1 || y2 <= y1) continue
    const last = out.at(-1)
    if (last && y1 < last.y + last.h && y2 > last.y) {
      const nx = Math.min(last.x, x1)
      const ny = Math.min(last.y, y1)
      Object.assign(last, { x: nx, y: ny, w: clamp(Math.max(last.x + last.w, x2) - nx), h: clamp(Math.max(last.y + last.h, y2) - ny) })
    } else out.push({ x: x1, y: y1, w: clamp(x2 - x1), h: clamp(y2 - y1) })
  }
  return out
}
