import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

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
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
