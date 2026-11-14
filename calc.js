(function () {
  var PETS = (window.PETS || []).slice();
  // 补全数据（由 tools/scrape_pets.py 抓取），只补有六维的
  // 上游个别条目未汉化（爬到的名字是拼音），这里统一替换成规范中文名
  var NAME_FIX = {
    Quanzhang: "权杖-Ⅱ",
    Gedouxiaowu: "格斗小五",
    Gedouxiaoba: "格斗小宝",
    Chilunxiaozi: "齿轮小子"
  };
  if (Array.isArray(window.PETS_SUPPLEMENT)) {
    var have = {};
    PETS.forEach(function (x) { have[x.n] = 1; });
    window.PETS_SUPPLEMENT.forEach(function (x) {
      if (!x || !x.n) return;
      if (NAME_FIX[x.n]) x = Object.assign({}, x, { n: NAME_FIX[x.n] });
      if (have[x.n]) return;
      // 上游个别条目缺属性：用本地同名的属性补上（本地已有 450 条可比对，0 冲突）
      if (!x.el) {
        var local = null;
        for (var li = 0; li < PETS.length; li++) if (PETS[li].n === x.n) { local = PETS[li]; break; }
        if (local) { x = Object.assign({}, x, { el: local.el, el2: local.el2 || "" }); }
      }
      if (![x.hp, x.atk, x.ma, x.def, x.md, x.spe].every(function (v) { return typeof v === "number"; })) return;
      PETS.push({ n: x.n, num: x.num, hp: x.hp, atk: x.atk, ma: x.ma, def: x.def, md: x.md, spe: x.spe, el: x.el || "", el2: x.el2 || "", t: x.t || "", td: x.td || "", pre: x.pre || null, bs: x.bs || null, _supp: true });
      have[x.n] = 1;
    });
  }
  window.__S5_NAMES = {};
  // S5 精灵（bwiki 抓取）：单独一份，合并进主列表
  if (Array.isArray(window.PETS_S5)) {
    var haveS5 = {};
    PETS.forEach(function (x) { haveS5[x.n] = 1; });
    window.PETS_S5.forEach(function (x) {
      if (!x || !x.n || haveS5[x.n]) return;
      PETS.push(Object.assign({}, x, { _s5: true }));
      window.__S5_NAMES[x.n] = 1;
      haveS5[x.n] = 1;
    });
  }

  // bwiki 权威属性覆盖：补全数据只有主属性，这里用 bwiki 页面上的双属性纠正
  if (Array.isArray(window.PETS_WIKI) && window.PETS_WIKI.length) {
    var wikiBy = {};
    window.PETS_WIKI.forEach(function (x) { if (x && x.n) wikiBy[x.n] = x; });
    PETS.forEach(function (p) {
      var w = wikiBy[p.n];
      if (!w) {
        // 形态变体（X（…））用主形态的 bwiki 属性
        var base = String(p.n).replace(/[（(][^）)]*[）)]/g, "").trim();
        w = wikiBy[base];
      }
      if (!w) return;
      if (w.el) p.el = w.el;
      if (w.el2 !== undefined) p.el2 = w.el2 || "";
      if (!p.td && w.td) { p.td = w.td; if (!p.t) p.t = w.t; }
      p._wikiEl = true;   // 属性来自 bwiki，不再标"可能缺"
    });
  }

  // bwiki 图鉴索引里补出来的精灵（S5 等）
  if (Array.isArray(window.PETS_CODEX)) {
    var haveCx = {};
    PETS.forEach(function (x) { haveCx[x.n] = 1; });
    window.PETS_CODEX.forEach(function (x) {
      if (!x || !x.n || haveCx[x.n]) return;
      PETS.push(Object.assign({}, x, { _s5: true }));
      window.__S5_NAMES[x.n] = 1;
      haveCx[x.n] = 1;
    });
  }

  // 同名去重：源数据里同一只精灵有多条数值略有差异的记录，界面只需要一条
  (function dedupePets() {
    var seen = {}, out = [];
    PETS.forEach(function (x) {
      if (!x || !x.n) return;
      if (seen[x.n]) return;
      seen[x.n] = 1;
      out.push(x);
    });
    PETS.length = 0;
    Array.prototype.push.apply(PETS, out);
  })();

  // 有形态变体的精灵：去掉「主形态」那一条，只保留各形态（用户要求）
  // 例：板板壳 / 板板壳（本来的样子）→ 只留后者，图仍用主形态的（见上面的头像兜底）
  (function dropBaseForms() {
    var bases = {}, out = [];
    PETS.forEach(function (x) {
      var b = String(x.n).replace(/[（(][^）)]*[）)]/g, "").trim();
      if (b !== x.n) bases[b] = 1;
    });
    PETS.forEach(function (x) {
      var hasParen = /[（(]/.test(x.n);
      if (!hasParen && bases[x.n]) return;   // 主形态且有变体 → 丢弃
      out.push(x);
    });
    PETS.length = 0;
    Array.prototype.push.apply(PETS, out);
  })();

  window.__ALL_PETS = PETS;   // 合并/去重后的精灵列表（供自检与调试）
  var SKILLS = (window.SKILLS || []).slice();
  // S5 新技能
  if (Array.isArray(window.SKILLS_S5)) {
    var haveS5s = {};
    SKILLS.forEach(function (x) { haveS5s[x.n] = 1; });
    window.SKILLS_S5.forEach(function (x) {
      if (!x || !x.n || haveS5s[x.n]) return;
      SKILLS.push({ id: null, n: x.n, e: x.e || "普通", t: x.t || "状态", c: x.c || 0, p: x.p || null, r: 0, d: x.d || "" });
      haveS5s[x.n] = 1;
    });
    window.SKILLS = SKILLS;
  }

  // 补全技能（learnsets-supplement 里带的技能定义），按名字去重
  if (Array.isArray(window.SKILLS_SUPPLEMENT)) {
    var haveSk = {};
    SKILLS.forEach(function (x) { haveSk[x.n] = 1; });
    window.SKILLS_SUPPLEMENT.forEach(function (x) {
      if (!x || !x.n || haveSk[x.n]) return;
      SKILLS.push({ id: null, n: x.n, e: x.e || "普通", t: x.t || "状态", c: x.c || 0, p: x.p || null, r: 0, d: x.d || "" });
      haveSk[x.n] = 1;
    });
    window.SKILLS = SKILLS;
  }
  // 立绘打包模式：sprites/ 的 698 张图合成单文件后，用 dataURL 覆盖路径
  // （GitHub 网页上传一次最多 100 个文件，698 张图会传不完）
  // bundle 体积约 5MB 且用 defer 加载，可能晚于本文件，因此暴露成函数按需应用
  window.__applySpriteBundle = function () {
    if (!window.SPRITES || !window.SPRITES_BUNDLE) return 0;
    var n = 0;
    Object.keys(window.SPRITES_BUNDLE).forEach(function (k) {
      window.SPRITES[k] = window.SPRITES_BUNDLE[k];
      n++;
    });
    // 页面可能已经用旧路径（sprites/xxx.webp）渲染过，打包模式下这些文件不存在，
    // 统一把已渲染的 img 换成 dataURL，避免破图
    try {
      var imgs = document.querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) {
        var cur = String(imgs[i].getAttribute("src") || "");
        if (cur.indexOf("data:") === 0) continue;
        var m = cur.match(/sprites\/(.+?)(\.webp|\.png)?$/);
        if (!m) continue;
        var key = m[1];
        var val = window.SPRITES_BUNDLE[key] || window.SPRITES_BUNDLE[decodeURIComponent(key)];
        if (val) imgs[i].src = val;
      }
    } catch (e) {}
    return n;
  };
  // 若 bundle 已就绪（内联或已加载完）就立即应用
  if (window.SPRITES_BUNDLE) window.__applySpriteBundle();
  else window.addEventListener("load", function () { try { window.__applySpriteBundle(); } catch (e) {} });

  if (window.SPRITES && window.SPRITES_SUPPLEMENT) {
    // 以「实际存在的文件」为准：先收集真实文件名，再剔除指向不存在文件的旧映射（否则出现破图）
    var realFiles = {};
    Object.keys(window.SPRITES_SUPPLEMENT).forEach(function (n) {
      var path = window.SPRITES_SUPPLEMENT[n];
      realFiles[String(path).replace(/^sprites\//, "")] = 1;
      if (!window.SPRITES[n]) window.SPRITES[n] = path;
    });
    Object.keys(window.SPRITES).forEach(function (n) {
      var path = String(window.SPRITES[n] || "");
      // dataURL（立绘打包模式）不参与"文件是否存在"的校验
      if (path.indexOf("data:") === 0) return;
      var f = path.replace(/^sprites\//, "");
      if (!realFiles[f]) delete window.SPRITES[n];
    });
    // 变体名兜底：像「板板壳（本来的样子）」找不到自己的图，就用主形态的
    PETS.forEach(function (pet) {
      if (window.SPRITES[pet.n]) return;
      var base = String(pet.n).replace(/[（(][^）)]*[）)]/g, "").trim();
      if (base && window.SPRITES[base]) window.SPRITES[pet.n] = window.SPRITES[base];
    });
    // 补全精灵里带括号的形态，也按主形态兜底
    if (Array.isArray(window.PETS_SUPPLEMENT)) {
      window.PETS_SUPPLEMENT.forEach(function (x) {
        if (!x || !x.n || window.SPRITES[x.n]) return;
        var base = String(x.n).replace(/[（(][^）)]*[）)]/g, "").trim();
        if (base && window.SPRITES[base]) window.SPRITES[x.n] = window.SPRITES[base];
      });
    }
  }
  var NATURES = (window.NATURES || []).slice();
  var TYPES = window.TYPES || {};
  var $ = function (id) { return document.getElementById(id); };
  var byName = function (n) { return PETS.filter(function (p) { return p.n === n; })[0] || null; };
  /** 变体名兜底：去掉括号后用主形态；主形态也没有，就用任意同前缀形态 */
  function spriteFallback(name) {
    if (!name) return "";
    var S = window.SPRITES || {};
    if (S[name]) return S[name];
    var base = String(name).replace(/[（(][^）)]*[）)]/g, "").trim();
    if (base && S[base]) return S[base];
    if (base) {
      var keys = Object.keys(S);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf(base + "（") === 0 || keys[i].indexOf(base + "(") === 0) return S[keys[i]];
      }
    }
    return "";
  }
  window.__spriteFallback = spriteFallback;

  /** 立绘地址：中文文件名在 Android file:// 下必须编码，否则破图 */
  // 安卓 WebView 对中文文件名兼容差：把 webp 读成 dataURL 再显示
  var _spriteCache = {};
  var _isAndroid = /Android/i.test(navigator.userAgent || "");
  function spriteSrc(n) {
    var p = spriteFallback(n);
    if (!p) return "";
    if (String(p).indexOf("data:") === 0) return p;
    if (_isAndroid) {
      if (_spriteCache[n]) return _spriteCache[n];
      _spriteCache[n] = p;               // 先用原路径占位
      (function (key, path) {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", encodeURI(path), true);
          xhr.responseType = "blob";
          xhr.onload = function () {
            if (xhr.status !== 200 && xhr.status !== 0) return;
            try {
              var fr = new FileReader();
              fr.onload = function () {
                _spriteCache[key] = fr.result;   // dataURL
                // 立即替换页面上所有用到它的 img
                var list = document.querySelectorAll("img");
                for (var i = 0; i < list.length; i++) {
                  var cur = list[i].getAttribute("src") || "";
                  if (cur === encodeURI(path) || cur === fr.result) list[i].src = fr.result;
                }
              };
              fr.readAsDataURL(xhr.response);
            } catch (e) {}
          };
          xhr.send();
        } catch (e) {}
      })(n, p);
      return p;
    }
    try { return encodeURI(p); } catch (e) { return p; }
  }
  window.__spriteSrc = spriteSrc;
  var byId = function (id) { return SKILLS.filter(function (s) { return s.id === Number(id); })[0] || null; };

  // 数据里没有的技能：允许手填威力/属性/分类（bwiki 也查不到的先占位）
  var CUSTOM_SEED = { "愿力冲击": { n: "愿力冲击", p: 80, e: "普通", t: "物攻", c: 3, wish: true } };

  function customOf(name) {
    return (state.custom && state.custom[name]) || CUSTOM_SEED[name] || null;
  }
  function skillByName(name) {
    var base = SKILLS.filter(function (x) { return x.n === name; })[0] || CUSTOM_SEED[name] || null;
    var c = (state.custom && state.custom[name]) || null;
    if (!c) return base;
    if (base) {
      // 允许改已知技能：用自定义字段覆盖原数值，未填的沿用原值
      return Object.assign({}, base, c, {
        n: name,
        p: c.p !== undefined && c.p !== "" ? c.p : base.p,
        e: c.e || base.e,
        t: c.t || base.t,
        c: c.c !== undefined && c.c !== "" ? c.c : base.c
      });
    }
    return Object.assign({ n: name }, c);
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
    var out = { mult: 1, flat: 0, notes: [], skipped: [] };
    var handled = false;
    // 游戏的本质：20 选 1 的随机效果由 gamesEssence* 单独处理，不走通用数值解析
    if (pet && pet.t === "游戏的本质") return out;
    if (!d) return out;

    // “国王”的威严：能耗为 1 的技能威力 +50%
    if (/“国王”的威严/.test(d)) {
      if (sk && Number(sk.c) === 1) { out.mult *= 1.5; out.notes.push("国王的威严：能耗1 → 威力+50%"); }
      else out.skipped.push("需要能耗1的技能");
      return out;
    }
    // 烈冰钻：敌方总能耗每 1 点威力 +10%
    if (/敌方携带技能总能耗每有1点/.test(d)) {
      var foeCost = 0;
      ((state[other(side)] || {}).moves || []).forEach(function (nm) { var ks = skillByName(nm); if (ks) foeCost += Number(ks.c) || 0; });
      out.mult *= 1 + 0.1 * foeCost;
      out.notes.push("烈冰钻：敌方总能耗 " + foeCost + " → 威力+" + (10 * foeCost) + "%");
      if (foeCost > 15) out.notes.push("速度+75（面板）");
      return out;
    }
    // 圣龙的守护：每提升 1 级物攻 +5%
    if (/在战斗中每提升1级[^。]*?物攻+5%/.test(d)) {
      var lvGain = Math.max(0, (Number(state[side].level) || 60) - 60);
      if (lvGain) { out.mult *= 1 + 0.05 * lvGain; out.notes.push("圣龙的守护：等级+" + lvGain + " → 物攻+" + (5 * lvGain) + "%"); }
      else out.skipped.push("本场还未升级");
      if ((Number(state[side].level) || 60) < 80) out.notes.push("低于80级受伤+30%（近似）");
      return out;
    }
    // 结晶水：入场能量由 applyEntryTrait 处理，这里只标注
    if (/初始能量为0/.test(d)) { out.notes.push("结晶水：入场能量按己方冰系技能次数回复"); return out; }
    // 护犊：双防 +50% 由受击侧处理
    if (/队伍中存在被萌化的精灵时[^。]*?双防+50%/.test(d)) { out.notes.push("护犊：有萌化队友时双防+50%（受击侧生效）"); return out; }
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

    // 攻击技能迸发：固定威力 +N（电流刺激）
    if ((m = /携带的攻击技能获得迸发[：:]威力\+(\d+)/.exec(d))) {
      handled = true;
      if (sk && sk.p) { out.flat = (out.flat || 0) + Number(m[1]); out.notes.push("迸发威力+" + m[1]); }
    }
    // 每层萌化 → 连击 +N（自由飘）
    if ((m = /每有1层萌化[^。]*?连击数\+(\d+)/.exec(d))) {
      handled = true;
      var moe = 0;
      ((state.buffs && state.buffs[side]) || []).forEach(function (b) { if (b.n === "萌化") moe += Math.max(1, Number(b.st) || 1); });
      if (moe > 0) out.notes.push("萌化 " + moe + " 层 → 连击+" + (Number(m[1]) * moe));
    }

    // 按使用次数的累积类：蒸汽膨胀（每用1次火系 → 全技能威力+10）
    if ((m = /每使用1次([\u4e00-\u9fa5]+)系技能[^。]*?全技能威力\+(\d+)/.exec(d))) {
      handled = true;
      var uc = Number((((state[side] || {}).used || {}).el || {})[m[1]] || 0);
      if (uc > 0) { out.mult *= 1 + (Number(m[2]) / 100) * uc; out.notes.push(m[1] + "系已用 " + uc + " 次 → 威力+" + (Number(m[2]) * uc) + "%"); }
      else out.skipped.push("还没用过" + m[1] + "系技能");
    }
    // 拨浪鼓（每用1次状态技 → 毒/萌威力+10）
    if ((m = /每使用1次状态技能[^。]*?([\u4e00-\u9fa5])系和([\u4e00-\u9fa5])系技能威力\+(\d+)/.exec(d))) {
      handled = true;
      var uc2 = Number((((state[side] || {}).used || {}).cat || {})["状态"] || 0);
      if (uc2 > 0 && (sk.e === m[1] || sk.e === m[2])) {
        out.mult *= 1 + (Number(m[3]) / 100) * uc2;
        out.notes.push("状态技已用 " + uc2 + " 次 → 威力+" + (Number(m[3]) * uc2) + "%");
      } else out.skipped.push("条件不满足");
    }
    // 水翼飞升（每用1次水系 → 0费技能威力+30）
    if ((m = /每使用1次([\u4e00-\u9fa5]+)系技能[^。]*?能耗为0的技能威力\+(\d+)/.exec(d))) {
      handled = true;
      var uc3 = Number((((state[side] || {}).used || {}).el || {})[m[1]] || 0);
      if (uc3 > 0 && Number(sk.c) === 0) {
        out.mult *= 1 + (Number(m[2]) / 100) * uc3;
        out.notes.push("0 费技能 → 威力+" + (Number(m[2]) * uc3) + "%");
      } else out.skipped.push("0 费或没用水系");
    }
    // 侵蚀（敌方每有1层中毒 → 连击+1）
    if (/敌方每有1层中毒[^。]*?连击数\+1/.test(d)) {
      handled = true;
      var pz = 0;
      ((state.buffs && state.buffs[other(side)]) || []).forEach(function (b) { if (/中毒/.test(b.n)) pz += Math.max(1, Number(b.st) || 1); });
      if (pz > 0) out.notes.push("敌方中毒 " + pz + " 层 → 连击+" + pz);
      else out.skipped.push("敌方没中毒");
    }
    // 斗技（应对成功后全技能威力永久+30）——由 counterWin 分支处理，这里只标注
    if (/应对成功后[^。]*?全技能威力永久\+30/.test(d)) {
      handled = true;
      out.notes.push("斗技：应对成功已由事件结算");
    }

    // 冰雪魂魄：暴风雪天气下，敌方每层冻结 → 冰系威力 +10%
    if ((m = /天气为暴风雪时[^。]*?每有1层冻结[^。]*?威力\+(\d+)%/.exec(d))) {
      handled = true;
      if (state.weather === "snow" && sk.e === "冰") {
        var frz = 0;
        ((state.buffs && state.buffs[other(side)]) || []).forEach(function (b) { if (/冻结/.test(b.n)) frz += Math.max(1, Number(b.st) || 1); });
        if (frz > 0) { out.mult *= 1 + (Number(m[1]) / 100) * frz; out.notes.push("冰雪魂魄：敌方冻结 " + frz + " 层 → 威力+" + (Number(m[1]) * frz) + "%"); }
        else out.skipped.push("敌方没冻结");
      } else out.skipped.push("需要暴风雪且冰系");
    }
    // 流沙统治者：沙暴天气下速度 +50
    if ((m = /天气为沙暴时[^。]*?速度\+(\d+)/.exec(d))) {
      handled = true;
      if (state.weather === "sand") { addMod(side, "speed", Number(m[1])); out.notes.push("流沙统治者：速度+" + m[1]); }
      else out.skipped.push("需要沙暴");
    }

    // 力竭计数：悲悯（己方每有1只力竭）/ 悼亡（双方合计）
    if ((m = /队伍中每有1只力竭的精灵[^。]*?\+(\d+)%/.exec(d))) {
      handled = true;
      var own = Number(((state[side] || {}).faints) || 0);
      var both = own + Number(((state[other(side)] || {}).faints) || 0);
      var cnt2 = /双方队伍/.test(d) ? both : own;
      if (cnt2 > 0) { out.mult *= 1 + (Number(m[1]) / 100) * cnt2; out.notes.push("力竭 " + cnt2 + " 只 → +" + (Number(m[1]) * cnt2) + "%"); }
      else out.skipped.push("暂无力竭");
    }

    // 使用 X 系技能后 → 连击 +N（乘风连击）
    if ((m = /使用([\u4e00-\u9fa5])系技能后[^。]{0,20}?连击数\+(\d+)/.exec(d))) {
      handled = true;
      if (sk && sk.e === m[1]) {
        state[side].st = state[side].st || {};
        state[side].st.combo = (Number(state[side].st.combo) || 1) + Number(m[2]);
        out.notes.push("连击+" + m[2]);
      } else out.skipped.push("需要" + m[1] + "系技能");
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
      } else if (/地系技能威力/.test(d) && /星陨/.test(d)) {
        var st2 = 0;
        ((state.buffs && state.buffs[side === "mine" ? "foe" : "mine"]) || []).forEach(function (b) {
          if (b.n.indexOf("星陨") >= 0) st2 += Math.max(1, Number(b.st) || 1);
        });
        ok = sk.e === "地" && st2 > 0; why = "地系 + 星陨" + st2;
        if (ok) { out.mult *= 1 + (pct / 100) * st2; out.notes.push("观星：星陨" + st2 + " → 威力+" + (pct * st2) + "%"); ok = false; }
      } else if (/星陨印记/.test(d)) {
        var stacks = 0;
        ((state.buffs && state.buffs[side === "mine" ? "foe" : "mine"]) || []).forEach(function (b) {
          if (b.n.indexOf("星陨") >= 0) stacks += Math.max(1, Number(b.st) || 1);
        });
        ok = stacks > 0; why = "星陨 " + stacks + " 层";
        if (ok) out.mult *= 1 + pct / 100 * stacks, out.notes.push("星陨×" + stacks + " 威力+" + (pct * stacks) + "%"), ok = false;
      } else if ((m = /己方精灵每应对1次[^。]*?([\u4e00-\u9fa5])系(?:和([\u4e00-\u9fa5])系)?技能威力\+(\d+)%/.exec(d))) {
        var cnt = Number((state.counters || {}).counter) || 0;
        var els2 = [m[1], m[2]].filter(Boolean);
        ok = (els2.indexOf(sk.e) >= 0) && cnt > 0; why = els2.join("/") + "系，已应对 " + cnt + " 次";
        if (ok) {
          out.mult *= 1 + (Number(m[3]) / 100) * cnt;
          out.notes.push("身经百练：应对 " + cnt + " 次 → 威力+" + (Number(m[3]) * cnt) + "%");
          ok = false;
        }
      } else if (/敌方每有1层增益/.test(d)) {
        var foeBuffs = 0;
        ((state.buffs && state.buffs[side === "mine" ? "foe" : "mine"]) || []).forEach(function (b) {
          if (b.n && b.n.indexOf("印记") < 0) foeBuffs += Math.max(1, Number(b.st) || 1);
        });
        ok = foeBuffs > 0; why = "敌方增益 " + foeBuffs + " 层";
        if (ok) {
          out.mult *= 1 + (pct / 100) * foeBuffs;
          out.notes.push("变形活画：敌方增益 " + foeBuffs + " 层 → 威力+" + (pct * foeBuffs) + "%");
          addMod(side, "speed", 5 * foeBuffs);
          ok = false;
        }
      } else if (/敌方携带技能总能耗每有1点/.test(d)) {
        var sumCost = 0;
        (state.foe.moves || []).forEach(function (n) {
          var kk = n ? skillByName(n) : null;
          if (kk) sumCost += Number(kk.c) || 0;
        });
        ok = sumCost > 0;
        why = "敌方总耗能 " + sumCost;
        if (ok) { out.mult *= 1 + (pct / 100) * sumCost; out.notes.push("冰钻：敌方总耗能 " + sumCost + " → 威力+" + (pct * sumCost) + "%"); ok = false; }
      } else if (/使用非本系技能/.test(d)) {
        ok = !isStab(sk, pet); why = ok ? "非本系" : "本系不触发";
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
      var brief = String(d).replace(/^\s+/, "").slice(0, 24);
      if (/造成克制伤害|入场|离场|击败|力竭时|每次行动|每使用|蓄力|回合开始/.test(d)) {
        out.skipped.push("「" + brief + "…」需实战触发");
      } else {
        out.skipped.push("「" + brief + "…」条件无法自动判断");
      }
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

  // ===== 每格独立配招 =====
  // 6 只共用 state[side] 的"当前精灵"数据，切格子时只隔离招式与属性，
  // 血量/能量仍由 bench 管理（不在这里动，避免影响出招与换人逻辑）
  function saveSlotProfile(side) {
    var s = state[side];
    if (!s || s.active == null) return;
    s.slotProfiles = s.slotProfiles || {};
    s.slotProfiles[s.active] = {
      moves: (s.moves || []).slice(),
      nature: s.nature || ""
    };
  }

  function loadSlotProfile(side, idx) {
    var s = state[side];
    if (!s) return;
    s.slotProfiles = s.slotProfiles || {};
    var prof = s.slotProfiles[idx];
    if (prof) {
      s.moves = (prof.moves || ["", "", "", ""]).slice();
      s.nature = prof.nature || "";
      return;
    }
    // 第一次点到这只：用它自己的可学招式，别沿用上一只的
    s.moves = ["", "", "", ""];
    try { autofillMoves(side, true); } catch (e) {}
    saveSlotProfile(side);
  }

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

  var sidePet = function (side) {
    var p = byName(state[side].slots[state[side].active]) || PETS[0];
    // 特性描述可手动覆盖：所有 trait 计算都读 sidePet().td
    if (state[side].traitText !== undefined) {
      p = Object.assign({}, p, { td: String(state[side].traitText || "") });
    }
    // 副属性可手动指定：补全数据可能缺副属性，用户能覆盖
    var ov = state[side].el2Override;
    if (ov !== undefined && ov !== null) {
      if (ov === "" && !p.el2) return p;
      return Object.assign({}, p, { el2: ov || "" });
    }
    return p;
  };
  function sideStats(side) {
    var pet = sidePet(side), s = state[side];
    var nature = NATURES.filter(function (n) { return n.n === s.nature; })[0] || null;
    return { pet: pet, stats: computeStats(pet, { level: s.level, stars: s.star, iv: s.iv, nature: nature }) };
  }

  // 替补席：每个槽位独立的血量/能量（系统发育、正模标本、换人共用）
  function ensureBench(side) {
    var s = state[side], list = s.slots || [];
    var key = list.join("|") + "#" + s.level + "#" + s.star + "#" + JSON.stringify(s.iv) + "#" + s.nature;
    if (s.benchKey === key && Array.isArray(s.bench) && s.bench.length === list.length) return s.bench;
    var nature = NATURES.filter(function (n) { return n.n === s.nature; })[0] || null;
    s.bench = list.map(function (nm) {
      var p = byName(nm) || PETS[0];
      var st = computeStats(p, { level: s.level, stars: s.star, iv: s.iv, nature: nature });
      return { hp: st.hp, max: st.hp, energy: 0 };
    });
    if (s.bench[s.active]) {
      s.bench[s.active].hp = Math.min(s.hp, s.bench[s.active].max);
      s.bench[s.active].energy = Number(s.energy) || 0;
    }
    s.benchKey = key;
    return s.bench;
  }

  function saveBench(side) {
    var s = state[side];
    var bench = ensureBench(side);
    if (bench[s.active]) {
      bench[s.active].hp = Math.max(0, Math.min(s.hp, bench[s.active].max));
      bench[s.active].energy = Number(s.energy) || 0;
    }
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
    var benchS = ensureBench(side);
    state[side].slots.forEach(function (name, i) {
      var pet = byName(name);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "slot" + (i === state[side].active ? " on" : "");
      b.style.background = pet ? elColor(pet.el) + "22" : "#fff";
      var role = pet ? ROLE[roleOf(pet)] : null;
      var bst = benchS[i] || { hp: 0, max: 1, energy: 0 };
      var curHp = i === state[side].active ? state[side].hp : bst.hp;
      var pct = Math.max(0, Math.min(100, Math.round(Number(curHp) / Math.max(1, Number(bst.max)) * 100)));
      if (pet) b.title = pet.n + "｜" + (pet.t || "") + "｜" + (role ? role.label + "：" + role.desc : "") +
        "｜血量 " + curHp + "/" + bst.max + "（" + pct + "%）｜能量 " + (i === state[side].active ? state[side].energy : bst.energy);
      var img = pet && window.SPRITES && window.SPRITES[pet.n] ? "<img class='slot-img' src='" + spriteSrc(pet.n) + "' alt='' loading='lazy'>" : "";
      b.innerHTML = (role ? "<em class='slot-role " + role.cls + "'>" + role.label + "</em>" : "") +
        img + "<span>" + (name || "空") + "</span>" + (pet ? "<i class='dot' style='background:" + elColor(pet.el) + "'></i>" : "") +
        "<i class='slot-bar'><b style='width:" + pct + "%'></b></i>";
      b.addEventListener("click", function (ev) {
        if (ev.target && ev.target.classList && ev.target.classList.contains("slot-role") && pet) {
          var order = ["info", "tank", "sweep"];
          var cur = roleOf(pet);
          state.roles = state.roles || {};
          state.roles[pet.n] = order[(order.indexOf(cur) + 1) % 3];
          save(); renderAll();
          return;
        }
        var oldIdx = state[side].active;
        if (oldIdx !== i) {
          saveSlotProfile(side);       // 存下当前这只
          state[side].active = i;
          loadSlotProfile(side, i);    // 载入目标这只（没有就是空白）
          state[side].benchKey = null;
        }
        save(); renderAll();
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
    $(side + "Tags").innerHTML = "<span class='tag'>" + pet.el + "</span>" + (pet.el2 ? "<span class='tag'>" + pet.el2 + "</span>" : "") +
      (window.__S5_NAMES && window.__S5_NAMES[pet.n] ? "<span class='tag s5-badge' style='background:#e8d9ff;color:#5a3fa0'>S5</span>" : "");
    $(side + "Ele").textContent = pet.el + (pet.el2 ? " / " + pet.el2 : "") + "　·　" + ROLE[roleOf(pet)].label +
      (pet._supp && !pet._wikiEl ? "（补全数据，副属性可能缺）" : "");
    // 副属性手动指定（补全数据的精灵可能缺副属性）
    var el2Sel = $(side + "El2Sel");
    if (el2Sel) {
      var needIt = !!state[side].el2Override || !!state[side].slots.length;
      el2Sel.style.display = "inline-block";
      el2Sel.innerHTML = "<option value='__none'>副属性：自动</option>" +
        ["", "普通", "草", "火", "水", "光", "地", "冰", "龙", "电", "毒", "虫", "武", "翼", "萌", "幽", "恶", "机械", "幻"]
          .map(function (e) { return "<option value='" + e + "'>" + (e ? e : "无") + "</option>"; }).join("");
      el2Sel.value = state[side].el2Override === undefined ? "__none" : (state[side].el2Override || "");
      if (state[side].el2Override === undefined) el2Sel.value = "__none";
    }
    // 没有官方招式表时提示配招是推测的
    var guessNote = document.getElementById(side + "Moves");
    if (guessNote) {
      var oldNote = guessNote.parentElement.querySelector(".guess-note");
      if (oldNote) oldNote.remove();
      if (state[side].moveGuess) {
        var note = document.createElement("div");
        note.className = "guess-note";
        note.style.cssText = "font-size:11px;color:#8a6d00;margin:2px 0 4px";
        note.textContent = "⚠ 这只精灵没有官方招式表，下面四招是按属性挑的推测配招，可自行改";
        guessNote.parentElement.insertBefore(note, guessNote);
      }
    }
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
    var traitEl = $(side + "Trait");
    if (traitEl) traitEl.value = s.traitText !== undefined ? String(s.traitText || "") : (pet.td || "");
    $(side + "HpNote").textContent = s.hp + " / " + st.stats.hp;
    var bar = $(side + "HpBar");
    if (bar) bar.style.width = Math.min(100, s.hp / st.stats.hp * 100) + "%";
  }

  function learnsetOf(name) {
    var ls = (window.LEARNSETS || {})[name] || null;
    if (!ls && window.LEARNSETS_SUPPLEMENT) ls = window.LEARNSETS_SUPPLEMENT[name] || null;
    if (!ls && window.LEARNSETS_S5) ls = window.LEARNSETS_S5[name] || null;
    if (!ls && window.LEARNSETS_CODEX) ls = window.LEARNSETS_CODEX[name] || null;
    if (ls) return ls;
    var base = String(name || "").replace(/[（(][^）)]*[）)]/g, "").trim();
    var base2 = (window.LEARNSETS || {})[base];
    if (base2) return base2;
    return (window.LEARNSETS_SUPPLEMENT || {})[base] || null;
  }

  // 换精灵时：把空着的招式格用它的可学招式补上（优先攻击技能）
  // 没有招式表时的兜底：按属性挑 4 个最强本系攻击技（明确标注为推测，不是官方招式）
  function fallbackMoves(pet) {
    var els = [pet.el, pet.el2].filter(Boolean);
    var pool = SKILLS.filter(function (k) {
      return k.p && k.t !== "状态" && els.indexOf(k.e) >= 0;
    }).sort(function (a, b) { return (b.p || 0) - (a.p || 0); });
    var seen = {}, out = [];
    for (var i = 0; i < pool.length && out.length < 4; i++) {
      if (seen[pool[i].n]) continue;
      seen[pool[i].n] = 1;
      out.push(pool[i].n);
    }
    return out;
  }

  function autofillMoves(side, replaceInvalid) {
    var pet = sidePet(side);
    var ls = learnsetOf(pet.n);
    if (!ls || !ls.s || !ls.s.length) {
      var fb = fallbackMoves(pet);
      if (!fb.length) return 0;
      var mv = state[side].moves;
      // 没有官方招式表 → 四格全部换成按属性挑的推测招式（不是官方配招，UI 会标注）
      for (var fi = 0; fi < mv.length; fi++) mv[fi] = fb[fi % fb.length];
      state[side].moveGuess = true;
      save();
      return mv.length;
    }
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
      var isUnknown = !!sk && !SKILLS.some(function (x) { return x.n === sk.n; });
      var hasOverride = !!(name && state.custom && state.custom[name]);
      var isCustom = isUnknown || hasOverride;
      var row = document.createElement("div");
      row.className = "move-row" + (isCustom ? " custom" : "");
      row.innerHTML =
        "<i class='mdot' style='background:" + (sk && sk.e ? elColor(sk.e) : "#c9c3b6") + "'></i>" +
        "<div class='mname'><input class='mpick' readonly inputmode='none' placeholder='点此选择技能' value='" + (sk ? sk.n : "") + "'><button type='button' class='mclear' title='清空'>×</button>" +
          (name ? "<button type='button' class='medit' title='改数值'>" + (hasOverride ? "恢复" : "改") + "</button>" : "") +
          (i > 0 ? "<button type='button' class='mmove' data-move='" + side + ":" + i + ":-1' title='上移'>↑</button>" : "") +
          (i < state[side].moves.length - 1 ? "<button type='button' class='mmove' data-move='" + side + ":" + i + ":1' title='下移'>↓</button>" : "") +
          "</div>" +
        (isCustom
          ? "<input class='mpower edit' data-edit='" + side + ":" + i + ":p' value='" + (sk.p || "") + "' placeholder='威力'>" +
            "<input class='mtype edit' data-edit='" + side + ":" + i + ":e' value='" + (sk.e || "") + "' placeholder='属性'>" +
            "<input class='mcat edit' data-edit='" + side + ":" + i + ":t' value='" + (sk.t || "") + "' placeholder='分类'>" +
            "<input class='mcost edit' data-edit='" + side + ":" + i + ":c' value='" + (sk.c || "") + "' placeholder='耗能'>"
          : "<input class='mpower' readonly value='" + (sk && sk.p !== null ? sk.p : "—") + "'>" +
            "<input class='mtype' readonly value='" + (sk ? sk.e : "—") + "'>" +
            "<input class='mcat' readonly value='" + (sk ? sk.t : "—") + "'>" +
            "<span class='mtag" + (sk && sk.r ? " on" : "") + "'>" + (sk && sk.r ? "先手+" + sk.r : "耗能 " + (sk ? sk.c : "—")) + "</span>");
      box.appendChild(row);
      if (window.__bindSkillPickers) {
        Array.prototype.forEach.call(row.querySelectorAll("input.mpick"), window.__bindSkillPickers);
      }

      var editBtn = row.querySelector(".medit");
      if (editBtn) editBtn.addEventListener("click", function () {
        var nm = state[side].moves[i];
        if (!nm) return;
        if (state.custom && state.custom[nm]) {
          delete state.custom[nm];
          save(); buildMoves(side); fillMoveSelects(); renderBattle();
          return;
        }
        var cur = skillByName(nm) || {};
        var p = prompt("威力（留空=原值 " + (cur.p == null ? "—" : cur.p) + "）", cur.p == null ? "" : String(cur.p));
        if (p === null) return;
        var e = prompt("属性（如 火/水/普通）", cur.e || "普通");
        if (e === null) return;
        var cat = prompt("分类（物攻/魔攻/状态/防御）", cur.t || "物攻");
        if (cat === null) return;
        var cost = prompt("耗能", cur.c == null ? "3" : String(cur.c));
        if (cost === null) return;
        state.custom = state.custom || {};
        state.custom[nm] = {
          n: nm,
          p: p.trim() === "" ? (cur.p == null ? 0 : cur.p) : Number(p) || 0,
          e: (e || "").trim() || cur.e || "普通",
          t: (cat || "").trim() || cur.t || "物攻",
          c: cost.trim() === "" ? (cur.c == null ? 3 : cur.c) : Number(cost) || 0
        };
        save(); buildMoves(side); fillMoveSelects(); renderBattle();
      });

      var input = row.querySelector(".mname input");
      var applyMoveName = function () {
        var name2 = input.value.trim();
        state[side].moves[i] = name2;
        if (name2 && !SKILLS.some(function (x) { return x.n === name2; }) && !(state.custom && state.custom[name2])) {
          state.custom = state.custom || {};
          var seed = CUSTOM_SEED[name2];
          state.custom[name2] = seed ? Object.assign({}, seed, { n: name2 }) : { n: name2, p: 0, e: "普通", t: "物攻", c: 3 };
        }
        save(); buildMoves(side); fillMoveSelects(); renderBattle();
      };
      input.__skApply = applyMoveName;
      input.addEventListener("input", applyMoveName);
      input.addEventListener("change", applyMoveName);
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
    else if (v.kind === "heal") healSide(side, Math.round(st.stats.hp * v.v / 100));
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
  // 能量上限：默认 10，持有「多人宿舍」可突破
  function energyCap(side) {
    return /自己的能量可以超过能量上限/.test((sidePet(side).td || "")) ? 99 : 10;
  }

  function costOf(side, sk) {
    if (!sk) return 3;
    var base = Number(sk.c) || 0;
    var flat = Number((state[side] || {}).costFlat) || 0;
    var pend = Number(((state[side] || {}).pending || {}).cost) || 0;
    var byEl = (state[side] || {}).costByEl || {};
    var elMod = Number(byEl[sk.e]) || 0;
    var devCost = -2 * (Number((devotionOf(side) || {}).cost) || 0);
    if (sk.e === "草" && state[side].nextGrassCost) mkCost -= Number(state[side].nextGrassCost) || 0;
    var wCost = weatherCost(side, sk);
    var mkCost = markCombat(side, sk, false).cost;
    // 特性带来的固定能耗修正
    var ownPet = sidePet(side);
    var ownTd = (ownPet && ownPet.td) || "", mm2;
    if (ownPet) {
      if (/自己全技能能耗\+2/.test(ownTd)) mkCost += 2;                              // 留学生
      if (/进入战斗时获得全技能能耗\+2/.test(ownTd)) mkCost += 2;                     // 安眠
      if (/获得增益时[^。]*?全技能能耗-1/.test(ownTd) && (state[side].buffs || []).length) mkCost -= 1; // 王子的诺言
      // 特性能耗修正：携带的防御技能 / 特定类型
      if ((mm2 = /携带的防御技能能耗[-−](\d+)/.exec(ownTd)) && sk && sk.t === "防御") mkCost -= Number(mm2[1]);   // 缩壳
      if ((mm2 = /携带的能耗小于(\d+)的技能[^。]*?获得迅捷/.exec(ownTd)) && sk && Number(sk.c) < Number(mm2[1])) { /* 迅捷已在 prioOf 处理 */ }
      // 携带 N 个某系技能 → 某系技能使敌方中毒
      if ((mm2 = /每携带1个([\u4e00-\u9fa5])系技能[^。]*?([\u4e00-\u9fa5])系技能使敌方获得(\d+)层中毒/.exec(ownTd)) && sk && sk.e === mm2[2]) {
        var cntCarry = (state[side].moves || []).filter(function (nm3) { var k3 = nm3 ? skillByName(nm3) : null; return k3 && k3.e === mm2[1]; }).length;
        if (cntCarry > 0) state[side].poisonOnHit = (Number(state[side].poisonOnHit) || 0) + Number(mm2[3]) * cntCarry;
      }
    }
    // 冰封：对手在场时，我方全技能能耗 +1
    var opPet = sidePet(other(side));
    if (opPet && /在场时，敌方全技能能耗\+1/.test(opPet.td || "")) mkCost += 1;
    // 倾轧：携带的技能受能耗变化效果的影响翻倍（只翻倍“变化量”，基础能耗不变）
    // 基因编辑：自己携带技能的基础能耗变为上回合双方技能能耗之和
    if (/自己携带技能的基础能耗，变为上回合双方使用的技能能耗之和/.test(ownTd) && state[side].prevTurnCostSum != null) {
      base = Number(state[side].prevTurnCostSum) || 0;
    }
    var perSkillCost = Number(((state[side].skillCost || {})[sk && sk.n]) || 0);
    var costMods = flat + pend + elMod + devCost + mkCost + perSkillCost;
    if (/携带的技能受能耗变化效果的影响翻倍/.test(ownTd)) costMods *= 2;
    // 生物电：携带的电系技能获得迸发：能耗 -2
    if (/携带的电系技能获得迸发[：:]能耗[-−]2/.test(ownTd) && sk && sk.e === "电") costMods -= 2;
    // 盲拧：4 号位的技能能耗 -4（技能顺序打乱尚未建模）
    if ((mm2 = /4号位的技能能耗[-−](\d+)/.exec(ownTd)) && sk && (state[side].moves || [])[3] === sk.n) costMods -= Number(mm2[1]);
    // 盲从：非幻系技能能耗 -2
    if (/非幻系技能能耗[-−]2/.test(ownTd) && sk && sk.e !== "幻") costMods -= 2;
    // 聒噪：攻击技能能耗 +2
    if (Number(state[side].noisy) > 0 && sk && sk.p) costMods += 2;
    // 对流：能耗增加变降低、降低变增加
    if (/自己的能耗增加变为能耗降低/.test(ownTd)) costMods = -costMods;
    return Math.max(0, Math.round((base + costMods) * wCost));
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

  // 印记的战斗效果：按层数换算成威力百分比 / 固定威力 / 能耗
  function markCombat(side, sk, isFirst) {
    var out = { powPct: 0, powFlat: 0, cost: 0 };
    var list = state.buffs[side] || [];
    list.forEach(function (b) {
      var n = Number(b.st) || 1;
      if (b.n === "攻击印记") out.powPct += 10 * n;                 // 技能伤害威力+10%
      else if (b.n === "风起印记") { if (isFirst) out.powPct += 20 * n; } // 先手时 +20%
      else if (b.n === "蓄势印记") {                                    // 全攻击技能威力+30%、能耗+1
        if (sk && sk.p) out.powPct += 30 * n;
        out.cost += 1 * n;
      }
      else if (b.n === "蓄电印记") { if (sk && sk.p) out.powFlat += 10 * n; }  // 迸发：本次威力+10
      else if (b.n === "虫鸣印记") out.powFlat -= 5 * n;                 // 技能威力-5
      else if (b.n === "湿润印记") out.cost -= 1 * n;                    // 全技能能耗-1
    });
    return out;
  }

  // 星陨印记：非幻系攻击触发，消耗层数并追加幻系伤害（X²+24X−24，官方参考实现）
  function starfallExtra(side, sk, attacker, defender) {
    if (!sk || !sk.p || sk.e === "幻") return 0;
    var defSide = other(side);
    var list = state.buffs[defSide] || [];
    var b = list.filter(function (x) { return x.n === "星陨印记"; })[0];
    if (!b) return 0;
    var X = Math.max(1, Number(b.st) || 1);
    var power = X * X + 24 * X - 24;
    var stat = sk.t === "魔攻"
      ? (Number(attacker.stats.ma) / Math.max(1, Number(defender.stats.md)))
      : (Number(attacker.stats.atk) / Math.max(1, Number(defender.stats.def)));
    var cut = 1 - Math.min(90, Math.max(0, Number(state.cut) || 0)) / 100;
    var taken = 1 - Math.min(90, Math.max(0, Number((state[defSide].mods || {}).taken) || 0)) / 100;
    var dmg = Math.round(power * stat * DMG_CORE * cut * taken);
    var guard = /触发星陨印记时仅消耗一半层数/.test((defender.pet && defender.pet.td) || "");
    var consume = guard ? Math.ceil(X / 2) : X;
    b.st = X - consume;
    if (b.st <= 0) state.buffs[defSide] = list.filter(function (x) { return x !== b; });
    state.__lastStarfall = { side: defSide, stacks: X, dmg: dmg, guard: !!guard };
    return dmg;
  }

  function hitDamage(side, sk0, attacker, defender, slotIdx, applyStarfall) {
    var sk = effSkill(side, sk0, attacker);
    if (!sk || !sk.p) return 0;
    var tm = typeMult(sk.e, defender.pet);
    if (tm > 1) window.__se = true;
    var dev = devotionOf(side);
    var devAdd = 20 * (Number(dev.pow) || 0);
    // 换碟 / 魔术帽：自己携带的音波弹/音爆/金属噪音/午夜噪音 威力 +20
    var discTd = (sidePet("mine").td || "") + (sidePet("foe").td || "");
    var discAdd = /换碟|魔术帽/.test(discTd) && /^(音波弹|音爆|金属噪音|午夜噪音)$/.test(sk.n) ? 20 : 0;
    var burstP = burstAdd(attacker.pet, sk);
    var lingerP = Number(state[side].burstLingerPower) || 0;
    if (lingerP) state[side].burstLingerPower = 0;
    var addP = burstP + lingerP + discAdd + slotPowerBonus(sk, typeof slotIdx === "number" ? slotIdx : -1) + (Number(state[side].choicePower) || 0) + devAdd;
    if (addP) sk = Object.assign({}, sk, { p: sk.p + addP });
    var bt = buffTotals(side);
    var bTaken = buffTotals(side === "mine" ? "foe" : "mine");
    var choiceAdd = Number(state[side].choicePower) || 0;
    var pend = state[side].pending || null;
    var pendMul = pend && pend.power ? 1 + Number(pend.power) / 100 : 1;
    var myMods = state[side].mods || {};
    var oppMods = state[side === "mine" ? "foe" : "mine"].mods || {};
    var magic = sk.t === "魔攻";
    var atkMod = magic ? (Number(myMods.maMul) || 0) : (Number(myMods.atkMul) || 0);
    var defMod = magic ? (Number(oppMods.mdMul) || 0) : (Number(oppMods.defMul) || 0);
    var statMul = (1 + (Number(myMods.stat) || 0) / 100) * (1 + atkMod / 100);
    var oppStatMul = (1 + (Number(oppMods.stat) || 0) / 100) * (1 + defMod / 100);
    var buffPow = 1 + bt.pow / 100 + (Number(myMods.power) || 0) / 100;
    if (statMul < 0) statMul = 0;
    if (oppStatMul < 0) oppStatMul = 0;
    var buffDmg = 1 + bt.dmg / 100;
    var buffTaken = 1 - bTaken.taken / 100;
    var st = state[side].st || {};
    var wishHit = !!sk.wish && state.foeStatusSkill && side === "mine";
    var ti_flat = traitInfo(attacker.pet, sk, traitCtx(side), side).flat || 0;
    var traitTakenMul = (function () {
      var dpq = defender.pet, dpq2 = dpq;
      // 逐魂鸟：能耗 ≤1 的攻击技能无法对持有者造成伤害
      if (dpq2 && /能耗小于等于1的攻击技能[^。]*?无法对自己造成伤害/.test(dpq2.td || "") && Number(sk.c) <= 1) return 0;
      // 惊吓：能量为 0 的精灵，无法对该特性持有者造成伤害
      if (dpq && /能量等于?0的精灵，无法对自己造成伤害/.test(dpq.td || "")) {
        if ((Number(state[side].energy) || 0) <= 0) return 0;
      }
      var dp = defender.pet, dd = dp && dp.td ? dp.td : "";
      if (!dd) return 1;
      var mul = 1, mm0;
      // 偏振：受到自己携带技能系别的攻击伤害-N%
      if ((mm0 = /受到自己携带技能系别的攻击伤害[-−](\d+)%/.exec(dd))) {
        var dSide = side === "mine" ? "foe" : "mine";
        var carry = (state[dSide].moves || []).map(function (nm) { var k = nm ? skillByName(nm) : null; return k ? k.e : ""; });
        if (carry.indexOf(sk.e) >= 0) mul *= 1 - Number(mm0[1]) / 100;
      }
      // 完全偏振：抵抗自己携带技能系别的攻击伤害
      if (/抵抗自己携带技能系别的攻击伤害/.test(dd)) {
        var dSide2 = side === "mine" ? "foe" : "mine";
        var carry2 = (state[dSide2].moves || []).map(function (nm) { var k = nm ? skillByName(nm) : null; return k ? k.e : ""; });
        if (carry2.indexOf(sk.e) >= 0) mul *= 0;
      }
      // 绝对秩序：受到非敌方系别的技能攻击时伤害 -50%
      if (/受到非敌方系别的技能攻击时伤害[-−]50%/.test(dd)) {
        var atkPet = attacker.pet || {};
        if (!(sk.e === atkPet.el || sk.e === atkPet.el2)) mul *= 0.5;
      }
      // 护犊：队伍中有萌化时双防 +50% → 受到伤害 /1.5
      if (/队伍中存在被萌化的精灵时[^。]*?双防+50%/.test(dd) && teamHasMoe(other(side))) mul *= 1 / 1.5;
      // 恶龙的奢望：低于 80 级时受伤 +40%
      if (/低于80级时受到伤害+40%/.test(dd) && (Number(state[other(side)].level) || 60) < 80) mul *= 1.4;
      // 圣龙的心愿 / 圣龙的守护：低于 80 级时受伤 +30%
      if (/低于80级时受到伤害+30%/.test(dd) && (Number(state[other(side)].level) || 60) < 80) mul *= 1.3;
      return mul;
    })();
    var mk = markCombat(side, sk, !!state[side].firstThisTurn);
    var mkPow = 1 + mk.powPct / 100;
    var base = Math.round(sk.p * ((magic ? attacker.stats.ma : attacker.stats.atk) / (magic ? defender.stats.md : defender.stats.def))
      * tm * traitMult(attacker.pet, sk, traitCtx(side), side)
      * (1 - Math.min(90, Math.max(0, Number(state.cut) || 0)) / 100)
      * (1 + 0.1 * (Number(st.mark) || 0)) * (Number(st.charge) ? 1.3 : 1)
      * (function () {
        // 无差别过滤：场上任意一方持有 → 连击固定为 2
        var forceCombo = /无差别过滤/.test((sidePet("mine").td || "")) || /无差别过滤/.test((sidePet("foe").td || ""));
        if (forceCombo) return 2;
        var forceOne = /强制过滤/.test((sidePet("mine").td || "")) || /强制过滤/.test((sidePet("foe").td || ""));
        if (forceOne) return 1;
        return Math.max(1, (Number(st.combo) || 1) + (Number(myMods.combo) || 0)) + (/连击/.test(sk.d || "") ? (Number(dev.combo) || 0) : 0);
      })() * (Number(state.coef) || 0) * (wishHit ? 2.5 : 1)
      * buffPow * buffDmg * buffTaken * DMG_CORE * weatherMult(sk) * (isStab(sk, attacker.pet) ? STAB : 1)
      * statMul / oppStatMul * pendMul * Math.max(0, mkPow) * traitTakenMul + mk.powFlat + Number(ti_flat || 0));
    // 连续负荷：本次迸发威力延长到下一回合（近似）
    if (burstP > 0 && /自己技能的迸发效果延长1回合/.test((attacker.pet && attacker.pet.td) || "")) {
      state[side].burstLingerPower = burstP;
      state[side].burstLingerSkill = sk.n;
    }
    if (applyStarfall) base += starfallExtra(side, sk, attacker, defender);
    return base;
  }

  // 行动后果预览：能否击杀、打完后能量、风险
  // 对手策略推测：把候选手牌打分后给概率，明确标注“推测”
  // 权重来源：击杀 > 打残 > 能量可行 > 先手 > 保守（残血聚能/换人）
  function foeOptions() {
    var foe = sideStats("foe"), mine = sideStats("mine");
    var foeE = Number(state.foe.energy) || 0;
    var myHp = Number(state.mine.hp) || 0;
    var myMax = Math.max(1, mine.stats.hp);
    // 残血阈值只在真的低血时才算（避免把 40 当成 40%）
    var myLow = state.mine.hp / myMax < 0.25;
    var opts = [];

    (state.foe.moves || []).forEach(function (n) {
      var k = n ? skillByName(n) : null;
      if (!k) return;
      if (!k.p) { opts.push({ kind: "status", name: k.n, sk: k, cost: Number(k.c) || 0, dmg: 0 }); return; }
      opts.push({ kind: "attack", name: k.n, sk: k, cost: Number(k.c) || 0, dmg: hitDamage("foe", k, foe, mine) });
    });

    var avail = opts.filter(function (o) { return !(o.sk && state.foe.cooldown && Number(state.foe.cooldown[o.sk.n]) > 0); });
    var usable = avail.filter(function (o) { return o.cost <= foeE; });
    var scored = (usable.length ? usable : avail).map(function (o) {
      var s = 1;
      if (o.dmg >= myHp) s += 6;                                  // 能击杀
      else if (o.dmg >= myHp * 0.5) s += 3;                       // 打掉一半
      else if (o.dmg >= myHp * 0.25) s += 1.5;
      if (o.kind === "status") s += 0.6;                          // 状态技常用来挂印记
      s += Math.max(0, 2 - o.cost * 0.3);                         // 便宜招更容易出
      var reserve = foeE - o.cost;
      if (reserve <= 0 && foeE >= 3) s -= 0.8;                    // 出完就没能量，会谨慎
      return { o: o, s: s, score: o.dmg };
    });

    if (foeE < 3) {
      scored.push({ o: { kind: "charge", name: "聚能", cost: 0, dmg: 0 }, s: 4, score: 0 });
    }
    if (myLow) {
      scored.push({ o: { kind: "switch", name: "换人", cost: 0, dmg: 0 }, s: 1.2, score: 0 });
    }
    if (myLow) {
      // 我方残血时，能击杀的招式权重再加一档
      scored.forEach(function (x) { if (x.o.dmg >= myHp) x.s += 3; });
    }
    if (!scored.length) return [];

    var total = scored.reduce(function (n, x) { return n + x.s; }, 0) || 1;
    scored.forEach(function (x) { x.p = x.s / total; });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored;
  }

  function opponentLean(myHpLeft) {
    var list = foeOptions();
    if (!list.length) return "对手动作不明（没有可用的招式数据）";
    var top = list[0], alt = list[1];
    var pct = function (p) { return Math.round(p * 100) + "%"; };
    var desc = top.o.kind === "charge" ? "聚能（能量不足）"
      : top.o.kind === "switch" ? "换人"
      : top.o.kind === "status" ? "状态技「" + top.o.name + "」"
      : "「" + top.o.name + "」约 " + top.o.dmg;
    if (myHpLeft <= top.o.dmg) return "对手大概率反杀：" + desc + "（" + pct(top.p) + "）";
    var out = "对手最可能 " + desc + "（" + pct(top.p) + "）";
    if (alt) out += "，其次 " + (alt.o.kind === "attack" ? "「" + alt.o.name + "」" : alt.o.name) + "（" + pct(alt.p) + "）";
    return out;
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

    renderSummary();
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
  // 本局统计：总伤害、回合数、应对成功率、平均剩余能量
  function renderSummary() {
    var box = document.getElementById("matchSummary");
    if (!box) return;
    var hs = state.history || [];
    if (!hs.length) { box.textContent = ""; return; }
    var dmgToFoe = 0, dmgToMe = 0, counters = 0, counterWin = 0, eSum = 0;
    hs.forEach(function (h) {
      dmgToFoe += Number(h.dmgToFoe) || 0;
      dmgToMe += Number(h.dmgToMe) || 0;
      if (h.meAct === "counter") { counters++; if (h.counterMe) counterWin++; }
      eSum += Number(h.mineEnergy) || 0;
    });
    var parts = [
      "共 " + hs.length + " 回合",
      "总伤害 我 " + dmgToFoe + " / 敌 " + dmgToMe,
      "平均剩余能量 " + (eSum / hs.length).toFixed(1)
    ];
    if (counters) parts.push("应对 " + counterWin + "/" + counters + " 次成功");
    box.textContent = parts.join(" · ");
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
    renderActPreview(mine, foe);
  }

  // 动作后果预测：出招以外（聚能/换人/应对/道具）也给出会发生什么
  function renderActPreview(mine, foe) {
    var box = $("actPreview");
    if (!box) return;
    var act = ($("meAction") && $("meAction").value) || "attack";
    var foeAct = ($("foeActionRec") && $("foeActionRec").value) || "attack";
    var rows = [];
    var cap = energyCap("mine"), capF = energyCap("foe");
    var myE = Number(state.mine.energy) || 0, foeE = Number(state.foe.energy) || 0;
    var spdM = speedWithMarks("mine"), spdF = speedWithMarks("foe");

    if (act === "charge") {
      var afterE = Math.min(cap, myE + 5);
      var over = Math.max(0, myE + 5 - cap);
      rows.push("我方聚能：能量 " + myE + " → " + afterE + (over > 0 ? "（溢出 " + over + "，上限 " + cap + "）" : ""));
      var foeFirst = skillByName((state.foe.moves || []).filter(Boolean)[0] || "");
      if (foeFirst && foeFirst.p) {
        rows.push("代价：本回合不出招，若对手出「" + foeFirst.n + "」，会吃 " + hitDamage("foe", foeFirst, foe, mine, -1, false));
      } else {
        rows.push("代价：本回合不出招");
      }
    } else if (act === "switch") {
      var nxt = (state.mine.slots || [])[(Number(state.mine.active) + 1) % (state.mine.slots || [1]).length];
      var np = byName(nxt);
      var bench = ensureBench("mine");
      var bi = (Number(state.mine.active) + 1) % (state.mine.slots || [1]).length;
      var bh = bench[bi] ? bench[bi].hp : 0;
      rows.push("我方换人：换上 " + (nxt || "空") + "（生命 " + bh + (np ? " / " + computeStats(np, { level: state.mine.level, stars: state.mine.star, iv: state.mine.iv }).hp : "") + "）");
      rows.push("代价：本回合不出招；换上的精灵会触发入场特性");
      if (Number(state.lock && state.lock.mine) > 0) rows.push("⚠ 你现在被禁足 " + state.lock.mine + " 回合，换不了人");
    } else if (act === "counter") {
      var foeSk = skillByName(($("foeMoveSel") && $("foeMoveSel").value) || "");
      rows.push("我方应对：先手取决于招式，应对成功可打断对手");
      if (foeSk) {
        var ok = (foeAct === "attack" && foeSk.t === "状态") || foeAct === "counter" || foeAct === "attack";
        rows.push("对手本回合：" + (foeAct === "attack" ? "出招「" + foeSk.n + "」" : "非出招") + " → 应对" + (ok ? "有机会成功" : "大概率落空"));
      } else {
        rows.push("⚠ 没选对手招式，无法判断应对是否成立");
      }
    } else if (act === "item") {
      var evo = state.mine.itemUsed ? null : (function () { var p = sidePet("mine"); return p; })();
      rows.push("我方道具：进化之力" + (state.mine.itemUsed ? "（本场已用过）" : "（可用）"));
      rows.push("效果：进化一次，种族值提升；不消耗回合出招");
    } else {
      var mySk = skillByName(($("meMoveSel") && $("meMoveSel").value) || "");
      if (mySk && mySk.p) {
        var d = hitDamage("mine", mySk, mine, foe, -1, false);
        var cost = costOf("mine", mySk);
        var afford = myE >= cost;
        rows.push("我方出招：" + mySk.n + " 能耗 " + cost + (afford ? "" : "（能量不够，会改为聚能）") +
          "，打 " + d + (d > 0 ? "（" + Math.round(d / Math.max(1, foe.stats.hp) * 100) + "%）" : ""));
      }
    }

    if (foeAct === "charge") {
      rows.push("对手聚能：能量 " + foeE + " → " + Math.min(capF, foeE + 5) + "，本回合不出招");
    } else if (foeAct === "switch") {
      var fn = (state.foe.slots || [])[(Number(state.foe.active) + 1) % (state.foe.slots || [1]).length];
      rows.push("对手换人：换上 " + (fn || "空"));
    } else if (foeAct === "counter") {
      rows.push("对手应对：可能打断你的出招");
    } else if (foeAct === "item") {
      rows.push("对手道具：进化之力");
    } else {
      var fs = skillByName(($("foeMoveSel") && $("foeMoveSel").value) || "");
      if (fs && fs.p) {
        var df = hitDamage("foe", fs, foe, mine, -1, false);
        rows.push("对手出招：" + fs.n + "，打 " + df + (df >= state.mine.hp ? "（⚠ 可能倒下）" : ""));
      }
    }

    var ep = gamesEssencePoint();
    if (ep) {
      var em = gamesEssenceMeta(ep);
      rows.push("🎲 游戏的本质：第 " + ep + "/" + gamesEssenceMax() + " 点（" + em.attr + "）· " + em.note + (em.timing === "passive" ? "（常驻）" : em.timing === "after" ? "（行动后）" : "（回合结束）"));
    }

    var first = spdM >= spdF ? "我方先手" : "对手先手";
    if (state.weather === "dream") first = spdM <= spdF ? "我方先手（霞光梦境：慢的先动）" : "对手先手（霞光梦境）";
    rows.push("先后手：" + first + "（速度 " + spdM + " vs " + spdF + "）");

    // 对手策略推测（不是事实，按手牌与资源打分）
    var lean = foeOptions();
    if (lean.length) {
      var leanTxt = lean.slice(0, 3).map(function (x) {
        var nm = x.o.kind === "attack" ? "「" + x.o.name + "」" + x.o.dmg
          : x.o.kind === "status" ? "「" + x.o.name + "」"
          : x.o.name;
        return nm + " " + Math.round(x.p * 100) + "%";
      }).join(" ／ ");
      rows.push("🔍 对手推测（按手牌+能量+血量打分）：" + leanTxt);
    }

    box.innerHTML = rows.map(function (t) {
      var warn = /⚠/.test(t);
      return "<div class='act-row" + (warn ? " warn" : "") + "'>" + t + "</div>";
    }).join("");
  }

  function fillStates() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-state]"), function (el) {
      var side = el.getAttribute("data-state"), key = el.getAttribute("data-key");
      var v = state[side].st[key];
      el.value = v === undefined ? (key === "combo" ? 1 : 0) : v;
    });
  }

  function renderAll() {
    scheduleDuelSync();
    if (window.__syncWeather) window.__syncWeather();
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
  var coefBox = $("coef") && $("coef").parentElement;
  // 窄屏不显示长说明（会挤成竖排），改到 title 里
  if (coefBox && window.innerWidth >= 520) {
    var help = document.createElement("div");
    help.className = "coef-help";
    help.innerHTML = "系数：公式结果 × 系数 = 实际伤害。先用一次实测伤害校准。";
    coefBox.appendChild(help);
  } else if (coefBox) {
    coefBox.title = "系数：公式结果 × 系数 = 实际伤害";
  }
  var cal = document.createElement("div");
  cal.className = "coef-cal";
  cal.innerHTML = "<input id='realDmg' type='number' placeholder='实测伤害' style='width:96px'>" +
    "<button type='button' id='calBtn'>校准</button><span id='calMsg'></span>";
  if (coefBox) coefBox.appendChild(cal);
  if ($("calBtn")) $("calBtn").addEventListener("click", function () {
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
    var te = $(side + "Trait");
    if (te) {
      te.addEventListener("input", function () {
        state[side].traitText = te.value;
        save(); renderBattle();
      });
    }
    var tr = $(side + "TraitReset");
    if (tr) tr.addEventListener("click", function () {
      delete state[side].traitText;
      save(); renderCard(side); renderBattle();
    });
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
  function syncWeatherUI() {
    var el = $("weather");
    if (el && el.value !== (state.weather || "")) el.value = state.weather || "";
  }
  window.__syncWeather = syncWeatherUI;
  syncWeatherUI();
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
    var bench = ensureBench(side);
    saveBench(side);
    var next = (s.active + 1) % s.slots.length;
    // 跳过已经力竭的替补，除非全队都倒下了
    for (var k = 0; k < s.slots.length; k++) {
      var cand = (s.active + 1 + k) % s.slots.length;
      if (bench[cand] && Number(bench[cand].hp) > 0) { next = cand; break; }
    }
    if (next !== s.active) {
      saveSlotProfile(side);          // 存下换人前这只的配招
      s.active = next;
      loadSlotProfile(side, next);    // 载入换上这只的配招
    } else {
      s.active = next;
    }
    var b = bench[next] || {};
    var st = sideStats(side);
    s.hp = Number(b.hp) > 0 ? Math.min(st.stats.hp, Number(b.hp)) : st.stats.hp;
    if (Number(b.energy) > 0) s.energy = Math.min(energyCap(side), Number(b.energy));
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
    if (!out.energy && (m = d.match(/(?:回合末|每回合)[^。；]*?(?:获得|回复)(\d+)能量/))) out.energy = Number(m[1]);
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
      // 陨落：在场时双方回合结束时的效果都不会触发
      var suppressTick = /双方回合结束时的效果不会触发/.test((sidePet(side).td || "")) ||
                         /双方回合结束时的效果不会触发/.test((sidePet(other(side)).td || ""));
      if (suppressTick) {
        log.push((side === "mine" ? "我" : "敌") + " 陨落：回合末效果未触发");
        return;
      }
      var extraAll = /双方回合结束时的效果会额外触发1次/.test((sidePet(side).td || "")) ||
                     /双方回合结束时的效果会额外触发1次/.test((sidePet(other(side)).td || ""));
      var extraPoison = /双方回合结束时的中毒效果会额外触发1次/.test((sidePet(side).td || "")) ||
                        /双方回合结束时的中毒效果会额外触发1次/.test((sidePet(other(side)).td || ""));
      list.forEach(function (b) {
        if (isImmune(side, b.n)) return;
        var info = buffInfo(b.n);
        var tk = buffTick(info && info.d);
        var ch = buffChain(b.n);
        if (ch && ch.t != null && ch.t !== 7 && !tk.dot && !tk.heal) return;
        var st = Math.max(1, Number(b.st) || 1);
        if (tk.dot) {
          var times = 1 + (extraAll ? 1 : 0) + (extraPoison && b.n === "中毒" ? 1 : 0);
          var dmg = Math.max(1, Math.round(maxHp * tk.dot / 100 * st)) * times;
          state[side].hp = Math.max(0, state[side].hp - dmg);
          log.push((side === "mine" ? "我" : "敌") + " " + b.n + " -" + dmg);
          // 耐活王 / 仁心：敌方受到中毒 / 灼烧伤害时，自己回复等量生命
          var opSide = other(side), opPetD = sidePet(opSide).td || "";
          var healBack = 0, isMoon = false;
          if (b.n === "中毒" && /敌方受到中毒效果伤害时[^。]*?回复等量生命/.test(opPetD)) healBack = dmg;
          if (b.n === "中毒" && /敌方受到中毒效果伤害时[^。]*?每过量回复10%生命敌方获得1层中毒/.test(opPetD)) { healBack = dmg; isMoon = true; }
          if (b.n === "灼烧" && /敌方受到灼烧伤害时[^。]*?回复等量生命/.test(opPetD)) healBack = dmg;
          if (healBack > 0) {
            var opMax = sideStats(opSide).stats.hp;
            var opBefore = state[opSide].hp;
            healSide(opSide, healBack);
            log.push((opSide === "mine" ? "我" : "敌") + " 特性吸血 +" + healBack);
            // 月相：过量回复每 10% 最大生命 → 敌方（中毒来源方）+1 层中毒
            if (isMoon) {
              var overheal = Math.max(0, opBefore + healBack - opMax);
              var extraPz = Math.floor(overheal / Math.max(1, opMax) * 10);
              if (extraPz > 0) {
                addBuff(side, "中毒", extraPz);
                log.push((opSide === "mine" ? "我" : "敌") + " 月相：过量回复 → 敌方中毒+" + extraPz);
              }
            }
          }
        }
        if (tk.heal) {
          var heal = Math.max(1, Math.round(maxHp * tk.heal / 100 * st));
          healSide(side, heal);
          log.push((side === "mine" ? "我" : "敌") + " " + b.n + " +" + heal);
        }
        if (tk.energy) {
          gainEnergy(side, tk.energy * st, 10);
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

      // 特性「回合结束时」类效果：从描述里抠数值，挂到回合结算
      (function () {
        var d = (sidePet(side).td || "");
        var who = side === "mine" ? "我" : "敌";
        var mm;
        // 回复 N% 生命
        if ((mm = /回合结束时[^。]*?回复(\d+)%(?:的)?生命/.exec(d))) {
          var hv = Math.max(1, Math.round(maxHp * Number(mm[1]) / 100));
          healSide(side, hv);
          log.push(who + " 特性回血 +" + hv);
        }
        // 回复 N 能量
        if ((mm = /回合结束时[^。]*?回复(\d+)能量/.exec(d))) {
          gainEnergy(side, Number(mm[1]), 10);
          log.push(who + " 特性回能 +" + mm[1]);
        }
        // 偷取敌方 N 能量
        if ((mm = /回合结束时[^。]*?偷取敌方[^。]*?(\d+)能量/.exec(d))) {
          var op = other(side);
          var takeN = Math.min(Number(mm[1]), Number(state[op].energy) || 0);
          state[op].energy = Math.max(0, (Number(state[op].energy) || 0) - takeN);
          gainEnergy(side, takeN, 10);
          log.push(who + " 特性偷能 " + takeN);
        }
        // 敌方获得 N 层星陨印记
        if ((mm = /回合结束时[^。]*?敌方获得(\d+)层星陨印记/.exec(d))) {
          addBuff(other(side), "星陨印记", Number(mm[1]));
          log.push(who + " 特性给敌方星陨+" + mm[1]);
        }
        // 整点报时：累计耗能恰好 12 → 回满能量和生命
        if (/累计消耗的能量恰好为12/.test(d) && Number(state.energySpent) === 12) {
          state[side].energy = 10;
          state[side].hp = maxHp;
          state.energySpent = -999;   // 只触发一次
          log.push(who + " 整点报时：能量与生命回满");
        }
        // 敌方每 2 层中毒 → 1 层中毒印记（蚀刻）
        if (/敌方每2层中毒转化为1层中毒印记/.test(d)) {
          var fz2 = ((state.buffs[other(side)]) || []).filter(function (b2) { return b2.n === "中毒"; })[0];
          var ps = fz2 ? Math.max(1, Number(fz2.st) || 1) : 0;
          if (ps >= 2) {
            var conv = Math.floor(ps / 2);
            addBuff(other(side), "中毒印记", conv);
            log.push(who + " 蚀刻：中毒 " + ps + " 层 → 中毒印记 " + conv + " 层");
          }
        }
        // 偷取敌方 1 层印记（特殊清洁场景）
        if (/回合结束时偷取敌方1层印记/.test(d)) {
          var foB = state.buffs[other(side)] || [];
          var mark = foB.filter(function (b3) { return /印记/.test(b3.n); })[0];
          if (mark) { mark.st = Math.max(0, (Number(mark.st) || 1) - 1); if (!mark.st) state.buffs[other(side)] = foB.filter(function (b4) { return b4 !== mark; }); log.push(who + " 偷取敌方 1 层 " + mark.n); }
        }
        // 驱散敌方 1 层印记（扫拖一体）
        if (/回合结束时驱散敌方1层印记/.test(d)) {
          var foC = state.buffs[other(side)] || [];
          var mk2 = foC.filter(function (b5) { return /印记/.test(b5.n); })[0];
          if (mk2) { mk2.st = Math.max(0, (Number(mk2.st) || 1) - 1); if (!mk2.st) state.buffs[other(side)] = foC.filter(function (b6) { return b6 !== mk2; }); log.push(who + " 驱散敌方 1 层 " + mk2.n); }
        }
        // 警惕：回合末若自己能量为 0 则脱离
        if (/回合结束时[^。]*?若自己能量为0则脱离/.test(d) && (Number(state[side].energy) || 0) <= 0) {
          state[side].forceSwitch = 1;
          log.push(who + " 警惕：能量为 0，回合末脱离");
        }
        // 奔波命：使用防御技能后，回合末脱离
        if (/使用防御技能后[^。]*?回合结束时脱离/.test(d)) {
          var usedDef2 = side === "mine" ? (meSkillDone && meSkillDone.t === "防御") : (foeSkillDone && foeSkillDone.t === "防御");
          if (usedDef2) { state[side].forceSwitch = 1; log.push(who + " 奔波命：防御后脱离"); }
        }
        // 能量为 0 时回 N 能量（莫比乌斯等）
        if ((Number(state[side].energy) || 0) <= 0 && (mm = /回合结束时[^。]*?能量为0[^。]*?回复(\d+)能量/.exec(d))) {
          state[side].energy = Math.min(10, Number(mm[1]));
          log.push(who + " 特性空能回能 +" + mm[1]);
        }
      })();

      // 印记类结算：治疗 / 中毒 / 荆棘
      (function () {
        var list2 = state.buffs[side] || [];
        var heal = 0, dot = 0, thorn = 0;
        list2.forEach(function (b) {
          var n = Number(b.st) || 1;
          if (b.n === "治疗印记") heal += 5 * n;
          if (b.n === "中毒印记") dot += 3 * n;
          if (b.n === "荆棘印记") thorn += 5 * n;
        });
        if (heal > 0) {
          var hv = Math.max(1, Math.round(maxHp * heal / 100));
          healSide(side, hv);
          log.push((side === "mine" ? "我" : "敌") + " 治疗印记 +" + hv);
        }
        if (dot > 0) {
          var dv = Math.max(1, Math.round(maxHp * dot / 100));
          state[side].hp = Math.max(0, state[side].hp - dv);
          log.push((side === "mine" ? "我" : "敌") + " 中毒印记 -" + dv);
        }
        if (thorn > 0) {
          var tv = Math.max(1, Math.round(maxHp * thorn / 100));
          state[side].hp = Math.max(0, state[side].hp - tv);
          var op = side === "mine" ? "foe" : "mine";
          var omax = (op === "mine" ? mine : foe).stats.hp;
          healSide(op, tv);
          log.push((side === "mine" ? "我" : "敌") + " 荆棘印记 -" + tv + "（敌方回 " + tv + "）");
        }
      })();

      // 暴风雪：非冰系精灵每回合 +1 层冻结（用独立计数器，避免与手挂 buff 冲突）
      state.freeze = state.freeze || { mine: 0, foe: 0 };
      if (state.weather === "snow") {
        var pm = sideStats(side).pet;
        var isIce = pm.el === "冰" || pm.el2 === "冰";
        var arcHolder = /环天顶弧/.test(sidePet(other(side)).td || "");
        if (!isIce) {
          if (arcHolder) {
            addBuff(side, "星陨印记", 3);
            log.push((side === "mine" ? "我" : "敌") + " 环天顶弧：暴风雪冻结 → 星陨印记+3");
          } else {
            state.freeze[side] = (Number(state.freeze[side]) || 0) + 1;
            log.push((side === "mine" ? "我" : "敌") + " 暴风雪：冻结 " + state.freeze[side] + " 层");
          }
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

      // 星地善良：回合结束若场上己方精灵能量为 0，立即换上持有者
      (function () {
        var s = state[side];
        if ((Number(s.energy) || 0) > 0) return;
        var idx = -1;
        (s.slots || []).forEach(function (nm, i) {
          if (i === s.active) return;
          var q = PETS.filter(function (x) { return x.n === nm; })[0];
          if (q && /回合结束时，若场上的己方精灵能量等于0，自己立即替换此精灵/.test(q.td || "")) idx = i;
        });
        if (idx >= 0) {
          s.active = idx;
          var stX = sideStats(side);
          s.hp = stX.stats.hp;
          log.push((side === "mine" ? "我" : "敌") + " 星地善良：换上 " + stX.pet.n);
        }
      })();

      // 花精灵：回合结束己方队伍获得 1 次随机奉献
      (function () {
        var tdF = sidePet(side).td || "";
        if (!/回合结束时，己方队伍获得(\d+)次随机奉献/.test(tdF)) return;
        var nF = Number(/回合结束时，己方队伍获得(\d+)次随机奉献/.exec(tdF)[1]);
        for (var i = 0; i < nF; i++) {
          var k = devotionRandom(side, (state.history.length || 0) + i + 1);
          log.push((side === "mine" ? "我" : "敌") + " 花精灵：奉献·" + (DEVOTION_LABEL[k] || k));
        }
      })();

      // 剩余回合递减
      state.buffs[side] = list.filter(function (b) {
        if (b.t === undefined || b.t === -1) return true;
        b.t = Number(b.t) - 1;
        return b.t > 0;
      });
    });

    // 聒噪持续回合递减
    ["mine", "foe"].forEach(function (sd) {
      if (Number(state[sd].noisy) > 0) state[sd].noisy = Number(state[sd].noisy) - 1;
    });

    // 灼烧每回合衰减 1 层；煤渣草改为 +1；焰色反应把衰减的 1 层转成中毒
    (function () {
      var burnTd = (sidePet("mine").td || "") + (sidePet("foe").td || "");
      var hasCoal = /在场时，所有灼烧的衰减变为增长/.test(burnTd);
      var hasFlame = /在场时，衰减的灼烧变为相同层数的中毒/.test(burnTd);
      ["mine", "foe"].forEach(function (sd) {
        var burn = (state.buffs[sd] || []).filter(function (b) { return b.n === "灼烧"; })[0];
        if (!burn) return;
        var stB = Math.max(1, Number(burn.st) || 1);
        if (hasCoal) {
          burn.st = stB + 1;
          log.push((sd === "mine" ? "我" : "敌") + " 煤渣草：灼烧 +1 层");
          return;
        }
        if (stB > 1) burn.st = stB - 1;
        else state.buffs[sd] = (state.buffs[sd] || []).filter(function (b) { return b !== burn; });
        if (hasFlame) {
          addBuff(sd, "中毒", 1);
          log.push((sd === "mine" ? "我" : "敌") + " 焰色反应：灼烧衰减 → 中毒 +1");
        } else {
          log.push((sd === "mine" ? "我" : "敌") + " 灼烧衰减 -1");
        }
      });
    })();
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
    // 翼轴：1 号位技能获得迅捷（传动只影响威力位置，这里只取先手）
    if (/1号位技能获得迅捷/.test(d) && (state[side].moves || [])[0] === sk.n) return true;
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
    var modSp = Number(((state[side] || {}).mods || {}).speed) || 0;
    return Math.max(1, base - 10 * slow + 10 * fast + modSp);
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
    // bwiki 新技能（2026-11-11）
    "混合态": function (side) {
      // 敌方获得随机 10 层属性减益：按 10 层均摊到双攻/双防/速度，近似 -35%
      var per = 10; // 层数
      addMod(other(side), "stat", -(per * 3.5));
      for (var i = 0; i < per; i++) addBuff(other(side), "随机减益", 1);
      return "敌方获得随机 " + per + " 层属性减益（近似 -35% 属性）";
    },

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
    "氧输送": function (side) { gainEnergy(side, 4, 10); addMod(side, "stat", 70); return "回 4 能量、魔攻 +70%"; },
    "徒长": function (side) { gainEnergy(side, 10, 10); return "回复 10 能量"; },
    "根吸收": function (side) { var st = sideStats(side); gainEnergy(side, 4, 10); healSide(side, Math.round(st.stats.hp * 0.15)); return "回复 15% 生命 + 4 能量"; },
    "光合作用": function (side) { addBuff(side, "光合印记", 1); return "自己 +1 层光合印记"; },

    // ---- 冰系 ----
    "冰点": function (side) { addBuff(other(side), "冻结", 5); return "敌方 +5 层冻结"; },
    "冰墙": function (side, win) { addMod(side, "taken", -80); if (win) { addBuff(other(side), "冻结", 2); return "减伤 80%，应对成功：敌方 +2 层冻结"; } return "减伤 80%"; },
    "速冻": function (side) { addBuff(other(side), "减速印记", 2); return "敌方 +2 层减速印记"; },

    // ---- 补全：毒 / 武 / 翼 / 龙 / 天气 / 变身 ----
    "毒雾": function (side) {
      var list = state.buffs[other(side)] || [];
      var total = 0;
      list.forEach(function (b) { if (b.n !== "中毒") total += Math.max(1, Number(b.st) || 1); });
      state.buffs[other(side)] = list.filter(function (b) { return b.n === "中毒"; });
      if (total > 0) addBuff(other(side), "中毒", total);
      return total > 0 ? "敌方 " + total + " 层增益 → 中毒" : "敌方没有可转化的增益";
    },
    "硬门": function (side, win) {
      if (!win) return "未应对成功";
      var a = sideStats(side).stats, d = sideStats(other(side)).stats;
      var dmg = Math.max(1, Math.round(90 * a.atk / Math.max(1, d.def) * DMG_CORE));
      state[other(side)].hp = Math.max(0, state[other(side)].hp - dmg);
      return "打断并造成 " + dmg + " 物伤";
    },
    "风隐": function (side) {
      state.mine.forceSwitch = 1;
      state.foe.forceSwitch = 1;
      state[side].priority = (Number(state[side].priority) || 0) - 1;
      return "双方脱离，先手 -1";
    },
    "应对！守护咒": function (side) { addMod(side, "taken", -90); return "减伤 90%"; },
    "应对！相位移动": function (side, win, sk) {
      addMod(side, "taken", -50);
      var idx = (state[side].moves || []).indexOf(sk && sk.n);
      if (idx === 0 || idx === 2) { addMod(side, "taken", -40); return "减伤 90%（1/3 号位）"; }
      return "减伤 50%";
    },
    "应对！超声波": function (side) { addMod(side, "power", 30); return "全技能威力 +30"; },
    "筑梦": function (side) { state.weather = "dream"; return "天气改为霞光梦境"; },
    "富养化": function (side) {
      var bench = ensureBench(side), n = 0;
      bench.forEach(function (b, i) {
        if (i === state[side].active) return;
        b.energy = Math.min(99, (Number(b.energy) || 0) + 3);
        n++;
      });
      return "场下 " + n + " 只各回复 3 能量";
    },
    "小型打劫": function (side) {
      var fo = other(side), st = state[fo], bench = ensureBench(fo), n = 0;
      st.energy = Math.max(0, (Number(st.energy) || 0) - 1);
      bench.forEach(function (b, i) {
        if (i === st.active) return;
        b.energy = Math.max(0, (Number(b.energy) || 0) - 1);
        n++;
      });
      return "敌方全队失去 1 能量（" + (n + 1) + " 只）";
    },
    "分光": function (side) {
      addMod(side, "stat", 20);
      var seen = {};
      (state[side].slots || []).forEach(function (nm) {
        var p = byName(nm);
        if (!p) return;
        if (p.el) seen[p.el] = 1;
        if (p.el2) seen[p.el2] = 1;
      });
      var extra = Object.keys(seen).length * 10;
      addMod(side, "stat", extra);
      return "魔攻 +20%，队伍 " + Object.keys(seen).length + " 个系别再 +" + extra + "%";
    },
    "借用": function (side) { return copyAllySkill(side); },
    "摄魂": function (side) { return copyAllySkill(side); },
    "过山车": function (side) {
      var mv = (state[side].moves || []).slice();
      if (mv.length > 1) {
        mv.unshift(mv.pop());
        state[side].moves = mv;
        return "技能顺序整体下移 1 位（跨精灵部分未建模）";
      }
      return "没有可移动的技能";
    },
    "疾风连袭": function (side) {
      var hist = (state[side].swiftHistory || []).slice();
      if (!hist.length) return "没有释放过迅捷技能";
      var st = sideStats(side), ft = sideStats(other(side));
      var total = 0, costSum = 0, names = [];
      hist.forEach(function (n) {
        var sk = skillByName(n);
        if (!sk) return;
        costSum += Number(sk.c) || 0;
        if (sk.p) total += hitDamage(side, sk, st, ft, -1, false);
        names.push(n);
      });
      if (total > 0) state[other(side)].hp = Math.max(0, state[other(side)].hp - total);
      var extra = Math.round(costSum / 2) + (Number(state[side].swiftReplayUses) || 0);
      state[side].costFlat = (Number(state[side].costFlat) || 0) + extra;
      state[side].swiftReplayUses = (Number(state[side].swiftReplayUses) || 0) + 1;
      return "释放 " + names.length + " 个迅捷技能，伤害 " + total + "，后续能耗 +" + extra;
    }
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

  // 统一回能入口：盗魂铃在场时每次回能 -4；腐植循环每回 1 能量回 5% 生命
  function gainEnergy(side, amount, cap) {
    var amt = Math.max(0, Math.round(Number(amount) || 0));
    if (!amt) return 0;
    var td = sidePet(side).td || "";
    if (/在场时自己回复的能量-4/.test(td)) amt = Math.max(0, amt - 4);
    var capV = cap != null && Number.isFinite(Number(cap)) ? Number(cap) : energyCap(side);
    var before = Number(state[side].energy) || 0;
    state[side].energy = Math.min(capV, before + amt);
    var gained = state[side].energy - before;
    if (gained > 0) {
      if (/每回复1能量，同时回复5%生命/.test(td)) {
        var st = sideStats(side);
        healSide(side, Math.round(st.stats.hp * 0.05) * gained);
      }
      benchRedirect(side, gained, "energy");
    }
    return gained;
  }

  // 统一回血入口：戏耍持有者无法回血，改为敌方扣除等量生命
  function healSide(side, amount) {
    var amt = Math.max(0, Math.round(Number(amount) || 0));
    if (!amt) return 0;
    if (/自己无法回复生命/.test(sidePet(side).td || "")) {
      var foe = other(side);
      state[foe].hp = Math.max(0, state[foe].hp - amt);
      state.lastHealConverted = (side === "mine" ? "我" : "敌") + " 戏耍：回血转为敌方 -" + amt;
      state.pendingTraitLogs = state.pendingTraitLogs || [];
      state.pendingTraitLogs.push(state.lastHealConverted);
      return -amt;
    }
    var st = sideStats(side);
    var before = state[side].hp;
    state[side].hp = Math.min(st.stats.hp, before + amt);
    var healed = state[side].hp - before;
    if (healed > 0) benchRedirect(side, healed, "hp");
    return healed;
  }

  // 系统发育：把获得的能量/生命等量记到场下池（近似，面板单列）
  function benchRedirect(side, amount, kind) {
    if (!(amount > 0)) return;
    if (!/获得能量或生命时，会将等量的能量或生命随机分配给场下的精灵/.test(sidePet(side).td || "")) return;
    var bench = ensureBench(side), s = state[side];
    var cands = [];
    for (var i = 0; i < bench.length; i++) {
      if (i !== s.active && bench[i] && Number(bench[i].hp) > 0) cands.push(i);
    }
    if (!cands.length) return;
    var seed = (Number(state.seed) || 1) + (Number(state.history.length) || 0) * 11 + cands.length;
    var idx = cands[Math.abs(seed) % cands.length];
    if (kind === "hp") {
      var beforeHp = Number(bench[idx].hp) || 0;
      bench[idx].hp = Math.min(Number(bench[idx].max) || beforeHp, beforeHp + amount);
      amount = bench[idx].hp - beforeHp;
    } else {
      var beforeEn = Number(bench[idx].energy) || 0;
      bench[idx].energy = Math.min(99, beforeEn + amount);
      amount = bench[idx].energy - beforeEn;
    }
    if (amount <= 0) return;
    state.pendingTraitLogs = state.pendingTraitLogs || [];
    state.pendingTraitLogs.push((side === "mine" ? "我" : "敌") + " 系统发育：场下 " + s.slots[idx] + " " + (kind === "hp" ? "生命" : "能量") + " +" + amount);
  }

  function removeBuff(side, name) {
    state.buffs[side] = (state.buffs[side] || []).filter(function (b) { return b.n !== name; });
    if (DEBUFFS.indexOf(name) >= 0) {
      var pet = sidePet(side);
      if (pet && /驱散1次自己的减益后[^。]*?物攻永久+50%/.test(pet.td || "") && !state[side].moltUsed) {
        state[side].moltUsed = 1;
        addMod(side, "atkMul", 50);
        state.pendingTraitLogs = state.pendingTraitLogs || [];
        state.pendingTraitLogs.push((side === "mine" ? "我" : "敌") + " 换牙：驱散减益 → 物攻永久+50%");
      }
    }
    save();
  }

  function stackOf(side, name) {
    var b = (state.buffs[side] || []).filter(function (x) { return x.n === name; })[0];
    return b ? Math.max(1, Number(b.st) || 1) : 0;
  }

  // 滴溜豚「游戏的本质」：入场抽 1–20 点，1/20 为极值特殊效果，效果作用于双方（含替补与印记）
  var GAMES_ESSENCE = {
    1:  { attr: "大失败", timing: "end", note: "我方 -2 能量 +20% 生命；敌方 +1 能量 +10% 生命" },
    2:  { attr: "普通", timing: "passive", note: "双方技能威力 +20" },
    3:  { attr: "火", timing: "after", note: "行动后双方获得 6 层灼烧" },
    4:  { attr: "水", timing: "passive", note: "双方能耗 -1" },
    5:  { attr: "地", timing: "passive", note: "双方连击 -2" },
    6:  { attr: "冰", timing: "end", note: "回合结束双方获得 2 层冻结" },
    7:  { attr: "毒", timing: "after", note: "行动后双方获得 2 层中毒" },
    8:  { attr: "翼", timing: "passive", note: "双方连击 +2" },
    9:  { attr: "萌", timing: "passive", note: "双方双攻 -50%" },
    10: { attr: "幽", timing: "end", note: "回合结束双方能量 -2" },
    11: { attr: "草", timing: "end", note: "回合结束双方回 10% 生命" },
    12: { attr: "武", timing: "passive", note: "双方物攻 +50%" },
    13: { attr: "光", timing: "passive", note: "双方魔攻 +50%" },
    14: { attr: "虫", timing: "passive", note: "双方物防 -80%" },
    15: { attr: "龙", timing: "passive", note: "双方魔防 -80%" },
    16: { attr: "电", timing: "passive", note: "双方 +50 点速度" },
    17: { attr: "恶", timing: "passive", note: "双方吸血 +50%" },
    18: { attr: "机械", timing: "passive", note: "双方双防 +50%" },
    19: { attr: "幻", timing: "end", note: "回合结束双方获得 2 层星陨印记" },
    20: { attr: "大成功", timing: "end", note: "我方 +2 能量 +20% 生命；敌方 -1 能量 -10% 生命" }
  };

  // 滴溜豚是 6 点版（1草/2武/3光/4虫/5龙/6电），滴廿豚是完整 20 点版
  var DILIU_MAP = { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 };
  function gamesEssencePoint() { return Number(state.gamesEssence && state.gamesEssence.point) || 0; }
  function gamesEssenceMax() { return Number(state.gamesEssence && state.gamesEssence.max) || 20; }
  function gamesEssenceTablePoint(p) {
    p = Number(p) || 0;
    return state.gamesEssence && Number(state.gamesEssence.max) === 6 ? (DILIU_MAP[p] || p) : p;
  }
  function gamesEssenceMeta(p) { return GAMES_ESSENCE[gamesEssenceTablePoint(p)] || {}; }

  function rollGamesEssence(side) {
    var pet = sidePet(side);
    if (!pet || !/游戏的本质/.test((pet.t || "") + " " + (pet.td || ""))) return "";
    if (gamesEssencePoint()) essClearPassive();      // 重新入场：先撤掉上一次的常驻效果
    var max = /^滴溜豚$/.test(pet.n) ? 6 : 20;
    var q = /[?&]essence=(\d+)/.exec(location.search || "");
    var fixed = Number(state.gamesEssenceFixed) || (q ? Number(q[1]) : 0) || 0;
    var point = fixed >= 1 && fixed <= max ? fixed : 1 + Math.floor(Math.random() * max);
    state.gamesEssence = { point: point, max: max, ownedBy: side, applied: [] };
    var meta = gamesEssenceMeta(point);
    var passive = gamesEssencePassive();
    var cleanPassive = passive ? passive.replace(/^游戏的本质（\d+·[^）]+）：/, "") : "";
    return "游戏的本质：抽到第 " + point + " 点（" + meta.attr + "）" +
      (cleanPassive ? "｜" + cleanPassive : "→ " + meta.note);
  }

  function essAdd(side, key, val) {
    addMod(side, key, val);
    state.gamesEssence.applied.push({ side: side, key: key, val: val });
  }
  function essClearPassive() {
    var list = (state.gamesEssence && state.gamesEssence.applied) || [];
    list.forEach(function (x) {
      if (x.cost) {
        state[x.side].costFlat = (Number(state[x.side].costFlat) || 0) - x.val;
      } else {
        addMod(x.side, x.key, -x.val);
      }
    });
    if (state.gamesEssence) state.gamesEssence.applied = [];
  }
  function gamesEssencePassive() {
    var p = gamesEssencePoint();
    if (!p) return "";
    var tp = gamesEssenceTablePoint(p);
    var meta = GAMES_ESSENCE[tp] || {};
    if (meta.timing !== "passive") return "";
    state.gamesEssence.applied = state.gamesEssence.applied || [];
    if (tp === 2) { essAdd("mine", "power", 20); essAdd("foe", "power", 20); }
    else if (tp === 4) { state.gamesEssence.applied.push({ side: "mine", cost: true, val: -1 }); state.gamesEssence.applied.push({ side: "foe", cost: true, val: -1 }); state.mine.costFlat = (Number(state.mine.costFlat) || 0) - 1; state.foe.costFlat = (Number(state.foe.costFlat) || 0) - 1; }
    else if (tp === 5) { essAdd("mine", "combo", -2); essAdd("foe", "combo", -2); }
    else if (tp === 8) { essAdd("mine", "combo", 2); essAdd("foe", "combo", 2); }
    else if (tp === 9) { essAdd("mine", "atkMul", -50); essAdd("mine", "maMul", -50); essAdd("foe", "atkMul", -50); essAdd("foe", "maMul", -50); }
    else if (tp === 12) { essAdd("mine", "atkMul", 50); essAdd("foe", "atkMul", 50); }
    else if (tp === 13) { essAdd("mine", "maMul", 50); essAdd("foe", "maMul", 50); }
    else if (tp === 14) { essAdd("mine", "defMul", -80); essAdd("foe", "defMul", -80); }
    else if (tp === 15) { essAdd("mine", "mdMul", -80); essAdd("foe", "mdMul", -80); }
    else if (tp === 16) { essAdd("mine", "speed", 50); essAdd("foe", "speed", 50); }
    else if (tp === 17) { essAdd("mine", "drain", 50); essAdd("foe", "drain", 50); }
    else if (tp === 18) { essAdd("mine", "defMul", 50); essAdd("mine", "mdMul", 50); essAdd("foe", "defMul", 50); essAdd("foe", "mdMul", 50); }
    return "游戏的本质（" + p + "·" + meta.attr + "）：" + meta.note;
  }

  function gamesEssenceAfter() {
    var tp = gamesEssenceTablePoint(gamesEssencePoint());
    if (tp === 3) { addBuff("mine", "灼烧", 6); addBuff("foe", "灼烧", 6); return "游戏的本质：双方灼烧 +6"; }
    if (tp === 7) { addBuff("mine", "中毒", 2); addBuff("foe", "中毒", 2); return "游戏的本质：双方中毒 +2"; }
    return "";
  }

  // 替补也吃：能量/生命类效果套到全队，属性类由 side mods 在新精灵入场时继承
  function essEnergyAll(side, delta) {
    var st = state[side], bench = ensureBench(side);
    var cap = energyCap(side);
    st.energy = Math.max(0, Math.min(cap, (Number(st.energy) || 0) + delta));
    bench.forEach(function (b, i) {
      if (!b || i === st.active) return;
      b.energy = Math.max(0, Math.min(10, (Number(b.energy) || 0) + delta));
    });
  }
  function essHealAll(side, pct) {
    var st = state[side], bench = ensureBench(side);
    if (Number(st.hp) > 0) healSide(side, Math.round(sideStats(side).stats.hp * pct / 100));
    bench.forEach(function (b, i) {
      if (!b || i === st.active || !(Number(b.hp) > 0)) return;
      b.hp = Math.max(1, Math.min(Number(b.max) || 1, Math.round(Number(b.hp) + (Number(b.max) || 1) * pct / 100)));
    });
  }
  function essDamageAll(side, pct) {
    var st = state[side], bench = ensureBench(side);
    if (Number(st.hp) > 0) st.hp = Math.max(1, Math.round(Number(st.hp) - sideStats(side).stats.hp * pct / 100));
    bench.forEach(function (b, i) {
      if (!b || i === st.active || !(Number(b.hp) > 0)) return;
      b.hp = Math.max(1, Math.round(Number(b.hp) - (Number(b.max) || 1) * pct / 100));
    });
  }
  // 回合结束类特性：银头寸（消耗能量→魔攻）/ 储备金（聚能→物攻）
  function traitEndEffects() {
    var out = [];
    ["mine", "foe"].forEach(function (sd) {
      var d = sidePet(sd).td || "";
      if (/自己每消耗1点能量[^。]*?魔攻+10%/.test(d)) {
        var spent = Math.max(0, (Number(state[sd].energyAtTurnStart) || 0) - (Number(state[sd].energy) || 0));
        if (spent > 0) {
          addMod(sd, "maMul", 10 * spent);
          out.push((sd === "mine" ? "我" : "敌") + " 银头寸：消耗 " + spent + " 能量 → 魔攻+" + (10 * spent) + "%");
        }
      }
      if (/自己每使用1次聚能[^。]*?物攻+50%/.test(d)) {
        var ch = Math.max(0, (Number(state[sd].chargeCount) || 0) - (Number(state[sd].chargeAtTurnStart) || 0));
        if (ch > 0) {
          addMod(sd, "atkMul", 50 * ch);
          out.push((sd === "mine" ? "我" : "敌") + " 储备金：聚能 " + ch + " 次 → 物攻+" + (50 * ch) + "%");
        }
      }
    });
    return out.join("；");
  }

  function gamesEssenceEnd() {
    var p = gamesEssencePoint();
    if (!p) return "";
    var tp = gamesEssenceTablePoint(p);
    if (tp === 1) {
      essEnergyAll("mine", -2); essEnergyAll("foe", 1);
      essHealAll("mine", 20); essHealAll("foe", 10);
      return "游戏的本质（大失败）：我方全队 -2 能量 +20% 生命，敌方全队 +1 能量 +10% 生命";
    }
    if (tp === 6) { addBuff("mine", "冻结", 2); addBuff("foe", "冻结", 2); return "游戏的本质：双方冻结 +2"; }
    if (tp === 10) { essEnergyAll("mine", -2); essEnergyAll("foe", -2); return "游戏的本质：双方全队能量 -2"; }
    if (tp === 11) { essHealAll("mine", 10); essHealAll("foe", 10); return "游戏的本质：双方全队回 10% 生命"; }
    if (tp === 19) { addBuff("mine", "星陨印记", 2); addBuff("foe", "星陨印记", 2); return "游戏的本质：双方星陨印记 +2"; }
    if (tp === 20) {
      essEnergyAll("mine", 2); essEnergyAll("foe", -1);
      essHealAll("mine", 20); essDamageAll("foe", 10);
      return "游戏的本质（大成功）：我方全队 +2 能量 +20% 生命，敌方全队 -1 能量 -10% 生命";
    }
    return "";
  }

  function addMod(side, key, val) {
    var sd = state[side];
    sd.mods = sd.mods || { power: 0, stat: 0, taken: 0, drain: 0 };
    sd.mods[key] = (sd.mods[key] || 0) + val;
  }

  var DEBUFFS = ["中毒", "灼烧", "冻结", "减速印记", "中毒印记", "降灵印记", "暗涌印记", "侵蚀", "易伤"];
  function isBuffName(n) { return DEBUFFS.indexOf(n) < 0 && !/减速|中毒|灼烧|冻结|易伤|削弱/.test(n); }
  function teamHasMoe(side) {
    if ((state.buffs[side] || []).some(function (b) { return b.n === "萌化"; })) return true;
    return (state[side].slotMoe || []).some(function (n) { return Number(n) > 0; });
  }

  function addBuff(side, name, stacks) {
    // 茶多酚：换上的精灵免疫寄生
    if (name === "寄生" && state[side].immuneParasite) return;
    // 加个雪球：使敌方获得冻结时，也会使其获得 2 层冻结
    if (name === "冻结") {
      var snowPet = sidePet(other(side));
      if (snowPet && /使敌方获得冻结时[^。]*?获得2层冻结/.test(snowPet.td || "")) stacks += 2;
    }
    // 营养液泡：获得增益时额外 +2 层
    var petA = sidePet(side);
    if (petA && /获得增益时[^。]*?层数\+2/.test(petA.td || "") && isBuffName(name)) stacks += 2;
    state.buffs[side] = state.buffs[side] || [];
    var exist = state.buffs[side].filter(function (b) { return b.n === name; })[0];
    if (exist) exist.st = (Number(exist.st) || 1) + stacks;
    else state.buffs[side].push({ n: name, st: stacks, t: -1 });
    // 毒牙：使敌方获得中毒时，也会使其获得物攻 -40%、速度 -40
    if (name === "中毒") {
      var fangPet = sidePet(other(side));
      if (fangPet && /使敌方获得中毒时[^。]*?物攻[-−]40%和速度[-−]40/.test(fangPet.td || "")) {
        addMod(side, "stat", -40);
        addMod(side, "speed", -40);
      }
    }
    // 高吹雪：敌方冻结累计到 10 层 → 天气变暴风雪 5 回合（最多一次）
    if (name === "冻结") {
      var hiPet = sidePet(other(side));
      if (hiPet && /使敌方获得10层冻结后[^。]*?天气变为暴风雪/.test(hiPet.td || "") && !state[other(side)].highBlizzardUsed) {
        var fzTot = 0;
        (state.buffs[side] || []).forEach(function (b) { if (b.n === "冻结") fzTot += Math.max(1, Number(b.st) || 1); });
        if (fzTot >= 10) {
          state[other(side)].highBlizzardUsed = 1;
          state.weather = "snow";
          state.pendingTraitLogs = state.pendingTraitLogs || [];
          state.pendingTraitLogs.push((other(side) === "mine" ? "我" : "敌") + " 高吹雪：天气变为暴风雪（5 回合）");
        }
      }
    }
    // 捉迷藏 / 抓到你了：使敌方获得冻结时，也会使其获得全技能能耗+1
    if (name === "冻结") {
      var myPet = sidePet(other(side));
      if (myPet && /使敌方获得冻结时[^。]*?全技能能耗\+1/.test(myPet.td || "")) {
        state[side].costFlat = (Number(state[side].costFlat) || 0) + 1;
      }
    }
    // 记录本队累计获得过的萌化层数（守护者用）
    if (name === "萌化") {
      state[side].moeTotal = (Number(state[side].moeTotal) || 0) + Math.max(1, Number(stacks) || 1);
      state[side].slotMoe = state[side].slotMoe || [];
      var siM = Number(state[side].active) || 0;
      state[side].slotMoe[siM] = (Number(state[side].slotMoe[siM]) || 0) + Math.max(1, Number(stacks) || 1);
    }
    // 拉拉队长：若在萌化状态下再获得萌化 → 解除萌化
    if (name === "萌化") {
      var holder = sidePet(side);
      if (holder && /若自己在萌化状态下再获得萌化会解除萌化/.test(holder.td || "")) {
        state.buffs[side] = state.buffs[side].filter(function (b) { return b.n !== "萌化"; });
        return;
      }
    }
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

  // 借用 / 摄魂：从场下队友的可学技能里随机借一个
  function copyAllySkill(side) {
    var st = state[side], cands = [];
    (st.slots || []).forEach(function (nm, i) {
      if (i === st.active) return;
      var L = (window.LEARNSETS || {})[nm];
      if (L && Array.isArray(L.s)) L.s.forEach(function (n) { if (n) cands.push(n); });
    });
    if (!cands.length) return "没有可借用的队友技能";
    var seed = (Number(state.seed) || 1) + (Number(state.history.length) || 0) * 13;
    var pick = cands[Math.abs(seed) % cands.length];
    st.moves = st.moves || ["", "", "", ""];
    st.moves[0] = pick;
    return "借用队友技能：" + pick;
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
    // 下回合眩晕：自己写明「自己下回合获得眩晕」→ 挂自己；否则挂在应对成功的目标上
    if (/下回合获得眩晕/.test(raw)) {
      var selfStun = /自己下回合获得眩晕/.test(raw);
      if (selfStun) state[side].stunNext = 1;
      else if (counterWin) { state[other(side)].stunNext = 1; }
    }
    var done = [], m, outDummy = 0;
    // 涉及场下/替补/全队的效果，不能直接算在当前精灵身上
    if (/场下|替补|队伍中|全体我方/.test(d)) return "";
    if ((m = /(?:恢复|回复)(\d+)能量/.exec(d))) {
      gainEnergy(side, Number(m[1]), 10);
      done.push("能量+" + m[1]);
    }
    // 改变天气（暴风雪 / 沙暴 / 雷暴 / 下雨）
    if ((m = /将天气(?:改为|变为)\s*([\u4e00-\u9fa5]{2,4})/.exec(d))) {
      var wmap = { "暴风雪": "snow", "沙暴": "sand", "沙尘暴": "sand", "雷暴": "thunder", "雷鸣": "thunder", "下雨": "rain", "雨天": "rain", "霞光梦境": "dream", "梦境": "dream" };
      var w = wmap[m[1]];
      if (w) {
        state.weather = w;
        state.weatherTurns = Number((/持续(\d+)回合/.exec(d) || [])[1]) || 5;
        done.push("天气→" + m[1]);
      }
    }
    // 偷取/扣除敌方能量
    if ((m = /偷取敌方(\d+)能量/.exec(d))) {
      var fo1 = other(side), take = Math.min(Number(m[1]), Number(state[fo1].energy) || 0);
      state[fo1].energy = Math.max(0, (Number(state[fo1].energy) || 0) - take);
      gainEnergy(side, take, 10);
      done.push("偷取能量 " + take);
    }
    if ((m = /敌方失去(\d+)能量/.exec(d))) {
      var fo2 = other(side);
      state[fo2].energy = Math.max(0, (Number(state[fo2].energy) || 0) - Number(m[1]));
      done.push("敌方能量-" + m[1]);
    }
    // 首领技：对所有对手附加 N 层毒
    if ((m = /对所有对手附加(\d+)层毒/.exec(d))) {
      addBuff(other(side), "中毒", Number(m[1]));
      done.push("敌方+" + m[1] + "层中毒");
    }
    // 首领技：增加 N% 攻击
    if ((m = /首领技[，,]增加(\d+)%攻击/.exec(d))) {
      addMod(side, "stat", Number(m[1]));
      done.push("攻击+" + m[1] + "%");
    }
    // 重置天气
    if (/重置战场天气|重置天气/.test(d)) { state.weather = ""; done.push("天气已重置"); }
    // 场地：获得印记，每回合回 1 能量
    if (/获得印记，每回合回1能量/.test(d)) {
      addBuff(side, "光合印记", 1);
      done.push("获得光合印记（每回合回能）");
    }
    // 首领场地：威力 +10 的印记（按威力修正）
    if ((m = /获得威力增加(\d+)的印记/.exec(d))) {
      addMod(side, "power", Number(m[1]));
      done.push("威力+" + m[1]);
    }
    // 驱散回能（驱散敌方状态并回能）
    if (/^驱散回能$/.test((d || "").trim())) {
      var n9 = (state.buffs[other(side)] || []).length;
      state.buffs[other(side)] = [];
      gainEnergy(side, Math.min(3, n9), 10);
      done.push("驱散敌方 " + n9 + " 个状态并回能");
    }
    // 赋予破绽（近似为易伤）
    if (/赋予破绽效果/.test(d)) { addBuff(other(side), "易伤", 1); done.push("敌方获得破绽（按易伤）"); }
    // 威力等于敌方总能耗的 N 倍（伤害技，无威力字段时按描述给一个等价威力修正）
    if ((m = /本技能威力等于敌方精灵技能总能耗的(\d+)倍/.exec(d))) {
      var sumC = 0;
      (state[other(side)].moves || []).forEach(function (nm2) { var k2 = nm2 ? skillByName(nm2) : null; if (k2) sumC += Number(k2.c) || 0; });
      state[side].powerFlat = (Number(state[side].powerFlat) || 0) + sumC * Number(m[1]);
      done.push("威力 +" + (sumC * Number(m[1])) + "（敌方总耗能 " + sumC + " × " + m[1] + "）");
    }
    // 下回合受到伤害降低 N%
    if ((m = /下回合受到的伤害降低(\d+)%/.exec(d))) {
      addMod(side, "taken", -Number(m[1]));
      done.push("下回合减伤 " + m[1] + "%");
    }
    // 全属性增加 N%
    if ((m = /全属性增加(\d+)%/.exec(d))) {
      addMod(side, "stat", Number(m[1]));
      addMod(side, "taken", -Number(m[1]) / 2);
      done.push("全属性+" + m[1] + "%");
    }
    // 提升 N% 物攻与魔攻
    if ((m = /提升(\d+)%物攻以及魔攻/.exec(d))) {
      addMod(side, "stat", Number(m[1]));
      done.push("双攻+" + m[1] + "%");
    }
    // 增加 N% 魔攻
    if ((m = /增加(\d+)%魔攻/.exec(d))) {
      addMod(side, "stat", Number(m[1]));
      done.push("魔攻+" + m[1] + "%");
    }
    // 吸收对手所有能量
    if (/吸收随机1个对手所有能量/.test(d)) {
      var foE = other(side);
      var amt = Number(state[foE].energy) || 0;
      state[foE].energy = 0;
      gainEnergy(side, amt, 10);
      done.push("吸收敌方能量 " + amt);
    }
    // 让对方离开战场（吹飞/致盲）
    if (/让对方离开战场/.test(d)) { state.foe.forceSwitch = 1; done.push("敌方离开战场"); }
    // 脱离
    if (/^脱离。?$/.test((d || "").trim())) { state.mine.forceSwitch = 1; done.push("自己脱离"); }
    // 强化所有友军
    if (/强化所有友军[^。]*?增加攻击/.test(d)) { addMod(side, "stat", 40); done.push("友军攻击提升（按 +40% 近似）"); }
    // 随机 1 个系别技能能耗降到 0（按全技能 -1 近似）
    if (/随机1个系别的技能[^。]*?能耗降低至0/.test(d)) { state[side].costFlat = (Number(state[side].costFlat) || 0) - 1; done.push("能耗-1（近似）"); }
    // 首领技/通用：下一次攻击威力翻倍
    if (/下一次攻击技能威力翻倍/.test(d)) {
      state[side].pending = state[side].pending || {};
      state[side].pending.power = (Number(state[side].pending.power) || 0) + 100;
      done.push("下次攻击威力×2（已挂起）");
    }
    // 首领技：增加 20% 物攻
    if ((m = /增加(\d+)%物攻/.exec(d))) {
      addMod(side, "stat", Number(m[1]));
      done.push("物攻+" + m[1] + "%");
    }
    // 防御提升（守护/精灵防御提升）
    if (/精灵防御提升/.test(d)) {
      addMod(side, "taken", -40);
      done.push("减伤 40%（防御提升）");
    }
    // 群体强化 / 群体治疗（伙伴的支援 / 友谊的治愈）
    if (/群体强化/.test(d)) { addMod(side, "stat", 30); done.push("群体强化（按双攻+30% 近似）"); }
    if (/群体治疗/.test(d)) {
      var stH = sideStats(side);
      healSide(side, Math.round(stH.stats.hp * 0.3));
      done.push("群体治疗（按回 30% 近似）");
    }
    // 双生强化：选择连击+2 或 攻击+60%（默认取攻击 +60%）
    if (/选择[：:]连击数[+＋]2或攻击[+＋](\d+)%/.test(d)) {
      addMod(side, "stat", 60);
      done.push("双生强化：攻击+60%");
    }
    // 毒气弥漫等：赋予敌方 1 层中毒印记
    if ((m = /赋予敌方(\d+)层(中毒印记|中毒)/.exec(d))) {
      addBuff(other(side), m[2], Number(m[1]));
      done.push("敌方+" + m[1] + "层" + m[2]);
    }
    // 测试类技能（废弃/检测工具）无实际效果
    if (/测试增益/.test(d)) done.push("测试技能（无实战效果）");
    // 敌方「威力-N」（降低对方技能威力，近似为对方威力修正）
    if ((m = /敌方获得威力[-−](\d+)/.exec(d))) {
      addMod(other(side), "power", -Number(m[1]));
      done.push("敌方威力-" + m[1]);
    }
    // 下一次攻击额外造成 N% 幻系伤害（按威力倍率近似）
    if ((m = /额外造成(\d+)%幻系伤害/.exec(d))) {
      state[side].pending = state[side].pending || {};
      state[side].pending.power = (Number(state[side].pending.power) || 0) + Number(m[1]);
      done.push("下次攻击 +" + m[1] + "% 幻系（已挂起）");
    }
    // 雨天延长 N 回合
    if ((m = /雨天的回合数延长(\d+)回合/.test(d)) && state.weather === "rain") {
      state.weatherTurns = (Number(state.weatherTurns) || 5) + Number(/延长(\d+)回合/.exec(d)[1]);
      done.push("雨天 +" + /延长(\d+)回合/.exec(d)[1] + " 回合");
    }
    // 敌方下回合回复能量-N（近似为当前扣能）
    if ((m = /敌方下回合回复的能量[-−](\d+)/.exec(d))) {
      state[other(side)].energy = Math.max(0, (Number(state[other(side)].energy) || 0) - Number(m[1]));
      done.push("敌方能量-" + m[1]);
    }
    // 己方队伍获得 N 次随机奉献
    if ((m = /己方队伍获得(\d+)次随机奉献/.exec(d))) {
      state.devote = state.devote || {};
      state.devote.pending = (Number(state.devote.pending) || 0) + Number(m[1]);
      done.push("奉献 +" + m[1] + " 次（已记，界面奉献区可手填）");
    }
    // 随机 16 层五维增益（叠加态）：平均分配给双攻，避免过度随机
    if (/随机16层属性增益/.test(d)) {
      addMod(side, "stat", 80);
      done.push("随机 16 层属性增益（按平均 +80% 双攻近似）");
    }
    // 选择类：随机 1 种印记（薄纱环）——按给自己一个正面印记近似
    if (/随机获得1种(?:正面)?印记/.test(d)) {
      addBuff(side, "加速印记", 1);
      done.push("随机正面印记（按加速印记近似）");
    }
    // 携带技能附加中毒（重金属粉尘）
    if ((m = /获得附加中毒(\d+)/.exec(d))) {
      state[side].poisonAdd = (Number(state[side].poisonAdd) || 0) + Number(m[1]);
      done.push("攻击附加中毒 " + m[1]);
    }
    // 返场类（自己/敌方）：简化为记录一次强制换人提示
    if (/使敌方精灵返场/.test(d)) { state.foe.forceSwitch = 1; done.push("敌方将被强制返场"); }
    if (/回合结束自己返场|自己脱离/.test(d)) { state.mine.forceSwitch = 1; done.push("自己回合末返场"); }
    // 敌方本回合技能能耗 +N（持续若干回合，简化为本回合一次性惩罚）
    if ((m = /(?:本回合)?敌方(?:本回合)?(?:使用的)?技能能耗[+＋](\d+)/.exec(d))) {
      var fe = other(side);
      state[fe].costFlat = (Number(state[fe].costFlat) || 0) + Number(m[1]);
      done.push("敌方能耗+" + m[1]);
    }
    // 敌方禁足（近似为速度大幅下降）
    if (/敌方获得(\d+)回合禁足/.test(d)) {
      var turns = Number(/敌方获得(\d+)回合禁足/.exec(d)[1]);
      addMod(other(side), "speed", -60 * turns);
      done.push("敌方禁足 " + turns + " 回合（速度大降）");
    }
    // 敌方物防/魔防大降
    if ((m = /敌方获得(?:物防和魔防|物防|魔防|双防)[-−](\d+)%/.exec(d))) {
      outDummy = 1;
      done.push("敌方防-" + m[1] + "%（不影响伤害公式）");
    }
    // 星陨印记按敌方印记层数
    if (/敌方获得星陨印记[^。]*?等于敌方印记层数/.test(d)) {
      var cntF = ((state.buffs && state.buffs[other(side)]) || []).filter(function (b) { return /印记/.test(b.n); })
        .reduce(function (a, b) { return a + Math.max(1, Number(b.st) || 1); }, 0);
      addBuff(other(side), "星陨印记", Math.max(1, cntF));
      done.push("敌方星陨印记 " + Math.max(1, cntF) + " 层");
    }
    // 威力永久 +N（联动装置）
    if ((m = /威力永久[+＋](\d+)/.exec(d))) {
      addMod(side, "power", Number(m[1]));
      done.push("威力永久+" + m[1]);
    }
    // 驱散自己的减益，自己的增益翻倍
    if (/驱散自己的减益[^。]*?自己的增益翻倍/.test(d)) {
      var mine9 = state.buffs[side] || [];
      var debuffs = mine9.filter(function (b) { return /中毒|灼烧|冻结|易伤|侵蚀|减速/.test(b.n); });
      state.buffs[side] = mine9.filter(function (b) { return debuffs.indexOf(b) < 0; });
      (state.buffs[side] || []).forEach(function (b) { b.st = (Number(b.st) || 1) * 2; });
      done.push("驱散己方减益 " + debuffs.length + " 个，增益翻倍");
    }
    // 敌方增益转化为中毒
    if (/将敌方所有增益[^。]*?转化为[^。]*?中毒/.test(d)) {
      var fo7 = other(side);
      var gain = ((state.buffs[fo7]) || []).filter(function (b) { return b.n.indexOf("印记") < 0; });
      if (gain.length) {
        var total = gain.reduce(function (a, b) { return a + Math.max(1, Number(b.st) || 1); }, 0);
        state.buffs[fo7] = (state.buffs[fo7] || []).filter(function (b) { return gain.indexOf(b) < 0; });
        addBuff(fo7, "中毒", total);
        done.push("敌方增益 → 中毒 " + total + " 层");
      }
    }
    // 敌方减益层数翻倍
    if (/使敌方精灵减益的层数翻倍/.test(d)) {
      ((state.buffs[other(side)]) || []).forEach(function (b) { if (/中毒|灼烧|冻结|易伤|侵蚀/.test(b.n)) b.st = (Number(b.st) || 1) * 2; });
      done.push("敌方减益层数 ×2");
    }
    // 连击数百分比（暴风眼）
    if ((m = /获得连击数[+＋](\d+)%/.exec(d))) {
      state[side].st = state[side].st || {};
      var baseC = Number(state[side].st.combo) || 1;
      state[side].st.combo = Math.max(1, Math.round(baseC * (1 + Number(m[1]) / 100)));
      done.push("连击 ×" + (1 + Number(m[1]) / 100));
    }
    // 驱散敌方 N 种/所有增益
    if (/驱散敌方(?:所有|\d+种)增益|驱散敌方印记/.test(d)) {
      var fo8 = other(side);
      var before8 = (state.buffs[fo8] || []).length;
      state.buffs[fo8] = [];
      if (/每层印记回复自己10%生命/.test(d)) {
        var st8 = sideStats(side);
        healSide(side, Math.round(st8.stats.hp * 0.1 * before8));
        done.push("驱散敌方 " + before8 + " 层并回血 " + (10 * before8) + "%");
      } else done.push("驱散敌方增益 " + before8 + " 个");
    }
    // 自己获得萌化（附带永久属性修正）
    if (/自己获得萌化/.test(d)) {
      if ((m = /速度永久[+＋](\d+)/.exec(d))) { addMod(side, "speed", Number(m[1])); done.push("速度永久+" + m[1]); }
      if ((m = /全技能能耗永久[-−](\d+)/.exec(d))) { state[side].costFlat = (Number(state[side].costFlat) || 0) - Number(m[1]); done.push("能耗永久-" + m[1]); }
    }
    // 将自己的萌化转移给敌方
    if (/将自己的萌化转移给敌方/.test(d)) {
      var mine8 = (state.buffs[side] || []).filter(function (b) { return b.n === "萌化"; });
      if (mine8.length) {
        state.buffs[side] = state.buffs[side].filter(function (b) { return b.n !== "萌化"; });
        addBuff(other(side), "萌化", mine8.reduce(function (a, b) { return a + (Number(b.st) || 1); }, 0));
        done.push("萌化转移给敌方");
      }
    }
    // 连击数：自己+N / 敌方-N（含「获得连击数」措辞）
    if ((m = /自己获得连击数[+＋](\d+)/.exec(d))) {
      state[side].st = state[side].st || {};
      state[side].st.combo = (Number(state[side].st.combo) || 1) + Number(m[1]);
      done.push("连击+" + m[1]);
    }
    if ((m = /敌方获得连击数[-−](\d+)/.exec(d))) {
      var fo6 = other(side);
      state[fo6].st = state[fo6].st || {};
      state[fo6].st.combo = Math.max(1, (Number(state[fo6].st.combo) || 1) - Number(m[1]));
      done.push("敌方连击-" + m[1]);
    }
    // 敌方全技能能耗 +N
    if ((m = /敌方(?:获得)?全技能能耗[+＋](\d+)/.exec(d))) {
      var fo3 = other(side);
      state[fo3].costFlat = (Number(state[fo3].costFlat) || 0) + Number(m[1]);
      done.push("敌方能耗+" + m[1]);
    }
    // 敌方 X攻-N%
    if ((m = /敌方获得(?:物攻|魔攻|双攻)[-−](\d+)%/.exec(d))) {
      addMod(other(side), "stat", -Number(m[1]));
      done.push("敌方攻-" + m[1] + "%");
    }
    // 自己获得吸血
    if ((m = /自己获得(\d+)%吸血/.exec(d))) {
      addMod(side, "drain", Number(m[1]));
      done.push("吸血+" + m[1] + "%");
    }
    // X 系技能威力永久 +N%
    if ((m = /([\u4e00-\u9fa5])系技能威力永久[+＋](\d+)%/.exec(d))) {
      addMod(side, "power", Number(m[2]));
      done.push(m[1] + "系威力+" + m[2] + "%（永久）");
    }
    if ((m = /(?:恢复|回复)(?:精灵)?(\d+)%生命/.exec(d))) {
      var st = sideStats(side);
      healSide(side, Math.round(st.stats.hp * Number(m[1]) / 100));
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
    // 速度（绝对数值）：区分「敌方获得速度-X」与「自己获得速度+X」
    if ((m = /敌方(?:获得|降低)速度[-−]\s*(\d+)/.exec(d))) {
      addMod(other(side), "speed", -Number(m[1]));
      done.push("敌方速度-" + m[1]);
    } else if ((m = /(?:自己)?获得速度[+＋]\s*(\d+)/.exec(d))) {
      addMod(side, "speed", Number(m[1]));
      done.push("速度+" + m[1]);
    }
    // 防御/魔防/双防
    if ((m = /(?:物防|魔防|双防)[+＋](\d+)%/.exec(d))) {
      addMod(side, "taken", 0); done.push("防+" + m[1] + "%（不影响伤害）");
    }
    // 敌方降属性（物防/魔防/双攻/速度）
    if ((m = /敌方获得(?:物防|魔防|双防)[-−](\d+)%/.exec(d))) {
      addMod(other(side), "stat", 0); done.push("敌方防-" + m[1] + "%（不影响伤害）");
    }
    // 连击
    if ((m = /(\d+)连击/.exec(d))) {
      var st0 = state[side].st = state[side].st || {};
      st0.combo = (Number(st0.combo) || 1) + (Number(m[1]) - 1);
      done.push("连击+" + (Number(m[1]) - 1));
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
    // 守望者：防御应对成功 → 敌方获得萌化
    if (/防御应对成功时[^。]*?敌方获得萌化/.test(d) && counterWin) {
      addBuff(other(side), "萌化", 1);
      done.push("敌方获得萌化");
    }
    // 受身：防御应对成功 → 速度 +40%
    if (/防御技能应对成功时[^。]*?速度提升(\d+)%/.test(d) && counterWin) {
      addMod(side, "speed", Math.round(sideStats(side).stats.spe * Number(/速度提升(\d+)%/.exec(d)[1]) / 100));
      done.push("速度提升");
    }
    // 马步：状态技能应对成功 → 获得 10 点能量
    if ((m = /状态技能应对成功时[^。]*?获得(\d+)点能量/.exec(d)) && counterWin) {
      gainEnergy(side, Number(m[1]));
      done.push("能量+" + m[1]);
    }
    // 灰色肖像：攻击使敌方已有减益层数 +3
    if (/攻击会使敌方已有的减益层数\+3/.test(d)) {
      ((state.buffs[other(side)]) || []).forEach(function (b7) { if (/中毒|灼烧|冻结|易伤/.test(b7.n)) b7.st = (Number(b7.st) || 1) + 3; });
      done.push("敌方减益 +3 层");
    }
    // 石天平：使用技能能耗高于敌方 → 回合结束敌方失去能耗差
    if (/若使用技能能耗高于敌方/.test(d)) {
      var meC = Number(meSkillDone && meSkillDone.c) || 0;
      var foC = Number(foeSkillDone && foeSkillDone.c) || 0;
      if (meC > foC) {
        var fo9 = other(side);
        state[fo9].energy = Math.max(0, (Number(state[fo9].energy) || 0) - (meC - foC));
        done.push("敌方能量-" + (meC - foC));
      }
    }

    // 强制过滤：在场时所有精灵连击固定为 1
    // （在 hitDamage 里读取，这里不需要处理）

    // 上锁：对手本回合使用的技能冷却 1 回合（用 costFlat 近似为下回合 +1 能耗）
    if (/对手本回合使用的技能[，,]冷却1回合/.test(d)) {
      state[other(side)].costFlat = (Number(state[other(side)].costFlat) || 0) + 1;
      done.push("敌方下回合能耗+1（冷却近似）");
    }
    // 正位宝剑 / 宝剑王牌：仅可使用 1 号位 / 1、3 号位技能（记录限制，伤害计算时提示）
    if (/仅可以使用1号位技能/.test(d)) done.push("仅可用 1 号位技能（记录）");
    if (/仅可使用1号和3号位技能/.test(d)) done.push("仅可用 1、3 号位技能（记录）");
    // 对流：能耗增加变为降低、降低变增加（记录，实际结算取反）
    if (/自己的能耗增加变为能耗降低/.test(d)) {
      state[side].costInvert = 1;
      done.push("能耗变化取反");
    }
    // 倾轧：携带技能受能耗变化影响翻倍
    if (/携带的技能受能耗变化效果的影响翻倍/.test(d)) {
      state[side].costDouble = 1;
      done.push("能耗变化翻倍");
    }
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
    if (fx) return fx(side, counterWin, sk) || "";
    // 睡眠：无法行动（挂起为下回合跳过）
    if (/无法行动/.test(String(sk.d || "")) && /睡眠/.test(String(sk.d || ""))) {
      state[other(side)].stunNext = 1;
    }
    // 「应对！XXX」是 XXX 的应对变体，效果同源：直接落回基础技能
    var baseName = String(sk.n).replace(/^应对！/, "");
    if (baseName !== sk.n) {
      if (STATUS_FX[baseName]) return STATUS_FX[baseName](side, counterWin) || "";
      var baseSkill = skillByName(baseName);
      if (baseSkill) {
        var r0 = genericStatusFx(side, Object.assign({}, baseSkill, { n: sk.n }), counterWin);
        if (r0) return r0;
      }
    }
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
        gainEnergy(side, 2, 10);
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

  // 使用技能后触发的特性（沙滩节拍/深层侵蚀/虫草多糖）
  function skillAfterTraits(side, sk, turn) {
    if (!sk) return "";
    var d = sidePet(side).td || "", out = [];
    if (sk.e === "水" && /使用水系技能后[^。]*?草系技能能耗-3/.test(d)) {
      state[side].nextGrassCost = 3;
      out.push("沙滩节拍：下次草系技能能耗-3");
    }
    if (/使用技能后[^。]*?敌方获得中毒[^。]*?中毒印记层数的2倍/.test(d)) {
      var layers = 0;
      (state.buffs[other(side)] || []).forEach(function (b) { if (b.n === "中毒印记") layers += Math.max(1, Number(b.st) || 1); });
      if (layers > 0) {
        addBuff(other(side), "中毒", layers * 2);
        out.push("深层侵蚀：敌方中毒+" + layers * 2);
      }
    }
    if (sk.e === "草" && /草系技能获得1次随机奉献/.test(d)) {
      var k = devotionRandom(side, turn);
      out.push("虫草多糖：草系随机奉献·" + (DEVOTION_LABEL[k] || k));
    }
    if (sk.e === "虫" && /虫系技能使敌方获得1层寄生/.test(d)) {
      addBuff(other(side), "寄生", 1);
      out.push("虫草多糖：敌方寄生+1");
    }
    if (sk.n === "水弹" && /使用技能水弹后[^。]*?双攻+10%[^。]*?双防-10%/.test(d)) {
      addMod(other(side), "atkMul", 10); addMod(other(side), "maMul", 10);
      addMod(other(side), "defMul", -10); addMod(other(side), "mdMul", -10);
      out.push("吐水：敌方双攻+10%、双防-10%");
    }
    if (sk.e === "草" && state[side].nextGrassCost) state[side].nextGrassCost = 0;
    return out.join("；");
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
      case "heal": healSide(side, Math.round(st.stats.hp * eff.v / 100)); break;
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
      case "healStat": healSide(side, Math.round(st.stats.hp * eff.v / 100)); addMod(side, "stat", 40); break;
      case "comboCost": state[side].costFlat = (Number(state[side].costFlat) || 0) - 1; state[side].st = state[side].st || {}; state[side].st.combo = (Number(state[side].st.combo) || 1) + 1; break;
      default: break;
    }
    out.push(label + "：" + eff.note);
    return out;
  }

  // 入场类印记：换上新精灵时，场上印记对“刚入场的那只”生效
  function applyEntryMarks(side) {
    var out = [];
    var oppMarks = state.buffs[other(side)] || [];
    var ownMarks = state.buffs[side] || [];
    function stacks(list, name) {
      var hit = list.filter(function (b) { return b.n === name; })[0];
      return hit ? (Number(hit.st) || 1) : 0;
    }
    var st = sideStats(side), hp = st.stats.hp;
    var thorn = stacks(oppMarks, "棘刺印记");       // 敌方印记：我方换上来的掉血
    if (thorn > 0) {
      var d1 = Math.max(1, Math.round(hp * 0.06 * thorn));
      state[side].hp = Math.max(1, state[side].hp - d1);
      out.push("棘刺印记 -" + d1);
    }
    var sharp = stacks(oppMarks, "锐利印记");
    if (sharp > 0) {
      var d2 = Math.max(1, Math.round(hp * 0.08 * sharp));
      state[side].hp = Math.max(1, state[side].hp - d2);
      out.push("锐利印记 -" + d2);
    }
    var drop = stacks(oppMarks, "降灵印记");
    if (drop > 0) {
      state[side].energy = Math.max(0, (Number(state[side].energy) || 0) - drop);
      out.push("降灵印记 能量-" + drop);
    }
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
    // 洁癖：自己的增益/减益由换入的精灵继承（状态本就跟着槽位，这里只做提示）
    if (/离场后，自己的增益和减益会被更换入场的精灵继承/.test(d)) {
      out.push(leavingPet.t + "：离场 → 换上的继承全部状态");
    }
    // 珊瑚骨：敌方离场时自己能耗-3（由对手离场触发，这里不处理）
    if (/离场时回复(\d+)能量/.test(d)) {
      gainEnergy(side, Number(/离场时回复(\d+)能量/.exec(d)[1]), 10);
      out.push(leavingPet.t + "：离场 → 回能 +" + /离场时回复(\d+)能量/.exec(d)[1]);
    }
    if (/离场后，更换入场的精灵回复(\d+)%生命/.test(d)) {
      var stL = sideStats(side);
      var hvL = Math.round(stL.stats.hp * Number(/回复(\d+)%生命/.exec(d)[1]) / 100);
      healSide(side, hvL);
      out.push(leavingPet.t + "：换上的回血 +" + hvL);
    }
    // 孤傲：敌方精灵离场后，其增益和减益由更换入场的精灵继承
    (function () {
      var foeTd = sidePet(other(side)).td || "";
      if (!/敌方精灵离场后，其增益和减益会被更换入场的精灵继承/.test(foeTd)) return;
      var foeSide = other(side);
      var carried = (state.buffs[foeSide] || []).slice();
      state[side].inheritedBuffs = carried;
      out.push("孤傲 → 敌方把 " + carried.length + " 个状态带给了换上的精灵");
    })();
    // 木桶戏法：换上的精灵以木桶状态登场（模型为下回合无法行动）
    if (/离场后，更换入场的精灵以木桶状态登场/.test(d)) {
      state[side].barrelNext = 1;
      out.push(leavingPet.t + "：换上的以木桶状态登场（下回合任何行动都跳过）");
    }
    // 茶多酚：换上的精灵免疫寄生
    if (/离场后[^。]*?免疫寄生/.test(d)) {
      state[side].immuneParasite = 1;
      out.push(leavingPet.t + "：换上的免疫寄生");
    }
    if (/免疫冻结/.test(d)) out.push("换上来的免疫冻结");
    if (/免疫灼烧/.test(d)) out.push("换上来的免疫灼烧");
    return out;
  }

  function entryTraits(side) {
    var pet = sidePet(side), d = pet.td || "", out = [], m;
    out = out.concat(applyEntryTrait(side));
    if (!d) return out;
    // 结晶水：初始能量 0，入场前己方每放 1 次冰系技能回 3 能量
    if (/初始能量为0[^。]*?冰系技能[^。]*?回复3能量/.test(d)) {
      var iceN = Number(state[side].iceBeforeEntry) || 0;
      state[side].energy = Math.min(energyCap(side), iceN * 3);
      out.push(pet.t + "：入场能量 " + state[side].energy + "（己方冰系技能 " + iceN + " 次）");
    }
    // 圣龙的心愿：己方每用 1 次能耗 3 的技能，入场前等级 +2
    if (/每使用1次能耗为3的技能[^。]*?入场前等级+2/.test(d)) {
      var c3 = Number(state[side].cost3Uses) || 0;
      state[side].level = Math.min(100, (Number(state[side].level) || 60) + c3 * 2);
      out.push(pet.t + "：入场等级 +" + c3 * 2 + "（能耗3技能 " + c3 + " 次）");
      if (state[side].level < 80 && !state[side].holyWishTaken) { state[side].holyWishTaken = 1; addMod(side, "taken", 30); }
    }
    // 恶龙的奢望：初始等级 +39（只加一次）
    if (/初始等级+39[^。]*?回合结束时等级-10/.test(d) && !state[side].dragonInit) {
      state[side].dragonInit = 1;
      state[side].level = Math.min(100, (Number(state[side].level) || 60) + 39);
      out.push(pet.t + "：初始等级 +39 → " + state[side].level);
    }
    // 盗魂铃：初始能量 0，首次入场前敌方每聚能 1 次回 5 能量（可突破上限）
    if (/首次入场前敌方每聚能1次，回复5能量/.test(d) && !state[side].soulBellUsed) {
      var chargeN = Number(state[other(side)].chargeCount) || 0;
      state[side].energy = Math.min(99, chargeN * 5);
      state[side].soulBellUsed = 1;
      out.push(pet.t + "：首次入场 → 能量 " + state[side].energy + "（敌方已聚能 " + chargeN + " 次）");
    }
    // 地脉 / 地脉馈赠 / 打雪仗 / 散热：初始能量为 0，入场前己方每放 1 次 X 系技能回 3 能量
    if ((m = /初始能量为0[^。]*?每放1次([\u4e00-\u9fa5])系技能[^。]*?回复(\d+)能量/.exec(d))) {
      var priorUse = Number((((state[side].used || {}).el || {})[m[1]]) || 0);
      var extraEntry = /突破能量上限并立即回复(\d+)能量/.exec(d);
      var entryGain = priorUse * Number(m[2]) + (extraEntry ? Number(extraEntry[1]) : 0);
      var entryCap = /突破能量上限/.test(d) ? 99 : energyCap(side);
      state[side].energy = Math.min(entryCap, entryGain);
      out.push(pet.t + "：入场 → 能量 " + state[side].energy + "（" + m[1] + "系已用 " + priorUse + " 次）");
    }
    // 守护者：己方其他精灵每有 1 层萌化，入场时全技能能耗 -1
    if (/己方其他精灵每有1层萌化[^。]*?全技能能耗[-−]1/.test(d)) {
      // 按自己 6 个槽位（含替补）当前萌化层数统计
      var moeT = 0;
      (state[side].slotMoe || []).forEach(function (n2, i2) {
        if (i2 !== state[side].active) moeT += Number(n2) || 0;
      });
      if (moeT > 0) {
        state[side].costFlat = (Number(state[side].costFlat) || 0) - moeT;
        out.push(pet.t + "：入场 → 全技能能耗-" + moeT + "（累计萌化 " + moeT + " 层）");
      }
    }
    // 翻垃圾桶：空技能位变为敌方最近使用过的技能，且该技能能耗 -2
    if (/入场时自己未携带的技能位置会变为敌方最近使用过的技能/.test(d)) {
      var lastFoeSkill = state[other(side)].lastUsedSkill;
      if (lastFoeSkill) {
        var mvF = state[side].moves || [];
        var filled = 0;
        for (var iF = 0; iF < 4; iF++) {
          if (!mvF[iF]) { mvF[iF] = lastFoeSkill; filled += 1; }
        }
        if (filled > 0) {
          state[side].skillCost = state[side].skillCost || {};
          state[side].skillCost[lastFoeSkill] = (Number(state[side].skillCost[lastFoeSkill]) || 0) - 2;
          out.push(pet.t + "：空技能位变为 " + lastFoeSkill + "（能耗-2）");
        }
      }
    }
    // 盘根木：初始生命 10%，入场前己方每用 1 次草系技能回复 30% 生命
    if (/初始生命为10%/.test(d) && (m = /每使用1次([\u4e00-\u9fa5])系技能[^。]*?回复(\d+)%生命/.exec(d))) {
      var priorGrass = Number((((state[side].used || {}).el || {})[m[1]]) || 0);
      var stR = sideStats(side);
      var hpPct = 0.1 + priorGrass * Number(m[2]) / 100;
      state[side].hp = Math.max(1, Math.min(stR.stats.hp, Math.round(stR.stats.hp * hpPct)));
      out.push(pet.t + "：入场 → 生命 " + Math.round(hpPct * 100) + "%（" + m[1] + "系已用 " + priorGrass + " 次）");
    }
    // 水翼推进：己方每使用 1 次水系技能，入场时全技能能耗 -1
    if ((m = /每使用1次([\u4e00-\u9fa5])系技能[^。]*?入场时获得全技能能耗[-−](\d+)/.exec(d))) {
      var priorEl = Number((((state[side].used || {}).el || {})[m[1]]) || 0);
      if (priorEl > 0) {
        state[side].costFlat = (Number(state[side].costFlat) || 0) - priorEl * Number(m[2]);
        out.push(pet.t + "：入场 → 全技能能耗-" + (priorEl * Number(m[2])) + "（" + m[1] + "系已用 " + priorEl + " 次）");
      }
    }
    // 慢热型：每成功应对 1 次，入场回 5 能量
    if ((m = /每成功应对1次[^。]*?回复(\d+)能量/.exec(d))) {
      var ctrEntry = Number((state.counters || {}).counter) || 0;
      state[side].energy = Math.min(energyCap(side), ctrEntry * Number(m[1]));
      out.push(pet.t + "：入场 → 能量 " + state[side].energy + "（已应对 " + ctrEntry + " 次）");
    }
    if ((m = /每入场1次[^。]*?双攻(?:永久)?\+(\d+)%/.exec(d))) {
      addMod(side, "stat", Number(m[1]));
      out.push(pet.t + "：入场 → 双攻+" + m[1] + "%");
    }
    // 入场时偷取敌方能量（大捞一笔 / 小偷小摸）
    if ((m = /入场时偷取敌方[^。]*?(\d+)能量/.exec(d))) {
      var foT = other(side);
      var takeT = Math.min(Number(m[1]), Number(state[foT].energy) || 0);
      state[foT].energy = Math.max(0, (Number(state[foT].energy) || 0) - takeT);
      gainEnergy(side, takeT, 10);
      out.push(pet.t + "：入场 → 偷取敌方能量 " + takeT);
    }
    // 首次入场时失去一半当前生命（铃兰晚钟）
    if (/首次入场时[^。]*?失去自己一半的当前生命/.test(d)) {
      state[side].hp = Math.max(1, Math.round(state[side].hp / 2));
      out.push(pet.t + "：入场 → 失去一半当前生命");
    }
    // 入场上限里「每携带 1 个 X 系技能 → 对应系能耗-N」（消波块）
    if ((m = /每携带1个([\u4e00-\u9fa5])系技能进入战斗[^。]*?([\u4e00-\u9fa5])系技能能耗[-−](\d+)/.exec(d))) {
      var cntX = (state[side].moves || []).filter(function (nm) { var k = nm ? skillByName(nm) : null; return k && k.e === m[1]; }).length;
      if (cntX > 0) {
        state[side].costByEl = state[side].costByEl || {};
        state[side].costByEl[m[2]] = (Number(state[side].costByEl[m[2]]) || 0) - Number(m[3]) * cntX;
        out.push(pet.t + "：" + m[2] + "系能耗-" + (Number(m[3]) * cntX));
      }
    }
    // 自己入场时敌方获得 N 层冻结（抓到你了）
    if ((m = /自己入场时敌方获得(\d+)层冻结/.exec(d))) {
      addBuff(other(side), "冻结", Number(m[1]));
      out.push(pet.t + "：入场 → 敌方冻结+" + m[1]);
    }
    // 入场获得吸血（贪得无厌）
    if ((m = /入场时获得(\d+)%吸血/.exec(d))) {
      addMod(side, "drain", Number(m[1]));
      out.push(pet.t + "：入场 → 吸血+" + m[1] + "%");
    }
    if (/入场时[^。]*?复制敌方的增益/.test(d)) {
      ((state.buffs[other(side)]) || []).forEach(function (b) {
        if (b.n.indexOf("印记") < 0 && !/中毒|灼烧|冻结|易伤/.test(b.n)) addBuff(side, b.n, Number(b.st) || 1);
      });
      out.push(pet.t + "：入场 → 复制敌方增益");
    }
    if (/入场时[^。]*?物攻\+100%/.test(d)) {
      addMod(side, "stat", 100);
      out.push(pet.t + "：入场 → 物攻+100%");
    }

    if ((m = /若自己魔力值为1[^。]*?双攻\+(\d+)%/.exec(d)) && Number(state[side].mana) === 1) {
      addMod(side, "stat", Number(m[1]));
      out.push(pet.t + "：魔力值为1 → 双攻+" + m[1] + "%");
    }
    return out;
  }

  // ---- 机制型特性：使用技能后给对方上状态（不依赖数值） ----
  function applyOnHitTraits(side, sk, dealt) {
    var pet = sidePet(side), d = pet.td || "", fo = other(side), out = [], m;
    if (!d || !sk) return out;
    // 高浓生物碱：使用技能时，敌方获得 2 层中毒
    if ((m = /使用技能时，敌方获得(\d+)层中毒/.exec(d))) {
      addBuff(fo, "中毒", Number(m[1]));
      out.push(pet.t + "：敌方中毒+" + m[1]);
    }
    // 毒腺：使用能耗 ≤1 的技能时，敌方获得 4 层中毒
    if ((m = /使用能耗小于等于1的技能时[^。]*?敌方获得(\d+)层中毒/.exec(d)) && Number(sk.c) <= 1) {
      addBuff(fo, "中毒", Number(m[1]));
      out.push(pet.t + "：低耗能 → 敌方中毒+" + m[1]);
    }
    // 灵魂灼伤：冰系技能 → 4 层灼烧；火系技能 → 2 层冻结
    if ((m = /冰系技能使敌方获得(\d+)层灼烧[^。]*?火系技能使敌方获得(\d+)层冻结/.exec(d))) {
      if (sk.e === "冰") { addBuff(fo, "灼烧", Number(m[1])); out.push(pet.t + "：冰系 → 敌方灼烧+" + m[1]); }
      else if (sk.e === "火") { addBuff(fo, "冻结", Number(m[2])); out.push(pet.t + "：火系 → 敌方冻结+" + m[2]); }
    }
    // 扩散侵蚀：使用水系技能后，敌方中毒层数 = 中毒印记层数 × 2
    if (/使用水系技能后[^。]*?中毒印记层数的2倍/.test(d) && sk.e === "水") {
      var pmSt = stackOf(fo, "中毒印记");
      if (pmSt > 0) { addBuff(fo, "中毒", pmSt * 2); out.push(pet.t + "：水系 → 敌方中毒+" + (pmSt * 2)); }
    }
    // 月牙雪糕：攻击时，敌方每有 1 层冻结 → 1 层星陨印记
    if (/使用攻击技能时[^。]*?每有1层冻结[^。]*?获得1层星陨印记/.test(d) && sk.p) {
      var fzSt = stackOf(fo, "冻结");
      if (fzSt > 0) { addBuff(fo, "星陨印记", fzSt); out.push(pet.t + "：冻结 " + fzSt + " 层 → 星陨+" + fzSt); }
    }
    // 贪心算法：1 号位技能使用后，敌方获得 6 层灼烧
    if ((m = /1号位技能[^。]*?使用后使敌方获得(\d+)层灼烧/.exec(d)) && (state[side].moves || [])[0] === sk.n) {
      addBuff(fo, "灼烧", Number(m[1]));
      out.push(pet.t + "：1 号位 → 敌方灼烧+" + m[1]);
    }
    // 泛音列：使用状态技能后，敌方获得「聒噪」（攻击技能能耗 +2，持续 3 回合）
    if (sk.t === "状态" && /使用状态技能后[^。]*?聒噪/.test(d)) {
      state[fo].noisy = 3;
      out.push(pet.t + "：敌方获得聒噪（攻击技能能耗+2，3 回合）");
    }
    // 爆裂玉米：草系技能 → 4 层灼烧；火系技能 → 1 层寄生
    if ((m = /草系技能使敌方获得(\d+)层灼烧[^。]*?火系技能使敌方获得(\d+)层寄生/.exec(d))) {
      if (sk.e === "草") { addBuff(fo, "灼烧", Number(m[1])); out.push(pet.t + "：草系 → 敌方灼烧+" + m[1]); }
      else if (sk.e === "火") { addBuff(fo, "寄生", Number(m[2])); out.push(pet.t + "：火系 → 敌方寄生+" + m[2]); }
    }
    // 与星星同行：攻击时，敌方所有印记变为相同总层数的星陨印记
    if (/攻击时，将敌方所有印记变为相同层数的星陨印记/.test(d) && sk.p) {
      var markList = (state.buffs[fo] || []).filter(function (b) { return /印记/.test(b.n); });
      var totalMark = markList.reduce(function (a, b) { return a + Math.max(1, Number(b.st) || 1); }, 0);
      if (totalMark > 0) {
        state.buffs[fo] = (state.buffs[fo] || []).filter(function (b) { return !/印记/.test(b.n); });
        addBuff(fo, "星陨印记", totalMark);
        out.push(pet.t + "：印记 → 星陨 " + totalMark + " 层");
      }
    }
    // 盛宴：生命低于 50% 时获得 100% 吸血（本次伤害直接回血）
    if (dealt > 0 && /生命低于50%时[^。]*?吸血100%/.test(d)) {
      var stS = sideStats(side);
      if (state[side].hp / stS.stats.hp < 0.5) {
        var healS = Math.min(stS.stats.hp - state[side].hp, dealt);
        state[side].hp += healS;
        out.push(pet.t + "：低血吸血 +" + healS);
      }
    }
    // 滴眼液：雨天使用水系攻击技能时吸血 50%
    if (dealt > 0 && state.weather === "rain" && sk.e === "水" && sk.p &&
        /天气为雨天时[^。]*?水系攻击技能时吸血50%/.test(d)) {
      var stD = sideStats(side);
      var healD = Math.min(stD.stats.hp - state[side].hp, Math.round(dealt * 0.5));
      state[side].hp += healD;
      out.push(pet.t + "：雨天水系吸血 +" + healD);
    }
    return out;
  }

  // 应对成功后的机制型特性；腾挪/保卫/好象坏象 达到次数后变棋绮后
  function transformToChess(side) {
    var target = PETS.filter(function (x) { return /^棋绮后/.test(x.n); })[0];
    if (!target) return null;
    var before = sidePet(side).n;
    state[side].slots[state[side].active] = target.n;
    var st = sideStats(side);
    state[side].hp = st.stats.hp;
    state[side].energy = energyCap(side);
    state[side].counterProgress = { attack: 0, defense: 0, status: 0 };
    autofillMoves(side, true);
    return before + " → " + target.n + "（回满生命/能量）";
  }

  function applyCounterTraits(side, sk, won) {
    var pet = sidePet(side), d = pet.td || "", out = [], m;
    if (!won || !sk) return out;
    // 擒拿：攻击技能应对成功时，回复 25% 生命
    if (/攻击技能应对成功时，回复25%生命/.test(d) && (sk.t === "物攻" || sk.t === "魔攻")) {
      var stQ = sideStats(side);
      var healQ = Math.round(stQ.stats.hp * 0.25);
      healSide(side, healQ);
      out.push(pet.t + "：攻击应对成功 → 回血 " + healQ);
    }
    // 圣火骑士：应对成功后，下次攻击威力翻倍
    if (/应对成功后，下次攻击威力翻倍/.test(d)) {
      state[side].pending = state[side].pending || {};
      state[side].pending.power = (Number(state[side].pending.power) || 0) + 100;
      out.push(pet.t + "：应对成功 → 下次攻击威力+100%");
    }
    // 思维之盾：应对成功后，下次行动技能能耗 -5
    if (/应对成功后，下次行动技能能耗[-−]5/.test(d)) {
      state[side].pending = state[side].pending || {};
      state[side].pending.cost = (Number(state[side].pending.cost) || 0) - 5;
      out.push(pet.t + "：应对成功 → 下次技能能耗-5");
    }
    // 腾挪 / 保卫 / 好象坏象
    var rules = [
      { re: /攻击技能应对1次后/, key: "attack", need: 1 },
      { re: /防御技能应对2次后/, key: "defense", need: 2 },
      { re: /状态技能应对1次后/, key: "status", need: 1 }
    ];
    var type = sk.t === "物攻" || sk.t === "魔攻" ? "attack" : sk.t === "防御" ? "defense" : "status";
    for (var i = 0; i < rules.length; i++) {
      if (!rules[i].re.test(d)) continue;
      state[side].counterProgress = state[side].counterProgress || { attack: 0, defense: 0, status: 0 };
      var prog = state[side].counterProgress;
      if (type === rules[i].key) prog[type] = (Number(prog[type]) || 0) + 1;
      if ((Number(prog[type]) || 0) >= rules[i].need) {
        var msg = transformToChess(side);
        if (msg) out.push(pet.t + "：" + msg);
      }
    }
    return out;
  }

  // 敌方离场时，自己（未离场方）的特性对“换上来的那只”生效
  function applyEnemyLeaveTraits(side, leavingPet) {
    var pet = sidePet(side), d = pet.td || "", out = [], m;
    if (!d) return out;
    var fo = other(side), incoming = sidePet(fo);
    // 做噩梦：换上的失去 3 能量
    if ((m = /敌方精灵离场后[^。]*?更换入场的精灵失去(\d+)能量/.exec(d))) {
      state[fo].energy = Math.max(0, (Number(state[fo].energy) || 0) - Number(m[1]));
      out.push(pet.t + "：敌方换人 → " + incoming.n + " 失去 " + m[1] + " 能量");
    }
    // 下黑手：换上的获得 5 层中毒
    if ((m = /敌方精灵离场后[^。]*?更换入场的精灵获得(\d+)层中毒/.exec(d))) {
      addBuff(fo, "中毒", Number(m[1]));
      out.push(pet.t + "：敌方换人 → " + incoming.n + " 中毒+" + m[1]);
    }
    // 珊瑚骨：敌方离场时，自己全技能能耗 -3
    if (/敌方精灵离场时，自己获得全技能能耗[-−](\d+)/.test(d)) {
      var cut = Number(/敌方精灵离场时，自己获得全技能能耗[-−](\d+)/.exec(d)[1]);
      state[side].costFlat = (Number(state[side].costFlat) || 0) - cut;
      out.push(pet.t + "：敌方离场 → 自己全技能能耗-" + cut);
    }
    // 孤傲：离场方的增益/减益由换入的继承（状态本就跟随槽位，这里只记录）
    if (/敌方精灵离场后，其增益和减益会被更换入场的精灵继承/.test(d)) {
      out.push(pet.t + "：敌方状态由换入精灵继承");
    }
    return out;
  }

  // 巧变：使用后变为同系别的随机技能（能耗 -1），使用该产物后还原原技能
  function morphCategoryFor(side, sk) {
    var mineP = sidePet("mine"), foeP = sidePet("foe");
    var allTd = (mineP.t || "") + (mineP.td || "") + (foeP.t || "") + (foeP.td || "");
    if (/魔术帽/.test(allTd)) return "same_element";
    var ownP = sidePet(side);
    var ownTd = (ownP.t || "") + (ownP.td || "");
    if (/换碟/.test(ownTd) && ["音波弹", "音爆", "金属噪音", "午夜噪音"].indexOf(sk.n) >= 0) return "same_element";
    return null;
  }

  function morphSkillAfterUse(side, sk) {
    if (!sk) return "";
    var st = state[side];
    st.morphOrigin = st.morphOrigin || {};
    var slot = (st.moves || []).indexOf(sk.n);
    if (slot < 0) return "";
    // 用的是巧变产物 → 还原
    if (st.morphOrigin[slot]) {
      var original = st.morphOrigin[slot];
      st.moves[slot] = original;
      delete st.morphOrigin[slot];
      return "巧变结束 → 还原「" + original + "」";
    }
    var catM = morphCategoryFor(side, sk);
    var pool = (window.SKILLS || []).filter(function (x) {
      return x.e === sk.e && x.n !== sk.n && x.p;
    });
    if (!catM) return "";
    if (!pool.length) return "";
    var seed = (Number(state.seed) || 1) + slot * 7 + (Number(state.history.length) || 0) * 13 + (side === "mine" ? 1 : 2);
    var pick = pool[Math.abs(seed) % pool.length];
    st.moves[slot] = pick.n;
    st.morphOrigin[slot] = sk.n;
    st.skillCost = st.skillCost || {};
    st.skillCost[pick.n] = (Number(st.skillCost[pick.n]) || 0) - 1;
    return "巧变 → 「" + pick.n + "」（能耗-1）";
  }

  function clearMorphs() {
    var out = [];
    ["mine", "foe"].forEach(function (sd) {
      var st = state[sd];
      if (!st.morphOrigin) return;
      Object.keys(st.morphOrigin).forEach(function (slot) {
        var original = st.morphOrigin[slot];
        st.moves[Number(slot)] = original;
        delete st.morphOrigin[slot];
        out.push((sd === "mine" ? "我" : "敌") + " 博物：解除巧变，还原「" + original + "」");
      });
    });
    return out;
  }

  // 铭记于月亮：击败对方后获得其特性
  function stealTalent(winnerSide) {
    var w = state[winnerSide];
    if (!/获得自己击败的精灵的特性/.test(sidePet(winnerSide).td || "")) return "";
    var lost = sidePet(other(winnerSide));
    if (!lost || !lost.t) return "";
    w.stolenTalent = { t: lost.t, td: lost.td || "" };
    return "铭记于月亮：获得 " + lost.n + " 的特性「" + lost.t + "」";
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

    state.mine.hp0 = state.mine.hp;
    state.foe.hp0 = state.foe.hp;
    var before = {
      mineHp: state.mine.hp, foeHp: state.foe.hp,
      mineEnergy: state.mine.energy, foeEnergy: state.foe.energy,
      mineMana: state.mine.mana, foeMana: state.foe.mana
    };
    ["mine", "foe"].forEach(function (sd) {
      state[sd].energyAtTurnStart = Number(state[sd].energy) || 0;
      state[sd].chargeAtTurnStart = Number(state[sd].chargeCount) || 0;
    });
    // 机械变式：技能位置变化 → 该技能能耗永久 -1（按上一次记录时的位置比较）
    var moveShiftMsgs = [];
    // 盲拧：回合开始时技能顺序打乱
    ["mine", "foe"].forEach(function (sd) {
      if (!/回合开始时，技能顺序打乱/.test(sidePet(sd).td || "")) return;
      var arrM = (state[sd].moves || []).slice();
      if (arrM.length < 2) return;
      var seedM = (Number(state.seed) || 1) + (Number(state.history.length) || 0) * 19 + (sd === "mine" ? 3 : 7);
      for (var iM = arrM.length - 1; iM > 0; iM--) {
        var jM = Math.abs(seedM + iM * 17) % (iM + 1);
        var tmpM = arrM[iM]; arrM[iM] = arrM[jM]; arrM[jM] = tmpM;
      }
      state[sd].moves = arrM;
      moveShiftMsgs.push((sd === "mine" ? "我" : "敌") + " 盲拧：技能顺序打乱");
    });
    ["mine", "foe"].forEach(function (sd) {
      var curMv = (state[sd].moves || []).slice();
      var prevMv = state[sd].moveSnapshot;
      if (prevMv && prevMv.length && /若回合内自己携带的技能位置发生变化/.test(sidePet(sd).td || "")) {
        curMv.forEach(function (nm, idx) {
          if (!nm) return;
          var oldIdx = prevMv.indexOf(nm);
          if (oldIdx >= 0 && oldIdx !== idx) {
            state[sd].skillCost = state[sd].skillCost || {};
            state[sd].skillCost[nm] = (Number(state[sd].skillCost[nm]) || 0) - 1;
            moveShiftMsgs.push((sd === "mine" ? "我" : "敌") + " 机械变式：" + nm + " 换位 → 能耗-1");
          }
        });
      }
      state[sd].moveSnapshot = curMv;
    });
    var meAct = ($("meAction") && $("meAction").value) || "attack";
    var foeAct = ($("foeActionRec") && $("foeActionRec").value) || "attack";
    var meMove = ($("meMoveSel") && $("meMoveSel").value) || "";
    var foeMove = ($("foeMoveSel") && $("foeMoveSel").value) || "";
    var koSide = ($("koSide") && $("koSide").value) || "";
    var foeForced = !!($("foeForced") && $("foeForced").value === "1");
    var stratId = ($("stratSel") && $("stratSel").value) || "";
    var strat = STRATS.filter(function (x) { return x.id === stratId; })[0] || null;

    var forcedMe = false, forcedFoe = false;
    // 威慑：被打断的技能进入 2 回合冷却（每回合开始递减）
    ["mine", "foe"].forEach(function (sd) {
      var cd = state[sd].cooldown;
      if (!cd) return;
      Object.keys(cd).forEach(function (k) {
        cd[k] = Math.max(0, (Number(cd[k]) || 0) - 1);
        if (!cd[k]) delete cd[k];
      });
    });
    // 连续负荷：上回合挂起的迸发附effect，本回合再结算 1 次
    ["mine", "foe"].forEach(function (sd) {
      if (!state[sd].burstLingerSkill) return;
      if (!/自己技能的迸发效果延长1回合/.test(sidePet(sd).td || "")) { state[sd].burstLingerSkill = null; return; }
      var bSk = skillByName(state[sd].burstLingerSkill);
      if (bSk) {
        var bMsg = burstRiders(sd, bSk);
        if (bMsg) state[sd].burstRiderMsg = (sd === "mine" ? "我" : "敌") + " 连续负荷：" + bMsg;
      }
      state[sd].burstLingerSkill = null;
    });
    // 正模标本：场下精灵在力竭 1 回合后变为未完虫（近似）
    ["mine", "foe"].forEach(function (sd) {
      if (Number(state[sd].specimenPending) > 0) {
        state[sd].specimenPending = Number(state[sd].specimenPending) - 1;
        if (state[sd].specimenPending === 0) {
          var slotsS = state[sd].slots || [];
          var idxS = Number(state[sd].specimenSlot);
          if (!(idxS >= 0 && idxS < slotsS.length)) idxS = -1;
          if (idxS >= 0) {
            slotsS[idxS] = "未完虫";
            var pS = byName("未完虫") || PETS[0];
            var natureS = NATURES.filter(function (n) { return n.n === state[sd].nature; })[0] || null;
            var stS = computeStats(pS, { level: state[sd].level, stars: state[sd].star, iv: state[sd].iv, nature: natureS });
            var benchS = ensureBench(sd);
            benchS[idxS] = { hp: stS.hp, max: stS.hp, energy: 0 };
            state[sd].benchKey = null;
            if (idxS === state[sd].active) state[sd].hp = stS.hp;
            state[sd].specimenMsg = (sd === "mine" ? "我" : "敌") + " 正模标本：力竭的 " + (state[sd].specimenSlotName || "精灵") + " 变为未完虫";
          }
          state[sd].specimenSlot = null;
          state[sd].specimenSlotName = null;
        }
      }
    });
    // 不朽：力竭 4 回合后复活（倒计时在回合开始递减）
    ["mine", "foe"].forEach(function (sd) {
      if (Number(state[sd].reviveIn) > 0) {
        state[sd].reviveIn = Number(state[sd].reviveIn) - 1;
        if (state[sd].reviveIn === 0) {
          var stR = sideStats(sd);
          state[sd].hp = stR.stats.hp;
          state[sd].reviveMsg = (sd === "mine" ? "我" : "敌") + " 不朽：复活（回满生命）";
        } else {
          state[sd].reviveMsg = (sd === "mine" ? "我" : "敌") + " 不朽：复活倒计时 " + state[sd].reviveIn;
        }
      }
    });
    state.mine.prevHp = state.mine.hp;
    state.foe.prevHp = state.foe.hp;
    // 实际执行结果（不是下拉意图）：动作 + 招式 + 打出的伤害
    var meActDone = "", foeActDone = "", meSkillDone = null, foeSkillDone = null, meHitDone = 0, foeHitDone = 0;
    var meSk = meMove ? skillByName(meMove) : null;
    var foeSk = foeMove ? skillByName(foeMove) : null;
    var dmgToFoe = 0, dmgToMe = 0;
    var chargeLog = "";
    var releasedMe = false, releasedFoe = false;

    // 上一回合蓄力的技能，本回合自动释放（不消耗额外操作）
    state.charging = state.charging || { mine: null, foe: null };
    state.noCharge = { mine: false, foe: false }; // 每回合重置，避免「无需蓄力」永久生效
    state.chargeMeta = state.chargeMeta || { mine: null, foe: null };
    if (state.charging.mine) {
      var c1 = skillByName(state.charging.mine);
      // 嫉妒：蓄力状态下可以使用任一携带技能（选了别的技能就先用它，蓄力保留）
      var jealousMine = /蓄力状态下，可以使用任一携带技能/.test(sidePet("mine").td || "");
      if (jealousMine && meMove && c1 && meMove !== c1.n) {
        chargeLog = "我 嫉妒：蓄力中改用「" + meMove + "」，蓄力保留";
      } else {
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
    }
    if (state.charging.foe) {
      var c2 = skillByName(state.charging.foe);
      var jealousFoe = /蓄力状态下，可以使用任一携带技能/.test(sidePet("foe").td || "");
      if (jealousFoe && foeMove && c2 && foeMove !== c2.n) {
        chargeLog = (chargeLog ? chargeLog + "；" : "") + "敌 嫉妒：蓄力中改用「" + foeMove + "」，蓄力保留";
      } else {
        state.charging.foe = null;
        if (c2) { foeMove = c2.n; foeSk = c2; foeAct = "attack"; releasedFoe = true; chargeLog = (chargeLog ? chargeLog + "；" : "") + "敌 蓄力完成：" + c2.n; }
      }
    }

    function isAttackSkill(x) { return !!x && (x.t === "物攻" || x.t === "魔攻"); }
    function canUseSkill(sd, sk) {
      if (sk && state[sd].cooldown && Number(state[sd].cooldown[sk.n]) > 0) return false; // 威慑冷却
      return (Number(state[sd].energy) || 0) >= costOf(sd, sk);
    }
    var counterWinMe = meAct === "counter" && foeAct === "attack" && canUseSkill("foe", foeSk) && meSk && foeSk && (
      (meSk.t === "防御" && isAttackSkill(foeSk)) ||
      (isAttackSkill(meSk) && foeSk.t === "状态") ||
      (meSk.t === "状态" && foeSk.t === "防御"));
    // 野性感官：自己应对成功 → 下次行动先手 +1
    if (counterWinMe && /应对成功后[^。]*?先手\+1/.test((sidePet("mine").td || ""))) {
      state.mine.priority = (Number(state.mine.priority) || 0) + 1;
    }
    if (counterWinFoe && /应对成功后[^。]*?先手\+1/.test((sidePet("foe").td || ""))) {
      state.foe.priority = (Number(state.foe.priority) || 0) + 1;
    }
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
    function applyChoiceOpt(sd, opt) {
      if (!opt) return;
      var pmC = /威力\+(\d+)(?!%)/.exec(opt);
      if (pmC) state[sd].choicePower = (Number(state[sd].choicePower) || 0) + Number(pmC[1]);
      var smC = /(物攻|魔攻|双攻|物防|魔防|速度)[+＋](\d+)%/.exec(opt);
      if (smC) addMod(sd, "stat", Number(smC[2]));
      var emC = /敌方获得(\d+)层([\u4e00-\u9fa5]+)/.exec(opt);
      if (emC) addBuff(other(sd), emC[2], Number(emC[1]));
    }
    if (meSk && meSk.p) {
      var opts = choiceOptions(meSk);
      if (opts.length && choiceName !== "") {
        var opt = opts[Number(choiceName)] || "";
        choiceLog = opt;
        applyChoiceOpt("mine", opt);
        var tdCh = sidePet("mine").td || "";
        // 一意孤行 / 有求必应 / 或：选择效果额外结算 1 次
        var extraChoice = null;
        if (/使用「选择」技能后，会额外使用1次相同的「选择」效果/.test(tdCh)) extraChoice = "same";
        else if (/使用「选择」技能后，会额外使用1次另一种「选择」效果/.test(tdCh)) extraChoice = "other";
        else if (/使用「选择」技能后[^。]*?会额外使用1次「选择」效果/.test(tdCh)) extraChoice = "same";
        if (extraChoice === "same") {
          applyChoiceOpt("mine", opt);
          choiceLog += "（额外再结算 1 次）";
        } else if (extraChoice === "other" && opts.length > 1) {
          var otherOpt = opts[(Number(choiceName) + 1) % opts.length];
          applyChoiceOpt("mine", otherOpt);
          choiceLog += "（" + otherOpt + "）";
        }
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
    if (!releasedMe && meAct === "attack" && meSk && isChargeSkill(meSk) && !state.noCharge.mine && !state.mine.freeChargeNext) {
      state.charging.mine = meSk.n;
      state.chargeMeta.mine = { hit: false, foePower: 0 };
      // 洄游：每次进入蓄力状态，全技能能耗永久 -2
      if (/每次进入蓄力状态[^。]*?全技能能耗永久[-−](\d+)/.test(sidePet("mine").td || "")) {
        var roveCut = Number(/每次进入蓄力状态[^。]*?全技能能耗永久[-−](\d+)/.exec(sidePet("mine").td)[1]);
        state.mine.costFlat = (Number(state.mine.costFlat) || 0) - roveCut;
      }
      chargeLog = (chargeLog ? chargeLog + "；" : "") + "我 开始蓄力：" + meSk.n;
      meAct = "charge";
    }
    if (!releasedFoe && foeAct === "attack" && foeSk && isChargeSkill(foeSk) && !state.noCharge.foe && !state.foe.freeChargeNext) {
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
    moveShiftMsgs.forEach(function (msg) { statusLog.push(msg); });
    // 游戏的本质：第一回合入场时抽点（只抽一次）；常驻效果在抽点时套用
    if (!gamesEssencePoint()) {
      ["mine", "foe"].forEach(function (sd) {
        var msg = rollGamesEssence(sd);
        if (msg) statusLog.push((sd === "mine" ? "我 " : "敌 ") + msg);
      });
    }
    ["mine", "foe"].forEach(function (sd) {
      if (state[sd].reviveMsg) { statusLog.push(state[sd].reviveMsg); state[sd].reviveMsg = null; }
      if (state[sd].specimenMsg) { statusLog.push(state[sd].specimenMsg); state[sd].specimenMsg = null; }
      if (state[sd].burstRiderMsg) { statusLog.push(state[sd].burstRiderMsg); state[sd].burstRiderMsg = null; }
    });
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
      // 霞光梦境：速度慢的先行动（先手度已在上一步比较过，不受影响）
      if (state.weather === "dream") meFirst = !meFirst;
    }
    else meFirst = tieFlip(state.history.length + 1);

    // 打断：应对成功且技能写有「打断被应对技能」→ 对方这次出招作废（不耗能、不造成伤害）
    var meBreaks = counterWinMe && meSk && /打断被应对技能|造成打断/.test(meSk.d || "");
    var foeBreaks = counterWinFoe && foeSk && /打断被应对技能|造成打断/.test(foeSk.d || "");
    if (meBreaks) statusLog.push("我 打断「" + (foeSk ? foeSk.n : "") + "」");
    if (foeBreaks) statusLog.push("敌 打断「" + (meSk ? meSk.n : "") + "」");
    // 威慑：打断敌方时，被打断的技能进入 2 回合冷却
    if (meBreaks && foeSk && /打断敌方时[^。]*?2回合冷却/.test(sidePet("mine").td || "")) {
      state.foe.cooldown = state.foe.cooldown || {};
      state.foe.cooldown[foeSk.n] = 2;
      statusLog.push("我 威慑：" + foeSk.n + " 冷却 2 回合");
    }
    if (foeBreaks && meSk && /打断敌方时[^。]*?2回合冷却/.test(sidePet("foe").td || "")) {
      state.mine.cooldown = state.mine.cooldown || {};
      state.mine.cooldown[meSk.n] = 2;
      statusLog.push("敌 威慑：" + meSk.n + " 冷却 2 回合");
    }

    function meActs() {
      meActDone = meAct;
      // meBreaks = 我打断别人；我被打断才看 foeBreaks
      if (foeBreaks) {
        meActDone = "broken";
        statusLog.push("我 被打断，本回合出招作废");
        return;
      }
      if (Number(state.mine.reviveIn) > 0) {
        meActDone = "down";
        statusLog.push("我 不朽：力竭中，无法行动");
        return;
      }
      if (state.mine.barrelNext) {
        state.mine.barrelNext = 0;
        meActDone = "barrel";
        statusLog.push("我 木桶戏法：木桶状态，本回合不行动");
        return;
      }
      if (state.mine.stunNext) {
        state.mine.stunNext = 0;
        meActDone = "stun";
        statusLog.push("我 眩晕，本回合不行动");
        return;
      }
      if (meAct === "switch") return;
      if (meAct === "charge") {
        state.mine.chargeCount = (Number(state.mine.chargeCount) || 0) + 1;
        gainEnergy("mine", 5);
        // 长久保存制法：聚能时选择偷取敌方 3 能量
        if (/自己的聚能获得选择：偷取敌方(\d+)能量/.test(sidePet("mine").td || "")) {
          var stealN = Number(/自己的聚能获得选择：偷取敌方(\d+)能量/.exec(sidePet("mine").td)[1]);
          var takeN = Math.min(stealN, Number(state.foe.energy) || 0);
          state.foe.energy = Math.max(0, (Number(state.foe.energy) || 0) - takeN);
          gainEnergy("mine", takeN);
          statusLog.push("我 长久保存制法：偷取敌方 " + takeN + " 能量");
        }
        return;
      }
      if (meSk && state.mine.cooldown && Number(state.mine.cooldown[meSk.n]) > 0) {
        meActDone = "cooldown";
        statusLog.push("我 " + meSk.n + " 冷却中，本回合无法使用");
        return;
      }
      // 正位宝剑 / 宝剑王牌：只能使用指定位置的技能
      var meIdx = (state.mine.moves || []).indexOf(meSk ? meSk.n : "");
      var meTdR = sidePet("mine").td || "";
      if (meSk && /仅可以使用1号位技能/.test(meTdR) && meIdx !== 0) {
        meActDone = "restricted";
        statusLog.push("我 正位宝剑：只能使用 1 号位技能");
        return;
      }
      if (meSk && /仅可使用1号和3号位技能/.test(meTdR) && meIdx !== 0 && meIdx !== 2) {
        meActDone = "restricted";
        statusLog.push("我 宝剑王牌：只能使用 1 / 3 号位技能");
        return;
      }
      if (meAct === "counter") {
        state.mine.energy = Math.max(0, (Number(state.mine.energy) || 0) - (meSk && meSk.c ? meSk.c : 3));
        return;
      }
      var cost = costOf("mine", meSk);
      state.energySpent = (Number(state.energySpent) || 0) + (Number(cost) || 0);
      if (window.__relayMode) { cost = 0; }
      if (!window.__relayMode && (Number(state.mine.energy) || 0) < cost) {
        // 石头大餐：能量不足时，消耗 5% 生命代替 1 能量（差多少补多少）
        if (/能量不足时[^。]*?消耗(\d+)%生命，代替1能量/.test((sidePet("mine").td || ""))) {
          var needE = cost - (Number(state.mine.energy) || 0);
          var costHp = Math.max(1, Math.round(mine.stats.hp * Number(/消耗(\d+)%生命/.exec(sidePet("mine").td)[1]) / 100));
          state.mine.hp = Math.max(1, state.mine.hp - costHp * needE);
          state.mine.energy = Math.min(energyCap("mine"), (Number(state.mine.energy) || 0) + needE);
          statusLog.push("我 石头大餐：用生命换 " + needE + " 能量");
        } else {
          meAct = "charge"; meActDone = "charge"; forcedMe = true;
          state.mine.chargeCount = (Number(state.mine.chargeCount) || 0) + 1;
          gainEnergy("mine", 5);
          return;
        }
      }
      meSkillDone = meSk;
      state.__lastStarfall = null;
      dmgToFoe = hitDamage("mine", meSk, mine, foe, undefined, true);
      if (state.__lastStarfall) {
        statusLog.push("敌 星陨印记引爆（" + state.__lastStarfall.stacks + "层） -" + state.__lastStarfall.dmg);
      }
      meHitDone = dmgToFoe;
      if (counterWinFoe && foeSk && foeSk.t === "防御") dmgToFoe = Math.round(dmgToFoe * 0.3);
      state.mine.energy = Math.max(0, (Number(state.mine.energy) || 0) - cost);
      state.foe.hp = Math.max(0, state.foe.hp - dmgToFoe);
      applyOnHitTraits("mine", meSk, dmgToFoe).forEach(function (x) { statusLog.push("我 " + x); });
    }

    function foeActs() {
      foeActDone = foeAct;
      if (meBreaks) {
        foeActDone = "broken";
        statusLog.push("敌 被打断，本回合出招作废");
        return;
      }
      if (Number(state.foe.reviveIn) > 0) {
        foeActDone = "down";
        statusLog.push("敌 不朽：力竭中，无法行动");
        return;
      }
      if (state.foe.barrelNext) {
        state.foe.barrelNext = 0;
        foeActDone = "barrel";
        statusLog.push("敌 木桶戏法：木桶状态，本回合不行动");
        return;
      }
      if (state.foe.stunNext) {
        state.foe.stunNext = 0;
        foeActDone = "stun";
        statusLog.push("敌 眩晕，本回合不行动");
        return;
      }
      if (foeAct === "switch") return;
      if (foeAct === "charge") {
        state.foe.chargeCount = (Number(state.foe.chargeCount) || 0) + 1;
        gainEnergy("foe", 5);
        if (/自己的聚能获得选择：偷取敌方(\d+)能量/.test(sidePet("foe").td || "")) {
          var stealF = Number(/自己的聚能获得选择：偷取敌方(\d+)能量/.exec(sidePet("foe").td)[1]);
          var takeF = Math.min(stealF, Number(state.mine.energy) || 0);
          state.mine.energy = Math.max(0, (Number(state.mine.energy) || 0) - takeF);
          gainEnergy("foe", takeF);
          statusLog.push("敌 长久保存制法：偷取我方 " + takeF + " 能量");
        }
        return;
      }
      if (foeSk && state.foe.cooldown && Number(state.foe.cooldown[foeSk.n]) > 0) {
        foeActDone = "cooldown";
        statusLog.push("敌 " + foeSk.n + " 冷却中，本回合无法使用");
        return;
      }
      // 正位宝剑 / 宝剑王牌：只能使用指定位置的技能
      var foeIdx = (state.foe.moves || []).indexOf(foeSk ? foeSk.n : "");
      var foeTdR = sidePet("foe").td || "";
      if (foeSk && /仅可以使用1号位技能/.test(foeTdR) && foeIdx !== 0) {
        foeActDone = "restricted";
        statusLog.push("敌 正位宝剑：只能使用 1 号位技能");
        return;
      }
      if (foeSk && /仅可使用1号和3号位技能/.test(foeTdR) && foeIdx !== 0 && foeIdx !== 2) {
        foeActDone = "restricted";
        statusLog.push("敌 宝剑王牌：只能使用 1 / 3 号位技能");
        return;
      }
      if (foeAct === "counter") {
        state.foe.energy = Math.max(0, (Number(state.foe.energy) || 0) - (foeSk && foeSk.c ? foeSk.c : 3));
        return;
      }
      var cost = costOf("foe", foeSk);
      if (window.__relayMode) { cost = 0; }
      if (!window.__relayMode && (Number(state.foe.energy) || 0) < cost) {
        foeAct = "charge"; foeActDone = "charge"; forcedFoe = true;
        state.foe.chargeCount = (Number(state.foe.chargeCount) || 0) + 1;
        gainEnergy("foe", 5);
        return;
      }
      foeSkillDone = foeSk;
      state.__lastStarfall = null;
      dmgToMe = hitDamage("foe", foeSk, foe, mine, undefined, true);
      if (state.__lastStarfall) {
        statusLog.push("我 星陨印记引爆（" + state.__lastStarfall.stacks + "层） -" + state.__lastStarfall.dmg);
      }
      if (counterWinMe && meSk && meSk.t === "防御") dmgToMe = Math.round(dmgToMe * 0.3);
      foeHitDone = dmgToMe;
      state.foe.energy = Math.max(0, (Number(state.foe.energy) || 0) - cost);
      state.mine.hp = Math.max(0, state.mine.hp - dmgToMe);
      applyOnHitTraits("foe", foeSk, dmgToMe).forEach(function (x) { statusLog.push("敌 " + x); });
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
    function welcomeMoe(sd, leaving) {
      var dW = (leaving && leaving.td || "") + (sidePet("mine").td || "") + (sidePet("foe").td || "");
      if (!/自己或其他精灵离场时，更换入场的精灵获得萌化/.test(dW)) return;
      addBuff(sd, "萌化", 1);
      entryLog.push((sd === "mine" ? "我" : "敌") + " 迎宾：换上的获得萌化 1 层");
    }
    if (switchedMe) {
      applyLeaveTrait("mine", leavingMe).forEach(function (x) { entryLog.push("我 " + x); });
      applyEnemyLeaveTraits("foe", leavingMe).forEach(function (x) { entryLog.push("敌 " + x); });
      welcomeMoe("mine", leavingMe);
      applyEntryMarks("mine").forEach(function (x) { entryLog.push("我 " + x); });
      entryTraits("mine").forEach(function (x) { entryLog.push("我 " + x); });
      var essMe = rollGamesEssence("mine");
      if (essMe) entryLog.push("我 " + essMe);
    }
    if (switchedFoe) {
      applyLeaveTrait("foe", leavingFoe).forEach(function (x) { entryLog.push("敌 " + x); });
      applyEnemyLeaveTraits("mine", leavingFoe).forEach(function (x) { entryLog.push("我 " + x); });
      welcomeMoe("foe", leavingFoe);
      applyEntryMarks("foe").forEach(function (x) { entryLog.push("敌 " + x); });
      entryTraits("foe").forEach(function (x) { entryLog.push("敌 " + x); });
      var essFoe = rollGamesEssence("foe");
      if (essFoe) entryLog.push("敌 " + essFoe);
    }
    // 剪影：敌方精灵离场时，自己获得技能威力 +20
    if (switchedFoe && /敌方精灵离场时[^。]*?技能威力+20/.test(sidePet("mine").td || "")) {
      addMod("mine", "power", 20);
      entryLog.push("我 剪影：敌方离场 → 威力+20");
    }
    if (switchedMe && /敌方精灵离场时[^。]*?技能威力+20/.test(sidePet("foe").td || "")) {
      addMod("foe", "power", 20);
      entryLog.push("敌 剪影：我方离场 → 威力+20");
    }
    // 瞳中倒影：自己或其他精灵离场时，与更换入场的精灵交换血量百分比
    (function () {
      var holder = null;
      ["mine", "foe"].forEach(function (sd) {
        if (/瞳中倒影/.test(sidePet(sd).td || "")) holder = sd;
      });
      if (holder == null) return;
      var otherS = other(holder);
      var aS = sideStats(holder), bS = sideStats(otherS);
      var aR = state[holder].hp / Math.max(1, aS.stats.hp);
      var bR = state[otherS].hp / Math.max(1, bS.stats.hp);
      state[holder].hp = Math.max(1, Math.round(bR * aS.stats.hp));
      state[otherS].hp = Math.max(1, Math.round(aR * bS.stats.hp));
      entryLog.push((holder === "mine" ? "我" : "敌") + " 瞳中倒影：交换血量百分比");
    })();
    if (switchedMe || switchedFoe) { mine = sideStats("mine"); foe = sideStats("foe"); }

    if (meFirst) { meActs(); if (state.foe.hp > 0) foeActs(); }
    else { foeActs(); if (state.mine.hp > 0) meActs(); }

    // 应对成功后的机制型特性（圣火骑士 / 思维之盾 / 腾挪 / 保卫 / 好象坏象）
    if (counterWinMe) applyCounterTraits("mine", meSkillDone || meSk, true).forEach(function (x) { statusLog.push("我 " + x); });
    if (counterWinFoe) applyCounterTraits("foe", foeSkillDone || foeSk, true).forEach(function (x) { statusLog.push("敌 " + x); });

    // 巧变：换碟 / 魔术帽授予；博物在场时解除
    if (/博物/.test((sidePet("mine").td || "") + (sidePet("foe").td || ""))) {
      clearMorphs().forEach(function (x) { statusLog.push(x); });
    } else {
      if (meSkillDone) {
        var morphMe = morphSkillAfterUse("mine", meSkillDone);
        if (morphMe) statusLog.push("我 " + morphMe);
      }
      if (foeSkillDone) {
        var morphFoe = morphSkillAfterUse("foe", foeSkillDone);
        if (morphFoe) statusLog.push("敌 " + morphFoe);
      }
    }

    // 防过载保护：每次行动后脱离
    ["mine", "foe"].forEach(function (sd) {
      var acted = sd === "mine" ? meActDone : foeActDone;
      if (acted && acted !== "switch" && acted !== "broken" && acted !== "stun" &&
          /每次行动后脱离/.test(sidePet(sd).td || "")) {
        state[sd].forceSwitch = 1;
        statusLog.push((sd === "mine" ? "我" : "敌") + " 防过载保护：行动后脱离");
      }
    });

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
    var afterMe = skillAfterTraits("mine", meSkillDone || meSk, state.history.length + 1);
    if (afterMe) evLog.push("我 " + afterMe);
    var afterFoe = skillAfterTraits("foe", foeSkillDone || foeSk, state.history.length + 1);
    if (afterFoe) evLog.push("敌 " + afterFoe);

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

    // 龙噬印记：本回合用了 3 费技能 → 双攻+30%
    ["mine", "foe"].forEach(function (sd) {
      var list = state.buffs[sd] || [];
      var hit = list.filter(function (b) { return b.n === "龙噬印记"; })[0];
      if (!hit) return;
      var used = sd === "mine" ? (meActDone === "attack" ? meSkillDone : null) : (foeActDone === "attack" ? foeSkillDone : null);
      if (used && Number(used.c) === 3) {
        addMod(sd, "stat", 30 * (Number(hit.st) || 1));
        entryLog.push((sd === "mine" ? "我 " : "敌 ") + "龙噬印记 双攻+30%");
      }
    });

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

    // 记录本回合双方技能（供「合拍」等回合末特性比对）
    state.turnSkills = {
      mine: meSkillDone ? { e: meSkillDone.e, t: meSkillDone.t, c: Number(meSkillDone.c) || 0 } : null,
      foe: foeSkillDone ? { e: foeSkillDone.e, t: foeSkillDone.t, c: Number(foeSkillDone.c) || 0 } : null
    };

    // 特性「使用 X 系技能后」类效果（回血 / 减耗能 / 敌方掉能 / 叠中毒）
    ["mine", "foe"].forEach(function (sd) {
      var usedSk = sd === "mine" ? (meActDone === "attack" ? meSkillDone : null) : (foeActDone === "attack" ? foeSkillDone : null);
      if (!usedSk) return;
      var td = sidePet(sd).td || "";
      var who = sd === "mine" ? "我" : "敌";
      var mm;
      if ((mm = /使用([\u4e00-\u9fa5])系技能后[^。]*?回复(\d+)%生命/.exec(td)) && usedSk.e === mm[1]) {
        var stH = sideStats(sd);
        var hv = Math.max(1, Math.round(stH.stats.hp * Number(mm[2]) / 100));
        healSide(sd, hv);
        statusLog.push(who + " 特性回血 +" + hv);
      }
      if ((mm = /使用([\u4e00-\u9fa5])系技能后[^。]*?全技能能耗[-−](\d+)/.exec(td)) && usedSk.e === mm[1]) {
        state[sd].costFlat = (Number(state[sd].costFlat) || 0) - Number(mm[2]);
        statusLog.push(who + " 特性能耗-" + mm[2]);
      }
      if ((mm = /使用([\u4e00-\u9fa5])系技能后[^。]*?敌方失去(\d+)能量/.exec(td)) && usedSk.e === mm[1]) {
        var fo = other(sd);
        state[fo].energy = Math.max(0, (Number(state[fo].energy) || 0) - Number(mm[2]));
        statusLog.push(who + " 特性削敌能量-" + mm[2]);
      }
      if (/天气为雷鸣时[^。]*?使用电系技能后敌方获得引电/.test(td) && usedSk.e === "电" && state.weather === "thunder") {
        addBuff(other(sd), "引电", 1);
        statusLog.push(who + " 电子音乐：敌方获得引电");
      }
      if ((mm = /使用([\u4e00-\u9fa5])系技能时[^。]*?敌方获得(\d+)层中毒/.exec(td)) && usedSk.e === mm[1]) {
        addBuff(other(sd), "中毒", Number(mm[2]));
        statusLog.push(who + " 特性给敌方中毒+" + mm[2]);
      }
    });


    // 渴求：造成伤害的 N% 转化为生命
    ["mine", "foe"].forEach(function (sd) {
      var td2 = sidePet(sd).td || "";
      var mmx = /造成伤害的(\d+)%转化为生命/.exec(td2);
      if (!mmx) return;
      var dealt = sd === "mine" ? dmgToFoe : dmgToMe;
      if (!dealt) return;
      var st2 = sideStats(sd);
      healSide(sd, Math.round(dealt * Number(mmx[1]) / 100));
      statusLog.push((sd === "mine" ? "我" : "敌") + " 渴求汲取 " + Math.round(dealt * Number(mmx[1]) / 100));
    });

    // 使用次数统计（供「每使用1次X系技能」类特性用）
    ["mine", "foe"].forEach(function (sd) {
      var used = sd === "mine" ? (meActDone === "attack" ? meSkillDone : null) : (foeActDone === "attack" ? foeSkillDone : null);
      if (!used) return;
      state[sd].used = state[sd].used || { el: {}, cat: {} };
      if (used.e) state[sd].used.el[used.e] = (Number(state[sd].used.el[used.e]) || 0) + 1;
      if (used.t) state[sd].used.cat[used.t] = (Number(state[sd].used.cat[used.t]) || 0) + 1;
      if (used.e === "冰") state[sd].iceBeforeEntry = (Number(state[sd].iceBeforeEntry) || 0) + 1;
      if (Number(used.c) === 3) state[sd].cost3Uses = (Number(state[sd].cost3Uses) || 0) + 1;
      if (state[sd].freeChargeNext) state[sd].freeChargeNext = 0;
      state[sd].lastUsedSkill = used.n;
      // 疾风连袭：记录本场释放过的迅捷技能（去重）
      if (isSwift(used) && used.n !== "疾风连袭") {
        state[sd].swiftHistory = state[sd].swiftHistory || [];
        if (state[sd].swiftHistory.indexOf(used.n) < 0) state[sd].swiftHistory.push(used.n);
      }
      // 铭记于月亮：每次攻击后自己失去 5% 生命
      if (used.p && /每次攻击后自己失去5%生命/.test(tdU)) {
        var stMoon = sideStats(sd);
        var lossMoon = Math.max(1, Math.round(stMoon.stats.hp * 0.05));
        state[sd].hp = Math.max(0, state[sd].hp - lossMoon);
        statusLog.push(whoU + " 铭记于月亮：攻击后 -" + lossMoon);
      }
      // 翼轴：1 号位技能获得迅捷和传动 1
      if (/1号位技能获得迅捷/.test(tdU) && (state[sd].moves || [])[0] === used.n) {
        state[sd].transmission = (Number(state[sd].transmission) || 0) + 1;
      }
      // 风速仪：携带技能每累计传动 8 → 1 层风起印记
      if (/携带的技能每累计传动8/.test(tdU)) {
        var transN = 0;
        var mTrans = /传动(\d+)/.exec(used.d || "");
        if (mTrans) transN = Number(mTrans[1]);
        else if (/传动/.test(used.d || "")) transN = 1;
        state[sd].transmission = (Number(state[sd].transmission) || 0) + transN;
        while (Number(state[sd].transmission) >= 8) {
          state[sd].transmission = Number(state[sd].transmission) - 8;
          addBuff(sd, "风起印记", 1);
          statusLog.push(whoU + " 风速仪：传动累计 8 → 风起印记+1");
        }
      }
      // 一意孤行 / 有求必应：使用任意技能后，该技能冷却 1 回合
      if (/使用任意技能后，该技能冷却1回合/.test(tdU) || /使用「选择」技能后[^。]*?该技能冷却1回合/.test(tdU)) {
        state[sd].cooldown = state[sd].cooldown || {};
        state[sd].cooldown[used.n] = 2;
      }

      var tdU = sidePet(sd).td || "", whoU = sd === "mine" ? "我" : "敌";
      // 大雪球 / 大火球：使用 2 次不同的冰 / 火系技能后触发，然后重置
      if (used.e === "冰" || used.e === "火") {
        state[sd].uniqEl = state[sd].uniqEl || {};
        var arrU = state[sd].uniqEl[used.e] || (state[sd].uniqEl[used.e] = []);
        if (arrU.indexOf(used.n) < 0) arrU.push(used.n);
        if (arrU.length >= 2) {
          var mmU;
          if (used.e === "冰" && (mmU = /自己使用2次不同的冰系技能后[^。]*?对手获得(\d+)层冻结/.exec(tdU))) {
            addBuff(other(sd), "冻结", Number(mmU[1]));
            statusLog.push(whoU + " 大雪球：敌方冻结+" + mmU[1]);
            arrU.length = 0;
          } else if (used.e === "火" && /自己使用2次不同的火系技能后[^。]*?下次技能无需蓄力/.test(tdU)) {
            state[sd].freeChargeNext = 1;
            statusLog.push(whoU + " 大火球：下次技能无需蓄力");
            arrU.length = 0;
          }
        }
      }
      // 安可：使用光系技能后，回合结束自己返场
      if (used.e === "光" && /使用光系技能后，回合结束时自己返场/.test(tdU)) {
        state[sd].forceSwitch = 1;
        statusLog.push(whoU + " 安可：回合结束后返场");
      }
    });

    // 上锁：对手本回合使用的技能冷却 1 回合
    ["mine", "foe"].forEach(function (sd) {
      if (!/对手本回合使用的技能，冷却1回合/.test(sidePet(sd).td || "")) return;
      var oppUsed = sd === "mine" ? (foeActDone === "attack" ? foeSkillDone : null) : (meActDone === "attack" ? meSkillDone : null);
      if (!oppUsed) return;
      state[other(sd)].cooldown = state[other(sd)].cooldown || {};
      state[other(sd)].cooldown[oppUsed.n] = 2; // 下回合开始递减 1，实际封 1 回合
      statusLog.push((sd === "mine" ? "我" : "敌") + " 上锁：" + oppUsed.n + " 冷却 1 回合");
    });

    // 基因编辑用：本回合双方实际使用技能的能耗之和
    state.prevTurnCostSum = (Number(meSkillDone && meSkillDone.c) || 0) + (Number(foeSkillDone && foeSkillDone.c) || 0);

    // 游戏的本质：行动后触发的点数（火 6 层灼烧 / 毒 2 层中毒）
    var essAfter = gamesEssenceAfter();
    if (essAfter) statusLog.push(essAfter);

    // 回合结束状态结算（冻结力竭、中毒掉血等），放在倒下判定之前
    var buffLog = settleBuffs();
    // 游戏的本质：回合结束触发的点数
    var essEnd = gamesEssenceEnd();
    if (essEnd) statusLog.push(essEnd);
    var endTraits = traitEndEffects();
    if (endTraits) statusLog.push(endTraits);
    // 恶龙的奢望：回合结束等级 -10
    ["mine", "foe"].forEach(function (sd) {
      var dd = sidePet(sd).td || "";
      if (/初始等级\+39[^。]*?回合结束时等级-10/.test(dd)) {
        state[sd].level = Math.max(1, (Number(state[sd].level) || 60) - 10);
      }
    });
    if (state.pendingTraitLogs && state.pendingTraitLogs.length) {
      state.pendingTraitLogs.forEach(function (msg) { statusLog.push(msg); });
      state.pendingTraitLogs = [];
    }


    // 刺肤：每受到 1 次攻击伤害，对攻击者造成固定威力物伤
    ["mine", "foe"].forEach(function (sd) {
      var tds = sidePet(sd).td || "";
      var mms = /每受到1次攻击伤害[^。]*?对攻击自己的精灵造成(\d+)威力物理伤害/.exec(tds);
      if (!mms) return;
      var taken = sd === "mine" ? (Number(before.mineHp) || 0) - state.mine.hp : (Number(before.foeHp) || 0) - state.foe.hp;
      if (!taken || taken <= 0) return;
      var atkSide = other(sd);
      var atkPet = sidePet(atkSide);
      var defStat = atkPet ? (atkPet.def || 100) : 100;
      var reflect = Math.max(1, Math.round(Number(mms[1]) * 1.2 * 100 / Math.max(1, defStat)));
      state[atkSide].hp = Math.max(0, state[atkSide].hp - reflect);
      statusLog.push((sd === "mine" ? "我" : "敌") + " 刺肤反伤 " + reflect);
    });

    // 坚韧铠甲：每受到 1 次攻击伤害，己方队伍获得 1 次随机奉献
    ["mine", "foe"].forEach(function (sd) {
      var tdA = sidePet(sd).td || "";
      if (!/每受到1次攻击伤害[^。]*?己方队伍获得(\d+)次随机奉献/.test(tdA)) return;
      var takenA = sd === "mine" ? (Number(before.mineHp) || 0) - state.mine.hp : (Number(before.foeHp) || 0) - state.foe.hp;
      if (!takenA || takenA <= 0) return;
      var nA = Number(/每受到1次攻击伤害[^。]*?己方队伍获得(\d+)次随机奉献/.exec(tdA)[1]);
      for (var iA = 0; iA < nA; iA++) {
        var kA = devotionRandom(sd, (state.history.length || 0) + iA + 1);
        statusLog.push((sd === "mine" ? "我" : "敌") + " 坚韧铠甲：奉献·" + (DEVOTION_LABEL[kA] || kA));
      }
    });

    // 受击触发：扎手 / 诅咒 / 乌龟塔理论（每次技能攻击结算 1 次，不按连击段数重复）
    ["mine", "foe"].forEach(function (sd) {
      var takenH = sd === "mine" ? (Number(before.mineHp) || 0) - state.mine.hp : (Number(before.foeHp) || 0) - state.foe.hp;
      if (!takenH || takenH <= 0) return;
      var tdT = sidePet(sd).td || "", foeT = other(sd), whoT = sd === "mine" ? "我" : "敌";
      var mmT;
      if ((mmT = /每受到1次攻击伤害，敌方获得(\d+)层暗涌印记/.exec(tdT))) {
        addBuff(foeT, "暗涌印记", Number(mmT[1]));
        statusLog.push(whoT + " 诅咒：敌方暗涌印记+" + mmT[1]);
      }
      if ((mmT = /每受到1次攻击伤害，敌方获得(\d+)层棘刺印记/.exec(tdT))) {
        addBuff(foeT, "棘刺印记", Number(mmT[1]));
        statusLog.push(whoT + " 扎手：敌方棘刺印记+" + mmT[1]);
      }
      if ((mmT = /每受到1次攻击伤害，敌方获得(\d+)层星陨印记/.exec(tdT))) {
        addBuff(foeT, "星陨印记", Number(mmT[1]));
        statusLog.push(whoT + " 乌龟塔理论：敌方星陨+" + mmT[1]);
      }
    });

    // 不死鸟：每场战斗 1 次，受到致命伤害时保留 1 血，敌方 +15 层灼烧
    ["mine", "foe"].forEach(function (sd) {
      var tdP = sidePet(sd).td || "";
      if (!/每场战斗1次，受到致命伤害时保留1血/.test(tdP)) return;
      if (state[sd].hp > 0 || state[sd].phoenix) return;
      state[sd].phoenix = 1;
      state[sd].hp = 1;
      var burnP = Number((/保留1血，且敌方获得(\d+)层灼烧/.exec(tdP) || [])[1] || 15);
      addBuff(other(sd), "灼烧", burnP);
      statusLog.push((sd === "mine" ? "我" : "敌") + " 不死鸟：保留 1 血，敌方灼烧+" + burnP);
    });

    // 化茧：受到致命伤害时免疫并获 1 层萌化（最多 2 次）
    ["mine", "foe"].forEach(function (sd) {
      var d0 = sidePet(sd).td || "";
      if (!/受到致命伤害时[^。]*?获得1层萌化/.test(d0)) return;
      state[sd].cocoon = Number(state[sd].cocoon) || 0;
      if (state[sd].hp > 0 || state[sd].cocoon >= 2) return;
      state[sd].cocoon += 1;
      state[sd].hp = 1;
      addBuff(sd, "萌化", 1);
      statusLog.push((sd === "mine" ? "我" : "敌") + " 化茧：免疫致命伤害（第 " + state[sd].cocoon + " 次）");
    });

    // 倒下结算
    function faintManaLoss(sd) {
      var tdL = sidePet(sd).td || "", loss = 1;
      // 御驾亲征：力竭时扣除 4 点魔力
      if (/力竭时扣除4魔力/.test(tdL)) loss = 4;
      // 诈死：自己力竭时少损失 1 点魔力
      if (/自己力竭时，少损失1点魔力/.test(tdL)) loss = Math.max(0, loss - 1);
      // 飓风：被击败时额外损失 1 点魔力
      if (/被敌方精灵击败时，自己额外损失1点魔力/.test(tdL) && /迅捷/.test(tdL)) loss += 1;
      return loss;
    }
    if ((state.foe.hp <= 0 || koSide === "foe") && !(Number(state.foe.reviveIn) > 0)) {
      var lossF = faintManaLoss("foe");
      state.foe.mana = Math.max(0, (Number(state.foe.mana) || 0) - lossF);
      // 付给恶魔的赎价：被击败时自己额外损失 1 点魔力
      if (/被敌方精灵击败时，自己额外损失1点魔力/.test(sidePet("foe").td || "")) {
        state.foe.mana = Math.max(0, (Number(state.foe.mana) || 0) - 1);
        entryLog.push("敌 付给恶魔的赎价：额外损失 1 魔力");
      }
      state.foe.faints = (Number(state.foe.faints) || 0) + 1;
      if (/自己队伍中的其他精灵，在力竭1回合后会变为未完虫/.test(sidePet("foe").td || "") && !state.foe.specimenUsed) {
        state.foe.specimenUsed = 1;
        state.foe.specimenPending = 1;
        state.foe.specimenSlot = state.foe.active;
        state.foe.specimenSlotName = sidePet("foe").n;
        saveBench("foe");
        if (state.foe.bench[state.foe.active]) state.foe.bench[state.foe.active].hp = 0;
        entryLog.push("敌 正模标本：力竭的精灵将在 1 回合后变为未完虫");
      }
      if (/力竭4回合后复活/.test(sidePet("foe").td || "") && !state.foe.immortalUsed) {
        state.foe.immortalUsed = 1;
        state.foe.reviveIn = 4;
        state.foe.hp = 0;
        entryLog.push("敌 不朽：力竭，4 回合后复活");
      } else {
        state.foe.hp = foe.stats.hp;
      }
      defeatTraits("mine").forEach(function (x) { entryLog.push("我 " + x); });
      var stealF2 = stealTalent("mine");
      if (stealF2) entryLog.push("我 " + stealF2);
    }
    if ((state.mine.hp <= 0 || koSide === "mine") && !(Number(state.mine.reviveIn) > 0)) {
      var lossM = faintManaLoss("mine");
      state.mine.mana = Math.max(0, (Number(state.mine.mana) || 0) - lossM);
      if (/被敌方精灵击败时，自己额外损失1点魔力/.test(sidePet("mine").td || "")) {
        state.mine.mana = Math.max(0, (Number(state.mine.mana) || 0) - 1);
        entryLog.push("我 付给恶魔的赎价：额外损失 1 魔力");
      }
      state.mine.faints = (Number(state.mine.faints) || 0) + 1;
      if (/自己队伍中的其他精灵，在力竭1回合后会变为未完虫/.test(sidePet("mine").td || "") && !state.mine.specimenUsed) {
        state.mine.specimenUsed = 1;
        state.mine.specimenPending = 1;
        state.mine.specimenSlot = state.mine.active;
        state.mine.specimenSlotName = sidePet("mine").n;
        saveBench("mine");
        if (state.mine.bench[state.mine.active]) state.mine.bench[state.mine.active].hp = 0;
        entryLog.push("我 正模标本：力竭的精灵将在 1 回合后变为未完虫");
      }
      if (/力竭4回合后复活/.test(sidePet("mine").td || "") && !state.mine.immortalUsed) {
        state.mine.immortalUsed = 1;
        state.mine.reviveIn = 4;
        state.mine.hp = 0;
        entryLog.push("我 不朽：力竭，4 回合后复活");
      } else {
        state.mine.hp = mine.stats.hp;
      }
      defeatTraits("foe").forEach(function (x) { entryLog.push("敌 " + x); });
      var stealM2 = stealTalent("foe");
      if (stealM2) entryLog.push("敌 " + stealM2);
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
        nature: x.nature, moves: x.moves, blood: x.blood, hp: x.hp, energy: x.energy, mana: x.mana, priority: x.priority, traitText: x.traitText };
    }
    return { v: 2, mine: side("mine"), foe: side("foe"), coef: state.coef, weather: state.weather,
      doubles: state.doubles, custom: state.custom || {} };
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
      if (data.custom && typeof data.custom === "object") state.custom = data.custom;
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

  // 导出成可直接贴到群里/文档里的对战记录（Markdown）
  function exportMarkdown() {
    var me = sidePet("mine"), fo = sidePet("foe");
    var L = [];
    L.push("# 洛克王国世界 · 对战记录");
    L.push("");
    L.push("- 我方：" + me.n + "（" + [me.el, me.el2].filter(Boolean).join("/") + "）");
    L.push("- 敌方：" + fo.n + "（" + [fo.el, fo.el2].filter(Boolean).join("/") + "）");
    if (state.weather) L.push("- 天气：" + ({ rain: "下雨", sand: "沙暴", snow: "暴风雪", thunder: "雷暴", dream: "霞光梦境" }[state.weather] || state.weather));
    L.push("");
    L.push("| 回合 | 阶段 | 我方 | 敌方 | 伤害(我/敌) | 血量(我/敌) | 能量(我/敌) |");
    L.push("|---|---|---|---|---|---|---|");
    (state.history || []).forEach(function (h) {
      var actName = { attack: "出招", counter: "应对", switch: "换人", defend: "防御", item: "道具",
        charge: "蓄力", release: "释放", flee: "脱离", wait: "待机", status: "状态", broken: "被打断", stun: "眩晕" };
      L.push("| " + h.turn + " | " + (h.phase || "") + " | " +
        (actName[h.meAct] || h.meAct) + (h.meMove ? "·" + h.meMove : "") + " | " +
        (actName[h.foeAct] || h.foeAct) + (h.foeMove ? "·" + h.foeMove : "") + " | " +
        (h.dmgToFoe || 0) + " / " + (h.dmgToMe || 0) + " | " +
        h.mineHp + "/" + h.foeHp + " | " + h.mineEnergy + "/" + h.foeEnergy + " |");
    });
    L.push("");
    L.push("> 由对战计算器生成");
    var text = L.join("\n");
    var blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") +
      "-" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
    var a = document.createElement("a");
    a.href = url;
    a.download = "luoke-match-" + stamp + ".md";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
    return text;
  }

  window.luokeExportMd = exportMarkdown;
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

  ["meAction", "stratSel", "meMoveSel", "foeActionRec", "foeMoveSel"].forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener("change", function () {
      if (id === "foeActionRec" || id === "foeMoveSel") { renderBattle(); return; }
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
      renderBattle();
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
  var PICKER_LIMIT = 60;
  var pickerOnlyS5 = false;
  var pickerEle = "";
  function renderPicker(q) {
    var all = PETS.filter(function (x) {
      if (pickerOnlyS5 && !window.__S5_NAMES[x.n]) return false;
      if (pickerEle && x.el !== pickerEle && x.el2 !== pickerEle) return false;
      return !q || x.n.indexOf(q) >= 0;
    });
    var list = all.slice(0, PICKER_LIMIT);
    var more = all.length - list.length;
    $("pickerList").innerHTML = list.map(function (x) {
      var sp = typeof spriteSrc === "function" ? spriteSrc(x.n) : (window.SPRITES && window.SPRITES[x.n]);
      return "<button type='button' class='picker-item' data-pick='" + x.n + "'>" +
        (sp ? "<img class='picker-thumb' src='" + sp + "' alt='' loading='lazy'>" : "<i class='picker-thumb' style='background:" + elColor(x.el) + ";border-radius:8px;opacity:.25'></i>") +
        "<span>" + x.n + "</span>" +
        "<span style='color:#8b8578;font-size:11px;margin-left:auto'>" + x.el + "</span></button>";
    }).join("") +
      "<div style='display:flex;gap:8px;padding:6px 4px;align-items:center'><button type='button' class='mini-btn' id='s5Filter'>" +
        (pickerOnlyS5 ? "看全部" : "只看 S5/新增") + "</button>" +
        "<select id='pickerEle' style='font-size:12px;padding:4px 6px;border-radius:8px'>" +
        ["", "普通", "草", "火", "水", "光", "地", "冰", "龙", "电", "毒", "虫", "武", "翼", "萌", "幽", "恶", "机械", "幻"]
          .map(function (e) { return "<option value='" + e + "'" + (pickerEle === e ? " selected" : "") + ">" + (e ? e + "系" : "全部属性") + "</option>"; }).join("") +
        "</select></div>" +
      (more > 0 ? "<div style='color:#8b8578;font-size:12px;padding:8px 4px'>还有 " + more + " 只，输入名字缩小范围</div>" : "") ||
      "<div style='color:#8b8578;font-size:13px'>没有匹配的精灵</div>";
  }

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "pickerEle") {
      pickerEle = e.target.value || "";
      renderPicker($("pickerSearch").value);
    }
  });

  // 个体值：−/+ 按钮与直接输入
  function setIv(side, key, val) {
    var v = Math.max(0, Math.min(10, Math.round(Number(val) || 0)));
    if (!state[side].iv || typeof state[side].iv !== "object") {
      state[side].iv = { hp: 10, atk: 10, def: 10, ma: 10, md: 10, spe: 10 };
    }
    state[side].iv[key] = v;
    save();
    renderStats(side);
    renderCard(side);
    renderBattle();
  }

  document.addEventListener("click", function (e) {
    var ivBtn = e.target.closest ? e.target.closest("[data-iv]") : null;
    if (ivBtn) {
      var parts = ivBtn.getAttribute("data-iv").split(":");
      var cur = Number(state[parts[0]].iv && state[parts[0]].iv[parts[1]]);
      if (!Number.isFinite(cur)) cur = 10;
      setIv(parts[0], parts[1], cur + Number(parts[2]));
      return;
    }
    if (e.target && e.target.id === "pickerEle") {
      pickerEle = e.target.value || "";
      renderPicker($("pickerSearch").value);
      return;
    }
    if (e.target && e.target.id === "s5Filter") {
      pickerOnlyS5 = !pickerOnlyS5;
      renderPicker($("pickerSearch").value);
      return;
    }
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
      if (changed) {
        // 换了另一只精灵：该格旧配置作废（只清存档，不动当前状态）
        var ss = state[pickingSide];
        ss.slotProfiles = ss.slotProfiles || {};
        delete ss.slotProfiles[slot];
      }
      var st = sideStats(pickingSide);
      state[pickingSide].hp = st.stats.hp;
      // 换了精灵，招式跟着换成它的可学招式；同一只重复选择则保留手改
      autofillMoves(pickingSide, changed);
      save(); closePicker(); renderAll();
      return;
    }
  });
  document.addEventListener("input", function (e) {
    var ivIn = e.target && e.target.getAttribute ? e.target.getAttribute("data-ivinput") : null;
    if (!ivIn) return;
    var parts = ivIn.split(":");
    var v = Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0)));
    if (String(v) !== e.target.value) e.target.value = v;
    if (!state[parts[0]].iv || typeof state[parts[0]].iv !== "object") {
      state[parts[0]].iv = { hp: 10, atk: 10, def: 10, ma: 10, md: 10, spe: 10 };
    }
    state[parts[0]].iv[parts[1]] = v;
    save();
    renderCard(parts[0]);
    renderBattle();
    var tbl = $(parts[0] + "Stats");
    if (tbl) {
      var total = ["hp", "atk", "def", "ma", "md", "spe"].reduce(function (n, k) { return n + (Number(state[parts[0]].iv[k]) || 0); }, 0);
      var tEl = $(parts[0] + "IvTotal");
      if (tEl) tEl.textContent = "个体合计 " + total + "/60";
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

  ["mine", "foe"].forEach(function (sd) {
    var sel = $(sd + "El2Sel");
    if (!sel) return;
    sel.addEventListener("change", function () {
      if (sel.value === "__none") delete state[sd].el2Override;
      else state[sd].el2Override = sel.value;
      save(); renderCard(sd); renderStats(sd); renderBattle();
    });
  });
  if ($("exportMdBtn")) {
    $("exportMdBtn").addEventListener("click", function () {
      if (!state.history || !state.history.length) { notice("还没有回合记录"); return; }
      exportMarkdown();
      notice("已导出 Markdown 表格");
    });
  }
  if ($("covBtn")) {
    $("covBtn").addEventListener("click", function () {
      var r = coverageReport();
      var lines = [
        "精灵：" + r.pets + " 只（有头像 " + r.sprites + "）",
        "技能：" + r.skills + " 个（伤害 " + r.dmgSkills + " / 状态 " + r.statusSkills + "）",
        "状态技可用：" + r.parseable + " / " + r.statusSkills + "（" + Math.round(r.parseable / r.statusSkills * 100) + "%）",
        "　其中手写实现 " + r.handWritten + " 个，描述自动解析 " + (r.parseable - r.handWritten) + " 个",
        "特性：" + r.traits + " 个（带数值 " + r.traitsWithNum + "）",
        "特性覆盖：" + r.traitsHandled + " / " + r.traitsWithNum + "（自动 " + r.traitsAuto + " + 事件 " + r.traitsEvent + "，" + Math.round(r.traitsHandled / r.traitsWithNum * 100) + "%）",
        "机制型特性（不带数值）：完整 " + r.mechFull + " · 近似 " + r.mechApprox + " / " + r.mechTotal + "（" + Math.round(r.mechHandled / Math.max(1, r.mechTotal) * 100) + "% 有实现）",
        "印记：" + r.marks + " 种全部实现"
      ];
      if (r.traitsSkippedNames && r.traitsSkippedNames.length) {
        lines.push("事件类（已单独实现）：" + (r.traitsEventNames.length ? r.traitsEventNames.join("、") : "无"));
        lines.push("仍无规则（" + r.traitsSkippedNames.length + "）：" + (r.traitsSkippedNames.length ? r.traitsSkippedNames.slice(0, 10).join("、") + (r.traitsSkippedNames.length > 10 ? " …" : "") : "无"));
      }
      if (r.mechMissing && r.mechMissing.length) {
        lines.push("机制型未实现（" + r.mechMissing.length + "）：" + r.mechMissing.slice(0, 12).join("、") + (r.mechMissing.length > 12 ? " …" : ""));
      }
      if (r.mechApprox) {
        lines.push("近似实现（主效果生效，次要部分未建模）：" + MECH_TRAIT_APPROX.join("、"));
      }

      window.__mechSkipped = r.mechMissing || [];
      window.__cov = r;
      window.__traitsSkipped = r.traitsSkippedNames || [];
      showPanel("覆盖自检", lines);
    });
  }
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

  // 覆盖自检：把库里的数据跑一遍，给出可算/不可算的统计
  function showPanel(title, lines) {
    var old = document.getElementById("covPanel");
    if (old) old.remove();
    var box = document.createElement("div");
    box.id = "covPanel";
    box.className = "ocr-modal";
    box.innerHTML = "<div class='ocr-box'><div class='ocr-head'><b>" + title + "</b><button type='button' id='covClose'>×</button></div>" +
      lines.map(function (x) { return "<p class='hint' style='margin:4px 0'>• " + x + "</p>"; }).join("") + "</div>";
    document.body.appendChild(box);
    document.getElementById("covClose").addEventListener("click", function () { box.remove(); });
    box.addEventListener("click", function (e) { if (e.target === box) box.remove(); });
  }

  // 由事件系统（克制命中/先手/掉血/入场/击败）处理的特性，不算“未覆盖”
  var EVENT_TRAITS = ["最好的伙伴", "嫁祸", "咔咔冲刺", "蓄电池", "超级电池", "全神贯注", "大捞一笔", "小偷小摸",
    "恶魔的晚宴", "付给恶魔的赎价", "振奋虫心", "吉利丁片", "美拉德反应", "离场后", "图书守卫者", "稀兽花宝", "契约的形状", "超负荷", "预警", "哨兵", "先知", "防过载保护", "冰封", "营养液泡", "捉迷藏", "抓到你了", "野性感官", "噼啪！", "灰色肖像", "斗技",
    "王子的诺言", "安眠", "留学生", "异类", "光度换算", "相争", "噼啪噼啪！", "游戏的本质"];

  // 机制型特性：已被代码处理的描述模式（与实现处保持一致）
  var MECH_TRAIT_PATTERNS = [
    /回合结束时[^。]*?回复\d+%生命/, /回合结束时[^。]*?回复\d+能量/, /回合结束时[^。]*?偷取敌方/,
    /回合结束时[^。]*?敌方获得\d+层/, /回合结束时[^。]*?驱散敌方/, /回合结束时[^。]*?偷取敌方1层印记/,
    /回合结束时[^。]*?若自己能量为0则脱离/, /使用防御技能后[^。]*?回合结束时脱离/,
    /使用[\u4e00-\u9fa5]系技能后[^。]*?回复\d+%生命/, /使用[\u4e00-\u9fa5]系技能后[^。]*?全技能能耗[-−]\d+/,
    /使用[\u4e00-\u9fa5]系技能后[^。]*?敌方失去\d+能量/, /使用[\u4e00-\u9fa5]系技能时[^。]*?敌方获得\d+层/,
    /入场时偷取敌方/, /首次入场时[^。]*?失去自己一半/, /每携带1个[\u4e00-\u9fa5]系技能进入战斗/,
    /自己入场时敌方获得\d+层冻结/, /入场时获得\d+%吸血/, /入场时[^。]*?复制敌方的增益/,
    /离场后[^。]*?双攻\+\d+%/, /离场后[^。]*?自己的增益和减益会被更换入场的精灵继承/, /离场时回复\d+能量/,
    /每入场1次[^。]*?双攻/, /受到自己携带技能系别的攻击伤害[-−]\d+%/, /抵抗自己携带技能系别的攻击伤害/,
    /能量等于?0的精灵，无法对自己造成伤害/, /能耗小于等于1的攻击技能[^。]*?无法对自己造成伤害/,
    /造成伤害的\d+%转化为生命/, /携带的防御技能能耗[-−]\d+/, /每受到1次攻击伤害[^。]*?对攻击自己的精灵造成/,
    /受到致命伤害时[^。]*?获得1层萌化/, /能量不足时[^。]*?消耗\d+%生命/, /自己的能量可以超过能量上限/,
    /双方回合结束时的效果会额外触发1次/, /双方回合结束时的中毒效果会额外触发1次/,
    /双方回合结束时的效果不会触发/, /累计消耗的能量恰好为12/, /每有1项相同[^。]*?物攻和物防永久\+10%/,
    /敌方每2层中毒转化为1层中毒印记/, /在场时，所有精灵连击数固定为[12]/,
    /攻击会使敌方已有的减益层数\+3/, /若使用技能能耗高于敌方/, /防御应对成功时[^。]*?敌方获得萌化/,
    /防御技能应对成功时[^。]*?速度提升\d+%/, /状态技能应对成功时[^。]*?获得\d+点能量/,
    /天气为雷鸣时[^。]*?使用电系技能后敌方获得引电/, /若自己在萌化状态下再获得萌化会解除萌化/,
    /打断被应对技能|造成打断/, /若自己能量为0则脱离/
  ];

  // 已实现但描述模式无法稳定识别的机制型特性（按特性名登记，避免“匹配到描述却其实没算”）
  var MECH_TRAIT_DONE = [
    // 迅捷 / 迸发 / 能耗
    "快锤", "暴食", "起飞加速", "飓风", "生物电", "翼轴", "倾轧",
    "水翼推进", "洄游", "盲从", "对流", "盘根木", "无忧无虑", "泛音列", "守望星",
    "吟游之弦", "瞳中倒影", "翻垃圾桶", "基因编辑", "嫉妒", "机械变式", "戏耍", "盗魂铃", "腐植循环",
    "换碟", "魔术帽", "系统发育", "正模标本", "连续负荷",
    "地脉", "地脉馈赠", "慢热型", "打雪仗", "散热", "结晶水", "腾挪", "保卫", "好象坏象", "煤渣草",
    "飓风", "盲拧", "风速仪", "不朽", "一意孤行", "有求必应", "或",
    "生物电", "翼轴", "毒牙", "焰色反应",
    "守护者", "铭记于月亮", "木桶戏法",
    // 入场 / 离场
    "地脉", "地脉馈赠", "慢热型", "打雪仗", "散热", "稀兽花宝", "契约的形状",
    "做噩梦", "下黑手", "珊瑚骨", "孤傲",
    // 使用技能给状态
    "高浓生物碱", "毒腺", "毒牙", "加个雪球", "灵魂灼伤", "扩散侵蚀", "月牙雪糕", "贪心算法",
    "爆裂玉米", "与星星同行", "盛宴", "滴眼液", "长久保存制法", "大雪球", "大火球",
    // 应对 / 打断 / 变身
    "腾挪", "保卫", "好象坏象", "圣火骑士", "思维之盾", "威慑", "擒拿", "上锁",
    // 回合结束 / 受伤 / 击败 / 力竭
    "星地善良", "耐活王", "仁心", "花精灵", "坚韧铠甲", "振奋虫心", "御驾亲征", "诈死", "付给恶魔的赎价",
    "正位宝剑", "宝剑王牌", "茶多酚", "防过载保护", "扎手", "诅咒", "乌龟塔理论", "月相", "不死鸟", "安可", "迎宾",
    // 减伤
    "绝对秩序", "游戏的本质", "沙滩节拍", "深层侵蚀", "环天顶弧", "虫草多糖", "高吹雪"
  ];

  // 近似实现：主效果已接入，但有明确未建模的次要部分（面板单列，不混进“完整”）
  var MECH_TRAIT_APPROX = [
    "御驾亲征", "博物"
  ];

  function mechTraitCovered(name, desc) {
    if (MECH_TRAIT_DONE.indexOf(name) >= 0) return true;
    if (MECH_TRAIT_APPROX.indexOf(name) >= 0) return true;
    return MECH_TRAIT_PATTERNS.some(function (re) { return re.test(desc); });
  }

  function mechTraitFull(name, desc) {
    if (MECH_TRAIT_APPROX.indexOf(name) >= 0) return false;
    if (MECH_TRAIT_DONE.indexOf(name) >= 0) return true;
    return MECH_TRAIT_PATTERNS.some(function (re) { return re.test(desc); });
  }

  function coverageReport() {
    var pets = PETS, skills = SKILLS;
    var dmgSkills = skills.filter(function (x) { return x.p; });
    var statusSkills = skills.filter(function (x) { return !x.p; });
    var pats = [/(?:恢复|回复)\d+能量/, /(?:恢复|回复)(?:精灵)?\d+%生命/, /敌方获得\d+层/, /自己获得\d+层/,
      /减伤\d+%/, /(?:双攻|物攻|魔攻)[+＋]\d+%/, /威力[+＋]\d+/, /能耗[-−]\d+/, /敌方(?:获得|降低)速度[-−]\d+/,
      /(?:自己)?获得速度[+＋]\d+/, /(?:物防|魔防|双防)[+＋]\d+%/, /\d+连击/,
      /偷取敌方\d+能量/, /敌方失去\d+能量/, /敌方(?:获得)?全技能能耗[+＋]\d+/, /敌方获得(?:物攻|魔攻|双攻)[-−]\d+%/,
      /自己获得\d+%吸血/, /[\u4e00-\u9fa5]系技能威力永久[+＋]\d+%/, /将天气(?:改为|变为)[\u4e00-\u9fa5]{2,4}/,
      /自己获得连击数[+＋]\d+/, /敌方获得连击数[-−]\d+/,
      /敌方\d+回合禁足/, /威力永久[+＋]\d+/, /驱散敌方/, /萌化/, /驱散自己的减益/,
      /敌方获得(?:物防和魔防|物防|魔防|双防)[-−]\d+%/, /等于敌方技能总能耗的一半/,
      /敌方(?:除本回合使用的技能)?[^。]{0,10}技能能耗[+＋]\d+/, /星陨印记/,
      /减益的层数翻倍/, /获得连击数[+＋]\d+%/,
      /敌方获得威力[-−]\d+/, /额外造成\d+%幻系伤害/, /雨天的回合数延长/, /敌方下回合回复的能量[-−]\d+/,
      /己方队伍获得\d+次随机奉献/, /随机16层属性增益/, /随机获得1种/, /获得附加中毒\d+/, /返场|自己脱离/,
      /下一次攻击技能威力翻倍/, /增加\d+%物攻/, /精灵防御提升/, /群体强化|群体治疗/, /选择[：:]连击数/,
      /赋予敌方\d+层/, /测试增益/,
      /下回合受到的伤害降低\d+%/, /全属性增加\d+%/, /提升\d+%物攻以及魔攻/, /增加\d+%魔攻/,
      /对所有对手附加\d+层毒/, /首领技[，,]增加\d+%攻击/, /重置天气/, /每回合回1能量/, /获得威力增加\d+的印记/,
      /驱散回能/, /赋予破绽/, /威力等于敌方精灵技能总能耗的\d+倍/,
      /吸收随机1个对手所有能量/, /让对方离开战场/, /^脱离/, /强化所有友军/, /能耗降低至0/];
    var parseable = statusSkills.filter(function (x) {
      if (typeof STATUS_FX !== "undefined" && STATUS_FX[x.n]) return true;   // 手写实现优先
      // 应对！变体：基础技能可用即算可用
      if (/^应对！/.test(x.n)) {
        var bn = x.n.replace(/^应对！/, "");
        if (typeof STATUS_FX !== "undefined" && STATUS_FX[bn]) return true;
        var bs = SKILLS.filter(function (y) { return y.n === bn; })[0];
        if (bs) return pats.some(function (re) { return re.test(bs.d || ""); });
        return false;
      }
      var d = x.d || "";
      if (/场下|替补|队伍中|全体我方/.test(d)) return false;
      return pats.some(function (re) { return re.test(d); });
    });
    var traits = {};
    pets.forEach(function (x) { if (x.td && !traits[x.t]) traits[x.t] = x.td; });
    var traitNames = Object.keys(traits);
    var withNum = traitNames.filter(function (t) { return /[+＋]\d+%|[+＋]\d+(?!%)/.test(traits[t]); });
    var handled = 0, skipped = 0, skippedList = [];
    var savedBuffs = JSON.parse(JSON.stringify(state.buffs || {}));
    var savedCounter = (state.counters || {}).counter;
    state.counters = state.counters || {};
    state.counters.counter = 2;
    state.buffs = { mine: [{ n: "光合印记", st: 1, t: -1 }, { n: "萌化", st: 2, t: -1 }], foe: [{ n: "星陨印记", st: 2, t: -1 }, { n: "中毒", st: 2, t: -1 }] };
    // 用多种上下文各跑一次：只要任一条件下有规则命中（含“条件不满足”的 skipped），就算这个特性有实现
    var ctxs = [
      { sk: { e: "火", t: "物攻", c: 1, p: 50, d: "" }, first: true },
      { sk: { e: "水", t: "魔攻", c: 3, p: 50, d: "" }, first: false },
      { sk: { e: "普通", t: "物攻", c: 5, p: 50, d: "" }, first: true },
      { sk: { e: "地", t: "魔攻", c: 2, p: 50, d: "" }, first: false },
      { sk: { e: "翼", t: "物攻", c: 2, p: 50, d: "" }, first: false },
      { sk: { e: "状态", t: "状态", c: 0, p: null, d: "" }, first: false },
      { sk: { e: "武", t: "物攻", c: 2, p: 50, d: "" }, first: false },
      { sk: { e: "火", t: "物攻", c: 3, p: 50, d: "" }, first: false }
    ];
    withNum.forEach(function (t) {
      var hit = false;
      for (var i = 0; i < ctxs.length && !hit; i++) {
        var info = traitInfo({ n: "_" + i, td: traits[t], t: t }, ctxs[i].sk, traitCtx("mine"), "mine");
        if (info.mult !== 1 || info.notes.length || info.skipped.length) hit = true;
      }
      if (hit) handled++; else skippedList.push(t);
    });
    state.buffs = savedBuffs;
    state.counters.counter = savedCounter;
    window.__statusSkipped = statusSkills.filter(function (x) {
      if (typeof STATUS_FX !== "undefined" && STATUS_FX[x.n]) return false;
      var d = x.d || "";
      if (/场下|替补|队伍中|全体我方/.test(d)) return false;
      return !pats.some(function (re) { return re.test(d); });
    }).map(function (x) { return x.n; });
    var eventHandled = skippedList.filter(function (t) { return EVENT_TRAITS.indexOf(t) >= 0; }).length;
    var marks = ["攻击印记","风起印记","蓄势印记","蓄电印记","虫鸣印记","湿润印记","治疗印记","中毒印记","荆棘印记","棘刺印记","锐利印记","降灵印记","龙噬印记","光合印记","星陨印记","加速印记","减速印记"];
    var spriteCount = 0;
    pets.forEach(function (x) { if (window.SPRITES && window.SPRITES[x.n]) spriteCount++; });
    return {
      pets: pets.length, sprites: spriteCount,
      handWritten: statusSkills.filter(function (x) { return typeof STATUS_FX !== "undefined" && STATUS_FX[x.n]; }).length,
      skills: skills.length, dmgSkills: dmgSkills.length,
      statusSkills: statusSkills.length, parseable: parseable.length,
      statusUnparsed: statusSkills.filter(function (x) { return parseable.indexOf(x) < 0; }).map(function (x) { return x.n; }),
      traits: traitNames.length, traitsWithNum: withNum.length, traitsHandled: handled + eventHandled,
      traitsAuto: handled, traitsEvent: eventHandled, traitsSkipped: skipped,
      traitsSkippedNames: skippedList.filter(function (t) { return EVENT_TRAITS.indexOf(t) < 0; }),
      traitsEventNames: skippedList.filter(function (t) { return EVENT_TRAITS.indexOf(t) >= 0; }),
      mechTotal: (function () {
        var mech = 0;
        for (var k in traits) {
          var dd = traits[k];
          if (/[+＋]\d+%|[+＋]\d+(?!%)/.test(dd)) continue;
          mech++;
        }
        return mech;
      })(),
      mechHandled: (function () {
        var n0 = 0;
        for (var k2 in traits) {
          var d2 = traits[k2];
          if (/[+＋]\d+%|[+＋]\d+(?!%)/.test(d2)) continue;
          if (mechTraitCovered(k2, d2)) n0++;
        }
        return n0;
      })(),
      mechFull: (function () {
        var n1 = 0;
        for (var k4 in traits) {
          var d4 = traits[k4];
          if (/[+＋]\d+%|[+＋]\d+(?!%)/.test(d4)) continue;
          if (mechTraitFull(k4, d4)) n1++;
        }
        return n1;
      })(),
      mechApprox: (function () {
        var n2 = 0;
        for (var k5 in traits) {
          var d5 = traits[k5];
          if (/[+＋]\d+%|[+＋]\d+(?!%)/.test(d5)) continue;
          if (MECH_TRAIT_APPROX.indexOf(k5) >= 0) n2++;
        }
        return n2;
      })(),
      mechMissing: (function () {
        var out = [];
        for (var k3 in traits) {
          var d3 = traits[k3];
          if (/[+＋]\d+%|[+＋]\d+(?!%)/.test(d3)) continue;
          if (!mechTraitCovered(k3, d3)) out.push(k3);
        }
        return out.sort();
      })(),
      marks: marks.length
    };
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
    // 一键填入常用视觉服务
    var PRESETS = {
      DS:  { ep: "https://api.deepseek.com/chat/completions", model: "deepseek-flash",
             help: "DeepSeek：去 platform.deepseek.com 建 Key，模型是 deepseek-flash（deepseek-chat 不支持图片）。" },
      GLM: { ep: "https://open.bigmodel.cn/api/paas/v4/chat/completions", model: "glm-4v-flash",
             help: "智谱：去 bigmodel.cn 建 Key，glm-4v-flash 有免费额度。" }
    };
    function applyPreset(k) {
      var p = PRESETS[k]; if (!p) return;
      $("ocrEndpoint").value = p.ep;
      $("ocrModel").value = p.model;
      if ($("ocrHelp")) $("ocrHelp").textContent = p.help;
      try { msg("已填入 " + p.model + "，只需再填 API Key"); } catch (e) {}
    }
    if ($("ocrPresetDS")) $("ocrPresetDS").addEventListener("click", function () { applyPreset("DS"); });
    if ($("ocrPresetGLM")) $("ocrPresetGLM").addEventListener("click", function () { applyPreset("GLM"); });

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

    // 把一张截图的读数记成一条历史快照（复盘用，不回放动作）
    function pushSnapshot(label) {
      state.history = state.history || [];
      state.history.push({
        turn: state.history.length + 1,
        phase: "截图",
        mineHp: state.mine.hp, foeHp: state.foe.hp,
        mineEnergy: state.mine.energy, foeEnergy: state.foe.energy,
        mineMana: state.mine.mana, foeMana: state.foe.mana,
        meAct: "", foeAct: "",
        note: "截图导入" + (label ? "：" + label : "")
      });
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
          }).then(function (r) {
            return r.text().then(function (txt) {
              return { status: r.status, ok: r.ok, txt: txt };
            });
          }).then(function (res) {
            var j = null;
            try { j = JSON.parse(res.txt); } catch (e) {}
            if (!res.ok) {
              var em = (j && j.error && (j.error.message || j.error.code)) || res.txt.slice(0, 160);
              return resolve({ ok: false, msg: "HTTP " + res.status + "：" + em });
            }
            if (!j) return resolve({ ok: false, msg: "返回不是 JSON：" + res.txt.slice(0, 120) });
            var txt = (((j.choices || [])[0] || {}).message || {}).content || "";
            if (!txt) {
              var r2 = (j.error && j.error.message) || "模型没有返回内容";
              return resolve({ ok: false, msg: r2 });
            }
            var data = parseJsonFrom(txt);
            if (!data) return resolve({ ok: false, msg: "模型没按格式回 JSON：" + txt.slice(0, 100) });
            try { applyOcr(data); pushSnapshot(file.name); } catch (e) {}
            resolve({ ok: true, data: data });
          }).catch(function (e) {
            resolve({ ok: false, msg: "请求失败：" + e.message });
          });
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
      if (!ep || !model) return msg("点上面的「用 DeepSeek」一键填好，再填 Key", true);
      // 少写路径时自动补全
      if (/^https?:\/\/[^/]+\/?$/.test(ep)) ep = ep.replace(/\/$/, "") + "/chat/completions";
      if (/deepseek/i.test(ep) && /deepseek-chat|deepseek-reasoner/i.test(model)) {
        return msg("deepseek-chat 不支持图片，模型请改成 deepseek-flash", true);
      }
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

  // 手机悬浮窗：贴游戏 UI 的透明四键布局（我方在左、对手在右，技能位与游戏 1-4 号位对齐）
  function buildMobileHud() {
    if (document.getElementById("mhud")) return;
    var wrap = document.createElement("div");
    wrap.id = "mhud";
    wrap.className = "mhud ml-hud";
    wrap.innerHTML =
      "<div class='mlh-top'>" +
        "<span class='mlh-title' id='mhudTurn'>第 1 回合</span>" +
        "<span class='mlh-side hint' id='mhudNote'>一键模式：点招式＝记录</span>" +
      "</div>" +
      "<div class='mlh-cols'>" +
        "<section class='mlh-col mine' id='mhudMineCol'>" +
          "<header class='mlh-head'><b id='mhudMineName'>—</b><em id='mhudMineEle'></em></header>" +
          "<div class='mlh-grid' id='mhudMineMoves'></div>" +
        "</section>" +
        "<section class='mlh-col foe' id='mhudFoeCol'>" +
          "<header class='mlh-head'><b id='mhudFoeName'>—</b><em id='mhudFoeEle'></em></header>" +
          "<div class='mlh-grid' id='mhudFoeMoves'></div>" +
        "</section>" +
      "</div>" +
      "<div class='mlh-gear' id='mhudGear'>⚙</div>" +
      "<div class='mlh-set' id='mhudSet' hidden>" +
        "<button type='button' id='mhudOneTap' class='on'>一键：开</button>" +
        "<button type='button' id='mhudRepeat'>重复上回</button>" +
        "<button type='button' id='mhudUndo'>撤销</button>" +
        "<button type='button' id='mhudExit'>退出</button>" +
      "</div>";
    document.body.appendChild(wrap);

    var oneTap = true;
    try { oneTap = localStorage.getItem("luoke-onetap") !== "0"; } catch (e) {}
    function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
    function note(msg) { var n = $("mhudNote"); if (n) n.textContent = msg; }
    function moveSelEl(side) { return side === "mine" ? $("meMoveSel") : $("foeMoveSel"); }
    function actEl(side) { return side === "mine" ? $("meAction") : $("foeActionRec"); }
    function setAct(side, a) {
      var el = actEl(side);
      if (el) { el.value = a; el.dispatchEvent(new Event("change")); }
    }
    function setMove(side, name) {
      var el = moveSelEl(side);
      if (el) { el.value = name; el.dispatchEvent(new Event("change")); }
    }
    function record() {
      var before = state.history.length;
      $("recordTurn").click();
      buzz(12);
      paint();
      if (state.history.length > before) note("已记录第 " + state.history.length + " 回合");
      else note("没记上：先选我方和对手的招式");
    }
    function pick(side, name) {
      setMove(side, name);
      setAct(side, "attack");
      if (!oneTap) { note("已选 " + name + "，点「出招」记录"); return; }
      if (side === "mine") record();
      else note("对手：已选 " + name + "，等我方出招后一起记");
    }
    function actAndMaybeRecord(side, a) {
      setAct(side, a);
      paint();
      if (oneTap && side === "mine") record();
      else note((side === "mine" ? "我" : "敌") + "：" + ({ charge: "聚能", switch: "换人", attack: "出招" }[a] || a) + "，点出一招记录");
    }

    // 当前侧显示的是「动作」还是「招式」：出招点开后换成 4 个技能
    var mode = { mine: "act", foe: "act" };

    function paintSide(side) {
      var p = side === "mine" ? "Mine" : "Foe";
      var st = sideStats(side);
      $("mhud" + p + "Name").textContent = st.pet.n;
      $("mhud" + p + "Ele").textContent = (st.pet.el || "") + (st.pet.el2 ? "·" + st.pet.el2 : "");
      var g = $("mhud" + p + "Moves");
      if (!g) return;
      var curSel = (moveSelEl(side) || {}).value || "";
      var curAct = (actEl(side) || {}).value || "attack";
      if (mode[side] === "moves") {
        g.innerHTML = (state[side].moves || []).map(function (n) {
          var k = n ? skillByName(n) : null;
          return "<button type='button' class='mlh-btn mlh-move" + (k && curSel === k.n ? " on" : "") + "'" +
            (k ? " data-pick='" + side + "|" + k.n + "' data-el='" + (k.e || "?") + "'" : " disabled") + ">" +
            "<i class='mlh-k'>" + (k ? (k.e || "?") : "空") + "</i>" +
            "<span>" + (k ? k.n : "空") + "</span></button>";
        }).join("");
      } else {
        g.innerHTML =
          "<button type='button' class='mlh-btn mlh-act" + (curAct === "attack" ? " on" : "") + "' data-act-mode='" + side + "'>出招</button>" +
          "<button type='button' class='mlh-btn mlh-act" + (curAct === "charge" ? " on" : "") + "' data-act='" + side + "|charge'>聚能</button>" +
          "<button type='button' class='mlh-btn mlh-act" + (curAct === "switch" ? " on" : "") + "' data-act='" + side + "|switch'>换人</button>" +
          "<button type='button' class='mlh-btn mlh-act' data-act='" + side + "|item'>道具</button>";
      }
    }

    function paint() {
      paintSide("mine");
      paintSide("foe");
      var t = $("mhudTurn");
      if (t) t.textContent = "第 " + (state.history.length + 1) + " 回合";
    }

    wrap.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-pick],[data-act],[data-act-mode]") : null;
      if (!t) return;
      var side = t.getAttribute("data-act-mode");
      if (side) { mode[side] = "moves"; paint(); return; }
      var pk = t.getAttribute("data-pick");
      if (pk) { var a = pk.split("|"); pick(a[0], a[1]); return; }
      var ac = t.getAttribute("data-act");
      if (ac) { var b = ac.split("|"); actAndMaybeRecord(b[0], b[1]); }
    });
    // 招式格长按 = 收起回到动作
    wrap.addEventListener("pointerdown", function (e) {
      var t = e.target.closest ? e.target.closest("[data-pick]") : null;
      if (!t) return;
      var side = t.getAttribute("data-pick").split("|")[0];
      var timer = setTimeout(function () { mode[side] = "act"; paint(); }, 460);
      var clear = function () { clearTimeout(timer); };
      t.addEventListener("pointerup", clear, { once: true });
      t.addEventListener("pointercancel", clear, { once: true });
      t.addEventListener("pointerleave", clear, { once: true });
    });

    $("mhudOneTap").addEventListener("click", function () {
      oneTap = !oneTap;
      try { localStorage.setItem("luoke-onetap", oneTap ? "1" : "0"); } catch (e) {}
      this.textContent = "一键：" + (oneTap ? "开" : "关");
      this.className = oneTap ? "on" : "";
      note(oneTap ? "一键模式：点招式＝记录" : "手动模式：选招后点记录");
    });
    $("mhudRepeat").addEventListener("click", function () {
      var h = state.history[state.history.length - 1];
      if (!h) return;
      ["mine", "foe"].forEach(function (side) {
        var a = side === "mine" ? h.meAct : h.foeAct;
        var mv = side === "mine" ? h.meMove : h.foeMove;
        if (a) setAct(side, a);
        if (mv) setMove(side, mv);
      });
      record();
    });
    $("mhudUndo").addEventListener("click", function () { if ($("undoTurn")) $("undoTurn").click(); paint(); });
    $("mhudGear").addEventListener("click", function () {
      var s = $("mhudSet");
      s.hidden = !s.hidden;
    });
    var wakeLock = null;
    function keepAwake() {
      if (!navigator.wakeLock || !document.body.classList.contains("hud-mode")) return;
      try { navigator.wakeLock.request("screen").then(function (w) { wakeLock = w; }).catch(function () {}); } catch (e) {}
    }
    keepAwake();
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") keepAwake(); });
    $("mhudExit").addEventListener("click", function () {
      if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
      wrap.remove();
      document.body.classList.remove("hud-mode");
      if (history.replaceState) history.replaceState(null, "", location.pathname);
    });
    $("mhudOneTap").textContent = "一键：" + (oneTap ? "开" : "关");
    note(oneTap ? "一键模式：点招式＝记录" : "手动模式：选招后点记录");
    window.__paintHud = paint;
    paint();
  }
  // 小窗（HUD）模式：?hud=1 时只留对战区
  function runHudMode() {
    if (!/[?&]hud=1/.test(location.search)) return;
    document.body.classList.add("hud-mode");
    // 手机分屏/系统小窗通常高度 < 620：自动进紧凑布局
    if (/[?&]compact=1/.test(location.search) || window.innerHeight < 620) {
      document.body.classList.add("hud-compact");
    }
    setTimeout(function () {
      var pnl = $("miniPanel"), tg = $("miniToggle");
      if (pnl) { pnl.hidden = true; pnl.style.display = "none"; }
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

  /** 打开发战面板（悬浮窗）：安卓用原生悬浮层，浏览器/电脑用独立窗口 */
  function openOverlayWindow() {
    // 电脑版（应用内窗口）
    try {
      if (window.pcHud && typeof window.pcHud.showOverlay === "function") {
        window.pcHud.showOverlay();
        return;
      }
    } catch (e) {}
    // 安卓
    try {
      if (window.Android && typeof window.Android.startOverlay === "function") {
        window.Android.startOverlay();
        return;
      }
      if (window.Android && typeof window.Android.showOverlay === "function") {
        window.Android.showOverlay();
        return;
      }
    } catch (e) {}
    // 普通浏览器：打开悬浮窗页面（自带底部栏，因为 desktop=1）
    var url = "battle-deck.html?layer=back&desktop=1";
    var w = window.open(
      url,
      "luokeOverlay",
      "width=" + (window.screen.width || 1280) + ",height=" + (window.screen.height || 800) +
      ",menubar=no,toolbar=no,location=no,status=no"
    );
    if (w) { try { w.focus(); } catch (e) {} return w; }
    // 弹窗被拦截，就在本页打开
    location.href = url;
  }
  window.__openOverlayWindow = openOverlayWindow;

  /** 被悬浮框嵌入时（?embed=1）：隐藏顶部按钮与浮动按钮，只留内容 */
  function runEmbedMode() {
    if (!/[?&]embed=1/.test(location.search)) return;
    document.body.classList.add("embed-mode");

    // 隐藏计算器自己的顶部按钮与浮动按钮
    var top = document.querySelector(".topbar");
    if (top) top.style.display = "none";
    var appbar = document.querySelector(".appbar");
    if (appbar) appbar.style.display = "none";
    ["hudToggle", "overlayBtn", "miniToggle"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    // 默认切到「对战」视图：直接改 class 和 id
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var battle = document.getElementById("view-battle");
      if (battle) {
        Array.prototype.forEach.call(document.querySelectorAll(".view"), function (v) { v.classList.remove("on"); });
        Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { t.classList.remove("on"); });
        battle.classList.add("on");
        var bt = document.querySelector('.tabbar .tab[data-view="battle"]');
        if (bt) bt.classList.add("on");
        clearInterval(timer);
      } else if (tries > 30) {
        clearInterval(timer);
      }
      if (tries > 30) {
        var bar = document.querySelector(".tabbar");
        if (bar) bar.style.display = "none";
      }
    }, 100);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runEmbedMode);
  } else {
    runEmbedMode();
  }

  // 悬浮录入面板：4 个招式按钮 + 聚能/换人/应对 + 记录/撤销
  function initMiniPanel() {
    var panel = $("miniPanel"), toggle = $("miniToggle");
    // 悬浮录入面板已移除，仅保留「小窗」按钮逻辑
    if (!panel || !toggle) {
      var hudOnly = $("hudToggle");
      if (hudOnly && !hudOnly.__bound) {
        hudOnly.__bound = true;
        hudOnly.addEventListener("click", function () {
          var w = window.open("calculator.html?hud=1", "luokeHud", "width=380,height=760,menubar=no,toolbar=no");
          if (w) w.focus();
        });
      }
      var ovBtn = $("overlayBtn");
      if (ovBtn && !ovBtn.__bound) {
        ovBtn.__bound = true;
        ovBtn.style.display = "";    // 始终显示
        ovBtn.addEventListener("click", function () { openOverlayWindow(); });
      }
      return;
    }
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

  // ===== 技能选择面板（安卓没有 datalist，改成只读入口 + 面板）=====
  var __skPanel = null, __skInput = null, __skQuery = "";

  function __allSkillNames() {
    var names = SKILLS.map(function (s) { return s.n; });
    Object.keys(CUSTOM_SEED || {}).forEach(function (n) {
      if (names.indexOf(n) < 0) names.push(n);
    });
    return names;
  }

  function __closeSkPanel() {
    if (__skPanel && __skPanel.parentNode) __skPanel.parentNode.removeChild(__skPanel);
    __skPanel = null;
    __skInput = null;
    __skQuery = "";
  }

  function __renderSkList() {
    if (!__skPanel) return;
    var all = __allSkillNames();
    var q = __skQuery.trim();
    var list = q ? all.filter(function (n) { return n.indexOf(q) >= 0; }) : all;
    list = list.slice(0, 300);
    var box = __skPanel.querySelector(".skp-list");
    if (!list.length && q) {
      box.innerHTML = "<div class='skp-empty'>没有匹配的技能<br><span>可直接用「" + q + "」</span></div>" +
        "<div class='skp-item' data-custom='1'><span class='skp-n'>使用「" + q + "」</span></div>";
    } else {
      box.innerHTML = list.map(function (n) {
        var sk = skillByName(n) || {};
        return "<div class='skp-item' data-n='" + String(n).replace(/'/g, "&#39;") + "'>" +
          "<span class='skp-n'>" + n + "</span>" +
          "<span class='skp-m'>" + (sk.e || "") + (sk.p == null ? "" : " · 威力 " + sk.p) +
          (sk.c == null ? "" : " · 耗能 " + sk.c) + "</span></div>";
      }).join("");
    }

    Array.prototype.forEach.call(box.querySelectorAll(".skp-item"), function (it) {
      it.addEventListener("click", function () {
        var v = it.getAttribute("data-custom") ? __skQuery.trim() : it.getAttribute("data-n");
        if (!v) return;
        if (__skInput) {
          var old = __skInput.value;
          __skInput.value = v;
          // readonly 输入框的 change 不一定触发，这里两种都派发；同时兜底直接调回调
          try { __skInput.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
          try { __skInput.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
          if (__skInput.value !== v) __skInput.value = v;
          if (old === v && typeof __skInput.__skApply === "function") __skInput.__skApply(v);
        }
        __closeSkPanel();
      });
    });
  }

  function __openSkPanel(input) {
    __closeSkPanel();
    __skInput = input;
    __skQuery = "";

    var mask = document.createElement("div");
    mask.className = "skp-mask";
    mask.innerHTML =
      "<div class='skp-panel'>" +
        "<div class='skp-head'><b>选择技能</b><button type='button' class='skp-x'>×</button></div>" +
        "<div class='skp-search'><input class='skp-q' placeholder='搜索技能名（可不填）'></div>" +
        "<div class='skp-list'></div>" +
      "</div>";
    document.body.appendChild(mask);
    __skPanel = mask;
    __renderSkList();

    mask.querySelector(".skp-x").addEventListener("click", __closeSkPanel);
    mask.addEventListener("click", function (e) { if (e.target === mask) __closeSkPanel(); });

    var qi = mask.querySelector(".skp-q");
    qi.addEventListener("input", function () { __skQuery = qi.value; __renderSkList(); });
    // 键盘弹出时压缩面板高度，保证列表可见
    if (window.visualViewport) {
      var fit = function () {
        if (!__skPanel) return;
        var p = __skPanel.querySelector(".skp-panel");
        if (p) p.style.maxHeight = Math.max(220, window.visualViewport.height - 90) + "px";
      };
      window.visualViewport.addEventListener("resize", fit);
      fit();
    }
  }

  function __attachSkillPicker(input) {
    if (!input || input.__skBound) return;
    input.__skBound = true;
    input.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      __openSkPanel(input);
    });
  }

  function __bindSkillPickers(root) {
    Array.prototype.forEach.call(
      (root || document).querySelectorAll("input.mpick"),
      __attachSkillPicker
    );
  }
  window.__bindSkillPickers = __bindSkillPickers;
  setTimeout(function () { try { __bindSkillPickers(); } catch (e) {} }, 0);
  setTimeout(function () { try { __bindSkillPickers(); } catch (e) {} }, 800);
  try {
    new MutationObserver(function () { try { __bindSkillPickers(); } catch (e) {} })
      .observe(document.body, { childList: true, subtree: true });
  } catch (e) {}


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
// 给独立布局页（mobile-landscape.html）与测试用的桥接层
  window.buildMobileHud = function () { return buildMobileHud(); };
  window.__lsReady = function () { return !!state && Array.isArray(SKILLS); };
  window.__lsState = function () { return state; };
  window.__lsSkill = function (n) { return n ? skillByName(n) : null; };
  window.__lsSideStats = function (side) { return { pet: sidePet(side), stats: sideStats(side).stats, raw: state[side] }; };
  window.__lsHistory = function () { return state.history || []; };

  /* 给悬浮作战页用：返回某一侧 4 个招式的完整文案（与计算器卡片一致） */
  window.__lsMoveCards = function (side) {
    try {
      var attacker = sideStats(side);
      var other = side === "mine" ? "foe" : "mine";
      var defender = sideStats(other);
      var raw = (side === "mine" ? state.mine.moves : state.foe.moves) || [];
      var hpNow = Number(side === "mine" ? state.mine.hp : state.foe.hp) || 0;
      var out = [];
      raw.forEach(function (n) {
        var sk0 = skillByName(n);
        if (!sk0 || !sk0.n) return;
        if (!sk0.p) {
          out.push({
            name: sk0.n, kind: sk0.t || "状态",
            dmg: null, pct: 0, cost: Number(sk0.c) || 0,
            note: (sk0.d || "").replace(/^✦/, "").slice(0, 120),
            notes: [], skipped: [], stab: false, energyShort: false, preview: "", predict: "", score: null
          });
          return;
        }
        var eff = effSkill(side, sk0, attacker);
        var ti = traitInfo(attacker.pet, eff || sk0, traitCtx(), side);
        var dmg = hitDamage(side, sk0, attacker, defender, -1, false);
        var pct = hpNow > 0 ? Math.min(100, dmg / hpNow * 100) : 0;
        var cost = costOf(side, sk0);
        var item = {
          name: sk0.n,
          kind: sk0.t || "物攻",
          dmg: Math.round(dmg),
          pct: Math.round(pct),
          cost: cost,
          stab: isStab(eff || sk0, attacker.pet),
          notes: (ti && ti.notes) || [],
          skipped: (ti && ti.skipped) || [],
          energyShort: side === "mine" && (Number(state.mine.energy) || 0) < cost,
          preview: (typeof previewLine === "function") ? previewLine(side, sk0, dmg, defender, hpNow) : "",
          predict: "",
          score: null
        };
        if (side === "mine") {
          var best = 0;
          var foeMoves = (state.foe.moves || []);
          foeMoves.forEach(function (fn) {
            var k = fn ? skillByName(fn) : null;
            if (!k || !k.p) return;
            var d2 = hitDamage("foe", k, defender, attacker);
            if (d2 > best) best = d2;
          });
          var myHpLeft = Number(state.mine.hp) || 0;
          item.predict = opponentLean(hpNow - dmg);
          item.score = stateDelta(dmg >= hpNow, myHpLeft - best, best, (Number(state.mine.energy) || 0) - cost);
        }
        out.push(item);
      });
      return out;
    } catch (e) { return []; }
  };

  /* ---- 导出 6×6 对位数据，供 matrix/route/winrate 三个页面使用 ----
   * T[i][j] = [我方击杀所需回合, 对方击杀所需回合]
   * 用当前双方 6 只、各自 4 招里"对目标期望伤害最高"的那一招，
   * 按 60 级 / 5 星 / 个体 10 / 中性性格计算，不含局内 buff/印记。
   */
  /* ---- 精确版：用完整伤害引擎（含特性/印记/道具/天气/克制）算 6×6 对位 ----
   * 做法：临时切换双方 active 到 (i, j)，用 hitDamage 逐招计算，再整体还原 state。
   * 比简化版慢（36 对位 × 8 招），但和计算器里看到的数字一致。
   */
  window.__lsDuelDataFull = function () {
    var snapshot = null;
    try {
      var sideCount = function (side) {
        var s = state[side] || {};
        return (Array.isArray(s.slots) ? s.slots.filter(Boolean) : []).length;
      };
      var nMy = sideCount("mine"), nFoe = sideCount("foe");
      if (!nMy || !nFoe) return { ok: false, why: '双方阵容不全' };

      snapshot = JSON.stringify(state);

      // 取某槽位的 4 招：优先用该槽位已配招式
      var movesOf = function (side, idx) {
        var s = state[side];
        var cur = s.active;
        s.active = idx;
        var pet = sidePet(side);
        var list = [];
        var arr = Array.isArray(s.moves) ? s.moves : [];
        arr.forEach(function (n) {
          var sk = skillByName(n);
          // 保留防御/状态技：减伤信息在它们身上；无威力的招在 bestHit 里自然是 0
          if (sk && sk.n) list.push(sk);
        });
        if (!list.length && pet) {
          var ls = learnsetOf(pet.n) || [];
          (ls.s || []).forEach(function (n) {
            var sk = skillByName(n);
            if (sk && sk.n && Number(sk.p) > 0) list.push(sk);
          });
          list.sort(function (a, b) {
            var sa = (a.e === pet.el || a.e === pet.el2) ? 1 : 0;
            var sb = (b.e === pet.el || b.e === pet.el2) ? 1 : 0;
            if (sa !== sb) return sb - sa;
            return (Number(b.p) || 0) - (Number(a.p) || 0);
          });
          list = list.slice(0, 4);
        }
        s.active = cur;
        return list;
      };

      var bestHit = function (side, idx, moves) {
        var cur = state[side].active;
        state[side].active = idx;
        var atk = sideStats(side);
        var def = sideStats(side === "mine" ? "foe" : "mine");
        var best = 0;
        moves.forEach(function (sk) {
          try {
            var d = hitDamage(side, sk, atk, def, -1, false);
            if (d > best) best = d;
          } catch (e) {}
        });
        state[side].active = cur;
        return best;
      };

      var myMoves = [], foeMoves = [];
      for (var i0 = 0; i0 < nMy; i0++) myMoves[i0] = movesOf("mine", i0);
      for (var j0 = 0; j0 < nFoe; j0++) foeMoves[j0] = movesOf("foe", j0);

      // 返回该槽位的 { max, cur }：场上这只是残血就按真实血量算，其余按满血
      var hpOf = function (side, idx) {
        var cur = state[side].active;
        state[side].active = idx;
        var st = sideStats(side).stats;
        var max = st.hp;
        var now = max;
        if (idx === cur) {
          var h = Number(state[side].hp);
          if (Number.isFinite(h) && h >= 0) now = Math.min(max, h);
        }
        state[side].active = cur;
        return { max: max, cur: Math.max(1, now) };
      };

      // 解析某槽位 4 招里最强的减伤（防御技）
      var mitOf = function (side, idx, moves) {
        var best = 0;
        (moves || []).forEach(function (sk) {
          var m = /减伤\s*(\d+)%/.exec(sk.d || "");
          if (m) best = Math.max(best, Number(m[1]) || 0);
        });
        return best;
      };
      var mitM = [], mitF = [], T = [], T0 = [], myOut = [], foeOut = [];
      for (var i = 0; i < nMy; i++) {
        var curM = state.mine.active;
        state.mine.active = i;
        var pM = sidePet("mine");
        var sM = sideStats("mine").stats;
        state.mine.active = curM;
        myOut.push({ n: pM.n, t: [pM.el, pM.el2].filter(Boolean).join('/'), spd: sM.spe });

        var row = [], rowM = [];
        mitM.push(mitOf("mine", i, myMoves[i]));
        for (var j = 0; j < nFoe; j++) {
          state.mine.active = i; state.foe.active = j;
          var hF = hpOf("foe", j), hM = hpOf("mine", i);
          var hpFoe = hF.cur, hpMy = hM.cur;   // 用当前血量（残血按残血算）
          var dmgOut = bestHit("mine", i, myMoves[i]);
          var dmgIn = bestHit("foe", j, foeMoves[j]);
          // 防御技模型：开一次防御 = 少打一回合，但吃到的第一下按减伤算
          //   我方开防御 → 我方击杀延后 1 回合；对方第一下打我只算 (1-mit)
          //   对方开防御 → 对称处理
          var mMit = mitOf("mine", i, myMoves[i]);
          var fMit = mitOf("foe", j, foeMoves[j]);

          var rMine = dmgOut > 0 ? Math.ceil(hpFoe / dmgOut) : 99;
          var rFoe = dmgIn > 0 ? Math.ceil(hpMy / dmgIn) : 99;
          if (mMit > 0 && dmgIn > 0) {
            var rest = Math.max(0, hpMy - dmgIn * (1 - mMit / 100));
            rFoe = 1 + (rest > 0 ? Math.ceil(rest / dmgIn) : 0);
            rMine = rMine + 1;
          }
          if (fMit > 0 && dmgOut > 0) {
            var rest2 = Math.max(0, hpFoe - dmgOut * (1 - fMit / 100));
            rMine = Math.min(rMine, 99);
            rMine = 1 + (rest2 > 0 ? Math.ceil(rest2 / dmgOut) : 0);
            rFoe = rFoe + 1;
          }
          var dmgOutAdj = rMine > 0 ? 1 / rMine : 0;
          var dmgInAdj = rFoe > 0 ? 1 / rFoe : 0;
          state.mine.active = curM;
          rowM.push([
            Math.min(99, Math.max(1, rMine)),
            Math.min(99, Math.max(1, rFoe))
          ]);
          row.push([
            dmgOut > 0 ? Math.max(1, Math.ceil(hpFoe / dmgOut)) : 99,
            dmgIn > 0 ? Math.max(1, Math.ceil(hpMy / dmgIn)) : 99
          ]);
        }
        T0.push(row); T.push(rowM);
      }

      for (var j = 0; j < nFoe; j++) {
        var curF = state.foe.active;
        state.foe.active = j;
        var pF = sidePet("foe");
        var sF = sideStats("foe").stats;
        state.foe.active = curF;
        foeOut.push({ n: pF.n, t: [pF.el, pF.el2].filter(Boolean).join('/'), spd: sF.spe });
        mitF.push(mitOf("foe", j, foeMoves[j]));
      }

      state = JSON.parse(snapshot);
      try { if (typeof renderAll === "function") renderAll(); } catch (e) {}

      // 血量比例，页面用来标注"残血"
      var ratioM = [], ratioF = [];
      for (var r1 = 0; r1 < myOut.length; r1++) { var q1 = hpOf("mine", r1); ratioM.push(+(q1.cur / q1.max).toFixed(3)); }
      for (var r2 = 0; r2 < foeOut.length; r2++) { var q2 = hpOf("foe", r2); ratioF.push(+(q2.cur / q2.max).toFixed(3)); }
      return { ok: true, my: myOut, foe: foeOut, T: T, T0: T0, mitM: mitM, mitF: mitF, hpM: ratioM, hpF: ratioF, src: 'calc-full', at: Date.now() };
    } catch (e) {
      try { if (snapshot) { state = JSON.parse(snapshot); if (typeof renderAll === "function") renderAll(); } } catch (e2) {}
      return { ok: false, why: String(e && e.message || e) };
    }
  };

  /* ---- 自动同步：计算器一改，三个对战页面跟着变 ---- */
  var _duelTimer = null;
  var _duelBc = null;
  function duelChannel() {
    if (_duelBc !== null) return _duelBc;
    try { _duelBc = new BroadcastChannel("luoke-duel"); } catch (e) { _duelBc = false; }
    return _duelBc;
  }
  function scheduleDuelSync() {
    if (_duelTimer) clearTimeout(_duelTimer);
    _duelTimer = setTimeout(function () {
      _duelTimer = null;
      try { syncDuelData(); } catch (e) {}
    }, 600);
  }
  function syncDuelData() {
    var fn = window.__lsDuelDataFull || window.__lsDuelData;
    if (typeof fn !== "function") return;
    var d = null;
    try { d = fn(); } catch (e) { return; }
    if (!d || !d.ok) return;
    d.at = Date.now();
    try { localStorage.setItem("luoke.duel.data", JSON.stringify(d)); } catch (e) {}
    var ch = duelChannel();
    if (ch) { try { ch.postMessage({ type: "duel-data", at: d.at }); } catch (e) {} }
  }
  window.__syncDuelData = syncDuelData;
  window.__scheduleDuelSync = scheduleDuelSync;

  window.__lsDuelData = function () {
    try {
      var mk = function (side) {
        var s = state[side] || {};
        var slots = Array.isArray(s.slots) ? s.slots : [];
        var out = [];
        for (var k = 0; k < slots.length; k++) {
          var nm = slots[k];
          if (!nm) continue;
          var pet = (typeof petByName === "function" ? petByName(nm) : null) || null;
          if (!pet) { pet = (PETS || []).filter(function (x) { return x && x.n === nm; })[0]; }
          if (!pet) continue;
          var st = computeStats(pet, { level: 60, stars: 5, iv: null, nature: null });
          var mv = movesOfPet(pet, side);
          out.push({ n: pet.n, t: [pet.el, pet.el2].filter(Boolean).join('/'), spd: st.spe, _pet: pet, _st: st, _mv: mv });
        }
        return out;
      };

      var movesOfPet = function (pet, side) {
        // 优先用计算器里当前选中的招式（更贴近实战），否则退回可学招式里最强的
        var picked = [];
        try {
          var s = state[side] || {};
          if (Array.isArray(s.moves)) picked = s.moves.slice();
        } catch (e) {}
        var names = picked.filter(Boolean);
        if (!names.length) {
          var ls = (typeof learnsetOf === "function" ? learnsetOf(pet.n) : null) || [];
          names = (ls && ls.s) ? ls.s.slice() : [];
        }
        var list = names.map(function (n) { return skillByName(n); }).filter(function (s) { return s && s.n && Number(s.p) > 0; });
        // 优先本系 + 高威力
        list.sort(function (a, b) {
          var sa = (a.e === pet.el || a.e === pet.el2) ? 1 : 0;
          var sb = (b.e === pet.el || b.e === pet.el2) ? 1 : 0;
          if (sa !== sb) return sb - sa;
          return (Number(b.p) || 0) - (Number(a.p) || 0);
        });
        return list;
      };

      var atkOf = function (st, sk) { return (sk && String(sk.t).indexOf('魔') >= 0) ? st.ma : st.atk; };
      var defOf = function (st, sk) { return (sk && String(sk.t).indexOf('魔') >= 0) ? st.md : st.def; };

      var bestDmg = function (a, d) {   // a 打 d 的最大期望伤害
        var best = 0;
        (a._mv || []).forEach(function (sk) {
          var stab = (sk.e === a._pet.el || sk.e === a._pet.el2) ? 1.25 : 1;
          var tm = typeMult(sk.e, d._pet);
          var dmg = (Number(sk.p) || 0) * atkOf(a._st, sk) / Math.max(1, defOf(d._st, sk)) * (37 / 41) * stab * tm;
          if (dmg > best) best = dmg;
        });
        return best;
      };

      var my = mk('mine'), foe = mk('foe');
      if (!my.length || !foe.length) return { ok: false, why: '双方阵容不全' };

      var T = my.map(function (a) {
        return foe.map(function (d) {
          var dmgOut = bestDmg(a, d);           // 我打对方
          var dmgIn = bestDmg(d, a);            // 对方打我
          var tm = dmgOut > 0 ? Math.max(1, Math.ceil(d._st.hp / dmgOut)) : 99;
          var tf = dmgIn > 0 ? Math.max(1, Math.ceil(a._st.hp / dmgIn)) : 99;
          return [tm, tf];
        });
      });

      var clean = function (arr) {
        return arr.map(function (x) { return { n: x.n, t: x.t, spd: x.spd }; });
      };
      return {
        ok: true,
        my: clean(my),
        foe: clean(foe),
        T: T,
        src: 'calc',
        at: Date.now()
      };
    } catch (e) {
      return { ok: false, why: String(e && e.message || e) };
    }
  };

  window.__lsOneTap = true;
  window.__lsMoveSel = function (side) {
    if (side === "mine" && $("meMoveSel")) return $("meMoveSel").value || "";
    if (side === "foe" && $("foeMoveSel")) return $("foeMoveSel").value || "";
    return (state[side].moves && state[side].moves[0]) || "";
  };
  window.__lsAct = function (side) {
    if (side === "mine" && $("meAction")) return $("meAction").value || "attack";
    if (side === "foe" && $("foeActionRec")) return $("foeActionRec").value || "attack";
    return "attack";
  };
  window.__lsSetMove = function (side, name) {
    var el = side === "mine" ? $("meMoveSel") : $("foeMoveSel");
    if (el) { el.value = name; el.dispatchEvent(new Event("change")); }
    var a = side === "mine" ? $("meAction") : $("foeActionRec");
    if (a) { a.value = "attack"; a.dispatchEvent(new Event("change")); }
  };
  window.__lsSetAct = function (side, act) {
    var a = side === "mine" ? $("meAction") : $("foeActionRec");
    if (a) { a.value = act; a.dispatchEvent(new Event("change")); }
  };
  window.__lsPhase = function () { return phaseOf((state.history || []).length + 1, {}); };
  window.__lsPreview = function () { var b = $("actPreview"); return b ? (b.innerText || "").trim() : ""; };
  // 原生截图/OCR 回填：只填识别明确的字段，不硬猜
  // 计算器顶部：显示最近一次截图回填内容，并能撤销
  function renderScreenshotBanner() {
    var host = document.getElementById("shotBanner");
    if (!host) {
      host = document.createElement("div");
      host.id = "shotBanner";
      host.style.cssText = "display:none;align-items:center;gap:8px;flex-wrap:wrap;" +
        "margin:6px 0;padding:6px 10px;border-radius:10px;font-size:12px;" +
        "background:#eef3fb;border:1px solid #c8d8ee;color:#2c4460";
      var bar = document.querySelector(".app .topbar");
      if (bar && bar.parentNode) bar.parentNode.insertBefore(host, bar.nextSibling);
      else document.body.insertBefore(host, document.body.firstChild);
    }
    var info = window.__lastScreenshotFill;
    if (!info || Date.now() - info.at > 10 * 60 * 1000) { host.style.display = "none"; return; }
    host.style.display = "flex";
    host.innerHTML = "<b>截图回填</b><span>" +
      (info.changed.length ? info.changed.join("、") : "无变化") + "</span>" +
      "<button type='button' id='shotUndo' style='margin-left:auto;font:inherit;padding:2px 10px;" +
      "border-radius:6px;border:1px solid #9db4d0;background:#fff;cursor:pointer'>撤销</button>";
    var btn = document.getElementById("shotUndo");
    if (btn) btn.onclick = function () {
      try {
        var snap = window.__shotUndoSnapshot;
        if (snap) { state = JSON.parse(snap); save(); renderAll(); }
      } catch (e) {}
      // 另一个 WebView（悬浮 HUD / 主计算器）推来的 state：只同步数据，不重建页面
  window.__lcApplyRemoteState = function (json) {
    try {
      var next = JSON.parse(json);
      if (!next || !next.mine || !next.foe) return false;
      if (state && next.history && state.history && next.history.length < state.history.length) return false;
      state = next;
      try { normalizeSave(state); } catch (e) {}
      renderAll();
      try { renderScreenshotBanner(); } catch (e) {}
      return true;
    } catch (e) { return false; }
  };

  // 悬浮 HUD 的动作：{ action: 'attack', side: 'mine', move: '闪燃' } / { action: 'charge'|'switch'|'item' }
  window.__applyHudAction = function (data) {
    if (!data) return "空动作";
    var side = data.side === "foe" ? "foe" : "mine";
    var act = data.action || "attack";
    try {
      if (window.__lsSetAct) window.__lsSetAct(side, act === "attack" ? "attack" : act);
      if (act === "attack" && data.move && window.__lsSetMove) window.__lsSetMove(side, data.move);
      if (data.record !== false && side === "mine") {
        var before = (state.history || []).length;
        var btn = document.getElementById("recordTurn");
        if (btn) btn.click();
        var after = (state.history || []).length;
        renderAll();
        return after > before ? "已记录第 " + after + " 回合" : "已选，未记录";
      }
      renderAll();
      return "已设 " + act + (data.move ? "：" + data.move : "");
    } catch (e) { return "失败：" + (e.message || e); }
  };

  window.__lastScreenshotFill = null;
      renderScreenshotBanner();
    };
  }
  window.__renderScreenshotBanner = renderScreenshotBanner;

  window.__lastScreenshotFill = null;
  window.__applyScreenshotData = function (data) {
    if (!data) return "空数据";
    try { window.__shotUndoSnapshot = JSON.stringify(state); } catch (e) {}
    var changed = [];
    function setTeam(side, list) {
      if (!Array.isArray(list) || list.length < 3) return;
      var valid = list.slice(0, 6).map(function (n) { return byName[n] ? n : ""; });
      if (valid.filter(Boolean).length < 3) return;
      while (valid.length < 6) valid.push("");
      state[side].slots = valid;
      state[side].active = Math.max(0, valid.findIndex(Boolean));
      state[side].benchKey = null;
      state[side].bench = null;
      changed.push((side === "mine" ? "我方" : "敌方") + "阵容");
    }
    function setHp(side, val, pct, max) {
      var v = Number(val);
      var s = state[side];
      var maxHp = sideStats(side).stats.hp;
      if (!(v > 0) && Number(pct) > 0) v = Math.round(maxHp * Number(pct) / 100);
      if (!(v > 0)) return;
      v = Math.min(v, maxHp);
      s.hp = v;
      s.hp0 = v;
      if (s.bench && s.bench[s.active]) s.bench[s.active].hp = v;
      changed.push((side === "mine" ? "我方" : "敌方") + " HP " + v);
    }
    function setName(side, name) {
      if (!name || !byName[name]) return;
      var s = state[side];
      if (!s.slots || !s.slots.length) return;
      s.slots[s.active] = name;
      s.benchKey = null;
      changed.push((side === "mine" ? "我方" : "敌方") + " " + name);
    }
    function setSkills(side, list) {
      if (!Array.isArray(list) || !list.length) return;
      var valid = list.filter(function (n) { return !!skillByName(n); }).slice(0, 4);
      if (!valid.length) return;
      var cur = (state[side].moves || []).slice();
      for (var i = 0; valid.length < 4 && i < cur.length; i++) {
        if (cur[i] && valid.indexOf(cur[i]) < 0) valid.push(cur[i]);
      }
      state[side].moves = valid.slice(0, 4);
      changed.push((side === "mine" ? "我方" : "敌方") + "技能");
    }
    setTeam("mine", data.mineTeam);
    setTeam("foe", data.foeTeam);
    setSkills("mine", data.mineSkills);
    setSkills("foe", data.foeSkills);
    setHp("mine", data.mineHp, data.minePercent, data.mineMax);
    setHp("foe", data.foeHp, data.foePercent, data.foeMax);
    setName("mine", data.mineName);
    setName("foe", data.foeName);
    if (!changed.length) return "没有可填字段";
    try { if (data.mineSkills || data.foeSkills) { buildMoves("mine"); buildMoves("foe"); fillMoveSelects(); } } catch (e) {}
    renderAll();
    try { save(); } catch (e) {}
    window.__lastScreenshotFill = {
      at: Date.now(),
      screen: (data && data.screen) || "",
      changed: changed.slice(),
      skills: (data && data.mineSkills) || []
    };
    try { renderScreenshotBanner(); } catch (e) {}
    // 回填后回到顶部，保证横幅可见
    try {
      if (window.__bannerScrollTop) clearTimeout(window.__bannerScrollTop);
      window.__bannerScrollTop = setTimeout(function () {
        try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); }
      }, 80);
    } catch (e) {}
    return changed.join("、");
  };

  window.__foeOptions = function () { try { return foeOptions(); } catch (e) { return []; } };
  window.__lsChips = function () {
    var bits = [];
    if (state.weather) bits.push("天气：" + ({ rain: "下雨", sand: "沙暴", snow: "暴风雪", thunder: "雷暴", dream: "霞光梦境" }[state.weather] || state.weather));
    ["mine", "foe"].forEach(function (sd) {
      (state.buffs[sd] || []).slice(0, 6).forEach(function (b) {
        bits.push((sd === "mine" ? "我" : "敌") + b.n + (Number(b.st) > 1 ? "×" + b.st : ""));
      });
    });
    return bits;
  };
})();
