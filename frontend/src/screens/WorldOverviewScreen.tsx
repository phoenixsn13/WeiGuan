import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchWorlds,
  type RunSummary,
} from "../api/client";
import { Button } from "../components/Button";
import { GlobeIcon, MessageCircleIcon, SendIcon, UsersIcon, ZapIcon } from "../components/icons";
import { TrendRail } from "../components/TrendRail";
import { world } from "../design/tokens";
import { worldCardsFromSummaries, type WorldCardView } from "../pov/worlds";

function statusLabel(status: string): string {
  if (status === "done") return "已完成";
  if (status === "running") return "发酵中";
  if (status === "error") return "已中断";
  return "已创建";
}

async function loadWorldCards(): Promise<WorldCardView[]> {
  return worldCardsFromSummaries(await fetchWorlds());
}

function scopedWorldLiveUrl(card: WorldCardView): string {
  const runIds = card.latestLaunchRunIds ?? [];
  if (runIds.length === 0) {
    return `/world/${card.worldId}/live`;
  }
  const query = new URLSearchParams();
  runIds.forEach((runId) => query.append("run_id", runId));
  return `/world/${card.worldId}/live?${query.toString()}`;
}

function identityUrl(card: WorldCardView): string | null {
  if (!card.primaryIdentityId) return null;
  return `/identity/${card.primaryIdentityId}?world_id=${card.worldId}`;
}

function runsForTrend(cards: WorldCardView[]): RunSummary[] {
  return cards.map((card) => ({
    run_id: card.latestRunId ?? card.worldId,
    world_id: card.worldId,
    content: card.latestRunContent.trim() ? card.latestRunContent : card.worldName,
    steps: 0,
    platform: "twitter",
    status: card.status as RunSummary["status"],
    current_step: 0,
    totals: card.totals,
    created_at: card.latestCreatedAt,
  }));
}

function hasWorldActivity(card: WorldCardView): boolean {
  return card.runCount > 0 || card.latestRunContent.trim() !== "还没有内容";
}

