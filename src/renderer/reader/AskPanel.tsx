import { useState } from 'react'
import { splitAnchors } from '../../shared/anchors'
import type { AskMessage, Citation } from '../../shared/types/ai'

interface Props {
  messages: AskMessage[]
  live: AskMessage | null
  label: (pageIndex: number) => string
  selection: string | null
  onAsk: (question: string) => void
  onStop: () => void
  onJump: (pageIndex: number, quote: string) => void
  onFind: (text: string) => void
}

const STATE = { VERIFIED: ['VERIFIED', 'text-green'], PARTIAL: ['PARTIAL', 'text-amber'], NOT_FOUND: ['NOT FOUND', 'text-red'] } as const

export function AskPanel({ messages, live, label, selection, onAsk, onStop, onJump, onFind }: Props) {
  const [draft, setDraft] = useState('')
  const all = live ? [...messages, live] : messages
  return (
    <div data-testid="ask-panel" className="flex min-h-0 flex-1 flex-col gap-2 text-[11px]">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {all.length === 0 && <p className="text-muted">Ask about this paper. Every claim in the answer links to the page it came from.</p>}
        {all.map((m) => (m.role === 'user' ? <p key={m.id} className="whitespace-pre-wrap font-semibold text-text-2">{m.content}</p> : <Answer key={m.id} m={m} label={label} onJump={onJump} onFind={onFind} />))}
        {live && (
          <button onClick={onStop} className="self-start font-bold text-accent">
            STOP
          </button>
        )}
      </div>
      {selection && <p className="truncate text-muted">Selection attached · “{selection}”</p>}
      <textarea
        rows={2}
        value={draft}
        placeholder="Ask about this paper"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey || !draft.trim()) return
          e.preventDefault()
          onAsk(draft.trim())
          setDraft('')
        }}
        className="w-full resize-none rounded bg-raised px-2 py-1.5 placeholder:text-muted"
      />
      <p className="text-[10px] text-muted">ENTER ask     ⇧ENTER newline     ⌘\ close</p>
    </div>
  )
}

function Answer({ m, label, onJump, onFind }: { m: AskMessage; label: Props['label']; onJump: Props['onJump']; onFind: Props['onFind'] }) {
  const notFound = m.state === 'NOT_FOUND'
  const segs = splitAnchors(m.content.replace(/^NOT_FOUND\s*/, ''))
  const verified = m.citations.filter((c) => c.verified).length
  let k = 0
  const chip = (c: Citation | undefined, raw: string, i: number) => {
    if (!c) return <span key={i}>{raw}</span>
    return c.verified ? (
      <button key={i} data-testid="citation-chip" title={c.quote} onClick={() => onJump(c.pageIndex, c.quote)} className="mx-0.5 rounded bg-active px-1 font-ui text-[10px] font-bold text-accent">
        p. {label(c.pageIndex)}
      </button>
    ) : (
      <button key={i} data-testid="citation-chip" aria-label="Find exact text" title={`Quote not found in source: “${c.quote}”. Click to search for it.`} onClick={() => onFind(c.quote)} className="mx-0.5 rounded bg-active px-1 font-ui text-[10px] font-bold text-amber">
        ⚠ not found
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-1 border-l-2 border-line pl-2">
      {m.state && (
        <span data-testid="answer-state" className={`text-[10px] font-bold ${STATE[m.state][1]}`}>
          {STATE[m.state][0]}
        </span>
      )}
      <p className="font-reading text-xs leading-relaxed text-text">{segs.map((s, i) => ('text' in s ? <span key={i}>{s.text}</span> : chip(m.citations[k++], `[[c:${s.n} "${s.quote}"]]`, i)))}</p>
      {m.state && (
        <p data-testid="answer-footer" className="text-[10px] text-muted">
          {notFound ? 'Not found in this paper. ' : `${verified} of ${m.citations.length} claims verified against the page text. `}
          {notFound && (
            <button onClick={() => onFind(m.content.replace(/^NOT_FOUND\s*/, ''))} className="text-accent">
              Search exact text instead
            </button>
          )}
        </p>
      )}
    </div>
  )
}
