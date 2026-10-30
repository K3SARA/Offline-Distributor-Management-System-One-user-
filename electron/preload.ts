import { contextBridge, ipcRenderer } from 'electron';

// Expose safe desktop IPC APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  printToPDF: () => ipcRenderer.invoke('print-to-pdf'),
  printPage: () => ipcRenderer.invoke('print-page'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external', url),
  isDesktop: true
});
