# 给 codex 的工作提示词（P15：发起会话收束 / launch 归一）

> 整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不弱断言绕过。**前置：P11–P14 已落地（含 P14 世界一等化 + persist 归一、P14-T8 配色）。** 后端纯 `FakeEngine`/文件读，前端 msw/fixture mock，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-07-weiguan-P15-launch-convergence.md` 逐 Task 实现「发起会话收束（launch 归一）」（P15）。设计真源 spec `2026-07-07-weiguan-P15-launch-convergence-design.md`（契约见 §2）+ conventions §5（端到端接线验收，本片首个 dogfood）。照做、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P15-T{n}`，代码打锚点，保留既有锚点。

背景（修接线，不加能力）：P14 只做了**世界 persist 归一**，漏了**发起会话（launch）归一**。单平台 `POST /api/runs`（`routes.py:742-744`）只 `store.create` 不建 Launch；`/api/launches`（`routes.py:620`）读时用 `_single_launch_summary` 把 run 临时包成 `launch_id==run_id` 的假 launch；多平台（`routes.py:589`）才建真 Launch。下游全是补偿：`/api/worlds` 双 store 比对（`routes.py:348-353`）、`HistoryScreen.tsx:146` 双读拼装。**根只有一条**：单平台不落真 Launch。P15 把 run/launch 彻底二分，产品路径只认 launch。

铁律（逐字遵守，见计划 Global Constraints）：
1. **契约只追加**：`POST /api/runs` 返回体只**追加** `launch_id`（保留 `run_id`）；`/api/launches`、`/api/worlds` 响应形状不变。
2. **launch_id 铸新**：单平台 Launch 用 `f"launch_{uuid4().hex}"`，**不复用 run_id**（本项目无旧数据负担，取最净模型）。
3. **发起即 persist launch**：任一发起落真 Launch，无读时合成逃生口。
4. **可见文案禁裸 ID**：世界名/身份名/作者名可见区对 `/[0-9a-f]{12,}/`、`/w_[0-9a-f]{6,}/` 零命中，测试 pin。
5. **心智词表**：禁 `agent/OASIS/仿真/工作台/后端/模型/微博客`；"步"→"拍"。
6. **配色单一真源**：本片基本不动样式；若触及，语义色只来自 `design/tokens.ts`，中性排版灰（`text-slate-*`、`bg-white`、`border-line`）按 spec §7.2 豁免。

关键实现要点（计划已展开，勿走偏）：
- **T1 单平台补建 Launch**：`create_run` 内**提前** `ensure_world_for_run(world_store, cfg)` 解析 world/person，`cfg = cfg.model_copy(update={world_id, poster_person_id})`，再 `store.create(cfg)`，然后 `create_launch(Launch(...))`（`platforms=[cfg.platform]`、`run_ids=[run_id]`），返回 `{run_id, launch_id}`。runner 内部第二次 `ensure_world_for_run` 因 config.world_id 已置而幂等复用——**不会双建世界**。`routes.py` 相关 import（`uuid4/datetime,timezone/Launch/ensure_world_for_run`）已齐。
- **T2 读侧单源**：`list_launches` 删 `store.list()` 合成半，删 `_single_launch_summary` 整函数；`_world_summary` 的 latest 简化为仅 `_latest_launch_item(latest_launch)`；`_latest_run_item` 仅此处引用则删（先 `rg` 确认）。
- **T3 迁移**：新建 `weiguan/world/backfill.py` `backfill_single_launches(run_store, world_store) -> int`，幂等（以 launch.run_ids 覆盖判重）、无 world_id 的 run 跳过；`weiguan/api/app.py` 装配处调一次。
- **T4/T5 前端全收敛**：`HistoryScreen` 删 `Promise.all([fetchRuns, fetchLaunches])` 双读→只 `fetchLaunches`；`client.ts` 删 `launchFromRun` 与 `fetchLaunches` 数组兼容分支，`createRun` 返回加 `launch_id`；发起跳转统一——单 `/run/{run_id}/live?launch={launch_id}`，多 `/world/{world_id}/live?launch={launch_id}&run_id=...`。
- **T6**：端到端接线验收表落 manual（四路径 + 三硬校验），附三绿 + `rg` 零命中证据 + Playwright 截图。

顺序严格 T1→T2→T3→T4→T5→T6（后端写侧→读侧→迁移→前端 History→前端跳转→验收）。精确签名/测试/断言见计划各 Task。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`；`cd frontend && npx vitest run && npx tsc -b`；`rg _single_launch_summary weiguan/` 与 `rg fetchRuns src/screens/HistoryScreen.tsx` 均零命中。完成交回审核者按 Review Index 核验（契约只追加 + launch_id 铸新 + 读侧单源 + 迁移幂等 + 前端零双读 + 接线验收表）。e2e 真发起由用户代跑（你不要求任何人提供/打印 key）。卡点回计划，契约回 spec，不要靠猜。
