# 围观 P12 验收手册：读模型与发起生命周期基座

版本日期：2026-07-06  
适用范围：P12 纯后端改造，不触发真实 OASIS/LLM 推演。  
设计真源：`docs/superpowers/plans/2026-07-04-weiguan-P12-read-model-and-launch-lifecycle.md`。  
前置页面验收参考：`docs/manual/2026-07-04-weiguan-current-state-manual.md`。

## 1. P12 要解决什么

P12 不是 UI 片，也不是仿真内容质量片。它修的是后端读模型、写路径和发起生命周期：

- 世界事件支持游标读取，避免每次拉全量事件。
- 世界人物/身份投影增加内存缓存，避免每次全量 fold。
- 纯文件读路由改为同步函数，让 FastAPI 放入线程池，避免同步 IO 阻塞事件循环。
- run 持久化和 persons 写入做节流/批量化，避免每 step 全量重写。
- 多平台发起有一等 `Launch` 生命周期，能统一展示发起历史和终态。
- 多平台每个平台 run 落入 `RunStore`，能复用 `/runs/{id}/snapshot|analysis|flavor`。
- snapshot 支持窗口读取，SSE 大快照发射节流，降低大 run 响应和推送压力。

非目标：

- 不引入 SQLite/数据库。
- 不做增量 fold。
- 不重构 SSE 为 WebSocket。
- 不跑真实 LLM。
- 不修改前端交互。

## 2. 实现提交索引

审核时先确认最近 7 个 P12 commit 均存在，并带 `Review-Anchor:` trailer：

```bash
git log --format='%h %s%n%b' -7
```

预期包含：

| Task | Commit | 主题 |
| --- | --- | --- |
| P12-T1 | `00393e0` | `backend: add world event cursors` |
| P12-T2 | `bf1c2f8` | `backend: cache world projections` |
| P12-T3 | `34a800b` | `backend: threadpool sync read routes` |
| P12-T4 | `374d6a0` | `backend: throttle run persistence writes` |
| P12-T5 | `edd2352` | `backend: record launch lifecycle` |
| P12-T6 | `91dcc47` | `backend: persist multi-platform run records` |
| P12-T7 | `0d4ab84` | `backend: bound snapshot and sse payloads` |

## 3. 自动化验收

### 3.1 全量非 LLM 回归

```bash
cd backend
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q
```

最近一次实现者验收结果：

```text
197 passed, 3 skipped, 6 deselected, 1 warning in 3.10s
```

审核者应以本机重新执行结果为准。该命令不需要 LLM key。

### 3.2 P12 定向测试

如果只想先看 P12 相关测试：

```bash
cd backend
/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest \
  tests/world/test_eventlog.py \
  tests/world/test_store.py \
  tests/api/test_world_events_route.py \
  tests/api/test_route_threading.py \
  tests/api/test_runner_write_governance.py \
  tests/api/test_multi_run_route.py \
  tests/api/test_snapshot_window.py \
  -q
```

重点测试锚点：

- `review:P12-T1-AC1` / `review:P12-T1-AC2`
- `review:P12-T2-AC1` / `review:P12-T2-AC2`
- `review:P12-T3-AC1` / `review:P12-T3-AC2`
- `review:P12-T4`
- `review:P12-T5`
- `review:P12-T6`
- `review:P12-T7`

## 4. 本地服务启动

如果要用接口做人工验收，建议显式使用同一套工作目录：

```bash
cd backend
WEIGUAN_WORKDIR=/tmp/weiguan-e2e \
  /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m uvicorn weiguan.api.main:app --host 127.0.0.1 --port 8000
```

说明：

- P12 人工接口验收可以用既有 `/tmp/weiguan-e2e` 历史数据。
- 不要点击会触发真实 LLM 的前端发起按钮，除非明确要做真实推演。
- 文档中的 curl 只读接口不会消耗 LLM。

## 5. 接口契约验收

以下命令中的 `WORLD_ID`、`RUN_ID` 需要替换为本地已有数据。可先用：

```bash
curl -s http://127.0.0.1:8000/api/runs | jq '.[0]'
curl -s http://127.0.0.1:8000/api/launches | jq '.launches[0]'
```

### 5.1 世界事件游标读取

```bash
curl -s "http://127.0.0.1:8000/api/worlds/$WORLD_ID/events?after=0" | jq '{count:(.frames|length), next_after, clock_tick, launch_status}'
curl -s "http://127.0.0.1:8000/api/worlds/$WORLD_ID/events?after=$NEXT_AFTER" | jq '{count:(.frames|length), next_after, clock_tick, launch_status}'
```

预期：

- 响应包含 `frames`、`next_after`、`clock_tick`、`launch_status`。
- 第一次 `next_after` 是事件日志总行数。
- 第二次用同一个 `next_after` 查询时，`frames` 应为空或只包含后续新增事件。
- `next_after` 仍表示当前日志总行数，不受 `run_id` 过滤影响。

带 run 过滤：

```bash
curl -s "http://127.0.0.1:8000/api/worlds/$WORLD_ID/events?run_id=$RUN_ID&after=0" \
  | jq '{count:(.frames|length), run_ids:(.frames|map(.run_id)|unique), next_after, launch_status}'
```

