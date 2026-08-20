# Yaria Bridge

Browser add-on (Firefox + Chromium) that sends videos and audio to the **Yaria** desktop app.

Detects media on the page and hands jobs to Yaria’s Downloads queue.

## Pair with Yaria desktop

1. Run **Yaria** → Settings → **Bridge**
2. Ensure integration is **Enabled** (`127.0.0.1:19547`)
3. **Copy** the pairing token
4. Open Yaria Bridge **Settings** → paste host/port/token → **Test connection**
5. Browse a site → toolbar icon → **Download**

## Browsers

| Browser | Supported |
|---------|-----------|
| Chrome / Chromium / Edge / Brave | Yes (Manifest V3) |
| Firefox | Yes (Manifest V3, `gecko.id` set) |

One codebase. No separate Firefox fork required.

## Can this be written in Go?

**No — not the extension itself.**  
Browsers only load **JavaScript / HTML / CSS** extensions.

| Component | Language |
|-----------|----------|
| Extension (this repo) | JS |
| Yaria desktop bridge / engine | Go (YariaApp / YariaPlus) |
| Optional native messaging host | Go (later, if you want) |

## Load unpacked (dev)

### Chromium
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder (`YariaExtension`)

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…**
3. Pick `manifest.json` in this folder  
   (uses `background.scripts` — Firefox disables `service_worker` on many builds)

### Chromium
Uses `background.service_worker` (`sw-loader.js`). Same `manifest.json`.

## Features (v0.1)

- Network media sniffing (`webRequest`)
- DOM / player / `.m3u8` / `.mpd` / `og:video` detection
- Toolbar popup with quality + audio-only
- Context menu: download page or link with Yaria
- Badge count of detected items per tab
- Settings: bridge host / port / token
- Page URL fallback when nothing is sniffed

## Bridge API (implemented in YariaApp)

Default base: `http://127.0.0.1:19547`

```http
GET  /extension/ping
POST /extension/download   Authorization: Bearer <token>
POST /extension/focus
```

Disable in Yaria → Settings → Downloader → Browser integration.

## Layout

```text
YariaExtension/
├── manifest.json
├── icons/
├── src/
│   ├── background/service-worker.js
│   ├── content/detect.js
│   ├── popup/
│   ├── options/
│   └── shared/
└── README.md
```

## Privacy

- No cloud servers
- Talks only to your configured localhost bridge
- Host permission is required to see media URLs on pages you visit
- Full policy (Chrome / Firefox store): **https://yaria.live/privacy-bridge**

## License

Same product family as Yaria (yaria.live).
