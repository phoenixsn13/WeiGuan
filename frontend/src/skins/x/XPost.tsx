import type { Actor, Post } from "../../model/canonical";
import { XActionBar } from "./XActionBar";
import { XAvatar } from "./XAvatar";

// review:P3-T3
export function XPost({
  post,
  author,
  replyCount,
  onAuthorClick,
}: {
  post: Post;
  author: Actor;
  replyCount: number;
  onAuthorClick?: (actor: Actor) => void;
}) {
  return (
    <article className="flex gap-4 pb-2">
      <XAvatar actor={author} onClick={onAuthorClick} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[15px]">
          <span className="font-semibold">{author.name ?? "我"}</span>
          <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-night">
            V
          </span>
          <span className="text-slate-400">@{author.user_name ?? author.user_id} · 刚刚</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">来自 围观推演</span>
        </div>
        <div className="mt-4 whitespace-pre-wrap break-words text-[18px] font-semibold leading-8 text-slate-950">
          {post.content}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[14px] font-medium text-accent">
          <span>#前端构建优化</span>
          <span>#性能优化</span>
        </div>
        <XActionBar
          replies={replyCount}
          reposts={post.num_shares}
          likes={post.num_likes}
        />
      </div>
    </article>
  );
}
