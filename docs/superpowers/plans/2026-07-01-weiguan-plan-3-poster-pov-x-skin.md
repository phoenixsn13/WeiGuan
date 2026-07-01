# 围观 Plan 3 — poster POV 透镜 + X 皮肤 + 流式播放 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **审核锚点**：遵守 `2026-07-01-weiguan-conventions-and-contracts.md` §1。每个 Task = 锚点 `P3-T<n>`；实现打 `// review:P3-T<n>`、commit trailer `Review-Anchor: P3-T<n>`、验收测试打 `// review:P3-T<n>-AC<k>`。

**Goal:** 把后端流来的增量 RunSnapshot，经"poster 视角纯函数"变成 ViewModel，再用**以假乱真的 X 皮肤**逐条流式播放（种子帖 + 评论刷出 + 计数），完成第一人称沉浸的进行时体验。

**Architecture:** 四段：TS 规范类型 + `applyDelta` 累加器（纯）→ `posterView` POV 透镜（纯）→ `useRunStream` 钩子（消费契约 §2.3 的 SSE，可注入 EventSource 供测试）→ X 皮肤组件 + `LiveScreen` 装配。皮肤**只消费 ViewModel**，绝不碰 RunSnapshot/后端（契约纪律）。

**Tech Stack:** React 18，TypeScript，Tailwind（复用 F0 tokens），Vitest + @testing-library/react（含 `renderHook`）。

## Global Constraints
- 承接 Plan F0（壳/tokens/占位屏）与 Plan 2 契约 §2.3（SSE 事件名与字段）、§2.6（POV→ViewModel）。
- **皮肤区禁止出现围观品牌**：X 皮肤组件只用中性/X 风样式，不引 brand 色（brand 只属于壳）。
- POV 透镜与累加器是**纯函数**，必须脱离网络/DOM 可测。
- `useRunStream` 必须支持注入 `EventSourceFactory`，测试用 FakeEventSource，不连真后端。
- 本 Plan **不做**：写内容/发起运行（Plan 4）、点头像追问抽屉与复盘（Plan 5）。头像 `onActorClick` 先留 prop，不接抽屉。

## 文件结构
```
frontend/src/
  model/canonical.ts       model/canonical.test.ts        # P3-T1
  model/accumulate.ts      （并入 canonical.test.ts）       # P3-T1
  pov/poster.ts            pov/poster.test.ts              # P3-T2
  skins/x/XAvatar.tsx  XActionBar.tsx  XPost.tsx  XReply.tsx  XFeed.tsx
  skins/x/xskin.test.tsx                                   # P3-T3
  api/runStream.ts         api/runStream.test.ts           # P3-T4
  screens/LiveScreen.tsx   screens/LiveScreen.test.tsx     # P3-T5（替换 F0 占位）
  index.css                （追加 fadein keyframe）          # P3-T3
```

---

### Task 1 (P3-T1): TS 规范类型 + applyDelta 累加器

**Files:** Create `frontend/src/model/canonical.ts`、`frontend/src/model/accumulate.ts`；Test `frontend/src/model/canonical.test.ts`.

**Interfaces — Produces:**
- TS 镜像后端规范模型：`Actor/Post/Reply/Reaction/Follow/Report/TraceEvent/RunSnapshot` 及字面量联合 `Platform/PostKind/ReactionKind/TargetType`（字段名与 Plan 1 完全一致）。
- `emptySnapshot(): RunSnapshot`
- `applyDelta(snap: RunSnapshot, delta: RunSnapshot): RunSnapshot`（不可变；各列表拼接；`seed_post_id` 首次落定；platform 取 delta）。

