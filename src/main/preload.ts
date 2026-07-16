import { contextBridge, ipcRenderer } from 'electron';

interface BuildOptions {
  priceList: 'haendler' | 'kunde';
  discountPercent?: number;
  brandFilter: 'all' | 'linde' | 'baoli';
  useCache: boolean;
}

// No direct fs access here: Electron's default sandboxed preload context
// doesn't reliably support raw Node module access the way the main process
// does, so a synchronous fs.readFileSync at preload top-level can throw and
// silently abort the whole exposeInMainWorld call — which would leave
// window.api entirely undefined (explains why the build button also
// appeared to do nothing, not just a missing version string). The main
// process already reads files like this fine (see index.ts's ICON_PATH), so
// the version is read there and handed over via IPC instead.
contextBridge.exposeInMainWorld('api', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  buildCatalog: (options: BuildOptions) => ipcRenderer.invoke('catalog:build', options),
  onProgress: (callback: (msg: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, msg: string) => callback(msg);
    ipcRenderer.on('catalog:progress', listener);
    return () => ipcRenderer.removeListener('catalog:progress', listener);
  },
  openFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
});
