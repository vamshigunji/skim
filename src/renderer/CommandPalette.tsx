import { useEffect, useRef, useState } from 'react'
import { keys, views, type ViewId } from './nav'

interface Props {
  mode: 'commands' | 'help'
  onNavigate: (view: ViewId) => void
  onClose: () => void
}

export function CommandPalette({ mode, onNavigate, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => input.current?.focus(), [])

  const commands = [
    ...views.map((v) => ({ id: v.id, label: `Go to ${v.label}`, hint: '', run: () => onNavigate(v.id) })),
    ...Object.values(keys).map((k) => ({ id: k.combo, label: k.label, hint: k.combo, run: onClose })),
  ]
  const shown = commands.filter(
    (c) => (mode === 'help' ? c.hint : true) && c.label.toLowerCase().includes(query.toLowerCase()),
  )
  const active = Math.min(index, shown.length - 1)

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, shown.length - 1))
    else if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0))
    else if (e.key === 'Enter' && shown[active]) {
      shown[active].run()
      onClose()
    } else if (e.key === 'Escape') onClose()
    else return
    e.preventDefault()
  }

  return (
    <div role="dialog" aria-label="Commands" className="fixed inset-0 z-10 bg-bg/70" onClick={onClose}>
      <div className="mx-auto mt-24 w-[560px] rounded border border-line bg-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          value={query}
          onChange={(e) => (setQuery(e.target.value), setIndex(0))}
          onKeyDown={onKey}
          placeholder={mode === 'help' ? 'Shortcuts' : 'Type a command…'}
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted"
        />
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto py-1">
          {shown.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setIndex(i)}
              onClick={() => (c.run(), onClose())}
              className={`flex justify-between px-4 py-2 text-sm ${i === active ? 'bg-active text-text' : 'text-text-2'}`}
            >
              <span>{c.label}</span>
              {c.hint && <span className="text-accent">{c.hint}</span>}
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-2 text-sm text-muted">No matches</li>}
        </ul>
      </div>
    </div>
  )
}
