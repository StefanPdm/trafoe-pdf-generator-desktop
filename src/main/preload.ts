import { contextBridge, ipcRenderer } from 'electron';

interface BuildOptions {
  priceList: 'haendler' | 'kunde';
  discountPercent?: number;
  brandFilter: 'all' | 'linde' | 'baoli';
  useCache: boolean;
}

contextBridge.exposeInMainWorld('api', {
  buildCatalog: (options: BuildOptions) => ipcRenderer.invoke('catalog:build', options),
  onProgress: (callback: (msg: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, msg: string) => callback(msg);
    ipcRenderer.on('catalog:progress', listener);
    return () => ipcRenderer.removeListener('catalog:progress', listener);
  },
  openFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
});
