import type { Actor } from "../../model/canonical";
import type { PosterViewModel } from "../../pov/poster";
import { XPost } from "./XPost";
import { XReply } from "./XReply";

// review:P3-T3  X 皮肤入口（只消费 ViewModel）
export function XFeed({
  vm,
  onActorClick,
}: {
  vm: PosterViewModel;
  onActorClick?: (actor: Actor) => void;
}) {
  if (!vm.seedPost || !vm.me) {
    return (
      <div className="rounded-card border border-slate-200 bg-white p-6 text-slate-400">
        等待第一条…
      </div>
    );
  }

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <XPost
        post={vm.seedPost}
        author={vm.me}
        replyCount={vm.thread.length}
        onAuthorClick={onActorClick}
      />
      {vm.thread.map((item) => (
        <XReply
          key={item.reply.comment_id}
          reply={item.reply}
          author={item.author}
          onAuthorClick={onActorClick}
        />
      ))}
    </div>
  );
}
