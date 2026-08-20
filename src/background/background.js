/* Background logic — classic script (Firefox event page + Chromium SW via loader). */
(function () {
  const api = Yaria.api;
  const tabMedia = new Map();

  function getTabItems(tabId) {
    return tabMedia.get(tabId) ?? [];
  }

  function setTabItems(tabId, items) {
    const trimmed = items.slice(0, Yaria.MAX_ITEMS_PER_TAB);
    tabMedia.set(tabId, trimmed);
    updateBadge(tabId, trimmed.length);
  }

  function addItems(tabId, items) {
    if (tabId < 0 || !items?.length) return;
    setTabItems(tabId, Yaria.mergeItems(getTabItems(tabId), items.filter(Boolean)));
  }

  function clearTab(tabId) {
    tabMedia.delete(tabId);
    updateBadge(tabId, 0);
  }

  async function updateBadge(tabId, count) {
    const text = count > 0 ? String(Math.min(count, 99)) : "";
    try {
      await api.action.setBadgeText({ tabId, text });
      await api.action.setBadgeBackgroundColor({ tabId, color: "#8b6cef" });
    } catch {
      /* tab gone */
    }
  }

  function headersToObject(headers) {
    const out = {};
    if (!headers) return out;
    for (const h of headers) {
      if (!h?.name) continue;
      const name = h.name.toLowerCase();
      if (["content-type", "content-length", "content-range", "accept-ranges"].includes(name)) {
        out[name] = h.value || "";
      }
    }
    return out;
  }

  function onMediaRequest(details) {
    if (details.tabId < 0) return;
    if (details.method && details.method !== "GET" && details.method !== "HEAD") return;

    const hdrs = headersToObject(details.responseHeaders);
    const mime = hdrs["content-type"] || "";
    const len = parseInt(hdrs["content-length"] || "0", 10) || 0;

    const item = Yaria.makeItem({
      url: details.url,
      pageUrl: details.originUrl || details.documentUrl || "",
      mime,
      source: "network",
      bytes: len,
      tabId: details.tabId,
      headers: {
        referer: details.originUrl || details.documentUrl || "",
      },
    });
    if (item) addItems(details.tabId, [item]);
  }

  if (api.webRequest?.onCompleted) {
    api.webRequest.onCompleted.addListener(onMediaRequest, { urls: ["<all_urls>"] }, ["responseHeaders"]);
  }
  if (api.webRequest?.onResponseStarted) {
    api.webRequest.onResponseStarted.addListener(onMediaRequest, { urls: ["<all_urls>"] }, ["responseHeaders"]);
  }

  api.tabs.onRemoved.addListener((tabId) => clearTab(tabId));
  api.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading" && changeInfo.url) clearTab(tabId);
  });

  function ensureContextMenus() {
    if (!api.contextMenus) return;
    try {
      api.contextMenus.removeAll(() => {
        api.contextMenus.create({
          id: "yaria-download-page",
          title: "Download page with Yaria",
          contexts: ["page", "video", "audio", "link"],
        });
        api.contextMenus.create({
          id: "yaria-download-link",
          title: "Download link with Yaria",
          contexts: ["link", "video", "audio"],
        });
      });
    } catch {
      /* ignore */
    }
  }

  api.runtime.onInstalled.addListener(ensureContextMenus);
  ensureContextMenus();

  api.contextMenus?.onClicked?.addListener(async (info, tab) => {
    const pageUrl = tab?.url || info.pageUrl || "";
    const title = tab?.title || "Media";
    let url = pageUrl;
    if (info.menuItemId === "yaria-download-link") {
      url = info.linkUrl || info.srcUrl || pageUrl;
    } else if (info.srcUrl) {
      url = info.srcUrl;
    }

    const item =
      Yaria.makeItem({
        url,
        pageUrl,
        title,
        source: info.srcUrl || info.linkUrl ? "dom" : "page",
        tabId: tab?.id ?? -1,
      }) || {
        id: "page",
        url: pageUrl,
        pageUrl,
        title,
        kind: "page",
        label: "Page",
        quality: "",
        mime: "",
        source: "page",
        headers: {},
      };

    try {
      await Yaria.sendDownload({ ...item, referrer: pageUrl });
    } catch (e) {
      console.warn("Yaria context download failed:", e.message);
    }
  });

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  });

  async function handleMessage(message, sender) {
    const tabId = message.tabId ?? sender.tab?.id ?? -1;

    switch (message.type) {
      case "MEDIA_FOUND": {
        const items = (message.items || [])
          .map((raw) =>
            Yaria.makeItem({
              ...raw,
              pageUrl: raw.pageUrl || sender.tab?.url || "",
              title: raw.title || sender.tab?.title || "",
              tabId,
            })
          )
          .filter(Boolean);
        addItems(tabId, items);
        return { ok: true, count: getTabItems(tabId).length };
      }

      case "GET_MEDIA": {
        const id = message.tabId ?? tabId;
        const items = getTabItems(id);
        let pageUrl = "";
        let pageTitle = "";
        try {
          const tab = id >= 0 ? await api.tabs.get(id) : null;
          pageUrl = tab?.url || message.pageUrl || "";
          pageTitle = tab?.title || message.pageTitle || "";
        } catch {
          pageUrl = message.pageUrl || "";
          pageTitle = message.pageTitle || "";
        }

        let offers = [];
        try {
          if (typeof Yaria.buildOffers === "function") {
            offers = Yaria.buildOffers(items, pageUrl, pageTitle) || [];
          }
        } catch (e) {
          console.warn("buildOffers failed:", e);
        }

        // No universal fallback — only real media or known video sites (see buildOffers)

        if (id >= 0) updateBadge(id, offers.length);
        return { ok: true, items, offers, pageUrl, pageTitle };
      }

      case "CLEAR_MEDIA": {
        clearTab(message.tabId ?? tabId);
        return { ok: true };
      }

      case "PING_YARIA": {
        try {
          const data = await Yaria.pingYaria();
          return { ok: true, connected: true, data };
        } catch (e) {
          return { ok: true, connected: false, error: e.message, code: e.code || "" };
        }
      }

      case "SEND_DOWNLOAD": {
        const job = message.job;
        if (!job?.url) throw new Error("Missing download URL");
        const data = await Yaria.sendDownload(job);
        return { ok: true, data };
      }

      case "SCAN_TAB": {
        const id = message.tabId ?? tabId;
        if (id < 0) return { ok: false, error: "No tab" };
        try {
          await api.scripting.executeScript({
            target: { tabId: id, allFrames: true },
            files: ["src/content/detect.js"],
          });
        } catch (e) {
          return { ok: false, error: e.message };
        }
        return { ok: true, items: getTabItems(id) };
      }

      default:
        return { ok: false, error: `Unknown message: ${message.type}` };
    }
  }

  if (api.alarms?.create) {
    api.alarms.create("yaria-keep", { periodInMinutes: 1 });
    api.alarms.onAlarm.addListener(() => {});
  }
})();
