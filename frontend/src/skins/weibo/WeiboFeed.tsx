import type { Actor } from "../../model/canonical";
import type { PosterViewModel } from "../../pov/poster";
import type { PlatformFeedProps } from "../skin";
import { displayName } from "../x/identity";
import { RichText } from "../x/RichText";

function Avatar({ actor }: { actor: Actor }) {
  const hue = (actor.user_id * 47) % 360;
  return (
    <div
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 62% 44%), hsl(${(hue + 34) % 360} 72% 30%))` }}
    >
      {displayName(actor).slice(0, 1)}
    </div>
  );
}

function AuthorName({
  actor,
  identityHref,
  onIdentityClick,
}: {
  actor: Actor;
  identityHref?: string;
  onIdentityClick?: (href: string) => void;
}) {
  const label = displayName(actor);
  if (!identityHref) {
    return <span className="font-bold text-slate-950">{label}</span>;
  }
  return (
    <button
      type="button"
      className="min-h-8 rounded text-left font-bold text-slate-950 hover:text-accent"
      onClick={() => onIdentityClick?.(identityHref)}
    >
      {label}
    </button>
  );
}

export function WeiboFeed({ vm, identityHrefForActor, onIdentityClick }: PlatformFeedProps) {
  if (!vm.seedPost || !vm.me) {
    return <div className="rounded-card border border-line bg-white p-8 text-center text-slate-400">等待第一条微博出现...</div>;
  }

  return (
    <section className="overflow-hidden rounded-card border border-line bg-white shadow-spotlight">
      <header className="border-b border-line px-5 py-4 text-center">
        <div className="text-[15px] font-black">微博正文</div>
        <div className="text-xs text-slate-500">来自围观推演</div>
      </header>
      <article className="flex gap-4 px-6 py-6">
        <Avatar actor={vm.me} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[15px]">
            <AuthorName
              actor={vm.me}
              identityHref={identityHrefForActor?.(vm.me)}
              onIdentityClick={onIdentityClick}
            />
            <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-slate-950">V</span>
            <span className="text-slate-400">刚刚 · 来自 Web</span>
          </div>
          <div className="mt-4 whitespace-pre-wrap break-words text-[18px] font-semibold leading-8 text-slate-950">
            <RichText text={vm.seedPost.content} />
          </div>
          <div className="mt-5 grid grid-cols-3 border-t border-line pt-4 text-center text-sm text-slate-500">
            <span>评论 {vm.thread.length}</span>
            <span>转发 {vm.seedPost.num_shares}</span>
            <span>点赞 {vm.seedPost.num_likes}</span>
          </div>
        </div>
      </article>
      <div className="border-t border-line">
        {vm.thread.map(({ reply, author }) => (
          <div key={reply.comment_id} className="flex gap-3 border-b border-line px-6 py-4 last:border-b-0">
            <Avatar actor={author} />
            <div className="min-w-0">
              <div className="text-sm">
                <AuthorName
                  actor={author}
                  identityHref={identityHrefForActor?.(author)}
                  onIdentityClick={onIdentityClick}
                />
              </div>
              <div className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-slate-800">
                <RichText text={reply.content} />
              </div>
              <div className="mt-2 text-xs text-slate-400">回复 · 转发 · 点赞 {reply.num_likes}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
