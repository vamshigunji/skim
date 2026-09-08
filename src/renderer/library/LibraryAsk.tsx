import { AskPanel } from '../reader/AskPanel'
import { useAsk } from '../reader/useAsk'

interface Props {
  paperIds: string[] // empty means the whole library
  total: number
  onOpen: (paperId: string, pageIndex?: number) => void
  onClose: () => void
  onFind: (text: string) => void
}

// Cross-paper chat beside the library list. Scope stays visible above the question (features/06 requirement 10, flow 05.2).
export function LibraryAsk({ paperIds, total, onOpen, onClose, onFind }: Props) {
  const { messages, live, ask, stop } = useAsk({ paperIds })
  return (
    <aside data-testid="library-ask" className="flex w-[360px] shrink-0 flex-col gap-2 bg-panel p-4 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-muted">SCOPE · {paperIds.length ? `${paperIds.length} SELECTED` : `WHOLE LIBRARY · ${total}`} PAPER{(paperIds.length || total) === 1 ? '' : 'S'}</span>
        <button onClick={onClose} className="font-bold text-text-2">
          CLOSE
        </button>
      </div>
      <AskPanel messages={messages} live={live} label={(i) => `#${i + 1}`} selection={null} onAsk={(q) => ask(q)} onStop={stop} onJump={(page, _quote, paperId) => onOpen(paperId, page)} onFind={onFind} />
    </aside>
  )
}
