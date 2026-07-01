import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
  fetchInsights,
  fetchRetro,
  fetchRunSnapshot,
  type Insights,
  type RetroMetrics,
} from "../api/client";
import { useApiKey } from "../api/useApiKey";
import { Button } from "../components/Button";
import { SentimentTag } from "../components/SentimentTag";
import type { Reply, RunSnapshot } from "../model/canonical";

interface Wave {
  title: string;
  description: string;
  representative: string;
  discussion: string;
  mood: string;
  spread: number;
}

const WAVE_COPY = [
  ["第 1 波：第一批人看到", "最早出现的真实回复和直接反应。"],
  ["第 2 波：讨论继续扩散", "更多人围绕主帖内容补充、追问或表达立场。"],
  ["第 3 波：观点分化", "不同视角开始交错，讨论密度继续变化。"],
  ["第 4 波：阶段性收束", "后续回复把主要关注点逐渐收拢。"],
] as const;

function actorLabel(snapshot: RunSnapshot | null, actorId: number): string {
  const actor = snapshot?.actors.find((item) => item.user_id === actorId);
  return actor?.user_name ? `@${actor.user_name}` : `用户 ${actorId}`;
}

function seedPost(snapshot: RunSnapshot | null) {
  return snapshot?.posts.find((post) => post.post_id === snapshot.seed_post_id) ?? null;
}

function seedReplies(snapshot: RunSnapshot | null): Reply[] {
  if (!snapshot?.seed_post_id) return [];
  return snapshot.replies.filter((reply) => reply.post_id === snapshot.seed_post_id);
}

function replyBucket(replies: Reply[], index: number, count: number): Reply[] {
  if (replies.length === 0) return [];
  const size = Math.ceil(replies.length / count);
  return replies.slice(index * size, index * size + size);
}

function moodLabel(metrics: RetroMetrics, index: number): string {
  const { positive, negative, neutral } = metrics.sentiment;
  if (negative > positive && index >= 1) return "质疑较多";
  if (positive > negative && index !== 2) return "正向占优";
  if (neutral >= positive && neutral >= negative) return "观望为主";
  return "观点分化";
}

function buildWaves(metrics: RetroMetrics, snapshot: RunSnapshot | null): Wave[] {
  const replies = seedReplies(snapshot);
  const seed = seedPost(snapshot);
  const fallbackContent = seed?.content ?? "暂无保存评论";
  return WAVE_COPY.map(([title, description], index) => {
    const bucket = replyBucket(replies, index, WAVE_COPY.length);
    const reply = bucket[0];
    return {
      title,
      description,
      representative: reply?.content ?? (index === 0 ? fallbackContent : "这一波暂无新增评论"),
      discussion: reply ? actorLabel(snapshot, reply.author_id) : "等待更多讨论",
      mood: moodLabel(metrics, index),
      spread:
        metrics.spread_by_step[index] ??
        metrics.spread_by_step[metrics.spread_by_step.length - 1] ??
        replies.length,
    };
  });
}

// review:P5-T5  复盘上帝视角（壳，允许品牌色）
export default function RetroScreen() {
  const { id = "" } = useParams();
  const { key, model, baseUrl, reasoningEffort, thinking } = useApiKey();
  const [metrics, setMetrics] = useState<RetroMetrics | null>(null);
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    fetchRetro(id)
      .then(setMetrics)
      .catch(() => setMetrics(null));
    fetchRunSnapshot(id)
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
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
  const waves = buildWaves(metrics, snapshot);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">围观回放</h1>
          <p className="mt-1 text-sm text-ink/60">讨论如何发酵、分化和收束</p>
        </div>
        <a
          href={`/run/${id}/live?replay=1`}
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
            {waves.map((wave) => (
              <article key={wave.title} className="relative rounded-card border border-ink/10 p-4">
                <span className="absolute -left-[31px] top-5 h-4 w-4 rounded-full border-2 border-brand bg-white" />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{wave.title}</h3>
                    <p className="mt-1 text-sm text-ink/60">{wave.description}</p>
                  </div>
                  <div className="text-right text-xs text-ink/50">
                    传播{" "}
                    <span className="tabular">{wave.spread}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-card bg-cream p-3 text-sm">
                    <div className="text-ink/50">代表评论</div>
                    <div className="mt-1">{wave.representative}</div>
                  </div>
                  <div className="rounded-card bg-cream p-3 text-sm">
                    <div className="text-ink/50">发言者</div>
                    <div className="mt-1">{wave.discussion}</div>
                  </div>
                  <div className="rounded-card bg-cream p-3 text-sm">
                    <div className="text-ink/50">情绪</div>
                    <div className="mt-1">{wave.mood}</div>
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
