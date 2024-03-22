const DEV_MODE = true;

// START REQUIRES
const log = require('electron-log/main');

log.initialize();
Object.assign(console, log.functions);
log.errorHandler.startCatching();

// https://github.com/castlabs/electron-releases
const { app, components, BrowserWindow, session } = require('electron');
app.commandLine.appendSwitch('disable-site-isolation-trials');
// app.commandLine.appendSwitch('widevine-cdm-path', '/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/122.0.6261.129/Libraries/WidevineCdm/_platform_specific/mac_arm64/libwidevinecdm.dylib')
// // The version of plugin can be got from `chrome://components` page in Chrome.
// app.commandLine.appendSwitch('widevine-cdm-version', '4.10.2710.0')

const path = require('node:path');

const pie = require('puppeteer-in-electron');
pie.initialize(app);

const puppeteerVanilla = require('puppeteer-core');
const device = puppeteerVanilla.KnownDevices['Pixel 5'];

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

const ghostCursor = require("ghost-cursor");

// END REQUIRES

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

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

function createDeviceSizedWindow(show = true) {
  return new BrowserWindow({
    width: device.viewport.width,
    height: device.viewport.height,
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
}

async function createDevice(pie, browser) {
  const deviceWindow = createDeviceSizedWindow(false);

  deviceWindow.webContents.setWindowOpenHandler(({ url }) => {
    deviceWindow.loadURL(url);

    return { action: 'deny' };
  });

  // deviceWindow.webContents.setAudioMuted(true);

  const devicePage = await pie.getPage(browser, deviceWindow);

  const deviceCursor = ghostCursor.createCursor(devicePage);

  if (DEV_MODE) {
    devicePage.on('framenavigated', async frame => {
      if (frame === devicePage.mainFrame()) {
        ghostCursor.installMouseHelper(devicePage);
      }
    });
  }

  await devicePage.emulate(device);

  const deviceClient = await devicePage.target().createCDPSession();

  return {
    window: deviceWindow,
    page: devicePage,
    cursor: deviceCursor,
    client: deviceClient
  };
}

const main = async () => {
  // await components.whenReady();
  console.log('components ready:', components.status());

  // session.defaultSession.clearCache();
  // session.defaultSession.clearStorageData()

  var browser = await pie.connect(app, puppeteer);

  const deviceObj = await createDevice(pie, browser);
  await deviceObj.page.goto('https://www.google.com');

  var portalUrl = await deviceObj.page.openPortal();
  portalUrl = portalUrl.replace("127.0.0.1", "127.0.0.1:3000");
  console.log('Portal URL:', portalUrl);

  // const portalWindow = createDeviceSizedWindow(true);
  // portalWindow.loadURL(portalUrl);

  const mainWindow = createMainWindow();
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('load-url', portalUrl);
    mainWindow.webContents.send('set-overlay', false);
  });
};

app.on('ready', main);

app.on('window-all-closed', () => {
  // if (process.platform !== 'darwin') {
  app.quit();
  // }
});
