/* Content script — classic JS (no ES modules) for Chromium + Firefox. */
(function () {
  if (window.__yariaDetectInjected) return;
  window.__yariaDetectInjected = true;

  const api = globalThis.browser ?? globalThis.chrome;

  function absUrl(url) {
    if (!url || typeof url !== "string") return "";
    try {
      const u = new URL(url, location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.href;
    } catch {
      return "";
    }
  }

  function pushUnique(list, url, extra) {
    const clean = absUrl(url);
    if (!clean) return;
    if (list.some((i) => i.url === clean)) return;
    list.push({
      url: clean,
      pageUrl: location.href,
      title: document.title || "",
      source: "dom",
      ...extra,
    });
  }

  function collectFromMediaEl(el, list) {
    if (!el) return;
    pushUnique(list, el.currentSrc || el.src, {
      kind: el.tagName === "AUDIO" ? "audio" : "video",
      mime: "",
    });
    el.querySelectorAll?.("source")?.forEach((s) => {
      pushUnique(list, s.src, {
        mime: s.type || "",
        kind: el.tagName === "AUDIO" ? "audio" : "video",
      });
    });
  }

  function collect() {
    const items = [];
    const host = location.hostname.replace(/^www\./, "");
    const ytdlpOnly = /(youtube|youtu\.be|youtube-nocookie|vimeo|tiktok|instagram|twitter|x\.com)/i.test(host);

    // On major extractor sites, page URL is enough — skip noisy CDN scrape
    if (ytdlpOnly) {
      return items;
    }

    document.querySelectorAll("video, audio").forEach((el) => collectFromMediaEl(el, items));

    // Video id on this page (eporner /video-ID/…) — filter related-video noise
    const pageIdMatch = location.pathname.match(/\/video-([a-zA-Z0-9]+)/i);
    const pageId = pageIdMatch ? pageIdMatch[1] : "";

    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.href || "";
      const text = (a.textContent || "").replace(/\s+/g, " ").trim();
      const looksMedia =
        /\.(mp4|webm|mkv|m3u8|mpd|mp3|m4a|flac|ogg|wav)(\?|#|$)/i.test(href) ||
        /\/dload\//i.test(href) ||
        /\/download\//i.test(href) ||
        (/\b(2160|1440|1080|720|480|360|240)p\b/i.test(text) && /\/dload\//i.test(href));
      if (!looksMedia) return;
      if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(href)) return;
      if (pageId && /\/dload\//i.test(href) && !href.includes(pageId)) return;
      pushUnique(items, href, {
        source: "dom",
        title: text || document.title,
        kind: /\.m3u8/i.test(href) ? "hls" : /\.mpd/i.test(href) ? "dash" : "video",
      });
    });

    // Player config / inline URLs (cap count) — only dload for this video id when known
    const html = document.documentElement?.innerHTML?.slice(0, 400_000) || "";
    const patterns = [
      /https?:\/\/[^"'\s]+\/dload\/[^"'\s]+/gi,
      /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi,
      /https?:\/\/[^"'\s]+\.mpd[^"'\s]*/gi,
    ];
    for (const re of patterns) {
      const found = html.match(re) || [];
      for (const u of found.slice(0, 40)) {
        const clean = u.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
        if (/\/preview|\/thumb|sprite/i.test(clean)) continue;
        if (pageId && /\/dload\//i.test(clean) && !clean.includes(pageId)) continue;
        pushUnique(items, clean, { source: "dom", title: document.title });
      }
    }

    document
      .querySelectorAll('meta[property="og:video"], meta[property="og:video:secure_url"]')
      .forEach((m) => {
        pushUnique(items, m.getAttribute("content"), { source: "dom", title: document.title });
      });

    return items;
  }

  function report() {
    const items = collect();
    if (!items.length) return;
    try {
      api.runtime.sendMessage({ type: "MEDIA_FOUND", items });
    } catch {
      // extension reloaded
    }
  }

  report();

  const mo = new MutationObserver(() => {
    clearTimeout(window.__yariaDetectTimer);
    window.__yariaDetectTimer = setTimeout(report, 600);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "href"] });

  document.addEventListener(
    "play",
    (e) => {
      if (e.target && (e.target.tagName === "VIDEO" || e.target.tagName === "AUDIO")) {
        report();
      }
    },
    true
  );

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "CONTENT_SCAN") {
      const items = collect();
      try {
        api.runtime.sendMessage({ type: "MEDIA_FOUND", items });
      } catch {
        /* ignore */
      }
      sendResponse({ ok: true, items });
      return true;
    }
    return false;
  });
})();
