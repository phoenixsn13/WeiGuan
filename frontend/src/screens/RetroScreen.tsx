import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  fetchInsights,
  fetchRunSnapshot,
  fetchSavedInsights,
  getAnalysis,
  type AnalysisProjection,
  type Insights,
} from "../api/client";
import { useApiKey } from "../api/useApiKey";
import { Button } from "../components/Button";
import { CascadeTree } from "../components/CascadeTree";
import { InfluenceBoard } from "../components/InfluenceBoard";
import { SentimentTimeline } from "../components/SentimentTimeline";
import { StanceDistribution } from "../components/StanceDistribution";
import type { RunSnapshot } from "../model/canonical";
import { analysisTabs, insightCards, phaseCards, type AnalysisTab } from "../pov/analysis";
import { displayName } from "../skins/x/identity";

const EMPTY_ANALYSIS: AnalysisProjection = {
  diffusion: { tree: [], max_depth: 0, breadth: 0, cascade_size: 0, key_rebroadcasters: [] },
  opinion: {
    stance_by_tick: [],
    convergence_trend: "stable",
    polarization_index: 0,
    homophily: 0,
    cross_stance_ratio: 0,
    echo_chamber_risk: "low",
  },
  influence: { ranking: [], top_leaders: [], iterations: 0 },
  temporal: {
    fermentation_curve: [],
    peak_tick: 0,
    half_life_ticks: 0,
    sentiment_reversals: [],
  },
};

function seedPost(snapshot: RunSnapshot | null) {
  return snapshot?.posts.find((post) => post.post_id === snapshot.seed_post_id) ?? null;
}

function authorName(snapshot: RunSnapshot | null): string {
  const seed = seedPost(snapshot);
  const actor = snapshot?.actors.find((item) => item.user_id === seed?.author_id);
  return actor ? displayName(actor) : "我";
}

function renderMain(tab: AnalysisTab, analysis: AnalysisProjection) {
  if (tab === "diffusion") return <CascadeTree nodes={analysis.diffusion.tree} />;
  if (tab === "opinion") {
    return (
      <StanceDistribution
        points={analysis.opinion.stance_by_tick}
        polarization={analysis.opinion.polarization_index}
      />
    );
  }
  if (tab === "influence") return <InfluenceBoard ranking={analysis.influence.ranking} />;
  if (tab === "temporal") {
    return (
      <SentimentTimeline
        curve={analysis.temporal.fermentation_curve}
        reversals={analysis.temporal.sentiment_reversals}
      />
    );
  }
  return <TrendSummary analysis={analysis} />;
}

export default function RetroScreen() {  // review:P8-T7
  const { id = "" } = useParams();
  const { key, model, baseUrl, reasoningEffort, thinking } = useApiKey();
  const [analysis, setAnalysis] = useState<AnalysisProjection | null>(null);
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [tab, setTab] = useState<AnalysisTab>("diffusion");

  useEffect(() => {
    getAnalysis(id)
      .then(setAnalysis)
      .catch(() => setAnalysis(EMPTY_ANALYSIS));
    fetchRunSnapshot(id)
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
    fetchSavedInsights(id)
      .then(setInsights)
      .catch(() => setInsights(null));
  }, [id]);

  const projection = analysis ?? EMPTY_ANALYSIS;
  const cards = useMemo(() => insightCards(projection), [projection]);
  const phases = useMemo(() => phaseCards(projection), [projection]);
  const seed = seedPost(snapshot);
  const totalComments = projection.temporal.fermentation_curve.reduce(
    (sum, point) => sum + point.volume,
    0,
  );

  if (!analysis) {
    return <div className="text-ink/40">复盘加载中…</div>;
  }

  return (
    <div className="grid min-h-[calc(100vh-108px)] overflow-hidden rounded-card border border-line bg-white shadow-spotlight lg:grid-cols-[320px_minmax(0,1fr)_360px]">
      <aside className="hidden bg-slate-950 p-6 text-white lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand text-xl font-black text-slate-950">
            {authorName(snapshot).slice(0, 1)}
          </div>
          <div>
            <div className="text-sm font-bold">{authorName(snapshot)}</div>
            <div className="mt-0.5 text-xs text-white/50">来自 Web</div>
          </div>
        </div>
        <div className="text-lg font-bold leading-7">{seed?.content ?? "历史内容"}</div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-b border-white/10 pb-5 text-center text-sm">
          <Metric value={projection.diffusion.cascade_size} label="扩散" />
          <Metric value={projection.influence.ranking.length} label="节点" />
          <Metric value={totalComments} label="互动" />
        </div>
        <nav className="mt-5 grid gap-2">
          {analysisTabs.map((item) => (
            <button
              key={item.key}
              className={[
                "rounded-card px-3 py-3 text-left text-sm font-semibold transition",
                tab === item.key
                  ? "bg-brand/20 text-brand shadow-[inset_3px_0_0_#F5B12F]"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
              ].join(" ")}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <a
          href={`/run/${id}/live?replay=1`}
          className="mt-8 flex min-h-11 items-center justify-center rounded-card bg-white/10 text-sm font-semibold text-white hover:bg-white/20"
        >
          回到评论区
        </a>
      </aside>

      <section className="min-w-0 bg-[#f8fafc] p-5 lg:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-normal">围观回放</h1>
            <p className="mt-1 text-lg font-semibold text-slate-700">发酵时间线</p>
          </div>
          <div className="flex rounded-card border border-line bg-white p-1 text-sm font-semibold text-slate-500">
            {analysisTabs.map((item) => (
              <button
                key={item.key}
                className={[
                  "min-h-9 rounded px-4",
                  tab === item.key ? "bg-slate-100 text-slate-950 shadow-sm" : "hover:text-accent",
                ].join(" ")}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {phases.map((phase) => (
            <article key={phase.title} className="rounded-card border border-line bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-slate-500">{phase.value}</div>
              <h2 className="mt-2 text-base font-black text-slate-950">{phase.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{phase.body}</p>
            </article>
          ))}
        </div>

        <div className="rounded-card border border-line bg-white/70 p-4 shadow-sm">
          {renderMain(tab, projection)}
        </div>
      </section>

      <aside className="grid content-start gap-4 border-l border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">创作者洞察</h2>
          <span className="rounded-full border border-line px-2 py-1 text-xs text-slate-500">i</span>
        </div>

        {cards.map((card) => (
          <article key={card.title} className="rounded-card border border-line bg-white p-4 shadow-sm">
            <h3 className="font-black">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
          </article>
        ))}

        <Button
          onClick={() => {
            setLoadingInsights(true);
            fetchInsights(id, { key, model, baseUrl, reasoningEffort, thinking })
              .then(setInsights)
              .catch(() => {})
              .finally(() => setLoadingInsights(false));
          }}
        >
          {loadingInsights ? "生成中..." : insights ? "重新生成建议" : "生成建议"}
        </Button>

        {insights && (
          <div className="rounded-card border border-brand/30 bg-brand/10 p-4 shadow-sm">
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

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="tabular font-bold">{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}

function TrendSummary({ analysis }: { analysis: AnalysisProjection }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <TrendCard label="传播深度" value={`${analysis.diffusion.max_depth} 层`} />
      <TrendCard label="峰值到达" value={`第 ${analysis.temporal.peak_tick} 拍`} />
      <TrendCard label="结构节点" value={`${analysis.influence.ranking.length} 个`} />
    </div>
  );
}

function TrendCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}
