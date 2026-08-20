(function (g) {
  const Yaria = (g.Yaria = g.Yaria || {});

  async function getBridgeConfig() {
    const keys = Yaria.STORAGE_KEYS;
    const data = await Yaria.api.storage.local.get({
      [keys.bridgeHost]: Yaria.DEFAULT_BRIDGE.host,
      [keys.bridgePort]: Yaria.DEFAULT_BRIDGE.port,
      [keys.bridgeToken]: Yaria.DEFAULT_BRIDGE.token,
    });
    return {
      host: data[keys.bridgeHost] || Yaria.DEFAULT_BRIDGE.host,
      port: Number(data[keys.bridgePort]) || Yaria.DEFAULT_BRIDGE.port,
      token: data[keys.bridgeToken] || "",
    };
  }

  function bridgeBaseUrl(cfg) {
    return `http://${cfg.host}:${cfg.port}`;
  }

  async function request(path, { method = "GET", body } = {}) {
    const cfg = await getBridgeConfig();
    const url = `${bridgeBaseUrl(cfg)}${path}`;
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }
      if (!res.ok) {
        const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data ?? { ok: true };
    } catch (e) {
      if (e.name === "AbortError") {
        const err = new Error("Yaria is not responding");
        err.code = "TIMEOUT";
        throw err;
      }
      if (e.status) throw e;
      const err = new Error("Yaria app is not running or browser integration is off");
      err.code = "UNAVAILABLE";
      err.cause = e;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  Yaria.getBridgeConfig = getBridgeConfig;
  Yaria.bridgeBaseUrl = bridgeBaseUrl;
  Yaria.pingYaria = function () {
    return request("/extension/ping");
  };
  Yaria.sendDownload = function (job) {
    return request("/extension/download", {
      method: "POST",
      body: {
        url: job.url,
        page_url: job.pageUrl || "",
        title: job.title || "",
        quality: job.quality || "",
        kind: job.kind || "video",
        is_audio_only: !!job.isAudioOnly,
        referrer: job.referrer || job.pageUrl || "",
        headers: job.headers || {},
        source: job.source || "extension",
        label: job.label || "",
      },
    });
  };
  Yaria.focusYariaDownloads = async function () {
    try {
      return await request("/extension/focus", {
        method: "POST",
        body: { target: "downloads" },
      });
    } catch {
      return null;
    }
  };
})(globalThis);
