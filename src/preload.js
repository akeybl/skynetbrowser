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

const observer = new MutationObserver((mutations, obs) => {
    const sessionComplete = document.querySelector('.fixed-message code');
    if (sessionComplete && sessionComplete.textContent.includes('Session complete')) {
        // If the condition is met, take the desired action here (e.g., reload the page)
        window.location.reload();

        // Optionally, disconnect the observer if it's no longer needed
        obs.disconnect();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    // Select the div with the specific class or ID
    const navElement = document.querySelector('.screencast-navigation');
    if (navElement) {
        // Remove the div from the DOM
        navElement.remove();
    }
    // Specify what to observe
    observer.observe(document.body, {
        childList: true, // observe direct children
        subtree: true, // and lower descendants too
        characterData: true, // observe text changes
    });
});
