# ShopEasly Local Fulfillment

This folder contains the JavaScript app for Google Local Home SDK local fulfillment.

Upload `shopeasly-local-fulfillment.js` in the Google Actions Console under your Action > Develop > Actions > Smart Home > Local Fulfillment.

- Local endpoint used: `http://192.168.4.24:3001/voice/google-actions/webhook`
- Update the IP if your device IP changes.

Notes:
- The Local Home SDK runtime provides the `smarthome` global and `fetch`. The file includes guards so it can be edited locally without executing the SDK.
- For local edits/tests, we included a conditional `cross-fetch` polyfill. No build step is required.
