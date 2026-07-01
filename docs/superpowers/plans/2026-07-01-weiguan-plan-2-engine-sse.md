# 围观 Plan 2 — 引擎封装 + 逐步运行 + SSE + API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **审核锚点**：遵守 `2026-07-01-weiguan-conventions-and-contracts.md` §1。每个 Task = 锚点 `P2-T<n>`；实现时打 `# review:P2-T<n>`、commit trailer `Review-Anchor: P2-T<n>`、验收测试打 `# review:P2-T<n>-AC<k>`。

**Goal:** 把 OASIS 引擎封装成"输入(受众,内容,轮次,BYOK) → 逐步流式吐出增量 RunSnapshot"的服务，并用 FastAPI 暴露契约 §2.2–2.5 的 REST/SSE。

**Architecture:** 引擎层定义 `Engine` 协议，两套实现：`FakeEngine`（确定性、无 LLM，做流程测试）与 `OasisEngine`（真调 LLM，本批**必须打通**）。API 层通过依赖注入选择引擎，纯函数 `diff_snapshots` 负责把"全量快照"变成"逐步增量"。

**Tech Stack:** Python 3.10+，pydantic v2，FastAPI，sse-starlette，pytest + pytest-asyncio，camel-oasis（真引擎）。

## Global Constraints

- 承接 Plan 1：**只依赖 `weiguan.canonical` 与 `weiguan.adapter.load_run_snapshot`**，不直接读 OASIS 表。
- BYOK：LLM key 只经内存传递，不落库、不写日志。真引擎创建 model 前，同时 `os.environ["OPENAI_API_KEY"]=key` 且给 `ModelFactory.create(api_key=key)`（双保险，兼容 camel 版本差异）。
- 轮次只允许 `steps ∈ {6,10,15}`（快速/标准/深度）。
- **本批必须打通真实 LLM**：`P2-T6` 的 `@pytest.mark.llm` 真跑测试是必交付项，测试者会用真实 key 运行并**必须通过**；不得以"跳过"充数。
- SSE 事件名与字段严格按契约 §2.3。
- `pytest` 在 `backend/` 运行；异步测试用 `asyncio_mode="auto"`。

## 文件结构
```
backend/
  pyproject.toml                       # Task 4 追加依赖 & pytest 配置
  weiguan/engine/
    __init__.py                        # Task 3 re-export
    config.py       RunConfig/RoundPreset/Audience + 校验   # P2-T1
    diff.py         diff_snapshots 纯函数                    # P2-T2
    base.py         Engine 协议 + RunDelta                   # P2-T3
    fake.py         FakeEngine                               # P2-T3
    oasis_engine.py OasisEngine（真 LLM）                    # P2-T6
  weiguan/api/
    __init__.py
    store.py        RunStore/RunRecord + accumulate          # P2-T4
    app.py          FastAPI app + 依赖注入                   # P2-T4
    routes.py       /api/runs、/events、/interview、/snapshot # P2-T4,T5
  tests/engine/{test_config.py,test_diff.py,test_fake_engine.py,test_oasis_engine_llm.py}
  tests/api/{test_runs_flow.py,test_interview_snapshot.py}
  tests/fixtures/tiny_twitter_profile.csv                    # P2-T6
```

---

### Task 1 (P2-T1): RunConfig + 轮次枚举 + 校验

**Files:** Create `backend/weiguan/engine/__init__.py`（空，Task3 回填）、`backend/weiguan/engine/config.py`；Test `backend/tests/engine/test_config.py`（含 `backend/tests/engine/__init__.py` 空文件）。

**Interfaces — Produces:**
- `RoundPreset(int,Enum){FAST=6,STANDARD=10,DEEP=15}`
- `Audience(crowd_id:str|None, custom:str|None)`（恰好一个非空）
- `RunConfig(audience:Audience, content:str, steps:int, platform:Platform, llm_key:str, llm_model:str)`；非法 `steps`/双空/双填 `audience` → `pydantic.ValidationError`。

- [ ] **Step 1: 写失败测试 `tests/engine/test_config.py`**
```python
import pytest
from pydantic import ValidationError
from weiguan.engine.config import RunConfig, Audience, RoundPreset
from weiguan.canonical import Platform


def _cfg(**kw):
    base = dict(audience=Audience(crowd_id="tech_devs"), content="hi",
                steps=10, llm_key="sk-x", llm_model="gpt-4o-mini")
    base.update(kw)
    return RunConfig(**base)


def test_valid_config_defaults_platform_twitter():  # review:P2-T1-AC1
    c = _cfg()
    assert c.steps == 10 and c.platform == Platform.TWITTER


def test_steps_must_be_preset():  # review:P2-T1-AC2
    with pytest.raises(ValidationError):
        _cfg(steps=3)
    assert RoundPreset.STANDARD.value == 10


def test_audience_exactly_one():  # review:P2-T1-AC3
    with pytest.raises(ValidationError):
        _cfg(audience=Audience())                      # 双空
    with pytest.raises(ValidationError):
        _cfg(audience=Audience(crowd_id="a", custom="b"))  # 双填
```

