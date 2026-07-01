import type { Actor, Reply } from "../../model/canonical";
import { XAvatar } from "./XAvatar";

// review:P3-T3
export function XReply({
  reply,
  author,
  onAuthorClick,
}: {
  reply: Reply;
  author: Actor;
  onAuthorClick?: (actor: Actor) => void;
}) {
  return (
    <div className="flex animate-[fadein_.3s_ease] gap-3 border-t border-slate-100 py-3">
      <XAvatar actor={author} onClick={onAuthorClick} />
      <div>
        <div className="text-[13px]">
          <span className="font-medium">{author.name}</span>{" "}
          <span className="text-slate-400">@{author.user_name}</span>
        </div>
        <div className="text-[15px]">{reply.content}</div>
        <div className="mt-1 text-[13px] text-slate-400">
          ♥ <span className="tabular">{reply.num_likes}</span>
        </div>
      </div>
    </div>
  );
}
