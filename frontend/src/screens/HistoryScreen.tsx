import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchLaunches,
  fetchRuns,
  listPersons,
  type LaunchSummary,
  type PersonView,
  type RunSummary,
} from "../api/client";
import { Button } from "../components/Button";
import { TrendRail } from "../components/TrendRail";
import { groupRunsByIdentity, TEMPORARY_PERSON_ID } from "../pov/identity";
import { labelForPlatform } from "../skins/skin";

function statusLabel(status: RunSummary["status"]): string {
  if (status === "done") return "已完成";
  if (status === "running") return "进行中";
  if (status === "error") return "已中断";
  return "已创建";
}

type LaunchGroup = { person: PersonView; launches: LaunchSummary[] };

function launchTime(launch: LaunchSummary): number {
  const parsed = launch.created_at ? Date.parse(launch.created_at) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function temporaryPerson(): PersonView {
  return {
    person: {
      person_id: TEMPORARY_PERSON_ID,
      display_name: "临时身份",
      persona_kind: "ordinary",
      accounts: [],
    },
    stance: { stance_counts: {}, dominant: "other" },
    total_influence: 0,
    run_ids: [],
    standing_timeline: [],
  };
}

function launchPlatformLabel(launch: LaunchSummary): string {
  return launch.platforms.map(labelForPlatform).join(" + ");
}

function launchLiveUrl(launch: LaunchSummary): string {
  if (!launch.world_id) {
    return `/run/${launch.run_ids[0]}/live?replay=1`;
  }
  const query = new URLSearchParams();
  launch.run_ids.forEach((runId) => query.append("run_id", runId));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return `/world/${launch.world_id}/live${suffix}`;
}

function identityUrl(group: LaunchGroup): string | null {
  const worldId = group.launches[0]?.world_id;
  const personId = group.person.person.person_id;
  if (!worldId || personId === TEMPORARY_PERSON_ID) return null;
  return `/identity/${personId}?world_id=${worldId}`;
}

function totalsForLaunch(launch: LaunchSummary, runMap: Map<string, RunSummary>): Record<string, number> {
  return launch.run_ids.reduce(
    (totals, runId) => {
      const run = runMap.get(runId);
      totals.replies += run?.totals.replies ?? 0;
      totals.reposts += run?.totals.reposts ?? 0;
      totals.likes += run?.totals.likes ?? 0;
      return totals;
    },
    { replies: 0, reposts: 0, likes: 0 },
  );
}

function groupLaunchesByIdentity(persons: PersonView[], launches: LaunchSummary[]): LaunchGroup[] {
  const remaining = new Map(launches.map((launch) => [launch.launch_id, launch]));
  const groups: LaunchGroup[] = [];

  for (const person of persons) {
    const personRunIds = new Set(person.run_ids);
    const groupedLaunches = [...remaining.values()]
      .filter(
        (launch) =>
          launch.poster_person_id === person.person.person_id ||
          launch.run_ids.some((runId) => personRunIds.has(runId)),
      )
      .sort((left, right) => launchTime(right) - launchTime(left) || left.launch_id.localeCompare(right.launch_id));
    if (groupedLaunches.length === 0) continue;
    groupedLaunches.forEach((launch) => remaining.delete(launch.launch_id));
    groups.push({ person, launches: groupedLaunches });
  }

  const temporaryLaunches = [...remaining.values()].sort(
    (left, right) => launchTime(right) - launchTime(left) || left.launch_id.localeCompare(right.launch_id),
  );
  if (temporaryLaunches.length > 0) {
    groups.push({ person: temporaryPerson(), launches: temporaryLaunches });
  }

  return groups.sort((left, right) => {
    const byTime = launchTime(right.launches[0]) - launchTime(left.launches[0]);
    return byTime || left.person.person.person_id.localeCompare(right.person.person.person_id);
  });
}

export default function HistoryScreen() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [launches, setLaunches] = useState<LaunchSummary[]>([]);
  const [persons, setPersons] = useState<PersonView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([fetchRuns(), fetchLaunches()])
      .then(async ([nextRuns, nextLaunches]) => {
        setRuns(nextRuns);
        setLaunches(nextLaunches);
        const worldIds = [
          ...new Set(
            [...nextRuns.map((run) => run.world_id), ...nextLaunches.map((launch) => launch.world_id)].filter(
              (id): id is string => Boolean(id),
            ),
          ),
        ];
        const personLists = await Promise.all(
          worldIds.map((worldId) => listPersons(worldId).catch(() => [])),
        );
        setPersons(personLists.flat());
      })
      .catch(() => {
        setRuns([]);
        setLaunches([]);
        setPersons([]);
      })
      .finally(() => setLoaded(true));
  }, []);

  const runMap = new Map(runs.map((run) => [run.run_id, run]));
  const groups = launches.length > 0
    ? groupLaunchesByIdentity(persons, launches)
    : groupRunsByIdentity(persons, runs).map((group) => ({
        person: group.person,
        launches: group.runs.map((run) => ({
          launch_id: run.run_id,
          kind: "single",
          world_id: run.world_id,
          content: run.content,
          steps: run.steps,
          platforms: [run.platform],
          run_ids: [run.run_id],
          status: run.status,
          clock_tick: run.current_step,
          poster_person_id: run.poster_person_id,
          poster_persona: run.poster_persona,
          created_at: run.created_at,
        })),
      }));

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 rounded-card border border-line bg-white p-5 shadow-spotlight">
        <div>
          <h1 className="text-3xl font-black tracking-normal">历史记录</h1>
          <p className="mt-1 text-sm text-slate-500">
            找回之前围观过的内容，继续看评论区或发酵回放。
          </p>
        </div>
        <Button onClick={() => navigate("/")}>发起新的围观</Button>
      </div>

      {!loaded && <HistorySkeleton />}
      {loaded && launches.length === 0 && runs.length === 0 && (
        <div className="rounded-card border border-line bg-white p-8 text-sm text-slate-500 shadow-spotlight">
          还没有历史推演。先发一条内容，让一群人围观一下。
        </div>
      )}

      {groups.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            {groups.map((group) => (
              <article
                key={group.person.person.person_id}
                className="rounded-card border border-line bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-brand text-base font-black text-slate-950">
                      {group.person.person.display_name.slice(0, 1)}
                    </div>
                    <div>
                      {identityUrl(group) ? (
                        <button
                          className="text-left text-lg font-black tracking-normal text-slate-950 underline-offset-4 hover:text-accent hover:underline"
                          onClick={() => navigate(identityUrl(group) as string)}
                        >
                          {group.person.person.display_name}
                        </button>
                      ) : (
                        <h2 className="text-lg font-black tracking-normal">
                          {group.person.person.display_name}
                        </h2>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                        <span>{group.launches.length} 次围观</span>
                        <span>影响力 {Math.round(group.person.total_influence)}</span>
                      </div>
                    </div>
                  </div>
                  {group.person.person.accounts[0] && (
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {group.person.person.accounts[0].num_followers.toLocaleString()} 粉丝
                    </div>
                  )}
                  {group.launches[0]?.world_id && group.person.person.person_id !== TEMPORARY_PERSON_ID && (
                    <Button variant="ghost" onClick={() => navigate(`/world/${group.launches[0].world_id}/live`)}>
                      看多平台现场
                    </Button>
                  )}
                </div>
                <div className="mt-4 grid gap-3">
                  {group.launches.map((launch) => {
                    const totals = totalsForLaunch(launch, runMap);
                    return (
                    <div
                      key={launch.launch_id}
                      data-testid="history-run-card-layout"
                      className="grid gap-4 rounded-card border border-line p-4 transition hover:border-accent/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1">
                            {statusLabel(launch.status)}
                          </span>
                          <span>{launch.steps} 拍</span>
                          <span>{launchPlatformLabel(launch)}</span>
                        </div>
                        <div className="sr-only">
                          {statusLabel(launch.status)} · {launch.steps} 拍 · {launchPlatformLabel(launch)}
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-lg font-bold leading-7">
                          {launch.content}
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                          <span>
                            评论{" "}
                            <span className="tabular font-semibold text-slate-950">{totals.replies}</span>
                          </span>
                          <span>
                            转发{" "}
                            <span className="tabular font-semibold text-slate-950">{totals.reposts}</span>
                          </span>
                          <span>
                            点赞 <span className="tabular font-semibold text-slate-950">{totals.likes}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-72 sm:justify-end">
                        {launch.kind === "multi" ? (
                          <>
                            <button
                              className="min-h-11 rounded-card bg-ink px-3 text-sm text-cream hover:bg-accent"
                              onClick={() => navigate(launchLiveUrl(launch))}
                            >
                              看现场
                            </button>
                            {launch.world_id && (
                              <button
                                className="min-h-11 rounded-card bg-brand px-3 text-sm font-semibold text-ink hover:brightness-105"
                                onClick={() => navigate(`/world/${launch.world_id}/retro?launch=${launch.launch_id}`)}
                              >
                                看复盘
                              </button>
                            )}
                            {launch.run_ids.map((runId, index) => {
                              const platform = launch.platforms[index] ?? runMap.get(runId)?.platform ?? "twitter";
                              return (
                                <span key={runId} className="flex gap-2">
                                  <button
                                    className="min-h-11 rounded-card border border-ink/10 px-3 text-sm hover:border-accent hover:text-accent"
                                    onClick={() => navigate(`/run/${runId}/live?replay=1`)}
                                  >
                                    {labelForPlatform(platform)}评论区
                                  </button>
                                  <button
                                    className="min-h-11 rounded-card border border-ink/10 px-3 text-sm hover:border-accent hover:text-accent"
                                    onClick={() => navigate(`/run/${runId}/retro`)}
                                  >
                                    {labelForPlatform(platform)}复盘
                                  </button>
                                </span>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <button
                              className="min-h-11 rounded-card border border-ink/10 px-3 text-sm hover:border-accent hover:text-accent"
                              onClick={() => navigate(`/run/${launch.run_ids[0]}/live?replay=1`)}
                            >
                              看评论区
                            </button>
                            <button
                              className="min-h-11 rounded-card bg-ink px-3 text-sm text-cream hover:bg-accent"
                              onClick={() => navigate(`/run/${launch.run_ids[0]}/retro`)}
                            >
                              看回放
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <TrendRail runs={runs} />
          </div>
        </div>
      )}
    </section>
  );
}

function HistorySkeleton() {
  return (
    <div data-testid="history-skeleton" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" aria-label="历史正在读取">
      <div className="grid gap-4">
        {[0, 1, 2].map((item) => (
          <article key={item} className="rounded-card border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <div className="h-11 w-11 rounded-full bg-cream" />
              <div className="min-w-0 flex-1">
                <div className="h-5 w-36 rounded-full bg-cream" />
                <div className="mt-2 h-4 w-48 rounded-full bg-cream" />
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-4 rounded-card border border-line p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <div className="h-5 w-28 rounded-full bg-cream" />
                  <div className="mt-4 h-6 w-full max-w-lg rounded-full bg-cream" />
                  <div className="mt-4 flex gap-4">
                    <div className="h-4 w-16 rounded-full bg-cream" />
                    <div className="h-4 w-16 rounded-full bg-cream" />
                    <div className="h-4 w-16 rounded-full bg-cream" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-10 w-20 rounded-card bg-cream" />
                  <div className="h-10 w-20 rounded-card bg-cream" />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden rounded-card border border-line bg-white p-5 shadow-sm lg:block">
        <div className="h-6 w-28 rounded-full bg-cream" />
        <div className="mt-5 grid gap-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-8 rounded-full bg-cream" />
          ))}
        </div>
      </div>
    </div>
  );
}
