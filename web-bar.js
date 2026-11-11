/* web-bar.js · 普通浏览器打开 battle-deck 时补一条底部操作栏
 * 电脑版 App 由主进程注入 desktop-hud.js，带自己的底栏，这里会自动跳过
 */
(function () {
  if (window.__pcHudReady) return;              // 电脑版 App 已接管
  if (window.Android || window.AppHud) return;  // 安卓原生悬浮层
  var desktop = /[?&]desktop=1/.test(location.search);
  var embed = /[?&]embed=1/.test(location.search);
  if (embed) return;                            // 嵌入面板里不需要底栏

  function page(name) {
    var map = { matrix: 'matrix.html', route: 'route.html', winrate: 'winrate.html' };
    if (map[name] && window.__showDuelEmbedded) {
      window.__showDuelEmbedded(name, map[name]);
      return;
    }
    if (map[name]) location.href = map[name];
  }

  function build() {
    if (document.querySelector('.web-bar')) return;
    var bar = document.createElement('div');
    bar.className = 'web-bar';
    bar.innerHTML =
      '<button type="button" class="wb-btn" data-act="matrix">对战矩阵</button>' +
      '<button type="button" class="wb-btn" data-act="route">对局路径</button>' +
      '<button type="button" class="wb-btn" data-act="winrate">胜率估计</button>' +
      '<span class="wb-sep"></span>' +
      '<button type="button" class="wb-btn wb-pred" data-act="predict">反推</button>' +
      '<button type="button" class="wb-btn" data-act="close">关闭</button>';
    document.body.appendChild(bar);

    bar.addEventListener('click', function (ev) {
      var b = ev.target;
      if (!b || !b.getAttribute) return;
      var act = b.getAttribute('data-act');
      if (!act) return;
      ev.stopPropagation();
      if (act === 'matrix' || act === 'route' || act === 'winrate') {
        page(act);
      } else if (act === 'predict') {
        try { if (window.__pcTogglePredict) window.__pcTogglePredict(); } catch (e) {}
      } else if (act === 'close') {
        try { window.close(); } catch (e) {}
        if (!window.closed) location.href = 'calculator.html';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
