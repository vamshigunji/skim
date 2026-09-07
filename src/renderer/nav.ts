import { BookOpen, Library, Layers2, NotebookPen } from 'lucide-react'

export const views = [
  { id: 'library', label: 'Library', icon: Library },
  { id: 'queue', label: 'Reading queue', icon: BookOpen },
  { id: 'collections', label: 'Collections', icon: Layers2 },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
] as const

export type ViewId = (typeof views)[number]['id']

// Smart views are saved filters over the library. Counts arrive with T04.
export const smartViews = ['To read', 'Skimming', 'Cited']

// Single source of truth for global keys. The hint line and the handler both read this.
export const keys = {
  palette: { combo: '⌘K', label: 'commands' },
  help: { combo: '?', label: 'shortcuts' },
  close: { combo: 'Esc', label: 'close' },
}
