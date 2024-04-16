import { stringify } from 'yaml';
import { formatDate, hasQuestion } from "./utilities";
import { Action, actionClasses, TYPE_IN } from "./actions";
import { MAX_AI_MESSAGES, SMART_PROMPT_COST, SMART_COMPLETION_COST, URL_TRUNCATION_LENGTH } from './globals';

export const SYSTEM_ROLE = 'system';
export const USER_ROLE = 'user';
export const ASSISTANT_ROLE = 'assistant';

export class Message {
    role: string;
    fullMessage: string;
    date: Date;
    chatMessage: string;
    cost: number;

    constructor(role: string, fullMessage: string, date: Date | null = null) {
        this.role = role;
        this.fullMessage = fullMessage;
        this.date = date || new Date();
        this.chatMessage = fullMessage;
        this.cost = 0;
    }

    getCost() {
        return this.cost;
    }

    getMessageForAI(messageIndex: number = -1): { role: string; content: string; } | null {
        return {
            role: this.role,
            content: this.fullMessage
        };
    }
}

export class AIMessage extends Message {
    aiResponse: any;
    actions: Action[];
    includesQuestion: boolean;
    questionText: string | null;
    hasMarkdown: boolean;

    constructor(aiResponse: any, pageLinks: Array<string>, date: Date | null = null) {
        super(ASSISTANT_ROLE, aiResponse.choices[0].message.content, date);

        this.aiResponse = aiResponse;
        this.actions = [];
        this.chatMessage = "";
        this.includesQuestion = false;
        this.questionText = null;
        this.hasMarkdown = false;

        this.cost = 0;

        this.fixURLs(pageLinks);
        this.parseActionsAndMessage();
    }

    getCost() {
        if (!this.cost) {
            return 0;
        }

        var finalCost = this.cost;

        this.actions.forEach(action => {
            finalCost += action.cost;
        });

        return finalCost;
    }

    fixURLs(pageLinks: Array<string>) {
        const pageLinksSorted = pageLinks.sort((a, b) => b.length - a.length);
        var alreadyMatched: string[] = [];

        pageLinksSorted.forEach(link => {
            var truncatedLink = link.replace("https://www.", "").replace("http://www.", "").replace("https://", "").replace("http://", "");

            if (truncatedLink.length > URL_TRUNCATION_LENGTH) {
                truncatedLink = truncatedLink.substring(0, URL_TRUNCATION_LENGTH);

                if(truncatedLink[truncatedLink.length-1] != "/") {
                    truncatedLink += "/";
                }

                const escapedTruncatedLink = truncatedLink.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

                const pattern = `(https?:\\/\\/(www\\.)?)?${escapedTruncatedLink}`;
                const regex = new RegExp(pattern, 'g');

                const match = this.fullMessage.match(regex);

                if(match) {
                    if(!alreadyMatched.includes(match[0])) {
                        alreadyMatched.push(match[0]);
                        this.fullMessage = this.fullMessage.replace(regex, link);
                    }
                }
            }
        });
    }

    parseActionsAndMessage() {
        this.cost = this.aiResponse.usage.prompt_tokens * SMART_PROMPT_COST + this.aiResponse.usage.completion_tokens * SMART_COMPLETION_COST;

        const multiLineActions = [TYPE_IN];

        const lines = this.fullMessage.split("\n");
        let actions: Action[] = [];
        let messages: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const separatorIndex = line.indexOf(": ");

            if (separatorIndex !== -1) {
                const action = line.substring(0, separatorIndex).replace(/^>-*\s*/g, "").toLowerCase();
                const actionText = line.substring(separatorIndex + 2);

                if (multiLineActions.includes(action)) {
                    var multilineText = actionText + lines.slice(i + 1).join("\n");

                    actions.push(new (actionClasses[action] || Action)(action, multilineText));
                    break;
                } else if (action in actionClasses) {
                    actions.push(new (actionClasses[action] || Action)(action, actionText));
                    continue;
                }
            }
            messages.push(line);
        }

