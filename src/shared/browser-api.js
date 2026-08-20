(function (g) {
  const Yaria = (g.Yaria = g.Yaria || {});
  Yaria.api = g.browser ?? g.chrome;

  Yaria.storageGet = function (defaults) {
    return Yaria.api.storage.local.get(defaults);
  };

  Yaria.storageSet = function (values) {
    return Yaria.api.storage.local.set(values);
  };

  Yaria.getActiveTab = async function () {
    const tabs = await Yaria.api.tabs.query({ active: true, currentWindow: true });
    return tabs[0] ?? null;
  };
})(globalThis);
