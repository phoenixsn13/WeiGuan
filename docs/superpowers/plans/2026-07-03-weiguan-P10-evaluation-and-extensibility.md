# P10 · 效果评估与可扩展性收尾 实现计划

> **For agentic workers / codex：** 按 TDD 逐 Task 实现。设计=审核者，实现=codex：照计划执行、不改设计、不改弱断言绕过。每 Task 一 commit，带 `Review-Anchor: P10-T<n>`；代码打 `# review:P10-T<n>` / `// review:P10-T<n>`。**前置：P6–P9 全部落地后启动**（消费 `WorldStore/WorldEvent/EventLog`、`RunSnapshot`、P8 `AnalysisProjection`、P9 `WorldOrchestrator` 与多平台事件）。**不与 P9 在途工作冲突：P10 只在 P9 收口后附加发射缝，不改动 P9 推演逻辑。**

**Goal：** 推演完成后具备两类效果评估能力——(A) 让 LLM 做可解释的主观「平台风味」评估（像不像 X味/微博味/reddit味），(B) 大规模下的技术性能瓶颈评估；并把分析层收敛到可替换实现的接口，消解「自写 embedded vs 第三方」分歧。

**Architecture：**
- 评估数据一律是**事件日志/快照的确定性投影**（延续 C+ 事件溯源），**不改推演流**。
- 抽 `AnalysisProvider` Protocol（镜像既有 `engine/base.py::Engine`）：P8 `analyze` 与新 `flavor_digest` 均为其下 **embedded 实现**（默认、高内聚、精简、业务定制）；契约是 pydantic、已 wire-ready，**预留** 第三方（networkx 等）与远程（http/grpc/mq）实现位——本计划**只画接口不实现**它们。
- perf 观测是**旁路发射**：orchestrator/引擎主循环每拍 emit 结构化 `RunMetric`，经独立 collector 聚合成可读 `PerfDigest`。**perf 是运行期算子指标、非领域事件，故独立于事件日志**，不污染真源。
- 风味评估上游是**给 LLM 读的叙事摘要**，不是原始 logging；perf 埋点不直喂 LLM，先聚合成人可读 digest。二者正交。

**Tech Stack：** 后端 Python/pytest（纯投影+轻量发射，无 numpy/networkx 新依赖）；无需 LLM key。前端本计划**不涉及新屏**（风味/perf 摘要是 dev/评估面，经 API/文件产出）。

**设计真源：** 主 spec §4（事件模型/投影）、§5.2（分析）、§5.3（多平台）；`engine/base.py::Engine`（接口范式先例）。

## Global Constraints

- 全部评估投影**确定性、非 LLM、可测**；复用 `analysis/stance.py::stance_polarity`、`attention_context.classify_stance`、P8 `AnalysisProjection`、P7 `standing_timeline`，不新造并行口径。
- **不新增第三方依赖**；接口预留第三方位但不实现。
- perf emit **旁路、不阻塞、不改推演逻辑**；关闭 emit 时推演行为逐字不变（退化不回归）。
- 代表性原话选取**确定性**（固定排序+限量），不随机。
- 心智词表约束仍适用于任何最终可能进入前台的文案；backend 内部命名可技术化但保持清晰。
- 验收：后端 `pytest -m "not llm and not llm_effect" -q`（无新依赖）；`tsc -b`/`vitest` 若无前端改动则保持既有绿。

---

## 文件结构

后端：
- Create `weiguan/analysis/provider.py` — `AnalysisProvider` Protocol + `EmbeddedAnalysisProvider`（包 P8 `analyze`）。
- Create `weiguan/analysis/flavor.py` — `flavor_digest(...) -> FlavorDigest`（平台/阶段/persona/代表原话/传播白话）。
- Create `weiguan/obs/__init__.py`、`weiguan/obs/emit.py`（`RunMetric` + 旁路 `emit`）、`weiguan/obs/collect.py`（聚合 `PerfDigest`）。
- Modify `weiguan/api/routes.py` — `GET /api/runs/{id}/flavor`；`GET /api/runs/{id}/perf`（dev/内部）。
- Modify `weiguan/world/orchestrator.py`、`weiguan/engine/oasis_engine.py` — **旁路** emit 调用（不改推演流）。
- Create 文档 `docs/manual/2026-07-03-weiguan-flavor-eval-rubric.md` — 主观评估 rubric（供 LLM 复现评估）。

测试：`tests/analysis/test_provider.py`、`test_flavor.py`、`tests/obs/test_emit.py`、`test_collect.py`、`tests/api/test_flavor_route.py`、`test_perf_route.py`。

---

## Task 1: 分析层接口化（AnalysisProvider）

**Files:** Create `backend/weiguan/analysis/provider.py`；Modify `backend/weiguan/api/routes.py`；Test `backend/tests/analysis/test_provider.py`

