import type { FracRect } from '../../shared/annot'
import type { Annotation } from '../../shared/types/db'

interface Props {
  annotations: Annotation[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// Draws marks over one page. Positions are 0-1 fractions, so percentages survive zoom.
export function AnnotationLayer({ annotations, selectedId, onSelect }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {annotations.flatMap((a) =>
        (JSON.parse(a.rects_json) as FracRect[]).map((r, k) => (
          <div
            key={`${a.id}-${k}`}
            data-annotation-id={a.id}
            aria-selected={a.id === selectedId}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(a.id)
            }}
            className="pointer-events-auto absolute cursor-pointer mix-blend-multiply"
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
              backgroundColor: a.kind === 'highlight' ? `${a.color}66` : undefined,
              borderBottom: a.kind === 'underline' ? `2px solid ${a.color}` : undefined,
              outline: a.id === selectedId ? '2px solid #7AA2F7' : undefined,
            }}
          >
            {a.kind === 'strike' && <div className="absolute inset-x-0 top-1/2 h-0.5" style={{ background: a.color ?? undefined }} />}
          </div>
        )),
      )}
    </div>
  )
}
