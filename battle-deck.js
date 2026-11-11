(function(){try{if(location.search.indexOf("layer=back")>=0)document.body.classList.add("layer-back");}catch(e){}})();
/* 对战悬浮台 · 布局演示 + 反向推断 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DEFAULT_OWN = ["迪莫", "喵喵", "喵呜", "魔力猫", "叶冕魔力猫", "火花"];

  function dedupePets() {
    var all = []
      .concat(window.PETS || [])
      .concat(window.PETS_SUPPLEMENT || [])
      .concat(window.PETS_WIKI || [])
      .concat(window.PETS_S5 || [])
      .concat(window.PETS_CODEX || []);
    var seen = {}, out = [];
    all.forEach(function (p) {
      if (!p || !p.n || seen[p.n]) return;
      if (typeof p.hp !== "number" || typeof p.el !== "string") return;
      seen[p.n] = 1;
      out.push(p);
    });
    return out;
  }
  var ALL = dedupePets();
  var byName = {};
  ALL.forEach(function (p) { byName[p.n] = p; });

  function typeMult(el, pet) {
    if (!el || !pet) return 1;
    var types = [pet.el, pet.el2].filter(Boolean);
    if (!types.length) return 1;
    var m = 1;
    types.forEach(function (t) {
      var T = (window.TYPES || {})[el] || {};
      if ((T.strong || []).indexOf(t) >= 0) m *= 2;
      if ((T.resist || []).indexOf(t) >= 0) m *= 0.5;
    });
    return m;
  }

  function offense(pet, own) {
    var a = typeMult(pet.el, own);
    var b = pet.el2 ? typeMult(pet.el2, own) : 1;
    return Math.max(a, b);
  }

  function loadOwn() {
    try {
      var raw = localStorage.getItem("battleDeck.own");
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === 6 && arr.every(function (n) { return byName[n]; })) return arr;
      }
      var saved = JSON.parse(localStorage.getItem("luoke.calc.v2") || "null");
      if (saved && saved.mine && Array.isArray(saved.mine.slots)) {
        var slots = saved.mine.slots.slice(0, 6).map(function (n) { return byName[n] ? n : ""; });
        while (slots.length < 6) slots.push("");
        if (slots.filter(Boolean).length >= 3) return slots;
      }
    } catch (e) {}
    return DEFAULT_OWN.slice();
  }

  var ownTeam = loadOwn();
  function firstValidOwn() {
    for (var i = 0; i < ownTeam.length; i++) if (byName[ownTeam[i]]) return ownTeam[i];
    return ALL[0] ? ALL[0].n : "迪莫";
  }

  function renderOwnSelects() {
    var box = $("predictOwn");
    box.innerHTML = "";
    for (var i = 0; i < 6; i++) {
      var sel = document.createElement("select");
      sel.innerHTML = "<option value=''>—</option>" + ALL.map(function (p) {
        return "<option value='" + p.n + "'>" + p.n + "</option>";
      }).join("");
      sel.value = byName[ownTeam[i]] ? ownTeam[i] : "";
      sel.addEventListener("change", (function (idx) {
        return function () {
          ownTeam[idx] = this.value;
          try { localStorage.setItem("battleDeck.own", JSON.stringify(ownTeam)); } catch (e) {}
          renderHudNames();
                };
      })(i));
      box.appendChild(sel);
    }
  }

  function renderHudNames() {
    var first = byName[firstValidOwn()] || ALL[0];
    if (!first) return;
    // hudMineName 随顶部卡片一起移除，这里只更新时间轴侧的名字
    var hn = $("hudMineName");
    if (hn) hn.textContent = first.n;
    var bn = $("bubbleMineName");
    if (bn) {
      bn.textContent = first.n;
      var em = bn.nextElementSibling;
      if (em) em.textContent = first.el || "";
    }
  }


  // ---------- 反向推断：作战数据 → 个体值 / 性格 / 技能威力 / HP ----------
  var selectedFoe = "";
  var INFER_NATURES = [
    { n:"固执", up:"物攻", down:"魔攻" }, { n:"勇敢", up:"物攻", down:"速度" },
    { n:"调皮", up:"物攻", down:"魔防" }, { n:"孤独", up:"物攻", down:"物防" },
    { n:"大胆", up:"物防", down:"物攻" }, { n:"淘气", up:"物防", down:"魔攻" },
    { n:"无虑", up:"物防", down:"魔防" }, { n:"悠闲", up:"物防", down:"速度" },
    { n:"保守", up:"魔攻", down:"物攻" }, { n:"稳重", up:"魔攻", down:"物防" },
    { n:"马虎", up:"魔攻", down:"魔防" }, { n:"冷静", up:"魔攻", down:"速度" },
    { n:"沉着", up:"魔防", down:"物攻" }, { n:"温顺", up:"魔防", down:"物防" },
    { n:"慎重", up:"魔防", down:"魔攻" }, { n:"狂妄", up:"魔防", down:"速度" },
    { n:"胆小", up:"速度", down:"物攻" }, { n:"开朗", up:"速度", down:"魔防" },
    { n:"急躁", up:"速度", down:"物防" }, { n:"天真", up:"速度", down:"魔攻" },
    { n:"实干", up:"", down:"" }, { n:"坦率", up:"", down:"" },
    { n:"害羞", up:"", down:"" }, { n:"浮躁", up:"", down:"" },
    { n:"认真", up:"", down:"" }
  ];
  function inferStats(pet, iv, nature) {
    var L = 60, SS = 5;
    function ik(k) { return (Number(iv[k]) || 0) * (1 + SS); }
    function f(stat) {
      if (!nature) return 1;
      if (nature.up === stat) return 1.1 + 0.02 * SS;
      if (nature.down === stat) return 0.9;
      return 1;
    }
    function nh(S, stat, k) {
      return 10 * SS + Math.round(f(stat) * Math.round((0.01 * L + 0.5) * (S + 0.5 * ik(k)) + 10));
    }
    return {
      hp: 20 * SS + Math.round(f("生命") * Math.round((0.02 * L + 0.5) * (pet.hp + 0.5 * ik("hp")) + L + 10)),
      atk: nh(pet.atk, "物攻", "atk"), ma: nh(pet.ma, "魔攻", "ma"),
      def: nh(pet.def, "物防", "def"), md: nh(pet.md, "魔防", "md"),
      spe: nh(pet.spe, "速度", "spe")
    };
  }
  function allSkills() {
    return (window.SKILLS || []).filter(function (s) { return s && s.n && Number(s.p) > 0; });
  }
  function fillPredSkills() {
    var sk = allSkills();
    ["predMySkill", "predFoeSkill"].forEach(function (id) {
      var sel = $(id);
      if (!sel || sel.options.length) return;
      sel.innerHTML = "<option value=''>选择技能</option>" + sk.map(function (s) {
        return "<option value='" + s.n + "'>" + s.n + " · " + s.e + " · " + s.p + "</option>";
      }).join("");
    });
  }
  function skillOf(n) { return allSkills().filter(function (s) { return s.n === n; })[0] || null; }
  function typeMulDeck(el, pet) {
    if (!el || !pet) return 1;
    var m = 1;
    [pet.el, pet.el2].filter(Boolean).forEach(function (t) {
      var T = (window.TYPES || {})[el] || {};
      if ((T.strong || []).indexOf(t) >= 0) m *= 2;
      if ((T.resist || []).indexOf(t) >= 0) m *= 0.5;
    });
    return m;
  }
  function pickDef(foe, skill, myPet, targetDmg) {
    var best = null;
    var my = (window.__lsSideStats && window.__lsSideStats("mine")) || null;
    var atk = skill && skill.t && skill.t.indexOf("魔") >= 0 ? (my && my.stats.ma) : (my && my.stats.atk);
    if (!atk) atk = 200;
    var stab = myPet && (skill.e === myPet.el || skill.e === myPet.el2) ? 1.25 : 1;
    var tm = typeMulDeck(skill.e, foe);
    INFER_NATURES.forEach(function (nat) {
      for (var iv = 0; iv <= 31; iv++) {
        var def = inferStats(foe, { hp:10, atk:10, ma:10, def:iv, md:10, spe:10 }, nat).def;
        var dmg = Math.max(1, Math.round((skill.p || 1) * atk / Math.max(1, def) * (37/41) * stab * tm));
        var err = Math.abs(dmg - targetDmg);
        if (!best || err < best.err) best = { err: err, iv: iv, nature: nat, def: def, dmg: dmg };
      }
    });
    return best;
  }
  function pickAtk(foe, skill, targetDmg) {
    var my = (window.__lsSideStats && window.__lsSideStats("mine")) || null;
    var myDef = my && my.stats ? (skill && skill.t && skill.t.indexOf("魔") >= 0 ? my.stats.md : my.stats.def) : 180;
    var myPet = my && my.pet;
    var stab = myPet && (skill.e === myPet.el || skill.e === myPet.el2) ? 1.25 : 1;
    var tm = typeMulDeck(skill.e, myPet);
    var best = null;
    INFER_NATURES.forEach(function (nat) {
      for (var iv = 0; iv <= 31; iv++) {
        var st = inferStats(foe, { hp:10, atk:iv, ma:iv, def:10, md:10, spe:10 }, nat);
        var atk = skill && skill.t && skill.t.indexOf("魔") >= 0 ? st.ma : st.atk;
        var dmg = Math.max(1, Math.round((skill.p || 1) * atk / Math.max(1, myDef) * (37/41) * stab * tm));
        var err = Math.abs(dmg - targetDmg);
        if (!best || err < best.err) best = { err: err, iv: iv, nature: nat, atk: atk, dmg: dmg };
      }
    });
    return best;
  }
  function inferConfig() {
    var box = $("predictResult");
    if (!box) return;

    var foe = byName[selectedFoe] || null;
    var my = (window.__lsSideStats && window.__lsSideStats("mine")) || null;
    if (!foe) {
      box.innerHTML = "<div class='pd-box'><b>还没有选敌方</b>先在 deck 里选择对手精灵</div>";
      return;
    }

    var fh = Math.max(0, Math.min(100, Number($("predFoeHp").value) || 0));
    var mh = Math.max(0, Math.min(100, Number($("predMyHp").value) || 0));
    var mySk = skillOf($("predMySkill").value);
    var foeSk = skillOf($("predFoeSkill").value);
    var dToFoe = Number($("predDmgToFoe").value) || 0;
    var dToMe = Number($("predDmgToMe").value) || 0;

    var defInfo = mySk && dToFoe ? pickDef(foe, mySk, my && my.pet, dToFoe) : null;
    var atkInfo = foeSk && dToMe ? pickAtk(foe, foeSk, dToMe) : null;
    var nature = (defInfo && defInfo.nature) || (atkInfo && atkInfo.nature) || INFER_NATURES[20];
    var iv = { hp: 10, atk: 10, ma: 10, def: defInfo ? defInfo.iv : 10, md: 10, spe: 10 };
    if (atkInfo) {
      if (foeSk.t && foeSk.t.indexOf("魔") >= 0) iv.ma = atkInfo.iv; else iv.atk = atkInfo.iv;
    }

    var foeStats = inferStats(foe, iv, nature);
    var foeCur = Math.round(foeStats.hp * fh / 100);
    var myMax = my && my.stats ? my.stats.hp : 0;
    var myCur = myMax ? Math.round(myMax * mh / 100) : 0;
    var natureText = nature.up
      ? nature.n + "（+" + nature.up + " − " + nature.down + "）"
      : nature.n + "（中性）";

    // 同步刷新配置卡里的数值
    try {
      var setTxt = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
      if (foeStats) {
        setTxt("pdFoeAtk", foeStats.atk);
        setTxt("pdFoeMa", foeStats.ma);
        setTxt("pdFoeDef", foeStats.def);
        setTxt("pdFoeMd", foeStats.md);
        setTxt("pdFoeSpe", foeStats.spe);
        setTxt("pdFoeHpRange", foeStats.hp);
        setTxt("pdFoeHpNow", fh ? foeCur + " / " + foeStats.hp : "--");
      }
      if (myMax && mh) setTxt("pdMineHpNow", myCur + " / " + myMax);
    } catch (e) {}

    var ivTag = function (label, v) {
      return "<span class='" + (v >= 25 ? "hi" : "") + "'>" + label + " " + v + "</span>";
    };

    box.innerHTML =
      "<div class='pd-box'><b>反推个体值</b>" +
        "<div class='pd-iv'>" +
          ivTag("HP", iv.hp) + ivTag("物攻", iv.atk) + ivTag("魔攻", iv.ma) +
          ivTag("物防", iv.def) + ivTag("魔防", iv.md) + ivTag("速度", iv.spe) +
        "</div>" +
        "<em>误差 " + (defInfo ? defInfo.err : "—") + " / " + (atkInfo ? atkInfo.err : "—") + " 点</em>" +
      "</div>" +
      "<div class='pd-box'><b>反推性格</b>" + natureText +
        "<br><em>敌方 HP 约 " + foeStats.hp + "，当前 " + (fh ? foeCur + "（" + fh + "%）" : "未填") + "</em>" +
        "<br><em>启发式反推，单项可能有 ±1~2 误差</em>" +
      "</div>";
  }

  function renderPredict() {
    var own = ownTeam.map(function (n) { return byName[n]; }).filter(Boolean);
    if (!own.length) own = ALL.slice(0, 6);
    var ownNames = {};
    ownTeam.forEach(function (n) { ownNames[n] = 1; });

    var scored = ALL.filter(function (p) { return !ownNames[p.n]; }).map(function (p) {
      var total = 0, countered = 0;
      own.forEach(function (o) {
        var m = offense(p, o);
        total += m;
        if (m >= 2) countered++;
      });
      var stat = ((Number(p.hp) || 0) + (Number(p.atk) || 0) + (Number(p.ma) || 0) +
        (Number(p.def) || 0) + (Number(p.md) || 0) + (Number(p.spe) || 0)) / 6000;
      return { p: p, score: total / own.length + countered * 0.10 + stat * 0.18, countered: countered };
    }).sort(function (a, b) { return b.score - a.score; });

    // 尽量每个主属性只取一只，保证阵容多样性
    var picked = [], usedEl = {};
    scored.forEach(function (x) {
      if (picked.length >= 6) return;
      if (usedEl[x.p.el] && picked.length < 4) return;
      usedEl[x.p.el] = 1;
      picked.push(x);
    });
    scored.forEach(function (x) { if (picked.length < 6 && picked.indexOf(x) < 0) picked.push(x); });

    if (!$("predictList")) return;
    $("predictList").innerHTML = picked.slice(0, 6).map(function (x) {
      var p = x.p;
      return "<div class='pred-card' data-pred='" + p.n + "'>" +
        "<b>" + p.n + "</b>" +
        "<em>" + (p.el || "?") + (p.el2 ? "·" + p.el2 : "") + " · " + x.score.toFixed(2) + "</em>" +
        "<i>克制 " + x.countered + "/" + own.length + "</i>" +
        "</div>";
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("[data-pred]"), function (card) {
      card.addEventListener("click", function () {
        var p = byName[card.getAttribute("data-pred")];
        if (!p) return;
        selectedFoe = p.n;
        $("hudFoeName").textContent = p.n;
        $("bubbleFoeName").textContent = p.n;
        var em = $("bubbleFoeName").nextElementSibling;
        if (em) em.textContent = p.el || "";
        toast("把 " + p.n + " 当作对手首发（仅演示）");
      });
    });
  }


  /** 把选择写回计算器；能记录就记录一回合 */
  function applyPickToCalc(side, name) {
    if (typeof window.__lsSetMove !== "function") return "";
    try {
      window.__lsSetMove(side, name);
      if (side !== "mine") return "已登记";
      // 我方出招：两边都有招才记录，否则只登记
      var foeSel = window.__lsMoveSel ? window.__lsMoveSel("foe") : "";
      if (!foeSel && FOE_MOVES.length) {
        window.__lsSetMove("foe", FOE_MOVES[0].n);
      }
      var before = window.__lsHistory().length;
      var btn = document.getElementById("recordTurn");
      if (btn) btn.click();
      var after = window.__lsHistory().length;
      refreshFromCalc();
      return after > before ? "已记录第 " + after + " 回合" : "已选，未记录";
    } catch (e) {
      return "写回失败：" + (e.message || e);
    }
  }


  var PHASE_ROWS = [
    { label: "信息试探", from: 1, to: 4 },
    { label: "能量压制", from: 5, to: 10 },
    { label: "发育破局", from: 11, to: 16 },
    { label: "兑现斩杀", from: 17, to: 24 },
    { label: "残局收束", from: 25, to: 50 }
  ];
  function paintAnalysis(st) {
    if (!st) return;
    var turn = (st.history || []).length + 1;
    var row = PHASE_ROWS.filter(function (r) { return turn >= r.from && turn <= r.to; })[0] || PHASE_ROWS[0];
    var tl = document.querySelector(".timeline span");
    if (tl) tl.textContent = "第 " + turn + " 回合 · " + row.label;
    Array.prototype.forEach.call(document.querySelectorAll(".phases span"), function (s, i) {
      s.classList.toggle("on", i === PHASE_ROWS.indexOf(row));
    });
    var order = document.querySelector(".order");
    if (order) {
      var mine = typeof window.__lsSideStats === "function" ? window.__lsSideStats("mine") : null;
      var foe = typeof window.__lsSideStats === "function" ? window.__lsSideStats("foe") : null;
      if (mine && foe) {
        var ms = mine.stats.spe, fs2 = foe.stats.spe;
        order.textContent = "先后手：" + (ms >= fs2 ? "我方先手" : "对手先手") + "（速度 " + ms + " vs " + fs2 + "）";
      }
    }
    var infer = document.querySelector(".infer");
    if (infer) {
      var t2 = typeof window.__foeOptions === "function" ? window.__foeOptions() : null;
      if (t2 && t2.length) {
        infer.textContent = "🔍 对手推测（按手牌+能量+血量打分）：" + t2.slice(0, 3).map(function (x) {
          var nm = x.o.kind === "attack" ? "「" + x.o.name + "」" + x.o.dmg : x.o.name;
          return nm + " " + Math.round(x.p * 100) + "%";
        }).join(" ／ ");
      }
    }
  }

  /** 从计算器同步名字、招式、分析行 */
  function refreshFromCalc() {
    var st = CALC_STATE || (typeof window.__lsState === "function" ? window.__lsState() : null);
    if (!st) return;
    CALC_STATE = st;
    ["mine", "foe"].forEach(function (sd) {
      var info = typeof window.__lsSideStats === "function" ? window.__lsSideStats(sd) : null;
      if (!info || !info.pet) return;
      var nm = sd === "mine" ? "hudMineName" : "hudFoeName";
      var bn = sd === "mine" ? "bubbleMineName" : "bubbleFoeName";
      var el = document.getElementById(nm);
      if (el) el.textContent = info.pet.n;
      var be = document.getElementById(bn);
      if (be) {
        be.textContent = info.pet.n;
        var em = be.nextElementSibling;
        if (em) em.textContent = (info.pet.el || "") + (info.pet.el2 ? "·" + info.pet.el2 : "");
      }
      var msel = document.getElementById(sd === "mine" ? "chosenMine" : "chosenFoe");
      var cur = typeof window.__lsMoveSel === "function" ? window.__lsMoveSel(sd) : "";
      var act = typeof window.__lsAct === "function" ? window.__lsAct(sd) : "attack";
      if (msel) {
        var label = ({ attack: "出招", charge: "聚能", switch: "换人", item: "道具" })[act] || act;
        msel.textContent = (sd === "mine" ? "我方" : "对手") + " " + label + (cur ? "：" + cur : "");
      }
    });
    var turnEl = document.querySelector(".hud-top b");
    if (turnEl) turnEl.textContent = "第 " + ((st.history || []).length + 1) + " 回合";
    var hist = st.history || [];
    var fill = document.getElementById("tlFill");
    if (fill) fill.style.width = Math.max(2, Math.min(100, hist.length / 50 * 100)) + "%";
    var last = hist[hist.length - 1];
    var row = document.querySelector(".chosen-row");
    if (row && last) {
      var extra = (last.statusLog || []).slice(0, 2).join("；");
      var tr = document.querySelector(".turn-row");
      if (tr) {
        tr.textContent = "第 " + last.turn + " 回合 · 我 " + last.mineHp + " / 敌 " + last.foeHp +
          " · 能量 " + last.mineEnergy + "/" + last.foeEnergy + (extra ? " · " + extra : "");
      }
    }
    loadMoves();
    renderSlots("mine", "act");
    renderSlots("foe", "act");
    paintAnalysis(st);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 1600);
  }

  // 主 HUD：我方 / 对手 各自 4 个动作位，点「出招」原位换成 4 个技能
  var MY_MOVES = [];
  var FOE_MOVES = [];
  var CALC_STATE = null;   // 计算器实时状态（若能读到）

  function skillMeta(name) {
    if (!name) return null;
    if (CALC_STATE && typeof window.__lsSkill === "function") {
      var k = window.__lsSkill(name);
      if (k) return { n: k.n, el: k.e || "?", c: k.c };
    }
    for (var i = 0; i < ALL.length; i++) { /* 名字相同也够用 */ }
    var p = byName[name] || null;
    return { n: name, el: (p && p.el) || "?" };
  }

  function readMovesFromCalc(side) {
    var st = CALC_STATE || (typeof window.__lsState === "function" ? window.__lsState() : null);
    if (!st || !st[side] || !Array.isArray(st[side].moves)) return null;
    var out = st[side].moves.filter(Boolean).map(skillMeta).filter(Boolean);
    return out.length ? out : null;
  }

  function loadMoves() {
    MY_MOVES = readMovesFromCalc("mine") || [
      { n: "岩脉崩毁", el: "地" }, { n: "持续高温", el: "火" },
      { n: "一拳", el: "武" }, { n: "冰晶坠", el: "冰" }
    ];
    FOE_MOVES = readMovesFromCalc("foe") || [
      { n: "电弧", el: "电" }, { n: "交叉闪电", el: "电" },
      { n: "翼击", el: "翼" }, { n: "暴风眼", el: "翼" }
    ];
  }
  var ACTIONS = [
    { k: "attack", t: "出招" },
    { k: "charge", t: "聚能" },
    { k: "switch", t: "换人" },
    { k: "item", t: "道具" }
  ];

  function slotsEl(side) {
    return document.querySelector("#hud" + (side === "mine" ? "Mine" : "Foe") + "Col .hud-slots");
  }
  function renderSlots(side, mode, chosen) {
    var box = slotsEl(side);
    if (!box) return;
    box.setAttribute("data-mode", mode);
    var list = mode === "moves" ? (side === "mine" ? MY_MOVES : FOE_MOVES) : ACTIONS;
    box.innerHTML = list.map(function (x) {
      var cls = mode === "moves" ? "slot" : ("slot " + (x.k === "attack" ? "attack" : ""));
      if (chosen && chosen === x.n) cls += " on";
      var attr = mode === "moves"
        ? " data-" + (side === "mine" ? "my" : "foe") + "-move='" + x.n + "'"
        : " data-" + (side === "mine" ? "my" : "foe") + "-act='" + x.k + "'";
      var inner = mode === "moves"
        ? "<i>" + x.el + "</i><span>" + x.n + "</span>"
        : "<span>" + x.t + "</span>";
      return "<button type='button' class='" + cls + "'" + attr + ">" + inner + "</button>";
    }).join("");
  }
  loadMoves();
  renderSlots("mine", "act");
  renderSlots("foe", "act");

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-my-act],[data-foe-act],[data-my-move],[data-foe-move]") : null;
    if (!t) return;

    var myAct = t.getAttribute("data-my-act");
    var foeAct = t.getAttribute("data-foe-act");
    if (myAct === "attack" || foeAct === "attack") {
      var side = myAct ? "mine" : "foe";
      renderSlots(side, "moves");
      toast((side === "mine" ? "我方" : "对手") + "出招：请选 4 个技能之一");
      return;
    }
    if (myAct || foeAct) {
      var s2 = myAct ? "mine" : "foe";
      renderSlots(s2, "act");
      Array.prototype.forEach.call(slotsEl(s2).children, function (b) {
        if ((myAct && b.getAttribute("data-my-act") === myAct) || (foeAct && b.getAttribute("data-foe-act") === foeAct)) b.classList.add("on");
      });
      var actChip = document.getElementById(s2 === "mine" ? "chosenMine" : "chosenFoe");
      if (actChip) actChip.textContent = (s2 === "mine" ? "我方" : "对手") + "：" + t.textContent;
      toast((s2 === "mine" ? "我方" : "对手") + "：" + t.textContent);
      return;
    }

    var myMv = t.getAttribute("data-my-move");
    var foeMv = t.getAttribute("data-foe-move");
    if (myMv || foeMv) {
      var s3 = myMv ? "mine" : "foe";
      renderSlots(s3, "act");
      Array.prototype.forEach.call(slotsEl(s3).children, function (b) {
        if (b.getAttribute(s3 === "mine" ? "data-my-act" : "data-foe-act") === "attack") b.classList.add("on");
      });
      var pickName = myMv || foeMv;
      var chip = document.getElementById(s3 === "mine" ? "chosenMine" : "chosenFoe");
      if (chip) chip.textContent = (s3 === "mine" ? "我方" : "对手") + " 出招：" + pickName;
      var res = applyPickToCalc(s3, pickName);
      toast((s3 === "mine" ? "我方" : "对手") + " 出招：" + pickName + (res ? "（" + res + "）" : ""));
      return;
    }

  });
  // 长按动作位 = 回到动作列表
  document.addEventListener("pointerdown", function (e) {
    var t = e.target.closest ? e.target.closest("[data-my-move],[data-foe-move]") : null;
    if (!t) return;
    var side = t.hasAttribute("data-my-move") ? "mine" : "foe";
    var timer = setTimeout(function () { renderSlots(side, "act"); }, 460);
    var clear = function () { clearTimeout(timer); };
    t.addEventListener("pointerup", clear, { once: true });
    t.addEventListener("pointercancel", clear, { once: true });
    t.addEventListener("pointerleave", clear, { once: true });
  });

  ["flip", "flipView"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", function () {
      // 这个键是回到悬浮层后方的 deck 页面，不是翻转动作
      closeHudView();
    });
  });

  // 独立悬浮窗视图：把 HUD 面板临时搬进去，关闭时还回去
  var hudHome = null;
  function openHudView() {
    var hud = document.getElementById("hud");
    var stage = document.getElementById("hudViewStage");
    if (!hud || !stage) return;
    if (!hudHome) hudHome = { parent: hud.parentNode, next: hud.nextSibling };
    stage.appendChild(hud);
    document.getElementById("hudView").hidden = false;
    document.body.classList.add("hudview-open");
    refreshFromCalc();
  }
  function closeHudView() {
    var hud = document.getElementById("hud");
    if (hud && hudHome) {
      hudHome.parent.insertBefore(hud, hudHome.next);
      hudHome = null;
    }
    document.getElementById("hudView").hidden = true;
    document.body.classList.remove("hudview-open");
  }
  var sw = document.getElementById("hudSwitch");
  if (sw) sw.addEventListener("click", function () { openHudView(); });
  document.querySelectorAll("#hudView [data-orb]").forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-orb");
      if (k === "close") {
        try { if (window.AppHud && typeof window.AppHud.stopOverlay === "function") window.AppHud.stopOverlay(); } catch (e) {}
        closeHudView();
        toast("关闭悬浮窗视图");
      }
      else if (k === "team") {
        // 回到后方的 deck 页面
        closeHudView();
      }
      else {
        try { if (window.AppHud && typeof window.AppHud.openImport === "function") window.AppHud.openImport(); }
        catch (e) { toast("打开识别 / 导入截图"); }
      }
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeHudView();
  });
  if ($("hudGear")) $("hudGear").addEventListener("click", function () { toast("设置（演示）"); });

  if ($("predictOwn")) renderOwnSelects();
  fillPredSkills();
  if ($("predInfer")) $("predInfer").addEventListener("click", inferConfig);
  if ($("predictClose")) $("predictClose").addEventListener("click", function () { window.__pcTogglePredict(false); });
  renderHudNames();
  renderPredict();
  $("tlFill").style.width = "4%";
  refreshFromCalc();
  setInterval(refreshFromCalc, 1200);
})();


