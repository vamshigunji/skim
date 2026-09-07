import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ChatDelta } from '../shared/types/ai'
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
  ai: {
    providers: () => ipcRenderer.invoke('ai.providers'),
    setProvider: (cfg) => ipcRenderer.invoke('ai.setProvider', cfg),
    setKey: (id, key) => ipcRenderer.invoke('ai.setKey', id, key),
    enabled: () => ipcRenderer.invoke('ai.enabled'),
    setEnabled: (on) => ipcRenderer.invoke('ai.setEnabled', on),
    confirmEgress: (id) => ipcRenderer.invoke('ai.confirmEgress', id),
    ask: (req, onDelta) => {
      const channel = `ai.stream:${req.requestId}`
      const listener = (_e: unknown, d: ChatDelta) => {
        onDelta(d)
        if (d.type === 'done' || d.type === 'error') ipcRenderer.removeListener(channel, listener)
      }
      ipcRenderer.on(channel, listener)
      return ipcRenderer.invoke('ai.ask', req).catch((e) => {
        ipcRenderer.removeListener(channel, listener)
        throw e
      })
    },
    cancel: (id) => ipcRenderer.invoke('ai.cancel', id),
    usage: () => ipcRenderer.invoke('ai.usage'),
  },
}
contextBridge.exposeInMainWorld('skim', api)
