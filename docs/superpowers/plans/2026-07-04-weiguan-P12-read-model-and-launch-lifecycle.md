# P12 · 读模型与发起生命周期基座（纯后端）

> 设计真源：`docs/superpowers/specs/2026-07-02-weiguan-world-identity-and-wishes-design.md`（§4.3 读/写路径、§8 契约面、§9 分片 7）。
> 依据：`docs/manual/2026-07-04-weiguan-current-state-manual.md` §11/§12 实测记录。
> 角色：设计/审核 = 设计者；实现 = codex。TDD：先失败测试→最小实现→commit，每 commit 带 `Review-Anchor: P12-T<n>`。

## 0. 根因与目标

本片修两条结构性根因，不做贴膏药：

- **根因 A：事件溯源只有写模型，没有读模型。** 每次读全量重放（`store.py:109-150` 每请求全量 fold；`eventlog.py:20` 每请求全量逐行 pydantic 校验）；全部路由 `async def` 里跑同步文件 IO，单 worker 下小接口被大响应拖死（manual §11.2）；`runner.py:122` 每 step 全量重写 runs.json，`runner.py:134` + `routes.py:572` SSE 每 step 推全量累积快照（O(n²) 网络量）；`store.py:55` 每个新 actor 全量重写 persons.json。
- **根因 B：「发起」没有一等生命周期对象。** `POST /multi-runs` 造出的 run_ids 不进 RunStore（无状态/无历史/无复盘/`/runs/{id}/*` 全 404）；Live 轮询无终态；世界现场双语义只靠 URL 区分；无统一发起历史。

实测基线（manual §11.1，修完由用户复跑对照）：`/api/identities` 1.840s、`/api/worlds/{id}/persons` 1.727s、全量世界事件 3.19MB、snapshot 17.9MB、并发下小接口 ~2s。

## 1. 铁律

1. **退化不回归**：所有既有端点在不带新参数时响应**字节兼容**（只准追加字段，不准改/删）；`fold_world` 本体不动；事件日志行格式不动；单平台发起/回放路径语义不变。
2. **只追加不改写**：`events.jsonl` 永不重写；新增读法（游标/缓存）都是旁路，任何不一致兜底回全量读（缓存失效 = 正确性无损）。
3. **成本中性**：不引新依赖、不换存储引擎（SQLite/DB 为非目标，缓存+游标实证不够再议）。
4. 测试全程 `FakeEngine`，不碰 LLM key。

## 2. 契约面（P13 按此消费，中途不回改）

- `GET /api/worlds/{id}/events?after=<seq>&run_id=...` → `{frames, next_after, clock_tick, launch_status}`。
  - `seq` = 事件在 `events.jsonl` 中的 1-based 行号（append-only ⇒ 稳定）；`frames` = 行号 > after（再按 run_id 过滤），响应内按 `(tick, created_at, event_id)` 排序；`next_after` = 当前日志总行数（含被 run_id 过滤掉的行）；不带 `after` 等价 `after=0`。
  - `clock_tick` 来自 world.json；`launch_status` 仅当查询 run_id 集合能完整落进某个 launch 的 run_ids 时给出（`running/done/error`），否则 `null`。
- `GET /api/launches` → `{launches: [...]}`，单平台+多平台统一视图，字段：`launch_id, kind("single"|"multi"), world_id, content, steps, platforms[], run_ids[], status, clock_tick, poster_person_id, poster_persona, created_at`；`created_at` 降序。单平台条目 = RunStore 包装（`launch_id = run_id`，`clock_tick = current_step`）。
- `GET /api/runs/{id}/snapshot?tail=<n>&replies_offset=<m>&replies_limit=<k>`：
  - 无参数 → 与现状字节一致（全量）。
  - `tail=n` → replies/reactions/follows/reports/traces 各取**最后 n 条**；posts 取 seed 帖 + 最后 n 条；actors 裁剪为被引用的 author/actor（含 seed 作者）；响应追加 `window: {tail, totals: {posts, replies, reactions, follows, reports, traces}}`。
  - `replies_offset/replies_limit`（配合"加载更早评论"）：replies 按存储序（旧→新），从**尾部**向前偏移——返回 `replies[len-offset-limit : len-offset]`；与 `tail` 互斥（同时给报 400）。
- 多平台每个平台 run 以其 `run_id`（`w_..:platform:hex`）成为普通 `RunRecord` ⇒ `/api/runs`、`/runs/{id}/snapshot|retro|analysis|flavor`、评论区 replay 对多平台 run 天然可用。

