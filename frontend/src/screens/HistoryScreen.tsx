import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchRuns, listPersons, type PersonView, type RunSummary } from "../api/client";
import { Button } from "../components/Button";
import { TrendRail } from "../components/TrendRail";
import { groupRunsByIdentity, TEMPORARY_PERSON_ID } from "../pov/identity";

function statusLabel(status: RunSummary["status"]): string {
  if (status === "done") return "已完成";
  if (status === "running") return "进行中";
  if (status === "error") return "已中断";
  return "已创建";
}

export default function HistoryScreen() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [persons, setPersons] = useState<PersonView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRuns()
      .then(async (nextRuns) => {
        setRuns(nextRuns);
        const worldIds = [
          ...new Set(nextRuns.map((run) => run.world_id).filter((id): id is string => Boolean(id))),
        ];
        const personLists = await Promise.all(
          worldIds.map((worldId) => listPersons(worldId).catch(() => [])),
        );
        setPersons(personLists.flat());
      })
      .catch(() => {
        setRuns([]);
        setPersons([]);
      })
      .finally(() => setLoaded(true));
  }, []);

  const groups = groupRunsByIdentity(persons, runs);

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

      {!loaded && <div className="text-sm text-ink/50">正在加载历史记录…</div>}
      {loaded && runs.length === 0 && (
        <div className="rounded-card border border-line bg-white p-8 text-sm text-slate-500 shadow-spotlight">
          还没有历史推演。先发一条内容，让一群人围观一下。
        </div>
      )}

      {runs.length > 0 && (
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
                      <h2 className="text-lg font-black tracking-normal">
                        {group.person.person.display_name}
                      </h2>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                        <span>{group.runs.length} 次围观</span>
                        <span>影响力 {Math.round(group.person.total_influence)}</span>
                      </div>
                    </div>
                  </div>
                  {group.person.person.accounts[0] && (
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {group.person.person.accounts[0].num_followers.toLocaleString()} 粉丝
                    </div>
                  )}
                  {group.runs[0]?.world_id && group.person.person.person_id !== TEMPORARY_PERSON_ID && (
                    <Button variant="ghost" onClick={() => navigate(`/world/${group.runs[0].world_id}/live`)}>
                      看多平台现场
                    </Button>
                  )}
                </div>
                <div className="mt-4 grid gap-3">
                  {group.runs.map((run) => (
                    <div
                      key={run.run_id}
                      data-testid="history-run-card-layout"
                      className="grid gap-4 rounded-card border border-line p-4 transition hover:border-accent/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1">
                            {statusLabel(run.status)}
                          </span>
                          <span>
                            {run.steps} 步 · 微博客
                          </span>
                        </div>
                        <div className="sr-only">
                          {statusLabel(run.status)} · {run.steps} 步 · 微博客
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-lg font-bold leading-7">
                          {run.content}
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                          <span>
                            评论{" "}
                            <span className="tabular font-semibold text-slate-950">{run.totals.replies ?? 0}</span>
                          </span>
                          <span>
                            转发{" "}
                            <span className="tabular font-semibold text-slate-950">{run.totals.reposts ?? 0}</span>
                          </span>
                          <span>
                            点赞 <span className="tabular font-semibold text-slate-950">{run.totals.likes ?? 0}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2 sm:justify-end">
                        <button
                          className="min-h-11 rounded-card border border-ink/10 px-3 text-sm hover:border-accent hover:text-accent"
                          onClick={() => navigate(`/run/${run.run_id}/live?replay=1`)}
                        >
                          看评论区
                        </button>
                        <button
                          className="min-h-11 rounded-card bg-ink px-3 text-sm text-cream hover:bg-accent"
                          onClick={() => navigate(`/run/${run.run_id}/retro`)}
                        >
                          看回放
                        </button>
                      </div>
                    </div>
                  ))}
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
