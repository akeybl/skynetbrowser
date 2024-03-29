const OpenAI = require("openai");
const { OPENAI_MODEL, MAX_WRITE_TOKENS, OPENAI_KEY } = require('./globals.js');
const { AIMessage, AppMessage } = require('./chain-messages.js');

const client = new OpenAI({
    apiKey: OPENAI_KEY,
});

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

    async getClaudeResult(browserPage) {
        // claude-3-sonnet-20240229 $3.00 / $15.00
    }

    async getOpenAIResult(browserPage) {
        try {
            // console.log(this.getMinifiedChain());

            const response = await client.chat.completions.create({
                model: OPENAI_MODEL,
                max_tokens: MAX_WRITE_TOKENS,
                messages: this.getMinifiedChain(),
            },
            { signal: this.controller.signal });
            
            return new AIMessage(response, browserPage);
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