/* 原生悬浮层：只有前景层才自动打开 hudView */
(function () {
  try {
    if (!window.AppHud) return;
    if (location.search.indexOf("layer=back") >= 0) return;
    var go = function () {
      var sw = document.getElementById("hudSwitch");
      if (sw) sw.click();
    };
    if (document.readyState === "complete") setTimeout(go, 600);
    else window.addEventListener("load", function () { setTimeout(go, 700); });
  } catch (e) {}
})();


  // ---------- 反推面板：独立开关 + 配置卡填充 ----------
  window.__pcTogglePredict = function (force) {
    var el = document.getElementById("predict");
    if (!el) return false;
    var show = (typeof force === "boolean") ? force : el.hasAttribute("hidden");
    if (show) {
      el.removeAttribute("hidden");
      document.body.classList.add("pd-open");
      try { window.__pdFill(); } catch (e) {}
    } else {
      el.setAttribute("hidden", "");
      document.body.classList.remove("pd-open");
    }
    return show;
  };

  // 把当前双方精灵的六维 / 技能伤害填进配置卡
  window.__pdFill = function () {
    function sideStats(side) {
      try {
        var s = window.__lsSideStats && window.__lsSideStats(side);
        if (s) return s;
      } catch (e) {}
      return null;
    }

    function fill(side) {
      var P = side === "mine" ? "pdMine" : "pdFoe";
      var s = sideStats(side);
      var pet = s && s.pet;
      var name = (pet && pet.n) || (side === "mine" ? "我方" : "对手");

      // 头像
      var img = document.getElementById(P + "Img");
      var fb = document.getElementById(P + "Fallback");
      if (fb) { fb.textContent = String(name).slice(0, 1); fb.style.display = ""; }
      if (img) {
        img.classList.remove("loaded");
        var src = (window.SPRITES && pet && window.SPRITES[pet.n]) || "";
        if (!src && pet && pet.n) {
          var base = String(pet.n).replace(/[（(][^）)]*[）)]/g, "").trim();
          src = (window.SPRITES && window.SPRITES[base]) || "";
        }
        if (src) {
          img.onload = function () { img.classList.add("loaded"); if (fb) fb.style.display = "none"; };
          img.onerror = function () { img.classList.remove("loaded"); if (fb) fb.style.display = ""; };
          img.src = src;
        }
      }

      // 六维
      var put = function (k, v) {
        var el = document.getElementById(P + k);
        if (el) el.textContent = (v == null || v === "") ? "--" : String(v);
      };
      var stats = s && s.stats;
      put("Atk", stats && stats.atk);
      put("Ma", stats && stats.ma);
      put("Def", stats && stats.def);
      put("Md", stats && stats.md);
      put("Spe", stats && stats.spe);
      put("HpRange", stats && stats.hp);

      var cur = null;
      try {
        var st = window.__lsState && window.__lsState();
        if (st && st[side] && st[side].hp != null) cur = st[side].hp;
      } catch (e) {}
      put("HpNow", cur != null && stats && stats.hp ? cur + " / " + stats.hp : (cur != null ? cur : null));

      // 技能卡
      var box = document.getElementById(P + "Skills");
      if (!box) return;
      box.innerHTML = "";
      var moves = [];
      try {
        var st2 = window.__lsState && window.__lsState();
        if (st2 && st2[side] && Array.isArray(st2[side].moves)) moves = st2[side].moves;
      } catch (e) {}
      if (!moves.length && pet && Array.isArray(pet.moves)) moves = pet.moves;

      moves.slice(0, 4).forEach(function (m) {
        var nm = (m && typeof m === "object") ? (m.n || m.name) : m;
        if (!nm) return;
        var dmg = (m && typeof m === "object") ? m.dmg : null;
        var el = document.createElement("div");
        el.className = "pd-skill";
        var html = "<b>" + nm + "</b>";
        if (dmg != null) html += "<em class='" + (dmg >= 200 ? "hot" : "") + "'>" + dmg + "</em>";
        el.innerHTML = html;
        box.appendChild(el);
      });
      if (!box.children.length) {
        box.innerHTML = "<div class='pd-skill'><b>暂无技能数据</b></div>";
      }
    }

    fill("mine");
    fill("foe");
  };

  // ---------- 截图识别结果接入（由原生「识」键推送） ----------
  window.__lsApplyScan = function (r) {
    if (!r) return;
    try {
      var minePct = (r.minePercent != null) ? Number(r.minePercent) : null;
      var foePct = (r.foePercent != null) ? Number(r.foePercent) : null;

      function setText(id, v) {
        var el = document.getElementById(id);
        if (el && v != null && v !== "") el.textContent = String(v);
      }
      // 名字
      function cleanName(v) {
        if (!v) return "";
        var s = String(v).replace(/\s+/g, "");
        if (s.length < 2 || s.length > 6) return "";
        if (/\d/.test(s)) return "";
        if (/伤害|获得|减伤|加成|能量|威力|应对|之后|自己/.test(s)) return "";
        return s;
      }
      var mineN = cleanName(r.mineName);
      var foeN = cleanName(r.foeName);
      if (mineN) setText("bubbleMineName", mineN);
      if (foeN) setText("bubbleFoeName", foeN);

      // 血量：既有百分比就写百分比
      if (minePct != null) {
        setText("chosenMine", "我方：" + (r.mineName || "") + " " + minePct + "%");
      }
      if (foePct != null) {
        setText("chosenFoe", "对手：" + (r.foeName || "") + " " + foePct + "%");
      }

      // 回合行：把血量拼进去
      var row = document.querySelector(".turn-row");
      if (row) {
        var bits = ["第 1 回合"];
        if (minePct != null) bits.push("我 " + minePct + "%");
        if (foePct != null) bits.push("敌 " + foePct + "%");
        if (r.mineHp != null && r.mineMax != null) bits.push("我HP " + r.mineHp + "/" + r.mineMax);
        if (r.foeHp != null && r.foeMax != null) bits.push("敌HP " + r.foeHp + "/" + r.foeMax);
        row.textContent = bits.join(" · ");
      }

      // 技能列表
      var sk = document.getElementById("chosenSkills") || document.querySelector("[data-role=skills]");
      if (sk && r.skills && r.skills.length) {
        sk.innerHTML = r.skills.map(function (n) {
          return "<span class='scan-skill'>" + n + "</span>";
        }).join("");
      }


      // ---------- 战报弹窗识别结果 ----------
      if (r.report && r.report.length) {
        var oldBox = document.getElementById("reportBox");
        if (oldBox) oldBox.remove();
        var box = document.createElement("div");
        box.id = "reportBox";
        box.className = "report-box";
        var head = document.createElement("div");
        head.className = "report-head";
        head.textContent = "战报识别 · " + r.report.length + " 个技能";
        box.appendChild(head);
        r.report.forEach(function (s) {
          var row = document.createElement("div");
          row.className = "report-row";
          var cat = s.category ? "<i class='rc'>" + s.category + "</i>" : "";
          var power = (s.power != null) ? "<b class='rp'>威力 " + s.power + "</b>" : "";
          var cost = (s.cost != null) ? "<b class='rcost'>耗能 " + s.cost + "</b>" : "";
          row.innerHTML = "<span class='rn'>" + s.name + "</span>" + cat + power + cost +
            (s.effect ? "<em class='re'>" + s.effect + "</em>" : "");
          box.appendChild(row);
        });
        var stage = document.getElementById("stage");
        if (stage) stage.appendChild(box);

        // 把战报技能填进「敌方技能」下拉（若有）
        try {
          var sel = document.getElementById("predFoeSkill");
          if (sel && r.report.length) {
            var n = r.report[0].name;
            for (var i = 0; i < sel.options.length; i++) {
              if (sel.options[i].value === n) { sel.selectedIndex = i; break; }
            }
          }
        } catch (e) {}
      }

      // 顶部提示
      var tip = document.getElementById("scanTip");
      if (!tip) {
        tip = document.createElement("div");
        tip.id = "scanTip";
        tip.className = "scan-tip";
        var stage = document.getElementById("stage");
        if (stage) stage.appendChild(tip);
      }
      tip.textContent = (r.report && r.report.length)
        ? "战报识别：" + r.report.map(function (s) { return s.name; }).join(" / ")
        : "已识图：" +
          (r.mineName || "我") + " " + (minePct != null ? minePct + "%" : "?") +
          " ／ " + (r.foeName || "敌") + " " + (foePct != null ? foePct + "%" : "?") +
          (r.skills && r.skills.length ? " · 技能 " + r.skills.length : "");
      tip.style.display = "block";
      clearTimeout(window.__scanTipTimer); window.__scanTipTimer = setTimeout(function () { if (tip) tip.style.display = "none"; }, 20000);

      // 缓存，deck 重新打开时还能恢复
      try { localStorage.setItem("luoke.scan.last", JSON.stringify(r)); } catch (e) {}
    } catch (e) {}
  };

  // deck 打开时若有历史识别结果，自动回填
  try {
    var cached = localStorage.getItem("luoke.scan.last");
    if (cached) setTimeout(function () { window.__lsApplyScan(JSON.parse(cached)); }, 400);
  } catch (e) {}


