# P15 · 发起会话收束（launch 归一）实现计划

> **For agentic workers:** 实现者为 codex，按 superpowers:executing-plans 逐 Task TDD 执行。步骤用 `- [ ]` 勾选跟踪。设计真源 spec `docs/superpowers/specs/2026-07-07-weiguan-P15-launch-convergence-design.md`（契约见 §2）。

**Goal:** 把单平台发起收束为一等持久 Launch，读侧单源、前端全收敛到 launch 口径，消除 run/launch 双入口的历史层积。

**Architecture:** 单平台 `POST /api/runs` 提前 `ensure_world_for_run` 解析世界/身份→用解析后 config 建 run→补建真 Launch（铸新 `launch_...` id）→`runner.start`；runner 内部 `ensure_world_for_run` 因 config.world_id 已置而幂等复用。读侧 `/api/launches`、`/api/worlds` 只读 world_store launches，删读时合成与双 store 比对。启动期 idempotent 回填历史单 run。前端 History/发起跳转全走 launch 口径，删补丁式 run↔launch 互转。

**Tech Stack:** 后端 FastAPI/pydantic（venv `/home/sunrise/.virtualenvs/my-oasis-backend/bin/python`）；前端 React/Vite/TS/Tailwind/vitest。纯 `FakeEngine`/文件读 + msw/fixture mock，**无需 LLM key**。

## Global Constraints（每个 Task 隐含包含，逐字遵守）

1. **契约只追加**：不改既有响应形状；`POST /api/runs` 返回体只**追加** `launch_id`（保留 `run_id`）；`/api/launches`、`/api/worlds` 响应形状不变。P12 铁律。
2. **launch_id 铸新**：单平台 Launch 用 `f"launch_{uuid4().hex}"`，与 multi 一致；**不复用 run_id**。
3. **发起即 persist launch**：任一发起路径落真 Launch，无读时合成逃生口。
4. **配色单一真源**：本片基本不动样式；若触及，语义色只来自 `design/tokens.ts`，中性排版灰（`text-slate-*`、`bg-white`、`border-line`）按 spec §7.2 明文豁免。
5. **可见文案禁裸 ID**：世界名/身份名/作者名可见区对 `/[0-9a-f]{12,}/`、`/w_[0-9a-f]{6,}/` 零命中，测试 pin。
6. **心智词表**：禁 `agent/OASIS/仿真/工作台/后端/模型/微博客`；"步"→"拍"。
7. **TDD**：先失败测试→确认失败→最小实现→通过→commit；每 commit 带 `Review-Anchor: P15-T{n}`，代码打锚点，保留既有锚点。
8. **验收命令**：后端 `cd backend && /home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`；前端 `cd frontend && npx vitest run && npx tsc -b`。

---

## Task 1 · 单平台写侧归一（`POST /api/runs` 补建 Launch）

**Files:**
- Modify: `backend/weiguan/api/routes.py:708-744`（`create_run`）
- Test: `backend/tests/api/test_runs.py`（既有；追加用例）

**Interfaces:**
- Consumes: `ensure_world_for_run(store, config) -> tuple[World, Person]`（run_bridge，幂等 get-or-create）；`world_store.create_launch(Launch|dict) -> Launch`；`run_store.create(config) -> str`。
- Produces: `POST /api/runs` 返回 `{"run_id": str, "launch_id": str}`；单平台 Launch 落 `world_store`（`kind` 无字段，Launch 模型无 kind——单/多同结构，`platforms=[平台]`、`run_ids=[run_id]`）。

- [ ] **Step 1: 写失败测试**（单平台发起后 Launch 落库且返回 launch_id）

