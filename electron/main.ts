import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fork, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function startBackendServer() {
  try {
    const serverScript = isDev
      ? path.join(__dirname, '../../server/index.ts')
      : path.join(__dirname, '../../server/index.js');

    const dbPath = path.join(app.getPath('userData'), 'distributor.db');

    // In dev mode, tsx can be used or we run backend in npm script
    if (!isDev) {
      serverProcess = fork(serverScript, [], {
        env: {
          ...process.env,
          DATABASE_URL: `file:${dbPath}`,
          PORT: '4812'
        }
      });

      serverProcess.on('error', (err) => {
        console.error('Failed to start embedded backend server:', err);
      });
    }
  } catch (err) {
    console.error('Error starting backend server:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#F1F3F6',
    title: 'Distributor Pro',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const devUrl = 'http://localhost:5173';
  if (isDev) {
    mainWindow.loadURL(devUrl);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  // IPC Handlers for native printing
  ipcMain.handle('print-page', async () => {
    if (!mainWindow) return;
    mainWindow.webContents.print({ silent: false, printBackground: true });
  });

  ipcMain.handle('print-to-pdf', async () => {
    if (!mainWindow) return null;
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    });
    return pdfData;
  });

  ipcMain.handle('open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
