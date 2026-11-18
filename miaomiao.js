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
    if (/宪法|执行规则|你的规则|权限范围/.test(String(arguments[0] || ""))) return constitutionMd();
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
      "【已知边界】" + KB.limits.join("；"),
      "",
      "【技能卡字段怎么读】",
      "- 占对方血量：这一招打掉对方当前血量的百分比",
      "- 本系加成 ×1.25：技能属性和精灵属性一致时的增伤倍数",
      "- 能否打死 / 剩余血量：这一击够不够致命",
      "- 打完剩余次数 N/10：这一招在能量耗尽前能打几次",
      "- 能量是否够：不够会自动变聚能（浪费一回合）",
      "- 对手推测：按对方手牌+能量+血量打分，猜他可能出什么（带概率）",
      "- 局面分：正数代表这一招让你占优，负数代表吃亏",
      "",
      "【轮次阶段】",
      "信息试探 1-4 → 能量压制 5-9 → 发育破局 10-16 → 兑现斩杀 17-24 → 残局收束 25-50",
      "不同阶段该做的事不同：前期别急着放高耗技能，后期要算斩杀线。",
      "",
      "【你能直接做的事（不要说没有）】",
      "- 用户给 6 个精灵名 → 调 create_foe_team 直接建队伍入库，不要让他去跑脚本",
      "- 队伍库里没有队伍 → 可以 open_panel(manual) 打开手动录入",
      "- 视频帧识别 / 封面识别 → open_panel(frames|cover)，需要用户自己的 API Key",
      "- B站采集 / 抽帧是本地 Node 脚本，不在你的工具里，但你可以 open_panel(collect) 让用户看设置",
      "",
      "【解读原则】",
      "用户给你看技能卡或问「用哪招」时，先调 get_move_cards 拿到真实数字，" +
      "再结合对手推测概率和局面分给出建议，不要只说「看情况」。"
    ].join("\n") + "\n\n" +
      kbText + "\n\n" +
      liveState() + "\n\n" +
      "【本次问题相关的精灵数据】\n" + (ctx || "（本次问题没有匹配到精灵）") +
      "\n\n注意：如果用户说「然后呢」「继续」这类追问，请接着上一轮的内容往下讲，" +
      "不要说自己没接到上文；如果上轮在讲某只精灵，就继续讲它的配队/打法。" +
      "如果用户问的和上面配置有关，直接用【用户当前在计算器里的配置】里的信息。";

    // 带上最近几轮对话，让「然后呢」这种追问有上下文
    turnLedger = newLedger(q);
    sys = "【执行宪法（必须遵守，代码会强制检查）】\n" + CONSTITUTION.join("\n") + "\n\n" + sys;
    var msgs = [{ role: "system", content: sys }]
      .concat(conv.slice(-MAX_TURNS * 2 - 1, -1))
      .concat([{ role: "user", content: q }]);

    // 先走「带工具的对话循环」；模型不需要工具时会直接回答
    return chatWithTools(msgs, cfg, onDelta, 0, onTrace);
  }

  /** 带工具调用的对话循环，最多循环 4 轮 */
  function chatWithTools(msgs, cfg, onDelta, depth, onTrace) {
    var MAX_LOOP = 6;
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

      // 执行所有工具调用（可能含异步）
      var toolMsgs = [{ role: "assistant", content: msg.content || "", tool_calls: calls }];
      var pendingCalls = [];
      calls.forEach(function (c) {
        var fn = (c.function || {});
        var args = {};
        try { args = JSON.parse(fn.arguments || "{}"); } catch (e) {}
        var result;
        try { result = guardedRun(fn.name, args); }
        catch (e) { result = { error: e.message }; }
        pendingCalls.push(
          Promise.resolve(result).then(function (res) {
            if (typeof onTrace === "function") onTrace(toolTrace(fn.name, args, res));
            return { role: "tool", tool_call_id: c.id, content: JSON.stringify(res).slice(0, 6000) };
          })
        );
      });

      if (depth >= MAX_LOOP) {
        return Promise.all(pendingCalls).then(function (results) {
          return "（已调用 " + calls.length + " 次工具，达到上限）\n\n" +
            results.map(function (r) { return String(r.content).slice(0, 300); }).join("\n");
        });
      }

      // 等所有工具返回，再交回模型
      return Promise.all(pendingCalls).then(function (results) {
        return chatWithTools(msgs.concat(toolMsgs, results), cfg, onDelta, depth + 1, onTrace);
      });
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

    var q = question || [
      "先仔细看图，按下面两段回答：",
      "",
      "【识别结果】用 JSON 放在代码块里：",
      "```json",
      '{"pets":[{"name":"精灵名","hp":数字或null,"energy":数字或null,"moves":["技能1","技能2"]}],"side":"mine或foe或unknown"}',
      "```",
      "",
      "【分析】基于上面的识别结果，说明这个局面怎么样、该怎么打。",
      "看不清的字段写 null，不要猜。"
    ].join("\\n");
    var b64 = String(dataUrl).split(",")[1];
    // 用视觉模型（不是当前对话模型）
    var vModel = cfg.visionModel || "deepseek-flash";

    fetch(cfg.ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({
        model: vModel,
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
      var row = pushMsg("bot", c2 || "（模型没有返回内容）");
      // 识别出结构化数据 → 给一键导入按钮
      var data = extractImageData(c2);
      if (data && Array.isArray(data.pets) && data.pets.length && row) {
        var bar = document.createElement("div");
        bar.className = "mm-importbar";
        bar.innerHTML = '<button type="button" class="mm-import-btn" data-side="mine">导入我方</button>' +
                        '<button type="button" class="mm-import-btn ghost" data-side="foe">导入对方</button>';
        row.querySelector(".mm-msg").appendChild(bar);
        Array.prototype.forEach.call(bar.querySelectorAll(".mm-import-btn"), function (btn) {
          btn.onclick = function () {
            var side = btn.getAttribute("data-side");
            var r2 = importPets(data.pets, side);
            pushMsg("bot", "✅ " + r2);
            bar.remove();
          };
        });
      }
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
        name: "wiki_search",
        description: "在洛克王国 bwiki 上搜索。当本地数据里没有这只精灵/技能，或用户问的可能是新内容时调用。",
        parameters: {
          type: "object",
          properties: { keyword: { type: "string", description: "搜索词，如精灵名或技能名" } },
          required: ["keyword"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "wiki_page",
        description: "读取 bwiki 上某个页面的原始内容（wikitext）。用于查精灵的详细资料、技能表、特性机制。",
        parameters: {
          type: "object",
          properties: { title: { type: "string", description: "页面标题，如「武斗酷猫」" } },
          required: ["title"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "set_action",
        description: "设置某一方本回合的动作。当用户说「我这回合出 X」「对面换人」时调用。",
        parameters: {
          type: "object",
          properties: {
            side: { type: "string", enum: ["mine", "foe"] },
            act: { type: "string", enum: ["attack", "charge", "switch", "counter", "item"], description: "attack=出招 charge=聚能 switch=换人 counter=应对 item=道具" },
            skill: { type: "string", description: "出招时用哪个技能，其它动作可省略" }
          },
          required: ["side", "act"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_move_cards",
        description: "读某方 4 个技能的完整技能卡：伤害、占血百分比、本系加成倍数、能不能打死、剩多少血、打完几次（N/10）、能量够不够、对手可能用什么、局面评分。用户问「这招打得死吗」「用哪个技能好」时必须调用。",
        parameters: {
          type: "object",
          properties: { side: { type: "string", enum: ["mine", "foe"], description: "看哪一方的技能" } },
          required: ["side"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_timeline",
        description: "读轮次时间轴：现在第几回合、处在哪个阶段（信息试探/能量压制/发育破局/兑现斩杀/残局收束）、双方魔力。用户问「现在什么阶段」「还剩几回合」时调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "preview_turn",
        description: "预测本回合会发生什么：谁先手、双方打多少伤害、能量变化、会不会倒。用户问「这回合会怎样」「打不打得死」时调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "record_turn",
        description: "真的把本回合记录进战斗日志（会改变血量能量）。只有用户明确说「记录这回合」时才调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "undo_turn",
        description: "撤销上一回合的记录。用户说「撤销」「记错了」时调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "get_battle_log",
        description: "读最近的回合记录：每回合双方血量、能量、动作。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "simulate_battle",
        description: "蒙特卡洛模拟：按当前阵容跑几十局随机战斗，返回真实胜率。比公式估算更全面。用户问「这套阵容强不强」时可调用。",
        parameters: {
          type: "object",
          properties: { games: { type: "number", description: "跑几局，10-200，默认 60" } }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_foe_team",
        description: "用用户给的 6 个精灵名直接建一套对手队伍并存进队伍库。用户说「这 6 只：A、B、C、D、E、F」时立刻调用，不要推托说没有采集工具。",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "队伍名，可留空" },
            pets: { type: "array", items: { type: "string" }, description: "6 个精灵名" },
            fillCalculator: { type: "boolean", description: "是否同时填进计算器的对方 6 格" }
          },
          required: ["pets"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "open_panel",
        description: "打开计算器里的功能面板。用户说「打开队伍库」「我要截图识别」时用它，不要说自己没有这个功能。",
        parameters: {
          type: "object",
          properties: {
            panel: { type: "string", enum: ["teams", "manual", "check", "collect", "frames", "covers"], description: "teams=队伍库 manual=手动录入 check=配队体检 collect=采集设置 frames=视频帧识别 covers=封面识别" }
          },
          required: ["panel"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_foe_teams",
        description: "列出队伍库里保存的对手队伍。用户问「我存了哪些队伍」时调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "save_foe_team",
        description: "把计算器里当前的对手 6 只存成一套队伍，方便以后批量对比。用户说「把这套对手存起来」时调用。",
        parameters: {
          type: "object",
          properties: { name: { type: "string", description: "队伍名称" } },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "batch_test_teams",
        description: "一次批量计算多套对手队伍：每套跑公式胜率 + 蒙特卡洛模拟 + 6x6 对位，最后给综合结论（哪套最难打、我方谁拖后腿、配队是否合理）。用户说「测多套队伍」「哪些队伍打不过」时必须调用。",
        parameters: {
          type: "object",
          properties: {
            names: { type: "array", items: { type: "string" }, description: "要测的队伍名，留空=测全部" },
            games: { type: "number", description: "每套跑几局模拟，默认 200" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "import_collected",
        description: "从 B站采集结果（teams-collected.json）导入热门队伍到队伍库。用户说「导入采集到的队伍」时调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "get_route",
        description: "对局路径：从首发开始逐回合推演整场，返回每一步谁打谁、血量变化、胜负走向。用户问「这套阵容怎么打」「从谁首发」时调用。",
        parameters: {
          type: "object",
          properties: {
            leadMine: { type: "number", description: "我方首发是第几只，0-5，默认 0" },
            leadFoe: { type: "number", description: "对方首发是第几只，0-5，默认 0" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_winrate",
        description: "胜率估计：把当前局面压成 7 个特征向量，用逻辑回归算胜率百分比。用户问「我这局胜率多少」「赢面大吗」时调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "get_best_leads",
        description: "把 6×6 的最优/最差首发组合按胜率排序返回。用户问「谁首发最好」时调用。",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "open_page",
        description: "在浏览器里打开对应的功能页（matrix=对战矩阵 / route=对局路径 / winrate=胜率估计）。用户说「打开矩阵看看」时调用。",
        parameters: {
          type: "object",
          properties: {
            page: { type: "string", enum: ["matrix", "route", "winrate"] }
          },
          required: ["page"]
        }
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
    switch_slot: "切格子",
    wiki_search: "查bwiki",
    wiki_page: "读bwiki",
    set_action: "设动作",
    get_move_cards: "读技能卡",
    get_timeline: "读时间轴",
    preview_turn: "预测回合",
    record_turn: "记录回合",
    undo_turn: "撤销回合",
    get_battle_log: "读战报",
    simulate_battle: "模拟对战",
    create_foe_team: "建队伍",
    open_panel: "开面板",
    list_foe_teams: "列队伍",
    save_foe_team: "存队伍",
    batch_test_teams: "批量测队",
    import_collected: "导入采集",
    get_route: "推演路径",
    get_winrate: "估胜率",
    get_best_leads: "算最优首发",
    open_page: "打开页面"
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
  /* ============ 执行宪法 ============ */
  // 每一条都在代码里强制执行，不靠模型自觉
  var CONSTITUTION = [
    "第1条 数据第一：数字、名单、回合数必须来自工具结果，不许凭记忆。没调工具就给数字，回答会被标注「未核实」。",
    "第2条 先读后写：改配置前，本轮必须先读当前状态（get_team 等）。没读就写，会被拦截。",
    "第3条 可回滚：本轮第一次写入前自动快照。用户可一键撤销本轮全部修改；本轮出错时自动回滚，不留半成品。",
    "第4条 不越权：用户没提出修改，就不许改配置；「记录回合」「撤销回合」必须是用户明确要求。",
    "第5条 有预算：每轮最多 20 次工具调用、8 次写入、6 轮循环。超出即停，并汇报做到哪一步。",
    "第6条 如实汇报：工具失败、被拦截都要告诉用户，不许装作成功。每轮回答末尾附执行记录。"
  ];
  var WRITE_TOOLS = { set_pet: 1, set_moves: 1, set_numeric: 1, set_item: 1, switch_slot: 1, set_action: 1, record_turn: 1, undo_turn: 1 };
  var STATE_READS = { get_team: 1, get_move_cards: 1, get_timeline: 1, get_battle_log: 1, preview_turn: 1, get_matrix: 1 };
  var DESTRUCTIVE = { record_turn: /记录|记一|记下|记上|走一回合|打一回合/, undo_turn: /撤销|撤回|回退|退回/ };
  var WRITE_INTENT = /换|改|设|装|切|上场|配|填|记|撤|调整|替|放|帮我|用.{0,6}(打|上)/;
  var LIMITS = { calls: 20, writes: 8 };
  var turnLedger = null;

  function newLedger(userText) {
    return { userText: String(userText || ""), calls: 0, reads: 0, stateRead: false,
             writes: 0, fails: 0, refused: 0, snapshot: null, log: [] };
  }

  function refuse(L, name, article, why) {
    L.refused++;
    L.log.push({ tool: name, result: "拦截", article: article });
    return { error: "⚖ 宪法" + article + "拦截：" + why, blocked: true };
  }

  function isFail(r) { return !r || r.error || r.ok === false; }

  /** 所有工具调用都走这里：先过宪法，再执行，再记账 */
  function guardedRun(name, args) {
    var L = turnLedger || (turnLedger = newLedger(""));
    L.calls++;
    if (L.calls > LIMITS.calls) return refuse(L, name, "第5条", "本轮工具调用已达 " + LIMITS.calls + " 次上限，停止调用，向用户汇报当前进度");

    if (WRITE_TOOLS[name]) {
      if (DESTRUCTIVE[name] && !DESTRUCTIVE[name].test(L.userText))
        return refuse(L, name, "第4条", "用户没有要求" + (name === "record_turn" ? "记录回合" : "撤销回合") + "，不许擅自执行。先问用户要不要做");
      if (!WRITE_INTENT.test(L.userText))
        return refuse(L, name, "第4条", "用户这句话没有要求修改配置，只能给建议，不能直接改。问用户是否需要你来改");
      if (!L.stateRead)
        return refuse(L, name, "第2条", "写入前必须先读当前状态。先调用 get_team，再决定怎么改");
      if (L.writes >= LIMITS.writes)
        return refuse(L, name, "第5条", "本轮写入已达 " + LIMITS.writes + " 次上限");
      if (L.snapshot == null && window.__miaoSnapshot) L.snapshot = window.__miaoSnapshot();
      var w;
      try { w = runTool(name, args); } catch (e) { w = { error: e.message }; }
      L.writes++;
      if (isFail(w)) L.fails++;
      L.log.push({ tool: name, result: isFail(w) ? "失败" : "写入" });
      return w;
    }

    L.reads++;
    if (STATE_READS[name]) L.stateRead = true;
    var r;
    try { r = runTool(name, args); } catch (e) { r = { error: e.message }; }
    return Promise.resolve(r).then(function (x) {
      if (isFail(x)) L.fails++;
      L.log.push({ tool: name, result: isFail(x) ? "失败" : "读取" });
      return x;
    });
  }

  /** 第1条 + 第6条：回答末尾的执行记录 */
  function auditFooter(L, txt) {
    if (!L) return "";
    var out = [];
    if (L.reads === 0 && /\d{2,}/.test(String(txt || "")))
      out.push("⚠ 本回答没有调用工具核实，里面的数字可能不准（宪法第1条）");
    if (L.calls > 0)
      out.push("⚖ 执行记录：读取 " + L.reads + " 次 · 写入 " + L.writes + " 次 · 失败 " + L.fails + " 次 · 拦截 " + L.refused + " 次");
    return out.length ? "\n\n---\n" + out.join("\n") : "";
  }

  /** 第3条：一键撤销本轮修改 */
  function attachRollback(L) {
    if (!L || !L.writes || !L.snapshot || !listEl) return;
    var msgs = listEl.querySelectorAll(".mm-msg");
    var last = msgs[msgs.length - 1];
    if (!last) return;
    var snap = L.snapshot;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mm-rollback";
    btn.textContent = "↶ 撤销本轮 " + L.writes + " 处修改";
    btn.onclick = function () {
      var ok = window.__miaoRestore && window.__miaoRestore(snap);
      btn.disabled = true;
      btn.textContent = ok ? "✓ 已恢复到本轮之前" : "恢复失败";
    };
    last.appendChild(btn);
  }

  function constitutionMd() {
    return "**喵喵执行宪法**\n\n" + CONSTITUTION.map(function (x) { return "- " + x; }).join("\n");
  }

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

      case "wiki_search": {
        var kw = String(args.keyword || "").trim();
        if (!kw) return { error: "缺少搜索词" };
        return fetch("https://wiki.biligame.com/rocom/api.php?action=query&list=search&srsearch=" +
          encodeURIComponent(kw) + "&srlimit=5&format=json&origin=*")
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var list = (((j.query || {}).search) || []).map(function (x) {
              return { title: x.title, snippet: String(x.snippet || "").replace(/<[^>]+>/g, "") };
            });
            return { ok: true, keyword: kw, total: ((j.query || {}).searchinfo || {}).totalhits || list.length, results: list };
          })
          .catch(function (e) { return { error: "搜索失败：" + e.message }; });
      }

      case "wiki_page": {
        var title = String(args.title || "").trim();
        if (!title) return { error: "缺少页面名" };
        return fetch("https://wiki.biligame.com/rocom/api.php?action=parse&page=" +
          encodeURIComponent(title) + "&prop=wikitext&format=json&origin=*")
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j.error) return { error: "页面不存在：" + (j.error.info || title) };
            var wt = ((j.parse || {}).wikitext || {})["*"] || "";
            return { ok: true, title: title, length: wt.length, wikitext: wt.slice(0, 4000) };
          })
          .catch(function (e) { return { error: "读取失败：" + e.message }; });
      }

      case "set_action":
        if (!b || !b.setAction) return { error: "计算器未就绪" };
        return b.setAction(args.side || "mine", args.act || "attack", args.skill || "");

      case "get_move_cards":
        if (!b || !b.moveCards) return { error: "计算器未就绪" };
        return b.moveCards(args.side || "mine");

      case "get_timeline":
        if (!b || !b.timeline) return { error: "计算器未就绪" };
        return b.timeline();

      case "preview_turn":
        if (!b || !b.battlePreview) return { error: "计算器未就绪" };
        return b.battlePreview();

      case "record_turn":
        if (!b || !b.recordBattleTurn) return { error: "计算器未就绪" };
        return b.recordBattleTurn();

      case "undo_turn":
        if (!b || !b.undoBattleTurn) return { error: "计算器未就绪" };
        return b.undoBattleTurn();

      case "get_battle_log":
        if (!b || !b.battleHistory) return { error: "计算器未就绪" };
        return b.battleHistory();

      case "simulate_battle":
        if (!b || !b.simulate) return { error: "计算器未就绪" };
        return b.simulate(Number(args.games) || 60);

      case "create_foe_team": {
        if (!b || !b.createTeam) return { error: "计算器未就绪" };
        var r = b.createTeam(args.name || "", args.pets || []);
        if (r && r.ok && args.fillCalculator) {
          try { b.fillFoeTeam(r.team.pets); } catch (e) {}
        }
        return r;
      }

      case "open_panel": {
        var P = {
          teams: function () { if (window.__openTeamsPanel) window.__openTeamsPanel(); },
          manual: function () { if (window.__openManualTeam) window.__openManualTeam(); },
          check: function () { if (window.__openTeamCheck) window.__openTeamCheck(); },
          collect: function () { if (window.__openCollectConfig) window.__openCollectConfig(); },
          frames: function () { if (window.Miao && Miao.recognizeCovers) Miao.recognizeCovers("frame"); },
          covers: function () { if (window.Miao && Miao.recognizeCovers) Miao.recognizeCovers("cover"); }
        };
        var fn = P[args.panel];
        if (!fn) return { error: "未知面板" };
        try { fn(); return { ok: true, msg: "已打开 " + args.panel }; }
        catch (e) { return { error: e.message }; }
      }

      case "list_foe_teams": {
        if (!b || !b.listTeams) return { error: "计算器未就绪" };
        var r0 = b.listTeams();
        return { ok: true, count: (r0.teams || []).length, teams: (r0.teams || []).map(function (t) { return { name: t.name, pets: t.pets }; }) };
      }

      case "save_foe_team":
        if (!b || !b.saveTeam) return { error: "计算器未就绪" };
        return b.saveTeam(args.name || "队伍");

      case "batch_test_teams": {
        if (!b || !b.batchTest) return { error: "计算器未就绪" };
        var ids = null;
        if (Array.isArray(args.names) && args.names.length) {
          var all = (b.listTeams().teams) || [];
          ids = args.names.map(function (nm) {
            var hit = all.filter(function (t) { return t.name === nm || t.name.indexOf(nm) >= 0; })[0];
            return hit ? hit.id : null;
          }).filter(Boolean);
          if (!ids.length) return { error: "队伍库里没有这些名字", hint: all.map(function (t) { return t.name; }) };
        }
        return b.batchTest(ids, { games: Number(args.games) || 200 });
      }

      case "import_collected":
        return fetch("teams-collected.json?t=" + Date.now())
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            if (!j || !j.teams) return { error: "没有采集结果，先在本机跑 tools/bili-collect.mjs" };
            var rr = b.importTeams(j.teams);
            return { ok: true, added: rr.added, total: rr.total, hotPets: (j.hotPets || []).slice(0, 10), window: j.window };
          })
          .catch(function (e) { return { error: "读取失败：" + e.message }; });

      case "get_route":
        if (!b || !b.route) return { error: "计算器未就绪" };
        return b.route(Number(args.leadMine) || 0, Number(args.leadFoe) || 0);

      case "get_winrate":
        if (!b || !b.winrate) return { error: "计算器未就绪" };
        return b.winrate();

      case "get_best_leads":
        if (!b || !b.winrateLeads) return { error: "计算器未就绪" };
        return b.winrateLeads();

      case "open_page": {
        var map = { matrix: "matrix.html", route: "route.html", winrate: "winrate.html" };
        var f = map[args.page];
        if (!f) return { error: "未知页面" };
        try {
          window.open(f, "_blank");
          return { ok: true, msg: "已打开 " + f };
        } catch (e) { return { error: e.message }; }
      }

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

  /** 从回答里抠出结构化识别结果 */
  function extractImageData(text) {
    var s = String(text || "");
    var fence = String.fromCharCode(96, 96, 96);
    var re = new RegExp(fence + "json([\\s\\S]*?)" + fence);
    var m = re.exec(s);
    var raw = m ? m[1] : null;
    if (!raw) {
      var m2 = /\{[\s\S]*?"pets"[\s\S]*?\}/.exec(s);
      raw = m2 ? m2[0] : null;
    }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /** 把识别到的精灵导入计算器 */
  function importPets(list, side) {
    var b = bridge();
    if (!b || !b.setPet) return "计算器未就绪";
    var sd = side === "foe" ? "foe" : "mine";
    var ok = 0, miss = [];
    (list || []).slice(0, 6).forEach(function (p, i) {
      var nm = p && p.name ? String(p.name).trim() : "";
      if (!nm) return;
      var r = b.setPet(sd, i, nm);
      if (r && r.ok) {
        ok++;
        if (p.moves && b.setMoves) {
          try { b.switchSlot(sd, i); b.setMoves(sd, p.moves.filter(Boolean)); } catch (e) {}
        }
        if (typeof p.hp === "number" && b.setNumeric) {
          try { b.setNumeric(sd, "hp", p.hp); } catch (e) {}
        }
      } else {
        miss.push(nm);
      }
    });
    return "导入 " + ok + " 只" + (miss.length ? "（未找到：" + miss.join("、") + "）" : "");
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
          '<input id="mmVision" placeholder="视觉模型（看图用）deepseek-flash">' +
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
      if (c.visionModel) box.querySelector("#mmVision").value = c.visionModel;
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
      if (!box.querySelector("#mmModel").value) box.querySelector("#mmModel").value = "deepseek-chat";
      if (!box.querySelector("#mmVision").value) box.querySelector("#mmVision").value = "deepseek-flash";
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
      var vmodel = (box.querySelector("#mmVision").value || "").trim() || "deepseek-flash";
      cfg = { ep: ep, model: model, key: key, visionModel: vmodel };
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

    // 发送 / 停止
    box.querySelector("#mmSend").onclick = function () {
      if (busy && abortCtl) { try { abortCtl.abort(); } catch (e) {} return; }
      send();
    };
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
    "分析我这套阵容",
    "谁的胜率最高",
    "武斗酷猫怎么配队",
    "打开对战矩阵"
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
  var abortCtl = null;

  function setBusy(on) {
    busy = on;
    var btn = box && box.querySelector("#mmSend");
    if (btn) {
      btn.disabled = false;           // 保持可点，用于中断
      btn.classList.toggle("stop", on);
      btn.innerHTML = on ? "■" : "➤";
      btn.title = on ? "停止生成" : "发送";
    }
    if (on) { abortCtl = (typeof AbortController !== "undefined") ? new AbortController() : null; }
    else { abortCtl = null; }
  }

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

    if (/宪法|执行规则/.test(q)) { pushMsg("bot", constitutionMd()); return; }
    var tryOnline = mode === "online" && cfg && cfg.ep && cfg.key && cfg.model;

    if (!tryOnline) {
      setBusy(true);
      var stop = showTyping();
      setTimeout(function () {
        stop();
        var a = answerOffline(q);
        pushMsg("bot", a);
        conv.push({ role: "assistant", content: a });
        trimConv();
        setBusy(false);
      }, 240 + Math.random() * 180);
      return;
    }

    setBusy(true);
    var stop2 = showTyping();

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

    var shownTxt = null;
    answerOnline(q, cfg, onDelta, onTrace).then(function (txt) {
      stop2();
      shownTxt = txt + auditFooter(turnLedger, txt);
      if (bubble) {
        var bd = bubble.querySelector(".mm-msg");
        if (bd) bd.innerHTML = mdToHtml(shownTxt);
        scrollBottom();
      }
      return txt;
    }).then(function (txt) {
      if (!bubble) pushMsg("bot", shownTxt || txt);
      conv.push({ role: "assistant", content: txt });
      trimConv();
      attachRollback(turnLedger);
    }).catch(function (e) {
      stop2();
      var L0 = turnLedger, rolled = "";
      if (L0 && L0.writes && L0.snapshot && window.__miaoRestore && window.__miaoRestore(L0.snapshot))
        rolled = "\n\n⚖ 本轮出错，已自动回滚 " + L0.writes + " 处修改（宪法第3条）";
      // 联网失败 → 自动回落到离线引擎，保证总有答案
      var off = answerOffline(q);
      var fallback = "⚠️ 联网失败：" + e.message + rolled +
        "\n\n（已改用离线数据回答 ↓）\n\n" + off;
      pushMsg("bot", fallback);
      conv.push({ role: "assistant", content: fallback });
      trimConv();
    }).then(function () {
      setBusy(false);
    });
  }

  /** 浮动入口按钮 */
  function bindTeamsBtn() {
    var b = document.getElementById("teamsBtn");
    if (!b || b.__bound) return;
    b.__bound = true;
    b.onclick = function () { if (window.__openTeamsPanel) window.__openTeamsPanel(); };
  }

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
    bindTeamsBtn();
    refreshData();
    build();
    // 恢复上次使用的模式
    if (!opts || !opts.mode) {
      try {
        var saved = JSON.parse(localStorage.getItem("luoke.miao.cfg") || "{}");
        if (saved.mode === "online" && saved.ep && saved.key) {
          setMode("online", { ep: saved.ep, model: saved.model, key: saved.key, visionModel: saved.visionModel });
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
      if (c) { saved.ep = c.ep; saved.model = c.model; saved.key = c.key; saved.visionModel = c.visionModel; }
      localStorage.setItem("luoke.miao.cfg", JSON.stringify(saved));
    } catch (e) {}
    var el = document.getElementById("mmMode");
    if (el) el.textContent = mode === "online" ? "联网·大模型" : "离线·内置数据";
    var dot = document.getElementById("mmLive");
    if (dot) dot.className = "mm-live" + (mode === "online" ? "" : " off");
  }

  /* ============ 最小路径：拼图批量判定 ============ */
  // 把 9 张帧拼成一张图，一次调用问「哪几格有名单」，把 N 次调用压到 N/9

  /** 拼一张 3x3 联络表，格子上标序号 */
  function buildContactSheet(imgs, startIdx) {
    var CW = 300, CH = 169, COLS = 3, ROWS = 3;
    var cv = document.createElement("canvas");
    cv.width = CW * COLS; cv.height = (CH + 18) * ROWS;
    var g = cv.getContext("2d");
    g.fillStyle = "#111";
    g.fillRect(0, 0, cv.width, cv.height);
    imgs.forEach(function (im, i) {
      var cx = (i % COLS) * CW, cy = Math.floor(i / COLS) * (CH + 18);
      try { g.drawImage(im, cx, cy, CW, CH); } catch (e) {}
      g.fillStyle = "rgba(0,0,0,.72)";
      g.fillRect(cx, cy + CH, CW, 18);
      g.fillStyle = "#FFFFFF";
      g.font = "bold 13px sans-serif";
      g.fillText("#" + (startIdx + i + 1), cx + 6, cy + CH + 14);
    });
    return cv.toDataURL("image/jpeg", 0.82);
  }

  var SCREEN_PROMPT = [
    "这是一张联络表，由多张游戏截图拼成，每格左上/下方有白色编号（如 #1、#2）。",
    "任务是判断哪几格里有「精灵名单」：",
    "• 「场下精灵」面板：竖排 4-6 个精灵名+血条+等级",
    "• 「一图流」配队图：网格排列的精灵头像和名字",
    "• 开场一排队友头像",
    "只输出 JSON，不要解释：",
    '{"hits":[1,4,7],"note":"简要说明"}',
    "没有就输出 {\"hits\":[]}。宁可漏判也不要乱判。"
  ].join("\n");

  /** 对选中的帧做批量初筛，返回命中的下标数组 */
  function screenFrames(items, groupSize, onProgress) {
    groupSize = groupSize || 9;
    var groups = [];
    for (var i = 0; i < items.length; i += groupSize) groups.push(items.slice(i, i + groupSize));

    var hits = [];
    var done = 0;
    return groups.reduce(function (chain, grp, gi) {
      return chain.then(function () {
        var start = gi * groupSize;
        return Promise.all(grp.map(function (x) {
          return loadImg(x.cover).catch(function () { return null; });
        })).then(function (imgs) {
          var valid = imgs.filter(Boolean);
          if (valid.length < 2) return null;
          var sheet = buildContactSheet(valid, start);
          if (onProgress) onProgress(done + 1, groups.length, "初筛 " + (done + 1) + "/" + groups.length);
          return visionCall(sheet, SCREEN_PROMPT).then(function (txt) {
            var m = /\{[\s\S]*?\}/.exec(txt);
            if (m) {
              try {
                var j = JSON.parse(m[0]);
                (j.hits || []).forEach(function (n) {
                  var idx = Number(n) - 1;
                  if (idx >= 0 && idx < start + valid.length) hits.push(idx);
                });
              } catch (e) {}
            }
          }).catch(function (e) {
            if (onProgress) onProgress(done + 1, groups.length, "初筛失败：" + e.message.slice(0, 30));
          });
        }).then(function () { done++; });
      });
    }, Promise.resolve()).then(function () {
      return hits.filter(function (v, i, a) { return a.indexOf(v) === i; });
    });
  }

  /* ============ 封面批量识别（B 方案） ============ */
  /** 调一次视觉模型，返回文本 */
  function visionCall(dataUrl, prompt) {
    if (!cfg || !cfg.ep || !cfg.key) return Promise.reject(new Error("先在喵喵设置里填 API Key"));
    var model = cfg.visionModel || "deepseek-flash";
    var body = {
      model: model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 900
    };
    return fetch(cfg.ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = {};
        try { j = JSON.parse(t); } catch (e) {}
        if (j.error) throw new Error(j.error.message || "接口报错");
        var c2 = (((j.choices || [])[0] || {}).message || {}).content || "";
        if (!c2) throw new Error("模型没返回内容");
        return c2;
      });
    });
  }

  /** URL 图片转 dataURL（bilibili 封面 CORS 是 *，可直接读） */
  function urlToDataUrl(url) {
    // B站图有防盗链：带本站 Referer 会 403，必须不传 Referer
    return fetch(url, { referrerPolicy: "no-referrer", credentials: "omit" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var rd = new FileReader();
        rd.onload = function () { resolve(String(rd.result)); };
        rd.onerror = reject;
        rd.readAsDataURL(blob);
      });
    });
  }

  /** 给帧打「疑似配队画面」分：深色面板 + 文字边缘多 → 高分
   *  场下精灵面板 = 中央半透明深色矩形 + 白色文字，用它做启发式 */
  function scoreFrameImage(img) {
    try {
      var W = 160, H = 90;
      var cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      var g = cv.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, W, H);
      var px = g.getImageData(0, 0, W, H).data;
      var x0 = Math.floor(W * 0.32), x1 = Math.floor(W * 0.68);
      var y0 = Math.floor(H * 0.18), y1 = Math.floor(H * 0.88);
      var lum = new Float32Array(W * H);
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var i = (y * W + x) * 4;
          lum[y * W + x] = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        }
      }
      var sum = 0, n = 0, edge = 0, bright = 0;
      for (var yy = y0; yy < y1; yy++) {
        for (var xx = x0; xx < x1; xx++) {
          var k = yy * W + xx;
          var L = lum[k];
          sum += L; n++;
          if (L > 210) bright++;
          if (xx > x0 && Math.abs(L - lum[k - 1]) > 42) edge++;
          if (yy > y0 && Math.abs(L - lum[k - W]) > 42) edge++;
        }
      }
      if (!n) return 0;
      var dark = 1 - (sum / n) / 255;          // 越暗越高
      var edgeRate = edge / (n * 2);           // 文字边缘密度
      var brightRate = bright / n;             // 白字占比
      // 深色底 + 有字 → 像 UI 面板
      var score = dark * 0.45 + Math.min(edgeRate * 4, 1) * 0.35 + Math.min(brightRate * 6, 1) * 0.2;
      return Math.round(score * 100);
    } catch (e) { return 0; }
  }

  /** 加载图片（同源，可直接 canvas） */
  function loadImg(url) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = url;
    });
  }

  var FRAME_PROMPT = [
    "这是洛克王国对战的游戏画面。请找出画面里有没有精灵名单。",
    "常见形式：",
    "1) 「场下精灵」面板：竖排 4-6 个精灵名，带血条和等级（如 50级）",
    "2) 「一图流」配队图：网格排列的精灵头像+名字",
    "3) 开场阵容预览：一排精灵头像",
    "如果有，输出 JSON（只输出 JSON，不要解释）：",
    '{"pets":["精灵名1","精灵名2","精灵名3","精灵名4"],"confidence":"high或low","note":"来源"}\n',
    "",
    "规则：",
    "- 只认精灵名，别把招式名、玩家名、弹幕文字算进去",
    "- 按画面从上到下顺序列出",
    "- 画面里没有名单 → 输出 {\"pets\":[],\"confidence\":\"low\",\"note\":\"无名单\"}",
    "- 不要编造"
  ].join("\n");

  var COVER_PROMPT = [
    "这是洛克王国的视频封面/一图流。",
    "如果图里列出了精灵队伍（通常 4-8 只精灵名，可能带招式），按下面格式只输出 JSON，不要任何解释：",
    '{"pets":["精灵名1","精灵名2","精灵名3","精灵名4"],"confidence":"high或low","note":"补充说明"}',
    "规则：",
    "- 只认精灵名，不要招式名、不要玩家名、不要标题文字",
    "- 看不清或图里没有精灵列表 → 输出 {\"pets\":[],\"confidence\":\"low\",\"note\":\"图里没有队伍\"}",
    "- 不要编造"
  ].join("\n");

  /** 打开封面识别面板 */
  function recognizeCovers(source) {
    source = source === "frame" ? "frame" : "cover";
    var isFrame = source === "frame";
    var old = document.getElementById("coverMask");
    if (old) old.remove();
    if (!cfg || !cfg.ep || !cfg.key) {
      alert("先点喵喵右上角 ⚙ 打开设置，填好 API Key 和视觉模型（如 deepseek-flash）");
      return;
    }
    var mask = document.createElement("div");
    mask.id = "coverMask";
    mask.className = "cover-mask";
    mask.innerHTML = [
      '<div class="cover-box">',
      '  <div class="cover-hd"><b>' + (isFrame ? "视频帧识别" : "B站封面识别") + '</b>',
      '    <span class="cover-sub">勾选' + (isFrame ? "帧" : "封面") + ' → 视觉模型识别阵容 → 存入队伍库</span>',
      '    <button type="button" class="cover-x" id="coverClose">×</button></div>',
      '  <div class="cover-bar">',
      '    <button type="button" class="teams-btn primary" id="coverRun">识别选中</button>',
      '    <button type="button" class="teams-btn" id="coverScreen" title="9 张拼一次调用，先挑出有名单的帧">批量初筛（省调用）</button>',
      '    <button type="button" class="teams-btn" id="coverAll">全选</button>',
      '    <span class="cover-status" id="coverStatus">正在读取采集结果…</span>',
      '  </div>',
      '  <div class="cover-grid" id="coverGrid"></div>',
      '  <div class="cover-out" id="coverOut"></div>',
      '</div>'
    ].join("");
    document.body.appendChild(mask);
    mask.querySelector("#coverClose").onclick = function () { mask.remove(); };
    mask.onclick = function (e) { if (e.target === mask) mask.remove(); };

    var items = [];
    var grid = mask.querySelector("#coverGrid");
    var status = mask.querySelector("#coverStatus");

    (isFrame ? fetch("frames-index.json?t=" + Date.now()) : fetch("teams-collected.json?t=" + Date.now()))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var ev = isFrame ? (Array.isArray(j) ? j : []) : ((j && j.evidence) || []);
        items = isFrame
          ? ev.map(function (x) { return { cover: x.file, title: x.title, bvid: x.bvid, frame: x.frame }; })
          : ev.filter(function (x) { return x.cover; }).slice(0, 40);
        items = items.slice(0, 60);
        if (!items.length) {
          grid.innerHTML = '<div class="teams-empty">' + (isFrame
            ? '还没有抽帧。先在本机跑：<br><code>node tools/bili-frames.mjs --from-collected --limit 3</code>'
            : '采集结果里没有封面。先在本机跑：<br><code>node tools/bili-collect.mjs</code>') + '</div>';
          status.textContent = "";
          return;
        }
        if (isFrame) {
          // 先渲染占位，再逐张评分排序
          grid.innerHTML = items.map(function (x, i) {
            return '<label class="cover-item" data-i="' + i + '">' +
              '<input type="checkbox" value="' + i + '">' +
              '<img src="' + x.cover + '" loading="lazy" alt="">' +
              '<span class="cover-score"></span>' +
              '<span class="cover-t">第 ' + ((Number(x.frame) || 0) + 1) + ' 帧</span></label>';
          }).join("");
          status.textContent = "分析画面中…（自动挑出像配队画面的）";
          var scored = [];
          Promise.all(items.map(function (x, i) {
            return loadImg(x.cover).then(function (im) {
              scored.push({ i: i, s: scoreFrameImage(im) });
            }).catch(function () { scored.push({ i: i, s: 0 }); });
          })).then(function () {
            scored.sort(function (a, b) { return b.s - a.s; });
            var cut = scored.length ? Math.max(scored[0].s * 0.55, 32) : 0;
            var picked = 0;
            scored.forEach(function (o) {
              var lab = grid.querySelector('[data-i="' + o.i + '"]');
              if (!lab) return;
              var cb = lab.querySelector("input");
              var sc = lab.querySelector(".cover-score");
              sc.textContent = "疑似度 " + o.s;
              lab.classList.add(o.s >= cut ? "hot" : "cold");
              if (o.s >= cut && picked < 8) { cb.checked = true; picked++; }
            });
            status.textContent = "共 " + items.length + " 帧 · 已自动勾选最像配队的 " + picked + " 张（可自己改）";
          });
          return;
        }
        grid.innerHTML = items.map(function (x, i) {
          return '<label class="cover-item"><input type="checkbox" value="' + i + '" checked>' +
            '<img src="' + x.cover + '" loading="lazy" alt="" referrerpolicy="no-referrer">' +
            '<span class="cover-t">' + String(x.title || "").slice(0, 22) + '</span></label>';
        }).join("");
        status.textContent = "共 " + items.length + " 张封面（已全选）";
      })
      .catch(function (e) {
        grid.innerHTML = '<div class="teams-empty">读取失败：' + e.message + '</div>';
        status.textContent = "";
      });

    mask.querySelector("#coverAll").onclick = function () {
      Array.prototype.forEach.call(grid.querySelectorAll("input[type=checkbox]"), function (c) { c.checked = true; });
    };

    // 批量初筛：9 张拼一次调用，只勾有名单的
    var screening = false;
    mask.querySelector("#coverScreen").onclick = function () {
      if (screening) return;
      if (!items.length) { alert("先等缩略图加载完"); return; }
      screening = true;
      var btn = this;
      btn.disabled = true;
      var out = mask.querySelector("#coverOut");
      out.innerHTML = "";
      screenFrames(items, 9, function (i, n, t) {
        status.textContent = t;
      }).then(function (hits) {
        Array.prototype.forEach.call(grid.querySelectorAll("input[type=checkbox]"), function (c) { c.checked = false; });
        hits.forEach(function (i) {
          var cb = grid.querySelector('input[value="' + i + '"]');
          if (cb) cb.checked = true;
          var lab = grid.querySelector('[data-i="' + i + '"]');
          if (lab) lab.classList.add("hot");
        });
        var saved = items.length - Math.ceil(items.length / 9) - hits.length;
        status.textContent = "初筛完成：命中 " + hits.length + " 帧 · 已勾选（约省下 " +
          Math.max(0, saved) + " 次调用）";
        out.innerHTML = '<div class="cover-line done">批量初筛用了 ' + Math.ceil(items.length / 9) +
          ' 次调用，筛出 ' + hits.length + ' 帧有名单</div>';
        screening = false;
        btn.disabled = false;
      }).catch(function (e) {
        status.textContent = "初筛失败：" + e.message.slice(0, 40);
        screening = false;
        btn.disabled = false;
      });
    };

    var running = false;
    mask.querySelector("#coverRun").onclick = function () {
      if (running) return;
      var idx = Array.prototype.filter.call(grid.querySelectorAll("input[type=checkbox]"), function (c) { return c.checked; })
        .map(function (c) { return Number(c.value); });
      if (!idx.length) { alert("先勾选封面"); return; }
      running = true;
      var out = mask.querySelector("#coverOut");
      out.innerHTML = "";
      var ok = 0, empty = 0, fail = 0;
      var pos = 0;

      function next() {
        if (pos >= idx.length) {
          status.textContent = "完成：识别出 " + ok + " 套 · 无队伍 " + empty + " 张 · 失败 " + fail + " 张";
          running = false;
          return;
        }
        var it = items[idx[pos]];
        pos++;
        status.textContent = "识别中 " + pos + "/" + idx.length + "（已存 " + ok + " 套）";
        var line = document.createElement("div");
        line.className = "cover-line";
        line.textContent = "⏳ " + String(it.title || "").slice(0, 26);
        out.appendChild(line);
        out.scrollTop = out.scrollHeight;

        var STRICT = (isFrame ? FRAME_PROMPT : COVER_PROMPT) +
          "\n\n【重要】上一轮识别可能不准。这次只输出你 100% 确定的精灵名，宁可少写不要猜。";

        urlToDataUrl(it.cover)
          .then(function (du) {
            return visionCall(du, isFrame ? FRAME_PROMPT : COVER_PROMPT).catch(function () {
              return visionCall(du, STRICT);
            });
          })
          .then(function (txt) {
            var data = extractImageData(txt);
            var pets = (data && data.pets) || [];
            // 校验没过 → 用严格模式重试一次
            if (pets.length < 4 || !(window.MiaoBridge && window.MiaoBridge.validateTeam && window.MiaoBridge.validateTeam(pets).ok)) {
              return urlToDataUrl(it.cover)
                .then(function (du2) { return visionCall(du2, STRICT); })
                .then(function (txt2) {
                  var d2 = extractImageData(txt2);
                  var p2 = (d2 && d2.pets) || [];
                  return p2.length >= pets.length ? p2 : pets;
                })
                .catch(function () { return pets; });
            }
            return pets;
          })
          .then(function (pets) {
            if (!Array.isArray(pets) || pets.length < 4) {
              empty++;
              line.className = "cover-line skip";
              line.textContent = "— " + String(it.title || "").slice(0, 24) + "（没识别出队伍）";
              return;
            }
            var b = bridge();
            var nm = pets.slice(0, 2).join("·") + "队" + (it.bvid ? "(" + String(it.bvid).slice(2, 8) + ")" : "");
            var note = (it.title || "") + (it.bvid ? " · " + it.bvid : "");
            var r = b && b.saveTeamValidated
              ? b.saveTeamValidated(nm, pets, { src: isFrame ? "视频帧" : "封面", note: note })
              : { ok: false, msg: "检验接口未就绪" };
            if (r && r.ok) {
              ok++;
              line.className = "cover-line done";
              line.textContent = (r.merged ? "✓ 重复队（证据 " + r.votes + "）" : "✓ " + r.team.name + "：" + r.check.pets.join("、")) +
                (r.check.fixed && r.check.fixed.length ? "（纠正 " + r.check.fixed.length + "）" : "");
              var eb = document.createElement("button");
              eb.type = "button";
              eb.className = "cover-edit";
              eb.textContent = "改一下";
              eb.onclick = function () {
                if (window.__openTeamEdit) window.__openTeamEdit(r.team.id);
              };
              line.appendChild(eb);
            } else {
              fail++;
              line.className = "cover-line fail";
              line.textContent = "✗ " + (r && r.msg || "存失败");
            }
          })
          .catch(function (e) {
            fail++;
            line.className = "cover-line fail";
            line.textContent = "✗ " + String(it.title || "").slice(0, 20) + " — " + e.message.slice(0, 40);
          })
          .then(function () {
            out.scrollTop = out.scrollHeight;
            setTimeout(next, 400);
          });
      }
      next();
    };
  }

  window.Miao = {
    constitution: constitutionMd,
    recognizeCovers: recognizeCovers,
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindTeamsBtn);
  else bindTeamsBtn();

})();