```python
# backend/tests/api/test_runs.py
def test_create_run_persists_single_launch(client):  # review:P15-T1
    resp = client.post("/api/runs", json={
        "audience": "general", "content": "测试内容", "steps": 6,
        "platform": "weibo", "poster_persona": "ordinary",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "run_id" in body and "launch_id" in body
    assert body["launch_id"].startswith("launch_")
    # /api/launches 现应含该 launch，来自真 Launch（run_ids 恰含此 run）
    launches = client.get("/api/launches").json()["launches"]
    match = [l for l in launches if l["launch_id"] == body["launch_id"]]
    assert len(match) == 1
    assert match[0]["run_ids"] == [body["run_id"]]
    assert match[0]["platforms"] == ["weibo"]
```

- [ ] **Step 2: 跑测试确认失败**

Run: `/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest backend/tests/api/test_runs.py::test_create_run_persists_single_launch -v`
Expected: FAIL（返回体无 `launch_id`；`/api/launches` 里该项 `launch_id == run_id` 而非 `launch_`）

- [ ] **Step 3: 最小实现**（`create_run` 提前解析世界 + 补建 Launch）

在 `routes.py` `create_run` 内，把 `cfg` 构造后、`store.create` 前后改为（`# review:P15-T1`）：

```python
    world_store = request.app.state.world_store
    world, person = ensure_world_for_run(world_store, cfg)  # review:P15-T1 提前解析，令 runner 内幂等
    cfg = cfg.model_copy(update={"world_id": world.world_id, "poster_person_id": person.person_id})
    run_id = request.app.state.store.create(cfg)
    launch_id = f"launch_{uuid4().hex}"
    world_store.create_launch(
        Launch(
            launch_id=launch_id,
            world_id=world.world_id,
            content=cfg.content,
            steps=cfg.steps,
            platforms=[cfg.platform],
            run_ids=[run_id],
            status="running",
            poster_person_id=person.person_id,
            poster_persona=cfg.poster_persona,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    )
    request.app.state.runner.start(run_id)
    return {"run_id": run_id, "launch_id": launch_id}
```

确认 `routes.py` 顶部已 import `ensure_world_for_run`、`Launch`、`uuid4`、`datetime, timezone`（multi-run 已用，应齐；缺则补）。

- [ ] **Step 4: 跑测试确认通过**

Run: `/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest backend/tests/api/test_runs.py -v`
Expected: PASS（新用例 + 既有 create_run 用例不回归；若既有用例断言返回体等于 `{"run_id": ...}` 精确相等，改为包含式断言 `body["run_id"]`）

- [ ] **Step 5: 提交**

```bash
git add backend/weiguan/api/routes.py backend/tests/api/test_runs.py
git commit -m "feat(weiguan): 单平台发起补建持久 Launch

Review-Anchor: P15-T1
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 · 读侧单源（删读时合成 + 双 store 比对）

**Files:**
- Modify: `backend/weiguan/api/routes.py`（`list_launches` 614-627、`_world_summary` 339-382、删 `_single_launch_summary` 296-310、按需删 `_latest_run_item` 329）
- Test: `backend/tests/api/test_launches.py`、`backend/tests/api/test_worlds.py`（既有；追加/改）

**Interfaces:**
- Consumes: `world_store.list_all_launches() -> list[Launch]`（只含 persistent 世界，降序）。
- Produces: `/api/launches` 只读 world_store；`/api/worlds` 每项 `latest` 单源自 launch。响应形状不变。

- [ ] **Step 1: 写失败测试**（launches 不再依赖 run_store 合成）

```python
# backend/tests/api/test_launches.py
def test_launches_single_source_no_run_synthesis(client):  # review:P15-T2
    # 单平台发起后，/api/launches 该项 launch_id 为 launch_ 前缀（真 Launch），非裸 run_id
    body = client.post("/api/runs", json={
        "audience": "general", "content": "只读单源", "steps": 6,
        "platform": "weibo", "poster_persona": "ordinary",
    }).json()
    launches = client.get("/api/launches").json()["launches"]
    ids = {l["launch_id"] for l in launches}
    assert body["launch_id"] in ids
    assert body["run_id"] not in ids  # 不再有 launch_id==run_id 的合成项
