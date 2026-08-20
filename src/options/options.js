const api = globalThis.browser ?? globalThis.chrome;

const STORAGE_KEYS = {
  bridgeHost: "bridgeHost",
  bridgePort: "bridgePort",
  bridgeToken: "bridgeToken",
};

const DEFAULT_BRIDGE = {
  host: "127.0.0.1",
  port: 19547,
  token: "",
};

const host = document.getElementById("host");
const port = document.getElementById("port");
const token = document.getElementById("token");
const msg = document.getElementById("msg");

function setMsg(text, kind = "") {
  msg.textContent = text;
  msg.className = `msg ${kind}`.trim();
}

async function load() {
  const data = await api.storage.local.get({
    [STORAGE_KEYS.bridgeHost]: DEFAULT_BRIDGE.host,
    [STORAGE_KEYS.bridgePort]: DEFAULT_BRIDGE.port,
    [STORAGE_KEYS.bridgeToken]: DEFAULT_BRIDGE.token,
  });
  host.value = data[STORAGE_KEYS.bridgeHost];
  port.value = data[STORAGE_KEYS.bridgePort];
  token.value = data[STORAGE_KEYS.bridgeToken];
}

async function save() {
  const p = Number(port.value);
  if (!host.value.trim()) {
    setMsg("Host is required", "err");
    return false;
  }
  if (!Number.isFinite(p) || p < 1 || p > 65535) {
    setMsg("Port must be 1–65535", "err");
    return false;
  }
  await api.storage.local.set({
    [STORAGE_KEYS.bridgeHost]: host.value.trim(),
    [STORAGE_KEYS.bridgePort]: p,
    [STORAGE_KEYS.bridgeToken]: token.value.trim(),
  });
  setMsg("Saved", "ok");
  return true;
}

async function pingYaria() {
  const data = await api.storage.local.get({
    [STORAGE_KEYS.bridgeHost]: DEFAULT_BRIDGE.host,
    [STORAGE_KEYS.bridgePort]: DEFAULT_BRIDGE.port,
    [STORAGE_KEYS.bridgeToken]: DEFAULT_BRIDGE.token,
  });
  const base = `http://${data[STORAGE_KEYS.bridgeHost]}:${data[STORAGE_KEYS.bridgePort]}`;
  const headers = { Accept: "application/json" };
  if (data[STORAGE_KEYS.bridgeToken]) {
    headers.Authorization = `Bearer ${data[STORAGE_KEYS.bridgeToken]}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${base}/extension/ping`, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json().catch(() => ({ ok: true }));
  } finally {
    clearTimeout(timer);
  }
}

document.getElementById("save").addEventListener("click", () => {
  save().catch((e) => setMsg(e.message, "err"));
});

document.getElementById("test").addEventListener("click", async () => {
  const ok = await save();
  if (!ok) return;
  setMsg("Testing…");
  try {
    const res = await pingYaria();
    setMsg(`Connected${res?.version ? ` (v${res.version})` : ""}`, "ok");
  } catch (e) {
    setMsg(e.name === "AbortError" ? "Yaria is not responding" : e.message || "Unreachable", "err");
  }
});

load().catch((e) => setMsg(e.message, "err"));