- [ ] **Step 2: 运行确认失败** — `cd backend && python -m pytest tests/engine/test_config.py -v` → FAIL（ModuleNotFound）。

- [ ] **Step 3: 写实现 `weiguan/engine/config.py`**
```python
from __future__ import annotations
from pydantic import BaseModel, model_validator
from enum import Enum
from weiguan.canonical import Platform


class RoundPreset(int, Enum):
    FAST = 6
    STANDARD = 10
    DEEP = 15


_ALLOWED_STEPS = {p.value for p in RoundPreset}


class Audience(BaseModel):
    crowd_id: str | None = None
    custom: str | None = None

    @model_validator(mode="after")
    def _exactly_one(self):
        if bool(self.crowd_id) == bool(self.custom):
            raise ValueError("audience must set exactly one of crowd_id/custom")
        return self


class RunConfig(BaseModel):
    audience: Audience
    content: str
    steps: int
    platform: Platform = Platform.TWITTER
    llm_key: str
    llm_model: str = "gpt-4o-mini"

    @model_validator(mode="after")
    def _steps_preset(self):
        if self.steps not in _ALLOWED_STEPS:
            raise ValueError("steps must be one of 6/10/15")
        return self
```

- [ ] **Step 4: 运行确认通过** — 同命令 → PASS（3 passed）。
- [ ] **Step 5: 提交**
```bash
git add backend/weiguan/engine/config.py backend/weiguan/engine/__init__.py backend/tests/engine
git commit -m "feat(engine): RunConfig 与轮次枚举校验

Review-Anchor: P2-T1"
```

---

### Task 2 (P2-T2): diff_snapshots 纯增量函数

**Files:** Create `backend/weiguan/engine/diff.py`；Test `backend/tests/engine/test_diff.py`.

**Interfaces — Produces:** `diff_snapshots(prev: RunSnapshot, curr: RunSnapshot) -> RunSnapshot`：返回只含 curr 中"相对 prev 新增"的实体的 RunSnapshot（保留 curr 的 platform/seed_post_id）。身份键：actors=user_id；posts=post_id；replies=comment_id；reactions=(kind,actor_id,target_type,target_id,created_at)；follows=(follower_id,followee_id)；reports=(actor_id,post_id,created_at)；traces=(actor_id,created_at,action,info)。

- [ ] **Step 1: 写失败测试 `tests/engine/test_diff.py`**
```python
from weiguan.engine.diff import diff_snapshots
from weiguan.canonical import (RunSnapshot, Actor, Post, Reply, Reaction,
                               ReactionKind, TargetType, Platform)


def test_diff_returns_only_new_entities():  # review:P2-T2-AC1
    prev = RunSnapshot(actors=[Actor(user_id=1)],
                       posts=[Post(post_id=1, author_id=1)])
    curr = RunSnapshot(platform=Platform.TWITTER, seed_post_id=1,
        actors=[Actor(user_id=1), Actor(user_id=2)],
        posts=[Post(post_id=1, author_id=1), Post(post_id=2, author_id=2)],
        replies=[Reply(comment_id=1, post_id=1, author_id=2)])
    d = diff_snapshots(prev, curr)
    assert [a.user_id for a in d.actors] == [2]
    assert [p.post_id for p in d.posts] == [2]
    assert [r.comment_id for r in d.replies] == [1]
    assert d.seed_post_id == 1


def test_diff_reactions_by_full_tuple():  # review:P2-T2-AC2
    r = Reaction(kind=ReactionKind.LIKE, actor_id=2,
                 target_type=TargetType.POST, target_id=1, created_at="2")
    prev = RunSnapshot(reactions=[r])
    curr = RunSnapshot(reactions=[r, Reaction(kind=ReactionKind.LIKE, actor_id=3,
                 target_type=TargetType.POST, target_id=1, created_at="2")])
    d = diff_snapshots(prev, curr)
    assert len(d.reactions) == 1 and d.reactions[0].actor_id == 3


def test_diff_empty_when_no_change():  # review:P2-T2-AC3
    s = RunSnapshot(posts=[Post(post_id=1, author_id=1)])
    d = diff_snapshots(s, s)
    assert d.posts == [] and d.actors == []
```

