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

const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(AdblockerPlugin({
  blockTrackersAndAnnoyances: true,
  // Optionally enable Cooperative Mode for several request interceptors
  // interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY
}));

const { createBrowserPage } = require("./browser-page.js");
const { delay, hasQuestion } = require("./utilities.js");
const { clearSessions } = require("./data-store.js");
const { UserMessage, AppMessage, SystemPrompt, AIMessage, USER_ROLE, ASSISTANT_ROLE } = require('./chain-messages.js');
const { AIRequest } = require('./ai-request.js');
const marked = require('marked');
const { Action, RequestUserInterventionAction } = require("./actions.js"); // CompletedAction

// END REQUIRES

function createMainWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 780,
    height: 844,
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegrationInSubFrames: true
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
  const browserPage = await createBrowserPage(pie, browser, pageName, true, "Pixel 5", false, false);
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

  mainWindow.on('close', (e) => {
    // Prevent the default close operation
    e.preventDefault();
    mainWindow.hide(); // Hide the window instead of closing it
  });

  app.on('activate', () => {
    mainWindow.show();
  });

  return mainWindow;
}

function sendMessageToRenderer(mainWindow, message) {
  const type = message.role === USER_ROLE ? 'sent' : 'received';

  if (message.chatMessage.trim() != "") {
    mainWindow.webContents.send('receive-message', { html: marked.parse(message.chatMessage), type });
  }

  if (message.actions && message.actions.length > 0) {
    // if ( message.actions[0] instanceof CompletedAction ) {
    // }
    if ( !(message.actions[0] instanceof RequestUserInterventionAction) ) {
      // console.log(`XXX: ${message.actions[0].action} vs ${REQUEST_USER_INTERVENTION}`);
      mainWindow.webContents.send('receive-message', { html: marked.parse(`${message.actions[0].action}: ${message.actions[0].actionText}`), type: 'info' });
    }
    else {
      mainWindow.webContents.send('receive-message', { html: marked.parse(`${message.actions[0].actionText}`), type: type });
    }
  }
}

function sendUserMessageTextToRenderer(mainWindow, messageText) {
  mainWindow.webContents.send('receive-message', { html: marked.parse(messageText), type: "sent" });
}

function setPriceInWindow(mainWindow, messageChain) {
  var costs = [];

  messageChain.forEach(message => {
    costs.push(message.getCost());
  });

  // console.log(costs);

  const totalCost = costs.reduce((accumulator, currentValue) => {
    return accumulator + currentValue;
  }, 0); // Initial value of the accumulator is 0
  
  if (costs.length > 0) {
    mainWindow.webContents.send('update-price-box', { totalCost: totalCost, lastCost: costs[costs.length-1] });
  }
}

async function main() {
  await initializeComponents();

  const pageName = "test";

  const { browserPage, portalURL } = await setupBrowserConnection(pageName);
  
  console.log("Portal URL:", portalURL);

  // clearCookiesAndStorage(browserPage);
  const mainWindow = setupMainWindow(portalURL);

  var abortController = new AbortController();

  await browserPage.page.goto("https://www.google.com/");
  
  let messageChain = [
    new SystemPrompt("Alex", "Virginia"), 
    new AIMessage( {
      choices: [
        { message: {
            content: `I will prepare for the user request by going to the Google homepage, which is often a good starting point for searching as part of your request.

goto_url: https://www.google.com/`
          }
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0
      }
    } ) ];
  let newUserMessages = [];

  ipcMain.on('reset-messages', (event) => {
    for (let i = 0; i < messageChain.length; i++) {
      if(i > 1) {
        const message = messageChain[i];
        sendMessageToRenderer(mainWindow, message);
        setPriceInWindow(mainWindow, messageChain)
      }
    }
  });

  ipcMain.on('send-message', async (event, userMessage) => {
    abortController.abort();
    abortController = new AbortController();

    console.log(`Got user message: ${userMessage.text}`);
    sendUserMessageTextToRenderer(mainWindow, userMessage.text);

    newUserMessages.push(new UserMessage(userMessage.text));
  });

  var goAgain = false;

  while (true) {
    mainWindow.webContents.send('set-spinner', false);

    while (true) {
      if (goAgain || newUserMessages.length > 0) {      
        break;
      }

      await delay(50);
    }

    mainWindow.webContents.send('set-overlay', true);
    mainWindow.webContents.send('set-spinner', true);

    goAgain = false

    // console.log(messageChain.length);
    if (messageChain.length == 2) {
      const act = new Action();
      var params = await act.execute(browserPage);;
      params["Notice"] = "Do not use find_in_page_text on this page."
      const am = new AppMessage(params);
      messageChain.push(am);
    }

    messageChain = messageChain.concat(newUserMessages);
    newUserMessages = [];
    
    const request = new AIRequest(abortController, messageChain);
    var aiResponse = await request.getResult();

    if (!aiResponse) {
      continue;
    }

    console.log(`Got AI response: ${aiResponse.fullMessage}`);

    if (aiResponse.fullMessage.indexOf("Goal:") == 0 || aiResponse.fullMessage.indexOf("\nGoal:") != -1) {
      console.log("Updating system prompt goal");
      const lines = aiResponse.fullMessage.split('\n');
      var goalLines = [];

      var gotGoalStart = false;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];

        if (!gotGoalStart && line.indexOf("Goal:") != 0) {
          continue
        }

        gotGoalStart = true;

        if( line.trim() == "" || line.toLowerCase().includes('open question') ) {
          continue;
        }

        if (aiResponse.questionText && !aiResponse.questionText.includes(line)) {
          continue;
        }

        var hasAction = false;
        aiResponse.actions.forEach(action => {
          if (line.indexOf(action.action) == 0) {
            hasAction = true;
          }
        });

        if (hasAction) {
          continue;
        }

        goalLines.push(line);
      };

      goalLines.reverse();

      aiResponse.chatMessage = aiResponse.questionText ? aiResponse.questionText : "";
      messageChain[0].updateGoalAndPlan(goalLines);
    }

    sendMessageToRenderer(mainWindow, aiResponse);

    var appMessage = null;

    if (aiResponse.actions.length > 0 && !aiResponse.includesQuestion) {
      var appMessageParams = {};

      if (aiResponse.actions.length > 1) {
        appMessageParams["WARNING"] = `Only the first action, ${aiResponse.actions[0].action}, is addressed by this message. All other actions were ignored and need to be sent again if still appropriate.`
      }

      const executeResult = await aiResponse.actions[0].execute(browserPage, abortController);

      if (!executeResult) {
        continue;
      }

      const params = Object.assign({}, appMessageParams, executeResult);
      appMessage = new AppMessage(params);
    }

    messageChain.push(aiResponse);
    setPriceInWindow(mainWindow, messageChain)

    if (appMessage) {
      messageChain.push(appMessage);
    }
    else if (newUserMessages.length == 0 && !aiResponse.includesQuestion) {
      const a = new Action();
      var params = await a.execute(browserPage);

      params["Notice"] = "Your message was received by the user. Continue with any incomplete tasks by making a function call or call sleep: forever if you never plan to do anything for the user in the future.";
      // params["Next Steps"] = "Continue your task.";

      appMessage = new AppMessage(params);
      messageChain.push(appMessage);

      goAgain = true;
    }

    if (!aiResponse.includesQuestion && (aiResponse.actions.length == 0 || (aiResponse.actions.length > 0 && !aiResponse.actions[0].blocking))) {
      goAgain = true;
    }

    if (aiResponse.actions.length > 0 && aiResponse.actions[0] instanceof RequestUserInterventionAction) {
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