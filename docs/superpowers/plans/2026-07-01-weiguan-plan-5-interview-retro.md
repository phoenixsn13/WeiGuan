# 围观 Plan 5 — INTERVIEW 追问抽屉 + 复盘上帝视角 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **审核锚点**：遵守 `2026-07-01-weiguan-conventions-and-contracts.md` §1。每个 Task = 锚点 `P5-T<n>`；实现打 `# review:P5-T<n>`/`// review:P5-T<n>`、commit trailer `Review-Anchor: P5-T<n>`、验收测试打 `-AC<k>`。

**Goal:** 收尾两大体验：①点任意评论人 → 侧滑抽屉追问"你为什么这么想"（契约 §2.4）；②复盘上帝视角——情绪分布/传播曲线/总量（纯计算）+ 1–2 条可操作建议（LLM）。

**Architecture:** 后端加"复盘聚合"（`compute_metrics` 纯函数 + `GET /retro`）与"洞察生成"（`generate_insights` LLM + `POST /insights`）。前端加 API 客户端三个方法、`InterviewDrawer` 组件（接入 LiveScreen）、`RetroScreen`（图表 + 建议）。数值透明可测，读懂评论的判断交给 LLM。

**Tech Stack:** 后端 Python/FastAPI + openai SDK；前端 React/TS/Tailwind + Vitest。

## Global Constraints
- 承接 Plan 2（interview 端点/契约 §2.4、snapshot §2.5）、Plan 3（LiveScreen/XFeed `onActorClick`）、Plan 4（`useApiKey`/client）、Plan F0（壳/tokens）。
- **新增复盘端点**（契约未冻结部分，本 Plan 定稿）：`GET /api/runs/{id}/retro`（纯指标、免 key）、`POST /api/runs/{id}/insights`（LLM、需 key）。
- 情绪分布用**透明启发式**（基于点赞/点踩/转发/举报计数），确定性可测；**不**在数值层做 LLM 分类。LLM 只负责 verdict + 建议。
- 复盘是"壳/上帝视角"，允许使用围观品牌色（区别于皮肤区）。
- insights 是真 LLM 任务，`@pytest.mark.llm`（有 key 必过，无 key skip）。

## 文件结构
```
backend/weiguan/
  analysis/__init__.py  analysis/retro.py                 # P5-T1
  analysis/insights.py                                     # P5-T2
  api/routes.py  (追加 GET /retro、POST /insights)         # P5-T1,T2
tests/analysis/{test_retro.py,test_insights_llm.py}
frontend/src/
  api/client.ts  (追加 fetchRetro/fetchInsights/interviewActor)  # P5-T3
  components/InterviewDrawer.tsx                            # P5-T4
  screens/LiveScreen.tsx  (接入抽屉)                        # P5-T4
  screens/RetroScreen.tsx (替换 F0 占位)                   # P5-T5
  index.css (追加 slidein)                                 # P5-T4
```

---

### Task 1 (P5-T1): 复盘指标 compute_metrics + GET /retro

**Files:** Create `backend/weiguan/analysis/__init__.py`、`backend/weiguan/analysis/retro.py`；Modify `backend/weiguan/api/routes.py`；Test `backend/tests/analysis/test_retro.py`（含 `backend/tests/analysis/__init__.py`）.

**Interfaces — Produces:**
- `SentimentBuckets(positive:int, negative:int, neutral:int)`
- `RetroMetrics(sentiment:SentimentBuckets, spread_by_step:list[int], totals:dict[str,int])`
- `compute_metrics(snapshot:RunSnapshot) -> RetroMetrics`（纯）。启发式（针对种子帖 seedId）：
  - positive = 种子帖 like 数 + 转发数(kind repost)；negative = 种子帖 dislike 数 + 举报数；neutral = 对种子帖的评论数。
  - spread_by_step = 按 `trace.created_at` 升序分组的事件计数列表。
  - totals = {likes, dislikes, replies, reposts, quotes, reports}。
- `GET /api/runs/{id}/retro` → `compute_metrics(record.snapshot).model_dump()`

