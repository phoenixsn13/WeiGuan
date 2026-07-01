# 围观 Plan 4 — 圈子画廊 + 自定义受众 + BYOK + 发起运行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **审核锚点**：遵守 `2026-07-01-weiguan-conventions-and-contracts.md` §1。每个 Task = 锚点 `P4-T<n>`；实现打 `# review:P4-T<n>`/`// review:P4-T<n>`、commit trailer `Review-Anchor: P4-T<n>`、验收测试打 `-AC<k>`。

**Goal:** 让用户能"选圈子/自定义受众 → BYOK → 写内容 → 选轮次 → 开始围观"，把请求经契约 §2.2 发起，成功后跳到进行时页。

**Architecture:** 后端加"圈子注册表"（curated OASIS profile 包 + `GET /api/crowds`）、"路由引擎 RoutingEngine"（按 audience 解析 profile 后委派 OasisEngine，路由逻辑可注入、免 LLM 测）、"自定义人群生成"（LLM 把一句话描述变成 OASIS profile CSV）。前端加 BYOK（localStorage）、API 客户端、画廊屏、写内容屏。

**Tech Stack:** 后端 Python/FastAPI + openai SDK（自定义人群生成）；前端 React/TS/Tailwind + Vitest（mock fetch）。

## Global Constraints
- 承接 Plan 2（引擎/契约 §2.2）、Plan 3（LiveScreen 路由 `/run/:id/live`）、Plan F0（壳/tokens/占位屏）。
- **不改 Plan 2 的 `OasisEngine` 构造签名**：多圈子经新增 `RoutingEngine` 实现，`create_app` 仍注入单一 Engine。
- BYOK：key 存前端 `localStorage`，请求时放 `X-LLM-Key` 头；后端不落库（已由 Plan 2 保证）。
- 轮次前端只给 6/10/15 三选一（快速/标准/深度）。
- 自定义人群生成是真 LLM 任务，测试用 `@pytest.mark.llm`（有 key 必过、无 key skip）。

## 文件结构
```
backend/weiguan/
  engine/crowds.py         数据 backend/weiguan/data/crowds/*.csv     # P4-T1
  engine/routing.py                                                   # P4-T2
  engine/custom_profile.py                                            # P4-T3
  api/routes.py  (追加 GET /api/crowds)                               # P4-T1
tests/engine/{test_crowds.py,test_routing.py,test_custom_profile_llm.py}
frontend/src/
  api/useApiKey.ts   api/client.ts   api/client.test.ts               # P4-T4
  screens/GalleryScreen.tsx  screens/GalleryScreen.test.tsx           # P4-T5
  screens/ComposeScreen.tsx  screens/ComposeScreen.test.tsx           # P4-T6
```

---

### Task 1 (P4-T1): 圈子注册表 + GET /api/crowds

**Files:** Create `backend/weiguan/engine/crowds.py`、`backend/weiguan/data/crowds/{tech_devs,fan_circle,finance_snark,parenting_moms,hardcore_gamers}.csv`；Modify `backend/weiguan/api/routes.py`；Test `backend/tests/engine/test_crowds.py`.

**Interfaces — Produces:**
- `Crowd(id:str, name:str, emoji:str, blurb:str, profile_file:str)`
- `CROWDS: list[Crowd]`（下述 5 个）
- `crowd_profile_path(crowd_id:str) -> str`（绝对路径；未知 id → `KeyError`）
- `list_crowds() -> list[dict]`（仅 id/name/emoji/blurb，供 API）
- `GET /api/crowds` → `list_crowds()`

- [ ] **Step 1: 造 5 个圈子 profile CSV**
从仓库根 `oasis/data/twitter_dataset/anonymous_topic_200_1h/False_Business_0.csv` 及同目录其它 csv，各切 ~60 行，保持表头 `,user_id,name,username,following_agentid_list,previous_tweets,user_char,description` 不变，另存为下列文件（可按主题微调 `user_char/description` 文案，但列不变）：
`backend/weiguan/data/crowds/tech_devs.csv`、`fan_circle.csv`、`finance_snark.csv`、`parenting_moms.csv`、`hardcore_gamers.csv`。

