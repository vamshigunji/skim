import { useState } from 'react'
import { bibtex, cslJson, latexCite, pandocCite } from '../../shared/cite'
import type { CiteStyle, NoteView } from '../../shared/export'
import type { Paper } from '../../shared/types/db'
import { toggle } from '../reader/AnnotationsPanel'

interface Props {
  notes: NoteView[]
  receipt: string
  onOpen: (paperId: string, pageIndex: number) => void
  onExport: (paperId: string, ids: string[], style: CiteStyle) => void
  onCopy: (text: string) => void
  paper: (paperId: string) => Promise<Paper>
}

const matches = (n: NoteView, q: string) => !q || `${n.text ?? ''} ${n.comment ?? ''}`.toLowerCase().includes(q.toLowerCase())

// Every annotation across the library, grouped by paper, with export and citation copy (features/07 requirements 1 to 8).
export function Notes({ notes, receipt, onOpen, onExport, onCopy, paper }: Props) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [style, setStyle] = useState<CiteStyle>('pandoc')
  const shown = notes.filter((n) => matches(n, query))
  const papers = [...new Map(shown.map((n) => [n.paper_id, n])).values()]
  const copyAs = (paperId: string, form: (key: string, p: Paper) => string) => paper(paperId).then((p) => onCopy(form(p.citekey!, p)))

  return (
    <div className="flex h-full flex-col gap-4 p-8 text-[11px]">
      <div className="flex items-center gap-4">
        <h1 className="font-reading text-[28px] font-semibold">Notes</h1>
        <input value={query} placeholder="Filter quotes and comments" onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 rounded bg-raised px-3 py-2 placeholder:text-muted" />
        <label className="flex items-center gap-2 text-muted">
          citation
          <select aria-label="Citation style" value={style} onChange={(e) => setStyle(e.target.value as CiteStyle)} className="rounded bg-raised px-2 py-1 text-text">
            <option value="pandoc">Pandoc [@key]</option>
            <option value="latex">LaTeX \cite{'{key}'}</option>
          </select>
        </label>
      </div>
      {receipt && <p data-testid="export-receipt" className="text-green">{receipt}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && <p className="text-text-2">{notes.length ? 'No note matches.' : 'No notes yet. Select text in a paper and choose a mark or comment.'}</p>}
        {papers.map((p) => {
          const mine = shown.filter((n) => n.paper_id === p.paper_id)
          const chosen = mine.filter((n) => picked.includes(n.id)).map((n) => n.id)
          const count = chosen.length || mine.length
          return (
            <section key={p.paper_id} data-testid="notes-paper" className="mb-6">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h2 className="font-reading text-sm font-semibold text-text">{p.title ?? p.citekey}</h2>
                <span className="text-muted">@{p.citekey}</span>
                {(
                  [
                    ['BIBTEX', bibtex],
                    ['CSL', cslJson],
                    ['@KEY', (k: string) => pandocCite(k)],
                    ['\\CITE', (k: string) => latexCite(k)],
                  ] as const
                ).map(([name, form]) => (
                  <button key={name} aria-label={`Copy ${name} for ${p.citekey}`} onClick={() => copyAs(p.paper_id, form)} className="rounded bg-active px-2 py-0.5 font-bold text-text-2">
                    {name}
                  </button>
                ))}
                <button onClick={() => onExport(p.paper_id, chosen.length ? chosen : mine.map((n) => n.id), style)} className="ml-auto rounded bg-accent px-3 py-1 font-bold text-bg">
                  EXPORT {count} NOTE{count === 1 ? '' : 'S'} · MARKDOWN
                </button>
              </div>
              <ul>
                {mine.map((n) => (
                  <li key={n.id} data-testid="note" className="flex items-start gap-2 border-b border-line py-2">
                    <input type="checkbox" aria-label={`Select note ${n.text ?? n.id}`} checked={picked.includes(n.id)} onChange={() => setPicked(toggle(picked, n.id))} className="mt-1" />
                    <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: n.color ?? undefined }} />
                    <button onClick={() => onOpen(n.paper_id, n.page_index)} className="min-w-0 flex-1 text-left">
                      <span className="mr-2 text-[9px] font-bold uppercase text-muted">
                        {n.kind} · p. {n.page_label ?? `#${n.page_index + 1}`} · {new Date(n.created_at).toLocaleDateString()}
                      </span>
                      <span className="block font-reading text-xs text-text">{n.text}</span>
                      {n.comment && <span className="block text-text-2">{n.comment}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