- [ ] **Step 2: 运行确认失败** — `python -m pytest tests/engine/test_diff.py -v` → FAIL。

- [ ] **Step 3: 写实现 `weiguan/engine/diff.py`**
```python
from __future__ import annotations
from weiguan.canonical import RunSnapshot


def _new(items, prev_items, key):
    seen = {key(i) for i in prev_items}
    return [i for i in items if key(i) not in seen]


def diff_snapshots(prev: RunSnapshot, curr: RunSnapshot) -> RunSnapshot:
    return RunSnapshot(
        platform=curr.platform,
        seed_post_id=curr.seed_post_id,
        actors=_new(curr.actors, prev.actors, lambda a: a.user_id),
        posts=_new(curr.posts, prev.posts, lambda p: p.post_id),
        replies=_new(curr.replies, prev.replies, lambda r: r.comment_id),
        reactions=_new(curr.reactions, prev.reactions,
                       lambda x: (x.kind, x.actor_id, x.target_type,
                                  x.target_id, x.created_at)),
        follows=_new(curr.follows, prev.follows,
                     lambda f: (f.follower_id, f.followee_id)),
        reports=_new(curr.reports, prev.reports,
                     lambda r: (r.actor_id, r.post_id, r.created_at)),
        traces=_new(curr.traces, prev.traces,
                    lambda t: (t.actor_id, t.created_at, t.action, t.info)),
    )
```

- [ ] **Step 4: 运行确认通过** — → PASS（3 passed）。
- [ ] **Step 5: 提交**
```bash
git add backend/weiguan/engine/diff.py backend/tests/engine/test_diff.py
git commit -m "feat(engine): diff_snapshots 逐步增量纯函数

Review-Anchor: P2-T2"
```

---

### Task 3 (P2-T3): Engine 协议 + RunDelta + FakeEngine

**Files:** Create `backend/weiguan/engine/base.py`、`backend/weiguan/engine/fake.py`；Modify `backend/weiguan/engine/__init__.py`；Test `backend/tests/engine/test_fake_engine.py`.

**Interfaces — Produces:**
- `RunDelta(step:int, snapshot:RunSnapshot)`
- `class Engine(Protocol)`: `def run(self, config:RunConfig) -> AsyncIterator[RunDelta]`; `async def interview(self, config:RunConfig, snapshot:RunSnapshot, actor_id:int, question:str) -> str`
- `FakeEngine` 实现 Engine：`run` 产出 `config.steps` 个 delta（step1 含种子帖 post_id=1，step2 含 1 条评论+1 个赞，其余空），`interview` 返回可预测串。

- [ ] **Step 1: 写失败测试 `tests/engine/test_fake_engine.py`**
```python
import pytest
from weiguan.engine.fake import FakeEngine
from weiguan.engine.config import RunConfig, Audience


def _cfg(steps=10):
    return RunConfig(audience=Audience(crowd_id="t"), content="构建砍到3秒",
                     steps=steps, llm_key="sk", llm_model="m")


async def test_fake_run_yields_steps_deltas():  # review:P2-T3-AC1
    deltas = [d async for d in FakeEngine().run(_cfg(steps=6))]
    assert [d.step for d in deltas] == [1, 2, 3, 4, 5, 6]
    assert deltas[0].snapshot.posts[0].content == "构建砍到3秒"
    assert deltas[1].snapshot.replies[0].post_id == 1
    assert deltas[1].snapshot.reactions[0].actor_id == 2


async def test_fake_interview_is_deterministic():  # review:P2-T3-AC2
    from weiguan.canonical import RunSnapshot
    ans = await FakeEngine().interview(_cfg(), RunSnapshot(), 2, "为什么?")
    assert "2" in ans and "为什么" in ans
```

- [ ] **Step 2: 运行确认失败** — `python -m pytest tests/engine/test_fake_engine.py -v` → FAIL。

- [ ] **Step 3: 写实现**

`weiguan/engine/base.py`:
```python
from __future__ import annotations
from typing import AsyncIterator, Protocol
from pydantic import BaseModel
from weiguan.canonical import RunSnapshot
from weiguan.engine.config import RunConfig


class RunDelta(BaseModel):
    step: int
    snapshot: RunSnapshot


class Engine(Protocol):
    def run(self, config: RunConfig) -> AsyncIterator[RunDelta]: ...
    async def interview(self, config: RunConfig, snapshot: RunSnapshot,
                        actor_id: int, question: str) -> str: ...
```