- [ ] **Step 2: 写失败测试 `tests/engine/test_crowds.py`**
```python
import os
import pytest
from weiguan.engine.crowds import CROWDS, crowd_profile_path, list_crowds


def test_five_crowds_registered():  # review:P4-T1-AC1
    ids = {c.id for c in CROWDS}
    assert {"tech_devs", "fan_circle", "finance_snark",
            "parenting_moms", "hardcore_gamers"} <= ids


def test_profile_path_exists_and_has_header():  # review:P4-T1-AC2
    p = crowd_profile_path("tech_devs")
    assert os.path.exists(p)
    with open(p, encoding="utf-8") as f:
        header = f.readline()
    assert "user_id" in header and "username" in header


def test_unknown_crowd_raises():  # review:P4-T1-AC3
    with pytest.raises(KeyError):
        crowd_profile_path("nope")


def test_list_crowds_hides_profile_file():  # review:P4-T1-AC4
    item = next(c for c in list_crowds() if c["id"] == "fan_circle")
    assert set(item) == {"id", "name", "emoji", "blurb"}
```

- [ ] **Step 3: 运行确认失败** — `cd backend && python -m pytest tests/engine/test_crowds.py -v` → FAIL。

- [ ] **Step 4: 写实现 `weiguan/engine/crowds.py`**
```python
# review:P4-T1
from __future__ import annotations
import os
from pydantic import BaseModel

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "crowds")


class Crowd(BaseModel):
    id: str
    name: str
    emoji: str
    blurb: str
    profile_file: str


CROWDS: list[Crowd] = [
    Crowd(id="tech_devs", name="科技程序员群", emoji="👨‍💻", blurb="毒舌、较真、爱抬杠", profile_file="tech_devs.csv"),
    Crowd(id="fan_circle", name="饭圈", emoji="🌟", blurb="上头、护崽、情绪足", profile_file="fan_circle.csv"),
    Crowd(id="finance_snark", name="财经吐槽", emoji="📉", blurb="嘴碎、看空、爱唱反调", profile_file="finance_snark.csv"),
    Crowd(id="parenting_moms", name="育儿妈妈", emoji="🍼", blurb="细腻、共情、重细节", profile_file="parenting_moms.csv"),
    Crowd(id="hardcore_gamers", name="硬核玩家", emoji="🎮", blurb="硬核、挑刺、看参数", profile_file="hardcore_gamers.csv"),
]

_BY_ID = {c.id: c for c in CROWDS}


def crowd_profile_path(crowd_id: str) -> str:
    crowd = _BY_ID[crowd_id]  # KeyError if unknown
    return os.path.abspath(os.path.join(_DATA_DIR, crowd.profile_file))


def list_crowds() -> list[dict]:
    return [{"id": c.id, "name": c.name, "emoji": c.emoji, "blurb": c.blurb}
            for c in CROWDS]
```

- [ ] **Step 5: 在 `weiguan/api/routes.py` 追加端点**
```python
from weiguan.engine.crowds import list_crowds  # 顶部 import

@router.get("/crowds")
async def crowds():  # review:P4-T1
    return list_crowds()
```

- [ ] **Step 6: 运行确认通过** — `python -m pytest tests/engine/test_crowds.py -v` → PASS（4 passed）。
- [ ] **Step 7: 提交**
```bash
git add backend/weiguan/engine/crowds.py backend/weiguan/data backend/weiguan/api/routes.py backend/tests/engine/test_crowds.py
git commit -m "feat(engine): 圈子注册表 + GET /api/crowds

Review-Anchor: P4-T1"
```

---

### Task 2 (P4-T2): RoutingEngine（按受众解析 profile 后委派）

