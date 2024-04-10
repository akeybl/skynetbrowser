const { BrowserWindow } = require('electron');
const puppeteerVanilla = require('puppeteer-core');
const ghostCursor = require("ghost-cursor");
const { DEV_MODE } = require("./globals.js");
const { storeSessionStr, getSessionStr } = require("./data-store.js");
const { getAriaElementsText, clickClosestAriaName, keyboardType, keyboardPress } = require('./page-utilities.js');
const { delay } = require('./utilities.js');

class HistoryEntry {
    constructor(url, inPage = false) {
        this.date = new Date();
        this.url = url;
        this.inPage = inPage;

        console.log('Navigated to:', url);
    }
}

class BrowserPage {
    constructor(app, mainWindow, puppeteer, pie, pageID, partitioned = false, device = 'Pixel 5', show = false, muted = true) {
        this.app = app;
        this.mainWindow = mainWindow;
        this.puppeteer = puppeteer;
        this.pie = pie;
        this.pageID = pageID;
        this.partitioned = partitioned;
        this.device = puppeteerVanilla.KnownDevices[device];

        this.browser = null;
        this.page = null;
        this.cursor = null;
        this.client = null;
        this.history = [];

        this.textPage = 1;

        var partition = "";
        if (partitioned) {
            partition = `persist:${pageID}`;
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
            if (this.history.length === 0 || this.history[this.history.length - 1].url !== url) {
                this.textPage = 1;
                this.history.push(new HistoryEntry(url, false));
            }
        });

        this.window.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
            if (isMainFrame && (this.history.length === 0 || this.history[this.history.length - 1].url !== url)) {
                this.history.push(new HistoryEntry(url, true));
            }
        });
    }

    async asyncInit() {
        this.browser = await this.pie.connect(this.app, this.puppeteer);
        
        this.page = await this.pie.getPage(this.browser, this.window);
        await this.restoreSession();
    
        this.cursor = ghostCursor.createCursor(this.page);
    
        if (DEV_MODE) {
            this.page.on('framenavigated', async frame => {
                if (frame === this.page.mainFrame()) {
                    ghostCursor.installMouseHelper(this.page);
                }
            });
        }
    
        await this.page.emulate(this.device);
    
        this.client = await this.page.target().createCDPSession();
    
        this.page.on('close', () => {
            console.log("Page closed");
        });

        if (this.history.length > 0) {
            console.log("Going to last navigated page:",this.history[this.history.length-1].url);
            await this.page.goto(this.history[this.history.length-1].url);
        }

        this.browser.on('disconnected', async () => {
            await this.asyncInit();
        });

        await delay(500);

        await this.mainWindow.webContents.send('load-url', await this.getPortalURL());
    }

    async getPortalURL() {
        if (!this.page.hasOpenPortal() || this.portalUrl === null) {
            var portalUrl = await this.page.openPortal();
            portalUrl = portalUrl.replace("127.0.0.1", "127.0.0.1:3000");
            this.portalUrl = portalUrl;
        }

        return this.portalUrl;
    }

    async storeSession() {
        console.log(`Storing session for page ${this.pageID}.`);

        const sessionDataStr = await this.page.session.dumpString();
        storeSessionStr(this.pageID, sessionDataStr);
    }

    async restoreSession() {
        const sessionDataStr = getSessionStr(this.pageID);

        if (sessionDataStr != null) {
            console.log(`Restoring session for page ${this.pageID}.`);

            this.page.session.restoreString(sessionDataStr);
        }
        else {
            console.log(`No session data found.`);
        }
    }

    async getPageText(includeURLs=false) {
        // console.log("XXX");
        // console.log(this.includeURLs);
        // console.log(await getAriaElementsText(this.client, this.page, true));
        return await getAriaElementsText(this.client, this.page, includeURLs);
    }

    async clickClosestText(text) {
        await clickClosestAriaName(this.client, this.page, this.cursor, text);
    }

    async typeIn(text) {
        var splitText = [text,];

        if (/\n|\\n/.test(text)) {
            splitText = text.split(/\n|\\n/).reduce((acc, currentValue, currentIndex, array) => {
                acc.push(currentValue);
                // Do not add a newline character after the last element
                if (currentIndex < array.length - 1) {
                    acc.push("\n"); // This will add a literal backslash followed by n. Change as needed.
                }
                
                return acc;
            }, []);
        }

        for (const st of splitText) {
            if (st == "\n") {
                await keyboardPress(this.page, "Enter");
            } else {
                await keyboardType(this.page, st); // Make sure to pass 'st', not 'text'
            }
        }
    }
}
  
async function createBrowserPage(app, mainWindow, puppeteer, pie, pageID, partitioned = false, device = 'Pixel 5', show = false, muted = true) {
    const bp = new BrowserPage(app, mainWindow, puppeteer, pie, pageID, partitioned, device, show, muted);
    await bp.asyncInit();
        
    return bp;
}

module.exports = { createBrowserPage };
