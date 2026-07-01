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
  const items = [
    ["评论", replies, "M7 8h10M7 12h7m-8 8h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13l4-3Z"],
    ["转发", reposts, "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"],
    ["点赞", likes, "M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3m0 11V9l4-7 1 1a4 4 0 0 1 1 4l-1 2h5a3 3 0 0 1 3 3l-2 7a4 4 0 0 1-4 3H7Z"],
  ] as const;
  return (
    <div className="mt-5 grid grid-cols-3 border-t border-line pt-3 text-[13px] text-slate-500">
      {items.map(([label, value, path]) => (
        <span key={label} className="flex items-center justify-center gap-2">
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
          <span className="tabular">{value}</span>
        </span>
      ))}
    </div>
  );
}