**Files:** Create `backend/weiguan/engine/routing.py`；Test `backend/tests/engine/test_routing.py`.

**Interfaces — Produces:**
- `RoutingEngine(resolve_profile: Callable[[RunConfig], str], engine_builder: Callable[[str], Engine])` 实现 `Engine`：`run`/`interview` 先 `resolve_profile(config)` 得 profile 路径，再 `engine_builder(path)` 造子引擎并委派。
- `make_resolver(workdir:str, key_to_custom) -> Callable`：crowd_id → `crowd_profile_path`；custom → 调 `key_to_custom(config, workdir)` 生成（Task3 提供）。

- [ ] **Step 1: 写失败测试 `tests/engine/test_routing.py`**
```python
from weiguan.engine.routing import RoutingEngine
from weiguan.engine.fake import FakeEngine
from weiguan.engine.config import RunConfig, Audience


def _cfg(**kw):
    base = dict(audience=Audience(crowd_id="tech_devs"), content="hi",
                steps=6, llm_key="sk", llm_model="m")
    base.update(kw)
    return RunConfig(**base)


async def test_routing_resolves_and_delegates():  # review:P4-T2-AC1
    built = {}
    eng = RoutingEngine(
        resolve_profile=lambda c: f"/p/{c.audience.crowd_id}.csv",
        engine_builder=lambda p: built.setdefault("path", p) and FakeEngine() or FakeEngine())
    deltas = [d async for d in eng.run(_cfg())]
    assert built["path"] == "/p/tech_devs.csv"
    assert deltas[0].snapshot.posts[0].content == "hi"


async def test_routing_interview_delegates():  # review:P4-T2-AC2
    from weiguan.canonical import RunSnapshot
    eng = RoutingEngine(resolve_profile=lambda c: "/p/x.csv",
                        engine_builder=lambda p: FakeEngine())
    ans = await eng.interview(_cfg(), RunSnapshot(), 2, "为什么?")
    assert "2" in ans
```

- [ ] **Step 2: 运行确认失败** — `python -m pytest tests/engine/test_routing.py -v` → FAIL。

- [ ] **Step 3: 写实现 `weiguan/engine/routing.py`**
```python
# review:P4-T2
from __future__ import annotations
import os
from typing import AsyncIterator, Callable
from weiguan.canonical import RunSnapshot
from weiguan.engine.base import Engine, RunDelta
from weiguan.engine.config import RunConfig
from weiguan.engine.crowds import crowd_profile_path


class RoutingEngine:
    def __init__(self, resolve_profile: Callable[[RunConfig], str],
                 engine_builder: Callable[[str], Engine]) -> None:
        self._resolve = resolve_profile
        self._build = engine_builder

    async def run(self, config: RunConfig) -> AsyncIterator[RunDelta]:
        engine = self._build(self._resolve(config))
        async for delta in engine.run(config):
            yield delta

    async def interview(self, config: RunConfig, snapshot: RunSnapshot,
                        actor_id: int, question: str) -> str:
        engine = self._build(self._resolve(config))
        return await engine.interview(config, snapshot, actor_id, question)


def make_resolver(workdir: str,
                  custom_generator: Callable[[RunConfig, str], str]) -> Callable[[RunConfig], str]:
    def resolve(config: RunConfig) -> str:
        if config.audience.crowd_id:
            return crowd_profile_path(config.audience.crowd_id)
        return custom_generator(config, workdir)   # custom 分支
    return resolve
```

- [ ] **Step 4: 运行确认通过** — `python -m pytest tests/engine/test_routing.py -v` → PASS（2 passed）。
- [ ] **Step 5: 提交**
```bash
git add backend/weiguan/engine/routing.py backend/tests/engine/test_routing.py
git commit -m "feat(engine): RoutingEngine 按受众解析 profile 并委派

Review-Anchor: P4-T2"
```

---

### Task 3 (P4-T3): 自定义人群生成（LLM）

