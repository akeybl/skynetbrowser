const { randomDelay, isValidUrl, ttokTruncate, ttokLength } = require("./utilities.js");
const { PAGE_TOKEN_LENGTH } = require("./globals.js");

class Action {
    constructor(action, actionText) {
        this.action = action;
        this.actionText = actionText;
        this.returnParams = {};
        this.blocking = false;
    }

    async execute(browserPage) {
        // throw new Error('Execute method must be implemented by subclasses');

        if (!this.returnParams[`Page URL`]) {
            this.returnParams[`Page URL`] = await browserPage.page.url();
            const fullText = await browserPage.getPageText();
            const tokenLength = await ttokLength(fullText);
            const fullTextPages = Math.ceil( tokenLength / PAGE_TOKEN_LENGTH );
            this.returnParams["Page Number"] = `${browserPage.textPage}/${fullTextPages}`;

            this.returnParams[`Page Text`] = "";

            if (browserPage.textPage > 1) {
                this.returnParams[`Page Text`] += "# ^ TRUNCATED, USE page_up FOR MORE\n";
            }

            this.returnParams[`Page Text`] += await ttokTruncate(fullText, PAGE_TOKEN_LENGTH * (browserPage.textPage-1), PAGE_TOKEN_LENGTH * browserPage.textPage);

            if (this.returnParams[`Page Text`] != fullText) {
                this.returnParams[`Page Text`] += "\n# v TRUNCATED, USE page_down FOR MORE"
            }
        }

        // console.log(this.returnParams[`Page Text for Current URL`]);

        return this.returnParams;
    }
}

class GotoUrlAction extends Action {
    async execute(browserPage) {
        console.log(`Going to URL: ${this.actionText}`);

        if (!isValidUrl(this.actionText)) {
            this.returnParams["Error"] = `Could not perform ${GOTO_URL}, invalid URL provided.`;
            return await super.execute();
        }

        try {
            await browserPage.page.goto(this.actionText, {timeout: 10000});
        } catch (error) {
            console.log(`Error: ${error}`);
        }

        await randomDelay(4000, 5000);

        return await super.execute(browserPage);
    }
}

class GoBackAction extends Action {
    async execute(browserPage) {
        console.log(`Going back in browser history`);

        await browserPage.page.goBack();

        this.returnParams["Outcome"] = `${GO_BACK} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute(browserPage);
    }
}

class GoForwardAction extends Action {
    async execute(browserPage) {
        console.log(`Going forward in browser history`);

        await browserPage.page.goForward();

        this.returnParams["Outcome"] = `${GO_FORWARD} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute(browserPage);
    }
}

class ReloadAction extends Action {
    async execute(browserPage) {
        console.log(`Reloading the page`);

        await browserPage.page.reload();

        this.returnParams["Outcome"] = `${RELOAD} operation complete.`;

        return await super.execute(browserPage);
    }
}

class ClickOnAction extends Action {
    async execute(browserPage) {
        console.log(`Clicking on: ${this.actionText}`);

        try {
            await browserPage.clickClosestText(this.actionText);
            this.returnParams["Outcome"] = `${CLICK_ON} operation complete.`;
        }
        catch {
            console.log("No matching text found.");
            this.returnParams["Error"] = `No text matching ${this.actionText} found.`
        }

        await randomDelay(4000, 5000);

        return await super.execute(browserPage);
    }
}

class TypeInAction extends Action {
    async execute(browserPage) {
        console.log(`Typing in: ${this.actionText}`);

        await browserPage.typeIn(this.actionText);
        
        this.returnParams["Outcome"] = `${TYPE_IN} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute(browserPage);
    }
}

class SleepAction extends Action {
    constructor(action, actionText) {
        super(action, actionText);
        this.blocking = true;
    }

    async execute(browserPage) {
        console.log(`Sleeping for: ${this.actionText} milliseconds`);
        // XXX: Not yet implemented
        return await super.execute(browserPage);
    }
}

class SleepUntilAction extends Action {
    constructor(action, actionText) {
        super(action, actionText);
        this.blocking = true;
    }

    async execute(browserPage) {
        console.log(`Sleeping until: ${this.actionText} (a specific condition is met)`);
        // XXX: Not yet implemented
        return await super.execute(browserPage);
    }
}

class RequestUserInterventionAction extends Action {
    constructor(action, actionText) {
        super(action, actionText);
        this.blocking = true;
    }
    
    async execute(browserPage) {
        console.log(`Requesting user intervention: ${this.actionText}`);
        return await super.execute(browserPage);
    }
}

class CompletedAction extends Action {
    constructor(action, actionText) {
        super(action, actionText);
        this.blocking = true;
    }

    async execute(browserPage) {
        console.log(`Action completed`);
        return await super.execute(browserPage);
    }
}

class PageUpAction extends Action {    
    async execute(browserPage) {
        console.log(`Paging up`);
        browserPage.textPage -= 1;
        return await super.execute(browserPage);
    }
}

class PageDownAction extends Action {    
    async execute(browserPage) {
        console.log(`Paging down`);
        browserPage.textPage += 1;
        return await super.execute(browserPage);
    }
}

// class RequestUserClarificationAction extends Action {
//     execute() {
//         console.log(`Requesting user clarification: ${this.actionText}`);
//     }
// }

const GOTO_URL = "goto_url";
const GO_BACK = "go_back";
const GO_FORWARD = "go_forward";
const RELOAD = "reload";
const CLICK_ON = "click_on";
const PAGE_UP = "page_up";
const PAGE_DOWN = "page_down";
const SLEEP = "sleep";
const SLEEP_UNTIL = "sleep_until";
const REQUEST_USER_INTERVENTION = "request_user_intervention";
const COMPLETED = "completed";
const TYPE_IN = "type_in";
// const REQUEST_USER_CLARIFICATION = "request_user_clarification";

const actionClasses = {
    goto_url: GotoUrlAction,
    go_back: GoBackAction,
    go_forward: GoForwardAction,
    reload: ReloadAction,
    click_on: ClickOnAction,
    type_in: TypeInAction,
    page_up: PageUpAction,
    page_down: PageDownAction,
    sleep: SleepAction,
    sleep_until: SleepUntilAction,
    type_in: TypeInAction,
    completed: CompletedAction,
    request_user_intervention: RequestUserInterventionAction
    // request_user_clarification: RequestUserClarificationAction
};

module.exports = { actionClasses, Action, REQUEST_USER_INTERVENTION, SLEEP, SLEEP_UNTIL, COMPLETED, TYPE_IN, PAGE_UP, PAGE_DOWN }; // , REQUEST_USER_CLARIFICATION };
