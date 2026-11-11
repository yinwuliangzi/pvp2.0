/* 悬浮 HUD：轻量页面。状态来自主计算器（原生桥 getSnapshot），点击动作回传主计算器执行 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var SNAP = null;
  var ACTIONS = [
    { k: "attack", t: "出招" }, { k: "charge", t: "聚能" },
    { k: "switch", t: "换人" }, { k: "item", t: "道具" }
  ];
  var MOVES = { mine: [], foe: [] };

  function bridgeName() {
    return (window.AppHudData && typeof window.AppHudData.getSnapshot === "function") ? "AppHudData" : null;
  }
  function elementOf(name) {
    if (!name || !window.SKILLS) return "?";
    for (var i = 0; i < window.SKILLS.length; i++) {
      if (window.SKILLS[i].n === name) return window.SKILLS[i].e || "?";
    }
    return "?";
  }
  function petOf(name) {
    var all = [].concat(window.PETS || [], window.PETS_SUPPLEMENT || [], window.PETS_WIKI || [],
      window.PETS_S5 || [], window.PETS_CODEX || []);
    for (var i = 0; i < all.length; i++) if (all[i] && all[i].n === name) return all[i];
    return null;
  }
  function readSnapshot() {
    var b = bridgeName();
    if (!b) { return false; }
    try {
      var raw = window[b].getSnapshot();
      if (!raw || raw.length < 2) return false;
      SNAP = JSON.parse(raw);
      ["mine", "foe"].forEach(function (sd) {
        var st = SNAP && SNAP[sd];
        if (st && Array.isArray(st.moves)) {
          MOVES[sd] = st.moves.filter(Boolean).map(function (n) { return { n: n, el: elementOf(n) }; });
        }
      });
      paintNames();
      paintTurn();
      return true;
    } catch (e) { return false; }
  }
  function paintNames() {
    ["mine", "foe"].forEach(function (sd) {
      var st = SNAP && SNAP[sd];
      if (!st || !st.slots) return;
      var name = st.slots[st.active] || st.slots[0] || "?";
      var el = $("hud" + (sd === "mine" ? "Mine" : "Foe") + "Name");
      if (el) el.textContent = name;
      var p = petOf(name);
      var em = el && el.parentNode ? el.parentNode.querySelector("em") : null;
      if (em && p) em.textContent = (p.el || "") + (p.el2 ? "·" + p.el2 : "");
    });
  }
  function paintTurn() {
    var b = $("hud") ? $("hud").querySelector(".hud-top b") : null;
    if (b && SNAP && SNAP.history) b.textContent = "第 " + (SNAP.history.length + 1) + " 回合";
    var ci = $("ciTitle");
    if (ci && SNAP && SNAP.history) ci.textContent = "第 " + (SNAP.history.length + 1) + " 回合 · 信息试探";
    var co = $("ciOrder");
    if (co) co.textContent = "先后手：按当前速度判定";
  }
  function slotsEl(side) {
    return document.querySelector("#hud" + (side === "mine" ? "Mine" : "Foe") + "Col .hud-slots");
  }
  function render(side, mode) {
    var box = slotsEl(side);
    if (!box) return;
    box.setAttribute("data-mode", mode);
    var list = mode === "moves" ? (MOVES[side].length ? MOVES[side] : []) : ACTIONS;
    if (mode === "moves" && !list.length) {
      toast("主计算器还没选招式");
      return;
    }
    box.innerHTML = list.map(function (x) {
      var cls = mode === "moves" ? "slot" : ("slot " + (x.k === "attack" ? "attack" : ""));
      var attr = mode === "moves"
        ? " data-" + (side === "mine" ? "my" : "foe") + "-move='" + x.n + "'"
        : " data-" + (side === "mine" ? "my" : "foe") + "-act='" + x.k + "'";
      var inner = mode === "moves" ? "<i>" + x.el + "</i><span>" + x.n + "</span>" : "<span>" + x.t + "</span>";
      return "<button type='button' class='" + cls + "'" + attr + ">" + inner + "</button>";
    }).join("");
  }
  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("on");
    setTimeout(function () { t.classList.remove("on"); }, 1600);
  }
  function sendAction(side, action, move) {
    var b = bridgeName();
    if (!b) { toast("没有连上主计算器"); return; }
    try {
      window[b].action(JSON.stringify({ side: side, action: action, move: move || "" }));
      toast((side === "mine" ? "我方" : "对手") + "：" + (move || action));
    } catch (e) { toast("发送失败：" + (e.message || e)); }
  }
  function appHud(fn, arg) {
    try { if (window.AppHud && typeof window.AppHud[fn] === "function") { window.AppHud[fn](arg); return true; } } catch (e) {}
    return false;
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-my-act],[data-foe-act],[data-my-move],[data-foe-move],[data-orb],#flipView") : null;
    if (!t) return;
    if (t.id === "flipView") {
      // 跳到悬浮层后方的计算器页面，而不是翻转动作位置
      if (!appHud("openTeam")) toast("没有连上主计算器");
      return;
    }
    var orb = t.getAttribute("data-orb");
    if (orb) {
      if (orb === "close") { if (!appHud("stopOverlay")) toast("关闭悬浮 HUD"); }
      else if (orb === "team") { if (!appHud("openTeam")) toast("打开队伍"); }
      else { if (!appHud("openImport")) toast("打开识别"); }
      return;
    }
    var myAct = t.getAttribute("data-my-act"), foeAct = t.getAttribute("data-foe-act");
    if (myAct === "attack" || foeAct === "attack") {
      render(myAct ? "mine" : "foe", "moves");
      return;
    }
    if (myAct || foeAct) {
      var s2 = myAct ? "mine" : "foe";
      render(s2, "act");
      sendAction(s2, myAct || foeAct, "");
      return;
    }
    var myMv = t.getAttribute("data-my-move"), foeMv = t.getAttribute("data-foe-move");
    if (myMv || foeMv) {
      var s3 = myMv ? "mine" : "foe";
      var name = myMv || foeMv;
      render(s3, "act");
      sendAction(s3, "attack", name);
    }
  });

  readSnapshot();
  render("mine", "act");
  render("foe", "act");
  setInterval(function () {
    readSnapshot();
    if ((slotsEl("mine") || {}).getAttribute && slotsEl("mine").getAttribute("data-mode") === "moves") {
      // 招式列表开着时不重建，避免打断
    }
  }, 900);
})();