- [ ] **Step 1: 写失败测试 `tests/analysis/test_retro.py`**
```python
from weiguan.analysis.retro import compute_metrics
from weiguan.canonical import (RunSnapshot, Post, Reply, Reaction, ReactionKind,
                               TargetType, Report, TraceEvent)


def _snap():
    return RunSnapshot(seed_post_id=1,
        posts=[Post(post_id=1, author_id=1, num_likes=2, num_dislikes=1),
               Post(post_id=2, author_id=3, kind="repost", original_post_id=1),
               Post(post_id=3, author_id=4, kind="quote", original_post_id=1,
                    quote_content="q")],
        replies=[Reply(comment_id=1, post_id=1, author_id=2, content="a"),
                 Reply(comment_id=2, post_id=1, author_id=5, content="b")],
        reactions=[Reaction(kind=ReactionKind.LIKE, actor_id=2,
                            target_type=TargetType.POST, target_id=1, created_at="2"),
                   Reaction(kind=ReactionKind.DISLIKE, actor_id=3,
                            target_type=TargetType.POST, target_id=1, created_at="2")],
        reports=[Report(actor_id=6, post_id=1, reason="夸大")],
        traces=[TraceEvent(actor_id=1, created_at="1", action="create_post"),
                TraceEvent(actor_id=2, created_at="2", action="create_comment"),
                TraceEvent(actor_id=3, created_at="2", action="repost")])


def test_sentiment_buckets():  # review:P5-T1-AC1
    m = compute_metrics(_snap())
    assert m.sentiment.positive == 1 + 1   # 1 like + 1 repost
    assert m.sentiment.negative == 1 + 1   # 1 dislike + 1 report
    assert m.sentiment.neutral == 2        # 2 replies


def test_totals_and_spread():  # review:P5-T1-AC2
    m = compute_metrics(_snap())
    assert m.totals["reposts"] == 1 and m.totals["quotes"] == 1
    assert m.totals["replies"] == 2 and m.totals["reports"] == 1
    assert m.spread_by_step == [1, 2]      # created_at "1":1, "2":2
```

- [ ] **Step 2: 运行确认失败** — `cd backend && python -m pytest tests/analysis/test_retro.py -v` → FAIL。

- [ ] **Step 3: 写实现 `weiguan/analysis/retro.py`**
```python
# review:P5-T1
from __future__ import annotations
from collections import Counter
from pydantic import BaseModel
from weiguan.canonical import RunSnapshot, ReactionKind, TargetType


class SentimentBuckets(BaseModel):
    positive: int
    negative: int
    neutral: int


class RetroMetrics(BaseModel):
    sentiment: SentimentBuckets
    spread_by_step: list[int]
    totals: dict[str, int]


def compute_metrics(snapshot: RunSnapshot) -> RetroMetrics:
    seed = snapshot.seed_post_id
    likes = sum(1 for r in snapshot.reactions if r.kind == ReactionKind.LIKE
                and r.target_type == TargetType.POST and r.target_id == seed)
    dislikes = sum(1 for r in snapshot.reactions if r.kind == ReactionKind.DISLIKE
                   and r.target_type == TargetType.POST and r.target_id == seed)
    reposts = sum(1 for p in snapshot.posts
                  if p.original_post_id == seed and p.kind == "repost")
    quotes = sum(1 for p in snapshot.posts
                 if p.original_post_id == seed and p.kind == "quote")
    replies = sum(1 for r in snapshot.replies if r.post_id == seed)
    reports = sum(1 for r in snapshot.reports if r.post_id == seed)

    per_step = Counter(t.created_at for t in snapshot.traces)
    spread = [per_step[k] for k in sorted(per_step, key=lambda x: (x is None, x))]

    return RetroMetrics(
        sentiment=SentimentBuckets(positive=likes + reposts,
                                   negative=dislikes + reports, neutral=replies),
        spread_by_step=spread,
        totals={"likes": likes, "dislikes": dislikes, "replies": replies,
                "reposts": reposts, "quotes": quotes, "reports": reports})
```

- [ ] **Step 4: 在 `weiguan/api/routes.py` 追加端点**
```python
from weiguan.analysis.retro import compute_metrics   # 顶部 import

@router.get("/runs/{run_id}/retro")
async def retro(run_id: str, request: Request):  # review:P5-T1
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    return compute_metrics(record.snapshot).model_dump()
```

