# P7-T11/T12 · 持久身份接线补齐

日期：2026-07-02

审核者复核 P7-T9/T10（commit `9a661ed`/`eda5915`）：两锚点本身闭合（真前缀折叠、series 只吃后端、绑定机制 + 回退、成本文案）。但发现 **F4 阻断缺口**——主发起流程不产生可复用的持久身份，导致上述能力在真实使用中是空数据。本文件给补齐规格。

## F4 证据
- `ComposeScreen.startRun` 只调 `createRun`、**从不传 `world_id`**；"新身份"连 `poster_person_id` 也不传。
- 后端 `run_bridge.py:43` `create_world(persistent=bool(config.world_id))` → 无 `world_id` → **每次 run 建 ephemeral 世界**。
- `create_run` 只回 `{"run_id"}` → 新身份 id 前端拿不到，绑不上"我"。
- "继续身份"也断：不传 `world_id` → 又建新 ephemeral 世界，事件落新世界 → 跨 run 不累积；且 UI 让用户**手输 person_id**，无选择器。

**结论**：能力都在（`createPerson(persistent=True)`、`ensure_world_for_run` 支持传 world_id），是**主流程没接上**。补齐=接线，非降级。

## 设计目标
主发起流程必须产生/复用一个**持久身份世界**，使 `standing_timeline`/累积/"我"绑定在真实使用中有数据：
- 新身份：先建持久身份（拿 `world_id+person_id`）→ 绑定 → run 带上二者。
- 继续身份：从"我的身份"列表选（非手输）→ run 带上 `world_id+person_id`。

---

## Task 11（后端）：全局身份列表 + 持久化健壮性

**Files:** Modify `backend/weiguan/world/models.py`（加 `IdentitySummary`）、`backend/weiguan/world/store.py`（加 `list_identities`）、`backend/weiguan/world/run_bridge.py`（持久化触发）、`backend/weiguan/api/routes.py`（`GET /api/identities`）；Test `backend/tests/world/test_store_identities.py`、`backend/tests/api/test_identities_route.py`

**Interfaces（Produces）:**
```python
class IdentitySummary(BaseModel):
    world_id: str
    person_id: str
    display_name: str
    persona_kind: PersonaKind
    total_influence: float = 0.0
    run_count: int = 0

# WorldStore
def list_identities(self) -> list[IdentitySummary]: ...
    # 遍历 root 下所有世界，仅取 persistent=True 世界，fold 出每个 person 的 summary；
    # 按 (total_influence desc, person_id) 排序，确定性
```
- `GET /api/identities` → `{identities: IdentitySummary[]}`。
- `ensure_world_for_run` 持久化健壮性：当 `config.poster_person_id` 或 `config.world_id` 任一给定时，世界须为 `persistent=True`（复用或新建持久世界）；仅在两者皆空（真匿名一次性）时才 ephemeral。

- [ ] **Step 1 — 失败测试**（无 LLM）：
  - `test_list_identities_only_persistent`：建 2 个持久身份 + 1 个 ephemeral run 世界 → `list_identities` 只返回 2 个持久身份，各带正确 `world_id`。
  - `test_list_identities_deterministic_order`：两次调用顺序一致，按影响力降序。
  - `test_ensure_world_persistent_when_person_id`：`RunConfig(poster_person_id="p_x")` 无 world_id → 建的世界 `persistent is True`。
  - `test_identities_route`（TestClient）：建身份后 `GET /api/identities` 200 且含该身份。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现** `# review:P7-T11`。
- [ ] **Step 4 — 通过 + P6/P7 后端全绿防回归。**
- [ ] **Step 5 — commit** `feat(world): global identity list and persistent run wiring`（`Review-Anchor: P7-T11`）。

---

## Task 12（前端）：Compose 持久身份接线 + 选择器 + 绑定

**Files:** Modify `frontend/src/api/client.ts`（`getIdentities`、`IdentitySummary` 类型；确保 `createRun` 透传 `world_id`）、`frontend/src/screens/ComposeScreen.tsx`、`frontend/src/screens/IdentityScreen.tsx`（影响力条归一化）；Test `client.test.ts`、`ComposeScreen.test.tsx`、`IdentityScreen.test.tsx`

**Interfaces（Consumes）:** `POST /api/persons`（`createPerson` 已有，回 `{world_id, person}`）、`GET /api/identities`（T11）。

**新身份流程（identityMode==="new"）:**
- [ ] `startRun` 先 `createPerson({display_name, persona_kind: posterPersona, platform:"twitter", handle})`（`display_name` 取一个可选"身份昵称"输入，缺省用 persona 标签+短随机后缀）→ 得 `{world_id, person}` → `saveCurrentIdentity(person.person_id, world_id)` → `createRun({..., world_id, poster_person_id: person.person_id, poster_persona})`。
- [ ] 失败测试：新身份 start 先调 `createPerson`、再 `createRun` 且 body 带**返回的** `world_id`+`poster_person_id`；`saveCurrentIdentity` 被调。

**继续身份流程（identityMode==="continue")：**
- [ ] 用 `getIdentities()` 渲染**选择器**（显示 display_name/persona/影响力），选中得 `{world_id, person_id}`；`createRun` 带 `world_id`+`poster_person_id`；`saveCurrentIdentity`。**删除手输 person_id 的 textarea。**
- [ ] 失败测试：continue 模式渲染身份选择器（来自 `getIdentities`）；选中后 `createRun` body 带对应 `world_id`+`poster_person_id`。

**附带（小）：**
- [ ] IdentityScreen 影响力条按**序列最大值归一化**（`value/max*100`，max=0 时显空），避免 KOL 饱和平顶；失败测试断言不同影响力值渲染不同高度。
- [ ] 全部 `// review:P7-T12`；前台无禁用心智词；`npx vitest run && npx tsc -b` 绿。
- [ ] commit `feat(compose): persistent identity creation, picker, and run wiring`（`Review-Anchor: P7-T12`）。

---

## Review Index

| 锚点 | 交付 | 关键验收 |
|------|------|---------|
| P7-T11 | 全局身份列表 + 持久化健壮 | 仅列持久身份带 world_id；确定性序；person_id 给定即持久世界 |
| P7-T12 | Compose 接线 | 新身份先 createPerson 再带 id 发 run；继续身份走选择器带 world_id；绑定生效；影响力条归一化 |

## 完成标准
- 后端 `pytest -m "not llm and not llm_effect"` 全绿；前端 `vitest run`+`tsc -b` 绿。
- 从发起页走一遍：新身份 → run → 再"继续该身份" → run，`standing_timeline` **真出现 2 点、累积单调**（真实使用有数据）。
- "我"能进入刚创建/继续的身份主页，不落空态。
- 无需 LLM key（真链路联跑如需由用户代跑回传）。

## 验证脚本（供用户真链路核验，需 key，由用户代跑回传）
```
# 1) 新身份发起一次 → 2) 用同一身份"继续"再发起一次 → 3) 打开该身份主页
# 预期：身份主页 standing_timeline 有 2 点，影响力/粉丝单调不减，立场按前缀演化
```
