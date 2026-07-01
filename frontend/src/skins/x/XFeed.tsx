import type { Actor } from "../../model/canonical";
import type { PosterViewModel } from "../../pov/poster";
import { XPost } from "./XPost";
import { XReply } from "./XReply";

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
      <div className="rounded-card border border-slate-200 bg-white p-6 text-slate-400 shadow-sm">
        等待第一条内容出现…
      </div>
    );
  }

  const selectedActor = vm.thread.find((item) => item.author.user_id === selectedActorId)
    ?.author;

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-card border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 border-slate-200 lg:border-r">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <div>
            <div className="text-sm font-semibold">微博正文</div>
            <div className="text-xs text-slate-500">
              {selectedActor
                ? "他看到的内容"
                : "我看到的"}
            </div>
          </div>
          <div className="text-sm text-slate-400">按时间</div>
        </div>

        <div className="border-b border-slate-200 px-4 py-4">
          <XPost
            post={vm.seedPost}
            author={vm.me}
            replyCount={vm.thread.length}
            onAuthorClick={onActorClick}
          />
        </div>

        <div className="flex h-12 items-end gap-6 border-b border-slate-200 px-4 text-sm font-medium">
          <button className="h-12 border-b-2 border-brand text-ink">
            评论 <span className="tabular">{vm.thread.length}</span>
          </button>
          <button className="h-12 text-slate-500">
            转发 <span className="tabular">{vm.seedPost.num_shares}</span>
          </button>
          <button className="h-12 text-slate-500">
            通知 <span className="tabular">{vm.notifications.length}</span>
          </button>
        </div>

        <div
          aria-label="评论区滚动窗口"
          className="max-h-[390px] overflow-y-auto overscroll-contain px-4"
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

      <aside className="hidden bg-slate-50/70 p-4 lg:block">
        <h2 className="text-sm font-semibold">通知</h2>
        <div className="mt-3 grid gap-3">
          {vm.notifications.slice(0, 5).map((notice) => (
            <div key={notice.id} className="rounded-card bg-white p-3 text-sm shadow-sm">
              <div className="font-medium">
                @{notice.actor.user_name ?? notice.actor.user_id}
              </div>
              <div className="mt-1 text-slate-500">
                {notice.kind === "like" && "赞了你的内容"}
                {notice.kind === "repost" && "转发了你的内容"}
                {notice.kind === "quote" && "引用了你的内容"}
                {notice.kind === "follow" && "关注了你"}
              </div>
            </div>
          ))}
          {vm.notifications.length === 0 && (
            <div className="rounded-card bg-white p-4 text-sm text-slate-400">
              暂时没有新的通知。
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