- [ ] **Step 5: 运行确认通过** — `python -m pytest tests/analysis/test_retro.py -v` → PASS（2 passed）。
- [ ] **Step 6: 提交**
```bash
git add backend/weiguan/analysis/retro.py backend/weiguan/analysis/__init__.py backend/weiguan/api/routes.py backend/tests/analysis
git commit -m "feat(analysis): 复盘指标 compute_metrics + GET /retro

Review-Anchor: P5-T1"
```

---

### Task 2 (P5-T2): 洞察建议 generate_insights（LLM）+ POST /insights

**Files:** Create `backend/weiguan/analysis/insights.py`；Modify `backend/weiguan/api/routes.py`；Test `backend/tests/analysis/test_insights_llm.py`.

**Interfaces — Produces:**
- `Insights(verdict:str, suggestions:list[str])`
- `generate_insights(snapshot:RunSnapshot, config:RunConfig) -> Insights`：把种子帖 + 若干评论 + 指标喂给 LLM，产出一句 verdict 与 1–2 条建议。
- `POST /api/runs/{id}/insights`（头 `X-LLM-Key`/`X-LLM-Model`）→ `Insights`。

- [ ] **Step 1: 写真跑测试 `tests/analysis/test_insights_llm.py`**
```python
import os
import pytest
from weiguan.analysis.insights import generate_insights
from weiguan.engine.config import RunConfig, Audience
from weiguan.canonical import RunSnapshot, Post, Reply

pytestmark = pytest.mark.llm


def _cfg():
    key = os.environ.get("WEIGUAN_TEST_LLM_KEY")
    if not key:
        pytest.skip("set WEIGUAN_TEST_LLM_KEY to run")
    return RunConfig(audience=Audience(crowd_id="tech_devs"), content="构建砍到3秒",
                     steps=6, llm_key=key,
                     llm_model=os.environ.get("WEIGUAN_TEST_LLM_MODEL", "gpt-4o-mini"))


def test_insights_returns_verdict_and_suggestions():  # review:P5-T2-AC1
    snap = RunSnapshot(seed_post_id=1,
        posts=[Post(post_id=1, author_id=1, content="构建砍到3秒")],
        replies=[Reply(comment_id=1, post_id=1, author_id=2, content="缓存没清吧")])
    ins = generate_insights(snap, _cfg())
    assert ins.verdict.strip()
    assert 1 <= len(ins.suggestions) <= 2
    assert all(s.strip() for s in ins.suggestions)
```

- [ ] **Step 2: 运行确认（无 key skip）** — `python -m pytest tests/analysis/test_insights_llm.py -m llm -v` → `1 skipped`。

- [ ] **Step 3: 写实现 `weiguan/analysis/insights.py`**
```python
# review:P5-T2  复盘洞察（真 LLM）
from __future__ import annotations
import json
from openai import OpenAI
from pydantic import BaseModel
from weiguan.canonical import RunSnapshot
from weiguan.engine.config import RunConfig


class Insights(BaseModel):
    verdict: str
    suggestions: list[str]


_PROMPT = """你在帮内容作者复盘一次"发布前模拟"。
原帖：{content}
部分评论：{replies}
请只输出 JSON：{{"verdict":"一句话总体判断","suggestions":["可操作建议1","可操作建议2"]}}
suggestions 给 1-2 条，具体、可执行。不要额外文字。"""


def generate_insights(snapshot: RunSnapshot, config: RunConfig) -> Insights:
    seed = next((p for p in snapshot.posts
                 if p.post_id == snapshot.seed_post_id), None)
    content = seed.content if seed else config.content
    replies = " / ".join(r.content for r in snapshot.replies[:12]) or "（暂无）"
    client = OpenAI(api_key=config.llm_key)
    resp = client.chat.completions.create(model=config.llm_model,
        messages=[{"role": "user",
                   "content": _PROMPT.format(content=content, replies=replies)}])
    text = (resp.choices[0].message.content or "{}").strip()
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```")
    data = json.loads(text)
    sugg = [s for s in data.get("suggestions", []) if s.strip()][:2] or ["（无）"]
    return Insights(verdict=data.get("verdict", "").strip() or "（无明显结论）",
                    suggestions=sugg)
```

- [ ] **Step 4: 在 `routes.py` 追加端点**
```python
from weiguan.analysis.insights import generate_insights  # 顶部 import

