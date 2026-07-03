import type { PosterViewModel } from "../../pov/poster";
import { displayHandle, displayName } from "./identity";
import { RichText } from "./RichText";

export function XNativeFeed({ vm }: { vm: PosterViewModel }) {
  if (!vm.seedPost || !vm.me) {
    return <div className="rounded-card border border-line bg-white p-8 text-center text-slate-400">Waiting for a post...</div>;
  }

  return (
    <section className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-spotlight">
      <header className="border-b border-slate-200 px-5 py-4">
        <div className="text-[15px] font-black">Post</div>
        <div className="text-xs text-slate-500">For you</div>
      </header>
      <article className="border-b border-slate-200 px-6 py-5">
        <div className="text-sm font-bold text-slate-950">{displayName(vm.me)}</div>
        <div className="text-sm text-slate-500">{displayHandle(vm.me) ? `@${displayHandle(vm.me)}` : "@me"}</div>
        <div className="mt-4 whitespace-pre-wrap break-words text-xl leading-8 text-slate-950">
          <RichText text={vm.seedPost.content} />
        </div>
        <div className="mt-5 flex gap-8 border-t border-slate-200 pt-4 text-sm text-slate-500">
          <span>Replies {vm.thread.length}</span>
          <span>Reposts {vm.seedPost.num_shares}</span>
          <span>Likes {vm.seedPost.num_likes}</span>
        </div>
      </article>
      {vm.thread.map(({ reply, author }) => (
        <article key={reply.comment_id} className="border-b border-slate-200 px-6 py-4 last:border-b-0">
          <div className="text-sm font-bold text-slate-950">{displayName(author)}</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-slate-800">
            <RichText text={reply.content} />
          </div>
        </article>
      ))}
    </section>
  );
}