**Files:** Modify `backend/pyproject.toml`（加 `openai`）；Create `backend/weiguan/engine/custom_profile.py`；Test `backend/tests/engine/test_custom_profile_llm.py`.

**Interfaces — Produces:**
- `generate_custom_profile(config: RunConfig, workdir: str, n: int = 60) -> str`：用 `config.llm_key/llm_model` 让 LLM 依 `config.audience.custom` 生成 n 条 OASIS twitter profile 行，写 CSV（含标准表头）到 `workdir/custom_profile.csv`，返回路径。

- [ ] **Step 1: 追加依赖** — `backend/pyproject.toml` 的 `[project].dependencies` 加 `"openai>=1.30"`。

- [ ] **Step 2: 写真跑测试 `tests/engine/test_custom_profile_llm.py`**
```python
import os
import csv
import pytest
from weiguan.engine.custom_profile import generate_custom_profile
from weiguan.engine.config import RunConfig, Audience

pytestmark = pytest.mark.llm


def _cfg():
    key = os.environ.get("WEIGUAN_TEST_LLM_KEY")
    if not key:
        pytest.skip("set WEIGUAN_TEST_LLM_KEY to run")
    return RunConfig(audience=Audience(custom="一二线城市、重性价比的年轻妈妈"),
                     content="x", steps=6, llm_key=key,
                     llm_model=os.environ.get("WEIGUAN_TEST_LLM_MODEL", "gpt-4o-mini"))


def test_generates_valid_profile_csv(tmp_path):  # review:P4-T3-AC1
    path = generate_custom_profile(_cfg(), str(tmp_path), n=5)
    assert os.path.exists(path)
    with open(path, encoding="utf-8") as f:
        rows = list(csv.reader(f))
    assert rows[0][1:] == ["user_id", "name", "username",
        "following_agentid_list", "previous_tweets", "user_char", "description"]
    assert len(rows) >= 6   # 表头 + ≥5 行
```

- [ ] **Step 3: 运行确认（无 key skip）** — `python -m pytest tests/engine/test_custom_profile_llm.py -m llm -v` → `1 skipped`。

- [ ] **Step 4: 写实现 `weiguan/engine/custom_profile.py`**
```python
# review:P4-T3  自定义受众 → OASIS profile（真 LLM）
from __future__ import annotations
import csv
import json
import os
from openai import OpenAI
from weiguan.engine.config import RunConfig

_HEADER = ["", "user_id", "name", "username", "following_agentid_list",
           "previous_tweets", "user_char", "description"]

_PROMPT = """你在为一个社交模拟生成 {n} 个虚拟用户。受众画像：{desc}
只输出 JSON 数组，每个元素形如：
{{"name":"张三","username":"zhangsan","user_char":"性格与说话风格一句话","description":"身份背景一句话"}}
不要额外文字。"""


def generate_custom_profile(config: RunConfig, workdir: str, n: int = 60) -> str:
    client = OpenAI(api_key=config.llm_key)
    resp = client.chat.completions.create(
        model=config.llm_model,
        messages=[{"role": "user",
                   "content": _PROMPT.format(n=n, desc=config.audience.custom)}])
    text = resp.choices[0].message.content or "[]"
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    people = json.loads(text)
    os.makedirs(workdir, exist_ok=True)
    path = os.path.join(workdir, "custom_profile.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(_HEADER)
        for i, p in enumerate(people):
            w.writerow([i, 10000 + i, p.get("name", f"user_{i}"),
                        p.get("username", f"user{i}"), "[]", "[]",
                        p.get("user_char", ""), p.get("description", "")])
    return path
```

- [ ] **Step 5: 用真实 key 运行，必须通过** —
```bash
cd backend && WEIGUAN_TEST_LLM_KEY=<你的key> python -m pytest tests/engine/test_custom_profile_llm.py -m llm -v
```
Expected: PASS（1 passed）。