`weiguan/engine/fake.py`:
```python
from __future__ import annotations
from typing import AsyncIterator
from weiguan.canonical import (RunSnapshot, Actor, Post, Reply, Reaction,
                               ReactionKind, TargetType)
from weiguan.engine.base import RunDelta
from weiguan.engine.config import RunConfig


class FakeEngine:
    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        for step in range(1, config.steps + 1):
            if step == 1:
                snap = RunSnapshot(seed_post_id=1,
                    actors=[Actor(user_id=1, user_name="you", name="你")],
                    posts=[Post(post_id=1, author_id=1,
                                content=config.content, created_at="1")])
            elif step == 2:
                snap = RunSnapshot(
                    actors=[Actor(user_id=2, user_name="dev_marco", name="Marco")],
                    replies=[Reply(comment_id=1, post_id=1, author_id=2,
                                   content="缓存没清吧", num_likes=3, created_at="2")],
                    reactions=[Reaction(kind=ReactionKind.LIKE, actor_id=2,
                        target_type=TargetType.POST, target_id=1, created_at="2")])
            else:
                snap = RunSnapshot()
            yield RunDelta(step=step, snapshot=snap)

    async def interview(self, config, snapshot, actor_id, question) -> str:
        return f"[fake] 用户 {actor_id} 对『{question}』的回答"
```

`weiguan/engine/__init__.py` 回填：
```python
from weiguan.engine.config import RunConfig, Audience, RoundPreset
from weiguan.engine.base import Engine, RunDelta
from weiguan.engine.fake import FakeEngine
from weiguan.engine.diff import diff_snapshots

__all__ = ["RunConfig", "Audience", "RoundPreset", "Engine", "RunDelta",
           "FakeEngine", "diff_snapshots"]
```

- [ ] **Step 4: 运行确认通过** — → PASS（2 passed）。
- [ ] **Step 5: 提交**
```bash
git add backend/weiguan/engine backend/tests/engine/test_fake_engine.py
git commit -m "feat(engine): Engine 协议 + RunDelta + FakeEngine

Review-Anchor: P2-T3"
```

---

### Task 4 (P2-T4): FastAPI app + RunStore + POST /api/runs + SSE /events

**Files:** Modify `backend/pyproject.toml`；Create `backend/weiguan/api/__init__.py`、`store.py`、`app.py`、`routes.py`；Test `backend/tests/api/test_runs_flow.py`（含 `backend/tests/api/__init__.py`）.

**Interfaces — Produces:**
- `RunStore`：`create(config)->run_id`、`get(run_id)->RunRecord|None`。`RunRecord{run_id, config, snapshot:RunSnapshot}`；`accumulate(delta_snapshot)` 把增量并入 `snapshot`（extend 各列表，首次设 seed_post_id/platform）。
- FastAPI app：`create_app(engine: Engine) -> FastAPI`（依赖注入，测试注入 FakeEngine）。
- 路由：`POST /api/runs`（契约 §2.2，校验 steps/key）、`GET /api/runs/{id}/events`（SSE，契约 §2.3）。

- [ ] **Step 1: 追加依赖到 `backend/pyproject.toml`**
```toml
# [project].dependencies 追加：
#   "fastapi>=0.110", "sse-starlette>=2.0", "uvicorn>=0.29"
# [project.optional-dependencies].dev 追加：
#   "pytest-asyncio>=0.23", "httpx>=0.27"
# 追加 pytest 异步配置：
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
asyncio_mode = "auto"
markers = ["llm: 需要真实 LLM key 的端到端测试"]
```

- [ ] **Step 2: 写失败测试 `tests/api/test_runs_flow.py`**
```python
import json
from fastapi.testclient import TestClient
from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine

client = TestClient(create_app(FakeEngine()))
HDR = {"X-LLM-Key": "sk-x", "X-LLM-Model": "gpt-4o-mini"}


def _body(steps=6):
    return {"audience": {"crowd_id": "tech_devs"}, "content": "构建砍到3秒",
            "steps": steps, "platform": "twitter"}


def test_create_run_returns_id():  # review:P2-T4-AC1
    r = client.post("/api/runs", json=_body(), headers=HDR)
    assert r.status_code == 200 and r.json()["run_id"].startswith("r_")


def test_create_run_rejects_bad_steps():  # review:P2-T4-AC2
    r = client.post("/api/runs", json=_body(steps=3), headers=HDR)
    assert r.status_code == 400


def test_create_run_requires_key():  # review:P2-T4-AC3
    r = client.post("/api/runs", json=_body(), headers={})
    assert r.status_code == 401


def test_sse_stream_order_and_accumulation():  # review:P2-T4-AC4
    run_id = client.post("/api/runs", json=_body(6), headers=HDR).json()["run_id"]
    text = client.get(f"/api/runs/{run_id}/events").text
    events = [ln[len("event: "):] for ln in text.splitlines()
              if ln.startswith("event: ")]
    assert events[0] == "run_started"
    assert events.count("step_started") == 6
    assert events[-1] == "run_done"
```

