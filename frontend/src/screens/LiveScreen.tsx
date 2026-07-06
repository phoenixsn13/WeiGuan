import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  fetchRunSnapshot,
  fetchRunSummary,
  type RunSummary,
  type WindowedRunSnapshot,
} from "../api/client";
import { useRunStream, type EventSourceFactory } from "../api/runStream";
import { InterviewDrawer } from "../components/InterviewDrawer";
import { emptySnapshot } from "../model/accumulate";
import type { Actor, RunSnapshot } from "../model/canonical";
import { posterView } from "../pov/poster";
import { actorRows, hotRows, repostRows, timelineRows } from "../pov/social";
import { displayHandle, displayName } from "../skins/x/identity";
import { XFeed, type XFeedMode } from "../skins/x/XFeed";

function RailButton({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "flex min-h-12 w-full items-center gap-3 rounded-card px-3 text-left text-sm font-semibold transition",
        active
          ? "bg-white/10 text-white shadow-[inset_3px_0_0_#F5B12F]"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      ].join(" ")}
      onClick={onClick}
    >
      <span className="grid h-5 w-5 place-items-center">{icon}</span>
      {label}
    </button>
  );
}

function MiniIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function snapshotFromSummary(summary: RunSummary | null): RunSnapshot | null {
  if (!summary) return null;
  return {
    ...emptySnapshot(),
    platform: summary.platform,
    seed_post_id: 1,
    actors: [
      {
        user_id: 0,
        person_id: summary.poster_person_id ?? null,
        world_id: summary.world_id ?? null,
        user_name: "me",
        name: "我",
        num_followers: 0,
        num_followings: 0,
      },
    ],
    posts: [
      {
        post_id: 1,
        author_id: 0,
        kind: "original",
        content: summary.content,
        num_likes: 0,
        num_dislikes: 0,
        num_shares: 0,
        num_reports: 0,
      },
    ],
  };
}

