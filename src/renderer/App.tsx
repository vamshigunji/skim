import { useEffect, useState } from 'react'
import { CommandPalette } from './CommandPalette'
import { keys, smartViews, views, type ViewId } from './nav'

export function App() {
  const [view, setView] = useState<ViewId>('library')
  const [palette, setPalette] = useState<'commands' | 'help' | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'k') setPalette('commands')
      else if (e.key === '?' && !(e.target instanceof HTMLInputElement)) setPalette('help')
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const active = views.find((v) => v.id === view)!

  return (
    <div className="flex h-screen flex-col bg-bg font-ui text-text">
      <header className="flex h-14 shrink-0 items-center gap-6 bg-raised px-6 text-[11px]">
        <span className="text-lg font-bold">SKIM</span>
        <span className="text-text-2">{active.label.toUpperCase()}</span>
        <span className="ml-auto font-semibold text-accent">OLLAMA · LOCAL</span>
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
            <button key={s} className="flex h-8 items-center px-2.5 text-left">
              {s}
            </button>
          ))}
          <span className="mt-auto pb-4 text-[10px] text-muted">
            {keys.palette.combo} {keys.palette.label.toUpperCase()}
          </span>
        </nav>

        <main className="relative flex-1 p-8">
          <h1 className="font-reading text-[28px] font-semibold">{active.label}</h1>
          <p className="absolute bottom-6 left-8 text-[10px] text-text-2">
            {Object.values(keys).map((k) => `${k.combo} ${k.label}`).join('     ')}
          </p>
        </main>
      </div>

      {palette && <CommandPalette mode={palette} onNavigate={setView} onClose={() => setPalette(null)} />}
    </div>
  )
}
