import { app, BrowserWindow, session, ipcMain, shell, Notification } from 'electron';
import path from 'path';
import pie from 'puppeteer-in-electron';
import { createBrowserPage } from "./browser-page";
import { delay, hasQuestion } from "./utilities";
import { clearSessions } from "./data-store";
import { UserMessage, AppMessage, SystemPrompt, AIMessage, USER_ROLE } from './chain-messages';
import { AIRequest } from './ai-request';
import marked from 'marked';
import { Action, RequestUserInterventionAction, SleepAction } from "./actions";
import * as puppeteerVanilla from 'puppeteer-core';
import { PuppeteerExtraPlugin, addExtra } from 'puppeteer-extra';
import PortalPlugin from 'puppeteer-extra-plugin-portal';
import sessionPlugin from 'puppeteer-extra-plugin-session';

pie.initialize(app);

const puppeteer = addExtra(puppeteerVanilla as any);
var willQuitApp = false;

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

function createMainWindow() {
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

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.webContents.on('will-navigate', function (e, url) {
        e.preventDefault();
        shell.openExternal(url);
    });

    return mainWindow;
}

function clearCookiesAndStorage(pageName: string) {
    const partitionSession = session.fromPartition(`persist:${pageName}`);

    partitionSession.clearCache();
    partitionSession.clearStorageData();
    partitionSession.flushStorageData();

    clearSessions();
}

function setupMainWindow() {
    const mainWindow = createMainWindow();
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('set-overlay', true);
    });

    mainWindow.on('close', (e) => {
        if (!willQuitApp) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    app.on('activate', () => {
        mainWindow.show();
    });

    return mainWindow;
}

function sendNotificationIfNotShowing(win: BrowserWindow, message: AIMessage | AppMessage | UserMessage) {
    if (!win.isFocused() && message.chatMessage.trim() != "") {
        const requiredNotification = new Notification({
            title: "Assistant",
            body: message.chatMessage,
            timeoutType: 'never',
            urgency: 'critical'
        });

        requiredNotification.on("click", () => {
            win.show();
        });

        requiredNotification.show();
    }
}

function sendMessageToRenderer(mainWindow: BrowserWindow, message: AIMessage | AppMessage | UserMessage) {
    const type = message.role === USER_ROLE ? 'sent' : 'received';

    if (message.chatMessage.trim() != "") {
        mainWindow.webContents.send('receive-message', { html: marked.parse(message.chatMessage), type });
    }

    if (message instanceof AIMessage && message.actions.length > 0) {
        if (message.actions[0] instanceof SleepAction && message.actions[0].blocking) {
            // Do nothing
        } else if (!(message.actions[0] instanceof RequestUserInterventionAction)) {
            mainWindow.webContents.send('receive-message', { html: marked.parse(`${message.actions[0].action}: ${message.actions[0].actionText}`), type: 'info' });
        } else {
            mainWindow.webContents.send('receive-message', { html: marked.parse(`${message.actions[0].actionText}`), type: type });
        }
    }
}

function sendUserMessageTextToRenderer(mainWindow: BrowserWindow, messageText: string) {
    mainWindow.webContents.send('receive-message', { html: marked.parse(messageText), type: "sent" });
}

function setPriceInWindow(mainWindow: BrowserWindow, messageChain: (AIMessage | AppMessage | UserMessage | SystemPrompt)[]) {
    var costs = messageChain.map(message => message.getCost());

    const totalCost = costs.reduce((accumulator, currentValue) => {
        return accumulator + currentValue;
    }, 0);

    if (costs.length > 0) {
        mainWindow.webContents.send('update-price-box', { totalCost: totalCost, lastCost: costs[costs.length - 1] });
    }
}

async function main() {
    const mainWindow = setupMainWindow();

    const pageName = "test";

    const browserPage = await createBrowserPage(app, mainWindow, puppeteer, pie, pageName, false, "Pixel 5", false, false);

    console.log("Portal URL:", await browserPage.getPortalURL());

    var abortController = new AbortController();

    let messageChain: (AIMessage | AppMessage | UserMessage | SystemPrompt)[] = [new SystemPrompt(),];
    let newUserMessages: UserMessage[] = [];

    ipcMain.on('reset-messages', (event) => {
        for (let i = 0; i < messageChain.length; i++) {
            if (i > 1) {
                const message = messageChain[i];
                sendMessageToRenderer(mainWindow, message);
                setPriceInWindow(mainWindow, messageChain);
            }
        }
    });

    ipcMain.on('send-message', async (event, userMessage: { text: string }) => {
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

        goAgain = false;

        messageChain = messageChain.concat(newUserMessages);
        newUserMessages = [];

        const request = new AIRequest(abortController, messageChain);
        var aiResponse = await request.getResult();

        if (!aiResponse) {
            continue;
        }

        console.log(`Got AI response: ${aiResponse.fullMessage}`);

        if (aiResponse.fullMessage.replace("*","").indexOf("Goal:") == 0 || aiResponse.fullMessage.indexOf("\nGoal:") != -1) {
            console.log("Updating system prompt goal");
            const lines = aiResponse.fullMessage.split('\n');
            var goalLines: string[] = [];

            var gotGoalStart = false;
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].replace("*","");

                if (!gotGoalStart && line.indexOf("Goal:") != 0) {
                    continue;
                }

                gotGoalStart = true;

                if (line.trim() == "" || line.toLowerCase().includes('open question')) {
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
            }

            goalLines.reverse();

            aiResponse.chatMessage = aiResponse.questionText ? aiResponse.questionText : "";
            (messageChain[0] as SystemPrompt).updateGoalAndPlan(goalLines.join('\n'));
        }

        sendMessageToRenderer(mainWindow, aiResponse);
        sendNotificationIfNotShowing(mainWindow, aiResponse);

        var appMessage: AppMessage | null = null;

        if (aiResponse.actions.length > 0 && !aiResponse.includesQuestion) {
            var appMessageParams: { [key: string]: string } = {};

            if (aiResponse.actions.length > 1) {
                appMessageParams["WARNING"] = `Only the first action, ${aiResponse.actions[0].action}, is addressed by this message. All other actions were ignored and need to be sent again if still appropriate.`;
            }

            if (aiResponse.actions[0].noSpinner) {
                mainWindow.webContents.send('set-spinner', false);
            }

            const executeResult = await aiResponse.actions[0].execute(browserPage, abortController);

            if (!executeResult) {
                continue;
            }

            const params = { ...appMessageParams, ...executeResult };
            appMessage = new AppMessage(params);
        }

        messageChain.push(aiResponse);
        setPriceInWindow(mainWindow, messageChain);

        if (appMessage) {
            messageChain.push(appMessage);
        } else if (newUserMessages.length == 0 && !aiResponse.includesQuestion) {
            const a = new Action("","");
            var params = await a.execute(browserPage);

            params["Notice"] = "Your message was received by the user. If you are blocked on the user, ask them to do something in the form of a question. Otherwise you MUST make a function call in your next message. Call sleep: forever if nothing remains to be done to address the plan in the future.";

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

app.on('before-quit', () => willQuitApp = true);
