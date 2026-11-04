(function () {
  var PETS = (window.PETS || []).slice();
  var SKILLS = (window.SKILLS || []).slice();
  var NATURES = (window.NATURES || []).slice();
  var TYPES = window.TYPES || {};
  var $ = function (id) { return document.getElementById(id); };
  var byName = function (n) { return PETS.filter(function (p) { return p.n === n; })[0] || null; };
  var byId = function (id) { return SKILLS.filter(function (s) { return s.id === Number(id); })[0] || null; };

  // 数据里没有的技能：允许手填威力/属性/分类（bwiki 也查不到的先占位）
  var CUSTOM_SEED = { "愿力冲击": { n: "愿力冲击", p: 80, e: "普通", t: "物攻", c: 3, wish: true } };

  function customOf(name) {
    return (state.custom && state.custom[name]) || CUSTOM_SEED[name] || null;
  }
  function skillByName(name) {
    var hit = SKILLS.filter(function (x) { return x.n === name; })[0];
    if (hit) return hit;
    var c = (state.custom && state.custom[name]) || null;
    var seed = CUSTOM_SEED[name] || null;
    if (!c) return seed;
    if (seed) {
      return Object.assign({}, seed, c, { p: c.p || seed.p, e: c.e || seed.e, t: c.t || seed.t, c: c.c || seed.c });
    }
    return c;
  }

  function natureFactor(nature, stat, stars) {
    if (!nature) return 1;
    if (nature.up === stat) return 1.1 + 0.02 * stars;
    if (nature.down === stat) return 0.9;
    return 1;
  }
  function computeStats(pet, o) {
    var L = +o.level || 60, SS = Number(o.stars);
    if (!Number.isFinite(SS)) SS = 5;
    var ivs = o.iv || {};
    function ik(key) {
      var v = Number(ivs[key]);
      return (Number.isFinite(v) ? v : 10) * (1 + SS);
    }
    function c(stat) { return natureFactor(o.nature, stat, SS); }
    function nonHp(S, stat, key) {
      return 10 * SS + Math.round(c(stat) * Math.round((0.01 * L + 0.5) * (S + 0.5 * ik(key)) + 10));
    }
    return {
      hp: 20 * SS + Math.round(c("生命") * Math.round((0.02 * L + 0.5) * (pet.hp + 0.5 * ik("hp")) + L + 10)),
      atk: nonHp(pet.atk, "物攻", "atk"), ma: nonHp(pet.ma, "魔攻", "ma"),
      def: nonHp(pet.def, "物防", "def"), md: nonHp(pet.md, "魔防", "md"),
      spe: nonHp(pet.spe, "速度", "spe")
    };
  }
  function typeMult(e, pet) {
    var chart = TYPES[e];
    if (!chart) return 1;
    var add = 0, half = 0;
    [pet.el, pet.el2].filter(Boolean).forEach(function (t) {
      if ((chart.strong || []).indexOf(t) >= 0) add += 1;
      if ((chart.resist || []).indexOf(t) >= 0) half += 1;
    });
    return (1 + add) * Math.pow(0.5, half);
  }
  // ---- 特性加成：从官方描述里解析 ----
  // 只处理能用现有状态判断的；判断不了的一律标记“未计入”，不静默忽略
  function traitInfo(pet, sk, ctx, side) {
    var d = pet.td || "";
    var out = { mult: 1, notes: [], skipped: [] };
    var handled = false;
    if (!d) return out;
    var m;

    // 双攻/物攻/魔攻 +N%（无条件或“使用 X 系技能后”）
    if ((m = /使用([\u4e00-\u9fa5])系技能后[^。]{0,24}?双攻(?:永久)?\+(\d+)%?/.exec(d))) {
      handled = true;
      if (m[1] === sk.e) { out.mult *= 1 + Number(m[2]) / 100; out.notes.push("双攻+" + m[2] + "%"); }
    } else if ((m = /双攻(?:永久)?\+(\d+)%?/.exec(d)) && !/入场|队伍|每有|击败|蓄力|天气|雨天|环境|魔力值|若/.test(d)) {
      out.mult *= 1 + Number(m[1]) / 100; out.notes.push("双攻+" + m[1] + "%");
    }
    if (sk.t === "物攻" && (m = /物攻\+(\d+)%?/.exec(d)) && !/入场|每次行动/.test(d)) {
      out.mult *= 1 + Number(m[1]) / 100; out.notes.push("物攻+" + m[1] + "%");
    }

    // 技能威力 +N%（带条件）
    if ((m = /威力\+(\d+)%?/.exec(d)) && !(/迸发/.test(d) && m[0].indexOf("%") < 0)) {
      handled = true;
      var pct = Number(m[1]);
      var ok = false, why = "";
      if (/若先于敌方攻击/.test(d)) { ok = !!ctx.first; why = ok ? "先手" : "需先手（未勾选）"; }
      else if (/能耗为(\d+)的技能/.test(d)) {
        var c1 = Number(/能耗为(\d+)的技能/.exec(d)[1]);
        ok = sk.c === c1; why = ok ? "能耗 " + c1 : "能耗不匹配";
      } else if (/能耗大于(\d+)的技能/.test(d)) {
        var c2 = Number(/能耗大于(\d+)的技能/.exec(d)[1]);
        ok = sk.c > c2; why = ok ? "高耗能" : "能耗不匹配";
      } else if (/非本系技能/.test(d)) {
        ok = !isStab(sk, pet); why = ok ? "非本系" : "本系不触发";
      } else if (/非光系技能/.test(d)) {
        ok = sk.e !== "光"; why = ok ? "非光系" : "光系不触发";
      } else if (/地系技能/.test(d)) {
        ok = sk.e === "地"; why = ok ? "地系" : "非地系";
      } else if (/星陨印记/.test(d)) {
        var stacks = 0;
        ((state.buffs && state.buffs[side === "mine" ? "foe" : "mine"]) || []).forEach(function (b) {
          if (b.n.indexOf("星陨") >= 0) stacks += Math.max(1, Number(b.st) || 1);
        });
        ok = stacks > 0; why = "星陨 " + stacks + " 层";
        if (ok) out.mult *= 1 + pct / 100 * stacks, out.notes.push("星陨×" + stacks + " 威力+" + (pct * stacks) + "%"), ok = false;
      } else if (!/入场|队伍|每有|力竭|击败|蓄力|入场时/.test(d)) {
        ok = true; why = "无条件";
      }
      if (ok) { out.mult *= 1 + pct / 100; out.notes.push("威力+" + pct + "%（" + why + "）"); }
      else if (!/星陨/.test(d) && !/入场|队伍|每有|力竭|击败/.test(d)) out.skipped.push("威力+" + pct + "%（" + why + "）");
    }

    // 队伍同系计数：每有 1 只其他 X 系精灵 → 双攻/攻防 +N%（只按双攻部分参与伤害）
    if (!handled && (m = /队伍(?:中)?每有1只其他的?([\u4e00-\u9fa5])系精灵[^。]*?\+(\d+)%/.exec(d))) {
      handled = true;
      var same = (ctx.team || []).filter(function (x) { return x.n !== pet.n && (x.el === m[1] || x.el2 === m[1]); }).length;
      if (same > 0) { out.mult *= 1 + Number(m[2]) * same / 100; out.notes.push(m[1] + "系同伴 " + same + " 只 → +" + (Number(m[2]) * same) + "%"); }
      else out.skipped.push("队伍里没有其他" + m[1] + "系");
    }
    // 队伍存在 X 系精灵 → 双攻 +N%
    if (!handled && (m = /队伍存在([\u4e00-\u9fa5])系精灵[^。]*?双攻\+(\d+)%?/.exec(d))) {
      handled = true;
      var hasIt = (ctx.team || []).some(function (x) { return x.el === m[1] || x.el2 === m[1]; });
      if (hasIt) { out.mult *= 1 + Number(m[2]) / 100; out.notes.push("队伍有" + m[1] + "系 → 双攻+" + m[2] + "%"); }
      else out.skipped.push("队伍缺少" + m[1] + "系");
    }
    // 天气相关
    if (!handled && /天气为雨天/.test(d) && /双攻\+(\d+)%?/.test(d)) {
      handled = true;
      var pctW = Number(/双攻\+(\d+)%?/.exec(d)[1]);
      if (ctx.weather === "rain") { out.mult *= 1 + pctW / 100; out.notes.push("雨天 → 双攻+" + pctW + "%"); }
      else out.skipped.push("非雨天");
    }
    // 魔力值条件（己方/敌方）
    if (!handled && (m = /若(自己|敌方)魔力值为(\d+)[^。]*?双攻\+(\d+)%?/.exec(d))) {
      handled = true;
      var v = m[1] === "自己" ? ctx.mana : ctx.enemyMana;
      if (v === Number(m[2])) { out.mult *= 1 + Number(m[3]) / 100; out.notes.push("魔力值 " + v + " → 双攻+" + m[3] + "%"); }
      else out.skipped.push("魔力值不符（当前 " + v + "）");
    }
    // 能耗为 N 的技能 → 攻防/双攻 +N%（攻防只取伤害部分）
    if (!handled && (m = /使用能耗为(\d+)的技能(?:时|后)[^。]*?(?:双攻|攻防)(?:永久)?\+(\d+)%?/.exec(d))) {
      handled = true;
      if (Number(m[1]) === sk.c) { out.mult *= 1 + Number(m[2]) / 100; out.notes.push("能耗 " + m[1] + " → +" + m[2] + "%"); }
    }
    // 每入场 N 次累积
    if (!handled && (m = /每入场1次[^。]*?双攻(?:永久)?\+(\d+)%?/.exec(d))) {
      handled = true;
      var e1 = Number((ctx.counters || {}).entry) || 0;
      if (e1 > 0) { out.mult *= Math.pow(1 + Number(m[1]) / 100, e1); out.notes.push("入场 " + e1 + " 次 → ×" + (Math.pow(1 + Number(m[1]) / 100, e1)).toFixed(2)); }
    }
    // 队伍中每有 1 只力竭 → 双攻+N%
    if (!handled && (m = /(己方队伍中|双方队伍中)每有1只力竭的精灵[^。]*?双攻\+(\d+)%?/.exec(d))) {
      handled = true;
      var c2 = ctx.counters || {};
      var n2 = m[1] === "己方队伍中" ? (Number(c2.faintMine) || 0) : ((Number(c2.faintMine) || 0) + (Number(c2.faintFoe) || 0));
      if (n2 > 0) { out.mult *= 1 + Number(m[2]) * n2 / 100; out.notes.push("力竭 " + n2 + " 只 → +" + (Number(m[2]) * n2) + "%"); }
    }
    // 应对成功后永久 +N%
    if (!handled && (m = /应对成功后[^。]*?双攻(?:永久)?\+(\d+)%?/.exec(d))) {
      handled = true;
      var c3 = Number((ctx.counters || {}).counter) || 0;
      if (c3 > 0) { out.mult *= Math.pow(1 + Number(m[1]) / 100, c3); out.notes.push("应对 " + c3 + " 次 → ×" + Math.pow(1 + Number(m[1]) / 100, c3).toFixed(2)); }
    }

    // 纯防御类（双防/攻防中含防）——不参与伤害，标注但不误导
    if (!handled && /(双防|攻防)\+(\d+)%/.test(d) && !/双攻/.test(d)) {
      handled = true;
      out.skipped.push("只加防御，不影响伤害");
    }

    if (!handled && !out.notes.length && !out.skipped.length && /[+＋]\d+%/.test(d)) {
      // 事件类特性：需要实战里发生某件事才触发，不是“算不出来”
      if (/造成克制伤害|入场|离场|击败|力竭时|每次行动|每使用|蓄力|回合开始/.test(d)) out.skipped.push("实战触发（需那一回合发生）");
      else out.skipped.push("条件无法自动判断");
    }
    return out;
  }

  function traitMult(pet, sk, ctx, side) {
    return traitInfo(pet, sk, ctx || {}, side || "mine").mult;
  }

  var DEFAULT_MOVES = {
    mine: ["岩脉崩毁", "持续高温", "一拳", "冰晶坠"],
    foe: ["电弧", "交叉闪电", "翼击", "暴风眼"]
  };

  var KEY = "luoke.calc.v2";
  var state = {
    mine: { st: { mark: 0, wind: 0, charge: 0, photo: 0, spike: 0, slow: 0, combo: 1, poison: 0, burn: 0 }, slots: PETS.slice(0, 6).map(function (p) { return p.n; }), active: 0, level: 60, star: 5, iv: { hp: 10, atk: 10, def: 10, ma: 10, md: 10, spe: 10 }, nature: "", hp: 400, energy: 5, mana: 4, priority: 0, status: "健康", moves: ["", "", "", ""] },
    foe: { st: { mark: 0, wind: 0, charge: 0, photo: 0, spike: 0, slow: 0, combo: 1, poison: 0, burn: 0 }, slots: PETS.slice(6, 12).map(function (p) { return p.n; }), active: 0, level: 60, star: 5, iv: { hp: 10, atk: 10, def: 10, ma: 10, md: 10, spe: 10 }, nature: "", hp: 300, energy: 5, mana: 4, priority: 0, status: "健康", moves: ["", "", "", ""] },
    coef: 1, formulaV2: true, seed: Math.floor(Math.random() * 1e9), weather: "", cut: 0, buffs: { mine: [], foe: [] }, mark: 0, combo: 1, custom: {}, foeStatusSkill: false, roles: {}, history: [], uiAction: "attack", buffs: { mine: [], foe: [] }, doubles: false, firstThisTurn: false, lock: { mine: 0, foe: 0 }, freeze: { mine: 0, foe: 0 }, lead: { mine: 0, foe: 0 }, charging: { mine: null, foe: null }, chargeMeta: { mine: null, foe: null }, noCharge: { mine: false, foe: false }, devotion: { mine: { pow: 0, cost: 0, combo: 0, drain: 0, poison: 0 }, foe: { pow: 0, cost: 0, combo: 0, drain: 0, poison: 0 } }, counters: { entry: 0, faintMine: 0, faintFoe: 0, counter: 0 }
  };
  function normalizeSave(saved) {
    if (!saved || typeof saved !== "object") return;
    ["mine", "foe"].forEach(function (side) {
      var base = state[side], got = saved[side] || {};
      var merged = Object.assign({}, base, got);
      if (!Array.isArray(merged.moves) || !merged.moves.length) merged.moves = DEFAULT_MOVES[side].slice();
      while (merged.moves.length < 4) merged.moves.push("");
      if (!merged.st || typeof merged.st !== "object") merged.st = base.st;
      if (typeof merged.iv === "number") {
        merged.iv = { hp: merged.iv, atk: merged.iv, def: merged.iv, ma: merged.iv, md: merged.iv, spe: merged.iv };
      }
      if (!Array.isArray(merged.slots) || !merged.slots.length) merged.slots = base.slots;
      state[side] = merged;
    });
    if (typeof saved.coef === "number") state.coef = saved.coef;
    if (!saved.formulaV2) {
      // 旧公式 = 威力×攻防×克制×…×系数；新公式多了 37/41 与本系 1.25，按本系校准折算一次
      state.coef = (Number(state.coef) || 1) / DMG_CORE / STAB;
      state.formulaV2 = true;
    }
    if (saved.seed) state.seed = saved.seed;
    if (saved.custom && typeof saved.custom === "object") state.custom = saved.custom;
    if (Array.isArray(saved.history)) state.history = saved.history;
    ["mine", "foe"].forEach(function (side) {
      var list = (state.buffs && state.buffs[side]) || [];
      state.buffs[side] = list.map(function (b) {
        return typeof b === "string" ? { n: b, st: 1, t: -1 } : b;
      });
    });
    if (saved.uiAction) state.uiAction = saved.uiAction;
  }

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) normalizeSave(saved);
  } catch (e) {}

  // 分享链接优先级最高：链接里带的配置覆盖本地存档
  var fromShare = applyShare();

  function save() {
    if (window.__bc) { try { window.__bc.postMessage({ type: "state", state: state }); } catch (e) {} } try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var sidePet = function (side) { return byName(state[side].slots[state[side].active]) || PETS[0]; };
  function sideStats(side) {
    var pet = sidePet(side), s = state[side];
    var nature = NATURES.filter(function (n) { return n.n === s.nature; })[0] || null;
    return { pet: pet, stats: computeStats(pet, { level: s.level, stars: s.star, iv: s.iv, nature: nature }) };
  }

  // 定位（三层）：状态位 / 联防位 / 收割位
  // 先看特性语义，再看种族值分布，最后看技能池倾向
  var ROLE = {
    info: { key: "info", label: "状态位", cls: "r-info", desc: "试探、压首轮能量、挂状态" },
    tank: { key: "tank", label: "联防位", cls: "r-tank", desc: "吃伤害、打断能量、保轮转" },
    sweep: { key: "sweep", label: "收割位", cls: "r-sweep", desc: "进斩杀线后收人头" }
  };
  var ROLE_CACHE = {};

  // 用全库分位数打分，避免“人人都像联防位”
  var RANK = null;
  function buildRanks() {
    var byAtk = PETS.map(function (x) { return Math.max(x.atk, x.ma); }).sort(function (a, b) { return a - b; });
    var byBulk = PETS.map(function (x) { return (x.hp * 1.2 + x.def + x.md) / 3; }).sort(function (a, b) { return a - b; });
    var bySpe = PETS.map(function (x) { return x.spe; }).sort(function (a, b) { return a - b; });
    function pct(arr, v) {
      var lo = 0, hi = arr.length;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (arr[mid] < v) lo = mid + 1; else hi = mid; }
      return lo / arr.length;
    }
    return { atk: pct.bind(null, byAtk), bulk: pct.bind(null, byBulk), spe: pct.bind(null, bySpe) };
  }

  function roleOf(pet) {
    if (state.roles && state.roles[pet.n]) return state.roles[pet.n];
    if (ROLE_CACHE[pet.n]) return ROLE_CACHE[pet.n];
    if (!RANK) RANK = buildRanks();
    var t = (pet.t || "") + " " + (pet.td || "");
    var atk = Math.max(pet.atk, pet.ma);
    var bulk = (pet.hp * 1.2 + pet.def + pet.md) / 3;

    var rAtk = RANK.atk(atk), rBulk = RANK.bulk(bulk), rSpe = RANK.spe(pet.spe);
    var score = {
      info: 1.6 + (1 - rAtk) * 0.8,
      tank: rBulk * 3.2,
      sweep: rAtk * 2.4 + rSpe * 0.8
    };
    if (/中毒|灼烧|冻结|印记|削弱|干扰|控制|能耗\+|偷取|驱散|渗透|侵蚀|增益/.test(t)) score.info += 1.4;
    if (/减伤|承受|抵挡|护盾|守护|坚韧|回复|再生|治疗|吸血|力竭时/.test(t)) score.tank += 1.2;
    if (/击败|收割|斩杀|连击数\+|爆发|提速|先于敌方|迅捷|追击/.test(t)) score.sweep += 1.2;
    if (/应对/.test(t)) score.info += 0.5;

    var best = "info";
    if (score.tank > score[best]) best = "tank";
    if (score.sweep > score[best]) best = "sweep";
    if (best === "tank" && score.sweep >= score.tank - 0.25 && atk >= 120) best = "sweep";
    ROLE_CACHE[pet.n] = best;
    return best;
  }

  // 图例
  function renderRoleLegend() {
    var box = document.getElementById("roleLegend");
    var box2 = document.getElementById("roleLegendFoe");
    if (!box && !box2) return;
    var counts = { info: 0, tank: 0, sweep: 0 };
    PETS.forEach(function (x) { counts[roleOf(x)] += 1; });
    var html = Object.keys(ROLE).map(function (k) {
      return "<span class='legend " + ROLE[k].cls + "'><b>" + ROLE[k].label + "</b> " + ROLE[k].desc +
        "（全库 " + counts[k] + " 只）</span>";
    }).join("");
    if (box) box.innerHTML = html;
    if (box2) box2.innerHTML = html;
  }

  // 元素色
  function elColor(el) {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--el-" + el);
    return (v || "").trim() || "#999";
  }

  function renderSlots(side) {
    var box = $(side + "Slots");
    box.innerHTML = "";
    state[side].slots.forEach(function (name, i) {
      var pet = byName(name);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "slot" + (i === state[side].active ? " on" : "");
      b.style.background = pet ? elColor(pet.el) + "22" : "#fff";
      var role = pet ? ROLE[roleOf(pet)] : null;
      if (pet) b.title = pet.n + "｜" + (pet.t || "") + "｜" + (role ? role.label + "：" + role.desc : "");
      var img = pet && window.SPRITES && window.SPRITES[pet.n] ? "<img class='slot-img' src='" + window.SPRITES[pet.n] + "' alt='' loading='lazy'>" : "";
      b.innerHTML = (role ? "<em class='slot-role " + role.cls + "'>" + role.label + "</em>" : "") +
        img + "<span>" + (name || "空") + "</span>" + (pet ? "<i class='dot' style='background:" + elColor(pet.el) + "'></i>" : "");
      b.addEventListener("click", function (ev) {
        if (ev.target && ev.target.classList && ev.target.classList.contains("slot-role") && pet) {
          var order = ["info", "tank", "sweep"];
          var cur = roleOf(pet);
          state.roles = state.roles || {};
          state.roles[pet.n] = order[(order.indexOf(cur) + 1) % 3];
          save(); renderAll();
          return;
        }
        state[side].active = i; save(); renderAll();
      });
      box.appendChild(b);
    });
  }

  var STAT_ROWS = [
    { key: "hp", label: "生命", base: "hp" },
    { key: "atk", label: "物攻", base: "atk" },
    { key: "def", label: "物防", base: "def" },
    { key: "ma", label: "魔攻", base: "ma" },
    { key: "md", label: "魔防", base: "md" },
    { key: "spe", label: "速度", base: "spe" }
  ];

  function renderStats(side) {
    var st = sideStats(side).stats, s = state[side];
    var body = $(side + "Stats");
    if (!body) return;
    body.innerHTML = STAT_ROWS.map(function (r) {
      var base = sidePet(side)[r.base];
      var v = Number(s.iv[r.key]);
      if (!Number.isFinite(v)) v = 10;
      return "<tr><td>" + r.label + "</td><td class='base'>" + base + "</td>" +
        "<td colspan='3'><span class='ivcell'>" +
        "<button type='button' data-iv='" + side + ":" + r.key + ":-1'>−</button>" +
        "<input data-ivinput='" + side + ":" + r.key + "' type='number' min='0' max='10' value='" + v + "'>" +
        "<button type='button' data-iv='" + side + ":" + r.key + ":1'>+</button>" +
        "</span></td><td class='total'>" + st[r.key] + "</td></tr>";
    }).join("");
    var total = STAT_ROWS.reduce(function (n, r) { return n + (Number(s.iv[r.key]) || 0); }, 0);
    var tEl = $(side + "IvTotal");
    if (tEl) tEl.textContent = "个体合计 " + total + "/60";
  }

  function renderCard(side) {
    var pet = sidePet(side), s = state[side], st = sideStats(side);
    var head = $(side + "Card").querySelector(".card-head");
    head.style.setProperty("--head", elColor(pet.el));
    head.style.setProperty("--head2", elColor(pet.el2 || pet.el));
    var nameEl = $(side + "NameText") || $(side + "Name");
    if (nameEl) nameEl.textContent = pet.n;
    $(side + "Tags").innerHTML = "<span class='tag'>" + pet.el + "</span>" + (pet.el2 ? "<span class='tag'>" + pet.el2 + "</span>" : "");
    $(side + "Ele").textContent = pet.el + (pet.el2 ? " / " + pet.el2 : "") + "　·　" + ROLE[roleOf(pet)].label;
    var blood = (pet.bs && Object.keys(pet.bs).length) ? pet.bs : null;
    var sel = $(side + "BloodSel");
    if (blood && Object.keys(blood).length) {
      if (sel) {
        var keys = Object.keys(blood);
        sel.style.display = "";
        sel.innerHTML = keys.map(function (k) { return "<option value='" + k + "'>" + k + "血脉</option>"; }).join("");
        if (!state[side].blood || !blood[state[side].blood]) {
          // 默认选精灵本系血脉；没有就取第一个
          var own = [pet.el, pet.el2].filter(function (e) { return e && blood[e]; })[0];
          state[side].blood = own || keys[0];
        }
        sel.value = state[side].blood;
        sel.onchange = function () {
          state[side].blood = sel.value;
          save(); renderCard(side); renderBattle(); fillMoveSelects();
        };
      }
      var sk = SKILLS.filter(function (x) { return String(x.id) === String(blood[state[side].blood]); })[0];
      $(side + "Blood").textContent = "血脉技能：" + (sk ? sk.n : "—");
    } else {
      if (sel) sel.style.display = "none";
      $(side + "Blood").textContent = "—（无数据）";
    }
    $(side + "HpNote").textContent = s.hp + " / " + st.stats.hp;
    var bar = $(side + "HpBar");
    if (bar) bar.style.width = Math.min(100, s.hp / st.stats.hp * 100) + "%";
  }

  function learnsetOf(name) {
    var ls = (window.LEARNSETS || {})[name] || null;
    if (ls) return ls;
    var base = String(name || "").replace(/[（(][^）)]*[）)]/g, "").trim();
    return (window.LEARNSETS || {})[base] || null;
  }

  // 换精灵时：把空着的招式格用它的可学招式补上（优先攻击技能）
  function autofillMoves(side, replaceInvalid) {
    var pet = sidePet(side);
    var ls = learnsetOf(pet.n);
    if (!ls || !ls.s || !ls.s.length) return 0;
    var moves = state[side].moves;
    var byName = {};
    (window.SKILLS || []).forEach(function (k) { byName[k.n] = k; });
    var pool = ls.s.slice().sort(function (a, b) {
      var ka = byName[a] || {}, kb = byName[b] || {};
      return (kb.p || 0) - (ka.p || 0);
    });
    var filled = 0;
    var learnable = {};
    pool.forEach(function (n) { learnable[n] = true; });
    for (var i = 0; i < moves.length; i++) {
      var stale = replaceInvalid && moves[i] && !learnable[moves[i]];
      if (moves[i] && !stale) continue;
      if (stale) moves[i] = "";
      var next = pool.filter(function (n) { return moves.indexOf(n) < 0; })[0];
      if (!next) break;
      moves[i] = next; filled++;
    }
    return filled;
  }

  function buildMoves(side) {
    var box = $(side + "Moves");
    box.innerHTML = "";
    state[side].moves.forEach(function (name, i) {
      var sk = name ? skillByName(name) : null;
      var isCustom = !!sk && !SKILLS.some(function (x) { return x.n === sk.n; });
      var row = document.createElement("div");
      row.className = "move-row" + (isCustom ? " custom" : "");
      row.innerHTML =
        "<i class='mdot' style='background:" + (sk && sk.e ? elColor(sk.e) : "#c9c3b6") + "'></i>" +
        "<div class='mname'><input list='skillList' placeholder='选择或搜索技能' value='" + (sk ? sk.n : "") + "'><button type='button' class='mclear' title='清空'>×</button>" +
          (i > 0 ? "<button type='button' class='mmove' data-move='" + side + ":" + i + ":-1' title='上移'>↑</button>" : "") +
          (i < state[side].moves.length - 1 ? "<button type='button' class='mmove' data-move='" + side + ":" + i + ":1' title='下移'>↓</button>" : "") +
          "</div>" +
        (isCustom
          ? "<input class='mpower edit' data-edit='" + side + ":" + i + ":p' value='" + (sk.p || "") + "' placeholder='威力'>" +
            "<input class='mtype edit' data-edit='" + side + ":" + i + ":e' value='" + (sk.e || "") + "' placeholder='属性'>" +
            "<input class='mcat edit' data-edit='" + side + ":" + i + ":t' value='" + (sk.t || "") + "' placeholder='分类'>" +
            "<span class='mtag on'>自定义</span>"
          : "<input class='mpower' readonly value='" + (sk && sk.p !== null ? sk.p : "—") + "'>" +
            "<input class='mtype' readonly value='" + (sk ? sk.e : "—") + "'>" +
            "<input class='mcat' readonly value='" + (sk ? sk.t : "—") + "'>" +
            "<span class='mtag" + (sk && sk.r ? " on" : "") + "'>" + (sk && sk.r ? "先手+" + sk.r : "耗能 " + (sk ? sk.c : "—")) + "</span>");
      box.appendChild(row);

      var input = row.querySelector(".mname input");
      input.addEventListener("change", function () {
        var name2 = input.value.trim();
        state[side].moves[i] = name2;
        if (name2 && !SKILLS.some(function (x) { return x.n === name2; }) && !(state.custom && state.custom[name2])) {
          state.custom = state.custom || {};
          var seed = CUSTOM_SEED[name2];
          state.custom[name2] = seed ? Object.assign({}, seed, { n: name2 }) : { n: name2, p: 0, e: "普通", t: "物攻", c: 3 };
        }
        save(); buildMoves(side); fillMoveSelects(); renderBattle();
      });
      row.querySelector(".mclear").addEventListener("click", function () {
        state[side].moves[i] = "";
        save(); buildMoves(side); renderBattle();
      });
      Array.prototype.forEach.call(row.querySelectorAll("[data-move]"), function (btn) {
        btn.addEventListener("click", function () {
          var parts = btn.getAttribute("data-move").split(":");
          var sd = parts[0], idx = Number(parts[1]), dir = Number(parts[2]), tgt = idx + dir;
          var mv = state[sd].moves;
          if (tgt < 0 || tgt >= mv.length) return;
          var tmp = mv[idx]; mv[idx] = mv[tgt]; mv[tgt] = tmp;
          save(); buildMoves(sd); fillMoveSelects(); renderBattle();
        });
      });
      Array.prototype.forEach.call(row.querySelectorAll("[data-edit]"), function (el) {
        el.addEventListener("change", function () {
          var parts = el.getAttribute("data-edit").split(":");
          var key = parts[2];
          var nm = state[side].moves[i];
          if (!nm) return;
          state.custom = state.custom || {};
          state.custom[nm] = state.custom[nm] || { n: nm, p: 0, e: "普通", t: "物攻", c: 3 };
          state.custom[nm][key] = key === "p" ? Number(el.value) || 0 : el.value.trim();
          save(); buildMoves(side); renderBattle();
        });
      });
    });
  }

  function buildNatures() {
    ["mine", "foe"].forEach(function (side) {
      var sel = $(side + "Nature");
      sel.innerHTML = "";
      var o0 = document.createElement("option");
      o0.value = ""; o0.textContent = "无（不加不减）";
      sel.appendChild(o0);
      NATURES.forEach(function (n) {
        var o = document.createElement("option");
        o.value = n.n; o.textContent = n.n + "（" + n.up + "▲/" + n.down + "▼）";
        sel.appendChild(o);
      });
      sel.value = state[side].nature;
      sel.addEventListener("change", function () { state[side].nature = sel.value; save(); renderAll(); });
    });
  }

  function renderEnergy(side) {
    var box = $(side + "EnergyPips");
    if (!box) return;
    var v = Math.max(0, Math.min(10, Number(state[side].energy) || 0));
    var html = "";
    for (var i = 0; i < 10; i++) html += "<i class='" + (i < v ? "on" : "") + "'></i>";
    box.innerHTML = html;
  }

  function koBadge(pct, hits) {
    if (pct >= 100 || hits === 1) return "<span class='badge-ko one'>一击</span>";
    if (hits === 2) return "<span class='badge-ko two'>2 发</span>";
    return "<span class='badge-ko more'>" + hits + " 发</span>";
  }
  function barClass(pct) { return pct >= 100 ? "" : pct >= 50 ? "low" : "mid"; }

  // 单个招式的伤害（双方共用；含克制/特性/减伤/印记/蓄势/连击/系数/愿力）
  var DMG_CORE = 37 / 41;   // 官方引擎常数（backend/vm/damage.py）
  var STAB = 1.25;          // 本系加成，官方确认为 1.25

  function isStab(sk, pet) {
    if (!sk || !sk.e || !pet) return false;
    return sk.e === pet.el || sk.e === pet.el2;
  }

  // 「愿力冲击」继承血脉属性：属性 = 当前选的血脉，物攻/魔攻 = 看精灵哪项更高
  // 迸发：给攻击技能加固定威力（如 电流刺激：攻击技能获得迸发 威力+40）
  function burstAdd(pet, sk) {
    var d = pet.td || "", m;
    if (!sk || !sk.p) return 0;
    if ((m = /攻击技能获得迸发[：:]威力\+(\d+)/.exec(d))) return Number(m[1]);
    if ((m = /([\u4e00-\u9fa5])系技能获得迸发[：:]威力\+(\d+)/.exec(d))) return sk.e === m[1] ? Number(m[2]) : 0;
    return 0;
  }

  // 选择技：描述里「选择：A 或 B」，A/B 就是两个选项
  function choiceOptions(sk) {
    var d = (sk && sk.d) || "";
    var m = /选择[：:]([^。]+)/.exec(d);
    if (!m) return [];
    var body = m[1];
    var parts = body.split(/或/).map(function (x) { return x.trim(); }).filter(Boolean);
    return parts.length >= 2 ? parts : [];
  }

  // 传动系技能的位置效果：本技能位于 1/3 号位时额外威力
  function slotPowerBonus(sk, idx) {
    var d = (sk && sk.d) || "";
    if (idx < 0) return 0;
    var m;
    if ((m = /位于1号或3号位时威力\+(\d+)/.exec(d))) return (idx === 0 || idx === 2) ? Number(m[1]) : 0;
    if ((m = /位于1号位时威力\+(\d+)/.exec(d))) return idx === 0 ? Number(m[1]) : 0;
    if ((m = /位于3号位时威力\+(\d+)/.exec(d))) return idx === 2 ? Number(m[1]) : 0;
    return 0;
  }

  // 折射：按招式栏里其他系别的技能决定变体
  function refractVariant(side, sk) {
    if (!sk || sk.n !== "折射") return null;
    var moves = (state[side].moves || []).filter(function (n) { return n && n !== "折射"; });
    var els = moves.map(function (n) {
      var k = skillByName(n);
      return k && k.e ? k.e : null;
    }).filter(Boolean);
    if (!els.length) return null;
    var el = els[0];
    var v = (window.REFRACT || {})[el];
    return v ? { el: el, v: v } : null;
  }

  function applyRefract(side, sk) {
    if (!sk || sk.n !== "折射") return "";
    var moves = (state[side].moves || []).filter(function (n) { return n && n !== "折射"; });
    var els = moves.map(function (n) {
      var k = skillByName(n);
      return k && k.e ? k.e : null;
    }).filter(Boolean);
    if (!els.length) return "";
    var el = els[0];
    var v = (window.REFRACT || {})[el];
    if (!v) return "";
    var fo = other(side), st = sideStats(side);
    if (v.kind === "buffFoe") addBuff(fo, v.name, v.v);
    else if (v.kind === "cost") state[side].costFlat = (Number(state[side].costFlat) || 0) + v.v;
    else if (v.kind === "stat") addMod(side, "stat", v.v);
    else if (v.kind === "drain") addMod(side, "drain", v.v);
    else if (v.kind === "heal") state[side].hp = Math.min(st.stats.hp, state[side].hp + Math.round(st.stats.hp * v.v / 100));
    else if (v.kind === "energyFoe") state[fo].energy = Math.max(0, (Number(state[fo].energy) || 0) + v.v);
    else if (v.kind === "power") state[side].choicePower = (Number(state[side].choicePower) || 0) + v.v;
    else if (v.kind === "combo") { state[side].st = state[side].st || {}; state[side].st.combo = (Number(state[side].st.combo) || 1) + v.v; }
    else if (v.kind === "defDown" || v.kind === "defDownMd") addMod(fo, "stat", Math.abs(v.v));
    else if (v.kind === "statDownFoe") addMod(fo, "stat", v.v);
    else if (v.kind === "slowFoe") addBuff(fo, "减速印记", 4);
    return "折射（" + el + "）：" + v.note;
  }

  function effSkill(side, sk, attacker) {
    if (!sk || sk.n !== "愿力冲击") return sk;
    var pet = attacker.pet;
    var el = state[side].blood && pet.bs && pet.bs[state[side].blood]
      ? state[side].blood
      : (pet.el || "普通");
    var magic = (pet.ma || 0) > (pet.atk || 0);
    return Object.assign({}, sk, { e: el, t: magic ? "魔攻" : "物攻", inherited: el });
  }

  // 实际耗能：基础 + 全局修正 + 下一次技能折扣
  function costOf(side, sk) {
    if (!sk) return 3;
    var base = Number(sk.c) || 0;
    var flat = Number((state[side] || {}).costFlat) || 0;
    var pend = Number(((state[side] || {}).pending || {}).cost) || 0;
    var byEl = (state[side] || {}).costByEl || {};
    var elMod = Number(byEl[sk.e]) || 0;
    var devCost = -2 * (Number((devotionOf(side) || {}).cost) || 0);
    var wCost = weatherCost(side, sk);
    return Math.max(0, Math.round((base + flat + pend + elMod + devCost) * wCost));
  }

  // 天气倍率：下雨 水系 ×1.75；其余天气暂无官方倍率，效果体现在特性里
  function weatherMult(sk) {
    if (state.weather === "rain" && sk && sk.e === "水") return 1.75;
    return 1;
  }

  // 沙暴：地系技能能耗减半
  function weatherCost(side, sk) {
    if (state.weather === "sand" && sk && sk.e === "地") return 0.5;
    return 1;
  }

  function isAoe(sk) {
    return !!(sk && (window.AOE_SKILLS || []).indexOf(sk.n) >= 0);
  }

  // 双打：单体技能命中 1 只；群体技能命中全场，单体伤害按 1/目标数 分摊（本作无单独的全场系数）
  function targetsHit(sk) {
    if (!state.doubles) return 1;
    return isAoe(sk) ? 2 : 1;
  }

  function traitCtx(side) {
    var sd = side || "mine";
    var team = (state[sd].slots || []).map(function (n) {
      return PETS.filter(function (x) { return x.n === n; })[0];
    }).filter(Boolean);
    return {
      first: !!state.firstThisTurn,
      weather: state.weather || "",
      mana: Number(state[sd].mana) || 0,
      enemyMana: Number(state[sd === "mine" ? "foe" : "mine"].mana) || 0,
      team: team,
      counters: state.counters || { entry: 0, faintMine: 0, faintFoe: 0, counter: 0 }
    };
  }

  function hitDamage(side, sk0, attacker, defender, slotIdx) {
    var sk = effSkill(side, sk0, attacker);
    if (!sk || !sk.p) return 0;
    var tm = typeMult(sk.e, defender.pet);
    if (tm > 1) window.__se = true;
    var dev = devotionOf(side);
    var devAdd = 20 * (Number(dev.pow) || 0);
    var addP = burstAdd(attacker.pet, sk) + slotPowerBonus(sk, typeof slotIdx === "number" ? slotIdx : -1) + (Number(state[side].choicePower) || 0) + devAdd;
    if (addP) sk = Object.assign({}, sk, { p: sk.p + addP });
    var bt = buffTotals(side);
    var bTaken = buffTotals(side === "mine" ? "foe" : "mine");
    var choiceAdd = Number(state[side].choicePower) || 0;
    var pend = state[side].pending || null;
    var pendMul = pend && pend.power ? 1 + Number(pend.power) / 100 : 1;
    var myMods = state[side].mods || {};
    var oppMods = state[side === "mine" ? "foe" : "mine"].mods || {};
    var statMul = 1 + (Number(myMods.stat) || 0) / 100;        // 双攻修正（近似为伤害倍率）
    var oppStatMul = 1 + (Number(oppMods.stat) || 0) / 100;    // 敌方双防修正
    var buffPow = 1 + bt.pow / 100 + (Number(myMods.power) || 0) / 100;
    if (statMul < 0) statMul = 0;
    if (oppStatMul < 0) oppStatMul = 0;
    var buffDmg = 1 + bt.dmg / 100;
    var buffTaken = 1 - bTaken.taken / 100;
    var st = state[side].st || {};
    var magic = sk.t === "魔攻";
    var wishHit = !!sk.wish && state.foeStatusSkill && side === "mine";
    return Math.round(sk.p * ((magic ? attacker.stats.ma : attacker.stats.atk) / (magic ? defender.stats.md : defender.stats.def))
      * tm * traitMult(attacker.pet, sk, traitCtx(side), side)
      * (1 - Math.min(90, Math.max(0, Number(state.cut) || 0)) / 100)
      * (1 + 0.1 * (Number(st.mark) || 0)) * (Number(st.charge) ? 1.3 : 1)
      * (Math.max(1, Number(st.combo) || 1) + (/连击/.test(sk.d || "") ? (Number(dev.combo) || 0) : 0)) * (Number(state.coef) || 0) * (wishHit ? 2.5 : 1)
      * buffPow * buffDmg * buffTaken * DMG_CORE * weatherMult(sk) * (isStab(sk, attacker.pet) ? STAB : 1)
      * statMul / oppStatMul * pendMul);
  }

  // 行动后果预览：能否击杀、打完后能量、风险
  // 对手倾向推测（启发式，明确标注为推测）
  function opponentLean(myHpLeft) {
    var foe = sideStats("foe"), mine = sideStats("mine");
    var foeEnergy = Number(state.foe.energy) || 0;
    var best = 0, bestName = "";
    (state.foe.moves || []).forEach(function (n) {
      var k = n ? skillByName(n) : null;
      if (!k || !k.p) return;
      var d = hitDamage("foe", k, foe, mine);
      if (d > best) { best = d; bestName = k.n; }
    });
    if (myHpLeft <= best) return "对手可能反杀（" + bestName + " 约 " + best + "）";
    if (foeEnergy < 3) return "对手可能被迫聚能";
    if (best > 0) return "对手可能出 " + bestName + "（约 " + best + "）";
    return "对手动作不明";
  }

  // 两步推演的综合评分（-1 ~ +1，启发式）
  function stateDelta(kill, myHpAfter, oppBest, energyAfter) {
    var v = 0;
    if (kill) v += 0.55;
    if (myHpAfter <= oppBest) v -= 0.7;           // 下一回合就可能被打死
    else if (myHpAfter - oppBest <= oppBest) v -= 0.3; // 两回合内会被打死
    else if (oppBest > 0 && oppBest > myHpAfter * 0.4) v -= 0.15;
    if (energyAfter <= 0) v -= 0.25; else if (energyAfter >= 5) v += 0.15;
    if (!kill && oppBest > 0 && myHpAfter > oppBest) v += 0.05;
    return Math.max(-1, Math.min(1, Math.round(v * 100) / 100));
  }

  function previewLine(side, sk, dmg, defender, hpNow) {
    var cost = costOf(side, sk);
    var en = Number(state[side].energy) || 0;
    var after = en - cost;
    var parts = [];
    if (dmg > 0) {
      if (dmg >= hpNow) parts.push("✅ 可击杀");
      else if (dmg * 1.0 < hpNow) parts.push("⚠ 打不死（剩 " + (hpNow - dmg) + "）");
    }
    parts.push("⚡打完 " + Math.max(0, after) + "/10");
    if (after <= 0) parts.push("⚠ 下回合被动");
    else if (after < 3) parts.push("⚠ 能量见底");
    if (side === "mine") {
      var foeSpe = speedWithMarks("foe"), mySpe = speedWithMarks("mine");
      if (mySpe < foeSpe) parts.push("⏱ 后手");
    }
    return parts.join(" · ");
  }

  function hitCards(side, attacker, defender, hpNow) {
    var out = "";
    state[side].moves.forEach(function (name, mIdx) {
      var sk = name ? skillByName(name) : null;
      if (!sk) {
        out += "<div class='mcard'><div class='mcard-top'><span class='mcard-name'>空</span></div><div class='mcard-bar'></div></div>";
        return;
      }
      if (!sk.p) {
        var kind = sk.t === "状态" ? "状态技" : sk.t === "防御" ? "防御技" : "辅助技";
        var brief = (sk.d || "").replace(/^✦/, "").slice(0, 28);
        out += "<div class='mcard quiet'><div class='mcard-top'><span class='mcard-name'>" + sk.n + "</span>" +
          "<span class='mcard-kind'>" + kind + "</span></div>" +
          "<div class='mcard-val' style='margin-top:4px;font-size:12.5px'>无直接伤害" + (sk.c ? " · 耗能 " + sk.c : "") + "</div>" +
          (brief ? "<div class='mcard-note'>" + brief + "</div>" : "") +
          "</div>";
        return;
      }
      var eff = effSkill(side, sk, attacker);
      var ti = traitInfo(attacker.pet, eff || sk, traitCtx(), side);
      var dmg = hitDamage(side, sk, attacker, defender, mIdx);
      var hitsN = targetsHit(sk);
      var other = null;
      if (state.doubles && isAoe(sk)) {
        var oppSide = side === "mine" ? "foe" : "mine";
        var idx2 = state[oppSide].target2;
        var nm2 = state[oppSide].slots[idx2];
        if (nm2 && idx2 !== state[oppSide].active) other = PETS.filter(function (x) { return x.n === nm2; })[0] || null;
      }
      var total = state.doubles && isAoe(sk) ? dmg + (other ? Math.round(dmg / 2) : 0) : dmg;
      var pct = dmg / Math.max(1, defender.stats.hp) * 100;   // 占满血比例，稳定可比较
      var hits = Math.max(1, Math.ceil(hpNow / Math.max(1, dmg)));
      var wishNote = sk.wish ? "<div class='mcard-note'>" + (wishHitNow(side) ? "应对状态成功 ×2.5" : "基础 80；对手用状态技时 ×2.5") + " · 每场限 2 次</div>" : "";
      out += "<div class='mcard'>" +
        "<div class='mcard-top'><span class='mcard-name'>" + sk.n + (eff && eff.inherited ? "（" + eff.inherited + "血脉）" : "") + "</span>" + koBadge(pct, hits) + "</div>" +
        "<div class='mcard-val' style='margin-top:4px'>" + dmg + "（满血 " + Math.round(pct) + "%）" +
          (state.doubles && isAoe(sk)
            ? "<span class='aoe-tag'>群攻" + (other ? " · 合计 " + total : " · 仅命中在场 1 只") + "</span>"
            : "") + "</div>" +
        "<div class='mcard-bar'><i class='" + barClass(pct) + "' style='width:" + Math.min(100, pct) + "%'></i></div>" +
        (ti.notes.length ? "<div class='mcard-note'>特性：" + ti.notes.join("、") + "</div>" : "") +
        (ti.skipped.length ? "<div class='mcard-note warn'>特性未计入：" + ti.skipped.join("、") + "</div>" : "") +
        wishNote +
        (eff && eff.inherited ? "<div class='mcard-note'>继承血脉：" + eff.inherited + " · " + eff.t + "</div>" : "") +
        (isStab(eff, attacker.pet) ? "<div class='mcard-note'>本系加成 ×1.25</div>" : "") +
        (state.mine.energy < costOf("mine", sk) && side === "mine" ? "<div class='mcard-note'>能量不够，要聚能</div>" : "") +
        "<div class='mcard-note preview'>" + previewLine(side, sk, dmg, defender, hpNow) + "</div>" +
        (side === "mine" ? (function () {
          var myHpLeft = Number(state.mine.hp) || 0;
          var foe = sideStats("foe"), mineS = sideStats("mine");
          var best = 0;
          (state.foe.moves || []).forEach(function (n) {
            var k = n ? skillByName(n) : null;
            if (!k || !k.p) return;
            var d2 = hitDamage("foe", k, foe, mineS);
            if (d2 > best) best = d2;
          });
          var dv = stateDelta(dmg >= hpNow, myHpLeft - best, best, (Number(state.mine.energy) || 0) - costOf("mine", sk));
          return "<div class='mcard-note preview'>↩ 推测：" + opponentLean(hpNow - dmg) +
            "</div><div class='mcard-note preview " + (dv > 0 ? "good" : dv < 0 ? "bad" : "") + "'>📊 局面 " + (dv > 0 ? "+" : "") + dv + "</div>";
        })() : "") +
        "</div>";
    });
    return out;
  }

  function wishHitNow(side) { return side === "mine" && state.foeStatusSkill; }

  function renderRail(id, side) {
    var box = $(id);
    if (!box) return;
    var html = "";
    for (var i = 0; i < 6; i++) {
      html += "<div class='" + (i === state[side].active ? "on " + (side === "foe" ? "def" : "") : "") + "'>" + (i + 1) + "</div>";
    }
    box.innerHTML = html;
  }

  // 策略库：按「时间段 × 定位」整理，名称固定，玩家只决定贴到哪个行为上
  // 28 枚系统标签（文档标签库）
  var L_TAGS = {
    L01: "贝叶斯类型学习", L02: "多臂老虎机试探", L03: "信号干扰", L04: "沉没成本信号（卖血换信息）",
    L05: "混同信号（隐藏类型）", L06: "自我约束承诺", L07: "信号传递", L08: "触发策略", L09: "信息甄别",
    L10: "最优搜索", L11: "改变有效参与者", L12: "维度重塑", L13: "计划谬误利用", L14: "结构重塑",
    L15: "甄别替补冻结能量", L16: "遗憾最小化", L17: "损失厌恶（诱导对手错误聚能）", L18: "期望收益计算",
    L19: "不可逆承诺", L20: "消耗战兑现", L21: "自己绑手的承诺", L22: "关闭博弈", L23: "强信号（宣告比赛关闭）",
    L24: "混合策略/统计推断", L25: "接近单次博弈（声誉失效）", L26: "达克效应诱导", L27: "拼速前定线信号",
    L28: "沉没成本信号（切入承诺）"
  };

  // 文档里的负约束：返回违规说明（空=合规）
  function stratViolation(tag, phase, role) {
    if (!tag) return "";
    var code = tag.l || "";
    if (phase === "probe") {
      if (code === "L18") return "1–4 回合禁用期望收益计算（斩杀线还不可算）";
      if (role === "sweep" && /主动出击|兑现|斩杀/.test(tag.name || "")) return "1–4 回合收割位不能主动出击";
    }
    if (phase === "kill" && role === "info" && /^(L01|L02|L03)$/.test(code)) {
      return "17–24 回合状态位禁用 " + code + "（信息价值近零）";
    }
    return "";
  }

  var STRATS = [
    // 1 信息试探
    { id: "probe-low", l: "L02", phase: "probe", role: "info", prim: true, name: "低费混合试探", acts: ["attack"],
      desc: "交替用不同费用技能，观察回应以更新对手类型信念" },
    { id: "probe-sell", l: "L04", phase: "probe", role: "info", prim: false, name: "卖血换信息", acts: ["attack", "counter"],
      desc: "只换能改变下一段换人/压能量决策的信息" },
    { id: "probe-keep", l: "L06", phase: "probe", role: "info", prim: false, name: "保留能量余量", acts: ["attack", "charge"],
      desc: "不交高费，留住下一段的行动空间" },
    { id: "probe-hide", l: "L05", phase: "probe", role: "tank", prim: false, name: "不暴露联防轴", acts: ["attack", "counter"],
      desc: "先观察克制关系，不提前亮出联防位" },
    { id: "probe-switch", l: "L11", phase: "probe", role: "tank", prim: false, name: "换入止损", acts: ["switch"],
      desc: "首发被压穿就早换，不硬吃一轮" },
    { id: "probe-hold", l: "L05", phase: "probe", role: "sweep", prim: false, name: "藏入场条件", acts: ["charge", "switch"],
      desc: "保能量、不空能入场、不承担伤害任务" },

    // 2 能量压制
    { id: "press-drain", l: "L07", phase: "press", role: "info", prim: true, name: "压能量逼聚能", acts: ["attack"],
      desc: "低费/状态技压对手能量，配合地刺、打断" },
    { id: "press-signal", l: "L07", phase: "press", role: "info", prim: false, name: "传递“我知道你在聚能”", acts: ["attack", "counter"],
      desc: "让对手知道空过他这一轮是亏的" },
    { id: "press-trigger", l: "L08", phase: "press", role: "info", prim: false, name: "触发策略", acts: ["attack"],
      desc: "压到断档就转逼聚能，形成条件反射式压制" },
    { id: "press-tank", l: "L28", phase: "press", role: "tank", prim: true, name: "切入吃伤害", acts: ["switch"],
      desc: "在克制形成前切入，替核心挡这一轮" },
    { id: "press-break", l: "L09", phase: "press", role: "tank", prim: false, name: "打断能量循环", acts: ["attack", "counter"],
      desc: "把对手推向被迫聚能或被动换人" },
    { id: "press-save", l: "L06", phase: "press", role: "sweep", prim: false, name: "能量向 5–7 靠拢", acts: ["charge"],
      desc: "为兑现段留出 2–3 次击杀的储备" },

    // 3 发育破局
    { id: "build-pierce", l: "L12", phase: "build", role: "info", prim: false, name: "印记穿透联防", acts: ["attack"],
      desc: "让对手轮转从获益变成送回合差" },
    { id: "build-window", l: "L07", phase: "build", role: "info", prim: false, name: "创造安全入场", acts: ["attack", "switch"],
      desc: "为收割位铺一个不吃伤害的上场口" },
    { id: "build-bait", l: "L17", phase: "build", role: "info", prim: false, name: "诱骗聚能或换人", acts: ["attack"],
      desc: "用假压力诱发对手错误决策" },
    { id: "build-hold", l: "L14", phase: "build", role: "tank", prim: true, name: "维持联防轴", acts: ["counter", "switch"],
      desc: "不让己方核心被压穿" },
    { id: "build-open", l: "L14", phase: "build", role: "tank", prim: false, name: "一轮破局行动", acts: ["attack"],
      desc: "打穿对手联防，制造结构性缺口" },
    { id: "build-line", l: "L18", phase: "build", role: "sweep", prim: true, name: "确认斩杀线", acts: ["attack"],
      desc: "星陨 10 层、冻结 6–8 层这类可兑现的线" },
    { id: "build-cash", l: "L16", phase: "build", role: "sweep", prim: false, name: "提前兑现判断", acts: ["switch", "attack"],
      desc: "进线就兑现，不因发育未满而错过窗口" },

    // 4 兑现斩杀
    { id: "kill-sac", l: "L19", phase: "kill", role: "info", prim: false, name: "牺牲保先手", acts: ["counter", "attack"],
      desc: "用一只换收割位的出手顺序" },
    { id: "kill-cover", l: "L21", phase: "kill", role: "tank", prim: true, name: "先手联防夺回顺序", acts: ["counter", "switch"],
      desc: "后手不强行兑现，先用联防抢回顺序" },
    { id: "kill-exec", l: "L19", phase: "kill", role: "sweep", prim: true, name: "先手兑现", acts: ["attack"],
      desc: "每击先问：能不能在他反应前完成击杀" },
    { id: "kill-margin", l: "L18", phase: "kill", role: "sweep", prim: false, name: "斩杀留余量", acts: ["attack"],
      desc: "给伤害波动与残留血量留缓冲" },

    // 5 残局
    { id: "end-window", l: "L25", phase: "end", role: "info", prim: true, name: "制造错误聚能窗口", acts: ["attack", "counter"],
      desc: "残局里一次被先手打断的聚能等于送赛点" },
    { id: "end-hold", l: "L20", phase: "end", role: "tank", prim: false, name: "领先先消耗", acts: ["counter", "switch"],
      desc: "领先 1 点魔力值时，用联防消耗而不是对攻" },
    { id: "end-comeback", l: "L11", phase: "end", role: "tank", prim: false, name: "换人反杀", acts: ["switch"],
      desc: "落后时用换人先手权制造反杀窗口" },
    { id: "end-line", l: "L27", phase: "end", role: "sweep", prim: true, name: "拼速前定线", acts: ["attack", "charge"],
      desc: "把胜负推到确定线，别交给同速随机" }
  ];

  // 五个轮次时间段
  var PHASES = [
    { key: "probe", label: "信息试探", color: "#3f6fa8", from: 1, to: 4 },
    { key: "press", label: "能量压制", color: "#3f8f6a", from: 5, to: 10 },
    { key: "build", label: "发育破局", color: "#c99a3f", from: 11, to: 16 },
    { key: "kill", label: "兑现斩杀", color: "#c9503c", from: 17, to: 24 },
    { key: "end", label: "残局收束", color: "#6a4a9c", from: 25, to: 50 }
  ];

  // 分类：回合区间 + 魔力值 + 血量 + 能量
  function phaseOf(turn, c) {
    var byTurn = PHASES[PHASES.length - 1];
    for (var i = 0; i < PHASES.length; i++) {
      if (turn >= PHASES[i].from && turn <= PHASES[i].to) { byTurn = PHASES[i]; break; }
    }
    // 1) 后段且一方魔力告急 → 残局收束
    if (turn >= 17 && (c.myMana <= 1 || c.foeMana <= 1)) return PHASES[4];
    // 1.5) 对手被迫聚能且已过试探段 → 能量压制
    if (c.foeForced && turn >= 5) return PHASES[1];
    // 2) 对手进入斩杀线（血 ≤30% 或魔力 ≤1）→ 兑现斩杀
    if (c.foeHpPct <= 30 || c.foeMana <= 1) return PHASES[3];
    // 3) 中段出现能量断档 → 仍属能量压制
    if (byTurn.key === "build" && c.foeEnergy <= 2) return PHASES[1];
    return byTurn;
  }

  function renderTimeline() {
    var turn = state.history.length;
    var mine = sideStats("mine"), foe = sideStats("foe");
    var foePct = state.foe.hp / foe.stats.hp * 100;
    var myPct = state.mine.hp / mine.stats.hp * 100;
    var ph = phaseOf(Math.max(1, turn), {
      foeHpPct: foePct, myHpPct: myPct,
      foeMana: Number(state.foe.mana) || 0, myMana: Number(state.mine.mana) || 0,
      foeEnergy: Number(state.foe.energy) || 0, myEnergy: Number(state.mine.energy) || 0
    });
    var fill = $("tlFill");
    if (fill) {
      fill.style.width = Math.min(100, turn / 50 * 100) + "%";
      fill.style.background = ph.color;
    }
    var tag = $("phaseName");
    if (tag) {
      var v2 = phaseVector();
      var auto = PHASES.filter(function (x) { return x.key === v2.phase; })[0] || ph;
      tag.textContent = "第 " + Math.max(1, turn) + " 回合 · " + auto.label + "（状态向量自动）";
      tag.style.background = auto.color;
      tag.title = "D1 信息 " + v2.D1.toFixed(2) + "｜D2 能量差 " + v2.D2 + "｜D3 收割就绪 " + v2.D3 +
        "｜D4 魔力差 " + v2.D4 + "｜D5 联防 " + v2.D5 + "｜D6 存活 " + v2.D6;
    }

    var legend = $("tlLegend");
    if (legend) {
      legend.innerHTML = PHASES.map(function (p) {
        return "<span><i style='background:" + p.color + "'></i>" + p.label + " " + p.from + "–" + p.to + "</span>";
      }).join("");
    }

    var list = $("historyList");
    if (list) {
      list.innerHTML = state.history.slice(-6).reverse().map(function (h) {
        return "<div class='hrow'><span>第 " + h.turn + " 回合 · " + h.phase +
          (h.strat ? "　<span class='strat-chip'>" + (h.stratL ? h.stratL + " " : "") + h.strat + (h.stratFit ? " · 契合" + h.stratFit + "%" : "") + "</span>" : "") + "</span>" +
          "<b>我 " + h.mineHp + " / 敌 " + h.foeHp + " · 能量 " + h.mineEnergy + "/" + h.foeEnergy +
          " · 魔力 " + (h.mineMana === undefined ? "—" : h.mineMana) + "/" + (h.foeMana === undefined ? "—" : h.foeMana) +
          (h.refractLog ? " · " + h.refractLog : "") +
          (h.entryLog && h.entryLog.length ? " · " + h.entryLog.join("；") : "") +
          (h.evLog && h.evLog.length ? " · " + h.evLog.join("；") : "") +
          (h.freezeLockLog ? " · " + h.freezeLockLog : "") +
          (h.chargeLog ? " · " + h.chargeLog : "") +
          (h.lockLog ? " · " + h.lockLog : "") +
          (h.riderLog ? " · " + h.riderLog : "") +
          (h.regressLog ? " · " + h.regressLog : "") +
          (h.choiceLog ? " · 选择：" + h.choiceLog : "") +
          (h.statusLog && h.statusLog.length ? " · " + h.statusLog.join("；") : "") +
          (h.itemMe ? " · 我进化 " + h.itemMe : "") + (h.itemFoe ? " · 敌进化 " + h.itemFoe : "") +
          (h.buffLog && h.buffLog.length ? " · 回合结束 " + h.buffLog.join("、") : "") +
          (h.switchedMe ? " · 我换" + h.switchedMe : "") +
          (h.switchedFoe ? " · 敌换" + h.switchedFoe : "") +
          (h.first ? " · " + (h.first === "me" ? "我先" : "敌先") +
            (h.prioMe || h.prioFoe ? "（先手 " + (h.prioMe || 0) + "/" + (h.prioFoe || 0) + "）" : "") : "") +
          (h.counterMe === true ? " · 我应对✓" : h.counterMe === false ? " · 我应对✗" : "") +
          (h.counterFoe === true ? " · 敌应对✓" : h.counterFoe === false ? " · 敌应对✗" : "") +
          (h.meAct ? " · 我" + ({ attack: "打", charge: "聚能", switch: "换", counter: "应对", item: "道具" }[h.meAct] || "") +
            " / 敌" + ({ attack: "打", charge: "聚能", switch: "换", counter: "应对", item: "道具" }[h.foeAct] || "") : "") + "</b></div>";
      }).join("") || "<div class='hrow'><span>还没有记录，点“记录本回合”开始。</span></div>";
    }

    var sel = $("restoreTurn");
    if (sel) {
      var cur = sel.value;
      sel.innerHTML = "<option value=''>还原到第几回合…</option>" + state.history.map(function (h) {
        return "<option value='" + h.turn + "'>第 " + h.turn + " 回合（" + h.phase + "）</option>";
      }).join("");
      sel.value = cur;
    }
  }

  function renderDoubles() {
    var block = $("doublesBlock");
    if (!block) return;
    block.style.display = state.doubles ? "" : "none";
    if (!state.doubles) return;
    [["mineSlot2", "mine"], ["foeSlot2", "foe"]].forEach(function (pair) {
      var sel = $(pair[0]);
      if (!sel) return;
      var side = pair[1];
      var keep = state[side].target2;
      sel.innerHTML = state[side].slots.map(function (n, i) {
        return "<option value='" + i + "'>" + (n || "空") + (i === state[side].active ? "（在场）" : "") + "</option>";
      }).join("");
      sel.value = keep === undefined ? String(state[side].active) : String(keep);
      sel.onchange = function () {
        state[side].target2 = Number(sel.value);
        save(); renderDoubles();
      };
    });
  }

  function syncDevotionInputs() {
    var d = devotionOf("mine");
    [["devPow", "pow"], ["devCost", "cost"], ["devCombo", "combo"], ["devDrain", "drain"], ["devPoison", "poison"]].forEach(function (pair) {
      if ($(pair[0])) $(pair[0]).value = String(d[pair[1]] || 0);
    });
  }

  function renderDevotion() {
    var note = $("devNote");
    if (!note) return;
    var d = devotionOf("mine");
    var total = (d.pow || 0) + (d.cost || 0) + (d.combo || 0) + (d.drain || 0) + (d.poison || 0);
    note.textContent = total
      ? "共 " + total + " 层：威力+" + (20 * (d.pow || 0)) + "、" + "能耗-" + (2 * (d.cost || 0)) +
        "、连击+" + (d.combo || 0) + "、吸血+" + (10 * (d.drain || 0)) + "%、攻击附带中毒+" + (2 * (d.poison || 0)) + " 层"
      : "还没有奉献层数。花衣蝶/草衣虫（花精灵）每回合结束自动 +1，铠甲虫挨打也 +1。";
  }

  // 多对局存档：把当前对局存成一条，可随时切回
  var GAMES_KEY = "luoke-pvp-games";
  function games() {
    try { return JSON.parse(localStorage.getItem(GAMES_KEY) || "[]"); } catch (e) { return []; }
  }
  function setGames(list) {
    try { localStorage.setItem(GAMES_KEY, JSON.stringify(list.slice(0, 8))); } catch (e) {}
  }
  function saveGame() {
    var list = games();
    var name = "对局 " + (list.length + 1);
    var my = sidePet("mine"), fo = sidePet("foe");
    name += "：" + (my ? my.n : "?") + " vs " + (fo ? fo.n : "?");
    list.unshift({ name: name, at: Date.now(), turn: state.history.length, state: JSON.parse(JSON.stringify(state)) });
    setGames(list);
    renderGames();
    notice("已存：" + name);
  }
  function loadGame(i) {
    var list = games();
    if (!list[i]) return;
    try {
      var snap = list[i].state;
      state = Object.assign(state, snap);
      save(); renderAll();
      notice("已载入：" + list[i].name);
    } catch (e) { notice("载入失败：" + e.message); }
  }
  function renderGames() {
    var box = $("gameList");
    if (!box) return;
    var list = games();
    box.innerHTML = list.length ? list.map(function (g, i) {
      return "<span class='game-chip'><button type='button' data-load='" + i + "'>" + g.name.slice(0, 14) + "（" + g.turn + " 回合）</button>" +
        "<button type='button' class='del' data-del='" + i + "'>×</button></span>";
    }).join("") : "";
    Array.prototype.forEach.call(box.querySelectorAll("[data-load]"), function (b) {
      b.addEventListener("click", function () { loadGame(Number(b.getAttribute("data-load"))); });
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-del]"), function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-del"));
        var l = games(); l.splice(i, 1); setGames(l); renderGames();
      });
    });
  }

  function renderBattle() {
    var mine = sideStats("mine"), foe = sideStats("foe");
    $("duelMineName").textContent = mine.pet.n;
    $("duelFoeName").textContent = foe.pet.n;
    $("battleMoves").innerHTML = hitCards("mine", mine, foe, state.foe.hp);
    $("foeHits").innerHTML = hitCards("foe", foe, mine, state.mine.hp);
    renderRail("railMine", "mine");
    renderRail("railFoe", "foe");

    var eh = $("energyHint");
    if (eh) eh.textContent = "· 我方能量 " + state.mine.energy + "/10";
    $("p1Stat").innerHTML = mine.pet.n + "<br>HP " + state.mine.hp + " / " + mine.stats.hp +
      "<br>能量 " + state.mine.energy + "/10 · " + (state.mine.status || "健康");
    $("p2Stat").innerHTML = foe.pet.n + "<br>HP " + state.foe.hp + " / " + foe.stats.hp +
      "<br>能量 " + state.foe.energy + "/10 · " + (state.foe.status || "健康");
    renderTimeline();
    var tick = Math.round(foe.stats.hp * (0.03 * (Number(state.foe.st.poison) || 0) + 0.02 * (Number(state.foe.st.burn) || 0)));
    var tn = $("tickNote");
    if (tn) tn.textContent = tick > 0 ? "回合结束他会掉 " + tick + "（中毒 " + state.foe.st.poison + " 层 / 灼烧 " + state.foe.st.burn + " 层）" : "";
  }

  function fillStates() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-state]"), function (el) {
      var side = el.getAttribute("data-state"), key = el.getAttribute("data-key");
      var v = state[side].st[key];
      el.value = v === undefined ? (key === "combo" ? 1 : 0) : v;
    });
  }

  function renderAll() {
    ["mine", "foe"].forEach(function (side) {
      renderSlots(side); renderStats(side); renderCard(side); buildMoves(side);
      var s = state[side];
      $(side + "Level").value = s.level;
      $(side + "Star").value = s.star;
      $(side + "Hp").value = s.hp;
      $(side + "Energy").value = s.energy;
      if ($(side + "Mana")) $(side + "Mana").value = s.mana;
      if ($(side + "Priority")) $(side + "Priority").value = s.priority || 0;
      if ($(side + "Status")) $(side + "Status").value = s.status || "健康";
      renderEnergy(side);
      $(side + "Nature").value = s.nature || "";
    });
    fillStates();
    fillMoveSelects();
    if ($("meAction") && state.uiAction) $("meAction").value = state.uiAction;
    fillStrategies();
    if ($("doubleMode")) $("doubleMode").value = state.doubles ? "1" : "";
    if ($("mineBall")) $("mineBall").value = state.mine.ball || "普通球";
    if ($("foeBall")) $("foeBall").value = state.foe.ball || "普通球";
    if ($("firstThisTurn")) $("firstThisTurn").value = state.firstThisTurn ? "1" : "";
    [["cntEntry", "entry"], ["cntFaintMine", "faintMine"], ["cntFaintFoe", "faintFoe"], ["cntCounter", "counter"]].forEach(function (pair) {
      if ($(pair[0])) $(pair[0]).value = String((state.counters || {})[pair[1]] || 0);
    });
    renderBuffs();
    renderDoubles();
    renderBattle();
  }

  // 绑定输入
  ["mine", "foe"].forEach(function (side) {
    ["Level", "Star", "Hp", "Energy", "Mana", "Priority"].forEach(function (k) {
      var el = $(side + k);
      el.addEventListener("input", function () {
        var key = k.toLowerCase();
        state[side][key] = Number(el.value) || 0;
        save(); renderStats(side); renderCard(side); renderEnergy(side); renderBattle();
      });
    });
  });
  var help = document.createElement("div");
  help.className = "coef-help";
  help.innerHTML = "系数：公式结果 × 系数 = 实际伤害。先用一次实测伤害校准。";
  var coefBox = $("coef").parentElement;
  coefBox.appendChild(help);
  var cal = document.createElement("div");
  cal.className = "coef-cal";
  cal.innerHTML = "<input id='realDmg' type='number' placeholder='实测伤害' style='width:96px'>" +
    "<button type='button' id='calBtn'>校准</button><span id='calMsg'></span>";
  coefBox.appendChild(cal);
  $("calBtn").addEventListener("click", function () {
    var real = Number($("realDmg").value);
    var mine = sideStats("mine"), foe = sideStats("foe");
    var sk = byId(state.mine.moves[0]);
    if (!(real > 0) || !sk) { $("calMsg").textContent = "先选好第 1 个技能，再填实测伤害"; return; }
    var magic = sk.t === "魔攻";
    var base = sk.p * ((magic ? mine.stats.ma : mine.stats.atk) / (magic ? foe.stats.md : foe.stats.def))
      * typeMult(sk.e, foe.pet) * traitMult(mine.pet, sk);
    var k = real / base;
    state.coef = Math.round(k * 1000) / 1000;
    $("coef").value = state.coef;
    $("calMsg").textContent = "系数 " + state.coef;
    save(); renderBattle();
  });

  ["mine", "foe"].forEach(function (side) {
    var el = $(side + "Status");
    if (!el) return;
    el.addEventListener("change", function () { state[side].status = el.value; save(); renderBattle(); });
  });
  var fss = $("foeStatusSkill");
  if (fss) {
    fss.value = state.foeStatusSkill ? "1" : "";
    fss.addEventListener("change", function () {
      state.foeStatusSkill = fss.value === "1";
      save(); renderBattle();
    });
  }

  ["coef", "cut"].forEach(function (id) {
    $(id).value = state[id];
    $(id).addEventListener("input", function () { state[id] = Number($(id).value) || 0; save(); renderBattle(); });
  });
  $("weather").value = state.weather || "";
  $("weather").addEventListener("change", function () { state.weather = $("weather").value; save(); renderBattle(); });

  document.addEventListener("input", function (e) {
    var side = e.target.getAttribute && e.target.getAttribute("data-state");
    if (!side) return;
    var key = e.target.getAttribute("data-key");
    var v = Math.max(0, Number(e.target.value) || 0);
    state[side].st[key] = v;
    save(); renderBattle();
  });

  // 同速平手：用「种子 + 回合数」决定，保证同一回合重放一致
  function tieFlip(turn) {
    var seed = Number(state.seed) || 1;
    var x = (seed ^ (turn * 2654435761)) >>> 0;
    x = (x ^ (x >>> 13)) * 1274126177 >>> 0;
    return (x >>> 31) === 0;
  }

  // 进化链：宠物 pre 字段指向上一阶的图鉴号
  function evolveOf(pet) {
    var byNum = {};
    PETS.forEach(function (x) { if (x.num) byNum[String(x.num)] = x; });
    var out = PETS.filter(function (x) { return String(x.pre || "") === String(pet.num || "-"); });
    return out.length ? out[0] : null;
  }

  // 道具：进化之力（每场每方 1 次）
  function useItem(side) {
    var st = state[side];
    if (st.itemUsed) return { ok: false, msg: "进化之力已经用过了" };
    var pet = sidePet(side);
    var next = evolveOf(pet);
    if (!next) return { ok: false, msg: pet.n + " 没有可进化的形态" };
    var before = pet.n;
    st.slots[st.active] = next.n;
    var ns = sideStats(side);
    st.hp = Math.min(ns.stats.hp, st.hp);
    st.itemUsed = true;
    autofillMoves(side, true);
    var leader = /首领/.test(before) || /首领/.test(next.n);
    return { ok: true, msg: before + " → " + next.n, leader: leader };
  }

  function advanceActive(side) {
    var s = state[side];
    if (!s.slots || !s.slots.length) return null;
    s.active = (s.active + 1) % s.slots.length;
    var st = sideStats(side);
    s.hp = st.stats.hp;
    return st.pet.n;
  }

  // 从官方描述里抠出可用的百分比（拿不准的一律只记录、不进公式）
  function buffEffect(desc) {
    var out = { pow: 0, dmg: 0, taken: 0, notes: [] };
    var d = String(desc || "");
    var m;
    if ((m = d.match(/技能威力([+-]\d+)%/))) { out.pow += Number(m[1]); out.notes.push("威力 " + m[1] + "%"); }
    if ((m = d.match(/双攻([+-]\d+)%/))) { out.dmg += Number(m[1]); out.notes.push("双攻 " + m[1] + "%"); }
    if ((m = d.match(/造成[^。；]*?伤害([+-]\d+)%/))) { out.dmg += Number(m[1]); out.notes.push("造成伤害 " + m[1] + "%"); }
    if ((m = d.match(/受到[^。；]*?伤害([+-]\d+)%/))) { out.taken += Number(m[1]); out.notes.push("受到伤害 " + m[1] + "%"); }
    return out;
  }

  // 每回合结算：掉血 / 回血 / 回能（从官方描述里抠）
  // 官方效果链：触发时机 / 层数上限 / 离场清空
  function buffChain(name) {
    return (window.BUFF_FX || []).filter(function (x) { return x.n === name; })[0] || null;
  }
  var TRIGGER_LABEL = { 7: "回合结束", 12: "攻击时" };

  function buffTriggerLabel(name) {
    var c = buffChain(name);
    if (!c || c.t == null) return "";
    return TRIGGER_LABEL[c.t] || ("触发类型 " + c.t);
  }

  function buffTick(desc) {
    var d = String(desc || "").replace(/<[^>]+>/g, "");
    var out = { dot: 0, heal: 0, energy: 0 };
    var m;
    if ((m = d.match(/(?:回合结束|每回合)[^。；]*?受到[^。；]*?(\d+)%/))) out.dot = Number(m[1]);
    if (!out.dot && (m = d.match(/(?:回合结束|每回合)[^。；]*?造成[^。；]*?(\d+)%生命/))) out.dot = Number(m[1]);
    if ((m = d.match(/(?:回合结束|每回合)[^。；]*?恢复[^。；]*?(\d+)%/))) out.heal = Number(m[1]);
    if ((m = d.match(/回合结束[^。；]*?回复?(\d+)能量/))) out.energy = Number(m[1]);
    var t = d.match(/持续(\d+)回合/);
    if (t) out.turns = Number(t[1]);
    return out;
  }

  function buffInfo(name) {
    return (window.BUFFS || []).filter(function (x) { return x.n === name; })[0] || null;
  }

  // 部分状态注明「X 系精灵免疫」
  function buffImmune(desc) {
    var d = String(desc || "").replace(/<[^>]+>/g, "");
    var m = d.match(/([\u4e00-\u9fa5]{1,3})系[^。；]{0,6}免疫/);
    return m ? m[1] : "";
  }

  function sidePet(side) {
    return (PETS.filter(function (p) { return p.n === state[side].slots[state[side].active]; })[0]) || PETS[0];
  }

  function isImmune(side, name) {
    var info = buffInfo(name);
    var el = buffImmune(info && info.d);
    if (!el) return false;
    var pet = sidePet(side);
    return pet.el === el || pet.el2 === el;
  }

  function buffTotals(side) {
    var list = (state.buffs && state.buffs[side]) || [];
    var t = { pow: 0, dmg: 0, taken: 0, applied: 0, recorded: 0 };
    list.forEach(function (b) {
      if (isImmune(side, b.n)) return;
      var info = buffInfo(b.n);
      var e = buffEffect(info && info.d);
      var st = Math.max(1, Number(b.st) || 1);
      if (e.pow || e.dmg || e.taken) t.applied++; else t.recorded++;
      t.pow += e.pow * st; t.dmg += e.dmg * st; t.taken += e.taken * st;
    });
    return t;
  }

  function renderBuffs() {
    var box = $("buffChips");
    if (!box) return;
    var html = "";
    ["mine", "foe"].forEach(function (side) {
      (state.buffs[side] || []).forEach(function (b) {
        var info = buffInfo(b.n);
        var tick = buffTick(info && info.d);
        var meta = [];
        if ((Number(b.st) || 1) > 1) meta.push("×" + b.st);
        if (tick.dot) meta.push("掉" + tick.dot + "%");
        if (tick.heal) meta.push("回" + tick.heal + "%");
        if (b.t !== undefined && b.t !== -1) meta.push("剩" + b.t + "回合");
        if (isImmune(side, b.n)) meta.push("免疫生效中");
        var trig = buffTriggerLabel(b.n);
        if (trig) meta.push(trig);
        var ch = buffChain(b.n);
        if (ch && ch.cap && ch.cap < 99) meta.push("上限" + ch.cap);
        if (ch && ch.clean) meta.push("离场清空");
        html += "<span class='buff-chip' data-side='" + side + "' data-name='" + b.n + "' title='" + ((info || {}).d || "") + "'>" +
          "<b>" + (side === "mine" ? "我" : "敌") + "·" + b.n + "</b>" +
          (meta.length ? "<i>" + meta.join(" ") + "</i>" : "") +
          "<button type='button' aria-label='移除'>×</button></span>";
      });
    });
    box.innerHTML = html || "<span class='hint'>还没添加。加一条试试：中毒</span>";

    var note = $("buffNote");
    if (note) {
      var parts = [];
      ["mine", "foe"].forEach(function (side) {
        var t = buffTotals(side);
        var immuneList = (state.buffs[side] || []).filter(function (b) { return isImmune(side, b.n); });
        if (!t.applied && !t.recorded && !immuneList.length) return;
        var bits = [];
        if (t.pow) bits.push("威力 " + (t.pow > 0 ? "+" : "") + Math.round(t.pow) + "%");
        if (t.dmg) bits.push("伤害 " + (t.dmg > 0 ? "+" : "") + Math.round(t.dmg) + "%");
        if (t.taken) bits.push("受伤 " + (t.taken > 0 ? "+" : "") + Math.round(t.taken) + "%");
        var ticks = (state.buffs[side] || []).map(function (b) {
          var info = buffInfo(b.n), tk = buffTick(info && info.d);
          return (tk.dot || tk.heal) ? (b.n + (tk.dot ? " 掉" + tk.dot + "%" : "") + (tk.heal ? " 回" + tk.heal + "%" : "")) : null;
        }).filter(Boolean);
        parts.push((side === "mine" ? "我方" : "敌方") + "：" +
          (bits.length ? bits.join("、") : "无数值加成") +
          (ticks.length ? "；每回合：" + ticks.join("、") : "") +
          "（计入 " + t.applied + " 条，仅记录 " + t.recorded + " 条" +
          (immuneList.length ? "，免疫未生效：" + immuneList.map(function (b) { return b.n; }).join("、") : "") + "）");
      });
      note.textContent = parts.join("　");
    }
  }

  // 回合结束：结算所有每回合效果，然后推进剩余回合数
  function settleBuffs() {
    var log = [];
    var mine = sideStats("mine"), foe = sideStats("foe");
    ["mine", "foe"].forEach(function (side) {
      state.buffs[side] = state.buffs[side] || [];
      var list = state.buffs[side];
      var maxHp = (side === "mine" ? mine : foe).stats.hp;
      list.forEach(function (b) {
        if (isImmune(side, b.n)) return;
        var info = buffInfo(b.n);
        var tk = buffTick(info && info.d);
        var ch = buffChain(b.n);
        if (ch && ch.t != null && ch.t !== 7 && !tk.dot && !tk.heal) return;
        var st = Math.max(1, Number(b.st) || 1);
        if (tk.dot) {
          var dmg = Math.max(1, Math.round(maxHp * tk.dot / 100 * st));
          state[side].hp = Math.max(0, state[side].hp - dmg);
          log.push((side === "mine" ? "我" : "敌") + " " + b.n + " -" + dmg);
        }
        if (tk.heal) {
          var heal = Math.max(1, Math.round(maxHp * tk.heal / 100 * st));
          state[side].hp = Math.min(maxHp, state[side].hp + heal);
          log.push((side === "mine" ? "我" : "敌") + " " + b.n + " +" + heal);
        }
        if (tk.energy) {
          state[side].energy = Math.min(10, (Number(state[side].energy) || 0) + tk.energy * st);
          log.push((side === "mine" ? "我" : "敌") + " " + b.n + " 能量+" + tk.energy * st);
        }
      });
        // 冻结：生命低于冻结比例（5%×层数）时力竭
        var fz = (state.buffs[side] || []).filter(function (x) { return x.n === "冻结"; })[0];
        if (fz) {
          var fzPct = 5 * Math.max(1, Number(fz.st) || 1);
          if (state[side].hp > 0 && state[side].hp / maxHp * 100 <= fzPct) {
            state[side].hp = 0;
            log.push((side === "mine" ? "我" : "敌") + " 冻结 " + fzPct + "% → 力竭");
          }
        }

      // 暴风雪：非冰系精灵每回合 +1 层冻结（用独立计数器，避免与手挂 buff 冲突）
      state.freeze = state.freeze || { mine: 0, foe: 0 };
      if (state.weather === "snow") {
        var pm = sideStats(side).pet;
        var isIce = pm.el === "冰" || pm.el2 === "冰";
        if (!isIce) {
          state.freeze[side] = (Number(state.freeze[side]) || 0) + 1;
          log.push((side === "mine" ? "我" : "敌") + " 暴风雪：冻结 " + state.freeze[side] + " 层");
        }
      }

      // 冻结：每层流失 5% 最大生命；生命占比低于层数 → 强制换下
      var fz2 = Number(state.freeze[side]) || 0;
      if (fz2 > 0) {
        var pm2 = sideStats(side).pet;
        var immuneIce = pm2.el === "冰" || pm2.el2 === "冰";
        if (!immuneIce) {
          var dmgF = Math.max(1, Math.round(maxHp * 0.05 * fz2));
          state[side].hp = Math.max(0, state[side].hp - dmgF);
          log.push((side === "mine" ? "我" : "敌") + " 冻结 " + fz2 + " 层 -" + dmgF);
          if (state[side].hp > 0 && (state[side].hp / maxHp * 100) < fz2) {
            var newPet = advanceActive(side);
            log.push((side === "mine" ? "我" : "敌") + " 冻结过深 → 强制换下" + (newPet ? "：" + newPet : ""));
          }
        }
      }

      // 禁足回合递减（在回合结束时）
      // 雷鸣：引电累积与引爆
      if (state.weather === "thunder") {
        var pmE = sideStats(side).pet;
        var immuneEle = pmE.el === "电" || pmE.el2 === "电";
        if (!immuneEle) {
          state.lead = state.lead || { mine: 0, foe: 0 };
          state.lead[side] = (Number(state.lead[side]) || 0) + 1;
          var lead = state.lead[side];
          if (lead >= 2) {
            var dmgE = Math.max(1, Math.round(maxHp * 0.25));
            state[side].hp = Math.max(0, state[side].hp - dmgE);
            state.lead[side] = 0;
            log.push((side === "mine" ? "我" : "敌") + " 引电 2 层 → -" + dmgE + "（25% 最大生命）");
          } else {
            log.push((side === "mine" ? "我" : "敌") + " 引电 " + lead + " 层");
          }
        }
      }

      // 剩余回合递减
      state.buffs[side] = list.filter(function (b) {
        if (b.t === undefined || b.t === -1) return true;
        b.t = Number(b.t) - 1;
        return b.t > 0;
      });
    });
    return log;
  }

  // 先手值 = 手动填的 + 技能自带（官方 skill_priority 6→+1、4→-1）
  // 迅捷：技能自带的“先出手”标记（官方 priority 字段并未体现，靠描述里的关键词）
  function isSwift(sk) {
    var d = (sk && sk.d) || "";
    return /迅捷[，,。]/.test(d) && !/迅捷技能/.test(d);
  }

  // 特性授出的迅捷：快锤（能耗<3）、暴食（龙系）、飓风（队友同技能）、起飞加速（本场首发）
  function traitSwift(side, pet, sk) {
    var d = (pet && pet.td) || "";
    if (!sk) return false;
    if (/能耗小于3的技能[^。]*迅捷/.test(d) && (sk.c || 0) < 3) return true;
    if (/龙系技能[^。]*迅捷/.test(d) && sk.e === "龙") return true;
    if (/翼系技能[^。]*迅捷/.test(d) && sk.e === "翼") return true;
    if (/首次使用的技能获得迅捷/.test(d)) {
      var used = (state[side] || {}).usedSk || {};
      return !used[sk.n];
    }
    if (/其他翼系精灵携带相同技能[^。]*迅捷/.test(d)) {
      var mates = (state[side].slots || []).filter(function (n) {
        var q = PETS.filter(function (x) { return x.n === n; })[0];
        return q && (q.el === "翼" || q.el2 === "翼") && n !== (pet || {}).n;
      });
      return mates.some(function (n) {
        var q = PETS.filter(function (x) { return x.n === n; })[0];
        return q && (state[side].moves || []).indexOf(sk.n) >= 0;
      });
    }
    return false;
  }

  // 速度修正：减速印记 速度-10/层，加速印记 +10/层
  function speedWithMarks(side) {
    var base = sideStats(side).stats.spe;
    var slow = stackOf(side, "减速印记");
    var fast = stackOf(side, "加速印记");
    return Math.max(1, base - 10 * slow + 10 * fast);
  }

  function prioOf(side, sk) {
    var base = Number(state[side].priority) || 0;
    var bonus = sk && Number(sk.r) ? Number(sk.r) : 0;
    var swift = (isSwift(sk) || traitSwift(side, sidePet(side), sk)) ? 1 : 0;
    return base + bonus + swift;
  }

  // ---- 状态技效果（逐个实现，先覆盖恶系 17 条）----
  // 直接作用于 state：换增益、换招式、换血比例、加临时修正
  var STATUS_FX = {
    "欺诈契约": function (side) { swapBuffs(side); return "交换增益/减益"; },
    "隐藏条款": function (side) { swapMoves(side); return "交换携带技能"; },
    "力量吞噬": function (side) { addMod(side, "power", 20); addMod(other(side), "power", -20); return "我方威力+20，敌方-20"; },
    "恶念交换": function (side) { swapHpRatio(side); return "交换生命比例"; },
    "暗箱操作": function (side) { addMod(side, "stat", -50); return "自己双攻双防-50%"; },
    "应对！暗箱操作": function (side) { addMod(side, "stat", -100); return "自己双攻双防-100%"; },
    "贪婪": function (side) { addMod(side, "drain", 100); return "自己获得100%吸血"; },
    "纺纱": function (side) { addBuff(other(side), "暗涌印记", 1); return "敌方获得1层暗涌印记"; },
    "假冒": function (side) { copyHpRatio(side); return "生命比例对齐敌方"; },
    "恶意逃离": function (side) { return "脱离（本回合离场）"; },
    "应对！恶意逃离": function (side) { return "脱离（本回合离场）"; },
    "掉包": function (side) { addMod(other(side), "stat", -200); return "敌方属性增益翻转为减益"; },
    "等价交换": function (side) { addMod(side, "taken", -90); return "本回合减伤90%"; },
    "应对！等价交换": function (side) { addMod(side, "taken", -90); return "本回合减伤90%"; },
    "虚假破产": function (side) { addMod(side, "taken", -80); return "本回合减伤80%"; },
    "应对！虚假破产": function (side) { addMod(side, "taken", -80); return "本回合减伤80%"; },
    "伪造账单": function (side) { return "若敌方回血则改为失去2倍（记录）"; },

    "退化": function (side) {
      var msg = regress(other(side));
      return msg || "敌方没有可退化的上一阶";
    },
    "逆向演化": function (side) {
      var mine = stackOf(side, "萌化");
      if (mine) { removeBuff(side, "萌化"); addBuff(other(side), "萌化", mine); return "把自己 " + mine + " 层萌化转给对方"; }
      return "自己没有萌化";
    },
    "超级糖果": function (side) { addMod(side, "power", 60); return "威力 +60"; },

    // ---- 火系 ----
    "引燃": function (side) { addBuff(other(side), "灼烧", 10); return "敌方 +10 层灼烧"; },
    "天火": function (side) { addBuff(other(side), "灼烧", 10); return "敌方 +10 层灼烧"; },
    "充分燃烧": function (side) { var b = stackOf(other(side), "灼烧"); addBuff(other(side), "灼烧", b); return "敌方灼烧翻倍（+" + b + " 层）"; },
    "怒火": function (side) { addMod(side, "power", 120); addMod(side, "taken", 40); return "自己威力+120%、受伤+40%"; },
    "热身": function (side) { state[side].pending = state[side].pending || {}; state[side].pending.power = (Number(state[side].pending.power) || 0) + 100; return "下次攻击威力翻倍（已挂起）"; },
    "焚烧烙印": function (side) { addBuff(other(side), "灼烧", 5); return "驱散印记，敌方 +5 层灼烧"; },
    "淬火": function (side, win) { addMod(side, "taken", -80); if (win) { state[side].pending = state[side].pending || {}; state[side].pending.power = (Number(state[side].pending.power) || 0) + 100; return "减伤 80%，应对成功：下次威力翻倍（已挂起）"; } return "减伤 80%"; },
    "火焰护盾": function (side, win) { addMod(side, "taken", -70); if (win) { addBuff(other(side), "灼烧", 6); return "减伤 70%，应对成功：敌方 +6 层灼烧"; } return "减伤 70%"; },

    // ---- 草系 ----
    "丰饶": function (side) { addMod(side, "stat", 140); return "双攻 +140%"; },
    "孢子": function (side) { addBuff(other(side), "寄生", 3); return "敌方 +3 层寄生"; },
    "盛开": function (side) { addMod(side, "power", 30); return "全技能威力 +30"; },
    "氧输送": function (side) { state[side].energy = Math.min(10, (Number(state[side].energy) || 0) + 4); addMod(side, "stat", 70); return "回 4 能量、魔攻 +70%"; },
    "徒长": function (side) { state[side].energy = Math.min(10, (Number(state[side].energy) || 0) + 10); return "回复 10 能量"; },
    "根吸收": function (side) { var st = sideStats(side); state[side].energy = Math.min(10, (Number(state[side].energy) || 0) + 4); state[side].hp = Math.min(st.stats.hp, state[side].hp + Math.round(st.stats.hp * 0.15)); return "回复 15% 生命 + 4 能量"; },
    "光合作用": function (side) { addBuff(side, "光合印记", 1); return "自己 +1 层光合印记"; },

    // ---- 冰系 ----
    "冰点": function (side) { addBuff(other(side), "冻结", 5); return "敌方 +5 层冻结"; },
    "冰墙": function (side, win) { addMod(side, "taken", -80); if (win) { addBuff(other(side), "冻结", 2); return "减伤 80%，应对成功：敌方 +2 层冻结"; } return "减伤 80%"; },
    "速冻": function (side) { addBuff(other(side), "减速印记", 2); return "敌方 +2 层减速印记"; }
  };

  // 萌化/退化：把当前精灵换成它的上一阶（pets 的 pre 字段指向前一阶图鉴号）
  function regress(side) {
    var st = state[side];
    var pet = sidePet(side);
    var byNum = {};
    PETS.forEach(function (x) { if (x.num) byNum[String(x.num)] = x; });
    var prev = byNum[String(pet.pre || "")] || null;
    if (!prev) return null;
    var oldMax = sideStats(side).stats.hp;
    var ratio = oldMax ? st.hp / oldMax : 1;
    st.slots[st.active] = prev.n;
    var newMax = sideStats(side).stats.hp;
    st.hp = Math.max(1, Math.round(newMax * ratio));
    autofillMoves(side, true);
    return pet.n + " → " + prev.n + "（萌化退化）";
  }

  function other(side) { return side === "mine" ? "foe" : "mine"; }

  function removeBuff(side, name) {
    state.buffs[side] = (state.buffs[side] || []).filter(function (b) { return b.n !== name; });
    save();
  }

  function stackOf(side, name) {
    var b = (state.buffs[side] || []).filter(function (x) { return x.n === name; })[0];
    return b ? Math.max(1, Number(b.st) || 1) : 0;
  }

  function addMod(side, key, val) {
    var sd = state[side];
    sd.mods = sd.mods || { power: 0, stat: 0, taken: 0, drain: 0 };
    sd.mods[key] = (sd.mods[key] || 0) + val;
  }

  function addBuff(side, name, stacks) {
    state.buffs[side] = state.buffs[side] || [];
    var exist = state.buffs[side].filter(function (b) { return b.n === name; })[0];
    if (exist) exist.st = (Number(exist.st) || 1) + stacks;
    else state.buffs[side].push({ n: name, st: stacks, t: -1 });
    // 萌化：一旦挂上就立刻退化一阶（描述：退化到上一阶，种族资质降低）
    if (name === "萌化") {
      var msg = regress(side);
      if (msg) {
        state.buffs[side] = state.buffs[side].filter(function (b) { return b.n !== "萌化"; });
        state.lastRegress = msg;
      }
    }
    save();
  }

  function swapBuffs(side) {
    var a = state[side].mods || { power: 0, stat: 0, taken: 0, drain: 0 };
    var b = state[other(side)].mods || { power: 0, stat: 0, taken: 0, drain: 0 };
    state[side].mods = b; state[other(side)].mods = a;
    var tmp = state.buffs[side];
    state.buffs[side] = state.buffs[other(side)];
    state.buffs[other(side)] = tmp;
  }

  function swapMoves(side) {
    var tmp = state[side].moves;
    state[side].moves = state[other(side)].moves;
    state[other(side)].moves = tmp;
  }

  function swapHpRatio(side) {
    var me = sideStats(side), fo = sideStats(other(side));
    var myR = state[side].hp / me.stats.hp;
    var foR = state[other(side)].hp / fo.stats.hp;
    state[side].hp = Math.max(1, Math.round(foR * me.stats.hp));
    state[other(side)].hp = Math.max(1, Math.round(myR * fo.stats.hp));
  }

  function copyHpRatio(side) {
    var me = sideStats(side), fo = sideStats(other(side));
    var foR = state[other(side)].hp / fo.stats.hp;
    state[side].hp = Math.max(1, Math.round(foR * me.stats.hp));
  }

  // 通用解析：描述里能读懂的数值效果，自动套用（历史里标"自动解析"）
  function genericStatusFx(side, sk, counterWin) {
    var raw = (sk.d || "").replace(/<[^>]+>/g, "");
    // “下一次攻击”类：先记成一次性加成，等下次真的攻击时再乘
    var pendM = /下一?次(?:攻击|行动|技能)[^。]{0,10}?威力(?:翻倍|[+＋](\d+))/.exec(raw);
    if (pendM) {
      var add = pendM[1] ? Number(pendM[1]) : 100;
      state[side].pending = state[side].pending || {};
      state[side].pending.power = (Number(state[side].pending.power) || 0) + add;
      return "下次攻击威力+" + add + "（已挂起，自动解析）";
    }

    // "应对X：…" 之后的效果只在应对成功时生效
    var d = raw, branch = "";
    var cut = raw.split(/应对(?:攻击|防御|状态|变化)?[：:]/);
    if (cut.length > 1) { d = cut[0]; branch = cut.slice(1).join(""); }
    var done = [], m;
    // 涉及场下/替补/全队的效果，不能直接算在当前精灵身上
    if (/场下|替补|队伍中|全体我方/.test(d)) return "";
    if ((m = /(?:恢复|回复)(\d+)能量/.exec(d))) {
      state[side].energy = Math.min(10, (Number(state[side].energy) || 0) + Number(m[1]));
      done.push("能量+" + m[1]);
    }
    if ((m = /(?:恢复|回复)(?:精灵)?(\d+)%生命/.exec(d))) {
      var st = sideStats(side);
      state[side].hp = Math.min(st.stats.hp, state[side].hp + Math.round(st.stats.hp * Number(m[1]) / 100));
      done.push("回血" + m[1] + "%");
    }
    if ((m = /敌方获得(\d+)层([\u4e00-\u9fa5]+)/.exec(d))) {
      addBuff(other(side), m[2], Number(m[1])); done.push("敌方+" + m[1] + "层" + m[2]);
    }
    if ((m = /自己获得(\d+)层([\u4e00-\u9fa5]+)/.exec(d))) {
      addBuff(side, m[2], Number(m[1])); done.push("自己+" + m[1] + "层" + m[2]);
    }
    if ((m = /减伤(\d+)%/.exec(d))) {
      addMod(side, "taken", -Number(m[1])); done.push("减伤" + m[1] + "%");
    }
    if ((m = /(?:双攻|物攻|魔攻)[+＋](\d+)%/.exec(d))) {
      addMod(side, "stat", Number(m[1])); done.push("攻+" + m[1] + "%");
    }
    if ((m = /威力[+＋](\d+)/.exec(d))) {
      addMod(side, "power", Number(m[1])); done.push("威力+" + m[1]);
    }
    // 应对分支
    if (counterWin && branch) {
      var sub = genericOnBranch(side, branch);
      if (sub) done.push("应对成功：" + sub);
    }
    // 能耗修正
    var costM = /(?:全技能|技能)?能耗[-−](\d+)/.exec(raw);
    var elCost = /([\u4e00-\u9fa5])系技能[^。]{0,12}能耗[-−](\d+)/.exec(raw);
    if (elCost) {
      state[side].costByEl = state[side].costByEl || {};
      state[side].costByEl[elCost[1]] = (Number(state[side].costByEl[elCost[1]]) || 0) - Number(elCost[2]);
      done.push(elCost[1] + "系能耗-" + elCost[2]);
    } else if (costM) {
      var isNext = /下一次|下次/.test(raw);
      if (isNext) {
        state[side].pending = state[side].pending || {};
        state[side].pending.cost = (Number(state[side].pending.cost) || 0) - Number(costM[1]);
        done.push("下一次能耗-" + costM[1]);
      } else {
        state[side].costFlat = (Number(state[side].costFlat) || 0) - Number(costM[1]);
        done.push("全技能能耗-" + costM[1]);
      }
    }
    return done.length ? done.join("、") + "（自动解析）" : "";
  }

  // 只解析“应对成功”那一半的效果
  function genericOnBranch(side, d) {
    var done = [], m;
    if ((m = /敌方获得(\d+)层([\u4e00-\u9fa5]+)/.exec(d))) { addBuff(other(side), m[2], Number(m[1])); done.push("敌方+" + m[1] + "层" + m[2]); }
    if ((m = /额外获得(\d+)层([\u4e00-\u9fa5]+)/.exec(d))) { addBuff(other(side), m[2], Number(m[1])); done.push("敌方+" + m[1] + "层" + m[2]); }
    if ((m = /(?:自己|永久)[^。]{0,6}[+＋](\d+)%/.exec(d))) { addMod(side, "stat", Number(m[1])); done.push("攻+" + m[1] + "%"); }
    if (/威力翻倍/.test(d)) { addMod(side, "power", 100); done.push("威力翻倍"); }
    if (/吸血(\d+)%/.test(d)) { var mm = /吸血(\d+)%/.exec(d); addMod(side, "drain", Number(mm[1])); done.push("吸血" + mm[1] + "%"); }
    return done.join("、");
  }

  // 奉献：全队永久增益（5 种随机效果，可叠加）
  function devotionOf(side) {
    state.devotion = state.devotion || {};
    state.devotion[side] = state.devotion[side] || { pow: 0, cost: 0, combo: 0, drain: 0, poison: 0 };
    return state.devotion[side];
  }

  function devotionAdd(side, key, n) {
    var d = devotionOf(side);
    d[key] = (Number(d[key]) || 0) + n;
  }

  // 随机给一层（花精灵/坚韧铠甲用），用回合数做种子保证可复现
  function devotionRandom(side, turn) {
    var keys = ["pow", "cost", "combo", "drain", "poison"];
    var seed = (Number(state.seed) || 1) * 31 + (turn || 1) * 7 + (side === "mine" ? 1 : 2);
    var idx = Math.abs(seed) % keys.length;
    devotionAdd(side, keys[idx], 1);
    return keys[idx];
  }

  var DEVOTION_LABEL = { pow: "威力+20", cost: "能耗-2", combo: "连击+1", drain: "吸血+10%", poison: "附加2层中毒" };

  // 迸发附带效果：使用攻击技能后给对手加能耗惩罚（如 超负荷）
  function burstRiders(side, sk) {
    var pet = sidePet(side), d = (pet.td || ""), m;
    if (!sk || !sk.p) return "";
    if ((m = /攻击技能获得迸发[：:]敌方获得全技能能耗[+＋](\d+)/.exec(d))) {
      var fo = other(side);
      state[fo].costFlat = (Number(state[fo].costFlat) || 0) + Number(m[1]);
      return "敌方全技能能耗+" + m[1];
    }
    return "";
  }

  // 禁足/锁场：敌方 N 回合无法主动换人（穿透反弹，不吃反弹）
  function applyLock(side, sk) {
    var d = (sk && sk.d) || "";
    var rng = /(\d+)\s*[-~到]\s*(\d+)\s*回合(?:<[^>]+>)?禁足/.exec(d);
    var m = rng || /(\d+)回合(?:<[^>]+>)?禁足/.exec(d) || /(\d+)回合内?无法更换/.exec(d);
    if (!m) return "";
    var n;
    if (rng) {
      var lo = Number(rng[1]), hi = Number(rng[2]);
      var seed = (Number(state.seed) || 1) + (Number(state.history.length) + 1) * 17;
      n = lo + (Math.abs(seed) % (hi - lo + 1));
    } else {
      n = Number(m[1]) || 2;
    }
    var fo = other(side);
    state.lock = state.lock || { mine: 0, foe: 0 };
    state.lock[fo] = Math.max(Number(state.lock[fo]) || 0, n);
    return "敌方被禁足 " + n + " 回合（无法换人）";
  }

  function applyStatusSkill(side, sk, counterWin) {
    var fx = STATUS_FX[sk.n];
    if (fx) return fx(side, counterWin) || "";
    return genericStatusFx(side, sk, counterWin);
  }

  // 非阻塞提示（alert 在部分环境会卡住）
  function notice(msg) {
    var box = $("stratHint");
    if (box) { box.textContent = msg; box.style.color = "#c9503c"; }
    console.warn("[提示] " + msg);
  }

  // 事件类特性：从本回合实际发生的事里推断，而不是靠玩家手填
  function eventTraits(side, ev) {
    var pet = sidePet(side), d = (pet.td || ""), out = [], m;
    if (!d) return out;

    // 造成克制伤害后 → 攻防速+N%
    if (ev.superEffective && (m = /造成克制伤害后[^。]*?攻防速\+(\d+)%/.exec(d))) {
      addMod(side, "stat", Number(m[1]));
      out.push(pet.t + "：克制命中 → 攻防速+" + m[1] + "%");
      if (/回复2能量/.test(d)) {
        state[side].energy = Math.min(10, (Number(state[side].energy) || 0) + 2);
        out.push("回复2能量");
      }
    }
    // 每失去 25% 生命 → 连击 +2
    if (ev.hpLostPct > 0 && (m = /每失去(\d+)%生命[^。]*?连击数\+(\d+)/.exec(d))) {
      var steps = Math.floor(ev.hpLostPct / Number(m[1]));
      if (steps > 0) {
        state[side].st = state[side].st || {};
        state[side].st.combo = (Number(state[side].st.combo) || 1) + steps * Number(m[2]);
        out.push(pet.t + "：失去 " + Math.round(ev.hpLostPct) + "% 生命 → 连击+" + steps * Number(m[2]));
      }
    }
    // 先于敌方行动 → 连击 +1
    if (ev.first && /先于敌方行动[^。]*?连击数\+(\d+)/.test(d)) {
      var n = Number(/先于敌方行动[^。]*?连击数\+(\d+)/.exec(d)[1]);
      state[side].st = state[side].st || {};
      state[side].st.combo = (Number(state[side].st.combo) || 1) + n;
      out.push(pet.t + "：本回合先手 → 连击+" + n);
    }
    return out;
  }

  // 入场 / 离场 / 击败类特性：由换人与倒下事件触发
  // 稀兽花宝（按血脉）/ 契约的形状（按咕噜球）：入场时生效
  function applyEntryTrait(side) {
    var pet = sidePet(side), name = pet.t || "", d = pet.td || "", out = [];
    if (!/稀兽花宝|契约的形状/.test(name + d)) return out;
    var tbl = window.ENTRY_TRAITS || {};
    var eff = null, label = "";
    if (/稀兽花宝/.test(name + d)) {
      var el = state[side].blood;
      eff = (tbl.blood || {})[el];
      label = "稀兽花宝·" + (el || "?") + "血脉";
    } else {
      var ball = state[side].ball || "普通球";
      eff = (tbl.ball || {})[ball];
      label = "契约的形状·" + ball;
    }
    if (!eff) return out;
    var fo = other(side), st = sideStats(side);
    switch (eff.kind) {
      case "heal": state[side].hp = Math.min(st.stats.hp, state[side].hp + Math.round(st.stats.hp * eff.v / 100)); break;
      case "cost": state[side].costFlat = (Number(state[side].costFlat) || 0) + eff.v; break;
      case "combo": state[side].st = state[side].st || {}; state[side].st.combo = (Number(state[side].st.combo) || 1) + eff.v; break;
      case "power": state[side].choicePower = (Number(state[side].choicePower) || 0) + eff.v; break;
      case "stat": addMod(side, "stat", eff.v); break;
      case "defUp": addMod(side, "taken", 0); break;
      case "speed": addMod(side, "code", 0); break;
      case "energyFoe": state[fo].energy = Math.max(0, (Number(state[fo].energy) || 0) + eff.v); break;
      case "statDownFoe": addMod(fo, "stat", eff.v); break;
      case "defDown": addMod(fo, "stat", Math.abs(eff.v)); break;
      case "defDownMd": addMod(fo, "stat", Math.abs(eff.v)); break;
      case "slowFoe": addBuff(fo, "减速印记", 6); break;
      case "buffFoe": addBuff(fo, eff.name, eff.v); break;
      case "drainEnergy": addMod(side, "drain", eff.v); state[fo].energy = Math.max(0, (Number(state[fo].energy) || 0) - 1); break;
      case "healStat": state[side].hp = Math.min(st.stats.hp, state[side].hp + Math.round(st.stats.hp * eff.v / 100)); addMod(side, "stat", 40); break;
      case "comboCost": state[side].costFlat = (Number(state[side].costFlat) || 0) - 1; state[side].st = state[side].st || {}; state[side].st.combo = (Number(state[side].st.combo) || 1) + 1; break;
      default: break;
    }
    out.push(label + "：" + eff.note);
    return out;
  }

  // 离场类：换下的那只把自己的效果留给下一只
  function applyLeaveTrait(side, leavingPet) {
    var d = (leavingPet && leavingPet.td) || "", out = [], m;
    if (!d || !/离场后/.test(d)) return out;
    if ((m = /离场后[^。]*?双攻\+(\d+)%/.exec(d))) {
      addMod(side, "stat", Number(m[1]));
      out.push(leavingPet.t + "：离场 → 换上来的双攻+" + m[1] + "%");
    }
    if ((m = /离场后[^。]*?双防\+(\d+)%/.exec(d))) {
      out.push(leavingPet.t + "：换上来的双防+" + m[1] + "%（不影响伤害）");
    }
    if (/免疫冻结/.test(d)) out.push("换上来的免疫冻结");
    if (/免疫灼烧/.test(d)) out.push("换上来的免疫灼烧");
    return out;
  }

  function entryTraits(side) {
    var pet = sidePet(side), d = pet.td || "", out = [], m;
    out = out.concat(applyEntryTrait(side));
    if (!d) return out;
    if ((m = /每入场1次[^。]*?双攻(?:永久)?\+(\d+)%/.exec(d))) {
      addMod(side, "stat", Number(m[1]));
      out.push(pet.t + "：入场 → 双攻+" + m[1] + "%");
    }
    if (/入场时[^。]*?物攻\+100%/.test(d)) {
      addMod(side, "stat", 100);
      out.push(pet.t + "：入场 → 物攻+100%");
    }
    if ((m = /入场时偷取敌方[^。]*?(\d+)能量/.exec(d))) {
      var fo = other(side);
      var take = Math.min(Number(m[1]), Number(state[fo].energy) || 0);
      state[fo].energy = Math.max(0, (Number(state[fo].energy) || 0) - take);
      state[side].energy = Math.min(10, (Number(state[side].energy) || 0) + take);
      out.push(pet.t + "：偷取 " + take + " 能量");
    }
    if ((m = /若自己魔力值为1[^。]*?双攻\+(\d+)%/.exec(d)) && Number(state[side].mana) === 1) {
      addMod(side, "stat", Number(m[1]));
      out.push(pet.t + "：魔力值为1 → 双攻+" + m[1] + "%");
    }
    return out;
  }

  function defeatTraits(winnerSide) {
    var pet = sidePet(winnerSide), d = pet.td || "", out = [], m;
    var loser = other(winnerSide);
    if (!d) return out;
    if ((m = /主动击败敌方精灵时[^。]*?永久获得双攻\+(\d+)%/.exec(d))) {
      addMod(winnerSide, "stat", Number(m[1]));
      out.push(pet.t + "：击败 → 永久双攻+" + m[1] + "%");
    }
    if ((m = /击败敌方精灵时[^。]*?敌方额外损失(\d+)点魔力/.exec(d))) {
      state[loser].mana = Math.max(0, (Number(state[loser].mana) || 0) - Number(m[1]));
      out.push(pet.t + "：敌方额外损失 " + m[1] + " 魔力");
    }
    if ((m = /主动击败敌方后[^。]*?获得(\d+)次随机奉献/.exec(d))) {
      for (var i = 0; i < Number(m[1]); i++) devotionRandom(winnerSide, (state.history.length || 0) + i + 1);
      out.push(pet.t + "：获得 " + m[1] + " 层随机奉献");
    }
    return out;
  }

  function recordTurn() {
    var mine = sideStats("mine"), foe = sideStats("foe");
    // 上一回合的临时减伤只在那一回合生效
    ["mine", "foe"].forEach(function (sd) {
      if (state[sd].mods && state[sd].mods.taken) state[sd].mods.taken = 0;
    });

    var before = {
      mineHp: state.mine.hp, foeHp: state.foe.hp,
      mineEnergy: state.mine.energy, foeEnergy: state.foe.energy,
      mineMana: state.mine.mana, foeMana: state.foe.mana
    };
    var meAct = ($("meAction") && $("meAction").value) || "attack";
    var foeAct = ($("foeActionRec") && $("foeActionRec").value) || "attack";
    var meMove = ($("meMoveSel") && $("meMoveSel").value) || "";
    var foeMove = ($("foeMoveSel") && $("foeMoveSel").value) || "";
    var koSide = ($("koSide") && $("koSide").value) || "";
    var foeForced = !!($("foeForced") && $("foeForced").value === "1");
    var stratId = ($("stratSel") && $("stratSel").value) || "";
    var strat = STRATS.filter(function (x) { return x.id === stratId; })[0] || null;

    var forcedMe = false, forcedFoe = false;
    // 实际执行结果（不是下拉意图）：动作 + 招式 + 打出的伤害
    var meActDone = "", foeActDone = "", meSkillDone = null, foeSkillDone = null, meHitDone = 0, foeHitDone = 0;
    var meSk = meMove ? skillByName(meMove) : null;
    var foeSk = foeMove ? skillByName(foeMove) : null;
    var dmgToFoe = 0, dmgToMe = 0;
    var chargeLog = "";
    var releasedMe = false, releasedFoe = false;

    // 上一回合蓄力的技能，本回合自动释放（不消耗额外操作）
    state.charging = state.charging || { mine: null, foe: null };
    if (state.charging.mine) {
      var c1 = skillByName(state.charging.mine);
      state.charging.mine = null;
      if (c1) {
        meMove = c1.n; meSk = c1; meAct = "attack"; releasedMe = true;
        chargeLog = "我 蓄力完成：" + c1.n;
        var metaM = (state.chargeMeta || {}).mine;
        var ruleM = /若蓄力期间受到攻击[^。]*?威力变为敌方技能威力的(\d+)倍/.exec(c1.d || "");
        if (metaM && metaM.hit && ruleM) {
          var boost = Number(ruleM[1]) * (Number(metaM.foePower) || 0);
          if (boost > 0) { meSk = Object.assign({}, c1, { p: boost }); chargeLog += "（被打断 → 威力 " + metaM.foePower + "×" + ruleM[1] + "）"; }
        }
      }
    }
    if (state.charging.foe) {
      var c2 = skillByName(state.charging.foe);
      state.charging.foe = null;
      if (c2) { foeMove = c2.n; foeSk = c2; foeAct = "attack"; releasedFoe = true; chargeLog = (chargeLog ? chargeLog + "；" : "") + "敌 蓄力完成：" + c2.n; }
    }

    function isAttackSkill(x) { return !!x && (x.t === "物攻" || x.t === "魔攻"); }
    function canUseSkill(sd, sk) {
      return (Number(state[sd].energy) || 0) >= costOf(sd, sk);
    }
    var counterWinMe = meAct === "counter" && foeAct === "attack" && canUseSkill("foe", foeSk) && meSk && foeSk && (
      (meSk.t === "防御" && isAttackSkill(foeSk)) ||
      (isAttackSkill(meSk) && foeSk.t === "状态") ||
      (meSk.t === "状态" && foeSk.t === "防御"));
    var counterWinFoe = foeAct === "counter" && meAct === "attack" && canUseSkill("mine", meSk) && foeSk && meSk && (
      (foeSk.t === "防御" && isAttackSkill(meSk)) ||
      (isAttackSkill(foeSk) && meSk.t === "状态") ||
      (foeSk.t === "状态" && meSk.t === "防御"));

    // 本回合真的打了攻击，消耗“下一次攻击”加成
    if (meAct === "attack" && meSk && meSk.p && state.mine.pending) state.mine.pending = null;
    if (state.lock) {
      ["mine", "foe"].forEach(function (sd) {
        if (Number(state.lock[sd]) > 0) state.lock[sd] = Number(state.lock[sd]) - 1;
      });
    }
    state.mine.choicePower = 0; state.foe.choicePower = 0;
    if (state.mine.pending) { state.mine.pending.cost = 0; }
    if (state.foe.pending) { state.foe.pending.cost = 0; }
    if (foeAct === "attack" && foeSk && foeSk.p && state.foe.pending) state.foe.pending = null;

    // 选择技：按所选分支结算
    var choiceLog = "";
    var choiceName = ($("choiceSel") && $("choiceSel").value) || "";
    if (meSk && meSk.p) {
      var opts = choiceOptions(meSk);
      if (opts.length && choiceName !== "") {
        var opt = opts[Number(choiceName)] || "";
        choiceLog = opt;
        var pm = /威力\+(\d+)(?!%)/.exec(opt);
        if (pm) state.mine.choicePower = Number(pm[1]);
        var sm = /(物攻|魔攻|双攻|物防|魔防|速度)[+＋](\d+)%/.exec(opt);
        if (sm) addMod("mine", "stat", Number(sm[2]));
        var em = /敌方获得(\d+)层([\u4e00-\u9fa5]+)/.exec(opt);
        if (em) addBuff("foe", em[2], Number(em[1]));
      }
    }
    state.lastRegress = "";

    // 蓄力技：描述里有“蓄力”且不是“无需蓄力/可在蓄力状态下使用”的辅助技
  function isChargeSkill(sk) {
    var d = (sk && sk.d) || "";
    if (!/蓄力/.test(d)) return false;
    if (/无需蓄力|可在蓄力状态/.test(d)) return false;
    return !!(sk.p || /造成.*伤害/.test(d));
  }

  // 蓄力技：本回合只进入蓄力，不出伤害
    if (!releasedMe && meAct === "attack" && meSk && isChargeSkill(meSk) && !state.noCharge.mine) {
      state.charging.mine = meSk.n;
      state.chargeMeta.mine = { hit: false, foePower: 0 };
      chargeLog = (chargeLog ? chargeLog + "；" : "") + "我 开始蓄力：" + meSk.n;
      meAct = "charge";
    }
    if (!releasedFoe && foeAct === "attack" && foeSk && isChargeSkill(foeSk) && !state.noCharge.foe) {
      state.charging.foe = foeSk.n;
      state.chargeMeta.foe = { hit: false, foePower: 0 };
      chargeLog = (chargeLog ? chargeLog + "；" : "") + "敌 开始蓄力：" + foeSk.n;
      foeAct = "charge";
    }
    if (meSk && /无需蓄力/.test(meSk.d || "")) state.noCharge.mine = true;
    if (foeSk && /无需蓄力/.test(foeSk.d || "")) state.noCharge.foe = true;

  // 锁场（流沙/石锁这类）
    var lockLog = "";
    if (meSk && (meAct === "attack" || meAct === "counter")) lockLog = applyLock("mine", meSk);
    if (foeSk && (foeAct === "attack" || foeAct === "counter")) {
      var fl = applyLock("foe", foeSk);
      if (fl) lockLog = (lockLog ? lockLog + "；" : "") + fl;
    }

    // 迸发附带效果（攻击技能打出去才触发）
    var riderLog = "";
    if (meAct === "attack" && meSk && meSk.p) riderLog = burstRiders("mine", meSk);
    if (foeAct === "attack" && foeSk && foeSk.p) {
      var fr = burstRiders("foe", foeSk);
      if (fr) riderLog = (riderLog ? riderLog + "；" : "") + fr;
    }

    // 状态技效果（本次记录生效）
    var hpBeforeMe = state.mine.hp, hpBeforeFoe = state.foe.hp;
    window.__se = false;
    var statusLog = [];
    var refractLog = "";
    if ((meAct === "attack" || meAct === "counter") && meSk && !meSk.p) {
      var s1 = applyStatusSkill("mine", meSk, counterWinMe);
      if (s1) statusLog.push("我 " + meSk.n + "：" + s1);
    }
    if ((foeAct === "attack" || foeAct === "counter") && foeSk && !foeSk.p) {
      var s2 = applyStatusSkill("foe", foeSk, counterWinFoe);
      if (s2) statusLog.push("敌 " + foeSk.n + "：" + s2);
    }

    // 行动顺序：应对成功 > 换人 > 先手值（此处用速度）> 随机
    var meFirst;
    if (!!counterWinMe !== !!counterWinFoe) meFirst = !!counterWinMe;
    else if ((meAct === "switch") !== (foeAct === "switch")) meFirst = meAct === "switch";
    else if (prioOf("mine", meSk) !== prioOf("foe", foeSk)) {
      meFirst = prioOf("mine", meSk) > prioOf("foe", foeSk);
    } else if (speedWithMarks("mine") !== speedWithMarks("foe")) {
      meFirst = speedWithMarks("mine") > speedWithMarks("foe");
    }
    else meFirst = tieFlip(state.history.length + 1);

    function meActs() {
      meActDone = meAct;
      if (meAct === "switch") return;
      if (meAct === "charge") { state.mine.energy = Math.min(10, (Number(state.mine.energy) || 0) + 5); return; }
      if (meAct === "counter") {
        state.mine.energy = Math.max(0, (Number(state.mine.energy) || 0) - (meSk && meSk.c ? meSk.c : 3));
        return;
      }
      var cost = costOf("mine", meSk);
      if (window.__relayMode) { cost = 0; }
      if (!window.__relayMode && (Number(state.mine.energy) || 0) < cost) {
        meAct = "charge"; meActDone = "charge"; forcedMe = true;
        state.mine.energy = Math.min(10, (Number(state.mine.energy) || 0) + 5);
        return;
      }
      meSkillDone = meSk;
      dmgToFoe = hitDamage("mine", meSk, mine, foe);
      meHitDone = dmgToFoe;
      if (counterWinFoe && foeSk && foeSk.t === "防御") dmgToFoe = Math.round(dmgToFoe * 0.3);
      state.mine.energy = Math.max(0, (Number(state.mine.energy) || 0) - cost);
      state.foe.hp = Math.max(0, state.foe.hp - dmgToFoe);
    }

    function foeActs() {
      foeActDone = foeAct;
      if (foeAct === "switch") return;
      if (foeAct === "charge") { state.foe.energy = Math.min(10, (Number(state.foe.energy) || 0) + 5); return; }
      if (foeAct === "counter") {
        state.foe.energy = Math.max(0, (Number(state.foe.energy) || 0) - (foeSk && foeSk.c ? foeSk.c : 3));
        return;
      }
      var cost = costOf("foe", foeSk);
      if (window.__relayMode) { cost = 0; }
      if (!window.__relayMode && (Number(state.foe.energy) || 0) < cost) {
        foeAct = "charge"; foeActDone = "charge"; forcedFoe = true;
        state.foe.energy = Math.min(10, (Number(state.foe.energy) || 0) + 5);
        return;
      }
      foeSkillDone = foeSk;
      dmgToMe = hitDamage("foe", foeSk, foe, mine);
      if (counterWinMe && meSk && meSk.t === "防御") dmgToMe = Math.round(dmgToMe * 0.3);
      foeHitDone = dmgToMe;
      state.foe.energy = Math.max(0, (Number(state.foe.energy) || 0) - cost);
      state.mine.hp = Math.max(0, state.mine.hp - dmgToMe);
    }

    var itemMe = null, itemFoe = null;
    if (meAct === "item") {
      var r1 = useItem("mine");
      if (!r1.ok) { notice("用不了进化之力：" + r1.msg); return; }
      itemMe = r1.msg + (r1.leader ? "" : "（非首领形态，机制上不该可用）");
    }
    if (foeAct === "item") {
      var r2 = useItem("foe");
      if (!r2.ok) { notice("对手用不了进化之力：" + r2.msg); return; }
      itemFoe = r2.msg + (r2.leader ? "" : "（非首领形态，机制上不该可用）");
    }
    if (itemMe || itemFoe) { mine = sideStats("mine"); foe = sideStats("foe"); }

    state.lock = state.lock || { mine: 0, foe: 0 };
    if (meAct === "switch" && Number(state.lock.mine) > 0) {
      notice("我方被禁足，还有 " + state.lock.mine + " 回合不能换人。");
      return;
    }
    if (foeAct === "switch" && Number(state.lock.foe) > 0) {
      notice("敌方被禁足，还有 " + state.lock.foe + " 回合不能换人。");
      return;
    }

    var switchedMe = null, switchedFoe = null;
    var leavingMe = sidePet("mine"), leavingFoe = sidePet("foe");
    if (meAct === "switch") { switchedMe = advanceActive("mine"); state.lead.mine = 0; }
    if (foeAct === "switch") { switchedFoe = advanceActive("foe"); state.lead.foe = 0; }
    var entryLog = [];
    if (switchedMe) {
      applyLeaveTrait("mine", leavingMe).forEach(function (x) { entryLog.push("我 " + x); });
      entryTraits("mine").forEach(function (x) { entryLog.push("我 " + x); });
    }
    if (switchedFoe) {
      applyLeaveTrait("foe", leavingFoe).forEach(function (x) { entryLog.push("敌 " + x); });
      entryTraits("foe").forEach(function (x) { entryLog.push("敌 " + x); });
    }
    if (switchedMe || switchedFoe) { mine = sideStats("mine"); foe = sideStats("foe"); }

    if (meFirst) { meActs(); if (state.foe.hp > 0) foeActs(); }
    else { foeActs(); if (state.mine.hp > 0) meActs(); }

    // 本回合用过哪些技能（放在结算之后，避免影响本回合“首次”判定）
    if (meAct === "attack" && meSk) { state.mine.usedSk = state.mine.usedSk || {}; state.mine.usedSk[meSk.n] = true; }
    if (foeAct === "attack" && foeSk) { state.foe.usedSk = state.foe.usedSk || {}; state.foe.usedSk[foeSk.n] = true; }

    // 事件类特性结算：用本回合真实发生的事触发
    var meStats = sideStats("mine"), foeStats2 = sideStats("foe");
    var evMe = {
      superEffective: !!window.__se,
      first: meFirst,
      hpLostPct: Math.max(0, (hpBeforeMe - state.mine.hp) / Math.max(1, meStats.stats.hp) * 100)
    };
    var evFoe = {
      superEffective: !!window.__se,
      first: !meFirst,
      hpLostPct: Math.max(0, (hpBeforeFoe - state.foe.hp) / Math.max(1, foeStats2.stats.hp) * 100)
    };
    var evLog = [];
    eventTraits("mine", evMe).forEach(function (x) { evLog.push("我 " + x); });
    eventTraits("foe", evFoe).forEach(function (x) { evLog.push("敌 " + x); });

    // 冰钻类：敌方冻结达到 5 层 → 触发锁场（玩家规则补充）
    var freezeLockLog = "";
    (function () {
      var myPet = sidePet("mine");
      var myTrait = (myPet.t || "") + " " + (myPet.td || "");
      if (/冰钻/.test(myTrait)) {
        var fz = (state.buffs.foe || []).filter(function (b) { return b.n === "冻结"; })[0];
        if (fz && Number(fz.st) >= 5) {
          state.lock = state.lock || { mine: 0, foe: 0 };
          state.lock.foe = Math.max(Number(state.lock.foe) || 0, 2);
          freezeLockLog = "冰钻：敌方冻结 " + fz.st + " 层 → 禁足 2 回合（玩家规则）";
        }
      }
    })();

    // 折射：只有真正打出去才触发（用实际执行结果）
    if (meActDone === "attack" && meSkillDone && meSkillDone.n === "折射") refractLog = applyRefract("mine", meSkillDone);
    if (foeActDone === "attack" && foeSkillDone && foeSkillDone.n === "折射") {
      var _rf2 = applyRefract("foe", foeSkillDone);
      if (_rf2) refractLog = (refractLog ? refractLog + "；" : "") + _rf2;
    }

    // 蓄力中被打断：用“实际执行结果”，对手真出招且造成伤害才算
    if (state.charging && state.charging.mine && foeActDone === "attack" && foeSkillDone && foeHitDone > 0) {
      state.chargeMeta = state.chargeMeta || {};
      state.chargeMeta.mine = { hit: true, foePower: Number(foeSkillDone.p) || 0 };
    }
    if (state.charging && state.charging.foe && meActDone === "attack" && meSkillDone && meHitDone > 0) {
      state.chargeMeta = state.chargeMeta || {};
      state.chargeMeta.foe = { hit: true, foePower: Number(meSkillDone.p) || 0 };
    }

    // 回合结束状态结算（冻结力竭、中毒掉血等），放在倒下判定之前
    var buffLog = settleBuffs();

    // 倒下结算
    if (state.foe.hp <= 0 || koSide === "foe") {
      state.foe.mana = Math.max(0, (Number(state.foe.mana) || 0) - 1);
      state.foe.hp = foe.stats.hp;
      defeatTraits("mine").forEach(function (x) { entryLog.push("我 " + x); });
    }
    if (state.mine.hp <= 0 || koSide === "mine") {
      state.mine.mana = Math.max(0, (Number(state.mine.mana) || 0) - 1);
      state.mine.hp = mine.stats.hp;
      defeatTraits("foe").forEach(function (x) { entryLog.push("敌 " + x); });
    }

    // 抓包模式：血量以服务器回传为准，避免本地再扣一次
    if (window.__relayMode && window.__relayHp) {
      if (Number.isFinite(window.__relayHp.mine)) state.mine.hp = window.__relayHp.mine;
      if (Number.isFinite(window.__relayHp.foe)) state.foe.hp = window.__relayHp.foe;
    }

    var turn = state.history.length + 1;
    var ph = phaseOf(turn, {
      foeHpPct: state.foe.hp / foe.stats.hp * 100, myHpPct: state.mine.hp / mine.stats.hp * 100,
      foeMana: Number(state.foe.mana) || 0, myMana: Number(state.mine.mana) || 0,
      foeEnergy: Number(state.foe.energy) || 0, myEnergy: Number(state.mine.energy) || 0,
      foeForced: foeForced
    });

    state.history.push({
      turn: turn, phase: ph.label, before: before,
      mineHp: state.mine.hp, foeHp: state.foe.hp,
      mineEnergy: state.mine.energy, foeEnergy: state.foe.energy,
      mineMana: state.mine.mana, foeMana: state.foe.mana,
      meAct: meActDone || meAct, foeAct: foeActDone || foeAct, meMove: meMove, foeMove: foeMove,
      meHit: meHitDone, foeHit: foeHitDone,
      dmgToFoe: dmgToFoe, dmgToMe: dmgToMe,
      forcedMe: forcedMe, forcedFoe: forcedFoe,
      counterMe: meAct === "counter" ? counterWinMe : null,
      counterFoe: foeAct === "counter" ? counterWinFoe : null,
      switchedMe: switchedMe, switchedFoe: switchedFoe, itemMe: itemMe, itemFoe: itemFoe,
      strat: strat ? strat.name : "", stratRole: strat ? ROLE[strat.role].label : "",
      stratL: strat ? (strat.l || "") : "", stratFit: strat ? Math.round(phaseFit(strat, phaseOf(state.history.length + 1, {}).key, roleOf(sidePet("mine"))).score * 100) : "",
      buffLog: buffLog, statusLog: statusLog, refractLog: refractLog, entryLog: entryLog, freezeLockLog: freezeLockLog, evLog: evLog, chargeLog: chargeLog, lockLog: lockLog, riderLog: riderLog, choiceLog: choiceLog, regressLog: state.lastRegress || "",
      first: meFirst ? "me" : "foe",
      prioMe: prioOf("mine", meSk), prioFoe: prioOf("foe", foeSk)
    });
    if ($("koSide")) $("koSide").value = "";
    if ($("foeForced")) $("foeForced").value = "";
    save(); renderAll();
  }

  // 分享链接：把双方配置压进 URL hash（不含历史记录，避免过长）
  function sharePayload() {
    function side(sd) {
      var x = state[sd];
      return { slots: x.slots, active: x.active, level: x.level, star: x.star, iv: x.iv,
        nature: x.nature, moves: x.moves, blood: x.blood, hp: x.hp, energy: x.energy, mana: x.mana, priority: x.priority };
    }
    return { v: 2, mine: side("mine"), foe: side("foe"), coef: state.coef, weather: state.weather, doubles: state.doubles };
  }

  function shareURL() {
    var raw = JSON.stringify(sharePayload());
    var enc = btoa(unescape(encodeURIComponent(raw))).replace(/=+$/, "");
    return location.origin + location.pathname + "#s=" + enc;
  }

  function applyShare() {
    var m = /#s=([A-Za-z0-9+/_-]+)/.exec(location.hash || "");
    if (!m) return false;
    try {
      var pad = m[1].length % 4 ? new Array(5 - (m[1].length % 4)).join("=") : "";
      var data = JSON.parse(decodeURIComponent(escape(atob(m[1] + pad))));
      if (!data || data.v !== 2) return false;
      ["mine", "foe"].forEach(function (sd) {
        if (data[sd]) state[sd] = Object.assign(state[sd], data[sd]);
      });
      if (typeof data.coef === "number") state.coef = data.coef;
      if (data.weather !== undefined) state.weather = data.weather;
      state.doubles = !!data.doubles;
      return true;
    } catch (e) { return false; }
  }

  function exportJSON() {
    return JSON.stringify({
      app: "luoke-calc",
      version: 2,
      savedAt: new Date().toISOString(),
      mine: state.mine, foe: state.foe,
      coef: state.coef, seed: state.seed, custom: state.custom,
      history: state.history
    }, null, 2);
  }

  function downloadExport() {
    var blob = new Blob([exportJSON()], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") +
      "-" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
    var a = document.createElement("a");
    a.href = url;
    a.download = "luoke-match-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function importJSON(text) {
    var data = JSON.parse(text);
    if (!data || data.app !== "luoke-calc") throw new Error("不是本工具导出的记录");
    state.mine = Object.assign(state.mine, data.mine || {});
    state.foe = Object.assign(state.foe, data.foe || {});
    if (typeof data.coef === "number") state.coef = data.coef;
    if (data.seed) state.seed = data.seed;
    if (data.custom) state.custom = data.custom;
    if (Array.isArray(data.history)) state.history = data.history;
    save(); renderAll();
  }

  window.luokeExport = exportJSON;
  window.luokeImport = importJSON;

  // 6 维状态向量 → 自动阶段判定（对齐 Just chat.md 的自动划分架构）
  function aliveCount(side) {
    var names = (state[side].slots || []).filter(function (n) { return !!n; });
    return names.length || 1;
  }

  function phaseVector() {
    var mine = sideStats("mine"), foe = sideStats("foe");
    var hist = state.history || [];
    var seen = {};
    hist.forEach(function (h) { if (h.foeMove) seen[h.foeMove] = 1; });
    var knownFoSkills = Object.keys(seen).length;
    var D1 = Math.min(1, knownFoSkills / 4);                       // 信息完备度（已观测到的对手技能数/4）
    var D2 = Math.abs((Number(state.mine.energy) || 0) - (Number(state.foe.energy) || 0)); // 能量不对称
    var sweepOnField = roleOf(sidePet("mine")) === "sweep";
    var markStacks = Number((state.mine.st || {}).mark || 0);
    var D3 = (sweepOnField && (Number(state.mine.energy) || 0) >= 5 && markStacks > 0) ? 1 : (sweepOnField ? 0.5 : 0);
    var D4 = (Number(state.mine.mana) || 0) - (Number(state.foe.mana) || 0);               // 魔力值差
    var D5 = Math.min(aliveCount("mine"), aliveCount("foe"));       // 联防轴完整度
    var D6 = aliveCount("mine") + aliveCount("foe");                // 存活单位

    var charged = hist.some(function (h) { return /聚能/.test(h.meAct === "charge" || h.foeAct === "charge" ? "x" : "") || h.meAct === "charge" || h.foeAct === "charge"; });
    var switched = hist.some(function (h) { return h.meAct === "switch" || h.foeAct === "switch"; });

    var phase = "probe";
    if (D6 <= 6 || Math.abs(D4) >= 2) phase = "end";
    else if ((D3 === 1) + (Math.abs(D4) >= 1) + (D5 <= 1) >= 2) phase = "kill";
    else if ((Math.abs(D4) === 1 ? 1 : 0) + (D2 >= 3 ? 1 : 0) + (D3 === 0.5 ? 1 : 0) >= 2) phase = "build";
    else if ((D1 >= 0.6 ? 1 : 0) + (D2 >= 2 ? 1 : 0) + (charged ? 1 : 0) + (switched ? 1 : 0) >= 2) phase = "press";

    return { D1: D1, D2: D2, D3: D3, D4: D4, D5: D5, D6: D6, phase: phase, charged: charged, switched: switched };
  }

  function fillStrategies() {
    var sel = $("stratSel");
    if (!sel) return;
    try { fillStrategiesInner(sel); } catch (e) { sel.innerHTML = "<option>ERR:" + e.message + "</option>"; }
  }

  // 阶段契合度：阶段一致 +0.5、职能一致 +0.3、主责 +0.2
  function phaseFit(tag, phaseKey, role) {
    if (!tag) return { score: 0, note: "" };
    var sc = 0, bits = [];
    if (tag.phase === phaseKey) { sc += 0.5; bits.push("阶段✅"); } else bits.push("阶段✗");
    if (tag.role === role) { sc += 0.3; bits.push("职能✅"); } else bits.push("职能✗");
    if (tag.prim) { sc += 0.2; bits.push("主责✅"); } else bits.push("主责✗");
    return { score: sc, note: bits.join(" ") };
  }

  function fitLabel(sc) { return sc >= 0.8 ? "高" : sc >= 0.5 ? "中" : "低"; }

  function fillStrategiesInner(sel) {
    var mine = sideStats("mine"), foe = sideStats("foe");
    var vec = phaseVector();
    var ph = phaseOf(state.history.length + 1, {
      foeHpPct: state.foe.hp / foe.stats.hp * 100, myHpPct: state.mine.hp / mine.stats.hp * 100,
      foeMana: Number(state.foe.mana) || 0, myMana: Number(state.mine.mana) || 0,
      foeEnergy: Number(state.foe.energy) || 0, myEnergy: Number(state.mine.energy) || 0,
      foeForced: false
    });
    // 状态向量优先：资源结构比回合数更能说明“你在哪个阶段”
    if (vec && vec.phase) {
      var pm = PHASES.filter(function (x) { return x.key === vec.phase; })[0] || {};
      ph = Object.assign({}, ph, { key: vec.phase, label: pm.label || ph.label, color: pm.color || ph.color });
    }
    var act = ($("meAction") && $("meAction").value) || "attack";
    if (!$("meAction") || !$("meAction").value) state.uiAction = act;
    var role = roleOf(sidePet("mine"));
    var list = STRATS.filter(function (x) {
      return x.phase === ph.key && x.acts.indexOf(act) >= 0;
    });
    if (!list.length) {
      list = STRATS.filter(function (x) { return x.phase === ph.key; });
    }
    list.sort(function (a, b) {
      return (b.role === role) - (a.role === role) || (b.prim ? 1 : 0) - (a.prim ? 1 : 0);
    });
    var keep = sel.value;
    sel.innerHTML = "<option value=''>（不贴策略）</option>" + list.map(function (x) {
      var tag = ROLE[x.role].label + (x.prim ? "·主责" : "·辅责");
      return "<option value='" + x.id + "' data-desc='" + x.desc.replace(/'/g, " ") + "'>" + (x.l ? x.l + " " : "") + tag + "｜" + x.name + "</option>";
    }).join("");
    sel.value = list.some(function (x) { return x.id === keep; }) ? keep : "";

    var hint = $("stratHint");
    if (hint) {
      var cur = list.filter(function (x) { return x.id === sel.value; })[0];
      if (cur) {
        var f = phaseFit(cur, ph.key, role);
        hint.textContent = cur.desc + "　【契合度 " + fitLabel(f.score) + " · " + f.note + "】";
      } else {
        hint.textContent = "当前阶段（" + ph.label + "）可贴 " + list.length + " 条策略；不选也可以。";
      }
    }
  }

  function fillChoice() {
    var row = $("choiceRow"), sel = $("choiceSel");
    if (!row || !sel) return;
    var name = ($("meMoveSel") && $("meMoveSel").value) || "";
    var sk = name ? skillByName(name) : null;
    var opts = sk ? choiceOptions(sk) : [];
    if (!opts.length) { row.style.display = "none"; sel.innerHTML = ""; return; }
    row.style.display = "";
    var keep = sel.value;
    sel.innerHTML = opts.map(function (o, i) { return "<option value='" + i + "'>" + o + "</option>"; }).join("");
    sel.value = keep && Number(keep) < opts.length ? keep : "0";
  }

  function fillMoveSelects() {
    [["meMoveSel", "mine"], ["foeMoveSel", "foe"]].forEach(function (pair) {
      var sel = $(pair[0]);
      if (!sel) return;
      var keep = sel.value;
      var names = state[pair[1]].moves.filter(Boolean);
      var html = "<option value=''>（不指定招式）</option>";
      if (names.length) {
        html += names.map(function (n) { return "<option value='" + n + "'>" + n + "</option>"; }).join("");
      } else {
        html += "<option value=''>（还没选招式 → 去“我方精灵/敌方精灵”页填写）</option>";
      }
      sel.innerHTML = html;
      sel.value = names.indexOf(keep) >= 0 ? keep : "";
    });
  }

  ["meAction", "stratSel", "meMoveSel"].forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener("change", function () {
      if (id === "stratSel") {
        var tag = STRATS.filter(function (x) { return x.id === el.value; })[0];
        var ph = phaseOf(state.history.length + 1, {});
        var vio = tag ? stratViolation(tag, ph, tag.role) : "";
        if (vio) notice("⚠ " + vio);
        else if ($("stratHint")) $("stratHint").style.color = "";
      }
      if (id === "meAction") { state.uiAction = el.value; save(); }
      fillStrategies();
      if (id === "meMoveSel") fillChoice();
    });
  });

  if ($("recordTurn")) {
    $("recordTurn").addEventListener("click", recordTurn);
    $("undoTurn").addEventListener("click", function () {
      var h = state.history.pop();
      if (h && h.before) {
        state.mine.hp = h.before.mineHp; state.foe.hp = h.before.foeHp;
        state.mine.energy = h.before.mineEnergy; state.foe.energy = h.before.foeEnergy;
        state.mine.mana = h.before.mineMana; state.foe.mana = h.before.foeMana;
      }
      save(); renderAll();
    });
    $("clearTurns").addEventListener("click", function () {
      state.history = []; save(); renderBattle();
    });
    $("restoreTurn").addEventListener("change", function () {
      var t = Number(this.value);
      if (!t) return;
      var h = state.history.filter(function (x) { return x.turn === t; })[0];
      if (!h) return;
      state.mine.hp = h.mineHp; state.foe.hp = h.foeHp;
      state.mine.energy = h.mineEnergy; state.foe.energy = h.foeEnergy;
      if (h.mineMana !== undefined) state.mine.mana = h.mineMana;
      if (h.foeMana !== undefined) state.foe.mana = h.foeMana;
      state.history = state.history.slice(0, t);
      this.value = "";
      save(); renderAll();
    });
  }

  if ($("exportBtn")) {
    $("exportBtn").addEventListener("click", downloadExport);
    $("importFile").addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { importJSON(String(reader.result)); }
        catch (e) { notice("导入失败：" + e.message); }
      };
      reader.readAsText(f);
      this.value = "";
    });
  }

  var pickingSide = null;
  function openPicker(side) {
    pickingSide = side;
    $("picker").hidden = false;
    $("pickerSearch").value = "";
    renderPicker("");
    setTimeout(function () { $("pickerSearch").focus(); }, 50);
  }
  function closePicker() { pickingSide = null; $("picker").hidden = true; }
  function renderPicker(q) {
    var list = PETS.filter(function (x) { return !q || x.n.indexOf(q) >= 0; });
    $("pickerList").innerHTML = list.map(function (x) {
      var sp = window.SPRITES && window.SPRITES[x.n];
      return "<button type='button' class='picker-item' data-pick='" + x.n + "'>" +
        (sp ? "<img class='picker-thumb' src='" + sp + "' alt='' loading='lazy'>" : "<i class='picker-thumb' style='background:" + elColor(x.el) + ";border-radius:8px;opacity:.25'></i>") +
        "<span>" + x.n + "</span>" +
        "<span style='color:#8b8578;font-size:11px;margin-left:auto'>" + x.el + "</span></button>";
    }).join("") || "<div style='color:#8b8578;font-size:13px'>没有匹配的精灵</div>";
  }

  document.addEventListener("click", function (e) {
    var bb = e.target.closest ? e.target.closest("[data-blood]") : null;
    if (bb) {
      var sd = bb.getAttribute("data-blood");
      var pt = sidePet(sd);
      var el = state[sd].blood;
      var skillName = pt.bs && el ? ((window.SKILLS || []).filter(function (k) { return String(k.id) === String(pt.bs[el]); })[0] || {}).n : null;
      if (!skillName) { notice("这只精灵没有该血脉技能"); return; }
      var mv = state[sd].moves;
      var idx = mv.indexOf("");
      if (idx < 0) idx = mv.indexOf(skillName);
      if (idx < 0) { notice("四个招式格都满了，先清一格再填。"); return; }
      mv[idx] = skillName;
      save(); buildMoves(sd); fillMoveSelects(); renderBattle(); renderCard(sd);
      return;
    }
    var btn = e.target.closest ? e.target.closest(".change-btn") : null;
    if (btn) { openPicker(btn.getAttribute("data-side")); return; }
    var item = e.target.closest ? e.target.closest("[data-pick]") : null;
    if (item && pickingSide) {
      var name = item.getAttribute("data-pick");
      var slot = state[pickingSide].active;
      var changed = state[pickingSide].slots[slot] !== name;
      state[pickingSide].slots[slot] = name;
      var st = sideStats(pickingSide);
      state[pickingSide].hp = st.stats.hp;
      // 换了精灵，招式跟着换成它的可学招式；同一只重复选择则保留手改
      autofillMoves(pickingSide, changed);
      save(); closePicker(); renderAll();
      return;
    }
  });
  $("pickerClose").addEventListener("click", closePicker);
  $("picker").addEventListener("click", function (e) { if (e.target === $("picker")) closePicker(); });
  $("pickerSearch").addEventListener("input", function () { renderPicker(this.value.trim()); });

  if ($("buffAdd")) {
    var dl = $("buffList");
    if (dl) dl.innerHTML = (window.BUFFS || []).map(function (x) { return "<option value='" + x.n + "'>"; }).join("");
    function addBuff() {
      var name = $("buffInput").value.trim();
      if (!name) return;
      var side = $("buffSide").value;
      var hit = (window.BUFFS || []).filter(function (x) { return x.n === name; })[0];
      if (!hit) { notice("官方数据里没有这个状态：" + name); return; }
      state.buffs[side] = state.buffs[side] || [];
      var stacks = Math.max(1, Number(($("buffStacks") || {}).value) || 1);
      var exist = state.buffs[side].filter(function (b) { return b.n === name; })[0];
      var chain = buffChain(name);
      var cap = chain && chain.cap ? chain.cap : 99;
      if (exist) exist.st = Math.min(cap, (Number(exist.st) || 1) + stacks);
      else {
        var tk = buffTick(hit.d);
        state.buffs[side].push({ n: name, st: Math.min(cap, stacks), t: tk.turns ? tk.turns : -1 });
      }
      $("buffInput").value = "";
      save(); renderBuffs(); renderBattle();
    }
    $("buffAdd").addEventListener("click", addBuff);
    $("buffInput").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addBuff(); } });
    $("buffChips").addEventListener("click", function (e) {
      var chip = e.target.closest ? e.target.closest(".buff-chip") : null;
      if (!chip || !e.target.closest("button")) return;
      var side = chip.getAttribute("data-side"), name = chip.getAttribute("data-name");
      state.buffs[side] = (state.buffs[side] || []).filter(function (x) { return x.n !== name; });
      save(); renderBuffs(); renderBattle();
    });
  }

  [["devPow", "pow"], ["devCost", "cost"], ["devCombo", "combo"], ["devDrain", "drain"], ["devPoison", "poison"]].forEach(function (pair) {
    var el = $(pair[0]);
    if (!el) return;
    el.value = String(devotionOf("mine")[pair[1]] || 0);
    el.addEventListener("input", function () {
      devotionOf("mine")[pair[1]] = Math.max(0, Number(el.value) || 0);
      save(); renderBattle(); renderDevotion();
    });
  });

  if ($("hudPick")) {
    $("hudPick").addEventListener("click", function () {
      var got = readHudPick(false);
      if (!got) notice("HUD 还没选招（先在悬浮窗点一个技能）");
    });
  }
  if ($("gameSave")) {
    $("gameSave").addEventListener("click", saveGame);
    renderGames();
  }
  if ($("devRoll")) {
    $("devRoll").addEventListener("click", function () {
      var key = devotionRandom("mine", state.history.length + 1);
      save(); renderDevotion(); syncDevotionInputs(); renderBattle();
      $("devNote").textContent += "（刚抽到：" + DEVOTION_LABEL[key] + "）";
    });
    $("devClear").addEventListener("click", function () {
      state.devotion.mine = { pow: 0, cost: 0, combo: 0, drain: 0, poison: 0 };
      save(); syncDevotionInputs(); renderDevotion(); renderBattle();
    });
  }

  ["mineBall", "foeBall"].forEach(function (id) {
    var sel = $(id);
    if (!sel) return;
    var side = id === "mineBall" ? "mine" : "foe";
    var balls = Object.keys((window.ENTRY_TRAITS || {}).ball || {});
    sel.innerHTML = balls.map(function (b) { return "<option value='" + b + "'>" + b + "</option>"; }).join("");
    sel.value = state[side].ball || "普通球";
    sel.addEventListener("change", function () {
      state[side].ball = sel.value; save(); renderBattle();
    });
  });

  var dblSel = $("doubleMode");
  if (dblSel) {
    dblSel.value = state.doubles ? "1" : "";
    dblSel.addEventListener("change", function () {
      state.doubles = dblSel.value === "1";
      save(); renderDoubles(); renderBattle();
    });
  }

  if ($("firstThisTurn")) {
    $("firstThisTurn").addEventListener("change", function () {
      state.firstThisTurn = this.value === "1";
      save(); renderBattle();
    });
  }

  [["cntEntry", "entry"], ["cntFaintMine", "faintMine"], ["cntFaintFoe", "faintFoe"], ["cntCounter", "counter"]].forEach(function (pair) {
    var el = $(pair[0]);
    if (!el) return;
    el.value = String((state.counters || {})[pair[1]] || 0);
    el.addEventListener("input", function () {
      state.counters = state.counters || {};
      state.counters[pair[1]] = Math.max(0, Number(el.value) || 0);
      save(); renderBattle();
    });
  });

  if ($("shareBtn")) {
    $("shareBtn").addEventListener("click", function () {
      var url = shareURL();
      $("shareUrl").value = url;
      $("sharePanel").hidden = false;
      setTimeout(function () { $("shareUrl").select(); }, 30);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(function () {});
      }
    });
    $("shareClose").addEventListener("click", function () { $("sharePanel").hidden = true; });
    $("sharePanel").addEventListener("click", function (e) { if (e.target === $("sharePanel")) $("sharePanel").hidden = true; });
  }

  [["devPow", "pow"], ["devCost", "cost"], ["devCombo", "combo"], ["devDrain", "drain"], ["devPoison", "poison"]].forEach(function (pair) {
    var el = $(pair[0]);
    if (!el) return;
    el.value = String(devotionOf("mine")[pair[1]] || 0);
    el.addEventListener("input", function () {
      devotionOf("mine")[pair[1]] = Math.max(0, Number(el.value) || 0);
      save(); renderBattle(); renderDevotion();
    });
  });

  // 读取对战 HUD 里点选的技能（HUD 写入 localStorage，这里取用）
  function readHudPick(silent) {
    var name = "";
    try { name = localStorage.getItem("roco.battleHud.pick.my") || ""; } catch (e) {}
    if (!name) return "";
    if (!skillByName(name)) return "";
    if ($("meMoveSel")) {
      $("meMoveSel").value = name;
      $("meMoveSel").dispatchEvent(new Event("change"));
    }
    if ($("meAction")) {
      $("meAction").value = "attack";
      $("meAction").dispatchEvent(new Event("change"));
    }
    if (!silent) notice("已取 HUD 选招：" + name);
    return name;
  }

  // 抓包直连：从 rkpp relay 的 NDJSON 里自动读技能/伤害/能量
  // 从事件里取字段：字段名在不同版本可能不一样，按候选路径逐个试
  function pickPath(obj, paths) {
    for (var i = 0; i < paths.length; i++) {
      var cur = obj, keys = paths[i].split("."), ok = true;
      for (var k = 0; k < keys.length; k++) {
        if (cur == null) { ok = false; break; }
        cur = cur[keys[k]];
      }
      if (ok && cur !== undefined && cur !== null && cur !== "") return cur;
    }
    return undefined;
  }

  function relaySkillName(d) {
    var nm = pickPath(d, ["primary_skill.skill_name", "detail.primary_skill.skill_name", "skill_name", "skill.name"]);
    if (nm && skillByName(nm)) return nm;
    var id = pickPath(d, ["primary_skill.skill_id", "detail.primary_skill.skill_id", "skill_id", "skill.id"]);
    if (id) {
      var hit = (window.SKILLS || []).filter(function (x) { return String(x.id) === String(id); })[0];
      if (hit) return hit.n;
    }
    return nm || "";
  }

  function initRelay() {
    var box = $("relayBox");
    if (!box || box.getAttribute("data-ready") === "1") return;
    box.setAttribute("data-ready", "1");
    var urlInput = $("relayUrl"), status = $("relayStatus"), toggle = $("relayOpen");
    var store = "luoke-relay-url";
    urlInput.value = localStorage.getItem(store) || "http://127.0.0.1:8766/events";
    var abort = null;

    function setStatus(t, bad) {
      if (!status) return;
      status.textContent = t;
      status.style.color = bad ? "#c9503c" : "";
    }

    var autoBuf = null, autoTimer = null, autoCount = 0, evCount = 0;
    function scheduleAuto() {
      if (!autoBuf) return;
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = setTimeout(function () {
        var buf = autoBuf;
        autoBuf = null;
        if (!buf || (!buf.me && !buf.foe)) return;
        if (!($("relayAuto") && $("relayAuto").checked)) return;
        try {
          $("recordTurn").click();
          autoCount++;
          setStatus("自动记录第 " + state.history.length + " 回合（累计 " + autoCount + "）");
        } catch (e) {
          setStatus("自动记录失败：" + e.message, true);
        }
      }, 900);
    }

    var pendingRound = null;
    function flushRound(reason) {
      if (!pendingRound) return;
      var has = pendingRound.me || pendingRound.foe;
      pendingRound = null;
      if (!has) return;
      if (!($("relayAuto") && $("relayAuto").checked)) return;
      try {
        $("recordTurn").click();
        autoCount++;
        setStatus("回合对齐记录第 " + state.history.length + " 回合（" + reason + "）");
      } catch (e) { setStatus("记录失败：" + e.message, true); }
    }

    function applyEvent(ev) {
      if (!ev || !ev.summary_kind) return;
      var d = ev.content || {};
      evCount++;
      if ($("relayRaw")) $("relayRaw").textContent = JSON.stringify(ev).slice(0, 600);
      if (ev.summary_kind === "client_skill_select" || ev.summary_kind === "server_skill_declare") {
        var skSel = relaySkillName(d) || pickPath(d, ["detail.skill_name", "detail.action_name"]);
        if (skSel && skillByName(skSel) && $("meMoveSel")) {
          $("meMoveSel").value = skSel;
          $("meMoveSel").dispatchEvent(new Event("change"));
          var aSel = $("meAction");
          if (aSel) { aSel.value = "attack"; aSel.dispatchEvent(new Event("change")); }
          setStatus("选用技能：" + skSel);
        }
        return;
      }
      if (ev.summary_kind === "battle_finish") {
        flushRound("对局结束");
        var res = pickPath(d, ["result_name", "detail.result_name", "result_code", "detail.result_code"]);
        var rounds = pickPath(d, ["rounds", "detail.rounds"]);
        setStatus("对局结束：" + (res || "?") + (rounds ? "（" + rounds + " 回合）" : "") + "，共记 " + state.history.length + " 回合");
        try { saveGame(); } catch (e) {}
        return;
      }
      if (ev.summary_kind === "round_start") {
        flushRound("下一回合开始");
        var roundNo = pickPath(d, ["round", "detail.round"]) || (state.history.length + 1);
        pendingRound = { round: roundNo, me: false, foe: false };
        var ws = pickPath(d, ["wrappers", "detail.wrappers"]) || [];
        var swap = $("relaySwap") && $("relaySwap").checked;
        var meW = ws[swap ? 1 : 0], foeW = ws[swap ? 0 : 1];
        if (meW && Number.isFinite(Number(meW.current_hp))) { state.mine.hp = Number(meW.current_hp); window.__relayHp = window.__relayHp || {}; window.__relayHp.mine = Number(meW.current_hp); }
        if (foeW && Number.isFinite(Number(foeW.current_hp))) { state.foe.hp = Number(foeW.current_hp); window.__relayHp = window.__relayHp || {}; window.__relayHp.foe = Number(foeW.current_hp); }
        renderAll();
        setStatus("回合 " + (pendingRound ? pendingRound.round : "?") + " 开始（已收 " + evCount + " 条事件）");
        return;
      }
      if (ev.summary_kind === "action_resolve" || ev.summary_kind === "pvp_perform" || ev.summary_kind === "preplay") {
        var sk = relaySkillName(d);
        var dmg = pickPath(d, ["damage_event.damage", "detail.damage_event.damage", "damage"]);
        var hpAfter = pickPath(d, ["damage_event.target_hp_after", "detail.damage_event.target_hp_after", "target_hp_after", "damage_event.target_hp"]);
        var en = (d.energy_event || (d.detail || {}).energy_event || {});
        var mine = ev.direction === "c2s";
        if (sk && skillByName(sk)) {
          var el = mine ? $("meMoveSel") : $("foeMoveSel");
          if (el) { el.value = sk; el.dispatchEvent(new Event("change")); }
        }
        window.__relayHp = window.__relayHp || {};
        if (mine) {
          if (Number.isFinite(Number(en.energy_after))) state.mine.energy = Number(en.energy_after);
          if (Number.isFinite(Number(hpAfter))) { state.foe.hp = Number(hpAfter); window.__relayHp.foe = Number(hpAfter); }
        } else {
          if (Number.isFinite(Number(en.energy_after))) state.foe.energy = Number(en.energy_after);
          if (Number.isFinite(Number(hpAfter))) { state.mine.hp = Number(hpAfter); window.__relayHp.mine = Number(hpAfter); }
        }
        if (pendingRound) pendingRound[mine ? "me" : "foe"] = true;
        else { autoBuf = autoBuf || {}; autoBuf[mine ? "me" : "foe"] = true; }
        var a = mine ? $("meAction") : $("foeActionRec");
        if (a) { a.value = "attack"; a.dispatchEvent(new Event("change")); }
        if (!pendingRound) scheduleAuto();
        renderAll();
        setStatus("已接收：" + (ev.summary_text || sk || ev.opencode));
      }
    }

    function connect() {
      var url = (urlInput.value || "").trim();
      if (!url) return setStatus("先填地址", true);
      localStorage.setItem(store, url);
      if (abort) abort.abort();
      abort = new AbortController();
      window.__relayMode = true;
      setStatus("连接中…");
      fetch(url, { signal: abort.signal }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        setStatus("已连接，等待事件…");
        var reader = res.body.getReader(), decoder = new TextDecoder(), buf = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) { setStatus("连接结束"); return; }
            buf += decoder.decode(r.value, { stream: true });
            var lines = buf.split("\n");
            buf = lines.pop();
            lines.forEach(function (line) {
              line = line.trim();
              if (!line) return;
              try { applyEvent(JSON.parse(line)); } catch (e) {}
            });
            return pump();
          });
        }
        return pump();
      }).catch(function (e) {
        if (e.name === "AbortError") return;
        setStatus("连不上：" + e.message + "（先运行 relay_cors_proxy.py）", true);
      });
    }

    if (toggle) toggle.addEventListener("click", connect);
    if ($("relayShow")) $("relayShow").addEventListener("click", function () { box.hidden = false; });
    if ($("relayStop")) $("relayStop").addEventListener("click", function () {
      if (abort) abort.abort();
      window.__relayMode = false;
      setStatus("已断开");
    });
    if ($("relayClose")) $("relayClose").addEventListener("click", function () { box.hidden = true; });
  }

  // 截图识别（可选）：调用用户自己的视觉模型接口，把截图读成数值
  function initOcr() {
    var modal = $("ocrModal");
    if (!modal || modal.getAttribute("data-ready") === "1") return;
    modal.setAttribute("data-ready", "1");
    var KEY = "luoke-ocr-cfg";
    try {
      var cfg = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (cfg.endpoint) $("ocrEndpoint").value = cfg.endpoint;
      if (cfg.model) $("ocrModel").value = cfg.model;
      if (cfg.key) $("ocrKey").value = cfg.key;
    } catch (e) {}
    $("ocrClose").addEventListener("click", function () { modal.hidden = true; });
    if ($("ocrOpen")) $("ocrOpen").addEventListener("click", function () { modal.hidden = false; });

    function msg(t, bad) {
      var m = $("ocrMsg");
      if (m) { m.textContent = t; m.style.color = bad ? "#c9503c" : ""; }
    }

    function parseJsonFrom(txt) {
      var m = /\{[\s\S]*\}/.exec(String(txt || ""));
      if (!m) return null;
      try { return JSON.parse(m[0]); } catch (e) { return null; }
    }

    function runOneOcr(file, cfg) {
      return new Promise(function (resolve) {
        var rd = new FileReader();
        rd.onload = function () {
          var b64 = String(rd.result).split(",")[1];
          var prompt = "这是《洛克王国：世界》对战截图。请只输出 JSON，不要解释：" +
            "{\"mine\":{\"hp\":数字,\"maxHp\":数字,\"energy\":数字,\"moves\":[技能名数组]},\"foe\":{同上}}";
          fetch(cfg.ep, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
            body: JSON.stringify({
              model: cfg.model,
              messages: [{ role: "user", content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: "data:image/png;base64," + b64 } }
              ] }],
              temperature: 0
            })
          }).then(function (r) { return r.json(); }).then(function (j) {
            var txt = (((j.choices || [])[0] || {}).message || {}).content || "";
            var data = parseJsonFrom(txt);
            if (!data) return resolve({ ok: false, msg: "无 JSON" });
            try { applyOcr(data); } catch (e) {}
            resolve({ ok: true, data: data });
          }).catch(function (e) { resolve({ ok: false, msg: e.message }); });
        };
        rd.onerror = function () { resolve({ ok: false, msg: "读取失败" }); };
        rd.readAsDataURL(file);
      });
    }

    $("ocrRun").addEventListener("click", function () {
      var files = Array.prototype.slice.call(($("ocrFile").files || []));
      var ep = ($("ocrEndpoint").value || "").trim();
      var model = ($("ocrModel").value || "").trim();
      var key = ($("ocrKey").value || "").trim();
      if (!files.length) return msg("先选截图（可多选）", true);
      if (!ep || !model) return msg("填接口地址和模型名", true);
      try { localStorage.setItem(KEY, JSON.stringify({ endpoint: ep, model: model, key: key })); } catch (e) {}
      var cfg = { ep: ep, model: model, key: key };
      var prog = $("ocrProgress");
      var lines = [], okCount = 0, failCount = 0;
      msg("批量识别中… 0/" + files.length);
      (function next(i) {
        if (i >= files.length) {
          msg("完成：成功 " + okCount + " 张，失败 " + failCount + " 张");
          return;
        }
        var f = files[i];
        msg("批量识别中… " + (i + 1) + "/" + files.length);
        runOneOcr(f, cfg).then(function (res) {
          if (res.ok) {
            okCount++;
            var m1 = res.data.mine || {}, f1 = res.data.foe || {};
            lines.push("✅ " + f.name + "：我 " + (m1.hp ?? "?") + " / 敌 " + (f1.hp ?? "?"));
          } else {
            failCount++;
            lines.push("❌ " + f.name + "：" + (res.msg || "失败"));
          }
          if (prog) prog.textContent = lines.join("\n");
          next(i + 1);
        });
      })(0);
    });

    function applyOcr(d) {
      ["mine", "foe"].forEach(function (side) {
        var x = d[side] || {};
        if (Number.isFinite(Number(x.hp))) state[side].hp = Number(x.hp);
        if (Number.isFinite(Number(x.energy))) state[side].energy = Number(x.energy);
        if (Array.isArray(x.moves) && x.moves.length) {
          x.moves.slice(0, 4).forEach(function (n, i) {
            if (skillByName(n)) state[side].moves[i] = n;
          });
        }
      });
      save(); buildMoves("mine"); buildMoves("foe"); fillMoveSelects(); renderAll();
    }
  }

  // 手机录入模式：全屏大按钮，点招即选，记录一步到位
  function buildMobileHud() {
    if (document.getElementById("mhud")) return;
    var wrap = document.createElement("div");
    wrap.id = "mhud";
    wrap.className = "mhud";
    wrap.innerHTML =
      "<div class='mhud-top'><b id='mhudTurn'>第 1 回合</b><span id='mhudStat'></span><button type='button' id='mhudOneTap' class='on'>一键：开</button><button type='button' id='mhudExit'>退出</button></div>" +
      "<div class='mhud-sec'><em>我方</em><div class='mhud-grid' id='mhudMineMoves'></div>" +
      "<div class='mhud-acts' id='mhudMineActs'></div></div>" +
      "<div class='mhud-sec'><em>对手</em><div class='mhud-grid' id='mhudFoeMoves'></div>" +
      "<div class='mhud-acts' id='mhudFoeActs'></div></div>" +
      "<div class='mhud-chips' id='mhudChips'></div><div class='mhud-note' id='mhudNote'></div><div class='mhud-foot'><button type='button' id='mhudRecord'>记录本回合</button><button type='button' id='mhudUndo'>撤销</button>" +
      "<button type='button' id='mhudRepeat'>重复上回合</button></div>";
    document.body.appendChild(wrap);

    function act(side, a) {
      var el = side === "mine" ? $("meAction") : $("foeActionRec");
      if (el) { el.value = a; el.dispatchEvent(new Event("change")); }
      paint();
    }
    var oneTap = true;
    function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
    function record() {
      $("recordTurn").click();
      buzz(12);
      paint();
      var n = $("mhudNote");
      if (n) n.textContent = "已记录第 " + state.history.length + " 回合";
    }
    function pick(side, name) {
      var el = side === "mine" ? $("meMoveSel") : $("foeMoveSel");
      if (el) { el.value = name; el.dispatchEvent(new Event("change")); }
      act(side, "attack");
      if (oneTap && side === "mine") record();
    }
    function paint() {
      ["mine", "foe"].forEach(function (side) {
        var g = $("mhud" + (side === "mine" ? "Mine" : "Foe") + "Moves");
        if (!g) return;
        g.innerHTML = (state[side].moves || []).map(function (n) {
          var k = n ? skillByName(n) : null;
          return "<button type='button' data-pick='" + side + "|" + (k ? k.n : "") + "'" +
            (k ? "" : " disabled") + ">" + (k ? k.n : "空") + "</button>";
        }).join("");
        var a = $("mhud" + (side === "mine" ? "Mine" : "Foe") + "Acts");
        a.innerHTML = [["charge", "聚能"], ["switch", "换人"], ["counter", "应对"]].map(function (x) {
          return "<button type='button' data-act='" + side + "|" + x[0] + "'>" + x[1] + "</button>";
        }).join("");
      });
      Array.prototype.forEach.call(wrap.querySelectorAll("[data-pick]"), function (b) {
        var timer = null, longFired = false;
        b.addEventListener("pointerdown", function () {
          longFired = false;
          timer = setTimeout(function () {
            longFired = true;
            var parts = b.getAttribute("data-pick").split("|");
            if (parts[1]) {
              var el = parts[0] === "mine" ? $("meMoveSel") : $("foeMoveSel");
              if (el) { el.value = parts[1]; el.dispatchEvent(new Event("change")); }
              act(parts[0], "counter");
              buzz(8);
              var n = $("mhudNote");
              if (n) n.textContent = "应对：" + parts[1];
            }
          }, 480);
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach(function (evt) {
          b.addEventListener(evt, function () { if (timer) { clearTimeout(timer); timer = null; } });
        });
        b.addEventListener("click", function () {
          if (longFired) { longFired = false; return; }
          var parts = b.getAttribute("data-pick").split("|");
          if (parts[1]) pick(parts[0], parts[1]);
        });
      });
      Array.prototype.forEach.call(wrap.querySelectorAll("[data-act]"), function (b) {
        b.addEventListener("click", function () {
          var parts = b.getAttribute("data-act").split("|");
          act(parts[0], parts[1]);
        });
      });
      var chips = $("mhudChips");
      if (chips) {
        var last = state.history.slice(-5);
        chips.innerHTML = last.map(function (h) {
          return "<button type='button' data-jump='" + h.turn + "'>第" + h.turn + "回合</button>";
        }).join("");
        Array.prototype.forEach.call(chips.querySelectorAll("[data-jump]"), function (b) {
          b.addEventListener("click", function () {
            var t2 = Number(b.getAttribute("data-jump"));
            var h2 = state.history.filter(function (x) { return x.turn === t2; })[0];
            if (!h2) return;
            state.history = state.history.filter(function (x) { return x.turn <= t2; });
            state.mine.hp = h2.mineHp; state.foe.hp = h2.foeHp;
            state.mine.energy = h2.mineEnergy; state.foe.energy = h2.foeEnergy;
            if (h2.mineMana !== undefined) state.mine.mana = h2.mineMana;
            if (h2.foeMana !== undefined) state.foe.mana = h2.foeMana;
            save(); renderAll(); paint(); buzz(10);
            var n2 = $("mhudNote");
            if (n2) n2.textContent = "已回到第 " + t2 + " 回合结束";
          });
        });
      }
      var t = $("mhudTurn");
      if (t) t.textContent = "第 " + (state.history.length + 1) + " 回合";
      var st0 = $("mhudStat");
      if (st0 && !st0.getAttribute("data-dbl")) {
        st0.setAttribute("data-dbl", "1");
        var lastTap = 0;
        st0.addEventListener("click", function () {
          var now = Date.now();
          if (now - lastTap < 320) { if ($("undoTurn")) $("undoTurn").click(); paint(); buzz(15); }
          lastTap = now;
        });
      }
      var st = $("mhudStat");
      if (st) {
        var mine = sideStats("mine"), foe = sideStats("foe");
        st.textContent = "我 " + state.mine.hp + "/" + mine.stats.hp + " ⚡" + state.mine.energy +
          "　敌 " + state.foe.hp + "/" + foe.stats.hp + " ⚡" + state.foe.energy;
      }
    }
    $("mhudRecord").addEventListener("click", record);
    $("mhudOneTap").addEventListener("click", function () {
      oneTap = !oneTap;
      $("mhudOneTap").textContent = "一键：" + (oneTap ? "开" : "关");
      $("mhudOneTap").className = oneTap ? "on" : "";
    });
    $("mhudRepeat").addEventListener("click", function () {
      var h = state.history[state.history.length - 1];
      if (!h) return;
      ["mine", "foe"].forEach(function (side) {
        var a = side === "mine" ? h.meAct : h.foeAct;
        var mv = side === "mine" ? h.meMove : h.foeMove;
        var actEl = side === "mine" ? $("meAction") : $("foeActionRec");
        var mvEl = side === "mine" ? $("meMoveSel") : $("foeMoveSel");
        if (actEl && a) { actEl.value = a; actEl.dispatchEvent(new Event("change")); }
        if (mvEl && mv) { mvEl.value = mv; mvEl.dispatchEvent(new Event("change")); }
      });
      record();
    });
    $("mhudUndo").addEventListener("click", function () { if ($("undoTurn")) $("undoTurn").click(); paint(); });
    $("mhudExit").addEventListener("click", function () {
      wrap.remove();
      document.body.classList.remove("hud-mode");
      if (history.replaceState) history.replaceState(null, "", location.pathname);
    });
    window.__paintHud = paint;
    paint();
  }

  // 小窗（HUD）模式：?hud=1 时只留对战区
  function runHudMode() {
    if (!/[?&]hud=1/.test(location.search)) return;
    document.body.classList.add("hud-mode");
    setTimeout(function () {
      var pnl = $("miniPanel"), tg = $("miniToggle");
      if (pnl) pnl.hidden = false;
      if (tg) tg.style.display = "none";
      var hud = $("hudToggle"); if (hud) hud.style.display = "none";
      if (typeof initMiniPanel === "function") initMiniPanel();
      if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 520) buildMobileHud();
      else buildMobileHud();
    }, 60);
  }

  // 面板同步：跨窗口用 BroadcastChannel
  function watchHudPick() {
    window.addEventListener("storage", function (ev) {
      if (ev.key === "roco.battleHud.pick.my" && ev.newValue) readHudPick(true);
    });
  }

  function bindSync() {
    if (!window.BroadcastChannel) return;
    try {
      var ch = new BroadcastChannel("luoke-pvp");
      ch.onmessage = function (ev) {
        if (!ev.data || ev.data.type !== "state") return;
        try { state = ev.data.state; renderAll(); } catch (e) {}
      };
      window.__bc = ch;
    } catch (e) {}
  }

  // 悬浮录入面板：4 个招式按钮 + 聚能/换人/应对 + 记录/撤销
  function initMiniPanel() {
    var panel = $("miniPanel"), toggle = $("miniToggle");
    if (!panel || !toggle) return;
    if (panel.getAttribute("data-ready") === "1") return;
    panel.setAttribute("data-ready", "1");

    function open(on) {
      panel.hidden = !on;
      toggle.textContent = on ? "收起" : "悬浮";
      if (on) renderMini();
    }
    toggle.addEventListener("click", function () { open(panel.hidden); });
    var hudBtn = $("hudToggle");
    if (hudBtn) hudBtn.addEventListener("click", function () {
      var w = window.open("calculator.html?hud=1", "luokeHud", "width=380,height=760,menubar=no,toolbar=no");
      if (w) w.focus();
    });
    if ($("miniClose")) $("miniClose").addEventListener("click", function () { open(false); });

    function setAction(a) {
      if ($("meAction")) { $("meAction").value = a; $("meAction").dispatchEvent(new Event("change")); }
      renderMini();
    }

    function renderMini() {
      var box = $("miniMoves");
      if (!box) return;
      box.innerHTML = (state.mine.moves || []).map(function (n, i) {
        var sk = n ? skillByName(n) : null;
        var label = sk ? sk.n : "空" + (i + 1);
        return "<button type='button' class='mini-btn' data-mini-move='" + (sk ? sk.n : "") + "'>" + (i + 1) + ". " + label + "</button>";
      }).join("");
      Array.prototype.forEach.call(box.querySelectorAll("[data-mini-move]"), function (b) {
        b.addEventListener("click", function () {
          var nm = b.getAttribute("data-mini-move");
          if (!nm) return;
          if ($("meMoveSel")) { $("meMoveSel").value = nm; $("meMoveSel").dispatchEvent(new Event("change")); }
          setAction("attack");
          var note = $("miniNote");
          if (note) note.textContent = "已选：" + nm + "（按记录）";
        });
      });
      var note = $("miniNote");
      if (note && !note.textContent) note.textContent = "选招 → 记录；快捷键 1-4 / C 聚能 / S 换人 / R 应对 / Enter 记录";
    }

    Array.prototype.forEach.call(panel.querySelectorAll("[data-mini]"), function (b) {
      b.addEventListener("click", function () { setAction(b.getAttribute("data-mini")); });
    });
    if ($("miniRecord")) $("miniRecord").addEventListener("click", function () {
      $("recordTurn").click();
      var note = $("miniNote");
      if (note) note.textContent = "第 " + (state.history.length) + " 回合已记录";
    });
    if ($("miniUndo")) $("miniUndo").addEventListener("click", function () { if ($("undoTurn")) $("undoTurn").click(); });

    // 拖动
    var drag = $("miniDrag"), sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    drag.addEventListener("pointerdown", function (e) {
      dragging = true; sx = e.clientX; sy = e.clientY;
      var r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      panel.style.right = "auto"; panel.style.bottom = "auto"; panel.style.left = ox + "px"; panel.style.top = oy + "px";
      drag.setPointerCapture(e.pointerId);
    });
    drag.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      panel.style.left = Math.max(4, ox + e.clientX - sx) + "px";
      panel.style.top = Math.max(4, oy + e.clientY - sy) + "px";
    });
    drag.addEventListener("pointerup", function () { dragging = false; });

    // 快捷键
    document.addEventListener("keydown", function (e) {
      var t = e.target || {};
      if (/INPUT|SELECT|TEXTAREA/.test(t.tagName || "")) return;
      var k = e.key.toLowerCase();
      if (k === "f") { open(panel.hidden); return; }
      if (panel.hidden) return;
      if (/^[1-4]$/.test(k)) {
        var nm2 = (state.mine.moves || [])[Number(k) - 1];
        if (nm2) { if ($("meMoveSel")) { $("meMoveSel").value = nm2; $("meMoveSel").dispatchEvent(new Event("change")); } setAction("attack"); }
        return;
      }
      if (k === "c") return setAction("charge");
      if (k === "s") return setAction("switch");
      if (k === "r") return setAction("counter");
      if (k === "enter") { $("recordTurn").click(); e.preventDefault(); }
      if (k === "backspace") { if ($("undoTurn")) $("undoTurn").click(); e.preventDefault(); }
    });

    window.__renderMini = renderMini;
  }

  // 标签切换
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (tab) {
    tab.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { t.classList.remove("on"); });
      Array.prototype.forEach.call(document.querySelectorAll(".view"), function (v) { v.classList.remove("on"); });
      tab.classList.add("on");
      $("view-" + tab.getAttribute("data-view")).classList.add("on");
      renderAll();
    });
  });

  // 技能候选
  var dl = document.createElement("datalist");
  dl.id = "skillList";
  SKILLS.forEach(function (sk) {
    var o = document.createElement("option");
    o.value = sk.n;
    dl.appendChild(o);
  });
  Object.keys(CUSTOM_SEED).forEach(function (n) {
    if (SKILLS.some(function (x) { return x.n === n; })) return;
    var o = document.createElement("option");
    o.value = n;
    dl.appendChild(o);
  });
  document.body.appendChild(dl);

  ["mine", "foe"].forEach(function (side) {
    var m = state[side].moves || [];
    if (!m.some(Boolean)) state[side].moves = DEFAULT_MOVES[side].slice();
  });

  buildNatures();
  renderRoleLegend();
  renderAll();
  if (typeof runHudMode === "function") runHudMode();
  if (typeof bindSync === "function") bindSync();
  if (typeof watchHudPick === "function") watchHudPick();
  function bootPanels() {
    if (typeof initMiniPanel === "function") initMiniPanel();
    if (typeof initOcr === "function") initOcr();
    if (typeof initRelay === "function") initRelay();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPanels);
  else bootPanels();
})();
