import { contextBridge, ipcRenderer } from 'electron'
import type { OpenedPdf, SkimApi } from './api'

// window.skim is the only bridge between renderer and main. Grows per task.
const api: SkimApi = {
  openDialog: () => ipcRenderer.invoke('open-dialog'),
  onOpen: (cb) => ipcRenderer.on('open-pdf', (_e, doc: OpenedPdf) => cb(doc)),
}
contextBridge.exposeInMainWorld('skim', api)
