const { BrowserWindow } = require('electron');
const puppeteerVanilla = require('puppeteer-core');
const ghostCursor = require("ghost-cursor");
const { DEV_MODE } = require("./globals.js");

class HistoryEntry {
    constructor(url, inPage=false) {
        this.date = new Date();
        this.url = url;
        this.inPage = inPage;

        console.log('Navigated to:', url);
    }
}

class BrowserPage {
    constructor(pie, browser, device = 'Pixel 5', show = false, muted = true) {
        this.pie = pie;
        this.browser = browser;
        this.device = puppeteerVanilla.KnownDevices[device];
        
        this.page = null;
        this.cursor = null;
        this.client = null;
        this.history = [];

        this.window = new BrowserWindow({
            width: this.device.viewport.width,
            height: this.device.viewport.height,
            resizable: false,
            show: show,
            webPreferences: {
                backgroundThrottling: false,
                sandbox: true,
                disableDialogs: true,
                spellcheck: false,
                plugins: true,
            }
        });

        this.window.webContents.setAudioMuted(muted);

        this.window.webContents.setWindowOpenHandler(({ url }) => {
            this.window.loadURL(url);

            return { action: 'deny' };
        });

        this.window.webContents.on('did-navigate', (event, url) => {
            if (this.history.length === 0 || this.history[this.history.length-1].url !== url) {
                this.history.push(new HistoryEntry(url, false));
            }
        });

        this.window.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
            if(isMainFrame && (this.history.length === 0 || this.history[this.history.length-1].url !== url)) {
                this.history.push(new HistoryEntry(url, true));
            }
        });
    }
    
    async getPortalURL() {
        if(!this.page.hasOpenPortal() || this.portalUrl === null) {
            var portalUrl = await this.page.openPortal();
            portalUrl = portalUrl.replace("127.0.0.1", "127.0.0.1:3000");
            this.portalUrl = portalUrl;
        }

        return this.portalUrl;
    }
}

async function createBrowserPage(pie, browser, device = 'Pixel 5', show = false, muted=true) {
    const bp = new BrowserPage(pie, browser, device, show, muted);
    
    bp.page = await pie.getPage(browser, bp.window);
    bp.cursor = ghostCursor.createCursor(bp.page);

    if (DEV_MODE) {
        bp.page.on('framenavigated', async frame => {
            if (frame === bp.page.mainFrame()) {
                ghostCursor.installMouseHelper(bp.page);
            }
        });
    }

    await bp.page.emulate(bp.device);

    bp.client = await bp.page.target().createCDPSession();

    return bp;
}

module.exports = { createBrowserPage };
