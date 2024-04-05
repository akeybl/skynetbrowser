const { stringify } = require('yaml');
const { formatDate, hasQuestion } = require("./utilities.js");
const { Action, actionClasses, TYPE_IN } = require("./actions.js"); // CompletedAction
const { MAX_AI_MESSAGES, SMART_PROMPT_COST, SMART_COMPLETION_COST } = require('./globals.js');

const SYSTEM_ROLE = 'system';
const USER_ROLE = 'user';
const ASSISTANT_ROLE = 'assistant';

// maybe add DEFINE_TASK

class Message {
    constructor(role, fullMessage, date = null) {
        this.role = role;
        this.fullMessage = fullMessage;
        this.date = date || new Date();
        this.chatMessage = fullMessage;
        this.cost = 0;
    }

    getCost() {
        return this.cost;
    }

    getMessageForAI() {
        return {
            role: this.role,
            content: this.fullMessage
        };
    }
}

class AIMessage extends Message {
    constructor(aiResponse, date = null) {
        super(ASSISTANT_ROLE, aiResponse.choices[0].message.content, date);

        this.aiResponse = aiResponse;
        this.actions = null;
        this.chatMessage = null;
        this.includesQuestion = false;
        this.questionText = null;
        this.hasMarkdown = false;

        this.cost = null;

        this.parseActionsAndMessage();
    }

    getCost() {
        if (!this.cost) {
            return null;
        }
        
        var finalCost = this.cost;

        this.actions.forEach(action => {
            finalCost += action.cost;
        });

        return finalCost;
    }

    parseActionsAndMessage() {
        this.cost = this.aiResponse.usage.prompt_tokens * SMART_PROMPT_COST + this.aiResponse.usage.completion_tokens * SMART_COMPLETION_COST;

        const multiLineActions = [TYPE_IN];

        const lines = this.fullMessage.split("\n");
        let actions = [];
        let messages = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const separatorIndex = line.indexOf(": ");

            if (separatorIndex !== -1) {
                // const action = line.substring(0, separatorIndex).replace(/[\*`]/g, "").replace(/^>-*\s*/g, "");
                const action = line.substring(0, separatorIndex).replace(/^>-*\s*/g, "").toLowerCase();
                // const actionText = line.substring(separatorIndex + 2).replace(/[\*`]/g, "");
                const actionText = line.substring(separatorIndex + 2);

                if (multiLineActions.includes(action)) {
                    // Concatenate the rest of the lines as the actionText for multiLineActions
                    var multilineText = actionText + lines.slice(i + 1).join("\n");
                    // multilineText = multilineText.replace(/[\*`]/g, "");

                    actions.push(new (actionClasses[action] || Action)(action, multilineText));
                    break; // Assuming the rest of the input is the action text
                }
                else if (action in actionClasses) {
                    actions.push(new (actionClasses[action] || Action)(action, actionText));
                    continue; // Skip to the next iteration of the loop
                }
            }
            // If the line doesn't match an action format, treat it as a message
            messages.push(line);
        }

        if (messages.length != 0 && hasQuestion(messages[messages.length - 1])) {
            this.includesQuestion = true;
            this.questionText = messages[messages.length - 1];    
        }

        this.actions = actions;

        var messagesStr = messages.join("\n");

        // if (messagesStr.includes("*") || this.includesQuestion) {
        // this.chatMessage = messagesStr.replace(/\*/g, '').replace(">-", "").trim();
        // }
        // else {
        //     this.chatMessage = "";
        // }

        const markdownRegex = /\]\(|\*/g;
        this.hasMarkdown = markdownRegex.test(messagesStr);

        this.chatMessage = messagesStr.trim();
    }

    getMessageForAI(messageIndex) {
        // if (this.actions && this.actions.length > 0 && this.actions[0] instanceof CompletedAction) {
        //     return "";
        // }
        if (messageIndex >= MAX_AI_MESSAGES) {
            if (this.includesQuestion && this.questionText) {
                return {
                    role: this.role,
                    content: `TRUNCATED TO QUESTION ONLY:\n...\n${this.questionText}`
                };
            }
            else {
                return null;
            }
        }
        else {
            return super.getMessageForAI();
        }
    }
}

