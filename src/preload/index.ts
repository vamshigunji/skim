import { contextBridge } from 'electron'

// window.skim is the only bridge between renderer and main. Grows per task.
contextBridge.exposeInMainWorld('skim', {})