- [ ] **Step 6: 提交**
```bash
git add backend/pyproject.toml backend/weiguan/engine/custom_profile.py backend/tests/engine/test_custom_profile_llm.py
git commit -m "feat(engine): 自定义受众 → OASIS profile 生成（LLM）

Review-Anchor: P4-T3"
```

> 装配提示（交接给部署，不单列任务）：生产入口构造 `RoutingEngine(make_resolver(workdir, generate_custom_profile), lambda p: OasisEngine(p, per_run_dir))` 注入 `create_app`。

---

### Task 4 (P4-T4): 前端 BYOK + API 客户端

**Files:** Create `frontend/src/api/useApiKey.ts`、`frontend/src/api/client.ts`；Test `frontend/src/api/client.test.ts`.

**Interfaces — Produces:**
- `useApiKey(): { key:string; model:string; setKey(v):void; setModel(v):void }`（localStorage `wg_llm_key`/`wg_llm_model`，model 默认 `gpt-4o-mini`）。
- `fetchCrowds(): Promise<Crowd[]>`（`GET /api/crowds`）
- `createRun(body, creds): Promise<{run_id:string}>`（`POST /api/runs`，头 `X-LLM-Key`/`X-LLM-Model`；非 2xx 抛错含 detail）。

- [ ] **Step 1: 写失败测试 `api/client.test.ts`**
```ts
import { fetchCrowds, createRun } from "./client";

afterEach(() => vi.restoreAllMocks());

test("fetchCrowds hits /api/crowds", async () => {  // review:P4-T4-AC1
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true,
    json: async () => [{ id: "tech_devs", name: "科技", emoji: "👨‍💻", blurb: "b" }] })));
  const crowds = await fetchCrowds();
  expect(crowds[0].id).toBe("tech_devs");
});

test("createRun posts with BYOK headers", async () => {  // review:P4-T4-AC2
  const spy = vi.fn(async () => ({ ok: true, json: async () => ({ run_id: "r_1" }) }));
  vi.stubGlobal("fetch", spy);
  const res = await createRun(
    { audience: { crowd_id: "tech_devs" }, content: "hi", steps: 10, platform: "twitter" },
    { key: "sk-x", model: "gpt-4o-mini" });
  expect(res.run_id).toBe("r_1");
  const [, init] = spy.mock.calls[0];
  expect((init.headers as Record<string, string>)["X-LLM-Key"]).toBe("sk-x");
});

test("createRun throws on error", async () => {  // review:P4-T4-AC3
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false,
    json: async () => ({ detail: "steps must be one of 6/10/15" }) })));
  await expect(createRun({ audience: { crowd_id: "t" }, content: "x", steps: 3,
    platform: "twitter" }, { key: "k", model: "m" })).rejects.toThrow(/steps/);
});
```

- [ ] **Step 2: 运行确认失败** — `cd frontend && npm test -- client` → FAIL。

- [ ] **Step 3: 写实现**

`api/useApiKey.ts`:
```ts
// review:P4-T4
import { useState } from "react";
export function useApiKey() {
  const [key, setKeyState] = useState(() => localStorage.getItem("wg_llm_key") ?? "");
  const [model, setModelState] = useState(() => localStorage.getItem("wg_llm_model") ?? "gpt-4o-mini");
  return {
    key, model,
    setKey: (v: string) => { localStorage.setItem("wg_llm_key", v); setKeyState(v); },
    setModel: (v: string) => { localStorage.setItem("wg_llm_model", v); setModelState(v); },
  };
}
```
`api/client.ts`:
```ts
// review:P4-T4  消费契约 §2.2
export interface Crowd { id: string; name: string; emoji: string; blurb: string }
export interface CreateRunBody {
  audience: { crowd_id?: string; custom?: string };
  content: string; steps: number; platform: "twitter" | "reddit";
}
export interface Creds { key: string; model: string }

export async function fetchCrowds(): Promise<Crowd[]> {
  const r = await fetch("/api/crowds");
  if (!r.ok) throw new Error("failed to load crowds");
  return r.json();
}

export async function createRun(body: CreateRunBody, creds: Creds): Promise<{ run_id: string }> {
  const r = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json",
      "X-LLM-Key": creds.key, "X-LLM-Model": creds.model },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? "create run failed");
  }
  return r.json();
}
```

