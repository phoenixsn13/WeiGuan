# 围观 P13 后完整验收手册

版本日期：2026-07-06  
适用范围：P11-P13 后的当前产品形态。覆盖发起、世界、历史、单平台评论区、多平台现场、身份页、单 run 复盘、launch 复盘与只读接口验收。  
推荐数据目录：`WEIGUAN_WORKDIR=/tmp/weiguan-e2e`。  
LLM 注意：本文默认以只读验收为主；点击“开始围观”或“重新生成建议”会触发 LLM 或本地兼容接口调用。

## 1. 这版要验什么

P13 之后，围观的前端心智从“技术推演页面”收敛为用户能理解的社交产品：

- 顶部导航是 `发起 / 世界 / 历史`。
- 发起页负责写正文、选平台、选发帖身份、选轮次、预估成本。
- 世界页是持续身份和长期世界入口。
- 历史页按一次“发起”组织记录，单平台和多平台都应能进入现场或复盘。
- 单平台评论区像微博正文页。
- 多平台现场像微博 + Reddit 的并列现场，并带“本次发起 / 世界全景”语义。
- 复盘页负责传播、立场、影响力、情绪、趋势和建议。

P13 的硬验收点：

- 用户可见区域不出现裸长 ID。
- 用户可见文案不出现 `agent`、`OASIS`、`仿真`、`工作台`、`后端`、`模型` 这类提高心智门槛的词；讨论轮次显示为“拍”。
- 多平台现场用游标增量读取，完成后停止轮询。
- 回放页不再拉全量 snapshot 首屏；评论区支持窗口和“加载更早评论”。
- 发起页提交时按钮禁用，成功后立即跳转现场。
- 世界总览、历史、身份页有结构骨架屏，不是白屏字符串。

## 2. 启动方式

### 2.1 后端

```bash
cd backend
WEIGUAN_WORKDIR=/tmp/weiguan-e2e \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m uvicorn weiguan.api.main:app --host 127.0.0.1 --port 8000
```

`.env` 可放默认 LLM 配置。前端 BYOK 表单为空时使用 `.env` 默认值。

示例：

```dotenv
WEIGUAN_LLM_KEY=你的_key
WEIGUAN_LLM_BASE_URL=http://127.0.0.1:8000/v1
WEIGUAN_LLM_MODEL=你的模型名
WEIGUAN_LLM_REASONING_EFFORT=
WEIGUAN_LLM_THINKING=
WEIGUAN_WORKDIR=/tmp/weiguan-e2e
```

说明：

- 本地 vLLM / OpenAI compatible 服务通常需要 `/v1` 后缀。
- reasoning/thinking 对非 DeepSeek 或本地模型可能需要留空。
- 使用自有算力时，费用预估只是外部 API 口径提示，不代表本地实际扣费。

### 2.2 前端

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 9000
```

入口：

- 发起：`http://127.0.0.1:9000/compose`
- 世界：`http://127.0.0.1:9000/worlds`
- 历史：`http://127.0.0.1:9000/history`
- 选圈子：首页 `/`

## 3. 自动化验收命令

不需要 LLM key：

```bash
cd backend
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
```

```bash
cd frontend
npx vitest run
npx tsc -b
```

实现者最近一次结果：

- 后端：`198 passed, 3 skipped, 6 deselected`
- 前端：`151 passed`
- TypeScript：`exit 0`

审核者应以自己机器重新执行结果为准。

## 4. 页面地图

