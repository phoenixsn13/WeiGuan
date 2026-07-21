import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { getWorldEvents, listPersons, type PersonView, type WorldEvent } from "../api/client";
import { ArrowRightIcon, RedditIcon, WeiboIcon } from "../components/icons";
import { world } from "../design/tokens";
import type { Actor } from "../model/canonical";
import { mergeEvents, multiPlatformView } from "../pov/multiplatform";
import { labelForPlatform, PlatformSkinFeed, skinForPlatform } from "../skins/skin";

type PlatformId = "twitter" | "reddit";

function PlatformMark({ platform, className = "h-7 w-7" }: { platform: PlatformId; className?: string }) {
  const Icon = platform === "reddit" ? RedditIcon : WeiboIcon;
  return <Icon className={className} />;
}

function BridgePathPanel({ bridges }: { bridges: ReturnType<typeof multiPlatformView>["bridges"] }) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-card border border-white/10 bg-white/[0.06] p-4 text-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <div className="text-lg font-black">桥接路径</div>
          <div className="mt-1 text-xs text-white/50">讨论从一个平台外溢到另一个平台</div>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white/70">
          {bridges.length}
        </span>
      </div>
      <div className="mt-4 grid min-h-0 gap-3 overflow-y-auto pr-1">
        {bridges.map((bridge, index) => (
          <div key={`${bridge.fromPlatform}-${bridge.toPlatform}-${bridge.tick}-${index}`} className="rounded-card border border-white/10 bg-nightScrim p-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <PlatformMark platform={bridge.fromPlatform as PlatformId} className="h-5 w-5" />
              <span>{labelForPlatform(bridge.fromPlatform)}</span>
              <ArrowRightIcon className="h-4 w-4" style={{ color: world.line }} />
              <PlatformMark platform={bridge.toPlatform as PlatformId} className="h-5 w-5" />
              <span>{labelForPlatform(bridge.toPlatform)}</span>
            </div>
            <div className="mt-2 text-xs text-white/45">第 {bridge.tick} 拍 · 关联内容 #{bridge.postRef}</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: world.line }} />
            </div>
          </div>
        ))}
        {bridges.length === 0 && (
          <div className="rounded-card border border-dashed border-white/10 p-4 text-sm text-white/45">
            暂无跨平台外溢。
          </div>
        )}
      </div>
    </aside>
  );
}

type LoadState = "idle" | "loading" | "error";
const WORLD_EVENT_POLL_MS = 1500;
type LaunchStatus = string | null;

function statusLabel(status: LaunchStatus, clockTick: number): string {
  if (status === "done") return `已完成 · 共 ${clockTick} 拍`;
  if (status === "error") return `出错 · 第 ${clockTick} 拍`;
  return `发酵中 · 第 ${clockTick} 拍`;
}

function platformFromRunId(runId: string): PlatformId | null {
  const lower = runId.toLowerCase();
  if (lower.includes("reddit")) return "reddit";
  if (lower.includes("twitter") || lower.includes("weibo")) return "twitter";
  return null;
}