@router.post("/runs/{run_id}/insights")
async def insights(run_id: str, request: Request,
                   x_llm_key: str | None = Header(default=None),
                   x_llm_model: str = Header(default="gpt-4o-mini")):  # review:P5-T2
    record = request.app.state.store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    if not x_llm_key:
        raise HTTPException(status_code=401, detail="missing X-LLM-Key")
    cfg = record.config.model_copy(update={"llm_key": x_llm_key, "llm_model": x_llm_model})
    return generate_insights(record.snapshot, cfg).model_dump()
```

- [ ] **Step 5: 用真实 key 运行，必须通过** —
```bash
cd backend && WEIGUAN_TEST_LLM_KEY=<你的key> python -m pytest tests/analysis/test_insights_llm.py -m llm -v
```
Expected: PASS（1 passed）。

- [ ] **Step 6: 回归全部非 LLM 后端测试** — `cd backend && python -m pytest -m "not llm" -v` → 全绿。
- [ ] **Step 7: 提交**
```bash
git add backend/weiguan/analysis/insights.py backend/weiguan/api/routes.py backend/tests/analysis/test_insights_llm.py
git commit -m "feat(analysis): generate_insights + POST /insights（LLM）

Review-Anchor: P5-T2"
```

---

### Task 3 (P5-T3): 前端 API 客户端补充

**Files:** Modify `frontend/src/api/client.ts`；Test `frontend/src/api/client.test.ts`（追加）.

**Interfaces — Produces:**
- `interviewActor(runId, actorId, question, creds): Promise<{answer:string}>`（`POST /interview`，带 BYOK 头）
- `fetchRetro(runId): Promise<RetroMetrics>`（`GET /retro`）
- `fetchInsights(runId, creds): Promise<Insights>`（`POST /insights`，带 BYOK 头）
- 类型 `RetroMetrics{sentiment:{positive,negative,neutral}; spread_by_step:number[]; totals:Record<string,number>}`、`Insights{verdict:string; suggestions:string[]}`

- [ ] **Step 1: 追加失败测试到 `api/client.test.ts`**
```ts
import { interviewActor, fetchRetro, fetchInsights } from "./client";

test("interviewActor posts with key header", async () => {  // review:P5-T3-AC1
  const spy = vi.fn(async () => ({ ok: true, json: async () => ({ answer: "因为..." }) }));
  vi.stubGlobal("fetch", spy);
  const r = await interviewActor("r_1", 2, "为什么?", { key: "sk", model: "m" });
  expect(r.answer).toBe("因为...");
  const [url, init] = spy.mock.calls[0];
  expect(url).toContain("/api/runs/r_1/interview");
  expect((init.headers as Record<string, string>)["X-LLM-Key"]).toBe("sk");
});

test("fetchRetro gets metrics", async () => {  // review:P5-T3-AC2
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({
    sentiment: { positive: 2, negative: 1, neutral: 3 },
    spread_by_step: [1, 2], totals: { likes: 2 } }) })));
  const m = await fetchRetro("r_1");
  expect(m.sentiment.positive).toBe(2);
});

test("fetchInsights posts with key", async () => {  // review:P5-T3-AC3
  const spy = vi.fn(async () => ({ ok: true, json: async () => ({
    verdict: "偏正向", suggestions: ["加实测"] }) }));
  vi.stubGlobal("fetch", spy);
  const i = await fetchInsights("r_1", { key: "sk", model: "m" });
  expect(i.verdict).toBe("偏正向");
});
```

- [ ] **Step 2: 运行确认失败** — `cd frontend && npm test -- client` → FAIL。

- [ ] **Step 3: 追加实现到 `api/client.ts`**
```ts
// review:P5-T3
export interface RetroMetrics {
  sentiment: { positive: number; negative: number; neutral: number };
  spread_by_step: number[];
  totals: Record<string, number>;
}
export interface Insights { verdict: string; suggestions: string[] }

