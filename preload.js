const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
  fetchPlaylist: (url) => ipcRenderer.invoke('fetch-playlist', url),
  startDownload: (config) => ipcRenderer.invoke('start-download', config),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  onSetDownloadsPath: (callback) => {
    ipcRenderer.on('set-downloads-path', (event, path) => callback(path));
  }
});