## 3. Tasks

### T1 · 事件游标读 + events 端点升级 `review:P12-T1`

- `world/eventlog.py`：新增 `read_page(self, *, after: int = 0, run_ids: set[str] | None = None) -> tuple[list[WorldEvent], int]`，返回（行号>after 且命中过滤的事件，日志总行数）。`read()` 原样保留。
- `api/routes.py` `world_events`：接 `after` query 参数，响应追加 `next_after`、`clock_tick`（`launch_status` 本任务先恒 `null`，T5 接管）。`frames` 键与排序保持既有口径。
- 断言：追加 5 事件后 `after=0` 得 5 条且 `next_after=5`；`after=5` 得空且 `next_after=5`；`after=3` 只得后 2 条；run_id 过滤与 after 叠加时 `next_after` 仍为总行数；不带参数时响应包含既有 `frames` 且内容与旧实现一致。

### T2 · 世界投影缓存（读模型 checkpoint） `review:P12-T2`

- `world/store.py`：`WorldStore` 内存缓存 `_projection_cache: dict[world_id, (events_bytes, persons_bytes, views)]`。命中键 =（`events.jsonl` 字节数, `persons.json` 字节数）——append-only 保证"字节数不变 ⇒ 投影不变"；文件不存在按 0。`list_persons` / `get_person_view` / `list_identities` 一律走 `_fold_cached(world_id)`；miss → 全量 fold 后回填。**fold_world 本体与结果口径零改动**（增量 fold 列为非目标）。
- 断言：连续两次 `list_persons` 只触发一次 fold（以 monkeypatch 计数 `weiguan.world.store.fold_world`）；`append_event` 后再读触发重算；缓存命中结果与全量重算逐字段相等；`list_identities` 对 N 个世界在二次调用时 fold 次数为 0。

### T3 · 同步路由线程池化 `review:P12-T3`

- 凡是"纯同步 store/文件读"的端点由 `async def` 改 `def`（FastAPI 自动进线程池，事件循环不再被文件 IO/大序列化阻塞）：`crowds, get_world, world_events, list_world_persons, list_identities, get_person, preview_cost, run_frames, list_runs, get_run, snapshot, retro, analysis, flavor, perf, saved_insights, insights(POST), create_person`。
- 保持 `async def`：`create_run`、`create_multi_run`、`orchestrate_world`、`stream_events`、`interview`（需要事件循环/await）。
- 断言：pin 一个回归测试，`inspect.iscoroutinefunction` 对上述两组端点逐一断言（防止将来无意改回）；既有全部 API 测试通过。

### T4 · 写路径治理 `review:P12-T4`

- `api/runner.py`：每 step `save()` 改节流——模块级常量 `SAVE_EVERY_STEPS = 25`；保存时机 = `step == 1`（seed 尽早落盘）、`step % SAVE_EVERY_STEPS == 0`、终态（done/error）。
- `world/store.py`：新增 `upsert_persons(world_id, persons: list[Person])`（一次读改写）；既有 `upsert_person` 改为委托单元素批量，签名不动。
- `world/run_bridge.py`：新增 `ensure_accounts_for_actors(store, *, world_id, platform, actors, account_of, poster_skip: set[int]) -> None`——收集本拍缺失账户，**一次** `upsert_persons` 落盘；既有 `ensure_account_for_actor` 保留。`runner._run` 与 `orchestrator._map_actors` 改用批量版。
- 断言：FakeEngine 跑 10 step → `save` 调用次数 ≤ 4（start、step1、终态、+可能的整除点），精确 pin；一拍含 5 个新 actor 时 persons.json 只被写 1 次（monkeypatch `_write_json` 计数）；批量结果与逐个 upsert 等价。

### T5 · Launch 生命周期记录 + 统一发起历史 `review:P12-T5`

