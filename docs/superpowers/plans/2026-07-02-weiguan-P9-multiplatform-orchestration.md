# P9 · 多平台编排与皮肤 实现计划

> **For agentic workers / codex：** 按 TDD 逐 Task 实现。设计=审核者，实现=codex：照计划执行、不改设计、不改弱断言绕过。每 Task 一 commit，带 `Review-Anchor: P9-T<n>`；代码打 `# review:P9-T<n>` / `// review:P9-T<n>`。**依赖 P6、P7 已落地**（消费 `WorldStore/WorldEvent/EventLog`、世界时钟、身份模型）。

**Goal：** 一个世界拉起多个平台 run（各自 OASIS 建模），同一逻辑时钟并行推进，跨平台桥每拍把可外溢事件注入他平台下一拍（消息互窜）；前端出多平台并列 Live 与平台皮肤差异化。

**Architecture：** `WorldOrchestrator` 持世界时钟、按拍推进注册的多个 Platform Sim（每个是一次有界 OASIS run，各自 `Platform` 模型：TWITTER-型 与 REDDIT-型）；每拍后 `CrossPlatformBridge`（纯函数）从各平台产出里挑"可外溢事件"生成他平台 `bridge_inject` 事件，注入下一拍种子。并发安全由 P6 的"追加事件 + 时间线折叠"保证。前端平台皮肤共享同一 `posterView`/Feed 数据契约，只换表现。

**Tech Stack：** 后端 Python/asyncio/pytest（用 `FakeEngine` 多实例测编排，无 LLM）；前端 React/TS/vitest；原型图 imagegen。

**设计真源：** spec §5.3、§4.4（编排/并发）、§7.3（平台皮肤规范）、§7.5（多平台 Live 原型 brief）、§8。

## Global Constraints

- 每平台仍是各自独立 OASIS 仿真（各自 recsys/模型）——**不得把多平台塞进单一模型**（否则丢失"不同平台不同发酵"）。
- 跨平台流转 = 主通道(共享 Person 一人多号) + 辅通道(内容外溢=`bridge_inject`)；本计划实现桥的事件注入机制，内容外溢的完整语义按 brief 表达为"某 Person 用另一平台账户转述"。
- 并发写只走 `EventLog.append`，不改可变账本（复用 P6-T2 保证）。
- 前台心智词表约束；皮肤切换不改变该约束。世界层连接线用 spec §7.2 冷靛蓝，杜绝默认图表配色。
- 编排测试全部用 `FakeEngine` 多实例，无需 LLM key。
- 验收：后端 `pytest -m "not llm and not llm_effect" -q`；前端 `npx vitest run && npx tsc -b`。

---

## 文件结构

后端 `weiguan/world/`：
- Create `bridge.py` — `select_bridgeable(events)` + `to_bridge_events(...)`（纯函数）。
- Create `orchestrator.py` — `WorldOrchestrator`：注册多平台 run、共享时钟按拍推进、每拍调桥、append 事件。
- Modify `api/routes.py` — `POST /api/worlds/{id}/orchestrate`。

前端：
- Create `skins/skin.ts` — 平台皮肤抽象（`PlatformSkin` 接口 + 注册）。
- Create `skins/reddit/`（RedditPost/RedditReply/RedditActionBar…，论坛楼层/投票风）。
- Create `skins/weibo/`（微博变体，over TWITTER-型，话题 `#…#`/转发链）。
- Modify `skins/x/` — 纳入 `skin.ts` 抽象，不破坏既有。
- Create `screens/MultiPlatformLiveScreen.tsx` + 路由 `/world/:worldId/live` — 多列并列 + 桥接连接线。
- Create `pov/multiplatform.ts` — 从世界事件派生各平台列 + 桥接边。
- Create `frontend/prototypes/multiplatform-live.png`、`skins-compare.png` + 自审。

测试：`tests/world/test_bridge.py`、`test_orchestrator.py`、`tests/api/test_orchestrate_route.py`；前端 `skins/*.test.tsx`、`pov/multiplatform.test.ts`、`MultiPlatformLiveScreen.test.tsx`。

---

## Task 1: 跨平台桥（纯函数）

