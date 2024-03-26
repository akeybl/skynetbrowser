// https://github.com/clouedoc/puppeteer-extra-plugin-session
// puppeteer-extra-plugin-user-preferences
// puppeteer-extra-plugin-devtools
// https://www.npmjs.com/package/pouchdb

// START REQUIRES
const log = require('electron-log/main');

log.initialize();
Object.assign(console, log.functions);
log.errorHandler.startCatching();

// https://github.com/castlabs/electron-releases for widevine support
const { app, components, BrowserWindow, session } = require('electron');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

app.commandLine.appendSwitch('disable-site-isolation-trials');

const path = require('node:path');

const pie = require('puppeteer-in-electron');
pie.initialize(app);

const puppeteerVanilla = require('puppeteer-core');
const { addExtra } = require('puppeteer-extra');
const puppeteer = addExtra(puppeteerVanilla);
const PortalPlugin = require('puppeteer-extra-plugin-portal');

puppeteer.use(
  PortalPlugin({
    // This is a typical configuration when hosting behind a secured reverse proxy
    webPortalConfig: {
      listenOpts: {
        port: 3000,
      },
      baseUrl: 'http://127.0.0.1',
    },
  })
)

puppeteer.use(require('puppeteer-extra-plugin-session').default());

const { createBrowserPage } = require("./browser-page.js");
const { keyboardType, clickClosestAriaName, keyboardPress } = require("./page-utilities.js");
const { delay } = require("./utilities.js");

// END REQUIRES

function createMainWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 780,
    height: 844,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    resizable: false
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  return mainWindow;
};

function clearCookiesAndStorage() {
  session.defaultSession.clearCache();
  session.defaultSession.clearStorageData();
} 

const main = async () => {
  await components.whenReady();
  console.log('components ready:', components.status());

  // clearCookiesAndStorage();

  var browser = await pie.connect(app, puppeteer);

  const bp = await createBrowserPage(pie, browser, "test", true);
  var portalUrl = await bp.getPortalURL();

  const mainWindow = createMainWindow();
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('load-url', portalUrl);
    mainWindow.webContents.send('set-overlay', true);
  });

  await bp.restoreSession();
  await bp.page.goto('https://www.google.com', { waitUntil: 'networkidle0' });

  await clickClosestAriaName(bp.client, bp.page, bp.cursor, "Google Search");
  await keyboardType(bp.page, "reddit");
  await keyboardPress(bp.page, "Enter");
  await delay(1000);
  await clickClosestAriaName(bp.client, bp.page, bp.cursor, "https://www.reddit.com/");
  mainWindow.webContents.send('set-overlay', false);
};

app.on('ready', main);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
