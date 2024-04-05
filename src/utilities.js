const os = require('os');
const tiktoken = require("tiktoken");
const OpenAI = require("openai");
const { MODEL, MAX_WRITE_TOKENS, OPENAI_KEY, OPENROUTER_API_KEY, SMART_MODEL, SMART_MAX_WRITE_TOKENS, DUMB_MODEL, DUMB_MAX_WRITE_TOKENS } = require('./globals.js');

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

function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}

async function randomDelay(min, max) {
    await delay(Math.floor(Math.random() * (max - min + 1) + min));
}

function formatDate(date) {
    // Extracting components from the date
    let day = date.getDate();
    let month = date.getMonth() + 1; // Months are 0-indexed
    let year = date.getFullYear().toString().substr(-2); // Get last 2 digits of year
    let hour = date.getHours();
    let minute = date.getMinutes();
    let ampm = hour >= 12 ? 'pm' : 'am';

    // Converting 24h time to 12h time format
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'

    // Ensuring two-digit minute format
    minute = minute < 10 ? '0' + minute : minute;

    // Formatting the string
    return `${month}/${day}/${year} ${hour}:${minute}${ampm}`;
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

    if(model.includes("/")) {
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

module.exports = { isMac, isWindows, isLinux, delay, randomDelay, formatDate, getRandomInt, isValidUrl, ttokTruncate, ttokLength, hasQuestion, getResult };