- [ ] **Step 4: 运行确认通过** — `npm test -- client` → PASS（3 passed）。
- [ ] **Step 5: 提交**
```bash
git add frontend/src/api/useApiKey.ts frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat(frontend): BYOK 存储 + API 客户端（crowds/createRun）

Review-Anchor: P4-T4"
```

---

### Task 5 (P4-T5): GalleryScreen 圈子画廊 + 自定义受众

**Files:** Modify `frontend/src/screens/GalleryScreen.tsx`（替换 F0 占位）；Test `frontend/src/screens/GalleryScreen.test.tsx`.

**Interfaces — Produces:** GalleryScreen 挂载时 `fetchCrowds` 渲染圈子卡（Card），点卡 → `navigate("/compose", { state: { audience: { crowd_id } } })`；底部"自定义受众"textarea + 按钮 → `navigate("/compose", { state: { audience: { custom } } })`。

- [ ] **Step 1: 写失败测试 `screens/GalleryScreen.test.tsx`**
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import GalleryScreen from "./GalleryScreen";

function mount() {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [
    { id: "tech_devs", name: "科技程序员群", emoji: "👨‍💻", blurb: "毒舌" }] })));
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<GalleryScreen />} />
        <Route path="/compose" element={<div>写内容页</div>} />
      </Routes>
    </MemoryRouter>
  );
}
afterEach(() => vi.restoreAllMocks());

test("renders crowd cards from api", async () => {  // review:P4-T5-AC1
  mount();
  expect(await screen.findByText("科技程序员群")).toBeInTheDocument();
});

test("clicking a crowd navigates to compose", async () => {  // review:P4-T5-AC2
  mount();
  fireEvent.click(await screen.findByText("科技程序员群"));
  await waitFor(() => expect(screen.getByText("写内容页")).toBeInTheDocument());
});

