import { sentimentLabel } from "../pov/analysis";

const STANCE_NAMES: Record<string, string> = {
  question: "负向",
  skeptic: "负向",
  analysis: "正向",
  meme: "正向",
  other: "正向",
  neutral: "中立",
};

export function StanceDistribution({
  points,
  polarization,
}: {
  points: Array<{ tick: string; stance_counts: Record<string, number> }>;
  polarization: number;
}) {  // review:P8-T7
  if (points.length === 0) {
    return <EmptyPanel label="还没有足够评论形成立场分布。" />;
  }
  return (
    <div className="grid gap-3">
      <div className="rounded-card border border-line bg-white p-4 shadow-sm">
        <div className="text-xs font-bold text-slate-500">极化指数</div>
        <div className="mt-2 text-3xl font-black text-slate-950">
          {Math.round(polarization * 100)}%
        </div>
      </div>
      {points.map((point) => (
        <div key={point.tick} className="rounded-card border border-line bg-white p-4 shadow-sm">
          <div className="text-sm font-black">第 {point.tick} 拍</div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            {Object.entries(point.stance_counts).map(([label, count]) => (
              <span key={label} className="rounded bg-slate-100 px-3 py-1 text-slate-700">
                {STANCE_NAMES[label] ?? sentimentLabel(label)} {count}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-white p-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}
