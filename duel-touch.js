/* duel-touch.js · 触摸兜底
 * 目的：某些 WebView / 嵌套 iframe 会把首次触摸当成"激活"吞掉。
 * 做法：touchend 时主动派发一次 click；只拦截浏览器随后补发的重复 click。
 * 注意：合成 click 派发期间必须放行，否则会把自己拦掉（这是之前的 bug）。
 */
(function () {
  if (!('ontouchstart' in window)) return;

  var SEL = 'a[href],button,.dn-tab,.mx-cell,.lead-card,.tb tr,.tab,.wb-btn,.bd-tbtn,.sk-item';
  var startEl = null, startX = 0, startY = 0;
  var inSynthetic = false;      // 正在派发合成 click
  var suppressUntil = 0;        // 抑制浏览器补发 click 的截止时间

  document.addEventListener('touchstart', function (e) {
    var t = e.target;
    startEl = t && t.closest ? t.closest(SEL) : null;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!startEl) return;
    var t = e.changedTouches[0];
    if (Math.abs(t.clientX - startX) > 12 || Math.abs(t.clientY - startY) > 12) {
      startEl = null; return;                      // 是滑动，不处理
    }
    var el = startEl;
    startEl = null;
    // 原生控件（下拉框、输入框）交回浏览器自己处理
    if (/^(SELECT|INPUT|TEXTAREA|OPTION)$/.test(el.tagName)) return;

    inSynthetic = true;
    try {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (err) {
      try { el.click(); } catch (e2) {}
    }
    inSynthetic = false;

    suppressUntil = Date.now() + 350;
    e.preventDefault();                            // 防止重复触发
  }, { passive: false });

  // 只拦浏览器在 touchend 之后补发的重复 click，放行自己派发的
  document.addEventListener('click', function (e) {
    if (inSynthetic) return;
    if (Date.now() < suppressUntil) { e.stopPropagation(); e.preventDefault(); }
  }, true);
})();
