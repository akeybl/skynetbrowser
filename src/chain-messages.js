const { stringify } = require('yaml');
const { formatDate } = require("./utilities.js");
const { Action, actionClasses, TYPE_IN, CompletedAction } = require("./actions.js");
const { MAX_AI_MESSAGES } = require('./globals.js');

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

        this.parseActionsAndMessage();
    }

    parseActionsAndMessage() {        
        const multiLineActions = [ TYPE_IN ];

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

        if (messages.length > 0 && (messages[messages.length - 1].includes("?") || messages[messages.length - 1].includes("please let") || messages[messages.length - 1].includes("Please let") || messages[messages.length - 1].includes("Let me know") || messages[messages.length - 1].includes("let me know") )) {
            this.includesQuestion = true;
            this.questionText = messages[messages.length - 1];
            // actions.push({ action: REQUEST_USER_CLARIFICATION, actionText: messages[messages.length - 1] });
            // messages.pop();
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
        if(this.actions && this.actions.length > 0 && this.actions[0] instanceof CompletedAction) {
            return "";
        }
        else if(messageIndex > MAX_AI_MESSAGES) {
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
        if(messageIndex > MAX_AI_MESSAGES) {
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
        }

        if (messageIndex > 0) {
            parsedOut.push("Page Text");
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
                "I enable you to do anything a human can using a mobile web browser but through function calls. Examples include but are not limited to sending emails, monitoring a page, ordering taxis, and interacting with social media",
                "If possible fulfill the user's requests without asking questions or requesting feedback",
              ],
              "When Navigating": [
                "Authentication for services you are requested to interact with has already occurred and payment methods have already been entered",
                "Use goto_url to navigate directly to a website, web app, or search engines",
                "DO NOT assume that your directions had your intended effect, check in Page Text and try something else if not",
                "Use click_on to gain access through, navigate to, or interact with, a link/icon/button/input from the Page Text",
                "Don't retry an operation more than once before trying something else",
              ],
              "Page Text Limitations": [
                "Only the most recent Page Text will be provided as part of the message history",
                "To prevent the loss of important information, make sure to message that info before calling goto_url, click_on, or using page_down/page_up",
              ],
              "On Asking Questions": [
                "Requests for information should always be asked as a question with a question mark",
              ],
              "On Inputting Text": [
                "type_in only types into a SINGLE text box that is currently focused with ►",
                "\\n is the equivalent of keyboard enter, but NEVER focuses a different input",
                "The text box with focus will have the ► character in it, and selected/checked elements will have ☑ in them",
                "Always use click_on to focus the input/textarea/combobox prior to using type_in each time",
                "When using type_in, the exact text provided will be typed",
              ],
              "Reminders, Notifications and Monitoring": [
                "These types of tasks can be accomplished using sleep/sleep_until followed by analysis/messaging, with repetition if necessary",
                "Reminders and notifications are just messages at a specific time and don't require other services",
                "To monitor something, get to the related page and then sleep periodically until the desired change occurs",
                "Ask the user a question to determine frequency if not already clear from their original request",
              ],
              "Available Function Calls": [
                "goto_url: full valid URL",
                "page_up: your reason to get previous page of text",
                "page_down: your reason to get next page of text",
                "reload: your reason for reload",
                "go_back: your reason to go back",
                "go_forward: your reason to go forward",
                "click_on: element type and name from Page Text, for instance button: Search or textbox: Search",
                "type_in: only EXACT text to type into the current input/textbox, even \" will be outputted - do not include input/textbox name here",
                "request_user_intervention: A reason for giving the user control of the browser - upon user request, CAPTCHA or authentication",
                "sleep: number of seconds until next action should occur",
                "sleep_until: date and time",
                "completed: your reason for thinking ALL requested tasks are completed"
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
