import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchRuns, type RunSummary } from "../api/client";
import { Button } from "../components/Button";

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
    <section className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">历史记录</h1>
          <p className="mt-1 text-sm text-ink/60">
            找回之前围观过的内容，继续看评论区或发酵回放。
          </p>
        </div>
        <Button onClick={() => navigate("/")}>发起新的围观</Button>
      </div>

      {!loaded && <div className="text-sm text-ink/50">正在加载历史记录…</div>}
      {loaded && runs.length === 0 && (
        <div className="rounded-card border border-ink/10 bg-white p-6 text-sm text-ink/60">
          还没有历史推演。先发一条内容，让一群人围观一下。
        </div>
      )}

      <div className="grid gap-3">
        {runs.map((run) => (
          <article
            key={run.run_id}
            className="rounded-card border border-ink/10 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-ink/45">
                  {statusLabel(run.status)} · {run.steps} 步 · 微博客
                </div>
                <h2 className="mt-1 line-clamp-2 text-base font-semibold">
                  {run.content}
                </h2>
                <div className="mt-3 flex gap-4 text-sm text-ink/55">
                  <span>
                    评论{" "}
                    <span className="tabular">{run.totals.replies ?? 0}</span>
                  </span>
                  <span>
                    转发{" "}
                    <span className="tabular">{run.totals.reposts ?? 0}</span>
                  </span>
                  <span>
                    点赞 <span className="tabular">{run.totals.likes ?? 0}</span>
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
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
    </section>
  );
}