export async function interviewActor(runId: string, actorId: number,
    question: string, creds: Creds): Promise<{ answer: string }> {
  const r = await fetch(`/api/runs/${runId}/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json",
      "X-LLM-Key": creds.key, "X-LLM-Model": creds.model },
    body: JSON.stringify({ actor_id: actorId, question }),
  });
  if (!r.ok) throw new Error("interview failed");
  return r.json();
}

export async function fetchRetro(runId: string): Promise<RetroMetrics> {
  const r = await fetch(`/api/runs/${runId}/retro`);
  if (!r.ok) throw new Error("failed to load retro");
  return r.json();
}

export async function fetchInsights(runId: string, creds: Creds): Promise<Insights> {
  const r = await fetch(`/api/runs/${runId}/insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json",
      "X-LLM-Key": creds.key, "X-LLM-Model": creds.model },
    body: "{}",
  });
  if (!r.ok) throw new Error("failed to load insights");
  return r.json();
}
```

- [ ] **Step 4: 运行确认通过** — `npm test -- client` → PASS（原 3 + 新 3 = 6 passed）。
- [ ] **Step 5: 提交**
```bash
git add frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat(frontend): client 补充 interview/retro/insights

Review-Anchor: P5-T3"
```

---

### Task 4 (P5-T4): InterviewDrawer 追问抽屉 + 接入 LiveScreen

**Files:** Create `frontend/src/components/InterviewDrawer.tsx`；Modify `frontend/src/screens/LiveScreen.tsx`、`frontend/src/index.css`（加 slidein）；Test `frontend/src/components/InterviewDrawer.test.tsx`.

**Interfaces — Produces:**
- `InterviewDrawer({ runId, actor, onClose })`：`actor` 为 null 时不渲染；否则右侧滑入抽屉、背景压暗；输入问题 → `interviewActor` → 追加一轮问答。
- LiveScreen：`XFeed onActorClick` 设选中 actor，渲染抽屉。

- [ ] **Step 1: 追加 slidein 到 `frontend/src/index.css`**
```css
@keyframes slidein { from { transform: translateX(100%); } to { transform: none; } }
```

- [ ] **Step 2: 写失败测试 `components/InterviewDrawer.test.tsx`**
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InterviewDrawer } from "./InterviewDrawer";

const actor = { user_id: 2, user_name: "marco", name: "Marco",
  bio: "后端老兵", num_followers: 5, num_followings: 3 };

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

test("null actor renders nothing", () => {  // review:P5-T4-AC1
  const { container } = render(<InterviewDrawer runId="r_1" actor={null} onClose={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test("asks question and shows answer", async () => {  // review:P5-T4-AC2
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true,
    json: async () => ({ answer: "依赖图大，冷启动骗不了人" }) })));
  render(<InterviewDrawer runId="r_1" actor={actor} onClose={() => {}} />);
  expect(screen.getByText("Marco")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/继续问/), { target: { value: "为什么不信?" } });
  fireEvent.click(screen.getByText("问"));
  expect(await screen.findByText(/冷启动骗不了人/)).toBeInTheDocument();
  expect(screen.getByText("为什么不信?")).toBeInTheDocument();
});
```

- [ ] **Step 3: 写实现 `components/InterviewDrawer.tsx`**
```tsx
// review:P5-T4
import { useState } from "react";
import type { Actor } from "../model/canonical";
import { interviewActor } from "../api/client";
import { useApiKey } from "../api/useApiKey";

export function InterviewDrawer({ runId, actor, onClose }:
  { runId: string; actor: Actor | null; onClose: () => void }) {
  const { key, model } = useApiKey();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(false);
  if (!actor) return null;

  async function ask() {
    if (!q.trim() || loading) return;
    setLoading(true);
    try {
      const { answer } = await interviewActor(runId, actor!.user_id, q, { key, model });
      setTurns((t) => [...t, { q, a: answer }]);
      setQ("");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/50" />
      <aside onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-80 bg-white p-4 shadow-spotlight animate-[slidein_.2s_ease] overflow-y-auto">
        <div className="font-display text-lg">{actor.name}</div>
        <div className="text-xs text-ink/50">@{actor.user_name} · {actor.bio}</div>
        <div className="mt-4 space-y-3">
          {turns.map((t, i) => (
            <div key={i}>
              <div className="text-sm text-accent">你：{t.q}</div>
              <div className="text-sm">{actor.name}：{t.a}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="继续问…"
            className="flex-1 rounded-card border border-ink/15 p-2 text-sm" />
          <button onClick={ask} className="rounded-card bg-brand px-3 text-sm">问</button>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: 接入 `screens/LiveScreen.tsx`**
在 import 增 `import { useState } from "react";` 与 `import { InterviewDrawer } from "../components/InterviewDrawer";`、`import type { Actor } from "../model/canonical";`。在组件内加 `const [selected, setSelected] = useState<Actor | null>(null);`，把 `<XFeed vm={vm} />` 改为 `<XFeed vm={vm} onActorClick={setSelected} />`，并在 `</div>` 前加 `<InterviewDrawer runId={id} actor={selected} onClose={() => setSelected(null)} />`。

- [ ] **Step 5: 运行确认通过** — `cd frontend && npm test -- InterviewDrawer && npm test -- LiveScreen` → 全绿（LiveScreen 原测试不受影响，抽屉默认 null）。
- [ ] **Step 6: 提交**
```bash
git add frontend/src/components/InterviewDrawer.tsx frontend/src/components/InterviewDrawer.test.tsx frontend/src/screens/LiveScreen.tsx frontend/src/index.css
git commit -m "feat(frontend): InterviewDrawer 追问抽屉并接入 LiveScreen

