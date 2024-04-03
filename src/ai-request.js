const OpenAI = require("openai");
const { MODEL, MAX_WRITE_TOKENS, OPENAI_KEY, OPENROUTER_API_KEY } = require('./globals.js');
const { AIMessage, AppMessage, UserMessage, SystemPrompt, SystemMessage } = require('./chain-messages.js');
const { delay } = require('./utilities.js');

const openAIClient = new OpenAI({
    apiKey: OPENAI_KEY,
});

const openRouterClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY,
    // defaultHeaders: {
    //     "HTTP-Referer": $YOUR_SITE_URL, // Optional, for including your app on openrouter.ai rankings.
    //     "X-Title": $YOUR_SITE_NAME, // Optional. Shows in rankings on openrouter.ai.
    // },
    // dangerouslyAllowBrowser: true,
})

class AIRequest {
    constructor(abortController, messageChain) {
        this.messageChain = messageChain;
        this.controller = abortController;
    }

    getMinifiedChain() {
        const minifiedChain = [];

        var appMessageIndex = 0;
        var userMessageIndex = 0;
        var aiMessageIndex = 0;

        var numSkippedMessages = 0;

        for (let i = this.messageChain.length - 1; i >= 0; i--) {
            const currMessage = this.messageChain[i];

            var messageForAI = null;

            if (currMessage instanceof AppMessage) {
                // Need to figure out how to do navigation changes
                messageForAI = currMessage.getMessageForAI(appMessageIndex);
                appMessageIndex += 1;
            }
            else if (currMessage instanceof AIMessage) {
                messageForAI = currMessage.getMessageForAI(aiMessageIndex);
                aiMessageIndex += 1;
            }
            else if (currMessage instanceof UserMessage) {
                messageForAI = currMessage.getMessageForAI(userMessageIndex);
                userMessageIndex += 1;
            }
            else if (currMessage instanceof SystemPrompt ) {
                messageForAI = currMessage.getMessageForAI();
            }
            else {
                messageForAI = currMessage.getMessageForAI();
            }

            if ( messageForAI ) {
                if (numSkippedMessages > 0 ) {
                    const sm = new SystemMessage({"Notice": `Skipped ${numSkippedMessages} due to message chain length requirements`});
                    minifiedChain.push( sm.getMessageForAI() );
                    numSkippedMessages = 0;
                }

                minifiedChain.push( messageForAI );
            }
            else {
                numSkippedMessages += 1;
            }
        }

        minifiedChain.reverse();
        return minifiedChain;
    }

    async getResult() {
        console.log(this.getMinifiedChain());

        if(MODEL.includes("/")) {
            return await this.getOpenRouterResult();
        }
        else {
            return await this.getOpenAIResult();
        }
    }

    async getOpenAIResult() {
        try {
            const response = await openAIClient.chat.completions.create({
                model: MODEL,
                max_tokens: MAX_WRITE_TOKENS,
                messages: this.getMinifiedChain(),
            },
                { signal: this.controller.signal });

            return new AIMessage(response);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request was cancelled');
            } else {
                // Handle other errors
                console.error('Failed to get response:', error);
            }
            return null;
        }
    }

    async getOpenRouterResult() {
        try {
            var response = null;

            while (true) {
                response = await openRouterClient.chat.completions.create({
                    model: MODEL,
                    max_tokens: MAX_WRITE_TOKENS,
                    messages: this.getMinifiedChain(),
                },
                    { signal: this.controller.signal });

                if (response && response.choices && response.choices.length > 0) {
                    break;
                }
                else {
                    await delay(1000);
                }
            }

            return new AIMessage(response);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request was cancelled');
            } else {
                // Handle other errors
                console.error('Failed to get response:', error);
            }
            return null;
        }
    }
}

module.exports = { AIRequest };
