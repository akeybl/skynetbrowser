import { contextBridge, ipcRenderer } from 'electron';

interface ElectronAPI {
    loadUrl: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
    setOverlay: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
    sendMessage: (message: string) => void;
    receiveMessage: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
    resetMessages: (callback: () => void) => void;
    setSpinner: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
    updatePriceBox: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
    loadUrl: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => ipcRenderer.on('load-url', callback),
    setOverlay: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => ipcRenderer.on('set-overlay', callback),
    sendMessage: (message: string) => ipcRenderer.send('send-message', message),
    receiveMessage: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => ipcRenderer.on('receive-message', callback),
    resetMessages: (callback: () => void) => ipcRenderer.send('reset-messages', callback),
    setSpinner: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => ipcRenderer.on('set-spinner', callback),
    updatePriceBox: (callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => ipcRenderer.on('update-price-box', callback),
} as ElectronAPI);

const observer: MutationObserver = new MutationObserver((mutations: MutationRecord[], obs: MutationObserver) => {
    const sessionComplete: Element | null = document.querySelector('.fixed-message code');
    if (sessionComplete && sessionComplete.textContent?.includes('Session complete')) {
        // If the condition is met, take the desired action here (e.g., reload the page)
        window.location.reload();

        // Optionally, disconnect the observer if it's no longer needed
        obs.disconnect();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    // Select the div with the specific class or ID
    const navElement: Element | null = document.querySelector('.screencast-navigation');
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
