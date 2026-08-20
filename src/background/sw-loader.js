/* Chromium MV3 service worker entry — loads classic scripts in order. */
importScripts(
  "../shared/constants.js",
  "../shared/browser-api.js",
  "../shared/media.js",
  "../shared/yaria-bridge.js",
  "background.js"
);
