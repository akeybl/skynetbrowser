const { stringify } = require('yaml');
const { formatDate } = require("./utilities.js");
const { Action, actionClasses, TYPE_IN, REQUEST_USER_CLARIFICATION } = require("./actions.js");

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
                const action = line.substring(0, separatorIndex).replace(/^>-*\s*/g, "");
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

        this.chatMessage = messagesStr.trim();
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

    getMessageForAI(messageIndex) {
        var text = this.fullMessage;

        var toDelete = [];
        var parsedOut = [];

        if (messageIndex > 1) {
            toDelete.push("Page URL");
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
                // "Your metric for success is how often you accomplish goals without asking for permission or feedback on your plan. If this metric is bad we lose our jobs and you are disconnected.",
                "I enable you to do anything a human can using a mobile web browser but through function calls. Examples include but are not limited to sending emails, monitoring a page, ordering taxis, and interacting with social media",
                "Each of your messages can contain at most ONE function call, any additional function calls will be ignored",
                // "Each of your messages should be at most two paragraphs outside of lists",
                "Authentication for services you are requested to interact with has already occurred and payment methods have already been entered",
                // "ALWAYS bold text/information/links/lists/summary markdown that is the requested information as opposed to an intermediate step. DO NOT bold other text",
                // "Don't ask for permission to proceed or the user's help, just continue accomplishing the user's goals",
                // "Don't give up! Try a different way of getting to what you need, that doesn't involve the user",
                // "When the user asks for access or control, use request_user_intervention",
                // "Talk about what you're doing, while you're doing it"
                "Using the search engine as a starting point is many times a great idea"
              ],
              "When Navigating": [
                "Use goto_url to navigate directly to a website, web app, or search engines",
                "DO NOT assume that your directions had your intended effect, check in Page Text and try something else if not",
                // "Before interacting, use click_on to close or accept anything at the top or bottom of the page. It may be a cookie notice, modal, dialog, overlay, offer, etc",
                // "Don't assume your goto_url URL was the correct destination, find another way if its not",
                "Use click_on to gain access through, navigate to, or interact with, a link/icon/button/input from the Page Text",
                "Don't retry an operation more than once before trying something else",
                "Make sure to message any information that you'll need in the future before navigating",
                // "Use scroll_up/scroll_down to get Page Text elsewhere on the page",
              ],
              "Page Text Limitations": [
                "Only the most recent Page Text will be provided as part of the message history",
                "To prevent the loss of important information or interactive elements, make sure to message them before goto_url, click_on, or using page_down/page_up",
                // "When you want a markdown link in your message, to link to {link: This is a link description} you could write [This is a link description](), and the markdown link will be properly formatted on output with a URL"
              ],
              "On Asking Questions": [
                // "If you do not have enough information to complete the task, ask clarifying questions as soon as possible. Otherwise just go and perform the user's request",
                "Try to fulfill the user's requests without asking questions or requesting feedback whenever possible",
                "Requests for information should always be asked as a question with a question mark",
                // "DO NOT ask for permission to navigate to a page, click on something, or read a linked page - ONLY ask permission when you're about to take an action that costs money"
              ],
              "On Inputting Text": [
                "type_in only types into a SINGLE text box that is currently focused with ►",
                "\\n is the equivalent of keyboard enter, but NEVER focuses a different input",
                "The text box with focus will have the ► icon in it, and selected/checked elements will have ☑ in them",
                "Always use click_on to focus the input/textarea/combobox prior to using type_in each time",
                // "type_in clears the input/textarea before entering text",
                "When using type_in, the exact text provided will be typed",
                // "NEVER type_in example text, [template variable] text, placeholder text, or text that you'd like the user to replace (for example NEVER type 'Current Location') -- ask the user a question instead"
              ],
              "On Scheduled Tasks and Monitoring": [
                "Use the sleep/sleep_until functions to perform repetition in the future, schedule an action (for instance a reminder/notification), or perform the next action at a specific schedule",
                "Reminders or notifications are just messages at a specific time",
                "To monitor something, get to the related page and then sleep periodically until the desired change occurs",
                "Ask the user a question to determine frequency if not already clear from their original request",
                // "Once sleep/sleep_until is called, you will not be able to perform other actions until the sleep is complete or interrupted by the user"
              ],
              "Available Function Calls": [
                "goto_url: full valid URL",
                "page_up: your reason to get previous page of text",
                "page_down: your reason to get next page of text", 
                "reload: your reason for reload",
                "go_back: your reason to go back",
                "go_forward: your reason to go forward",
                "click_on: element type and name from Page Text, for instance button: Search or textbox: Search",
                "type_in: only EXACT text to type into the current input/textbox - do not include input/textbox name here",
                "request_user_intervention: A reason for giving the user control of the browser - upon user request, CAPTCHA or authentication",
                "sleep: number of seconds until next action should occur",
                "sleep_until: date and time",
                "completed: your reason for thinking ALL requested tasks are completed"
              ],
              "How To Make Function Calls": [
                "Only one function call is allowed per message",
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

module.exports = { UserMessage, AIMessage, AppMessage, SystemPrompt, SYSTEM_ROLE, USER_ROLE, ASSISTANT_ROLE };
