# 围观当前状态验收手册

版本日期：2026-07-04  
数据来源：本地服务 `WEIGUAN_WORKDIR=/tmp/weiguan-e2e`  
走查方式：只读取既有历史数据和页面，不新发起真实 OASIS/LLM 推演。

## 1. 验收前准备

### 1.1 启动后端

当前验收建议显式指定工作目录，否则历史、身份、世界事件可能读到另一套数据。

```bash
cd backend
WEIGUAN_WORKDIR=/tmp/weiguan-e2e \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m uvicorn weiguan.api.main:app --host 127.0.0.1 --port 8000
```

后端 LLM 配置从 `backend/.env` 读取。前端 BYOK 表单为空时，会使用 `.env` 默认值；只有点击“开始围观”或“生成/重新生成建议”才会消耗 LLM。

### 1.2 启动前端

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 9000
```

访问入口：

- 首页/选圈子：`http://127.0.0.1:9000/`
- 发起页：`http://127.0.0.1:9000/compose`
- 世界页：`http://127.0.0.1:9000/worlds`
- 历史页：`http://127.0.0.1:9000/history`

### 1.3 基础接口

```bash
curl -s http://127.0.0.1:8000/api/crowds
curl -s http://127.0.0.1:8000/api/runs
```

预期：

- `/api/crowds` 返回 5 个预设圈子。
- `/api/runs` 返回历史 run 列表；重启后仍应存在。

## 2. 页面地图

| 页面 | 路由 | 主要接口 | 截图 |
| --- | --- | --- | --- |
| 选圈子 | `/` | `/api/crowds`, `/api/runs` | [gallery.png](assets/2026-07-04-current-state/gallery.png) |
| 发起 | `/compose` | `/api/runs/preview-cost`, `/api/identities` | [compose.png](assets/2026-07-04-current-state/compose.png) |
| 历史 | `/history` | `/api/runs`, `/api/worlds/{id}/persons` | [history.png](assets/2026-07-04-current-state/history.png) |
| 单平台评论区 | `/run/{id}/live?replay=1` | `/api/runs/{id}/snapshot` | [single-live.png](assets/2026-07-04-current-state/single-live.png) |
| 复盘 | `/run/{id}/retro` | `/snapshot`, `/analysis`, `/insights` | [retro.png](assets/2026-07-04-current-state/retro.png) |
| 身份 | `/identity/{person_id}?world_id={world_id}` | `/api/persons/{id}`, `/api/runs` | [identity.png](assets/2026-07-04-current-state/identity.png) |
| 世界总览 | `/worlds` | `/api/identities`, `/api/runs`, `/api/worlds/{id}/persons` | [worlds.png](assets/2026-07-04-current-state/worlds.png) |
| 多平台现场 | `/world/{id}/live?run_id=...` | `/api/worlds/{id}/events?run_id=...` | [world-live-filtered.png](assets/2026-07-04-current-state/world-live-filtered.png) |

## 3. 选圈子：首页与热榜

![选圈子](assets/2026-07-04-current-state/gallery.png)

当前功能：

- 左侧主区域展示预设圈子：科技程序员群、饭圈、财经吐槽、育儿妈妈、硬核玩家。
- 也可以输入一句自定义受众，进入发起页。
- 右侧“围观热榜”来自已保存 run，不是静态 mock。

验收步骤：

1. 打开 `/`。
2. 确认圈子卡片、热榜和话题词条加载。
3. 点击任意圈子，进入 `/compose`。
4. 回到首页，输入自定义受众，再点击“用这个受众围观”。

预期：

- 圈子点击和自定义受众都能跳转发起页。
- 热榜标题、评论数、点赞数来自历史数据；没有历史时应显示空态，不应 500。

## 4. 发起页：正文、平台、身份、轮次

![发起页](assets/2026-07-04-current-state/compose.png)

当前功能：

