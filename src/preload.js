const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    loadUrl: (callback) => ipcRenderer.on('load-url', callback),
    setOverlay: (callback) => ipcRenderer.on('set-overlay', callback)
});
