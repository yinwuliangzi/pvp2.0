/* duel-data.js · 把计算器的真实阵容/对位数据接给三个对战页面
 *
 * 数据流：
 *   计算器页（有完整数据）→ __lsDuelData() 生成 { my, foe, T } →
 *   存进 localStorage['luoke.duel.data'] → 三个页面读它
 *
 * 没有数据时（直接打开对战页面）→ 回退到 core.js 自带的演示数据
 */
(function () {
  var KEY = 'luoke.duel.data';

  /* ---------- 1. 读数 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !Array.isArray(d.my) || !Array.isArray(d.foe) || !Array.isArray(d.T)) return null;
      if (!d.my.length || !d.foe.length) return null;
      return d;
    } catch (e) { return null; }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); return true; } catch (e) { return false; }
  }

  /* ---------- 2. 页面用：拿到数据并注入 core ---------- */
  function apply() {
    if (!window.Core) return null;
    var d = load();
    if (!d) return null;
    var base = window.Core.getData();
    window.Core.setData({
      my: d.my,
      foe: d.foe,
      T: d.T,
      T0: d.T0 || null,      // 不含减伤的口径
      mitM: d.mitM || null,
      mitF: d.mitF || null,
      hpM: d.hpM || null,
      hpF: d.hpF || null,
      _src: d.src || 'calc',
      _at: d.at || 0
    });
    return d;
  }

  /* ---------- 3. 页面用：显示数据来源 ---------- */
  function sourceLabel() {
    var d = load();
    if (!d) return '演示样例数据';
    var t = d.at ? new Date(d.at) : null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var when = t ? (pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes())) : '';
    var mode = d.src === 'calc-full' ? '完整引擎' : (d.src === 'calc' ? '简化公式' : '');
    var mitOn = !!(d.mitM && d.mitM.some(function (x) { return x > 0; })) || !!(d.mitF && d.mitF.some(function (x) { return x > 0; }));
    if (mitOn) mode += ' · 含防御技减伤';
    return '计算器数据' + (mode ? '（' + mode + '）' : '') + ' · 我方 ' + d.my.length + ' 只 / 对方 ' + d.foe.length + ' 只' + (when ? ' · ' + when : '');
  }

  /* ---------- 4. 监听计算器的数据变化 ---------- */
  var _bc = null;
  function channel() {
    if (_bc !== null) return _bc;
    try { _bc = new BroadcastChannel("luoke-duel"); } catch (e) { _bc = false; }
    return _bc;
  }

  function listen(cb) {
    var lastAt = 0;
    function fire(at) {
      if (at && at <= lastAt) return;
      lastAt = at || Date.now();
      try { cb(); } catch (e) {}
    }
    var ch = channel();
    if (ch) {
      ch.onmessage = function (ev) {
        if (!ev.data || ev.data.type !== "duel-data") return;
        apply();
        fire(ev.data.at);
      };
    }
    // 同源其它窗口改了 localStorage 时（iframe / 另开标签）
    window.addEventListener("storage", function (ev) {
      if (ev.key !== KEY || !ev.newValue) return;
      var d2 = null;
      try { d2 = JSON.parse(ev.newValue); } catch (e) { return; }
      apply();
      fire(d2 && d2.at);
    });
  }

  window.DuelData = {
    KEY: KEY,
    listen: listen,
    load: load,
    save: save,
    clear: clear,
    apply: apply,
    sourceLabel: sourceLabel
  };
})();
