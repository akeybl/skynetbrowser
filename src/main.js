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
const { keyboardType, clickClosestAriaName, keyboardPress } = require("./page-utilities.js");
const { delay } = require("./utilities.js");
const { clearSessions } = require("./data-store.js");
const { UserMessage, AIMessage, AppMessage, SystemPrompt, USER_ROLE, SYSTEM_ROLE, ASSISTANT_ROLE } = require('./chain-messages.js');
const { AIRequest } = require('./ai-request.js');
const marked = require('marked');
const { REQUEST_USER_CLARIFICATION } = require("./actions.js");

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

function clearCookiesAndStorage() {
  session.defaultSession.clearCache();
  session.defaultSession.clearStorageData();
  clearSessions();
}

async function initializeComponents() {
  await components.whenReady();
  console.log('components ready:', components.status());
}

async function setupBrowserConnection() {
  const browser = await pie.connect(app, puppeteer);
  const browserPage = await createBrowserPage(pie, browser, "test", true);
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

function sendUserMessage(mainWindow, message) {
  mainWindow.webContents.send('receive-message', { html: marked.parse(message), type: 'sent' });
}

function sendAIMessage(mainWindow, message, type = 'received') {
  mainWindow.webContents.send('receive-message', { html: marked.parse(message), type });
}

async function getAIResponse(browserPage, request) {
  return await request.getOpenAIResult(browserPage);
}

async function getAppMessageResponse(mainWindow, response) {
  try {
    console.log(`Got AI response: ${response.fullMessage}`);

    if (response.chatMessage.trim() != "") {
      sendAIMessage(mainWindow, response.chatMessage);
    }

    var appMessageParams = {};

    if (response.actions.length > 0) {
      firstAction = response.actions[0];

      if (response.actions.length > 1) {
        appMessageParams["Warning"] = `Only the first action, ${response.actions[0].action}, is addressed by this message. All other actions are ignored.`
      }

      sendAIMessage(mainWindow, `${firstAction.action}: ${firstAction.actionText}`, 'info');

      const params = Object.assign({}, appMessageParams, await firstAction.execute());

      const am = new AppMessage(params);
      return am;
    }

    return null;
  } catch (error) {
    console.error('Failed to get AI response:', error);
  }
}

async function main() {
  await initializeComponents();
  // clearCookiesAndStorage();

  const { browserPage, portalURL } = await setupBrowserConnection();
  const mainWindow = setupMainWindow(portalURL);

  let messageChain = [new SystemPrompt("Alex", "Virginia")];
  let currentAIRequest = null;
  let appResponding = false;

  ipcMain.on('send-message', async (event, userMessage) => {
    console.log(`Got user message: ${userMessage.text}`);
    if (currentAIRequest) currentAIRequest.cancelRequest();

    while(appResponding) {
      await delay(50);
    }

    sendUserMessage(mainWindow, userMessage.text);
    messageChain.push(new UserMessage(userMessage.text));

    var nextRequest = null;
    do {
      const request = new AIRequest(messageChain);
      currentAIRequest = request;
      var aiMessage = await getAIResponse(browserPage, request);
      messageChain.push(aiMessage);
      if (currentAIRequest === request) currentAIRequest = null;

      appResponding = true;
      var appMessage = await getAppMessageResponse(mainWindow, aiMessage);

      if (appMessage != null) {
        messageChain.push(appMessage);
        nextRequest = new AIRequest(messageChain);
      }
      else if (aiMessage.includesQuestion) {
        nextRequest = null;
      }
      else {
        messageChain.push(new AppMessage({"Note": "Your last message was received by the user. Do not expect a response. Instead, continue with your task"}));
        nextRequest = new AIRequest(messageChain);
      }

      appResponding = false;
    } while(nextRequest != null);
  });

  ipcMain.on('reset-messages', (event) => {
    messageChain.forEach(message => {
      const type = message.role === USER_ROLE ? 'sent' : 'received';

      if (message.chatMessage.trim() != "") {
        sendAIMessage(mainWindow, message.chatMessage, type);
      }

      if (message.actions && message.actions.length > 0 && message.actions[0].action != REQUEST_USER_CLARIFICATION) {
        sendAIMessage(mainWindow, `${message.actions[0].action}: ${message.actions[0].actionText}`, 'info');
      }
    });
  });
}

app.on('ready', main);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

  // await bp.page.goto('https://www.google.com', { waitUntil: 'networkidle0' });
  // await clickClosestAriaName(bp.client, bp.page, bp.cursor, "Google Search");
  // await keyboardType(bp.page, "reddit");
  // await keyboardPress(bp.page, "Enter");
  // await delay(1000);
  // await clickClosestAriaName(bp.client, bp.page, bp.cursor, "https://www.reddit.com/");
  // mainWindow.webContents.send('set-overlay', false);
