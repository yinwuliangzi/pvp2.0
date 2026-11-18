/* miaomiao.js · 「喵喵」对战助手
 * 形态：计算器页面里的对话助手
 * 大脑：内置数据 + 规则引擎（离线可用），可选接大模型
 */
(function () {
  "use strict";

  var PETS = window.__ALL_PETS || window.PETS || [];
  var SKILLS = window.__ALL_SKILLS || window.SKILLS || [];
  var TYPES = window.TYPES || {};

  /** 每次回答前刷新数据源，避免拿到 calc.js 合并前的旧列表 */
  function refreshData() {
    if (window.__ALL_PETS && window.__ALL_PETS.length) PETS = window.__ALL_PETS;
    else if (window.PETS && window.PETS.length) PETS = window.PETS;
    if (window.__ALL_SKILLS && window.__ALL_SKILLS.length) SKILLS = window.__ALL_SKILLS;
    else if (window.SKILLS && window.SKILLS.length) SKILLS = window.SKILLS;
    if (window.TYPES) TYPES = window.TYPES;
  }

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

  /** 定位与配队建议（读完能知道这只该怎么用、配什么队友） */
  function adviceAnswer(pet) {
    var stats = [["生命", pet.hp], ["物攻", pet.atk], ["物防", pet.def], ["魔攻", pet.ma], ["魔防", pet.md], ["速度", pet.spe]];
    var sorted = stats.slice().sort(function (a, b) { return b[1] - a[1]; });
    var worst = sorted[sorted.length - 1];
    var els = [pet.el, pet.el2].filter(Boolean);

    var out = "## " + pet.n + " 定位（从种族值看）\n\n";
    sorted.forEach(function (s) {
      var n = s[0], v = s[1];
      if (n === "速度" && v >= 110) out += "- **速度 " + v + "**：队里偏快，基本能先手\n";
      else if (n === "速度" && v <= 70) out += "- **速度 " + v + "**：偏慢，别指望先手\n";
      else if (n === "魔防" && v <= 85) out += "- **魔防 " + v + "**：明显短板，遇到特攻手很脆\n";
      else if (n === "物防" && v <= 85) out += "- **物防 " + v + "**：明显短板，怕物攻手\n";
      else if ((n === "物攻" || n === "魔攻") && v >= 120) out += "- **" + n + " " + v + "**：主力输出方向\n";
      else if (n === "生命" && v >= 120) out += "- **生命 " + v + "**：血厚，能多吃几下\n";
    });

    if (pet.t) {
      out += "- **特性「" + pet.t + "」**：" + (pet.td || "（无描述）") + "\n";
    }

    // 弱点
    var weak = Object.keys(TYPES).filter(function (t) { return typeMult(t, pet) > 1; });
    var strong = Object.keys(TYPES).filter(function (t) { return typeMult(t, pet) < 1; });
    out += "\n## 配队思路\n\n";
    out += "1. **补短板队友**：" + worst[0] + " 只有 " + worst[1] + "，是全队最弱项，" +
      "队里要有能替它挡住的精灵。\n";
    out += "2. **补克制位**：它怕 " + (weak.slice(0, 4).join("、") || "无明显弱点") +
      "，队里最好有人能压制这几类，否则被针对就很难打。\n";
    if (strong.length) {
      out += "3. **它克制的**：" + strong.slice(0, 4).join("、") + "，可以主动找这些对手开打。\n";
    }
    var role = pet.spe >= 110 ? "先手抢节奏，适合当先发或收尾补刀" :
               pet.hp >= 120 ? "血厚耐打，适合当中转站" : "看阵容搭配，适合补位";
    out += (strong.length ? "4" : "3") + ". **定位**：" + role + "。\n";

    out += "\n想问具体配招、或者它和某只谁强，接着说就行。";
    return out;
  }

  function movesAnswer(pet) {
    var ls = learnsetOf(pet.n);
    var names = (ls && ls.s) ? ls.s.slice() : [];
    if (!names.length) {
      // 没有官方招式表 → 按属性推测（与计算器一致）
      var pool = SKILLS.filter(function (s) {
        return s.e === pet.el || s.e === pet.el2;
      }).filter(function (s) { return s.t !== "状态" && Number(s.p) > 0; });
      pool.sort(function (a, b) { return (Number(b.p) || 0) - (Number(a.p) || 0); });
      if (!pool.length) return "**" + pet.n + "** 没有可学招式记录，也没有同属性技能可推测。";
      var out = "**" + pet.n + "**（" + [pet.el, pet.el2].filter(Boolean).join("/") + "系）没有官方招式表，" +
                "下面四招是**按属性推测**的，仅供参考：\n\n";
      pool.slice(0, 4).forEach(function (s, i) {
        out += (i + 1) + ". **" + s.n + "** " + s.e + " · 威力 " + (s.p || "—") + " · 耗能 " + (s.c || 0) + "\n";
      });
      out += "\n实际配招要看它实际能学什么，建议在游戏里确认。";
      return out;
    }
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
      var rd1 = realDamage("mine", bestA.n);
      var d1 = (rd1 && rd1.ok) ? rd1.dmg : estimateDamage(a, b, bestA);
      out.push(a.n + " 用 **" + bestA.n + "**：" + d1 + " 伤害");
      var hpB = statOf(b, "hp");
      out.push("  → " + b.n + " 血量约 " + hpB + "，需要 **" + Math.ceil(hpB / d1) + " 下**");
    }
    if (bestB) {
      var rd2 = realDamage("foe", bestB.n);
      var d2 = (rd2 && rd2.ok) ? rd2.dmg : estimateDamage(b, a, bestB);
      out.push("");
      out.push(b.n + " 用 **" + bestB.n + "**：" + d2 + " 伤害");
      var hpA = statOf(a, "hp");
      out.push("  → " + a.n + " 血量约 " + hpA + "，需要 **" + Math.ceil(hpA / d2) + " 下**");
    }
    var spA = statOf(a, "spe"), spB = statOf(b, "spe");
    out.push("");
    out.push("速度：" + a.n + " " + spA + " vs " + b.n + " " + spB + " → **" + (spA >= spB ? a.n : b.n) + " 先手**");
    out.push("");
    out.push(rd1 && rd1.ok ? "（伤害来自计算器完整引擎，含特性/印记/天气）" : "（这是按 60 级 5 星满个体的粗略估算，实际请用对战矩阵）");
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

  /* ============ 计算器知识库 ============ */
  // 让喵喵知道这个工具怎么用、怎么算、有什么限制
  var KB = {
    about: "洛克王国 PVP 对战助手是一个本地工具：配好双方阵容后，能算伤害、看对位、推演全局、估胜率。所有数据存在浏览器本地，不上传。",
    workflow: [
      "① 在「对战计算器」配好双方精灵（属性、血脉、特性、4 个招式、等级星级个体）",
      "② 点顶部「对战矩阵」看 6x6 对位：谁打谁几个回合、谁先手、哪些是必输局",
      "③ 点「对局路径」看整套阵容怎么打到收尾，它会给换人建议",
      "④ 点「胜率估计」把当前局面压成 7 个特征，估个胜率",
      "⑤ 实战时按「对战」页逐回合记录，边打边看伤害和能量"
    ],
    formulas: {
      damage: "伤害 = 威力 × (攻/防) × 0.42 × 本系1.2 × 克制倍率，再叠加特性、印记、天气、道具",
      speed: "速度高者先手；同速随机；迅捷技能无视速度",
      energy: "每回合结束回 2 能量，上限 10；能量不够时该招自动变聚能",
      ko: "击杀需要的回合数 = ceil(对方血量 / 单次伤害)",
      rounds: "对位回合差 = 对方击杀我需要的回合 − 我击杀对方需要的回合，正数代表我占优"
    },
    notes: [
      "克制是叠乘的：双属性可能吃到 2 倍甚至更高",
      "特性按官方描述自动解析，判断不了的会标注「未计入」，不会静默忽略",
      "没有官方招式表的精灵，会按属性推测 4 招，界面会标注「推测」",
      "截图识别需要你自己的 API Key，只存在本机"
    ],
    limits: [
      "伤害按公式估算，实际游戏可能有随机浮动",
      "部分特性机制复杂（比如需要在特定回合触发），计算器会标注未计入",
      "对方阵容是你自己填的，不是真实对手"
    ]
  };

  function kbAnswer(text) {
    var t = String(text || "");
    if (/(怎么用|如何使用|怎么开始|新手|上手指南|流程)/.test(t)) {
      return "**这个计算器怎么用**\n\n" + KB.workflow.join("\n") + "\n\n" + KB.about;
    }
    if (/(公式|怎么算|伤害怎么|原理|计算方式)/.test(t)) {
      var f = KB.formulas;
      return "**核心计算逻辑**\n\n" +
        "• 伤害：" + f.damage + "\n" +
        "• 速度：" + f.speed + "\n" +
        "• 能量：" + f.energy + "\n" +
        "• 击杀回合：" + f.ko + "\n" +
        "• 对位回合差：" + f.rounds;
    }
    if (/(有什么功能|能做什么|有哪些|功能列表)/.test(t)) {
      var b = bridge();
      if (!b || !b.features) return "功能列表暂时读不到，你可以看顶部那排按钮。";
      var fe = b.features();
      var out = "**计算器能做的事**\n\n";
      out += "三个视图：\n" + fe.views.map(function (v) { return "• " + v.name + " — " + v.desc; }).join("\n");
      out += "\n\n主要按钮：\n" + fe.buttons.map(function (x) { return "• " + x.name + " — " + x.desc; }).join("\n");
      out += "\n\n其他页面：\n" + fe.pages.map(function (x) { return "• " + x.name + " — " + x.desc; }).join("\n");
      return out;
    }
    if (/(局限|不准|准吗|准不准|准确|误差|为什么和游戏|靠谱|可信)/.test(t)) {
      return "**这个工具的边界**\n\n" + KB.limits.map(function (x) { return "• " + x; }).join("\n") +
        "\n\n" + KB.notes.map(function (x) { return "• " + x; }).join("\n");
    }
    return null;
  }

  /** 用真实引擎算伤害 */
  function realDamage(side, skillName) {
    var b = bridge();
    if (!b || !b.damage) return null;
    return b.damage(side, skillName);
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
    refreshData();
    var text = String(q || "").trim();
    if (!text) return "在的，问吧。";

    // 先看是不是在问「工具本身」
    var kb = kbAnswer(text);
    if (kb) return kb;

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

    // 追问（然后呢/继续/还有呢）：沿用上次聊到的精灵
    var isFollowUp = /^(然后呢|然后|继续|还有呢|还有吗|接着说|详细点|展开|再多说|再讲讲)[呢吗？?。]*$/.test(text) ||
                     /^(然后呢|继续)[，,]?/.test(text);
    if (!pets.length && isFollowUp && lastPet) pets = [lastPet];

    if (!pets.length) {
      // 兜底：用当前正在编辑的那只精灵
      var b = bridge();
      if (b && b.readState) {
        try {
          var st = b.readState();
          if (st.mine && st.mine.pet) {
            var cur = PETS.filter(function (x) { return x.n === st.mine.pet; })[0];
            if (cur) {
              pets = [cur];
            }
          }
        } catch (e) {}
      }
    }

    if (!pets.length) {
      return "没认出是哪只精灵 :(\n\n" +
        "你可以：\n" +
        "• 直接说名字，比如「**圣羽翼王 怎么配招**」\n" +
        "• 或者什么都不说，我先分析你现在正在编辑的那只\n\n" +
        "（精灵库共 " + PETS.length + " 只，我按名字匹配）";
    }
    var pet = pets[0];
    lastPet = pet;   // 记住这次聊的是谁

    // 配队 / 阵容搭配（优先于配招）
    if (/(?:配队|队伍|组队|阵容|队友|搭配|定位|怎么用这只)/.test(text)) return adviceAnswer(pet);
    // 追问 → 给定位与配队建议
    if (/^(然后呢|然后|继续|还有呢|还有吗|接着说|详细点|展开|再多说|再讲讲)[呢吗？?。]*$/.test(text)) {
      return adviceAnswer(pet);
    }
    if (/(?:配招|招式|技能|带什么|学什么)/.test(text)) return movesAnswer(pet);
    if (/(?:弱点|克制|怕什么|抗性|什么系打)/.test(text)) return counterAnswer(pet);
    return adviceAnswer(pet);
  }

  /* ============ 在线（接大模型） ============ */
  function answerOnline(q, cfg, onDelta, onTrace) {
    refreshData();
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

    // 把计算器的知识也交给模型
    var kbText = "【这个工具是什么】" + KB.about +
      "\n\n【使用流程】\n" + KB.workflow.join("\n") +
      "\n\n【计算逻辑】\n" +
      "伤害：" + KB.formulas.damage + "\n" +
      "速度：" + KB.formulas.speed + "\n" +
      "能量：" + KB.formulas.energy + "\n" +
      "击杀回合：" + KB.formulas.ko + "\n" +
      "对位回合差：" + KB.formulas.rounds +
      "\n\n【注意事项】\n" + KB.notes.concat(KB.limits).map(function (x) { return "• " + x; }).join("\n");

    var sys = [
      "你是「喵喵」，一个对战计算器的操作型助手。你不是聊天机器人，是个会动手的执行者。",
      "",
      "【最重要的一条】只要你需要数字、名单、属性、回合数，就必须先调用工具去算，不许凭记忆回答。",
      "工具已经接在真实计算器上：算伤害、查精灵、筛队友、读阵容、改配置，都是真实数据。",
      "",
      "【怎么回答】",
      "1. 先判断需要什么数据 → 调工具拿到 → 再回答。一轮可以调多个工具。",
      "2. 回答直接给结论和数字。禁止客套话（「好的」「让我来帮你」「希望对你有帮助」这类一律不要）。",
      "3. 不要复述工具返回的原始 JSON，把它翻译成人话和数字。",
      "4. 用户让你改配置（换精灵、改配招、改血量）就直接调用对应工具真的改掉，然后告诉他改成了什么。",
      "5. 数据里没有的就说没有，别编。",
      "",
      "【格式】",
      "- 用 Markdown：小标题、短句、要点列表",
      "- 数字带单位（回合、点、%）",
      "- 一般不超过 300 字，除非用户要详细分析",
      "",
      "【这是什么工具】" + KB.about,
      "【使用流程】\n" + KB.workflow.join("\n"),
      "【计算逻辑】伤害：" + KB.formulas.damage + "；速度：" + KB.formulas.speed +
        "；能量：" + KB.formulas.energy + "；击杀回合：" + KB.formulas.ko,
      "【已知边界】" + KB.limits.join("；")
    ].join("\n") + "\n\n" +
      kbText + "\n\n" +
      liveState() + "\n\n" +
      "【本次问题相关的精灵数据】\n" + (ctx || "（本次问题没有匹配到精灵）") +
      "\n\n注意：如果用户说「然后呢」「继续」这类追问，请接着上一轮的内容往下讲，" +
      "不要说自己没接到上文；如果上轮在讲某只精灵，就继续讲它的配队/打法。" +
      "如果用户问的和上面配置有关，直接用【用户当前在计算器里的配置】里的信息。";

    // 带上最近几轮对话，让「然后呢」这种追问有上下文
    var msgs = [{ role: "system", content: sys }]
      .concat(conv.slice(-MAX_TURNS * 2 - 1, -1))
      .concat([{ role: "user", content: q }]);

    // 先走「带工具的对话循环」；模型不需要工具时会直接回答
    return chatWithTools(msgs, cfg, onDelta, 0, onTrace);
  }

  /** 带工具调用的对话循环，最多循环 4 轮 */
  function chatWithTools(msgs, cfg, onDelta, depth, onTrace) {
    var MAX_LOOP = 4;
    return fetch(cfg.ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({
        model: cfg.model,
        messages: msgs,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 4000
      })
    }).then(function (r) {
      return r.text().then(function (t) { return { ok: r.ok, status: r.status, t: t }; });
    }).then(function (res) {
      if (!res.ok) {
        var j = null; try { j = JSON.parse(res.t); } catch (e) {}
        // 不支持工具调用的模型 → 退回普通对话
        if (/tool|function|tools/i.test(String((j && j.error && j.error.message) || res.t))) {
          return plainChat(msgs, cfg, onDelta);
        }
        var em = (j && j.error && j.error.message) || res.t.slice(0, 150);
        throw new Error("HTTP " + res.status + "：" + em);
      }
      var j2 = {};
      try { j2 = JSON.parse(res.t); } catch (e) {}
      if (j2.error) throw new Error("接口报错：" + (j2.error.message || "未知"));

      var choice = (j2.choices || [])[0] || {};
      var msg = choice.message || {};
      var calls = msg.tool_calls || [];

      // 没有工具调用 → 直接是答案
      if (!calls.length) {
        var txt = String(msg.content || "").trim();
        if (!txt) {
          if (depth < MAX_LOOP) {
            return chatWithTools(msgs.concat([
              { role: "assistant", content: msg.content || "" },
              { role: "user", content: "请直接给出完整回答。" }
            ]), cfg, onDelta, depth + 1, onTrace);
          }
          throw new Error("模型返回空内容");
        }
        if (typeof onDelta === "function") onDelta(txt, txt);
        return txt;
      }

      // 执行所有工具调用
      var toolMsgs = [{ role: "assistant", content: msg.content || "", tool_calls: calls }];
      calls.forEach(function (c) {
        var fn = (c.function || {});
        var args = {};
        try { args = JSON.parse(fn.arguments || "{}"); } catch (e) {}
        var result;
        try { result = runTool(fn.name, args); }
        catch (e) { result = { error: e.message }; }
        if (typeof onTrace === "function") {
          onTrace(toolTrace(fn.name, args, result));
        }
        toolMsgs.push({
          role: "tool",
          tool_call_id: c.id,
          content: JSON.stringify(result).slice(0, 6000)
        });
      });

      if (depth >= MAX_LOOP) {
        var fallbackTxt = "（已调用 " + calls.length + " 次工具，达到上限）\n\n" + JSON.stringify(runTool((calls[0].function || {}).name, {})).slice(0, 500);
        return fallbackTxt;
      }

      // 把工具结果交回模型，让它基于真实数据回答
      return chatWithTools(msgs.concat(toolMsgs), cfg, onDelta, depth + 1, onTrace);
    });
  }

  /** 不支持工具的模型：普通对话 */
  function plainChat(msgs, cfg, onDelta) {
    var stream = typeof onDelta === "function";
    var body = {
      model: cfg.model,
      messages: msgs,
      temperature: 0.3,
      max_tokens: 4000
    };
    if (stream) body.stream = true;

    return fetch(cfg.ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          var em = (j && j.error && j.error.message) || t.slice(0, 150);
          throw new Error("HTTP " + r.status + "：" + em);
        });
      }
      // 不支持流式就退回整体读取
      if (!stream || !r.body || !r.body.getReader) {
        return r.text().then(function (t) {
          var j2 = {};
          try { j2 = JSON.parse(t); } catch (e) {}
          if (j2.error) throw new Error("接口报错：" + (j2.error.message || "未知"));
          var msg = ((j2.choices || [])[0] || {}).message || {};
          var c2 = msg.content || "";
          var reason = ((j2.choices || [])[0] || {}).finish_reason || "";
          if (!c2) {
            throw new Error("模型返回空。finish_reason=" + (reason || "无") +
              (msg.reasoning_content ? "（只返回了思考内容，可能 max_tokens 太小）" : "") +
              " 原始：" + t.slice(0, 200));
          }
          return c2;
        });
      }
      return readStream(r.body, onDelta).then(function (res) {
        // 被长度截断 → 自动续写
        if (!res.truncated) return res.text;
        return continueAnswer(msgs, res.text, cfg, onDelta, 0);
      }).catch(function (err) {
        // 流式没拿到正文 → 用非流式再试一次
        return fetch(cfg.ep, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
          body: JSON.stringify({
            model: cfg.model,
            messages: msgs,
            temperature: 0.3,
            max_tokens: 4000
          })
        }).then(function (r2) {
          return r2.text().then(function (t) {
            var j = {};
            try { j = JSON.parse(t); } catch (e) {}
            if (j.error) throw new Error("接口报错：" + (j.error.message || "未知"));
            var msg = ((j.choices || [])[0] || {}).message || {};
            var c2 = String(msg.content || "").trim();
            if (!c2) {
              var fr = ((j.choices || [])[0] || {}).finish_reason || "";
              throw new Error("模型只返回了思考过程，没有正文（finish_reason=" + (fr || "无") +
                "）。可能是这个模型不适合直接对话，建议换 deepseek-chat");
            }
            onDelta(c2, c2);
            return c2;
          });
        });
      });
    });
  }

  /* ============ 界面 ============ */
  var box = null, listEl = null, inputEl = null, mode = "offline", cfg = null;
  var conv = [];           // 对话历史 {role, content}
  var lastPet = null;      // 上次聊到的精灵，用于「然后呢」这类追问
  var MAX_TURNS = 12;      // 最多保留 12 轮

  /** 把 Markdown 渲染成 HTML：标题、列表、粗体、代码、分隔线 */
  function mdToHtml(src) {
    var s = String(src == null ? "" : src);

    // 先保护代码块与行内代码
    var codes = [];
    s = s.replace(/```([\s\S]*?)```/g, function (m, code) {
      codes.push('<pre class="mm-pre"><code>' + esc(code.replace(/^\n|\n$/g, "")) + "</code></pre>");
      return "\u0000CODE" + (codes.length - 1) + "\u0000";
    });
    var inlines = [];
    s = s.replace(/`([^`\n]+)`/g, function (m, code) {
      inlines.push("<code>" + esc(code) + "</code>");
      return "\u0000IC" + (inlines.length - 1) + "\u0000";
    });

    // 转义 HTML
    s = esc(s);

    // 粗体 / 斜体
    s = s.replace(/\*\*([^*]+?)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<i>$2</i>");

    // 按行处理块级元素
    var lines = s.split("\n");
    var out = [], listType = null, para = [];

    function flushPara() {
      if (!para.length) return;
      out.push("<p>" + para.join("<br>") + "</p>");
      para = [];
    }
    function closeList() {
      if (listType) { out.push("</" + listType + ">"); listType = null; }
    }

    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var t = ln.trim();

      if (!t) { flushPara(); closeList(); continue; }

      // 分隔线
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
        flushPara(); closeList(); out.push("<hr class='mm-hr'>"); continue;
      }
      // 标题
      var h = /^(#{1,4})\s+(.*)$/.exec(t);
      if (h) {
        flushPara(); closeList();
        var lv = Math.min(4, h[1].length + 2);   // ## → h4 之类，视觉上不过大
        out.push("<h" + lv + " class='mm-h'>" + h[2] + "</h" + lv + ">");
        continue;
      }
      // 无序列表
      var ul = /^[-*•]\s+(.*)$/.exec(t);
      if (ul) {
        flushPara();
        if (listType !== "ul") { closeList(); out.push("<ul class='mm-ul'>"); listType = "ul"; }
        out.push("<li>" + ul[1] + "</li>");
        continue;
      }
      // 有序列表
      var ol = /^(\d+)[.、)]\s+(.*)$/.exec(t);
      if (ol) {
        flushPara();
        if (listType !== "ol") { closeList(); out.push("<ol class='mm-ol'>"); listType = "ol"; }
        out.push("<li>" + ol[2] + "</li>");
        continue;
      }
      // 引用
      var q = /^>\s?(.*)$/.exec(t);
      if (q) {
        flushPara(); closeList();
        out.push("<blockquote class='mm-quote'>" + q[1] + "</blockquote>");
        continue;
      }
      // 普通段落
      closeList();
      para.push(t);
    }
    flushPara();
    closeList();

    var html = out.join("");
    // 还原代码占位
    html = html.replace(/\u0000CODE(\d+)\u0000/g, function (m, i) { return codes[Number(i)]; });
    html = html.replace(/\u0000IC(\d+)\u0000/g, function (m, i) { return inlines[Number(i)]; });
    return html;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function pushMsg(who, text) {
    if (!listEl) return;
    var row = document.createElement("div");
    row.className = "mm-row " + (who === "me" ? "me" : "bot");
    row.innerHTML =
      '<div class="mm-mini">' + (who === "me" ? "我" : '<img src="icons/miaomiao-avatar.png" alt="">') + "</div>" +
      '<div class="mm-msg ' + (who === "me" ? "me" : "bot") + '">' + mdToHtml(text) + "</div>";
    listEl.appendChild(row);
    scrollBottom();
    return row;
  }

  var CONV_KEY = "luoke.miao.conv";

  function saveConv() {
    try {
      localStorage.setItem(CONV_KEY, JSON.stringify({
        conv: conv.slice(-MAX_TURNS * 2),
        lastPet: lastPet ? lastPet.n : null,
        at: Date.now()
      }));
    } catch (e) {}
  }

  function restoreConv() {
    try {
      var o = JSON.parse(localStorage.getItem(CONV_KEY) || "{}");
      if (!o || !Array.isArray(o.conv)) return null;
      // 超过 2 天的对话不再恢复
      if (o.at && Date.now() - o.at > 2 * 86400000) return null;
      conv = o.conv;
      if (o.lastPet) {
        lastPet = PETS.filter(function (p) { return p.n === o.lastPet; })[0] || null;
      }
      return conv;
    } catch (e) { return null; }
  }

  function trimConv() {
    if (conv.length > MAX_TURNS * 2) conv = conv.slice(-MAX_TURNS * 2);
    saveConv();
  }

  function resetConv() {
    conv = [];
    lastPet = null;
    try { localStorage.removeItem(CONV_KEY); } catch (e) {}
  }

  function scrollBottom() {
    if (!listEl) return;
    listEl.scrollTop = listEl.scrollHeight;
  }

  /** 图片消息：气泡里显示缩略图 */
  function pushImage(who, dataUrl, caption) {
    if (!listEl) return null;
    var row = document.createElement("div");
    row.className = "mm-row " + (who === "me" ? "me" : "bot");
    row.innerHTML =
      '<div class="mm-mini">' + (who === "me" ? "我" : '<img src="icons/miaomiao-avatar.png" alt="">') + "</div>" +
      '<div class="mm-msg ' + (who === "me" ? "me" : "bot") + ' mm-imgmsg">' +
        '<img src="' + dataUrl + '" alt="图片">' +
        (caption ? '<div class="mm-cap">' + mdToHtml(caption) + "</div>" : "") +
      "</div>";
    listEl.appendChild(row);
    scrollBottom();
    return row;
  }

  /** 用户发来图片 */
  function handleImage(file) {
    if (!file.type || file.type.indexOf("image/") !== 0) {
      pushMsg("bot", "只能发图片哦。");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      pushMsg("bot", "图片太大了（超过 8MB），先压缩一下再发。");
      return;
    }
    var rd = new FileReader();
    rd.onload = function () {
      var dataUrl = String(rd.result);
      hideChips();
      pushImage("me", dataUrl);

      var q = (inputEl.value || "").trim();
      inputEl.value = "";
      inputEl.style.height = "auto";
      if (q) pushMsg("me", q);

      var tryOnline = mode === "online" && cfg && cfg.ep && cfg.key && cfg.model;
      if (!tryOnline) {
        pushMsg("bot", "图片我看到了，但**离线模式读不了图**。\n\n" +
          "想让喵喵看图，请：\n" +
          "• 点右上角 ⚙ → 切到「联网」并填好 API Key\n\n" +
          "或者用顶部的「截图识别」，把队伍/血量直接导入计算器。");
        return;
      }
      askWithImage(dataUrl, q);
    };
    rd.readAsDataURL(file);
  }

  /** 联网模式：带图提问 */
  function askWithImage(dataUrl, question) {
    var stop = showTyping();
    var btn = box.querySelector("#mmSend");
    if (btn) btn.disabled = true;
    busy = true;

    var q = question || "这张截图里是什么？如果是对战或队伍截图，请说明双方精灵、血量、能量和技能。";
    var b64 = String(dataUrl).split(",")[1];

    fetch(cfg.ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "你是洛克王国 PVP 助手喵喵。用中文简洁回答，不确定就说不知道，不要编。" +
                                   (relevantContext(q) || "") + "\n\n用户问题：" + q },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }],
        temperature: 0.2,
        max_tokens: 900
      })
    }).then(function (r) {
      return r.text().then(function (t) { return { ok: r.ok, status: r.status, t: t }; });
    }).then(function (res) {
      stop();
      if (!res.ok) {
        var j = null; try { j = JSON.parse(res.t); } catch (e) {}
        var em = (j && j.error && j.error.message) || res.t.slice(0, 150);
        pushMsg("bot", "看不了这张图：" + em);
        return;
      }
      var j2 = JSON.parse(res.t);
      var c2 = (((j2.choices || [])[0] || {}).message || {}).content || "";
      pushMsg("bot", c2 || "（模型没有返回内容）");
    }).catch(function (e) {
      stop();
      pushMsg("bot", "发送失败：" + e.message);
    }).then(function () {
      if (btn) btn.disabled = false;
      busy = false;
    });
  }

  /* ============ 工具调用（Function Calling） ============ */
  // 让模型可以真的去调计算器算，而不是凭空回答
  var TOOLS = [
    {
      type: "function",
      function: {
        name: "calc_damage",
        description: "用计算器的完整引擎算一次真实伤害。含特性、印记、天气、属性克制、本系加成。当用户问「打多少」「几下打死」「能不能秒」时必须调用。",
        parameters: {
          type: "object",
          properties: {
            side: { type: "string", enum: ["mine", "foe"], description: "攻击方：mine=我方，foe=对方" },
            skill: { type: "string", description: "技能名，必须是技能库里存在的" }
          },
          required: ["side", "skill"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_pet",
        description: "查一只精灵的完整数据：属性、种族值、特性全文、可学招式数。回答定位/配队问题时必须先调用。",
        parameters: {
          type: "object",
          properties: { name: { type: "string", description: "精灵名，可用简称" } },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_skill",
        description: "查一个技能的详情：属性、威力、耗能、分类、完整描述。",
        parameters: {
          type: "object",
          properties: { name: { type: "string", description: "技能名" } },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_team",
        description: "读用户当前在计算器里配的双方 6 只精灵、当前在场那只的血量能量招式。当用户说「我的阵容」「我这只」时必须调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "get_matrix",
        description: "拿 6x6 对位回合差矩阵：每对我方精灵对每只对方精灵需要几回合、谁先手。当用户问整体阵容优劣时调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "find_teammates",
        description: "按条件从精灵库筛队友。用于回答「配什么队友」。",
        parameters: {
          type: "object",
          properties: {
            resist: { type: "array", items: { type: "string" }, description: "需要抵抗的属性，如 [\"火\",\"冰\"]" },
            minMd: { type: "number", description: "最低魔防" },
            minDef: { type: "number", description: "最低物防" },
            minSpe: { type: "number", description: "最低速度" },
            limit: { type: "number", description: "返回几条，默认 8" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "set_pet",
        description: "把某只精灵放进计算器某个格子。当用户说「帮我换上 X」「把第 3 个改成 X」时调用。",
        parameters: {
          type: "object",
          properties: {
            side: { type: "string", enum: ["mine", "foe"] },
            slot: { type: "number", description: "第几格，0-5（用户说第 3 个就传 2）" },
            name: { type: "string", description: "精灵名" }
          },
          required: ["side", "slot", "name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "set_moves",
        description: "设置某方当前在场精灵的 4 个招式。当用户说「配招改成 A、B、C、D」时调用。",
        parameters: {
          type: "object",
          properties: {
            side: { type: "string", enum: ["mine", "foe"] },
            moves: { type: "array", items: { type: "string" }, description: "4 个技能名，按顺序" }
          },
          required: ["side", "moves"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "set_numeric",
        description: "改某方的数值。当用户说「把血量改成 250」时调用。",
        parameters: {
          type: "object",
          properties: {
            side: { type: "string", enum: ["mine", "foe"] },
            key: { type: "string", enum: ["hp", "energy", "mana", "level", "star"] },
            value: { type: "number" }
          },
          required: ["side", "key", "value"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "set_item",
        description: "设置某方装备的道具：evolve=进化之力 / resonance=愿力强化 / heal=光合治愈。",
        parameters: {
          type: "object",
          properties: {
            side: { type: "string", enum: ["mine", "foe"] },
            item: { type: "string", enum: ["evolve", "resonance", "heal"] }
          },
          required: ["side", "item"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "switch_slot",
        description: "把某方的当前编辑格子切到第 N 只。",
        parameters: {
          type: "object",
          properties: {
            side: { type: "string", enum: ["mine", "foe"] },
            slot: { type: "number", description: "0-5" }
          },
          required: ["side", "slot"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browse_skills",
        description: "按属性筛技能，用于配招。",
        parameters: {
          type: "object",
          properties: {
            element: { type: "string", description: "属性，如 草" },
            minPower: { type: "number", description: "最低威力" },
            excludeStatus: { type: "boolean", description: "排除状态技，默认 true" },
            limit: { type: "number", description: "返回几条，默认 10" }
          },
          required: ["element"]
        }
      }
    }
  ];

  var TOOL_LABEL = {
    calc_damage: "算伤害",
    get_pet: "查精灵",
    get_skill: "查技能",
    get_team: "读阵容",
    get_matrix: "算对位",
    find_teammates: "筛队友",
    browse_skills: "筛技能",
    set_pet: "换精灵",
    set_moves: "改配招",
    set_numeric: "改数值",
    set_item: "换道具",
    switch_slot: "切格子"
  };

  /** 把工具调用摘要成一行人话，例如「查精灵 武斗酷猫」 */
  function toolTrace(name, args, result) {
    var label = TOOL_LABEL[name] || name;
    var what = "";
    if (args) {
      if (args.name) what = args.name;
      else if (args.skill) what = args.skill;
      else if (args.element) what = args.element + "系";
      else if (args.moves) what = args.moves.filter(Boolean).join("、");
      else if (args.key) what = args.key + "=" + args.value;
      else if (args.item) what = args.item;
      else if (args.resist) what = "抗" + args.resist.join("/");
      else if (typeof args.slot === "number") what = "第" + (args.slot + 1) + "格" + (args.name ? " " + args.name : "");
    }
    var bad = result && (result.error || result.ok === false);
    return { label: label, what: what, bad: !!bad, msg: result && result.msg };
  }

  /** 执行模型发来的工具调用 */
  function runTool(name, args) {
    var b = bridge();
    args = args || {};
    switch (name) {
      case "calc_damage":
        if (!b || !b.damage) return { error: "计算器未就绪" };
        return b.damage(args.side || "mine", args.skill || "");

      case "get_pet":
        if (!b || !b.petInfo) return { error: "计算器未就绪" };
        return b.petInfo(args.name || "");

      case "get_skill":
        if (!b || !b.skillInfo) return { error: "计算器未就绪" };
        return b.skillInfo(args.name || "");

      case "get_team":
        return teamAnswer();

      case "get_matrix":
        if (!b || !b.matrix) return { error: "计算器未就绪" };
        return b.matrix();

      case "find_teammates": {
        var list = window.__ALL_PETS || window.PETS || [];
        var wantResist = Array.isArray(args.resist) ? args.resist : [];
        var minMd = Number(args.minMd) || 0;
        var minDef = Number(args.minDef) || 0;
        var minSpe = Number(args.minSpe) || 0;
        var lim = Number(args.limit) || 8;
        var out = [];
        list.forEach(function (pt) {
          if (pt.md < minMd || pt.def < minDef || pt.spe < minSpe) return;
          var ok = true;
          for (var i = 0; i < wantResist.length; i++) {
            if (typeMult(wantResist[i], pt) >= 1) { ok = false; break; }
          }
          if (!ok) return;
          out.push({ n: pt.n, el: pt.el + (pt.el2 ? "/" + pt.el2 : ""), hp: pt.hp, atk: pt.atk, def: pt.def, ma: pt.ma, md: pt.md, spe: pt.spe, t: pt.t || "" });
        });
        out.sort(function (a, b2) { return (b2.hp + b2.md) - (a.hp + a.md); });
        return { count: out.length, list: out.slice(0, lim) };
      }

      case "set_pet":
        if (!b || !b.setPet) return { error: "计算器未就绪" };
        return b.setPet(args.side || "mine", Number(args.slot) || 0, args.name || "");

      case "set_moves":
        if (!b || !b.setMoves) return { error: "计算器未就绪" };
        return b.setMoves(args.side || "mine", Array.isArray(args.moves) ? args.moves : []);

      case "set_numeric":
        if (!b || !b.setNumeric) return { error: "计算器未就绪" };
        return b.setNumeric(args.side || "mine", args.key || "hp", Number(args.value));

      case "set_item": {
        var stItem = state && state[args.side || "mine"];
        if (!b) return { error: "计算器未就绪" };
        try {
          var sd = args.side === "foe" ? "foe" : "mine";
          var sel = document.getElementById(sd + "Item");
          if (sel) {
            sel.value = args.item;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            return { ok: true, msg: (sd === "mine" ? "我方" : "对方") + " 装备 " + ((ITEM_DEFS[args.item] || {}).n || args.item) };
          }
          return { error: "找不到道具下拉" };
        } catch (e) { return { error: e.message }; }
      }

      case "switch_slot":
        if (!b || !b.switchSlot) return { error: "计算器未就绪" };
        return b.switchSlot(args.side || "mine", Number(args.slot) || 0);

      case "browse_skills": {
        var pool2 = SKILLS.filter(function (s) {
          if (s.e !== args.element) return false;
          if (args.excludeStatus !== false && s.t === "状态") return false;
          if (Number(args.minPower) && !(Number(s.p) >= Number(args.minPower))) return false;
          return true;
        });
        pool2.sort(function (a, b3) { return (Number(b3.p) || 0) - (Number(a.p) || 0); });
        return {
          count: pool2.length,
          list: pool2.slice(0, Number(args.limit) || 10).map(function (s) {
            return { n: s.n, e: s.e, p: s.p, c: s.c, t: s.t, d: (s.d || "").slice(0, 60) };
          })
        };
      }
    }
    return { error: "未知工具：" + name };
  }

  /** 回答被长度截断时，让模型接着往下写（最多续 2 次） */
  function continueAnswer(msgs, soFar, cfg, onDelta, depth) {
    if (depth >= 2) return soFar;
    var m2 = msgs.concat([
      { role: "assistant", content: soFar },
      { role: "user", content: "继续，从刚才断掉的地方接着写，不要重复前文，不要重新开场。" }
    ]);
    return fetch(cfg.ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({
        model: cfg.model,
        messages: m2,
        temperature: 0.3,
        max_tokens: 4000,
        stream: true
      })
    }).then(function (r) {
      if (!r.ok || !r.body) return soFar;
      var base = soFar;
      return readStream(r.body, function (piece, full) {
        onDelta(piece, base + full);
      }).then(function (res) {
        var merged = base + res.text;
        if (res.truncated) return continueAnswer(msgs, merged, cfg, onDelta, depth + 1);
        return merged;
      });
    }).catch(function () { return soFar; });
  }

  /** 逐块读取 SSE 流 */
  function readStream(body, onDelta) {
    var reader = body.getReader();
    var dec = new TextDecoder("utf-8");
    var buf = "", full = "", raw = "", truncated = false;
    return new Promise(function (resolve, reject) {
      function pump() {
        reader.read().then(function (r) {
          if (r.done) {
            if (full) { resolve({ text: full, truncated: truncated }); return; }
            // 一个字都没拿到 → 把原始返回带出去，方便定位
            if (raw.trim()) {
              reject(new Error("返回里没有文字。原始内容：" + raw.slice(0, 300)));
            } else {
              reject(new Error("接口返回了空内容"));
            }
            return;
          }
          var chunk = dec.decode(r.value, { stream: true });
          raw += chunk;
          buf += chunk;
          var lines = buf.split("\n");
          buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var ln = lines[i].trim();
            if (!ln) continue;
            if (ln.indexOf("data:") !== 0) continue;
            var payload = ln.slice(5).trim();
            if (payload === "[DONE]") {
              if (full) { resolve({ text: full, truncated: truncated }); }
              else { reject(new Error("模型只返回了思考过程，没有正文")); }
              return;
            }
            try {
              var j = JSON.parse(payload);
              if (j.error) {
                reject(new Error("接口报错：" + (j.error.message || JSON.stringify(j.error).slice(0, 200))));
                return;
              }
              var ch = ((j.choices || [])[0] || {}).delta || {};
              // 思考型模型会先吐 reasoning_content，正文在 content；只取正文
              var piece = ch.content || "";
              if (piece) { full += piece; onDelta(piece, full); }
              var fr = ((j.choices || [])[0] || {}).finish_reason;
              if (fr === "length") truncated = true;
            } catch (e) {}
          }
          pump();
        }).catch(reject);
      }
      pump();
    });
  }

  /** 把计算器当前状态压成一段话，每轮自动带给模型 */
  function liveState() {
    var b = bridge();
    if (!b || !b.readState) return "";
    try {
      var st = b.readState();
      function side(s, name) {
        var slots = (s.slots || []).filter(Boolean);
        if (!slots.length) return name + "：还没配";
        var cur = s.pet || slots[s.active] || slots[0];
        var mv = (s.moves || []).filter(Boolean).join("、") || "未配";
        return name + "：" + slots.map(function (n, i) {
          return (i === s.active ? "【" + n + "】" : n);
        }).join("、") +
          "；当前在场 " + cur + "，血量 " + s.hp + "，能量 " + s.energy +
          "，招式 " + mv + (s.itemName ? "，道具 " + s.itemName : "");
      }
      return "【用户当前在计算器里的配置】\n" +
        side(st.mine, "我方") + "\n" + side(st.foe, "对方") +
        "\n已记录 " + (st.turn || 0) + " 回合";
    } catch (e) { return ""; }
  }

  /** 从问题里找相关精灵，给模型补充数据 */
  function relevantContext(q) {
    try {
      var pets = extractPet(String(q || ""));
      if (!pets.length) return "";
      var ctx = pets.slice(0, 2).map(function (p) {
        return "\n【" + p.n + "】" + [p.el, p.el2].filter(Boolean).join("/") + "系｜特性：" + (p.t || "无") +
          "｜" + (p.td || "") + "｜种族值 生命" + p.hp + " 物攻" + p.atk + " 物防" + p.def +
          " 魔攻" + p.ma + " 魔防" + p.md + " 速度" + p.spe;
      }).join("");
      return ctx ? "\n\n参考数据：" + ctx : "";
    } catch (e) { return ""; }
  }

  /** 打字指示器：返回一个移除函数 */
  function showTyping() {
    if (!listEl) return function () {};
    var row = document.createElement("div");
    row.className = "mm-row bot";
    row.innerHTML = '<div class="mm-mini"><img src="icons/miaomiao-avatar.png" alt=""></div>' +
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
        '<div class="mm-avatar"><img src="icons/miaomiao-avatar.png" alt="喵喵"></div>' +
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
        '<div class="mm-seg">' +
          '<button type="button" class="mm-seg-b" data-mode="offline">离线</button>' +
          '<button type="button" class="mm-seg-b" data-mode="online">联网</button>' +
        '</div>' +
        '<div class="mm-api" id="mmApi" hidden>' +
          '<input id="mmEp" placeholder="接口地址 https://api.deepseek.com/chat/completions">' +
          '<input id="mmModel" placeholder="模型 deepseek-flash">' +
          '<input id="mmKey" type="password" placeholder="API Key">' +
          '<div class="mm-apibtn">' +
            '<button type="button" class="mm-mini-btn" id="mmTest">测试</button>' +
            '<button type="button" class="mm-mini-btn pri" id="mmSave">保存</button>' +
          '</div>' +
          '<div class="mm-apimsg" id="mmApiMsg"></div>' +
        '</div>' +
        '<label class="mm-scriptline"><input type="checkbox" id="mmScriptChk"> 允许自定义脚本（js: 开头）</label>' +
        '<div class="mm-warn">开启后，以 js: 开头的命令会真的在页面里运行。每次执行前还会再确认一次。</div>' +
      '</div>' +
      // 消息
      '<div class="mm-list" id="mmList"></div>' +
      // 快捷问句
      '<div class="mm-chips" id="mmChips"></div>' +
      // 输入
      '<div class="mm-foot">' +
        '<button type="button" class="mm-attach" id="mmAttach" title="发送图片">📎</button>' +
        '<input type="file" id="mmFile" accept="image/*" style="display:none">' +
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
      resetConv();
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
      if (!setBox.hidden) refreshSettings();
    };

    // ===== 模式切换 =====
    var SAVE_KEY = "luoke.miao.cfg";
    function loadCfg() {
      try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); } catch (e) { return {}; }
    }
    function storeCfg(o) {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) {}
    }

    function refreshSettings() {
      var c = loadCfg();
      // 模式按钮高亮
      Array.prototype.forEach.call(box.querySelectorAll(".mm-seg-b"), function (b) {
        b.classList.toggle("on", b.getAttribute("data-mode") === mode);
      });
      // 联网字段
      box.querySelector("#mmApi").hidden = mode !== "online";
      if (c.ep) box.querySelector("#mmEp").value = c.ep;
      if (c.model) box.querySelector("#mmModel").value = c.model;
      if (c.key) box.querySelector("#mmKey").value = c.key;
      // 首次打开时，从截图识别的配置里带过来
      if (!c.ep) {
        try {
          var ocr = JSON.parse(localStorage.getItem("luoke-ocr-cfg") || "{}");
          if (ocr.endpoint) box.querySelector("#mmEp").value = ocr.endpoint;
          if (ocr.model) box.querySelector("#mmModel").value = ocr.model;
          if (ocr.key) box.querySelector("#mmKey").value = ocr.key;
        } catch (e) {}
      }
      if (!box.querySelector("#mmEp").value) box.querySelector("#mmEp").value = "https://api.deepseek.com/chat/completions";
      if (!box.querySelector("#mmModel").value) box.querySelector("#mmModel").value = "deepseek-flash";
    }

    Array.prototype.forEach.call(box.querySelectorAll(".mm-seg-b"), function (b) {
      b.onclick = function () {
        var m = b.getAttribute("data-mode");
        if (m === "online") {
          var c = loadCfg();
          if (!c.key) {
            box.querySelector("#mmApi").hidden = false;
            msg3("填好地址/模型/Key 后点「保存」再切联网");
          }
        }
        setMode(m);
        refreshSettings();
      };
    });

    function msg3(t, bad) {
      var el = box.querySelector("#mmApiMsg");
      if (el) { el.textContent = t; el.className = "mm-apimsg" + (bad ? " bad" : ""); }
    }

    box.querySelector("#mmSave").onclick = function () {
      var ep = (box.querySelector("#mmEp").value || "").trim();
      var model = (box.querySelector("#mmModel").value || "").trim();
      var key = (box.querySelector("#mmKey").value || "").trim().replace(/^Bearer\s+/i, "");
      if (/^https?:\/\/[^/]+\/?$/.test(ep)) ep = ep.replace(/\/$/, "") + "/chat/completions";
      if (!ep || !model || !key) return msg3("三项都要填", true);
      cfg = { ep: ep, model: model, key: key };
      storeCfg(cfg);
      setMode("online", cfg);
      refreshSettings();
      msg3("已保存，已切到联网");
    };

    box.querySelector("#mmTest").onclick = function () {
      var ep = (box.querySelector("#mmEp").value || "").trim();
      var model = (box.querySelector("#mmModel").value || "").trim();
      var key = (box.querySelector("#mmKey").value || "").trim().replace(/^Bearer\s+/i, "");
      if (/^https?:\/\/[^/]+\/?$/.test(ep)) ep = ep.replace(/\/$/, "") + "/chat/completions";
      if (!ep || !model || !key) return msg3("三项都要填", true);
      msg3("测试中…");
      fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({ model: model, messages: [{ role: "user", content: "只回复两个字：可用" }], max_tokens: 16, temperature: 0 })
      }).then(function (r) {
        return r.text().then(function (t) { return { ok: r.ok, status: r.status, t: t }; });
      }).then(function (res) {
        if (res.ok) {
          var j2 = null; try { j2 = JSON.parse(res.t); } catch (e) {}
          var txt = (((j2 || {}).choices || [])[0] || {}).message;
          msg3("✓ 连接成功：" + (txt && txt.content ? txt.content.slice(0, 20) : "可用"));
        } else {
          var j3 = null; try { j3 = JSON.parse(res.t); } catch (e) {}
          var em = (j3 && j3.error && j3.error.message) || res.t.slice(0, 120);
          msg3("✗ HTTP " + res.status + "：" + em, true);
        }
      }).catch(function (e) { msg3("✗ 连不上：" + e.message, true); });
    };

    // 附件
    var fileEl = box.querySelector("#mmFile");
    box.querySelector("#mmAttach").onclick = function () { fileEl.click(); };
    fileEl.onchange = function () {
      var f = fileEl.files && fileEl.files[0];
      if (f) handleImage(f);
      fileEl.value = "";
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

    // 恢复上次对话
    var oldConv = restoreConv();
    if (oldConv && oldConv.length) {
      oldConv.forEach(function (m) {
        pushMsg(m.role === "user" ? "me" : "bot", m.content);
      });
      hideChips();
    } else {
      pushMsg("bot", GREETING);
      showChips();
    }
  }

  var GREETING = "喵～我是**喵喵**，你的洛克对战助手。\n\n" +
    "能算伤害、查属性、配招式，也能直接帮你改阵容。";

  var CHIPS = [
    "我的阵容",
    "这个计算器怎么用",
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
    conv.push({ role: "user", content: q });
    trimConv();

    var tryOnline = mode === "online" && cfg && cfg.ep && cfg.key && cfg.model;

    if (!tryOnline) {
      busy = true;
      var stop = showTyping();
      var btn = box.querySelector("#mmSend");
      if (btn) btn.disabled = true;
      setTimeout(function () {
        stop();
        var a = answerOffline(q);
        pushMsg("bot", a);
        conv.push({ role: "assistant", content: a });
        trimConv();
        if (btn) btn.disabled = false;
        busy = false;
      }, 260 + Math.random() * 200);
      return;
    }

    busy = true;
    var stop2 = showTyping();
    var btn2 = box.querySelector("#mmSend");
    if (btn2) btn2.disabled = true;

    // 工具轨迹：显示「查精灵 武斗酷猫」这类执行记录
    var traceRow = null, traceBox = null;
    function onTrace(t) {
      if (!traceRow) {
        stop2();
        traceRow = document.createElement("div");
        traceRow.className = "mm-row bot mm-trace-row";
        traceRow.innerHTML = '<div class="mm-mini"><img src="icons/miaomiao-avatar.png" alt=""></div>' +
          '<div class="mm-trace" id="mmTrace"></div>';
        listEl.appendChild(traceRow);
        traceBox = traceRow.querySelector("#mmTrace");
      }
      var line = document.createElement("div");
      line.className = "mm-trace-line" + (t.bad ? " bad" : "");
      line.innerHTML = '<i class="mm-gear-icon">⚙</i> ' + t.label +
        (t.what ? " <b>" + esc(t.what) + "</b>" : "") +
        (t.bad ? ' <span class="mm-trace-bad">失败</span>' : "");
      traceBox.appendChild(line);
      scrollBottom();
    }

    // 流式：第一个字到达时把「思考中」换成气泡，然后逐字刷新
    var bubble = null, acc = "";
    function onDelta(piece, full) {
      if (!bubble) {
        stop2();
        bubble = pushMsg("bot", "");
      }
      acc = full;
      var body = bubble.querySelector(".mm-msg");
      if (body) {
        body.innerHTML = mdToHtml(acc) + '<span class="mm-caret"></span>';
        scrollBottom();
      }
    }

    answerOnline(q, cfg, onDelta, onTrace).then(function (txt) {
      stop2();
      if (bubble) {
        var bd = bubble.querySelector(".mm-msg");
        if (bd) bd.innerHTML = mdToHtml(txt);
        scrollBottom();
      }
      return txt;
    }).then(function (txt) {
      if (!bubble) pushMsg("bot", txt);
      conv.push({ role: "assistant", content: txt });
      trimConv();
    }).catch(function (e) {
      stop2();
      // 联网失败 → 自动回落到离线引擎，保证总有答案
      var off = answerOffline(q);
      var fallback = "⚠️ 联网失败：" + e.message +
        "\n\n（已改用离线数据回答 ↓）\n\n" + off;
      pushMsg("bot", fallback);
      conv.push({ role: "assistant", content: fallback });
      trimConv();
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
    fab.innerHTML = '<img src="icons/miaomiao-avatar.png" alt="喵喵">';
    fab.onclick = function () { open({}); };
    document.body.appendChild(fab);
  }

  function open(opts) {
    refreshData();
    build();
    // 恢复上次使用的模式
    if (!opts || !opts.mode) {
      try {
        var saved = JSON.parse(localStorage.getItem("luoke.miao.cfg") || "{}");
        if (saved.mode === "online" && saved.ep && saved.key) {
          setMode("online", { ep: saved.ep, model: saved.model, key: saved.key });
        } else {
          setMode("offline");
        }
      } catch (e) {}
    }
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
    try {
      var saved = JSON.parse(localStorage.getItem("luoke.miao.cfg") || "{}");
      saved.mode = mode;
      if (c) { saved.ep = c.ep; saved.model = c.model; saved.key = c.key; }
      localStorage.setItem("luoke.miao.cfg", JSON.stringify(saved));
    } catch (e) {}
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
