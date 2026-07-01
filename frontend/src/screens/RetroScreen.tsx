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
  const waves = [
    ["第 1 波：第一批人看到", "新鲜感和直接反应出现。"],
    ["第 2 波：质疑点出现", "评论开始围绕可信度、条件和细节追问。"],
    ["第 3 波：立场分化", "支持与怀疑同时发酵，讨论密度上升。"],
    ["第 4 波：结论", "主要风险点和可修改方向逐渐收束。"],
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">围观回放</h1>
          <p className="mt-1 text-sm text-ink/60">讨论如何发酵、分化和收束</p>
        </div>
        <a
          href={`/run/${id}/live`}
          className="rounded-card border border-ink/10 bg-white px-4 py-2 text-sm hover:border-accent hover:text-accent"
        >
          回到评论区
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-card border border-ink/10 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">发酵时间线</h2>
            <div className="flex gap-2 text-xs text-ink/50">
              <span>全部</span>
              <span>支持</span>
              <span>中立</span>
              <span>负向</span>
            </div>
          </div>

          <div className="relative grid gap-4 border-l-2 border-brand/30 pl-5">
            {waves.map(([title, description], index) => (
              <article key={title} className="relative rounded-card border border-ink/10 p-4">
                <span className="absolute -left-[31px] top-5 h-4 w-4 rounded-full border-2 border-brand bg-white" />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-ink/60">{description}</p>
                  </div>
                  <div className="text-right text-xs text-ink/50">
                    传播{" "}
                    <span className="tabular">
                      {metrics.spread_by_step[index] ??
                        metrics.spread_by_step[metrics.spread_by_step.length - 1] ??
                        0}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-card bg-cream p-3 text-sm">
                    <div className="text-ink/50">代表评论</div>
                    <div className="mt-1">缓存没清吧？</div>
                  </div>
                  <div className="rounded-card bg-cream p-3 text-sm">
                    <div className="text-ink/50">讨论点</div>
                    <div className="mt-1">复现条件</div>
                  </div>
                  <div className="rounded-card bg-cream p-3 text-sm">
                    <div className="text-ink/50">情绪</div>
                    <div className="mt-1">
                      {index === 1 ? "质疑上升" : index === 2 ? "立场分化" : "整体偏积极"}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <div className="rounded-card border border-ink/10 bg-white p-4">
            <h2 className="font-semibold">创作者流量洞察</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-card bg-cream p-3">
                <div className="text-ink/50">评论</div>
                <div className="tabular text-2xl font-semibold">
                  {metrics.totals.replies ?? 0}
                </div>
              </div>
              <div className="rounded-card bg-cream p-3">
                <div className="text-ink/50">转发</div>
                <div className="tabular text-2xl font-semibold">
                  {metrics.totals.reposts ?? 0}
                </div>
              </div>
            </div>
            <div className="mt-4">
              {rows.map(([label, kind, value]) => (
                <div key={label} className="flex items-center gap-3 py-1">
                  <SentimentTag kind={kind} label={label} />
                  <div className="h-2 flex-1 rounded bg-ink/5">
                    <div
                      className="h-2 rounded bg-accent"
                      style={{ width: `${pct(value)}%` }}
                    />
                  </div>
                  <span className="tabular text-sm">{pct(value)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card border border-brand/30 bg-brand/5 p-4">
            <h2 className="font-semibold">风险点提醒</h2>
            <p className="mt-2 text-sm text-ink/65">
              高频讨论集中在复现条件，建议补充冷启动、环境配置和对比数据。
            </p>
          </div>

          <Button
            onClick={() =>
              fetchInsights(id, { key, model, baseUrl, reasoningEffort, thinking })
                .then(setInsights)
                .catch(() => {})
            }
          >
            生成建议
          </Button>

          {insights && (
            <div className="rounded-card border border-brand/30 bg-white p-4">
              <div className="font-medium">{insights.verdict}</div>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {insights.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
