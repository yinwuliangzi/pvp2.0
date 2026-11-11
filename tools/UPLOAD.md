# 上传上线清单

> 线上地址：https://yinwuliangzi.github.io/pvp/
> 仓库：yinwuliangzi/pvp
> 打包文件：桌面 luoke-pvp-site.zip（2.24 MB，2026-11-04 14:05）

## 一、这次要传什么

把 site/ 里的全部内容覆盖到仓库根目录（不是子文件夹）：

| 文件 | 大小 | 说明 |
|---|---|---|
| index.html | 1 KB | 首页（三个入口） |
| calculator.html | 18 KB | 对战计算器 |
| fight.html | 85 KB | 局面速算 |
| guide.html | 5 KB | 使用说明 |
| calc.js | 129 KB | 计算器全部逻辑 |
| calc.css | 15 KB | 样式 |
| skills-data.js | 115 KB | 841 个技能 |
| pets-data.js | 222 KB | 550 只精灵 |
| learnsets-data.js | 220 KB | 433 只精灵的技能表 |
| buffs-data.js | 37 KB | 494 个状态 |
| buff-effects.js | 36 KB | 537 条状态链 |
| sprites-data.js | 26 KB | 头像别名 |
| sprites.json | 22 KB | 头像索引 |
| types-data.js | 3 KB | 属性克制表 |
| natures-data.js | 2 KB | 性格 |
| speed-data.js | 7 KB | 速度线 |
| aoe-data.js | 0 KB | 群体技 |
| refract-data.js | 1 KB | 折射 18 变体（新增） |
| entry-traits-data.js | 2 KB | 稀兽花宝 / 契约的形状（新增） |
| sprites/ | 454 个 webp | 头像，整个文件夹 |

> `tools/` 文件夹**不用上传**（本地抓包代理和本说明）。

## 二、怎么传（二选一）

### 方式 A：网页上传（最省事）
1. 打开仓库 yinwuliangzi/pvp
2. 点 Add file → Upload files
3. 把 site/ 里的文件全部选中拖进去（sprites 文件夹也一起拖）
4. 提交信息写：更新技能/特性/天气/标签
5. Commit changes，等 1-2 分钟

### 方式 B：GitHub Desktop / git
```
git add .
git commit -m "更新：技能/特性/天气/标签"
git push
```

## 三、传完怎么验（5 项）

| 检查项 | 预期 |
|---|---|
| 打开首页 | 三个入口都在 |
| 计算器随便选精灵 | 有头像（不是色块） |
| 技能下拉搜「折射」 | 能搜到 |
| 对战页展开「奉献」 | 5 个输入框 + 随机叠 1 层 |
| 时间轴徽标 | 显示「第 N 回合 · 阶段（状态向量自动）」 |

## 四、常见坑

- 只传 html 没传 js → 页面能开但功能全空
- sprites 没传 → 头像全变占位色块
- 传到子文件夹 → 路径全错，白屏
- 浏览器缓存 → 传完按 Ctrl+F5 强刷

## 五、这次更新了什么

1. 头像齐全（454 张）
2. 技能 594 → 841（补了治疗 / 首领类）
3. 特性事件化：克制命中、先手、掉血、入场、离场、击败都能自动触发
4. 天气真正生效：下雨 ×1.75、沙暴减半、暴风雪冻结、雷鸣引电
5. 折射 18 变体、稀兽花宝 16 血脉、契约的形状 14 种球
6. 策略标签挂上 L01-L28 编号 + 自动阶段判定
7. 招式卡新增「后果预览」一行