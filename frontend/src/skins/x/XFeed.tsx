import type { ReactNode } from "react";

import { ChevronLeftIcon, MoreHorizontalIcon, PinIcon } from "../../components/icons";
import type { Actor } from "../../model/canonical";
import type { PosterViewModel } from "../../pov/poster";
import type { ActorRow, HotRow, RepostRow, TimelineRow } from "../../pov/social";
import { displayHandle, displayName } from "./identity";
import { latestSocialTime, relativeSocialTime } from "./time";
import { XPost } from "./XPost";
import { XReply } from "./XReply";

export type XFeedMode = "comments" | "reposts" | "notifications" | "people" | "hot" | "timeline";

function NoticeIcon({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    like: "M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3m0 11V9l4-7 1 1a4 4 0 0 1 1 4l-1 2h5a3 3 0 0 1 3 3l-2 7a4 4 0 0 1-4 3H7Z",
    repost: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3",
    quote: "M7 8h10M7 12h7m-8 8h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13l4-3Z",
    follow: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12.5 0h-6m3-3v6",
  };
  const color =
    kind === "like"
      ? "bg-rose-50 text-rose-500"
      : kind === "follow"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-blue-50 text-accent";
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-card ${color}`}>
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path d={map[kind]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

// review:P3-T3  X 皮肤入口（只消费 ViewModel）
export function XFeed({
  vm,
  onActorClick,
  selectedActorId,
  mode = "comments",
  onModeChange,
  onBack,
  reposts = [],
  actors = [],
  hot = [],
  timeline = [],
  identityHrefForActor,
  onIdentityClick,
}: {
  vm: PosterViewModel;
  onActorClick?: (actor: Actor) => void;
  selectedActorId?: number | null;
  mode?: XFeedMode;
  onModeChange?: (mode: XFeedMode) => void;
  onBack?: () => void;
  reposts?: RepostRow[];
  actors?: ActorRow[];
  hot?: HotRow[];
  timeline?: TimelineRow[];
  identityHrefForActor?: (actor: Actor) => string | undefined;
  onIdentityClick?: (href: string) => void;
}) {
  if (!vm.seedPost || !vm.me) {
    return (
      <div className="rounded-card border border-line bg-white p-10 text-center text-slate-400 shadow-spotlight">
        等待第一条内容出现...
      </div>
    );
  }

  const selectedActor = vm.thread.find((item) => item.author.user_id === selectedActorId)
    ?.author;
  const tabClass = (tab: XFeedMode) =>
    ["h-14 border-b-2", mode === tab ? "border-brand text-ink" : "border-transparent text-slate-500 hover:text-accent"].join(" ");
  const modeTitle: Record<XFeedMode, string> = {
    comments: "微博正文",
    reposts: "转发",
    notifications: "通知",
    people: "人物",
    hot: "热门",
    timeline: "时间线",
  };
  const latestAt = latestSocialTime([
    vm.seedPost.created_at,
    ...vm.thread.map((item) => item.reply.created_at),
    ...vm.notifications.map((notice) => notice.created_at),
    ...reposts.map((row) => row.post.created_at),
    ...timeline.map((row) => row.at),
  ]);

  return (
    <div className="grid min-h-[680px] overflow-hidden rounded-card border border-line bg-white shadow-spotlight lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 border-line lg:border-r">
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <button
            className={[
              "flex min-h-11 items-center gap-2 text-sm font-medium",
              onBack ? "text-slate-600 hover:text-accent" : "cursor-not-allowed text-slate-300",
            ].join(" ")}
            onClick={onBack}
            disabled={!onBack}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            返回
          </button>
          <div className="text-center">
            <div className="text-[15px] font-bold">{modeTitle[mode]}</div>
            <div className="text-xs text-slate-500">{selectedActor ? "他看到的内容" : "我看到的"}</div>
          </div>
          <button
            className="grid min-h-11 min-w-11 cursor-not-allowed place-items-center rounded-card text-lg text-slate-300"
            disabled
            title="更多操作还未开放"
          >
            <MoreHorizontalIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-line px-6 py-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
            <PinIcon className="h-3.5 w-3.5 text-brand" />
            置顶
          </div>
          <XPost
            post={vm.seedPost}
            author={vm.me}
            replyCount={vm.thread.length}
            nowAt={latestAt}
            onAuthorClick={onActorClick}
            identityHref={identityHrefForActor?.(vm.me)}
            onIdentityClick={onIdentityClick}
          />
        </div>

        <div className="flex h-14 items-end gap-8 border-b border-line px-6 text-[15px] font-semibold">
          <button className={tabClass("comments")} onClick={() => onModeChange?.("comments")}>
            评论 <span className="tabular">{vm.thread.length}</span>
          </button>
          <button className={tabClass("reposts")} onClick={() => onModeChange?.("reposts")}>
            转发 <span className="tabular">{reposts.length || vm.seedPost.num_shares}</span>
          </button>
          <button className={tabClass("notifications")} onClick={() => onModeChange?.("notifications")}>
            通知 <span className="tabular">{vm.notifications.length}</span>
          </button>
          <div className="ml-auto hidden h-14 items-center text-sm text-slate-500 sm:flex">
            按时间
          </div>
        </div>

        <div
          aria-label="评论区滚动窗口"
          className="max-h-[410px] overflow-y-auto overscroll-contain"
        >
          {mode === "comments" && vm.thread.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              还没有人回复。评论出现后会在这里刷出来。
            </div>
          )}
          {mode === "comments" && vm.thread.map((item) => (
            <XReply
              key={item.reply.comment_id}
              reply={item.reply}
              author={item.author}
              nowAt={latestAt}
              selected={item.author.user_id === selectedActorId}
              onAuthorClick={onActorClick}
              identityHref={identityHrefForActor?.(item.author)}
              onIdentityClick={onIdentityClick}
            />
          ))}
          {mode === "reposts" && (
            <PanelList empty="还没有人转发。">
              {reposts.map((row) => (
                <button
                  key={row.post.post_id}
                  className="flex w-full gap-3 border-b border-line px-6 py-4 text-left hover:bg-slate-50"
                  onClick={() => onActorClick?.(row.author)}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">
                    {displayName(row.author).slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-950">
                      {displayHandle(row.author)
                        ? `@${displayHandle(row.author)}`
                        : displayName(row.author)}{" "}
                      · {row.label}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-700">{row.text}</div>
                  </div>
                </button>
              ))}
            </PanelList>
          )}
          {mode === "notifications" && (
            <PanelList empty="暂时没有新的通知。">
              {vm.notifications.map((notice) => (
                <div key={notice.id} className="flex gap-3 border-b border-line px-6 py-4 text-sm">
                  <NoticeIcon kind={notice.kind} />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">
                      {displayHandle(notice.actor)
                        ? `@${displayHandle(notice.actor)}`
                        : displayName(notice.actor)}
                    </div>
                    <div className="mt-1 line-clamp-2 text-slate-500">
                      {notice.kind === "like" && "赞了你的微博"}
                      {notice.kind === "repost" && "转发了你的微博"}
                      {notice.kind === "quote" && "引用并讨论了你的微博"}
                      {notice.kind === "follow" && "关注了你"}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {relativeSocialTime(notice.created_at, latestAt)}
                    </div>
                  </div>
                </div>
              ))}
            </PanelList>
          )}
          {mode === "people" && (
            <PanelList empty="还没有参与人物。">
              {actors.map((row) => (
                <button
                  key={row.actor.user_id}
                  className="flex w-full items-center gap-3 border-b border-line px-6 py-4 text-left hover:bg-slate-50"
                  onClick={() => onActorClick?.(row.actor)}
                >
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">
                    {displayName(row.actor).slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-950">
                      {displayHandle(row.actor)
                        ? `@${displayHandle(row.actor)}`
                        : displayName(row.actor)}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{row.summary}</div>
                  </div>
                  <div className="tabular text-sm font-bold text-accent">{row.score}</div>
                </button>
              ))}
            </PanelList>
          )}
          {mode === "hot" && (
            <PanelList empty="还没有热门互动。">
              {hot.map((row) => (
                <div key={row.id} className="border-b border-line px-6 py-4">
                  <div className="text-xs font-bold text-accent">{row.kind} · {row.score}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-800">{row.text}</div>
                  {row.author && (
                    <button
                      className="mt-2 text-sm font-semibold text-slate-500 hover:text-accent"
                      onClick={() => onActorClick?.(row.author as Actor)}
                    >
                      {displayHandle(row.author)
                        ? `@${displayHandle(row.author)}`
                        : displayName(row.author)}
                    </button>
                  )}
                </div>
              ))}
            </PanelList>
          )}
          {mode === "timeline" && (
            <PanelList empty="还没有时间线事件。">
              {timeline.map((row) => (
                <div key={row.id} className="border-b border-line px-6 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-accent">{row.kind}</div>
                    <div className="text-xs text-slate-400">
                      {relativeSocialTime(row.at, latestAt)}
                    </div>
                  </div>
                  <div className="mt-1 font-bold text-slate-950">{row.title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-600">{row.detail}</div>
                </div>
              ))}
            </PanelList>
          )}
        </div>
      </section>

      <aside className="hidden bg-white p-6 lg:block">
        <div className="mb-3 flex h-8 items-center justify-between">
          <h2 className="text-[17px] font-bold">通知</h2>
          <span className="text-xs text-slate-400">最近动态</span>
        </div>
        <div className="grid gap-1">
          {vm.notifications.slice(0, 5).map((notice) => (
            <div key={notice.id} className="flex gap-3 border-b border-line py-4 text-sm">
              <NoticeIcon kind={notice.kind} />
              <div className="min-w-0">
                <div className="font-semibold text-slate-950">
                  {notice.kind === "like" && "你的微博获得了赞"}
                  {notice.kind === "repost" && "这条开始被转发"}
                  {notice.kind === "quote" && "有人引用了你的微博"}
                  {notice.kind === "follow" &&
                    `${displayHandle(notice.actor) ? `@${displayHandle(notice.actor)}` : displayName(notice.actor)} 关注了你`}
                </div>
                <div className="mt-1 line-clamp-2 text-slate-500">
                  {displayHandle(notice.actor)
                    ? `@${displayHandle(notice.actor)}`
                    : displayName(notice.actor)}
                  {notice.kind === "like" && " 等人赞了你的微博"}
                  {notice.kind === "repost" && " 转发了你的微博"}
                  {notice.kind === "quote" && " 正在讨论你的微博"}
                  {notice.kind === "follow" && " 可能会继续关注后续"}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {relativeSocialTime(notice.created_at, latestAt)}
                </div>
              </div>
            </div>
          ))}
          {vm.notifications.length === 0 && (
            <div className="rounded-card border border-dashed border-line bg-slate-50 p-5 text-sm text-slate-400">
              暂时没有新的通知。
            </div>
          )}
          {vm.notifications.length > 0 && (
            <button
              className="mt-4 min-h-11 rounded-card text-sm font-semibold text-accent hover:bg-blue-50"
              onClick={() => onModeChange?.("notifications")}
            >
              查看全部通知 ›
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function PanelList({ children, empty }: { children: ReactNode; empty: string }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(list) && list.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-400">{empty}</div>;
  }
  return <>{children}</>;
}
