# P8 · 专业社媒分析 实现计划

> **For agentic workers / codex：** 按 TDD 逐 Task 实现。设计=审核者，实现=codex：照计划执行、不改设计、不改弱断言绕过。每 Task 一 commit，带 `Review-Anchor: P8-T<n>`；代码打 `# review:P8-T<n>` / `// review:P8-T<n>`。**依赖 P6 已落地**（消费 `RunSnapshot`/世界投影 与 `GET /api/runs/{id}/frames`）。

**Goal：** 把复盘从"波次+情绪条+一段建议"升级为有方法论支撑的传播分析——传播/级联、意见动力学、极化/回音室、影响力/中心性、情绪/时间动力学五族确定性指标，并重构 Retro 展示与洞察卡。

**Architecture：** 全部指标是对 `RunSnapshot`（或世界投影）的**确定性折叠（非 LLM）**，产出 `AnalysisProjection`，经 `GET /api/runs/{id}/analysis` 暴露；前端 Retro 消费它渲染专业视图。不引入新第三方依赖——中心性用手写有界幂迭代实现。

**Tech Stack：** 后端 Python/pytest（纯算法，无 numpy/networkx 新依赖）；前端 React/TS/vitest；原型图 imagegen。

**设计真源：** spec §5.2（五方法族表）、§7.4（Retro 改造）、§7.5（Retro 原型 brief）、§8。

## Global Constraints

- 分析全部非 LLM、确定性、可测；复用现有 `analysis/attention_context.classify_stance` 做 stance/情绪，不新造。
- **不新增第三方依赖**；PageRank/特征向量中心性用手写幂迭代（固定迭代上界，如 50 次）。
- 前台心智词表约束（禁 `agent/OASIS/仿真/工作台` 等）；洞察是"人话"不是公式。
- 世界层/复盘台配色遵循 spec §7.2，杜绝图表库默认配色。
- 现有 LLM 型 `insights` 保留不动；本计划分析层为其提供更好输入但不改其 LLM 调用。
- 验收：后端 `pytest -m "not llm and not llm_effect" -q`；前端 `npx vitest run && npx tsc -b`。

---

## 文件结构

后端 `weiguan/analysis/`：
- Create `social_metrics/__init__.py`
- Create `social_metrics/diffusion.py` — 级联树/深度/广度/关键转发节点。
- Create `social_metrics/opinion.py` — 意见动力学（立场随 tick 收敛/分化）+ 极化/回音室。
- Create `social_metrics/influence.py` — 入度/幂迭代中心性/k-core。
- Create `social_metrics/temporal.py` — 情绪拐点/发酵曲线/半衰期。
- Create `social_metrics/projection.py` — 聚合 `AnalysisProjection` + `analyze(snapshot)`。
- Modify `api/routes.py` — `GET /api/runs/{id}/analysis`。

前端：
- Create `pov/analysis.ts` — 从 `AnalysisProjection` 派生 Retro 视图模型。
- Modify `screens/RetroScreen.tsx` — 左导航五视图 + 主区 + 洞察卡。
- Create `components/CascadeTree.tsx`、`StanceDistribution.tsx`、`InfluenceBoard.tsx`、`SentimentTimeline.tsx`（纯展示组件，收视图模型）。
- Create `frontend/prototypes/retro-analysis.png` + 自审。

测试：`tests/analysis/test_diffusion.py` 等每族一份 + `test_analysis_projection.py` + `tests/api/test_analysis_route.py`；前端 `pov/analysis.test.ts` + 组件/屏测试。

---

## Task 1: 传播/级联指标

**Files:** Create `backend/weiguan/analysis/social_metrics/diffusion.py`；Test `backend/tests/analysis/test_diffusion.py`

**Interfaces（Produces）:**
```python
class CascadeNode(BaseModel): post_id:int; author_id:int; depth:int; children:list[int]
class DiffusionMetrics(BaseModel):
    tree: list[CascadeNode]; max_depth:int; breadth:int; cascade_size:int
    key_rebroadcasters: list[int]           # 转发/引用带来最多下游的账户
def diffusion_metrics(snapshot: RunSnapshot) -> DiffusionMetrics: ...
    # 用 posts 的 original_post_id(repost/quote) 建 seed 为根的级联树
```

- [ ] **Step 1 — 失败测试**：构造 seed→2 转发→1 二级转发的 snapshot，`max_depth==2`、`breadth`==一级转发数、`cascade_size`==转发+引用总数、`key_rebroadcasters` 首位是带来二级的账户；无转发时树只含根、depth 0。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P8-T1`。**Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(analysis): diffusion cascade metrics`（`Review-Anchor: P8-T1`）。