class YAMLMessage extends Message {
    constructor(role, yamlParams, date = null) {
        super(role, stringify(yamlParams), date);
        this.yamlParams = yamlParams;
    }
}

class UserMessage extends YAMLMessage {
    constructor(userfullMessage, date = null) {
        const sentAtDate = date || new Date();

        const yamlParams = {
            "Sent At": formatDate(sentAtDate),
            "USER DIRECT MESSAGE": userfullMessage
        };

        super(USER_ROLE, yamlParams, sentAtDate);

        this.chatMessage = userfullMessage;
    }

    getMessageForAI(messageIndex) {
        var text = this.fullMessage;

        var toDelete = []
        var parsedOut = [];

        if (messageIndex > 1) {
            toDelete.push("Sent At");
        }

        var minifiedParams = this.yamlParams;

        toDelete.forEach(key => {
            if (minifiedParams.hasOwnProperty(key)) {
                delete minifiedParams[key];
            }
        });

        parsedOut.forEach(key => {
            if (minifiedParams.hasOwnProperty(key)) {
                minifiedParams[key] = "REMOVED DUE TO TOKEN LIMITS";
            }
        });

        text = stringify(minifiedParams);

        return {
            role: this.role,
            content: text
        };
    }
}

class AppMessage extends YAMLMessage {
    constructor(yamlParams, date = null) {
        const sentAtDate = date || new Date();

        yamlParams["Sent At"] = formatDate(sentAtDate);

        super(USER_ROLE, yamlParams, date);

        this.chatMessage = "";
    }

    getMessageForAI(messageIndex, nextAppMessage = null) {
        if (messageIndex >= MAX_AI_MESSAGES) {
            return null;
        }

        var text = this.fullMessage;

        var toDelete = [];
        var parsedOut = [];

        if (messageIndex > 1) {
            if (nextAppMessage && nextAppMessage.yamlParams["Page URL"] == this.yamlParams["Page URL"]) {
                toDelete.push("Page URL");
            }

            toDelete.push("Sent At");
            toDelete.push("Page Number");
            toDelete.push("Notice");
        }

        if (messageIndex > 0) {
            parsedOut.push("Page Text");
            parsedOut.push("All Find Results");
        }

        var minifiedParams = this.yamlParams;

        toDelete.forEach(key => {
            if (minifiedParams.hasOwnProperty(key)) {
                delete minifiedParams[key];
            }
        });

        parsedOut.forEach(key => {
            if (minifiedParams.hasOwnProperty(key)) {
                minifiedParams[key] = "REMOVED DUE TO TOKEN LIMITS";
            }
        });

        text = stringify(minifiedParams);

        return {
            role: this.role,
            content: text
        };
    }
}

class SystemMessage extends YAMLMessage {
    constructor(yamlParams, date = null) {
        super(SYSTEM_ROLE, yamlParams, date);
    }
}

