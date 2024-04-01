const OpenAI = require("openai");
const { MODEL, MAX_WRITE_TOKENS, OPENAI_KEY, OPENROUTER_API_KEY } = require('./globals.js');
const { AIMessage, AppMessage } = require('./chain-messages.js');
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
        // Initialize the array to store the minified messages
        const minifiedChain = [];

        // Find the index of the last AppMessage in the messageChain
        let lastAppMessageIndex = -1;
        for (let i = this.messageChain.length - 1; i >= 0; i--) {
            if (this.messageChain[i] instanceof AppMessage) {
                lastAppMessageIndex = i;
                break;
            }
        }

        // Iterate over the messageChain
        this.messageChain.forEach((message, index) => {
            // Use getMessageForAI(false) for the last AppMessage, getMessageForAI(true) for the others
            if (index === lastAppMessageIndex) {
                minifiedChain.push(message.getMessageForAI(false));
            } else {
                minifiedChain.push(message.getMessageForAI(true));
            }
        });

        // Return the array of minified messages
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
