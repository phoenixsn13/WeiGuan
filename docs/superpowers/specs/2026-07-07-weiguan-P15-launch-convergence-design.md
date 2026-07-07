# 围观 P15 · 发起会话收束（launch 归一）（设计 spec）

版本日期：2026-07-07
设计者：审核/规划者（本人）。实现者：codex。
上游：[[2026-07-04-weiguan-P12-read-model-and-launch-lifecycle]]（Launch 读模型与发起生命周期）、[[2026-07-06-weiguan-P14-information-architecture-and-wiring-design]]（世界一等化 + 世界 persist 归一）。
横切约束：conventions 文档 §5「端到端接线验收表」（P14 起制度化，本片首个 dogfood）。

## 0. 为什么有 P15

P14 做了**世界 persist 归一**，但漏了**发起会话（launch）本身的归一**——把"发起即留痕"理解成"世界留痕"，没意识到产品层的一等发起记录应是 launch，不是 world、更不是 run。结果 run 与 launch 是两个层级，但发起路径**只收束了一半**：

- 单平台 `POST /api/runs`（`routes.py:742-744`）只 `store.create(cfg)` + 返回 `{run_id}`，**不建持久 Launch**。
- `GET /api/launches`（`routes.py:614-620`）读时用 `_single_launch_summary`（`routes.py:296-310`，`launch_id = record.run_id`）把每条 run **临时包装**成假 launch。
- `POST /api/multi-runs`（`routes.py:589`）才建真 Launch。

下游全是这条不对称的**补偿**：`/api/launches` 读时双 store 合成、`/api/worlds` 的 `_world_summary`（`routes.py:348-353`）在 launch 与 run 之间比 `created_at` 取大、`HistoryScreen.tsx:146` `Promise.all([fetchRuns(), fetchLaunches()])` 双读拼装。表现为反复出现的"页面有内容但热榜没内容""历史分组和现场入口口径不一致"。

**根只有一条**：单平台发起不落持久 Launch。修根，补偿全消。P15 把 run 与 launch 彻底二分，产品路径只认 launch。

### 根因证据（代码级）

1. **单平台不建 Launch**：`routes.py:742-744` `run_id = store.create(cfg); runner.start(run_id); return {"run_id": run_id}`——无 `create_launch`。
2. **读时合成**：`routes.py:620` `launches.extend(_single_launch_summary(record) for record in store.list())`，令 `launch_id == run_id`（`routes.py:298`）。
3. **双 store 比对**：`routes.py:339-353` `_world_summary` 拿 `latest_launch` 与 `latest_record`（来自 `run_store.list()`）比 `created_at` 择大。
4. **前端双读拼装**：`HistoryScreen.tsx:146` 同时 `fetchRuns()` + `fetchLaunches()` 再自行合并。

## 1. 锁定决策（brainstorming 已确认）

| 维度 | 决定 | 理由 |
|---|---|---|
| launch_id 策略 | **铸新 `launch_...` id**（单/多一致，单平台 launch_id ≠ run_id） | 本项目无旧数据负担，取最干净模型，不为兼容妥协。 |
| 旧数据迁移 | **一次性 idempotent 回填** Launch 记录 | 让 `/api/launches`、`/api/worlds` 真正单源读。旧前端指向旧 run 复盘的链路失联——已授权。 |
| 本片范围 | **后端收束 + 前端全收敛**（一片到底，不留半接线） | 用户核心诉求"别再半接线"；后端-only 会重蹈 P14 覆辙。 |
| 发起端点 | **保留 `POST /api/runs` 与 `POST /api/multi-runs` 两端点**，各自补建 Launch | 单/多前端已分支；合并成单一发起端点是模型美化，YAGNI（§4 非目标）。 |

## 2. 契约（P15 实现片的消费面，锁定）

### 2.1 run 与 launch 二分（语义契约）

- **launch** = 产品层发起会话，一等持久对象，自有 `launch_...` id。单平台 `run_ids = [run_id]`，多平台 `run_ids = [...]`。**历史 / 世界 / 热榜 / 复盘的唯一主数据源**。
- **run** = 技术执行单元。`live / snapshot / analysis / insights / interview / events / frames / retro / flavor / perf` 仍按 `run_id`（不动既有 `/api/runs/{run_id}/*` 端点形状）。
- **run 退出产品读路径**：`GET /api/runs` 列表退化为技术用途，产品屏不再消费。

### 2.2 写侧归一

- `POST /api/runs`（单平台）在 `store.create(cfg)` 之外**补建 Launch**：铸新 `launch_id`，`kind="single"`，`run_ids=[run_id]`，透传 `world_id / world_name / content / steps / platform / status`。返回体**追加 `launch_id`**（保留 `run_id`，非破坏；P12 铁律"只追加字段"）：`{"run_id": "...", "launch_id": "launch_..."}`。
- `POST /api/multi-runs` 已建 Launch，**不动**。
- 结果：两条发起路径都"发起即落真 Launch"。`_single_launch_summary` 读时合成**彻底退役、删除**。

### 2.3 读侧单源

- `GET /api/launches`：只读 `world_store.list_all_launches()`，**删掉 `store.list()` 合成那半**（`routes.py:620` 移除）。响应形状不变（仍是 `{launches: [...]}`，单平台项现来自真 Launch 而非合成，字段齐备）。
- `GET /api/worlds`：`_world_summary` 的 `latest` **只从 launches 取**，删除 launch-vs-run 的 `created_at` 比对（`routes.py:346-355` 简化为仅 `latest_launch`）。`run_count` 等统计如需 run 维度仍可读 run_store，但 `latest` 单源自 launch。
- `_latest_run_item`（`routes.py:329`）若仅服务于上述比对，一并删除；若他处复用则保留。