test("custom audience navigates to compose", async () => {  // review:P4-T5-AC3
  mount();
  await screen.findByText("科技程序员群");
  fireEvent.change(screen.getByPlaceholderText(/一句话描述/),
    { target: { value: "年轻妈妈" } });
  fireEvent.click(screen.getByText(/用这个受众/));
  await waitFor(() => expect(screen.getByText("写内容页")).toBeInTheDocument());
});
```

- [ ] **Step 2: 运行确认失败** — `npm test -- GalleryScreen` → FAIL。

- [ ] **Step 3: 写实现 `screens/GalleryScreen.tsx`**
```tsx
// review:P4-T5
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCrowds, type Crowd } from "../api/client";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export default function GalleryScreen() {
  const [crowds, setCrowds] = useState<Crowd[]>([]);
  const [custom, setCustom] = useState("");
  const nav = useNavigate();
  useEffect(() => { fetchCrowds().then(setCrowds).catch(() => setCrowds([])); }, []);

  return (
    <div>
      <h1 className="font-display text-2xl mb-4">选一个圈子</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {crowds.map((c) => (
          <button key={c.id} className="text-left"
            onClick={() => nav("/compose", { state: { audience: { crowd_id: c.id } } })}>
            <Card interactive>
              <div className="text-2xl">{c.emoji}</div>
              <div className="mt-1 font-medium">{c.name}</div>
              <div className="text-xs text-ink/50">{c.blurb}</div>
            </Card>
          </button>
        ))}
      </div>
      <div className="mt-6">
        <textarea value={custom} onChange={(e) => setCustom(e.target.value)}
          placeholder="一句话描述你的受众（如：一二线城市、重性价比的年轻妈妈）"
          className="w-full rounded-card border border-ink/15 p-3 text-sm" rows={2} />
        <div className="mt-2">
          <Button onClick={() => custom.trim() &&
            nav("/compose", { state: { audience: { custom: custom.trim() } } })}>
            用这个受众围观 →
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过** — `npm test -- GalleryScreen` → PASS（3 passed）。
- [ ] **Step 5: 提交**
```bash
git add frontend/src/screens/GalleryScreen.tsx frontend/src/screens/GalleryScreen.test.tsx
git commit -m "feat(frontend): GalleryScreen 圈子画廊 + 自定义受众

Review-Anchor: P4-T5"
```

---

### Task 6 (P4-T6): ComposeScreen 写内容 + 选轮次 + 发起运行

**Files:** Modify `frontend/src/screens/ComposeScreen.tsx`（替换 F0 占位）；Test `frontend/src/screens/ComposeScreen.test.tsx`.

**Interfaces — Produces:** ComposeScreen 读 `location.state.audience`；含内容 textarea、轮次单选（6 快速/10 标准/15 深度，默认 10）、BYOK key 输入（缺则显示）；点"开始围观" → `createRun` → 成功 `navigate("/run/{run_id}/live")`；失败显示错误。

- [ ] **Step 1: 写失败测试 `screens/ComposeScreen.test.tsx`**
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ComposeScreen from "./ComposeScreen";

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

function mount() {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/compose",
      state: { audience: { crowd_id: "tech_devs" } } }]}>
      <Routes>
        <Route path="/compose" element={<ComposeScreen />} />
        <Route path="/run/:id/live" element={<div>进行时页</div>} />
      </Routes>
    </MemoryRouter>
  );
}

test("submits content and navigates to live", async () => {  // review:P4-T6-AC1
  const spy = vi.fn(async () => ({ ok: true, json: async () => ({ run_id: "r_9" }) }));
  vi.stubGlobal("fetch", spy);
  mount();
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/),
    { target: { value: "构建砍到3秒" } });
  fireEvent.click(screen.getByText(/开始围观/));
  await waitFor(() => expect(screen.getByText("进行时页")).toBeInTheDocument());
  const [, init] = spy.mock.calls[0];
  const body = JSON.parse(init.body as string);
  expect(body.content).toBe("构建砍到3秒");
  expect(body.steps).toBe(10);
});