---

## Task 2: 意见动力学 + 极化/回音室

**Files:** Create `backend/weiguan/analysis/social_metrics/opinion.py`；Test `backend/tests/analysis/test_opinion.py`

**Interfaces:**
```python
class OpinionMetrics(BaseModel):
    stance_by_tick: list[dict]              # 每 tick 的 stance_counts（用 created_at 分桶）
    convergence_trend: str                  # "converging"|"diverging"|"stable"
    polarization_index: float               # 0..1，立场双峰性
    homophily: float                        # 同立场互动占比
    cross_stance_ratio: float               # 跨立场互动占比
    echo_chamber_risk: str                  # "low"|"medium"|"high"
def opinion_metrics(snapshot: RunSnapshot) -> OpinionMetrics: ...
```

- [ ] **Step 1 — 失败测试**：立场随时间从混合走向单峰→`convergence_trend=="converging"`；两极对立 replies→`polarization_index` 高、`cross_stance_ratio` 低、`echo_chamber_risk=="high"`；全中立→低极化。分桶用 `created_at`，复用 `classify_stance`。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P8-T2`。**Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(analysis): opinion dynamics and polarization`（`Review-Anchor: P8-T2`）。

---

## Task 3: 影响力/中心性

**Files:** Create `backend/weiguan/analysis/social_metrics/influence.py`；Test `backend/tests/analysis/test_influence.py`

**Interfaces:**
```python
class InfluenceMetrics(BaseModel):
    ranking: list[dict]        # [{actor_id, in_degree, centrality, kcore}]，按 centrality 降序
    top_leaders: list[int]
def influence_metrics(snapshot: RunSnapshot) -> InfluenceMetrics: ...
    # 图：follow + reply/reaction 指向被回应者；centrality = 幂迭代(<=50 轮, 阻尼0.85)
```

- [ ] **Step 1 — 失败测试**：星型图（多人指向一个中心）→中心 `in_degree` 最大、`centrality` 最高、居 `top_leaders` 首；`kcore` 对稠密子群更高；确定性（两次结果相等）；幂迭代收敛不超 50 轮。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现**（手写幂迭代，无新依赖）`# review:P8-T3`。**Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(analysis): influence centrality and k-core`（`Review-Anchor: P8-T3`）。

---

## Task 4: 情绪/时间动力学

**Files:** Create `backend/weiguan/analysis/social_metrics/temporal.py`；Test `backend/tests/analysis/test_temporal.py`

**Interfaces:**
```python
class TemporalMetrics(BaseModel):
    fermentation_curve: list[dict]   # [{tick, volume, sentiment}]
    peak_tick: int
    half_life_ticks: float           # 从峰值回落到半量的 tick 数
    sentiment_reversals: list[dict]  # [{tick, from, to}] 主导情绪反转拐点
def temporal_metrics(snapshot: RunSnapshot) -> TemporalMetrics: ...
```

- [ ] **Step 1 — 失败测试**：单峰放量曲线→`peak_tick` 正确、`half_life_ticks` 合理；情绪由正转负的构造→`sentiment_reversals` 捕获该 tick；无反转→空列表。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P8-T4`。**Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(analysis): temporal fermentation and sentiment reversals`（`Review-Anchor: P8-T4`）。

---

## Task 5: AnalysisProjection 聚合 + API

**Files:** Create `backend/weiguan/analysis/social_metrics/projection.py`；Modify `backend/weiguan/api/routes.py`；Test `backend/tests/analysis/test_analysis_projection.py`、`backend/tests/api/test_analysis_route.py`

**Interfaces:**
```python
class AnalysisProjection(BaseModel):
    diffusion: DiffusionMetrics; opinion: OpinionMetrics
    influence: InfluenceMetrics; temporal: TemporalMetrics
def analyze(snapshot: RunSnapshot) -> AnalysisProjection: ...
```
- API：`GET /api/runs/{run_id}/analysis` → `AnalysisProjection`（run 不存在 404；空 snapshot 返回结构完整的零值，不 500）。

- [ ] **Step 1 — 失败测试**：`analyze` 组合四族；确定性；空 snapshot 不抛。`TestClient`：已存 run→200 且四族键齐；未知 run→404。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P8-T5`。**Step 4 — 通过 + 全量后端回归绿。**
- [ ] **Step 5 — commit** `feat(analysis): analysis projection and route`（`Review-Anchor: P8-T5`）。

---

## Task 6: Retro 原型图 —— 先出图自审再实现

