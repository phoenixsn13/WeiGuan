import type { Actor } from "../../model/canonical";
import type { PosterViewModel } from "../../pov/poster";
import { XPost } from "./XPost";
import { XReply } from "./XReply";

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
}: {
  vm: PosterViewModel;
  onActorClick?: (actor: Actor) => void;
  selectedActorId?: number | null;
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

  return (
    <div className="grid min-h-[680px] overflow-hidden rounded-card border border-line bg-white shadow-spotlight lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 border-line lg:border-r">
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <button className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-600 hover:text-accent">
            <span aria-hidden="true">‹</span>
            返回
          </button>
          <div className="text-center">
            <div className="text-[15px] font-bold">微博正文</div>
            <div className="text-xs text-slate-500">{selectedActor ? "他看到的内容" : "我看到的"}</div>
          </div>
          <button className="grid min-h-11 min-w-11 place-items-center rounded-card text-lg text-slate-500 hover:bg-slate-50">
            ...
          </button>
        </div>

        <div className="border-b border-line px-6 py-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="text-brand">⌖</span>
            置顶
          </div>
          <XPost
            post={vm.seedPost}
            author={vm.me}
            replyCount={vm.thread.length}
            onAuthorClick={onActorClick}
          />
        </div>

        <div className="flex h-14 items-end gap-8 border-b border-line px-6 text-[15px] font-semibold">
          <button className="h-14 border-b-2 border-brand text-ink">
            评论 <span className="tabular">{vm.thread.length}</span>
          </button>
          <button className="h-14 text-slate-500">
            转发 <span className="tabular">{vm.seedPost.num_shares}</span>
          </button>
          <button className="h-14 text-slate-500">
            通知 <span className="tabular">{vm.notifications.length}</span>
          </button>
          <div className="ml-auto hidden h-14 items-center text-sm text-slate-500 sm:flex">
            按时间⌄
          </div>
        </div>

        <div
          aria-label="评论区滚动窗口"
          className="max-h-[410px] overflow-y-auto overscroll-contain"
        >
          {vm.thread.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              还没有人回复。评论出现后会在这里刷出来。
            </div>
          )}
          {vm.thread.map((item) => (
            <XReply
              key={item.reply.comment_id}
              reply={item.reply}
              author={item.author}
              selected={item.author.user_id === selectedActorId}
              onAuthorClick={onActorClick}
            />
          ))}
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
                  {notice.kind === "follow" && `@${notice.actor.user_name ?? notice.actor.user_id} 关注了你`}
                </div>
                <div className="mt-1 line-clamp-2 text-slate-500">
                  @{notice.actor.user_name ?? notice.actor.user_id}
                  {notice.kind === "like" && " 等人赞了你的微博"}
                  {notice.kind === "repost" && " 转发了你的微博"}
                  {notice.kind === "quote" && " 正在讨论你的微博"}
                  {notice.kind === "follow" && " 可能会继续关注后续"}
                </div>
                <div className="mt-2 text-xs text-slate-400">刚刚</div>
              </div>
            </div>
          ))}
          {vm.notifications.length === 0 && (
            <div className="rounded-card border border-dashed border-line bg-slate-50 p-5 text-sm text-slate-400">
              暂时没有新的通知。
            </div>
          )}
          {vm.notifications.length > 0 && (
            <button className="mt-4 min-h-11 rounded-card text-sm font-semibold text-accent hover:bg-blue-50">
              查看全部通知 ›
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