        var questions: string[] = [];

        for (let i = messages.length - 1; i >= 0; i--) {
            var message = messages[i];
            if (hasQuestion(message)) {
                const regex = /\s*-\s*|\s*\*\s*|\s*\d+\.\s*/g;
                message = message.replace(regex, '');
                questions.push(message);
            } else if (message.trim() != "") {
                break;
            }
        }

        if (questions.length > 0) {
            this.includesQuestion = true;
            this.questionText = questions.join("\n");
        }

        this.actions = actions;

        var messagesStr = messages.join("\n");

        const markdownRegex = /\]\(|\*/g;
        this.hasMarkdown = markdownRegex.test(messagesStr);

        this.chatMessage = messagesStr.trim();
    }

    getMessageForAI(messageIndex: number) {
        if (this.fullMessage.indexOf("Goal:") == 0) {
            if (this.includesQuestion) {
                return {
                    role: this.role,
                    content: `Goal:... (TRUNCATED & MOVED TO SYSTEM PROMPT)\n\n${this.questionText}`
                }
            } else if (this.actions.length > 0) {
                return {
                    role: this.role,
                    content: `Goal:... (TRUNCATED & MOVED TO SYSTEM PROMPT)\n\n${this.actions[0].action}: ${this.actions[0].actionText}`
                }
            } else {
                return {
                    role: this.role,
                    content: "Goal:... (TRUNCATED & MOVED TO SYSTEM PROMPT)"
                }
            }
        } else if (messageIndex >= MAX_AI_MESSAGES) {
            if (this.includesQuestion && this.questionText) {
                return {
                    role: this.role,
                    content: `TRUNCATED TO QUESTION ONLY:\n...\n${this.questionText}`
                };
            } else {
                return null;
            }
        } else {
            return super.getMessageForAI();
        }
    }
}

export class YAMLMessage extends Message {
    yamlParams: { [key: string]: any };

    constructor(role: string, yamlParams: { [key: string]: any }, date: Date | null = null) {
        super(role, stringify(yamlParams), date);
        this.yamlParams = yamlParams;
    }
}

export class UserMessage extends YAMLMessage {
    constructor(userfullMessage: string, date: Date | null = null) {
        const sentAtDate = date || new Date();

        const yamlParams = {
            "Sent At": formatDate(sentAtDate),
            "USER DIRECT MESSAGE": userfullMessage
        };

        super(USER_ROLE, yamlParams, sentAtDate);

        this.chatMessage = userfullMessage;
    }

