import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AskResult } from '../shared/types/ai'
import type { ImportResult } from '../shared/types/library'
import type { SkimApi } from './api'

// Deltas for one request arrive on ai.stream:<requestId> until done or error.
function streamed<D extends { type: string }>(name: string, req: { requestId: string }, onDelta: (d: D) => void): Promise<AskResult> {
  const channel = `ai.stream:${req.requestId}`
  const stop = () => ipcRenderer.removeListener(channel, listener)
  const listener = (_e: unknown, d: D) => {
    onDelta(d)
    if (d.type === 'done' || d.type === 'error') stop()
  }
  ipcRenderer.on(channel, listener)
  return ipcRenderer.invoke(name, req).then(
    (r: AskResult) => {
      if ('needsConfirmation' in r) stop()
      return r
    },
    (e) => {
      stop()
      throw e
    },
  )
}

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
  notes: {
    list: () => ipcRenderer.invoke('notes.list'),
    paper: (id) => ipcRenderer.invoke('notes.paper', id),
    export: (req) => ipcRenderer.invoke('notes.export', req),
  },
  proposals: {
    list: () => ipcRenderer.invoke('proposals.list'),
    apply: (id, itemIds, force) => ipcRenderer.invoke('proposals.apply', id, itemIds, force),
    reject: (id) => ipcRenderer.invoke('proposals.reject', id),
    undo: (id, force) => ipcRenderer.invoke('proposals.undo', id, force),
  },
  onIndexStatus: (cb) => ipcRenderer.on('index.status', (_e, r: ImportResult) => cb(r)),
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
    ask: (req, onDelta) => streamed('ai.ask', req, onDelta),
    askGrounded: (req, onDelta) => streamed('ai.askGrounded', req, onDelta),
    thread: (path) => ipcRenderer.invoke('ai.thread', path),
    skim: (req) => ipcRenderer.invoke('ai.skim', req),
    skimList: (path) => ipcRenderer.invoke('ai.skimList', path),
    propose: (req) => ipcRenderer.invoke('ai.propose', req),
    cancel: (id) => ipcRenderer.invoke('ai.cancel', id),
    usage: () => ipcRenderer.invoke('ai.usage'),
  },
}
contextBridge.exposeInMainWorld('skim', api)
