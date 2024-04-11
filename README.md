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
2) `npm make run`
