import fs from 'node:fs';
import path from 'node:path';
import { contextBridge, ipcRenderer } from 'electron';

interface BuildOptions {
  priceList: 'haendler' | 'kunde';
  discountPercent?: number;
  brandFilter: 'all' | 'linde' | 'baoli';
  useCache: boolean;
}

// Same __dirname traversal as index.ts's ICON_PATH: app/main -> project/asar
// root, where the VERSION file sits alongside package.json.
const VERSION_PATH = path.join(__dirname, '..', '..', 'VERSION');
const appVersion = fs.readFileSync(VERSION_PATH, 'utf-8').trim();

contextBridge.exposeInMainWorld('api', {
  version: appVersion,
  buildCatalog: (options: BuildOptions) => ipcRenderer.invoke('catalog:build', options),
  onProgress: (callback: (msg: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, msg: string) => callback(msg);
    ipcRenderer.on('catalog:progress', listener);
    return () => ipcRenderer.removeListener('catalog:progress', listener);
  },
  openFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
});