```

- [ ] **Step 2: 跑测试确认失败**

Run: `/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest backend/tests/api/test_launches.py::test_launches_single_source_no_run_synthesis -v`
Expected: FAIL（`list_launches` 仍 `extend(_single_launch_summary(...))`，run_id 出现在 ids 中）

- [ ] **Step 3: 最小实现**（删合成半 + 简化 latest）

`list_launches`（`routes.py:614`）改为（`# review:P15-T2`）：

```python
@router.get("/launches")
def list_launches(request: Request):  # review:P15-T2
    launches = [
        _multi_launch_summary(launch)
        for launch in request.app.state.world_store.list_all_launches()
    ]
    return {
        "launches": sorted(launches, key=lambda item: item["created_at"], reverse=True)
    }
```

删除 `_single_launch_summary`（296-310）整个函数。

`_world_summary`（339-382）内 latest 分支（`# review:P15-T2`）简化为仅 launch：

```python
    latest = _latest_launch_item(latest_launch) if latest_launch is not None else None
```

删除 `latest_record`、`records`（若仅服务此比对）及 `_latest_run_item`（329，仅此处引用则删；`rg "_latest_run_item"` 确认无他处引用再删）。`run_count` 等统计若原读 run_store 可保留（不属"双读拼装"，latest 已单源）。

- [ ] **Step 4: 跑测试确认通过 + 全后端零回归**

Run: `/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest -m "not llm and not llm_effect" -q`
Expected: PASS（含 test_worlds latest 用例；若既有 world 用例断言 latest 来自 run，改为断言来自 launch）
Run: `cd backend && rg -n "_single_launch_summary" weiguan/`
Expected: 零命中

- [ ] **Step 5: 提交**

```bash
git add backend/weiguan/api/routes.py backend/tests/api/test_launches.py backend/tests/api/test_worlds.py
git commit -m "refactor(weiguan): launches/worlds 读侧单源，退役 run 合成

Review-Anchor: P15-T2
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 · idempotent 回填迁移（历史单 run → Launch）

**Files:**
- Create: `backend/weiguan/world/backfill.py`
- Modify: 应用启动装配处（`backend/weiguan/api/app.py` 或等价 `create_app`，调用迁移一次）
- Test: `backend/tests/world/test_backfill.py`

**Interfaces:**
- Consumes: `run_store.list() -> list[RunRecord]`；`world_store.list_all_launches()`；`world_store.create_launch(...)`。
- Produces: `backfill_single_launches(run_store, world_store) -> int`（返回新建 Launch 数；幂等）。

- [ ] **Step 1: 写失败测试**（回填 + 幂等）

```python
# backend/tests/world/test_backfill.py
def test_backfill_creates_missing_single_launches(run_store, world_store):  # review:P15-T3
    # 造 1 条已解析 world_id 但无 Launch 的单 run
    world = world_store.create_world(persistent=True, name=None)
    cfg = _run_config(world_id=world.world_id, platform="weibo", content="历史内容")
    run_id = run_store.create(cfg)
    from weiguan.world.backfill import backfill_single_launches
    created = backfill_single_launches(run_store, world_store)
    assert created == 1
    launches = world_store.list_all_launches()
    assert any(run_id in l.run_ids for l in launches)
    # 幂等：再跑不重复建
    assert backfill_single_launches(run_store, world_store) == 0

def test_backfill_skips_runs_without_world(run_store, world_store):  # review:P15-T3
    cfg = _run_config(world_id=None, platform="weibo", content="无世界")
    run_store.create(cfg)
    from weiguan.world.backfill import backfill_single_launches
    assert backfill_single_launches(run_store, world_store) == 0