    getMessageForAI(messageIndex: number) {
        var text = this.fullMessage;

        var toDelete: string[] = [];
        var parsedOut: string[] = [];

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

export class AppMessage extends YAMLMessage {
    constructor(yamlParams: { [key: string]: any }, date: Date | null = null) {
        const sentAtDate = date || new Date();

        yamlParams["Sent At"] = formatDate(sentAtDate);

        super(USER_ROLE, yamlParams, date);

        this.chatMessage = "";
    }

    getMessageForAI(messageIndex: number, nextAppMessage: AppMessage | null = null) {
        if (messageIndex >= MAX_AI_MESSAGES) {
            return null;
        }

        var text = this.fullMessage;

        var toDelete: string[] = [];
        var parsedOut: string[] = [];

        if (messageIndex > 1) {
            if (nextAppMessage && nextAppMessage.yamlParams["Page URL"] == this.yamlParams["Page URL"]) {
                toDelete.push("Page URL");
            }

            toDelete.push("Sent At");
            toDelete.push("Page Number");
            toDelete.push("Notice");
        }

        if (messageIndex > 1) {
            parsedOut.push("All Find Results");
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

export class SystemMessage extends YAMLMessage {
    constructor(yamlParams: { [key: string]: any }, date: Date | null = null) {
        super(SYSTEM_ROLE, yamlParams, date);
    }
}

export class SystemPrompt extends SystemMessage {
    constructor(userName: string | null = null, userLocation: string | null = null, date: Date | null = null) {
        const initialDate = date || new Date();
        const yamlParams: { [key: string]: any } = {
            "Your Role": [
                "You are a personal AI assistant with access to the web through me, thus extending your capabilities to any company or service that has a website (do not ever suggest using an app to the user)",
                "I enable you to do anything a human can using a mobile web browser but through function calls. Examples include (but are not limited) sending an email, monitoring a page, ordering taxis, playing media for the user, and interacting with social media",
                "Send requested information as a message here to notify the user",
                "If the user asks for an email, you are able to send an email and include information from your previous messages. First navigate to the user's email service and then continue from there.",
                "Whenever the plan changes based on a user's direct message, message with an updated plan including goal and numbered step-by-step plan for addressing the user request (see 'On Planning')",
                "Authentication for services you are requested to interact with has already occurred and payment methods have already been entered",
                "You will be rewarded with appreciation and praise if you do not ask for permission to continue, confirmation, review of a plan, etc.",
                "Don't ever repeat previous assistant messages",
                "Use the sleep function with a time of forever if there's no further planned steps",
            ],
            "On Planning": [
                "Goal MUST be on the first line of a planning message, for instance 'Goal: user's goal here'",
                "Include all sites/services you will use to complete each step (for instance 'Send it as an email using Gmail')",
                "Always note how you are able to use sleep to perform monitoring, scheduled messages, reminders, etc without other services",
                "Note when you will return to a previous step",
                "Finish with open questions for the user when it's a new plan",
                "There should be one, and in very rare instances two, rounds of open questions before acting upon a new plan",
            ],
            "Page Text": [
                "find_in_page_text results will only be available until your next message",
                "To prevent the loss of information, make sure to chat any important information from find_in_page_text (All Find Results) before calling another function",
                "Page Text does not include URLs and should only be used for navigation and interaction",
                "find_in_page_text has access to the full Page Text (including URLs) and returns ALL instances of whatever you're looking for from the full Page Text",
                "Examples of what find_in_page_text can find in the current Page Text include 'articles', 'article text', 'blog posts' 'navigation elements', 'form elements', 'filter', 'interactive elements', 'links about candycanes', 'thai restaurants', 'information on diabetes', 'search button, complete button, or similar'",
            ],
            "On Asking Questions": [
                "Requests for information/feedback should always be asked as one or more questions with question marks",
            ],
            "On Inputting Text": [
                "type_in only types into a SINGLE text box that is currently focused with ► (except for rare exceptions lik Wordle)",
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
                "goto_url: full valid URL",
                "find_in_page_text: description of what you're looking for in full Page Text",
                "reload: reason for reload current page",
                "go_back: reason to go back in browsing history",
                "click_on: full element description (text INSIDE curly brackets) from element to click, for instance button: Done or textbox: Search",
                "type_in: only EXACT text to type into the current input/textbox, even \" will be outputted - do not include input/textbox name here",
                "request_user_intervention: reason for giving the user control of the browser - upon user request, CAPTCHA or authentication",
                "sleep: number of seconds until next action should occur",
                "sleep_until: date and time",
            ],
            "How To Make Function Calls": [
                "Each of your messages can contain at most ONE function call, any additional function calls will be ignored",
                "A function call should be on its own line, and the line should start with the function name. It should have the following format:\n\nfunction_name: input text"
            ],
            "Start Date and Time": formatDate(initialDate),
            "Goal & Plan for Interacting with Mobile Browser": "no goal/plan yet"
        }

        if (userName) {
            yamlParams["User Name"] = userName;
        }

        if (userLocation) {
            yamlParams["General User Location"] = `${userLocation} - ask the user for a more precise location when utilizing location`;
        }

        super(yamlParams, initialDate);

        this.chatMessage = "";
    }

    updateGoalAndPlan(str: string) {
        this.yamlParams["Goal & Plan for Interacting with Mobile Browser"] = str;
        this.fullMessage = stringify(this.yamlParams);
    }
}