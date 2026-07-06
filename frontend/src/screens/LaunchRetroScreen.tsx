import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  fetchFlavor,
  fetchLaunches,
  getWorldEvents,
  type FlavorDigest,
  type LaunchSummary,
  type WorldEvent,
} from "../api/client";
import { useApiKey } from "../api/useApiKey";
import { RunAnalysisPanel } from "../components/RunAnalysisPanel";
import { labelForPlatform } from "../skins/skin";

function launchStatusLabel(launch: LaunchSummary): string {
  if (launch.status === "done") return "已完成";
  if (launch.status === "error") return "已中断";
  if (launch.status === "running") return "发酵中";
  return "已创建";
}

function bridgeText(event: WorldEvent): string {
  const payload = event.payload;
  const source = typeof payload.source_platform === "string"
    ? labelForPlatform(payload.source_platform)
    : "其他平台";
  const content = typeof payload.content === "string" ? payload.content : "一段讨论被带到另一个平台继续发酵";
  return `${source} → ${labelForPlatform(event.platform)} · 第 ${event.tick} 拍：${content}`;
}

export default function LaunchRetroScreen() {  // review:P13-T6
  const { id: worldId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const creds = useApiKey();
  const launchId = searchParams.get("launch") ?? "";
  const [launch, setLaunch] = useState<LaunchSummary | null>(null);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [flavor, setFlavor] = useState<FlavorDigest | null>(null);
  const [activeRunId, setActiveRunId] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "idle" | "error">("loading");

  useEffect(() => {
    setLoadState("loading");
    fetchLaunches()
      .then((launches) => {
        const selected = launches.find((item) => item.launch_id === launchId) ?? null;
        setLaunch(selected);
        setActiveRunId(selected?.run_ids[0] ?? "");
        if (!selected) return null;
        const eventsPromise = getWorldEvents(worldId, selected.run_ids);
        const flavorPromise: Promise<FlavorDigest | null> = selected.run_ids[0]
          ? fetchFlavor(selected.run_ids[0], worldId)
          : Promise.resolve(null);
        return Promise.all([eventsPromise, flavorPromise] as const);
      })
      .then((result) => {
        if (!result) {
          setEvents([]);
          setFlavor(null);
          return;
        }
        setEvents(result[0].frames);
        setFlavor(result[1]);
      })
      .then(() => setLoadState("idle"))
      .catch(() => setLoadState("error"));
  }, [launchId, worldId]);

  const bridgeEvents = useMemo(
    () => events.filter((event) => event.kind === "bridge_inject"),
    [events],
  );
  const activeIndex = Math.max(0, launch?.run_ids.findIndex((runId) => runId === activeRunId) ?? 0);
  const activePlatform = launch?.platforms[activeIndex] ?? "twitter";

  if (loadState === "loading") {
    return <div className="rounded-card border border-line bg-white p-8 text-ink/40">复盘加载中…</div>;
  }
  if (loadState === "error" || !launch) {
    return (
      <div className="rounded-card border border-line bg-white p-8 text-sm text-ink/60">
        没有找到这次发起的复盘。
      </div>
    );
  }

  return (
    <section className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <header className="mb-4 rounded-card border border-line bg-white p-5 shadow-spotlight">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-muted">
                {launchStatusLabel(launch)} · {launch.clock_tick ?? launch.steps} 拍 · {launch.platforms.map(labelForPlatform).join(" + ")}
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-normal">{launch.content}</h1>
            </div>
            <button
              className="min-h-11 rounded-card bg-ink px-4 text-sm font-semibold text-cream hover:bg-accent"
              onClick={() => {
                const query = new URLSearchParams();
                launch.run_ids.forEach((runId) => query.append("run_id", runId));
                query.set("launch", launch.launch_id);
                navigate(`/world/${worldId}/live?${query.toString()}`);
              }}
            >
              回到现场
            </button>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2 rounded-card border border-line bg-white p-2 shadow-sm">
          {launch.run_ids.map((runId, index) => {
            const platform = launch.platforms[index] ?? "twitter";
            return (
              <button
                key={runId}
                className={[
                  "min-h-10 rounded px-4 text-sm font-bold",
                  activeRunId === runId ? "bg-brand text-ink" : "text-muted hover:bg-cream",
                ].join(" ")}
                onClick={() => setActiveRunId(runId)}
              >
                {labelForPlatform(platform)}
              </button>
            );
          })}
        </div>

        {activeRunId && (
          <RunAnalysisPanel
            key={activeRunId}
            runId={activeRunId}
            creds={creds}
            variant="embedded"
          />
        )}
      </div>

      <aside className="grid content-start gap-4">
        <article className="rounded-card border border-line bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">桥接摘要</h2>
          <p className="mt-1 text-sm text-muted">
            观察讨论如何从一个平台外溢到另一个平台。
          </p>
          <div className="mt-4 grid gap-3">
            {bridgeEvents.map((event) => (
              <div key={event.event_id} className="rounded-card border border-line bg-cream p-3 text-sm leading-6">
                {bridgeText(event)}
              </div>
            ))}
            {bridgeEvents.length === 0 && (
              <div className="rounded-card border border-dashed border-line p-4 text-sm text-subtle">
                暂无跨平台桥接。
              </div>
            )}
          </div>
        </article>

        <article className="rounded-card border border-line bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">平台风味</h2>
          <p className="mt-1 text-sm text-muted">
            {labelForPlatform(activePlatform)} 当前的讨论形态。
          </p>
          <div className="mt-4 grid gap-3">
            {(flavor?.platforms ?? []).map((item) => (
              <div key={item.platform} className="rounded-card border border-line p-3">
                <div className="text-sm font-black">{labelForPlatform(item.platform)}</div>
                <div className="mt-1 text-sm text-muted">
                  {item.spread_shape} · {item.volume} 条素材
                </div>
              </div>
            ))}
            {(flavor?.cross_platform_notes ?? []).map((note, index) => (
              <div key={index} className="rounded-card border border-brand/30 bg-brand/10 p-3 text-sm leading-6">
                {note}
              </div>
            ))}
          </div>
        </article>
      </aside>
    </section>
  );
}
