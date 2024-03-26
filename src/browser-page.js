const { BrowserWindow } = require('electron');
const puppeteerVanilla = require('puppeteer-core');
const ghostCursor = require("ghost-cursor");
const { DEV_MODE } = require("./globals.js");
const { storeSessionStr, getSessionStr } = require("./data-store.js");

class HistoryEntry {
    constructor(url, inPage=false) {
        this.date = new Date();
        this.url = url;
        this.inPage = inPage;

        console.log('Navigated to:', url);
    }
}

class BrowserPage {
    constructor(pie, browser, pageName, partitioned = false, device = 'Pixel 5', show = false, muted = true) {
        this.pie = pie;
        this.browser = browser;
        this.pageName = pageName;
        this.partitioned = partitioned;
        this.device = puppeteerVanilla.KnownDevices[device];
        
        this.page = null;
        this.cursor = null;
        this.client = null;
        this.history = [];

        var partition = "";
        if (partitioned) {
            partition = `persist:${pageName}`;
        }

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
                partition: partition,
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

    async storeSession() {
        console.log(`Storing session for page ${this.pageName}.`);

        const sessionDataStr = await this.page.session.dumpString();
        storeSessionStr(this.pageName, sessionDataStr);
    }

    async restoreSession() {
        console.log(`Restoring session for page ${this.pageName}.`);

        const sessionDataStr = getSessionStr(this.pageName);
        this.page.session.restoreString(sessionDataStr);
    }
}

async function createBrowserPage(pie, browser, pageName, partitioned = false, device = 'Pixel 5', show = false, muted=true) {
    const bp = new BrowserPage(pie, browser, pageName, partitioned, device, show, muted);
    
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