**Files:** Create `backend/weiguan/world/bridge.py`；Test `backend/tests/world/test_bridge.py`

**Interfaces（Produces）:**
```python
def select_bridgeable(events: list[WorldEvent], *, min_engagement: int) -> list[WorldEvent]: ...
    # 挑高互动的 post/repost 事件作为可外溢候选
def to_bridge_events(candidates: list[WorldEvent], *, target_platform: Platform,
                     target_account_id: str, tick: int, world_id: str, run_id: str) -> list[WorldEvent]: ...
    # 生成 kind=BRIDGE_INJECT、platform=target_platform 的注入事件；payload 保留源平台与源内容引用
```

- [ ] **Step 1 — 失败测试**：高互动 post 被选、低互动被过滤；`to_bridge_events` 产出 `WorldEventKind.BRIDGE_INJECT`、`platform==target`、payload 含源平台/源 post_id；空候选→空。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P9-T1`。**Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(world): cross-platform bridge event selection`（`Review-Anchor: P9-T1`）。

---

## Task 2: WorldOrchestrator（共享时钟并行推进 + 每拍调桥）

**Files:** Create `backend/weiguan/world/orchestrator.py`；Test `backend/tests/world/test_orchestrator.py`

**Interfaces（Produces）:**
```python
class PlatformRunSpec(BaseModel):
    platform: Platform; config: RunConfig; poster_account_id: str
class WorldOrchestrator:
    def __init__(self, store: WorldStore, engine_builder, *, bridge_min_engagement: int = 3): ...
    async def orchestrate(self, world_id: str, specs: list[PlatformRunSpec]) -> AsyncIterator[dict]:
        # 按拍推进所有平台；每拍：各平台产出→append；调 bridge 生成下一拍注入事件；
        # yield {tick, platform, delta} 供 SSE；世界 clock_tick 单调推进
```

- [ ] **Step 1 — 失败测试**（`FakeEngine` 双实例，无 LLM）：
  - `test_two_platforms_share_clock`：两平台 spec 编排后 `world.clock_tick` 单调推进，两平台事件都落 EventLog。
  - `test_bridge_injects_next_tick`：平台 A 高互动事件产生 → 平台 B 下一拍出现 `BRIDGE_INJECT` 事件（**消息互窜核心断言**）。
  - `test_concurrent_events_not_clobbered`：两平台同拍 append 后 `read()` 事件总数==两平台之和（复用 P6-T2 保证）。
  - `test_single_platform_orchestrate_equiv`：单 spec 编排 ≈ 今天单 run（退化）。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现**（asyncio 协调，桥用 T1 纯函数）`# review:P9-T2`。**Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(world): world orchestrator with shared clock and bridge`（`Review-Anchor: P9-T2`）。

---

## Task 3: 编排 API

**Files:** Modify `backend/weiguan/api/routes.py`；Test `backend/tests/api/test_orchestrate_route.py`

**Interfaces:** `POST /api/worlds/{world_id}/orchestrate` body `{specs: PlatformRunSpec[]}` → SSE 或 run 记录（对齐现有 SSE 风格 `GET /api/runs/{id}/events`）。产出事件带 `platform` 区分。

- [ ] **Step 1 — 失败测试**（`TestClient`，FakeEngine）：双平台编排返回可消费流/记录；事件带正确 `platform`；未知 world→404；单平台退化成功。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P9-T3`。**Step 4 — 通过 + 全量后端回归绿。**
- [ ] **Step 5 — commit** `feat(api): multi-platform orchestrate route`（`Review-Anchor: P9-T3`）。

---

## Task 4: 多平台 Live + 皮肤原型图 —— 先出图自审再实现

**Files:** Create `frontend/prototypes/multiplatform-live.png`、`skins-compare.png`（desktop+mobile）+ `P9-selfreview.md`

依据 spec §7.3（微博/X/Reddit 皮肤差异表）、§7.5（多平台并列 Live brief：多列各平台皮肤、列头显平台、列间冷靛蓝连接线标注桥接、顶部世界时钟）。