- [ ] **Step 1: 写失败测试 `model/canonical.test.ts`**
```ts
import { emptySnapshot, applyDelta } from "./accumulate";
import type { RunSnapshot } from "./canonical";

test("applyDelta concatenates and fixes seed_post_id once", () => {  // review:P3-T1-AC1
  const d1: RunSnapshot = { ...emptySnapshot(), seed_post_id: 1,
    posts: [{ post_id: 1, author_id: 1, kind: "original", content: "hi",
      num_likes: 0, num_dislikes: 0, num_shares: 0, num_reports: 0 }] };
  const s1 = applyDelta(emptySnapshot(), d1);
  const d2: RunSnapshot = { ...emptySnapshot(),
    replies: [{ comment_id: 1, post_id: 1, author_id: 2, content: "yo",
      num_likes: 3, num_dislikes: 0 }] };
  const s2 = applyDelta(s1, d2);
  expect(s2.seed_post_id).toBe(1);
  expect(s2.posts).toHaveLength(1);
  expect(s2.replies[0].num_likes).toBe(3);
});

test("applyDelta is immutable", () => {  // review:P3-T1-AC2
  const base = emptySnapshot();
  applyDelta(base, { ...emptySnapshot(),
    actors: [{ user_id: 9, num_followers: 0, num_followings: 0 }] });
  expect(base.actors).toHaveLength(0);
});
```

- [ ] **Step 2: 运行确认失败** — `cd frontend && npm test -- canonical` → FAIL。

- [ ] **Step 3: 写实现**

`model/canonical.ts`:
```ts
// review:P3-T1  TS 镜像后端 weiguan.canonical
export type Platform = "twitter" | "reddit";
export type PostKind = "original" | "repost" | "quote";
export type ReactionKind = "like" | "dislike" | "comment_like" | "comment_dislike";
export type TargetType = "post" | "comment";

export interface Actor {
  user_id: number; agent_id?: number | null; user_name?: string | null;
  name?: string | null; bio?: string | null;
  num_followers: number; num_followings: number;
}
export interface Post {
  post_id: number; author_id: number; kind: PostKind; content: string;
  quote_content?: string | null; original_post_id?: number | null;
  created_at?: string | null; num_likes: number; num_dislikes: number;
  num_shares: number; num_reports: number;
}
export interface Reply {
  comment_id: number; post_id: number; author_id: number; content: string;
  created_at?: string | null; num_likes: number; num_dislikes: number;
}
export interface Reaction {
  kind: ReactionKind; actor_id: number; target_type: TargetType;
  target_id: number; created_at?: string | null;
}
export interface Follow { follower_id: number; followee_id: number; created_at?: string | null; }
export interface Report { actor_id: number; post_id: number; reason?: string | null; created_at?: string | null; }
export interface TraceEvent { actor_id: number; created_at?: string | null; action: string; info?: string | null; }
export interface RunSnapshot {
  platform: Platform; seed_post_id?: number | null;
  actors: Actor[]; posts: Post[]; replies: Reply[]; reactions: Reaction[];
  follows: Follow[]; reports: Report[]; traces: TraceEvent[];
}
```
`model/accumulate.ts`:
```ts
// review:P3-T1
import type { RunSnapshot } from "./canonical";

export function emptySnapshot(): RunSnapshot {
  return { platform: "twitter", seed_post_id: null, actors: [], posts: [],
    replies: [], reactions: [], follows: [], reports: [], traces: [] };
}

export function applyDelta(snap: RunSnapshot, delta: RunSnapshot): RunSnapshot {
  return {
    platform: delta.platform ?? snap.platform,
    seed_post_id: snap.seed_post_id ?? delta.seed_post_id ?? null,
    actors: [...snap.actors, ...delta.actors],
    posts: [...snap.posts, ...delta.posts],
    replies: [...snap.replies, ...delta.replies],
    reactions: [...snap.reactions, ...delta.reactions],
    follows: [...snap.follows, ...delta.follows],
    reports: [...snap.reports, ...delta.reports],
    traces: [...snap.traces, ...delta.traces],
  };
}
```

- [ ] **Step 4: 运行确认通过** — `npm test -- canonical` → PASS（2 passed）。
- [ ] **Step 5: 提交**
```bash
git add frontend/src/model
git commit -m "feat(frontend): TS 规范类型 + applyDelta 累加器

Review-Anchor: P3-T1"
```

---

### Task 2 (P3-T2): poster POV 透镜

**Files:** Create `frontend/src/pov/poster.ts`；Test `frontend/src/pov/poster.test.ts`.

