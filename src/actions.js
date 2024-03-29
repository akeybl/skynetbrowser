const { randomDelay, isValidUrl, ttokTruncate } = require("./utilities.js");

class Action {
    constructor(browserPage, action, actionText) {
        this.browserPage = browserPage;
        this.action = action;
        this.actionText = actionText;
        this.returnParams = {};
        this.blocking = false;
    }

    async execute() {
        // throw new Error('Execute method must be implemented by subclasses');

        this.returnParams[`Current URL`] = await this.browserPage.page.url();
        const fullText = await this.browserPage.getPageText();
        this.returnParams[`Page Text for Current URL`] = await ttokTruncate(fullText, 0, 2000);

        // console.log(this.returnParams[`Page Text for Current URL`]);

        return this.returnParams;
    }
}

class GotoUrlAction extends Action {
    async execute() {
        console.log(`Going to URL: ${this.actionText}`);

        if (!isValidUrl(this.actionText)) {
            this.returnParams["Error"] = `Could not perform ${GOTO_URL}, invalid URL provided.`;
            return await super.execute();
        }

        try {
            await this.browserPage.page.goto(this.actionText, {timeout: 10000});
        } catch (error) {
            console.log(`Error: ${error}`);
        }

        await randomDelay(4000, 5000);

        return await super.execute();
    }
}

class GoBackAction extends Action {
    async execute() {
        console.log(`Going back in browser history`);

        await this.browserPage.page.goBack();

        this.returnParams["Outcome"] = `${GO_BACK} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute();
    }
}

class GoForwardAction extends Action {
    async execute() {
        console.log(`Going forward in browser history`);

        await this.browserPage.page.goForward();

        this.returnParams["Outcome"] = `${GO_FORWARD} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute();
    }
}

class ReloadAction extends Action {
    async execute() {
        console.log(`Reloading the page`);

        await this.browserPage.page.reload();

        this.returnParams["Outcome"] = `${RELOAD} operation complete.`;

        return await super.execute();
    }
}

class ClickOnAction extends Action {
    async execute() {
        console.log(`Clicking on: ${this.actionText}`);

        try {
            await this.browserPage.clickClosestText(this.actionText);
            this.returnParams["Outcome"] = `${CLICK_ON} operation complete.`;
        }
        catch {
            console.log("No matching text found.");
            this.returnParams["Error"] = `No text matching ${this.actionText} found.`
        }

        await randomDelay(4000, 5000);

        return await super.execute();
    }
}

class TypeInAction extends Action {
    async execute() {
        console.log(`Typing in: ${this.actionText}`);

        await this.browserPage.typeIn(this.actionText);
        
        this.returnParams["Outcome"] = `${TYPE_IN} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute();
    }
}

class ScrollUpAction extends Action {
    async execute() {
        console.log(`Scrolling up`);
        // XXX: Not yet implemented
        return await super.execute();
    }
}

class ScrollDownAction extends Action {
    async execute() {
        console.log(`Scrolling down`);
        // XXX: Not yet implemented
        return await super.execute();
    }
}

class SleepAction extends Action {
    constructor(browserPage, action, actionText) {
        super(browserPage, action, actionText);
        this.blocking = true;
    }

    async execute() {
        console.log(`Sleeping for: ${this.actionText} milliseconds`);
        // XXX: Not yet implemented
        return await super.execute();
    }
}

class SleepUntilAction extends Action {
    constructor(browserPage, action, actionText) {
        super(browserPage, action, actionText);
        this.blocking = true;
    }

    async execute() {
        console.log(`Sleeping until: ${this.actionText} (a specific condition is met)`);
        // XXX: Not yet implemented
        return await super.execute();
    }
}

class RequestUserInterventionAction extends Action {
    constructor(browserPage, action, actionText) {
        super(browserPage, action, actionText);
        this.blocking = true;
    }
    
    async execute() {
        console.log(`Requesting user intervention: ${this.actionText}`);
        return await super.execute();
    }
}

class CompletedAction extends Action {
    constructor(browserPage, action, actionText) {
        super(browserPage, action, actionText);
        this.blocking = true;
    }

    async execute() {
        console.log(`Action completed`);
        return await super.execute();
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
const SCROLL_UP = "scroll_up";
const SCROLL_DOWN = "scroll_down";
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
    scroll_up: ScrollUpAction,
    scroll_down: ScrollDownAction,
    sleep: SleepAction,
    sleep_until: SleepUntilAction,
    type_in: TypeInAction,
    completed: CompletedAction,
    request_user_intervention: RequestUserInterventionAction
    // request_user_clarification: RequestUserClarificationAction
};

module.exports = { actionClasses, Action, REQUEST_USER_INTERVENTION, SLEEP, SLEEP_UNTIL, COMPLETED, TYPE_IN}; // , REQUEST_USER_CLARIFICATION };
