/* duel-nav.js · 三个页面的顶部按钮导航 */
(function () {
  var PAGES = [
    { id: 'matrix',  file: 'matrix.html',  name: '对战矩阵', desc: '这一对谁赢' },
    { id: 'route',   file: 'route.html',   name: '对局路径', desc: '这一局怎么打' },
    { id: 'winrate', file: 'winrate.html', name: '胜率估计', desc: '现在赢面多大' }
  ];
  var cur = (document.body.getAttribute('data-page') || '').trim();

  var bar = document.createElement('header');
  bar.className = 'duel-nav';
  var html = "<div class='dn-brand'>对战助手</div><nav class='dn-tabs'>";
  PAGES.forEach(function (p) {
    var on = p.id === cur ? ' on' : '';
    html += "<a class='dn-tab" + on + "' href='" + p.file + "'>" +
            "<b>" + p.name + "</b><i>" + p.desc + "</i></a>";
  });
  var tip = (window.DuelData && window.DuelData.load()) ? '已接入计算器数据' : '数据为演示样例';
  html += "</nav><div class='dn-tip'>" + tip + "</div>";
  bar.innerHTML = html;
  document.body.insertBefore(bar, document.body.firstChild);
})();
