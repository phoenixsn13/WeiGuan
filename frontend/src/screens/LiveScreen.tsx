import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useRunStream, type EventSourceFactory } from "../api/runStream";
import { InterviewDrawer } from "../components/InterviewDrawer";
import type { Actor } from "../model/canonical";
import { posterView } from "../pov/poster";
import { XFeed } from "../skins/x/XFeed";

// review:P3-T5  进行时装配（第一人称 X 皮肤 + 悬浮控制条）
export default function LiveScreen({
  streamFactory,
}: {
  streamFactory?: EventSourceFactory;
}) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { snapshot, step, total, status } = useRunStream(id, streamFactory);
  const [selected, setSelected] = useState<Actor | null>(null);
  const vm = posterView(snapshot);
  const selectedHandle = selected?.user_name ?? selected?.user_id;

  return (
    <div className="relative mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card bg-ink px-4 py-3 text-cream shadow-spotlight">
        <div>
          <div className="text-sm font-semibold">
            {selected
              ? `正在从 @${selectedHandle} 的视角看`
              : "我看到的"}
          </div>
          <div className="text-xs text-cream/60">
            {status === "done" ? "围观已完成" : "评论和通知会逐步刷出来"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {selected && (
            <button
              className="min-h-11 rounded-card border border-cream/20 px-3 hover:border-brand"
              onClick={() => setSelected(null)}
            >
              回到我看到的
            </button>
          )}
          <button
            className="min-h-11 rounded-card border border-cream/20 px-3 hover:border-brand"
            onClick={() => navigate("/history")}
          >
            历史记录
          </button>
          <span>
            第 <span className="tabular">{step}</span>/
            <span className="tabular">{total}</span> 步
          </span>
        </div>
      </div>

      <XFeed
        vm={vm}
        onActorClick={setSelected}
        selectedActorId={selected?.user_id ?? null}
      />

      <div className="sticky bottom-4 z-10 mx-auto mt-4 flex max-w-4xl items-center gap-3 rounded-card border border-ink/10 bg-white/95 px-4 py-3 text-sm text-ink shadow-spotlight backdrop-blur">
        <span
          className={[
            "h-2.5 w-2.5 rounded-full",
            status === "done" ? "bg-sentiment-positive" : "bg-brand",
          ].join(" ")}
        />
        <span className="mr-auto">
          {status === "done" ? "围观完成" : "推演进行中"}
        </span>
        <button className="min-h-11 rounded-card px-3 text-ink/60 hover:bg-ink/5">
          上一步
        </button>
        <button className="min-h-11 rounded-card bg-accent px-4 text-white hover:brightness-105">
          暂停
        </button>
        <button className="min-h-11 rounded-card px-3 text-ink/60 hover:bg-ink/5">
          下一步
        </button>
        <button
          className="min-h-11 rounded-card bg-ink px-4 text-cream disabled:cursor-not-allowed disabled:opacity-40"
          disabled={status !== "done"}
          onClick={() => navigate(`/run/${id}/retro`)}
        >
          看结果
        </button>
      </div>
      <InterviewDrawer runId={id} actor={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