test("shows error when create fails", async () => {  // review:P4-T6-AC2
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false,
    json: async () => ({ detail: "missing X-LLM-Key" }) })));
  localStorage.clear();   // 无 key
  mount();
  fireEvent.change(screen.getByPlaceholderText(/有什么新鲜事/), { target: { value: "hi" } });
  fireEvent.click(screen.getByText(/开始围观/));
  expect(await screen.findByText(/missing X-LLM-Key/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行确认失败** — `npm test -- ComposeScreen` → FAIL。

- [ ] **Step 3: 写实现 `screens/ComposeScreen.tsx`**
```tsx
// review:P4-T6
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createRun } from "../api/client";
import { useApiKey } from "../api/useApiKey";
import { Button } from "../components/Button";

const ROUNDS = [
  { v: 6, label: "快速围观" }, { v: 10, label: "标准" }, { v: 15, label: "深度发酵" },
];

export default function ComposeScreen() {
  const audience = (useLocation().state as any)?.audience ?? { crowd_id: "tech_devs" };
  const { key, model, setKey } = useApiKey();
  const [content, setContent] = useState("");
  const [steps, setSteps] = useState(10);
  const [error, setError] = useState("");
  const nav = useNavigate();

  async function go() {
    setError("");
    try {
      const { run_id } = await createRun(
        { audience, content, steps, platform: "twitter" }, { key, model });
      nav(`/run/${run_id}/live`);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div>
      <h1 className="font-display text-2xl mb-4">写点什么</h1>
      <textarea value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="有什么新鲜事？" rows={4}
        className="w-full rounded-card border border-ink/15 p-3 text-[15px]" />
      <div className="mt-4 flex gap-4 text-sm">
        {ROUNDS.map((r) => (
          <label key={r.v} className="flex items-center gap-1">
            <input type="radio" name="steps" checked={steps === r.v}
              onChange={() => setSteps(r.v)} />
            {r.label}（{r.v}步）
          </label>
        ))}
      </div>
      {!key && (
        <input placeholder="填入你的 LLM API Key（BYOK）"
          onChange={(e) => setKey(e.target.value)}
          className="mt-4 w-full rounded-card border border-ink/15 p-2 text-sm" />
      )}
      {error && <div className="mt-3 text-sentiment-negative text-sm">{error}</div>}
      <div className="mt-4"><Button onClick={go}>开始围观 ▶</Button></div>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过** — `npm test -- ComposeScreen` → PASS（2 passed）。
- [ ] **Step 5: 回归全部前端测试** — `cd frontend && npm test` → 全绿。
- [ ] **Step 6: 提交**
```bash
git add frontend/src/screens/ComposeScreen.tsx frontend/src/screens/ComposeScreen.test.tsx
git commit -m "feat(frontend): ComposeScreen 写内容+轮次+发起运行

Review-Anchor: P4-T6"
```

---

## 审核索引（Review Index）

| 锚点 | 断言 | 审核凭据 |
|---|---|---|
| P4-T1-AC1 | 注册 5 个圈子 | `test_five_crowds_registered` |
| P4-T1-AC2 | profile 文件存在且含表头 | `test_profile_path_exists_and_has_header` |
| P4-T1-AC3 | 未知圈子抛 KeyError | `test_unknown_crowd_raises` |
| P4-T1-AC4 | list_crowds 不泄露 profile_file | `test_list_crowds_hides_profile_file` |
| P4-T2-AC1 | 路由解析 profile 并委派 run | `test_routing_resolves_and_delegates` |
| P4-T2-AC2 | 路由委派 interview | `test_routing_interview_delegates` |
| P4-T3-AC1 | **真 LLM 生成合法 profile CSV** | `test_generates_valid_profile_csv`（`-m llm`+真key） |
| P4-T4-AC1 | fetchCrowds 命中 /api/crowds | `client.test.ts` |
| P4-T4-AC2 | createRun 带 BYOK 头 | `client.test.ts` |
| P4-T4-AC3 | createRun 出错抛 detail | `client.test.ts` |
| P4-T5-AC1 | 画廊渲染 API 圈子卡 | `GalleryScreen.test.tsx` |
| P4-T5-AC2 | 点圈子跳 compose | `GalleryScreen.test.tsx` |
| P4-T5-AC3 | 自定义受众跳 compose | `GalleryScreen.test.tsx` |
| P4-T6-AC1 | 提交内容跳 live、steps 默认 10 | `ComposeScreen.test.tsx` |
| P4-T6-AC2 | 缺 key/失败显示错误 | `ComposeScreen.test.tsx` |

## Self-Review
- **Spec 覆盖**：落实 §3 步骤 1–3（选圈子/自定义 → 写内容 → 选轮次 → 开始围观）、§5.1 圈子=profile 包、§5.2 BYOK、§5.3 轮次枚举、§7.1–7.2 线框（画廊/发布框）。契约 §2.2 前后端两侧落地。
- **占位符扫描**：无 TBD；custom 分支由真 LLM 生成（非占位），装配提示明确交接部署入口。
- **类型一致性**：`RunConfig/Audience`（后端）与 `CreateRunBody`（前端）字段对齐契约 §2.2；`RoutingEngine`/`make_resolver` 与 `generate_custom_profile` 签名一致；`fetchCrowds/createRun/useApiKey` 在画廊/写内容屏消费一致；跳转路径 `/run/:id/live` 与 Plan 3 LiveScreen 路由一致。
