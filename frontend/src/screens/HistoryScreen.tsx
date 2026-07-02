import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchRuns, type RunSummary } from "../api/client";
import { Button } from "../components/Button";
import { TrendRail } from "../components/TrendRail";

function statusLabel(status: RunSummary["status"]): string {
  if (status === "done") return "已完成";
  if (status === "running") return "进行中";
  if (status === "error") return "已中断";
  return "已创建";
}

export default function HistoryScreen() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRuns()
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoaded(true));
  }, []);

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
          <div className="grid gap-3">
            {runs.map((run) => (
              <article
                key={run.run_id}
                className="rounded-card border border-line bg-white p-5 shadow-sm transition hover:border-accent/40 hover:shadow-spotlight"
              >
                <div
                  data-testid="history-run-card-layout"
                  className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
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
                    <h2 className="mt-3 line-clamp-2 text-lg font-bold leading-7">
                      {run.content}
                    </h2>
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
