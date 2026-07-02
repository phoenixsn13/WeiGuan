# P6 · 围观世界与身份基石 实现计划

> **For agentic workers / codex：** 本计划按 TDD 逐 Task 实现。设计=审核者，实现=codex：照计划执行、不改设计、不改弱断言绕过。每 Task 一 commit，带 `Review-Anchor: P6-T<n>`；保留既有 `# review:` 锚点，新能力打新锚点 `# review:P6-T<n>[-AC<k>]`。步骤用 `- [ ]` 勾选跟踪。

**Goal：** 在现有单 run 引擎之上引入"事件溯源的世界层"（`World/Person/Account/WorldEvent/Projector`）与 run 读投影/写事件的缝，并提供回放帧契约，同时**保证今天的单次围观（退化态）完全不回归**。

**Architecture：** 世界是第一级容器，持有追加式 `EventLog`（唯一真相源）；`Person→Account` 是身份模型；一切身份/关注/记忆状态都是 `Projector` 对 EventLog 的**确定性折叠**（非 LLM）。run 启动读投影播种、每拍产出追加 `WorldEvent`；无 `world_id` 时自动建临时世界，行为与今天等价。回放帧 = 某 run 的有序 `WorldEvent`。

**Tech Stack：** Python 3 / pydantic v2 / pytest / FastAPI（`weiguan/` 后端）。持久化沿用 `WEIGUAN_WORKDIR` 下文件存储，风格对齐现有 `weiguan/api/store.py::RunStore`。

**设计真源：** `docs/superpowers/specs/2026-07-02-weiguan-world-identity-and-wishes-design.md`（§三决策、§四数据模型、§六成本、§八契约、§十测试）。

## Global Constraints（每个 Task 隐含包含）

- 不引入需联网下载的模型；投影全部确定性、非 LLM。
- 复用现有 `weiguan/analysis/attention_context.py::classify_stance` 做 stance，不新造分类器。
- 不要求任何人打印/记录 API key；本计划所有 Task **均无需 LLM key**（用 `weiguan/engine/fake.py::FakeEngine` 测 run 缝）。
- 退化态铁律：无 `world_id` 的 run 必须与今天等价——真围观 seed 口径不回归（`seed_interaction_count`/`seed_engaged_actor_ids` 行为不变）。
- 前台心智词表约束（禁 `agent/OASIS/仿真/工作台` 等）不适用于后端内部命名，但面向 API 响应的用户可见文案须遵守。
- 验收命令（无 LLM 回归）：`cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`

---

## 文件结构

新增（后端 `backend/weiguan/world/`）：
- `world/__init__.py` — 导出世界层公共类型。
- `world/models.py` — `PersonaKind`、`WorldEventKind`、`World`、`Person`、`Account`、`WorldEvent`、`StanceState`、`BoundedMemory`、`PersonView`、`persona_starting_standing()`。
- `world/eventlog.py` — `EventLog` 追加/读取（JSONL per world，追加式、并发不覆盖）。
- `world/projector.py` — `fold_world()`、`project_bounded_memory()`、`project_stance()`。
- `world/store.py` — `WorldStore`（世界/人物持久化 + 事件追加 + 按 run 读帧）。

修改：
- `engine/config.py` — `RunConfig` 增 `world_id/poster_persona/poster_person_id/person_memory_budget`。
- `engine/oasis_engine.py` + `engine/routing.py` — run 读投影播种 + 每拍追加 `WorldEvent`；无 world 时建临时世界。
- `analysis/attention_context.py` — `self_memory` 可由 `BoundedMemory` 注入。
- `api/routes.py` + `api/store.py` — 新增世界/人物/帧路由；run 关联 world/person。

测试：
- `tests/world/test_models.py`、`test_eventlog.py`、`test_projector.py`
- `tests/engine/test_oasis_engine_world.py`
- `tests/analysis/test_attention_memory.py`
- `tests/api/test_world_routes.py`

---

## Task 1: 世界层类型与 persona 起始盘

**Files:**
- Create: `backend/weiguan/world/models.py`, `backend/weiguan/world/__init__.py`
- Test: `backend/tests/world/test_models.py`

