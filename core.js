/* core.js · 对战助手共享计算层
   无 DOM 依赖，浏览器挂到 window.Core，Node 下 module.exports */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ========== 0. 工具 ========== */
  const EPS = 1e-9;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sig = z => 1 / (1 + Math.exp(-z));
  const alive = hp => hp.map((h, k) => (h > EPS ? k : -1)).filter(k => k >= 0);

  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ========== 1. 数据层 ========== */
  const DEFAULT_DATA = {
    my: [
      { n: '迪莫',   t: '冰/光', spd: 286 },
      { n: '火神',   t: '火',    spd: 298 },
      { n: '水灵',   t: '水',    spd: 242 },
      { n: '雷神',   t: '电',    spd: 310 },
      { n: '喵喵',   t: '普通',  spd: 268 },
      { n: '藤蔓花', t: '草',    spd: 230 }
    ],
    foe: [
      { n: '翠顶夫人', t: '水/翼', spd: 254 },
      { n: '海豹船长', t: '水',    spd: 262 },
      { n: '恶魔狼',   t: '恶',    spd: 300 },
      { n: '冰晶龙',   t: '冰',    spd: 246 },
      { n: '雷电狮',   t: '电',    spd: 318 },
      { n: '石像守卫', t: '岩',    spd: 180 }
    ],
    T: [
      [[3,4],[2,5],[3,4],[4,6],[3,3],[3,6]],
      [[2,4],[3,4],[3,4],[2,5],[3,3],[2,6]],
      [[3,4],[3,3],[4,3],[3,5],[4,2],[2,5]],
      [[3,4],[2,4],[3,3],[3,4],[3,3],[4,6]],
      [[4,3],[4,3],[3,3],[4,3],[4,2],[3,4]],
      [[3,2],[2,2],[4,2],[5,4],[4,2],[4,3]]
    ]
  };

  let DATA = DEFAULT_DATA;
  const setData = d => (DATA = d);
  const getData = () => DATA;

  /* ========== 2. 条件：天气 + 状态 ========== */
  const STATUS = {
    '无':   { atk: 1,   spd: 1,   dot: 0 },
    '麻痹': { atk: 1,   spd: 0.5, dot: 0 },
    '烧伤': { atk: 0.5, spd: 1,   dot: 0.0625 },
    '中毒': { atk: 1,   spd: 1,   dot: 0.125 },
    '睡眠': { atk: 0,   spd: 1,   dot: 0 }
  };
  const WEATHER = { '无': { m: 1, f: 1 }, '晴': { m: 1.15, f: 1.15 }, '雨': { m: 1.15, f: 1.15 }, '雪': { m: 1, f: 1 } };
  const DEFAULT_MODS = {
    weather: '无', statusM: '无', statusF: '无',
    atkM: 1, atkF: 1, spdM: 1, spdF: 1
  };

  function effMods(mods) {
    const m = Object.assign({}, DEFAULT_MODS, mods || {});
    const sM = STATUS[m.statusM] || STATUS['无'];
    const sF = STATUS[m.statusF] || STATUS['无'];
    const w = WEATHER[m.weather] || WEATHER['无'];
    return {
      atkM: sM.atk * m.atkM * w.m, atkF: sF.atk * m.atkF * w.f,
      spdM: sM.spd * m.spdM,       spdF: sF.spd * m.spdF,
      dotM: sM.dot,                dotF: sF.dot
    };
  }

  /* ========== 3. 单场对位 ========== */
  function duel(i, j, hm, hf, opt) {
    const o = opt || {};
    const rng = o.rng || Math.random;
    const M = effMods(o.mods);
    const varAmp = o.variance == null ? 0.2 : o.variance;
    const critP = o.crit == null ? 0.0625 : o.crit;
    const critMul = o.critMul == null ? 1.5 : o.critMul;

    const dm = 1 / DATA.T[i][j][0];   // 我方每击伤害
    const df = 1 / DATA.T[i][j][1];   // 对方每击伤害
    const spM = DATA.my[i].spd * M.spdM;
    const spF = DATA.foe[j].spd * M.spdF;
    const fast = spM > spF || (spM === spF && rng() < 0.5);
    const order = fast ? [1, 0] : [0, 1];   // 1 = 我方出手

    const hit = (base, atk) => {
      if (atk <= 0) return 0;
      let d = base * atk * (1 + (rng() - 0.5) * varAmp);
      if (rng() < critP) d *= critMul;
      return d;
    };

    let m = hm, f = hf, rounds = 0;
    while (m > EPS && f > EPS && rounds < 99) {
      rounds++;
      for (const who of order) {
        if (m <= EPS || f <= EPS) break;
        if (who === 1) f -= hit(dm, M.atkM);
        else           m -= hit(df, M.atkF);
      }
      if (m > EPS && f > EPS) {          // 状态持续伤害
        m -= M.dotM;
        f -= M.dotF;
      }
    }
    return { win: m > EPS, m: Math.max(m, 0), f: Math.max(f, 0), fast, rounds };
  }

  /* ========== 4. 换人策略 ========== */
  const fastEnough = (spM, spF) => spM > spF;

  function scoreFoe(i, k) {                       // 对方第 k 只对我方 i 的优劣
    const a = DATA.T[i][k][0], b = DATA.T[i][k][1];
    const win = b < a || (a === b && DATA.foe[k].spd > DATA.my[i].spd);
    return win ? 100 + (b - a) : -(a - b);
  }
  function scoreMe(k, j) {                        // 我方第 k 只对对方 j 的优劣
    const a = DATA.T[k][j][0], b = DATA.T[k][j][1];
    const win = a < b || (a === b && DATA.my[k].spd > DATA.foe[j].spd);
    return win ? 100 + (b - a) : -(b - a);
  }
  function bestForFoe(hf, i) {
    let best = -1, bs = -1e9;
    for (const k of alive(hf)) { const s = scoreFoe(i, k); if (s > bs) { bs = s; best = k; } }
    return best;
  }
  function bestForMe(hm, j) {
    let best = -1, bs = -1e9;
    for (const k of alive(hm)) { const s = scoreMe(k, j); if (s > bs) { bs = s; best = k; } }
    return best;
  }
  function pickForFoe(hf, i, rng, greedy) {
    const c = alive(hf);
    if (rng() >= (greedy == null ? 0.8 : greedy)) return c[Math.floor(rng() * c.length)];
    return bestForFoe(hf, i);
  }
  function pickForMe(hm, j, rng, greedy) {
    const c = alive(hm);
    if (rng() >= (greedy == null ? 0.8 : greedy)) return c[Math.floor(rng() * c.length)];
    return bestForMe(hm, j);
  }

  /* ========== 5. 整局模拟 ========== */
  function battle(state, opt) {
    const o = opt || {};
    const rng = o.rng || Math.random;
    const hm = state.hm.slice(), hf = state.hf.slice();
    let i = state.i, j = state.j;
    for (let g = 0; g < 300; g++) {
      const d = duel(i, j, hm[i], hf[j], o);
      hm[i] = d.m; hf[j] = d.f;
      if (d.win) {
        if (!alive(hf).length) return true;
        j = pickForFoe(hf, i, rng, o.greedy);
      } else {
        if (!alive(hm).length) return false;
        i = pickForMe(hm, j, rng, o.greedy);
      }
    }
    return alive(hm).length > 0;
  }

  function winRate(state, n, opt) {
    const o = Object.assign({}, opt || {});
    o.rng = mulberry32(o.seed == null ? 12345 : o.seed);
    const N = n || 2000;
    let w = 0;
    for (let k = 0; k < N; k++) if (battle(state, o)) w++;
    return w / N;
  }

  /* ========== 6. 确定性路径 ========== */
  const DET = (mods) => ({ mods, variance: 0, crit: 0, rng: () => 0.5 });

  function path(leadM, leadF, mods) {
    const o = DET(mods);
    const hm = DATA.my.map(() => 1), hf = DATA.foe.map(() => 1);
    let i = leadM, j = leadF;
    const steps = [];
    for (let g = 0; g < 60; g++) {
      const d = duel(i, j, hm[i], hf[j], o);
      steps.push({ i, j, bm: hm[i], bf: hf[j], am: d.m, af: d.f,
                   win: d.win, fast: d.fast, rounds: d.rounds });
      hm[i] = d.m; hf[j] = d.f;
      if (d.win) {
        if (!alive(hf).length) break;
        const k = bestForFoe(hf, i);
        steps[steps.length - 1].link = {
          side: 'foe', out: DATA.foe[j].n, in: DATA.foe[k].n,
          why: scoreFoe(i, k) >= 100 ? '针对你场上的 ' + DATA.my[i].n + '，它是最优解'
                                     : '对方已没人能赢 ' + DATA.my[i].n + '，派它消耗'
        };
        j = k;
      } else {
        if (!alive(hm).length) break;
        const k = bestForMe(hm, j);
        steps[steps.length - 1].link = {
          side: 'me', out: DATA.my[i].n, in: DATA.my[k].n,
          why: scoreMe(k, j) >= 100 ? '能赢 ' + DATA.foe[j].n + ' 且剩血最多'
                                    : '剩下的人都赢不了，派它消耗掉 ' + DATA.foe[j].n
        };
        i = k;
      }
    }
    const lm = alive(hm).length, lf = alive(hf).length;
    return { steps, hm, hf, win: lm > 0, left: Math.max(lm, lf) };
  }

  /* ========== 7. 矩阵 ========== */
  function classify(diff) {
    if (diff >= 3) return 'win2';
    if (diff >= 1) return 'win1';
    if (diff >= 0) return 'even';
    if (diff >= -2) return 'lose1';
    return 'lose2';
  }
  function matrixCells(mods) {
    const M = effMods(mods);
    return DATA.my.map((m, i) => DATA.foe.map((f, j) => {
      const tm = DATA.T[i][j][0], tf = DATA.T[i][j][1];
      const diff = tf - tm;
      return { i, j, tm, tf, diff, fast: m.spd * M.spdM > f.spd * M.spdF, cls: classify(diff) };
    }));
  }

  /* 首发评估：我方每只 × 对方每种开局 */
  function leadReport(mods) {
    const n = DATA.foe.length, N = DATA.my.length;
    const byLead = DATA.my.map((_, L) => {
      const outs = DATA.foe.map((_, K) => {
        const p = path(L, K, mods);
        return { K, win: p.win, left: p.left, steps: p.steps.length };
      });
      const wins = outs.filter(o => o.win).length;
      let worst = 0;
      outs.forEach((o, k) => {
        if (o.left < outs[worst].left || (o.left === outs[worst].left && !o.win && outs[worst].win)) worst = k;
      });
      return { L, wins, total: n, outs, worstK: worst };
    });
    let bi = 0;
    byLead.forEach((x, k) => {
      const bw = byLead[bi];
      if (x.wins !== bw.wins) { if (x.wins > bw.wins) bi = k; return; }
      if (x.outs[x.worstK].left > bw.outs[bw.worstK].left) bi = k;
    });
    return { byLead, best: byLead[bi] };
  }

  /* ========== 8. 特征向量 ========== */
  function coverage(hm, hf) {
    const mi = alive(hm), fi = alive(hf);
    if (!mi.length || !fi.length) return 0;
    let solv = 0, solved = 0;
    for (const k of fi) if (mi.some(m => DATA.T[m][k][0] < DATA.T[m][k][1])) solv++;
    for (const m of mi) if (fi.some(k => DATA.T[m][k][1] < DATA.T[m][k][0])) solved++;
    return solv / fi.length - solved / mi.length;
  }

  function feats(state, mods) {
    const { hm, hf, i, j } = state;
    const mi = alive(hm), fi = alive(hf);
    const f1 = (mi.length - fi.length) / 6;
    const f2 = (sum(hm) - sum(hf)) / 6;
    const f3 = coverage(hm, hf);
    let p = 0, n = 0;
    for (const m of mi) for (const k of fi) { n++; if (DATA.my[m].spd > DATA.foe[k].spd) p++; }
    const f4 = n ? 2 * (p / n - 0.5) : 0;
    const diff = DATA.T[i][j][1] - DATA.T[i][j][0];
    const f5 = clamp(diff / 3, -1, 1);
    const f6 = clamp((DATA.my[i].spd - DATA.foe[j].spd) / 60, -1, 1);
    const end = path(i, j, mods);                       // 从当前局面推到底
    const f7 = clamp((sum(end.hm) - sum(end.hf)) / 2, -1, 1);
    return [f1, f2, f3, f4, f5, f6, f7];
  }

  /* ========== 9. 逻辑回归 ========== */
  function fit(X, Y, opt) {
    const o = opt || {};
    const D = X[0].length, w = new Array(D + 1).fill(0);
    const lr = o.lr == null ? 0.4 : o.lr;
    const l2 = o.l2 == null ? 1e-3 : o.l2;
    const iters = o.iters || 5000;
    for (let it = 0; it < iters; it++) {
      const g = new Array(D + 1).fill(0);
      for (let k = 0; k < X.length; k++) {
        let z = w[0];
        for (let d = 0; d < D; d++) z += X[k][d] * w[d + 1];
        const e = sig(z) - Y[k];
        g[0] += e;
        for (let d = 0; d < D; d++) g[d + 1] += e * X[k][d];
      }
      for (let d = 0; d <= D; d++) w[d] -= lr * (g[d] / X.length + (d ? l2 * w[d] : 0));
    }
    let loss = 0;
    for (let k = 0; k < X.length; k++) {
      let z = w[0];
      for (let d = 0; d < D; d++) z += X[k][d] * w[d + 1];
      const p = Math.min(1 - 1e-9, Math.max(1e-9, sig(z)));
      loss += -(Y[k] * Math.log(p) + (1 - Y[k]) * Math.log(1 - p));
    }
    return { w, loss: loss / X.length };
  }

  function predict(state, w, mods) {
    const phi = feats(state, mods);
    let z = w[0];
    for (let d = 0; d < phi.length; d++) z += phi[d] * w[d + 1];
    return sig(z);
  }

  /* 采样 + 拟合一站式 */
  function train(opts) {
    const o = Object.assign({ samples: 600, games: 70, seed: 20261111 }, opts || {});
    const rng = mulberry32(o.seed);
    const X = [], Y = [];
    for (let s = 0; s < o.samples; s++) {
      const hm = [], hf = [];
      for (let k = 0; k < DATA.my.length; k++)  hm.push(rng() < 0.62 ? 0.15 + 0.85 * rng() : 0);
      for (let k = 0; k < DATA.foe.length; k++) hf.push(rng() < 0.62 ? 0.15 + 0.85 * rng() : 0);
      if (!alive(hm).length) hm[0] = 0.6;
      if (!alive(hf).length) hf[0] = 0.6;
      const ma = alive(hm), fa = alive(hf);
      const st = { hm, hf, i: ma[Math.floor(rng() * ma.length)], j: fa[Math.floor(rng() * fa.length)] };
      let win = 0;
      const bo = { rng: mulberry32(o.seed + s + 1) };
      for (let g = 0; g < o.games; g++) if (battle(st, bo)) win++;
      X.push(feats(st, o.mods)); Y.push(win / o.games);
    }
    const f = fit(X, Y);
    return { w: f.w, loss: f.loss, X, Y };
  }

  /* ========== 10. 导出 ========== */
  return {
    EPS, sum, clamp, sig, alive, mulberry32,
    DEFAULT_DATA, DEFAULT_MODS, STATUS, WEATHER,
    setData, getData, effMods,
    duel, battle, winRate, path,
    classify, matrixCells, leadReport,
    feats, fit, predict, train,
    scoreFoe, scoreMe, bestForFoe, bestForMe
  };
});