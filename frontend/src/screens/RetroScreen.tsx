import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
  fetchInsights,
  fetchRetro,
  type Insights,
  type RetroMetrics,
} from "../api/client";
import { useApiKey } from "../api/useApiKey";
import { Button } from "../components/Button";
import { SentimentTag } from "../components/SentimentTag";

// review:P5-T5  复盘上帝视角（壳，允许品牌色）
export default function RetroScreen() {
  const { id = "" } = useParams();
  const { key, model, baseUrl, reasoningEffort, thinking } = useApiKey();
  const [metrics, setMetrics] = useState<RetroMetrics | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    fetchRetro(id)
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }, [id]);

  if (!metrics) {
    return <div className="text-ink/40">复盘加载中…</div>;
  }

  const total =
    metrics.sentiment.positive +
      metrics.sentiment.negative +
      metrics.sentiment.neutral || 1;
  const pct = (value: number) => Math.round((value / total) * 100);
  const rows: [string, "positive" | "negative" | "neutral", number][] = [
    ["正向", "positive", metrics.sentiment.positive],
    ["中立", "neutral", metrics.sentiment.neutral],
    ["负向", "negative", metrics.sentiment.negative],
  ];

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl">复盘</h1>
      <div className="rounded-card border border-ink/10 bg-white p-4">
        {rows.map(([label, kind, value]) => (
          <div key={label} className="flex items-center gap-3 py-1">
            <SentimentTag kind={kind} label={label} />
            <div className="h-2 flex-1 rounded bg-ink/5">
              <div className="h-2 rounded bg-accent" style={{ width: `${pct(value)}%` }} />
            </div>
            <span className="tabular text-sm">{pct(value)}%</span>
          </div>
        ))}
        <div className="mt-3 text-xs text-ink/50">
          转发 {metrics.totals.reposts ?? 0} · 举报 {metrics.totals.reports ?? 0} · 传播{" "}
          {metrics.spread_by_step.join("·")}
        </div>
      </div>
      <div className="mt-4">
        <Button
          onClick={() =>
            fetchInsights(id, { key, model, baseUrl, reasoningEffort, thinking })
              .then(setInsights)
              .catch(() => {})
          }
        >
          生成建议
        </Button>
      </div>
      {insights && (
        <div className="mt-4 rounded-card border border-brand/30 bg-brand/5 p-4">
          <div className="font-medium">{insights.verdict}</div>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {insights.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
