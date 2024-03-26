const { delay, isValidUrl } = require("./utilities.js");

class Action {
    constructor(browserPage, action, actionText) {
        this.browserPage = browserPage;
        this.action = action;
        this.actionText = actionText;
        this.returnParams = {};
    }

    async execute() {
        // throw new Error('Execute method must be implemented by subclasses');

        this.returnParams[`Current URL`] = await this.browserPage.page.url();
        this.returnParams[`Page Text for Current URL`] = await this.browserPage.getPageText();

        return this.returnParams;
    }
}

class GotoUrlAction extends Action {
    async execute() {
        console.log(`Going to URL: ${this.actionText}`);

        if (!isValidUrl(this.actionText)) {
            this.returnParams["Error"] = `Could not perform ${GOTO_URL}, invalid URL provided.`;
            return;
        }

        try {
            await this.browserPage.page.goto(this.actionText, { waitUntil: 'networkidle0' });
        } catch (error) {
            console.log(`Error: ${error}`);
        }

        return super.execute();
    }
}

class GoBackAction extends Action {
    async execute() {
        console.log(`Going back in browser history`);

        this.browserPage.page.goBack();
        return super.execute();
    }
}

class GoForwardAction extends Action {
    async execute() {
        console.log(`Going forward in browser history`);
        this.browserPage.page.goForward();
        return super.execute();
    }
}

class ReloadAction extends Action {
    async execute() {
        console.log(`Reloading the page`);
    }
}

class ClickOnAction extends Action {
    async execute() {
        console.log(`Clicking on: ${this.actionText}`);

        try {
            this.browserPage.clickClosestText(this.actionText);
        }
        catch {
            console.log("No matching text found.");
            this.returnParams["Error"] = `No text matching ${this.actionText} found.`
        }
    }
}

class TypeInAction extends Action {
    async execute() {
        console.log(`Typing in: ${this.actionText}`);
    }
}

class ScrollUpAction extends Action {
    async execute() {
        console.log(`Scrolling up`);
    }
}

class ScrollDownAction extends Action {
    async execute() {
        console.log(`Scrolling down`);
    }
}

class SleepAction extends Action {
    async execute() {
        console.log(`Sleeping for: ${this.actionText} milliseconds`);
    }
}

class SleepUntilAction extends Action {
    async execute() {
        console.log(`Sleeping until: ${this.actionText} (a specific condition is met)`);
    }
}

class RequestUserInterventionAction extends Action {
    async execute() {
        console.log(`Requesting user intervention: ${this.actionText}`);
    }
}

class CompletedAction extends Action {
    async execute() {
        console.log(`Action completed`);
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
const REQUEST_USER_CLARIFICATION = "request_user_clarification";

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
    type_in: RequestUserInterventionAction,
    completed: CompletedAction,
    // request_user_clarification: RequestUserClarificationAction
};

module.exports = { actionClasses, Action, TYPE_IN}; // , REQUEST_USER_CLARIFICATION };
