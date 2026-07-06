# 给 codex 的后续工作提示词（P13：连贯性与界面产品化）

> 整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不改弱断言绕过。**前置：P12 已完成并通过审核**（本片消费 P12 契约：`events?after`、`/api/launches`、快照窗口、多平台 RunRecord）。测试用 msw/fixture mock，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-04-weiguan-P13-coherence-and-ui-productization.md` 逐 Task 实现「连贯性与界面产品化」（P13）。设计真源 spec `2026-07-02-weiguan-world-identity-and-wishes-design.md`（§7 全节，特别是 §7.2 两条硬规则）+ 验收手册 `docs/manual/2026-07-04-weiguan-current-state-manual.md` 截图实据。照做、不改设计、不改断言绕过。TDD；每 commit 带 `Review-Anchor: P13-T<n>`，保留既有锚点。

背景（截图实据）：多平台现场作者显示裸 hex（`7bb2eb80803d…`）；meta 行"刚刚·来自Web"竖排溢出；桥接线是 absolute 定位 hack；轮询 1500ms 永不停、无"发酵中/已完成"终态；世界现场双语义靠 URL 猜；热榜同题 4 连；回放页写"实时互动"；术语"500 步·微博客"；世界总览 2.5s 白屏。

铁律：
1. **配色单一真源**（spec §7.2 硬规则一）：语义色只来自 `design/tokens.ts`，禁 `bg-*-[0-9]` 默认色阶。历史三次同款欠账，动前端先自查。
2. **可见文案禁裸 ID**（spec §7.2 硬规则二）：显示名走固定解析链 payload `author_display_name` → persons 投影 join → 化名兜底 `围观者·{尾4位}`；渲染输出对 `/[0-9a-f]{12,}/` 零命中，测试 pin 住。
3. **单平台零回归**：`POST /api/runs`、`/run/:id/live`、单平台复盘行为不变；`MultiPlatformLiveScreen` 继续接受注入 `events`。
4. 心智词表：禁 `agent/OASIS/仿真/工作台/后端/模型`；用户可见"步"→"拍"。
5. **UI 工作流强制**：T2 先 imagegen 原型（多平台现场改版/统一发起历史/launch 复盘/发起页收紧，desktop+mobile）+ 对照 §7.1–§7.3 自审落盘，合格后再做 T3–T7。
6. **不改后端契约**：有缺口回 P12 计划提出，不得前端绕过。

顺序 T1 显示名管线（后端 `delta_to_events` payload 富化 `author_display_name` + 前端三级解析链 + `cleanDisplayName` 前缀清洗）→ T2 原型图+自审 → T3 多平台现场改版（`after` 游标增量轮询 + `launch_status` 终态停轮询 + 「本次发起/世界全景」双模式徽标 + launch 切换器 + 桥接布局去 absolute hack）→ T4 统一发起历史（`/api/launches` 驱动 HistoryScreen/WorldOverview，多平台条目带 run_id 入口 + 每平台评论区/复盘直连；热榜同内容聚合）→ T5 回放/复盘减重（replay `tail=200`+「加载更早评论」；retro 去全量 snapshot）+ 语义清理（"实时互动"→"回放"、"步"→"拍"、平台标签单一真源）→ T6 launch 复盘页（抽 `RunAnalysisPanel` 复用 + 平台 tab + 桥接摘要 + 风味卡，单平台 Retro 渲染零回归）→ T7 骨架屏 + 发起页收紧。精确断言见计划。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`；`cd frontend && npx vitest run && npx tsc -b`。完成交回审核者核验（两条硬规则必查 + Playwright 截图落盘 manual assets）。卡点回计划，契约回 spec，不要靠猜。