| 页面 | 路由 | 主要接口 | 图片参考 |
| --- | --- | --- | --- |
| 选圈子 | `/` | `/api/crowds`, `/api/runs` | [current gallery](assets/2026-07-04-current-state/gallery.png) |
| 发起 | `/compose` | `/api/runs/preview-cost`, `/api/identities`, `/api/persons`, `/api/runs`, `/api/multi-runs` | [P13 compose prototype](assets/2026-07-06-P13-prototypes/compose-desktop-mobile.png) |
| 世界总览 | `/worlds` | `/api/identities`, `/api/runs`, `/api/launches`, `/api/worlds/{id}/persons` | [current worlds](assets/2026-07-04-current-state/worlds.png) |
| 历史 | `/history` | `/api/launches`, `/api/runs`, `/api/worlds/{id}/persons` | [P13 history prototype](assets/2026-07-06-P13-prototypes/unified-history-desktop-mobile.png) |
| 单平台评论区 | `/run/{id}/live` | `/api/runs/{id}`, `/api/runs/{id}/stream`, `/api/runs/{id}/snapshot?tail=...` | [current single live](assets/2026-07-04-current-state/single-live.png) |
| 单平台回放 | `/run/{id}/live?replay=1` | `/api/runs/{id}/snapshot?tail=200` | [current single live](assets/2026-07-04-current-state/single-live.png) |
| 单 run 复盘 | `/run/{id}/retro` | `/api/runs/{id}`, `/analysis`, `/retro`, `/insights`, `/flavor` | [current retro](assets/2026-07-04-current-state/retro.png) |
| 身份 | `/identity/{person_id}?world_id={world_id}` | `/api/worlds/{id}/persons/{person_id}`, `/api/runs` | [current identity](assets/2026-07-04-current-state/identity.png) |
| 多平台现场 | `/world/{id}/live?run_id=...&run_id=...` | `/api/worlds/{id}/events?run_id=...&after=...`, `/api/launches` | [P13 live prototype](assets/2026-07-06-P13-prototypes/multiplatform-live-desktop-mobile.png) |
| Launch 复盘 | `/world/{id}/retro?launch={launch_id}` | `/api/launches`, `/api/worlds/{id}/events`, `/api/runs/{id}/analysis`, `/api/runs/{id}/flavor` | [P13 retro prototype](assets/2026-07-06-P13-prototypes/launch-retro-desktop-mobile.png) |

## 5. 选圈子：首页

![选圈子当前截图](assets/2026-07-04-current-state/gallery.png)

验收步骤：

1. 打开 `/`。
2. 确认圈子卡片加载：科技程序员群、饭圈、财经吐槽、育儿妈妈、硬核玩家。
3. 确认右侧热榜来自历史数据；没有历史时应显示空态。
4. 点击任一圈子进入发起页。
5. 输入自定义受众后进入发起页。

预期：

- 页面不应提示“确认后端服务”这类工程文案。
- 热榜同一正文多次发起时应聚合，不应同题四连。
- 热榜应显示内容、评论/赞等摘要，不显示 run id/world id。

## 6. 发起页

![P13 发起页原型](assets/2026-07-06-P13-prototypes/compose-desktop-mobile.png)

发起页验收点：

- 正文输入框首屏可见。
- 平台可选微博、Reddit；选择两个平台时显示多平台说明。
- 发帖身份可选普通人、大V、KOL。
- 可选新身份或继续身份。
- 继续身份列表需要搜索和窗口化展示，不应无限铺开。
- 讨论轮次有快速围观、标准、深度发酵、自定义轮次。
- 自定义轮次范围为 1-1000。
- 右栏有成本预览和当前身份摘要。
- BYOK 折叠在“发布前设置”中，不填时走 `.env`。
- 点击开始后按钮变为提交中并禁用。

单平台发起：

1. 只勾选微博。
2. 输入正文。
3. 点击“开始围观”。
4. 成功后进入 `/run/{run_id}/live`。

多平台发起：

1. 勾选微博和 Reddit。
2. 输入正文。
3. 点击“开始围观”。
4. 成功后进入 `/world/{world_id}/live?run_id=...&run_id=...`。

异常判断：

- 如果 Network 里 `/api/multi-runs` 已返回 200，但页面仍停留发起页，是前端跳转问题。
- 如果 `/api/multi-runs` pending 很久，同时后端日志已开始推演，可能是服务端同步阻塞或请求没有及时返回，需要回 P12 后端生命周期排查。
- 如果未填写 BYOK 且 `.env` 也没有 key，发起应显示可理解错误，不应静默无响应。

