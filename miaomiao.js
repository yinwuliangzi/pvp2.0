/* miaomiao.js · 「喵喵」对战助手
 * 形态：计算器页面里的对话助手
 * 大脑：内置数据 + 规则引擎（离线可用），可选接大模型
 */
(function () {
  "use strict";

  var PETS = window.PETS || [];
  var SKILLS = window.SKILLS || [];
  var TYPES = window.TYPES || {};

  /* ============ 基础查询 ============ */
  function petByName(n) {
    if (!n) return null;
    var q = String(n).trim();
    return PETS.filter(function (p) { return p.n === q; })[0] ||
           PETS.filter(function (p) { return p.n.indexOf(q) >= 0; })[0] || null;
  }
  function skByName(n) {
    if (!n) return null;
    var q = String(n).trim();
    return SKILLS.filter(function (s) { return s.n === q; })[0] ||
           SKILLS.filter(function (s) { return s.n.indexOf(q) >= 0; })[0] || null;
  }
  function typeMult(atkType, defPet) {
    var chart = TYPES[atkType];
    if (!chart || !defPet) return 1;
    var add = 0, half = 0;
    [defPet.el, defPet.el2].filter(Boolean).forEach(function (t) {
      if ((chart.strong || []).indexOf(t) >= 0) add += 1;
      if ((chart.resist || []).indexOf(t) >= 0) half += 1;
    });
    return (1 + add) * Math.pow(0.5, half);
  }
  function learnsetOf(n) {
    var m = window.LEARNSETS || {};
    return m[n] || null;
  }

  /* ============ 伤害估算（简化版，够回答"打不打得动"） ============ */
  function statOf(pet, key) {
    // 60 级、5 星、个体 10 的近似面板
    var base = Number(pet[key]) || 100;
    return Math.round(base * 1.6 + 60);
  }
  function estimateDamage(atk, def, sk) {
    if (!atk || !def || !sk || !sk.p) return 0;
    var isPhys = sk.t === "物攻";
    var A = isPhys ? statOf(atk, "atk") : statOf(atk, "ma");
    var D = isPhys ? statOf(def, "def") : statOf(def, "md");
    var stab = (sk.e === atk.el || sk.e === atk.el2) ? 1.2 : 1;
    var eff = typeMult(sk.e, def);
    // 官方简化公式：威力 × 攻/防 × 系数
    var raw = sk.p * (A / Math.max(1, D)) * 0.42 * stab * eff;
    return Math.max(1, Math.round(raw));
  }

  /* ============ 知识型回答 ============ */
  function introPet(pet) {
    var out = [];
    out.push("**" + pet.n + "**（" + [pet.el, pet.el2].filter(Boolean).join("/") + "系）");
    out.push("");
    out.push("面板（60 级 5 星满个体估算）：生命 " + statOf(pet, "hp") +
             " · 物攻 " + statOf(pet, "atk") + " · 物防 " + statOf(pet, "def") +
             " · 魔攻 " + statOf(pet, "ma") + " · 魔防 " + statOf(pet, "md") +
             " · 速度 " + statOf(pet, "spe"));

    // 种族值最高的三项
    var stats = [["生命", pet.hp], ["物攻", pet.atk], ["物防", pet.def], ["魔攻", pet.ma], ["魔防", pet.md], ["速度", pet.spe]];
    stats.sort(function (a, b) { return b[1] - a[1]; });
    var best = stats.slice(0, 2).map(function (s) { return s[0]; });
    var worst = stats[stats.length - 1];
    out.push("");
    out.push("**定位**：种族值最高的是 " + best.join("、") + "，最弱是 " + worst[0] + "（" + worst[1] + "）。");
    if (pet.spe >= 110) out.push("速度不错，可以先手压制。");
    else if (pet.spe <= 70) out.push("速度偏慢，建议走耐久或后手爆发。");

    if (pet.t) {
      out.push("");
      out.push("**特性 · " + pet.t + "**");
      out.push(pet.td || "（暂无描述）");
    }
    return out.join("\n");
  }

  function counterAnswer(pet) {
    // 谁打得动它 / 它打得动谁
    var weakTo = [], strongTo = [];
    Object.keys(TYPES).forEach(function (t) {
      var m = typeMult(t, pet);
      if (m > 1) weakTo.push(t + "（" + m + "倍）");
      else if (m < 1) strongTo.push(t + "（" + m.toFixed(2).replace(/\.?0+$/, "") + "倍）");
    });
    var out = [];
    out.push("**" + pet.n + " 的属性关系**");
    out.push("");
    out.push("弱点（打它加伤）：" + (weakTo.join("、") || "无"));
    out.push("抗性（打它减伤）：" + (strongTo.join("、") || "无"));
    out.push("");
    out.push("具体到精灵，用「对战矩阵」看 6v6 的对位回合差最准。");
    return out.join("\n");
  }

  function movesAnswer(pet) {
    var ls = learnsetOf(pet.n);
    var names = (ls && ls.s) ? ls.s.slice() : [];
    if (!names.length) return "精灵库里没有 **" + pet.n + "** 的可学招式记录。";
    var list = names.map(function (n) {
      var s = skByName(n);
      if (!s) return null;
      return { n: s.n, e: s.e, p: s.p || 0, c: s.c || 0, t: s.t };
    }).filter(Boolean);
    // 按"本系 + 威力/耗能比"排序推荐
    list.forEach(function (s) {
      var stab = (s.e === pet.el || s.e === pet.el2) ? 1.2 : 1;
      s.score = (s.p * stab) / Math.max(1, s.c || 1);
    });
    list.sort(function (a, b) { return b.score - a.score; });
    var top = list.slice(0, 4);
    var out = [];
    out.push("**" + pet.n + " 推荐配招**（按本系+威力耗能比排序）");
    out.push("");
    top.forEach(function (s, i) {
      out.push((i + 1) + ". **" + s.n + "** " + s.e + " · 威力 " + (s.p || "—") + " · 耗能 " + s.c);
    });
    out.push("");
    out.push("共 " + list.length + " 个可学招式。想指定某几个，告诉名字我再算伤害。");
    return out.join("\n");
  }

  function compareAnswer(a, b) {
    var out = [];
    out.push("**" + a.n + " vs " + b.n + "**");
    out.push("");
    var sa = skByName(learnsetOf(a.n) && learnsetOf(a.n).s ? learnsetOf(a.n).s[0] : "") || null;
    var movesA = (learnsetOf(a.n) ? (learnsetOf(a.n).s || []) : []).map(skByName).filter(Boolean);
    var movesB = (learnsetOf(b.n) ? (learnsetOf(b.n).s || []) : []).map(skByName).filter(Boolean);
    var bestA = movesA.sort(function (x, y) { return (y.p || 0) - (x.p || 0); })[0];
    var bestB = movesB.sort(function (x, y) { return (y.p || 0) - (x.p || 0); })[0];
    if (bestA) {
      var d1 = estimateDamage(a, b, bestA);
      out.push(a.n + " 用 **" + bestA.n + "**：" + d1 + " 伤害");
      var hpB = statOf(b, "hp");
      out.push("  → " + b.n + " 血量约 " + hpB + "，需要 **" + Math.ceil(hpB / d1) + " 下**");
    }
    if (bestB) {
      var d2 = estimateDamage(b, a, bestB);
      out.push("");
      out.push(b.n + " 用 **" + bestB.n + "**：" + d2 + " 伤害");
      var hpA = statOf(a, "hp");
      out.push("  → " + a.n + " 血量约 " + hpA + "，需要 **" + Math.ceil(hpA / d2) + " 下**");
    }
    var spA = statOf(a, "spe"), spB = statOf(b, "spe");
    out.push("");
    out.push("速度：" + a.n + " " + spA + " vs " + b.n + " " + spB + " → **" + (spA >= spB ? a.n : b.n) + " 先手**");
    out.push("");
    out.push("（这是按 60 级 5 星满个体的粗略估算，实际请用对战矩阵）");
    return out.join("\n");
  }

  /* ============ 自定义脚本（默认关闭） ============ */
  var SCRIPT_KEY = "luoke.miao.script";

  function scriptEnabled() {
    try { return localStorage.getItem(SCRIPT_KEY) === "1"; } catch (e) { return false; }
  }
  function setScriptEnabled(on) {
    try {
      if (on) localStorage.setItem(SCRIPT_KEY, "1");
      else localStorage.removeItem(SCRIPT_KEY);
    } catch (e) {}
  }

  /** 运行一段脚本。默认关闭；开启后每次执行都会先弹确认框 */
  function runScript(code) {
    if (!scriptEnabled()) {
      return "⚠️ 自定义脚本未开启。\n\n在面板右上角点「⚙」→ 打开「允许自定义脚本」，我会再问你一次才执行。";
    }
    var preview = String(code).trim();
    if (preview.length > 400) preview = preview.slice(0, 400) + "…";
    var ok = window.confirm(
      "喵喵要执行以下脚本：\n\n" + preview +
      "\n\n脚本能读取和修改页面上的任何数据。确定执行吗？"
    );
    if (!ok) return "已取消。";
    try {
      // 用户显式授权后才走 Function；这是唯一一处动态执行
      var fn = new Function("Miao", "MiaoBridge", "state", "PETS", "SKILLS", code);
      var ret = fn(window.Miao, window.MiaoBridge, (window.__lsState ? window.__lsState() : null), window.PETS, window.SKILLS);
      return "✅ 已执行\n返回值：" + (typeof ret === "undefined" ? "（无）" : JSON.stringify(ret).slice(0, 300));
    } catch (e) {
      return "❌ 执行出错：" + e.message;
    }
  }

  /* ============ 阵容感知与操作 ============ */
  function bridge() { return window.MiaoBridge || null; }

  function teamAnswer() {
    var b = bridge();
    if (!b) return "读不到计算器数据（MiaoBridge 未加载）。";
    var st = b.readState();
    function line(s, title) {
      var me = s.slots[s.active];
      var out = "**" + title + "**（当前 " + (me || "空") + "）\n";
      s.slots.forEach(function (n, i) {
        if (!n) return;
        out += (i === s.active ? "▶ " : "  ") + (i + 1) + ". " + n + "\n";
      });
      return out;
    }
    var t = line(st.mine, "我方") + "\n" + line(st.foe, "对方");
    t += "\n当前我方：" + (st.mine.pet || "空") + " 血量 " + st.mine.hp + " 能量 " + st.mine.energy;
    t += "\n已记录 " + st.turn + " 回合";
    return t;
  }

  function currentPetAnswer(which) {
    var b = bridge();
    if (!b) return "读不到计算器数据。";
    var st = b.readState();
    var s = which === "foe" ? st.foe : st.mine;
    if (!s.pet) return (which === "foe" ? "对方" : "我方") + "当前格子是空的。";
    var out = "**" + s.pet + "**（" + (which === "foe" ? "对方" : "我方") + "当前在场）\n";
    out += "血量 " + s.hp + " · 能量 " + s.energy + " · 魔力 " + s.mana + "\n";
    out += "等级 " + s.level + " 星级 " + s.star + (s.nature ? " 性格 " + s.nature : "") + "\n";
    out += "招式：" + (s.moves.filter(Boolean).join(" / ") || "（未配）");
    return out;
  }

  function doAction(text) {
    var b = bridge();
    if (!b) return null;

    // 换精灵：换第N个 → / 把第N个换成XXX
    var m1 = /(?:把)?第\s*(\d)\s*(?:个|格|只)?.*?(?:换成|改成|设为)\s*([^\s，,。]+)/.exec(text);
    if (m1) {
      var side1 = /对方|敌方|对面/.test(text) ? "foe" : "mine";
      var r = b.setPet(side1, Number(m1[1]) - 1, m1[2]);
      return r.msg;
    }
    // 给当前精灵配招
    var m2 = /(?:给|把)?.*?(?:配招|招式|技能)\s*(?:换成|改成|设为|为|是)\s*(.+)/.exec(text);
    if (m2) {
      var list = m2[1].split(/[、,，\s和跟]+/).filter(Boolean);
      var side2 = /对方|敌方|对面/.test(text) ? "foe" : "mine";
      var r2 = b.setMoves(side2, list);
      return r2.msg;
    }
    // 改数值
    var m3 = /(?:把)?\s*(?:我方|对方|敌方)?\s*(血量|血|能量|等级|星级|魔力)\s*(?:改成|设为|设为|=|到)\s*(\d+)/.exec(text);
    if (m3) {
      var map = { "血量": "hp", "血": "hp", "能量": "energy", "等级": "level", "星级": "star", "魔力": "mana" };
      var side3 = /对方|敌方|对面/.test(text) ? "foe" : "mine";
      var r3 = b.setNumeric(side3, map[m3[1]], Number(m3[2]));
      return r3.msg;
    }
    // 切换格子
    var m4 = /(?:切到|选中|换到)\s*第\s*(\d)\s*(?:个|格|只)/.exec(text);
    if (m4) {
      var r4 = b.switchSlot(/对方|敌方|对面/.test(text) ? "foe" : "mine", Number(m4[1]) - 1);
      return r4.msg;
    }
    if (/记录本回合|记一回合|记下这回合/.test(text)) return b.recordTurn().msg;
    if (/撤销|撤回|上一步/.test(text)) return b.undo().msg;
    return null;
  }

  /* ============ 意图识别 ============ */
  var INTENT = [
    { k: "compare", re: /(.+?)\s*(?:vs|VS|对|打|和)\s*(.+)/, fn: "compare" },
    { k: "moves", re: /(?:配招|招式|技能|带什么|怎么配|学什么)/, fn: "moves" },
    { k: "counter", re: /(?:弱点|克制|怕什么|抗性|什么系打)/, fn: "counter" },
    { k: "intro", re: /(?:是什么|介绍|怎么样|强吗|用处|评价)/, fn: "intro" }
  ];

  function extractPet(text) {
    // 1. 精确包含全名
    var hit = PETS.filter(function (p) { return text.indexOf(p.n) >= 0; });
    if (hit.length) {
      hit.sort(function (a, b) { return b.n.length - a.n.length; });
      return hit;
    }
    // 2. 简称：去掉常见前后缀后再匹配
    //    例如「翼王」→ 圣羽翼王；「火神」→ 烈火战神（若库里没有）
    var bare = String(text).replace(/(怎么|如何|配招|招式|技能|弱点|克制|怕什么|抗性|是什么|介绍|强吗| vs | VS | VS|VS)/g, " ").trim();
    var words = bare.split(/[\s，,。？?！!、]+/).filter(function (w) { return w.length >= 2 && w.length <= 8; });
    for (var wi = 0; wi < words.length; wi++) {
      var w = words[wi];
      var cands = PETS.filter(function (p) { return p.n.indexOf(w) >= 0; });
      if (cands.length) {
        // 取名字最短的（最接近简称）
        cands.sort(function (a, b) { return a.n.length - b.n.length; });
        return cands;
      }
    }
    return [];
  }

  function answerOffline(q) {
    var text = String(q || "").trim();
    if (!text) return "在的，问吧。";

    // 看阵容
    if (/(?:我|当前|现在).{0,4}(?:阵容|队伍|配的|带了)|阵容|双方|读一下/.test(text) && !/vs|配招|弱点/.test(text)) {
      return teamAnswer();
    }
    if (/(?:当前|现在|我这只|对面这只|对方这只).{0,6}(?:什么|谁|状态)|当前精灵/.test(text)) {
      return currentPetAnswer(/对面|对方|敌方/.test(text) ? "foe" : "mine");
    }

    // 自定义脚本：以 js: 或 > 开头
    var sm = /^(?:js:|>|运行)\s*([\s\S]+)$/.exec(text);
    if (sm) return runScript(sm[1]);

    // 执行操作
    var act = doAction(text);
    if (act) return "✅ " + act;

    // 打招呼
    if (/^(你好|hi|hello|哈喽|在吗)/i.test(text)) {
      return "喵～我是**喵喵**，你的洛克对战助手。\n\n" +
        "可以问我：\n" +
        "• **圣羽翼王强吗**\n" +
        "• **翼王怎么配招**\n" +
        "• **迪莫怕什么系**\n" +
        "• **迪莫 vs 焰火**";
    }

    // 对比
    var cmp = /(.+?)\s*(?:vs|VS|对打|打)\s*(.+)/.exec(text);
    if (cmp) {
      var ps = extractPet(text);
      if (ps.length >= 2) return compareAnswer(ps[0], ps[1]);
    }

    var pets = extractPet(text);
    if (!pets.length) {
      return "没认出是哪只精灵 :(\n\n" +
        "试试直接说名字，比如「**圣羽翼王 怎么配招**」。\n" +
        "（精灵库共 " + PETS.length + " 只，我按名字匹配）";
    }
    var pet = pets[0];

    if (/(?:配招|招式|技能|带什么|怎么配|学什么)/.test(text)) return movesAnswer(pet);
    if (/(?:弱点|克制|怕什么|抗性|什么系打)/.test(text)) return counterAnswer(pet);
    return introPet(pet);
  }

  /* ============ 在线（接大模型） ============ */
  function answerOnline(q, cfg) {
    // 把相关数据塞进上下文，让模型基于真实数据回答
    var pets = extractPet(String(q || ""));
    var ctx = pets.slice(0, 2).map(function (p) {
      var ls = learnsetOf(p.n);
      var pool = (ls && ls.s ? ls.s : []).map(function (n) {
        var s = skByName(n);
        return s ? (s.n + "(" + s.e + " 威力" + (s.p || 0) + " 耗能" + (s.c || 0) + ")") : null;
      }).filter(Boolean).slice(0, 30).join("、");
      return p.n + "｜" + [p.el, p.el2].filter(Boolean).join("/") + "系｜特性：" + (p.t || "无") + "｜" + (p.td || "") +
             "｜种族值：生命" + p.hp + " 物攻" + p.atk + " 物防" + p.def + " 魔攻" + p.ma + " 魔防" + p.md + " 速度" + p.spe +
             "｜可学招式：" + pool;
    }).join("\n");

    var sys = "你是「喵喵」，洛克王国 PVP 对战助手。只依据下面给出的数据回答，数据里没有就说不知道，不要编。回答用中文，简洁分点。\n\n" +
              "【相关精灵数据】\n" + (ctx || "（本次问题没有匹配到精灵）");

    return fetch(cfg.ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: q }
        ],
        temperature: 0.3,
        max_tokens: 600
      })
    }).then(function (r) {
      return r.text().then(function (t) { return { ok: r.ok, status: r.status, t: t }; });
    }).then(function (res) {
      if (!res.ok) {
        var j = null; try { j = JSON.parse(res.t); } catch (e) {}
        var em = (j && j.error && j.error.message) || res.t.slice(0, 150);
        throw new Error("HTTP " + res.status + "：" + em);
      }
      var j2 = JSON.parse(res.t);
      var c2 = (((j2.choices || [])[0] || {}).message || {}).content || "";
      return c2 || "（模型没有返回内容）";
    });
  }

  /* ============ 界面 ============ */
  var box = null, listEl = null, inputEl = null, mode = "offline", cfg = null;

  function mdToHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>");
  }

  function pushMsg(who, text) {
    if (!listEl) return;
    var row = document.createElement("div");
    row.className = "mm-row " + (who === "me" ? "me" : "bot");
    row.innerHTML =
      '<div class="mm-mini">' + (who === "me" ? "我" : "🐱") + "</div>" +
      '<div class="mm-msg ' + (who === "me" ? "me" : "bot") + '">' + mdToHtml(text) + "</div>";
    listEl.appendChild(row);
    scrollBottom();
    return row;
  }

  function scrollBottom() {
    if (!listEl) return;
    listEl.scrollTop = listEl.scrollHeight;
  }

  /** 打字指示器：返回一个移除函数 */
  function showTyping() {
    if (!listEl) return function () {};
    var row = document.createElement("div");
    row.className = "mm-row bot";
    row.innerHTML = '<div class="mm-mini">🐱</div>' +
      '<div class="mm-typing"><i></i><i></i><i></i></div>';
    listEl.appendChild(row);
    scrollBottom();
    return function () { if (row.parentNode) row.parentNode.removeChild(row); };
  }

  function build() {
    if (box) return;
    box = document.createElement("div");
    box.id = "miaomiao";
    box.innerHTML =
      // 头部
      '<div class="mm-head">' +
        '<div class="mm-avatar">🐱</div>' +
        '<div class="mm-id">' +
          '<div class="mm-title">喵喵</div>' +
          '<div class="mm-sub"><i class="mm-live" id="mmLive"></i><span id="mmMode">离线·内置数据</span></div>' +
        '</div>' +
        '<div class="mm-acts">' +
          '<button type="button" class="mm-ib" id="mmClear" title="清空对话">🗑</button>' +
          '<button type="button" class="mm-ib" id="mmGear" title="设置">⚙</button>' +
          '<button type="button" class="mm-ib" id="mmClose" title="关闭">✕</button>' +
        '</div>' +
      '</div>' +
      // 设置
      '<div class="mm-set" id="mmSet" hidden>' +
        '<label><input type="checkbox" id="mmScriptChk"> 允许自定义脚本（js: 开头）</label>' +
        '<div class="mm-warn">开启后，以 js: 开头的命令会真的在页面里运行，能读写任何数据。每次执行前还会再确认一次。</div>' +
      '</div>' +
      // 消息
      '<div class="mm-list" id="mmList"></div>' +
      // 快捷问句
      '<div class="mm-chips" id="mmChips"></div>' +
      // 输入
      '<div class="mm-foot">' +
        '<div class="mm-inputwrap">' +
          '<textarea id="mmInput" rows="1" placeholder="问点什么… 例如「翼王怎么配招」"></textarea>' +
        '</div>' +
        '<button type="button" id="mmSend" title="发送">➤</button>' +
      '</div>' +
      '<div class="mm-tip">离线用内置数据回答 · 配了 API Key 可切联网</div>';
    document.body.appendChild(box);

    listEl = box.querySelector("#mmList");
    inputEl = box.querySelector("#mmInput");

    // 关闭
    box.querySelector("#mmClose").onclick = function () {
      box.style.display = "none";
      var fab = document.getElementById("mmFab");
      if (fab) fab.style.display = "";
    };
    // 清空
    box.querySelector("#mmClear").onclick = function () {
      listEl.innerHTML = "";
      pushMsg("bot", GREETING);
      showChips();
    };

    // 设置
    var setBox = box.querySelector("#mmSet");
    var chk = box.querySelector("#mmScriptChk");
    chk.checked = scriptEnabled();
    chk.onchange = function () {
      if (chk.checked) {
        var ok = window.confirm("开启自定义脚本后，发 js: 开头的命令会真的执行页面代码。\n攻击者拿到这个页面就能读你的所有数据。\n\n确定开启吗？");
        if (!ok) { chk.checked = false; return; }
        setScriptEnabled(true);
      } else {
        setScriptEnabled(false);
      }
    };
    box.querySelector("#mmGear").onclick = function () {
      setBox.hidden = !setBox.hidden;
    };

    // 发送
    box.querySelector("#mmSend").onclick = send;
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    // 输入框自动长高
    inputEl.addEventListener("input", function () {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(88, inputEl.scrollHeight) + "px";
    });

    pushMsg("bot", GREETING);
    showChips();
  }

  var GREETING = "喵～我是**喵喵**，你的洛克对战助手。\n\n" +
    "能算伤害、查属性、配招式，也能直接帮你改阵容。";

  var CHIPS = [
    "我的阵容",
    "翼王怎么配招",
    "迪莫怕什么系",
    "圣羽翼王 vs 迪莫"
  ];

  function showChips() {
    var wrap = box && box.querySelector("#mmChips");
    if (!wrap) return;
    wrap.innerHTML = CHIPS.map(function (t) {
      return "<button type='button' class='mm-chip' data-q='" + t + "'>" + t + "</button>";
    }).join("");
    Array.prototype.forEach.call(wrap.querySelectorAll(".mm-chip"), function (b) {
      b.onclick = function () {
        inputEl.value = b.getAttribute("data-q");
        send();
      };
    });
  }

  function hideChips() {
    var wrap = box && box.querySelector("#mmChips");
    if (wrap) wrap.innerHTML = "";
  }

  var busy = false;

  function send() {
    if (busy) return;
    var q = (inputEl.value || "").trim();
    if (!q) return;
    inputEl.value = "";
    inputEl.style.height = "auto";
    hideChips();
    pushMsg("me", q);

    var tryOnline = mode === "online" && cfg && cfg.ep && cfg.key && cfg.model;

    if (!tryOnline) {
      busy = true;
      var stop = showTyping();
      var btn = box.querySelector("#mmSend");
      if (btn) btn.disabled = true;
      setTimeout(function () {
        stop();
        pushMsg("bot", answerOffline(q));
        if (btn) btn.disabled = false;
        busy = false;
      }, 260 + Math.random() * 200);
      return;
    }

    busy = true;
    var stop2 = showTyping();
    var btn2 = box.querySelector("#mmSend");
    if (btn2) btn2.disabled = true;
    answerOnline(q, cfg).then(function (txt) {
      stop2();
      pushMsg("bot", txt);
    }).catch(function (e) {
      stop2();
      pushMsg("bot", "（联网回答失败：" + e.message + "）\n已用离线引擎回答：\n\n" + answerOffline(q));
    }).then(function () {
      if (btn2) btn2.disabled = false;
      busy = false;
    });
  }

  /** 浮动入口按钮 */
  function ensureFab() {
    if (document.getElementById("mmFab")) return;
    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "mm-fab";
    fab.id = "mmFab";
    fab.title = "喵喵 · 对战助手";
    fab.innerHTML = "🐱";
    fab.onclick = function () { open({}); };
    document.body.appendChild(fab);
  }

  function open(opts) {
    build();
    box.style.display = "flex";
    var fab = document.getElementById("mmFab");
    if (fab) fab.style.display = "none";
    setTimeout(function () { if (inputEl) inputEl.focus(); }, 60);
    if (opts && opts.mode) setMode(opts.mode, opts.cfg);
    scrollBottom();
  }

  function close() {
    if (box) box.style.display = "none";
    var fab = document.getElementById("mmFab");
    if (fab) fab.style.display = "";
  }

  function setMode(m, c) {
    mode = m === "online" ? "online" : "offline";
    if (c) cfg = c;
    var el = document.getElementById("mmMode");
    if (el) el.textContent = mode === "online" ? "联网·大模型" : "离线·内置数据";
    var dot = document.getElementById("mmLive");
    if (dot) dot.className = "mm-live" + (mode === "online" ? "" : " off");
  }

  window.Miao = {
    open: open,
    close: close,
    toggle: toggle,
    ask: answerOffline,
    setMode: setMode,
    pets: function () { return PETS.length; }
  };

  // ESC 关闭
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && box && box.style.display === "flex") close();
  });

  /** 开关切换 */
  function toggle(opts) {
    if (box && box.style.display === "flex") { close(); return false; }
    open(opts || {});
    return true;
  }

  // 页面加载完挂上浮动入口
  function boot() {
    try { ensureFab(); } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
