/* duel-touch.js · 触摸兜底：第一次点击也不会被吞
 * 有些 WebView / 嵌套 iframe 会把首次 touch 当作"激活"，需要连点几次。
 * 这里在 touchend 时直接触发一次 click，并阻止浏览器的重复 click。
 */
(function () {
  if (!('ontouchstart' in window)) return;
  var SEL = 'a[href],button,.dn-tab,.mx-cell,.lead-card,.tb tr,.tab,.wb-btn,.bd-tbtn,.skill-bubble';
  var startEl = null, startX = 0, startY = 0, fired = 0;

  document.addEventListener('touchstart', function (e) {
    var t = e.target;
    var el = t && t.closest ? t.closest(SEL) : null;
    startEl = el;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!startEl) return;
    var t = e.changedTouches[0];
    var dx = Math.abs(t.clientX - startX), dy = Math.abs(t.clientY - startY);
    if (dx > 12 || dy > 12) { startEl = null; return; }   // 是滑动，不处理
    var el = startEl;
    startEl = null;
    // 已有其它监听器处理过就跳过
    fired = Date.now();
    try {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (err) {
      try { el.click(); } catch (e2) {}
    }
    // 阻止紧接着浏览器自己补发的 click（避免重复触发）
    e.preventDefault();
  }, { passive: false });

  // 抑制 touchend 后 350ms 内的原生 click
  document.addEventListener('click', function (e) {
    if (Date.now() - fired < 350) { e.stopPropagation(); e.preventDefault(); }
  }, true);
})();
