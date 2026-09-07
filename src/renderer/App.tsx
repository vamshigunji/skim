import { useEffect, useState } from 'react'
import type { OpenedPdf } from '../preload/api'
import type { ImportResult, LibraryItem } from '../shared/types/library'
import type { SearchHit } from '../shared/types/search'
import type { ProviderStatus, UsageSummary } from '../shared/types/ai'
import { Settings } from './settings/Settings'
import { CommandPalette } from './CommandPalette'
import { Library } from './library/Library'
import { Notes } from './notes/Notes'
import type { NoteView } from '../shared/export'
import { keys, smartViews, views, type ViewId } from './nav'
import { Reader } from './reader/Reader'

const counts: Record<string, LibraryItem['reading_status']> = { 'To read': 'to_read', Skimming: 'skimming', Cited: 'cited' }

export function App() {
  const [view, setView] = useState<ViewId>('library')
  const [palette, setPalette] = useState<'commands' | 'help' | null>(null)
  const [doc, setDoc] = useState<OpenedPdf | null>(null)
  const [items, setItems] = useState<LibraryItem[]>([])
  const [results, setResults] = useState<SearchHit[] | null>(null)
  const [openAt, setOpenAt] = useState<number | undefined>()
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [aiOn, setAiOn] = useState(true)
  const [usage, setUsage] = useState<UsageSummary>({ requests: 0, input: 0, output: 0, cost_usd: 0 })
  const [testOutput, setTestOutput] = useState('')
  const [notes, setNotes] = useState<NoteView[]>([])
  const [receipt, setReceipt] = useState('')

  const loadAi = () => {
    window.skim?.ai.providers().then(setProviders)
    window.skim?.ai.enabled().then(setAiOn)
    window.skim?.ai.usage().then(setUsage)
  }
  const runTest = (id: string) => {
    setTestOutput('…')
    let out = ''
    window.skim?.ai
      .ask({ requestId: crypto.randomUUID(), providerId: id, purpose: 'test', messages: [{ role: 'user', content: 'Reply with a short greeting.' }] }, (d) => {
        if (d.type === 'text') out += d.text
        else if (d.type === 'error') out += `\n[${d.message}]`
        setTestOutput(out)
        if (d.type === 'done' || d.type === 'error') loadAi()
      })
      .catch((e: Error) => setTestOutput(`[${e.message}]`))
  }
  const defaultProvider = providers.find((p) => p.is_default)
  const modelLabel = !aiOn ? 'AI OFF' : defaultProvider ? `${defaultProvider.kind.toUpperCase()} · ${defaultProvider.model ?? (defaultProvider.local ? 'LOCAL' : 'no model')}` : 'OLLAMA · LOCAL'

  const refresh = () => window.skim?.library.list().then(setItems)
  const openPaper = (id: string, pageIndex?: number) =>
    window.skim?.library.open(id).then((d) => {
      if (!d) return
      setDoc(d)
      setOpenAt(pageIndex)
      setView('reading')
    })
  const imported = (r: ImportResult[]) => {
    refresh()
    if (r[0]) openPaper(r[0].paperId)
  }

  useEffect(() => {
    refresh()
    loadAi()
    window.skim?.onOpen((id) => openPaper(id))
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'k') setPalette('commands')
      else if (e.metaKey && e.key === 'o') window.skim?.importDialog().then(imported)
      else if (e.key === '?' && !(e.target instanceof HTMLInputElement)) setPalette('help')
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (view === 'notes') window.skim?.notes.list().then(setNotes)
  }, [view])
  const active = views.find((v) => v.id === view)!
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const paths = window.skim?.pathsFor([...e.dataTransfer.files]).filter((p) => p.toLowerCase().endsWith('.pdf')) ?? []
    if (paths.length) window.skim?.library.import(paths).then(imported)
  }

  return (
    <div className="flex h-screen flex-col bg-bg font-ui text-text" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <header className="flex h-14 shrink-0 items-center gap-6 bg-raised px-6 text-[11px]">
        <span className="text-lg font-bold">SKIM</span>
        <span className="text-text-2">{active.label.toUpperCase()}</span>
        <span className={`ml-auto font-semibold ${aiOn ? 'text-accent' : 'text-muted'}`}>{modelLabel}</span>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Workspace" className="flex w-[206px] shrink-0 flex-col gap-2 bg-panel px-[18px] pt-7 text-xs">
          <span className="px-2.5 text-[10px] font-semibold text-muted">WORKSPACE</span>
          {views.map((v) => (
            <button
              key={v.id}
              aria-current={v.id === view ? 'page' : undefined}
              onClick={() => setView(v.id)}
              className={`flex h-10 items-center gap-2.5 rounded px-2.5 text-left ${v.id === view ? 'bg-active font-semibold text-text' : 'text-muted'}`}
            >
              <v.icon size={16} className={v.id === view ? 'text-accent' : ''} />
              {v.label}
            </button>
          ))}
          <span className="mt-4 px-2.5 text-[10px] font-semibold text-muted">SMART VIEWS</span>
          {smartViews.map((s) => (
            <button key={s} className="flex h-8 items-center justify-between px-2.5 text-left">
              {s}
              <span className="text-[11px] font-semibold text-muted">{String(items.filter((i) => i.reading_status === counts[s]).length).padStart(2, '0')}</span>
            </button>
          ))}
          <span className="mt-auto pb-4 text-[10px] text-muted">
            {keys.palette.combo} {keys.palette.label.toUpperCase()}
          </span>
        </nav>

        <main className="relative min-w-0 flex-1">
          {view === 'reading' && doc ? (
            <Reader key={doc.path} path={doc.path} data={doc.data} initialPage={openAt} onOpenPaper={openPaper} />
          ) : view === 'settings' ? (
            <Settings
              providers={providers}
              enabled={aiOn}
              usage={usage}
              testOutput={testOutput}
              onToggle={(on) => window.skim?.ai.setEnabled(on).then(loadAi)}
              onSetKey={(id, key) => window.skim?.ai.setKey(id, key || null).then(loadAi)}
              onSetProvider={(cfg) => window.skim?.ai.setProvider(cfg).then(loadAi)}
              onConfirmEgress={(id) => window.skim?.ai.confirmEgress(id).then(loadAi)}
              onTest={runTest}
            />
          ) : view === 'notes' ? (
            <Notes
              notes={notes}
              receipt={receipt}
              onOpen={openPaper}
              paper={(id) => window.skim!.notes.paper(id)}
              onCopy={(text) => navigator.clipboard.writeText(text).then(() => setReceipt(`Copied: ${text.split('\n')[0]}`))}
              onExport={(paperId, ids, style) =>
                window.skim?.notes.export({ paperId, ids, style }).then((r) => setReceipt(r ? `✓ ${r.path} · ${r.count} note${r.count === 1 ? '' : 's'} · re-export updates in place` : ''))
              }
            />
          ) : view === 'library' || view === 'queue' ? (
            <Library
              items={view === 'queue' ? items.filter((i) => i.reading_status === 'to_read' || i.reading_status === 'skimming') : items}
              results={results}
              onOpen={openPaper}
              onImport={() => window.skim?.importDialog().then(imported)}
              onSearch={(q) => (q ? window.skim?.search({ query: q, options: {} }).then(setResults) : setResults(null))}
            />
          ) : (
            <div className="p-8">
              <h1 className="font-reading text-[28px] font-semibold">{active.label}</h1>
              {view === 'reading' && <p className="mt-2 text-sm text-text-2">No paper open. Press {keys.open.combo} to open a PDF.</p>}
              <p className="absolute bottom-6 left-8 text-[10px] text-text-2">
                {Object.values(keys).map((k) => `${k.combo} ${k.label}`).join('     ')}
              </p>
            </div>
          )}
        </main>
      </div>

      {palette && <CommandPalette mode={palette} onNavigate={setView} onClose={() => setPalette(null)} />}
    </div>
  )
}
