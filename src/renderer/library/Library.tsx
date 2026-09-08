import { useState, type ReactNode } from 'react'
import type { LibraryItem } from '../../shared/types/library'
import type { SearchHit } from '../../shared/types/search'
import { toggle } from '../reader/AnnotationsPanel'
import { LibraryAsk } from './LibraryAsk'

interface Props {
  items: LibraryItem[]
  results: SearchHit[] | null
  onOpen: (paperId: string, pageIndex?: number) => void
  onImport: () => void
  onSearch: (query: string) => void
  onPropose: (paperId: string) => void
  banner?: ReactNode
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

export function Library({ items, results, onOpen, onImport, onSearch, onPropose, banner }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [asking, setAsking] = useState(false)
  const notReady = items.filter((i) => i.stage && i.stage !== 'ready')
  const byPaper = new Map<string, SearchHit[]>()
  for (const h of results ?? []) byPaper.set(h.paper_id, [...(byPaper.get(h.paper_id) ?? []), h])

  return (
    <div className="flex h-full flex-col gap-6 p-8 text-[11px]">
      <div className="flex items-center gap-4">
        <input
          value={query}
          placeholder="Search papers…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch(query)}
          className="min-w-0 flex-1 rounded bg-raised px-4 py-3 text-[13px] placeholder:text-muted"
        />
        <button onClick={() => setAsking(true)} className="rounded bg-active px-4 py-2 text-[10px] font-bold text-accent">
          ASK {selected.length ? `${selected.length} PAPERS` : 'LIBRARY'}
        </button>
        <button onClick={onImport} className="rounded bg-accent px-4 py-2 text-[10px] font-bold text-bg">
          IMPORT PDFs +
        </button>
      </div>

      {banner}
      {results ? (
        <div data-testid="search-results" className="min-h-0 flex-1 overflow-y-auto">
          <p className="mb-2 font-semibold text-muted">
            EXACT SEARCH / {results.length} HITS IN {byPaper.size} PAPERS
          </p>
          {results.length === 0 && <p className="text-text-2">No matches. Exact search only; check spelling or try a shorter query.</p>}
          {[...byPaper].map(([paperId, hits]) => (
            <section key={paperId} className="mb-4">
              <h2 className="font-reading text-sm font-semibold text-text">{hits[0].title}</h2>
              {hits.map((h, k) => (
                <button key={k} onClick={() => onOpen(paperId, h.page_index)} className="block w-full truncate py-1 text-left text-text-2 hover:text-text">
                  <span className="mr-3 font-semibold text-accent">p. {h.label}</span>
                  {h.before}
                  <mark className="bg-amber/40 text-text">{h.match}</mark>
                  {h.after}
                </button>
              ))}
            </section>
          ))}
        </div>
      ) : items.length === 0 ? (
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
              <li key={i.paper_id} data-testid="paper-row" className="flex items-center gap-2 border-b border-line">
                <input type="checkbox" aria-label={`Select ${i.title}`} checked={selected.includes(i.paper_id)} onChange={() => setSelected(toggle(selected, i.paper_id))} />
                <button onClick={() => onOpen(i.paper_id)} className="flex min-w-0 flex-1 items-center gap-4 py-4 text-left">
                  <span className="min-w-0 flex-1 truncate font-reading text-sm font-semibold text-text">
                    {i.title}
                    {i.tags && <span className="ml-2 font-ui text-[10px] font-normal text-accent">{i.tags}</span>}
                  </span>
                  <span className="text-muted">
                    {i.year ?? '—'} · {i.page_count ?? '?'} pp
                  </span>
                  <span className={`w-20 text-right font-semibold ${i.reading_status === 'to_read' ? 'text-amber' : 'text-accent'}`}>
                    {i.reading_status.replace('_', ' ').toUpperCase()}
                  </span>
                </button>
                <button aria-label={`Suggest fixes for ${i.title}`} onClick={() => onPropose(i.paper_id)} className="shrink-0 rounded px-2 py-1 text-[10px] font-bold text-muted hover:text-accent">
                  AI FIX
                </button>
              </li>
            ))}
          </ul>

          {asking && <LibraryAsk paperIds={selected} total={items.length} onOpen={onOpen} onClose={() => setAsking(false)} onFind={onSearch} />}
          <aside data-testid="index-status" className="flex w-[320px] shrink-0 flex-col gap-3 rounded bg-panel p-5">
            <span className="font-semibold text-muted">INDEX STATUS</span>
            <span className="text-[34px] font-bold text-text">{items.filter((i) => i.stage === 'ready').length}</span>
            <span className="font-reading text-xs text-muted">papers ready to search</span>
            {stageLabels.map(([label, stage]) => (
              <span key={stage} className="flex justify-between text-muted">
                {label}
                <span className={`font-bold ${stage === 'ready' ? 'text-accent' : stage === 'skipped' ? 'text-amber' : 'text-red'}`}>
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
