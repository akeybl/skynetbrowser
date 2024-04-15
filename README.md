# Current Features
* Page navigation, element interaction, and page text/link parsing
* Observability of AI actions, both in the message thread and by watching the browser
* Tracks cost of the last AI message, and the total for the current message thread
* Requests user intervention when it needs authentication/CAPTCHA, but the user can also ask for control
* Notifications when the window is minimized/closed
* Interruption of AI actions are allowed, but interrupted requests are not added to total cost

# Privacy & Security
* In its current form, the background browser window is available on `localhost:3000` and does not yet limit connections to localhost
* Anything found on the page (including text found on authenticated pages) is sent to AI for analysis and action
* Whatever you do/enter when performing a browser intervention is **NOT** sent to AI

# How to Run
1) `cp .env.tempate .env`
2) Edit .env to specify an OpenAI key and/or Open Router key
3) `npm install`
4) `npm start`

# How to Change Models
If you'd like to use an OpenAI model, just change `SMART_MODEL` in src/globals.js to the model name

If you'd like to use an Open Router model, just change `SMART_MODEL` to the full model name including `/`

# How to Build for Mac
1) Edit .env according to [these instructions](https://www.rocketride.io/blog/macos-code-sign-notarize-electron-app)
2) `npm run make`
