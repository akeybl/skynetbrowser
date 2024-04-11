const { AIMessage, AppMessage, UserMessage, SystemPrompt, SystemMessage } = require('./chain-messages.js');
const { delay, getResult } = require('./utilities.js');
require('dotenv').config();

class AIRequest {
    constructor(abortController, messageChain) {
        this.messageChain = messageChain;
        this.controller = abortController;
        this.response = null;
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
                var nextAppMessage = null;

                for (let j = i+1; j >= 0; j--) {
                    if (this.messageChain[j] instanceof AppMessage) {
                        nextAppMessage = this.messageChain[j];
                        break;
                    }
                }

                messageForAI = currMessage.getMessageForAI(appMessageIndex, nextAppMessage);
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

            if( messageForAI == "") {
                // neither skipped (null) or a message

                continue;
            }
            else if ( messageForAI ) {
                if (numSkippedMessages > 0 ) {
                    const sm = new SystemMessage({"Notice": `Truncated ${numSkippedMessages} messages`});
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
        const mc = this.getMinifiedChain();
        console.log(mc);

        const result = await getResult(this.controller.signal, mc, true)
        
        if(result) {
            return new AIMessage(result);
        }
        else {
            return null;
        }
    }
}

module.exports = { AIRequest };
