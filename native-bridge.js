/* 原生 App 桥：把计算器状态持久化到 Android SharedPreferences，并在启动时恢复 */
(function () {
  var KEY = "luoke.calc.v2";
  var native = null;
  var started = false;
  var last = "";

  function snapshot() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }

  /** 原生推送来的 state：只同步数据，不重建页面 */
  function applyRemote(json) {
    if (!json || json === last) return;
    last = json;
    try { localStorage.setItem(KEY, json); } catch (e) {}
    try {
      if (window.__lcApplyRemoteState) window.__lcApplyRemoteState(json);
    } catch (e) {}
  }

  window.__nativeApplyRemote = applyRemote;
  window.__nativeSnapshot = snapshot;

  function boot() {
    native = window.Android || null;
    if (!native || typeof native.saveState !== "function") return;
    if (started) return;
    started = true;

    try {
      if (typeof native.loadState === "function") {
        var saved = native.loadState();
        if (saved && saved.length > 2) {
          var cur = localStorage.getItem(KEY) || "";
          if (saved !== cur) {
            localStorage.setItem(KEY, saved);
            // 页面脚本可能已经先读了空存档：只重载一次
            if (!sessionStorage.getItem("nativeRestored")) {
              sessionStorage.setItem("nativeRestored", "1");
              location.reload();
              return;
            }
          }
        }
      }
    } catch (e) {}

    // 首次启动也要把现有存档写入原生，不能只等变化
    last = "";
    setInterval(sync, 700);
    setInterval(pull, 800);
    sync();
  }

  function sync() {
    if (!native) return;
    var cur = localStorage.getItem(KEY) || "";
    if (!cur || cur === last) return;
    last = cur;
    try {
      if (typeof native.saveState === "function") native.saveState(cur);
      if (typeof native.onState === "function") native.onState(cur);
    } catch (e) {}
  }

  function pull() {
    if (!native || typeof native.loadState !== "function") return;
    try {
      var s = native.loadState();
      if (s && s.length > 2) applyRemote(s);
    } catch (e) {}
  }

  boot();
  var retry = setInterval(function () {
    boot();
    if (started) clearInterval(retry);
  }, 300);
  window.addEventListener("beforeunload", sync);
})();
