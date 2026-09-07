import type { Annotation } from '../../shared/types/db'
import type { Palette } from './palette'

export interface Filter {
  colors: string[] // hidden colors
  kinds: string[] // hidden kinds
}

interface Props {
  annotations: Annotation[]
  palette: Palette
  filter: Filter
  selectedId: string | null
  onFilter: (f: Filter) => void
  onSelect: (id: string) => void
  onComment: (id: string, comment: string) => void
}

const kinds = ['highlight', 'underline', 'strike'] as const

export const isShown = (a: Annotation, f: Filter) => !f.kinds.includes(a.kind) && !f.colors.includes(a.color ?? '')

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export function AnnotationsPanel({ annotations, palette, filter, selectedId, onFilter, onSelect, onComment }: Props) {
  const shown = annotations.filter((a) => isShown(a, filter))
  return (
    <div data-testid="annotations-panel" className="flex min-h-0 flex-col gap-3 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="font-bold text-text-2">ANNOTATIONS · {shown.length}</span>
        <button onClick={() => onFilter({ colors: [], kinds: filter.kinds.length ? [] : [...kinds] })} className="text-accent">
          {filter.kinds.length === kinds.length ? 'SHOW ALL' : 'HIDE ALL'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {palette.map((p) => (
          <label key={p.color} className="flex items-center gap-1 text-muted">
            <input type="checkbox" aria-label={p.name} checked={!filter.colors.includes(p.color)} onChange={() => onFilter({ ...filter, colors: toggle(filter.colors, p.color) })} />
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        {kinds.map((k) => (
          <label key={k} className="flex items-center gap-1 text-muted">
            <input type="checkbox" aria-label={k} checked={!filter.kinds.includes(k)} onChange={() => onFilter({ ...filter, kinds: toggle(filter.kinds, k) })} />
            {k}
          </label>
        ))}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {shown.map((a) => (
          <li key={a.id} className={`border-b border-line py-2 ${a.id === selectedId ? 'bg-active' : ''}`}>
            <button onClick={() => onSelect(a.id)} className="flex w-full items-start gap-2 text-left">
              <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: a.color ?? undefined }} />
              <span className="min-w-0">
                <span className="mr-2 text-[9px] font-bold uppercase text-muted">
                  {a.kind} · p. {a.page_index + 1}
                </span>
                <span className="font-reading text-xs text-text">{a.text}</span>
                {a.comment && a.id !== selectedId && <span className="block text-text-2">{a.comment}</span>}
              </span>
            </button>
            {a.id === selectedId && (
              <textarea
                defaultValue={a.comment ?? ''}
                placeholder="Comment…"
                onBlur={(e) => e.target.value !== (a.comment ?? '') && onComment(a.id, e.target.value)}
                className="mt-2 w-full rounded bg-raised p-2 text-text placeholder:text-muted"
                rows={2}
              />
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="py-2 text-muted">Select text on the page, then choose a mark.</li>}
      </ul>
    </div>
  )
}