**Interfaces — Produces:**（定稿契约 §2.6）
```ts
interface ReplyView { reply: Reply; author: Actor }
interface Notification { id: string; kind: "like"|"repost"|"quote"|"follow"; actor: Actor }
interface PosterViewModel { me: Actor|null; seedPost: Post|null;
  thread: ReplyView[]; notifications: Notification[] }
function posterView(snap: RunSnapshot): PosterViewModel
```
规则：`seedPost`=`post_id===seed_post_id`；`me`=其作者；`thread`=对种子帖的评论按 `created_at,comment_id` 升序 + 作者；`notifications`=对种子帖的 like（kind"like"）+ `original_post_id===seedPostId` 的帖（有 quote→"quote" 否则"repost"）+ `followee_id===me.user_id` 的关注（"follow"）。作者查不到时合成 `{user_id, num_followers:0, num_followings:0}`。

- [ ] **Step 1: 写失败测试 `pov/poster.test.ts`**
```ts
import { posterView } from "./poster";
import { emptySnapshot } from "../model/accumulate";
import type { RunSnapshot } from "../model/canonical";

function snap(): RunSnapshot {
  return { ...emptySnapshot(), seed_post_id: 1,
    actors: [
      { user_id: 1, user_name: "you", name: "你", num_followers: 0, num_followings: 0 },
      { user_id: 2, user_name: "marco", name: "Marco", num_followers: 5, num_followings: 3 },
      { user_id: 3, user_name: "lin", name: "Lin", num_followers: 2, num_followings: 4 }],
    posts: [
      { post_id: 1, author_id: 1, kind: "original", content: "构建砍到3秒",
        created_at: "1", num_likes: 1, num_dislikes: 0, num_shares: 1, num_reports: 0 },
      { post_id: 2, author_id: 3, kind: "repost", original_post_id: 1, content: "",
        created_at: "2", num_likes: 0, num_dislikes: 0, num_shares: 0, num_reports: 0 }],
    replies: [
      { comment_id: 1, post_id: 1, author_id: 2, content: "缓存没清吧",
        created_at: "2", num_likes: 3, num_dislikes: 0 }],
    reactions: [
      { kind: "like", actor_id: 2, target_type: "post", target_id: 1, created_at: "2" }],
    follows: [{ follower_id: 2, followee_id: 1, created_at: "2" }] };
}

test("me and seedPost resolved", () => {  // review:P3-T2-AC1
  const vm = posterView(snap());
  expect(vm.me?.user_name).toBe("you");
  expect(vm.seedPost?.content).toBe("构建砍到3秒");
});

test("thread joins replies with authors", () => {  // review:P3-T2-AC2
  const vm = posterView(snap());
  expect(vm.thread).toHaveLength(1);
  expect(vm.thread[0].author.name).toBe("Marco");
  expect(vm.thread[0].reply.content).toBe("缓存没清吧");
});

test("notifications include like, repost, follow", () => {  // review:P3-T2-AC3
  const kinds = posterView(snap()).notifications.map((n) => n.kind).sort();
  expect(kinds).toEqual(["follow", "like", "repost"]);
});

test("empty snapshot yields nulls", () => {  // review:P3-T2-AC4
  const vm = posterView(emptySnapshot());
  expect(vm.me).toBeNull();
  expect(vm.seedPost).toBeNull();
});
```

- [ ] **Step 2: 运行确认失败** — `npm test -- poster` → FAIL。

