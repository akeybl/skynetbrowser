import os from 'os';
import tiktoken from 'tiktoken';
import OpenAI from 'openai';
import { SMART_MODEL, SMART_MAX_WRITE_TOKENS, DUMB_MODEL, DUMB_MAX_WRITE_TOKENS } from './globals';
import parser from 'any-date-parser';
import moment from 'moment-timezone';
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const isMac = os.platform() === "darwin";
export const isWindows = os.platform() === "win32";
export const isLinux = os.platform() === "linux";

const openAIClient = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

const openRouterClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

export async function ttokLength(inputString: string): Promise<number> {
    const encoding = tiktoken.encoding_for_model("gpt-4");
    const tokens = encoding.encode(inputString);
    return tokens.length;
}

export async function ttokTruncate(inputString: string, tokenStart = 0, tokenEnd = 3000): Promise<string | null> {
    const encoding = tiktoken.encoding_for_model("gpt-4");
    const tokens = encoding.encode(inputString);

    if (tokens.length < tokenStart || tokenStart > tokenEnd) {
        return null;
    }

    tokenEnd = tokenEnd > tokens.length ? tokens.length : tokenEnd;

    const truncatedTokens = tokens.slice(tokenStart, tokenEnd);
    const decodedString = new TextDecoder().decode(encoding.decode(truncatedTokens));

    return decodedString;
}

export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch (_) {
        return false;
    }
}

export function delay(time: number, abortController: AbortController | null = null): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, time);

        if (abortController) {
            abortController.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
            });
        }
    });
}

export async function randomDelay(min: number, max: number): Promise<void> {
    await delay(Math.floor(Math.random() * (max - min + 1) + min));
}

export function formatDate(date: Date): string {
    var options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    };

    let timeZoneName = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).format(date).split(', ')[1];

    return `${date.toLocaleString('en-US', options)} ${timeZoneName}`;
}

export function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function hasQuestion(string: string): boolean {
    let lines = string.split('\n');

    if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        if (lastLine.includes('?')) {
            return true;
        }
    }

    return false;
}

export async function getResult(signal: AbortSignal, chain: { role: string; content: string }[], smart: boolean): Promise<OpenAI.ChatCompletion | null> {
    var model = SMART_MODEL;
    var maxWriteTokens = SMART_MAX_WRITE_TOKENS;

    if (!smart) {
        model = DUMB_MODEL;
        maxWriteTokens = DUMB_MAX_WRITE_TOKENS;
    }

    if (model.includes("/")) {
        try {
            while (true) {
                const response = await openRouterClient.chat.completions.create({
                    model: model,
                    max_tokens: maxWriteTokens,
                    messages: chain as Array<ChatCompletionMessageParam>,
                },
                    { signal: signal });

                if (response && response.choices && response.choices.length > 0) {
                    return response;
                } else {
                    await delay(1000);
                }
            }
        } catch (error) {
            console.error('Failed to get response:', error);
            return null;
        }
    } else {
        try {
            const response = await openAIClient.chat.completions.create({
                model: model,
                max_tokens: SMART_MAX_WRITE_TOKENS,
                messages: chain as Array<ChatCompletionMessageParam>,
            },
                { signal: signal });

            return response;
        } catch (error) {
            console.error('Failed to get response:', error);

            return null;
        }
    }
}

export function extractNumberFromString(inputString: string): number | null {
    const firstNumberRegex = /\b(\d+)\b/;
    const match = inputString.match(firstNumberRegex);

    if (match) {
        return parseInt(match[1], 10);
    }

    return null;
}

export function millisecondsUntil(date: Date): number {
    const now = moment();
    return Math.abs(now.diff(date));
}

export function convertStringToDate(dateTimeString: string): Date {
    //@ts-ignore
    return parser.fromString(dateTimeString);
}
