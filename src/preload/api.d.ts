import type { ImportResult, LibraryItem } from '../shared/types/library'

export interface OpenedPdf {
  path: string
  data: Uint8Array
}

export interface SkimApi {
  library: {
    list: () => Promise<LibraryItem[]>
    import: (paths: string[]) => Promise<ImportResult[]>
    open: (paperId: string) => Promise<OpenedPdf | null>
  }
  importDialog: () => Promise<ImportResult[]>
  onOpen: (cb: (paperId: string) => void) => void
  pathsFor: (files: File[]) => string[]
}

declare global {
  interface Window {
    skim?: SkimApi
  }
}
