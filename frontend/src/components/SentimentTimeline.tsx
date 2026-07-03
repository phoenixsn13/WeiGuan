import type { TemporalMetrics } from "../api/client";
import { sentimentColor, type Sentiment } from "../design/tokens";
import { sentimentLabel } from "../pov/analysis";

const SENTIMENTS = new Set(["positive", "negative", "neutral"]);

function barColor(sentiment: string): string {
  return sentimentColor(SENTIMENTS.has(sentiment) ? (sentiment as Sentiment) : "neutral");
}

export function SentimentTimeline({
  curve,
  reversals,
}: {
  curve: TemporalMetrics["fermentation_curve"];
  reversals: TemporalMetrics["sentiment_reversals"];
}) {  // review:P8-T7
  if (curve.length === 0) {
    return <EmptyPanel label="还没有发酵曲线。" />;
  }
  const max = Math.max(...curve.map((point) => point.volume), 1);
  return (
    <div className="grid gap-4">
      <div className="flex h-44 items-end gap-2 rounded-card border border-line bg-white p-4 shadow-sm">
        {curve.map((point) => (
          <div key={point.tick} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t"
              style={{
                backgroundColor: barColor(point.sentiment),
                height: `${(point.volume / max) * 100}%`,
              }}
              aria-label={`第 ${point.tick} 拍 ${point.volume}`}
            />
            <span className="text-xs font-semibold text-slate-500">{point.tick}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        {reversals.length === 0 ? (
          <div className="text-sm text-slate-500">没有明显立场拐点。</div>
        ) : (
          reversals.map((item) => (
            <div key={item.tick} className="rounded-card border border-brand/40 bg-brand/10 p-3 text-sm font-semibold">
              第 {item.tick} 拍 · {sentimentLabel(item.from)} → {sentimentLabel(item.to)}
            </div>
          ))
        )}
      </div>
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
