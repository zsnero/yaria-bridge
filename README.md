# Yaria Bridge

Browser add-on for Firefox and Chromium that sends videos and audio to the [Yaria](https://yaria.live) desktop app.

It detects media on the page and hands jobs to Yaria’s Downloads queue. Files are saved by Yaria on your computer, not by the browser.

## Pair with Yaria

1. Run Yaria → Settings → Bridge
2. Turn integration on (`127.0.0.1:19547`)
3. Copy the pairing token
4. Open Yaria Bridge settings → paste host, port, and token → Test connection
5. On a video page, open the toolbar popup → choose quality → Download

## Browsers

| Browser | Support |
|---------|---------|
| Chrome, Chromium, Edge, Brave | Manifest V3 (`service_worker`) |
| Firefox | Manifest V3 (`background.scripts` in `manifest.firefox.json`) |

## Load unpacked (development)

### Chromium

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → this repository folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Load Temporary Add-on
3. Choose `manifest.firefox.json` (or a build that uses it as `manifest.json`)

## Build store packages

```bash
# Firefox
cp manifest.firefox.json manifest.json
npx web-ext build --overwrite-dest
# restore Chromium manifest from git if needed
```

Output: `web-ext-artifacts/`

## Features

- Detects media via network and page content
- Popup with quality selection and audio-only option
- Context menu: download page or link with Yaria
- Badge when media is found
- Settings for bridge host, port, and token

## Local bridge API (Yaria desktop)

Base URL: `http://127.0.0.1:19547`

```http
GET  /extension/ping
POST /extension/download
POST /extension/focus
```

Authorization: `Bearer <token>` when a token is configured.

Turn the bridge off in Yaria → Settings → Bridge.

## Layout

```text
├── manifest.json           # Chromium
├── manifest.firefox.json   # Firefox
├── icons/
├── src/
│   ├── background/
│   ├── content/
│   ├── popup/
│   ├── options/
│   └── shared/
└── README.md
```

## Privacy

- No cloud servers
- Talks only to the localhost bridge you configure
- Needs host access to see media URLs on pages you visit
- Policy: https://yaria.live/privacy-bridge

## License

MIT. Part of the Yaria product family ([yaria.live](https://yaria.live)).