- [ ] **Step 3: 写实现 `pov/poster.ts`**
```ts
// review:P3-T2  poster 视角纯函数（契约 §2.6 定稿）
import type { Actor, Post, Reply, RunSnapshot } from "../model/canonical";

export interface ReplyView { reply: Reply; author: Actor }
export interface Notification { id: string; kind: "like" | "repost" | "quote" | "follow"; actor: Actor }
export interface PosterViewModel {
  me: Actor | null; seedPost: Post | null;
  thread: ReplyView[]; notifications: Notification[];
}

function actorOf(snap: RunSnapshot, userId: number): Actor {
  return snap.actors.find((a) => a.user_id === userId)
    ?? { user_id: userId, num_followers: 0, num_followings: 0 };
}

export function posterView(snap: RunSnapshot): PosterViewModel {
  const seedId = snap.seed_post_id ?? null;
  const seedPost = seedId == null ? null
    : snap.posts.find((p) => p.post_id === seedId) ?? null;
  const me = seedPost ? actorOf(snap, seedPost.author_id) : null;

  const thread: ReplyView[] = snap.replies
    .filter((r) => r.post_id === seedId)
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")
      || a.comment_id - b.comment_id)
    .map((r) => ({ reply: r, author: actorOf(snap, r.author_id) }));

  const notifications: Notification[] = [];
  for (const r of snap.reactions) {
    if (r.kind === "like" && r.target_type === "post" && r.target_id === seedId)
      notifications.push({ id: `like-${r.actor_id}`, kind: "like", actor: actorOf(snap, r.actor_id) });
  }
  for (const p of snap.posts) {
    if (p.original_post_id === seedId)
      notifications.push({ id: `share-${p.post_id}`,
        kind: p.quote_content ? "quote" : "repost", actor: actorOf(snap, p.author_id) });
  }
  if (me) for (const f of snap.follows) {
    if (f.followee_id === me.user_id)
      notifications.push({ id: `follow-${f.follower_id}`, kind: "follow", actor: actorOf(snap, f.follower_id) });
  }
  return { me, seedPost, thread, notifications };
}
```

- [ ] **Step 4: 运行确认通过** — `npm test -- poster` → PASS（4 passed）。
- [ ] **Step 5: 提交**
```bash
git add frontend/src/pov
git commit -m "feat(frontend): poster POV 透镜（纯函数）

Review-Anchor: P3-T2"
```

---

### Task 3 (P3-T3): X 皮肤组件

**Files:** Create `frontend/src/skins/x/{XAvatar,XActionBar,XPost,XReply,XFeed}.tsx`；Modify `frontend/src/index.css`（加 fadein）；Test `frontend/src/skins/x/xskin.test.tsx`.

**Interfaces — Produces:**（皮肤只吃 ViewModel）
- `XAvatar({actor, onClick?})`、`XActionBar({replies,reposts,likes})`（计数带 `tabular`）、`XReply({reply,author,onAuthorClick?})`（`animate-[fadein...]`）、`XPost({post,author,replyCount,onAuthorClick?})`、`XFeed({vm, onActorClick?})`。

- [ ] **Step 1: 追加 fadein 到 `frontend/src/index.css`**
```css
@keyframes fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
```

- [ ] **Step 2: 写失败测试 `skins/x/xskin.test.tsx`**
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { XFeed } from "./XFeed";
import { XActionBar } from "./XActionBar";
import type { PosterViewModel } from "../../pov/poster";

const vm: PosterViewModel = {
  me: { user_id: 1, user_name: "you", name: "你", num_followers: 0, num_followings: 0 },
  seedPost: { post_id: 1, author_id: 1, kind: "original", content: "构建砍到3秒",
    num_likes: 48, num_dislikes: 0, num_shares: 5, num_reports: 0 },
  thread: [{ reply: { comment_id: 1, post_id: 1, author_id: 2, content: "缓存没清吧",
    num_likes: 3, num_dislikes: 0 },
    author: { user_id: 2, user_name: "marco", name: "Marco", num_followers: 5, num_followings: 3 } }],
  notifications: [],
};

test("feed renders seed post content and reply", () => {  // review:P3-T3-AC1
  render(<XFeed vm={vm} />);
  expect(screen.getByText("构建砍到3秒")).toBeInTheDocument();
  expect(screen.getByText("缓存没清吧")).toBeInTheDocument();
});

test("action bar counts use tabular numerals", () => {  // review:P3-T3-AC2
  render(<XActionBar replies={12} reposts={5} likes={48} />);
  const like = screen.getByText("48");
  expect(like.className).toContain("tabular");
});

test("clicking avatar fires onActorClick", () => {  // review:P3-T3-AC3
  const fn = vi.fn();
  render(<XFeed vm={vm} onActorClick={fn} />);
  fireEvent.click(screen.getByLabelText("用户 marco"));
  expect(fn).toHaveBeenCalledWith(expect.objectContaining({ user_id: 2 }));
});

