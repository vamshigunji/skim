import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import { join } from 'node:path'
import { openDb } from './db'
import { importPdfs, listLibrary, openPaper } from './services/library'
import { searchExact } from './services/search'
import { deleteAnnotation, listAnnotations, upsertAnnotation } from './services/annotations'
import { listReferences, listRegions } from './services/references'
import { exportMarkdown, listNotes, paperWithCitekey, type ExportRequest } from './services/notes'
import { createKeychain } from './services/ai/keys'
import { createAiService } from './services/ai/service'
import { askGrounded, listThread } from './services/ai/ask'
import { listSkim, runSkim } from './services/ai/skim'
import type { AskDelta, AskRequest, GroundedAsk, ProviderConfig } from '../shared/types/ai'
import type { AnnotationInput } from '../shared/annot'
import type { SearchRequest } from '../shared/types/search'

if (process.env.SKIM_USER_DATA) app.setPath('userData', process.env.SKIM_USER_DATA)

app.whenReady().then(() => {
  const db = openDb(join(app.getPath('userData'), 'library.db'))
  const broadcast = (channel: string, delta: AskDelta) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, delta))
  const ai = createAiService(db, createKeychain(app.getPath('userData'), safeStorage), broadcast)
  ipcMain.handle('ai.providers', () => ai.providers())
  ipcMain.handle('ai.setProvider', (_e, cfg: ProviderConfig) => ai.setProvider(cfg))
  ipcMain.handle('ai.setKey', (_e, id: string, key: string | null) => ai.setKey(id, key))
  ipcMain.handle('ai.enabled', () => ai.enabled())
  ipcMain.handle('ai.setEnabled', (_e, on: boolean) => ai.setEnabled(on))
  ipcMain.handle('ai.confirmEgress', (_e, id: string) => ai.confirmEgress(id))
  ipcMain.handle('ai.ask', (_e, req: AskRequest) => ai.ask(req))
  ipcMain.handle('ai.askGrounded', (_e, req: GroundedAsk) => askGrounded(db, ai, req, (d) => broadcast(`ai.stream:${req.requestId}`, d)))
  ipcMain.handle('ai.thread', (_e, path: string) => listThread(db, path))
  ipcMain.handle('ai.skim', (_e, req: { requestId: string; path: string }) => runSkim(db, ai, req))
  ipcMain.handle('ai.skimList', (_e, path: string) => listSkim(db, path))
  ipcMain.handle('ai.cancel', (_e, id: string) => ai.cancel(id))
  ipcMain.handle('ai.usage', () => ai.usage())

  ipcMain.handle('library.list', () => listLibrary(db))
  ipcMain.handle('library.import', (_e, paths: string[]) => importPdfs(db, paths))
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
    return r.canceled ? [] : importPdfs(db, r.filePaths)
  })

  const createWindow = () => {
    const win = new BrowserWindow({
      width: 1280,
      height: 860,
      useContentSize: true,
      backgroundColor: '#1A1B26',
      webPreferences: { preload: join(__dirname, '../preload/index.mjs'), sandbox: false },
    })
    if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
    else win.loadFile(join(__dirname, '../renderer/index.html'))

    const fromCli = process.argv.slice(1).find((a) => a.toLowerCase().endsWith('.pdf'))
    if (fromCli)
      win.webContents.on('did-finish-load', async () => {
        const [r] = await importPdfs(db, [fromCli])
        win.webContents.send('open-paper', r.paperId)
      })
  }

  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