预期：

- `frames[].run_id` 只包含查询参数中的 run。
- 如果查询的 run_id 集合完整命中某个 launch，`launch_status` 为 `running`、`done` 或 `error`。
- 如果只传入 multi launch 的一部分 run_id，`launch_status` 为 `null`。

### 5.2 统一发起历史

```bash
curl -s http://127.0.0.1:8000/api/launches | jq '.launches[0:5]'
```

预期每条包含：

```json
{
  "launch_id": "...",
  "kind": "single 或 multi",
  "world_id": "...",
  "content": "...",
  "steps": 10,
  "platforms": ["twitter"],
  "run_ids": ["..."],
  "status": "running/done/error",
  "clock_tick": 10,
  "poster_person_id": "...",
  "poster_persona": "ordinary/verified/kol",
  "created_at": "..."
}
```

验收点：

- `created_at` 降序。
- 单平台条目 `kind="single"`，`launch_id == run_id`。
- 多平台条目 `kind="multi"`，`run_ids` 包含每个平台 run。

### 5.3 多平台 run 可复用普通 run 端点

从 `/api/launches` 找一个 `kind="multi"` 的条目，取其中任意 `run_ids[0]`：

```bash
curl -s "http://127.0.0.1:8000/api/runs/$PLATFORM_RUN_ID" | jq '{run_id,status,current_step,platform:.platform,world_id}'
curl -s "http://127.0.0.1:8000/api/runs/$PLATFORM_RUN_ID/snapshot?tail=2" | jq '{posts:(.posts|length), replies:(.replies|length), window}'
curl -s "http://127.0.0.1:8000/api/runs/$PLATFORM_RUN_ID/analysis" | jq 'keys'
curl -s "http://127.0.0.1:8000/api/runs/$PLATFORM_RUN_ID/flavor" | jq 'keys'
```

预期：

- `/api/runs/{id}` 返回 200。
- `/snapshot` 非空，且 `tail=2` 返回窗口信息。
- `/analysis` 和 `/flavor` 返回 200。

### 5.4 Snapshot 窗口

无参数全量：

```bash
curl -s "http://127.0.0.1:8000/api/runs/$RUN_ID/snapshot" | jq '{posts:(.posts|length), replies:(.replies|length), has_window:has("window")}'
```

预期：`has_window=false`，保持旧响应形状。

尾部窗口：

```bash
curl -s "http://127.0.0.1:8000/api/runs/$RUN_ID/snapshot?tail=20" \
  | jq '{posts:(.posts|length), replies:(.replies|length), reactions:(.reactions|length), window}'
```

预期：

- 响应包含 `window.tail=20`。
- `window.totals` 记录全量计数。
- `posts` 包含 seed 帖和最后 20 条帖子，可能多于 20。
- `actors` 只保留窗口中被引用的人。

加载更早评论：

```bash
curl -s "http://127.0.0.1:8000/api/runs/$RUN_ID/snapshot?replies_offset=20&replies_limit=20" \
  | jq '{replies:(.replies|length), window}'
```

互斥参数应报 400：

```bash
curl -i "http://127.0.0.1:8000/api/runs/$RUN_ID/snapshot?tail=20&replies_offset=0&replies_limit=20"
```

预期：HTTP 400。

## 6. 性能复测建议

P12 的性能验收重点不是视觉截图，而是响应大小和接口延迟。建议用 7 月 4 日手册里同一套 `/tmp/weiguan-e2e` 数据复测。

### 6.1 基线对照

P12 计划中的历史基线：

- warm `/api/identities`：约 1.840s。
- warm `/api/worlds/{id}/persons`：约 1.727s。
- 全量世界事件：约 3.19MB。
- 全量 snapshot：约 17.9MB。
- 并发观察时小接口可能被拖到秒级。

### 6.2 推荐测量命令

```bash
curl -s -w '\nidentities time=%{time_total}s size=%{size_download}\n' \
  http://127.0.0.1:8000/api/identities -o /tmp/p12-identities.json

curl -s -w '\npersons time=%{time_total}s size=%{size_download}\n' \
  http://127.0.0.1:8000/api/worlds/$WORLD_ID/persons -o /tmp/p12-persons.json

curl -s -w '\nevents full time=%{time_total}s size=%{size_download}\n' \
  "http://127.0.0.1:8000/api/worlds/$WORLD_ID/events?after=0" -o /tmp/p12-events-full.json

NEXT_AFTER=$(jq '.next_after' /tmp/p12-events-full.json)
curl -s -w '\nevents cursor time=%{time_total}s size=%{size_download}\n' \
  "http://127.0.0.1:8000/api/worlds/$WORLD_ID/events?after=$NEXT_AFTER" -o /tmp/p12-events-cursor.json

curl -s -w '\nsnapshot full time=%{time_total}s size=%{size_download}\n' \
  "http://127.0.0.1:8000/api/runs/$RUN_ID/snapshot" -o /tmp/p12-snapshot-full.json

curl -s -w '\nsnapshot tail time=%{time_total}s size=%{size_download}\n' \
  "http://127.0.0.1:8000/api/runs/$RUN_ID/snapshot?tail=50" -o /tmp/p12-snapshot-tail.json
```