**Interfaces（Produces —— P7/P8/P9 均消费这些签名，务必一字不差）:**
```python
class PersonaKind(str, Enum): ORDINARY="ordinary"; VERIFIED="verified"; KOL="kol"
class WorldEventKind(str, Enum):
    SEED="seed"; POST="post"; REPLY="reply"; REACTION="reaction"
    FOLLOW="follow"; REPORT="report"; BRIDGE_INJECT="bridge_inject"

class Account(BaseModel):
    account_id: str; person_id: str; platform: Platform  # weiguan.canonical.Platform
    handle: str; avatar_seed: str = ""
    num_followers: int = 0; influence_score: float = 0.0

class Person(BaseModel):
    person_id: str; display_name: str; persona_kind: PersonaKind
    accounts: list[Account] = []

class World(BaseModel):
    world_id: str; created_at: str; clock_tick: int = 0; persistent: bool = False

class WorldEvent(BaseModel):
    event_id: str; world_id: str; tick: int; created_at: str
    platform: Platform; actor_account_id: str | None = None
    kind: WorldEventKind; payload: dict = {}
    run_id: str | None = None   # 帧回放按 run 过滤

class StanceState(BaseModel):
    stance_counts: dict[str, int] = {}; dominant: str = "other"
class BoundedMemory(BaseModel):
    stance_line: str = ""; recent_utterances: list[str] = []
class PersonView(BaseModel):   # 投影产物，身份主页数据
    person: Person; stance: StanceState
    total_influence: float = 0.0; run_ids: list[str] = []

def persona_starting_standing(kind: PersonaKind) -> tuple[int, float]:
    """(起始粉丝, 起始影响力)。ordinary→低, verified→中, kol→高。"""
```

- [ ] **Step 1 — 写失败测试** `tests/world/test_models.py`：
  - `test_persona_starting_standing_orders`：`persona_starting_standing(KOL)[0] > persona_starting_standing(VERIFIED)[0] > persona_starting_standing(ORDINARY)[0]`，影响力同序，且 ORDINARY 粉丝 ≥ 0。
  - `test_world_event_defaults`：`WorldEvent(...)` 最小构造，`payload=={}`、`run_id is None`。
  - `test_person_account_nesting`：`Person(accounts=[Account(...)])` 往返 `model_dump/model_validate` 相等。
- [ ] **Step 2 — 跑测试确认失败**（`ModuleNotFoundError: weiguan.world`）。
- [ ] **Step 3 — 实现** `world/models.py` + `__init__.py` 导出上述全部；`persona_starting_standing` 给出具体三档（建议 ordinary=(20,1.0)、verified=(2_000,10.0)、kol=(50_000,50.0)，数值可调但须满足序关系）。标注 `# review:P6-T1`。
- [ ] **Step 4 — 跑测试确认通过。**
- [ ] **Step 5 — commit** `feat(world): add world/person/account types and persona standing`（trailer `Review-Anchor: P6-T1`）。

---

## Task 2: EventLog 追加式存储（并发不覆盖）

**Files:**
- Create: `backend/weiguan/world/eventlog.py`
- Test: `backend/tests/world/test_eventlog.py`

**Interfaces:**
- Consumes: `WorldEvent`（T1）。
- Produces:
```python
class EventLog:
    def __init__(self, path: str) -> None: ...          # JSONL 文件路径
    def append(self, event: WorldEvent) -> None: ...    # 原子追加一行
    def read(self, *, run_id: str | None = None) -> list[WorldEvent]: ...
        # 按 (tick, created_at, event_id) 稳定排序返回；run_id 给定则过滤
```

- [ ] **Step 1 — 写失败测试**：
  - `test_append_read_roundtrip_sorted`：乱序 tick 追加，`read()` 按 tick 升序。
  - `test_concurrent_append_no_clobber`：模拟两个"run"交替 `append`（不同 `run_id`），`read()` 返回**全部** N 条、无丢失无覆盖；`read(run_id=A)` 只返回 A 的。**这是决策1"并发写变并发 append 不覆盖"的核心断言。**
  - `test_append_is_line_atomic`：写入后文件行数 == 事件数（追加而非重写）。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**：JSONL，每 `append` 以 `"a"` 模式写一行 `event.model_dump_json()`；`read` 逐行解析 + 稳定排序。`# review:P6-T2`。
