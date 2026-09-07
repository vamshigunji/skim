import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

if (process.env.SKIM_USER_DATA) app.setPath('userData', process.env.SKIM_USER_DATA)

const readPdf = (path: string) => ({ path, data: readFileSync(path) })

function createWindow() {
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
  if (fromCli) win.webContents.on('did-finish-load', () => win.webContents.send('open-pdf', readPdf(fromCli)))
}

ipcMain.handle('open-dialog', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  return r.canceled ? null : readPdf(r.filePaths[0])
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