## 7. 世界总览

![世界总览当前截图](assets/2026-07-04-current-state/worlds.png)

验收步骤：

1. 打开 `/worlds`。
2. 首屏 loading 应是结构骨架，不是“正在加载世界...”纯文本。
3. 确认世界卡片按持续身份/世界展示。
4. 点击“看最新现场”，URL 应带最新 launch 的全部 `run_id`。
5. 点击“世界全景”，进入不带 `run_id` 的长期世界现场。
6. 点击“看回放”进入单 run 复盘。

语义区别：

- 带 `run_id`：本次发起，只看这次微博/Reddit 同发。
- 不带 `run_id`：世界全景，会看到该世界内多次历史发起。

验收重点：

- 页面不应用裸 `world_id` 当标题。
- 世界加载失败时显示诚实错误态。
- 不应因 persons/identities 接口慢而白屏 2 秒以上只有纯文本。

## 8. 历史记录

![P13 统一历史原型](assets/2026-07-06-P13-prototypes/unified-history-desktop-mobile.png)

验收步骤：

1. 打开 `/history`。
2. 首屏 loading 应为结构骨架。
3. 历史记录应按“发起”展示，单平台和多平台都能出现。
4. 多平台条目应显示平台角标组。
5. 点击“看现场”进入 `/world/{world_id}/live?run_id=...&run_id=...`。
6. 点击单平台评论区进入 `/run/{id}/live?replay=1`。
7. 点击单 run 回放进入 `/run/{id}/retro`。
8. 点击多平台复盘进入 `/world/{world_id}/retro?launch={launch_id}`。

重启验收：

1. 停掉前后端。
2. 使用同一 `WEIGUAN_WORKDIR=/tmp/weiguan-e2e` 重启。
3. 打开 `/history`。

预期：

- 历史仍存在。
- 从历史进入评论区不会新发起推演。
- 历史条目的状态和评论/转发/点赞统计来自保存数据。

## 9. 单平台评论区与回放

![单平台评论区当前截图](assets/2026-07-04-current-state/single-live.png)

验收步骤：

1. 打开 `/run/{id}/live` 查看进行中的 run，或 `/run/{id}/live?replay=1` 查看历史回放。
2. 原帖应立即显示，评论逐步出现或从历史窗口读取。
3. 评论区内部滚动，不应无限撑高整个页面。
4. 新评论应按社交信息流方式展示，新内容优先可见。
5. 相对时间应基于事件时间显示，如“48 分钟前 / 6 小时前”，不应完成后全部是“刚刚”。
6. 回放态底部应显示“历史回放/回放”语义，不应写“实时互动”。
7. 点击“加载更早评论”应追加旧评论，不重复。

接口验收：

```bash
curl -s "http://127.0.0.1:8000/api/runs/$RUN_ID/snapshot?tail=200" \
  | jq '{posts:(.posts|length), replies:(.replies|length), window}'
```

预期：

- 有 `window`。
- `window.totals` 表示全量统计。
- `replies` 是窗口，不一定等于总评论数。

加载更早：

```bash
curl -s "http://127.0.0.1:8000/api/runs/$RUN_ID/snapshot?replies_offset=200&replies_limit=100" \
  | jq '{replies:(.replies|length), window}'
```

## 10. 多平台现场

![P13 多平台现场原型](assets/2026-07-06-P13-prototypes/multiplatform-live-desktop-mobile.png)

验收步骤：

1. 从多平台发起成功页或历史页进入 `/world/{id}/live?run_id=...&run_id=...`。
2. 顶部应明确显示“本次发起”和状态：发酵中 / 已完成 / 已中断。
3. 微博列与 Reddit 列分别展示各自现场。
4. 桥接信息进入文档流或右栏，不应使用横跨页面的悬浮 hack。
5. 无桥接时不应占据一整列空面板。
6. 作者名应为中文显示名或确定性化名，不应显示裸长 hex。
7. 完成后轮询应停止；不应一直 1500ms 请求。
8. 点击“看结果”进入 launch 复盘。