**Interfaces（Produces）:**
```python
class AnalysisProvider(Protocol):
    def analyze(self, snapshot: RunSnapshot) -> AnalysisProjection: ...

class EmbeddedAnalysisProvider:                    # 默认实现：包 P8 analyze
    def analyze(self, snapshot: RunSnapshot) -> AnalysisProjection: ...
def default_analysis_provider() -> AnalysisProvider: ...   # 返回 EmbeddedAnalysisProvider
```
- `GET /api/runs/{id}/analysis` 改为经 `default_analysis_provider()` 调用（行为、输出契约**逐字不变**）。
- 类注释标注预留位：第三方（`NetworkxAnalysisProvider`）、远程（`RemoteAnalysisProvider`，http/grpc/mq）——**本计划不实现**，仅在 docstring 记明扩展点与"契约=`AnalysisProjection`、已可序列化(`model_dump(mode="json")`)"。

- [ ] **Step 1 — 失败测试**：`EmbeddedAnalysisProvider().analyze(s)` 与直接 `analyze(s)` 结果相等；`default_analysis_provider()` 返回 embedded 实例；`/analysis` 路由输出与 P8 前逐字一致（回归）。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P10-T1`。**Step 4 — 通过 + P8 测试全绿。**
- [ ] **Step 5 — commit** `refactor(analysis): analysis provider protocol with embedded impl`（`Review-Anchor: P10-T1`）。

---

## Task 2: 风味评估摘要投影（FlavorDigest）

**Files:** Create `backend/weiguan/analysis/flavor.py`；Test `backend/tests/analysis/test_flavor.py`

**Interfaces（Produces）:**
```python
class PhaseSample(BaseModel):
    phase: str                       # "seed"|"early"|"peak"|"tail"（按 P8 fermentation_curve 分段）
    tick_range: tuple[int, int]
    volume: int
    dominant_sentiment: str
    representative_utterances: list[str]   # 该阶段代表原话；确定性选取、限量（默认 <=5）
class PlatformFlavor(BaseModel):
    platform: str
    persona_mix: dict[str, int]      # ordinary/verified/kol 参与计数（经 Account->Person->persona_kind）
    spread_shape: str                # 白话："单源爆发"|"多点扩散"|"链式转发"|"零散"（由 P8 diffusion 派生）
    phases: list[PhaseSample]
class FlavorDigest(BaseModel):
    world_id: str | None
    run_ids: list[str]
    platforms: list[PlatformFlavor]
    cross_platform_notes: list[str]  # 桥接互窜白话（依赖 P9 BRIDGE_INJECT；无则空）
def flavor_digest(snapshot: RunSnapshot, *, analysis: AnalysisProjection | None = None) -> FlavorDigest: ...
```
要点：阶段分段复用 P8 `temporal.fermentation_curve`（peak 前后切 early/peak/tail，seed 单列）；`spread_shape` 由 P8 `diffusion`（max_depth/breadth/cascade_size）映射白话；`representative_utterances` 按 (互动量, tick, id) 确定性排序取前 K、去重；persona 经身份模型解析。**全程非 LLM**——它是"给 LLM 读的原料"，不是 LLM 产物。

- [ ] **Step 1 — 失败测试**：多阶段快照→phases 覆盖 seed/early/peak/tail 且 tick_range 单调；代表原话确定性（两次相等）且限量；`spread_shape` 对深链→"链式转发"、对星型→"单源爆发"；空快照→结构完整零值不抛；多平台→每平台一个 `PlatformFlavor`。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P10-T2`。**Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(analysis): flavor digest projection for subjective evaluation`（`Review-Anchor: P10-T2`）。

---

## Task 3: 风味 API + 评估 rubric 文档

**Files:** Modify `backend/weiguan/api/routes.py`；Create `docs/manual/2026-07-03-weiguan-flavor-eval-rubric.md`；Test `backend/tests/api/test_flavor_route.py`

- API：`GET /api/runs/{run_id}/flavor` → `FlavorDigest`（未知 run 404；空快照零值不 500）。多轮/世界视角可选 `?world_id=` 聚合该世界全部 run 事件。
- rubric 文档（供审核者/LLM 复现主观评估）固定维度：
  1. **语域**：口语/正式/梗密度是否贴平台。
  2. **平台记号**：微博（控评/转发链/#话题#）、Reddit（楼中楼引用对喷/投票语气）、X（quote-dunk/短促）。
  3. **persona 行为一致性**：KOL 带节奏 vs 大V 权威 vs 普通人跟风，是否可辨。
  4. **发酵自然度**：曲线像真实扩散还是机械四波脉冲。
  5. **跨平台转述变味**：同一话题经桥接到他平台是否换了该平台的说法。
  评估产物=对每平台给"X味/微博味/reddit味"评级 + 依据引用 `representative_utterances`。

- [ ] **Step 1 — 失败测试**：`TestClient` 已存 run→200 且 `FlavorDigest` 键齐；未知 run→404；`?world_id=` 聚合多 run。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P10-T3`。**Step 4 — 通过。**
- [ ] **Step 5 — commit** `feat(api): flavor digest route and evaluation rubric`（`Review-Anchor: P10-T3`）。

---

## Task 4: 性能可观测性——旁路发射缝