- 正文输入：作为原帖 seed。
- 平台选择：微博、Reddit。只选一个平台时走单平台 run；选择两个平台时走多平台 run。
- 发帖身份：普通人、大V、KOL，影响初始可见度。
- 身份模式：新身份或继续身份。
- 继续身份：当前最多直接展示前 20 个身份，超过后通过搜索定位。
- 讨论轮次：快速围观 6 轮、标准 10 轮、深度发酵 15 轮、自定义 1-1000 轮。
- 发布前设置：BYOK 可覆盖后端 `.env`；不填使用后端默认。
- 成本预估：由 `/api/runs/preview-cost` 返回，不是前端硬编码。

验收步骤：

1. 输入正文。
2. 选择平台：
   - 只勾选微博：成功后应进入 `/run/{run_id}/live`。
   - 同时勾选微博和 Reddit：成功后应进入 `/world/{world_id}/live?run_id=...&run_id=...`。
3. 选择身份类型和身份模式。
4. 设置轮次；自定义轮次应限制在 1-1000。
5. BYOK 保持折叠且不填写时，应使用后端 `.env`。

验收重点：

- 多平台发起返回后必须带 `run_id` 查询参数进入世界现场，否则页面会读取整个世界历史，可能混入旧话题。
- 不能让 `/api/multi-runs` 请求一直 pending 且页面不跳转；如果后端已开始推演但前端还停在发起页，这是前后端脱节。
- 继续身份列表数量增长时，应通过搜索或虚拟列表控制，不应无限把所有身份铺在页面上。

## 5. 历史记录

![历史记录](assets/2026-07-04-current-state/history.png)

当前功能：

- 按身份分组展示历史 run。
- 每条 run 展示状态、步数、平台、正文、评论、转发、点赞。
- `看评论区` 进入 `/run/{id}/live?replay=1`，只读历史快照。
- `看回放` 进入 `/run/{id}/retro`。
- 多平台身份卡提供 `看多平台现场`。

验收步骤：

1. 重启后端和前端。
2. 打开 `/history`。
3. 确认历史记录仍存在。
4. 点击 `看评论区`，确认 URL 带 `replay=1`。
5. 点击 `看回放`，确认进入复盘页。

预期：

- 重启后历史不丢失。
- 历史评论区不触发新推演。
- 历史页右侧热榜与首页一致，都基于保存数据。

当前注意点：

- `看多平台现场` 当前进入的是世界现场。如果 URL 不带 `run_id`，它表达“整个世界的现场”，会包含同一世界内多个历史发起；如果想看某一次多平台发起，应从发起成功后的带 `run_id` URL 进入。

## 6. 单平台评论区：微博式第一人称视角

![单平台评论区](assets/2026-07-04-current-state/single-live.png)

当前功能：

- 主区域模拟微博正文页：置顶原帖、评论、转发、通知。
- 左侧可切换“我的视角、时间线、人物、热门、通知”。
- 右侧通知展示点赞等事件。
- 历史模式底部只保留状态、评论数和“看结果”。
- 相对时间已从事件时间映射为“48 分钟前 / 6 小时前 / 7 小时前”等显示。

验收步骤：

1. 从历史页点击 `看评论区`。
2. 确认 URL 是 `/run/{id}/live?replay=1`。
3. 评论区应显示原帖和历史评论。
4. 点击左侧各视角切换。
5. 点击“看结果”进入复盘。

预期：

- replay 模式显示“历史回放”，不会新建 run。
- 评论按当前实现的社交信息流展示，较新的评论优先可见。
- 时间不应全部显示“刚刚”；完成较久的 run 应显示分钟/小时级相对时间。

性能注意：

- 500 轮样本 `r_d72a5806` 的 `/api/runs/{id}/snapshot` 返回约 17.9MB。当前评论区 replay 依赖完整 snapshot，数据再大时需要分页、窗口化或增量帧接口，否则页面和网络都会变重。

## 7. 复盘页：传播树、立场、影响力、情绪、趋势

![复盘页](assets/2026-07-04-current-state/retro.png)

当前功能：

- 左侧展示发帖身份、正文、扩散/节点/互动摘要。
- 中间是分析主视图：
  - 传播树
  - 立场分化
  - 影响力榜
  - 情绪时间线
  - 数据趋势