Review-Anchor: P5-T4"
```

---

### Task 5 (P5-T5): RetroScreen 复盘上帝视角

**Files:** Modify `frontend/src/screens/RetroScreen.tsx`（替换 F0 占位）；Test `frontend/src/screens/RetroScreen.test.tsx`.

**Interfaces — Produces:** RetroScreen 读路由 `:id` → `fetchRetro` 渲染情绪分布条 + 传播 spark + 总量；"生成建议"按钮 → `fetchInsights` 显示 verdict + suggestions。

- [ ] **Step 1: 写失败测试 `screens/RetroScreen.test.tsx`**
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RetroScreen from "./RetroScreen";

beforeEach(() => localStorage.setItem("wg_llm_key", "sk-x"));
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

function mount() {
  render(
    <MemoryRouter initialEntries={["/run/r_1/retro"]}>
      <Routes><Route path="/run/:id/retro" element={<RetroScreen />} /></Routes>
    </MemoryRouter>
  );
}

test("renders sentiment from retro metrics", async () => {  // review:P5-T5-AC1
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({
    sentiment: { positive: 5, negative: 2, neutral: 3 },
    spread_by_step: [1, 3, 2], totals: { reposts: 1, reports: 1 } }) })));
  mount();
  expect(await screen.findByText(/正向/)).toBeInTheDocument();
  expect(screen.getByText(/50%/)).toBeInTheDocument();   // 5/(5+2+3)=50%
});

test("generate insights shows verdict and suggestions", async () => {  // review:P5-T5-AC2
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      sentiment: { positive: 1, negative: 0, neutral: 0 },
      spread_by_step: [1], totals: {} }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      verdict: "偏正向但有暗线", suggestions: ["加冷启动实测", "盯硬核用户"] }) });
  vi.stubGlobal("fetch", fetchMock);
  mount();
  await screen.findByText(/正向/);
  fireEvent.click(screen.getByText(/生成建议/));
  expect(await screen.findByText("偏正向但有暗线")).toBeInTheDocument();
  expect(screen.getByText("加冷启动实测")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行确认失败** — `npm test -- RetroScreen` → FAIL。

- [ ] **Step 3: 写实现 `screens/RetroScreen.tsx`**
```tsx
// review:P5-T5  复盘上帝视角（壳，允许品牌色）
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchRetro, fetchInsights, type RetroMetrics, type Insights } from "../api/client";
import { useApiKey } from "../api/useApiKey";
import { Button } from "../components/Button";
import { SentimentTag } from "../components/SentimentTag";

