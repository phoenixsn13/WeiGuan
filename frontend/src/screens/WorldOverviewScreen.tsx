import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchLaunches,
  fetchRuns,
  getIdentities,
  listPersons,
  type IdentitySummary,
  type PersonView,
  type RunSummary,
} from "../api/client";
import { Button } from "../components/Button";
import { world } from "../design/tokens";
import { groupWorldCards, type WorldCardView } from "../pov/worlds";

function statusLabel(status: string): string {
  if (status === "done") return "已完成";
  if (status === "running") return "发酵中";
  if (status === "error") return "已中断";
  return "已创建";
}

async function loadWorldCards(): Promise<WorldCardView[]> {
  const identities = await getIdentities();
  if (identities.length === 0) return [];

  const [runs, launches] = await Promise.all([fetchRuns(), fetchLaunches()]);
  const worldIds = [...new Set(identities.map((identity) => identity.world_id))];
  const personEntries = await Promise.all(
    worldIds.map(async (worldId): Promise<[string, PersonView[]]> => [
      worldId,
      await listPersons(worldId).catch(() => []),
    ]),
  );
  return groupWorldCards(
    identities,
    runs,
    Object.fromEntries(personEntries),
    launches,
  );
}

function totalIdentities(cards: WorldCardView[]): number {
  return cards.reduce((sum, card) => sum + card.identityCount, 0);
}

function totalInfluence(cards: WorldCardView[]): number {
  return Math.round(cards.reduce((sum, card) => sum + card.totalInfluence, 0));
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

export default function WorldOverviewScreen() {  // review:P11-T6
  const [cards, setCards] = useState<WorldCardView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

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
    <section className="mx-auto max-w-6xl">
      <div className="mb-5 rounded-card border border-line bg-white p-5 shadow-spotlight">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-normal">世界总览</h1>
            <p className="mt-1 text-sm text-slate-500">
              查看持续身份、平台现场和最近发酵的内容。
            </p>
          </div>
          <Button onClick={() => navigate("/compose")}>发起一条内容</Button>
        </div>
        {cards.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="持续世界" value={cards.length} />
            <Metric label="持续身份" value={totalIdentities(cards)} />
            <Metric label="累计影响力" value={totalInfluence(cards)} />
          </div>
        )}
      </div>

      {!loaded && <WorldOverviewSkeleton />}
      {loaded && failed && (
        <div className="rounded-card border border-line bg-white p-8 text-sm text-slate-500">
          世界读取失败，请稍后重试。
        </div>
      )}
      {loaded && !failed && cards.length === 0 && (
        <div className="rounded-card border border-dashed border-line bg-white p-8">
          <h2 className="text-lg font-black tracking-normal">还没有持续世界</h2>
          <p className="mt-2 text-sm text-slate-500">
            先发起一条内容，让它在不同人群里留下记录。
          </p>
        </div>
      )}

      {cards.length > 0 && (
        <div className="grid gap-4">
          {cards.map((card) => (
            <article
              key={card.worldId}
              className="grid gap-5 rounded-card border border-line bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                  <span className="rounded-full px-2 py-1" style={{ backgroundColor: `${world.identity}22`, color: world.line }}>
                    {statusLabel(card.status)}
                  </span>
                  <span>{card.identityCount} 个持续身份</span>
                  <span>{card.platformCount} 个平台现场</span>
                </div>
                <h2 className="mt-3 text-xl font-black tracking-normal">{card.primaryIdentityName}</h2>
                <p className="mt-2 line-clamp-2 text-lg font-bold leading-7">{card.latestRunContent}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                  <span>评论 <span className="tabular font-semibold text-slate-950">{card.totals.replies}</span></span>
                  <span>转发 <span className="tabular font-semibold text-slate-950">{card.totals.reposts}</span></span>
                  <span>点赞 <span className="tabular font-semibold text-slate-950">{card.totals.likes}</span></span>
                  <span>围观 <span className="tabular font-semibold text-slate-950">{card.runCount}</span></span>
                </div>
              </div>
              <div className="grid content-start gap-2 sm:grid-cols-2 lg:w-48 lg:grid-cols-1">
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-slate-50 p-4">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black tabular text-slate-950">{value}</div>
    </div>
  );
}