- 右侧展示创作者洞察、风险提醒和建议。
- `生成建议` / `重新生成建议` 会调用 LLM；已有建议会通过 `/api/runs/{id}/insights` 读取。

验收步骤：

1. 打开 `/run/r_d72a5806/retro` 或从历史页进入。
2. 切换每个分析 tab。
3. 如需测试建议生成，确认 LLM key 可用后点击 `重新生成建议`。
4. 刷新页面，确认已生成建议仍然存在。

产品语义：

- tab 是分析维度，不是简单情绪过滤器。
- “立场分化”看不同立场随时间的变化。
- “影响力榜”看传播节点。
- “情绪时间线”看发酵曲线和反转。
- 没有足够数据时应显示空态，不应伪造分析。

当前注意点：

- 右侧建议已具备保存/读取路径；如果刷新后消失，需要检查 `/api/runs/{id}/insights` 持久化。
- 复盘页也会拉完整 snapshot，和评论区有同样的大响应风险。

## 8. 身份页：长期身份视角

![身份页](assets/2026-07-04-current-state/identity.png)

当前功能：

- 展示身份昵称、类型、影响力、立场、名下账号。
- 展示该身份的立场时间线和影响力曲线。
- 数据不足时显示空态。

验收步骤：

1. 打开 `/worlds` 或历史页。
2. 找到身份入口，或直接访问 `/identity/{person_id}?world_id={world_id}`。
3. 确认页面能加载身份基本信息。
4. 如果时间线为空，确认是否该身份确实没有足够历史发起记录。

当前注意点：

- 当前数据集中仍有 `码05_产品懂点码` 这类前缀式名称，这是数据展示口径问题，不代表页面加载失败。
- 部分身份只有基础资料，时间线/曲线为空是合理空态；后续如果要做产品化，应统一身份命名和跨 run 聚合口径。

## 9. 世界总览

![世界总览](assets/2026-07-04-current-state/worlds.png)

当前功能：

- 顶部导航 `世界` 进入 `/worlds`。
- 按长期身份/世界组织历史发起。
- 每组展示身份、粉丝量、历史 run、最新 run 统计。
- `看多平台现场` 进入世界现场。
- `看评论区` / `看回放` 进入单 run 页面。

验收步骤：

1. 打开 `/worlds`。
2. 确认身份分组、历史 run 和右侧热榜加载。
3. 点击 `看多平台现场`。
4. 点击单条 run 的 `看评论区` 和 `看回放`。

当前注意点：

- `/worlds` 依赖 `/api/identities` 和 `/api/worlds/{id}/persons`，这两个接口当前是页面性能风险点。
- 世界总览是“长期世界”的入口，不等同于某一次多平台 launch。若不带 `run_id`，世界现场会读取完整世界事件。

## 10. 多平台现场：微博 + Reddit

![多平台现场](assets/2026-07-04-current-state/world-live-filtered.png)

验收样本：

```text
/world/w_e23d1ad631244099a06e2c1d7f7ff68b/live
  ?run_id=w_e23d1ad631244099a06e2c1d7f7ff68b:twitter:f0db474073644c6cb81b7f58d5f70ac8
  &run_id=w_e23d1ad631244099a06e2c1d7f7ff68b:reddit:02b0fab23050483ea8ddaed99d43795e
```

当前功能：

- 一个页面并排展示微博和 Reddit 两个平台的发酵现场。
- 每个平台使用自己的皮肤：微博正文流、Reddit thread 风格。
- 右侧桥接路径展示跨平台外溢；没有桥接时显示空态。
- 每个平台列内有 `max-height` 滚动窗口，不再无限撑高整页。
- 页面每 1500ms 轮询一次世界事件。

验收步骤：

1. 从多平台发起成功页进入，确认 URL 带两个 `run_id`。
2. 检查标题是否是本次输入的话题。
3. 检查微博列和 Reddit 列是否都只显示本次 launch 的内容。
4. 等待轮询刷新，确认世界时钟和内容会更新。
5. 打开不带 `run_id` 的 `/world/{id}/live`，理解它是完整世界现场，不是单次 launch。

