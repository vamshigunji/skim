import type { ImportResult, LibraryItem } from '../shared/types/library'
import type { SearchHit, SearchRequest } from '../shared/types/search'
import type { AnnotationInput } from '../shared/annot'
import type { Annotation } from '../shared/types/db'
import type { ReferenceView, RegionView } from '../shared/types/references'
import type { SkimItem } from '../shared/skim'
import type { AskDelta, AskMessage, AskRequest, AskResult, ChatDelta, GroundedAsk, ProviderConfig, ProviderStatus, UsageSummary } from '../shared/types/ai'

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
  references: (path: string) => Promise<ReferenceView[]>
  regions: (path: string) => Promise<RegionView[]>
  pathsFor: (files: File[]) => string[]
  ai: {
    providers: () => Promise<ProviderStatus[]>
    setProvider: (cfg: ProviderConfig) => Promise<void>
    setKey: (id: string, key: string | null) => Promise<void>
    enabled: () => Promise<boolean>
    setEnabled: (on: boolean) => Promise<void>
    confirmEgress: (id: string) => Promise<void>
    ask: (req: AskRequest, onDelta: (d: ChatDelta) => void) => Promise<AskResult>
    askGrounded: (req: GroundedAsk, onDelta: (d: AskDelta) => void) => Promise<AskResult>
    thread: (path: string) => Promise<AskMessage[]>
    skim: (req: { requestId: string; path: string }) => Promise<SkimItem[] | Extract<AskResult, { needsConfirmation: true }>>
    skimList: (path: string) => Promise<SkimItem[]>
    cancel: (requestId: string) => Promise<void>
    usage: () => Promise<UsageSummary>
  }
}

declare global {
  interface Window {
    skim?: SkimApi
  }
}
