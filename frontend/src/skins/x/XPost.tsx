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
    <article className="flex gap-3 pb-2">
      <XAvatar actor={author} onClick={onAuthorClick} />
      <div className="flex-1">
        <div className="text-[15px]">
          <span className="font-medium">{author.name}</span>{" "}
          <span className="text-slate-400">@{author.user_name} · 刚刚</span>
        </div>
        <div className="mt-0.5 whitespace-pre-wrap text-[15px]">{post.content}</div>
        <XActionBar
          replies={replyCount}
          reposts={post.num_shares}
          likes={post.num_likes}
        />
      </div>
    </article>
  );
}