- [ ] **Step 4 — 确认通过。**
- [ ] **Step 5 — commit** `feat(world): append-only event log with stable ordering`（`Review-Anchor: P6-T2`）。

---

## Task 3: Projector 确定性折叠

**Files:**
- Create: `backend/weiguan/world/projector.py`
- Test: `backend/tests/world/test_projector.py`

**Interfaces:**
- Consumes: `WorldEvent/Person/Account/StanceState/BoundedMemory/PersonView`（T1），`classify_stance`（现有）。
- Produces:
```python
def project_stance(events: list[WorldEvent], account_id: str) -> StanceState: ...
def project_bounded_memory(events: list[WorldEvent], account_id: str, budget: int) -> BoundedMemory: ...
def fold_world(world: World, persons: list[Person], events: list[WorldEvent]) -> dict[str, PersonView]: ...
    # 返回 person_id -> PersonView；粉丝/影响力/立场/run_ids 全由 events 折叠得到
```

- [ ] **Step 1 — 写失败测试**：
  - `test_project_stance_dominant`：给定含"来源/证据"文案的 reply 事件，`dominant=="question"`（复用 classify_stance）。
  - `test_bounded_memory_respects_budget`：某 account 有 10 条发言事件，`project_bounded_memory(...,budget=3).recent_utterances` 长度 ≤ 3，取最近。**成本中性核心断言。**
  - `test_fold_is_deterministic`：同一 events 两次 `fold_world` 结果相等（`==`）。
  - `test_fold_degenerate_equals_snapshot_actors`：把一次单 run 的动作转成 events 折叠后，涉及的 account 集合与该 run snapshot 的 actor 集合一致（退化等价）。
  - `test_influence_monotonic_on_followers`：追加 follow 事件后该 account 的 `num_followers`/`influence_score` 单调不减。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现** 折叠逻辑（fold 顺序 = EventLog 排序；follow→粉丝+1、reaction/reply→影响力累加，具体权重可调但须满足单调断言）。`# review:P6-T3`。
- [ ] **Step 4 — 确认通过。**
- [ ] **Step 5 — commit** `feat(world): deterministic projector for stance/memory/standing`（`Review-Anchor: P6-T3`）。

---

## Task 4: WorldStore 持久化

**Files:**
- Create: `backend/weiguan/world/store.py`
- Test: `backend/tests/world/test_store.py`

**Interfaces:**
- Consumes: T1/T2/T3。
- Produces:
```python
class WorldStore:
    def __init__(self, workdir: str) -> None: ...
    def create_world(self, *, persistent: bool) -> World: ...
    def get_world(self, world_id: str) -> World | None: ...
    def upsert_person(self, world_id: str, person: Person) -> None: ...
    def get_person_view(self, world_id: str, person_id: str) -> PersonView | None: ...  # 内部 fold
    def append_event(self, event: WorldEvent) -> None: ...
    def read_frames(self, run_id: str) -> list[WorldEvent]: ...   # 回放帧
```

- [ ] **Step 1 — 写失败测试**：`create_world`→`get_world` 往返；`upsert_person`+append 若干 events→`get_person_view` 反映折叠后的粉丝/立场；`read_frames(run_id)` 返回该 run 有序事件；跨 `WorldStore` 实例（重启）仍能读回（持久化）。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**：`workdir/worlds/<world_id>/` 下存 `world.json`、`persons.json`、`events.jsonl`；`get_person_view` 内部调 `fold_world`。对齐 `RunStore` 风格。`# review:P6-T4`。
- [ ] **Step 4 — 确认通过。**
- [ ] **Step 5 — commit** `feat(world): persistent world store with frames read`（`Review-Anchor: P6-T4`）。

---

## Task 5: RunConfig 扩展