预期：

- 带 `run_id` 时只显示当前多平台发起。
- 不带 `run_id` 时读取整个世界历史，可能包含多个旧话题；这是当前路由语义，不应误判为当前 launch 数据污染。
- 列内滚动应保持页面高度稳定。

## 11. 本次接口与页面性能记录

测试环境：本机服务，`WEIGUAN_WORKDIR=/tmp/weiguan-e2e`，未触发新推演。

### 11.1 顺序直连接口样本

| 接口 | HTTP | 耗时 | 响应大小 | 备注 |
| --- | --- | ---: | ---: | --- |
| `/api/crowds` | 200 | 0.001s | 475B | 首页圈子 |
| `/api/runs` | 200 | 0.004s | 3.6KB | 历史列表 |
| `/api/identities` | 200 | 1.840s | 9.9KB | 慢，影响世界/身份入口 |
| `/api/worlds/{id}/persons` | 200 | 1.727s | 176KB | 慢，疑似折叠世界事件 |
| `/api/worlds/{id}/events?run_id=...` | 200 | 0.054s | 61KB | 当前 launch 过滤后较轻 |
| `/api/worlds/{id}/events` | 200 | 0.364s | 3.19MB | 完整世界历史 |
| `/api/runs/r_d72a5806` | 200 | 0.002s | 376B | 单 run 摘要 |
| `/api/runs/r_d72a5806/snapshot` | 200 | 0.127s | 17.9MB | 大响应，replay/retro 风险 |
| `/api/runs/r_d72a5806/analysis` | 200 | 0.029s | 46KB | 复盘分析 |
| `/api/runs/r_d72a5806/flavor` | 200 | 0.017s | 4KB | 风格摘要 |

### 11.2 并发观察

并发拉取 `/api/identities`、`/api/runs/{id}`、`/api/worlds/{id}/events?run_id=...`、`/api/runs/{id}/snapshot` 时，小接口被慢接口拖到约 2 秒。后续性能 review 应重点确认：

- `identities` 和 `world persons` 是否在请求路径同步扫描大量世界事件。
- 大 snapshot 是否阻塞同进程事件循环。
- uvicorn 单 worker + 同步文件/SQLite 读取是否会放大并发等待。

### 11.3 浏览器页面观察

Playwright 通过系统 Chrome 截图，页面可打开。Vite dev 下 React `StrictMode` 会让部分请求重复触发一次，所以 HAR 中同一接口出现两次不一定代表生产行为。

页面侧当前主要风险：

- 评论区 replay 和复盘页都拉完整 snapshot，500 轮样本已经 17.9MB。
- 世界/历史/身份入口依赖 `identities` / `persons` 慢接口。
- 多平台世界现场需要明确“当前 launch 过滤”和“完整世界历史”两种语义，避免用户以为数据串台。
- 大量身份时，继续身份列表需要搜索/分页/虚拟列表保持可用。

## 12. 当前已知限制与建议验收重点

1. 不要用不带 `run_id` 的世界现场判断一次多平台发起是否串数据；那是完整世界视角。
2. 发起多平台时，如果 `/api/multi-runs` pending 但后端已开始推演，应判定为严重前后端脱节，需要单独修。
3. replay 页面只读历史快照；任何从历史进入后又新生成评论的现象都是 bug。
4. 身份名称仍有数据集前缀，属于产品化命名问题。
5. 复盘 tab 的业务含义应维持为分析维度，不应退化为情绪标签筛选。
6. 建议生成必须持久化，并提供“重新生成建议”；刷新丢失应判定为 bug。
7. 1000 轮以上不在当前 schema 范围内；1-1000 轮内仍需用窗口化和分页保证页面可用。

## 13. 本次截图命令

使用系统 Chrome，不安装 Playwright 浏览器：

```bash
cd frontend
npx playwright screenshot --browser=chromium --channel=chrome --viewport-size=1440,1000 --wait-for-timeout=2500 http://127.0.0.1:9000/ ../docs/manual/assets/2026-07-04-current-state/gallery.png
```

其它页面同理，只替换 URL 和输出文件名。
