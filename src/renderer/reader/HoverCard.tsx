import { useEffect, useRef } from 'react'
import type { FracRect } from '../../shared/annot'
import type { ParsedReference, ReferenceView, RegionView } from '../../shared/types/references'
import type { PdfDoc } from './pdf'

export type Target = { kind: 'cite'; ref: ReferenceView } | { kind: 'region'; region: RegionView; doc: PdfDoc }

interface Props {
  target: Target
  onJump: (pageIndex: number) => void
  onOpenPaper: (paperId: string) => void
}

// Preview card for a hovered citation or figure/table/equation reference. Sits below the marker, never over it.
export function HoverCard({ target, onJump, onOpenPaper }: Props) {
  const p = target.kind === 'cite' ? (JSON.parse(target.ref.parsed_json) as ParsedReference) : null
  return (
    <div data-testid="hover-card" className="w-[340px] rounded border border-accent bg-raised p-3 text-[11px] shadow-lg">
      {target.kind === 'region' ? (
        <button data-testid="hover-card-body" onClick={() => onJump(target.region.page_index)} className="block w-full text-left">
          <RegionCrop doc={target.doc} region={target.region} />
          <p className="mt-2 font-reading text-xs text-text">{target.region.text}</p>
          <p className="mt-1 text-muted">p. {target.region.page_index + 1} · click to jump</p>
        </button>
      ) : (
        <>
          <button data-testid="hover-card-body" onClick={() => onJump(target.ref.page_index)} className="block w-full text-left">
            <span className="font-bold text-accent">REFERENCE {target.ref.label ?? target.ref.ordinal}</span>
            <span className="mt-1 block font-reading text-sm font-semibold text-text">{p!.title ?? target.ref.raw}</span>
            <span className="mt-1 block text-text-2">
              {p!.surnames.join(', ')}
              {p!.year ? ` · ${p!.year}` : ''}
            </span>
            <span className="mt-1 block truncate text-muted">{target.ref.raw}</span>
          </button>
          <div className="mt-2 flex items-center gap-3 border-t border-line pt-2">
            <span className={target.ref.library_paper_id ? 'text-green' : 'text-muted'}>{target.ref.library_paper_id ? '● In library' : '○ Not in library'}</span>
            {target.ref.library_paper_id && (
              <button aria-label="Open" onClick={() => onOpenPaper(target.ref.library_paper_id!)} className="ml-auto rounded bg-accent px-2 py-1 text-[10px] font-bold text-bg">
                OPEN
              </button>
            )}
            <button onClick={() => navigator.clipboard.writeText(target.ref.raw)} className={`${target.ref.library_paper_id ? '' : 'ml-auto'} rounded bg-active px-2 py-1 text-[10px] font-bold text-text`}>
              COPY
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function RegionCrop({ doc, region }: { doc: PdfDoc; region: RegionView }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    doc.getPage(region.page_index).then(async (page) => {
      const canvas = ref.current
      const ctx = canvas?.getContext('2d')
      if (cancelled || !canvas || !ctx) return
      const vp = page.getViewport({ scale: 2 })
      const full = document.createElement('canvas')
      full.width = vp.width
      full.height = vp.height
      await page.render({ canvasContext: full.getContext('2d')!, viewport: vp, canvas: full }).promise
      const r = JSON.parse(region.rect_json) as FracRect
      const sw = r.w * vp.width
      const sh = r.h * vp.height
      canvas.width = 316
      canvas.height = Math.round((316 * sh) / sw)
      ctx.drawImage(full, r.x * vp.width, r.y * vp.height, sw, sh, 0, 0, canvas.width, canvas.height)
    })
    return () => {
      cancelled = true
    }
  }, [doc, region])
  return <canvas ref={ref} className="w-full bg-paper" />
}
