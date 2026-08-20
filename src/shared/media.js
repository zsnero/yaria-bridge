(function (g) {
  const Yaria = (g.Yaria = g.Yaria || {});

  const QUALITY_ORDER = ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"];

  function normalizeUrl(raw) {
    if (!raw || typeof raw !== "string") return "";
    const url = raw.trim();
    if (
      !url ||
      url.startsWith("blob:") ||
      url.startsWith("data:") ||
      url.startsWith("chrome") ||
      url.startsWith("moz-extension")
    ) {
      return "";
    }
    try {
      const u = new URL(url, "https://example.invalid");
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.href;
    } catch {
      return "";
    }
  }

  function extensionOf(url) {
    try {
      const path = new URL(url).pathname.toLowerCase();
      const m = path.match(/\.([a-z0-9]{2,5})$/);
      return m ? m[1] : "";
    } catch {
      return "";
    }
  }

  function isSkippableUrl(url) {
    return Yaria.SKIP_URL_PATTERNS.some((re) => re.test(url));
  }

  function isMediaMime(mime) {
    if (!mime) return false;
    const m = mime.toLowerCase().split(";")[0].trim();
    return Yaria.MEDIA_MIME_PREFIXES.some((p) => (p.endsWith("/") ? m.startsWith(p) : m === p));
  }

  function isMediaUrl(url) {
    const ext = extensionOf(url);
    if (Yaria.MEDIA_EXTENSIONS.includes(ext)) return true;
    if (/[?&](?:mime|content-type)=video\//i.test(url)) return true;
    if (/[?&](?:mime|content-type)=audio\//i.test(url)) return true;
    if (/\/videoplayback/i.test(url)) return true;
    if (/\/dload\//i.test(url)) return true;
    return false;
  }

  function classifyKind(url, mime = "") {
    const m = (mime || "").toLowerCase();
    const ext = extensionOf(url);
    if (m.startsWith("audio/") || ["mp3", "m4a", "aac", "opus", "ogg", "wav", "flac"].includes(ext)) return "audio";
    if (ext === "m3u8" || m.includes("mpegurl")) return "hls";
    if (ext === "mpd" || m.includes("dash+xml")) return "dash";
    if (["ts", "m4s"].includes(ext)) return "segment";
    return "video";
  }

  function guessLabel(url, mime = "", qualityHint = "") {
    if (qualityHint) return qualityHint;
    const kind = classifyKind(url, mime);
    if (kind === "hls") return "HLS stream";
    if (kind === "dash") return "DASH stream";
    if (kind === "audio") return "Audio";
    if (kind === "segment") return "Segment";
    const ext = extensionOf(url);
    return ext ? ext.toUpperCase() : "Media";
  }

  /** Height from CDN path like /dload/{id}/720/... — most reliable. */
  function extractPathQuality(url) {
    if (!url) return "";
    const m =
      String(url).match(/\/dload\/[^/]+\/(\d{3,4})\//i) ||
      String(url).match(/\/download\/[^/]+\/(\d{3,4})\//i) ||
      String(url).match(/[/_-](\d{3,4})p[/_-]/i) ||
      String(url).match(/[?&](?:quality|res|height)=(\d{3,4})/i);
    if (!m) return "";
    const n = parseInt(m[1], 10);
    if ([2160, 1440, 1080, 720, 480, 360, 240, 144].includes(n)) return `${n}p`;
    return "";
  }

  function extractQuality(text) {
    if (!text) return "";
    // Prefer explicit 720p-style tokens in link labels
    const m =
      String(text).match(/\b(2160|1440|1080|720|480|360|240|144)p\b/i) ||
      String(text).match(/\b(4k|2k|uhd|fhd|hd|sd)\b/i);
    if (!m) return extractPathQuality(text);
    const v = m[1].toLowerCase();
    if (v === "4k" || v === "uhd") return "2160p";
    if (v === "2k") return "1440p";
    if (v === "fhd") return "1080p";
    if (v === "hd") return "720p";
    if (v === "sd") return "480p";
    if (/^\d+$/.test(v)) {
      const n = parseInt(v, 10);
      if ([2160, 1440, 1080, 720, 480, 360, 240, 144].includes(n)) return `${n}p`;
    }
    return /p$/i.test(m[1]) ? m[1].toLowerCase() : `${m[1]}p`;
  }

  /** Best-effort video id from watch URL (eporner /video-ID/, youtube ?v=, …). */
  function pageMediaId(pageUrl) {
    try {
      const u = new URL(pageUrl);
      const path = u.pathname || "";
      let m = path.match(/\/video-([a-zA-Z0-9]+)/i);
      if (m) return m[1];
      m = path.match(/\/embed\/([a-zA-Z0-9_-]+)/i);
      if (m) return m[1];
      m = path.match(/\/([a-zA-Z0-9]{6,})\/?$/);
      const v = u.searchParams.get("v");
      if (v) return v;
      return m ? m[1] : "";
    } catch {
      return "";
    }
  }

  function urlBelongsToPage(mediaUrl, pageUrl) {
    const id = pageMediaId(pageUrl);
    if (!id) return true; // can't filter
    return String(mediaUrl).toLowerCase().includes(String(id).toLowerCase());
  }

  function extractCodec(text) {
    const t = String(text || "").toLowerCase();
    if (/\bav1\b/.test(t)) return "av1";
    if (/\bh\.?265\b|\bhevc\b/.test(t)) return "hevc";
    if (/\bh\.?264\b|\bavc\b/.test(t)) return "h264";
    if (/\bvp9\b/.test(t)) return "vp9";
    if (/\bvp8\b/.test(t)) return "vp8";
    return "";
  }

  function pageTitleFromUrl(pageUrl) {
    try {
      return new URL(pageUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function isNoiseItem(item) {
    if (!item?.url) return true;
    if (item.kind === "segment") return true;
    if (item.kind === "audio" && item.bytes > 0 && item.bytes < 100 * 1024) return true;
    if (item.bytes > 0 && item.bytes < 8 * 1024 && item.kind !== "hls" && item.kind !== "page") return true;
    const u = item.url.toLowerCase();
    if (u.includes("failure.mp3") || u.includes("no_input") || u.includes("/search/audio")) return true;
    // YouTube player chrome / embeds as separate candidates
    if (/youtube\.com\/embed\//i.test(item.url) && item.source !== "page") return true;
    if (/youtube\.com\/s\/search\//i.test(item.url)) return true;
    return false;
  }

  function isYtdlpHost(urlOrHost) {
    const host = urlOrHost.includes("://") ? hostOf(urlOrHost) : String(urlOrHost || "");
    return Yaria.YTDLP_HOST_RE.test(host);
  }

  function makeItem({
    url,
    pageUrl = "",
    title = "",
    mime = "",
    source = "network",
    quality = "",
    bytes = 0,
    tabId = -1,
    headers = {},
  }) {
    const clean = normalizeUrl(url);
    if (!clean || isSkippableUrl(clean)) return null;
    if (!isMediaUrl(clean) && !isMediaMime(mime) && source !== "dom" && source !== "page") return null;

    const kind = source === "page" ? "page" : classifyKind(clean, mime);
    if (source === "network" && kind === "segment") return null;
    if (source === "network" && kind === "audio" && bytes > 0 && bytes < 100 * 1024) return null;

    const q = quality || extractQuality(clean) || extractQuality(title);
    const codec = extractCodec(title) || extractCodec(clean);
    const item = {
      id: `${source}:${hash(clean)}`,
      url: clean,
      pageUrl,
      title: title || pageTitleFromUrl(pageUrl) || "Media",
      kind,
      label: guessLabel(clean, mime, q),
      quality: q,
      codec,
      mime: mime || "",
      source,
      bytes: bytes || 0,
      tabId,
      headers: headers || {},
    };
    if (isNoiseItem(item) && source !== "page") return null;
    return item;
  }

  function rankItems(items) {
    const score = (i) => {
      let s = 0;
      if (i.kind === "page") s += 100;
      if (i.kind === "hls" || i.kind === "dash") s += 50;
      if (i.kind === "video") s += 40;
      if (i.kind === "audio") s += 20;
      if (i.quality) s += 10;
      if (i.bytes > 1_000_000) s += 15;
      if (i.source === "dom") s += 8;
      return s;
    };
    return [...items].sort((a, b) => score(b) - score(a));
  }

  function mergeItems(existing, incoming) {
    const map = new Map(existing.map((i) => [i.url, i]));
    for (const item of incoming) {
      if (!item?.url) continue;
      const prev = map.get(item.url);
      if (!prev) {
        map.set(item.url, item);
        continue;
      }
      map.set(item.url, {
        ...prev,
        ...item,
        title: item.title && item.title !== pageTitleFromUrl(item.pageUrl) ? item.title : prev.title,
        quality: item.quality || prev.quality,
        codec: item.codec || prev.codec,
        mime: item.mime || prev.mime,
        bytes: Math.max(item.bytes || 0, prev.bytes || 0),
        headers: { ...prev.headers, ...item.headers },
      });
    }
    return rankItems([...map.values()].filter((i) => i.source === "page" || !isNoiseItem(i)));
  }

  function formatBytes(n) {
    if (!n || n < 0) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
  }

  function qualityRank(q) {
    const i = QUALITY_ORDER.indexOf(String(q || "").toLowerCase());
    return i === -1 ? 999 : i;
  }

  function standardPageQualities(pageUrl, title) {
    return ["best", "2160p", "1440p", "1080p", "720p", "480p", "360p"].map((q) => ({
      id: `q:${q}`,
      label: q === "best" ? "Best" : q,
      value: q,
      url: pageUrl,
      pageUrl,
      title,
      kind: "page",
      source: "page",
      quality: q === "best" ? "" : q,
      bytes: 0,
      codec: "",
    }));
  }

  /**
   * Collapse sniffed media into a single user-facing offer (one video + qualities).
   * @returns {object[]} offers (usually length 1)
   */
  function buildOffers(rawItems, pageUrl, pageTitle) {
    const page = normalizeUrl(pageUrl);
    if (!page || !/^https?:/i.test(page)) return [];

    const title = (pageTitle || "").trim() || pageTitleFromUrl(page);
    const items = (rawItems || []).filter((i) => i && !isNoiseItem(i));
    const ytdlpSite = isYtdlpHost(page);

    // Direct progressive files with a known height (eporner-style dload/720/…)
    const directByKey = new Map();
    for (const it of items) {
      if (it.kind === "page" || it.kind === "segment") continue;
      if (it.kind === "audio") continue;
      if (it.url === page) continue;
      // Only keep media that belongs to this watch page (drops related-video 1080p noise)
      if (!urlBelongsToPage(it.url, page) && /\/dload\//i.test(it.url)) continue;
      if (
        /\/watch\?|\/video-|\/videos\//i.test(it.url) &&
        !isMediaUrl(it.url) &&
        it.kind !== "hls" &&
        it.kind !== "dash"
      ) {
        continue;
      }

      const isStream = it.kind === "hls" || it.kind === "dash";
      const isDload = /\/dload\//i.test(it.url) || /\/download\//i.test(it.url);
      const isFile =
        isDload || ["mp4", "m4v", "webm", "mkv", "mov"].includes(extensionOf(it.url));

      // Quality: path is authoritative for CDN links; link label next; never invent from page title
      let q = extractPathQuality(it.url);
      if (!q) q = extractQuality(it.title);
      if (!q && !isDload) q = it.quality || extractQuality(it.url);
      // Dload without a height segment is unusable as a quality option
      if (isDload && !q) continue;

      const codec = it.codec || extractCodec(it.title) || extractCodec(it.url);
      if (!isStream && !isFile && it.source === "network" && !q) continue;
      if (!isStream && !isFile && !q && (it.bytes || 0) < 500_000) continue;

      // Score: labeled download links > bare html URLs; has size > no size
      const evidence =
        (isDload ? 50 : 0) +
        (/\bh\.?264\b|\bav1\b|\d+p\b/i.test(it.title || "") ? 30 : 0) +
        (it.bytes > 0 ? 20 : 0) +
        (it.source === "dom" ? 5 : 0);

      const key = isStream ? `${it.kind}:${it.url}` : `${q || "src"}`;
      const prev = directByKey.get(key);
      const next = {
        id: `direct:${hash(it.url)}`,
        label: "",
        value: "",
        url: it.url,
        pageUrl: page,
        title: title,
        kind: isStream ? it.kind : "video",
        source: it.source || "dom",
        quality: q,
        codec,
        bytes: it.bytes || 0,
        headers: it.headers || {},
        _evidence: evidence,
      };
      if (!prev || evidence > (prev._evidence || 0) || (evidence === (prev._evidence || 0) && (it.bytes || 0) > (prev.bytes || 0))) {
        // Prefer h264 over av1 at same evidence
        if (prev && evidence === (prev._evidence || 0) && prev.codec === "h264" && codec !== "h264") {
          /* keep prev */
        } else {
          directByKey.set(key, next);
        }
      }
    }

    let directs = [...directByKey.values()];

    // One entry per resolution
    if (directs.length > 1) {
      const byQ = new Map();
      for (const d of directs) {
        if (d.kind === "hls" || d.kind === "dash") {
          byQ.set(d.id, d);
          continue;
        }
        const qk = d.quality || "src";
        const prev = byQ.get(qk);
        if (!prev) {
          byQ.set(qk, d);
          continue;
        }
        const pref = (x) =>
          (x._evidence || 0) * 1e9 +
          (x.codec === "h264" ? 2 : x.codec === "av1" ? 1 : 0) * 1e6 +
          (x.bytes || 0);
        if (pref(d) > pref(prev)) byQ.set(qk, d);
      }
      directs = [...byQ.values()];
    }

    // Drop weak “quality” entries with no path height and no size (fake 1080p from page chrome)
    directs = directs.filter((d) => {
      if (d.kind === "hls" || d.kind === "dash") return true;
      if (extractPathQuality(d.url)) return true;
      if (d.bytes >= 500_000) return true;
      if (d._evidence >= 30) return true;
      return false;
    });

    // Label qualities
    for (const d of directs) {
      if (d.kind === "hls") {
        d.label = "HLS stream";
        d.value = d.quality || "hls";
      } else if (d.kind === "dash") {
        d.label = "DASH stream";
        d.value = d.quality || "dash";
      } else {
        const parts = [];
        parts.push(d.quality || "Video");
        if (d.codec) parts.push(d.codec);
        if (d.bytes) parts.push(formatBytes(d.bytes));
        d.label = parts.join(" · ");
        d.value = d.quality || d.id;
      }
    }

    directs.sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality));

    // --- Major extractor sites: page URL + quality preference ---
    if (ytdlpSite) {
      return [
        {
          id: `offer:page:${hash(page)}`,
          title,
          pageUrl: page,
          mode: "page",
          qualities: standardPageQualities(page, title),
          defaultQuality: "best",
        },
      ];
    }

    // --- Sites with multiple file qualities ---
    const fileDirects = directs.filter((d) => d.kind === "video" && d.quality);
    const streams = directs.filter((d) => d.kind === "hls" || d.kind === "dash");

    if (fileDirects.length >= 2) {
      const qualities = [
        ...fileDirects.map((d) => ({
          ...d,
          label: d.quality || d.label || "Video",
        })),
        {
          id: "page:best",
          label: "Auto",
          value: "page-best",
          url: page,
          pageUrl: page,
          title,
          kind: "page",
          source: "page",
          quality: "",
          bytes: 0,
          codec: "",
        },
      ];
      const top = fileDirects[0];
      return [
        {
          id: `offer:files:${hash(page)}`,
          title,
          pageUrl: page,
          mode: "files",
          qualities,
          defaultQuality: top.value,
        },
      ];
    }

    // Single file/stream + page qualities
    if (fileDirects.length === 1 && streams.length === 0) {
      const d = fileDirects[0];
      const label = d.quality || "Video";
      return [
        {
          id: `offer:one:${hash(page)}`,
          title,
          pageUrl: page,
          mode: "mixed",
          qualities: [
            { ...d, label, value: d.value || d.quality || "file" },
            ...standardPageQualities(page, title),
          ],
          defaultQuality: d.value || d.quality || "file",
        },
      ];
    }

    if (streams.length > 0) {
      return [
        {
          id: `offer:stream:${hash(page)}`,
          title,
          pageUrl: page,
          mode: "stream",
          qualities: [
            ...streams.map((d) => ({
              ...d,
              label: d.quality || "Stream",
            })),
            ...standardPageQualities(page, title),
          ],
          defaultQuality: streams[0].value || "best",
        },
      ];
    }

    // URL looks like a watch/video page even if sniff found nothing yet
    if (looksLikeVideoPage(page)) {
      return [
        {
          id: `offer:page:${hash(page)}`,
          title,
          pageUrl: page,
          mode: "page",
          qualities: standardPageQualities(page, title),
          defaultQuality: "best",
        },
      ];
    }

    // Normal websites with no media → empty (no fake Download card)
    return [];
  }

  function looksLikeVideoPage(url) {
    try {
      const u = new URL(url);
      const p = (u.pathname + u.search).toLowerCase();
      return (
        p.includes("/watch") ||
        p.includes("/video") ||
        p.includes("/videos/") ||
        p.includes("/v/") ||
        p.includes("/embed/") ||
        p.includes("/shorts/") ||
        p.includes("/clip/") ||
        p.includes("/reel/") ||
        p.includes("/player") ||
        u.searchParams.has("v") ||
        u.searchParams.has("video_id")
      );
    } catch {
      return false;
    }
  }

  Yaria.normalizeUrl = normalizeUrl;
  Yaria.makeItem = makeItem;
  Yaria.mergeItems = mergeItems;
  Yaria.rankItems = rankItems;
  Yaria.formatBytes = formatBytes;
  Yaria.pageTitleFromUrl = pageTitleFromUrl;
  Yaria.buildOffers = buildOffers;
  Yaria.extractQuality = extractQuality;
  Yaria.isYtdlpHost = isYtdlpHost;
  Yaria.looksLikeVideoPage = looksLikeVideoPage;
})(globalThis);
