# 给 codex 的工作提示词（P14：信息架构与产品接线贯通）

> 整段发给 codex。角色不变：实现者，照计划 TDD 执行、不改设计、不弱断言绕过。**前置：P11–P13 已落地（含 P13-T8 配色收敛与 line 分离）。** 后端纯 `FakeEngine`/文件读，前端 msw/fixture mock，无需 LLM key。

---

## 提示词（复制这段给 codex）

你是实现者。按 `docs/superpowers/plans/2026-07-06-weiguan-P14-information-architecture-and-wiring.md` 逐 Task 实现「信息架构与产品接线贯通」（P14）。设计真源 spec `2026-07-06-weiguan-P14-information-architecture-and-wiring-design.md`（契约见 §2）+ `2026-07-02-weiguan-world-identity-and-wishes-design.md` §7 视觉硬规则。照做、不改设计、不改断言绕过。TDD：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P14-T<n>`，代码打锚点，保留既有锚点。

背景（修产品接线，不加仿真能力）：世界此前是三条发起路径的副产物、persist 语义分散（`run_bridge.py:81` `bool(...)` 推断导致某些路径不留痕）、身份页几乎无入口（全站 `/identity/` 仅顶部"我"）、`run_bridge.py:105` 匿名身份把裸 person_id 当显示名。P14 把世界升为一等对象（可创建、可命名）、发起即留痕、补全身份页入口。

铁律（逐字遵守，见计划 Global Constraints）：
1. **配色单一真源**：语义色只来自 `design/tokens.ts`；中性排版灰（`text-slate-*`、`bg-white`、`border-line`）按 spec §7.2 明文豁免，不受限、不要瞎替换。
2. **可见文案禁裸 ID**：世界名/身份名/作者名可见区对 `/[0-9a-f]{12,}/`、`/w_[0-9a-f]{6,}/` 零命中，测试 pin。
3. **心智词表**：禁 `agent/OASIS/仿真/工作台/后端/模型/微博客`；"步"→"拍"。
4. **发起即留痕**：任何发起一律 `persistent=True`，无逃生口。
5. **name 单一真源**：世界名一律经后端 `resolve_world_name` 兜底，永不空、永不裸 hex。
6. **P12 契约只追加**：不改既有响应形状，只加 `World.name` + 新增 `GET /api/worlds`；`fold_world`、事件行格式、单平台语义不变。

**UI 工作流强制（你上片 P13 已按此做，继续）：**
- **先原型后高保真**：T4 必须先用 imagegen 出 4 个视图（发起页世界选区 / 世界总览带创建入口+可点身份 / 身份页入口到达态 / 世界详情双语义入口，**每个 desktop+mobile**）+ 对照 spec §7.1–§7.3 自审落盘（`self-review.md`），**合格后才做 T5–T7**。完备原型提示词与逐条约束见计划 Task 4，照单满足。
- **调性必须一致，不要拼不起来**：严格对齐 P13 原型 `docs/manual/assets/2026-07-06-P13-prototypes/` 与现有组件语言（`Button` primary/ghost、`Card`、`rounded-card`、cream 底/brand 强调/ink 文字/hairline 边、字重层级）。不得另起视觉风格。

顺序 T1 `World.name`+`resolve_world_name`（裸 hex 逐级校验）→ T2 `GET /api/worlds`（只读 `def`，resolved name + 统计，只 persistent，降序）→ T3 发起 persist 归一（`ensure_world_for_run` persistent 恒 True、删 `bool` 推断、匿名化名修裸 person_id、`world_name` 透传）→ **T4 原型图+自审（硬门）** → T5 世界一等化前端（`WorldOverview` 换 `GET /api/worlds`、卡用 name、可见区零裸 world_id）→ T6 发起页世界选区（`ComposeScreen` 新建/继续世界，搜索窗口化）→ T7 入口贯通（身份页多入口 + 端到端入口审计清单落 manual）。精确签名/断言见计划。

验收：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`；`cd frontend && npx vitest run && npx tsc -b`。完成交回审核者按 Review Index 核验（两条硬规则必查 + 原型调性对照 P13 + Playwright 截图落 manual assets）。e2e 性能/真发起由用户代跑（你不要求任何人提供/打印 key）。卡点回计划，契约回 spec，不要靠猜。
