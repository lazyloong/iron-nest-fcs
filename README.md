# 铁巢重炮 · 火控计算机

《铁巢重炮》（IRON NEST: Heavy Turret Simulator）的**外置火控计算机**。

游戏里那台弹道计算机**会坏**（第 7 关「峡谷要冲」彻底报废且无法维修），而且每局地图坐标随机刷新——所以这是个真用得上的工具，不是玩具。

在线使用：**https://lazyloong.github.io/iron-nest-fcs/**

---

## 核心弹道模型

三条公式互相闭环（满装药射程处仰角恰好等于机械上限 60°）：

```
仰角(°) = 12 × 距离(km) ÷ 装药档位
上限射程(km) = 装药档位 × 5
弹速(km/s) = 0.7 × 装药系数
装药系数 = 0.3 + 0.7 × smoothstep((档位 − 1) / 5)   // 1 档 0.30 → 6 档 1.00
飞行时间(s) = 距离 ÷ 弹速
```

**开火时刻 = 目标经过时刻 − 飞行时间**（游戏用怀表绝对时间，不是倒计时）

全部常数集中在 `src/domain/constants.ts`，用游戏内实测值校准过。

## 功能

| 功能 | 说明 |
|---|---|
| **测绘 ⇄ 诸元双向解算** | 格位 ↔ 距离/方位角实时联动，改哪边哪边是权威 |
| **6 档对照表** | 一次看清全部档位的仰角 / 弹速 / 飞行时间，自动选最小可用档 |
| **队列三种排序** | 开火时刻 / 最小回转（含同方位齐射配对）/ 手动拖拽 |
| **同时弹着（TOT）** | 填目标经过时刻 → 自动反推开火时刻 → 倒计时 + 提示音 |
| **双炮位** | 共享方位、独立装药与仰角，冲突检测 |
| **怀表对表** | 按游戏内怀表读数对一次，之后自动走时 |
| **弹药库** | 20 种炮弹（征用点 / 穿甲 / 爆炸半径 / 效果） |
| **开火前 5 点自检** | 对照游戏 7 步规程的收尾复核 |

## 战术地图坐标系

```
范围：[A–T] × [1–10]        大格 1 km，整图 20 km × 10 km
子格：长宽各分 10，用两位数字表示，0.1 km
写法：I5 68  或  I568  或  I5 6:8   （分隔符可省略）
```

方位角约定（已用游戏实测数据校准）：

```
行号增大 = 0°    列增大 = 90°    行号减小 = 180°    列减小 = 270°
```

## 技术栈

```
Vite + Vue 3 <script setup> + TypeScript (strict)
Pinia（状态 + localStorage 持久化）
Vitest + @vue/test-utils（129 条测试）
无 UI 组件库，手写 CSS 变量主题
```

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm test       # 跑测试
pnpm build      # 构建到 dist/
```

## 目录

```
src/domain/     纯 TS 弹道核心，零 Vue 依赖，100% 可单测
  constants     全部弹道常量
  ballistics    正解 / 反解 / 自动选档 / 档位对照
  grid          格位解析、距离、方位角、极坐标反解
  gameClock     怀表时间（绝对时刻，跨零点安全）
  fireMission   火力任务模型
  tot           同时弹着排程与冲突检测
  missionOrder  三种排序 + 最小回转算法
  ammo          20 种弹药数据
  preflight     开火前自检
src/stores/     settings / missions / barrels
src/components/ GridSolver / ChargeTable / BarrelPanel / MissionQueue
```

---

## 数据来源

弹道常数与弹药数据来自游戏内实测与
[哔哩哔哩铁巢重炮 WIKI](https://wiki.biligame.com/ironnest/)，
用于玩家自助工具。游戏版权归 Nick Nieuwoudt 与 Dominik Latos 所有。
