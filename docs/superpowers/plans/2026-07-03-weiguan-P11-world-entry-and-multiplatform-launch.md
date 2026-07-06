# P11 · 世界入口与多平台发起接线 实现计划

> **For agentic workers / codex：** 按 TDD 逐 Task 实现。设计=审核者，实现=codex：照计划执行、不改设计、不改弱断言绕过。每 Task 一 commit，带 `Review-Anchor: P11-T<n>`；代码打 `# review:P11-T<n>` / `// review:P11-T<n>`。**前置：P6–P10 已落地。** 多平台联跑测试用 `FakeEngine`，无需 LLM key。

**Goal（修真实欠账）：** 多平台世界（愿望3）做完却**未接入导航、无数据、无发起路径**——`/world/:id/live` 渲染空态、无 `GET /worlds/{id}/events`、导航"世界"指向上一个 batch 的 gallery。本计划把多平台世界补成**完整可达用户路径**：能发起多平台并发、能从导航进入世界总览、能查看某世界的多平台现场（真实数据）。

**Architecture：** 复用既有 `WorldOrchestrator`（P9）、`multiPlatformView`（P9）、`list_identities`（P7，持久世界含 `world_id`）、`read_world_events`（P6 store）。新增：①世界事件读取 GET 端点；②**UI 友好的多平台发起端点**（后端内部 `ensure_world` + 逐平台建发帖账户 + 组 `PlatformRunSpec[]` + 跑 orchestrator，前端**不手拼账户 ID/specs**）；③前端世界总览屏 + Live 路由数据接线 + 发起页多平台模式 + 导航/入口。

**Tech Stack：** 后端 Python/pytest（FakeEngine 多实例，无 LLM）；前端 React/TS/vitest；新 UI 先 imagegen 原型自审再实现。

**设计真源：** 主 spec §5.3（多平台）、§7.2（世界层配色硬规则）、§7.3（皮肤）、§7.5（世界 Live/总览 brief）；手册 `docs/manual/2026-07-03-weiguan-latest-acceptance-manual.md` §9（世界入口欠账）。

## Global Constraints

- **退化不回归**：单平台发起走原 `POST /api/runs` 路径逐字不变；多平台仅在选≥2 平台时启用。
- 前端**不构造 `poster_account_id`/`PlatformRunSpec` 字符串**——账户与 specs 一律后端解析（对齐 `create_run`/`ensure_world_for_run` 的封装习惯）。
- **配色单一真源（spec §7.2 硬规则）**：世界总览/Live/发起多平台 UI 的语义色（连接/桥接/情绪/影响力）**只来自 `frontend/src/design/tokens.ts`**，禁硬编 Tailwind 默认色阶。见 [[weiguan-color-token-rule]] 同款欠账，务必先自查。
- 心智词表约束：世界层 UI 禁 `agent/OASIS/仿真/工作台/后端/模型/配置中心/世界地图` 等；用 世界/身份/平台/现场/发酵/传播/桥接。
- 多平台并发编排 v1 **同步**（沿用现有 orchestrate 语义：跑完落事件→前端看现场）；真 LLM 联跑由用户代跑，测试用 FakeEngine。SSE 实时流式为**非目标**（见末尾）。
- 验收：后端 `pytest -m "not llm and not llm_effect" -q`；前端 `npx vitest run && npx tsc -b`。

---

## 文件结构

后端：
- Modify `weiguan/api/routes.py` — `GET /api/worlds/{world_id}/events`；`POST /api/multi-runs`。
- （如需）Modify `weiguan/world/run_bridge.py` / 新 helper — 从"内容+persona+平台集"组 `PlatformRunSpec[]`、逐平台建发帖账户（复用 `ensure_world_for_run`/`poster_account_id`）。

前端：
- Modify `screens/MultiPlatformLiveScreen.tsx` — 由 `:id` 拉 `GET /worlds/{id}/events`，loading/empty/error，喂 `events`（组件保持纯展示）。
- Create `screens/WorldOverviewScreen.tsx` + `pov/worlds.ts` — 列持久世界（复用 `GET /identities`），每项含平台数/身份/影响力，链到 `/world/{id}/live`。
- Modify `screens/ComposeScreen.tsx` — 平台多选（微博/X/Reddit）；≥2 → `POST /api/multi-runs` → 跳 `/world/{id}/live`；1 → 原单发起不变。
- Modify `shell/AppShell.tsx`、`shell/routes.tsx` — "世界"导航指向 `/worlds` 总览；`/worlds` 路由；身份页/历史/复盘加"看多平台现场"入口。
- Modify `api/client.ts` — `getWorldEvents(worldId)`、`createMultiRun(...)`、`getWorlds()`（或复用 `getIdentities`）。
- Create `frontend/prototypes/world-entry.png` + `P11-selfreview.md`。