export default function RetroScreen() {
  const { id = "" } = useParams();
  const { key, model } = useApiKey();
  const [m, setM] = useState<RetroMetrics | null>(null);
  const [ins, setIns] = useState<Insights | null>(null);
  useEffect(() => { fetchRetro(id).then(setM).catch(() => setM(null)); }, [id]);
  if (!m) return <div className="text-ink/40">复盘加载中…</div>;

  const total = m.sentiment.positive + m.sentiment.negative + m.sentiment.neutral || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const rows: [string, "positive" | "negative" | "neutral", number][] = [
    ["正向", "positive", m.sentiment.positive],
    ["中立", "neutral", m.sentiment.neutral],
    ["负向", "negative", m.sentiment.negative],
  ];

  return (
    <div>
      <h1 className="font-display text-2xl mb-4">复盘</h1>
      <div className="rounded-card border border-ink/10 bg-white p-4">
        {rows.map(([label, kind, n]) => (
          <div key={label} className="flex items-center gap-3 py-1">
            <SentimentTag kind={kind} label={label} />
            <div className="h-2 flex-1 rounded bg-ink/5">
              <div className="h-2 rounded bg-accent" style={{ width: `${pct(n)}%` }} />
            </div>
            <span className="tabular text-sm">{pct(n)}%</span>
          </div>
        ))}
        <div className="mt-3 text-xs text-ink/50">
          转发 {m.totals.reposts ?? 0} · 举报 {m.totals.reports ?? 0} · 传播 {m.spread_by_step.join("·")}
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={() => fetchInsights(id, { key, model }).then(setIns).catch(() => {})}>
          💡 生成建议
        </Button>
      </div>
      {ins && (
        <div className="mt-4 rounded-card border border-brand/30 bg-brand/5 p-4">
          <div className="font-medium">{ins.verdict}</div>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {ins.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过** — `npm test -- RetroScreen` → PASS（2 passed）。
- [ ] **Step 5: 回归全部前端测试** — `cd frontend && npm test` → 全绿。
- [ ] **Step 6: 提交**
```bash
git add frontend/src/screens/RetroScreen.tsx frontend/src/screens/RetroScreen.test.tsx
git commit -m "feat(frontend): RetroScreen 复盘上帝视角（情绪/传播/建议）

Review-Anchor: P5-T5"
```

---

## 审核索引（Review Index）

| 锚点 | 断言 | 审核凭据 |
|---|---|---|
| P5-T1-AC1 | 情绪三桶启发式正确 | `test_sentiment_buckets` |
| P5-T1-AC2 | 总量与传播分步正确 | `test_totals_and_spread` |
| P5-T2-AC1 | **真 LLM 出 verdict + 1–2 建议** | `test_insights_returns_verdict_and_suggestions`（`-m llm`+真key） |
| P5-T3-AC1 | interviewActor 带 key 头 | `client.test.ts` |
| P5-T3-AC2 | fetchRetro 取指标 | `client.test.ts` |
| P5-T3-AC3 | fetchInsights 带 key | `client.test.ts` |
| P5-T4-AC1 | actor 为 null 不渲染 | `InterviewDrawer.test.tsx` |
| P5-T4-AC2 | 追问显示问答 | `InterviewDrawer.test.tsx` |
| P5-T5-AC1 | 复盘渲染情绪百分比 | `RetroScreen.test.tsx` |
| P5-T5-AC2 | 生成建议显示 verdict+建议 | `RetroScreen.test.tsx` |

## Self-Review
- **Spec 覆盖**：实现 §3 步骤 5–6（追问 + 复盘）、§6.2 上帝视角壳（品牌色）、§7.4 追问抽屉线框（点头像→右滑→问答）、§7.5 复盘线框（情绪分布/传播/建议）。契约 §2.4 接入前端；新增 `GET /retro`、`POST /insights` 并定稿。
- **占位符扫描**：无 TBD；情绪数值为透明启发式（非占位），读评论判断交 LLM verdict；每步含完整代码与命令。
- **类型一致性**：`RetroMetrics/Insights`（后端 pydantic）与前端 `client.ts` 同构；`interviewActor/fetchRetro/fetchInsights` 与 §2.4/新端点对齐；`InterviewDrawer` 消费 `Actor` 与 Plan 3 一致；`XFeed onActorClick`（Plan 3 已留 prop）在此接入，不改皮肤。
```
```

## 全局收尾（交接部署提示，非本 Plan 任务）
- 生产入口装配：`create_app(RoutingEngine(make_resolver(workdir, generate_custom_profile), lambda p: OasisEngine(p, per_run_dir)))`。
- 全量真跑验收：`WEIGUAN_TEST_LLM_KEY=<key> pytest -m llm`（P2-T6 + P4-T3 + P5-T2 三处 LLM 对接全绿）。
- 前端全绿：`cd frontend && npm test`；后端非 LLM 全绿：`cd backend && pytest -m "not llm"`。
