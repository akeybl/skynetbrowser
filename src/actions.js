const { randomDelay, isValidUrl, ttokTruncate, ttokLength } = require("./utilities.js");
const { PAGE_TOKEN_LENGTH } = require("./globals.js");

class Action {
    constructor(action=null, actionText=null) {
        this.action = action;
        this.actionText = actionText;
        this.returnParams = {};
        this.blocking = false;
        this.urlAfterExecute = null;
        this.fullTextAfterExecute = null;
        this.pageTextAfterExecute = null;
    }

    async execute(browserPage) {
        // throw new Error('Execute method must be implemented by subclasses');

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
        const tokenLength = await ttokLength(this.fullTextAfterExecute);
        const fullTextPages = Math.ceil( tokenLength / PAGE_TOKEN_LENGTH );
        this.returnParams["Page Number"] = `${browserPage.textPage}/${fullTextPages}`;
        this.pageTextAfterExecute = "";

        if (browserPage.textPage > 1) {
            this.pageTextAfterExecute += "# ^ TRUNCATED, USE page_up FOR MORE\n";
        }

        this.pageTextAfterExecute += await ttokTruncate(this.fullTextAfterExecute, PAGE_TOKEN_LENGTH * (browserPage.textPage-1), PAGE_TOKEN_LENGTH * browserPage.textPage);

        if ( browserPage.textPage != fullTextPages ) {
            this.pageTextAfterExecute += "\n# v TRUNCATED, USE page_down FOR MORE"
        }

        this.returnParams[`Page Text`] = this.pageTextAfterExecute;

        if( browserPage.includeURLs ) {
            this.returnParams[`Current Mode`] = "Extraction";
        }
        else {
            this.returnParams[`Current Mode`] = "Interaction";
        }

        // console.log(this.returnParams[`Page Text for Current URL`]);

        return this.returnParams;
    }
}

class GotoUrlAction extends Action {
    async execute(browserPage) {
        console.log(`Going to URL: ${this.actionText}`);

        if (browserPage.includeURLs) {
            browserPage.includeURLs = false;
        }

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

        if (browserPage.includeURLs) {
            browserPage.includeURLs = false;
        }

        await browserPage.page.goBack();

        this.returnParams["Outcome"] = `${GO_BACK} operation complete.`;

        await randomDelay(2000, 3000);

        return await super.execute(browserPage);
    }
}

class GoForwardAction extends Action {
    async execute(browserPage) {
        console.log(`Going forward in browser history`);

        if (browserPage.includeURLs) {
            browserPage.includeURLs = false;
        }

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

        await randomDelay(2000, 3000);

        return await super.execute(browserPage);
    }
}

class ClickOnAction extends Action {
    async execute(browserPage) {
        console.log(`Clicking on: ${this.actionText}`);

        if (browserPage.includeURLs) {
            browserPage.includeURLs = false;
        }

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

        if (browserPage.includeURLs) {
            browserPage.includeURLs = false;
        }

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
        this.returnParams["Outcome"] = `${PAGE_UP} to page ${browserPage.textPage} complete.`;
        return await super.execute(browserPage);
    }
}

class PageDownAction extends Action {    
    async execute(browserPage) {
        console.log(`Paging down`);
        browserPage.textPage += 1;
        this.returnParams["Outcome"] = `${PAGE_DOWN} to page ${browserPage.textPage} complete.`;
        return await super.execute(browserPage);
    }
}

class ChangeModeAction extends Action {
    async execute(browserPage) {
        console.log(`Changing modes`);

        browserPage.includeURLs = !browserPage.includeURLs;

        return await super.execute(browserPage);
    }
}

let actionClasses = {};

const GOTO_URL = "goto_url";
actionClasses[GOTO_URL] = GotoUrlAction;

const GO_BACK = "go_back";
actionClasses[GO_BACK] = GoBackAction;

const GO_FORWARD = "go_forward";
actionClasses[GO_FORWARD] = GoForwardAction;

const RELOAD = "reload";
actionClasses[RELOAD] = ReloadAction;

const CLICK_ON = "click_on";
actionClasses[CLICK_ON] = ClickOnAction;

const PAGE_UP = "page_up";
actionClasses[PAGE_UP] = PageUpAction;

const PAGE_DOWN = "page_down";
actionClasses[PAGE_DOWN] = PageDownAction;

const SLEEP = "sleep";
actionClasses[SLEEP] = SleepAction;

const SLEEP_UNTIL = "sleep_until";
actionClasses[SLEEP_UNTIL] = SleepUntilAction;

const REQUEST_USER_INTERVENTION = "request_user_intervention";
actionClasses[REQUEST_USER_INTERVENTION] = RequestUserInterventionAction;

const COMPLETED = "completed";
actionClasses[COMPLETED] = CompletedAction;

const TYPE_IN = "type_in";
actionClasses[TYPE_IN] = TypeInAction;

const CHANGE_MODE = "change_mode";
actionClasses[CHANGE_MODE] = ChangeModeAction;

module.exports = { Action, GotoUrlAction, GoBackAction, GoForwardAction, ReloadAction, ClickOnAction, TypeInAction, PageUpAction, PageDownAction, SleepAction, SleepUntilAction, TypeInAction, CompletedAction, RequestUserInterventionAction, ChangeModeAction, TYPE_IN, actionClasses };
