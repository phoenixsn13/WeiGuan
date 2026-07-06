import type { RunSummary } from "../api/client";

interface TrendItem {
  label: string;
  score: number;
  meta: string;
  count: number;
}

function trimTopic(content: string): string {
  const compact = content.trim().replace(/\s+/g, "");
  return compact.slice(0, 18);
}

export function buildTrendItems(runs: RunSummary[]): TrendItem[] {
  const grouped = new Map<string, { replies: number; reposts: number; likes: number; count: number }>();
  for (const run of runs) {
    const content = (run.content ?? "").trim();
    if (!content) continue;
    const label = `#${trimTopic(content)}`;
    const current = grouped.get(label) ?? { replies: 0, reposts: 0, likes: 0, count: 0 };
    current.replies += run.totals.replies ?? 0;
    current.reposts += run.totals.reposts ?? 0;
    current.likes += run.totals.likes ?? 0;
    current.count += 1;
    grouped.set(label, current);
  }

  return [...grouped.entries()]
    .map(([label, item]) => {
      const score = item.replies * 3 + item.reposts * 4 + item.likes;
      const meta =
        item.count > 1
          ? `${item.replies} 评论 · ${item.likes} 赞 · 发起 ${item.count} 次`
          : `${item.replies} 评论 · ${item.likes} 赞`;
      return { label, score, meta, count: item.count };
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "zh-Hans-CN"))
    .slice(0, 5);
}

export function TrendRail({ runs }: { runs: RunSummary[] }) {
  const items = buildTrendItems(runs);
  if (items.length === 0) return null;

  return (
    <aside className="rounded-card border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-normal">围观热榜</h2>
          <p className="mt-1 text-xs text-slate-500">来自已保存推演的讨论热度</p>
        </div>
        <span className="rounded-full bg-brand/20 px-2 py-1 text-xs font-bold text-slate-950">
          热
        </span>
      </div>
      <ol className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={item.label} className="flex gap-3">
            <span
              className={[
                "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black",
                index < 3 ? "bg-brand text-slate-950" : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-950">{item.label}</div>
              <div className="mt-0.5 text-xs text-slate-400">{item.meta}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {items.slice(0, 4).map((item, index) => (
          <span
            key={`cloud-${item.label}`}
            className={[
              "rounded-full px-2.5 py-1 font-semibold",
              index === 0
                ? "bg-blue-50 text-sm text-accent"
                : "bg-slate-100 text-xs text-slate-500",
            ].join(" ")}
          >
            {item.label}
          </span>
        ))}
      </div>
    </aside>
  );
}
