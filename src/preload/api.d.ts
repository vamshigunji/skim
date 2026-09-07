export interface OpenedPdf {
  path: string
  data: Uint8Array
}

export interface SkimApi {
  openDialog: () => Promise<OpenedPdf | null>
  onOpen: (cb: (doc: OpenedPdf) => void) => void
}

declare global {
  interface Window {
    skim?: SkimApi
  }
}