```

- [ ] **Step 2: 跑测试确认失败**

Run: `/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest backend/tests/world/test_backfill.py -v`
Expected: FAIL（`ModuleNotFoundError: weiguan.world.backfill`）

- [ ] **Step 3: 最小实现**

```python
# backend/weiguan/world/backfill.py
"""P15-T3：把历史单 run 幂等回填为一等 Launch，使读侧单源成立。"""
from uuid import uuid4
from datetime import datetime, timezone

from .models import Launch


def backfill_single_launches(run_store, world_store) -> int:  # review:P15-T3
    covered: set[str] = set()
    for launch in world_store.list_all_launches():
        covered.update(launch.run_ids)
    created = 0
    for record in run_store.list():
        if record.run_id in covered:
            continue
        world_id = record.config.world_id
        if not world_id:
            continue  # 无世界的 run 无法归属 launch，跳过（已授权）
        world_store.create_launch(
            Launch(
                launch_id=f"launch_{uuid4().hex}",
                world_id=world_id,
                content=record.config.content,
                steps=record.config.steps,
                platforms=[record.config.platform],
                run_ids=[record.run_id],
                status=record.status,
                poster_person_id=record.config.poster_person_id,
                poster_persona=record.config.poster_persona,
                created_at=record.created_at,
            )
        )
        covered.add(record.run_id)
        created += 1
    return created
```

启动装配处调用一次（`# review:P15-T3`），置于 store/world_store 就绪之后：

```python
    from weiguan.world.backfill import backfill_single_launches
    backfill_single_launches(app.state.store, app.state.world_store)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `/home/sunrise/.virtualenvs/my-oasis-backend/bin/python -m pytest backend/tests/world/test_backfill.py -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/weiguan/world/backfill.py backend/weiguan/api/app.py backend/tests/world/test_backfill.py
git commit -m "feat(weiguan): 启动期幂等回填历史单 run 为 Launch

Review-Anchor: P15-T3
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 · 前端 History 单源（删双读拼装 + 补丁互转）

**Files:**
- Modify: `frontend/src/api/client.ts`（`fetchLaunches` 删 `launchFromRun` 兼容分支、删 `launchFromRun`、`createRun` 返回类型加 `launch_id`）
- Modify: `frontend/src/screens/HistoryScreen.tsx:146`（删 `fetchRuns` 双读）
- Test: `frontend/src/screens/HistoryScreen.test.tsx`

**Interfaces:**
- Consumes: `fetchLaunches(): Promise<LaunchSummary[]>`（只读 `/api/launches` 的 `{launches}`）。
- Produces: `createRun(...) : Promise<{ run_id: string; launch_id: string }>`。

- [ ] **Step 1: 写失败测试**（History 只经 launches 渲染，不依赖 /api/runs）

```tsx
// frontend/src/screens/HistoryScreen.test.tsx —— 追加/改：mock 仅提供 /api/launches
it("renders history from launches without reading /api/runs", async () => {  // review:P15-T4
  const runsSpy = vi.fn();
  server.use(
    http.get("/api/runs", () => { runsSpy(); return HttpResponse.json({ runs: [] }); }),
    http.get("/api/launches", () => HttpResponse.json({ launches: [sampleLaunch] })),
  );
  renderHistory();
  await screen.findByText(sampleLaunch.content);
  expect(runsSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/screens/HistoryScreen.test.tsx -t "without reading"`
Expected: FAIL（`runsSpy` 被调用——`HistoryScreen:146` 仍 `Promise.all([fetchRuns(), fetchLaunches()])`）

- [ ] **Step 3: 最小实现**

`HistoryScreen.tsx:146` 改为单读（`// review:P15-T4`）：

```tsx
    fetchLaunches()
      .then((launches) => { /* 既有 setState，去掉 runs 参数与合并逻辑 */ })
      .catch(/* 既有 */);
```

删除该组件内所有"runs 无则用 launches / launches 无则包 runs"合并分支及 `fetchRuns` import（若 History 独用）。

`client.ts`：删 `launchFromRun`（222-238）与 `fetchLaunches` 内数组兼容分支（`// review:P15-T4`）：

