const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    loadUrl: (callback) => ipcRenderer.on('load-url', callback),
    setOverlay: (callback) => ipcRenderer.on('set-overlay', callback),
    sendMessage: (message) => ipcRenderer.send('send-message', message),
    receiveMessage: (callback) => ipcRenderer.on('receive-message', callback),
    resetMessages: (callback) => ipcRenderer.send('reset-messages', callback),
    setSpinner: (callback) => ipcRenderer.on('set-spinner', callback),
    updatePriceBox: (callback) => ipcRenderer.on('update-price-box', callback),
});

window.addEventListener('DOMContentLoaded', () => {
    // Select the div with the specific class or ID
    const navElement = document.querySelector('.screencast-navigation');
    if (navElement) {
      // Remove the div from the DOM
      navElement.remove();
    }
  });
  