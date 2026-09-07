import type { Filter } from './AnnotationsPanel'

export interface Position {
  page: number
  zoom: number
  offset?: number
  filter?: Filter
}

// Per-document view state keyed by path. Lives in the renderer until the sidecar lands with T04.
export const loadPosition = (path: string): Position | null => JSON.parse(localStorage.getItem(`skim.pos:${path}`) ?? 'null')
export const savePosition = (path: string, pos: Position) => localStorage.setItem(`skim.pos:${path}`, JSON.stringify(pos))