测试：`tests/api/test_world_events_route.py`、`test_multi_run_route.py`（FakeEngine）；前端 `MultiPlatformLiveScreen.test.tsx`（含拉数据态）、`WorldOverviewScreen.test.tsx`、`ComposeScreen.test.tsx`（多平台分支）、`pov/worlds.test.ts`、`shell.test.tsx`（导航）。

---

## Task 1: 世界事件读取端点

**Files:** Modify `backend/weiguan/api/routes.py`；Test `backend/tests/api/test_world_events_route.py`

- `GET /api/worlds/{world_id}/events` → `{frames: [WorldEvent...]}`（复用 `read_world_events`；未知 world 404；空世界返回 `{"frames": []}` 不 500）。形状对齐 `GET /runs/{id}/frames`。

- [ ] **Step 1 — 失败测试**：已存世界（含若干 append 事件）→200 且 frames 按时间线序；未知 world→404；空世界→200 空数组。
- [ ] **Step 2 — 确认失败。Step 3 — 实现** `# review:P11-T1`。**Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(api): world events read route`（`Review-Anchor: P11-T1`）。

---

## Task 2: UI 友好的多平台发起端点

**Files:** Modify `backend/weiguan/api/routes.py`（+ 必要 helper）；Test `backend/tests/api/test_multi_run_route.py`

**Interface:** `POST /api/multi-runs` body：
```python
class _MultiRunBody(BaseModel):
    content: str
    audience: Audience
    persona: PersonaKind = PersonaKind.ORDINARY
    platforms: list[Platform]            # 去重、非空；单元素等价单发起
    steps: int = ...
    world_id: str | None = None
    poster_person_id: str | None = None
    person_memory_budget: int = 4
# → 内部：ensure_world(persistent) → 逐 platform 建发帖 Account（poster_account_id 后端解析）
#   → 组 PlatformRunSpec[]（各自 RunConfig，platform/world_id/poster_person_id 对齐）
#   → WorldOrchestrator.orchestrate → 落事件
# → return {"world_id": ...}
```
- BYOK 头（`X-LLM-*`）与 `create_run` 一致透传；成本安全参数复用 RunConfig 校验。
- **前端只传内容/persona/平台集**，不接触 specs/account_id。

- [ ] **Step 1 — 失败测试**（FakeEngine 多实例，无 LLM）：两平台 body→返回 `world_id`，该世界 `read_world_events` 含两平台事件 + 至少一条 `BRIDGE_INJECT`（若触发）；单平台 body→退化成功、事件仅该平台；`platforms` 空→422/400；发帖人在每个平台各一 Account（`poster_account_id` 后端建）。
- [ ] **Step 2 — 确认失败。Step 3 — 实现** `# review:P11-T2`。**Step 4 — 通过 + 全量后端回归绿。**
- [ ] **Step 5 — commit** `feat(api): ui-friendly multi-platform launch route`（`Review-Anchor: P11-T2`）。

---

## Task 3: 世界入口原型图 —— 先出图自审再实现

**Files:** Create `frontend/prototypes/world-entry.png`（desktop+mobile）+ `frontend/prototypes/P11-selfreview.md`

覆盖三处新 UI：①发起页平台多选（选≥2 出现"多平台并发"提示）；②世界总览（持久世界卡片：身份/平台数/影响力，入口"看现场"）；③既有多平台 Live 接真实数据后的样子。依据 spec §7.2（世界层配色，连接线冷靛蓝、语义色走 token）、§7.5。

- [ ] **Step 1 — 生成 desktop+mobile 原型图。**
- [ ] **Step 2 — 自审** `P11-selfreview.md`：无禁用词、世界层配色（token）、发起多平台清晰、总览可辨、Live 有数据态。不合格重出。
- [ ] **Step 3 — commit** `docs(ui): P11 world entry prototypes and self-review`（`Review-Anchor: P11-T3`）。

---

## Task 4: 多平台 Live 路由数据接线

**Files:** Modify `frontend/src/screens/MultiPlatformLiveScreen.tsx`、`api/client.ts`；Test `MultiPlatformLiveScreen.test.tsx`

- 路由 `/world/:id/live` 组件从 `useParams` 取 `id`，挂载时 `getWorldEvents(id)` 拉事件（loading/empty/error 三态诚实），成功后经 `multiPlatformView(events)` 渲染。**组件保持纯展示**：抽数据获取为容器/hook，或组件内 `useEffect` 拉取但仍可接受 `events` prop（测试注入）以防回归。
- 空世界→"该世界还没有多平台内容"诚实空态（非"等待…"永久转圈）；错误→可重试。

- [ ] **Step 1 — 失败测试**：mock `getWorldEvents` 返回两平台事件→渲染两列+桥接；返回空→空态；请求失败→错误态可重试；仍支持直接注入 `events`（回归）。
- [ ] **Step 2 — 确认失败。Step 3 — 实现** `// review:P11-T4`。**Step 4 — 通过 + `tsc -b`。**
- [ ] **Step 5 — commit** `feat(live): wire multiplatform live to world events`（`Review-Anchor: P11-T4`）。