function LiveRail({
  selected,
  step,
  total,
  replyCount,
  totalReplyCount,
  replay,
  mode,
  onModeChange,
}: {
  selected: Actor | null;
  step: number;
  total: number;
  replyCount: number;
  totalReplyCount: number;
  replay: boolean;
  mode: XFeedMode;
  onModeChange: (mode: XFeedMode) => void;
}) {
  const selectedLabel = selected
    ? displayHandle(selected)
      ? `@${displayHandle(selected)}`
      : displayName(selected)
    : "";
  const progress = total > 0 ? Math.max(6, Math.round((step / total) * 100)) : 100;
  return (
    <aside className="hidden h-full min-h-[760px] rounded-card bg-slate-950 p-5 text-white shadow-chrome xl:flex xl:flex-col">
      <div className="mb-8">
        <div className="text-xs font-semibold text-white/40">当前视角</div>
        <div className="mt-2 text-lg font-black">
          {selected ? selectedLabel : "我看到的"}
        </div>
        <div className="mt-1 text-sm leading-6 text-white/60">
          {selected ? "从这个人当时可能看到的内容理解他的反应。" : "像打开自己的微博正文一样看评论发酵。"}
        </div>
      </div>

      <nav className="grid gap-2">
        <RailButton active={mode === "comments"} onClick={() => onModeChange("comments")} icon={<MiniIcon path="M3 10.5 12 3l9 7.5M5 10v10h14V10" />} label="我的视角" />
        <RailButton active={mode === "timeline"} onClick={() => onModeChange("timeline")} icon={<MiniIcon path="M4 5h16M4 12h16M4 19h16" />} label="时间线" />
        <RailButton active={mode === "people"} onClick={() => onModeChange("people")} icon={<MiniIcon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />} label="人物" />
        <RailButton active={mode === "hot"} onClick={() => onModeChange("hot")} icon={<MiniIcon path="m13 2-2 7h7l-9 13 2-8H4l9-12Z" />} label="热门" />
        <RailButton active={mode === "notifications"} onClick={() => onModeChange("notifications")} icon={<MiniIcon path="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />} label="通知" />
      </nav>

      <div className="mt-auto pt-8">
        <div className="rounded-card border border-white/10 bg-white/[0.06] p-4">
          <div className="text-sm font-bold">当前围观</div>
          <div className="mt-3 space-y-3 text-sm text-white/70">
            <div className="flex justify-between">
              <span>执行进度</span>
              <span className="tabular">{replay ? "回放" : `${step}/${total}`}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between">
              <span>{replay ? "回放" : "互动"}</span>
              <span className="tabular">
                {replay ? `共 ${totalReplyCount} 条评论` : `${replyCount} 条新评论`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// review:P3-T5  进行时装配（第一人称 X 皮肤 + 悬浮控制条）
export default function LiveScreen({
  streamFactory,
}: {
  streamFactory?: EventSourceFactory;
}) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const replay = searchParams.get("replay") === "1";
  const stream = useRunStream(id, streamFactory, !replay);
  const [replaySnapshot, setReplaySnapshot] = useState<WindowedRunSnapshot | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [selected, setSelected] = useState<Actor | null>(null);
  const [mode, setMode] = useState<XFeedMode>("comments");
  const pendingSnapshot = snapshotFromSummary(runSummary);
  const snapshot = replay
    ? replaySnapshot ?? emptySnapshot()
    : stream.snapshot.seed_post_id
      ? stream.snapshot
      : pendingSnapshot ?? stream.snapshot;
  const step = replay ? 0 : stream.step || runSummary?.current_step || 0;
  const total = replay ? 0 : stream.total || runSummary?.steps || 0;
  const status = replay ? "done" : stream.status;
  const vm = posterView(snapshot);
  const reposts = repostRows(snapshot);
  const actors = actorRows(snapshot);
  const hot = hotRows(snapshot);
  const timeline = timelineRows(snapshot);
  const totalReplayReplies = replaySnapshot?.window?.totals?.replies ?? vm.thread.length;
  const canLoadOlder = replay && totalReplayReplies > (replaySnapshot?.replies.length ?? 0);
  const selectedLabel = selected
    ? displayHandle(selected)
      ? `@${displayHandle(selected)}`
      : displayName(selected)
    : "";

  function identityHrefForActor(actor: Actor): string | undefined {
    const personId = actor.person_id ?? (actor.user_id === 0 ? runSummary?.poster_person_id : null);
    const worldId = actor.world_id ?? runSummary?.world_id;
    if (!personId || !worldId) return undefined;
    return `/identity/${personId}?world_id=${worldId}`;
  }

  useEffect(() => {
    if (!replay) return;
    fetchRunSnapshot(id, { tail: 200 })
      .then(setReplaySnapshot)
      .catch(() => setReplaySnapshot(null));
  }, [id, replay]);

  function mergeReplaySnapshot(
    current: WindowedRunSnapshot | null,
    page: WindowedRunSnapshot,
  ): WindowedRunSnapshot {
    if (!current) return page;
    const pageReplyIds = new Set(page.replies.map((reply) => reply.comment_id));
    const replies = [
      ...page.replies,
      ...current.replies.filter((reply) => !pageReplyIds.has(reply.comment_id)),
    ].sort((left, right) => left.comment_id - right.comment_id);
    const pageActorIds = new Set(page.actors.map((actor) => actor.user_id));
    const actors = [
      ...page.actors,
      ...current.actors.filter((actor) => !pageActorIds.has(actor.user_id)),
    ];
    const pagePostIds = new Set(page.posts.map((post) => post.post_id));
    const posts = [
      ...page.posts,
      ...current.posts.filter((post) => !pagePostIds.has(post.post_id)),
    ];
    return { ...current, actors, posts, replies, window: page.window ?? current.window };
  }

  function loadOlderReplies() {
    if (!replaySnapshot || loadingOlder) return;
    setLoadingOlder(true);
    fetchRunSnapshot(id, {
      repliesOffset: replaySnapshot.replies.length,
      repliesLimit: 200,
    })
      .then((page) => setReplaySnapshot((current) => mergeReplaySnapshot(current, page)))
      .catch(() => {})
      .finally(() => setLoadingOlder(false));
  }

  useEffect(() => {
    if (replay) return;
    fetchRunSummary(id)
      .then(setRunSummary)
      .catch(() => setRunSummary(null));
  }, [id, replay]);

  return (
    <div className="relative grid items-stretch gap-4 pb-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <LiveRail
        selected={selected}
        step={step}
        total={total}
        replyCount={vm.thread.length}
        totalReplyCount={totalReplayReplies}
        replay={replay}
        mode={mode}
        onModeChange={setMode}
      />
      <div className="flex min-w-0 flex-col">
        <div
          aria-label="当前页面状态"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-3 shadow-spotlight"
        >
          <div>
            <div className="text-lg font-black">
              {selected ? `正在从 ${selectedLabel} 的视角看` : "我看到的"}
            </div>
            <div className="mt-0.5 text-sm text-slate-500">
              {replay
                ? "历史回放，只读取已保存的评论区"
                : status === "done"
                  ? "围观已完成"
                  : "评论和通知会逐渐刷出来"}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {selected && (
              <button
                className="min-h-11 rounded-card border border-line bg-white px-3 font-semibold hover:border-accent hover:text-accent"
                onClick={() => setSelected(null)}
              >
                回到我看到的
              </button>
            )}
            <button
              className="min-h-11 rounded-card border border-line bg-white px-3 font-semibold hover:border-accent hover:text-accent"
              onClick={() => navigate("/history")}
            >
              历史记录
            </button>
          </div>
        </div>

        <XFeed
          vm={vm}
          onActorClick={setSelected}
          selectedActorId={selected?.user_id ?? null}
          mode={mode}
          onModeChange={setMode}
          onBack={() => setMode("comments")}
          reposts={reposts}
          actors={actors}
          hot={hot}
          timeline={timeline}
          identityHrefForActor={identityHrefForActor}
          onIdentityClick={navigate}
        />

        {canLoadOlder && mode === "comments" && (
          <div className="mt-3 flex justify-center">
            <button
              className="min-h-11 rounded-card border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loadingOlder}
              onClick={loadOlderReplies}
            >
              {loadingOlder ? "加载中..." : "加载更早评论"}
            </button>
          </div>
        )}

        <div className="sticky bottom-4 z-10 mx-auto mt-4 flex max-w-3xl items-center gap-3 rounded-card border border-line bg-white/95 px-4 py-3 text-sm text-ink shadow-chrome backdrop-blur">
        <span
          className={[
            "h-2.5 w-2.5 rounded-full",
            status === "done" ? "bg-sentiment-positive" : "bg-brand",
          ].join(" ")}
        />
        <span className="font-medium">
          {replay ? "历史回放" : status === "done" ? "围观完成" : "围观进行中"}
        </span>
        <span className="mr-auto hidden text-slate-500 sm:inline">
          {replay ? `回放 · 共 ${totalReplayReplies} 条评论` : `${vm.thread.length} 条评论`}
        </span>
        <button
          className="min-h-11 rounded-card bg-ink px-4 text-cream disabled:cursor-not-allowed disabled:opacity-40"
          disabled={status !== "done"}
          onClick={() => navigate(`/run/${id}/retro`)}
        >
          看结果
        </button>
        </div>
      </div>
      <InterviewDrawer runId={id} actor={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