- `world/models.py`：新增 `Launch(BaseModel)`：`launch_id, world_id, content, steps, platforms: list[Platform], run_ids: list[str], status: Literal["running","done","error"], clock_tick: int = 0, poster_person_id: str | None, poster_persona: PersonaKind, error: str | None = None, created_at`。
- `world/store.py`：`create_launch(launch)`、`update_launch(world_id, launch_id, **updates)`、`list_launches(world_id)`、`find_launch_for_runs(world_id, run_ids: set[str]) -> Launch | None`（launch.run_ids ⊇ 查询集合）。存 `launches.json`（world 目录内，读改写，低频小文件）。
- `api/routes.py` `create_multi_run`：组完 specs 后、调度前写 Launch（status=running）；`_drain_world_orchestrator` 编排完结回写 `status=done` + 最终 `clock_tick`，异常回写 `status=error` + error 信息。
- `world_events` 响应接 `launch_status`（带 run_id 查询时经 `find_launch_for_runs` 解析）。
- 新增 `GET /api/launches`：扫持久世界的 launches + RunStore 单平台 run 包装（契约见 §2），`created_at` 降序。
- 断言：multi-run 创建即有 running launch；FakeEngine 编排完成后 status=done 且 clock_tick>0；编排抛错后 status=error；`events?run_id=...` 返回正确 launch_status，查询集合不完整命中时为 null；`/api/launches` 单多混排按时间降序、单平台条目 kind="single" 且 launch_id=run_id。

### T6 · 多平台 run 落 RunRecord `review:P12-T6`

- `world/orchestrator.py`：`WorldOrchestrator.__init__` 增 `run_recorder: RunRecorder | None = None`（Protocol：`on_delta(run_id, delta)`、`on_done(run_id)`、`on_error(run_id, message)`）；默认 None 时行为与现状逐字节一致（退化不回归）。每拍取到 delta 后调 `on_delta`；某平台迭代耗尽调 `on_done`；编排异常对未完结 run 调 `on_error`。
- `api/store.py`：`RunStore.create_with_id(run_id, config)`（additive；重复 run_id 抛 ValueError）。
- `api/routes.py` `create_multi_run`：调度前对每个 spec `create_with_id`（status=running）；接一个 recorder——`on_delta` 走 `record.accumulate` + T4 同款节流保存，`on_done/on_error` 置终态并保存。
- 断言：FakeEngine 多平台发起后 `/api/runs` 出现两条 `w_..:platform:hex` 记录且终态 done；`/runs/{platform_run_id}/snapshot` 非空、`/analysis` 200、`/flavor` 200；不接 recorder 的编排测试全部原样通过。

### T7 · 大响应治理（快照窗口 + SSE 发射节流） `review:P12-T7`

- `api/routes.py` `snapshot`：实现 §2 的 `tail` / `replies_offset+replies_limit` 契约；无参数字节兼容；`tail` 与 `replies_offset` 同给 → 400。裁剪逻辑放 `analysis/` 或 `api/` 下纯函数 `window_snapshot(snapshot, *, tail) -> dict`，可单测。
- `api/runner.py`：SSE 发射节流——`_emit_interval(total_items)`：累积条目 < 2000 → 每 step 发；< 10000 → 每 5 step；否则每 20 step；终态与最后一步必发全量。`RunEvent` 结构不变（仍发累积快照，频率受控）。
- 断言：`tail=2` 时各集合长度=2、posts 含 seed、actors 只含被引用者、`window.totals` 等于全量长度；`replies_offset=2&replies_limit=2` 返回精确切片；无参数响应与旧实现逐字节一致；小 run（10 step）每 step 都收到 snapshot 事件；构造大快照（>2000 条目）后发射步进为 5。

## 4. Review Index

| 锚点 | 主题 | 主要文件 |
|---|---|---|
| P12-T1 | 事件游标读 | `world/eventlog.py`, `api/routes.py` |
| P12-T2 | 世界投影缓存 | `world/store.py` |
| P12-T3 | 路由线程池化 | `api/routes.py` |
| P12-T4 | 写路径治理 | `api/runner.py`, `world/store.py`, `world/run_bridge.py` |
| P12-T5 | Launch 生命周期 + /api/launches | `world/models.py`, `world/store.py`, `api/routes.py` |
| P12-T6 | 多平台 run 落 RunRecord | `world/orchestrator.py`, `api/store.py`, `api/routes.py` |
| P12-T7 | 快照窗口 + SSE 节流 | `api/routes.py`, `api/runner.py` |

## 5. 非目标

- 不引 SQLite/数据库、不做增量 fold（缓存全量重算式已够，实证不够再议）。
- 不做 SSE→WebSocket/流式协议重构（发射节流即可）。
- 不动前端（P13 消费本片契约）。
- 不做仿真内容多样性（LLM 层，需真 key 实证，单独立项）。

## 6. 验收

```bash
cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
```

全绿后由**用户**用 manual §11.1 的 curl 序列对 `/tmp/weiguan-e2e` 数据集复跑，对照基线：warm `/api/identities` 与 `/api/worlds/{id}/persons` 应降到 ~100ms 量级；`events?after=` 稳态轮询响应应为 KB 级；并发观察中小接口不再被拖到秒级。
