// review:P3-T3
export function XActionBar({
  replies,
  reposts,
  likes,
}: {
  replies: number;
  reposts: number;
  likes: number;
}) {
  return (
    <div className="mt-2 flex gap-10 text-[13px] text-slate-500">
      <span>
        💬 <span className="tabular">{replies}</span>
      </span>
      <span>
        🔁 <span className="tabular">{reposts}</span>
      </span>
      <span>
        ♥ <span className="tabular transition-all">{likes}</span>
      </span>
    </div>
  );
}
