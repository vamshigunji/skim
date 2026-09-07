import type { LibraryItem } from '../../shared/types/library'

interface Props {
  items: LibraryItem[]
  onOpen: (paperId: string) => void
  onImport: () => void
}

// Plain-language reasons for the status panel. Requirement 8 in features/06.
const reasons: Record<string, string> = {
  no_text_layer: 'no text layer',
  encrypted: 'encrypted',
  too_large: 'over 200 MB',
  parse_error: 'parse error',
}

const stageLabels: [string, LibraryItem['stage']][] = [
  ['Ready', 'ready'],
  ['Skipped', 'skipped'],
  ['Failed', 'failed'],
]

export function Library({ items, onOpen, onImport }: Props) {
  const notReady = items.filter((i) => i.stage && i.stage !== 'ready')
  return (
    <div className="flex h-full flex-col gap-6 p-8 text-[11px]">
      <div className="flex items-center gap-4">
        <h1 className="font-reading text-[28px] font-semibold">Library</h1>
        <button onClick={onImport} className="ml-auto rounded bg-accent px-4 py-2 text-[10px] font-bold text-bg">
          IMPORT PDFs +
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded border border-dashed border-line bg-panel">
          <p className="font-reading text-lg text-text">Drop PDFs here</p>
          <p className="text-text-2">or choose files from your computer</p>
          <button onClick={onImport} className="mt-2 rounded bg-accent px-4 py-2 text-[10px] font-bold text-bg">
            CHOOSE PDFs…
          </button>
          <p className="mt-4 text-muted">No account required. AI setup can wait.</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-6">
          <ul className="min-w-0 flex-1 overflow-y-auto">
            <li className="mb-2 font-semibold text-muted">READING QUEUE / {String(items.length).padStart(2, '0')} PAPERS</li>
            {items.map((i) => (
              <li key={i.paper_id} className="border-b border-line">
                <button onClick={() => onOpen(i.paper_id)} className="flex w-full items-center gap-4 py-4 text-left">
                  <span className="min-w-0 flex-1 truncate font-reading text-sm font-semibold text-text">{i.title}</span>
                  <span className="text-muted">
                    {i.year ?? '—'} · {i.page_count ?? '?'} pp
                  </span>
                  <span className={`w-20 text-right font-semibold ${i.reading_status === 'to_read' ? 'text-amber' : 'text-accent'}`}>
                    {i.reading_status.replace('_', ' ').toUpperCase()}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <aside data-testid="index-status" className="flex w-[320px] shrink-0 flex-col gap-3 rounded bg-panel p-5">
            <span className="font-semibold text-muted">INDEX STATUS</span>
            <span className="text-[34px] font-bold text-text">{items.filter((i) => i.stage === 'ready').length}</span>
            <span className="font-reading text-xs text-muted">papers ready to search</span>
            {stageLabels.map(([label, stage]) => (
              <span key={stage} className="flex justify-between text-muted">
                {label}
                <span className={`font-bold ${stage === 'ready' ? 'text-accent' : stage === 'skipped' ? 'text-amber' : stage === 'failed' ? 'text-red' : ''}`}>
                  {items.filter((i) => i.stage === stage).length}
                </span>
              </span>
            ))}
            {notReady.length > 0 && (
              <ul className="mt-2 border-t border-line pt-3 text-text-2">
                {notReady.map((i) => (
                  <li key={i.paper_id} className="truncate">
                    {i.title}: {i.error ?? reasons[i.skip_reason ?? ''] ?? i.stage}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
