const api = globalThis.browser ?? globalThis.chrome;

const el = {
  status: document.getElementById("status"),
  pageTitle: document.getElementById("page-title"),
  pageUrl: document.getElementById("page-url"),
  list: document.getElementById("list"),
  hint: document.getElementById("hint"),
  audioOnly: document.getElementById("audio-only"),
  refresh: document.getElementById("btn-refresh"),
  settings: document.getElementById("btn-settings"),
};

let activeTab = null;
/** @type {object|null} */
let currentOffer = null;

function send(type, payload = {}) {
  return api.runtime.sendMessage({ type, ...payload });
}

async function getActiveTab() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

function setStatus(state, text) {
  el.status.className = `status status--${state}`;
  el.status.textContent = text;
}

function clearList() {
  while (el.list.firstChild) el.list.removeChild(el.list.firstChild);
}

function showMessage(kind, lines) {
  clearList();
  const box = document.createElement("div");
  box.className = kind; // empty | error
  lines.forEach((line, i) => {
    if (i > 0) box.appendChild(document.createElement("br"));
    if (typeof line === "string") {
      box.appendChild(document.createTextNode(line));
    } else {
      const span = document.createElement("span");
      if (line.muted) span.style.color = "var(--muted)";
      if (line.dim) span.style.opacity = "0.8";
      span.textContent = line.text;
      box.appendChild(span);
    }
  });
  el.list.appendChild(box);
}

function pickQuality(offer, value) {
  const list = offer?.qualities || [];
  return list.find((q) => q.value === value) || list[0] || null;
}

function renderOffers(offers) {
  clearList();
  currentOffer = offers?.[0] || null;

  if (!currentOffer) {
    showMessage("empty", [
      "No media found on this page.",
      { text: "Open a video site or play a video, then hit Refresh.", muted: true },
    ]);
    return;
  }

  const offer = currentOffer;
  const card = document.createElement("article");
  card.className = "card card--primary";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = offer.title || "Video";
  card.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = "Video";
  meta.appendChild(tag);
  card.appendChild(meta);

  const row = document.createElement("div");
  row.className = "download-row";

  const select = document.createElement("select");
  select.className = "quality quality--wide";
  select.title = "Quality";
  const quals = offer.qualities || [];
  for (const q of quals) {
    const opt = document.createElement("option");
    opt.value = q.value;
    opt.textContent = q.label || q.value;
    if (q.value === offer.defaultQuality) opt.selected = true;
    select.appendChild(opt);
  }
  if (!select.value && quals[0]) select.value = quals[0].value;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn--grow";
  btn.textContent = "Download";
  btn.addEventListener("click", () => {
    const chosen = pickQuality(offer, select.value);
    if (chosen) downloadChoice(offer, chosen, btn);
  });

  row.append(select, btn);
  card.appendChild(row);

  const url = document.createElement("div");
  url.className = "card-url";
  url.textContent = offer.pageUrl || "";
  url.title = offer.pageUrl || "";
  card.appendChild(url);

  el.list.appendChild(card);
}

function showErrorBanner(message) {
  const box = document.createElement("div");
  box.className = "error";
  box.appendChild(document.createTextNode("Could not reach Yaria."));
  box.appendChild(document.createElement("br"));
  box.appendChild(document.createTextNode("Open the app → Settings → Bridge."));
  box.appendChild(document.createElement("br"));
  const detail = document.createElement("span");
  detail.style.opacity = "0.8";
  detail.textContent = message || "";
  box.appendChild(detail);
  el.list.insertBefore(box, el.list.firstChild);
}

async function downloadChoice(offer, choice, btn) {
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Sending…";
  el.hint.textContent = "Handing off to Yaria…";

  const isPage =
    choice.kind === "page" ||
    choice.source === "page" ||
    String(choice.value || "").startsWith("page-") ||
    String(choice.id || "").startsWith("q:");
  let quality = choice.quality || "";
  if (isPage) {
    if (!quality && choice.value && choice.value !== "best" && !String(choice.value).startsWith("page-")) {
      quality = choice.value;
    }
    if (quality === "best" || choice.value === "page-best") quality = "";
  }

  try {
    const res = await send("SEND_DOWNLOAD", {
      job: {
        url: choice.url,
        pageUrl: offer.pageUrl || activeTab?.url || "",
        title: offer.title || activeTab?.title || "",
        quality: isPage ? quality : "",
        kind: isPage ? "page" : choice.kind || "video",
        label: choice.label || "",
        source: choice.source || "extension",
        isAudioOnly: el.audioOnly.checked,
        referrer: offer.pageUrl || activeTab?.url || "",
        headers: choice.headers || {},
      },
    });
    if (!res?.ok) throw new Error(res?.error || "Failed");
    btn.textContent = "Sent";
    btn.classList.add("btn-ok");
    el.hint.textContent = "Check Yaria → Downloads";
    setStatus("on", "Connected");
  } catch (e) {
    btn.textContent = prev;
    btn.disabled = false;
    el.hint.textContent = e.message || "Yaria unavailable";
    setStatus("off", "App offline");
    showErrorBanner(e.message || "");
    return;
  }

  setTimeout(() => {
    btn.textContent = prev;
    btn.disabled = false;
    btn.classList.remove("btn-ok");
  }, 1600);
}

async function refreshStatus() {
  const res = await send("PING_YARIA");
  if (res?.connected) setStatus("on", "Connected");
  else setStatus("off", "App offline");
}

async function loadMedia() {
  if (!activeTab?.id) {
    renderOffers([]);
    return;
  }
  try {
    await send("SCAN_TAB", { tabId: activeTab.id });
  } catch {
    /* restricted pages */
  }
  await new Promise((r) => setTimeout(r, 200));
  let offers = [];
  try {
    const res = await send("GET_MEDIA", {
      tabId: activeTab.id,
      pageUrl: activeTab.url || "",
      pageTitle: activeTab.title || "",
    });
    offers = res?.offers || [];
  } catch (e) {
    console.warn("GET_MEDIA failed", e);
  }
  renderOffers(offers);
}

el.refresh.addEventListener("click", async () => {
  el.refresh.disabled = true;
  try {
    await Promise.all([refreshStatus(), loadMedia()]);
  } finally {
    el.refresh.disabled = false;
  }
});

el.settings.addEventListener("click", () => {
  if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
});

async function init() {
  activeTab = await getActiveTab();
  if (activeTab) {
    el.pageTitle.textContent = activeTab.title || "Current tab";
    el.pageUrl.textContent = activeTab.url || "";
  } else {
    el.pageTitle.textContent = "No active tab";
  }

  if (activeTab?.url && /^(chrome|chrome-extension|about|moz-extension|edge|brave):/i.test(activeTab.url)) {
    showMessage("empty", [
      "This internal browser page cannot be scanned.",
      { text: "Open a normal website.", muted: true },
    ]);
    await refreshStatus();
    return;
  }

  await Promise.all([refreshStatus(), loadMedia()]);
}

init().catch((e) => {
  showMessage("error", [e.message || String(e)]);
});
