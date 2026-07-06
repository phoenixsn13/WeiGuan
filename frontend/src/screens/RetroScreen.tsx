import { useNavigate, useParams } from "react-router-dom";

import { RunAnalysisPanel } from "../components/RunAnalysisPanel";
import { useApiKey } from "../api/useApiKey";

export default function RetroScreen() {  // review:P8-T7
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const creds = useApiKey();

  return (
    <RunAnalysisPanel
      runId={id}
      creds={creds}
      backAction={
        <a
          href={`/run/${id}/live?replay=1`}
          className="mt-8 flex min-h-11 items-center justify-center rounded-card bg-white/10 text-sm font-semibold text-white hover:bg-white/20"
        >
          回到评论区
        </a>
      }
      worldAction={
        (summary) =>
          summary?.world_id ? (
            <button
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-card bg-brand text-sm font-semibold text-slate-950 hover:brightness-105"
              onClick={() => navigate(`/world/${summary.world_id}/live`)}
            >
              看世界现场
            </button>
          ) : null
      }
    />
  );
}
