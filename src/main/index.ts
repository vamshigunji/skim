import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { openDb } from './db'
import { importPdfs, listLibrary, openPaper } from './services/library'
import { searchExact } from './services/search'
import type { SearchRequest } from '../shared/types/search'

if (process.env.SKIM_USER_DATA) app.setPath('userData', process.env.SKIM_USER_DATA)

app.whenReady().then(() => {
  const db = openDb(join(app.getPath('userData'), 'library.db'))

  ipcMain.handle('library.list', () => listLibrary(db))
  ipcMain.handle('library.import', (_e, paths: string[]) => importPdfs(db, paths))
  ipcMain.handle('library.open', (_e, id: string) => openPaper(db, id))
  ipcMain.handle('search.exact', (_e, req: SearchRequest) => searchExact(db, req))
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
