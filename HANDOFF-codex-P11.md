# 给 codex 的后续工作提示词（P11：世界入口与多平台发起接线）

> 整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不改弱断言绕过。**前置：P6–P10 已落地。** 多平台联跑测试用 `FakeEngine`，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-03-weiguan-P11-world-entry-and-multiplatform-launch.md` 逐 Task 实现「世界入口与多平台发起接线」（P11）。设计真源 spec `2026-07-02-weiguan-world-identity-and-wishes-design.md`（§5.3/§7.2/§7.3/§7.5）+ 验收手册 §9（世界入口欠账）。照做、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P11-T<n>`，代码打锚点，保留既有锚点。

背景（修真实欠账）：多平台世界（愿望3）组件做完却未接入用户路径——`/world/:id/live` 不拉数据渲染空态、无 `GET /worlds/{id}/events`、导航"世界"指向上一个 batch 的 gallery。本计划把它补成完整可达路径。

铁律：
1. **退化不回归**：单平台发起走原 `POST /api/runs`、`/run/:id/live`、复盘逻辑**逐字不变**；多平台仅在选≥2 平台时启用。`MultiPlatformLiveScreen` 仍接受注入 `events`（测试回归）。
2. 前端**不构造 `poster_account_id`/`PlatformRunSpec`**——账户与 specs 一律后端 `POST /api/multi-runs` 内部解析（复用 `ensure_world_for_run`/`poster_account_id`/`WorldOrchestrator`）。
3. **配色单一真源（spec §7.2 硬规则）**：世界总览/Live/发起多平台 UI 的语义色（连接/桥接/情绪/影响力）**只来自 `design/tokens.ts`**，禁硬编 `bg-emerald-500`/`indigo-400`/`bg-*-[0-9]` 等默认色阶（历史两次同款欠账 P8-T7/P9-T8，务必先自查）。
4. 心智词表：世界层 UI 禁 `agent/OASIS/仿真/工作台/后端/模型/配置中心/世界地图`，用 世界/身份/平台/现场/发酵/传播/桥接。
5. **UI 工作流强制**：Task 3 先 imagegen 出世界入口原型（发起多平台+世界总览+Live 有数据）+ 自审，合格后再实现 Task 4/5/6。
6. 多平台并发 v1 同步（沿用现有 orchestrate）；SSE 实时流式为非目标。测试用 `FakeEngine` 多实例，无 LLM key。

顺序 T1 世界事件端点 `GET /worlds/{id}/events` → T2 UI 友好多平台发起 `POST /multi-runs`（后端组 specs/建账户）→ T3 原型图+自审 → T4 Live 路由拉数据（空/错态诚实）→ T5 发起页多平台模式（单平台零回归/≥2 跳世界 live）→ T6 世界总览 `/worlds` + 导航"世界"改指向 + 身份/历史/复盘加"看多平台现场"入口。精确文件/签名/断言见计划。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`；`cd frontend && npx vitest run && npx tsc -b`。完成交回审核者按 Review Index 核验。卡点回计划，契约回 spec，不要靠猜。
