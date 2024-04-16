import { AIMessage, AppMessage, UserMessage, SystemPrompt, SystemMessage } from './chain-messages';
import { delay, getResult } from './utilities';

export class AIRequest {
    messageChain: (AIMessage | AppMessage | UserMessage | SystemPrompt | SystemMessage)[];
    controller: AbortController;
    response: any;

    constructor(abortController: AbortController, messageChain: (AIMessage | AppMessage | UserMessage | SystemPrompt | SystemMessage)[]) {
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
                var nextAppMessage: AppMessage | null = null;

                for (let j = i + 1; j >= 0; j--) {
                    const thisMessage = this.messageChain[j];
                    if (thisMessage instanceof AppMessage) {
                        nextAppMessage = thisMessage;
                        break;
                    }
                }

                messageForAI = currMessage.getMessageForAI(appMessageIndex, nextAppMessage);
                appMessageIndex += 1;
            } else if (currMessage instanceof AIMessage) {
                messageForAI = currMessage.getMessageForAI(aiMessageIndex);
                aiMessageIndex += 1;
            } else if (currMessage instanceof UserMessage) {
                messageForAI = currMessage.getMessageForAI(userMessageIndex);
                userMessageIndex += 1;
            } else if (currMessage instanceof SystemPrompt) {
                messageForAI = currMessage.getMessageForAI();
            } else {
                messageForAI = currMessage.getMessageForAI();
            }

            if (messageForAI) {
                if (numSkippedMessages > 0) {
                    const sm = new SystemMessage({ "Notice": `Truncated ${numSkippedMessages} messages` });
                    const gmfa = sm.getMessageForAI();

                    if (gmfa) {
                        minifiedChain.push(gmfa);
                        numSkippedMessages = 0;
                    }
                }

                minifiedChain.push(messageForAI);
            } else {
                numSkippedMessages += 1;
            }
        }

        minifiedChain.reverse();
        return minifiedChain;
    }

    async getResult(pageLinks: Array<string>) {
        const mc = this.getMinifiedChain();
        console.log(mc);

        const result = await getResult(this.controller.signal, mc, true);

        if (result) {
            return new AIMessage(result, pageLinks);
        } else {
            return null;
        }
    }
}