---

## Task 5: 发起页多平台模式

**Files:** Modify `frontend/src/screens/ComposeScreen.tsx`、`api/client.ts`；Test `ComposeScreen.test.tsx`

- 平台多选控件（微博/X/Reddit），默认单选微博（退化=今天）。
- `startRun` 分支：选 1 平台→原 `createRun` 单发起路径**逐字不变**（防回归）；选 ≥2→`createMultiRun({content,audience,persona,platforms,steps,world_id?,poster_person_id?})`→成功跳 `/world/{world_id}/live`。
- 身份模式（新建/继续）与多平台正交：继续身份时带 `world_id+poster_person_id`。
- 配色/文案走 token 与心智词表；"多平台并发"提示为人话（"这条会同时在微博和 Reddit 发酵，热点会互相外溢"）。

- [ ] **Step 1 — 失败测试**：单平台→调 `createRun` 跳 `/run/:id/live`（回归）；双平台→调 `createMultiRun` 跳 `/world/:id/live`；继续身份带 world_id/person_id；平台空选被拦。
- [ ] **Step 2 — 确认失败。Step 3 — 实现** `// review:P11-T5`。**Step 4 — 通过 + `tsc -b`。**
- [ ] **Step 5 — commit** `feat(compose): multi-platform launch mode`（`Review-Anchor: P11-T5`）。

---

## Task 6: 世界总览 + 导航入口接线

**Files:** Create `frontend/src/screens/WorldOverviewScreen.tsx`、`pov/worlds.ts`；Modify `shell/AppShell.tsx`、`shell/routes.tsx`、`screens/IdentityScreen.tsx`、`screens/HistoryScreen.tsx`、`screens/RetroScreen.tsx`、`api/client.ts`；Test `WorldOverviewScreen.test.tsx`、`pov/worlds.test.ts`、`shell.test.tsx`

- `pov/worlds.ts`：从 `GET /identities`（持久世界身份，含 `world_id`）派生世界总览模型（每世界：身份名/persona/平台数/影响力/run 数），确定性、空态。
- `WorldOverviewScreen`：世界层容器（深色 `world.surface`），列世界卡，"看现场"→`/world/{world_id}/live`；空态诚实（"还没有持久世界，去发起一条多平台内容"）。
- 导航：`AppShell` **"世界"指向 `/worlds`**（不再指 `/` gallery）；`routes.tsx` 加 `/worlds`。gallery `/` 仍作发起入口（"发起"/品牌位可达）。
- 入口链接：身份页 / 历史 run 卡 / 复盘页加"看多平台现场"→`/world/{world_id}/live`（这些页面已持有 `world_id`）。

- [ ] **Step 1 — 失败测试**：`worlds.ts` 从 identities 派生卡片（确定性、空态）；`WorldOverviewScreen` 渲染卡+"看现场"链接；`shell.test` 断言"世界"link href=`/worlds`；身份/历史/复盘出现"看多平台现场"链接带正确 world_id。
- [ ] **Step 2 — 确认失败。Step 3 — 实现**（世界层配色 token、禁用词零）`// review:P11-T6`。**Step 4 — 通过 + `tsc -b` + 全量 `vitest run` 绿。**
- [ ] **Step 5 — commit** `feat(world): world overview screen and navigation wiring`（`Review-Anchor: P11-T6`）。

---

## Review Index

| 锚点 | 交付 | 关键验收 |
|------|------|---------|
| P11-T1 | 世界事件端点 | 200 时间线序 / 404 / 空数组不 500 |
| P11-T2 | 多平台发起端点 | 前端只传内容+平台集；后端组 specs/建账户；两平台落事件+桥接；单平台退化 |
| P11-T3 | 世界入口原型 | 图+自审合格；token 配色；无禁用词 |
| P11-T4 | Live 数据接线 | 拉真实事件渲染多列+桥；空/错态诚实；注入 events 回归 |
| P11-T5 | 发起多平台 | 单平台走原路径不变；≥2 跳世界 live；空选拦截 |
| P11-T6 | 总览+导航 | "世界"→/worlds；世界卡+看现场入口；身份/历史/复盘入口链 |

## 完成标准
- 后端 `pytest -m "not llm and not llm_effect"` 全绿；前端 `vitest run`+`tsc -b` 绿。
- **多平台世界成为完整可达用户路径**：发起多平台→世界 Live 看真实并列+桥接；导航"世界"→总览→某世界现场；单平台发起零回归。
- 世界层配色一律 token、无默认图表色；无禁用心智词；原型先行自审。

## 非目标（明确不做）
- **不**做 orchestrate 的 SSE 实时流式（v1 同步跑完再看现场）；将来若要"多平台边跑边看"，另开片改后台任务+SSE。
- **不**改单平台发起/Live/复盘既有逻辑（仅加多平台旁路与入口）。
- **不**预优化大规模性能（P10 非目标延续，待 PerfDigest 实证）。
