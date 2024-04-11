const { randomDelay, isValidUrl, ttokTruncate, ttokLength, extractNumberFromString, convertStringToDate, delay, millisecondsUntil } = require("./utilities.js");
const { PAGE_TOKEN_LENGTH, DUMB_MODEL, DUMB_MAX_WRITE_TOKENS, DUMB_PROMPT_COST, DUMB_COMPLETION_COST } = require("./globals.js");
const { getResult } = require("./utilities.js");

class Action {
    constructor(action = null, actionText = null) {
        this.action = action;
        this.actionText = actionText;
        this.returnParams = {};
        this.blocking = false;
        this.noSpinner = false;
        this.urlAfterExecute = null;
        this.fullTextAfterExecute = null;
        this.pageTextAfterExecute = null;
        this.cost = 0;
    }

    async execute(browserPage, abortController = null) {
        this.urlAfterExecute = await browserPage.page.url();

        let pageURL = this.urlAfterExecute;

        pageURL = pageURL.replace("https://www.", "");
        pageURL = pageURL.replace("http://www.", "");
        pageURL = pageURL.replace("https://", "");
        pageURL = pageURL.replace("http://", "");

        if (pageURL.length > 40) {
            pageURL = pageURL.substring(0, 40) + "...";
        }

        this.returnParams[`Page URL`] = pageURL;

        this.fullTextAfterExecute = await browserPage.getPageText();

        // console.log(this.fullTextAfterExecute)

        const tokenLength = await ttokLength(this.fullTextAfterExecute);
        const fullTextPages = Math.ceil(tokenLength / PAGE_TOKEN_LENGTH);
        this.returnParams["Page Number"] = `${browserPage.textPage}/${fullTextPages}`;
        this.pageTextAfterExecute = "";

        if (browserPage.textPage > 1) {
            this.pageTextAfterExecute += "# ^ TRUNCATED\n";
        }

        this.pageTextAfterExecute += await ttokTruncate(this.fullTextAfterExecute, PAGE_TOKEN_LENGTH * (browserPage.textPage - 1), PAGE_TOKEN_LENGTH * browserPage.textPage);

        if (browserPage.textPage != fullTextPages) {
            this.pageTextAfterExecute += "\n# v TRUNCATED"
        }

        this.returnParams[`Page Text`] = this.pageTextAfterExecute;

        if (this.action == FIND_IN_PAGE) {
            this.returnParams[`Notice`] = `Message anything from Find Results that you will need to use in the future or it will no longer be available to you.`
        }
        else {
            this.returnParams[`Notice`] = `Page Text is meant for fast navigation/clicks/interaction and should not be used to message markdown links to the user. You MUST use find_in_page_text for that purpose, as it has access to all ${fullTextPages} pages and link URLs.`
        }

        return this.returnParams;
    }
}

class GotoUrlAction extends Action {
    async execute(browserPage, abortController = null) {
        console.log(`Going to URL: ${this.actionText}`);

        let url = this.actionText;
        if (this.actionText.indexOf("http") != 0) {
            url = "https://" + this.actionText;
        }

        if (!isValidUrl(url)) {
            this.returnParams["Error"] = `Could not perform ${GOTO_URL}, invalid URL provided.`;
            return await super.execute();
        }

        var tries = 1;
        var retry = true;
        do {
            try {
                await browserPage.page.goto(url, { timeout: 10000 });
                retry = false;
                await randomDelay(4000, 5000);
            } catch (error) {
                console.log(`Error: ${error}`);
                tries += 1;
            }
        } while (retry && tries <= 3);

        return await super.execute(browserPage, abortController);
    }
}

class GoBackAction extends Action {
    async execute(browserPage, abortController = null) {
        console.log(`Going back in browser history`);

        await browserPage.page.goBack();

        this.returnParams["Outcome"] = `${GO_BACK} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute(browserPage, abortController);
    }
}

class ReloadAction extends Action {
    async execute(browserPage, abortController = null) {
        console.log(`Reloading the page`);

        await browserPage.page.reload();

        this.returnParams["Outcome"] = `${RELOAD} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute(browserPage, abortController);
    }
}

class ClickOnAction extends Action {
    async execute(browserPage, abortController = null) {
        console.log(`Clicking on: ${this.actionText}`);

        try {
            await browserPage.clickClosestText(this.actionText);
            this.returnParams["Outcome"] = `${CLICK_ON} operation complete.`;
        }
        catch (e) {
            this.returnParams["Error"] = `${e}`;
        }

        await randomDelay(4000, 5000);

        return await super.execute(browserPage, abortController);
    }
}

