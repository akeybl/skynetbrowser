const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    loadUrl: (callback) => ipcRenderer.on('load-url', callback),
    setOverlay: (callback) => ipcRenderer.on('set-overlay', callback),
    sendMessage: (message) => ipcRenderer.send('send-message', message),
    receiveMessage: (callback) => ipcRenderer.on('receive-message', callback),
    resetMessages: (callback) => ipcRenderer.send('reset-messages', callback),
});
