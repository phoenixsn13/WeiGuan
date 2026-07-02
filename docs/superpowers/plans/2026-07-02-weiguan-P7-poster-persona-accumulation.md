# P7 · 发帖人 persona 与累积 实现计划

> **For agentic workers / codex：** 按 TDD 逐 Task 实现。设计=审核者，实现=codex：照计划执行、不改设计、不改弱断言绕过。每 Task 一 commit，带 `Review-Anchor: P7-T<n>`；代码打 `# review:P7-T<n>` / `// review:P7-T<n>`，保留既有锚点。**依赖 P6 已落地**（消费 P6-T1 冻结的 `World/Person/Account/PersonView/PersonaKind/persona_starting_standing`、P6-T4 `WorldStore`、P6-T8 世界/人物 API）。

**Goal：** 让发帖人可选 persona（普通人/大V/KOL）发帖、同一身份多次发起累积粉丝/影响力/立场，并把历史页升级为按人聚合、新增身份/世界主页；发起页补 persona 选择 + 成本预估。

**Architecture：** 后端复用 P6 的持久世界与投影——"继续某身份"= 复用其 `persistent` 世界 + `poster_person_id`；"新身份"= 建持久世界 + Person（按 persona 起始盘）。前端在 `design/tokens.ts` 已有 `POV={POSTER,PLATFORM,KOL}` 与双寄存器基础上加"世界层"寄存器；所有身份/累积数据从 `PersonView` 派生，不造假数据。

**Tech Stack：** 后端 FastAPI/pydantic/pytest；前端 React/Vite/TS/Tailwind/vitest；原型图用 imagegen 技能。

**设计真源：** spec `2026-07-02-weiguan-world-identity-and-wishes-design.md` §5.1、§7.1/7.2/7.4/7.5、§8。

## Global Constraints

- 前台心智词表：禁 `agent/OASIS/仿真/工作台/trace/simulation/dashboard`；允许 `世界/人物/TA/身份/粉丝/影响力/立场/传播/发酵/平台`。
- 累积数据一律从 `PersonView`（P6 投影）派生，禁止前端假数据/本地伪造 mutation。
- BYOK 不落 key；不要求打印 key。本计划后端 Task 无需 LLM key；前端原型/实现无需 key。
- UI 三寄存器与配色遵循 spec §7.2；世界层禁用图表库默认配色。
- 验收：后端 `pytest -m "not llm and not llm_effect" -q`；前端 `npx vitest run && npx tsc -b`。

---

## 文件结构

后端：
- Modify `weiguan/world/store.py` — 增 `list_persons(world_id)`、`create_person(world_id, display_name, persona_kind, platform, handle)`（内部用 `persona_starting_standing` 播种起始 Account）。
- Modify `weiguan/api/routes.py` — `POST /api/persons`（建身份）、`GET /api/worlds/{id}/persons`（列身份）、`GET /api/runs/preview-cost`（成本预估，纯函数无 LLM）。
- （persona 透传 create_run 已在 P6-T8 完成，本计划不重复。）

前端：
- Modify `design/tokens.ts` — 增世界层寄存器 token（`world` 命名空间色 + 影响力/时间线语义色）。
- Create `frontend/prototypes/`（imagegen 产物落盘）。
- Modify `screens/ComposeScreen.tsx` — persona 三选一 + 身份选择（新身份/继续身份）+ 成本预估条。
- Modify `screens/HistoryScreen.tsx` — 按身份分组。
- Create `screens/IdentityScreen.tsx` + 路由 `/identity/:personId` — 身份卡 + 立场漂移时间线 + 影响力曲线 + 名下账户。
- Create `pov/identity.ts` — 从 `PersonView` 派生身份视图模型。
- Modify `shell/AppShell.tsx` + `shell/routes.tsx` — 导航 `发起/世界/历史`，"我"=当前身份。
- Modify `api/client.ts` — 新增 `createPerson/listPersons/previewCost` 调用。

测试：`tests/world/test_store_persons.py`、`tests/api/test_person_routes.py`；前端 `*.test.tsx`/`pov/identity.test.ts`。

---

## Task 1: WorldStore 身份创建与列举

**Files:** Modify `backend/weiguan/world/store.py`；Test `backend/tests/world/test_store_persons.py`

**Interfaces（Produces）:**
```python
def create_person(self, world_id: str, *, display_name: str, persona_kind: PersonaKind,
                  platform: Platform, handle: str) -> Person: ...
    # 用 persona_starting_standing(persona_kind) 播种首个 Account 的 num_followers/influence_score
def list_persons(self, world_id: str) -> list[PersonView]: ...
```