**Files:**
- Modify: `backend/weiguan/engine/config.py`
- Test: `backend/tests/engine/test_config.py`（追加用例）

**Interfaces（Produces）:** `RunConfig` 新增字段：
```python
world_id: str | None = None
poster_persona: PersonaKind = PersonaKind.ORDINARY
poster_person_id: str | None = None
person_memory_budget: int = 4
```

- [ ] **Step 1 — 写失败测试**：默认值断言；`person_memory_budget < 1` 抛错；无 `world_id` 构造合法（退化态）；`poster_persona` 接受枚举值。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**：加字段 + 在 `_steps_preset` 校验 `person_memory_budget >= 1`。`# review:P6-T5`。
- [ ] **Step 4 — 确认通过（并跑既有 `test_config.py` 全绿，防回归）。**
- [ ] **Step 5 — commit** `feat(config): add world/persona/memory-budget to RunConfig`（`Review-Anchor: P6-T5`）。

---

## Task 6: Run 缝 —— 读投影播种 + 每拍写事件（无 LLM，用 FakeEngine）

**Files:**
- Modify: `backend/weiguan/engine/oasis_engine.py`（真引擎），`backend/weiguan/engine/routing.py`（装配）
- Create: `backend/weiguan/world/run_bridge.py`（RunDelta→WorldEvent 转换，纯函数，便于测）
- Test: `backend/tests/engine/test_oasis_engine_world.py`

**Interfaces:**
- Consumes: `WorldStore`（T4）、`persona_starting_standing`（T1）、`RunConfig`（T5）、`RunDelta`（现有）。
- Produces:
```python
def delta_to_events(delta: RunDelta, *, world_id: str, run_id: str, platform: Platform,
                    account_of: dict[int, str]) -> list[WorldEvent]:
    """把一拍 snapshot delta 里的 posts/replies/reactions/follows/reports 转成 WorldEvent。"""
def ensure_world_for_run(store: WorldStore, config: RunConfig) -> tuple[World, Person]:
    """有 world_id/poster_person_id 则复用；否则建临时世界(persistent=False)+发帖人 Person(按 persona 起始盘)。"""
```

- [ ] **Step 1 — 写失败测试**（全部用 `FakeEngine` 驱动 delta，无 LLM）：
  - `test_delta_to_events_maps_actions`：一拍含 1 reply + 1 like → 产出对应 `WorldEventKind.REPLY`/`REACTION` 各一，`run_id`/`world_id` 正确。
  - `test_ephemeral_world_when_no_world_id`：`ensure_world_for_run` 对无 `world_id` 的 config 建 `persistent=False` 世界，发帖人 persona=ORDINARY 起始盘生效。
  - `test_reuse_persistent_world_accumulates`：同一 `poster_person_id` 连续两次 run 后，`get_person_view` 的 `run_ids` 含两次、影响力单调不减（**愿望2 累积核心断言**）。
  - `test_run_appends_frames`：跑完一次 FakeEngine run 后 `store.read_frames(run_id)` 非空且含 seed 事件。
  - `test_degenerate_run_unchanged`：无 world 的 run 产出的 deltas 与未接世界层前逐拍 snapshot 等价（**退化不回归断言**）。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现** `run_bridge.py` 纯函数 + 在 `oasis_engine.run()` 包一层：run 前 `ensure_world_for_run` + 读投影播种发帖人账户 standing；每 `yield` 的 delta → `delta_to_events` → `store.append_event`。`routing.py` 注入 `WorldStore`。**保持 seed pinning/`_assert_seed_visible`/`env.close()` 既有逻辑不动。** `# review:P6-T6`。
- [ ] **Step 4 — 确认通过 + 跑既有 `test_oasis_engine_*` 防回归。**
- [ ] **Step 5 — commit** `feat(engine): wire run to world event log (seed/append, ephemeral fallback)`（`Review-Anchor: P6-T6`）。

---

## Task 7: 注意力 self_memory 由 BoundedMemory 注入

**Files:**
- Modify: `backend/weiguan/analysis/attention_context.py`
- Test: `backend/tests/analysis/test_attention_memory.py`