游标接口验收：

```bash
curl -s "http://127.0.0.1:8000/api/worlds/$WORLD_ID/events?run_id=$RUN_ID_1&run_id=$RUN_ID_2&after=0" \
  | jq '{count:(.frames|length), next_after, clock_tick, launch_status}'
```

拿到 `next_after` 后：

```bash
curl -s "http://127.0.0.1:8000/api/worlds/$WORLD_ID/events?run_id=$RUN_ID_1&run_id=$RUN_ID_2&after=$NEXT_AFTER" \
  | jq '{count:(.frames|length), next_after, clock_tick, launch_status}'
```

预期：

- 第二次只返回增量；没有新事件时 `frames` 为空。
- 完成态 `launch_status="done"`。
- `clock_tick` 与页面“第 n 拍”一致。

## 11. 单 run 复盘

![单 run 复盘当前截图](assets/2026-07-04-current-state/retro.png)

验收步骤：

1. 打开 `/run/{id}/retro`。
2. 切换传播树、立场分化、影响力榜、情绪时间线、数据趋势。
3. 空数据应显示空态，不应伪造图表。
4. 右侧建议已生成时应直接显示。
5. 点击“重新生成建议”会调用 LLM，必须确认 key/本地服务可用再点。
6. 生成后刷新页面，建议应持久化。

接口验收：

```bash
curl -s "http://127.0.0.1:8000/api/runs/$RUN_ID/analysis" | jq 'keys'
curl -s "http://127.0.0.1:8000/api/runs/$RUN_ID/flavor" | jq 'keys'
curl -s "http://127.0.0.1:8000/api/runs/$RUN_ID/insights" | jq '.'
```

验收重点：

- 复盘页不应为打开页面而拉全量 `/snapshot`。
- 建议内容刷新后不消失。
- tab 名称表达分析维度，不是简单情绪过滤。

## 12. Launch 复盘

![P13 launch 复盘原型](assets/2026-07-06-P13-prototypes/launch-retro-desktop-mobile.png)

入口：

- 多平台现场完成后点击“看结果”。
- 历史页多平台条目点击“看复盘”。
- 直接访问 `/world/{world_id}/retro?launch={launch_id}`。

验收步骤：

1. 打开 launch 复盘页。
2. 顶部应显示本次发起摘要：正文、平台、拍数、状态。
3. 平台 tab 切换后，应加载对应 run 的分析主体。
4. 桥接摘要应展示跨平台外溢事件；没有桥接时显示诚实空态。
5. 风味摘要应展示微博和 Reddit 讨论差异。
6. 单平台 `/run/{id}/retro` 不应因为抽组件而回归。

## 13. 身份页

![身份页当前截图](assets/2026-07-04-current-state/identity.png)

验收步骤：

1. 通过顶部“我”、世界页或历史页进入身份页。
2. loading 应为结构骨架。
3. 页面显示昵称、身份类型、影响力、立场、账户信息。
4. 立场时间线按该身份历次发起展示。
5. 影响力曲线按历史记录计算。
6. 数据不足时显示空态。

显示名要求：

- 数据集前缀应清洗，如 `码05_产品懂点码` 显示为 `产品懂点码`。
- 数字后缀可保留，如 `估值洁癖2`，用于避免撞名。
- 不显示裸 person id / account id / world id。

## 14. 硬规则复查

### 14.1 用户可见长 ID

前端源码静态扫描只能辅助，最终以页面渲染为准。可先跑：

```bash
cd frontend
rg -n "[0-9a-f]{12,}" src/screens src/components src/skins src/pov
```

允许项：

- 测试 fixture 中的假 ID。
- API 字段名或不可见内部参数。

不允许项：

- 页面标题、用户名、卡片正文、通知、按钮、热榜、复盘中出现裸长 ID。

### 14.2 心智词表

