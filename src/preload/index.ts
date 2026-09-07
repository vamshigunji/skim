import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { SkimApi } from './api'

// window.skim is the only bridge between renderer and main. Grows per task.
const api: SkimApi = {
  library: {
    list: () => ipcRenderer.invoke('library.list'),
    import: (paths) => ipcRenderer.invoke('library.import', paths),
    open: (id) => ipcRenderer.invoke('library.open', id),
  },
  importDialog: () => ipcRenderer.invoke('import-dialog'),
  search: (req) => ipcRenderer.invoke('search.exact', req),
  annotations: {
    list: (path) => ipcRenderer.invoke('annotations.list', path),
    upsert: (path, a) => ipcRenderer.invoke('annotations.upsert', path, a),
    delete: (id) => ipcRenderer.invoke('annotations.delete', id),
  },
  onOpen: (cb) => ipcRenderer.on('open-paper', (_e, id: string) => cb(id)),
  references: (path) => ipcRenderer.invoke('references.list', path),
  regions: (path) => ipcRenderer.invoke('regions.list', path),
  pathsFor: (files) => files.map((f) => webUtils.getPathForFile(f)),
}
contextBridge.exposeInMainWorld('skim', api)