// review:P9-T6
export default function MultiPlatformLiveScreen({ events }: { events?: WorldEvent[] }) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loadedEvents, setLoadedEvents] = useState<WorldEvent[]>([]);
  const [personViews, setPersonViews] = useState<PersonView[]>([]);
  const [nextAfter, setNextAfter] = useState(0);
  const [clockTick, setClockTick] = useState(0);
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>(null);
  const [loadState, setLoadState] = useState<LoadState>(events ? "idle" : "loading");
  const runIds = useMemo(() => searchParams.getAll("run_id"), [searchParams]);
  const launchId = searchParams.get("launch");

  const loadWorldEvents = useCallback(async (options: { silent?: boolean; append?: boolean; after?: number } = {}) => {
    if (events !== undefined) return;
    const worldId = params.id;
    if (!worldId) {
      setLoadedEvents([]);
      setNextAfter(0);
      setClockTick(0);
      setLaunchStatus(null);
      setLoadState("idle");
      return;
    }
    if (!options.silent) {
      setLoadState("loading");
    }
    try {
      // review:P11-T4
      const page = options.after === undefined
        ? await getWorldEvents(worldId, runIds)
        : await getWorldEvents(worldId, runIds, options.after);
      setLoadedEvents((current) => (
        options.append ? mergeEvents(current, page.frames) : page.frames
      ));
      setNextAfter(page.next_after);
      setClockTick(page.clock_tick);
      setLaunchStatus(page.launch_status);
      setLoadState("idle");
    } catch {
      setLoadState("error");
    }
  }, [events, params.id, runIds]);

  useEffect(() => {
    void loadWorldEvents();
  }, [loadWorldEvents]);

  useEffect(() => {
    if (events !== undefined || !params.id) {
      setPersonViews([]);
      return;
    }
    let alive = true;
    listPersons(params.id)
      .then((items) => {
        if (alive) setPersonViews(items);
      })
      .catch(() => {
        if (alive) setPersonViews([]);
      });
    return () => {
      alive = false;
    };
  }, [events, params.id]);

  useEffect(() => {
    if (
      events !== undefined
      || !params.id
      || loadState !== "idle"
      || launchStatus === "done"
      || launchStatus === "error"
    ) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void loadWorldEvents({ silent: true, append: true, after: nextAfter });
    }, WORLD_EVENT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [events, launchStatus, loadState, loadWorldEvents, nextAfter, params.id]);

  const activeEvents = events ?? loadedEvents;
  const view = useMemo(
    () => multiPlatformView(activeEvents, personViews),
    [activeEvents, personViews],
  );
  const displayedClockTick = events ? view.clockTick : Math.max(clockTick, view.clockTick);
  const expectedPlatforms = useMemo(() => {
    const fromRuns = runIds.map(platformFromRunId).filter((platform): platform is PlatformId => Boolean(platform));
    const fromEvents = activeEvents.map((event) => event.platform).filter((platform): platform is PlatformId => platform === "twitter" || platform === "reddit");
    return [...new Set([...fromRuns, ...fromEvents])];
  }, [activeEvents, runIds]);
  const renderedPlatforms = new Set(view.columns.map((column) => column.platform));
  const missingPlatforms = expectedPlatforms.filter((platform) => !renderedPlatforms.has(platform));
  const modeLabel = runIds.length > 0
    ? `本次发起 · ${view.columns.length} 平台`
    : `世界全景 · 共 ${view.columns.length} 平台`;
  const liveStatusLabel = statusLabel(launchStatus, displayedClockTick);
  const hasBridges = view.bridges.length > 0;

  function identityHrefForActor(actor: Actor): string | undefined {
    if (!actor.person_id || !actor.world_id) return undefined;
    return `/identity/${actor.person_id}?world_id=${actor.world_id}`;
  }

  return (
    <div
      // review:P9-T8
      data-testid="world-live-stage"
      data-world-surface={world.surface}
      className="mx-auto flex h-[calc(100vh-7rem)] max-h-[calc(100vh-7rem)] max-w-[1500px] flex-col overflow-hidden rounded-card p-4 shadow-chrome"
      style={{ backgroundColor: world.surface }}
    >
      <section className="mb-4 shrink-0 rounded-card border border-white/10 bg-white/[0.04] p-5 text-white shadow-chrome">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-normal">多平台围观</h1>
            <p className="mt-1 text-sm text-white/60">同一条内容在不同平台各自发酵，桥接线表示讨论外溢。</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm font-bold">
            <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-white/75">
              {modeLabel}
            </span>
            <div className="rounded-card border border-white/10 bg-white/[0.08] px-5 py-3 text-right shadow-sm">
              <span className="sr-only">世界时钟 · 第 {displayedClockTick} 拍</span>
              <div className="text-xs font-semibold text-white/45">世界时钟</div>
              <div className="mt-1 text-xl font-black tabular">第 {displayedClockTick} 拍</div>
              {events === undefined && (
                <div className="mt-1 text-xs font-bold text-white/60">{liveStatusLabel}</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {loadState === "loading" && (
        <div className="grid min-h-0 flex-1 place-items-center rounded-card border border-dashed border-white/10 bg-white/[0.04] p-10 text-center text-sm text-white/55">
          正在进入多平台现场...
        </div>
      )}

      {loadState === "error" && (
        <div className="grid min-h-0 flex-1 place-items-center rounded-card border border-dashed border-white/10 bg-white/[0.04] p-10 text-center text-sm text-white/65">
          <div className="font-bold text-white">多平台现场加载失败</div>
          <button
            type="button"
            className="mt-4 rounded-card px-4 py-2 text-sm font-bold text-ink shadow-sm"
            style={{ backgroundColor: world.identity }}
            onClick={() => void loadWorldEvents()}
          >
            重试
          </button>
        </div>
      )}

      {loadState === "idle" && hasBridges && (
        <div className="mb-4 flex shrink-0 flex-wrap gap-2">
          {view.bridges.map((bridge, index) => (
            <div
              key={`${bridge.fromPlatform}-${bridge.toPlatform}-${bridge.tick}-${index}`}
              aria-label={`跨平台桥 ${bridge.fromPlatform} 到 ${bridge.toPlatform}`}
              data-from-platform={bridge.fromPlatform}
              data-to-platform={bridge.toPlatform}
              className="rounded-full border bg-white px-3 py-1 text-xs font-bold"
              style={{ borderColor: world.line, color: world.line }}
            >
              <span className="inline-flex items-center gap-1.5">
                <PlatformMark platform={bridge.fromPlatform as PlatformId} className="h-4 w-4" />
                {labelForPlatform(bridge.fromPlatform)}
                <ArrowRightIcon className="h-3.5 w-3.5" />
                <PlatformMark platform={bridge.toPlatform as PlatformId} className="h-4 w-4" />
                {labelForPlatform(bridge.toPlatform)} · 第 {bridge.tick} 拍
              </span>
            </div>
          ))}
        </div>
      )}

      {loadState === "idle" && (
        <div
          data-testid="world-live-content"
          className={[
            "grid min-h-0 flex-1 gap-3 overflow-hidden",
            view.columns.length + missingPlatforms.length > 1 ? "lg:grid-cols-3" : "max-w-4xl",
          ].join(" ")}
        >
          {view.columns.map((column) => {
            const skin = skinForPlatform(column.platform);
            return (
              <article key={column.platform} className="flex min-h-0 min-w-0 flex-col">
                <div className="mb-2 flex shrink-0 items-center justify-between rounded-card border border-white/10 bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2 text-lg font-black">
                    <PlatformMark platform={column.platform as PlatformId} />
                    {skin.label}
                  </div>
                  <div className="text-xs font-semibold text-muted">{labelForPlatform(column.platform)} 现场</div>
                </div>
                <div
                  data-testid="platform-scroll-viewport"
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-card"
                >
                  <PlatformSkinFeed
                    skin={skin.id}
                    vm={column.view}
                    identityHrefForActor={identityHrefForActor}
                    onIdentityClick={navigate}
                  />
                </div>
              </article>
            );
          })}
          {missingPlatforms.map((platform) => (
            <article key={`missing-${platform}`} className="flex min-h-0 min-w-0 flex-col">
              <div className="mb-2 flex shrink-0 items-center justify-between rounded-card border border-white/10 bg-white px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2 text-lg font-black">
                  <PlatformMark platform={platform} />
                  {labelForPlatform(platform)}
                </div>
                <div className="text-xs font-semibold text-muted">{labelForPlatform(platform)} 现场</div>
              </div>
              <div className="grid min-h-0 flex-1 place-items-center rounded-card border border-dashed border-white/15 bg-white/[0.04] p-8 text-center text-white">
                <div>
                  <div className="text-lg font-black">{labelForPlatform(platform)} 暂无现场内容</div>
                  <p className="mt-2 text-sm leading-6 text-white/55">等待该平台的评论、转发或跨平台外溢。</p>
                </div>
              </div>
            </article>
          ))}
          {view.columns.length === 1 && missingPlatforms.length === 0 && (
            <aside className="min-h-0 overflow-y-auto rounded-card border border-white/10 bg-white/[0.06] p-4 text-white shadow-sm">
              <div className="text-lg font-black">本次只包含一个平台现场</div>
              <p className="mt-2 text-sm leading-6 text-white/55">
                这里保留单平台评论区的完整视角；多平台发起后会自动出现桥接路径和并列现场。
              </p>
            </aside>
          )}
          {view.columns.length + missingPlatforms.length > 1 && <BridgePathPanel bridges={view.bridges} />}
        </div>
      )}

      {events === undefined && launchStatus === "done" && launchId && (
        <div className="mt-4 flex shrink-0 justify-end">
          <button
            className="min-h-11 rounded-card bg-brand px-4 text-sm font-bold text-ink hover:brightness-105"
            onClick={() => navigate(`/world/${params.id}/retro?launch=${launchId}`)}
          >
            看结果
          </button>
        </div>
      )}

      {loadState === "idle" && view.columns.length === 0 && (
        <div className="grid min-h-0 flex-1 place-items-center rounded-card border border-dashed border-line bg-white p-10 text-center text-sm text-subtle">
          该世界还没有多平台内容
        </div>
      )}
    </div>
  );
}