test("empty feed shows waiting hint", () => {  // review:P3-T3-AC4
  render(<XFeed vm={{ me: null, seedPost: null, thread: [], notifications: [] }} />);
  expect(screen.getByText(/等待第一条/)).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行确认失败** — `npm test -- xskin` → FAIL。

- [ ] **Step 4: 写实现**

`skins/x/XAvatar.tsx`:
```tsx
// review:P3-T3
import type { Actor } from "../../model/canonical";
export function XAvatar({ actor, onClick }: { actor: Actor; onClick?: (a: Actor) => void }) {
  const label = (actor.name || actor.user_name || "?").slice(0, 1);
  return (
    <button aria-label={`用户 ${actor.user_name ?? actor.user_id}`}
      onClick={() => onClick?.(actor)}
      className="h-10 w-10 shrink-0 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center">
      {label}
    </button>
  );
}
```
`skins/x/XActionBar.tsx`:
```tsx
// review:P3-T3
export function XActionBar({ replies, reposts, likes }:
  { replies: number; reposts: number; likes: number }) {
  return (
    <div className="mt-2 flex gap-10 text-[13px] text-slate-500">
      <span>💬 <span className="tabular">{replies}</span></span>
      <span>🔁 <span className="tabular">{reposts}</span></span>
      <span>♥ <span className="tabular transition-all">{likes}</span></span>
    </div>
  );
}
```
`skins/x/XReply.tsx`:
```tsx
// review:P3-T3
import type { Actor, Reply } from "../../model/canonical";
import { XAvatar } from "./XAvatar";
export function XReply({ reply, author, onAuthorClick }:
  { reply: Reply; author: Actor; onAuthorClick?: (a: Actor) => void }) {
  return (
    <div className="flex gap-3 border-t border-slate-100 py-3 animate-[fadein_.3s_ease]">
      <XAvatar actor={author} onClick={onAuthorClick} />
      <div>
        <div className="text-[13px]">
          <span className="font-medium">{author.name}</span>{" "}
          <span className="text-slate-400">@{author.user_name}</span>
        </div>
        <div className="text-[15px]">{reply.content}</div>
        <div className="mt-1 text-[13px] text-slate-400">♥ <span className="tabular">{reply.num_likes}</span></div>
      </div>
    </div>
  );
}
```
`skins/x/XPost.tsx`:
```tsx
// review:P3-T3
import type { Actor, Post } from "../../model/canonical";
import { XAvatar } from "./XAvatar";
import { XActionBar } from "./XActionBar";
export function XPost({ post, author, replyCount, onAuthorClick }:
  { post: Post; author: Actor; replyCount: number; onAuthorClick?: (a: Actor) => void }) {
  return (
    <article className="flex gap-3 pb-2">
      <XAvatar actor={author} onClick={onAuthorClick} />
      <div className="flex-1">
        <div className="text-[15px]">
          <span className="font-medium">{author.name}</span>{" "}
          <span className="text-slate-400">@{author.user_name} · 刚刚</span>
        </div>
        <div className="mt-0.5 whitespace-pre-wrap text-[15px]">{post.content}</div>
        <XActionBar replies={replyCount} reposts={post.num_shares} likes={post.num_likes} />
      </div>
    </article>
  );
}
```
`skins/x/XFeed.tsx`:
```tsx
// review:P3-T3  X 皮肤入口（只消费 ViewModel）
import type { Actor } from "../../model/canonical";
import type { PosterViewModel } from "../../pov/poster";
import { XPost } from "./XPost";
import { XReply } from "./XReply";
export function XFeed({ vm, onActorClick }:
  { vm: PosterViewModel; onActorClick?: (a: Actor) => void }) {
  if (!vm.seedPost || !vm.me)
    return <div className="rounded-card border border-slate-200 bg-white p-6 text-slate-400">等待第一条…</div>;
  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <XPost post={vm.seedPost} author={vm.me} replyCount={vm.thread.length} onAuthorClick={onActorClick} />
      {vm.thread.map((t) => (
        <XReply key={t.reply.comment_id} reply={t.reply} author={t.author} onAuthorClick={onActorClick} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: 运行确认通过** — `npm test -- xskin` → PASS（4 passed）。
- [ ] **Step 6: 提交**
```bash
git add frontend/src/skins frontend/src/index.css
git commit -m "feat(frontend): X 皮肤组件（Feed/Post/Reply/ActionBar/Avatar）

Review-Anchor: P3-T3"
```

---

### Task 4 (P3-T4): useRunStream 钩子（SSE，可注入）

**Files:** Create `frontend/src/api/runStream.ts`；Test `frontend/src/api/runStream.test.ts`.

**Interfaces — Produces:**
- `type EventSourceFactory = (url: string) => EventSource`
- `type StreamStatus = "connecting"|"running"|"done"|"error"`
- `interface RunStreamState { snapshot: RunSnapshot; step: number; total: number; status: StreamStatus; error?: string }`
- `useRunStream(runId: string, factory?: EventSourceFactory): RunStreamState`
- 解析契约 §2.3 事件：`run_started`(设 total、status=running)、`step_started`(设 step/total)、`delta`(applyDelta 累加)、`run_done`(status=done、close)、`error`(status=error)。

- [ ] **Step 1: 写失败测试 `api/runStream.test.ts`**
```ts
import { renderHook, act } from "@testing-library/react";
import { useRunStream } from "./runStream";

class FakeES {
  static last: FakeES;
  listeners: Record<string, ((e: { data: string }) => void)[]> = {};
  closed = false;
  constructor() { FakeES.last = this; }
  addEventListener(n: string, cb: (e: { data: string }) => void) {
    (this.listeners[n] ??= []).push(cb);
  }
  emit(n: string, data: unknown) {
    (this.listeners[n] ?? []).forEach((cb) => cb({ data: JSON.stringify(data) }));
  }
  close() { this.closed = true; }
}

test("hook accumulates deltas and finishes", () => {  // review:P3-T4-AC1
  const factory = () => new FakeES() as unknown as EventSource;
  const { result } = renderHook(() => useRunStream("r_1", factory));
  const es = FakeES.last;
  act(() => es.emit("run_started", { run_id: "r_1", steps: 6, platform: "twitter" }));
  expect(result.current.total).toBe(6);
  expect(result.current.status).toBe("running");
  act(() => es.emit("step_started", { step: 1, total: 6 }));
  act(() => es.emit("delta", { step: 1, snapshot: { platform: "twitter",
    seed_post_id: 1, actors: [], posts: [{ post_id: 1, author_id: 1, kind: "original",
    content: "hi", num_likes: 0, num_dislikes: 0, num_shares: 0, num_reports: 0 }],
    replies: [], reactions: [], follows: [], reports: [], traces: [] } }));
  expect(result.current.snapshot.posts).toHaveLength(1);
  expect(result.current.step).toBe(1);
  act(() => es.emit("run_done", { run_id: "r_1" }));
  expect(result.current.status).toBe("done");
});

test("error event sets error status", () => {  // review:P3-T4-AC2
  const factory = () => new FakeES() as unknown as EventSource;
  const { result } = renderHook(() => useRunStream("r_x", factory));
  act(() => FakeES.last.emit("error", { message: "LLM key invalid" }));
  expect(result.current.status).toBe("error");
  expect(result.current.error).toBe("LLM key invalid");
});
```

- [ ] **Step 2: 运行确认失败** — `npm test -- runStream` → FAIL。

- [ ] **Step 3: 写实现 `api/runStream.ts`**
```ts
// review:P3-T4  消费契约 §2.3 SSE
import { useEffect, useState } from "react";
import type { RunSnapshot } from "../model/canonical";
import { emptySnapshot, applyDelta } from "../model/accumulate";

export type EventSourceFactory = (url: string) => EventSource;
export type StreamStatus = "connecting" | "running" | "done" | "error";
export interface RunStreamState {
  snapshot: RunSnapshot; step: number; total: number;
  status: StreamStatus; error?: string;
}

const defaultFactory: EventSourceFactory = (url) => new EventSource(url);

export function useRunStream(runId: string, factory: EventSourceFactory = defaultFactory): RunStreamState {
  const [state, setState] = useState<RunStreamState>({
    snapshot: emptySnapshot(), step: 0, total: 0, status: "connecting" });

  useEffect(() => {
    const es = factory(`/api/runs/${runId}/events`);
    const on = (name: string, fn: (d: any) => void) =>
      es.addEventListener(name, (e) => fn(JSON.parse((e as MessageEvent).data)));
    on("run_started", (d) => setState((s) => ({ ...s, total: d.steps, status: "running" })));
    on("step_started", (d) => setState((s) => ({ ...s, step: d.step, total: d.total })));
    on("delta", (d) => setState((s) => ({ ...s, snapshot: applyDelta(s.snapshot, d.snapshot) })));
    on("run_done", () => { setState((s) => ({ ...s, status: "done" })); es.close(); });
    on("error", (d) => setState((s) => ({ ...s, status: "error", error: d?.message })));
    return () => es.close();
  }, [runId]);

  return state;
}
```

- [ ] **Step 4: 运行确认通过** — `npm test -- runStream` → PASS（2 passed）。
- [ ] **Step 5: 提交**
```bash
git add frontend/src/api
git commit -m "feat(frontend): useRunStream SSE 钩子（可注入 EventSource）

Review-Anchor: P3-T4"
```

---

### Task 5 (P3-T5): LiveScreen 装配 + 悬浮控制条

**Files:** Modify `frontend/src/screens/LiveScreen.tsx`（替换 F0 占位）；Test `frontend/src/screens/LiveScreen.test.tsx`.

**Interfaces — Produces:** `LiveScreen({ streamFactory? })`：读路由 `:id` → `useRunStream` → `posterView` → `<XFeed>`；悬浮控制条显示 `第 step/total 步` + 暂停/加速占位 + "看结果 →"（`status==="done"` 才可点，跳 `/run/:id/retro`）。

- [ ] **Step 1: 写失败测试 `screens/LiveScreen.test.tsx`**
```tsx
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LiveScreen from "./LiveScreen";

class FakeES {
  static last: FakeES;
  listeners: Record<string, ((e: { data: string }) => void)[]> = {};
  constructor() { FakeES.last = this; }
  addEventListener(n: string, cb: (e: { data: string }) => void) { (this.listeners[n] ??= []).push(cb); }
  emit(n: string, d: unknown) { (this.listeners[n] ?? []).forEach((cb) => cb({ data: JSON.stringify(d) })); }
  close() {}
}

function mount() {
  const factory = () => new FakeES() as unknown as EventSource;
  render(
    <MemoryRouter initialEntries={["/run/r_1/live"]}>
      <Routes>
        <Route path="/run/:id/live" element={<LiveScreen streamFactory={factory} />} />
        <Route path="/run/:id/retro" element={<div>复盘页</div>} />
      </Routes>
    </MemoryRouter>
  );
}

test("streams seed post then reply, shows step counter", () => {  // review:P3-T5-AC1
  mount();
  const es = FakeES.last;
  act(() => es.emit("run_started", { steps: 6 }));
  act(() => es.emit("step_started", { step: 1, total: 6 }));
  act(() => es.emit("delta", { step: 1, snapshot: { platform: "twitter", seed_post_id: 1,
    actors: [{ user_id: 1, user_name: "you", name: "你", num_followers: 0, num_followings: 0 }],
    posts: [{ post_id: 1, author_id: 1, kind: "original", content: "构建砍到3秒",
      num_likes: 0, num_dislikes: 0, num_shares: 0, num_reports: 0 }],
    replies: [], reactions: [], follows: [], reports: [], traces: [] } }));
  expect(screen.getByText("构建砍到3秒")).toBeInTheDocument();
  expect(screen.getByText(/1/)).toBeInTheDocument();  // 步数计
});

test("see-results disabled until done, then navigates", () => {  // review:P3-T5-AC2
  mount();
  const es = FakeES.last;
  act(() => es.emit("run_started", { steps: 6 }));
  const btn = screen.getByText(/看结果/);
  expect(btn).toBeDisabled();
  act(() => es.emit("run_done", { run_id: "r_1" }));
  fireEvent.click(screen.getByText(/看结果/));
  expect(screen.getByText("复盘页")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行确认失败** — `npm test -- LiveScreen` → FAIL。

- [ ] **Step 3: 写实现 `screens/LiveScreen.tsx`**
```tsx
// review:P3-T5  进行时装配（第一人称 X 皮肤 + 悬浮控制条）
import { useParams, useNavigate } from "react-router-dom";
import { useRunStream, type EventSourceFactory } from "../api/runStream";
import { posterView } from "../pov/poster";
import { XFeed } from "../skins/x/XFeed";

export default function LiveScreen({ streamFactory }: { streamFactory?: EventSourceFactory }) {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { snapshot, step, total, status } = useRunStream(id, streamFactory);
  const vm = posterView(snapshot);
  return (
    <div className="relative">
      <XFeed vm={vm} />
      <div className="sticky bottom-4 mt-6 flex items-center gap-4 rounded-card bg-ink px-4 py-2 text-sm text-cream shadow-spotlight">
        <span>第 <span className="tabular">{step}</span>/<span className="tabular">{total}</span> 步</span>
        <button className="opacity-70" aria-label="暂停">▐▐</button>
        <button className="opacity-70" aria-label="加速">⏩</button>
        <button className="ml-auto disabled:opacity-40"
          disabled={status !== "done"} onClick={() => nav(`/run/${id}/retro`)}>
          看结果 →
        </button>
      </div>
    </div>
  );
}
```
> 注：暂停/加速本 Plan 仅占位（不改变流速）；真正的播放节流留到后续（不影响契约）。

- [ ] **Step 4: 运行确认通过** — `npm test -- LiveScreen` → PASS（2 passed）。
- [ ] **Step 5: 回归全部前端测试** — `cd frontend && npm test` → 全绿（F0 + P3 全部）。
- [ ] **Step 6: 提交**
```bash
git add frontend/src/screens/LiveScreen.tsx frontend/src/screens/LiveScreen.test.tsx
git commit -m "feat(frontend): LiveScreen 流式装配 + 悬浮控制条

Review-Anchor: P3-T5"
```

---

## 审核索引（Review Index）

| 锚点 | 断言 | 审核凭据 |
|---|---|---|
| P3-T1-AC1 | applyDelta 拼接、seed_post_id 首次落定 | `model/canonical.test.ts` |
| P3-T1-AC2 | applyDelta 不可变 | `model/canonical.test.ts` |
| P3-T2-AC1 | me/seedPost 解析 | `pov/poster.test.ts` |
| P3-T2-AC2 | thread 关联作者 | `pov/poster.test.ts` |
| P3-T2-AC3 | notifications 含 like/repost/follow | `pov/poster.test.ts` |
| P3-T2-AC4 | 空快照返回 null | `pov/poster.test.ts` |
| P3-T3-AC1 | Feed 渲染种子帖+评论 | `skins/x/xskin.test.tsx` |
| P3-T3-AC2 | 计数用 tabular | `skins/x/xskin.test.tsx` |
| P3-T3-AC3 | 点头像回调 | `skins/x/xskin.test.tsx` |
| P3-T3-AC4 | 空 Feed 显示等待 | `skins/x/xskin.test.tsx` |
| P3-T4-AC1 | 钩子累加 delta 并 done | `api/runStream.test.ts` |
| P3-T4-AC2 | error 事件置 error 状态 | `api/runStream.test.ts` |
| P3-T5-AC1 | 流式出种子帖+步数计 | `screens/LiveScreen.test.tsx` |
| P3-T5-AC2 | 看结果 done 后可跳转 | `screens/LiveScreen.test.tsx` |

## Self-Review
- **Spec 覆盖**：实现 spec §2 第一人称 poster 视角、§3 核心循环第 4 步"进行时流式回放"、§6.1 X 皮肤（tabular 计数、评论 fadein 刷出、以假乱真无品牌）、§7.3 进行时线框（信息流 + 悬浮控制条）。契约 §2.3（SSE）与 §2.6（POV→ViewModel）落地并定稿。
- **占位符扫描**：无 TBD；暂停/加速为**有意占位**（已注明，不影响契约），其余均有完整代码与命令。
- **类型一致性**：TS `RunSnapshot` 字段与 Plan 1 pydantic 完全同名；`PosterViewModel` 在 poster.ts 定义、被 XFeed/LiveScreen 消费；`EventSourceFactory` 在 runStream 定义、LiveScreen 透传；皮肤只依赖 ViewModel（不 import canonical 之外的后端概念）。
