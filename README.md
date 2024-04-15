**Sky Netbrowser** is a cross-platform desktop app that gives high-functioning LLMs (GPT-4, Claude Opus) access to a mobile browser and any services you authenticate within it. It can accomplish helpful tasks on your behalf, even when you're not around (see Example Use Cases below). It may also be able to take over the world if given enough access.

I have decided to open source Sky Netbrowser as I believe it is important for the community to trust anything we allow to perform tasks on our behalf. Please consider joining our [**Discord**](link_needed) to provide feedback or contribute.

## Example Use Cases
* Order me an Uber to the White House when the price goes below $10
* Every day at this time, find all the AI-related links on hacker news. Then use gmail to send them to user@mailservice.com
* At 9am before each upcoming Nationals baseball game, send me a reminder here
* Every morning check the weather and shortly tell me what I should wear as a man to stay comfortable all day long

## How to Run
1) `cp .env.tempate .env`
2) Edit .env to specify an OpenAI key and/or OpenRouter key
3) `npm install`
4) `npm start`

## Feature List
* AI-driven page navigation, element interaction, and page text/link parsing
* Built as a cross-platform Electron app -- Electron is used for both frontend and AI-controlled browser window
* Observability of AI actions, both in the message thread and by watching the browser
* Tracks cost of the last AI message, and the total for the current message thread
* Requests user intervention when it needs authentication/CAPTCHA, but the user can also ask for control
* AI message notifications when the window is minimized/closed
* Interruption of AI actions are allowed, but interrupted requests are not added to total cost
* The AI can perform tasks in the future by performing "sleeps"

## Privacy & Security
* In its current form, the background browser window is available on `localhost:3000` and does not yet limit connections to localhost
* Anything found on the page (including text found on authenticated pages) is sent to AI for analysis and action
* Whatever you do/enter when performing a browser intervention is **NOT** sent to AI

## Future Work
* **Cost safeguards**
* **iPhone & Android mobile app support**, with a streaming web view for user observation and intervention
* **Cloud-hosted browser** solution (always-on without a desktop at home)
* **CC billing for AI usage** without the need for an OpenAI / OpenRouter key
* **Local LLMs for increased privacy** -- currently blocked only on open source LLM ability

## How to Change Models
If you'd like to use an OpenAI model, just change `SMART_MODEL` in src/globals.js to the model name

If you'd like to use an OpenRouter model, just change `SMART_MODEL` to the full model name including `/`

## How to Build for Mac
1) Edit .env according to [these instructions](https://www.rocketride.io/blog/macos-code-sign-notarize-electron-app)
2) `npm run make`

## System Prompts
* [Main system prompt](src/chain-messages.ts#L293) - planning, navigation, interaction, function calls
* [Find in page system prompt](src/actions.ts#L278) - sub-agent when trying to find lines in the page relevant to next steps of the main system prompt