预期方向：

- 第二次及后续 `/api/identities`、`/api/worlds/{id}/persons` 应明显快于基线。
- `events?after=$NEXT_AFTER` 应接近空增量，响应体应为 KB 级或更小。
- `snapshot?tail=50` 应显著小于全量 snapshot。

## 7. 逐 Task 审核清单

### P12-T1：事件游标

代码锚点：

- `backend/weiguan/world/eventlog.py`：`review:P12-T1`
- `backend/weiguan/world/store.py`：`review:P12-T1`
- `backend/weiguan/api/routes.py`：`review:P12-T1`

审核问题：

- `events.jsonl` 是否仍然 append-only，不改写旧行？
- `read()` 旧接口是否保留？
- `after` 是否按 1-based 行号解释？
- `run_id` 过滤时 `next_after` 是否仍是总行数？

### P12-T2：投影缓存

代码锚点：

- `backend/weiguan/world/store.py`：`review:P12-T2`

审核问题：

- cache key 是否只依赖 `events.jsonl` 与 `persons.json` 字节数？
- `fold_world` 本体是否未改？
- `append_event` 或 persons 写入后是否能自然失效？

### P12-T3：线程池化

代码锚点：

- `backend/tests/api/test_route_threading.py`：`review:P12-T3`

审核问题：

- 纯同步读路由是否为 `def`？
- 需要 await/后台任务/SSE 的路由是否仍为 `async def`？
- 是否没有把同步重 IO 留在事件循环里？

### P12-T4：写路径治理

代码锚点：

- `backend/weiguan/api/runner.py`：`review:P12-T4`
- `backend/weiguan/world/store.py`：`review:P12-T4`
- `backend/weiguan/world/run_bridge.py`：`review:P12-T4`

审核问题：

- `SAVE_EVERY_STEPS = 25` 是否存在？
- run 保存是否只在 step1、25 倍数、终态和错误态保存？
- actor account 是否批量 `upsert_persons`，不是每个 actor 重写一次 persons 文件？

### P12-T5：Launch 生命周期

代码锚点：

- `backend/weiguan/world/models.py`：`review:P12-T5`
- `backend/weiguan/world/store.py`：`review:P12-T5`
- `backend/weiguan/api/routes.py`：`review:P12-T5`

审核问题：

- multi-run 创建后是否立即有 running launch？
- 编排完成是否更新为 done 并写 clock_tick？
- 编排异常是否更新为 error 并写 error 信息？
- `/api/launches` 是否统一返回 single/multi？
- `world_events` 是否只在完整 run_id 集合命中 launch 时返回 `launch_status`？

### P12-T6：多平台 run 记录

代码锚点：

- `backend/weiguan/world/orchestrator.py`：`review:P12-T6`
- `backend/weiguan/api/store.py`：`review:P12-T6`
- `backend/weiguan/api/routes.py`：`review:P12-T6`

审核问题：

- `WorldOrchestrator` 的 `run_recorder` 默认 None 时是否保持旧行为？
- multi-run 每个平台 run 是否 `create_with_id(..., status="running")`？
- `on_delta` 是否累积 snapshot？
- `on_done/on_error` 是否写终态？
- 多平台 run 是否能复用 `/runs/{id}/snapshot|analysis|flavor`？

### P12-T7：大响应治理

代码锚点：

- `backend/weiguan/api/snapshot_window.py`：`review:P12-T7`
- `backend/weiguan/api/routes.py`：`review:P12-T7`
- `backend/weiguan/api/runner.py`：`review:P12-T7`

审核问题：

- `/snapshot` 无参数是否保持旧响应形状，不追加 `window`？
- `tail` 是否裁剪 replies/reactions/follows/reports/traces，并保留 seed post？
- `replies_offset/replies_limit` 是否从尾部向前分页？
- `tail` 与 replies 分页是否互斥并返回 400？
- SSE 是否按 `_emit_interval` 节流，终态仍必发？

## 8. 审核结论模板

审核者可以按下面格式回填：

```text
P12 审核结论：
- 自动化回归：通过 / 未通过
- T1 事件游标：通过 / 问题
- T2 投影缓存：通过 / 问题
- T3 线程池化：通过 / 问题
- T4 写路径治理：通过 / 问题
- T5 Launch 生命周期：通过 / 问题
- T6 多平台 RunRecord：通过 / 问题
- T7 Snapshot/SSE 大响应治理：通过 / 问题
- 性能复测：通过 / 未测 / 问题

需要实现者整改：
1. ...
2. ...
```

## 9. 已知边界

- P12 仍是文件存储方案，不是数据库化方案。
- 世界投影缓存是进程内缓存，服务重启后会重新 warm。
- `events?after` 解决增量读取，但 full replay 仍可主动请求全量。
- `snapshot?tail` 降低新消费者响应大小；旧消费者如果继续拉全量，仍会得到完整大响应。
- P12 不处理 LLM 内容重复、角色多样性、微博/Reddit 文案质量等问题。