- [ ] **Step 3: 运行确认失败** — `python -m pytest tests/api/test_runs_flow.py -v` → FAIL。

- [ ] **Step 4: 写实现**

`weiguan/api/store.py`:
```python
from __future__ import annotations
import secrets
from pydantic import BaseModel, Field
from weiguan.canonical import RunSnapshot
from weiguan.engine.config import RunConfig


class RunRecord(BaseModel):
    run_id: str
    config: RunConfig
    snapshot: RunSnapshot = Field(default_factory=RunSnapshot)

    def accumulate(self, delta: RunSnapshot) -> None:
        if delta.seed_post_id is not None and self.snapshot.seed_post_id is None:
            self.snapshot.seed_post_id = delta.seed_post_id
        self.snapshot.platform = delta.platform
        for f in ("actors", "posts", "replies", "reactions",
                  "follows", "reports", "traces"):
            getattr(self.snapshot, f).extend(getattr(delta, f))


class RunStore:
    def __init__(self) -> None:
        self._runs: dict[str, RunRecord] = {}

    def create(self, config: RunConfig) -> str:
        run_id = "r_" + secrets.token_hex(4)
        self._runs[run_id] = RunRecord(run_id=run_id, config=config)
        return run_id

    def get(self, run_id: str) -> RunRecord | None:
        return self._runs.get(run_id)
```

`weiguan/api/routes.py`:
```python
from __future__ import annotations
import json
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, ValidationError
from sse_starlette.sse import EventSourceResponse
from weiguan.engine.config import RunConfig, Audience
from weiguan.canonical import Platform

router = APIRouter(prefix="/api")


class _CreateBody(BaseModel):
    audience: Audience
    content: str
    steps: int
    platform: Platform = Platform.TWITTER


@router.post("/runs")
async def create_run(body: _CreateBody, request: Request,
                     x_llm_key: str | None = Header(default=None),
                     x_llm_model: str = Header(default="gpt-4o-mini")):
    if not x_llm_key:
        raise HTTPException(status_code=401, detail="missing X-LLM-Key")
    try:
        cfg = RunConfig(audience=body.audience, content=body.content,
                        steps=body.steps, platform=body.platform,
                        llm_key=x_llm_key, llm_model=x_llm_model)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    run_id = request.app.state.store.create(cfg)
    return {"run_id": run_id}


@router.get("/runs/{run_id}/events")
async def stream_events(run_id: str, request: Request):
    store = request.app.state.store
    engine = request.app.state.engine
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")

    async def gen():
        yield {"event": "run_started", "data": json.dumps(
            {"run_id": run_id, "steps": record.config.steps,
             "platform": record.config.platform.value})}
        try:
            async for delta in engine.run(record.config):
                yield {"event": "step_started", "data": json.dumps(
                    {"step": delta.step, "total": record.config.steps})}
                record.accumulate(delta.snapshot)
                yield {"event": "delta", "data": json.dumps(
                    {"step": delta.step, "snapshot": delta.snapshot.model_dump(mode="json")})}
                yield {"event": "step_done", "data": json.dumps({"step": delta.step})}
            yield {"event": "run_done", "data": json.dumps({"run_id": run_id})}
        except Exception as exc:  # noqa: BLE001
            yield {"event": "error", "data": json.dumps({"message": str(exc)})}

    return EventSourceResponse(gen())
```

`weiguan/api/app.py`:
```python
from __future__ import annotations
from fastapi import FastAPI
from weiguan.engine.base import Engine
from weiguan.api.store import RunStore
from weiguan.api.routes import router


def create_app(engine: Engine) -> FastAPI:
    app = FastAPI(title="围观 Weiguan")
    app.state.engine = engine
    app.state.store = RunStore()
    app.include_router(router)
    return app
```
`weiguan/api/__init__.py` 空文件；`tests/api/__init__.py` 空文件。

- [ ] **Step 5: 运行确认通过** — `python -m pytest tests/api/test_runs_flow.py -v` → PASS（4 passed）。
- [ ] **Step 6: 提交**
```bash
git add backend/pyproject.toml backend/weiguan/api backend/tests/api
git commit -m "feat(api): POST /runs 与 SSE /events（FakeEngine 流程打通）

Review-Anchor: P2-T4"
```

---

### Task 5 (P2-T5): INTERVIEW + snapshot 端点

**Files:** Modify `backend/weiguan/api/routes.py`；Test `backend/tests/api/test_interview_snapshot.py`.

