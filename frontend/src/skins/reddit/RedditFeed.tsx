import type { Actor } from "../../model/canonical";
import type { PosterViewModel } from "../../pov/poster";
import type { PlatformFeedProps } from "../skin";
import { displayName } from "../x/identity";
import { RichText } from "../x/RichText";

function RedditAuthor({
  actor,
  identityHref,
  onIdentityClick,
}: {
  actor: Actor;
  identityHref?: string;
  onIdentityClick?: (href: string) => void;
}) {
  const label = `u/${displayName(actor)}`;
  if (!identityHref) return <span>{label}</span>;
  return (
    <button
      type="button"
      className="min-h-7 rounded text-left font-bold hover:text-orange-700"
      onClick={() => onIdentityClick?.(identityHref)}
    >
      {label}
    </button>
  );
}

export function RedditFeed({ vm, identityHrefForActor, onIdentityClick }: PlatformFeedProps) {
  if (!vm.seedPost || !vm.me) {
    return <div className="rounded-card border border-line bg-white p-8 text-center text-slate-400">Waiting for a post...</div>;
  }

  return (
    <section className="overflow-hidden rounded-card border border-orange-200 bg-[#fffaf5] shadow-spotlight">
      <header className="flex items-center justify-between border-b border-orange-100 bg-white px-5 py-3">
        <div>
          <div className="text-sm font-black text-orange-700">r/weiguan</div>
          <div className="text-xs text-slate-500">Discussion thread</div>
        </div>
        <button className="rounded-full bg-orange-600 px-4 py-2 text-xs font-bold text-white">Join</button>
      </header>
      <article className="grid grid-cols-[54px_minmax(0,1fr)] gap-3 px-5 py-5">
        <div className="text-center text-sm font-black text-orange-700">
          <div>▲</div>
          <div className="tabular">{vm.seedPost.num_likes}</div>
          <div>▼</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-slate-500">
            Posted by{" "}
            <RedditAuthor
              actor={vm.me}
              identityHref={identityHrefForActor?.(vm.me)}
              onIdentityClick={onIdentityClick}
            />
          </div>
          <h1 className="mt-2 whitespace-pre-wrap break-words text-xl font-black leading-8 text-slate-950">
            <RichText text={vm.seedPost.content} />
          </h1>
          <div className="mt-4 text-sm font-semibold text-slate-500">
            <span>{vm.thread.length} {vm.thread.length === 1 ? "comment" : "comments"}</span> · Share · Save
          </div>
        </div>
      </article>
      <div className="border-t border-orange-100 bg-white">
        {vm.thread.map(({ reply, author }) => (
          <div key={reply.comment_id} className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 border-b border-orange-50 px-5 py-4 last:border-b-0">
            <div className="text-center text-xs font-bold text-slate-400">│</div>
            <div>
              <div className="text-xs font-bold text-slate-600">
                <RedditAuthor
                  actor={author}
                  identityHref={identityHrefForActor?.(author)}
                  onIdentityClick={onIdentityClick}
                />
              </div>
              <div className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-slate-800">
                <RichText text={reply.content} />
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-400">Reply · Award · Share</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