export default function WorldOverviewScreen() {  // review:P11-T6
  const [cards, setCards] = useState<WorldCardView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const activeCards = cards.filter(hasWorldActivity);
  const trendRuns = runsForTrend(activeCards);

  useEffect(() => {
    loadWorldCards()
      .then((nextCards) => {
        setCards(nextCards);
        setFailed(false);
      })
      .catch(() => {
        setCards([]);
        setFailed(true);
      })
      .finally(() => setLoaded(true));
  }, []);

  return (
    <section className="mx-auto max-w-[1280px]">
      <div className="mb-5 rounded-card border border-line bg-white p-5 shadow-spotlight md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
              <GlobeIcon className="h-4 w-4" />
              <span>世界</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-normal">世界</h1>
            <p className="mt-2 text-sm text-slate-500">
              查看已经沉淀的讨论世界和身份关系。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/compose")}>发起一条内容</Button>
            <Button variant="ghost" onClick={() => navigate("/compose")}>新建世界</Button>
          </div>
        </div>
      </div>

      {!loaded && <WorldOverviewSkeleton />}
      {loaded && failed && (
        <div className="rounded-card border border-line bg-white p-8 text-sm text-slate-500">
          世界读取失败，请稍后重试。
        </div>
      )}
      {loaded && !failed && activeCards.length === 0 && (
        <div className="rounded-card border border-dashed border-line bg-white p-8">
          <h2 className="text-lg font-black tracking-normal">还没有持续世界</h2>
          <p className="mt-2 text-sm text-slate-500">
            先发起一条内容，让它在不同人群里留下记录。
          </p>
        </div>
      )}

      {activeCards.length > 0 && (
        <div
          data-testid="world-overview-desktop-grid"
          className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]"
        >
          <div className="lg:sticky lg:top-24 lg:self-start">
            <TrendRail runs={trendRuns} />
          </div>
          <div className="grid gap-4">
            {activeCards.map((card, index) => (
              <article
                data-testid={`world-card-${card.worldId}`}
                key={card.worldId}
                className="grid gap-4 rounded-card border border-line bg-white p-5 shadow-sm transition hover:border-accent/40 hover:shadow-spotlight lg:grid-cols-[64px_minmax(0,1fr)_260px]"
              >
                <div
                  className="grid h-14 w-14 place-items-center rounded-2xl text-slate-950"
                  style={{ backgroundColor: index < 3 ? world.identity : "#EEF3F8" }}
                >
                  {index < 3 ? <ZapIcon className="h-6 w-6" /> : <GlobeIcon className="h-6 w-6" />}
                </div>
                <div className="min-w-0 self-center">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                      {statusLabel(card.status)}
                    </span>
                    <span>{card.platformCount} 个平台现场</span>
                    <span>{card.runCount} 次发起</span>
                  </div>
                  <h2 className="mt-2 line-clamp-1 text-xl font-black tracking-normal">{card.worldName}</h2>
                  <p className="mt-2 line-clamp-2 text-base font-bold leading-7 text-slate-950">
                    {card.latestRunContent}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <MetricLine icon={<UsersIcon className="h-4 w-4" />} label="身份数" value={card.identityCount} />
                    <MetricLine icon={<ZapIcon className="h-4 w-4" />} label="总影响力" value={Math.round(card.totalInfluence)} />
                    <MetricLine icon={<GlobeIcon className="h-4 w-4" />} label="平台数" value={card.platformCount} />
                  </div>
                </div>
                <div className="grid content-center gap-3">
                  {identityUrl(card) && (
                    <button
                      className="truncate text-left text-sm font-bold text-accent underline-offset-4 hover:underline"
                      onClick={() => navigate(identityUrl(card) as string)}
                    >
                      {card.primaryIdentityName}
                    </button>
                  )}
                  <div className="grid grid-cols-3 gap-2 rounded-card border border-line bg-slate-50 p-3 text-center text-xs text-slate-500">
                    <MiniMetric label="身份数" value={card.identityCount} />
                    <MiniMetric label="平台数" value={card.platformCount} />
                    <MiniMetric label="运行次数" value={card.runCount} />
                  </div>
                  <Button onClick={() => navigate(scopedWorldLiveUrl(card))}>
                    {card.latestLaunchRunIds?.length ? "看最新现场" : "看现场"}
                  </Button>
                  {card.latestLaunchRunIds?.length ? (
                    <Button variant="ghost" onClick={() => navigate(`/world/${card.worldId}/live`)}>
                      世界全景
                    </Button>
                  ) : null}
                  {card.latestRunId && (
                    <Button variant="ghost" onClick={() => navigate(`/run/${card.latestRunId}/retro`)}>
                      看回放
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function WorldOverviewSkeleton() {
  return (
    <div data-testid="world-overview-skeleton" className="grid gap-4" aria-label="世界正在读取">
      {[0, 1].map((item) => (
        <div key={item} className="grid gap-5 rounded-card border border-line bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-full bg-cream" />
              <div className="h-6 w-28 rounded-full bg-cream" />
              <div className="h-6 w-24 rounded-full bg-cream" />
            </div>
            <div className="mt-4 h-7 w-40 rounded-full bg-cream" />
            <div className="mt-3 h-6 w-full max-w-xl rounded-full bg-cream" />
            <div className="mt-5 flex gap-4">
              <div className="h-5 w-16 rounded-full bg-cream" />
              <div className="h-5 w-16 rounded-full bg-cream" />
              <div className="h-5 w-16 rounded-full bg-cream" />
            </div>
          </div>
          <div className="grid content-start gap-2 sm:grid-cols-2 lg:w-48 lg:grid-cols-1">
            <div className="h-10 rounded-card bg-cream" />
            <div className="h-10 rounded-card bg-cream" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
      <span className="tabular font-black text-slate-950">{value}</span>
    </span>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="tabular text-base font-black text-slate-950">{value}</div>
      <div className="mt-1">{label}</div>
    </div>
  );
}
