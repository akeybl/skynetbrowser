import { BrowserWindow } from 'electron';
import * as puppeteerVanilla from 'puppeteer-core';
import { PuppeteerExtraPlugin, addExtra } from 'puppeteer-extra';
import PortalPlugin from 'puppeteer-extra-plugin-portal';
import sessionPlugin from 'puppeteer-extra-plugin-session';

const puppeteer = addExtra(puppeteerVanilla as any);

puppeteer.use(
  PortalPlugin({
    webPortalConfig: {
      listenOpts: {
        port: 3000,
      },
      baseUrl: 'http://127.0.0.1',
    },
  })
);

puppeteer.use(sessionPlugin());

import {createCursor, installMouseHelper} from "ghost-cursor";
import { DEV_MODE } from "./globals";
import { storeSessionStr, getSessionStr } from "./data-store";
import { getAriaElementsText, clickClosestAriaName, keyboardType, keyboardPress } from './page-utilities';
import { delay } from './utilities';
import { Frame, Browser, Page, ElementHandle, CDPSession, KnownDevices } from 'puppeteer-core';

type DeviceKey = keyof typeof KnownDevices;

class HistoryEntry {
    date: Date;
    url: string;
    inPage: boolean;

    constructor(url: string, inPage = false) {
        this.date = new Date();
        this.url = url;
        this.inPage = inPage;

        console.log('Navigated to:', url);
    }
}

export class BrowserPage {
    app: any;
    mainWindow: BrowserWindow;
    puppeteer: typeof puppeteer;
    pie: any;
    pageID: string;
    partitioned: boolean;
    device: any;
    browser: Browser | null;
    page: Page | null;
    cursor: any;
    client: CDPSession | null;
    history: HistoryEntry[];
    textPage: number;
    window: BrowserWindow;
    portalUrl: string | null;

    constructor(app: any, mainWindow: BrowserWindow, ppt: typeof puppeteer, pie: any, pageID: string, partitioned = false, device = 'Pixel 5', show = false, muted = true) {
        this.app = app;
        this.mainWindow = mainWindow;
        this.puppeteer = puppeteer;
        this.pie = pie;
        this.pageID = pageID;
        this.partitioned = partitioned;
        this.device = KnownDevices[device as DeviceKey];
        this.browser = null;
        this.page = null;
        this.cursor = null;
        this.client = null;
        this.history = [];
        this.textPage = 1;
        this.portalUrl = null;

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
        let thisBrowser = await this.pie.connect(this.app, this.puppeteer);
        this.browser = thisBrowser;

        let thisPage = await this.pie.getPage(this.browser, this.window);
        this.page = thisPage;

        await this.restoreSession();

        this.cursor = createCursor(thisPage);

        if (DEV_MODE) {
            thisPage.on('framenavigated', async (frame: Frame) => {
                if (frame === thisPage.mainFrame()) {
                    installMouseHelper(thisPage);
                }
            });
        }

        await thisPage.emulate(this.device);

        this.client = await thisPage.target().createCDPSession();

        if (this.history.length > 0) {
            console.log("Going to last navigated page:", this.history[this.history.length - 1].url);
            await thisPage.goto(this.history[this.history.length - 1].url);
        }
        
        thisBrowser.on('disconnected', async () => {
            await this.asyncInit();
        });

        await delay(500);

        this.mainWindow.webContents.send('load-url', await this.getPortalURL());
    }

    async getPortalURL() {
        const thisPage = this.page;
    
        if (thisPage && !thisPage.hasOpenPortal() || this.portalUrl === null) {
            var portalUrl = await thisPage?.openPortal();
            if (portalUrl) {
                portalUrl = portalUrl.replace("127.0.0.1", "127.0.0.1:3000");
                this.portalUrl = portalUrl;
            }
        }
    
        return this.portalUrl;
    }
    
    async storeSession() {
        console.log(`Storing session for page ${this.pageID}.`);

        const sessionDataStr = await this.page?.session.dumpString();

        if(sessionDataStr) {
         storeSessionStr(this.pageID, sessionDataStr);
        }
    }

    async restoreSession() {
        const sessionDataStr = getSessionStr(this.pageID);

        if (sessionDataStr != null) {
            console.log(`Restoring session for page ${this.pageID}.`);

            this.page?.session.restoreString(sessionDataStr);
        } else {
            console.log(`No session data found.`);
        }
    }

    async getPageText(includeURLs = false) {
        if (!this.client || !this.page) {
            return null;
        }

        return await getAriaElementsText(this.client, this.page, includeURLs);
    }

    async clickClosestText(text: string) {
        if (!this.client || !this.page) {
            return null;
        }

        await clickClosestAriaName(this.client, this.page, this.cursor, text);
    }

    async typeIn(text: string) {
        var splitText: string[] = [text];

        if (/\n|\\n/.test(text)) {
            splitText = text.split(/\n|\\n/).reduce((acc: string[], currentValue, currentIndex, array) => {
                acc.push(currentValue);
                if (currentIndex < array.length - 1) {
                    acc.push("\n");
                }
        
                return acc;
            }, []);
        }
        
        if (this.page) {
            for (const st of splitText) {
                if (st == "\n") {
                    await keyboardPress(this.page, "Enter");
                } else {
                    await keyboardType(this.page, st);
                }
            }
        }
    }
}

export async function createBrowserPage(app: any, mainWindow: BrowserWindow, ppt: typeof puppeteer, pie: any, pageID: string, partitioned = false, device = 'Pixel 5', show = false, muted = true) {
    const bp = new BrowserPage(app, mainWindow, puppeteer, pie, pageID, partitioned, device, show, muted);
    await bp.asyncInit();

    return bp;
}
