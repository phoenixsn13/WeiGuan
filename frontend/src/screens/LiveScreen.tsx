import { useNavigate, useParams } from "react-router-dom";

import { useRunStream, type EventSourceFactory } from "../api/runStream";
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
  const vm = posterView(snapshot);

  return (
    <div className="relative">
      <XFeed vm={vm} />
      <div className="sticky bottom-4 mt-6 flex items-center gap-4 rounded-card bg-ink px-4 py-2 text-sm text-cream shadow-spotlight">
        <span>
          第 <span className="tabular">{step}</span>/
          <span className="tabular">{total}</span> 步
        </span>
        <button className="opacity-70" aria-label="暂停">
          ▐▐
        </button>
        <button className="opacity-70" aria-label="加速">
          ⏩
        </button>
        <button
          className="ml-auto disabled:opacity-40"
          disabled={status !== "done"}
          onClick={() => navigate(`/run/${id}/retro`)}
        >
          看结果 →
        </button>
      </div>
    </div>
  );
}