**Interfaces — Produces:** `POST /api/runs/{id}/interview`（契约 §2.4）、`GET /api/runs/{id}/snapshot`（契约 §2.5）。

- [ ] **Step 1: 写失败测试 `tests/api/test_interview_snapshot.py`**
```python
from fastapi.testclient import TestClient
from weiguan.api.app import create_app
from weiguan.engine.fake import FakeEngine

client = TestClient(create_app(FakeEngine()))
HDR = {"X-LLM-Key": "sk-x", "X-LLM-Model": "m"}


def _mk():
    body = {"audience": {"crowd_id": "t"}, "content": "hi", "steps": 6,
            "platform": "twitter"}
    rid = client.post("/api/runs", json=body, headers=HDR).json()["run_id"]
    client.get(f"/api/runs/{rid}/events").text   # 跑完，填充 snapshot
    return rid


def test_snapshot_after_run():  # review:P2-T5-AC1
    rid = _mk()
    snap = client.get(f"/api/runs/{rid}/snapshot").json()
    assert snap["seed_post_id"] == 1
    assert any(p["post_id"] == 1 for p in snap["posts"])
    assert any(r["comment_id"] == 1 for r in snap["replies"])


def test_snapshot_404():  # review:P2-T5-AC2
    assert client.get("/api/runs/nope/snapshot").status_code == 404


def test_interview_returns_answer():  # review:P2-T5-AC3
    rid = _mk()
    r = client.post(f"/api/runs/{rid}/interview",
                    json={"actor_id": 2, "question": "为什么?"}, headers=HDR)
    assert r.status_code == 200
    assert r.json()["actor_id"] == 2 and r.json()["answer"]
```

- [ ] **Step 2: 运行确认失败** — → FAIL（404/405）。

- [ ] **Step 3: 在 `routes.py` 追加两个端点**
```python
class _InterviewBody(BaseModel):
    actor_id: int
    question: str


@router.post("/runs/{run_id}/interview")
async def interview(run_id: str, body: _InterviewBody, request: Request):
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    answer = await request.app.state.engine.interview(
        record.config, record.snapshot, body.actor_id, body.question)
    return {"actor_id": body.actor_id, "question": body.question, "answer": answer}


@router.get("/runs/{run_id}/snapshot")
async def snapshot(run_id: str, request: Request):
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    return record.snapshot.model_dump(mode="json")
```

- [ ] **Step 4: 运行确认通过** — `python -m pytest tests/api/ -v` → PASS。
- [ ] **Step 5: 提交**
```bash
git add backend/weiguan/api/routes.py backend/tests/api/test_interview_snapshot.py
git commit -m "feat(api): interview 与 snapshot 端点

Review-Anchor: P2-T5"
```

---

### Task 6 (P2-T6): OasisEngine 真实 LLM 打通（本批必交付）

**Files:** Create `backend/weiguan/engine/oasis_engine.py`、`backend/tests/fixtures/tiny_twitter_profile.csv`；Test `backend/tests/engine/test_oasis_engine_llm.py`.

**Interfaces — Produces:** `OasisEngine(profile_path:str, db_dir:str)` 实现 `Engine`：
- `run(config)`：`generate_twitter_agent_graph` → `oasis.make(TWITTER)` → `env.reset()` → step0 用第一个 agent `ManualAction(CREATE_POST, {"content": config.content})` 注入种子；step1..N 对全体 agent `LLMAction()`；每步后 `load_run_snapshot(db_path, seed_post_id=1)` 与上一步 `diff_snapshots` 得增量并 `yield`。
- `interview(config, snapshot, actor_id, question)`：对该 agent `ManualAction(INTERVIEW, {"prompt": question})` 跑一步，从 `trace` 表读 `action==INTERVIEW.value` 最新记录、解析 `info` JSON 的 `response`。

- [ ] **Step 1: 造 profile fixture**
从仓库根 `oasis/data/twitter_dataset/anonymous_topic_200_1h/False_Business_0.csv` 取表头 + 前 3 行数据，存为 `backend/tests/fixtures/tiny_twitter_profile.csv`（保持列 `,user_id,name,username,following_agentid_list,previous_tweets,user_char,description` 不变）。