/* ---------- 顶部三个功能页：桌面/手机各自用原生窗口打开 ---------- */
(function () {
  var PAGES = {
    matrix: 'matrix.html',
    route: 'route.html',
    winrate: 'winrate.html'
  };

  var TITLES = { matrix: '对战矩阵', route: '对局路径', winrate: '胜率估计' };

  function openPage(name) {
    var file = PAGES[name];
    if (!file) return;
    var btn = document.querySelector('.bd-tbtn[data-duel="' + name + '"]');
    if (btn) {
      btn.classList.add('on');
      setTimeout(function () { btn.classList.remove('on'); }, 900);
    }
    showEmbedded(name, file);
  }

  /** 在悬浮框内部显示，不跳转网页 */
  function showEmbedded(name, file) {
    var wrap = document.getElementById('duelEmbed');
    var body = document.getElementById('deBody');
    var title = document.getElementById('deTitle');
    if (!wrap || !body) {
      window.open(file, '_blank');
      return;
    }
    if (title) title.textContent = TITLES[name] || name;
    body.src = file + '?embed=1&t=' + Date.now();
    wrap.hidden = false;
  }

  function hideEmbedded() {
    var wrap = document.getElementById('duelEmbed');
    var body = document.getElementById('deBody');
    if (!wrap) return;
    wrap.hidden = true;
    if (body) body.src = 'about:blank';
  }

  document.addEventListener('click', function (ev) {
    if (ev.target && ev.target.id === 'deClose') { hideEmbedded(); }
  }, true);

  window.__showDuelEmbedded = showEmbedded;
  window.__hideDuelEmbedded = hideEmbedded;

  window.__openDuelPage = openPage;

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    while (t && t !== document.body) {
      if (t.classList && t.classList.contains('bd-tbtn')) {
        ev.stopPropagation();
        openPage(t.getAttribute('data-duel'));
        return;
      }
      t = t.parentNode;
    }
  }, true);
})();