```bash
cd frontend
rg -n "agent|OASIS|仿真|工作台|后端|模型|微博客|\\b步\\b" src/screens src/components src/shell src/skins
```

处理原则：

- 用户界面系统文案中不应出现这些词。
- 用户自己输入的正文或历史内容可能包含“大模型”等自然内容，不应强行改写。
- `后端 .env` 这类设置说明应改为“服务 .env”或“本地服务配置”。

### 14.3 配色真源

```bash
cd frontend
rg -n "bg-(slate|blue|amber|red|green|gray)-|text-(slate|blue|amber|red|green|gray)-|border-(slate|blue|amber|red|green|gray)-" src/screens src/components
```

说明：

- P13 计划要求语义色来自 `design/tokens.ts`。
- 现有历史代码可能仍有 Tailwind 默认色阶，这是后续设计债。审核时应区分“本片新增”与“历史遗留”。
- 新增语义色不要再散落硬编码色阶。

## 15. 性能验收

### 15.1 世界事件增量

```bash
curl -s -w '\nevents first time=%{time_total}s size=%{size_download}\n' \
  "http://127.0.0.1:8000/api/worlds/$WORLD_ID/events?run_id=$RUN_ID_1&run_id=$RUN_ID_2&after=0" \
  -o /tmp/weiguan-events-first.json

NEXT_AFTER=$(jq '.next_after' /tmp/weiguan-events-first.json)

curl -s -w '\nevents cursor time=%{time_total}s size=%{size_download}\n' \
  "http://127.0.0.1:8000/api/worlds/$WORLD_ID/events?run_id=$RUN_ID_1&run_id=$RUN_ID_2&after=$NEXT_AFTER" \
  -o /tmp/weiguan-events-cursor.json
```

预期：

- 第二次响应体显著小于第一次。
- 浏览器 Network 中 done 后不再持续轮询。

### 15.2 Snapshot 窗口

```bash
curl -s -w '\nsnapshot tail time=%{time_total}s size=%{size_download}\n' \
  "http://127.0.0.1:8000/api/runs/$RUN_ID/snapshot?tail=200" \
  -o /tmp/weiguan-snapshot-tail.json
```

预期：

- 尾部窗口响应不应接近历史全量 17.9MB。
- 页面只读回放首屏不应等待全量大 JSON。

### 15.3 发起请求返回

多平台发起时观察 Network：

- `/api/multi-runs` 应快速返回 `world_id` 和 `run_ids`。
- 返回后页面跳转到世界现场。
- 推演推进由后台 run lifecycle 维护，不应让 HTTP 请求长期 pending。

## 16. 已知风险与复测建议

- P13 已解决展示层连贯性，但 LLM 内容同质化仍属于生成层问题，不应靠前端隐藏。
- 1000 拍长跑会产生大量事件；当前依赖窗口读取和游标轮询，仍建议观察浏览器内存和接口大小。
- 如果使用本地 vLLM，先用 `tests/api/test_llm_connectivity.py` 验证 base_url/model/max_tokens/reasoning 参数。
- 多平台世界全景会包含历史多次发起，验收单次 launch 时必须使用带 `run_id` 的 URL。
- 生成建议会消耗 LLM；审核 UI 时可只验证已有建议读取和按钮状态，不必重复点击。

## 17. 审核者最短路径

1. 跑自动化：

```bash
cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
cd ../frontend && npx vitest run && npx tsc -b
```

2. 启动服务，打开 `/history`，选一个多平台历史条目。
3. 点击“看现场”，确认 URL 带全部 `run_id`。
4. 在现场等到完成，确认轮询停止。
5. 点击“看结果”，确认进入 launch 复盘。
6. 回到 `/compose`，勾选两个平台，确认提交中按钮禁用，成功后跳带 run_id 的现场。
7. 刷新 `/worlds`、`/history`、`/identity/...`，确认 loading 是骨架屏。
8. 扫描页面，不应看到裸长 ID 或工程心智词。