```ts
export async function fetchLaunches(): Promise<LaunchSummary[]> {  // review:P15-T4
  const response = await fetch("/api/launches");
  if (!response.ok) throw new Error("failed to load launches");
  const data = await response.json();
  return Array.isArray(data.launches) ? data.launches : [];
}
```

`createRun` 返回类型改 `Promise<{ run_id: string; launch_id: string }>`。

- [ ] **Step 4: 跑测试确认通过 + tsc**

Run: `cd frontend && npx vitest run src/screens/HistoryScreen.test.tsx && npx tsc -b`
Expected: PASS，tsc exit 0
Run: `cd frontend && rg -n "fetchRuns" src/screens/HistoryScreen.tsx`
Expected: 零命中

- [ ] **Step 5: 提交**

```bash
git add frontend/src/api/client.ts frontend/src/screens/HistoryScreen.tsx frontend/src/screens/HistoryScreen.test.tsx
git commit -m "refactor(weiguan): History 单源读 launches，删 run 双读与互转补丁

Review-Anchor: P15-T4
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 · 前端发起跳转统一 launch 口径

**Files:**
- Modify: `frontend/src/screens/ComposeScreen.tsx:253-286`
- Modify: `frontend/src/api/client.ts`（`createMultiRun` 返回类型加 `launch_id`）
- Test: `frontend/src/screens/ComposeScreen.test.tsx`

**Interfaces:**
- Consumes: `createRun -> {run_id, launch_id}`、`createMultiRun -> {world_id, run_ids, launch_id}`。
- Produces: 单平台跳 `/run/{run_id}/live?launch={launch_id}`；多平台跳 `/world/{world_id}/live?launch={launch_id}&run_id=...`。

- [ ] **Step 1: 写失败测试**（单平台提交跳转带 launch 参数）

```tsx
// ComposeScreen.test.tsx —— 追加：mock createRun 返回 launch_id，断言 navigate URL
it("navigates single-platform launch with launch id", async () => {  // review:P15-T5
  server.use(http.post("/api/runs", () =>
    HttpResponse.json({ run_id: "r1", launch_id: "launch_abc" })));
  renderCompose();
  // ...填内容、单平台、提交（复用既有交互 helper）
  await waitFor(() =>
    expect(navigateSpy).toHaveBeenCalledWith("/run/r1/live?launch=launch_abc"));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/screens/ComposeScreen.test.tsx -t "launch id"`
Expected: FAIL（现跳 `/run/r1/live` 无 `?launch=`）

- [ ] **Step 3: 最小实现**

`ComposeScreen.tsx` 单平台分支（286，`// review:P15-T5`）：

```tsx
      const { run_id, launch_id } = await createRun(/* 既有 */);
      navigate(`/run/${run_id}/live?launch=${launch_id}`);
```

多平台分支（253-270，`// review:P15-T5`）在既有 query 基础上前置 `launch`：

```tsx
      const { world_id, run_ids, launch_id } = await createMultiRun(/* 既有 */);
      const query = new URLSearchParams();
      query.set("launch", launch_id);
      for (const runId of run_ids) query.append("run_id", runId);
      navigate(`/world/${world_id}/live?${query.toString()}`);
```

`client.ts` `createMultiRun` 返回类型加 `launch_id: string`。

- [ ] **Step 4: 跑测试确认通过 + tsc**

Run: `cd frontend && npx vitest run src/screens/ComposeScreen.test.tsx && npx tsc -b`
Expected: PASS，tsc exit 0（既有多平台跳转用例若断言精确 URL，同步补 `launch=`）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/screens/ComposeScreen.tsx frontend/src/api/client.ts frontend/src/screens/ComposeScreen.test.tsx
git commit -m "feat(weiguan): 发起跳转统一 launch 口径

Review-Anchor: P15-T5
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6 · 端到端接线验收清单落 manual（dogfood conventions §5）

**Files:**
- Create: `docs/manual/2026-07-07-weiguan-P15-launch-convergence-manual.md`
- 截图：`docs/manual/assets/2026-07-07-P15/`（Playwright，发起→现场→历史→复盘四态，desktop+mobile）

**Interfaces:** 无代码接口；产物为审核凭据。

- [ ] **Step 1: 补齐 manual**，含：三绿输出（后端 pytest、前端 vitest、tsc）、`rg` 零命中证据（`_single_launch_summary`、HistoryScreen `fetchRuns`）、以及**端到端接线验收表**：

| 路径（从 → 到） | 入口 | 接线验收凭据 |
|---|---|---|
| 发起页（单）→ launch | 提交返回 launch_id，跳 `/run/:runId/live?launch=` | `test_create_run_persists_single_launch` + `ComposeScreen.test.tsx` |
| 发起页（多）→ launch | 跳 `/world/:worldId/live?launch=` | 既有多平台提交测试 + P15-T5 用例 |
| 历史 → launch → 复盘 | 历史条目按 launch_id 入复盘 | `HistoryScreen.test.tsx` 单源 + 复盘链路 |
| 世界 → launch → live | 世界卡 latest.launch_id 进现场 | `test_worlds` latest 单源 launch |

三硬校验逐条勾：入口连通 / 无死胡同 / 可见区对 `/[0-9a-f]{12,}/`、`/w_[0-9a-f]{6,}/` 零命中。

- [ ] **Step 2: 提交**

```bash
git add docs/manual/2026-07-07-weiguan-P15-launch-convergence-manual.md docs/manual/assets/2026-07-07-P15/
git commit -m "docs(weiguan): P15 端到端接线验收 manual

Review-Anchor: P15-T6
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Review Index（审核索引表）

| 锚点 | 断言（这条要保证什么） | 审核凭据（测试名 / 命令 / 文件） |
|---|---|---|
| P15-T1 | 单平台发起落真 Launch（launch_ 前缀、run_ids=[run_id]），返回追加 launch_id | `test_create_run_persists_single_launch` |
| P15-T2 | `/api/launches`、`/api/worlds` 读侧单源，run 合成退役 | `test_launches_single_source_no_run_synthesis`；`rg _single_launch_summary` 零命中 |
| P15-T3 | 历史单 run 幂等回填，无世界 run 跳过 | `test_backfill_creates_missing_single_launches`、`test_backfill_skips_runs_without_world` |
| P15-T4 | History 单源读 launches，无 run 双读/互转补丁 | `HistoryScreen.test.tsx` "without reading /api/runs"；`rg fetchRuns HistoryScreen.tsx` 零命中 |
| P15-T5 | 单/多发起跳转均带 launch_id | `ComposeScreen.test.tsx` "navigates ... launch id" |
| P15-T6 | 端到端四路径接线连通、无死胡同、可见区无裸 ID | manual 接线验收表 + 三绿 + rg 证据 |

## 端到端接线验收表（conventions §5）

见 Task 6 表；四条产品路径逐条列入口凭据 + 三硬校验，落 manual。

## 非目标（YAGNI）

- 不合并 `POST /api/runs` 与 `/multi-runs` 成单一发起端点。
- 不承诺旧 run 复盘旧链路可达（铸新 id 令旧链路失联，已授权）。
- 不动 `/api/runs/{run_id}/*` 技术端点形状、仿真质量、SSE、虚拟列表。

## 验收（整片）

- 后端：`pytest -m "not llm and not llm_effect"` 全绿；`rg _single_launch_summary weiguan/` 零命中。
- 前端：`vitest` + `tsc`；`rg fetchRuns src/screens/HistoryScreen.tsx` 零命中；单/多跳转带 launch_id。
- e2e（用户代跑）：单平台发起 → `/api/launches` 出现该 launch → 历史可见 → 复盘可达；世界卡 latest 来自 launch。
