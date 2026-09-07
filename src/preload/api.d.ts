import type { ImportResult, LibraryItem } from '../shared/types/library'
import type { SearchHit, SearchRequest } from '../shared/types/search'
import type { AnnotationInput } from '../shared/annot'
import type { Annotation } from '../shared/types/db'

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
  search: (req: SearchRequest) => Promise<SearchHit[]>
  annotations: {
    list: (path: string) => Promise<Annotation[]>
    upsert: (path: string, a: AnnotationInput) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  onOpen: (cb: (paperId: string) => void) => void
  pathsFor: (files: File[]) => string[]
}

declare global {
  interface Window {
    skim?: SkimApi
  }
}