### 2.4 迁移（idempotent 回填）

- 新增启动期一次性迁移：扫 `run_store`，给每条**无对应 Launch**的单 run 补建 Launch（铸新 `launch_id`，`kind="single"`，`run_ids=[run_id]`，字段取自 run record）。
- **幂等**：以"该 run_id 是否已被某 Launch 的 `run_ids` 覆盖"为判据，已覆盖则跳过；重复启动不重复建。
- 旧前端指向旧 run 复盘的链路失联——已授权（无旧数据负担）。迁移只保证读侧单源正确，不承诺旧链路可达。

### 2.5 name 透传与留痕语义

- 沿用 P14：单平台补建 Launch 时，`world_name` 仅新建世界时写入；世界名经 `resolve_world_name` 兜底（Launch 内容/身份名派生），可见区永不裸 hex。
- 发起即 persist（P14 §2.4）不变；本片令"发起即 persist **launch**"与"发起即 persist **world**"对齐。

## 3. 设计分节

### 第 1 节 · 写侧归一（后端）
- §2.2：`POST /api/runs` 补建 Launch + 返回追加 `launch_id`；`_single_launch_summary` 删除。
- 审核必查：单平台发起后，该 launch 进 `world_store`，`/api/launches` 不再依赖 `store.list()` 合成。

### 第 2 节 · 读侧单源（后端）
- §2.3：`/api/launches`、`/api/worlds` 去双 store 比对。
- 审核必查：`rg "_single_launch_summary" weiguan/api/routes.py` 零命中；`_world_summary` 无 `latest_record` 比对分支。

### 第 3 节 · 迁移（后端）
- §2.4：idempotent 回填。测试 pin：造 N 条无 Launch 的单 run → 迁移后每条有唯一 Launch；重复跑迁移 Launch 数不变（幂等）。

### 第 4 节 · 前端全收敛
- `HistoryScreen`：删 `Promise.all([fetchRuns(), fetchLaunches()])` 双读，只读 launch 口径（`fetchLaunches` 或 `/api/worlds`）；删除"runs 没有就用 launches、反之包装"的补丁逻辑。
- 发起后跳转统一 launch 口径：单 → `/run/:runId/live?launch=:launchId`，多 → `/world/:worldId/live?launch=:launchId&run_id=...`；`run_id` 仅作 live 钻取参数。
- `LaunchRetroScreen` 已按 launch_id，校对单平台新 id 通路可达。
- 审核必查：`rg "fetchRuns" src/screens` 仅 live/technical 屏（IdentityScreen/GalleryScreen 等）保留，History 零命中。

### 第 5 节（横切）· 端到端接线验收表
> conventions §5 首次 dogfood，落本 spec + 交回 codex 的 manual。

| 路径（从 → 到） | 入口 | 接线验收凭据 |
|---|---|---|
| 发起页（单平台）→ launch | 提交后返回 `launch_id`，跳 `/run/:runId/live?launch=:launchId` | `ComposeScreen.test.tsx` 单平台提交断言拿到 launch_id |
| 发起页（多平台）→ launch | 跳 `/world/:worldId/live?launch=:launchId` | 既有多平台提交测试 |
| 历史 → launch → 复盘 | 历史条目按 launch_id 点入 `LaunchRetroScreen` | `HistoryScreen.test.tsx` 单源读 + 复盘链路 |
| 世界 → launch → live | 世界卡 `latest.launch_id` 进现场 | `WorldOverviewScreen.test.tsx` latest 来自 launch |

三硬校验（每条路径都过）：入口连通、无死胡同、可见区对 `/[0-9a-f]{12,}/`、`/w_[0-9a-f]{6,}/` 零命中。

## 4. 非目标（YAGNI）

- **不合并发起端点**：`POST /api/runs` 与 `POST /api/multi-runs` 保留两端，各自补建 Launch。合并成单一发起端点是模型美化，不影响接线完整性。
- **不承诺旧 run 复盘旧链路可达**：迁移只保证读侧单源，铸新 id 令旧链路失联（已授权）。
- 不动仿真内容质量 / 分析能力 / SSE 协议 / 虚拟列表 / `/api/runs/{run_id}/*` 技术端点形状。
- 世界删除/归档仍非目标（P14 已列）。

## 5. 验收要点

- 后端：`pytest -m "not llm and not llm_effect"` 全绿；新增/改动测试——单平台发起后 Launch 落 world_store（`kind="single"`、`run_ids=[run_id]`、有 `launch_id`）；`/api/launches` 不读 run_store（`_single_launch_summary` 已删）；`_world_summary.latest` 单源自 launch；迁移幂等回填；可见区无裸 hex。
- 前端：`vitest` + `tsc`；`HistoryScreen` 单源读、无双读拼装；单/多平台发起跳转均带 `launch_id`；复盘按 launch_id 可达；History 屏 `fetchRuns` 零命中。
- e2e（用户代跑）：单平台发起 → `/api/launches` 出现该 launch（`kind="single"`）→ 历史可见 → 复盘可达；世界卡 latest 来自 launch。

## 6. 分片建议

单片可覆盖（后端写侧归一 + 读侧单源 + 迁移 + 前端收敛，体量适中），命名 **P15 · 发起会话收束（launch 归一）**，Review-Anchor `P15-T{n}`。若实现时体量超预期，可拆"P15a 后端 launch 归一 + 迁移 / P15b 前端 launch 口径收敛"，契约面（§2）不变。
