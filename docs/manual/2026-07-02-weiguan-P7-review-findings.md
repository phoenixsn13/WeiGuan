# P7 审核发现与补齐（P7-T9/T10）

日期：2026-07-02

审核者按 spec `2026-07-02-weiguan-world-identity-and-wishes-design.md` 与 P7 计划二次核验 P7 实现（commit `425fbf4..d4fb6eb`，116/91 passed、tsc 0）。**T1/T2/T3/T4/T6/T8 闭合**；发现 3 处需补齐，判据=**真数据已在事件日志（事件溯源），缺口只是薄投影/展示面 → 补齐不妥协，不走降级**（避免"先拆后建"双份工）。

## 发现

- **F1[中·最优先]｜伪时间序列**：`frontend/src/pov/identity.ts` 的 `stanceDriftSeries` 给每个点同一 `dominant/score`（不漂移）、`influenceSeries` 用 `total_influence*(index+1)/N` 造固定线性阶梯。根因：`PersonView` 只暴露 `total_influence` 标量 + 最终 stance，无"按每次围观的历史 standing"。IdentityScreen 却以"立场时间线/影响力曲线"呈现 → 造假累积。**真数据本就在事件日志里**（每 `WorldEvent` 带 `tick`+`run_id`）。
- **F2[中]｜`/identity/me` 未绑定当前身份**：无 `world_id`，IdentityScreen 落"缺少世界信息"空态，导航"我"到不了真实身份。
- **F3[低]｜成本 UI 缺"自有算力 vs 付费 API"解释**（用户 Q4；P7 计划 T5 亦要求）。

## 补齐方案（不降级）

判据一致性说明：与既往 inert-controls 选"诚实降级"**不矛盾**——那时后端真无能力（mutation/帧存储不存在）；本次后端有能力（事件日志已含历史），故补齐才对。

---

## Task 9（后端）：按 run 的 standing 时间线投影

**Files:** Modify `backend/weiguan/world/models.py`（加 `StandingPoint`、`PersonView.standing_timeline`）、`backend/weiguan/world/projector.py`（加 `project_standing_timeline` 并在 `fold_world` 填充）；Test `backend/tests/world/test_projector.py`（追加）

**Interfaces（Produces）:**
```python
class StandingPoint(BaseModel):
    run_id: str
    influence: float = 0.0
    followers: int = 0
    stance_dominant: str = "other"
    stance_score: int = 0        # positive - negative 计数差

# PersonView 增字段（保持既有字段不变）：
class PersonView(BaseModel):
    person: Person
    stance: StanceState
    total_influence: float = 0.0
    run_ids: list[str] = []
    standing_timeline: list[StandingPoint] = []   # 与 run_ids 同序，一次 run 一点

def project_standing_timeline(
    person: Person, events: list[WorldEvent], run_order: list[str]
) -> list[StandingPoint]: ...
    # 对 run_order 逐次累积折叠：第 i 点 = 仅 run_order[:i+1] 的事件折叠后该 person 的账户 standing
```

- [ ] **Step 1 — 失败测试**（无 LLM）：
  - `test_standing_timeline_matches_run_order`：`standing_timeline` 长度==`run_ids` 长度、`run_id` 一一对应同序。
  - `test_standing_timeline_influence_monotonic`：持久世界累积场景下 `influence`/`followers` 沿时间线**单调不减**（真实累积，不是插值）。
  - `test_standing_timeline_stance_reflects_prefix`：某 run 后立场由 positive 主导 → 该点 `stance_dominant=="positive"`；仅用到该 run 及之前的事件（前缀折叠），不看后续。
  - `test_standing_timeline_deterministic`：两次结果相等。
  - `test_person_view_includes_timeline`：`fold_world`/`get_person_view` 返回的 `PersonView.standing_timeline` 非空且与上述一致。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现** `project_standing_timeline`（复用 `fold_world` 前缀折叠逻辑，确定性、非 LLM），在 `fold_world` 里为每个 person 填 `standing_timeline`。`# review:P7-T9`。
