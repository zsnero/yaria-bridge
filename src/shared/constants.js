(function (g) {
  const Yaria = (g.Yaria = g.Yaria || {});

  Yaria.DEFAULT_BRIDGE = {
    host: "127.0.0.1",
    port: 19547,
    token: "",
  };

  Yaria.STORAGE_KEYS = {
    bridgeHost: "bridgeHost",
    bridgePort: "bridgePort",
    bridgeToken: "bridgeToken",
  };

  Yaria.MEDIA_EXTENSIONS = [
    "mp4", "m4v", "webm", "mkv", "mov", "avi", "flv", "ts", "m4s",
    "m4a", "mp3", "aac", "opus", "ogg", "wav", "flac", "m3u8", "mpd",
  ];

  Yaria.MEDIA_MIME_PREFIXES = [
    "video/",
    "audio/",
    "application/vnd.apple.mpegurl",
    "application/x-mpegurl",
    "application/dash+xml",
    "application/vnd.ms-sstr+xml",
  ];

  Yaria.SKIP_URL_PATTERNS = [
    /\/favicon\./i,
    /\.(png|jpe?g|gif|webp|svg|ico|css|woff2?)(\?|$)/i,
    /\/pixel\./i,
    /doubleclick\.net/i,
    /googlesyndication\.com/i,
    /\/ads?[\/.]/i,
    /analytics/i,
    /\/tracking/i,
    // Browser / site chrome noise
    /\/search\/audio\//i,
    /\/no_input\.mp3/i,
    /\/failure\.mp3/i,
    /\/generate_204/i,
    /\/ptracking/i,
    /\/api\/stats/i,
    /\/log_event/i,
    /\/videoplayback\?.*&range=/i,
  ];

  Yaria.MAX_ITEMS_PER_TAB = 120;

  /** Hosts where page URL + yt-dlp is enough (ignore raw CDN noise). */
  Yaria.YTDLP_HOST_RE =
    /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitter\.com|x\.com|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|twitch\.tv|reddit\.com|soundcloud\.com|bilibili\.com|nicovideo\.jp|bandcamp\.com)$/i;
})(globalThis);