**Files:** Create `frontend/prototypes/retro-analysis.png`（desktop+mobile）+ `frontend/prototypes/P8-selfreview.md`

依据 spec §7.5 Retro brief（左导航：传播树/立场分化/影响力榜/情绪时间线/数据趋势；主区真实动力学；右洞察卡；复盘台非仪表盘、杜绝默认图表配色）。

- [ ] **Step 1 — 生成 desktop+mobile 原型图。**
- [ ] **Step 2 — 自审**写 `P8-selfreview.md`：无禁用词、复盘台调性、世界层配色、洞察为人话。不合格重出。
- [ ] **Step 3 — commit** `docs(ui): P8 retro prototypes and self-review`（`Review-Anchor: P8-T6`）。

---

## Task 7: Retro 重构（消费 analysis）

**Files:** Create `frontend/src/pov/analysis.ts`、`components/{CascadeTree,StanceDistribution,InfluenceBoard,SentimentTimeline}.tsx`；Modify `screens/RetroScreen.tsx`、`api/client.ts`；Test `pov/analysis.test.ts`、`RetroScreen.test.tsx`、组件测试

**Interfaces（Produces）:** `pov/analysis.ts`：
```ts
export function insightCards(a: AnalysisProjection): { title:string; body:string; sentiment?:Sentiment }[];
// 把指标翻译成人话洞察："关键传播节点 @X""立场拐点在第 N 拍""走向极化""发酵半衰期约 N 拍"
```
`client.ts` 增 `getAnalysis(runId)`。

- [ ] **Step 1 — 失败测试**：`insightCards` 从含关键节点/拐点/极化的 projection 生成对应文案卡（确定性）；左导航切换渲染对应组件（传播树/立场分布/影响力榜/情绪时间线）；空 projection 空态；无禁用心智词。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现**（组件用世界层配色、无默认图表色；情绪筛选口径=阶段主导情绪，空态诚实）`// review:P8-T7`。**Step 4 — 通过 + `tsc -b` + 全量 `vitest run` 绿。**
- [ ] **Step 5 — commit** `feat(retro): professional analysis views and insight cards`（`Review-Anchor: P8-T7`）。

---

## Review Index

| 锚点 | 交付 | 关键验收 |
|------|------|---------|
| P8-T1 | 级联 | 深度/广度/关键转发节点；无转发退化 |
| P8-T2 | 意见/极化 | 收敛趋势/极化指数/回音室风险 |
| P8-T3 | 影响力 | 星型中心居首；确定性；幂迭代≤50 |
| P8-T4 | 时间动力学 | 峰值/半衰期/情绪反转 |
| P8-T5 | 聚合+API | 四族齐；空不 500；404 |
| P8-T6 | Retro 原型 | 图+自审合格 |
| P8-T7 | Retro 重构 | 洞察人话；五视图；空态；无默认图表色 |

## 完成标准
- 后端 `pytest -m "not llm and not llm_effect"` 全绿、无新依赖；前端 `vitest run`+`tsc -b` 绿。
- Retro 展示由真实动力学派生，非固定四波/泛泛建议。
- 原型图落盘 + 自审 + 高保真实现，调性连贯。
- 无需 LLM key（现有 LLM insights 保留不动）。

---

## 附录：P7 修正带来的必要调整（2026-07-03）

P7 补齐在 `weiguan/world/projector.py` 落了立场极性约定与跨 run 影响力，P8 须对齐，避免同一评论在身份页与 Retro 极性不一致：

- **立场极性统一（并入 T2 约束）**：`projector.py::_stance_score` 已确立极性映射——`classify_stance` 的 `question/skeptic`→负、`meme/analysis/other`→正，`score=正−负`，dominant 为 positive/negative/neutral/other。P8 的 opinion/polarization（T2）**必须复用同一映射，不得另立第二套**。实现时把该极性抽成共享 helper（建议 `weiguan/analysis/stance.py::stance_polarity(label:str)->int`，返回 +1/-1/0），让 `projector._stance_score` 与 P8 T2 同时引用；重构 projector 时保持 P7 测试全绿（防回归）。
- **两种"影响力"分别命名（T3）**：P8-T3 的中心性是**单次 run 的结构影响力**，P7 的 `influence_score`/`standing_timeline` 是**跨 run 累积影响力**。二者不可混用；P8 字段命名用 `structural_influence`/`centrality`，UI 文案与身份页的"影响力"区分开。
- **可复用**：Retro 里"影响力/立场随时间"若做跨 run 视角，直接读 P7-T9 的 `PersonView.standing_timeline`，不重复造。
