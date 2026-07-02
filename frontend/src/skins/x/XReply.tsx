import type { Actor, Reply } from "../../model/canonical";
import { displayHandle, displayName } from "./identity";
import { RichText } from "./RichText";
import { relativeSocialTime } from "./time";
import { XAvatar } from "./XAvatar";

// review:P3-T3
export function XReply({
  reply,
  author,
  nowAt,
  onAuthorClick,
  selected,
}: {
  reply: Reply;
  author: Actor;
  nowAt?: string | null;
  onAuthorClick?: (actor: Actor) => void;
  selected?: boolean;
}) {
  const authorName = displayName(author);
  const authorHandle = displayHandle(author);
  return (
    <div
      className={[
        "flex animate-[fadein_.3s_ease] gap-3 border-t px-5 py-4 pr-4 transition",
        selected
          ? "border-brand bg-[#fff8e9] shadow-[inset_3px_0_0_#F5B12F]"
          : "border-line bg-white hover:bg-slate-50/70",
      ].join(" ")}
    >
      <XAvatar actor={author} onClick={onAuthorClick} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <button
            className="min-h-8 rounded text-left font-semibold hover:text-accent"
            onClick={() => onAuthorClick?.(author)}
          >
            {authorName}
          </button>{" "}
          {authorHandle && <span className="text-slate-400">@{authorHandle}</span>}
          {authorHandle && <span className="text-slate-300">·</span>}
          <span className="text-slate-400">{relativeSocialTime(reply.created_at, nowAt)}</span>
          {selected && (
            <span className="ml-1 rounded-full bg-brand/25 px-2 py-0.5 text-xs font-semibold text-slate-950">
              他的评论
            </span>
          )}
        </div>
        <div className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-slate-900">
          <RichText text={reply.content} />
        </div>
        <div className="mt-3 flex gap-7 text-[13px] text-slate-400">
          <span>回复</span>
          <span>转发</span>
          <span>
            点赞 <span className="tabular">{reply.num_likes}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
