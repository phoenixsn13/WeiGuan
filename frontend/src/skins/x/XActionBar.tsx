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
    <div className="mt-3 flex gap-8 text-[13px] text-slate-500">
      <span>
        评论 <span className="tabular">{replies}</span>
      </span>
      <span>
        转发 <span className="tabular">{reposts}</span>
      </span>
      <span>
        点赞 <span className="tabular transition-all">{likes}</span>
      </span>
    </div>
  );
}