**Interfaces:**
- Consumes: `BoundedMemory`（T1/T3）、现有 `AttentionContextConfig/AttentionContext`。
- Produces: `AttentionContextConfig` 增可选 `self_memory_override: str | None = None`；给定时 `build_attention_context` 的 `self_memory` 前缀拼接该有界记忆（不超过 budget 决定的长度）。

- [ ] **Step 1 — 写失败测试**：给 `self_memory_override="立场:看空; 近期:...”`，`build_attention_context(...).self_memory` 包含该串；不给时行为与今天完全一致（回归）。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现**：`AttentionContextConfig` 加字段；`build_attention_context` 在 self_memory 组装处按存在与否拼接。`# review:P6-T7`。
- [ ] **Step 4 — 确认通过 + 跑既有 `test_attention_context.py` 防回归。**
- [ ] **Step 5 — commit** `feat(attention): allow bounded person memory injection`（`Review-Anchor: P6-T7`）。

---

## Task 8: 世界/人物/帧 API 路由

**Files:**
- Modify: `backend/weiguan/api/routes.py`, `backend/weiguan/api/store.py`, `backend/weiguan/api/app.py`（如需注入 WorldStore）
- Test: `backend/tests/api/test_world_routes.py`

**Interfaces（Produces —— 前端契约）:**
- `POST /api/worlds` body `{persistent: bool}` → `World`。
- `GET /api/worlds/{world_id}` → `World`（404 若无）。
- `GET /api/persons/{person_id}?world_id=` → `PersonView`（404 若无）。
- `GET /api/runs/{run_id}/frames` → `{frames: WorldEvent[]}`（有序；空 run 返回空数组，不 500）。
- `create_run` body 透传 `world_id/poster_persona/poster_person_id/person_memory_budget`（均可选，缺省=今天行为）。

- [ ] **Step 1 — 写失败测试**（FastAPI `TestClient`，无 LLM）：建世界→200 且含 `world_id`；未知 world/person→404；跑一次 FakeEngine run 后 `GET /runs/{id}/frames` 返回有序非空；不传世界字段的 `create_run` 仍成功（退化）。
- [ ] **Step 2 — 确认失败。**
- [ ] **Step 3 — 实现** 路由 + `WorldStore` 注入 + `create_run` 字段透传；沿用既有 BYOK header、不落 key。`# review:P6-T8`。
- [ ] **Step 4 — 确认通过 + 全量 `pytest -m "not llm and not llm_effect"` 绿。**
- [ ] **Step 5 — commit** `feat(api): world/person/frames routes and run wiring`（`Review-Anchor: P6-T8`）。

---

## Review Index（审核者逐条核验）

| 锚点 | 交付 | 关键验收断言 |
|------|------|-------------|
| P6-T1 | 世界层类型 + persona 起始盘 | persona 序关系；类型往返 |
| P6-T2 | EventLog 追加式 | **并发 append 不覆盖**；稳定排序；行原子 |
| P6-T3 | Projector 折叠 | 确定性；bounded memory ≤ budget；退化等价；影响力单调 |
| P6-T4 | WorldStore | 重启可读回；get_person_view 反映折叠；read_frames 有序 |
| P6-T5 | RunConfig 扩展 | 默认值；budget≥1 校验；退化构造合法 |
| P6-T6 | Run 缝 | 累积单调；写帧；**退化 run 不回归** |
| P6-T7 | self_memory 注入 | 注入生效；不注入回归一致 |
| P6-T8 | 世界/帧 API | 建世界/404/帧有序/退化 create_run 成功 |

## 完成标准
- 全部 8 Task 绿；`pytest -m "not llm and not llm_effect"` 全绿。
- 退化态（无 world_id）逐拍 snapshot 与接世界层前等价，真围观 seed 口径不回归。
- 回放帧契约 `GET /runs/{id}/frames` 可用（兼顾交接 P0 帧需求）。
- 无需任何 LLM key。

## 手测/LLM 说明
本计划无需 LLM key。若审核者希望真 LLM 复跑验证退化态不回归，列命令由用户代跑、采信回传，不打印 key。
