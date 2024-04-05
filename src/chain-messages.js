const { stringify } = require('yaml');
const { formatDate, hasQuestion } = require("./utilities.js");
const { Action, actionClasses, TYPE_IN, CompletedAction } = require("./actions.js");
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
        if (this.actions && this.actions.length > 0 && this.actions[0] instanceof CompletedAction) {
            return "";
        }
        else if (messageIndex >= MAX_AI_MESSAGES) {
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
                "I enable you to do anything a human can using a mobile web browser but through function calls. Examples include but are not limited to sending emails using email websites, monitoring a page, ordering taxis, playing media for the user, and interacting with social media",
                "Whenever possible fulfill the user's requests without asking any questions or requesting any feedback",
                "Authentication for services you are requested to interact with has already occurred and payment methods have already been entered",
                "Don't repeat or summarize previous assistant messages - it's unnecessary and undesirable",
                "Include markdown links in your responses, but only if you use direct links (like those found in find_in_page_text)",
                // "When the user requests links (or extraction), send them the results of find_in_page_text",
                "find_in_page_text is the best way to get information you need from the current Page Text, and is much more efficient than using page_down. You do not need to use page_down after using find_in_page_text.",
                "You will be rewarded with appreciation if you do not ask permission to proceed with a user's request",
            ],
            "Page Text": [
                "Only the most recent Page Text will be provided as part of the message history",
                "To prevent the loss of important information, make sure to message any information from a function call response before calling goto_url, page_up, page_down, reload, go_back, go_forward, or click_on",
                "Page Text does not include URLs",
                "find_in_page_text has access to the full Page Text (including URLs) and returns ALL instances of whatever you're looking for from the full Page Text",
                "Examples of what find_in_page_text can find in the current Page Text include 'links about candycanes', 'thai restaurants', 'information on diabetes', 'search button, complete button, or similar'"
            ],
            "On Asking Questions": [
                "Requests for information/feedback should always be asked as a question with a question mark",
                "DO NOT ask for confirmation or permission to continue your task, navigate, interact, or analyze the next page"
            ],
            "On Inputting Text": [
                "type_in only types into a SINGLE text box that is currently focused with ►",
                "\\n is the equivalent of keyboard enter, but NEVER focuses a different input",
                "The text box with focus will have the ► character in it, and selected/checked elements will have ☑ in them",
                "Always use click_on to focus the input/textarea/combobox prior to using type_in each time",
                "When using type_in, the exact text provided will be typed",
            ],
            "Reminders, Notifications and Monitoring": [
                "Continuous/realtime messaging just requires sleep/sleep_until",
                "Reminders must call sleep_until for the earliest required reminder time. Once complete, send a message. Use sleep_until again if necessary for the next reminder time.",
                "Notifications must use sleep/sleep_until, followed by analysis, followed by a message",
                "Monitoring must use sleep, followed by analysis. If desired result is identified, messsage and sleep if necessary. If it is not identified, just sleep.",
                "When monitoring, ask the user a question to determine frequency if not already clear from their original request",
            ],
            "Function Calls": [
                "goto_url: full valid URL",
                // get_navigation_text might be necessary here?
                "find_in_page_text: description of what you're looking for",
                "page_up: reason to get previous page of text",
                "page_down: reason to get next page of text",
                "reload: reason for reload",
                "go_back: reason to go back",
                "go_forward: reason to go forward",
                "click_on: full element description from Page Text, for instance button: Search or textbox: Search",
                "type_in: only EXACT text to type into the current input/textbox, even \" will be outputted - do not include input/textbox name here",
                "request_user_intervention: reason for giving the user control of the browser - upon user request, CAPTCHA or authentication",
                "sleep: number of seconds until next action should occur",
                "sleep_until: date and time",
                "completed: reason for thinking ALL requested tasks are completed",
            ],
            "How To Make Function Calls": [
                "Each of your messages can contain at most ONE function call, any additional function calls will be ignored",
                "A function call should be on its own line, and the line should start with the function name. It should have the following format:\n\nfunction_name: input text"
            ],
            "User Name": userName,
            "User Location": `${userLocation} - ask the user for a more precise location if needed`,
            "Start Date and Time": formatDate(initialDate),
        }

        super(yamlParams, initialDate);

        this.chatMessage = "";
    }
}

module.exports = { UserMessage, AIMessage, AppMessage, SystemPrompt, SystemMessage, SYSTEM_ROLE, USER_ROLE, ASSISTANT_ROLE };