- [ ] **Step 4 — 通过 + 既有 `test_projector.py`/P6 全绿防回归。**
- [ ] **Step 5 — commit** `feat(world): per-run standing timeline projection`（`Review-Anchor: P7-T9`）。

---

## Task 10（前端）：真序列消费 + 当前身份绑定 + 成本文案

**Files:** Modify `frontend/src/api/client.ts`（`PersonView` 类型加 `standing_timeline`、`StandingPoint`）、`frontend/src/pov/identity.ts`、`frontend/src/screens/IdentityScreen.tsx`、`frontend/src/screens/ComposeScreen.tsx`、`frontend/src/shell/AppShell.tsx`、`frontend/src/api/useApiKey.ts`（存当前身份）；Test 对应 `*.test.ts(x)`

**F1 补齐（真序列，替换插值）:**
- [ ] `stanceDriftSeries`/`influenceSeries` **改为消费 `person.standing_timeline`**：`influence` 直接取 `point.influence`、`stance` 取 `point.stance_dominant/stance_score`。删除 `total_influence*(index+1)/N` 与常数 score 的伪造逻辑。
- [ ] **诚实守卫**：`standing_timeline` 为空或长度<1 → 返回空数组，IdentityScreen 显"还没有足够记录形成时间线"空态（不画假图）。
- [ ] 失败测试 `pov/identity.test.ts`：给含两点、influence 递增的 `standing_timeline` → `influenceSeries` 值等于真值且递增；不同 run 的 `dominant` 不同 → `stanceDriftSeries` 各点**不再相同**；空 timeline → 空。

**F2 补齐（当前身份绑定）:**
- [ ] `useApiKey.ts`（或新 `useCurrentIdentity`）在 localStorage 存/读 `wg_current_person_id` + `wg_current_world_id`；发起 run 或建身份成功后写入。
- [ ] AppShell "我" 指向 `/identity/{personId}?world_id={worldId}`（有绑定时）；无绑定时指向 `/history`（让用户先选身份），**不落"缺少世界信息"死胡同**。
- [ ] 失败测试 `shell/shell.test.tsx`：有绑定时"我"href 带 person_id+world_id；无绑定时指向历史。

**F3 补齐（成本文案）:**
- [ ] ComposeScreen 成本条补一行差异说明，例如："自有算力不额外计费；付费 API 按上方 token 估算约 ¥X。"
- [ ] 失败测试 `ComposeScreen.test.tsx`：成本条渲染含"自有算力"与"付费"字样。

- [ ] 全部实现 `// review:P7-T10`；`npx vitest run && npx tsc -b` 绿；前台无禁用心智词。
- [ ] commit `feat(identity): real standing series, current-identity binding, cost copy`（`Review-Anchor: P7-T10`）。

---

## Review Index（审核者复核）

| 锚点 | 交付 | 关键验收 |
|------|------|---------|
| P7-T9 | standing 时间线投影 | 同序对应；影响力/粉丝**真实单调**（非插值）；stance 前缀折叠；确定性 |
| P7-T10 | 真序列+绑定+文案 | series 吃 `standing_timeline`、伪造逻辑删除；空态诚实；"我"绑定不落死胡同；成本含自有/付费文案 |

## 完成标准
- 后端 `pytest -m "not llm and not llm_effect"` 全绿（含新投影测试）；前端 `vitest run`+`tsc -b` 绿。
- IdentityScreen 的立场/影响力**由真实 `standing_timeline` 驱动**，无插值/常数伪造；数据不足显诚实空态。
- 导航"我"可达真实身份或诚实回退。
- 无需 LLM key。

## 落到 P8 的关联
P8 专业分析里的"立场随时间/影响力演化"可直接复用 P7-T9 的 `standing_timeline` 投影，不重复造。