- [ ] **Step 1 — 失败测试**：`create_person(KOL)` 返回的 Person 首账户 `num_followers`==`persona_starting_standing(KOL)[0]`；`list_persons` 返回含该人的 PersonView；未知 world 返回空/None 而非抛。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**，`# review:P7-T1`。
- [ ] **Step 4 — 通过 + P6 store 测试防回归。**
- [ ] **Step 5 — commit** `feat(world): create/list persons with persona starting standing`（`Review-Anchor: P7-T1`）。

---

## Task 2: 身份与成本预估 API

**Files:** Modify `backend/weiguan/api/routes.py`；Test `backend/tests/api/test_person_routes.py`

**Interfaces（前端契约）:**
- `POST /api/persons` body `{world_id?, display_name, persona_kind, platform, handle}` → `Person`；`world_id` 缺省则先建 `persistent=True` 世界并返回其 person（响应含所属 world_id）。
- `GET /api/worlds/{world_id}/persons` → `{persons: PersonView[]}`。
- `GET /api/runs/preview-cost?steps=&llm_max_agents=&attention_comment_budget=&person_memory_budget=` → `{estimated_rmb: float, budgeted_agents: int, decision_steps: int}`，复用 `RunConfig.estimate_llm_cost_rmb`/`budgeted_llm_max_agents`（构造一个不含 key 的临时 config 或直接算，**不触 LLM**）。

- [ ] **Step 1 — 失败测试**（`TestClient`）：建身份 200 且首账户起始盘正确；列身份返回；`preview-cost` 对更大 steps 返回更大 `estimated_rmb`、`budgeted_agents<=llm_max_agents`；无效 persona→422。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**，`# review:P7-T2`。
- [ ] **Step 4 — 通过 + 全量后端回归绿。**
- [ ] **Step 5 — commit** `feat(api): person create/list and cost preview`（`Review-Anchor: P7-T2`）。

---

## Task 3: 前端原型图（发起页/历史按人/身份主页）—— 先出图自审再实现

**Files:** Create `frontend/prototypes/`（落盘 imagegen 图 + 一页自审 md）

依据 spec §7.5 逐屏 brief 与 §7.2 三寄存器，用 imagegen 产出 desktop+mobile 原型图：
- `compose-persona.png`：发起页（内容输入预览 + persona 三卡 + 身份选择 + 成本预估条）。
- `history-by-identity.png`：历史按身份分组（身份卡 + run 节点）。
- `identity-home.png`：身份/世界主页（身份卡 + 立场漂移时间线 + 影响力曲线 + 名下账户）。

- [ ] **Step 1 — 生成三屏 desktop+mobile 原型图**，落 `frontend/prototypes/`。
- [ ] **Step 2 — 自审**：写 `frontend/prototypes/P7-selfreview.md`，逐屏核对：无禁用心智词、三寄存器边界清晰、世界层未用默认图表配色、暖琥珀为身份主色、44px 触达。不合格重出。
- [ ] **Step 3 — commit** `docs(ui): P7 hi-fi prototypes and self-review`（`Review-Anchor: P7-T3`）。（本 Task 无自动化测试，交付=图+自审 md。）

---

## Task 4: 世界层设计 token

**Files:** Modify `frontend/src/design/tokens.ts`；Test `frontend/src/design/tokens.test.ts`

**Interfaces（Produces）:** 在既有 `colors` 上新增 world 层语义（不破坏既有 `ink/cream/brand/accent`）：
```ts
export const world = {
  surface: "#0F172A", line: "#2C4A7C", identity: "#E8A13A",
  influenceUp: "#3E9B6E", influenceDown: "#C4553B",
} as const;
```

- [ ] **Step 1 — 失败测试**：断言 `world.identity===brand` 值一致、`world` 各键存在且为合法 hex；既有 `sentimentColor` 不变。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**，`// review:P7-T4`。
- [ ] **Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(design): world-layer tokens`（`Review-Anchor: P7-T4`）。

---

## Task 5: 发起页 persona + 身份选择 + 成本预估

**Files:** Modify `frontend/src/screens/ComposeScreen.tsx`、`frontend/src/api/client.ts`、`frontend/src/api/useApiKey.ts`（如需存 world/person 选择）；Test `ComposeScreen.test.tsx`、`client.test.ts`

**Interfaces:** `client.ts` 增 `createPerson(body, creds)`、`listPersons(worldId)`、`previewCost(params)`；`createRun` body 增 `world_id/poster_persona/poster_person_id/person_memory_budget`（已由 P6-T8 后端接受）。

- [ ] **Step 1 — 失败测试**（vitest mock fetch）：选 KOL persona 后 `createRun` 请求 body 带 `poster_persona:"kol"`；选"继续身份"带 `poster_person_id`；成本预估条随 steps 变化调用 `previewCost` 并渲染 `¥`；未选 persona 默认 ordinary。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**：persona 三卡（显起始粉丝/影响力/定位）、身份选择（新身份 or 下拉已有身份）、成本预估条（自有算力 vs 付费 API 文案）。`// review:P7-T5`。
- [ ] **Step 4 — 通过 + `tsc -b`。**
- [ ] **Step 5 — commit** `feat(compose): persona picker, identity select, cost preview`（`Review-Anchor: P7-T5`）。