- [ ] **Step 1 — 生成原型图**（多平台并列 Live + 三皮肤对比）。
- [ ] **Step 2 — 自审**写 `P9-selfreview.md`：皮肤可辨且共享数据契约、连接线走冷靛蓝、无禁用词、无默认图表色。不合格重出。
- [ ] **Step 3 — commit** `docs(ui): P9 multiplatform prototypes and self-review`（`Review-Anchor: P9-T4`）。

---

## Task 5: 平台皮肤抽象 + Reddit/微博皮肤

**Files:** Create `frontend/src/skins/skin.ts`、`skins/reddit/*`、`skins/weibo/*`；Modify `skins/x/*`（纳入抽象）；Test `skins/skin.test.tsx`、各皮肤 test

**Interfaces（Produces）:**
```ts
export interface PlatformSkin {
  key: "weibo" | "x" | "reddit";
  Feed: React.FC<{ view: PosterView }>;   // 共享同一数据契约，只换表现
  label: string;
}
export function skinFor(platform: Platform): PlatformSkin;
```

- [ ] **Step 1 — 失败测试**：`skinFor` 对 twitter 返回 weibo/x（默认微博）、reddit 返回 reddit 皮肤；三皮肤用**同一** `PosterView` 渲染出各自记号（微博 `#话题#`/X `@handle`/Reddit 楼层·投票）；切皮肤不改数据；无禁用心智词。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现**（Reddit：中性灰/楼层/投票排序；微博：暖点缀/话题/转发链；X 既有冷蓝）`// review:P9-T5`。**Step 4 — 通过 + `tsc -b`。**
- [ ] **Step 5 — commit** `feat(skins): platform skin abstraction with reddit and weibo`（`Review-Anchor: P9-T5`）。

---

## Task 6: 多平台并列 Live

**Files:** Create `frontend/src/screens/MultiPlatformLiveScreen.tsx`、`pov/multiplatform.ts`；Modify `shell/routes.tsx`、`api/client.ts`；Test `pov/multiplatform.test.ts`、`MultiPlatformLiveScreen.test.tsx`

**Interfaces（Produces）:** `pov/multiplatform.ts`：
```ts
export type PlatformColumn = { platform: Platform; view: PosterView };
export type BridgeEdge = { fromPlatform: Platform; toPlatform: Platform; postRef: number; tick: number };
export function multiPlatformView(events: WorldEvent[]): { columns: PlatformColumn[]; bridges: BridgeEdge[] };
```

- [ ] **Step 1 — 失败测试**：`multiPlatformView` 把事件分到各平台列、从 `BRIDGE_INJECT` 事件派生 `bridges` 边（确定性）；组件渲染多列（各用其皮肤）+ 桥接连接线 + 顶部世界时钟；单平台时降级单列不画桥。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现**（列用 T5 皮肤、连接线冷靛蓝）`// review:P9-T6`。**Step 4 — 通过 + `tsc -b` + 全量 `vitest run` 绿。**
- [ ] **Step 5 — commit** `feat(live): multi-platform parallel view with bridges`（`Review-Anchor: P9-T6`）。

---

## Review Index

| 锚点 | 交付 | 关键验收 |
|------|------|---------|
| P9-T1 | 跨平台桥 | 高互动入选；BRIDGE_INJECT 生成；payload 源引用 |
| P9-T2 | 编排器 | 共享时钟；**桥注入下一拍**；并发不覆盖；单平台退化 |
| P9-T3 | 编排 API | 双平台流带 platform；404；退化 |
| P9-T4 | 原型图 | 并列 Live+皮肤对比+自审 |
| P9-T5 | 皮肤抽象 | 三皮肤同数据契约、各记号；无禁用词 |
| P9-T6 | 并列 Live | 列/桥/时钟；单平台降级 |

## 完成标准
- 后端 `pytest -m "not llm and not llm_effect"` 全绿；前端 `vitest run`+`tsc -b` 绿。
- 多平台各自 OASIS 模型独立、桥能让消息互窜、并发写不覆盖。
- 皮肤共享数据契约、并列视图可辨；原型图落盘+自审+高保真实现。
- 编排测试用 FakeEngine，无需 LLM key；真多平台 LLM 联跑由用户代跑、采信回传。
