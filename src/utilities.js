const os = require('os');
const tiktoken = require("tiktoken");
const OpenAI = require("openai");
const { MODEL, MAX_WRITE_TOKENS, OPENAI_KEY, OPENROUTER_API_KEY, SMART_MODEL, SMART_MAX_WRITE_TOKENS, DUMB_MODEL, DUMB_MAX_WRITE_TOKENS } = require('./globals.js');
const parser = require('any-date-parser');
const moment = require('moment-timezone');

const isMac = os.platform() === "darwin";
const isWindows = os.platform() === "win32";
const isLinux = os.platform() === "linux";

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
});

async function ttokLength(inputString) {
    const encoding = tiktoken.encoding_for_model("gpt-4");

    // Tokenize the input string
    const tokens = encoding.encode(inputString);

    return tokens.length;
}

async function ttokTruncate(inputString, tokenStart = 0, tokenEnd = 3000) {
    // Assuming tiktoken is imported and initialized elsewhere in your code
    const encoding = tiktoken.encoding_for_model("gpt-4");

    // Tokenize the input string
    const tokens = encoding.encode(inputString);

    // Early return conditions
    if (tokens.length < tokenStart || tokenStart > tokenEnd) {
        return null;
    }

    // Adjust tokenEnd if it exceeds the number of tokens
    tokenEnd = tokenEnd > tokens.length ? tokens.length : tokenEnd;

    // Truncate the token array
    const truncatedTokens = tokens.slice(tokenStart, tokenEnd);

    // Decode the tokens back to a string
    const decodedString = new TextDecoder().decode(
        encoding.decode(truncatedTokens),
    );

    // console.log(decodedString);

    return decodedString;
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (_) {
        return false;
    }
}

function delay(time, abortController=null) {
    return new Promise(function (resolve, reject) {
        const timer = setTimeout(resolve, time);

        // Check if the abortController is provided and listen for the abort signal
        if (abortController) {
            abortController.signal.addEventListener('abort', () => {
                clearTimeout(timer); // Cancel the timeout
                reject(new DOMException('Aborted', 'AbortError')); // Reject the promise
            });
        }
    });
}

async function randomDelay(min, max) {
    await delay(Math.floor(Math.random() * (max - min + 1) + min));
}

function formatDate(date) {
    var options = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    };

    let timeZoneName = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).format(date).split(', ')[1];

    return `${date.toLocaleString('en-US', options)} ${timeZoneName}`;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hasQuestion(string) {
    let lines = string.split('\n');

    // Check if the last line exists and meets any of the specified conditions
    if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        if (lastLine.includes('?'))
        // || lastLine.toLowerCase().includes('please let') ||
        // lastLine.toLowerCase().includes('let me')) {
        {
            return true;
        }
    }

    return false;
}

async function getResult(signal, chain, smart) {
    var model = SMART_MODEL;
    var maxWriteTokens = SMART_MAX_WRITE_TOKENS;

    if (!smart) {
        model = DUMB_MODEL;
        maxWriteTokens = DUMB_MAX_WRITE_TOKENS;
    }

    if (model.includes("/")) {
        try {
            while (true) {
                this.response = await openRouterClient.chat.completions.create({
                    model: model,
                    max_tokens: maxWriteTokens,
                    messages: chain,
                },
                    { signal: signal });

                if (this.response && this.response.choices && this.response.choices.length > 0) {
                    break;
                }
                else {
                    await delay(1000);
                }
            }

            return response;
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
    else {
        try {
            this.response = await openAIClient.chat.completions.create({
                model: model,
                max_tokens: SMART_MAX_WRITE_TOKENS,
                messages: chain,
            },
                { signal: signal });

            return response;
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

function extractNumberFromString(inputString) {
    const firstNumberRegex = /\b(\d+)\b/;
    const match = inputString.match(firstNumberRegex);

    if (match) {
        return parseInt(match[1], 10);
    }

    return null; // or 0, depending on how you want to handle strings without numbers
}

function millisecondsUntil(date) {
    const now = moment();
    return Math.abs(now.diff(date));
}

function convertStringToDate(dateTimeString) {
    return parser.fromString(dateTimeString);
}

module.exports = { isMac, isWindows, isLinux, delay, randomDelay, formatDate, getRandomInt, isValidUrl, ttokTruncate, ttokLength, hasQuestion, getResult, extractNumberFromString, convertStringToDate, millisecondsUntil };