class TypeInAction extends Action {
    async execute(browserPage, abortController = null) {
        console.log(`Typing in: ${this.actionText}`);

        await browserPage.typeIn(this.actionText);

        this.returnParams["Outcome"] = `${TYPE_IN} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute(browserPage, abortController);
    }
}

class SleepAction extends Action {
    constructor(action, actionText) {
        super(action, actionText);

        if (actionText.toLowerCase() == "forever") {
            this.blocking = true;
        }
        else {
            this.noSpinner = true;
        }
    }

    async execute(browserPage, abortController = null) {
        if (this.actionText.toLowerCase() != "forever") {
            let sleepTimeSeconds = extractNumberFromString(this.actionText);

            console.log(`Sleeping for: ${sleepTimeSeconds} milliseconds`);

            try {
                await delay(sleepTimeSeconds * 1000, abortController);
                this.returnParams["Outcome"] = `Sleep was completed successfully.`;
            }
            catch (e) {
                this.returnParams["WARNING"] = `Sleep was INTERRUPTED before complete and was therefore unsuccessful. It is likely that you will need to call sleep again.`;
            }
        }

        return await super.execute(browserPage, abortController);
    }
}

class SleepUntilAction extends Action {
    constructor(action, actionText) {
        super(action, actionText);
        this.noSpinner = true;
    }

    async execute(browserPage, abortController = null) {
        let sleepTill = convertStringToDate(this.actionText);
        console.log("Parsed date:", sleepTill);

        let difference = millisecondsUntil(sleepTill);

        console.log(`Sleeping until: ${sleepTill}, or ${difference}ms from now`);

        try {
            await delay(difference, abortController);
            this.returnParams["Outcome"] = `Sleep was completed successfully.`;
        }
        catch (e) {
            this.returnParams["WARNING"] = `Sleep was INTERRUPTED before complete and was therefore unsuccessful. It is likely that you will need to call sleep_until again.`;
        }

        return await super.execute(browserPage, abortController);
    }
}

class RequestUserInterventionAction extends Action {
    constructor(action, actionText) {
        super(action, actionText);
        this.blocking = true;
    }

    async execute(browserPage, abortController = null) {
        console.log(`Requesting user intervention: ${this.actionText}`);
        return await super.execute(browserPage, abortController);
    }
}


class FindInPageAction extends Action {
    constructor(action, actionText) {
        super(action, actionText);
        // this.blocking = true;
        this.result = null;
    }

    async execute(browserPage, abortController) {
        console.log(`Finding in page (blocking)`);

        const fullText = await browserPage.getPageText(true);
        const truncText = await ttokTruncate(fullText, 0, 10000);
        const chain = [
            {
                role: "system",
                content: `Your role is to provide all lines of text related to "${this.actionText}" from the upcoming user message. Output the entirety of EVERY line related to "${this.actionText}" EXACTLY as it appears in the user message, with ... URLs. Make sure to include special characters and URLs exactly as they appear. No additional commentary.`
            },
            {
                role: "user",
                content: truncText
            },
        ];

        // console.log(chain);

        this.result = await getResult(abortController.signal, chain, true);

        if (!this.result) {
            return null;
        }

        // console.log(this.result);

        var resultText;
        if (this.result.choices.length > 0) {
            resultText = this.result.choices[0].message.content;
        }
        else {
            resultText = "No matching results. Try again with a different search if necessary.";
        }

        console.log(resultText);

        this.cost = this.result.usage.prompt_tokens * DUMB_PROMPT_COST + this.result.usage.completion_tokens * DUMB_COMPLETION_COST;

        this.returnParams["All Find Results"] = await ttokTruncate(resultText, 0, 2000);

        if (this.returnParams["All Find Results"] != resultText) {
            this.returnParams["All Find Results"] += "\n# v TRUNCATED"
        }

        return await super.execute(browserPage, abortController);
    }
}

let actionClasses = {};

const GOTO_URL = "goto_url";
actionClasses[GOTO_URL] = GotoUrlAction;

const GO_BACK = "go_back";
actionClasses[GO_BACK] = GoBackAction;

const RELOAD = "reload";
actionClasses[RELOAD] = ReloadAction;

const CLICK_ON = "click_on";
actionClasses[CLICK_ON] = ClickOnAction;

const SLEEP = "sleep";
actionClasses[SLEEP] = SleepAction;

const SLEEP_UNTIL = "sleep_until";
actionClasses[SLEEP_UNTIL] = SleepUntilAction;

const REQUEST_USER_INTERVENTION = "request_user_intervention";
actionClasses[REQUEST_USER_INTERVENTION] = RequestUserInterventionAction;

const TYPE_IN = "type_in";
actionClasses[TYPE_IN] = TypeInAction;

const FIND_IN_PAGE = "find_in_page_text";
actionClasses[FIND_IN_PAGE] = FindInPageAction;

module.exports = { Action, GotoUrlAction, GoBackAction, ReloadAction, ClickOnAction, TypeInAction, SleepAction, SleepUntilAction, TypeInAction, RequestUserInterventionAction, TYPE_IN, actionClasses, FindInPageAction };