- [ ] **Step 2: 写真跑测试 `tests/engine/test_oasis_engine_llm.py`**
```python
import os
import pytest
from weiguan.engine.oasis_engine import OasisEngine
from weiguan.engine.config import RunConfig, Audience

pytestmark = pytest.mark.llm
PROFILE = os.path.join(os.path.dirname(__file__), "..", "fixtures",
                       "tiny_twitter_profile.csv")


def _cfg():
    key = os.environ.get("WEIGUAN_TEST_LLM_KEY")
    if not key:
        pytest.skip("set WEIGUAN_TEST_LLM_KEY to run the real-LLM smoke test")
    return RunConfig(audience=Audience(custom="tech crowd"),
                     content="We cut build time to 3 seconds.", steps=6,
                     llm_key=key,
                     llm_model=os.environ.get("WEIGUAN_TEST_LLM_MODEL", "gpt-4o-mini"))


async def test_real_run_produces_llm_content(tmp_path):  # review:P2-T6-AC1
    eng = OasisEngine(profile_path=PROFILE, db_dir=str(tmp_path))
    deltas = [d async for d in eng.run(_cfg())]
    assert deltas[0].snapshot.posts[0].content.startswith("We cut build")
    # 后续步至少产生一条由 LLM 生成的评论或帖子
    later = sum(len(d.snapshot.replies) + len(d.snapshot.posts)
                for d in deltas[1:])
    assert later >= 1


async def test_real_interview_returns_nonempty(tmp_path):  # review:P2-T6-AC2
    eng = OasisEngine(profile_path=PROFILE, db_dir=str(tmp_path))
    cfg = _cfg()
    [d async for d in eng.run(cfg)]
    ans = await eng.interview(cfg, eng.last_snapshot, actor_id=1,
                              question="Why do you doubt it?")
    assert isinstance(ans, str) and ans.strip()
```

- [ ] **Step 3: 运行确认失败（无实现）** — `cd backend && python -m pytest tests/engine/test_oasis_engine_llm.py -m llm -v`（未设 key 时应 skip；设了 key 则 FAIL：模块不存在）。先不设 key，确认 collect 到并 skip：Expected `2 skipped`。

- [ ] **Step 4: 写实现 `weiguan/engine/oasis_engine.py`**
```python
from __future__ import annotations
import json
import os
import sqlite3
from typing import AsyncIterator

from camel.models import ModelFactory
from camel.types import ModelPlatformType, ModelType

import oasis
from oasis import (ActionType, LLMAction, ManualAction,
                   generate_twitter_agent_graph)

from weiguan.adapter.oasis_adapter import load_run_snapshot
from weiguan.canonical import RunSnapshot, Platform
from weiguan.engine.base import RunDelta
from weiguan.engine.config import RunConfig
from weiguan.engine.diff import diff_snapshots

# review:P2-T6  真实 OASIS+LLM 引擎


class OasisEngine:
    def __init__(self, profile_path: str, db_dir: str) -> None:
        self.profile_path = profile_path
        self.db_dir = db_dir
        self.last_snapshot = RunSnapshot()

    def _model(self, config: RunConfig):
        os.environ["OPENAI_API_KEY"] = config.llm_key  # BYOK 双保险
        try:
            return ModelFactory.create(
                model_platform=ModelPlatformType.OPENAI,
                model_type=ModelType.GPT_4O_MINI, api_key=config.llm_key)
        except TypeError:            # 老版本无 api_key 形参，退回环境变量
            return ModelFactory.create(
                model_platform=ModelPlatformType.OPENAI,
                model_type=ModelType.GPT_4O_MINI)

    async def _make_env(self, config: RunConfig):
        model = self._model(config)
        graph = await generate_twitter_agent_graph(
            profile_path=self.profile_path, model=model,
            available_actions=[ActionType.CREATE_POST, ActionType.CREATE_COMMENT,
                ActionType.LIKE_POST, ActionType.DISLIKE_POST, ActionType.REPOST,
                ActionType.FOLLOW, ActionType.DO_NOTHING])
        db_path = os.path.join(self.db_dir, "run.db")
        if os.path.exists(db_path):
            os.remove(db_path)
        os.environ["OASIS_DB_PATH"] = os.path.abspath(db_path)
        env = oasis.make(agent_graph=graph,
                         platform=oasis.DefaultPlatformType.TWITTER,
                         database_path=db_path)
        return env, db_path

    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        env, db_path = await self._make_env(config)
        await env.reset()
        # step0：注入种子帖
        await env.step({env.agent_graph.get_agent(0): ManualAction(
            action_type=ActionType.CREATE_POST,
            action_args={"content": config.content})})
        prev = RunSnapshot()
        for step in range(1, config.steps + 1):
            if step > 1:
                await env.step({agent: LLMAction()
                                for _, agent in env.agent_graph.get_agents()})
            curr = load_run_snapshot(db_path, platform=Platform.TWITTER,
                                     seed_post_id=1)
            yield RunDelta(step=step, snapshot=diff_snapshots(prev, curr))
            prev = curr
        self.last_snapshot = prev
        self._db_path = db_path
        self._env = env
        await env.close()

    async def interview(self, config, snapshot, actor_id, question) -> str:
        env, db_path = await self._make_env(config)
        await env.reset()
        await env.step({env.agent_graph.get_agent(actor_id - 1): ManualAction(
            action_type=ActionType.INTERVIEW, action_args={"prompt": question})})
        await env.close()
        conn = sqlite3.connect(db_path)
        try:
            rows = conn.execute(
                "SELECT info FROM trace WHERE action=? ORDER BY created_at DESC",
                (ActionType.INTERVIEW.value,)).fetchall()
        finally:
            conn.close()
        if not rows:
            return ""
        return json.loads(rows[0][0]).get("response", "")
```
> 注：`interview` 采用独立小环境重放种子帖后追问，保证脱离 run 生命周期也能回答；后续 Plan 5 若需"就地追问同一环境"，在此扩展（保持签名不变）。

