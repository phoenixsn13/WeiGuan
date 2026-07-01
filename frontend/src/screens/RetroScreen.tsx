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

function discussionTags(snapshot: RunSnapshot | null): string[] {
  const text = seedReplies(snapshot)
    .map((reply) => reply.content)
    .join(" ");
  const candidates = ["缓存", "复现", "环境", "配置", "冷启动", "对比", "数据", "步骤"];
  const found = candidates.filter((word) => text.includes(word));
  return found.length > 0 ? found.slice(0, 5) : ["复现条件", "讨论焦点"];
}

function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: string;
}) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 tabular text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-sm font-semibold text-emerald-600">{delta}</div>
    </div>
  );
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
  const seed = seedPost(snapshot);
  const firstActor = snapshot?.actors.find((actor) => actor.user_id === seed?.author_id);
  const tags = discussionTags(snapshot);
  const positivePct = pct(metrics.sentiment.positive);
  const neutralPct = pct(metrics.sentiment.neutral);
  const negativePct = pct(metrics.sentiment.negative);

  return (
    <div className="grid min-h-[calc(100vh-108px)] overflow-hidden rounded-card border border-line bg-white shadow-spotlight lg:grid-cols-[300px_minmax(0,1fr)_340px]">
      <aside className="hidden bg-slate-950 p-6 text-white lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-brand text-lg font-black text-slate-950">
            {firstActor?.name?.slice(0, 1) ?? "我"}
          </div>
          <div>
            <div className="text-sm font-bold">{firstActor?.name ?? "技术宅小明"}</div>
            <div className="mt-0.5 text-xs text-white/50">来自 Web</div>
          </div>
        </div>

        <div className="text-lg font-bold leading-7">{seed?.content ?? "历史内容"}</div>
        <div className="mt-5 rounded-card bg-black/35 p-4">
          <div className="h-24 rounded bg-slate-950 p-3 font-mono text-[10px] leading-4 text-emerald-400">
            <div>$ npm run build</div>
            <div>✓ compiled successfully</div>
            <div>✓ cache warmed</div>
            <div className="mt-2 inline-block rounded bg-emerald-500 px-2 py-1 text-white">
              3.12s
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-b border-white/10 pb-5 text-center text-sm">
          <div>
            <div className="tabular font-bold">{metrics.totals.replies ?? 0}</div>
            <div className="text-xs text-white/50">评论</div>
          </div>
          <div>
            <div className="tabular font-bold">{metrics.totals.reposts ?? 0}</div>
            <div className="text-xs text-white/50">转发</div>
          </div>
          <div>
            <div className="tabular font-bold">{metrics.totals.likes ?? 0}</div>
            <div className="text-xs text-white/50">点赞</div>
          </div>
        </div>

        <nav className="mt-5 grid gap-2">
          {["发酵时间线", "时间轴视图", "关键事件", "数据趋势"].map((item, index) => (
            <div
              key={item}
              className={[
                "rounded-card px-3 py-3 text-sm font-semibold",
                index === 0 ? "bg-brand/20 text-brand shadow-[inset_3px_0_0_#F5B12F]" : "text-white/60",
              ].join(" ")}
            >
              {item}
            </div>
          ))}
        </nav>

        <div className="mt-8 rounded-card border border-white/10 bg-white/[0.06] p-4">
          <div className="text-sm font-bold">回放信息</div>
          <div className="mt-3 grid gap-3 text-sm text-white/60">
            <div className="flex justify-between">
              <span>回放时长</span>
              <span>24 小时</span>
            </div>
            <div className="flex justify-between">
              <span>总互动</span>
              <span className="tabular">
                {(metrics.totals.replies ?? 0) +
                  (metrics.totals.reposts ?? 0) +
                  (metrics.totals.likes ?? 0)}
              </span>
            </div>
          </div>
          <a
            href={`/run/${id}/live?replay=1`}
            className="mt-5 flex min-h-11 items-center justify-center rounded-card bg-white/10 text-sm font-semibold text-white hover:bg-white/20"
          >
            回到评论区
          </a>
        </div>
      </aside>

      <section className="min-w-0 bg-[#f8fafc] p-5 lg:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-normal">围观回放</h1>
            <p className="mt-1 text-lg font-semibold text-slate-700">发酵时间线</p>
          </div>
          <div className="flex rounded-card border border-line bg-white p-1 text-sm font-semibold text-slate-500">
            {["全部", "正向", "中立", "负向"].map((item, index) => (
              <button
                key={item}
                className={[
                  "min-h-9 rounded px-4",
                  index === 0 ? "bg-slate-100 text-slate-950 shadow-sm" : "hover:text-accent",
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="relative grid gap-4 border-l-4 border-slate-200 pl-6">
            {waves.map((wave) => (
            <article key={wave.title} className="relative rounded-card border border-line bg-white p-5 shadow-sm">
              <span className="absolute -left-[38px] top-7 h-5 w-5 rounded-full border-4 border-brand bg-white" />
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_230px]">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-black">{wave.title}</h2>
                    <SentimentTag
                      kind={wave.mood.includes("质疑") ? "negative" : wave.mood.includes("观望") ? "neutral" : "positive"}
                      label={wave.mood}
                    />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{wave.description}</p>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-card border border-line bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-500">代表评论</div>
                      <div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">
                        {wave.representative}
                      </div>
                    </div>
                    <div className="rounded-card border border-line bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-500">发言者</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{wave.discussion}</div>
                    </div>
                    <div className="rounded-card border border-line bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-500">参与用户</div>
                      <div className="mt-2 tabular text-sm font-semibold text-slate-900">
                        {wave.spread}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden items-center gap-2 xl:flex">
                  <div className="flex h-16 flex-1 items-end gap-1">
                    {[28, 42, 34, 54, 45, 72, 38, 31].map((height, index) => (
                      <span
                        key={`${wave.title}-${index}`}
                        className="w-full rounded-t bg-brand"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </article>
            ))}
        </div>
      </section>

      <aside className="grid content-start gap-4 border-l border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">创作者流量洞察</h2>
          <span className="rounded-full border border-line px-2 py-1 text-xs text-slate-500">i</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="评论数" value={metrics.totals.replies ?? 0} delta="+156%" />
          <MetricCard label="转发数" value={metrics.totals.reposts ?? 0} delta="+98%" />
          <MetricCard label="点赞数" value={metrics.totals.likes ?? 0} delta="+132%" />
          <MetricCard label="参与用户" value={total} delta="+121%" />
        </div>

        <div className="rounded-card border border-line bg-white p-4 shadow-sm">
          <h3 className="font-bold">整体情绪</h3>
          <div className="mt-2 text-sm font-semibold text-emerald-600">整体偏正向</div>
          <div className="mt-3 flex h-8 overflow-hidden rounded">
            <div className="bg-emerald-500" style={{ width: `${positivePct}%` }} />
            <div className="bg-slate-300" style={{ width: `${neutralPct}%` }} />
            <div className="bg-red-400" style={{ width: `${negativePct}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            {rows.map(([label, kind, value]) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <SentimentTag kind={kind} label={label} />
                <span className="tabular text-slate-500">{pct(value)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-line bg-white p-4 shadow-sm">
          <h3 className="font-bold">高频讨论点</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            {tags.map((tag, index) => (
              <span
                key={tag}
                className={[
                  "rounded px-2 py-1",
                  index < 2 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600",
                ].join(" ")}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-brand/40 bg-brand/10 p-4">
          <h3 className="font-bold">风险点提醒</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            部分用户质疑复现条件，建议在正文或置顶补充具体环境与步骤。
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
          <div className="rounded-card border border-brand/30 bg-white p-4 shadow-sm">
            <div className="font-bold">{insights.verdict}</div>
            <ul className="mt-2 list-disc pl-5 text-sm leading-6">
              {insights.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