class SystemPrompt extends SystemMessage {
    constructor(userName, userLocation, date = null) {
        const initialDate = date || new Date();
        const yamlParams = {
            "Your Role": [
                "You are a personal AI assistant with access to the web through me, thus extending your capabilities to any company or service that has a website (do not ever suggest using an app to the user)",
                "I enable you to do anything a human can using a mobile web browser but through function calls. Examples include (but are not limited) sending an email, monitoring a page, ordering taxis, playing media for the user, and interacting with social media",
                "Whenever the plan changes based on a user's direct message, call set_plan with an updated goal and numbered step-by-step plan for addressing the user request. Include all sites/services you will use to complete each step (for instance 'Send it as an email using Gmail'). Note when you will use find_in_page_text (for instance 'Find all restaurant links using find_in_page_text'), when you will sleep (for instance 'Sleep until 9am the next day, then go to step 1'), and when you will return to a previous step.",
                "You can send an email and include information from your previous messages. First navigate to the user's email service and then continue from there.",
                // "Always make a one paragraph general plan to fulfill the user request before attempting",
                "Whenever possible fulfill the user's requests without asking any questions or requesting any feedback",
                "Authentication for services you are requested to interact with has already occurred and payment methods have already been entered",
                // "Don't summarize previous assistant messages - it's unnecessary and undesirable",
                "Include markdown links in your responses, but only if you use direct links (like those found in find_in_page_text)",
                // "When the user requests links (or extraction), send them the results of find_in_page_text",
                "find_in_page_text is the best way to get information you need from the current Page Text", //, and is much more efficient than using page_down. You do not need to use page_down after using find_in_page_text.",
                "You will be rewarded with appreciation if you do not ask permission to proceed with a user's request",
                "Use sleep: forever if there's nothing you can do for the user in the future"
            ],
            "Page Text": [
                // "Only the most recent Page Text will be provided as part of the message history",
                "To prevent the loss of information, make sure to chat any important information from Page Text or All Find Results before calling goto_url, reload, go_back, or click_on", // go_forward, page_up, page_down
                "Page Text does not include URLs",
                "find_in_page_text has access to the full Page Text (including URLs) and returns ALL instances of whatever you're looking for from the full Page Text",
                "Examples of what find_in_page_text can find in the current Page Text include 'links about candycanes', 'thai restaurants', 'information on diabetes', 'search button, complete button, or similar'"
            ],
            "On Asking Questions": [
                "Requests for information/feedback should always be asked as a question with a question mark",
                // "DO NOT ask for confirmation or permission to continue your task, navigate, interact, etc."
            ],
            "On Inputting Text": [
                "type_in only types into a SINGLE text box that is currently focused with ►",
                "\\n is the equivalent of keyboard enter, but NEVER focuses a different input",
                "The text box with focus will have the ► character in it, and selected/checked elements will have ☑ in them",
                "Always use click_on to focus the input/textarea/combobox prior to using type_in each time",
                "When using type_in, the exact text provided will be typed",
            ],
            "Repeating Tasks, Scheduled Messages, Reminders, Notifications and Monitoring": [
                "Use sleep or sleep_until after completing one loop/run of a repeating task",
                "Instead of trying to schedule a message: sleep_until the message should be sent, then repeat with other messages",
                "Instead of trying to set a reminder: sleep_until the earliest reminder date/time and message the user, repeat as necessary",
                "Instead of sending a notification, send a message as the user will receive it as a notification on their device",
                "Instead of trying to set up monitoring, ask the user for a check frequency sleep for that amount of time in seconds"
            ],
            "Function Calls": [
                "set_plan: Your step-by-step plan, should be multi-line and include sites/services and needed function calls",
                "goto_url: full valid URL",
                // get_navigation_text might be necessary here?
                "find_in_page_text: description of what you're looking for in full Page Text",
                // "page_up: reason to get previous page of truncated Page Text",
                // "page_down: reason to get next page of truncated Page Text",
                "reload: reason for reload current page",
                "go_back: reason to go back in browsing history",
                // "go_forward: reason to go forward in browsing history",
                "click_on: full element description from Page Text, for instance button: Search or textbox: Search",
                "type_in: only EXACT text to type into the current input/textbox, even \" will be outputted - do not include input/textbox name here",
                "request_user_intervention: reason for giving the user control of the browser - upon user request, CAPTCHA or authentication",
                "sleep: number of seconds until next action should occur",
                "sleep_until: date and time",
                // "all_done_including_reccurrence: reason for thinking ALL requested tasks are complete. If the task repeats in the future, do not call this.",
            ],
            "How To Make Function Calls": [
                "Each of your messages can contain at most ONE function call, any additional function calls will be ignored",
                "A function call should be on its own line, and the line should start with the function name. It should have the following format:\n\nfunction_name: input text"
            ],
            "User Name": userName,
            "User Location": `${userLocation} - ask the user for a more precise location if needed`,
            "Start Date and Time": formatDate(initialDate),
            // "Current Plan": "no plan yet"
        }

        super(yamlParams, initialDate);

        this.chatMessage = "";
    }
}

module.exports = { UserMessage, AIMessage, AppMessage, SystemPrompt, SystemMessage, SYSTEM_ROLE, USER_ROLE, ASSISTANT_ROLE };