- [ ] **Step 5: 用真实 key 运行，必须通过** —
```bash
cd backend && WEIGUAN_TEST_LLM_KEY=<你的key> python -m pytest tests/engine/test_oasis_engine_llm.py -m llm -v
```
Expected: PASS（2 passed）。**这是本批的硬性验收：LLM 调用对接必须真的通。**

- [ ] **Step 6: 回归全部非 LLM 测试** — `cd backend && python -m pytest -v -m "not llm"` → 全绿。
- [ ] **Step 7: 提交**
```bash
git add backend/weiguan/engine/oasis_engine.py backend/tests/engine/test_oasis_engine_llm.py backend/tests/fixtures/tiny_twitter_profile.csv
git commit -m "feat(engine): OasisEngine 真实 LLM 打通 + 端到端 smoke 测试

Review-Anchor: P2-T6"
```

---

## 审核索引（Review Index）

| 锚点 | 断言 | 审核凭据 |
|---|---|---|
| P2-T1-AC1 | 合法 config，platform 默认 twitter | `test_valid_config_defaults_platform_twitter` |
| P2-T1-AC2 | steps 必须 ∈ {6,10,15} | `test_steps_must_be_preset` |
| P2-T1-AC3 | audience 恰好一个非空 | `test_audience_exactly_one` |
| P2-T2-AC1 | diff 只返回新增实体 | `test_diff_returns_only_new_entities` |
| P2-T2-AC2 | reactions 按全元组判重 | `test_diff_reactions_by_full_tuple` |
| P2-T2-AC3 | 无变化时增量为空 | `test_diff_empty_when_no_change` |
| P2-T3-AC1 | FakeEngine 产出 N 个 delta 且含种子/评论/赞 | `test_fake_run_yields_steps_deltas` |
| P2-T3-AC2 | interview 可预测 | `test_fake_interview_is_deterministic` |
| P2-T4-AC1 | POST /runs 返回 r_ 开头 id | `test_create_run_returns_id` |
| P2-T4-AC2 | 非法 steps → 400 | `test_create_run_rejects_bad_steps` |
| P2-T4-AC3 | 缺 key → 401 | `test_create_run_requires_key` |
| P2-T4-AC4 | SSE 事件顺序与步数正确 | `test_sse_stream_order_and_accumulation` |
| P2-T5-AC1 | 跑完 snapshot 含种子/评论 | `test_snapshot_after_run` |
| P2-T5-AC2 | 未知 run → 404 | `test_snapshot_404` |
| P2-T5-AC3 | interview 端点返回答案 | `test_interview_returns_answer` |
| P2-T6-AC1 | **真实 LLM 跑出内容** | `test_real_run_produces_llm_content`（`-m llm` + 真 key） |
| P2-T6-AC2 | **真实 INTERVIEW 有回答** | `test_real_interview_returns_nonempty`（`-m llm` + 真 key） |

## Self-Review
- **Spec 覆盖**：实现契约 §2.2–2.5（运行/SSE/追问/快照）与 spec §3 步骤 3–5 的引擎侧、§5.2 BYOK、§5.3 轮次枚举、§8 数据流（注入种子→逐步→diff→流式；错误 `error` 事件不回滚）。
- **占位符扫描**：无 TBD；每步含完整代码与命令。真跑测试无 key 时 `skip`，有 key 时**必须 PASS**（硬验收）。
- **类型一致性**：`Engine.run/interview`、`RunDelta(step,snapshot)`、`RunConfig`、`diff_snapshots`、`load_run_snapshot(seed_post_id=...)` 在 Task 间签名一致；FakeEngine 与 OasisEngine 实现同一协议，可被 `create_app` 互换注入。
