import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import extractWorkerPath from './services/extract.worker?modulePath'
import { createIndexer } from './services/indexer'
import type { Probe } from './services/extract'
import { openDb } from './db'
import { listLibrary, openPaper } from './services/library'
import { searchExact } from './services/search'
import { deleteAnnotation, listAnnotations, upsertAnnotation } from './services/annotations'
import { listReferences, listRegions } from './services/references'
import { exportMarkdown, listNotes, paperWithCitekey, type ExportRequest } from './services/notes'
import { createKeychain } from './services/ai/keys'
import { createAiService } from './services/ai/service'
import { askGrounded, listThread } from './services/ai/ask'
import { listSkim, runSkim } from './services/ai/skim'
import { proposeEdits } from './services/ai/propose'
import { applyProposal, listProposals, rejectProposal, undoProposal } from './services/proposals'
import type { AskRequest, GroundedAsk, ProviderConfig } from '../shared/types/ai'
import type { AnnotationInput } from '../shared/annot'
import type { SearchRequest } from '../shared/types/search'

if (process.env.SKIM_USER_DATA) app.setPath('userData', process.env.SKIM_USER_DATA)

app.whenReady().then(() => {
  const db = openDb(join(app.getPath('userData'), 'library.db'))
  const broadcast = (channel: string, delta: unknown) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, delta))
  const ai = createAiService(db, createKeychain(app.getPath('userData'), safeStorage), broadcast)
  // Extraction never runs on the main thread (design/07): one worker per file, so a parser crash isolates to that file.
  const extract = (data: Buffer) =>
    new Promise<Probe>((resolve, reject) => {
      const w = new Worker(extractWorkerPath)
      w.once('message', (m: { ok?: Probe; error?: { name: string; message: string } }) => (m.ok ? resolve(m.ok) : reject(Object.assign(new Error(m.error!.message), { name: m.error!.name }))))
      w.once('error', reject)
      w.postMessage(data)
    })
  const indexer = createIndexer(db, extract, (r) => broadcast('index.status', r))

  ipcMain.handle('ai.providers', () => ai.providers())
  ipcMain.handle('ai.setProvider', (_e, cfg: ProviderConfig) => ai.setProvider(cfg))
  ipcMain.handle('ai.setKey', (_e, id: string, key: string | null) => ai.setKey(id, key))
  ipcMain.handle('ai.enabled', () => ai.enabled())
  ipcMain.handle('ai.setEnabled', (_e, on: boolean) => ai.setEnabled(on))
  ipcMain.handle('ai.confirmEgress', (_e, id: string) => ai.confirmEgress(id))
  ipcMain.handle('ai.ask', (_e, req: AskRequest) => ai.ask(req))
  ipcMain.handle('ai.askGrounded', (_e, req: GroundedAsk) => askGrounded(db, ai, req, (d) => broadcast(`ai.stream:${req.requestId}`, d)))
  ipcMain.handle('ai.thread', (_e, path?: string) => listThread(db, path))
  ipcMain.handle('ai.skim', (_e, req: { requestId: string; path: string }) => runSkim(db, ai, req))
  ipcMain.handle('ai.skimList', (_e, path: string) => listSkim(db, path))
  ipcMain.handle('ai.propose', (_e, req: { requestId: string; paperId: string }) => proposeEdits(db, ai, req))
  ipcMain.handle('proposals.list', () => listProposals(db))
  ipcMain.handle('proposals.apply', (_e, id: string, itemIds: string[], force?: boolean) => applyProposal(db, id, itemIds, force))
  ipcMain.handle('proposals.reject', (_e, id: string) => rejectProposal(db, id))
  ipcMain.handle('proposals.undo', (_e, id: string, force?: boolean) => undoProposal(db, id, force))
  ipcMain.handle('ai.cancel', (_e, id: string) => ai.cancel(id))
  ipcMain.handle('ai.usage', () => ai.usage())

  ipcMain.handle('library.list', () => listLibrary(db))
  ipcMain.handle('library.import', (_e, paths: string[]) => indexer.enqueue(paths))
  ipcMain.handle('library.open', (_e, id: string) => openPaper(db, id))
  ipcMain.handle('search.exact', (_e, req: SearchRequest) => searchExact(db, req))
  ipcMain.handle('annotations.list', (_e, path: string) => listAnnotations(db, path))
  ipcMain.handle('annotations.upsert', (_e, path: string, a: AnnotationInput) => upsertAnnotation(db, path, a))
  ipcMain.handle('annotations.delete', (_e, id: string) => deleteAnnotation(db, id))
  ipcMain.handle('references.list', (_e, path: string) => listReferences(db, path))
  ipcMain.handle('regions.list', (_e, path: string) => listRegions(db, path))
  ipcMain.handle('notes.list', () => listNotes(db))
  ipcMain.handle('notes.paper', (_e, paperId: string) => paperWithCitekey(db, paperId))
  ipcMain.handle('notes.export', async (_e, req: Omit<ExportRequest, 'path'> & { path?: string }) => {
    const path = req.path ?? (await dialog.showSaveDialog({ defaultPath: `${paperWithCitekey(db, req.paperId).citekey}-notes.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] })).filePath
    return path ? exportMarkdown(db, { ...req, path }) : null
  })
  ipcMain.handle('import-dialog', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    return r.canceled ? [] : indexer.enqueue(r.filePaths)
  })

  const createWindow = () => {
    const win = new BrowserWindow({
      width: 1280,
      height: 860,
      useContentSize: true,
      backgroundColor: '#1A1B26',
      webPreferences: { preload: join(__dirname, '../preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    // The renderer never navigates or opens windows; every link goes through main (design/08).
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (e) => e.preventDefault())
    if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
    else win.loadFile(join(__dirname, '../renderer/index.html'))

    const fromCli = process.argv.slice(1).find((a) => a.toLowerCase().endsWith('.pdf'))
    if (fromCli)
      win.webContents.on('did-finish-load', async () => {
        const [r] = await indexer.enqueue([fromCli], 0)
        win.webContents.send('open-paper', r.paperId)
      })
  }

  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
