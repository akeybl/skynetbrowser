// puppeteer-extra-plugin-devtools
// https://www.npmjs.com/package/pouchdb

// START REQUIRES
const log = require('electron-log/main');

log.initialize();
Object.assign(console, log.functions);
log.errorHandler.startCatching();

// https://github.com/castlabs/electron-releases for widevine support
const { app, components, BrowserWindow, session, ipcMain, shell } = require('electron');

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
// May want to use puppeteer-extra-plugin-user-preferences in the future

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
const { delay, ttokTruncate } = require("./utilities.js");
const { clearSessions } = require("./data-store.js");
const { UserMessage, AIMessage, AppMessage, SystemPrompt, USER_ROLE, SYSTEM_ROLE, ASSISTANT_ROLE } = require('./chain-messages.js');
const { AIRequest } = require('./ai-request.js');
const marked = require('marked');
const { REQUEST_USER_INTERVENTION } = require("./actions.js");

// END REQUIRES

function createMainWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 780,
    height: 844,
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    resizable: false
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('will-navigate', function (e, url) {
    e.preventDefault();
    shell.openExternal(url);
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  return mainWindow;
};

function clearCookiesAndStorage(pageName) {
  const partitionSession = session.fromPartition(`persist:${pageName}`);

  partitionSession.clearCache();
  partitionSession.clearStorageData();
  partitionSession.flushStorageData();

  clearSessions();
}

async function initializeComponents() {
  await components.whenReady();
  console.log('components ready:', components.status());
}

async function setupBrowserConnection(pageName) {
  const browser = await pie.connect(app, puppeteer);
  const browserPage = await createBrowserPage(pie, browser, pageName, false, "Pixel 5", false, false);
  return {
    browserPage: browserPage,
    portalURL: await browserPage.getPortalURL()
  };
}

function setupMainWindow(portalUrl) {
  const mainWindow = createMainWindow();
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('load-url', portalUrl);
    mainWindow.webContents.send('set-overlay', true);
  });
  return mainWindow;
}

function sendMessageToRenderer(mainWindow, message) {
  const type = message.role === USER_ROLE ? 'sent' : 'received';

  if (message.chatMessage.trim() != "") {
    mainWindow.webContents.send('receive-message', { html: marked.parse(message.chatMessage), type });
  }

  if (message.actions && message.actions.length > 0) {
    mainWindow.webContents.send('receive-message', { html: marked.parse(`${message.actions[0].action}: ${message.actions[0].actionText}`), type: 'info' });
  }
}

function sendUserMessageTextToRenderer(mainWindow, messageText) {
  mainWindow.webContents.send('receive-message', { html: marked.parse(messageText), type: "sent" });
}

async function main() {
  await initializeComponents();

  const pageName = "test";

  const { browserPage, portalURL } = await setupBrowserConnection(pageName);
  // clearCookiesAndStorage(browserPage);
  const mainWindow = setupMainWindow(portalURL);

  var abortController = new AbortController();
  let messageChain = [new SystemPrompt("Alex", "Virginia")];
  let newUserMessages = [];

  ipcMain.on('reset-messages', (event) => {
    messageChain.forEach(message => {
      const type = message.role === USER_ROLE ? 'sent' : 'received';

      sendMessageToRenderer(mainWindow, message);
    });
  });

  ipcMain.on('send-message', async (event, userMessage) => {
    abortController.abort();
    abortController = new AbortController();

    console.log(`Got user message: ${userMessage.text}`);
    sendUserMessageTextToRenderer(mainWindow, userMessage.text);

    newUserMessages.push(new UserMessage(userMessage.text));
  });

  var goAgain = false;

  while(true) {
    mainWindow.webContents.send('set-overlay', true);

    while( true ) {
      if (goAgain || newUserMessages.length > 0 ) {
        break;
      }

      await delay(50);
    }

    goAgain = false

    messageChain = messageChain.concat(newUserMessages);
    newUserMessages = [];

    const request = new AIRequest(abortController, messageChain);
    var aiResponse = await request.getOpenAIResult(browserPage);

    if (!aiResponse) {
      continue;
    }

    console.log(`Got AI response: ${aiResponse.fullMessage}`);
    sendMessageToRenderer(mainWindow, aiResponse);

    var appMessage = null;

    if (aiResponse.actions.length > 0) {
      var appMessageParams = {};

      if (aiResponse.actions.length > 1) {
        appMessageParams["Warning"] = `Only the first action, ${aiResponse.actions[0].action}, is addressed by this message. All other actions are ignored.`
      }

      const params = Object.assign({}, appMessageParams, await aiResponse.actions[0].execute());
      appMessage = new AppMessage(params);
    }

    messageChain.push(aiResponse);

    if(appMessage) {
      messageChain.push(appMessage);
    }
    else if ( newUserMessages.length == 0 && !aiResponse.includesQuestion) {
      var params = {};
      params[`Current URL`] = await browserPage.page.url();
      const fullText = await browserPage.getPageText();
      params[`Page Text for Current URL`] = await ttokTruncate(fullText, 0, 2000);
      params["Notice"] = "Your message was received by the user. Do not expect a response. If you need to ask a question, ask one. If you believe you've accomplished ALL of the user's requests, call completed.";

      appMessage = new AppMessage(params);
      messageChain.push(appMessage);
    }

    if (!aiResponse.includesQuestion && ( !aiResponse.actions || aiResponse.actions.length == 0 || ( aiResponse.actions.length > 0 && !aiResponse.actions[0].blocking ) ) ) {
      goAgain = true;
    }

    if (aiResponse.actions.length > 0 && aiResponse.actions[0].action == REQUEST_USER_INTERVENTION) {
      mainWindow.webContents.send('set-overlay', false);
    }
  }
}

app.on('ready', main);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
