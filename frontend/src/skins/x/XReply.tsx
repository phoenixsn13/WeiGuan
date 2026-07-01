import type { Actor, Reply } from "../../model/canonical";
import { XAvatar } from "./XAvatar";

// review:P3-T3
export function XReply({
  reply,
  author,
  onAuthorClick,
  selected,
}: {
  reply: Reply;
  author: Actor;
  onAuthorClick?: (actor: Actor) => void;
  selected?: boolean;
}) {
  return (
    <div
      className={[
        "flex animate-[fadein_.3s_ease] gap-3 border-t py-3 pr-2",
        selected ? "border-brand/40 bg-brand/10" : "border-slate-100 bg-white",
      ].join(" ")}
    >
      <XAvatar actor={author} onClick={onAuthorClick} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px]">
          <button
            className="min-h-8 rounded px-1 text-left font-medium hover:text-accent"
            onClick={() => onAuthorClick?.(author)}
          >
            {author.name}
          </button>{" "}
          <span className="text-slate-400">@{author.user_name}</span>
          {selected && (
            <span className="ml-2 rounded-full bg-brand/20 px-2 py-0.5 text-xs text-ink">
              他的反应
            </span>
          )}
        </div>
        <div className="whitespace-pre-wrap break-words text-[15px]">{reply.content}</div>
        <div className="mt-1 text-[13px] text-slate-400">
          点赞 <span className="tabular">{reply.num_likes}</span>
        </div>
      </div>
    </div>
  );
}
