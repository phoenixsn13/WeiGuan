# 给 codex 的后续工作提示词（P12：读模型与发起生命周期基座）

> 整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不改弱断言绕过。**前置：P6–P11 已落地。** 纯后端片，全程 `FakeEngine`，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-04-weiguan-P12-read-model-and-launch-lifecycle.md` 逐 Task 实现「读模型与发起生命周期基座」（P12）。设计真源 spec `2026-07-02-weiguan-world-identity-and-wishes-design.md`（§4.3/§8/§9 分片 7）+ 验收手册 `docs/manual/2026-07-04-weiguan-current-state-manual.md` §11/§12 实测记录。照做、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P12-T<n>`，代码打锚点，保留既有锚点。

背景（修结构性根因，不贴膏药）：事件溯源只有写模型没有读模型——每请求全量 fold（identities 实测 1.84s）、同步文件 IO 塞死事件循环（并发下小接口 2s）、runner 每 step 全量重写 runs.json、SSE 每 step 推全量累积快照（O(n²)）、每个新 actor 全量重写 persons.json；同时「发起」无一等生命周期——多平台 run_ids 不进 RunStore，无状态/无历史/无复盘，Live 轮询无终态。

铁律：
1. **退化不回归**：所有既有端点不带新参数时响应**字节兼容**（只准追加字段）；`fold_world` 本体不动；事件日志行格式不动；单平台路径语义不变。
2. **只追加不改写**：`events.jsonl` 永不重写；游标/缓存全是旁路，任何不一致兜底回全量读。
3. **成本中性**：不引新依赖，不换存储引擎（SQLite 为非目标）。
4. **契约锁定**：计划 §2 的契约（`events?after` 响应形状、`/api/launches` 字段、快照 `tail`/`replies_offset` 语义、多平台 run 落 RunRecord）是 P13 的消费面，逐字段照做，不得自行增删。

顺序 T1 事件游标读（`EventLog.read_page` + events 端点 `after/next_after/clock_tick`）→ T2 世界投影缓存（字节数为 key 的全量重算式缓存，fold 计数断言）→ T3 同步路由 `async def`→`def` 线程池化（含 iscoroutinefunction 回归 pin）→ T4 写路径治理（`SAVE_EVERY_STEPS=25` 节流 + `upsert_persons`/`ensure_accounts_for_actors` 批量）→ T5 `Launch` 生命周期记录 + `GET /api/launches` 统一发起历史 + events 带 `launch_status` → T6 多平台 run 落 `RunRecord`（orchestrator `run_recorder` 缝，默认 None 零变化）→ T7 快照窗口（`tail`/`replies_offset+replies_limit`，无参数字节一致）+ SSE 发射节流（`_emit_interval`，终态必发）。精确签名/断言见计划。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`。完成交回审核者按 Review Index 核验；e2e 性能数字由用户用 manual §11.1 curl 序列复跑对照（你不要求任何人提供/打印 key）。卡点回计划，契约回 spec，不要靠猜。
