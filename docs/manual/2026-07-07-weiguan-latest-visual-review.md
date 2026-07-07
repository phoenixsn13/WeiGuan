# 围观 2026-07-07 最新截图高保真对照

本文件用于给设计者二次审核当前实现。结论先说清楚：当前版本功能可达，但整体还不能算 P13/P14 原型的高保真实现。主要问题不是单个颜色或按钮，而是页面结构、信息密度、产品语义和移动端响应没有稳定复现原型。

## 截图方式

- 前端：`http://127.0.0.1:9000`
- 后端：`WEIGUAN_WORKDIR=/tmp/weiguan-manual-shot`
- 工具：`npx playwright screenshot --browser=chromium --channel=chrome`
- 桌面视口：`1440x1000 --full-page`
- 移动端视口：`390x844 --full-page`
- 截图目录：`docs/manual/assets/2026-07-07-latest-screenshots/`
- 数据来源：由 `backend/.weiguan/worlds/*/events.jsonl` 真实事件派生临时 `runs.json/launches.json`，未调用 LLM，未修改仓库数据。

## 页面截图

| 页面 | 当前截图 | 对照原型 |
| --- | --- | --- |
| 选圈子 | [gallery.png](assets/2026-07-07-latest-screenshots/gallery.png) | 无最新 P14 专门原型，参考 P13/P14 顶层导航语言 |
| 发起页 | [compose.png](assets/2026-07-07-latest-screenshots/compose.png) | [P14 发起页世界选区](assets/2026-07-06-P14-prototypes/compose-world-selector-desktop-mobile.png) |
| 世界总览 | [worlds.png](assets/2026-07-07-latest-screenshots/worlds.png) | [P14 世界总览](assets/2026-07-06-P14-prototypes/world-overview-desktop-mobile.png) |
| 历史记录 | [history.png](assets/2026-07-07-latest-screenshots/history.png) | [P13 统一历史](assets/2026-07-06-P13-prototypes/unified-history-desktop-mobile.png) |
| 单平台评论区 | [single-live.png](assets/2026-07-07-latest-screenshots/single-live.png) | [早期社交 POV 高保真](assets/weiguan-ui-ux/review/live-desktop-hifi.png) |
| 多平台现场 | [world-live.png](assets/2026-07-07-latest-screenshots/world-live.png) | [P13 多平台现场](assets/2026-07-06-P13-prototypes/multiplatform-live-desktop-mobile.png) |
| 单 run 复盘 | [retro.png](assets/2026-07-07-latest-screenshots/retro.png) | [早期复盘高保真](assets/weiguan-ui-ux/review/retro-desktop-hifi.png) |
| Launch 复盘 | [launch-retro.png](assets/2026-07-07-latest-screenshots/launch-retro.png) | [P13 Launch 复盘](assets/2026-07-06-P13-prototypes/launch-retro-desktop-mobile.png) |
| 身份页 | [identity.png](assets/2026-07-07-latest-screenshots/identity.png) | [P14 身份页到达态](assets/2026-07-06-P14-prototypes/identity-arrival-desktop-mobile.png) |
| 移动端发起页 | [mobile-compose.png](assets/2026-07-07-latest-screenshots/mobile-compose.png) | [P14 发起页世界选区](assets/2026-07-06-P14-prototypes/compose-world-selector-desktop-mobile.png) |
| 移动端评论区 | [mobile-single-live.png](assets/2026-07-07-latest-screenshots/mobile-single-live.png) | [早期社交 POV 高保真](assets/weiguan-ui-ux/review/live-mobile-hifi.png) |

## 高保真对照结论

| 页面 | 当前结论 | 主要差距 |
| --- | --- | --- |
| 发起页 | 未达高保真 | P14 原型把正文、世界、平台、身份、轮次、消耗压成清晰的发起流程；当前实现是纵向表单堆叠，右栏摘要重复但不承担主 CTA，身份控件与世界控件都偏后台表单。 |
| 世界总览 | 未达高保真 | 当前是长列表管理页，缺少 P14 原型的世界卡片、主身份关系、最近内容摘要、运行状态和按钮组层级；大量“普通人·hash”的世界名仍削弱产品感。 |
| 历史记录 | 部分达标 | 已有热榜与发起记录，但同一临时 launch 同时以 multi/single 摘要出现，按钮层级混杂；缺少 P13 原型中的状态筛选、平台筛选和时间线节奏。 |
| 单平台评论区 | 部分达标 | 微博正文页心智成立，评论/通知/回放状态可读；但左栏过重、底部控制条仍像系统控制器，右栏通知和主内容的社交细节还不够精致。 |
| 多平台现场 | 未达高保真 | 当前截图只有微博列，右侧大面积空白；没有 P13 原型里的微博/Reddit 双列、桥接路径、筛选与设置、跨平台洞察。数据集中没有 Reddit 事件，不能证明双平台视觉落地。 |
| Launch 复盘 | 未达高保真 | 信息区可用，但与 P13 原型相比缺少左侧上下文、时间线密度、右侧洞察卡片层级；页面像分析面板，不像创作者复盘产品。 |
| 身份页 | 部分达标 | 身份入口和统计能打开，但和 P14 原型的“身份到达态”相比，账户/立场/发起历史的首屏组织仍偏平。 |
| 移动端 | 未达高保真 | 能响应式显示，但不是原型移动版：顶层导航被压缩、CTA 不固定、右栏信息简单堆到下方，表单很长，缺少移动端分段节奏。 |

## 需要设计者确认的问题

1. 世界总览是否继续保留“很多世界的列表”心智，还是回到 P14 原型中的少量世界卡片与热榜侧栏。
2. 发起页是否必须追平 P14 原型的右栏 CTA/成本/身份结构；当前实现功能更多，但表单感明显。
3. 多平台现场在没有 Reddit 事件时应该如何表现：隐藏空平台、显示待扩散空态，还是必须要求双平台 launch 才进入该页面。
4. 单平台评论区底部控制条是否继续存在；回放态实际只需要“看结果/回到历史”，不需要过程控制语义。
5. 移动端是否按原型重新设计为分段卡片 + 固定 CTA，而不是桌面表单自然堆叠。

## 建议的后续整改方向

- P15-T1：世界总览按 P14 原型重排，优先解决“管理列表感”和 hash 世界名问题。
- P15-T2：发起页按 P14 原型压缩信息结构，让右栏成为真正的发布摘要和 CTA 区。
- P15-T3：多平台现场先做无 Reddit 数据的空态设计，再补双平台 fixture 验证。
- P15-T4：评论区去系统控制器感，回放态只保留社交阅读必要操作。
- P15-T5：移动端按 P13/P14 合图单独实现，不再依赖桌面布局自然折行。

## 性能观察

本次只读接口响应时间：

| 接口 | 时间 |
| --- | ---: |
| `/api/launches` | `0.023s` |
| `/api/worlds` | `0.120s` |
| `/api/runs` | `0.002s` |
| `/api/worlds/{id}/events?after=0&limit=200` | `0.004s` |
| `/api/runs/{id}/snapshot?tail=200` | `0.003s` |
| `/api/runs/{id}/analysis` | `0.003s` |
| `/api/runs/{id}/flavor?world_id=...` | `0.004s` |

截图环境的数据量不大，所以这组数字只能说明当前只读接口没有明显阻塞；不能替代 500 拍、多平台、长历史数据下的性能验收。
