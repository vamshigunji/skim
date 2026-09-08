import { useState } from 'react'
import { PRESELECT, type ProposalItemView, type ProposalView } from '../../shared/proposals'
import { toggle } from '../reader/AnnotationsPanel'

interface Props {
  proposals: ProposalView[]
  note: string
  conflict: string | null // proposal whose undo hit a changed value
  onApply: (id: string, itemIds: string[]) => void
  onReject: (id: string) => void
  onUndo: (id: string, force?: boolean) => void
  onDismiss: () => void
}

const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'tagged' : 'untagged') : String(v))
const label = (i: ProposalItemView) => (i.op === 'set_field' ? i.slot : `tag “${i.slot}”`)

// Review panel for AI proposals: one-line diff per item, evidence, confidence, stale warnings, batch approve, undo after apply (design/06).
export function Proposals({ proposals, note, conflict, onApply, onReject, onUndo, onDismiss }: Props) {
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const chosen = (p: ProposalView) => picked[p.id] ?? p.items.filter((i) => i.status === 'pending' && !i.stale && i.confidence >= PRESELECT).map((i) => i.id)
  const pending = proposals.filter((p) => p.status === 'pending' || p.status === 'partially_applied')
  const done = proposals.filter((p) => p.status === 'applied' || p.status === 'undone')
  if (!proposals.length && !note) return null
  return (
    <div data-testid="proposals" className="flex flex-col gap-3 rounded border border-amber/50 bg-panel p-4">
      {note && <p className="text-text-2">{note}</p>}
      {pending.map((p) => (
        <section key={p.id} data-testid="proposal" className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <span className="font-reading text-sm font-semibold text-text">{p.title}</span>
            <span className="text-muted">{p.origin.toUpperCase()} · {p.model} · nothing applied yet</span>
          </div>
          <ul>
            {p.items
              .filter((i) => i.status === 'pending' || i.status === 'stale')
              .map((i) => (
                <li key={i.id} data-testid="proposal-item" className="flex items-start gap-2 border-t border-line py-2">
                  <input type="checkbox" aria-label={`Apply ${label(i)}`} checked={chosen(p).includes(i.id)} onChange={() => setPicked({ ...picked, [p.id]: toggle(chosen(p), i.id) })} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="mr-2 font-bold text-text-2">{label(i)}</span>
                    <s className="text-muted">{show(i.before)}</s> <span className="text-text">→ {show(i.after)}</span>
                    {i.stale && <span className="ml-2 font-bold text-amber">STALE · now “{show(i.current)}”, changed since this was proposed</span>}
                    <span className="block text-muted">{i.evidence}</span>
                  </span>
                  <span className={`rounded px-1.5 font-bold ${i.confidence >= PRESELECT ? 'bg-active text-green' : 'bg-active text-amber'}`}>{Math.round(i.confidence * 100)}%</span>
                </li>
              ))}
          </ul>
          <div className="flex gap-2">
            <button onClick={() => onApply(p.id, chosen(p))} disabled={!chosen(p).length} className="rounded bg-accent px-3 py-1 font-bold text-bg disabled:opacity-40">
              APPROVE {chosen(p).length} SELECTED
            </button>
            <button onClick={() => onReject(p.id)} className="rounded px-3 py-1 font-bold text-text-2">
              REJECT ALL
            </button>
          </div>
        </section>
      ))}
      {done.map((p) => (
        <div key={p.id} data-testid="applied-proposal" className="flex items-center gap-3 border-t border-line pt-2 text-text-2">
          <span className={p.status === 'undone' ? 'text-muted' : 'text-green'}>{p.status === 'undone' ? '↶' : '✓'}</span>
          <span className="min-w-0 flex-1 truncate">
            {p.title} · {p.items.filter((i) => i.status === 'applied').length} applied · {p.model} · {new Date(p.created_at).toLocaleString()}
            {p.status === 'undone' && ' · undone'}
          </span>
          {p.status !== 'undone' && conflict !== p.id && (
            <button onClick={() => onUndo(p.id)} className="font-bold text-accent">
              UNDO
            </button>
          )}
          {conflict === p.id && (
            <>
              <span className="text-amber">Changed since it was applied.</span>
              <button onClick={() => onUndo(p.id, true)} className="font-bold text-amber">
                RESTORE ANYWAY
              </button>
              <button onClick={onDismiss} className="font-bold text-text-2">
                KEEP CURRENT
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