---

## Task 6: 历史页按身份聚合

**Files:** Modify `frontend/src/screens/HistoryScreen.tsx`；Create `frontend/src/pov/identity.ts`；Test `HistoryScreen.test.tsx`、`pov/identity.test.ts`

**Interfaces（Produces）:** `pov/identity.ts`：
```ts
export type IdentityGroup = { person: PersonView; runs: RunSummary[] };
export function groupRunsByIdentity(persons: PersonView[], runs: RunSummary[]): IdentityGroup[];
```

- [ ] **Step 1 — 失败测试**：`groupRunsByIdentity` 把同一 person 的多次 run 归到一组、组内按时间；无身份的 run 归入"匿名/临时"组；纯函数确定性。History 组件渲染身份卡 + 组内 run 节点。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**，`// review:P7-T6`。
- [ ] **Step 4 — 通过 + `tsc -b`。**
- [ ] **Step 5 — commit** `feat(history): group runs by identity`（`Review-Anchor: P7-T6`）。

---

## Task 7: 身份/世界主页

**Files:** Create `frontend/src/screens/IdentityScreen.tsx`；Modify `frontend/src/shell/routes.tsx`；Test `IdentityScreen.test.tsx`

**Interfaces:** 路由 `/identity/:personId`；数据来自 `GET /api/persons/{id}?world_id=`（P6-T8）→ `PersonView`。`pov/identity.ts` 增 `stanceDriftSeries(person: PersonView, runs: RunSummary[])`、`influenceSeries(...)`（从 run_ids 时间序列派生，确定性）。

- [ ] **Step 1 — 失败测试**：身份卡渲染 persona/总影响力/名下账户；立场漂移时间线按 run 顺序；影响力曲线单调段正确；无数据空态。派生函数纯函数测试。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**（世界层寄存器、暖琥珀主色、无默认图表配色）。`// review:P7-T7`。
- [ ] **Step 4 — 通过 + `tsc -b`。**
- [ ] **Step 5 — commit** `feat(identity): identity/world home screen`（`Review-Anchor: P7-T7`）。

---

## Task 8: AppShell 导航升级

**Files:** Modify `frontend/src/shell/AppShell.tsx`；Test `shell/shell.test.tsx`

**Interfaces:** 导航 `发起 / 世界 / 历史`；"我"头像点开当前身份（链到 `/identity/:id` 或身份切换）；保留"只在你发起时推演"徽标。

- [ ] **Step 1 — 失败测试**：导航含三项且文案正确、无禁用心智词；"我"可点、指向身份。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**，`// review:P7-T8`。
- [ ] **Step 4 — 通过 + `tsc -b` + 全量 `vitest run` 绿。**
- [ ] **Step 5 — commit** `feat(shell): world-mind navigation`（`Review-Anchor: P7-T8`）。

---

## Review Index

| 锚点 | 交付 | 关键验收 |
|------|------|---------|
| P7-T1 | 身份创建/列举 | persona 起始盘播种；list 返回 PersonView |
| P7-T2 | 身份/成本 API | 起始盘正确；成本随 steps 单调；422 |
| P7-T3 | 原型图 | 三屏 desktop+mobile + 自审合格 |
| P7-T4 | 世界层 token | world 键齐、identity==brand、既有不破 |
| P7-T5 | 发起页 | persona/身份/成本 body 正确 |
| P7-T6 | 历史按人 | 分组确定性、匿名组、渲染 |
| P7-T7 | 身份主页 | 卡/时间线/曲线/空态 |
| P7-T8 | 导航 | 三项文案、无禁用词、"我"可点 |

## 完成标准
- 后端 `pytest -m "not llm and not llm_effect"` 全绿；前端 `vitest run`+`tsc -b` 绿。
- 累积数据全部来自 PersonView，无前端假数据。
- 三屏原型图落盘 + 自审 + 高保真实现，调性与既有屏连贯。
- 无需 LLM key。