**Files:** Create `backend/weiguan/obs/__init__.py`、`weiguan/obs/emit.py`；Modify `weiguan/world/orchestrator.py`、`weiguan/engine/oasis_engine.py`；Test `backend/tests/obs/test_emit.py`

**Interfaces（Produces）:**
```python
class RunMetric(BaseModel):
    world_id: str | None; run_id: str; tick: int; platform: str | None
    wall_ms: float; active_accounts: int; llm_calls: int; snapshot_delta_size: int
class MetricSink(Protocol):
    def record(self, metric: RunMetric) -> None: ...
class NullSink:      # 默认：不收集，零开销
    def record(self, metric: RunMetric) -> None: ...
class MemorySink:    # dev：内存累积，供 collect 聚合
    metrics: list[RunMetric]
def emit(sink: MetricSink, metric: RunMetric) -> None: ...
```
- orchestrator 每拍 / 引擎 `run` 每 step 结尾**旁路** `emit`（计时用 `perf_counter`）；**sink 默认 `NullSink`**——不注入时推演行为、输出逐字不变（退化不回归，必须有测试断言）。
- 不得让 emit 抛错冒泡打断推演（emit 内部吞异常或保证不抛）。

- [ ] **Step 1 — 失败测试**：注入 `MemorySink` 后编排 N 拍→收到 N 条 `RunMetric`、tick 单调、字段合理；用 `NullSink`（默认）时推演结果与未接 emit **逐字一致**（回归）；emit 不抛。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现**（FakeEngine 测，无 LLM）`# review:P10-T4`。**Step 4 — 通过 + P9 编排测试全绿。**
- [ ] **Step 5 — commit** `feat(obs): bypass run-metric emission seam`（`Review-Anchor: P10-T4`）。

---

## Task 5: 性能聚合小工具（PerfDigest）

**Files:** Create `backend/weiguan/obs/collect.py`；Modify `backend/weiguan/api/routes.py`（dev/内部 perf 路由）；Test `backend/tests/obs/test_collect.py`、`tests/api/test_perf_route.py`

**Interfaces（Produces）:**
```python
class PerfDigest(BaseModel):
    run_id: str | None; world_id: str | None
    total_ticks: int; peak_tick: int; peak_wall_ms: float
    total_llm_calls: int; total_active_accounts: int
    snapshot_growth: int                    # snapshot_delta_size 累积（内存增长提示）
    hotspots: list[str]                     # 白话瓶颈提示（如"第 N 拍耗时突增"/"级联深度大"）
def collect(metrics: list[RunMetric]) -> PerfDigest: ...
```
- `GET /api/runs/{id}/perf`（dev）→ `PerfDigest`（无采集数据→零值不 500）。
- `hotspots` 用确定性阈值规则（如某拍 wall_ms > 均值×K、snapshot_growth 超阈）生成人话提示，供大规模跑后定位瓶颈。

- [ ] **Step 1 — 失败测试**：构造带一处耗时突增的 `RunMetric` 序列→`peak_tick` 命中、`hotspots` 含该拍提示；空序列→零值不抛；`total_llm_calls` 求和正确。
- [ ] **Step 2 — 确认失败。** **Step 3 — 实现** `# review:P10-T5`。**Step 4 — 通过 + 全量后端回归绿。**
- [ ] **Step 5 — commit** `feat(obs): perf digest aggregation and route`（`Review-Anchor: P10-T5`）。

---

## Review Index

| 锚点 | 交付 | 关键验收 |
|------|------|---------|
| P10-T1 | 分析接口化 | Provider Protocol；embedded=P8 逐字等价；预留第三方/远程位不实现 |
| P10-T2 | 风味摘要投影 | 阶段/persona/代表原话确定性；spread_shape 白话；空态零值 |
| P10-T3 | 风味 API+rubric | 200/404/world_id 聚合；rubric 五维固定 |
| P10-T4 | perf 发射缝 | 旁路 emit；NullSink 默认退化不回归；不抛 |
| P10-T5 | perf 聚合 | PerfDigest 命中峰值/热点；空态零值 |

## 完成标准
- 后端 `pytest -m "not llm and not llm_effect"` 全绿、无新依赖；`tsc -b`/`vitest` 保持既有绿（本计划无前端改动）。
- 风味摘要是"给 LLM 读的确定性叙事原料"，非 LLM 产物；rubric 可复现主观评估。
- perf 发射旁路、默认零开销、退化不回归；聚合 digest 人可读、指向瓶颈。
- 分析层可替换实现的接口就位，第三方/远程为预留扩展点（不实现）。

## 非目标（明确不做，遵循不预优化）
- **不**优化 P8 `descendant_count` O(n²)+递归、`_kcore` O(n²)、每拍 snapshot 内存等热点——**待 T5 `PerfDigest` 在真实大规模跑后实证为瓶颈，再针对性修**（届时另开小片，如 `descendant_count` 改一次性后序遍历缓存）。
- **不**实现 networkx/remote 分析 provider、不建 perf 看板/持久化时序库——仅画缝、留位。
- **不**新增前端屏；风味/perf 为 dev 评估面。
