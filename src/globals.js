DEV_MODE = true;

OPENAI_KEY = "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";
OPENROUTER_API_KEY = "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";

PAGE_TOKEN_LENGTH = 1000;

// gpt-3.5-turbo-0125, gpt-4, gpt-4-0125-preview, gpt-4-1106-preview, gpt-4-1106-vision-preview
// MODEL = "gpt-4";
// MAX_WRITE_TOKENS = 500;
// PROMPT_COST = 30/1000000;
// COMPLETION_COST = 60/1000000;

MODEL = "gpt-4-0125-preview";
MAX_WRITE_TOKENS = 500;
PROMPT_COST = 10/1000000;
COMPLETION_COST = 30/1000000;

// MODEL = "anthropic/claude-3-sonnet";
// MAX_WRITE_TOKENS = 500;
// PROMPT_COST = 3/1000000;
// COMPLETION_COST = 15/1000000;

// MODEL = "anthropic/claude-3-opus";
// MAX_WRITE_TOKENS = 500;
// PROMPT_COST = 15/1000000;
// COMPLETION_COST = 75/1000000;

module.exports = { DEV_MODE, OPENAI_KEY, OPENROUTER_API_KEY, MODEL, MAX_WRITE_TOKENS, PROMPT_COST, COMPLETION_COST, PAGE_TOKEN_LENGTH };
