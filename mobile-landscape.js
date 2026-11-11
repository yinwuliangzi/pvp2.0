/* 手机横屏对战台：复用 calculator.html 的 calc.js 引擎与状态，只做三栏横屏布局 */
(function () {
  function $(id) { return document.getElementById(id); }
  function waitFor(cond, cb, tries) {
    tries = tries === undefined ? 120 : tries;
    if (cond()) { cb(); return; }
    if (tries <= 0) { cb(); return; }
    setTimeout(function () { waitFor(cond, cb, tries - 1); }, 60);
  }

  function elOf(pet) {
    return ((pet && pet.el) || "") + ((pet && pet.el2) ? "·" + pet.el2 : "");
  }

  function paintSide(side) {
    var st = window.__lsSideStats ? window.__lsSideStats(side) : null;
    if (!st) return;
    var p = side === "mine" ? "Mine" : "Foe";
    var raw = st.raw;
    $("ml" + p + "Name").textContent = st.pet.n;
    $("ml" + p + "Ele").textContent = elOf(st.pet);
    $("ml" + p + "Hp").textContent = raw.hp + "/" + st.stats.hp;
    $("ml" + p + "HpBar").style.width = Math.max(0, Math.min(100, raw.hp / Math.max(1, st.stats.hp) * 100)) + "%";
    $("ml" + p + "En").textContent = raw.energy;
    $("ml" + p + "Spe").textContent = st.stats.spe;

    var cur = window.__lsMoveSel(side);
    $("ml" + p + "Moves").innerHTML = (raw.moves || []).map(function (n) {
      var k = window.__lsSkill(n);
      if (!k) return "<button type='button' class='ml-none' disabled>空</button>";
      return "<button type='button' data-move='" + side + "|" + k.n + "' data-el='" + (k.e || "?") + "'" +
        (cur === k.n ? " class='on'" : "") + ">" + k.n + "</button>";
    }).join("") || "<button type='button' class='ml-none' disabled>没有招式</button>";

    var curAct = window.__lsAct(side);
    $("ml" + p + "Acts").innerHTML = [["attack", "出招"], ["charge", "聚能"], ["switch", "换人"], ["counter", "应对"], ["item", "道具"]]
      .map(function (x) {
        return "<button type='button' data-act='" + side + "|" + x[0] + "'" + (curAct === x[0] ? " class='on'" : "") + ">" + x[1] + "</button>";
      }).join("");
  }

  function paintCenter() {
    var h = window.__lsHistory ? window.__lsHistory() : [];
    var turn = h.length + 1;
    $("mlTurnNo").textContent = "第 " + turn + " 回合";
    $("mlMineTurn").textContent = "第 " + turn + " 回合";
    $("mlTlFill").style.width = Math.max(2, Math.min(100, h.length / 50 * 100)) + "%";
    var ph = window.__lsPhase ? window.__lsPhase() : null;
    $("mlPhase").textContent = ph ? ph.label : "—";

    var prev = window.__lsPreview ? window.__lsPreview() : "";
    var box = $("mlPreview");
    if (prev) {
      box.innerHTML = prev.split("\n").filter(Boolean).map(function (t) {
        var cls = /⚠|能量不够|禁足/.test(t) ? " warn" : (/✅|可击杀|我方先手/.test(t) ? " good" : "");
        return "<div class='ml-row" + cls + "'>" + t + "</div>";
      }).join("");
    } else {
      box.innerHTML = "<em>选招后这里显示后果预测</em>";
    }

    var bits = window.__lsChips ? window.__lsChips() : [];
    $("mlChips").innerHTML = bits.length
      ? bits.map(function (t) { return "<span>" + t + "</span>"; }).join("")
      : "<em>暂无天气 / 印记 / 状态</em>";
  }

  function paintAll() { paintSide("mine"); paintSide("foe"); paintCenter(); }

  function setMove(side, name) {
    window.__lsSetMove(side, name);
    paintAll();
    if (window.__lsOneTap && side === "mine") record();
  }

  function setAct(side, a) {
    window.__lsSetAct(side, a);
    paintAll();
  }

  function record() {
    var before = window.__lsHistory().length;
    var btn = document.getElementById("recordTurn");
    if (btn) btn.click();
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
    paintAll();
    var after = window.__lsHistory().length;
    $("mlNote").textContent = after > before
      ? "已记录第 " + after + " 回合"
      : "没记上：先选我方和对手的招式，或改用「聚能 / 换人 / 应对」";
  }

  function undo() {
    var u = document.getElementById("undoTurn");
    if (u) u.click();
    paintAll();
    $("mlNote").textContent = "已撤销";
  }

  function repeat() {
    var r = document.getElementById("recordTurn");
    if (r) r.click();
    paintAll();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-move],[data-act],#mlRecord,#mlUndo,#mlRepeat") : null;
    if (!t) return;
    if (t.id === "mlRecord") { record(); return; }
    if (t.id === "mlUndo") { undo(); return; }
    if (t.id === "mlRepeat") { repeat(); return; }
    var mv = t.getAttribute("data-move");
    if (mv) { var a = mv.split("|"); setMove(a[0], a[1]); return; }
    var ac = t.getAttribute("data-act");
    if (ac) { var b = ac.split("|"); setAct(b[0], b[1]); }
  });

  // 长按技能 = 应对
  document.addEventListener("pointerdown", function (e) {
    var t = e.target.closest ? e.target.closest("[data-move]") : null;
    if (!t) return;
    var parts = t.getAttribute("data-move").split("|");
    var timer = setTimeout(function () {
      window.__lsSetMove(parts[0], parts[1]);
      window.__lsSetAct(parts[0], "counter");
      paintAll();
      $("mlNote").textContent = "应对：" + parts[1];
    }, 460);
    var clear = function () { clearTimeout(timer); };
    t.addEventListener("pointerup", clear, { once: true });
    t.addEventListener("pointercancel", clear, { once: true });
    t.addEventListener("pointerleave", clear, { once: true });
  });

  function ready() {
    var load = document.getElementById("mlLoading");
    if (load) load.remove();
    document.documentElement.style.setProperty("--ml-ready", "1");
    document.body.classList.add("ml-on");
    paintAll();
    if (window.__mlTimer) clearInterval(window.__mlTimer);
    window.__mlTimer = setInterval(function () {
      paintAll();
    }, 900);
  }

  waitFor(function () {
    return typeof window.__lsReady === "function" && window.__lsReady() && document.getElementById("recordTurn");
  }, ready, 200);
  // 保险丝：6 秒后无论如何先撤掉遮罩，避免脚本异常时页面一直“正在载入”
  setTimeout(function () {
    var load = document.getElementById("mlLoading");
    if (load) ready();
  }, 6000);
})();
