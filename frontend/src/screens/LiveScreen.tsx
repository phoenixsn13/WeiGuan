import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { fetchRunSnapshot } from "../api/client";
import { useRunStream, type EventSourceFactory } from "../api/runStream";
import { InterviewDrawer } from "../components/InterviewDrawer";
import { emptySnapshot } from "../model/accumulate";
import type { Actor, RunSnapshot } from "../model/canonical";
import { posterView } from "../pov/poster";
import { actorRows, hotRows, repostRows, timelineRows } from "../pov/social";
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

function LiveRail({
  selected,
  step,
  total,
  replyCount,
  replay,
  mode,
  onModeChange,
}: {
  selected: Actor | null;
  step: number;
  total: number;
  replyCount: number;
  replay: boolean;
  mode: XFeedMode;
  onModeChange: (mode: XFeedMode) => void;
}) {
  const selectedHandle = selected?.user_name ?? selected?.user_id;
  const progress = total > 0 ? Math.max(6, Math.round((step / total) * 100)) : 100;
  return (
    <aside className="hidden min-h-[680px] rounded-card bg-slate-950 p-5 text-white shadow-chrome xl:block">
      <div className="mb-8">
        <div className="text-xs font-semibold text-white/40">当前视角</div>
        <div className="mt-2 text-lg font-black">
          {selected ? `@${selectedHandle}` : "我看到的"}
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
              <span>实时互动</span>
              <span className="tabular">{replyCount} 条新评论</span>
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
  const [replaySnapshot, setReplaySnapshot] = useState<RunSnapshot | null>(null);
  const [selected, setSelected] = useState<Actor | null>(null);
  const [mode, setMode] = useState<XFeedMode>("comments");
  const snapshot = replay ? replaySnapshot ?? emptySnapshot() : stream.snapshot;
  const step = replay ? 0 : stream.step;
  const total = replay ? 0 : stream.total;
  const status = replay ? "done" : stream.status;
  const vm = posterView(snapshot);
  const reposts = repostRows(snapshot);
  const actors = actorRows(snapshot);
  const hot = hotRows(snapshot);
  const timeline = timelineRows(snapshot);
  const selectedHandle = selected?.user_name ?? selected?.user_id;

  useEffect(() => {
    if (!replay) return;
    fetchRunSnapshot(id)
      .then(setReplaySnapshot)
      .catch(() => setReplaySnapshot(null));
  }, [id, replay]);

  return (
    <div className="relative grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <LiveRail
        selected={selected}
        step={step}
        total={total}
        replyCount={vm.thread.length}
        replay={replay}
        mode={mode}
        onModeChange={setMode}
      />
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-3 shadow-spotlight">
          <div>
            <div className="text-lg font-black">
              {selected ? `正在从 @${selectedHandle} 的视角看` : "我看到的"}
            </div>
            <div className="mt-0.5 text-sm text-slate-500">
              {replay
                ? "历史回放，只读取已保存的评论区"
                : status === "done"
                  ? "围观已完成"
                  : "评论和通知会逐步刷出来"}
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
            {!replay && (
              <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-2 sm:flex">
                <span>
                  第 <span className="tabular">{step}</span>/
                  <span className="tabular">{total}</span> 步
                </span>
                <span className="h-2 w-20 rounded-full bg-slate-200">
                  <span
                    className="block h-2 rounded-full bg-brand"
                    style={{ width: `${total ? Math.round((step / total) * 100) : 8}%` }}
                  />
                </span>
              </div>
            )}
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
        />

        <div className="sticky bottom-4 z-10 mx-auto mt-4 flex max-w-4xl items-center gap-3 rounded-card border border-line bg-white/95 px-4 py-3 text-sm text-ink shadow-chrome backdrop-blur">
        <span
          className={[
            "h-2.5 w-2.5 rounded-full",
            status === "done" ? "bg-sentiment-positive" : "bg-brand",
          ].join(" ")}
        />
        <span className="mr-auto">
          {replay ? "历史回放" : status === "done" ? "围观完成" : "围观进行中"}
        </span>
        <button className="hidden min-h-11 cursor-not-allowed rounded-card px-3 text-ink/30 sm:block" disabled title="逐步回放需要后端保存帧数据">
          回到开始
        </button>
        <button className="hidden min-h-11 cursor-not-allowed rounded-card px-3 text-ink/30 sm:block" disabled title="逐步回放需要后端保存帧数据">
          上一步
        </button>
        <button className="grid min-h-12 min-w-12 cursor-not-allowed place-items-center rounded-full bg-slate-300 text-lg font-bold text-white" disabled title="暂停/继续需要流控接口">
          暂停
        </button>
        <button className="hidden min-h-11 cursor-not-allowed rounded-card px-3 text-ink/30 sm:block" disabled title="逐步回放需要后端保存帧数据">
          下一步
        </button>
        <button className="hidden min-h-11 cursor-not-allowed rounded-card px-3 text-ink/30 sm:block" disabled title="逐步回放需要后端保存帧数据">
          到结尾
        </button>
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
