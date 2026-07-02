import type { InfluenceMetrics } from "../api/client";

export function InfluenceBoard({ ranking }: { ranking: InfluenceMetrics["ranking"] }) {  // review:P8-T7
  if (ranking.length === 0) {
    return <EmptyPanel label="还没有足够互动识别结构影响力。" />;
  }
  return (
    <div className="grid gap-3">
      {ranking.slice(0, 8).map((item, index) => (
        <div key={item.actor_id} className="rounded-card border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black">@{item.actor_id}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                入度 {item.in_degree} · 核心层 {item.kcore}
              </div>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-black text-slate-950">
              {index + 1}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.max(6, Math.min(100, item.centrality * 100))}%` }}
            />
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
